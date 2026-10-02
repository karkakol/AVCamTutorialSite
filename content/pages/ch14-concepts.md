---
kind: article
chapter: 14
title: Concepts: zoom and lenses
abstract: What zoom is on an iPhone camera, how a virtual device changes between its lenses, why the number on the screen is not the number of the device, and how an app keeps its zoom control in step with the camera.
estimatedMinutes: 13
branch: chapter-14
---

The Apple sample has no zoom in its interface. A person can zoom only with the Camera Control, and the back camera of the sample never uses the ultra-wide lens. In this chapter, you add what each camera app has: zoom levels such as 0.5x, 1x, and 3x, a control to select them, and a pinch gesture.

This chapter starts part 2 of the tutorial, "Beyond the sample". The code of part 2 is not Apple's code. The design is this tutorial's own, and it is one of many possible designs. This article explains the camera facts that each design must obey, and then the decisions of this design, with their limits. In [Build: zoom and lenses](ch14-build.md), you write the code.

> [!IMPORTANT]
> Nobody ran the code of this chapter on a real iPhone. The simulated camera cannot zoom, so the Simulator shows no zoom control and no change of the picture. The facts in this article come from the comments in the Apple SDK and from the Apple documentation. Where a statement is a conclusion or an expectation, the text tells you.

## How it works

### Zoom is a crop, or a different lens

A phone camera has no zoom lens that moves. Each lens has one fixed focal length. Thus a phone has only two methods to make a subject larger:

- **A crop.** The camera uses a smaller area in the center of the sensor picture and scales it to the output size. The SDK describes [`videoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor) in exactly this manner: a centered crop for all outputs. The value 1.0 is the full field of view. The value 2.0 shows half of the width and half of the height.
- **A change of lens.** The system takes the picture from a different camera that has a longer focal length. That camera sees a smaller part of the scene with its full sensor.

A crop is free, but it has fewer pixels to work with. A change of lens keeps the quality, but an iPhone has only two or three lenses. A good zoom uses the two methods together: a crop between the lenses, and a change of lens when the next lens can show the same picture.

### Virtual devices change the lens for you

In [chapter 2](ch02-concepts.md), you read about virtual devices: a group of physical cameras that the system shows to your app as one [`AVCaptureDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice). The back of an iPhone can have up to three of them:

| Device type | Cameras in the group |
|---|---|
| [`.builtInTripleCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintriplecamera) | Ultra-wide, wide, telephoto |
| [`.builtInDualWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualwidecamera) | Ultra-wide, wide |
| [`.builtInDualCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualcamera) | Wide, telephoto |

A virtual device has one zoom axis for all its cameras. Your app sets one zoom factor, and the system selects the camera. The property [`virtualDeviceSwitchOverVideoZoomFactors`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/virtualdeviceswitchovervideozoomfactors) tells you where on this axis the cameras meet. At each switch-over zoom factor, the crop of one camera shows the same field of view as the full picture of the next camera.

![One zoom axis of a triple camera, with the device values above the axis and the display values below it. The values are an example.](../images/ch14-zoom-axis.svg)

The SDK gives these rules for the array:

- It has one value less than the device has cameras. A triple camera has two values. A camera with one lens has an empty array.
- The values are in the same order as the cameras in [`constituentDevices`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/constituentdevices).
- At or above a switch-over zoom factor, the device **can** change to the next camera. It does not always do so. A telephoto camera cannot focus on a near subject, and it needs more light. In those conditions, the system stays on the wider camera and crops its picture.

These values are also the natural zoom levels for the interface. At each of them, a camera can supply its full picture, with no crop.

> [!NOTE]
> The values 2 and 6 in the diagram are an example. The real values depend on the iPhone model. Nobody read them from a real iPhone for this tutorial, so the code reads them at run time and assumes nothing.

### The number of the device and the number on the screen

The smallest zoom factor of a device is 1.0, and it means "the full field of view of this device". For a triple camera, the full field of view is the picture of the ultra-wide camera. The Camera app shows that picture as "0.5x", not as "1x". For a person, "1x" is the picture of the wide camera.

So there are two scales:

- **The device value**: the number that you set on `videoZoomFactor`.
- **The display value**: the number that a person reads on the screen.

[`displayVideoZoomFactorMultiplier`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier) (iOS 18) connects the two scales. You multiply the device value by it, and you get the display value. The SDK gives this example: a device value of 1.0 and a multiplier of 0.5 make the display value 0.5.

| Camera | Multiplier | Device value 1.0 shows | The "1x" of a person is device value |
|---|---|---|---|
| A virtual device that starts with the ultra-wide camera | 0.5 in the SDK example | 0.5x | 2.0 |
| A camera that starts with the wide camera | 1 is the expected value | 1x | 1.0 |

This has an important result. The expected start value of the zoom factor is 1.0, the smallest value. If the app does nothing, a person then sees the ultra-wide picture of a triple camera when the app starts. People expect "1x" at the start. Thus the app sets the zoom factor to `1.0 / multiplier` each time it configures a camera. On the example camera, that is 2.0.

### The zoom range, and what happens outside of it

You cannot set each number on `videoZoomFactor`. The device has a range:

- [`minAvailableVideoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/minavailablevideozoomfactor) is the lower limit. It is 1.0 for a camera with one lens. For a virtual device, it can become larger in some configurations.
- [`maxAvailableVideoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/maxavailablevideozoomfactor) is the upper limit. For a camera with one lens, it is equal to [`videoMaxZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videomaxzoomfactor) of the active format.

