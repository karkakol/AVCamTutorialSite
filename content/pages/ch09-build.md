---
kind: tutorial
chapter: 9
title: Build: fast capture
abstract: Add zero shutter lag and log the capture switches, track the readiness of the photo output with a coordinator, send the value up to the model, and make the capture button dim and show a spinner while the output is busy.
estimatedMinutes: 35
startBranch: chapter-08
branch: chapter-09
---

In this tutorial, you add the missing part of fast capture. Chapter 7 already enabled responsive capture, fast capture prioritization, and deferred delivery. Now you enable zero shutter lag in the same place, and you log the switches. Then you add a readiness coordinator, and you make the capture button show whether the camera can take the next photo. You change seven files that you know. You add approximately 140 lines.

This chapter has the number 9 in part 1, but its code is not in the Apple sample, as in part 2, "Beyond the sample". The design is this tutorial's own. Read [Concepts: fast capture](ch09-concepts.md) first if you want the reasons for each step.

> [!IMPORTANT]
> In the Simulator with SimCam, the three capture switches report "not supported". The readiness value goes from `sessionNotRunning` to `notReadyMomentarily` after a capture, and it stays there. The Simulator never reports a waiting state.
>
> This chapter also ran on an iPhone 17 Pro Max with iOS 26. All four switches logged `true/true`. In about 15 fast taps at the quality level Quality, the iPhone took every tap and saved every photo. The readiness changed only between `ready` and `notReadyMomentarily`. It never reported a waiting state, so the dim button and the spinner did not show on this iPhone either. You can see them in the Xcode preview "Waiting for processing". The section "What a device test showed" in [Concepts: fast capture](ch09-concepts.md#what-a-device-test-showed) has the details.

## Describe the readiness

The views and the model must not use AVFoundation types. In this section, you add an enumeration that mirrors the readiness values of the photo output. Then you add the property to the three types that carry it: the `Camera` protocol, the preview model, and the real model.

### Step
In `DataTypes.swift`, add the `CaptureReadiness` enumeration with five cases, below the `CaptureActivity` enumeration.

The five cases mirror the five values of [`AVCapturePhotoOutput.CaptureReadiness`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.enum), so that no view needs `import AVFoundation`. Write `enum CaptureReadiness` with the cases `ready`, `notReadyMomentarily`, `notReadyWaitingForCapture`, `notReadyWaitingForProcessing`, and `sessionNotRunning`, in this order. Each case has a `///` comment that starts with "A status that indicates". The enumeration has no raw values and no protocols. The compiler gives it `==` because no case has an associated value.

```swift file=AVCam/Model/DataTypes.swift highlight=5-18,20
        return false
    }
}

/// An enumeration that describes whether the photo output can accept a new capture request.
///
/// This type mirrors `AVCapturePhotoOutput.CaptureReadiness` so the views don't depend on AVFoundation.
enum CaptureReadiness {
    /// A status that indicates the photo output can service a new request.
    case ready
    /// A status that indicates the output isn't ready, but may be ready again shortly.
    case notReadyMomentarily
    /// A status that indicates the output is busy capturing.
    case notReadyWaitingForCapture
    /// A status that indicates the output is busy processing.
    case notReadyWaitingForProcessing
    /// A status that indicates the capture session isn't running.
    case sessionNotRunning
    
}

/// A structure that represents a captured photo.
struct Photo: Sendable {
```

### Step
Inside the enumeration, add the computed property `isCaptureButtonDisabled` of type `Bool`, below the last case.

This property holds the rule of the button in one place. It is `true` for the two waiting states, and `false` for all others. It is `false` for `notReadyMomentarily` on purpose: this state is so short that a change of the button would flicker. The body is one expression without `return`: `self == .notReadyWaitingForCapture || self == .notReadyWaitingForProcessing`. Add a three-line `///` comment above the property: a summary, an empty `///` line, and a sentence that says why the button stays available for `notReadyMomentarily`.

```swift file=AVCam/Model/DataTypes.swift highlight=4-9
    /// A status that indicates the capture session isn't running.
    case sessionNotRunning
    
    /// A Boolean value that indicates whether the UI should disable the photo button.
    ///
    /// The button stays available for `notReadyMomentarily`. The state is too short to justify a visible change.
    var isCaptureButtonDisabled: Bool {
        self == .notReadyWaitingForCapture || self == .notReadyWaitingForProcessing
    }
}
```

### Step
In `Camera.swift`, add the read-only property `captureReadiness` of type `CaptureReadiness` to the `Camera` protocol, below `captureActivity`.

Write `var captureReadiness: CaptureReadiness { get }` with a one-line `///` comment above it: "A value that indicates whether the photo output can accept a new capture request." The views use only this protocol, so each model must have the property. The project does not compile until step 1.5, because `PreviewCameraModel` and `CameraModel` do not have it yet.

```swift file=AVCam/Model/Camera.swift highlight=4-5
    /// The camera's current activity state, which can be photo capture or idle.
    var captureActivity: CaptureActivity { get }

    /// A value that indicates whether the photo output can accept a new capture request.
    var captureReadiness: CaptureReadiness { get }

    /// The source of video content for a camera preview.
    var previewSource: PreviewSource { get }
```

### Step
In `PreviewCameraModel.swift`, add the property `captureReadiness` with the start value `.ready`, below `shouldFlashScreen`.

Write `var captureReadiness = CaptureReadiness.ready`. The property is `var`, not `private(set)`, because a preview sets it from outside (step 5.5). The start value `.ready` gives the normal button in all existing previews.

```swift file="AVCam/Preview Content/PreviewCameraModel.swift" highlight=2
    var shouldFlashScreen = false
    var captureReadiness = CaptureReadiness.ready
    
    struct PreviewSourceStub: PreviewSource {
```

### Step
In `CameraModel.swift`, add the property `captureReadiness` with the start value `.sessionNotRunning`, below `captureActivity`.

Write `private(set) var captureReadiness = CaptureReadiness.sessionNotRunning` with the `///` comment "A value that indicates whether the photo output can accept a new capture request." The value `.sessionNotRunning` is the first value that the photo output reports. Only the model sets the property, so it is `private(set)`. The class is `@Observable`, so a view that reads the property updates when it changes.

```swift file=AVCam/CameraModel.swift highlight=3-4
    private(set) var captureActivity = CaptureActivity.idle
    
    /// A value that indicates whether the photo output can accept a new capture request.
    private(set) var captureReadiness = CaptureReadiness.sessionNotRunning
    
    /// A Boolean value that indicates whether the app is currently switching video devices.
    private(set) var isSwitchingVideoDevices = false
```

### Step
Build the app to make sure that all three types agree.

Each type has the property now, so the errors from step 1.3 are gone. Nothing uses the value yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors and no warnings.
```

## Enable zero shutter lag and log the switches

Chapter 7 set three of the four fast capture switches in `updateConfiguration(for:)`. In this section, you add the fourth switch, in the right place. Then you log the values, so that you can read what the camera supports.

### Step
In `PhotoCapture.swift`, in `updateConfiguration(for:)`, add the line for zero shutter lag above the line for responsive capture.

Write `photoOutput.isZeroShutterLagEnabled = photoOutput.isZeroShutterLagSupported`. The output enables zero shutter lag by itself when it is supported, so this line changes no result. It shows the switch in the code, and it sets the value again after a change of camera. The position is important: responsive capture works only when zero shutter lag is on, so its line must come after this one.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3
        photoOutput.isLivePhotoCaptureEnabled = photoOutput.isLivePhotoCaptureSupported
        photoOutput.maxPhotoQualityPrioritization = .quality
        photoOutput.isZeroShutterLagEnabled = photoOutput.isZeroShutterLagSupported
        photoOutput.isResponsiveCaptureEnabled = photoOutput.isResponsiveCaptureSupported
        photoOutput.isFastCapturePrioritizationEnabled = photoOutput.isFastCapturePrioritizationSupported
        updateDeferredPhotoDelivery()
```

### Step
Below the line for ProRAW, log the "supported" and "enabled" values of the three switches, with a `let` constant for the output.

First write the comment `// Log the state of the capture switches so a device test can read them.` and `let output = photoOutput`. The constant has the same name as the `output` property of the class and hides it in this method. Then write three `logger.debug` calls. Their texts are `"Zero shutter lag (supported/enabled): \(output.isZeroShutterLagSupported)/\(output.isZeroShutterLagEnabled)"`, then the same form with `Responsive capture` and the two `isResponsiveCapture` properties, and with `Fast capture prioritization` and the two `isFastCapturePrioritization` properties. The values are read after all lines above, so they show the final state.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3-7
        // Enabling Apple ProRAW adds its formats to the available RAW formats.
        photoOutput.isAppleProRAWEnabled = photoOutput.isAppleProRAWSupported
        // Log the state of the capture switches so a device test can read them.
        let output = photoOutput
        logger.debug("Zero shutter lag (supported/enabled): \(output.isZeroShutterLagSupported)/\(output.isZeroShutterLagEnabled)")
        logger.debug("Responsive capture (supported/enabled): \(output.isResponsiveCaptureSupported)/\(output.isResponsiveCaptureEnabled)")
        logger.debug("Fast capture prioritization (supported/enabled): \(output.isFastCapturePrioritizationSupported)/\(output.isFastCapturePrioritizationEnabled)")
        updateCapabilities(for: device)
    }
