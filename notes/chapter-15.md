# Chapter 15 hand-off notes (code by the coordinator)

Branch `chapter-15`, start `chapter-14`. Full change: `git -C ../AVCamTutorialApp diff chapter-14 chapter-15`. After this chapter each Swift file under `AVCam/` is identical to the Apple sample, except the approved deviations (see `docs/PLAN.md`).

## Result and verification
- Build for the simulator succeeded, no warnings. The built app contains `Extensions/AVCamCaptureExtension.appex` and `PlugIns/AVCamControlCenterExtension.appex`. The app runs in the Simulator as before.
- Not verified at run time: launch from the Lock Screen, Control Center, or the Action button; the shared state between app and extension. These need a real iPhone and signing with a team.

## What the chapter adds (Swift)
- `Model/CameraState.swift`, `Model/Intent/AVCamCaptureIntent.swift` (copied from the sample).
- `CaptureService`: `start(with:)` sets `captureMode` and `isHDRVideoEnabled` from the state; `setUpSession()` selects the preset from the mode and, in video mode, adds the movie output with deferred start and applies HDR.
- `CameraModel`: `import Combine`, `cameraState`, `syncState()`, the call in `start()`, `captureService.start(with:)`, the `didSet` blocks that store values in `cameraState` (capture mode, Live Photo, quality prioritization, HDR enabled, HDR supported).
- `Camera`, `PreviewCameraModel`: `syncState()` (and `PreviewCameraModel` gets the rest of the sample's file: `isVideoDeviceSwitchable`, `capabilities(for:)`).
- `AVCamApp`: `scenePhase` and the `onChange` that calls `syncState()`.
- `DataTypes`: `CameraError.deviceChangeFailed`.
- New folders: `AVCamCaptureExtension/` (`AVCamCaptureExtension.swift`, `Info.plist` with `EXExtensionPointIdentifier = com.apple.securecapture`) and `AVCamControlCenterExtension/` (`AVCamControlCenterExtension.swift`, `AVCamControlCenterExtensionBundle.swift`, `Assets.xcassets`, `Info.plist` with `NSExtensionPointIdentifier = com.apple.widgetkit-extension`). The control `kind` string uses the bundle identifier `com.karolkakol.AVCam...`.

## What the chapter adds (Xcode project) — the learner does this in the Xcode UI; use `settings` steps
1. File > New > Target > "Capture Extension", name `AVCamCaptureExtension`, embedded in AVCam. Xcode creates the folder, the target, and the "Embed ExtensionKit Extensions" phase. Replace the template Swift file content with the sample's file.
2. File > New > Target > "Widget Extension", name `AVCamControlCenterExtension`, without Live Activity and without configuration intent; delete the template widget files that are not needed; keep the bundle file and the control file. Xcode creates the "Embed Foundation Extensions" phase.
3. Target membership: all Swift files under `AVCam/` except `AVCamApp.swift` (28 files) also belong to `AVCamCaptureExtension`. Three files also belong to `AVCamControlCenterExtension`: `Model/CameraState.swift`, `Model/DataTypes.swift`, `Model/Intent/AVCamCaptureIntent.swift`. In Xcode: select the files, File inspector, Target Membership.
4. Capture extension build settings: deployment target iOS 26.0; usage descriptions for camera, microphone, and location; the same Swift settings as the app (Swift 5, default actor isolation nonisolated, approachable concurrency No, member import visibility No).
5. Control extension: deployment target iOS 26.0; same Swift settings.
6. Bundle identifiers: `com.karolkakol.AVCam.AVCamCaptureExtension` and `com.karolkakol.AVCam.AVCamControlCenterExtension`.
The exact template names and options in Xcode 27.1 were NOT checked in the Xcode UI; the project file was written by hand. Say on the page that names can differ a little, and that the learner can compare with the `chapter-15` branch. List `AVCam.xcodeproj/project.pbxproj`, the two `Info.plist` files, and the asset catalog in `uncovered:`.

## Things to explain (research/04-system-integration.md, sections 4 to 7)
- What a capture extension is and its limits on a locked device; `LockedCameraCaptureExtension`, `LockedCameraCaptureUIScene`, the session object that the sample ignores; `CameraCaptureIntent`, its app context (4 kB limit), how the system selects the app or the extension; the control widget and how a person adds it; why the files are shared with the extension; the research findings (`syncState()` runs the mode change again, unordered state writes).
- Write also a short "what next" bridge to the wrap-up page.
