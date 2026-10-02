---
kind: tutorial
chapter: 14
title: Build: zoom and lenses
abstract: Use the virtual back cameras, create zoom levels from the switch-over zoom factors, change the zoom with a ramp and with a pinch, and build a zoom control that always shows the value of the device.
estimatedMinutes: 45
startBranch: chapter-13
branch: chapter-14
uncovered: AVCam.xcodeproj/project.pbxproj
---

In this tutorial, you give the app a zoom. At the end, the back camera uses all its lenses, a zoom control shows levels such as 0.5, 1, and 3, a tap on a level moves the zoom smoothly, and a pinch on the preview changes the zoom continuously.

This is the first chapter of part 2, "Beyond the sample". The code of this chapter is not in the Apple sample. The design is this tutorial's own. You create one new file and add approximately 250 lines to eight files that you know. Read [Concepts: zoom and lenses](ch14-concepts.md) first. It explains the camera facts behind each step, and the limits of this design.

> [!IMPORTANT]
> The simulated camera cannot zoom. In the Simulator, the zoom control does not appear and the picture does not change, so most checkpoints show that the app builds and runs as before. You can see the zoom control in the Xcode canvas. Real zoom needs a real iPhone, and nobody ran this chapter on one. Where a step tells you what occurs on an iPhone, the text comes from the Apple SDK and from the code, not from a test.

## Select the cameras and describe a zoom level

The back camera of the sample is the dual camera or the wide camera. It never uses the ultra-wide lens, so the app can never show the 0.5x picture. In this section, you change the list of device types, so that the app gets the virtual device with the most lenses.

Then you write a small type that describes one zoom level. A zoom level has two numbers: the value that the device needs, and the value that a person reads.

### Step
In `DeviceLookup.swift`, replace the first line of the back discovery session with a comment and a list of four device types.

A [discovery session](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession) sorts its [`devices`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/devices) in the order of your type list, and the app uses the first device. The [triple camera](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintriplecamera) and the [dual wide camera](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualwidecamera) contain the ultra-wide camera, so they come first. An iPhone that has neither of them gets the dual camera or the wide camera, as before.

```swift file=AVCam/Capture/DeviceLookup.swift remove
        backCameraDiscoverySession = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInDualCamera, .builtInWideAngleCamera],
```

```swift file=AVCam/Capture/DeviceLookup.swift highlight=2-4
    init() {
        // List the virtual devices first. The first device in the result has the most lenses.
        backCameraDiscoverySession = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInTripleCamera, .builtInDualWideCamera,
                                                                                    .builtInDualCamera, .builtInWideAngleCamera],
                                                                      mediaType: .video,
                                                                      position: .back)
        frontCameraDiscoverySession = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInTrueDepthCamera, .builtInWideAngleCamera],
```

### Step
In `DataTypes.swift`, add the `ZoomLevel` structure with its two values below the `CaptureCapabilities` structure.

`videoZoomFactor` is the value for the capture device. `displayFactor` is the value for the interface. On a camera that starts with the ultra-wide lens, the two values are different: the device value 1.0 is the display value 0.5. The structure is `Identifiable`, so that a SwiftUI `ForEach` can use it, and `Hashable`, so that a view can compare two levels.

```swift file=AVCam/Model/DataTypes.swift highlight=4-9,11-12
    static let unknown = CaptureCapabilities()
}

/// A zoom level that the camera interface offers, such as 0.5x, 1x, or 2x.
struct ZoomLevel: Identifiable, Hashable {
    /// The value to set on the capture device.
    let videoZoomFactor: CGFloat
    /// The value to show to a person.
    let displayFactor: CGFloat
    
    var id: CGFloat { videoZoomFactor }
}

enum QualityPrioritization: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable {
```

### Step
Add the static `label(for:)` method, which makes a short text from a display value.

The format permits zero digits or one digit after the decimal separator: 0.5 becomes "0.5", 2.0 becomes "2", and 1.26 becomes "1.3". The separator follows the locale of the person. The method is static, because the zoom control also needs a text for a value between two levels.

```swift file=AVCam/Model/DataTypes.swift highlight=10-13
/// A zoom level that the camera interface offers, such as 0.5x, 1x, or 2x.
struct ZoomLevel: Identifiable, Hashable {
    /// The value to set on the capture device.
    let videoZoomFactor: CGFloat
    /// The value to show to a person.
    let displayFactor: CGFloat
    
    var id: CGFloat { videoZoomFactor }
    
    /// Returns a short text for a display zoom factor.
    static func label(for displayFactor: CGFloat) -> String {
        Double(displayFactor).formatted(.number.precision(.fractionLength(0...1)))
    }
}
```

### Step
Above the static method, add the `label` property, which returns the text for the display value of the level.

A button of the zoom control shows this text. The property and the static method use the same format, so a level and a value between two levels look the same.

```swift file=AVCam/Model/DataTypes.swift highlight=3-6
    var id: CGFloat { videoZoomFactor }
    
    /// A short text for the value, such as "0.5" or "2".
    var label: String {
        ZoomLevel.label(for: displayFactor)
    }
    
    /// Returns a short text for a display zoom factor.
    static func label(for displayFactor: CGFloat) -> String {
```

### Step
Build and run the app to make sure that the camera still starts.