```

### Step
Build and run the app, and read the three log lines in the Xcode console.

Type `supported` in the filter field of the console to find them. The simulated camera cannot do any of the three features, so the console shows `false/false` after each of the three texts. The existing `x = x.isSupported` pattern is safe here: it sets `false` to `false`. On an iPhone 17 Pro Max with iOS 26, the three lines showed `true/true`, and the line "Deferred photo delivery (supported/enabled)" from chapter 8 showed `true/true` too.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then read the Xcode console
Result: Simulator: Zero shutter lag (supported/enabled): false/false, and the same for responsive capture and fast capture prioritization. iPhone 17 Pro Max: true/true for all three. The app works as before.
```

## Observe the readiness of the photo output

In this section, you write the object that receives the readiness values, and you connect the coordinator to it. The first steps leave the project in a state that does not compile. The text says when it compiles again.

### Step
In `PhotoCapture.swift`, below the `PhotoCapture` class, add the private class `ReadinessObserver` with a stream and its continuation.

Write `private class ReadinessObserver: NSObject, AVCapturePhotoOutputReadinessCoordinatorDelegate`, with a `// MARK: - A delegate to observe the photo output's readiness.` line and a `///` comment above it. The coordinator needs an [`NSObject`](https://developer.apple.com/documentation/objectivec/nsobject-swift.class) as its delegate, and `PhotoCapture` is not one. Inside the class, write `let readinessStream: AsyncStream<CaptureReadiness>` and `private let readinessContinuation: AsyncStream<CaptureReadiness>.Continuation`. The project does not compile until step 3.2, because the class has no initializer.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5,7-11,13-15,17
                                           isAppleProRAWSupported: rawPixelFormat(for: .appleProRAW) != nil)
    }
}

