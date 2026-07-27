import Darwin
import Foundation
import ConsueloMacCore

private enum ContractFailure: Error, CustomStringConvertible {
    case failed(String)

    var description: String {
        switch self {
        case let .failed(message): message
        }
    }
}

private func expect<T: Equatable>(_ actual: T, _ expected: T, _ message: String) throws {
    guard actual == expected else {
        throw ContractFailure.failed("\(message): expected \(expected), received \(actual)")
    }
}

private func expectTrue(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    guard condition() else { throw ContractFailure.failed(message) }
}

private func expectThrows(_ message: String, _ body: () throws -> Void) throws {
    do {
        try body()
    } catch {
        return
    }
    throw ContractFailure.failed("\(message): expected an error")
}

private struct ContractSuite {
    private func snapshot(
        installState: LifecycleInstallState = .installed,
        runtimeState: RuntimeState = .running,
        services: [ServiceSnapshot] = [
            .init(id: "consuelo-os", state: .healthy, managedBy: .launchd),
            .init(id: "consuelo-connector", state: .healthy, managedBy: .launchd),
        ],
        updates: UpdateSnapshot = .init(available: 0),
        operation: OperationSnapshot? = nil,
        connection: ConnectionSnapshot = .init(state: .online),
        workspace: WorkspaceSnapshot? = nil
    ) -> LifecycleSnapshot {
        LifecycleSnapshot(
            schemaVersion: 1,
            sequence: 7,
            observedAt: "2026-07-26T20:00:00.000Z",
            install: .init(state: installState),
            runtime: .init(version: "1.4.0", channel: .stable, state: runtimeState),
            services: services,
            connector: .init(state: .connected),
            updates: updates,
            release: .init(summary: "Reliability fixes"),
            operation: operation,
            preferences: .init(channelSelectionAllowed: true, notifications: .on),
            workspace: workspace,
            connection: connection
        )
    }

    func run() async throws {
        try derivesEveryStableMenuBarState()
        try lifecycleRequestJSONMatchesTheSharedTaggedUnion()
        try failedUpdatePreservesWorkingVersionAndSurfacesRecovery()
        try offlineRetainsReadableStateAndFailsMutationsClosed()
        try mapsMenuActionsOnlyToAllowlistedLifecycleRequests()
        try destructiveRepairAndUninstallRequireExplicitConfirmation()
        try lengthPrefixedJSONFramingIsDeterministicAndBounded()
        try backwardCompatibleSnapshotDecodingDefaultsNewPresentationFields()
        try rejectsUnsupportedLifecycleSchemaVersions()
        try safeNodeDecoderRendersWorker25MetadataAndRejectsSecrets()
        try multiNodePresentationExplainsDefaultOfflineStaleAndRevokedState()
        try diagnosticsRedactionRemovesRepresentativeCredentialsAndLocalPaths()
        try operationMessagesAreRedactedBeforeRendering()
        try offlineReasonsAreRedactedBeforeRendering()
        try lifecycleErrorsAreRedactedBeforeMenuPresentation()
        try endpointValidationRejectsNonSocketFiles()
        try socketWritesDisableSigPipe()
        try socketIOUsesBoundedDeadlines()
        try snapshotCacheRetainsHighestObservedSequence()
        try await overlappingRefreshesRetainTheNewestSnapshot()
        try await failedRefreshCannotOverwriteNewerSubscriptionSnapshot()
        try await rejectedLifecycleOperationsSurfaceAsErrors()
        try await framedIPCRejectsSecretBearingLifecycleResponses()
        try await mockedFramedIPCReflectsAppUpdateThroughTypedStatus()
        try await closingShellOnlyCancelsSubscriptionAndNeverStopsService()
        try await cliTriggeredSnapshotRefreshesConnectedPresentationWithoutAppRestart()
    }

    private func derivesEveryStableMenuBarState() throws {
        try expect(MenuBarLifecycleState.derive(from: snapshot(installState: .notInstalled)), .notInstalled, "not installed state")
        try expect(MenuBarLifecycleState.derive(from: snapshot(installState: .installing)), .installing, "install-state progress")
        try expect(MenuBarLifecycleState.derive(from: snapshot(operation: .init(kind: .install, phase: .running))), .installing, "installing state")
        try expect(MenuBarLifecycleState.derive(from: snapshot()), .healthy, "healthy state")
        try expect(MenuBarLifecycleState.derive(from: snapshot(services: [.init(id: "consuelo-os", state: .degraded, managedBy: .launchd)])), .degraded, "degraded state")
        try expect(MenuBarLifecycleState.derive(from: snapshot(connection: .init(state: .online), workspace: nil).withConnector(.degraded)), .degraded, "connector degradation state")
        try expect(MenuBarLifecycleState.derive(from: snapshot(updates: .init(available: 1, latestVersion: "1.5.0"))), .updateAvailable, "update available state")
        try expect(MenuBarLifecycleState.derive(from: snapshot(operation: .init(kind: .update, phase: .running))), .updating, "updating state")
        try expect(MenuBarLifecycleState.derive(from: snapshot(updates: .init(available: 0, rollbackVersion: "1.3.0"))), .rollbackAvailable, "rollback available state")
        try expect(MenuBarLifecycleState.derive(from: snapshot(services: [.init(id: "consuelo-os", state: .failed, managedBy: .launchd)])), .repairRequired, "repair required state")
    }

