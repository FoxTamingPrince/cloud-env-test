# Rive CLI bitmap rig feasibility

Status: research and an isolated downloaded archive. The CLI binary has not been executed by this research task. This does not replace the accepted Live2D deliverable or prove that a fox animation looks natural.

## Official release

- Manifest: https://releases.rive.app/cli/latest/manifest.json
- Version observed: 1.3.0
- macOS Apple Silicon archive: https://releases.rive.app/cli/v1.3.0/rive-macos-arm64.tar.gz
- Archive SHA-256 verified: `8f77b8fa560e20f9d6cfd5d52d4692e64a5c482c47865a59712a0aa3f7f86881`
- Local archive: `official/rive-macos-arm64-1.3.0.tar.gz`
- Official docs and samples are unpacked under `official/docs` and `official/samples`.

The official installer changes `~/.rive`; it was inspected but not run. To keep a prototype isolated, extract the archive's `rive` member into `official` and use its absolute path. Keep `docs` adjacent to the binary so `rive docs` works. Do not add a global PATH entry, log in, push, publish, or accept a new license from this research task.

## Minimum bitmap rig schema

`official/docs/rigging.md` contains a complete raster skin example. This is supported RML, not a hypothesized format:

- A root-level `ImageAsset` supplies the PNG using `file`, `name`, and `id`.
- An `Image` references it with `assetId` and contains a `Mesh`.
- Each mesh vertex carries image-local `x,y` and normalized texture `u,v` coordinates.
- `ContourMeshVertex` vertices precede interior `MeshVertex` vertices.
- `triangleIndexBytes` encodes triangle indices as unsigned varints then base64; three indices make one triangle.
- A `Skin` belongs inside the mesh and contains ordered `Tendon` records.
- A tendon points to a bone with `boneId`; `xx,xy,yx,yy,tx,ty` contain the bone's world transform in the bind pose. Matrix columns are `(xx,xy)` and `(yx,yy)`.
- Each vertex has a `Weight`. `indices` and `values` are packed four-byte integers. A slot index is tendon number plus one; zero means identity. Weight bytes must sum to 255, not 256. A 50/50 blend of tendons 0 and 1 uses `indices=513`, `values=32640`.
- `RootBone` can be placed at `x,y`. Child `Bone` objects begin at their parent's tip, using `length` and rotation in radians.
- Rigging limits include at most four bone influences per vertex.

An ordinary `Image` without a mesh only transforms its rectangle. Skin under the wrong parent can compile yet remain undeformed. Incorrect bind transforms may also compile while visibly collapsing the picture. A successful compile does not prove a good rig.

## Local commands

Use a separate `model/` project directory for actual assets and RML; keep this research directory outside that project.

```sh
rive create model
rive schema Image
rive schema Mesh
rive schema ContourMeshVertex
rive schema Skin
rive schema Tendon
rive schema Weight
rive docs rigging
rive model --once
rive inspect model --json
rive model --screenshot=preview.png
rive model
```

The last command creates a visible live preview with rebuild on save. It does not require operating an editor's UI. For a cloud Linux build the official binary supports x86_64; a visible watch window needs EGL/GLES/X11 libraries. A local browser can display the resulting runtime asset.

## Browser, scripts, and payment

Official references:

- https://rive.app/docs/cli/getting-started
- https://rive.app/docs/runtimes/advanced-topic/rml
- https://rive.app/docs/editor/manipulating-shapes/meshes
- https://rive.app/docs/editor/manipulating-shapes/bones
- https://rive.app/docs/runtimes/web/data-binding
- https://rive.app/docs/account-admin/pricing

`official/docs/publishing.md` confirms that local watching, `--once`, and screenshots work without an account. A `.riv` containing unsigned scripts is rejected by production web runtimes; `--publish` requires login and signs scripts through Rive's service. A file with zero scripts needs no script signature.

A prototype can author bones, meshes, keyframes, and state machines in RML and drive inputs or data binding from the host browser's JavaScript. That keeps audio analysis and speech timing in the existing web app, rather than embedding Luau scripts. This route still needs an actual browser rendering check; it does not prove compatibility merely because the local CLI window displays a file.

### Browser control without embedded scripts

Two official approaches:

1. New files should use a view model and `BlendState1DViewModel`. Put closed/open one-frame mouth poses in separate timelines, keying the same properties in both. Connect a `BindablePropertyNumber` containing `DataBindContext(sourcePathIds=VM-property, propertyKey=636)` to the blend. Give `BlendAnimation1D` children sorted `value` values such as 0 and 100. Then the host sets `r.viewModelInstance.number('mouthOpen').value = 100 * amount`. The artboard must name `viewModelId`, default VM instance, and `defaultStateMachineId`. Binds apply while the machine advances. See official `docs/data.md`, `docs/easing.md`, and `docs/state-machines.md`.
2. The low-level runtime can directly sample independent pose timelines. Official advanced TypeScript typings expose writable `LinearAnimationInstance.time` in seconds, `advance(seconds)`, and `apply(mix)`. For a one-second mouth timeline, set `mouth.time = amount`, call `mouth.advance(0)`, then `mouth.apply(1)`. Apply separate eye and mouth timelines which key disjoint properties; advance and apply idle motion; finally `artboard.advance(deltaSeconds)` and draw. This needs no state-machine graph or embedded Luau to manipulate those timelines.

The high-level `r.scrub()` method is deprecated from v2.41.0; the low-level sampling approach above remains explicitly typed. Match the JS module and its WASM version. Use `@rive-app/webgl2-advanced` for the raster mesh proof. Call `renderer.flush()` after WebGL drawing and dispose instances with `.delete()` when unmounting.

`apply(mix)` mixes with the current property values; it does not mean “multiply the pose displacement by this amount.” To adjust tail amplitude by mixing, reapply a neutral pose before applying the moving pose each frame, or drive a properly defined blend. Otherwise repeated partial mixing can retain unwanted motion. Interrupting speech should zero the sampled mouth amount immediately and let tail/head motion settle.

Sources for the browser signatures:

- https://rive.app/docs/runtimes/web/low-level-api-usage
- https://github.com/rive-app/rive-wasm/blob/master/js/src/rive_advanced.mjs.d.ts
- https://rive.app/docs/runtimes/web/rive-parameters

Official getting-started documentation says a published clean `.riv` requires a bound account file and Cadet or higher. Do not describe all Rive use as free or purchase a subscription on the user's behalf. Exact plan prices have conflicting cached official pages and should be confirmed at purchase time.

## Recommended proof scope

Preserve the original frontal fox art. First demonstrate one coherent tail mesh with an anchored root and progressively weighted bends, one head/body breathing rig, independently controlled eyes, and a small speech jaw mesh. Show the visible motion in the browser. Only after the art and movement are reviewed should this route be considered for the production fox app.
