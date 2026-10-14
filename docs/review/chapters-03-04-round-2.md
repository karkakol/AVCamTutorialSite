# Chapter 3 and 4 build pages: learner review, round 2

Date: 14 Oct 2026
Pages: `content/pages/ch03-build.md` (56 steps in 7 sections) and `content/pages/ch04-build.md` (22 code steps and 7 settings steps in 7 sections), rendered as `dist/ch03-build.html` and `dist/ch04-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholder, delete boxes, copy note), the "What you see" pictures, and the Swift notes. The rendered cover of each step was extracted from the HTML and compared with `git show chapter-03:<file>`, `git show chapter-04:<file>`, `git diff chapter-02 chapter-03`, and `git diff chapter-03 chapter-04`. The six pictures were viewed. The glossary cards and pointers on the two pages were checked against `src/lib/swift-notes.mjs` and against the pages they point to.

Since round 1, the generator got a `copy` fence mark (code stays visible in Try first mode), uncovered review steps, merged placeholder runs, and the glossary entries `isolated`/`#isolation`, `associatedtype`, `if case`, `typealias`, `get async`, `@escaping`, and the `if let` shorthand. This round checked these on the two pages.

## Verification of the round-1 findings: chapter 3

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | Caption of 1.4 lists the five members of `OutputService` with types. |
| 2 | fixed | Caption of 2.2 gives `PhotoCaptureError` with `noPhotoData`, `final class`, the three properties with full declarations, and the two imports. The sentence "press Show solution and copy the file" was stale after the `copy` mark (new finding 1). |
| 3 | fixed | Caption of 7.10 gives 68 points, line width 4, inset 1.2 x line width, scale 0.85, 0.15 s, generic over `Camera`, `@State var camera`, `action`, `#Preview` with `PreviewBackground`. Stale sentence as in 2 (new finding 1). |
| 4 | fixed | Caption of 1.1 names `idle` and `photoCapture(willCapture: Bool = false)`. |
| 5 | fixed | Caption of 1.5 names `output.connection(with: .video)`, `videoRotationAngle`, `?.`, and the empty body of `updateConfiguration(for:)`. |
| 6 | fixed | Caption of 2.1 gives `zero`, the `==` and `<` semantics, and `public static func`. Stale sentence (new finding 1). |
| 7 | fixed | Captions of 2.5 and 2.6 name `availablePhotoCodecTypes`, `.hevc`, `AVCapturePhotoSettings(format:)`, `AVVideoCodecKey`, `availablePreviewPhotoPixelFormatTypes`, `previewPhotoFormat`, and the dictionary form. |
| 8 | fixed | 3.1 gives `CheckedContinuation<Photo, Error>`, `private class`, `continuation`. 3.2 names the three properties with types and access. |
| 9 | fixed | 3.4: "Below the initializer"; caption names both methods, `yield(_:)`, `.photoCapture()` and `.photoCapture(willCapture: true)`. |
| 10 | fixed | Caption of 4.1 gives the full signature and "a `Task` with an empty closure". |
| 11 | fixed | Caption of 6.3 names `videoRotationAngleForHorizonLevelCapture`, the place, and the new comment text. |
| 12 | fixed | 2.3, 2.4, 4.3, 5.4, 5.9, 7.5 name their MARK comment. 7.2 said only "a mark, and a comment" without the text (new finding 3). |
| 13 | fixed | 1.2 names `Bool` and the `if case` form. 1.3 names `data: Data`. |
| 14 | fixed | Caption of 2.3 names `supportedMaxPhotoDimensions` and `?? .zero`. |
| 15 | fixed | 2.4 says private, `AVCapturePhotoSettings`, `var photoSettings`. |
| 16 | fixed | 3.3 names `init(continuation:)` and the tuple; 3.5 the log and `return`, 3.6 `resume(throwing:)`, 3.7 `guard let photoData else`, 3.8 `resume(returning:)`. |
| 17 | fixed | Caption of 4.3 gives `async throws -> Photo` and the empty `withCheckedThrowingContinuation` closure. |
| 18 | fixed | 5.1 to 5.9 give the access levels, types, `[any OutputService]`, `CameraError.addOutputFailed`, `sessionPreset`, `currentDevice`, the `@Published` declaration, `assign(to: &$captureActivity)`, and the places "below `captureSession`", "after the service adds the input", "above `previewSource`". |
| 19 | fixed | 6.2 says private, `CGFloat`, `outputServices`. 6.4 names `\.videoRotationAngleForHorizonLevelCapture`. |
| 20 | fixed | 7.1 gives the three types; 7.4 `withAnimation(.linear(duration: 0.01))` and private; 7.5 "Below `flashScreen()`", private, the loop with `await`. |
| 21 | fixed | 7.8 lists the four members, the places, and `async`. |
| 22 | fixed | 7.11 names `largeButtonSize` and the `HStack` order; 7.12 names `.opacity`. |

