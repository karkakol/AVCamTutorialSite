---
kind: tutorial
chapter: 3
title: Build: take a photo
abstract: Add a photo output, turn its delegate callbacks into async code, and take a photo with a capture button.
estimatedMinutes: 45
startBranch: chapter-02
branch: chapter-03
---

In this tutorial, you add photo capture to the app. At the end, a tap on the capture button takes a photo, the preview flashes, and the Xcode console shows the size of the photo data.

You write a small service around [`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput). Then you turn its delegate callbacks into one `async` method, add the output to the capture session, and connect a button.

The app does not save the photo in this chapter. Chapter 4 saves it to the Photos library. Read [Concepts: take a photo](ch03-concepts.md) first if you want the background for each step.

## Describe a capture

The capture service actor owns the capture code. The views run on the main actor. In this section, you define the small types that carry the state of a capture between these two sides.

You also define the `OutputService` protocol. It is the common interface of each object that manages a capture output. The photo service adopts it in this chapter. The movie service adopts it in chapter 8.

### Step
In `DataTypes.swift`, add the `CaptureActivity` enumeration with its two cases below the `CameraStatus` enumeration.

The capture service uses this type to tell the interface what it does at this time. The `willCapture` value marks the moment when the camera starts the exposure. Chapter 7 adds a Live Photo value to the case, and chapter 8 adds a case for movies.

```swift file=AVCam/Model/DataTypes.swift highlight=5-12
    /// A status that indicates the camera is successfully running.
    case running
}

/// An enumeration that defines the activity states the capture service supports.
///
/// This type provides feedback to the UI regarding the active status of the `CaptureService` actor.
enum CaptureActivity {
    case idle
    /// A status that indicates the capture service is performing photo capture.
    case photoCapture(willCapture: Bool = false)
}
```

### Step
Add the `willCapture` computed property to the `CaptureActivity` enumeration, below its two cases.

With this property, the caller reads the value without a `switch` statement. The property returns `false` for each case that is not a photo capture.

```swift file=AVCam/Model/DataTypes.swift highlight=6-11
enum CaptureActivity {
    case idle
    /// A status that indicates the capture service is performing photo capture.
    case photoCapture(willCapture: Bool = false)
    
    var willCapture: Bool {
        if case .photoCapture(let willCapture) = self {
            return willCapture
        }
        return false
    }
}
```

### Step
Below `CaptureActivity`, add the `Photo` structure. Then add the `addOutputFailed` case to `CameraError`.

`Photo` holds the complete photo file as `Data`. The value goes from the capture actor to the main actor, so the type must be `Sendable`. `Data` is `Sendable`, but the [`AVCapturePhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto) object from the camera is not.

```swift file=AVCam/Model/DataTypes.swift highlight=3-6,11
}

/// A structure that represents a captured photo.
struct Photo: Sendable {
    let data: Data
}

enum CameraError: Error {
    case videoDeviceUnavailable
    case addInputFailed
    case addOutputFailed
    case setupFailed
}
```

### Step
At the end of the file, add the `OutputService` protocol.

The associated type lets each service name its own output class, for example `AVCapturePhotoOutput`. The capture service can then keep all its output services in one array and send the same message to each of them.

```swift file=AVCam/Model/DataTypes.swift highlight=8-14
enum CameraError: Error {
    case videoDeviceUnavailable
    case addInputFailed
    case addOutputFailed
    case setupFailed
}

protocol OutputService {
    associatedtype Output: AVCaptureOutput
    var output: Output { get }
    var captureActivity: CaptureActivity { get }
    func updateConfiguration(for device: AVCaptureDevice)
    func setVideoRotationAngle(_ angle: CGFloat)
}
```

### Step
Below the protocol, add an extension with a default implementation of the two methods.

Each capture output has a connection that carries the video from the camera. The rotation angle of this connection decides the orientation of the result. This code is the same for each output, so it is in the extension. You use it later, when you set the orientation of the photo.

```swift file=AVCam/Model/DataTypes.swift highlight=9-15
protocol OutputService {
    associatedtype Output: AVCaptureOutput
    var output: Output { get }
    var captureActivity: CaptureActivity { get }
    func updateConfiguration(for device: AVCaptureDevice)
    func setVideoRotationAngle(_ angle: CGFloat)
}

extension OutputService {
    func setVideoRotationAngle(_ angle: CGFloat) {
        // Set the rotation angle on the output object's video connection.
        output.connection(with: .video)?.videoRotationAngle = angle
    }
    func updateConfiguration(for device: AVCaptureDevice) {}
}
```

### Step
Build the project to make sure that the new types compile.

No code uses the new types yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Create the photo capture service

In this section, you create `PhotoCapture`. This object owns the photo output and knows how to configure it.

