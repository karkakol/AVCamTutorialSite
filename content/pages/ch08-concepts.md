---
kind: article
chapter: 8
title: Concepts: RAW and Apple ProRAW
abstract: What a RAW photo is, what Apple ProRAW adds, why the app asks for the DNG alone, how it saves the DNG as one asset, and which rules make a RAW request fail.
estimatedMinutes: 14
branch: chapter-08
---

A normal photo is a finished picture. The camera has chosen the white balance, the noise reduction, the tones, and the sharpness for you. A RAW photo keeps much more of what the sensor saw. A photo editor can then make these choices again, and it does not start from a picture that is already compressed.

In this chapter, the app gets a RAW control with the choices Off and Apple ProRAW. When the person selects Apple ProRAW, one tap gives one photo: a DNG file with a full-size JPEG preview inside. The app saves the DNG alone in Photos, as the Camera app does. [Build: RAW and Apple ProRAW](ch08-build.md) is the tutorial for the code.

The chapters before this one used the code of the Apple sample. The sample has no RAW capture. Thus this chapter is part 2 code ("Beyond the sample") inside the numbering of part 1. The design is this tutorial's own, and it is one of several possible designs. This article explains the camera facts that each design must obey, then the decisions of this design, and what is still open.

> [!IMPORTANT]
> The Simulator with SimCam has no RAW format, so the RAW control is hidden there, and a capture gives a normal photo. The RAW code of this chapter ran in seven rounds on an iPhone 17 Pro Max with iOS 26. Each round found a defect or a rule. The last round verified the save of this chapter: the DNG alone, as the only resource of one asset. Photos showed it as a RAW photo, on the back camera and on the front camera. [What the device tests showed](#what-the-device-tests-showed) tells the story. The other facts below come from the SDK headers, from the Apple documentation, and from a WWDC session. Where a statement is an expectation or a conclusion, the text says so.

## How it works

### What a RAW photo is

The sensor of a phone camera sees only one color at each pixel, in a mosaic pattern that is named a Bayer pattern. The camera then reconstructs a full-color picture. This step is named demosaicing. After it come the noise reduction, the tone curve, and the other steps. A normal photo is the result, and the camera cannot undo the steps.

A RAW photo is a file that stops earlier. It keeps the data in a form that the editor can still change. On an iPhone, the file is a **DNG** file (Digital Negative), a standard format for RAW images. Your camera app, a different app, or a computer can open it.

### One request, one photo

You ask for a RAW photo, and you say whether you also want a processed photo. This app asks for the RAW photo alone, so the result is one photo, as the diagram shows.

![One capture request for Apple ProRAW with no processed format gives one photo: a DNG file with a full-size JPEG preview inside. The delegate gets one call. The app saves the DNG alone as one asset in Photos.](../images/ch08-raw-pipeline.svg)

The initializer [`init(rawPixelFormatType:processedFormat:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:)) takes the RAW format and a processed format. The SDK header says: pass `nil` if you want no processed photo. With `nil`, the photo output calls [`photoOutput(_:didFinishProcessingPhoto:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:)) one time, with the DNG. The resolved settings then show an expected photo count of 1.

If you pass a processed format, such as HEVC, one sensor image gives two photos: the DNG and a processed photo. The method is then called two times, in no fixed order. Each call gets an [`AVCapturePhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto) object, and the property [`isRawPhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/israwphoto) tells you which of the two you have. You need this form only for the RAW+JPEG model below.

There is no separate method for the DNG data. [`fileDataRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation()) gives DNG data for a RAW photo, and compressed data for a processed photo. So the delegate of this app keeps the DNG in `photoData`, as it keeps a normal photo, and it sets `isRAWPhoto` from `isRawPhoto`. The last callback, `didFinishCaptureFor`, always comes last. As in chapters 3 and 7, AVCam collects the results and reports them in that last callback. The `Photo` value carries the flag `isRAW` to the media library.

### The two-level rule again

You know the rule from [chapter 3](ch03-concepts.md) and [chapter 7](ch07-concepts.md): you **enable** a feature on the [`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput) object, and you **select** a value in the [`AVCapturePhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings) object of each capture.

| | Level 1: the output | Level 2: the settings of one capture |
|---|---|---|
| Apple ProRAW | [`isAppleProRAWSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported) and [`isAppleProRAWEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled) | The RAW format that you choose from the list. |
| The list of RAW formats | [`availableRawPhotoPixelFormatTypes`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotopixelformattypes-9t9k5), read-only | [`init(rawPixelFormatType:processedFormat:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:)) takes one value of the list. |

Two facts make the rule strict here too:

- **The list is empty until the output is in a session with a video input.** Before that, no RAW format is available.
- **Enabling Apple ProRAW builds the capture pipeline again.** This takes time, so you set `isAppleProRAWEnabled` before the session starts. It may be `true` only when `isAppleProRAWSupported` is `true`. The value depends on the camera and the session configuration, so you set it again after each change of camera.

After you enable Apple ProRAW, the list holds the Apple ProRAW formats. On a physical camera, it can also hold Bayer RAW formats, which come first. The class method [`isAppleProRAWPixelFormat(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawpixelformat(_:)) finds the Apple ProRAW formats.

This is the helper of the app. It returns the first Apple ProRAW format, or `nil`:

```swift file=AVCam/Capture/PhotoCapture.swift
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

### One asset in Photos

You learned in [chapter 4](ch04-concepts.md) that a Photos asset has resources. The photo is one resource. A Live Photo adds a paired video as a second resource. For a RAW capture, two models exist, and both give one picture in the library.

| | The Camera app model (this chapter) | The RAW+JPEG model (an alternative) |
|---|---|---|
| Capture request | The RAW photo alone: `processedFormat: nil`, with a full-size JPEG preview inside the DNG. | The RAW photo and a processed photo (HEVC or JPEG). |
| Resources | The DNG alone, as the `.photo` resource, from a `.dng` file. | The processed photo as `.photo` from `Data`, and the DNG file as [`.alternatePhoto`](https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto). |
| What Photos shows | The preview inside the DNG, as a RAW photo. | The processed photo, with the badge "JPG + RAW" (also for a HEIF). |
| What other apps get | The DNG, or its preview. Unmodified Original gives the DNG. | The processed photo. Unmodified Original gives the DNG. |
| Source | WWDC21 session 10160 advises it for Apple ProRAW. | The documentation of `.alternatePhoto` and the iOS 27 headers describe it. |
| On the test iPhone | Saved (round 7, back and front camera). | Saved (round 6). |

The app uses the Camera app model. It is one request with one resource, and it needs no processed photo. Use the RAW+JPEG model when other apps must get a normal photo of each RAW capture, for example an app that shares each picture at once. It costs a second photo per capture, and the library stores both files. Keep the order: the processed photo as `.photo` and the DNG as `.alternatePhoto`. The reverse order, the DNG as `.photo` and the processed photo as `.alternatePhoto`, gave error 3300 on the test iPhone.

Each resource has a type of data, such as HEIF or DNG, and a file name. The options object [`PHAssetResourceCreationOptions`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions) can state both. If the options have no type, Photos infers it from the resource type or from the file name extension. A resource type does not say "DNG". So the app writes the DNG data to a temporary file with the extension `.dng` and adds it with [`addResource(with:fileURL:options:)`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:)). [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile) moves the file into the library instead of copying it. It is the only option that the app sets. Photos moves the file only when it creates the asset, so after a refused request the file is still there, and the app removes it.

The preview inside the DNG comes from the capture settings: `rawEmbeddedThumbnailPhotoFormat` asks for a JPEG at the size of the photo. The SDK header says that a DNG can hold a preview up to the full size of the RAW image since iOS 12.

## What the camera can do

### Apple ProRAW

| | Apple ProRAW |
|---|---|
| What it is | A DNG that the system has already demosaiced and partly processed. It still keeps much room for editing. |
| Which devices | Since iOS 14.3. iPhone 12 Pro and later Pro models. Also the virtual cameras that join several lenses. |
| Quality prioritization | The app does not set it for a RAW request (see the rules below). |
| Live Photo | Not allowed: the movie URL must be `nil`. |
| File size | About 10 to 40 MB, and more for a complex scene. On the test iPhone: about 15 MB at 12 MP, 54 MB at 48 MP. |

Apple ProRAW joins two worlds. Like a normal photo, it has the work of the camera pipeline: it can use several frames, and it has the noise reduction. Like a RAW photo, it keeps a wide range of tones for the editor. The cost is a bigger file.

Do not select a format from the name of the device. Read the list. It can be empty, and it can change when the person switches the camera. Apple ProRAW also needs a session configuration that supports the highest photo quality. AVCam uses the `.photo` preset, which does.

The pixel formats are `OSType` values, which are four-character codes. An Apple ProRAW format in the list looks like `l64r`. You do not need to know the codes. The class method sorts them for you.

### Bayer RAW comes in chapter 16

The other kind of RAW is Bayer RAW: the sensor data of one camera, with no processing. It exists only on a physical camera, such as the wide or the telephoto camera alone. WWDC21 session 10160 says so, and the SDK header says that Apple ProRAW exists for the modes that fuse several captures, where no Bayer RAW is available. This app uses the camera that the system prefers. On the back of an iPhone with several lenses, that is a virtual camera, so Bayer RAW does not show. On the test iPhone, the menu had no Bayer RAW with the "Back Triple Camera", and it had it with the "Back Telephoto Camera". A Bayer RAW request also needs a zoom factor of 1.0. And the test showed the rule that this chapter keeps for all RAW: a Bayer RAW capture stopped the app at the `photoQualityPrioritization` setter (finding 6 below). Thus Bayer RAW needs the selection of a physical camera and a zoom control. [Chapter 16](ch16-concepts.md) teaches both, and it adds Bayer RAW in a section "Bayer RAW on a single lens".

### Rules that make a request fail

When the settings of a capture break a rule, [`capturePhoto(with:delegate:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:)) raises an exception. Swift `try` does not catch it, and the app stops. This list comes from the SDK header.

| Rule | What the app does |
|---|---|
| The RAW format must be in `availableRawPhotoPixelFormatTypes`. | The helper reads only that list. |
| The documentation says that `photoQualityPrioritization` is not supported for a RAW capture. On the test iPhone, the setter raised an exception for a RAW request. | The code does not call the setter for a RAW request. |
| Apple ProRAW needs `livePhotoMovieFileURL` to be `nil`. | The code leaves the movie URL out. |
| Constant color and RAW exclude each other. | The app has no constant color. |
| A processed format needs a codec from `availablePhotoCodecTypes`. | The RAW request has no processed format (`nil`). |

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

**The Camera app model.** The person chose RAW, so the app saves what the Camera app saves: one DNG with a full-size preview. Photos and other apps show the preview, and an editor gets the RAW data. The DNG is the only file, so the library does not store a second photo of the same moment. WWDC21 session 10160 advises this model for Apple ProRAW, and it does not recommend "RAW plus JPEG" for Apple ProRAW. Round 7 verified it on the test iPhone.

**No processed photo.** The capture asks for the RAW photo alone, with `processedFormat: nil`. The save never uses a processed photo, so a processed photo would only cost time and memory. The delegate keeps the DNG in `photoData`, so the `noPhotoData` guard of chapter 4 still works. A flag `isRAW` on `Photo` tells the media library to save the DNG. The flag is a `var` with the default `false`, so the call sites of chapter 7 stay as they are.

**One save path.** A RAW capture has one request: the DNG file as `.photo` with `shouldMoveFile`. If Photos refuses it, `performChange(_:)` logs the error with the name of its code, and `capturePhoto()` logs "Photo capture failed: ...". Earlier versions of this chapter had a fallback to the pair and then to the processed photo alone. Round 7 showed that the first request saves, so the fallbacks are gone. The RAW+JPEG pair stays an alternative that you can build yourself (see the table above).

**No `originalResourceChoice`.** The iOS 27 SDK adds [`originalResourceChoice`](https://developer.apple.com/documentation/photos/phassetcreationrequest/originalresourcechoice) to the creation request. It applies only to a RAW+JPEG asset, where it selects whether the RAW or the compressed resource is the base for edits. The Camera app model has one resource, and the header says that the property is an error on an asset with one original. So the app does not use it.

**One list, one test.** The flag `isAppleProRAWSupported` of `CaptureCapabilities` comes from `rawPixelFormat(for:)`. It does not come from `photoOutput.isAppleProRAWSupported`. Thus the interface and the capture use the same test. The interface shows Apple ProRAW only if a capture can request it.

**The rules stay in the capture code, and the interface tells them.** The prioritization rule and the Live Photo rule are in `createPhotoSettings(with:)`. For a RAW capture, the code does not set the prioritization, and it logs the choice of the person as "ignored for RAW". For Apple ProRAW, the code leaves the movie URL out. The Live Photo button also shows Live Photo as off and is disabled while Apple ProRAW is chosen, so the interface does not promise a movie. The values of the person stay in the model, and they come back when RAW is Off. The cost: a person who selects Quality and Apple ProRAW does not get Quality. A different design could disable the quality menu while RAW is on.

**A fallback at three places.** If the device offers no RAW, three things protect the app. The menu is hidden when the list has only Off. After a camera switch, `CameraModel` sets the choice back to Off if the new camera does not support it. `rawPixelFormat(for:)` returns `nil`, and then the code takes the normal path. In the Simulator, this is what happens: the RAW control is hidden, and a capture saves a normal photo.

**Apple ProRAW only in this chapter.** Apple ProRAW works on the camera that the app already uses, also on a virtual camera. So a person can test it at once. A first version of this chapter also offered Bayer RAW when the current camera had it. On the test iPhone, Bayer RAW showed only after a zoomed shot in the Camera app had made the telephoto camera the preferred camera. A feature that shows only by chance cannot be tested in a tutorial. Bayer RAW needs a physical camera and a zoom factor of 1.0, so it moves to chapter 16, which adds the lenses and the zoom. `RAWFormat` stays an enumeration, and the menu stays a picker, so that chapter can add one case.

**Types of the app in the model.** As in chapter 7, the views and the model use `RAWFormat`, not an AVFoundation type. The raw values of `RAWFormat` are the app's own: they are not the values of the pixel formats.

### What nobody tested

These points still need a real iPhone. Read each one as an expectation.

- **The request without a processed photo.** Round 7 saved the DNG alone, but its request still asked for a processed photo too. The final request has `processedFormat: nil`. Expected: "Resolved settings: 1 photos, photo 0x0, RAW ..., proxy 0x0", one "Captured RAW photo" line, and the same save.
- **The badge text.** Photos showed the DNG as a RAW photo. The exact text of the badge for a DNG-only picture was not written down. Expected: "RAW".
- **iOS 27.** All tests ran on iOS 26. The save has no iOS 27 code, so it is expected to work the same.
- **An error on the RAW photo.** If the RAW photo fails, the delegate logs the error. `photoData` stays `nil`, and `noPhotoData` is the result.

## What the device tests showed

The chapter ran seven times on an iPhone 17 Pro Max with iOS 26. Seven findings came out of these rounds. Each finding has a symptom, a cause, and a fix in the code.

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
- **Fix.** The DNG goes to Photos as a file with the extension `.dng` (`URL.rawFileURL`). At that time, a fallback saved the processed photo alone, so a capture was never lost.

### 4. The DNG is valid

- **Symptom.** The article's order with the DNG file as `.photo` was refused too, with and without file names and types. The error named the DNG file in its user info.
- **Cause.** Not the data. The new line "RAW data: 15995281 bytes, header 4D 4D 00 2A, type com.adobe.raw-image, images 1" proved a good DNG: a TIFF header, the DNG type, and one image. So the problem was still the form of the request.
- **Fix.** The app keeps the "RAW data" line and logs each resource before the request. The next round tried four requests one after the other.

### 5. The RAW+JPEG form works

- **Symptom.** In a test of four requests, the first one saved. It was the processed photo as `.photo` from `Data`, and the DNG file as `.alternatePhoto` with `shouldMoveFile`. The `originalResourceChoice` line of that request did not run, because the iPhone had iOS 26.
- **Cause.** Photos accepts a RAW pair in the model of its own documentation: the compressed photo is the main photo, and the RAW is a file that is the alternate. Round 3 had the same order, but with the DNG as `Data`.
- **Fix.** Photos showed one picture with the badge "JPG + RAW". Share > Options > Format: Unmodified Original gave the DNG. On the telephoto camera, the DNG was 8064x6048 (48 MP) and 54 MB. After this round, the user chose the Camera app model as the first request: the DNG alone with a full-size preview. The pair became its fallback. Round 7 tested the first request.

### 6. The prioritization setter stops a RAW capture

- **Symptom.** At that time, the menu also offered Bayer RAW (the choice "RAW") on a physical camera. On the telephoto camera, a capture with Bayer RAW stopped the app with "-[AVCapturePhotoSettings setPhotoQualityPrioritization:] Unsupported when capturing RAW", at the line that set `.speed`.
- **Cause.** The SDK header says that a Bayer RAW request must have `.speed`, and that the default of the settings is `.balanced`. On the device, the setter itself refused a RAW request. The message names RAW in general. An Apple ProRAW capture accepted the setter in the same test.
- **Fix.** For a RAW request, the code does not set [`photoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization). It logs "Quality prioritization ...: ignored for RAW". This rule covers Apple ProRAW now, and Bayer RAW when chapter 16 adds it. After this round, Bayer RAW moved to chapter 16, because it needs a physical camera that the app selects on purpose.

### 7. The DNG alone saves

- **Symptom.** None. On the virtual "Back Dual Camera" and on the "Front TrueDepth Camera", the capture resolved to 2 photos (the request still had a processed photo), and the console showed "RAW preview: JPEG WxH", "Resource .photo: N bytes, file ....dng", "Saved asset ...", and "Saved the RAW as the DNG alone".
- **Cause.** Photos accepts the model of the Camera app: the DNG file alone as `.photo`, with `shouldMoveFile`. Photos showed it as a RAW photo, and Unmodified Original gave the DNG. The front camera offers Apple ProRAW too. In chapter 9, the readiness went to `sessionNotRunning` and back to `ready` after a RAW capture, because the change of deferred delivery builds the pipeline again.
- **Fix.** The final code asks for the RAW photo alone (`processedFormat: nil`) and keeps only this save request. The pair code, the processed photo, and the fallbacks are gone.

### The conditions of a RAW capture

| Condition | Apple ProRAW | Where the app handles it |
|---|---|---|
| Live Photo | Not allowed: the movie URL must be `nil`. | `excludesLivePhoto` in `PhotoCapture`, and the locked Live Photo button. |
| Quality prioritization | Not supported for RAW. The device accepted the setter for Apple ProRAW, and refused it for Bayer RAW. | No setter for any RAW request. |
| Deferred delivery | Not available for RAW. | `updateDeferredPhotoDelivery()` turns it off while Apple ProRAW is chosen. The change builds the pipeline again, so the readiness of chapter 9 shows `sessionNotRunning` for a moment. |
| Processed photo | Not needed. | `processedFormat: nil`. One photo per capture. |
| Save | The DNG alone as `.photo`, from a `.dng` file. | `MediaLibrary.save(rawData:location:)`, one request. |
| Constant color | Not allowed with RAW. | The app has no constant color. |
| Options that the system turns off | Content-aware distortion correction, red-eye reduction, the portrait effects matte, and semantic segmentation mattes. | Nothing to do. The app does not use them. |
| Camera | Also a virtual camera. On the test iPhone: the back dual camera, the triple camera, the telephoto camera, and the front TrueDepth camera. | The menu shows only when the current camera offers it. |
| Resolution | 12 MP (4032x3024) on the virtual cameras; 48 MP (8064x6048) on the physical telephoto camera. | `maxPhotoDimensions` stays at the largest value. "Resolved settings" shows the size. |

With RAW Off, the telephoto camera gave an 8064x6048 photo through a proxy (deferred delivery). That is the normal path of chapter 7.

## Common mistakes

- **You ask for a processed photo that you do not save.** A RAW request with a processed format gives two photos, and the second call of `didFinishProcessingPhoto` replaces the first one in `photoData`. For the DNG alone, pass `processedFormat: nil`. For the RAW+JPEG model, test `isRawPhoto` and keep the two photos apart.
- **You request RAW without reading the list.** A format that is not in `availableRawPhotoPixelFormatTypes` raises an exception.
- **You read the list before the output is in a session.** The list is empty, and you conclude that the device has no RAW.
- **You forget `isAppleProRAWEnabled`.** The list then has no Apple ProRAW format, and Apple ProRAW never shows.
- **You enable Apple ProRAW after `startRunning()`.** The pipeline builds again while the session runs. Do it before the start, and again after a change of camera.
- **You set the prioritization for a RAW request.** The setter is not supported for RAW. On the test iPhone, it raised an exception for a Bayer RAW request. Leave the default for a RAW request.
- **You set a Live Photo movie URL with Apple ProRAW.** The photo output raises an exception.
- **You hide the error of `performChanges`.** Photos checks a creation request only when it performs the change. If your code replaces or drops that error, a refused asset leaves no trace. Log it.
- **You give a DNG as `Data`.** Photos then must infer the type, and a device test showed error 3300 even with `contentType` set to `UTType.dng`. Write the DNG to a file with the extension `.dng`, and add it with a file URL and `shouldMoveFile`.
- **You save a DNG alone without a preview.** Other apps then must develop the RAW data to show it. Ask for `rawEmbeddedThumbnailPhotoFormat` at the full size.
- **You build a pair in the order of Apple's article.** The DNG as `.photo` and the processed photo as `.alternatePhoto` gave error 3300 on the test iPhone, also as a file. Save the DNG alone, or use the RAW+JPEG order: the processed photo as `.photo`, the DNG as `.alternatePhoto`.
- **You hide why Photos refused a request.** A refused request saves nothing, and the error has no text. Log the Photos error with the name of its code.
- **You leave deferred delivery on for RAW.** The output can then give a proxy and no RAW photo. Turn `isAutoDeferredPhotoDeliveryEnabled` off while a RAW format is chosen.
- **You request RAW with no processed format, and your delegate waits for a processed photo.** The capture then gives the DNG alone. Keep the DNG in the same variable as a normal photo, and mark it as RAW.
- **You test the Simulator and trust it.** The Simulator has no RAW. A working Simulator build says nothing about the RAW path.
- **You offer constant color and RAW together.** They exclude each other.
- **You use the symbol `camera.raw`.** It does not exist. This app uses `r.square` and `r.square.fill`.

## Documentation

```links
Capturing photos in RAW and Apple ProRAW formats | https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats | The Apple article about RAW capture. Its pair order did not work on the test iPhone.
AVCapturePhotoOutput | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput | The photo output, with the RAW properties.
isAppleProRAWSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported | Whether the configuration supports Apple ProRAW.
isAppleProRAWEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled | The switch that adds the Apple ProRAW formats to the list.
availableRawPhotoPixelFormatTypes | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotopixelformattypes-9t9k5 | The list of RAW formats that the output offers.
isAppleProRAWPixelFormat(_:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawpixelformat(_:) | The test for an Apple ProRAW format.
init(rawPixelFormatType:processedFormat:) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:) | The settings for a RAW photo. With `nil` as the processed format, the RAW photo alone.
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
