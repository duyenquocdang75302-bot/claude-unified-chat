# Claude Unified Chat

## Vercel persistence

The Vercel deployment uses standard Next.js commands (`next dev`, `next build`, `next start`).
Create an Upstash Redis database from Vercel Storage and add `KV_REST_API_URL` and
`KV_REST_API_TOKEN` to the Production, Preview, and Development environments. These
variables persist the administrator shared Project and the token usage dashboard.
Without them, local development uses temporary memory; production shared Project edits
are rejected so data is not silently lost.

## Shared Project Permissions

The application supports multiple server-side shared projects. All authenticated accounts can use each project's instructions and knowledge files, while only an account with role `admin` can create, edit, upload, or delete shared projects. Every account can also create and manage private projects stored only in that account's browser storage. On Vercel, shared project data and usage records are stored in Upstash Redis through `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the local Cloudflare adapter remains available for legacy self-hosting. Chat histories and private projects remain separated per account in the browser. The project endpoints are `GET /api/project`, `PUT /api/project` (admin only), and `DELETE /api/project?id=<project-id>` (admin only). Existing single-project data is migrated automatically on first read.

一个以 Claude 系列模型为主、兼容 OpenAI API 格式的自托管 AI 聊天网站。项目默认连接 [APIKEY.FUN](https://apikey.fun)，所有模型请求均经 Next.js 服务端代理，API Key 不会发送到浏览器。

## 功能

- OpenAI 兼容的流式聊天，支持停止生成、重新生成、消息编辑和删除
- 启动后从 `/models` 自动加载模型，失败时回退到内置模型列表
- Claude 系列置顶，并支持手动输入任意模型 ID
- Markdown、GFM、代码高亮、一键复制及 KaTeX 数学公式
- 图片多选、剪贴板粘贴和拖拽上传，超过 500KB 自动压缩至最大边长 1536px，JPEG 质量 65%，所有图片总大小限制 3MB
- PDF、DOCX、文本、CSV、JSON 和常见代码文件解析
- 会话历史、图片、项目知识保存在浏览器 `IndexedDB`，旧版 `localStorage` 数据会自动迁移
- Claude Projects 风格的项目工作区：项目指令、知识库、默认模型和项目内独立会话
- 会话导出为 Markdown，并以内嵌 Data URL 保留图片
- 多用户账号：管理员、成员独立登录，每个成员绑定服务端 API Key
- 管理员 Token 用量页：按账号、模型、日期统计输入、输出和总 Token
- 可选网站访问密码
- Vercel 与 Docker 部署支持

## 环境要求

- Node.js 18.17 或更高版本，建议 Node.js 20 LTS
- pnpm 9 或更高版本，也可以使用 npm
- 一个 APIKEY.FUN API Key，或其他兼容 OpenAI API 格式的服务

## 本地安装

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 复制环境变量示例：

   ```bash
   cp .env.example .env.local
   ```

   Windows PowerShell：

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. 编辑 `.env.local`，填入真实 API Key：

   ```dotenv
   OPENAI_BASE_URL=https://apikey.fun/v1
   OPENAI_API_KEY=sk-xxxx
   ACCESS_PASSWORD=
   ```

4. 启动开发服务器：

   ```bash
   pnpm dev
   ```

5. 浏览器打开 `http://localhost:3000`。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `OPENAI_BASE_URL` | 否 | `https://apikey.fun/v1` | OpenAI 兼容 API 的基础地址，不要包含末尾 `/` |
| `OPENAI_API_KEY` | 是 | 无 | 仅由服务端读取的 API Key |
| `ACCESS_PASSWORD` | 否 | 空 | 设置后访问网页前必须输入该密码 |
| `AUTH_SECRET` | 多用户时是 | 无 | 至少 32 位随机字符串，用于签名登录 Cookie |
| `CHAT_ADMIN_USERNAME` / `CHAT_ADMIN_PASSWORD` | 否 | `admin` / 空 | 管理员账号 |
| `CHAT_USER_1_USERNAME` / `CHAT_USER_1_PASSWORD` | 否 | `team1` / 空 | 成员 1 账号 |
| `CHAT_USER_2_USERNAME` / `CHAT_USER_2_PASSWORD` | 否 | `team2` / 空 | 成员 2 账号 |
| `OPENAI_API_KEY_USER_1` | 否 | `OPENAI_API_KEY` | 管理员和成员 1 使用的 Key |
| `OPENAI_API_KEY_USER_2` | 成员 2 启用时是 | 无 | 成员 2 使用的 Key |

