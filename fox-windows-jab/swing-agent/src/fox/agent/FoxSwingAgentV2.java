package fox.agent;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dialog;
import java.awt.EventQueue;
import java.awt.Frame;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.Window;
import java.awt.event.InputEvent;
import java.awt.event.MouseEvent;
import java.lang.instrument.Instrumentation;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.WeakHashMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import javax.accessibility.AccessibleAction;
import javax.accessibility.AccessibleComponent;
import javax.accessibility.AccessibleContext;
import javax.accessibility.AccessibleEditableText;
import javax.accessibility.AccessibleRole;
import javax.accessibility.AccessibleState;
import javax.accessibility.AccessibleValue;
import javax.swing.JMenu;
import javax.swing.text.JTextComponent;

/** Public Attach/AWT/Swing accessibility only. No transformers, reflection, JNI, or app-private APIs. */
public final class FoxSwingAgentV2 {
    private static Server server;
    private FoxSwingAgentV2() {}

    public static synchronized void agentmain(String configurationPath, Instrumentation unused) throws Exception {
        if (server != null && (server.active || server.hasRunning())) throw new IllegalStateException("Agent is active or an old UI call is still running; do not attach it twice.");
        Path config = Path.of(configurationPath).toAbsolutePath().normalize();
        if (!Path.of(configurationPath).isAbsolute()) throw new IllegalArgumentException("Configuration path must be absolute.");
        Map<String,Object> settings = object(Json.parse(readBounded(config, 16384)));
        long pid = ProcessHandle.current().pid();
        if (integer(settings, "pid") != pid) throw new IllegalArgumentException("Configuration PID is not this JVM.");
        Path expectedHome = Path.of(string(settings, "expectedJavaHome")).toAbsolutePath().normalize();
        Path actualHome = Path.of(System.getProperty("java.home")).toAbsolutePath().normalize();
        if (!samePath(expectedHome, actualHome)) throw new IllegalArgumentException("Target java.home differs from the explicit guard.");
        Path directory = Path.of(string(settings, "controlDirectory"));
        if (!directory.isAbsolute()) throw new IllegalArgumentException("Control directory must be absolute.");
        directory = directory.normalize();
        Path privateBase = Path.of(System.getProperty("user.home"), ".fox-live2d").toAbsolutePath().normalize();
        if (!directory.startsWith(privateBase) || directory.equals(privateBase))
            throw new IllegalArgumentException("Use a dedicated child of this user's .fox-live2d directory.");
        Server candidate = new Server(pid, directory);
        try {
            candidate.start(); // No EDT wait: loadAgent can return even if a modal loop is active.
            server = candidate;
        } catch(Exception error) { candidate.abortBootstrap(); throw error; }
    }

