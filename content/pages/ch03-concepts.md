---
kind: article
chapter: 3
title: Concepts: take a photo
abstract: How one photo capture moves through the photo output, how to turn delegate callbacks into async code, and how format, size, and orientation are set.
estimatedMinutes: 14
branch: chapter-03
---

A tap on a capture button looks like one event. For the camera, it is a request that moves through several stages. The system reports each stage to your code. A good camera app uses these reports to give feedback at the correct moment and to collect the result safely.

This article explains the stages, the objects that carry a request, and the design that AVCam uses to make the result available to `async` code. In [Build: take a photo](ch03-build.md), you write the code.

## How it works

### The photo output

[`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput) is the session output that makes still photos. You add one photo output to the session, and you keep it for the life of the session. You start each capture with [`capturePhoto(with:delegate:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:)).

The configuration has two levels. This is the most important rule of the photo output:

- You enable a feature on the **output**. This prepares the capture pipeline, and it can be slow. You do it before the session runs, or when the camera changes.
- You select a value for each capture in a **settings** object. The value must stay inside the limits that the output prepared.

You see this rule in this chapter with the photo size, and in chapter 7 with Live Photo and the quality prioritization.

### Three objects carry one request

- [`AVCapturePhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings) is what you ask for: the format, the size limit, the flash mode, and more. A settings object is for one capture only. Each object has a `uniqueID`. If you use the same object for a second capture, the photo output raises an exception.
- [`AVCaptureResolvedPhotoSettings`](https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings) is what you get. The system decides the "automatic" values at the moment of capture, for example whether the flash fires and the final photo size. Each delegate callback receives this object. Its `uniqueID` is equal to the `uniqueID` of your request.
- [`AVCapturePhoto`](https://developer.apple.com/documentation/avfoundation/avcapturephoto) is one result image in memory, with its metadata. [`fileDataRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation()) changes it into file data in the format that the settings asked for.

### The callbacks of one capture

The photo output reports the progress of a request to an [`AVCapturePhotoCaptureDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate) object.

![The delegate callbacks of one capture in order, and what AVCam does in each callback](../images/ch03-capture-timeline.svg)

| Callback | When | Use |
|---|---|---|
| `willBeginCaptureFor` | The settings are resolved. Always the first callback. | Read the resolved values. |
| `willCapturePhotoFor` | The exposure starts, immediately after the shutter sound. | Show the screen flash. |
| `didCapturePhotoFor` | The exposure ends. | AVCam does not use it. |
| `didFinishProcessingPhoto` | An image is ready. | Keep the photo data. |
| `didFinishCaptureFor` | The request is complete. Always the last callback. | Report the result and clean up. |

Other callbacks exist for Live Photos and for deferred photos. Chapter 7 adds them.

Three facts about the callbacks are important:

- Only the first and the last callback have a fixed position. Do not write code that depends on the order of the callbacks between them.
- When a capture fails, the callbacks still arrive, with an error. `didFinishCaptureFor` always arrives.
- The callbacks arrive on a queue of the photo output. This is not the main queue, and it is not the queue of your actor.

### From callbacks to `async` code

The photo output says "call me now, and I call you back several times later". Swift concurrency wants "await one value". AVCam connects the two with two tools.

![A continuation carries the result, a stream carries the progress, and the progress task keeps the delegate alive](../images/ch03-async-bridge.svg)

**A checked continuation carries the result.** [`withCheckedThrowingContinuation`](https://developer.apple.com/documentation/swift/withcheckedthrowingcontinuation(isolation:function:_:)) suspends the caller and gives you a continuation object. Some code must resume the continuation exactly one time, with a value or with an error. "Checked" means that the Swift runtime stops the app if you resume two times, and writes a warning if you never resume.

AVCam gives the continuation to the delegate. The delegate resumes it in `didFinishCaptureFor` only. That callback always arrives, and it arrives one time, so the "exactly one time" rule is easy to obey.

**An `AsyncStream` carries the progress.** An [`AsyncStream`](https://developer.apple.com/documentation/swift/asyncstream) can supply many values and then finish. The delegate puts a `CaptureActivity` value into the stream in the early callbacks. A task in `PhotoCapture` reads the stream and publishes each value. The model uses the value to flash the screen.

### Who keeps the delegate alive

`PhotoCapture` creates a new delegate object for each capture and does not store it in a property. So what keeps the object alive until the last callback?

The answer is the progress task. Its closure reads `delegate.activityStream`, so the task holds a strong reference to the delegate. The task ends when the stream finishes, and the stream finishes in `didFinishCaptureFor`. Then the delegate goes away.

This is neat, but you cannot see it in the code. If you remove the progress stream, the delegate can go away immediately. Then no callback arrives, the continuation never resumes, and `capturePhoto()` waits forever.

### Format

A request names a codec.

- **HEIF with HEVC** gives better quality at a smaller file size than JPEG. The file extension is `.heic`.
- **JPEG** is the default of an empty `AVCapturePhotoSettings()` object.

A device does not always support HEVC. So AVCam looks in [`availablePhotoCodecTypes`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablephotocodectypes) first, and uses the JPEG default when HEVC is not there. This list is empty until the output is in a session that has a camera.

A request can also ask for a small **preview image**. It is an uncompressed image in memory for fast feedback in the UI.

### Size

A camera format streams video at one size and can make photos at larger sizes. The format has a list of the photo sizes that it supports: [`supportedMaxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/supportedmaxphotodimensions).

