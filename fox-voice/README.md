# 小狐狸语音聊天

使用用户自己的狐狸大模型平台，默认模型 bailian1-qwen-flash。浏览器中文听写 → 平台生成回答 → 系统语音朗读。提供开始、结束、静音、文字输入和重新朗读。半双工：狐狸朗读时暂停听写，避免回声。

## 配置

通过 Sites secrets 配置 FOX_API_KEY；FOX_API_BASE 为用户的平台 /v1 地址；FOX_MODEL 为模型 ID。开发时读取被 Git 忽略的 .dev.vars。密钥仅保留在服务端，不写入网页、源码或公开仓库。

运行：pnpm run dev -- --host 127.0.0.1 --port 5187。生产：pnpm run build。

## 验证与边界

- 平台模型清单读取成功。
- bailian1-qwen-flash 真实问候请求返回回答。
- TypeScript 与生产构建检查。
- qwen3-tts-flash 已在平台列出，但 /v1/audio/speech 返回 convert_request_failed / not implemented；百炼原生路由返回 404。因此当前发声使用系统朗读，未声称百炼 TTS 接通。
- 实际麦克风听写需要用户在浏览器授权；端到端麦克风通话尚未验证。
- 浏览器听写可能由浏览器服务商联网处理，模型文本发往用户的平台。页面不存储录音、密钥和聊天历史，字幕仅保留在当前内存。
- 私有站点与后端身份校验必须保留，避免其他人使用模型额度。
