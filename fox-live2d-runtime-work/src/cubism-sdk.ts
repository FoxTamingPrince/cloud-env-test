// Official Cubism Web Framework 5-r.5 classes, assembled without SDK sample models.
// Framework source remains under the Live2D Open Software License.
export const version = "5-r.5";
export { CubismFramework, Option, LogLevel } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/live2dcubismframework";
export { CubismMoc } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/model/cubismmoc";
export { CubismEyeBlink } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/effect/cubismeyeblink";
export { CubismPhysics } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/physics/cubismphysics";
export { CubismPose } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/effect/cubismpose";
export { CubismModelMatrix } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/math/cubismmodelmatrix";
export { CubismMatrix44 } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/math/cubismmatrix44";
export { CubismRenderer_WebGL } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/rendering/cubismrenderer_webgl";
export { CubismShaderManager_WebGL } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/rendering/cubismshader_webgl";

import { CubismShaderManager_WebGL } from "../vendor/CubismSdkForWeb-5-r.5/Framework/src/rendering/cubismshader_webgl";

// R5 loadShaders() returns void; readiness is exposed on its per-context shader.
// This host-side helper is pinned to R5 and leaves official source files unchanged.
export async function waitForShaders(gl: WebGL2RenderingContext, { signal, timeoutMs = 15000 }: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<void> {
  const shader = CubismShaderManager_WebGL.getInstance().getShader(gl);
  const deadline = performance.now() + timeoutMs;
  while (!shader._isShaderLoaded) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    if (gl.isContextLost()) throw new Error("WebGL context lost during Cubism shader initialization");
    if (performance.now() > deadline || !shader._isShaderLoading) throw new Error("Cubism R5 shaders did not initialize");
    await new Promise<void>(resolve => setTimeout(resolve, 25));
  }
  // R5 allocates three unused slots for Normal + Over, which uses the base shader.
  // Validate every registered program rather than the unused allocation slots.
  const required = new Set<number>(Array.from({ length: 11 }, (_, index) => index));
  for (const baseIndex of shader._blendShaderSetMap.values()) {
    for (let variant = 0; variant < 3; variant++) required.add(baseIndex + variant);
  }
  const invalid = [...required].flatMap(index => {
    const program = shader._shaderSets[index]?.shaderProgram;
    return !program ? [index + ": missing"] : !gl.getProgramParameter(program, gl.LINK_STATUS) ? [index + ": " + gl.getProgramInfoLog(program)] : [];
  });
  if (invalid.length) throw new Error("Cubism R5 shader compilation or link failed: " + invalid.join(", "));
}
