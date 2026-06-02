# Repository Guidelines

## 项目目标

本仓库 fork 自 `Trifall/chat-export`，目标是把原本的 AI 对话导出插件改造成个人自用的 Chrome 插件：从 ChatGPT、Claude、Gemini 等页面提取当前会话，转换为 Markdown，直接调用腾讯文档 OpenAPI 创建在线文档并写入内容，最后在插件弹窗返回腾讯文档链接。

## 来源与现有能力

原项目已经支持从 ChatGPT、Claude、Gemini AI Studio 导出对话，并可生成 Markdown、HTML、JSON、XML。现有代码入口集中在：

- `src/content.ts`：content script，负责页面注入、按钮插入和接收 popup 消息。
- `src/pages/popup*`：插件弹窗 UI。
- `src/pages/options*` 与 `src/options-storage.ts`：设置页和配置存储。
- `src/modules/chat-content.ts`：统一聚合不同站点的会话提取结果。
- `src/modules/content-handlers.ts`：Markdown、HTML、JSON、XML 格式转换。
- `src/modules/chatgpt|claude|gemini/`：各 AI 平台 DOM 解析适配。

## 技术边界与安全约束

不引入自建后端服务，不在源码、测试、文档示例中硬编码真实 Client ID、Client Secret、API Key、Access Token 或 Cookie。所有腾讯文档配置必须由用户在设置页填写或授权获得，并通过 `chrome.storage` 或现有 `webext-options-sync` 封装保存。日志中禁止输出 Token、密钥、完整授权头和用户对话正文。

腾讯文档 OpenAPI 的接口路径、认证方式、请求参数和权限范围必须以官方文档为准；未确认前只能使用 mock、占位实现或明确标注“待查官方文档”。

## 开发原则

优先复用原项目的会话解析、格式转换和导出流程，避免大规模重写架构。新增能力应围绕现有模块扩展：设置页扩展腾讯文档配置，导出层新增“导出到腾讯文档”路径，服务层新增腾讯文档 client。除非与新目标直接冲突，不删除原有 Markdown、HTML、JSON、XML 本地导出能力。

修改前先走通数据流：页面 DOM -> 平台解析模块 -> `getChatContent()` -> `formatContent(..., 'markdown')` -> 腾讯文档 client -> popup 展示链接。

## 推荐代码阅读顺序

1. `readme.md`，了解原项目能力、运行方式和限制。
2. `src/manifest.json`，确认权限、content script、popup、options 配置。
3. `src/content.ts`，理解页面注入和消息通信。
4. `src/modules/chat-content.ts` 与 `src/modules/content-handlers.ts`，理解导出主流程。
5. `src/modules/chatgpt/`、`src/modules/claude/`、`src/modules/gemini/`，理解平台适配。
6. `src/pages/popup*`、`src/pages/options*`、`src/options-storage.ts`，理解 UI 与配置保存。

## 推荐实现路线

先抽出统一的 `exportCurrentConversationAsMarkdown()`，返回 `title`、`sourceUrl`、`platform`、`markdown`、`messageCount` 等结构化数据，同时保持旧导出可用。再扩展现有 options 页面保存腾讯文档配置。随后新增 `tencentDocsClient` 服务模块，先用 mock 验证创建文档、写入内容、返回链接的调用边界，待官方文档确认后替换真实 OpenAPI。最后在 popup 增加“导出到腾讯文档”入口并补齐错误状态。

## 禁止事项

- 禁止新增后端中转服务或把用户对话发送到非腾讯文档服务。
- 禁止提交真实密钥、Token、Cookie、测试账号或可复用授权信息。
- 禁止凭空编造腾讯文档 API 路径、字段和权限。
- 禁止为 MVP 大规模改写目录结构、平台解析逻辑或格式转换逻辑。
- 禁止扩大 `manifest.json` 权限范围而不说明必要性。
- 禁止删除原有导出能力，除非先说明冲突点并取得确认。

## 构建、测试与验收

常用命令：

