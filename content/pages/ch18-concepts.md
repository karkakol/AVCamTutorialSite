---
kind: article
chapter: 18
title: Concepts: iPhone Duo
abstract: Why the position of a camera is not the direction that it faces, how a direction coordinator reports the direction, how the preview gets the correct mirroring, and how the interface gets to the center of the Duo display.
estimatedMinutes: 14
branch: chapter-18
---

Until now, one rule was true for each iPhone: the front camera looks at the person, and the back cameras look at the scene. Your code used this rule each time it read the position of a camera. iPhone Duo breaks the rule. It has a display on each side and a camera above each display. When a person opens or closes the device, the app moves to the other display, and a camera that looked at the scene can now look at the person.

In this chapter, you learn the difference between the position of a camera and its direction. You learn how the system reports the direction, what the app does with the report, and why the preview needs a new mirroring rule. You also learn why the interface of the app was not in the center of the Duo display. Then you write the code in [Build: iPhone Duo](ch18-build.md).

This chapter is a part of "Beyond the sample". The code is not in the Apple sample. It follows the Apple article [Choosing a camera by the direction it faces](https://developer.apple.com/documentation/avkit/choosing-a-camera-by-the-direction-it-faces), changed to fit the structure of this app.

> [!IMPORTANT]
> Read this before you rely on the chapter. **Verified:** the app builds, and it ran in the iPhone Duo simulator (iOS 27.1) with a simulated camera from SimCam. There, the interface moved to the center of the display, and the direction coordinator reported the two simulated cameras one time. **Not verified:** all behavior on a real iPhone Duo, a change of direction (a person opens or closes the device), the camera change that follows it, the mirroring, and the two new camera types. The facts about these things come from the Apple documentation and the SDK headers. This article tells you each time when a statement comes only from a read of the code.

## How it works

### Position against direction

In chapter 2, you learned that a camera has a [`position`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/position-swift.enum): `.front`, `.back`, or `.unspecified`. The position tells you where the camera sits on the device. It is a property of the hardware, and it never changes.

The **direction** is a different thing. It tells you which way the camera looks in relation to the view that shows your preview:

- A **forward-facing** camera looks at the person who looks at the preview.
- A **backward-facing** camera looks at the scene behind the preview.

On an iPhone with one display, the position and the direction always agree. So one value did the work of two. On iPhone Duo, the direction depends on the display that shows your app. The Apple article says that two cameras with different positions can face the same way.

![The same two cameras in two configurations of the device. The position of each camera stays the same, and the direction of each camera changes.](../images/ch18-position-direction.svg)

This has a useful result. A back camera can face the person. That is how a person takes a selfie with the best camera of the device, and sees the preview at the same time.

It also has a result that breaks old code. Each line that reads `position == .front` and means "this camera looks at the person" can now be wrong. The system does not put the direction in a property of the device. Only one object reports it: the direction coordinator.

### The virtual front camera

You do not always need the coordinator. For the front position, the system gives iPhone Duo a **virtual front camera**. The Apple article says these things about it:

- A discovery session with the front position and the type `.builtInWideAngleCamera` or `.builtInUltraWideCamera` returns it.
- It streams from the camera above the display that shows your app. When the person opens or closes the device, the system changes the physical camera for you.
- It is a virtual device, so [`isVirtualDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvirtualdevice) is `true`. Its [`activePrimaryConstituent`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituent) tells you which physical camera streams now. The value is `nil` until the session runs.
- It can do only the things that the two physical cameras can both do.

The front discovery session of this app asks for `.builtInTrueDepthCamera` first, and then for `.builtInWideAngleCamera`. The article says nothing about the TrueDepth type. If iPhone Duo has no TrueDepth camera, the front camera of the app is probably the virtual front camera, and the selfie camera continues to work with no change. Nobody examined this on a device.

So when is the coordinator necessary? In two situations:

- A back camera is selected, and the device changes its configuration. The back camera now faces the person.
- The app captures from the two physical front cameras directly, to get all their capabilities. The types are [`.builtInOuterUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera) and [`.builtInInnerUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtininnerultrawidecamera). Then no virtual device does the work, and the app must follow the direction itself.

This app handles the first situation. It does not capture from the two physical front cameras.

### The coordinator, the map, and the descriptor

Three classes of AVKit work together. All three need iOS 27.1.

An [`AVCaptureDeviceDirectionCoordinator`](https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator) observes the directions. Its initializer, [`init(view:deviceTypes:changeHandler:)`](https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator/init(view:devicetypes:changehandler:)), takes three values:

- **The view.** It is the frame of reference: "forward" means "the same way as this view". The coordinator draws nothing in the view.
- **The device types.** List each built-in camera type that your app captures from, and include the back cameras. External cameras, Continuity cameras, and Desk View cameras have no effect. The coordinator also leaves out the virtual front camera, because the system moves that camera itself. To follow the front cameras, list the two physical types in its place.
- **The change handler.** The coordinator calls it on the main queue, a short time after you create the coordinator, and again after each change.

You must hold a strong reference to the coordinator while the view is on the screen. Without a reference, the object goes away, and the reports stop.

An [`AVCaptureDeviceDirectionMap`](https://developer.apple.com/documentation/avkit/avcapturedevicedirectionmap) is one report. It has two arrays: `forwardFacingDeviceDescriptors` and `backwardFacingDeviceDescriptors`. The SDK header says that each array can be empty. The coordinator also has a `deviceDirections` property with the current map. It is an empty map until the first call of the handler.

An [`AVCaptureDeviceDescriptor`](https://developer.apple.com/documentation/avkit/avcapturedevicedescriptor) is one element of an array. It identifies a camera with five properties: `deviceType`, `mediaTypes`, `position`, `uniqueID`, and `localizedName`. It is not the camera. It does not reserve the camera, and it gives you no control of the hardware. To get the camera, you create an `AVCaptureDevice` from the unique identifier. The result can be `nil`, because the set of cameras can change between the report and your code.

On an iPhone with one display, the coordinator also works. The Apple article says that front cameras are in the forward-facing array, back cameras are in the backward-facing array, cameras with an unspecified position are in no array, and the handler runs one time. Thus one code path is correct for each iPhone.

### Two actors

The coordinator must live on the main actor. The reason is its frame of reference: a view, and the state of a view belongs to the main actor. The SDK header says that you must create the coordinator on the main thread, and that the handler runs on the main queue.

The capture session lives in a different place. In this app, the `CaptureService` actor owns the session, and all camera code runs on its session queue. Apple gives a clear rule: do not call AVFoundation from the change handler. Give the report to the actor that owns the session, and create the device there.

![The path of a direction report. The coordinator in the preview view makes a map on the main actor. The app keeps only the identifiers. The capture service creates the device on the capture actor.](../images/ch18-direction-flow.svg)

A value that goes from one actor to a second actor must be `Sendable`. The map and the descriptor are `Sendable`, so the app could send them. This app sends less: only the unique identifiers, in a small value type of its own.

```swift file=AVCam/Model/DataTypes.swift
struct CameraDirections: Sendable, Equatable {
    /// The unique identifiers of the cameras that face the person who looks at the preview.
    let forwardFacing: [String]
    /// The unique identifiers of the cameras that face the scene behind the preview.
    let backwardFacing: [String]
}
```

The section [Why this app does it this way](#why-this-app-does-it-this-way) gives the reason.

### What the app does with a new map

The capture service keeps two things: the last map, and the direction that the person selected. The camera that the app starts with sets the selected direction, and each tap on the button that changes the camera sets it again.

When a new map arrives, the service uses a rule from the Apple article: keep the selected camera if it still faces the selected direction. If it does not, select a replacement from the array of that direction.

1. If the selected camera is in no array, do nothing. This is true for an external camera and for the virtual front camera.
2. Get the array for the selected direction.
3. If the selected camera is in that array, keep it, and only examine the mirroring.
4. If it is not, look for the best camera in the array, and make it the input of the session. If the array is empty, keep the camera, and examine the mirroring.

The replacement uses the method from chapter 2: remove one input, add one input, in one configuration. Apple recommends this, and not a multi-camera session, because it costs less.

Apple also recommends that you cover the preview during the change, because frames of the old camera can still arrive. This app does not do that. Its blur effect runs only when the person taps the button.

### Mirroring by direction

A person expects a mirror image from a camera that looks at them. The preview connection supplies this by itself: with [`automaticallyAdjustsVideoMirroring`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyadjustsvideomirroring) set to `true`, it mirrors the preview of each camera with the front position. That rule uses the position. On iPhone Duo, it can give the wrong result.

| Position | Direction | Automatic result | Correct result | The app |
|---|---|---|---|---|
| front | forward | mirrored | mirrored | leaves the automatic mirroring on |
| back | backward | not mirrored | not mirrored | leaves the automatic mirroring on |
| back | forward | not mirrored | mirrored | sets `isVideoMirrored` to `true` |
| front | backward | mirrored | not mirrored | sets `isVideoMirrored` to `false` |

The app takes control only in the last two rows, where the position and the direction disagree. This is the rule of the Apple article. In the first two rows, the app sets `automaticallyAdjustsVideoMirroring` to `true`. Thus a connection that the app controlled earlier goes back to the system when the position and the direction agree again.

Three details are easy to get wrong:

- Set `automaticallyAdjustsVideoMirroring` to `false` first, and then set [`isVideoMirrored`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored). The other order raises an exception.
- Read `isVideoMirroringSupported` before the two assignments. A connection that does not support mirroring raises an exception too.
- A new camera input makes a new preview connection, and the new connection knows nothing about your values. Set the mirroring again after each change of the camera.

This chapter mirrors only the preview. It does not change the mirroring of photos and movies.

### Rotation

In chapter 2, you created an [`AVCaptureDevice.RotationCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator) for the selected camera and the preview layer. The Apple article says two things about it for iPhone Duo:

- The angles also change when the app moves from one display to the other display.
- A rotation coordinator belongs to one camera. Create a new one after each change of the camera.

The app already does the second point: `changeCaptureDevice(to:)` creates a rotation coordinator for each new camera. Thus this chapter adds no rotation code. A change of direction goes through the same method, so it gets a new rotation coordinator too. Nobody examined the angles on a device.

### The Duo display and its safe area

The second problem of this chapter is a layout problem. It has no relation to the cameras.

The display of the Duo simulator is 466 by 678 points. With a hidden status bar, the app gets these safe area insets: top 0, leading 0, bottom 34, and trailing 84. So the layout area is 382 points wide, and it sits at the leading side.

![The Duo display in the simulator. Before the change, the interface is in the safe area at the leading side, and a band of 84 points is empty. After the change, the interface is in the center, with 42 points at each side.](../images/ch18-duo-safe-area.svg)

The trailing 84 points are the status area of this display. In Safari, the simulator draws the time and the Wi-Fi symbol there, one above the other. But this app hides the status bar. Thus the area was an empty band, and the viewfinder was not in the center of the display. For a camera, that looks like a defect.

The solution has three parts:

1. Measure the difference between the trailing inset and the leading inset: 84 points.
2. Ignore the safe area at the two sides, so that the interface can use the full width.
3. Add half of the difference as padding at each side: 42 points.

The interface keeps its width of 382 points and moves to the center. On an iPhone with equal side insets, the difference is 0, and nothing changes.

All these numbers come from the simulator. Nobody measured a real iPhone Duo.

### Availability checks

The app keeps its deployment target, iOS 26.0. The new classes and the two new device types need iOS 27.1. The compiler refuses a use of a newer API without a check, so each use is behind `#available(iOS 27.1, *)`.

A check protects a block of code. It cannot protect a stored property, because a stored property has a type, and the type must exist on each system that the app supports. For this reason, the preview view holds the coordinator in a property with the type `AnyObject`:

```swift file=AVCam/Views/CameraPreview.swift
        // An object that reports the direction that each camera faces in relation to this view.
        // The type of the property is `AnyObject`, because the coordinator class needs iOS 27.1.
        private var directionCoordinator: AnyObject?
```

The property has one job: to keep the object alive. The app never reads it, so the general type costs nothing.

On an earlier system, the method that creates the coordinator returns at once. The capture service then has no map, and each decision uses the position, as before. In the iPhone 18 Pro simulator with iOS 27.0, the check skipped the code, and the app behaved as in chapter 17.

## What the camera can do

This app uses a small part of the new API. This is the map.

| Capability | API | What you use it for |
|---|---|---|
| The direction of each camera | [`AVCaptureDeviceDirectionCoordinator`](https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator) | The change of camera and the mirroring of this chapter. |
| The current map, with no handler | `deviceDirections` of the coordinator | A decision at a moment that you select, for example at the start of a capture. The map is empty until the first report. |
| A coordinator for each preview | One coordinator for each view | An app that shows a preview on the two displays. The Apple article says that the same camera is then forward facing for one view and backward facing for the other view. |
| The front camera that follows the app | The virtual front camera | A selfie camera with no code for the direction. |
| The physical camera behind the virtual one | [`activePrimaryConstituent`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituent) | A label or a log line that tells which camera streams. |
| The two physical front cameras | [`.builtInOuterUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera), [`.builtInInnerUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtininnerultrawidecamera) | All capabilities of each camera, not only the common ones. The SDK header says that only a discovery session finds these types. Apple recommends them when capture is the main job of the app. |
| Content from the app during capture | [`UISceneAccessory.cameraCapture(sceneConfiguration:)`](https://developer.apple.com/documentation/uikit/uisceneaccessory/cameracapture(sceneconfiguration:)) | See below. |

A [`UISceneAccessory`](https://developer.apple.com/documentation/uikit/uisceneaccessory) declares additional content that the system can present for your app. The camera capture accessory (iOS 27.1) is for the time while the app is in the foreground and its capture session is active. You register it on a view controller with [`registerSceneAccessory(_:)`](https://developer.apple.com/documentation/uikit/uiviewcontroller/registersceneaccessory(_:)). The documentation says that the system decides if it presents the content and where, and that the content can be interactive. The pages that this tutorial read do not say what the system shows, or on which display. This app does not use the accessory, and nobody tested it.

The capability map of chapter 2 stays valid: an [`AVCaptureMultiCamSession`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession) can run more than one camera. Apple recommends that you do not use it only to follow the direction.

## Why this app does it this way

**The coordinator is in `PreviewView`.** The coordinator needs a view as its frame of reference, and `PreviewView` is the view that shows the preview. It lives as long as the preview, so it is the natural owner of the strong reference. The view is a `UIView`, so its code runs on the main actor.

**Only identifiers leave the view.** The `Camera` protocol, the model, and the capture service use `CameraDirections`, not the AVKit classes. A type from iOS 27.1 in a protocol method needs an availability mark on the method, and then on each type that implements it. A plain value type with two string arrays needs no mark. It also keeps AVKit out of the capture service.

**The device is created in the capture service.** `AVCaptureDevice(uniqueID:)` is a call into the capture system. It belongs to the actor that owns the session, as the Apple article says. The lookup method drops each identifier that has no device.

**One list of device types.** `DeviceLookup.builtInCameraTypes` has two jobs. The coordinator gets it as its list of types. The lookup uses its order as the order of preference when it selects a replacement: a camera with more lenses comes first.

**The app follows only cameras that are in the map.** An external camera has no direction. The virtual front camera is in no array, because the system moves it. For these cameras, the service does nothing.

**The direction of the selection is stored.** The service must know what the person wants: a camera that looks at them, or a camera that looks at the scene. With a map, the map answers this at the moment of the tap. With no map, the position answers it. The setup of the session stores the direction of the start camera in the same way. The start camera is the system-preferred camera, which can be a front camera. Without this, the first report replaces a front camera with a back camera at each launch.

**The first report can arrive early.** In the simulator, the handler ran before the setup of the session was complete. At that time, the session has no camera. So `setCameraDirections(_:)` only stores the map before the setup, and `setUpSession()` applies it at its end.

**The layout change is in one place.** The three modifiers are on the `ZStack` in `CameraView`, so the preview and the controls move together.

Limits of this design:

- No cover hides the preview during a change that a new direction starts.
- Photos and movies do not get the new mirroring.
- The app does not use the two physical front cameras, and it does not use the scene accessory.

## Common mistakes

- **`position == .front` as "looks at the person".** On iPhone Duo, this is not always true. Ask the map.
- **A device type list with no back cameras.** The coordinator reports only the types in your list. Without the back cameras, you never learn that a back camera now faces the person.
- **The virtual front camera in the map.** It is never there. Code that waits for it in the forward-facing array waits forever.
- **No strong reference to the coordinator.** A coordinator in a local variable goes away at the end of the method.
- **AVFoundation calls in the change handler.** The handler runs on the main actor. Send the identifiers to the actor that owns the session.
- **A descriptor that you use as a device.** A descriptor only identifies a camera. The device can be gone when you ask for it, so do not force-unwrap the result of `AVCaptureDevice(uniqueID:)`.
- **`isVideoMirrored` before `automaticallyAdjustsVideoMirroring = false`.** The assignment raises an exception.
- **Mirroring that you set one time.** A new input makes a new preview connection. Set the values again.
- **One coordinator for two previews.** The direction is relative to one view. Create a coordinator for each view.
- **A stored property with a new type.** With an older deployment target, the type of a stored property must exist on each system. Use a more general type, or an availability mark on the full type.
- **A layout loop.** This one occurred during the work on this chapter. The first version of the layout code read the two insets in `onGeometryChange` and wrote the difference to a state value. In the Duo simulator it worked. In the iPhone 18 Pro simulator, the app did not respond after its launch. The cause: an inset can change by a very small amount between two layout passes. In the measurements, the leading inset was not 0 but approximately -0.00000000000003. Each new value wrote the state, each write started a new layout pass, and each pass gave a new value. The correction is one call: round the value before you compare it. When you write state from a geometry measurement, make sure that the value becomes stable.

> [!NOTE]
> The simulator shows that the code runs. It cannot show a change of direction, because nobody found a way to open or close the simulated device. Before you ship code like this, test it on a real iPhone Duo.

## Documentation

```links
Choosing a camera by the direction it faces | https://developer.apple.com/documentation/avkit/choosing-a-camera-by-the-direction-it-faces | The Apple article that this chapter follows.
AVCaptureDeviceDirectionCoordinator | https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator | The object that reports the direction of each camera in relation to a view.
init(view:deviceTypes:changeHandler:) | https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator/init(view:devicetypes:changehandler:) | The initializer, with the view, the device types, and the change handler.
AVCaptureDeviceDirectionMap | https://developer.apple.com/documentation/avkit/avcapturedevicedirectionmap | One report: the forward-facing cameras and the backward-facing cameras.
AVCaptureDeviceDescriptor | https://developer.apple.com/documentation/avkit/avcapturedevicedescriptor | A value that identifies a camera and is safe to send to a different actor.
builtInOuterUltraWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera | One of the two physical front camera types of iOS 27.1.
builtInInnerUltraWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtininnerultrawidecamera | The other physical front camera type of iOS 27.1.
AVCaptureDevice.Position | https://developer.apple.com/documentation/avfoundation/avcapturedevice/position-swift.enum | The position of a camera on the device. It is not the direction.
isVideoMirrored | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored | The property that mirrors the video of a connection.
automaticallyAdjustsVideoMirroring | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyadjustsvideomirroring | The property that lets the connection decide the mirroring from the position.
AVCaptureDevice.RotationCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator | The object that calculates the preview angle and the capture angle for one camera.
UISceneAccessory | https://developer.apple.com/documentation/uikit/uisceneaccessory | Additional content that the system can present for an app.
cameraCapture(sceneConfiguration:) | https://developer.apple.com/documentation/uikit/uisceneaccessory/cameracapture(sceneconfiguration:) | The accessory for content during camera capture.
registerSceneAccessory(_:) | https://developer.apple.com/documentation/uikit/uiviewcontroller/registersceneaccessory(_:) | The method that registers an accessory on a view controller.
Concepts: cameras | ch02-concepts.md | Devices, positions, the camera change, and rotation.
Concepts: layout | ch05-concepts.md | The viewfinder frame and the two layouts of the app.
Build: iPhone Duo | ch18-build.md | The tutorial for this chapter.
```
