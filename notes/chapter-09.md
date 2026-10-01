# Chapter 9 hand-off notes (code by the coordinator)

Branch `chapter-09`, start `chapter-08`. Full change: `git -C ../AVCamTutorialApp diff chapter-08 chapter-09` (about 100 added lines; plan about 25 steps, 30 minutes; the concept page carries more weight).

## Result and verification
- Build succeeded, no warnings. Run with SimCam: video mode works as before. The HDR button does NOT appear in the Simulator, because the SimCam camera has no 10-bit format (`isHDRVideoSupported` is false). This is the correct behaviour of the code. HDR recording needs a real iPhone and was not verified.

## What the chapter adds
- `Support/CaptureExtensions.swift` (now identical to the sample): `AVCaptureDevice.activeFormat10BitVariant`, `Format.isTenBitFormat`, `Format.maxFrameRate`.
- `Capture/MovieCapture.swift` (now identical to the sample): `isHDRSupported`, the line in `updateConfiguration(for:)`, `capabilities` with the HDR flag.
- `DataTypes`: `CaptureCapabilities.isHDRSupported` and the new initializer.
- `CaptureService`: published `isHDRVideoEnabled`, `setHDRVideoEnabled(_:)`, the HDR lines in `setCaptureMode(_:)`.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `isHDRVideoSupported`, `isHDRVideoEnabled` (with `didSet` in the model), the capabilities task in `observeState()`.
- `FeaturesToolbar`: the video case shows `hdrButton`; `hdrButton` and `hdrToggleButton`.

## Changes to earlier code
- `CaptureCapabilities` initializer; `MovieCapture.capabilities`; `FeaturesToolbar` `EmptyView()` replaced.

## Things to explain (research/03-video-capture.md, sections 4 and 5)
- Device formats; `activeFormat` against session presets (setting a format changes the preset to input priority); 10-bit `x420`; HLG and BT.2020; the difference between this "HDR" and `isVideoHDREnabled`; how `activeFormat10BitVariant` selects a format and its limits; why the else branch sets the `.high` preset again; frame rates as capability map.
- Unverified points from the research: whether HDR stays on after a camera switch (the code does not apply it again).
