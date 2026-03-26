export interface TocNode {
  id: string;
  level: number;
  title: string;
  children: TocNode[];
}

export interface HeadingNode {
  id: string;
  level: number;
  title: string;
  path: string[];
  wordCount: number;
}

export interface ExtractedDocument {
  title: string;
  source: 'yuque' | 'feishu' | 'unknown';
  url: string;
  text: string;
  markdown: string;
  toc: TocNode[];
  headings: HeadingNode[];
  capturedAt: string;
}
