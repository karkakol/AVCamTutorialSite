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
> The Simulator with SimCam has no RAW format. The RAW control stays hidden there, and a capture gives a normal photo. The RAW capture itself needs a real iPhone with a Pro camera. Seven device tests on an iPhone 17 Pro Max shaped the code. RAW and deferred delivery do not work together, so the app turns deferred delivery off for RAW. Photos took the RAW pair only in one form: the processed photo is the main photo, and the DNG is a file that is the alternate photo. A Bayer RAW request stops the app when the code sets the quality prioritization, so a RAW request keeps the default. The save now first tries the model of the Camera app: the DNG alone, with a full-size JPEG preview inside. That first request has not run on a device yet. The verified pair is its fallback. [Concepts: What the device tests showed](ch08-concepts.md#what-the-device-tests-showed) tells the full story.

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

A RAW capture gives two photos: the DNG and the processed photo. In this section, you teach the delegate to keep both, and you teach `MediaLibrary` to save them. The app saves the DNG alone, as the Camera app does. If Photos refuses the DNG alone, the app saves a RAW+JPEG asset: the processed photo is the main photo, and the DNG is the alternate photo. The DNG goes to Photos as a file with the `.dng` extension. You also add log lines that show each photo that arrives, each resource that the app sends to Photos, the asset that Photos creates, and each error with the name of its code. Device tests showed why these lines are necessary: the first RAW captures saved nothing, and the console did not show the reason. The capture does not ask for RAW yet, so you can build and run at the end.

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

Test [`photo.isRawPhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/israwphoto) in an `if`. In the `if` branch, call `fileDataRepresentation()` and keep the result in a constant `data`, log "Captured RAW photo, N bytes" with `logger.debug` (use `data?.count ?? 0` for N), and assign `data` to `rawData`. In the `else` branch, assign `fileDataRepresentation()` to `photoData`, as the old line did, and then log "Captured processed photo, N bytes" with `logger.debug` (use `self.photoData?.count ?? 0` for N). Put a `//` comment above the `if`: "A RAW capture calls this method twice: once for the DNG and once for the processed photo."

A RAW request calls the method twice. Without the test, the second call would replace the first one, and the app would keep only one of the two photos. [`fileDataRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation()) returns DNG data for the RAW photo. Delete the old `photoData` line: it moves into the `else` branch.

The two log lines show that each photo arrived. The log message is a closure that runs later, so Swift asks for `self.` in front of the property `photoData`. The local constant `data` needs no `self.`.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        photoData = photo.fileDataRepresentation()
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=6-14
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
            logger.debug("Captured processed photo, \(self.photoData?.count ?? 0) bytes")
        }
    }
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

Put the import between `Foundation` and `Photos`, so the imports stay in alphabetical order. `ImageIO` gives [`CGImageSource`](https://developer.apple.com/documentation/imageio/cgimagesource). The app uses it to check the data of each photo before the save.

```swift file=AVCam/Model/MediaLibrary.swift highlight=2
import Foundation
import ImageIO
import Photos
import UIKit
```

### Step
In `MediaLibrary`, add a new private method `save(rawData:processedData:location:)` below `performChange(_:)`, in a new part with the mark `// MARK: - Saving RAW photos`.

The method is `async throws`. It takes the DNG data, the data of the processed photo, and the location as a `CLLocation?`. Copy the `///` comment of the fence above it. Leave the body empty for now. The next steps fill it.

The method has the same base name as `save(photo:)`, but other argument labels, so Swift keeps the two apart. It is private, because only `save(photo:)` calls it. It has two requests, in order. The first request is the model of the Camera app. The second request is the model that saved on the test iPhone.

```swift file=AVCam/Model/MediaLibrary.swift highlight=1,3-8
    // MARK: - Saving RAW photos
    
    /// Saves a RAW capture as one asset.
    ///
    /// The method first saves the DNG alone, as the Camera app does. If Photos refuses it, the method saves a RAW+JPEG
    /// asset: the processed photo is the main photo, and the DNG is its alternate.
    private func save(rawData: Data, processedData: Data, location: CLLocation?) async throws {
    }
    
    // MARK: - Thumbnail handling
```

### Step
In the new method, write the DNG data to a file at `URL.rawFileURL`, and remove the file when the method ends.

Keep the URL in a constant `rawFileURL`, and call `try rawData.write(to: rawFileURL)`. Put the comment "Write the DNG data to a file. Photos reads the type of the RAW resource from the `.dng` extension." above the two lines. Then add `defer { try? FileManager.default.removeItem(at: rawFileURL) }`, with the comment "Remove the file if Photos doesn't take it. After a successful save, the file is already gone." above it.

A device test showed why the DNG must be a file: Photos refused a pair when the DNG came as `Data`. With `Data`, Photos takes the type from the resource type, and a resource type does not say "DNG". [`write(to:options:)`](https://developer.apple.com/documentation/foundation/data/write(to:options:)) throws if the disk is full. Then the method stops before Photos gets a request. The `defer` block runs when the method returns or throws. Later in this method, you ask Photos to move the file into the library. Photos removes the file only when the save succeeds. After a failure, the file stays in the temporary directory, so the `defer` block removes it. After a success, the file is gone, and `try?` ignores the error of [`removeItem(at:)`](https://developer.apple.com/documentation/foundation/filemanager/removeitem(at:)-xj6x).

```swift file=AVCam/Model/MediaLibrary.swift highlight=2-6
    private func save(rawData: Data, processedData: Data, location: CLLocation?) async throws {
        // Write the DNG data to a file. Photos reads the type of the RAW resource from the `.dng` extension.
        let rawFileURL = URL.rawFileURL
        try rawData.write(to: rawFileURL)
        // Remove the file if Photos doesn't take it. After a successful save, the file is already gone.
        defer { try? FileManager.default.removeItem(at: rawFileURL) }
    }
```

### Step
Below `save(rawData:processedData:location:)`, add the private static method `imageInfo(of:)`. It returns the image type that Image I/O finds in the data, and the number of images.

The return type is the tuple `(type: String, count: Int)`. Make an image source with [`CGImageSourceCreateWithData(_:_:)`](https://developer.apple.com/documentation/imageio/cgimagesourcecreatewithdata(_:_:)) in a `guard`. If it gives `nil`, return `("none", 0)`. Read the type identifier with [`CGImageSourceGetType(_:)`](https://developer.apple.com/documentation/imageio/cgimagesourcegettype(_:)), and use `"none"` when it is `nil`. Return the type and the result of [`CGImageSourceGetCount(_:)`](https://developer.apple.com/documentation/imageio/cgimagesourcegetcount(_:)). Add the `///` comment "Returns the image type that Image I/O finds in the photo data, and the number of images in the data." above it.

The method reads only the start of the data, where each file format has its signature. A DNG gives the type `com.adobe.raw-image`, a HEIF photo gives `public.heic`, and a JPEG photo gives `public.jpeg`. A count of 0 means that Image I/O cannot read an image from the data. The method is `static`, because it uses no state of the media library. It returns a `String`, not a `UTType`, because the app only logs the value.

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
At the start of `save(rawData:processedData:location:)`, above the comment "Write the DNG data to a file", log what the RAW data is.

Make a string `rawHeader` from the first 4 bytes of `rawData`: `rawData.prefix(4)`, each byte with `String(format: "%02X", $0)`, joined with a space. Keep `Self.imageInfo(of: rawData)` in `rawImage`. Then log "RAW data: " with the size, the header, `rawImage.type`, and `rawImage.count`, with `logger.debug`. Put the comment "Check the RAW data before the save. A DNG file is a TIFF file, so it starts with `49 49 2A 00` or `4D 4D 00 2A`." above the lines.

Device tests showed error 3300 for several requests, and the error named the DNG file. These values proved that the data is a good DNG, so the cause was the form of the request. Keep the line: it tells you at once if a capture gives bad data. The capture embeds a JPEG preview in the DNG, so the count of images can be more than 1. A DNG has the structure of a TIFF file. Its first 4 bytes are `49 49 2A 00` ("II*", little-endian byte order) or `4D 4D 00 2A` ("MM", big-endian byte order). The type `com.adobe.raw-image` with at least 1 image means that Image I/O reads the data as a DNG.

```swift file=AVCam/Model/MediaLibrary.swift highlight=2-5
    private func save(rawData: Data, processedData: Data, location: CLLocation?) async throws {
        // Check the RAW data before the save. A DNG file is a TIFF file, so it starts with `49 49 2A 00` or `4D 4D 00 2A`.
        let rawHeader = rawData.prefix(4).map { String(format: "%02X", $0) }.joined(separator: " ")
        let rawImage = Self.imageInfo(of: rawData)
        logger.debug("RAW data: \(rawData.count) bytes, header \(rawHeader), type \(rawImage.type), images \(rawImage.count)")
        
        // Write the DNG data to a file. Photos reads the type of the RAW resource from the `.dng` extension.
```

### Step
Below the `defer` line, save the DNG alone in a `do` block: log the resource, and call `performChange(_:)` with a request that has the DNG file as its only `.photo` resource.

In the closure, make `creationRequest` with `PHAssetCreationRequest.forAsset()`, as `save(photo:)` does. Make a `PHAssetResourceCreationOptions` object in `rawOptions`, and set its [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile) to `true`. Set nothing else. Call [`addResource(with:fileURL:options:)`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:)) with `.photo`, `rawFileURL`, and `rawOptions`. Then set `creationRequest.location = location` and return `creationRequest.placeholderForCreatedAsset`. Copy the comments of the fence.

This is the model of the Camera app: one asset, one file, the DNG. Photos shows the JPEG preview that the capture embeds in the DNG (you add it in a later section). `shouldMoveFile` moves the file into the library, so Photos does not copy the many megabytes of a DNG. The Live Photo movie of `save(photo:)` uses the same option. The options have no file name and no type, so Photos takes both from the file URL, which ends in `.dng`. The options object is made inside the closure, because it is not `Sendable`. The SDK header of `PHAssetCreationRequest` says that `addResource` always succeeds, and that Photos checks the request later. So the log line shows what the app sent before Photos answers. The `do` block stays open until the next step closes it, so do not build now.

```swift file=AVCam/Model/MediaLibrary.swift highlight=3-15
        defer { try? FileManager.default.removeItem(at: rawFileURL) }
        
        do {
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
Below the `performChange(_:)` call, log the saved path and `return`. Then close the `do` block with a `catch` block that logs the refusal with `logger.notice`.

The log line in the `do` block is "Saved the RAW as the DNG alone". The `return` ends the method, so a saved DNG never reaches the second request. The line in the `catch` block is "Photos refused the DNG alone. Saving the processed photo with the DNG as alternate." `performChange(_:)` has already logged the error from Photos with the name of its code, so this line only names the next path. The `catch` block does not throw, so the method goes on to the second request.

The DNG alone has not run on a device yet. The second request is the form that saved on the test iPhone.

```swift file=AVCam/Model/MediaLibrary.swift highlight=3-7
                return creationRequest.placeholderForCreatedAsset
            }
            logger.debug("Saved the RAW as the DNG alone")
            return
        } catch {
            logger.notice("Photos refused the DNG alone. Saving the processed photo with the DNG as alternate.")
        }
    }
```

### Step
Below the `do` block, log the two resources of the second request.

Keep `Self.imageInfo(of: processedData)` in `processedImage`. Log two lines with `logger.debug`: the `.photo` resource with the size of `processedData`, `processedImage.type`, and `processedImage.count`; the `.alternatePhoto` resource with the size of `rawData` and the file name `rawFileURL.lastPathComponent`. Put the comment of the fence above the lines.

The names [`.photo`](https://developer.apple.com/documentation/photos/phassetresourcetype/photo) and [`.alternatePhoto`](https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto) are cases of [`PHAssetResourceType`](https://developer.apple.com/documentation/photos/phassetresourcetype). The first request did not move the file, because Photos moves it only when it creates the asset. So the second request can use the same file.

```swift file=AVCam/Model/MediaLibrary.swift highlight=4-7
            logger.notice("Photos refused the DNG alone. Saving the processed photo with the DNG as alternate.")
        }
        
        // Photos removes the file only when it creates the asset, so the refused request left the file in place.
        let processedImage = Self.imageInfo(of: processedData)
        logger.debug("Resource .photo: \(processedData.count) bytes, type \(processedImage.type), images \(processedImage.count)")
        logger.debug("Resource .alternatePhoto: \(rawData.count) bytes, file \(rawFileURL.lastPathComponent)")
    }