Photo capture has two levels of configuration. You set limits on the output one time, before a capture. Then each capture gets its own [`AVCapturePhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings) object, which chooses values inside these limits. You write the code for the two levels here.

### Step
Create a new Swift file with the name `CaptureExtensions.swift` in the `Support` group, and replace its contents.

`CMVideoDimensions` is a C structure with a width and a height. It cannot be compared, and it has no zero value. This extension adds these two things. The `@retroactive` attribute tells the compiler that you add the conformance to a type from a different module on purpose.

```swift file=AVCam/Support/CaptureExtensions.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
Extensions on AVFoundation capture and related types.
*/

import AVFoundation

extension CMVideoDimensions: @retroactive Equatable, @retroactive Comparable {
    
    static let zero = CMVideoDimensions()
    
    public static func == (lhs: CMVideoDimensions, rhs: CMVideoDimensions) -> Bool {
        lhs.width == rhs.width && lhs.height == rhs.height
    }
    
    public static func < (lhs: CMVideoDimensions, rhs: CMVideoDimensions) -> Bool {
        lhs.width < rhs.width && lhs.height < rhs.height
    }
}
```

### Step
Create a new Swift file with the name `PhotoCapture.swift` in the `Capture` group, and replace its contents.

`PhotoCapture` is a normal class, not an actor. The capture service owns it and calls it. The `output` property and the `captureActivity` property satisfy the `OutputService` protocol. `@Published` gives the class a Combine publisher, `$captureActivity`, which the capture service reads later.

```swift file=AVCam/Capture/PhotoCapture.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
An object that manages a photo capture output to take photographs.
*/

import AVFoundation
import CoreImage

enum PhotoCaptureError: Error {
    case noPhotoData
}

/// An object that manages a photo capture output to perform take photographs.
final class PhotoCapture: OutputService {
    
    /// A value that indicates the current state of photo capture.
    @Published private(set) var captureActivity: CaptureActivity = .idle
    
    /// The capture output type for this service.
    let output = AVCapturePhotoOutput()
    
    // An internal alias for the output.
    private var photoOutput: AVCapturePhotoOutput { output }
    
}
```

### Step
At the end of the `PhotoCapture` class, add the `updateConfiguration(for:)` method, which sets the largest photo size.

The active format of a camera has a list of photo sizes that it supports. The [`maxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotodimensions) property of the output is the upper limit for all photos. The output prepares its resources for this size. The code takes the last size in the list and assumes that the last size is the largest one.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4,6-13
    // An internal alias for the output.
    private var photoOutput: AVCapturePhotoOutput { output }
    
    // MARK: - Update the photo output configuration
    
    /// Reconfigures the photo output and updates the output service's capabilities accordingly.
    ///
    /// The `CaptureService` calls this method whenever you change cameras.
    ///
    func updateConfiguration(for device: AVCaptureDevice) {
        // Enable all supported features.
        photoOutput.maxPhotoDimensions = device.activeFormat.supportedMaxPhotoDimensions.last ?? .zero
    }
}
```

### Step
Above the `// MARK: - Update the photo output configuration` line, add the `createPhotoSettings()` method.

A settings object describes one photo. You must make a new settings object for each capture, because the output accepts each object only one time. If you use an object again, the output raises an exception, and the app stops.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4,6-7,9-12
    // An internal alias for the output.
    private var photoOutput: AVCapturePhotoOutput { output }
    
    // MARK: - Create a photo settings object.
    
    // Create a photo settings object to configure the photo capture.
    private func createPhotoSettings() -> AVCapturePhotoSettings {
        
        // Create a new settings object to configure the photo capture.
        var photoSettings = AVCapturePhotoSettings()
        return photoSettings
    }
    
    // MARK: - Update the photo output configuration
```

### Step
Ask for the HEVC codec when the photo output supports it.

Settings with no format give a JPEG file. Settings with the HEVC codec give a HEIF file, which is smaller at the same quality. The list of available codecs depends on the camera and the session, so the code tests it for each photo.

> [!NOTE]
> In the Simulator with SimCam, the photo is a JPEG file.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=7-10
    // Create a photo settings object to configure the photo capture.
    private func createPhotoSettings() -> AVCapturePhotoSettings {
        
        // Create a new settings object to configure the photo capture.
        var photoSettings = AVCapturePhotoSettings()
        
        // Capture photos in HEIF format when the device supports it.
        if photoOutput.availablePhotoCodecTypes.contains(.hevc) {
            photoSettings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
        }
        
        return photoSettings
    }
```

### Step
Request a preview image in the first pixel format that the settings object offers.

A preview image is a small image without compression that arrives together with the photo. An app can show it immediately. The Apple sample requests it but does not read it. You keep the lines so that your code stays equal to the sample.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-10
        // Capture photos in HEIF format when the device supports it.
        if photoOutput.availablePhotoCodecTypes.contains(.hevc) {
            photoSettings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
        }
        
        /// Set the format of the preview image to capture. The `photoSettings` object returns the available
        /// preview format types in order of compatibility with the primary image.
        if let previewPhotoPixelFormatType = photoSettings.availablePreviewPhotoPixelFormatTypes.first {
            photoSettings.previewPhotoFormat = [kCVPixelBufferPixelFormatTypeKey as String: previewPhotoPixelFormatType]
        }
        
        return photoSettings
    }
```

### Step
Copy the largest photo size from the photo output to the settings object.

The limit on the output does not select the size of a photo. Each settings object has its own [`maxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/maxphotodimensions) value, and its default is the smallest size that the format supports. Without this line, each photo has the smallest size.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=7-10
        /// Set the format of the preview image to capture. The `photoSettings` object returns the available
        /// preview format types in order of compatibility with the primary image.
        if let previewPhotoPixelFormatType = photoSettings.availablePreviewPhotoPixelFormatTypes.first {
            photoSettings.previewPhotoFormat = [kCVPixelBufferPixelFormatTypeKey as String: previewPhotoPixelFormatType]
        }
        
        /// Set the largest dimensions that the photo output supports.
        /// `CaptureService` automatically updates the photo output's `maxPhotoDimensions`
        /// when the capture pipeline changes.
        photoSettings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        
        return photoSettings
    }
```

### Step
Build the project to make sure that `PhotoCapture` conforms to `OutputService`.

The class can configure the output and can make settings, but it cannot start a capture yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Create the capture delegate

The photo output does not return a photo from a method. It calls the methods of a delegate while the capture moves through its stages. In this section, you write this delegate. You create one delegate object for each capture.

The delegate has two jobs. It reports the progress of the capture, and it delivers the result when the capture is complete.

![The delegate callbacks of one capture in order, and what AVCam does in each callback](../images/ch03-capture-timeline.svg)

### Step
In `PhotoCapture.swift`, add the `PhotoContinuation` type alias and the `PhotoCaptureDelegate` class below the `PhotoCapture` class.

A [`CheckedContinuation`](https://developer.apple.com/documentation/swift/checkedcontinuation) stands for a caller that waits in an `async` method. The delegate keeps it and uses it at the end to give the photo to that caller. The class inherits from `NSObject` because [`AVCapturePhotoCaptureDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate) is an Objective-C protocol.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=7,9,11-14,16,18
    func updateConfiguration(for device: AVCaptureDevice) {
        // Enable all supported features.
        photoOutput.maxPhotoDimensions = device.activeFormat.supportedMaxPhotoDimensions.last ?? .zero
    }
}

