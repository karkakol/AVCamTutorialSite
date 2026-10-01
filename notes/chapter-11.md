# Chapter 11 hand-off notes (code by the coordinator)

Branch `chapter-11`, start `chapter-10`. Full change: `git -C ../AVCamTutorialApp diff chapter-10 chapter-11` (31 added lines; about 10 to 14 steps, 20 minutes; the concept page is the main part).

## Result and verification
- Build succeeded, no warnings. Nothing in this chapter can be verified in the Simulator: hardware buttons, the Camera Control, and AirPods need a real iPhone. AirPods remote capture and high-quality recording are not available in the EU (see research), so a learner in the EU cannot test them at all.

## What the chapter adds
- `CameraView` (now identical to the sample): `import AVKit`, `.onCameraCaptureEvent(defaultSoundDisabled: true)` with the sound logic.
- `CaptureButton` (now identical to the sample): `.onChange(of: camera.captureActivity.isRecording)` so that the button animates when a hardware button starts or stops a recording.
- `CaptureService`: `captureSession.configuresApplicationAudioSessionForBluetoothHighQualityRecording = true`.

## Things to explain (research/04-system-integration.md, sections 1 and 2)
- `AVCaptureEventInteraction` and the SwiftUI modifier, its overloads, event phases, which button is primary or secondary, the requirement for an active session, `shouldPlaySound`, `play(_:)` and its limits (the research found that the sound comes late in the sample), the AirPods features and their limits.
