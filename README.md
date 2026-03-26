# DocMaid

DocMaid is a Chrome Extension (Manifest V3) for Yuque and Feishu that audits and restructures cloud-document outlines with an AI multi-agent workflow.

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
```

Load the generated extension from `dist/` in Chrome developer mode.

## Notes

- API keys are stored in `chrome.storage.local` using AES-GCM encryption.
- Content extraction uses `MutationObserver` and `chrome.scripting.executeScript()` to survive lazy-loaded editor updates.
- The current extractor targets generic `div[contenteditable="true"]` containers and can be extended with host-specific selectors for Yuque and Feishu.
