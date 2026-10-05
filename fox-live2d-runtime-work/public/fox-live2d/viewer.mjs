import * as sdk from "./cubism-sdk.mjs?v=20261005-4";
import { createFoxLive2DRuntime } from "./fox-live2d-runtime.mjs?v=20261005-4";

const canvas = document.getElementById("fox");
const status = document.getElementById("status");
let controller = null;
let runtime = null;
let pendingSpeech = { speaking: false, level: 0, listening: false };
let loading = false;
let disposed = false;
let poseTimer = null;

const sendState = (state, details = {}) => {
  canvas.dataset.state = state;
  if (parent !== window) parent.postMessage({ type: "fox-live2d-state", state, ...details }, location.origin);
};

function disposeFramework() {
  if (sdk.CubismFramework.isInitialized()) sdk.CubismFramework.dispose();
  sdk.CubismFramework.cleanUp();
}

async function load() {
  if (loading || disposed) return;
  loading = true;
  status.hidden = false;
  status.textContent = "小狐狸正在过来…";
  sendState("loading");
  controller = new AbortController();
  const { signal } = controller;
  try {
    if (!globalThis.Live2DCubismCore) throw new Error("Official Cubism Core did not load");
    const response = await fetch("./fox-model.config.json", { signal });
    if (!response.ok) throw new Error(`Fox config HTTP ${response.status}`);
    const config = await response.json();
    const modelUrl = new URL(config.modelUrl, location.href);
    const shaders = new URL(config.shaderPath, location.href);
    if (modelUrl.origin !== location.origin || shaders.origin !== location.origin) throw new Error("Fox assets must share the iframe origin");
    if (!sdk.CubismFramework.isInitialized()) {
      const option = new sdk.Option();
      option.logFunction = message => console.debug(message);
      option.loggingLevel = sdk.LogLevel.LogLevel_Error;
      if (!sdk.CubismFramework.startUp(option)) throw new Error("Cubism Framework startup failed");
      sdk.CubismFramework.initialize();
    }
    const loaded = await createFoxLive2DRuntime({
      sdk, canvas, modelUrl: modelUrl.href, shaderPath: shaders.href, signal,
      parameterIds: config.parameterIds,
      requiredRoles: config.requiredRoles,
      tailMode: config.tailMode,
      onContextLost: message => {
        pendingSpeech = { speaking: false, level: 0 };
        sendState("context-lost", { message });
        status.hidden = false;
        status.textContent = "小狐狸稍后回来。";
      },
    });
    if (disposed || signal.aborted) { loaded.dispose(); return; }
    runtime = loaded;
    runtime.setSpeechState(pendingSpeech);
    runtime.setListening(pendingSpeech.listening);
    runtime.resize();
    if (!document.hidden) runtime.start();
    status.hidden = true;
    sendState("ready", { diagnostics: runtime.diagnostics });
    if (new URLSearchParams(location.search).get("review") === "1") {
      clearInterval(poseTimer);
      poseTimer = setInterval(() => parent.postMessage({type:"fox-live2d-pose", ...runtime.getPose(), visibility:document.visibilityState}, location.origin), 250);
    }
  } catch (error) {
    if (signal.aborted || disposed) return;
    console.error("Fox Live2D initialization failed:", error);
    status.hidden = false;
    status.textContent = "小狐狸暂时还没准备好。";
    sendState("error", { message: String(error?.message || error) });
    runtime?.dispose();
    runtime = null;
    disposeFramework();
  } finally { loading = false; }
}

addEventListener("message", event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== "fox-mouth") return;
  pendingSpeech = {
    speaking: event.data.speaking === true,
    level: Math.max(0, Math.min(1, Number(event.data.level) || 0)),
    listening: event.data.listening === true,
  };
  runtime?.setSpeechState(pendingSpeech);
  runtime?.setListening(pendingSpeech.listening);
});

addEventListener("message", event => {
  if (event.origin === location.origin && event.source === parent && event.data?.type === "fox-gaze") {
    runtime?.setGaze(Number(event.data.x) || 0, Number(event.data.y) || 0);
  }
});
const resizeObserver = new ResizeObserver(() => runtime?.resize());
resizeObserver.observe(canvas);
addEventListener("resize", () => runtime?.resize());
addEventListener("visibilitychange", () => {
  if (document.hidden) { runtime?.pause(); return; }
  runtime?.setSpeechState(pendingSpeech);
  runtime?.setListening(pendingSpeech.listening);
  runtime?.start();
});
canvas.addEventListener("webglcontextrestored", () => {
  controller?.abort();
  runtime?.dispose();
  runtime = null;
  disposeFramework();
  void load();
});
addEventListener("pagehide", () => {
  disposed = true;
  clearInterval(poseTimer);
  controller?.abort();
  resizeObserver.disconnect();
  runtime?.dispose();
  runtime = null;
  disposeFramework();
});
addEventListener("pageshow", event => {
  if (!event.persisted) return;
  disposed = false;
  resizeObserver.observe(canvas);
  void load();
});
void load();
