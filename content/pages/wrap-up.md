---
kind: article
chapter: 0
title: Wrap-up
abstract: What you built, how your project compares with the Apple sample, what needs a real iPhone, the weak points of the sample, and ideas for your next steps.
estimatedMinutes: 6
---

You started with an empty Xcode project. Now you have a camera app with a live preview, photo and video capture, RAW photos and fast capture, a robust session, support for the hardware controls of iPhone, a start from the Lock Screen, two cameras at once, and a recording of a picture in picture. You typed each line, and you know why it is there.

This page is a summary. It also tells you honestly what this tutorial did not verify, and where the Apple sample is weaker than a real camera app must be. Use these points as a list of exercises.

## What you built

| Chapter | What you added |
|---|---|
| 1 | The capture service actor with its own queue, the camera model, the permission request, and the live preview. |
| 2 | The device lookup, the change between cameras, the system-preferred camera, and the rotation of the preview. |
| 3 | Photo capture: a delegate for each capture, a continuation for the result, and a stream for the progress. |
| 4 | The media library actor, which saves to Photos with a location, and the thumbnail. |
| 5 | The layout for iPhone and iPad sizes, and the viewfinder frame. |
| 6 | Focus and exposure at a point, and the return to the continuous modes. |
| 7 | Live Photos, the quality prioritization, deferred photo delivery, and responsive capture. |
| 8 | RAW and Apple ProRAW: a DNG file as one asset in Photos, and a RAW menu in the features toolbar. This chapter is an extension, not part of the Apple sample. |
| 9 | Fast capture: the capture switches and a readiness state on the capture button. This chapter is an extension, not part of the Apple sample. |
| 10 | Video mode, the microphone, movie recording, and the recording time. |
| 11 | HDR video with a search for a 10-bit format. |
| 12 | Interruptions, the media services reset, the deferred start, and the hidden controls. |
| 13 | Capture with the hardware buttons and AirPods, and high-quality audio from AirPods. |
| 14 | Controls for the Camera Control: zoom, exposure bias, and a lens position slider. |
| 15 | A shared state, a capture extension for the Lock Screen, and a control for Control Center and the Action button. |

Part 2 goes beyond the sample: chapter 16 adds zoom and the virtual back cameras, chapter 17 corrects four defects of the sample, chapter 18 adds support for iPhone Duo, chapter 19 shows two cameras at once, and chapter 20 records them in a picture in picture. Chapters 8 and 9 are not part of the sample either. The sections below about the Apple sample describe the state at the end of chapter 15, which is the sample plus these two chapters.

The design stayed the same from chapter 1 to chapter 15: the views read a model on the main actor, the model sends each request to the capture service, and the capture service owns the session on its own queue. Each chapter added lines to this design. No chapter replaced it.

## Your project and the Apple sample

The Swift files of the `chapter-15` branch are the same as the files of [AVCam](https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app), line for line, with these differences. The first two rows are the additions of chapters 8 and 9. The rest are small changes:

| File | Difference | Reason |
|---|---|---|
| `PhotoCapture.swift`, `DataTypes.swift`, `CameraModel.swift`, `Camera.swift`, `PreviewCameraModel.swift`, `FeatureToolbar.swift`, `MediaLibrary.swift`, `FoundationExtensions.swift` | The RAW format choice in the features toolbar, the RAW photo capture, and the save of the DNG file. | Chapter 8. The Apple sample has no RAW capture. |
| `PhotoCapture.swift`, `DataTypes.swift`, `CameraModel.swift`, `Camera.swift`, `PreviewCameraModel.swift`, `CaptureService.swift`, `CaptureButton.swift` | The capture switches, the readiness coordinator, and the states of the capture button. | Chapter 9. The Apple sample has no readiness state. |
| `CaptureService.swift` | The label of the session queue starts with `com.karolkakol.AVCam`. | The tutorial uses a different bundle identifier. |
| `AVCamControlCenterExtension.swift` | The `kind` string of the control starts with `com.karolkakol.AVCam`. | The same reason. |
| `CameraPreview.swift` | The preview view does not add a placeholder image in the Simulator. | SimCam gives the Simulator a live picture. |
| `CameraModel.swift` | `observeState()` has one more task, which sets the `interrupted` status. | The sample publishes the interruption state, but it never shows the message. |

The project is also different in places that are not Swift code. The tutorial project has the bundle identifier `com.karolkakol.AVCam`, and all its groups are synchronized folders. It does not have the app icon image and the preview assets of the sample.

