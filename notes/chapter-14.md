# Chapter 14 hand-off notes (code by the coordinator)

Branch `chapter-14`, start `chapter-13`. Full change: `git -C ../AVCamTutorialApp diff chapter-13 chapter-14` (about 140 added lines; about 30 steps).

## Result and verification
- Build succeeded, no warnings. The app runs in the Simulator as before. The Camera Control does not exist in the Simulator (`supportsControls` is false, so `configureControls` returns early). The feature needs an iPhone 16 or later and was not verified.

## What the chapter adds
- `CaptureService` (identical to the sample after this chapter, except the session queue label and the chapter 15 parts): published `isShowingFullscreenControls`, `controlsDelegate`, `controlsMap`, `configureControls(for:)`, `createControls(for:)`, calls in `setUpSession()` and `changeCaptureDevice(to:)`, `observeCaptureControlsState()`, the `CaptureControlsDelegate` class at the end of the file.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `prefersMinimizedUI`; the task in `observeState()`.
- Views (now identical to the sample): `.opacity(camera.prefersMinimizedUI ? 0 : 1)` in `MainToolbar` (two places), `CaptureModeView`, `FeaturesToolbar`.

## Things to explain (research/04-system-integration.md, section 3)
- What the Camera Control is; `supportsControls`, `maxControlsCount`, add and remove inside begin/commit; the system zoom and exposure bias sliders; a custom `AVCaptureSlider` with an action queue; index pickers as capability map; the delegate callbacks and the fullscreen overlay; why the app hides its own controls; why controls are cached per device identifier; the stale lens slider that the research found.
