import Darwin
import Foundation

public enum UnixSocketLifecycleError: Error, CustomStringConvertible, Equatable {
    case invalidPath(String)
    case openFailed(Int32)
    case connectFailed(Int32)
    case writeFailed(Int32)
    case readFailed(Int32)
    case connectionClosed
    case endpointNotSocket(String)
    case endpointOwnerMismatch(expected: UInt32, actual: UInt32)
    case endpointPermissionsTooBroad(UInt16)

    public var description: String {
        switch self {
        case let .invalidPath(path): "Lifecycle socket path is invalid or too long: \(path)"
        case let .openFailed(code): "Unable to open lifecycle socket (errno \(code))."
        case let .connectFailed(code): "Unable to connect to lifecycle socket (errno \(code))."
        case let .writeFailed(code): "Unable to write lifecycle request (errno \(code))."
        case let .readFailed(code): "Unable to read lifecycle response (errno \(code))."
        case .connectionClosed: "The lifecycle socket closed before a complete response arrived."
        case let .endpointNotSocket(path): "The lifecycle endpoint is not an owner-local Unix socket: \(path)"
        case let .endpointOwnerMismatch(expected, actual): "The lifecycle socket owner does not match the current user (expected \(expected), received \(actual))."
        case let .endpointPermissionsTooBroad(mode): "The lifecycle socket grants group or world access (mode \(String(mode, radix: 8)))."
        }
    }
}