The simulated back camera is one camera with one lens, so the new type list changes nothing in the Simulator. No code uses `ZoomLevel` yet.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview and all its controls, as at the end of chapter 13.
```

## Create the zoom levels

The capture service owns the camera, so it also owns the zoom. In this section, you write the method that reads the zoom levels from a device and publishes them. The method runs for each camera that the app selects.

The levels come from two properties of the device: its smallest zoom factor, and the zoom factors at which a virtual device changes to its next camera. The code has no table of iPhone models.

![One zoom axis of a triple camera, with the device values above the axis and the display values below it. The values are an example.](../images/ch14-zoom-axis.svg)

### Step
In `CaptureService.swift`, add the published `zoomLevels` and `displayZoomFactor` properties below the `isHDRVideoEnabled` property.

The model cannot read the capture device, which is a private part of the actor. The actor publishes the two values, as it does for `captureActivity` and `isInterrupted`. The setters are private, because only the actor knows the state of the device.

```swift file=AVCam/CaptureService.swift highlight=3-6
    /// A Boolean value that indicates whether the user enables HDR video capture.
    @Published var isHDRVideoEnabled = false
    /// The zoom levels that the selected camera offers.
    @Published private(set) var zoomLevels = [ZoomLevel]()
    /// The zoom factor of the selected camera, as the value to show to a person.
    @Published private(set) var displayZoomFactor: CGFloat = 1.0
    /// A Boolean value that indicates whether capture controls are in a fullscreen appearance.
    @Published var isShowingFullscreenControls = false
```

### Step
Below `createControls(for:)`, add a mark and the `displayMultiplier(for:)` method.

[`displayVideoZoomFactorMultiplier`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier) is the ratio between the device value and the number that the system shows. The simulated camera reports 0. A multiplier of 0 makes each display value 0, and a division by it has no useful result. Thus the method returns 1 for each value that is not positive.

```swift file=AVCam/CaptureService.swift highlight=5,7-12
        // Return the previously created controls.
        return controls
    }
    
    // MARK: - Zoom
    
    /// Returns the ratio between the zoom factor of the device and the value to show to a person.
    private func displayMultiplier(for device: AVCaptureDevice) -> CGFloat {
        // Some devices, such as a simulated camera, report no multiplier. Use 1 for them.
        let multiplier = device.displayVideoZoomFactorMultiplier
        return multiplier > 0 ? multiplier : 1.0
    }
    
    // MARK: - Capture mode selection
```

### Step
Above `displayMultiplier(for:)`, add the `configureZoom(for:)` method, which collects the zoom factors of the levels.

The first level is [`minAvailableVideoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/minavailablevideozoomfactor), the widest picture of the device. The `max` call protects against the simulated camera, which reports 0: a zoom factor less than 1 is not legal. The other levels are the [`virtualDeviceSwitchOverVideoZoomFactors`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/virtualdeviceswitchovervideozoomfactors). At each of these values, the next camera of a virtual device can supply its full picture. For a camera with one lens, the array is empty.

```swift file=AVCam/CaptureService.swift highlight=3-6,8-12
    // MARK: - Zoom
    
    /// Creates the zoom levels for the specified device, and starts the device at the 1x level.
    private func configureZoom(for device: AVCaptureDevice) {
        // The ratio between the zoom factor of the device and the value that the system shows to a person.
        let multiplier = displayMultiplier(for: device)
        
        // The first level is the widest field of view of the device. A zoom factor is never less than 1.
        var factors = [max(device.minAvailableVideoZoomFactor, 1.0)]
        // A virtual device changes to its next camera at each switch-over zoom factor.
        factors += device.virtualDeviceSwitchOverVideoZoomFactors.map { CGFloat(truncating: $0) }
    }
    
    /// Returns the ratio between the zoom factor of the device and the value to show to a person.
    private func displayMultiplier(for device: AVCaptureDevice) -> CGFloat {
```

### Step
Add a second level for a camera that has only one, and publish the levels with their display values.

A front camera, for example, has one lens and thus one level. A control with one button has no use, so the code adds a level at two times the first zoom factor. This level is a crop of the sensor picture. The test of [`maxAvailableVideoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/maxavailablevideozoomfactor) keeps a camera that cannot zoom at one level. The last line makes one `ZoomLevel` for each zoom factor: the display value is the device value multiplied by the multiplier.

```swift file=AVCam/CaptureService.swift highlight=3-7
        // A virtual device changes to its next camera at each switch-over zoom factor.
        factors += device.virtualDeviceSwitchOverVideoZoomFactors.map { CGFloat(truncating: $0) }
        // A device with one level gets a 2x level, if it can zoom that far.
        if factors.count == 1, device.maxAvailableVideoZoomFactor >= factors[0] * 2 {
            factors.append(factors[0] * 2)
        }
        zoomLevels = factors.map { ZoomLevel(videoZoomFactor: $0, displayFactor: $0 * multiplier) }
    }
```

### Step
In `setUpSession()`, call `configureZoom(for:)` for the default camera, after the call that configures the controls.

The levels are ready before the session starts to run, so the interface has them when it becomes visible.

```swift file=AVCam/CaptureService.swift highlight=3-4
            // Configure controls to use with the Camera Control.
            configureControls(for: defaultCamera)
            // Configure the zoom levels for the default camera.
            configureZoom(for: defaultCamera)
            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
