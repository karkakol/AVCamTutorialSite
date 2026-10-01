# Technical review: chapters 7 and 8

Pages: `ch07-concepts.md`, `ch07-build.md`, `ch08-concepts.md`, `ch08-build.md`.
Date: 2026-10-01. SDK: `iPhoneOS27.1.sdk`. App branches: `chapter-07`, `chapter-08`.

Short names for the evidence:

- **PO.h** = `AVFoundation.framework/Headers/AVCapturePhotoOutput.h`
- **FO.h** = `.../AVCaptureFileOutput.h`
- **S.h** = `.../AVCaptureSession.h`
- **W23** = WWDC23 session 10105 transcript, https://developer.apple.com/videos/play/wwdc2023/10105/
- **Experiment** = a small Swift program, compiled with `-swift-version 5 -strict-concurrency=minimal` (the settings of the app target), in `scratchpad/review-c/main.swift`

## Findings

| # | Page | Claim | Verdict | Evidence | Change |
|---|---|---|---|---|---|
| 1 | ch07-build, step "Set the quality prioritization" | The raw-value initializer "returns `nil` for a number that is not 1, 2, or 3". | WRONG | Experiment: `AVCapturePhotoOutput.QualityPrioritization(rawValue: 7)` and `(rawValue: 0)` return a non-nil value. An enumeration that Swift imports from Objective-C does not test the raw value. | The text now says that the result is optional, that the initializer does not return `nil` for an unknown number, and that the raw values of the app type must stay 1, 2, and 3. |
| 2 | ch07-concepts, Common mistakes | "You implement only `didFinishProcessingPhoto` ... your delegate has no data for them." | WRONG | PO.h:113 and PO.h:1069: with deferred delivery enabled, the delegate must implement the proxy callback, "otherwise an NSInvalidArgumentException will be thrown from `capturePhotoWithSettings:delegate:`". | The text now says that `capturePhoto` raises an exception. |
| 3 | ch08-concepts, Things to know; ch08-build, note in the timer step | "All other code of `MovieCapture` runs on the session queue of the capture service actor." | WRONG | Experiment: an actor with a serial queue executor calls a plain class. The synchronous method runs on the session queue. The body of the `async` method (the shape of `MovieCapture.stopRecording()`) does not. Dossier 02, section 2, has the same result as [E]. Project settings: `SWIFT_VERSION = 5.0`, `SWIFT_APPROACHABLE_CONCURRENCY = NO`. | The two pages now say only that the capture service actor calls the class from its session queue. |
| 4 | ch08-build, step "add `startRecording()` and `stopRecording()`" | "They are methods of the actor, so the calls run on the session queue." | WRONG (for the call to `stopRecording()` of the movie service) | Same experiment as finding 3. | "so they start on the session queue". |
| 5 | ch08-build, step `CaptureModeView` | "With two modes, that is sufficient." | WRONG in one case | `chapter-08:AVCam/Views/Controls/CaptureModeView.swift` and `CameraView.swift`: the start value of `swipeDirection` is `.left`, and `onChange` runs only when the value changes. Select video with the picker, then swipe left: the value does not change, so the mode does not change. | One sentence added that tells this case. |
| 6 | ch08-concepts, Audio | "Music from a different app stops when the session starts." | UNSUPPORTED (the moment), and incomplete | S.h:562: the default of `configuresApplicationAudioSessionToMixWithOthers` is NO, which means "interrupting" other audio. But it has "no effect on Live Photo movie complement capture (where music is always mixed with)". No source gives the moment of the interruption. AVCam starts in photo mode with Live Photo capture. | The text now says what the header says, with the Live Photo exception, and gives no moment. |
| 7 | ch07-concepts (Deferred photo delivery, Common mistakes); ch07-build (step for `.photoProxy`, quiz answer 2) | Proxy data saved as `.photo`: "the library keeps only the image with light processing" and "a photo of low quality for all time". | UNSUPPORTED | W23 says only that `.photoProxy` "is what tells PhotoKit to trigger deferred processing". PO.h:2298 gives the error only for the opposite case. Dossier 02 has no source tag for this sentence. | "probably" added in four places. One sentence added: only this type tells Photos to do the later processing. |
| 8 | ch07-build, quiz question 2 | Wrong choice "The save fails with an error when proxy data has the type `.photo`", with the explanation that this does not fail. | Quiz: the choice is not proven false | Same as finding 7. No source says what Photos does with proxy data of the type `.photo`. | The choice is now "When deferred delivery is enabled, the Photos library accepts only the type `.photoProxy` for each photo." This is false by PO.h:380 and W23 (one session gives the two kinds). |
| 9 | ch07-concepts, note after the capability table | "Deferred delivery needs the `.photo` preset." | UNSUPPORTED | PO.h:378: support "may change as the session's sessionPreset or source device's activeFormat change". W23: "a particular format or session preset, typically the Photo session preset". | "Apple shows deferred delivery with the `.photo` preset." |
| 10 | ch07-concepts, note on zero shutter lag | "The Camera app of the system starts earlier." | UNSUPPORTED | No header, document, or transcript says when the Camera app starts a capture. PO.h:699 recommends to call `capturePhoto` "as early as possible when handling the touch down event". | The sentence now gives the recommendation of the header. |
| 11 | ch07-concepts (Things to know); ch07-build (first note) | "In the Simulator with SimCam, Live Photo capture, deferred delivery, and responsive capture do not work." | UNSUPPORTED for two of the three | `research/05-simcam.md` has a test for Live Photo only ("NOT seen"). It has no test for deferred delivery or responsive capture. | Live Photo: "does not work". The other two: "probably do not work". |
| 12 | ch07-concepts, Live Photo capture | "Each capture needs its own URL." | UNSUPPORTED | PO.h:1558 and the documentation of `livePhotoMovieFileURL` do not say this. Apple's article has only `// output url`. It is a sensible rule, because movies can overlap (PO.h:73). | "AVCam gives each capture its own URL." The advice in Common mistakes stays. |

