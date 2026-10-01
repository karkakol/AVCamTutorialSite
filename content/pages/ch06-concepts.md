---
kind: article
chapter: 6
title: Concepts: focus and exposure
abstract: How an app configures a camera device, what the focus and exposure modes do, how a tap becomes a point of interest, and which other controls a device has.
estimatedMinutes: 14
branch: chapter-06
---

Until now, the app has not changed one setting of the camera hardware. The camera focuses and sets the exposure by itself, for the center of the picture. That is a good default. But the person frequently knows more than the camera: the subject is at the side of the picture, or a bright window is behind a face. A tap on the preview tells the camera which part of the scene is important.

This chapter has little code, but the ideas in it are large. The procedure that sets the focus is the same procedure that sets the zoom, the torch, the white balance, and all other hardware controls. When you know it, the full device API is open to you. You write the code in [Build: focus and exposure](ch06-build.md).

## How it works

### The device owns the hardware settings

A capture session connects inputs to outputs. It knows nothing about the lens. The hardware settings belong to the [`AVCaptureDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice) object, the same object that you found with a discovery session in chapter 2.

To change a setting of a device, you always do four operations:

1. Ask the device if it supports the value.
2. Lock the device for configuration.
3. Set the value.
4. Unlock the device.

The setting stays when you unlock the device. The lock protects the change. After the unlock, the system can change the value again, for example when a one-time focus operation is complete.

### The configuration lock

The camera hardware is a shared resource. More than one process can use the same device. Thus a device does not accept a change from a caller that does not hold its lock.

[`lockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()) asks for the exclusive right to configure the device. The method throws a Swift error if it cannot get the lock, so you call it with `try`. [`unlockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/unlockforconfiguration()) releases the lock.

Hold the lock for a short time only. While your app holds the lock without a reason, the capture quality in other apps that share the device can become lower.

What happens if you ignore the rules?

- **You set a value without the lock.** The device raises an `NSGenericException`.
- **You set a value that the device does not support.** The device raises an `NSInvalidArgumentException` or an `NSRangeException`.

These are Objective-C exceptions. They are not Swift errors. A `do`/`catch` statement does not catch them, and the app stops. This is the reason for operation 1 and operation 2: there is no safe way to "try and see".

### Three modes for focus and for exposure

**Focus** is the position of the lens. It decides the distance at which objects are sharp. **Exposure** is the quantity of light that makes the picture. The camera controls it with the exposure duration (the shutter time) and the ISO value (the sensitivity of the sensor).

Focus, exposure, and white balance each have the same three modes:

| Mode | Focus | Exposure | White balance |
|---|---|---|---|
| Locked | `.locked` | `.locked` | `.locked` |
| One time, then locked | `.autoFocus` | `.autoExpose` | `.autoWhiteBalance` |
| Continuous | `.continuousAutoFocus` | `.continuousAutoExposure` | `.continuousAutoWhiteBalance` |

- In a **locked** mode, the camera keeps the value that it has.
- In a **one-time** mode, the camera does one automatic operation. Then it changes to the locked mode by itself.
- In a **continuous** mode, the camera makes a new adjustment each time the scene makes one necessary.

The focus modes are the cases of [`AVCaptureDevice.FocusMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.enum), and you set them with the [`focusMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.property) property. The exposure modes are the cases of [`AVCaptureDevice.ExposureMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.enum), and you set them with the [`exposureMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.property) property. Exposure has a fourth mode, `.custom`, for a duration and an ISO value that you select.

Not all cameras support all modes. The front camera of many devices has a lens with a fixed focus, so it does not support the automatic focus modes. Ask first, with `isFocusModeSupported(_:)` and `isExposureModeSupported(_:)`.

### Points of interest

In an automatic mode, the camera must know which part of the picture to measure. The default is the center. You can move it with two properties: [`focusPointOfInterest`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/focuspointofinterest) and [`exposurePointOfInterest`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposurepointofinterest).

A point of interest is a `CGPoint` in **device coordinates**. These are not the coordinates of the screen:

- The point (0, 0) is the top left corner of the image as the sensor supplies it. The point (1, 1) is the bottom right corner. The default is (0.5, 0.5).
- The image of the sensor is a landscape image, and it is not rotated. The coordinates do not turn when the person turns the device.
- The values do not depend on the size of the preview or on the resolution of the format.

![A tap at a view point in a portrait preview, and the same place as a device point in the landscape image from the sensor](../images/ch06-point-of-interest.svg)

Look at the diagram. The person holds an iPhone in portrait, with the back camera in use, and taps near the top left corner of the preview. In device coordinates, that place is near the bottom left corner of the sensor image. The device origin (0, 0) is at the top right corner of the portrait preview.

Two rules apply to a point of interest:

1. **Ask first.** Use `isFocusPointOfInterestSupported` and `isExposurePointOfInterestSupported`. A camera with a fixed focus has no focus point of interest.
2. **Set the point, then set the mode.** A new point by itself starts nothing. The camera uses the point when you set the mode. So the order is always: point first, mode second. This is true also when the mode does not change.

### From a view point to a device point

A tap gives you a point in the coordinates of a view: points, with the origin at the top left corner of the view. Between the sensor image and the view, the system does three things to the video:

- It **rotates** the video, by the preview angle from chapter 2.
- It **scales and crops** the video to fill or fit the layer, as the video gravity of the layer says.
- It can **mirror** the video, as it usually does for a front camera.

You could write this calculation yourself, but you would write it wrong for one of the cases. The preview layer does the conversion for you. The SDK header says that the conversion uses the frame size and the video gravity of the layer, and that a device point refers to the image that is not rotated. The header does not mention the mirror state, and this tutorial did not test the conversion with a front camera. [`captureDevicePointConverted(fromLayerPoint:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/capturedevicepointconverted(fromlayerpoint:)) changes a point of the layer into a device point. [`layerPointConverted(fromCaptureDevicePoint:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/layerpointconverted(fromcapturedevicepoint:)) goes in the other direction. You use the second method when you want to draw something on the preview at a device point.

In AVCam, the preview layer is the backing layer of the preview view. Thus a point of the view is also a point of the layer, and the conversion is one line:

```swift file=AVCam/CaptureService.swift
    func focusAndExpose(at point: CGPoint) {
        // The point this call receives is in view-space coordinates. Convert this point to device coordinates.
        let devicePoint = videoPreviewLayer.captureDevicePointConverted(fromLayerPoint: point)
```

### Tap, then return to continuous

Which mode is correct after a tap? AVCam uses the one-time modes, `.autoFocus` and `.autoExpose`. The camera focuses and exposes one time for the tapped point, and then it stays locked. The picture does not change while the person composes the photo.

But a lock has a problem. The person taps on a flower, takes the photo, and then points the camera at a mountain. The lens is still locked at the distance of the flower. The mountain is not sharp, and nothing tells the camera to try again.

The device has a monitor for this situation. When you set [`isSubjectAreaChangeMonitoringEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/issubjectareachangemonitoringenabled) to `true`, the device posts a [`subjectAreaDidChangeNotification`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/subjectareadidchangenotification) when the scene changes a lot: the light becomes different, or the camera or the subject moves. The app then sets the continuous modes again, with the point at the center.

![The two states of the camera: continuous modes at the center, and a lock on the tapped point until the subject area changes](../images/ch06-tap-cycle.svg)

So the camera of the app is always in one of two states:

| | After a tap | After the subject area changes |
|---|---|---|
| Point of interest | The tapped point | (0.5, 0.5) |
| Focus mode | `.autoFocus` | `.continuousAutoFocus` |
| Exposure mode | `.autoExpose` | `.continuousAutoExposure` |
| Subject area monitoring | On | Off |

The two columns differ only in their values. So AVCam writes one method for the two states, and a Boolean parameter selects the column:

```swift file=AVCam/CaptureService.swift
    private func focusAndExpose(at devicePoint: CGPoint, isUserInitiated: Bool) throws {
        // Configure the current device.
        let device = currentDevice
        
        // The following mode and point of interest configuration requires obtaining an exclusive lock on the device.
        try device.lockForConfiguration()
        
        let focusMode = isUserInitiated ? AVCaptureDevice.FocusMode.autoFocus : .continuousAutoFocus
        if device.isFocusPointOfInterestSupported && device.isFocusModeSupported(focusMode) {
            device.focusPointOfInterest = devicePoint
            device.focusMode = focusMode
        }
        
        let exposureMode = isUserInitiated ? AVCaptureDevice.ExposureMode.autoExpose : .continuousAutoExposure
        if device.isExposurePointOfInterestSupported && device.isExposureModeSupported(exposureMode) {
            device.exposurePointOfInterest = devicePoint
            device.exposureMode = exposureMode
        }
        // Enable subject-area change monitoring when performing a user-initiated automatic focus and exposure operation.
        // If this method enables change monitoring, when the device's subject area changes, the app calls this method a
        // second time and resets the device to continuous automatic focus and exposure.
        device.isSubjectAreaChangeMonitoringEnabled = isUserInitiated
        
        // Release the lock.
        device.unlockForConfiguration()
    }
```

You can find all four operations in this method: the support tests, the lock, the values, and the unlock. In the build page, you write it line by line.

## What the camera can do

Tap to focus is the only device control in the interface of AVCam at this time. In chapter 12, the Camera Control adds zoom, exposure bias, and the lens position. A device has many more controls. This is the map. All of them use the same four operations.

> [!NOTE]
> This tutorial did not operate these controls on a real device. The descriptions come from the SDK and its documentation. Test each control on hardware before you rely on it.

### More focus control

- **Manual focus.** [`setFocusModeLocked(lensPosition:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setfocusmodelocked(lensposition:completionhandler:)) locks the lens at a position between 0.0 (nearest) and 1.0 (farthest). The value is not a distance, and the same value gives different results on different devices. Ask [`isLockingFocusWithCustomLensPositionSupported`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/islockingfocuswithcustomlenspositionsupported) first.
- **Range limit.** [`autoFocusRangeRestriction`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/autofocusrangerestriction-swift.property) limits the automatic focus to near or far subjects. A scanner app for barcodes uses the near range, so that the focus does not search far away.
- **Smooth focus.** [`isSmoothAutoFocusEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/issmoothautofocusenabled) makes focus changes slower. A fast focus change is good for a photo, but it is a visible jump in a movie.
- **Face focus.** [`isFaceDrivenAutoFocusEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isfacedrivenautofocusenabled) lets the camera prefer faces. Exposure has an equivalent property, `isFaceDrivenAutoExposureEnabled`.
- **State.** The `isAdjustingFocus` and `isAdjustingExposure` properties tell you that an operation is in progress. You can observe them to show or hide a focus indicator.
- **A rectangle of interest (iOS 26).** [`focusRectOfInterest`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusrectofinterest) and [`exposureRectOfInterest`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposurerectofinterest) replace the point with an area whose size you select. Ask [`isFocusRectOfInterestSupported`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isfocusrectofinterestsupported) first. [`defaultRectForFocusPoint(ofInterest:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/defaultrectforfocuspoint(ofinterest:)) gives you the rectangle that the system uses for a point.
- **Focus tracking (iOS 27).** [`isContinuousAutoFocusTrackingEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/iscontinuousautofocustrackingenabled) makes the continuous focus follow a subject. A second property, `isContinuousAutoFocusTrackingSubjectAcquired`, tells you if the camera has found the subject.
- **Cinematic video focus (iOS 26).** A device in Cinematic video mode has its own focus methods, which follow a subject or a point. The session [Capture cinematic video in your app](https://developer.apple.com/videos/play/wwdc2025/319/) shows them.

### More exposure control

- **Exposure bias.** [`setExposureTargetBias(_:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuretargetbias(_:completionhandler:)) makes the automatic exposure lighter or darker by a number of EV units. This is the "sun" slider of a camera app. The limits are `minExposureTargetBias` and `maxExposureTargetBias`. The automatic exposure continues to work; you only move its target.
- **Custom exposure.** [`setExposureModeCustom(duration:iso:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuremodecustom(duration:iso:completionhandler:)) sets the shutter time and the ISO value. The limits come from the active format: `minExposureDuration` to `maxExposureDuration`, and `minISO` to `maxISO`. Use the constants `AVCaptureDevice.currentExposureDuration` and `AVCaptureDevice.currentISO` to keep one of the two values as it is.
- **A light meter.** [`exposureTargetOffset`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuretargetoffset) is the difference between the measured light level and the target. In custom mode, it tells the person if the picture is too dark or too light.
- **A limit for the shutter time.** [`activeMaxExposureDuration`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activemaxexposureduration) is the longest shutter time that the automatic exposure can use. A short limit keeps moving subjects sharp, and the picture has more noise as a result.
- **Aperture and priority modes (iOS 27).** [`setExposureModeCustom(lensAperture:duration:iso:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuremodecustom(lensaperture:duration:iso:completionhandler:)) adds the [`lensAperture`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lensaperture) as a third value, for a camera with a variable aperture. Each of the three parameters accepts a number, a "current" constant, or an "auto" constant. With one fixed value and two automatic values, you get the modes of a traditional camera: shutter priority, aperture priority, and ISO priority. [`recommendedLensApertureStops`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/recommendedlensaperturestops) gives the aperture values for a control, and [`autoExposureLensApertureRateLimit`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/autoexposurelensapertureratelimit) limits how fast the automatic exposure moves the aperture.
- **Exposure signals (iOS 27).** [`enabledExposureSignals`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/enabledexposuresignals) and [`activeExposureSignals`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeexposuresignals) tell the automatic exposure which properties of a scene can change the aperture or the shutter time, for example a subject that moves, a group of people, or a document.

### White balance

White balance removes the color of the light, so that a white object is white in the picture. It has the three modes of the table above, in the [`whiteBalanceMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/whitebalancemode-swift.property) property. AVCam never changes it, so the camera keeps its default.

- [`setWhiteBalanceModeLocked(with:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setwhitebalancemodelocked(with:completionhandler:)) locks the white balance at values that you supply. The values are [`AVCaptureDevice.WhiteBalanceGains`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/whitebalancegains): one gain each for red, green, and blue, each between 1.0 and `maxWhiteBalanceGain`.
- People think in temperature (kelvin) and tint, not in gains. [`AVCaptureDevice.WhiteBalanceTemperatureAndTintValues`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/whitebalancetemperatureandtintvalues) holds these two values, and the device has methods that convert between the two forms.
- `grayWorldDeviceWhiteBalanceGains` gives the gains for a neutral result. Use it to set the white balance from a gray card.
- iOS 26 adds ready-made values (tungsten, fluorescent, daylight, cloudy, shadow) and a setter that takes temperature and tint directly.

### Zoom

- [`videoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor) sets the zoom immediately. The permitted range is [`minAvailableVideoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/minavailablevideozoomfactor) to [`maxAvailableVideoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/maxavailablevideozoomfactor).
- [`ramp(toVideoZoomFactor:withRate:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/ramp(tovideozoomfactor:withrate:)) starts a smooth zoom. The rate is in powers of two for each second: with a rate of 1.0, the zoom factor becomes two times larger each second. This gives a zoom that looks constant to the eye. [`cancelVideoZoomRamp()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/cancelvideozoomramp()) stops the ramp, for example when the person releases a zoom button.
- [`videoZoomFactorUpscaleThreshold`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videozoomfactorupscalethreshold) of the active format is the zoom factor above which the system must enlarge the image. Above this value, the quality decreases.
- [`systemRecommendedVideoZoomRange`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedvideozoomrange) gives a good range for a zoom slider.
- [`displayVideoZoomFactorMultiplier`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier) changes a zoom factor into the number that Apple's interfaces show. You learned the reason in [chapter 2](ch02-concepts.md): on some virtual devices, the zoom factor 1.0 is the ultra-wide camera, which the Camera app shows as "0.5x".

### Torch

The torch is the continuous light on the back of the device. It is not the photo flash.

- [`torchMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/torchmode-swift.property) is `.off`, `.on`, or `.auto`. [`setTorchModeOn(level:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/settorchmodeon(level:)) sets a brightness level between 0 and 1. This method throws a Swift error.
- Ask `hasTorch` and `isTorchAvailable` first. The torch can be unavailable for a time, for example when the device is too hot.
- The flash is not a device setting. You ask for a flash in the settings of each photo, with the `flashMode` property of `AVCapturePhotoSettings`.

### Low light and frame rate

- **Low-light boost.** If [`isLowLightBoostSupported`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/islowlightboostsupported) is `true`, set [`automaticallyEnablesLowLightBoostWhenAvailable`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/automaticallyenableslowlightboostwhenavailable), and the device makes the picture lighter in a dark scene.
- **Automatic frame rate.** [`isAutoVideoFrameRateEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isautovideoframerateenabled) lets the device decrease the frame rate in low light, for example from 30 to 24 frames per second. A lower frame rate permits a longer shutter time for each frame.
- **A fixed frame rate.** [`activeVideoMinFrameDuration`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideominframeduration) and [`activeVideoMaxFrameDuration`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideomaxframeduration) set the limits of the frame rate. A duration is the reciprocal of a rate, so the minimum duration is the maximum rate. Set the two properties to the same value for a fixed rate.
- **Noise reduction for video (iOS 27).** This control is on the connection, not on the device: [`automaticallyEnablesLowLightVideoNoiseReduction`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyenableslowlightvideonoisereduction).

### Formats

All limits above come from one object: the [`activeFormat`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat) of the device. An [`AVCaptureDevice.Format`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format) describes one mode of operation of the sensor: the dimensions of the video, the frame rate ranges ([`videoSupportedFrameRateRanges`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videosupportedframerateranges)), the photo sizes, the maximum zoom, the ISO range, and more. The [`formats`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/formats) property lists all formats of a device.

A session preset selects a format for you. That is what the `.photo` preset did in chapter 3. You can also set `activeFormat` yourself, with the device lock. You do that in chapter 9, for HDR video.

> [!IMPORTANT]
> A new format sets many values back to their defaults: the frame durations, the points of interest, and more. Apply your settings again after each change of the format or of the session preset.

## Why AVCam does it this way

**It copies the Camera app.** A tap locks the focus and the exposure. A large change of the scene releases the lock. People know this behavior from the system Camera app, so they do not have to learn it.

**One method, two callers.** `focusAndExpose(at:isUserInitiated:)` does the work for the tap and for the notification. The `isUserInitiated` parameter selects the modes and also the state of the monitor: the monitor is on only while the camera is locked on a tapped point. In continuous mode, the camera adjusts itself, so a notification has no use.

**The capture service converts the point.** The view sends the tap location as it is. It knows nothing about device coordinates. The capture service finds the preview layer through the connections of the session, as it does for rotation, and asks the layer for the conversion.

**The notification is an asynchronous sequence.** [`notifications(named:object:)`](https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:)) gives the notifications as a sequence that a `for await` loop can read. The service passes the device as the `object` argument, so the loop gets only the notifications of the camera in use. The loop runs in a task that starts inside the actor, so the device configuration runs on the session queue.

**A new task for each camera.** The notification comes from one device object. When the camera changes, the service cancels the old task and starts a new one for the new device. This is the same idea as the rotation coordinator in chapter 2.

**Each block has its own support test.** The focus block and the exposure block are independent. On a camera with a fixed focus, the method skips the focus block and still sets the exposure.

The alternatives:

- **Stay in continuous mode after a tap.** Set the point, and then set `.continuousAutoFocus` again. The camera then prefers the tapped place, but it never locks.
- **A long press for a lock.** Set `.locked` for focus and exposure, and keep the monitor off. This is the "AE/AF lock" of the Camera app.
- **Separate points.** Some apps let the person put the focus point and the exposure point in different places.
- **A rectangle.** With the iOS 26 properties, the person can select how large the measured area is.

The limits of the simple design:

- **No indicator.** The sample draws nothing at the tapped point. The person gets no confirmation of the tap. You add an indicator as an experiment in the build page.
- **No `defer` for the unlock.** Nothing between the lock and the unlock can throw a Swift error, so the unlock always runs. If you add a throwing call there, the device stays locked. In your own code, write `defer { device.unlockForConfiguration() }` immediately after the lock.
- **The settings do not move to the next camera.** The modes and the points belong to one device object. After a camera switch, the new camera has its own state.
- **The layer is read on the session queue.** The capture service calls the conversion method of the preview layer from its own queue. The layer is an interface object, and interface objects belong to the main thread. The sample does it in this way, and this tutorial follows the sample. An alternative is to convert the point in the view and to send a device point to the model.
- **Errors of the automatic path are discarded.** The notification loop calls the method with `try?`. If the lock fails there, the camera stays locked on the tapped point until the next notification or the next tap.

## Common mistakes

- **A set without the lock, or without the support test.** The result is an Objective-C exception, which Swift cannot catch. The app stops.
- **A test on one camera only.** The back camera has automatic focus, so the code works. Then the person changes to a front camera with a fixed focus, and the first tap can stop the app.
- **The mode before the point.** The camera starts the operation when you set the mode. If the point comes after the mode, the camera uses the old point.
- **A point only.** If you set the point and no mode, nothing occurs.
- **View coordinates as device coordinates.** A division of the tap location by the size of the view is wrong in portrait, wrong for a cropped preview, and wrong for a mirrored front camera. Use the conversion method of the preview layer.
- **A lock that stays for ever.** Without subject area monitoring, a tap locks the focus and the exposure until the next tap.
- **A missing unlock.** An early `return` or `throw` between the lock and the unlock leaves the device locked.
- **Custom exposure and photo quality.** With a quality prioritization of `.balanced` or `.quality`, the photo pipeline can replace your ISO value and your duration in a dark scene, because it combines more than one image. Only `.speed` guarantees your manual values in the photo.
- **A check in the Simulator only.** A simulated camera has no lens and no light meter.

> [!IMPORTANT]
> In the Simulator with SimCam, a tap on the preview has no visible effect. The code runs, and nothing fails, but there is no real lens that can move. You need a real iPhone to see focus and exposure change.

## Documentation

```links
lockForConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration() | The method that gives your app the exclusive right to configure a device.
unlockForConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturedevice/unlockforconfiguration() | The method that releases the device lock.
AVCaptureDevice.FocusMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.enum | The three focus modes.
AVCaptureDevice.ExposureMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.enum | The four exposure modes.
focusPointOfInterest | https://developer.apple.com/documentation/avfoundation/avcapturedevice/focuspointofinterest | The point, in device coordinates, that the automatic focus uses.
exposurePointOfInterest | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposurepointofinterest | The point, in device coordinates, that the automatic exposure uses.
captureDevicePointConverted(fromLayerPoint:) | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/capturedevicepointconverted(fromlayerpoint:) | The conversion from a point of the preview layer to a device point.
isSubjectAreaChangeMonitoringEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/issubjectareachangemonitoringenabled | The switch for the monitor that reports large changes of the scene.
subjectAreaDidChangeNotification | https://developer.apple.com/documentation/avfoundation/avcapturedevice/subjectareadidchangenotification | The notification that the monitor posts.
setExposureTargetBias(_:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuretargetbias(_:completionhandler:) | Exposure compensation in EV units.
setExposureModeCustom(duration:iso:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuremodecustom(duration:iso:completionhandler:) | Manual shutter time and ISO value.
setWhiteBalanceModeLocked(with:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setwhitebalancemodelocked(with:completionhandler:) | Manual white balance.
videoZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor | The zoom of the device.
AVCaptureDevice.Format | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format | One mode of operation of the sensor, with all its limits.
Capture setup | https://developer.apple.com/documentation/avfoundation/capture-setup | Apple's collection page for sessions, devices, and device controls.
WWDC22: Discover advancements in iOS camera capture | https://developer.apple.com/videos/play/wwdc2022/110429/ | The session that introduces face-driven focus and exposure.
WWDC21: What's new in camera capture | https://developer.apple.com/videos/play/wwdc2021/10047/ | The session about the minimum focus distance and other device features.
Build: focus and exposure | ch06-build.md | The tutorial for this chapter.
```
