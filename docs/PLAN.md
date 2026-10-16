# AVCam tutorial: master plan

This file is the contract between all agents that work on the tutorial. Read it fully before you start.

## Goal

A learner rebuilds Apple's AVCam sample app almost from nothing, one chapter at a time (about 1 hour each), and becomes an iOS camera expert. The learner reads a tutorial web site next to Xcode. The finished code of one chapter is the start code of the next chapter.

## The three repositories

| Path | Role | Rules |
|---|---|---|
| `/Users/karolkakol/tutorials/AVCamBuildingACameraApp` | Apple's sample. The reference for the final state. | READ ONLY. Never edit, never commit, never build into it (use a derived data path outside of it). |
| `/Users/karolkakol/tutorials/AVCamTutorialApp` | The iOS project the learner builds. | One branch per chapter: `start`, `chapter-01` ... `chapter-20`. `main` equals the last finished chapter, now `chapter-20`. Only the code agent for the current chapter commits here. |
| `/Users/karolkakol/tutorials/AVCamTutorialSite` | The static tutorial web site. | Agents write files only in the folders assigned to them. Agents do NOT run `git commit` here; the coordinator commits. |

Folders in the site repository:

- `docs/` — this plan and `AUTHORING.md` (the content format).
- `research/` — documentation dossiers (read these before you write explanations).
- `notes/chapter-NN.md` — hand-off notes from the code agent of chapter NN to the writer of chapter NN.
- `content/pages/` — the tutorial pages (Markdown, format in `AUTHORING.md`).
- `content/images/` — diagrams (SVG) and simulator screenshots (PNG), named `chNN-...`.
- everything else — the site generator (owned by the site-shell agent).

## Tools and environment

- Xcode 27.1. Deployment target iOS 26.0 (same as the Apple sample).
- Simulator for build and run checks: **iPhone 18 Pro, iOS 27.0, UDID `97435DB5-37B7-46CC-B831-6F07D978DF2A`**. (A second simulator, iPhone 18 Pro Max `69F1F475-55C3-4D28-9B61-9B5C7F585868`, is reserved for tooling experiments.)
- **SimCam** gives the Simulator a working camera. The menu bar app is running and licensed. A plain `xcrun simctl launch` is enough; SimCam loads into the app by itself. Check with `/Applications/SimCam.app/Contents/MacOS/simcamctl diagnostics --device <udid>`. Do not change the SimCam source unless your brief says so.
- SimCam sources: the user set two looping videos, `~/Desktop/back.MOV` (back camera) and `~/Desktop/front.MOV` (front camera). KEEP them. Never run `simcamctl set-source`. Read `research/05-simcam.md` for what works in the Simulator: preview, camera switch, photo capture (640 x 480 JPEG), movie recording, and Photos saving work; Live Photo, photo orientation, HDR video, Camera Control, hardware buttons, and AirPods need a real iPhone. Code for those features is still written and must build; the notes must say that it was not verified at run time.
- Taps and screenshots: the iOS Simulator tool `mcp__Claude_Code_iOS_Simulator__control` (load it with ToolSearch) has access to the iPhone 18 Pro. Coordinates are in points (402 x 874).
- Build: `xcodebuild -project AVCam.xcodeproj -scheme AVCam -destination 'platform=iOS Simulator,id=<udid>' -derivedDataPath <a folder outside the repositories> CODE_SIGNING_ALLOWED=NO build`.
- Grant permissions before launch: `xcrun simctl privacy <udid> grant camera|microphone|photos|photos-add|location <bundle id>`.
- Screenshot: `xcrun simctl io <udid> screenshot <file>`. Terminate the app when you finish (`xcrun simctl terminate`), so the camera does not stay on.
- Bundle identifier of the tutorial app: `com.karolkakol.AVCam`. Product name: `AVCam`.
- Commit messages end with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push.

## Code rules (tutorial app)

