# Chapter 12 (was chapter 10 before the RAW and fast capture chapters) hand-off notes (code by the coordinator)

Branch `chapter-12`, start `chapter-11`. Full change: `git -C ../AVCamTutorialApp diff chapter-11 chapter-12` (about 110 added lines; about 25 to 30 steps).

## Result and verification
- Build succeeded, no warnings. Run with SimCam: the app starts, the controls fade in when the session runs, capture works as before.
- Not verified: interruptions (need a phone call or another camera app on a real device), media services reset, the background cover (not tested), the effect of deferred start on launch time.

## What the chapter adds
- `DataTypes`: `CameraStatus.interrupted`. `StatusOverlayView` (now identical to the sample): handles `.interrupted`, yellow message, a new preview.
- `CaptureService`: published `isInterrupted`, `isSetUp` with the early return and the assignment, `observeNotifications()` (three tasks: interruption, interruption end, runtime error with media services reset), deferred start lines (`automaticallyRunsDeferredStart`, `isDeferredStartEnabled` on the photo output).
- `CameraModel`: a task in `observeState()` that sets `status` to `.interrupted` or `.running` from `captureService.$isInterrupted`. THIS IS NOT IN THE APPLE SAMPLE (approved deviation): the sample publishes `isInterrupted` but nothing reads it, so its `.interrupted` status never appears. Say this clearly on the page.
- `ViewExtensions`: `hidden(until:)`. Applied in `MainToolbar` (thumbnail and switch buttons; with the comment about the capture button), `CaptureModeView`, `FeaturesToolbar`.
- `PreviewContainer` (now identical to the sample): `scenePhase`, `coverOpacity`, the overlay, `updateCoverOpacity`.

## Things to explain (research/01-capture-pipeline.md, sections on life cycle and deferred start; WWDC26 session 303)
- Interruption reasons and which ones the sample treats as interruptions; why `startRunning()` again after a media services reset; the session running state; multitasking camera access on iPad as capability map.
- Deferred start: what it does, that it is the default with the iOS 26 SDK, manual mode and the delegate as capability map.
- The stale preview frame and the cover; why controls are hidden until the session runs and why the capture button stays visible.
