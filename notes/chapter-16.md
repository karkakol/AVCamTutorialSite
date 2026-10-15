# Chapter 16 hand-off notes: Zoom and lenses (code by the coordinator)

Branch `chapter-16`, start `chapter-15`. Full change: `git -C ../AVCamTutorialApp diff chapter-15 chapter-16` (about 250 added lines). THIS CHAPTER IS NOT IN THE APPLE SAMPLE. It is the first chapter of part 2, "Beyond the sample". The design is the coordinator's own; say so on the pages.

## Result and verification
- Build succeeded with no warnings. The app runs in the iPhone 18 Pro simulator as before.
- In the Simulator the zoom control is NOT visible: the SimCam camera has one zoom level and reports a largest zoom factor of 0. The first version crashed at launch there (`NSRangeException` from `setVideoZoomFactor`); the code now returns early for a camera that cannot zoom. This crash is a good teaching point: a value out of range raises an Objective-C exception that Swift cannot catch.
- The `ZoomControl` view was checked in a temporary build that ran the app with `PreviewCameraModel`: three levels "0,5", "1x", "3" appear above the mode picker, and a tap selects a level (yellow, with the multiplication sign). The decimal separator follows the locale.
- NOT verified: all zoom behaviour on a real iPhone (levels of a real triple camera, the ramp, the pinch, the sync with the Camera Control zoom slider, the zoom after a mode change).

## What the chapter adds
- `DeviceLookup`: the back discovery session now lists `.builtInTripleCamera`, `.builtInDualWideCamera`, `.builtInDualCamera`, `.builtInWideAngleCamera` (the first result has the most lenses). Before, the list had no ultra-wide camera.
- `DataTypes`: `ZoomLevel` (`videoZoomFactor`, `displayFactor`, `id`, `label`, `label(for:)`).
- `CaptureService`: published `zoomLevels` and `displayZoomFactor`; `zoomObserver`; `maxDisplayZoomFactor`; `configureZoom(for:)` (levels from `minAvailableVideoZoomFactor` and `virtualDeviceSwitchOverVideoZoomFactors`, a 2x level for a camera with one level, start at the 1x display level, KVO on `videoZoomFactor`); `updateDisplayZoomFactor(for:of:)`; `displayMultiplier(for:)`; `setZoom(to:)` (ramp); `setZoom(displayFactor:)` (direct, for the pinch); `setVideoZoomFactor(_:on:animated:)` (guard, clamp, lock, ramp or assign). Calls to `configureZoom` in `setUpSession()`, `changeCaptureDevice(to:)`, and `setCaptureMode(_:)`.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `zoomLevels`, `displayZoomFactor`, `setZoom(to:)`, `setZoom(displayFactor:)`; two observation tasks in `CameraModel.observeState()`. `PreviewCameraModel` has three example levels.
- Views: `Views/Controls/ZoomControl.swift` (new), `CameraUI` (control in both layouts), `CameraView` (`pinchStartFactor`, `pinchGesture` with `MagnifyGesture`).
- Project: `ZoomControl.swift` must also belong to the `AVCamCaptureExtension` target (File inspector, Target Membership), because the extension compiles `CameraUI.swift`. Use a `settings` step; list `AVCam.xcodeproj/project.pbxproj` in `uncovered:`.

## Things to explain (research/01-capture-pipeline.md device and zoom sections; SDK header `AVCaptureDevice.h`)
- Virtual devices and switch-over zoom factors; `displayVideoZoomFactorMultiplier` (the device value 1.0 of a triple camera is the 0.5x field of view); why the app starts at the 1x display level; `minAvailableVideoZoomFactor` and `maxAvailableVideoZoomFactor`; `ramp(toVideoZoomFactor:withRate:)` against a direct assignment; key-value observation of `videoZoomFactor` and why the Camera Control slider of chapter 14 then stays in sync; digital zoom and `videoZoomFactorUpscaleThreshold`; `secondaryNativeResolutionZoomFactors` and `systemRecommendedVideoZoomRange` as capability map.
- Known limits of this design: each pinch change starts its own task, so two values can arrive out of order; the zoom returns to 1x after a mode change and after a camera switch; the 2x level of a one-lens camera is digital zoom.
