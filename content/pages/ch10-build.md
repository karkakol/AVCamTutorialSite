---
kind: tutorial
chapter: 10
title: Build: a robust session
abstract: Observe interruptions and runtime errors, show an interruption status, make the deferred start visible, hide the controls until the session runs, and cover the stale preview frame.
estimatedMinutes: 35
startBranch: chapter-09
branch: chapter-10
---

In this tutorial, you make the app robust. At the end, the app reports an interruption with a yellow status message, starts its session again after a media services reset, shows its controls only when the camera runs, and covers the old preview frame when it returns from the background.

You add no new files. You add approximately 110 lines to nine files that you know from the earlier chapters.

Most of this chapter is about events that the Simulator cannot produce: a phone call, a restart of a system service, a real launch of the camera hardware. Each section tells you what you can see in the Simulator, and how to test the rest on a real iPhone. Read [Concepts: a robust session](ch10-concepts.md) first if you want the background for each step.

## Observe interruptions

The system can take the camera or the microphone away from your app at any time. It tells the app with a notification, and it tells the app again when the interruption ends. In this section, the capture service listens to these two notifications and publishes one Boolean value.

![The states of a capture session: not running, running, interrupted, and stopped by an error, with the events that move the session between them](../images/ch10-session-states.svg)

### Step
In `CaptureService.swift`, add the published `isInterrupted` property below the `captureCapabilities` property.

The property follows the pattern of `captureActivity` from chapter 3. The actor changes the value, and `@Published` gives the model a publisher that it can observe from the main actor.

```swift file=AVCam/CaptureService.swift highlight=7-8
actor CaptureService {

    /// A value that indicates whether the capture service is idle or capturing a photo or movie.
    @Published private(set) var captureActivity: CaptureActivity = .idle
    /// A value that indicates the current capture capabilities of the service.
    @Published private(set) var captureCapabilities = CaptureCapabilities.unknown
    /// A Boolean value that indicates whether a higher priority event, like receiving a phone call, interrupts the app.
    @Published private(set) var isInterrupted = false
    /// A Boolean value that indicates whether the user enables HDR video capture.
    @Published var isHDRVideoEnabled = false
```

### Step
At the end of the actor, add the `observeNotifications()` method with one empty task.

