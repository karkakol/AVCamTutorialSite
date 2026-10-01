---
kind: article
chapter: 12
title: Concepts: Camera Control
abstract: How an app supplies controls to the Camera Control, which control classes exist, where their actions run, and why the app reduces its interface while the system overlay is on the screen.
estimatedMinutes: 12
branch: chapter-12
---

The Camera Control is a hardware control on the side of iPhone 16 and later iPhone models. A person can click it, press it lightly, and slide a finger on it. With it, a person changes camera settings without a touch on the screen.

The system does not know which settings your app has. Your app must supply them. This article explains how you supply controls, which controls exist, where their code runs, and what the app must do while the system shows its overlay. In [Build: Camera Control](ch12-build.md), you write the code.

> [!IMPORTANT]
> The Camera Control does not exist in the Simulator, and nobody ran the code of this chapter on an iPhone that has one. The facts in this article come from the Apple SDK, the Apple documentation, the WWDC session, and the code of the sample. Where a fact is a conclusion from the code only, the text tells you.

## How it works

### One control, three jobs

The Camera Control does three jobs. Each job uses a different API.

| Job | Gesture | API | Chapter |
|---|---|---|---|
| Capture | A full click | `onCameraCaptureEvent`, the primary action | 11 |
| Change a setting | A light press, then a slide | Control objects on the capture session | 12 (this chapter) |
| Start the app, also from a locked iPhone | A click when the app does not run | A capture extension | 13 |

This chapter is about the second job only. The click already works: you added the capture events in [chapter 11](ch11-concepts.md). The launch from a locked iPhone is the subject of [chapter 13](ch13-concepts.md).

### What a person does

