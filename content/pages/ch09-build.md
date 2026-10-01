---
kind: tutorial
chapter: 9
title: Build: HDR video
abstract: Find the 10-bit variant of the active camera format, let the capture service change to it, and add an HDR button to video mode.
estimatedMinutes: 30
startBranch: chapter-08
branch: chapter-09
---

In this tutorial, you add HDR video to the app. In video mode, an HDR button appears when the camera has a 10-bit format. A tap on the button changes the camera to that format, and the movies that the app records are then HDR movies.

You write three small properties that find the 10-bit format. Then you send the answer "this camera supports HDR" from the movie service to the interface, you write the method that changes the format, and you add the button.

This chapter has a special condition. In the Simulator with SimCam, the camera has no 10-bit format, so the HDR button does not appear. That is the correct result, and it is what you see at the end of this tutorial. To record HDR video, you need a real iPhone. Read [Concepts: HDR video](ch09-concepts.md) first: this chapter has little code, and the concepts page explains the ideas behind each line.

## Find the 10-bit variant of a format

A camera has a list of formats. Each format is one combination of a frame size, frame rates, a pixel format, and more. "Turn HDR on" means "change to a format that stores 10 bits for each value, with the same size and the same frame rate as now".

In this section, you write the search for that format. You add it to `CaptureExtensions.swift`, the file with the `CMVideoDimensions` extension from chapter 3.

![An example format list: the search keeps the formats with the size and rate of the active format and returns the first 10-bit one](../images/ch09-format-search.svg)

### Step
In `CaptureExtensions.swift`, add an extension on `AVCaptureDevice.Format` with the `isTenBitFormat` property at the end of the file.

