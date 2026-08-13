import AppKit
import Combine
import ConsueloMacCore
import SwiftUI

@main
struct ConsueloMenuBarApplication: App {
    @StateObject private var model = MenuBarModel()

    var body: some Scene {
        MenuBarExtra {
            ConsueloMenu(model: model)
        } label: {
            HStack(spacing: 3) {
                Image(systemName: model.systemImage)
                if model.showsUpdateBadge {
                    Circle()
                        .frame(width: 5, height: 5)
                        .accessibilityLabel("Update available")
                }
            }
        }
        .menuBarExtraStyle(.menu)
    }
}

private struct ConsueloMenu: View {
    @ObservedObject var model: MenuBarModel

    var body: some View {
        Group {
            Text(model.statusTitle)
            Text(model.connectionLabel)

            if let snapshot = model.snapshot {
                Text("Version \(snapshot.runtime.version) · \(snapshot.runtime.channel.rawValue)")
                if let summary = snapshot.release.summary, !summary.isEmpty {
                    Text(summary)
                }
                if let operation = snapshot.operation {
                    Text("Operation: \(operation.kind.rawValue) · \(operation.phase.rawValue)")
                    if let message = operation.message, !message.isEmpty {
                        Text(DiagnosticsRedactor.redactText(message))
                    }
                }

                Divider()
                ForEach(snapshot.services) { service in
                    Label(
                        "\(service.id): \(service.state.rawValue)",
                        systemImage: service.state == .healthy
                            ? "checkmark.circle"
                            : "exclamationmark.triangle"
                    )
                }
                Label(
                    "Connector: \(snapshot.connector.state.rawValue)",
                    systemImage: snapshot.connector.state == .connected ? "link" : "link.badge.plus"
                )

                Divider()
                if let updateActionTitle = model.updateActionTitle {
                    Button(updateActionTitle) {
                        model.perform(.update)
                    }
                }
                Button("Retry repair") { model.perform(.retryRepair) }
                if snapshot.updates.rollbackVersion != nil {
                    Button("Rollback…") { model.perform(.rollback) }
                }
                Button("Restart services") { model.perform(.restart) }

                if let workspace = snapshot.workspace {
                    Divider()
                    Text("Workspace: \(workspace.workspaceHost)")
                    if let currentNode = workspace.nodes.first(where: { $0.nodeId == workspace.currentNodeId }) {
                        Text("Current node: \(currentNode.displayName)")
                    }
                    Menu("Nodes") {
                        ForEach(workspace.nodes) { node in
                            let nodePresentation = WorkspaceNodePresentation(node: node, workspace: workspace)
                            if nodePresentation.isSelectable {
                                Button("Make default — \(nodePresentation.title) · \(nodePresentation.subtitle)") {
                                    model.perform(.setDefaultNode(node.nodeId))
                                }
                            } else {
                                Button(nodeMenuTitle(nodePresentation)) {}
                                    .disabled(true)
                            }
                        }
                    }
                }

                Divider()
                Menu("Notifications") {
                    Button("On") { model.perform(.setNotifications(.on)) }
                    Button("Off") { model.perform(.setNotifications(.off)) }
                    Button("Snooze for one hour") { model.snoozeNotificationsForOneHour() }
                }
                if snapshot.preferences.channelSelectionAllowed {
                    Menu("Release channel") {
                        ForEach(ReleaseChannel.userSelectableCases, id: \.self) { channel in
                            Button(channel.rawValue.capitalized) {
                                model.perform(.setChannel(channel))
                            }
                        }
                    }
                }

                Divider()
                Button("Open launcher") { model.perform(.openLauncher) }
                Button("Export diagnostics") { model.perform(.exportDiagnostics) }
                Menu("Uninstall") {
                    Button("Keep node and user content…", role: .destructive) {
                        model.perform(.uninstall(removeNode: false, removeUserContent: false))
                    }
                    Button("Remove node registration…", role: .destructive) {
                        model.perform(.uninstall(removeNode: true, removeUserContent: false))
                    }
                    Button("Remove user content…", role: .destructive) {
                        model.perform(.uninstall(removeNode: true, removeUserContent: true))
                    }
                }
            } else {
                Button("Refresh") { model.perform(.refresh) }
            }

            if let error = model.errorMessage {
                Divider()
                Text(error)
            }

            Divider()
            Button("Refresh") { model.perform(.refresh) }
            Button("Quit Consuelo Menu") { NSApplication.shared.terminate(nil) }
        }
        .confirmationDialog(
            model.confirmationTitle,
            isPresented: $model.isConfirmationPresented,
            titleVisibility: .visible
        ) {
            Button(model.confirmationButtonTitle, role: .destructive) {
                model.confirmPendingAction()
            }
            Button("Cancel", role: .cancel) { model.cancelPendingAction() }
        } message: {
            Text(model.confirmationMessage)
        }
    }

    private func nodeMenuTitle(_ presentation: WorkspaceNodePresentation) -> String {
        let badges = presentation.badges.isEmpty ? "" : " · \(presentation.badges.joined(separator: ", "))"
        return "\(presentation.title)\(badges) · \(presentation.subtitle)"
    }
}

