# Chapter 18 hand-off notes: record picture in picture (code by the coordinator)

Branch `chapter-18`, start `chapter-17`. Full change: `git -C ../AVCamTutorialApp diff chapter-17 chapter-18` (about 555 added lines, 13 files, one commit). NOT in the Apple AVCam sample. The design follows Apple's AVMultiCamPiP sample (mixer, recorder), rewritten for this app; the Metal kernel is our own. Read `research/07-multicam.md` (section "Chapter 18") first. Do not copy Apple's text or comments.

## Result and verification
- Build succeeded with no warnings for the iPhone 18 Pro simulator (iOS 27.0).
- In the Simulator with SimCam: the dual mode shows the record button and the time view. A tap starts a recording; the time counts; a second tap stops it, and the movie saves to the Photos library (DCIM count 15 to 16). The saved movie: 10.8 seconds, 2.8 MB, 640 x 480, about 30 frames per second, the small picture drawn at the top left of the full picture, no audio track (see below).
- First version crashed at the start of a recording: the Simulator returns audio settings with a sample rate of 0 and `AVAssetWriterInput` raises an exception. The guard in `DualRecorder.startRecording()` fixes it. Tell this story on the page.
- The movie is landscape in the Simulator (rotation angle for capture is 0 there), the same quirk as photos in chapter 3. On a real iPhone the angle from the rotation coordinator applies.
- A tap on the preview exchanges the pictures on the screen AND in the recording (verified by the thumbnail: the small picture is the front camera, the default).
- NOT verified: a real iPhone (audio track, HEVC settings, costs), the hardware button and AirPods path in the dual mode, a recording interrupted by a phone call.

## What the chapter adds
- New file `Capture/PiPMixer.metal`: struct `MixerParameters`, the sampler, the kernel `pictureInPictureMixer`. Must be in BOTH targets (the extension compiles `CaptureService`, which uses `MultiCamCapture`, which uses `DualRecorder` and the mixer).
- New file `Capture/PiPVideoMixer.swift`: `MixerParameters` (Swift copy of the shader struct), `smallPictureFrame` (normalized rect 0.04, 0.03, 0.3, 0.3), `isPrepared`, `outputFormatDescription`, Metal device, queue, pipeline state, texture cache, pool; `init` (library and pipeline), `prepare(with:)` (pool with BGRA + IOSurface, output format from a first buffer, texture cache), `reset()`, `mix(fullPicture:smallPicture:)` (textures, parameters in pixels, encoder, thread groups, commit and wait), `makeTexture(from:)`.
- New file `Capture/MovieRecorder.swift`: `AVAssetWriter` with a video input and an optional audio input; `init(videoSettings:audioSettings:)` (temporary URL from `URL.movieFileURL`, `expectsMediaDataInRealTime`), `append(videoSampleBuffer:)` (starts the session at the first frame), `append(audioSampleBuffer:)`, `finish()` (async, throws `writer.error`).
- New file `Capture/DualRecorder.swift`: `NSObject` + both data output delegate protocols; `@Published captureActivity`; `dataOutputQueue`; `smallPicture`; the three outputs; `mixer`, `recorder`, `latestSmallPictureFrame`, `recordingStartTime`, `reportedDuration`; `isRecording`; `startRecording()` (recommended settings, the sample-rate guard), `stopRecording() -> MovieRecorder?` (detaches), `captureOutput(_:didOutput:from:)` (audio to the recorder; video sorted into small or full), `process(fullPictureFrame:)` (mix only while recording, wrap in a sample buffer with the source time, report the time four times per second).
- `MultiCamCapture`: the three outputs and `recorder`; `configure` gets a `microphone:` parameter, creates the `DualRecorder`, calls `addMicrophone`; `addCamera` gets `videoOutput:` and `recorder:` parameters and adds the data output with its connection (BGRA settings, delegate on the data output queue, mirroring and the capture rotation angle); new `addMicrophone(_:recorder:)` (input with no connections, back audio port with a fallback, audio output, connection); new section "Recording": `setSmallPicture(_:)`, `startRecording()` (sync on the data output queue), `stopRecording()` (detach on the queue, then `finish()`).
- `CaptureService`: `startRecording()` and `stopRecording()` route to `multiCamCapture` in the dual mode; `setDualSmallPicture(_:)`; `startDualCaptureIfNeeded()` passes `try? deviceLookup.defaultMic` and calls `observeDualRecorder()`; new `observeDualRecorder()` (`receive(on: sessionQueue)`, `assign(to:)`).
- `CameraPreview`: `DualPreviewSource.setSmallPicture(_:)` and its implementation in `DefaultDualPreviewSource`.
- `DualCameraPreview`: the tap also calls `source.setSmallPicture`.
- `PreviewCameraModel`: `import AVFoundation`; the stub method.
- `CaptureButton`: `case .video, .dual:` share the `MovieCaptureButton` (the old `.dual` case with `EmptyView` is removed).
- `CameraView`: the two `.dual` cases in the capture event handler now play the sound and call `toggleRecording()` (the old `return` and `break` lines are removed).
- `CameraUI`: `.dual` shows `RecordingTimeView` (the old `EmptyView()` is removed).
- `project.pbxproj`: the four new files are in the `membershipExceptions` of the capture extension target (`uncovered:`; a Target Membership settings step for the four files, both targets).

