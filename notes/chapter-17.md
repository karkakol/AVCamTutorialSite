# Chapter 17 hand-off notes: Fix the sample (code by the coordinator)

Branch `chapter-17`, start `chapter-16`. Full change: `git -C ../AVCamTutorialApp diff chapter-16 chapter-17` (86 added lines, 13 removed). NOT in the Apple sample: this chapter corrects four defects that the research found (see "things to know" in chapters 7, 10, and 13 and the research files 02, 03, 04). The fixes are the coordinator's own design.

## Result and verification
- Build succeeded with no warnings.
- Fix 1 (recording that ends by itself) was verified in the Simulator with a temporary line `movieOutput.maxRecordedDuration = CMTime(seconds: 3, preferredTimescale: 600)` before `startRecording`: after 3 seconds the recording ended by itself, the movie appeared in the Photos library of the simulator, the timer went back to 00:00:00, the button returned to its idle form, and the thumbnail appeared. Offer this line as an Experiment so that the learner can see the fix work. A normal start and stop still saves the movie (verified).
- Fixes 2, 3, and 4 could NOT be verified in the Simulator (Live Photo, device rotation of a movie, and AirPods sounds need a real iPhone). They are small and follow from the code.

## The four fixes
1. `MovieCapture`: a recording can end before the app stops it (interruption, full disk, a size or time limit). Before, the delegate dropped the result because no continuation was set, the timer kept running, and a later `stopRecording()` never returned. Now: `MovieCaptureError.notRecording`; `unexpectedResults` stream with its continuation and `init()`; `unexpectedFinishHandler` on the delegate, set in `startRecording()`; the delegate builds a `Result`, treats an error with `AVErrorRecordingSuccessfullyFinishedKey == true` as success (`isMovieUsable(after:)`), and either resumes the continuation or calls the handler; `stopRecording()` returns an error at once when the output is not recording. `CaptureService`: `nonisolated let unexpectedRecordingResults`, set in `init()`. `CameraModel.observeState()`: a task that saves each unexpected movie or stores the error.
2. `PhotoCapture.monitorProgress`: `livePhotoCount > 1` is now `> 0`, with a new comment. With `> 1`, the badge goes off when the first of two overlapping Live Photos ends.
3. `CaptureService.setCaptureMode(_:)`: after `addOutput(movieCapture.output)`, call `updateCaptureRotation(rotationCoordinator.videoRotationAngleForHorizonLevelCapture)`, because a new output gets a new connection without the angle.
4. `CameraView.onCameraCaptureEvent`: the sound is selected and played BEFORE the capture work, so that a person with AirPods hears it at the click. Before, it played after capture, location, and save, and `play(_:)` does nothing after 15 seconds.

## Things to explain
- For each fix: the symptom, the cause in the code, the fix, how to test it. Use `remove` fences for each replaced line (the validator checks removed lines).
- Other known weak points that this chapter does NOT fix (list them as ideas): the capture activity never returns to idle after a photo; a photo processing error can get lost; state writes from more than one thread in `MovieCapture`; `CameraState` defaults HDR to on; failed saves leave files in the temporary folder.
- This chapter is short in code. Plan about 25 to 30 steps and 35 minutes. The concept page explains how to find such defects: read the delegate contract in the header, ask "what if this callback comes at another time", test end states.
