---
kind: tutorial
chapter: 12
title: Build: Camera Control
abstract: Create a zoom slider, an exposure bias slider, and a custom lens position slider for the Camera Control, add them to the session, and fade the app controls while the system overlay is on the screen.
estimatedMinutes: 35
startBranch: chapter-11
branch: chapter-12
---

In this tutorial, you give the Camera Control three settings to change: zoom, exposure bias, and the lens position. At the end, the capture session has these controls, and the app fades four of its own views while the system overlay uses the full screen.

You add no new files. You add approximately 140 lines to seven files that you know from the earlier chapters. Most of the lines go into `CaptureService.swift`.

The Camera Control does not exist in the Simulator, and nobody ran this chapter on an iPhone that has one. In the Simulator, your checkpoints show that the app builds and runs as before. The last section tells you what to look for on an iPhone 16 or later. Read [Concepts: Camera Control](ch12-concepts.md) first if you want the background for each step.

## Create the controls

A control is an object that describes one setting: its title, its symbol, its range, and what happens when the value changes. In this section, you write the method that makes the controls for one camera.

The method makes two system controls, which change a device property themselves, and one custom control, which calls your code. It keeps the controls of each camera in a dictionary, so that each camera gets its control objects only one time.

![The Camera Control changes the controls of the capture session. The system sliders set a device property themselves, a custom slider calls your action, and the controls delegate receives four callbacks.](../images/ch12-controls.svg)

### Step
In `CaptureService.swift`, add the `controlsMap` property above the `sessionQueue` property.

