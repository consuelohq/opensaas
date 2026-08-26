using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Text;
using System.Web.Script.Serialization;

namespace Consuelo.Windows.Service
{
    internal sealed class RuntimeSettings
    {
        public string BunExecutable { get; private set; }
        public string ConsueloHome { get; private set; }
        public string RuntimeCurrent { get; private set; }
        public string Entrypoint { get; private set; }
        public string Logs { get; private set; }

        public static RuntimeSettings Load(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !Path.IsPathRooted(path) || !File.Exists(path))
            {
                throw new InvalidOperationException("Windows service configuration is missing");
            }

            var serializer = new JavaScriptSerializer();
            var values = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(path));
            if (values == null || !values.ContainsKey("schemaVersion") || Convert.ToInt32(values["schemaVersion"]) != 1)
            {
                throw new InvalidOperationException("Windows service configuration schema is unsupported");
            }

            var settings = new RuntimeSettings
            {
                BunExecutable = RequiredPath(values, "bunExecutable", true),
                ConsueloHome = RequiredPath(values, "consueloHome", false),
                RuntimeCurrent = RequiredPath(values, "runtimeCurrent", false),
                Entrypoint = RequiredText(values, "entrypoint"),
                Logs = RequiredPath(values, "logs", false),
            };

            if (!File.Exists(settings.BunExecutable))
            {
                throw new InvalidOperationException("Persisted Bun executable is missing");
            }
            if (!Directory.Exists(settings.RuntimeCurrent))
            {
                throw new InvalidOperationException("Active Consuelo runtime is missing");
            }

            var entryPath = Path.GetFullPath(Path.Combine(settings.RuntimeCurrent, settings.Entrypoint));
            if (!entryPath.StartsWith(settings.RuntimeCurrent + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                || !File.Exists(entryPath))
            {
                throw new InvalidOperationException("Consuelo runtime entrypoint is invalid");
            }
            return settings;
        }

        private static string RequiredPath(Dictionary<string, object> values, string name, bool file)
        {
            var value = RequiredText(values, name);
            if (!Path.IsPathRooted(value))
            {
                throw new InvalidOperationException(name + " must be an absolute path");
            }
            var full = Path.GetFullPath(value);
            if (file && Directory.Exists(full))
            {
                throw new InvalidOperationException(name + " must identify a file");
            }
            return full.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }

        private static string RequiredText(Dictionary<string, object> values, string name)
        {
            object raw;
            if (!values.TryGetValue(name, out raw) || raw == null || string.IsNullOrWhiteSpace(Convert.ToString(raw)))
            {
                throw new InvalidOperationException(name + " is required");
            }
            return Convert.ToString(raw);
        }
    }

    internal sealed class ConsueloService : ServiceBase
    {
        private readonly string configPath;
        private Process child;
        private IntPtr job = IntPtr.Zero;
        private StreamWriter output;
        private StreamWriter errors;
        private bool stopping;
        private readonly object logLock = new object();

        public ConsueloService(string configPath)
        {
            this.configPath = configPath;
            ServiceName = "ConsueloOS";
            AutoLog = true;
            CanStop = true;
            CanShutdown = true;
        }

        protected override void OnStart(string[] args)
        {
            StartRuntime();
        }

        protected override void OnStop()
        {
            StopRuntime();
        }

        protected override void OnShutdown()
        {
            StopRuntime();
            base.OnShutdown();
        }

        public void RunConsole()
        {
            StartRuntime();
            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs eventArgs)
            {
                eventArgs.Cancel = true;
                StopRuntime();
            };
            if (child != null)
            {
                child.WaitForExit();
            }
        }

        private void StartRuntime()
        {
            stopping = false;
            var settings = RuntimeSettings.Load(configPath);
            var homeParent = Directory.GetParent(settings.ConsueloHome);
            if (homeParent == null)
            {
                throw new InvalidOperationException("consueloHome must not be a drive root");
            }
            Directory.CreateDirectory(settings.Logs);
            output = OpenLog(Path.Combine(settings.Logs, "windows-service.out.log"));
            errors = OpenLog(Path.Combine(settings.Logs, "windows-service.err.log"));

            var entryPath = Path.GetFullPath(Path.Combine(settings.RuntimeCurrent, settings.Entrypoint));
            var start = new ProcessStartInfo
            {
                FileName = settings.BunExecutable,
                Arguments = Quote(entryPath),
                WorkingDirectory = settings.RuntimeCurrent,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            start.EnvironmentVariables["CONSUELO_HOME"] = settings.ConsueloHome;
            start.EnvironmentVariables["HOME"] = homeParent.FullName;
            start.EnvironmentVariables["USERPROFILE"] = homeParent.FullName;
            start.EnvironmentVariables["BUN_BIN"] = settings.BunExecutable;
            start.EnvironmentVariables["PATH"] = Path.GetDirectoryName(settings.BunExecutable) + ";" + start.EnvironmentVariables["PATH"];

            child = new Process { StartInfo = start, EnableRaisingEvents = true };
            child.OutputDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
            {
                if (eventArgs.Data != null) WriteLine(false, eventArgs.Data);
            };
            child.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
            {
                if (eventArgs.Data != null) WriteLine(true, eventArgs.Data);
            };
            child.Exited += delegate
            {
                if (!stopping)
                {
                    Environment.Exit(child.ExitCode == 0 ? 1 : child.ExitCode);
                }
            };

            if (!child.Start())
            {
                throw new InvalidOperationException("Bun runtime process did not start");
            }
            child.BeginOutputReadLine();
            child.BeginErrorReadLine();
            try
            {
                job = CreateKillOnCloseJob();
                if (!AssignProcessToJobObject(job, child.Handle))
                {
                    throw new InvalidOperationException("Bun runtime process could not join its Windows Job Object");
                }
            }
            catch
            {
                stopping = true;
                try { child.Kill(); } catch (InvalidOperationException) { }
                StopRuntime();
                throw;
            }
        }

        private void StopRuntime()
        {
            stopping = true;
            if (job != IntPtr.Zero)
            {
                CloseHandle(job);
                job = IntPtr.Zero;
            }
            if (child != null)
            {
                try
                {
                    child.CancelOutputRead();
                    child.CancelErrorRead();
                }
                catch (InvalidOperationException) { }
                if (!child.WaitForExit(10000))
                {
                    try { child.Kill(); } catch (InvalidOperationException) { }
                }
                child.Dispose();
                child = null;
            }
            lock (logLock)
            {
                if (output != null) { output.Dispose(); output = null; }
                if (errors != null) { errors.Dispose(); errors = null; }
            }
        }

        private static StreamWriter OpenLog(string path)
        {
            return new StreamWriter(new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite), new UTF8Encoding(false))
            {
                AutoFlush = true,
            };
        }

        private void WriteLine(bool useErrors, string line)
        {
            lock (logLock)
            {
                var writer = useErrors ? errors : output;
                if (writer == null) return;
                try
                {
                    writer.WriteLine(DateTimeOffset.UtcNow.ToString("O") + " " + line);
                }
                catch (ObjectDisposedException) { }
            }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
        private const uint JOB_OBJECT_LIMIT_BREAKAWAY_OK = 0x00000800;

        private static IntPtr CreateKillOnCloseJob()
        {
            var handle = CreateJobObject(IntPtr.Zero, null);
            if (handle == IntPtr.Zero) throw new InvalidOperationException("Windows Job Object creation failed");
            var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limits.BasicLimitInformation.LimitFlags =
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_BREAKAWAY_OK;
            var length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            var memory = Marshal.AllocHGlobal(length);
            try
            {
                Marshal.StructureToPtr(limits, memory, false);
                if (!SetInformationJobObject(handle, 9, memory, (uint)length))
                {
                    CloseHandle(handle);
                    throw new InvalidOperationException("Windows Job Object configuration failed");
                }
                return handle;
            }
            finally
            {
                Marshal.FreeHGlobal(memory);
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr CreateJobObject(IntPtr attributes, string name);

        [DllImport("kernel32.dll")]
        private static extern bool SetInformationJobObject(IntPtr jobHandle, int infoClass, IntPtr info, uint length);

        [DllImport("kernel32.dll")]
        private static extern bool AssignProcessToJobObject(IntPtr jobHandle, IntPtr processHandle);

        [DllImport("kernel32.dll")]
        private static extern bool CloseHandle(IntPtr handle);
    }

    internal static class Program
    {
        private const uint CREATE_BREAKAWAY_FROM_JOB = 0x01000000;
        private const uint CREATE_NO_WINDOW = 0x08000000;
        private const uint DETACHED_PROCESS = 0x00000008;

        private static int Main(string[] args)
        {
            try
            {
                var configPath = ReadArgument(args, "--config");
                if (HasArgument(args, "--launch-lifecycle"))
                {
                    LaunchLifecycleWorker(configPath, ArgumentsAfter(args, "--launch-lifecycle"));
                    return 0;
                }
                var service = new ConsueloService(configPath);
                if (Environment.UserInteractive && HasArgument(args, "--console"))
                {
                    service.RunConsole();
                }
                else
                {
                    ServiceBase.Run(service);
                }
                return 0;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error.Message);
                return 1;
            }
        }

        private static void LaunchLifecycleWorker(string configPath, string[] lifecycleArguments)
        {
            var settings = RuntimeSettings.Load(configPath);
            ValidateLifecycleArguments(settings, lifecycleArguments);
            var workerPath = Path.GetFullPath(
                Path.Combine(settings.RuntimeCurrent, "scripts", "native-lifecycle-operation.ts")
            );
            if (!workerPath.StartsWith(
                    settings.RuntimeCurrent + Path.DirectorySeparatorChar,
                    StringComparison.OrdinalIgnoreCase)
                || !File.Exists(workerPath))
            {
                throw new InvalidOperationException("Consuelo lifecycle worker entrypoint is invalid");
            }

            var commandLine = new StringBuilder();
            commandLine.Append(QuoteArgument(settings.BunExecutable));
            commandLine.Append(' ');
            commandLine.Append(QuoteArgument(workerPath));
            foreach (var argument in lifecycleArguments)
            {
                commandLine.Append(' ');
                commandLine.Append(QuoteArgument(argument));
            }

            var startup = new STARTUPINFO();
            startup.cb = Marshal.SizeOf(typeof(STARTUPINFO));
            PROCESS_INFORMATION processInformation;
            var created = CreateProcessW(
                settings.BunExecutable,
                commandLine,
                IntPtr.Zero,
                IntPtr.Zero,
                false,
                CREATE_BREAKAWAY_FROM_JOB | CREATE_NO_WINDOW | DETACHED_PROCESS,
                IntPtr.Zero,
                settings.RuntimeCurrent,
                ref startup,
                out processInformation
            );
            if (!created)
            {
                throw new InvalidOperationException(
                    "Consuelo lifecycle worker could not break away from the runtime Job Object (Win32 "
                    + Marshal.GetLastWin32Error()
                    + ")"
                );
            }
            CloseHandle(processInformation.hThread);
            CloseHandle(processInformation.hProcess);
        }

        private static void ValidateLifecycleArguments(
            RuntimeSettings settings,
            string[] lifecycleArguments
        )
        {
            if (lifecycleArguments.Length == 0 || lifecycleArguments.Length % 2 != 0)
            {
                throw new InvalidOperationException(
                    "lifecycle worker arguments must be flag/value pairs"
                );
            }
            var allowed = new HashSet<string>(StringComparer.Ordinal)
            {
                "--home",
                "--operation-id",
                "--kind",
                "--target-version",
                "--channel",
                "--remove-node",
                "--remove-user-content",
            };
            var seen = new HashSet<string>(StringComparer.Ordinal);
            string requestedHome = null;
            string kind = null;
            for (var index = 0; index < lifecycleArguments.Length; index += 2)
            {
                var flag = lifecycleArguments[index];
                var value = lifecycleArguments[index + 1];
                if (!allowed.Contains(flag) || !seen.Add(flag) || string.IsNullOrWhiteSpace(value))
                {
                    throw new InvalidOperationException("unsupported lifecycle worker argument " + flag);
                }
                if (flag == "--home") requestedHome = value;
                if (flag == "--kind") kind = value;
            }
            if (requestedHome == null
                || !string.Equals(
                    Path.GetFullPath(requestedHome).TrimEnd(
                        Path.DirectorySeparatorChar,
                        Path.AltDirectorySeparatorChar
                    ),
                    settings.ConsueloHome,
                    StringComparison.OrdinalIgnoreCase
                ))
            {
                throw new InvalidOperationException(
                    "lifecycle worker home must match the managed Consuelo home"
                );
            }
            if (kind != "update"
                && kind != "rollback"
                && kind != "repair"
                && kind != "restart"
                && kind != "uninstall")
            {
                throw new InvalidOperationException("unsupported lifecycle worker operation kind");
            }
        }

        private static string[] ArgumentsAfter(string[] args, string name)
        {
            for (var index = 0; index < args.Length; index += 1)
            {
                if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase))
                {
                    var result = new string[args.Length - index - 1];
                    Array.Copy(args, index + 1, result, 0, result.Length);
                    return result;
                }
            }
            throw new InvalidOperationException(name + " is required");
        }

        private static string QuoteArgument(string value)
        {
            if (value.Length > 0
                && value.IndexOf(' ') < 0
                && value.IndexOf('\t') < 0
                && value.IndexOf('"') < 0)
            {
                return value;
            }
            var builder = new StringBuilder("\"");
            var backslashes = 0;
            foreach (var character in value)
            {
                if (character == '\\')
                {
                    backslashes += 1;
                    continue;
                }
                if (character == '"')
                {
                    builder.Append('\\', backslashes * 2 + 1);
                    builder.Append('"');
                    backslashes = 0;
                    continue;
                }
                builder.Append('\\', backslashes);
                backslashes = 0;
                builder.Append(character);
            }
            builder.Append('\\', backslashes * 2);
            builder.Append('"');
            return builder.ToString();
        }

        private static string ReadArgument(string[] args, string name)
        {
            for (var index = 0; index < args.Length - 1; index += 1)
            {
                if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase)) return args[index + 1];
            }
            throw new InvalidOperationException(name + " is required");
        }

        private static bool HasArgument(string[] args, string name)
        {
            foreach (var value in args)
            {
                if (string.Equals(value, name, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct STARTUPINFO
        {
            public int cb;
            public string lpReserved;
            public string lpDesktop;
            public string lpTitle;
            public int dwX;
            public int dwY;
            public int dwXSize;
            public int dwYSize;
            public int dwXCountChars;
            public int dwYCountChars;
            public int dwFillAttribute;
            public int dwFlags;
            public short wShowWindow;
            public short cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct PROCESS_INFORMATION
        {
            public IntPtr hProcess;
            public IntPtr hThread;
            public int dwProcessId;
            public int dwThreadId;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool CreateProcessW(
            string applicationName,
            StringBuilder commandLine,
            IntPtr processAttributes,
            IntPtr threadAttributes,
            bool inheritHandles,
            uint creationFlags,
            IntPtr environment,
            string currentDirectory,
            [In] ref STARTUPINFO startupInfo,
            out PROCESS_INFORMATION processInformation
        );

        [DllImport("kernel32.dll")]
        private static extern bool CloseHandle(IntPtr handle);
    }
}
