# Technical review: chapters 9 and 10

Date: 1 Oct 2026. Pages: `ch09-concepts.md`, `ch09-build.md`, `ch10-concepts.md`, `ch10-build.md`.

Evidence used:

- SDK headers: `iPhoneOS27.1.sdk/System/Library/Frameworks/AVFoundation.framework/Headers/` (short names below, for example `AVCaptureSession.h:659`) and `CoreVideo.framework/Headers/CVPixelBuffer.h`.
- App code: `AVCamTutorialApp`, branches `chapter-08`, `chapter-09`, `chapter-10`. Apple sample: `AVCamBuildingACameraApp`.
- Apple documentation JSON (`https://developer.apple.com/tutorials/data/documentation/<path>.json`) and the transcripts on the WWDC session pages.
- Research dossiers and `notes/chapter-09.md`, `notes/chapter-10.md`.

Approximately 190 claims checked. 3 WRONG, 11 UNSUPPORTED. All four pages pass `npm run validate` with 0 errors after the edits.

## Findings

| # | Page | Claim | Verdict | Evidence | Change |
|---|---|---|---|---|---|
| 1 | ch10-build, line 13 | "You add approximately 110 lines to ten files" | WRONG | `git diff --shortstat chapter-09 chapter-10`: 9 files changed, 111 insertions | "ten files" is now "nine files". |
| 2 | ch10-build, line 111 | The service listens before it configures the session, so "it cannot miss a notification from the first moments of the session" | WRONG | `chapter-10:AVCam/CaptureService.swift`, `start()`: `setUpSession()` and `startRunning()` run with no suspension point between them. A `Task` that an actor method creates runs on the actor, so the three `for await` loops start only after `start()` returns. | The text now says that the tasks start after `start()` returns, and that it is possible that the service does not get an early notification. |
| 3 | ch10-concepts, line 199 | "The model sets the status one time, after `start()` returns." | WRONG | `chapter-10:AVCam/CameraModel.swift:194-196`: the interruption task that this tutorial adds also sets `status`. | The text now says: the model sets `running` after `start()` returns, and after that only the interruption task changes the status. |
| 4 | ch09-concepts, line 106 | Dolby Vision: "No capture API turns it on or off." | UNSUPPORTED (too general) | `AVCaptureVideoDataOutput.h:275-278`: `preservesDynamicHDRMetadata` (iOS 26) controls dynamic HDR metadata for the data output route. No such property exists on the movie file output (`AVCaptureFileOutput.h`). Per-frame metadata is verified (WWDC21-10047 transcript). | The sentence now applies to the movie file output only. |
| 5 | ch09-concepts, line 117 | Video HDR (EDR) gives "a normal 8-bit movie" | UNSUPPORTED | `AVCaptureDevice.h:3575` and WWDC21-10047 say that EDR recovers highlights and is not 10-bit HDR. No source states the bit depth. | Now: "A standard movie with better highlights. It is not a 10-bit HDR movie." |
| 6 | ch09-build, line 692 (quiz explanation) | EDR "merges two exposures into an 8-bit frame" | UNSUPPORTED | Same as finding 5. | Now: "into one frame". |
| 7 | ch09-concepts, line 215 | Slow motion: "120 or 240 frames in a second on many iPhone models"; the movie is a normal movie and "slow" is a playback decision | UNSUPPORTED | Dossier `03-video-capture.md:467-468` marks both as [I]. The need for `activeFormat` is verified (documentation `avfoundation/capture-device-formats`). | The rates are now an example ("if the camera has such a format"). The statement about the movie now says "not verified" and "probably". |
| 8 | ch09-concepts, line 227 | External storage: "record directly to a USB-C drive" | UNSUPPORTED | `AVExternalStorageDevice.h:14-27` and the documentation page say only "physical external storage device". | Now: "an external storage device". |
| 9 | ch09-concepts, line 246 | A high frame rate format "frequently does not support" HDR, some stabilization modes, or large photos | UNSUPPORTED | No header or document gives a frequency. | Now: "does not always support". |
| 10 | ch10-concepts, lines 60 and 156 | The reason why the sample handles two interruption reasons only; "the other reasons are less common on iPhone" | UNSUPPORTED | The sample comment says only "Set the `isInterrupted` state as appropriate" (`CaptureService.swift:459`). The reason is an inference of the dossier (`01-capture-pipeline.md:803`). | "The probable reason", "probably less common". |
| 11 | ch10-concepts, line 68; ch10-build, line 165 | After a media services reset, "your session, your inputs, and your outputs are still valid objects" | UNSUPPORTED | The sample comment says only that the session stops running (`CaptureService.swift`, runtime error task). The documentation of `AVAudioSession.mediaServicesWereResetNotification` tells apps to make audio objects again. No source says that capture objects stay valid. | The two pages now say that the session stops and that the sample keeps its objects and starts the session again. |
| 12 | ch10-concepts, line 119; ch10-build, line 652 | The cover does not appear "when the person opens Control Center" | UNSUPPORTED | Documentation `swiftui/scenephase/inactive` names the app switcher. It does not name Control Center. | The two pages now name the `inactive` phase and the app switcher only. |
| 13 | ch10-concepts, line 209 | No action after a runtime error: "the preview stays frozen" | UNSUPPORTED | No source describes the preview after a runtime error. | Now: "the session stays stopped". |
| 14 | ch10-build, line 201 | A second `setUpSession()` call: "the session refuses" the same inputs | UNSUPPORTED | Code path is correct (`addInput` throws, then `setupFailed`), but the result of `canAddInput` was not tested. | Now: "The session is expected to refuse them". |
| 15 | ch10-build, line 724 (quiz explanation) | "Each interruption stops the session for some time." | UNSUPPORTED | `AVCaptureSession.h:66`: the session stops "when appropriate". | Now: "The other reasons are real interruptions too. The camera is not available during them." The marked answer is not changed. |