// MARK: - A delegate to observe the photo output's readiness.

/// An object that adopts the readiness coordinator's delegate protocol and turns its callbacks into a stream.
///
/// The coordinator calls the delegate on the main queue, so the object yields each value into an
/// asynchronous stream that the capture service's actor consumes.
private class ReadinessObserver: NSObject, AVCapturePhotoOutputReadinessCoordinatorDelegate {
    
    /// A stream of readiness values that the photo output reports.
    let readinessStream: AsyncStream<CaptureReadiness>
    private let readinessContinuation: AsyncStream<CaptureReadiness>.Continuation
    
}

typealias PhotoContinuation = CheckedContinuation<Photo, Error>
```

### Step
In `ReadinessObserver`, add the initializer `override init()` that creates the stream and keeps both ends.

An [`AsyncStream`](https://developer.apple.com/documentation/swift/asyncstream) has two ends. The continuation is where the observer puts values in, and the stream is where the actor reads them out. Write `let (readinessStream, readinessContinuation) = AsyncStream.makeStream(of: CaptureReadiness.self)`. Then write `self.readinessStream = readinessStream`, `self.readinessContinuation = readinessContinuation`, and `super.init()` last. A subclass of `NSObject` must set its own properties before it calls `super.init()`. The project compiles again after this step.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-10
    /// A stream of readiness values that the photo output reports.
    let readinessStream: AsyncStream<CaptureReadiness>
    private let readinessContinuation: AsyncStream<CaptureReadiness>.Continuation
    
    override init() {
        let (readinessStream, readinessContinuation) = AsyncStream.makeStream(of: CaptureReadiness.self)
        self.readinessStream = readinessStream
        self.readinessContinuation = readinessContinuation
        super.init()
    }
    
}
```