```

### Step
Below the log lines, call `performChange(_:)`, make a creation request, and add the processed photo as the `.photo` resource.

In the closure, make `creationRequest` with `PHAssetCreationRequest.forAsset()`. Then call [`addResource(with:data:options:)`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:data:options:)) with `.photo`, `processedData`, and `options: nil`. Put the comment "Save the processed photo as the main photo of the asset." above the call. This `try` is not in a `do` block, so an error goes to `save(photo:)`.

In this request, the `.photo` resource is the main photo of the asset. Photos shows it in the grid, and other apps get it when they share the picture. The documentation of `.alternatePhoto` describes this model: a JPEG as the main photo and a RAW file as the alternate. The data needs no options, because Photos reads its type from the `.photo` resource type.

The project does not compile at the end of this step. The closure has no `return` yet. The next step adds it.

```swift file=AVCam/Model/MediaLibrary.swift highlight=2-6
        logger.debug("Resource .alternatePhoto: \(rawData.count) bytes, file \(rawFileURL.lastPathComponent)")
        try await performChange {
            let creationRequest = PHAssetCreationRequest.forAsset()
            // Save the processed photo as the main photo of the asset.
            creationRequest.addResource(with: .photo, data: processedData, options: nil)
        }
    }
```

### Step
Below the processed photo, add the DNG file as the `.alternatePhoto` resource with `shouldMoveFile`, set the location, and return the placeholder. After the call, log the saved path.

Make `rawOptions` with `shouldMoveFile` set to `true`, as in the first request. Call `addResource(with:fileURL:options:)` with `.alternatePhoto`, `rawFileURL`, and `rawOptions`. Set the location and return `placeholderForCreatedAsset`. Below the closing brace of the call, log "Saved the RAW as the processed photo with the DNG as alternate" with `logger.debug`. Copy the comments of the fence.

On the test iPhone, this is the only request with a DNG that Photos accepted. Photos shows the asset as one picture with the badge "JPG + RAW". The reverse order of Apple's article, the DNG as `Data`, and extra file names and types all gave error 3300.

```swift file=AVCam/Model/MediaLibrary.swift highlight=2-8,10
            creationRequest.addResource(with: .photo, data: processedData, options: nil)
            // Move the large DNG file into the library instead of copying it.
            let rawOptions = PHAssetResourceCreationOptions()
            rawOptions.shouldMoveFile = true
            // Save the DNG as the alternate photo of the same asset.
            creationRequest.addResource(with: .alternatePhoto, fileURL: rawFileURL, options: rawOptions)
            creationRequest.location = location
            return creationRequest.placeholderForCreatedAsset
        }
        logger.debug("Saved the RAW as the processed photo with the DNG as alternate")
    }
