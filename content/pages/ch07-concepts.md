---
kind: article
chapter: 7
title: Concepts: photo features
abstract: How the photo output trades quality for speed, how it makes captures feel immediate, how a deferred photo and a Live Photo move through the app, and how the app tells the interface what the camera can do.
estimatedMinutes: 14
branch: chapter-07
---

In chapter 3, each tap gave one photo with the default processing. The photo output can do much more. It can record a short movie around the photo. It can use more or less processing for each photo. It can also give you a result quickly and complete the photo later.

This article explains these features and the rule that all of them obey. It also shows where the Apple sample is not fully correct. In [Build: photo features](ch07-build.md), you write the code.

## How it works

### The two-level rule again

You know the rule from [chapter 3](ch03-concepts.md): you **enable** a feature on the [`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput) object, and you **select** a value for each capture in the [`AVCapturePhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings) object. In chapter 3, you used the rule for the photo size. Each feature of this chapter uses it too.

| Feature | Level 1: the output | Level 2: the settings of one capture |
|---|---|---|
| Live Photo | [`isLivePhotoCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocaptureenabled) | [`livePhotoMovieFileURL`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/livephotomoviefileurl) |
| Quality prioritization | [`maxPhotoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization) | [`photoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization) |
| Responsive capture | [`isResponsiveCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled) | Nothing. The output does it for each capture. |
| Fast capture prioritization | [`isFastCapturePrioritizationEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationenabled) | Nothing. The system decides during a fast sequence. |
| Deferred photo delivery | [`isAutoDeferredPhotoDeliveryEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled) | Nothing. The system decides for each capture. |

Three facts make the rule strict:

- Each feature has a "supported" property next to its "enabled" property. If you enable a feature that is not supported, the photo output raises an exception.
- If the settings ask for more than the output prepared, the photo output also raises an exception. Swift `try` does not catch it.
- The "supported" values depend on the camera and the session configuration. When the configuration changes, an "enabled" value can go back to `false`. Thus you set level 1 again after each change of camera.

The code for level 1 is short. This is the complete method at the end of this chapter:

```swift file=AVCam/Capture/PhotoCapture.swift
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
```

### Quality prioritization

The camera has many ways to process a photo. You do not select an algorithm. You tell the system what is more important to you, speed or quality, and the system selects the processing. The value is a hint, not a command.

[`AVCapturePhotoOutput.QualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/qualityprioritization) has three levels:

| Level | What you ask for | What you get |
|---|---|---|
| `.speed` | The shortest wait. | Light processing with some noise reduction. The photo is near to what the preview shows. Good for a fast sequence of photos. |
| `.balanced` | A middle value. This is the default. | The system can join several frames with fast algorithms. |
| `.quality` | The best image. | The longest wait. On some devices and in some light, the system uses its heaviest processing. |

Apple gives names to the heavy processing in its WWDC talks, for example Deep Fusion. These names are not in the API, and the API does not promise a specific algorithm for a level.

The two levels of the rule are a maximum and a selection:

- `maxPhotoQualityPrioritization` on the output is the highest level that a capture can ask for. Its default is `.balanced`. A higher maximum makes the output prepare more resources, so it uses more memory and power all the time.
- `photoQualityPrioritization` on the settings is the level for one capture. Its default is also `.balanced`.

With `.balanced` and `.quality`, the system can join frames with different exposures. Thus a photo can look different from a video frame of the same moment.

How long is the wait? The resolved settings of a capture tell you: [`photoProcessingTimeRange`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/photoprocessingtimerange) gives the expected minimum and maximum time. AVCam does not read it.

### Why a capture can feel slow

One capture has three phases: the camera collects frames, the system processes them, and the system encodes the result. By default, the photo output starts the next request only when the processing of the last one is complete. With `.quality`, this can be a long time between two photos.

A second delay is at the start. Without help, the camera collects its frames after your code calls `capturePhoto`. The person pressed the button some time before that. The photo then shows a moment that is a little too late.

Three features of the photo output decrease these delays. Each one depends on the one before it.

![Two quick captures on a time line, with the default behavior and with the responsiveness features](../images/ch07-responsive-timeline.svg)

**Zero shutter lag.** The output keeps a buffer of the most recent frames. When a request arrives, the output uses frames from the moment of the tap, not from a later moment. For an app that you build with a recent SDK, this feature is on automatically when the camera supports it. You can set [`isZeroShutterLagEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagenabled) to `false` to stop it. AVCam has no line of code for this feature. It does not apply to a capture with flash, with manual exposure, or with an exposure bracket.

