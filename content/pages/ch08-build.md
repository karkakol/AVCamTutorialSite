---
kind: tutorial
chapter: 8
title: Build: RAW and Apple ProRAW
abstract: Add a RAW control to the features toolbar. The app then captures a DNG file together with the processed photo and saves both in one asset in the Photos library.
estimatedMinutes: 45
startBranch: chapter-07
branch: chapter-08
---

In this tutorial, you add RAW capture to the photo service. The person chooses Off, Apple ProRAW, or RAW in a new menu of the features toolbar. When the choice is not Off, one tap gives two photos: a DNG file and the processed photo. The app saves both in one asset in the Photos library.

You work in an order that keeps the app safe at each checkpoint. First you teach the delegate and the media library to handle a DNG. Then you ask the camera for RAW. Only then do you add the control that the person uses.

This is part 2 code inside part 1 of the numbering. The Apple sample has no RAW capture, so the design of this chapter is this tutorial's own. [Concepts: RAW and Apple ProRAW](ch08-concepts.md) explains the design and its limits.

> [!IMPORTANT]
> The Simulator with SimCam has no RAW format. The RAW control stays hidden there, and a capture gives a normal photo. The RAW capture itself needs a real iPhone with a Pro camera. One test on such an iPhone found that RAW and deferred delivery do not work together; the section "Turn off deferred delivery for RAW" is the fix. Where the text says what an iPhone does after the fix, it is an expectation from the SDK headers, the Apple documentation, and that test.

Read [Concepts: RAW and Apple ProRAW](ch08-concepts.md) first if you want the background for each step.

## Describe the RAW choices

The views and the model must not use AVFoundation types. In this section, you add small app types that carry the choice of the person down to the capture code, and the abilities of the camera up to the interface. This is the same method as in chapter 7.

### Step
In `DataTypes.swift`, below `QualityPrioritization`, add the `RAWFormat` enumeration with the cases `off`, `appleProRAW`, and `bayerRAW`.

The enumeration adopts `Int`, `Identifiable`, `CaseIterable`, `CustomStringConvertible`, and `Codable`, in this order. For `Identifiable`, write `var id: Self { self }` as the first line of the body. Give each case a `///` comment above it: "No RAW photo.", "A linear DNG that the system partially processes.", and "A DNG with the unprocessed sensor data." Leave the raw values at their defaults. Add a `///` comment above the enumeration too.

Chapter 7 used a three-way choice for the quality. RAW is also a choice of three, because Apple ProRAW and RAW are two different formats. The `description` property comes in the next step, so the project does not compile until then.

```swift file=AVCam/Model/DataTypes.swift highlight=7-16
        case .quality:
            return "Quality"
        }
    }
}

/// An enumeration that describes the RAW format to capture along with the processed photo.
enum RAWFormat: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
    var id: Self { self }
    /// No RAW photo.
    case off
    /// A linear DNG that the system partially processes.
    case appleProRAW
    /// A DNG with the unprocessed sensor data.
    case bayerRAW
}

enum CameraError: Error {
```

### Step
Add the `description` property of type `String` to `RAWFormat`, below the last case.

A `switch` on `self` returns "Off", "Apple ProRAW", and "RAW". The menu shows these texts. The Bayer format has the short name "RAW" because that is the name that the system camera uses. The project compiles again after this step.

```swift file=AVCam/Model/DataTypes.swift highlight=9-18
enum RAWFormat: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
    var id: Self { self }
    /// No RAW photo.
    case off
    /// A linear DNG that the system partially processes.
    case appleProRAW
    /// A DNG with the unprocessed sensor data.
    case bayerRAW
    var description: String {
        switch self {
        case .off:
            return "Off"
        case .appleProRAW:
            return "Apple ProRAW"
        case .bayerRAW:
            return "RAW"
        }
    }
}
```

### Step
In the `PhotoFeatures` structure, add the property `rawFormat` with the default value `RAWFormat.off`.

Write it as `var rawFormat = RAWFormat.off`. The type is `RAWFormat`. Because it is a `var` with a default value, the memberwise initializer still accepts the two arguments from chapter 7, so the code that creates `PhotoFeatures` still compiles. One value of this type goes with each capture request.

```swift file=AVCam/Model/DataTypes.swift highlight=4
struct PhotoFeatures {
    let isLivePhotoEnabled: Bool
    let qualityPrioritization: QualityPrioritization
    var rawFormat = RAWFormat.off
}
```

### Step
In the `CaptureCapabilities` structure, add the properties `isAppleProRAWSupported` and `isBayerRAWSupported`, both of type `Bool`, below `isLivePhotoCaptureSupported`.

Both are `let`. They tell the interface which RAW formats the current camera offers. The initializer does not set them yet, so the project does not compile until the next step.

```swift file=AVCam/Model/DataTypes.swift highlight=6-7
/// A structure that represents the capture capabilities of `CaptureService` in
/// its current configuration.
struct CaptureCapabilities {

    let isLivePhotoCaptureSupported: Bool
    let isAppleProRAWSupported: Bool
    let isBayerRAWSupported: Bool
```

### Step
Replace the initializer of `CaptureCapabilities` with one that has three parameters, `isLivePhotoCaptureSupported`, `isAppleProRAWSupported`, and `isBayerRAWSupported`, and assign the two new properties.

Each parameter has the type `Bool` and the default value `false`, so `CaptureCapabilities()` and `CaptureCapabilities.unknown` still mean "nothing is supported". The new `self` assignments go below the existing one. Delete the old first line of the initializer and keep the rest. The project compiles again after this step.

```swift file=AVCam/Model/DataTypes.swift remove
    init(isLivePhotoCaptureSupported: Bool = false) {
```

