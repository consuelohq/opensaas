import Foundation

public enum MenuBarLifecycleState: String, Equatable, Sendable {
    case notInstalled
    case installing
    case healthy
    case degraded
    case updateAvailable
    case updating
    case rollbackAvailable
    case repairRequired

    public static func derive(from snapshot: LifecycleSnapshot) -> MenuBarLifecycleState {
        if snapshot.install.state == .notInstalled { return .notInstalled }
        if snapshot.install.state == .installing { return .installing }
        if snapshot.operation?.kind == .install && snapshot.operation?.phase == .running { return .installing }
        if snapshot.operation?.kind == .update && snapshot.operation?.phase == .running { return .updating }
        if snapshot.services.contains(where: { $0.state == .failed }) || snapshot.operation?.phase == .failed {
            return .repairRequired
        }
        if snapshot.connection.state == .offline || snapshot.runtime.state == .offline {
            return .degraded
        }
        if snapshot.connector.state == .degraded || snapshot.connector.state == .offline {
            return .degraded
        }
        if snapshot.updates.available > 0 { return .updateAvailable }
        if snapshot.updates.rollbackVersion != nil { return .rollbackAvailable }
        if snapshot.runtime.state != .running || snapshot.services.contains(where: { $0.state != .healthy }) {
            return .degraded
        }
        return .healthy
    }
}

public struct MenuBarPresentation: Equatable, Sendable {
    public var lifecycleState: MenuBarLifecycleState
    public var connectionLabel: String
    public var title: String
    public var systemImage: String

    public init(snapshot: LifecycleSnapshot) {
        lifecycleState = .derive(from: snapshot)
        if snapshot.connection.state == .offline {
            connectionLabel = snapshot.connection.reason.map {
                "Offline — \(DiagnosticsRedactor.redactText($0))"
            } ?? "Offline"
        } else {
            connectionLabel = "Online"
        }
        switch lifecycleState {
        case .notInstalled:
            title = "Not installed"; systemImage = "circle.dashed"
        case .installing:
            title = "Installing"; systemImage = "arrow.down.circle"
        case .healthy:
            title = "Healthy"; systemImage = "checkmark.circle.fill"
        case .degraded:
            title = "Degraded"; systemImage = "exclamationmark.triangle.fill"
        case .updateAvailable:
            title = "Update available"; systemImage = "arrow.down.circle.fill"
        case .updating:
            title = "Updating"; systemImage = "arrow.triangle.2.circlepath"
        case .rollbackAvailable:
            title = "Rollback available"; systemImage = "arrow.uturn.backward.circle"
        case .repairRequired:
            title = "Repair required"; systemImage = "wrench.and.screwdriver.fill"
        }
    }
}

public struct MenuBarActionPresentation: Equatable, Sendable {
    public var updateTargetVersion: String?
    public var canRepair: Bool
    public var canRollback: Bool
    public var canRestart: Bool
    public var canUninstall: Bool

    public init(snapshot: LifecycleSnapshot) {
        updateTargetVersion =
            snapshot.actions.update && snapshot.updates.available > 0
                ? snapshot.updates.latestVersion
                : nil
        canRepair = snapshot.actions.repair
        canRollback =
            snapshot.actions.rollback && snapshot.updates.rollbackVersion != nil
        canRestart = snapshot.actions.restart
        canUninstall = snapshot.actions.uninstall
    }
}

public struct WorkspaceNodePresentation: Equatable, Sendable {
    public var title: String
    public var subtitle: String
    public var isDefault: Bool
    public var isSelectable: Bool

    public init(node: WorkspaceNodeSnapshot, workspace: WorkspaceSnapshot) {
        title = node.displayName
        subtitle = "\(node.role.rawValue.capitalized) · \(node.presence.rawValue) · \(node.capabilities.joined(separator: ", "))"
        isDefault = node.isDefault(in: workspace)
        isSelectable = node.state == .active
    }
}

public enum MenuBarAction: Equatable, Sendable {
    case refresh
    case update
    case retryRepair
    case destructiveRepair
    case rollback
    case restart
    case setNotifications(NotificationPreference)
    case setChannel(ReleaseChannel)
    case setDefaultNode(String)
    case exportDiagnostics
    case openLauncher
    case uninstall(removeNode: Bool, removeUserContent: Bool)
}

