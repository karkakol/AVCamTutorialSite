---
kind: article
chapter: 8
title: Concepts: RAW and Apple ProRAW
abstract: What a RAW photo is, how Bayer RAW differs from Apple ProRAW, why one capture gives two photos, how the app saves them in one asset, and which rules make a RAW request fail.
estimatedMinutes: 14
branch: chapter-08
---

A normal photo is a finished picture. The camera has chosen the white balance, the noise reduction, the tones, and the sharpness for you. A RAW photo keeps much more of what the sensor saw. A photo editor can then make these choices again, and it does not start from a picture that is already compressed.

In this chapter, the app gets a RAW control. When the person selects a RAW format, one tap gives a DNG file and the processed photo, and the app saves both in one asset in Photos. [Build: RAW and Apple ProRAW](ch08-build.md) is the tutorial for the code.

The chapters before this one used the code of the Apple sample. The sample has no RAW capture. Thus this chapter is part 2 code ("Beyond the sample") inside the numbering of part 1. The design is this tutorial's own, and it is one of several possible designs. This article explains the camera facts that each design must obey, then the decisions of this design, and what is still open.

> [!IMPORTANT]
> The Simulator with SimCam has no RAW format, so the RAW control is hidden there, and a capture gives a normal photo. Four rounds of RAW captures ran on a real iPhone with a Pro camera. Each round found a defect in the chapter or narrowed it down. Photos has not saved a RAW asset yet; the app then saves the processed photo alone. [What a device test showed](#what-a-device-test-showed) tells the story and the fixes. The other facts below come from the SDK headers, from the Apple documentation, and from a WWDC session. Where a statement is an expectation or a conclusion, the text says so.

## How it works

### What a RAW photo is

The sensor of a phone camera sees only one color at each pixel, in a mosaic pattern that is named a Bayer pattern. The camera then reconstructs a full-color picture. This step is named demosaicing. After it come the noise reduction, the tone curve, and the other steps. A normal photo is the result, and the camera cannot undo the steps.

A RAW photo is a file that stops earlier. It keeps the data in a form that the editor can still change. On an iPhone, the file is a **DNG** file (Digital Negative), a standard format for RAW images. Your camera app, a different app, or a computer can open it.

### One request, two photos

You ask for a RAW photo together with a processed photo. The camera uses one sensor image for both. The result is two photos, as the diagram shows.

![One capture request gives a DNG file and a processed HEIF photo. The delegate gets two calls, and the app saves both in one asset.](../images/ch08-raw-pipeline.svg)

This has a consequence for your code. The photo output calls [`photoOutput(_:didFinishProcessingPhoto:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:)) one time for each photo, so two times for this request. The SDK gives no order for the calls. Each call gets an [`AVCapturePhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto) object. The property [`isRawPhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/israwphoto) tells you which of the two you have.

There is no separate method for the DNG data. [`fileDataRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation()) gives the file for either photo: DNG data for the RAW photo, and compressed data for the processed photo. The last callback, `didFinishCaptureFor`, always comes after both photos. As in chapters 3 and 7, AVCam collects the results and reports them in that last callback.

### The two-level rule again

You know the rule from [chapter 3](ch03-concepts.md) and [chapter 7](ch07-concepts.md): you **enable** a feature on the [`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput) object, and you **select** a value in the [`AVCapturePhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings) object of each capture.

| | Level 1: the output | Level 2: the settings of one capture |
|---|---|---|
| Apple ProRAW | [`isAppleProRAWSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported) and [`isAppleProRAWEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled) | The RAW format that you choose from the list. |
| The list of RAW formats | [`availableRawPhotoPixelFormatTypes`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotopixelformattypes-9t9k5), read-only | [`init(rawPixelFormatType:processedFormat:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:)) takes one value of the list. |

Two facts make the rule strict here too:

- **The list is empty until the output is in a session with a video input.** Before that, no RAW format is available.
- **Enabling Apple ProRAW builds the capture pipeline again.** This takes time, so you set `isAppleProRAWEnabled` before the session starts. It may be `true` only when `isAppleProRAWSupported` is `true`. The value depends on the camera and the session configuration, so you set it again after each change of camera.

After you enable Apple ProRAW, the list holds both kinds of format. The Apple ProRAW formats come after the Bayer formats. You sort them with two class methods: [`isBayerRAWPixelFormat(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isbayerrawpixelformat(_:)) and [`isAppleProRAWPixelFormat(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawpixelformat(_:)).

This is the helper of the app. It returns the first format of the kind that the person chose, or `nil`:

```swift file=AVCam/Capture/PhotoCapture.swift
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

### One asset in Photos

You learned in [chapter 4](ch04-concepts.md) that a Photos asset has resources. The photo is one resource. A Live Photo adds a paired video as a second resource. For a RAW capture, the app adds the DNG as the `.photo` resource and the processed photo as the [`.alternatePhoto`](https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto) resource. Both go into one [`PHAssetCreationRequest`](https://developer.apple.com/documentation/photos/phassetcreationrequest) object. This is the order of Apple's article about RAW capture. Photos is expected to show one tile, with a RAW badge, and the person can export the original.

Each resource has a type of data, such as HEIF or DNG, and a file name. The options object [`PHAssetResourceCreationOptions`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions) can state both. If the options have no type, Photos infers it from the resource type or from the file name extension. So the app writes the DNG data to a file with the extension `.dng` and adds it with [`addResource(with:fileURL:options:)`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:)). [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile) moves the file into the library instead of copying it. It is the only option that the app sets, as in Apple's article. The processed photo has no options.

## What the camera can do

### Two kinds of RAW

| | Bayer RAW | Apple ProRAW |
|---|---|---|
| What it is | The sensor data, with no processing. | A DNG that the system has already demosaiced and partly processed. It still keeps much room for editing. |
| Which devices | Since iOS 10. Single cameras (a wide or a telephoto camera). | Since iOS 14.3. iPhone 12 Pro and later Pro models. Also the virtual cameras that join several lenses. |
| Quality prioritization | Must be `.speed`. | `.balanced` and `.quality` are allowed. |
| Zoom | The zoom factor must be 1.0. | No such rule. |
| Live Photo | The header allows it. | Not allowed: the movie URL must be `nil`. |
| File size | Not stated. | About 10 to 40 MB, and more for a complex scene. |

Apple ProRAW joins the two worlds. Like a normal photo, it has the work of the camera pipeline: it can use several frames, and it has the noise reduction. Like a RAW photo, it keeps a wide range of tones for the editor. The cost is a bigger file.

Do not select a format from the name of the device. Read the list. The list can hold none, one, or both kinds, and it can change when the person switches the camera. Apple ProRAW also needs a session configuration that supports the highest photo quality. AVCam uses the `.photo` preset, which does.

The pixel formats are `OSType` values, which are four-character codes. An Apple ProRAW format in the list looks like `l64r`. You do not need to know the codes. The two class methods sort them for you.

### Rules that make a request fail

When the settings of a capture break a rule, [`capturePhoto(with:delegate:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:)) raises an exception. Swift `try` does not catch it, and the app stops. This list comes from the SDK header.

| Rule | What the app does |
|---|---|
| The RAW format must be in `availableRawPhotoPixelFormatTypes`. | The helper reads only that list. |
| Bayer RAW needs `.speed` for the prioritization. | The code overrides the quality menu for this capture. |
| Bayer RAW needs a zoom factor of 1.0. | The app has no zoom control yet. A later chapter that adds one must reset the zoom before a Bayer capture. |
| Apple ProRAW needs `livePhotoMovieFileURL` to be `nil`. | The code leaves the movie URL out. |
| Constant color and RAW exclude each other. | The app has no constant color. |
| The processed format needs a codec. | The code gives HEVC, or JPEG when there is no HEVC. |

Constant color is a feature from iOS 18. It asks for a photo with colors that do not depend on the light, and it needs the flash. It is not in AVCam. If you add it, the choice of constant color must turn the RAW control to Off.

### Deferred delivery and RAW

In chapter 7, you turned on deferred photo delivery. The photo output can then give a proxy instead of a finished photo. The proxy class [`AVCaptureDeferredPhotoProxy`](https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy) has the property `isRawPhoto`, and its value is always `false`: the system cannot defer a RAW photo.

The SDK does not say what a RAW request does when deferred delivery is on. A test on a real iPhone gave the answer for one device: no RAW photo arrived. So the app turns deferred delivery off while a RAW format is chosen, and on again when the choice is Off. [`isAutoDeferredPhotoDeliveryEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled) is a property of the output, not of one capture. Each change makes the pipeline build again, which takes time. Thus the app changes it when the person picks a RAW choice, not when the person takes the photo.

### What the app does not use

The photo output offers more than AVCam uses. These are the main points:

| Capability | What it does | In this tutorial |
|---|---|---|
| Smaller DNG files | Since iOS 18, the settings can set the bit depth of the DNG and a lossy compression, through the `rawFileFormat` property of the settings. | Not in AVCam |
| A preview inside the DNG | The settings can ask for a JPEG preview inside the DNG file, through `rawEmbeddedThumbnailPhotoFormat`. Other apps show the preview. | Not in AVCam |
| RAW size | `rawPhotoDimensions` in the resolved settings gives the size of the RAW photo. The size follows the [`maxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotodimensions) that you know from chapter 3. | The "Resolved settings" log line shows it |
| Prepared settings | [`setPreparedPhotoSettingsArray(_:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:)) prepares the buffers of a RAW request before the first capture. | Not in AVCam |
| Constant color | A photo with stable colors, with a fallback photo. [`isConstantColorSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorsupported) | Not in AVCam |

## Why AVCam does it this way

**One asset, the DNG as the photo.** The app saves the DNG file as `.photo` and the processed photo as `.alternatePhoto`, in one request. One tile in the library is easier for a person than two. The processed photo travels with the DNG, so the person can still share an ordinary picture.

**An open question about the order.** The sources do not agree. The Apple documentation page for `.alternatePhoto` says that the alternate photo is the RAW file, and that the JPEG is the primary form of the asset. The headers of the iOS 27 SDK use the same model: they speak of "RAW+JPEG assets" and of assets "that have a RAW alternate". Apple's article about RAW capture uses the opposite order: the DNG is the `.photo`, and the HEIF is the alternate. The article gives the DNG as a file with the extension `.dng`. A third answer comes from WWDC session 10160: it says that the model "RAW plus JPEG" is not recommended for Apple ProRAW, and it advises one DNG with a full-size JPEG preview inside. The first version of this chapter followed the article, but with the DNG as `Data`, and the second device test saved nothing. The second version followed the documentation and the headers, and Photos refused it with error 3300 in the third test (see below). The chapter now follows the article exactly: the DNG is a `.dng` file, and the processed photo is the alternate. This is the only one of the three sources that shows complete code for this save. A fourth test on a real iPhone confirms it. The notes under "What nobody tested" say what to look for.

**A fallback to the processed photo.** If Photos refuses the pair, the app saves the processed photo alone, and it logs why. A person who takes a photo expects a picture. Without the fallback, a refused pair loses the whole capture, as in the second and third tests. The fallback is in a section of its own on the build page, because it makes the app robust but does not change how the RAW save works.

**Always a processed photo.** The RAW request always has a processed format. Without it, the request would give the DNG alone, and the delegate could never fill `photoData`. The codec is HEVC when the output offers it, else JPEG. The Simulator has no HEVC, so the JPEG case matters there.

**One list, one test.** The flags `isAppleProRAWSupported` and `isBayerRAWSupported` of `CaptureCapabilities` come from `rawPixelFormat(for:)`. They do not come from `photoOutput.isAppleProRAWSupported`. Thus the interface and the capture use the same test. The interface shows a format only if a capture can request it.

**The rules stay in the capture code.** The Bayer override and the Live Photo exclusion are in `createPhotoSettings(with:)`, not in the views. The person keeps the quality menu and the Live Photo button as they are. For one capture, the code ignores a value that the format does not allow. The cost: a person who selects Quality and Bayer RAW does not get Quality. A different design could disable the menu while RAW is on.

**A fallback at three places.** If the device offers no RAW, three things protect the app. The menu is hidden when the list has only Off. After a camera switch, `CameraModel` sets the choice back to Off if the new camera does not support it. `rawPixelFormat(for:)` returns `nil`, and then the code takes the normal path. In the Simulator, this is what happens: the RAW control is hidden, and a capture saves a normal photo.

**Bayer RAW only on a physical camera.** Bayer RAW is the data of one sensor, so only a physical camera has it. The WWDC session 10160 says that Bayer RAW works only with single cameras, such as the wide or the telephoto camera. The SDK header says that Apple ProRAW exists for modes that have no Bayer RAW, such as the modes that fuse several captures. Chapter 2 asks for the dual camera first on the back, and the dual camera is a virtual device. So on an iPhone with a telephoto camera, the menu offers Off and Apple ProRAW only. On an iPhone with no telephoto camera, the back camera is the physical wide camera, and RAW can show. The app keeps this behavior. A different design could switch to the physical wide camera while the person chooses RAW. That design needs a second camera path, it loses the lens change of the dual camera, and the app cannot know before the switch if the wide camera has Bayer RAW. For a first RAW chapter, a menu that shows what the current camera offers is simpler and honest.

**Types of the app in the model.** As in chapter 7, the views and the model use `RAWFormat`, not an AVFoundation type. The raw values of `RAWFormat` are the app's own: they are not the values of the pixel formats.

### What nobody tested

These points need a real iPhone with a Pro camera. Read each one as an expectation.

- **The menu and the formats.** On the virtual back camera, the menu shows Off and Apple ProRAW only (seen on one iPhone with a Pro camera). Whether the front camera offers RAW is not known. The log line "RAW on ..." tells it for each camera.
- **The photo in Photos.** The console must show "Saved asset ..." without "Saved the processed photo without the RAW". The asset is expected to have a RAW badge, and the export of the unmodified original is expected to give the DNG. If the console shows "Saving to Photos failed: ...", the code name tells what Photos refused, and the fallback saves the processed photo alone.
- **RAW with deferred delivery off.** Confirmed by the second test: "Resolved settings: 2 photos" with a RAW size of 4032x3024, and "Captured RAW photo" with about 14 MB.
- **Live Photo with Bayer RAW.** The header allows it. If a device shows a problem, remove the movie URL for both formats.
- **The size.** The photo size stays at the largest value, so a DNG can be very big. The log line "Captured RAW photo" shows the size.
- **The speed of normal photos.** `isAppleProRAWEnabled` changes the capture pipeline. Check that a normal photo is still as fast.
- **An error on one of the two photos.** If the RAW photo fails and the processed photo works, the delegate logs the error. The save then has the processed photo alone, or no data, and `noPhotoData` is the result.

## What a device test showed

The chapter ran four times on a real iPhone with a Pro camera. The first test found one defect and confirmed one limit. The second test, after the first fix, found a second defect. The third test showed the error that the second test hid. The fourth test showed that Photos names the DNG file in that error. The cause is not known yet.

### The symptom

The person chose Apple ProRAW and took a photo. The Xcode console showed "Capturing with RAW format: Apple ProRAW", and then no other RAW line. The line "Captured RAW photo, N bytes" did not come, and no error line came. Photos got a plain HEIF photo with no RAW badge.

### The cause

Chapter 7 turned on automatic deferred photo delivery. With it, the photo output can send a proxy through `photoOutput(_:didFinishCapturingDeferredPhotoProxy:error:)` instead of a finished photo through `didFinishProcessingPhoto`. The SDK header says that deferred processing is not available for RAW photos. On the test device, the RAW request gave the proxy and no RAW photo at all. The app saved the proxy, and Photos finished it as a HEIF. The header does not describe this exact result, so it is a test result for one device. The conclusion is still safe for every device: RAW and deferred delivery do not go together.

### The fix

- `PhotoCapture` keeps the RAW choice, and `updateDeferredPhotoDelivery()` turns deferred delivery on only when the choice is Off. `CameraModel` sends each new choice through `CaptureService.setRAWFormat(_:)`, inside a configuration pair.
- `MediaLibrary.save(photo:)` makes a RAW pair only with a finished photo. Proxy data is valid only as a `.photoProxy` resource, so it must never be the `.alternatePhoto` of a DNG.
- New log lines show what the output decides: "RAW on ..." and "Deferred photo delivery (supported/enabled): ..." after each camera setup, "Resolved settings: ..." at the start of each capture, and "Captured deferred photo proxy, N bytes" for each proxy.

### The second test: the RAW photo arrives, Photos gets nothing

The iPhone has a "Back Triple Camera", so it is a Pro model. After the first fix, the console showed what the fix promised. At the start, deferred delivery was "true/true". The back camera was virtual and offered Apple ProRAW but no Bayer RAW. After the choice of Apple ProRAW, deferred delivery was "true/false". Each of three captures showed "Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0" and "Captured RAW photo" with 14 to 15 MB. No error line came. But none of the three photos reached the Photos library.

### The cause of the second defect

The capture side was complete. The SDK header says that `didFinishCaptureFor` always comes last, after both calls of `didFinishProcessingPhoto`. The processed photo had no error, because the delegate logs each error and the console showed none. So the `Photo` value had both the processed data and the DNG. Access to Photos was not the cause either: the same `save(photo:)` method saved the normal photos of the first test.

That leaves the save. Two pieces of code hid its error. `MediaLibrary.performChange(_:)` replaced each error from Photos with `MediaLibrary.Error.saveFailed`, and `CameraModel.capturePhoto()` stored the error in a property that no view reads. Neither one logged it. The SDK header of `PHAssetCreationRequest` says that `addResource` always succeeds, and that Photos checks the request only in `performChanges`. So a refused request is silent unless the app logs the error.

The request of the first version was unlike every model that Apple describes. The DNG was the `.photo` resource as `Data` with no type and no file name, so Photos had to guess its type from the resource type. The HEIF was the `.alternatePhoto` resource, which the documentation reserves for the RAW file. Apple's article uses the same order, but it gives the DNG as a `.dng` file. The most likely cause is that Photos refused this request. No log line proves it, so the third test confirms it.

### The second fix

- `MediaLibrary.save(photo:)` saved the processed photo as `.photo` and the DNG as `.alternatePhoto`, the order of the documentation. The options of the DNG set `contentType` to `UTType.dng`. The third test showed that Photos refuses this request too; the third fix replaces it.
- `MediaLibrary.performChange(_:)` logs "Saved asset <identifier>" for each new asset, and "Saving to Photos failed: <error>" with the error from Photos.
- `CameraModel.capturePhoto()` logs "Photo capture failed: <error>" for each error of the capture or the save.
- The delegate logs "Captured processed photo, N bytes", so the console shows both photos of a RAW capture.

### The third test: Photos refuses the pair

The iPhone is an iPhone 17 Pro Max with a "Back Triple Camera". The person chose Apple ProRAW and took four photos. Each capture showed the same lines:

```text
Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0
Captured RAW photo, 14378684 bytes
Captured processed photo, 1671447 bytes
Saving to Photos failed: Error Domain=PHPhotosErrorDomain Code=3300 "(null)"
Photo capture failed: AVCam.MediaLibrary.Error.saveFailed
```

So both photos arrived, and the new log lines showed the error that the second test hid. Photos refused the request with the processed photo as `.photo` (from `Data`) and the DNG as `.alternatePhoto` (from `Data`, with `contentType` set to `UTType.dng`). A capture with RAW set to Off saved as before: "Saved asset ...", through the proxy path, with a photo of 5712x4284.

### What error 3300 means

The error has no text, only the code. The SDK header `PHError.h` gives the meaning: 3300 is `PHPhotosErrorChangeNotSupported`, "The change request is not supported as configured". In Swift, it is `PHPhotosError.Code.changeNotSupported`. It is not the code for bad data: that is 3302, `invalidResource`, "Asset resource validation failed". So Photos did not refuse the bytes of the DNG or of the HEIF. It refused the request as the app configured it: the resource types, their order, and how the app gave the data. The header does not say which part. The documentation of `.alternatePhoto` describes a JPEG as the primary photo and a RAW file as the alternate, but Photos did not accept that request from this app.

Two requests have now failed: the DNG as `.photo` from `Data` with no type (second test), and the DNG as `.alternatePhoto` from `Data` with a type (third test). Neither one is the request of Apple's article. The article gives the DNG as a file with the `.dng` extension.

### The third fix

- `MediaLibrary` writes the DNG data to a temporary file `<UUID>.dng` (`URL.rawFileURL`) and adds it as `.photo` with `addResource(with:fileURL:options:)` and `shouldMoveFile`. It adds the processed photo as `.alternatePhoto` from `Data`. This is the code of Apple's article.
- Each resource has a file name with the same base name, and a type identifier: `com.adobe.raw-image` for the DNG, and `public.heic` or `public.jpeg` for the processed photo. The app reads the type of the processed photo from its data with `CGImageSource`.
- Before the request, the console shows one line for each resource: the resource type, the size, the type identifier, and the file name. A line before them tells if `PHAssetCreationRequest.supportsAssetResourceTypes(_:)` accepts the pair `.photo` with `.alternatePhoto`.
- "Saving to Photos failed" now ends with the name of the code, for example "(changeNotSupported)". The error `saveFailed` carries the reason, so "Photo capture failed" shows it too.

The extension `.dng` matters, because Photos infers the type from the file name extension when the options do not state it. The article sets no options except `shouldMoveFile`. This app states the name and the type in addition, so Photos does not need to guess.

### The fallback

If Photos still refuses the pair, the app saves the processed photo alone in a second request. The console then shows "Saving to Photos failed: ... (code name)", "Saved asset ...", and "Saved the processed photo without the RAW: ..." with the error. The person gets a picture without a RAW badge. Only if the second request fails too does "Photo capture failed: ..." come. The DNG file is removed from the temporary directory in each case.

### The fourth test: the article's file, refused again

The same iPhone 17 Pro Max, Apple ProRAW. The build of the third fix showed these lines (the identifiers are shortened):

```text
Captured RAW photo, 15584824 bytes
Captured processed photo, 2014683 bytes
RAW pair, .photo with .alternatePhoto supported: true
Resource .photo: 15584824 bytes, com.adobe.raw-image, file 9A7ED4CC-....dng
Resource .alternatePhoto: 2014683 bytes, public.heic, file 9A7ED4CC-....heic
Saving to Photos failed: Error Domain=PHPhotosErrorDomain Code=3300 "(null)" UserInfo={_PHResourceUrlsErrorKey=("file:///private/var/mobile/.../tmp/9A7ED4CC-....dng")} (changeNotSupported)
Saved asset B057858A-.../L0/001
Saved the processed photo without the RAW: ...
```

These facts are now known:

- Photos supports the pair `.photo` with `.alternatePhoto`. `supportsAssetResourceTypes(_:)` returned `true`.
- Both resources were in the request, with the expected sizes.
- The error is 3300 again. This time it has a key in its user info that lists one URL: the DNG file. So Photos names the DNG resource as the part that it does not accept.
- The fallback works. Photos saved the processed photo alone, so the HEIF data is good.

Error 3300 now came for two requests: the HEIF as the main photo with the DNG data as the alternate, and the DNG file as the main photo with the HEIF data as the alternate. The DNG was in both requests. A HEIF alone always saves.

### What the cause can be

The request of the fourth test was not exactly the article's request. It set a file name and a type identifier for both resources. The article sets only `shouldMoveFile`. These candidates remain:

- **The options.** The added file names and type identifiers are the only difference from the article. The third test failed without file names, so this is not a likely cause. But it is the one difference that is easy to remove.
- **The DNG data.** The type `com.adobe.raw-image` in the log line was a constant in the code, not a value read from the data. Nothing proved that the data of `fileDataRepresentation()` is a DNG that Photos can read. The settings name no RAW file type, and the SDK header says that the photo output then chooses a default container. The documentation says that this container is DNG.
- **The file and the move.** Not likely. The Live Photo movie uses the same temporary directory and `shouldMoveFile`, and Photos takes it. The third test used `Data`, not a file, and failed too.
- **The photo size.** Not likely. The resolved settings gave 4032x3024 for both photos.

The current hypothesis: Photos refuses the DNG resource itself, because it does not accept the DNG data or its options as the RAW of a pair. The fifth test separates the two parts.

### The fourth fix

- The request is now the article's request without additions: the DNG file as `.photo` with only `shouldMoveFile`, and the processed photo as `.alternatePhoto` with no options. The app keeps only the location of the asset, which every normal save also sets.
- Before the save, the console shows "RAW data: N bytes, header ..., type ..., images ...". The header is the first 4 bytes in hexadecimal. A DNG has the structure of a TIFF file, so the header is `49 49 2A 00` or `4D 4D 00 2A`. The type and the number of images come from Image I/O (`CGImageSourceGetType` and `CGImageSourceGetCount`). A DNG that the system can read gives `com.adobe.raw-image` and at least 1 image.
- The line "Resource .alternatePhoto" shows the type and the number of images that Image I/O finds in the processed data.
- The capture logs "RAW file types: ..." with `availableRawPhotoFileTypes` of the photo output. The settings still use the short initializer, as the article does, so the output chooses the container. The value for DNG is `com.adobe.raw-image`.

If the header, the type, or the number of images is wrong, the DNG data is the cause, and the capture settings must change. If the data is a good DNG and Photos still refuses the pair, the next step is a save of the DNG alone (one asset with the DNG as `.photo`). That test shows whether Photos refuses the DNG or the pair.

### What the console shows now

When the person picks Apple ProRAW, the console shows "Deferred photo delivery (supported/enabled): true/false". A capture then shows "Capturing with RAW format: Apple ProRAW", "Resolved settings: 2 photos, ..." with a RAW size that is not 0x0 and a proxy size of 0x0, "Captured RAW photo, N bytes", "Captured processed photo, N bytes". Then the save shows "RAW data: N bytes, header 49 49 2A 00, type com.adobe.raw-image, images 1" (or the header `4D 4D 00 2A`), "RAW pair, .photo with .alternatePhoto supported: true", "Resource .photo: N bytes, file <UUID>.dng", "Resource .alternatePhoto: N bytes, type public.heic, images 1", and "Saved asset ...". Before the save, the capture shows "RAW file types: com.adobe.raw-image". If Photos refuses the pair, "Saving to Photos failed: ... (code name)" comes first, then "Saved asset ..." and "Saved the processed photo without the RAW: ..." for the fallback. When the person picks Off again, the console shows "true/true", and a normal capture can show "Captured deferred photo proxy" again.

### What to expect in Photos

Photos is expected to show one asset with a RAW badge. The command File > Export > Export Unmodified Original on a Mac, or the export of the original on the iPhone, is expected to give the DNG file. This part is an expectation until a test confirms it. Four tests have not saved a RAW asset yet. Because the DNG is the main photo, the export of the unmodified original is expected to give the `.dng` file, and maybe the `.heic` file too. If the fallback runs, Photos shows the processed photo without a RAW badge, and the code name decides the next design, for example two assets.

### Bayer RAW on a virtual camera

The same test showed only Off and Apple ProRAW in the menu. This is correct, not a defect. The back camera of the app is the virtual dual camera, and Bayer RAW exists only on a physical camera. See "Bayer RAW only on a physical camera" above for the reason, and why the app does not switch the camera for RAW.

## Common mistakes

- **You write `photoData = photo.fileDataRepresentation()` for each call.** A RAW capture calls the method twice, so the second call replaces the first. Test `isRawPhoto`.
- **You request RAW without reading the list.** A format that is not in `availableRawPhotoPixelFormatTypes` raises an exception.
- **You read the list before the output is in a session.** The list is empty, and you conclude that the device has no RAW.
- **You forget `isAppleProRAWEnabled`.** The list then has Bayer formats only, and Apple ProRAW never shows.
- **You enable Apple ProRAW after `startRunning()`.** The pipeline builds again while the session runs. Do it before the start, and again after a change of camera.
- **You use the quality menu for Bayer RAW.** Any value but `.speed` raises an exception.
- **You set a Live Photo movie URL with Apple ProRAW.** The photo output raises an exception.
- **You hide the error of `performChanges`.** Photos checks a creation request only when it performs the change. If your code replaces or drops that error, a refused asset leaves no trace. Log it.
- **You give a DNG as `Data`.** Photos then must infer the type, and a device test showed error 3300 even with `contentType` set to `UTType.dng`. Write the DNG to a file with the extension `.dng`, add it as `.photo` with a file URL, and add the processed photo as `.alternatePhoto`, as Apple's article does.
- **You lose the capture when Photos refuses the pair.** A refused request saves nothing. Save the processed photo alone as a fallback, and log the Photos error with the name of its code.
- **You leave deferred delivery on for RAW.** The output can then give a proxy and no RAW photo. Turn `isAutoDeferredPhotoDeliveryEnabled` off while a RAW format is chosen.
- **You look for Bayer RAW on a virtual camera.** The dual and triple cameras offer Apple ProRAW only. Bayer RAW needs a physical camera.
- **You request RAW with no processed format.** You get the DNG alone, and your delegate waits for a photo that never comes.
- **You test the Simulator and trust it.** The Simulator has no RAW. A working Simulator build says nothing about the RAW path.
- **You offer constant color and RAW together.** They exclude each other.
- **You use the symbol `camera.raw`.** It does not exist. This app uses `r.square` and `r.square.fill`.

## Documentation

```links
Capturing photos in RAW and Apple ProRAW formats | https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats | The Apple article for this chapter, with its save code.
AVCapturePhotoOutput | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput | The photo output, with the RAW properties.
isAppleProRAWSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported | Whether the configuration supports Apple ProRAW.
isAppleProRAWEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled | The switch that adds the Apple ProRAW formats to the list.
availableRawPhotoPixelFormatTypes | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotopixelformattypes-9t9k5 | The list of RAW formats that the output offers.
isBayerRAWPixelFormat(_:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isbayerrawpixelformat(_:) | The test for a Bayer RAW format.
isAppleProRAWPixelFormat(_:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawpixelformat(_:) | The test for an Apple ProRAW format.
init(rawPixelFormatType:processedFormat:) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:) | The settings for RAW plus a processed photo.
rawPhotoPixelFormatType | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/rawphotopixelformattype | The RAW format of a settings object.
isRawPhoto | https://developer.apple.com/documentation/avfoundation/avcapturephoto/israwphoto | The test that tells a RAW photo from a processed photo.
fileDataRepresentation() | https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation() | The file data of a photo, DNG for a RAW photo.
photoOutput(_:didFinishProcessingPhoto:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:) | The callback that you get once for each photo.
AVCaptureDeferredPhotoProxy | https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy | The proxy of a deferred photo, which is never RAW.
isAutoDeferredPhotoDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled | The switch for deferred delivery, which the app turns off for RAW.
AVCaptureResolvedPhotoSettings | https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings | What the output decides for one capture: the photo count and the sizes.
isVirtualDevice | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvirtualdevice | Whether a camera joins several physical cameras.
setPreparedPhotoSettingsArray(_:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:) | Prepare the buffers of a RAW request.
isConstantColorSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorsupported | The constant color feature, which cannot combine with RAW.
PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest | The request that saves an asset with several resources.
PHAssetResourceType.alternatePhoto | https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto | The resource type for the RAW file of a RAW plus JPEG asset.
PHAssetResourceCreationOptions.contentType | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/contenttype | The type of the data of a resource, such as DNG.
UTType.dng | https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/dng | The type identifier of a DNG file.
WWDC21: Capture and process ProRAW images | https://developer.apple.com/videos/play/wwdc2021/10160/ | The session about Apple ProRAW, with the advice on how to save it.
Build: RAW and Apple ProRAW | ch08-build.md | The tutorial for this chapter.
```
