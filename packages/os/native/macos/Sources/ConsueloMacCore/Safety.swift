import Foundation

public enum SafeWorkspaceError: Error, Equatable {
    case invalidRoot
    case forbiddenField(String)
}

public enum SafeWorkspaceDecoder {
    private static let forbiddenFields: Set<String> = [
        "accesstoken", "refreshtoken", "authorization", "token", "secret", "privatekey",
        "privatekeyjwk", "publickeyjwk", "tunneloriginurl", "tunnelcredentials",
        "localservice", "localserviceurl", "credential", "credentials", "password", "passphrase",
        "passwd", "pwd",
    ]

    public static func decode(_ data: Data) throws -> WorkspaceSnapshot {
        try validateNoSensitiveFields(data)
        return try JSONDecoder().decode(WorkspaceSnapshot.self, from: data)
    }

    public static func validateNoSensitiveFields(_ data: Data) throws {
        let json = try JSONSerialization.jsonObject(with: data)
        guard json is [String: Any] else { throw SafeWorkspaceError.invalidRoot }
        try inspect(json)
    }

    private static func inspect(_ value: Any) throws {
        if let dictionary = value as? [String: Any] {
            for (key, child) in dictionary {
                if isSensitiveField(key) {
                    throw SafeWorkspaceError.forbiddenField(key)
                }
                try inspect(child)
            }
        } else if let array = value as? [Any] {
            for child in array { try inspect(child) }
        }
    }

    private static func isSensitiveField(_ key: String) -> Bool {
        let normalized = key.lowercased()
        return forbiddenFields.contains(normalized)
            || normalized.contains("token")
            || normalized.contains("secret")
            || normalized.contains("credential")
            || normalized.contains("privatekey")
            || normalized.contains("authorization")
            || normalized.contains("tunnelorigin")
            || normalized.contains("localservice")
            || normalized.contains("password")
            || normalized.contains("passphrase")
            || normalized == "passwd"
            || normalized == "pwd"
    }
}

public enum DiagnosticsRedactor {
    private static let sensitiveFields: Set<String> = [
        "accesstoken", "refreshtoken", "authorization", "token", "secret", "privatekey",
        "privatekeyjwk", "publickeyjwk", "tunneloriginurl", "tunnelcredentials",
        "credential", "credentials", "password", "passphrase", "passwd", "pwd",
    ]

    public static func redactJSON(_ data: Data) throws -> Data {
        let json = try JSONSerialization.jsonObject(with: data)
        let redacted = redact(json)
        return try JSONSerialization.data(withJSONObject: redacted, options: [.prettyPrinted, .sortedKeys])
    }

    public static func redactText(_ value: String) -> String {
        redactString(value)
    }

    public static func redactError(_ error: Error) -> String {
        redactString(String(describing: error))
    }

    private static func redact(_ value: Any, key: String? = nil) -> Any {
        if let key, isSensitiveField(key) {
            return "[REDACTED]"
        }
        if let dictionary = value as? [String: Any] {
            var output: [String: Any] = [:]
            for (childKey, child) in dictionary {
                output[childKey] = redact(child, key: childKey)
            }
            return output
        }
        if let array = value as? [Any] {
            return array.map { redact($0) }
        }
        if let string = value as? String {
            return redactString(string)
        }
        return value
    }

    private static func isSensitiveField(_ key: String) -> Bool {
        let normalized = key.lowercased()
        return sensitiveFields.contains(normalized)
            || normalized.contains("token")
            || normalized.contains("secret")
            || normalized.contains("credential")
            || normalized.contains("privatekey")
            || normalized.contains("authorization")
            || normalized.contains("tunnelorigin")
            || normalized.contains("providerkey")
            || normalized.contains("cloudflare")
            || normalized.contains("password")
            || normalized.contains("passphrase")
            || normalized == "passwd"
            || normalized == "pwd"
    }

    private static func redactString(_ value: String) -> String {
        var output = value
        let patterns: [(String, String)] = [
            (#"(?i)Bearer\s+[A-Za-z0-9._~+\-/]+=*"#, "Bearer [REDACTED]"),
            (#"/Users/[^/\s]+"#, "/Users/[REDACTED]"),
            (#"(?i)(token|secret|password)=([^&\s]+)"#, "$1=[REDACTED]"),
        ]
        for (pattern, replacement) in patterns {
            output = output.replacingOccurrences(of: pattern, with: replacement, options: .regularExpression)
        }
        return output
    }
}