Counts: fixed 22, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 3, checked on the page: the cards `isolated parameter and #isolation` and `any Protocol` are at 4.1, `associatedtype` at 1.4 with a pointer at 6.1, `if case` at 1.2, `typealias` at 3.1. The `copy` mark works on 2.1, 2.2, and 7.10 (no cover, a note "Boilerplate. Copy this file as it is"). The review step 6.1 has no cover. The placeholders of 1.3, 1.4, 3.1, 5.6, and 7.2 have the correct indentation.

## Verification of the round-1 findings: chapter 4

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 3.1 says private and `async throws`; caption gives `@Sendable @escaping () -> PHObjectPlaceholder?`, the reasons, and `Error.unauthorized`. |
| 2 | fixed | Caption of 7.2 lists the generic pattern, the imports, the `PhotosPicker` arguments, 64 x 64, corner radius 8, `photo.on.rectangle`, `resizable`, `.fill`, the animation, `[PhotosPickerItem]`, the preview, and the tab characters. The sentence "press Show solution" was stale after the `copy` mark (new finding 1). |
| 3 | partly fixed | 4.1 says "leave the closure of the request empty. The next step fills it", and the caption explains the three lines on the place card. The cover still shows lines 99 to 101, the solution of 4.2, because the fence is unchanged (suggestion 1, still open). |
| 4 | fixed | Caption of 2.1 names `unauthorized`, `saveFailed`, `Swift.Error`, and the three imports. |
| 5 | fixed | Caption of 2.2 names `AsyncStream<CGImage?>`, `AsyncStream<CGImage?>.Continuation?`, private, and `makeStream(of: CGImage?.self)`. |
| 6 | fixed | 2.3 gives `private`, `Bool`, `get async`; caption names `PHPhotoLibrary.authorizationStatus(for: .addOnly)`, the local `var`, and the mark comment. |
| 7 | fixed | 5.2 gives `private`, `CLLocation?`, `get async throws`; caption names `authorizationStatus`, `.notDetermined`, and `try await`. |
| 8 | fixed | 4.1 gives `private`, `async`, `asset: PHAsset`; caption lists the arguments, the closure parameters, `[weak self]`, and the mark comment. |
| 9 | fixed | 3.3: "add the method `save(photo: Photo) async throws`"; caption: not private, `Photo`, mark comment. |
| 10 | fixed | Caption of 1.1: select All, filter with `Photo Library`, enter the value in the row of the setting itself. |
| 11 | fixed | 5.1 names the private constant and the mark comment; caption says no `import CoreLocation` is needed. |
| 12 | fixed | 6.2 gives `private(set)`, `CGImage?`, private constant, and the two places. |
| 13 | fixed | Caption of 3.2 names `PHPhotoLibrary.shared()`. |
| 14 | fixed | Caption of 3.4 names `PHAssetResourceCreationOptions` and `photo.data`. |
| 15 | fixed | Caption of 4.2 gives `guard let` and `continuation?.yield(image.cgImage)`. |
| 16 | fixed | Caption of 4.3 names `localIdentifier`, `firstObject`, `if let`, `guard ... else { return }`, and the place. |
| 17 | fixed | Caption of 7.1 names `UIImage(cgImage:)`, `Image(uiImage:)`, and `init(_ image: CGImage)`. |
| 18 | fixed | The cover of 3.3 shows one placeholder (generator: merged placeholder runs). |
| 19 | fixed | 2.3 and 5.2 show the pointer `get async` (chapter 1, step 4.1), where the card is. 3.1 shows the pointer `@escaping` (chapter 3, step 7.10), where the card is. The `if let` shorthand entry exists and is `common`; its pattern matches `guard let self, let angle` in chapter 2, step 6.5, so 3.6, 3.7 of chapter 3 and 4.3 of chapter 4 get no note, which is correct for a `common` entry (but see suggestion 3). |

