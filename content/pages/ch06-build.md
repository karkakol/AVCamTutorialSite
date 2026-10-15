---
kind: tutorial
chapter: 6
title: Build: focus and exposure
abstract: Configure the camera device for a tapped point, return to the continuous modes when the scene changes, and connect a tap gesture to the preview.
estimatedMinutes: 25
startBranch: chapter-05
branch: chapter-06
---

At the end of chapter 5, the camera decides the focus and the exposure by itself, for the center of the picture. In this chapter, a tap on the preview tells the camera which place is important.

You write one method that configures the camera device, and you write it slowly: a few lines in each step. Then you convert the tap location to device coordinates, you make the camera return to the continuous modes when the scene changes, and you add the tap gesture to the preview.

Read [Concepts: focus and exposure](ch06-concepts.md) first. It explains the device lock, the modes, and the coordinates of a point of interest.

> [!IMPORTANT]
> You can build and run all steps in the Simulator, but a tap has no visible effect there. The camera of SimCam has no lens that can move. To see the focus and the exposure change, you need a real iPhone.

## Configure the device

The hardware settings belong to the [`AVCaptureDevice`](https://developer.apple.com/documentation/avfoundation/avcapturedevice) object. To change a setting, you always do four operations: you ask the device if it supports the value, you lock the device, you set the value, and you unlock the device.

In this section, you write the private method `focusAndExpose(at:isUserInitiated:)`. It has two callers. After a tap, it does a one-time focus and exposure operation at the tapped point. After a large change of the scene, it sets the continuous modes again. The `isUserInitiated` parameter tells the method which of the two cases it is.

![The two states of the camera: continuous modes at the center, and a lock on the tapped point until the subject area changes](../images/ch06-tap-cycle.svg)

### Step
In `CaptureService.swift`, below the `videoPreviewLayer` property, add a `MARK` comment and the private method `focusAndExpose(at:isUserInitiated:)`. Read `currentDevice` into a constant `device`.

The comment is `// MARK: - Automatic focus and exposure`. The signature is `private func focusAndExpose(at devicePoint: CGPoint, isUserInitiated: Bool) throws`. The method reads `currentDevice` one time and uses the constant `device` for all later lines. Thus all operations of the method, from the lock to the unlock, go to the same device object. The method is `throws`, because the lock in the next step can fail. If you build after this step, Xcode warns that the constant `device` is never used. The next step uses it.

```swift file=AVCam/CaptureService.swift highlight=4,6-9
        return previewLayer
    }

    // MARK: - Automatic focus and exposure

    private func focusAndExpose(at devicePoint: CGPoint, isUserInitiated: Bool) throws {
        // Configure the current device.
        let device = currentDevice
    }

    // MARK: - Photo capture
```

### Step
Lock the device for configuration, and unlock it at the end of the method.

[`lockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()) gives your app the exclusive right to change the settings of the device. It throws a Swift error if it cannot get the lock. All changes go between this call and [`unlockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/unlockforconfiguration()). The settings stay after the unlock.

> [!IMPORTANT]
> If you set a property of the device without the lock, the device raises an Objective-C exception. Swift cannot catch it with `do` and `catch`, and the app stops.

```swift file=AVCam/CaptureService.swift highlight=5-6,8-9
    private func focusAndExpose(at devicePoint: CGPoint, isUserInitiated: Bool) throws {
        // Configure the current device.
        let device = currentDevice

        // The following mode and point of interest configuration requires obtaining an exclusive lock on the device.
        try device.lockForConfiguration()

        // Release the lock.
        device.unlockForConfiguration()
    }
```

### Step
Between the lock and the unlock, select the focus mode into a constant `focusMode`: `.autoFocus` for a tap, and `.continuousAutoFocus` in the other case.

With [`.autoFocus`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.enum), the camera focuses one time and then locks the lens. So the focus stays on the place that the person selected. With `.continuousAutoFocus`, the camera focuses again each time the scene makes it necessary. The first value has its full type name, `AVCaptureDevice.FocusMode.autoFocus`, so that Swift knows the type of the constant. A build after this step warns that `focusMode` is never used. The next step uses it.

```swift file=AVCam/CaptureService.swift highlight=4
        // The following mode and point of interest configuration requires obtaining an exclusive lock on the device.
        try device.lockForConfiguration()

        let focusMode = isUserInitiated ? AVCaptureDevice.FocusMode.autoFocus : .continuousAutoFocus

        // Release the lock.
        device.unlockForConfiguration()
    }
```

### Step
Ask the device if it supports a focus point of interest and the focus mode. If it does, set the point, then the mode.

- The two tests are [`isFocusPointOfInterestSupported`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isfocuspointofinterestsupported) and [`isFocusModeSupported(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isfocusmodesupported(_:)). They are necessary. A camera with a fixed focus does not support them, and a value that the device does not support raises an Objective-C exception. With the tests, the method skips the focus on such a camera.
- The order is necessary too. A new [`focusPointOfInterest`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/focuspointofinterest) by itself starts nothing. The camera starts the focus operation when you set [`focusMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.property), and it uses the point that the device has at that time.

```swift file=AVCam/CaptureService.swift highlight=4-7
        try device.lockForConfiguration()

        let focusMode = isUserInitiated ? AVCaptureDevice.FocusMode.autoFocus : .continuousAutoFocus
        if device.isFocusPointOfInterestSupported && device.isFocusModeSupported(focusMode) {
            device.focusPointOfInterest = devicePoint
            device.focusMode = focusMode
        }

        // Release the lock.
        device.unlockForConfiguration()
    }
```

### Step
Do the same for the exposure: select the mode into a constant `exposureMode`, ask the device, set the point, and then set the mode.

The exposure has its own modes in [`AVCaptureDevice.ExposureMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.enum): `.autoExpose` for a tap, and `.continuousAutoExposure` in the other case. It has its own [`exposurePointOfInterest`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposurepointofinterest) and [`exposureMode`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.property) properties, and its own support tests, `isExposurePointOfInterestSupported` and `isExposureModeSupported(_:)`. The exposure block does not depend on the focus block. On a camera with a fixed focus, the method skips the focus and still sets the exposure for the tapped point.

```swift file=AVCam/CaptureService.swift highlight=7-11
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

        // Release the lock.
        device.unlockForConfiguration()
    }
```

### Step
After the exposure block, set the subject area change monitoring of the device to the value of `isUserInitiated`.

After a tap, the camera is locked on one place. With [`isSubjectAreaChangeMonitoringEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/issubjectareachangemonitoringenabled) set to `true`, the device posts a notification when the scene changes a lot. Later in this chapter, you use that notification to call this method a second time, with `isUserInitiated` set to `false`. That call sets the continuous modes and stops the monitor, because a camera in continuous mode adjusts itself.