### Step
Below the initializer, add the delegate method `readinessCoordinator(_:captureReadinessDidChange:)`, which puts each new value in the stream.

The method has two parameters: `_ coordinator: AVCapturePhotoOutputReadinessCoordinator` and `captureReadinessDidChange captureReadiness: AVCapturePhotoOutput.CaptureReadiness`. Break the line after the first parameter, as the solution shows. The body is one line: `readinessContinuation.yield(CaptureReadiness(captureReadiness))`. The coordinator calls the method on the main queue, and `yield` is safe to call from any thread. The project does not compile until step 3.4, because the `CaptureReadiness` initializer that takes an AVFoundation value does not exist yet.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-7
        super.init()
    }
    
    func readinessCoordinator(_ coordinator: AVCapturePhotoOutputReadinessCoordinator,
                              captureReadinessDidChange captureReadiness: AVCapturePhotoOutput.CaptureReadiness) {
        readinessContinuation.yield(CaptureReadiness(captureReadiness))
    }
}
```

### Step
Below `ReadinessObserver`, add a private extension of `CaptureReadiness` with an initializer that converts the AVFoundation value.

Write `private extension CaptureReadiness` with one initializer, `init(_ readiness: AVCapturePhotoOutput.CaptureReadiness)`, and a `///` comment: "Creates a readiness value from the AVFoundation value." The body is a `switch readiness` with five lines. Each of the cases `.ready`, `.notReadyMomentarily`, `.notReadyWaitingForCapture`, and `.notReadyWaitingForProcessing` has the form `case .ready: self = .ready`. The last line is `default: self = .sessionNotRunning`. The `default` covers `sessionNotRunning` and each value that Apple adds in the future. The project compiles again after this step.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-16
        readinessContinuation.yield(CaptureReadiness(captureReadiness))
    }
}

private extension CaptureReadiness {
    /// Creates a readiness value from the AVFoundation value.
    init(_ readiness: AVCapturePhotoOutput.CaptureReadiness) {
        switch readiness {
        case .ready: self = .ready
        case .notReadyMomentarily: self = .notReadyMomentarily
        case .notReadyWaitingForCapture: self = .notReadyWaitingForCapture
        case .notReadyWaitingForProcessing: self = .notReadyWaitingForProcessing
        default: self = .sessionNotRunning
        }
    }
}

typealias PhotoContinuation = CheckedContinuation<Photo, Error>
```

### Step
In the `PhotoCapture` class, add four properties below `photoOutput`: `captureReadiness`, `readinessCoordinator`, `readinessObserver`, and `readinessTask`.

Write them in this order, each with a comment line. `@Published private(set) var captureReadiness = CaptureReadiness.sessionNotRunning` holds the value. `private lazy var readinessCoordinator = AVCapturePhotoOutputReadinessCoordinator(photoOutput: photoOutput)` is `lazy`, because it needs `photoOutput`, and a stored property cannot use `self` before the class is ready. `private let readinessObserver = ReadinessObserver()` must be a stored property: the coordinator holds its delegate with a **weak** reference, and an observer that nobody holds is freed. `private var readinessTask: Task<Void, Never>?` holds the task of step 3.6.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4,5,7,8,10,11,13,14
    // An internal alias for the output.
    private var photoOutput: AVCapturePhotoOutput { output }
    
    /// A value that indicates whether the photo output can accept a new capture request.
    @Published private(set) var captureReadiness = CaptureReadiness.sessionNotRunning
    
    // An object that tracks the photo output's readiness and notifies the app on the main queue.
    private lazy var readinessCoordinator = AVCapturePhotoOutputReadinessCoordinator(photoOutput: photoOutput)
    
    // The coordinator's delegate. The coordinator holds a weak reference, so this object keeps it alive.
    private let readinessObserver = ReadinessObserver()
    
    // The task that forwards readiness changes to `captureReadiness`.
    private var readinessTask: Task<Void, Never>?
    
    // The current capabilities available.
```