```swift file=AVCam/Model/DataTypes.swift highlight=3-5,7-8
    let isBayerRAWSupported: Bool
    
    init(isLivePhotoCaptureSupported: Bool = false,
         isAppleProRAWSupported: Bool = false,
         isBayerRAWSupported: Bool = false) {
        self.isLivePhotoCaptureSupported = isLivePhotoCaptureSupported
        self.isAppleProRAWSupported = isAppleProRAWSupported
        self.isBayerRAWSupported = isBayerRAWSupported
    }
    
    static let unknown = CaptureCapabilities()
}
```

### Step
Build the project.

The new types are only declared. Nothing uses them yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Save the DNG

A RAW capture gives two photos: the DNG and the processed photo. In this section, you teach the delegate to keep both, and you teach `MediaLibrary` to save both in one asset. The capture does not ask for RAW yet, so you can build and run at the end.

### Step
In `DataTypes.swift`, add the property `rawData` of type `Data?` to the `Photo` structure, below `livePhotoMovieURL`.

It holds the bytes of the DNG file. It is `nil` when the capture has no RAW photo. Add the `///` comment "The DNG data of a RAW capture, or `nil` when the capture has no RAW photo." above it. The property has no default value, so the project does not compile until step 3 of this section, where you change the only code that creates a `Photo`.

```swift file=AVCam/Model/DataTypes.swift highlight=5-6
struct Photo: Sendable {
    let data: Data
    let isProxy: Bool
    let livePhotoMovieURL: URL?
    /// The DNG data of a RAW capture, or `nil` when the capture has no RAW photo.
    let rawData: Data?
}
```

### Step
In `PhotoCapture.swift`, add the property `private var rawData: Data?` to `PhotoCaptureDelegate`, below `photoData`.

The delegate keeps each result until the capture ends. Now it keeps three: the processed photo, the DNG, and the movie URL.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=9
private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    
    private let continuation: PhotoContinuation
    
    private var isLivePhoto = false
    private var isProxyPhoto = false
    
    private var photoData: Data?
    private var rawData: Data?
    private var livePhotoMovieURL: URL?
```

### Step
In `didFinishCaptureFor`, pass `rawData: rawData` as the last argument of the `Photo(...)` call.

The project compiles again after this step. The `Photo` value now carries the DNG to the media library.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        let photo = Photo(data: photoData, isProxy: isProxyPhoto, livePhotoMovieURL: livePhotoMovieURL)
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2
        /// Create a photo object to save to the `MediaLibrary`.
        let photo = Photo(data: photoData, isProxy: isProxyPhoto, livePhotoMovieURL: livePhotoMovieURL, rawData: rawData)
        // Resume the continuation by returning the captured photo.
        continuation.resume(returning: photo)
```

### Step
In [`photoOutput(_:didFinishProcessingPhoto:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:)), store the data of a RAW photo in `rawData`, and the data of every other photo in `photoData`.

Test [`photo.isRawPhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/israwphoto) in an `if`. In the `if` branch, call `fileDataRepresentation()` and keep the result in a constant `data`, log "Captured RAW photo, N bytes" with `logger.debug` (use `data?.count ?? 0` for N), and assign `data` to `rawData`. In the `else` branch, assign `fileDataRepresentation()` to `photoData`, as the old line did. Put a `//` comment above the `if`: "A RAW capture calls this method twice: once for the DNG and once for the processed photo."