    private func lifecycleRequestJSONMatchesTheSharedTaggedUnion() throws {
        let cases: [(LifecycleRequest, [String: AnyHashable])] = [
            (.statusGet, ["kind": "status.get"]),
            (.updateApply(targetVersion: "1.5.0"), ["kind": "update.apply", "targetVersion": "1.5.0"]),
            (.updateRollback(targetVersion: "1.3.0"), ["kind": "update.rollback", "targetVersion": "1.3.0"]),
            (.repairRun(destructive: true), ["kind": "repair.run", "destructive": true]),
            (.serviceRestart, ["kind": "service.restart"]),
            (.preferencesChannelSet(.beta), ["kind": "preferences.channel.set", "channel": "beta"]),
            (.workspaceDefaultNodeSet(nodeId: "node-member"), ["kind": "workspace.default-node.set", "nodeId": "node-member"]),
            (.diagnosticsExport, ["kind": "diagnostics.export"]),
            (.uninstallExecute(removeNode: true, removeUserContent: false), ["kind": "uninstall.execute", "removeNode": true, "removeUserContent": false]),
        ]

        for (request, expected) in cases {
            let data = try JSONEncoder().encode(request)
            guard let actual = try JSONSerialization.jsonObject(with: data) as? [String: AnyHashable] else {
                throw ContractFailure.failed("request did not encode as a JSON object: \(request)")
            }
            try expect(actual, expected, "shared tagged-union JSON for \(request)")
        }
    }

    private func failedUpdatePreservesWorkingVersionAndSurfacesRecovery() throws {
        let failed = snapshot(operation: .init(kind: .update, phase: .failed, message: "health gate failed"))
        try expect(MenuBarLifecycleState.derive(from: failed), .repairRequired, "failed update recovery state")
        try expect(failed.runtime.version, "1.4.0", "previous working release remains visible")
        try expect(failed.operation?.message, "health gate failed", "failure reason remains available")
    }

    private func offlineRetainsReadableStateAndFailsMutationsClosed() throws {
        let offline = snapshot(runtimeState: .offline, connection: .init(state: .offline, reason: "socket unavailable"))
        let presentation = MenuBarPresentation(snapshot: offline)

        try expect(presentation.lifecycleState, .degraded, "offline lifecycle state")
        try expect(presentation.connectionLabel, "Offline — socket unavailable", "offline label")
        try expectThrows("offline mutations fail closed") {
            _ = try LifecycleCommandMapper.plan(for: .update, snapshot: offline)
        }
    }

    private func mapsMenuActionsOnlyToAllowlistedLifecycleRequests() throws {
        let workspace = WorkspaceSnapshot(
            workspaceId: "workspace_one",
            workspaceHost: "one.consuelohq.com",
            currentNodeId: "node-home",
            defaultNodeId: "node-home",
            nodes: [
                .init(
                    workspaceId: "workspace_one",
                    nodeId: "node-member",
                    displayName: "MacBook Air",
                    role: .member,
                    platform: "darwin",
                    architecture: "arm64",
                    channel: "dev",
                    connectorId: "connector_member",
                    capabilities: ["local-runtime", "darwin"],
                    createdAt: "2026-07-20T12:00:00.000Z",
                    lastSeenAt: "2026-07-26T19:59:45.000Z",
                    presence: .online,
                    state: .active,
                    publicKeyThumbprint: "thumbprint-member"
                ),
            ]
        )
        let status = snapshot(
            updates: .init(available: 1, latestVersion: "1.5.0", rollbackVersion: "1.3.0"),
            workspace: workspace
        )

        try expect(try LifecycleCommandMapper.plan(for: .refresh, snapshot: status).request, .statusGet, "refresh request")
        try expect(try LifecycleCommandMapper.plan(for: .update, snapshot: status).request, .updateApply(targetVersion: "1.5.0"), "update request")
        try expect(try LifecycleCommandMapper.plan(for: .retryRepair, snapshot: status).request, .repairRun(destructive: false), "repair request")
        try expect(try LifecycleCommandMapper.plan(for: .rollback, snapshot: status).request, .updateRollback(targetVersion: "1.3.0"), "rollback request")
        try expect(try LifecycleCommandMapper.plan(for: .restart, snapshot: status).request, .serviceRestart, "restart request")
        try expect(try LifecycleCommandMapper.plan(for: .setNotifications(.snoozed(until: "2026-07-27T20:00:00.000Z")), snapshot: status).request, .preferencesNotificationsSet(.snoozed(until: "2026-07-27T20:00:00.000Z")), "notification request")
        try expect(try LifecycleCommandMapper.plan(for: .setChannel(.beta), snapshot: status).request, .preferencesChannelSet(.beta), "channel request")
        try expect(try LifecycleCommandMapper.plan(for: .setDefaultNode("node-member"), snapshot: status).request, .workspaceDefaultNodeSet(nodeId: "node-member"), "default node request")
        try expect(try LifecycleCommandMapper.plan(for: .exportDiagnostics, snapshot: status).request, .diagnosticsExport, "diagnostics request")
        try expect(try LifecycleCommandMapper.plan(for: .openLauncher, snapshot: status).request, nil, "open launcher remains local")
    }