public enum ConfirmationKind: Equatable, Sendable {
    case destructiveRepair
    case uninstall
}

public struct CommandPlan: Equatable, Sendable {
    public var request: LifecycleRequest?
    public var confirmation: ConfirmationKind?

    public init(request: LifecycleRequest?, confirmation: ConfirmationKind? = nil) {
        self.request = request
        self.confirmation = confirmation
    }
}

public enum LifecycleCommandError: Error, Equatable, CustomStringConvertible {
    case offline
    case updateUnavailable
    case rollbackUnavailable
    case channelSelectionDenied
    case nodeUnavailable
    case destructiveRepairUnsupported
    case actionUnavailable(String)

    public var description: String {
        switch self {
        case .offline: "Consuelo OS is offline. Mutating actions are disabled."
        case .updateUnavailable: "No update target is available."
        case .rollbackUnavailable: "No rollback target is available."
        case .channelSelectionDenied: "Channel selection is disabled by policy."
        case .nodeUnavailable: "The selected workspace node is unavailable."
        case .destructiveRepairUnsupported: "Destructive repair is not supported by the lifecycle engine."
        case let .actionUnavailable(action): "\(action) is unavailable for this runtime."
        }
    }
}

public enum LifecycleCommandMapper {
    public static func plan(for action: MenuBarAction, snapshot: LifecycleSnapshot) throws -> CommandPlan {
        func requireOnline() throws {
            guard snapshot.connection.state == .online else { throw LifecycleCommandError.offline }
        }

        switch action {
        case .refresh:
            return .init(request: .statusGet)
        case .openLauncher:
            return .init(request: nil)
        case .update:
            try requireOnline()
            guard snapshot.actions.update else { throw LifecycleCommandError.actionUnavailable("Update") }
            guard let target = snapshot.updates.latestVersion, snapshot.updates.available > 0 else {
                throw LifecycleCommandError.updateUnavailable
            }
            return .init(request: .updateApply(targetVersion: target))
        case .retryRepair:
            try requireOnline()
            guard snapshot.actions.repair else { throw LifecycleCommandError.actionUnavailable("Repair") }
            return .init(request: .repairRun(destructive: false))
        case .destructiveRepair:
            try requireOnline()
            throw LifecycleCommandError.destructiveRepairUnsupported
        case .rollback:
            try requireOnline()
            guard snapshot.actions.rollback else { throw LifecycleCommandError.actionUnavailable("Rollback") }
            guard let target = snapshot.updates.rollbackVersion else {
                throw LifecycleCommandError.rollbackUnavailable
            }
            return .init(request: .updateRollback(targetVersion: target))
        case .restart:
            try requireOnline()
            guard snapshot.actions.restart else { throw LifecycleCommandError.actionUnavailable("Restart") }
            return .init(request: .serviceRestart)
        case let .setNotifications(preference):
            try requireOnline()
            return .init(request: .preferencesNotificationsSet(preference))
        case let .setChannel(channel):
            try requireOnline()
            guard snapshot.preferences.channelSelectionAllowed else {
                throw LifecycleCommandError.channelSelectionDenied
            }
            return .init(request: .preferencesChannelSet(channel))
        case let .setDefaultNode(nodeId):
            try requireOnline()
            guard snapshot.workspace?.nodes.contains(where: { $0.nodeId == nodeId && $0.state == .active }) == true else {
                throw LifecycleCommandError.nodeUnavailable
            }
            return .init(request: .workspaceDefaultNodeSet(nodeId: nodeId))
        case .exportDiagnostics:
            try requireOnline()
            return .init(request: .diagnosticsExport)
        case let .uninstall(removeNode, removeUserContent):
            try requireOnline()
            guard snapshot.actions.uninstall else { throw LifecycleCommandError.actionUnavailable("Uninstall") }
            return .init(
                request: .uninstallExecute(removeNode: removeNode, removeUserContent: removeUserContent),
                confirmation: .uninstall
            )
        }
    }
}
