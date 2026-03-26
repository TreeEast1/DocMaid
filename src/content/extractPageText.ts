import type { ExtractedDocument, TocNode } from '../shared/types/document';

interface HostWindow extends Window {
  __DOCMAID_EXTRACT__?: () => ExtractedDocument;
}

function detectSource(hostname: string): ExtractedDocument['source'] {
  if (hostname.includes('yuque.com')) {
    return 'yuque';
  }

  if (hostname.includes('feishu.cn') || hostname.includes('larksuite.com')) {
    return 'feishu';
  }

  return 'unknown';
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function inferToc(container: HTMLElement): TocNode[] {
  const headings = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4'));
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  headings.forEach((heading, index) => {
    const level = Number.parseInt(heading.tagName.replace('H', ''), 10);
    const node: TocNode = {
      id: heading.id || `heading-${index + 1}`,
      level,
      title: normalizeText(heading.innerText || heading.textContent || `Untitled ${index + 1}`),
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      root.push(node);
    }

    stack.push(node);
  });

  return root;
}

function findEditableContainer(): HTMLElement | null {
  const selectors = [
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    '[data-testid="editor"] div[contenteditable="true"]',
    '.ne-doc-body',
    '.ql-editor'
  ];

  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector);
    if (node && node.innerText.trim()) {
      return node;
    }
  }

  return null;
}

function toPseudoMarkdown(container: HTMLElement): string {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, li, pre, blockquote'));
  const lines = blocks.map((element) => {
    const text = normalizeText(element.innerText || element.textContent || '');
    if (!text) {
      return '';
    }

    if (/^H[1-4]$/.test(element.tagName)) {
      const depth = Number.parseInt(element.tagName.slice(1), 10);
      return `${'#'.repeat(depth)} ${text}`;
    }

    if (element.tagName === 'LI') {
      return `- ${text}`;
    }

    if (element.tagName === 'PRE') {
      return `\`\`\`\n${text}\n\`\`\``;
    }

    if (element.tagName === 'BLOCKQUOTE') {
      return `> ${text}`;
    }

    return text;
  });

  return lines.filter(Boolean).join('\n\n');
}

function extractDocument(): ExtractedDocument {
  const container = findEditableContainer();
  const text = container ? normalizeText(container.innerText || container.textContent || '') : '';
  const toc = container ? inferToc(container) : [];
  const title = normalizeText(document.title || 'Untitled document');

  return {
    title,
    source: detectSource(window.location.hostname),
    url: window.location.href,
    text,
    markdown: container ? toPseudoMarkdown(container) : text,
    toc,
    capturedAt: new Date().toISOString()
  };
}

(window as HostWindow).__DOCMAID_EXTRACT__ = extractDocument;