```

### Step
In `changeCaptureDevice(to:)`, call `configureZoom(for:)` after the service connects the new camera.

The levels and the multiplier belong to one device. The front camera has other lenses than the back camera, so the old levels are wrong after a change of the camera.

```swift file=AVCam/CaptureService.swift highlight=6-7
        do {
            // Attempt to connect a new input and device to the capture session.
            activeVideoInput = try addInput(for: device)
            // Configure capture controls for new device selection.
            configureControls(for: device)
            // Configure the zoom levels for the new device.
            configureZoom(for: device)
            // Configure a new rotation coordinator for the new device.
            createRotationCoordinator(for: device)
```

### Step
At the end of `setCaptureMode(_:)`, call `configureZoom(for:)` for the current device.

A change of the capture mode sets a new session preset, and the session can then select a different format for the device. The largest zoom factor depends on the format. One effect is a limit of this design: after each change of the mode, the zoom starts again at the 1x level.

```swift file=AVCam/CaptureService.swift highlight=3-4
        // Update the advertised capabilities after reconfiguration.
        updateCaptureCapabilities()
        // A new session preset can select a new device format. Create the zoom levels again.
        configureZoom(for: currentDevice)
    }
    
    // MARK: - Device selection
```

### Step
Build and run the app to make sure that the new method does no harm.

The simulated camera gets one level: its largest zoom factor is 0, so the code adds no second level. Nothing reads the levels yet, and the zoom does not change.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the button that changes the camera
Result: The app shows the live preview, and the camera changes as before.
```

## Change the zoom

There are two methods to change the zoom factor of a device. A direct assignment makes the picture jump. A ramp moves the picture smoothly. In this section, you write one private method that does the two, and that makes each value safe before the device gets it.

Safety is the important part. A zoom factor outside of the range of the device raises an Objective-C exception. Swift cannot catch that exception, and the app stops.

### Step
In `CaptureService.swift`, add the `zoomObserver` and `maxDisplayZoomFactor` properties below the rotation properties.

The device can permit a very large zoom factor, and the picture at that value has little detail. The app stops at the display value 10. This number is a decision of this tutorial. The observation is for the next section.

```swift file=AVCam/CaptureService.swift highlight=5-6,8-9
    // An object that monitors video device rotations.
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator!
    private var rotationObservers = [AnyObject]()
    
    // An observation of the zoom factor of the selected camera.
    private var zoomObserver: NSKeyValueObservation?
    
    // The largest zoom factor that the app offers, as a display value.
    private let maxDisplayZoomFactor: CGFloat = 10.0
    
    // A Boolean value that indicates whether the actor finished its required configuration.
    private var isSetUp = false
```

### Step
Below `displayMultiplier(for:)`, add the `setVideoZoomFactor(_:on:animated:)` method, which returns for a camera that cannot zoom and limits the value to the range of the device.

The `guard` statement is the result of a crash. The simulated camera reports a largest zoom factor of 0, and each assignment to its zoom factor raises an exception. The first version of this chapter stopped at launch in the Simulator.

The three constants keep the value in the range. The lower limit is the smallest zoom factor of the device, but not less than 1. The upper limit is the smaller of two values: the largest zoom factor of the device, and the display value 10 as a device value. The outer `max` call makes sure that the upper limit is never less than the lower limit.

```swift file=AVCam/CaptureService.swift highlight=8-15
    /// Returns the ratio between the zoom factor of the device and the value to show to a person.
    private func displayMultiplier(for device: AVCaptureDevice) -> CGFloat {
        // Some devices, such as a simulated camera, report no multiplier. Use 1 for them.
        let multiplier = device.displayVideoZoomFactorMultiplier
        return multiplier > 0 ? multiplier : 1.0
    }
    
    private func setVideoZoomFactor(_ factor: CGFloat, on device: AVCaptureDevice, animated: Bool) {
        // A device that cannot zoom, such as a simulated camera, reports a largest zoom factor of less than 1.
        guard device.maxAvailableVideoZoomFactor >= 1.0 else { return }
        // Keep the value in the range that the device supports. A value outside of the range raises an exception.
        let smallestFactor = max(device.minAvailableVideoZoomFactor, 1.0)
        let largestFactor = max(min(device.maxAvailableVideoZoomFactor, maxDisplayZoomFactor / displayMultiplier(for: device)), smallestFactor)
        let factor = min(max(factor, smallestFactor), largestFactor)
    }
    
    // MARK: - Capture mode selection
```

### Step
Lock the device for configuration, and unlock it again.

This is the pattern from chapter 6: each change of a device needs [`lockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()) before it. The lock can fail with a Swift error, so the `do`-`catch` statement has a use here. It does not catch the range exception.

```swift file=AVCam/CaptureService.swift highlight=2-7
        let factor = min(max(factor, smallestFactor), largestFactor)
        do {
            try device.lockForConfiguration()
            device.unlockForConfiguration()
        } catch {
            logger.debug("Unable to change the zoom factor: \(error)")
        }
    }
