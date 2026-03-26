# DocMaid

DocMaid 是一个面向语雀和飞书文档的 Chrome 插件，运行在浏览器侧边栏中，专注解决“文档越写越乱、目录越来越散、层级越来越不清楚”的问题。

它的核心思路不是改写正文，而是先抓取当前云文档的标题结构和内容摘要，再通过多智能体工作流给出更合理的文档骨架建议，让你能用最小改动把文档整理回可读、可维护的状态。

## 项目定位

DocMaid 主要适合以下场景：

- 学习笔记写久了，标题层级混乱，目录难看
- 技术文档不断追加，章节顺序越来越不合理
- 实习记录、项目记录、周报沉淀后，结构失去主线
- 想用 AI 整理文档，但不想让 AI 直接乱改正文

DocMaid 当前优先支持：

- 语雀
- 飞书文档

## 当前已经支持的能力

- 在 Chrome Side Panel 中使用，不遮挡原始编辑页面
- 自动抓取当前语雀/飞书页面中的文档内容和标题结构
- 使用 `MutationObserver` 监听动态编辑器，适配懒加载和实时变化
- 在侧边栏中配置自己的 LLM 服务
- 支持 `OpenAI-compatible` 接口
- 支持 `Gemini` 接口
- API Key 加密存储到 `chrome.storage.local`
- 内置三段式工作流：
  - Auditor：审计当前目录结构问题
  - Structuring Specialist：给出最小改动蓝图
  - Consistency Guard：检查关键术语、代码块、公式是否有丢失风险
- 当远程 LLM 调用失败时，自动降级到本地规则分析
- 可直接复制建议蓝图，回到原文档中手动落地

## 技术栈

- Vite
- React
- TypeScript
- Tailwind CSS
- CRXJS
- Chrome Extension Manifest V3
- Chrome Side Panel API

## 项目目录

```text
DocMaid/
├── manifest.config.ts
├── package.json
├── src/
│   ├── background/              # 后台服务，维护当前标签页状态与工作流调度
│   ├── content/                 # 内容脚本，负责监听页面并上报文档快照
│   ├── shared/
│   │   ├── agents/              # 本地多智能体工作流兜底实现
│   │   ├── extract/             # 文档内容与标题结构提取
│   │   ├── llm/                 # 远程 LLM 调用与工作流编排
│   │   ├── prompts/             # Auditor / Structuring / Consistency prompts
│   │   ├── storage/             # 配置和 API Key 存储
│   │   └── types/               # 共享类型定义
│   ├── sidepanel/               # 插件侧边栏 UI
│   └── styles/
└── vite.config.ts
```

## 本地开发

先安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
```

构建完成后，产物会输出到 `dist/` 目录。

## 在 Chrome 中加载插件

1. 执行 `npm run build`
2. 打开 Chrome 扩展管理页：`chrome://extensions/`
3. 打开右上角“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择项目里的 `dist/` 目录

加载完成后，就可以在支持的网站中打开 DocMaid 侧边栏。

## 如何使用

### 1. 打开支持的文档页面

先在 Chrome 中打开：

- 语雀文档页面
- 飞书文档页面

DocMaid 会自动尝试识别编辑器区域并提取文档内容与标题层级。

### 2. 打开侧边栏

点击插件图标后，DocMaid 会在浏览器右侧以 Side Panel 的方式打开。

### 3. 配置你自己的 LLM

在侧边栏的 `Provider 设置` 区域中，你可以选择：

- `OpenAI-compatible`
- `Gemini`
- `Local heuristic`

如果你希望真正用上 AI 整理能力，推荐配置前两者之一。

需要填写的字段有：

- `API Base URL`
- `Model`
- `API Key`

### 4. 推荐配置

#### OpenAI-compatible

- Base URL：`https://api.openai.com/v1`
- Model：`gpt-5.4-mini`

如果你使用的是国内可兼容 OpenAI 协议的中转网关、私有模型服务或者其他兼容 API，也可以把 Base URL 改成你自己的接口地址。

#### Gemini

- Base URL：`https://generativelanguage.googleapis.com/v1beta`
- Model：`gemini-2.5-pro`

### 5. 测试连接并保存

填写完成后：

1. 点击 `测试连接`
2. 连接成功后点击 `保存设置`

DocMaid 会把 API Key 加密后保存在本地浏览器存储中，后续不需要每次重复输入。

### 6. 运行工作流

点击 `运行工作流` 后，DocMaid 会按顺序执行：

1. Auditor：识别当前文档结构问题
2. Structuring Specialist：生成最小改动的目录蓝图
3. Consistency Guard：检查建议结构是否存在信息丢失风险

最后你会看到：

- 当前原始大纲
- AI 建议蓝图
- 审计问题列表
- 一致性检查结果

你也可以点击 `复制蓝图`，把建议结构复制出去，回到原文档中手动整理。

## 设计原则

DocMaid 不是“全文重写器”，而是“文档结构整理器”。

它的核心原则是：

- 最小改动原则：优先调整标题层级、标题命名、局部顺序，而不是重写正文
- 保守原则：尽量不碰代码块、公式、关键术语
- 人机协作原则：AI 提建议，用户决定是否落地

## 当前限制

现阶段仍有一些现实限制：

- 不同语雀/飞书页面的 DOM 结构可能存在差异，复杂页面还需要继续细化 selector
- 目前更偏“建议式整理”，还没有做“一键回写标题层级”
- 合并多个文档生成统一蓝图的能力还未完成
- 如果远程模型返回 JSON 不稳定，会自动回退到本地分析，但结果会更保守

## 安全说明

- API Key 会加密后存储在 `chrome.storage.local`
- 当你测试或使用远程模型时，DocMaid 会请求对应 API 域名的运行时访问权限
- 插件主要读取当前文档页面内容，用于生成结构化整理建议

如果后续要上架 Chrome Web Store，还需要补充隐私政策、数据使用说明和权限用途说明。

## 后续规划

下一阶段优先考虑补这些功能：

- 更精确的语雀/飞书 DOM 适配
- 一键 Auto-Leveling
- 多文档合并蓝图
- Diff 树对比视图
- 更完整的模型适配层
- 商店上架材料与隐私页

## 适合谁参与贡献

如果你熟悉以下任一方向，这个项目都适合继续协作：

- Chrome 插件开发
- 富文本/云文档 DOM 提取
- Prompt Engineering
- OpenAI / Gemini / 兼容接口接入
- React + Tailwind 前端交互

## 许可证

当前仓库还没有单独补充 License 文件。若准备开源协作，建议尽快补一个明确许可证。