A RAW request calls the method twice. Without the test, the second call would replace the first one, and the app would keep only one of the two photos. [`fileDataRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation()) returns DNG data for the RAW photo. Delete the old `photoData` line: it moves into the `else` branch.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        photoData = photo.fileDataRepresentation()
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-13
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            logger.debug("Error capturing photo: \(String(describing: error))")
            return
        }
        // A RAW capture calls this method twice: once for the DNG and once for the processed photo.
        if photo.isRawPhoto {
            let data = photo.fileDataRepresentation()
            logger.debug("Captured RAW photo, \(data?.count ?? 0) bytes")
            rawData = data
        } else {
            photoData = photo.fileDataRepresentation()
        }
    }
```

### Step
In `MediaLibrary.swift`, change `save(photo:)` so that it saves the DNG as the `.photo` resource and the processed data as the `.alternatePhoto` resource when `photo.rawData` exists and the photo is not a proxy.

Use `if let rawData = photo.rawData, !photo.isProxy`, with the comment "Proxy data is valid only as a `.photoProxy` resource, so a RAW pair needs a fully processed photo." above it. In that branch, call `addResource(with:data:options:)` twice on `creationRequest` with the same `options`: first `.photo` with `rawData`, then `.alternatePhoto` with `photo.data`. Put the comment "Save the DNG as the primary photo and the processed photo as its alternate." above them. The `else` branch keeps the old code, with its comment, one level deeper. Delete the old comment and the old call: they move into the `else` branch.

Both resources go into one [`PHAssetCreationRequest`](https://developer.apple.com/documentation/photos/phassetcreationrequest), so Photos makes one asset. The order follows Apple's article about RAW capture. The concepts page explains why it is an open question. The `location` and the Live Photo code below stay as they are.

The `!photo.isProxy` test is for deferred delivery from chapter 7. The data of a proxy is not a finished photo. Photos accepts it only as a `.photoProxy` resource, and it finishes the photo later. So a proxy never goes into the RAW pair. It takes the `else` branch. Later in this chapter, you turn deferred delivery off for RAW, so a RAW capture does not get a proxy.

```swift file=AVCam/Model/MediaLibrary.swift remove
            // Specify the appropriate resource type for the photo.
            creationRequest.addResource(with: photo.isProxy ? .photoProxy : .photo, data: photo.data, options: options)
```

```swift file=AVCam/Model/MediaLibrary.swift highlight=3-11
            // Save primary photo.
            let options = PHAssetResourceCreationOptions()
            // Proxy data is valid only as a `.photoProxy` resource, so a RAW pair needs a fully processed photo.
            if let rawData = photo.rawData, !photo.isProxy {
                // Save the DNG as the primary photo and the processed photo as its alternate.
                creationRequest.addResource(with: .photo, data: rawData, options: options)
                creationRequest.addResource(with: .alternatePhoto, data: photo.data, options: options)
            } else {
                // Specify the appropriate resource type for the photo.
                creationRequest.addResource(with: photo.isProxy ? .photoProxy : .photo, data: photo.data, options: options)
            }
            creationRequest.location = location
```

### Step
Build and run the app, and take a photo.

No capture asks for RAW yet, so `rawData` is always `nil`, and the `else` branch saves the photo as before.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail, as before.
```

## Ask the camera for RAW

Now you use the two levels again. On the photo output, you enable Apple ProRAW once. In the settings of each capture, you choose the RAW format. The model does not send a choice yet, so the app still takes normal photos at the end of this section.

### Step
In `PhotoCapture.swift`, below `createPhotoSettings(with:)`, add the private method `rawPixelFormat(for:)` that takes a `RAWFormat` and returns an `OSType?`. Write its start now.

Name the parameter `rawFormat`. Put the `///` comment "Returns the first RAW pixel format of the requested kind that the photo output offers." above it. In the body, read [`photoOutput.availableRawPhotoPixelFormatTypes`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotopixelformattypes-9t9k5) into a constant `formats`, then write `switch rawFormat` with the case `.off` that returns `nil`.

The property is an array of `OSType` values, one for each RAW format that the output offers now. The array is empty when the camera has no RAW. The method returns the first format of the kind that the person chose, or `nil`. The `switch` does not cover all cases yet, so do not build now.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-11
        return photoSettings
    }
    
    /// Returns the first RAW pixel format of the requested kind that the photo output offers.
    private func rawPixelFormat(for rawFormat: RAWFormat) -> OSType? {
        let formats = photoOutput.availableRawPhotoPixelFormatTypes
        switch rawFormat {
        case .off:
            return nil
        }
    }
    
    /// Monitors the progress of a photo capture delegate.
```

### Step
Add the cases `.appleProRAW` and `.bayerRAW` to the `switch`, each with a `return` that finds the first matching format.

Write `return formats.first { AVCapturePhotoOutput.isAppleProRAWPixelFormat($0) }` for `.appleProRAW` and `return formats.first { AVCapturePhotoOutput.isBayerRAWPixelFormat($0) }` for `.bayerRAW`. These two class methods are [`isAppleProRAWPixelFormat(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawpixelformat(_:)) and [`isBayerRAWPixelFormat(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isbayerrawpixelformat(_:)). The project compiles again after this step.

The list holds both kinds of format. The system sorts the formats of Apple ProRAW after the Bayer formats, so a test of each format is the only safe way to find the kind.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=7-10
    /// Returns the first RAW pixel format of the requested kind that the photo output offers.
    private func rawPixelFormat(for rawFormat: RAWFormat) -> OSType? {
        let formats = photoOutput.availableRawPhotoPixelFormatTypes
        switch rawFormat {
        case .off:
            return nil
        case .appleProRAW:
            return formats.first { AVCapturePhotoOutput.isAppleProRAWPixelFormat($0) }
        case .bayerRAW:
            return formats.first { AVCapturePhotoOutput.isBayerRAWPixelFormat($0) }
        }
    }
```

### Step
In `updateConfiguration(for:)`, set `photoOutput.isAppleProRAWEnabled` to `photoOutput.isAppleProRAWSupported`, below the line for deferred photo delivery.

Add the comment "Enabling Apple ProRAW adds its formats to the available RAW formats." above the line. This is level 1 of the two-level rule. Both properties are on the photo output: [`isAppleProRAWSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported) and [`isAppleProRAWEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled).

Without this line, the list of RAW formats holds only Bayer formats. Enabling Apple ProRAW makes the pipeline build again, which takes time, so it must happen before the session starts. `CaptureService` calls this method before `startRunning()`. The line comes before `updateCapabilities(for:)`, which reads the list.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=1-2
        // Enabling Apple ProRAW adds its formats to the available RAW formats.
        photoOutput.isAppleProRAWEnabled = photoOutput.isAppleProRAWSupported
        updateCapabilities(for: device)
    }
```

### Step
In `updateCapabilities(for:)`, pass the two RAW flags to the `CaptureCapabilities` initializer.

Use the labels `isAppleProRAWSupported:` and `isBayerRAWSupported:`. The values are `rawPixelFormat(for: .appleProRAW) != nil` and `rawPixelFormat(for: .bayerRAW) != nil`. Keep `isLivePhotoCaptureSupported:` as the first argument and put each argument on its own line. Delete the old one-line call.

The flags come from the same helper that the capture uses. Thus the interface offers a format only if a capture can really request it.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: photoOutput.isLivePhotoCaptureSupported)
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-4
    private func updateCapabilities(for device: AVCaptureDevice) {
        capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: photoOutput.isLivePhotoCaptureSupported,
                                           isAppleProRAWSupported: rawPixelFormat(for: .appleProRAW) != nil,
                                           isBayerRAWSupported: rawPixelFormat(for: .bayerRAW) != nil)
    }
```

### Step
In `createPhotoSettings(with:)`, below the HEVC block, add the constant `rawType` that holds `rawPixelFormat(for: features.rawFormat)`.

Add two `///` comment lines above it. The first is "Request a RAW photo along with the processed photo when the device supports the chosen format." The second is "The capture then delivers two photos, so the processed format needs a codec of its own." The type of `rawType` is `OSType?`. It is `nil` when the choice is Off, or when the camera has no such format.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-7
        if photoOutput.availablePhotoCodecTypes.contains(.hevc) {
            photoSettings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
        }
        
        /// Request a RAW photo along with the processed photo when the device supports the chosen format.
        /// The capture then delivers two photos, so the processed format needs a codec of its own.
        let rawType = rawPixelFormat(for: features.rawFormat)
```

### Step
Below `rawType`, add `if let rawType` that replaces `photoSettings` with a settings object for RAW plus a processed photo.

Inside the `if`, first choose the codec in a constant `codec` of type `AVVideoCodecType`: `.hevc` when `photoOutput.availablePhotoCodecTypes` contains it, else `.jpeg`. Then assign `AVCapturePhotoSettings(rawPixelFormatType: rawType, processedFormat: [AVVideoCodecKey: codec])` to `photoSettings`, with `processedFormat:` on its own line. Last, log "Capturing with RAW format: " and `features.rawFormat.description` with `logger.debug`.

The initializer [`init(rawPixelFormatType:processedFormat:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:)) asks for the DNG and for a processed photo. If you pass `nil` for the processed format, you get the DNG only. The processed photo needs a codec of its own. The Simulator has no HEVC, so JPEG is the fallback. The rest of the method (preview format, photo size) now works on the new settings object.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-7
        let rawType = rawPixelFormat(for: features.rawFormat)
        if let rawType {
            let codec: AVVideoCodecType = photoOutput.availablePhotoCodecTypes.contains(.hevc) ? .hevc : .jpeg
            photoSettings = AVCapturePhotoSettings(rawPixelFormatType: rawType,
                                                   processedFormat: [AVVideoCodecKey: codec])
            logger.debug("Capturing with RAW format: \(features.rawFormat.description)")
        }
        
        /// Set the format of the preview image to capture. The `photoSettings` object returns the available