The upper limit comes from the active format, so the range can change when the session preset changes.

Outside of the range, the SDK describes two different reactions:

| Value that you assign | Result |
|---|---|
| Less than 1.0, or more than `videoMaxZoomFactor` of the active format | An `NSRangeException` |
| 1.0 or more, but less than the smallest available value | The device uses the smallest available value |
| Not more than `videoMaxZoomFactor`, but more than the largest available value | The device uses the largest available value |

An `NSRangeException` is an Objective-C exception. A Swift `do`-`catch` statement catches only Swift errors, so it cannot catch this exception. The app stops. The only protection is a check before the assignment.

> [!NOTE]
> This occurred during the work on this chapter. The simulated camera of SimCam reports a largest zoom factor of 0, a smallest zoom factor of 0, and a multiplier of 0. Each assignment to `videoZoomFactor` raises an exception there. The first version of the code set the 1x level at launch, and the app stopped immediately in the Simulator. The code now does two things: it does not zoom a camera whose largest zoom factor is less than 1, and it limits each value to the range before it assigns the value.

```swift file=AVCam/CaptureService.swift
        // A device that cannot zoom, such as a simulated camera, reports a largest zoom factor of less than 1.
        guard device.maxAvailableVideoZoomFactor >= 1.0 else { return }
        // Keep the value in the range that the device supports. A value outside of the range raises an exception.
        let smallestFactor = max(device.minAvailableVideoZoomFactor, 1.0)
```