    private static boolean samePath(Path a, Path b) {
        return System.getProperty("os.name", "").startsWith("Windows")
            ? a.toString().equalsIgnoreCase(b.toString()) : a.equals(b);
    }
    private static String readBounded(Path path, int limit) throws Exception {
        if (!Files.isRegularFile(path) || Files.size(path) > limit) throw new IllegalArgumentException("Missing or oversized IPC file.");
        byte[] bytes = Files.readAllBytes(path);
        if (bytes.length > limit) throw new IllegalArgumentException("IPC file grew beyond limit.");
        return new String(bytes, StandardCharsets.UTF_8);
    }
    @SuppressWarnings("unchecked") private static Map<String,Object> object(Object value) {
        if (!(value instanceof Map)) throw new IllegalArgumentException("Expected a JSON object.");
        return (Map<String,Object>) value;
    }
    private static String string(Map<String,Object> map, String key) {
        if (!(map.get(key) instanceof String)) throw new IllegalArgumentException("Explicit string required: " + key);
        return (String) map.get(key);
    }
    private static long integer(Map<String,Object> map, String key) {
        if (!(map.get(key) instanceof BigDecimal)) throw new IllegalArgumentException("Explicit integer required: " + key);
        return ((BigDecimal) map.get(key)).longValueExact();
    }
    private static int bounded(Map<String,Object> map, String key, int fallback, int min, int max) {
        long value = map.containsKey(key) ? integer(map, key) : fallback;
        if (value < min || value > max) throw new IllegalArgumentException(key + " is outside its bound.");
        return (int) value;
    }
    private static BigDecimal number(Map<String,Object> map,String key) {
        if(!(map.get(key) instanceof BigDecimal))throw new IllegalArgumentException("Explicit JSON number required: "+key);
        return (BigDecimal)map.get(key);
    }
    private static BigDecimal decimal(Number value) {
        if(value==null)throw new IllegalArgumentException("AccessibleValue must expose a current value and bounded min/max.");
        return new BigDecimal(value.toString()); // Rejects NaN/Infinity and unknown non-numeric representations.
    }
    private static Number convertValue(BigDecimal wanted,Number current) {
        Number converted;
        if(current instanceof Integer)converted=wanted.intValueExact();
        else if(current instanceof Long)converted=wanted.longValueExact();
        else if(current instanceof Short)converted=wanted.shortValueExact();
        else if(current instanceof Byte)converted=wanted.byteValueExact();
        else if(current instanceof Double)converted=wanted.doubleValue();
        else if(current instanceof Float)converted=wanted.floatValue();
        else if(current instanceof BigDecimal)converted=wanted;
        else if(current instanceof java.math.BigInteger)converted=wanted.toBigIntegerExact();
        else throw new IllegalArgumentException("Unsupported Number subtype; no application-specific conversion is inferred.");
        if(decimal(converted).compareTo(wanted)!=0)throw new IllegalArgumentException("Requested value loses precision in the control's existing Number type.");
        return converted;
    }
    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> out = new LinkedHashMap<>();
        for (int i=0; i<pairs.length; i+=2) out.put((String)pairs[i], pairs[i+1]);
        return out;
    }
    private static String shortMessage(Throwable error) {
        String text = error.getMessage();
        return text == null ? "" : text.substring(0, Math.min(text.length(), 2048));
    }
    private static List<Integer> rectangle(Rectangle r) { return Arrays.asList(r.x, r.y, r.width, r.height); }
    private static String title(Window window) {
        if (window instanceof Frame) return ((Frame)window).getTitle();
        if (window instanceof Dialog) return ((Dialog)window).getTitle();
        AccessibleContext ac = window.getAccessibleContext();
        return ac == null || ac.getAccessibleName() == null ? "" : ac.getAccessibleName();
    }
    private static String name(Component component) {
        AccessibleContext ac = component.getAccessibleContext();
        String value = ac == null ? component.getName() : ac.getAccessibleName();
        return value == null ? "" : value;
    }
    private static String role(Component component) {
        AccessibleContext ac = component.getAccessibleContext();
        return ac == null || ac.getAccessibleRole() == null ? "component" : ac.getAccessibleRole().toDisplayString(Locale.US);
    }
    private static List<String> actions(Component component) {
        List<String> values = new ArrayList<>();
        AccessibleContext ac = component.getAccessibleContext();
        AccessibleAction action = ac == null ? null : ac.getAccessibleAction();
        if (action != null) for (int i=0; i<Math.min(action.getAccessibleActionCount(), 256); i++) values.add(action.getAccessibleActionDescription(i));
        return values;
    }
    private static String text(Component component) {
        AccessibleContext ac = component.getAccessibleContext();
        if (ac == null || AccessibleRole.PASSWORD_TEXT.equals(ac.getAccessibleRole())) return null;
        if (component instanceof JTextComponent) {
            String value = ((JTextComponent)component).getText();
            return value.substring(0, Math.min(value.length(), 4096));
        }
        return null; // Do not infer text from renderers or app-private methods.
    }
    private static void atomic(Path target, Object value) throws Exception {
        Path temporary = target.resolveSibling(target.getFileName() + "." + UUID.randomUUID() + ".tmp");
        try {
            byte[] bytes = Json.write(value).getBytes(StandardCharsets.UTF_8);
            try (FileChannel channel = FileChannel.open(temporary, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                ByteBuffer data = ByteBuffer.wrap(bytes);
                while (data.hasRemaining()) channel.write(data);
                channel.force(true);
            }
            // Windows readers can briefly deny replacement. Retry only this output write;
            // GUI requests are never re-executed.
            for (int attempt=0;;attempt++) {
                try { Files.move(temporary,target,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING); break; }
                catch (java.nio.file.FileSystemException e) {
                    if(attempt>=30 || !System.getProperty("os.name", "").startsWith("Windows"))throw e;
                    Thread.sleep(100);
                }
            }
        } finally { Files.deleteIfExists(temporary); }
    }

    private static final class Task {
        final String id, hash;
        final Map<String,Object> request;
        final Path receipt;
        final long deadline;
        final AtomicInteger state = new AtomicInteger(0); // 0 queued, 1 executing, 2 completed, 3 canceled before start.
        volatile boolean reportedTimeout;
        Task(String id, String hash, Map<String,Object> request, Path receipt, int timeoutMs) {
            this.id=id; this.hash=hash; this.request=request; this.receipt=receipt;
            this.deadline=System.nanoTime()+timeoutMs*1_000_000L;
        }
    }
    private static final class Server {
        final long pid;
        final String runId=UUID.randomUUID().toString();
        final Path directory, requestFile, resultFile, readyFile, receipts;
        final Map<String,Task> tasks = new ConcurrentHashMap<>();
        final WeakHashMap<Window,String> windowIds = new WeakHashMap<>();
        final WeakHashMap<Component,String> nodeIds = new WeakHashMap<>();
        final Object publicationLock = new Object();
        final Object admissionLock = new Object();
        final ExecutorService disk = Executors.newSingleThreadExecutor(r -> { Thread t=new Thread(r,"FoxSwingAgentV2-IO"); t.setDaemon(true); return t; });
        FileChannel lockChannel;
        FileLock lock;
        int nextWindow=1, nextNode=1;
        volatile boolean active=true;
        volatile String latestId;
        Server(long pid, Path directory) {
            this.pid=pid; this.directory=directory;
            requestFile=directory.resolve("request.json"); resultFile=directory.resolve("result.json");
            readyFile=directory.resolve("ready.json"); receipts=directory.resolve("receipts");
        }
        void start() throws Exception {
            Files.createDirectories(receipts);
            if (Files.isSymbolicLink(directory) || Files.isSymbolicLink(receipts)) throw new IllegalArgumentException("IPC directories must not be symlinks.");
            lockChannel=FileChannel.open(directory.resolve("agent.lock"),StandardOpenOption.CREATE,StandardOpenOption.WRITE);
            lock=lockChannel.tryLock();
            if (lock == null) { lockChannel.close(); throw new IllegalStateException("Another agent owns this IPC directory."); }
            atomic(readyFile,map("active",true,"pid",pid,"runId",runId,"protocol",1,"controlDirectory",directory.toString(),"idleMinutes",20));
            Thread thread=new Thread(this::poll,"FoxSwingAgentV2-Requests"); thread.setDaemon(true); thread.start();
        }
        void abortBootstrap() {
            active=false; disk.shutdown();
            try { if(lock!=null && lock.isValid())lock.release(); }catch(Exception ignored){}
            try { if(lockChannel!=null)lockChannel.close(); }catch(Exception ignored){}
        }
        boolean hasRunning() { for(Task task:tasks.values())if(task.state.get()==1)return true;return false; }
        void poll() {
            String lastHash=""; long lastActivity=System.nanoTime(); String stop="idle";
            try {
                while (active && System.nanoTime()-lastActivity < 20L*60L*1_000_000_000L) {
                    expire();
                    if (Files.exists(requestFile)) {
                        String raw=readBounded(requestFile,65536);
                        String hash=hex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
                        if (!hash.equals(lastHash)) {
                            lastHash=hash; lastActivity=System.nanoTime();
                            try { receive(object(Json.parse(raw)),hash); }
                            catch (Exception e) { synchronized(publicationLock) { atomic(resultFile,map("ok",false,"id",null,"outcome","notExecuted","errorType",e.getClass().getName(),"error",shortMessage(e))); } }
                        }
                    }
                    Thread.sleep(100);
                }
                if (!active) stop="requested";
            } catch (Exception e) { stop="error"; failIo(e); }
            finally {
                synchronized(admissionLock) { active=false; }
                for (Task task:tasks.values()) if(task.state.compareAndSet(0,3)) publish(task,map("ok",false,"id",task.id,"outcome","notExecuted","error","Agent stopped before EDT execution."),"canceled");
                final String reason=stop;
                disk.execute(() -> {
                    try { atomic(readyFile,map("active",false,"pid",pid,"runId",runId,"reason",reason)); }
                    catch(Exception e) { System.err.println("FoxSwingAgentV2 stop error: "+shortMessage(e)); }
                    finally { try { lock.release(); lockChannel.close(); } catch(Exception ignored) {} }
                });
                disk.shutdown(); // Already-running UI actions cannot be canceled or unloaded.
            }
        }
        void receive(Map<String,Object> request,String hash) throws Exception {
            String id=UUID.fromString(string(request,"id")).toString();
            if (integer(request,"pid") != pid || !runId.equals(string(request,"runId"))) throw new IllegalArgumentException("PID/runId guard differs from this agent.");
            synchronized(publicationLock) { latestId=id; }
            Path receipt=receipts.resolve(id+".json");
            if (Files.exists(receipt)) {
                Map<String,Object> old=object(Json.parse(readBounded(receipt,16_777_216)));
                Object response=hash.equals(old.get("hash")) ? old.get("response") : map("ok",false,"id",id,"outcome","notExecuted","error","UUID reused with different request content.");
                if(hash.equals(old.get("hash")) && !runId.equals(old.get("runId")) && !"completed".equals(old.get("state")) && !"canceled".equals(old.get("state")))
                    response=map("ok",false,"id",id,"outcome","unknown","error","A prior agent already claimed this UUID; no replay is allowed.");
                if(response==null)response=map("ok",false,"id",id,"outcome","unknown","error","UUID already claimed; it will not be executed again.");
                synchronized(publicationLock) { atomic(resultFile,response); }
                return;
            }
            int timeout=bounded(request,"timeoutMs",15000,1000,60000);
            Task task=new Task(id,hash,request,receipt,timeout);
            Map<String,Object> queued=map("ok",true,"id",id,"status","queued","outcome","pending","retryAttempted",false);
            byte[] claim=Json.write(map("id",id,"hash",hash,"state","claimed","runId",runId,"response",queued)).getBytes(StandardCharsets.UTF_8);
            try(FileChannel channel=FileChannel.open(receipt,StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE)) {
                ByteBuffer data=ByteBuffer.wrap(claim); while(data.hasRemaining())channel.write(data); channel.force(true);
            }
            tasks.put(id,task);
            synchronized(publicationLock) { atomic(resultFile,queued); }
            String op=string(request,"op");
            if(op.equals("status")) {
                Path other=receipts.resolve(UUID.fromString(string(request,"targetId")).toString()+".json");
                complete(task,map("ok",true,"id",id,"status","completed","result",Files.exists(other)?Json.parse(readBounded(other,16_777_216)):null));
            } else if(op.equals("quit")) {
                complete(task,map("ok",true,"id",id,"status","completed","result",map("stopping",true,"runningUiCalls",hasRunning()))); synchronized(admissionLock) { active=false; }
            } else EventQueue.invokeLater(() -> execute(task));
        }
        void execute(Task task) {
            synchronized(admissionLock) {
                if (!active || System.nanoTime()>task.deadline) {
                    if(task.state.compareAndSet(0,3))publish(task,map("ok",false,"id",task.id,"status","canceled","outcome","notExecuted","error","Request expired before EDT execution."),"canceled");
                    return;
                }
                if(!task.state.compareAndSet(0,1))return;
            }
            try {
                if(!EventQueue.isDispatchThread())throw new IllegalStateException("GUI operation requires EDT.");
                Object result=gui(task.request);
                complete(task,map("ok",true,"id",task.id,"status","completed","outcome","reported","result",result,"retryAttempted",false));
            } catch(Throwable e) {
                complete(task,map("ok",false,"id",task.id,"status","failed","outcome","partialOrUnknown","errorType",e.getClass().getName(),"error",shortMessage(e),"retryAttempted",false));
            }
        }
        void complete(Task task,Map<String,Object> response) { synchronized(task) { task.state.set(2); publish(task,response,"completed"); } }
        void publish(Task task,Map<String,Object> response,String state) {
            try {
                disk.execute(() -> {
                    try {
                        writePublication(task,response,state,true);
                    } catch(Exception e) { failIo(e); }
                });
            } catch(java.util.concurrent.RejectedExecutionException stopped) {
                // A late UI completion after quit/idle still records this UUID, never replays it.
                Thread late=new Thread(() -> {
                    try { writePublication(task,response,state,false); }
                    catch(Exception e) { System.err.println("FoxSwingAgentV2 late receipt error: "+shortMessage(e)); }
                },"FoxSwingAgentV2-LateReceipt"); late.setDaemon(true); late.start();
            }
        }
        void writePublication(Task task,Map<String,Object> response,String state,boolean updateResult) throws Exception {
            synchronized(task) {
                if(state.equals("executing") && task.state.get()!=1)return; // Never let an old timeout replace a terminal receipt.
                atomic(task.receipt,map("id",task.id,"hash",task.hash,"runId",runId,"state",state,"response",response));
                if(updateResult)synchronized(publicationLock) { if(task.id.equals(latestId))atomic(resultFile,response); }
                if(state.equals("completed") || state.equals("canceled"))tasks.remove(task.id,task);
            }
        }
        void expire() {
            for(Task task:tasks.values()) synchronized(task) { if(System.nanoTime()>task.deadline && !task.reportedTimeout) {
                task.reportedTimeout=true;
                if(task.state.compareAndSet(0,3))publish(task,map("ok",false,"id",task.id,"status","canceled","outcome","notExecuted","error","EDT did not start before deadline."),"canceled");
                else if(task.state.get()==1)publish(task,map("ok",false,"id",task.id,"status","executing","outcome","unknown","error","UI call is still running; no retry or cancellation was attempted."),"executing");
            } }
        }
        void failIo(Exception e) {
            synchronized(admissionLock) { active=false; }
            System.err.println("FoxSwingAgentV2 IO error: "+e.getClass().getName()+": "+shortMessage(e));
            try { atomic(directory.resolve("fault.json"),map("errorType",e.getClass().getName(),"error",shortMessage(e))); } catch(Exception ignored) {}
            try { atomic(readyFile,map("active",false,"pid",pid,"runId",runId,"errorType",e.getClass().getName(),"error",shortMessage(e))); } catch(Exception ignored) {}
        }
        String windowId(Window window) { return windowIds.computeIfAbsent(window,w -> "w"+nextWindow++); }
        String nodeId(Component node) { return nodeIds.computeIfAbsent(node,c -> "n"+nextNode++); }
        List<Object> windows() {
            List<Object> rows=new ArrayList<>();
            for(Window window:Window.getWindows())if(window.isDisplayable())rows.add(map("windowId",windowId(window),"windowTitle",title(window),"windowBounds",rectangle(window.getBounds()),"visible",window.isVisible(),"showing",window.isShowing(),"modal",window instanceof Dialog && ((Dialog)window).isModal()));
            return rows;
        }
        Window resolveWindow(Map<String,Object> request) {
            String id=string(request,"windowId"), expected=string(request,"windowTitle");
            for(Window window:Window.getWindows())if(window.isDisplayable() && id.equals(windowId(window))) {
                if(!expected.equals(title(window)))throw new IllegalStateException("Window title changed.");
                if(request.containsKey("windowBounds") && !Json.write(rectangle(window.getBounds())).equals(Json.write(request.get("windowBounds"))))throw new IllegalStateException("Window bounds changed.");
                return window;
            }
            throw new IllegalStateException("Window ID is absent from this JVM/AppContext.");
        }
        Component resolveComponent(Window window,String path) {
            Component current=window;
            if(path.isEmpty())return current;
            if(path.length()>1024)throw new IllegalArgumentException("Component path too long.");
            String[] pieces=path.split("/",-1);
            if(pieces.length>64)throw new IllegalArgumentException("Component path too deep.");
            for(String piece:pieces) {
                if(piece.length()<2)throw new IllegalArgumentException("Use cN Container children or mN JMenu items.");
                int index=Integer.parseInt(piece.substring(1)); if(index<0)throw new IllegalArgumentException("Negative path index.");
                Component[] children;
                if(piece.charAt(0)=='c' && current instanceof Container)children=((Container)current).getComponents();
                else if(piece.charAt(0)=='m' && current instanceof JMenu)children=((JMenu)current).getMenuComponents();
                else throw new IllegalArgumentException("Path edge is unsupported for this component.");
                if(index>=children.length)throw new IllegalStateException("Component path no longer exists."); current=children[index];
            }
            return current;
        }
        void guard(Component node,Map<String,Object> request) {
            Map<String,Object> expect=object(request.get("expect"));
            if(!string(expect,"nodeId").equals(nodeId(node)) || !string(expect,"name").equals(name(node)) || !string(expect,"role").equals(role(node)))throw new IllegalStateException("Component identity/name/role changed; no mutation attempted.");
            if(!Json.write(rectangle(node.getBounds())).equals(Json.write(expect.get("bounds"))))throw new IllegalStateException("Component bounds changed; no mutation attempted.");
            if(!node.isEnabled())throw new IllegalStateException("Component is disabled.");
        }
        Map<String,Object> record(Component node,String path) {
            AccessibleContext ac=node.getAccessibleContext();
            AccessibleValue value=ac==null?null:ac.getAccessibleValue();
            AccessibleEditableText editable=ac==null?null:ac.getAccessibleEditableText();
            Object screen=null; if(node.isShowing())try { Point p=node.getLocationOnScreen(); screen=Arrays.asList(p.x,p.y,node.getWidth(),node.getHeight()); }catch(java.awt.IllegalComponentStateException ignored){}
            return map("path",path,"nodeId",nodeId(node),"name",name(node),"role",role(node),"bounds",rectangle(node.getBounds()),"screenBounds",screen,
                "enabled",node.isEnabled(),"visible",node.isVisible(),"showing",node.isShowing(),"focusable",node.isFocusable(),"focusOwner",node.isFocusOwner(),
                "mouseListenerCount",node.getMouseListeners().length,"mouseMotionListenerCount",node.getMouseMotionListeners().length,"mouseWheelListenerCount",node.getMouseWheelListeners().length,"keyListenerCount",node.getKeyListeners().length,
                "states",ac==null || ac.getAccessibleStateSet()==null?null:ac.getAccessibleStateSet().toString(),"actions",actions(node),"editableText",editable!=null && !AccessibleRole.PASSWORD_TEXT.equals(ac.getAccessibleRole()),
                "text",text(node),"value",value==null?null:value.getCurrentAccessibleValue(),"minimum",value==null?null:value.getMinimumAccessibleValue(),"maximum",value==null?null:value.getMaximumAccessibleValue());
        }
        void walk(Component node,String path,int depth,int maxDepth,int maxNodes,List<Object> rows) {
            if(rows.size()>=maxNodes)return; rows.add(record(node,path)); if(depth>=maxDepth)return;
            if(node instanceof Container) {
                Component[] children=((Container)node).getComponents();
                for(int i=0;i<children.length && rows.size()<maxNodes;i++)walk(children[i],path.isEmpty()?"c"+i:path+"/c"+i,depth+1,maxDepth,maxNodes,rows);
            }
            if(node instanceof JMenu) {
                Component[] items=((JMenu)node).getMenuComponents();
                for(int i=0;i<items.length && rows.size()<maxNodes;i++)walk(items[i],path.isEmpty()?"m"+i:path+"/m"+i,depth+1,maxDepth,maxNodes,rows);
            }
        }
        Object gui(Map<String,Object> request) {
            String op=string(request,"op"); if(op.equals("windows"))return windows();
            Window window=resolveWindow(request); String path=string(request,"path"); Component node=resolveComponent(window,path);
            if(op.equals("tree")) {
                int depth=bounded(request,"maxDepth",24,0,64),limit=bounded(request,"maxNodes",1500,1,5000); List<Object> rows=new ArrayList<>();
                walk(node,path,0,depth,limit,rows); return map("windowId",windowId(window),"windowTitle",title(window),"windowBounds",rectangle(window.getBounds()),"nodes",rows,"limitReached",rows.size()>=limit);
            }
            guard(node,request);
            AccessibleContext ac=node.getAccessibleContext();
            if(op.equals("asyncAction")) {
                String requested=string(request,"action"); AccessibleAction action=ac==null?null:ac.getAccessibleAction(); int found=-1;
                if(action!=null)for(int i=0;i<Math.min(action.getAccessibleActionCount(),256);i++)if(requested.equals(action.getAccessibleActionDescription(i))) { if(found!=-1)throw new IllegalStateException("Action name is ambiguous."); found=i; }
                if(found<0)throw new IllegalArgumentException("Exact requested AccessibleAction is absent.");
                boolean accepted=action.doAccessibleAction(found); // May remain inside a modal loop. File worker stays free.
                return map("accepted",accepted,"action",requested,"node",record(node,path));
            }
            if(op.equals("setText")) {
                String contents=string(request,"text"); if(contents.length()>4096 || contents.indexOf('\0')>=0)throw new IllegalArgumentException("Text length 0..4096, no NUL.");
                AccessibleEditableText editable=ac==null?null:ac.getAccessibleEditableText();
                if(editable==null || AccessibleRole.PASSWORD_TEXT.equals(ac.getAccessibleRole()))throw new IllegalArgumentException("Requires non-password AccessibleEditableText.");
                editable.setTextContents(contents); String readback=text(node);
                return map("setterReturned",true,"matches",readback!=null && contents.equals(readback),"text",readback,"node",record(node,path));
            }
            if(op.equals("setValue")) {
                AccessibleValue value=ac==null?null:ac.getAccessibleValue();
                if(value==null)throw new IllegalArgumentException("Requires public AccessibleValue.");
                Number before=value.getCurrentAccessibleValue(),minimum=value.getMinimumAccessibleValue(),maximum=value.getMaximumAccessibleValue();
                BigDecimal wanted=number(request,"value"),expected=number(request,"expectCurrent");
                BigDecimal low=decimal(minimum),high=decimal(maximum);
                if(decimal(before).compareTo(expected)!=0)throw new IllegalStateException("AccessibleValue changed from expectCurrent; no mutation attempted.");
                if(low.compareTo(high)>0 || wanted.compareTo(low)<0 || wanted.compareTo(high)>0)throw new IllegalArgumentException("Requested value is outside the control's current min/max.");
                Number converted=convertValue(wanted,before);
                boolean accepted=value.setCurrentAccessibleValue(converted);
                Number after=value.getCurrentAccessibleValue();
                return map("accepted",accepted,"matches",after!=null && decimal(after).compareTo(wanted)==0,"before",before,"requested",wanted,"converted",converted,"readback",after,"minimum",minimum,"maximum",maximum,"node",record(node,path));
            }
            if(op.equals("click")) {
                if(!node.isShowing() || node.getWidth()<1 || node.getHeight()<1)throw new IllegalStateException("Click requires a showing nonempty component.");
                int count=bounded(request,"clickCount",1,1,2),x=bounded(request,"x",node.getWidth()/2,0,node.getWidth()-1),y=bounded(request,"y",node.getHeight()/2,0,node.getHeight()-1);
                long when=System.currentTimeMillis();
                for(int i=1;i<=count;i++) {
                    node.dispatchEvent(new MouseEvent(node,MouseEvent.MOUSE_PRESSED,when++,InputEvent.BUTTON1_DOWN_MASK,x,y,i,false,MouseEvent.BUTTON1));
                    node.dispatchEvent(new MouseEvent(node,MouseEvent.MOUSE_RELEASED,when++,0,x,y,i,false,MouseEvent.BUTTON1));
                    node.dispatchEvent(new MouseEvent(node,MouseEvent.MOUSE_CLICKED,when++,0,x,y,i,false,MouseEvent.BUTTON1));
                }
                return map("dispatched",true,"clickCount",count,"x",x,"y",y,"editingConfirmed",false,"node",record(node,path));
            }
            throw new IllegalArgumentException("Unknown op: use windows, tree, asyncAction, setText, setValue, click, status, quit.");
        }
    }
    private static String hex(byte[] bytes) { StringBuilder text=new StringBuilder(); for(byte value:bytes)text.append(String.format(Locale.ROOT,"%02x",value&255)); return text.toString(); }

    /** Dependency-free, bounded JSON for the private IPC protocol, not a general application serializer. */
    private static final class Json {
        final String input; int pos,values;
        Json(String input) { this.input=input; }
        static Object parse(String text) { Json parser=new Json(text); Object value=parser.value(0); parser.space(); if(parser.pos!=text.length())throw new IllegalArgumentException("Trailing JSON input."); return value; }
        void space() { while(pos<input.length() && Character.isWhitespace(input.charAt(pos)))pos++; }
        char take() { if(pos>=input.length())throw new IllegalArgumentException("Unexpected end of JSON."); return input.charAt(pos++); }
        Object value(int depth) {
            if(depth>16 || ++values>500000)throw new IllegalArgumentException("JSON nesting/value bound exceeded."); space(); char c=take();
            if(c=='"')return quoted();
            if(c=='{') { Map<String,Object> out=new LinkedHashMap<>(); space(); if(pos<input.length()&&input.charAt(pos)=='}'){pos++;return out;} while(true){space();if(take()!='"')throw new IllegalArgumentException("JSON object key required.");String key=quoted();space();if(take()!=':')throw new IllegalArgumentException("JSON colon required.");if(out.containsKey(key))throw new IllegalArgumentException("Duplicate JSON key.");out.put(key,value(depth+1));space();char end=take();if(end=='}')return out;if(end!=',')throw new IllegalArgumentException("JSON comma required.");} }
            if(c=='[') { List<Object> out=new ArrayList<>();space();if(pos<input.length()&&input.charAt(pos)==']'){pos++;return out;}while(true){out.add(value(depth+1));space();char end=take();if(end==']')return out;if(end!=',')throw new IllegalArgumentException("JSON comma required.");} }
            if(c=='t'){literal("rue");return true;} if(c=='f'){literal("alse");return false;} if(c=='n'){literal("ull");return null;}
            if(c=='-' || c>='0' && c<='9') { int start=pos-1;while(pos<input.length() && "0123456789eE+-.".indexOf(input.charAt(pos))>=0)pos++;String number=input.substring(start,pos);if(!number.matches("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?"))throw new IllegalArgumentException("Invalid JSON number.");return new BigDecimal(number); }
            throw new IllegalArgumentException("Invalid JSON token.");
        }
        void literal(String suffix) { for(int i=0;i<suffix.length();i++)if(take()!=suffix.charAt(i))throw new IllegalArgumentException("Invalid JSON literal."); }
        String quoted() {
            StringBuilder out=new StringBuilder();while(true){char c=take();if(c=='"')return out.toString();if(c<32)throw new IllegalArgumentException("JSON control character.");if(c=='\\'){char escape=take();switch(escape){case '"':case '\\':case '/':out.append(escape);break;case 'b':out.append('\b');break;case 'f':out.append('\f');break;case 'n':out.append('\n');break;case 'r':out.append('\r');break;case 't':out.append('\t');break;case 'u':int code=0;for(int i=0;i<4;i++){int digit=Character.digit(take(),16);if(digit<0)throw new IllegalArgumentException("Invalid Unicode escape.");code=code*16+digit;}out.append((char)code);break;default:throw new IllegalArgumentException("Invalid JSON escape.");}}else out.append(c);if(out.length()>65536)throw new IllegalArgumentException("JSON string too long.");}
        }
        static String write(Object value) { StringBuilder out=new StringBuilder();emit(value,out,0);return out.toString(); }
        static void emit(Object value,StringBuilder out,int depth) {
            if(depth>32)throw new IllegalArgumentException("Output nesting bound exceeded.");
            if(value==null){out.append("null");return;}if(value instanceof Boolean){out.append(value);return;}
            if(value instanceof Number){String raw=value.toString();out.append(raw.equals("NaN")||raw.contains("Infinity")?"null":raw);return;}
            if(value instanceof String){out.append('"');for(char c:((String)value).toCharArray())switch(c){case '"':out.append("\\\"");break;case '\\':out.append("\\\\");break;case '\n':out.append("\\n");break;case '\r':out.append("\\r");break;case '\t':out.append("\\t");break;default:if(c<32)out.append(String.format(Locale.ROOT,"\\u%04x",(int)c));else out.append(c);}out.append('"');return;}
            if(value instanceof Map){out.append('{');boolean comma=false;for(Map.Entry<?,?> item:((Map<?,?>)value).entrySet()){if(comma)out.append(',');comma=true;emit(item.getKey().toString(),out,depth+1);out.append(':');emit(item.getValue(),out,depth+1);}out.append('}');return;}
            if(value instanceof Iterable){out.append('[');boolean comma=false;for(Object item:(Iterable<?>)value){if(comma)out.append(',');comma=true;emit(item,out,depth+1);}out.append(']');return;}
            throw new IllegalArgumentException("Unsupported public value in JSON output.");
        }
    }
}