```

### Step
Change the line that sets `livePhotoMovieFileURL` so that an Apple ProRAW capture has no Live Photo movie.

Above the line, add the constant `excludesLivePhoto`: it is `true` when `rawType != nil && features.rawFormat == .appleProRAW`. Add the comment "An Apple ProRAW capture can't include a Live Photo movie." above it. Then add `&& !excludesLivePhoto` to the condition of the existing line. Delete the old line.

If a Live Photo movie URL is in the settings of an Apple ProRAW capture, the photo output raises an exception. Swift `try` does not catch it, so the app would stop. The Live Photo button stays on in the interface. For a RAW capture, the app takes the photo and skips the movie. A capture with Bayer RAW keeps the movie, because the SDK header allows it. Nobody tested this on a real iPhone.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled ? URL.movieFileURL : nil
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-6
        photoSettings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        
        // Set the movie URL if the photo output supports Live Photo capture.
        // An Apple ProRAW capture can't include a Live Photo movie.
        let excludesLivePhoto = rawType != nil && features.rawFormat == .appleProRAW
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled && !excludesLivePhoto ? URL.movieFileURL : nil
```

### Step
After the code that sets the quality prioritization, add an `if` that forces `.speed` for a Bayer RAW capture.

The condition is `rawType != nil && features.rawFormat == .bayerRAW`. In the body, assign `.speed` to `photoSettings.photoQualityPrioritization`. Put the comment "A Bayer RAW capture throws an exception with any prioritization other than speed." above the `if`.

The default of the app is `.quality`. A Bayer RAW capture with `.quality` or `.balanced` raises an exception. Thus the code overrides the quality menu for this one capture. The processed photo of this capture also gets `.speed`. Apple ProRAW has no such rule, so it keeps the value of the person.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-9
        // Set the priority of speed versus quality during this capture.
        if let prioritization = AVCapturePhotoOutput.QualityPrioritization(rawValue: features.qualityPrioritization.rawValue) {
            photoSettings.photoQualityPrioritization = prioritization
        }
        
        // A Bayer RAW capture throws an exception with any prioritization other than speed.
        if rawType != nil && features.rawFormat == .bayerRAW {
            photoSettings.photoQualityPrioritization = .speed
        }
        
        return photoSettings
```

### Step
Build and run the app, and take a photo.

`PhotoFeatures.rawFormat` is always `.off` at this time, because the model does not send a choice yet. Thus `rawType` is `nil`, and the capture is the same as in the last section.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail, as before. The console shows no RAW line.
```

## Turn off deferred delivery for RAW

Chapter 7 turned on automatic deferred photo delivery. A first test on a real iPhone showed that this setting and RAW do not work together: the app asked for Apple ProRAW, but no RAW photo arrived. In this section, you turn deferred delivery off while a RAW format is chosen. You also add log lines that show what the photo output decides for each capture. [Concepts: What a device test showed](ch08-concepts.md#what-a-device-test-showed) gives the full story.

### Step
In `PhotoCapture.swift`, below the `capabilities` property, add the property `private var rawFormat = RAWFormat.off`.

Put the comment "The RAW format that a person chooses in the UI." above it. The photo service needs its own copy of the choice, because it sets up the photo output when the camera changes, not only when the person captures.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-5
    // The current capabilities available.
    private(set) var capabilities: CaptureCapabilities = .unknown
    
    // The RAW format that a person chooses in the UI.
    private var rawFormat = RAWFormat.off
    
    // A count of Live Photo captures currently in progress.
```

### Step
Below `updateCapabilities(for:)`, add the private method `updateDeferredPhotoDelivery()` that turns deferred delivery on only when `rawFormat` is `.off`.

Put the comment "Enables deferred photo delivery only while no RAW format is in use." above the method. In the body, compute the constant `isEnabled`: `photoOutput.isAutoDeferredPhotoDeliverySupported && rawFormat == .off`. Then assign `isEnabled` to [`photoOutput.isAutoDeferredPhotoDeliveryEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled), but only inside an `if` that tests whether the value is different. Copy the two comments from the code.