```

### Step
Between the lock and the unlock, start a ramp when the change is animated, and assign the value when it is not.

[`ramp(toVideoZoomFactor:withRate:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/ramp(tovideozoomfactor:withrate:)) moves the zoom smoothly to the new value. The rate is the number of times that the zoom factor doubles in one second. With a rate of 8, a change from 1x to 2x takes approximately one eighth of a second. An assignment to [`videoZoomFactor`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor) makes the picture jump, and it stops a ramp that is in progress.

```swift file=AVCam/CaptureService.swift highlight=3-8
        do {
            try device.lockForConfiguration()
            if animated {
                // Move to the new value at a constant rate. The rate doubles the zoom factor this many times each second.
                device.ramp(toVideoZoomFactor: factor, withRate: 8.0)
            } else {
                device.videoZoomFactor = factor
            }
            device.unlockForConfiguration()
        } catch {
```

### Step
Above `setVideoZoomFactor(_:on:animated:)`, add the two `setZoom` methods that the model calls.

`setZoom(to:)` is for a tap on a zoom level. A level already has its device value, and the change is a ramp. `setZoom(displayFactor:)` is for the pinch gesture. The interface knows only display values, so the method divides by the multiplier. A pinch sends many small changes each second, and each change is a direct assignment.

```swift file=AVCam/CaptureService.swift highlight=4-7,9-15
        return multiplier > 0 ? multiplier : 1.0
    }
    
    /// Changes the zoom to the specified level with a smooth transition.
    func setZoom(to level: ZoomLevel) {
        setVideoZoomFactor(level.videoZoomFactor, on: currentDevice, animated: true)
    }
    
    /// Changes the zoom to the specified display value immediately.
    ///
    /// The app calls this method many times during a pinch gesture.
    func setZoom(displayFactor: CGFloat) {
        let device = currentDevice
        setVideoZoomFactor(displayFactor / displayMultiplier(for: device), on: device, animated: false)
    }
    
    private func setVideoZoomFactor(_ factor: CGFloat, on device: AVCaptureDevice, animated: Bool) {
```

### Step
At the end of `configureZoom(for:)`, set the zoom to the level that a person sees as 1x.

On a virtual device that starts with the ultra-wide camera, the smallest zoom factor shows the 0.5x picture. People expect 1x when a camera app starts. The display value 1 is the device value `1.0 / multiplier`. The change has no animation, because a person must not see a zoom movement when the camera appears.

```swift file=AVCam/CaptureService.swift highlight=3-5
        zoomLevels = factors.map { ZoomLevel(videoZoomFactor: $0, displayFactor: $0 * multiplier) }
        
        // Start at the level that a person sees as 1x. On a virtual device with an
        // ultra-wide camera, the smallest zoom factor shows the 0.5x field of view.
        setVideoZoomFactor(1.0 / multiplier, on: device, animated: false)
    }
```

### Step
Build and run the app to make sure that it starts without a crash.

`configureZoom(for:)` now calls `setVideoZoomFactor(_:on:animated:)` at launch. In the Simulator, the `guard` statement returns before the code touches the device.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app starts and shows the live preview, as before.
```

### Note
Without the `guard` statement, the limits for the simulated camera are 1 and 1, and the method assigns the zoom factor 1. The simulated camera refuses each zoom factor, so the app stops at launch with an `NSRangeException`. That was the crash of the first version of this chapter. Keep this in mind for your own apps: read the range of a device before you set a value on it.

## Publish the zoom to the model

Your code is not the only thing that changes the zoom factor. The system zoom slider of the Camera Control, which you added in chapter 12, sets the property itself. A ramp changes the value for some time after your call. So the interface must not show the value that the app sent. It must show the value that the device has.

In this section, the capture service observes the zoom factor of the device and publishes each change as a display value. Then the model gets the zoom levels, the zoom factor, and the two zoom methods.

![A zoom command goes from the views through the model and the capture service to the capture device. The new zoom factor comes back from the device through an observation. The Camera Control slider changes the device directly.](../images/ch14-zoom-state.svg)

### Step
In `CaptureService.swift`, add the `updateDisplayZoomFactor(for:of:)` method below the `configureZoom(for:)` method.

The method changes a device value to a display value and publishes it. It takes the device as a parameter, because the multiplier must come from the device that sent the value.

```swift file=AVCam/CaptureService.swift highlight=4-6
        setVideoZoomFactor(1.0 / multiplier, on: device, animated: false)
    }
    
    private func updateDisplayZoomFactor(for zoomFactor: CGFloat, of device: AVCaptureDevice) {
        displayZoomFactor = zoomFactor * displayMultiplier(for: device)
    }
    
    /// Returns the ratio between the zoom factor of the device and the value to show to a person.
```

### Step
At the end of `configureZoom(for:)`, observe the `videoZoomFactor` property of the device, and send each value to the new method.

The `observe` method returns an [`NSKeyValueObservation`](https://developer.apple.com/documentation/foundation/nskeyvalueobservation). The observation lives as long as this object. When the camera changes, the assignment replaces the object, and the observation of the old camera ends. The `.initial` option sends the current value immediately, so the model gets the start value. The closure does not run on the actor. Thus it reads the value first, and then starts a task that calls the actor.

```swift file=AVCam/CaptureService.swift highlight=3-7
        setVideoZoomFactor(1.0 / multiplier, on: device, animated: false)
        
        // Observe the zoom factor, because the Camera Control and a zoom ramp also change it.
        zoomObserver = device.observe(\.videoZoomFactor, options: [.initial, .new]) { [weak self] device, _ in
            let zoomFactor = device.videoZoomFactor
            Task { await self?.updateDisplayZoomFactor(for: zoomFactor, of: device) }
        }
    }
