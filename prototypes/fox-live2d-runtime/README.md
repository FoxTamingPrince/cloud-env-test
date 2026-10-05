# 小狐狸官方 Live2D Web 接入准备

本目录是独立 host adapter，尚未接入生产网页，也没有声称已导出可运行的 Live2D 模型。没有运行浏览器、测试套件、部署或安装 SDK。源码中不包含 Core、第三方角色或官方 SDK 源码。

## 当前缺口

在项目、`/Users/zyb/Downloads` 与 `/Users/zyb/Documents/Codex` 的文件名检查中，没有找到 Cubism Web Core 或 Framework。项目有 Cubism `.cmo3` 作者文件，但没有找到 `.moc3`、`.model3.json`、`.physics3.json`。检查是这些目录内的文件名证据，不代表整台机器所有位置。

当前 `fox-voice/app/IllustratedFox.tsx` 显示 `/fox-relief/index.html` iframe。`FoxClient.tsx` 将 `SpeechStream` 的 RMS 音量输出传给 `level`，结束、打断和卸载会把嘴归零。它尚不是 Cubism 渲染。

## 模型文件接口

| 文件 | 用途 / 需要程度 |
| --- | --- |
| `fox.model3.json` | 必须；`Version: 3`，`FileReferences.Moc` 与 `Textures` 相对路径必须正确。 |
| `fox.moc3` | 必须；由 Cubism 导出，包含网格与已绑定的参数变形。`.cmo3` 不能代替它。 |
| `textures/texture_00.png` 等 | 必须；全部纹理图集，数组顺序与导出保持一致。 |
| `fox.physics3.json` | 物理尾巴模式必须；直接尾巴参数模式可省略，但仍需真实绑定尾巴变形。 |
| `.pose3.json` | 可选；model3 引用时会加载。 |
| `.motion3.json` / `.exp3.json` | 本 adapter 暂不加载。后续若采用作者制作的 idle / 表情，需要独立运动管理层。 |
| `.cmo3`、原画 PSD | 保留作者源文件，不作为网页资源加载。 |

这里不创建假的 `model3.json`，应使用实际导出的引用。R5 额外需要官方 `Framework/Shaders/WebGL/` 全目录；Core、Framework、Shader 文件和导出版本应成套匹配。

## 参数契约

必需角色默认是嘴、双眼和尾巴。不存在的参数直接报错；不会利用 SDK 的虚拟参数“假成功”。其他角色缺失列在 `diagnostics.missingRoles`。ID 可以通过 `parameterIds` 覆盖。

| 角色 | 默认 ID | 作者绑定要求 |
| --- | --- | --- |
| 嘴张合 | `ParamMouthOpenY` | 最小值闭嘴、最大值张开；实际口部网格或变形器已绑定。 |
| 双眼 | `ParamEyeLOpen` / `ParamEyeROpen` | 标准 `0=闭合、1=睁开、默认1`；眼皮与眼球不能作为整块缩放替代。 |
| 视线 | `ParamEyeBallX` / `ParamEyeBallY` | 默认位居中；分别绑定眼球在眼眶内的移动。 |
| 头部 | `ParamAngleX/Y/Z` | 默认居中；头、耳、颈部有连续衔接的变形。 |
| 身体与呼吸 | `ParamBodyAngleX` / `ParamBreath` | 细幅运动；保持尾根连接与身体容积。 |
| 尾巴 | `ParamTailSwing` | 默认回到自然尾姿；摆动时尾根固定、尾中和尾尖分级弯曲。 |

检测到参数只证明它存在于 moc3，不能证明变形已绑定、造型自然或接缝正确。还会检查参数范围、纹理尺寸及上传错误、physics3 中输入/输出引用是否真的存在，避免旧物理设置引用 SDK 虚拟参数。`rigVisualsVerified` 与 `shaderLoadVerified` 固定为 `false`，需实际导出后做画面检查。

## 官方 SDK 接线

本适配器只针对官方 **Cubism Web Framework `5-r.5`**（Framework commit `198a3769c26ca3d7b600e932590433badd392edd`，Samples tag `5-r.5`）。没有下载或接受新的 Core 使用协议。需要先依法取得并提供 Core，再装配 SDK。

1. host 先加载已有授权的 `live2dcubismcore.js`；再动态导入 Framework。部分 Framework 模块在模块加载时就使用 Core，不能先 import 后检查。
2. host 对全应用调用一次 `CubismFramework.startUp()`，再 `initialize()`；必须早于创建模型。
3. 从同一个 `Framework/src/` 包导入以下官方命名类，组成 `sdk` 对象：

```js
const sdk = {
  version: "5-r.5",
  CubismFramework,   // src/live2dcubismframework
  CubismMoc,         // src/model/cubismmoc
  CubismModelMatrix, // src/math/cubismmodelmatrix
  CubismMatrix44,    // src/math/cubismmatrix44
  CubismRenderer_WebGL, // src/rendering/cubismrenderer_webgl
  CubismEyeBlink,    // src/effect/cubismeyeblink
  CubismPhysics,     // src/physics/cubismphysics
  CubismPose,        // src/effect/cubismpose
};
const fox = await createFoxLive2DRuntime({
  sdk,
  canvas,
  modelUrl: "/live2d/fox/fox.model3.json",
  shaderPath: "/live2d-sdk/Shaders/WebGL/",
  tailMode: "direct", // 切 physics 前必须实际导出对应物理输出
});
fox.start();
```