typealias PhotoContinuation = CheckedContinuation<Photo, Error>

// MARK: - A photo capture delegate to process the captured photo.

/// An object that adopts the `AVCapturePhotoCaptureDelegate` protocol to respond to photo capture life-cycle events.
///
/// The delegate produces a stream of events that indicate its current state of processing.
private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    
    private let continuation: PhotoContinuation
    
}
```

### Step
Add a property for the photo data, and two properties for a stream of activity values.

A continuation can deliver only one value. The interface also needs progress values during the capture, for example to flash the screen. An [`AsyncStream`](https://developer.apple.com/documentation/swift/asyncstream) can deliver many values, so the delegate uses a stream for the progress.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5,7-9
private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    
    private let continuation: PhotoContinuation
    
    private var photoData: Data?
    
    /// A stream of capture activity values that indicate the current state of progress.
    let activityStream: AsyncStream<CaptureActivity>
    private let activityContinuation: AsyncStream<CaptureActivity>.Continuation
    
}
```

### Step
Add the initializer, which keeps the continuation and makes the stream.

The `makeStream(of:)` method returns two parts. Other code reads values from the stream. The delegate writes values through the continuation of the stream.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-7,9-12
    /// A stream of capture activity values that indicate the current state of progress.
    let activityStream: AsyncStream<CaptureActivity>
    private let activityContinuation: AsyncStream<CaptureActivity>.Continuation
    
    /// Creates a new delegate object with the checked continuation to call when processing is complete.
    init(continuation: PhotoContinuation) {
        self.continuation = continuation
        
        let (activityStream, activityContinuation) = AsyncStream.makeStream(of: CaptureActivity.self)
        self.activityStream = activityStream
        self.activityContinuation = activityContinuation
    }
    
}
```

### Step
Add the two delegate methods that the photo output calls before the capture.

`willBeginCaptureFor` is always the first callback. `willCapturePhotoFor` arrives when the exposure starts, immediately after the shutter sound. This is the correct moment for the screen flash, so the delegate sends a value with `willCapture: true`. The moment of the tap is too early.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3-6,8-11
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, willBeginCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Signal that the photo output accepts the capture request.
        activityContinuation.yield(.photoCapture())
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, willCapturePhotoFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Signal that a capture is beginning.
        activityContinuation.yield(.photoCapture(willCapture: true))
    }
    
}
```

### Step
Add the `didFinishProcessingPhoto` method, which keeps the photo as file data.

The [`fileDataRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation()) method makes the complete file in memory. The delegate does not resume the continuation here. This callback is not the last one, and with other settings the output can call it more than one time.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-12
    func photoOutput(_ output: AVCapturePhotoOutput, willCapturePhotoFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Signal that a capture is beginning.
        activityContinuation.yield(.photoCapture(willCapture: true))
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            logger.debug("Error capturing photo: \(String(describing: error))")
            return
        }
        photoData = photo.fileDataRepresentation()
    }
    
}
```

### Step
Add the `didFinishCaptureFor` method. If it gets an error, resume the continuation with that error.

The photo output always calls this method last, and one time for each capture, also when the capture fails. Thus it is the one safe place to resume the continuation.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=9,11-16
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            logger.debug("Error capturing photo: \(String(describing: error))")
            return
        }
        photoData = photo.fileDataRepresentation()
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?) {

        // If an error occurs, resume the continuation by throwing an error, and return.
        if let error {
            continuation.resume(throwing: error)
            return
        }
    }
}
```

### Step
Resume the continuation with a `noPhotoData` error when the delegate has no photo data.

You must resume a continuation exactly one time. A second resume stops the app. A continuation that nobody resumes keeps its caller waiting and never releases it. Thus each path in this method resumes one time and then returns.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=9-13
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?) {

        // If an error occurs, resume the continuation by throwing an error, and return.
        if let error {
            continuation.resume(throwing: error)
            return
        }
        
        // If the app captures no photo data, resume the continuation by throwing an error, and return.
        guard let photoData else {
            continuation.resume(throwing: PhotoCaptureError.noPhotoData)
            return
        }
    }
```

### Step
Resume the continuation with a `Photo` value when the capture is successful.

This line ends the wait of the caller. The `capturePhoto()` method that you write in the next section returns this value.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=13-16
        // If an error occurs, resume the continuation by throwing an error, and return.
        if let error {
            continuation.resume(throwing: error)
            return
        }
        
        // If the app captures no photo data, resume the continuation by throwing an error, and return.
        guard let photoData else {
            continuation.resume(throwing: PhotoCaptureError.noPhotoData)
            return
        }
        
        /// Create a photo object to save to the `MediaLibrary`.
        let photo = Photo(data: photoData)
        // Resume the continuation by returning the captured photo.
        continuation.resume(returning: photo)
    }
```

### Step
At the start of the method, add a `defer` block that finishes the activity stream.

The `defer` block runs on each path out of the method. `finish()` ends the stream, and thus it ends each loop that reads the stream. You see in the next section why this is also the moment when the delegate object can go away.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3-6
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?) {

        defer {
            /// Finish the continuation to terminate the activity stream.
            activityContinuation.finish()
        }

        // If an error occurs, resume the continuation by throwing an error, and return.
        if let error {
            continuation.resume(throwing: error)
            return
        }
```

### Step
Build the project to make sure that the delegate compiles.

No code creates a delegate yet. You do that in the next section.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Bridge the delegate to async code