The [guidelines for the Camera Control](https://developer.apple.com/design/human-interface-guidelines/camera-control) and the [user guide](https://support.apple.com/guide/iphone/use-the-camera-control-iph0c397b154/ios) describe these gestures:

- **Light press.** The system shows an overlay next to the Camera Control. The overlay shows one setting and its current value.
- **Slide.** The value of the selected setting changes.
- **Light double press.** The overlay shows the list of all controls. A slide moves through the list, and a light press selects a control.

The system draws the overlay. Your app does not draw it and cannot change its appearance. Your app supplies only the list of controls: a title, a symbol, and a range of values for each control. The system also remembers the control that the person used last in your app.

### Controls belong to the session

A control is an object of a subclass of [`AVCaptureControl`](https://developer.apple.com/documentation/avfoundation/avcapturecontrol). You add controls to the [`AVCaptureSession`](https://developer.apple.com/documentation/avfoundation/avcapturesession), in the same manner as inputs and outputs.

![The Camera Control changes the controls of the capture session. The system sliders set a device property themselves, a custom slider calls your action, and the controls delegate receives four callbacks.](../images/ch12-controls.svg)

The session has a small API for controls:

| Member | Use |
|---|---|
| [`supportsControls`](https://developer.apple.com/documentation/avfoundation/avcapturesession/supportscontrols) | `true` only on hardware that has a Camera Control. Read it first. |
| [`maxControlsCount`](https://developer.apple.com/documentation/avfoundation/avcapturesession/maxcontrolscount) | The largest number of controls that the session accepts. |
| [`controls`](https://developer.apple.com/documentation/avfoundation/avcapturesession/controls) | The controls that are on the session now. |
| [`canAddControl(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddcontrol(_:)) | Tells you if the session accepts a control. |
| [`addControl(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addcontrol(_:)) | Adds a control. It raises an exception if the session cannot accept the control. |
| [`removeControl(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/removecontrol(_:)) | Removes a control. |

The rules are the rules of inputs and outputs, which you know from chapter 1:

- Ask before you add. `addControl(_:)` raises an Objective-C exception when `canAddControl(_:)` is `false`. Swift cannot catch this exception.
- Put a group of changes between [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()). Then the session applies all changes as one operation.

`canAddControl(_:)` returns `false` in these cases:

- The session already has `maxControlsCount` controls.
- A custom control has no action.
- The control is a second system zoom control for a camera that already has one.

### The control classes

The iOS SDK has four control classes that you can use. They arrived with iOS 18. The iOS 26 and iOS 27 SDKs added no new control classes.

| Class | Kind | What it changes |
|---|---|---|
| [`AVCaptureSystemZoomSlider`](https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider) | System | The [`videoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor) of one camera. |
| [`AVCaptureSystemExposureBiasSlider`](https://developer.apple.com/documentation/avfoundation/avcapturesystemexposurebiasslider) | System | The [`exposureTargetBias`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuretargetbias) of one camera. |
| [`AVCaptureSlider`](https://developer.apple.com/documentation/avfoundation/avcaptureslider) | Custom | One `Float` value. Your code decides what the value means. |
| [`AVCaptureIndexPicker`](https://developer.apple.com/documentation/avfoundation/avcaptureindexpicker) | Custom | One index into a list of choices. Your code decides what each choice means. |

**System controls** do the work for you. You create one with a camera device, and the control is bound to that device.

- The control takes its range from the active format of the device: [`systemRecommendedVideoZoomRange`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedvideozoomrange) for zoom, and [`systemRecommendedExposureBiasRange`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedexposurebiasrange) for the exposure bias. When the active format changes, the control updates its range.
- The control sets the device property itself. You write no code for the change.
- The initializer raises an exception when the device does not support the property.

A system control can have an optional action. The action runs on the main actor, and only when this control changed the value. Its purpose is to keep your own interface up to date, for example a zoom label. Do not set the device property in this action. The control already did that.

**Custom controls** are for the settings that only your app has.

- A slider can be continuous (a range), or discrete (a range with a step, or a list of values).
- A picker shows a list of titles, and reports the index of the selected title.
- Each custom control has a title and a symbol. The symbol must be the name of a symbol from [SF Symbols](https://developer.apple.com/sf-symbols/). Custom symbols do not work.
- A custom control must have an action before you add it to the session. The session refuses a custom control that has no action.

### Action queues

You give a custom control its action with [`setActionQueue(_:action:)`](https://developer.apple.com/documentation/avfoundation/avcaptureslider/setactionqueue(_:action:)). The method takes a dispatch queue and a closure. The system calls the closure on that queue each time the person changes the value.

The choice of the queue is the important part. The SDK has this rule: if the action changes a property of the camera system, the queue must be the same exclusive execution context as the camera system. In plain words: the action must run where all your other camera code runs. If it runs somewhere else, two pieces of code can configure the camera at the same time.

In AVCam, this place is the session queue. In chapter 1, you made this serial queue the executor of the `CaptureService` actor. Thus each method of the actor runs on the session queue. When the slider action also runs on the session queue, the action and the actor methods can never run at the same time.

The same rule applies in the opposite direction. If your code changes the `value` of a slider or the `selectedIndex` of a picker, it must do that on the action queue.

### The controls delegate and the overlay

The session reports the state of the overlay to an [`AVCaptureSessionControlsDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturesessioncontrolsdelegate) object. You set it with [`setControlsDelegate(_:queue:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/setcontrolsdelegate(_:queue:)). The queue must be a serial queue.

The delegate has four methods, and all four are required:

| Callback | Meaning | AVCam |
|---|---|---|
| `sessionControlsDidBecomeActive(_:)` | The controls are available for interaction. | Writes a log line. |
| [`sessionControlsWillEnterFullscreenAppearance(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesessioncontrolsdelegate/sessioncontrolswillenterfullscreenappearance(_:)) | The overlay is about to use the full screen. Hide parts of your interface. | Sets a Boolean value to `true`. |
| `sessionControlsWillExitFullscreenAppearance(_:)` | The fullscreen appearance is about to end. Show your interface again. | Sets the value to `false`. |
| `sessionControlsDidBecomeInactive(_:)` | The person dismissed the controls. | Writes a log line. |

Two facts about the delegate are important:

- **No delegate, no controls.** The SDK says that the controls become active only when the session has a controls delegate. An app that adds controls but sets no delegate gets no overlay.
- **The exit comes first.** `sessionControlsWillExitFullscreenAppearance(_:)` arrives before `sessionControlsDidBecomeInactive(_:)`.

> [!NOTE]
> Apple does not document exactly which gesture causes the "active" callbacks and which gesture causes the "fullscreen" callbacks. AVCam writes a log line in each callback. On an iPhone with a Camera Control, you can read the Xcode console and find out.

### Why the app reduces its interface

In the fullscreen appearance, the system draws its overlay on top of your app. The person looks at two things: the value in the overlay and the preview. Buttons of the app that stay on the screen take attention away.

The Apple guidelines ask for a viewfinder with few distractions, and they ask you not to show the same control two times. For example, an app that has its own zoom slider hides it while the system zoom slider is on the screen.

AVCam hides four views during the fullscreen appearance: the thumbnail button, the button that changes the camera, the capture mode picker, and the features toolbar. The value travels from the delegate to the views through the same layers as each other state of the capture service.

![The fullscreen state of the controls goes from the controls delegate through the capture service to the model, and four views read it to set their opacity.](../images/ch12-overlay-state.svg)

## What the camera can do

AVCam uses three controls. The API permits much more.

| Capability | What it does | In this tutorial |
|---|---|---|
| System zoom slider | Zoom for one camera, in the range that the system recommends. | This chapter |
| System exposure bias slider | Makes the picture brighter or darker. | This chapter |
| Continuous custom slider | One value in a range. AVCam uses it for the lens position. | This chapter |
| Discrete custom slider | Values with a fixed step, or values from a list. For example a frame rate. | Not in AVCam |
| [`prominentValues`](https://developer.apple.com/documentation/avfoundation/avcaptureslider/prominentvalues-199dz) | Values at which a slider stops more easily. | Not in AVCam |
| [`localizedValueFormat`](https://developer.apple.com/documentation/avfoundation/avcaptureslider/localizedvalueformat) | A format for the value label, for example a unit. It accepts only the `%@` placeholder. | Not in AVCam |
| Index picker | A list of named choices: flash modes, filters, aspect ratios, or cameras. | Not in AVCam |
| [`isEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturecontrol/isenabled) | Disables a control but keeps it in the list. For a control that does not apply to the current mode. | Not in AVCam |
| Action on a system slider | [`init(device:action:)`](https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider/init(device:action:)) reports each change, so that a zoom label in the app stays correct. | Not in AVCam |
| [`displayVideoZoomFactorMultiplier`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier) | Changes a zoom factor into the number that the system shows, for a label in your interface. | Not in AVCam |
| The click as a shutter | The primary action of a capture event. | Chapter 11 |
| Launch from a locked iPhone | A capture extension. | Chapter 13 |

The system Camera app also has controls for depth, styles, tone, and the camera selection. These controls are not public API. To make something similar, you use a custom slider or a picker.

The guidelines recommend that you put the controls that people use most in the middle of the list. They also recommend that the layout of your app leaves space for the overlay, in portrait and in landscape.

## Why AVCam does it this way

**One queue for all camera code.** The slider action, the delegate callbacks, and the methods of the actor all run on the session queue. This obeys the queue rule of the SDK, and it keeps the order of events. The alternative is an actor with the default executor. Then the action closure must start a task to get onto the actor. That adds a step, and two fast changes of the slider can arrive in the wrong order.

**System sliders without an action.** AVCam has no zoom control and no exposure control on the screen. Nothing in the interface must stay in step with the sliders, so the sample uses the simple `init(device:)` form.

**Controls are kept for each camera.** `CaptureService` has a dictionary, `controlsMap`. The key is the [`uniqueID`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/uniqueid) of a camera, and the value is the array of controls for that camera. The code of the sample does not say why. These reasons are conclusions from the code:

1. A system control is bound to one device when you create it. The back camera and the front camera need different control objects. The action of the custom slider also captures one device.
2. A person can change the camera many times. Without the dictionary, each change makes new control objects and new closures.
3. The value of a custom slider belongs to the object. The same object keeps its value. A new object starts again at the start of its range.
4. The session can refuse a second system zoom control for a camera. One set of objects for each camera prevents this.

**Remove all, then add.** When the camera changes, `configureControls(for:)` removes each control from the session and adds the controls of the new camera. This is simple, and it is correct for system controls, which are bound to a device.

**Opacity, not removal.** The four views get an opacity of zero. They stay in the layout, so the capture button and the preview do not move when the overlay appears. The model changes the value in an animation block, so the views fade.

**The capture button stays.** The SDK text about the fullscreen appearance names sliders and shutter buttons as things that an app can hide. AVCam keeps its capture button on the screen. The name of the property tells you the idea: `prefersMinimizedUI`, a minimal interface, not an empty one.

**A delegate class of its own.** The delegate protocol is an Objective-C protocol, so the delegate is an `NSObject` subclass. The sample uses a small class, `CaptureControlsDelegate`, that publishes one Boolean value. This keeps the delegate methods out of the actor, as the photo capture delegate does in chapter 3. The actor publishes the value again, as it does for the capture activity.

## Things to know about the sample

These points come from a careful read of the Apple sample. Nobody verified them on an iPhone for this tutorial. They do not stop the app from working.

- **The lens slider can show an old value.** The slider locks the focus at a lens position. A tap on the preview (chapter 6) then starts automatic focus again, and the lens moves. The slider object keeps its old `value`. Apple's article about the Camera Control says to update the value of a control when the setting changes in a different place. AVCam does not do that.
- **The lens slider does not return to automatic focus.** After a person uses the slider, the focus stays locked. The slider has no "automatic" position. The focus code of chapter 6 is the only code that starts automatic focus again, and it runs after a tap on the preview.
- **The published value has no compiler check.** `CaptureControlsDelegate` is a plain class with a `@Published` property. The delegate callbacks change the property on the session queue, and the actor reads it on the same queue. This is safe only because the two queues are one queue. The project uses minimal concurrency checking, so the compiler does not examine it.
- **The begin and commit pairs nest.** `changeCaptureDevice(to:)` calls `configureControls(for:)` between its own `beginConfiguration()` and `commitConfiguration()` calls. `configureControls(for:)` has a pair of its own. The session permits this.
- **Each call sets the delegate again.** `configureControls(for:)` sets the same delegate object each time the camera changes. One time is sufficient. The repeat does no harm.
- **`createControls(for:)` is not private.** All other helper methods of the actor are private. No code outside the actor calls this method.
- **Controls change at run time.** The guidelines advise against a control list that changes while a person uses the app, because the system must then select a different control. AVCam replaces the list when the camera changes. For a setting that does not apply for some time, `isEnabled` is the better tool.

## Common mistakes

- **You set no controls delegate.** The controls do not become active, and the person sees no overlay.
- **You call `addControl(_:)` without `canAddControl(_:)`.** When the session refuses the control, the app stops with an exception that Swift cannot catch.
- **You add a custom control that has no action.** The session refuses it.
- **You run the action on the wrong queue.** The action changes the camera while other camera code runs. Use the queue that your camera code uses.
- **You set the device property in the action of a system slider.** The system already set it. The action is for your interface only.
- **You use the action of a system slider as the only source of the zoom value.** The action runs only for changes that come from this control. A pinch gesture or a zoom ramp does not call it. Observe the device property for those.
- **You use one set of controls for all cameras.** A system control changes the device that it got at creation, not the camera that is active now.
- **You keep your full interface on the screen.** The overlay then competes with your buttons. Reduce the interface between the "will enter" and the "will exit" callbacks.
- **You use a symbol that is not in SF Symbols,** or a value format with a placeholder other than `%@`.
- **You start a capture session only to get the Camera Control.** The WWDC session tells you not to do this.
- **You test in the Simulator or on an iPad.** `supportsControls` is `false` there, and no control code runs.

> [!NOTE]
> In the Simulator with SimCam, `supportsControls` is `false`. The app builds and runs, but the new capture service code returns early. To see the overlay, you need an iPhone that has a Camera Control.

## Documentation

```links
Enhancing your app experience with the Camera Control | https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control | The main Apple article: system controls, custom controls, session setup, and the delegate.
HIG: Camera Control | https://developer.apple.com/design/human-interface-guidelines/camera-control | The design rules for controls and for the interface below the overlay.
Use the Camera Control on iPhone | https://support.apple.com/guide/iphone/use-the-camera-control-iph0c397b154/ios | The gestures, as Apple explains them to people who use an iPhone.
WWDC25: Enhancing your camera experience with capture controls | https://developer.apple.com/videos/play/wwdc2025/253/ | Capture events and the Camera Control in one session.
AVCaptureControl | https://developer.apple.com/documentation/avfoundation/avcapturecontrol | The base class of all controls.
AVCaptureSystemZoomSlider | https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider | The system control for zoom.
AVCaptureSystemExposureBiasSlider | https://developer.apple.com/documentation/avfoundation/avcapturesystemexposurebiasslider | The system control for the exposure bias.
AVCaptureSlider | https://developer.apple.com/documentation/avfoundation/avcaptureslider | The custom slider.
AVCaptureIndexPicker | https://developer.apple.com/documentation/avfoundation/avcaptureindexpicker | The custom picker.
setActionQueue(_:action:) | https://developer.apple.com/documentation/avfoundation/avcaptureslider/setactionqueue(_:action:) | The action of a custom slider and the queue that it runs on.
AVCaptureSessionControlsDelegate | https://developer.apple.com/documentation/avfoundation/avcapturesessioncontrolsdelegate | The four callbacks about the state of the overlay.
setControlsDelegate(_:queue:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/setcontrolsdelegate(_:queue:) | How to set the delegate and its serial queue.
supportsControls | https://developer.apple.com/documentation/avfoundation/avcapturesession/supportscontrols | The hardware check.
isLockingFocusWithCustomLensPositionSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/islockingfocuswithcustomlenspositionsupported | The check that AVCam makes before it creates the lens slider.
setFocusModeLocked(lensPosition:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setfocusmodelocked(lensposition:completionhandler:) | The call that the lens slider makes.
unownedExecutor | https://developer.apple.com/documentation/swift/actor/unownedexecutor | How an actor uses a serial queue as its executor.
Build: Camera Control | ch12-build.md | The tutorial for this chapter.
```
