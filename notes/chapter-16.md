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

## Planned addition: Bayer RAW on a single lens (decided 16 Oct 2026)

Chapter 8 offers Off and Apple ProRAW only. Bayer RAW moves here, as a section "Bayer RAW on a single lens", because it needs a physical camera that the app selects on purpose and a zoom factor of 1.0. Sources: `research/08-raw.md` sections B, G, H; `notes/chapter-08.md`; `ch08-concepts.md` finding 6.

### Device facts (iPhone 17 Pro Max, iOS 26)
- The system-preferred back camera was the virtual "Back Triple Camera": the RAW list had Apple ProRAW only, no Bayer RAW.
- After a zoomed shot in the Camera app, the preferred camera was the physical "Back Telephoto Camera": the list had Apple ProRAW and Bayer RAW. Apple ProRAW there: 8064x6048, 54 MB.
- A Bayer RAW capture crashed: `*** -[AVCapturePhotoSettings setPhotoQualityPrioritization:] Unsupported when capturing RAW`, at the line that set `.speed`. Apple ProRAW with `.quality` did not crash in the same build.
- Never run: a complete Bayer RAW capture, its size, the save path that Photos accepts for it (DNG alone or the pair), the badge.

### Rules
- Bayer RAW only on a single physical camera (WWDC21 10160; SDK header of `isAppleProRAWEnabled`).
- The zoom factor must be 1.0 (header rules of `capturePhoto(with:delegate:)`); a violation raises an exception that Swift cannot catch.
- Do not call the `photoQualityPrioritization` setter for any RAW request (chapter 8 code already skips it; the header text about `.speed` is wrong for the device).
- Live Photo: the header allows it with Bayer RAW, but the RAW save does not keep the movie; simplest is to exclude the movie for every RAW request (`excludesLivePhoto = rawType != nil` already does).
- Deferred delivery off for RAW (chapter 8 `updateDeferredPhotoDelivery()` covers any non-Off format).
- Test with `AVCapturePhotoOutput.isBayerRAWPixelFormat(_:)`; Bayer formats come before the Apple ProRAW formats in the list.

### Design
- `RAWFormat` gets `bayerRAW` ("RAW"); `CaptureCapabilities` gets `isBayerRAWSupported`; `rawPixelFormat(for:)` gets the Bayer case; `FeaturesToolbar.supportedRAWFormats` gets one case (the compiler asks for it); chapter 11 HDR flag stays.
- While Bayer RAW is selected, switch the session input to the physical camera that matches the current zoom level (for example the wide camera at 1x, the telephoto camera at its level; the constituent devices of the virtual camera, `constituentDevices`). Back to the virtual camera when RAW is Off or Apple ProRAW. Keep the zoom levels honest: the physical camera has no lens switch, so the zoom control shows the levels of that camera only, or the choice of a level switches the camera.
- Before a Bayer capture, check `videoZoomFactor == 1.0` on the physical camera; if not, set it to 1.0 or fall back to no RAW, with a log line.
- No prioritization setter (already in chapter 8).
- The "RAW on <camera> (virtual: …)" log of chapter 8 gets the Bayer flag again.
- Device test: Bayer RAW on the wide and the telephoto camera; no crash; which save path; the badge; the size.