## What needs a real iPhone

The Simulator with SimCam was sufficient for most of the tutorial. These features need a real iPhone. The code for RAW and fast capture (chapters 8 and 9) ran on an iPhone 17 Pro Max with iOS 26. The code for the other features builds, but this tutorial did not see it run.

| Feature | Chapter | Note |
|---|---|---|
| The system permission alerts | 1, 4, 10 | SimCam gives the app camera access without the alert. |
| The correct orientation of photos | 3 | A SimCam photo has no orientation data. |
| HEIF photos and the large photo sizes | 3 | A SimCam photo is a 640 x 480 JPEG. |
| Live Photos, deferred photo delivery, responsive capture | 7 | |
| RAW and Apple ProRAW | 8 | The Simulator has no RAW format. Verified on an iPhone 17 Pro Max with iOS 26. |
| The fast capture switches and the readiness states | 9 | The Simulator reports the switches as not supported. Verified on an iPhone 17 Pro Max with iOS 26: the waiting states did not appear. |
| HDR video | 11 | Not tested in the Simulator. |
| Real interruptions, for example a phone call | 12 | |
| The speed of the deferred start | 12 | The Simulator has no camera hardware to start. |
| Capture with the volume buttons, the Action button, and AirPods | 13 | The AirPods features are not available in the European Union. |
| The Camera Control | 14 | Only on iPhone models that have this control. |
| The start from the Lock Screen, Control Center, and the Action button | 15 | Also needs a development team for code signing. |

## Known weak points of the sample

A sample shows an API. It is not a finished product. The research for this tutorial found these points in a careful read of the code. Nobody verified them on an iPhone, so read each one as "probably". The concept article of each chapter has the details.

**Concurrency**

- The project uses Swift 5 mode with minimal concurrency checking. The compiler does not tell you when code leaves an actor.
- The progress task of a photo capture probably does not run on the session queue (chapter 3). The Live Photo counter then has no protection (chapter 7).
- The recording timer reads the movie output from the main thread (chapter 10).

**Photo**

- The Live Photo badge counter tests `> 1` where `> 0` is correct (chapter 7).
- A Live Photo request does not test whether the camera supports Live Photos (chapter 7).
- An error from the processing of a photo can get lost (chapter 3).
- The back camera lookup never asks for a device with the ultra-wide camera, so the app cannot show 0.5x (chapter 2).

**Save**

- The app requests add-only access to Photos, but it declares the usage description for full access. It then reads the new asset to make the thumbnail (chapter 4).
- Each save waits for a location, and a location error stops the save (chapter 4).
- A failed save leaves the movie file in the temporary directory (chapters 7 and 10).

**Video**

- HDR can show "on" after a change of the camera, while the new camera uses an 8-bit format (chapter 11).
- A mode change sets the stored mode before the session change, and the model hides the error with `try?` (chapter 10).
- The app never asks for microphone access directly. The alert appears when the code creates the microphone input (chapter 10).

**Session**

- The `running` status is not the state of the session. The model sets it one time (chapter 12).
- The sample handles only one runtime error (chapter 12).

**System integration**

- The capture sound for AirPods plays after the save, not at the moment of the capture (chapter 13).
- The lens position slider does not update when a tap on the preview changes the focus (chapter 14).
- A recording in the capture extension can get lost when the person dismisses the extension (chapter 15).
- Each activation of the app runs the mode change again, and the writes of the shared state have no order (chapter 15).

## Ideas to continue

You know the pipeline now. Each idea below uses it in a new way.

