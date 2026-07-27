import Foundation

public enum ReleaseChannel: String, Codable, CaseIterable, Equatable, Sendable {
    case stable
    case beta
    case canary
    case dev
    case nightly
}

public enum LifecycleInstallState: String, Codable, Equatable, Sendable {
    case notInstalled = "not-installed"
    case installing
    case installed
}

public enum RuntimeState: String, Codable, Equatable, Sendable {
    case starting
    case running
    case stopping
    case stopped
    case offline
    case failed
}

public enum ServiceState: String, Codable, Equatable, Sendable {
    case healthy
    case degraded
    case stopped
    case failed
    case unknown
}

public enum ServiceManager: String, Codable, Equatable, Sendable {
    case launchd
    case windowsServiceManager = "windows-service-manager"
    case systemd
}

public enum ConnectorState: String, Codable, Equatable, Sendable {
    case connected
    case degraded
    case offline
    case unknown
}

public enum ConnectionState: String, Codable, Equatable, Sendable {
    case online
    case offline
}

public enum OperationKind: String, Codable, Equatable, Sendable {
    case install
    case update
    case repair
    case rollback
    case restart
    case uninstall
}

public enum OperationPhase: String, Codable, Equatable, Sendable {
    case queued
    case running
    case succeeded
    case failed
}

public enum NotificationPreference: Equatable, Sendable {
    case on
    case off
    case snoozed(until: String)
}

extension NotificationPreference: Codable {
    private enum CodingKeys: String, CodingKey {
        case state
        case until
    }

    private enum State: String, Codable {
        case on
        case off
        case snoozed
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(State.self, forKey: .state) {
        case .on:
            self = .on
        case .off:
            self = .off
        case .snoozed:
            self = .snoozed(until: try container.decode(String.self, forKey: .until))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .on:
            try container.encode(State.on, forKey: .state)
        case .off:
            try container.encode(State.off, forKey: .state)
        case let .snoozed(until):
            try container.encode(State.snoozed, forKey: .state)
            try container.encode(until, forKey: .until)
        }
    }
}

public struct InstallSnapshot: Codable, Equatable, Sendable {
    public var state: LifecycleInstallState

    public init(state: LifecycleInstallState) {
        self.state = state
    }
}

public struct RuntimeSnapshot: Codable, Equatable, Sendable {
    public var version: String
    public var channel: ReleaseChannel
    public var state: RuntimeState

    public init(version: String, channel: ReleaseChannel, state: RuntimeState) {
        self.version = version
        self.channel = channel
        self.state = state
    }
}

public struct ServiceSnapshot: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var state: ServiceState
    public var managedBy: ServiceManager
    public var detail: String?

    public init(id: String, state: ServiceState, managedBy: ServiceManager, detail: String? = nil) {
        self.id = id
        self.state = state
        self.managedBy = managedBy
        self.detail = detail
    }
}

public struct ConnectorSnapshot: Codable, Equatable, Sendable {
    public var state: ConnectorState
    public var detail: String?

    public init(state: ConnectorState, detail: String? = nil) {
        self.state = state
        self.detail = detail
    }
}

public struct UpdateSnapshot: Codable, Equatable, Sendable {
    public var available: Int
    public var latestVersion: String?
    public var rollbackVersion: String?

    public init(available: Int, latestVersion: String? = nil, rollbackVersion: String? = nil) {
        self.available = available
        self.latestVersion = latestVersion
        self.rollbackVersion = rollbackVersion
    }
}

public struct ReleaseSnapshot: Codable, Equatable, Sendable {
    public var summary: String?

    public init(summary: String? = nil) {
        self.summary = summary
    }
}

public struct OperationSnapshot: Codable, Equatable, Sendable {
    public var kind: OperationKind
    public var phase: OperationPhase
    public var message: String?

    public init(kind: OperationKind, phase: OperationPhase, message: String? = nil) {
        self.kind = kind
        self.phase = phase
        self.message = message
    }
}

public struct PreferenceSnapshot: Codable, Equatable, Sendable {
    public var channelSelectionAllowed: Bool
    public var notifications: NotificationPreference

    public init(channelSelectionAllowed: Bool, notifications: NotificationPreference) {
        self.channelSelectionAllowed = channelSelectionAllowed
        self.notifications = notifications
    }
}

public struct ConnectionSnapshot: Codable, Equatable, Sendable {
    public var state: ConnectionState
    public var reason: String?

    public init(state: ConnectionState, reason: String? = nil) {
        self.state = state
        self.reason = reason
    }
}

public enum WorkspaceNodeRole: String, Codable, Equatable, Sendable {
    case home
    case member
}

public enum WorkspaceNodePresence: String, Codable, Equatable, Sendable {
    case online
    case offline
    case stale
}

public enum WorkspaceNodeState: String, Codable, Equatable, Sendable {
    case active
    case revoked
}

