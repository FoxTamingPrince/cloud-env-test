import com.sun.tools.attach.VirtualMachine;

import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Locale;
import java.util.Properties;

/**
 * Java 17 external launcher using only public Attach and ProcessHandle APIs.
 *
 * Usage (five arguments):
 *   FoxAttach expectedPid expectedJavaHome expectedProcessCommand absoluteAgentJar absoluteConfigPath
 *
 * Paths must be absolute. Identity comparisons normalize path components and
 * ignore path case only on Windows; they do not resolve aliases or symlinks.
 * A normally returned loadAgent call means the bootstrap request was submitted.
 * Consult the agent's result receipt for completion of the requested operation.
 */
public final class FoxAttach {
    private static final boolean WINDOWS = System.getProperty("os.name", "")
            .toLowerCase(Locale.ROOT).startsWith("windows");

    private FoxAttach() { }

    public static void main(String[] args) {
        try {
            submit(args);
        } catch (ValidationFailure failure) {
            System.err.println("Attach request rejected: " + failure.getMessage());
            System.exit(2);
        } catch (Exception failure) {
            // Bounded actual diagnostics; no whole property set, command line,
            // environment, credential data, or stack trace is printed.
            String detail = failure.getMessage();
            if (detail == null) detail = "";
            detail = detail.substring(0, Math.min(detail.length(), 2048)).replace('\r', ' ').replace('\n', ' ');
            System.err.println("Attach request failed (" + failure.getClass().getSimpleName() + "): " + detail);
            System.exit(3);
        }
    }

    private static void submit(String[] args) throws Exception {
        require(args.length == 5, "Expected exactly five arguments.");
        long pid;
        try {
            pid = Long.parseLong(args[0]);
        } catch (NumberFormatException failure) {
            throw new ValidationFailure("Expected PID must be a positive integer.");
        }
        require(pid > 0 && pid != ProcessHandle.current().pid(),
                "Expected PID must identify a separate, positive target process.");

        Path expectedJavaHome = absolutePath(args[1], "Expected Java home");
        Path expectedCommand = absolutePath(args[2], "Expected process command");
        Path agentJar = absoluteRegularFile(args[3], "Agent JAR");
        Path configPath = absoluteRegularFile(args[4], "Config JSON");
        require(Files.isDirectory(expectedJavaHome), "Expected Java home is not an existing directory.");
        require(Files.isRegularFile(expectedCommand), "Expected process command is not an existing regular file.");

        Instant beforeAttach = verifyTarget(pid, expectedCommand, null);
        VirtualMachine target = VirtualMachine.attach(Long.toString(pid));
        try {
            verifyTarget(pid, expectedCommand, beforeAttach);
            Properties properties = target.getSystemProperties();
            String actualJavaHome = properties.getProperty("java.home");
            require(actualJavaHome != null, "Target did not supply java.home.");
            Path targetJavaHome = absolutePath(actualJavaHome, "Target Java home");
            require(samePath(expectedJavaHome, targetJavaHome), "Target java.home does not match the expected Java home.");

            // Recheck identity and file existence immediately before loading.
            verifyTarget(pid, expectedCommand, beforeAttach);
            require(Files.isRegularFile(agentJar), "Agent JAR is no longer an existing regular file.");
            require(Files.isRegularFile(configPath), "Config JSON is no longer an existing regular file.");
            target.loadAgent(agentJar.toString(), configPath.toString());
            System.out.println("attachedPID=" + pid);
            System.out.println("javaHome=" + targetJavaHome);
            System.out.println("request submitted");
        } finally {
            // Always release the public Attach connection, including failures.
            target.detach();
        }
    }

    private static Instant verifyTarget(long pid, Path expectedCommand, Instant expectedStart) {
        ProcessHandle process = ProcessHandle.of(pid)
                .orElseThrow(() -> new ValidationFailure("Target PID does not exist."));
        require(process.isAlive(), "Target process is not alive.");
        ProcessHandle.Info info = process.info();
        String command = info.command()
                .orElseThrow(() -> new ValidationFailure("Target process command is unavailable."));
        Instant start = info.startInstant()
                .orElseThrow(() -> new ValidationFailure("Target process start time is unavailable."));
        require(samePath(expectedCommand, absolutePath(command, "Target process command")),
                "Target process command does not match the expected command.");
        require(expectedStart == null || expectedStart.equals(start),
                "Target process start time changed during attach.");
        require(process.isAlive(), "Target process exited during identity validation.");
        return start;
    }

    private static Path absoluteRegularFile(String value, String label) {
        Path path = absolutePath(value, label);
        require(Files.isRegularFile(path), label + " must be an existing regular file.");
        return path;
    }

    private static Path absolutePath(String value, String label) {
        require(value != null && !value.isBlank(), label + " is missing.");
        try {
            Path path = Path.of(value);
            require(path.isAbsolute(), label + " must be absolute.");
            return path.normalize();
        } catch (InvalidPathException failure) {
            throw new ValidationFailure(label + " is not a valid path.");
        }
    }

    private static boolean samePath(Path expected, Path actual) {
        String expectedText = expected.normalize().toString();
        String actualText = actual.normalize().toString();
        return WINDOWS ? expectedText.equalsIgnoreCase(actualText) : expectedText.equals(actualText);
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new ValidationFailure(message);
        }
    }

    private static final class ValidationFailure extends RuntimeException {
        private ValidationFailure(String message) {
            super(message);
        }
    }
}
