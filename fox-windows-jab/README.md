# Cubism Windows Java Access Bridge controller

Prepared for Cubism 5.3.04 and its reported 64-bit bundled JRE 17.0.3.1. The public ABI was checked against Oracle JDK 17 documentation and OpenJDK 17.0.3 GA (`jdk-17.0.3+7`) sources. No Windows process was operated or test executed during preparation. The exact vendor build and Cubism's accessibility coverage remain unverified.

## Run on Windows

Copy `JabController.cs`, `jab-server.ps1`, and optionally `launch-cubism-jab.ps1` to one Windows directory. Windows PowerShell 5.1 and .NET Framework compile the C# through `Add-Type`; Python, extra libraries, and global accessibility changes are unnecessary. Use the 64-bit PowerShell at `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`.

Activate JAB **before a fresh Cubism JVM starts**. First preserve/save the model and close the current Cubism normally. The launch helper accepts the official EXE, BAT, or CMD launcher path:

```powershell
.\launch-cubism-jab.ps1 -LauncherPath 'C:\Program Files\Live2D Cubism 5.3\<actual official launcher>.bat'
```

The placeholder must be replaced with the already identified official launcher; the helper does not discover, alter, or terminate a running application. If executing a `.bat`, its reported PID belongs to `cmd.exe`; find the new child Java GUI PID afterward. LauncherArguments is trusted command-line text passed through to the launcher, not JSON, and should normally be omitted.

The helper puts this option only in the launched process's environment, inherited by its children:

```text
-Djavax.accessibility.assistive_technologies=com.sun.java.accessibility.AccessBridge
```

Toolkit's provider is internally named `ProviderImpl` but deliberately advertises the historic complete `com.sun.java.accessibility.AccessBridge` name. The shorter `AccessBridge` value is incorrect. `JAVA_TOOL_OPTIONS` is processed at VM creation, including normal Java and standard JDK 17 jpackage launchers. A launcher that strips the environment, a duplicate JVM property supplied later, or `_JAVA_OPTIONS` supplied later can prevent this setting from taking effect. Runtime `jdk.accessibility` and native bridge DLLs must exist.

`jabswitch -enable` updates the user's `.accessibility.properties`; it is not used here. No `setx`, registry change, Control Panel change, DLL copy into System32, application JAR inspection, OS security change, or execution-policy change is required by these helpers.

Start the controller in the same Windows user session and desktop as Cubism:

```powershell
.\jab-server.ps1
```

If script execution is blocked, use the direct `Add-Type` commands below in an allowed PowerShell session; do not change a machine/user execution policy. The startup JSON reports `ready:true` after the client DLL loads and processes discovery messages. This alone does not prove the target Cubism JVM activated JAB.

Send one JSON object per stdin line. Responses are one JSON object per stdout line. Keep the process alive between requests so the bridge's native window/message pump remains alive. No network port is opened.

```json
{"id":"w1","op":"windows"}
{"id":"w2","op":"windows","pid":12345}
{"id":"t1","op":"tree","hwnd":123456,"pid":12345,"text":true,"maxDepth":16,"maxNodes":1500}
{"id":"n1","op":"node","hwnd":123456,"pid":12345,"path":"0/1/2","text":true}
```

The PID/HWND/path numbers are examples. Read actual values from `windows` and `tree`. Visible top-level windows include Swing dialogs, which can have different HWNDs while sharing the Java PID. `java:true` is a successful `isJavaWindow` response, so it confirms target registration.

Each node returns its zero-based child path, accessible name, English role/state strings, bounds `[x,y,width,height]`, child count, text/selection support, and exact available action names. Root path is the empty string. Text reads are optional and limited to the first 1023 UTF-16 code units; password-role text is skipped. The whole tree can be large: inspect a relevant subtree with `path` and take a fresh snapshot after each layout change.

Mutations require target PID, HWND, fresh child path, and expected name/role. Expected bounds are optional and recommended for unnamed text fields. Bounds changing causes rejection if provided. Empty name is valid. A stale mismatch prevents the requested mutation.

```json
{"id":"s1","op":"setText","hwnd":123456,"pid":12345,"path":"0/1/2","expect":{"name":"","role":"text","rect":[100,200,80,24]},"text":"0.5"}
{"id":"a1","op":"action","hwnd":123456,"pid":12345,"path":"0/2/0","expect":{"name":"OK","role":"push button"},"action":"click"}
{"id":"c1","op":"select","hwnd":123456,"pid":12345,"path":"0/3","expect":{"name":"","role":"list"},"index":2,"clear":false}
{"op":"quit"}
```

`click` is only an example. Use the exact action string returned by that control, which may be localized. `setText` calls `setTextContents` and reports readback plus `matches`; it does not emulate keystrokes. Text must implement editable `AccessibleEditableText`; a field can expose accessible text yet reject writes. Changing text might require an exposed commit/button action before the application's model adopts the value. `action` reports the official API's accepted flag and failure index; inspect the resulting GUI state afterward. `select` uses the container's child index and returns `isAccessibleChildSelectedFromContext`; clear defaults to false. JAB selection support varies for tables/trees/custom renderers.

