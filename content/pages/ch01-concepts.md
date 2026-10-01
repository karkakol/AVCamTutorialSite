---
kind: article
chapter: 1
title: Concepts: first preview
abstract: How a capture session moves frames from the camera to the screen, how an app gets access to the camera, and why AVCam keeps camera work off the main thread.
estimatedMinutes: 13
branch: chapter-01
---

A camera app that only shows a live picture looks simple. But it already contains the three ideas that each camera feature builds on: a capture pipeline, permission from the person, and a strict rule about threads.

This article explains these ideas and the design that AVCam uses for them. In the [build tutorial](ch01-build.md), you write the code.

## How it works

### The capture pipeline

All camera work in AVFoundation goes through one object, the [`AVCaptureSession`](https://developer.apple.com/documentation/avfoundation/avcapturesession). A session is a graph. Media data comes in from inputs, and it goes out to outputs.

![The capture pipeline: a camera, a device input, a capture session, and a preview layer. A photo output and a movie file output come in later chapters.](../images/ch01-pipeline.svg)

The parts of the graph:

- **Device.** An [`AVCaptureDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice) is one camera or one microphone. It owns the hardware settings, such as focus, exposure, and zoom.
- **Input.** An [`AVCaptureDeviceInput`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput) connects one device to a session. An input has ports. One port carries one stream, for example video or audio.
- **Output.** An [`AVCaptureOutput`](https://developer.apple.com/documentation/avfoundation/avcaptureoutput) uses the data. There are outputs for photos, for movie files, and for single video frames.
- **Connection.** An [`AVCaptureConnection`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection) joins input ports to one output. It owns the settings of that stream, such as rotation and mirroring.
- **Preview layer.** An [`AVCaptureVideoPreviewLayer`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer) shows the camera stream on the screen. It is not an output class, but the session uses it like one: it has one connection to one video port.

You usually do not create connections. When you add an input or an output, the session connects all parts that fit together. The same occurs when you give a session to a preview layer.

So the minimum pipeline for a live preview has three steps:

1. Add a camera input to the session.
2. Give the session to a preview layer.
3. Call [`startRunning()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning()).

This is the complete camera code of chapter 1. All other code in the chapter is there for two reasons: the person must give permission, and the code must run on the correct thread.

### Authorization

The camera is a protected resource. An app gets access in two parts.

**A text in the Info.plist file.** The key [`NSCameraUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription) contains a sentence that tells the person why the app needs the camera. The system shows it in the permission alert. If the key is missing, the system stops the app at the moment when the app uses the camera API.

**A check at run time.** [`authorizationStatus(for:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/authorizationstatus(for:)) returns one of four [`AVAuthorizationStatus`](https://developer.apple.com/documentation/avfoundation/avauthorizationstatus) values:

| Status | Meaning | What the app can do |
|---|---|---|
| `.notDetermined` | The person did not answer yet. | Call `requestAccess(for:)`. The system shows the alert. |
| `.authorized` | The person allowed access. | Configure and start the session. |
| `.denied` | The person refused. | Show an explanation. The person can change the answer in Settings. |
| `.restricted` | A policy blocks the camera, for example parental controls. | Show an explanation. The person cannot change this. |

The system shows the alert only one time. After that, it remembers the answer, and [`requestAccess(for:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/requestaccess(for:completionhandler:)) returns immediately. This makes a refused alert expensive: the only way back is through the Settings app.

AVCam puts the check and the request in one async property of the capture service:

```swift file=AVCam/CaptureService.swift
    var isAuthorized: Bool {
        get async {
            let status = AVCaptureDevice.authorizationStatus(for: .video)
            // Determine whether a person previously authorized camera access.
            var isAuthorized = status == .authorized
            // If the system hasn't determined their authorization status,
            // explicitly prompt them for approval.
            if status == .notDetermined {
                isAuthorized = await AVCaptureDevice.requestAccess(for: .video)
            }
            return isAuthorized
        }
    }
```

Until the person allows access, a camera gives only black frames. Thus the order is always the same: ask first, then configure the session, then start it.

> [!NOTE]
> In the Simulator, SimCam gives the app access without the system alert. To see the alert and the denied state, use a real iPhone.

### A session blocks

`startRunning()` does not return until the session runs or fails. This can take a long time, because the system must start the camera hardware. If you call it on the main thread, the interface does not react during that time.

A session is also not made for calls from many threads at the same time. The traditional solution for the two problems is a **session queue**: one serial dispatch queue for all calls that change the session. AVCam keeps this idea, but it uses a modern form. You see it in [Why AVCam does it this way](#why-avcam-does-it-this-way).

### The preview layer in SwiftUI

SwiftUI has no camera preview view. The preview layer is a [`CALayer`](https://developer.apple.com/documentation/quartzcore/calayer), a Core Animation layer, so you need a bridge with three parts:

1. A `UIView` subclass whose own layer is the preview layer.
2. A [`UIViewRepresentable`](https://developer.apple.com/documentation/swiftui/uiviewrepresentable) structure that puts this view in SwiftUI.
3. A way to give the session to the layer.

The preview layer is the best way to show a preview when you do not need the frames yourself. The system makes it fast, and it uses little power.

## What the camera can do

Chapter 1 uses a small part of the session API. This map shows what else a session can do. It helps you to see where the later chapters go, and what is possible beyond AVCam.

| Capability | API | In this tutorial |
|---|---|---|
| Take photos | [`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput) | Chapters 3 and 7 |
| Record movie files | [`AVCaptureMovieFileOutput`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput) | Chapter 8 |
| Get each video frame, for filters or analysis | [`AVCaptureVideoDataOutput`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput) | Not in AVCam |
| Get each audio buffer | [`AVCaptureAudioDataOutput`](https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput) | Not in AVCam |
| Select a quality level | [`sessionPreset`](https://developer.apple.com/documentation/avfoundation/avcapturesession/sessionpreset) | Chapter 3 (`.photo`), chapter 8 (`.high`) |
| Select the exact sensor format | [`activeFormat`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat) | Chapter 9 |
| Change many things in one operation | [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()) | From chapter 2 |
| Rotate and mirror a stream | [`videoRotationAngle`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle), [`isVideoMirrored`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored) | Chapters 2 and 3 (rotation) |
| React to interruptions and errors | [`runtimeErrorNotification`](https://developer.apple.com/documentation/avfoundation/avcapturesession/runtimeerrornotification) and others | Chapter 10 |
| Use two cameras at the same time | [`AVCaptureMultiCamSession`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession) | Not in AVCam |
| Measure the load of a configuration | [`hardwareCost`](https://developer.apple.com/documentation/avfoundation/avcapturesession/hardwarecost) | Not in AVCam |

Three items are important to know now.

**Presets and formats.** There are two ways to tell the camera which resolution to use. A preset is a request for a quality level, such as `.photo` or `.high`, and the session selects the sensor format. The default preset is `.high`, so chapter 1 uses it without a line of code. The second way is to set `activeFormat` on the device. Then the app owns the format and the frame rate, and the session does not change them.

**Atomic changes.** Each change of a running session configures the pipeline again. If you put a group of changes between `beginConfiguration()` and `commitConfiguration()`, the session applies them together. Chapter 1 adds only one input before the session starts, so it does not need this.

**The preview layer has options.** [`videoGravity`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/videogravity) controls how the picture fits the layer. The default, `.resizeAspect`, shows the complete picture and adds bars when the shapes are different. `.resizeAspectFill` fills the layer and cuts the picture. The layer can also change a point on the screen to a point on the sensor, with [`captureDevicePointConverted(fromLayerPoint:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/capturedevicepointconverted(fromlayerpoint:)). Chapter 6 uses that for tap to focus.

## Why AVCam does it this way

### An actor on the session queue

`CaptureService` is an actor. An actor runs only one of its methods at a time, and the compiler makes sure that other code calls it with `await`. This gives the same protection as a session queue, but the compiler checks it.

There is one problem. An actor usually runs on the shared thread pool of Swift concurrency. This pool has about one thread for each processor core, and code on it must not block. A blocking call such as `startRunning()` can stop other tasks of the app.

The sample solves this with a custom executor. The actor has a serial dispatch queue, and it tells Swift to run all its code on that queue:

```swift file=AVCam/CaptureService.swift
    // The app's capture session.
    private let captureSession = AVCaptureSession()

    // A serial dispatch queue to use for capture control actions.
    private let sessionQueue = DispatchSerialQueue(label: "com.example.AVCam.sessionQueue")

    // Sets the session queue as the actor's executor.
    nonisolated var unownedExecutor: UnownedSerialExecutor {
        sessionQueue.asUnownedSerialExecutor()
    }
```

[`unownedExecutor`](https://developer.apple.com/documentation/swift/actor/unownedexecutor) is a requirement of the [`Actor`](https://developer.apple.com/documentation/swift/actor) protocol. Usually the compiler supplies it. Here, the actor supplies it and returns the queue. A [`DispatchSerialQueue`](https://developer.apple.com/documentation/dispatch/dispatchserialqueue) can be an executor from iOS 17.

![The views and the camera model are on the main actor. The capture service is on the session queue. The model calls the service with await.](../images/ch01-isolation.svg)

The result:

- A blocking call blocks only the session queue. The main thread and the shared pool stay free.
- All session calls are in one serial context, as with the traditional session queue.
- Later chapters give the same queue to AVFoundation for its callbacks. Those callbacks then run in the same context as the actor code.

The alternatives:

| Design | Result |
|---|---|
| A class with a private dispatch queue, and `queue.async` in each method | It works. This is the design from before Swift concurrency. The compiler does not check it. |
| An actor without a custom executor | It compiles. But the blocking calls run on the shared thread pool. |
| A global actor with a custom executor | Useful when many types must share the same isolation. AVCam does not need it, because only the capture service calls its helper objects. |

### No default main-actor isolation

A new project in Xcode 27.1 has the build setting Default Actor Isolation with the value `MainActor`. Then each type without an annotation belongs to the main actor. This is a good default for an app that is mostly user interface.

For a camera app it is the wrong default. The preview source, the error types, and the helper objects of later chapters must be usable from the session queue. With the default, the compiler shows a warning already in chapter 1: the initializer of `CaptureService` calls the initializer of `DefaultPreviewSource`, which then belongs to the main actor.

So the first task in the build tutorial is to set the value to `nonisolated`, as in the sample. After that, the code states the isolation of each type: `@MainActor` on the model and the views, `actor` for the capture service, and nothing for plain data types.

> [!NOTE]
> The sample uses the Swift 5 language mode with minimal concurrency checks. `@preconcurrency import AVFoundation` hides warnings about AVFoundation types that are not `Sendable`. In the Swift 6 language mode, the compiler is more strict with some patterns of the sample.

### A model between the views and the service

The views do not call the capture service. They use `CameraModel`, an `@Observable` class on the main actor. The model has two tasks:

- It holds the state as simple values, for example `status`. SwiftUI draws a view again when a value changes.
- It changes each action of the person into an `await` call to the service.

The views know the model only through the `Camera` protocol. The reason is the Xcode canvas: a preview there has no camera. `PreviewCameraModel` conforms to the same protocol and only holds values, so each view has a preview that works.

### `PreviewSource` and `PreviewTarget`

The preview layer needs the session, but the session is private in the actor. The sample does not make the session public. It uses two small protocols:

```swift file=AVCam/Views/CameraPreview.swift
protocol PreviewSource: Sendable {
    // Connects a preview destination to this source.
    func connect(to target: PreviewTarget)
}

/// A protocol that passes the app's capture session to the `CameraPreview` view.
protocol PreviewTarget {
    // Sets the capture session on the destination.
    func setSession(_ session: AVCaptureSession)
}
```

The capture service creates a source that holds the session. The view calls `connect(to:)` with itself as the target, and the source gives the session to the target. The session goes directly from the source to the layer. No view and no model has a property of the type `AVCaptureSession`, so user interface code cannot change the session by accident.

There is a second advantage. `PreviewCameraModel` has a source that does nothing, so Xcode previews need no session.

### `layerClass`, not a sublayer

`PreviewView` makes the preview layer its own backing layer:

```swift file=AVCam/Views/CameraPreview.swift
        // Use the preview layer as the view's backing layer.
        override class var layerClass: AnyClass {
            AVCaptureVideoPreviewLayer.self
        }

        var previewLayer: AVCaptureVideoPreviewLayer {
            layer as! AVCaptureVideoPreviewLayer
        }
```

Each `UIView` has one backing layer, and UIKit keeps that layer the same size as the view. [`layerClass`](https://developer.apple.com/documentation/uikit/uiview/layerclass) changes the class of that layer. Layout, animation, and rotation of the view then apply to the preview automatically.

The alternative is to add a preview layer as a sublayer. That works too, but then you must set the frame of the layer each time the view changes its size.

### Ask at launch

AVCam asks for camera access immediately at launch, because the camera is its main function. An app that uses the camera for only one feature must wait until the person opens that feature. Then the person understands why the alert appears.

AVCam checks the authorization two times: in `CameraModel.start()` and again in `CaptureService.start()`. The first check sets the `unauthorized` status for the interface. The second check protects the service itself. It costs almost nothing, because the status is known then.

## Common mistakes

- **No usage description.** The app builds and starts. Then the system stops it when it asks for camera access. Add `NSCameraUsageDescription` before the first run.
- **`startRunning()` on the main thread.** The interface does not react while the camera starts. Call it on a session queue or in an actor with a queue executor.
- **Blocking calls in an actor without a custom executor.** The code is off the main thread, but it blocks a thread of the shared pool.
- **`addInput(_:)` without `canAddInput(_:)`.** `addInput(_:)` raises an exception when the session cannot use the input. Swift cannot catch that exception, so the app stops.
- **The session starts before the person answers.** The preview is black until access is allowed.
- **`.denied` and `.restricted` get the same message.** With `.restricted`, the person cannot change the setting. Do not send the person to the Settings app in that situation. AVCam shows the same message for the two statuses, so a real app must do better here.
- **Trust in `start()`.** A session that fails to start does not throw an error. The failure arrives as a notification. In chapter 1, the model sets the `running` status when `startRunning()` returns. Chapter 10 adds the notifications.
- **State after an `await` in an actor.** An actor can start a second call while the first call waits at an `await`. Two fast calls of `start()` can both pass the `isRunning` test. Check the state again after each suspension point when the result is important.
- **A preview sublayer without layout code.** The layer keeps its first size, often zero. Use `layerClass`, or set the frame in each layout pass.
- **Layer properties from a background thread.** A layer belongs to the main thread. The sample sets `previewLayer.session` in a task on the main actor.
- **`.resizeAspectFill` without a warning to the person.** The preview then hides the edges of the picture, and the photo contains more than the person saw.

## Documentation

```links
Setting up a capture session | https://developer.apple.com/documentation/avfoundation/setting-up-a-capture-session | The Apple article about inputs, outputs, and the preview.
Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media | The Info.plist keys and the status and request flow.
AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The article for the sample that this tutorial builds.
Capture setup | https://developer.apple.com/documentation/avfoundation/capture-setup | The collection page for sessions, devices, and the preview.
AVCaptureSession | https://developer.apple.com/documentation/avfoundation/avcapturesession | The object that connects inputs to outputs.
AVCaptureDeviceInput | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput | The input for a camera or a microphone.
AVCaptureConnection | https://developer.apple.com/documentation/avfoundation/avcaptureconnection | The link between input ports and one output.
AVCaptureVideoPreviewLayer | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer | The Core Animation layer that shows the camera stream.
AVAuthorizationStatus | https://developer.apple.com/documentation/avfoundation/avauthorizationstatus | The four authorization states.
NSCameraUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription | The Info.plist key for the camera permission text.
Actor.unownedExecutor | https://developer.apple.com/documentation/swift/actor/unownedexecutor | The executor requirement of an actor.
DispatchSerialQueue | https://developer.apple.com/documentation/dispatch/dispatchserialqueue | A serial queue that can be the executor of an actor.
SE-0392: Custom actor executors | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0392-custom-actor-executors.md | The Swift Evolution proposal for the design of custom executors.
UIViewRepresentable | https://developer.apple.com/documentation/swiftui/uiviewrepresentable | The protocol that puts a UIKit view in SwiftUI.
WWDC26: Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | The session that explains why session calls block and why the preview layer is efficient.
```
