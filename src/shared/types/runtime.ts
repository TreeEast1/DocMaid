import type { ExtractedDocument } from './document';
import type { WorkflowResult } from './analysis';

export interface ProviderSettings {
  provider: 'local' | 'openai-compatible' | 'gemini';
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
}

export interface RuntimeState {
  document: ExtractedDocument | null;
  workflow: WorkflowResult | null;
  settings: ProviderSettings;
  supportedHost: boolean;
}
