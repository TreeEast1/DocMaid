import { startTransition, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCheck,
  Copy,
  FileText,
  FolderTree,
  KeyRound,
  RefreshCw,
  Settings2,
  Sparkles,
  TriangleAlert
} from 'lucide-react';
import { runtimeMessages } from '../shared/messages';
import type { ProviderDraft } from '../shared/llm/client';
import type { WorkflowResult } from '../shared/types/analysis';
import type { ExtractedDocument } from '../shared/types/document';
import type { ProviderSettings, RuntimeState } from '../shared/types/runtime';
import { auditorSystemPrompt } from '../shared/prompts/auditor';

const providerPresets: Record<
  Exclude<ProviderSettings['provider'], 'local'>,
  { baseUrl: string; model: string }
> = {
  'openai-compatible': {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4-mini'
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-pro'
  }
};

function flattenOutline(items: ExtractedDocument['headings']): string[] {
  return items.map((item) => `${'  '.repeat(item.level - 1)}H${item.level} ${item.title}`);
}

function flattenBlueprint(nodes: WorkflowResult['structuring']['blueprint']): string[] {
  const lines: string[] = [];
  const visit = (items: WorkflowResult['structuring']['blueprint']) => {
    items.forEach((item) => {
      lines.push(`${'  '.repeat(item.level - 1)}H${item.level} ${item.title}`);
      visit(item.children);
    });
  };

  visit(nodes);
  return lines;
}

async function getRuntimeState(): Promise<RuntimeState> {
  return chrome.runtime.sendMessage({ type: runtimeMessages.getRuntimeState });
}

async function runWorkflow(): Promise<WorkflowResult> {
  const response = await chrome.runtime.sendMessage({ type: runtimeMessages.runWorkflow });
  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.workflow as WorkflowResult;
}

