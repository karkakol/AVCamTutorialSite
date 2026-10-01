# Chapter 8 hand-off notes (code by the coordinator)

Branch `chapter-08`, start `chapter-07`. Full change: `git -C ../AVCamTutorialApp diff chapter-07 chapter-08`. This is the largest chapter (about 500 added lines). Plan about 55 to 60 steps and 60 minutes; whole-file `new` steps are fine for `RecordingTimeView`, `CaptureModeView`, and the movie button.

## Result and verification
- Build succeeded, no warnings. Run with SimCam: the mode picker changes to video (9:16 preview, blur during the change). The capture button turns red; a tap starts the recording, the timer at the top counts (00:00:03 seen), the picker and the switch button are dimmed. A second tap stops, and a `.MOV` of about 1 MB appears in the Photos library of the simulator.
- Not verified: sound in the movie, HEVC and stabilization (expect them to be absent in the Simulator), the swipe gesture.

## What the chapter adds
- `DataTypes`: `CaptureMode`, `Movie`, `CaptureActivity.movieCapture(duration:)`, `currentTime`, `isRecording`, `CameraError.audioDeviceUnavailable`.
- Microphone: `DeviceLookup.defaultMic` (the file is now identical to the sample), the microphone input in `setUpSession()`, build setting `NSMicrophoneUsageDescription` = "To record audio for Live Photos and videos." ("Privacy - Microphone Usage Description").
- `Capture/MovieCapture.swift`: the sample's file without the HDR parts (chapter 9): no `isHDRSupported`, and `capabilities` returns `CaptureCapabilities()`.
- `CaptureService`: `movieCapture`, both services in `outputServices`, `captureMode`, `setCaptureMode(_:)` (without the HDR lines), `startRecording()`, `stopRecording()`, the mode switch in `updateCaptureCapabilities()`, `Publishers.Merge` in `observeOutputServices()`.
- `MediaLibrary.save(movie:)` (the file is now identical to the sample).
- `Camera`, `CameraModel`, `PreviewCameraModel`: `captureMode` (with `didSet`), `isSwitchingModes`, `toggleRecording()`; `PreviewCameraModel.init(captureMode:status:)`.
- Views: `Controls/CaptureModeView.swift`, `Overlays/RecordingTimeView.swift`, `CaptureButton` (mode switch, `isRecording` state, `MovieCaptureButton`, second preview), `CameraView` (`swipeDirection`, the swipe gesture, `SwipeDirection`, `CameraUI(camera:swipeDirection:)`), `CameraUI` (now identical to the sample: binding, `CaptureModeView`, the overlay that shows the badge or the recording time), `PreviewContainer` (mode-dependent offset and aspect ratio, blur for `isSwitchingModes`), `FeaturesToolbar` (switch on the mode; the video case is `EmptyView()` until chapter 9), `SwitchCameraButton` and `ThumbnailButton` (disabled during recording).

## Things to explain (research/03-video-capture.md, sections 1, 2, 3, 6, 7, 8, 9)
- Movie file output against data outputs with an asset writer. Presets `.photo` and `.high`, why the movie output is removed in photo mode (Live Photo), the cost of reconfiguration. The recording delegate and the continuation set at stop time. The timer that polls `recordedDuration`. Stabilization and HEVC configured when the connection exists. Audio: the session manages the audio session; mono by default.
- Sample defects from the research: a recording that ends by itself is lost and `stopRecording()` never returns; any delegate error counts as a failure; the timer writes state on the main thread.