```swift file=AVCam/CaptureService.swift highlight=5-8
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

### Note
Between the lock and the unlock, no line can throw a Swift error. So the unlock always runs, and the sample does not need a `defer` statement here. In your own code, write `defer { device.unlockForConfiguration() }` immediately after the lock. Then a `throw` or a `return` that you add later cannot leave the device locked.

### Step
Build the project to make sure that the new method compiles.

Nothing calls the method yet, so the app does not behave differently. You add the two callers in the next two sections.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: Build Succeeded, with no errors
```

## Convert the tap to a device point

A point of interest is in device coordinates: (0, 0) is the top left corner of the landscape image from the sensor, and (1, 1) is the bottom right corner. A tap gives a point in the coordinates of a view. Between the two, the system rotates the video, crops it, and can mirror it.

In this section, you write the method that the camera model calls. It converts the point and then calls the private method.

![A tap at a view point in a portrait preview, and the same place as a device point in the landscape image from the sensor](../images/ch06-point-of-interest.svg)

### Step
Between the `MARK` comment and the private method, add a second method, `func focusAndExpose(at point: CGPoint)`, which takes a point in view coordinates.

This method is not `private`, because the camera model calls it. It is not `async` either: the actor runs it on the session queue when a caller awaits it. It has no `throws` keyword: a caller in the interface can do nothing useful with an error of a focus operation. The two methods have the same base name. Swift selects the correct one from the argument labels.

