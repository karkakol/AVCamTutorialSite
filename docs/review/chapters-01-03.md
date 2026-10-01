# Fact review: welcome page and chapters 1 to 3

Date: 2026-10-01. Pages: `welcome.md`, `ch01-concepts.md`, `ch01-build.md`, `ch02-concepts.md`, `ch02-build.md`, `ch03-concepts.md`, `ch03-build.md`.

Evidence used:

- SDK headers in `iPhoneOS27.1.sdk` (`AVFoundation.framework/Headers`, `UIKit`, and the `Dispatch` and `_Concurrency` `.swiftinterface` files). "H" below.
- The app repository `AVCamTutorialApp`, branches `chapter-01` to `chapter-13`, and the Apple sample in `AVCamBuildingACameraApp`. "Code" below.
- The research dossiers and the hand-off notes (`research/`, `notes/chapter-01.md` to `chapter-03.md`, `chapter-06.md`, `chapter-07.md`, `chapter-09.md`).
- Apple documentation JSON and WWDC transcripts (fetched on the review date).
- Small compiler experiments in the scratch folder `review-a` (type check of copies of `chapter-01` and `chapter-03` for the iOS simulator SDK, Swift 5 mode; one run of a checked continuation on the Mac). "Exp" below.

About 300 claims were checked. Result: 22 findings, 11 WRONG and 11 UNSUPPORTED. All seven pages pass `npm run validate` with 0 errors after the edits.

## Findings

