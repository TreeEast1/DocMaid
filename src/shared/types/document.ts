export interface TocNode {
  id: string;
  level: number;
  title: string;
  children: TocNode[];
}

export interface ExtractedDocument {
  title: string;
  source: 'yuque' | 'feishu' | 'unknown';
  url: string;
  text: string;
  markdown: string;
  toc: TocNode[];
  capturedAt: string;
}