[`AVCaptureDeferredPhotoProxy`](https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy) is never a RAW photo: the SDK header says that deferred processing is not available for RAW. Each change of `isAutoDeferredPhotoDeliveryEnabled` makes the capture pipeline build again, which takes time. The `if` prevents this work when the value stays the same.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-13
                                           isBayerRAWSupported: rawPixelFormat(for: .bayerRAW) != nil)
    }
    
    // Enables deferred photo delivery only while no RAW format is in use.
    private func updateDeferredPhotoDelivery() {
        // Deferred processing isn't available for RAW photos. With deferred delivery on, a RAW request
        // can deliver a proxy for the processed photo and no RAW photo at all.
        let isEnabled = photoOutput.isAutoDeferredPhotoDeliverySupported && rawFormat == .off
        // A change reconfigures the capture pipeline, which takes time. Change the value only when necessary.
        if photoOutput.isAutoDeferredPhotoDeliveryEnabled != isEnabled {
            photoOutput.isAutoDeferredPhotoDeliveryEnabled = isEnabled
        }
    }
```

### Step
At the end of `updateDeferredPhotoDelivery()`, log the supported and the enabled state of deferred delivery with `logger.debug`.

The text is "Deferred photo delivery (supported/enabled): " followed by `self.photoOutput.isAutoDeferredPhotoDeliverySupported`, a slash, and `isEnabled`. The log message is a closure that runs later, so Swift asks for `self.` in front of the property. On a device, this line tells you which state the output has after each change.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4
        if photoOutput.isAutoDeferredPhotoDeliveryEnabled != isEnabled {
            photoOutput.isAutoDeferredPhotoDeliveryEnabled = isEnabled
        }
        logger.debug("Deferred photo delivery (supported/enabled): \(self.photoOutput.isAutoDeferredPhotoDeliverySupported)/\(isEnabled)")
    }
```

### Step
In `updateConfiguration(for:)`, replace the line that sets `isAutoDeferredPhotoDeliveryEnabled` with a call to `updateDeferredPhotoDelivery()`.

Delete the old line from chapter 7. The old line turned deferred delivery on for every camera that supports it. The call now also respects the RAW choice, so a change of camera does not turn deferred delivery on again while RAW is chosen.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        photoOutput.isAutoDeferredPhotoDeliveryEnabled = photoOutput.isAutoDeferredPhotoDeliverySupported
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2
        photoOutput.isFastCapturePrioritizationEnabled = photoOutput.isFastCapturePrioritizationSupported
        updateDeferredPhotoDelivery()
        // Enabling Apple ProRAW adds its formats to the available RAW formats.
```

### Step
Between `updateCapabilities(for:)` and `updateDeferredPhotoDelivery()`, add the method `setRAWFormat(_:)` that stores the choice and calls `updateDeferredPhotoDelivery()`.

The method is internal, because `CaptureService` calls it. It takes one parameter `rawFormat` of type `RAWFormat` and assigns it to `self.rawFormat`. Copy the three `///` comment lines from the code.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=1-7
    /// Updates the photo output for the RAW format that a person chooses.
    ///
    /// The `CaptureService` calls this method when the RAW format changes.
    func setRAWFormat(_ rawFormat: RAWFormat) {
        self.rawFormat = rawFormat
        updateDeferredPhotoDelivery()
    }
    
    // Enables deferred photo delivery only while no RAW format is in use.
```

### Step
In `CaptureService.swift`, below `capturePhoto(with:)`, add the method `setRAWFormat(_:)` that calls `photoCapture.setRAWFormat(rawFormat)` inside a configuration pair.

Call `captureSession.beginConfiguration()` first, then `defer { captureSession.commitConfiguration() }`, then the call to `photoCapture`. Add the `///` comment "Prepares the photo output for the RAW format that a person chooses." and the `//` comment from the code.

The session runs while the person uses the menu. The documentation advises to set `isAutoDeferredPhotoDeliveryEnabled` before `startRunning()`, but a change during the run is allowed; it only takes time. The configuration pair makes the session apply the change in one step, as `changeCaptureDevice(to:)` does for a camera change.

```swift file=AVCam/CaptureService.swift highlight=5-11
    func capturePhoto(with features: PhotoFeatures) async throws -> Photo {
        try await photoCapture.capturePhoto(with: features)
    }
    
    /// Prepares the photo output for the RAW format that a person chooses.
    func setRAWFormat(_ rawFormat: RAWFormat) {
        // The change can reconfigure the capture pipeline. Bracket it in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        photoCapture.setRAWFormat(rawFormat)
    }
```

### Step
In `PhotoCaptureDelegate`, at the end of `willBeginCaptureFor`, log the resolved settings: the expected photo count and the photo, RAW, and proxy dimensions.

Read [`resolvedSettings.photoDimensions`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/photodimensions), [`rawPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/rawphotodimensions), and [`deferredPhotoProxyDimensions`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/deferredphotoproxydimensions) into the constants `photo`, `raw`, and `proxy`. Then log "Resolved settings: " with [`expectedPhotoCount`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/expectedphotocount) and the `width` and `height` of each constant. Copy the comment from the code.

[`AVCaptureResolvedPhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings) tells what the photo output really does for this capture, before any photo arrives. A RAW capture without deferred delivery has an expected count of 2 and a RAW size that is not 0x0. A proxy size that is not 0x0 means that a proxy replaces the processed photo.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-9
    func photoOutput(_ output: AVCapturePhotoOutput, willBeginCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Determine if this is a live capture.
        isLivePhoto = resolvedSettings.livePhotoMovieDimensions != .zero
        activityContinuation.yield(.photoCapture(isLivePhoto: isLivePhoto))
        // Log what the photo output decides for this capture. A RAW capture expects two photos.
        let photo = resolvedSettings.photoDimensions
        let raw = resolvedSettings.rawPhotoDimensions
        let proxy = resolvedSettings.deferredPhotoProxyDimensions
        logger.debug("Resolved settings: \(resolvedSettings.expectedPhotoCount) photos, photo \(photo.width)x\(photo.height), RAW \(raw.width)x\(raw.height), proxy \(proxy.width)x\(proxy.height)")
    }
