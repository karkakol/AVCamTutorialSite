# 04 — System integration dossier (AVCam)

Scope: hardware capture events, AirPods, the Camera Control, the Lock Screen capture extension, the capture intent, the Control Center control, and the Xcode project setup for these.
Out of scope: session and device basics, photo capture, video capture, deferred start (other dossiers).

## How to read this file

- **Sample paths** are relative to `/Users/karolkakol/tutorials/AVCamBuildingACameraApp` and use the form `path:line`.
- **SDK** means the installed `iPhoneOS27.1.sdk` (Xcode 27.1, build 27A9269). All API names and availability in this file come from its headers and `.swiftinterface` files, unless a line says otherwise.
- **[DOC]** = fact read from Apple documentation JSON. **[WWDC]** = fact read from a session transcript. **[INFERENCE]** = my reasoning, not stated by Apple. **[UNVERIFIED]** = I could not confirm it; test on a device.
- All Swift snippets that are not copied from the sample were type-checked with `swiftc -typecheck -target arm64-apple-ios26.0` against the installed SDK. They were not run on a device.

### Facts that affect the whole tutorial

1. **The README is out of date.** `README.md:17` says "iOS 18 or later". The project deployment target is iOS 26.0 for all three targets (`AVCam.xcodeproj/project.pbxproj:635, 718, 837, 936`). The code calls iOS 26 API with no availability checks. The online sample page says "iOS 26 or later" in its text, and its metadata lists iOS 27.0 / Xcode 27.0.
2. **"WWDC26 session 303" is "Build a responsive camera app that launches quickly".** It covers deferred start, responsive capture, preview rendering, and sustained performance. It adds nothing to the topics in this file. The only change it made to the extension was `import ExtensionKit` (`AVCamCaptureExtension/AVCamCaptureExtension.swift:8`).
3. **The README says nothing about system integration.** The only mention is one paragraph (`README.md:19`). Every explanation in this file comes from the code, the SDK, the articles, and the sessions.
4. **AirPods features are region-locked.** The SDK headers say AirPods Camera Control "is not currently available in the European Union". The `bluetoothHighQualityRecording` documentation says the same about high-quality recording. A learner in the EU cannot test sections 2a and 2b on a device.
5. **The sample has no entitlements file and no App Group.** LockedCameraCapture needs neither (section 7).

---

## 1. Hardware capture events

### 1a. Concept

A camera app wants the hardware buttons to work as a shutter. iOS gives one API for this. The API is in **AVKit**, not AVFoundation.

- UIKit: `AVCaptureEventInteraction`, a `UIInteraction` that you add to a view. iOS 17.2+.
- SwiftUI: the `onCameraCaptureEvent` view modifier. iOS 18.0+. It lives in the cross-import module `_AVKit_SwiftUI`, so the file must import both `SwiftUI` and `AVKit` (`AVCam/CameraView.swift:8-10`).

Both give the same behavior [WWDC25-253].

When the interaction is active, it **replaces** the default button behavior. The volume buttons stop changing the volume. The app must then always answer the event. If the app cannot answer, it must disable the interaction, and the system behavior comes back.

The system sends events only when all of these are true [DOC, WWDC25-253]:

- The app is in the foreground.
- The app is actively using the camera. In practice this means a running `AVCaptureSession`.
- The API is used for media capture only.

If one source starts an event, the system ignores other sources until the first event ends or is cancelled [DOC, single-action variant].

### 1b. Which hardware triggers it

| Source | Handler | Since | Source of the fact |
|---|---|---|---|
| Volume down | primary | iOS 17.2 | WWDC25-253 |
| Volume up | secondary. Falls back to primary when there is no secondary handler | iOS 17.2 | WWDC25-253 |
| Action button | primary | — | WWDC25-253 |
| Camera Control (full click) | primary | iOS 18, iPhone 16 | WWDC25-253 |
| AirPods stem click (H2 chip) | primary | iOS 26 | WWDC25-253 |
| AirPods Max 2 Digital Crown | primary [INFERENCE from the support page] | iOS 26 | Apple Support |

The same button never calls both handlers [WWDC25-253].
Third-party Bluetooth shutter remotes: [UNVERIFIED]. No Apple source mentions them.

### 1c. Key APIs (exact declarations from the SDK)

`AVKit/AVCaptureEvent.h`:

```objc
typedef NS_ENUM(NSUInteger, AVCaptureEventPhase) {
    AVCaptureEventPhaseBegan,      // Swift: .began
    AVCaptureEventPhaseEnded,      // Swift: .ended
    AVCaptureEventPhaseCancelled,  // Swift: .cancelled
} API_AVAILABLE(ios(17.2));

API_AVAILABLE(ios(17.2))
@interface AVCaptureEvent : NSObject
@property (nonatomic, readonly) AVCaptureEventPhase phase;
- (BOOL)playSound:(AVCaptureEventSound *)sound API_AVAILABLE(ios(26.0)) API_UNAVAILABLE(visionos, macCatalyst);
@property (nonatomic, readonly) BOOL shouldPlaySound API_AVAILABLE(ios(26.0)) API_UNAVAILABLE(visionos, macCatalyst);
@end
```

Swift names: `event.phase`, `event.shouldPlaySound`, `event.play(_:) -> Bool`.

`AVKit/AVCaptureEventInteraction.h`:

```objc
API_AVAILABLE(ios(17.2))
@interface AVCaptureEventInteraction : NSObject <UIInteraction>
- (instancetype)initWithEventHandler:(void (^)(AVCaptureEvent *event))handler
        NS_SWIFT_NAME(init(handler:));
- (instancetype)initWithPrimaryEventHandler:(void (^)(AVCaptureEvent *event))primaryHandler
                      secondaryEventHandler:(void (^)(AVCaptureEvent *event))secondaryHandler
        NS_SWIFT_NAME(init(primary:secondary:));
@property (nonatomic, readwrite, getter=isEnabled) BOOL enabled;
@property (class, nonatomic, readwrite) BOOL defaultCaptureSoundDisabled API_AVAILABLE(ios(26.0));
@end
```

Note: `defaultCaptureSoundDisabled` is a **class** property. In UIKit it is a global switch for the process. In SwiftUI it is a parameter of the modifier.

`AVKit/AVCaptureEventSound.h` (iOS 26.0):

```objc
@interface AVCaptureEventSound : NSObject
- (nullable instancetype)initWithURL:(NSURL *)url error:(NSError **)error;   // Swift: init(url:) throws
@property (class, readonly) AVCaptureEventSound *cameraShutterSound;         // Swift: .cameraShutter
@property (class, readonly) AVCaptureEventSound *beginVideoRecordingSound;   // Swift: .beginVideoRecording
@property (class, readonly) AVCaptureEventSound *endVideoRecordingSound;     // Swift: .endVideoRecording
@end
```

The URL for a custom sound must be inside the app bundle [SDK header comment].

`_AVKit_SwiftUI.swiftinterface` — there are **six** overloads:

```swift
// iOS 18.0
func onCameraCaptureEvent(isEnabled: Bool = true,
                          primaryAction: @escaping (AVCaptureEvent) -> Void,
                          secondaryAction: @escaping (AVCaptureEvent) -> Void) -> some View
func onCameraCaptureEvent(isEnabled: Bool = true,
                          action: @escaping (AVCaptureEvent) -> Void) -> some View

// iOS 26.0
func onCameraCaptureEvent(isEnabled: Bool = true, defaultSoundDisabled: Bool = false,
                          primaryAction: @escaping (AVCaptureEvent) async -> Void,
                          secondaryAction: @escaping (AVCaptureEvent) async -> Void) -> some View
func onCameraCaptureEvent(isEnabled: Bool = true, defaultSoundDisabled: Bool = false,
                          action: @escaping (AVCaptureEvent) async -> Void) -> some View
func onCameraCaptureEvent(isEnabled: Bool = true, defaultSoundDisabled: Bool = false,
                          primaryAction: @escaping (AVCaptureEvent) -> Void,
                          secondaryAction: @escaping (AVCaptureEvent) -> Void) -> some View
func onCameraCaptureEvent(isEnabled: Bool = true, defaultSoundDisabled: Bool = false,
                          action: @escaping (AVCaptureEvent) -> Void) -> some View
```

All are `@MainActor @preconcurrency`.
The online documentation lists only the synchronous overloads. The **`async` closure overloads exist only in the SDK interface**. AVCam uses one of them: its closure contains `await` (`AVCam/CameraView.swift:30-49`), so the compiler selects `action: (AVCaptureEvent) async -> Void`.

Parameters:

- `isEnabled` — set to `false` when the app cannot answer. The buttons then do their system job.
- `defaultSoundDisabled` — `false` (default): the system plays a default tone in the AirPods for a stem click. `true`: the app must play the sound with `event.play(_:)`.
- `action` — called for primary and secondary events.
- `primaryAction` / `secondaryAction` — called separately.

Sound rules (iOS 26) [SDK header + DOC]:

- `event.shouldPlaySound` is `true` only when **both** are true: the event came from an AirPods stem click, **and** the app disabled the default sound.
- `event.play(_:)` does nothing when `shouldPlaySound` is `false`.
- `event.play(_:)` does nothing when the event object is older than **15 seconds**.
- The sound plays through the AirPods. It is feedback for a person who is not looking at the screen.

### 1d. What AVCam does, and why

`AVCam/CameraView.swift:28-49`:

- The modifier is on `CameraPreview`, the view that shows the capture preview.
- `defaultSoundDisabled: true`, so the app selects the sound that matches the mode.
- The code acts only on `.ended` ("press up"). This matches the system Camera for a single click.
- Photo mode: `await camera.capturePhoto()`, sound `.cameraShutter`.
- Video mode: `await camera.toggleRecording()`. The sound is `.endVideoRecording` when a recording is in progress, and `.beginVideoRecording` when it is not. The code reads `captureActivity.isRecording` **before** the toggle (`CameraView.swift:39-40`). This order is necessary.
- After the action, `if event.shouldPlaySound { event.play(sound) }` (`CameraView.swift:45-47`).

Why this design:

- One `action` closure covers all sources. The sample does not need different behavior for volume up.
- The same call site (`camera.capturePhoto()`, `camera.toggleRecording()`) is used by the on-screen button. Hardware and screen paths stay the same.
- The capture extension **must** use this API or the system terminates it (section 4). Because `CameraView` is shared with the extension, the extension gets it for free.

History: before the WWDC25 update (commit `c93a0f0`) the sample used the synchronous overload, `.onCameraCaptureEvent { event in Task { ... } }`. The iOS 26 `async` overload removed the need for the `Task`.

Alternatives:

- UIKit: `view.addInteraction(AVCaptureEventInteraction(...))`.
- Before iOS 17.2 there was no public API. Apps observed the output volume. Do not teach this.

### 1e. Pitfalls

1. **The sound plays late in AVCam.** `event.play(sound)` runs after `await camera.capturePhoto()`. That call also waits for a location fix and for the save to Photos (`AVCam/CameraModel.swift:125-133`, `AVCam/Model/MediaLibrary.swift:53-54, 130-137`). The feedback tone arrives after the save, not at the shutter moment. If the work takes more than 15 seconds, `play` does nothing. A tutorial improvement: play the sound first, then capture. The WWDC25 example plays the sound in the handler without long work before it. [INFERENCE from the code]
2. **Dead buttons.** The modifier overrides the volume buttons. AVCam never passes `isEnabled: false`. During a mode switch or when the camera failed to start, a press does nothing useful. Better: `isEnabled: camera.status == .running && !camera.isSwitchingModes`. [INFERENCE]
3. **No events without a running session.** Events do not arrive in SwiftUI previews, in Simulator, before `startRunning()`, or in the background.
4. **`.cancelled` is ignored.** That is correct for click-to-capture. If the tutorial adds press-and-hold (start on `.began`), it must stop on `.cancelled` too.
5. **`shouldPlaySound` is `false` for volume buttons.** Do not use it to decide whether to play the normal shutter sound. `AVCapturePhotoOutput` plays that sound itself.
6. **Wrong import.** `import AVFoundation` alone does not give `AVCaptureEvent` or the modifier. `import AVKit` is required.
7. **Mac Catalyst.** The headers mark the iOS 26 sound API `API_UNAVAILABLE(macCatalyst)`. The documentation metadata lists Mac Catalyst 26.0. Trust the header.