1. **The final state equals the Apple sample.** At `chapter-15`, each Swift file matches the Apple sample (same file paths under `AVCam/`, same names, same comments), except for deviations listed in "Approved deviations". Port code from the reference; do not invent a different design.
2. **Each chapter adds; it rarely rewrites.** Write code in its final form when possible. When an early chapter needs a simpler version (for example a protocol with fewer members), keep the simple version a strict subset of the final version so that later chapters only add lines.
3. **Each chapter end state builds without errors and runs in the Simulator** with a visible result.
4. **No code from later chapters.** Do not add properties, cases, or files that the chapter does not need.
5. Keep the Apple file header comment form (`/* See the LICENSE.txt file ... Abstract: ... */`). Keep `LICENSE.txt` in the repository root.
6. The Xcode project uses file-system-synchronized groups, so new files need no project file edits.
7. Swift language mode and concurrency build settings match the Apple sample (Swift 5 mode, no default main-actor isolation).
8. `PreviewCameraModel` and the `Camera` protocol stay in sync with `CameraModel` in each chapter.

### Approved deviations from the Apple sample

- Bundle identifier `com.karolkakol.AVCam` (and the strings derived from it).
- `CameraPreview.PreviewView` does not add the static placeholder image in the Simulator (`#if targetEnvironment(simulator)` block), because SimCam supplies a real feed. Verify that the live feed is visible.
- Chapter 12 connects `CaptureService.isInterrupted` to `CameraModel.status` (`.interrupted`). The Apple sample publishes the value but never shows it.
- Anything else: avoid it. If you must deviate, write the reason in `notes/chapter-NN.md`.

## Deviation from the sample: previews (14 Oct 2026)

The user asked that every control is visible in the Xcode preview canvas. Chapter 1 adds `AVCam/Preview Content/PreviewBackground.swift` (a gray gradient that stands in for the camera picture). Every `#Preview` block that shows a control on the camera wraps it in `PreviewBackground { }`, and `SwitchCameraButton`, `ThumbnailButton`, and `FeaturesToolbar` get a preview block that the sample does not have. Apart from this, the code equals the sample until chapter 15. The capture tool (`tools/capture.py --view`) renders the same views with the same background for the "What you see" screenshots.

## Scope

All 13 chapters are built (code, pages, validation). The user first asked for chapters 1 to 3 only, then asked for all chapters on 1 Oct 2026.

## Chapters

Each chapter has two pages on the site: a concept article (`chNN-concepts.md`, 10 to 15 minutes) and a hands-on tutorial (`chNN-build.md`, 35 to 45 minutes). Plus `welcome.md` at the start and `wrap-up.md` at the end.

The lists below define the END STATE of each chapter branch.

### start — the Xcode template
A fresh "App" project as Xcode 27.1 creates it: product name AVCam, SwiftUI, Swift, no tests, no storage. `AVCamApp.swift`, `ContentView.swift`, assets. Nothing else. The learner makes all setting changes in chapter 1.

### Chapter 1 — First preview (`chapter-01`)
Result: the app asks for camera permission and shows a full-screen live preview. If permission is denied, a status message appears.
- Project settings: deployment target iOS 26.0, concurrency settings as in the sample, camera usage description. `ContentView.swift` removed.
- `AVCam/AVCamApp.swift`: `@State camera`, `.task { await camera.start() }`, hidden status bar, global `logger`.
- `AVCam/Model/DataTypes.swift`: `CameraStatus`, `CameraError` (only the cases in use).
- `AVCam/CaptureService.swift`: the actor, the session queue as executor, `captureSession`, `previewSource`, `isAuthorized`, `start()`, `setUpSession()` (camera input from a simple default-device lookup), `addInput(for:)`.
- `AVCam/Views/CameraPreview.swift`: `CameraPreview`, `PreviewView`, `PreviewSource`, `PreviewTarget`, `DefaultPreviewSource`.
- `AVCam/Model/Camera.swift`: protocol with `status`, `previewSource`, `start()`.
- `AVCam/CameraModel.swift`, `AVCam/Preview Content/PreviewCameraModel.swift`.
- `AVCam/CameraView.swift` (preview plus status overlay), `AVCam/Views/Overlays/StatusOverlayView.swift`.