async function saveSettings(payload: {
  provider: ProviderSettings['provider'];
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<ProviderSettings> {
  const response = await chrome.runtime.sendMessage({
    type: runtimeMessages.saveSettings,
    payload
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.settings as ProviderSettings;
}

async function testProvider(payload: ProviderDraft): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: runtimeMessages.testProvider,
    payload
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.result.message as string;
}

function StatCard({
  title,
  value,
  icon: Icon
}: {
  title: string;
  value: string;
  icon: typeof FolderTree;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
        <Icon size={14} />
        {title}
      </div>
      <p className="text-sm font-medium text-ink">{value}</p>
    </article>
  );
}

export default function App() {
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderSettings['provider']>('local');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('local-heuristic-v1');
  const [apiKey, setApiKey] = useState('');
  const [providerStatus, setProviderStatus] = useState<string | null>(null);

  useEffect(() => {
    void getRuntimeState().then((state) => {
      startTransition(() => {
        setRuntimeState(state);
        setProvider(state.settings.provider);
        setBaseUrl(state.settings.baseUrl);
        setModel(state.settings.model);
        setLoading(false);
      });
    });
  }, []);

  useEffect(() => {
    if (provider === 'local') {
      if (!model || model === 'gpt-5.4-mini' || model === 'gemini-2.5-pro') {
        setModel('local-heuristic-v1');
      }
      return;
    }

    const preset = providerPresets[provider];
    if (!baseUrl) {
      setBaseUrl(preset.baseUrl);
    }
    if (!model || model === 'local-heuristic-v1') {
      setModel(preset.model);
    }
  }, [provider]);

  const documentData = runtimeState?.document ?? null;
  const workflow = runtimeState?.workflow ?? null;
  const issuesCount = workflow?.auditor.issues_found.length ?? 0;
  const outlineLines = useMemo(() => (documentData ? flattenOutline(documentData.headings) : []), [documentData]);
  const blueprintLines = useMemo(
    () => (workflow ? flattenBlueprint(workflow.structuring.blueprint) : []),
    [workflow]
  );

  async function handleRefresh(): Promise<void> {
    setLoading(true);
    setError(null);
    const state = await getRuntimeState();
    setRuntimeState(state);
    setLoading(false);
  }

  async function handleRun(): Promise<void> {
    setRunning(true);
    setError(null);

    try {
      const nextWorkflow = await runWorkflow();
      setRuntimeState((current) => (current ? { ...current, workflow: nextWorkflow } : current));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Analysis failed.');
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveSettings(): Promise<void> {
    try {
      const nextSettings = await saveSettings({
        provider,
        baseUrl,
        model,
        apiKey: apiKey.trim() || undefined
      });

      setRuntimeState((current) => (current ? { ...current, settings: nextSettings } : current));
      setApiKey('');
      setProviderStatus('设置已保存。');
    } catch (saveError) {
      setProviderStatus(saveError instanceof Error ? saveError.message : '保存设置失败。');
    }
  }

  async function handleTestProvider(): Promise<void> {
    setProviderStatus('正在测试连接...');
    try {
      const message = await testProvider({
        provider,
        baseUrl,
        model,
        apiKeyConfigured: Boolean(apiKey.trim()) || Boolean(runtimeState?.settings.apiKeyConfigured),
        apiKey: apiKey.trim() || undefined
      });
      setProviderStatus(message);
    } catch (testError) {
      setProviderStatus(testError instanceof Error ? testError.message : '连接测试失败。');
    }
  }

  async function handleCopyBlueprint(): Promise<void> {
    if (!workflow) {
      return;
    }

    await navigator.clipboard.writeText(workflow.structuring.export_markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f5efe6_0%,_#f9fbfc_38%,_#e7edf2_100%)] p-4 text-ink">
      <section className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-panel backdrop-blur">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">DocMaid</p>
            <h1 className="mt-1 text-2xl font-semibold">文档架构整理侧边栏</h1>
            <p className="mt-2 text-sm text-slate-600">
              先抓取当前语雀/飞书文档，再用你配置的 LLM 工作流给出结构修复与蓝图建议。
            </p>
          </div>
          <Sparkles className="mt-1 text-accent" />
        </header>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <StatCard title="Source" value={documentData?.source ?? 'unknown'} icon={FolderTree} />
          <StatCard title="Issues" value={workflow ? String(issuesCount) : '未分析'} icon={TriangleAlert} />
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            刷新快照
          </button>
          <button
            type="button"
            disabled={!documentData || running}
            onClick={() => void handleRun()}
            className="flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Bot size={16} />
            {running ? '分析中...' : '运行工作流'}
          </button>
          <button
            type="button"
            disabled={!workflow}
            onClick={() => void handleCopyBlueprint()}
            className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Copy size={16} />
            {copied ? '已复制' : '复制蓝图'}
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
        ) : null}

        {!runtimeState?.supportedHost ? (
          <article className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            当前标签页不是语雀或飞书文档页。打开受支持页面后再运行 DocMaid。
          </article>
        ) : null}

        <div className="grid gap-3">
          <article className="rounded-2xl bg-sand p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileText size={16} />
              当前文档
            </div>
            <p className="truncate text-sm font-medium">{documentData?.title ?? '还没接收到文档快照'}</p>
            <p className="mt-1 text-xs text-slate-500">{documentData?.url ?? '等待内容脚本上报'}</p>
            <p className="mt-2 text-xs text-slate-500">
              {documentData ? `${documentData.text.length} 字符，${documentData.headings.length} 个标题节点` : '未提取'}
            </p>
          </article>

          <article className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-900">
              <Sparkles size={16} />
              首次使用引导
            </div>
            <ol className="space-y-2 text-sm text-teal-950">
              <li>1. 打开语雀或飞书文档页，等待 DocMaid 自动抓取标题和正文。</li>
              <li>2. 在下方 Provider 设置里填入你的 `API Base URL`、`Model` 和 `API Key`。</li>
              <li>3. 先点“测试连接”，通过后保存设置，再运行工作流。</li>
              <li>4. 查看审计问题、建议蓝图，并复制蓝图回文档中人工落地。</li>
            </ol>
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <FolderTree size={16} />
              原始大纲
            </div>
            <div className="max-h-52 space-y-2 overflow-auto text-sm">
              {loading ? <p className="text-slate-500">正在读取当前标签页...</p> : null}
              {!loading && outlineLines.length === 0 ? <p className="text-slate-500">还没有检测到可用标题。</p> : null}
              {outlineLines.map((line) => (
                <p key={line} className="whitespace-pre-wrap text-slate-700">
                  {line}
                </p>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <CheckCheck size={16} />
              建议蓝图
            </div>
            <div className="max-h-52 space-y-2 overflow-auto text-sm">
              {!workflow ? <p className="text-slate-500">运行工作流后会在这里展示优化后的目录树。</p> : null}
              {blueprintLines.map((line) => (
                <p key={line} className="whitespace-pre-wrap text-slate-700">
                  {line}
                </p>
              ))}
            </div>
          </article>

          {workflow ? (
            <article className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <TriangleAlert size={16} />
                审计结果
              </div>
              <p className="mb-3 text-sm text-slate-700">{workflow.auditor.summary}</p>
              <div className="space-y-3">
                {workflow.auditor.issues_found.slice(0, 6).map((issue) => (
                  <div key={issue.issue_id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{issue.location.title}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs uppercase text-slate-500">
                        {issue.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{issue.reason}</p>
                    <p className="mt-2 text-xs text-accent">{issue.suggested_fix.notes}</p>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {workflow ? (
            <article className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <CheckCheck size={16} />
                一致性守卫
              </div>
              <p className="text-sm text-slate-700">{workflow.consistency.summary}</p>
              <p className="mt-2 text-xs text-slate-500">
                verdict: {workflow.consistency.verdict} | preserved terms: {workflow.consistency.preserved_terms.length}
              </p>
            </article>
          ) : null}

          <article className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Settings2 size={16} />
              Provider 设置
            </div>
            <div className="grid gap-3 text-sm">
              <label className="grid gap-1">
                <span className="text-slate-600">Provider</span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as ProviderSettings['provider'])}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="local">Local heuristic</option>
                  <option value="openai-compatible">OpenAI-compatible</option>
                  <option value="gemini">Gemini</option>
                </select>
              </label>
              {provider !== 'local' ? (
                <button
                  type="button"
                  onClick={() => {
                    setBaseUrl(providerPresets[provider].baseUrl);
                    setModel(providerPresets[provider].model);
                  }}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:bg-slate-100"
                >
                  使用推荐配置：{providerPresets[provider].baseUrl} | {providerPresets[provider].model}
                </button>
              ) : null}
              <label className="grid gap-1">
                <span className="text-slate-600">API Base URL</span>
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder={
                    provider === 'gemini'
                      ? 'https://generativelanguage.googleapis.com/v1beta'
                      : 'https://api.openai.com/v1 或你的兼容网关'
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-slate-600">Model</span>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="gpt-5.4-mini / gemini-2.5-pro / local-heuristic-v1"
                />
              </label>
              <label className="grid gap-1">
                <span className="flex items-center gap-2 text-slate-600">
                  <KeyRound size={14} />
                  API Key
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder={runtimeState?.settings.apiKeyConfigured ? '已配置，输入新值则覆盖' : '输入后加密存储到 chrome.storage.local'}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleTestProvider()}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  测试连接
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveSettings()}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  保存设置
                </button>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <p>推荐配置：</p>
                <p>`OpenAI-compatible`: Base URL 填 `https://api.openai.com/v1`，Model 填 `gpt-5.4-mini` 或你的兼容模型名。</p>
                <p>`Gemini`: Base URL 默认 `https://generativelanguage.googleapis.com/v1beta`，Model 可填 `gemini-2.5-pro`。</p>
                <p>若暂时不想联网，可保留 `Local heuristic`，它会给出本地规则分析结果。</p>
              </div>
              {providerStatus ? <p className="text-xs text-slate-500">{providerStatus}</p> : null}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Bot size={16} />
              Auditor Prompt
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {auditorSystemPrompt}
            </pre>
          </article>
        </div>
      </section>
    </main>
  );
}