The rest of the app wants one simple call: `let photo = try await capturePhoto()`. In this section, you write this method. It connects the continuation, the delegate, and the activity stream.

![A continuation carries the result, a stream carries the progress, and the progress task keeps the delegate alive](../images/ch03-async-bridge.svg)

### Step
In the `PhotoCapture` class, add the `monitorProgress(of:isolation:)` method with an empty task.

The `isolation` parameter is from the Apple sample. The default value `#isolation` has the purpose to give the method the actor of its caller, so that the task can run on that actor. The concepts page tells you what a test found about this parameter.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-11
        return photoSettings
    }
    
    /// Monitors the progress of a photo capture delegate.
    ///
    /// The `PhotoCaptureDelegate` produces an asynchronous stream of values that indicate its current activity.
    /// The app propagates the activity values up to the view tier so the UI can update accordingly.
    private func monitorProgress(of delegate: PhotoCaptureDelegate, isolation: isolated (any Actor)? = #isolation) {
        Task {
        }
    }
    
    // MARK: - Update the photo output configuration
```

### Step
In the task, read the activity stream of the delegate and write each value to `captureActivity`.

The closure of the task uses `delegate`, so the task keeps a strong reference to the delegate. No property stores the delegate. This task is the owner that keeps it alive until the stream finishes. The line `_ = isolation` makes the closure capture the parameter, which is the condition for a task to inherit an actor from a parameter.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3-7
    private func monitorProgress(of delegate: PhotoCaptureDelegate, isolation: isolated (any Actor)? = #isolation) {
        Task {
            _ = isolation
            // Asynchronously monitor the activity of the delegate while the system performs capture.
            for await activity in delegate.activityStream {
                captureActivity = activity
            }
        }
    }
```

### Step
Above `createPhotoSettings()`, add the `capturePhoto()` method with a checked continuation.

[`withCheckedThrowingContinuation`](https://developer.apple.com/documentation/swift/withcheckedthrowingcontinuation(isolation:function:_:)) runs its closure immediately and then suspends the method. The method continues when some code resumes the continuation. It then returns the photo or throws the error.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4,6-11
    // An internal alias for the output.
    private var photoOutput: AVCapturePhotoOutput { output }
    
    // MARK: - Capture a photo.
    
    /// The app calls this method when the user taps the photo capture button.
    func capturePhoto() async throws -> Photo {
        // Wrap the delegate-based capture API in a continuation to use it in an async context.
        try await withCheckedThrowingContinuation { continuation in
        }
    }
    
    // MARK: - Create a photo settings object.
```

### Step
In the closure, make the settings and the delegate, start the progress task, and start the capture.

Each capture gets new settings and a new delegate. Thus the delegate needs no table to find which callback belongs to which capture. [`capturePhoto(with:delegate:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:)) returns immediately, and the callbacks arrive later.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-7,9-10,12-13
    /// The app calls this method when the user taps the photo capture button.
    func capturePhoto() async throws -> Photo {
        // Wrap the delegate-based capture API in a continuation to use it in an async context.
        try await withCheckedThrowingContinuation { continuation in
            
            // Create a settings object to configure the photo capture.
            let photoSettings = createPhotoSettings()
            
            let delegate = PhotoCaptureDelegate(continuation: continuation)
            monitorProgress(of: delegate)
            
            // Capture a new photo with the specified settings.
            photoOutput.capturePhoto(with: photoSettings, delegate: delegate)
        }
    }
```

### Step
Build the project. `PhotoCapture.swift` is now complete for this chapter.

The photo output is not part of the capture session yet, so the app cannot take a photo.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the photo output to the session

The capture service owns the session. In this section, you give it a `PhotoCapture` object, add the photo output to the session, and select the session preset for photos.

You also send the capture activity one level up. The service publishes it, so that the model can observe it in the last section.

### Step
In `CaptureService.swift`, add the `photoCapture` property and the `outputServices` property.

The array has one element now. Chapter 8 adds the movie service to it. Code that must reach each output, such as the rotation code, then needs no change.

```swift file=AVCam/CaptureService.swift highlight=4-5,7-8
    // The app's capture session.
    private let captureSession = AVCaptureSession()
    
    // An object that manages the app's photo capture behavior.
    private let photoCapture = PhotoCapture()
    
    // An internal collection of output services.
    private var outputServices: [any OutputService] { [photoCapture] }
    
    // The video input for the currently selected device camera.
    private var activeVideoInput: AVCaptureDeviceInput?
```

### Step
Below `addInput(for:)`, add the `addOutput(_:)` method, which adds an output only if the session accepts it.

The session does not accept each output in each configuration. If you add an output that the session cannot accept, the session raises an exception. Thus the code first calls [`canAddOutput(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddoutput(_:)) and throws a Swift error when the answer is `false`.

```swift file=AVCam/CaptureService.swift highlight=13-20
    // Adds an input to the capture session to connect the specified capture device.
    @discardableResult
    private func addInput(for device: AVCaptureDevice) throws -> AVCaptureDeviceInput {
        let input = try AVCaptureDeviceInput(device: device)
        if captureSession.canAddInput(input) {
            captureSession.addInput(input)
        } else {
            throw CameraError.addInputFailed
        }
        return input
    }
    
    // Adds an output to the capture session to connect the specified capture device, if allowed.
    private func addOutput(_ output: AVCaptureOutput) throws {
        if captureSession.canAddOutput(output) {
            captureSession.addOutput(output)
        } else {
            throw CameraError.addOutputFailed
        }
    }
    
    // The device for the active video input.
```

### Step
In `setUpSession()`, set the `.photo` preset and add the photo output.

A preset tells the session which quality you want, and the session selects a camera format for it. The default preset, `.high`, is for video. The [`.photo`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/photo) preset selects a format that supports photos at the full resolution of the camera.