```

### Step
In `didFinishCapturingDeferredPhotoProxy`, log "Captured deferred photo proxy, N bytes" as the last line.

Use `self.photoData?.count ?? 0` for N. Now the console shows which callback delivered the photo: this line for a proxy, and "Captured RAW photo" for a DNG. In the device test, the console showed neither line for the RAW photo, and this line did not exist yet.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4
        // Capture the data for this photo.
        photoData = deferredPhotoProxy?.fileDataRepresentation()
        isProxyPhoto = true
        logger.debug("Captured deferred photo proxy, \(self.photoData?.count ?? 0) bytes")
    }
```

### Step
In `updateCapabilities(for:)`, log which RAW kinds the camera offers, with the name of the camera and its `isVirtualDevice` value.

Below the initializer call, copy `capabilities` into a local constant of the same name, so that the log closure does not read the property of `self`. Then log "RAW on ", `device.localizedName`, the value of [`device.isVirtualDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvirtualdevice), and the two flags. Copy the comment from the code.

Bayer RAW exists only on a physical camera, such as the wide camera alone. This app uses the virtual dual camera on the back when the iPhone has one, so that camera offers Apple ProRAW only. The log line shows this on the device.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-8
    private func updateCapabilities(for device: AVCaptureDevice) {
        capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: photoOutput.isLivePhotoCaptureSupported,
                                           isAppleProRAWSupported: rawPixelFormat(for: .appleProRAW) != nil,
                                           isBayerRAWSupported: rawPixelFormat(for: .bayerRAW) != nil)
        // Bayer RAW exists only on a physical camera. A virtual camera, such as the dual camera, offers Apple ProRAW only.
        let capabilities = capabilities
        logger.debug("RAW on \(device.localizedName) (virtual: \(device.isVirtualDevice)): Apple ProRAW \(capabilities.isAppleProRAWSupported), Bayer RAW \(capabilities.isBayerRAWSupported)")
    }
```

### Step
Build and run the app, and look at the Xcode console.

No code calls `setRAWFormat(_:)` yet. At the start, the console shows the RAW line and the deferred delivery line for the camera. In the Simulator with SimCam, both RAW flags are `false`.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo as before. The console shows "RAW on ..." with both RAW kinds false, "Deferred photo delivery (supported/enabled): ...", and a "Resolved settings: 1 photos, ..." line for the capture.
```

## Pass the choice through the model

The camera model keeps the choice of the person, and it keeps the abilities of the current camera. In this section, you add both to the model, to the preview model, and to the `Camera` protocol. You add the protocol members last, so that the project compiles after each step.

### Step
In `CameraModel.swift`, below `qualityPrioritization`, add the property `rawFormat` with the value `RAWFormat.off`, and the property `captureCapabilities` with the value `CaptureCapabilities.unknown`.

Write `var rawFormat = RAWFormat.off` with a `didSet` observer, and `private(set) var captureCapabilities = CaptureCapabilities.unknown`. Give each a `///` comment: "A value that indicates which RAW format to capture along with the processed photo." and "The capture features that the current camera configuration supports." In `didSet`, write the comment "Turn deferred photo delivery off for RAW, and on again for no RAW." and `Task { await captureService.setRAWFormat(rawFormat) }`.

The `didSet` observer runs each time the value changes: when the person picks a choice in the menu, and when the reset below sets `.off`. The `Task` is necessary because `didSet` is synchronous and `CaptureService` is an actor. The model sets `captureCapabilities` itself, so only the model can write it. The views read it to decide what to show.

```swift file=AVCam/CameraModel.swift highlight=4-10,12-13
    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization = QualityPrioritization.quality
    
    /// A value that indicates which RAW format to capture along with the processed photo.
    var rawFormat = RAWFormat.off {
        didSet {
            // Turn deferred photo delivery off for RAW, and on again for no RAW.
            Task { await captureService.setRAWFormat(rawFormat) }
        }
    }
    
    /// The capture features that the current camera configuration supports.
    private(set) var captureCapabilities = CaptureCapabilities.unknown
    
    /// Performs a focus and expose operation at the specified screen point.
    func focusAndExpose(at point: CGPoint) async {
```

### Step
In `PreviewCameraModel.swift`, below `qualityPrioritization`, add `rawFormat` and `captureCapabilities` with both RAW formats supported.

Write `var rawFormat = RAWFormat.off`. Then write `let captureCapabilities = CaptureCapabilities(isAppleProRAWSupported: true, isBayerRAWSupported: true)` with the comment "Report both RAW formats as supported so the previews show the RAW control." above it. The preview model never changes its capabilities, so `let` is enough.

The Xcode canvas has no camera, so it cannot find out what a camera supports. With both flags `true`, the canvas shows the RAW menu that the Simulator hides. The file is in the group `Preview Content`.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=3-5
    var isLivePhotoEnabled = true
    var qualityPrioritization = QualityPrioritization.quality
    var rawFormat = RAWFormat.off
    // Report both RAW formats as supported so the previews show the RAW control.
    let captureCapabilities = CaptureCapabilities(isAppleProRAWSupported: true, isBayerRAWSupported: true)
    var shouldFlashScreen = false
```

### Step
In `Camera.swift`, add `rawFormat: RAWFormat { get set }` and `captureCapabilities: CaptureCapabilities { get }` to the `Camera` protocol.

Add them below `qualityPrioritization`, each with a `///` comment. These are the same two comments as in `CameraModel`. Both conforming types have the members now, so the project compiles. The views can read both members through the protocol.

```swift file=AVCam/Model/Camera.swift highlight=4-5,7-8
    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization: QualityPrioritization { get set }
    
    /// A value that indicates which RAW format to capture along with the processed photo.
    var rawFormat: RAWFormat { get set }
    
    /// The capture features that the current camera configuration supports.
    var captureCapabilities: CaptureCapabilities { get }
    
    /// Captures a photo and writes it to the user's photo library.
    func capturePhoto() async
```

### Step
In `capturePhoto()`, add `rawFormat: rawFormat` as the third argument of the `PhotoFeatures(...)` call.

Move the new argument to a second line. Delete the old one-line call. This is the line that sends the choice of the person to the capture code.

```swift file=AVCam/CameraModel.swift remove
            let photoFeatures = PhotoFeatures(isLivePhotoEnabled: isLivePhotoEnabled, qualityPrioritization: qualityPrioritization)
```

```swift file=AVCam/CameraModel.swift highlight=2-3
        do {
            let photoFeatures = PhotoFeatures(isLivePhotoEnabled: isLivePhotoEnabled, qualityPrioritization: qualityPrioritization,
                                         rawFormat: rawFormat)
            let photo = try await captureService.capturePhoto(with: photoFeatures)
```

### Step
In `observeState()`, add a second `Task` that copies each new value of `captureService.$captureCapabilities` into `captureCapabilities`.

Put it between the thumbnail `Task` and the capture activity `Task`. Write the comment "Await new capabilities from the capture service." and `for await capabilities in await captureService.$captureCapabilities.values`. The service publishes new capabilities after each change of camera, in the same way as it publishes the capture activity. In chapter 7, no code read them.

```swift file=AVCam/CameraModel.swift highlight=8-13
        Task {
            // Await new thumbnails that the media library generates when saving a file.
            for await thumbnail in mediaLibrary.thumbnails.compactMap({ $0 }) {
                self.thumbnail = thumbnail
            }
        }
        
        Task {
            // Await new capabilities from the capture service.
            for await capabilities in await captureService.$captureCapabilities.values {
                captureCapabilities = capabilities
            }
        }
        
        Task {
            // Await new capture activity values from the capture service.
```

### Step
Inside that loop, set `rawFormat` to `.off` when the new capabilities do not support the chosen format.

Add the comment "Fall back to no RAW when the new camera doesn't support the chosen format." above an `if`. The condition has two parts joined with `||`: `rawFormat == .appleProRAW && !capabilities.isAppleProRAWSupported`, and `rawFormat == .bayerRAW && !capabilities.isBayerRAWSupported`. Put the second part on a new line.

A person can choose RAW with the back camera and then switch to a camera that has no RAW. Without the reset, the next capture would ask for a format that the camera does not have. `rawPixelFormat(for:)` would return `nil`, so the capture would not stop, but the menu would show a choice that does nothing. The reset keeps the menu honest.

```swift file=AVCam/CameraModel.swift highlight=3-7
            for await capabilities in await captureService.$captureCapabilities.values {
                captureCapabilities = capabilities
                // Fall back to no RAW when the new camera doesn't support the chosen format.
                if rawFormat == .appleProRAW && !capabilities.isAppleProRAWSupported
                    || rawFormat == .bayerRAW && !capabilities.isBayerRAWSupported {
                    rawFormat = .off
                }
            }
```

### Step
Build the project.

The model now keeps the choice and the abilities. No view reads them yet, so the Simulator shows no change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the RAW menu

The last piece is the control. It is a menu in the features toolbar from chapter 7. It shows only when the camera offers at least one RAW format.

### Step
In `FeatureToolbar.swift`, below `prioritizePicker`, add the private computed property `supportedRAWFormats` of type `[RAWFormat]`.

It filters `RAWFormat.allCases` with a `switch $0` in the closure. The case `.off` gives `true`. The case `.appleProRAW` gives `camera.captureCapabilities.isAppleProRAWSupported`, and `.bayerRAW` gives `camera.captureCapabilities.isBayerRAWSupported`. Write each case on one line, as `case .off: true`, with no `return`. Add the comment "The RAW formats that the current camera supports. A person can always turn RAW off." above it.

The `switch` is an expression here, so each case is its value. The list always has `.off`. Thus the menu always has a way back.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=7-16
            case .quality:
                Image(systemName: "dial.high")
            }
        }
    }
    
    /// The RAW formats that the current camera supports. A person can always turn RAW off.
    private var supportedRAWFormats: [RAWFormat] {
        RAWFormat.allCases.filter {
            switch $0 {
            case .off: true
            case .appleProRAW: camera.captureCapabilities.isAppleProRAWSupported
            case .bayerRAW: camera.captureCapabilities.isBayerRAWSupported
            }
        }
    }