### 1f. Capabilities beyond AVCam

- Separate primary and secondary actions. Example: volume up switches the camera.
- Use `.began` for press-and-hold: start a timer on `.began`, record video if the button is still down, take a photo on a short `.ended`. The system Camera does this [WWDC25-253 demo].
- Custom sound from the bundle: `try AVCaptureEventSound(url:)`.
- Keep the default AirPods tone: omit `defaultSoundDisabled`.

Type-checked sketch:

```swift
CameraPreview(source: camera.previewSource)
    .onCameraCaptureEvent(isEnabled: isReady, defaultSoundDisabled: true) { event in
        // Primary: volume down, Action button, Camera Control, AirPods stem.
        guard event.phase == .ended else { return }
        if event.shouldPlaySound { event.play(.cameraShutter) }
        await camera.capturePhoto()
    } secondaryAction: { event in
        // Secondary: volume up.
        guard event.phase == .ended else { return }
        await camera.switchVideoDevices()
    }
```

### 1g. Documentation

See the "Verified links" table: AVCaptureEventInteraction, AVCaptureEvent, AVCaptureEventPhase, AVCaptureEventSound, the four `onCameraCaptureEvent` pages, WWDC25 session 253.

---

## 2. AirPods

There are two separate features. Both arrived in iOS 26 (WWDC25). AVCam adopted both in commit `c93a0f0`.

### 2a. Remote capture with a stem click

Concept: a person clicks the stem of an AirPod and the app captures. The event arrives through the same `AVCaptureEventInteraction` / `onCameraCaptureEvent` path, as a **primary** action. Apps that already used the API got the feature with no code change in iOS 26 [WWDC25-253].

User setup [Apple Support, verified]:

1. Wear the AirPods and connect them.
2. Settings > (name of the AirPods) > **Camera Remote**. If it is not there, tap **Controls & Gestures** first.
3. Select **Press Once** or **Press and Hold**.
4. Open a supported camera app and press the stem.

Supported hardware [Apple Support]: AirPods 4, AirPods 5, AirPods Pro 2, AirPods Pro 3, AirPods Max 2 (Digital Crown). WWDC25-253 says "AirPods equipped with the H2 chip".

Side effect: with "Press Once", media gestures are off while a supported camera app is in use. With "Press and Hold", listening-mode and Siri gestures are off [Apple Support].

The only new developer work is the sound: `defaultSoundDisabled`, `shouldPlaySound`, `play(_:)`, `AVCaptureEventSound` (section 1c).

Why AVCam disables the default sound: the default tone is the same for every action. AVCam has three actions (photo, start video, stop video) and uses the three matching system sounds (`AVCam/CameraView.swift:30-47`).

Pitfalls:

- Not available in the EU (SDK header note on every one of these symbols).
- A missing sound is a real usability bug here. The person is away from the screen and has no other feedback [SDK header: "Omitting the sound when expected can significantly impact the user experience"].
- The 15-second limit and the late sound in AVCam (pitfall 1 in section 1e).

### 2b. AirPods as a high-quality microphone

Concept: classic Bluetooth recording uses the HFP profile, which has low audio quality. iOS 26 adds a high-quality, high-sample-rate Bluetooth recording mode for supported AirPods. Apple calls the tuning "like a lav microphone" [WWDC25-251].

Exact declaration, `AVFoundation/AVCaptureSession.h:569`:

```objc
@property(nonatomic) BOOL configuresApplicationAudioSessionForBluetoothHighQualityRecording
    API_AVAILABLE(ios(26.0)) API_UNAVAILABLE(macos, macCatalyst, tvos, visionos);
```

- Default: `false`.
- No effect when `usesApplicationAudioSession` is `false`.
- When `true`, the capture session opts the app's audio session in to high-quality Bluetooth recording. The person can then select AirPods as the microphone.

AVCam: one line in `setUpSession()`, before it adds the inputs (`AVCam/CaptureService.swift:127-128`).

The `AVAudioSession` equivalent, `AVFAudio/AVAudioSessionTypes.h:635`:

```objc
AVAudioSessionCategoryOptionBluetoothHighQualityRecording
    API_AVAILABLE(ios(26.0)) API_UNAVAILABLE(watchos, tvos, macCatalyst, visionos, macos) = 1 << 19
```

Swift: `AVAudioSession.CategoryOptions.bluetoothHighQualityRecording`. Rules from the header and the documentation:

- Use it with a category that has input and output, for example `.playAndRecord`.
- It works only with mode `.default`.
- Alone: used when the route supports it, ignored otherwise.
- With `.allowBluetoothHFP`: HFP is the fallback when the route does not support high quality.
- It can increase input latency. Do not use it for real-time communication.
- Consider `setPrefersNoInterruptionsFromSystemAlerts(true)` during a recording, so a ringtone does not interrupt it.

Type-checked sketch for an app that manages the audio session itself:

```swift
captureSession.automaticallyConfiguresApplicationAudioSession = false
let audio = AVAudioSession.sharedInstance()
try audio.setCategory(.playAndRecord, mode: .default,
                      options: [.bluetoothHighQualityRecording, .allowBluetoothHFP])
if let port = audio.currentRoute.inputs.first,
   let mic = port.bluetoothMicrophoneExtension {      // AVAudioSessionPortExtensionBluetoothMicrophone
    _ = mic.highQualityRecording.isSupported           // AVAudioSessionCapability
    _ = mic.highQualityRecording.isEnabled
}
```

Why AVCam uses the capture-session property: AVCam lets `AVCaptureSession` own the audio session (`automaticallyConfiguresApplicationAudioSession` stays `true`). One Boolean is then enough. The manual route is for apps that already configure `AVAudioSession` themselves.

How the person selects the AirPods as input:

- System UI: Control Center > Camera Controls > Input [Apple Support]. With the option enabled, the system input menu lists high-quality AirPods [WWDC25-251].
- In-app: `AVInputPickerInteraction` (AVKit, iOS 26). AVCam does **not** use it.

Pitfalls:

- Setting the property does **not** switch the input. The person selects it. Without the selection, the built-in microphone records.
- Not available in the EU.
- AVCam sets the property unconditionally. This is safe because the deployment target is iOS 26. A project with a lower target needs `if #available(iOS 26, *)`.
- AVCam never checks `highQualityRecording.isEnabled`. The UI does not show which microphone is active.

---

## 3. The Camera Control

### 3a. Concept

The Camera Control is a hardware control on the side of iPhone 16 models and later. HIG: "Not supported in iPadOS, macOS, watchOS, tvOS, or visionOS". Exact model list: [UNVERIFIED]; the support page only says "supported models".

It does three jobs [WWDC25-253]. Each job uses a **different** API:

| Job | API | Section |
|---|---|---|
| Launch the app, also from a locked device | LockedCameraCapture capture extension | 4 |
| Shutter (full click) | `AVCaptureEventInteraction` / `onCameraCaptureEvent`, primary action | 1 |
| Adjust settings (light press, slide) | `AVCaptureControl` objects added to the `AVCaptureSession` | this section |

Gestures [HIG + WWDC25-253 + Apple Support]:

- **Click**: capture event (section 1). In the system Camera, click-and-hold records video.
- **Light press**: shows an overlay next to the control with the current setting. The preview becomes "clean".
- **Slide** on the control: changes the value of the selected setting.
- **Light double press**: shows the list of controls. Slide to scroll, light press to select.
- The system remembers the last control the person used in the app [HIG].

Which gesture produces the "active" callbacks and which produces the "fullscreen" callbacks is not documented precisely. [UNVERIFIED — log the four delegate calls on a device.]

### 3b. Every capture-control class in the SDK

I searched all AVFoundation headers. These are the only classes:

| Class | Header | Availability | Purpose |
|---|---|---|---|
| `AVCaptureControl` | `AVCaptureControl.h` | iOS 18.0, macOS 15.0, Mac Catalyst 18.0, tvOS 18.0 | Abstract base class. `init` unavailable. One property: `isEnabled` |
| `AVCaptureSystemZoomSlider` | `AVCaptureSystemZoomSlider.h` | same | System zoom. Drives `videoZoomFactor` |
| `AVCaptureSystemExposureBiasSlider` | `AVCaptureSystemExposureBiasSlider.h` | same | System exposure bias. Drives `exposureTargetBias` |
| `AVCaptureSlider` | `AVCaptureSlider.h` | same | Custom slider, continuous or discrete, one `Float` |
| `AVCaptureIndexPicker` | `AVCaptureIndexPicker.h` | same | Custom picker by zero-based index |

Plus the protocol `AVCaptureSessionControlsDelegate` in `AVCaptureSession.h`.

**There are no new control classes in the iOS 26 or iOS 27 headers.** The system Camera has Depth, Styles, Tone, and Cameras controls [Apple Support]. Those are not public API.

`AVCaptureToggle` is named in a header comment (`AVCaptureSession.h:428`) and in the `.tbd` export list. It has **no public header**. Do not teach it.

### 3c. Key APIs

`AVCaptureSession` (all iOS 18.0):

```swift
var supportsControls: Bool { get }          // true only on hardware with a Camera Control
var maxControlsCount: Int { get }
var controls: [AVCaptureControl] { get }
func canAddControl(_ control: AVCaptureControl) -> Bool
func addControl(_ control: AVCaptureControl)        // throws an ObjC exception if canAddControl is false
func removeControl(_ control: AVCaptureControl)
func setControlsDelegate(_ controlsDelegate: (any AVCaptureSessionControlsDelegate)?, queue: DispatchQueue?)
var controlsDelegate: (any AVCaptureSessionControlsDelegate)? { get }
var controlsDelegateCallbackQueue: DispatchQueue? { get }
```

Header rules:

- "A controls delegate must be specified for controls to become active." No delegate, no overlay.
- The delegate queue must be serial. It can be `nil` only when the delegate is `nil`.
- `addControl` and `removeControl` can be called while the session runs.
- `AVCaptureSlider` and `AVCaptureIndexPicker` "must have an action and an action queue set before being added to a session". If not, `canAddControl` returns `false`.
- `canAddControl` also returns `false` when the session is at `maxControlsCount` [DOC], and for a second system zoom control on a device that already has one [WWDC25-253].

`AVCaptureSessionControlsDelegate` — four methods, all `@required`:

```swift
func sessionControlsDidBecomeActive(_ session: AVCaptureSession)
func sessionControlsWillEnterFullscreenAppearance(_ session: AVCaptureSession)
func sessionControlsWillExitFullscreenAppearance(_ session: AVCaptureSession)
func sessionControlsDidBecomeInactive(_ session: AVCaptureSession)
```

- Active / inactive: the controls are available for interaction, or are dismissed.
- Enter fullscreen: the app should hide parts of its UI. The header names "zoom or exposure sliders and shutter buttons".
- Exit fullscreen: restore the UI. This arrives **before** `sessionControlsDidBecomeInactive`.

System sliders:

```swift
AVCaptureSystemZoomSlider(device: AVCaptureDevice)
AVCaptureSystemZoomSlider(device: AVCaptureDevice, action: @escaping @MainActor (CGFloat) -> Void)
AVCaptureSystemExposureBiasSlider(device: AVCaptureDevice)
AVCaptureSystemExposureBiasSlider(device: AVCaptureDevice, action: @escaping @MainActor (Float) -> Void)
```

- The range comes from the device's `activeFormat`: `systemRecommendedVideoZoomRange` and `systemRecommendedExposureBiasRange`. The slider updates its range when the active format changes.
- The slider sets the device property itself. The `action` is for UI updates only. It runs on the main actor. Do not set the device property inside it.
- The `action` runs **only** for changes made by this control. For other changes, such as a pinch or `ramp(toVideoZoomFactor:withRate:)`, use key-value observation.
- The initializer throws an ObjC exception when the device does not support the property.
- For a zoom label, multiply by `device.displayVideoZoomFactorMultiplier` [DOC article].