### Step
Below `monitorProgress(of:)`, add the method `monitorReadiness(isolation:)`, which reads the stream and sets `captureReadiness`.

Write `private func monitorReadiness(isolation: isolated (any Actor)? = #isolation)`, with a three-line `///` comment. The method copies `monitorProgress(of:)`: the `isolation` parameter keeps the new task on the actor, so the task can write to `captureReadiness`. Inside, write `readinessTask = Task {` and `_ = isolation`. Then write a loop `for await readiness in readinessObserver.readinessStream`. In the loop, write `logger.debug("Capture readiness changed to \(String(describing: readiness))")` and `captureReadiness = readiness`. The log lines let you read the sequence of values in the console.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-17
                captureActivity = currentActivity
            }
        }
    }
    
    /// Monitors the readiness values that the coordinator's delegate produces.
    ///
    /// The delegate reports on the main queue. The stream moves each value to the capture service's actor.
    private func monitorReadiness(isolation: isolated (any Actor)? = #isolation) {
        readinessTask = Task {
            _ = isolation
            for await readiness in readinessObserver.readinessStream {
                logger.debug("Capture readiness changed to \(String(describing: readiness))")
                captureReadiness = readiness
            }
        }
    }
    
    // MARK: - Update the photo output configuration
```

### Step
At the end of `updateConfiguration(for:)`, set the coordinator's delegate and start the monitor, but only one time.

Write the comment `// Start tracking readiness once. Setting the delegate delivers the first value.` and then `if readinessTask == nil {`. Inside, write `readinessCoordinator.delegate = readinessObserver` and `monitorReadiness()`. The method runs after each change of camera, so without the test, each change would start one more task. The first use of `readinessCoordinator` creates it, and setting the [`delegate`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/delegate) makes the coordinator report the current value at once.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-6
        logger.debug("Fast capture prioritization (supported/enabled): \(output.isFastCapturePrioritizationSupported)/\(output.isFastCapturePrioritizationEnabled)")
        // Start tracking readiness once. Setting the delegate delivers the first value.
        if readinessTask == nil {
            readinessCoordinator.delegate = readinessObserver
            monitorReadiness()
        }
        updateCapabilities(for: device)
    }
```

### Step
In `capturePhoto(with:)`, tell the coordinator about the request before the call to `capturePhoto`.

Write the comment `// Tell the coordinator about the request before the capture starts.` and the call `readinessCoordinator.startTrackingCaptureRequest(using: photoSettings)`. The coordinator then counts the request in its value from this moment, before the output starts. It stops the tracking by itself when `capturePhoto` gets the same settings. The call runs on the actor, not on the main queue, so the readiness callback arrives later. The concepts article explains this trade-off.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-5
            let delegate = PhotoCaptureDelegate(continuation: continuation)
            monitorProgress(of: delegate)
            
            // Tell the coordinator about the request before the capture starts.
            readinessCoordinator.startTrackingCaptureRequest(using: photoSettings)
            
            // Capture a new photo with the specified settings.
            photoOutput.capturePhoto(with: photoSettings, delegate: delegate)
```

### Step
Build the app to make sure that the coordinator code compiles.

The class `ReadinessObserver` is complete, and `PhotoCapture` uses it. Nothing outside `PhotoCapture` reads `captureReadiness` yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors and no warnings.
```

## Send the value to the model

The readiness value is now inside the `PhotoCapture` object on the `CaptureService` actor. In this section, you move it to the actor itself, and then to the model on the main actor. You use the same pattern as for `captureActivity`.

### Step
In `CaptureService.swift`, add the published property `captureReadiness` below `captureActivity`.

Write `@Published private(set) var captureReadiness = CaptureReadiness.sessionNotRunning`, with the `///` comment "A value that indicates whether the photo output can accept a new capture request." The model reads this property as a stream in step 4.3.