不要把 `.env`、`.env.local` 或真实 Key 提交到 Git。前端只请求本站的 `/api/chat`、`/api/models` 和 `/api/parse`。

配置任意一个 `CHAT_*_PASSWORD` 后会启用账号登录模式。管理员使用第 1 把 Key，并可访问 `/admin` 查看本网站记录的 Token 用量。上游未返回 usage 字段时会显示为估算值；实际扣费以 API 服务商后台为准。

## 文件与图片限制

- 图片一次最多 20 张；模型 ID 包含 `claude`、`gpt-4o`、`gpt-4.1`、`gemini` 或 `qwen-vl` 时视为支持视觉
- 文档一次最多 5 个，单文件最大 20MB
- 支持 `.txt`、`.md`、`.pdf`、`.docx`、`.csv`、`.json` 以及常见代码和配置文件
- Claude 模型最多拼入 150,000 字符文档内容，其他模型最多 50,000 字符；超出部分会被截断并明确标记
- 项目知识库每次最多上传 5 个文件、每个项目最多保存 20 个文件；项目对话会自动附加项目指令和知识内容
- 图片和大文档会占用较多浏览器存储空间；`IndexedDB` 容量远高于 `localStorage`，但重要会话仍建议定期导出

## Vercel 部署

1. 将项目推送到 GitHub、GitLab 或 Bitbucket。
2. 在 Vercel 新建项目并导入仓库，Framework Preset 选择 Next.js。
3. 在项目的 **Settings → Environment Variables** 添加：
   - `OPENAI_BASE_URL`
   - `OPENAI_API_KEY`
   - `ACCESS_PASSWORD`（可选）
4. 点击 Deploy。后续提交会自动触发新部署。

聊天和文件解析路由声明了 120 秒最大执行时间。Vercel 实际允许的时长取决于账户计划；若长回复频繁被平台中断，建议使用 Docker 自托管。

## Docker 部署

1. 在项目根目录创建 `.env`：

   ```dotenv
   OPENAI_BASE_URL=https://apikey.fun/v1
   OPENAI_API_KEY=sk-xxxx
   ACCESS_PASSWORD=可选密码
   ```

2. 构建并启动：

   ```bash
   docker compose up -d --build
   ```

3. 打开 `http://localhost:3000`。

查看日志：

```bash
docker compose logs -f claude-chat
```

停止服务：

```bash
docker compose down
```

## 常用命令

```bash
pnpm dev        # 开发模式
pnpm typecheck  # TypeScript 类型检查
pnpm build      # 生产构建
pnpm start      # 启动生产构建
```

## API 路由

- `POST /api/chat`：校验请求并代理到 `{OPENAI_BASE_URL}/chat/completions`，透传 SSE 数据流
- `GET /api/models`：代理模型列表并缓存 10 分钟；失败时返回内置列表
- `POST /api/parse`：解析 PDF、DOCX 和文本/代码文件
- `GET /api/config`：仅返回可公开的 Base URL 与访问密码启用状态
- `/api/auth/*`：处理可选访问密码登录状态

上游错误会映射为中文提示，包括无效 Key、请求过频、余额不足、内容过大和请求超时。

## 数据与隐私

- API Key 只存在于服务端环境变量中。
- 对话和附件默认只保存在当前浏览器的 `IndexedDB`，不会自动同步到其他设备。
- 不同账号的本地会话分开保存；旧版会话只迁移到管理员账号。
- Token 用量汇总保存在配置的 Upstash Redis 中，不保存聊天正文。
- 发送消息时，对话上下文和附件会通过本站服务端转发给配置的 API 服务商。
- 清理浏览器站点数据会删除本地会话，重要会话请提前导出。
