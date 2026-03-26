import { auditorSystemPrompt } from '../prompts/auditor';
import { consistencySystemPrompt } from '../prompts/consistency';
import { structuringSystemPrompt } from '../prompts/structuring';
import { runLocalWorkflow } from '../agents/localWorkflow';
import type { AuditorOutput, ConsistencyOutput, StructuringOutput, WorkflowResult } from '../types/analysis';
import type { ExtractedDocument } from '../types/document';
import type { ProviderSettings } from '../types/runtime';
import { readEncryptedApiKey } from '../storage/secureStorage';

export interface ProviderDraft extends ProviderSettings {
  apiKey?: string;
}

function stripJsonFence(value: string): string {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function extractJson<T>(value: string): T {
  return JSON.parse(stripJsonFence(value)) as T;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '');
}

async function requestOriginPermission(baseUrl: string): Promise<void> {
  const url = new URL(baseUrl);
  const originPattern = `${url.protocol}//${url.host}/*`;
  const granted = await chrome.permissions.request({ origins: [originPattern] });

  if (!granted) {
    throw new Error(`Host permission denied for ${originPattern}`);
  }
}

async function resolveApiKey(settings: ProviderDraft): Promise<string> {
  return settings.apiKey?.trim() || (await readEncryptedApiKey()) || '';
}

async function callOpenAiCompatible(settings: ProviderDraft, prompt: string, systemPrompt: string): Promise<string> {
  if (!settings.baseUrl) {
    throw new Error('Base URL is required for OpenAI-compatible providers.');
  }

  const apiKey = await resolveApiKey(settings);
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  await requestOriginPermission(settings.baseUrl);

  const endpoint = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI-compatible response does not contain message content.');
  }

  return content;
}

async function callGemini(settings: ProviderDraft, prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = await resolveApiKey(settings);
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const baseUrl = settings.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  await requestOriginPermission(baseUrl);

  const endpoint = `${normalizeBaseUrl(baseUrl)}/models/${settings.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();

  if (!content) {
    throw new Error('Gemini response does not contain text parts.');
  }

  return content;
}

async function callProvider(settings: ProviderDraft, prompt: string, systemPrompt: string): Promise<string> {
  if (settings.provider === 'gemini') {
    return callGemini(settings, prompt, systemPrompt);
  }

  return callOpenAiCompatible(settings, prompt, systemPrompt);
}

function createAuditorPrompt(documentData: ExtractedDocument): string {
  return JSON.stringify(
    {
      task: 'Audit current hierarchy and return JSON only.',
      title: documentData.title,
      url: documentData.url,
      headings: documentData.headings,
      markdown_excerpt: documentData.markdown.slice(0, 12000)
    },
    null,
    2
  );
}

function createStructuringPrompt(documentData: ExtractedDocument, auditor: AuditorOutput): string {
  return JSON.stringify(
    {
      task: 'Create a minimal-change structure blueprint.',
      title: documentData.title,
      toc: documentData.toc,
      headings: documentData.headings,
      auditor
    },
    null,
    2
  );
}

function createConsistencyPrompt(documentData: ExtractedDocument, structuring: StructuringOutput): string {
  return JSON.stringify(
    {
      task: 'Validate that the suggested structure preserves key information.',
      title: documentData.title,
      markdown_excerpt: documentData.markdown.slice(0, 12000),
      export_markdown: structuring.export_markdown,
      critical_terms_hint: documentData.headings.map((heading) => heading.title)
    },
    null,
    2
  );
}

export async function testProviderConnection(settings: ProviderDraft): Promise<{ ok: true; message: string }> {
  if (settings.provider === 'local') {
    return { ok: true, message: 'Local heuristic mode does not require a network connection.' };
  }

  const content = await callProvider(
    settings,
    JSON.stringify({ ping: 'Reply with {"status":"ok"} only.' }),
    'Return JSON only.'
  );
  const parsed = extractJson<{ status?: string }>(content);

  if (parsed.status !== 'ok') {
    throw new Error('Provider responded, but the test payload was not valid JSON status output.');
  }

  return { ok: true, message: 'Provider connection succeeded.' };
}

export async function runWorkflowWithProvider(
  documentData: ExtractedDocument,
  settings: ProviderDraft
): Promise<WorkflowResult> {
  if (settings.provider === 'local' || !settings.apiKeyConfigured) {
    return runLocalWorkflow(documentData);
  }

  try {
    const auditor = extractJson<AuditorOutput>(
      await callProvider(settings, createAuditorPrompt(documentData), auditorSystemPrompt)
    );
    const structuring = extractJson<StructuringOutput>(
      await callProvider(settings, createStructuringPrompt(documentData, auditor), structuringSystemPrompt)
    );
    const consistency = extractJson<ConsistencyOutput>(
      await callProvider(settings, createConsistencyPrompt(documentData, structuring), consistencySystemPrompt)
    );

    return {
      auditor,
      structuring,
      consistency,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    const fallback = runLocalWorkflow(documentData);
    fallback.consistency.summary = `${
      fallback.consistency.summary
    } Remote workflow failed, so DocMaid fell back to local analysis. Reason: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
    return fallback;
  }
}
