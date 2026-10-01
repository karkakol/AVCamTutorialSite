---
kind: tutorial
chapter: 13
title: Build: Lock Screen and Control Center
abstract: Store the camera state in a capture intent, start the session from that state, and add a capture extension and a control extension to the project.
estimatedMinutes: 60
startBranch: chapter-12
branch: chapter-13
uncovered: AVCam.xcodeproj/project.pbxproj, AVCamCaptureExtension/Info.plist, AVCamControlCenterExtension/Info.plist, AVCamControlCenterExtension/Assets.xcassets/Contents.json, AVCamControlCenterExtension/Assets.xcassets/AccentColor.colorset/Contents.json, AVCamControlCenterExtension/Assets.xcassets/AppIcon.appiconset/Contents.json, AVCamControlCenterExtension/Assets.xcassets/WidgetBackground.colorset/Contents.json
---

In this tutorial, you make the app available from the Lock Screen, Control Center, and the Action button. At the end, the project has three targets: the app, a capture extension that shows the camera on a locked iPhone, and a control extension that supplies the "Open AVCam" button. The app and the capture extension share their state through a capture intent.

The work has two parts. In the first four sections, you write Swift code: a state structure, an intent, and the changes in the capture service, the model, and the app. In the last two sections, you work in the Xcode interface: you add two targets and change their settings.

After this chapter, each Swift file of your project is the same as the file in the Apple sample, with the small differences that the [wrap-up](wrap-up.md) lists. Read [Concepts: Lock Screen and Control Center](ch13-concepts.md) first. It explains what a capture extension is and which limits it has.

> [!IMPORTANT]
> Nobody tested the result of this chapter on an iPhone. The project builds without warnings, the app contains the two extensions, and the app runs in the Simulator as before. The start from the Lock Screen, Control Center, and the Action button needs a real iPhone and a development team for code signing. Where a step tells you what occurs on an iPhone, the text comes from the Apple documentation, not from a test.

## Persist the camera state

The capture extension is a second program. It must start in the mode that the person used last in the app. In this section, you write the two types that make this possible: `CameraState`, a structure with the values to share, and `AVCamCaptureIntent`, the intent that stores the structure.

The system keeps one value for the intent, the app context. Each program that contains the intent can read and replace this value.

### Step
In the `Model` group, create the file `CameraState.swift`, and replace its contents with the structure and its five properties.