## Important claims verified as correct

Chapter 9:

- `activeFormat` and presets are mutually exclusive on iOS; a set of `activeFormat` changes the preset to `.inputPriority`; a new preset gives control back to the session (`AVCaptureDevice.h:369`, `AVCaptureSessionPreset.h:159`).
- Exceptions for no lock and for a format of a different device (`AVCaptureDevice.h:363-365`).
- A format or device change stops a recording (`AVCaptureFileOutput.h:131`).
- Nested `beginConfiguration()`/`commitConfiguration()` pairs apply at the outer commit (`AVCaptureSession.h:466`).
- Pixel format codes and ranges: `420v`, `420f`, `x420` (luma 64-940), `x422`, `xf20` (`CVPixelBuffer.h:79-114`).
- Color spaces and versions: sRGB and P3 (10), HLG BT.2020 (14.1), Apple Log (17), Apple Log 2 (26, Apple Gamut); a log color space makes the photo output inactive (`AVCaptureDevice.h:2319-2330`).
- `automaticallyConfiguresCaptureDeviceForWideColor` is `true` by default and can change the color space also with `.inputPriority` (`AVCaptureSession.h:576`).
- EDR against 10-bit HDR: two times the frame rate, `isVideoHDRSupported` always `false` for HLG-only 10-bit formats, `isVideoHDREnabled` ignored with HLG, automatic by default, Dolby Vision metadata in movies (`AVCaptureDevice.h:2298`, `:2310`, `:3575`).
- "Since iPhone 12", groups of three formats, per-frame Dolby Vision, the AVCam 10-bit helper (WWDC21-10047 transcript).
- Frame durations: min duration = max rate, exceptions for unsupported values, the three reset conditions (`AVCaptureDevice.h:387-432`).
- How `activeFormat10BitVariant`, `isTenBitFormat`, and `maxFrameRate` work, and all "Things to know" points about the code (`chapter-09:AVCam/Support/CaptureExtensions.swift`, `CaptureService.swift`, `MovieCapture.swift`, `CameraModel.swift`).
- Capability tables, each "Since" value: auto frame rate 18 (30 to 24), locked frame duration 26, low light noise reduction 27 (automatic for movie file output), ProRes RAW 26 (stabilization as metadata), external storage 17, Pro Video Storage 27, Cinematic video 26 (device input, `simulatedAperture`), Cinematic metadata 27, spatial video 18 (format support and a cinematic stabilization mode), pause and resume 18, dynamic aspect ratio 26, timecode 26, multi-cam 13.
- No "Action mode" API in the iOS 27.1 AVFoundation headers (search of all headers).
- The HDR button does not appear in the Simulator with SimCam (`notes/chapter-09.md`, an experiment).

