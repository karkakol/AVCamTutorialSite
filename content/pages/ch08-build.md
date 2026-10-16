---
kind: tutorial
chapter: 8
title: Build: RAW and Apple ProRAW
abstract: Add a RAW control to the features toolbar. With Apple ProRAW, the app captures one DNG file with a full-size preview and saves it alone in the Photos library, as the Camera app does.
estimatedMinutes: 45
startBranch: chapter-07
branch: chapter-08
---

In this tutorial, you add RAW capture to the photo service. The person chooses Off or Apple ProRAW in a new menu of the features toolbar. With Apple ProRAW, one tap gives one photo: a DNG file with a full-size JPEG preview inside. The app saves the DNG alone as one asset in the Photos library, as the Camera app does.

You work in an order that keeps the app safe at each checkpoint. First you teach the delegate and the media library to handle a DNG. Then you ask the camera for RAW. Only then do you add the control that the person uses.

This is part 2 code inside part 1 of the numbering. The Apple sample has no RAW capture, so the design of this chapter is this tutorial's own. [Concepts: RAW and Apple ProRAW](ch08-concepts.md) explains the design and its limits.

> [!IMPORTANT]
> The Simulator with SimCam has no RAW format. The RAW control stays hidden there, and a capture gives a normal photo. The RAW capture itself needs a real iPhone with a Pro camera. Seven device tests on an iPhone 17 Pro Max with iOS 26 shaped the code. RAW and deferred delivery do not work together, so the app turns deferred delivery off for RAW. The quality prioritization setter is not supported for a RAW request, so a RAW request keeps the default. Photos accepted the model of the Camera app: the DNG alone, as a file, with a full-size JPEG preview inside. The app uses this model, and it has one save path. This chapter offers Apple ProRAW only. Bayer RAW needs a single physical camera, and this app uses the virtual camera that the system prefers, so Bayer RAW comes in chapter 16 with the lenses and the zoom. [Concepts: What the device tests showed](ch08-concepts.md#what-the-device-tests-showed) tells the full story.

Read [Concepts: RAW and Apple ProRAW](ch08-concepts.md) first if you want the background for each step.

## Describe the RAW choices

The views and the model must not use AVFoundation types. In this section, you add small app types that carry the choice of the person down to the capture code, and the abilities of the camera up to the interface. This is the same method as in chapter 7.

### Step
In `DataTypes.swift`, below `QualityPrioritization`, add the `RAWFormat` enumeration with the cases `off` and `appleProRAW`.

The enumeration adopts `Int`, `Identifiable`, `CaseIterable`, `CustomStringConvertible`, and `Codable`, in this order. For `Identifiable`, write `var id: Self { self }` as the first line of the body. Give each case a `///` comment above it: "No RAW photo." and "A linear DNG that the system partially processes." Leave the raw values at their defaults. Add a `///` comment above the enumeration too.

Chapter 7 used a three-way choice for the quality. RAW is a choice of two in this chapter. An enumeration instead of a `Bool` leaves room for Bayer RAW, the second RAW format, which chapter 16 adds. The `description` property comes in the next step, so the project does not compile until then.

```swift file=AVCam/Model/DataTypes.swift highlight=7-14
        case .quality:
            return "Quality"
        }
    }
}

/// An enumeration that describes the RAW format to capture.
enum RAWFormat: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
    var id: Self { self }
    /// No RAW photo.
    case off
    /// A linear DNG that the system partially processes.
    case appleProRAW
}

enum CameraError: Error {
```

### Step
Add the `description` property of type `String` to `RAWFormat`, below the last case.

A `switch` on `self` returns "Off" and "Apple ProRAW". The menu shows these texts. The project compiles again after this step.

```swift file=AVCam/Model/DataTypes.swift highlight=7-14
enum RAWFormat: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
    var id: Self { self }
    /// No RAW photo.
    case off
    /// A linear DNG that the system partially processes.
    case appleProRAW
    var description: String {
        switch self {
        case .off:
            return "Off"
        case .appleProRAW:
            return "Apple ProRAW"
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
In the `CaptureCapabilities` structure, add the property `isAppleProRAWSupported` of type `Bool`, below `isLivePhotoCaptureSupported`.

It is a `let`. It tells the interface whether the current camera offers Apple ProRAW. The initializer does not set it yet, so the project does not compile until the next step.

```swift file=AVCam/Model/DataTypes.swift highlight=6
/// A structure that represents the capture capabilities of `CaptureService` in
/// its current configuration.
struct CaptureCapabilities {

    let isLivePhotoCaptureSupported: Bool
    let isAppleProRAWSupported: Bool
```

### Step
Replace the initializer of `CaptureCapabilities` with one that has two parameters, `isLivePhotoCaptureSupported` and `isAppleProRAWSupported`, and assign the new property.

Each parameter has the type `Bool` and the default value `false`, so `CaptureCapabilities()` and `CaptureCapabilities.unknown` still mean "nothing is supported". Put each parameter on its own line. The new `self` assignment goes below the existing one. Delete the old first line of the initializer and keep the rest. The project compiles again after this step.

```swift file=AVCam/Model/DataTypes.swift remove
    init(isLivePhotoCaptureSupported: Bool = false) {
```

```swift file=AVCam/Model/DataTypes.swift highlight=3-4,6
    let isAppleProRAWSupported: Bool
    
    init(isLivePhotoCaptureSupported: Bool = false,
         isAppleProRAWSupported: Bool = false) {
        self.isLivePhotoCaptureSupported = isLivePhotoCaptureSupported
        self.isAppleProRAWSupported = isAppleProRAWSupported
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

An Apple ProRAW capture of this app gives one photo: the DNG file. In this section, you teach the delegate to mark that photo as RAW, and you teach `MediaLibrary` to save it. The app saves the DNG alone, as the Camera app does: one asset in Photos with one resource, the DNG. The DNG goes to Photos as a file with the `.dng` extension. You also add log lines that show each photo that arrives, the resource that the app sends to Photos, the asset that Photos creates, and each error with the name of its code. Device tests showed why these lines are necessary: the first RAW captures saved nothing, and the console did not show the reason. The capture does not ask for RAW yet, so you can build and run at the end.

### Step
In `DataTypes.swift`, add the property `isRAW` with the default value `false` to the `Photo` structure, below `livePhotoMovieURL`.

Write it as `var isRAW = false`. The type is `Bool`. Add the `///` comment "A Boolean value that indicates whether `data` holds the DNG of a RAW capture." above it. A RAW capture of this app has no processed photo, so the existing property `data` holds the DNG, and this flag tells the media library how to save it. Because the property is a `var` with a default value, the memberwise initializer still accepts the three arguments from chapter 7. The project still compiles.

```swift file=AVCam/Model/DataTypes.swift highlight=5-6
struct Photo: Sendable {
    let data: Data
    let isProxy: Bool
    let livePhotoMovieURL: URL?
    /// A Boolean value that indicates whether `data` holds the DNG of a RAW capture.
    var isRAW = false
}
```

### Step
In `PhotoCapture.swift`, add the property `private var isRAWPhoto = false` to `PhotoCaptureDelegate`, below `isProxyPhoto`.

The delegate keeps each fact about the capture until the capture ends. `isProxyPhoto` tells whether the photo is a proxy. `isRAWPhoto` tells whether the photo is a DNG.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=7
private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    
    private let continuation: PhotoContinuation
    
    private var isLivePhoto = false
    private var isProxyPhoto = false
    private var isRAWPhoto = false
    
    private var photoData: Data?
```

### Step
In [`photoOutput(_:didFinishProcessingPhoto:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:)), below the line that sets `photoData`, store [`photo.isRawPhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/israwphoto) in `isRAWPhoto`, and log the photo.

Put the comment "A RAW request has no processed format, so this photo is the DNG." above the assignment. Then log "Captured RAW photo, N bytes" or "Captured processed photo, N bytes" with `logger.debug`. Use `self.isRAWPhoto ? "RAW" : "processed"` for the kind, and `self.photoData?.count ?? 0` for N. Keep the line `photoData = photo.fileDataRepresentation()` from chapter 7.

A RAW request of this app asks for no processed photo, so the photo output calls this method one time, with the DNG. [`fileDataRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation()) returns DNG data for a RAW photo, so the existing line already stores the DNG. The guard in `didFinishCaptureFor` that throws `noPhotoData` reads `photoData`, so it accepts the DNG as photo data. The log message is a closure that runs later, so Swift asks for `self.` in front of the two properties.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=7-9
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            logger.debug("Error capturing photo: \(String(describing: error))")
            return
        }
        photoData = photo.fileDataRepresentation()
        // A RAW request has no processed format, so this photo is the DNG.
        isRAWPhoto = photo.isRawPhoto
        logger.debug("Captured \(self.isRAWPhoto ? "RAW" : "processed") photo, \(self.photoData?.count ?? 0) bytes")
    }
```

### Step
In `didFinishCaptureFor`, pass `isRAW: isRAWPhoto` as the last argument of the `Photo(...)` call.

Delete the old line. The `Photo` value now tells the media library that its data is a DNG.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        let photo = Photo(data: photoData, isProxy: isProxyPhoto, livePhotoMovieURL: livePhotoMovieURL)
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2
        /// Create a photo object to save to the `MediaLibrary`.
        let photo = Photo(data: photoData, isProxy: isProxyPhoto, livePhotoMovieURL: livePhotoMovieURL, isRAW: isRAWPhoto)
        // Resume the continuation by returning the captured photo.
        continuation.resume(returning: photo)
```

### Step
In `FoundationExtensions.swift`, add the static property `rawFileURL` to the `URL` extension, below `movieFileURL`.

It returns a new file URL in the temporary directory. The file name is a new [`UUID`](https://developer.apple.com/documentation/foundation/uuid), and `appendingPathExtension(for:)` adds the extension of [`UTType.dng`](https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/dng), which is `dng`. Add the `///` comment "A unique output location to write the DNG file of a RAW photo." above it.

The property uses the same pattern as `movieFileURL`, which gives the file for a Live Photo movie. Apple's article [Capturing photos in RAW and Apple ProRAW formats](https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats) writes the DNG data to a file with the extension `.dng` before it saves the photo. Photos then gets the type of the DNG from the file name extension. You give each capture a new name, so two captures never write to the same file.

```swift file=AVCam/Support/FoundationExtensions.swift highlight=7-10
extension URL {
    /// A unique output location to write a movie.
    static var movieFileURL: URL {
        URL.temporaryDirectory.appending(component: UUID().uuidString).appendingPathExtension(for: .quickTimeMovie)
    }
    
    /// A unique output location to write the DNG file of a RAW photo.
    static var rawFileURL: URL {
        URL.temporaryDirectory.appending(component: UUID().uuidString).appendingPathExtension(for: .dng)
    }
}
```

### Step
In `MediaLibrary.swift`, import `ImageIO`.

Put the import between `Foundation` and `Photos`, so the imports stay in alphabetical order. `ImageIO` gives [`CGImageSource`](https://developer.apple.com/documentation/imageio/cgimagesource). The app uses it to check the DNG data before the save.

```swift file=AVCam/Model/MediaLibrary.swift highlight=2
import Foundation
import ImageIO
import Photos
import UIKit
```

### Step
In `MediaLibrary`, add a new private method `save(rawData:location:)` below `performChange(_:)`, in a new part with the mark `// MARK: - Saving RAW photos`.

The method is `async throws`. It takes the DNG data and the location as a `CLLocation?`. Copy the `///` comment of the fence above it. Leave the body empty for now. The next steps fill it.

The method has the same base name as `save(photo:)`, but other argument labels, so Swift keeps the two apart. It is private, because only `save(photo:)` calls it. It has one request: the model of the Camera app.

```swift file=AVCam/Model/MediaLibrary.swift highlight=1,3-7
    // MARK: - Saving RAW photos
    
    /// Saves the DNG of a RAW capture as the only photo of a new asset.
    ///
    /// This is the model of the Camera app: one asset and one file. Photos shows the JPEG preview inside the DNG.
    private func save(rawData: Data, location: CLLocation?) async throws {
    }
    
    // MARK: - Thumbnail handling
```

### Step
In the new method, write the DNG data to a file at `URL.rawFileURL`, and remove the file when the method ends.

Keep the URL in a constant `rawFileURL`, and call `try rawData.write(to: rawFileURL)`. Put the comment "Write the DNG data to a file. Photos reads the type of the RAW resource from the `.dng` extension." above the two lines. Then add `defer { try? FileManager.default.removeItem(at: rawFileURL) }`, with the comment "Remove the file if Photos doesn't take it. After a successful save, the file is already gone." above it.

A device test showed why the DNG must be a file: Photos refused a request when the DNG came as `Data`. With `Data`, Photos takes the type from the resource type, and a resource type does not say "DNG". [`write(to:options:)`](https://developer.apple.com/documentation/foundation/data/write(to:options:)) throws if the disk is full. Then the method stops before Photos gets a request. The `defer` block runs when the method returns or throws. Later in this method, you ask Photos to move the file into the library. Photos removes the file only when the save succeeds. After a failure, the file stays in the temporary directory, so the `defer` block removes it. After a success, the file is gone, and `try?` ignores the error of [`removeItem(at:)`](https://developer.apple.com/documentation/foundation/filemanager/removeitem(at:)-xj6x).

```swift file=AVCam/Model/MediaLibrary.swift highlight=2-6
    private func save(rawData: Data, location: CLLocation?) async throws {
        // Write the DNG data to a file. Photos reads the type of the RAW resource from the `.dng` extension.
        let rawFileURL = URL.rawFileURL
        try rawData.write(to: rawFileURL)
        // Remove the file if Photos doesn't take it. After a successful save, the file is already gone.
        defer { try? FileManager.default.removeItem(at: rawFileURL) }
    }
```

### Step
Below `save(rawData:location:)`, add the private static method `imageInfo(of:)`. It returns the image type that Image I/O finds in the data, and the number of images.

The return type is the tuple `(type: String, count: Int)`. Make an image source with [`CGImageSourceCreateWithData(_:_:)`](https://developer.apple.com/documentation/imageio/cgimagesourcecreatewithdata(_:_:)) in a `guard`. If it gives `nil`, return `("none", 0)`. Read the type identifier with [`CGImageSourceGetType(_:)`](https://developer.apple.com/documentation/imageio/cgimagesourcegettype(_:)), and use `"none"` when it is `nil`. Return the type and the result of [`CGImageSourceGetCount(_:)`](https://developer.apple.com/documentation/imageio/cgimagesourcegetcount(_:)). Add the `///` comment "Returns the image type that Image I/O finds in the photo data, and the number of images in the data." above it.

The method reads only the start of the data, where each file format has its signature. A DNG gives the type `com.adobe.raw-image`. A count of 0 means that Image I/O cannot read an image from the data. The method is `static`, because it uses no state of the media library. It returns a `String`, not a `UTType`, because the app only logs the value.

```swift file=AVCam/Model/MediaLibrary.swift highlight=1-8
    /// Returns the image type that Image I/O finds in the photo data, and the number of images in the data.
    private static func imageInfo(of data: Data) -> (type: String, count: Int) {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            return ("none", 0)
        }
        let type = CGImageSourceGetType(source).map { $0 as String } ?? "none"
        return (type, CGImageSourceGetCount(source))
    }
    
    // MARK: - Thumbnail handling
```

### Step
At the start of `save(rawData:location:)`, above the comment "Write the DNG data to a file", log what the RAW data is.

Make a string `rawHeader` from the first 4 bytes of `rawData`: `rawData.prefix(4)`, each byte with `String(format: "%02X", $0)`, joined with a space. Keep `Self.imageInfo(of: rawData)` in `rawImage`. Then log "RAW data: " with the size, the header, `rawImage.type`, and `rawImage.count`, with `logger.debug`. Put the comment "Check the RAW data before the save. A DNG file is a TIFF file, so it starts with `49 49 2A 00` or `4D 4D 00 2A`." above the lines.

Device tests showed error 3300 for several requests, and the error named the DNG file. These values proved that the data is a good DNG, so the cause was the form of the request. Keep the line: it tells you at once if a capture gives bad data. The capture embeds a JPEG preview in the DNG, so the count of images can be more than 1. A DNG has the structure of a TIFF file. Its first 4 bytes are `49 49 2A 00` ("II*", little-endian byte order) or `4D 4D 00 2A` ("MM", big-endian byte order). The type `com.adobe.raw-image` with at least 1 image means that Image I/O reads the data as a DNG.

```swift file=AVCam/Model/MediaLibrary.swift highlight=2-5
    private func save(rawData: Data, location: CLLocation?) async throws {
        // Check the RAW data before the save. A DNG file is a TIFF file, so it starts with `49 49 2A 00` or `4D 4D 00 2A`.
        let rawHeader = rawData.prefix(4).map { String(format: "%02X", $0) }.joined(separator: " ")
        let rawImage = Self.imageInfo(of: rawData)
        logger.debug("RAW data: \(rawData.count) bytes, header \(rawHeader), type \(rawImage.type), images \(rawImage.count)")
        
        // Write the DNG data to a file. Photos reads the type of the RAW resource from the `.dng` extension.
```

### Step
Below the `defer` line, log the resource, and call `performChange(_:)` with a request that has the DNG file as its only `.photo` resource.

Log "Resource .photo: " with the size of `rawData` and the file name `rawFileURL.lastPathComponent`, with `logger.debug`. In the closure, make `creationRequest` with `PHAssetCreationRequest.forAsset()`, as `save(photo:)` does. Make a `PHAssetResourceCreationOptions` object in `rawOptions`, and set its [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile) to `true`. Set nothing else. Call [`addResource(with:fileURL:options:)`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:)) with [`.photo`](https://developer.apple.com/documentation/photos/phassetresourcetype/photo), `rawFileURL`, and `rawOptions`. Then set `creationRequest.location = location` and return `creationRequest.placeholderForCreatedAsset`. Copy the comments of the fence. The project compiles again after this step.

This is the model of the Camera app: one asset, one file, the DNG. Photos shows the JPEG preview that the capture embeds in the DNG (you add it in a later section). `shouldMoveFile` moves the file into the library, so Photos does not copy the many megabytes of a DNG. The Live Photo movie of `save(photo:)` uses the same option. The options have no file name and no type, so Photos takes both from the file URL, which ends in `.dng`. The options object is made inside the closure, because it is not `Sendable`. The SDK header of `PHAssetCreationRequest` says that `addResource` always succeeds, and that Photos checks the request later. So the log line shows what the app sent before Photos answers. The `try` is not in a `do` block: an error goes to `save(photo:)`, and from there to `capturePhoto()`, which logs it.

```swift file=AVCam/Model/MediaLibrary.swift highlight=3-14
        defer { try? FileManager.default.removeItem(at: rawFileURL) }
        
        // Log the resource before the request, because Photos reports a refused request only with an error code.
        logger.debug("Resource .photo: \(rawData.count) bytes, file \(rawFileURL.lastPathComponent)")
        try await performChange {
            let creationRequest = PHAssetCreationRequest.forAsset()
            // Move the large DNG file into the library instead of copying it.
            let rawOptions = PHAssetResourceCreationOptions()
            rawOptions.shouldMoveFile = true
            // Save the DNG as the only photo of the asset. Photos shows its embedded preview.
            creationRequest.addResource(with: .photo, fileURL: rawFileURL, options: rawOptions)
            creationRequest.location = location
            return creationRequest.placeholderForCreatedAsset
        }
    }
```

### Step
In `save(photo:)`, call the new method for a RAW capture, below `let location = try await currentLocation`.

Use `if photo.isRAW`. Inside it, call `try await save(rawData: photo.data, location: location)`, and then `return`. Put the comment "Save a RAW capture as the DNG alone, as the Camera app does." above the `if`. The code below the `if` stays as it was in chapter 7.

The `return` ends `save(photo:)` after the RAW save, so a RAW capture never reaches the old code. A capture without RAW skips the `if` and saves the photo as before, also a proxy and a Live Photo. A RAW photo is never a proxy, because the SDK header says that deferred processing is not available for RAW.

```swift file=AVCam/Model/MediaLibrary.swift highlight=4-9
    func save(photo: Photo) async throws {
        let location = try await currentLocation
        
        // Save a RAW capture as the DNG alone, as the Camera app does.
        if photo.isRAW {
            try await save(rawData: photo.data, location: location)
            return
        }
        
        try await performChange {
```

### Step
In the `Error` enumeration of `MediaLibrary`, give the case `saveFailed` the associated value `reason` of type `Swift.Error`.

Delete the old case. The new case keeps the error from Photos, so the code that catches `saveFailed` can log the reason. Write `Swift.Error`, because inside `MediaLibrary` the name `Error` means this enumeration.

```swift file=AVCam/Model/MediaLibrary.swift remove
        case saveFailed
```

```swift file=AVCam/Model/MediaLibrary.swift highlight=4
    // Errors that media library can throw.
    enum Error: Swift.Error {
        case unauthorized
        case saveFailed(reason: Swift.Error)
    }
```

### Step
At the end of `MediaLibrary.swift`, below the closing brace of the actor, add an extension on `PHPhotosError.Code` with the property `name`.

The property returns the name of the code as a `String`. Use a `switch` with one case for each code that the fence shows, and a `default` case that returns `"code"` and the `rawValue`. Add the `///` comment "The name of the error code, because the code itself logs only as a number." above the property. You can copy the cases.

A Photos error logs as "Error Domain=PHPhotosErrorDomain Code=3300 "(null)"". It has no text. The header `PHError.h` gives the meaning of each number. [`PHPhotosError.Code`](https://developer.apple.com/documentation/photos/phphotoserror-swift.struct/code) has the same names in Swift, but string interpolation of a code gives only the number. This switch gives the name, for example `changeNotSupported` for 3300. The `default` case covers the other codes and codes that later SDKs add.

```swift file=AVCam/Model/MediaLibrary.swift highlight=6-24 copy
            return try await CLLocationUpdate.liveUpdates().first(where: { _ in true })?.location
        }
    }
}

extension PHPhotosError.Code {
    /// The name of the error code, because the code itself logs only as a number.
    var name: String {
        switch self {
        case .internalError: "internalError"
        case .userCancelled: "userCancelled"
        case .changeNotSupported: "changeNotSupported"
        case .operationInterrupted: "operationInterrupted"
        case .invalidResource: "invalidResource"
        case .missingResource: "missingResource"
        case .notEnoughSpace: "notEnoughSpace"
        case .requestNotSupportedForAsset: "requestNotSupportedForAsset"
        case .limitExceeded: "limitExceeded"
        case .accessRestricted: "accessRestricted"
        case .accessUserDenied: "accessUserDenied"
        default: "code \(rawValue)"
        }
    }
}
```

### Step
In `performChange(_:)` of `MediaLibrary`, log the identifier of the new asset, and log the error from Photos with the name of its code in the `catch` block.

Inside `if let placeholder`, add `logger.debug("Saved asset \(placeholder.localIdentifier)")` as the first line. In the `catch` block, keep the name of the code in a constant `code`: cast the error to `PHPhotosError`, and read `code.name`, or use `"not a Photos error"`. Then log "Saving to Photos failed: " with the error and the code in parentheses, with `logger.error`. Put the comment "Log the reason from Photos with the name of its error code, because the error text often has no description." above the two lines. Replace `throw Error.saveFailed` with `throw Error.saveFailed(reason: error)`.

`PHPhotoLibrary.performChanges(_:)`, the `async` form of [`performChanges(_:completionHandler:)`](https://developer.apple.com/documentation/photos/phphotolibrary/performchanges(_:completionhandler:)), reports a refused request with an error. Before this step, the `catch` block replaced that error with `MediaLibrary.Error.saveFailed`, and nobody saw why Photos refused. Now the log line shows the full error and its name, and the thrown error carries the reason. The [`localIdentifier`](https://developer.apple.com/documentation/photos/phobject/localidentifier) of the [`PHObjectPlaceholder`](https://developer.apple.com/documentation/photos/phobjectplaceholder) is the identifier of the new asset; the line proves that Photos made it. Each save goes through this method, so the lines show the result of each save, also of a movie in a later chapter.

```swift file=AVCam/Model/MediaLibrary.swift remove
            throw Error.saveFailed
```

```swift file=AVCam/Model/MediaLibrary.swift highlight=2,9-14
            if let placeholder {
                logger.debug("Saved asset \(placeholder.localIdentifier)")
                /// Retrieve the newly created `PHAsset` instance.
                guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [placeholder.localIdentifier],
                                                      options: nil).firstObject else { return }
                await createThumbnail(for: asset)
            }
        } catch {
            // Log the reason from Photos with the name of its error code, because the error text often has no description.
            let code = (error as? PHPhotosError)?.code.name ?? "not a Photos error"
            logger.error("Saving to Photos failed: \(error) (\(code))")
            throw Error.saveFailed(reason: error)
        }
    }
```

### Step
In `CameraModel.swift`, in the `catch` block of `capturePhoto()`, log the error with `logger.error` above `self.error = error`.

The text is "Photo capture failed: " followed by `error`. Put the comment "Log the error, because the app doesn't show it to the person." above the line. Keep `self.error = error`.

`capturePhoto()` catches every error of the capture and of the save: `PhotoCaptureError.noPhotoData` when no photo data arrived, and `MediaLibrary.Error.unauthorized` or `.saveFailed(reason:)` from the media library. It stores the error in the property `error`, but no view reads that property. Without this line, a failed capture leaves no trace in the console.

```swift file=AVCam/CameraModel.swift highlight=4-5
            let photo = try await captureService.capturePhoto(with: photoFeatures)
            try await mediaLibrary.save(photo: photo)
        } catch {
            // Log the error, because the app doesn't show it to the person.
            logger.error("Photo capture failed: \(error)")
            self.error = error
        }
```

### Step
Build and run the app, and take a photo.

No capture asks for RAW yet, so `isRAW` is always `false`. `save(photo:)` skips the RAW branch and saves the photo with the code of chapter 7. The console now shows the processed photo and the new asset.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail, as before. The console shows "Captured processed photo, N bytes" and "Saved asset ...".
Note: On an iPhone with deferred delivery, a normal capture can deliver a proxy instead of the processed photo. Then the line "Captured processed photo" does not show, but "Saved asset ..." does.
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
Add the case `.appleProRAW` to the `switch`, with a `return` that finds the first Apple ProRAW format.

Write `return formats.first { AVCapturePhotoOutput.isAppleProRAWPixelFormat($0) }`. The class method [`isAppleProRAWPixelFormat(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawpixelformat(_:)) tests one format. The project compiles again after this step.

On a physical camera, the list can also hold Bayer RAW formats. The system sorts the formats of Apple ProRAW after the Bayer formats, so a test of each format is the only safe way to find the kind. Chapter 16 adds a case for Bayer RAW with its own test.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=7-8
    /// Returns the first RAW pixel format of the requested kind that the photo output offers.
    private func rawPixelFormat(for rawFormat: RAWFormat) -> OSType? {
        let formats = photoOutput.availableRawPhotoPixelFormatTypes
        switch rawFormat {
        case .off:
            return nil
        case .appleProRAW:
            return formats.first { AVCapturePhotoOutput.isAppleProRAWPixelFormat($0) }
        }
    }
```

### Step
In `updateConfiguration(for:)`, set `photoOutput.isAppleProRAWEnabled` to `photoOutput.isAppleProRAWSupported`, below the line for deferred photo delivery.

Add the comment "Enabling Apple ProRAW adds its formats to the available RAW formats." above the line. This is level 1 of the two-level rule. Both properties are on the photo output: [`isAppleProRAWSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported) and [`isAppleProRAWEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled).

Without this line, the list of RAW formats holds no Apple ProRAW format. Enabling Apple ProRAW makes the pipeline build again, which takes time, so it must happen before the session starts. `CaptureService` calls this method before `startRunning()`. The line comes before `updateCapabilities(for:)`, which reads the list.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=1-2
        // Enabling Apple ProRAW adds its formats to the available RAW formats.
        photoOutput.isAppleProRAWEnabled = photoOutput.isAppleProRAWSupported
        updateCapabilities(for: device)
    }
```

### Step
In `updateCapabilities(for:)`, pass the Apple ProRAW flag to the `CaptureCapabilities` initializer.

Use the label `isAppleProRAWSupported:` with the value `rawPixelFormat(for: .appleProRAW) != nil`. Keep `isLivePhotoCaptureSupported:` as the first argument and put each argument on its own line. Delete the old one-line call.

The flag comes from the same helper that the capture uses. Thus the interface offers Apple ProRAW only if a capture can really request it.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: photoOutput.isLivePhotoCaptureSupported)
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-3
    private func updateCapabilities(for device: AVCaptureDevice) {
        capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: photoOutput.isLivePhotoCaptureSupported,
                                           isAppleProRAWSupported: rawPixelFormat(for: .appleProRAW) != nil)
    }
```

### Step
In `createPhotoSettings(with:)`, below the HEVC block, add the constant `rawType` that holds `rawPixelFormat(for: features.rawFormat)`.

Add two `///` comment lines above it. The first is "Request the RAW photo alone when the device supports the chosen format, as the Camera app does." The second is "With no processed format, the capture delivers one photo: the DNG." The type of `rawType` is `OSType?`. It is `nil` when the choice is Off, or when the camera has no such format.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-7
        if photoOutput.availablePhotoCodecTypes.contains(.hevc) {
            photoSettings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
        }
        
        /// Request the RAW photo alone when the device supports the chosen format, as the Camera app does.
        /// With no processed format, the capture delivers one photo: the DNG.
        let rawType = rawPixelFormat(for: features.rawFormat)
```

### Step
Below `rawType`, add `if let rawType` that replaces `photoSettings` with a settings object for the RAW photo alone.

Inside the `if`, assign `AVCapturePhotoSettings(rawPixelFormatType: rawType, processedFormat: nil)` to `photoSettings`. Then log "Capturing with RAW format: " and `features.rawFormat.description` with `logger.debug`.

The initializer [`init(rawPixelFormatType:processedFormat:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:)) takes the RAW format and a processed format. The SDK header says: pass `nil` for the processed format if you want no processed photo. So this request gives one photo, the DNG, and `expectedPhotoCount` in the resolved settings is 1. The Camera app saves the DNG alone, and this app does the same, so a processed photo would only cost time and memory. Photos and other apps show the full-size JPEG preview that a later step puts inside the DNG. Write `processedFormat: nil` instead of the short initializer `init(rawPixelFormatType:)`: the `nil` shows the decision in the code. The rest of the method (preview format, photo size) now works on the new settings object.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-5
        let rawType = rawPixelFormat(for: features.rawFormat)
        if let rawType {
            photoSettings = AVCapturePhotoSettings(rawPixelFormatType: rawType, processedFormat: nil)
            logger.debug("Capturing with RAW format: \(features.rawFormat.description)")
        }
        
        /// Set the format of the preview image to capture. The `photoSettings` object returns the available
```

### Step
Below the log line in the `if let rawType` block, log the RAW file types of the photo output.

Keep `photoOutput.availableRawPhotoFileTypes`, mapped to `rawValue` and joined with ", ", in a constant `rawFileTypes`. Log "RAW file types: " and `rawFileTypes` with `logger.debug`. Put the comment "The settings name no RAW file type, so the photo output chooses a default container for the RAW photo." above the lines.

The initializer that you use names no file type for the RAW photo. The SDK header says that the photo output then chooses a default container. A longer initializer, [`init(rawPixelFormatType:rawFileType:processedFormat:processedFileType:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:rawfiletype:processedformat:processedfiletype:)), takes a file type from [`availableRawPhotoFileTypes`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotofiletypes). Apple's article uses the short form, and the documentation says that `fileDataRepresentation()` gives DNG data for a RAW photo. This line shows the list on the device. The value for DNG is `com.adobe.raw-image`. The constant is local, because the log message is a closure that runs later.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-4
            logger.debug("Capturing with RAW format: \(features.rawFormat.description)")
            // The settings name no RAW file type, so the photo output chooses a default container for the RAW photo.
            let rawFileTypes = photoOutput.availableRawPhotoFileTypes.map(\.rawValue).joined(separator: ", ")
            logger.debug("RAW file types: \(rawFileTypes)")
        }
```

### Step
Below the line that sets `maxPhotoDimensions`, ask for a full-size JPEG preview inside the DNG of a RAW capture.

Test `rawType != nil && photoSettings.availableRawEmbeddedThumbnailPhotoCodecTypes.contains(.jpeg)` in an `if`. Inside it, keep `photoSettings.maxPhotoDimensions` in a constant `dimensions`. Assign a dictionary with `AVVideoCodecKey` set to `AVVideoCodecType.jpeg`, `AVVideoWidthKey` set to `dimensions.width`, and `AVVideoHeightKey` set to `dimensions.height` to `photoSettings.rawEmbeddedThumbnailPhotoFormat`. Then log "RAW preview: JPEG " and the size with `logger.debug`. Put the comment of the fence above the `if`.

The SDK header of `AVCapturePhotoSettings` says that the codec must be in `availableRawEmbeddedThumbnailPhotoCodecTypes`, and that width and height go together. If the aspect ratio differs, the larger dimension wins and the photo keeps its aspect ratio. Since iOS 12, a DNG can hold a preview at the full size of the RAW image. WWDC21 session 10160 advises this for Apple ProRAW: one DNG with a full-size preview. Photos and other apps show the preview, so they do not have to develop the RAW data for each view. The code must come after `maxPhotoDimensions`, because it reads that value.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=3-10
        photoSettings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        
        // Embed a full-size JPEG preview in the DNG, as the Camera app does. Photos shows this preview for the DNG.
        if rawType != nil && photoSettings.availableRawEmbeddedThumbnailPhotoCodecTypes.contains(.jpeg) {
            let dimensions = photoSettings.maxPhotoDimensions
            photoSettings.rawEmbeddedThumbnailPhotoFormat = [AVVideoCodecKey: AVVideoCodecType.jpeg,
                                                             AVVideoWidthKey: dimensions.width,
                                                             AVVideoHeightKey: dimensions.height]
            logger.debug("RAW preview: JPEG \(dimensions.width)x\(dimensions.height)")
        }
        
        // Set the movie URL if the photo output supports Live Photo capture.
```

### Step
Change the line that sets `livePhotoMovieFileURL` so that an Apple ProRAW capture has no Live Photo movie.

Above the line, add the constant `excludesLivePhoto`: it is `true` when `rawType != nil`, because the only RAW format of this chapter is Apple ProRAW. Add the comment "An Apple ProRAW capture can't include a Live Photo movie." above it. Then add `&& !excludesLivePhoto` to the condition of the existing line. Delete the old line.

If a Live Photo movie URL is in the settings of an Apple ProRAW capture, the photo output raises an exception. Swift `try` does not catch it, so the app would stop. This line protects the capture code itself. A later section also locks the Live Photo button, so the interface tells the same fact.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled ? URL.movieFileURL : nil
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-6
        }
        
        // Set the movie URL if the photo output supports Live Photo capture.
        // An Apple ProRAW capture can't include a Live Photo movie.
        let excludesLivePhoto = rawType != nil
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled && !excludesLivePhoto ? URL.movieFileURL : nil
```

### Step
In the code that sets the quality prioritization, skip the setter for a RAW capture, and log the choice of the person as "ignored for RAW".

Put a new `if rawType != nil` above the existing `if let prioritization`. In its body, log "Quality prioritization ", `features.qualityPrioritization.description`, and ": ignored for RAW" with `logger.debug`. Then change the old `if let` into an `else if let`, on the same line as the closing brace. Add the new comment line of the fence below the existing comment. Delete the old `if let` line.

On the test iPhone, the setter raised the exception "Unsupported when capturing RAW" for a RAW request, and the app stopped. That capture was a Bayer RAW capture, in a first version of this chapter. An Apple ProRAW capture accepted the setter in the same test, but the message names RAW in general, and the SDK header does not describe the case. So the code does not call the setter for any RAW request. Chapter 16 adds Bayer RAW, and it needs the same rule. [`photoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization) then keeps its default. The menu keeps the choice of the person, and the next capture without RAW uses it again.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        if let prioritization = AVCapturePhotoOutput.QualityPrioritization(rawValue: features.qualityPrioritization.rawValue) {
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-5
        // Set the priority of speed versus quality during this capture.
        // The setter isn't supported for a RAW request, so a RAW request keeps the default value.
        if rawType != nil {
            logger.debug("Quality prioritization \(features.qualityPrioritization.description): ignored for RAW")
        } else if let prioritization = AVCapturePhotoOutput.QualityPrioritization(rawValue: features.qualityPrioritization.rawValue) {
            photoSettings.photoQualityPrioritization = prioritization
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

Chapter 7 turned on automatic deferred photo delivery. A first test on a real iPhone showed that this setting and RAW do not work together: the app asked for Apple ProRAW, but no RAW photo arrived. In this section, you turn deferred delivery off while a RAW format is chosen. You also add log lines that show what the photo output decides for each capture. [Concepts: What the device tests showed](ch08-concepts.md#what-the-device-tests-showed) gives the full story.

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
                                           isAppleProRAWSupported: rawPixelFormat(for: .appleProRAW) != nil)
    }
    
    // Enables deferred photo delivery only while no RAW format is in use.
    private func updateDeferredPhotoDelivery() {
        // Deferred processing isn't available for RAW photos. With deferred delivery on, a RAW request
        // can deliver a proxy and no RAW photo at all.
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

[`AVCaptureResolvedPhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings) tells what the photo output really does for this capture, before any photo arrives. A RAW capture of this app without deferred delivery has an expected count of 1, a photo size of 0x0, and a RAW size that is not 0x0. A proxy size that is not 0x0 means that a proxy replaces the processed photo.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-9
    func photoOutput(_ output: AVCapturePhotoOutput, willBeginCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings) {
        // Determine if this is a live capture.
        isLivePhoto = resolvedSettings.livePhotoMovieDimensions != .zero
        activityContinuation.yield(.photoCapture(isLivePhoto: isLivePhoto))
        // Log what the photo output decides for this capture. A RAW capture expects one photo, the DNG.
        let photo = resolvedSettings.photoDimensions
        let raw = resolvedSettings.rawPhotoDimensions
        let proxy = resolvedSettings.deferredPhotoProxyDimensions
        logger.debug("Resolved settings: \(resolvedSettings.expectedPhotoCount) photos, photo \(photo.width)x\(photo.height), RAW \(raw.width)x\(raw.height), proxy \(proxy.width)x\(proxy.height)")
    }
```

### Step
In `didFinishCapturingDeferredPhotoProxy`, log "Captured deferred photo proxy, N bytes" as the last line.

Use `self.photoData?.count ?? 0` for N. Now the console shows which callback delivered the photo: this line for a proxy, and "Captured RAW photo" or "Captured processed photo" for a full photo. In the device test, the console showed neither line for the RAW photo, and this line did not exist yet.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4
        // Capture the data for this photo.
        photoData = deferredPhotoProxy?.fileDataRepresentation()
        isProxyPhoto = true
        logger.debug("Captured deferred photo proxy, \(self.photoData?.count ?? 0) bytes")
    }
```

### Step
In `updateCapabilities(for:)`, log whether the camera offers Apple ProRAW, with the name of the camera and its `isVirtualDevice` value.

Below the initializer call, copy `capabilities.isAppleProRAWSupported` into the local constant `isAppleProRAWSupported`, so that the log closure does not read the property of `self`. Then log "RAW on ", `device.localizedName`, the value of [`device.isVirtualDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvirtualdevice), and the flag. Copy the comment from the code. Git counts the closing brace of the method as a new line, so it is highlighted too.

This app uses the camera that the system prefers. On the back of an iPhone with several lenses, that is usually a virtual camera, such as the dual or the triple camera, which joins several physical cameras. Apple ProRAW works on a virtual camera. Bayer RAW does not, so chapter 16 needs the "virtual" value of this line.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-7
    private func updateCapabilities(for device: AVCaptureDevice) {
        capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: photoOutput.isLivePhotoCaptureSupported,
                                           isAppleProRAWSupported: rawPixelFormat(for: .appleProRAW) != nil)
        // Log the camera and whether it's virtual, such as the dual camera that fuses two lenses.
        let isAppleProRAWSupported = capabilities.isAppleProRAWSupported
        logger.debug("RAW on \(device.localizedName) (virtual: \(device.isVirtualDevice)): Apple ProRAW \(isAppleProRAWSupported)")
    }
```

### Step
Build and run the app, and look at the Xcode console.

No code calls `setRAWFormat(_:)` yet. At the start, the console shows the RAW line and the deferred delivery line for the camera. In the Simulator with SimCam, the Apple ProRAW flag is `false`.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo as before. The console shows "RAW on ..." with Apple ProRAW false, "Deferred photo delivery (supported/enabled): ...", and a "Resolved settings: 1 photos, ..." line for the capture.
```

## Pass the choice through the model

The camera model keeps the choice of the person, and it keeps the abilities of the current camera. In this section, you add both to the model, to the preview model, and to the `Camera` protocol. You add the protocol members last, so that the project compiles after each step.

### Step
In `CameraModel.swift`, below `qualityPrioritization`, add the property `rawFormat` with the value `RAWFormat.off`, and the property `captureCapabilities` with the value `CaptureCapabilities.unknown`.

Write `var rawFormat = RAWFormat.off` with a `didSet` observer, and `private(set) var captureCapabilities = CaptureCapabilities.unknown`. Give each a `///` comment: "A value that indicates which RAW format to capture." and "The capture features that the current camera configuration supports." In `didSet`, write the comment "Turn deferred photo delivery off for RAW, and on again for no RAW." and `Task { await captureService.setRAWFormat(rawFormat) }`.

The `didSet` observer runs each time the value changes: when the person picks a choice in the menu, and when the reset below sets `.off`. The `Task` is necessary because `didSet` is synchronous and `CaptureService` is an actor. The model sets `captureCapabilities` itself, so only the model can write it. The views read it to decide what to show.

```swift file=AVCam/CameraModel.swift highlight=4-10,12-13
    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization = QualityPrioritization.quality
    
    /// A value that indicates which RAW format to capture.
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
In `PreviewCameraModel.swift`, below `qualityPrioritization`, add `rawFormat` and `captureCapabilities` with Apple ProRAW supported.

Write `var rawFormat = RAWFormat.off`. Then write `let captureCapabilities = CaptureCapabilities(isAppleProRAWSupported: true)` with the comment "Report Apple ProRAW as supported so the previews show the RAW control." above it. The preview model never changes its capabilities, so `let` is enough.

The Xcode canvas has no camera, so it cannot find out what a camera supports. With the flag `true`, the canvas shows the RAW menu that the Simulator hides. The file is in the group `Preview Content`.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=3-5
    var isLivePhotoEnabled = true
    var qualityPrioritization = QualityPrioritization.quality
    var rawFormat = RAWFormat.off
    // Report Apple ProRAW as supported so the previews show the RAW control.
    let captureCapabilities = CaptureCapabilities(isAppleProRAWSupported: true)
    var shouldFlashScreen = false
```

### Step
In `Camera.swift`, add `rawFormat: RAWFormat { get set }` and `captureCapabilities: CaptureCapabilities { get }` to the `Camera` protocol.

Add them below `qualityPrioritization`, each with a `///` comment. These are the same two comments as in `CameraModel`. Both conforming types have the members now, so the project compiles. The views can read both members through the protocol.

```swift file=AVCam/Model/Camera.swift highlight=4-5,7-8
    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization: QualityPrioritization { get set }
    
    /// A value that indicates which RAW format to capture.
    var rawFormat: RAWFormat { get set }
    
    /// The capture features that the current camera configuration supports.
    var captureCapabilities: CaptureCapabilities { get }
    
    /// Captures a photo and writes it to the user's photo library.
    func capturePhoto() async
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
Inside that loop, set `rawFormat` to `.off` when the new capabilities do not support Apple ProRAW.

Add the comment "Fall back to no RAW when the new camera doesn't support Apple ProRAW." above an `if`. The condition is `rawFormat == .appleProRAW && !capabilities.isAppleProRAWSupported`.

A person can choose Apple ProRAW with the back camera and then switch to a camera that has no RAW. Without the reset, the next capture would ask for a format that the camera does not have. `rawPixelFormat(for:)` would return `nil`, so the capture would not stop, but the menu would show a choice that does nothing. The reset keeps the menu honest.

```swift file=AVCam/CameraModel.swift highlight=3-6
            for await capabilities in await captureService.$captureCapabilities.values {
                captureCapabilities = capabilities
                // Fall back to no RAW when the new camera doesn't support Apple ProRAW.
                if rawFormat == .appleProRAW && !capabilities.isAppleProRAWSupported {
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

## Send the choice, and lock Live Photo

The model has the choice of the person, but no capture uses it yet. In this section, `capturePhoto()` sends the RAW format to the capture code. An Apple ProRAW capture also cannot include a Live Photo movie. The capture code already drops the movie, but the Live Photo button would still show Live Photo as on. So the model tells the views when Live Photo is not available, and the button shows it. The choice of the person stays, so Live Photo comes back when RAW is Off again.

### Step
In `CameraModel.swift`, below `isLivePhotoEnabled`, add the computed property `isLivePhotoAvailable` of type `Bool`. It is `false` while the RAW format is Apple ProRAW.

The body is `rawFormat != .appleProRAW`, with the comment "An Apple ProRAW capture can't include a Live Photo movie." above it. Add the `///` comment "A Boolean value that indicates whether the current RAW format allows a Live Photo." above the property.

The property is internal, because the views read it through the `Camera` protocol. It is computed, so it is always in step with `rawFormat`, and it needs no storage. It does not change `isLivePhotoEnabled`.

```swift file=AVCam/CameraModel.swift highlight=4-8
    /// A Boolean value that indicates whether to capture Live Photos when capturing stills.
    var isLivePhotoEnabled = true
    
    /// A Boolean value that indicates whether the current RAW format allows a Live Photo.
    var isLivePhotoAvailable: Bool {
        // An Apple ProRAW capture can't include a Live Photo movie.
        rawFormat != .appleProRAW
    }
```

### Step
In `PreviewCameraModel.swift`, below `rawFormat`, add `isLivePhotoAvailable` with the same rule in one line.

Write `var isLivePhotoAvailable: Bool { rawFormat != .appleProRAW }`. The preview model must have each member of the `Camera` protocol, and the next step adds this member to the protocol.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=2
    var rawFormat = RAWFormat.off
    var isLivePhotoAvailable: Bool { rawFormat != .appleProRAW }
```

### Step
In `Camera.swift`, add `isLivePhotoAvailable: Bool { get }` to the `Camera` protocol, below `isLivePhotoEnabled`.

Use the same `///` comment as in `CameraModel`. The member is read-only, because it follows from `rawFormat`. Both conforming types have it now, so the project compiles.

```swift file=AVCam/Model/Camera.swift highlight=4-5
    /// A Boolean value that indicates whether to capture Live Photos when capturing stills.
    var isLivePhotoEnabled: Bool { get set }
    
    /// A Boolean value that indicates whether the current RAW format allows a Live Photo.
    var isLivePhotoAvailable: Bool { get }
```

### Step
In `capturePhoto()`, pass `isLivePhotoEnabled && isLivePhotoAvailable` as the first argument of the `PhotoFeatures(...)` call, and add `rawFormat: rawFormat` as the third argument.

Split the call into two lines: `qualityPrioritization:` and the new argument go on the second line, aligned below the first argument. Delete the old one-line call. This is the line that sends the choice of the person to the capture code.

With Apple ProRAW, the capture now gets `false` for Live Photo, whatever the person chose before. The capture code also drops the movie URL for Apple ProRAW. The two checks agree, and the check in `PhotoCapture` protects any other caller.

```swift file=AVCam/CameraModel.swift remove
            let photoFeatures = PhotoFeatures(isLivePhotoEnabled: isLivePhotoEnabled, qualityPrioritization: qualityPrioritization)
```

```swift file=AVCam/CameraModel.swift highlight=2-3
        do {
            let photoFeatures = PhotoFeatures(isLivePhotoEnabled: isLivePhotoEnabled && isLivePhotoAvailable,
                                              qualityPrioritization: qualityPrioritization, rawFormat: rawFormat)
            let photo = try await captureService.capturePhoto(with: photoFeatures)
```

### Step
In `FeatureToolbar.swift`, in `livePhotoButton`, show the symbol `livephoto.slash` while Live Photo is not available, and disable the button.

In the label, use `"livephoto"` only when `camera.isLivePhotoEnabled && camera.isLivePhotoAvailable`. Put the comment of the fence above the `Image`. Delete the old `Image` line. Then add the modifier `.disabled(!camera.isLivePhotoAvailable)` to the button.

While the person has chosen Apple ProRAW, the button shows Live Photo as off, and a tap does nothing. The value of `isLivePhotoEnabled` stays as it was. When the person sets RAW to Off, the button works again and shows that value.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift remove
            Image(systemName: camera.isLivePhotoEnabled ? "livephoto" : "livephoto.slash")
```

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=5-6,8
    var livePhotoButton: some View {
        Button {
            camera.isLivePhotoEnabled.toggle()
        } label: {
            // Show Live Photo as off while the RAW format doesn't allow it. The choice of the person stays.
            Image(systemName: camera.isLivePhotoEnabled && camera.isLivePhotoAvailable ? "livephoto" : "livephoto.slash")
        }
        .disabled(!camera.isLivePhotoAvailable)
    }
```

### Step
Build and run the app, and take a photo.

In the Simulator with SimCam, the camera has no RAW format, so `rawFormat` stays `.off`. The Live Photo button works as in chapter 7, and a capture saves a normal photo.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The Live Photo button works as before. The app saves the photo and shows its thumbnail. The console shows "Saved asset ...".
```

## Add the RAW menu

The last piece is the control. It is a menu in the features toolbar from chapter 7. It shows only when the camera offers Apple ProRAW.

### Step
In `FeatureToolbar.swift`, below `prioritizePicker`, add the private computed property `supportedRAWFormats` of type `[RAWFormat]`.

It filters `RAWFormat.allCases` with a `switch $0` in the closure. The case `.off` gives `true`. The case `.appleProRAW` gives `camera.captureCapabilities.isAppleProRAWSupported`. Write each case on one line, as `case .off: true`, with no `return`. Add the comment "The RAW formats that the current camera supports. A person can always turn RAW off." above it.

The `switch` is an expression here, so each case is its value. The list always has `.off`. Thus the menu always has a way back. A `switch` instead of a single test leaves room for the Bayer RAW case of chapter 16: the compiler then asks for the new case here.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=7-15
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
            }
        }
    }
```

### Step
Add the property `rawMenu` of type `some View`, marked `@ViewBuilder`. It shows a `Menu` only when `supportedRAWFormats.count > 1`.

Write the comment "A menu to choose the RAW format. The menu is hidden when the camera supports no RAW format." above `@ViewBuilder`. Inside the `if`, write a `Menu` whose label is `Image(systemName:)`. The symbol is `"r.square.fill"` when `camera.rawFormat` is not `.off`, and `"r.square"` when it is `.off`. Leave the content closure of the `Menu` empty for now.

The count is greater than 1 when `.off` and Apple ProRAW are in the list. The system has no symbol `camera.raw`, so the app uses the square with the letter R. In the Simulator, the list has only `.off`, so the menu does not appear.

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

In the Simulator with SimCam, the camera has no RAW format. The RAW menu is hidden, and the toolbar looks as in chapter 7. A capture saves a normal photo and shows its thumbnail. To see the menu without an iPhone, open the preview at the end of `FeatureToolbar.swift` in the Xcode canvas. The preview model reports Apple ProRAW, so the menu shows there.

> [!IMPORTANT]
> Seven tests on an iPhone 17 Pro Max with iOS 26 shaped this code. The last test verified the save path of this chapter on two cameras: the virtual "Back Dual Camera" and the "Front TrueDepth Camera". The front camera offers Apple ProRAW too. Each capture gave one DNG in Photos, and Photos showed it as a RAW photo. Share > Options > Format: Unmodified Original ("Export Unmodified Original") gave the DNG. The DNG was 12 MP (4032x3024) on the virtual camera. In an earlier test on the physical telephoto camera, it was 48 MP (8064x6048) and 54 MB. The console shows "Capturing with RAW format: Apple ProRAW", "RAW file types: com.adobe.raw-image", "RAW preview: JPEG WxH", "Quality prioritization ...: ignored for RAW", "Resolved settings: ...", "Captured RAW photo, N bytes", "RAW data: ...", "Resource .photo: N bytes, file ....dng", and "Saved asset ...". In the last test, the request still had a processed photo, and the app saved the DNG alone. The request of this chapter asks for the DNG alone, so "Resolved settings" is expected to show "1 photos" and a photo size of 0x0. While Apple ProRAW is chosen, the Live Photo button shows `livephoto.slash` and does not react. The choice of Apple ProRAW turns deferred delivery off, and that change builds the capture pipeline again. In chapter 9, you add a readiness log: on the device, it showed `sessionNotRunning` and then `ready` after a RAW capture, because of this rebuild. The app starts with the camera that the system prefers. The "RAW on ..." line names the camera and says whether it is virtual.
```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The RAW menu is hidden in the Simulator. The Live Photo button works as before. A capture saves a normal photo and shows its thumbnail.
Note: On an iPhone with a Pro camera, an Apple ProRAW capture saves one picture: the DNG alone, which Photos shows as a RAW photo. The Live Photo button is off and disabled while Apple ProRAW is chosen.
```

### Experiment
On a real iPhone with a Pro camera, turn the Live Photo button on, then choose Apple ProRAW. The button now shows Live Photo as off. Take a photo, and read the "Resolved settings" line: the count is 1, the photo size is 0x0, and the RAW size is not 0x0. Choose Off again: the button shows Live Photo as on, as you left it. Take a photo: deferred delivery is on again, the RAW size is 0x0, and the proxy size can be more than 0x0. In Photos, open the RAW picture, and choose Share > Options: Format offers Unmodified Original, which gives the DNG. With Apple ProRAW and the quality menu on "Quality", the console shows "Quality prioritization Quality: ignored for RAW".

### Text
Your code is now the same as the `chapter-08` branch. The app captures and saves an Apple ProRAW DNG on a device that supports it, and it takes a normal photo on all others. In the next chapter, you make capture feel faster with responsive capture and a readiness state for the capture button.

## Check your understanding

### The RAW request of this chapter passes `nil` as `processedFormat`. What does the delegate get?

- [ ] Two photos: the DNG, and a processed photo in the default format.
  > A `nil` processed format means no processed photo. The SDK header says so for `init(rawPixelFormatType:processedFormat:)`.
- [x] One photo, the DNG. `photoData` holds it, and `isRAWPhoto` is `true`.
  > Correct. The delegate gets one call of `didFinishProcessingPhoto`, and `expectedPhotoCount` is 1. The media library then saves the DNG alone.
- [ ] No photo, because a capture must always have a processed photo.
  > A RAW-only capture is allowed. The guard that throws `noPhotoData` reads `photoData`, which holds the DNG.

### A person chooses Apple ProRAW in the menu. Quality is set to "Quality". Why does the code not set `photoQualityPrioritization` for this capture?

- [ ] RAW files are too large for the quality level, so the system would delay the save.
  > The size of the file is not the reason. The rule is about the capture request.
- [x] The setter is not supported for a RAW request: on the test iPhone it raised "Unsupported when capturing RAW", so the code keeps the default for every RAW request.
  > Correct. The menu keeps its value, and the next capture without RAW uses it again. The log line "ignored for RAW" shows the skipped choice.
- [ ] The code skips the setter so that the camera can record the Live Photo movie.
  > The prioritization has no link to the movie. The Live Photo rule for Apple ProRAW is a different line.

### The person switches to a camera that has no RAW. Why does `CameraModel` set `rawFormat` back to `.off`?

- [ ] The photo output raises an exception when `rawFormat` is not `.off` and the camera has no RAW.
  > The helper `rawPixelFormat(for:)` returns `nil` for a format that is not in the list, so the capture asks for no RAW and does not stop.
- [x] The menu would show a choice that the camera cannot do, and the capture would silently take a normal photo.
  > Correct. The reset keeps the choice in the model in step with what the camera can do. The helper is a second guard.
- [ ] The Photos library refuses a RAW photo from a camera that has no RAW.
  > The library does not know which camera made the photo. The reason is in the model, not in the library.
