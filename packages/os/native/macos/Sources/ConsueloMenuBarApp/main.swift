import AppKit
import Combine
import ConsueloMacCore
import SwiftUI

@main
struct ConsueloMenuBarApplication: App {
    @StateObject private var model = MenuBarModel()

    var body: some Scene {
        MenuBarExtra("Consuelo", systemImage: model.systemImage) {
            ConsueloMenu(model: model)
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
                Text("Available updates: \(snapshot.updates.available)")
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
                if snapshot.updates.available > 0 {
                    Button("Update to \(snapshot.updates.latestVersion ?? "latest")") {
                        model.perform(.update)
                    }
                }
                Button("Retry repair") { model.perform(.retryRepair) }
                Button("Destructive repair…") { model.perform(.destructiveRepair) }
                if snapshot.updates.rollbackVersion != nil {
                    Button("Rollback…") { model.perform(.rollback) }
                }
                Button("Restart services") { model.perform(.restart) }

                if let workspace = snapshot.workspace {
                    Divider()
                    Text("Workspace: \(workspace.workspaceHost)")
                    if let currentNodeId = workspace.currentNodeId {
                        Text("Current node: \(currentNodeId)")
                    }
                    Menu("Workspace nodes") {
                        ForEach(workspace.nodes) { node in
                            Button(nodeTitle(node, workspace: workspace)) {
                                model.perform(.setDefaultNode(node.nodeId))
                            }
                            .disabled(node.state != .active)
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
                        ForEach(ReleaseChannel.allCases, id: \.self) { channel in
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

    private func nodeTitle(_ node: WorkspaceNodeSnapshot, workspace: WorkspaceSnapshot) -> String {
        let role = node.role == .home ? "Home" : "Member"
        let marker = node.isDefault(in: workspace) ? " ✓" : ""
        let capabilities = node.capabilities.joined(separator: ", ")
        return "\(node.displayName) · \(role) · \(node.presence.rawValue) · \(node.state.rawValue) · \(capabilities)\(marker)"
    }
}

@MainActor
private final class MenuBarModel: ObservableObject {
    @Published private(set) var snapshot: LifecycleSnapshot?
    @Published private(set) var errorMessage: String?
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
        snapshot.map(MenuBarPresentation.init)
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
            _ = try await client.send(request)
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
