# Chapter 17 and 18 build pages: learner review, round 2

Date: 15 Oct 2026
Pages: `content/pages/ch17-build.md` (46 steps in 6 sections: 39 code steps, 1 settings step, 6 checkpoints) and `content/pages/ch18-build.md` (44 steps in 6 sections: 37 code steps, 1 settings step, 6 checkpoints), rendered as `dist/ch17-build.html` and `dist/ch18-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholders, the comment lines and string literals of the solution as hints, delete boxes), the "What you see" pictures, and the Swift notes. The rendered cover of each code step was extracted from the HTML (35 covers with "Inside …" on chapter 17; 29 covers and 8 `copy` notes on chapter 18; both builds complete) and compared with `git diff chapter-16 chapter-17`, `git diff chapter-17 chapter-18` (also with `--unified=0` for the brace and duplicate checks), and `git show` of `CameraPreview.swift`, `DeviceLookup.swift`, `MovieCapture.swift`, `CaptureExtensions.swift`, `FoundationExtensions.swift`, and `PreviewCameraModel.swift` on the start branches. The three pictures `ch17-s6-6-a.jpg`, `ch17-s6-6-b.jpg`, and `ch18-s6-7.jpg` were viewed. The glossary cards were checked against `src/lib/swift-notes.mjs`.

Since round 1, the glossary has the three entries that round 1 asked for: `Tuple comparison` (card at 17.2.6), `&variable (in-out argument)` (card at 18.2.4), and `=== (identity)` (card at 18.3.4). This closes suggestion 1 of the chapter 17 review and suggestions 1 and 2 of the chapter 18 review. The generator now renders "Copy these lines as they are" on a partial `copy` fence (suggestion 5 of the chapter 18 review), but the whole-file form reads "Copy this file as they are; the caption says what they contain" (see suggestion 1 below).

## Verification of the round-1 findings: chapter 17

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 4.7 has three delete boxes: the two old state lines, the old comment, and `captureSession.startRunning()`. `try setUpSession()` is in no box; it is context line 9 of the main fence, and the caption says "Keep the `try setUpSession()` line". |
| 2 | fixed | 2.1 gives `import AVFoundation`, `final class MultiCamCapture`, `static var isSupported: Bool`, `let session = AVCaptureMultiCamSession()`, the two `AVCaptureDeviceInput?` variables, `private(set) var isConfigured = false`, `private let maxFormatWidth: Int32 = 1920`, and the reason for `Int32`. |
| 3 | fixed | 3.2 gives both imports with `@preconcurrency`, `struct DualCameraPreview: View`, `private let source`, `init(source:)`, the `@State` line, the body with `DualPreviewViews(source:smallPicture:)` and `onTapGesture`, and "does not compile until the end of step 3.6". |
| 4 | fixed | 3.4 gives `class DualPreviewContainer: UIView` nested before the closing brace of `DualPreviewViews`, `smallPictureScale = 0.3`, `inset = CGFloat(16)`, the `didSet` with `oldValue` and `UIView.animate(withDuration: 0.25)`, `layoutPreviews()`, and "Do not close the class yet". `highlight=5-22` stops before the class brace; 3.6 highlights it (`highlight=5-25`). |
| 5 | fixed | 3.1: "The closing brace of `PreviewTarget` is highlighted, because git counts it as a new line. Do not type a second one." |
| 6 | fixed | 2.2 gives the four-label signature with `throws`, the `guard !isConfigured`, the `defer`, the two `try addCamera` assignments, and the compile note (the duration of the note is new finding 2). |
| 7 | fixed | 2.3 gives the signature with `throws -> AVCaptureDeviceInput`, `AVCaptureDeviceInput(device:)`, `canAddInput(_:)`, `CameraError.addInputFailed`, and "does not compile until step 2.6". |
| 8 | fixed | 2.6 gives the signature, `formatDescription.dimensions.width`, `candidates`, `max(by:)` with the tuple `(width, maxFrameRate)`, "Swift compares tuples element by element", `CameraError.setupFailed`, and the lock calls. The page now also has the `Tuple comparison` card here. |
| 9 | fixed | 2.5 names `isVideoMirroringSupported`, `AVCaptureDevice.RotationCoordinator(device:previewLayer:)`, `videoRotationAngleForHorizonLevelPreview`, and `connection.videoRotationAngle`. |
| 10 | fixed | 3.3 gives the two constants, `makeUIView(context: Context) -> DualPreviewContainer`, `updateUIView(_ container: DualPreviewContainer, context: Context)`, `connect(back:front:)`, and "Close the structure with its brace now". |
| 11 | fixed | 3.5 gives `super.init(frame: .zero)`, `.black`, the `for` loop with `resizeAspectFill`, `cornerRadius` 12, `UIColor.white.cgColor`, `clipsToBounds`, `addSubview`, and `required init?(coder:)`. |
| 12 | fixed | 3.6 gives `small` and `full`, the width and height formulas with `max(bounds.width, 1)`, the `CGRect` with `safeAreaInsets.top + inset`, the four radius and border values, `bringSubviewToFront`, and "This step ends with the closing brace of the class". |
| 13 | fixed | 4.3 gives the signature, "not private, because the preview source calls it", the tuple assignment, `startDualCaptureIfNeeded()`, and the compile note. |
| 14 | fixed | 4.5 gives `let previousMode = self.captureMode` and "Xcode warns that the constant is never used until the next step reads it". 4.6 reads it. |
| 15 | fixed | 5.3 writes out `var isDualCaptureSupported: Bool { get }` and `var dualPreviewSource: DualPreviewSource { get }` and says "does not compile until step 5.5". |
| 16 | fixed | 5.1: "The file imports AVFoundation with `@preconcurrency`, so the compiler accepts the layers in the task", plus `captureService: CaptureService`, `init(captureService:)`, `@MainActor`, and the `await` call. `CameraPreview.swift` line 9 on `chapter-17` has the import. |
| 17 | fixed | 6.3 gives `private var modes: [CaptureMode]` as computed, the filter condition, 240 and 180. |
| 18 | fixed | 2.4 gives `.video`, `device.deviceType`, `device.position`, `.first` in a `guard let`, `canAddConnection(_:)`, `addConnection(_:)`, and the two errors. |
| 19 | fixed | 2.7: "computed properties of type `Float`". |
| 20 | fixed | 2.8 gives `isConfigured, !session.isRunning` and `session.isRunning`. |
| 21 | fixed | 4.1 gives `private`, constant against variable, and the tuple type with `back` and `front`. |
| 22 | fixed | 4.4 gives the three guard conditions, `deviceLookup.cameras`, `first(where:)` by `position`, `logger.error` two times, and `logger.info`. |
| 23 | fixed | 4.6 gives `restartsSession`, `multiCamCapture.stop()`, and `captureSession.startRunning()` in the `defer` block. |
| 24 | fixed | 5.5 gives `struct DualPreviewSourceStub: DualPreviewSource`, the empty method, and the two constants. |
| 25 | fixed | 6.2 names `simultaneousGesture(swipeGesture)` and the `if` on `camera.captureMode == .dual`. |

Counts: fixed 25, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 17, checked on the page: suggestion 1 (tuple comparison) is in the glossary; the second entry (tuple type with labels, 4.1) is not, and the caption covers it. Suggestions 2 (`compiles=no`), 3 (validator: a delete box line that is context), 4 (a highlighted brace that already exists), 5 (a context line that a later step adds; the cover of 3.4 still says the class brace is "already in your file"), 6 (argument labels on the cover), and 7 (`AUTHORING.md` on a partial `new` fence) stay open. The validator now has rule 6 for the two copier traps, which covers suggestion 3 and the chapter 18 suggestion 7.

## Verification of the round-1 findings: chapter 18

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | All eight fences of 2.1 to 2.8 have `copy`; the rendered page shows a copy note instead of a cover on each. The captions give the Metal members, the sampler attributes, the texture indexes, the pool keys, the C functions, and the encoder calls as the round-1 fix lists them. |
| 2 | fixed | 3.1 gives the class line with `NSObject` and the two protocols, the `@Published` line, the queue with its label, `smallPicture`, the three outputs with their types, `mixer`, `recorder`, `latestSmallPictureFrame`, `recordingStartTime`, `reportedDuration`, `init(backOutput:frontOutput:audioOutput:)`, and `isRecording`. The imports were still missing; see new finding 5. |
| 3 | fixed | 1.1 gives `final class MovieRecorder`, the three `private let` properties, `var outputURL: URL`, the throwing initializer, `AVAssetWriter(outputURL: .movieFileURL, fileType: .mov)`, `AVAssetWriterInput(mediaType:outputSettings:)`, `writer.add(_:)`, and `if let audioSettings` with `nil` in the `else`. |
| 4 | fixed | 2.4 "does not compile until then" (2.5), 2.6 "until two steps from now" (2.8), 3.4 "until then" (3.5), 4.2 "until step 4.6 adds `addMicrophone`", 4.8 "until then" (4.9), 6.1 "until the next step". All six durations agree with the code. |
| 5 | fixed | 5.3 has `highlight=2-10,16-19`; line 15 `func stopRecording() async throws -> Movie {` is context. The caption says that both signatures stay, that the `if` block ends with `return`, and that the old line gets `return` in front of it. |
| 6 | fixed | 3.2 gives `func startRecording() throws`, `guard recorder == nil`, `backOutput`, `.mov`, `MovieCaptureError.notRecording`, the `as? Double` cast, and the three closing assignments. |
| 7 | fixed | 3.4 explains `===`, gives the expression, and names `process(fullPictureFrame:)`. The page now also has the `=== (identity)` card here. |
| 8 | fixed | 3.5 gives the private signature, `imageBuffer`, `formatDescription`, the four constant names, and the three "never used" warnings until the next step. 3.6 gives the `CMSampleTimingInfo` variable, `(time - start).seconds`, the 0.25 threshold, and `.movieCapture(duration:)`. |
| 9 | fixed | 4.6 gives the signature, `ports(for:sourceDeviceType:sourceDevicePosition:)` with `.audio`, the device type, and `.back`, the `??` fallback with `first(where:)`, `CameraError.addInputFailed`, `audioPort`, and the warning until the next step. |
| 10 | fixed | 4.2 gives `microphone: AVCaptureDevice?` after `frontCamera:`, `hasMicrophone`, `DualRecorder(backOutput:frontOutput:audioOutput:)`, and the local `recorder`. 4.4 gives `canAddOutput(_:)` with `CameraError.addOutputFailed` and the dictionary with `as String`. |
| 11 | fixed | 5.1 gives both signatures, `session.isRunning`, and `try recorder.dataOutputQueue.sync { try recorder.startRecording() }`. 5.2 gives `func stopRecording() async throws -> Movie`, the error in two places, `sync(execute:)`, `movieRecorder`, and `Movie(url:)`. |
| 12 | fixed | 6.1 gives `@MainActor func setSmallPicture(_ position: AVCaptureDevice.Position)` and the `Task { await captureService.setDualSmallPicture(position) }` form. |
| 13 | fixed | 1.2, 1.3, and 1.4 give the three signatures, `.unknown` and `.writing`, the three-part guard, and `writer.error ?? MovieCaptureError.notRecording`. |
| 14 | fixed | 3.3 gives `func stopRecording() -> MovieRecorder?` and the two `defer` assignments; 4.1 the five declarations; 4.3 the two types; 4.5 `outputConnection`, `videoPort`, `canAddConnection(_:)`; 4.7 `connection`; 4.8 `microphone` and `isFirstConfiguration` "read before the call"; 4.9 `private func observeDualRecorder()` "with no `async`". |

Counts: fixed 14, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 18, checked on the page: suggestions 1 and 2 (glossary) are implemented; suggestion 5 (copy note wording) is implemented for partial fences; suggestion 7 (validator warning for a highlighted line that exists on the start branch) is rule 6 now. Suggestions 3 (a second "and inside …"; the covers of 2.5, 2.7, 4.4, 4.5, 5.3, and 6.1 still show only the class), 4 (string hints on a new-file cover), 6 (`compiles=no`), and 8 (`AUTHORING.md` on new-file captions) stay open.

## New findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 17.1.1 | copier and self-implementer | Step 1.1 adds the `dual` case, and seven `switch` statements in six files become non-exhaustive. The project does not compile from 1.1 until 1.8 adds the last case. The section intro said that "a `switch` over an enumeration must handle every case", but no step said that the build fails until 1.8. | medium | The caption of 1.1 says that the project does not compile from this step until step 1.8, and why. |
| 2 | 17.2.2 | copier and self-implementer | The caption said "You write it in the next three steps, so the project does not compile until then." The three steps 2.3 to 2.5 write `addCamera`, but 2.3 calls `selectMultiCamFormat(for:)`, which 2.6 adds. The project compiles again after 2.6, as the caption of 2.3 says. The two captions disagreed. | low | 2.2 says that the format selection comes in step 2.6 and that the project does not compile until step 2.6. |
| 3 | 17.4.4 | self-implementer | The log line of the costs reads `\(self.multiCamCapture.hardwareCost)`. The explicit `self` is required: the log interpolation of a number is an escaping autoclosure in an actor. A learner who writes `multiCamCapture.hardwareCost` without `self.` gets a compile error, and the caption did not say so. Every other log line on the page has no `self.`. | low | The caption says to write `self.multiCamCapture` in that line, and why. |
| 4 | 17.6.6 | copier and self-implementer | The caption says "The front picture is a mirror image. The back picture is not." In both pictures, the text of the SimCam test card of the front camera ("TOP", "FRONT", "BOTTOM") reads normally, so a learner who compares sees no mirror image and can think that the mirroring code of 2.5 has no effect. | low | The caption says that the two pictures do not show the mirroring, because the test card text reads normally in both. |
| 5 | 18.3.1, 18.1.1 | self-implementer | The new-file caption of `DualRecorder.swift` listed every declaration but not the imports. The file needs `import Combine` for `@Published`; `AVFoundation` does not export it. A learner who writes only `import AVFoundation` gets "Unknown attribute 'Published'". The caption of 1.1 named no import either (the chapter 17 new-file captions do). | medium | 3.1 says that the file starts with the license header, `import AVFoundation`, and `import Combine`, and why the second import is needed. 1.1 says the same for its one import. |
| 6 | 18.3.4 | self-implementer | The caption named the delegate method by its link, `captureOutput(_:didOutput:from:)`, but not the three parameter types (`AVCaptureOutput`, `CMSampleBuffer`, `AVCaptureConnection`). The cover shows the `MARK` line and one comment, not the signature. | low | The caption gives the full signature and says that Xcode completes it. |

## Checks with no finding

- Copier, chapter 17: the delete boxes of 4.2, 4.6, 4.7 (three boxes), 5.3, 6.1, 6.3 (three boxes), and 6.5 cover the 13 removed lines of `git diff chapter-16 chapter-17`. No line is highlighted in two steps; the split regions 2.3/2.4/2.5 (`addCamera` in three parts, `return input` and the brace typed in 2.3), 3.3/3.4/3.5/3.6 (the structure brace typed in 3.3, the class brace typed in 3.6), and 4.5/4.6 are consistent. The only highlighted line that exists on `chapter-16` is the brace of 3.1 (round-1 finding 5, caption). The one `remove` line that could look like context (`try setUpSession()`) is in no box.
- Copier, chapter 18: the delete boxes of 4.2 (two), 4.3, 4.8, 5.3, 6.3, 6.4 (two), 6.5 (two), and 6.6 cover the 17 removed lines of `git diff chapter-17 chapter-18`. No line is highlighted in two steps; the split regions 2.4/2.5, 2.6/2.7, 3.5/3.6, 4.4/4.5, 4.6/4.7 (the method brace typed in 4.6, context in 4.7), and 5.1/5.2 are consistent. 6.2 highlights line 2 (`import AVFoundation` between `Foundation` and `SwiftUI`, as the diff places it) and line 31.
- Build gaps and warnings, both chapters: 17.1.1 to 17.1.8 (finding 1), 17.2.2 to 17.2.5 (finding 2), 17.3.2 to 17.3.5, 17.4.3, 17.5.3 to 17.5.4; warning after 17.4.5. 18.2.4, 18.2.6 to 18.2.7, 18.3.4, 18.4.2 to 18.4.5, 18.4.8, 18.6.1; warnings after 18.3.5 and 18.4.6. Every other step compiles: unused private stored properties (17.4.1, 18.4.1) and unused method parameters (18.4.3) give no warning. All checkpoints come after the last step of a section and build.
- Names on the start branches: `PreviewView` on `chapter-16` is a nested class with `init()` and a `var previewLayer: AVCaptureVideoPreviewLayer` (17.3.1 and 17.3.4 are correct). `maxFrameRate`, `URL.movieFileURL`, `MovieCaptureError.notRecording`, `DeviceLookup.cameras`, and `DeviceLookup.defaultMic` exist on `chapter-17`.
- Covers: "Inside …" is correct on every cover that has it. The hint lines show the comments, and the string literals appear on the covers of existing files (17.1.1, 17.3.5, 17.4.4, 18.5.3). The placeholders are split correctly around the comment lines.
- Pictures: `ch17-s6-6-a.jpg` shows the mountain scene full screen, the test card small at the top left with a white border and round corners, three symbols in the mode picker with the third selected, no zoom control, and the switch camera button visible. `ch17-s6-6-b.jpg` shows the exchange. `ch18-s6-7.jpg` shows "00:00:08" at the top, the red square, the dimmed mode picker, and the small picture at the top left. The captions match, apart from finding 4.
- Swift notes: chapter 17 has one card (`Tuple comparison` at 2.6) and two pointers; chapter 18 has two cards (`&variable` at 2.4, `===` at 3.4) and no pointer. `defer`, `guard`, `didSet`, `private(set)`, `@Published`, `@State`, `try?`, `??`, `$0`, `Task`, `@MainActor`, `Sendable`, and the condition lists are `common`.
- The dispatch queue rules, the API names and links, and the quiz answers are as round 1 found them. The intro numbers hold: 408 insertions in 16 files for chapter 17 (two new files of 134 and 108 lines, 13 existing Swift files, the project file), 559 insertions in 13 files for chapter 18 (four new files, eight existing Swift files, the project file).

## Suggestions for the generator, the validator, and the coordinator (not fixable on the pages)

1. **Generator: the copy note of a whole file.** The note on a `new copy` fence reads "Copy this file as they are; the caption says what they contain" (18.2.1 and 18.2.3). The partial form "Copy these lines as they are" is correct. The whole-file form needs "as it is" and "what it contains".
2. **Generator: `compiles=no` and a warning note.** The two chapters have eleven build gaps and three warning gaps in prose; findings 1 and 2 of this round are a missing and a wrong duration in such sentences. A fence attribute would make the duration a computed value (round-1 suggestion 2 of chapter 17 and 6 of chapter 18).
3. **Generator: a context line that a later step adds.** The cover of 17.3.4 still says that the class brace is "already in your file" although 3.6 adds it (round-1 suggestion 5 of chapter 17).
4. **Generator: "Inside …" for a fence that starts inside a method.** 18.2.5, 18.2.7, 18.4.4, 18.4.5, 18.5.3, and 18.6.1 show only the class (round-1 suggestion 3 of chapter 18); 17.3.1 shows only `protocol PreviewTarget` for a run that is a new top-level protocol.
5. **Generator: imports on a new-file cover.** Findings 5 of this round and 2 and 3 of the chapter 18 round 1 are all gaps in a new-file caption. The cover of a `new` fence could list the `import` lines of the solution as hints, like the comment lines; then `import Combine` would be visible without a caption sentence.
6. **Picture `content/images/ch17-s6-6-a.jpg`.** A capture in which the front picture shows a mirrored object (or a note in `research/05-simcam.md` on how SimCam draws its front test card) would let the caption sentence of finding 4 go.
7. **Glossary: the required `self` in an escaping log interpolation** (17.4.4, finding 3). No entry matches. A pattern on `\(self\.` inside a `logger.` line would be fragile; a note in `AUTHORING.md` for writers ("name `self.` when the solution has it in a log line") may be enough.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2h.json && REPLAY_DIR=/tmp/replay-r2h python3 tools/replay.py /tmp/steps-r2h.json ch17-build ch18-build`): chapter 17, sections 1, 2, 5, and 6 `claims=Y build=ok`, sections 3 and 4 `claims=Y build=unclear (brace position)` (known and acceptable: the brace of 3.1 that git counts as new), end state equals the branch `chapter-17`. Chapter 18, sections 1 to 6 all `claims=Y build=ok`, end state equals the branch `chapter-18`.

## Verdict

**Chapter 17.** Ready for both personas. Every round-1 finding is fixed. The four new findings are text additions (a build gap of eight steps that no step named, one wrong duration, the required `self` in one log line, and a picture that cannot show the mirroring), all applied. The copier has one clear paste place per step, the eleven delete boxes match the diff, and the one brace trap has its caption. The self-implementer has every declaration, value, label, and string in the captions or the cover hints. The remaining warts are generator items (suggestions 2 to 4) and the picture (suggestion 6).

**Chapter 18.** Ready for both personas. Every round-1 finding is fixed. The two new findings are a missing `import Combine` in a new-file caption, which would stop a self-implementer with a compile error, and the parameter types of the delegate method; both applied. The eight boilerplate steps are marked `copy` and have their spec. The delete boxes match the 17 removed lines, no line is highlighted twice, and all six sections build in the replay. The remaining warts are the copy note wording (suggestion 1) and the generator items (suggestions 2, 4, and 5).
