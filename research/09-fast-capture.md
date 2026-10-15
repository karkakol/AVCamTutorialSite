# Fast capture: research (15 Oct 2026)

Sources: SDK headers of iPhoneOS 27.1 [H] (`AVCapturePhotoOutput.h`), Apple documentation from the JSON endpoint [D], the WWDC23 session 10105 transcript [W], the app code on branch `chapter-07` [A], and `research/05-simcam.md` and `notes/chapter-07.md` for the Simulator [S]. Nothing was run. Nothing was tested on a real iPhone.

## Surprises (read first)

1. **Chapter 7 already turns on three of the four switches.** [A] `PhotoCapture.updateConfiguration(for:)` sets `isResponsiveCaptureEnabled`, `isFastCapturePrioritizationEnabled`, and `isAutoDeferredPhotoDeliveryEnabled` to their `...Supported` values. The Apple sample does the same. So chapter 9 does not "turn on" responsive capture. It adds the missing piece: the readiness coordinator and the capture button feedback. Zero shutter lag is the only switch not written.
2. **Zero shutter lag is on by default.** [H] "For apps linked on or after iOS 17 zero shutter lag is automatically enabled when supported." [W] "Absolutely nothing" is needed to get it. The chapter can only show how to read it, log it, or opt out.
3. **The other switches are off by default.** [H] `isFastCapturePrioritizationEnabled`: "This property defaults to NO." Responsive capture and deferred delivery have no stated default; the WWDC session shows them as opt-in. [W] Camera.app turns fast capture on by default; apps choose.
4. **The switches depend on each other, and order matters.** [H] Responsive capture "is only supported when zero shutter lag is enabled". Fast capture prioritization works "only when responsiveCaptureEnabled is YES". The chapter 7 code sets responsive first, then fast. That order is right. Do not reorder it.
5. **Support flags change at run time.** [H] When a support flag goes from YES to NO, the enabled flag "reverts to NO". "If you've previously opted in ... and then change configurations, you may need to set fastCapturePrioritizationEnabled = YES again." The app already calls `updateConfiguration(for:)` on each camera change [A]. Keep it that way.
6. **The readiness coordinator is not limited to the new devices.** [W] Responsive capture and fast capture need an A12 chip or later. The coordinator "is available wherever AVCapturePhotoOutput is supported" and can be used without the other features. So it can run in the Simulator (inference).
7. **API versions.** All of these are iOS 17 or later. Nothing here needs iOS 18 or later. (Constant color and `rawFileFormat` in chapter 8 are iOS 18.) The app targets iOS 27.0 [A].
8. **The plan's tap-time idea needs care.** [H] `startTrackingCaptureRequest(using:)` is synchronous only "when called on the main queue". In the app, the settings are made inside `PhotoCapture`, which runs on the `CaptureService` actor, on the session queue [A]. See the design choice below.

## What the API is

### Zero shutter lag (ZSL)

- [H] `isZeroShutterLagSupported` (read-only): "This property returns YES if the session's current configuration allows zero shutter lag. When switching cameras or formats, setting depthDataDeliveryEnabled, or setting virtualDeviceConstituentPhotoDeliveryEnabled this property may change. When this property changes from YES to NO, zeroShutterLagEnabled also reverts to NO. This property is key-value observable."
- [H] `isZeroShutterLagEnabled`: "This property may only be set to YES if zeroShutterLagSupported is YES, otherwise an NSInvalidArgumentException is thrown. For apps linked on or after iOS 17 zero shutter lag is automatically enabled when supported. Enabling zero shutter lag reduces or eliminates shutter lag when using AVCapturePhotoQualityPrioritizationBalanced or Quality at the cost of additional memory usage by the photo output. The timestamp of the AVCapturePhoto may be slightly earlier than when -capturePhotoWithSettings:delegate: was called. To minimize camera shake from the user's tapping gesture it is recommended that -capturePhotoWithSettings:delegate: be called as early as possible when handling the touch down event. Zero shutter lag isn't available when using manual exposure or bracketed capture. Changing this property requires a lengthy reconfiguration of the capture render pipeline, so you should set this property to YES before calling -[AVCaptureSession startRunning] or within -[AVCaptureSession beginConfiguration] and -[AVCaptureSession commitConfiguration] while running."
- [W] How it works: the pipeline keeps a ring buffer of past frames. The photo uses frames from before the tap. Enabled for sessions and formats where `isHighestPhotoQualitySupported` is true (the `.photo` preset; the app uses it [A]). No ZSL for flash captures, manual exposure, bracketed captures, or constituent photo delivery.
- [H] "The timestamp of the AVCapturePhoto may be slightly earlier than when capturePhoto was called." Keep the work between the tap and `capturePhoto` small.

