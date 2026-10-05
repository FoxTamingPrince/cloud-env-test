# Scoped public Swing agent for Cubism's running JVM

Prepared source only. No compilation, agent loading, deployment, or tests were performed by this preparation task. Local macOS `java_home -V` reported no installed Java Runtime; the standard Homebrew JDK locations were absent. Company-host JDKs were not probed. A supplied full Windows x64 JDK 17 can compile and run the attach launcher; it does not need to replace Cubism's bundled runtime.

## Files and approach

- `src/fox/agent/FoxSwingAgent.java`: standalone agent and dependency-free JSON/file IPC. No class transformer, class redefinition, reflection, JNI, application-private API, socket, or global accessibility setting.
- `FoxAttach.java`: external public `VirtualMachine.attach/loadAgent/detach` launcher, guarded by expected PID, process start time, executable path, and target `java.home`.
- `build-agent.ps1`: Java 17 compilation, manifest, and JAR packaging only. It recreates this directory's generated `build/agent` and `build/launcher` output directories.

Every GUI operation uses `EventQueue.invokeLater`. The poller never waits for the operation or a modal window. A modal dialog's normal nested EDT loop can process subsequent queued requests, unlike a JAB native bridge thread waiting synchronously for its action. If the EDT is actually hung, rather than inside a modal event loop, this agent cannot force it to make progress. This implementation assumes Cubism's normal UI lives in the default AWT AppContext; it does not use private AppContext routing APIs.

## Build using an explicitly supplied JDK

PowerShell, in this directory:

```powershell
$jdk = 'C:\absolute\private\jdk-17'
.\build-agent.ps1 -JavaHome $jdk
```

Equivalent direct commands (compiler/packager, not tests):

```powershell
& "$jdk\bin\javac.exe" --release 17 -encoding UTF-8 -d build\agent src\fox\agent\FoxSwingAgent.java
& "$jdk\bin\javac.exe" --release 17 --add-modules jdk.attach -encoding UTF-8 -d build\launcher FoxAttach.java
& "$jdk\bin\jar.exe" --create --file fox-swing-agent.jar --manifest build\agent-manifest.mf -C build\agent .
```

The build script creates this manifest, including its final blank line:

```text
Manifest-Version: 1.0
Agent-Class: fox.agent.FoxSwingAgent
Can-Redefine-Classes: false
Can-Retransform-Classes: false
Can-Set-Native-Method-Prefix: false

```

## Attach configuration and bootstrap

Create an absolute UTF-8 JSON config file on Windows. Example values below must be replaced with fresh target facts:

```json
{
  "pid": 40676,
  "expectedJavaHome": "C:\\Program Files\\Live2D Cubism 5.3\\app\\jre",
  "controlDirectory": "C:\\Users\\ACTUAL_USER\\.fox-live2d\\swing-control"
}
```

The directory must be a dedicated child of this target JVM user's `user.home\.fox-live2d`, not another user's directory. The IPC protocol uses `request.json`, `result.json`, `ready.json`, `agent.lock`, and durable `receipts/<UUID>.json`. Outputs use forced writes followed by atomic file moves; unsupported atomic moves are treated as errors. Do not share this directory with the JAB worker.

Example bootstrap, using real absolute paths and the exact process executable (`java.exe` or `javaw.exe`) reported for this target PID:

```powershell
& "$jdk\bin\java.exe" --add-modules jdk.attach -cp .\build\launcher FoxAttach `
    '40676' `
    'C:\Program Files\Live2D Cubism 5.3\app\jre' `
    'C:\Program Files\Live2D Cubism 5.3\app\jre\bin\java.exe' `
    'C:\Users\ACTUAL_USER\.fox-live2d\swing-agent\fox-swing-agent.jar' `
    'C:\Users\ACTUAL_USER\.fox-live2d\swing-agent\agent-config.json'