| # | Page | Claim | Verdict | Evidence | Change |
|---|---|---|---|---|---|
| 1 | `welcome.md:9` | At the end, the code "is the same as AVCam". | WRONG | `diff -r` of `chapter-13` and the Apple sample: `CaptureService.swift`, `CameraModel.swift`, `Views/CameraPreview.swift`, and the Control Center extension are different (47 lines). `notes/chapter-01.md` section 6 lists approved deviations (queue label, no Simulator placeholder). | "almost the same as AVCam". |
| 2 | `welcome.md:36` | Only chapters 6, 9, 11, 12, 13 have features that need a real iPhone. | WRONG | The table on the same page lists chapters 1, 3, and 7 too. `notes/chapter-07.md:7` (Live Photo), `research/05-simcam.md:21` (photo orientation), `notes/chapter-01.md:130` (alert). | The note now lists chapters 1, 3, 6, 7, 9, 11, 12, 13. |
| 3 | `welcome.md:57-65` | The table of features that need a real iPhone has no entry for chapter 6. | WRONG (not complete, and in conflict with the note) | `notes/chapter-06.md:6`: the focus and exposure effect cannot be seen with SimCam. | Added one row: "The visible effect of focus and exposure, chapter 6". |
| 4 | `ch01-concepts.md:84` | "A session is also not made for calls from many threads at the same time." | UNSUPPORTED | Not in `AVCaptureSession.h`. The Apple page for `AVCaptureSession` only says to start the session on a serial queue so that the main queue is not blocked. The dossier gives no source. | Now: it is safer not to call a session from many threads, and the documentation does not say that such calls are safe. |
| 5 | `ch01-concepts.md:238` | "Two fast calls of `start()` can both pass the `isRunning` test." | WRONG | Code `chapter-01:AVCam/CaptureService.swift`, `start()`: `guard await isAuthorized, !captureSession.isRunning`. Swift evaluates the conditions in order. The `isRunning` test runs after the `await`, and no suspension point follows before `startRunning()` returns. The dossier statement is analysis, not a test. | The bullet now says that this order is safe, and keeps the general rule. |
| 6 | `ch01-build.md:149` | Without `@preconcurrency`, "you get warnings when a capture object goes from one actor to a different actor". | WRONG (not exact) | Exp: `chapter-01` and `chapter-03` without `@preconcurrency` give one warning only: "stored property 'session' of 'Sendable'-conforming struct 'DefaultPreviewSource' has non-Sendable type 'AVCaptureSession'" (`CameraPreview.swift:83`). No warning at an actor boundary. | Now: you get a warning later in this file, because a `Sendable` structure stores an `AVCaptureSession`. |
| 7 | `ch01-build.md:256` | "UIKit makes the `init(coder:)` initializer necessary for each `UIView` subclass." | WRONG | Exp: a `UIView` subclass with no own initializer compiles without `init(coder:)`. A subclass with its own `init()` gives "'required' initializer 'init(coder:)' must be provided by subclass of 'UIView'". | Now: necessary for a `UIView` subclass that has its own initializer. |
| 8 | `ch01-build.md:377` | "a session is not made for calls from many threads at the same time" | UNSUPPORTED | Same as finding 4. | Now: "it is safer not to call a session from many threads at the same time". |
| 9 | `ch01-build.md:714` | "Later chapters put code in the initializer." (`CameraModel.init`) | WRONG | Code: `chapter-13:AVCam/CameraModel.swift:62-64` and the Apple sample `AVCam/CameraModel.swift:62-64` both have `init() { // }`. | Now: "The initializer stays empty in all chapters, as in the sample." |
| 10 | `ch01-build.md:988` | When the `task` starts, SwiftUI has "connected" the preview view to the session. | UNSUPPORTED | Code: `setSession(_:)` sets `previewLayer.session` in `Task { @MainActor in }`, not synchronously. `research/01-capture-pipeline.md:465` calls this an order dependency that "works today". The run in `notes/chapter-02.md` shows that it works, but it is timing. | Now: the view gives the session to its layer in a task on the main actor, which normally runs before the session setup. |
| 11 | `ch02-concepts.md:141` | "Each iPhone and iPad has one [wide-angle camera] on the back and one on the front." | UNSUPPORTED | H `AVCaptureDevice.h:558-561` says only "suitable for general purpose use". No source says "each". | "An iPhone or iPad usually has one on the back and one on the front." |
| 12 | `ch02-concepts.md:220` | `UIDevice.orientation` does not work "in a window that is not full screen on iPad". | UNSUPPORTED | Flat: H `UIOrientation.h:19` (`FaceUp` has no rotation). External camera: WWDC23 10106 transcript. No source found for the window case; the dossier line has no tag. | Removed the window case. |
| 13 | `ch02-build.md:305` | "If the current camera is not in the list, the search for the next camera starts at index 0." | WRONG (misleading) | Code `chapter-02:CaptureService.swift`, `selectNextVideoDevice()`: `firstIndex(of:) ?? 0`, then `nextIndex = selectedIndex + 1`. The next camera is index 1, not index 0. | Now: "the code uses index 0 as the index of the current camera". |
| 14 | `ch03-concepts.md:53` | The delegate queue "is not the main queue". | WRONG (too strong) | H `AVCapturePhotoOutput.h:981`: "a common dispatch queue — not necessarily the main queue". | "This is not necessarily the main queue". |
| 15 | `ch03-concepts.md:161` | "The callbacks are not on the main queue." | WRONG (too strong) | Same as finding 14. | "not necessarily on the main queue". |
| 16 | `ch03-concepts.md:73` | If you remove the progress stream, the delegate goes away and no callback arrives. | UNSUPPORTED | H: `AVCapturePhotoOutput.h` does not say how the output holds the delegate. The dossier marks this [A]. The only source is a comment in an old Apple sample (`git show eadd5ab:Swift/AVCam/CameraViewController.swift:705`: "The photo output holds a weak reference to the photo capture delegate"). The Apple article "Tracking photo capture progress" keeps strong references in a set, but does not state the rule. | The paragraph now names the old sample as the source and says that the header does not state it and that the tutorial did not test it. |
| 17 | `ch03-concepts.md:160` | "The photo output does not do it for you. Without a strong reference, the callbacks do not arrive." | UNSUPPORTED | Same as finding 16. | Both sentences now say "probably". |
| 18 | `ch03-concepts.md:120` | RAW and Apple ProRAW are "sensor data with little or no processing". | WRONG for ProRAW | H `AVCapturePhotoOutput.h:198`: ProRAW photos "will be demosaiced and partially processed", for example with fusion of multiple captures. | Now: "Sensor data that is not fully processed, as a DNG file. Apple ProRAW is partially processed." |
| 19 | `ch03-concepts.md:157` | A size above the limit of the output "raises an exception". | UNSUPPORTED | H `AVCapturePhotoOutput.h:1454` says only that the value must be equal to or smaller than the output value. The list of rules that throw (`:75-116`) does not contain `maxPhotoDimensions`. The codec rule is in the list (`:96`). | The exception is now stated for the codec only. The size is "also not permitted". |
| 20 | `ch03-build.md:19` | "The capture code runs on the capture service actor." | UNSUPPORTED | `research/02-photo-capture.md` section 2 [E]: in a model with the same compiler settings, the non-isolated `async` method of the plain class does not run on the session queue. | Now: "The capture service actor owns the capture code." |
| 21 | `ch03-build.md:558` | "With the default value `#isolation`, the method gets the actor of its caller". | UNSUPPORTED (the experiment says the opposite) | Same [E]: `#isolation` was `nil` at that place. `ch03-concepts.md:140` already says this. | Now: the default value "has the purpose to give the method the actor of its caller". |
| 22 | `ch03-build.md:1376` | "On a real iPhone, the photo is a HEIF file at the largest size that the camera supports". | UNSUPPORTED | Not run on an iPhone (`notes/chapter-03.md:8` repeats the code intent). H `:544`: the result "may be smaller" than the limit. | Now: the app asks for this, and the tutorial did not verify the result on a real iPhone. |