**Responsive capture.** The output lets the phases of two requests overlap. A new capture can start while the last photo is in processing. This needs zero shutter lag, and it uses more memory at the peak.

**Fast capture prioritization.** When the person takes photos very quickly, the system decreases the processing from `.quality` toward `.balanced` to keep the pace. This needs responsive capture. The resolved settings of a capture tell you if the system did this.

> [!NOTE]
> Zero shutter lag helps most when your code calls `capturePhoto` early. A SwiftUI `Button` starts its action when the finger goes up, not when it goes down, and AVCam then goes through two actors. The SDK header recommends that you call `capturePhoto` as early as possible, at the touch-down event.

### Deferred photo delivery

The fourth feature changes what you receive. With deferred delivery, the heavy processing does not occur during the capture. The output gives you a **proxy**: a photo with light processing, together with a reference to data that only the system can read. You save the proxy to the Photos library. The system completes the photo later, when some app asks for the image or when the device has nothing else to do.

Important facts:

- The system decides for each capture. There is no value in the settings. A capture that needs long processing gives a proxy in [`photoOutput(_:didFinishCapturingDeferredPhotoProxy:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishcapturingdeferredphotoproxy:error:)). Each other capture gives a normal photo in `didFinishProcessingPhoto`. One session gives the two kinds, so the delegate must implement the two callbacks.
- [`AVCaptureDeferredPhotoProxy`](https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy) is a subclass of `AVCapturePhoto`. You call `fileDataRepresentation()` on it as you do for a photo.
- You must save the proxy data as a resource of the type [`.photoProxy`](https://developer.apple.com/documentation/photos/phassetresourcetype/photoproxy). Only this type tells Photos to do the later processing. If you save the proxy data as `.photo`, the library probably keeps only the image with light processing. If you save normal data as `.photoProxy`, the save fails.
- Save the proxy quickly. The system removes data that nobody saved, and your app can stop in the background before it saves.
- Changes that you make to the proxy data do not appear in the final photo.
- Permission to add to the library is sufficient to save a proxy. An app needs permission to read the library to show the final photo.

The system does the later processing outside of your capture session, so it does not compete with the camera for memory. For this reason, the 24-megapixel photo size is available only with deferred delivery.

### Live Photo capture

A Live Photo is two files with one identity: a still photo, and a short movie of the time around the photo. The two files contain the same identifier, and the Photos library uses it to make one asset from them. The photo output writes the identifier for you.

The movie comes from a buffer of video that the photo output keeps all the time while Live Photo capture is enabled. This explains two rules:

- You must enable Live Photo capture on the output before a capture, because the output must already have the video from before the tap.
- Live Photo capture and an [`AVCaptureMovieFileOutput`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput) cannot be in one session. When a movie file output is in the session, [`isLivePhotoCaptureSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocapturesupported) is `false`. In chapter 8, you see how AVCam obeys this rule: it removes the movie output in photo mode and adds it again in video mode.

For one capture, you ask for a Live Photo when you set `livePhotoMovieFileURL` to the URL of a new file. The output writes the movie there. AVCam gives each capture its own URL.

A Live Photo capture adds two callbacks to the sequence that you know from chapter 3.

![The delegate callbacks of one Live Photo capture, and what AVCam does in each callback](../images/ch07-live-photo-callbacks.svg)

