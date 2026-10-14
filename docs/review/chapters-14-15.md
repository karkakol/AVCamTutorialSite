# Technical review: chapters 14 and 15

Date: 14 Oct 2026. Reviewer: an independent agent that did not write the pages.

Pages: `ch14-concepts.md`, `ch14-build.md`, `ch15-concepts.md`, `ch15-build.md`.

Result: approximately 150 claims checked. 2 findings are WRONG. 1 finding is UNSUPPORTED. 1 finding is INCOMPLETE. All 4 are corrected on the pages. All 69 links on the four pages return 200. `npm run validate` gives 0 errors and 0 warnings for 38 pages. `npm run build` succeeds.

## Evidence

- **SDK**: `iPhoneOS27.1.sdk` in Xcode 27.1 (27A9269). Paths below are relative to `System/Library/Frameworks/`.
- **App**: `/Users/karolkakol/tutorials/AVCamTutorialApp`, branches `chapter-13`, `chapter-14`, `chapter-15`, read with `git show` and `git diff`. The working tree was not touched.
- **Sample**: `/Users/karolkakol/tutorials/AVCamBuildingACameraApp`, read only.
- **Documentation**: the JSON endpoint of developer.apple.com for each link, the Human Interface Guidelines JSON for "Camera Control", and the text of the articles "Capturing and saving Live Photos" and "Supporting device rotation in your camera app".
- **Research**: `research/01-capture-pipeline.md`, `03-video-capture.md`, `04-system-integration.md`, `05-simcam.md`, `06-iphone-duo.md`, `07-multicam.md`.

This review treated [INFERENCE] and [UNVERIFIED] claims of the research as not proven.

## Findings

| # | Page | Claim | Verdict | Evidence | Change |
|---|---|---|---|---|---|
| 1 | ch15-concepts, ch15-build | Apple did not confirm the four defects. | WRONG | The article "Supporting device rotation in your camera app" says: an output that the app adds starts at a default rotation angle, not at the current angle, and "switching between photo and video capture is where this occurs in AVCam". That is defect 3. | The two introductions now say that Apple confirmed only the rotation defect, with a link to the article. The "What was verified" paragraph of defect 3 names the article as the source for the cause. |
| 2 | ch14-build | You add approximately 250 lines to eight files. | WRONG | `git diff --stat chapter-13 chapter-14`: 253 added lines in 10 files. 61 of them are the new file `ZoomControl.swift`, and 1 is the project file. The eight known files get 191 lines. | "You create one new file and change eight files that you know. Together, that is approximately 250 new lines." |
| 3 | ch14-concepts | Each change of the session input interrupts the preview. | UNSUPPORTED | No header, article, or research dossier says this. | "probably interrupts". |
| 4 | ch14-concepts | `nominalFocalLengthIn35mmFilm` gives the focal length of a camera, for labels such as "24 mm". | INCOMPLETE | `AVCaptureDevice.h:2974`: "This property value is `0` for virtual devices and external cameras." The chapter selects virtual devices. | The table row now says that the value is 0 for a virtual device, and that an app reads it from the constituent devices. |

## Important claims verified as correct

**Zoom facts (chapter 14)**

