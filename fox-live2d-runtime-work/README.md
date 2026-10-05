# 狐狸 Live2D 网页运行时

本目录从 Live2D 官方 `CubismSdkForWeb-5-r.5.zip` 提取 Core、Framework 和完整 WebGL shader 文件。Framework 已编译为浏览器 ESM。没有提取或使用官方示例角色。

`public/fox-live2d/models/fox/` 已有原创狐狸的 `.model3.json`、`.moc3`、纹理和参数说明。浏览器已显示模型并读到动态参数；完整口型、尾巴视觉验收和网页集成尚未完成。运行根目录的 `pnpm dev:live2d` 可以查看动作预览。

## 接到 fox-voice

1. 在 Windows Cubism Editor 中完成真实 ArtMesh 绑定和关键形状，并导出 SDK 模型：`.model3.json`、`.moc3`、纹理；若选择物理尾巴，还需 `.physics3.json`。
2. 保留导出文件的相对结构，把原创狐狸整个导出目录放入 `public/fox-live2d/models/fox/`。
3. 将 `public/fox-live2d/fox-model.config.json` 的 `modelUrl` 设为实际 `.model3.json` 文件名；将参数 ID 对应到实际导出的 ID。默认需要 `ParamMouthOpenY`、`ParamEyeLOpen`、`ParamEyeROpen`、`ParamTailSwing`。
4. 将 `public/fox-live2d/` 复制到 fox-voice 的 `public/fox-live2d/`；将 `integration/Live2DFox.tsx` 加入应用，把当前 `IllustratedFox` 的引用替换成 `Live2DFox`。
5. 保持 `SpeechStream` 的 `onMouth` 实时音量输出，以及 `speaking`、`level`、`listening` 三个 props。iframe 使用同源 `fox-mouth` 消息；收到 `ready` 后补发当前状态。打断或停止讲话会立刻闭嘴。

当前 `SpeechStream` 已对实际播放中的 PCM 进行 analyser RMS 测量，输出范围为 0 至 1。接入无需改写语音合成、音频队列或播放器。

眼睛必须采用标准闭眼 0、睁眼 1、默认 1 的范围。默认 `tailMode: "direct"` 由语音活动驱动已绑定的尾巴参数；要让导出物理系统控制尾巴，改为 `"physics"` 并确保 `.physics3.json` 的真实输出包含尾巴参数。

必须使用支持 WebGL2 的浏览器。R5 的 shader 读取为异步，本次宿主桥等待该固定版本的 shader 编译和链接成功才返回运行时。参数存在只能证明导出 ID 存在，不能证明 ArtMesh 已完成绑定或视觉动作正确。

## 再构建

安装固定版本 `esbuild@0.25.12` 后运行 `node build.mjs`。本次构建使用 Codex 随附 Node；没有更改官方 Core 或 Framework 源码。`fox-live2d-runtime.mjs` 是新副本，增加了 R5 shader 就绪等待。

运行时源码在 `src/`、`fox-live2d-runtime.mjs` 和 `public/fox-live2d/viewer.mjs`。官方 SDK 来源保存在 `vendor/CubismSdkForWeb-5-r.5/`，构建后的文件在 `public/fox-live2d/`。

## 来源和许可

- [Live2D 官方 SDK 下载页](https://www.live2d.com/en/sdk/download/web/)
- [本次固定 R5 官方包](https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.5.zip)
- [官方 Framework R5](https://github.com/Live2D/CubismWebFramework/tree/5-r.5)
- [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)
- [Live2D Open Software License Agreement](https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html)
- [SDK Release License](https://www.live2d.com/en/sdk/license/)

SDK 可在同意官方许可后免费下载并开始开发。发布的豁免条件与个人/企业规模、是否为可扩展应用有关；本次未购买许可证。Core 按官方 `RedistributableFiles.txt` 部署 `live2dcubismcore.min.js`、`.d.ts`，保留版权和许可说明。Framework、着色器和 Core 各自保留 Live2D 原有许可。分发时还需使最终用户和分发者接受保护 Core 的同等条款，详情以官方协议为准。