Counts: WRONG 11 rows (1, 2, 3, 5, 6, 7, 9, 13, 14, 15, 18). UNSUPPORTED 11 rows (4, 8, 10, 11, 12, 16, 17, 19, 20, 21, 22). Rows 4 and 8, 14 and 15, and 16 and 17 are the same fact on two lines.

No quiz needed a change. In each of the nine questions, the marked answer is the only correct one.

## Important claims verified as correct

Authorization and session (chapter 1):

- A missing usage description ends the app. Apple article "Requesting authorization to capture and save media": "Otherwise, the system terminates your app."
- Four status values and their meaning, also "restricted: the person cannot change this". H `AVCaptureDevice.h:2146-2158`.
- The alert appears one time; later calls use the stored answer; black frames before access. H `AVCaptureDevice.h:2198`.
- `startRunning()` blocks until the session runs or fails; a failure comes as a runtime error notification. H `AVCaptureSession.h:586`.
- `addInput(_:)` and `addOutput(_:)` raise `NSInvalidArgumentException` without a successful `canAdd…` test. H `AVCaptureSession.h:202`, `:259`.
- The default preset is `.high`, and it is for video. H `AVCaptureSessionPreset.h:36-39`.
- `activeFormat` changes the preset to input priority, and the session does not change the format then. H `AVCaptureDevice.h:369`, `AVCaptureSession.h:576`.
- Begin/commit applies changes together. H `AVCaptureSession.h:466`.
- The session forms connections automatically; a preview layer connects to one video port. H `AVCaptureSession.h:887`, `AVCaptureVideoPreviewLayer.h:113`.
- Default `videoGravity` is `.resizeAspect`. H `AVCaptureVideoPreviewLayer.h:123`.
- `unownedExecutor` is a requirement of `Actor`; a serial dispatch queue is a `SerialExecutor` from iOS 17. `_Concurrency.swiftinterface:12-13`, `Dispatch.swiftinterface:186-189`.
- Xcode 27.1 template defaults, the six setting changes, the warning with `MainActor` isolation, the "missing import of defining module 'os'" error. `notes/chapter-01.md` sections 2 and 3 (measured), and `project.pbxproj` on `chapter-03`.
- The empty `do` block gives a warning. Exp: "'catch' block is unreachable because no errors are thrown in 'do' block".
- SimCam gives access without the system alert; the picture is rotated by 90 degrees and fills the preview; without SimCam the orange message appears. `notes/chapter-01.md:127-131`.
- The Apple sample has a Simulator placeholder image and an old comment in `AVCamApp.swift`. Apple sample `Views/CameraPreview.swift:38-47`, `AVCamApp.swift:15`.
- Later chapters give the session queue to AVFoundation. `chapter-13:CaptureService.swift:224`, `:243`.

Cameras (chapter 2):

- Device type table (dual, dual wide, triple, TrueDepth, LiDAR, external is UVC on iPad), the limits of the multi-camera virtual devices, and the two new 27.1 types. H `AVCaptureDevice.h:536-668`.
- Discovery session: the type list is mandatory, the result has the order of the list, `devices` is key-value observable. H `AVCaptureDevice.h:3041`, `:3051`.
- `userPreferredCamera` keeps a short history across launches and restarts; `systemPreferredCamera` is `nil` only when no camera is available, and apps must observe it. H `AVCaptureDevice.h:743`, `:753-757`.
- An external camera has the position "unspecified". WWDC23 10106 transcript: "External cameras report that their position is unspecified."
- A normal session is for one camera; the multi-camera session is the class for "multiple inputs of the same media type". H `AVCaptureSession.h:800`, `:818`.
- `AVCaptureDeviceInput(device:)` fails when the device is not available. H `AVCaptureInput.h:203`.
- Rotation coordinator: two angles, any `CALayer`, 0 degrees for external cameras, updates on the main queue; only 0, 90, 180, 270; the cost of rotation for each output; `videoOrientation` deprecated in iOS 17; the new iOS 27 method. H `AVCaptureDevice.h:3076-3149`, `AVCaptureSession.h:1075`, `:1085`, `:1111`.
- A coordinator belongs to one device; Apple's article uses an observer on the main actor that keeps the order. Apple article "Supporting device rotation in your camera app".
- A Swift key path cannot observe the class property. Exp: `observe(\.systemPreferredCamera)` on the class does not compile.
- All statements about what the app code does in `DeviceLookup`, `SPCObserver`, `changeCaptureDevice(to:)`, and `PreviewContainer`. Code on `chapter-02` and `chapter-03`.