```

Prefer the same user, login session, bitness, and elevation level as Cubism. No OS security setting or global accessibility preference is changed. A normally returned loadAgent means agentmain returned after starting the server; confirm `ready.json.active=true`, its PID, and its fresh `runId`. `detach` closes the attach connection, not the agent.

## Requests and completion

All requests require a fresh UUID `id`, numeric target `pid`, and `runId` copied from ready.json. The client must atomically write request.json and wait until an acknowledgement/receipt with that UUID appears before replacing the request slot. Merely seeing `ok=true,status=queued` is not operation completion. Never automatically replay a timed-out or unknown mutation.

Each UUID is durably claimed with CREATE_NEW plus force(true) before any GUI submission. Reusing it never resubmits the action; a changed payload is rejected. A prior agent's unfinished claim has unknown outcome. At-most-once execution is provided, not a transactional guarantee that a UI operation survived a process crash. Task timeout defaults to 15 seconds and accepts 1–60 seconds. Queued tasks can be canceled before they start; executing UI calls cannot be preempted and may complete later. Their final receipts are updated without overwriting result.json for a newer request.

Operations:

| op | Required extra fields | Behavior |
| --- | --- | --- |
| `windows` | none | displayable public AWT windows, IDs, titles, bounds, visibility and modal state |
| `tree` | windowId, exact windowTitle, path | bounded Component tree; defaults maxDepth24/maxNodes1500, maximum64/5000 |
| `asyncAction` | windowId/title/path, expect, exact action name | actual exposed AccessibleAction, called once on EDT; background IPC remains free |
| `setText` | windowId/title/path, expect, text | non-password AccessibleEditableText, 0–4096 UTF-16 code units; no NUL |
| `setValue` | windowId/title/path, expect, numeric value, numeric expectCurrent | public AccessibleValue setter; fresh min/max bounds, preserved numeric type, and readback |
| `click` | windowId/title/path, expect; optional clickCount1 or2, x/y | direct public MouseEvent pressed/released/clicked dispatch; local center by default, single click by default |
| `status` | targetId | reads another UUID's durable receipt without waiting on EDT |
| `quit` | none | stops poller, cancels unstarted tasks; reports any running UI calls |

`expect` must contain fresh `nodeId`, `name`, English `role`, and parent-local `bounds=[x,y,width,height]` from the agent tree. Empty name is allowed. Optional `windowBounds` adds a window position/size guard. PID/runId, live window ID/title, component path, Java object ID, name, role, bounds and enabled state are checked inside the EDT operation immediately before mutation.

The component path differs from JAB's accessible-child indexes: `c0/c1/...` means public `Container.getComponents()` children, and `m0/m1/...` means public `JMenu.getMenuComponents()` items. Root path is the empty string. Component/node IDs are private to this agent run, not native HWNDs. Virtual accessible children such as list renderers that are not actual Components are deliberately not invented as clickable targets.

Tree records include public mouse, mouse-motion, mouse-wheel and key listener counts. Zero counts do not prove that a custom component cannot handle an event: it may override public event processing. Listener implementations/classes are not inspected.

setValue requires a non-null public AccessibleValue, numeric current/min/max, and exact numeric expectCurrent from the fresh agent snapshot. It rejects values outside the current range, fractional values for integer controls, precision loss, nonfinite values, and unknown Number subtypes. It preserves standard Integer/Long/Short/Byte/Float/Double/BigDecimal/BigInteger types. The setter's boolean and the numerical readback are reported separately. A control can clamp or refuse; accepted alone is not a business-result proof. Use the raw model units in the tree, not a guessed displayed-unit conversion. Public Java exposes this setter even though the JAB native C API does not.

Additional primary source: [AccessibleValue.setCurrentAccessibleValue](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/javax/accessibility/AccessibleValue.html#setCurrentAccessibleValue(java.lang.Number)).

Example initial inventory request:

```json
{"id":"NEW_UUID","pid":40676,"runId":"FROM_READY","op":"windows"}
```

Example tree request, using an actual inventory entry:

```json
{"id":"NEW_UUID","pid":40676,"runId":"FROM_READY","op":"tree","windowId":"w1","windowTitle":"EXACT_TITLE","path":"","maxDepth":24,"maxNodes":1500}
```

Example double-click request for an actual numeric label entry:

```json
{
  "id":"NEW_UUID","pid":40676,"runId":"FROM_READY","op":"click",
  "windowId":"w2","windowTitle":"EXACT_TITLE","path":"c0/c1/c2",
  "expect":{"nodeId":"n42","name":"6.2","role":"label","bounds":[10,20,70,24]},
  "clickCount":2
}
```

These are field examples, not valid live requests until every placeholder and guard is replaced. After dispatch, re-read the tree and require an actual editable text component before setting a numeric value. `dispatched=true` is not proof of entering edit mode. Accessible setters may change field text without committing a business value; use an actual exposed confirmation action or the application's verified commit behavior, then re-read the value/state.

For an action that opens a modal, issue asyncAction once, accept its queued acknowledgement, then issue a new windows/tree request to inspect the modal. Its original callback can remain executing until the modal closes. Use a distinct guarded confirmation action on the modal; afterwards read the original UUID receipt. If it is unknown, inspect actual state before deciding any new action. Do not automatically retry the original trigger.

## Feasibility, security, and limits

Public Attach is supported in standard Windows HotSpot17. The attach-side runtime needs jdk.attach and its native provider; a full x64 JDK17 is the simple choice. The target need not have jdk.attach or javac, but Java agent loading requires its java.instrument module and instrument.dll. The existing bundled instrument.dll alone does not establish the module or VM flags. HotSpot17 defaults DisableAttachMechanism=false and EnableDynamicAgentLoading=true; a target launched with the opposite disabling flags rejects attachment/loading. This exact Cubism17.0.3.1 vendor build has not been verified against its corresponding sources here.

The Windows provider opens the process with PROCESS_ALL_ACCESS, checks equal bitness, and uses native attach machinery including CreateRemoteThread; it can try enabling a process privilege if necessary. This is trusted code loading into the authorized process, not a low-privilege remote UI protocol. Run as the current target user; do not elevate, change ACLs/security settings, or bypass a rejected attach. The JAR runs with the application and must be reviewed/trusted. This helper adds no global hooks, networking, transformer or private reflection.

The daemon poller wakes every100 ms; UI snapshots are bounded by node/depth limits but do run on EDT. No disk writes are performed by the live GUI operation path. Dense trees and expensive application accessibility methods can still delay rendering. Normal Swing modal loops can service later invokeLater calls; application locks, custom native modals, a hung EDT, multiple AppContexts, or component logic that requires native state can still block progress.

Direct dispatch constructs MouseEvent coordinates relative to the selected Component, so it bypasses native Win32 GetMessagePos and does not move the real cursor or request foreground activation. It does not guarantee that every Cubism listener accepts the synthetic event or creates an editor. Single-click versus double-click behavior, focus checks, mouse capture assumptions, and actual editing must be checked through public snapshots/readbacks.

The agent stops after20 minutes without a new request. quit/idle cannot unwind a running modal callback; a pending UI callback may still return later and update its UUID receipt. Reattachment is refused while an old callback remains running. Once stopped and no calls are running, the same loaded agent can be started again, but public Attach/Instrumentation has no unload-agent operation. The loaded JAR/classes remain until this Cubism JVM exits. No automatic application restart is performed.

Primary sources: [VirtualMachine public Attach API](https://docs.oracle.com/en/java/javase/17/docs/api/jdk.attach/com/sun/tools/attach/VirtualMachine.html), [Java agent manifest and loading](https://docs.oracle.com/en/java/javase/17/docs/api/java.instrument/java/lang/instrument/package-summary.html), [EventQueue.invokeLater](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/java/awt/EventQueue.html#invokeLater(java.lang.Runnable)), [Dialog modal secondary event pump](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/java/awt/Dialog.html#setVisible(boolean)), [Component.dispatchEvent](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/java/awt/Component.html#dispatchEvent(java.awt.AWTEvent)), [AccessibleAction](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/javax/accessibility/AccessibleAction.html), [HotSpot loading java.instrument](https://github.com/openjdk/jdk17u/blob/master/src/hotspot/share/services/attachListener.cpp#L102), [HotSpot17 flags](https://github.com/openjdk/jdk17u/blob/master/src/hotspot/share/runtime/globals.hpp#L1840), [Windows attach provider implementation](https://github.com/openjdk/jdk17u/blob/master/src/jdk.attach/windows/native/libattach/VirtualMachineImpl.c#L161).
