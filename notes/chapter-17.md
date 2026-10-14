# Chapter 17 hand-off notes: two cameras at once (code by the coordinator)

Branch `chapter-17`, start `chapter-16`. Full change: `git -C ../AVCamTutorialApp diff chapter-16 chapter-17` (about 400 added lines, 16 files, one commit). NOT in the Apple AVCam sample. The design borrows the connection code from Apple's AVMultiCamPiP sample (see `research/07-multicam.md`), adapted to this app. Do not copy Apple's text or its comments.

## Result and verification
- Build succeeded with no warnings for the iPhone 18 Pro simulator (iOS 27.0).
- In the Simulator with SimCam: the mode picker shows a third mode (symbol `rectangle.on.rectangle`). In the dual mode the back camera fills the screen and the front camera is a small picture at the top leading corner, with a white border and round corners. A tap exchanges the two pictures with an animation. The back picture is not mirrored; the front picture is mirrored.
- A launch directly in the stored dual mode works.
- A change back to photo mode stops the multi-camera session, starts the single session again, and a photo saves to the library.
- The second preview can take up to 20 seconds to show frames in the Simulator. If one stays black, terminate and relaunch the app.
- NOT verified: a real iPhone (costs, formats, `supportedMultiCamDeviceSets`), iPhone Duo, interruptions in the dual mode, the microphone.

## What the chapter adds
- `DataTypes`: `CaptureMode.dual` with its symbol.
- New file `Capture/MultiCamCapture.swift`: `isSupported`, the `AVCaptureMultiCamSession`, `configure(backCamera:frontCamera:backPreview:frontPreview:)`, `addCamera(_:previewLayer:)` (format, input with no connections, port, preview layer with no connection, connection, mirroring, rotation), `selectMultiCamFormat(for:)`, `hardwareCost`, `systemPressureCost`, `start()`, `stop()`.
- `CameraPreview`: `PreviewTarget.previewLayer` (main actor), protocol `DualPreviewSource`, `DefaultDualPreviewSource`.
- New file `Views/DualCameraPreview.swift`: `DualCameraPreview` (SwiftUI, tap to swap), `DualPreviewViews` (`UIViewRepresentable`), `DualPreviewContainer` (layout of the two preview views).
- `CaptureService`: `dualPreviewSource`, `multiCamCapture`, `dualPreviewLayers`, the fallback in `start(with:)`, the session preset line (`.video ? .high : .photo`), the dual branch in `setCaptureMode(_:)` (stop one session, start the other, restart after commit), `attachDualPreview(back:front:)`, `startDualCaptureIfNeeded()`, `.dual` in `updateCaptureCapabilities()`.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `isDualCaptureSupported`, `dualPreviewSource` (and the stub), `.dual` in `capabilities(for:)`.
- Views: `CameraView` (the overlay with the swipe gesture, two `.dual` cases in the capture event handler, a comment change on the single preview), `CameraUI`, `FeaturesToolbar`, `CaptureButton` (`EmptyView` for `.dual`), `CaptureModeView` (`modes`, width 240 with three modes, `ForEach(modes)`, the `onChange` body uses `modes`), `SwitchCameraButton` (disabled in dual), `ZoomControl` (hidden in dual).
- `project.pbxproj`: the two new files are in the `membershipExceptions` list of the capture extension target. For a target that does not own the synchronized folder, that list is the files it compiles. So both files belong to BOTH targets (the extension compiles `CaptureService.swift` and `CameraView.swift`, which use the new types). `uncovered:` the project file; the page has a Target Membership settings step as in chapter 14.

## Changes to earlier code
- `CaptureService.setUpSession()`: the preset line changes from `captureMode == .photo ? .photo : .high` to `captureMode == .video ? .high : .photo` (a `remove` fence).
- `CaptureModeView`: `ForEach(CaptureMode.allCases)` becomes `ForEach(modes)`; the `.frame(width: 180)` line changes; the `let modes = CaptureMode.allCases` line in `onChange` is removed.
- `ZoomControl`: the opacity line changes.
- `CameraView`: the comment above `CameraPreview` changes (two lines).
- `Camera.swift`: the doc comment of `captureMode` changes.

## Build order (each section compiles)
1. The mode: `CaptureMode.dual`, then every `switch` that needs a `.dual` case (`CameraView` two places, `CameraUI`, `FeaturesToolbar`, `CaptureButton`, `CaptureService.updateCaptureCapabilities`, `PreviewCameraModel.capabilities`), `setCaptureMode` gets `case .dual: break` and the preset line. Build: the picker shows three modes, the dual mode shows the normal preview.
2. The multi-camera session: `MultiCamCapture.swift` complete (new file; split into steps: class and `isSupported`, session and inputs, `configure`, `addCamera` in two or three steps, `selectMultiCamFormat`, costs, start and stop). Build only.
3. The preview path: `PreviewTarget.previewLayer`, `DualPreviewSource`, `DefaultDualPreviewSource`, `DualCameraPreview.swift` (new file, split), `Camera` protocol additions, `CameraModel`, `PreviewCameraModel` stub. Build only (the service method does not exist yet, so add `attachDualPreview` in this section too, or order the service section first; the validator does not care, the replay tool builds at the end of each section).
4. The capture service: `multiCamCapture`, `dualPreviewLayers`, `attachDualPreview`, `startDualCaptureIfNeeded`, `dualPreviewSource`, the dual branch in `setCaptureMode`, the fallback in `start(with:)`.
5. The interface: the overlay in `CameraView`, `CaptureModeView.modes` and width, `SwitchCameraButton`, `ZoomControl`. Build and run: dual mode shows both cameras; tap to swap.

The writer split this into 6 sections (preview types first, then the service, then the connection), because the service and `DefaultDualPreviewSource` depend on each other. Replay: all sections build; sections 3 and 4 show "unclear (brace position)" because git marks the closing brace of `PreviewTarget` as new; the learner's file is correct.

## Design decisions to explain
- A second session, not a replacement: presets, deferred start, and the photo and movie outputs stay as they are. Two sessions never run at the same time.
- Connections by hand: automatic connections would link each camera to every output. The preview layer gets the session with no connection and then one connection to one port.
- A connection made by hand has no automatic mirroring or rotation. The chapter sets both. Chapter 16 told the mirroring rule; here it is applied with position only (no direction coordinator in the dual mode: idea for later).
- Format selection and costs: why not every format works, what the two costs mean, what to do when they exceed 1.0 (Apple's sample reduces resolution, frame rate, then ports).
- `startRunning()` of a multi-camera session blocks; the app calls it on the capture actor, never on the main actor.
- The single preview stays in place: the service needs its connection at setup time.
- Not done, list as ideas for chapter 18: capture (a mixed movie with `AVCaptureVideoDataOutput`, Metal, `AVAssetWriter`), the microphone, cost checks, interruptions, iPhone Duo direction in dual mode.

## Page plan
- Concepts (about 14 minutes): why a plain session cannot run two cameras; the multi-camera session; connections by hand with a diagram (two inputs, two ports, two preview layers, no automatic links); formats and the two costs; the thermal rules; what Apple's PiP sample does; the capability map (device sets, data outputs, two microphones); what was and was not verified.
- Build (about 50 minutes, about 38 steps): the five sections above. Checkpoints at the end of sections 1 and 5.
- No screenshots (the user's SimCam videos show their room and face). A diagram `ch17-connections.svg` is welcome.