A second rule comes from chapter 6: each change of a device needs [`lockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()) before it. Without the lock, the assignment also raises an exception.

### A ramp or a direct assignment

There are two methods to change the zoom factor:

| | Direct assignment | Ramp |
|---|---|---|
| API | `device.videoZoomFactor = factor` | [`ramp(toVideoZoomFactor:withRate:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/ramp(tovideozoomfactor:withrate:)) |
| The picture | Jumps to the new value | Moves smoothly to the new value |
| Use | A gesture that sends many small changes | A tap on a zoom level |

The rate of a ramp is not "zoom factor each second". The SDK defines it as the number of times that the zoom factor doubles in one second. With a rate of 1, the factor goes from 1 to 2 in one second, and from 2 to 4 in the next second. The reason is how people see zoom: a change from 1 to 2 looks as large as a change from 2 to 4. A ramp of this type looks constant to the eye.

The app uses a rate of 8. A change from the display value 1x to 3x is approximately 1.6 doublings, so it takes approximately 0.2 seconds. The system limits the acceleration of a ramp, so the real time is a little longer.

Two more facts:

- An assignment to `videoZoomFactor` during a ramp stops the ramp, and the picture jumps to the assigned value. Thus a pinch can always interrupt a ramp.
- [`cancelVideoZoomRamp()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/cancelvideozoomramp()) stops a ramp smoothly, and [`isRampingVideoZoom`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isrampingvideozoom) tells you if a ramp is in progress. The app uses neither.

During a pinch, the gesture sends a new value many times each second. Each value is near the value before it, so the direct assignment already looks smooth. A ramp for each small change makes the picture come after the fingers.

### One source of truth: the device

More than one thing can change the zoom factor:

- A tap on the zoom control starts a ramp.
- A pinch assigns values.
- The system zoom slider of the Camera Control, which you added in [chapter 12](ch12-concepts.md), sets `videoZoomFactor` itself. Your code is not part of that change.

If the interface shows the value that the app sent last, the interface is wrong after the first slide on the Camera Control. It is also wrong during a ramp, and when the device limits a value.

The solution is to show only what the device reports. `videoZoomFactor` supports key-value observation. The capture service observes the property with an [`NSKeyValueObservation`](https://developer.apple.com/documentation/foundation/nskeyvalueobservation), changes each new value to a display value, and publishes it. The model and the views read the published value.

![A zoom command goes from the views through the model and the capture service to the capture device. The new zoom factor comes back from the device through an observation. The Camera Control slider changes the device directly.](../images/ch14-zoom-state.svg)

With this design, the zoom control needs no special code for the Camera Control. The slider changes the device, the observation reports the change, and the control shows the new number.

> [!NOTE]
> The SDK says that you can observe `videoZoomFactor`. It does not say how frequently the value changes during a ramp. The expectation is that the number in the zoom control counts up during a ramp. Nobody verified this on a real iPhone.

### Digital zoom and quality

Between the full pictures of the lenses, each zoom factor is a crop. But a crop does not always decrease the quality. A sensor frequently has more pixels than the output format needs, so the camera scales the sensor picture down. While the crop still has sufficient pixels, the output is as sharp as before.

[`videoZoomFactorUpscaleThreshold`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videozoomfactorupscalethreshold) of the active format is the limit. At this zoom factor, the crop has exactly the pixels of the output. Above it, the camera must scale the crop up. That is digital zoom: the picture becomes larger, but it gets no new detail.

Some formats also have [`secondaryNativeResolutionZoomFactors`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/secondarynativeresolutionzoomfactors) (iOS 16). At these zoom factors, the sensor changes how it reads its pixels, and it supplies a picture that is not scaled up. This is the base of a "2x" level with the quality of a real lens on a camera that has no 2x lens.

The app in this chapter does not read these two properties. It offers a 2x level on a camera with one lens, and it permits each value up to the display value 10x. Above the threshold, the quality goes down. This is a limit of the design, not of the camera.

## What the camera can do

The chapter uses a small part of the zoom API.

| Capability | What it does | In this tutorial |
|---|---|---|
| `videoZoomFactor` | The zoom factor of a device. You can observe it. | This chapter |
| `ramp(toVideoZoomFactor:withRate:)` | A smooth change to a zoom factor. | This chapter |
| `virtualDeviceSwitchOverVideoZoomFactors` | The zoom factors at which the cameras of a virtual device meet. | This chapter |
| `displayVideoZoomFactorMultiplier` | The ratio between the device value and the display value. | This chapter |
| `minAvailableVideoZoomFactor`, `maxAvailableVideoZoomFactor` | The range that the device permits now. You can observe the two properties. | This chapter (read only at configuration) |
| [`AVCaptureSystemZoomSlider`](https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider) | The zoom control of the Camera Control. | Chapter 12 |
| `cancelVideoZoomRamp()`, `isRampingVideoZoom` | A smooth stop of a ramp, and its state. For a zoom button that a person holds down. | Not in the app |
| `videoZoomFactorUpscaleThreshold` | The zoom factor above which the picture is scaled up. For a quality mark in the interface, or for an upper limit. | Not in the app |
| `secondaryNativeResolutionZoomFactors` | Zoom factors with a picture that is not scaled up. For more zoom levels of full quality. | Not in the app |
| [`systemRecommendedVideoZoomRange`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedvideozoomrange) | The range that the system recommends for a zoom slider (iOS 18). The system zoom slider uses it. | Not in the app |
| [`activePrimaryConstituent`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituent) | The camera of a virtual device that supplies the picture now. You can observe it. | Not in the app |
| [`setPrimaryConstituentDeviceSwitchingBehavior(_:restrictedSwitchingBehaviorConditions:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setprimaryconstituentdeviceswitchingbehavior(_:restrictedswitchingbehaviorconditions:)) | Controls when a virtual device can change its camera, for example not during a recording. | Not in the app |
| [`nominalFocalLengthIn35mmFilm`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/nominalfocallengthin35mmfilm) | The focal length of a camera (iOS 26), for labels such as "24 mm". | Not in the app |

Some features make the zoom range smaller. The SDK names depth data delivery and Center Stage. An app that uses them must observe the two range properties and must not keep old limits.

## Why the app does it this way

The design is this tutorial's own. These are its decisions and the alternatives.

**Virtual devices first.** The back discovery session of the sample lists `[.builtInDualCamera, .builtInWideAngleCamera]`. The chapter puts `.builtInTripleCamera` and `.builtInDualWideCamera` before them. A discovery session sorts its result in the order of the type list, so the first device is the one with the most cameras. The alternative is to use the physical cameras and to change the session input at each zoom level. That gives full manual control, but each change of the input interrupts the preview, and you must write the lens selection yourself.

**Zoom levels from the device, not from a table.** The code makes the levels from the smallest zoom factor and the switch-over zoom factors. It contains no list of iPhone models. A new iPhone with different lenses gets correct levels with no change of the code.

**A zoom level has two numbers.** `ZoomLevel` keeps the device value and the display value. The capture service is the only place that knows the multiplier. The views show display values and send them back, and they never calculate with device values.

**A 2x level for a camera with one lens.** A control with one button has no use. For a camera with one zoom level, such as a front camera, the code adds a second level at two times the first level, if the device permits that zoom factor.

**A ramp for a tap, an assignment for a pinch.** The reasons are in the section about ramps.

**The device is the source of truth.** The model never sets `displayZoomFactor` when it sends a command. It waits for the value from the observation. The alternative is the action of the system zoom slider, `init(device:action:)`. But that action reports only the changes that the slider makes. It does not report a ramp or a pinch.

**The same visibility rules as the other controls.** The zoom control hides until the session runs, as you made the other controls do in chapter 10. It also hides during the fullscreen appearance of the Camera Control overlay from chapter 12. There the reason is strong: the [guidelines for the Camera Control](https://developer.apple.com/design/human-interface-guidelines/camera-control) tell you not to show the same control two times, and the overlay can show a zoom slider.

**An upper limit of 10x.** The largest zoom factor of a format can be very large, and the picture at that value has little detail. The app stops at the display value 10. The number is a decision of this tutorial, not a value from the SDK.

## Limits of this design

The code is short so that you can read it in one chapter. It has limits that a camera app for the App Store must remove.

- **Two pinch values can arrive in the wrong order.** Each change of the pinch gesture starts a new task, and each task calls the model and then the capture service. Swift does not promise that these tasks run in the order in which they start. An old value can arrive after a newer value, and the zoom can jump back for a moment. A solution is one stream of values that one task reads in order.
- **The zoom returns to 1x.** The app configures the zoom again after a change of the camera and after a change of the capture mode. Each time, it sets the 1x level. A person who zooms in photo mode and changes to video mode starts again at 1x.
- **The 2x level of a camera with one lens is a crop.** The code does not test `videoZoomFactorUpscaleThreshold` or `secondaryNativeResolutionZoomFactors`, so it does not know if 2x has full quality on that camera.
- **The range is read only at configuration.** The code does not observe `minAvailableVideoZoomFactor` and `maxAvailableVideoZoomFactor`. This is correct for this app, which has no depth data and no Center Stage.
- **The first camera after a launch is the system-preferred camera.** The capture service starts with [`systemPreferredCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempreferredcamera), as in chapter 2. The new type list has an effect on the app's own list of cameras, which the button that changes the camera uses. Nobody verified which back camera the system prefers at the first launch on an iPhone with three back cameras.
- **A virtual device has less manual control.** The SDK says that the multi-camera virtual devices do not lock the focus at a lens position that you select. The lens position slider of chapter 12 exists only when the device reports that it supports this lock. So it is possible that this slider is not available with a triple camera. This is a conclusion from the SDK text, and nobody verified it on a real iPhone.

## Common mistakes

- **You assign a value that is out of range.** The app stops with an exception that Swift cannot catch. Limit the value to the range first.
- **You assume that each camera can zoom.** The simulated camera reports a largest zoom factor of 0. Read the range before you set a value.
- **You forget `lockForConfiguration()`.** The assignment and the ramp raise an exception without the lock.
- **You show the device value.** On a camera that starts with the ultra-wide lens, the label says "1x" for the picture that a person knows as "0.5x". Multiply by `displayVideoZoomFactorMultiplier`.
- **You do not set a start level.** A virtual device with an ultra-wide camera then starts with the ultra-wide picture.
- **You put `.builtInWideAngleCamera` first in the type list.** The first result is then always the wide camera, and the app never gets a virtual device.
- **You write the zoom levels into the code.** The levels 0.5, 1, and 3 are correct for one iPhone model and wrong for the next one.
- **You keep the zoom state in the interface.** The Camera Control changes the zoom without your code. Observe the device.
- **You use a ramp for each change of a pinch.** The picture then comes after the fingers. Assign the value.
- **You think of the ramp rate as a speed in "x each second".** The rate is the number of doublings each second.
- **You keep the zoom levels of the old camera.** The levels and the multiplier belong to one device. Create them again when the camera changes.
- **You test zoom in the Simulator.** The simulated camera cannot zoom. Use a real iPhone.

## Documentation

```links
Choosing a capture device | https://developer.apple.com/documentation/avfoundation/choosing-a-capture-device | The Apple article about device types and discovery sessions.
builtInTripleCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintriplecamera | The virtual device with three cameras.
builtInDualWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualwidecamera | The virtual device with the ultra-wide and the wide camera.
virtualDeviceSwitchOverVideoZoomFactors | https://developer.apple.com/documentation/avfoundation/avcapturedevice/virtualdeviceswitchovervideozoomfactors | The zoom factors at which the cameras of a virtual device meet.
constituentDevices | https://developer.apple.com/documentation/avfoundation/avcapturedevice/constituentdevices | The physical cameras of a virtual device.
videoZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor | The zoom factor of a device, with its range rules.
ramp(toVideoZoomFactor:withRate:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/ramp(tovideozoomfactor:withrate:) | A smooth change of the zoom factor.
cancelVideoZoomRamp() | https://developer.apple.com/documentation/avfoundation/avcapturedevice/cancelvideozoomramp() | A smooth stop of a ramp.
minAvailableVideoZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/minavailablevideozoomfactor | The lower limit of the zoom factor.
maxAvailableVideoZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/maxavailablevideozoomfactor | The upper limit of the zoom factor.
displayVideoZoomFactorMultiplier | https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier | The ratio between the device value and the number that the system shows.
videoMaxZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videomaxzoomfactor | The largest zoom factor of a format.
videoZoomFactorUpscaleThreshold | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videozoomfactorupscalethreshold | The zoom factor above which the picture is scaled up.
secondaryNativeResolutionZoomFactors | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/secondarynativeresolutionzoomfactors | Zoom factors with a picture that is not scaled up.
systemRecommendedVideoZoomRange | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedvideozoomrange | The zoom range that the system recommends for a slider.
activePrimaryConstituent | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituent | The camera of a virtual device that supplies the picture now.
AVCaptureSystemZoomSlider | https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider | The zoom control of the Camera Control.
NSKeyValueObservation | https://developer.apple.com/documentation/foundation/nskeyvalueobservation | The object that keeps a key-value observation alive.
HIG: Camera Control | https://developer.apple.com/design/human-interface-guidelines/camera-control | The design rules for an interface below the Camera Control overlay.
WWDC19: Advances in Camera Capture & Photo Segmentation | https://developer.apple.com/videos/play/wwdc2019/225/ | The session that introduces the virtual devices of iOS 13.
WWDC21: What's new in camera capture | https://developer.apple.com/videos/play/wwdc2021/10047/ | How a virtual device selects its camera, and how an app controls that.
Build: zoom and lenses | ch14-build.md | The tutorial for this chapter.
```
