---
kind: article
chapter: 12
title: Concepts: a robust session
abstract: How a capture session stops and starts again, how deferred start makes the preview appear sooner, and how the interface hides the moments when the camera is not ready.
estimatedMinutes: 12
branch: chapter-12
---

Until now, the app assumed a simple world: the session starts, and then it runs until the app ends. A real iPhone is not that simple. A phone call takes the microphone. The person goes to the Home Screen and comes back. A system service starts again. And at each launch, the person waits for the first picture.

This article explains what happens to a capture session in these moments, and what a camera app must do. In [Build: a robust session](ch12-build.md), you write the code.

## How it works

### The life of a session

An [`AVCaptureSession`](https://developer.apple.com/documentation/avfoundation/avcapturesession) is in one of a small number of states.

![The states of a capture session: not running, running, interrupted, and stopped by an error, with the events that move the session between them](../images/ch12-session-states.svg)

- **Not running.** You created the session, but you did not call [`startRunning()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning()) yet, or you called [`stopRunning()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/stoprunning()).
- **Running.** Data flows from the inputs to the outputs and to the preview. [`isRunning`](https://developer.apple.com/documentation/avfoundation/avcapturesession/isrunning) is `true`.
- **Interrupted.** The system took the camera or the microphone away for some time. [`isInterrupted`](https://developer.apple.com/documentation/avfoundation/avcapturesession/isinterrupted) is `true`. The system starts the session again when the interruption ends.
- **Stopped by an error.** Something failed while the session ran. The session does not start again by itself.

The difference between the last two states is the most important idea of this chapter:

- After an **interruption**, the system repairs the session. Your job is to tell the person what happens.
- After a **runtime error**, your app must decide what to do. Nothing happens if you do nothing.

The session tells you about each change with a notification. The session is the object of each notification.

| Notification | Meaning |
|---|---|
| [`wasInterruptedNotification`](https://developer.apple.com/documentation/avfoundation/avcapturesession/wasinterruptednotification) | An interruption starts. The `userInfo` dictionary contains the reason. |
| [`interruptionEndedNotification`](https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionendednotification) | The interruption is over. |
| [`runtimeErrorNotification`](https://developer.apple.com/documentation/avfoundation/avcapturesession/runtimeerrornotification) | The session failed. The `userInfo` dictionary contains the error. |
| [`didStartRunningNotification`](https://developer.apple.com/documentation/avfoundation/avcapturesession/didstartrunningnotification) and [`didStopRunningNotification`](https://developer.apple.com/documentation/avfoundation/avcapturesession/didstoprunningnotification) | The running state changed. AVCam does not use them. |

### Interruption reasons

The value for [`AVCaptureSessionInterruptionReasonKey`](https://developer.apple.com/documentation/avfoundation/avcapturesessioninterruptionreasonkey) in `userInfo` is a number. It is the raw value of an [`AVCaptureSession.InterruptionReason`](https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason).

| Reason | Typical cause | AVCam shows a status |
|---|---|---|
| [`videoDeviceNotAvailableInBackground`](https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/videodevicenotavailableinbackground) | The app goes to the background. | No. This is normal. |
| `audioDeviceInUseByAnotherClient` | A phone call or an alarm uses the microphone. | Yes |
| `videoDeviceInUseByAnotherClient` | A different app or a different session takes the camera. | Yes |
| [`videoDeviceNotAvailableWithMultipleForegroundApps`](https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/videodevicenotavailablewithmultipleforegroundapps) | The app shares the screen with other apps on iPad. | No |
| [`videoDeviceNotAvailableDueToSystemPressure`](https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/videodevicenotavailableduetosystempressure) | The device is too hot, or it needs too much power. | No |
| [`sensitiveContentMitigationActivated`](https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/sensitivecontentmitigationactivated) | A video stream analyzer found sensitive content (iOS 26). | No |

The sample handles two reasons only. It uses one line for this:

```swift file=AVCam/CaptureService.swift
                isInterrupted = [.audioDeviceInUseByAnotherClient, .videoDeviceInUseByAnotherClient].contains(reason)
```

The probable reason for this choice is the background case. Each time the person leaves the app, the session gets an interruption with the background reason. That is not a problem that the person must know about. So the code sets `isInterrupted` to `true` only when a different client uses the microphone or the camera.

The session also starts again by itself after the background. This works only if your code did not call `stopRunning()`. AVCam never calls it. An app in which the camera is only one of many screens is different: it must stop the session when the camera screen closes.

### Runtime errors and the media services reset

The value for [`AVCaptureSessionErrorKey`](https://developer.apple.com/documentation/avfoundation/avcapturesessionerrorkey) in `userInfo` is an error that you can read as an `AVError`. Its code tells you what failed.

AVCam handles one code: [`mediaServicesWereReset`](https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/mediaserviceswerereset). The camera and the audio hardware belong to a system process, not to your app. On rare occasions, this process starts again. After that, the session is stopped. The sample keeps its session, its inputs, and its outputs. The repair in the sample is small: if the session does not run, call `startRunning()` again.

Other codes exist. For example, [`sessionHardwareCostOverage`](https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/sessionhardwarecostoverage) tells you that the configuration needs more than the hardware can supply. The sample ignores them.

### What happens at launch

Apple divides the launch of a camera app into four stages:

1. The app launches.
2. The app configures the session and starts it.
3. The capture outputs prepare themselves. This is the most expensive stage.
4. The preview shows its first frame.

The person looks at the screen and waits for stage 4. But the preview does not need the photo output or the movie output. These outputs are necessary only when the person captures something.

**Deferred start** (iOS 26) changes the order. The session starts, the preview appears, and then the session prepares the outputs that you marked.

![Two launch timelines: without deferred start the preview appears after the outputs are ready, and with deferred start the preview appears before the session prepares the outputs](../images/ch12-deferred-start.svg)

Two properties control it:

- [`isDeferredStartEnabled`](https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartenabled) on an output marks the output as "prepare this later". Read [`isDeferredStartSupported`](https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartsupported) first: if you set `true` on an output that does not support it, the output raises an exception.
- [`automaticallyRunsDeferredStart`](https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyrunsdeferredstart) on the session selects who decides the moment. With `true`, the session decides: a short time after the preview layer shows its first frame.

For an app that you build with the iOS 26 SDK or later, these values are the default: the session is in automatic mode, and the photo output and the file outputs (such as the movie output) are deferred when they support it. A preview layer and a video data output are not deferred by default. So the lines in the sample do not change the behavior. They are there to show you the properties:

```swift file=AVCam/CaptureService.swift
            // Deferred start brings up the preview first, and prepares the capture outputs a moment
            // later. An app that links the iOS 26 SDK gets this behavior by default; these
            // assignments show the properties that control it.
            captureSession.automaticallyRunsDeferredStart = true

            // Add the photo capture output as the default output type.
            photoCapture.output.isDeferredStartEnabled = photoCapture.output.isDeferredStartSupported
            try addOutput(photoCapture.output)
```

What if the person presses the capture button before the outputs are ready? The session then runs the deferred start immediately for that request. For more than one early request, Apple tells you to enable responsive capture on the photo output. You did that in chapter 7 with [`isResponsiveCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled).

> [!NOTE]
> Deferred start makes the preview appear sooner. It does not make the first photo arrive sooner. In the WWDC26 session about this subject, Apple reports a launch that is approximately two times faster for its example. This tutorial did not measure the launch time of AVCam.

### The stale preview frame

When the app goes to the background, the session stops. The preview layer keeps the last frame that it showed. When the app returns, the person sees this old frame for a moment, and then the picture jumps to the live scene.

AVCam hides the old frame with a black cover:

- When the scene goes to the background, the cover becomes opaque immediately, with no animation. There is no time for an animation while the app leaves the screen.
- When the scene becomes active again, the cover fades out in 0.3 seconds, while the live frames come back.

The signal is the SwiftUI [`ScenePhase`](https://developer.apple.com/documentation/swiftui/scenephase), not the interruption notifications. The code ignores the `inactive` phase. Thus the cover does not appear while the scene is only inactive, for example when the person looks at the app switcher.

### Controls wait for the session

Apple gives one rule for the launch: divide your work into "necessary for the first preview frame" and "all other work". Only the preview and the capture button are in the first group.

So AVCam keeps most controls invisible until the camera status is `running`: the thumbnail, the button that changes the camera, the mode picker, and the features toolbar. Then they fade in. The preview is the first thing that the person sees, and no control is on the screen before it can work.

The capture button is the exception. It is visible from the start, because a capture request before the end of the deferred start is legal, and responsive capture handles it.

The controls are hidden with an opacity of zero. They are not removed from the view tree. Thus the layout does not move when they appear.

## What the camera can do

AVCam uses a small part of what the system offers for a robust session.

| Capability | What it does | In this tutorial |
|---|---|---|
| Interruption notifications | Report when the system takes the camera or the microphone, and why. | This chapter |
| Recovery after a media services reset | Start the session again after the system media process starts again. | This chapter |
| Automatic deferred start | The session prepares the marked outputs after the first preview frame. | This chapter |
| Manual deferred start | Set `automaticallyRunsDeferredStart` to `false` and call [`runDeferredStartWhenNeeded()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/rundeferredstartwhenneeded()). For apps that draw the preview themselves, for example with Metal. Test [`isManualDeferredStartSupported`](https://developer.apple.com/documentation/avfoundation/avcapturesession/ismanualdeferredstartsupported) first. | Explained here only |
| Deferred start delegate | [`AVCaptureSessionDeferredStartDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturesessiondeferredstartdelegate) tells you when the deferred start begins and when all outputs are ready. A good moment to show the capture controls. | Not in AVCam |
| Running state | Key-value observation of `isRunning`, or the "did start" and "did stop" notifications, give the true state of the session. | Not in AVCam |
| Preview state | [`isPreviewing`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/ispreviewing) on the preview layer tells you when frames are on the screen. You can remove a cover at exactly that moment. | Not in AVCam |
| Multitasking camera access | On iPad, [`isMultitaskingCameraAccessEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturesession/ismultitaskingcameraaccessenabled) lets the camera run while the app shares the screen with other apps. Test [`isMultitaskingCameraAccessSupported`](https://developer.apple.com/documentation/avfoundation/avcapturesession/ismultitaskingcameraaccesssupported) first. | Not in AVCam |
| System pressure | [`systemPressureState`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempressurestate-swift.property) on the device reports heat and power limits. An app can decrease the frame rate or the resolution before the system interrupts the session. | Not in AVCam |
| Hardware cost | [`hardwareCost`](https://developer.apple.com/documentation/avfoundation/avcapturesession/hardwarecost) tells you how much of the hardware budget a configuration uses. A value above 1.0 does not run. | Not in AVCam |
| A "resume" button | For the reason "a different client uses the camera", an app can offer a button that calls `startRunning()` again. Older versions of AVCam did this. | Not in AVCam |

> [!NOTE]
> Multitasking camera access has conditions. Apple does not recommend it for apps with heavy capture work, and the rules for which apps can use it changed in iOS 18. Read the Apple article in the documentation list before you use it.

## Why AVCam does it this way

**Notifications as asynchronous sequences.** [`notifications(named:object:)`](https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:)) gives the notifications as an `AsyncSequence`. The sample reads each sequence in a `for await` loop inside a task that the actor starts. The loop body runs on the actor, so it can change `isInterrupted` directly. This is shorter than observers with selectors or closures, and no observer token must be stored.

**Only two interruption reasons.** The background reason must not show a message. The other reasons are probably less common on iPhone. The cost: on iPad next to a second app, or on a very hot device, the camera stops and the app says nothing.

**No `stopRunning()`.** AVCam is only a camera. The system stops the session in the background and starts it again in the foreground. The app does not need its own code for this.

**`enabled = supported`.** The line for the photo output copies `isDeferredStartSupported` into `isDeferredStartEnabled`. This form is always safe, because `true` on an output without support raises an exception.

**Automatic mode.** The preview layer is the only part of the session that is not deferred. So the session knows the correct moment by itself: a short time after the first frame is on the screen.

**A cover that depends on the scene phase only.** The cover needs no signal from the capture pipeline. The fade is long enough to hide the moment in which the live frames come back. An alternative is to observe `isPreviewing` and to remove the cover exactly then. That is more exact, and it is more code.

**`hidden(until:)` with opacity.** One small modifier does the same thing for four views. The alternative, an `if` statement around each control, changes the layout when the control appears.

### The gap in the sample, and what this tutorial adds

The Apple sample has all the parts of an interruption status:

- `CaptureService` publishes `isInterrupted`.
- `CameraStatus` has an `interrupted` case.
- `StatusOverlayView` has a yellow message for this case.

But no code connects the first part to the second. The model in the sample never reads `isInterrupted`, so `status` never becomes `interrupted`. In the sample, the yellow message appears only in a SwiftUI preview.

This tutorial adds the connection. It is one task in `CameraModel.observeState()`, of the same form as the other tasks in that method:

```swift file=AVCam/CameraModel.swift
        Task {
            // Await updates to the interruption state of the capture service.
            for await isInterrupted in await captureService.$isInterrupted.values {
                // Show a status message while a higher-priority event interrupts the camera.
                status = isInterrupted ? .interrupted : .running
            }
        }
```

> [!IMPORTANT]
> These lines are not in the Apple sample. They are the only code in this chapter that Apple did not write. All other code of the chapter is equal to the sample.

The addition has a second effect. The controls are visible only while the status is `running`. So during an interruption, the controls fade out, and they fade in again when the interruption ends. That is the correct behavior: the controls cannot work without the camera.

## Things to know about the sample

These points come from a careful read of the code. Nobody tested them on an iPhone for this tutorial.

- **`status == .running` is not the state of the session.** The model sets the status to `running` after `start()` returns. After that, only the interruption task changes it. The model does not observe `isRunning`. If the session stops for a reason that the app does not handle, the status stays `running`.
- **Only one runtime error is handled.** All other errors are dropped, and the code does not write them to the log.
- **The observers do not name the session.** The code does not give an `object:` argument, so it accepts notifications from each session in the process. With one session, that is correct. In an app with more sessions, give the session as the object.
- **An unknown reason is dropped.** `InterruptionReason(rawValue:)` gives `nil` for a number that it does not know. `compactMap` then removes the event. A reason that a later iOS version adds is ignored.
- **The tasks never end.** Nothing stores or cancels the three notification tasks. The capture service lives as long as the app, so this is acceptable here.

## Common mistakes

- **You show an error each time an interruption starts.** The move to the background is also an interruption. Read the reason first.
- **You start the session yourself after an interruption.** The system does it. You only update the interface.
- **You do nothing after a runtime error.** Then the session stays stopped. After a media services reset, start the session again.
- **You call `stopRunning()` in the background "to be safe".** Then the system does not start the session again for you, and your app must do it.
- **You call `startRunning()` or `stopRunning()` on the main thread.** The two methods block until the work is done. Call them on the session queue. In AVCam, the actor does this.
- **You set `isDeferredStartEnabled` to `true` with no test for support.** The output raises an exception when it does not support deferred start.
- **You call `runDeferredStartWhenNeeded()` in automatic mode.** The session raises an exception. The method is for manual mode only.
- **You expect deferred start to help an app that draws its own preview.** A video data output is not deferred by default, and automatic mode waits for its first frame. Such an app needs manual mode.
- **You hide the capture button with the other controls.** The person can then not take a photo in the first moments, although the session accepts the request.
- **You animate the cover on the way to the background.** The app has no time to show the animation. Set the cover immediately.
- **You change the deferred start values while the session runs.** A change makes the session build its pipeline again, which is slow. Set the values during the first configuration.

> [!NOTE]
> The Simulator with SimCam shows the result of two parts of this chapter: the app starts, and the controls fade in. Interruptions, the media services reset, the cover, and the real gain in launch time need a real iPhone. The tutorial page tells you how to test them.

## Documentation

```links
Building a responsive camera app that launches quickly | https://developer.apple.com/documentation/avfoundation/building-a-responsive-camera-app-that-launches-quickly | The Apple article about deferred start, hidden controls, and the cover in AVCam.
WWDC26: Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | The session about launch stages, deferred start, and system pressure.
AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The article of the sample.
AVCaptureSession | https://developer.apple.com/documentation/avfoundation/avcapturesession | The session and its running state.
wasInterruptedNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/wasinterruptednotification | The notification at the start of an interruption.
interruptionEndedNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionendednotification | The notification at the end of an interruption.
AVCaptureSession.InterruptionReason | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason | All reasons for an interruption.
runtimeErrorNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/runtimeerrornotification | The notification for a failure of the session.
AVError.Code.mediaServicesWereReset | https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/mediaserviceswerereset | The error code for a restart of the system media process.
automaticallyRunsDeferredStart | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyrunsdeferredstart | Automatic or manual deferred start.
isDeferredStartEnabled | https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartenabled | The property that marks an output as deferred.
runDeferredStartWhenNeeded() | https://developer.apple.com/documentation/avfoundation/avcapturesession/rundeferredstartwhenneeded() | The method that starts the deferred outputs in manual mode.
AVCaptureSessionDeferredStartDelegate | https://developer.apple.com/documentation/avfoundation/avcapturesessiondeferredstartdelegate | The callbacks before and after the deferred start.
isResponsiveCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled | The photo output property that lets capture requests overlap.
ScenePhase | https://developer.apple.com/documentation/swiftui/scenephase | The SwiftUI state of a scene: active, inactive, or background.
notifications(named:object:) | https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:) | Notifications as an asynchronous sequence.
Accessing the camera while multitasking on iPad | https://developer.apple.com/documentation/avkit/accessing-the-camera-while-multitasking-on-ipad | Multitasking camera access, system pressure, and interruptions.
systemPressureState | https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempressurestate-swift.property | The heat and power state of a camera.
WWDC23: Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | The session about responsive capture.
WWDC22: Discover advancements in iOS camera capture | https://developer.apple.com/videos/play/wwdc2022/110429/ | The session that introduces multitasking camera access.
Build: a robust session | ch12-build.md | The tutorial for this chapter.
```