| Callback | When | Use |
|---|---|---|
| `willBeginCaptureFor` | Always first. | Read [`livePhotoMovieDimensions`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/livephotomoviedimensions) in the resolved settings. A size of zero means that this capture is not a Live Photo. |
| [`didFinishRecordingLivePhotoMovieForEventualFileAt`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishrecordinglivephotomovieforeventualfileat:resolvedsettings:)) | The movie stops. The file is not complete yet. | Hide the indicator that tells the person to hold the device still. |
| [`didFinishProcessingLivePhotoToMovieFileAt`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessinglivephototomoviefileat:duration:photodisplaytime:resolvedsettings:error:)) | The movie file is complete. | Keep the URL of the file. |
| `didFinishCaptureFor` | Always last, after the photo and the movie. | Report the result. |

The delegate reads "is this a Live Photo?" from the resolved settings, not from the request. The request says what you asked for. The resolved settings say what the output does.

To save a Live Photo, you add the movie as a [`.pairedVideo`](https://developer.apple.com/documentation/photos/phassetresourcetype/pairedvideo) resource to the same [`PHAssetCreationRequest`](https://developer.apple.com/documentation/photos/phassetcreationrequest) object that gets the photo. You learned about asset resources in [chapter 4](ch04-concepts.md).

> [!NOTE]
> The movie of a Live Photo has sound only when the session has a microphone input. The app of this tutorial gets its microphone input in chapter 8.

### The badge logic

While the movie records, a camera app shows a "LIVE" badge. The badge tells the person to hold the device still for a moment more.

In AVCam, the `isLivePhoto` value of `CaptureActivity` controls the badge. The delegate yields `isLivePhoto: true` in `willBeginCaptureFor` and `isLivePhoto: false` when the movie stops.

With responsive capture, two Live Photo captures can overlap. If each capture switched the badge by itself, the end of the first movie would hide the badge while the second movie still records. Thus `PhotoCapture` has a counter, `livePhotoCount`, of the Live Photo captures that are in progress. Each capture has its own progress task. The task adds 1 when its capture becomes "live" and subtracts 1 when the movie stops. The idea is that the badge stays on while the counter is not zero. The section [Things to know about the sample](#things-to-know-about-the-sample) shows that the code does not fully do this.

### Capabilities for the interface

The interface must not offer a feature that the camera does not have. AVCam collects the "supported" values in a small structure, `CaptureCapabilities`. `PhotoCapture` fills it after each configuration. `CaptureService` publishes it as `captureCapabilities`, in the same way as it publishes the capture activity.

In this chapter, the structure has one value, `isLivePhotoCaptureSupported`, and no code reads it yet. In chapter 9, you add a value for HDR video, and the model starts to observe the capabilities.

## What the camera can do

| Capability | What it does | In this tutorial |
|---|---|---|
| Live Photo capture | A photo with a short movie around it. | This chapter |
| Quality prioritization | Speed, balance, or quality for each capture. | This chapter |
| Zero shutter lag | Frames from the moment of the tap. | Automatic. No code. |
| Responsive capture and fast capture prioritization | Captures that overlap, and less processing during a fast sequence. | This chapter |
| Deferred photo delivery | A proxy now, the final photo later. | This chapter |
| Capture readiness | [`captureReadiness`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.property) and [`AVCapturePhotoOutputReadinessCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator) tell the interface when a new capture is sensible, for example to show a spinner on the button. | Not in AVCam |
| Expected processing time | `photoProcessingTimeRange` in the resolved settings. | Not in AVCam |
| Stop Live Photo movies | [`isLivePhotoCaptureSuspended`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocapturesuspended) cuts the movies that record at this time, for example before your app plays a sound. | Not in AVCam |
| Live Photo movie options | [`availableLivePhotoVideoCodecTypes`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablelivephotovideocodectypes) for the codec, and [`isLivePhotoAutoTrimmingEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotoautotrimmingenabled) for the automatic cut of the movie. | Not in AVCam |
| Show a Live Photo | [`PHLivePhoto`](https://developer.apple.com/documentation/photos/phlivephoto) and the Live Photo view of PhotoKit. | Not in AVCam |
| A better image during the wait | [`allowSecondaryDegradedImage`](https://developer.apple.com/documentation/photos/phimagerequestoptions/allowsecondarydegradedimage) gives a second interim image while a deferred photo is not complete. | Not in AVCam |
| Prepared settings | [`setPreparedPhotoSettingsArray`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:)) prepares resources before the first capture of a kind. | Not in AVCam |

> [!NOTE]
> The features have conditions. Zero shutter lag needs the `.photo` session preset or a format that is made for photos. Apple shows deferred delivery with the `.photo` preset. Responsive capture needs a device with an A12 chip or newer, and deferred delivery needs an iPhone 11 Pro or newer. Always read the "supported" property. Do not make a decision from the model of the device.

## Why AVCam does it this way

**App types, not AVFoundation types, in the model.** The views select a `QualityPrioritization` value, which is an enumeration of the app. Its raw values are 1, 2, and 3, the same as the raw values of the AVFoundation type. `PhotoCapture` converts with the raw value. `PhotoFeatures` carries the two selections of the person to the capture code. Thus the views and the model do not need AVFoundation.

**Enable all that is supported, after each change.** `updateConfiguration(for:)` sets each "enabled" value to its "supported" value. This cannot raise an exception. The capture service calls the method after each change of camera, because the values can go back to `false`. The order of the lines is important: responsive capture comes before fast capture prioritization, which depends on it.

**`.quality` as the maximum and as the default.** This is a good choice only because the other three features are also on. Without them, each photo at `.quality` would make the person wait. An alternative is to stay at `.balanced`, the default of Apple, and to have no menu.

**Collect first, report at the end.** As in chapter 3, the delegate keeps its results and reports in `didFinishCaptureFor`. Now there are three results: the data, the proxy flag, and the movie URL. One `Photo` value carries them, and one creation request saves them as one asset. The cost is time: for a Live Photo, the last callback arrives only when the movie file is complete.

**Photos moves the movie file.** The save code sets [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile) for the paired video. The library takes the file from the temporary directory and does not copy it. This is faster, and the app does not have to delete the file after a successful save.

**No readiness logic.** The capture button is always enabled, and each tap starts a new task. An earlier version of the sample used a readiness coordinator and showed a spinner on the button. The newest version removed that code.

## Things to know about the sample

These points come from a careful read of the Apple sample and of the SDK headers. Nobody ran them on an iPhone for this tutorial. In the Simulator with SimCam, Live Photo capture does not work. Deferred delivery and responsive capture probably do not work there. Thus the Simulator cannot confirm these points. Read each point as "probably".

- **The badge counter tests `> 1`.** Look at two Live Photo captures, A and B, that overlap. A begins: the counter is 1, and the badge is on. B begins: the counter is 2, and the code forces the badge on. The movie of A stops: the counter is 1. The test `livePhotoCount > 1` is `false`, so the code publishes `isLivePhoto: false`, and the badge goes off while B still records. The test `> 0` would keep the badge on. Apple's article about Live Photos also tells you to hide the indicator only when the count is zero.
- **A Live Photo request has no support test.** `createPhotoSettings(with:)` sets `livePhotoMovieFileURL` when the Live Photo button is on. It does not look at `isLivePhotoCaptureSupported`, although the comment above the line says so. The header of the photo output says that a movie URL without enabled Live Photo capture raises an exception. On a camera that does not support Live Photos, a capture would then stop the app. The correct value is available in `CaptureCapabilities`, but the model does not read it.
- **A damaged movie can get into the library.** When the movie callback reports an error, the delegate writes it to the log and keeps the URL.
- **The proxy is saved late.** The delegate waits for the last callback, and `MediaLibrary` then waits for a location before it writes. Apple's advice is to save a proxy as quickly as possible.
- **A temporary movie file can stay on the disk.** Photos moves the file only when the save is successful. If the save fails, for example because the person denied access, the file stays in the temporary directory.
- **The counter has no protection.** The research for chapter 3 found that the progress task probably does not run on the session queue. Then several tasks can change `livePhotoCount` at the same time.

## Common mistakes

- **You set `livePhotoMovieFileURL`, but Live Photo capture is not enabled on the output.** The photo output raises an exception.
- **You ask for a prioritization above the maximum of the output.** The default maximum is `.balanced`, so a request for `.quality` raises an exception until you increase the maximum.
- **You enable a feature and do not read its "supported" property.** This also raises an exception.
- **You enable the features one time only.** After a change of camera or of session configuration, some values are `false` again.
- **You change `isLivePhotoCaptureEnabled` many times while the session runs.** For each change, the output builds its pipeline again, and the movies that record at that time stop early. Change the value only when the configuration changes.
- **You keep a movie file output in the session in photo mode.** Then Live Photo capture is not supported.
- **You save a proxy as `.photo`, or normal data as `.photoProxy`.** The first probably gives a photo of low quality for all time. The second fails.
- **You implement only `didFinishProcessingPhoto`.** With deferred delivery, some captures give a proxy in the other callback. If the delegate does not implement that callback, `capturePhoto` raises an exception.
- **You use one movie URL for two captures.** Make a new, unique URL for each capture.
- **You add the paired video in a second request.** Add the photo and the movie in one creation request, so that Photos makes one asset from them.
- **You set the maximum to `.quality` when you do not need it.** The output uses more memory and power all the time.

## Documentation

```links
Capturing and saving Live Photos | https://developer.apple.com/documentation/avfoundation/capturing-and-saving-live-photos | The Apple article about Live Photo capture, the indicator count, and the paired save.
Capturing still and Live Photos | https://developer.apple.com/documentation/avfoundation/capturing-still-and-live-photos | The main Apple article about photo capture.
AVCapturePhotoOutput.QualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/qualityprioritization | The three levels of speed and quality.
maxPhotoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization | The highest level that a capture can ask for.
photoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization | The level for one capture.
isZeroShutterLagEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagenabled | The switch for frames from the moment of the tap.
isResponsiveCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled | The switch for captures that overlap.
isFastCapturePrioritizationEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationenabled | The switch for less processing during a fast sequence.
isAutoDeferredPhotoDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled | The switch for deferred photo delivery.
AVCaptureDeferredPhotoProxy | https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy | The proxy object of a deferred photo.
isLivePhotoCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocaptureenabled | The switch for Live Photo capture on the output.
livePhotoMovieFileURL | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/livephotomoviefileurl | The request for a Live Photo in the settings of one capture.
AVCapturePhotoCaptureDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate | All callbacks of a capture.
PHAssetResourceType | https://developer.apple.com/documentation/photos/phassetresourcetype | The resource types of an asset, with the proxy and the paired video.
AVCapturePhotoOutputReadinessCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator | The object that tells the interface when the output is ready.
Displaying Live Photos | https://developer.apple.com/documentation/photokit/displaying-live-photos | How to show a Live Photo in your app.
WWDC23: Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | The session about zero shutter lag, responsive capture, and deferred delivery.
WWDC21: Capture high-quality photos using video formats | https://developer.apple.com/videos/play/wwdc2021/10247/ | The session with the best explanation of quality prioritization.
WWDC26: Implement high resolution photo capture | https://developer.apple.com/videos/play/wwdc2026/304/ | The rules that connect photo size, prioritization, and deferred delivery.
WWDC16: Advances in iOS Photography | https://developer.apple.com/videos/play/wwdc2016/501/ | The session that introduces Live Photo capture.
Build: photo features | ch07-build.md | The tutorial for this chapter.
```
