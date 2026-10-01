---
kind: tutorial
chapter: 0
title: Fixture: every tutorial feature
abstract: A test page that uses each part of the tutorial format one time or more.
estimatedMinutes: 15
startBranch: fixture-start
branch: fixture-end
uncovered: AVCam/Support/Generated.swift
---

This page is a test for the site generator. It is not part of the real tutorial. It uses each feature of the format: sections, steps with each kind of block, text between steps, and a quiz.

The code comes from a small test repository. Run `content/fixtures/make-app-repo.sh` to make it. The file `Generated.swift` is listed as uncovered, because no step shows it. See also the [fixture article](fixture-article.md#tables).

## Set up the project

Each section starts with a short intro. The intro says what you do in the section and why. It can have one image, which the site shows next to the text.

A capture session connects [`AVCaptureDeviceInput`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput) objects to outputs.

![The capture pipeline: an input, a session, and two outputs](images/fixture-pipeline.svg)

### Step
Select the AVCam target, open the Info tab, and add the camera usage description.

The system shows this text when it asks the person for permission. Without it, the app stops when it first uses the camera.

```settings title="Target AVCam › Info"
Privacy - Camera Usage Description: AVCam uses the camera to take photos and record video.
iOS Deployment Target: 26.0
Supported Destinations: iPhone, iPad
```

### Step
In `CaptureService.swift`, delete the `legacyCamera()` method and import AVFoundation.

The `@preconcurrency` attribute tells the compiler to accept types from AVFoundation that are not marked as `Sendable`.

```swift file=AVCam/CaptureService.swift remove
    private func legacyCamera() -> String {
        "camera"
    }
```

```swift file=AVCam/CaptureService.swift highlight=2
import Foundation
@preconcurrency import AVFoundation

actor CaptureService {
```

### Note
The project does not compile at this time, because `start()` still calls the method that you deleted. You repair that in the next section.

### Step
Create a new Swift file with the name `CameraPreview.swift` in the `Views` group, and replace its contents.

A `UIViewRepresentable` type lets you show a UIKit view in SwiftUI. You need it because the preview layer is a Core Animation layer.

> [!TIP]
> Use File > New > File from Template, or press Command-N.

```swift file=AVCam/Views/CameraPreview.swift new
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
```

### Text
A plain paragraph can sit between two steps. Use it to connect two parts of a section. It can have `code`, **bold text**, and [a link](https://developer.apple.com/documentation/avfoundation).

### Step
Build and run the app in the Simulator to make sure that the project is in a good state.

You see the placeholder screen. The camera preview comes in the next section.

![The app in the Simulator with a grey preview area and a round capture button](images/fixture-screenshot.png)

## Configure the capture session

This section changes one file many times. The code panel stays on the same file and moves to the lines that change.

### Step
In `CaptureService.swift`, add the `isRunning` property and the capture session.

```swift file=AVCam/CaptureService.swift highlight=3-6
actor CaptureService {

    /// A value that indicates whether the capture session is running.
    @Published private(set) var isRunning = false

    private let captureSession = AVCaptureSession()
    private var isSetUp = false
```

### Step
Replace the body of `start()` so that it starts the session.

This is a first version. You change this method again later in this section, so the fence is `transient`.

```swift file=AVCam/CaptureService.swift remove
        let camera = legacyCamera()
        isSetUp = true
```

```swift file=AVCam/CaptureService.swift highlight=2-3 transient
    func start() async {
        captureSession.startRunning()
        isRunning = true
    }
```

### Step
Below `start()`, add the `setUpSession()` method with a configuration block.

Each change between `beginConfiguration()` and `commitConfiguration()` is applied in one operation. The `defer` statement makes sure that the commit always runs.

```swift file=AVCam/CaptureService.swift highlight=1-7
    private func setUpSession() throws {
        guard !isSetUp else { return }
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

        isSetUp = true
    }
```

### Important
Do not call `startRunning()` on the main thread. The call blocks until the session runs.

### Step
In `setUpSession()`, find the back camera and add it to the session as an input.

The line with the device lookup is long. The code panel scrolls sideways when a line does not fit.

```swift file=AVCam/CaptureService.swift highlight=3-9
        defer { captureSession.commitConfiguration() }

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw CameraError.videoDeviceUnavailable
        }
        let input = try AVCaptureDeviceInput(device: camera)
        if captureSession.canAddInput(input) {
            captureSession.addInput(input)
        }
        isSetUp = true
    }
```

### Step
Set the session preset to `.photo`.

```swift file=AVCam/CaptureService.swift highlight=3
            captureSession.addInput(input)
        }
        captureSession.sessionPreset = .photo
        isSetUp = true
```

### Experiment
Change the preset to `.high` and look at the shape of the preview. Then change it back to `.photo`.

### Step
Change `start()` so that it checks the authorization and sets up the session before it starts.

- The method now throws.
- It returns early when the session runs already.

```swift file=AVCam/CaptureService.swift highlight=1-3,6
    func start() async throws {
        guard await isAuthorized, !captureSession.isRunning else { return }
        try setUpSession()
        captureSession.startRunning()
        isRunning = true
    }
```

### Step
At the end of the actor, add the `isAuthorized` property.

```swift file=AVCam/CaptureService.swift highlight=4-9
        isSetUp = true
    }

    var isAuthorized: Bool {
        get async {
            let status = AVCaptureDevice.authorizationStatus(for: .video)
            return status == .authorized
        }
    }
}
```

### Step
Add the `previewSource` property and an initializer that creates it.

```swift file=AVCam/CaptureService.swift highlight=3-7
    private var isSetUp = false

    nonisolated let previewSource: PreviewSource

    init() {
        previewSource = DefaultPreviewSource(session: captureSession)
    }
```

## Finish the preview model

A short last section. It has a file path with a space in it and a step that only shows code without a highlight.

### Step
In `PreviewCameraModel.swift`, add a `start()` method that sets the status.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=6-9
import Foundation

@Observable
class PreviewCameraModel {
    var status = "unknown"

    func start() async {
        status = "running"
    }
}
```

### Step
Open `CameraPreview.swift` and read the code again. You do not change it in this step.

A review step has no highlighted lines.

```swift file=AVCam/Views/CameraPreview.swift
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
```

### Step
Build and run the app. The preview shows the camera feed.

![The capture pipeline diagram, used here as the result image](images/fixture-pipeline.svg)

## Check your understanding

### Why does `setUpSession()` call `beginConfiguration()` before it adds the input?

- [ ] The session does not accept inputs without it.
  > The session accepts inputs at any time. The call only groups the changes.
- [x] The session applies all changes in one operation when the code commits them.
  > Correct. The session applies the changes together when `commitConfiguration()` runs.
- [ ] The call asks the person for permission to use the camera.
  > Permission is a different API: `AVCaptureDevice.requestAccess(for:)`.

### What does this code do when the camera is not available?

```swift
guard let camera = AVCaptureDevice.default(for: .video) else {
    throw CameraError.videoDeviceUnavailable
}
```

- [x] It throws an error, and the method stops.
  > Correct. The `guard` statement leaves the method through the `throw`.
- [ ] It continues with a camera that has the value `nil`.
  > The `else` branch of a `guard` statement must leave the scope.

### Which line sets the preset for photo capture?

- [ ] Choice with a code block:
  ```swift
  captureSession.startRunning()
  ```
  > This line starts the session. It does not change the preset.
- [x] Choice with a code block:
  ```swift
  captureSession.sessionPreset = .photo
  ```
  > Correct. The `.photo` preset gives the full photo resolution.
- [ ] `captureSession.beginConfiguration()`
  > This line starts a group of changes.