```swift file=AVCam/CaptureService.swift highlight=3-7
    // MARK: - Automatic focus and exposure

    /// Performs a one-time automatic focus and expose operation.
    ///
    /// The app calls this method as the result of a person tapping on the preview area.
    func focusAndExpose(at point: CGPoint) {
    }

    private func focusAndExpose(at devicePoint: CGPoint, isUserInitiated: Bool) throws {
```

### Step
In the new method, convert the view point to a device point with the preview layer. Keep the result in a constant `devicePoint`.

The preview layer shows the video, so it has the data for the conversion. The SDK header says that [`captureDevicePointConverted(fromLayerPoint:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/capturedevicepointconverted(fromlayerpoint:)) uses the frame size and the video gravity of the layer, and that the result is a point of the image that is not rotated. This tutorial did not test the result with a mirrored front camera. The preview layer is the backing layer of the preview view, so a point of the view is also a point of the layer. The service finds the layer with the `videoPreviewLayer` property from chapter 2. A build after this step warns that `devicePoint` is never used. The next step uses it.

```swift file=AVCam/CaptureService.swift highlight=7-8
    // MARK: - Automatic focus and exposure

    /// Performs a one-time automatic focus and expose operation.
    ///
    /// The app calls this method as the result of a person tapping on the preview area.
    func focusAndExpose(at point: CGPoint) {
        // The point this call receives is in view-space coordinates. Convert this point to device coordinates.
        let devicePoint = videoPreviewLayer.captureDevicePointConverted(fromLayerPoint: point)
    }

    private func focusAndExpose(at devicePoint: CGPoint, isUserInitiated: Bool) throws {
```

### Step
Call the private method with the device point and with `isUserInitiated` set to `true`. Catch an error, and write it to the log.

The call goes in a `do` block, and the `catch` block calls `logger.debug(_:)` with the message "Unable to perform focus and exposure operation." and the error. The only Swift error that can arrive here is a failure of the device lock. A focus operation that fails is not a reason to show an alert, so the method only writes a log message. The checkpoint at the end of this chapter looks for this message in the console.

```swift file=AVCam/CaptureService.swift highlight=4-9
    func focusAndExpose(at point: CGPoint) {
        // The point this call receives is in view-space coordinates. Convert this point to device coordinates.
        let devicePoint = videoPreviewLayer.captureDevicePointConverted(fromLayerPoint: point)
        do {
            // Perform a user-initiated focus and expose.
            try focusAndExpose(at: devicePoint, isUserInitiated: true)
        } catch {
            logger.debug("Unable to perform focus and exposure operation. \(error)")
        }
    }
```

### Step
Build the project to make sure that both methods compile.

Swift accepts the two methods with the same base name, because their argument labels differ. The service still has no caller for the new method.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: Build Succeeded, with no errors
```

## Return to the continuous modes

After a tap, the focus and the exposure are locked. If the person then points the camera at a different scene, the picture stays wrong until the next tap. The device can tell the app about such a change with the [`subjectAreaDidChangeNotification`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/subjectareadidchangenotification).

In this section, you observe that notification for the camera in use. Each time it arrives, the service sets the continuous modes again, with the point of interest at the center.

### Step
Below `focusAndExpose(at:)`, add the private method `observeSubjectAreaChanges(of:)` and, below it, a private property `subjectAreaChangeTask` for its task. In the method, cancel the previous task.

The parameter is `of device: AVCaptureDevice`. The notification comes from one device object. When the camera changes, the old observation has no more use, so the method cancels its task with `cancel()`. The property is an optional `Task<Void, Never>?`, because no task exists before the first call. The type `Task<Void, Never>` is a task that returns no value and throws no error.

```swift file=AVCam/CaptureService.swift highlight=5-10
            logger.debug("Unable to perform focus and exposure operation. \(error)")
        }
    }

    // Observe notifications of type `subjectAreaDidChangeNotification` for the specified device.
    private func observeSubjectAreaChanges(of device: AVCaptureDevice) {
        // Cancel the previous observation task.
        subjectAreaChangeTask?.cancel()
    }
    private var subjectAreaChangeTask: Task<Void, Never>?

    private func focusAndExpose(at devicePoint: CGPoint, isUserInitiated: Bool) throws {
```

### Step
Start a new task, and keep it in the property. In the task, read the notifications of the device as an asynchronous sequence.

- [`notifications(named:object:)`](https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:)) of `NotificationCenter.default` returns the notifications as a sequence for a `for await` loop. The name is `AVCaptureDevice.subjectAreaDidChangeNotification`. The `object` argument is a filter: the loop gets only the notifications that this device posts.
- The loop does not use the notification, so it is `for await _ in`. The `compactMap` call on the sequence replaces each notification with the value `true`. A `Bool` value is `Sendable`, and a `Notification` object is not.
- The task starts inside the actor, so the loop runs on the session queue. When the method cancels the task, the loop ends.

```swift file=AVCam/CaptureService.swift highlight=4-8
    private func observeSubjectAreaChanges(of device: AVCaptureDevice) {
        // Cancel the previous observation task.
        subjectAreaChangeTask?.cancel()
        subjectAreaChangeTask = Task {
            // Signal true when this notification occurs.
            for await _ in NotificationCenter.default.notifications(named: AVCaptureDevice.subjectAreaDidChangeNotification, object: device).compactMap({ _ in true }) {
            }
        }
    }
    private var subjectAreaChangeTask: Task<Void, Never>?
```

### Step
In the loop, call the private method with the center point and with `isUserInitiated` set to `false`.

The point (0.5, 0.5) is the center of the picture in device coordinates, so no conversion is necessary. The call sets the continuous modes and stops the monitor. Thus the device posts no more notifications until the next tap. `try?` discards an error: there is no person to tell, and the next tap configures the device again.

```swift file=AVCam/CaptureService.swift highlight=4-5
        subjectAreaChangeTask = Task {
            // Signal true when this notification occurs.
            for await _ in NotificationCenter.default.notifications(named: AVCaptureDevice.subjectAreaDidChangeNotification, object: device).compactMap({ _ in true }) {
                // Perform a system-initiated focus and expose.
                try? focusAndExpose(at: CGPoint(x: 0.5, y: 0.5), isUserInitiated: false)
            }
        }
    }
```

### Step
In `setUpSession()`, start the observation for the default camera, after the line that creates the rotation coordinator.

The observation only listens. The device posts the notification only while the monitor is on, and the monitor is on only after a tap.

```swift file=AVCam/CaptureService.swift highlight=5-6
            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
            // Observe changes to the default camera's subject area.
            observeSubjectAreaChanges(of: defaultCamera)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
In `changeCaptureDevice(to:)`, start the observation for the new camera, after the line that creates the new rotation coordinator.

This is the same rule as for the rotation coordinator in chapter 2: an object that belongs to one camera must be made again after a camera switch. Without this line, the service continues to listen to the old camera, and a tap on the preview of the new camera locks the focus and the exposure until the next tap.

```swift file=AVCam/CaptureService.swift highlight=6-7
        do {
            // Attempt to connect a new input and device to the capture session.
            activeVideoInput = try addInput(for: device)
            // Configure a new rotation coordinator for the new device.
            createRotationCoordinator(for: device)
            // Register for device observations.
            observeSubjectAreaChanges(of: device)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
        } catch {
            // Reconnect the existing camera on failure.
            captureSession.addInput(currentInput)
        }
    }