```

### Step
In `save(photo:)`, call the new method for a RAW capture, below `let location = try await currentLocation`.

Use `if let rawData = photo.rawData, !photo.isProxy`. Inside it, call `try await save(rawData: rawData, processedData: photo.data, location: location)` in a `do` block, and then `return`. Put the two-line comment "Save a RAW capture as one asset. Proxy data is valid only as a `.photoProxy` resource," and "so a RAW pair needs a fully processed photo." above the `if`. The code below the `if` stays as it was in chapter 7.

The `return` ends `save(photo:)` after the RAW save, so a RAW capture never reaches the old code. A capture without a DNG skips the `if` and saves the photo as before. The `do` block has no `catch` yet. In Swift, a `do` block without `catch` is a plain scope, and errors go up to the caller. The next section adds the `catch`.

The `!photo.isProxy` test is for deferred delivery from chapter 7. The data of a proxy is not a finished photo. Photos accepts it only as a `.photoProxy` resource, and it finishes the photo later. So a proxy never goes into the RAW pair. Later in this chapter, you turn deferred delivery off for RAW, so a RAW capture does not get a proxy.

```swift file=AVCam/Model/MediaLibrary.swift highlight=4-11
    func save(photo: Photo) async throws {
        let location = try await currentLocation
        
        // Save a RAW capture as one asset. Proxy data is valid only as a `.photoProxy` resource,
        // so a RAW pair needs a fully processed photo.
        if let rawData = photo.rawData, !photo.isProxy {
            do {
                try await save(rawData: rawData, processedData: photo.data, location: location)
            }
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

`capturePhoto()` catches every error of the capture and of the save: `PhotoCaptureError.noPhotoData` when no processed photo arrived, and `MediaLibrary.Error.unauthorized` or `.saveFailed(reason:)` from the media library. It stores the error in the property `error`, but no view reads that property. Without this line, a failed capture leaves no trace in the console.

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

No capture asks for RAW yet, so `rawData` is always `nil`. `save(photo:)` skips the RAW branch and saves the photo with the code of chapter 7. The console now shows the processed photo and the new asset.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail, as before. The console shows "Captured processed photo, N bytes" and "Saved asset ...".
Note: On an iPhone with deferred delivery, a normal capture can deliver a proxy instead of the processed photo. Then the line "Captured processed photo" does not show, but "Saved asset ..." does.
```

## Keep the photo when Photos refuses the RAW

Photos can still refuse both RAW requests. Device tests showed that Photos gives only a code, and that a refused request saves nothing at all. In this section, you add a fallback: when the pair fails, the app saves the processed photo alone. The person then always gets a picture, and the console tells why the RAW is missing. The fallback makes the app robust, but it is not a part of the RAW save itself. So it has its own section, and you can leave it out to see the pure behavior of Photos.

### Step
In `save(photo:)`, add a `catch` block to the `do` block of the RAW branch. In it, save the processed photo alone, and log "Saved the processed photo without the RAW: " with the error.

Change the closing brace of the `do` block to `} catch {`. In the `catch` block, call `try await performChange` with a closure that makes a creation request, adds `photo.data` as the `.photo` resource with `options: nil`, sets `location`, and returns `placeholderForCreatedAsset`. After the call, log the line with `logger.notice`. Close the `catch` block before `return`. Put the comment "Photos can refuse both RAW requests. Save the processed photo alone, so that the capture isn't lost." above the call.

The `catch` block gets each error of `save(rawData:processedData:location:)`: a `MediaLibrary.Error.saveFailed(reason:)` from the second request, or the error of `write(to:options:)`. So this is the third path: the DNG alone failed, and the pair failed too. `performChange(_:)` has already logged the Photos error with the name of its code, so the console shows "Saving to Photos failed: ..." first, then "Saved asset ...", and then the new line. The new line comes only after the second save succeeds. If the second save fails too, its error goes to `capturePhoto()`, which logs "Photo capture failed: ...". The `.unauthorized` error also takes this path, because the second save checks the access again.

The fallback request is the code of chapter 4 without the Live Photo movie. An Apple ProRAW capture has no movie, so nothing is lost there. The RAW pair has no movie either. A Bayer RAW capture with Live Photo on can record a movie, and this chapter does not save it.

```swift file=AVCam/Model/MediaLibrary.swift highlight=4-12
        if let rawData = photo.rawData, !photo.isProxy {
            do {
                try await save(rawData: rawData, processedData: photo.data, location: location)
            } catch {
                // Photos can refuse both RAW requests. Save the processed photo alone, so that the capture isn't lost.
                try await performChange {
                    let creationRequest = PHAssetCreationRequest.forAsset()
                    creationRequest.addResource(with: .photo, data: photo.data, options: nil)
                    creationRequest.location = location
                    return creationRequest.placeholderForCreatedAsset
                }
                logger.notice("Saved the processed photo without the RAW: \(error)")
            }
            return
        }
```

### Step
Build and run the app, and take a photo.

The Simulator has no RAW, so the fallback never runs there. A capture saves the photo as before. On an iPhone with a Pro camera, an Apple ProRAW capture now always gives a picture in Photos.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The app saves the photo and shows its thumbnail, as before. The console shows "Captured processed photo, N bytes" and "Saved asset ...".
Note: On an iPhone, when Photos refuses both RAW requests, the console shows "Saving to Photos failed: ... (code name)" two times, then "Saved asset ..." and "Saved the processed photo without the RAW: ...". Photos then has the processed photo without a RAW badge.
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

Add two `///` comment lines above it. The first is "Request a RAW photo along with the processed photo when the device supports the chosen format." The second is "The app saves the DNG, and it keeps the processed photo for the case that Photos refuses the DNG." The type of `rawType` is `OSType?`. It is `nil` when the choice is Off, or when the camera has no such format.

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-7
        if photoOutput.availablePhotoCodecTypes.contains(.hevc) {
            photoSettings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
        }
        
        /// Request a RAW photo along with the processed photo when the device supports the chosen format.
        /// The app saves the DNG, and it keeps the processed photo for the case that Photos refuses the DNG.
        let rawType = rawPixelFormat(for: features.rawFormat)
```

### Step
Below `rawType`, add `if let rawType` that replaces `photoSettings` with a settings object for RAW plus a processed photo.

Inside the `if`, first choose the codec in a constant `codec` of type `AVVideoCodecType`: `.hevc` when `photoOutput.availablePhotoCodecTypes` contains it, else `.jpeg`. Then assign `AVCapturePhotoSettings(rawPixelFormatType: rawType, processedFormat: [AVVideoCodecKey: codec])` to `photoSettings`, with `processedFormat:` on its own line. Last, log "Capturing with RAW format: " and `features.rawFormat.description` with `logger.debug`.

The initializer [`init(rawPixelFormatType:processedFormat:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:)) asks for the DNG and for a processed photo. If you pass `nil` for the processed format, you get the DNG only. The Camera app saves the DNG only, and this app saves the DNG alone too. It still asks for the processed photo, because the two fallbacks of the save need it. The processed photo needs a codec of its own. The Simulator has no HEVC, so JPEG is the fallback. The rest of the method (preview format, photo size) now works on the new settings object.

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

Above the line, add the constant `excludesLivePhoto`: it is `true` when `rawType != nil && features.rawFormat == .appleProRAW`. Add the comment "An Apple ProRAW capture can't include a Live Photo movie." above it. Then add `&& !excludesLivePhoto` to the condition of the existing line. Delete the old line.

If a Live Photo movie URL is in the settings of an Apple ProRAW capture, the photo output raises an exception. Swift `try` does not catch it, so the app would stop. This line protects the capture code itself. A later section also locks the Live Photo button, so the interface tells the same fact. A capture with Bayer RAW keeps the movie URL, because the SDK header allows it.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled ? URL.movieFileURL : nil
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=4-6
        }
        
        // Set the movie URL if the photo output supports Live Photo capture.
        // An Apple ProRAW capture can't include a Live Photo movie.
        let excludesLivePhoto = rawType != nil && features.rawFormat == .appleProRAW
        photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled && !excludesLivePhoto ? URL.movieFileURL : nil
