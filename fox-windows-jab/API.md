# Exact public ABI used by the helper

Basis: OpenJDK `jdk-17.0.3+7` public [AccessBridgeCalls.h](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/include/bridge/AccessBridgeCalls.h), [AccessBridgePackages.h](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/include/bridge/AccessBridgePackages.h), and [DLL export definition](https://github.com/openjdk/jdk17u/blob/jdk-17.0.3%2B7/src/jdk.accessibility/windows/native/libwindowsaccessbridge/WinAccessBridge.DEF).

Use the x64 DLL and x64 host. Windows `long`, Win32 `BOOL` and JNI `jint` are **signed 32-bit**, even on x64. JNI `jlong`, `JOBJECT64`, and `AccessibleContext` are **signed 64-bit**, opaque references rather than CLR/native object pointers. `HWND` is pointer-sized. `wchar_t` is a 16-bit UTF-16 code unit. `short` is signed 16-bit. Exported JAB routines use the C calling convention; P/Invoke/delegates declare `Cdecl`. Win32 user32/kernel32 calls use `Winapi`.

These are the exact DLL export spellings with their public signatures; wrapper names such as `IsJavaWindow` have different capitalization:

```c
void Windows_run(void);
BOOL isJavaWindow(HWND window);
BOOL getAccessibleContextFromHWND(HWND window, long *vmID, AccessibleContext *ac);
BOOL getAccessibleContextInfo(long vmID, AccessibleContext ac, AccessibleContextInfo *info);
AccessibleContext getAccessibleChildFromContext(long vmID, AccessibleContext ac, jint i);
void releaseJavaObject(long vmID, Java_Object object);
BOOL getAccessibleActions(long vmID, AccessibleContext ac, AccessibleActions *actions);
BOOL doAccessibleActions(long vmID, AccessibleContext ac, AccessibleActionsToDo *actionsToDo, jint *failure);
BOOL setTextContents(const long vmID, const AccessibleContext ac, const wchar_t *text);
BOOL getAccessibleTextInfo(long vmID, AccessibleText at, AccessibleTextInfo *textInfo, jint x, jint y);
BOOL getAccessibleTextRange(long vmID, AccessibleText at, jint start, jint end, wchar_t *text, short len);
void addAccessibleSelectionFromContext(long vmID, AccessibleSelection as, int i);
void clearAccessibleSelectionFromContext(long vmID, AccessibleSelection as);
BOOL isAccessibleChildSelectedFromContext(long vmID, AccessibleSelection as, int i);
```

Array constants are `MAX_STRING_SIZE=1024`, `SHORT_STRING_SIZE=256`, `MAX_ACTION_INFO=256`, `MAX_ACTIONS_TO_DO=32`.

`AccessibleContextInfo` is sequential native layout, alignment 4, **6188 bytes**:

| Field | Type/count | Byte offset |
| --- | --- | ---: |
| name | UTF-16[1024] | 0 |
| description | UTF-16[1024] | 2048 |
| role | UTF-16[256] | 4096 |
| role_en_US | UTF-16[256] | 4608 |
| states | UTF-16[256] | 5120 |
| states_en_US | UTF-16[256] | 5632 |
| indexInParent | jint | 6144 |
| childrenCount | jint | 6148 |
| x | jint | 6152 |
| y | jint | 6156 |
| width | jint | 6160 |
| height | jint | 6164 |
| accessibleComponent | BOOL | 6168 |
| accessibleAction | BOOL | 6172 |
| accessibleSelection | BOOL | 6176 |
| accessibleText | BOOL | 6180 |
| accessibleInterfaces | BOOL storing a bitfield | 6184 |

The actual public header includes `role_en_US` and `states_en_US`; omitting either corrupts every subsequent field. `accessibleInterfaces` replaces the historical accessibleValue field and is a bitfield, not a general setter capability.

| Structure | Fields | Byte size |
| --- | --- | ---: |
| AccessibleActionInfo | UTF-16 name[256] | 512 |
| AccessibleActions | jint actionsCount at 0; AccessibleActionInfo actionInfo[256] at 4 | 131076 |
| AccessibleActionsToDo | jint actionsCount at 0; AccessibleActionInfo actions[32] at 4 | 16388 |
| AccessibleTextInfo | jint charCount at 0, caretIndex at 4, indexAtPoint at 8 | 12 |

Text set length is at most 1023 UTF-16 code units so the fixed 1024-element packet includes NUL. `getAccessibleTextRange` uses inclusive start/end indexes. The destination is a caller-allocated UTF-16 buffer; this helper allocates 1024 elements and reads at most 1023. Each action name is supplied exactly as returned by `getAccessibleActions`. `doAccessibleActions` returns FALSE on its first failed action and writes that action's index to `failure`; on successful calls the index generally remains -1.

The native bridge APIs expose only a subset of Java accessibility. No direct general numeric-value setter is part of this helper or the cited ABI. Accessible text editing requires `AccessibleEditableText` and editable state.

## Lifecycle requirements

1. Activate the Java-side provider before non-headless Toolkit creation in the fresh target JVM.
2. Load the **client** WindowsAccessBridge DLL and invoke `Windows_run`; `javaaccessbridge.dll` is loaded by Java inside the target JVM, not by the controller.
3. Keep pumping messages on the thread where `Windows_run` created its bridge window. Filtering the pump to the Cubism HWND would miss bridge discovery/events; pump all the worker's messages.
4. Use fresh PID/HWND → vmID/context, and release all returned Java object references after use. HWND can identify a dialog independently of the application's main frame.
5. Unload the client DLL only after outstanding calls finish. An in-flight synchronous call is not safely canceled by freeing its DLL. Shutdown alone does not substitute for `releaseJavaObject`.

This helper has no callbacks. A future callback implementation must preserve the delegate lifetime, use the header's exact callback signature, and release each returned event/source/old/new Java reference after processing. Never marshal a `JOBJECT64` as a 32-bit `IntPtr`.