Totals: 5 WRONG, 6 UNSUPPORTED, 1 quiz choice.

## Important claims that are correct

Chapter 7:

- The default of `maxPhotoQualityPrioritization` and of `photoQualityPrioritization` is `.balanced` (PO.h:344, PO.h:1380). A request above the maximum raises an exception (PO.h:99).
- The raw values of the AVFoundation type are 1, 2, 3 (PO.h:331-335).
- What each level does: `.speed` light processing with some noise reduction, `.balanced` fast fusion, `.quality` heavy processing that depends on device and light. A higher maximum costs memory and power. `.balanced` and `.quality` can join frames with different exposures (WWDC21-10247 transcript).
- Zero shutter lag is on automatically for apps linked on iOS 17 or later (PO.h:699). It does not apply to flash, manual exposure, or brackets (PO.h:699, W23).
- Responsive capture needs zero shutter lag (PO.h:709). Fast capture prioritization needs responsive capture (PO.h:358). So the order of the two lines is important.
- Fast capture prioritization goes from the highest quality toward "balanced" (W23). The resolved settings report it (PO.h, `AVCaptureResolvedPhotoSettings.fastCapturePrioritizationEnabled`).
- "Enabled" values go back to `false` when "supported" becomes `false` (PO.h:358, 575, 689, 709). To enable a feature that is not supported raises an exception (PO.h:368, 390, 699, 719).
- Deferred delivery: the system decides for each capture, no setting (W23). The proxy is a subclass of `AVCapturePhoto` (PO.h:2343). Normal data as `.photoProxy` fails (PO.h:2298). Save quickly (PO.h:1063, W23). Changes to the proxy do not appear in the final photo (W23). Write permission to save, read permission to show (W23). 24 MP only with deferred delivery (PO.h:114), because the later processing does not share memory with the session (WWDC26-304 transcript).
- A12 or newer for responsive capture, iPhone 11 Pro or newer for deferred delivery (W23).
- Live Photo: not together with a movie file output, `isLivePhotoCaptureSupported` is then `false` (PO.h:43). Sound needs an audio input (PO.h:41, 1558). The output makes the content identifier (PO.h:1578). A movie URL without enabled Live Photo capture raises an exception (PO.h:103). `livePhotoMovieDimensions` is zero for a capture that is not a Live Photo (PO.h:1879).
- `willBeginCaptureFor` is always first and `didFinishCaptureFor` is always last (PO.h:981, 1172).
- Apple's article says to hide the indicator "only when that number reaches zero" (https://developer.apple.com/documentation/avfoundation/capturing-and-saving-live-photos).
- `shouldMoveFile` moves the file and removes the original only after a successful save (`PHAssetCreationRequest.h:26`).
- The trace of the badge counter with the test `> 1` agrees with `chapter-07:AVCam/Capture/PhotoCapture.swift`.
- The other "Things to know" points for chapter 7 agree with the code: no support test in `createPhotoSettings(with:)`, the URL is kept after a movie error, the save waits for the last callback and for a location.