```

### Step
Add the property `rawMenu` of type `some View`, marked `@ViewBuilder`. It shows a `Menu` only when `supportedRAWFormats.count > 1`.

Write the comment "A menu to choose the RAW format. The menu is hidden when the camera supports no RAW format." above `@ViewBuilder`. Inside the `if`, write a `Menu` whose label is `Image(systemName:)`. The symbol is `"r.square.fill"` when `camera.rawFormat` is not `.off`, and `"r.square"` when it is `.off`. Leave the content closure of the `Menu` empty for now.

The count is greater than 1 when `.off` and at least one RAW format are in the list. The system has no symbol `camera.raw`, so the app uses the square with the letter R. In the Simulator, the list has only `.off`, so the menu does not appear.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=3-12
    }
    
    // A menu to choose the RAW format. The menu is hidden when the camera supports no RAW format.
    @ViewBuilder
    var rawMenu: some View {
        if supportedRAWFormats.count > 1 {
            Menu {
            } label: {
                Image(systemName: camera.rawFormat == .off ? "r.square" : "r.square.fill")
            }
        }
    }
}
```

### Step
Fill the content of the `Menu` with a `Picker` titled "RAW Format" that is bound to `$camera.rawFormat`.

Inside the picker, write `ForEach(supportedRAWFormats)` with `Text($0.description)` and the modifier `.font(.body.weight(.bold))`, as in `prioritizePicker`. `RAWFormat` is `Identifiable`, so `ForEach` needs no `id:`.

