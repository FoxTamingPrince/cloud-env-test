// Public OpenJDK 17 Java Access Bridge ABI. No application-private APIs.
// Intended for 64-bit Windows PowerShell 5.1 / .NET Framework.
using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace FoxJab {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct ContextInfo {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=1024)] public string name;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=1024)] public string description;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=256)] public string role;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=256)] public string role_en_US;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=256)] public string states;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=256)] public string states_en_US;
        public int indexInParent, childrenCount, x, y, width, height;
        // Win32 BOOL is a 4-byte integer, including on x64.
        public int accessibleComponent, accessibleAction, accessibleSelection,
                   accessibleText, accessibleInterfaces;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct ActionInfo {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=256)] public string name;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct Actions {
        public int actionsCount;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst=256)] public ActionInfo[] actionInfo;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct ActionsToDo {
        public int actionsCount;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst=32)] public ActionInfo[] actions;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct TextInfo { public int charCount, caretIndex, indexAtPoint; }

    public sealed class Controller {
        // JAB exported routines are C ABI (__cdecl), not Win32 API wrappers.
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void RunFn();
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int IsJavaFn(IntPtr hwnd);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int RootFn(IntPtr hwnd, out int vm, out long ac);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int InfoFn(int vm, long ac, out ContextInfo info);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate long ChildFn(int vm, long ac, int index);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void ReleaseFn(int vm, long ac);
        // .NET Framework cannot marshal the 131076-byte Actions struct here.
        // Keep these two ABI parameters as caller-owned native pointers.
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int ActionsFn(int vm, long ac, IntPtr actions);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int DoFn(int vm, long ac, IntPtr actions, out int failure);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl, CharSet=CharSet.Unicode)]
        delegate int SetFn(int vm, long ac, [MarshalAs(UnmanagedType.LPWStr)] string text);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int TextInfoFn(int vm, long ac, out TextInfo info, int x, int y);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl, CharSet=CharSet.Unicode)]
        delegate int TextRangeFn(int vm, long ac, int start, int end, [Out] StringBuilder text, short len);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void SelectFn(int vm, long ac, int index);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void ClearSelectFn(int vm, long ac);
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int SelectedFn(int vm, long ac, int index);

        [StructLayout(LayoutKind.Sequential)] struct POINT { public int x, y; }
        [StructLayout(LayoutKind.Sequential)] struct MSG {
            public IntPtr hwnd; public uint message; public UIntPtr wParam;
            public IntPtr lParam; public uint time; public POINT pt; public uint lPrivate;
        }
        delegate bool EnumFn(IntPtr hwnd, IntPtr lparam);
        [DllImport("user32.dll")] static extern bool EnumWindows(EnumFn callback, IntPtr lparam);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
        [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int count);
        [DllImport("user32.dll")] static extern bool PeekMessage(out MSG msg, IntPtr hwnd, uint min, uint max, uint remove);
        [DllImport("user32.dll")] static extern bool TranslateMessage(ref MSG msg);
        [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref MSG msg);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryEx(string name, IntPtr reserved, uint flags);
        [DllImport("kernel32.dll", CharSet=CharSet.Ansi, ExactSpelling=true, SetLastError=true)] static extern IntPtr GetProcAddress(IntPtr module, string name);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool FreeLibrary(IntPtr module);

        sealed class Job {
            public Func<object> Work;
            public TaskCompletionSource<object> Done = new TaskCompletionSource<object>();
        }
        BlockingCollection<Job> jobs = new BlockingCollection<Job>();
        Thread worker;
        volatile bool stopping, poisoned;
        IntPtr library;
        IsJavaFn isJava; RootFn root; InfoFn info; ChildFn child; ReleaseFn release;
        ActionsFn actions; DoFn doActions; SetFn setText; TextInfoFn textInfo; TextRangeFn textRange;
        SelectFn addSelection; ClearSelectFn clearSelection; SelectedFn isSelected;

        T Bind<T>(string name) where T:class {
            IntPtr address = GetProcAddress(library, name);
            if (address == IntPtr.Zero) throw new InvalidOperationException("Missing JAB export: " + name);
            return (T)(object)Marshal.GetDelegateForFunctionPointer(address, typeof(T));
        }
        void Pump() {
            MSG message;
            while (PeekMessage(out message, IntPtr.Zero, 0, 0, 1)) {
                if (message.message == 0x12) { stopping = true; break; }
                TranslateMessage(ref message); DispatchMessage(ref message);
            }
        }
        object Call(Func<object> work) {
            if (poisoned || stopping) throw new InvalidOperationException("Controller stopped or timed out; start a fresh controller and inspect before retrying.");
            Job job = new Job { Work=work }; jobs.Add(job);
            if (!job.Done.Task.Wait(20000)) {
                poisoned = true;
                throw new TimeoutException("JAB call timed out. Its outcome is unknown and it may still finish. Inspect before retrying; restart the controller.");
            }
            return job.Done.Task.GetAwaiter().GetResult();
        }
        public Controller(string dllPath) {
            if (IntPtr.Size != 8) throw new InvalidOperationException("Use 64-bit PowerShell and windowsaccessbridge-64.dll.");
            if (!System.IO.Path.IsPathRooted(dllPath)) throw new ArgumentException("DLL path must be absolute.");
            if (Marshal.SizeOf(typeof(ContextInfo)) != 6188 || Marshal.SizeOf(typeof(TextInfo)) != 12)
                throw new InvalidOperationException("Unexpected JAB structure layout.");
            TaskCompletionSource<bool> ready = new TaskCompletionSource<bool>();
            worker = new Thread(delegate() {
                try {
                    // Search only the specified DLL directory and Windows defaults.
                    library = LoadLibraryEx(dllPath, IntPtr.Zero, 0x100 | 0x1000);
                    if (library == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
                    isJava=Bind<IsJavaFn>("isJavaWindow"); root=Bind<RootFn>("getAccessibleContextFromHWND");
                    info=Bind<InfoFn>("getAccessibleContextInfo"); child=Bind<ChildFn>("getAccessibleChildFromContext");
                    release=Bind<ReleaseFn>("releaseJavaObject"); actions=Bind<ActionsFn>("getAccessibleActions");
                    doActions=Bind<DoFn>("doAccessibleActions"); setText=Bind<SetFn>("setTextContents");
                    textInfo=Bind<TextInfoFn>("getAccessibleTextInfo"); textRange=Bind<TextRangeFn>("getAccessibleTextRange");
                    addSelection=Bind<SelectFn>("addAccessibleSelectionFromContext");
                    clearSelection=Bind<ClearSelectFn>("clearAccessibleSelectionFromContext");
                    isSelected=Bind<SelectedFn>("isAccessibleChildSelectedFromContext");
                    Bind<RunFn>("Windows_run")(); // Same DLL initialization used by AccessBridgeCalls.c.
                    DateTime end=DateTime.UtcNow.AddMilliseconds(1500);
                    while (DateTime.UtcNow < end) { Pump(); Thread.Sleep(10); }
                    ready.SetResult(true);
                    while (!stopping) {
                        Pump(); Job job;
                        if (jobs.TryTake(out job, 10)) {
                            try { job.Done.SetResult(job.Work()); }
                            catch (Exception e) { job.Done.SetException(e); }
                        }
                    }
                } catch (Exception e) { if (!ready.Task.IsCompleted) ready.SetException(e); }
                finally { if (library != IntPtr.Zero) { FreeLibrary(library); library=IntPtr.Zero; } }
            });
            worker.IsBackground=true; worker.SetApartmentState(ApartmentState.STA); worker.Start();
            ready.Task.GetAwaiter().GetResult();
        }
        public void Close() { stopping=true; if (worker != null) worker.Join(2000); }
        IntPtr CheckedWindow(long hwnd, uint pid) {
            IntPtr window=new IntPtr(hwnd); uint actual;
            if (pid == 0) throw new ArgumentException("An explicit nonzero target pid is required.");
            GetWindowThreadProcessId(window, out actual);
            if (!IsWindow(window) || actual != pid) throw new InvalidOperationException("HWND is absent or belongs to a different process.");
            if (isJava(window)==0) throw new InvalidOperationException("HWND is not registered with JAB. Restart Cubism with per-process activation, and allow the message pump to discover it.");
            return window;
        }
        long Resolve(long hwnd, uint pid, string path, out int vm) {
            long ac;
            if (root(CheckedWindow(hwnd,pid),out vm,out ac)==0 || ac==0) throw new InvalidOperationException("Cannot obtain Java root context.");
            try {
                if (!String.IsNullOrEmpty(path)) foreach (string part in path.Split('/')) {
                    int index;
                    if (!Int32.TryParse(part,out index) || index<0) throw new ArgumentException("Path must contain zero-based child indexes separated by '/'.");
                    ContextInfo parent=Info(vm,ac);
                    if (index>=parent.childrenCount) throw new ArgumentException("Path index no longer exists.");
                    long next=child(vm,ac,index);
                    if (next==0) throw new InvalidOperationException("Child context is unavailable.");
                    release(vm,ac); ac=next;
                }
                return ac;
            } catch { release(vm,ac); throw; }
        }
        ContextInfo Info(int vm,long ac) {
            ContextInfo result;
            if (info(vm,ac,out result)==0) throw new InvalidOperationException("Context information is unavailable; take a new snapshot.");
            return result;
        }
        List<string> ActionNames(int vm,long ac,ContextInfo ci) {
            List<string> result=new List<string>();
            if (ci.accessibleAction == 0) return result;
            IntPtr available=Marshal.AllocHGlobal(131076); // jint + 256 * wchar_t[256]
            try {
                if (actions(vm,ac,available)!=0) {
                    int count=Marshal.ReadInt32(available);
                    for(int i=0;i<Math.Min(Math.Max(count,0),256);i++) {
                        string name=Marshal.PtrToStringUni(IntPtr.Add(available,4+i*512),256);
                        int nul=name.IndexOf('\0');
                        result.Add(nul>=0 ? name.Substring(0,nul) : name);
                    }
                }
            } finally { Marshal.FreeHGlobal(available); }
            return result;
        }
        string ReadText(int vm,long ac,ContextInfo ci) {
            if (ci.accessibleText==0 || ci.role_en_US=="password text") return null;
            TextInfo ti;
            if(textInfo(vm,ac,out ti,ci.x,ci.y)==0) return null;
            if(ti.charCount==0) return "";
            if(ti.charCount<0) return null;
            int count=Math.Min(ti.charCount,1023); StringBuilder output=new StringBuilder(1024);
            return textRange(vm,ac,0,count-1,output,1024)!=0 ? output.ToString() : null;
        }
        Dictionary<string,object> Record(int vm,long ac,string path,ContextInfo ci,bool withText) {
            Dictionary<string,object> result=new Dictionary<string,object>();
            result["path"]=path; result["name"]=ci.name; result["description"]=ci.description;
            result["role"]=ci.role_en_US; result["roleLocalized"]=ci.role;
            result["states"]=ci.states_en_US; result["childrenCount"]=ci.childrenCount;
            result["rect"]=new int[]{ci.x,ci.y,ci.width,ci.height};
            result["accessibleText"]=ci.accessibleText!=0; result["accessibleSelection"]=ci.accessibleSelection!=0;
            result["actions"]=ActionNames(vm,ac,ci); if(withText) result["text"]=ReadText(vm,ac,ci);
            return result;
        }
        static void Guard(ContextInfo ci,string expectedName,string expectedRole,int[] expectedRect) {
            if(expectedName==null || String.IsNullOrEmpty(expectedRole)) throw new ArgumentException("Mutation needs expect.name (empty is allowed) and expect.role from the latest snapshot.");
            if(ci.name!=expectedName || ci.role_en_US!=expectedRole) throw new InvalidOperationException("Control name/role changed; mutation was not attempted.");
            if(expectedRect!=null && (expectedRect.Length!=4 || ci.x!=expectedRect[0] || ci.y!=expectedRect[1] || ci.width!=expectedRect[2] || ci.height!=expectedRect[3]))
                throw new InvalidOperationException("Control rectangle changed; mutation was not attempted.");
            if(!(ci.states_en_US??"").Contains("enabled")) throw new InvalidOperationException("Control is not enabled.");
        }
        public object Windows(uint pid) { return Call(delegate() {
            List<Dictionary<string,object>> rows=new List<Dictionary<string,object>>();
            EnumFn callback=delegate(IntPtr hwnd,IntPtr ignored) {
                uint actual; GetWindowThreadProcessId(hwnd,out actual);
                if((pid==0 || actual==pid) && IsWindowVisible(hwnd)) {
                    StringBuilder title=new StringBuilder(1024), cls=new StringBuilder(256);
                    GetWindowText(hwnd,title,title.Capacity); GetClassName(hwnd,cls,cls.Capacity);
                    rows.Add(new Dictionary<string,object>{{"hwnd",hwnd.ToInt64()},{"pid",actual},{"title",title.ToString()},{"class",cls.ToString()},{"java",isJava(hwnd)!=0}});
                }
                return true;
            };
            EnumWindows(callback,IntPtr.Zero); GC.KeepAlive(callback); return rows;
        }); }
        public object Tree(long hwnd,uint pid,string path,bool withText,int maxDepth,int maxNodes) { return Call(delegate() {
            int vm; long ac=Resolve(hwnd,pid,path,out vm); List<Dictionary<string,object>> rows=new List<Dictionary<string,object>>();
            if(maxDepth<0 || maxDepth>64 || maxNodes<1 || maxNodes>10000) { release(vm,ac); throw new ArgumentException("Use maxDepth 0..64 and maxNodes 1..10000."); }
            try { Walk(vm,ac,path??"",withText,0,maxDepth,maxNodes,rows); }
            finally { release(vm,ac); }
            return new Dictionary<string,object>{{"hwnd",hwnd},{"pid",pid},{"nodes",rows},{"limitReached",rows.Count>=maxNodes}};
        }); }
        void Walk(int vm,long ac,string path,bool text,int depth,int maxDepth,int maxNodes,List<Dictionary<string,object>> rows) {
            if(rows.Count>=maxNodes)return;
            ContextInfo ci=Info(vm,ac); rows.Add(Record(vm,ac,path,ci,text));
            if(depth>=maxDepth)return;
            for(int i=0;i<ci.childrenCount && rows.Count<maxNodes;i++) {
                long next=child(vm,ac,i); if(next==0)continue;
                try { Walk(vm,next,path==""?i.ToString():path+"/"+i,text,depth+1,maxDepth,maxNodes,rows); }
                finally { release(vm,next); }
            }
        }
        public object SetText(long hwnd,uint pid,string path,string expectedName,string expectedRole,int[] expectedRect,string value) { return Call(delegate() {
            if(value==null || value.Length>1023 || value.IndexOf('\0')>=0) throw new ArgumentException("Text must contain 0..1023 UTF-16 code units and no NUL.");
            int vm; long ac=Resolve(hwnd,pid,path,out vm);
            try {
                ContextInfo ci=Info(vm,ac); Guard(ci,expectedName,expectedRole,expectedRect);
                if(ci.accessibleText==0 || ci.role_en_US=="password text") throw new InvalidOperationException("Target must expose non-password accessible text.");
                if(setText(vm,ac,value)==0) throw new InvalidOperationException("setTextContents returned FALSE. Target must implement editable AccessibleEditableText.");
                string readback=ReadText(vm,ac,Info(vm,ac));
                return new Dictionary<string,object>{{"accepted",true},{"text",readback},{"matches",readback==value}};
            } finally { release(vm,ac); }
        }); }
        public object Action(long hwnd,uint pid,string path,string expectedName,string expectedRole,int[] expectedRect,string action) { return Call(delegate() {
            int vm; long ac=Resolve(hwnd,pid,path,out vm);
            try {
                ContextInfo ci=Info(vm,ac); Guard(ci,expectedName,expectedRole,expectedRect);
                if(String.IsNullOrEmpty(action) || !ActionNames(vm,ac,ci).Contains(action)) throw new ArgumentException("Use an exact action name returned by this control.");
                if(action.Length>255 || action.IndexOf('\0')>=0) throw new ArgumentException("Action names must fit the 256-code-unit NUL-terminated native name field.");
                IntPtr todo=Marshal.AllocHGlobal(16388); // jint + 32 * wchar_t[256]
                try {
                    Marshal.Copy(new byte[16388],0,todo,16388);
                    Marshal.WriteInt32(todo,1);
                    byte[] nameBytes=Encoding.Unicode.GetBytes(action);
                    Marshal.Copy(nameBytes,0,IntPtr.Add(todo,4),nameBytes.Length);
                    int failure; bool accepted=doActions(vm,ac,todo,out failure)!=0;
                    return new Dictionary<string,object>{{"accepted",accepted},{"failureIndex",failure},{"action",action}};
                } finally { Marshal.FreeHGlobal(todo); }
            } finally { release(vm,ac); }
        }); }
        public object Select(long hwnd,uint pid,string path,string expectedName,string expectedRole,int[] expectedRect,int index,bool clear) { return Call(delegate() {
            int vm; long ac=Resolve(hwnd,pid,path,out vm);
            try {
                ContextInfo ci=Info(vm,ac); Guard(ci,expectedName,expectedRole,expectedRect);
                if(ci.accessibleSelection==0 || index<0 || index>=ci.childrenCount) throw new ArgumentException("Target must expose AccessibleSelection and requested child index.");
                if(clear)clearSelection(vm,ac); addSelection(vm,ac,index);
                return new Dictionary<string,object>{{"selected",isSelected(vm,ac,index)!=0},{"index",index}};
            } finally { release(vm,ac); }
        }); }
        // JComboBox exposes one popup child but selection indexes belong to its
        // list model. Validate that model through its accessible popup list.
        public object SelectCombo(long hwnd,uint pid,string path,string expectedName,string expectedRole,int[] expectedRect,int index,string expectedChoiceName) { return Call(delegate() {
            if(index<0 || expectedChoiceName==null) throw new ArgumentException("SelectCombo needs a nonnegative index and explicit choiceName.");
            int vm; long ac=Resolve(hwnd,pid,path,out vm);
            try {
                ContextInfo ci=Info(vm,ac); Guard(ci,expectedName,expectedRole,expectedRect);
                if(ci.role_en_US!="combo box" || ci.accessibleSelection==0) throw new ArgumentException("Target must be a combo box exposing AccessibleSelection.");
                int visited=0,matches=0;
                FindComboChoice(vm,ac,0,index,expectedChoiceName,ref visited,ref matches);
                if(matches!=1) throw new InvalidOperationException("Expected choice must match exactly one list within four child levels of this combo; no selection was attempted.");
                Guard(Info(vm,ac),expectedName,expectedRole,expectedRect);
                addSelection(vm,ac,index);
                return new Dictionary<string,object>{{"selected",isSelected(vm,ac,index)!=0},{"index",index},{"choiceName",expectedChoiceName},{"target","combo box"}};
            } finally { release(vm,ac); }
        }); }
        void FindComboChoice(int vm,long ac,int depth,int index,string choiceName,ref int visited,ref int matches) {
            if(++visited>256) throw new InvalidOperationException("Combo subtree exceeds the bounded search; no selection was attempted.");
            ContextInfo ci=Info(vm,ac);
            if(ci.role_en_US=="list") {
                if(index>=ci.childrenCount) return;
                long choice=child(vm,ac,index); if(choice==0)return;
                try { if(Info(vm,choice).name==choiceName) matches++; }
                finally { release(vm,choice); }
                return;
            }
            if(depth>=4)return;
            for(int i=0;i<ci.childrenCount;i++) {
                long next=child(vm,ac,i); if(next==0)continue;
                try { FindComboChoice(vm,next,depth+1,index,choiceName,ref visited,ref matches); }
                finally { release(vm,next); }
            }
        }
    }
}