public struct WorkspaceNodeSnapshot: Codable, Equatable, Sendable, Identifiable {
    public var workspaceId: String
    public var nodeId: String
    public var displayName: String
    public var role: WorkspaceNodeRole
    public var platform: String
    public var architecture: String
    public var channel: String
    public var connectorId: String
    public var capabilities: [String]
    public var createdAt: String
    public var lastSeenAt: String
    public var presence: WorkspaceNodePresence
    public var state: WorkspaceNodeState
    public var publicKeyThumbprint: String

    public var id: String { nodeId }

    public init(
        workspaceId: String,
        nodeId: String,
        displayName: String,
        role: WorkspaceNodeRole,
        platform: String,
        architecture: String,
        channel: String,
        connectorId: String,
        capabilities: [String],
        createdAt: String,
        lastSeenAt: String,
        presence: WorkspaceNodePresence,
        state: WorkspaceNodeState,
        publicKeyThumbprint: String
    ) {
        self.workspaceId = workspaceId
        self.nodeId = nodeId
        self.displayName = displayName
        self.role = role
        self.platform = platform
        self.architecture = architecture
        self.channel = channel
        self.connectorId = connectorId
        self.capabilities = capabilities
        self.createdAt = createdAt
        self.lastSeenAt = lastSeenAt
        self.presence = presence
        self.state = state
        self.publicKeyThumbprint = publicKeyThumbprint
    }

    public func isDefault(in workspace: WorkspaceSnapshot) -> Bool {
        workspace.defaultNodeId == nodeId
    }
}

public struct WorkspaceSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: String
    public var workspaceHost: String
    public var currentNodeId: String?
    public var defaultNodeId: String?
    public var nodes: [WorkspaceNodeSnapshot]

    public init(
        workspaceId: String,
        workspaceHost: String,
        currentNodeId: String? = nil,
        defaultNodeId: String? = nil,
        nodes: [WorkspaceNodeSnapshot]
    ) {
        self.workspaceId = workspaceId
        self.workspaceHost = workspaceHost
        self.currentNodeId = currentNodeId
        self.defaultNodeId = defaultNodeId
        self.nodes = nodes
    }
}

public struct LifecycleSnapshot: Codable, Equatable, Sendable {
    public static let supportedSchemaVersion = 1

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case sequence
        case observedAt
        case install
        case runtime
        case services
        case connector
        case updates
        case release
        case operation
        case preferences
        case workspace
        case connection
    }

    public var schemaVersion: Int
    public var sequence: Int
    public var observedAt: String
    public var install: InstallSnapshot
    public var runtime: RuntimeSnapshot
    public var services: [ServiceSnapshot]
    public var connector: ConnectorSnapshot
    public var updates: UpdateSnapshot
    public var release: ReleaseSnapshot
    public var operation: OperationSnapshot?
    public var preferences: PreferenceSnapshot
    public var workspace: WorkspaceSnapshot?
    public var connection: ConnectionSnapshot

    public init(
        schemaVersion: Int,
        sequence: Int,
        observedAt: String,
        install: InstallSnapshot,
        runtime: RuntimeSnapshot,
        services: [ServiceSnapshot],
        connector: ConnectorSnapshot,
        updates: UpdateSnapshot,
        release: ReleaseSnapshot,
        operation: OperationSnapshot? = nil,
        preferences: PreferenceSnapshot,
        workspace: WorkspaceSnapshot? = nil,
        connection: ConnectionSnapshot = .init(state: .online)
    ) {
        self.schemaVersion = schemaVersion
        self.sequence = sequence
        self.observedAt = observedAt
        self.install = install
        self.runtime = runtime
        self.services = services
        self.connector = connector
        self.updates = updates
        self.release = release
        self.operation = operation
        self.preferences = preferences
        self.workspace = workspace
        self.connection = connection
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        guard schemaVersion == Self.supportedSchemaVersion else {
            throw DecodingError.dataCorruptedError(
                forKey: .schemaVersion,
                in: container,
                debugDescription: "Unsupported lifecycle schema version: \(schemaVersion)"
            )
        }
        sequence = try container.decode(Int.self, forKey: .sequence)
        observedAt = try container.decode(String.self, forKey: .observedAt)
        install = try container.decodeIfPresent(InstallSnapshot.self, forKey: .install) ?? .init(state: .installed)
        runtime = try container.decode(RuntimeSnapshot.self, forKey: .runtime)
        services = try container.decode([ServiceSnapshot].self, forKey: .services)
        connector = try container.decodeIfPresent(ConnectorSnapshot.self, forKey: .connector) ?? .init(state: .unknown)
        updates = try container.decode(UpdateSnapshot.self, forKey: .updates)
        release = try container.decodeIfPresent(ReleaseSnapshot.self, forKey: .release) ?? .init()
        operation = try container.decodeIfPresent(OperationSnapshot.self, forKey: .operation)
        preferences = try container.decodeIfPresent(PreferenceSnapshot.self, forKey: .preferences)
            ?? .init(channelSelectionAllowed: false, notifications: .on)
        workspace = try container.decodeIfPresent(WorkspaceSnapshot.self, forKey: .workspace)
        connection = try container.decodeIfPresent(ConnectionSnapshot.self, forKey: .connection) ?? .init(state: .online)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(schemaVersion, forKey: .schemaVersion)
        try container.encode(sequence, forKey: .sequence)
        try container.encode(observedAt, forKey: .observedAt)
        try container.encode(install, forKey: .install)
        try container.encode(runtime, forKey: .runtime)
        try container.encode(services, forKey: .services)
        try container.encode(connector, forKey: .connector)
        try container.encode(updates, forKey: .updates)
        try container.encode(release, forKey: .release)
        try container.encodeIfPresent(operation, forKey: .operation)
        try container.encode(preferences, forKey: .preferences)
        try container.encodeIfPresent(workspace, forKey: .workspace)
        try container.encode(connection, forKey: .connection)
    }
}

