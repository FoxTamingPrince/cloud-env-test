# Prepared value, repeated-action, and focus support

Prepared locally only. No Windows deployment, restart, compilation, execution, or tests were performed for these additions.

## Integration files

- `JabController.ValueActions.cs`: full alternative to the existing `JabController.cs`. It retains the original public types and methods and adds the methods below. Compile one controller source, never both in one PowerShell process. Existing `FoxJab.Controller` loaded by Add-Type cannot be replaced in that process.
- `jab-file-worker-value-actions.ps1`: full alternative file worker, still using the private `.fox-live2d/jab-control` directory and the existing UUID receipts, atomic results, mutex, and 20-minute idle exit. It loads `%USERPROFILE%\.fox-live2d\jab\JabController.ValueActions.cs`.

The original controller, worker, and mouse helper were preserved.

## New operations

All node operations use fresh HWND/PID/path resolution. `expect.name`, `expect.role`, and optional `expect.rect` come from a fresh snapshot. Numeric value reads also require that identity guard, but can read a disabled control.

| op | Extra request fields | Result |
| --- | --- | --- |
| `value` | `expect` | `supported`, raw UTF-16 strings `current`, `minimum`, `maximum`; no unit conversion |
| `actionRepeat` | exact `action`, integer `count`; optional `expectCurrent`, `stopOnUnchanged`, `maxDurationMs`, `delayMs` | requested/attempted/accepted/changed counts, before/after values, each observed current value, stop reason, native failure index, actual error details |
| `focused` | HWND/PID only | currently focused Java object's record; its root-relative path is unknown and returned as null |
| `requestFocus` | `expect`; optional `settleMs` | immediate API result `accepted`, independent focus readback `confirmed`, focused-object record |

`actionRepeat` accepts count 1–256, duration 1–15000 ms (worker default 12000), delay 0–100 ms (default 0). The existing outer controller timeout is 20 seconds. The duration is checked between native calls; a synchronous native call cannot be preempted. After an outer timeout, the controller is poisoned and the loop attempts no later actions when that native call returns. The outcome of the in-progress call remains unknown.

For a slider, use `stopOnUnchanged=true` (default): a readable AccessibleValue is required before any mutation, and unchanged value stops further actions, even if the action reports TRUE at the model boundary. Use `expectCurrent` from `value` to reject a stale starting value. Each iteration re-resolves the node, checks original Java object identity with `isSameObject`, verifies name/role/rectangle/enabled state, and verifies the exact action still appears. External value changes stop further actions. A partial result is never automatically retried. `completed` only means all requested actions were accepted and no error was observed; it does not prove a particular business value or saved model.

For other controls, `stopOnUnchanged=false` permits actions without AccessibleValue. It does not imply those actions are safe to repeat: choose the exact exposed action and a deliberate count. Avoid batching actions that open a modal dialog.

### Example request fields

Merge these fields with a newly generated UUID, the target HWND/PID/path, and the latest `expect` guard. This is a request-field example, not a remote mutation performed here:

```json
{
  "op": "actionRepeat",
  "action": "decrement",
  "count": 60,
  "expectCurrent": "620",
  "stopOnUnchanged": true,
  "maxDurationMs": 12000,
  "delayMs": 0
}
```

`620` is illustrative. Use the actual raw value returned by `value`; a Cubism display such as `6.2` may use a different internal slider scale. No scale relationship is assumed by this helper.

```json
{"op":"requestFocus","settleMs":250}
```

This also needs HWND/PID/path and fresh `expect`. It changes the component's Java focus request, and does not create an editor by itself. `confirmed` requires the focused query to return the same Java object, a focused state there, and a fresh target record still carrying focused state. It can become true after the immediate requestFocus return was false. It proves Java focus at readback time; it does not prove Windows foreground focus on the active input desktop.

## Public native ABI

These are actual DLL exports, with lower-case initial names. Oracle's capitalized C wrapper names are not the export names.