A [`Task`](https://developer.apple.com/documentation/swift/task) that an actor method creates runs on that actor. Thus the code that you put in the task can change the properties of the actor directly.

```swift file=AVCam/CaptureService.swift highlight=8-12
    /// Merge the `captureActivity` values of the photo and movie capture services,
    /// and assign the value to the actor's property.`
    private func observeOutputServices() {
        Publishers.Merge(photoCapture.$captureActivity, movieCapture.$captureActivity)
            .assign(to: &$captureActivity)
    }

    /// Observe capture-related notifications.
    private func observeNotifications() {
        Task {
        }
    }
}
```

### Step
In the task, read each interruption notification, get its reason, and set `isInterrupted` for two reasons only.

[`notifications(named:object:)`](https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:)) gives the notifications as an asynchronous sequence. The first `compactMap` reads the value for [`AVCaptureSessionInterruptionReasonKey`](https://developer.apple.com/documentation/avfoundation/avcapturesessioninterruptionreasonkey), which is a number object. The second `compactMap` changes the number into an [`AVCaptureSession.InterruptionReason`](https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason).

The last line is the decision. Each move to the background is also an interruption, and that must not show a message. So the value becomes `true` only when a different client uses the microphone or the camera.

```swift file=AVCam/CaptureService.swift highlight=4-9
    /// Observe capture-related notifications.
    private func observeNotifications() {
        Task {
            for await reason in NotificationCenter.default.notifications(named: AVCaptureSession.wasInterruptedNotification)
                .compactMap({ $0.userInfo?[AVCaptureSessionInterruptionReasonKey] as AnyObject? })
                .compactMap({ AVCaptureSession.InterruptionReason(rawValue: $0.integerValue) }) {
                /// Set the `isInterrupted` state as appropriate.
                isInterrupted = [.audioDeviceInUseByAnotherClient, .videoDeviceInUseByAnotherClient].contains(reason)
            }
        }
```

### Step
Add a second task, which sets `isInterrupted` to `false` when an interruption ends.

The code does not start the session here. After an interruption, the system starts the session again. The app only updates its state.

```swift file=AVCam/CaptureService.swift highlight=12-17
    /// Observe capture-related notifications.
    private func observeNotifications() {
        Task {
            for await reason in NotificationCenter.default.notifications(named: AVCaptureSession.wasInterruptedNotification)
                .compactMap({ $0.userInfo?[AVCaptureSessionInterruptionReasonKey] as AnyObject? })
                .compactMap({ AVCaptureSession.InterruptionReason(rawValue: $0.integerValue) }) {
                /// Set the `isInterrupted` state as appropriate.
                isInterrupted = [.audioDeviceInUseByAnotherClient, .videoDeviceInUseByAnotherClient].contains(reason)
            }
        }

        Task {
            // Await notification of the end of an interruption.
            for await _ in NotificationCenter.default.notifications(named: AVCaptureSession.interruptionEndedNotification) {
                isInterrupted = false
            }
        }
    }
```

### Step
In `setUpSession()`, call `observeNotifications()` below the call of `observeOutputServices()`.

The service creates the tasks before it configures the session. But the tasks run on the actor, so they start only when the actor is free, after `start()` returns. Thus it is possible that the service does not get a notification from the first moments of the session.

```swift file=AVCam/CaptureService.swift highlight=6
    // MARK: - Capture setup
    // Performs the initial capture session configuration.
    private func setUpSession() throws {
        // Observe internal state and notifications.
        observeOutputServices()
        observeNotifications()

        do {
```

### Step
Build the project to make sure that the new code compiles.

No code reads `isInterrupted` yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Recover from a runtime error

An interruption ends by itself. A runtime error does not: the session stops, and it stays stopped until the app does something. In this section, you handle the one runtime error that the Apple sample handles, the media services reset.

You also make `setUpSession()` safe to call more than one time.

### Step
In `observeNotifications()`, add a third task, which reads the error of each runtime error notification.

The value for [`AVCaptureSessionErrorKey`](https://developer.apple.com/documentation/avfoundation/avcapturesessionerrorkey) in the notification is an error object. The conditional cast gives it to you as an `AVError`, so that you can compare its code in the next step. Until then, Xcode can show a warning that `error` is not used.

```swift file=AVCam/CaptureService.swift highlight=8-12
        Task {
            // Await notification of the end of an interruption.
            for await _ in NotificationCenter.default.notifications(named: AVCaptureSession.interruptionEndedNotification) {
                isInterrupted = false
            }
        }

        Task {
            for await error in NotificationCenter.default.notifications(named: AVCaptureSession.runtimeErrorNotification)
                .compactMap({ $0.userInfo?[AVCaptureSessionErrorKey] as? AVError }) {
            }
        }
    }
}
```

### Step
In the loop, start the session again when the error code is `mediaServicesWereReset`.

The camera hardware belongs to a system process. When this process starts again, the session stops. The sample keeps the session with its inputs and outputs. [`mediaServicesWereReset`](https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/mediaserviceswerereset) is the code for this event, and [`startRunning()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning()) is the repair. The task runs on the actor, and thus on the session queue, which is the correct place for this blocking call.

```swift file=AVCam/CaptureService.swift highlight=4-9
        Task {
            for await error in NotificationCenter.default.notifications(named: AVCaptureSession.runtimeErrorNotification)
                .compactMap({ $0.userInfo?[AVCaptureSessionErrorKey] as? AVError }) {
                // If the system resets media services, the capture session stops running.
                if error.code == .mediaServicesWereReset {
                    if !captureSession.isRunning {
                        captureSession.startRunning()
                    }
                }
            }
        }
```

### Step
Add the private `isSetUp` property below the rotation properties.

This flag records that the session has its inputs and outputs. You use it in the next two steps.