    private func destructiveRepairAndUninstallRequireExplicitConfirmation() throws {
        let status = snapshot()
        try expect(try LifecycleCommandMapper.plan(for: .destructiveRepair, snapshot: status).confirmation, .destructiveRepair, "destructive repair confirmation")
        try expect(try LifecycleCommandMapper.plan(for: .uninstall(removeNode: false, removeUserContent: false), snapshot: status).confirmation, .uninstall, "uninstall confirmation")
    }

    private func lengthPrefixedJSONFramingIsDeterministicAndBounded() throws {
        let payload = Data(#"{"kind":"status.get"}"#.utf8)
        let frame = try FramedJSONCodec.frame(payload)
        try expect(Array(frame.prefix(4)), [0, 0, 0, UInt8(payload.count)], "frame prefix")
        var buffer = frame
        try expect(try FramedJSONCodec.extractFrame(from: &buffer), payload, "frame payload")
        try expectTrue(buffer.isEmpty, "frame buffer should be empty")
        try expectThrows("oversized frames are rejected") {
            _ = try FramedJSONCodec.frame(Data(repeating: 0, count: FramedJSONCodec.maximumPayloadBytes + 1))
        }
    }

    private func backwardCompatibleSnapshotDecodingDefaultsNewPresentationFields() throws {
        let legacy = Data(#"""
        {
          "schemaVersion":1,
          "sequence":3,
          "observedAt":"2026-07-26T19:00:00.000Z",
          "runtime":{"version":"1.3.0","channel":"stable","state":"running"},
          "services":[{"id":"consuelo-os","state":"healthy","managedBy":"launchd"}],
          "updates":{"available":0},
          "connection":{"state":"online"}
        }
        """#.utf8)
        let decoded = try JSONDecoder().decode(LifecycleSnapshot.self, from: legacy)
        try expect(decoded.install.state, .installed, "legacy install default")
        try expect(decoded.connector.state, .unknown, "legacy connector default")
        try expect(decoded.preferences.channelSelectionAllowed, false, "legacy policy default")
        try expect(decoded.runtime.version, "1.3.0", "legacy runtime version")
    }

    private func rejectsUnsupportedLifecycleSchemaVersions() throws {
        var unsupported = snapshot()
        unsupported.schemaVersion = 2
        let data = try JSONEncoder().encode(unsupported)

        do {
            _ = try JSONDecoder().decode(LifecycleSnapshot.self, from: data)
            throw ContractFailure.failed("unsupported lifecycle schema version was accepted")
        } catch is DecodingError {
            // Expected: only the shared schema version is accepted.
        }
    }

    private func safeNodeDecoderRendersWorker25MetadataAndRejectsSecrets() throws {
        let safe = Data(#"""
        {
          "workspaceId":"workspace_one",
          "workspaceHost":"one.consuelohq.com",
          "currentNodeId":"node-home",
          "defaultNodeId":"node-home",
          "nodes":[{
            "workspaceId":"workspace_one",
            "nodeId":"node-home",
            "displayName":"Mac Mini",
            "role":"home",
            "platform":"darwin",
            "architecture":"arm64",
            "channel":"dev",
            "connectorId":"connector_home",
            "capabilities":["local-runtime","darwin"],
            "createdAt":"2026-07-20T12:00:00.000Z",
            "lastSeenAt":"2026-07-26T19:59:45.000Z",
            "presence":"online",
            "state":"active",
            "publicKeyThumbprint":"thumbprint"
          }]
        }
        """#.utf8)
        let workspace = try SafeWorkspaceDecoder.decode(safe)
        try expect(workspace.nodes.first?.role, .home, "node role")
        try expect(workspace.nodes.first?.presence, .online, "node presence")
        try expect(workspace.nodes.first?.capabilities, ["local-runtime", "darwin"], "node capabilities")
        try expectTrue(workspace.nodes.first?.isDefault(in: workspace) == true, "default node marker")

        let unsafe = Data(#"{"workspaceId":"workspace_one","workspaceHost":"one.consuelohq.com","nodes":[],"cloudflareApiToken":"secret"}"#.utf8)
        try expectThrows("secret-bearing node response is rejected") {
            _ = try SafeWorkspaceDecoder.decode(unsafe)
        }
    }

    private func multiNodePresentationExplainsDefaultOfflineStaleAndRevokedState() throws {
        let home = WorkspaceNodeSnapshot(
            workspaceId: "workspace_one",
            nodeId: "node-home",
            displayName: "Mac Mini",
            role: .home,
            platform: "darwin",
            architecture: "arm64",
            channel: "dev",
            connectorId: "connector_home",
            capabilities: ["local-runtime", "darwin"],
            createdAt: "2026-07-20T12:00:00.000Z",
            lastSeenAt: "2026-07-26T19:59:45.000Z",
            presence: .online,
            state: .active,
            publicKeyThumbprint: "thumbprint-home"
        )
        let member = WorkspaceNodeSnapshot(
            workspaceId: "workspace_one",
            nodeId: "node-member",
            displayName: "MacBook Air",
            role: .member,
            platform: "darwin",
            architecture: "arm64",
            channel: "stable",
            connectorId: "connector_member",
            capabilities: ["local-runtime"],
            createdAt: "2026-07-20T12:00:00.000Z",
            lastSeenAt: "2026-07-25T19:59:45.000Z",
            presence: .stale,
            state: .revoked,
            publicKeyThumbprint: "thumbprint-member"
        )
        let workspace = WorkspaceSnapshot(
            workspaceId: "workspace_one",
            workspaceHost: "one.consuelohq.com",
            currentNodeId: "node-home",
            defaultNodeId: "node-home",
            nodes: [home, member]
        )
        let homePresentation = WorkspaceNodePresentation(node: home, workspace: workspace)
        let memberPresentation = WorkspaceNodePresentation(node: member, workspace: workspace)

        try expect(homePresentation.isDefault, true, "home default marker")
        try expect(homePresentation.isSelectable, true, "active home selection")
        try expectTrue(homePresentation.subtitle.contains("online"), "online presence label")
        try expectTrue(homePresentation.subtitle.contains("local-runtime, darwin"), "capability summary")
        try expect(memberPresentation.isDefault, false, "member default marker")
        try expect(memberPresentation.isSelectable, false, "revoked node cannot be selected")
        try expectTrue(memberPresentation.subtitle.contains("stale"), "stale presence label")
    }

    private func diagnosticsRedactionRemovesRepresentativeCredentialsAndLocalPaths() throws {
        let input = Data(#"""
        {
          "status":"degraded",
          "accessToken":"oauth-secret",
          "authorization":"Bearer abc.def.ghi",
          "password":"database-secret-password",
          "nested":{"databasePassword":"nested-database-secret"},
          "tunnelOriginUrl":"https://secret.example",
          "publicKeyJwk":{"kty":"OKP"},
          "message":"failed under /Users/ko/.consuelo/generated-security/token.json"
        }
        """#.utf8)
        let output = try DiagnosticsRedactor.redactJSON(input)
        let text = String(decoding: output, as: UTF8.self)
        try expectTrue(!text.contains("oauth-secret"), "access token redaction")
        try expectTrue(!text.contains("abc.def.ghi"), "bearer token redaction")
        try expectTrue(!text.contains("database-secret-password"), "password field redaction")
        try expectTrue(!text.contains("nested-database-secret"), "password-like field redaction")
        try expectTrue(!text.contains("secret.example"), "origin redaction")
        try expectTrue(!text.contains("/Users/ko"), "local path redaction")
        try expectTrue(text.contains("[REDACTED]"), "redaction marker")

        let unsafeWorkspace = Data(#"{"workspaceId":"workspace_one","password":"must-not-decode"}"#.utf8)
        try expectThrows("password fields fail closed before workspace decoding") {
            try SafeWorkspaceDecoder.validateNoSensitiveFields(unsafeWorkspace)
        }
    }

    private func operationMessagesAreRedactedBeforeRendering() throws {
        let message = "Provider failed: Authorization: Bearer abc.def.ghi password=database-secret /Users/ko/Dev/opensaas"
        let rendered = DiagnosticsRedactor.redactText(message)

        try expectTrue(!rendered.contains("abc.def.ghi"), "operation bearer token redaction")
        try expectTrue(!rendered.contains("database-secret"), "operation password redaction")
        try expectTrue(!rendered.contains("/Users/ko"), "operation local path redaction")
        try expectTrue(rendered.contains("[REDACTED]"), "operation redaction marker")
    }

    private func offlineReasonsAreRedactedBeforeRendering() throws {
        let reason = "Authorization: Bearer abc.def.ghi password=database-secret /Users/ko/Dev/opensaas"
        let offline = snapshot(connection: .init(state: .offline, reason: reason))
        let label = MenuBarPresentation(snapshot: offline).connectionLabel

        try expectTrue(!label.contains("abc.def.ghi"), "offline bearer token redaction")
        try expectTrue(!label.contains("database-secret"), "offline password redaction")
        try expectTrue(!label.contains("/Users/ko"), "offline local path redaction")
        try expectTrue(label.contains("[REDACTED]"), "offline redaction marker")
    }

    private func lifecycleErrorsAreRedactedBeforeMenuPresentation() throws {
        let error = UnixSocketLifecycleError.invalidPath(
            "/Users/ko/.consuelo/node/security/Authorization: Bearer abc.def.ghi password=database-secret"
        )
        let rendered = DiagnosticsRedactor.redactError(error)

        try expectTrue(!rendered.contains("/Users/ko"), "lifecycle error local path redaction")
        try expectTrue(!rendered.contains("abc.def.ghi"), "lifecycle error bearer token redaction")
        try expectTrue(!rendered.contains("database-secret"), "lifecycle error password redaction")
        try expectTrue(rendered.contains("[REDACTED]"), "lifecycle error redaction marker")
    }

    private func endpointValidationRejectsNonSocketFiles() throws {
        let path = "/tmp/consuelo-macos-file-\(getpid())"
        FileManager.default.createFile(atPath: path, contents: Data("not a socket".utf8))
        defer { try? FileManager.default.removeItem(atPath: path) }
        try expectThrows("regular files cannot impersonate the lifecycle socket") {
            try UnixSocketLifecycleTransport.validateEndpoint(path)
        }
    }

    private func socketWritesDisableSigPipe() throws {
        let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else {
            throw ContractFailure.failed("test socket failed: errno \(errno)")
        }
        defer { Darwin.close(descriptor) }

        try UnixSocketLifecycleTransport.configureNoSigPipe(descriptor)

        var enabled: Int32 = 0
        var length = socklen_t(MemoryLayout<Int32>.size)
        guard Darwin.getsockopt(descriptor, SOL_SOCKET, SO_NOSIGPIPE, &enabled, &length) == 0 else {
            throw ContractFailure.failed("SO_NOSIGPIPE inspection failed: errno \(errno)")
        }
        try expect(enabled, 1, "lifecycle socket suppresses SIGPIPE")
    }

    private func socketIOUsesBoundedDeadlines() throws {
        var descriptors: [Int32] = [0, 0]
        guard Darwin.socketpair(AF_UNIX, SOCK_STREAM, 0, &descriptors) == 0 else {
            throw ContractFailure.failed("test socket pair failed: errno \(errno)")
        }
        defer {
            Darwin.close(descriptors[0])
            Darwin.close(descriptors[1])
        }

        try UnixSocketLifecycleTransport.configureIOTimeouts(descriptors[0], timeoutSeconds: 0.05)

        for option in [SO_SNDTIMEO, SO_RCVTIMEO] {
            var timeout = timeval()
            var length = socklen_t(MemoryLayout<timeval>.size)
            guard Darwin.getsockopt(descriptors[0], SOL_SOCKET, option, &timeout, &length) == 0 else {
                throw ContractFailure.failed("socket timeout inspection failed: errno \(errno)")
            }
            try expectTrue(timeout.tv_sec > 0 || timeout.tv_usec > 0, "socket timeout option \(option)")
        }

        var byte: UInt8 = 0
        let startedAt = Date()
        let received = withUnsafeMutableBytes(of: &byte) { buffer in
            Darwin.read(descriptors[0], buffer.baseAddress, buffer.count)
        }
        let elapsed = Date().timeIntervalSince(startedAt)
        try expect(received, -1, "stalled lifecycle read returns an error")
        try expectTrue(errno == EAGAIN || errno == EWOULDBLOCK, "stalled lifecycle read times out")
        try expectTrue(elapsed < 1, "lifecycle read timeout remains bounded")
    }

    private func snapshotCacheRetainsHighestObservedSequence() throws {
        let newer = snapshot().with(sequence: 9, version: "1.5.0")
        let older = snapshot().with(sequence: 8, version: "1.4.0")
        let equal = snapshot().with(sequence: 9, version: "1.5.1")
        let newest = snapshot().with(sequence: 10, version: "1.6.0")

        let retained = UnixSocketLifecycleTransport.retainNewestSnapshot(
            current: newer,
            incoming: older
        )
        try expect(retained.sequence, 9, "stale response cannot regress cached sequence")
        try expect(retained.runtime.version, "1.5.0", "stale response cannot regress cached runtime")

        let replaced = UnixSocketLifecycleTransport.retainNewestSnapshot(
            current: retained,
            incoming: equal
        )
        try expect(replaced.sequence, 9, "equal-sequence response preserves sequence")
        try expect(replaced.runtime.version, "1.5.1", "equal-sequence response replaces cached payload")

        let advanced = UnixSocketLifecycleTransport.retainNewestSnapshot(
            current: replaced,
            incoming: newest
        )
        try expect(advanced.sequence, 10, "newer response advances cached sequence")
        try expect(advanced.runtime.version, "1.6.0", "newer response advances cached runtime")
    }

    private func overlappingRefreshesRetainTheNewestSnapshot() async throws {
        let transport = DeferredLifecycleTransport()
        let client = LifecycleClient(transport: transport)
        let first = Task { try await client.refresh() }
        let second = Task { try await client.refresh() }

        try await transport.waitForPendingRequests(2)
        transport.completeRequest(at: 1, with: .snapshot(snapshot().with(sequence: 10, version: "1.6.0")))
        for _ in 0..<100 {
            if client.current()?.sequence == 10 { break }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        try expect(client.current()?.sequence, 10, "newer refresh is applied before stale completion")
        transport.completeRequest(at: 0, with: .snapshot(snapshot().with(sequence: 9, version: "1.5.0")))
        _ = try await first.value
        _ = try await second.value

        try expect(client.current()?.sequence, 10, "late stale refresh cannot regress client sequence")
        try expect(client.current()?.runtime.version, "1.6.0", "late stale refresh cannot regress client payload")
    }

    private func failedRefreshCannotOverwriteNewerSubscriptionSnapshot() async throws {
        let failure = BlockingDescriptionError()
        let transport = FailingRefreshLifecycleTransport(error: failure)
        let client = LifecycleClient(
            transport: transport,
            initialSnapshot: snapshot().with(sequence: 9, version: "1.5.0")
        )
        let subscription = client.connect { _ in }
        defer { subscription.cancel() }

        let refresh = Task { try await client.refresh() }
        try await failure.waitUntilDescriptionRequested()
        defer { failure.releaseDescription() }
        let newer = snapshot().with(sequence: 10, version: "1.6.0")
        let subscriptionUpdate = Task.detached { transport.emit(newer) }
        try await transport.waitUntilEmitCompleted()
        try expect(client.current()?.sequence, 10, "subscription update completes before failed refresh resumes")
        try expect(client.current()?.connection.state, .online, "subscription update is online before failed refresh resumes")
        failure.releaseDescription()

        let refreshSnapshot = try await refresh.value
        _ = await subscriptionUpdate.value
        try expect(refreshSnapshot.sequence, 10, "failed refresh returns newer subscription sequence")
        try expect(refreshSnapshot.connection.state, .online, "failed refresh preserves newer subscription state")
        try expect(client.current()?.sequence, 10, "failed refresh cannot overwrite newer subscription sequence")
        try expect(client.current()?.runtime.version, "1.6.0", "failed refresh cannot overwrite newer subscription payload")
        try expect(client.current()?.connection.state, .online, "newer subscription remains online")
    }

    private func rejectedLifecycleOperationsSurfaceAsErrors() async throws {
        let transport = RecordingLifecycleTransport(snapshot: snapshot(), acceptsMutations: false)
        let client = LifecycleClient(transport: transport)

        do {
            _ = try await client.send(.serviceRestart)
            throw ContractFailure.failed("rejected lifecycle operation was treated as successful")
        } catch let error as LifecycleClientError {
            try expect(error, .operationRejected("op-1"), "rejected operation error")
        }
    }

    private func framedIPCRejectsSecretBearingLifecycleResponses() async throws {
        let unsafe = Data(#"""
        {
          "schemaVersion":1,
          "sequence":1,
          "observedAt":"2026-07-26T20:00:00.000Z",
          "runtime":{"version":"1.4.0","channel":"stable","state":"running"},
          "services":[],
          "updates":{"available":0},
          "connection":{"state":"online"},
          "cloudflareApiToken":"must-never-reach-the-app"
        }
        """#.utf8)
        let server = try MockLifecycleServer(rawResponses: [unsafe])
        let serverTask = server.start()
        let transport = UnixSocketLifecycleTransport(socketPath: server.path)

        do {
            _ = try await transport.request(.statusGet)
            throw ContractFailure.failed("secret-bearing lifecycle response was accepted")
        } catch is SafeWorkspaceError {
            // Expected: transport validates the complete response before Codable decoding.
        }
        await serverTask.value
    }

    private func mockedFramedIPCReflectsAppUpdateThroughTypedStatus() async throws {
        let updating = snapshot(operation: .init(kind: .update, phase: .running))
            .with(sequence: 9, version: "1.4.0")
        let server = try MockLifecycleServer(responses: [
            .snapshot(snapshot()),
            .accepted(.init(accepted: true, operationId: "op-update")),
            .snapshot(updating),
        ])
        let serverTask = server.start()
        let transport = UnixSocketLifecycleTransport(socketPath: server.path)

        guard case let .snapshot(initial) = try await transport.request(.statusGet) else {
            throw ContractFailure.failed("mock status response was not a snapshot")
        }
        guard case let .accepted(accepted) = try await transport.request(.updateApply(targetVersion: "1.5.0")) else {
            throw ContractFailure.failed("mock update response was not accepted")
        }
        guard case let .snapshot(afterUpdate) = try await transport.request(.statusGet) else {
            throw ContractFailure.failed("mock post-update response was not a snapshot")
        }
        await serverTask.value

        try expect(initial.runtime.version, "1.4.0", "mock initial version")
        try expect(accepted.operationId, "op-update", "mock update operation")
        try expect(afterUpdate.operation?.kind, .update, "CLI-visible update operation")
        try expect(afterUpdate.operation?.phase, .running, "CLI-visible update phase")
        try expect(server.requests, [
            .statusGet,
            .updateApply(targetVersion: "1.5.0"),
            .statusGet,
        ], "framed IPC requests")
    }

    private func closingShellOnlyCancelsSubscriptionAndNeverStopsService() async throws {
        let transport = RecordingLifecycleTransport(snapshot: snapshot())
        let client = LifecycleClient(transport: transport)
        _ = client.connect { _ in }

        client.closeShell()

        try expect(transport.cancelCount, 1, "subscription cancellation")
        try expectTrue(transport.requests.isEmpty, "closing shell must not send lifecycle requests")
    }

    private func cliTriggeredSnapshotRefreshesConnectedPresentationWithoutAppRestart() async throws {
        let transport = RecordingLifecycleTransport(snapshot: snapshot())
        let client = LifecycleClient(transport: transport)
        _ = client.connect { _ in }

        transport.emit(snapshot().with(sequence: 8, version: "1.5.0"))

        try expect(client.current()?.runtime.version, "1.5.0", "CLI update propagation")
    }
}

private final class MockLifecycleServer: @unchecked Sendable {
    let path: String

    private let descriptor: Int32
    private let responses: [Data]
    private let lock = NSLock()
    private(set) var requests: [LifecycleRequest] = []

    convenience init(responses: [LifecycleResponse]) throws {
        try self.init(rawResponses: responses.map { try JSONEncoder().encode($0) })
    }

    init(rawResponses: [Data]) throws {
        responses = rawResponses
        let socket = try Self.makeSocket(backlog: rawResponses.count)
        path = socket.path
        descriptor = socket.descriptor
    }

    private static func makeSocket(backlog: Int) throws -> (path: String, descriptor: Int32) {
        let path = "/tmp/consuelo-macos-\(getpid())-\(UUID().uuidString.prefix(8)).sock"
        Darwin.unlink(path)

        let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else {
            throw ContractFailure.failed("mock server socket failed: errno \(errno)")
        }

        var address = sockaddr_un()
        let pathBytes = Array(path.utf8) + [0]
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

        let bindResult = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
                Darwin.bind(descriptor, socketAddress, socklen_t(addressLength))
            }
        }
        guard bindResult == 0 else {
            let code = errno
            Darwin.close(descriptor)
            throw ContractFailure.failed("mock server bind failed: errno \(code)")
        }
        guard Darwin.chmod(path, S_IRUSR | S_IWUSR) == 0 else {
            let code = errno
            Darwin.close(descriptor)
            Darwin.unlink(path)
            throw ContractFailure.failed("mock server chmod failed: errno \(code)")
        }
        guard Darwin.listen(descriptor, Int32(backlog)) == 0 else {
            let code = errno
            Darwin.close(descriptor)
            Darwin.unlink(path)
            throw ContractFailure.failed("mock server listen failed: errno \(code)")
        }
        return (path, descriptor)
    }

    func start() -> Task<Void, Never> {
        Task.detached { [self] in
            defer {
                Darwin.close(descriptor)
                Darwin.unlink(path)
            }
            do {
                for response in responses {
                    let client = Darwin.accept(descriptor, nil, nil)
                    guard client >= 0 else {
                        throw ContractFailure.failed("mock server accept failed: errno \(errno)")
                    }
                    defer { Darwin.close(client) }

                    let request = try JSONDecoder().decode(
                        LifecycleRequest.self,
                        from: Self.readFrame(from: client)
                    )
                    lock.withLock { requests.append(request) }
                    try Self.writeAll(try FramedJSONCodec.frame(response), to: client)
                }
            } catch {
                fputs("mock lifecycle server failed: \(error)\n", stderr)
            }
        }
    }

    private static func readFrame(from descriptor: Int32) throws -> Data {
        let header = try readExactly(4, from: descriptor)
        let count = Int(header.withUnsafeBytes { rawBuffer in
            rawBuffer.loadUnaligned(as: UInt32.self).bigEndian
        })
        guard count <= FramedJSONCodec.maximumPayloadBytes else {
            throw ContractFailure.failed("mock request exceeded frame limit")
        }
        return try readExactly(count, from: descriptor)
    }

    private static func readExactly(_ count: Int, from descriptor: Int32) throws -> Data {
        var output = Data(count: count)
        try output.withUnsafeMutableBytes { rawBuffer in
            guard let base = rawBuffer.baseAddress else { return }
            var offset = 0
            while offset < count {
                let received = Darwin.read(descriptor, base.advanced(by: offset), count - offset)
                guard received > 0 else {
                    throw ContractFailure.failed("mock server read failed: errno \(errno)")
                }
                offset += received
            }
        }
        return output
    }

    private static func writeAll(_ data: Data, to descriptor: Int32) throws {
        try data.withUnsafeBytes { rawBuffer in
            guard let base = rawBuffer.baseAddress else { return }
            var offset = 0
            while offset < rawBuffer.count {
                let written = Darwin.write(descriptor, base.advanced(by: offset), rawBuffer.count - offset)
                guard written > 0 else {
                    throw ContractFailure.failed("mock server write failed: errno \(errno)")
                }
                offset += written
            }
        }
    }
}

private final class DeferredLifecycleTransport: LifecycleTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var pending: [CheckedContinuation<LifecycleResponse, Error>?] = []

    func request(_ request: LifecycleRequest) async throws -> LifecycleResponse {
        guard request == .statusGet else {
            return .accepted(.init(accepted: true, operationId: "op-deferred"))
        }
        return try await withCheckedThrowingContinuation { continuation in
            lock.withLock { pending.append(continuation) }
        }
    }

    func subscribe(_ listener: @escaping @Sendable (LifecycleSnapshot) -> Void) -> LifecycleSubscription {
        LifecycleSubscription {}
    }

    func waitForPendingRequests(_ count: Int) async throws {
        for _ in 0..<100 {
            if lock.withLock({ pending.count }) == count { return }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        throw ContractFailure.failed("timed out waiting for \(count) overlapping lifecycle requests")
    }

    func completeRequest(at index: Int, with response: LifecycleResponse) {
        let continuation = lock.withLock { () -> CheckedContinuation<LifecycleResponse, Error>? in
            guard pending.indices.contains(index) else { return nil }
            defer { pending[index] = nil }
            return pending[index]
        }
        continuation?.resume(returning: response)
    }
}

private final class BlockingDescriptionError: Error, CustomStringConvertible, @unchecked Sendable {
    private let stateLock = NSLock()
    private var descriptionRequested = false
    private let release = DispatchSemaphore(value: 0)

    var description: String {
        stateLock.withLock { descriptionRequested = true }
        _ = release.wait(timeout: .now() + 5)
        return "simulated refresh failure"
    }

    func waitUntilDescriptionRequested() async throws {
        for _ in 0..<100 {
            if stateLock.withLock({ descriptionRequested }) { return }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        throw ContractFailure.failed("timed out waiting for refresh error projection")
    }

    func releaseDescription() {
        release.signal()
    }
}

private final class FailingRefreshLifecycleTransport: LifecycleTransport, @unchecked Sendable {
    private let error: BlockingDescriptionError
    private let lock = NSLock()
    private var listener: (@Sendable (LifecycleSnapshot) -> Void)?
    private var emitCompleted = false

    init(error: BlockingDescriptionError) {
        self.error = error
    }

    func request(_ request: LifecycleRequest) async throws -> LifecycleResponse {
        throw error
    }

    func subscribe(_ listener: @escaping @Sendable (LifecycleSnapshot) -> Void) -> LifecycleSubscription {
        lock.withLock { self.listener = listener }
        return LifecycleSubscription { [weak self] in
            guard let self else { return }
            self.lock.withLock { self.listener = nil }
        }
    }

    func emit(_ snapshot: LifecycleSnapshot) {
        let callback = lock.withLock { listener }
        callback?(snapshot)
        lock.withLock { emitCompleted = true }
    }

    func waitUntilEmitCompleted() async throws {
        for _ in 0..<100 {
            if lock.withLock({ emitCompleted }) { return }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        throw ContractFailure.failed("timed out waiting for subscription callback completion")
    }
}

private final class RecordingLifecycleTransport: LifecycleTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var listener: (@Sendable (LifecycleSnapshot) -> Void)?
    private let response: LifecycleSnapshot
    private let acceptsMutations: Bool
    private(set) var requests: [LifecycleRequest] = []
    private(set) var cancelCount = 0

    init(snapshot: LifecycleSnapshot, acceptsMutations: Bool = true) {
        response = snapshot
        self.acceptsMutations = acceptsMutations
    }

    func request(_ request: LifecycleRequest) async throws -> LifecycleResponse {
        record(request)
        if request == .statusGet { return .snapshot(response) }
        return .accepted(.init(accepted: acceptsMutations, operationId: "op-1"))
    }

    private func record(_ request: LifecycleRequest) {
        lock.lock()
        requests.append(request)
        lock.unlock()
    }

    func subscribe(_ listener: @escaping @Sendable (LifecycleSnapshot) -> Void) -> LifecycleSubscription {
        lock.lock()
        self.listener = listener
        lock.unlock()
        return LifecycleSubscription { [weak self] in
            guard let self else { return }
            self.lock.lock()
            self.cancelCount += 1
            self.listener = nil
            self.lock.unlock()
        }
    }

    func emit(_ snapshot: LifecycleSnapshot) {
        lock.lock()
        let current = listener
        lock.unlock()
        current?(snapshot)
    }
}

private extension LifecycleSnapshot {
    func with(sequence: Int, version: String) -> LifecycleSnapshot {
        var copy = self
        copy.sequence = sequence
        copy.runtime.version = version
        return copy
    }

    func withConnector(_ state: ConnectorState) -> LifecycleSnapshot {
        var copy = self
        copy.connector.state = state
        return copy
    }
}

@main
private enum ContractTestRunner {
    static func main() async {
        do {
            try await ContractSuite().run()
            print("ConsueloMac contract tests passed")
        } catch {
            fputs("ConsueloMac contract tests failed: \(error)\n", stderr)
            exit(1)
        }
    }
}