```c
BOOL getCurrentAccessibleValueFromContext(long vmID, AccessibleValue av,
                                        wchar_t *value, short len);
BOOL getMinimumAccessibleValueFromContext(long vmID, AccessibleValue av,
                                        wchar_t *value, short len);
BOOL getMaximumAccessibleValueFromContext(long vmID, AccessibleValue av,
                                        wchar_t *value, short len);
BOOL isSameObject(long vmID, JOBJECT64 first, JOBJECT64 second);
BOOL requestFocus(const long vmID, const AccessibleContext ac);
BOOL getAccessibleContextWithFocus(HWND hwnd, long *vmID, AccessibleContext *ac);
BOOL doAccessibleActions(long vmID, AccessibleContext ac,
                         AccessibleActionsToDo *actionsToDo, jint *failure);
```

On Windows x64: Cdecl; long/BOOL/jint are 32 bits, JOBJECT64 is 64 bits, HWND is pointer-sized, short is signed 16 bits, wchar_t is UTF-16. AccessibleValue uses the same AccessibleContext object reference. The three native value packets contain `wchar_t rValue[SHORT_STRING_SIZE]`, where SHORT_STRING_SIZE=256. The helper allocates 512 bytes and passes len=256. Passing 1024 is unsafe in OpenJDK17's `wcsncpy(value,pkg->rValue,len)` implementation. `accessibleInterfaces & 1` is the header's `cAccessibleValueInterface`; this is checked before querying values. FALSE produces null, and no NUL within the field is reported as an actual error. The native source itself cautions that TRUE is a successful exchange and is not a full validation of the returned number. No setter for AccessibleValue is exported.

The repeat helper uses a caller-owned 16388-byte actions buffer, count=1, then one UTF-16 action name at byte offset 4 in the 512-byte name slot. It reuses the buffer while making separate native calls. `failure` is initialized to -1 using a ref parameter, so a transport return that does not write the index cannot accidentally look like known action failure 0. All native buffers and returned Java-object references are released in finally blocks. All operations use the original controller thread and message pump.

The standard JSlider accessible actions increment/decrement its integer model by one, which may differ from the displayed unit. TRUE at a boundary can leave the value unchanged. Cubism may use a custom control; only its actual names and readbacks determine behavior.

