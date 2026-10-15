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
> The Simulator with SimCam has no RAW format, so the RAW control is hidden there, and a capture gives a normal photo. Nobody ran a RAW capture on a real iPhone for this tutorial. The facts below come from the SDK headers, from the Apple documentation, and from a WWDC session. Where a statement is an expectation or a conclusion, the text says so.

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

You learned in [chapter 4](ch04-concepts.md) that a Photos asset has resources. The photo is one resource. A Live Photo adds a paired video as a second resource. For a RAW capture, the app adds the DNG as the `.photo` resource and the processed photo as the [`.alternatePhoto`](https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto) resource. Both go into one [`PHAssetCreationRequest`](https://developer.apple.com/documentation/photos/phassetcreationrequest) object. Photos then shows one tile, with a RAW badge, and the person can export the original.

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

The SDK does not say what a RAW request does when deferred delivery is on. Two results are possible. The processed photo can arrive as a proxy, with the DNG as a normal photo. Or both can arrive as normal photos. The delegate handles both. The save code does not look at the proxy flag when it has a DNG. Nobody tested this on a device.

### What the app does not use

The photo output offers more than AVCam uses. These are the main points:

| Capability | What it does | In this tutorial |
|---|---|---|
| Smaller DNG files | Since iOS 18, the settings can set the bit depth of the DNG and a lossy compression, through the `rawFileFormat` property of the settings. | Not in AVCam |
| A preview inside the DNG | The settings can ask for a JPEG preview inside the DNG file, through `rawEmbeddedThumbnailPhotoFormat`. Other apps show the preview. | Not in AVCam |
| RAW size | `rawPhotoDimensions` in the resolved settings gives the size of the RAW photo. The size follows the [`maxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotodimensions) that you know from chapter 3. | The log shows the data size only |
| Prepared settings | [`setPreparedPhotoSettingsArray(_:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:)) prepares the buffers of a RAW request before the first capture. | Not in AVCam |
| Constant color | A photo with stable colors, with a fallback photo. [`isConstantColorSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorsupported) | Not in AVCam |

## Why AVCam does it this way

**One asset, the DNG as the photo.** The app saves the DNG as `.photo` and the processed photo as `.alternatePhoto`, in one request. Apple's article about RAW capture does the same. One tile in the library is easier for a person than two. The processed photo travels with the DNG, so the person can still share an ordinary picture.

**An open question about the order.** The sources do not agree. The Apple documentation page for `.alternatePhoto` describes the opposite model: the processed photo is the main resource, and the RAW file is the alternate. The headers of the iOS 27 SDK follow that page. A third answer comes from WWDC session 10160: it says that the model "RAW plus JPEG" is not recommended for Apple ProRAW, and it advises one DNG with a full-size JPEG preview inside. So there are three designs: this one, the reverse order, and a DNG alone. Only a test on a real iPhone shows what Photos does with this order. The chapter follows the article because it is the Apple code for exactly this task. The notes under "What nobody tested" say what to look for.

**Always a processed photo.** The RAW request always has a processed format. Without it, the request would give the DNG alone, and the delegate could never fill `photoData`. The codec is HEVC when the output offers it, else JPEG. The Simulator has no HEVC, so the JPEG case matters there.

**One list, one test.** The flags `isAppleProRAWSupported` and `isBayerRAWSupported` of `CaptureCapabilities` come from `rawPixelFormat(for:)`. They do not come from `photoOutput.isAppleProRAWSupported`. Thus the interface and the capture use the same test. The interface shows a format only if a capture can request it.

**The rules stay in the capture code.** The Bayer override and the Live Photo exclusion are in `createPhotoSettings(with:)`, not in the views. The person keeps the quality menu and the Live Photo button as they are. For one capture, the code ignores a value that the format does not allow. The cost: a person who selects Quality and Bayer RAW does not get Quality. A different design could disable the menu while RAW is on.

**A fallback at three places.** If the device offers no RAW, three things protect the app. The menu is hidden when the list has only Off. After a camera switch, `CameraModel` sets the choice back to Off if the new camera does not support it. `rawPixelFormat(for:)` returns `nil`, and then the code takes the normal path. In the Simulator, this is what happens: the RAW control is hidden, and a capture saves a normal photo.

**Types of the app in the model.** As in chapter 7, the views and the model use `RAWFormat`, not an AVFoundation type. The raw values of `RAWFormat` are the app's own: they are not the values of the pixel formats.

### What nobody tested

These points need a real iPhone with a Pro camera. Read each one as an expectation.

- **The menu and the formats.** The menu shows Apple ProRAW and RAW as two choices. Bayer RAW may not show on the virtual back camera.
- **The photo in Photos.** The asset has a RAW badge. A look at the resources shows if the DNG or the processed photo is the main one, and if the library makes one asset or two.
- **A proxy with a DNG.** With deferred delivery on, the code sends the processed data as `.alternatePhoto` even if it is a proxy. If the save fails, turn off deferred delivery while a RAW format is selected.
- **Live Photo with Bayer RAW.** The header allows it. If a device shows a problem, remove the movie URL for both formats.
- **The size.** The photo size stays at the largest value, so a DNG can be very big. The log line "Captured RAW photo" shows the size.
- **The speed of normal photos.** `isAppleProRAWEnabled` changes the capture pipeline. Check that a normal photo is still as fast.
- **An error on one of the two photos.** If the RAW photo fails and the processed photo works, the delegate logs the error. The save then has the processed photo alone, or no data, and `noPhotoData` is the result.

## Common mistakes

- **You write `photoData = photo.fileDataRepresentation()` for each call.** A RAW capture calls the method twice, so the second call replaces the first. Test `isRawPhoto`.
- **You request RAW without reading the list.** A format that is not in `availableRawPhotoPixelFormatTypes` raises an exception.
- **You read the list before the output is in a session.** The list is empty, and you conclude that the device has no RAW.
- **You forget `isAppleProRAWEnabled`.** The list then has Bayer formats only, and Apple ProRAW never shows.
- **You enable Apple ProRAW after `startRunning()`.** The pipeline builds again while the session runs. Do it before the start, and again after a change of camera.
- **You use the quality menu for Bayer RAW.** Any value but `.speed` raises an exception.
- **You set a Live Photo movie URL with Apple ProRAW.** The photo output raises an exception.
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
setPreparedPhotoSettingsArray(_:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:) | Prepare the buffers of a RAW request.
isConstantColorSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorsupported | The constant color feature, which cannot combine with RAW.
PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest | The request that saves an asset with several resources.
PHAssetResourceType.alternatePhoto | https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto | The resource type for the second photo of an asset.
WWDC21: Capture and process ProRAW images | https://developer.apple.com/videos/play/wwdc2021/10160/ | The session about Apple ProRAW, with the advice on how to save it.
Build: RAW and Apple ProRAW | ch08-build.md | The tutorial for this chapter.
```