@MainActor
private final class MenuBarModel: ObservableObject {
    @Published private(set) var snapshot: LifecycleSnapshot?
    @Published private(set) var errorMessage: String?
    @Published private(set) var pendingUpdate: PendingUpdateContext?
    @Published var isConfirmationPresented = false

    private let client: LifecycleClient
    private var pendingAction: MenuBarAction?

    init() {
        client = LifecycleClient(transport: UnixSocketLifecycleTransport())
        client.connect { [weak self] incoming in
            Task { @MainActor in
                self?.apply(incoming)
            }
        }
        Task { await refresh() }
    }

    deinit {
        client.closeShell()
    }

    var presentation: MenuBarPresentation? {
        snapshot.map { MenuBarPresentation(snapshot: $0, pendingUpdate: pendingUpdate) }
    }

    var statusTitle: String {
        presentation?.title ?? "Consuelo OS unavailable"
    }

    var connectionLabel: String {
        presentation?.connectionLabel ?? "Waiting for lifecycle service"
    }

    var systemImage: String {
        presentation?.systemImage ?? "circle.dashed"
    }

    var showsUpdateBadge: Bool {
        presentation?.showsUpdateBadge ?? false
    }

    var updateActionTitle: String? {
        presentation?.updateActionTitle
    }

    var confirmationTitle: String {
        switch pendingAction {
        case .destructiveRepair:
            "Run destructive repair?"
        case .uninstall(_, _):
            "Uninstall Consuelo OS?"
        default:
            "Confirm action"
        }
    }

    var confirmationMessage: String {
        switch pendingAction {
        case .destructiveRepair:
            "This may replace managed runtime files. User content remains protected by the lifecycle engine."
        case .uninstall(_, _):
            uninstallConfirmationMessage
        default:
            "This action requires confirmation."
        }
    }

    private var uninstallConfirmationMessage: String {
        guard case let .uninstall(removeNode, removeUserContent) = pendingAction else {
            return "The lifecycle engine will apply the selected retention policy."
        }
        var retained = removeNode ? "The workspace node registration will be removed." : "The workspace node registration will be retained."
        retained += removeUserContent ? " User-owned content will also be removed." : " User-owned content will be retained."
        return "\(retained) The menu app does not remove files itself."
    }

    var confirmationButtonTitle: String {
        switch pendingAction {
        case .destructiveRepair:
            "Repair"
        case .uninstall(_, _):
            "Uninstall"
        default:
            "Continue"
        }
    }

    func perform(_ action: MenuBarAction) {
        if action == .refresh {
            Task { await refresh() }
            return
        }
        if action == .openLauncher {
            openLauncher()
            return
        }
        guard let snapshot else {
            errorMessage = "No lifecycle snapshot is available."
            return
        }

        do {
            let plan = try LifecycleCommandMapper.plan(for: action, snapshot: snapshot)
            if plan.confirmation != nil {
                pendingAction = action
                isConfirmationPresented = true
            } else if let request = plan.request {
                Task { await execute(request) }
            }
        } catch {
            errorMessage = DiagnosticsRedactor.redactError(error)
        }
    }

    func confirmPendingAction() {
        guard let action = pendingAction, let snapshot else { return }
        pendingAction = nil
        isConfirmationPresented = false

        do {
            if let request = try LifecycleCommandMapper.plan(for: action, snapshot: snapshot).request {
                Task { await execute(request) }
            }
        } catch {
            errorMessage = DiagnosticsRedactor.redactError(error)
        }
    }

    func cancelPendingAction() {
        pendingAction = nil
        isConfirmationPresented = false
    }

    func snoozeNotificationsForOneHour() {
        let until = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
        perform(.setNotifications(.snoozed(until: until)))
    }

    private func execute(_ request: LifecycleRequest) async {
        do {
            let accepted = try await client.send(request)
            if case let .updateApply(targetVersion) = request {
                pendingUpdate = PendingUpdateContext(
                    operationId: accepted.operationId,
                    targetVersion: targetVersion
                )
            }
            _ = try await client.refresh()
            if let current = client.current() {
                apply(current)
            }
            errorMessage = nil
        } catch {
            errorMessage = DiagnosticsRedactor.redactError(error)
        }
    }

    private func refresh() async {
        do {
            apply(try await client.refresh())
            errorMessage = nil
        } catch {
            errorMessage = DiagnosticsRedactor.redactError(error)
        }
    }

    private func apply(_ incoming: LifecycleSnapshot) {
        if let pendingUpdate, pendingUpdate.isResolved(by: incoming) {
            self.pendingUpdate = nil
        }
        snapshot = incoming
    }

    private func openLauncher() {
        guard let host = snapshot?.workspace?.workspaceHost,
              let url = URL(string: "https://\(host)") else {
            errorMessage = "No workspace launcher URL is available."
            return
        }
        NSWorkspace.shared.open(url)
    }
}