- `videoZoomFactor`: a centered crop for all outputs, 1.0 is the full field of view, the maximum is `videoMaxZoomFactor` of the active format, an assignment cancels a ramp and snaps to the value, an `NSRangeException` for a value outside of the range, an `NSGenericException` without `lockForConfiguration()`, and key-value observation (`AVCaptureDevice.h:2069-2080`).
- The clamping rules: a value of 1.0 or more but less than `minAvailableVideoZoomFactor` is clamped to the minimum; a value of `videoMaxZoomFactor` or less but more than `maxAvailableVideoZoomFactor` is clamped to the maximum. A value less than 1.0, or more than `videoMaxZoomFactor`, raises an `NSRangeException`. The minimum is 1.0 and the maximum is `videoMaxZoomFactor` on a device with one lens; a virtual device can have a smaller range with depth data delivery. The two properties are observable (`AVCaptureDevice.h:2383-2404`).
- The ramp: the factor is scaled by `pow(2, rate * time)`, a rate of 1 doubles the factor each second, an internal acceleration limit smooths changes, an assignment during a ramp cancels it, `cancelVideoZoomRamp()` is a ramp with rate 0, `isRampingVideoZoom` is observable (`AVCaptureDevice.h:2083-2120`). The calculation on the page: 1x to 3x is log2(3) = 1.58 doublings, approximately 0.2 seconds at rate 8.
- `virtualDeviceSwitchOverVideoZoomFactors`: one value less than the count of `constituentDevices`, in the same order, empty for a device with one lens; at these values the field of view of one camera matches the full field of view of the next camera (`AVCaptureDevice.h:857-864`).
- The device can stay on a wider camera because of focus or exposure. The header gives the example of a telephoto camera with a minimum focus distance of 40 cm (`AVCaptureDevice.h:794-796`).
- `displayVideoZoomFactorMultiplier`: iOS 18, the example 1.0 times 0.5 is 0.5, observable (`AVCaptureDevice.h:2133-2140`).
- `videoZoomFactorUpscaleThreshold`: at this value the crop has no scaling, above it the picture is scaled up (`AVCaptureDevice.h:3455-3462`). `secondaryNativeResolutionZoomFactors`: iOS 16, a non-upsampled picture at a fixed factor above 1.0 (`:3717-3724`). `systemRecommendedVideoZoomRange`: iOS 18, used for the range of `AVCaptureSystemZoomSlider` (`:3465-3474`). `activePrimaryConstituentDevice` (Swift: `activePrimaryConstituent`): observable, `nil` until the session runs (`:935-942`). The documentation page for `activeprimaryconstituent` exists.
- Depth data delivery and Center Stage restrict the range (`AVCaptureDevice.h:2389, 2517`).
- The triple camera, the dual wide camera, and the dual camera do not support locking focus with a custom lens position (`AVCaptureDevice.h:589-640`). The lens slider of chapter 12 is created only when `isLockingFocusWithCustomLensPositionSupported` is `true` (`CaptureService.swift:251`).
- A discovery session sorts its devices in the order of the type list (`AVCaptureDevice.h:3051`).
- The HIG for the Camera Control: "Avoid duplicating controls, like sliders and toggles, in your UI and the overlay when the system displays the overlay."
- The SimCam values: `maxAvailableVideoZoomFactor` 0, `minAvailableVideoZoomFactor` 0, multiplier 0, and an exception for each assignment (`research/06-iphone-duo.md:50`). `05-simcam.md` and `07-multicam.md` say nothing about zoom, so nothing on the pages contradicts them.
- The code: all fences on `ch14-build` match the `chapter-14` files. The pinch gesture, the observation with `.initial` and `.new`, the `guard` for a maximum below 1, the clamping, the 10x limit, the `hidden(until:)` modifier (an opacity change, so the view stays in the layout), the preview initializer `init(captureMode:status:)`, and the membership exception for `ZoomControl.swift` in the `AVCamCaptureExtension` target (`project.pbxproj`, exception set for the `AVCam` folder).
- "Tap the button that changes the camera two times": `selectNextVideoDevice()` uses index 0 when the current device is not in the list, so the next device is the front camera, and the second tap selects the first back camera (`CaptureService.swift:389-402`, `DeviceLookup.swift:58-66`).

**Fixes of the sample (chapter 15)**