Chapter 10:

- All six interruption reasons, their causes, and their versions; the background reason and the role of `stopRunning()` (`AVCaptureSession.h:71-85`).
- Notifications and `userInfo` keys; `isRunning` and `isInterrupted` (`AVCaptureSession.h:20-116`, `:481-498`).
- Deferred start: the defaults for apps linked with the iOS 26 SDK (session automatic, photo and file outputs deferred if supported, all other outputs and the preview layer not); the exception for `true` with no support; automatic mode timing; `runDeferredStartWhenNeeded()` throws in automatic mode; a capture request runs the deferred start; responsive capture for more than one early request; a change needs a long reconfiguration (`AVCaptureOutputBase.h:117-131`, `AVCaptureSession.h:648-707`, `AVCaptureVideoPreviewLayer.h:262-278`).
- An app with a video data output preview must use manual mode to get the gain (WWDC26-303 transcript; Apple article "Building a responsive camera app that launches quickly").
- Four launch stages, outputs as the most expensive part, preview and shutter button first, "two times faster" (WWDC26-303 transcript).
- The stale frame, the cover with no animation on the way out, the fade on return, hidden controls, the visible capture button (Apple article above).
- The "Reset Media Services" test hint: the command is in the Developer menu of the Settings app (documentation `avfaudio/avaudiosession/mediaserviceswereresetnotification`). The page already says that the recovery was not tested.
- `startRunning()` and `stopRunning()` block (`AVCaptureSession.h:586`, `:596`); `hardwareCost` above 1.0 does not run (`:634`).
- Multitasking camera access: iPadOS 16, the iOS 18 rule change, not recommended for heavy capture (`AVCaptureSession.h:501-534`; article "Accessing the camera while multitasking on iPad").
- Older AVCam had a resume button (`AVCamBuildingACameraApp`, commit `a3303b9`, `AVCamCameraViewController.m:385`).
- The Apple sample never reads `isInterrupted` outside `CaptureService` (search of the sample).
- The tab characters on the `ThumbnailButton` line; `PreviewCameraModel` starts with `unknown`; the text color on yellow was already in `StatusOverlayView`; all references to earlier chapters.
- All 82 Apple documentation links and all 8 WWDC links resolve, and the titles match.

## Claims that could not be checked

- With the `.high` preset, the session selects an 8-bit format (the base of the "off" path and of quiz 1 in ch09-build). The sample depends on it. No header states it. Needs a real iPhone.
- The session selects HLG BT.2020 for the 10-bit format by itself. The page already says "not verified".
- HDR after a change of camera, and `activeFormat` before the commit in `setCaptureMode(_:)`. The page already says "not verified".
- "In low light, automatic exposure can make the rate lower." Only indirect header support (`AVCaptureDevice.h:430`, `:463`). Left as it is.
- "After a runtime error the session does not start again by itself", as a general rule. The sample comment supports it for the media services reset only. Left as it is.
- If the "Reset Media Services" command gives the `mediaServicesWereReset` runtime error to a capture session. The documentation describes the command for the audio session notification.
- If `NotificationCenter.notifications(named:)` loses notifications that arrive before the loop starts (finding 2 says "it is possible").
- All behavior on a real iPhone: interruptions, the yellow message, the cover, the launch time, HDR recording. The pages say this.
