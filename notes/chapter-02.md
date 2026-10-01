# Chapter 2 hand-off notes (code by the coordinator)

Branch `chapter-02`, start `chapter-01`. See the full change with `git -C ../AVCamTutorialApp diff chapter-01 chapter-02`.

## Result and verification
- Debug build for the iPhone 18 Pro simulator: succeeded, no warnings.
- Run with SimCam: the preview shows the back source. A tap on the switch button (bottom right) shows the front source after a short blur. Verified by screenshots.
- Not verified: the system-preferred camera path (needs an iPad with an external camera) and the rotation of the preview on a real device.

## What the chapter adds
- New files copied from the sample: `Capture/SPCObserver.swift` (unchanged), `Capture/DeviceLookup.swift` (without `defaultMic`, which chapter 8 adds), `Views/Toolbars/MainToolbar/SwitchCameraButton.swift` (without the `.disabled(...isRecording)` line, chapter 8).
- New files in reduced form: `Support/ViewExtensions.swift` (`largeButtonSize`, `DefaultButtonStyle` only), `Views/Toolbars/MainToolbar/MainToolbar.swift` (switch button only, conforms to `View`), `Views/CameraUI.swift` (toolbar at the bottom plus the status overlay), `Views/PreviewContainer.swift` (blur while `isSwitchingVideoDevices`).
- `CaptureService`: `activeVideoInput`, `deviceLookup`, `systemPreferredCamera`, rotation coordinator properties; `setUpSession()` now uses `deviceLookup.defaultCamera`; `currentDevice`; `selectNextVideoDevice()`; `changeCaptureDevice(to:)`; `monitorSystemPreferredCamera()`; `createRotationCoordinator(for:)` with the preview observer only; `updatePreviewRotation(_:)`; `videoPreviewLayer`.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `switchVideoDevices()`, `isSwitchingVideoDevices`.

## Changes to chapter 1 code
- `CaptureService.setUpSession()`: the `AVCaptureDevice.default(...)` lookup with `guard` is replaced by `try deviceLookup.defaultCamera`, and the input is stored in `activeVideoInput`.
- `CameraView`: the `ZStack` now holds `PreviewContainer { CameraPreview }` and `CameraUI`; `StatusOverlayView` moved into `CameraUI` as an overlay.

## Proposed sections
1. Find the cameras (`DeviceLookup`, discovery sessions, user-preferred and system-preferred camera).
2. Switch the camera in the capture service (`activeVideoInput`, `currentDevice`, `selectNextVideoDevice`, `changeCaptureDevice`, begin/commit configuration, the fallback on failure).
3. Add the switch button (model, protocol, preview model, `ViewExtensions`, `SwitchCameraButton`, `MainToolbar`, `CameraUI`, `CameraView`).
4. Blur the preview during the switch (`PreviewContainer`).
5. Follow the system-preferred camera (`SPCObserver`, `monitorSystemPreferredCamera`).
6. Keep the preview level (rotation coordinator, preview observer).

## Things to explain (from research/01-capture-pipeline.md)
- `videoPreviewLayer` calls `fatalError` if the preview layer is not connected to the session yet: a timing dependency of the sample.
- The back discovery session lists only dual and wide cameras, so there is no ultra-wide (0.5x).
- Simulator: SimCam supplies one back and one front camera. The user's two videos are the sources; no screenshots were saved because they show the user's room and face.