### Responsive capture

- [H] `isResponsiveCaptureSupported`: "Enabling responsive capture increases peak and sustained capture rates, and reduces shutter lag at the cost of additional memory usage by the photo output. This property returns YES if the session's current configuration allows responsive capture. When switching cameras or formats, enabling depth data delivery, or enabling zero shutter lag this property may change. Responsive capture is only supported when zero shutter lag is enabled. When this property changes from YES to NO, responsiveCaptureEnabled also reverts to NO."
- [H] `isResponsiveCaptureEnabled`: "may only be set to YES if responsiveCaptureSupported is YES, otherwise an NSInvalidArgumentException is thrown. When responsiveCaptureEnabled is YES the captureReadiness property should be used to determine whether new capture requests can be serviced in a reasonable time and whether the shutter control should be available to the user. Responsive capture adds buffering between the capture and photo processing stages which allows a new capture to start before processing has completed for the previous capture, so be prepared to handle -captureOutput:willBeginCaptureForResolvedSettings: being called before the -captureOutput:didFinishProcessingPhoto: for the prior requests. Processed photos continue to be delivered in the order they were captured." Same timing rule as ZSL (before `startRunning()` or inside begin/commit).
- [H] "When requesting uncompressed output using kCVPixelBufferPixelFormatTypeKey ... overlap between capture and processing is disabled." The app asks for HEVC, so this does not apply.
- [W] A request has three phases: capture, process, encode. Responsive capture overlaps them. Peak memory rises. An app that uses a lot of memory may need to opt out. About 2 photos per second with ZSL only; more with responsive capture [W].

### Fast capture prioritization

- [H] `isFastCapturePrioritizationSupported`: "Fast capture prioritization allows capture quality to be automatically reduced from the selected AVCapturePhotoQualityPrioritization to ensure the photo output can keep up when captures are requested in rapid succession. Fast capture prioritization is only supported for certain AVCaptureSession sessionPresets and AVCaptureDevice activeFormats and only when responsiveCaptureEnabled is YES."
- [H] `isFastCapturePrioritizationEnabled`: "This property defaults to NO. This property may only be set to YES if fastCapturePrioritizationSupported is YES, otherwise an NSInvalidArgumentException is thrown. ... In many cases the slightly reduced quality is preferable to missing the moment entirely."
- [W] It detects rapid shooting and moves quality toward `.balanced`. The result is visible per photo: `AVCaptureResolvedPhotoSettings.isFastCapturePrioritizationEnabled` (read-only, in the resolved settings) tells if it was applied [H].

### Deferred photo delivery (started in chapter 7)

- [H] `isAutoDeferredPhotoDeliverySupported`: changes with preset and format. "When deferred photo delivery is not supported, your capture requests always resolve their ... deferredPhotoProxyDimensions to { 0, 0 }."
- [H] `isAutoDeferredPhotoDeliveryEnabled`: "Setting this value to either YES or NO requires a lengthy reconfiguration of the capture pipeline, so you should set this property before calling -[AVCaptureSession startRunning]. Setting this property to YES throws an NSInvalidArgumentException if autoDeferredPhotoDeliverySupported is NO."
- [H] The delegate must implement `photoOutput(_:didFinishCapturingDeferredPhotoProxy:error:)` when it is on. "The 24MP setting (5712, 4284), when supported, is only serviced as 24MP when opted-in to autoDeferredPhotoDeliveryEnabled."
- Chapter 9 adds nothing new here. It only explains how deferred delivery fits with the other switches (see `research/02-photo-capture.md`, section 6).

### Capture readiness

- [H] `AVCapturePhotoOutput.CaptureReadiness` (iOS 17), five values:

| Value | Header meaning | Suggested UI [H] |
|---|---|---|
| `.sessionNotRunning` | "the session is not running and the output is not ready to receive requests" | Not ready. The coordinator allows tracking in this state, so the button can stay tappable while the session starts. |
| `.ready` | "ready to receive new requests" | Enabled |
| `.notReadyMomentarily` | "not ready ... may be ready shortly" | Disable input. Do not dim: "short lived enough that dimming or changing the appearance of the shutter is not recommended as it would be visually distracting". |
| `.notReadyWaitingForCapture` | "busy capturing" (flash, `.quality` captures) | Dim or disable |
| `.notReadyWaitingForProcessing` | "busy processing" | Dim or disable. "it is also appropriate to show a spinner" |

