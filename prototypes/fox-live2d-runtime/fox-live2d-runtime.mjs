/**
 * Independent host adapter for official Cubism Web Framework 5-r.5.
 * No Core, SDK sources, model, or third-party character is bundled here.
 * The host must load its licensed Core and initialize the official Framework.
 * Presence of a parameter is not evidence that its ArtMeshes have been rigged.
 */
const DEFAULT_IDS = Object.freeze({
  mouthOpen: "ParamMouthOpenY", eyeLeft: "ParamEyeLOpen", eyeRight: "ParamEyeROpen",
  gazeX: "ParamEyeBallX", gazeY: "ParamEyeBallY", headX: "ParamAngleX",
  headY: "ParamAngleY", headZ: "ParamAngleZ", bodyX: "ParamBodyAngleX",
  breath: "ParamBreath", tailSwing: "ParamTailSwing",
});
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : 0));
const approach = (value, target, dt, seconds) => target + (value - target) * Math.exp(-dt / seconds);
const nowSeconds = () => performance.now() / 1000;

async function fetchBuffer(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Live2D asset HTTP ${response.status}: ${url}`);
  return response.arrayBuffer();
}

async function loadTexture(gl, url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Live2D texture HTTP ${response.status}: ${url}`);
  const objectUrl = URL.createObjectURL(await response.blob());
  const image = new Image();
  let texture = null;
  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => { image.onload = null; image.onerror = null; signal?.removeEventListener("abort", abort); };
      const abort = () => { cleanup(); image.src = ""; reject(signal.reason ?? new DOMException("Aborted", "AbortError")); };
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error(`Cannot decode Live2D texture: ${url}`)); };
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener("abort", abort, { once: true });
      image.src = objectUrl;
    });
    if (signal?.aborted) throw signal.reason;
    const textureLimit = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > textureLimit || image.naturalHeight > textureLimit) {
      throw new Error(`Live2D texture dimensions are empty or exceed MAX_TEXTURE_SIZE=${textureLimit}: ${url}`);
    }
    if (gl.isContextLost()) throw new Error("WebGL context was lost while loading a Live2D texture");
    texture = gl.createTexture();
    if (!texture) throw new Error("Cannot allocate Live2D WebGL texture");
    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const previousPremultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
    const previousFlip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      const error = gl.getError();
      if (error !== gl.NO_ERROR) throw new Error(`Live2D texture upload failed with WebGL error ${error}: ${url}`);
    } finally {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, previousPremultiply);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlip);
      gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    }
    return texture;
  } catch (error) {
    if (texture) gl.deleteTexture(texture);
    throw error;
  } finally { URL.revokeObjectURL(objectUrl); }
}

/**
 * sdk: official named classes from Framework tag 5-r.5, plus version="5-r.5".
 * canvas: a dedicated canvas; sharing its GL state with another renderer is unsupported.
 * shaderPath: URL ending in '/', containing the complete R5 Shaders/WebGL tree.
 * tailMode: 'direct' drives ParamTailSwing; 'physics' leaves that output to physics3.
 * requiredRoles can be relaxed explicitly, but missing roles are always reported.
 */
