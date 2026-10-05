# fox-bot · 小狐狸

网页、语音、原创 Live2D 角色与制作工具的统一工程。

## 目录

| 目录 | 内容 |
| --- | --- |
| `fox-voice/` | 小狐狸网页、文字聊天、实时语音识别、流式语音播放 |
| `fox-live2d-runtime-work/` | Live2D SDK、运行时、原创导出模型与动作预览 |
| `voice-bridge/` | Python ASR / TTS 转发服务 |
| `fox-windows-control/` | Cubism 远程操作与模型绑定脚本 |
| `fox-windows-jab/` | Windows Java Access Bridge / Swing 控制工具源码 |
| `fox-cloud-deploy/` | 云服务器操作工具；服务器迁移尚未完成 |
| `models/` | 当前原创 Cubism 可编辑模型检查点 |
| `prototypes/` | 早期 2D、3D、Rive 原型与拆层工具源码 |
| `character-tools/` | 早期角色动画制作脚本 |

## 本地启动

需要 Node.js >= 22.13、pnpm 10.32.1。

```sh
pnpm run setup
cp fox-voice/.dev.vars.example fox-voice/.dev.vars
# 在本地 .dev.vars 中填写服务地址和密钥，不要提交这个文件。
pnpm dev
```

- 网页：<http://127.0.0.1:5194/>
- 狐狸动作预览：<http://127.0.0.1:5195/review.html>
- macOS 可直接双击 `start-local.command`。
- 编辑器可打开 `fox-bot.code-workspace`，通过任务菜单启动或构建。
- 只启动网页：`pnpm dev:voice`；只启动模型预览：`pnpm dev:live2d`。
- 端口冲突时设置 `FOX_WEB_PORT`、`FOX_MODEL_PORT`。

`pnpm run setup` 分别使用两个子工程的锁文件安装依赖；根目录不重复维护依赖。
网页继续使用 Sites / Vinext 的本地预览登录模拟。正式云服务器部署需要单独适配登录与 WebSocket，不能把开发服务直接作为正式公开服务。

## 构建

```sh
pnpm build:voice
pnpm build:live2d
```

Live2D 已包含原创 `fox.moc3`、`fox.model3.json` 和纹理。动作预览与网页接入是两个独立步骤；网页当前仍保留原先角色实现，Live2D 接入和口型视觉验收尚未完成。

## 安全与资料

密钥、`.env*`、`.dev.vars*`、`node_modules`、缓存、安装包、下载的大模型权重和个人操作日志不提交。当前电脑的实际 `.dev.vars` 只保存在本地。

原型只保留源码和必要配置；历史截图、部分中间生成素材和大体积实验权重不包含在仓库中。远程控制脚本中部分路径和 SSH 别名与原作者环境有关，需要在其他电脑配置后使用。

Live2D、Three.js、Rive 等第三方源码保留原许可和版权；遵守各自的分发及运行许可。项目记录与说明不表示已经完成云部署。
