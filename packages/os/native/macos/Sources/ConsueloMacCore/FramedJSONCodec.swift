import Foundation

public enum FramedJSONError: Error, Equatable {
    case payloadTooLarge(Int)
    case incompleteHeader
    case incompletePayload(expected: Int, actual: Int)
    case invalidLength(Int)
}

public enum FramedJSONCodec {
    public static let maximumPayloadBytes = 1_048_576

    public static func frame(_ payload: Data) throws -> Data {
        guard payload.count <= maximumPayloadBytes else {
            throw FramedJSONError.payloadTooLarge(payload.count)
        }
        var length = UInt32(payload.count).bigEndian
        var framed = Data(bytes: &length, count: MemoryLayout<UInt32>.size)
        framed.append(payload)
        return framed
    }

    public static func extractFrame(from buffer: inout Data) throws -> Data {
        guard buffer.count >= 4 else { throw FramedJSONError.incompleteHeader }
        let length: UInt32 = buffer.prefix(4).withUnsafeBytes { rawBuffer in
            rawBuffer.loadUnaligned(as: UInt32.self).bigEndian
        }
        let count = Int(length)
        guard count >= 0, count <= maximumPayloadBytes else { throw FramedJSONError.invalidLength(count) }
        guard buffer.count >= 4 + count else {
            throw FramedJSONError.incompletePayload(expected: count, actual: max(0, buffer.count - 4))
        }
        let payload = Data(buffer[4..<(4 + count)])
        buffer.removeFirst(4 + count)
        return payload
    }
}