```swift file=AVCam/CaptureService.swift highlight=2-3
    @Published private(set) var captureActivity: CaptureActivity = .idle
    /// A value that indicates whether the photo output can accept a new capture request.
    @Published private(set) var captureReadiness = CaptureReadiness.sessionNotRunning
    /// A value that indicates the current capture capabilities of the service.
    @Published private(set) var captureCapabilities = CaptureCapabilities.unknown
```

### Step
In `observeOutputServices()`, assign the readiness of the photo capture service to the property of the actor.

Write `photoCapture.$captureReadiness` and, on the next line, `.assign(to: &$captureReadiness)`. This copies the two lines above it. The `$` gives the publisher of a `@Published` property, and `assign(to:)` writes each new value into the property of the actor.

```swift file=AVCam/CaptureService.swift highlight=4-5
    private func observeOutputServices() {
        photoCapture.$captureActivity
            .assign(to: &$captureActivity)
        photoCapture.$captureReadiness
            .assign(to: &$captureReadiness)
    }
```

### Step
In `CameraModel.swift`, add a third `Task` to `observeState()`, above the task for the capture activity.

Write `Task {`, the comment `// Await new capture readiness values from the capture service.`, and a loop `for await readiness in await captureService.$captureReadiness.values`. In the loop, write `captureReadiness = readiness`. The first `await` belongs to the loop, and the second one is needed because the service is an actor. The other tasks in the method use the same form.

```swift file=AVCam/CameraModel.swift highlight=6-11
                    rawFormat = .off
                }
            }
        }
        
        Task {
            // Await new capture readiness values from the capture service.
            for await readiness in await captureService.$captureReadiness.values {
                captureReadiness = readiness
            }
        }
        
        Task {
            // Await new capture activity values from the capture service.
```

### Step
In `capturePhoto()` of `CameraModel`, log the readiness at the start of the method.

Add `logger.debug("Capture requested. Readiness: \(String(describing: self.captureReadiness))")` above `do`. The line shows which readiness value the app had when the person tapped. The `catch` block already logs a failed capture since chapter 8 ("Photo capture failed: ...").

```swift file=AVCam/CameraModel.swift highlight=2
    func capturePhoto() async {
        logger.debug("Capture requested. Readiness: \(String(describing: self.captureReadiness))")
        do {
            let photoFeatures = PhotoFeatures(isLivePhotoEnabled: isLivePhotoEnabled && isLivePhotoAvailable,
                                              qualityPrioritization: qualityPrioritization, rawFormat: rawFormat)
            let photo = try await captureService.capturePhoto(with: photoFeatures)
            try await mediaLibrary.save(photo: photo)
        } catch {
            // Log the error, because the app doesn't show it to the person.
            logger.error("Photo capture failed: \(error)")
            self.error = error
        }
    }
```

### Step
Build and run the app. Tap the capture button one time, and read the log lines in the Xcode console.

Type `readiness` in the filter field of the console. The first line is `Capture readiness changed to sessionNotRunning`: this is the value that the coordinator delivers when you set the delegate. After the tap, you see `Capture requested. Readiness: ...` and then `Capture readiness changed to notReadyMomentarily`. In the Simulator, the value stays there and never goes to `ready`. On an iPhone 17 Pro Max, the value goes to `ready` when the session runs, to `notReadyMomentarily` after the tap, and back to `ready`. If no `Capture requested` line appears after a tap, the tap did not reach the capture button.

```settings title="Checkpoint"
Action: Product > Run (Command-R), tap the capture button once, then read the Xcode console
Result: Capture readiness changed to sessionNotRunning at the start, then Capture requested and Capture readiness changed to notReadyMomentarily after the tap. On an iPhone: ready, then notReadyMomentarily, then ready again.
```

## Show the readiness on the capture button

In this section, you change the capture button. It disables itself and becomes dim while the output is busy. It shows a spinner while the output processes a capture. For `notReadyMomentarily`, it does not change.

### Step
In `CaptureButton.swift`, in `PhotoCaptureButton`, add the property `readiness` and a new parameter `readiness` in the initializer, and replace the old initializer line.

