# Dossier 01: Capture pipeline fundamentals (AVCam, iOS 26 target, iOS 27.1 SDK)

Scope: authorization, session architecture, devices, inputs, preview, rotation, focus and exposure, life cycle, deferred start.
Out of scope (other agents): photo capture, video capture, Camera Control, Lock Screen extension.

## How to read this dossier

- Sample paths are relative to `/Users/karolkakol/tutorials/AVCamBuildingACameraApp/`. Format: `path:line`.
- "Header" means the SDK headers in
  `/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk/System/Library/Frameworks/AVFoundation.framework/Headers/`.
  The headers are the ground truth for API names and availability.
- Swift names come from `AVFoundation.apinotes` in the same folder, or from `NS_SWIFT_NAME` in the headers.
- Each link in the "Verified links" table returned HTTP 200 on 2026-10-01. Documentation links were tested through the JSON endpoint (`https://developer.apple.com/tutorials/data/<path>.json`).
- Nothing in this dossier was run on a device. Behavior statements come from the headers, the Apple articles, and the WWDC transcripts. Items that need a device test are marked UNVERIFIED.

## Most important findings

1. **"WWDC26 session 303" is "Build a responsive camera app that launches quickly".** The page is `https://developer.apple.com/videos/play/wwdc2026/303/`. The short form `/wwdc26/303/` redirects to the video index. A companion article exists: "Building a responsive camera app that launches quickly".
2. **Deferred start is an iOS 26 API and is on by default.** For an app linked with the iOS 26 SDK or later, `AVCaptureSession.automaticallyRunsDeferredStart` is `true`, and `isDeferredStartEnabled` is `true` for `AVCapturePhotoOutput` and `AVCaptureFileOutput` subclasses. The lines that the last commit added to AVCam only show the defaults. Session 303 reports a launch that is two times faster (about 1 s down to about 0.5 s).
3. **The iOS 27 SDK adds real camera hardware control.** New items: physical lens aperture control (`setExposureModeCustom(lensAperture:duration:iso:completionHandler:)`, `AVCaptureDevice.autoLensAperture`), priority modes (`autoISO`, `autoExposureDuration`), exposure signals, continuous autofocus tracking, a lock to one constituent camera, and low-light video noise reduction on connections. iOS 27.1 adds `.builtInOuterUltraWideCamera` and `.builtInInnerUltraWideCamera` (documentation marks them beta). Apple documentation names the device "iPhone Duo".
4. **The published Apple rotation article is ahead of the local repository.** The article "Supporting device rotation in your camera app" describes a `@MainActor RotationObserver` class. The local commit `72b0fdb` still creates the rotation coordinator inside the `CaptureService` actor (`AVCam/CaptureService.swift:374-401`). The tutorial must decide which design to teach.
5. **AVCam has a dead interruption path.** `CaptureService.isInterrupted` is published (`AVCam/CaptureService.swift:21`) but `CameraModel.observeState()` never reads it (`AVCam/CameraModel.swift:197-235`). `CameraStatus.interrupted` (`AVCam/Model/DataTypes.swift:23`) is only used by a SwiftUI preview (`AVCam/Views/Overlays/StatusOverlayView.swift:60`). The yellow "interrupted" overlay can never appear in the real app.
6. **AVCam never asks for microphone access explicitly.** `isAuthorized` only checks `.video` (`AVCam/CaptureService.swift:84-96`). The microphone prompt appears as a side effect of `AVCaptureDeviceInput(device:)` (`AVCam/CaptureService.swift:132`).
7. **AVCam can never show 0.5x.** The back discovery session asks for `[.builtInDualCamera, .builtInWideAngleCamera]` (`AVCam/Capture/DeviceLookup.swift:20`). It never asks for `.builtInTripleCamera` or `.builtInDualWideCamera`, so the ultra-wide camera is never used.
8. **The project compiles in Swift 5 mode with minimal concurrency checks** (`AVCam.xcodeproj/project.pbxproj:949-950`). Several patterns in the sample would not compile, or would be flagged, in Swift 6 mode.

---

## 1. Authorization

### (a) Concept

The camera and the microphone are protected resources. The system asks the person one time for each resource. The system remembers the answer. The person can change the answer in Settings.

There are two parts:

1. **A static text in Info.plist.** The system shows this text in the alert. If the key is missing, the system terminates the app when the app touches the capture device.
2. **A runtime check.** The app reads the current status. If the status is "not determined", the app requests access.

`AVAuthorizationStatus` has four values (header `AVCaptureDevice.h:2159`):

| Value | Meaning | What the app can do |
|---|---|---|
| `.notDetermined` | The person has not answered yet | Call `requestAccess(for:)` |
| `.restricted` | A policy blocks access (for example parental controls). The person cannot change it | Show an explanation. Do not send the person to Settings |
| `.denied` | The person said no | Show an explanation and a link to Settings |
| `.authorized` | Access is granted | Configure and start the session |

### (b) Key APIs

- `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` (Info.plist keys). AVCam sets them as build settings: `AVCam.xcodeproj/project.pbxproj:926` and `:928` (main app), `:631` and `:634` (capture extension).
- `AVCaptureDevice.authorizationStatus(for: AVMediaType) -> AVAuthorizationStatus` (iOS 7). Only `.video` and `.audio` are legal. Other media types throw `NSInvalidArgumentException`.
- `AVCaptureDevice.requestAccess(for:completionHandler:)` (iOS 7). Swift imports it as `await AVCaptureDevice.requestAccess(for:) -> Bool`.
- `UIApplication.openSettingsURLString` to open the app's page in Settings.

### (c) Why AVCam does it this way

`AVCam/CaptureService.swift:84-96` defines `var isAuthorized: Bool { get async }`. The same code is in Apple's article "Requesting authorization to capture and save media".

- An async property keeps the check and the prompt in one place. The caller writes `guard await captureService.isAuthorized` (`AVCam/CameraModel.swift:70-73`).
- The check runs two times: one time in `CameraModel.start()` and one time in `CaptureService.start(with:)` (`AVCam/CaptureService.swift:105`). The second check is a safety net. It costs almost nothing because the status is already known.
- AVCam is a camera app, so it asks at launch. Apple's article says that an app where capture is not the main function must ask only when the person opens the camera feature.

Alternatives:

- Ask for `.audio` in the same property. This gives the app control of the order and the moment of the two alerts.
- Add a "pre-prompt" screen that explains the reason before the system alert appears. The system alert appears only one time, so a refused alert is expensive.
- Keep a full `AVAuthorizationStatus` in the model, not a `Bool`. A `Bool` cannot tell "denied" from "restricted".

### (d) Pitfalls

- **Microphone is implicit in AVCam.** The header for `AVCaptureDeviceInput.init(device:)` says: when the status for the device's media type is `.notDetermined`, the system prompts for access on the app's behalf. This is why AVCam gets a microphone alert without a request. The alert appears in the middle of session setup, on the session queue.
- **Denied microphone probably breaks the full camera.** `setUpSession()` catches every error and throws `CameraError.setupFailed` (`AVCam/CaptureService.swift:165-167`). If `AVCaptureDeviceInput(device: defaultMic)` fails, the camera status becomes `.failed`. The error code `AVError.Code.applicationIsNotAuthorizedToUseDevice` (-11852) exists in `AVError.h:90`. UNVERIFIED on a device: that the initializer throws this error after a denial. A robust app makes the microphone optional: photo capture does not need it.
- **Black frames before the answer.** The header says that until access is granted, devices give black video frames and silent audio. A preview that starts before the answer shows black.
- **The completion handler runs on an arbitrary queue.** With `await` this is not a problem. With the callback form, hop to the main actor before a UI update.
- **`.restricted` and `.denied` look the same in AVCam.** Both become `status = .unauthorized` (`AVCam/CameraModel.swift:71`).
- **No re-check after Settings.** When the person changes a privacy setting, iOS terminates the app. So a re-check on foreground is usually not necessary. Do not build logic that depends on a live status change.
- **Photo library access is a different permission.** `NSPhotoLibraryUsageDescription` is at `project.pbxproj:929`. The extension targets do not have it.

### (e) Beyond AVCam

- macOS and Mac Catalyst also need the camera and audio-input entitlements (App Sandbox / hardened runtime).
- Mac Catalyst: `NSCameraUseExternalDeviceType` and `NSCameraUseContinuityCameraDeviceType` opt in to the `.external` and `.continuityCamera` device types (header `AVCaptureDevice.h:538-550` and `:655-665`).
- `requestAccess(for: .audio)` is equivalent to `AVAudioSession.requestRecordPermission` (header).

### (f) Links