```swift file=AVCam/CaptureService.swift highlight=5-6
    // An object that monitors video device rotations.
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator!
    private var rotationObservers = [AnyObject]()

    // A Boolean value that indicates whether the actor finished its required configuration.
    private var isSetUp = false

    // A serial dispatch queue to use for capture control actions.
    private let sessionQueue = DispatchSerialQueue(label: "com.karolkakol.AVCam.sessionQueue")
```

### Step
At the start of `setUpSession()`, return immediately when the setup is complete.

`start()` calls `setUpSession()` each time that the session does not run. Without this line, a second call tries to add the same inputs again. The session is expected to refuse them, and the method then throws `setupFailed`. The guard is above the two `observe` calls, so the service also starts its observers one time only.

```swift file=AVCam/CaptureService.swift highlight=13-14
    // MARK: - Capture session life cycle
    func start() async throws {
        // Exit early if not authorized or the session is already running.
        guard await isAuthorized, !captureSession.isRunning else { return }
        // Configure the session and start it.
        try setUpSession()
        captureSession.startRunning()
    }

    // MARK: - Capture setup
    // Performs the initial capture session configuration.
    private func setUpSession() throws {
        // Return early if already set up.
        guard !isSetUp else { return }

        // Observe internal state and notifications.
        observeOutputServices()
        observeNotifications()

        do {
```

### Step
At the end of the `do` block, set `isSetUp` to `true`.

The line is the last line of the block. If a line before it throws an error, the flag stays `false`, and a later call can try the setup again.

```swift file=AVCam/CaptureService.swift highlight=10
            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
            // Observe changes to the default camera's subject area.
            observeSubjectAreaChanges(of: defaultCamera)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()

            isSetUp = true
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
Build and run the app to make sure that the session still starts.

The Simulator cannot reset the media services, so you see no change.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview, and capture works as before.
```

### Experiment
This tutorial did not test the recovery. To test it on a real iPhone, run the app, and then open the Developer settings in the Settings app and use the command that resets the media services. Go back to the app. The preview is expected to run again. Then put a comment in front of the `captureSession.startRunning()` line in the third task and do the test again, to see what the app does with no recovery. Remove the comment after the test.

## Show the interruption status

The capture service now knows when an interruption starts and ends. In this section, you bring this fact to the screen: a new status value, a yellow message for it, and a task in the model that connects the two.

### Step
In `DataTypes.swift`, add the `interrupted` case to the `CameraStatus` enumeration.

The status is the one value that tells the views what the camera does. The `switch` statements that read it have a `default` case, so the project still compiles.

```swift file=AVCam/Model/DataTypes.swift highlight=11-12
/// An enumeration that describes the current status of the camera.
enum CameraStatus {
    /// The initial status upon creation.
    case unknown
    /// A status that indicates a person disallows access to the camera or microphone.
    case unauthorized
    /// A status that indicates the camera failed to start.
    case failed
    /// A status that indicates the camera is successfully running.
    case running
    /// A status that indicates higher-priority media processing is interrupting the camera.
    case interrupted
}
```

### Step
In `StatusOverlayView.swift`, add `.interrupted` to the list of statuses that the overlay handles.

The overlay shows its dimming rectangle and its message only for a status in this list. For each other status, it shows nothing.

```swift file=AVCam/Views/Overlays/StatusOverlayView.swift remove
    let handled: [CameraStatus] = [.unauthorized, .failed]
```

```swift file=AVCam/Views/Overlays/StatusOverlayView.swift highlight=5
/// A view that presents a status message over the camera user interface.
struct StatusOverlayView: View {

	let status: CameraStatus
    let handled: [CameraStatus] = [.unauthorized, .failed, .interrupted]

	var body: some View {
		if handled.contains(status) {
```

### Step
Add a yellow color and a message for the `interrupted` status.

The three colors show how serious a status is. Red tells the person to change a setting, and orange reports a failure. Yellow is for a state that ends by itself. The text style that is already in the view uses dark gray text on yellow, because white text on yellow is hard to read.