The format description of a format holds the pixel format in `mediaSubType`, as a four-character code. The constant [`kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange`](https://developer.apple.com/documentation/corevideo/kcvpixelformattype_420ypcbcr10biplanarvideorange) is the code `x420`: 10 bits for each value. AVCam uses this pixel format as the sign of an HDR format.

```swift file=AVCam/Support/CaptureExtensions.swift highlight=6-10
    public static func < (lhs: CMVideoDimensions, rhs: CMVideoDimensions) -> Bool {
        lhs.width < rhs.width && lhs.height < rhs.height
    }
}

extension AVCaptureDevice.Format {
    var isTenBitFormat: Bool {
        formatDescription.mediaSubType.rawValue == kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange
    }
}
```

### Step
Below `isTenBitFormat`, add the `maxFrameRate` property, which reads the highest frame rate of a format.

A format does not have one frame rate. It has a list of ranges in [`videoSupportedFrameRateRanges`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videosupportedframerateranges), and each range has a minimum and a maximum rate. The property reads the maximum of the last range, or 0 when the list is empty. The code assumes that the last range is the fastest one. The documentation does not promise an order.

```swift file=AVCam/Support/CaptureExtensions.swift highlight=5-7
extension AVCaptureDevice.Format {
    var isTenBitFormat: Bool {
        formatDescription.mediaSubType.rawValue == kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange
    }
    var maxFrameRate: Double {
        videoSupportedFrameRateRanges.last?.maxFrameRate ?? 0
    }
}
```

### Step
Above this extension, add an extension on `AVCaptureDevice` with the `activeFormat10BitVariant` property. Start with a filter that compares the frame size.

[`formats`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/formats) is the list of all formats of the camera, and [`activeFormat`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat) is the format in use. The filter keeps the formats that have the same pixel size as the active format. The `==` operator for two `CMVideoDimensions` values comes from the extension at the top of this file.

The property does not compile yet. The filter gives an array, and the property must return one optional format. You complete it in the next two steps.

```swift file=AVCam/Support/CaptureExtensions.swift highlight=6-12
    public static func < (lhs: CMVideoDimensions, rhs: CMVideoDimensions) -> Bool {
        lhs.width < rhs.width && lhs.height < rhs.height
    }
}

extension AVCaptureDevice {
    var activeFormat10BitVariant: AVCaptureDevice.Format? {
        formats.filter {
            $0.formatDescription.dimensions == activeFormat.formatDescription.dimensions
        }
    }
}

extension AVCaptureDevice.Format {
```

### Step
In the closure of the filter, add a first condition that compares the maximum frame rate.

The size alone does not identify a format. A camera can have two formats with the same size and different frame rates. The variant must keep the frame rate that the camera has now, so that only the number of bits and the color change.

```swift file=AVCam/Support/CaptureExtensions.swift highlight=4
extension AVCaptureDevice {
    var activeFormat10BitVariant: AVCaptureDevice.Format? {
        formats.filter {
            $0.maxFrameRate == activeFormat.maxFrameRate &&
            $0.formatDescription.dimensions == activeFormat.formatDescription.dimensions
        }
    }
}
```

### Step
After the filter, select the first format that is a 10-bit format.

`first(where:)` returns `nil` when no format passes the test. Thus one property answers two questions: "can this camera record HDR in its current configuration?" and "which format must the app set?". The search starts from the active format, so the answer depends on the current session preset.

```swift file=AVCam/Support/CaptureExtensions.swift highlight=7
extension AVCaptureDevice {
    var activeFormat10BitVariant: AVCaptureDevice.Format? {
        formats.filter {
            $0.maxFrameRate == activeFormat.maxFrameRate &&
            $0.formatDescription.dimensions == activeFormat.formatDescription.dimensions
        }
        .first(where: { $0.isTenBitFormat })
    }
}
```

### Step
Build the project to make sure that the three properties compile.

No code uses the properties yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Report HDR support

The interface must know if the camera supports HDR before it shows a button. In chapter 7, you built a path for such answers: each output service has a `capabilities` value, and the capture service publishes the value of the current mode.

In this section, you add an HDR flag to that path. The movie service computes the flag each time the configuration of the session changes.

### Step
In `DataTypes.swift`, add the `isHDRSupported` property to `CaptureCapabilities`, and add a second parameter to its initializer.

The default value of the new parameter is `false`. The photo service does not pass it, so in photo mode the flag is `false`, and its code needs no change. The `unknown` value also has the flag `false`.

```swift file=AVCam/Model/DataTypes.swift remove
    init(isLivePhotoCaptureSupported: Bool = false) {
```

```swift file=AVCam/Model/DataTypes.swift highlight=6,8-9,11
/// A structure that represents the capture capabilities of `CaptureService` in
/// its current configuration.
struct CaptureCapabilities {

    let isLivePhotoCaptureSupported: Bool
    let isHDRSupported: Bool

    init(isLivePhotoCaptureSupported: Bool = false,
         isHDRSupported: Bool = false) {
        self.isLivePhotoCaptureSupported = isLivePhotoCaptureSupported
        self.isHDRSupported = isHDRSupported
    }

    static let unknown = CaptureCapabilities()
}
```

### Step
In `MovieCapture.swift`, add the `isHDRSupported` property below the two timer properties.

The movie service keeps the answer in a property, because the computed `capabilities` value reads it later.

```swift file=AVCam/Capture/MovieCapture.swift highlight=5-7
    // The interval at which to update the recording time.
    private let refreshInterval = TimeInterval(0.25)
    private var timerCancellable: AnyCancellable?

    // A Boolean value that indicates whether the currently selected camera's
    // active format supports HDR.
    private var isHDRSupported = false

    // MARK: - Capturing a movie
```

### Step
At the start of `updateConfiguration(for:)`, set the property from the device.

The capture service calls this method after each change of capture mode and after each change of camera. These are the moments when the active format changes, so they are the moments when the answer can change. The line is above the `guard` statement. The `guard` returns in photo mode, when the movie output has no connection, and this line must not depend on a connection.

```swift file=AVCam/Capture/MovieCapture.swift highlight=2-3
    func updateConfiguration(for device: AVCaptureDevice) {
        // The app supports HDR video capture if the active format supports it.
        isHDRSupported = device.activeFormat10BitVariant != nil

        // The output has a video connection only while the session contains it, which is the
        // case in video capture mode. Adding the output creates a new connection, so the service
        // configures it here rather than when recording starts.
        guard let connection = movieOutput.connection(with: .video) else { return }
```

### Step
In the `capabilities` property, pass the flag to the `CaptureCapabilities` value.

In chapter 8, the movie service returned an empty value. Now the value carries the HDR answer to the capture service, which publishes it in video mode.

```swift file=AVCam/Capture/MovieCapture.swift remove
        CaptureCapabilities()
```

```swift file=AVCam/Capture/MovieCapture.swift highlight=4
    // MARK: - Configuration
    /// Returns the capabilities for this capture service.
    var capabilities: CaptureCapabilities {
        CaptureCapabilities(isHDRSupported: isHDRSupported)
    }
}
```

### Step
Build the project to make sure that the changes compile.

The capture service now publishes the HDR flag as part of `captureCapabilities`. No code reads the flag yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Change the format in the capture service

The capture service owns the session and the camera. In this section, you give it the method that turns HDR on and off.

There are two ways to select a camera format. Until now, the app set a session preset, and the session selected the format. To turn HDR on, the app sets the format itself. To turn HDR off, the app sets the preset again.

![With the high preset the session selects the format; after the app sets the active format, the preset is inputPriority](../images/ch09-format-control.svg)

### Step
In `CaptureService.swift`, add the published `isHDRVideoEnabled` property below `captureCapabilities`.

The service keeps the HDR state itself. It needs the state later, when the capture mode changes. The property has the `@Published` attribute as in the Apple sample. In this chapter, no code reads the publisher.

```swift file=AVCam/CaptureService.swift highlight=7-8
actor CaptureService {

    /// A value that indicates whether the capture service is idle or capturing a photo or movie.
    @Published private(set) var captureActivity: CaptureActivity = .idle
    /// A value that indicates the current capture capabilities of the service.
    @Published private(set) var captureCapabilities = CaptureCapabilities.unknown
    /// A Boolean value that indicates whether the user enables HDR video capture.
    @Published var isHDRVideoEnabled = false

    /// A type that connects a preview destination with the capture session.
    nonisolated let previewSource: PreviewSource
```

### Step
Below `stopRecording()`, add the `setHDRVideoEnabled(_:)` method with a configuration pair.

A format change is a change of the session configuration. The session applies all changes between [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()) together. The `defer` statement makes sure that the commit runs on each path out of the method. These pairs can be nested, which is important later in this section.

```swift file=AVCam/CaptureService.swift highlight=7-12
    /// Stops the recording and returns the captured movie.
    func stopRecording() async throws -> Movie {
        try await movieCapture.stopRecording()
    }


    /// Sets whether the app captures HDR video.
    func setHDRVideoEnabled(_ isEnabled: Bool) {
        // Bracket the following configuration in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
    }

    // MARK: - Internal state management
```

### Step
Add a `do` statement with the two branches of the decision, and a `catch` block that writes an error to the log.

The condition has two parts. The person must want HDR, and the camera must have a 10-bit variant of its active format. If one part is not true, the `else` branch runs. The `catch` block is for an error from the device lock, which you add in the next step. After such an error, the method changes nothing.

```swift file=AVCam/CaptureService.swift highlight=6-13
    /// Sets whether the app captures HDR video.
    func setHDRVideoEnabled(_ isEnabled: Bool) {
        // Bracket the following configuration in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        do {
            // If the current device provides a 10-bit HDR format, enable it for use.
            if isEnabled, let format = currentDevice.activeFormat10BitVariant {
            } else {
            }
        } catch {
            logger.error("Unable to obtain lock on device and can't enable HDR video capture.")
        }
    }
```

### Step
In the first branch, lock the device, set the active format to the 10-bit variant, unlock the device, and keep the new state.

You can set `activeFormat` only between [`lockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()) and `unlockForConfiguration()`. You used this lock in chapter 6 for focus and exposure. When the app sets the format, the session changes its preset to [`.inputPriority`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/inputpriority) by itself. This preset means that the app selected the format and the session does not change it.

```swift file=AVCam/CaptureService.swift highlight=9-12
    /// Sets whether the app captures HDR video.
    func setHDRVideoEnabled(_ isEnabled: Bool) {
        // Bracket the following configuration in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        do {
            // If the current device provides a 10-bit HDR format, enable it for use.
            if isEnabled, let format = currentDevice.activeFormat10BitVariant {
                try currentDevice.lockForConfiguration()
                currentDevice.activeFormat = format
                currentDevice.unlockForConfiguration()
                isHDRVideoEnabled = true
            } else {
            }
        } catch {
            logger.error("Unable to obtain lock on device and can't enable HDR video capture.")
        }
    }
```

### Step
In the `else` branch, set the session preset to `.high` again, and keep the new state.

The method did not keep the old format, and it does not need it. A preset gives the control of the format back to the session, and the session selects its normal format for video. This branch also runs when the person asks for HDR and the camera has no 10-bit variant.

```swift file=AVCam/CaptureService.swift highlight=14-15
    /// Sets whether the app captures HDR video.
    func setHDRVideoEnabled(_ isEnabled: Bool) {
        // Bracket the following configuration in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        do {
            // If the current device provides a 10-bit HDR format, enable it for use.
            if isEnabled, let format = currentDevice.activeFormat10BitVariant {
                try currentDevice.lockForConfiguration()
                currentDevice.activeFormat = format
                currentDevice.unlockForConfiguration()
                isHDRVideoEnabled = true
            } else {
                captureSession.sessionPreset = .high
                isHDRVideoEnabled = false
            }
        } catch {
            logger.error("Unable to obtain lock on device and can't enable HDR video capture.")
        }
    }
