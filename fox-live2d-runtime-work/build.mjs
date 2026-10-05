import { build } from "esbuild";
import { mkdir, copyFile, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "public", "fox-live2d");
const sdk = path.join(root, "vendor", "CubismSdkForWeb-5-r.5");
await mkdir(path.join(output, "vendor", "Core"), { recursive: true });
await mkdir(path.join(output, "vendor", "Framework"), { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ["src/cubism-sdk.ts"],
  outfile: path.join(output, "cubism-sdk.mjs"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  legalComments: "inline",
  banner: { js: "/* Cubism Web Framework 5-r.5 © Live2D Inc. Live2D Open Software License; see vendor/Framework/LICENSE.md. */" },
});
await copyFile(path.join(root, "fox-live2d-runtime.mjs"), path.join(output, "fox-live2d-runtime.mjs"));
for (const file of ["live2dcubismcore.min.js", "live2dcubismcore.d.ts", "LICENSE.md", "RedistributableFiles.txt"]) {
  await copyFile(path.join(sdk, "Core", file), path.join(output, "vendor", "Core", file));
}
await copyFile(path.join(sdk, "Framework", "LICENSE.md"), path.join(output, "vendor", "Framework", "LICENSE.md"));
await cp(path.join(sdk, "Framework", "Shaders", "WebGL"), path.join(output, "vendor", "Framework", "Shaders", "WebGL"), { recursive: true });
console.log("Built official R5 runtime assets (no fox model or sample characters).");