- [H] `captureReadiness` (on the output, key-value observable): "Capturing only when the output is ready limits the number of requests inflight to minimize shutter lag while maintaining the fastest shot to shot time. ... The output continues to accept requests when the captureReadiness property returns a value other than Ready, but the request may not be serviced for a longer period." When the output is used on a background queue, use the coordinator instead.
- [H] `AVCapturePhotoOutputReadinessCoordinator` (iOS 17): "notifies its delegate of changes in an AVCapturePhotoOutput's captureReadiness property and can be used to coordinate UI updates on the main queue with use of AVCapturePhotoOutput on a background queue."
  - `init(photoOutput:)`. `init()` is unavailable.
  - `delegate` is `weak`: "The receiver's delegate, called on the main queue." "A callback with the initial value of captureReadiness is delivered when delegate is set." The owner must keep a strong reference to the delegate object.
  - Delegate method (optional, protocol `AVCapturePhotoOutputReadinessCoordinatorDelegate: NSObject`): `readinessCoordinator(_ coordinator:, captureReadinessDidChange captureReadiness: AVCapturePhotoOutput.CaptureReadiness)`. "This callback is always delivered on the main queue."
  - `captureReadiness` on the coordinator is key-value observable. "The value incorporates the photo output's captureReadiness and any requests registered using -startTrackingCaptureRequestUsingPhotoSettings:".
  - `startTrackingCaptureRequest(using: AVCapturePhotoSettings)`: "Track the capture request ... until it is enqueued to the photo output ... It is recommended that the same photo settings be passed to -[AVCapturePhotoOutput capturePhotoWithSettings:delegate] ... When called on the main queue the delegate callback is invoked synchronously before returning to ensure shutter availability is updated immediately and prevent queued touch events from initiating unwanted captures. [It] can be called while in the SessionNotRunning state ... An NSInvalidArgumentException is thrown if the photo settings are invalid."
  - `stopTrackingCaptureRequest(using: Int64)` (the argument is `settings.uniqueID`): "Tracking automatically stops when capturePhotoWithSettings:delegate is called with a photo settings objects with the same or a newer uniqueID, but in cases where an error or other condition prevents calling capturePhoto ... tracking should be explicitly stopped".
- [W] The session's sample app "turns off user interaction events on the capture button" when the value is not ready. After a tap the value goes `.ready` then `.notReadyMomentarily`. A flash capture gives `.notReadyWaitingForCapture`. With only ZSL on, `.notReadyWaitingForProcessing` is the busy state.

### Interaction with `photoQualityPrioritization`

- [H] `maxPhotoQualityPrioritization` default is `.balanced`; the app sets `.quality` [A]. "Changing the maxPhotoQualityPrioritization while the session is running can result in a lengthy rebuild of the session in which video preview is disrupted." `.quality` also turns on optical image stabilization where the format supports it.
- [H] ZSL "reduces or eliminates shutter lag when using ... Balanced or Quality". At `.speed` there is little to gain.
- [H] `.quality` captures are the long ones: the readiness value then shows `.notReadyWaitingForCapture` or `.notReadyWaitingForProcessing`. This is why chapter 7's default (`.quality`) makes the readiness UI useful.
- [H] Fast capture prioritization lowers the quality below the chosen level on rapid shots. The processed photo may be `.balanced` even when the user chose `.quality`. [W] Deferred delivery does not apply to every shot ("when appropriate").
- RAW (chapter 8): Bayer RAW forces `.speed` for the request [H]. The header does not say how responsive capture, fast capture, or ZSL treat a RAW request. Open item for the device check.

### Delegate changes with overlap

- [H] With responsive capture on, `willBeginCapture` of photo B can come before `didFinishProcessingPhoto` of photo A. Processed photos still arrive in capture order.
- [A] The app already has one `PhotoCaptureDelegate` per request with its own continuation, and a `livePhotoCount` counter in `monitorProgress`. Overlap needs no new code there. The shared `captureActivity` value now follows whichever delegate reported last; this is only the shutter flash and the Live badge, so acceptable. Chapter 9 should state this.

## How the tutorial app will use it (chapter 9)

All names are suggestions for the code agent. The base is branch `chapter-08` (RAW), which equals `chapter-07` for these files except for the RAW changes.

**`Capture/PhotoCapture.swift`**
- `updateConfiguration(for:)`: add the ZSL line first, in the right order:
  1. `photoOutput.isZeroShutterLagEnabled = photoOutput.isZeroShutterLagSupported`
  2. (existing) `isResponsiveCaptureEnabled = isResponsiveCaptureSupported`
  3. (existing) `isFastCapturePrioritizationEnabled = isFastCapturePrioritizationSupported`
  4. (existing) `isAutoDeferredPhotoDeliveryEnabled = isAutoDeferredPhotoDeliverySupported`
  Add a `logger.debug` line with the six values (supported and enabled for ZSL, responsive, fast) so the device check can read them. Reading `isResponsiveCaptureSupported` after step 1 matters, because step 1 can change it.
