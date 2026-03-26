import { useEffect, useState } from 'react';
import { Braces, FolderTree, ShieldCheck, WandSparkles } from 'lucide-react';
import type { ExtractedDocument } from '../shared/types/document';
import { ContentExtractor } from '../content/ContentExtractor';
import { auditorSystemPrompt } from '../shared/prompts/auditor';

const extractor = new ContentExtractor();

function flattenToc(nodes: ExtractedDocument['toc'], prefix = ''): Array<{ key: string; label: string }> {
  return nodes.flatMap((node, index) => {
    const key = `${prefix}${index + 1}`;
    return [
      { key, label: `${'  '.repeat(node.level - 1)}H${node.level} ${node.title}` },
      ...flattenToc(node.children, `${key}.`)
    ];
  });
}

export default function App() {
  const [documentData, setDocumentData] = useState<ExtractedDocument | null>(null);

  useEffect(() => {
    const liveExtractor = new ContentExtractor(setDocumentData);
    void liveExtractor.start();
    void extractor.refresh().then(setDocumentData);

    return () => {
      liveExtractor.stop();
    };
  }, []);

  const tocRows = documentData ? flattenToc(documentData.toc) : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f5efe6,_#ffffff_48%,_#e7edf2_100%)] p-4 text-ink">
      <section className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-panel backdrop-blur">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent">DocMaid</p>
            <h1 className="mt-1 text-2xl font-semibold">智能云文档管家</h1>
            <p className="mt-2 text-sm text-slate-600">
              面向语雀与飞书的侧边栏整理助手，先提取结构，再交给多智能体做最小改动建议。
            </p>
          </div>
          <WandSparkles className="mt-1 text-accent" />
        </header>

        <div className="grid gap-3">
          <article className="rounded-2xl bg-sand p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FolderTree size={16} />
              当前文档
            </div>
            <p className="truncate text-sm">{documentData?.title ?? '未检测到可提取的文档内容'}</p>
            <p className="mt-1 text-xs text-slate-500">{documentData?.source ?? 'unknown'}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Braces size={16} />
              原始大纲
            </div>
            <div className="max-h-60 space-y-2 overflow-auto text-sm">
              {tocRows.length > 0 ? (
                tocRows.map((row) => (
                  <p key={row.key} className="whitespace-pre-wrap text-slate-700">
                    {row.label}
                  </p>
                ))
              ) : (
                <p className="text-slate-500">当前页面还没有解析出 H1-H4 目录结构。</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={16} />
              Auditor Prompt
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {auditorSystemPrompt}
            </pre>
          </article>
        </div>
      </section>
    </main>
  );
}