- Requesting authorization to capture and save media: https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media
- `authorizationStatus(for:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/authorizationstatus(for:)
- `requestAccess(for:completionHandler:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/requestaccess(for:completionhandler:)
- `AVAuthorizationStatus`: https://developer.apple.com/documentation/avfoundation/avauthorizationstatus
- `NSCameraUsageDescription`: https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription
- `NSMicrophoneUsageDescription`: https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription

---

## 2. AVCaptureSession architecture

### (a) Concept

A capture session is a graph.

```
AVCaptureDevice ──> AVCaptureDeviceInput ──(ports)──┐
(camera)                                            ├─ AVCaptureConnection ──> AVCaptureOutput (photo, movie, video data…)
AVCaptureDevice ──> AVCaptureDeviceInput ──(ports)──┤
(microphone)                                        └─ AVCaptureConnection ──> AVCaptureVideoPreviewLayer
```

- **Device**: a camera or a microphone. It owns the hardware settings (focus, exposure, zoom, format).
- **Input**: wraps one device and exposes **ports**. One port carries one media stream (video, audio, metadata, depth).
- **Output**: consumes data. Examples: `AVCapturePhotoOutput`, `AVCaptureMovieFileOutput`, `AVCaptureVideoDataOutput`.
- **Connection**: joins one or more input ports to one output, or one video port to one preview layer. It owns per-stream settings: rotation angle, mirroring, stabilization, enabled state.
- **Session**: owns the graph, decides the device format (through a preset), and starts and stops the data flow.

When you call `addInput` or `addOutput`, the session makes connections automatically between all compatible ports and outputs (header: "greedily forms connections"). You only make connections by hand when you use `addInputWithNoConnections(_:)` / `addOutputWithNoConnections(_:)`. Multi-camera apps do this.

### (b) Key APIs

Configuration:

- `canAddInput(_:)` / `addInput(_:)` / `removeInput(_:)`. `addInput` without a successful `canAddInput` throws `NSInvalidArgumentException`.
- `canAddOutput(_:)` / `addOutput(_:)` / `removeOutput(_:)`.
- `beginConfiguration()` / `commitConfiguration()`. All changes between them are applied together at the outermost commit. Pairs can nest. `startRunning()` or `stopRunning()` between begin and commit throws `NSGenericException`.
- `sessionPreset` and `canSetSessionPreset(_:)`. The default preset is `.high`.
- `connections` (iOS 13), `inputs`, `outputs`.
- `hardwareCost` (iOS 16): 0.0 to 1.0. A value above 1.0 means the session cannot run and posts a runtime error.

Running:

- `startRunning()` and `stopRunning()`. Both are synchronous and block. A start failure does not throw. It arrives as `AVCaptureSession.runtimeErrorNotification`.
- `isRunning`, `isInterrupted` (both key-value observable).

Presets (header `AVCaptureSessionPreset.h`): `.photo`, `.high`, `.medium`, `.low`, `.cif352x288`, `.vga640x480`, `.hd1280x720`, `.hd1920x1080`, `.hd4K3840x2160`, `.iFrame960x540`, `.iFrame1280x720`, `.inputPriority`.

### (c) Why AVCam does it this way

**Presets, not formats.** AVCam sets `.photo` in photo mode and `.high` in video mode (`AVCam/CaptureService.swift:135`, `:281`, `:284`).

- A preset is a request for a quality level. The session then selects `activeFormat` for the device. This is simple and works on each device.
- `.photo` gives the full-sensor 4:3 photo format. `.high` gives a high-quality video format (the exact format depends on the device).
- The alternative is to set `device.activeFormat` directly. Then the session preset changes automatically to `.inputPriority` (header `AVCaptureDevice.h:384` discussion). After that, the app owns the format, the frame rate, and the color space.
- The two methods are mutually exclusive on iOS. If you set a preset again, the session takes control back and can change `activeFormat`.
- AVCam uses both. HDR video sets `activeFormat` to a 10-bit format (`AVCam/CaptureService.swift:505-508`), which makes the preset `.inputPriority`. To turn HDR off, AVCam sets `.high` again (`:511`). This is a good example of the "hand control back to the session" idea.

**Atomic changes.** Mode changes and camera changes are inside `beginConfiguration()` / `defer { commitConfiguration() }` (`AVCam/CaptureService.swift:274-275`, `:330-331`, `:501-502`). Without the pair, each change reconfigures the running pipeline separately, and the preview can stutter many times.

**An actor on a serial dispatch queue (the "session queue" pattern).**

```swift
private let sessionQueue = DispatchSerialQueue(label: "…sessionQueue")   // CaptureService.swift:68
nonisolated var unownedExecutor: UnownedSerialExecutor {                  // CaptureService.swift:71-73
    sessionQueue.asUnownedSerialExecutor()
}
```

The reasons:

1. **`startRunning()` blocks.** The header and the documentation say that it blocks until the session starts or fails. On the main thread this causes a hang. Session 303 says the same for `stopRunning()` and says that session creation also blocks.
2. **`AVCaptureSession` is not designed for concurrent calls.** The old Objective-C and Swift AVCam used one serial `sessionQueue` for all session work. An actor gives the same guarantee, and the compiler enforces it.
3. **A default actor runs on the Swift cooperative thread pool.** That pool has about one thread for each CPU core, and it must not block. A blocking call there can starve other tasks. A custom executor moves the actor's work to a dedicated dispatch queue, where a blocking call is acceptable.
4. **AVFoundation callbacks want a dispatch queue.** The app passes the same queue to the framework: `setControlsDelegate(controlsDelegate, queue: sessionQueue)` (`AVCam/CaptureService.swift:224`) and `lensSlider.setActionQueue(sessionQueue)` (`:243`). Those callbacks then run in the same serial context as the actor. There is no data race with actor code.

Mechanics: `Actor` has the requirement `nonisolated var unownedExecutor: UnownedSerialExecutor` (iOS 13). `DispatchSerialQueue` conforms to `SerialExecutor` from iOS 17 (`Dispatch.swiftmodule` interface, lines 186-189). The design is Swift Evolution SE-0392 "Custom Actor Executors".

Alternatives:

- A class with a private `DispatchQueue` and `queue.async { }` in each method. This is the pre-concurrency pattern. It works, but the compiler does not check it.
- A global actor (`@CaptureActor`) with a custom executor. Useful when many types (photo service, movie service, delegates) must share the same isolation. In AVCam, `PhotoCapture` and `MovieCapture` are plain classes that only the actor calls.
- A default actor with no custom executor. It compiles, but the blocking calls then run on the cooperative pool, and framework callbacks arrive on a different queue.

### (d) Pitfalls

- **Initial setup has no begin/commit pair.** `setUpSession()` (`AVCam/CaptureService.swift:113-168`) adds inputs and outputs directly. Inside it, `configureControls` (`:207-227`) and `setHDRVideoEnabled` (`:501-502`) each commit separately. Session 303 says: "Commit a single configuration up front to avoid lengthy reconfigurations during launch." A rebuilt app should wrap all of the setup in one pair.
- **`defer { commitConfiguration() }` plus `throws`.** In `setCaptureMode(.video)` a failed `addOutput` throws after the preset already changed (`AVCam/CaptureService.swift:284-285`). The commit still runs. The session is then in video preset without a movie output. There is no rollback.
- **A failed start is silent.** `CameraModel.start()` sets `status = .running` when `captureService.start` returns (`AVCam/CameraModel.swift:78-80`). It does not check `isRunning`. A start failure only appears as a runtime error notification.
- **The actor is re-entrant at each `await`.** `start(with:)` awaits `isAuthorized` and then reads `captureSession.isRunning` (`AVCam/CaptureService.swift:105`). Two fast calls could both pass the guard. `isSetUp` (`:59`, `:115`) protects the setup, because `setUpSession()` has no suspension point.
- **`@preconcurrency import AVFoundation`** (`AVCam/CaptureService.swift:9`) hides Sendable warnings for AVFoundation types. The `nonisolated let previewSource` (`:28`) gives a non-Sendable `AVCaptureSession` to the main actor inside a `Sendable` struct (`AVCam/Views/CameraPreview.swift:91-102`). This is accepted only because the project uses Swift 5 mode with `SWIFT_STRICT_CONCURRENCY = minimal`.
- **`fatalError` on a nil device.** `currentDevice` (`AVCam/CaptureService.swift:192-197`) and `changeCaptureDevice` (`:327`) crash if there is no active input. An external camera that is disconnected at the wrong moment is a possible path.
- **One output of each type.** On iOS a session accepts one output of each class. From iOS 16, more than one `AVCaptureVideoDataOutput` is allowed, and a movie file output can run together with video data outputs. Then you must check `hardwareCost` (header `AVCaptureSession.h:242-246`).
- **The audio session.** `usesApplicationAudioSession` and `automaticallyConfiguresApplicationAudioSession` are `true` by default. The capture session then sets the app's `AVAudioSession` to PlayAndRecord. An app that plays music must know this. `configuresApplicationAudioSessionToMixWithOthers` (iOS 18) avoids the interruption of other audio.

### (e) Beyond AVCam

- `hardwareCost` and, for multi-cam, `systemPressureCost`. Session 303 recommends a check of `hardwareCost <= 1.0` after the commit and before `startRunning()`.
- `AVCaptureDeviceInput.videoMinFrameDurationOverride` (iOS 13): tells the session the maximum frame rate that you will use, which lowers the hardware cost.
- `AVCaptureDeviceInput.unifiedAutoExposureDefaultsEnabled` (iOS 12): makes auto-exposure defaults the same for preset and for `activeFormat`.
- `automaticallyConfiguresCaptureDeviceForWideColor` (default `true`): the session selects P3 color for photos. Set it to `false` if you set `activeColorSpace` yourself.
- `synchronizationClock` (iOS 15.4): the clock for all output timestamps.
- `configuresApplicationAudioSessionForBluetoothHighQualityRecording` (iOS 26): AirPods as a high-quality microphone. AVCam sets it at `AVCam/CaptureService.swift:128`.
- `AVCaptureDeviceInput.activeLockedVideoFrameDuration` and external sync (`follow(_:videoFrameDuration:delegate:)`), both iOS 26: frame-accurate timing for multi-device shoots.
- `AVCaptureDeviceInput.isAudioZoomEnabled` (iOS 26.4), `isWindNoiseRemovalEnabled` and `multichannelAudioMode` (iOS 18).

### (f) Links

- Setting up a capture session: https://developer.apple.com/documentation/avfoundation/setting-up-a-capture-session
- Capture setup (collection): https://developer.apple.com/documentation/avfoundation/capture-setup
- `AVCaptureSession`: https://developer.apple.com/documentation/avfoundation/avcapturesession
- `beginConfiguration()`: https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()
- `commitConfiguration()`: https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()
- `startRunning()`: https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning()
- `AVCaptureSession.Preset`: https://developer.apple.com/documentation/avfoundation/avcapturesession/preset
- `inputPriority`: https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/inputpriority
- `AVCaptureConnection`: https://developer.apple.com/documentation/avfoundation/avcaptureconnection
- `hardwareCost`: https://developer.apple.com/documentation/avfoundation/avcapturesession/hardwarecost
- `Actor.unownedExecutor`: https://developer.apple.com/documentation/swift/actor/unownedexecutor
- `DispatchSerialQueue`: https://developer.apple.com/documentation/dispatch/dispatchserialqueue
- SE-0392 Custom Actor Executors: https://github.com/swiftlang/swift-evolution/blob/main/proposals/0392-custom-actor-executors.md

---

## 3. Devices

### (a) Concept

`AVCaptureDevice` represents one camera or one microphone. There are two kinds of camera device:

- **Physical device**: one lens and one sensor. Examples: wide, ultra-wide, telephoto.
- **Virtual device**: a group of physical cameras that the system shows as one camera. The system switches between the constituent cameras as zoom, light, and focus distance change. It can also fuse images and compute depth.

Device types on iOS (header `AVCaptureDevice.h:536-690`):

| Swift name | iOS | Kind | Notes |
|---|---|---|---|
| `.builtInWideAngleCamera` | 10.0 | physical | The general camera. Front and back |
| `.builtInTelephotoCamera` | 10.0 | physical | Discovery session only |
| `.builtInUltraWideCamera` | 13.0 | physical | Discovery session only |
| `.builtInOuterUltraWideCamera` | 27.1 (docs: beta) | physical | New. Discovery session only |
| `.builtInInnerUltraWideCamera` | 27.1 (docs: beta) | physical | New. Discovery session only |
| `.builtInDualCamera` | 10.2 | virtual | Wide + telephoto. Depth by disparity |
| `.builtInDualWideCamera` | 13.0 | virtual | Ultra-wide + wide. Depth by disparity |
| `.builtInTripleCamera` | 13.0 | virtual | Ultra-wide + wide + telephoto. No depth in the header feature list |
| `.builtInTrueDepthCamera` | 11.1 | virtual | Front color camera + infrared camera. Depth |
| `.builtInLiDARDepthCamera` | 15.4 | virtual | Back color camera + LiDAR. Accurate depth |
| `.external` | 17.0 | physical | UVC (USB Video Class) camera on iPad |
| `.continuityCamera` | 17.0 | — | An iPhone used as a camera for Mac or Apple TV |
| `.microphone` | 17.0 | audio | Replaces the deprecated `.builtInMicrophone` |
| `.deskViewCamera` | macOS only | — | Not available on iOS |

Important limits of the multi-camera virtual devices (header text for dual, dual-wide, triple):

- No `AVCaptureDevice.ExposureMode.custom` and no manual exposure bracketing.
- No focus lock at a custom lens position. Only `AVCaptureDevice.currentLensPosition` is legal.
- No white balance lock with custom gains.
- Locked values (ISO, duration, white balance gains, lens position) can change when the device switches camera.

An expert conclusion: for full manual control, select a physical device. For smooth zoom and automatic quality, select a virtual device. Always read the capability properties (`isLockingFocusWithCustomLensPositionSupported`, `isExposureModeSupported(.custom)`). The iOS 27 header text for `setFocusModeLocked(lensPosition:)` talks about custom lens positions on virtual cameras, so the rule is changing. Do not hard-code it.

### (b) Key APIs

Find devices:

- `AVCaptureDevice.default(for: .audio)` — the simple default. AVCam uses it for the microphone (`AVCam/Capture/DeviceLookup.swift:49`).
- `AVCaptureDevice.default(_:for:position:)` — the default device of one type and position.
- `AVCaptureDevice.DiscoverySession(deviceTypes:mediaType:position:)` and its `devices` array.
  - The device type list is mandatory. A new device type never appears unless you ask for it.
  - `devices` is sorted in the order of your `deviceTypes` array. With `.unspecified` position, the result is then sorted by position.
  - `devices` is key-value observable. This is how you see an external camera connect or disconnect.
- `AVCaptureDevice.wasConnectedNotification` / `wasDisconnectedNotification`.
- `AVCaptureDevice(uniqueID:)`, `uniqueID`, `localizedName`, `position`, `deviceType`, `isConnected`, `isSuspended`.

Preferred camera (iOS 17):

- `AVCaptureDevice.userPreferredCamera` (class property, read and write). The system stores a short history for each app, across launches and restarts. Set it each time the person selects a camera. A `nil` value has no effect.
- `AVCaptureDevice.systemPreferredCamera` (class property, read-only). It combines the user preference with system knowledge: a newly connected external camera, a suspended camera, a Continuity Camera. Apps must key-value observe it and change the session input when it changes.

Virtual device control:

- `isVirtualDevice`, `constituentDevices` (iOS 13).
- `virtualDeviceSwitchOverVideoZoomFactors`: the zoom factors where the next camera can take over. The count is `constituentDevices.count - 1`.
- `activePrimaryConstituent` (iOS 15, ObjC `activePrimaryConstituentDevice`): which camera supplies the frames now. It is `nil` until the session runs. Key-value observable.
- `setPrimaryConstituentDeviceSwitchingBehavior(_:restrictedSwitchingBehaviorConditions:)` (iOS 15). Behaviors: `.auto`, `.restricted`, `.locked`, `.unsupported`. Restricted conditions: `.videoZoomChanged`, `.focusModeChanged`, `.exposureModeChanged`.
- `fallbackPrimaryConstituentDevices` / `supportedFallbackPrimaryConstituentDevices`: which wider cameras can replace a telephoto camera when the subject is too near or the light is too low.
- **New in iOS 27:** `setPrimaryConstituentDeviceSwitchingBehaviorLockedWith(_:)` (ObjC `setPrimaryConstituentDeviceSwitchingBehaviorLockedWithDevice:`) and `isPrimaryConstituentDeviceSwitchingBehaviorLockedWithDeviceSupported`. You can lock the virtual camera to one specified constituent camera. The zoom factor is clamped to the range of that camera.

### (c) Why AVCam does it this way

`DeviceLookup` (`AVCam/Capture/DeviceLookup.swift`) holds three discovery sessions:

- Back: `[.builtInDualCamera, .builtInWideAngleCamera]` (`:20-22`). The first result is the dual camera when it exists, and the wide camera when it does not.
- Front: `[.builtInTrueDepthCamera, .builtInWideAngleCamera]` (`:23-25`).
- External: `[.external]`, position `.unspecified` (`:26-28`). External cameras have no front or back position.

`cameras` (`:56-76`) returns a maximum of three devices: one back, one front, one external. The switch button cycles through this list (`AVCam/CaptureService.swift:302-322`).

The default camera is `AVCaptureDevice.systemPreferredCamera` (`DeviceLookup.swift:37-44`). In `init`, if the system-preferred camera is `nil`, the code sets `userPreferredCamera` to the back camera (`:31-33`). Session 10106 from WWDC23 says that the system recommends the front camera by default, and that an app that wants the back camera can tell the system.

When the person switches camera, AVCam writes the selection to `userPreferredCamera` (`AVCam/CaptureService.swift:321`). The next launch then starts with the same camera.

`SystemPreferredCameraObserver` (`AVCam/Capture/SPCObserver.swift:10-42`) bridges KVO to an `AsyncStream`:

- `systemPreferredCamera` is a **class** property. Swift key paths cannot observe a class property. So the code uses string-based KVO on the class object: `AVCaptureDevice.self.addObserver(self, forKeyPath: "systemPreferredCamera", options: [.new], context: nil)` (`:25`).
- `observeValue(forKeyPath:…)` yields the new device into the stream (`:32-41`).
- The actor reads the stream in a task and changes the camera when the value is different from the current device (`AVCam/CaptureService.swift:358-369`).

Why: the person who connects a USB camera to an iPad expects the app to use it. Automatic selection with `systemPreferredCamera` is the system convention (FaceTime, Code Scanner, and WebKit do the same, per session 10106).

Alternatives:

- Manual selection only: build your own picker from a discovery session and ignore `systemPreferredCamera` updates.
- Ask for `.builtInTripleCamera` and `.builtInDualWideCamera` first, to get the ultra-wide camera and 0.5x.
- Key-value observe `DiscoverySession.devices` to rebuild a camera list in the UI.

### (d) Pitfalls

- **No ultra-wide in AVCam.** See the back session list above. An iPhone with three back cameras gives the dual camera (wide + telephoto).
- **Discovery order is your priority list.** If `.builtInWideAngleCamera` is first, you never get the virtual device.
- **The observer is never removed.** `SPCObserver.swift` has no `removeObserver` call in `deinit` (`:28-30`). The object lives as long as the app, so this is not a bug in AVCam. In a rebuilt app with a shorter lifetime it is a bug.
- **The stream task holds the actor.** `monitorSystemPreferredCamera()` starts a `Task` that never ends (`AVCam/CaptureService.swift:359-368`).
- **UNVERIFIED: when is `systemPreferredCamera` nil?** The header and the documentation say that it "always returns a device that is present" and is `nil` only when no camera is available. The sample tests for `nil` to set the back camera as the default (`DeviceLookup.swift:31`). The two statements do not agree fully. Test the first launch on a device.
- **Zoom factor 1.0 is not always "1x".** On a virtual device that includes the ultra-wide camera, `videoZoomFactor = 1.0` is the ultra-wide field of view. The wide camera starts at the first switch-over factor (typically 2.0). Use `displayVideoZoomFactorMultiplier` (iOS 18) to show the correct number in the UI.
- **External cameras have fewer functions.** Session 10106: some give only two formats (640x480 and 1280x720), no depth, and possibly not all presets. Use `device.supportsSessionPreset(_:)`. Uncompressed formats are converted to `420v`, compressed formats to `420f`.
- **`fatalError` when no camera is found** (`DeviceLookup.swift:70-74`). Simulator is excluded with `#if !targetEnvironment(simulator)`.
- **`isSuspended` (iOS 14).** A device can exist but give no data. `systemPreferredCamera` takes this into account.

### (e) Beyond AVCam

- `minimumFocusDistance` (iOS 15, millimeters) — useful for a "move back" hint or for a macro switch.
- `nominalFocalLengthIn35mmFilm` (iOS 26) — show "24 mm", "48 mm" labels.
- `AVCaptureDevice.Format.secondaryNativeResolutionZoomFactors` (iOS 16) — zoom factors where the sensor gives a non-upsampled crop (the "optical-quality 2x").
- `AVCaptureDevice.extrinsicMatrix(from:to:)` — geometry between two cameras.
- `DiscoverySession.supportedMultiCamDeviceSets` — which cameras can run together.
- Center Stage, Portrait effect, Studio Light, reactions, background replacement, Edge Light (iOS 26.2): system video effects that the person controls from Control Center. The app reads `isCenterStageActive` and similar properties.
- Smart framing (`AVCaptureSmartFramingMonitor`), dynamic aspect ratio (`setDynamicAspectRatio(_:completionHandler:)`, iOS 26) and lens smudge detection (iOS 26).
- iOS 27.1 inner and outer ultra-wide cameras. Apple's article "Registering a camera capture accessory on iPhone Duo" describes an outer display that faces the subject. This topic belongs to the system-integration agent. It is listed here only because of the two new device types.

### (f) Links

- Choosing a capture device: https://developer.apple.com/documentation/avfoundation/choosing-a-capture-device
- `AVCaptureDevice`: https://developer.apple.com/documentation/avfoundation/avcapturedevice
- `AVCaptureDevice.DeviceType`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct
- `AVCaptureDevice.DiscoverySession`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession
- `systemPreferredCamera`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempreferredcamera
- `userPreferredCamera`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/userpreferredcamera
- `constituentDevices`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/constituentdevices
- `virtualDeviceSwitchOverVideoZoomFactors`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/virtualdeviceswitchovervideozoomfactors
- `activePrimaryConstituent`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituent
- `setPrimaryConstituentDeviceSwitchingBehaviorLockedWith(_:)` (iOS 27): https://developer.apple.com/documentation/avfoundation/avcapturedevice/setprimaryconstituentdeviceswitchingbehaviorlockedwith(_:)
- `builtInOuterUltraWideCamera` (iOS 27.1): https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera
- WWDC23 "Support external cameras in your iPadOS app": https://developer.apple.com/videos/play/wwdc2023/10106/
- WWDC22 "Discover advancements in iOS camera capture: Depth, focus, and multitasking": https://developer.apple.com/videos/play/wwdc2022/110429/

---

## 4. AVCaptureDeviceInput, camera switch, multi-cam

### (a) Concept

`AVCaptureDeviceInput` connects one device to one session. The initializer opens the device and takes exclusive control if necessary. It fails if the device is not available or is in use.

A normal `AVCaptureSession` accepts one camera input at a time. To change camera, remove the old input and add the new input in one configuration transaction.

### (b) Key APIs

- `try AVCaptureDeviceInput(device:)` — throws on failure.
- `input.device`, `input.ports`, `input.ports(for:sourceDeviceType:sourceDevicePosition:)`.
- `session.canAddInput(_:)`, `addInput(_:)`, `removeInput(_:)`.

### (c) Why AVCam does it this way

`changeCaptureDevice(to:)` (`AVCam/CaptureService.swift:325-350`):

1. `beginConfiguration()` with `defer { commitConfiguration() }` (`:330-331`).
2. Remove the current input first (`:334`). This is necessary: `canAddInput` for a second camera returns `false` while the first camera is attached.
3. Try to add the new input (`:337`). If it fails, add the old input again (`:348`). This is a rollback.
4. Renew everything that depends on the device: Camera Control controls (`:339`), the rotation coordinator (`:341`), subject-area observation (`:343`), capabilities (`:345`).

The UI side: `CameraModel.switchVideoDevices()` sets `isSwitchingVideoDevices` (`AVCam/CameraModel.swift:116-120`), and `PreviewContainer` blurs the preview while the flag is true (`AVCam/Views/PreviewContainer.swift:63-66`, `:70-74`). The blur hides the frame gap and the change of field of view.

Why a new rotation coordinator: the coordinator is bound to one device for its life (Apple's rotation article says this directly).

Why the microphone input is not changed: on iOS there is only one microphone capture device. The audio system routes the physical microphone (header text for `.microphone`).

### (d) Pitfalls

- **Per-device state does not move to the new device.** Zoom factor, focus mode, exposure bias, subject-area monitoring, and KVO observers all belong to the old `AVCaptureDevice` object. Apply them again.
- **The preset can become illegal.** A front camera or an external camera does not always support the current preset. A robust switch tests `device.supportsSessionPreset(_:)` or `session.canSetSessionPreset(_:)` after the new input is added.
- **`activeFormat` is replaced.** With a preset, the session selects a new format for the new device. AVCam's HDR state is not applied again after a switch: `changeCaptureDevice` does not call `setHDRVideoEnabled`.
- **Rollback can fail too.** `captureSession.addInput(currentInput)` at `:348` has no `canAddInput` test.
- **A switch during a recording stops the recording.** The movie output's connection changes when the video input changes. (Recording is the video agent's topic.)
- **Mirroring changes.** The preview connection and output connections use `automaticallyAdjustsVideoMirroring` by default. The front camera is mirrored in preview. Session 10106 says that external cameras are also mirrored in the preview layer by default.

### (e) AVCaptureMultiCamSession (mention only)

`AVCaptureMultiCamSession` (iOS 13) is a subclass that accepts more than one camera input at the same time.

- Test `AVCaptureMultiCamSession.isMultiCamSupported` first.
- The preset is always `.inputPriority`. You must set each device's `activeFormat`, and the format must have `isMultiCamSupported == true`. From the iOS 26 SDK this rule is not enforced when only one input is used.
- You normally build the graph by hand with `addInputWithNoConnections`, `addOutputWithNoConnections`, and `AVCaptureConnection(inputPorts:output:)`.
- Watch `hardwareCost` and `systemPressureCost`.
- Sample: AVMultiCamPiP.

### (f) Links

- `AVCaptureDeviceInput`: https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput
- `AVCaptureDeviceInput.init(device:)`: https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/init(device:)
- `AVCaptureMultiCamSession`: https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession
- AVMultiCamPiP sample: https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras
- WWDC19 "Introducing Multi-Camera Capture for iOS": https://developer.apple.com/videos/play/wwdc2019/249/

---

## 5. Preview

### (a) Concept

`AVCaptureVideoPreviewLayer` is a `CALayer` subclass that shows the camera stream. It is not an `AVCaptureOutput`, but the session treats it like one: it has one connection to one video port.

Session 303 gives the reasons to use it: it is tuned for low latency, it does HDR tone mapping, and it keeps CPU and GPU cost low. The limit is that the app gets no access to the frames.

SwiftUI has no native preview view. The standard bridge has three layers:

1. A `UIView` subclass whose backing layer **is** the preview layer (`layerClass`).
2. A `UIViewRepresentable` that makes that view.
3. A way to give the session to the layer without exposing the session to the UI code.

### (b) Key APIs

- `AVCaptureVideoPreviewLayer(session:)` or the `session` property. Setting `session` makes a connection to the first compatible video port.
- `setSessionWithNoConnection(_:)` and `AVCaptureConnection(inputPort:videoPreviewLayer:)` for a hand-built graph.
- `connection` — the layer's connection. This is where preview rotation and mirroring are set.
- `videoGravity: AVLayerVideoGravity`:
  - `.resizeAspect` (default): show all of the image, with black bars if the shapes differ.
  - `.resizeAspectFill`: fill the layer, crop the image.
  - `.resize`: stretch (do not use for a camera).
- `isPreviewing` (iOS 13, key-value observable): true when frames are on screen.
- Coordinate conversion:
  - `captureDevicePointConverted(fromLayerPoint:)` — layer point to device point (0,0)-(1,1). ObjC name: `captureDevicePointOfInterestForPoint:`.
  - `layerPointConverted(fromCaptureDevicePoint:)` — the reverse.
  - `metadataOutputRectConverted(fromLayerRect:)`, `layerRectConverted(fromMetadataOutputRect:)`, `transformedMetadataObject(for:)` — for barcodes and faces.
- `isDeferredStartSupported` / `isDeferredStartEnabled` (iOS 26). The default for a preview layer is `false`.

### (c) Why AVCam does it this way

**The view** — `PreviewView` (`AVCam/Views/CameraPreview.swift:34-70`):

- `override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }` (`:55-57`). The view's own layer is the preview layer. There is no sublayer to resize in `layoutSubviews`. Auto Layout, animation, and rotation of the view apply to the preview automatically.
- `previewLayer` is a typed accessor with a forced cast (`:59-61`).
- In Simulator the view shows a static image (`:38-47`), because Simulator has no camera.

**The representable** — `CameraPreview` (`:11-29`): `makeUIView` creates the view and calls `source.connect(to:)`. `updateUIView` is empty. The view has no SwiftUI state to apply.

**The indirection** — `PreviewSource` and `PreviewTarget` (`:79-102`):

- The session is private inside the actor (`AVCam/CaptureService.swift:31`).
- The actor exposes `nonisolated let previewSource: PreviewSource` (`:28`), created in `init` (`:75-78`).
- The UI calls `source.connect(to: target)`. The source calls `target.setSession(session)`. The UI code never has a variable of type `AVCaptureSession`.
- `setSession` is `nonisolated` and hops to the main actor to set `previewLayer.session` (`CameraPreview.swift:63-69`).
- A second benefit: `PreviewCameraModel` can supply a fake source for SwiftUI previews.

**Aspect ratio in SwiftUI, not in `videoGravity`.** AVCam never sets `videoGravity`, so the layer uses `.resizeAspect`. In a compact size class, `PreviewContainer` gives the preview an aspect ratio of 3:4 in photo mode and 9:16 in video mode (`AVCam/Views/PreviewContainer.swift:12-13`, `:45-53`, `:94-96`). The layer then has the same shape as the video, so there are no bars and no crop. The person sees exactly what the capture contains. In a regular size class the preview fills the screen (`:54-57`) and the layer letterboxes.

**Tap to focus.** `CameraView` has `.onTapGesture { location in … }` on the preview (`AVCam/CameraView.swift:51-53`). The location is in the view's coordinate space, which is also the layer's coordinate space. The actor converts it with `captureDevicePointConverted(fromLayerPoint:)` (`AVCam/CaptureService.swift:431`). This conversion handles gravity, rotation, and mirroring. Do not do the math by hand.

**Transitions.** `PreviewContainer` blurs during mode and camera changes (`:63-66`) and covers the preview with black during background (`:64`, `:81-92`). See section 9.

Alternatives:

- `AVCaptureVideoDataOutput` + Metal (`CAMetalLayer` or `MTKView`) or `AVSampleBufferDisplayLayer`: necessary for filters, custom overlays in the frame, or analysis of each frame. The cost is more power, more code, your own tone mapping, and manual deferred start (section 9).
- `UIViewControllerRepresentable` around a UIKit camera screen.
- A sublayer (`view.layer.addSublayer(previewLayer)`): works, but you must set the frame on each layout pass.

### (d) Pitfalls

- **Order dependency that can crash.** `CaptureService.videoPreviewLayer` finds the layer through `captureSession.connections` and calls `fatalError` if there is none (`AVCam/CaptureService.swift:416-422`). The layer is connected in a `Task { @MainActor in … }` from `makeUIView` (`CameraPreview.swift:66-68`). `setUpSession()` needs the layer at `:158`. The order works today because the view is built before `.task { await camera.start() }` reaches session setup (`AVCam/AVCamApp.swift:25-28`). A rebuilt app must not depend on this timing. Apple's newer rotation article removes the dependency: the coordinator accepts a `nil` layer and is made again when the layer joins a window.
- **Layer access off the main thread.** `captureDevicePointConverted(fromLayerPoint:)` runs on the session queue (`:431`). It reads layer geometry that the main thread owns. Convert the point on the main actor and send the device point to the actor.
- **The session is modified from two threads.** `previewLayer.session = session` on the main thread adds a connection to the session while the actor can be in the middle of setup.
- **Wrong tap point if the gesture is on a different view.** The point must be in the preview layer's coordinates. A gesture on a parent view with an offset (AVCam offsets the preview by -44 points in photo mode, `PreviewContainer.swift:35`, `:53`) gives a wrong result.
- **`.resizeAspectFill` hides part of the image.** The capture then contains more than the person saw.
- **No focus indicator.** AVCam does not draw the yellow square. Use `layerPointConverted(fromCaptureDevicePoint:)` if the device point is the source of truth.
- **Preview is not available on visionOS** (`API_UNAVAILABLE(visionos)` on the class).

### (e) Beyond AVCam

- `isPreviewing` KVO: the exact moment to remove a cover or a blur. AVCam uses a fixed 0.3 s fade.
- `connection.isEnabled = false` stops the preview without stopping the session.
- `connection.isVideoMirrored` with `automaticallyAdjustsVideoMirroring = false`: let the person turn off mirroring (important for external cameras, per session 10106).
- `connection.preferredVideoStabilizationMode = .previewOptimized` (iOS 17) for a stabilized preview.
- More than one preview layer, with `isDeferredStartEnabled = true` on the secondary layers.

### (f) Links

- `AVCaptureVideoPreviewLayer`: https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer
- `videoGravity`: https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/videogravity
- `AVLayerVideoGravity`: https://developer.apple.com/documentation/avfoundation/avlayervideogravity
- `captureDevicePointConverted(fromLayerPoint:)`: https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/capturedevicepointconverted(fromlayerpoint:)
- `layerPointConverted(fromCaptureDevicePoint:)`: https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/layerpointconverted(fromcapturedevicepoint:)
- `isPreviewing`: https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/ispreviewing
- `UIView.layerClass`: https://developer.apple.com/documentation/uikit/uiview/layerclass
- `UIViewRepresentable`: https://developer.apple.com/documentation/swiftui/uiviewrepresentable
- AVCam article: https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app

---

## 6. Rotation

### (a) Concept

A camera sensor has a fixed physical orientation. When the person turns the device, the sensor data does not turn. The app must tell the pipeline how many degrees to rotate.

There are **two different angles**:

- **Preview angle**: how much to rotate the video so that it is level in the preview layer. It depends on the device orientation **and** on where the layer is in the interface.
- **Capture angle**: how much to rotate photos and movies so that they are level relative to gravity. It depends only on the physical orientation of the camera.

They differ when the interface does not rotate with the device. AVCam on iPhone is portrait-only (`AVCam.xcodeproj/project.pbxproj:933`). When the person turns the iPhone to landscape, the UI and the preview angle do not change, but the capture angle changes. The photo is then correct in landscape.

`AVCaptureDevice.RotationCoordinator` (iOS 17) computes the two angles. It replaces `AVCaptureVideoOrientation`.

Why the old API is deprecated (session 10106): the orientation enum describes the iPad, and assumes that the camera turns with the device. An external camera does not turn with the iPad. For external cameras the coordinator returns 0 degrees.

### (b) Key APIs

- `AVCaptureDevice.RotationCoordinator(device:previewLayer:)`. The layer is optional and can be any `CALayer`. The coordinator holds the device and the layer weakly.
- `videoRotationAngleForHorizonLevelPreview: CGFloat` — degrees. Returns 0 if there is no layer, or the layer is not in a view hierarchy.
- `videoRotationAngleForHorizonLevelCapture: CGFloat` — degrees.
- Both are key-value observable. The coordinator delivers updates **on the main queue** (header).
- `AVCaptureConnection.videoRotationAngle` (iOS 17) and `isVideoRotationAngleSupported(_:)`. Only 0, 90, 180, 270 are legal. An unsupported value throws.
- **Deprecated in iOS 17:** `AVCaptureConnection.videoOrientation`, `isVideoOrientationSupported`. (The much older `AVCaptureVideoPreviewLayer.orientation` was deprecated in iOS 6.)
- **New in iOS 27:** `videoRotationAngleRelative(toDeviceOrientation:)` — a static angle for a given orientation, independent of how the device is held now. It takes an `AVCaptureVideoOrientation` value, so that enum is still used as a parameter type.

What "rotation" does in each output (header `AVCaptureSession.h:1085`):

| Destination | How the angle is applied | Cost |
|---|---|---|
| Preview layer | A transform on the layer contents | Very low |
| `AVCapturePhotoOutput` | An Exif orientation tag | Very low |
| `AVCaptureMovieFileOutput` | A QuickTime track matrix | Very low |
| `AVCaptureVideoDataOutput`, `AVCaptureDepthDataOutput` | The pixel buffers are physically rotated | High. Set it before `startRunning()` |

### (c) Why AVCam does it this way (local repository)

`createRotationCoordinator(for:)` (`AVCam/CaptureService.swift:374-401`):

1. Make a coordinator for the device and the preview layer (`:376`).
2. Apply the two angles immediately (`:379-380`). KVO only reports later changes. Without this step the preview is sideways until the first rotation.
3. Drop the old observers (`:383`).
4. Observe the two properties with block-based KVO (`:386-400`). Each change starts a `Task` that calls back into the actor.

`updatePreviewRotation` sets `connection?.videoRotationAngle` on the main actor (`:403-409`). `updateCaptureRotation` sends the angle to each output service (`:411-414`), which sets it on its video connection (`AVCam/Model/DataTypes.swift:152-156`).

The method is called at setup (`:158`) and after each camera change (`:341`).

**The newer Apple design (documentation only, not in this repository).** The article "Supporting device rotation in your camera app" (sample code for Xcode 27) moves this work to a `@MainActor final class RotationObserver`:

- The coordinator is made and observed on the main actor, where its updates arrive.
- KVO handlers use `MainActor.assumeIsolated { … }`, so each change is applied synchronously and in order.
- The preview angle is set directly on the layer's connection.
- The capture angle goes to the actor through an `AsyncStream<CGFloat>` with `.bufferingNewest(1)`.
- The observer gets the layer two times: at connection, and again in `PreviewView.didMoveToWindow()`. A coordinator made with a `nil` layer never reports a preview angle, so the observer makes a new coordinator when the layer arrives.
- `addOutput` applies the stored capture angle to each new output, because a new connection starts with the default angle.

The tutorial can show the local version first and then refactor to this version. The refactor has clear teaching value (ordering, isolation, life cycle).

### (d) Pitfalls

- **Unordered updates in the local code.** Each KVO change makes an unstructured `Task` into the actor (`:390`, `:398`), and the preview update makes a second `Task` to the main actor (`:405`). Tasks do not guarantee order. A fast sequence of rotations can end on an old angle. Apple's article names this problem.
- **New outputs start with the default angle.** In the local code, `setCaptureMode(.video)` adds the movie output (`:285`) and does not apply the current capture angle. The angle is only applied at the next rotation change or camera change. A video that starts immediately after a mode switch, with the phone in landscape, can have the wrong rotation. Apple's newer `addOutput` fixes this.
- **A layer that is not in a window gives 0 degrees** for the preview angle (header).
- **The coordinator is created on the session queue** in the local code, with a layer that belongs to the main thread.
- **Front camera on recent iPads.** The header says: from the spring 2024 iPad line, the default `videoRotationAngle` for video data from the front camera is 180 degrees. Code that rotates buffers itself must include the default value.
- **ProRes RAW buffers cannot be rotated.** Set the angle to 0 on that video data connection.
- **Do not compute angles from `UIDevice.orientation`.** It fails for face-up, for external cameras, and for multi-window iPad layouts.

### (e) Beyond AVCam

- Pass an `AVSampleBufferDisplayLayer` or a `CAMetalLayer` as the preview layer when you draw the preview yourself.
- Level indicator, horizon lock UI, or a "portrait lock" option: use the capture angle for the output and keep the UI fixed.
- `videoRotationAngleRelative(toDeviceOrientation:)` (iOS 27) for an explicit orientation choice, for example a "record in landscape always" setting.

### (f) Links

- Supporting device rotation in your camera app: https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app
- `AVCaptureDevice.RotationCoordinator`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator
- `videoRotationAngleForHorizonLevelPreview`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelpreview
- `videoRotationAngleForHorizonLevelCapture`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture
- `videoRotationAngleRelative(toDeviceOrientation:)` (iOS 27): https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationanglerelative(todeviceorientation:)
- `AVCaptureConnection.videoRotationAngle`: https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle
- `AVCaptureConnection.videoOrientation` (deprecated iOS 17): https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videoorientation
- WWDC23 session 10106 (introduces the coordinator): https://developer.apple.com/videos/play/wwdc2023/10106/

---

## 7. Focus, exposure, and the other device controls

### (a) Concept

Hardware settings belong to `AVCaptureDevice`, not to the session. The rule for each setting is the same:

1. Test that the device supports the value (`isFocusModeSupported(_:)` and similar).
2. `try device.lockForConfiguration()`.
3. Set the value.
4. `device.unlockForConfiguration()`.

A set without the lock throws `NSGenericException`. A set of an unsupported value throws `NSInvalidArgumentException` or `NSRangeException`. These are Objective-C exceptions. Swift `do/catch` does not catch them. The app crashes.

The lock is a cross-process lock on the device. Hold it only as long as necessary (header: an unnecessary lock can lower capture quality in other apps that share the device).

**The three-mode pattern.** Focus, exposure, and white balance each have the same three modes:

| Mode | Focus | Exposure | White balance |
|---|---|---|---|
| Locked | `.locked` | `.locked` | `.locked` |
| One time, then locked | `.autoFocus` | `.autoExpose` | `.autoWhiteBalance` |
| Continuous | `.continuousAutoFocus` | `.continuousAutoExposure` | `.continuousAutoWhiteBalance` |

Exposure has a fourth mode, `.custom` (manual duration and ISO).

**Point of interest.** Focus and exposure can use a point in device coordinates: (0,0) is the top left and (1,1) is the bottom right of the **unrotated** sensor image. The default is (0.5, 0.5). The header is explicit: setting the point alone does nothing. You must set the point, and then set the mode, to start the operation.

**Subject area change monitoring.** After a tap, the camera is locked on one place. When the scene changes much (light or movement), the device can post `AVCaptureDevice.subjectAreaDidChangeNotification`. The app then goes back to continuous mode at the center. This is how the system Camera app behaves.

### (b) Key APIs

Focus:

- `focusMode`, `isFocusModeSupported(_:)`, `focusPointOfInterest`, `isFocusPointOfInterestSupported`, `isAdjustingFocus` (KVO).
- `lensPosition` (0.0 nearest to 1.0 farthest; 1.0 is not infinity; the value is not a distance and differs between devices).
- `setFocusModeLocked(lensPosition:completionHandler:)`, `isLockingFocusWithCustomLensPositionSupported`, `AVCaptureDevice.currentLensPosition`.
- `autoFocusRangeRestriction` (`.none`, `.near`, `.far`), `isSmoothAutoFocusEnabled` (slower, better for movies).
- `isFaceDrivenAutoFocusEnabled` with `automaticallyAdjustsFaceDrivenAutoFocusEnabled` (iOS 15.4).
- `minimumFocusDistance` (iOS 15).
- iOS 26: `focusRectOfInterest`, `isFocusRectOfInterestSupported`, `minFocusRectOfInterestSize`, `defaultRectForFocusPoint(ofInterest:)`.
- iOS 26: Cinematic video focus (`setCinematicVideoTrackingFocus(at:focusMode:)` and related methods).
- iOS 27: `isContinuousAutoFocusTrackingEnabled`, `continuousAutoFocusTrackingLensPositionBias`, `isContinuousAutoFocusTrackingSubjectAcquired`, and `Format.isContinuousAutoFocusTrackingSupported`.

Exposure:

- `exposureMode`, `isExposureModeSupported(_:)`, `exposurePointOfInterest`, `isExposurePointOfInterestSupported`, `isAdjustingExposure` (KVO).
- `exposureDuration`, `iso`, `lensAperture` (read-only, KVO).
- `setExposureModeCustom(duration:iso:completionHandler:)` with `AVCaptureDevice.currentExposureDuration` and `AVCaptureDevice.currentISO`. Ranges: `activeFormat.minExposureDuration`…`maxExposureDuration`, `minISO`…`maxISO`.
- `setExposureTargetBias(_:completionHandler:)`, `exposureTargetBias`, `minExposureTargetBias`, `maxExposureTargetBias` (EV units), `exposureTargetOffset` (a light meter: metered level minus target).
- `activeMaxExposureDuration` (iOS 12): the longest shutter time that auto exposure can use.
- `isFaceDrivenAutoExposureEnabled` (iOS 15.4).
- iOS 26: `exposureRectOfInterest` and related properties.
- iOS 27: see (e).

Subject area: `isSubjectAreaChangeMonitoringEnabled`, `AVCaptureDevice.subjectAreaDidChangeNotification`.

### (c) Why AVCam does it this way

One method does everything: `focusAndExpose(at:isUserInitiated:)` (`AVCam/CaptureService.swift:454-479`).

| | User tap | Subject area changed |
|---|---|---|
| Point | The tapped point | (0.5, 0.5) |
| Focus mode | `.autoFocus` (one time, then locked) | `.continuousAutoFocus` |
| Exposure mode | `.autoExpose` (one time, then locked) | `.continuousAutoExposure` |
| Subject area monitoring | on | off |

- Each set is guarded by the two capability tests (`:462`, `:468`). The front camera on many devices has a fixed focus. Without the guard the app would crash.
- The point is set before the mode (`:463-464`, `:469-470`). This is the order that the header requires.
- `isSubjectAreaChangeMonitoringEnabled = isUserInitiated` (`:475`): monitoring is only on while the camera is locked on a tapped point.
- `observeSubjectAreaChanges(of:)` (`:441-451`) reads the notification as an async sequence, filtered by `object: device`. The old task is cancelled when the camera changes (`:443`).
- The public entry point converts the view point to a device point (`:429-438`).

Why this design: it copies the behavior that people know from the system Camera app. Tap locks. A big scene change releases the lock.

Alternatives:

- Stay in continuous mode after a tap (set the point, then set `.continuousAutoFocus` again). The camera then follows the point but never locks.
- Long-press for "AE/AF lock": set `.locked` for both and turn monitoring off.
- Separate focus and exposure points (two-finger gesture, as in some pro apps).
- Use the iOS 26 rectangle of interest for a bigger or smaller metering area.

### (d) Pitfalls

- **Objective-C exceptions crash the app.** Always test support first.
- **A missing `unlockForConfiguration()`.** In AVCam, an early `throw` between lock and unlock is not possible, but in your own code use `defer { device.unlockForConfiguration() }` immediately after the lock.
- **The lock and `activeFormat`.** To change format and frame rate together, put the lock inside `beginConfiguration()`/`commitConfiguration()` (header `AVCaptureDevice.h:384` discussion). AVCam does this for HDR (`AVCam/CaptureService.swift:501-508`).
- **`currentDevice` is read two times around the lock** in `setHDRVideoEnabled` (`:505-508`). Read it one time into a local constant, as `focusAndExpose` does (`:456`).
- **Device coordinates are sensor coordinates.** In portrait, a tap at the top of the screen is not y = 0. Use the layer conversion method.
- **Custom exposure and photo quality.** The header says: with `photoQualityPrioritization` at `.balanced` or `.quality`, the photo pipeline can replace your ISO and duration in a dark scene (multi-image fusion). Only `.speed` guarantees your manual values in the photo. AVCam sets `maxPhotoQualityPrioritization = .quality` (`AVCam/Capture/PhotoCapture.swift:123`).
- **Completion handler timestamps** are on the device clock. Convert them to `session.synchronizationClock` before a comparison with buffer timestamps.
- **Exposure bias in custom mode** only changes the meter (`exposureTargetOffset`) when no parameter is "auto". It does not change the image.
- **Format change resets things.** Frame durations, `activeMaxExposureDuration`, points and rectangles of interest, and `isAutoVideoFrameRateEnabled` go back to defaults when `activeFormat` or the preset changes.

### (e) What the hardware and the API can do beyond AVCam

AVCam's only uses of these controls are tap-to-focus and the three Camera Control sliders (zoom, exposure bias, lens position; `AVCam/CaptureService.swift:230-262`). Everything below is not used by the app UI.

**White balance**

- Modes: `whiteBalanceMode` with `.locked`, `.autoWhiteBalance`, `.continuousAutoWhiteBalance`.
- Manual: `setWhiteBalanceModeLocked(with: gains, completionHandler:)`. Gains are `AVCaptureDevice.WhiteBalanceGains` (red, green, blue), each between 1.0 and `maxWhiteBalanceGain`.
- Conversions: `deviceWhiteBalanceGains(for: temperatureAndTint)`, `temperatureAndTintValues(for: gains)`, `chromaticityValues(for:)`.
- `grayWorldDeviceWhiteBalanceGains`: use it to set white balance from a gray card.
- iOS 26: ready-made values `.tungsten`, `.fluorescent`, `.daylight`, `.cloudy`, `.shadow` on `WhiteBalanceTemperatureAndTintValues`, and a setter that takes temperature and tint directly (`setWhiteBalanceModeLocked(whiteBalanceTemperatureAndTintValues:handler:)`).

**Exposure bias**: `setExposureTargetBias(_:)` between `minExposureTargetBias` and `maxExposureTargetBias`. `Format.systemRecommendedExposureBiasRange` (iOS 18) gives the range for a slider.

**Custom exposure (shutter and ISO)**: `setExposureModeCustom(duration:iso:)`. A long duration lowers the frame rate: `activeVideoMaxFrameDuration` grows to fit.

**iOS 27 — aperture and priority modes** (all verified in the header):

- `setExposureModeCustom(lensAperture:duration:iso:completionHandler:)`. Each of the three parameters accepts a number, a "current" constant (lock at the current value), or an "auto" constant (the system continues to control it).
- Constants: `AVCaptureDevice.currentLensAperture`, `.autoLensAperture`, `.autoExposureDuration`, `.autoISO`.
- This gives the classic camera modes: shutter priority (duration fixed, ISO auto), aperture priority, ISO priority. Test each combination with `Format.supportsExposureModeCustom(lensAperture:duration:iso:)`.
- `lensAperture` is now a physical, variable f-number. Range: `Format.minLensAperture`, `maxLensAperture`, `defaultLensAperture`, `recommendedLensApertureStops`.
- `autoExposureLensApertureRateLimit`: how fast auto exposure can move the aperture.
- `automaticallyAdjustsLensAperture`, `automaticallyAdjustsExposureDuration`, `automaticallyAdjustsISO`: read-only state.
- Exposure signals: `supportedExposureSignals`, `enabledExposureSignals`, `activeExposureSignals`, `automaticallyEnablesExposureSignals`. Signal values: subject motion, group photo, document, starburst, flicker. They tell auto exposure which scene properties can change the aperture or the shutter time.

**Zoom**

- `videoZoomFactor` (needs the lock). Range: `minAvailableVideoZoomFactor`…`maxAvailableVideoZoomFactor`. The absolute maximum is `activeFormat.videoMaxZoomFactor`.
- `ramp(toVideoZoomFactor:withRate:)`: smooth zoom. The factor is multiplied by 2^(rate × time), so a rate of 1.0 doubles the zoom each second. `cancelVideoZoomRamp()`, `isRampingVideoZoom`.
- `Format.videoZoomFactorUpscaleThreshold`: above this factor the image is upscaled (digital zoom with quality loss).
- `Format.secondaryNativeResolutionZoomFactors` (iOS 16): factors with a non-upsampled sensor crop.
- `Format.systemRecommendedVideoZoomRange` (iOS 18): the range for a slider. `AVCaptureSystemZoomSlider` uses it.
- `displayVideoZoomFactorMultiplier` (iOS 18): multiply `videoZoomFactor` by this value to get the number that Apple UIs show.
- Virtual devices: `virtualDeviceSwitchOverVideoZoomFactors` gives the positions of the lens buttons.

**Torch** (a continuous light, different from the photo flash)

- `hasTorch`, `isTorchAvailable` (false when the device is too hot), `isTorchActive`, `torchLevel`.
- `torchMode` (`.off`, `.on`, `.auto`) and `try setTorchModeOn(level:)` with 0…1 or `AVCaptureDevice.maxAvailableTorchLevel`. The error is `AVError.Code.torchLevelUnavailable`.
- Flash is not a device setting now. It is `AVCapturePhotoSettings.flashMode` (the device `flashMode` property has been deprecated since iOS 10).

**Low light**

- `isLowLightBoostSupported`, `automaticallyEnablesLowLightBoostWhenAvailable`, `isLowLightBoostEnabled` (KVO). The switch can drop frames.
- `isAutoVideoFrameRateEnabled` (iOS 18) with `Format.isAutoVideoFrameRateSupported`: the device lowers the frame rate in low light (30 → 24, or 60 → 30 → 24).
- iOS 27, on the connection: `isLowLightVideoNoiseReductionSupported`, `automaticallyEnablesLowLightVideoNoiseReduction` (default `true` for movie file output connections), `isLowLightVideoNoiseReductionEnabled`.

**Formats and frame rates**

- `device.formats` and `device.activeFormat` (`AVCaptureDevice.Format`).
- A format describes: dimensions and pixel format (`formatDescription`), `videoSupportedFrameRateRanges` (`AVFrameRateRange`), `videoFieldOfView`, `isVideoBinned`, `supportedMaxPhotoDimensions`, `supportedColorSpaces`, `isVideoHDRSupported`, `isVideoStabilizationModeSupported(_:)`, `isMultiCamSupported`, `isHighestPhotoQualitySupported`, `autoFocusSystem` (contrast or phase detection), and more.
- Frame rate: `activeVideoMinFrameDuration` (the reciprocal of the maximum frame rate) and `activeVideoMaxFrameDuration` (the reciprocal of the minimum frame rate). Set both to the same value for a fixed rate. Set `.invalid` to go back to the default.
- AVCam's only format code is the 10-bit search in `AVCam/Support/CaptureExtensions.swift:23-40`. It finds a format with the same dimensions and the same maximum frame rate, and with the pixel format `420YpCbCr10BiPlanarVideoRange`.
- Other device switches: `isVideoHDREnabled` / `automaticallyAdjustsVideoHDREnabled`, `activeColorSpace`, `isGlobalToneMappingEnabled`, `isGeometricDistortionCorrectionEnabled` (ultra-wide lens correction).

### (f) Links

- `lockForConfiguration()`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()
- `AVCaptureDevice.FocusMode`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.enum
- `focusPointOfInterest`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/focuspointofinterest
- `AVCaptureDevice.ExposureMode`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.enum
- `exposurePointOfInterest`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposurepointofinterest
- `isSubjectAreaChangeMonitoringEnabled`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/issubjectareachangemonitoringenabled
- `subjectAreaDidChangeNotification`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/subjectareadidchangenotification
- `setFocusModeLocked(lensPosition:completionHandler:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/setfocusmodelocked(lensposition:completionhandler:)
- `setExposureModeCustom(duration:iso:completionHandler:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuremodecustom(duration:iso:completionhandler:)
- `setExposureModeCustom(lensAperture:duration:iso:completionHandler:)` (iOS 27): https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuremodecustom(lensaperture:duration:iso:completionhandler:)
- `setExposureTargetBias(_:completionHandler:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuretargetbias(_:completionhandler:)
- `setWhiteBalanceModeLocked(with:completionHandler:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/setwhitebalancemodelocked(with:completionhandler:)
- `videoZoomFactor`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor
- `ramp(toVideoZoomFactor:withRate:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/ramp(tovideozoomfactor:withrate:)
- `displayVideoZoomFactorMultiplier`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier
- `setTorchModeOn(level:)`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/settorchmodeon(level:)
- `automaticallyEnablesLowLightBoostWhenAvailable`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/automaticallyenableslowlightboostwhenavailable
- `AVCaptureDevice.Format`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/format
- `activeFormat`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat
- `focusRectOfInterest` (iOS 26): https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusrectofinterest
- `isContinuousAutoFocusTrackingEnabled` (iOS 27): https://developer.apple.com/documentation/avfoundation/avcapturedevice/iscontinuousautofocustrackingenabled
- `activeExposureSignals` (iOS 27): https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeexposuresignals

---

## 8. Session life cycle and robustness

### (a) Concept

A running session can stop for reasons that the app does not control. There are two classes of event:

- **Interruption**: the system takes the hardware away for some time. The session stops automatically and starts again automatically when the interruption ends. The app's job is to update the UI.
- **Runtime error**: something failed. The session stops and does not start again alone. The app must decide what to do.

Interruption reasons (`AVCaptureSession.InterruptionReason`, header `AVCaptureSession.h:72-85`):

| Reason | Raw value | Typical cause | What to do |
|---|---|---|---|
| `.videoDeviceNotAvailableInBackground` | 1 | The app went to the background | Nothing. The session resumes in the foreground if you did not call `stopRunning()` |
| `.audioDeviceInUseByAnotherClient` | 2 | Phone call, alarm | Show a message. A recording stops |
| `.videoDeviceInUseByAnotherClient` | 3 | A different app or session took the camera | Show a message, or a "resume" button |
| `.videoDeviceNotAvailableWithMultipleForegroundApps` | 4 | iPad Split View, Slide Over, Stage Manager | Show "camera not available with multiple apps", or adopt multitasking camera access |
| `.videoDeviceNotAvailableDueToSystemPressure` | 5 (iOS 11.1) | Heat or power limit | Show a message. `userInfo` also has `AVCaptureSessionInterruptionSystemPressureStateKey` |
| `.sensitiveContentMitigationActivated` | 6 (iOS 26) | An `SCVideoStreamAnalyzer` found sensitive content | Call the analyzer's `continueStream` to resume |

### (b) Key APIs

Notifications (object = the session):

- `AVCaptureSession.wasInterruptedNotification` — `userInfo[AVCaptureSessionInterruptionReasonKey]` is an `NSNumber`.
- `AVCaptureSession.interruptionEndedNotification`.
- `AVCaptureSession.runtimeErrorNotification` — `userInfo[AVCaptureSessionErrorKey]` is an `NSError` (bridge to `AVError`).
- `AVCaptureSession.didStartRunningNotification` / `didStopRunningNotification`.

State: `isRunning`, `isInterrupted` (both KVO).

Useful error codes (`AVError.h`): `.mediaServicesWereReset` (-11819), `.sessionHardwareCostOverage` (-11872), `.unsupportedDeviceActiveFormat` (-11873), `.deviceWasDisconnected` (-11808), `.deviceAlreadyUsedByAnotherSession` (-11804), `.sessionWasInterrupted` (-11818), `.applicationIsNotAuthorizedToUseDevice` (-11852).

System pressure: `device.systemPressureState` (KVO) with `level` (`.nominal`, `.fair`, `.serious`, `.critical`, `.shutdown`) and `factors` (`.systemTemperature`, `.peakPower`, `.depthModuleTemperature`).

iPad multitasking (iOS 16): `isMultitaskingCameraAccessSupported`, `isMultitaskingCameraAccessEnabled`.

### (c) Why AVCam does it this way

`observeNotifications()` (`AVCam/CaptureService.swift:551-579`) starts three tasks. Each task reads one notification as an `AsyncSequence` with `NotificationCenter.default.notifications(named:)`.

1. **Interrupted** (`:552-559`): read the reason, and set `isInterrupted = true` only for `.audioDeviceInUseByAnotherClient` and `.videoDeviceInUseByAnotherClient`.
   - Why only these two: the background interruption is normal and must not show an error. The other reasons are less common.
2. **Interruption ended** (`:561-566`): set `isInterrupted = false`.
3. **Runtime error** (`:568-578`): if the error is `.mediaServicesWereReset` and the session is not running, call `startRunning()` again.
   - Why: when the media server process restarts, all capture objects are valid but the session is stopped. A restart is the documented recovery.

Why async sequences: the `for await` loops run inside the actor, so they can change actor state without a hop. This is shorter than selector-based observers.

Why there is no `stopRunning()` call: the system interrupts the session in the background and restarts it in the foreground. The header says that this works only if you do not call `stopRunning()` yourself. A camera-only app does not need more.

The app start: `.task { await camera.start() }` on the root view (`AVCam/AVCamApp.swift:25-28`). On each return to the foreground the app synchronizes shared state with the capture extension (`:31-36`). It does not touch the session.

### (d) Pitfalls

- **The interruption state never reaches the UI.** See "Most important findings", item 5. To repair it: observe `captureService.$isInterrupted.values` in `CameraModel.observeState()` and map it to `status = .interrupted` / `.running`.
- **Most reasons are ignored.** Multiple foreground apps (iPad), system pressure, and sensitive content give no feedback.
- **`status == .running` is not the session state.** It is set one time after `start` returns (`AVCam/CameraModel.swift:80`). The controls that use `hidden(until: camera.status == .running)` (section 9) appear even if the session failed to start. Use KVO on `isRunning`, or `didStartRunningNotification`, for a true state.
- **Only one runtime error is handled.** `.sessionHardwareCostOverage`, `.deviceWasDisconnected` (external camera), and others are dropped without a log line.
- **No `object:` filter.** The three observers accept notifications from any session in the process (`:553`, `:563`, `:569`). With one session this is fine. Pass `object: captureSession` in a rebuilt app.
- **The tasks never end.** They are not stored and not cancelled. For an app-lifetime actor this is acceptable.
- **`AVCaptureSession.InterruptionReason(rawValue:)` returns `nil` for an unknown value.** The `compactMap` at `:555` then drops the event. A new reason in a later OS is ignored silently.
- **No multitasking camera access.** On iPad in Split View or Stage Manager, AVCam's camera is interrupted with reason 4 and the app shows nothing.
- **A recording that is interrupted** ends with an error in the movie delegate. (Video agent's topic.)
- **Background cover and interruptions are separate.** The black cover uses `scenePhase` (section 9), not the interruption notifications. A phone call overlay does not change `scenePhase` to `.background`.

### (e) Beyond AVCam

**Multitasking camera access on iPad** (article "Accessing the camera while multitasking on iPad"):

- Test `isMultitaskingCameraAccessSupported`, then set `isMultitaskingCameraAccessEnabled = true` before the session starts.
- Header: before iOS 18, "supported" is true on iPads that support Stage Manager with an extended display. For apps linked with iOS 18 or later, it is true for video-conference apps (apps with the `voip` background mode). It is also true with the entitlement `com.apple.developer.avfoundation.multitasking-camera-access` (the documentation page marks the entitlement deprecated in iOS 18).
- Apple does not recommend it for apps that use heavy capture (4K video, ProRAW, Deep Fusion).
- With it enabled, reason 4 is not sent.
- After a multitasking recording the system shows a one-time quality notice.

**System pressure**: observe `device.systemPressureState`. At `.serious` or `.critical`, lower the frame rate (`activeVideoMinFrameDuration`), select a binned or lower-resolution format, turn off HDR, and reduce GPU work. At `.shutdown` the session is interrupted. Session 303 has a chapter on this.

**Hardware cost**: test `session.hardwareCost <= 1.0` after the commit (session 303 code sample).

**A resume button**: for `.videoDeviceInUseByAnotherClient`, older AVCam versions showed a "Resume" button that calls `startRunning()` again.

**Explicit stop**: an app where the camera is one screen of many must call `stopRunning()` when the screen closes (on the session queue), and `startRunning()` when it opens.

**KVO on `isRunning` and `isInterrupted`**: the most direct source for a status model.

### (f) Links

- `wasInterruptedNotification`: https://developer.apple.com/documentation/avfoundation/avcapturesession/wasinterruptednotification
- `interruptionEndedNotification`: https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionendednotification
- `runtimeErrorNotification`: https://developer.apple.com/documentation/avfoundation/avcapturesession/runtimeerrornotification
- `AVCaptureSession.InterruptionReason`: https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason
- `AVCaptureSessionInterruptionReasonKey`: https://developer.apple.com/documentation/avfoundation/avcapturesessioninterruptionreasonkey
- `sensitiveContentMitigationActivated` (iOS 26): https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/sensitivecontentmitigationactivated
- `AVError.Code.mediaServicesWereReset`: https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/mediaserviceswerereset
- `isRunning`: https://developer.apple.com/documentation/avfoundation/avcapturesession/isrunning
- `isInterrupted`: https://developer.apple.com/documentation/avfoundation/avcapturesession/isinterrupted
- Accessing the camera while multitasking on iPad: https://developer.apple.com/documentation/avkit/accessing-the-camera-while-multitasking-on-ipad
- `isMultitaskingCameraAccessEnabled`: https://developer.apple.com/documentation/avfoundation/avcapturesession/ismultitaskingcameraaccessenabled
- `systemPressureState`: https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempressurestate-swift.property
- `notifications(named:object:)`: https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:)

---

## 9. Deferred start and launch performance (new)

### (a) Concept

Session 303 divides a camera launch into four stages:

1. The app launches (binary load, static initializers, UI scenes).
2. The session is configured and started.
3. All capture outputs initialize. This is the most expensive stage.
4. The preview starts to show frames.

The most important number is the time to the first preview frame. The preview only needs the preview layer (or one video data output). The photo output and the movie output are not necessary until the person captures something.

**Deferred start** (iOS 26) moves stage 3 after stage 4 for the outputs that you mark. The session starts, the preview appears, and then the session prepares the deferred outputs.

Two modes:

- **Automatic** (`automaticallyRunsDeferredStart == true`): the session selects the moment.
  - If only preview layers are not deferred: a short time after the first frame is shown.
  - If an `AVCaptureOutput` is not deferred: after each data-providing output sends its first frame.
- **Manual** (`automaticallyRunsDeferredStart == false`): the app calls `runDeferredStartWhenNeeded()`. Use this when the app draws the preview itself, or when it must do its own work between the first frame and the heavy initialization.

If a capture is requested before the deferred start has run, the session runs it immediately for that request.

### (b) Key APIs (all iOS 26, verified in the headers)

`AVCaptureSession`:

- `automaticallyRunsDeferredStart: Bool` — default `true` for apps linked with the iOS 26 SDK or later. Set it before the commit.
- `isManualDeferredStartSupported: Bool` — test it before you set the property above to `false`. If it is not supported, the set throws `NSInvalidArgumentException`.
- `runDeferredStartWhenNeeded()` — manual mode only (it throws in automatic mode). Asynchronous: it returns immediately. Call it one time for each configuration commit. Do not call it on the main actor.
- `setDeferredStartDelegate(_:deferredStartDelegateCallbackQueue:)`, `deferredStartDelegate`, `deferredStartDelegateCallbackQueue`. A non-nil delegate needs a non-nil queue.

`AVCaptureSessionDeferredStartDelegate`:

- `sessionWillRunDeferredStart(_:)` — not blocking. The deferred start can already be in progress. Use it for work that can run in parallel.
- `sessionDidRunDeferredStart(_:)` — all outputs are ready. Use it for less important setup.
- Both are called in automatic and in manual mode.

`AVCaptureOutput`:

- `isDeferredStartSupported: Bool`.
- `isDeferredStartEnabled: Bool` — default `true` for `AVCapturePhotoOutput` and `AVCaptureFileOutput` subclasses (if supported) in apps linked with iOS 26 or later. Default `false` for all other outputs. Setting `true` on an unsupported output throws.

`AVCaptureVideoPreviewLayer`:

- `isDeferredStartSupported`, `isDeferredStartEnabled` — default `false`. Set `true` only for secondary preview layers.

Rules from the header:

- Set these values before `commitConfiguration()`. A change needs a long reconfiguration of the pipeline.
- If all outputs and layers have the same value, the result is the same as no deferred start.

Companion API: `AVCapturePhotoOutput.isResponsiveCaptureEnabled` (iOS 17). The header for `isDeferredStartEnabled` says: to support more than one capture request before the deferred start has run, enable responsive capture on the photo output.

### (c) Why AVCam does it this way

The commit `72b0fdb` ("Incorporated WWDC26 session 303 content into AVCam") made three changes in this area.

**1. Deferred start is made visible** (`AVCam/CaptureService.swift:137-149`):

```swift
captureSession.automaticallyRunsDeferredStart = true                                   // :140
photoCapture.output.isDeferredStartEnabled = photoCapture.output.isDeferredStartSupported   // :143
movieCapture.output.isDeferredStartEnabled = movieCapture.output.isDeferredStartSupported   // :148
```

- The comment in the code and Apple's article both say that these are the defaults for the iOS 26 SDK. The lines are there to teach.
- The pattern `enabled = supported` is the safe form, because `true` on an unsupported output throws.
- The preview layer is not touched. Its default (`false`) is correct.
- Automatic mode is correct for AVCam, because the preview layer is the only undeferred client.
- The movie output is still added only in video mode. Deferred start delays the start of an output. It does not replace the decision to add an output.

**2. Controls are hidden until the session runs** (`AVCam/Support/ViewExtensions.swift:59-68`):

```swift
func hidden(until isRunning: Bool) -> some View {
    opacity(isRunning ? 1 : 0).animation(.easeIn(duration: 0.3), value: isRunning)
}
```

- Applied to the thumbnail button and the camera switch button (`AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift:25`, `:35`), the mode picker (`AVCam/Views/Controls/CaptureModeView.swift:44`), and the feature toolbar (`AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift:36`).
- The capture button is **not** hidden. A capture before the deferred start has finished is still accepted, and the photo output enables responsive capture (`AVCam/Capture/PhotoCapture.swift:124`).
- Opacity is used, not conditional views, so the layout does not move when the controls appear.
- Session 303 gives the rule: split launch work into "necessary for the first preview frame" and "all other work". Only the preview and the shutter button are in the first group.

**3. The preview is covered in the background** (`AVCam/Views/PreviewContainer.swift:27`, `:31`, `:64`, `:67`, `:76-92`):

- A preview layer keeps its last frame when the session stops. Without a cover, the person sees an old frame for a moment when the app returns.
- On `.background`: `coverOpacity = 1` with no animation. The app has no time to animate on the way out.
- On `.active`: fade the cover out in 0.3 s.
- `.inactive` is ignored (`default: break`). So the cover does not appear for Control Center, the app switcher, or a notification banner.
- Apple's article says that the fade "smooths the return to a live preview without needing a signal that frames have resumed".

The same commit also removed `UIScreen.main.bounds` (`AVCam/Views/CameraUI.swift` now measures the window with `onGeometryChange`, and `CameraPreview.swift:41` creates the Simulator image view without a frame). This is necessary for resizable windows on iPad.

Alternatives:

- **Manual mode** for a Metal preview. Session 303 sample: set `automaticallyRunsDeferredStart = false`, keep `videoOutput.isDeferredStartEnabled = false`, and call `runDeferredStartWhenNeeded()` from `drawable.addPresentedHandler { … }` on the first drawable.
- **A delegate** to enable capture-related UI in `sessionDidRunDeferredStart(_:)`, in place of `status == .running`.
- **`isPreviewing` KVO** to remove the cover exactly when frames are back.
- **A snapshot or a blur** in place of the black cover.

### (d) Pitfalls

- **Time to first capture does not improve.** Session 303 says this directly: with a deferred photo output, the preview is faster but the first photo is not. Responsive capture is the repair.
- **Only an SDK link changes the default.** An old binary on iOS 26 does not get deferred start.
- **`AVCaptureVideoDataOutput` is never deferred by default.** An app with a video data preview gets no automatic gain. It must use manual mode (session 303).
- **A non-deferred data output delays automatic deferred start** until that output gives its first frame.
- **`runDeferredStartWhenNeeded()` in automatic mode throws.** So does `automaticallyRunsDeferredStart = false` when manual mode is not supported.
- **One commit.** Each extra commit during launch costs time. AVCam's setup commits more than one time (section 2).
- **The controls can appear on a failed session.** `status == .running` is not the real session state (section 8).
- **The cover depends on `scenePhase` only.** In iPad multi-window use, a scene can be visible but not active. Test this case.
- **Not on visionOS.** All deferred start API is `API_UNAVAILABLE(visionos)`.

### (e) Other launch performance advice (session 303)

- Create the `AVCaptureSession` off the main thread, in parallel with UI creation. Session creation blocks.
- Do not call `startRunning()` or `stopRunning()` on the main thread.
- Use `AVCaptureVideoPreviewLayer` unless you need frame access.
- Keep per-frame work short when you draw the preview yourself.
- After setup, check `hardwareCost`, then observe `systemPressureState`.
- Measure with Instruments, and test in real conditions (heat).
- New in iOS 27 for high data rate recording: `AVProVideoStorage` (shared, pre-allocated storage; `usesProVideoStorage` on `AVCaptureMovieFileOutput`). This belongs to the video agent.
- Related sessions: WWDC23 "Create a more responsive camera experience" (10105) and WWDC26 "Implement high resolution photo capture" (304).

### (f) Links

- Building a responsive camera app that launches quickly: https://developer.apple.com/documentation/avfoundation/building-a-responsive-camera-app-that-launches-quickly
- WWDC26 session 303: https://developer.apple.com/videos/play/wwdc2026/303/
- `automaticallyRunsDeferredStart`: https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyrunsdeferredstart
- `isManualDeferredStartSupported`: https://developer.apple.com/documentation/avfoundation/avcapturesession/ismanualdeferredstartsupported
- `runDeferredStartWhenNeeded()`: https://developer.apple.com/documentation/avfoundation/avcapturesession/rundeferredstartwhenneeded()
- `setDeferredStartDelegate(_:deferredStartDelegateCallbackQueue:)`: https://developer.apple.com/documentation/avfoundation/avcapturesession/setdeferredstartdelegate(_:deferredstartdelegatecallbackqueue:)
- `AVCaptureSessionDeferredStartDelegate`: https://developer.apple.com/documentation/avfoundation/avcapturesessiondeferredstartdelegate
- `AVCaptureOutput.isDeferredStartSupported`: https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartsupported
- `AVCaptureOutput.isDeferredStartEnabled`: https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartenabled
- `AVCaptureVideoPreviewLayer.isDeferredStartEnabled`: https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/isdeferredstartenabled
- `isResponsiveCaptureEnabled`: https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled
- `ScenePhase`: https://developer.apple.com/documentation/swiftui/scenephase

---

## Glossary

| Term | Meaning |
|---|---|
| Capture session | The object that owns the graph of inputs, outputs, and connections, and starts and stops the data flow |
| Input | An object that supplies media to the session. `AVCaptureDeviceInput` wraps one device |
| Port | One media stream of an input (video, audio, depth, metadata) |
| Output | An object that consumes media: photo, movie file, video data, metadata, depth |
| Connection | The link between input ports and one output or one preview layer. It owns rotation, mirroring, and stabilization |
| Session preset | A named quality level. The session selects the device format from it |
| Input priority | The preset value that means "the app set `activeFormat`; the session must not change it" |
| Format | One sensor mode of a device: dimensions, pixel format, frame rate ranges, and feature support |
| Binned format | A format that combines neighboring pixels. Lower resolution, better low-light performance, lower hardware cost |
| Session queue | A serial dispatch queue for all session calls. In AVCam it is also the actor's executor |
| Custom executor | A `SerialExecutor` that an actor uses in place of the default cooperative pool. Supplied through `unownedExecutor` |
| Physical device | One camera with one lens and one sensor |
| Virtual device | A system-made camera that combines physical cameras (dual, dual-wide, triple, TrueDepth, LiDAR depth) |
| Constituent device | One physical camera inside a virtual device |
| Primary constituent device | The constituent camera that supplies the frames now |
| Fallback device | A wider constituent camera that replaces a longer one when focus distance or light is not sufficient |
| Switch-over zoom factor | A zoom factor where the virtual device can change to the next constituent camera |
| Discovery session | An object that lists devices that match device types, a media type, and a position |
| System-preferred camera | The camera that the system recommends now. It includes user history and newly connected cameras |
| User-preferred camera | The camera that the app stores as the person's selection |
| UVC | USB Video Class. The standard that external cameras on iPad must follow |
| Preview layer | `AVCaptureVideoPreviewLayer`, a Core Animation layer that shows the camera stream |
| Video gravity | How the video fits the layer: aspect fit, aspect fill, or stretch |
| Device point | A point from (0,0) to (1,1) in the coordinate space of the unrotated sensor image |
| Point of interest | The device point that focus or exposure uses |
| Rectangle of interest | iOS 26. A device-space rectangle for focus or exposure, with position and size |
| Subject area change | A large change of the scene. The device can post a notification for it |
| Rotation coordinator | The object that gives the angles for a level preview and a level capture |
| Horizon-level | Level relative to gravity, independent of how the device is held |
| Lock for configuration | Exclusive access to a device's hardware settings. Necessary before each set |
| Exposure duration | The shutter time |
| ISO | The sensor gain |
| Lens aperture | The f-number. A physical, adjustable value in the iOS 27 API |
| Exposure bias | A correction in EV that makes auto exposure brighter or darker |
| Priority mode | iOS 27. One exposure parameter is fixed and the system controls the others |
| Exposure signal | iOS 27. A scene property (motion, group, document, starburst, flicker) that auto exposure can use |
| Lens position | A number from 0 (near) to 1 (far) for manual focus. Not a distance |
| Torch | A continuous light for video and preview. Different from the photo flash |
| Low-light boost | A special device mode that makes dark scenes brighter |
| Interruption | A system-caused stop of the session that ends automatically |
| Runtime error | A session failure that the app must handle |
| Media services reset | A restart of the system media process. The session stops and must be started again |
| System pressure | Heat or power limits that can force lower frame rates or stop the camera |
| Hardware cost | A number from 0 to 1 for the share of the hardware budget that a session configuration uses |
| Multitasking camera access | Permission to use the camera while other apps are in the foreground on iPad |
| Deferred start | iOS 26. The session starts the preview first and prepares the marked outputs later |
| Responsive capture | A photo output feature that accepts new capture requests while earlier ones are still in process |
| Scene phase | The SwiftUI value for the state of a scene: active, inactive, background |

---

## Verified links

All rows returned HTTP 200 on 2026-10-01. Documentation rows were tested with the JSON endpoint.

### Articles and sample code

| Title | URL | Description |
|---|---|---|
| Capture setup | https://developer.apple.com/documentation/avfoundation/capture-setup | The collection page for sessions, devices, preview, and controls |
| AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The sample's own article (Xcode 27 version) |
| Building a responsive camera app that launches quickly | https://developer.apple.com/documentation/avfoundation/building-a-responsive-camera-app-that-launches-quickly | Deferred start, hidden controls, and the background cover in AVCam |
| Supporting device rotation in your camera app | https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app | The `RotationObserver` design (newer than the local repository) |
| Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media | Info.plist keys and the status and request flow |
| Setting up a capture session | https://developer.apple.com/documentation/avfoundation/setting-up-a-capture-session | Inputs, outputs, preview view, start |
| Choosing a capture device | https://developer.apple.com/documentation/avfoundation/choosing-a-capture-device | Default device and discovery session |
| Accessing the camera while multitasking on iPad | https://developer.apple.com/documentation/avkit/accessing-the-camera-while-multitasking-on-ipad | Multitasking access, system pressure, interruptions |
| AVMultiCamPiP: Capturing from Multiple Cameras | https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras | Multi-cam sample |
| Registering a camera capture accessory on iPhone Duo | https://developer.apple.com/documentation/avfoundation/registering-a-camera-capture-accessory-on-iphone-duo | Outer-display content. Context for the inner and outer ultra-wide device types |
| Adopting smart framing in your camera app | https://developer.apple.com/documentation/avfoundation/adopting-smart-framing-in-your-camera-app | Framing recommendations (beyond AVCam) |
| Supporting Continuity Camera in your macOS app | https://developer.apple.com/documentation/avfoundation/supporting-continuity-camera-in-your-macos-app | Origin of the preferred-camera API |

### Session and connection

| Title | URL | Description |
|---|---|---|
| AVCaptureSession | https://developer.apple.com/documentation/avfoundation/avcapturesession | The session class |
| beginConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration() | Start of an atomic change |
| commitConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration() | End of an atomic change |
| startRunning() | https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning() | Blocking start |
| stopRunning() | https://developer.apple.com/documentation/avfoundation/avcapturesession/stoprunning() | Blocking stop |
| isRunning | https://developer.apple.com/documentation/avfoundation/avcapturesession/isrunning | Running state (KVO) |
| isInterrupted | https://developer.apple.com/documentation/avfoundation/avcapturesession/isinterrupted | Interrupted state (KVO) |
| sessionPreset | https://developer.apple.com/documentation/avfoundation/avcapturesession/sessionpreset | The active preset |
| AVCaptureSession.Preset | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset | All presets |
| photo | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/photo | Full-resolution photo preset |
| high | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/high | High-quality video preset (the default) |
| inputPriority | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/inputpriority | The app controls the format |
| canSetSessionPreset(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/cansetsessionpreset(_:) | Preset support test |
| canAddInput(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddinput(_:) | Input test |
| addInput(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addinput(_:) | Add an input |
| canAddOutput(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddoutput(_:) | Output test |
| addOutput(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutput(_:) | Add an output |
| addInputWithNoConnections(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addinputwithnoconnections(_:) | Manual graph |
| addConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addconnection(_:) | Manual graph |
| connections | https://developer.apple.com/documentation/avfoundation/avcapturesession/connections | All connections of the session |
| hardwareCost | https://developer.apple.com/documentation/avfoundation/avcapturesession/hardwarecost | Share of the hardware budget |
| synchronizationClock | https://developer.apple.com/documentation/avfoundation/avcapturesession/synchronizationclock | Clock for output timestamps |
| usesApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/usesapplicationaudiosession | Audio session sharing |
| automaticallyConfiguresApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfiguresapplicationaudiosession | Automatic audio session setup |
| configuresApplicationAudioSessionForBluetoothHighQualityRecording | https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessionforbluetoothhighqualityrecording | iOS 26. AirPods as microphone |
| automaticallyConfiguresCaptureDeviceForWideColor | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfigurescapturedeviceforwidecolor | Automatic wide color |
| AVCaptureMultiCamSession | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession | Multi-camera session |
| isMultiCamSupported | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/ismulticamsupported | Multi-cam support test |
| AVCaptureInput | https://developer.apple.com/documentation/avfoundation/avcaptureinput | Input base class |
| AVCaptureInput.Port | https://developer.apple.com/documentation/avfoundation/avcaptureinput/port | One stream of an input |
| AVCaptureOutput | https://developer.apple.com/documentation/avfoundation/avcaptureoutput | Output base class |
| AVCaptureDeviceInput | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput | Device input |
| init(device:) | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/init(device:) | Opens the device. Can prompt for access |
| videoMinFrameDurationOverride | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/videominframedurationoverride | Lowers hardware cost |
| unifiedAutoExposureDefaultsEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/unifiedautoexposuredefaultsenabled | Same AE defaults for preset and format |
| activeLockedVideoFrameDuration | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/activelockedvideoframeduration | iOS 26. Exact frame duration |
| AVCaptureConnection | https://developer.apple.com/documentation/avfoundation/avcaptureconnection | Connection class |
| videoRotationAngle | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle | Rotation in degrees |
| isVideoRotationAngleSupported(_:) | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideorotationanglesupported(_:) | Angle support test |
| videoOrientation | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videoorientation | Deprecated in iOS 17 |
| isVideoMirrored | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored | Mirroring |
| automaticallyAdjustsVideoMirroring | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyadjustsvideomirroring | Automatic mirroring |
| isLowLightVideoNoiseReductionEnabled | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/islowlightvideonoisereductionenabled | iOS 27 |
| automaticallyEnablesLowLightVideoNoiseReduction | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyenableslowlightvideonoisereduction | iOS 27 |

### Life cycle

| Title | URL | Description |
|---|---|---|
| wasInterruptedNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/wasinterruptednotification | Interruption start |
| interruptionEndedNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionendednotification | Interruption end |
| runtimeErrorNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/runtimeerrornotification | Session failure |
| didStartRunningNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/didstartrunningnotification | Session started |
| didStopRunningNotification | https://developer.apple.com/documentation/avfoundation/avcapturesession/didstoprunningnotification | Session stopped |
| AVCaptureSession.InterruptionReason | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason | Reason enum |
| videoDeviceNotAvailableInBackground | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/videodevicenotavailableinbackground | Background reason |
| videoDeviceNotAvailableWithMultipleForegroundApps | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/videodevicenotavailablewithmultipleforegroundapps | iPad multitasking reason |
| videoDeviceNotAvailableDueToSystemPressure | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/videodevicenotavailableduetosystempressure | Heat or power reason |
| sensitiveContentMitigationActivated | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason/sensitivecontentmitigationactivated | iOS 26 reason |
| AVCaptureSessionInterruptionReasonKey | https://developer.apple.com/documentation/avfoundation/avcapturesessioninterruptionreasonkey | `userInfo` key |
| AVCaptureSessionErrorKey | https://developer.apple.com/documentation/avfoundation/avcapturesessionerrorkey | `userInfo` key |
| AVError.Code.mediaServicesWereReset | https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/mediaserviceswerereset | Media server restart |
| AVError.Code.applicationIsNotAuthorizedToUseDevice | https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/applicationisnotauthorizedtousedevice | Access denied error |
| AVError.Code.sessionHardwareCostOverage | https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/sessionhardwarecostoverage | Cost above 1.0 |
| isMultitaskingCameraAccessSupported | https://developer.apple.com/documentation/avfoundation/avcapturesession/ismultitaskingcameraaccesssupported | iPad multitasking support |
| isMultitaskingCameraAccessEnabled | https://developer.apple.com/documentation/avfoundation/avcapturesession/ismultitaskingcameraaccessenabled | iPad multitasking switch |
| com.apple.developer.avfoundation.multitasking-camera-access | https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.avfoundation.multitasking-camera-access | Entitlement (page shows deprecated in iOS 18) |
| systemPressureState | https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempressurestate-swift.property | Device pressure state (KVO) |
| AVCaptureDevice.SystemPressureState | https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempressurestate-swift.class | Level and factors |
| SCVideoStreamAnalyzer | https://developer.apple.com/documentation/sensitivecontentanalysis/scvideostreamanalyzer | Source of the iOS 26 interruption reason |
| UIRequiresFullScreen | https://developer.apple.com/documentation/bundleresources/information-property-list/uirequiresfullscreen | Info.plist key (page shows deprecated in iOS 26) |

### Deferred start

| Title | URL | Description |
|---|---|---|
| automaticallyRunsDeferredStart | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyrunsdeferredstart | Automatic or manual mode |
| isManualDeferredStartSupported | https://developer.apple.com/documentation/avfoundation/avcapturesession/ismanualdeferredstartsupported | Manual mode support |
| runDeferredStartWhenNeeded() | https://developer.apple.com/documentation/avfoundation/avcapturesession/rundeferredstartwhenneeded() | Manual trigger |
| setDeferredStartDelegate(_:deferredStartDelegateCallbackQueue:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/setdeferredstartdelegate(_:deferredstartdelegatecallbackqueue:) | Delegate setter |
| AVCaptureSessionDeferredStartDelegate | https://developer.apple.com/documentation/avfoundation/avcapturesessiondeferredstartdelegate | Delegate protocol |
| sessionWillRunDeferredStart(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesessiondeferredstartdelegate/sessionwillrundeferredstart(_:) | Before deferred start |
| sessionDidRunDeferredStart(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesessiondeferredstartdelegate/sessiondidrundeferredstart(_:) | After deferred start |
| AVCaptureOutput.isDeferredStartSupported | https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartsupported | Output support |
| AVCaptureOutput.isDeferredStartEnabled | https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartenabled | Output switch |
| AVCaptureVideoPreviewLayer.isDeferredStartSupported | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/isdeferredstartsupported | Layer support |
| AVCaptureVideoPreviewLayer.isDeferredStartEnabled | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/isdeferredstartenabled | Layer switch |
| isResponsiveCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled | Captures before the output is ready |
| AVProVideoStorage | https://developer.apple.com/documentation/avfoundation/avprovideostorage | iOS 27. Pre-allocated storage (video agent) |
| ScenePhase | https://developer.apple.com/documentation/swiftui/scenephase | SwiftUI scene state |
| onChange(of:initial:_:) | https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:) | SwiftUI change observer |

### Authorization

| Title | URL | Description |
|---|---|---|
| authorizationStatus(for:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/authorizationstatus(for:) | Read the status |
| requestAccess(for:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/requestaccess(for:completionhandler:) | Prompt the person |
| AVAuthorizationStatus | https://developer.apple.com/documentation/avfoundation/avauthorizationstatus | The four states |
| NSCameraUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription | Info.plist key |
| NSMicrophoneUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription | Info.plist key |
| openSettingsURLString | https://developer.apple.com/documentation/uikit/uiapplication/opensettingsurlstring | Link to the app's Settings page |

### Devices

| Title | URL | Description |
|---|---|---|
| AVCaptureDevice | https://developer.apple.com/documentation/avfoundation/avcapturedevice | Device class |
| AVCaptureDevice.DeviceType | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct | All device types |
| builtInWideAngleCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinwideanglecamera | Physical wide |
| builtInUltraWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinultrawidecamera | Physical ultra-wide |
| builtInTelephotoCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintelephotocamera | Physical telephoto |
| builtInDualCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualcamera | Virtual wide + telephoto |
| builtInDualWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtindualwidecamera | Virtual ultra-wide + wide |
| builtInTripleCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintriplecamera | Virtual three cameras |
| builtInTrueDepthCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtintruedepthcamera | Front depth camera |
| builtInLiDARDepthCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinlidardepthcamera | Back LiDAR depth camera |
| builtInOuterUltraWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera | iOS 27.1 (beta in docs) |
| builtInInnerUltraWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtininnerultrawidecamera | iOS 27.1 (beta in docs) |
| external | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/external | UVC camera |
| continuityCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/continuitycamera | Continuity Camera |
| microphone | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/microphone | Microphone |
| AVCaptureDevice.Position | https://developer.apple.com/documentation/avfoundation/avcapturedevice/position-swift.enum | Front, back, unspecified |
| AVCaptureDevice.DiscoverySession | https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession | Device search |
| devices | https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/devices | Sorted result (KVO) |
| supportedMultiCamDeviceSets | https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/supportedmulticamdevicesets | Legal multi-cam groups |
| default(_:for:position:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/default(_:for:position:) | Default by type and position |
| default(for:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/default(for:) | Default by media type |
| systemPreferredCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempreferredcamera | System recommendation |
| userPreferredCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/userpreferredcamera | Stored user selection |
| wasConnectedNotification | https://developer.apple.com/documentation/avfoundation/avcapturedevice/wasconnectednotification | Device connected |
| wasDisconnectedNotification | https://developer.apple.com/documentation/avfoundation/avcapturedevice/wasdisconnectednotification | Device disconnected |
| uniqueID | https://developer.apple.com/documentation/avfoundation/avcapturedevice/uniqueid | Stable device identifier |
| isSuspended | https://developer.apple.com/documentation/avfoundation/avcapturedevice/issuspended | Device exists but gives no data |
| isContinuityCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/iscontinuitycamera | Continuity Camera test |
| supportsSessionPreset(_:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/supportssessionpreset(_:) | Preset test for a device |
| isVirtualDevice | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvirtualdevice | Virtual device test |
| constituentDevices | https://developer.apple.com/documentation/avfoundation/avcapturedevice/constituentdevices | Physical cameras of a virtual device |
| virtualDeviceSwitchOverVideoZoomFactors | https://developer.apple.com/documentation/avfoundation/avcapturedevice/virtualdeviceswitchovervideozoomfactors | Lens switch zoom factors |
| activePrimaryConstituent | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituent | The camera in use now |
| AVCaptureDevice.PrimaryConstituentDeviceSwitchingBehavior | https://developer.apple.com/documentation/avfoundation/avcapturedevice/primaryconstituentdeviceswitchingbehavior-swift.enum | Auto, restricted, locked |
| setPrimaryConstituentDeviceSwitchingBehavior(_:restrictedSwitchingBehaviorConditions:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setprimaryconstituentdeviceswitchingbehavior(_:restrictedswitchingbehaviorconditions:) | Control lens switching |
| activePrimaryConstituentDeviceSwitchingBehavior | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeprimaryconstituentdeviceswitchingbehavior | The behavior in effect |
| fallbackPrimaryConstituentDevices | https://developer.apple.com/documentation/avfoundation/avcapturedevice/fallbackprimaryconstituentdevices | Permitted fallback cameras |
| supportedFallbackPrimaryConstituentDevices | https://developer.apple.com/documentation/avfoundation/avcapturedevice/supportedfallbackprimaryconstituentdevices | Possible fallback cameras |
| setPrimaryConstituentDeviceSwitchingBehaviorLockedWith(_:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setprimaryconstituentdeviceswitchingbehaviorlockedwith(_:) | iOS 27. Lock to one camera |
| minimumFocusDistance | https://developer.apple.com/documentation/avfoundation/avcapturedevice/minimumfocusdistance | Nearest focus, in millimeters |
| nominalFocalLengthIn35mmFilm | https://developer.apple.com/documentation/avfoundation/avcapturedevice/nominalfocallengthin35mmfilm | iOS 26. Focal length label |

### Preview and rotation

| Title | URL | Description |
|---|---|---|
| AVCaptureVideoPreviewLayer | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer | Preview layer |
| session | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/session | Attach a session |
| setSessionWithNoConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/setsessionwithnoconnection(_:) | Attach with no automatic connection |
| connection | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/connection | The layer's connection |
| videoGravity | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/videogravity | Fit or fill |
| AVLayerVideoGravity | https://developer.apple.com/documentation/avfoundation/avlayervideogravity | Gravity values |
| isPreviewing | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/ispreviewing | Frames are on screen (KVO) |
| captureDevicePointConverted(fromLayerPoint:) | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/capturedevicepointconverted(fromlayerpoint:) | Layer point to device point |
| layerPointConverted(fromCaptureDevicePoint:) | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/layerpointconverted(fromcapturedevicepoint:) | Device point to layer point |
| layerClass | https://developer.apple.com/documentation/uikit/uiview/layerclass | Backing layer class of a view |
| didMoveToWindow() | https://developer.apple.com/documentation/uikit/uiview/didmovetowindow() | The view joined a window |
| CALayer | https://developer.apple.com/documentation/quartzcore/calayer | Core Animation layer |
| UIViewRepresentable | https://developer.apple.com/documentation/swiftui/uiviewrepresentable | UIKit view in SwiftUI |
| AVCaptureVideoDataOutput | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput | Frame access (custom preview) |
| AVCaptureDevice.RotationCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator | Rotation angles |
| init(device:previewLayer:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/init(device:previewlayer:) | Make a coordinator |
| videoRotationAngleForHorizonLevelPreview | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelpreview | Preview angle |
| videoRotationAngleForHorizonLevelCapture | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture | Capture angle |
| videoRotationAngleRelative(toDeviceOrientation:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationanglerelative(todeviceorientation:) | iOS 27. Static angle |
| NSKeyValueObservation | https://developer.apple.com/documentation/foundation/nskeyvalueobservation | Block-based KVO token |

### Focus, exposure, and device controls

| Title | URL | Description |
|---|---|---|
| lockForConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration() | Take the device lock |
| unlockForConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturedevice/unlockforconfiguration() | Release the device lock |
| focusMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.property | Focus mode property |
| AVCaptureDevice.FocusMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusmode-swift.enum | Focus modes |
| focusPointOfInterest | https://developer.apple.com/documentation/avfoundation/avcapturedevice/focuspointofinterest | Focus point |
| isLockingFocusWithCustomLensPositionSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/islockingfocuswithcustomlenspositionsupported | Manual focus support |
| setFocusModeLocked(lensPosition:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setfocusmodelocked(lensposition:completionhandler:) | Manual focus |
| isSmoothAutoFocusEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/issmoothautofocusenabled | Slow focus for movies |
| autoFocusRangeRestriction | https://developer.apple.com/documentation/avfoundation/avcapturedevice/autofocusrangerestriction-swift.property | Near or far limit |
| isFaceDrivenAutoFocusEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isfacedrivenautofocusenabled | Face focus |
| focusRectOfInterest | https://developer.apple.com/documentation/avfoundation/avcapturedevice/focusrectofinterest | iOS 26 |
| isFocusRectOfInterestSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isfocusrectofinterestsupported | iOS 26 |
| defaultRectForFocusPoint(ofInterest:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/defaultrectforfocuspoint(ofinterest:) | iOS 26 |
| isContinuousAutoFocusTrackingEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/iscontinuousautofocustrackingenabled | iOS 27 |
| exposureMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.property | Exposure mode property |
| AVCaptureDevice.ExposureMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.enum | Exposure modes |
| exposurePointOfInterest | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposurepointofinterest | Exposure point |
| exposureRectOfInterest | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposurerectofinterest | iOS 26 |
| setExposureModeCustom(duration:iso:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuremodecustom(duration:iso:completionhandler:) | Manual shutter and ISO |
| setExposureModeCustom(lensAperture:duration:iso:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuremodecustom(lensaperture:duration:iso:completionhandler:) | iOS 27. Aperture and priority modes |
| lensAperture | https://developer.apple.com/documentation/avfoundation/avcapturedevice/lensaperture | f-number |
| automaticallyAdjustsLensAperture | https://developer.apple.com/documentation/avfoundation/avcapturedevice/automaticallyadjustslensaperture | iOS 27 |
| autoExposureLensApertureRateLimit | https://developer.apple.com/documentation/avfoundation/avcapturedevice/autoexposurelensapertureratelimit | iOS 27 |
| recommendedLensApertureStops | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/recommendedlensaperturestops | iOS 27 |
| activeExposureSignals | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeexposuresignals | iOS 27 |
| enabledExposureSignals | https://developer.apple.com/documentation/avfoundation/avcapturedevice/enabledexposuresignals | iOS 27 |
| setExposureTargetBias(_:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setexposuretargetbias(_:completionhandler:) | Exposure compensation |
| exposureTargetBias | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuretargetbias | Current bias |
| exposureTargetOffset | https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuretargetoffset | Light meter value |
| activeMaxExposureDuration | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activemaxexposureduration | Longest auto shutter time |
| isSubjectAreaChangeMonitoringEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/issubjectareachangemonitoringenabled | Scene change monitor |
| subjectAreaDidChangeNotification | https://developer.apple.com/documentation/avfoundation/avcapturedevice/subjectareadidchangenotification | Scene change event |
| whiteBalanceMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/whitebalancemode-swift.property | White balance mode |
| setWhiteBalanceModeLocked(with:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/setwhitebalancemodelocked(with:completionhandler:) | Manual white balance |
| AVCaptureDevice.WhiteBalanceGains | https://developer.apple.com/documentation/avfoundation/avcapturedevice/whitebalancegains | RGB gains |
| AVCaptureDevice.WhiteBalanceTemperatureAndTintValues | https://developer.apple.com/documentation/avfoundation/avcapturedevice/whitebalancetemperatureandtintvalues | Kelvin and tint |
| deviceWhiteBalanceGains | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicewhitebalancegains | Current gains |
| videoZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/videozoomfactor | Zoom |
| ramp(toVideoZoomFactor:withRate:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/ramp(tovideozoomfactor:withrate:) | Smooth zoom |
| cancelVideoZoomRamp() | https://developer.apple.com/documentation/avfoundation/avcapturedevice/cancelvideozoomramp() | Stop a ramp |
| isRampingVideoZoom | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isrampingvideozoom | Ramp state |
| minAvailableVideoZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/minavailablevideozoomfactor | Lower zoom limit |
| maxAvailableVideoZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/maxavailablevideozoomfactor | Upper zoom limit |
| displayVideoZoomFactorMultiplier | https://developer.apple.com/documentation/avfoundation/avcapturedevice/displayvideozoomfactormultiplier | iOS 18. UI zoom number |
| videoMaxZoomFactor | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videomaxzoomfactor | Format zoom maximum |
| videoZoomFactorUpscaleThreshold | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videozoomfactorupscalethreshold | Start of digital upscaling |
| secondaryNativeResolutionZoomFactors | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/secondarynativeresolutionzoomfactors | Non-upsampled crop factors |
| systemRecommendedVideoZoomRange | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/systemrecommendedvideozoomrange | iOS 18. Slider range |
| AVCaptureSystemZoomSlider | https://developer.apple.com/documentation/avfoundation/avcapturesystemzoomslider | Camera Control zoom (other agent) |
| torchMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/torchmode-swift.property | Torch mode |
| AVCaptureDevice.TorchMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/torchmode-swift.enum | Torch modes |
| setTorchModeOn(level:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/settorchmodeon(level:) | Torch with a level |
| isLowLightBoostSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/islowlightboostsupported | Low-light boost support |
| automaticallyEnablesLowLightBoostWhenAvailable | https://developer.apple.com/documentation/avfoundation/avcapturedevice/automaticallyenableslowlightboostwhenavailable | Low-light boost switch |
| isAutoVideoFrameRateEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isautovideoframerateenabled | iOS 18. Automatic frame rate |
| isAutoVideoFrameRateSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isautovideoframeratesupported | iOS 18 |
| AVCaptureDevice.Format | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format | Format class |
| formats | https://developer.apple.com/documentation/avfoundation/avcapturedevice/formats | All formats of a device |
| activeFormat | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat | The format in use |
| videoSupportedFrameRateRanges | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videosupportedframerateranges | Frame rate ranges |
| AVFrameRateRange | https://developer.apple.com/documentation/avfoundation/avframeraterange | One frame rate range |
| activeVideoMinFrameDuration | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideominframeduration | Maximum frame rate |
| activeVideoMaxFrameDuration | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideomaxframeduration | Minimum frame rate |
| supportedMaxPhotoDimensions | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/supportedmaxphotodimensions | Photo sizes of a format |
| isVideoBinned | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideobinned | Binned format test |
| isVideoHDREnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvideohdrenabled | Video HDR switch |
| activeColorSpace | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activecolorspace | Color space |
| isGlobalToneMappingEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isglobaltonemappingenabled | Tone mapping |
| isGeometricDistortionCorrectionEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isgeometricdistortioncorrectionenabled | Lens distortion correction |

### Swift concurrency

| Title | URL | Description |
|---|---|---|
| Actor | https://developer.apple.com/documentation/swift/actor | Actor protocol |
| unownedExecutor | https://developer.apple.com/documentation/swift/actor/unownedexecutor | The actor's executor requirement |
| SerialExecutor | https://developer.apple.com/documentation/swift/serialexecutor | Executor protocol |
| UnownedSerialExecutor | https://developer.apple.com/documentation/swift/unownedserialexecutor | Executor reference type |
| DispatchSerialQueue | https://developer.apple.com/documentation/dispatch/dispatchserialqueue | Serial queue that can be an executor |
| MainActor.assumeIsolated(_:file:line:) | https://developer.apple.com/documentation/swift/mainactor/assumeisolated(_:file:line:) | Used in Apple's rotation article |
| AsyncStream | https://developer.apple.com/documentation/swift/asyncstream | Used for KVO bridges |
| notifications(named:object:) | https://developer.apple.com/documentation/foundation/notificationcenter/notifications(named:object:) | Notifications as an async sequence |
| SE-0392 Custom Actor Executors | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0392-custom-actor-executors.md | Design of custom executors |
| SE-0424 Custom isolation checking for SerialExecutor | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0424-custom-isolation-checking-for-serialexecutor.md | `checkIsolated()`; how `assumeIsolated` works with a queue executor |

### WWDC sessions

| Title | URL | Description |
|---|---|---|
| WWDC26 303: Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | Deferred start, preview, system pressure, pro video storage. Transcript read in full |
| WWDC26 304: Implement high resolution photo capture | https://developer.apple.com/videos/play/wwdc2026/304/ | Referred to by session 303 (photo agent) |
| WWDC25 253: Enhancing your camera experience with capture controls | https://developer.apple.com/videos/play/wwdc2025/253/ | Capture controls (other agent) |
| WWDC25 319: Capture cinematic video in your app | https://developer.apple.com/videos/play/wwdc2025/319/ | Cinematic video focus API (video agent) |
| WWDC23 10105: Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | Responsive capture, deferred photo processing |
| WWDC23 10106: Support external cameras in your iPadOS app | https://developer.apple.com/videos/play/wwdc2023/10106/ | External cameras, preferred camera, rotation coordinator. Transcript read |
| WWDC22 110429: Discover advancements in iOS camera capture: Depth, focus, and multitasking | https://developer.apple.com/videos/play/wwdc2022/110429/ | Multitasking camera access, face-driven focus |
| WWDC22 10018: Bring Continuity Camera to your macOS app | https://developer.apple.com/videos/play/wwdc2022/10018/ | Origin of automatic camera selection |
| WWDC21 10047: What's new in camera capture | https://developer.apple.com/videos/play/wwdc2021/10047/ | Minimum focus distance, constituent switching |
| WWDC21 10247: Capture high-quality photos using video formats | https://developer.apple.com/videos/play/wwdc2021/10247/ | Formats and photo quality |
| WWDC19 249: Introducing Multi-Camera Capture for iOS | https://developer.apple.com/videos/play/wwdc2019/249/ | Multi-cam session |
| WWDC19 225: Advances in Camera Capture & Photo Segmentation | https://developer.apple.com/videos/play/wwdc2019/225/ | Virtual devices in iOS 13 |
| WWDC16 501: Advances in iOS Photography | https://developer.apple.com/videos/play/wwdc2016/501/ | Photo output and device types origin |

---

## Unverified items and open questions

| Item | Status |
|---|---|
| `https://developer.apple.com/videos/play/wwdc26/303/` (short form) | Redirects to the video index. Use the `wwdc2026` form |
| `https://developer.apple.com/documentation/AVFoundation/build-a-responsive-camera-app-that-launches-quickly` (the link on the WWDC page) | UNVERIFIED. The JSON endpoint returns 404. The real page is `building-a-responsive-…` |
| WWDC14 session 508 "Camera Capture: Manual Controls" | UNVERIFIED. The URL redirects to the WWDC14 list |
| Documentation pages for `NSCameraUseExternalDeviceType` and `NSCameraUseContinuityCameraDeviceType` | UNVERIFIED. 404 under `bundleresources/information-property-list/`. The keys are named in the header |
| A documentation page for the exposure signal type | Not found. The properties (`activeExposureSignals`, `enabledExposureSignals`) are verified. The ObjC type is `AVCaptureDeviceExposureSignal`; the Swift type name was not confirmed |
| `AVCaptureDeviceInput(device:)` throws after the person denied access | UNVERIFIED on a device. The error code exists in `AVError.h` |
| `AVCaptureDevice.systemPreferredCamera` is `nil` on a first launch on iPhone | UNVERIFIED. The header says `nil` only when no camera is available. The sample tests for `nil` |
| The exact format that `.high` selects on each device | Not checked. It depends on the device |
| The crash in `videoPreviewLayer` if the preview is not connected | From a code read (`CaptureService.swift:416-422`). Not reproduced |
| The wrong rotation of a movie that starts immediately after a mode switch | From a code read. Not reproduced |
| The `RotationObserver` design | Present in Apple's published article. Not present in the local repository at `72b0fdb` |
| All device behavior | Nothing was run on hardware. Simulator has no camera |