The two-level rule applies:

- [`maxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotodimensions) on the output is the limit for all captures.
- [`maxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/maxphotodimensions) on the settings is the limit for one capture. Its default is the **smallest** supported size.

The result can be smaller than the limit. It is never larger. The size is a request, not a guarantee.

### Session preset

A session preset is a named quality level for the full pipeline. AVCam sets [`.photo`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/photo) for photo capture. This preset selects a camera format that is made for photos: full sensor resolution and the best photo quality. The large photo sizes (24 and 48 megapixels on recent iPhone models) are available with the `.photo` preset only.

### Orientation

The camera sensor is fixed in the device. When you hold an iPhone upright, the sensor data is on its side. The photo output does not turn the pixels. It writes an orientation value into the metadata of the photo, and apps that show the photo apply it.

The value comes from the connection between the camera and the photo output: its [`videoRotationAngle`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle). In chapter 2, you created an [`AVCaptureDevice.RotationCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator) and used its angle for the preview. The coordinator has a second angle, [`videoRotationAngleForHorizonLevelCapture`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture), for captured media. It follows gravity, so a photo is level also when the interface does not turn. In this chapter, you apply this angle to the connection of each output.

## What the camera can do

The photo output has many more features than this chapter uses.

| Capability | What it does | In this tutorial |
|---|---|---|
| Live Photo | Records a short movie around the photo. | Chapter 7 |
| Quality prioritization | Selects speed, balance, or quality for the processing of each capture. | Chapter 7 |
| Deferred photo delivery | Gives a fast proxy photo first; the system completes the final photo later. | Chapter 7 |
| Zero shutter lag and responsive capture | Use frames from before the tap, and let captures overlap. | Chapter 7 |
| Save to the Photos library | PhotoKit writes the photo data into the library. | Chapter 4 |
| 24 and 48 megapixel photos | Larger sizes from the same format, selected for each capture. | Explained here only |
| Flash and red-eye reduction | `flashMode` in the settings, limited by `supportedFlashModes`. | Not in AVCam |
| RAW and Apple ProRAW | Sensor data with little or no processing, as a DNG file. | Not in AVCam |
| Depth data and mattes | A depth map, a portrait matte, or mattes for hair, skin, and teeth with the photo. | Not in AVCam |
| Bracketed capture | Several exposures from one request. | Not in AVCam |
| Embedded thumbnail | A small compressed image in the file for other software. | Not in AVCam |
| Prepared settings | `setPreparedPhotoSettingsArray` allocates resources before the first capture of a kind. | Not in AVCam |

> [!NOTE]
> An earlier version of the Apple sample had a control for the photo size (12, 24, and 48 megapixels). The newest version of the sample removed it. The WWDC26 session about high-resolution capture explains the rules: 12 megapixels works with each prioritization, 48 megapixels needs "balanced" or "quality", and 24 megapixels needs "quality" together with deferred delivery.

## Why AVCam does it this way

**One delegate object for each capture.** Captures can overlap. With one long-life delegate, you must keep a dictionary of states with `uniqueID` as the key. With one small object for each request, each object holds the state of its own request. Apple recommends this pattern.

**Collect first, report at the end.** The delegate keeps the photo data in a property and reports in the last callback. An alternative is to save the image as soon as `didFinishProcessingPhoto` arrives. That is faster for the data, but then a Live Photo movie that arrives later needs a second save operation.

**`Data`, not `AVCapturePhoto`, crosses the actors.** The delegate changes the photo into `Data` inside the callback. `Data` is `Sendable`, so it can go from the capture code to the main actor. `AVCapturePhoto` is not `Sendable`. The cost: you cannot decide later how to encode the photo.

**A plain class inside an actor.** `PhotoCapture` is a `final class`, not an actor. The idea is that the `CaptureService` actor owns it and that all access comes through the actor. The `isolation: isolated (any Actor)? = #isolation` parameter of `monitorProgress` has the purpose to keep the progress task on the actor of the caller.

> [!IMPORTANT]
> The research for this tutorial tested this pattern in a small model with the same compiler settings as the app (Swift 5 mode, minimal concurrency checking). In the model, `#isolation` was `nil` at that place, and the task did not run on the session queue. This was a test on a Mac, not in the app on an iPhone, so read it as "probably", not as a fact. The lesson is general: the minimal checking mode does not tell you when code leaves an actor. The tutorial keeps the code of the sample.

**Combine connects the layers.** `PhotoCapture` publishes its activity with `@Published`. `CaptureService` publishes it again, and `CameraModel` reads the values as an `async` sequence. This keeps AVFoundation types out of the views.

## Things to know about the sample

These points come from a careful read of the Apple sample. Nobody verified them on an iPhone for this tutorial. They do not stop the app from working.

- **The activity never returns to idle.** After a photo, the last value of the stream stays in `captureActivity`. `.idle` is only the first value. The UI of this app does not need the idle state after a photo, so you do not see a problem.
- **The preview image is never used.** The settings ask for a preview image, but no code reads it. The thumbnail in chapter 4 comes from the Photos library.
- **A processing error can get lost.** `didFinishProcessingPhoto` writes the error to the log and returns. The last callback then reports its own error or "no photo data". The first error does not get to the caller.
- **`supportedMaxPhotoDimensions.last` assumes an order.** The code uses the last entry as the largest size. The documentation does not promise that the list is sorted.
- **The first settings object is thrown away.** The code creates default settings and then, when HEVC is available, replaces them with a new object. This is harmless.

## Common mistakes

- **You use a settings object two times.** The photo output raises an Objective-C exception. Swift `try` does not catch it. Create a new object for each capture.
- **You ask for something that the output did not prepare.** For example a codec that is not in `availablePhotoCodecTypes`, or a size above the limit of the output. This also raises an exception.
- **You do not set `maxPhotoDimensions` on the settings.** Then each photo has the smallest size, although the output permits more.
- **You resume a continuation two times, or never.** Two times stops the app. Never leaves the caller waiting forever. Resume in one place only.
- **You do not keep the delegate alive.** The photo output does not do it for you. Without a strong reference, the callbacks do not arrive.
- **You touch the UI from a callback.** The callbacks are not on the main queue. Send the values to the main actor first.
- **You make a full-size `CGImage` for the UI.** One uncompressed 12-megapixel image uses about 48 MB. Use the preview image or a thumbnail.
- **You expect a cancelled task to stop the capture.** When you cancel the Swift task, the photo output continues with the capture.

> [!NOTE]
> In the Simulator with SimCam, a photo is a 640 x 480 JPEG. HEIF, the large photo sizes, and the photo orientation need a real iPhone.

## Documentation

```links
Capturing still and Live Photos | https://developer.apple.com/documentation/avfoundation/capturing-still-and-live-photos | The main Apple article about photo capture. Its code still uses a deprecated flag for the photo size.
Tracking photo capture progress | https://developer.apple.com/documentation/avfoundation/tracking-photo-capture-progress | The steps of a capture and advice about the life of the delegate.
Capturing thumbnail and preview images | https://developer.apple.com/documentation/avfoundation/capturing-thumbnail-and-preview-images | The preview image and the embedded thumbnail.
AVCapturePhotoOutput | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput | The output that makes still photos.
AVCapturePhotoSettings | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings | The request for one capture.
AVCaptureResolvedPhotoSettings | https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings | The values that the system selected for one capture.
AVCapturePhotoCaptureDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate | The callbacks of a capture.
AVCapturePhoto | https://developer.apple.com/documentation/avfoundation/avcapturephoto | One result image and its metadata.
withCheckedThrowingContinuation | https://developer.apple.com/documentation/swift/withcheckedthrowingcontinuation(isolation:function:_:) | The function that connects callback code to async code.
SE-0420: Inheritance of actor isolation | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0420-inheritance-of-actor-isolation.md | The Swift proposal for isolated parameters and the isolation macro.
Capturing photos in RAW and Apple ProRAW formats | https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats | An overview of RAW capture.
Capturing photos with depth | https://developer.apple.com/documentation/avfoundation/capturing-photos-with-depth | How to get depth data with a photo.
Supporting device rotation in your camera app | https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app | The Apple article about the rotation coordinator.
WWDC16: Advances in iOS Photography | https://developer.apple.com/videos/play/wwdc2016/501/ | The session that introduces the photo output.
WWDC21: Meet async/await in Swift | https://developer.apple.com/videos/play/wwdc2021/10132/ | The session that explains continuations.
WWDC26: Implement high resolution photo capture | https://developer.apple.com/videos/play/wwdc2026/304/ | The rules for 12, 24, and 48 megapixel photos.
Build: take a photo | ch03-build.md | The tutorial for this chapter.
```
