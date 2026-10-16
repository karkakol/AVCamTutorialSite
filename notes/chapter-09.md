# Chapter 9 hand-off notes: fast capture and the readiness coordinator (code by a Sonnet agent)

Branch `chapter-09`, start `chapter-08`. Full change: `git -C ../AVCamTutorialApp diff chapter-08 chapter-09` (about 140 added lines, 7 files, one commit). Source: WWDC23 session 10105 and `research/09-fast-capture.md`. Do not copy Apple's text.

Note: this file replaces the old `notes/chapter-09.md` (the HDR video chapter, now chapter 11 in the new numbering). The old text is in git history (commit 5447dd1).

## Result and verification
- Build succeeded with no warnings for the iPhone 18 Pro simulator.
- The app launches with SimCam and shows the normal interface (photo button, Live and quality controls, thumbnail, switch button).
- Log of one launch with one capture in the Simulator (`log stream --level debug`; `log show` hides debug lines):
  - `Zero shutter lag (supported/enabled): false/false`, same for responsive capture and fast capture prioritization. All switches are unsupported in the Simulator, so the `x = x.isSupported` lines do nothing there.
  - `Capture readiness changed to sessionNotRunning` (first value, when the delegate is set).
  - A capture then gave `notReadyMomentarily`, and the value stayed there. The Simulator never reported `ready`. The button stays enabled in this state (header rule), so capture still works.
- NOT verified: the dimmed button and the progress indicator during a real capture (the Simulator never reports the two waiting states). Check them with the preview "Waiting for processing" in Xcode, or on a real iPhone.

## What the chapter adds
- `DataTypes`: `enum CaptureReadiness` (`ready`, `notReadyMomentarily`, `notReadyWaitingForCapture`, `notReadyWaitingForProcessing`, `sessionNotRunning`) and `isCaptureButtonDisabled` (true for the two waiting states).
- `PhotoCapture`: `captureReadiness` (`@Published`), `readinessCoordinator` (lazy `AVCapturePhotoOutputReadinessCoordinator(photoOutput:)`), `readinessObserver`, `readinessTask`, `monitorReadiness(isolation:)`, the line `isZeroShutterLagEnabled = isZeroShutterLagSupported`, three log lines for the switches, the delegate setup at the end of `updateConfiguration(for:)`, and `readinessCoordinator.startTrackingCaptureRequest(using: photoSettings)` in `capturePhoto(with:)`. New private class `ReadinessObserver: NSObject, AVCapturePhotoOutputReadinessCoordinatorDelegate` (stream `readinessStream`, method `readinessCoordinator(_:captureReadinessDidChange:)`) and `private extension CaptureReadiness { init(_ readiness: AVCapturePhotoOutput.CaptureReadiness) }`.
- `CaptureService`: `@Published captureReadiness`; `photoCapture.$captureReadiness.assign(to: &$captureReadiness)` in `observeOutputServices()`.
- `Camera`: `var captureReadiness: CaptureReadiness { get }`. `CameraModel`: `captureReadiness` and a third `Task` in `observeState()`. `PreviewCameraModel`: `var captureReadiness = CaptureReadiness.ready`.
- `CameraModel.capturePhoto()`: a `logger.debug` line "Capture requested" with the readiness, and a `logger.error` in the `catch` (see "Simulator capture").
- `CaptureButton`: `PhotoCaptureButton(readiness:action:)`, `.disabled(readiness.isCaptureButtonDisabled)`, a `ProgressView` for `notReadyWaitingForProcessing`, `.opacity(0.5)` on the `ZStack` in the two waiting states, and a new preview "Waiting for processing" (wrapped in `PreviewBackground { }`).

## Changes to earlier code
- `PhotoCapture.updateConfiguration(for:)`: one new line before `isResponsiveCaptureEnabled` (insert only). The order is: zero shutter lag, responsive, fast, deferred.
- `PhotoCapture.capturePhoto(with:)`: one inserted line before `photoOutput.capturePhoto`.
- `CaptureButton.swift`: `PhotoCaptureButton.init` changes (`remove` fence for the old init), the call site changes, and `.buttonStyle(PhotoButtonStyle())` is followed by new lines (the closing braces of `body` move).
- `CameraModel.capturePhoto()`: one line before `do`, one line in the `catch`.