No `requestFocus`, mouse injection, global hooks, or foreground activation is needed by these operations.

## Direct PowerShell interface

```powershell
Add-Type -Path '.\JabController.cs'
$jab = New-Object -TypeName FoxJab.Controller -ArgumentList 'C:\Program Files\Live2D Cubism 5.3\app\jre\bin\windowsaccessbridge-64.dll'
$jab.Windows(12345) | ConvertTo-Json -Depth 12
$jab.Tree(123456,12345,'',$true,16,1500) | ConvertTo-Json -Depth 12
$jab.SetText(123456,12345,'0/1/2','','text',$null,'0.5') | ConvertTo-Json -Depth 12
$jab.Action(123456,12345,'0/2/0','OK','push button',$null,'click') | ConvertTo-Json -Depth 12
$jab.Close()
```

Replace all examples with freshly observed values. Keep `$jab` alive. PowerShell `$PID` is reserved; use a different variable such as `$cubismPid`.

## Initialization and lifetime

The controller dynamically loads the absolute bundled `windowsaccessbridge-64.dll` path with `LoadLibraryEx`, resolves public exports, then invokes `Windows_run` on a dedicated STA worker. This reproduces the relevant part of OpenJDK's `initializeAccessBridge` wrapper; `initializeAccessBridge` and `shutdownAccessBridge` themselves are source-wrapper functions in `AccessBridgeCalls.c`, not exports of the DLL. Export names are case sensitive and often begin lowercase, unlike the documented wrapper names.

`Windows_run` creates the bridge's native status window. The creating thread continuously executes `PeekMessage` → `TranslateMessage` → `DispatchMessage`, including while the main thread waits for stdin. The native bridge uses broadcast registration, Windows messages and shared-memory IPC. All DLL calls are serialized on the same worker thread. A short discovery interval precedes the ready response; later JVM launches are registered as messages arrive.

Every root/child AccessibleContext reference obtained during traversal or operations is released with `releaseJavaObject`, including error paths. Paths, names and bounds are returned to clients; raw Java references never escape a request. `Close` releases the client DLL on its owning worker after operations finish, analogous to `shutdownAccessBridge`'s `FreeLibrary`. Callbacks are not registered.

Native bridge calls are synchronous and can stall on an unresponsive JVM or action. The helper stops accepting work after a 20-second request timeout. A timed-out mutation has **unknown outcome** and may still finish; inspect the GUI with a fresh controller before deciding whether to repeat it. Ending this controller does not terminate Cubism.

## Scope and limitations

- This addresses Swing text, buttons, menus and accessible selection. Cubism's OpenGL drawing canvas, ArtMesh geometry and custom controls may not expose useful Java accessibility objects. A successful bridge does not create a mesh-editing/model-binding API.
- Standard JAB exports include text setters and actions but no general-purpose setter for numeric AccessibleValue. Numeric fields must expose editable text or increment/decrement actions.
- Snapshot paths can change after a dialog opens, a tree expands or controls reorder. An expected empty name plus common role is not a unique identifier; use bounds, inspect surrounding nodes, and operate promptly.
- Process launch alone does not retrofit a currently running JVM. Loading the client DLL alone does not activate JAB inside Cubism.
- Session/desktop or integrity-level differences can block discovery/IPC. Run client and Cubism normally in the same session; no security settings should be altered to force communication.
- Tree enumeration and control support depend on the application's Accessible implementation. A partial or empty tree is evidence to investigate, not permission to guess coordinates or private APIs.

## Primary sources

- [Oracle JDK 17 JAB API](https://docs.oracle.com/en/java/javase/17/access/java-access-bridge-api.html): API semantics, object reference release, text limits and action failure index.
- [OpenJDK 17.0.3 AccessBridgeCalls.c](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/bridge/AccessBridgeCalls.c): exact DLL export spellings, initialization and shutdown.
- [OpenJDK 17.0.3 AccessBridgeCalls.h](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/include/bridge/AccessBridgeCalls.h): public routine prototypes and C function-pointer calling convention.
- [OpenJDK 17.0.3 AccessBridgePackages.h](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/include/bridge/AccessBridgePackages.h): authoritative layouts and array sizes. The Oracle prose example omits some fields; implementation follows the header.
- [OpenJDK WinAccessBridge.cpp](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/libwindowsaccessbridge/WinAccessBridge.cpp): bridge window, message dispatch, registration and synchronous IPC.
- [Oracle JDK 17 Toolkit](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/java/awt/Toolkit.html#getDefaultToolkit()): system-property precedence and Toolkit initialization.
- [OpenJDK 17 provider](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/classes/com/sun/java/accessibility/internal/ProviderImpl.java): complete provider name.
- [Oracle JDK 17 JVM tool options](https://docs.oracle.com/en/java/javase/17/docs/specs/jvmti.html#tooloptions) and [OpenJDK HotSpot arguments](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/hotspot/share/runtime/arguments.cpp): per-child environment and option order.
- [Oracle jabswitch](https://docs.oracle.com/en/java/javase/17/docs/specs/man/jabswitch.html): user accessibility file updates, which are avoided by the per-process launch.
