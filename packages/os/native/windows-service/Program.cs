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
            start.EnvironmentVariables["HOME"] = Directory.GetParent(settings.ConsueloHome).FullName;
            start.EnvironmentVariables["USERPROFILE"] = Directory.GetParent(settings.ConsueloHome).FullName;
            start.EnvironmentVariables["BUN_BIN"] = settings.BunExecutable;
            start.EnvironmentVariables["PATH"] = Path.GetDirectoryName(settings.BunExecutable) + ";" + start.EnvironmentVariables["PATH"];

            child = new Process { StartInfo = start, EnableRaisingEvents = true };
            child.OutputDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
            {
                if (eventArgs.Data != null) WriteLine(output, eventArgs.Data);
            };
            child.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
            {
                if (eventArgs.Data != null) WriteLine(errors, eventArgs.Data);
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
            job = CreateKillOnCloseJob();
            if (!AssignProcessToJobObject(job, child.Handle))
            {
                throw new InvalidOperationException("Bun runtime process could not join its Windows Job Object");
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
                if (!child.WaitForExit(10000))
                {
                    try { child.Kill(); } catch (InvalidOperationException) { }
                }
                child.Dispose();
                child = null;
            }
            if (output != null) { output.Dispose(); output = null; }
            if (errors != null) { errors.Dispose(); errors = null; }
        }

        private static StreamWriter OpenLog(string path)
        {
            return new StreamWriter(new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite), new UTF8Encoding(false))
            {
                AutoFlush = true,
            };
        }

        private static void WriteLine(StreamWriter writer, string line)
        {
            lock (writer)
            {
                writer.WriteLine(DateTimeOffset.UtcNow.ToString("O") + " " + line);
            }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

        private static IntPtr CreateKillOnCloseJob()
        {
            var handle = CreateJobObject(IntPtr.Zero, null);
            if (handle == IntPtr.Zero) throw new InvalidOperationException("Windows Job Object creation failed");
            var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
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
        private static int Main(string[] args)
        {
            try
            {
                var configPath = ReadArgument(args, "--config");
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
    }
}
