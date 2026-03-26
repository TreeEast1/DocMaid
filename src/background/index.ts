import { runtimeMessages } from '../shared/messages';
import { runWorkflowWithProvider, testProviderConnection } from '../shared/llm/client';
import { getProviderSettings, saveProviderSettings } from '../shared/storage/settingsStorage';
import type { ExtractedDocument } from '../shared/types/document';
import type { WorkflowResult } from '../shared/types/analysis';
import type { ProviderSettings, RuntimeState } from '../shared/types/runtime';

const snapshots = new Map<number, ExtractedDocument>();
const workflows = new Map<number, WorkflowResult>();

function isSupportedUrl(url: string | undefined): boolean {
  return typeof url === 'string' && /yuque\.com|feishu\.cn|larksuite\.com/.test(url);
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function buildRuntimeState(tabId: number | null): Promise<RuntimeState> {
  const settings = await getProviderSettings();
  const tab = tabId ? await chrome.tabs.get(tabId) : null;

  return {
    document: tabId ? snapshots.get(tabId) ?? null : null,
    workflow: tabId ? workflows.get(tabId) ?? null : null,
    settings,
    supportedHost: isSupportedUrl(tab?.url)
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  snapshots.delete(tabId);
  workflows.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') {
    return;
  }

  const enabled = isSupportedUrl(tab.url);
  await chrome.sidePanel.setOptions({
    tabId,
    path: 'src/sidepanel/index.html',
    enabled
  });

  if (!enabled) {
    snapshots.delete(tabId);
    workflows.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === runtimeMessages.documentUpdated) {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false });
      return;
    }

    snapshots.set(tabId, message.payload as ExtractedDocument);
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === runtimeMessages.getRuntimeState) {
    void (async () => {
      const tabId = await getActiveTabId();
      sendResponse(await buildRuntimeState(tabId));
    })();
    return true;
  }

  if (message?.type === runtimeMessages.runWorkflow) {
    void (async () => {
      const tabId = await getActiveTabId();
      if (!tabId) {
        sendResponse({ ok: false, error: 'No active tab.' });
        return;
      }

      const documentData = snapshots.get(tabId);
      if (!documentData) {
        sendResponse({ ok: false, error: 'No document snapshot available yet.' });
        return;
      }

      const settings = await getProviderSettings();
      const workflow = await runWorkflowWithProvider(documentData, settings);
      workflows.set(tabId, workflow);
      sendResponse({ ok: true, workflow });
    })().catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Workflow failed.' });
    });
    return true;
  }

  if (message?.type === runtimeMessages.saveSettings) {
    void (async () => {
      const settings = await saveProviderSettings(message.payload as {
        provider: 'local' | 'openai-compatible' | 'gemini';
        baseUrl: string;
        model: string;
        apiKey?: string;
      });

      sendResponse({ ok: true, settings });
    })().catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Save settings failed.' });
    });
    return true;
  }

  if (message?.type === runtimeMessages.testProvider) {
    void (async () => {
      const settings = message.payload as ProviderSettings;
      const result = await testProviderConnection(settings);
      sendResponse({ ok: true, result });
    })().catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Provider test failed.' });
    });
    return true;
  }
});