```

### Step
In the code that sets the quality prioritization, skip the setter for a RAW capture, and log the choice of the person as "ignored for RAW".

Put a new `if rawType != nil` above the existing `if let prioritization`. In its body, log "Quality prioritization ", `features.qualityPrioritization.description`, and ": ignored for RAW" with `logger.debug`. Then change the old `if let` into an `else if let`, on the same line as the closing brace. Add the two new comment lines of the fence below the existing comment. Delete the old `if let` line.

The SDK header has two rules for a Bayer RAW request: the prioritization must be [`.speed`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/qualityprioritization/speed), and a violation throws an exception. A first version of this chapter therefore set `.speed` for Bayer RAW. On the iPhone, the app stopped at exactly that line, with the text "Unsupported when capturing RAW". So on this iOS version, the setter itself is the problem, whatever the value. The fix does not call the setter for a RAW request at all. An Apple ProRAW capture accepted the setter in the test, but one rule for both RAW kinds is simpler and safe. [`photoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization) then keeps its default. The menu keeps the choice of the person, and the next capture without RAW uses it again.

```swift file=AVCam/Capture/PhotoCapture.swift remove
        if let prioritization = AVCapturePhotoOutput.QualityPrioritization(rawValue: features.qualityPrioritization.rawValue) {
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=2-6
        // Set the priority of speed versus quality during this capture.
        // The photo output throws an exception at this setter for a Bayer RAW request, even with speed.
        // A RAW request of either kind keeps the default value, so one rule covers both formats.
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

## Send the choice, and lock Live Photo

The model has the choice of the person, but no capture uses it yet. In this section, `capturePhoto()` sends the RAW format to the capture code. An Apple ProRAW capture also cannot include a Live Photo movie. The capture code already drops the movie, but the Live Photo button would still show Live Photo as on. So the model tells the views when Live Photo is not available, and the button shows it. The choice of the person stays, so Live Photo comes back when RAW is Off again.

### Step
In `CameraModel.swift`, below `isLivePhotoEnabled`, add the computed property `isLivePhotoAvailable` of type `Bool`. It is `false` while the RAW format is Apple ProRAW.

The body is `rawFormat != .appleProRAW`, with the comment "An Apple ProRAW capture can't include a Live Photo movie." above it. Add the `///` comment "A Boolean value that indicates whether the current RAW format allows a Live Photo." above the property.