The structure is `Codable`, because the system stores the [app context](https://developer.apple.com/documentation/appintents/cameracaptureintent/appcontext-swift.associatedtype) of an intent as encoded data. Each property has a `didSet` observer that calls `save()`. Thus a change of one value stores the full structure, and the code that changes a value cannot forget to save.

```swift file=AVCam/Model/CameraState.swift highlight=1-32
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A structure that provides camera state to share between the app and the extension.
*/

import os
import Foundation

struct CameraState: Codable {
    
    var isLivePhotoEnabled = true {
        didSet { save() }
    }
    
    var qualityPrioritization = QualityPrioritization.quality {
        didSet { save() }
    }
    
    var isVideoHDRSupported = true {
        didSet { save() }
    }
    
    var isVideoHDREnabled = true {
        didSet { save() }
    }
    
    var captureMode = CaptureMode.photo {
        didSet { save() }
    }
}
```

### Note
The project does not compile at this time. The observers call `save()`, which you add in the next step, and `save()` uses the intent, which you create after that.

### Step
Below the properties, add the `save()` method, which sends the structure to the system.

[`updateAppContext(_:)`](https://developer.apple.com/documentation/appintents/cameracaptureintent/updateappcontext(_:)) is an `async` method, and a `didSet` observer cannot wait. Thus the method starts a task. The task gets a copy of the structure with the values of that moment. An error goes only to the log, because the camera works without the stored state too.

```swift file=AVCam/Model/CameraState.swift highlight=4-13
    var captureMode = CaptureMode.photo {
        didSet { save() }
    }
    
    private func save() {
        Task {
            do {
                try await AVCamCaptureIntent.updateAppContext(self)
            } catch {
                os.Logger().debug("Unable to update intent context: \(error.localizedDescription)")
            }
        }
    }
}
```

### Step
Below `save()`, add the static `current` property, which reads the stored state.

[`appContext`](https://developer.apple.com/documentation/appintents/cameracaptureintent/appcontext-swift.type.property) returns `nil` when the system has no value yet, for example at the first launch. It throws when the read or the decoding fails. In the two situations, the property returns a new `CameraState` with the default values, so the caller always gets a state that it can use.

```swift file=AVCam/Model/CameraState.swift highlight=10-22
    private func save() {
        Task {
            do {
                try await AVCamCaptureIntent.updateAppContext(self)
            } catch {
                os.Logger().debug("Unable to update intent context: \(error.localizedDescription)")
            }
        }
    }
    
    static var current: CameraState {
        get async {
            do {
                if let context = try await AVCamCaptureIntent.appContext {
                    return context
                }
            } catch {
                os.Logger().debug("Unable to fetch intent context: \(error.localizedDescription)")
            }
            return CameraState()
        }
    }
}
```

### Step
In the `Model` group, create a group with the name `Intent`. In it, create the file `AVCamCaptureIntent.swift`, and replace its contents.

[`CameraCaptureIntent`](https://developer.apple.com/documentation/appintents/cameracaptureintent) tells the system that this intent starts the camera experience of the app. The `AppContext` type alias selects `CameraState` as the type of the stored value. The title and the description are the texts with which the system presents the intent. The file imports LockedCameraCapture, but it uses no type of that framework.

```swift file=AVCam/Model/Intent/AVCamCaptureIntent.swift highlight=1-19
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A camera capture intent for AVCam.
*/

import LockedCameraCapture
import AppIntents
import os

struct AVCamCaptureIntent: CameraCaptureIntent {

    /// The context object for the capture intent.
    typealias AppContext = CameraState
    
    static let title: LocalizedStringResource = "AVCamCaptureIntent"
    static let description: IntentDescription = IntentDescription("Capture photos and videos with AVCam.")
}
```

### Step
Below the description, add the `perform()` method, which each app intent must have.

The method only writes to the log. The system starts the app or the capture extension because the type conforms to `CameraCaptureIntent`, so `perform()` has nothing to open. AVCam has one screen. An app with more screens goes to its camera screen here.

```swift file=AVCam/Model/Intent/AVCamCaptureIntent.swift highlight=4-9
    static let title: LocalizedStringResource = "AVCamCaptureIntent"
    static let description: IntentDescription = IntentDescription("Capture photos and videos with AVCam.")

    @MainActor
    func perform() async throws -> some IntentResult {
        os.Logger().debug("AVCam capture intent performed successfully.")
        // The return type of this intent is None; the success status isn't user-visible.
        return .result()
    }
}
```

### Tip
Press Command-B. The project builds again. No code uses the two new types yet.

## Start the session from the state

Until now, the capture session always started in photo mode. If the stored mode is video, the app would start in photo mode and then change the mode, and the person would see a second configuration. In this section, the capture service gets the state before it configures the session, and it builds the correct session the first time.

### Step
In `CaptureService.swift`, give the `start()` method a `state` parameter.

The parameter carries the stored values into the actor. `CameraState` is a structure of simple values, so it can go from the main actor to the capture service without a problem.

```swift file=AVCam/CaptureService.swift remove
    func start() async throws {
```

```swift file=AVCam/CaptureService.swift highlight=2
    // MARK: - Capture session life cycle
    func start(with state: CameraState) async throws {
        // Exit early if not authorized or the session is already running.
        guard await isAuthorized, !captureSession.isRunning else { return }
        // Configure the session and start it.
        try setUpSession()
        captureSession.startRunning()
    }
```

### Step
At the start of the method, copy the capture mode and the HDR setting from the state into the properties of the service.

These two values decide how the session is built. The lines are above the `guard` statement, so the service has the values before `setUpSession()` runs. The other values of the state, for example the Live Photo setting, belong to one capture and not to the session, so the service does not need them here.

```swift file=AVCam/CaptureService.swift highlight=2-5
    func start(with state: CameraState) async throws {
        // Set initial operating state.
        captureMode = state.captureMode
        isHDRVideoEnabled = state.isVideoHDREnabled
        
        // Exit early if not authorized or the session is already running.
        guard await isAuthorized, !captureSession.isRunning else { return }
```

### Step
In `setUpSession()`, replace the fixed photo preset with a preset that depends on the capture mode.

The `.photo` preset is correct for photo mode. For video mode, the code selects [`.high`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/high), the same preset that `setCaptureMode(_:)` uses in chapter 8.

```swift file=AVCam/CaptureService.swift remove
            // Configure the session for photo capture.
            captureSession.sessionPreset = .photo
```

```swift file=AVCam/CaptureService.swift highlight=5-6
            // Add inputs for the default camera and microphone devices.
            activeVideoInput = try addInput(for: defaultCamera)
            try addInput(for: defaultMic)

            // Configure the session preset based on the current capture mode.
            captureSession.sessionPreset = captureMode == .photo ? .photo : .high

            // Deferred start brings up the preview first, and prepares the capture outputs a moment
```

### Step
Below the line that adds the photo output, add the movie output when the capture mode is video.

The session always has the photo output. In video mode, it needs the movie output too. The movie output gets the deferred start setting from chapter 10, with the same reason as the photo output: the preview appears first, and the system prepares the output a moment later.

```swift file=AVCam/CaptureService.swift highlight=4-9
            // Add the photo capture output as the default output type.
            photoCapture.output.isDeferredStartEnabled = photoCapture.output.isDeferredStartSupported
            try addOutput(photoCapture.output)
            // If the capture mode is set to `video`, add a movie capture output.
            if captureMode == .video {
                // Add the movie output as the default output type.
                movieCapture.output.isDeferredStartEnabled = movieCapture.output.isDeferredStartSupported
                try addOutput(movieCapture.output)
            }
            
            // Configure controls to use with the Camera Control.
            configureControls(for: defaultCamera)
```

### Step
At the end of the `if` block, apply the stored HDR setting.

`setHDRVideoEnabled(_:)` from chapter 9 selects a 10-bit format when the value is `true` and the camera has such a format. In all other situations, it sets the property to `false`. Thus the value that the service publishes is always the real state of the camera.

```swift file=AVCam/CaptureService.swift highlight=6
            // If the capture mode is set to `video`, add a movie capture output.
            if captureMode == .video {
                // Add the movie output as the default output type.
                movieCapture.output.isDeferredStartEnabled = movieCapture.output.isDeferredStartSupported
                try addOutput(movieCapture.output)
                setHDRVideoEnabled(isHDRVideoEnabled)
            }
```

### Note
The project does not compile at this time. `CameraModel` still calls `start()` without an argument. You change that call in the next section.

The Apple sample has one empty line less below `stopRecording()` than your file. This has no effect. If you want a file that is fully the same, compare it with the branch: `git diff chapter-13 -- AVCam/CaptureService.swift`.

## Read and write the state in the model

`CameraModel` is the owner of the state in each program. In this section, the model reads the stored state before it starts the camera, and it writes each change back. The same model class runs in the app and, later, in the capture extension, so this code serves the two programs.

### Step
In `Camera.swift`, add the `syncState()` method at the end of the protocol.

The app structure calls this method in a later section. The method is in the protocol, so each camera model must have it, also the preview model.

```swift file=AVCam/Model/Camera.swift highlight=3-5
    /// An error if the camera encountered a problem.
    var error: Error? { get }
    
    /// Synchronize the state of the camera with the persisted values.
    func syncState() async
}
```

### Step
In `PreviewCameraModel.swift`, add a `syncState()` method at the end of the class.

The preview model has no stored state. It only writes a line to the log, the same as its other methods. Without this method, the class does not conform to the protocol.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=5-7
    func focusAndExpose(at point: CGPoint) {
        logger.debug("Focus and expose isn't implemented in PreviewCamera.")
    }
    
    func syncState() async {
        logger.debug("Syncing state isn't implemented in PreviewCamera.")
    }
}
```

### Step
In `CameraModel.swift`, add an import of the Combine framework below the import of SwiftUI.

The model reads the publishers of the capture service with `.values`, and publishers are a part of Combine. Until now, the file compiled without this line, because the Member Import Visibility setting from chapter 1 is off. The sample has the import, and it makes clear where the publisher types come from.

```swift file=AVCam/CameraModel.swift highlight=2
import SwiftUI
import Combine
```

### Step
Below the `captureService` property, add a property for the camera state.

The model keeps one `CameraState` value. It starts with the default values, and `syncState()` replaces it with the stored value. The property is a `var`, because each change of a setting changes one value of the structure.

```swift file=AVCam/CameraModel.swift highlight=4-6
    /// An object that manages the app's capture functionality.
    private let captureService = CaptureService()
    
    /// Persistent state shared between the app and capture extension.
    private var cameraState = CameraState()
    
    init() {
```

### Step
Below the `start()` method, add the `syncState()` method. In this step, it only reads the stored state.

`CameraState.current` asks the system for the app context. The `await` is necessary because the system keeps the value outside of your process.

```swift file=AVCam/CameraModel.swift highlight=6-12
            logger.error("Failed to start capture service. \(error)")
            status = .failed
        }
    }
    
    /// Synchronizes the persistent camera state.
    ///
    /// `CameraState` represents the persistent state, such as the capture mode, that the app and extension share.
    func syncState() async {
        cameraState = await CameraState.current
    }
    
    // MARK: - Changing modes and devices
```

### Step
In `syncState()`, copy four values from the state into the properties of the model.

The views read the properties of the model, not the state. After these lines, the mode picker and the feature toolbar show the stored values. The fifth value, `isVideoHDRSupported`, is not copied: the model gets it from the capabilities of the camera.

```swift file=AVCam/CameraModel.swift highlight=3-6
    func syncState() async {
        cameraState = await CameraState.current
        captureMode = cameraState.captureMode
        qualityPrioritization = cameraState.qualityPrioritization
        isLivePhotoEnabled = cameraState.isLivePhotoEnabled
        isHDRVideoEnabled = cameraState.isVideoHDREnabled
    }
```

### Step
In `start()`, call `syncState()` before the capture service starts, and give the state to the service.

The order is the important part. The model has the stored mode before the session exists, and the service builds the session for that mode. At this time, the status is not `running`, so the `didSet` observer of `captureMode` does not ask the service for a mode change.

```swift file=AVCam/CameraModel.swift remove
            try await captureService.start()
```

```swift file=AVCam/CameraModel.swift highlight=2-3,5
        do {
            // Synchronize the state of the model with the persistent state.
            await syncState()
            // Start the capture service to start the flow of data.
            try await captureService.start(with: cameraState)
            observeState()
            status = .running
        } catch {
```

### Step
In the `didSet` observer of `captureMode`, store the new mode in the state after the service changes the mode.

The assignment starts the `didSet` observer of the property in `CameraState`, which calls `save()`. The line is inside the task and below the `await`, so the state gets the new mode only after the service finishes the change.

```swift file=AVCam/CameraModel.swift highlight=9-10
    var captureMode = CaptureMode.photo {
        didSet {
            guard status == .running else { return }
            Task {
                isSwitchingModes = true
                defer { isSwitchingModes = false }
                // Update the configuration of the capture service for the new mode.
                try? await captureService.setCaptureMode(captureMode)
                // Update the persistent state value.
                cameraState.captureMode = captureMode
            }
        }
    }
```

### Step
Give the `isLivePhotoEnabled` property a `didSet` observer that stores the value in the state.

Until now, this property needed no observer: the model reads the value when it creates the features of a capture. The observer is only for the stored state.

```swift file=AVCam/CameraModel.swift remove
    var isLivePhotoEnabled = true
```

```swift file=AVCam/CameraModel.swift highlight=2-7
    /// A Boolean value that indicates whether to capture Live Photos when capturing stills.
    var isLivePhotoEnabled = true {
        didSet {
            // Update the persistent state value.
            cameraState.isLivePhotoEnabled = isLivePhotoEnabled
        }
    }
```

### Step
Give the `qualityPrioritization` property the same type of `didSet` observer, which stores its value in the state.

`QualityPrioritization` has `Int` raw values, and `CaptureMode` has `String` raw values. Swift thus makes the two types `Codable` without more code. The raw values are a part of the stored data now. If you change them in a later version of the app, the old stored state does not decode.

```swift file=AVCam/CameraModel.swift remove
    var qualityPrioritization = QualityPrioritization.quality
```

```swift file=AVCam/CameraModel.swift highlight=2-7
    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization = QualityPrioritization.quality {
        didSet {
            // Update the persistent state value.
            cameraState.qualityPrioritization = qualityPrioritization
        }
    }
```

### Step
In the `didSet` observer of `isHDRVideoEnabled`, store the value in the state after the service applies it.

The `guard` statement stays. The model stores the HDR value only when the camera runs in video mode, because only then does the service change the format.

> [!NOTE]
> In the sample, no empty line is between the `MARK` comment and the documentation comment of this property. Delete the empty line if you want a file that is fully the same.

```swift file=AVCam/CameraModel.swift highlight=8-9
    // MARK: - Video capture
    /// A Boolean value that indicates whether the camera captures video in HDR format.
    var isHDRVideoEnabled = false {
        didSet {
            guard status == .running, captureMode == .video else { return }
            Task {
                await captureService.setHDRVideoEnabled(isHDRVideoEnabled)
                // Update the persistent state value.
                cameraState.isVideoHDREnabled = isHDRVideoEnabled
            }
        }
    }
```

### Step
In `observeState()`, store the HDR capability in the state each time the capabilities change.

The sample stores this value, but no code reads it from the state. A possible use is a control or a widget that wants to know the capability without a camera.

```swift file=AVCam/CameraModel.swift highlight=5
        Task {
            // Await updates to the capabilities that the capture service advertises.
            for await capabilities in await captureService.$captureCapabilities.values {
                isHDRVideoSupported = capabilities.isHDRSupported
                cameraState.isVideoHDRSupported = capabilities.isHDRSupported
            }
        }
```

### Tip
Press Command-B. The project builds again.

## Sync when the app becomes active

The model reads the state one time, in `start()`. This is not sufficient for the app. A person can use the app, lock the iPhone, change to video mode in the capture extension, and then open the app again. The app is still in memory, so `start()` does not run a second time.

In this section, the app reads the state again each time it becomes active. The section ends with four small changes that make your files the same as the files of the sample.

### Step
In `AVCamApp.swift`, add the scene phase from the environment below the `camera` property.

[`ScenePhase`](https://developer.apple.com/documentation/swiftui/scenephase) tells you whether the scene of the app is active, inactive, or in the background. SwiftUI supplies the value through the environment and updates it when the state changes.

```swift file=AVCam/AVCamApp.swift highlight=4-6
    // Simulator doesn't support the AVFoundation capture APIs. Use the preview camera when running in Simulator.
    @State private var camera = CameraModel()
    
    // An indication of the scene's operational state.
    @Environment(\.scenePhase) var scenePhase
    
    var body: some Scene {
```

### Step
Below the `task` modifier, add an `onChange` modifier that observes the scene phase and stops when there is nothing to do.

[`onChange(of:initial:_:)`](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)) calls its closure each time the value changes. The `guard` statement lets only one situation through: the scene becomes active, and the camera runs. At the launch, the camera does not run yet, and `start()` does the sync.

```swift file=AVCam/AVCamApp.swift highlight=5-9
                .task {
                    // Start the capture pipeline.
                    await camera.start()
                }
                // Monitor the scene phase. Synchronize the persistent state when
                // the camera is running and the app becomes active.
                .onChange(of: scenePhase) { _, newPhase in
                    guard camera.status == .running, newPhase == .active else { return }
                }
        }
    }
```

### Step
Below the `guard` statement, start a task that calls `syncState()`.

The closure of `onChange` is not `async`, so it needs a task for the `await`. `syncState()` reads the stored state and assigns the values. The status is `running` now, so the `didSet` observer of `captureMode` asks the service to change the mode.

```swift file=AVCam/AVCamApp.swift highlight=3-5
                .onChange(of: scenePhase) { _, newPhase in
                    guard camera.status == .running, newPhase == .active else { return }
                    Task { @MainActor in
                        await camera.syncState()
                    }
                }
```

### Step
In `DataTypes.swift`, add the `deviceChangeFailed` case at the end of the `CameraError` enumeration.

The sample declares this case, but no code throws it. You add it so that the file is the same as the file of the sample.

```swift file=AVCam/Model/DataTypes.swift highlight=7
enum CameraError: Error {
    case videoDeviceUnavailable
    case audioDeviceUnavailable
    case addInputFailed
    case addOutputFailed
    case setupFailed
    case deviceChangeFailed
}
```

### Step
In `PreviewCameraModel.swift`, move the `toggleRecording()` method from the end of the class to the position above `focusAndExpose(at:)`.

The order of the methods has no effect on the program. The sample has this order, and the next step adds code at the end of the class.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift remove
    func toggleRecording() {
        logger.debug("Moving capture isn't implemented in PreviewCamera.")
    }
```

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=5-8
    func capturePhoto() {
        logger.debug("Photo capture isn't implemented in PreviewCamera.")
    }
    
    func toggleRecording() {
        logger.debug("Moving capture isn't implemented in PreviewCamera.")
    }
    
    func focusAndExpose(at point: CGPoint) {
        logger.debug("Focus and expose isn't implemented in PreviewCamera.")
    }
```

### Step
Between `focusAndExpose(at:)` and `syncState()`, add the private `capabilities(for:)` method.

The method returns the capabilities that a preview can pretend to have in each mode. No code of the sample calls it. It is a helper that stayed in the file.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=5-14
    func focusAndExpose(at point: CGPoint) {
        logger.debug("Focus and expose isn't implemented in PreviewCamera.")
    }
    
    private func capabilities(for mode: CaptureMode) -> CaptureCapabilities {
        switch mode {
        case .photo:
            return CaptureCapabilities(isLivePhotoCaptureSupported: true)
        case .video:
            return CaptureCapabilities(isLivePhotoCaptureSupported: false,
                                       isHDRSupported: true)
        }
    }
    
    func syncState() async {
```

### Step
In the list of properties, add `isVideoDeviceSwitchable` below `isSwitchingModes`.

No code reads this property, and the `Camera` protocol does not have it. It is a second remainder of an older version of the sample.

> [!NOTE]
> In the sample, no empty line is between the `captureActivity` property and the `captureMode` property. Delete the empty line if you want a file that is fully the same.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=2
    private(set) var isSwitchingModes = false
    private(set) var isVideoDeviceSwitchable = true
    private(set) var isSwitchingVideoDevices = false
```

### Step
Build and run the app in the Simulator, or on your iPhone.

The app starts and works as before. The stored state has no visible effect in a first run: the default state is photo mode with Live Photo on and the quality prioritization "Quality", the same values that the model had before.

```settings title="Product › Run"
Scheme: AVCam
Result: The live preview and all controls, as at the end of chapter 12
Console, if the read of the state fails: Unable to fetch intent context
```

### Experiment
Select video mode, stop the app in Xcode, and run it again. If the system stored the app context, the app starts in video mode, and the session has the movie output from the start. Nobody verified this for the tutorial, in the Simulator or on an iPhone. If the app starts in photo mode, look for the two "Unable to" messages in the console.

## Add the capture extension

The capture extension is the program that the system starts from the Lock Screen. It is a new target in the project. In this section, you create the target from a template, replace the template code with one small file, and make the Swift files of the app a part of the extension too.

![The three targets and their source files: 25 files are in the app and the capture extension, 3 files are in all targets, and each target has its own entry point](../images/ch13-targets.svg)

Xcode writes the targets, the settings, and the file membership to `AVCam.xcodeproj/project.pbxproj`. You do not edit this file by hand, so no step shows it. The template also creates an `Info.plist` file for the extension. You do not change it, but one step tells you what it must contain.

### Important
The steps in the Xcode interface in this section and in the next section come from the templates of Xcode 27.1 and from the project file of the sample. Nobody did these steps in the Xcode interface for this tutorial: the project file on the `chapter-13` branch was written by hand. The names of a template, an option, or a setting can differ a little on your Mac. If your result is different, compare your project with the branch, or take the project file from it: `git checkout chapter-13 -- AVCam.xcodeproj/project.pbxproj`.

### Step
In Xcode, add a new target from the Capture Extension template with these options.

The template is in the Application Extension group of the iOS templates. "Embed in Application" makes the app target copy the built extension into the app, and it makes the app target depend on the extension. If Xcode asks whether it must activate a scheme for the new target, keep the `AVCam` scheme.

```settings title="File › New › Target › iOS › Capture Extension"
Product Name: AVCamCaptureExtension
Team: None
Embed in Application: AVCam
```

### Step
Look at what Xcode created, and open the `Info.plist` file of the new group.

The group `AVCamCaptureExtension` is a synchronized folder: each file in it belongs to the extension target. The `Info.plist` file names the extension point. The value `com.apple.securecapture` is what makes this target a capture extension. The key starts with `EX`, because a capture extension uses ExtensionKit.

```settings title="Project navigator › AVCamCaptureExtension"
AVCamCaptureExtension.swift: The entry point of the extension
AVCamCaptureExtensionViewFinder.swift: A viewfinder from the template
Info.plist › EXAppExtensionAttributes › EXExtensionPointIdentifier: com.apple.securecapture
Target AVCam › Build Phases: A new phase, Embed ExtensionKit Extensions
```

### Step
In the project navigator, delete the viewfinder file of the template. Select Move to Trash.

The viewfinder of the template uses `UIImagePickerController`, the simple camera interface of UIKit. Your extension shows `CameraView`, the same interface as the app.

```settings title="Project navigator › AVCamCaptureExtension"
AVCamCaptureExtensionViewFinder.swift: Delete › Move to Trash
```

### Step
Open `AVCamCaptureExtension.swift`, and replace its contents with the header, the imports, and a structure that owns a camera model.

[`LockedCameraCaptureExtension`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracaptureextension) is for the extension what the `App` protocol is for the app. The structure creates its own `CameraModel`. The extension is a separate process, so it has its own model, its own capture service, and its own capture session.

```swift file=AVCamCaptureExtension/AVCamCaptureExtension.swift highlight=1-18
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A Locked Camera Capture extension for AVCam.
*/

import ExtensionKit
import Foundation
import LockedCameraCapture
import SwiftUI
import os

@main
struct AVCamCaptureExtension: LockedCameraCaptureExtension {
    
    @State private var camera = CameraModel()
}
```

### Step
Add the `body` property with a scene that shows the camera view and starts the camera.

The content is the same as in `AVCamApp`: the camera view, a hidden status bar, and a task that calls `start()`. `CameraView` contains the `onCameraCaptureEvent` modifier from chapter 11, which a capture extension must have. The closure gets a [`LockedCameraCaptureSession`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession) in the `session` parameter. AVCam does not use it.

```swift file=AVCamCaptureExtension/AVCamCaptureExtension.swift highlight=5-15
@main
struct AVCamCaptureExtension: LockedCameraCaptureExtension {
    
    @State private var camera = CameraModel()
    
    var body: some LockedCameraCaptureExtensionScene {
        LockedCameraCaptureUIScene { session in
            CameraView(camera: camera)
                .statusBarHidden(true)
                .task {
                    // Start the capture pipeline.
                    await camera.start()
                }
        }
    }
}
```

### Step
At the end of the file, add a global logger for the extension.

The shared files use the global `logger` constant. In the app, `AVCamApp.swift` declares it. That file is not a part of the extension, so the extension must declare its own constant with the same name.

```swift file=AVCamCaptureExtension/AVCamCaptureExtension.swift highlight=5-6
        }
    }
}