Write `private let readiness: CaptureReadiness` above `action`. The new initializer is `init(readiness: CaptureReadiness, action: @escaping () -> Void)`, and its first line is `self.readiness = readiness`. The project does not compile until step 5.2, because the call site does not pass a readiness yet.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift remove
    init(action: @escaping () -> Void) {
```

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=2,6,7
private struct PhotoCaptureButton: View {
    private let readiness: CaptureReadiness
    private let action: () -> Void
    private let lineWidth = CGFloat(4.0)
    
    init(readiness: CaptureReadiness, action: @escaping () -> Void) {
        self.readiness = readiness
        self.action = action
    }
```

### Step
In `captureButton`, replace the call `PhotoCaptureButton {` with a call that passes `camera.captureReadiness`.

Write `PhotoCaptureButton(readiness: camera.captureReadiness) {`. The closure stays the same. The `CaptureButton` view reads `captureReadiness` from the `Camera` protocol, so it works with the real model and with the preview model. The project compiles again after this step. The button does not look different yet.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift remove
        PhotoCaptureButton {
```

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=2
    var captureButton: some View {
        PhotoCaptureButton(readiness: camera.captureReadiness) {
            Task {
                await camera.capturePhoto()
            }
        }
    }
```

### Step
In the `body` of `PhotoCaptureButton`, below `.buttonStyle(PhotoButtonStyle())`, disable the button and add a spinner for the processing state.

Write two comment lines: `// Disable the button while the photo output is busy capturing or processing.` and `// The button stays enabled when the output is momentarily not ready, because the state is short.` Then write `.disabled(readiness.isCaptureButtonDisabled)`. Below it, still inside the `ZStack`, write `if readiness == .notReadyWaitingForProcessing {`. Inside the `if`, write the comment `// Show a progress indicator while the photo output processes a capture.`, then `ProgressView()` and `.tint(.black)`. The spinner is black, because the button is white. [`.disabled(_:)`](https://developer.apple.com/documentation/swiftui/view/disabled(_:)) stops the taps on the button.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=2-9
            .buttonStyle(PhotoButtonStyle())
            // Disable the button while the photo output is busy capturing or processing.
            // The button stays enabled when the output is momentarily not ready, because the state is short.
            .disabled(readiness.isCaptureButtonDisabled)
            if readiness == .notReadyWaitingForProcessing {
                // Show a progress indicator while the photo output processes a capture.
                ProgressView()
                    .tint(.black)
            }
        }
    }
```

### Step
Below the closing brace of the `ZStack`, dim the button in the two waiting states.

Write the comment `// Dim the button in the two waiting states.` and `.opacity(readiness.isCaptureButtonDisabled ? 0.5 : 1.0)`. The modifier is on the `ZStack`, so the ring, the button, and the spinner all become dim together. For `notReadyMomentarily`, the value is 1.0, so the button does not change.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=7-8
            if readiness == .notReadyWaitingForProcessing {
                // Show a progress indicator while the photo output processes a capture.
                ProgressView()
                    .tint(.black)
            }
        }
        // Dim the button in the two waiting states.
        .opacity(readiness.isCaptureButtonDisabled ? 0.5 : 1.0)
    }
```

### Step
Below the preview "Photo", add the preview "Waiting for processing".

Write `#Preview("Waiting for processing")` with a `PreviewBackground` that holds three lines. The first line is `let camera = PreviewCameraModel()`. The second line is `let _ = camera.captureReadiness = .notReadyWaitingForProcessing`: a view builder accepts a `let` declaration, but not a plain assignment, so the `let _ =` form turns the assignment into a declaration. The third line is `CaptureButton(camera: camera)`. This preview is the only sure place to see the dim state: the Simulator never reports a waiting state, and the test iPhone 17 Pro Max did not report one either.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=7-13
#Preview("Photo") {
    PreviewBackground {
        CaptureButton(camera: PreviewCameraModel())
    }
}

#Preview("Waiting for processing") {
    PreviewBackground {
        let camera = PreviewCameraModel()
        let _ = camera.captureReadiness = .notReadyWaitingForProcessing
        CaptureButton(camera: camera)
    }
}