### Chapter 2 — Cameras (`chapter-02`)
Result: a button switches between the back and front cameras with a blur transition. The app follows the system-preferred camera. A rotation coordinator keeps the preview level.
- `AVCam/Capture/DeviceLookup.swift` (`cameras`, `defaultCamera`; no microphone yet), `AVCam/Capture/SPCObserver.swift`.
- `CaptureService`: `deviceLookup`, `activeVideoInput`, `currentDevice`, `selectNextVideoDevice()`, `changeCaptureDevice(to:)`, `monitorSystemPreferredCamera()`, the rotation coordinator with the preview observer (`createRotationCoordinator(for:)`, `updatePreviewRotation`, `videoPreviewLayer`).
- `Camera` / `CameraModel`: `switchVideoDevices()`, `isSwitchingVideoDevices`.
- Views: `SwitchCameraButton`, `MainToolbar` (switch button only), `CameraUI` (simple: toolbar at the bottom, status overlay), `PreviewContainer` (blur while switching), `AVCam/Support/ViewExtensions.swift` (`DefaultButtonStyle`, `largeButtonSize`).

### Chapter 3 — Take a photo (`chapter-03`)
Result: the capture button takes a photo. The screen flashes. The app logs the size of the photo data.
- `DataTypes`: `CaptureActivity` (`idle`, `photoCapture(willCapture:)`), `Photo` (`data`), `OutputService` (`output`, `captureActivity`), new `CameraError` cases.
- `AVCam/Capture/PhotoCapture.swift`: `capturePhoto()` with a checked continuation, `createPhotoSettings()` (HEVC, preview format, `maxPhotoDimensions`), `monitorProgress(of:)`, `PhotoCaptureDelegate` with the activity stream, `updateConfiguration(for:)` (max photo dimensions only).
- `CaptureService`: `photoCapture`, `outputServices`, `addOutput(_:)`, `.photo` preset, `capturePhoto()`, published `captureActivity`, `updateCaptureCapabilities()` (configuration part only), capture rotation (`updateCaptureRotation`, second observer). `OutputService.setVideoRotationAngle`. `CaptureExtensions.swift` with `CMVideoDimensions` only.
- `Camera` / `CameraModel`: `captureActivity`, `capturePhoto()`, `shouldFlashScreen`, `error`, `observeState()`.
- Views: `CaptureButton` (photo button only), `MainToolbar` with the capture button, flash effect in `CameraView`.

### Chapter 4 — Save to Photos (`chapter-04`)
Result: each photo goes to the Photos library with its location. A thumbnail of the last photo appears; a tap on it opens the photo picker.
- `AVCam/Model/MediaLibrary.swift` (photo only, thumbnails stream, location).
- Usage descriptions for Photos and location, as in the sample.
- `Camera` / `CameraModel`: `thumbnail`, save after capture, thumbnail observation.
- Views: `ThumbnailButton`, `Image(CGImage)` extension, `MainToolbar` with the thumbnail.

### Chapter 5 — Layout (`chapter-05`)
Result: (rotation moved to chapters 2 and 3.) The UI adapts to iPhone and iPad sizes, and the preview has a viewfinder frame.
- Supported orientations as in the sample.
- Views: `PlatformView`, `CameraUI` compact and regular layouts with `bottomPadding`, `PreviewContainer` aspect ratio and offset (photo ratio only), `MainToolbar` size.

### Chapter 6 — Focus and exposure (`chapter-06`)
Result: a tap on the preview focuses and exposes at that point. The camera returns to continuous mode when the scene changes.
- `CaptureService`: both `focusAndExpose` methods, `observeSubjectAreaChanges(of:)`.
- `Camera` / `CameraModel`: `focusAndExpose(at:)`. `CameraView`: tap gesture.

### Chapter 7 — Photo features (`chapter-07`)
Result: Live Photo capture with a "LIVE" badge, a quality prioritization picker, deferred photo delivery, responsive capture.
- `DataTypes`: `PhotoFeatures`, `QualityPrioritization`, `CaptureCapabilities` (Live Photo only), `CaptureActivity.isLivePhoto`, `Photo.isProxy`, `Photo.livePhotoMovieURL`, `OutputService.capabilities` and `updateConfiguration`.
- `PhotoCapture`: features, Live Photo callbacks, deferred proxy callback, `livePhotoCount`, full `updateConfiguration(for:)`, `capabilities`.
- `AVCam/Support/FoundationExtensions.swift`, `AVCam/Support/CaptureExtensions.swift` (`CMVideoDimensions` only).
- `CaptureService`: `captureCapabilities`, `updateCaptureCapabilities()`.
- `MediaLibrary`: `.photoProxy` and `.pairedVideo` resources.
- `Camera` / `CameraModel`: `isLivePhotoEnabled`, `qualityPrioritization`.
- Views: `FeaturesToolbar` (photo items), `LiveBadge`, overlay in `CameraUI`.