The key is the [`uniqueID`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/uniqueid) of a camera, and the value is the array of controls for that camera. [`AVCaptureControl`](https://developer.apple.com/documentation/avfoundation/avcapturecontrol) is the base class of all controls, so one array can hold system controls and custom controls.

```swift file=AVCam/CaptureService.swift highlight=4-5
    // A Boolean value that indicates whether the actor finished its required configuration.
    private var isSetUp = false
    
    // A map that stores capture controls by device identifier.
    private var controlsMap: [String: [AVCaptureControl]] = [:]
    
    // A serial dispatch queue to use for capture control actions.
    private let sessionQueue = DispatchSerialQueue(label: "com.karolkakol.AVCam.sessionQueue")
```

### Step
Below the `currentDevice` property, add a mark and the `createControls(for:)` method, which first looks for the controls of the device in the dictionary.

When the dictionary has an entry for this camera, the method returns the same objects again. A person can change the camera many times, and each control object keeps its state.

Write `func createControls(for device: AVCaptureDevice) -> [AVCaptureControl]` without `private`. The method binds the entry with `guard let controls = controlsMap[device.uniqueID] else { }` and returns `controls` after the `else` block. Write the three comment lines of the solution too.

```swift file=AVCam/CaptureService.swift highlight=9,11-14,16-18
    // The device for the active video input.
    private var currentDevice: AVCaptureDevice {
        guard let device = activeVideoInput?.device else {
            fatalError("No device found for current video input.")
        }
        return device
    }
    
    // MARK: - Capture controls
    
    func createControls(for device: AVCaptureDevice) -> [AVCaptureControl] {
        // Retrieve the capture controls for this device, if they exist.
        guard let controls = controlsMap[device.uniqueID] else {
        }
        
        // Return the previously created controls.
        return controls
    }
    
    // MARK: - Capture mode selection
```

### Note
The project does not compile at this time, because the `else` block of the `guard` statement is empty. You complete it in the next step.

### Step
In the `else` block, create the two system controls for the device, and return the array.

An [`AVCaptureSystemZoomSlider`](https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider) changes the zoom factor of its device, and an [`AVCaptureSystemExposureBiasSlider`](https://developer.apple.com/documentation/avfoundation/avcapturesystemexposurebiasslider) changes the exposure bias. Each control takes its range from the active format of the device and sets the device property itself. Thus you write no action for them.

Write `var controls = [` with `AVCaptureSystemZoomSlider(device: device)` and `AVCaptureSystemExposureBiasSlider(device: device)` on two lines, then `]`. Use `var`, because a later step appends a third control. Until then, Xcode shows a warning that `controls` is never changed. The variable in the `else` block does not clash with the `guard` binding, which exists only after the block.

```swift file=AVCam/CaptureService.swift highlight=4-9
    func createControls(for device: AVCaptureDevice) -> [AVCaptureControl] {
        // Retrieve the capture controls for this device, if they exist.
        guard let controls = controlsMap[device.uniqueID] else {
            // Define the default controls.
            var controls = [
                AVCaptureSystemZoomSlider(device: device),
                AVCaptureSystemExposureBiasSlider(device: device)
            ]
            return controls
        }
        
        // Return the previously created controls.
        return controls
    }
```

### Step
Below the array, test if the device supports a custom lens position, and create a custom slider with a title, a symbol, and a range.

An [`AVCaptureSlider`](https://developer.apple.com/documentation/avfoundation/avcaptureslider) is a control for a setting of your own. The symbol name must be a name from SF Symbols. The range `0...1` is the range of the lens position of a camera. Not each camera can move its lens, so the code asks [`isLockingFocusWithCustomLensPositionSupported`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/islockingfocuswithcustomlenspositionsupported) first.

Inside the `if` block, write `let lensSlider = AVCaptureSlider("Lens Position", symbolName: "circle.dotted.circle", in: 0...1)`. Xcode shows a warning that `lensSlider` is not used until the next step.

```swift file=AVCam/CaptureService.swift highlight=6-10
            // Define the default controls.
            var controls = [
                AVCaptureSystemZoomSlider(device: device),
                AVCaptureSystemExposureBiasSlider(device: device)
            ]
            // Create a lens position control if the device supports setting a custom position.
            if device.isLockingFocusWithCustomLensPositionSupported {
                // Create a slider to adjust the value from 0 to 1.
                let lensSlider = AVCaptureSlider("Lens Position", symbolName: "circle.dotted.circle", in: 0...1)
            }
            return controls
        }
```

### Step
Give the slider an action with an empty body, and tell it to run the action on the session queue.

[`setActionQueue(_:action:)`](https://developer.apple.com/documentation/avfoundation/avcaptureslider/setactionqueue(_:action:)) takes a queue and a closure. The system calls the closure with the new value each time the person moves the slider. The session queue is the executor of this actor, so the closure and the methods of the actor never run at the same time. A custom control must have an action before you add it to a session.

Write `lensSlider.setActionQueue(sessionQueue) { lensPosition in` and the closing brace. The closure parameter `lensPosition` is a `Float`.

```swift file=AVCam/CaptureService.swift highlight=5-7
            // Create a lens position control if the device supports setting a custom position.
            if device.isLockingFocusWithCustomLensPositionSupported {
                // Create a slider to adjust the value from 0 to 1.
                let lensSlider = AVCaptureSlider("Lens Position", symbolName: "circle.dotted.circle", in: 0...1)
                // Perform the slider's action on the session queue.
                lensSlider.setActionQueue(sessionQueue) { lensPosition in
                }
            }
```

### Step
In the action, lock the device for configuration, lock the focus at the new lens position, and unlock the device.

This is the pattern from chapter 6: each change of a device needs [`lockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()) before it and `unlockForConfiguration()` after it. [`setFocusModeLocked(lensPosition:completionHandler:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/setfocusmodelocked(lensposition:completionhandler:)) stops automatic focus and moves the lens to the position. The closure captures `device`, so this slider always changes the camera that it was made for.

Call `device.setFocusModeLocked(lensPosition: lensPosition)` without the completion handler. In the `catch` block, write `logger.info("Unable to change the lens position: \(error)")`.

```swift file=AVCam/CaptureService.swift highlight=3-9
                // Perform the slider's action on the session queue.
                lensSlider.setActionQueue(sessionQueue) { lensPosition in
                    do {
                        try device.lockForConfiguration()
                        device.setFocusModeLocked(lensPosition: lensPosition)
                        device.unlockForConfiguration()
                    } catch {
                        logger.info("Unable to change the lens position: \(error)")
                    }
                }
```

### Step
Below the action, add the slider to the array of controls.

The slider is the third control of a camera that supports a custom lens position. For other cameras, the array has only the two system controls.

```swift file=AVCam/CaptureService.swift highlight=11-12
                // Perform the slider's action on the session queue.
                lensSlider.setActionQueue(sessionQueue) { lensPosition in
                    do {
                        try device.lockForConfiguration()
                        device.setFocusModeLocked(lensPosition: lensPosition)
                        device.unlockForConfiguration()
                    } catch {
                        logger.info("Unable to change the lens position: \(error)")
                    }
                }
                // Add the slider the controls array.
                controls.append(lensSlider)
            }
            return controls
        }
```

### Step
Before the `return` statement in the `else` block, store the new controls in the dictionary.

Without this line, each call makes new objects. A system control is bound to one camera, so the back camera and the front camera each need their own entry.

```swift file=AVCam/CaptureService.swift highlight=4-5
                // Add the slider the controls array.
                controls.append(lensSlider)
            }
            // Store the controls for future use.
            controlsMap[device.uniqueID] = controls
            return controls
        }
        
        // Return the previously created controls.
        return controls
    }
```

### Step
Build the project to make sure that `createControls(for:)` compiles.

No code calls the method yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Create the controls delegate

The session tells a delegate object when the controls become active and when the system overlay changes to its fullscreen appearance. A session without a controls delegate does not make its controls active, so this object is not optional.

In this section, you write the delegate class. It keeps one Boolean value: is the overlay in its fullscreen appearance or not?

### Step
At the end of `CaptureService.swift`, below the actor, add the `CaptureControlsDelegate` class with a published property.

[`AVCaptureSessionControlsDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturesessioncontrolsdelegate) is an Objective-C protocol, so the class inherits from `NSObject`. `@Published` gives the class a publisher, `$isShowingFullscreenControls`. The actor reads this publisher later, as it reads the activity publisher of the photo service.

Write `class CaptureControlsDelegate: NSObject, AVCaptureSessionControlsDelegate` and, after an empty line, `@Published private(set) var isShowingFullscreenControls = false`.

```swift file=AVCam/CaptureService.swift highlight=6,8-9
            }
        }
    }
}

class CaptureControlsDelegate: NSObject, AVCaptureSessionControlsDelegate {
    
    @Published private(set) var isShowingFullscreenControls = false
}
```

### Note
The project does not compile at this time, because the protocol has four required methods. You add them in the next two steps.

### Step
Add the two methods that the session calls when the controls become active and when they become inactive.

"Active" means that a person can interact with the controls. The app has nothing to do at these two moments, so the methods only write a log line. On an iPhone with a Camera Control, the log lines show you when each callback arrives.

The methods are `sessionControlsDidBecomeActive(_ session: AVCaptureSession)` and `sessionControlsDidBecomeInactive(_ session: AVCaptureSession)`. Each one calls `logger.debug` with the text "Capture controls active." or "Capture controls inactive.". The project does not compile until the next step adds the other two methods.

```swift file=AVCam/CaptureService.swift highlight=5-10
class CaptureControlsDelegate: NSObject, AVCaptureSessionControlsDelegate {
    
    @Published private(set) var isShowingFullscreenControls = false

    func sessionControlsDidBecomeActive(_ session: AVCaptureSession) {
        logger.debug("Capture controls active.")
    }
    func sessionControlsDidBecomeInactive(_ session: AVCaptureSession) {
        logger.debug("Capture controls inactive.")
    }
}
```

### Step
Between these two methods, add the two methods for the fullscreen appearance, which set the published property.

[`sessionControlsWillEnterFullscreenAppearance(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesessioncontrolsdelegate/sessioncontrolswillenterfullscreenappearance(_:)) is the signal to hide parts of the interface. The "will exit" method is the signal to show them again. The names say "will": each callback tells you about a change that is about to start.

The second method is `sessionControlsWillExitFullscreenAppearance(_ session: AVCaptureSession)`. Each method first sets `isShowingFullscreenControls` to `true` or `false`, then calls `logger.debug` with "Capture controls will enter fullscreen appearance." or "Capture controls will exit fullscreen appearance.". Put an empty line between the methods.

```swift file=AVCam/CaptureService.swift highlight=9-12,14-17
class CaptureControlsDelegate: NSObject, AVCaptureSessionControlsDelegate {
    
    @Published private(set) var isShowingFullscreenControls = false

    func sessionControlsDidBecomeActive(_ session: AVCaptureSession) {
        logger.debug("Capture controls active.")
    }

    func sessionControlsWillEnterFullscreenAppearance(_ session: AVCaptureSession) {
        isShowingFullscreenControls = true
        logger.debug("Capture controls will enter fullscreen appearance.")
    }
    
    func sessionControlsWillExitFullscreenAppearance(_ session: AVCaptureSession) {
        isShowingFullscreenControls = false
        logger.debug("Capture controls will exit fullscreen appearance.")
    }
    
    func sessionControlsDidBecomeInactive(_ session: AVCaptureSession) {
        logger.debug("Capture controls inactive.")
    }
}
```

### Step
In the `CaptureService` actor, add the `controlsDelegate` property above the `controlsMap` property.

The actor creates one delegate object and keeps it for its full life. You give this object to the session in the next section. Write `private var controlsDelegate = CaptureControlsDelegate()` with `var`, as the Apple sample does.

```swift file=AVCam/CaptureService.swift highlight=4-5
    // A Boolean value that indicates whether the actor finished its required configuration.
    private var isSetUp = false
    
    // A delegate object that responds to capture control activation and presentation events.
    private var controlsDelegate = CaptureControlsDelegate()
    
    // A map that stores capture controls by device identifier.
    private var controlsMap: [String: [AVCaptureControl]] = [:]
    
    // A serial dispatch queue to use for capture control actions.
    private let sessionQueue = DispatchSerialQueue(label: "com.karolkakol.AVCam.sessionQueue")
```

### Step
Build the project to make sure that the delegate class conforms to the protocol.

The delegate is not connected to the session yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the controls to the session

Controls belong to the capture session, as inputs and outputs do. In this section, you write the method that replaces the controls of the session with the controls of one camera. Then you call it for the first camera and after each change of the camera.

### Step
Above `createControls(for:)`, add the `configureControls(for:)` method, which returns immediately when the hardware has no Camera Control.

[`supportsControls`](https://developer.apple.com/documentation/avfoundation/avcapturesession/supportscontrols) is `true` only on a device that has a Camera Control. On an iPad, on an older iPhone, and in the Simulator, the method stops here, and the rest of this chapter has no effect.

Write `private func configureControls(for device: AVCaptureDevice)`. The Apple sample has an empty line after the opening brace. The `guard` statement has `else { return }` on the same line.

```swift file=AVCam/CaptureService.swift highlight=3-7
    // MARK: - Capture controls
    
    private func configureControls(for device: AVCaptureDevice) {
        
        // Exit early if the host device doesn't support capture controls.
        guard captureSession.supportsControls else { return }
    }
    
    func createControls(for device: AVCaptureDevice) -> [AVCaptureControl] {
```

### Step
Begin a session configuration, and commit it at the end of the method.

All changes between [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()) become one operation. The session never shows a state between the old list of controls and the new list.

```swift file=AVCam/CaptureService.swift highlight=6-9
    private func configureControls(for device: AVCaptureDevice) {
        
        // Exit early if the host device doesn't support capture controls.
        guard captureSession.supportsControls else { return }
        
        // Begin configuring the capture session.
        captureSession.beginConfiguration()
        // Commit the capture session configuration.
        captureSession.commitConfiguration()
    }
```

### Step
After the configuration begins, remove each control that is on the session.

The [`controls`](https://developer.apple.com/documentation/avfoundation/avcapturesession/controls) property is the list of controls that the session has now. The old controls change the old camera, so they must go before the controls of the new camera come. The first time, the list is empty and the loop does nothing. Call `removeControl(_:)` on the session for each control.

```swift file=AVCam/CaptureService.swift highlight=4-7
        // Begin configuring the capture session.
        captureSession.beginConfiguration()
        
        // Remove previously configured controls, if any.
        for control in captureSession.controls {
            captureSession.removeControl(control)
        }
        // Commit the capture session configuration.
        captureSession.commitConfiguration()
```

### Step
Create the controls for the device, and add each control that the session accepts.

[`addControl(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addcontrol(_:)) raises an exception when the session cannot accept the control, and Swift cannot catch it. Thus the code asks [`canAddControl(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddcontrol(_:)) first. The answer is `false`, for example, when the session already has its largest number of controls. Then the code writes a log line and continues: `logger.info("Unable to add control \(control).")`.

```swift file=AVCam/CaptureService.swift highlight=6-13
        // Remove previously configured controls, if any.
        for control in captureSession.controls {
            captureSession.removeControl(control)
        }
        
        // Create controls and add them to the capture session.
        for control in createControls(for: device) {
            if captureSession.canAddControl(control) {
                captureSession.addControl(control)
            } else {
                logger.info("Unable to add control \(control).")
            }
        }
        // Commit the capture session configuration.
        captureSession.commitConfiguration()
```

### Step
Set the controls delegate, with the session queue as the queue for its callbacks.

[`setControlsDelegate(_:queue:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/setcontrolsdelegate(_:queue:)) needs a serial queue. With the session queue, the callbacks arrive in the execution context of the actor, the same as the slider action. Without a delegate, the controls do not become active.

```swift file=AVCam/CaptureService.swift highlight=10-11
        // Create controls and add them to the capture session.
        for control in createControls(for: device) {
            if captureSession.canAddControl(control) {
                captureSession.addControl(control)
            } else {
                logger.info("Unable to add control \(control).")
            }
        }
        
        // Set the controls delegate.
        captureSession.setControlsDelegate(controlsDelegate, queue: sessionQueue)
        
        // Commit the capture session configuration.
        captureSession.commitConfiguration()
    }
```

### Step
In `setUpSession()`, call `configureControls(for:)` for the default camera after the code adds the photo output.

The session gets its controls during setup, before it starts to run.

```swift file=AVCam/CaptureService.swift highlight=5-6
            // Add the photo capture output as the default output type.
            photoCapture.output.isDeferredStartEnabled = photoCapture.output.isDeferredStartSupported
            try addOutput(photoCapture.output)
            
            // Configure controls to use with the Camera Control.
            configureControls(for: defaultCamera)
            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
            // Observe changes to the default camera's subject area.
            observeSubjectAreaChanges(of: defaultCamera)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
```

### Step
In `changeCaptureDevice(to:)`, call `configureControls(for:)` after the service connects the new camera.

The system sliders of the old camera cannot change the new camera. This call replaces them. The method already is between `beginConfiguration()` and `commitConfiguration()`, and `configureControls(for:)` has a pair of its own. The session permits a pair inside a pair.

```swift file=AVCam/CaptureService.swift highlight=15-16
    // Changes the device the service uses for video capture.
    private func changeCaptureDevice(to device: AVCaptureDevice) {
        // The service must have a valid video input prior to calling this method.
        guard let currentInput = activeVideoInput else { fatalError() }
        
        // Bracket the following configuration in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        
        // Remove the existing video input before attempting to connect a new one.
        captureSession.removeInput(currentInput)
        do {
            // Attempt to connect a new input and device to the capture session.
            activeVideoInput = try addInput(for: device)
            // Configure capture controls for new device selection.
            configureControls(for: device)
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
Build and run the app to make sure that the session still starts.

In the Simulator, `supportsControls` is `false`. `configureControls(for:)` returns at its first line, so you see no change. Use the button that changes the camera to make sure that the second call does no harm.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the button that changes the camera
Result: The app shows the live preview, and the camera changes as before.
```

## Send the overlay state to the model

The delegate knows when the overlay is in its fullscreen appearance. The views need this fact to reduce the interface. In this section, you send the value through the layers of the app: from the delegate to the capture service, and from the capture service to the model.

![The fullscreen state of the controls goes from the controls delegate through the capture service to the model, and four views read it to set their opacity.](../images/ch12-overlay-state.svg)

### Step
In `CaptureService.swift`, add the published `isShowingFullscreenControls` property below the `isHDRVideoEnabled` property.

The model cannot read the delegate, which is a private part of the actor. The actor publishes the value again, as it does for `captureActivity` and `isInterrupted`. Write `@Published var isShowingFullscreenControls = false` without `private(set)`, as the Apple sample does.

```swift file=AVCam/CaptureService.swift highlight=11-12
actor CaptureService {
    
    /// A value that indicates whether the capture service is idle or capturing a photo or movie.
    @Published private(set) var captureActivity: CaptureActivity = .idle
    /// A value that indicates the current capture capabilities of the service.
    @Published private(set) var captureCapabilities = CaptureCapabilities.unknown
    /// A Boolean value that indicates whether a higher priority event, like receiving a phone call, interrupts the app.
    @Published private(set) var isInterrupted = false
    /// A Boolean value that indicates whether the user enables HDR video capture.
    @Published var isHDRVideoEnabled = false
    /// A Boolean value that indicates whether capture controls are in a fullscreen appearance.
    @Published var isShowingFullscreenControls = false
    
    /// A type that connects a preview destination with the capture session.
    nonisolated let previewSource: PreviewSource
```

### Step
Below `observeOutputServices()`, add the `observeCaptureControlsState()` method, which assigns each value of the delegate to the property of the actor.

`assign(to:)` connects the publisher of the delegate to the published property of the actor. The subscription lives as long as the property, so there is no cancellable object to store. The method is `private`. Its body is `controlsDelegate.$isShowingFullscreenControls` and, on the next line, `.assign(to: &$isShowingFullscreenControls)`.

```swift file=AVCam/CaptureService.swift highlight=8-12
    /// Merge the `captureActivity` values of the photo and movie capture services,
    /// and assign the value to the actor's property.`
    private func observeOutputServices() {
        Publishers.Merge(photoCapture.$captureActivity, movieCapture.$captureActivity)
            .assign(to: &$captureActivity)
    }
    
    /// Observe when capture control enter and exit a fullscreen appearance.
    private func observeCaptureControlsState() {
        controlsDelegate.$isShowingFullscreenControls
            .assign(to: &$isShowingFullscreenControls)
    }
    
    /// Observe capture-related notifications.
```

### Step
In `setUpSession()`, call `observeCaptureControlsState()` together with the other observations.

```swift file=AVCam/CaptureService.swift highlight=8
    private func setUpSession() throws {
        // Return early if already set up.
        guard !isSetUp else { return }

        // Observe internal state and notifications.
        observeOutputServices()
        observeNotifications()
        observeCaptureControlsState()
        
        do {
```

### Step
In `Camera.swift`, add the `prefersMinimizedUI` property to the `Camera` protocol.

The views use the protocol, not the `CameraModel` class. The name describes what the views must do, not why. A view does not need to know that the reason is the Camera Control.

Write `var prefersMinimizedUI: Bool { get }`: the views only read it. After this step, the project does not compile until both models have the property, two steps later.

```swift file=AVCam/Model/Camera.swift highlight=7-8
    /// The capture mode, which can be photo or video.
    var captureMode: CaptureMode { get set }
    
    /// A Boolean value that indicates whether the camera is currently switching capture modes.
    var isSwitchingModes: Bool { get }
    
    /// A Boolean value that indicates whether the camera prefers showing a minimized set of UI controls.
    var prefersMinimizedUI: Bool { get }

    /// Switches between video devices available on the host system.
    func switchVideoDevices() async
```

### Step
In `PreviewCameraModel.swift`, add the `prefersMinimizedUI` property with the value `false`.

SwiftUI previews have no Camera Control, so the preview model always shows the full interface.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=5
@Observable
class PreviewCameraModel: Camera {
    
    var isLivePhotoEnabled = true
    var prefersMinimizedUI = false
    var qualityPrioritization = QualityPrioritization.quality
    var shouldFlashScreen = false
    var isHDRVideoSupported = false
    var isHDRVideoEnabled = false
```

### Step
In `CameraModel.swift`, add the `prefersMinimizedUI` property below the `isSwitchingVideoDevices` property.

The setter is private, because only the model changes this state.

```swift file=AVCam/CameraModel.swift highlight=4-5
    /// A Boolean value that indicates whether the app is currently switching video devices.
    private(set) var isSwitchingVideoDevices = false
    
    /// A Boolean value that indicates whether the camera prefers showing a minimized set of UI controls.
    private(set) var prefersMinimizedUI = false
    
    /// A Boolean value that indicates whether the app is currently switching capture modes.
    private(set) var isSwitchingModes = false
```

### Step
In `observeState()`, add a task that reads the `isShowingFullscreenControls` values of the capture service, above the task for the interruption state.

The `values` property turns the publisher into an asynchronous sequence, as for the other states of the capture service. The task runs on the main actor, because `CameraModel` is a main actor type. "HUD" in the comment of the sample means the system overlay.

Write `for await isShowingFullscreenControls in await captureService.$isShowingFullscreenControls.values` with an empty body. Xcode shows a warning that the value is not used until the next step.

```swift file=AVCam/CameraModel.swift highlight=8-12
        Task {
            // Await updates to the capabilities that the capture service advertises.
            for await capabilities in await captureService.$captureCapabilities.values {
                isHDRVideoSupported = capabilities.isHDRSupported
            }
        }
        
        Task {
            // Await updates to a person's interaction with the Camera Control HUD.
            for await isShowingFullscreenControls in await captureService.$isShowingFullscreenControls.values {
            }
        }
        
        Task {
            // Await updates to the interruption state of the capture service.
            for await isInterrupted in await captureService.$isInterrupted.values {
                // Show a status message while a higher-priority event interrupts the camera.
                status = isInterrupted ? .interrupted : .running
            }
        }
    }
```

### Step
In the loop, write each value to `prefersMinimizedUI` in an animation block.

`withAnimation` makes each view that depends on the property animate its change. Thus the controls fade, and do not jump.

```swift file=AVCam/CameraModel.swift highlight=4-7
        Task {
            // Await updates to a person's interaction with the Camera Control HUD.
            for await isShowingFullscreenControls in await captureService.$isShowingFullscreenControls.values {
                withAnimation {
                    // Prefer showing a minimized UI when capture controls enter a fullscreen appearance.
                    prefersMinimizedUI = isShowingFullscreenControls
                }
            }
        }
```

### Step
Build the project to make sure that the two models conform to the protocol.

No view reads the new property yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Reduce the interface

While the overlay uses the full screen, a person looks at the preview and at the value in the overlay. In this section, you make four views transparent for that time: the thumbnail button, the button that changes the camera, the capture mode picker, and the features toolbar. The capture button stays on the screen.

You use `opacity`, and you do not remove the views. A transparent view keeps its place in the layout, so the capture button does not move when the other views go away.

### Step
In `MainToolbar.swift`, add an import of the PhotosUI framework below the SwiftUI import.

The file compiles without this line. The Apple sample has the line, and you add it so that your file stays equal to the sample. The sample also puts four spaces on the empty line above `@State var camera`. `git diff chapter-12` can show this line; ignore it.

```swift file=AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift highlight=2
import SwiftUI
import PhotosUI

/// A view that displays controls to capture, switch cameras, and view the last captured media item.
struct MainToolbar<CameraModel: Camera>: PlatformView {
```

### Step
Set the opacity of the thumbnail button and of the button that changes the camera to zero when the model prefers a minimal interface.

Each `opacity` modifier comes before the `hidden(until:)` modifier from chapter 10. That modifier also sets an opacity, and the two values multiply. Thus a view is visible only when the session runs and the model does not ask for a minimal interface.

```swift file=AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift highlight=4-5,14-15
    var body: some View {
        HStack {
			ThumbnailButton(camera: camera)
                // Hide the thumbnail button when a person interacts with capture controls.
                .opacity(camera.prefersMinimizedUI ? 0 : 1)
                // Hide it until the capture session runs, using a custom modifier.
                .hidden(until: camera.status == .running)
            Spacer()
            // The capture button stays visible. A capture that arrives before deferred start
            // finishes is still honored, because the photo output enables responsive capture.
            CaptureButton(camera: camera)
            Spacer()
            SwitchCameraButton(camera: camera)
                // Hide the camera selection when a person interacts with capture controls.
                .opacity(camera.prefersMinimizedUI ? 0 : 1)
                // Hide it until the capture session runs, using a custom modifier.
                .hidden(until: camera.status == .running)
        }
```

### Step
In `CaptureModeView.swift`, replace the comment above `hidden(until:)` with the opacity modifier and two new comments.

The picker changes the capture mode, and a change of the mode configures the session again. That is not an operation for the moment when a person adjusts a setting with the Camera Control.

```swift file=AVCam/Views/Controls/CaptureModeView.swift remove
        // Hide the capture mode view until the capture session runs, using a custom modifier.
```

```swift file=AVCam/Views/Controls/CaptureModeView.swift highlight=4-6
            guard newIndex >= 0, newIndex < modes.count else { return }
            camera.captureMode = modes[newIndex]
        }
        // Hide the capture mode view when a person interacts with capture controls.
        .opacity(camera.prefersMinimizedUI ? 0 : 1)
        // Hide it until the capture session runs, using a custom modifier.
        .hidden(until: camera.status == .running)
    }
}
```

### Step
In `FeatureToolbar.swift`, set the opacity of the toolbar above the `hidden(until:)` modifier.

One modifier on the `HStack` hides all items of the toolbar: the Live Photo button, the quality picker, and the HDR button.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=16-17
    var body: some View {
        HStack(spacing: 30) {
            Spacer()
            switch camera.captureMode {
            case .photo:
                livePhotoButton
                prioritizePicker
            case .video:
                if camera.isHDRVideoSupported {
                    hdrButton
                }
            }
        }
        .buttonStyle(DefaultButtonStyle(size: isRegularSize ? .large : .small))
        .padding([.leading, .trailing])
        // Hide the toolbar items when a person interacts with capture controls.
        .opacity(camera.prefersMinimizedUI ? 0 : 1)
        // Hide them until the capture session runs, using a custom modifier.
        .hidden(until: camera.status == .running)
    }
```

### Step
Build and run the app to make sure that the interface is the same as before.

In the Simulator, the overlay never appears, so `prefersMinimizedUI` stays `false` and all controls stay visible after the session starts.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview and all its controls, as at the end of chapter 11.
```

### Experiment
You can see the fade in the Simulator with a temporary change. In `observeState()` in `CameraModel.swift`, change `prefersMinimizedUI = isShowingFullscreenControls` to `prefersMinimizedUI = !isShowingFullscreenControls`, and run the app. From the code, the expected result is that the thumbnail button, the button that changes the camera, the mode picker, and the features toolbar are not visible, and the capture button stays. Nobody ran this experiment for this tutorial. Remove the `!` after the experiment, so that your code stays equal to the branch `chapter-12`.

### Note
To test this chapter, run the app on an iPhone that has a Camera Control (iPhone 16 or later). Nobody did this test for this tutorial, so the next lines describe what the code and the Apple documentation tell you to expect. A light press on the Camera Control shows the system overlay with one of your controls. A light double press shows the list: zoom, exposure, and "Lens Position" for a camera that supports it. While the overlay uses the full screen, the four views fade out, and they come back when it ends. The Xcode console shows the debug lines of the delegate, for example "Capture controls will enter fullscreen appearance."

### Text
The Camera Control can now change settings in your app. In the next chapter, it can also start your app: you add a capture extension for the Lock Screen and a control for Control Center.

## Check your understanding

### Why does the action of the lens position slider run on the session queue?

- [ ] The system can call the action of a custom control only on a queue that the app created.
  > The system calls the action on each queue that you give it. The question is which queue is safe for the code in the action.
- [x] The action configures the camera, and the session queue is the place where all other camera code of the actor runs.
  > Correct. The session queue is the executor of the `CaptureService` actor. When the action runs on this queue, it can never run at the same time as a method of the actor that also configures the camera.
- [ ] The session queue is the main queue, and the slider is part of the interface.
  > The session queue is not the main queue. The system draws the slider. Your action only changes the camera device.

### A person changes from the back camera to the front camera, and then to the back camera again. What does `createControls(for:)` return for the back camera the second time?

- [x] The same control objects as the first time, from `controlsMap`.
  > Correct. The dictionary has an entry for the identifier of the back camera. The method makes no new objects, and the lens slider keeps its value.
- [ ] New control objects, because `configureControls(for:)` removed the old objects from the session.
  > `removeControl(_:)` takes the objects off the session. It does not delete the entry in the dictionary, so the objects stay alive.
- [ ] The control objects of the front camera, because they were the last objects on the session.
  > The key of the dictionary is the identifier of the device. A system control is bound to one camera and cannot change a different camera.

### You delete the line that calls `setControlsDelegate(_:queue:)`. The app runs on an iPhone that has a Camera Control. What do you expect?

- [ ] The overlay appears, but the app does not fade its controls.
  > This is not the only effect. The Apple SDK says that the session needs a controls delegate before its controls become active.
- [ ] The app stops with an exception when the session adds the first control.
  > `addControl(_:)` raises an exception only when `canAddControl(_:)` is `false`. A session without a delegate still accepts controls.
- [x] The controls do not become active, so a person cannot use them.
  > Correct. The Apple SDK says that a controls delegate must be set for the controls to become active. The delegate is necessary also when your app does not use its callbacks.