- **Fix one more weak point.** Chapter 17 corrects four items from the list above. Select one of the others, find out on an iPhone whether it is real, and repair it.
- **Use the session object of the capture extension.** Write the movie into the session directory, collect it in the app with `LockedCameraCaptureManager`, and open the app from the thumbnail button with `openApplication(for:)`.
- **Another layout for two cameras.** Chapters 19 and 20 show one camera in a small picture. Try a split screen, or write each camera to its own movie file. Check the hardware cost of each change on an iPhone. The [AVMultiCamPiP sample](https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras) is a good reference.
- **Depth.** The photo output can deliver a depth map and portrait mattes with a photo. Read [Capturing photos with depth](https://developer.apple.com/documentation/avfoundation/capturing-photos-with-depth).
- **Bayer RAW on a single lens.** Chapter 8 offers Apple ProRAW only. Bayer RAW needs a physical camera, and the virtual back camera offers only Apple ProRAW. Select a physical lens on purpose, and add a Bayer RAW choice to the RAW menu.
- **Your own filter or effect.** Chapter 20 uses [`AVCaptureVideoDataOutput`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput), a Metal kernel, and [`AVAssetWriter`](https://developer.apple.com/documentation/avfoundation/avassetwriter) to record a picture in picture. Change the kernel: draw a different frame, or apply a filter to the full picture.
- **Cinematic video.** From iOS 26, an app can record video with a depth of field that the person can change later. Read [Capturing Cinematic video](https://developer.apple.com/documentation/avfoundation/capturing-cinematic-video).
- **A second display during capture.** Chapter 18 makes the app follow the direction of each camera on iPhone Duo. The next step is content for the other display, for example a preview for the person in front of the camera. Read [Registering a camera capture accessory on iPhone Duo](https://developer.apple.com/documentation/avfoundation/registering-a-camera-capture-accessory-on-iphone-duo).
- **Swift 6 and strict concurrency.** Change the language mode to Swift 6 and repair each error. You then find the places where the sample leaves an actor without a check, for example the delegate callbacks and the Combine publishers. This is hard, and it teaches you the most about the design.

## Documentation

```links
AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The Apple sample that you built.
Capture setup | https://developer.apple.com/documentation/avfoundation/capture-setup | The collection page for sessions, devices, the preview, and controls.
Setting up a capture session | https://developer.apple.com/documentation/avfoundation/setting-up-a-capture-session | The basic article about inputs, outputs, and the preview.
Capturing still and Live Photos | https://developer.apple.com/documentation/avfoundation/capturing-still-and-live-photos | The main article about photo capture.
Building a responsive camera app that launches quickly | https://developer.apple.com/documentation/avfoundation/building-a-responsive-camera-app-that-launches-quickly | The article about the deferred start.
Enhancing your app experience with the Camera Control | https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control | System controls and custom controls.
Creating a camera experience for the Lock Screen | https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen | The capture extension and the capture intent.
PhotoKit | https://developer.apple.com/documentation/photokit | The framework that saves media to the Photos library.
Capturing photos in RAW and Apple ProRAW formats | https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats | The Apple article about RAW capture, behind chapter 8.
AVMultiCamPiP sample | https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras | The Apple sample for two cameras with a picture in picture, behind chapters 19 and 20.
AVCaptureMultiCamSession | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession | A session for more than one camera at the same time.
AVCaptureVideoDataOutput | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput | Access to each video frame.
Capturing Cinematic video | https://developer.apple.com/documentation/avfoundation/capturing-cinematic-video | A sample for Cinematic capture.
AVCaptureDeviceDirectionCoordinator | https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator | The direction of a camera in relation to a view, from iOS 27.1.
SE-0392: Custom actor executors | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0392-custom-actor-executors.md | The Swift proposal behind an actor on a dispatch queue.
SE-0420: Inheritance of actor isolation | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0420-inheritance-of-actor-isolation.md | Isolated parameters and the isolation macro.
SE-0461: Async function isolation | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md | Where an async function without isolation runs.
WWDC26: Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | The session behind the newest version of the sample.
WWDC26: Implement high resolution photo capture | https://developer.apple.com/videos/play/wwdc2026/304/ | The rules for 12, 24, and 48 megapixel photos.
WWDC25: Enhancing your camera experience with capture controls | https://developer.apple.com/videos/play/wwdc2025/253/ | Capture events, AirPods, and the Camera Control.
WWDC25: Capture cinematic video in your app | https://developer.apple.com/videos/play/wwdc2025/319/ | The API for Cinematic video.
WWDC24: Build a great Lock Screen camera capture experience | https://developer.apple.com/videos/play/wwdc2024/10204/ | The capture extension.
WWDC23: Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | Deferred processing, zero shutter lag, and responsive capture.
WWDC21: What's new in camera capture | https://developer.apple.com/videos/play/wwdc2021/10047/ | 10-bit HDR video.
WWDC19: Introducing Multi-Camera Capture for iOS | https://developer.apple.com/videos/play/wwdc2019/249/ | The multi-camera session and its hardware cost.
WWDC17: Capturing Depth in iPhone Photography | https://developer.apple.com/videos/play/wwdc2017/507/ | Depth data.
Welcome | welcome.md | The first page of this tutorial.
```