```swift file=AVCam/CaptureService.swift highlight=10-11,13-14
    // Performs the initial capture session configuration.
    private func setUpSession() throws {
        do {
            // Retrieve the default camera.
            let defaultCamera = try deviceLookup.defaultCamera

            // Add an input for the default camera device.
            activeVideoInput = try addInput(for: defaultCamera)

            // Configure the session for photo capture.
            captureSession.sessionPreset = .photo
            
            // Add the photo capture output as the default output type.
            try addOutput(photoCapture.output)
            
            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
At the end of the actor, add the `updateCaptureCapabilities()` method.

This method calls `updateConfiguration(for:)` on each output service with the current camera. For the photo service, this sets the largest photo size. The name tells you what comes later: in chapter 7, the method also reads which features the camera supports.

```swift file=AVCam/CaptureService.swift highlight=4-13
        return previewLayer
    }
    
    // MARK: - Internal state management
    /// Updates the state of the actor to ensure its advertised capabilities are accurate.
    ///
    /// When the capture session changes, such as changing modes or input devices, the service
    /// calls this method to update its configuration and capabilities. The app uses this state to
    /// determine which features to enable in the user interface.
    private func updateCaptureCapabilities() {
        // Update the output service configuration.
        outputServices.forEach { $0.updateConfiguration(for: currentDevice) }
    }
}
```

### Step
In `changeCaptureDevice(to:)`, call `updateCaptureCapabilities()` after the service connects the new camera.

The front camera and the back camera support different photo sizes. A limit that is correct for one camera can be illegal for the other camera. Thus the service configures the output again after each change of camera.

```swift file=AVCam/CaptureService.swift highlight=6-7
        do {
            // Attempt to connect a new input and device to the capture session.
            activeVideoInput = try addInput(for: device)
            // Configure a new rotation coordinator for the new device.
            createRotationCoordinator(for: device)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
        } catch {
            // Reconnect the existing camera on failure.
            captureSession.addInput(currentInput)
        }
```

### Step
At the top of the file, import Combine. Then add a published `captureActivity` property to the actor.

Code outside an actor can read an actor property only one value at a time, with `await`. A publisher gives a sequence of all future values. The `@Observable` macro does not support actors, so the sample uses `@Published` from Combine.

```swift file=AVCam/CaptureService.swift highlight=3,9-10
import Foundation
@preconcurrency import AVFoundation
import Combine