```

### Step
In `Camera.swift`, add two properties and two methods for the zoom to the `Camera` protocol.

The views use the protocol, not the `CameraModel` class. The protocol has no device value: a view shows display values and sends a level or a display value back.

```swift file=AVCam/Model/Camera.swift highlight=4-5,7-8,10-11,13-14
    /// A Boolean value that indicates whether the camera is currently switching video devices.
    var isSwitchingVideoDevices: Bool { get }
    
    /// The zoom levels that the selected camera offers.
    var zoomLevels: [ZoomLevel] { get }
    
    /// The zoom factor of the selected camera, as the value to show to a person.
    var displayZoomFactor: CGFloat { get }
    
    /// Changes the zoom to the specified level with a smooth transition.
    func setZoom(to level: ZoomLevel) async
    
    /// Changes the zoom to the specified display value immediately.
    func setZoom(displayFactor: CGFloat) async
    
    /// Performs a one-time automatic focus and exposure operation.
    func focusAndExpose(at point: CGPoint) async
```

### Step
In `CameraModel.swift`, add the `zoomLevels` and `displayZoomFactor` properties below the `isSwitchingModes` property.

The setters are private. Only the observation tasks of the model change these values.

```swift file=AVCam/CameraModel.swift highlight=4-5,7-8
    /// A Boolean value that indicates whether the app is currently switching capture modes.
    private(set) var isSwitchingModes = false
    
    /// The zoom levels that the selected camera offers.
    private(set) var zoomLevels = [ZoomLevel]()
    
    /// The zoom factor of the selected camera, as the value to show to a person.
    private(set) var displayZoomFactor: CGFloat = 1.0
    
    /// A Boolean value that indicates whether to show visual feedback when capture begins.
    private(set) var shouldFlashScreen = false
```

### Step
Below `switchVideoDevices()`, add a mark and the two `setZoom` methods, which call the capture service.

The methods do not change `displayZoomFactor`. The model waits for the value that the device reports. Thus the interface cannot show a value that the device did not accept.

```swift file=AVCam/CameraModel.swift highlight=8,10-13,15-18
    /// Selects the next available video device for capture.
    func switchVideoDevices() async {
        isSwitchingVideoDevices = true
        defer { isSwitchingVideoDevices = false }
        await captureService.selectNextVideoDevice()
    }
    
    // MARK: - Zoom
    
    /// Changes the zoom to the specified level with a smooth transition.
    func setZoom(to level: ZoomLevel) async {
        await captureService.setZoom(to: level)
    }
    
    /// Changes the zoom to the specified display value immediately.
    func setZoom(displayFactor: CGFloat) async {
        await captureService.setZoom(displayFactor: displayFactor)
    }
    
    // MARK: - Photo capture
```

### Step
In `observeState()`, add two tasks that read the zoom levels and the zoom factor of the capture service, above the task for the interruption state.

This is the pattern of the other states: the `values` property turns a publisher into an asynchronous sequence, and the task writes each value to a property of the model on the main actor. New levels arrive after each change of the camera or of the mode. A new zoom factor arrives each time the device changes its value.

```swift file=AVCam/CameraModel.swift highlight=11-16,18-23
        Task {
            // Await updates to a person's interaction with the Camera Control HUD.
            for await isShowingFullscreenControls in await captureService.$isShowingFullscreenControls.values {
                withAnimation {
                    // Prefer showing a minimized UI when capture controls enter a fullscreen appearance.
                    prefersMinimizedUI = isShowingFullscreenControls
                }
            }
        }
        
        Task {
            // Await new zoom levels from the capture service, for example after a camera switch.
            for await zoomLevels in await captureService.$zoomLevels.values {
                self.zoomLevels = zoomLevels
            }
        }
        
        Task {
            // Await updates to the zoom factor of the selected camera.
            for await displayZoomFactor in await captureService.$displayZoomFactor.values {
                self.displayZoomFactor = displayZoomFactor
            }
        }
        
        Task {
            // Await updates to the interruption state of the capture service.
```

### Step
In `PreviewCameraModel.swift`, add three example zoom levels and the `displayZoomFactor` property.

A preview in the Xcode canvas has no camera. The example values are those of a triple camera with the levels 0.5, 1, and 3, so that the canvas can show a zoom control with three buttons.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=11-15
@Observable
class PreviewCameraModel: Camera {
    
    var isLivePhotoEnabled = true
    var prefersMinimizedUI = false
    var qualityPrioritization = QualityPrioritization.quality
    var shouldFlashScreen = false
    var isHDRVideoSupported = false
    var isHDRVideoEnabled = false
    
    // Example zoom levels, so that SwiftUI previews show the zoom control.
    let zoomLevels = [ZoomLevel(videoZoomFactor: 1.0, displayFactor: 0.5),
                      ZoomLevel(videoZoomFactor: 2.0, displayFactor: 1.0),
                      ZoomLevel(videoZoomFactor: 6.0, displayFactor: 3.0)]
    private(set) var displayZoomFactor: CGFloat = 1.0
    
    struct PreviewSourceStub: PreviewSource {
```

### Step
At the end of the class, add the two `setZoom` methods, which set the property directly.

The preview model has no device that reports a value. It writes the new value itself, so that a tap in the canvas changes the selected level.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=5-7,9-11
    func syncState() async {
        logger.debug("Syncing state isn't implemented in PreviewCamera.")
    }
    
    func setZoom(to level: ZoomLevel) {
        displayZoomFactor = level.displayFactor
    }
    
    func setZoom(displayFactor: CGFloat) {
        displayZoomFactor = displayFactor
    }
}
```

### Step
Build the project to make sure that the two models conform to the protocol.

No view reads the new properties yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Build the zoom control

The zoom control is a row of round buttons, one for each zoom level. The selected button is larger and yellow, and it shows the zoom factor of the device at this moment. That value can be between two levels, for example after a pinch.

The new file needs one change in the Xcode interface. The capture extension from chapter 13 compiles `CameraUI.swift`, and that file uses the new view. So the new file must also belong to the extension target. Xcode writes this to the project file, `AVCam.xcodeproj/project.pbxproj`. You do not edit this file by hand, so no step shows it.

### Step
In the `Controls` group, create the Swift file `ZoomControl.swift`, and replace its contents with a view that has one button for each zoom level.

The view is generic over the `Camera` protocol, as the other controls are. The action of a button starts a task, because `setZoom(to:)` is an asynchronous method. The label of a button comes from a method that you write in the next steps.

```swift file=AVCam/Views/Controls/ZoomControl.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that shows the zoom levels of the camera and changes the zoom.
*/

