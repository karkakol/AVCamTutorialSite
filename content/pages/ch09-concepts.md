---
kind: article
chapter: 9
title: Concepts: fast capture
abstract: How the photo output keeps up with a person who taps fast, what the four capture switches do and how they depend on each other, and how a readiness coordinator tells the app when the next photo can start.
estimatedMinutes: 12
branch: chapter-09
---

A person taps the capture button. The camera must take the photo, process it, and encode it. This takes time. If the person taps again before the work is done, the camera has a problem. It can make the person wait, or it can start a second photo while the first photo is still in work.

This article explains how the photo output handles this problem, and how the app shows the state of the output on the capture button. In [Build: fast capture](ch09-build.md), you write the code.

The number of this chapter is part of part 1, but its code is like the code of part 2, "Beyond the sample". The newest Apple sample has no readiness code. An older version of the sample had it, and the newest version removed it. The design here is this tutorial's own. It is one of many possible designs.

> [!IMPORTANT]
> Nobody ran this chapter on a real iPhone. In the Simulator with SimCam, the three capture switches report "not supported". The readiness value goes from `sessionNotRunning` to `notReadyMomentarily` after a capture, and it stays there. It never reports `ready`, and it never reports a waiting state. Thus the Simulator cannot show the dim button or the spinner. The facts in this article come from the comments in the Apple SDK, from the Apple documentation, and from the WWDC23 session. Where a statement is an expectation, the text says so.

## How it works

### A capture has three stages

A photo capture is not one action. It has three stages:

1. **Capture.** The sensor delivers the frames that the photo needs.
2. **Process.** The system combines the frames and improves the picture. This stage takes the most time, mainly at the quality level `.quality`.
3. **Encode.** The system writes the result in a format such as HEVC.

By default, the photo output finishes one request before it works on the next one. A second tap waits. A person who taps fast feels a lag, and the photo shows a later moment than the person wanted.

The photo output can do better. It can overlap the stages of two requests, and it can use frames from before the tap. [Chapter 7](ch07-concepts.md) told you about these features. They need a rule for the interface: the app must know when the output can take a new request without a long wait.

### The output reports its readiness

