# v5 狐狸 Cubism 制作清单

状态：源码参考已准备，尚未证明这些绑定存在于 Cubism 工程。此清单不会替代实际 .cmo3、.moc3 和网页运行结果。

参考：[v5-binding-reference.json](v5-binding-reference.json)。采样值为1205×1306源画坐标及归一化坐标，需要转换到实际 ArtMesh/变形器坐标。

## 先处理素材与层级

- [ ] 保留原工程副本；核对当前工程是否已经使用 v5 PSD 的尾巴位置，不依据文件名或计划字段判断。
- [ ] 15个部件对应真实 ArtMesh ID。嘴内与舌头保留导出，闭口用透明度0，而非隐藏图层。
- [ ] 共享 BodyWarp 包含头、身体和尾巴；HeadRotation/HeadWarp包含全部面部；尾根与尾尖变形器归于BodyWarp。
- [ ] 处理 head-base 在 x530..638、y522..568 范围的残留白下巴。辅助反转遮罩应贴合独立下颌轮廓，不直接裁整块矩形；遮罩保持显示/导出，透明度0。

## 关键形状

| 参数 | 关键值 | 约束 |
| --- | --- | --- |
| ParamEyeLOpen / ParamEyeROpen | 0、0.5、1 | 0闭眼、1睁眼；眼白与眼皮一起变形，眼角固定 |
| ParamEyeBallX / ParamEyeBallY | -1、0、1 | X最多4px，Y最多3px；标准Y正值向上，源图Y向下 |
| ParamMouthOpenY | 0、0.5、1 | 中央下唇下移0/9/18px；[548,522]与[620,522]嘴角固定 |
| ParamTailSwing（自定义） | -1、0、1 | 尾根[684,914]周围48px固定，向尾尖270px平滑加权，最大0.1rad |
| ParamBreath | 0、0.5、1 | 共用身体父变形器，脚底固定，最大纵向变化0.6% |

- [ ] 两个虹膜分别裁切到对应眼白；舌头裁切到嘴内。遮罩覆盖参数整个范围。
- [ ] 下颌、嘴内和舌头开口形状协同，避免仅拉长下巴。ParamMouthForm需要独立形状，当前采样没有完成笑容/圆唇绑定。
- [ ] 尾根与尾尖不要重复叠加同一整幅旋转；身体呼吸时尾根随父级移动。

## 保存与交付

- [ ] 实际检查并保存闭口、半开、全开；单眼和双眼闭合；尾巴两端极值与中间值。检查切边、双下巴、虹膜溢出及尾根裂缝。
- [ ] 制作纹理图集，导出 fox.moc3、fox.model3.json、fox.physics3.json 和纹理；保存对应可编辑工程。
- [ ] SDK中绑定实际参数ID与音频播放时钟；打断时嘴立即闭合，头和尾巴平滑回落。用实际网页结果核对完整交付。

标准参数与遮罩依据：[官方参数表](https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/)、[裁切遮罩](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/)、[反转遮罩](https://docs.live2d.com/en/cubism-editor-manual/reversed-mask/)。