Primary sources: [Oracle JAB 17 API](https://docs.oracle.com/en/java/javase/17/access/java-access-bridge-api.html), [OpenJDK 17.0.3 ABI header](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/include/bridge/AccessBridgeCalls.h), [packet layouts and interface flag](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/include/bridge/AccessBridgePackages.h), [actual DLL exports](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/libwindowsaccessbridge/WinAccessBridge.DEF), [native value copy](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/libwindowsaccessbridge/WinAccessBridge.cpp), [JSlider 17.0.3 implementation](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/java.desktop/share/classes/javax/swing/JSlider.java).

## Custom Inspector numeric labels under lock

JAB has no public generic click, double-click, start-edit, or value setter. `doAccessibleActions` needs a component's exposed actions; `setTextContents` needs AccessibleEditableText. `requestFocus` requests focus only. A `focusable` label with no action or editable text does not acquire those other capabilities.

The existing directed mouse helper only proves messages were queued. OpenJDK Windows AWT routes client WM_LBUTTONDOWN/UP/DBLCLK using `GetMessagePos` followed by ScreenToClient, rather than the sender's lParam coordinates. AWT then calculates click count from its own state; Swing lightweight components are selected again by event coordinates. Thus the helper's lParam does not establish which Swing label receives a double click. Under lock, SetCursorPos's input-desktop requirement also prevents treating physical cursor placement as an available workaround. PostMessage may still be processed on the application's desktop, but it is not a guarantee of editing, activation, capture, or focus.

WM_KEYDOWN avoids that mouse-coordinate issue, but AWT sends KEY_PRESSED to the Java focus owner (or its focused window). Missing focus or a non-showing/ineligible focus owner can drop the event. WM_CHAR is KEY_TYPED and does not substitute for an Enter/F2 KEY_PRESSED binding. Public Cubism documentation does not specify Enter/F2 as numeric Inspector start-edit shortcuts: F2 is absent, and Enter is listed for animation playback. Therefore focus-plus-key is a conditional experiment, not a proven public edit protocol. A fresh actual editable text child or an adjacent exposed button action is the stronger semantic route.

Primary sources: [OpenJDK17u native mouse routing](https://github.com/openjdk/jdk17u/blob/master/src/java.desktop/windows/native/libawt/windows/awt_Component.cpp#L1553), [native keyboard route](https://github.com/openjdk/jdk17u/blob/master/src/java.desktop/windows/native/libawt/windows/awt_Component.cpp#L3459), [native focus routing](https://github.com/openjdk/jdk17u/blob/master/src/java.desktop/windows/native/libawt/windows/awt_Component.cpp#L4731), [Java focus dispatch](https://github.com/openjdk/jdk17u/blob/master/src/java.desktop/share/classes/java/awt/DefaultKeyboardFocusManager.java), [GetMessagePos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getmessagepos), [PostMessage](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postmessagew), [SetCursorPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setcursorpos), [Cubism Inspector](https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/), [Cubism shortcuts](https://docs.live2d.com/en/cubism-editor-manual/shortcut/).

The jdk17u master links describe current public Java17 source rather than asserting they are byte-identical to Cubism's exact vendor build. Cubism's bundled 17.0.3.1 vendor identity and backports are not established here.

## Actions that synchronously open modal dialogs

A second independent OS process does not add a second target JVM bridge request thread. Public OpenJDK17 code has one Java bridge hidden window, whose thread handles AB_MESSAGE_WAITING and calls the Java action through JNI. Java's InvocationUtils.invokeAndWait posts to the EDT then waits on a lock; it does not pump that bridge thread's Win32 messages while waiting. If an action only returns after its modal dialog closes, the target bridge request thread remains blocked. Both workers still send reads/actions to that same target bridge HWND. The EDT's nested modal event loop can remain active while JAB reads are blocked. A new worker's discovery can be blocked as well. Separate-process workers are not a reliable modal-dialog recovery mechanism.

The client sends through SendMessageTimeout with SMTO_BLOCK | SMTO_NOTIMEOUTIFNOTHUNG and 4000 ms; this does not guarantee a four-second return. The target marks the shared-memory request as received before the action is processed. That arrival flag, or a native BOOL after a timeout, is not independently sufficient evidence that the action completed. The helper's attempted count measures native calls; accepted count measures their reported BOOLs. Its `outcome=reported` is intentionally distinct from proof of the final business result. Inspect the actual control/model state after recovery; do not repeat the original modal-opening action just because the client timed out.

If the target action has returned and only the original client is stuck, a fresh worker may work. The observed modal and timeout alone cannot establish which case applies. A non-JAB input channel or authorized user action can close an already identified modal; after that, recheck bridge reads and the resulting model state. A later modal-opening step can be triggered through a suitable nonblocking input path, then JAB can read/answer it if the bridge thread was not synchronously occupied. Public JAB has no asynchronous-action, target-action cancellation, or extra target request-thread API.

Primary sources: [target Java bridge window and message loop](https://github.com/openjdk/jdk17u/blob/master/src/jdk.accessibility/windows/native/libjavaaccessbridge/JavaAccessBridge.cpp#L194), [request processing](https://github.com/openjdk/jdk17u/blob/master/src/jdk.accessibility/windows/native/libjavaaccessbridge/JavaAccessBridge.cpp#L976), [JNI action call](https://github.com/openjdk/jdk17u/blob/master/src/jdk.accessibility/windows/native/libjavaaccessbridge/AccessBridgeJavaEntryPoints.cpp#L3085), [invokeAndWait](https://github.com/openjdk/jdk17u/blob/master/src/jdk.accessibility/windows/classes/com/sun/java/accessibility/internal/AccessBridge.java#L6857), [client shared-memory return logic](https://github.com/openjdk/jdk17u/blob/master/src/jdk.accessibility/windows/native/libwindowsaccessbridge/AccessBridgeJavaVMInstance.cpp#L253), [SendMessageTimeout semantics](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendmessagetimeoutw).