### Chapter 8 — RAW and Apple ProRAW (`chapter-08`)
Result: a RAW menu in the features toolbar with Off and Apple ProRAW. The menu shows only when the camera supports Apple ProRAW. Bayer RAW moved to chapter 16 (it needs a single physical camera). Details and decisions: `docs/PLAN-raw-and-fast-capture.md`, `research/08-raw.md`, `notes/chapter-08.md`.
- `DataTypes`: `RAWFormat`, `CaptureCapabilities` gets `isAppleProRAWSupported`, `PhotoFeatures` gets the RAW format.
- `PhotoCapture`: the RAW pixel format choice, `AVCapturePhotoSettings(rawPixelFormatType:processedFormat: nil)` (the RAW photo alone), an embedded JPEG preview, `Photo.isRAW`; `MediaLibrary` saves the DNG alone (the Camera app model). Deferred delivery is off while Apple ProRAW is chosen.
- Status: final (`aae9ddf`), verified on an iPhone 17 Pro Max with iOS 26 (device round 7).
- `Camera` / `CameraModel` / `PreviewCameraModel`: `rawFormat`. Views: `FeatureToolbar` (the `rawMenu`).
- The Simulator has no RAW format: the RAW menu is hidden there.

### Chapter 9 — Fast capture (`chapter-09`)
Result: the capture button follows the readiness of the photo output. Details: `research/09-fast-capture.md`, `notes/chapter-09.md`.
- `PhotoCapture`: responsive capture, fast capture prioritization, zero shutter lag, an `AVCapturePhotoOutputReadinessCoordinator` with a delegate that yields `CaptureReadiness` values.
- `DataTypes`: `CaptureReadiness`. `CaptureService`, `Camera`, `CameraModel`, `PreviewCameraModel`: `captureReadiness`.
- `CaptureButton`: `PhotoCaptureButton(readiness:)` dims or disables while the camera is not ready.
- Status: final (`cd72e2c`). Device test on an iPhone 17 Pro Max (iOS 26): all four switches `true/true`; a fast series showed only `ready` and `notReadyMomentarily` (no waiting state, so no dim button); responsive capture gave 12 MP photos at once between deferred 24 MP photos. Chapters 10 to 20 are rebased onto it (16 Oct 2026).

### Chapter 10 — Record video (`chapter-10`)
Result: a mode picker (and a swipe) changes between photo and video. The app records movies with sound, shows the recording time, and saves the movie to Photos.
- `DataTypes`: `CaptureMode`, `Movie`, `CaptureActivity.movieCapture`, `currentTime`, `isRecording`.
- Microphone: `DeviceLookup.defaultMic`, the microphone input, the microphone usage description.
- `AVCam/Capture/MovieCapture.swift` (HEVC and stabilization in `updateConfiguration`; no HDR yet).
- `CaptureService`: `movieCapture`, `captureMode`, `setCaptureMode(_:)`, `startRecording()`, `stopRecording()`, `observeOutputServices()`.
- `MediaLibrary.save(movie:)`.
- `Camera` / `CameraModel`: `captureMode`, `isSwitchingModes`, `toggleRecording()`.
- Views: `CaptureModeView`, `SwipeDirection` and the swipe gesture, movie capture button, `RecordingTimeView`, movie aspect ratio and mode-switch blur in `PreviewContainer`, controls disabled during recording.

### Chapter 11 — HDR video (`chapter-11`)
Result: an HDR button appears in video mode when the camera supports 10-bit HDR. The app records HDR video.
- `CaptureExtensions`: `activeFormat10BitVariant`, `isTenBitFormat`, `maxFrameRate`.
- `MovieCapture`: `isHDRSupported`, `capabilities`. `CaptureCapabilities.isHDRSupported`.
- `CaptureService`: `isHDRVideoEnabled`, `setHDRVideoEnabled(_:)`.
- `Camera` / `CameraModel`: `isHDRVideoSupported`, `isHDRVideoEnabled`, capabilities observation.
- `FeaturesToolbar`: HDR button.

