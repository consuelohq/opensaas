// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "ConsueloMac",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "ConsueloMacCore", targets: ["ConsueloMacCore"]),
        .executable(name: "ConsueloMenuBarApp", targets: ["ConsueloMenuBarApp"]),
        .executable(name: "ConsueloMacContractTests", targets: ["ConsueloMacContractTests"]),
    ],
    targets: [
        .target(name: "ConsueloMacCore"),
        .executableTarget(
            name: "ConsueloMenuBarApp",
            dependencies: ["ConsueloMacCore"]
        ),
        .executableTarget(
            name: "ConsueloMacContractTests",
            dependencies: ["ConsueloMacCore"]
        ),
    ]
)