- A readiness coordinator owned by `PhotoCapture`: `private lazy var readinessCoordinator = AVCapturePhotoOutputReadinessCoordinator(photoOutput: output)`.
- The delegate must be an `NSObject` that stays alive (the property is weak). `PhotoCapture` is a plain `final class`, not an `NSObject`. Use a small private class `ReadinessObserver: NSObject, AVCapturePhotoOutputReadinessCoordinatorDelegate` that holds a closure `(AVCapturePhotoOutput.CaptureReadiness) -> Void`, and keep it in a stored property of `PhotoCapture`. Set `readinessCoordinator.delegate = observer` once (for example when the first device is configured, or in an `init`).
- `@Published private(set) var captureReadiness: ShutterReadiness = .notReady`. The model type `ShutterReadiness` (see below) keeps AVFoundation out of the views, as `QualityPrioritization` does. The observer closure runs on the main queue. `PhotoCapture` lives on the `CaptureService` actor. Hop with `Task { await self.setReadiness(...) }`, or mark the setter `nonisolated` and write through the `@Published` carefully. The code agent picks the safe form for Swift 6 isolation.
- In `capturePhoto(with:)`, after `createPhotoSettings(with:)` and before `photoOutput.capturePhoto(with:delegate:)`: `readinessCoordinator.startTrackingCaptureRequest(using: photoSettings)`. If the code can throw before `capturePhoto`, call `stopTrackingCaptureRequest(using: photoSettings.uniqueID)`.