[`AVCapturePhotoOutput`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput) has the property [`captureReadiness`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.property). Its type is [`AVCapturePhotoOutput.CaptureReadiness`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.enum), an enumeration with five values. The property supports key-value observation, but it needs the main queue for the interface. Your photo output works on a background queue. The solution is the [`AVCapturePhotoOutputReadinessCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator). It watches the output and reports each change to its delegate on the main queue.

![Top: the three stages of one capture and the readiness values in a typical order. Bottom: the way a value goes from the photo output to the capture button.](../images/ch09-readiness.svg)

The diagram shows a typical order. The real order depends on the device and on the settings. A flash capture, or a capture at the quality level `.quality`, stays longer in the waiting states.

### What each value means

| Value | Meaning | What the app does with the button |
|---|---|---|
| `.sessionNotRunning` | The session does not run. The output cannot take a request. | No change. The person can tap while the session starts. |
| `.ready` | The output can take a new request. | Enabled. |
| `.notReadyMomentarily` | The output is not ready, but it will be ready soon. | No change. |
| `.notReadyWaitingForCapture` | The output is busy with the capture stage. | Disabled and dim. |
| `.notReadyWaitingForProcessing` | The output is busy with the process stage. | Disabled, dim, and a spinner. |

The rule for `.notReadyMomentarily` is the most important one: **do not disable the button, and do not dim it.** The state lasts a very short time. The SDK says that a change of the shutter in this state is distracting. If the button went dim for a fraction of a second after each tap, it would flicker. The output also continues to accept requests when it is not ready. It only needs more time to serve them.

> [!NOTE]
> The SDK says about the readiness states only what the table shows. How long each state lasts, and in which order the values appear for rapid taps, depends on the device. Nobody read these sequences on a real iPhone for this tutorial.

### The coordinator also tracks requests

The coordinator has one more job. A tap does not change the readiness of the output at once. The request must first go through your code to the output. In that time, a second tap could start a second request.

The method [`startTrackingCaptureRequest(using:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/starttrackingcapturerequest(using:)) closes this gap. You give it the photo settings of the new request before you call [`capturePhoto(with:delegate:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:)). The coordinator then counts the request in its value from that moment. The tracking stops when you call `capturePhoto` with the same settings, so you do not stop it yourself. If an error stops you before `capturePhoto`, call [`stopTrackingCaptureRequest(using:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/stoptrackingcapturerequest(using:)) with the `uniqueID` of the settings.

There is one condition. The coordinator calls its delegate **synchronously** only when you call `startTrackingCaptureRequest` on the main queue. Then the interface changes before the call returns, and a queued second tap cannot start a capture. When you call it on another queue, the callback comes later. The next section of this article, "Why the app does it this way", shows what the app does about this.

## What the camera can do

### Four switches

The photo output has four switches for fast capture. Each has a `...Supported` property and an `...Enabled` property. You can set an "enabled" property to `true` only when the "supported" property is `true`. If you do it in the other case, the output raises an exception.

| Switch | What it does | Default | Needs |
|---|---|---|---|
| [`isZeroShutterLagEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagenabled) | The photo uses frames from before the tap. The shutter lag becomes very small. | On, when supported (apps linked on or after iOS 17) | The `.photo` preset. No flash, no manual exposure, no bracketed capture. |
| [`isResponsiveCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled) | A new capture starts before the processing of the last one is complete. | The SDK gives no default. Treat it as off. | Zero shutter lag on |
| [`isFastCapturePrioritizationEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationenabled) | The output reduces the quality of photos in a fast series so that it can keep up. | Off | Responsive capture on |
| [`isAutoDeferredPhotoDeliveryEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled) | The output can give a small proxy first and finish the photo later. | The SDK gives no default. Treat it as off. | A preset and format that support it |

The four "supported" properties are [`isZeroShutterLagSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagsupported), [`isResponsiveCaptureSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecapturesupported), [`isFastCapturePrioritizationSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationsupported), and [`isAutoDeferredPhotoDeliverySupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliverysupported). The WWDC23 session says that responsive capture and fast capture need an A12 chip or later.

### The switches depend on each other

Look at the "Needs" column. Responsive capture is only possible when zero shutter lag is on. Fast capture prioritization works only when responsive capture is on. Thus **the order of the lines in your code matters.** Zero shutter lag comes first, then responsive capture, then fast capture prioritization. Setting zero shutter lag can change whether responsive capture is supported. Thus read the "supported" value of responsive capture after you set the first switch.

The "supported" values also change while the app runs. A change of camera or format can change them. When a "supported" value goes from `true` to `false`, the "enabled" value goes back to `false` by itself. It does not come back by itself. The code must set it again after each change. This is why the capture service calls `updateConfiguration(for:)` after each change of camera.

### Zero shutter lag

The output keeps a ring buffer of the most recent frames. When the person taps, the photo uses frames from before the tap. The time stamp of the photo can be a little earlier than the call of `capturePhoto`. This is the intended result: the photo shows what the person saw when the finger went down.

Two things follow from this:

- **Do as little as possible between the tap and the call.** The SDK advises you to call `capturePhoto` at the touch-down event, not at the end of the tap. The finger movement of the tap can shake the camera. The app of this tutorial uses the normal button action, which fires at the end of the tap. A touch-down gesture is a possible improvement.
- **Changing the switch is expensive.** It rebuilds the render pipeline. Set it before `startRunning()`, or inside `beginConfiguration()` and `commitConfiguration()` while the session runs.

### Responsive capture

With responsive capture, the output adds a buffer between the capture stage and the process stage. A new capture can start while the last photo is still in process. The cost is memory. The SDK also says that you must be ready for a delegate call `willBeginCapture` of photo B before `didFinishProcessingPhoto` of photo A. The processed photos still come in the order of capture.

One more fact: a request for uncompressed output with a pixel format key switches the overlap off. The app asks for HEVC, so this does not apply. The SDK does not say how responsive capture treats a RAW request from chapter 8. Nobody checked this on a device.

### Fast capture prioritization

In a fast series, the output cannot give each photo the full processing. This switch allows it to reduce the quality from the level you chose, so that it keeps up. The SDK says that a slightly lower quality is often better than a lost moment. A photo knows if this happened: the resolved settings of the photo have the property `isFastCapturePrioritizationEnabled`. Camera.app turns this switch on. An app must choose it.

### Deferred photo delivery

[Chapter 7](ch07-concepts.md) added deferred delivery. [Chapter 8](ch08-concepts.md#what-a-device-test-showed) turns it off while a RAW format is chosen, because a RAW capture cannot use it. This chapter adds nothing to it. It only belongs to the list, because the output can give a proxy for a photo to make the series faster. The delegate must handle [`photoOutput(_:didFinishCapturingDeferredPhotoProxy:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishcapturingdeferredphotoproxy:error:)) when the switch is on.

### The quality prioritization interaction

[`maxPhotoQualityPrioritization`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization) is `.balanced` by default. The app sets `.quality`. Zero shutter lag reduces the lag at `.balanced` and `.quality`, and it gives little at `.speed`. Photos at `.quality` take the longest, so the output is in a waiting state the longest after them. This is why the readiness feedback is useful for an app that has `.quality` as its default. A fast series can also lower a photo below the level that the person chose.

## Why the app does it this way

### Chapter 7 already set three switches

The code of chapter 7 sets responsive capture, fast capture prioritization, and deferred delivery to their "supported" values. This chapter does not turn them on. It adds the missing parts:

- The line for zero shutter lag. The output enables it when it is supported, so the line changes nothing in the result. It makes the switch visible in the code, and it keeps the order right for the next line.
- Three log lines with the "supported" and "enabled" values, so that a test on a device can read them.
- The readiness coordinator, and the feedback on the capture button.

### The coordinator belongs to the photo capture service

`PhotoCapture` owns the coordinator. It is the object that owns the photo output, and the coordinator needs the output. A `lazy` property creates the coordinator on first use. The output exists then.

The delegate of the coordinator must be an `NSObject` that adopts [`AVCapturePhotoOutputReadinessCoordinatorDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinatordelegate). `PhotoCapture` is a plain class. Thus the app has a small private class, `ReadinessObserver`. There is one more fact to know: the coordinator keeps its [`delegate`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/delegate) in a **weak** reference. If nothing else holds the observer, it is freed, and the callbacks stop without an error message. `PhotoCapture` keeps the observer in a stored property for this reason.

### A stream moves the value to the actor

The coordinator calls its delegate on the main queue. The state of `PhotoCapture` belongs to the `CaptureService` actor. The observer cannot write to the actor state directly. It puts each value in an `AsyncStream`, and a task on the actor reads the stream. This is the same idea that the photo delegate uses for `captureActivity` in chapter 3, and `monitorReadiness(isolation:)` copies `monitorProgress`. The `isolation` parameter keeps the task on the actor.

### A mirror type keeps AVFoundation out of the views

The app has its own enumeration, `CaptureReadiness`, with the same five cases. The views then need no `import AVFoundation`, and the preview model can set a value without a camera. The mapping uses a `default` case. It covers `sessionNotRunning` and each value that Apple adds later. The enumeration also has `isCaptureButtonDisabled`, so the rule of the button is in one place and not in each view.

### Set the delegate once

`updateConfiguration(for:)` runs after each change of camera. The code must not create a new task each time. It sets the delegate only when `readinessTask` is `nil`. Setting the delegate delivers the first value at once, so the model gets a value from the start.

### The trade-off of tracking inside the actor

`PhotoCapture.capturePhoto(with:)` runs on the actor. It calls `startTrackingCaptureRequest` there, not on the main queue. As the section "The coordinator also tracks requests" says, the callback then comes later. A second tap that arrives in this short time can slip through before the button changes. The readiness values still arrive, and the output still protects itself, because it accepts the request but serves it later.

The alternative is to create the photo settings on the main actor, call `startTrackingCaptureRequest` there, and pass the settings to the actor. This is the way that Apple teaches. It changes three files: `CameraModel`, `CaptureService`, and `PhotoCapture`. The design of this chapter takes the smaller change. It is a good choice for a tutorial, and the text tells you its limit.

### The value goes to the model, and then to the button

`CaptureService` publishes `captureReadiness` as it does for `captureActivity`. `CameraModel` reads it in a third task in `observeState()`. The `Camera` protocol has the property, and `PreviewCameraModel` has a stored copy, so that an Xcode preview can set any value. This is how you can see the dim button without a device.

When captures overlap, the value of `captureActivity` follows the delegate that reported last. This value drives only the flash of the screen and the Live badge, so the effect is small. The delegates need no change: each request has its own delegate and its own continuation.

### The button rules

- `.notReadyWaitingForCapture` and `.notReadyWaitingForProcessing`: disable the button and set its opacity to 0.5.
- `.notReadyWaitingForProcessing` also shows a `ProgressView`.
- All other values: no change.

### What the chapter does not do

- It does not call `capturePhoto` at the touch-down event.
- It has no menu for the switches. The switches are always on when supported.
- It does not stop a capture from the Camera Control or from the AirPods remote when the output is busy. Those triggers come in later chapters. They call `camera.capturePhoto()`, so they would need a check of `captureReadiness` there.

## Common mistakes

- **You set an "enabled" value without a check.** The output raises an exception when the "supported" value is `false`. Always set `x = x.isSupported`.
- **You set fast capture prioritization before responsive capture.** Fast capture needs responsive capture, so the first line has no effect.
- **You set the switches one time only.** After a change of camera, they can go back to `false`.
- **You let the coordinator's delegate go.** The reference is weak. Keep the observer in a stored property.
- **You dim the button for `.notReadyMomentarily`.** The button then flickers after each tap.
- **You disable the button and never enable it again.** The cause is usually a state that your mapping does not cover. Use a `default` case that does not disable the button.
- **You call `startTrackingCaptureRequest` with settings that differ from the request.** Pass the same settings object to `capturePhoto`. A call with invalid settings raises an exception.
- **You track a request and then never call `capturePhoto`.** Call `stopTrackingCaptureRequest(using:)`. Otherwise the coordinator waits for the request.
- **You assume that the delegate calls come in a fixed order.** With responsive capture, `willBeginCapture` of the next photo can come before `didFinishProcessingPhoto` of the last one.
- **You test the dim button in the Simulator.** It never reports a waiting state. Use the preview "Waiting for processing", or a real iPhone.

## Documentation

```links
AVCapturePhotoOutput | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput | The photo output and all its switches.
AVCapturePhotoOutput.CaptureReadiness | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.enum | The five readiness values.
captureReadiness | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.property | The readiness of the output, with advice for the shutter control.
AVCapturePhotoOutputReadinessCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator | The object that reports readiness changes on the main queue.
init(photoOutput:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/init(photooutput:) | Creates a coordinator for one photo output.
delegate | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/delegate | The delegate that the coordinator holds with a weak reference.
captureReadiness (coordinator) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/capturereadiness | The value that includes the tracked requests.
startTrackingCaptureRequest(using:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/starttrackingcapturerequest(using:) | Tells the coordinator about a request before the capture.
stopTrackingCaptureRequest(using:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/stoptrackingcapturerequest(using:) | Stops the tracking of a request that you do not capture.
AVCapturePhotoOutputReadinessCoordinatorDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinatordelegate | The protocol of the coordinator's delegate.
readinessCoordinator(_:captureReadinessDidChange:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinatordelegate/readinesscoordinator(_:capturereadinessdidchange:) | The callback for a new readiness value.
isZeroShutterLagEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagenabled | The switch for frames from before the tap.
isResponsiveCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled | The switch for captures that overlap.
isFastCapturePrioritizationEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationenabled | The switch for less processing in a fast series.
isAutoDeferredPhotoDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled | The switch for deferred photo delivery.
maxPhotoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization | The highest quality level that a capture can ask for.
photoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization | The quality level of one capture.
capturePhoto(with:delegate:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:) | Starts a capture.
AVCapturePhotoCaptureDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate | All callbacks of a capture.
AVCaptureDeferredPhotoProxy | https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy | The proxy object of a deferred photo.
WWDC23: Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | The session about zero shutter lag, responsive capture, and the readiness coordinator.
Build: fast capture | ch09-build.md | The tutorial for this chapter.
```