Photo capture (chapter 3):

- Settings are single use; a second use raises an exception; the resolved settings have the same `uniqueID`. H `AVCapturePhotoOutput.h:66`, `:38`.
- First and last callback are fixed, the others have no order; on an error all expected callbacks arrive; one common queue. H `AVCapturePhotoOutput.h:981-987`, `:1172`.
- `willCapturePhotoFor` arrives right after the shutter sound. H `AVCapturePhotoOutput.h:1019`.
- Default settings are JPEG; the codec list is empty without a session and a camera; an unknown codec raises an exception. H `AVCapturePhotoOutput.h:1207`, `:168`, `:96`.
- `maxPhotoDimensions` on the settings defaults to the smallest size; the result is never larger than the limit. H `AVCapturePhotoOutput.h:1454`, `:544`.
- The header does not promise an order for `supportedMaxPhotoDimensions`. H `AVCaptureDevice.h:3707-3714`.
- A photo output writes the orientation as Exif data and does not turn the pixels. H `AVCaptureSession.h:1085`.
- About 48 MB for a 12-megapixel BGRA `CGImage`. H `AVCapturePhotoOutput.h:2209`.
- Only the `.photo` preset supports 24 and 48 megapixels. WWDC26 304 transcript.
- A double resume of a checked continuation stops the process; a missing resume is logged. Exp (fatal error "tried to resume its continuation more than once") and the `CheckedContinuation` documentation.
- `@Observable` does not work on an actor. Exp: "'@Observable' cannot be applied to actor type".
- `assign(to:)` manages the subscription. Combine documentation for `assign(to:)`.
- One delegate object for each capture is the pattern in Apple's article "Capturing still and Live Photos".
- SimCam gives a 640 x 480 JPEG of about 50,000 bytes with no orientation data. `research/05-simcam.md:20`, `notes/chapter-03.md:7-8`.
- Cross-chapter statements (chapter 4 replaces the log line and the placeholder, chapter 7 adds the Live Photo value and the capabilities, chapter 8 adds the movie case, the merge, `defaultMic`, and the movie button, chapter 9 sets `activeFormat`, chapter 10 adds the yellow status). Code on the chapter branches.

## Claims that I could not check either way

- "The shared thread pool has about one thread for each processor core" (`ch01-concepts.md:128`). This is the usual description from Swift talks. It is not in the SDK, and I did not fetch a source.
- The denied state through the Settings app on a real iPhone (`ch01-build.md:1040-1042`). The code path was tested in the Simulator with `simctl privacy` only.
- `research/05-simcam.md:17` says "Camera permission prompt ... Works", but `notes/chapter-01.md:130` says that SimCam skips the permission system. The pages follow the notes, which are more detailed. Someone must run it one time to remove the conflict.
- `.continuityCamera` as "an iPhone that operates as the camera of a Mac or an Apple TV" (`ch02-concepts.md:150`). The header and the documentation say only "a continuity camera device".
- "On an iPhone with a telephoto camera, the first result is the dual camera" (`ch02-concepts.md:72`), and all other statements about real iPhone models. No device test.
- The short gap in the frames during a camera switch (`ch02-concepts.md:104`). Not measured.
- The system-preferred camera path with an external camera on an iPad, the behaviour of `userPreferredCamera` between launches, and all rotation behaviour on a device. The pages already say that these were not verified.
- "The zoom factor 1.0 is the field of view of the ultra-wide camera" (`ch02-concepts.md:166`). It follows from H `AVCaptureDevice.h:862` and `:2138`, but no header sentence says it directly.
- The rules "48 megapixels needs balanced or quality" and "24 megapixels needs quality" (`ch03-concepts.md:127`). The header confirms only that 24 megapixels needs deferred delivery (`AVCapturePhotoOutput.h:114`). The other rules come from the dossier's reading of WWDC26 304; my search of the transcript did not find the exact sentences.
- The `#isolation` result in the real app on an iPhone (`ch03-concepts.md:140`). The page already says "probably".
- The screen flash on a device, the photo orientation, HEIF output, and the large photo sizes. They need a real iPhone.