`AVCaptureSlider` (Swift overlay in `AVFoundation.swiftinterface`):

```swift
convenience init(_ localizedTitle: String, symbolName: String, in range: ClosedRange<Float>)               // continuous
convenience init(_ localizedTitle: String, symbolName: String, in range: ClosedRange<Float>, step: Float)  // discrete, fixed step
convenience init(_ localizedTitle: String, symbolName: String, values: [Float])                            // discrete, listed values
var value: Float                      // change it only on the action queue
var prominentValues: [Float]          // values the slider lands on more easily
var localizedValueFormat: String?     // only "%@" as placeholder, for example "%@ fps"
var localizedTitle: String { get }
var symbolName: String { get }        // SF Symbols only
var accessibilityIdentifier: String?
func setActionQueue(_ actionQueue: DispatchQueue, action: @escaping (Float) -> ())
```

`AVCaptureIndexPicker`:

```swift
init(_ localizedTitle: String, symbolName: String, numberOfIndexes: Int)
init(_ localizedTitle: String, symbolName: String, numberOfIndexes: Int, localizedTitleTransform: (Int) -> String)
init(_ localizedTitle: String, symbolName: String, localizedIndexTitles: [String])
var selectedIndex: Int                // change it only on the action queue
var numberOfIndexes: Int { get }
var localizedIndexTitles: [String] { get }
func setActionQueue(_ actionQueue: DispatchQueue, action: @escaping (Int) -> ())
```

`setActionQueue` header rule: "If `action` modifies a property of the camera system, `actionQueue` must represent the same exclusive execution context as the camera system."

### 3d. What AVCam does, and why

**Setup** — `configureControls(for:)`, `AVCam/CaptureService.swift:201-228`:

1. `guard captureSession.supportsControls` (`:204`). On iPad and on older iPhones the method returns here.
2. `beginConfiguration()` (`:207`).
3. Remove every control now on the session (`:210-212`).
4. For each control from `createControls(for:)`: `canAddControl`, then `addControl`. A failure is logged (`:215-221`).
5. `setControlsDelegate(controlsDelegate, queue: sessionQueue)` (`:224`).
6. `commitConfiguration()` (`:227`).

It is called from `setUpSession()` for the default camera (`:154`) and from `changeCaptureDevice(to:)` for a new camera (`:339`). In the second case it runs inside the caller's begin/commit pair. The pairs nest.

**The controls** — `createControls(for:)`, `:230-262`:

- `AVCaptureSystemZoomSlider(device:)` and `AVCaptureSystemExposureBiasSlider(device:)` (`:235-236`). No action closure, because AVCam has no zoom or exposure UI to keep in sync.
- If `device.isLockingFocusWithCustomLensPositionSupported`: a custom slider `AVCaptureSlider("Lens Position", symbolName: "circle.dotted.circle", in: 0...1)` (`:241`). Its action locks the device and calls `setFocusModeLocked(lensPosition:)` (`:243-251`).

**The queue design** — this is the expert point:

- `CaptureService` is an actor. Its executor is a serial dispatch queue: `sessionQueue` (`:68`) and `unownedExecutor` (`:71-73`).
- The custom slider's action runs on `sessionQueue` (`:243`).
- The controls delegate is called on `sessionQueue` (`:224`).
- So slider actions, delegate callbacks, and all actor methods run on **one** serial queue. That satisfies the "same exclusive execution context" rule in the header. Apple's Camera Control article shows this exact pattern.
- Alternative: a plain actor with the default executor. The action closure then needs `Task { await ... }` to get onto the actor. That adds a hop and loses ordering.

**Hiding the UI** — the chain for `prefersMinimizedUI`:

1. `CaptureControlsDelegate` (`AVCam/CaptureService.swift:582-603`) is an `NSObject` with `@Published private(set) var isShowingFullscreenControls`. It sets `true` in `sessionControlsWillEnterFullscreenAppearance` (`:590-593`) and `false` in `sessionControlsWillExitFullscreenAppearance` (`:595-598`). The active and inactive callbacks only log.
2. `observeCaptureControlsState()` republishes the value on the actor (`:545-548`, property at `:25`).
3. `CameraModel.observeState()` reads `captureService.$isShowingFullscreenControls.values` and sets `prefersMinimizedUI` inside `withAnimation` (`AVCam/CameraModel.swift:226-234`, property at `:33`).
4. Four views fade out with `.opacity(camera.prefersMinimizedUI ? 0 : 1)`: `AVCam/Views/Controls/CaptureModeView.swift:42`, `AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift:34`, `AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift:23` (thumbnail) and `:33` (switch-camera button).
5. `prefersMinimizedUI` is part of the `Camera` protocol (`AVCam/Model/Camera.swift:36`). The preview model returns a constant (`AVCam/Preview Content/PreviewCameraModel.swift:15`).

Why hide the UI: the system overlay is drawn over the app, next to the Camera Control. The header and the HIG ask apps to show few on-screen elements, so that the person sees the control and an unobstructed preview. HIG: "Minimize distractions in the viewfinder" and "Avoid duplicating controls".
Note: the header also lists shutter buttons. AVCam keeps its `CaptureButton` visible (`MainToolbar.swift:29`). The property name says "minimized", not "hidden".

**Why the sample caches controls per `device.uniqueID`** (`controlsMap`, `:65`, `:232`, `:256`) [INFERENCE — the code has no comment on the reason]:

1. System controls are bound to one `AVCaptureDevice` at creation. Front and back cameras need different instances. The custom slider's closure also captures `device` (`:243-246`).
2. A person can switch cameras many times. Without the cache, each switch creates new control objects and new closures.
3. Reuse keeps control state. A slider's `value` belongs to the instance. A new instance starts again at its minimum.
4. The session can refuse a second system zoom control for a device that already has one [WWDC25-253]. One instance per device prevents this case.

`uniqueID` is a stable `String` key.

### 3e. Pitfalls

1. **No delegate, no controls.** Controls do not activate without `setControlsDelegate`.
2. **`addControl` without `canAddControl`** raises an Objective-C exception. Swift cannot catch it.
3. **A custom control with no action** is not added.
4. **Controls cannot change while the overlay is in use** in a way the person sees as add/remove. HIG: "you can't remove or add controls at runtime". Prefer `control.isEnabled = false` for a control that does not apply to the current mode. If you remove a control, the system selects another as a fallback and the person is confused [WWDC25-253].
5. **Stale custom slider.** AVCam's "Lens Position" slider locks focus. A tap on the preview then resets focus to auto (`CaptureService.swift:454-479`). The slider keeps its old `value`. Apple's article says to update `value` when the state changes elsewhere. AVCam does not. [INFERENCE from the code]
6. **No return to autofocus.** After the person uses the lens slider, focus stays locked until a tap on the preview. [INFERENCE from the code]
7. **Stale app UI.** With a pinch-to-zoom gesture in the app, use the `action:` variant of the system slider or KVO. Without it the pinch starts from an old factor [WWDC25-253].
8. **`value` and `selectedIndex`** must be set on the action queue. An out-of-range value raises an exception.
9. **`localizedValueFormat`** accepts only `%@`. Other placeholders make the system fall back to the default presentation.
10. **Symbols**: SF Symbols names only. Custom symbols are not supported [HIG]. A symbol does not show the control's state.
11. **Do not start a capture session only to get the Camera Control** [WWDC25-253].
12. **Combine thread safety.** `CaptureControlsDelegate` uses `@Published` and is mutated on `sessionQueue`. This is safe only because the delegate queue is the actor's queue. The compiler does not check it: the app target uses `SWIFT_STRICT_CONCURRENCY = minimal` (`project.pbxproj:949, 996`).
13. **Testing** needs an iPhone with a Camera Control. `supportsControls` is `false` in Simulator and on iPad.

### 3f. Capabilities beyond AVCam

- `AVCaptureIndexPicker` for filters, flash modes, aspect ratios, camera selection.
- Discrete sliders (`step:` and `values:`), `prominentValues`, `localizedValueFormat`.
- `isEnabled` per mode.
- Action closures on the system sliders to keep an on-screen zoom label in sync.
- `maxControlsCount` to plan the control set.
- Order: put the most used controls in the middle [HIG].
- Leave space in the layout for the overlay in portrait and in landscape [HIG].

---

## 4. LockedCameraCapture and the capture extension

### 4a. Concept

A **locked camera capture extension** is an app extension that shows the app's camera UI while the device is locked. A person starts it from a control on the Lock Screen, in Control Center, on the Action button, or from the Camera Control. Framework: `LockedCameraCapture`, iOS 18.0+, Swift only.

It is an **ExtensionKit** extension, not a classic `NSExtension`:

- Product type `com.apple.product-type.extensionkit-extension` (`project.pbxproj:407`).
- `Info.plist` key `EXAppExtensionAttributes` > `EXExtensionPointIdentifier` = `com.apple.securecapture` (`AVCamCaptureExtension/Info.plist:5-9`).
- Embedded in the `Extensions` folder of the app bundle (`project.pbxproj:96-106`).

Life cycle [WWDC24-10204]:

1. **Launch** from a control. The system creates a `LockedCameraCaptureSession` and passes it to the scene.
2. **Capture** with the same UI as the app.
3. **Save** with PhotoKit, or write files to `session.sessionContentURL`.
4. Optional: **open the app** with `session.openApplication(for:)`. The system asks for Face ID or the passcode.
5. **Dismiss**: swipe up, side button, or the move to the app. The system moves the session content directory to the app container and erases the extension container.
6. Later the **app** reads the content with `LockedCameraCaptureManager`.

### 4b. Key APIs (complete public surface, from `LockedCameraCapture.swiftinterface`)

```swift
// iOS 18.0. Unavailable on macOS, Mac Catalyst, tvOS, watchOS, visionOS.
@MainActor public protocol LockedCameraCaptureExtension: AppExtension {
    associatedtype Body: LockedCameraCaptureExtensionScene
    @MainActor var body: Body { get }
}

@MainActor public protocol LockedCameraCaptureExtensionScene: AppExtensionScene {}

@MainActor public struct LockedCameraCaptureUIScene<Content: View>: LockedCameraCaptureExtensionScene {
    public let session: LockedCameraCaptureSession
    public init(content: @escaping (LockedCameraCaptureSession) -> Content)
}

final public class LockedCameraCaptureSession: Sendable {
    final public var sessionContentURL: URL { get }
    final public func openApplication(for userActivity: NSUserActivity) async throws
    final public func invalidateSessionContent() async throws
    public enum ApplicationLaunchError: CustomNSError, LocalizedError {
        case unknown, applicationNotFound, authenticationFailed
    }
}

// App side.
final public class LockedCameraCaptureManager: Sendable {
    public static let shared: LockedCameraCaptureManager
    final public var sessionContentURLs: [URL] { get }
    final public var sessionContentUpdates: some AsyncSequence<SessionContentUpdate, Never> { get }
    final public func invalidateSessionContent(at url: URL) async throws
    final public func beginDelayingAppearance()   // iOS 18.1
    final public func endDelayingAppearance()     // iOS 18.1
    public enum SessionContentUpdate: Sendable {
        case initial(urls: [URL]), added(url: URL), removed(url: URL)
    }
}
```

Also: the global constant `NSUserActivityTypeLockedCameraCapture: String`.

**No API was added to this framework after iOS 18.1.** The iOS 27.1 SDK interface is the same.

`sessionContentURL` [DOC]: a temporary directory in the extension's data container. When the extension is suspended, the system copies this directory to the containing app's container, then erases the extension container. After a crash the system still copies it [WWDC24].

`invalidateSessionContent()` [DOC]: deletes the content of the directory, not the directory. Use it after PhotoKit took the files.

### 4c. Restrictions on a locked device

From the article and WWDC24-10204:

- **No network.**
- **No App Group container.** No read, no write. No shared preferences.
- **The extension container is erased** when the extension is suspended. Only `sessionContentURL` survives, and it moves to the app. The extension cannot read data from an earlier launch.
- **Viewfinder immediately.** The extension must show a camera viewfinder at launch.
- **`AVCaptureEventInteraction` is mandatory.** Article: the extension "terminates shortly after launch if it doesn't have an active camera view that uses `AVCaptureEventInteraction` to handle events from the hardware buttons, or if access to the camera hasn't been requested". The SwiftUI modifier satisfies this rule: AVCam's extension uses only `onCameraCaptureEvent`, and WWDC25-253 says the modifier and the UIKit class give the same behavior.
- **Permissions are inherited from the app** (Camera and Photos). If the app has no camera permission, the system asks the person to unlock and opens the **app**, not the extension.
- **Photos while locked**: write is allowed. Read returns only the assets created in the current capture session. When the device is unlocked, the extension reads everything the app's permission allows.
- **The same rules apply when the device is unlocked.** The extension still runs from the Lock Screen and has the same limits [WWDC24].
- **4 kB** limit for the shared state (section 5).
- **Usage descriptions**: the app **and** the extension must both have `NSCameraUsageDescription` [WWDC24].
- `openApplication(for:)` should be called only after a person's action, for example a button tap [WWDC24].

### 4d. How captured content reaches Photos or the app

Two paths. An app can use both.

**Path A — PhotoKit directly.** Apple recommends it for photos and videos [WWDC24]. `PHPhotoLibrary.shared().performChanges` works when the device is locked.

**Path B — files in `sessionContentURL`.** For data PhotoKit does not hold: drafts, edits, sidecar files. The app later ingests them. Type-checked sketch:

```swift
// In the app, for example in a .task on the root view.
for await update in LockedCameraCaptureManager.shared.sessionContentUpdates {
    switch update {
    case .initial(let urls):
        for url in urls {
            // Import the files, then tell the system the directory is done.
            try? await LockedCameraCaptureManager.shared.invalidateSessionContent(at: url)
        }
    case .added(let url):
        _ = url     // A directory from a session that just ended.
    case .removed:
        break       // Also sent after invalidateSessionContent(at:).
    @unknown default:
        break
    }
}
```

The newest directory can arrive shortly **after** the app launches. That is why Apple recommends the async sequence over the `sessionContentURLs` array [WWDC24].

**Open the app from the extension.** Type-checked sketch:

```swift
let activity = NSUserActivity(activityType: NSUserActivityTypeLockedCameraCapture)
activity.userInfo = ["action": "showLastCapture"]
do {
    try await session.openApplication(for: activity)
} catch let error as LockedCameraCaptureSession.ApplicationLaunchError {
    // .authenticationFailed is the common case: the person cancelled Face ID.
    print(error.failureReason ?? "")
} catch { }
```

The app receives the activity through its normal continuation path, for example `onContinueUserActivity(NSUserActivityTypeLockedCameraCapture)`.

**Documentation bug**: the sample code in Apple's article assigns the type constant (a `String`) to `activity` and then sets `activity.userInfo`. That does not compile. Use `NSUserActivity(activityType:)` as above.

### 4e. What AVCam does

`AVCamCaptureExtension/AVCamCaptureExtension.swift:14-29` is the whole extension:

```swift
@main
struct AVCamCaptureExtension: LockedCameraCaptureExtension {
    @State private var camera = CameraModel()
    var body: some LockedCameraCaptureExtensionScene {
        LockedCameraCaptureUIScene { session in
            CameraView(camera: camera)
                .statusBarHidden(true)
                .task { await camera.start() }
        }
    }
}
```