### Chapter 12 — A robust session (`chapter-12`)
Result: the app shows a message during an interruption, recovers from a media services reset, starts fast (deferred start), hides controls until the session runs, and covers the stale preview frame when it returns from the background.
- `CaptureService`: `observeNotifications()`, `isInterrupted`, `isSetUp`, deferred start settings.
- `CameraModel`: `isInterrupted` drives `status` (approved deviation).
- Views: `hidden(until:)`, cover opacity in `PreviewContainer`.

### Chapter 13 — Hardware buttons and AirPods (`chapter-13`)
Result: the volume buttons, the Action button, the Camera Control press, and an AirPods stem click capture media, with the correct sounds. AirPods record high-quality audio.
- `CameraView`: `onCameraCaptureEvent`. `CaptureButton`: reaction to recording state changes from hardware.
- `CaptureService`: `configuresApplicationAudioSessionForBluetoothHighQualityRecording`.

### Chapter 14 — Camera Control (`chapter-14`)
Result: the Camera Control shows zoom, exposure bias, and a custom lens position slider. The app UI becomes minimal while the overlay is on screen.
- `CaptureService`: controls delegate, controls map, `configureControls(for:)`, `createControls(for:)`, `isShowingFullscreenControls`, `observeCaptureControlsState()`, `CaptureControlsDelegate`.
- `Camera` / `CameraModel`: `prefersMinimizedUI`. Views: opacity changes.

### Chapter 15 — Lock Screen and Control Center (`chapter-15`)
Result: the app starts from the Lock Screen, Control Center, and the Action button through a capture extension and a control. The app and the extension share their state.
- `AVCam/Model/CameraState.swift`, `AVCam/Model/Intent/AVCamCaptureIntent.swift`.
- `CameraModel`: `cameraState`, `syncState()`, persistence in `didSet`. `CaptureService.start(with:)`. `AVCamApp`: scene phase sync.
- Targets `AVCamCaptureExtension` and `AVCamControlCenterExtension`, with shared source membership as in the sample.

## Part 2: beyond the sample (chapters 16 to 20, added 2 Oct 2026; 17 and 18 on 14 Oct 2026)

These chapters are NOT in the Apple sample. The design is our own. Rule 1 of the code rules ("the final state equals the Apple sample") ends at `chapter-15`. All other rules stay. Each page of part 2 says clearly that the code is not Apple's.

- **Chapter 16 — Zoom and lenses (`chapter-16`)**: virtual back cameras, zoom levels from the switch-over factors, a zoom control, a pinch gesture, zoom state in sync with the device; planned: a section "Bayer RAW on a single lens" (Bayer RAW moved from chapter 8: switch to the physical camera that matches the zoom level while Bayer RAW is selected, zoom 1.0, no prioritization setter; see `notes/chapter-16.md`).
- **Chapter 17 — Fix the sample (`chapter-17`)**: a recording that ends by itself, the Live Photo badge counter, the rotation angle of a new movie connection, the capture sound before the capture work.
- **Chapter 18 — iPhone Duo (`chapter-18`)**: camera direction with `AVCaptureDeviceDirectionCoordinator`, preview mirroring by direction, a centered layout on the Duo display. Research: `research/06-iphone-duo.md`.

- **Chapter 19 — Two cameras at once (`chapter-19`)**: `AVCaptureMultiCamSession` as a second session, a dual capture mode, connections made by hand, two preview views with a tap to swap, multi-camera formats, hardware and system pressure costs. Research: `research/07-multicam.md`. Based on Apple's AVMultiCamPiP sample (`~/tutorials/AVMultiCamPiPCapturingFromMultipleCameras`).
- **Chapter 20 — Record picture in picture (`chapter-20`)**: video and audio data outputs on the multi-camera session, a Metal mixer that draws the small picture into the full frame, `AVAssetWriter` recording, save to the library.

`main` equals `chapter-20`.

## Hand-off notes (`notes/chapter-NN.md`)

The code agent of a chapter writes this file for the writer. Contents:

1. Result summary and how you verified it (build, run, screenshot, what the screen showed).
2. A proposed section and step order for the tutorial (the order in which a learner can type the code, so that the project compiles at the end of each section where possible).
3. Each place where the chapter changes or removes code from an earlier chapter.
4. Deviations from the Apple sample and the reasons.
5. Things that behave differently in the Simulator with SimCam, and things that need a real iPhone.
6. Paths of the screenshots you saved to `content/images/`.
