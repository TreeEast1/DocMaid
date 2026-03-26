# DocMaid

DocMaid is a Chrome Extension (Manifest V3) for Yuque and Feishu that audits and restructures cloud-document outlines with an AI multi-agent workflow.

## What Works Now

- Side Panel UI for Yuque and Feishu documents
- Real-time document snapshot sync via content script + `MutationObserver`
- Configurable LLM provider settings in the side panel
- Encrypted API key storage in `chrome.storage.local`
- OpenAI-compatible and Gemini request paths
- Local heuristic fallback when remote LLM calls fail
- Auditor / Structuring Specialist / Consistency Guard workflow output
- Copyable outline blueprint for manual application back into the source document

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- CRXJS for Manifest V3
- Chrome Side Panel API

## Project Structure

```text
DocMaid/
├── manifest.config.ts
├── package.json
├── src/
│   ├── background/
│   ├── content/
│   ├── shared/
│   │   ├── prompts/
│   │   ├── storage/
│   │   └── types/
│   ├── sidepanel/
│   └── styles/
└── vite.config.ts
```

## Development

```bash
npm install
npm run dev
npm run build
```

Load the generated extension from `dist/` in Chrome developer mode.

## How To Use

1. Open a Yuque or Feishu document in Chrome.
2. Open the DocMaid side panel.
3. In `Provider 设置`, choose one of:
   - `OpenAI-compatible`
   - `Gemini`
   - `Local heuristic`
4. Fill in:
   - `API Base URL`
   - `Model`
   - `API Key`
5. Click `测试连接`.
6. Click `保存设置`.
7. Click `运行工作流`.
8. Review the audit issues and copy the suggested outline blueprint.

## Recommended Provider Presets

- OpenAI-compatible
  - Base URL: `https://api.openai.com/v1`
  - Model: `gpt-5.4-mini`
- Gemini
  - Base URL: `https://generativelanguage.googleapis.com/v1beta`
  - Model: `gemini-2.5-pro`

## Notes

- API keys are stored in `chrome.storage.local` using AES-GCM encryption.
- DocMaid requests runtime host permission for the configured API origin when you test or use a remote provider.
- Content extraction uses a content script and `MutationObserver` to survive lazy-loaded editor updates.
- The extractor targets generic `div[contenteditable="true"]` containers plus heading-like nodes used by rich editors.