## Changes to earlier code (remove fences)
- `MultiCamCapture.configure` signature (adds `microphone:`), `addCamera` signature, the call sites in `configure`.
- `CaptureService.startDualCaptureIfNeeded`: the `configure` call changes.
- `CaptureButton`, `CameraView` (two places), `CameraUI`: the `.dual` cases.

## Build order (each section compiles)
1. The movie recorder: `MovieRecorder.swift` complete (new file, 3 to 4 steps). Command-B.
2. The mixer: `PiPMixer.metal` (new file, 2 to 3 steps) and `PiPVideoMixer.swift` (new file, 6 to 8 steps). Target Membership step for the two files. Command-B.
3. The dual recorder: `DualRecorder.swift` (new file, 6 to 8 steps). Target Membership step. Command-B.
4. The outputs in the session: `MultiCamCapture` changes (outputs, recorder, `configure`, `addCamera` additions, `addMicrophone`, the recording section). Then `CaptureService.startDualCaptureIfNeeded` (the new call) and `observeDualRecorder`. Command-B.
5. The interface: `startRecording`/`stopRecording` routing, `setDualSmallPicture`, the `DualPreviewSource` method and stub, the tap, `CaptureButton`, `CameraView`, `CameraUI`. Build and run: record in the dual mode, stop, open Photos.
Check the order with the replay tool; `MultiCamCapture` uses `DualRecorder`, so section 3 must come before section 4.

## Design decisions to explain
- Why an asset writer: `AVCaptureMovieFileOutput` writes only what a connection delivers; mixed frames exist only in the app.
- Why a data output per camera, and one queue for all outputs: the delegate sorts the frames by output; one serial queue means no locks.
- Why the recorder keeps only the latest small picture frame and mixes on each full picture frame: the full picture sets the frame rate and the time stamps.
- Why mixing happens only while recording: the preview layers show the live pictures; the GPU work is not needed otherwise.
- The sample-rate guard (Simulator crash).
- `waitUntilCompleted()`: simple and correct; a production app would use a completion handler and more buffers.
- `receive(on: sessionQueue)` for the activity values: the recorder publishes from the data output queue; the actor property must change on the actor's queue.
- The detach pattern in `stopRecording`: stop the frames first (on the data queue), then finish the file (anywhere).
- Audio port by position: on iPhone the microphone input has a port per direction; the Simulator has one port.
- Ideas for later: cost checks and the system pressure observer from Apple's sample, a background task during the save, HDR, the direction coordinator in the dual mode.

## Page plan
- Concepts (about 15 minutes): the capture pipeline with data outputs (diagram: two cameras, two video data outputs, the microphone, one audio output, the recorder, the mixer, the asset writer, the Photos library); the sample buffer and its time; the Metal compute path (texture cache, kernel, thread groups); the asset writer life cycle; Simulator findings; capability map (what else data outputs allow: filters, machine learning, custom encoders); what was not verified.
- Build (about 55 minutes, about 40 steps): the five sections. Checkpoints: Command-B after sections 1 to 4; record a movie at the end.
