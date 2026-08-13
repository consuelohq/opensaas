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

public struct PendingUpdateContext: Equatable, Sendable {
    public var operationId: String
    public var targetVersion: String

    public init(operationId: String, targetVersion: String) {
        self.operationId = operationId
        self.targetVersion = targetVersion
    }

    public func isResolved(by snapshot: LifecycleSnapshot) -> Bool {
        if snapshot.operation?.kind == .update {
            switch snapshot.operation?.phase {
            case .succeeded, .failed:
                return true
            case .queued, .running, .none:
                break
            }
        }
        return snapshot.connection.state == .online && snapshot.runtime.version == targetVersion
    }
}

public struct MenuBarPresentation: Equatable, Sendable {
    public var lifecycleState: MenuBarLifecycleState
    public var connectionLabel: String
    public var title: String
    public var systemImage: String
    public var showsUpdateBadge: Bool
    public var updateActionTitle: String?

    public init(snapshot: LifecycleSnapshot, pendingUpdate: PendingUpdateContext? = nil) {
        let updateIsPending = pendingUpdate.map { !$0.isResolved(by: snapshot) } ?? false
        lifecycleState = updateIsPending ? .updating : .derive(from: snapshot)
        if snapshot.connection.state == .offline {
            if updateIsPending {
                connectionLabel = "Reconnecting to Consuelo OS…"
            } else {
                connectionLabel = snapshot.connection.reason.map {
                    "Offline — \(DiagnosticsRedactor.redactText($0))"
                } ?? "Offline"
            }
        } else {
            connectionLabel = "Online"
        }
        showsUpdateBadge = lifecycleState == .updateAvailable
        if lifecycleState == .updateAvailable {
            updateActionTitle = snapshot.updates.latestVersion.map { "Update to \($0)" }
        } else {
            updateActionTitle = nil
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
            title = pendingUpdate.map { "Updating to \($0.targetVersion)" } ?? "Updating"
            systemImage = "arrow.triangle.2.circlepath"
        case .rollbackAvailable:
            title = "Rollback available"; systemImage = "arrow.uturn.backward.circle"
        case .repairRequired:
            title = "Repair required"; systemImage = "wrench.and.screwdriver.fill"
        }
    }
}

public struct WorkspaceNodePresentation: Equatable, Sendable {
    public var title: String
    public var subtitle: String
    public var isDefault: Bool
    public var isCurrent: Bool
    public var badges: [String]
    public var isSelectable: Bool

    public init(node: WorkspaceNodeSnapshot, workspace: WorkspaceSnapshot) {
        title = node.displayName
        isDefault = node.isDefault(in: workspace)
        isCurrent = workspace.currentNodeId == node.nodeId

        var nextBadges: [String] = []
        if isDefault { nextBadges.append("Default") }
        if isCurrent { nextBadges.append("Current") }
        if node.role == .home { nextBadges.append("Home") }
        badges = nextBadges

        let platform: String
        switch node.platform.lowercased() {
        case "darwin", "macos", "mac": platform = "macOS"
        case "linux": platform = "Linux"
        case "windows", "win32": platform = "Windows"
        default: platform = node.platform.isEmpty ? "Unknown platform" : node.platform.capitalized
        }
        let channel = node.channel.isEmpty ? "Unknown channel" : node.channel.capitalized
        let status: String
        if node.state == .revoked {
            status = "Revoked"
        } else {
            status = node.presence.rawValue.capitalized
        }
        subtitle = "\(platform) · \(channel) · \(status)"
        isSelectable = node.state == .active && node.presence == .online && !isDefault
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

    public var description: String {
        switch self {
        case .offline: "Consuelo OS is offline. Mutating actions are disabled."
        case .updateUnavailable: "No update target is available."
        case .rollbackUnavailable: "No rollback target is available."
        case .channelSelectionDenied: "Channel selection is disabled by policy."
        case .nodeUnavailable: "The selected workspace node is unavailable."
        case .destructiveRepairUnsupported: "Destructive repair is not supported by the lifecycle engine."
        }
    }
}

public enum LifecycleCommandMapper {
    public static func plan(for action: MenuBarAction, snapshot: LifecycleSnapshot) throws -> CommandPlan {
        if action == .refresh { return .init(request: .statusGet) }
        if action == .openLauncher { return .init(request: nil) }
        guard snapshot.connection.state == .online else { throw LifecycleCommandError.offline }

        switch action {
        case .refresh, .openLauncher:
            return .init(request: nil)
        case .update:
            guard let target = snapshot.updates.latestVersion, snapshot.updates.available > 0 else {
                throw LifecycleCommandError.updateUnavailable
            }
            return .init(request: .updateApply(targetVersion: target))
        case .retryRepair:
            return .init(request: .repairRun(destructive: false))
        case .destructiveRepair:
            throw LifecycleCommandError.destructiveRepairUnsupported
        case .rollback:
            guard let target = snapshot.updates.rollbackVersion else {
                throw LifecycleCommandError.rollbackUnavailable
            }
            return .init(request: .updateRollback(targetVersion: target))
        case .restart:
            return .init(request: .serviceRestart)
        case let .setNotifications(preference):
            return .init(request: .preferencesNotificationsSet(preference))
        case let .setChannel(channel):
            guard snapshot.preferences.channelSelectionAllowed else {
                throw LifecycleCommandError.channelSelectionDenied
            }
            return .init(request: .preferencesChannelSet(channel))
        case let .setDefaultNode(nodeId):
            guard let workspace = snapshot.workspace,
                  workspace.defaultNodeId != nodeId,
                  workspace.nodes.contains(where: {
                      $0.nodeId == nodeId && $0.state == .active && $0.presence == .online
                  }) else {
                throw LifecycleCommandError.nodeUnavailable
            }
            return .init(request: .workspaceDefaultNodeSet(nodeId: nodeId))
        case .exportDiagnostics:
            return .init(request: .diagnosticsExport)
        case let .uninstall(removeNode, removeUserContent):
            return .init(
                request: .uninstallExecute(removeNode: removeNode, removeUserContent: removeUserContent),
                confirmation: .uninstall
            )
        }
    }
}