- The finish callback: called when `startRecording` or `stopRecording` was called or because of an error, always one time for each recording request, also with no data, and not on a specific thread (`AVCaptureFileOutput.h:313-334`). The start callback may not come when an error prevents all writing (`:222-227`).
- `AVErrorRecordingSuccessfullyFinishedKey`: "an NSNumber carrying a BOOL indicating whether the recording is playable" (`AVError.h:20`). The error codes `diskFull`, `maximumDurationReached`, `maximumFileSizeReached`, and `sessionWasInterrupted` exist (`AVError.h:40-51`).
- `maxRecordedDuration` (default `kCMTimeInvalid`, no limit), `maxRecordedFileSize` (default 0), `minFreeDiskSpaceLimit`: a hard limit that stops the recording and calls the delegate with an error (`AVCaptureFileOutput.h:167-195`). `pauseRecording()` and `resumeRecording()`: iOS 18, a format or device change stops a paused recording (`:121-145`). `movieFragmentInterval`: default ten seconds, a file stays playable after an interruption (`:416-427`). `recordedDuration` and `recordedFileSize` (`:148-165`).
- One recording at a time on iOS: `AVErrorRecordingAlreadyInProgress`, "on iOS, AVCaptureMovieFileOutput only supports one recording at a time" (`AVError.h:97`), and the documentation of `startRecording(to:recordingDelegate:)`.
- The live photo rule: the article says to keep the number of captures in flight and "hide your indicator only when that number reaches zero". The counter table on the page follows `monitorProgress(of:isolation:)` on `chapter-14` (`PhotoCapture.swift:85-110`).
- Connections: the session forms them when the app calls `addOutput(_:)` (`AVCaptureSession.h:308, 321`). The sample's own comment in `MovieCapture.updateConfiguration(for:)` says "Adding the output creates a new connection". `videoRotationAngleForHorizonLevelCapture` is observable and the coordinator always has the current value (`AVCaptureDevice.h:3132-3139`). The capture service applies the angle at the creation of the coordinator and at each change (`CaptureService.swift:463-503`), and `setCaptureMode(_:)` is the only place after setup that adds an output (`:154, 159, 370`).
- `play(_:)` has no effect when `shouldPlaySound` is `false` or when the event is older than 15 seconds; `shouldPlaySound` is `true` only for a stem click with the default sound disabled; not available in the European Union (`AVKit/AVCaptureEvent.h:55-78`).
- `makeStream(of:bufferingPolicy:)` has the default policy `.unbounded`, so the stream keeps each value.
- The code: `git diff --stat chapter-14 chapter-15` gives 86 added and 13 removed lines in five files, no new file. All fences on `ch15-build` match the `chapter-15` files. Only `stopRecording()` sets the continuation. `stopMonitoringDuration()` cancels the timer and sets `captureActivity` to `.idle`. `PhotoCaptureError` exists, and `PhotoCapture` makes its stream with `makeStream(of:)`. `toggleRecording()` calls `stopRecording()` and then saves the movie.
- The Simulator statements agree with `research/05-simcam.md`: Live Photo is not seen, the rotation coordinator is not reliable, and the Camera Control, hardware button events, and AirPods are not available.
- All 69 links on the four pages return 200. The links to pages in the tutorial point at existing pages (`ch16-concepts.md` and `ch16-build.md` exist), and the three SVG images exist.

## Claims that this review could not check

1. Nothing ran on an iPhone or in the Simulator. The reported SimCam test of the 3-second limit (ch15-concepts, ch15-build) is a report of the author, and this review did not repeat it.
2. The claim that the simulated back camera is one camera with one lens (ch14-build). `05-simcam.md` does not give the device type.
3. The Xcode interface steps: the File inspector and the canvas preview of `ZoomControl.swift`. The page says that nobody opened the canvas.
4. The behavior of the Camera app ("0.5x" for the ultra-wide picture) and the expectation of people ("1x" at the start). The multiplier example in the SDK supports the numbers, not the behavior of the Camera app.
5. The key-value observation during a ramp: how frequently the value changes. The page marks this as not verified.
6. The order of the pinch tasks (ch14-concepts). The page describes the limit correctly as a possibility.
7. The thread of the delegate callback and the strict concurrency statement (ch15-concepts). The header says only "not on a specific thread".
8. The remaining defects in "What this chapter does not fix" (ch15-concepts). They are marked as from a read of the code, and this review did not read the code for them.

## Notes for the author

- `setCaptureMode(_:)` calls `configureZoom(for:)` inside `beginConfiguration()` and `commitConfiguration()`, because the `defer` statement commits at the end of the method. The new session preset applies at the commit. So the zoom levels and the range can still come from the old format at that moment. The page says only why the levels are created again, so the text is not wrong. A change in the code, or a sentence about this, is possible.
- The finish callback also comes when the app calls `startRecording(to:recordingDelegate:)` again (`AVCaptureFileOutput.h:328`). The page names only `stopRecording()` and an error. AVCam never starts a second recording, so this is not a defect of the page.
- `updateCaptureRotation(_:)` calls `setVideoRotationAngle(_:)` of each output service, and that method sets the angle on the video connection (`DataTypes.swift:173-176`). The page's description is correct in effect.
