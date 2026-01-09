你是一个精通 Web3 前端、OAuth 2.0、Safari / iOS WebApp 行为、Privy Auth SDK 的高级工程师。

当前场景：
- 前端部署在 Cloudflare Pages
- 域名：https://kikoapp.pages.dev
- 使用 Privy 作为身份系统
- 使用 Google OAuth 登录
- 运行环境是 Safari / iOS WebApp（添加到主屏幕的 WebApp）
- 登录时报错：
  - Failed to load resource: 401
  - Error: Redirect URL is not allowed

已知配置：
- Privy Dashboard → Allowed origins 已包含：
  - https://kikoapp.pages.dev
  - https://auth.privy.io
- 使用的是 Privy 新版 Dashboard（Google 登录配置页面没有手动填写 Redirect URL 的输入框）
- Google OAuth Client ID / Secret 已正确配置
- 之前尝试过在 Allowed origins 中加入 /auth/callback（可能是错误操作）

请你完成以下任务：
1. 解释 Privy 新版 Google OAuth 的真实 redirect 流程（是否先回 auth.privy.io 再回 origin）
2. 判断 Safari / iOS WebApp 环境下为什么会触发 “Redirect URL is not allowed”
3. 明确指出 Allowed origins 和 redirectUri 的正确使用边界
4. 给出 Safari WebApp 场景下 loginWithOAuth 的唯一正确调用方式
5. 指出哪些配置或代码写法会导致 401（例如 popup、自定义 redirectUri 等）
6. 输出一个最小、稳定、可在 Safari WebApp 中工作的 Privy Google 登录实现方案（代码 + 配置要点）

要求：
- 不要给模糊建议
- 不要假设可以手动配置 Google Redirect URL（以 Privy 新版为准）
- 结论要明确、可直接照做
