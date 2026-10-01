# Chapter 6 hand-off notes (code by the coordinator)

Branch `chapter-06`, start `chapter-05`. Full change: `git -C ../AVCamTutorialApp diff chapter-05 chapter-06`. It is a small chapter (about 70 added lines), so the tutorial page is short (about 20 steps, 25 minutes) and the concept page carries more weight.

## Result and verification
- Build succeeded, no warnings. Run with SimCam: a tap on the preview does not crash and logs no error. SimCam has no real lens, so the focus and exposure effect cannot be seen in the Simulator. It needs a real iPhone.

## What the chapter adds
- `CaptureService`: `focusAndExpose(at:)` (public, converts the view point with `captureDevicePointConverted(fromLayerPoint:)`), `observeSubjectAreaChanges(of:)`, `subjectAreaChangeTask`, the private `focusAndExpose(at:isUserInitiated:)`; calls to `observeSubjectAreaChanges` in `setUpSession()` and `changeCaptureDevice(to:)`.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `focusAndExpose(at:)`.
- `CameraView`: `.onTapGesture` on the preview.

## Things to explain (research/01-capture-pipeline.md, focus and exposure section)
- `lockForConfiguration()` / `unlockForConfiguration()`; focus modes and exposure modes; points of interest and their coordinate space (0...1, landscape, origin top left); why the point is converted by the preview layer; subject area change monitoring and why the app returns to continuous modes; the capability map: white balance, exposure bias, custom exposure (ISO and duration), zoom, torch, the new iOS 26 and 27 APIs that the research lists.
- The sample has no focus indicator on screen. Offer it as an Experiment.