- Same `CameraModel`, same `CameraView`, same `CaptureService` as the app. 28 source files are members of both targets (section 7). HIG: "Use the same camera UI in your app and your camera experience".
- **The `session` parameter is never used.** AVCam does not use `sessionContentURL`, `openApplication(for:)`, `invalidateSessionContent()`, or `LockedCameraCaptureManager`.
- The file declares its own global `logger` (`:31-32`), because `AVCamApp.swift` (which declares the app's `logger` at `AVCam/AVCamApp.swift:42`) is not in the extension target.
- Differences from `AVCam/AVCamApp.swift:21-38`: no `WindowGroup`, and no `scenePhase` observer that calls `syncState()`.

**How `MediaLibrary` handles the extension case: it does not have a special case.**
`AVCam/Model/MediaLibrary.swift` is compiled into both targets with no `#if` and no branch.

- It uses Path A only: `PHAssetCreationRequest` inside `PHPhotoLibrary.shared().performChanges` (`MediaLibrary.swift:53-110`).
- It checks and requests `.addOnly` authorization (`:34-48`).
- After the save it fetches the new `PHAsset` by its placeholder identifier and makes a 256×256 thumbnail (`:101-105`, `:114-124`). This agrees with the locked-device rule: assets from the current session are readable.
- Files: the Live Photo movie and the recorded movie are written to `URL.temporaryDirectory` (`AVCam/Support/FoundationExtensions.swift:12-14`), then moved into Photos with `shouldMoveFile = true` (`MediaLibrary.swift:67, 80`).

Why this is enough for AVCam: the app only saves to Photos. It has no private library, no editing, and no sharing. Path A needs no app-side ingestion code.

### 4f. Pitfalls and gaps in the sample

1. **Recording lost on dismissal** [INFERENCE]. A movie in progress is in the extension's temporary directory. If the person dismisses the extension before `stopRecording()` and the save complete, the system erases the container and the file is lost. A robust app writes the movie to `session.sessionContentURL` and ingests it in the app. This is the best "beyond AVCam" exercise.
2. **Photos permission not yet granted** [UNVERIFIED]. The extension inherits Photos permission. If the person never opened the app, `PHPhotoLibrary.requestAuthorization(for: .addOnly)` runs inside the extension. Apple says to move to the app to request more permission [WWDC24]. What the system does in the locked extension is not documented. In the worst case `MediaLibrary` throws `Error.unauthorized` and `CameraModel.error` is set.
3. **`PhotosPicker` on a locked device** [UNVERIFIED]. `ThumbnailButton` opens a `PhotosPicker` (`AVCam/Views/Toolbars/MainToolbar/ThumbnailButton.swift:21`). It is in the extension too. The correct design is `session.openApplication(for:)` on the thumbnail tap. AVCam does not do this.
4. **Location in the extension** [UNVERIFIED]. `MediaLibrary` calls `requestWhenInUseAuthorization()` and waits for a location update (`MediaLibrary.swift:128-138`). The extension target has `NSLocationWhenInUseUsageDescription` (`project.pbxproj:633`). Behavior of the prompt on a locked device: not documented.
5. **No `NSPhotoLibraryUsageDescription` in the extension target** (`project.pbxproj:630-634`). The app target has it (`:929`). This agrees with "inherits permissions from the app".
6. **No state sync on return.** The app calls `syncState()` when the scene becomes active (`AVCamApp.swift:31-35`). The extension reads the state once, in `start()`.
7. **`@main` twice.** `AVCamApp.swift` must not be a member of the extension target. It is not (`project.pbxproj:520-554`).
8. **The Xcode template uses `UIImagePickerController`.** Replace `<Name>ViewFinder.swift` with your own view. Your view must use `onCameraCaptureEvent` or `AVCaptureEventInteraction`.
9. **Launch speed matters more here.** The person is on the Lock Screen and wants the shot now. This links to the deferred-start chapter (WWDC26-303).
10. **Debugging.** The `AVCamCaptureExtension` scheme has `wasCreatedForAppExtension = "YES"` and `askForAppToLaunch = "Yes"`, and builds both the extension and the app (`AVCam.xcodeproj/xcshareddata/xcschemes/AVCamCaptureExtension.xcscheme`). Run that scheme, then start the extension from the control on the Lock Screen.

### 4g. Capabilities beyond AVCam

- `session.sessionContentURL` + `LockedCameraCaptureManager.shared.sessionContentUpdates` for non-Photos data and for crash-safe movie files.
- `session.openApplication(for:)` for share, edit, or view-library actions.
- `session.invalidateSessionContent()` after a PhotoKit save.
- `beginDelayingAppearance()` / `endDelayingAppearance()` (iOS 18.1) to hold the app's appearance during the move from extension to app, until the UI is ready.
- `ApplicationLaunchError.failureReason` to tell the person why the app did not open.

---

## 5. CameraCaptureIntent (App Intents)

### 5a. Concept

`CameraCaptureIntent` is a **system intent** protocol in App Intents. An intent that conforms to it tells the system: "this action starts my camera capture experience". The system then offers it as a camera launch action and decides whether to start the app or the capture extension.

Exact declaration, `AppIntents.swiftinterface:10626-10644`:

```swift
@available(iOS 18.0, *)   // unavailable on macOS, watchOS, tvOS, visionOS
public protocol CameraCaptureIntent: SystemIntent {
    associatedtype AppContext: Decodable, Encodable, Sendable = Never
}

extension CameraCaptureIntent {
    public static var appContext: Self.AppContext? { get async throws }
    public static func updateAppContext(_ newContext: Self.AppContext?) async throws
}
```

`SystemIntent` inherits from `AppIntent`. So the type also needs `title` and `perform()`.

`AppContext`:

- A `Codable & Sendable` type that you define. Default: `Never` (no context).
- The **system** stores it. It is the only supported way to pass state between the app and the capture extension, because the extension cannot use an App Group or shared defaults.
- Any process that contains the intent can read and write it: the app, the capture extension, and the widget extension.
- Limit: **4 kB** when encoded with `JSONEncoder` [DOC `updateAppContext(_:)`]. A context that is too large is not persisted [WWDC24].
- Good content: last capture mode, front or back camera, feature toggles, purchased features.

### 5b. What AVCam does

`AVCam/Model/Intent/AVCamCaptureIntent.swift:12-26`:

```swift
struct AVCamCaptureIntent: CameraCaptureIntent {
    typealias AppContext = CameraState
    static let title: LocalizedStringResource = "AVCamCaptureIntent"
    static let description: IntentDescription = IntentDescription("Capture photos and videos with AVCam.")
    @MainActor
    func perform() async throws -> some IntentResult {
        os.Logger().debug("AVCam capture intent performed successfully.")
        return .result()
    }
}
```

- `perform()` only logs. The system opens the capture experience because of the protocol conformance. AVCam has one screen, so there is nothing to navigate to. Apple's own examples read `appContext` in `perform()` and prepare the UI.
- The file imports `LockedCameraCapture` (`:8`), but uses no symbol from it. `CameraCaptureIntent` is in `AppIntents`.
- The file is a member of **all three targets** (`project.pbxproj:551, 561, 582`). This is a hard requirement [WWDC24]: the widget extension needs it for the control, and the system needs it in the app and in the capture extension to launch them.

`AVCam/Model/CameraState.swift:11-55` — the context type:

- `struct CameraState: Codable` with five properties: `isLivePhotoEnabled`, `qualityPrioritization`, `isVideoHDRSupported`, `isVideoHDREnabled`, `captureMode` (`:13-31`).
- Each property has `didSet { save() }`.
- `save()` starts a `Task` and calls `AVCamCaptureIntent.updateAppContext(self)` (`:33-41`).
- `static var current` reads `AVCamCaptureIntent.appContext`. On `nil` or on an error it returns a default `CameraState()` (`:43-54`).

The round trip:

1. `CameraModel.start()` calls `syncState()`, then `captureService.start(with: cameraState)` (`AVCam/CameraModel.swift:75-78`).
2. `syncState()` reads `CameraState.current` and copies four values into the model (`:90-96`).
3. `CaptureService.start(with:)` uses `captureMode` and `isVideoHDREnabled` as its first configuration (`AVCam/CaptureService.swift:99-102`). The session starts in the correct mode with one configuration.
4. Each model change writes back: `captureMode` (`CameraModel.swift:110`), `isLivePhotoEnabled` (`:139`), `qualityPrioritization` (`:147`), `isVideoHDREnabled` (`:172`), `isVideoHDRSupported` (`:222`).
5. The app syncs again each time its scene becomes active (`AVCam/AVCamApp.swift:31-35`). This picks up changes made in the extension.

`CameraState.swift` is a member of all three targets (`project.pbxproj:534, 559, 581`). It needs `CaptureMode` and `QualityPrioritization`, so `DataTypes.swift` is in the widget extension too (`:560`).

Why AVCam does it this way: one small `Codable` struct, write-through on each change, read at start. The app and the extension stay in the same state with no shared container. The alternative (App Group `UserDefaults`) does not work in the capture extension.

### 5c. How the system picks the app or the extension

What Apple states:

- "Depending on conditions such as whether the device is at the Lock or Home Screen, the system will determine whether to launch your capture extension or your application with your `CameraCaptureIntent`." [WWDC24-10204]
- The extension runs from the Lock Screen "regardless of the device's locked state" [WWDC24-10204].
- No camera permission: the system asks for an unlock and opens the **app** [WWDC24-10204, article note].
- The Camera Control can open the experience "from their locked device, the Home Screen, or from within other apps" [HIG].

Reading [INFERENCE]: launch from the Lock Screen (control, Action button, or Camera Control) → extension. Launch from an unlocked context (Home Screen, Control Center over an app) → app. Apple does not publish an exact table. Confirm on a device with a log line in each `@main` type.

### 5d. Pitfalls

1. **Intent missing from a target**: the control does not launch the experience.
2. **4 kB limit**: store settings only. No images, no long lists.
3. **Write storms and ordering** [INFERENCE from the code]. `syncState()` sets four model properties. Their `didSet` observers write the same values back into `cameraState`: always for `isLivePhotoEnabled` (`CameraModel.swift:139`) and `qualityPrioritization` (`:147`), and when the camera runs for `captureMode` (`:110`) and `isHDRVideoEnabled` (`:172`, video mode only). Each write starts a new unstructured `Task` (`CameraState.swift:34`). Swift does not guarantee the order of these tasks, so an older value can be stored last. A stricter design uses one serial task or a debounce.
3a. **Session reconfiguration on each activation** [INFERENCE from the code]. The app calls `syncState()` each time the scene becomes active (`AVCamApp.swift:31-35`). `syncState()` assigns `captureMode` (`CameraModel.swift:92`). The `didSet` then calls `captureService.setCaptureMode(_:)` even when the mode did not change (`:101-113`). In video mode that method tries to add the movie output a second time and throws; `try?` hides the error (`CaptureService.swift:269-293`). A tutorial version should compare the old and new value first.
4. **`isVideoHDRSupported` is stored but never read.** `syncState()` does not use it. The capability observer overwrites it (`CameraModel.swift:222`).
5. **Errors are only logged** (`CameraState.swift:37-39, 49-51`). On a read failure the app silently uses defaults.
6. **Codable evolution.** A later app version that changes `CameraState` must still decode the old JSON. If decoding fails, `appContext` throws and AVCam uses defaults.
7. **`Codable` enums with raw values**: `QualityPrioritization` is `Int`-backed, `CaptureMode` is `String`-backed (`AVCam/Model/DataTypes.swift:66, 117`). Renumbering a case breaks stored state.

### 5e. Capabilities beyond AVCam

- Use `perform()` to deep-link: read `appContext` and select a mode or a screen.
- Store more state: selected camera position, zoom, flash mode, purchased filters.
- Other system intents for media exist (`AudioRecordingIntent`, `AudioPlaybackIntent`).
- Assistant schemas for the camera domain exist in the SDK (`AppIntents.swiftinterface:12940-12980`): `.camera.startCapture`, `.camera.stopCapture`, `.camera.switchDevice`, `.camera.setDevice`, `.camera.openInCaptureMode`. They are for Siri and Apple Intelligence. They are a different feature from `CameraCaptureIntent`.

---

## 6. The control: Control Center, Lock Screen, Action button

### 6a. Concept

A **control** is a small button or toggle from the app. A person can put it in Control Center, on the Lock Screen, or on the Action button (iOS 18+). Controls are built with WidgetKit and live in a **widget extension**.

A control is the launch point for the capture extension: "To allow someone to launch your capture experience, you will need to create a custom control" [WWDC24-10204].

### 6b. Key APIs

From `SwiftUI.swiftinterface` and `WidgetKit.swiftinterface` (iOS 18.0; macOS 26.0 and watchOS 26.0 since last year):

```swift
@MainActor public protocol ControlWidget {
    init()
    associatedtype Body: ControlWidgetConfiguration
    @ControlWidgetConfigurationBuilder var body: Body { get }
}

public struct StaticControlConfiguration<Content: ControlWidgetTemplate>: ControlWidgetConfiguration {
    public init(kind: String, @ControlWidgetTemplateBuilder content: @escaping () -> Content)
    public init<Provider: ControlValueProvider>(kind: String, provider: Provider,
                @ControlWidgetTemplateBuilder content: @escaping (Provider.Value) -> Content)
}

public struct ControlWidgetButton<Label: View, ActionLabel: View, Action>: ControlWidgetTemplate {
    public init(action: Action, @ViewBuilder label: @escaping () -> Label) where Action: AppIntent   // used by AVCam
    public init(action: Action, @ViewBuilder label: @escaping () -> Label,
                @ViewBuilder actionLabel: @escaping (Bool) -> ActionLabel) where Action: AppIntent
}

// Modifiers on ControlWidgetConfiguration
func displayName(_ displayName: LocalizedStringResource) -> some ControlWidgetConfiguration
func description(_ description: LocalizedStringResource) -> some ControlWidgetConfiguration
func promptsForUserConfiguration() -> some ControlWidgetConfiguration
```

Related types: `ControlWidgetToggle`, `AppIntentControlConfiguration` (configurable controls), `ControlValueProvider`, `ControlCenter.shared` (reload controls), `WidgetBundle`.

### 6c. What AVCam does

`AVCamControlCenterExtension/AVCamControlCenterExtension.swift:12-27`:

```swift
struct AVCamControlCenterExtension: ControlWidget {
    static var kind = "com.example.apple-samplecode.AVCam.AVCamControlCenterExtension.ControlButton"
    static var displayName: LocalizedStringResource = "Open AVCam"
    static var description: LocalizedStringResource = "Launch AVCam app."

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: AVCamControlCenterExtension.kind) {
            ControlWidgetButton(action: AVCamCaptureIntent()) {
                Label("Open AVCam", systemImage: "curlybraces")
            }
        }
        .displayName(AVCamControlCenterExtension.displayName)
        .description(AVCamControlCenterExtension.description)
    }
}
```

`AVCamControlCenterExtension/AVCamControlCenterExtensionBundle.swift:11-16`: an `@main` `WidgetBundle` with this one control. There is no Home Screen widget and no Live Activity.

`AVCamControlCenterExtension/Info.plist:5-9`: `NSExtension` > `NSExtensionPointIdentifier` = `com.apple.widgetkit-extension`.

Why:

- `StaticControlConfiguration`: the control has no user options.
- `ControlWidgetButton`, not a toggle: the action launches something. It has no on/off state.
- The action is `AVCamCaptureIntent()`. A `CameraCaptureIntent` is what makes the system start the capture extension on a locked device. A normal `OpenIntent` only opens the app.

### 6d. What the person must do

The system does not add the control. The person adds it [HIG Controls]:

- **Control Center**: open Control Center, press and hold an empty area, add a control, find "Open AVCam".
- **Lock Screen**: customize the Lock Screen and replace one of the two bottom controls.
- **Action button**: Settings > Action Button, select a control.
- **Camera Control**: Settings > Camera > Camera Control, then select the app [Apple Support: the control can open "your favorite third-party camera app"].

HIG: "Provide instructions for adding the control." AVCam has no such instructions in its UI.

### 6e. Pitfalls

1. `kind` is a hard-coded string with the unmodified sample bundle ID. It is an identifier, not a bundle ID. Keep it stable: a change makes installed controls disappear.
2. The symbol is `curlybraces`. A real app uses a camera symbol. On the Lock Screen and Action button only the symbol shows [HIG].
3. `static var` for `kind`, `displayName`, `description`: these are mutable global state. `static let` is better for Swift 6.
4. The widget extension has **no usage descriptions** and needs none (`project.pbxproj:715-717`). It never opens the camera.
5. `DataTypes.swift` imports AVFoundation and is in the widget extension only because `CameraState` needs two enums. A cleaner project puts the shared enums in their own file.
6. Whether the Camera Control launch needs the widget extension, or only the capture extension: [UNVERIFIED]. Apple's Camera Control article says only that the app "needs to adopt the LockedCameraCapture framework".

### 6f. Capabilities beyond AVCam

- A second control that opens the app directly in video mode (use an intent parameter, or a second intent).
- `AppIntentControlConfiguration` for a control the person can configure.
- `ControlWidgetToggle` with a `ControlValueProvider`, for example a "recording" state.
- `ControlCenter.shared` to reload controls.
- Tint, action labels, and symbol animations (see "Adding refinements and configuration to controls").

---

## 7. Xcode project setup

### 7a. What the project contains (exact)

Project: `objectVersion = 70` (`project.pbxproj:6`). `LastUpgradeCheck = 1700`. Three targets (`:485-489`):

| Target | Product type | Bundle identifier | Embedded by |
|---|---|---|---|
| `AVCam` | `com.apple.product-type.application` (`:448`) | `com.example.apple-samplecode.AVCam${SAMPLE_CODE_DISAMBIGUATOR}` (`:940`) | — |
| `AVCamCaptureExtension` | `com.apple.product-type.extensionkit-extension` (`:407`) | `…AVCam${SAMPLE_CODE_DISAMBIGUATOR}.AVCamCaptureExtension` (`:643`) | "Embed ExtensionKit Extensions", `dstSubfolderSpec = 16`, `dstPath = "$(EXTENSIONS_FOLDER_PATH)"` (`:96-106`) |
| `AVCamControlCenterExtension` | `com.apple.product-type.app-extension` (`:427`) | `…AVCam${SAMPLE_CODE_DISAMBIGUATOR}.AVCamControlCenterExtension` (`:726`) | "Embed Foundation Extensions", `dstSubfolderSpec = 13` (PlugIns) (`:107-117`) |

The app target depends on both extension targets (`:441-444`).

`Configuration/SampleCode.xcconfig:13` sets `SAMPLE_CODE_DISAMBIGUATOR=${DEVELOPMENT_TEAM}`. The team ID becomes part of each bundle ID. The file's own comment says not to copy this method into a real project.

**App target build settings** (`:908-1001`, Debug and Release are the same for these):

| Setting | Value |
|---|---|
| `GENERATE_INFOPLIST_FILE` | `YES`. The app has **no** `Info.plist` file. All keys come from `INFOPLIST_KEY_*` |
| `INFOPLIST_KEY_NSCameraUsageDescription` | "To capture photos and videos." |
| `INFOPLIST_KEY_NSMicrophoneUsageDescription` | "To record audio for Live Photos and videos." |
| `INFOPLIST_KEY_NSPhotoLibraryUsageDescription` | "To save captured photos and videos." |
| `INFOPLIST_KEY_NSLocationWhenInUseUsageDescription` | "AVCam uses your location to tag where photos and videos are taken." |
| `INFOPLIST_KEY_LSApplicationCategoryType` | `public.app-category.photography` |
| `INFOPLIST_KEY_UISupportedInterfaceOrientations` | `UIInterfaceOrientationPortrait` (iPhone: portrait only) |
| `INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad` | all four orientations |
| `INFOPLIST_KEY_UIUserInterfaceStyle` | `Dark` |
| `INFOPLIST_KEY_UILaunchScreen_Generation` | `YES` |
| `IPHONEOS_DEPLOYMENT_TARGET` | `26.0` |
| `TARGETED_DEVICE_FAMILY` | `"1,2"` (iPhone and iPad) |
| `SUPPORTED_PLATFORMS` | `"iphoneos iphonesimulator"` |
| `SUPPORTS_MACCATALYST`, `SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD`, `SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD` | `NO` |
| `SWIFT_VERSION` | `5.0` |
| `SWIFT_STRICT_CONCURRENCY` | `minimal` (app target only) |
| `CODE_SIGN_STYLE` | `Automatic`, `DEVELOPMENT_TEAM = ""` |
| `DEVELOPMENT_ASSET_PATHS` | `"AVCam/Preview Content"`, `ENABLE_PREVIEWS = YES` |
| `ASSETCATALOG_COMPILER_APPICON_NAME` | `AppIcon` |

**Not in the project** (I searched the `pbxproj` and the source tree):

- No `.entitlements` file and no `CODE_SIGN_ENTITLEMENTS`. No capability is added.
- No App Group.
- No `UIRequiredDeviceCapabilities`.
- No `NSPhotoLibraryAddUsageDescription`. The code requests `.addOnly` access (`MediaLibrary.swift:36, 43`), and the project declares only `NSPhotoLibraryUsageDescription`. Apple's key reference says the Add key "is required if your app uses APIs that have write access". Apple's capture authorization article says `PHAssetCreationRequest` needs `NSPhotoLibraryUsageDescription`. The sample follows the article. Which key the add-only prompt needs at run time: [UNVERIFIED — test on a device; adding both keys is the safe choice].
- No `UIApplicationSceneManifest` key.
- No `.xcprivacy` privacy manifest.
- The status bar is hidden in code (`.statusBarHidden(true)`), not in the plist.

**Capture extension build settings** (`:617-699`):

| Setting | Value |
|---|---|
| `INFOPLIST_FILE` | `AVCamCaptureExtension/Info.plist`, merged with `GENERATE_INFOPLIST_FILE = YES` |
| `INFOPLIST_KEY_CFBundleDisplayName` | `AVCamCaptureExtension` |
| `INFOPLIST_KEY_NSCameraUsageDescription` | same text as the app |
| `INFOPLIST_KEY_NSMicrophoneUsageDescription` | same text as the app |
| `INFOPLIST_KEY_NSLocationWhenInUseUsageDescription` | same text as the app |
| `INFOPLIST_KEY_NSPhotoLibraryUsageDescription` | **absent** |
| `IPHONEOS_DEPLOYMENT_TARGET` | `26.0` |
| `LD_RUNPATH_SEARCH_PATHS` | `$(inherited)`, `@executable_path/Frameworks`, `@executable_path/../../Frameworks` |
| `SKIP_INSTALL` | `YES` |
| `SWIFT_VERSION` | `5.0` (no `SWIFT_STRICT_CONCURRENCY` line) |

`AVCamCaptureExtension/Info.plist` contains only:

```xml
<key>EXAppExtensionAttributes</key>
<dict>
    <key>EXExtensionPointIdentifier</key>
    <string>com.apple.securecapture</string>
</dict>
```

Correction to the task brief: this extension has **no `NSExtension` / `NSExtensionPointIdentifier` key**. Those keys belong to the widget extension. The capture extension is an ExtensionKit extension and uses `EXAppExtensionAttributes` / `EXExtensionPointIdentifier`.

**Control extension build settings** (`:701-782`):

| Setting | Value |
|---|---|
| `INFOPLIST_FILE` | `AVCamControlCenterExtension/Info.plist`, merged with `GENERATE_INFOPLIST_FILE = YES` |
| `INFOPLIST_KEY_CFBundleDisplayName` | `AVCamControlCenterExtension` |
| Usage descriptions | none |
| `ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME` | `AccentColor` |
| `ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME` | `WidgetBackground` |
| Linked frameworks | `SwiftUI.framework`, `WidgetKit.framework` (`:192-200`) |
| `IPHONEOS_DEPLOYMENT_TARGET` | `26.0` |

`AVCamControlCenterExtension/Info.plist` contains only `NSExtension` > `NSExtensionPointIdentifier` = `com.apple.widgetkit-extension`.

**Target membership** (from the three Sources build phases, `:520-600`):

The `AVCam` group is a classic group with explicit membership. The two extension folders are **file-system synchronized groups** (`:179-182`). Every file in those folders belongs to that target automatically, except `Info.plist`, which is excluded with a membership exception (`:162-177`).

| File | AVCam | Capture ext. | Control ext. |
|---|:-:|:-:|:-:|
| `AVCam/AVCamApp.swift` | ✔ | | |
| `AVCam/CameraModel.swift` | ✔ | ✔ | |
| `AVCam/CaptureService.swift` | ✔ | ✔ | |
| `AVCam/CameraView.swift` | ✔ | ✔ | |
| `AVCam/Capture/PhotoCapture.swift` | ✔ | ✔ | |
| `AVCam/Capture/MovieCapture.swift` | ✔ | ✔ | |
| `AVCam/Capture/DeviceLookup.swift` | ✔ | ✔ | |
| `AVCam/Capture/SPCObserver.swift` | ✔ | ✔ | |
| `AVCam/Model/Camera.swift` | ✔ | ✔ | |
| `AVCam/Model/MediaLibrary.swift` | ✔ | ✔ | |
| `AVCam/Model/DataTypes.swift` | ✔ | ✔ | ✔ |
| `AVCam/Model/CameraState.swift` | ✔ | ✔ | ✔ |
| `AVCam/Model/Intent/AVCamCaptureIntent.swift` | ✔ | ✔ | ✔ |
| `AVCam/Views/PreviewContainer.swift` | ✔ | ✔ | |
| `AVCam/Views/CameraPreview.swift` | ✔ | ✔ | |
| `AVCam/Views/CameraUI.swift` | ✔ | ✔ | |
| `AVCam/Views/Controls/CaptureModeView.swift` | ✔ | ✔ | |
| `AVCam/Views/Overlays/LiveBadge.swift` | ✔ | ✔ | |
| `AVCam/Views/Overlays/RecordingTimeView.swift` | ✔ | ✔ | |
| `AVCam/Views/Overlays/StatusOverlayView.swift` | ✔ | ✔ | |
| `AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift` | ✔ | ✔ | |
| `AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift` | ✔ | ✔ | |
| `AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift` | ✔ | ✔ | |
| `AVCam/Views/Toolbars/MainToolbar/SwitchCameraButton.swift` | ✔ | ✔ | |
| `AVCam/Views/Toolbars/MainToolbar/ThumbnailButton.swift` | ✔ | ✔ | |
| `AVCam/Support/CaptureExtensions.swift` | ✔ | ✔ | |
| `AVCam/Support/FoundationExtensions.swift` | ✔ | ✔ | |
| `AVCam/Support/ViewExtensions.swift` | ✔ | ✔ | |
| `AVCam/Preview Content/PreviewCameraModel.swift` | ✔ | ✔ | |
| `AVCam/Assets.xcassets` | ✔ | | |
| `AVCam/Preview Content/Preview Assets.xcassets` | ✔ | | |
| `AVCamCaptureExtension/AVCamCaptureExtension.swift` | | ✔ (synced) | |
| `AVCamControlCenterExtension/AVCamControlCenterExtension.swift` | | | ✔ (synced) |
| `AVCamControlCenterExtension/AVCamControlCenterExtensionBundle.swift` | | | ✔ (synced) |
| `AVCamControlCenterExtension/Assets.xcassets` | | | ✔ (synced) |

Totals: app 29 Swift files. Capture extension 28 shared files plus 1 of its own. Control extension 3 shared files plus 2 of its own.
The capture extension has an empty Resources phase (`:494-500`). It has no asset catalog and no accent color.

### 7b. Step list for a learner (Xcode 27)

The template names and generated files below come from the templates in the installed Xcode (`…/Templates/Project Templates/iOS/Application Extension/Capture Extension.xctemplate` and `Widget Extension.xctemplate`).

**A. The app target**

1. File > New > Project > iOS > App. Interface: SwiftUI. Language: Swift. Name: `AVCam`.
2. Target > General > Minimum Deployments: iOS 26.0.
3. General > Supported Destinations: keep iPhone and iPad. Remove Mac (Designed for iPad) and Apple Vision.
4. General > Deployment Info > iPhone Orientation: Portrait only. iPad Orientation: all four.
5. General > App Category: Photography.
6. Info tab (or Build Settings, "Info.plist Values"): add these four keys with a clear sentence each:
   - Privacy - Camera Usage Description (`NSCameraUsageDescription`)
   - Privacy - Microphone Usage Description (`NSMicrophoneUsageDescription`)
   - Privacy - Photo Library Usage Description (`NSPhotoLibraryUsageDescription`)
   - Privacy - Location When In Use Usage Description (`NSLocationWhenInUseUsageDescription`)
7. Info: Appearance = Dark (`UIUserInterfaceStyle`).
8. Build Settings: Swift Language Version = Swift 5. Strict Concurrency Checking = Minimal. (This matches the sample. A tutorial can choose Swift 6, but the sample code then needs changes.)
9. Signing & Capabilities: select a team. Add **no** capability.
10. Do not add an entitlements file.

**B. The capture extension target**

1. File > New > Target > iOS > Application Extension group > **Capture Extension** > Next.
2. Product Name: `AVCamCaptureExtension`. "Embed in Application": `AVCam`. Finish.
3. Xcode creates:
   - `AVCamCaptureExtension.swift` — the `@main` struct that conforms to `LockedCameraCaptureExtension`.
   - `AVCamCaptureExtensionViewFinder.swift` — a `UIImagePickerController` wrapper.
   - `Info.plist` with `EXAppExtensionAttributes` > `EXExtensionPointIdentifier` = `com.apple.securecapture`.
   - An "Embed ExtensionKit Extensions" phase and a target dependency in the app target.
4. Delete the `…ViewFinder.swift` file.
5. Replace the scene content with `CameraView(camera: camera)` (section 4e).
6. Add the three usage descriptions to the **extension** target: Camera, Microphone, Location When In Use.
7. Set the extension's Minimum Deployments to iOS 26.0.
8. Give the shared files membership in the extension target: select the 28 files from the table, then File Inspector > Target Membership > check `AVCamCaptureExtension`. Do **not** check `AVCamApp.swift`.
9. Signing: same team as the app.

**C. The widget (control) extension target**

1. File > New > Target > iOS > Application Extension group > **Widget Extension** > Next.
2. Product Name: `AVCamControlCenterExtension`.
3. Options: check **Include Control**. Uncheck **Include Live Activity**. Uncheck **Include Configuration App Intent**. (All three are checked by default in the template.)
4. "Embed in Application": `AVCam`. Finish.
5. Xcode creates a widget file, a control file (a timer toggle example), a bundle file, and an asset catalog with `AccentColor` and `WidgetBackground`. The `Info.plist` has `NSExtensionPointIdentifier` = `com.apple.widgetkit-extension`.
6. Delete the widget file. Replace the control file with the `ControlWidget` from section 6c. Reduce the bundle to the one control.
7. Target membership: check `AVCamControlCenterExtension` for `AVCamCaptureIntent.swift`, `CameraState.swift`, and `DataTypes.swift`.
8. Minimum Deployments: iOS 26.0. Signing: same team.

**D. Check the result**

1. App target > Build Phases shows "Embed ExtensionKit Extensions" (the capture extension) and "Embed Foundation Extensions" (the widget extension).
2. App target > Build Phases > Target Dependencies lists both extensions.
3. Each extension bundle ID starts with the app bundle ID and a period.
4. `AVCamCaptureIntent.swift` is a member of three targets.
5. Build and run the `AVCam` scheme on a **device**. Simulator has no camera.
6. Open the app once and grant Camera, Microphone, Photos, and Location access. The extension inherits these.
7. Add the "Open AVCam" control (section 6d). Lock the device. Start the control.

### 7c. Bundle ID and signing notes

- Rule: the bundle ID of an embedded extension must start with the bundle ID of the containing app, then a period. The sample follows it (`:643, 726, 940`). Xcode fills this in when it creates the target.
- All three targets use automatic signing and need the same team (`README.md:19`: "Set your signing credentials on each target").
- The Xcode template gives the widget target the product name `AVCamControlCenterExtensionExtension` (`:425`). The target name is `AVCamControlCenterExtension`. This has no effect.
- LockedCameraCapture needs no capability, no entitlement, and no special provisioning in the sample. App Store review requirements: [UNVERIFIED].
- `MARKETING_VERSION` (1.0) and `CURRENT_PROJECT_VERSION` (1) are the same in all three targets. Keep them the same: a version mismatch between an app and its extensions causes a validation warning at upload. [General Xcode knowledge, not checked here.]

---

## 8. Capability map: system integrations AVCam does not use

| Integration | What it gives | API or entry point | Status in AVCam |
|---|---|---|---|
| Action button | Hardware launch of the capture experience | A control (section 6) or an App Shortcut | Works through the control. No AVCam code |
| App Shortcuts | Siri, Spotlight, Shortcuts app, Action button | `AppShortcutsProvider`, `AppShortcut` | Not used |
| Assistant schemas, camera domain | Siri and Apple Intelligence actions: start or stop capture, switch camera, open in a capture mode | `@AppIntent(schema: .camera.startCapture)` and related | Not used |
| Home Screen quick actions | Long-press menu on the app icon, for example "Record Video" | `UIApplicationShortcutItem` | Not used |
| Configurable and toggle controls | One control per mode, a recording toggle | `AppIntentControlConfiguration`, `ControlWidgetToggle`, `ControlCenter` | Not used |
| Extension-to-app handoff | Share, edit, or view after unlock | `LockedCameraCaptureSession.openApplication(for:)`, `NSUserActivityTypeLockedCameraCapture` | Not used |
| Session content transfer | Files from the locked extension to the app | `sessionContentURL`, `LockedCameraCaptureManager` | Not used |
| Custom Camera Control controls | Filters, modes, discrete values | `AVCaptureIndexPicker`, `AVCaptureSlider(…step:)`, `prominentValues`, `localizedValueFormat` | One continuous custom slider only |
| Custom capture sound | Own feedback tone in AirPods | `AVCaptureEventSound(url:)` | Uses the three system sounds |
| Audio input picker | Select the microphone in the app, with level meters | `AVInputPickerInteraction` (AVKit, iOS 26) | Not used |
| Bluetooth microphone capability query | Show whether high-quality recording is active | `AVAudioSessionPortDescription.bluetoothMicrophoneExtension` | Not used |
| Spatial Audio capture | First-order ambisonics audio in movies | `AVCaptureDeviceInput.multichannelAudioMode` | Not used |
| Camera direction on new hardware | Which cameras face forward or backward in relation to a view | `AVCaptureDeviceDirectionCoordinator` (AVKit, **iOS 27.1**) | Not used. New in this SDK |
| Camera while multitasking on iPad | Keep the camera in Split View, Slide Over, Stage Manager | `isMultitaskingCameraAccessEnabled` | Not used |
| External display | Camera output on an external display | `AVCaptureExternalDisplayConfigurator` (iOS 26) | Not used |
| DockKit | Motorized stands that follow a subject | `DockKit` | Not used |
| Continuity Camera | iPhone as a camera for a Mac or Apple TV app | AVFoundation on macOS, AVKit on tvOS | Not applicable to an iOS app |
| Visual Intelligence | App content in visual intelligence search results | `VisualIntelligence` framework (iOS 26) | Not used. Related to the Camera Control only through the system UI |
| Live Activities | Recording state on the Lock Screen and in the Dynamic Island | ActivityKit | Not used |
| Cinematic video capture | Adjustable depth of field in video | AVFoundation (iOS 26) | Not used (video chapter) |

---

## Could not verify

1. Which Camera Control gesture produces the "active" delegate callbacks and which produces the "fullscreen" callbacks. Not documented. Needs device logs.
2. The exact rule the system uses to select the app or the capture extension. Apple gives only the general statement in section 5c.
3. Whether the Camera Control launch setting requires the widget extension, or only the capture extension.
4. Behavior of permission prompts (Photos add-only, Location) inside the locked extension.
5. Behavior of `PhotosPicker` inside the locked extension.
6. Whether add-only Photos access works with only `NSPhotoLibraryUsageDescription`, as the sample is configured.
7. The exact list of iPhone models with a Camera Control. Sources say "iPhone 16 devices" and "supported models".
8. Third-party Bluetooth shutter remotes as a capture event source.
9. App Store review requirements for a capture extension.
10. Nothing in this file was run on a device. API facts come from the SDK and the documentation.

Link checks: Apple documentation and HIG links were checked through the JSON endpoint, which returns a real 404 for a missing page. WWDC and Apple Support URLs return 200 for any path, so I checked those by reading the page title or the page text.

---

## Glossary

- **Action button** — Hardware button on recent iPhone Pro models and later. A person assigns one action to it, such as a control.
- **App context** — The `AppContext` value of a `CameraCaptureIntent`. Small `Codable` state that the system stores for the app and its extensions. Limit 4 kB.
- **App extension** — A separate executable inside the app bundle that the system starts for one job.
- **AVCaptureControl** — Base class of the objects that appear in the Camera Control overlay.
- **AVCaptureEvent** — Object that describes one hardware button interaction. It has a phase.
- **AVCaptureEventInteraction** — UIKit interaction (AVKit) that delivers capture events.
- **Camera Control** — Hardware control on the side of iPhone 16 and later. Click, light press, and slide.
- **Capture event** — A press of a hardware button that the system sends to a camera app in place of the default action.
- **Capture extension** — Short for locked camera capture extension.
- **Clean preview / fullscreen appearance** — State in which the system shows the Camera Control overlay and the app hides most of its own UI.
- **Control** — A WidgetKit button or toggle for Control Center, the Lock Screen, or the Action button.
- **Controls delegate** — `AVCaptureSessionControlsDelegate`. Receives the four activation and presentation callbacks. Required for controls to work.
- **ExtensionKit** — The newer extension system. Uses `EXAppExtensionAttributes` in `Info.plist` and the `Extensions` bundle folder.
- **File-system synchronized group** — Xcode 16+ project folder whose content is a target member automatically.
- **H2** — Apple audio chip in recent AirPods. Required for stem-click capture.
- **HFP** — Bluetooth Hands-Free Profile. Low-quality two-way audio. The fallback when high-quality recording is not available.
- **Light press** — A partial press on the Camera Control that does not click.
- **Locked camera capture extension** — ExtensionKit extension with extension point `com.apple.securecapture`. Runs the camera UI from the Lock Screen.
- **Primary / secondary action** — The two handlers of a capture event interaction. Volume up is secondary. All other sources are primary.
- **Session content directory** — `LockedCameraCaptureSession.sessionContentURL`. The only extension storage that the system moves to the app.
- **Stem click** — A press on the stem of an AirPod.
- **System intent** — An App Intents protocol with a meaning that the system knows, such as `CameraCaptureIntent`.
- **Widget extension** — Classic app extension with extension point `com.apple.widgetkit-extension`. Holds widgets, Live Activities, and controls.

---

## Verified links

All links below were checked on 2026-10-01 (method: see "Could not verify").

### Articles and guidelines

| Title | URL | Description |
|---|---|---|
| Creating a camera experience for the Lock Screen | https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen | Main article: restrictions, template, intent, saving, app handoff |
| Enhancing your app experience with the Camera Control | https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control | Main article: system and custom controls, session setup, delegate |
| Creating controls to perform actions across the system | https://developer.apple.com/documentation/widgetkit/creating-controls-to-perform-actions-across-the-system | Control life cycle, button and toggle, widget bundle |
| Adding refinements and configuration to controls | https://developer.apple.com/documentation/widgetkit/adding-refinements-and-configuration-to-controls | Tint, labels, configurable controls |
| AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The sample page. Same text as the README, plus requirements |
| Building a responsive camera app that launches quickly | https://developer.apple.com/documentation/avfoundation/building-a-responsive-camera-app-that-launches-quickly | Article for WWDC26 session 303 (deferred start) |
| Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media | Usage keys and permission requests |
| Capture setup | https://developer.apple.com/documentation/avfoundation/capture-setup | Index of capture configuration topics |
| App Shortcuts | https://developer.apple.com/documentation/appintents/app-shortcuts | App intents in Siri, Spotlight, Shortcuts |
| Accessing the camera while multitasking on iPad | https://developer.apple.com/documentation/avkit/accessing-the-camera-while-multitasking-on-ipad | Camera in Split View and Stage Manager |
| Capturing Spatial Audio in your iOS app | https://developer.apple.com/documentation/avfoundation/capturing-spatial-audio-in-your-ios-app | Spatial Audio recording |
| Supporting Continuity Camera in your macOS app | https://developer.apple.com/documentation/avfoundation/supporting-continuity-camera-in-your-macos-app | iPhone as a Mac camera |
| Supporting Continuity Camera in your tvOS app | https://developer.apple.com/documentation/avkit/supporting-continuity-camera-in-your-tvos-app | iPhone or iPad as an Apple TV camera |
| Add Home Screen quick actions | https://developer.apple.com/documentation/uikit/add-home-screen-quick-actions | App icon long-press actions |
| Configuring a new target in your project | https://developer.apple.com/documentation/xcode/configuring-a-new-target-in-your-project | How to add targets in Xcode |
| HIG: Camera Control | https://developer.apple.com/design/human-interface-guidelines/camera-control | Design rules for the overlay and controls |
| HIG: Controls | https://developer.apple.com/design/human-interface-guidelines/controls | Design rules for controls, including locked camera experiences |
| HIG: Action button | https://developer.apple.com/design/human-interface-guidelines/action-button | Design rules for Action button actions |
| HIG: App Shortcuts | https://developer.apple.com/design/human-interface-guidelines/app-shortcuts | Design rules for App Shortcuts |
| SF Symbols | https://developer.apple.com/sf-symbols/ | Symbol library for control icons |

### API reference — capture events (AVKit, SwiftUI)

| Title | URL | Description |
|---|---|---|
| AVCaptureEventInteraction | https://developer.apple.com/documentation/avkit/avcaptureeventinteraction | UIKit interaction for hardware capture events |
| init(handler:) | https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/init(handler:) | One handler for all events |
| init(primary:secondary:) | https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/init(primary:secondary:) | Separate handlers |
| isEnabled | https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/isenabled | Turn the interaction off to restore system behavior |
| defaultCaptureSoundDisabled | https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/defaultcapturesounddisabled | Class property that disables the default AirPods tone |
| AVCaptureEvent | https://developer.apple.com/documentation/avkit/avcaptureevent | The event object |
| AVCaptureEventPhase | https://developer.apple.com/documentation/avkit/avcaptureeventphase | began, ended, cancelled |
| shouldPlaySound | https://developer.apple.com/documentation/avkit/avcaptureevent/shouldplaysound | True for a stem click when the default sound is off |
| play(_:) | https://developer.apple.com/documentation/avkit/avcaptureevent/play(_:) | Plays a capture sound through AirPods |
| AVCaptureEventSound | https://developer.apple.com/documentation/avkit/avcaptureeventsound | System sounds and custom sounds |
| onCameraCaptureEvent(isEnabled:action:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:action:) | SwiftUI modifier, iOS 18 |
| onCameraCaptureEvent(isEnabled:primaryAction:secondaryAction:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:primaryaction:secondaryaction:) | SwiftUI modifier, iOS 18, two handlers |
| onCameraCaptureEvent(isEnabled:defaultSoundDisabled:action:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:defaultsounddisabled:action:) | SwiftUI modifier, iOS 26. AVCam uses the async form of this |
| onCameraCaptureEvent(isEnabled:defaultSoundDisabled:primaryAction:secondaryAction:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:defaultsounddisabled:primaryaction:secondaryaction:) | SwiftUI modifier, iOS 26, two handlers |
| AVInputPickerInteraction | https://developer.apple.com/documentation/avkit/avinputpickerinteraction | System audio input picker |
| AVCaptureDeviceDirectionCoordinator | https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator | iOS 27.1: camera direction in relation to a view |

### API reference — AirPods audio

| Title | URL | Description |
|---|---|---|
| configuresApplicationAudioSessionForBluetoothHighQualityRecording | https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessionforbluetoothhighqualityrecording | Capture session opt-in for AirPods high-quality recording |
| usesApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/usesapplicationaudiosession | Must be true for the property above |
| automaticallyConfiguresApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfiguresapplicationaudiosession | Set to false to configure the audio session yourself |
| bluetoothHighQualityRecording | https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/bluetoothhighqualityrecording | The AVAudioSession category option |
| AVAudioSessionPortExtensionBluetoothMicrophone | https://developer.apple.com/documentation/avfaudio/avaudiosessionportextensionbluetoothmicrophone | Capability query for a Bluetooth microphone |
| bluetoothMicrophoneExtension | https://developer.apple.com/documentation/avfaudio/avaudiosessionportdescription/bluetoothmicrophoneextension | Access to that extension from a port |
| setPrefersNoInterruptionsFromSystemAlerts(_:) | https://developer.apple.com/documentation/avfaudio/avaudiosession/setprefersnointerruptionsfromsystemalerts(_:) | Prevent ringtone interruptions during recording |
| multichannelAudioMode | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/multichannelaudiomode | Spatial Audio capture mode |

### API reference — Camera Control (AVFoundation)

| Title | URL | Description |
|---|---|---|
| AVCaptureControl | https://developer.apple.com/documentation/avfoundation/avcapturecontrol | Abstract base class |
| isEnabled | https://developer.apple.com/documentation/avfoundation/avcapturecontrol/isenabled | Disable a control but keep it in the list |
| AVCaptureSystemZoomSlider | https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider | System zoom control |
| init(device:action:) | https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider/init(device:action:) | Zoom control with a main-actor action |
| AVCaptureSystemExposureBiasSlider | https://developer.apple.com/documentation/avfoundation/avcapturesystemexposurebiasslider | System exposure bias control |
| AVCaptureSlider | https://developer.apple.com/documentation/avfoundation/avcaptureslider | Custom slider |
| setActionQueue(_:action:) | https://developer.apple.com/documentation/avfoundation/avcaptureslider/setactionqueue(_:action:) | Action and queue for a custom slider |
| prominentValues | https://developer.apple.com/documentation/avfoundation/avcaptureslider/prominentvalues-199dz | Values the slider lands on more easily |
| localizedValueFormat | https://developer.apple.com/documentation/avfoundation/avcaptureslider/localizedvalueformat | Value label format |
| AVCaptureIndexPicker | https://developer.apple.com/documentation/avfoundation/avcaptureindexpicker | Custom picker |
| AVCaptureSessionControlsDelegate | https://developer.apple.com/documentation/avfoundation/avcapturesessioncontrolsdelegate | The four callbacks |
| sessionControlsWillEnterFullscreenAppearance(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesessioncontrolsdelegate/sessioncontrolswillenterfullscreenappearance(_:) | When to hide app UI |
| supportsControls | https://developer.apple.com/documentation/avfoundation/avcapturesession/supportscontrols | Hardware check |
| maxControlsCount | https://developer.apple.com/documentation/avfoundation/avcapturesession/maxcontrolscount | Control limit |
| controls | https://developer.apple.com/documentation/avfoundation/avcapturesession/controls | Controls now on the session |
| canAddControl(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddcontrol(_:) | Check before add |
| addControl(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addcontrol(_:) | Add a control |
| removeControl(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/removecontrol(_:) | Remove a control |
| setControlsDelegate(_:queue:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/setcontrolsdelegate(_:queue:) | Set the delegate and its serial queue |
| systemRecommendedVideoZoomRange | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedvideozoomrange | Range source for the zoom slider |
| systemRecommendedExposureBiasRange | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedexposurebiasrange | Range source for the bias slider |
| displayVideoZoomFactorMultiplier | https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier | Factor for a zoom label that matches the system UI |
| isLockingFocusWithCustomLensPositionSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/islockingfocuswithcustomlenspositionsupported | Check used for AVCam's lens slider |
| setFocusModeLocked(lensPosition:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setfocusmodelocked(lensposition:completionhandler:) | Call used by AVCam's lens slider |
| uniqueID | https://developer.apple.com/documentation/avfoundation/avcapturedevice/uniqueid | Key of AVCam's controls cache |
| unownedExecutor | https://developer.apple.com/documentation/swift/actor/unownedexecutor | Custom actor executor, used for the session queue |
| DispatchSerialQueue | https://developer.apple.com/documentation/dispatch/dispatchserialqueue | Queue type that can be an actor executor |
| AVCaptureExternalDisplayConfigurator | https://developer.apple.com/documentation/avfoundation/avcaptureexternaldisplayconfigurator | iOS 26: external display output |

### API reference — LockedCameraCapture, App Intents, WidgetKit

| Title | URL | Description |
|---|---|---|
| LockedCameraCapture | https://developer.apple.com/documentation/lockedcameracapture | Framework page |
| LockedCameraCaptureExtension | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracaptureextension | Protocol of the `@main` extension type |
| LockedCameraCaptureExtensionScene | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracaptureextensionscene | Scene protocol |
| LockedCameraCaptureUIScene | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracaptureuiscene | Scene that holds the UI and the session |
| LockedCameraCaptureSession | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession | Session object in the extension |
| sessionContentURL | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession/sessioncontenturl | Directory that the system moves to the app |
| openApplication(for:) | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession/openapplication(for:) | Open the containing app after authentication |
| invalidateSessionContent() | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession/invalidatesessioncontent() | Delete the directory content in the extension |
| ApplicationLaunchError | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession/applicationlauncherror | Errors of `openApplication(for:)` |
| LockedCameraCaptureManager | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager | App-side access to session content |
| sessionContentUpdates | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager/sessioncontentupdates | Async sequence of content directories |
| sessionContentURLs | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager/sessioncontenturls | Current content directories |
| invalidateSessionContent(at:) | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager/invalidatesessioncontent(at:) | Tell the system a directory is done |
| beginDelayingAppearance() | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager/begindelayingappearance() | iOS 18.1: hold the app's appearance during the transition |
| NSUserActivityTypeLockedCameraCapture | https://developer.apple.com/documentation/lockedcameracapture/nsuseractivitytypelockedcameracapture | Activity type for the handoff |
| ExtensionKit | https://developer.apple.com/documentation/extensionkit | The extension system the capture extension uses |
| AppExtension | https://developer.apple.com/documentation/extensionfoundation/appextension | Base protocol of `LockedCameraCaptureExtension` |
| onContinueUserActivity(_:perform:) | https://developer.apple.com/documentation/swiftui/view/oncontinueuseractivity(_:perform:) | Receive the handoff activity in the app |
| PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest | How AVCam saves in both the app and the extension |
| CameraCaptureIntent | https://developer.apple.com/documentation/appintents/cameracaptureintent | The system intent protocol |
| AppContext | https://developer.apple.com/documentation/appintents/cameracaptureintent/appcontext-swift.associatedtype | Associated type for shared state |
| appContext | https://developer.apple.com/documentation/appintents/cameracaptureintent/appcontext-swift.type.property | Read the shared state |
| updateAppContext(_:) | https://developer.apple.com/documentation/appintents/cameracaptureintent/updateappcontext(_:) | Write the shared state. States the 4 kB limit |
| SystemIntent | https://developer.apple.com/documentation/appintents/systemintent | Parent protocol |
| OpenIntent | https://developer.apple.com/documentation/appintents/openintent | Intent that opens the app (not the extension) |
| AssistantSchemas.CameraIntent | https://developer.apple.com/documentation/appintents/assistantschemas/cameraintent | Camera schemas for Siri and Apple Intelligence |
| AppShortcutsProvider | https://developer.apple.com/documentation/appintents/appshortcutsprovider | Declares App Shortcuts |
| ControlWidget | https://developer.apple.com/documentation/swiftui/controlwidget | Protocol of a control |
| StaticControlConfiguration | https://developer.apple.com/documentation/widgetkit/staticcontrolconfiguration | Control with no user options |
| ControlWidgetButton | https://developer.apple.com/documentation/widgetkit/controlwidgetbutton | Button template |
| ControlWidgetToggle | https://developer.apple.com/documentation/widgetkit/controlwidgettoggle | Toggle template |
| AppIntentControlConfiguration | https://developer.apple.com/documentation/widgetkit/appintentcontrolconfiguration | Configurable control |
| ControlCenter | https://developer.apple.com/documentation/widgetkit/controlcenter | Reload and inspect controls |
| WidgetBundle | https://developer.apple.com/documentation/swiftui/widgetbundle | `@main` type of the widget extension |

### Info.plist keys

| Title | URL | Description |
|---|---|---|
| NSCameraUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription | Required in the app and in the capture extension |
| NSMicrophoneUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription | Microphone prompt text |
| NSPhotoLibraryUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryusagedescription | Photos prompt text. The app target has it |
| NSPhotoLibraryAddUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryaddusagedescription | Add-only Photos prompt text. The sample does not have it |
| NSLocationWhenInUseUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nslocationwheninuseusagedescription | Location prompt text |
| UIRequiredDeviceCapabilities | https://developer.apple.com/documentation/bundleresources/information-property-list/uirequireddevicecapabilities | Not set in the sample |

### Other frameworks in the capability map

| Title | URL | Description |
|---|---|---|
| DockKit | https://developer.apple.com/documentation/dockkit | Motorized tracking stands |
| Visual Intelligence | https://developer.apple.com/documentation/visualintelligence | App content in visual intelligence results |
| ActivityKit | https://developer.apple.com/documentation/activitykit | Live Activities |
| Capturing Cinematic video | https://developer.apple.com/documentation/avfoundation/capturing-cinematic-video | Cinematic capture |

### WWDC sessions

| Title | URL | Description |
|---|---|---|
| WWDC24 10204 — Build a great Lock Screen camera capture experience | https://developer.apple.com/videos/play/wwdc2024/10204/ | The source for the extension life cycle, restrictions, and the intent |
| WWDC24 10157 — Extend your app's controls across the system | https://developer.apple.com/videos/play/wwdc2024/10157/ | How to build controls |
| WWDC24 10210 — Bring your app's core features to users with App Intents | https://developer.apple.com/videos/play/wwdc2024/10210/ | App Intents background |
| WWDC25 253 — Enhancing your camera experience with capture controls | https://developer.apple.com/videos/play/wwdc2025/253/ | Capture events, primary and secondary mapping, AirPods remote capture, Camera Control |
| WWDC25 251 — Enhance your app's audio recording capabilities | https://developer.apple.com/videos/play/wwdc2025/251/ | AirPods high-quality recording, input picker, Spatial Audio |
| WWDC26 303 — Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | The session named in the last sample commit. Deferred start |
| WWDC26 304 — Implement high resolution photo capture | https://developer.apple.com/videos/play/wwdc2026/304/ | Referenced by session 303 |
| WWDC23 10105 — Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | Responsive capture background |
| WWDC23 10106 — Support external cameras in your iPadOS app | https://developer.apple.com/videos/play/wwdc2023/10106/ | External cameras on iPad |

### Apple Support (user steps)

| Title | URL | Description |
|---|---|---|
| Use the Camera Control on iPhone | https://support.apple.com/guide/iphone/use-the-camera-control-iph0c397b154/ios | Gestures and settings of the Camera Control |
| Use the Camera Control to open another app on iPhone | https://support.apple.com/guide/iphone/use-the-camera-control-to-open-another-app-iph3940f00d2/ios | Settings > Camera > Camera Control, third-party camera apps |
| Use AirPods with supported camera apps on iPhone or iPad | https://support.apple.com/guide/airpods/use-airpods-with-camera-apps-dev8e2a2ba2e/web | Camera Remote setup, supported AirPods, microphone selection |