The property is internal, because the views read it through the `Camera` protocol. It is computed, so it is always in step with `rawFormat`, and it needs no storage. It does not change `isLivePhotoEnabled`. Bayer RAW does not lock Live Photo, because the SDK header has the movie rule only for Apple ProRAW.

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
> Seven tests on an iPhone 17 Pro Max with iOS 26 shaped this code. The verified result is the RAW+JPEG pair, the second request of the save. With Apple ProRAW, Photos showed one picture with the badge "JPG + RAW". The word is JPG, although the processed photo is a HEIF. Share > Options > Format: Unmodified Original gave the DNG. On the telephoto camera, the DNG was 8064x6048 (48 MP) and 54 MB. On the virtual back camera, it was 4032x3024 (12 MP) and about 15 MB. The first request, the DNG alone with its embedded preview, has not run on a device yet. If Photos accepts it, the console shows "RAW preview: JPEG ...", "Resource .photo: N bytes, file ....dng", "Saved asset ...", and "Saved the RAW as the DNG alone". Photos is then expected to show one picture with a "RAW" badge, as for a RAW photo of the Camera app. If Photos refuses it, the console shows "Saving to Photos failed: ... (code name)", "Photos refused the DNG alone. ...", the two "Resource" lines, "Saved asset ...", and "Saved the RAW as the processed photo with the DNG as alternate". While Apple ProRAW is chosen, the Live Photo button shows `livephoto.slash` and does not react. The "RAW" choice (Bayer RAW) shows only on a physical camera, such as the telephoto camera alone. A Bayer RAW capture with the fix of the prioritization has not run yet. The app starts with the camera that the system prefers. After a zoomed shot in the Camera app, the system can prefer the telephoto camera, and then the app starts with it.
```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the capture button
Result: The RAW menu is hidden in the Simulator. The Live Photo button works as before. A capture saves a normal photo and shows its thumbnail.
Note: On an iPhone with a Pro camera, an Apple ProRAW capture saves one picture: the DNG alone (expected, not yet tested), or the pair with the badge "JPG + RAW" (verified). The Live Photo button is off and disabled while Apple ProRAW is chosen.
```

### Experiment
On a real iPhone with a Pro camera, turn the Live Photo button on, then choose Apple ProRAW. The button now shows Live Photo as off. Take a photo, and read the "Resolved settings" line: the count is 2, and the proxy size is 0x0. Choose Off again: the button shows Live Photo as on, as you left it. Take a photo: deferred delivery is on again, and the count is 1. If the RAW menu offers "RAW", choose it, set the quality menu to "Quality", and take a photo. The console shows "Quality prioritization Quality: ignored for RAW", and the capture does not stop.

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

### A person chooses RAW in the menu. Quality is set to "Quality". Why does the code not set `photoQualityPrioritization` for this capture?

- [ ] RAW files are too large for the quality level, so the system would delay the save.
  > The size of the file is not the reason. The rule is about the capture request.
- [x] On the test iPhone, the photo output throws an exception at the setter for a Bayer RAW request, even with `.speed`, so the code keeps the default for every RAW request.
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