```

### Step
In `setCaptureMode(_:)`, turn HDR on again in the video case when the state says so.

The line `captureSession.sessionPreset = .high` in this case takes the control of the format away from the app. Without the new lines, HDR is lost each time the person goes to photo mode and comes back. The call is inside the configuration pair of `setCaptureMode(_:)`, so the pair of `setHDRVideoEnabled(_:)` is a nested pair. The session applies all changes at the outer commit.

```swift file=AVCam/CaptureService.swift highlight=21-23
    /// Changes the mode of capture, which can be `photo` or `video`.
    ///
    /// - Parameter `captureMode`: The capture mode to enable.
    func setCaptureMode(_ captureMode: CaptureMode) throws {
        // Update the internal capture mode value before performing the session configuration.
        self.captureMode = captureMode

        // Change the configuration atomically.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

        // Configure the capture session for the selected capture mode.
        switch captureMode {
        case .photo:
            // The app needs to remove the movie capture output to perform Live Photo capture.
            captureSession.sessionPreset = .photo
            captureSession.removeOutput(movieCapture.output)
        case .video:
            captureSession.sessionPreset = .high
            try addOutput(movieCapture.output)
            if isHDRVideoEnabled {
                setHDRVideoEnabled(true)
            }
        }

        // Update the advertised capabilities after reconfiguration.
        updateCaptureCapabilities()
    }
