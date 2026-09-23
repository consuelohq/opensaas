import Darwin
import Dispatch
import Foundation

private enum ServiceHostError: Error, CustomStringConvertible {
    case invalidArguments
    case missingRuntime(String)

    var description: String {
        switch self {
        case .invalidArguments:
            return "usage: ConsueloServiceHost --runtime-root <absolute-path>"
        case let .missingRuntime(path):
            return "Consuelo runtime entrypoint is missing: \(path)"
        }
    }
}

private func runtimeRoot(from arguments: [String]) throws -> URL {
    guard arguments.count == 3, arguments[1] == "--runtime-root" else {
        throw ServiceHostError.invalidArguments
    }
    let raw = arguments[2]
    guard raw.hasPrefix("/") else {
        throw ServiceHostError.invalidArguments
    }
    return URL(fileURLWithPath: raw, isDirectory: true).standardizedFileURL
}

private func run() throws -> Int32 {
    let runtimeRoot = try runtimeRoot(from: CommandLine.arguments)
    let entrypoint = runtimeRoot.appendingPathComponent("scripts/start-consuelo-daemon.sh")
    guard FileManager.default.isExecutableFile(atPath: entrypoint.path) else {
        throw ServiceHostError.missingRuntime(entrypoint.path)
    }

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/bin/bash")
    process.arguments = [entrypoint.path]
    process.currentDirectoryURL = runtimeRoot
    process.environment = ProcessInfo.processInfo.environment

    signal(SIGTERM, SIG_IGN)
    signal(SIGINT, SIG_IGN)
    let signalQueue = DispatchQueue(label: "com.consuelohq.os.service-host.signals")
    let terminationSignals = [SIGTERM, SIGINT].map { signalNumber -> DispatchSourceSignal in
        let source = DispatchSource.makeSignalSource(signal: signalNumber, queue: signalQueue)
        source.setEventHandler {
            if process.isRunning {
                process.terminate()
            }
        }
        source.resume()
        return source
    }
    _ = terminationSignals

    try process.run()
    process.waitUntilExit()
    if process.terminationReason == .uncaughtSignal {
        return 128 + process.terminationStatus
    }
    return process.terminationStatus
}

do {
    Darwin.exit(try run())
} catch {
    FileHandle.standardError.write(Data(("ConsueloServiceHost: \(error)\n").utf8))
    Darwin.exit(1)
}