- `npm install`：安装依赖。
- `npm run watch`：Parcel 监听构建扩展。
- `npm run build`：生成 `dist/`。
- `npm run check`：运行 TypeScript、ESLint、Prettier 检查。
- `npm test`：运行检查并构建。
- `npm run e2e`：运行 Playwright 测试。

MVP 验收至少覆盖 ChatGPT、Claude、Gemini 的 Markdown 导出，未配置腾讯文档参数的提示，腾讯文档 mock 成功和失败流程，长对话处理中状态，以及密钥不出现在日志、构建产物和示例文档中。

## 与 Codex 协作规范

Codex 或其他 AI Agent 进入仓库后，应先读取本文件、`todo.md`、`readme.md` 和关键入口文件，再提出或执行改动。复杂或涉及接口、权限、架构调整的任务必须先说明方案。每次改动保持可回滚，优先小步提交，避免夹带无关重构。涉及腾讯文档真实接口时必须先查官方文档并记录关键依据。

• 当前导出流程

仓库是一个 Manifest V3 扩展。src/manifest.json 配置了 content.ts 注入 ChatGPT、Claude、Gemini AI Studio 页面，popup 入口是 src/pages/popup.html，options 入口是 src/
pages/options.html。当前没有 background script。

现有导出有两条入口，但最终都复用同一套核心逻辑：

1. 页面内注入按钮路径
   src/content.ts 根据 detectSite() 判断站点，然后把 createExportButton() 插入到各平台的工具栏附近。按钮下拉菜单有 Copy to Clipboard 和 Save to File。这两个动作来自 src/
   modules/file-operations.ts，内部调用 getChatContent() 获取导出内容。

2. popup 路径
   src/pages/popup-page.tsx 通过 browser.tabs.query() 找到当前 tab，再向 content script 发送 { type: 'GET_CHAT_CONTENT' }。src/content.ts 收到消息后调用同一个
   getChatContent(false)，把 { format, content, messageCount, failedMessages } 返回给 popup。popup 再负责复制到剪贴板或生成文件下载。

核心数据流是：

当前页面 DOM -> detectSite() -> 平台解析模块 -> Message[] -> optionsStorage.exportType -> formatContent() -> clipboard/file/popup

平台解析入口集中在 src/modules/chat-content.ts：

- ChatGPT 调 getChatGPTChatContent()
- Claude 调 getClaudeChatContent()
- Gemini 调 getGeminiChatContent()

这些平台模块都返回消息数组和失败消息数，统一结构是 Message { role, content }。之后 formatContent(messages, format) 根据用户设置转换成 markdown、json、xml 或 html。

Markdown 当前不是单独的业务能力，而是 formatContent() 的一个分支。格式大致是每条消息生成：

### User

...

### Assistant

...

导出格式配置存储在 src/options-storage.ts，默认是 markdown。src/pages/options-page.tsx 和 popup 都能修改 exportType，通过 webext-options-sync 写入浏览器 storage。

几个平台解析细节：

- ChatGPT：按 [data-testid^="conversation-turn-"] 遍历轮次，从 [data-message-author-role] 取角色，提取 .whitespace-pre-wrap 或 .markdown 内容，过滤 sources、favicon，并
  处理图片、代码块和 “Thought for” 标签。

- Claude：分别找用户消息、助手消息和 pasted-only 消息，再按页面位置排序。助手消息优先点击 Claude 自带复制按钮读取剪贴板，失败时回退 DOM 提取；还会拼接 artifacts 和
  pasted content。

- Gemini：按 ms-chat-turn 遍历，借助 helper 关闭浮层、滚动、识别角色、处理 thinking message，并通过 edit mode 提取正文。

当前本地导出行为是：复制直接写入剪贴板；保存会创建 Blob，下载 chat-export-YYYY-MM-DD.ext。页面内保存调用 getChatContent(true) 会尝试恢复原剪贴板；popup 路径发送消息时固
定走 getChatContent(false)，所以它依赖 content script 返回内容后再在 popup 侧复制或下载。