```swift file=AVCam/Views/Overlays/StatusOverlayView.swift highlight=7-8,18-19
	var color: Color {
		switch status {
		case .unauthorized:
			return .red
		case .failed:
			return .orange
		case .interrupted:
			return .yellow
		default:
			return .clear
		}
	}

	var message: String {
		switch status {
		case .unauthorized:
			return "You haven't authorized AVCam to use the camera or microphone. Change these settings in Settings -> Privacy & Security"
		case .interrupted:
			return "The camera was interrupted by higher-priority media processing."
		case .failed:
			return "The camera failed to start. Please try relaunching the app."
		default:
			return ""
		}
	}
```

### Step
Add a preview for the interrupted state above the two previews at the end of the file.

You cannot make an interruption in the Xcode canvas. A preview with a fixed status lets you examine the look of the message with no camera and no phone call.

```swift file=AVCam/Views/Overlays/StatusOverlayView.swift highlight=3-5
}

#Preview("Interrupted") {
    CameraView(camera: PreviewCameraModel(status: .interrupted))
}

#Preview("Failed") {
    CameraView(camera: PreviewCameraModel(status: .failed))
}
```

### Important
The next step is the one place in this chapter where your code is different from the Apple sample. The sample publishes `isInterrupted` in the capture service, and it has the `interrupted` status and the yellow message. But the model in the sample never reads `isInterrupted`, so the message can never appear in the real app. The task that you add in the next step is not in the Apple sample. This tutorial adds it to connect the parts.

### Step
In `CameraModel.swift`, add a task at the end of `observeState()` that sets `status` from the `isInterrupted` value of the capture service.

The task has the same form as the task for the capabilities above it. The publisher sends its current value first, which is `false`, so the status is `running` after the start. Then each change of `isInterrupted` changes the status.

```swift file=AVCam/CameraModel.swift highlight=8-14
        Task {
            // Await updates to the capabilities that the capture service advertises.
            for await capabilities in await captureService.$captureCapabilities.values {
                isHDRVideoSupported = capabilities.isHDRSupported
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
}
```

### Step
Build and run the app to make sure that it works as before.

No interruption occurs in the Simulator, so the status stays `running`, and the message does not appear.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview and the controls, with no status message.
```

### Experiment
This tutorial did not test an interruption. To test it on a real iPhone, run the app and ask a person to call you, with a phone call or a FaceTime call. Accept the call. The expected result is the yellow message "The camera was interrupted by higher-priority media processing." on a dimmed screen. End the call. The message is expected to go away, and the preview is expected to run again. To see only the look of the message, open the canvas for `StatusOverlayView.swift` and select the "Interrupted" preview.

## Start fast and show controls late

At launch, the person waits for the first preview frame. In this section, you write the two lines that show how deferred start works. Then you keep the secondary controls invisible until the camera runs, so that the preview is the first thing on the screen.

![Two launch timelines: without deferred start the preview appears after the outputs are ready, and with deferred start the preview appears before the session prepares the outputs](../images/ch10-deferred-start.svg)

### Step
In `setUpSession()` in `CaptureService.swift`, select automatic deferred start for the session, and enable deferred start on the photo output.

With deferred start, the session shows the preview first and prepares the marked outputs a moment later. The app gets this behavior with no code, because these values are the defaults for an app that you build with the iOS 26 SDK or later. The lines are here so that you know where the behavior comes from. The second line copies [`isDeferredStartSupported`](https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartsupported), because the value `true` on an output with no support raises an exception.

```swift file=AVCam/CaptureService.swift highlight=4-7,10
            // Configure the session for photo capture.
            captureSession.sessionPreset = .photo

            // Deferred start brings up the preview first, and prepares the capture outputs a moment
            // later. An app that links the iOS 26 SDK gets this behavior by default; these
            // assignments show the properties that control it.
            captureSession.automaticallyRunsDeferredStart = true

            // Add the photo capture output as the default output type.
            photoCapture.output.isDeferredStartEnabled = photoCapture.output.isDeferredStartSupported
            try addOutput(photoCapture.output)
```

### Step
In `ViewExtensions.swift`, add an extension on `View` with the `hidden(until:)` method below `DefaultButtonStyle`.

The method changes the opacity only. An invisible view keeps its place in the layout, so no other view moves when the control appears.

```swift file=AVCam/Support/ViewExtensions.swift highlight=6-10
    var isRegularSize: Bool {
        horizontalSizeClass == .regular && verticalSizeClass == .regular
    }
}

