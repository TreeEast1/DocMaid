import type { ProviderSettings } from '../types/runtime';
import { readEncryptedApiKey, saveEncryptedApiKey } from './secureStorage';

const SETTINGS_KEY = 'docmaid.provider.settings';

const defaultSettings: ProviderSettings = {
  provider: 'local',
  baseUrl: '',
  model: 'local-heuristic-v1',
  apiKeyConfigured: false
};

export async function getProviderSettings(): Promise<ProviderSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const apiKey = await readEncryptedApiKey();

  return {
    ...defaultSettings,
    ...(stored[SETTINGS_KEY] as Partial<ProviderSettings> | undefined),
    apiKeyConfigured: Boolean(apiKey)
  };
}

export async function saveProviderSettings(input: {
  provider: ProviderSettings['provider'];
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<ProviderSettings> {
  if (input.apiKey) {
    await saveEncryptedApiKey(input.apiKey);
  }

  const nextSettings = {
    provider: input.provider,
    baseUrl: input.baseUrl.trim(),
    model: input.model,
    apiKeyConfigured: input.apiKey ? true : (await readEncryptedApiKey()) !== null
  } satisfies ProviderSettings;

  await chrome.storage.local.set({
    [SETTINGS_KEY]: {
      provider: nextSettings.provider,
      baseUrl: nextSettings.baseUrl,
      model: nextSettings.model
    }
  });

  return nextSettings;
}