```

### Step
Build the project to make sure that the capture service compiles.

The service is complete. No view calls `focusAndExpose(at:)` yet. You connect the tap in the next section.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: Build Succeeded, with no errors
```

## Connect the tap gesture

The views do not use the capture service directly. They use the `Camera` protocol. In this section, you add the new method to the protocol and to its two model classes. Then you add a tap gesture to the preview.

### Step
In `Camera.swift`, add the `async` method `focusAndExpose(at point: CGPoint)` to the protocol, below the `isSwitchingVideoDevices` property.

The method is `async`, because the model must await the actor. The project does not compile until you add the method to `CameraModel` and to `PreviewCameraModel`.

```swift file=AVCam/Model/Camera.swift highlight=4-5
    /// A Boolean value that indicates whether the camera is currently switching video devices.
    var isSwitchingVideoDevices: Bool { get }

    /// Performs a one-time automatic focus and exposure operation.
    func focusAndExpose(at point: CGPoint) async

    /// Captures a photo and writes it to the user's photo library.
    func capturePhoto() async
```

### Step
In `CameraModel.swift`, add the `async` method `focusAndExpose(at:)` below the `capturePhoto()` method. Await the same method of `captureService`.

The model sends the point to the capture service and adds nothing. The `await` keyword moves the work from the main actor to the session queue of the service. The point is still in view coordinates here.

