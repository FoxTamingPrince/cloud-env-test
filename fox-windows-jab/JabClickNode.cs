// Optional directed mouse-message fallback. No real cursor or foreground change.
// Compile with Add-Type -Path JabClickNode.cs after creating the JAB controller.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Reflection;
using System.Runtime.InteropServices;

namespace FoxJab {
    public static class DirectedClick {
        [StructLayout(LayoutKind.Sequential)] struct POINT { public int x,y; }
        [StructLayout(LayoutKind.Sequential)] struct RECT { public int left,top,right,bottom; }
        [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
        [DllImport("user32.dll",SetLastError=true)] static extern bool GetWindowRect(IntPtr hwnd,out RECT rect);
        [DllImport("user32.dll",SetLastError=true)] static extern bool GetClientRect(IntPtr hwnd,out RECT rect);
        [DllImport("user32.dll",SetLastError=true)] static extern bool ScreenToClient(IntPtr hwnd,ref POINT point);
        [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
        [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);
        [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll",EntryPoint="PostMessageW",SetLastError=true)]
        static extern bool PostMessage(IntPtr hwnd,uint message,UIntPtr wParam,IntPtr lParam);

        static void WindowGuard(IntPtr hwnd,uint pid) {
            uint actual; GetWindowThreadProcessId(hwnd,out actual);
            if(pid==0 || !IsWindow(hwnd) || actual!=pid) throw new InvalidOperationException("HWND/PID changed; nothing was posted.");
        }
        static Dictionary<string,object> Node(object controller,long hwnd,uint pid,string path) {
            if(controller==null) throw new ArgumentNullException("controller");
            MethodInfo tree=controller.GetType().GetMethod("Tree",new Type[]{typeof(long),typeof(uint),typeof(string),typeof(bool),typeof(int),typeof(int)});
            if(tree==null) throw new ArgumentException("Controller must expose the prepared Tree method.");
            object response;
            try { response=tree.Invoke(controller,new object[]{hwnd,pid,path,false,0,1}); }
            catch(TargetInvocationException e) { throw e.GetBaseException(); }
            Dictionary<string,object> snapshot=(Dictionary<string,object>)response;
            IEnumerable<Dictionary<string,object>> nodes=(IEnumerable<Dictionary<string,object>>)snapshot["nodes"];
            foreach(Dictionary<string,object> node in nodes) return node;
            throw new InvalidOperationException("JAB node no longer exists.");
        }
        static int[] Bounds(Dictionary<string,object> node) { return (int[])node["rect"]; }
        static void RectGuard(int[] actual,int[] expected) {
            if(expected==null || expected.Length!=4) throw new ArgumentException("Fresh expected node and root rectangles are required.");
            for(int i=0;i<4;i++) if(actual[i]!=expected[i]) throw new InvalidOperationException("JAB rectangle changed; nothing was posted.");
            if(actual[2]<=0 || actual[3]<=0) throw new InvalidOperationException("JAB rectangle is empty.");
        }
        static void NodeGuard(Dictionary<string,object> node,string name,string role,int[] rect) {
            if(name==null || String.IsNullOrEmpty(role)) throw new ArgumentException("Expected name/role are required; an empty name is valid.");
            if((string)node["name"]!=name || (string)node["role"]!=role) throw new InvalidOperationException("JAB name/role changed; nothing was posted.");
            RectGuard(Bounds(node),rect);
            if(!((string)node["states"]??"").Contains("enabled")) throw new InvalidOperationException("JAB node is not enabled.");
        }
        // post=false only computes/guards coordinates. post=true queues one sequence.
        public static object ClickNode(object controller,long hwnd,uint pid,string path,
            string expectedName,string expectedRole,int[] expectedRect,int[] expectedRootRect,
            bool doubleClick,bool post) {
            IntPtr window=new IntPtr(hwnd); WindowGuard(window,pid);
            Dictionary<string,object> node=Node(controller,hwnd,pid,path);
            Dictionary<string,object> root=Node(controller,hwnd,pid,"");
            NodeGuard(node,expectedName,expectedRole,expectedRect); RectGuard(Bounds(root),expectedRootRect);
            int[] n=Bounds(node),r=Bounds(root);
            double relativeX=n[0]-r[0]+n[2]/2.0,relativeY=n[1]-r[1]+n[3]/2.0;
            if(relativeX<0 || relativeY<0 || relativeX>=r[2] || relativeY>=r[3]) throw new InvalidOperationException("Node center lies outside its JAB root.");
            IntPtr awareness=GetWindowDpiAwarenessContext(window);
            if(awareness==IntPtr.Zero) throw new InvalidOperationException("Cannot determine target DPI awareness.");
            IntPtr previous=SetThreadDpiAwarenessContext(awareness);
            if(previous==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            try {
                RECT outer,client; uint dpi=GetDpiForWindow(window);
                if(dpi==0 || !GetWindowRect(window,out outer) || !GetClientRect(window,out client)) throw new Win32Exception(Marshal.GetLastWin32Error());
                // JAB releases differ in DPI behavior. Calibrate using the entire
                // fresh root, not absolute-screen multiplication by dpi/96.
                double scale=0;
                foreach(double candidate in new double[]{1.0,dpi/96.0,96.0/dpi}) {
                    if(Math.Abs((outer.right-outer.left)-r[2]*candidate)<=2.0 &&
                       Math.Abs((outer.bottom-outer.top)-r[3]*candidate)<=2.0) { scale=candidate; break; }
                }
                if(scale==0) throw new InvalidOperationException("JAB root/native window sizes do not establish a consistent DPI mapping; nothing was posted.");
                POINT point=new POINT {x=outer.left+(int)Math.Round(relativeX*scale),y=outer.top+(int)Math.Round(relativeY*scale)};
                int screenX=point.x,screenY=point.y;
                if(!ScreenToClient(window,ref point)) throw new Win32Exception(Marshal.GetLastWin32Error());
                if(point.x<client.left || point.y<client.top || point.x>=client.right || point.y>=client.bottom || point.x>32767 || point.y>32767)
                    throw new InvalidOperationException("Mapped point is outside the target client or mouse-message coordinate range.");
                Dictionary<string,object> result=new Dictionary<string,object>{{"queued",false},{"hwnd",hwnd},{"pid",pid},{"path",path},{"dpi",dpi},{"scale",scale},{"screen",new int[]{screenX,screenY}},{"client",new int[]{point.x,point.y}},{"doubleClick",doubleClick}};
                if(!post) return result;
                // Recheck JAB target identity/geometry immediately before queueing.
                NodeGuard(Node(controller,hwnd,pid,path),expectedName,expectedRole,expectedRect);
                RectGuard(Bounds(Node(controller,hwnd,pid,"")),expectedRootRect); WindowGuard(window,pid);
                RECT current;
                if(!GetWindowRect(window,out current) || current.left!=outer.left || current.top!=outer.top || current.right!=outer.right || current.bottom!=outer.bottom)
                    throw new InvalidOperationException("Native window moved/resized; nothing was posted.");
                IntPtr packed=new IntPtr((long)((uint)(ushort)point.x | ((uint)(ushort)point.y<<16)));
                uint[] messages=doubleClick ? new uint[]{0x200,0x201,0x202,0x203,0x202} : new uint[]{0x200,0x201,0x202};
                int count=0;
                foreach(uint message in messages) {
                    uint button=(message==0x201 || message==0x203) ? 1u : 0u;
                    if(!PostMessage(window,message,new UIntPtr(button),packed))
                        throw new InvalidOperationException("PostMessage failed after "+count+" messages; outcome is unknown. Win32 error "+Marshal.GetLastWin32Error()+". Do not retry without inspecting.");
                    count++;
                }
                result["queued"]=true; result["messageCount"]=count; result["outcome"]="queued-only";
                return result;
            } finally { SetThreadDpiAwarenessContext(previous); }
        }
    }
}