extension View {
    func hidden(until isRunning: Bool) -> some View {
        opacity(isRunning ? 1 : 0)
    }
}

extension Image {
    init(_ image: CGImage) {
        self.init(uiImage: UIImage(cgImage: image))
    }
}
```

### Step
Add the documentation comment and an animation that fades the view in.

The `animation(_:value:)` modifier starts an animation each time `isRunning` changes. The control appears in 0.3 seconds and does not jump onto the screen.

```swift file=AVCam/Support/ViewExtensions.swift highlight=2-5,8
extension View {
    /// Hides this view until the capture session is running.
    ///
    /// The app applies this to its controls so that it doesn't show UI until it's
    /// functional, and so the preview is the first thing to appear at launch.
    func hidden(until isRunning: Bool) -> some View {
        opacity(isRunning ? 1 : 0)
            .animation(.easeIn(duration: 0.3), value: isRunning)
    }
}
```

### Step
In `MainToolbar.swift`, hide the thumbnail button until the camera status is `running`.

The thumbnail opens the Photos library. It is not necessary for the first photo, so it can wait.

> [!NOTE]
> In the Apple sample, the `ThumbnailButton` line starts with tab characters, not with spaces. The branch `chapter-10` copies this. Thus Git reports the line as changed, although the code on it is the same.

```swift file=AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift remove
            ThumbnailButton(camera: camera)