Chapter 8:

- `startRecording` fails if a file exists (FO.h:73). On iOS an output makes one recording at a time (`AVError.h:97`). `stopRecording` returns before the file is complete (FO.h:93).
- The finish callback is the only required method. The output calls it for each recording request, also when it wrote nothing. The thread is not specified (FO.h:311-334).
- `pauseRecording` and `resumeRecording` are iOS 18 (FO.h:133, 145). A format or device change stops a recording (FO.h:131).
- The header does not say that `recordedDuration` is observable (FO.h:148-155).
- The first entry of `availableVideoCodecTypes` is the default, and the list can change with the preset (FO.h:445). The codec must be in the list (FO.h:490).
- The orientation of a movie is read when the recording starts. A metadata track can record later changes (FO.h:520-528).
- `.high` is the default preset and means high-quality video and audio (`AVCaptureSessionPreset.h:39`). With the `.photo` preset, a movie has the resolution of the preview (`AVCaptureDevice.h:3702`). The session accepts a movie output with this preset.
- Stabilization: `.auto` selects a mode for the format and frame rate, `activeVideoStabilizationMode` tells the result, the default is off (S.h:1211, 1221). `isVideoStabilizationSupported` is about "one or more formats" of the device (S.h:1231). Field of view, latency, and memory of the modes (`AVCaptureDevice.h:3311-3327`). The low-latency mode is iOS 26.
- Audio: the capture session sets the play-and-record category and selects a microphone for the camera (S.h:552). The default of `multichannelAudioMode` is `.none`, single channel, built-in microphones only (`AVCaptureInput.h:382`). Mix with other audio is iOS 18 (S.h:564).
- The system asks for microphone access when the app creates the device input (`AVCaptureInput.h:192`). Without the usage description the system terminates the app (https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media).
- `AVErrorRecordingSuccessfullyFinishedKey` tells if the file is playable after an error (`AVError.h:20`).
- A move of an open file fails (`PHAssetCreationRequest.h:26`).
- The "Things to know" points agree with `chapter-08` code: the continuation is set only in `stopRecording()`, each error is thrown, the timer is on the main run loop, `.movieCapture` is published before the output starts, the mode is stored before the change, `try?` in the model, and `setCaptureMode(_:)` does not apply the rotation angle.
- The three quiz questions of chapter 8 have one correct answer each.

## Claims that I could not check

- All behaviour on a real iPhone. The pages already say this.
- What Photos does with proxy data of the type `.photo` (findings 7 and 8).
- If deferred delivery and responsive capture are supported in the Simulator with SimCam (finding 11).
- What occurs when the person denies the microphone. The pages say "probably".
- If the mode change leaves the new movie connection with a wrong rotation angle. The page tells the reader to test it.
- "`recordedDuration` stays at zero until the output writes." The header does not say this. It is a sensible reading.
- "A SwiftUI `Button` starts its action when the finger goes up." This is known SwiftUI behaviour, but I found no Apple source for it.
- The picture size of the `.high` preset, and thus "the preview is taller and narrower" in video mode. On an iPhone the preview is probably taller with the same width.
- "A recording ends when a phone call interrupts the session." `AVErrorSessionWasInterrupted` exists, but no source names the phone call for a movie recording.
- "On most iPhone models, HEVC is already the default." Dossier 03 cites Apple's article for it. I did not read the article again.
- If the codec that `setOutputSettings` sets is lost with the old connection. The comment in the sample says that the connection is new. The header does not speak about the settings.
- The opinion in two link descriptions ("the best explanation").