## Build order (each section compiles)
1. The type: `CaptureReadiness` in `DataTypes`, `captureReadiness` in `Camera` and `PreviewCameraModel`. `CameraModel` needs its property in the same section (it adopts the protocol); the `Task` comes later. Build.
2. The switches: the zero shutter lag line and the three log lines in `updateConfiguration`. Build and run: the log shows `false/false` in the Simulator.
3. The coordinator: `ReadinessObserver`, the extension, `captureReadiness`, `readinessCoordinator`, `readinessObserver`, `readinessTask`, `monitorReadiness`, the delegate setup, `startTrackingCaptureRequest`. Build.
4. The service and model: the `CaptureService` property and `assign`, the `Task` in `CameraModel.observeState()`. Build and run: the log shows the readiness changes.
5. The button: `PhotoCaptureButton`, the `CaptureButton` call site, the preview. Build and run.

## Design decisions to explain
- Option 1 of the dossier: the app tracks the request inside `PhotoCapture`, on the `CaptureService` actor. The header says the delegate callback runs synchronously only when `startTrackingCaptureRequest` runs on the main queue. Here it does not, so the callback arrives later and a fast second tap can slip through. Say this in the text. Option 2 (create the settings on the main actor and track there) is the next step; it changes `CameraModel`, `CaptureService` and `PhotoCapture`.
- The coordinator holds its delegate weakly. `PhotoCapture` keeps the `ReadinessObserver` in a stored property.
- The observer turns the main-queue callback into an `AsyncStream`, as the photo delegate does for `captureActivity`. `monitorReadiness` copies `monitorProgress` (the `isolation` parameter keeps the task on the actor).
- `updateConfiguration(for:)` runs on every camera change, so the delegate is set once (`readinessTask == nil`). Setting it delivers the first value.
- The app enumeration keeps AVFoundation out of the views. The `default` case in the mapping covers `sessionNotRunning` and any future value.
- Button rules (header): disable for the two waiting states, dim to 0.5, a spinner while processing, no change for `notReadyMomentarily` (too short; a change would flicker).
- Zero shutter lag is on by default when supported. The explicit line shows the switch and keeps the order right (responsive capture needs it).
- Overlapping captures: `captureActivity` follows whichever delegate reported last. It only drives the flash and the Live badge.
- Not done: touch-down capture (Apple advises it for zero shutter lag), switches in a menu, a readiness guard for the Camera Control and AirPods triggers (add `guard !camera.captureReadiness.isCaptureButtonDisabled` in `CameraModel.capturePhoto()` when those chapters call it).

## What needs a real iPhone
- The `supported/enabled` values of the three switches (expect `true/true` on an A12 or later with the `.photo` preset).
- Dimming and the spinner during a `.quality` capture; the readiness sequence for rapid taps (read the log lines "Capture readiness changed to ...").
- Zero shutter lag (photo timestamp before the tap), overlapping processing, fast capture prioritization, deferred proxies.
- Whether a RAW request (chapter 8) changes the readiness values.

## Simulator capture
Open item from `notes/chapter-08.md`: a tap on the capture button saved no photo on the chapter 7 and 8 builds.
- Finding: the capture code is not the cause. On the chapter 8 build, `CameraModel.capturePhoto()` called without a tap (a temporary launch hook, removed before the commit) saved a photo each time (DCIM `IMG_0021.JPG` and `IMG_0022.JPG` on the chapter 8 build, one more on the chapter 9 build; count 21 to 23). PhotoKit logged "inserts: [Asset: 1] ... success: YES". No error appeared.
- So the settings that chapters 5 to 7 added (`maxPhotoDimensions`, HEVC, quality prioritization, Live Photo movie URL, responsive capture, deferred delivery) all work in the Simulator. The four support flags are `false` there, so the `isSupported` guards already keep those switches off. No guard is missing, and this commit fixes no capture failure.
- The fault lies between the tap and `capturePhoto()`: the tap may not reach `PhotoCaptureButton`. The chapter 5 layout work added a tap gesture and a swipe gesture on the preview, and `CaptureModeView`. This is not proven; the agent cannot tap the screen.
- Check for the coordinator: tap the button once and read the log (`xcrun simctl spawn <udid> log stream --level debug --predicate 'process == "AVCam"'`). The line "Capture requested. Readiness: ..." (new in this chapter) appears when the tap reaches the model. If it is missing, the tap does not reach the button. If it appears and "Photo capture failed" follows, send the error text. If it appears with no error, count the files in `.../Media/DCIM/100APPLE/` again.
- The `logger.error("Photo capture failed: ...")` line in the `catch` of `CameraModel.capturePhoto()` moved to chapter 8 (commit `87747f2`, device finding two). Chapter 9 adds only the "Capture requested" line there.

