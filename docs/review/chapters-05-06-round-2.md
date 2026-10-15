# Chapter 5 and 6 build pages: learner review, round 2

Date: 15 Oct 2026
Pages: `content/pages/ch05-build.md` (29 steps in 4 sections) and `content/pages/ch06-build.md` (22 steps in 4 sections), rendered as `dist/ch05-build.html` and `dist/ch06-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholders, delete boxes), the "What you see" pictures, and the Swift notes. The rendered cover of each step was extracted from the HTML and compared with `git diff chapter-04 chapter-05` and `git diff chapter-05 chapter-06`. The two pictures were viewed. The glossary cards on the two pages were checked against `src/lib/swift-notes.mjs` and against the earlier pages. The validator now has the two copier-trap warnings; this round checked that the two pages give none.

The build ran alone, before any git command on the app repository. Both pages had all their "Inside …" texts (15 and 18) on the first build.

## Verification of the round-1 findings: chapter 5

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | The delete box of 3.5 lists the eight old lines of `body` (the `VStack`, the `overlay`, the closing brace). The instruction says "replace the whole content between the braces". The caption says to delete and paste in one go. |
| 2 | fixed | Caption of 3.4 lists `.frame(width: 740)`, `.background(.ultraThinMaterial.opacity(0.8))`, `.cornerRadius(12)`, `.padding(.bottom, 32)`, in this order. |
| 3 | fixed | 2.1 names `AspectRatio`, `photoAspectRatio`, `movieAspectRatio`, `CGSize`, and the two initializer calls. |
| 4 | fixed | 4.1 gives `windowSize`, private, `@State`, `CGSize`, the place, and `CGSize.zero`. |
| 5 | fixed | 1.2 names the two requirements, `UserInterfaceSizeClass?`, `{ get }`, `: View`, and `@MainActor`. |
| 6 | fixed | Caption of 2.2 gives the two comment lines, the full property declaration, and the place. |
| 7 | fixed | 3.3 gives `@ViewBuilder`, `some View`, `VStack` with `Spacer` and `ZStack`; caption says no spacing argument. |
| 8 | fixed | 3.1 says "below the `camera` property"; 4.6 and 4.8 say "above the `camera` property". The caption of 3.1 says that the place differs. |
| 9 | fixed | Caption of 4.2 names `CGSize.self`, `proxy.size`, `proxy.safeAreaInsets` with the four insets, and `windowSize = size`. |
| 10 | fixed | 4.4 gives `CGFloat`, `CGRect(origin: .zero, size: windowSize)`, and `rounded()` before the division. |
| 11 | fixed | 1.3 says read-only `Bool`. 1.4 says extension of `PlatformView`, `.regular`, `.compact`, `&&`, and `\|\|`. |
| 12 | partly fixed | 2.4 gives the type, the place, and the return value. 2.3 says private but gave the value as "a `CGFloat` with the value -44", not the form `CGFloat(-44)` that the sample uses. Fixed in this round (new finding 1). |
| 13 | fixed | Instruction of 3.2 gives `@ViewBuilder` and `some View`. |
| 14 | fixed | 4.7 gives `CGFloat?`, "above `height`", and `frame(width:height:)`. |
| 15 | not fixed, by decision | The comment lines of the sample are still not in the text. Since round 1, the cover shows them as hints, so the self-implementer sees them in Try first mode. No fix needed. |

Counts: fixed 13, partly fixed 1, not fixed 1 (by decision, no longer needed).

Round-1 suggestions for chapter 5, checked: the glossary has the entry `Multiple trailing closures` (`common`); its card is on the chapter 2 page, which is the first use, so 4.2 gets no card and no pointer, which is correct. The build ran alone and had all covers (suggestion 3). The two-placeholder covers of 2.2, 3.1, 4.6, 4.8 now say "(1 of 2)" and "(2 of 2)" (suggestion 4).

## Verification of the round-1 findings: chapter 6

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 4.1: "add the `async` method `focusAndExpose(at point: CGPoint)`"; caption says why. |
| 2 | fixed | Caption of 1.4 names `isFocusPointOfInterestSupported` and `isFocusModeSupported(_:)` with links. |
| 3 | fixed | 1.5 names `exposureMode` (constant and property), `.autoExpose`, `.continuousAutoExposure`, `exposurePointOfInterest`, and the two support tests. |
| 4 | fixed | 3.1 names `observeSubjectAreaChanges(of:)`, `subjectAreaChangeTask`, private for both, "below it", `of device: AVCaptureDevice`, and `Task<Void, Never>?`. |
| 5 | fixed | Caption of 2.3 names `do`, `catch`, `logger.debug(_:)`, the message, and says that the checkpoint looks for it. |
| 6 | fixed | Caption of 1.1 gives the full signature and the `MARK` text; instruction names `device`. |
| 7 | fixed | 1.3 names `focusMode` and writes `AVCaptureDevice.FocusMode.autoFocus`. |
| 8 | fixed | 2.1 gives `func focusAndExpose(at point: CGPoint)` and says why it is not `async`. 2.2 names `devicePoint`. |
| 9 | fixed | Caption of 3.2 names `NotificationCenter.default`, `AVCaptureDevice.subjectAreaDidChangeNotification`, and `for await _ in`. |
| 10 | fixed | 4.2 says `async` and "Await the same method of `captureService`". |
| 11 | fixed | Step 2.4 is a Build checkpoint; the replay reports `claims=Y` for section 2. |
| 12 | fixed | The covers of 1.1 and 1.2 say "(1 of 2)" and "(2 of 2)". The gap is a comment hint line, not a blank line, so the two placeholders stay; the numbering makes clear that they belong to one step. |

Counts: fixed 12, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 6, checked: the glossary has `try?`, `for await`, and `Task<Success, Failure>` (all `common`). The `Task<Success, Failure>` card is at 3.1 and the `try?` card at 3.3; no earlier build page has `try?` or `Task<` in a fence, so these are the first uses (round 1 said chapter 2 for `try?`; that was wrong). The `for await` card is on the chapter 2 page, so 3.2 gets none, which is correct. The replay still reports `claims=n` for section 4 (Run checkpoint); the build passed.

## New findings

| # | Chapter.step | Persona | Problem | Severity | Fix applied |
|---|--------------|---------|---------|----------|-------------|
| 1 | 6.1.1, 6.1.3, 6.2.2 | self-implementer, copier | After each of these steps, a build gives a warning: `device`, `focusMode`, and `devicePoint` are constants that nothing uses until the next step. The cover tells the learner to build after each step. No text said that the warning is expected, so a learner can "fix" it by removing the line. | medium | Captions: "A build after this step warns that `…` is never used. The next step uses it." |
| 2 | 5.2.2 | self-implementer, cover | The cover shows the two doc comment lines of this step as hints, with line numbers 18 and 19, under the text "The lines below are already in your file". The step's own work is to add these two lines. | low | Caption: the cover shows them as hints; they are not in the file yet. See suggestion 1. |
| 3 | 5.2.3 | self-implementer | The value was given as "a `CGFloat` with the value -44". The sample writes `CGFloat(-44)`. A learner who writes `: CGFloat = -44` compiles, but the diff differs. (Round-1 finding 12, partly fixed.) | low | Instruction: "with the value `CGFloat(-44)`". |
| 4 | 5.2.6 | self-implementer | The first argument of `aspectRatio(_:contentMode:)` was not named. A learner who writes `photoAspectRatio` instead of the `aspectRatio` property compiles; chapter 8 then changes the wrong place. | low | Caption names the `aspectRatio` property from step 4 as the argument, "not the constant `photoAspectRatio`". |
| 5 | 5.4.2 | self-implementer | The closure body was described in words only. The sample reads the insets into a constant `insets` and uses `return`, because the closure has two statements. A one-expression closure compiles, but the diff differs. | low | Caption names `insets` and the `return` keyword. |
| 6 | 5.4.5 | self-implementer | "add the bottom padding to the toolbar" did not write the modifier `.padding(.bottom, bottomPadding)`; the other modifier steps on the page write the form. | low | Instruction writes the modifier. |
| 7 | 5.4.4 | self-implementer | `bottomPadding` has no access level in the text. The sample has no `private`; the page says private for the other new stored properties, so a learner can add it. | low | Caption: "The property is not private, like `aspectRatio` in `PreviewContainer`." |

Counts: medium 1, low 6.

### Checks that passed

- Copier, chapter 5: the six delete boxes (2.5, 3.1, 3.5, 4.6, 4.7, 4.8) cover every line that `git diff chapter-04 chapter-05` removes or changes. The validator's two copier-trap warnings are silent on this page: in 3.2 the learner copies the four `VStack` lines that are still in `body` (git counts them as context, not as added), and 3.5 deletes them; in 2.5 the new `previewView` lines have another indentation than the old one. The project file change is `uncovered:` and the settings card of 1.1 shows exactly the new value.
- Copier, chapter 6: the diff only adds lines (no `remove` fence needed, none exists). Every paste place is clear. 4.1 says that the project does not compile until 4.3; that is true (two classes stop conforming to `Camera`).
- Build at each step, chapter 5: no step gives a warning or an error. Unused private stored properties (`photoModeOffset` in 2.3, `windowSize` in 4.1) and unused computed properties (`compactUI`, `regularUI`, `bottomPadding`) give no warning. `.cornerRadius(12)` in 3.4 is marked in the SDK as `deprecated: 100000.0` (a future version), so Xcode gives no warning.
- Build at each step, chapter 6: apart from finding 1, no step gives a warning. An unused parameter (`point` in 2.1, `device` in 3.1) and an empty `for await` body (3.2) give no warning.
- Covers: "Inside …" is correct on every step that has it (`protocol PlatformView: View`, `struct PreviewContainer … › var body`, `struct CameraUI … › var regularUI`, `… › var compactUI`, `struct MainToolbar … › var body`; `actor CaptureService › private func focusAndExpose(at:isUserInitiated:) throws`, `… › func focusAndExpose(at point: CGPoint)`, `… › private func observeSubjectAreaChanges(of:)`, `… › private func setUpSession() throws`, `… › private func changeCaptureDevice(to:)`, `protocol Camera: AnyObject, SendableMetatype`, `final class CameraModel: Camera`, `class PreviewCameraModel: Camera`, `struct CameraView … › var body`). File-level steps show only the file. The two-run covers say "(1 of 2)" and "(2 of 2)".
- Hints: the string literals of 6.2.3 and 6.4.3 appear on the covers as "texts in this code", so the log messages are available in Try first mode.
- Pictures: `ch05-s2-8.jpg` shows the 3:4 frame above the center with a small bar above and a larger bar below, and the toolbar at the bottom edge, as the caption says. `ch05-s4-9.jpg` shows the toolbar moved up into the black bar below the frame, with empty space below it, as the caption of 4.9 says.
- Glossary: no card and no pointer on chapter 5 (all constructs are `common` entries that earlier pages introduce). Two cards on chapter 6, at the right first uses (see the verification notes).
- Checkpoints, notes, experiments, and quiz answers of both pages match the code.

## Suggestions for the generator (not fixable on the pages)

1. **Mark hint lines on the cover.** The comment lines and string literals of the solution appear on the cover with the same style and line numbers as the context lines, under the text "The lines below are already in your file". In 5.2.2 the two comment lines are the work of the step. A different style for hint lines (for example dimmed, with no line number) and a sentence "Comment lines in this style are hints; they are not in your file yet" would remove the confusion on every page.
2. **Warnings from unused constants.** A step that declares a `let` and uses it only in the next step always gives an "immutable value was never used" warning. A validator note could find such steps: a highlighted `let name =` whose `name` appears in no other highlighted line of the same step.
3. **Replay tool: count a "Run" checkpoint as a claim** (from round 1, chapter 6, still open). Section 4 of chapter 6 reports `claims=n`.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings, before and after the fixes.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2b.json && REPLAY_DIR=/tmp/replay-r2b python3 tools/replay.py /tmp/steps-r2b.json ch05-build ch06-build`): chapter 5, sections 1 to 4 all `claims=Y build=ok`, end state equals the branch `chapter-05`. Chapter 6, sections 1 to 3 `claims=Y build=ok`, section 4 `claims=n build=ok` (Run checkpoint, suggestion 3), end state equals the branch `chapter-06`.

## Verdict

**Chapter 5.** Ready for both personas. Every round-1 finding is fixed; the one partly fixed item (the form `CGFloat(-44)`) is fixed in this round. The six new findings were text additions, all applied. The copier has a clear place for each paste and complete delete boxes. The self-implementer has every name, type, access level, modifier form, and argument.

**Chapter 6.** Ready for both personas. Every round-1 finding is fixed. The one new finding of weight (the expected "never used" warnings after 1.1, 1.3, and 2.2) is now in the captions. The covers, the glossary cards, the checkpoints, and the pictures need no change.