**Design choice: where to start tracking.** [H] The synchronous update needs the call on the main queue.
- Option 1 (small, suggested): track inside `PhotoCapture` on the actor. The delegate callback arrives asynchronously on the main queue. Fast taps can slip through before the button disables. The `.notReadyMomentarily` value still arrives. Simple, matches the existing structure.
- Option 2 (as Apple's sample teaches): create the settings on the main actor, call `startTrackingCaptureRequest` there, then pass the settings to the actor. Needs `capturePhoto(with:)` to accept settings, a bigger refactor across `CameraModel`, `CaptureService`, `PhotoCapture`.
- Decision for the coordinator. Option 1 is enough for the tutorial if the chapter explains the limit. The fast tap sequence test shows whether extra requests slip through.

**`Model/DataTypes.swift`**
- New `enum ShutterReadiness { case notReady, ready, busy, processing }` (or a one-to-one copy of the five AVFoundation values; a smaller enum is easier to teach). Mapping suggestion: `.sessionNotRunning` and `.notReadyMomentarily` to `.notReady` (disabled, no dimming), `.ready` to `.ready`, `.notReadyWaitingForCapture` to `.busy` (dim), `.notReadyWaitingForProcessing` to `.processing` (dim and spinner). Add `var isEnabled: Bool { self == .ready }`.
- `CaptureCapabilities` can stay as is. If the chapter wants to show the switches, add `isZeroShutterLagEnabled` and `isResponsiveCaptureEnabled` flags (read-only, for a small status text). Optional.

**`CaptureService.swift`**
- `@Published private(set) var captureReadiness = ShutterReadiness.notReady`, and in `observeOutputServices()`: `photoCapture.$captureReadiness.assign(to: &$captureReadiness)`. This copies the pattern of `captureActivity`.

**`CameraModel.swift`, `Model/Camera.swift`, `Preview Content/PreviewCameraModel.swift`**
- `var shutterReadiness: ShutterReadiness { get }` in `Camera`. In `CameraModel`: `private(set) var shutterReadiness = ShutterReadiness.notReady`, filled in `observeState()` with a third `Task` that reads `await captureService.$captureReadiness.values`. `PreviewCameraModel`: a stored `var shutterReadiness = ShutterReadiness.ready`.
- Optional: the three on/off switches as `var` properties (as the Apple sample does in a gear menu in `FeatureToolbar.swift` [research 02]). The plan did not ask for them. A switch needs a method on `CaptureService` that sets the property inside `beginConfiguration()` and `commitConfiguration()` (lengthy reconfiguration, preview disruption).

**`Views/Toolbars/MainToolbar/CaptureButton.swift`**
- `PhotoCaptureButton` gets `let readiness: ShutterReadiness`. `.disabled(!readiness.isEnabled)` on the inner `Button`. `.opacity(0.4)` only for `.busy` and `.processing`, not for `.notReady` (header advice). A small `ProgressView` over the button for `.processing`. `CaptureButton` passes `camera.shutterReadiness`. The `#Preview` can show all four values.
- Touch-down: Apple advises calling `capturePhoto` "as early as possible when handling the touch down event" (ZSL). The current button uses the tap action. Moving to touch-down needs a gesture. Not recommended for the chapter; mention it as an aside.

**Other places that call `capturePhoto`:** none in chapter 7 [A]. Later chapters add the Camera Control and the AirPods remote [plan]. They will call the same `camera.capturePhoto()`, so they should also respect readiness. Note for the rewrite phase: if they bypass the button, add `guard camera.shutterReadiness.isEnabled` in `CameraModel.capturePhoto()`.

## What the Simulator supports (inference)

Facts: SimCam delivers 640 x 480 JPEG stills; the photo capture works; `notes/chapter-07.md` says responsive capture and deferred delivery did not work in the Simulator, and Live Photo was not seen [S].

Inference, not tested:
- `isZeroShutterLagSupported`, `isResponsiveCaptureSupported`, `isFastCapturePrioritizationSupported`, `isAutoDeferredPhotoDeliverySupported` are most likely all false. The existing `x = x.isSupported` pattern is then a no-op and safe. All four need a real camera pipeline and a format with `isHighestPhotoQualitySupported` [W].
- The readiness coordinator probably works: it depends only on `AVCapturePhotoOutput` [W]. Expect `.sessionNotRunning` before the start, `.ready` after, and `.notReadyMomentarily` or `.notReadyWaitingForProcessing` during a capture. The values for rapid taps are unknown. A capture at `.quality` in the Simulator may be too fast to show a busy state.
- What the Simulator can show: the button reacts to the readiness enum (a visual check by forcing values in `PreviewCameraModel`), the console log with all `false` for the switches, and the rapid tap test with the real coordinator. The picture of a busy state may need a forced value.
- A real iPhone is needed for: ZSL (the photo timestamp before the tap), overlapping captures, fast capture prioritization, proxies, and the real shot-to-shot rate.

## Fast tap sequence test (for the code agent)

A UI or test target is not in the app [A]. Suggested: a debug button or a launch argument that calls `camera.capturePhoto()` ten times, 100 ms apart, and logs: tap time, `shutterReadiness` at the tap, and count of saved assets. In the Simulator, count files in `.../Media/DCIM/100APPLE/` before and after [S]. Expected on the Simulator (inference): all ten saved, some taps ignored when the button is disabled. Expected on a device (not verified): fewer taps accepted than with the button always enabled, but shorter shutter lag per shot.

## Verified links

HTTP 200 on 15 Oct 2026 for the JSON endpoint `https://developer.apple.com/tutorials/data/documentation/<path>.json`.

| Title | URL |
|---|---|
| AVCapturePhotoOutput | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput |
| isZeroShutterLagSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagsupported |
| isZeroShutterLagEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagenabled |
| isResponsiveCaptureSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecapturesupported |
| isResponsiveCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled |
| isFastCapturePrioritizationSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationsupported |
| isFastCapturePrioritizationEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationenabled |
| isAutoDeferredPhotoDeliverySupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliverysupported |
| isAutoDeferredPhotoDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled |
| captureReadiness (property) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.property |
| AVCapturePhotoOutput.CaptureReadiness (enum) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.enum |
| AVCapturePhotoOutputReadinessCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator |
| init(photoOutput:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/init(photooutput:) |
| delegate | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/delegate |
| captureReadiness (coordinator) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/capturereadiness |
| startTrackingCaptureRequest(using:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/starttrackingcapturerequest(using:) |
| stopTrackingCaptureRequest(using:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/stoptrackingcapturerequest(using:) |
| AVCapturePhotoOutputReadinessCoordinatorDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinatordelegate |
| readinessCoordinator(_:captureReadinessDidChange:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinatordelegate/readinesscoordinator(_:capturereadinessdidchange:) |
| maxPhotoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization |
| photoQualityPrioritization (settings) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization |
| capturePhoto(with:delegate:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:) |
| AVCapturePhotoCaptureDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate |
| photoOutput(_:didFinishProcessingPhoto:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:) |
| photoOutput(_:didFinishCapturingDeferredPhotoProxy:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishcapturingdeferredphotoproxy:error:) |
| AVCaptureDeferredPhotoProxy | https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy |
| WWDC23 session 10105, Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ |

Not verified (404 on the JSON endpoint): `avcapturephotooutput/capturereadiness` without the `-swift.property` suffix. Use the suffixed URLs above.