/// A global logger for the app.
let logger = Logger()
```

### Step
In the project navigator, select all Swift files in the `AVCam` group except `AVCamApp.swift`. In the File inspector, add them to the extension target.

The extension uses the model, the capture service, and the views of the app, so the compiler must build these 28 files for the extension too. Each target compiles its own copy. `AVCamApp.swift` stays out: it has the `@main` type of the app, and a program can have only one entry point.

> [!TIP]
> Open the File inspector with View › Inspectors › File. To select many files, open all groups, select the first file, and Shift-click the last file. Then Command-click `AVCamApp.swift` to remove it from the selection.

```settings title="File inspector › Target Membership"
AVCamApp.swift: AVCam
All other Swift files in the AVCam group (28 files): AVCam, AVCamCaptureExtension
The asset catalogs: AVCam
```

### Step
Select the `AVCamCaptureExtension` target, and set its minimum iOS version to 26.0.

An extension cannot run on a system version that its code does not support. Use the same deployment target as the app, so that the shared code compiles for the same version in the two targets.

```settings title="Target AVCamCaptureExtension › General › Minimum Deployments"
iOS: 26.0
```

### Step
In the Build Settings tab of the extension target, give the four Swift settings the same values as in the app target.

The shared files were written for the settings of the app. For example, they use `logger` without an import of `os`, which needs Member Import Visibility set to No. With different settings in the extension, the same file can compile in one target and fail in the other.

```settings title="Target AVCamCaptureExtension › Build Settings"
Swift Language Version: Swift 5
Default Actor Isolation: nonisolated
Approachable Concurrency: No
Member Import Visibility: No
```

### Step
In the Info.plist Values group of the build settings, add three usage descriptions to the extension target.

The extension uses the camera, the microphone, and the location, the same as the app, and the system reads the descriptions from the program that asks. The texts are the same as in the app target. The sample gives the extension no Photos description: the extension uses the Photos permission of the app.

```settings title="Target AVCamCaptureExtension › Build Settings › Info.plist Values"
Privacy - Camera Usage Description: To capture photos and videos.
Privacy - Microphone Usage Description: To record audio for Live Photos and videos.
Privacy - Location When In Use Usage Description: AVCam uses your location to tag where photos and videos are taken.
```

### Step
Make sure that the bundle identifier of the extension starts with the bundle identifier of the app.

iOS accepts an extension only when its identifier is the identifier of the app, a period, and a name. Xcode writes this value when it creates the target.

```settings title="Target AVCamCaptureExtension › Signing & Capabilities"
Bundle Identifier: com.example.AVCam.AVCamCaptureExtension
```

### Tip
Press Command-B with the `AVCam` scheme. Xcode builds the extension first and then the app. If the build of the extension fails with "cannot find type" errors, a shared file is not a member of the extension target.

## Add the control extension

The capture extension has no button that starts it. That button is a control, and a control is in a widget extension. In this section, you add the third target, write the control, and check the full project.

The widget template creates an asset catalog, `Assets.xcassets`, with an accent color, a widget background color, and an app icon set. Each of these items is a folder with a `Contents.json` file. You keep the catalog as the template creates it. The template also creates an `Info.plist` file with the extension point `com.apple.widgetkit-extension`.

### Step
Add a new target from the Widget Extension template with these options.

A control is a WidgetKit feature, so it uses the widget template. You need only the control. A Live Activity and a configuration intent are for widgets that AVCam does not have.

```settings title="File › New › Target › iOS › Widget Extension"
Product Name: AVCamControlCenterExtension
Team: None
Include Control: Yes
Include Live Activity: No
Include Configuration App Intent: No
Embed in Application: AVCam
```

### Step
Look at what Xcode created. Delete the example Swift files of the template, and keep only two Swift files with these names.

The template contains an example widget and an example control. You replace them with one control. If the template gave the control file a different name, rename it or create a new file. The names of the template files were not checked for this tutorial.

```settings title="Project navigator › AVCamControlCenterExtension"
AVCamControlCenterExtension.swift: Keep, you replace its contents
AVCamControlCenterExtensionBundle.swift: Keep, you replace its contents
Other Swift files of the template: Delete › Move to Trash
Assets.xcassets: Keep
Info.plist › NSExtension › NSExtensionPointIdentifier: com.apple.widgetkit-extension
Target AVCam › Build Phases: A new phase, Embed Foundation Extensions
```

### Step
Open `AVCamControlCenterExtension.swift`, and replace its contents with the header, the imports, and a control structure with three static properties.

[`ControlWidget`](https://developer.apple.com/documentation/swiftui/controlwidget) is the protocol of a control. The `kind` string identifies this control for the system. It looks like a bundle identifier, but it is only a name. Do not change it after people have the app: a control with a new `kind` is a new control, and the old one disappears.

```swift file=AVCamControlCenterExtension/AVCamControlCenterExtension.swift highlight=1-17
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A Control Center extension for AVCam.
*/

