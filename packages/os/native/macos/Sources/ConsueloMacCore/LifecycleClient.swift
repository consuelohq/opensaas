import Foundation

public protocol LifecycleTransport: Sendable {
    func request(_ request: LifecycleRequest) async throws -> LifecycleResponse
    func subscribe(_ listener: @escaping @Sendable (LifecycleSnapshot) -> Void) -> LifecycleSubscription
}

public final class LifecycleSubscription: @unchecked Sendable {
    private let lock = NSLock()
    private var cancellation: (() -> Void)?

    public init(_ cancellation: @escaping () -> Void) {
        self.cancellation = cancellation
    }

    public func cancel() {
        let action = lock.withLock { () -> (() -> Void)? in
            defer { cancellation = nil }
            return cancellation
        }
        action?()
    }

    deinit { cancel() }
}

public final class LifecycleClient: @unchecked Sendable {
    private let transport: any LifecycleTransport
    private let lock = NSLock()
    private var snapshot: LifecycleSnapshot?
    private var subscription: LifecycleSubscription?

    public init(transport: any LifecycleTransport, initialSnapshot: LifecycleSnapshot? = nil) {
        self.transport = transport
        snapshot = initialSnapshot
    }

    @discardableResult
    public func connect(_ listener: @escaping @Sendable (LifecycleSnapshot) -> Void) -> LifecycleSubscription {
        closeShell()
        let next = transport.subscribe { [weak self] incoming in
            guard let self else { return }
            let accepted = self.lock.withLock { () -> LifecycleSnapshot? in
                if let current = self.snapshot, incoming.sequence < current.sequence { return nil }
                self.snapshot = incoming
                return incoming
            }
            if let accepted { listener(accepted) }
        }
        lock.withLock { subscription = next }
        return next
    }

    public func closeShell() {
        let current = lock.withLock { () -> LifecycleSubscription? in
            defer { subscription = nil }
            return subscription
        }
        current?.cancel()
    }

    public func current() -> LifecycleSnapshot? {
        lock.withLock { snapshot }
    }

    @discardableResult
    public func refresh() async throws -> LifecycleSnapshot {
        do {
            let response = try await transport.request(.statusGet)
            guard case let .snapshot(incoming) = response else {
                throw LifecycleClientError.unexpectedResponse("status.get")
            }
            return lock.withLock {
                if let current = snapshot, incoming.sequence < current.sequence { return current }
                snapshot = incoming
                return incoming
            }
        } catch {
            if let retained = lock.withLock({ snapshot }) {
                var offline = retained
                offline.runtime.state = .offline
                offline.connection = .init(state: .offline, reason: String(describing: error))
                lock.withLock { snapshot = offline }
                return offline
            }
            throw error
        }
    }

    @discardableResult
    public func send(_ request: LifecycleRequest) async throws -> LifecycleOperationAccepted {
        let response = try await transport.request(request)
        guard case let .accepted(accepted) = response else {
            throw LifecycleClientError.unexpectedResponse(String(describing: request))
        }
        return accepted
    }
}

public enum LifecycleClientError: Error, Equatable {
    case unexpectedResponse(String)
}