```swift file=AVCam/CameraModel.swift highlight=5-8
            self.error = error
        }
    }

    /// Performs a focus and expose operation at the specified screen point.
    func focusAndExpose(at point: CGPoint) async {
        await captureService.focusAndExpose(at: point)
    }

    /// Sets the `showCaptureFeedback` state to indicate that capture is underway.
    private func flashScreen() {
```

### Step
In `PreviewCameraModel.swift`, add a `focusAndExpose(at:)` method that only writes a log message.

SwiftUI previews use this model, and it has no camera. As in chapter 2, a synchronous method is sufficient for an `async` requirement of the protocol.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=5-7
    func capturePhoto() {
        logger.debug("Photo capture isn't implemented in PreviewCamera.")
    }

    func focusAndExpose(at point: CGPoint) {
        logger.debug("Focus and expose isn't implemented in PreviewCamera.")
    }
}
```

### Step
In `CameraView.swift`, add a tap gesture to `CameraPreview`, as its first modifier. In the action, start a task that calls the model.

- The closure of `onTapGesture` gets the location of the tap in the coordinates of the view that has the modifier. That view is the preview view, whose layer does the conversion. So the modifier must be on `CameraPreview`, and not on a view around it, whose coordinates can be different from the coordinates of the preview view.
- The action is synchronous, and the model method is `async`, so the action starts a `Task`.
- The buttons of `CameraUI` lie on top of the preview, so a tap on a button does not get to this gesture.

```swift file=AVCam/CameraView.swift highlight=4-7
            PreviewContainer(camera: camera) {
                // A view that provides a preview of the captured content.
                CameraPreview(source: camera.previewSource)
                    // Focus and expose at the tapped point.
                    .onTapGesture { location in
                        Task { await camera.focusAndExpose(at: location) }
                    }
                    /// The value of `shouldFlashScreen` changes briefly to `true` when capture
                    /// starts, and then immediately changes to `false`. Use this change to
                    /// flash the screen to provide visual feedback when capturing photos.
                    .opacity(camera.shouldFlashScreen ? 0 : 1)
            }
