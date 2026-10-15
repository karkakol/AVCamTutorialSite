---
kind: article
chapter: 2
title: Concepts: cameras
abstract: What a capture device is, how an app finds the cameras, how a session changes its camera, and how rotation works.
estimatedMinutes: 14
branch: chapter-02
---

In chapter 1, the app asked for one camera by name: the wide camera on the back. That is sufficient for a first preview. It is not sufficient for a real camera app. An iPhone has many cameras. An iPad can have a camera on a USB cable. The person wants to select a camera, and the system has an opinion too.

In this chapter, you learn how the cameras of a device are organized, how to find them, and how to change the camera while the session runs. You also learn how the preview stays level when the device turns. Then you write the code in [Build: cameras](ch02-build.md).

## How it works

### A capture device is a camera

An [`AVCaptureDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice) object represents one source of media: a camera or a microphone. You do not create a device object. The system has one object for each device, and you ask the system for it.

A camera device has three properties that identify it:

- The **device type** ([`AVCaptureDevice.DeviceType`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct)) tells you what kind of camera it is, for example `.builtInWideAngleCamera`.
- The **position** ([`AVCaptureDevice.Position`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/position-swift.enum)) is `.back`, `.front`, or `.unspecified`.
- The **unique identifier** ([`uniqueID`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/uniqueid)) is a string that stays the same for one camera.

The device object is also the place where you control the hardware: focus, exposure, zoom, and the video format. Later chapters use these controls.

### Physical devices and virtual devices

There are two kinds of camera device.

A **physical device** is one lens with one sensor. An iPhone can have three physical cameras on the back: the ultra-wide camera, the wide camera, and the telephoto camera.

A **virtual device** is a group of physical cameras that the system shows to your app as one camera. The physical cameras in the group are its constituent devices.

![Three physical back cameras and the three virtual devices that group them](../images/ch02-virtual-devices.svg)

A virtual device does work that is hard to do yourself:

- It changes from one physical camera to the next when the zoom factor changes. The person sees one smooth zoom.
- It changes camera when the light is low or the subject is very near. For example, a wider camera can replace the telephoto camera when the telephoto camera cannot focus.
- Some virtual devices can calculate depth, because two cameras see the scene from two points.

The cost is control. The multi-camera virtual devices do not let you lock the exposure to custom values, and they do not let you lock the focus at a lens position that you select. If you need full manual control, select a physical device. If you want a smooth zoom and automatic quality, select a virtual device.

> [!NOTE]
> Do not write these limits into your code as fixed rules. They change between iOS versions. Ask the device what it supports before you use a control.

### Discovery sessions

The simple lookup from chapter 1, [`AVCaptureDevice.default(_:for:position:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/default(_:for:position:)), returns one device of one type. It cannot answer the question "which is the best back camera of this iPhone?", because the answer is different for each model.

An [`AVCaptureDevice.DiscoverySession`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession) answers that question. You give it three filters:

- a list of device types,
- a media type (`.video` for cameras),
- a position.

Its [`devices`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/devices) property returns the devices that match. Two rules are important:

1. **The list of device types is a complete list.** A device type that you do not name is never in the result.
2. **The result has the order of your list.** If you put `.builtInDualCamera` before `.builtInWideAngleCamera`, the dual camera comes first when the device has one. So the list is a priority list, and `devices.first` is "the best camera that this device has, by my priorities".

This is how AVCam finds its back camera:

```swift file=AVCam/Capture/DeviceLookup.swift
        backCameraDiscoverySession = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInDualCamera, .builtInWideAngleCamera],
                                                                      mediaType: .video,
                                                                      position: .back)
```

On an iPhone with a telephoto camera, the first result is the dual camera. On an iPhone or iPad with one back camera, the first result is the wide camera.

A discovery session also stays up to date. Its `devices` array changes when a camera connects or disconnects, and you can observe it.

### The preferred camera

Which camera must the app show when it starts? A fixed answer ("the back camera") is wrong in some situations. An example: a person connects a USB camera to an iPad. That action tells you that the person wants to use that camera.

Two class properties of `AVCaptureDevice` solve this problem together:

- [`userPreferredCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/userpreferredcamera) is a property that your app writes. You set it each time the person selects a camera. The system keeps a short history of these selections for your app. The history stays when the app stops and when the device restarts.
- [`systemPreferredCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempreferredcamera) is a property that your app reads. The system calculates it from the history of the user's selections and from facts that only the system knows, such as "an external camera connected a moment ago" or "this camera is not available now".

The contract has two parts:

1. When the person selects a camera in your interface, write the selection to `userPreferredCamera`.
2. Use `systemPreferredCamera` as the camera at the start, observe it, and change the camera of the session when it changes.

AVCam does the two parts. As a result, the app starts with the camera that the person used last, and it changes to an external camera when one connects.

### How a session changes its camera

An [`AVCaptureDeviceInput`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput) connects one device to one session. A normal `AVCaptureSession` accepts only one camera input at a time. Thus you cannot add the front camera while the back camera is attached: [`canAddInput(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddinput(_:)) returns `false`.

To change the camera, you remove the old input and then add the new input. You do the two operations between [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()).

![The four operations of a camera switch, and the fallback when the new input fails](../images/ch02-switch-input.svg)

The begin and commit calls make a group of changes. The session applies all changes of the group together when the commit runs. So the removal and the addition become one change of the session, not two.

The new input can fail. The initializer of `AVCaptureDeviceInput` throws an error when the device is not available. If that occurs, AVCam adds the old input again, so that the app continues with the camera that it had.

During the change, there is a short gap in the frames of the preview, and then the other camera appears with a different field of view. AVCam hides this gap with a blur effect.

> [!NOTE]
> There is a session class that accepts more than one camera at the same time: [`AVCaptureMultiCamSession`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession). You use it for a picture-in-picture recording of the front and back cameras, for example. It has more rules and a higher cost for the hardware. AVCam does not use it. The Apple sample [AVMultiCamPiP](https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras) shows how it works.

### Rotation

A camera sensor has a fixed position in the device. When the person turns the device, the sensor turns with it, and the image data comes out turned. The app must tell the capture pipeline how many degrees to rotate the video.

There is not one angle. There are two:

- The **preview angle** makes the video level in the preview on the screen. It depends on how the device is held and on how the interface is turned.
- The **capture angle** makes photos and movies level relative to gravity. It depends only on how the camera is held.

The two angles are different when the interface does not turn with the device. Think of an app that stays in portrait. The person turns the iPhone to landscape to take a photo. The interface does not turn, so the preview angle does not change. But the photo must be a landscape photo, so the capture angle changes.

![A rotation coordinator gives a preview angle to the preview layer and a capture angle to the outputs](../images/ch02-rotation-angles.svg)

An [`AVCaptureDevice.RotationCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator) calculates the two angles. You create it with a device and a preview layer. It has two properties:

- [`videoRotationAngleForHorizonLevelPreview`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelpreview)
- [`videoRotationAngleForHorizonLevelCapture`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture)

You can observe the two properties with key-value observing (KVO). You apply an angle to a connection with its [`videoRotationAngle`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle) property. The value is in degrees, and only 0, 90, 180, and 270 are permitted.

In this chapter, you apply the preview angle to the connection of the preview layer. In chapter 3, you apply the capture angle to the photo output.

The older API is [`videoOrientation`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videoorientation), with the values portrait, landscape left, and so on. It is deprecated since iOS 17. An orientation value assumes that the camera turns together with the device. An external camera does not: it stays on its stand when the person turns the iPad. A coordinator knows that, and gives 0 degrees for an external camera.

## What the camera can do

AVCam uses a small part of the device API. This is the full map.

### Device types on iPhone and iPad

| Device type | Kind | Since iOS | What it is |
|---|---|---|---|
| [`.builtInWideAngleCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinwideanglecamera) | Physical | 10.0 | The general camera. An iPhone or iPad usually has one on the back and one on the front. |
| [`.builtInUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinultrawidecamera) | Physical | 13.0 | The camera with the short focal length (the "0.5x" camera). |
| [`.builtInTelephotoCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintelephotocamera) | Physical | 10.0 | The camera with the long focal length. |
| [`.builtInOuterUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera) | Physical | 27.1 | The ultra-wide camera on the outer side of iPhone Duo. See chapter 18. |
| [`.builtInInnerUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtininnerultrawidecamera) | Physical | 27.1 | The ultra-wide camera on the inner side of iPhone Duo. See chapter 18. |
| [`.builtInDualCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualcamera) | Virtual | 10.2 | Wide and telephoto. It can supply depth. |
| [`.builtInDualWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualwidecamera) | Virtual | 13.0 | Ultra-wide and wide. It can supply depth. |
| [`.builtInTripleCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintriplecamera) | Virtual | 13.0 | Ultra-wide, wide, and telephoto. |
| [`.builtInTrueDepthCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintruedepthcamera) | Virtual | 11.1 | The front color camera together with an infrared camera. It supplies depth. |
| [`.builtInLiDARDepthCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinlidardepthcamera) | Virtual | 15.4 | A back color camera together with the LiDAR scanner. It supplies accurate depth. |
| [`.external`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/external) | Physical | 17.0 | A USB camera that is connected to an iPad. It has no front or back position. |
| [`.continuityCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/continuitycamera) | — | 17.0 | An iPhone that operates as the camera of a Mac or an Apple TV. |

Which types exist depends on the model. That is the reason for discovery sessions: you ask, and you do not assume.

The table has every camera type of the iOS 27.1 SDK. Three more types exist, but they are not cameras on iPhone: [`.microphone`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/microphone) is the audio device type (its old name, [`.builtInMicrophone`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinmicrophone), is deprecated since iOS 17), [`.builtInDuoCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinduocamera) is the deprecated old name of the dual camera, and [`.deskViewCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/deskviewcamera) exists on macOS only.

### Control of a virtual device

A virtual device tells you how it works, and lets you change its behavior:

- [`isVirtualDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvirtualdevice) and [`constituentDevices`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/constituentdevices) give you the physical cameras of the group.
- [`virtualDeviceSwitchOverVideoZoomFactors`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/virtualdeviceswitchovervideozoomfactors) gives you the zoom factors at which the next camera can take over. A camera app uses these values for its "0.5x, 1x, 2x" buttons.
- [`activePrimaryConstituent`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituent) tells you which physical camera supplies the frames now.
- [`setPrimaryConstituentDeviceSwitchingBehavior(_:restrictedSwitchingBehaviorConditions:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setprimaryconstituentdeviceswitchingbehavior(_:restrictedswitchingbehaviorconditions:)) lets you decide when the device can change camera: automatically, only in specified conditions, or not at all. A video app uses this to prevent a visible jump during a recording.

One surprise: on a virtual device that includes the ultra-wide camera, the zoom factor 1.0 is the field of view of the ultra-wide camera. The "1x" of the Camera app is then the first switch-over zoom factor, not 1.0.

### More ways to find and describe cameras

- Observe the `devices` property of a discovery session, or use [`wasConnectedNotification`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/wasconnectednotification) and [`wasDisconnectedNotification`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/wasdisconnectednotification), to keep a camera list in your interface up to date.
- [`supportsSessionPreset(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/supportssessionpreset(_:)) tells you if a camera can work with a preset. An external camera can have few formats, so this test is important before a switch.
- [`isSuspended`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/issuspended) tells you that a camera exists but supplies no data at this time.
- [`minimumFocusDistance`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/minimumfocusdistance) and [`nominalFocalLengthIn35mmFilm`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/nominalfocallengthin35mmfilm) describe the lens. You can show a "move back" hint or a "24 mm" label with them.
- [`supportedMultiCamDeviceSets`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/supportedmulticamdevicesets) tells you which cameras can run at the same time in a multi-camera session.

### More about rotation

- The preview layer in the coordinator can be any Core Animation layer. If you draw the preview yourself, you give the coordinator your layer.
- The cost of rotation depends on the output. For the preview layer, a photo, and a movie file, the rotation is only a transform or a metadata value. For an output that gives you each video frame, the system must turn each pixel buffer, which is expensive.
- [`isVideoRotationAngleSupported(_:)`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideorotationanglesupported(_:)) tells you if a connection accepts an angle.
- iOS 27 adds [`videoRotationAngleRelative(toDeviceOrientation:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationanglerelative(todeviceorientation:)). It gives the angle for an orientation that you select, for example for an "always record in landscape" option.

## Why AVCam does it this way

**Three discovery sessions, one camera from each.** A discovery session filters by one position. AVCam wants one back camera, one front camera, and one external camera, so it keeps three sessions and takes the first device of each. The switch button goes through this list of a maximum of three cameras. This is a simple model that is correct on each iPhone and iPad.

**The system-preferred camera is the default.** AVCam does not decide which camera is the first one. It asks the system. There is one exception. If the system has no preferred camera when the app starts, AVCam writes the back camera to `userPreferredCamera`. A camera app usually starts with the back camera, and this is how the app tells the system.

**The user preference changes only after a tap.** AVCam writes to `userPreferredCamera` in the method that the switch button calls, and not in the method that changes the input. The second method also runs when the system-preferred camera changes. That change is a decision of the system, not of the person. If the app recorded it as a user selection, the history would contain selections that the person did not make.

**One switch button, not zoom buttons.** The back list is `[.builtInDualCamera, .builtInWideAngleCamera]`. It does not contain `.builtInTripleCamera` or `.builtInDualWideCamera`. So AVCam never uses the ultra-wide camera, also on an iPhone that has one. An app that wants "0.5x" asks for the larger virtual devices first:

```swift
let backCameras = AVCaptureDevice.DiscoverySession(
    deviceTypes: [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera, .builtInWideAngleCamera],
    mediaType: .video,
    position: .back)
let bestBackCamera = backCameras.devices.first
```

**A new rotation coordinator for each camera.** A coordinator belongs to one device for its full life. When the camera changes, AVCam makes a new coordinator and new observers.

**The capture service does the rotation work.** AVCam creates the coordinator inside the `CaptureService` actor and sends each new angle through two tasks: one to the actor and one to the main actor. This is easy to read, but tasks do not guarantee their order. If the angle changes two times very quickly, the older value can arrive last. Apple's article [Supporting device rotation in your camera app](https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app) describes a different design that observes on the main actor and keeps the order. This tutorial follows the code of the sample.

Other limits of the simple design:

- The state of the old camera does not move to the new camera. Zoom, focus mode, and exposure settings belong to the device object. An app that sets them must set them again after a switch.
- The fallback in the `catch` block adds the old input without a test with `canAddInput(_:)`.
- The object that observes the system-preferred camera never removes its observer. In AVCam the object lives as long as the app, so this is not a problem. It is a problem if you copy the class into an object with a shorter life.

## Common mistakes

- **A wrong order in the device type list.** If `.builtInWideAngleCamera` is the first type, `devices.first` is always the wide camera, and you never get a virtual device.
- **A new device type that is not in the list.** A discovery session never returns a type that you did not ask for. A new camera type in a new iPhone does not appear in your app until you add it.
- **A second camera input without removal of the first.** `canAddInput(_:)` returns `false`. The code in chapter 1 then throws an error.
- **A change of a running session without `beginConfiguration()`.** The session then applies the removal and the addition as two separate changes.
- **A write to `userPreferredCamera` for each camera change.** Write it only for a selection that the person made.
- **No observation of `systemPreferredCamera`.** The app then ignores a camera that the person connects.
- **No initial rotation angle.** KVO tells you about changes that occur after you start to observe. Apply the current angle one time when you create the coordinator.
- **Angles from `UIDevice.orientation`.** This does not work when the device lies flat or with an external camera. Use the coordinator.
- **One coordinator for all cameras.** After a switch, the old coordinator still calculates angles for the old camera.

> [!IMPORTANT]
> In the Simulator, SimCam supplies one back camera and one front camera. You can test the switch button there. The system-preferred camera path needs an external camera on an iPad, and rotation needs a real device. Test these two features on hardware before you rely on them.

## Documentation

```links
Choosing a capture device | https://developer.apple.com/documentation/avfoundation/choosing-a-capture-device | The article about default devices and discovery sessions.
AVCaptureDevice | https://developer.apple.com/documentation/avfoundation/avcapturedevice | A camera or a microphone, and the controls of its hardware.
AVCaptureDevice.DeviceType | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct | The list of all device types.
AVCaptureDevice.DiscoverySession | https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession | The object that finds devices by type, media type, and position.
systemPreferredCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempreferredcamera | The camera that the system recommends at this time.
userPreferredCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/userpreferredcamera | The camera that the person selected, which the system keeps for your app.
AVCaptureDeviceInput | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput | The object that connects a device to a session.
AVCaptureMultiCamSession | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession | A session that runs more than one camera at the same time.
AVCaptureDevice.RotationCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator | The object that calculates the preview angle and the capture angle.
Supporting device rotation in your camera app | https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app | Apple's article about rotation, with a newer design than the code in this chapter.
WWDC23: Support external cameras in your iPadOS app | https://developer.apple.com/videos/play/wwdc2023/10106/ | The session that introduces the preferred camera properties and the rotation coordinator.
WWDC19: Advances in Camera Capture & Photo Segmentation | https://developer.apple.com/videos/play/wwdc2019/225/ | The session that introduces the virtual devices of iOS 13.
WWDC19: Introducing Multi-Camera Capture for iOS | https://developer.apple.com/videos/play/wwdc2019/249/ | The session about the multi-camera session.
Build: cameras | ch02-build.md | The tutorial for this chapter.
```