import SwiftUI

/// A view that shows the zoom levels of the camera and changes the zoom.
struct ZoomControl<CameraModel: Camera>: View {
    
    @State var camera: CameraModel
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(camera.zoomLevels) { level in
                Button {
                    Task {
                        await camera.setZoom(to: level)
                    }
                } label: {
                    label(for: level)
                }
            }
        }
    }
}
```

### Note
The project does not compile at this time, because the `label(for:)` method does not exist. You add it after the next step.

### Step
Below the `body` property, add the `selectedLevel` property, which finds the level of the current zoom factor.

The selected level is the last level whose display value is not more than the current zoom factor. At 2.4x, with the levels 0.5, 1, and 3, the selected level is 1. The zoom factor is a floating-point number, and a calculation can make it a little smaller than the value of a level. The tolerance of 0.01 prevents that the control then selects the level before.

```swift file=AVCam/Views/Controls/ZoomControl.swift highlight=19-23
struct ZoomControl<CameraModel: Camera>: View {
    
    @State var camera: CameraModel
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(camera.zoomLevels) { level in
                Button {
                    Task {
                        await camera.setZoom(to: level)
                    }
                } label: {
                    label(for: level)
                }
            }
        }
    }
    
    /// The level that contains the current zoom factor.
    private var selectedLevel: ZoomLevel? {
        // A small tolerance prevents a wrong selection because of rounding.
        camera.zoomLevels.last { $0.displayFactor <= camera.displayZoomFactor + 0.01 } ?? camera.zoomLevels.first
    }
}
```

### Step
Below `selectedLevel`, add the `label(for:)` method, which makes the text of one button.

The selected button shows the current zoom factor and a multiplication sign, for example "2.4×". Each other button shows the value of its level. So one row of buttons shows the levels and the exact zoom at the same time.

```swift file=AVCam/Views/Controls/ZoomControl.swift highlight=7-12
    /// The level that contains the current zoom factor.
    private var selectedLevel: ZoomLevel? {
        // A small tolerance prevents a wrong selection because of rounding.
        camera.zoomLevels.last { $0.displayFactor <= camera.displayZoomFactor + 0.01 } ?? camera.zoomLevels.first
    }
    
    @ViewBuilder
    private func label(for level: ZoomLevel) -> some View {
        let isSelected = level == selectedLevel
        // The selected level shows the current zoom factor, which can be between two levels.
        Text(isSelected ? "\(ZoomLevel.label(for: camera.displayZoomFactor))×" : level.label)
    }
}
```

### Step
Give the text its font, its color, and a round background.

The selected button is larger and yellow, so a person finds it immediately. `monospacedDigit()` gives all digits the same width. Without it, the text moves a little to the left and to the right while the number changes during a ramp or a pinch.

```swift file=AVCam/Views/Controls/ZoomControl.swift highlight=2-6
        Text(isSelected ? "\(ZoomLevel.label(for: camera.displayZoomFactor))×" : level.label)
            .font(.system(size: isSelected ? 13 : 11, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(isSelected ? .yellow : .white)
            .frame(width: isSelected ? 40 : 30, height: isSelected ? 40 : 30)
            .background(.black.opacity(0.5), in: Circle())
    }
}
```

### Step
In the `body` property, give the row of buttons a padding, a background in the shape of a capsule, and an animation.

The dark background keeps the buttons readable above a bright preview. The animation runs only when `selectedLevel` changes. So the buttons change their size smoothly, but a change of the number in the selected button has no animation.

```swift file=AVCam/Views/Controls/ZoomControl.swift highlight=12-14
        HStack(spacing: 8) {
            ForEach(camera.zoomLevels) { level in
                Button {
                    Task {
                        await camera.setZoom(to: level)
                    }
                } label: {
                    label(for: level)
                }
            }
        }
        .padding(4)
        .background(.black.opacity(0.25), in: Capsule())
        .animation(.easeInOut(duration: 0.2), value: selectedLevel)
    }