## Device results (16 Oct 2026, iPhone 17 Pro Max, iOS 26)
This answers most of "What needs a real iPhone" above.
- At start: "Zero shutter lag (supported/enabled): true/true", "Responsive capture … true/true", "Fast capture prioritization … true/true", "Deferred photo delivery … true/true".
- About 15 fast taps with Quality: every tap accepted, every picture saved. The readiness only changed between `ready` and `notReadyMomentarily`; the two waiting states never came, so the dimmed button and the spinner cannot be seen on this phone (only in the preview "Waiting for processing").
- Under fast taps the output dropped the deferred 24 MP path (5712x4284 with a proxy) and delivered 12 MP photos at once (4032x3024, proxy 0x0); the first and the last capture of a burst used the deferred path. Responsive capture at work (fast capture prioritization is also on; the log does not tell which switch decided).
- After a RAW capture the readiness went to `sessionNotRunning` and back to `ready` (after "Saved asset").
- Not checked: zero shutter lag time stamps, a fast series of RAW captures.

### Cause of the `sessionNotRunning` dip (code reading, not proven)
- `capturePhoto(with:)` and `MediaLibrary.save(photo:)` do not touch the session. `updateConfiguration(for:)` runs only from `updateCaptureCapabilities()` (session setup and `changeCaptureDevice(to:)`), not per capture. The deferred switch runs only in `setRAWFormat(_:)` (the RAW menu), inside `beginConfiguration()`/`commitConfiguration()`.
- In chapter 9, the only session changes after start are `CaptureService.setRAWFormat(_:)` and `changeCaptureDevice(to:)` (also reached from `monitorSystemPreferredCamera()`). The session also stops in the background.
- So the dip comes from the next action after the capture: back to Off (deferred delivery on again, pipeline rebuild), the switch to the front camera (round 7 tested both cameras), or a visit to Photos to check the DNG. The reported log has no line between "Saved asset" and the dip, so the cause is open. The check: the line before the dip is "Deferred photo delivery (supported/enabled)" (RAW choice) or "RAW on Front TrueDepth Camera" (camera switch); with neither line, the app was in the background (or another event stopped the session). Also: the mapping's `default` turns any unknown value into `sessionNotRunning`.
- Pages: `ch09-concepts.md` section "What a device test showed" says this as an observation. `ch08-concepts.md` finding 7 and the conditions table no longer say that the capture causes the dip.

## Integration (16 Oct 2026)
- `chapter-10` … `chapter-20` rebased onto `chapter-09` `cd72e2c` (old SHAs: session scratchpad `old-branches-int.txt`). New: 10 `d776c43`, 11 `7f7aeff`, 12 `97936bb`, 13 `a57c768`, 14 `9742e0d`, 15 `394c99e`, 16 `5f9b114`, 17 `04ff27f`, 18 `1733104`, 19 `30096a3`, 20 `31e58d3`; `main` = `31e58d3`.
- One conflict: chapter 11 (`5e7cd4e`, HDR) in `DataTypes.swift` `CaptureCapabilities`; resolved to `isLivePhotoCaptureSupported`, `isAppleProRAWSupported`, `isHDRSupported` (no Bayer flag). All other commits applied cleanly. Each tip differs from its old tip by exactly the chapter 8 final change (7 files). No file was added, so the `membershipExceptions` lists are unchanged.
- Every tip builds with zero warnings (generic iOS Simulator, `-quiet`).
- Pages: only `ch11-build.md` (section "Report HDR support", step 1) needed a fix: the Bayer lines left the fence, the `remove` box now shows `isAppleProRAWSupported: Bool = false) {`, highlight `7,10-11,14`.
- `npm run validate`: 0 errors, 0 warnings. Replay ch08 to ch20 (78 sections): 74 `build=ok`; the known results ch15 s2 "FAILS" (no claim), ch15 s3 and ch19 s3/s4 "unclear (brace position)"; every end state equals its branch. `node src/build.mjs`: 42 pages.
