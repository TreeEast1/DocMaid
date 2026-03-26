const STORAGE_KEY = 'docmaid.openai.credentials';
const MASTER_KEY_KEY = 'docmaid.master.key';

interface EncryptedPayload {
  cipherText: string;
  iv: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const existing = await chrome.storage.local.get(MASTER_KEY_KEY);

  if (typeof existing[MASTER_KEY_KEY] === 'string') {
    const keyBytes = fromBase64(existing[MASTER_KEY_KEY]);
    return crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  await chrome.storage.local.set({ [MASTER_KEY_KEY]: toBase64(rawKey) });
  return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function saveEncryptedApiKey(apiKey: string): Promise<void> {
  const key = await getOrCreateMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(apiKey)
  );

  const payload: EncryptedPayload = {
    cipherText: toBase64(new Uint8Array(cipherBuffer)),
    iv: toBase64(iv)
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: payload });
}

export async function readEncryptedApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const payload = stored[STORAGE_KEY] as EncryptedPayload | undefined;

  if (!payload) {
    return null;
  }

  const key = await getOrCreateMasterKey();
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(payload.iv)) },
    key,
    toArrayBuffer(fromBase64(payload.cipherText))
  );

  return decoder.decode(plainBuffer);
}