```

### Step
Below the animation, add three modifiers that hide the control when it has no use.

Each modifier has its own reason. A camera with one level cannot zoom, so it gets no control. During the fullscreen appearance of the Camera Control overlay, the system can show its own zoom slider, and an app must not show the same control two times. And as each other control since chapter 10, the zoom control stays hidden until the session runs. The view stays in the layout in all three cases, so no other view moves.

```swift file=AVCam/Views/Controls/ZoomControl.swift highlight=4-9
        .padding(4)
        .background(.black.opacity(0.25), in: Capsule())
        .animation(.easeInOut(duration: 0.2), value: selectedLevel)
        // A camera with one zoom level needs no control.
        .opacity(camera.zoomLevels.count > 1 ? 1 : 0)
        // Hide the zoom control when a person interacts with capture controls.
        .opacity(camera.prefersMinimizedUI ? 0 : 1)
        // Hide it until the capture session runs, using a custom modifier.
        .hidden(until: camera.status == .running)
    }
```

### Step
At the end of the file, add a preview that uses the preview model in the running state.

The status must be `.running`. With the default status of the preview model, the `hidden(until:)` modifier keeps the control hidden, and the canvas shows only the gray background.

```swift file=AVCam/Views/Controls/ZoomControl.swift highlight=6-10
            .frame(width: isSelected ? 40 : 30, height: isSelected ? 40 : 30)
            .background(.black.opacity(0.5), in: Circle())
    }
}