```

### Step
Build the project to make sure that the capture service compiles.

The service can change the format now, but nothing calls the new method from outside.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the HDR state to the model

The views do not talk to the capture service. They use the `Camera` protocol. In this section, you add two members to the protocol and to its two implementations: one says if HDR is possible, and one says if HDR is on.

### Step
In `Camera.swift`, add the `isHDRVideoSupported` and `isHDRVideoEnabled` properties to the protocol, above `toggleRecording()`.

The first property is read-only for a view: only the camera knows the answer. The second property has `get set`, because the HDR button changes it.

```swift file=AVCam/Model/Camera.swift highlight=4-5,7-8
    /// A Boolean value that indicates whether to show visual feedback when capture begins.
    var shouldFlashScreen: Bool { get }

    /// A Boolean that indicates whether the camera supports HDR video recording.
    var isHDRVideoSupported: Bool { get }

    /// A Boolean value that indicates whether camera enables HDR video recording.
    var isHDRVideoEnabled: Bool { get set }

    /// Starts or stops recording a movie, and writes it to the user's photo library when complete.
    func toggleRecording() async
```

### Note
The project does not compile at this time, because `CameraModel` and `PreviewCameraModel` do not have the new members. You add them in the next steps.

### Step
In `CameraModel.swift`, add the `isHDRVideoSupported` property with a private setter below `previewSource`.

A view can read the value but cannot change it. The value comes only from the capture service.

```swift file=AVCam/CameraModel.swift highlight=4-5
    /// An object that provides the connection between the capture session and the video preview layer.
    var previewSource: PreviewSource { captureService.previewSource }

    /// A Boolean that indicates whether the camera supports HDR video recording.
    private(set) var isHDRVideoSupported = false

    /// An object that saves captured media to a person's Photos library.
    private let mediaLibrary = MediaLibrary()
```

### Step
In `observeState()`, add a third task that reads the capabilities of the capture service.

The capture service publishes a new `CaptureCapabilities` value after each change of mode and each change of camera. The task copies the HDR flag to the model, and the views update. This is the same pattern as the task for the capture activity: `values` turns a publisher into an asynchronous sequence, and the task runs on the main actor.

```swift file=AVCam/CameraModel.swift highlight=23-28
    // Set up camera's state observations.
    private func observeState() {
        Task {
            // Await new thumbnails that the media library generates when saving a file.
            for await thumbnail in mediaLibrary.thumbnails.compactMap({ $0 }) {
                self.thumbnail = thumbnail
            }
        }

        Task {
            // Await new capture activity values from the capture service.
            for await activity in await captureService.$captureActivity.values {
                if activity.willCapture {
                    // Flash the screen to indicate capture is starting.
                    flashScreen()
                } else {
                    // Forward the activity to the UI.
                    captureActivity = activity
                }
            }
        }

        Task {
            // Await updates to the capabilities that the capture service advertises.
            for await capabilities in await captureService.$captureCapabilities.values {
                isHDRVideoSupported = capabilities.isHDRSupported
            }
        }
    }
}
```

### Step
Below the `// MARK: - Video capture` line, add the `isHDRVideoEnabled` property with an empty `didSet` observer.

