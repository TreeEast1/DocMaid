import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'DocMaid',
  description: 'AI-powered document structure assistant for Yuque and Feishu.',
  version: '0.1.0',
  minimum_chrome_version: '114',
  action: {
    default_title: 'Open DocMaid'
  },
  permissions: ['sidePanel', 'storage', 'activeTab', 'scripting'],
  host_permissions: [
    'https://www.yuque.com/*',
    'https://*.yuque.com/*',
    'https://*.feishu.cn/*',
    'https://*.larksuite.com/*'
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: [
        'https://www.yuque.com/*',
        'https://*.yuque.com/*',
        'https://*.feishu.cn/*',
        'https://*.larksuite.com/*'
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html'
  },
  web_accessible_resources: [
    {
      resources: ['src/content/extractPageText.ts'],
      matches: [
        'https://www.yuque.com/*',
        'https://*.yuque.com/*',
        'https://*.feishu.cn/*',
        'https://*.larksuite.com/*'
      ]
    }
  ]
});
