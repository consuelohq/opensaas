public enum LoginItemRegistrationState: Equatable, Sendable {
    case enabled
    case notRegistered
    case requiresApproval
    case unavailable
}

public enum LoginItemRegistrationDecision: Equatable, Sendable {
    case register
    case leaveUnchanged
}

public enum LoginItemRegistrationPolicy {
    public static func decision(
        for state: LoginItemRegistrationState,
        isApplicationBundle: Bool
    ) -> LoginItemRegistrationDecision {
        guard isApplicationBundle else { return .leaveUnchanged }

        switch state {
        case .notRegistered:
            return .register
        case .enabled, .requiresApproval, .unavailable:
            return .leaveUnchanged
        }
    }
}