public enum LifecycleRequest: Equatable, Sendable {
    case statusGet
    case updateApply(targetVersion: String)
    case updateRollback(targetVersion: String)
    case repairRun(destructive: Bool)
    case serviceRestart
    case preferencesNotificationsSet(NotificationPreference)
    case preferencesChannelSet(ReleaseChannel)
    case workspaceDefaultNodeSet(nodeId: String)
    case diagnosticsExport
    case uninstallExecute(removeNode: Bool, removeUserContent: Bool)
}

extension LifecycleRequest: Codable {
    private enum CodingKeys: String, CodingKey {
        case kind
        case targetVersion
        case destructive
        case notifications
        case channel
        case nodeId
        case removeNode
        case removeUserContent
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(String.self, forKey: .kind)
        switch kind {
        case "status.get": self = .statusGet
        case "update.apply": self = .updateApply(targetVersion: try container.decode(String.self, forKey: .targetVersion))
        case "update.rollback": self = .updateRollback(targetVersion: try container.decode(String.self, forKey: .targetVersion))
        case "repair.run": self = .repairRun(destructive: try container.decode(Bool.self, forKey: .destructive))
        case "service.restart": self = .serviceRestart
        case "preferences.notifications.set": self = .preferencesNotificationsSet(try container.decode(NotificationPreference.self, forKey: .notifications))
        case "preferences.channel.set": self = .preferencesChannelSet(try container.decode(ReleaseChannel.self, forKey: .channel))
        case "workspace.default-node.set": self = .workspaceDefaultNodeSet(nodeId: try container.decode(String.self, forKey: .nodeId))
        case "diagnostics.export": self = .diagnosticsExport
        case "uninstall.execute": self = .uninstallExecute(
            removeNode: try container.decode(Bool.self, forKey: .removeNode),
            removeUserContent: try container.decode(Bool.self, forKey: .removeUserContent)
        )
        default:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "Unsupported lifecycle request kind: \(kind)")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .statusGet:
            try container.encode("status.get", forKey: .kind)
        case let .updateApply(targetVersion):
            try container.encode("update.apply", forKey: .kind)
            try container.encode(targetVersion, forKey: .targetVersion)
        case let .updateRollback(targetVersion):
            try container.encode("update.rollback", forKey: .kind)
            try container.encode(targetVersion, forKey: .targetVersion)
        case let .repairRun(destructive):
            try container.encode("repair.run", forKey: .kind)
            try container.encode(destructive, forKey: .destructive)
        case .serviceRestart:
            try container.encode("service.restart", forKey: .kind)
        case let .preferencesNotificationsSet(preference):
            try container.encode("preferences.notifications.set", forKey: .kind)
            try container.encode(preference, forKey: .notifications)
        case let .preferencesChannelSet(channel):
            try container.encode("preferences.channel.set", forKey: .kind)
            try container.encode(channel, forKey: .channel)
        case let .workspaceDefaultNodeSet(nodeId):
            try container.encode("workspace.default-node.set", forKey: .kind)
            try container.encode(nodeId, forKey: .nodeId)
        case .diagnosticsExport:
            try container.encode("diagnostics.export", forKey: .kind)
        case let .uninstallExecute(removeNode, removeUserContent):
            try container.encode("uninstall.execute", forKey: .kind)
            try container.encode(removeNode, forKey: .removeNode)
            try container.encode(removeUserContent, forKey: .removeUserContent)
        }
    }
}

public struct LifecycleOperationAccepted: Codable, Equatable, Sendable {
    public var accepted: Bool
    public var operationId: String

    public init(accepted: Bool, operationId: String) {
        self.accepted = accepted
        self.operationId = operationId
    }
}

public enum LifecycleResponse: Equatable, Sendable {
    case snapshot(LifecycleSnapshot)
    case accepted(LifecycleOperationAccepted)
}

extension LifecycleResponse: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let snapshot = try? container.decode(LifecycleSnapshot.self) {
            self = .snapshot(snapshot)
            return
        }
        self = .accepted(try container.decode(LifecycleOperationAccepted.self))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .snapshot(snapshot): try container.encode(snapshot)
        case let .accepted(accepted): try container.encode(accepted)
        }
    }
}
