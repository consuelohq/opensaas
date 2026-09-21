import AppKit
import Combine
import ConsueloMacCore
import SwiftUI

@main
struct ConsueloMenuBarApplication: App {
    private static let instanceLock = MenuBarInstanceLock.acquire()
    @StateObject private var model = MenuBarModel()

    init() {
        guard Self.instanceLock != nil else {
            DispatchQueue.main.async {
                NSApplication.shared.terminate(nil)
            }
            return
        }
    }

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
            Label(model.statusTitle, systemImage: model.systemImage)

            if let snapshot = model.snapshot {
                Text("\(model.connectionLabel) · v\(snapshot.runtime.version) · \(snapshot.runtime.channel.rawValue.capitalized)")
                if let updateActionTitle = model.updateActionTitle {
                    Button(updateActionTitle) {
                        model.perform(.update)
                    }
                }

                if let workspace = snapshot.workspace {
                    Divider()
                    Label(workspace.workspaceHost, systemImage: "building.2")
                    if let currentNode = workspace.nodes.first(where: { $0.nodeId == workspace.currentNodeId }) {
                        Label("This Mac: \(currentNode.displayName)", systemImage: "desktopcomputer")
                    }
                    Menu("Nodes") {
                        ForEach(workspace.nodes) { node in
                            let nodePresentation = WorkspaceNodePresentation(node: node, workspace: workspace)
                            if nodePresentation.isSelectable {
                                Button {
                                    model.perform(.setDefaultNode(node.nodeId))
                                } label: {
                                    Label(nodeMenuTitle(nodePresentation), systemImage: nodeSystemImage(nodePresentation))
                                }
                            } else {
                                Button {} label: {
                                    Label(nodeMenuTitle(nodePresentation), systemImage: nodeSystemImage(nodePresentation))
                                }
                                    .disabled(true)
                            }
                        }
                    }
                }

                Divider()
                Toggle("Notifications", isOn: Binding(
                    get: { model.notificationsEnabled },
                    set: { model.perform(.setNotifications($0 ? .on : .off)) }
                ))
                Menu("Settings") {
                    Button("Snooze for one hour") { model.snoozeNotificationsForOneHour() }
                    if snapshot.preferences.channelSelectionAllowed {
                        Menu("Release channel") {
                            ForEach(ReleaseChannel.userSelectableCases, id: \.self) { channel in
                                Button(channel.rawValue.capitalized) {
                                    model.perform(.setChannel(channel))
                                }
                            }
                        }
                    }
                }

                Divider()
                Button {
                    model.perform(.openLauncher)
                } label: {
                    Label("Open Launcher", systemImage: "arrow.up.right.square")
                }
                Menu("Troubleshooting") {
                    if let operationSummary = model.operationSummary {
                        Text(operationSummary)
                    }
                    if let operationDetail = model.operationDetail, !operationDetail.isEmpty {
                        Text(operationDetail)
                    }
                    if model.requiresRepair {
                        Button("Retry repair") { model.perform(.retryRepair) }
                    }
                    if snapshot.updates.rollbackVersion != nil {
                        Button("Rollback…") { model.perform(.rollback) }
                    }
                    Button("Restart services") { model.perform(.restart) }
                    Button("Export diagnostics") { model.perform(.exportDiagnostics) }
                    Button("Refresh status") { model.perform(.refresh) }
                    Divider()
                    ForEach(snapshot.services) { service in
                        Label(
                            "\(service.id): \(service.state.rawValue.capitalized)",
                            systemImage: service.state == .healthy
                                ? "checkmark.circle"
                                : "exclamationmark.triangle"
                        )
                    }
                    Label(
                        "Connector: \(snapshot.connector.state.rawValue.capitalized)",
                        systemImage: snapshot.connector.state == .connected ? "link" : "link.badge.plus"
                    )
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
                }
            } else {
                Button("Refresh") { model.perform(.refresh) }
            }

            if let error = model.compactErrorMessage {
                Divider()
                Label(error, systemImage: "exclamationmark.triangle")
            }

            Divider()
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

    private func nodeSystemImage(_ presentation: WorkspaceNodePresentation) -> String {
        if presentation.isDefault { return "checkmark.circle.fill" }
        if presentation.subtitle.contains("Revoked") { return "xmark.circle" }
        if presentation.subtitle.contains("Online") { return "circle.fill" }
        return "circle"
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

    var operationSummary: String? {
        presentation?.operationSummary
    }

    var operationDetail: String? {
        presentation?.operationDetail
    }

    var compactErrorMessage: String? {
        errorMessage.map { MenuBarPresentation.compactDetail($0) }
    }

    var notificationsEnabled: Bool {
        snapshot?.preferences.notifications == .on
    }

    var requiresRepair: Bool {
        presentation?.lifecycleState == .repairRequired
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
        if let snapshot, snapshot.isMenuContentEquivalent(to: incoming) {
            return
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
