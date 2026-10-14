# Chapter 2 build page: learner review, round 2

Date: 14 Oct 2026
Page: `content/pages/ch02-build.md` (45 steps in 6 sections), rendered as `dist/ch02-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all 45 steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholder), the "What you see" pictures, and the Swift notes. The rendered text of each cover was extracted from the HTML and compared with `git show chapter-02:<file>` and `git diff chapter-01 chapter-02`. The six pictures were viewed. The three glossary cards from round 1 were checked on this page and on `dist/ch01-build.html`.

## Verification of the round-1 findings

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | Caption of 3.5 lists `largeButtonSize` (64 x 64), `Size` with `small` (22) and `large` (24), `init(size:)`, padding 10, `.black.opacity(0.4)`, `Color(white: 0.4)`, `Circle`/`Rectangle` with `AnyShape`, and the three environment values. The fence is `new`. The caption says "If you work in Try first mode, it is fine to copy it". There is no "copy this file" attribute; the learner presses "Show solution" (see new finding 8). |
| 2 | fixed | The `remove` fence of 4.4 lists all four old lines (two comments, `CameraPreview`, `StatusOverlayView`). The instruction says "replace the whole content of the `ZStack`". The cover shows "Also delete these lines" with the four lines. |
| 3 | fixed | Caption of 3.7: "the switch button at the trailing side. The toolbar alone sits in the middle. CameraUI moves it to the bottom in the next step." The picture `ch02-s3-7.jpg` shows exactly this. |
| 4 | fixed | 3.1: "add the `async` method `switchVideoDevices()` and the read-only `Bool` property `isSwitchingVideoDevices`". |
| 5 | fixed | Caption of 1.2 names the three device type lists, the positions, and `.video`. |
| 6 | fixed | 5.1: "create `SPCObserver.swift`, and replace its contents with the class `SystemPreferredCameraObserver`, a subclass of `NSObject`". |
| 7 | fixed | 1.7 names `activeVideoInput` (`AVCaptureDeviceInput?`) and `deviceLookup`, both private. |
| 8 | fixed | Caption of 6.2: "reads the `connections` array of the session and takes the first connection whose `videoPreviewLayer` is not `nil`". |
| 9 | fixed | Glossary entry `closure-isolation` (`Task { @MainActor in }`) exists. The first use is in chapter 1 (`CameraPreview.swift`, `setSession`), so chapter 1 step 2.9 has the card and 6.3 shows the pointer "Swift: Task { @MainActor in } (chapter 1, step 2.9)". The caption of 6.3 also writes the syntax. |
| 10 | fixed | Card "Implicitly unwrapped optional (Type!)" at 6.1. Text is correct. |
| 11 | partly fixed | The cover of 1.1, 4.1, 5.1 now says "create the new file … and write the whole file yourself". 1.1 and 5.1 say "replace its contents"; 4.1 does not. But the generator applies the "create the new file" cover to every step of a file that is not on `startBranch` (see new finding 1). |
| 12 | fixed | 1.4 names `CameraError.videoDeviceUnavailable`. |
| 13 | fixed | 2.3: "add the old input again with `addInput(_:)` of the session". |
| 14 | fixed | 3.6 names `arrow.triangle.2.circlepath`. |
| 15 | fixed | The tip is in the caption of 3.6 ("Open the canvas with Option-Command-Return"). The cover of 3.6, 3.7, 3.8, 4.4 has a "What you see" button before "Show solution", so the pictures are visible in Try first mode. |
| 16 | fixed | Caption of 4.5: "The blur lasts a fraction of a second, too short for a screenshot; the pictures show the states before and after it." |
| 17 | fixed | Every cover with context has "Inside `actor CaptureService`" or "Inside … › `method`". On 6.2 the context `181 }` is the end of `monitorSystemPreferredCamera()`, which exists since 5.5; with the "Inside" text the place is clear. |
| 18 | fixed | 5.4 names `systemPreferredCamera`; 6.1 names `rotationCoordinator` and `rotationObservers`. |
| 19 | fixed | Caption of 1.1: "The file imports `Combine` as in Apple's sample; nothing in this chapter uses it." The branch still has the import. |

Counts: fixed 18, partly fixed 1, not fixed 0.

## New findings

| # | Step | Persona | Problem | Severity | Suggested fix |
|---|------|---------|---------|----------|---------------|
| 1 | 1.2, 1.3, 1.4, 1.5, 1.6, 4.2, 4.3, 5.2, 5.3 | self-implementer, generator | The cover says "create the new file `…` and write the whole file yourself. The step text says what the file contains." for every step of a file that is not on `startBranch`, not only for the first step. `analyze.mjs` line 107 sets `fence.createsFile` when the file is missing on `startBranch`; `render.mjs` line 387 then skips the context lines, the placeholder, and the "Inside …" text. These nine steps have no place hint at all. A learner who has the file from the step before reads "create the new file" again. | high | In `analyze.mjs`, set `createsFile` only when the fence is the first fence of that file on the page (or when the highlighted region starts at line 1 of the file). Later fences of the file get the normal cover with context lines and "Inside …". |
| 2 | 2.1, 2.2, 2.3, 2.4, 3.3, 5.5, 6.5 | self-implementer, generator | The placeholder "// your code goes here" has no indentation when the first highlighted line of the fence is a blank line. `render.mjs` takes the indentation of the first highlighted line. On 2.3 the placeholder sits at column 0 inside a method; on 5.5 and 3.3 at column 0 inside the type. The context lines show the correct depth, so the learner can work it out. | low | Take the indentation of the first highlighted line that is not blank. |
| 3 | 5.1 and chapter 1, step 2.7 | self-implementer, Swift notes | The glossary entry `override-init` matches `super.init(` as well as `override init`. Chapter 1 step 2.7 has `init() { super.init(frame: .zero) }` in `PreviewView`, which is not an override. The card there says "the subclass overrides it and calls `super.init()` first", which does not describe that code. Step 5.1, the first real `override init()`, gets only the pointer "(chapter 1, step 2.7)". | medium | Split the entry: `override init` with the pattern `\boverride\s+init\b` (the card then lands on 5.1), and a separate common entry `super.init` for chapter 1, with a text about calling the initializer of the superclass. |
| 4 | 3.6, 3.7, 3.8 | self-implementer | The instructions do not say that each view is generic over `Camera` and holds the model as `@State var camera: CameraModel`. The solutions of 3.7, 3.8, and 4.4 call `SwitchCameraButton(camera:)`, `MainToolbar(camera:)`, and `CameraUI(camera:)`. A learner who chose another form (for example a non-generic view, or the label `model:`) compiles, but the later solutions and the `git diff` differ from their code. | low | In 3.6, add: "Like `CameraView` from chapter 1, the view is generic over `Camera` and holds the model in `@State var camera`. The two other views in this section use the same pattern." |
| 5 | 3.7 | self-implementer | The caption does not give the look of the toolbar: `.foregroundColor(.white)`, font size 24, height 80, leading and trailing padding. The learner's toolbar works but looks different in the pictures of 3.7 and 4.5. | low | Add one sentence: "The toolbar is 80 points high, white, with a font size of 24 and padding at the leading and trailing edges." |
| 6 | 3.4 | self-implementer | "a `switchVideoDevices()` method that only writes a log message" does not name `logger`. The global `logger` is in `AVCamApp.swift` from chapter 1, so the learner can find it. | low | Caption: "Use the global `logger` from `AVCamApp.swift`: `logger.debug(...)`." |
| 7 | 4.1 | self-implementer | The instruction says "create `PreviewContainer.swift` with …" without "and replace its contents", unlike 1.1, 3.5 to 3.8, and 5.1. | low | Add "and replace its contents". |
| 8 | 3.5 | self-implementer, site feature | The caption says it is fine to copy the file in Try first mode, but the cover hides the code until "Show solution". The button works, so the step is not blocked. The learner only has to know that "Show solution" is the way to copy. | low | Caption: "If you work in Try first mode, press Show solution and copy the file." Or add the "copy this file" attribute from round 1, suggestion 3. |
| 9 | 6.3 | self-implementer | The caption says "reads the `connection` of the layer" but not that `connection` is optional (`connection?.videoRotationAngle`). The compiler tells the learner; small stop. | low | Caption: "`connection` is optional, so use `connection?.videoRotationAngle`." |
| 10 | 6.4 | self-implementer | The initializer `RotationCoordinator(device:previewLayer:)` is not named. The caption says "needs the camera and the layer", which is enough to find it in the documentation. | low | Name the initializer in the caption. |

Counts: high 1, medium 1, low 8.

### Checks that passed

- Copier: the place of each paste is clear in all 45 steps. The delete boxes of 1.8 (two boxes) and 4.4 (one box) cover every line that `git diff chapter-01 chapter-02` removes in `CaptureService.swift` and `CameraView.swift`. No line moves without a delete box. No step needs an action that the page does not say.
- "Inside …" text: correct on all 23 steps that have it. The enclosing type is right (`actor CaptureService`, `protocol Camera`, `final class CameraModel`, `class PreviewCameraModel`, `struct CameraView`), and the method is right where the code goes inside a method (1.8, 2.3, 2.5, 2.6, 4.4, 5.6, 5.7, 6.5, 6.6, 6.7). Steps that add a whole method or property at type level (2.1, 2.2, 2.4, 5.5, 6.2, 6.3, 6.4) show only the type, which is correct.
- Context line numbers match `chapter-02` (for example 76 to 91 for `setUpSession()`, 181 and 221 for the end of the actor).
- Self-implementer names: every type, method, and property that a later step or solution uses is in the instruction or caption, except the view parameter label (new finding 4).
- Swift notes on this page: `get throws` (1.4), `#if targetEnvironment` (1.6), `defer` (2.2), `@Environment` and key path (3.5), `AsyncStream` (5.2), implicitly unwrapped optional (6.1), `[weak self]` (6.5). All at the first use on the page; the texts are correct. Pointers at 5.1 and 6.3 point to chapter 1 steps 2.7 and 2.9.
- Glossary cards checked: `Task { @MainActor in }` (chapter 1, step 2.9: `setSession` in `CameraPreview.swift`; text correct), implicitly unwrapped optional (6.1; text correct), `override init and super.init` (see new finding 3).
- Pictures: all six match their captions. 3.6 button in the middle; 3.7 button at the trailing side in the middle; 3.8 button at the bottom right; 4.4 the same with the home indicator; 4.5-a a real picture from the back camera with the button at the bottom right; 4.5-c the SimCam "FRONT" test picture.
- Checkpoints 1.9, 3.9, 4.5, 5.8, 6.8 and the note after 2.6 are consistent with the code at that point.

## Verdict

The page is ready for the copier. Every paste place is clear, and the delete boxes are complete.

The page is not yet ready for the self-implementer, because of new finding 1: nine steps inside new files (1.2 to 1.6, 4.2, 4.3, 5.2, 5.3) show no place hint, only "create the new file … write the whole file yourself". This is a generator fix in `src/lib/analyze.mjs`, not a page fix. After that fix, and after the glossary split of finding 3, the page is ready for both personas. The other eight findings are small text additions.
