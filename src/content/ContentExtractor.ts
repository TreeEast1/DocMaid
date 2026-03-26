import type { ExtractedDocument } from '../shared/types/document';

export class ContentExtractor {
  private observer: MutationObserver | null = null;
  private latestDocument: ExtractedDocument | null = null;

  constructor(private readonly onChange?: (documentData: ExtractedDocument) => void) {}

  async start(): Promise<void> {
    await this.refresh();

    this.observer = new MutationObserver(() => {
      void this.refresh();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  getSnapshot(): ExtractedDocument | null {
    return this.latestDocument;
  }

  async refresh(): Promise<ExtractedDocument | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return null;
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/extractPageText.ts']
    });

    if (!result) {
      return null;
    }

    const [{ result: extracted }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const hostWindow = window as Window & {
          __DOCMAID_EXTRACT__?: () => ExtractedDocument;
        };

        return hostWindow.__DOCMAID_EXTRACT__ ? hostWindow.__DOCMAID_EXTRACT__() : null;
      }
    });

    this.latestDocument = extracted ?? null;

    if (this.latestDocument && this.onChange) {
      this.onChange(this.latestDocument);
    }

    return this.latestDocument;
  }
}