```

```swift file=AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift highlight=3-5
    var body: some View {
        HStack {
			ThumbnailButton(camera: camera)
                // Hide it until the capture session runs, using a custom modifier.
                .hidden(until: camera.status == .running)
            Spacer()
            CaptureButton(camera: camera)
            Spacer()
            SwitchCameraButton(camera: camera)
        }
```

### Step
Add the comment above the capture button, and hide the button that changes the camera.

The capture button gets no modifier. A capture request that arrives before the deferred start is complete is legal: the session then prepares the photo output immediately. Responsive capture, which you enabled in chapter 7, lets more than one early request through.

```swift file=AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift highlight=7-8,12-13
    var body: some View {
        HStack {
			ThumbnailButton(camera: camera)
                // Hide it until the capture session runs, using a custom modifier.
                .hidden(until: camera.status == .running)
            Spacer()
            // The capture button stays visible. A capture that arrives before deferred start
            // finishes is still honored, because the photo output enables responsive capture.
            CaptureButton(camera: camera)
            Spacer()
            SwitchCameraButton(camera: camera)
                // Hide it until the capture session runs, using a custom modifier.
                .hidden(until: camera.status == .running)
        }
```

### Step
In `CaptureModeView.swift`, hide the mode picker in the same way.

A change of mode configures the session again. That is not possible before the session runs, so the picker has no function until then.

```swift file=AVCam/Views/Controls/CaptureModeView.swift highlight=21-22
    var body: some View {
        Picker("Capture Mode", selection: $camera.captureMode) {
            ForEach(CaptureMode.allCases) {
                Image(systemName: $0.systemName)
                    .tag($0.rawValue)
            }
        }
        .frame(width: 180)
        .pickerStyle(.segmented)
        .disabled(camera.captureActivity.isRecording)
        .onChange(of: direction) { _, _ in
            let modes = CaptureMode.allCases
            let selectedIndex = modes.firstIndex(of: camera.captureMode) ?? -1
            // Increment the selected index when swiping right.
            let increment = direction == .right
            let newIndex = selectedIndex + (increment ? 1 : -1)

            guard newIndex >= 0, newIndex < modes.count else { return }
            camera.captureMode = modes[newIndex]
        }
        // Hide the capture mode view until the capture session runs, using a custom modifier.
        .hidden(until: camera.status == .running)
    }
```

### Step
In `FeatureToolbar.swift`, hide the features toolbar in the same way.

One modifier on the stack hides all the feature buttons together.

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
        // Hide them until the capture session runs, using a custom modifier.
        .hidden(until: camera.status == .running)
    }
```

### Step
Build and run the app, and look at the first moments after the launch.

At first, the screen shows only the capture button. When the camera runs, the thumbnail button, the button that changes the camera, the mode picker, and the features toolbar fade in. In the Simulator, SimCam shows the text "Waiting for SimCam..." in the preview for approximately 2 seconds after the launch.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The controls fade in after the launch, and capture works as before.
```

### Note
The controls depend on `camera.status == .running`. With the task that you added to the model, the status is `interrupted` during an interruption. Thus the controls are expected to fade out during a phone call and to fade in again after it. The preview model in the Xcode canvas starts with the status `unknown`, so a canvas preview of a toolbar can now show hidden controls.

### Experiment
This tutorial did not measure the launch time. To see the effect of deferred start on a real iPhone, set `isDeferredStartEnabled` on the photo output to `false`, launch the app some times, and compare how fast the preview appears. Then restore the line, so that your code stays equal to the branch `chapter-10`.

## Cover the stale preview frame

When the app goes to the background, the session stops, and the preview layer keeps its last frame. When the app returns, the person sees this old frame for a moment. In this section, you put a black cover on the preview for that moment.

### Step
In `PreviewContainer.swift`, add the `scenePhase` environment value and the `coverOpacity` state.

[`ScenePhase`](https://developer.apple.com/documentation/swiftui/scenephase) tells a view if its scene is active, inactive, or in the background. The opacity starts at zero, so the cover is invisible while the app is in use.

```swift file=AVCam/Views/PreviewContainer.swift highlight=7,11
struct PreviewContainer<Content: View, CameraModel: Camera>: View {

    @Environment(\.horizontalSizeClass) var horizontalSizeClass

    @State var camera: CameraModel

    @Environment(\.scenePhase) private var scenePhase

    // State values for transition effects.
    @State private var blurRadius = CGFloat.zero
    @State private var coverOpacity = 0.0

```

### Step
In `previewView`, put a black overlay with this opacity on the content.

The overlay is below the `blur` modifier in the code, so it is in front of the blurred preview. It covers only the preview. The controls stay visible.

```swift file=AVCam/Views/PreviewContainer.swift highlight=5
    /// Attach animations to the camera preview.
    var previewView: some View {
        content
            .blur(radius: blurRadius, opaque: true)
            .overlay(Color.black.opacity(coverOpacity))
            .onChange(of: camera.isSwitchingModes, updateBlurRadius(_:_:))
            .onChange(of: camera.isSwitchingVideoDevices, updateBlurRadius(_:_:))
    }
```

### Step
Below `updateBlurRadius(_:_:)`, add the `updateCoverOpacity(_:_:)` method with its documentation comment and an empty body.

The two parameters are the old phase and the new phase. This is the form that [`onChange(of:initial:_:)`](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)) gives to its action. The method needs only the new phase.

```swift file=AVCam/Views/PreviewContainer.swift highlight=7-13
    func updateBlurRadius(_: Bool, _ isSwitching: Bool) {
        withAnimation {
            blurRadius = isSwitching ? 30 : 0
        }
    }

    /// Covers the preview as the app enters the background, and reveals it on return.
    ///
    /// A preview that isn't covered on the way out reappears holding the frame it last
    /// rendered. Covering it first means a person doesn't see that stale frame, and the
    /// reveal fades the cover away as live frames resume.
    func updateCoverOpacity(_: ScenePhase, _ phase: ScenePhase) {
    }

    var aspectRatio: AspectRatio {
        camera.captureMode == .photo ? photoAspectRatio : movieAspectRatio
    }
}
```

### Step
In the method, make the cover opaque when the scene goes to the background.

There is no animation here. The app leaves the screen at this moment, and it has no time to show a transition. The `default` case ignores the `inactive` phase, so the cover does not appear while the scene is only inactive, for example in the app switcher.

```swift file=AVCam/Views/PreviewContainer.swift highlight=2-7
    func updateCoverOpacity(_: ScenePhase, _ phase: ScenePhase) {
        switch phase {
        case .background:
            coverOpacity = 1
        default:
            break
        }
    }
```

### Step
Fade the cover out when the scene becomes active again.

The session starts again when the app returns, and the first new frames need a moment. The fade of 0.3 seconds hides the old frame during this moment, and the code needs no signal from the camera.

```swift file=AVCam/Views/PreviewContainer.swift highlight=5-8
    func updateCoverOpacity(_: ScenePhase, _ phase: ScenePhase) {
        switch phase {
        case .background:
            coverOpacity = 1
        case .active:
            withAnimation(.easeIn(duration: 0.3)) {
                coverOpacity = 0
            }
        default:
            break
        }
    }
```

### Step
In `previewView`, call the method each time the scene phase changes.

The method reference has the same form as the two references to `updateBlurRadius(_:_:)` above it.

```swift file=AVCam/Views/PreviewContainer.swift highlight=8
    /// Attach animations to the camera preview.
    var previewView: some View {
        content
            .blur(radius: blurRadius, opaque: true)
            .overlay(Color.black.opacity(coverOpacity))
            .onChange(of: camera.isSwitchingModes, updateBlurRadius(_:_:))
            .onChange(of: camera.isSwitchingVideoDevices, updateBlurRadius(_:_:))
            .onChange(of: scenePhase, updateCoverOpacity(_:_:))
    }
```

### Step
Build and run the app. Go to the Home Screen, and then open the app again.

This tutorial did not test the cover. The expected result on a real iPhone: the preview area is black for a moment when the app returns, and then the live preview fades in. You do not see the frame from before you left the app.

```settings title="Checkpoint"
Action: Product > Run (Command-R), go to the Home Screen, then open the app again
Expected: The preview area is black for a moment, and then the live preview fades in.
Note: This tutorial did not test this step.
```

### Experiment
On a real iPhone, put a comment in front of the `.overlay(Color.black.opacity(coverOpacity))` line. Run the app, point the camera at one object, go to the Home Screen, point the camera at a different object, and open the app again. Look for the old frame in the first moment. Then remove the comment.

### Text
The app now handles the events that a session does not control. In the next chapter, you connect the hardware buttons of the iPhone and the AirPods to the capture code.

## Check your understanding

### The interruption task sets `isInterrupted` to `true` for two reasons only. Why does it not use `true` for each interruption?

- [ ] The other reasons do not stop the session, so there is nothing to report.
  > The other reasons are real interruptions too. The camera is not available during them.
- [x] Each move of the app to the background is also an interruption, and the person must not see a message for that.
  > Correct. The background reason is a normal event. The code reports only the cases in which a different client uses the microphone or the camera.
- [ ] The notification has no reason on iPhone, so the code cannot read it.
  > The notification contains the reason in its `userInfo` dictionary. The two `compactMap` calls read it.

### The session stops in two different situations: a phone call, and a media services reset. What must the app do to get a running session again?

- [ ] It must call `startRunning()` in the two situations.
  > After an interruption, the system starts the session again. The app only updates its interface.
- [ ] It must do nothing in the two situations. The system always starts the session again.
  > That is true for an interruption only. After a runtime error, the session stays stopped until the app acts.
- [x] After the phone call, nothing. After the reset, it must call `startRunning()` again.
  > Correct. An interruption ends by itself. A runtime error leaves the session stopped, and the reset is the one error for which the sample starts the session again.

### You delete the two deferred start lines from `setUpSession()` and build the app with the iOS 26 SDK. What changes at launch?

- [x] Nothing. The two values are the defaults for an app that is built with this SDK.
  > Correct. The session is in automatic mode, and the photo output is deferred when it supports that. The lines only make the behavior visible in the code.
- [ ] The session prepares the photo output before the first preview frame, so the preview appears later.
  > That is the behavior with `isDeferredStartEnabled` set to `false`. If you delete the line, the output keeps its default value, which is `true` when the output supports deferred start.
- [ ] The first photo fails, because the photo output is never prepared.
  > A capture request before the deferred start makes the session prepare the output immediately. And without the lines, the defaults still apply.