import SwiftUI
import WidgetKit
import AppIntents

struct AVCamControlCenterExtension: ControlWidget {
    
    static var kind = "com.example.AVCam.AVCamControlCenterExtension.ControlButton"
    static var displayName: LocalizedStringResource = "Open AVCam"
    static var description: LocalizedStringResource = "Launch AVCam app."
}
```

### Step
Add the `body` property with a static configuration that contains one button.

[`StaticControlConfiguration`](https://developer.apple.com/documentation/widgetkit/staticcontrolconfiguration) is for a control without options. [`ControlWidgetButton`](https://developer.apple.com/documentation/widgetkit/controlwidgetbutton) performs an intent when the person presses the control. The intent is `AVCamCaptureIntent`, and this is the connection to the capture extension: only a capture intent lets the system start the camera on a locked device. The display name and the description appear in the list where the person selects a control.

```swift file=AVCamControlCenterExtension/AVCamControlCenterExtension.swift highlight=7-15
struct AVCamControlCenterExtension: ControlWidget {
    
    static var kind = "com.example.AVCam.AVCamControlCenterExtension.ControlButton"
    static var displayName: LocalizedStringResource = "Open AVCam"
    static var description: LocalizedStringResource = "Launch AVCam app."
    
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: AVCamControlCenterExtension.kind) {
            ControlWidgetButton(action: AVCamCaptureIntent()) {
                Label("Open AVCam", systemImage: "curlybraces")
            }
        }
        .displayName(AVCamControlCenterExtension.displayName)
        .description(AVCamControlCenterExtension.description)
    }
}
```

### Step
Open `AVCamControlCenterExtensionBundle.swift`, and replace its contents with a widget bundle that contains the control.

A [`WidgetBundle`](https://developer.apple.com/documentation/swiftui/widgetbundle) is the entry point of a widget extension. Its `body` lists what the extension supplies. Here, that is the one control.

```swift file=AVCamControlCenterExtension/AVCamControlCenterExtensionBundle.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A Control Center extension bundle for AVCam.
*/