Counts: fixed 18, partly fixed 1, not fixed 0.

## New findings

| # | Chapter.step | Persona | Problem | Severity | Fix applied |
|---|--------------|---------|---------|----------|-------------|
| 1 | 3.2.1, 3.2.2, 3.7.10, 4.7.2 | self-implementer | The captions said "press Show solution and copy the file". Since the `copy` mark, these steps have no cover and no Show solution button in Try first mode. The learner looks for a button that does not exist. | medium | Captions: "In Try first mode, the code of this step stays visible. Copy it as it is." |
| 2 | 3.7.9 | self-implementer | "add the same members with simple values" gave no places and no forms. The cover shows four placeholders. The sample uses `var shouldFlashScreen = false` at the top (not `private(set)`), `var error: Error?` (not `private(set)`), and `func capturePhoto()` without `async`. A learner who copies the forms of `CameraModel` compiles, but the solution and `git diff` differ in four places. | medium | Caption lists the four places, the exact declarations, that `capturePhoto()` is not `async`, and the log text. |
| 3 | 3.7.2 | self-implementer | "a mark, and a comment" without the texts. The comment `/// Captures a photo.` is the line that the delete box of chapter 4, step 6.3 shows. A learner with another comment text finds no such line. | low | Instruction names `// MARK: - Photo capture`. Caption gives the comment text and says that chapter 4 deletes it. |
| 4 | 4.6.1, 4.6.3 | self-implementer | "change the comment" without the new texts. The sample writes "photo library" in the protocol and "Photos library" in the model. The new call `mediaLibrary.save(photo: photo)` was named only as "a call that saves the photo". | low | Captions give the two comment texts, the difference, the declaration of `thumbnail` in the protocol, and the new line. |
| 5 | 4.7.4 | self-implementer, picture | The note said that the thumbnail "can look turned by 90 degrees" in the Simulator. The picture `ch04-s7-4.jpg` shows an upright thumbnail. | low | Note: in the test the thumbnail was upright, as the picture shows; it fills a square, so it shows the center of the photo; examine the orientation on a real iPhone. |
| 6 | 4.7.2 | self-implementer, picture | The picture `ch04-s7-2.jpg` shows a blue symbol in the canvas. The caption named the symbol but not the color, and the toolbar picture of 7.3 shows it white. | low | Caption: blue in the canvas (default tint of a button), white in the toolbar because `MainToolbar` sets the color. |
| 7 | 3.7.11 | self-implementer, picture | The picture caption said "the placeholder at the leading side". The placeholder is `Color.clear`; the picture shows nothing there. | low | Caption: the placeholder is invisible and only takes space. |
| 8 | 4.6.5 | self-implementer | "add the `thumbnail` property" without `private(set)` and without the place. The protocol has only `{ get }`, so `var thumbnail: CGImage?` compiles, but the diff differs. | low | Instruction: `private(set) var thumbnail: CGImage?`, below `isSwitchingVideoDevices`. |
| 9 | 3.3.1 | self-implementer | The `// MARK: - A photo capture delegate to process the captured photo.` comment between the type alias and the class was not named, unlike the other MARK comments on the page. | low | Caption names it and its place. |
| 10 | 3.4.1 | self-implementer | The instruction said "In the `PhotoCapture` class" without the place. The cover shows it (after `createPhotoSettings()`), but the other steps on the page give the place in the text. | low | Instruction: "below `createPhotoSettings()`". |
| 11 | 3.3.5 | self-implementer | The sample writes the long form `if let error = error` here and the short form `if let error` in 3.6. A learner who writes the short form in both gets a one-line diff. | low | Caption says it. |
| 12 | 3.2.2 | self-implementer | The caption says that `@Published` gives a Combine publisher, but the file imports only `AVFoundation` and `CoreImage`. A learner can think that `import Combine` is missing. The file compiles without it (the replay builds it). | low | Caption: "It compiles without `import Combine`." |
| 13 | 3.7.10 | self-implementer | The `@MainActor` attribute of the structure and the preview name `"Photo"` were not in the spec. | low | Caption names both. |