#Preview {
    ZoomControl(camera: PreviewCameraModel(status: .running))
        .padding()
        .background(.gray)
}
```

### Step
In the project navigator, select `ZoomControl.swift`. In the File inspector, add the file to the capture extension target.

A new file in the `AVCam` group belongs only to the app target. The capture extension compiles `CameraUI.swift`, and in the next step that file uses `ZoomControl`. Without this membership, the build of the extension fails with the message that `ZoomControl` is not in scope.

> [!TIP]
> Open the File inspector with View › Inspectors › File. If your result is different, you can take the project file from the branch: `git checkout chapter-14 -- AVCam.xcodeproj/project.pbxproj`.

```settings title="File inspector › Target Membership"
Views/Controls/ZoomControl.swift: AVCam, AVCamCaptureExtension
```

### Step
In `CameraUI.swift`, add the zoom control to the compact layout and to the regular layout, above the capture mode picker.

In the compact layout, the control is between the spacer and the mode picker, with a distance of 12 points to the picker. In the regular layout, it is above the toolbar. This is the position where people expect the zoom levels: near the capture button, and reachable with the thumb.

```swift file=AVCam/Views/CameraUI.swift highlight=7-8,20
    /// This view arranges UI elements vertically.
    @ViewBuilder
    var compactUI: some View {
        VStack(spacing: 0) {
            FeaturesToolbar(camera: camera)
            Spacer()
            ZoomControl(camera: camera)
                .padding(.bottom, 12)
            CaptureModeView(camera: camera, direction: $swipeDirection)
            MainToolbar(camera: camera)
                .padding(.bottom, bottomPadding)
        }
    }
    
    /// This view arranges UI elements in a layered stack.
    @ViewBuilder
    var regularUI: some View {
        VStack {
            Spacer()
            ZoomControl(camera: camera)
            ZStack {
```

### Step
Build and run the app. Then open `ZoomControl.swift`, and look at its preview in the Xcode canvas.

In the Simulator, the camera has one zoom level, so the zoom control is not visible and the interface is the same as before. The canvas uses `PreviewCameraModel` and its three example levels. Nobody opened the canvas for this tutorial. The view was checked in a temporary build of the app that used `PreviewCameraModel`: there, the three buttons were above the mode picker, and a tap selected a level.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result in the Simulator: The app shows the live preview and its controls, with no zoom control.
Action: Open ZoomControl.swift, then Editor > Canvas
Expected result in the canvas: Three round buttons, "0.5", "1×", and "3". The middle button is larger and yellow. A tap on a button selects it.
```

### Note
The decimal separator follows the language and region of the device. With a region that uses a comma, the first button shows "0,5".

## Add the pinch gesture

A tap selects one of the levels. A pinch with two fingers gives each value between them. In this section, you add the gesture to the preview.

A pinch gesture reports a magnification: a factor relative to the distance of the fingers at the start of the gesture. So the app must remember the zoom factor at the start of the gesture, and multiply it by the magnification.

### Step
In `CameraView.swift`, add the `pinchStartFactor` state below the `swipeDirection` state.

The value is `nil` when no pinch is in progress.

```swift file=AVCam/CameraView.swift highlight=4-5
    // The direction a person swipes on the camera preview or mode selector.
    @State var swipeDirection = SwipeDirection.left
    
    // The zoom factor at the start of a pinch gesture.
    @State private var pinchStartFactor: CGFloat?

    var body: some View {
```

### Step
Above the `swipeGesture` property, add the `pinchGesture` property with a `MagnifyGesture` that sets the zoom on each change.

At the first change of a gesture, `pinchStartFactor` is `nil`, and the code stores the current zoom factor of the camera. At each later change, it uses the stored value. The new zoom is the start value multiplied by the magnification. Each change starts a task of its own, which is simple but has a limit: two values can arrive at the capture service in the wrong order.

```swift file=AVCam/CameraView.swift highlight=6-14
            // The main camera user interface.
            CameraUI(camera: camera, swipeDirection: $swipeDirection)
        }
    }

    var pinchGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                // Keep the zoom factor from the start of the gesture, and scale it by the gesture's value.
                let startFactor = pinchStartFactor ?? camera.displayZoomFactor
                pinchStartFactor = startFactor
                Task { await camera.setZoom(displayFactor: startFactor * value.magnification) }
            }
    }
    
    var swipeGesture: some Gesture {
```

### Step
Clear the stored zoom factor when the gesture ends.

The next pinch then starts from the zoom factor that the camera has at that time. That value can be different from the end of this gesture, for example after a tap on a zoom level or a slide on the Camera Control.

```swift file=AVCam/CameraView.swift highlight=7-9
            .onChanged { value in
                // Keep the zoom factor from the start of the gesture, and scale it by the gesture's value.
                let startFactor = pinchStartFactor ?? camera.displayZoomFactor
                pinchStartFactor = startFactor
                Task { await camera.setZoom(displayFactor: startFactor * value.magnification) }
            }
            .onEnded { _ in
                pinchStartFactor = nil
            }
    }
```

### Step
In the `body` property, add the pinch gesture to the camera preview, below the swipe gesture.

`simultaneousGesture` lets the preview keep its other gestures. The tap for focus and the swipe for the capture mode continue to work.

```swift file=AVCam/CameraView.swift highlight=7-8
                    // Focus and expose at the tapped point.
                    .onTapGesture { location in
                        Task { await camera.focusAndExpose(at: location) }
                    }
                    // Switch between capture modes by swiping left and right.
                    .simultaneousGesture(swipeGesture)
                    // Zoom in and out with two fingers.
                    .simultaneousGesture(pinchGesture)
```

### Step
Build and run the app to make sure that the preview and its gestures work as before.

In the Simulator, a pinch has no visible effect, because `setVideoZoomFactor(_:on:animated:)` returns for a camera that cannot zoom. To make a pinch in the Simulator, hold the Option key and drag on the preview.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview and all its controls, as before.
```

### Note
To test this chapter, run the app on a real iPhone. Nobody did this test for this tutorial, so the next lines describe what the code and the Apple SDK tell you to expect. On an iPhone with an ultra-wide camera, the zoom control shows a level less than 1, and the app starts at 1×. A tap on a level moves the zoom smoothly. A pinch changes the zoom continuously, and the selected button shows the value. A slide on the zoom slider of the Camera Control changes the number in the zoom control. After a change of the camera or of the capture mode, the zoom is at 1× again. If the first camera after the launch has no ultra-wide level, tap the button that changes the camera two times: the app then uses the first back camera of the new type list.

### Text
The app can now zoom, and its zoom control always shows the value of the device. In the next chapter, you look at the Apple sample with critical eyes and correct four of its defects.

## Check your understanding

### A back camera reports a display multiplier of 0.5 and the switch-over zoom factors 2 and 6. Which value does `configureZoom(for:)` set on `videoZoomFactor`, and why?

- [ ] 1.0, because 1.0 is the smallest zoom factor of each device.
  > 1.0 is the smallest value, but on this camera it shows the ultra-wide picture, which a person knows as 0.5x.
- [x] 2.0, because the display value 1 divided by the multiplier 0.5 is the device value 2.0.
  > Correct. The code sets `1.0 / multiplier`. On this camera, that is the first switch-over zoom factor, where the wide camera supplies its full picture.
- [ ] 0.5, because the system shows the widest picture as 0.5x.
  > 0.5 is a display value. As a device value, it is less than 1, and the device raises an exception for it.

### Why does `setVideoZoomFactor(_:on:animated:)` limit the value before it changes the device, and not catch an error after the change?

- [ ] The `do`-`catch` statement is slow, and a pinch calls the method many times each second.
  > Speed is not the reason. The method has a `do`-`catch` statement for the device lock.
- [ ] The device changes a value that is out of range to the nearest legal value, so no error occurs.
  > This is true only for a part of the values. A value less than 1, or more than the largest zoom factor of the format, raises an exception.
- [x] A value that is out of range raises an Objective-C exception, and Swift cannot catch it.
  > Correct. `do`-`catch` handles Swift errors, such as a lock that fails. An `NSRangeException` stops the app. The only protection is a check before the assignment.

### A person changes the zoom with the system zoom slider of the Camera Control. How does the zoom control of the app get the new value?

- [ ] The slider calls `setZoom(displayFactor:)` of the model.
  > A system slider sets the device property itself. It does not call the code of the app.
- [x] The capture service observes `videoZoomFactor` of the device and publishes each new value as a display value.
  > Correct. The device is the source of truth. Each change arrives through the observation: a change from the slider, from a ramp, and from a pinch.
- [ ] The zoom control reads the device each time SwiftUI draws the view.
  > The view has no access to the capture device. It reads `displayZoomFactor` of the model, and that property changes only when the observation reports a new value.
