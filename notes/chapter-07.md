# Chapter 7 hand-off notes (code by the coordinator)

Branch `chapter-07`, start `chapter-06`. Full change: `git -C ../AVCamTutorialApp diff chapter-06 chapter-07`.

## Result and verification
- Build succeeded, no warnings. Run with SimCam: the features toolbar (Live Photo button, quality menu) appears at the top right. A capture with Live Photo on saved a JPEG and showed the thumbnail.
- NOT working in the Simulator: Live Photo (no paired movie was saved; SimCam does not seem to support it), deferred photo delivery, responsive capture, HEIF. The "LIVE" badge was not seen. These need a real iPhone. The code is the Apple sample's code.

## What the chapter adds
- `Capture/PhotoCapture.swift` is now identical to the Apple sample: `capturePhoto(with:)`, features in `createPhotoSettings(with:)` (`livePhotoMovieFileURL`, `photoQualityPrioritization`), `livePhotoCount` logic in `monitorProgress`, full `updateConfiguration(for:)`, `updateCapabilities(for:)`, `capabilities`, delegate: `isLivePhoto`, `isProxyPhoto`, `livePhotoMovieURL`, three new callbacks.
- `Model/DataTypes.swift`: `CaptureActivity.photoCapture` gets `isLivePhoto`; `isLivePhoto` property; `Photo.isProxy`, `Photo.livePhotoMovieURL`; `PhotoFeatures`; `CaptureCapabilities` (Live Photo only; chapter 9 adds HDR); `QualityPrioritization`; `OutputService.capabilities`.
- New files copied from the sample: `Support/FoundationExtensions.swift`, `Views/Overlays/LiveBadge.swift`.
- `CaptureService`: `captureCapabilities`, `capturePhoto(with:)`, capabilities line in `updateCaptureCapabilities()`.
- `MediaLibrary.save(photo:)`: `.photoProxy` or `.photo`, and the `.pairedVideo` resource.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `isLivePhotoEnabled`, `qualityPrioritization`; `CameraModel.capturePhoto()` builds `PhotoFeatures`.
- Views: `Toolbars/FeatureToolbar/FeatureToolbar.swift` (photo items only; chapter 8 adds the mode switch, chapter 9 the HDR button), `CameraUI` (Live badge overlay, `FeaturesToolbar` in both layouts).

## Changes to earlier code (use `remove` fences)
- `CaptureActivity`: the case and the `willCapture` pattern.
- `PhotoCapture`: signatures of `capturePhoto` and `createPhotoSettings`; `monitorProgress` body; `updateConfiguration`; delegate `willBeginCaptureFor`, `willCapturePhotoFor`, the `Photo(...)` initializer call.
- `CaptureService.capturePhoto`, `CameraModel.capturePhoto`.

## Things to explain (research/02-photo-capture.md, sections 5, 6, 7)
- The two-level rule again (enable on the output, select in the settings). Quality prioritization. Zero shutter lag, responsive capture, fast capture prioritization, deferred delivery and the proxy that must be saved as `.photoProxy`. Live Photo life cycle, why the movie output must not be in the session, the badge counter.
- Probable sample defects from the research: the badge counter tests `> 1`; `livePhotoMovieFileURL` is set without a support check; the microphone arrives only in chapter 8, so Live Photos have no sound until then.
