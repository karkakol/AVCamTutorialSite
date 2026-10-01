#!/bin/sh
# Makes a small git repository to test the site generator against.
# It has the branches "fixture-start" and "fixture-end" that the fixture pages use.
#
#   sh content/fixtures/make-app-repo.sh /tmp/fixture-app
#   APP_REPO=/tmp/fixture-app npm run validate -- --fixtures
set -eu
DIR="${1:?Usage: make-app-repo.sh <new folder>}"
if [ -e "$DIR" ]; then echo "The folder $DIR exists already." >&2; exit 1; fi
mkdir -p "$DIR/AVCam/Views" "$DIR/AVCam/Preview Content" "$DIR/AVCam/Support"
cd "$DIR"
git init -q -b fixture-start
git config user.name "Fixture"
git config user.email "fixture@example.com"

cat > AVCam/CaptureService.swift <<'EOF'
/*
See the LICENSE.txt file for this sample’s licensing information.

Abstract:
An object that manages a capture session.
*/

import Foundation

actor CaptureService {

    private var isSetUp = false

    func start() async {
        let camera = legacyCamera()
        isSetUp = true
    }

    private func legacyCamera() -> String {
        "camera"
    }
}
EOF
cat > "AVCam/Preview Content/PreviewCameraModel.swift" <<'EOF'
import Foundation

@Observable
class PreviewCameraModel {
    var status = "unknown"
}
EOF
cat > AVCam/ContentView.swift <<'EOF'
import SwiftUI

struct ContentView: View {
    var body: some View {
        Text("Hello, world!")
    }
}
EOF
printf '<plist><dict/></plist>\n' > AVCam/Info.plist
git add -A && git commit -q -m "Start"

git switch -q -c fixture-end
cat > AVCam/CaptureService.swift <<'EOF'
/*
See the LICENSE.txt file for this sample’s licensing information.

Abstract:
An object that manages a capture session.
*/

import Foundation
@preconcurrency import AVFoundation

actor CaptureService {

    /// A value that indicates whether the capture session is running.
    @Published private(set) var isRunning = false

    private let captureSession = AVCaptureSession()
    private var isSetUp = false

    nonisolated let previewSource: PreviewSource

    init() {
        previewSource = DefaultPreviewSource(session: captureSession)
    }

    func start() async throws {
        guard await isAuthorized, !captureSession.isRunning else { return }
        try setUpSession()
        captureSession.startRunning()
        isRunning = true
    }

    private func setUpSession() throws {
        guard !isSetUp else { return }
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw CameraError.videoDeviceUnavailable
        }
        let input = try AVCaptureDeviceInput(device: camera)
        if captureSession.canAddInput(input) {
            captureSession.addInput(input)
        }
        captureSession.sessionPreset = .photo
        isSetUp = true
    }

    var isAuthorized: Bool {
        get async {
            let status = AVCaptureDevice.authorizationStatus(for: .video)
            return status == .authorized
        }
    }
}
EOF
cat > AVCam/Views/CameraPreview.swift <<'EOF'
/*
See the LICENSE.txt file for this sample’s licensing information.

Abstract:
A view that shows the video preview of the camera.
*/

import SwiftUI
@preconcurrency import AVFoundation

struct CameraPreview: UIViewRepresentable {

    private let source: PreviewSource

    init(source: PreviewSource) {
        self.source = source
    }

    func makeUIView(context: Context) -> PreviewView {
        let preview = PreviewView()
        // Connect the preview layer to the capture session.
        source.connect(to: preview)
        return preview
    }

    func updateUIView(_ previewView: PreviewView, context: Context) {
        // No implementation needed.
    }
}
EOF
cat > "AVCam/Preview Content/PreviewCameraModel.swift" <<'EOF'
import Foundation

@Observable
class PreviewCameraModel {
    var status = "unknown"

    func start() async {
        status = "running"
    }
}
EOF
cat > AVCam/Support/Generated.swift <<'EOF'
// A file that no step shows. The fixture page lists it as "uncovered".
let generatedValue = 1
EOF
git rm -q AVCam/ContentView.swift
printf '<plist><dict><key>NSCameraUsageDescription</key><string>AVCam uses the camera.</string></dict></plist>\n' > AVCam/Info.plist
git add -A && git commit -q -m "End"
git switch -q fixture-start
echo "Made $DIR with the branches fixture-start and fixture-end."