Counts: medium 2, low 11.

### Checks that passed

- Copier, chapter 3: `git diff chapter-02 chapter-03` touches 10 Swift files and removes one line; 6.3 has the delete box. Every paste place is clear in all 56 steps. No step needs code from a later step; the note after 7.8 says that the project compiles again after 7.9. Checkpoints 1.6, 2.8, 3.10, 4.5, 5.10, 6.5, 7.13 are consistent with the code at that point.
- Copier, chapter 4: the delete boxes of 6.1 (one line), 6.3 (two lines), and 7.3 (three lines) cover every line that `git diff chapter-03 chapter-04` removes. The project file changes only by the two keys of section 1 (`uncovered:`). Checkpoint 3.5 claims one warning, which is true at that point. No line moves to a new indentation.
- Create-file covers: only on 2.1 of chapter 4 (`MediaLibrary.swift`). The `copy` steps 3.2.1, 3.2.2, 3.7.10, and 4.7.2 show the code and the note "Boilerplate. Copy this file as it is; the caption says what it contains." The later steps of `PhotoCapture.swift` and `MediaLibrary.swift` show context lines and "Inside …".
- "Inside …" text: correct on every step that has it. Type-level steps show the type (`enum CaptureActivity`, `final class PhotoCapture: OutputService`, `private class PhotoCaptureDelegate …`, `actor CaptureService`, `actor MediaLibrary`, `final class CameraModel: Camera`, `protocol Camera …`, `class PreviewCameraModel: Camera`, `struct MainToolbar …`, `struct CameraView …`). Method-level steps show the method (3.2.5 to 3.2.7, 3.3.7 to 3.3.9, 3.4.2, 3.4.4, 3.5.3, 3.5.5, 3.5.8, 3.6.3, 3.6.4, 3.7.3, 3.7.6, 3.7.7, 3.7.11, 3.7.12, 4.2.4, 4.3.2, 4.3.4, 4.4.2, 4.4.3, 4.5.3, 4.6.4, 4.7.3). File-level steps (3.1.1, 3.1.3 to 3.1.5, 3.3.1, 3.5.6, 4.7.1) show only the file, which is correct.
- Placeholders: one placeholder per highlighted run; runs that a blank line separates are merged (4.3.3). The indentation of each placeholder matches the first highlighted line that is not blank.
- Context line numbers match the branches (for example 85 and 96 around `updateConfiguration(for:)`, 108 and 118 at the end of `MediaLibrary`).
- Glossary cards on these pages: `if case` (3.1.2), `associatedtype` (3.1.4), `@retroactive` (3.2.1), `@Published` (3.2.2), `typealias` (3.3.1), `isolated parameter and #isolation` and `any Protocol` (3.4.1), `withCheckedThrowingContinuation` (3.4.3), `@escaping` (3.7.10). The texts fit the code of the step. Pointers: `AsyncStream` (3.3.2, 3.3.3, 4.2.2), `associatedtype` (3.6.1), `actor` (4.2.1), `get async` (4.2.3, 4.5.2), `@escaping` (4.3.1). Each pointer leads to a step that has the card.
- Pictures: `ch03-s7-10.jpg` (ring and disc on the preview background), `ch03-s7-13-a.jpg` (preview with the capture button in the center and the switch button at the trailing side), `ch04-s7-3.jpg` (white photo symbol at the leading side), `ch04-s7-4.jpg` (thumbnail of the photo at the leading side) match their captions. `ch03-s7-11.jpg`, `ch04-s7-2.jpg`, and the note of 4.7.4 needed the fixes 5 to 7 above.
- Quiz answers of both pages match the code.

