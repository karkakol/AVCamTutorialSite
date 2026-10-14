---
kind: article
chapter: 17
title: Concepts: two cameras at once
abstract: Why a plain session runs one camera, how a multi-camera session runs two, why you connect each camera to its preview by hand, and what the two costs of such a session mean.
estimatedMinutes: 14
branch: chapter-17
---

Each earlier chapter used one camera at a time. A tap on the button removed the input of one camera and added the input of the other camera. In this chapter, the app shows the back camera and the front camera at the same time: one camera fills the screen, and the other camera is a small picture in a corner. A tap exchanges the two pictures.

You learn why an [`AVCaptureSession`](https://developer.apple.com/documentation/avfoundation/avcapturesession) cannot do this, and what its subclass [`AVCaptureMultiCamSession`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession) does differently. You learn how to connect a camera to a preview layer by hand, why such a connection has no mirroring and no rotation, and how the session reports the cost of two cameras. Then you write the code in [Build: two cameras at once](ch17-build.md).

This chapter is a part of "Beyond the sample". The code is not in the Apple sample. The connection code follows a different Apple sample, [AVMultiCamPiP: Capturing from multiple cameras](https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras), changed to fit the structure of this app.

> [!IMPORTANT]
> Read this before you rely on the chapter. **Verified:** the app builds with no warnings, and it ran in the iPhone 18 Pro simulator (iOS 27.0) with a simulated camera from SimCam. There, the two cameras ran at the same time, a tap exchanged the pictures, the front picture was mirrored, and a change back to the photo mode took a photo. **Not verified:** all behavior on a real iPhone, the format selection, the two costs, the sets of cameras that can run together, an interruption in the dual mode, and iPhone Duo. The simulator reports a cost of 0 for each camera, so the facts about costs come from the Apple documentation and from the Apple sample.

## How it works

### One session, one camera

A plain `AVCaptureSession` accepts one camera input. When you add a second camera, `canAddInput(_:)` returns `false`. The reason is in the hardware: the sensors, the image signal processor, and the memory bandwidth are a shared budget. A plain session takes the full budget for one camera, so that a photo gets the best quality that the camera can give.

In the earlier chapters, this rule was no problem. The app showed one camera, and a change of the camera was a change of the input. For two cameras at the same time, you need a different session.

### The multi-camera session

[`AVCaptureMultiCamSession`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession) is a subclass of `AVCaptureSession`. It accepts more than one input of the same media type: two cameras, or two microphones. All methods of the plain session also work on it, because it is a subclass. Three things are different:

- The class property [`isMultiCamSupported`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/ismulticamsupported) tells you if the device can run it. The feature needs the A12 chip or a later one. The app reads this value one time and hides the dual mode when the value is `false`.
- Session presets do not apply. A multi-camera session always uses the `inputPriority` preset, so each camera keeps the format that you give it. In chapter 3, the preset selected a format for you. Here, you select it.
- Not every format works. A format of a camera has the property [`isMultiCamSupported`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/ismulticamsupported). The session accepts the input only when the active format of the camera has this property set to `true`. So the app sets the format before it adds the input.

The Apple documentation also gives [`supportedMultiCamDeviceSets`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/supportedmulticamdevicesets) on a discovery session. It lists the sets of cameras that can run together. Not every pair works. This app does not read the list: it takes the first back camera and the first front camera from the device lookup. The Apple sample uses the same pair. Nobody checked the list for this chapter, because the simulator was the only test device.

### Connections by hand

In the earlier chapters, you called `addInput(_:)`, and the session did the rest. It made a connection from the camera to each output that accepts video, and to the preview layer. This behavior is good for one camera. For two cameras, it is wrong: each camera would connect to each output, and the session would not know which camera belongs to which preview.

So the app makes each connection itself. The diagram shows the result.

![A multi-camera session with connections made by hand. Each camera input has a video port, and one connection links each port to its own preview layer. There are no links between a camera and the preview layer of the other camera.](../images/ch17-connections.svg)

The steps for one camera are these:

1. Call [`addInputWithNoConnections(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addinputwithnoconnections(_:)). The input joins the session, but nothing receives its frames yet.
2. Get the video port of the input. An input has one port for each stream that it supplies. The method `ports(for:sourceDeviceType:sourceDevicePosition:)` returns the ports for one media type, one device type, and one position. A camera input has one video port.
3. Call [`setSessionWithNoConnection(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/setsessionwithnoconnection(_:)) on the preview layer. The layer knows its session, but the session does not connect it.
4. Create an `AVCaptureConnection` with [`init(inputPort:videoPreviewLayer:)`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputport:videopreviewlayer:)). The connection links the port to the layer.
5. Ask [`canAddConnection(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddconnection(_:)), and then call [`addConnection(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addconnection(_:)).

For an output, the method is the same. You add the output with [`addOutputWithNoConnections(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutputwithnoconnections(_:)), and you create the connection with [`init(inputPorts:output:)`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputports:output:)). This chapter adds no output. The next chapter does.

### No mirroring and no rotation

A connection that the session makes gets two automatic settings. It mirrors the preview of a camera with the front position, and it gives the preview the rotation angle of the device. A connection that you make gets nothing. In the first test of this chapter, the front preview was not mirrored, and the back preview was mirrored, because its layer kept an old setting.

So the app sets both values on each connection:

- It sets [`automaticallyAdjustsVideoMirroring`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyadjustsvideomirroring) to `false`, and then [`isVideoMirrored`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored) to `true` for the front camera only. The order matters: the second assignment raises an exception while the first value is `true`. Chapter 16 gave you this rule. Here, the rule uses the position of the camera, because the dual mode has no direction coordinator.
- It creates an [`AVCaptureDevice.RotationCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator) for the camera and the layer, and gives the connection the preview angle. The app sets the angle one time. It does not observe later changes of the angle in the dual mode.

### Two costs

Two cameras use more of the hardware than one camera. The session tells you how much, with two numbers:

- [`hardwareCost`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/hardwarecost) is the part of the hardware budget that the configuration uses: sensors, image signal processor, memory bandwidth. Above 1.0, the session cannot run.
- [`systemPressureCost`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/systempressurecost) is the thermal and power load. Above 1.0, the device becomes hot soon, and the system can stop the session.

The formats of the two cameras set the costs. A larger format, a higher frame rate, and more video ports all make a cost larger. This app keeps the costs low with its format selection: the largest multi-camera format up to 1920 pixels wide, with the highest frame rate at that width. Then it writes the two costs to the log and does nothing else with them.

The Apple sample does more. After the configuration, it reads the two costs. When a cost is above 1.0, it reduces the resolution of the formats. When that is not enough, it reduces the frame rate. When that is still not enough, it removes video ports. It also observes the system pressure state while the session runs, and lowers the frame rate under pressure. This is the correct behavior for a shipping app.

### The start blocks

[`startRunning()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning()) is a blocking call on each session. On a multi-camera session, it can block for a longer time, because two cameras must start. The Apple sample tells you never to call it on the main queue. This app calls it on the `CaptureService` actor, which is the rule of chapter 1 for all session calls. In the simulator, the second preview showed its first frame up to 20 seconds after the first preview.

## What the camera can do

The multi-camera API offers more than this chapter uses:

- **Device sets.** `supportedMultiCamDeviceSets` tells you which cameras can run together. On some devices, two back cameras can run at the same time, for example the wide camera and the ultra wide camera. The app uses the back camera and the front camera only.
- **Data outputs.** An [`AVCaptureVideoDataOutput`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput) for each camera gives your code the frames. The Apple sample connects one to each camera, and a Metal shader draws the small picture into the large picture. This app has no data output. It shows the cameras, and it captures nothing in the dual mode.
- **A movie from two cameras.** The Apple sample writes the mixed frames and the audio with an [`AVAssetWriter`](https://developer.apple.com/documentation/avfoundation/avassetwriter), not with a movie file output, because a movie file output takes the frames of one connection only.
- **Two microphones.** A multi-camera session accepts the microphone one time, with two [`AVCaptureAudioDataOutput`](https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput) objects. The microphone input has one audio port for each position. The Apple sample connects the front audio port to the front camera and the back audio port to the back camera, so each half of the picture gets the sound from its side.
- **Cost control.** The two cost properties, and the system pressure state of a camera, give an app the data to reduce the load before the system stops the session.

Chapter 18 adds the data outputs, the Metal mixer, the asset writer, and the microphone to this app.

## Why this app does it this way

**A second session, not a replacement.** The app could replace its `AVCaptureSession` with an `AVCaptureMultiCamSession` and run one session in all modes. It does not. The photo mode and the video mode keep their session, their presets, their deferred start, and their outputs, which chapters 3 to 15 built. The `MultiCamCapture` object owns a second session. Two sessions cannot run at the same time, so the capture service stops one session before it starts the other. The cost is a short black screen at each change of the mode.

**The single preview stays in place.** `CaptureService` connects the preview layer of `CameraPreview` during the setup, and later code reads this connection. So the view stays in the view tree in each mode. In the dual mode, `DualCameraPreview` covers it as an overlay.

**The preview views come first.** The two preview layers belong to UIKit views, and the views exist only when SwiftUI shows them. So the service cannot configure the multi-camera session during its setup. It waits for the views: `DualPreviewSource.connect(back:front:)` gives the two layers to the service, and the service configures the session then. A launch directly in the dual mode and a change to the dual mode both go through this method.

**Position, not direction.** Chapter 16 mirrored the preview by the direction of the camera. The dual mode has two previews and no direction coordinator. It mirrors the front position, as the automatic setting does. On iPhone Duo, this can be wrong after a person closes the device. A direction coordinator for each preview view is a task for later.

**A fallback at the start.** The app stores the last mode. A person can select the dual mode on one device, and the state can go to a device without support. So `start(with:)` changes a stored dual mode to the photo mode when `isMultiCamSupported` is `false`.

**One file for the session, one file for the views.** `MultiCamCapture` has the AVFoundation code. `DualCameraPreview` has the SwiftUI view, a `UIViewRepresentable`, and a container view that lays out the two preview views. The container does the layout in UIKit, with a frame for each preview, because the preview views are UIKit views and an animation of two frames is simple there.

## Common mistakes

- **`addInput(_:)` on a multi-camera session.** The session connects the camera to each output and to the preview layer. The second camera then has no place to go, or both cameras go to the same output. Use `addInputWithNoConnections(_:)` and make the connections.
- **A format that is not a multi-camera format.** `canAddInput(_:)` returns `false`, and the app sees only a failed input. Set a format with `isMultiCamSupported` before you add the input.
- **A session preset on a multi-camera session.** The session ignores it. Select the format of each camera yourself.
- **A preview layer with `session` set.** The property makes a connection. Use `setSessionWithNoConnection(_:)`, and then add your own connection.
- **No mirroring and no rotation.** A connection that you make has no automatic values. Set `automaticallyAdjustsVideoMirroring` to `false` first, then `isVideoMirrored`, and give the connection a rotation angle.
- **Two sessions that run at the same time.** The second session cannot get the camera. Stop one session before you start the other.
- **`startRunning()` on the main actor.** The call blocks, and the interface stops. Call it on the actor that owns the session.
- **A cost above 1.0 that nobody reads.** On a real device, two large formats can exceed the budget, and the session does not run. Read the two costs after the configuration, and reduce the formats when a cost is too high.
- **A test in the simulator only.** The simulator reports a cost of 0 for each configuration and runs each pair of simulated cameras. Test the dual mode on a real iPhone before you ship it.

## Documentation

```links
AVCaptureMultiCamSession | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession | The session subclass that runs more than one camera.
isMultiCamSupported | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/ismulticamsupported | The class property that tells you if the device can run a multi-camera session.
Format.isMultiCamSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/ismulticamsupported | The property that tells you if a format works in a multi-camera session.
supportedMultiCamDeviceSets | https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/supportedmulticamdevicesets | The sets of cameras that can run together.
addInputWithNoConnections(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addinputwithnoconnections(_:) | Adds an input and makes no connection.
addOutputWithNoConnections(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutputwithnoconnections(_:) | Adds an output and makes no connection.
setSessionWithNoConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/setsessionwithnoconnection(_:) | Gives a preview layer its session and makes no connection.
AVCaptureConnection(inputPort:videoPreviewLayer:) | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputport:videopreviewlayer:) | A connection from one port to a preview layer.
AVCaptureConnection(inputPorts:output:) | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputports:output:) | A connection from ports to an output.
canAddConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddconnection(_:) | Tells you if the session accepts a connection.
addConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addconnection(_:) | Adds a connection that you made.
automaticallyAdjustsVideoMirroring | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyadjustsvideomirroring | The property that lets a connection decide the mirroring from the position.
isVideoMirrored | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored | The property that mirrors the video of a connection.
hardwareCost | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/hardwarecost | The part of the hardware budget that the configuration uses.
systemPressureCost | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/systempressurecost | The thermal and power load of the configuration.
startRunning() | https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning() | The blocking call that starts a session.
AVCaptureVideoDataOutput | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput | The output that gives your code the frames of a camera.
AVCaptureAudioDataOutput | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput | The output that gives your code the samples of a microphone.
AVAssetWriter | https://developer.apple.com/documentation/avfoundation/avassetwriter | The object that writes frames and samples to a movie file.
AVMultiCamPiP sample | https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras | The Apple sample that this chapter borrows the connection code from.
WWDC19 session 225 | https://developer.apple.com/videos/play/wwdc2019/225/ | Introducing Multi-Camera Capture for iOS.
Concepts: iPhone Duo | ch16-concepts.md | The mirroring rule and the direction of a camera.
Concepts: the session | ch01-concepts.md | The session, the inputs, the outputs, and the capture actor.
Build: two cameras at once | ch17-build.md | The tutorial for this chapter.
```