This property has no private setter, because the HDR button changes it. A view only sets a Boolean value. The observer runs after each change, and it is the place where the model reacts.

```swift file=AVCam/CameraModel.swift highlight=3-7
    // MARK: - Video capture

    /// A Boolean value that indicates whether the camera captures video in HDR format.
    var isHDRVideoEnabled = false {
        didSet {
        }
    }

    /// Toggles the state of recording.
    func toggleRecording() async {
```

### Step
In the observer, send the new value to the capture service when the session runs in video mode.

The capture service is a different actor, so the call needs `await` and a task. The `guard` statement stops the call when the session does not run or when the app is in photo mode. The model does not read the result. If the service cannot turn HDR on, this property keeps the value `true`.

```swift file=AVCam/CameraModel.swift highlight=6-9
    // MARK: - Video capture

    /// A Boolean value that indicates whether the camera captures video in HDR format.
    var isHDRVideoEnabled = false {
        didSet {
            guard status == .running, captureMode == .video else { return }
            Task {
                await captureService.setHDRVideoEnabled(isHDRVideoEnabled)
            }
        }
    }

    /// Toggles the state of recording.
    func toggleRecording() async {
```

### Step
In `PreviewCameraModel.swift`, add the two properties with the value `false`.

SwiftUI previews use this class in place of the real model. It has no camera, so the two properties are simple stored values.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=7-8
@Observable
class PreviewCameraModel: Camera {

    var isLivePhotoEnabled = true
    var qualityPrioritization = QualityPrioritization.quality
    var shouldFlashScreen = false
    var isHDRVideoSupported = false
    var isHDRVideoEnabled = false

```

### Step
Build the project to make sure that the two models conform to the protocol again.

The model now knows if HDR is possible, and it can turn HDR on. The interface does not show this yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the HDR button

On an iPhone, the features toolbar is at the top of the screen. In chapter 7, you filled it for photo mode. In chapter 8, its video case was empty. In this last section, you add the HDR button to the video case.

### Step
In `FeatureToolbar.swift`, add the `hdrToggleButton` property at the end of the structure.

The button changes `isHDRVideoEnabled` of the model, and the `didSet` observer from the last section does the rest. The label is text, "HDR On" or "HDR Off", so the person always sees the current state.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=13-20
        } label: {
            switch camera.qualityPrioritization {
            case .speed:
                Image(systemName: "dial.low")
            case .balanced:
                Image(systemName: "dial.medium")
            case .quality:
                Image(systemName: "dial.high")
            }
        }
    }

    var hdrToggleButton: some View {
        Button {
            camera.isHDRVideoEnabled.toggle()
        } label: {
            Text("HDR \(camera.isHDRVideoEnabled ? "On" : "Off")")
                .font(.body.weight(.semibold))
        }
    }
}
```

### Step
Disable the button while the app records a movie.

A format change builds the capture pipeline again, and that ends a recording. For the same reason, chapter 8 disabled the mode picker during a recording.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=8
    var hdrToggleButton: some View {
        Button {
            camera.isHDRVideoEnabled.toggle()
        } label: {
            Text("HDR \(camera.isHDRVideoEnabled ? "On" : "Off")")
                .font(.body.weight(.semibold))
        }
        .disabled(camera.captureActivity.isRecording)
    }
}
```

### Step
Above `hdrToggleButton`, add the `hdrButton` property, which shows the toggle button in each of its two branches.

`isCompactSize` comes from the `PlatformView` protocol from chapter 5. It is `true` in a compact layout, as on an iPhone. There, the button keeps the default style of the toolbar. The two branches are equal at this time. You make them different in the next step.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=13-20
        } label: {
            switch camera.qualityPrioritization {
            case .speed:
                Image(systemName: "dial.low")
            case .balanced:
                Image(systemName: "dial.medium")
            case .quality:
                Image(systemName: "dial.high")
            }
        }
    }

    @ViewBuilder
    var hdrButton: some View {
        if isCompactSize {
            hdrToggleButton
        } else {
            hdrToggleButton
        }
    }

    var hdrToggleButton: some View {
```