## Suggestions for the generator and the coordinator (not fixable on the pages)

1. **Fence of chapter 4, step 4.1 (still open from round 1).** The fence contains the three closure body lines of 4.2 without highlight, so the cover shows the solution of 4.2 as "already in your file". Remove the three lines from the fence; then the caption sentence about the place card can go. This review changed no fence, as instructed.
2. **Copy note and caption say the same thing twice.** On a `copy` step the generator shows "Boilerplate. Copy this file as it is; the caption says what it contains." The captions now also say "In Try first mode, the code of this step stays visible. Copy it as it is." One of the two is enough. If the generator note stays, the writers can drop the caption sentence.
3. **`if let` shorthand card.** The entry is `common`, and its first match in chapter order is `guard let self, let angle` in chapter 2, step 6.5, where `[weak self]` also gets a card. The `guard let self` form is the usual one; the plain shorthand `if let error {` appears first in chapter 3, step 3.6. A pattern that excludes `self` (for example `\b(if|guard)\s+let\s+(?!self\b)\w+\s*(,|\{|else)`) would put the card at chapter 3, step 3.6, where a learner sees the form for the first time.
4. **Validator: `;` inside a `result=` caption.** A semicolon in a picture caption splits the caption into a second "picture". The error text ("The image file does not exist: it only takes space.") does not say why. A clearer message, or a quoted form that allows `;`, would help writers.
5. **Chapter 1 validation error, outside these pages.** `npm run validate` reports `[coverage] AVCam/CameraView.swift:23 is added between "start" and "chapter-01", but no step highlights it` for `content/pages/ch01-build.md`. That page and `ch05-build.md` have uncommitted changes from a parallel session, and the app working tree has changes too. The error is not from the two pages of this review.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors and 0 warnings for `ch03-build.md` and `ch04-build.md`. The run reports 1 error on `ch01-build.md` (suggestion 5), which this review did not touch.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2.json && REPLAY_DIR=/tmp/replay-r2 python3 tools/replay.py /tmp/steps-r2.json ch03-build ch04-build`): chapter 3, sections 1 to 7 all `claims=Y build=ok`, end state equals the branch `chapter-03`. Chapter 4, sections 1 to 7 all `build=ok`, claims hold for sections 2 to 7 (section 1 has no claim), end state equals the branch `chapter-04`.

## Verdict

**Chapter 3.** Ready for both personas. Every round-1 finding is fixed. The 11 new findings on this page were text additions, all applied. The copier has a clear place for each paste and one complete delete box. The self-implementer now has the places and forms for the preview model (finding 2) and the comment texts that chapter 4 deletes later (finding 3).

**Chapter 4.** Ready for the copier. Ready for the self-implementer with one known wart: the cover of step 4.1 shows the three lines of step 4.2 (round-1 finding 3, suggestion 1). The caption explains it, so the learner is not blocked. After the fence change in suggestion 1, the page is clean for both personas.
