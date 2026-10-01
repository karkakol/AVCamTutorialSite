# Chapter 3 hand-off notes (code by the coordinator)

Branch `chapter-03`, start `chapter-02`. See the full change with `git -C ../AVCamTutorialApp diff chapter-02 chapter-03`.

## Result and verification
- Debug build for the iPhone 18 Pro simulator: succeeded, no warnings.
- Run with SimCam: a tap on the capture button logs `Captured a photo with 51427 bytes of data.` (read with `log show`; in Xcode it appears in the debug console). The capture button is in the centre of the toolbar.
- In the Simulator, SimCam delivers a 640 x 480 JPEG. On a real iPhone the photo is HEIF at the largest supported size.
- Not verified: the flash effect on screen (it lasts about 0.01 seconds, so a screenshot cannot show it) and the photo orientation.
- The photo is NOT saved in this chapter. Chapter 4 saves it to the Photos library.

## What the chapter adds
- `Model/DataTypes.swift`: `CaptureActivity` (`idle`, `photoCapture(willCapture:)`, `willCapture`), `Photo` (`data`), `CameraError.addOutputFailed`, `OutputService` protocol with the default `setVideoRotationAngle` and `updateConfiguration`.
- `Capture/PhotoCapture.swift`: reduced form of the sample (no photo features, no Live Photo, no deferred proxy). `capturePhoto()`, `createPhotoSettings()`, `monitorProgress(of:)`, `updateConfiguration(for:)` (max photo dimensions only), `PhotoCaptureDelegate`.
- `Support/CaptureExtensions.swift`: the `CMVideoDimensions` extension only (`.zero` is used in `updateConfiguration`).
- `CaptureService`: `import Combine`, published `captureActivity`, `photoCapture`, `outputServices`, `observeOutputServices()` (one publisher for now; chapter 8 merges two), `.photo` preset, `addOutput(_:)`, `capturePhoto()`, `updateCaptureCapabilities()` (configuration part only; chapter 7 adds the capabilities), capture rotation (`updateCaptureRotation`, the second observer, the second initial call).
- `Camera`, `CameraModel`, `PreviewCameraModel`: `captureActivity`, `capturePhoto()`, `shouldFlashScreen`, `error`; `CameraModel.observeState()` and `flashScreen()`.
- Views: `CaptureButton.swift` (photo button only), `MainToolbar` (placeholder, capture button, switch button), flash opacity in `CameraView`.

## Code that later chapters replace (use `transient` or explain)
- `CameraModel.capturePhoto()` logs the data size. Chapter 4 replaces the log line with the save call.
- `MainToolbar`: the `Color.clear` placeholder keeps the capture button centred. Chapter 4 replaces it with `ThumbnailButton`.
- `PhotoCaptureDelegate.willBeginCaptureFor` yields `.photoCapture()`; chapter 7 adds the Live Photo flag.

## Proposed sections
1. Describe a capture (data types: `CaptureActivity`, `Photo`, `OutputService`, error case).
2. Create the photo capture service (`PhotoCapture`: output, settings, `updateConfiguration`, `CaptureExtensions`).
3. Bridge the delegate to async code (`PhotoCaptureDelegate`, continuation, activity stream, `monitorProgress`).
4. Add the photo output to the session (`CaptureService`: preset, `addOutput`, `outputServices`, `updateCaptureCapabilities`, `observeOutputServices`, `capturePhoto`).
5. Give the photo the correct orientation (capture rotation).
6. Add the capture button and the flash (model, protocol, preview model, `CaptureButton`, `MainToolbar`, `CameraView`).

## Things to explain (from research/02-photo-capture.md)
- Settings objects are single use. The delegate callback order. Who keeps the delegate alive (the progress task).
- The `isolation: isolated (any Actor)? = #isolation` parameter and what the research found about it.
- `previewPhotoFormat` is requested but the sample never reads it.
- `captureActivity` never returns to `.idle` after a photo; the last value stays.