import WidgetKit
import SwiftUI

@main
struct AVCamControlCenterExtensionBundle: WidgetBundle {
    var body: some Widget {
        AVCamControlCenterExtension()
    }
}
```

### Step
In the project navigator, select three files of the `Model` group. In the File inspector, add them to the control extension target.

The control creates an `AVCamCaptureIntent`, so the extension must compile the intent. The intent names `CameraState`, and `CameraState` uses two enumerations from `DataTypes.swift`. No other file of the app is necessary. After this step, the intent is a part of all three targets, which the system needs.

```settings title="File inspector › Target Membership"
Model/CameraState.swift: AVCam, AVCamCaptureExtension, AVCamControlCenterExtension
Model/DataTypes.swift: AVCam, AVCamCaptureExtension, AVCamControlCenterExtension
Model/Intent/AVCamCaptureIntent.swift: AVCam, AVCamCaptureExtension, AVCamControlCenterExtension
```

### Step
Select the `AVCamControlCenterExtension` target. Set its minimum iOS version and its Swift settings to the values of the other targets.

The three shared files must compile with the same settings in each target. The control extension needs no usage descriptions, because it never opens the camera.

```settings title="Target AVCamControlCenterExtension › General and Build Settings"
Minimum Deployments › iOS: 26.0
Swift Language Version: Swift 5
Default Actor Isolation: nonisolated
Approachable Concurrency: No
Member Import Visibility: No
Bundle Identifier: com.example.AVCam.AVCamControlCenterExtension
```

### Step
Select the `AVCam` target, and check its build phases.

The app target must build the two extensions first and then copy them into the app. The two systems for extensions use different folders. An ExtensionKit extension goes into `Extensions`, and a widget extension goes into `PlugIns`.

```settings title="Target AVCam › Build Phases"
Target Dependencies: AVCamCaptureExtension, AVCamControlCenterExtension
Embed ExtensionKit Extensions: AVCamCaptureExtension.appex
Embed Foundation Extensions: AVCamControlCenterExtension.appex
```

### Step
Build and run the `AVCam` scheme in the Simulator. Then look into the built app.

The app works as at the end of the fourth section. This is the result that was verified for this tutorial: the build has no errors and no warnings, and the app contains the two extensions. To see them, select Product › Show Build Folder in Finder, find `AVCam.app` in the `Products` folder, and select Show Package Contents.

```settings title="AVCam.app › Show Package Contents"
Extensions: AVCamCaptureExtension.appex
PlugIns: AVCamControlCenterExtension.appex
```

### Step
To try the feature on an iPhone, select your development team for each of the three targets, and run the app.

All three targets must have the same team. Open the app one time and give it access to the camera, the microphone, Photos, and the location, because the capture extension uses the permissions of the app. Then add the control and use it. Nobody did this test for the tutorial, so the rows below tell you what the Apple documentation describes.

```settings title="On an iPhone (not tested for this tutorial)"
Signing & Capabilities › Team: The same team for AVCam and the two extensions
Control Center: Press and hold an empty area, add a control, select Open AVCam
Lock Screen: Customize the Lock Screen, and replace one of the two controls at the bottom
Action button: Settings › Action Button, select a control
Expected on a locked iPhone: The camera interface of AVCam appears without an unlock
```

### Text
This is what the code does when the capture extension starts:

1. The system starts the extension process and creates the scene. `CameraView` appears.
2. The `task` modifier calls `camera.start()`. The model calls `syncState()`, which reads the app context that the app wrote.
3. The model gives the state to the capture service. The service builds the session for the stored mode and starts it.
4. The person takes a photo. `MediaLibrary` writes it to the Photos library, the same as in the app.
5. The person changes the mode. The `didSet` observers write the new state to the system.
6. Later, the person opens the app. The scene becomes active, and the `onChange` modifier calls `syncState()`. The app changes to the mode that the person selected in the extension.

You have the full AVCam sample now. Go to the [wrap-up](wrap-up.md) for a summary of what you built, a list of the weak points of the sample, and ideas for your next steps.

## Check your understanding

### Why does AVCam store the shared state in the app context of the capture intent, and not in `UserDefaults` of an App Group?

- [ ] The app context is faster than `UserDefaults`.
  > Speed is not the reason. A read of the app context is an `async` call to the system.
- [x] A capture extension cannot read or write an App Group container. The app context is the supported way to share state with it.
  > Correct. On a locked device, the extension has no access to shared containers. The system stores the app context and gives it to each program that contains the intent.
- [ ] `UserDefaults` cannot store an enumeration.
  > An enumeration with raw values is easy to store in `UserDefaults`. The problem is the access from the extension.

### At the first call of `start()`, `syncState()` runs this line while the status of the model is `unknown`. The stored mode is video. What occurs?

```swift
captureMode = cameraState.captureMode
```

- [ ] The `didSet` observer calls `setCaptureMode(_:)`, and the service changes a session that does not exist yet.
  > The observer starts with `guard status == .running`. The status is not `running` during the start, so the observer returns.
- [x] The model only gets the value. The service gets the mode through `start(with:)` and builds the session for video mode directly.
  > Correct. The `guard` statement in the observer stops the mode change. `setUpSession()` then selects the `.high` preset and adds the movie output.
- [ ] Nothing. The model ignores the stored mode until the app becomes active.
  > The assignment changes the property, so the mode picker shows video. The `onChange` modifier is for later activations.

### `AVCamCaptureExtension.swift` declares `let logger = Logger()`, although `AVCamApp.swift` has the same line. Why?

- [ ] Each Swift file needs its own logger.
  > A global constant is visible in all files of its target. Most files of the app use the logger of `AVCamApp.swift`.
- [ ] The extension must write to a different log than the app.
  > The two loggers are the same default logger. The system separates the messages by process.
- [x] `AVCamApp.swift` is not a part of the extension target, because it contains the `@main` type of the app. The shared files still need a `logger` constant.
  > Correct. A program can have only one entry point, so the app file stays out. The extension then supplies the global constant that the shared files use.