private struct PhotoCaptureButton: View {
```

### Step
Open the canvas of `CaptureButton.swift` and select the two previews, one after the other.

The preview "Photo" shows the white button as before. The preview "Waiting for processing" shows the same button at half opacity, with a black spinner in the middle. Change `.notReadyWaitingForProcessing` to `.notReadyWaitingForCapture` to see the dim button without the spinner, and to `.notReadyMomentarily` to see that nothing changes. Change it back before you continue.

```settings title="Checkpoint (Xcode canvas)" result="../images/ch09-s5-1-ready.jpg|The capture button in the ready state, as the first preview shows it.; ../images/ch09-s5-1.jpg|The preview Waiting for processing: the button is dimmed and shows a spinner."
Action: Open CaptureButton.swift, show the canvas (Option-Command-Return), and select the preview "Waiting for processing"
Result: The capture button is at half opacity and a spinner is on it. In the preview "Photo", the button looks as before.
```

### Step
Build and run the app, and tap the capture button quickly several times.

In the Simulator, the button stays at full opacity, because the output reports `notReadyMomentarily` and never a waiting state. The button stays enabled, so each tap starts a capture, and the library gets several photos. The console shows a `Capture requested` line for each tap. On an iPhone 17 Pro Max, the result was the same: the button did not change, and each tap gave a photo.

```settings title="Checkpoint"
Action: Product > Run (Command-R), tap the capture button quickly five times, then open the Photos app
Result: The button does not change, the log shows the readiness values, and the library has the new photos. This is true in the Simulator and on an iPhone 17 Pro Max.
```

### Important
On an iPhone 17 Pro Max with iOS 26, about 15 fast taps at the quality level Quality gave this result. The output took every tap, and Photos got every photo. The readiness changed only between `ready` and `notReadyMomentarily`, so the button never went dim. The output did not wait: it changed the photos instead. The first and the last photo of the series came on the deferred path: 5712x4284 (24 MP) with a proxy. The photos between them came at once, as 4032x3024 (12 MP) with no proxy. This is responsive capture at work. A slower iPhone, a flash capture, or a longer series can still reach a waiting state, so keep the button rules. After a RAW capture, the readiness can also go to `sessionNotRunning` for a moment. The concepts article explains why. If you test this chapter, also look at the photo time stamps: with zero shutter lag, they can be a little earlier than the taps.

### Text
The app now enables all four fast capture switches, and the capture button shows the readiness of the photo output. The Camera Control and the AirPods remote do not look at the readiness. When you add them in later chapters, check `captureReadiness` in `CameraModel.capturePhoto()` first.

## Check your understanding

### The photo output reports `notReadyMomentarily` after a tap. What does the capture button do, and why?

- [ ] It becomes disabled for a short time, to protect the output.
  > The output continues to accept requests when it is not ready. A disabled button is not necessary, and it would flicker.
- [x] It does not change. The state is too short, and a visible change would be distracting.
  > Correct. `isCaptureButtonDisabled` is `true` only for `notReadyWaitingForCapture` and `notReadyWaitingForProcessing`.
- [ ] It shows a spinner, because the photo is in process.
  > The spinner belongs to `notReadyWaitingForProcessing`. `notReadyWaitingForCapture` and `notReadyMomentarily` show no spinner.

### Why does `PhotoCapture` keep the `ReadinessObserver` in the stored property `readinessObserver`?

- [ ] The observer must be an actor, and an actor must be a stored property.
  > The observer is an `NSObject` subclass, not an actor. The actor is `CaptureService`.
- [x] The coordinator holds its delegate with a weak reference, so an observer that nobody holds is freed and the callbacks stop.
  > Correct. The property is the strong reference that keeps the observer alive as long as `PhotoCapture` lives.
- [ ] The compiler requires a stored property for each class that adopts a delegate protocol.
  > No such rule exists. The reason is the weak reference of the coordinator.

### The app calls `startTrackingCaptureRequest(using:)` inside `PhotoCapture`, on the `CaptureService` actor. What is the result?

- [ ] The call raises an exception, because it needs the main queue.
  > The call works on any queue. Only its synchronous callback needs the main queue.
- [ ] The coordinator ignores the request, so its value does not change.
  > The coordinator counts the request. Its value changes, and the model receives it.
- [x] The delegate callback arrives later, so a very fast second tap can slip through before the button changes.
  > Correct. The coordinator calls its delegate synchronously only when the call comes from the main queue. The app takes the smaller change and accepts this limit.
