# Chapter 7 and 8 build pages: learner review, round 2

Date: 15 Oct 2026
Pages: `content/pages/ch07-build.md` (53 steps in 6 sections) and `content/pages/ch08-build.md` (63 steps in 12 sections), rendered as `dist/ch07-build.html` and `dist/ch08-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholders, the comment lines and string literals of the solution as hints, delete boxes, copy note), the "What you see" pictures, and the Swift notes. The rendered cover of each step was extracted from the HTML and compared with `git show chapter-07:<file>`, `git show chapter-08:<file>`, `git diff chapter-06 chapter-07`, and `git diff chapter-07 chapter-08`. The eight pictures were viewed. The glossary cards and pointers on the two pages were checked against `src/lib/swift-notes.mjs`.

Both builds in this round had all "Inside …" texts (44 on chapter 7, 43 on chapter 8). The working tree of the site repository has changes to `ch05-build.md` and `ch06-build.md` from another session; this review did not touch them.

## Verification of the round-1 findings: chapter 7

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 1.7 is `new copy`. Caption gives `import Foundation`, `extension URL`, `static var movieFileURL: URL`, and the full expression. The cover is the copy note. |
| 2 | fixed | 5.5 is `new copy`. Caption gives `Group`, `Text("LIVE")`, `.padding(6)`, `.foregroundColor(.white)`, `.font(.subheadline.bold())`, `.background(Color.accentColor.opacity(0.9))`, `.clipShape(.buttonBorder)`, and the preview. |
| 3 | fixed | 1.3 names `speed`, `balanced`, `quality`, the five protocols in order, `var id: Self { self }`, and the raw values. 1.4 gives `String` and the three strings. |
| 4 | fixed | 1.5 and 1.6 name the properties in the instructions. 1.6 gives `let isLivePhotoCaptureSupported: Bool`, the initializer, `static let unknown`, and the two comment lines. |
| 5 | fixed | 2.1 names the three properties, `var`, `false`, `URL?`, and the places above and below `photoData`. The cover has two placeholders at these places. |
| 6 | fixed | 2.4 and 2.5 link the full callback names, list the parameters with types, give the log texts, `return`, the long form `if let error = error`, and `fileDataRepresentation()`. |
| 7 | fixed | 6.2 gives `livephoto`, `livephoto.slash`, `camera.isLivePhotoEnabled.toggle()`, and the comment with two spaces. 6.4 gives the `switch` and `dial.low`, `dial.medium`, `dial.high`. |
| 8 | fixed | 6.3 gives `@ViewBuilder`, `some View`, the picker title, the binding, `ForEach(QualityPrioritization.allCases)`, `Text($0.description)`, the font, the empty `label`, and the empty line. |
| 9 | fixed | 6.1 gives the generic form, the two `@Environment` properties, `@State var camera`, `HStack(spacing: 30)`, the button style, the padding, and points to `MainToolbar.swift`. |
| 10 | fixed | 3.6 says that the closing brace is highlighted because git counts it as new, and not to add a second one. The cover shows one merged placeholder. |
| 11 | fixed | 4.1 and 4.4 give `with features: PhotoFeatures`. 4.1 gives the comment text. |
| 12 | fixed | 4.6 and 4.7 name the properties, the types, the places, the comments, and the declarations. |
| 13 | fixed | 5.1 gives `private var livePhotoCount = 0`. 5.2 names `currentActivity` and the two places in the loop. 5.3 and 5.4 give the two `if` forms and `willCapture: activity.willCapture`. |
| 14 | fixed | 3.5 and 3.8 give the full declarations with `private(set)` and the comments. |
| 15 | fixed | 2.2 gives the comment and the two `yield` calls. 2.3 gives the parameters. 2.6 gives `let` and `URL?`. 2.8 gives the ternary and the comment. 2.9 gives `if let url`, `livePhotoOptions`, and the `fileURL:` form. |
| 16 | fixed | 1.1 gives `isLivePhoto: Bool = false` after `willCapture`. 1.2 gives `Bool`, `if case .photoCapture(_, let isLivePhoto)`, and `false`. |
| 17 | fixed | 4.8 names `photoFeatures`. 5.6 gives `.overlay(alignment: .top)` and the `opacity` arguments. 6.6 names `PreviewBackground`. 6.7 gives `.frame(width: 250)` and the place. |
| 18 | fixed by the generator | The four comment lines of 5.3 and 5.4 are now context lines in the cover (lines 96, 97, 100, 103, 104), so the self-implementer sees them. |

Counts: fixed 18, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 7, checked on the page: the card `Self (the type)` is at 1.3, the first use in the tutorial. `$0` is `common` and first appears in chapter 3, so the page has no card for it, which is correct. The highlighted brace of 3.6 (suggestion 2) is still in the fence; the caption handles it. The copy note and the caption sentence of 1.7 and 5.5 still say the same thing (suggestion 4, a generator choice).

## Verification of the round-1 findings: chapter 8

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 9.3 has two `remove` fences: the five lines of the old `PhotoCaptureButton` call and the five lines of the old preview. The instruction says "replace the preview". The caption says to delete and paste in one go and why. |
| 2 | fixed | 8.2 gives the generic structure, `@State var camera`, `@Binding private var direction`, the initializer with `_direction = direction`, the picker with label and binding, the `ForEach` with `Image(systemName: $0.systemName)` and `.tag($0.rawValue)`, the three modifiers in order, the `onChange` closure in words, and the preview. |
| 3 | fixed | 3.1 lists the four members with declarations, the two imports, the mark, and says that the protocol has a default `updateConfiguration(for:)`. |
| 4 | fixed | 9.1 gives `(Bool) -> Void`, `CGFloat(4.0)`, `init(isRecording:action:)` with `@escaping` and `_isRecording`, and the nested style. 9.2 gives the `ZStack`, `Circle()` with stroke and white, `GeometryReader`, the radius `/ 4.0` or `/ 2.0`, `.inset(by: lineWidth * 1.2)`, `.fill(.red)`, `.scaleEffect(isRecording ? 0.6 : 1.0)`, and `withAnimation(.easeInOut(duration: 0.25))`. |
| 5 | fixed | 10.1 is `new copy`. Caption has the copy sentence, `PlatformView`, `let time: TimeInterval`, the six modifiers in order, `formatted`, and the format string. |
| 6 | fixed | 7.7 lists the four members with their forms: `didSet` with `Task.sleep(until: .now + .seconds(0.3), clock: .continuous)`, `isSwitchingModes` directly below, the initializer order, `toggleRecording()` not `async`, and the log text. |
| 7 | fixed | 7.6 names `captureMode: CaptureMode { get set }`, `isSwitchingModes: Bool { get }`, `toggleRecording() async`, their places, and the two comment texts. |
| 8 | fixed | 3.2 to 3.5 give `private class`, `CheckedContinuation<Movie, Error>?`, the four parameters, the two `resume` calls, `private var delegate`, the `guard` on `isRecording`, `stopRecording() async throws -> Movie`, the two closure lines in order, and the two marks. |
| 9 | fixed | 4.6 gives the signature, `guard let connection = movieOutput.connection(with: .video) else { return }`, `.contains(.hevc)`, and `setOutputSettings([AVVideoCodecKey: AVVideoCodecType.hevc], for: connection)`. 4.7 gives `isVideoStabilizationSupported` and `.auto`. |
| 10 | fixed | 1.1 gives `duration`, `TimeInterval`, `0.0`. 1.3 gives the declaration, the cases, `var id: Self { self }`, the symbol names, and "without `return`". |
| 11 | fixed | 8.6 gives `some Gesture`, the place between `onTapGesture` and `opacity`, `DragGesture(minimumDistance: 50)`, `onEnded`, and `$0.translation.width < 0`. |
| 12 | fixed | 8.3 names `@Binding var swipeDirection: SwipeDirection` below `camera` and says that the project compiles again at step 8.5. |
| 13 | fixed | 2.3, 5.5, 6.1, 7.1, 7.2 give the comment texts and the mark. 6.1 says to keep the backtick. |
| 14 | fixed | 5.1 to 5.3 give `private let movieCapture`, `private(set) var captureMode`, the places, `setCaptureMode(_:) throws` and why, the mark, `removeOutput(_:)` and `addOutput(_:)`. 6.2 gives both methods. 6.3 gives `save(movie:) async throws`, `currentLocation`, `forAsset()`, and `addResource(with: .video, fileURL:options:)`. |
| 15 | fixed | 4.1 to 4.5 give `refreshInterval`, `AnyCancellable?`, `private`, the mark, `[weak self]`, `guard let self`, the assignment to `timerCancellable`, `cancel()`, and the two call places. |
| 16 | fixed | 7.2 gives the `guard` and "not `private(set)`". 7.3 gives `isSwitchingModes = true`, `defer`, and `try? await captureService.setCaptureMode(captureMode)`. 7.4 gives `async`, the mark, and "only a `default` case". |
| 17 | fixed | 1.2 gives the two types. 1.4 gives `url: URL`. 2.2 gives `.audio` and the error. 8.1 lists the four cases. 8.4 gives `.offset(x: -250)` and `.constant(.left)`. 8.5 gives the two imports and the state. 10.2 gives the offset. 10.3 gives the `switch`. 11.1 gives the two expressions. 11.2 gives the place. 12.1 and 12.2 give `.disabled(_:)` and the places. |

Counts: fixed 17, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 8, checked on the page: the card `didSet` is at 7.2 and the cards `_name = value (property wrapper storage)` and `@Binding` are at 8.2 (suggestions 1 and 2, applied). The pointers `get throws` (2.2, to chapter 2 step 1.4), `withCheckedThrowingContinuation` (3.5, to chapter 3 step 4.3), and `@escaping` (9.1, to chapter 3 step 7.10) lead to steps that have the card. There is no glossary entry for a `switch` expression (suggestion 3, still open; see suggestion 2 below). The covers of 6.1 and 7.2 now begin with the comment lines as context and show "Inside …" (suggestion 4, resolved by the hint lines). The validator has the two copier-trap warnings (suggestion 5, applied; but see suggestion 1 below). The three sample quirks (backtick, "vertical" comment, `.tag($0.rawValue)`) are still on the page with a sentence to keep them (suggestion 6, a coordinator decision).

## New findings

| # | Chapter.step | Persona | Problem | Severity | Fix applied |
|---|--------------|---------|---------|----------|-------------|
| 1 | 8.1.3 | copier, self-implementer | Fence line 7, the closing brace of `CaptureActivity`, is highlighted because git counts it as added (the diff adds `}` after `isRecording` and keeps the last `}` of `CaptureMode` as context). The learner already has this brace after step 1.2. A copier who pastes all highlighted lines gets a second `}` and the build fails. In Try first mode, the cover shows four placeholders, and the first one stands for this brace. The same trap as 7.3.6, which round 1 found; this one was missed. | medium | Caption says that the brace is highlighted because git counts it as new, not to add a second brace, and that the first placeholder stands for it. The fence is unchanged (the validator needs the line for coverage). |
| 2 | 8.9.4 | self-implementer, picture | The picture `ch08-s9-4.jpg` is from the end of the chapter: it shows the time view `00:00:00` at the top, no photo controls, and the 9:16 preview. The step text says "You cannot see the recording time yet", and 8.7 says that the shape of the preview does not change yet. A learner who compares the screen with the picture thinks that steps are missing. | medium | Picture caption says that the picture is from the end of the chapter, what the screen shows at this step, and that sections 10 and 11 change it. |
| 3 | 7.5.2 | copier, self-implementer | After this step, Xcode shows two warnings until step 5.4: `isLivePhoto` is never used, and `currentActivity` is never mutated. No text said so, and the chapter 7 page has no other step with a warning. | low | Caption names the two warnings and says when they go away. |
| 4 | 7.4.3 | self-implementer | The local name `prioritization` of the `if let` was not given. A different name compiles, but the diff with the branch differs. | low | Caption gives the full `if let` line. |
| 5 | 7.4.9 | self-implementer | "add the two properties with the same defaults" gave neither the names nor the place. The names are in 4.6 and 4.7 only; the cover shows the place. | low | Instruction names the two properties and the place above `shouldFlashScreen`. Caption says: the same lines as in `CameraModel`, without the comments. |
| 6 | 7.1.6 | self-implementer | The sample has an empty line directly after `struct CaptureCapabilities {`. The caption did not say it, and the cover does not show it. A file without the line differs from the branch by one line. | low | Caption says to keep the empty line. |
| 7 | 8.6.3 | self-implementer | The caption explained `shouldMoveFile` but never said to set it: "create a `PHAssetResourceCreationOptions` object and a request". The name `options` and the order (options first, then the request, the reverse of `save(photo:)`) were not given. | low | Caption: "create a `PHAssetResourceCreationOptions` object with the name `options`, set its `shouldMoveFile` to `true`, and then create a request". |
| 8 | 8.10.4 | picture | The picture `ch08-s10-4.jpg` shows the camera switch button dim. The button gets `.disabled(_:)` in section 12. At this checkpoint it is not dim. | low | Picture caption says that the dim switch button comes in section 12. |

Counts: medium 2, low 6. No main code fence and no `remove` fence changed. No `copy` mark added: every boilerplate file (7.1.7, 7.5.5, 8.10.1) already has one, and 7.6.1, 8.3.1, 8.8.2 are reasonable tasks with a full spec.

### Checks that passed

- Copier, chapter 7: `git diff chapter-06 chapter-07` touches 11 Swift files; every added line is highlighted in a step of the same file. The delete boxes of 1.1, 2.2, 2.7, 2.8, 4.1, 4.4, 4.5, 4.8, and 5.2 cover every removed line. No line is highlighted in two steps. The only highlighted line that exists before the step is the brace of 3.6 (round-1 finding 10, caption in place). The empty line that 4.1 deletes is in the text.
- Copier, chapter 8: `git diff chapter-07 chapter-08` touches 17 Swift files and the project file (`uncovered:`, explained in 2.1). The delete boxes of 2.3, 5.1, 5.5, 6.1, 7.1, 7.2, 7.6, 7.7, 8.4, 8.5, 9.3, 10.2, 10.3, and 11.1 cover every removed or moved line. Finding 1 is the only highlighted line that exists before the step. The blank-line changes in `CameraUI.swift` and `PreviewContainer.swift` are ignored by the validator and the replay.
- Build gaps: chapter 7 has one (4.4 to 4.9, note in place). Chapter 8 has two (7.6 to 7.7, note in place; 8.3 to 8.5, sentence in 8.3). Finding 3 adds the only warning gap.
- Covers: "Inside …" is correct on every step that has it (for example `private class MovieCaptureDelegate: NSObject, AVCaptureFileOutputRecordingDelegate` on 8.3.3, `var captureMode = CaptureMode.photo` on 8.7.3, `var prioritizePicker` on 7.6.4). Create-file covers on 7.6.1, 8.3.1, 8.8.2; copy notes on 7.1.7, 7.5.5, 8.10.1. The hint lines ("texts in this code") give the SF Symbol names, the log texts, the picker title, and the preview names, and the captions give them too.
- Placeholders: one per highlighted run after merging; the indentation matches the first highlighted line. The context line numbers match the branches (for example 119 to 128 around `updateConfiguration(for:)` in chapter 7, 160 to 181 around `setCaptureMode(_:)` in chapter 8).
- Pictures: `ch07-s5-5.jpg` (blue capsule with LIVE), `ch07-s6-7.jpg` (the two controls in the canvas), `ch07-s6-8.jpg` (the controls at the top right of the running app), `ch08-s8-6.jpg` (segmented picker with two symbols), `ch08-s8-7.jpg` (picker above the main toolbar in photo mode), `ch08-s10-1.jpg` (00:08:20 in a dark capsule) match their captions. `ch08-s9-4.jpg` and `ch08-s10-4.jpg` needed findings 2 and 8.
- Glossary: `Self (the type)` at 7.1.3; `didSet` at 8.7.2; `_name = value` and `@Binding` at 8.8.2. The three pointers on chapter 8 lead to the steps with the cards. `if case`, `typealias`, `@Published`, `private(set)`, `@ViewBuilder`, `some View`, `#Preview`, `defer`, `guard`, `[weak self]`, `try?`, `Task`, `@discardableResult`, `$0`, `??`, and the ternary are `common` or earlier, so they get no card.
- Checkpoints and quiz answers match the code at each point.

## Suggestions for the generator, the validator, and the coordinator (not fixable on the pages)

1. **Validator: a highlighted closing brace that already exists.** Rule 6 did not warn on 7.3.6 or 8.1.3, because a `}` line exists many times on `startBranch`. A narrower check would catch both: when the last highlighted line of a run is a brace-only line, and the line after the run on `startBranch` at that place is the same brace, warn, or let the generator render the line without the highlight and without a placeholder. The coverage rule can keep counting it.
2. **Glossary: `switch` as an expression.** Round-1 suggestion 3 of chapter 8 is still open. 8.1.3 is the first use (`systemName` returns a `String` from a `switch` with no `return`). The caption says "without `return`", but a card would explain why that compiles.
3. **Pictures from a later state.** `ch08-s9-4.jpg` and `ch08-s10-4.jpg` were made at the end of the chapter. New captures with `tools/capture.py` at the state of checkpoints 9.4 and 10.4 would let the two caption sentences of findings 2 and 8 go.
4. **Validator: `;` in a `result=` caption.** The quirk from the chapter 3 and 4 round came up again in this round (one draft caption with a semicolon gave "The image file does not exist"). A clearer message, or a quoted form that allows `;`, would help.
5. **Copy note and caption say the same thing twice** on 7.1.7, 7.5.5, and 8.10.1 (open since round 1 of chapters 3 and 4).
6. **Other pages in the working tree.** `ch05-build.md` and `ch06-build.md` have uncommitted changes from another session. This review did not read or touch them.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2c.json && REPLAY_DIR=/tmp/replay-r2c python3 tools/replay.py /tmp/steps-r2c.json ch07-build ch08-build`): chapter 7, section 1 `claims=Y build=unclear (brace position)` (known and acceptable), sections 2 to 6 `claims=Y build=ok`, end state equals the branch `chapter-07`. Chapter 8, sections 1 to 12 all `claims=Y build=ok`, end state equals the branch `chapter-08`.

## Verdict

**Chapter 7.** Ready for both personas. Every round-1 finding is fixed. The four new findings on this page are small text additions (a warning note, a local name, two property names, one empty line), all applied. The copier has one clear paste place per step and a complete delete box where a line goes away. The self-implementer has every name, type, access level, argument label, and modifier value in the text or in the cover hints.

**Chapter 8.** Ready for both personas after this round. Every round-1 finding is fixed. The one copier trap that round 1 missed (the closing brace of `CaptureActivity` in step 1.3) now has the same caption as the brace in chapter 7, step 3.6. The two pictures from a later state have captions that say so. The remaining warts are generator and glossary items (suggestions 1 and 2) and the three sample quirks that the page asks the learner to keep.
