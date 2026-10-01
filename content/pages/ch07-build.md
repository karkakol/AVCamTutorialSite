---
kind: tutorial
chapter: 7
title: Build: photo features
abstract: Add Live Photo capture, a quality setting, deferred photo delivery, and responsive capture to the photo service, and add a toolbar that controls them.
estimatedMinutes: 50
startBranch: chapter-06
branch: chapter-07
---

In this tutorial, you add four features to photo capture: Live Photos, a quality prioritization that the person selects, deferred photo delivery, and responsive capture. At the end, a toolbar at the top of the screen has a Live Photo button and a quality menu, and the app can show a "LIVE" badge.

You work in an order that keeps the app safe at each checkpoint. First you teach the delegate and the media library to handle the new results. Then you enable the features on the [`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput) object. Only then do you ask for the features in the settings of each capture.

> [!IMPORTANT]
> In the Simulator with SimCam, Live Photo capture does not work. Deferred photo delivery and responsive capture probably do not work there. The code builds and runs, and a capture gives a normal JPEG photo. To see a Live Photo or the "LIVE" badge, you need a real iPhone. This tutorial did not verify the features on a real iPhone.

Read [Concepts: photo features](ch07-concepts.md) first if you want the background for each step.

## Describe the photo features

The views and the model must not use AVFoundation types. In this section, you add small app types that carry the photo features between the layers: the choices of the person go down to the capture code, and the abilities of the camera go up to the interface.

You also extend `CaptureActivity`, so that it can tell the interface that a Live Photo capture is in progress.

### Step
In `DataTypes.swift`, add an `isLivePhoto` value to the `photoCapture` case, and add a second position to the pattern in `willCapture`.

The case now has two associated values, so a pattern must name two positions. The underscore ignores the value that the property does not need. The two values have defaults, thus the code from chapter 3 that creates `.photoCapture()` still compiles.

```swift file=AVCam/Model/DataTypes.swift remove
    case photoCapture(willCapture: Bool = false)
```

```swift file=AVCam/Model/DataTypes.swift remove
        if case .photoCapture(let willCapture) = self {
```

```swift file=AVCam/Model/DataTypes.swift highlight=4,7
enum CaptureActivity {
    case idle
    /// A status that indicates the capture service is performing photo capture.
    case photoCapture(willCapture: Bool = false, isLivePhoto: Bool = false)
    
    var willCapture: Bool {
        if case .photoCapture(let willCapture, _) = self {
            return willCapture
        }
        return false
    }
}
```

### Step
Add the `isLivePhoto` computed property above the `willCapture` property.

The interface reads this property to show or hide the "LIVE" badge. As with `willCapture`, the caller needs no `switch` statement.

```swift file=AVCam/Model/DataTypes.swift highlight=6-11
enum CaptureActivity {
    case idle
    /// A status that indicates the capture service is performing photo capture.
    case photoCapture(willCapture: Bool = false, isLivePhoto: Bool = false)
    
    var isLivePhoto: Bool {
        if case .photoCapture(_, let isLivePhoto) = self {
            return isLivePhoto
        }
        return false
    }
    
    var willCapture: Bool {
        if case .photoCapture(let willCapture, _) = self {
            return willCapture
        }
        return false
    }
}
```

### Step
Below the `Photo` structure, add the `QualityPrioritization` enumeration with its three cases.

The raw values are 1, 2, and 3. These are the raw values of the AVFoundation type [`AVCapturePhotoOutput.QualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/qualityprioritization), so the capture code can convert with the raw value. `Identifiable` and `CaseIterable` let a SwiftUI picker list the cases. `Codable` is for chapter 13, where the app stores the value.

```swift file=AVCam/Model/DataTypes.swift highlight=6-11
/// A structure that represents a captured photo.
struct Photo: Sendable {
    let data: Data
}

enum QualityPrioritization: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
    var id: Self { self }
    case speed = 1
    case balanced
    case quality
}

enum CameraError: Error {
```

### Step
Add the `description` property, which gives each case a name for the menu.

This property satisfies `CustomStringConvertible`. The first case has no space after `case`. This is how the Apple sample writes it, and Swift accepts it.

```swift file=AVCam/Model/DataTypes.swift highlight=6-15
enum QualityPrioritization: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
    var id: Self { self }
    case speed = 1
    case balanced
    case quality
    var description: String {
        switch self {
        case.speed:
            return "Speed"
        case .balanced:
            return "Balanced"
        case .quality:
            return "Quality"
        }
    }
}
```

### Step
Between the `Photo` structure and the `QualityPrioritization` enumeration, add the `PhotoFeatures` structure with two properties.

One value of this type goes with each capture request. It carries the two choices that the person makes in the interface: Live Photo on or off, and the quality prioritization.

```swift file=AVCam/Model/DataTypes.swift highlight=6-9
/// A structure that represents a captured photo.
struct Photo: Sendable {
    let data: Data
}

struct PhotoFeatures {
    let isLivePhotoEnabled: Bool
    let qualityPrioritization: QualityPrioritization
}

enum QualityPrioritization: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
```

### Step
Below the `PhotoFeatures` structure, add the `CaptureCapabilities` structure with one property, an initializer, and a start value.

This type goes in the opposite direction. It tells the interface what the camera can do in its current configuration. The `unknown` value is the start value, with each capability set to `false`. In chapter 9, you add a second capability for HDR video.

```swift file=AVCam/Model/DataTypes.swift highlight=6-17
struct PhotoFeatures {
    let isLivePhotoEnabled: Bool
    let qualityPrioritization: QualityPrioritization
}

/// A structure that represents the capture capabilities of `CaptureService` in
/// its current configuration.
struct CaptureCapabilities {

    let isLivePhotoCaptureSupported: Bool
    
    init(isLivePhotoCaptureSupported: Bool = false) {
        self.isLivePhotoCaptureSupported = isLivePhotoCaptureSupported
    }
    
    static let unknown = CaptureCapabilities()
}

enum QualityPrioritization: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
```

### Step
Create a new Swift file with the name `FoundationExtensions.swift` in the `Support` group, and replace its contents.

Each Live Photo needs a file for its movie. This property makes a new URL in the temporary directory each time you read it. The name is a UUID, so two captures never get the same file.

```swift file=AVCam/Support/FoundationExtensions.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
Extensions on Foundation types.
*/

import Foundation

extension URL {
    /// A unique output location to write a movie.
    static var movieFileURL: URL {
        URL.temporaryDirectory.appending(component: UUID().uuidString).appendingPathExtension(for: .quickTimeMovie)
    }
}
```

### Step
Build the project to make sure that the new types compile.

No code uses the new types yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Collect the movie and the proxy

A Live Photo capture gives two results: the photo and a movie file. A deferred capture gives a proxy in place of the photo. In this section, you teach the delegate to collect these results, and you teach the media library to save them.

You do this before you enable the features. When the photo output starts to send the new results, the app is ready for them.

![The delegate callbacks of one Live Photo capture, and what AVCam does in each callback](../images/ch07-live-photo-callbacks.svg)

### Step
In `PhotoCapture.swift`, add three properties to the `PhotoCaptureDelegate` class.

One delegate object handles one capture, as in chapter 3. Thus these properties hold the state of one capture only: if it is a Live Photo, if its data is a proxy, and where its movie file is.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-6,9
private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    
    private let continuation: PhotoContinuation
    
    private var isLivePhoto = false
    private var isProxyPhoto = false
    
    private var photoData: Data?
    private var livePhotoMovieURL: URL?
    
    /// A stream of capture activity values that indicate the current state of progress.
    let activityStream: AsyncStream<CaptureActivity>
```

### Step
Change the first two callbacks, so that they find out if the capture is a Live Photo and put this value into the activity.

The resolved settings say what the output really does. For a Live Photo, [`livePhotoMovieDimensions`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/livephotomoviedimensions) is the size of the movie. For each other capture, it is zero. The `.zero` value is from the `CMVideoDimensions` extension that you wrote in chapter 3.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        // Signal that the photo output accepts the capture request.
        activityContinuation.yield(.photoCapture())
```

```swift file=AVCam/Capture/PhotoCapture.swift remove
        activityContinuation.yield(.photoCapture(willCapture: true))
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-4,9
    func photoOutput(_ output: AVCapturePhotoOutput, willBeginCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Determine if this is a live capture.
        isLivePhoto = resolvedSettings.livePhotoMovieDimensions != .zero
        activityContinuation.yield(.photoCapture(isLivePhoto: isLivePhoto))
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, willCapturePhotoFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Signal that a capture is beginning.
        activityContinuation.yield(.photoCapture(willCapture: true, isLivePhoto: isLivePhoto))
    }
```

### Step
Below `willCapturePhotoFor`, add the callback that arrives when the movie of a Live Photo stops.

At [this callback](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishrecordinglivephotomovieforeventualfileat:resolvedsettings:)), the camera has all the video that it needs, but the file is not complete. The person can move the device again, so the delegate sends a value with `isLivePhoto: false`. This value switches the badge off.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-9
    func photoOutput(_ output: AVCapturePhotoOutput, willCapturePhotoFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Signal that a capture is beginning.
        activityContinuation.yield(.photoCapture(willCapture: true, isLivePhoto: isLivePhoto))
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishRecordingLivePhotoMovieForEventualFileAt outputFileURL: URL, resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Indicates that Live Photo capture is over.
        activityContinuation.yield(.photoCapture(isLivePhoto: false))
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
```

### Step
Add the callback that arrives when the movie file is complete, and keep the URL of the file.

As with the photo data, the delegate only keeps the result here. It reports in the last callback. If the callback has an error, the code writes it to the log and still keeps the URL. The concepts page tells you why this is a weak point.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-11
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishRecordingLivePhotoMovieForEventualFileAt outputFileURL: URL, resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Indicates that Live Photo capture is over.
        activityContinuation.yield(.photoCapture(isLivePhoto: false))
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingLivePhotoToMovieFileAt outputFileURL: URL, duration: CMTime, photoDisplayTime: CMTime, resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?) {
        if let error {
            logger.debug("Error processing Live Photo companion movie: \(String(describing: error))")
        }
        livePhotoMovieURL = outputFileURL
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
```

### Step
Add the callback for a deferred photo, which keeps the data of the proxy and sets the proxy flag.

With deferred delivery, the output sends this callback in place of `didFinishProcessingPhoto` for a capture that needs long processing. An [`AVCaptureDeferredPhotoProxy`](https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy) object is a photo, so `fileDataRepresentation()` works. The data must go to the library as a proxy, so the delegate keeps this fact in `isProxyPhoto`.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=8-16
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingLivePhotoToMovieFileAt outputFileURL: URL, duration: CMTime, photoDisplayTime: CMTime, resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?) {
        if let error {
            logger.debug("Error processing Live Photo companion movie: \(String(describing: error))")
        }
        livePhotoMovieURL = outputFileURL
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishCapturingDeferredPhotoProxy deferredPhotoProxy: AVCaptureDeferredPhotoProxy?, error: Error?) {
        if let error = error {
            logger.debug("Error capturing deferred photo: \(error)")
            return
        }
        // Capture the data for this photo.
        photoData = deferredPhotoProxy?.fileDataRepresentation()
        isProxyPhoto = true
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
```

### Step
In `DataTypes.swift`, add the `isProxy` and `livePhotoMovieURL` properties to the `Photo` structure.

`Photo` is the value that goes from the capture actor to the main actor and then to the media library. It must carry all that the library needs to save the asset. `Bool` and `URL` are `Sendable`, so the structure stays `Sendable`.

```swift file=AVCam/Model/DataTypes.swift highlight=4-6
/// A structure that represents a captured photo.
struct Photo: Sendable {
    let data: Data
    let isProxy: Bool
    let livePhotoMovieURL: URL?
}
```

### Step
In `PhotoCapture.swift`, give the two new values to the `Photo` initializer in `didFinishCaptureFor`.

The photo output sends this callback last, when the photo and the movie are complete. Thus one `Photo` value has the two parts of a Live Photo.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        let photo = Photo(data: photoData)
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=8
        // If the app captures no photo data, resume the continuation by throwing an error, and return.
        guard let photoData else {
            continuation.resume(throwing: PhotoCaptureError.noPhotoData)
            return
        }
        
        /// Create a photo object to save to the `MediaLibrary`.
        let photo = Photo(data: photoData, isProxy: isProxyPhoto, livePhotoMovieURL: livePhotoMovieURL)
        // Resume the continuation by returning the captured photo.
        continuation.resume(returning: photo)
    }
}
```

### Step
In `MediaLibrary.swift`, select the resource type of the photo from its `isProxy` value.

A proxy must be a [`.photoProxy`](https://developer.apple.com/documentation/photos/phassetresourcetype/photoproxy) resource. Only then does the Photos library know that it must complete the photo later. With `.photo`, the library probably keeps the proxy image as the final photo.

```swift file=AVCam/Model/MediaLibrary.swift remove
            creationRequest.addResource(with: .photo, data: photo.data, options: options)
```

```swift file=AVCam/Model/MediaLibrary.swift highlight=9-10
    /// Saves a photo to the Photos library.
    func save(photo: Photo) async throws {
        let location = try await currentLocation
        try await performChange {
            let creationRequest = PHAssetCreationRequest.forAsset()
            
            // Save primary photo.
            let options = PHAssetResourceCreationOptions()
            // Specify the appropriate resource type for the photo.
            creationRequest.addResource(with: photo.isProxy ? .photoProxy : .photo, data: photo.data, options: options)
            creationRequest.location = location
            
            return creationRequest.placeholderForCreatedAsset
        }
    }
```

### Step
Add the movie of a Live Photo to the same creation request as a paired video.

A [`.pairedVideo`](https://developer.apple.com/documentation/photos/phassetresourcetype/pairedvideo) resource in the request of the photo makes one Live Photo asset. With [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile), Photos moves the file out of the temporary directory and does not copy it. This is faster, and the app does not have to delete the file.

```swift file=AVCam/Model/MediaLibrary.swift highlight=7-12
            // Save primary photo.
            let options = PHAssetResourceCreationOptions()
            // Specify the appropriate resource type for the photo.
            creationRequest.addResource(with: photo.isProxy ? .photoProxy : .photo, data: photo.data, options: options)
            creationRequest.location = location
            
            // Save Live Photo data.
            if let url = photo.livePhotoMovieURL {
                let livePhotoOptions = PHAssetResourceCreationOptions()
                livePhotoOptions.shouldMoveFile = true
                creationRequest.addResource(with: .pairedVideo, fileURL: url, options: livePhotoOptions)
            }
            
            return creationRequest.placeholderForCreatedAsset
        }
    }
```

### Step
Build and run the app, and take a photo.

The features are not enabled yet, so the new callbacks do not arrive. Each photo is a normal photo with `isProxy` set to `false` and no movie URL.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail, as before.
```

## Enable the features on the photo output

This section is level 1 of the two-level rule: you enable each feature on the photo output. You do this in `updateConfiguration(for:)`, which the capture service calls at setup and after each change of camera.

Each line has the same form: it sets an "enabled" property to the value of the "supported" property. You must not enable a feature that the output does not support, because the output then raises an exception. With this form, that cannot occur.

![Two quick captures on a time line, with the default behavior and with the responsiveness features](../images/ch07-responsive-timeline.svg)

### Step
In `updateConfiguration(for:)` in `PhotoCapture.swift`, enable Live Photo capture when the output supports it.

When [`isLivePhotoCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocaptureenabled) is `true`, the output keeps a buffer of video all the time. A Live Photo needs video from before the tap, so you cannot enable the feature at the moment of the capture.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4
    func updateConfiguration(for device: AVCaptureDevice) {
        // Enable all supported features.
        photoOutput.maxPhotoDimensions = device.activeFormat.supportedMaxPhotoDimensions.last ?? .zero
        photoOutput.isLivePhotoCaptureEnabled = photoOutput.isLivePhotoCaptureSupported
    }
```

### Step
Set the maximum quality prioritization of the output to `.quality`.

The default of [`maxPhotoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization) is `.balanced`. A capture that asks for more than the maximum raises an exception. With `.quality` as the maximum, the person can select each of the three levels. The cost is that the output prepares more resources.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5
    func updateConfiguration(for device: AVCaptureDevice) {
        // Enable all supported features.
        photoOutput.maxPhotoDimensions = device.activeFormat.supportedMaxPhotoDimensions.last ?? .zero
        photoOutput.isLivePhotoCaptureEnabled = photoOutput.isLivePhotoCaptureSupported
        photoOutput.maxPhotoQualityPrioritization = .quality
    }
```

### Step
Enable responsive capture, and then enable fast capture prioritization, when the output supports them.

With [`isResponsiveCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled), a new capture can start while the last photo is in processing. With [`isFastCapturePrioritizationEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationenabled), the system decreases the processing when the person takes photos very quickly. Keep this order: the second feature is supported only when the first one is enabled.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-7
    func updateConfiguration(for device: AVCaptureDevice) {
        // Enable all supported features.
        photoOutput.maxPhotoDimensions = device.activeFormat.supportedMaxPhotoDimensions.last ?? .zero
        photoOutput.isLivePhotoCaptureEnabled = photoOutput.isLivePhotoCaptureSupported
        photoOutput.maxPhotoQualityPrioritization = .quality
        photoOutput.isResponsiveCaptureEnabled = photoOutput.isResponsiveCaptureSupported
        photoOutput.isFastCapturePrioritizationEnabled = photoOutput.isFastCapturePrioritizationSupported
    }
```

### Step
Enable deferred photo delivery when the output supports it, as the last feature in the list.

With [`isAutoDeferredPhotoDeliveryEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled), the system decides for each capture if it gives a proxy or a complete photo. You wrote the two callbacks and the save code for the two kinds in the last section, so the app is ready.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=8
    func updateConfiguration(for device: AVCaptureDevice) {
        // Enable all supported features.
        photoOutput.maxPhotoDimensions = device.activeFormat.supportedMaxPhotoDimensions.last ?? .zero
        photoOutput.isLivePhotoCaptureEnabled = photoOutput.isLivePhotoCaptureSupported
        photoOutput.maxPhotoQualityPrioritization = .quality
        photoOutput.isResponsiveCaptureEnabled = photoOutput.isResponsiveCaptureSupported
        photoOutput.isFastCapturePrioritizationEnabled = photoOutput.isFastCapturePrioritizationSupported
        photoOutput.isAutoDeferredPhotoDeliveryEnabled = photoOutput.isAutoDeferredPhotoDeliverySupported
    }
```

### Note
The code has no line for zero shutter lag. The system enables this feature automatically when the camera supports it.

### Step
Add the `capabilities` property to the `PhotoCapture` class, below the `photoOutput` alias.

The property holds what the photo output supports in the current configuration. Its start value is `unknown`, because the output has no camera until the service adds it to a session.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-5
    // An internal alias for the output.
    private var photoOutput: AVCapturePhotoOutput { output }
    
    // The current capabilities available.
    private(set) var capabilities: CaptureCapabilities = .unknown
    
    // MARK: - Capture a photo.
```

### Step
Below `updateConfiguration(for:)`, add the `updateCapabilities(for:)` method, and call it at the end of `updateConfiguration(for:)`.

The "supported" values change with the camera and the session configuration. Thus the service reads them again each time it configures the output. The method does not use its `device` parameter. The Apple sample has it, and you keep it so that your code stays equal to the sample.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=9-10,12-14
    func updateConfiguration(for device: AVCaptureDevice) {
        // Enable all supported features.
        photoOutput.maxPhotoDimensions = device.activeFormat.supportedMaxPhotoDimensions.last ?? .zero
        photoOutput.isLivePhotoCaptureEnabled = photoOutput.isLivePhotoCaptureSupported
        photoOutput.maxPhotoQualityPrioritization = .quality
        photoOutput.isResponsiveCaptureEnabled = photoOutput.isResponsiveCaptureSupported
        photoOutput.isFastCapturePrioritizationEnabled = photoOutput.isFastCapturePrioritizationSupported
        photoOutput.isAutoDeferredPhotoDeliveryEnabled = photoOutput.isAutoDeferredPhotoDeliverySupported
        updateCapabilities(for: device)
    }
    
    private func updateCapabilities(for device: AVCaptureDevice) {
        capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: photoOutput.isLivePhotoCaptureSupported)
    }
}
```

### Step
In `DataTypes.swift`, add the `capabilities` requirement to the `OutputService` protocol.

Each output service must now tell what it supports. `PhotoCapture` already has the property. The movie service of chapter 8 gets one too.

```swift file=AVCam/Model/DataTypes.swift highlight=5
protocol OutputService {
    associatedtype Output: AVCaptureOutput
    var output: Output { get }
    var captureActivity: CaptureActivity { get }
    var capabilities: CaptureCapabilities { get }
    func updateConfiguration(for device: AVCaptureDevice)
    func setVideoRotationAngle(_ angle: CGFloat)
}
```

### Step
In `CaptureService.swift`, add a published `captureCapabilities` property below the `captureActivity` property.

The service publishes the capabilities in the same way as the activity, with `@Published` from Combine. A model on the main actor can then read each new value as an asynchronous sequence.

```swift file=AVCam/CaptureService.swift highlight=5-6
actor CaptureService {
    
    /// A value that indicates whether the capture service is idle or capturing a photo or movie.
    @Published private(set) var captureActivity: CaptureActivity = .idle
    /// A value that indicates the current capture capabilities of the service.
    @Published private(set) var captureCapabilities = CaptureCapabilities.unknown
    
    /// A type that connects a preview destination with the capture session.
    nonisolated let previewSource: PreviewSource
```

### Step
In `updateCaptureCapabilities()`, copy the capabilities of the photo service to the new property.

Now the name of this method from chapter 3 is correct: it configures the outputs, and then it publishes what they can do. In this chapter, no code reads the published value. In chapter 9, the model observes it to show or hide the HDR button.

```swift file=AVCam/CaptureService.swift highlight=4-5
    private func updateCaptureCapabilities() {
        // Update the output service configuration.
        outputServices.forEach { $0.updateConfiguration(for: currentDevice) }
        // Set the capture service's capabilities.
        captureCapabilities = photoCapture.capabilities
    }
```

### Step
Build and run the app, and take a photo.

The output now has the features, but no capture asks for a Live Photo or for a different quality level. In the Simulator with SimCam, the result is the same as before. On a real iPhone, the output can now give a proxy for some captures, and the code of the last section saves it.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail, as before.
```

## Select the features for each capture

This section is level 2 of the rule: each capture asks for values inside the limits that the output prepared. The values come from the person, so you make a path for them: from the model, through the capture service, to the settings object.

### Step
In `PhotoCapture.swift`, give `createPhotoSettings` a `features` parameter, and change the comment above it.

Also delete the empty line below the line with the method name, as the Apple sample does.

```swift file=AVCam/Capture/PhotoCapture.swift remove
    // Create a photo settings object to configure the photo capture.
    private func createPhotoSettings() -> AVCapturePhotoSettings {
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3-4
    // MARK: - Create a photo settings object.
    
    // Create a photo settings object with the features a person enables in the UI.
    private func createPhotoSettings(with features: PhotoFeatures) -> AVCapturePhotoSettings {
        // Create a new settings object to configure the photo capture.
        var photoSettings = AVCapturePhotoSettings()
```

### Step
Before the `return` statement, set the movie URL of the settings when the person wants a Live Photo.

A URL in [`livePhotoMovieFileURL`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/livephotomoviefileurl) makes the capture a Live Photo. `nil` gives a normal photo. The comment says "if the photo output supports Live Photo capture", but the line does not test this. The concepts page explains this probable defect of the sample.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-7
        /// Set the largest dimensions that the photo output supports.
        /// `CaptureService` automatically updates the photo output's `maxPhotoDimensions`
        /// when the capture pipeline changes.
        photoSettings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        
        // Set the movie URL if the photo output supports Live Photo capture.
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled ? URL.movieFileURL : nil
        
        return photoSettings
    }
```

### Step
Set the quality prioritization of the settings from the choice of the person.

The initializer with a raw value changes the app type into the AVFoundation type. Its result is an optional value, so the code uses `if let`. For this Objective-C enumeration, the initializer does not return `nil` for an unknown number. Thus the raw values of the app type must stay 1, 2, and 3. The value in [`photoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization) must not be above the maximum of the output, which you set to `.quality`.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-7
        // Set the movie URL if the photo output supports Live Photo capture.
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled ? URL.movieFileURL : nil
        
        // Set the priority of speed versus quality during this capture.
        if let prioritization = AVCapturePhotoOutput.QualityPrioritization(rawValue: features.qualityPrioritization.rawValue) {
            photoSettings.photoQualityPrioritization = prioritization
        }
        
        return photoSettings
    }
```

### Step
Give `capturePhoto` a `features` parameter, and send the features to `createPhotoSettings(with:)`.

The settings object is new for each capture, so the features of one capture cannot get into a different capture.

```swift file=AVCam/Capture/PhotoCapture.swift remove
    func capturePhoto() async throws -> Photo {
```

```swift file=AVCam/Capture/PhotoCapture.swift remove
            let photoSettings = createPhotoSettings()
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2,7
    /// The app calls this method when the user taps the photo capture button.
    func capturePhoto(with features: PhotoFeatures) async throws -> Photo {
        // Wrap the delegate-based capture API in a continuation to use it in an async context.
        try await withCheckedThrowingContinuation { continuation in
            
            // Create a settings object to configure the photo capture.
            let photoSettings = createPhotoSettings(with: features)
            
            let delegate = PhotoCaptureDelegate(continuation: continuation)
            monitorProgress(of: delegate)
```

### Note
The project does not compile until the end of this section. Each of the next steps repairs one caller.

### Step
In `CaptureService.swift`, give the `capturePhoto` method the same parameter, and send the features to the photo service.

The actor only sends the call to the photo service. `PhotoFeatures` has two simple values, so it can go from the main actor to the capture actor.

```swift file=AVCam/CaptureService.swift remove
    func capturePhoto() async throws -> Photo {
        try await photoCapture.capturePhoto()
```

```swift file=AVCam/CaptureService.swift highlight=2-3
    // MARK: - Photo capture
    func capturePhoto(with features: PhotoFeatures) async throws -> Photo {
        try await photoCapture.capturePhoto(with: features)
    }
```

### Step
In `Camera.swift`, add the two properties that hold the choices of the person to the `Camera` protocol.

The properties are `get set`, because the views change them. A SwiftUI picker needs a binding, and a binding needs a property that it can write.

```swift file=AVCam/Model/Camera.swift highlight=4-5,7-8
    /// Performs a one-time automatic focus and exposure operation.
    func focusAndExpose(at point: CGPoint) async
    
    /// A Boolean value that indicates whether to capture Live Photos when capturing stills.
    var isLivePhotoEnabled: Bool { get set }
    
    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization: QualityPrioritization { get set }
    
    /// Captures a photo and writes it to the user's photo library.
    func capturePhoto() async
```

### Step
In `CameraModel.swift`, add the two properties below the `capturePhoto()` method.

The defaults are a Live Photo and the `.quality` level. `.quality` is a sensible default only because responsive capture and deferred delivery are on. Without them, the person would wait after each photo.

```swift file=AVCam/CameraModel.swift highlight=5-6,8-9
            self.error = error
        }
    }
    
    /// A Boolean value that indicates whether to capture Live Photos when capturing stills.
    var isLivePhotoEnabled = true
    
    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization = QualityPrioritization.quality
    
    /// Performs a focus and expose operation at the specified screen point.
    func focusAndExpose(at point: CGPoint) async {
```

### Step
In `capturePhoto()`, make a `PhotoFeatures` value from the two properties, and send it with the capture request.

The model reads the properties at the moment of the tap. Each capture gets its own copy of the values, so a change in the interface during a capture has no effect on that capture.

```swift file=AVCam/CameraModel.swift remove
            let photo = try await captureService.capturePhoto()
```

```swift file=AVCam/CameraModel.swift highlight=4-5
    /// Captures a photo and writes it to the user's Photos library.
    func capturePhoto() async {
        do {
            let photoFeatures = PhotoFeatures(isLivePhotoEnabled: isLivePhotoEnabled, qualityPrioritization: qualityPrioritization)
            let photo = try await captureService.capturePhoto(with: photoFeatures)
            try await mediaLibrary.save(photo: photo)
        } catch {
            self.error = error
        }
    }
```

### Step
In `PreviewCameraModel.swift`, add the two properties with the same defaults.

The model for SwiftUI previews must conform to the `Camera` protocol too.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=4-5
@Observable
class PreviewCameraModel: Camera {
    
    var isLivePhotoEnabled = true
    var qualityPrioritization = QualityPrioritization.quality
    var shouldFlashScreen = false
```

### Step
Build and run the app, and take a photo.

Each capture now asks for a Live Photo at the `.quality` level. In the Simulator with SimCam, the capture still gives one JPEG photo and no movie. On a real iPhone, the code asks the camera for a Live Photo, and the library gets the photo with its paired video. This tutorial did not verify the result on a real iPhone.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail.
```

## Show the Live Photo badge

The movie of a Live Photo continues for a short time after the tap. A camera app shows a badge during this time, so that the person holds the device still. In this section, you add the badge.

The delegate already sends `isLivePhoto: true` at the start of a capture and `isLivePhoto: false` when the movie stops. But with responsive capture, two captures can overlap, and the first one must not hide the badge of the second one. Thus the photo service counts the Live Photo captures that are in progress.

### Step
In `PhotoCapture.swift`, add the `livePhotoCount` property below the `capabilities` property.

Each capture has its own delegate and its own progress task. The counter is in the `PhotoCapture` object, which all captures share.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-5
    // The current capabilities available.
    private(set) var capabilities: CaptureCapabilities = .unknown
    
    // A count of Live Photo captures currently in progress.
    private var livePhotoCount = 0
    
    // MARK: - Capture a photo.
```

### Step
In `monitorProgress(of:isolation:)`, add a local `isLivePhoto` flag, copy each activity into a variable, and publish the variable.

The flag belongs to one task, and thus to one capture. It holds the last Live Photo state that this capture reported. The copy is a `var`, because the next steps can change the value before the service publishes it.

```swift file=AVCam/Capture/PhotoCapture.swift remove
                captureActivity = activity
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4,7-8
    private func monitorProgress(of delegate: PhotoCaptureDelegate, isolation: isolated (any Actor)? = #isolation) {
        Task {
            _ = isolation
            var isLivePhoto = false
            // Asynchronously monitor the activity of the delegate while the system performs capture.
            for await activity in delegate.activityStream {
                var currentActivity = activity
                captureActivity = currentActivity
            }
        }
    }
```

### Step
Change the counter when the Live Photo state of this capture changes.

One capture sends `isLivePhoto: true` two times: in `willBeginCaptureFor` and in `willCapturePhotoFor`. The comparison with the local flag makes sure that the capture adds 1 only one time, and subtracts 1 only one time.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3-9
            for await activity in delegate.activityStream {
                var currentActivity = activity
                /// More than one activity value for the delegate may report that `isLivePhoto` is `true`.
                /// Only increment/decrement the count when the value changes from its previous state.
                if activity.isLivePhoto != isLivePhoto {
                    isLivePhoto = activity.isLivePhoto
                    // Increment or decrement as appropriate.
                    livePhotoCount += isLivePhoto ? 1 : -1
                }
                captureActivity = currentActivity
            }
```

### Step
When more than one Live Photo capture is in progress, publish an activity with `isLivePhoto` set to `true`.

This is the code of the Apple sample. Its purpose is to keep the badge on while a different capture still records. The test `> 1` is probably not correct: when the first of two captures ends, the counter is 1, and the badge goes off. The concepts page shows the sequence. You keep the line, so that your code stays equal to the sample.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-9
                if activity.isLivePhoto != isLivePhoto {
                    isLivePhoto = activity.isLivePhoto
                    // Increment or decrement as appropriate.
                    livePhotoCount += isLivePhoto ? 1 : -1
                    if livePhotoCount > 1 {
                        /// Set `isLivePhoto` to `true` when there are concurrent Live Photos in progress.
                        /// This prevents the "Live" badge in the UI from flickering.
                        currentActivity = .photoCapture(willCapture: activity.willCapture, isLivePhoto: true)
                    }
                }
                captureActivity = currentActivity
```

### Step
Create a new Swift file with the name `LiveBadge.swift` in the `Overlays` group, and replace its contents.

The badge is the word "LIVE" in white on the accent color, with the shape of a button border.

```swift file=AVCam/Views/Overlays/LiveBadge.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that the app presents to indicate that Live Photo capture is active.
*/

import SwiftUI

/// A view that the app presents to indicate that Live Photo capture is active.
struct LiveBadge: View {
    var body: some View {
        Group {
            Text("LIVE")
                .padding(6)
                .foregroundColor(.white)
                .font(.subheadline.bold())
        }
        .background(Color.accentColor.opacity(0.9))
        .clipShape(.buttonBorder)
    }
}

#Preview {
    LiveBadge()
        .padding()
        .background(.black)
}
```

### Step
In `CameraUI.swift`, add the badge as an overlay at the top, and make it visible only while the activity is a Live Photo.

The badge is always in the view tree, and only its opacity changes. The model stores each activity value that is not a `willCapture` value, so `camera.captureActivity.isLivePhoto` follows the values that the delegate sends at the start and at the end of the movie.

```swift file=AVCam/Views/CameraUI.swift highlight=4-7
        } action: { size in
            windowSize = size
        }
        .overlay(alignment: .top) {
            LiveBadge()
                .opacity(camera.captureActivity.isLivePhoto ? 1.0 : 0.0)
        }
        .overlay {
            StatusOverlayView(status: camera.status)
        }
    }
```

### Step
Build and run the app, and take a photo.

In the Simulator with SimCam, the badge does not appear, because the capture is not a Live Photo. On a real iPhone, the code shows the badge at the top of the screen from the start of the capture until the movie stops. To see the badge with no camera, open `LiveBadge.swift` and look at its preview in the Xcode canvas.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail. In the Simulator, no badge appears.
```

## Add the features toolbar

The person cannot change the two features yet. In this last section, you create a toolbar with a Live Photo button and a quality menu, and you put it into the two layouts from chapter 5.

### Step
Create a group with the name `FeatureToolbar` in the `Toolbars` group. In it, create a Swift file with the name `FeatureToolbar.swift`, and replace its contents.

The name of the file has no "s", but the name of the view is `FeaturesToolbar`. This is how the Apple sample names them. The view adopts `PlatformView` from chapter 5, so it can select the size of its buttons from the size classes. The spacer pushes the controls to the trailing edge.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that presents controls to enable capture features.
*/

import SwiftUI

/// A view that presents controls to enable capture features.
struct FeaturesToolbar<CameraModel: Camera>: PlatformView {
    
    @Environment(\.verticalSizeClass) var verticalSizeClass
    @Environment(\.horizontalSizeClass) var horizontalSizeClass
    
    @State var camera: CameraModel
    
    var body: some View {
        HStack(spacing: 30) {
            Spacer()
        }
        .buttonStyle(DefaultButtonStyle(size: isRegularSize ? .large : .small))
        .padding([.leading, .trailing])
    }
}
```

### Step
Add the `livePhotoButton` property, and put the button into the stack.

The button changes `isLivePhotoEnabled` on the model. The next capture reads the new value. The icon has a slash when Live Photo is off.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=4,10-17
    var body: some View {
        HStack(spacing: 30) {
            Spacer()
            livePhotoButton
        }
        .buttonStyle(DefaultButtonStyle(size: isRegularSize ? .large : .small))
        .padding([.leading, .trailing])
    }
    
    //  A button to toggle the enabled state of Live Photo capture.
    var livePhotoButton: some View {
        Button {
            camera.isLivePhotoEnabled.toggle()
        } label: {
            Image(systemName: camera.isLivePhotoEnabled ? "livephoto" : "livephoto.slash")
        }
    }
}
```

### Step
Below `livePhotoButton`, add the `prioritizePicker` property with a menu that contains a picker.

`$camera.qualityPrioritization` is a binding to the property of the model, so the picker reads and writes the value directly. `ForEach` can list the cases because the enumeration is `CaseIterable` and `Identifiable`. Each row shows the `description` of its case.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=10-18,20-22
    //  A button to toggle the enabled state of Live Photo capture.
    var livePhotoButton: some View {
        Button {
            camera.isLivePhotoEnabled.toggle()
        } label: {
            Image(systemName: camera.isLivePhotoEnabled ? "livephoto" : "livephoto.slash")
        }
    }
    
    @ViewBuilder
    var prioritizePicker: some View {
        Menu {
            Picker("Quality Prioritization", selection: $camera.qualityPrioritization) {
                ForEach(QualityPrioritization.allCases) {
                    Text($0.description)
                        .font(.body.weight(.bold))
                }
            }

        } label: {
        }
    }
}
```

### Step
In the label of the menu, show a dial icon for the selected level.

The icon shows the current level before the person opens the menu: a low dial for speed, a middle dial for balanced, and a high dial for quality.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=12-19
    @ViewBuilder
    var prioritizePicker: some View {
        Menu {
            Picker("Quality Prioritization", selection: $camera.qualityPrioritization) {
                ForEach(QualityPrioritization.allCases) {
                    Text($0.description)
                        .font(.body.weight(.bold))
                }
            }

        } label: {
            switch camera.qualityPrioritization {
            case .speed:
                Image(systemName: "dial.low")
            case .balanced:
                Image(systemName: "dial.medium")
            case .quality:
                Image(systemName: "dial.high")
            }
        }
    }
}
```

### Step
Put the menu into the stack, after the Live Photo button.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=5
    var body: some View {
        HStack(spacing: 30) {
            Spacer()
            livePhotoButton
            prioritizePicker
        }
        .buttonStyle(DefaultButtonStyle(size: isRegularSize ? .large : .small))
        .padding([.leading, .trailing])
    }
```

### Step
In `CameraUI.swift`, add the features toolbar to the two layouts.

In the compact layout, the toolbar is at the top of the screen, and the spacer keeps the main toolbar at the bottom. In the regular layout, the toolbar is in the same bar as the main toolbar, 250 points to the right of the center. The comment in the sample says "vertical", but the offset is horizontal.

```swift file=AVCam/Views/CameraUI.swift highlight=5,19-21
    /// This view arranges UI elements vertically.
    @ViewBuilder
    var compactUI: some View {
        VStack(spacing: 0) {
            FeaturesToolbar(camera: camera)
            Spacer()
            MainToolbar(camera: camera)
                .padding(.bottom, bottomPadding)
        }
    }
    
    /// This view arranges UI elements in a layered stack.
    @ViewBuilder
    var regularUI: some View {
        VStack {
            Spacer()
            ZStack {
                MainToolbar(camera: camera)
                FeaturesToolbar(camera: camera)
                    .frame(width: 250)
                    .offset(x: 250) // The vertical offset from center.
            }
            .frame(width: 740)
            .background(.ultraThinMaterial.opacity(0.8))
            .cornerRadius(12)
            .padding(.bottom, 32)
        }
    }
```

### Step
Build and run the app. Tap the Live Photo button, open the quality menu, and take a photo.

The features toolbar is at the top right of the screen, with the Live Photo button and the dial of the quality menu. The menu has the three levels "Speed", "Balanced", and "Quality". In the Simulator with SimCam, each capture saves a JPEG photo and shows its thumbnail, with each setting. The features themselves need a real iPhone: there, look in the Photos app for the Live Photo.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The Live Photo button and the quality menu are at the top right. A capture saves a photo and shows its thumbnail.
Note: In the Simulator with SimCam, the photo is not a Live Photo, and no badge appears.
```

### Experiment
On a real iPhone, set the menu to "Speed" and take five photos as quickly as you can. Then set it to "Quality" and do it again. Compare the time between the photos, and compare the photos in the Photos app.

### Text
Your code is now the same as the `chapter-07` branch. The photo side of the app is complete. Until chapter 8, the movie of a Live Photo has no sound, because the session has no microphone input. In the next chapter, you add the microphone, a movie output, and a switch between photo mode and video mode.

## Check your understanding

### You delete the line `photoOutput.maxPhotoQualityPrioritization = .quality`. The model still asks for `.quality` in each capture. What occurs?

- [ ] The photo output silently uses `.balanced`, because that is its default maximum.
  > The output does not decrease the value for you. A request above the maximum is an error of the programmer.
- [x] The photo output raises an exception at the capture, because the request is above the maximum of the output.
  > Correct. The default maximum is `.balanced`. Each value in the settings must stay inside the limits that the output prepared. This is the two-level rule.
- [ ] The capture works, but each photo needs more time.
  > The capture does not start. The settings are not legal for this output.

### The delegate received a proxy in `didFinishCapturingDeferredPhotoProxy`. Why must the app save its data as `.photoProxy` and not as `.photo`?

- [ ] A `.photo` resource cannot have a location or a paired video.
  > The resource type of the photo has no effect on the location or on the paired video.
- [ ] When deferred delivery is enabled, the Photos library accepts only the type `.photoProxy` for each photo.
  > One session gives the two kinds of photo. Normal photo data keeps the type `.photo`. The save of normal photo data with the type `.photoProxy` fails.
- [x] Only with `.photoProxy` does the Photos library know that it must complete the photo later.
  > Correct. This type tells Photos to do the later processing. With `.photo`, the library probably keeps the image with light processing as the final photo.

### Two Live Photo captures overlap. Why does `PhotoCapture` count the captures in progress, and not publish each `isLivePhoto` value as it arrives?

- [ ] The photo output permits only one Live Photo capture at a time, and the counter refuses the second one.
  > The counter does not refuse a capture. With responsive capture, captures can overlap.
- [x] Without a count, the end of the first movie would hide the badge while the second movie still records.
  > Correct. Each capture reports only its own state. The shared counter tells the service if a different capture is still "live". The concepts page shows that the test in the sample is probably not fully correct.
- [ ] The counter makes the names of the movie files unique.
  > The UUID in `URL.movieFileURL` makes the names unique. The counter is only for the badge.