SDK 资源如何放入 host 属于后续正式集成。本目录没有添加依赖或修改应用打包。Renderer 的 `loadShaders()` 返回 void，SDK 内部异步读 shader，工厂返回不代表 shader 已完成加载或画面成功渲染。

R5 的 shader fetch 也没有接收本 adapter 的 AbortSignal；共享 shader manager 必须由 host 管理最终清理。不能在 shader 仍加载时把 renderer 释放等同于所有 GPU / SDK 资源已释放。只有整个 host 所有模型都结束后，才可按官方生命周期清理共享 shader manager 与 Framework。

## 更新与停止规则

每帧：恢复模型基准参数 → 头部 / 视线 / 身体输入 → 物理 / Pose → 官方自动眨眼 → 嘴与直接尾巴控制 → `model.update()` → MVP / framebuffer / viewport → `drawModel()`。不把每帧的程序动作保存回基准，避免摆动不断累积。

- `setSpeechState({speaking, level})`：用于现有 React props 或 `fox-mouth` 消息。把 level 作为持续状态，不要求心跳；speaking=false 立即闭嘴。稳定音量在 React 中可能不触发重复渲染，因此这个接口不会因 350 ms 没有 props 更新而错误闭嘴。
- `setSpeechEnergy(level)`：用于直接接入 `SpeechStream` 每个音频采样帧的回调，范围 0..1。使用此接口必须连续转交采样，即使数值相同；超 350 ms 未更新会自动把说话能量衰减到零。不要仅在 React level 变化的 effect 中调用它。
- `setSpeaking(false)`：立即闭嘴，直接尾巴在后续帧缓慢回到中位；仍保留自然眨眼和呼吸。
- `reset()`：闭嘴、恢复睁眼、视线居中、尾巴默认姿势并重置眨眼状态；适用于打断、异常和切会话。
- `pause()`：停止 rAF，默认同时 reset；整个角色停住。`start()` 恢复。后台页面可 pause，前台再 start。
- `resize(width,height,dpr)`：CSS 尺寸，DPR 限制到2，更新 render target。
- `dispose()`：取消 rAF、移除 context 监听、释放 Renderer / 模型 / moc / texture / effects。Framework 与每 GL context 的共享 shader manager 由 host 管理；adapter 不对全应用调用 `dispose()`。
- context 丢失时停止动画并提示 host；恢复后应 dispose / 重建模型。

`tailMode: "physics"` 会检查 physics3 中是否有 `ParamTailSwing` 输出，随后保留官方物理输出。自然收敛取决于作者的物理参数；立即复位使用 `reset()`。`direct` 模式是在真实尾巴变形参数上做小幅摆动，不生成或修补尾巴网格。

后续 React 接口应在 `[speaking, level]` 变化时调用 `setSpeechState({speaking, level})`。IllustratedFox 现有 iframe 消息也是这种状态更新。也可以在音频采样回调中绕过 React state、直接调用 `setSpeechEnergy`，再单独传 speaking 状态。打断先 `SpeechStream.cancel()`，再 `setSpeaking(false)` / `reset()`；卸载必须 `dispose()`。当前生产文件尚未这样修改。

React 初始化应传入该 effect 自有 AbortController 的 signal，卸载时先 abort，再 dispose 已创建的 adapter。若初始化 Promise 在卸载后才完成，必须马上 dispose 返回值，不能保存到已失效组件；这是异步加载时的另一个必要收尾。

`SpeechStream.onSpeaking()` 发生在 PCM 被排入播放队列时（当前最早提前约 80 ms），不能把它当作音频已经响起的精确时刻。嘴实际能量来自播放 analyser；不使用合成数据到达时刻预先张嘴。

这仍是**播放音量驱动的嘴张合**。现有 TTS 没有音素 / 口型时间戳，不能宣称已经实现动画片式多口型。若要多个自然口型，还要制作对应形变并接音素时间轴或经过验证的 MotionSync 分析；本 adapter 不捏造相关数据。

## 官方依据

- [Web 模型与加载顺序](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)
- [Web Framework 初始化](https://docs.live2d.com/en/cubism-sdk-manual/framework-init-close-web/)
- [参数操作](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)
- [自动眨眼](https://docs.live2d.com/en/cubism-sdk-manual/autoeyeblink/)
- [嘴张合](https://docs.live2d.com/en/cubism-sdk-manual/lipsync/)
- [官方 Framework 5-r.5 源码](https://github.com/Live2D/CubismWebFramework/tree/5-r.5)
- [官方 Samples 5-r.5 LAppModel](https://github.com/Live2D/CubismWebSamples/blob/5-r.5/Samples/TypeScript/Demo/src/lappmodel.ts)

官方源代码只用于只读 API 核对；本目录没有复制它们，也没有使用 sample 角色。