The picker writes the choice straight into the model. The next capture reads it. Because the list holds only the supported formats, the person cannot choose a format that the camera lacks.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=3-8
        if supportedRAWFormats.count > 1 {
            Menu {
                Picker("RAW Format", selection: $camera.rawFormat) {
                    ForEach(supportedRAWFormats) {
                        Text($0.description)
                            .font(.body.weight(.bold))
                    }
                }
            } label: {
                Image(systemName: camera.rawFormat == .off ? "r.square" : "r.square.fill")
            }
        }
```

### Step
In `body`, add `rawMenu` below `prioritizePicker`.

The `HStack` now holds the Live Photo button, the quality menu, and the RAW menu, from left to right.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=5
        HStack(spacing: 30) {
            Spacer()
            livePhotoButton
            prioritizePicker
            rawMenu
        }
```

### Step
Build and run the app, and take a photo.

In the Simulator with SimCam, the camera has no RAW format. The RAW menu is hidden, and the toolbar looks as in chapter 7. A capture saves a normal photo and shows its thumbnail. To see the menu without an iPhone, open the preview at the end of `FeatureToolbar.swift` in the Xcode canvas. The preview model reports both formats, so the menu shows there.

> [!IMPORTANT]
> The RAW capture itself needs an iPhone with a Pro camera. On such an iPhone, the toolbar shows an `r.square` button. Choose Apple ProRAW and take a photo. The Xcode console is expected to show "Deferred photo delivery (supported/enabled): true/false" after the choice, then "Capturing with RAW format: Apple ProRAW", "Resolved settings: 2 photos, ..." with a RAW size, and "Captured RAW photo, N bytes". N is the size of the DNG, often many megabytes. The Photos app is expected to show one photo with a RAW badge, and the export of the unmodified original is expected to give the DNG file. The "RAW" choice does not show on the virtual back camera, because Bayer RAW needs a physical camera. The line "RAW on ..." shows what each camera offers.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The RAW menu is hidden in the Simulator. A capture saves a normal photo and shows its thumbnail.
Note: On an iPhone with a Pro camera, the RAW menu shows Off and Apple ProRAW, and a RAW capture saves one asset with the DNG and the processed photo.
```

### Experiment
On a real iPhone with a Pro camera, choose Apple ProRAW, turn the Live Photo button on, and take a photo. Read the "Resolved settings" line: the count is 2, and the proxy size is 0x0. Then choose Off and take a photo: deferred delivery is on again, and the count is 1. If your iPhone has no telephoto camera, the back camera is the physical wide camera. Then choose RAW, set the quality menu to "Quality", and take a photo.

### Text
Your code is now the same as the `chapter-08` branch. The app captures RAW on a device that supports it, and it falls back to a normal photo on all others. In the next chapter, you make capture feel faster with responsive capture and a readiness state for the capture button.

## Check your understanding

### A RAW request calls `didFinishProcessingPhoto` twice. What happens if the method saves `photo.fileDataRepresentation()` into `photoData` for each call?

- [ ] The app saves two assets, one for each call.
  > The delegate collects its results and reports once, in `didFinishCaptureFor`. The method itself saves nothing.
- [x] The data of the second call replaces the data of the first call, so the app loses one of the two photos.
  > Correct. Both calls would write the same variable. The test of `photo.isRawPhoto` sends the DNG to `rawData` and the processed photo to `photoData`.
- [ ] The photo output raises an exception, because the method is called more than once.
  > A RAW plus processed request is meant to call the method two times. The photo output expects this.

### A person chooses RAW in the menu. Quality is set to "Quality". Why does the code set the prioritization to `.speed` for this capture?

- [ ] RAW files are too large for the quality level, so the system would delay the save.
  > The size of the file is not the reason. The rule is about the capture request.
- [x] A Bayer RAW capture raises an exception with any prioritization other than `.speed`, so the code overrides the menu for this capture only.
  > Correct. The override is only in the settings of this capture. The menu keeps its value, and the next normal capture uses it again.
- [ ] The code sets `.speed` so that the camera uses the Live Photo movie.
  > The prioritization has no link to the movie. The Live Photo rule for Apple ProRAW is a different line.

### The person switches to a camera that has no RAW. Why does `CameraModel` set `rawFormat` back to `.off`?

- [ ] The photo output raises an exception when `rawFormat` is not `.off` and the camera has no RAW.
  > The helper `rawPixelFormat(for:)` returns `nil` for a format that is not in the list, so the capture asks for no RAW and does not stop.
- [x] The menu would show a choice that the camera cannot do, and the capture would silently take a normal photo.
  > Correct. The reset keeps the choice in the model in step with what the camera can do. The helper is a second guard.
- [ ] The Photos library refuses a RAW photo from a camera that has no RAW.
  > The library does not know which camera made the photo. The reason is in the model, not in the library.