/// An actor that manages the capture pipeline, which includes the capture session, device inputs, and capture outputs.
/// The app defines it as an `actor` type to ensure that all camera operations happen off of the `@MainActor`.
actor CaptureService {
    
    /// A value that indicates whether the capture service is idle or capturing a photo or movie.
    @Published private(set) var captureActivity: CaptureActivity = .idle
    
    /// A type that connects a preview destination with the capture session.
    nonisolated let previewSource: PreviewSource
```

### Step
Below `updateCaptureCapabilities()`, add the `observeOutputServices()` method, which publishes the activity of the photo service again.

`assign(to:)` sends each value from the publisher of the photo service to the property of the actor. The subscription lives as long as the property, so there is no cancellable object to store. Chapter 8 merges a second publisher, from the movie service, into this line.

```swift file=AVCam/CaptureService.swift highlight=6-11
    private func updateCaptureCapabilities() {
        // Update the output service configuration.
        outputServices.forEach { $0.updateConfiguration(for: currentDevice) }
    }
    
    /// Assign the `captureActivity` value of the photo capture service
    /// to the actor's property.
    private func observeOutputServices() {
        photoCapture.$captureActivity
            .assign(to: &$captureActivity)
    }
}
```

### Step
In `setUpSession()`, call `observeOutputServices()` at the start, and call `updateCaptureCapabilities()` at the end of the `do` block.

The service starts the observation first. It configures the output last, when the session has a camera input and the photo output. `updateCaptureCapabilities()` reads `currentDevice`, which stops the app when there is no input.

```swift file=AVCam/CaptureService.swift highlight=3-4,23-24
    // Performs the initial capture session configuration.
    private func setUpSession() throws {
        // Observe internal state and notifications.
        observeOutputServices()
        
        do {
            // Retrieve the default camera.
            let defaultCamera = try deviceLookup.defaultCamera

            // Add an input for the default camera device.
            activeVideoInput = try addInput(for: defaultCamera)

            // Configure the session for photo capture.
            captureSession.sessionPreset = .photo
            
            // Add the photo capture output as the default output type.
            try addOutput(photoCapture.output)
            
            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
Below `videoPreviewLayer`, add the `capturePhoto()` method, which the model calls.

The method only sends the call to the photo service. It is a method of the actor, so the model calls it with `await` from the main actor.

```swift file=AVCam/CaptureService.swift highlight=9-12
    private var videoPreviewLayer: AVCaptureVideoPreviewLayer {
        // Access the capture session's connected preview layer.
        guard let previewLayer = captureSession.connections.compactMap({ $0.videoPreviewLayer }).first else {
            fatalError("The app is misconfigured. The capture session should have a connection to a preview layer.")
        }
        return previewLayer
    }
    
    // MARK: - Photo capture
    func capturePhoto() async throws -> Photo {
        try await photoCapture.capturePhoto()
    }
    
    // MARK: - Internal state management
```

### Step
Build and run the app to make sure that the session still starts with the photo output and the `.photo` preset.

There is no capture button yet. If the status overlay shows that the camera failed to start, examine `setUpSession()`.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview, and the button that changes the camera works as before.
```

## Give the photo the correct orientation

In chapter 2, you used a rotation coordinator to keep the preview level. The coordinator supplies a second angle, for captured media. In this section, you apply that angle to the photo output.

The two angles are different things. The preview angle depends on the position of the preview layer in the interface. The capture angle depends only on how the person holds the camera relative to gravity. Each connection in the session has its own angle, so a correct preview does not make the photo correct.

### Step
Open `DataTypes.swift` and review the `setVideoRotationAngle(_:)` method that you added in the first section.

An [`AVCaptureConnection`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection) object connects the camera input to one output. The method sets the [`videoRotationAngle`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle) of the video connection of the output. For a photo output, the angle does not turn the pixels. The output writes the orientation into the metadata of the photo.

```swift file=AVCam/Model/DataTypes.swift
protocol OutputService {
    associatedtype Output: AVCaptureOutput
    var output: Output { get }
    var captureActivity: CaptureActivity { get }
    func updateConfiguration(for device: AVCaptureDevice)
    func setVideoRotationAngle(_ angle: CGFloat)
}

extension OutputService {
    func setVideoRotationAngle(_ angle: CGFloat) {
        // Set the rotation angle on the output object's video connection.
        output.connection(with: .video)?.videoRotationAngle = angle
    }
    func updateConfiguration(for device: AVCaptureDevice) {}
}
```

### Step
In `CaptureService.swift`, add the `updateCaptureRotation(_:)` method below the `updatePreviewRotation(_:)` method from chapter 2.

The method sends the angle to each output service. When chapter 8 adds the movie service to the array, movies get the correct orientation with no new code here.

```swift file=AVCam/CaptureService.swift highlight=9-12
    private func updatePreviewRotation(_ angle: CGFloat) {
        let connection = videoPreviewLayer.connection
        Task { @MainActor in
            // Set initial rotation angle on the video preview.
            connection?.videoRotationAngle = angle
        }
    }
    
    private func updateCaptureRotation(_ angle: CGFloat) {
        // Update the orientation for all output services.
        outputServices.forEach { $0.setVideoRotationAngle(angle) }
    }
    
    private var videoPreviewLayer: AVCaptureVideoPreviewLayer {
```

### Step
In `createRotationCoordinator(for:)`, change the comment and apply the capture angle immediately.

An observer reports only later changes, so the code sets the first value itself. A new connection starts with a default angle. `setUpSession()` adds the photo output before it calls this method, so the connection exists at this point.

```swift file=AVCam/CaptureService.swift remove
        // Set initial rotation state on the preview connection.
```

```swift file=AVCam/CaptureService.swift highlight=6,8
    /// Create a new rotation coordinator for the specified device and observe its state to monitor rotation changes.
    private func createRotationCoordinator(for device: AVCaptureDevice) {
        // Create a new rotation coordinator for this device.
        rotationCoordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: videoPreviewLayer)
        
        // Set initial rotation state on the preview and output connections.
        updatePreviewRotation(rotationCoordinator.videoRotationAngleForHorizonLevelPreview)
        updateCaptureRotation(rotationCoordinator.videoRotationAngleForHorizonLevelCapture)
        
        // Cancel previous observations.
        rotationObservers.removeAll()
        
```

### Step
Add a second observer, which updates the capture angle each time the person turns the device.

The coordinator reports changes on the main queue. The closure starts a task that goes back to the actor, where the outputs are. The comment in the closure is a copy of the comment in the first observer, as in the Apple sample.

```swift file=AVCam/CaptureService.swift highlight=10-16
        // Add observers to monitor future changes.
        rotationObservers.append(
            rotationCoordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: .new) { [weak self] _, change in
                guard let self, let angle = change.newValue else { return }
                // Update the capture preview rotation.
                Task { await self.updatePreviewRotation(angle) }
            }
        )
        
        rotationObservers.append(
            rotationCoordinator.observe(\.videoRotationAngleForHorizonLevelCapture, options: .new) { [weak self] _, change in
                guard let self, let angle = change.newValue else { return }
                // Update the capture preview rotation.
                Task { await self.updateCaptureRotation(angle) }
            }
        )
    }
```

### Step
Build and run the app to make sure that it still starts.

You cannot see the result of this section yet. The Simulator with SimCam delivers a photo without orientation data. To examine the orientation, use a real iPhone after chapter 4, when the app saves its photos.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview as before.
```

## Add the capture button and the flash

The capture service can take a photo now. In this last section, you connect it to the interface: the model gets a `capturePhoto()` method and observes the capture activity, and the toolbar gets a capture button.

![A capture activity value goes from the delegate through the photo service and the capture service to the model](../images/ch03-activity-flow.svg)

### Step
In `CameraModel.swift`, add the `captureActivity`, `shouldFlashScreen`, and `error` properties.

The views read these properties. The setters are private, because only the model changes the state of the camera.

```swift file=AVCam/CameraModel.swift highlight=6-7,12-13,15-16
final class CameraModel: Camera {
    
    /// The current status of the camera, such as unauthorized, running, or failed.
    private(set) var status = CameraStatus.unknown
    
    /// The current state of photo capture.
    private(set) var captureActivity = CaptureActivity.idle
    
    /// A Boolean value that indicates whether the app is currently switching video devices.
    private(set) var isSwitchingVideoDevices = false
    
    /// A Boolean value that indicates whether to show visual feedback when capture begins.
    private(set) var shouldFlashScreen = false
    
    /// An error that indicates the details of an error during photo capture.
    private(set) var error: Error?
    
    /// An object that provides the connection between the capture session and the video preview layer.
    var previewSource: PreviewSource { captureService.previewSource }
```

### Step
Below `switchVideoDevices()`, add a `capturePhoto()` method with an empty body, a mark, and a comment.

The method is `async`, because the model must wait for the capture service, which is a different actor.

```swift file=AVCam/CameraModel.swift highlight=8,10-12
    /// Selects the next available video device for capture.
    func switchVideoDevices() async {
        isSwitchingVideoDevices = true
        defer { isSwitchingVideoDevices = false }
        await captureService.selectNextVideoDevice()
    }
    
    // MARK: - Photo capture
    
    /// Captures a photo.
    func capturePhoto() async {
    }
```

### Step
In `capturePhoto()`, capture a photo and write the size of its data to the log.

The `logger.info` line is temporary. In this chapter it shows you that the photo arrives. In chapter 4, you replace it with the call that saves the photo to the Photos library. If the capture fails, the model keeps the error in its `error` property.

```swift file=AVCam/CameraModel.swift highlight=3-8
    /// Captures a photo.
    func capturePhoto() async {
        do {
            let photo = try await captureService.capturePhoto()
            logger.info("Captured a photo with \(photo.data.count) bytes of data.")
        } catch {
            self.error = error
        }
    }
```

### Step
Below `capturePhoto()`, add the `flashScreen()` method, which gives a short visual signal.

The first line sets the property to `true` with no animation. The animation block then sets it back to `false`. A view that depends on the property changes for a moment and then returns to its normal state.

```swift file=AVCam/CameraModel.swift highlight=5-11
            self.error = error
        }
    }
    
    /// Sets the `showCaptureFeedback` state to indicate that capture is underway.
    private func flashScreen() {
        shouldFlashScreen = true
        withAnimation(.linear(duration: 0.01)) {
            shouldFlashScreen = false
        }
    }
}
```

### Step
Add the `observeState()` method with a task that reads the activity values of the capture service.

The `values` property turns a publisher into an asynchronous sequence. The task runs on the main actor, because `CameraModel` is a main actor type. Thus the code in the loop can change the properties that the views read.

```swift file=AVCam/CameraModel.swift highlight=9,11-18
    /// Sets the `showCaptureFeedback` state to indicate that capture is underway.
    private func flashScreen() {
        shouldFlashScreen = true
        withAnimation(.linear(duration: 0.01)) {
            shouldFlashScreen = false
        }
    }
    
    // MARK: - Internal state observations
    
    // Set up camera's state observations.
    private func observeState() {
        Task {
            // Await new capture activity values from the capture service.
            for await activity in await captureService.$captureActivity.values {
            }
        }
    }
}
```

### Step
In the loop, flash the screen for a `willCapture` value, and keep each other value in `captureActivity`.

The `willCapture` value is an event, not a state, so the model does not keep it. After a photo, `captureActivity` keeps the last value, `.photoCapture`. It does not go back to `.idle`. This is the behavior of the Apple sample.

```swift file=AVCam/CameraModel.swift highlight=5-11
    private func observeState() {
        Task {
            // Await new capture activity values from the capture service.
            for await activity in await captureService.$captureActivity.values {
                if activity.willCapture {
                    // Flash the screen to indicate capture is starting.
                    flashScreen()
                } else {
                    // Forward the activity to the UI.
                    captureActivity = activity
                }
            }
        }
    }
```

### Step
In `start()`, call `observeState()` after the capture service starts.

```swift file=AVCam/CameraModel.swift highlight=12
    // MARK: - Starting the camera
    /// Start the camera and begin the stream of data.
    func start() async {
        // Verify that the person authorizes the app to use device cameras and microphones.
        guard await captureService.isAuthorized else {
            status = .unauthorized
            return
        }
        do {
            // Start the capture service to start the flow of data.
            try await captureService.start()
            observeState()
            status = .running
        } catch {
            logger.error("Failed to start capture service. \(error)")
            status = .failed
        }
    }
```

### Step
In `Camera.swift`, add the new members to the `Camera` protocol.

The views use the protocol, not the `CameraModel` class. Each member that a view needs must be in the protocol.

```swift file=AVCam/Model/Camera.swift highlight=7-8,22-23,25-26,28-29
@MainActor
protocol Camera: AnyObject, SendableMetatype {

    /// Provides the current status of the camera.
    var status: CameraStatus { get }

    /// The camera's current activity state, which can be photo capture or idle.
    var captureActivity: CaptureActivity { get }

    /// The source of video content for a camera preview.
    var previewSource: PreviewSource { get }
    
    /// Starts the camera capture pipeline.
    func start() async
    
    /// Switches between video devices available on the host system.
    func switchVideoDevices() async
    
    /// A Boolean value that indicates whether the camera is currently switching video devices.
    var isSwitchingVideoDevices: Bool { get }
    
    /// Captures a photo.
    func capturePhoto() async
    
    /// A Boolean value that indicates whether to show visual feedback when capture begins.
    var shouldFlashScreen: Bool { get }
    
    /// An error if the camera encountered a problem.
    var error: Error? { get }
}
```

### Note
The project does not compile at this time, because `PreviewCameraModel` does not have the new members. You add them in the next step.

### Step
In `PreviewCameraModel.swift`, add the same members with simple values.

SwiftUI previews use this class in place of the real model. It has no camera, so `capturePhoto()` only writes a message to the log.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=4,14,17,33-35
@Observable
class PreviewCameraModel: Camera {
    
    var shouldFlashScreen = false
    
    struct PreviewSourceStub: PreviewSource {
        // Stubbed out for test purposes.
        func connect(to target: PreviewTarget) {}
    }
    
    let previewSource: PreviewSource = PreviewSourceStub()
    
    private(set) var status = CameraStatus.unknown
    private(set) var captureActivity = CaptureActivity.idle
    
    private(set) var isSwitchingVideoDevices = false
    var error: Error?
    
    init(status: CameraStatus = .unknown) {
        self.status = status
    }
    
    func start() async {
        if status == .unknown {
            status = .running
        }
    }
    
    func switchVideoDevices() {
        logger.debug("Device switching isn't implemented in PreviewCamera.")
    }
    
    func capturePhoto() {
        logger.debug("Photo capture isn't implemented in PreviewCamera.")
    }
}
```

### Step
Create a new Swift file with the name `CaptureButton.swift` in the `MainToolbar` group, and replace its contents.

`CaptureButton` starts a task that calls `capturePhoto()` on the model. `PhotoCaptureButton` draws a white ring with a white disc in it, and the button style makes the disc smaller while the person presses it. This file has only the photo button. Chapter 8 adds a button for movies.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that displays an appropriate capture button for the selected capture mode.
*/

import SwiftUI

/// A view that displays an appropriate capture button for the selected mode.
@MainActor
struct CaptureButton<CameraModel: Camera>: View {
    
    @State var camera: CameraModel
    
    private let mainButtonDimension: CGFloat = 68
    
    var body: some View {
        captureButton
            .aspectRatio(1.0, contentMode: .fit)
            .frame(width: mainButtonDimension)
    }
    
    @ViewBuilder
    var captureButton: some View {
        PhotoCaptureButton {
            Task {
                await camera.capturePhoto()
            }
        }
    }
}

#Preview("Photo") {
    CaptureButton(camera: PreviewCameraModel())
}

private struct PhotoCaptureButton: View {
    private let action: () -> Void
    private let lineWidth = CGFloat(4.0)
    
    init(action: @escaping () -> Void) {
        self.action = action
    }
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(lineWidth: lineWidth)
                .fill(.white)
            Button {
                action()
            } label: {
                Circle()
                    .inset(by: lineWidth * 1.2)
                    .fill(.white)
            }
            .buttonStyle(PhotoButtonStyle())
        }
    }
    
    struct PhotoButtonStyle: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .scaleEffect(configuration.isPressed ? 0.85 : 1.0)
                .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
        }
    }
}
```

### Step
In `MainToolbar.swift`, add a placeholder, a spacer, and the capture button before the button that changes the camera.

The `Color.clear` placeholder is temporary. It has the size of a large button, so the capture button stays in the center of the toolbar. In chapter 4, you replace the placeholder with the thumbnail of the last photo.

```swift file=AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift highlight=7-11
struct MainToolbar<CameraModel: Camera>: View {

    @State var camera: CameraModel
    
    var body: some View {
        HStack {
            // A placeholder that keeps the capture button in the center.
            Color.clear
                .frame(width: largeButtonSize.width, height: largeButtonSize.height)
            Spacer()
            CaptureButton(camera: camera)
            Spacer()
            SwitchCameraButton(camera: camera)
        }
        .foregroundColor(.white)
        .font(.system(size: 24))
        .frame(height: height)
        .padding([.leading, .trailing])
    }
```

### Step
In `CameraView.swift`, hide the preview while `shouldFlashScreen` is `true`.

The opacity of the preview goes to zero for a moment at the start of the exposure. This is the visual signal that the camera took a photo.

```swift file=AVCam/CameraView.swift highlight=11-14
struct CameraView<CameraModel: Camera>: View {

    @State var camera: CameraModel

    var body: some View {
        ZStack {
            // A container view that manages the placement of the preview.
            PreviewContainer(camera: camera) {
                // A view that provides a preview of the captured content.
                CameraPreview(source: camera.previewSource)
                    /// The value of `shouldFlashScreen` changes briefly to `true` when capture
                    /// starts, and then immediately changes to `false`. Use this change to
                    /// flash the screen to provide visual feedback when capturing photos.
                    .opacity(camera.shouldFlashScreen ? 0 : 1)
            }
            // The main camera user interface.
            CameraUI(camera: camera)
        }
    }
}
```

### Step
Build and run the app. Open the debug console in Xcode, and tap the capture button in the center of the toolbar.

The preview flashes for a moment. The flash is very short, so it is easy to miss. The console shows the size of the photo data. In the Simulator with SimCam, the photo is a 640 x 480 JPEG file of approximately 50,000 bytes. On a real iPhone, the app asks for a HEIF file at the largest size that the camera supports, so the number is much larger. This tutorial did not verify the result on a real iPhone.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Console: Captured a photo with 51427 bytes of data.
Note: The number of bytes is different for each photo.
```

### Experiment
In `flashScreen()`, change the duration from `0.01` to `0.5`. Run the app, take a photo, and look at the preview. Then set the value back to `0.01`, so that your code stays equal to the branch `chapter-03`.

### Text
The photo exists only in memory, and the app discards it after the log line. In the next chapter, you save each photo to the Photos library and show a thumbnail of the last photo.

## Check your understanding

### Why does the delegate resume the continuation in `didFinishCaptureFor`, and not in `didFinishProcessingPhoto`?

- [ ] `didFinishProcessingPhoto` runs on a different thread, where a continuation cannot be resumed.
  > A continuation can be resumed from each thread. The photo output sends all its callbacks on one queue.
- [x] `didFinishCaptureFor` is the only callback that always arrives last and exactly one time for each capture, also after an error.
  > Correct. A continuation must be resumed exactly one time. `didFinishProcessingPhoto` can arrive more than one time with other settings, and more callbacks can follow it.
- [ ] The photo data is not available until `didFinishCaptureFor`.
  > The data is available earlier. The delegate reads it in `didFinishProcessingPhoto` and keeps it in `photoData`.

### You delete the line `photoSettings.maxPhotoDimensions = photoOutput.maxPhotoDimensions`. Which size do the photos have on a real iPhone?

- [ ] The largest size, because the photo output has the largest size as its limit.
  > The value on the output is only an upper limit. It does not select the size of a photo.
- [x] The smallest size that the active format supports.
  > Correct. The default value of `maxPhotoDimensions` on a settings object is the smallest supported size. Each capture must ask for a larger size.
- [ ] No size. The capture fails with an error.
  > The settings are legal without this line. The capture succeeds, but the photo is small.

### The rotation coordinator already keeps the preview level. Why does the photo output need its own rotation angle?

- [ ] The photo output cannot read the angle of the preview layer because it is on a different thread.
  > Threads are not the reason. The preview and the photo output have different connections, and they need different angles.
- [ ] The photo output turns the pixels of each photo, and the preview layer does not.
  > The photo output does not turn the pixels. It writes the orientation into the metadata of the photo.
- [x] Each connection has its own angle, and the capture angle depends on gravity, not on the position of the preview layer.
  > Correct. The coordinator supplies one angle for the preview and one angle for captured media. The two values can be different, and you must apply each one to the correct connection.