### Step
In the `else` branch, give the button a border in the form of a capsule.

The `else` branch is for a layout that is not compact, as on an iPad. A text button with no border is hard to see as a button on a large screen. The two branches now return different view types, and `@ViewBuilder` permits that.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=7-8
    @ViewBuilder
    var hdrButton: some View {
        if isCompactSize {
            hdrToggleButton
        } else {
            hdrToggleButton
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
        }
    }

    var hdrToggleButton: some View {
```

### Step
In `body`, replace `EmptyView()` in the video case with the HDR button, and show it only when the camera supports HDR.

A control for a feature that the camera does not have confuses the person. The condition reads `isHDRVideoSupported`, which follows the capabilities of the capture service. When the person changes the camera or the mode, the button appears or goes away by itself.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift remove
                EmptyView()
```

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=9-11
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
    }
```

### Step
Build and run the app in the Simulator. Change to video mode, and look at the features toolbar at the top of the screen.

No HDR button appears. This is the correct result in the Simulator with SimCam: the search finds no 10-bit variant for the SimCam camera, so `isHDRVideoSupported` stays `false`, and the features toolbar has no button in video mode. Record a short movie to make sure that video mode works as in chapter 8.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then change to video mode
Result: The features toolbar has no HDR button in video mode. The other controls are the same as in chapter 8.
Then: Record a short movie. The recording and the save to Photos work as before.
```

### Note
HDR recording needs a real iPhone. Nobody verified it for this tutorial. This is what the code does on a camera that has a 10-bit variant of its video format: the button appears in video mode with the text "HDR Off", a tap changes the text to "HDR On" and the camera to the 10-bit format, and a movie that you record then is a 10-bit HDR movie. If you have an iPhone, run the app on it and examine a recorded movie in the Photos app.

### Experiment
In `updateConfiguration(for:)` of `MovieCapture.swift`, add the temporary line `device.formats.forEach { print($0) }`. Run the app, change to video mode, and read the list of formats in the Xcode console. Try to find the size, the frame rates, and the pixel format code of each format. Then delete the line, so that your code stays equal to the branch `chapter-09`.

### Text
The app has all its capture features now. In the next chapter, you make the session robust: the app reacts to interruptions, recovers from errors, and starts faster.

## Check your understanding

### To turn HDR off, `setHDRVideoEnabled(_:)` sets `captureSession.sessionPreset = .high`. Why does this turn HDR off?

- [ ] The `.high` preset sets `isVideoHDREnabled` of the device to `false`.
  > The sample never uses `isVideoHDREnabled`. That property belongs to a different, older feature that merges two exposures into an 8-bit frame.
- [x] When the app set `activeFormat`, the preset became `.inputPriority`. A new preset gives the control back to the session, which selects its normal 8-bit format.
  > Correct. The app does not need to keep the old format. The preset replaces the 10-bit format that the app selected.
- [ ] The `.high` preset removes the movie output, and the output comes back without HDR.
  > A preset does not add or remove outputs. It only tells the session which quality level to use, and the session selects a format for it.

### In the Simulator with SimCam, the HDR button does not appear. Which value is the cause?

- [ ] `camera.captureActivity.isRecording` is `true`, so the toolbar hides the button.
  > A recording only disables the button. It does not hide it.
- [ ] `isHDRVideoEnabled` of the model is `false`.
  > This is the state of the button, "On" or "Off". It does not decide if the button is visible.
- [x] `activeFormat10BitVariant` returns `nil`, so `isHDRSupported` and then `isHDRVideoSupported` are `false`.
  > Correct. The answer of the format search goes through `CaptureCapabilities` to the model, and the toolbar shows the button only when the value is `true`.

### The model has an `isHDRVideoEnabled` property. Why does the capture service keep its own `isHDRVideoEnabled` flag?

- [ ] An actor cannot read a property of the model, so it must have a copy.
  > The model sends the value to the service as a parameter. The reason for the flag is a different one.
- [x] Each change to video mode sets the `.high` preset, which removes the 10-bit format. The service uses the flag to turn HDR on again in the same configuration change.
  > Correct. `setCaptureMode(_:)` reads the flag and calls `setHDRVideoEnabled(true)` before the commit, so HDR stays on after a visit to photo mode.
- [ ] The session reads the flag to decide which color space to use.
  > The session knows nothing about this property. The session selects the color space from the active format.
