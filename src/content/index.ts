import { extractDocumentFromPage } from '../shared/extract/extractDocument';
import { runtimeMessages } from '../shared/messages';

let lastFingerprint = '';
let debounceTimer: number | null = null;

function fingerprint(value: string): string {
  return `${value.length}:${value.slice(0, 120)}`;
}

async function publishSnapshot(): Promise<void> {
  const documentData = extractDocumentFromPage();
  const nextFingerprint = fingerprint(`${documentData.title}\n${documentData.text}`);

  if (!documentData.text || nextFingerprint === lastFingerprint) {
    return;
  }

  lastFingerprint = nextFingerprint;
  await chrome.runtime.sendMessage({
    type: runtimeMessages.documentUpdated,
    payload: documentData
  });
}

function schedulePublish(): void {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    void publishSnapshot();
  }, 450);
}

const observer = new MutationObserver(() => {
  schedulePublish();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

window.addEventListener('load', () => {
  schedulePublish();
});

window.addEventListener('focus', () => {
  schedulePublish();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === runtimeMessages.getRuntimeState) {
    sendResponse({ ok: true });
  }
});

schedulePublish();