```

### Step
Build and run the app. Tap on the preview in some different places, and look at the console of Xcode.

In the Simulator with SimCam, the preview does not change, the app continues to run, and the console shows no "Unable to perform focus and exposure operation" message. That is all that the Simulator can show: the camera of SimCam has no real lens and no light meter. The sample draws no focus indicator, so nothing else confirms the tap.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap on the preview
Result in the Simulator: no visible change, no stop of the app, no error message in the console
Needs a real iPhone: a visible change of the focus and of the exposure
```

### Note
This tutorial did not verify the feature on a real iPhone. If you have one, run the app there. Hold a near object at one side of the picture, and tap on it. Then tap on a bright window, and then on a dark corner. The code asks the camera to focus on the tapped place and to make the picture lighter or darker for it. Then point the camera at a different scene. The code asks the camera to return to the continuous modes.

### Experiment
The sample shows no focus indicator. Add one that you can also see in the Simulator. In `CameraView`, add a `@State` property with an optional `CGPoint`, and set it to the tap location in the gesture closure. Then add an `overlay` to `CameraPreview` that draws a small yellow square with its `position` at that point, and set the property to `nil` after one second. The location of the tap and the position in the overlay use the same coordinate space, so no conversion is necessary. Remove the code when you finish, so that your code stays equal to the branch `chapter-06`.

### Experiment
On a real iPhone, change `.autoFocus` to `.continuousAutoFocus` and `.autoExpose` to `.continuousAutoExposure` in the two lines that select the modes. Now a tap moves the point of interest, but the camera does not lock. Compare the behavior with the original code. Then set the lines back.

### Text
Your code is now the same as the `chapter-06` branch. The procedure that you used here, with the support test, the lock, the value, and the unlock, is the procedure for each hardware control of a device. In chapter 7, you return to the photo output and add Live Photos, a quality setting, and faster capture.

## Check your understanding

### The person changes to a front camera that has a fixed focus and taps on the preview. What does `focusAndExpose(at:isUserInitiated:)` do?

- [ ] It throws an error, and `focusAndExpose(at:)` writes it to the log.
  > The method throws only when the device lock fails. A camera without automatic focus is not an error for this method.
- [x] It skips the focus block, because the support tests are false, and it still sets the exposure for the tapped point.
  > Correct. The focus block and the exposure block each have their own tests. Each block runs only when the device supports the point of interest and the mode.
- [ ] It stops the app, because the camera does not support the `.autoFocus` mode.
  > That occurs when code sets a mode without a test. This method asks `isFocusModeSupported(_:)` before it sets the mode.

### Why does the method set `isSubjectAreaChangeMonitoringEnabled` to the value of `isUserInitiated`?

- [ ] Because the device accepts a point of interest only while the monitor is on.
  > The point of interest does not depend on the monitor. It depends on `isFocusPointOfInterestSupported` and on the mode that you set after it.
- [ ] Because the monitor must be off before the device can be unlocked.
  > The lock and the monitor are independent. You can unlock the device with the monitor on or off.
- [x] Because the app needs the notification only while the camera is locked on a tapped point.
  > Correct. After a tap, the notification is the signal to return to the continuous modes. In continuous mode, the camera adjusts itself, so the method stops the monitor.

### An iPhone is in portrait. A developer calculates the point of interest with this line and does not use the preview layer. What is the result?

```swift
let devicePoint = CGPoint(x: location.x / viewSize.width, y: location.y / viewSize.height)
```

- [ ] The result is correct, because the values are between 0 and 1.
  > The range is correct, but the axes are not. Device coordinates refer to the landscape image from the sensor, which is not rotated.
- [x] The camera focuses on a different place, because device coordinates do not follow the rotation, the crop, and the mirror state of the preview.
  > Correct. In portrait, the top left corner of the preview is not the device point (0, 0). `captureDevicePointConverted(fromLayerPoint:)` does this conversion for you.
- [ ] The app stops, because a point of interest must come from the preview layer.
  > The device accepts each point between (0, 0) and (1, 1). It cannot know where the point came from. The result is a wrong place, not a stop of the app.
