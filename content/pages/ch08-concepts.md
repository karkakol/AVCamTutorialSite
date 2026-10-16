---
kind: article
chapter: 8
title: Concepts: RAW and Apple ProRAW
abstract: What a RAW photo is, how Bayer RAW differs from Apple ProRAW, why one capture gives two photos, how the app saves them in one asset, and which rules make a RAW request fail.
estimatedMinutes: 14
branch: chapter-08
---

A normal photo is a finished picture. The camera has chosen the white balance, the noise reduction, the tones, and the sharpness for you. A RAW photo keeps much more of what the sensor saw. A photo editor can then make these choices again, and it does not start from a picture that is already compressed.

In this chapter, the app gets a RAW control. When the person selects a RAW format, one tap gives a DNG file and the processed photo. The app saves the DNG in Photos, as the Camera app does, and it keeps the processed photo for the case that Photos refuses the DNG. [Build: RAW and Apple ProRAW](ch08-build.md) is the tutorial for the code.

The chapters before this one used the code of the Apple sample. The sample has no RAW capture. Thus this chapter is part 2 code ("Beyond the sample") inside the numbering of part 1. The design is this tutorial's own, and it is one of several possible designs. This article explains the camera facts that each design must obey, then the decisions of this design, and what is still open.

> [!IMPORTANT]
> The Simulator with SimCam has no RAW format, so the RAW control is hidden there, and a capture gives a normal photo. The RAW code of this chapter ran in seven rounds on an iPhone 17 Pro Max. Each round found a defect or a rule. The tests verified one way to save an Apple ProRAW capture as one picture in Photos: the RAW+JPEG pair. The final code first tries the model of the Camera app, the DNG alone, which has not run on a device yet, and it falls back to the verified pair. [What the device tests showed](#what-the-device-tests-showed) tells the story. The other facts below come from the SDK headers, from the Apple documentation, and from a WWDC session. Where a statement is an expectation or a conclusion, the text says so.

## How it works

### What a RAW photo is

The sensor of a phone camera sees only one color at each pixel, in a mosaic pattern that is named a Bayer pattern. The camera then reconstructs a full-color picture. This step is named demosaicing. After it come the noise reduction, the tone curve, and the other steps. A normal photo is the result, and the camera cannot undo the steps.

A RAW photo is a file that stops earlier. It keeps the data in a form that the editor can still change. On an iPhone, the file is a **DNG** file (Digital Negative), a standard format for RAW images. Your camera app, a different app, or a computer can open it.

### One request, two photos

You ask for a RAW photo together with a processed photo. The camera uses one sensor image for both. The result is two photos, as the diagram shows.

![One capture request gives a DNG file and a processed HEIF photo. The delegate gets two calls. The app saves the DNG alone, and the pair of HEIF and DNG if Photos refuses it.](../images/ch08-raw-pipeline.svg)

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

You learned in [chapter 4](ch04-concepts.md) that a Photos asset has resources. The photo is one resource. A Live Photo adds a paired video as a second resource. For a RAW capture, two models exist, and both give one picture in the library.

| | The Camera app model | The RAW+JPEG model |
|---|---|---|
| Resources | The DNG alone, as the `.photo` resource. | The processed photo as `.photo`, and the DNG as [`.alternatePhoto`](https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto). |
| What Photos shows | The full-size JPEG preview inside the DNG. Expected badge: "RAW". | The processed photo, with the badge "JPG + RAW" (seen on the test iPhone, also for a HEIF). |
| What other apps get | The DNG, or its preview. | The processed photo. Share > Options > Format: Unmodified Original gives the DNG. |
| Source | WWDC21 session 10160 advises it for Apple ProRAW. | The documentation of `.alternatePhoto` and the iOS 27 headers describe it. |
| On the test iPhone | Not tested yet. | Saved. |

The app uses the Camera app model first, and the RAW+JPEG model as its fallback. Both go through one [`PHAssetCreationRequest`](https://developer.apple.com/documentation/photos/phassetcreationrequest) object each.

Each resource has a type of data, such as HEIF or DNG, and a file name. The options object [`PHAssetResourceCreationOptions`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions) can state both. If the options have no type, Photos infers it from the resource type or from the file name extension. A resource type does not say "DNG". So the app writes the DNG data to a temporary file with the extension `.dng` and adds it with [`addResource(with:fileURL:options:)`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:)). [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile) moves the file into the library instead of copying it. It is the only option that the app sets. Photos moves the file only when it creates the asset, so after a refused request the file is still there for the fallback. In the pair, the processed photo comes from `Data` and has no options.

The preview inside the DNG comes from the capture settings: `rawEmbeddedThumbnailPhotoFormat` asks for a JPEG at the size of the photo. The SDK header says that a DNG can hold a preview up to the full size of the RAW image since iOS 12.

## What the camera can do

### Two kinds of RAW

| | Bayer RAW | Apple ProRAW |
|---|---|---|
| What it is | The sensor data, with no processing. | A DNG that the system has already demosaiced and partly processed. It still keeps much room for editing. |
| Which devices | Since iOS 10. Single cameras (a wide or a telephoto camera). | Since iOS 14.3. iPhone 12 Pro and later Pro models. Also the virtual cameras that join several lenses. |
| Quality prioritization | The header says `.speed`. On the test iPhone, the setter itself raised an exception, so the app does not set it. | `.balanced` and `.quality` are allowed. |
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
| Bayer RAW needs `.speed` for the prioritization. On the test iPhone, the setter raised an exception even with `.speed`. | The code does not call the setter for a RAW request. |
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
| A preview inside the DNG | The settings can ask for a JPEG preview inside the DNG file, through `rawEmbeddedThumbnailPhotoFormat`. Other apps show the preview. | AVCam asks for a full-size JPEG preview |
| RAW size | `rawPhotoDimensions` in the resolved settings gives the size of the RAW photo. The size follows the [`maxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotodimensions) that you know from chapter 3. | The "Resolved settings" log line shows it |
| Prepared settings | [`setPreparedPhotoSettingsArray(_:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:)) prepares the buffers of a RAW request before the first capture. | Not in AVCam |
| Constant color | A photo with stable colors, with a fallback photo. [`isConstantColorSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorsupported) | Not in AVCam |

## Why AVCam does it this way

**The Camera app model first.** The person chose RAW, so the app saves what the Camera app saves: one DNG with a full-size preview. Photos and other apps show the preview, and an editor gets the RAW data. The DNG is the only file, so the library does not store a second photo of the same moment. WWDC21 session 10160 advises this model for Apple ProRAW, and it does not recommend "RAW plus JPEG" for Apple ProRAW. This request has not run on a device yet. In the matrix test of round 6, the pair saved first, so the DNG alone never ran.

**The verified pair as the fallback.** If Photos refuses the DNG alone, the app saves the processed photo as `.photo` and the DNG file as `.alternatePhoto`. This is the only RAW request that saved on the test iPhone. The sources do not agree on the order: the documentation and the iOS 27 headers use this order, and Apple's article about RAW capture uses the opposite order (the DNG as `.photo`). Photos refused the article's exact request with error 3300 on the test iPhone.

**The capture still asks for a processed photo.** The Camera app model needs only the DNG, and `processedFormat: nil` would give it. The app still asks for the processed photo, because the two fallbacks need it. The cost is the time and the memory for a second photo. When the device tests show that the DNG alone always saves, a later version can drop the processed photo.

**No `originalResourceChoice`.** The iOS 27 SDK adds [`originalResourceChoice`](https://developer.apple.com/documentation/photos/phassetcreationrequest/originalresourcechoice) to the creation request. It selects whether the RAW or the compressed resource of a RAW+JPEG asset is the base for edits, and its default is the compressed resource. The test iPhone had iOS 26, so the property was not set in the test, and the pair saved without it. The chapter leaves it out. A line that no test ran could make Photos refuse the pair on iOS 27, and then the last fallback would lose the DNG.

**A last fallback to the processed photo.** If Photos refuses the DNG alone and the pair, the app saves the processed photo alone, and it logs why. A person who takes a photo expects a picture. Without the fallback, a refused pair loses the whole capture, as in the early tests. The fallback is in a section of its own on the build page, because it makes the app robust but does not change how the RAW save works.

**Always a processed photo.** The RAW request always has a processed format. Without it, the request would give the DNG alone, the delegate could never fill `photoData`, and the fallbacks would have nothing to save. The codec is HEVC when the output offers it, else JPEG. The Simulator has no HEVC, so the JPEG case matters there.

**One list, one test.** The flags `isAppleProRAWSupported` and `isBayerRAWSupported` of `CaptureCapabilities` come from `rawPixelFormat(for:)`. They do not come from `photoOutput.isAppleProRAWSupported`. Thus the interface and the capture use the same test. The interface shows a format only if a capture can request it.

**The rules stay in the capture code, and the interface tells them.** The prioritization rule and the Live Photo rule are in `createPhotoSettings(with:)`. For a RAW capture, the code does not set the prioritization, and it logs the choice of the person as "ignored for RAW". For Apple ProRAW, the code leaves the movie URL out. The Live Photo button also shows Live Photo as off and is disabled while Apple ProRAW is chosen, so the interface does not promise a movie. The values of the person stay in the model, and they come back when RAW is Off. The cost: a person who selects Quality and RAW does not get Quality. A different design could disable the quality menu while RAW is on.

**A fallback at three places.** If the device offers no RAW, three things protect the app. The menu is hidden when the list has only Off. After a camera switch, `CameraModel` sets the choice back to Off if the new camera does not support it. `rawPixelFormat(for:)` returns `nil`, and then the code takes the normal path. In the Simulator, this is what happens: the RAW control is hidden, and a capture saves a normal photo.

**Bayer RAW only on a physical camera.** Bayer RAW is the data of one sensor, so only a physical camera has it. The WWDC session 10160 says that Bayer RAW works only with single cameras, such as the wide or the telephoto camera. The SDK header says that Apple ProRAW exists for modes that have no Bayer RAW, such as the modes that fuse several captures. The app starts with the camera that the system prefers, and chapter 2 falls back to the dual camera, which is a virtual device. On a virtual camera, the menu offers Off and Apple ProRAW only. On a physical camera, RAW can show too. The device test showed both: with the "Back Triple Camera" the menu had no RAW, and with the "Back Telephoto Camera" it had. The system preferred the telephoto camera after a zoomed shot in the Camera app. The app keeps this behavior. A different design could switch to the physical wide camera while the person chooses RAW. That design needs a second camera path, it loses the lens change of the dual camera, and the app cannot know before the switch if the wide camera has Bayer RAW. For a first RAW chapter, a menu that shows what the current camera offers is simpler and honest.

**Types of the app in the model.** As in chapter 7, the views and the model use `RAWFormat`, not an AVFoundation type. The raw values of `RAWFormat` are the app's own: they are not the values of the pixel formats.

### What nobody tested

These points still need a real iPhone. Read each one as an expectation.

- **The DNG alone.** The first request of the save has not run on a device. Round 7 tests it for Apple ProRAW and for Bayer RAW. Expected: "Saved the RAW as the DNG alone", and one picture with a "RAW" badge.
- **The embedded preview.** The size and the codec of the preview are from the header. The line "RAW preview: JPEG ..." shows the request; the DNG shows what the output made.
- **A complete Bayer RAW capture.** The first Bayer RAW capture stopped at the prioritization setter. The fix does not call the setter. A Bayer RAW capture with the fix has not run yet.
- **Live Photo with Bayer RAW.** The header allows it. The RAW save does not add the movie, so the movie is lost. If a device shows a problem, remove the movie URL for both formats.
- **The front camera.** Whether it offers RAW is not known. The log line "RAW on ..." tells it for each camera.
- **iOS 27.** All tests ran on iOS 26. The save has no iOS 27 code, so it is expected to work the same.
- **An error on one of the two photos.** If the RAW photo fails and the processed photo works, the delegate logs the error. The save then has the processed photo alone, or no data, and `noPhotoData` is the result.

## What the device tests showed

The chapter ran seven times on an iPhone 17 Pro Max with iOS 26. Six findings came out of these rounds. Each finding has a symptom, a cause, and a fix in the code.

### 1. Deferred delivery hides the RAW photo

- **Symptom.** The person chose Apple ProRAW. The console showed "Capturing with RAW format: Apple ProRAW", and then no other RAW line. Photos got a plain HEIF.
- **Cause.** Chapter 7 turned on automatic deferred photo delivery. The output then sent a proxy for the processed photo, and no RAW photo at all. The SDK header says that deferred processing is not available for RAW.
- **Fix.** `PhotoCapture.updateDeferredPhotoDelivery()` turns deferred delivery on only when the RAW choice is Off. New log lines show the state: "Deferred photo delivery (supported/enabled): ..." and "Resolved settings: ...". The next round showed "Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0" and a DNG of about 14 MB.

### 2. The save error was lost

- **Symptom.** The RAW photo arrived, but nothing reached Photos, and the console showed no error.
- **Cause.** `MediaLibrary.performChange(_:)` replaced each error from Photos with `saveFailed`, and `CameraModel.capturePhoto()` stored the error in a property that no view reads. The SDK header says that `addResource` always succeeds, and that Photos checks the request only in `performChanges`.
- **Fix.** The app logs "Saved asset ...", "Saving to Photos failed: ... (code name)", and "Photo capture failed: ...". The extension `PHPhotosError.Code.name` gives the name of each code.

### 3. Photos refuses the resources as `Data`

- **Symptom.** "Saving to Photos failed: Error Domain=PHPhotosErrorDomain Code=3300". The request had the processed photo as `.photo` and the DNG as `.alternatePhoto`, both as `Data`, with `contentType` set to `UTType.dng`.
- **Cause.** 3300 is `changeNotSupported`: "The change request is not supported as configured". It is not the code for bad data (3302, `invalidResource`). So Photos refused the form of the request, not the bytes. The header does not say which part.
- **Fix.** The DNG goes to Photos as a file with the extension `.dng` (`URL.rawFileURL`). A fallback saves the processed photo alone, so a capture is never lost.

### 4. The DNG is valid

- **Symptom.** The article's order with the DNG file as `.photo` was refused too, with and without file names and types. The error named the DNG file in its user info.
- **Cause.** Not the data. The new line "RAW data: 15995281 bytes, header 4D 4D 00 2A, type com.adobe.raw-image, images 1" proved a good DNG: a TIFF header, the DNG type, and one image. So the problem was still the form of the request.
- **Fix.** The app keeps the "RAW data" line and logs each resource before the request. The next round tried four requests one after the other.

### 5. The RAW+JPEG form works

- **Symptom.** In a test of four requests, the first one saved. It was the processed photo as `.photo` from `Data`, and the DNG file as `.alternatePhoto` with `shouldMoveFile`. The `originalResourceChoice` line of that request did not run, because the iPhone had iOS 26.
- **Cause.** Photos accepts a RAW pair in the model of its own documentation: the compressed photo is the main photo, and the RAW is a file that is the alternate. Round 3 had the same order, but with the DNG as `Data`.
- **Fix.** The final code keeps this request as the verified fallback. Photos showed one picture with the badge "JPG + RAW". Share > Options > Format: Unmodified Original gave the DNG. On the telephoto camera, the DNG was 8064x6048 (48 MP) and 54 MB. After this round, the user chose the Camera app model as the first request: the DNG alone with a full-size preview. Round 7 tests it.

### 6. The prioritization setter stops a Bayer RAW capture

- **Symptom.** On the physical telephoto camera, the menu offered RAW. A capture with RAW stopped the app with "-[AVCapturePhotoSettings setPhotoQualityPrioritization:] Unsupported when capturing RAW", at the line that set `.speed`.
- **Cause.** The SDK header says that a Bayer RAW request must have `.speed`, and that the default of the settings is `.balanced`. On the device, the setter itself refused a RAW request. The header does not describe this. An Apple ProRAW capture accepted the setter in the same test.
- **Fix.** For a RAW request, the code does not set [`photoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization). It logs "Quality prioritization ...: ignored for RAW".

### The conditions of a RAW capture

| Condition | Bayer RAW | Apple ProRAW | Where the app handles it |
|---|---|---|---|
| Live Photo | The header allows it. | Not allowed: the movie URL must be `nil`. | `excludesLivePhoto` in `PhotoCapture`, and the locked Live Photo button. |
| Quality prioritization | The header says `.speed`; the device refused the setter. | The device accepted the setter. | No setter for any RAW request. |
| Zoom | The zoom factor must be 1.0. | No rule. | No zoom control in this chapter. A later chapter that adds zoom must keep this rule. |
| Deferred delivery | Not available for RAW. | Not available for RAW. | `updateDeferredPhotoDelivery()` turns it off while RAW is chosen. |
| Constant color | Not allowed with RAW. | Not allowed with RAW. | The app has no constant color. |
| Options that the system turns off | None stated. | Content-aware distortion correction, red-eye reduction, the portrait effects matte, and semantic segmentation mattes. | Nothing to do. The app does not use them. |
| Camera | Only a physical camera, such as the wide or the telephoto camera alone. | Also a virtual camera. | The menu shows only what the current camera offers. |
| Resolution | Not known yet: the first Bayer RAW capture stopped before it delivered a photo. | 12 MP (4032x3024) on the virtual triple camera; 48 MP (8064x6048) on the telephoto camera. | `maxPhotoDimensions` stays at the largest value. "Resolved settings" shows the size. |

With RAW Off, the telephoto camera gave an 8064x6048 photo through a proxy (deferred delivery). That is the normal path of chapter 7.

## Common mistakes

- **You write `photoData = photo.fileDataRepresentation()` for each call.** A RAW capture calls the method twice, so the second call replaces the first. Test `isRawPhoto`.
- **You request RAW without reading the list.** A format that is not in `availableRawPhotoPixelFormatTypes` raises an exception.
- **You read the list before the output is in a session.** The list is empty, and you conclude that the device has no RAW.
- **You forget `isAppleProRAWEnabled`.** The list then has Bayer formats only, and Apple ProRAW never shows.
- **You enable Apple ProRAW after `startRunning()`.** The pipeline builds again while the session runs. Do it before the start, and again after a change of camera.
- **You set the prioritization for Bayer RAW.** The header asks for `.speed`, but on the test iPhone the setter raised an exception with any value. Leave the default for a RAW request.
- **You set a Live Photo movie URL with Apple ProRAW.** The photo output raises an exception.
- **You hide the error of `performChanges`.** Photos checks a creation request only when it performs the change. If your code replaces or drops that error, a refused asset leaves no trace. Log it.
- **You give a DNG as `Data`.** Photos then must infer the type, and a device test showed error 3300 even with `contentType` set to `UTType.dng`. Write the DNG to a file with the extension `.dng`, and add it as `.alternatePhoto` with a file URL and `shouldMoveFile`. Add the processed photo as `.photo`.
- **You save a DNG alone without a preview.** Other apps then must develop the RAW data to show it. Ask for `rawEmbeddedThumbnailPhotoFormat` at the full size.
- **You follow the order of Apple's article.** The DNG as `.photo` and the processed photo as `.alternatePhoto` gave error 3300 on the test iPhone, also as a file. Use the RAW+JPEG order.
- **You lose the capture when Photos refuses the pair.** A refused request saves nothing. Save the processed photo alone as a fallback, and log the Photos error with the name of its code.
- **You leave deferred delivery on for RAW.** The output can then give a proxy and no RAW photo. Turn `isAutoDeferredPhotoDeliveryEnabled` off while a RAW format is chosen.
- **You look for Bayer RAW on a virtual camera.** The dual and triple cameras offer Apple ProRAW only. Bayer RAW needs a physical camera.
- **You request RAW with no processed format.** You get the DNG alone, and your delegate waits for a photo that never comes.
- **You test the Simulator and trust it.** The Simulator has no RAW. A working Simulator build says nothing about the RAW path.
- **You offer constant color and RAW together.** They exclude each other.
- **You use the symbol `camera.raw`.** It does not exist. This app uses `r.square` and `r.square.fill`.

## Documentation

```links
Capturing photos in RAW and Apple ProRAW formats | https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats | The Apple article about RAW capture. Its save order did not work on the test iPhone.
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
shouldMoveFile | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile | Move the DNG file into the library instead of copying it.
addResource(with:fileURL:options:) | https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:) | Add a resource from a file, as the app does for the DNG.
originalResourceChoice | https://developer.apple.com/documentation/photos/phassetcreationrequest/originalresourcechoice | The iOS 27 choice of the base for edits of a RAW+JPEG asset. Not used in AVCam.
photoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization | The prioritization of one capture, which the app does not set for RAW.
UTType.dng | https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/dng | The type identifier of a DNG file.
WWDC21: Capture and process ProRAW images | https://developer.apple.com/videos/play/wwdc2021/10160/ | The session about Apple ProRAW, with the advice on how to save it.
Build: RAW and Apple ProRAW | ch08-build.md | The tutorial for this chapter.
```