public final class UnixSocketLifecycleTransport: LifecycleTransport, @unchecked Sendable {
    public static var defaultSocketPath: String {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".consuelo/run/lifecycle.sock", isDirectory: false)
            .path
    }

    private let socketPath: String
    private let pollIntervalNanoseconds: UInt64
    private let snapshotLock = NSLock()
    private var lastSnapshot: LifecycleSnapshot?

    public init(socketPath: String = UnixSocketLifecycleTransport.defaultSocketPath, pollIntervalSeconds: Double = 2) {
        self.socketPath = socketPath
        pollIntervalNanoseconds = UInt64(max(0.25, pollIntervalSeconds) * 1_000_000_000)
    }

    public func request(_ request: LifecycleRequest) async throws -> LifecycleResponse {
        let socketPath = socketPath
        return try await Task.detached(priority: .userInitiated) {
            let descriptor = try Self.connect(to: socketPath)
            defer { Darwin.close(descriptor) }

            let payload = try JSONEncoder().encode(request)
            try Self.writeAll(try FramedJSONCodec.frame(payload), to: descriptor)
            let response = try Self.readFrame(from: descriptor)
            try SafeWorkspaceDecoder.validateNoSensitiveFields(response)
            let decoded = try JSONDecoder().decode(LifecycleResponse.self, from: response)
            if case let .snapshot(snapshot) = decoded {
                self.snapshotLock.withLock { self.lastSnapshot = snapshot }
            }
            return decoded
        }.value
    }

    public func subscribe(_ listener: @escaping @Sendable (LifecycleSnapshot) -> Void) -> LifecycleSubscription {
        let task = Task.detached(priority: .utility) { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                do {
                    if case let .snapshot(snapshot) = try await self.request(.statusGet) {
                        listener(snapshot)
                    }
                } catch {
                    if let retained = self.offlineSnapshot(reason: String(describing: error)) {
                        listener(retained)
                    }
                }
                do {
                    try await Task.sleep(nanoseconds: self.pollIntervalNanoseconds)
                } catch {
                    return
                }
            }
        }
        return LifecycleSubscription { task.cancel() }
    }

    private func offlineSnapshot(reason: String) -> LifecycleSnapshot? {
        snapshotLock.withLock {
            guard var retained = lastSnapshot else { return nil }
            retained.runtime.state = .offline
            retained.connection = .init(state: .offline, reason: reason)
            lastSnapshot = retained
            return retained
        }
    }

    private static func connect(to path: String) throws -> Int32 {
        try validateEndpoint(path)
        let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else { throw UnixSocketLifecycleError.openFailed(errno) }

        var address = sockaddr_un()
        let pathBytes = Array(path.utf8) + [0]
        let maximumPathLength = MemoryLayout.size(ofValue: address.sun_path)
        guard pathBytes.count <= maximumPathLength else {
            Darwin.close(descriptor)
            throw UnixSocketLifecycleError.invalidPath(path)
        }

        let pathOffset = MemoryLayout<sockaddr_un>.offset(of: \.sun_path) ?? 2
        let addressLength = pathOffset + pathBytes.count
        address.sun_len = UInt8(addressLength)
        address.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutableBytes(of: &address) { destination in
            pathBytes.withUnsafeBytes { source in
                guard let sourceAddress = source.baseAddress,
                      let destinationAddress = destination.baseAddress else { return }
                destinationAddress
                    .advanced(by: pathOffset)
                    .copyMemory(from: sourceAddress, byteCount: pathBytes.count)
            }
        }

        let result = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
                Darwin.connect(descriptor, socketAddress, socklen_t(addressLength))
            }
        }
        guard result == 0 else {
            let code = errno
            Darwin.close(descriptor)
            throw UnixSocketLifecycleError.connectFailed(code)
        }
        return descriptor
    }

    public static func validateEndpoint(_ path: String) throws {
        var metadata = stat()
        guard Darwin.lstat(path, &metadata) == 0 else {
            throw UnixSocketLifecycleError.connectFailed(errno)
        }
        guard metadata.st_mode & S_IFMT == S_IFSOCK else {
            throw UnixSocketLifecycleError.endpointNotSocket(path)
        }
        let expectedOwner = geteuid()
        guard metadata.st_uid == expectedOwner else {
            throw UnixSocketLifecycleError.endpointOwnerMismatch(
                expected: expectedOwner,
                actual: metadata.st_uid
            )
        }
        let permissions = UInt16(metadata.st_mode & 0o777)
        guard permissions & 0o077 == 0 else {
            throw UnixSocketLifecycleError.endpointPermissionsTooBroad(permissions)
        }
    }

    private static func writeAll(_ data: Data, to descriptor: Int32) throws {
        try data.withUnsafeBytes { rawBuffer in
            guard let baseAddress = rawBuffer.baseAddress else { return }
            var offset = 0
            while offset < rawBuffer.count {
                let written = Darwin.write(descriptor, baseAddress.advanced(by: offset), rawBuffer.count - offset)
                if written < 0 {
                    if errno == EINTR { continue }
                    throw UnixSocketLifecycleError.writeFailed(errno)
                }
                guard written > 0 else { throw UnixSocketLifecycleError.connectionClosed }
                offset += written
            }
        }
    }

    private static func readFrame(from descriptor: Int32) throws -> Data {
        let header = try readExactly(4, from: descriptor)
        let length = header.withUnsafeBytes { rawBuffer in
            rawBuffer.loadUnaligned(as: UInt32.self).bigEndian
        }
        guard Int(length) <= FramedJSONCodec.maximumPayloadBytes else {
            throw FramedJSONError.invalidLength(Int(length))
        }
        return try readExactly(Int(length), from: descriptor)
    }

    private static func readExactly(_ byteCount: Int, from descriptor: Int32) throws -> Data {
        if byteCount == 0 { return Data() }
        var output = Data(count: byteCount)
        try output.withUnsafeMutableBytes { rawBuffer in
            guard let baseAddress = rawBuffer.baseAddress else { return }
            var offset = 0
            while offset < byteCount {
                let received = Darwin.read(descriptor, baseAddress.advanced(by: offset), byteCount - offset)
                if received < 0 {
                    if errno == EINTR { continue }
                    throw UnixSocketLifecycleError.readFailed(errno)
                }
                guard received > 0 else { throw UnixSocketLifecycleError.connectionClosed }
                offset += received
            }
        }
        return output
    }
}
