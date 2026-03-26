import type { ExtractedDocument, HeadingNode, TocNode } from '../types/document';

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

function getHeadingLevel(element: HTMLElement): number | null {
  if (/^H[1-6]$/.test(element.tagName)) {
    return Number.parseInt(element.tagName.slice(1), 10);
  }

  const attrCandidates = [
    element.getAttribute('aria-level'),
    element.getAttribute('data-heading-level'),
    element.dataset.headingLevel
  ];

  for (const candidate of attrCandidates) {
    if (!candidate) {
      continue;
    }

    const level = Number.parseInt(candidate, 10);
    if (level >= 1 && level <= 4) {
      return level;
    }
  }

  if (element.getAttribute('role') === 'heading') {
    return 2;
  }

  return null;
}

function isHeadingElement(element: HTMLElement): boolean {
  return getHeadingLevel(element) !== null;
}

function collectHeadingElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, [role="heading"], [data-heading-level], [aria-level], .ne-h1, .ne-h2, .ne-h3, .ne-h4'
    )
  );

  return candidates.filter((element) => {
    const level = getHeadingLevel(element);
    const title = normalizeText(element.innerText || element.textContent || '');
    return level !== null && level <= 4 && Boolean(title);
  });
}

function inferTocFromHeadings(headings: HeadingNode[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  headings.forEach((heading) => {
    const node: TocNode = {
      id: heading.id,
      level: heading.level,
      title: heading.title,
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
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

function buildHeadingNodes(container: HTMLElement): HeadingNode[] {
  const headingElements = collectHeadingElements(container);
  const headings: HeadingNode[] = [];
  const pathStack: string[] = [];
  const sectionWordCounts = new Map<string, number>();

  headingElements.forEach((heading, index) => {
    const level = getHeadingLevel(heading) ?? 2;
    const title = normalizeText(heading.innerText || heading.textContent || `Untitled ${index + 1}`);
    const id = heading.id || `heading-${index + 1}`;

    pathStack.splice(level - 1);
    pathStack[level - 1] = title;

    headings.push({
      id,
      level,
      title,
      path: pathStack.filter(Boolean),
      wordCount: 0
    });

    sectionWordCounts.set(id, 0);
  });

  const allNodes = Array.from(container.querySelectorAll<HTMLElement>('p, li, pre, blockquote'));
  let currentHeadingId = headings[0]?.id;
  let headingCursor = 0;

  allNodes.forEach((node) => {
    while (
      headingCursor < headingElements.length - 1 &&
      headingElements[headingCursor + 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING
    ) {
      headingCursor += 1;
      currentHeadingId = headings[headingCursor]?.id;
    }

    if (!currentHeadingId) {
      return;
    }

    const words = normalizeText(node.innerText || node.textContent || '')
      .split(/\s+/)
      .filter(Boolean).length;

    sectionWordCounts.set(currentHeadingId, (sectionWordCounts.get(currentHeadingId) ?? 0) + words);
  });

  return headings.map((heading) => ({
    ...heading,
    wordCount: sectionWordCounts.get(heading.id) ?? 0
  }));
}

function findEditableContainer(): HTMLElement | null {
  const selectors = [
    '.ne-doc-body',
    '.ql-editor',
    '[data-testid="editor"] div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]'
  ];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const bestNode = nodes
      .filter((node) => normalizeText(node.innerText || node.textContent || '').length > 80)
      .sort((left, right) => right.innerText.length - left.innerText.length)[0];

    if (bestNode) {
      return bestNode;
    }
  }

  return null;
}

function toPseudoMarkdown(container: HTMLElement): string {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, [role="heading"], p, li, pre, blockquote')
  );

  const lines = blocks.map((element) => {
    const text = normalizeText(element.innerText || element.textContent || '');
    if (!text) {
      return '';
    }

    const level = getHeadingLevel(element);
    if (level) {
      return `${'#'.repeat(Math.min(level, 4))} ${text}`;
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

export function extractDocumentFromPage(rootDocument: Document = document): ExtractedDocument {
  const container = findEditableContainer();
  const title = normalizeText(rootDocument.title || 'Untitled document');
  const text = container ? normalizeText(container.innerText || container.textContent || '') : '';
  const headings = container ? buildHeadingNodes(container) : [];
  const toc = inferTocFromHeadings(headings);

  return {
    title,
    source: detectSource(window.location.hostname),
    url: window.location.href,
    text,
    markdown: container ? toPseudoMarkdown(container) : text,
    toc,
    headings,
    capturedAt: new Date().toISOString()
  };
}