export async function createFoxLive2DRuntime({
  sdk, canvas, modelUrl, shaderPath, signal,
  parameterIds = {}, requiredRoles = ["mouthOpen", "eyeLeft", "eyeRight", "tailSwing"],
  tailMode = "direct", onContextLost = () => {},
}) {
  if (sdk?.version !== "5-r.5") throw new Error("This adapter targets official Cubism Web Framework 5-r.5 only");
  if (!globalThis.Live2DCubismCore) throw new Error("Licensed live2dcubismcore.js must be loaded before the Framework");
  if (!sdk.CubismFramework.isInitialized()) throw new Error("Host must call CubismFramework.startUp() then initialize() once");
  if (!shaderPath?.endsWith("/")) throw new Error("Provide the complete official R5 WebGL shader directory URL ending in '/'");
  if (!["direct", "physics"].includes(tailMode)) throw new Error("tailMode must be direct or physics");
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) throw new Error("Cubism Web R5 adapter requires WebGL2");
  const baseUrl = new URL(modelUrl, document.baseURI);
  const settingBytes = await fetchBuffer(baseUrl, signal);
  const setting = JSON.parse(new TextDecoder().decode(settingBytes));
  const refs = setting.FileReferences;
  if (setting.Version !== 3 || !refs?.Moc || !Array.isArray(refs.Textures) || !refs.Textures.length) {
    throw new Error("model3.json must reference Moc and at least one texture atlas");
  }
  if (typeof refs.Moc !== "string" || !refs.Moc.trim() || refs.Textures.some(path => typeof path !== "string" || !path.trim())) {
    throw new Error("Moc and every texture atlas reference must be nonempty path strings");
  }
  for (const key of ["Physics", "Pose"]) {
    if (refs[key] !== undefined && typeof refs[key] !== "string") throw new Error(`FileReferences.${key} must be a path string`);
  }
  if (tailMode === "physics" && !refs.Physics) throw new Error("Physics tail mode requires an exported physics3.json");
  let moc = null, model = null, renderer = null, physics = null, pose = null, eyeBlink = null;
  let lostListener = null;
  const textures = [];
  const releaseResources = () => {
    if (lostListener) { canvas.removeEventListener("webglcontextlost", lostListener); lostListener = null; }
    if (renderer) { renderer.release(); renderer = null; }
    for (const texture of textures.splice(0)) gl.deleteTexture(texture);
    if (eyeBlink) { sdk.CubismEyeBlink.delete(eyeBlink); eyeBlink = null; }
    if (physics) { sdk.CubismPhysics.delete(physics); physics = null; }
    if (pose) { sdk.CubismPose.delete(pose); pose = null; }
    if (moc && model) { moc.deleteModel(model); model = null; }
    if (moc) { moc.release(); moc = null; }
    // Framework and the per-context shared shader manager belong to the host.
  };
  try {
    const mocBytes = await fetchBuffer(new URL(refs.Moc, baseUrl), signal);
    moc = sdk.CubismMoc.create(mocBytes, true);
    if (!moc) throw new Error("moc3 consistency/version check failed; export with a matching Core version");
    model = moc.createModel();
    if (!model) throw new Error("CubismMoc.createModel() failed");
    const actualParameters = new Map();
    for (let index = 0; index < model.getParameterCount(); index++) {
      const id = model.getParameterId(index);
      const parameter = {
        id, index, minimum: model.getParameterMinimumValue(index),
        maximum: model.getParameterMaximumValue(index), neutral: model.getParameterDefaultValue(index),
      };
      if (![parameter.minimum, parameter.maximum, parameter.neutral].every(Number.isFinite)
        || parameter.minimum > parameter.neutral || parameter.neutral > parameter.maximum) {
        throw new Error(`Invalid moc3 parameter range/default: ${id.getString()}`);
      }
      actualParameters.set(id.getString(), parameter);
    }
    const ids = { ...DEFAULT_IDS, ...parameterIds };
    const bindings = Object.fromEntries(Object.entries(ids).map(([role, id]) => [role, actualParameters.get(id)]));
    const missingRoles = Object.keys(ids).filter(role => !bindings[role]);
    const missingRequired = requiredRoles.filter(role => !bindings[role]);
    if (missingRequired.length) throw new Error(`Exported moc3 has no real parameters for: ${missingRequired.join(", ")}`);
    for (const role of ["eyeLeft", "eyeRight"]) {
      const b = bindings[role];
      if (b && (b.minimum > 0 || b.maximum < 1 || Math.abs(b.neutral - 1) > 0.001)) {
        throw new Error(`${ids[role]} must use the standard closed=0/open=1/default=1 eye range`);
      }
    }
    model.saveParameters(); // Keep one neutral baseline; never accumulate procedural effects into it.
    let physicsJson = null;
    if (refs.Physics) {
      const bytes = await fetchBuffer(new URL(refs.Physics, baseUrl), signal);
      physicsJson = JSON.parse(new TextDecoder().decode(bytes));
      if (physicsJson.Version !== 3 || !Array.isArray(physicsJson.PhysicsSettings)) throw new Error("Invalid physics3.json format");
      const referencedIds = physicsJson.PhysicsSettings.flatMap(rig => [
        ...(rig.Input ?? []).map(input => input.Source?.Id),
        ...(rig.Output ?? []).map(output => output.Destination?.Id),
      ]);
      const missingPhysicsIds = [...new Set(referencedIds.filter(id => !actualParameters.has(id)))];
      if (missingPhysicsIds.length) throw new Error(`physics3.json references missing real moc3 parameters: ${missingPhysicsIds.join(", ")}`);
      physics = sdk.CubismPhysics.create(bytes, bytes.byteLength);
      if (!physics) throw new Error("CubismPhysics.create() failed");
    }
    if (refs.Pose) {
      const bytes = await fetchBuffer(new URL(refs.Pose, baseUrl), signal);
      pose = sdk.CubismPose.create(bytes, bytes.byteLength);
      if (!pose) throw new Error("CubismPose.create() failed");
    }
    if (tailMode === "physics") {
      const tailOutput = physicsJson.PhysicsSettings?.some(rig => rig.Output?.some(output => output.Destination?.Id === ids.tailSwing));
      if (!tailOutput) throw new Error(`physics3.json has no output targeting ${ids.tailSwing}`);
    }
    const createBlink = () => {
      if (eyeBlink) sdk.CubismEyeBlink.delete(eyeBlink);
      eyeBlink = sdk.CubismEyeBlink.create();
      eyeBlink.setParameterIds([bindings.eyeLeft, bindings.eyeRight].filter(Boolean).map(b => b.id));
      eyeBlink.setBlinkingInterval(4.2);
      eyeBlink.setBlinkingSetting(0.09, 0.045, 0.16);
    };
    createBlink();
    const matrix = new sdk.CubismModelMatrix(model.getCanvasWidth(), model.getCanvasHeight());
    matrix.setupFromLayout(new Map(Object.entries(setting.Layout ?? {})));
    renderer = new sdk.CubismRenderer_WebGL(canvas.width, canvas.height);
    renderer.initialize(model);
    renderer.startUp(gl);
    renderer.setIsPremultipliedAlpha(true);
    renderer.loadShaders(shaderPath); // R5 official API is asynchronous internally, returns void.
    for (let index = 0; index < refs.Textures.length; index++) {
      const texture = await loadTexture(gl, new URL(refs.Textures[index], baseUrl), signal);
      textures.push(texture);
      renderer.bindTexture(index, texture);
    }
    if (signal?.aborted) throw signal.reason;
    if (physics) physics.stabilization(model);
    let disposed = false, contextLost = false, raf = 0, lastTime = null, clock = 0;
    let speaking = false, energy = 0, energyAt = -Infinity, energyHeld = false, mouth = 0, tail = 0;
    let gazeX = 0, gazeY = 0, gazeTargetX = 0, gazeTargetY = 0;
    const write = (role, value) => {
      const b = bindings[role];
      if (b) model.setParameterValueById(b.id, clamp(value, b.minimum, b.maximum), 1);
    };
    const unipolar = (role, value) => {
      const b = bindings[role];
      if (b) write(role, b.minimum + clamp(value, 0, 1) * (b.maximum - b.minimum));
    };
    const bipolar = (role, value, strength = 1) => {
      const b = bindings[role];
      if (b) write(role, b.neutral + clamp(value, -1, 1) * strength * (value < 0 ? b.neutral - b.minimum : b.maximum - b.neutral));
    };
    const draw = () => {
      if (disposed || contextLost) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const projection = new sdk.CubismMatrix44();
      // Fit model-space height=2 into both portrait and landscape viewports.
      projection.scale(canvas.width < canvas.height ? 1 : canvas.height / canvas.width,
        canvas.width < canvas.height ? canvas.width / canvas.height : 1);
      projection.multiplyByMatrix(matrix);
      renderer.setMvpMatrix(projection);
      renderer.setRenderState(null, [0, 0, canvas.width, canvas.height]);
      renderer.drawModel(shaderPath);
      gl.flush();
    };
    const render = (deltaSeconds = 0) => {
      if (disposed || contextLost) return;
      const dt = clamp(deltaSeconds, 0, 1 / 30);
      clock += dt;
      const audible = speaking && (energyHeld || nowSeconds() - energyAt < 0.35);
      const target = audible ? energy : 0;
      mouth = approach(mouth, target, dt, target > mouth ? 0.032 : 0.075);
      tail = approach(tail, audible ? 0.15 + energy * 0.1 : 0, dt, 0.28);
      gazeX = approach(gazeX, gazeTargetX, dt, 0.15);
      gazeY = approach(gazeY, gazeTargetY, dt, 0.15);
      model.loadParameters();
      bipolar("gazeX", gazeX, 0.6); bipolar("gazeY", gazeY, 0.5);
      bipolar("headX", gazeX, 0.10); bipolar("headY", gazeY, 0.08);
      bipolar("headZ", Math.sin(clock * 0.65), 0.012);
      bipolar("bodyX", Math.sin(clock * 1.15), audible ? 0.04 : 0.012);
      unipolar("breath", 0.5 + Math.sin(clock * 1.5) * 0.10);
      if (physics && dt > 0) physics.evaluate(model, dt);
      if (pose && dt > 0) pose.updateParameters(model, dt);
      eyeBlink.updateParameters(model, dt);
      // Speech controls apply after physics so interruption cannot be overwritten by it.
      unipolar("mouthOpen", mouth < 0.002 ? 0 : mouth);
      if (tailMode === "direct") bipolar("tailSwing", Math.sin(clock * 2.6) * tail);
      model.update();
      draw();
    };
    const resize = (width = canvas.clientWidth, height = canvas.clientHeight, dpr = globalThis.devicePixelRatio || 1) => {
      if (disposed || contextLost) return;
      canvas.width = Math.max(1, Math.round(Math.max(1, width) * clamp(dpr, 1, 2)));
      canvas.height = Math.max(1, Math.round(Math.max(1, height) * clamp(dpr, 1, 2)));
      renderer.setRenderTargetSize(canvas.width, canvas.height);
      draw();
    };
    const reset = () => {
      if (disposed) return;
      speaking = false; energy = mouth = tail = 0; energyAt = -Infinity; energyHeld = false;
      gazeX = gazeY = gazeTargetX = gazeTargetY = 0; clock = 0; lastTime = null;
      if (contextLost) return;
      model.loadParameters();
      if (physics) physics.stabilization(model);
      for (const [role, b] of Object.entries(bindings)) if (b) write(role, b.neutral);
      unipolar("mouthOpen", 0); write("eyeLeft", 1); write("eyeRight", 1);
      createBlink();
      model.update(); draw();
    };
    const pause = ({ resetPose = true } = {}) => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; lastTime = null;
      if (resetPose) reset();
    };
    const start = () => {
      if (disposed || contextLost || raf) return;
      const tick = timeMs => {
        raf = 0;
        if (disposed || contextLost) return;
        const time = timeMs / 1000;
        render(lastTime === null ? 0 : time - lastTime);
        lastTime = time;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const lost = event => {
      event.preventDefault(); contextLost = true; pause({ resetPose: true });
      onContextLost("WebGL context lost: dispose and recreate this model after context restoration");
    };
    lostListener = lost;
    canvas.addEventListener("webglcontextlost", lostListener);
    resize(); reset();
    const setSpeaking = value => {
      if (disposed) return;
      speaking = Boolean(value);
      if (!speaking) {
        energy = mouth = 0; energyAt = -Infinity; energyHeld = false;
        if (!contextLost) { unipolar("mouthOpen", 0); model.update(); draw(); }
      }
    };
    return {
      diagnostics: Object.freeze({ frameworkTag: "5-r.5", missingRoles, realParameterIds: [...actualParameters.keys()],
        rigVisualsVerified: false, shaderLoadVerified: false, lipSync: "audio-amplitude", tailMode }),
      start, pause, render, resize, reset,
      setSpeaking,
      // Direct audio-meter callbacks arrive every sample frame and support a freshness timeout.
      setSpeechEnergy(value) { if (!disposed) { energy = clamp(value, 0, 1); energyAt = nowSeconds(); energyHeld = false; } },
      // React props and existing fox-mouth messages are state updates, not an audio heartbeat.
      setSpeechState({ speaking: value, level }) {
        if (disposed) return;
        setSpeaking(value);
        if (speaking) { energy = clamp(level, 0, 1); energyAt = nowSeconds(); energyHeld = true; }
      },
      setGaze(x, y) { if (!disposed) { gazeTargetX = clamp(x, -1, 1); gazeTargetY = clamp(y, -1, 1); } },
      dispose() {
        if (disposed) return;
        pause({ resetPose: false }); disposed = true;
        releaseResources();
      },
    };
  } catch (error) { releaseResources(); throw error; }
}
