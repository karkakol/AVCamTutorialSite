# Chapter 9 and 10 build pages: learner review, round 2

Date: 15 Oct 2026
Pages: `content/pages/ch09-build.md` (31 steps in 5 sections) and `content/pages/ch10-build.md` (33 steps in 5 sections), rendered as `dist/ch09-build.html` and `dist/ch10-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholders, the comment lines and string literals of the solution as hints, delete boxes), the "What you see" pictures, and the Swift notes. The rendered cover of each step was extracted from the HTML (26 covers on chapter 9, 28 on chapter 10) and compared with `git diff chapter-08 chapter-09`, `git diff chapter-09 chapter-10`, and `git show chapter-09:<file>`. The two pictures of chapter 10 were viewed. The one glossary card on the two pages was checked against `src/lib/swift-notes.mjs`.

Both builds in this round had all "Inside …" texts (24 on chapter 9, 26 on chapter 10). The working tree of the site repository was clean at the start. During this review, another session changed `ch13-build.md`, `ch14-build.md`, and added `docs/review/chapters-13-14-round-2.md`; this review did not read or touch them.

## Verification of the round-1 findings: chapter 9

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 3.3 gives `if isEnabled, let format = currentDevice.activeFormat10BitVariant`, the `logger.error(...)` text, and the sentence about the two warnings until the next step. The cover also shows the log text as a hint line. |
| 2 | fixed | 5.1 gives `var hdrToggleButton: some View`, the `Button` with two trailing closures, `toggle()` on `camera.isHDRVideoEnabled`, and `.font(.body.weight(.semibold))`. |
| 3 | fixed | 5.4 names `.buttonStyle(.bordered)` and `.buttonBorderShape(.capsule)` in order. |
| 4 | fixed | 3.2 gives `func setHDRVideoEnabled(_ isEnabled: Bool)`, not `async`, does not throw, and why. |
| 5 | fixed | 1.3 gives `AVCaptureDevice.Format?`, `formatDescription.dimensions` of `$0` and `activeFormat`, and the origin of `==`. |
| 6 | fixed | 2.1 gives `let isHDRSupported: Bool`, the parameter on its own line with its default, and the assignment. The cover has two placeholders. |
| 7 | fixed | 5.3 says to write `@ViewBuilder` above `var hdrButton: some View` and that the next step needs it. |
| 8 | fixed | 5.2 instruction says "In `hdrToggleButton`"; the caption gives `.disabled(camera.captureActivity.isRecording)`. |
| 9 | fixed | 1.1 gives `Bool` and `formatDescription.mediaSubType.rawValue`. 1.2 gives `Double`, `last?.maxFrameRate`, and `?? 0`. |
| 10 | fixed | 2.2 gives `private var` and `false`. 3.1 gives `@Published var`, no `private(set)`, `false`. 4.2 gives `private(set) var` and `false`. |
| 11 | fixed | 2.3 gives `!= nil`. 3.4 gives `try` and `isHDRVideoEnabled = true`. 4.5 gives `status` is not `.running` and `captureMode` is not `.video`. |
| 12 | fixed | 1.4 says the line ends with `&&`. 1.5 says `first(where: { … })` in parentheses. |
| 13 | fixed | 4.1 gives `Bool` for both properties and the `///` comment lines. |
| 14 | fixed | 5.5 instruction says `hdrButton`. |
| 15 | fixed by the generator | The comment lines of 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, and 4.4 are now hint lines in the covers. |

Counts: fixed 15, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 9, checked on the page: the glossary has the entry `condition-list` (suggestion 1), and the card "if with a condition list" is at 3.3, the first use in chapter order. `??` is `common` in the glossary and first appears in chapter 2, so no card. The replay still prints `claims=n` for section 5 (suggestion 4, see below).

## Verification of the round-1 findings: chapter 10

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 1.3 gives the `for await reason in` loop with `AVCaptureSession.wasInterruptedNotification`, the two `compactMap` expressions with `as AnyObject?` and `InterruptionReason(rawValue: $0.integerValue)`, the `contains` line with the two cases, and the `///` comment. |
| 2 | fixed | 4.1 names `automaticallyRunsDeferredStart`, `isDeferredStartEnabled`, and `isDeferredStartSupported` with links, the owner of each line, the two places, and the three comment lines (also hint lines in the cover). |
| 3 | fixed | 1.4 gives `for await _ in … interruptionEndedNotification` and the comment. 2.1 gives `for await error in … runtimeErrorNotification` and `as? AVError`. |
| 4 | fixed | 4.3 gives the four comment lines and `.animation(.easeIn(duration: 0.3), value: isRunning)`. 5.3 gives the five comment lines. |
| 5 | fixed | 4.5 gives the two comment lines and says the switch button gets the same modifier and comment. |
| 6 | fixed | 3.3 gives `.yellow`, the message text, the place of the case in `color` (after `failed`) and in `message` (between `unauthorized` and `failed`). |
| 7 | fixed | 1.1 gives `@Published private(set) var isInterrupted = false` and the comment. 1.2 says "private" and gives the comment. 2.3 gives `private var isSetUp = false` and the comment. |
| 8 | fixed | 5.1 gives `@Environment(\.scenePhase) private var scenePhase` and `@State private var coverOpacity = 0.0`. |
| 9 | fixed | 4.2 gives `func hidden(until isRunning: Bool) -> some View` and `opacity(isRunning ? 1 : 0)`. 5.2 gives `.overlay(Color.black.opacity(coverOpacity))`. 5.5 gives `withAnimation(.easeIn(duration: 0.3))`. |
| 10 | fixed | 2.2 says two nested `if` statements with `captureSession.isRunning` inside. 2.4 gives the comment and the empty line. |
| 11 | fixed | 3.1, 3.5, 4.4, 4.6, 4.7 give the comment texts. 3.4 names the preview "Interrupted" and the form of the "Failed" preview. |

Counts: fixed 11, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 10, checked on the page: the glossary has no entry for `notifications(named:)` (suggestion 1, still open; see suggestion 2 below). The comment lines are hint lines in the covers now (suggestion 2, resolved by the generator). The two-placeholder covers have no labels (suggestion 3, still open). The validator does not check links against `research/` (suggestion 4, still open).

## New findings

| # | Chapter.step | Persona | Problem | Severity | Fix applied |
|---|--------------|---------|---------|----------|-------------|
| 1 | 9.5.1 | self-implementer | The exact label `Text("HDR \(camera.isHDRVideoEnabled ? "On" : "Off")")` was not given; the caption said only "HDR On" or "HDR Off". `Text(camera.isHDRVideoEnabled ? "HDR On" : "HDR Off")` compiles and differs from the branch. The "texts in this code" hint line of the cover is wrong: it shows `"HDR \(camera.isHDRVideoEnabled ? ", " : ", ")"`, because the hint extractor cannot read a string literal inside an interpolation. | medium | Caption gives the exact `Text` expression and says that the hint line shows the string in three parts. The hint itself is a generator issue (suggestion 1). |
| 2 | 9.3.6 | self-implementer | The form `if isHDRVideoEnabled { setHDRVideoEnabled(true) }` was not given. "turn HDR on again when the state says so" also fits `setHDRVideoEnabled(isHDRVideoEnabled)`, which compiles and differs. | low | Caption gives the three lines, the place after `try addOutput(movieCapture.output)`, and says not to write the one-line form. |
| 3 | 9.4.3 | self-implementer | The loop line `for await capabilities in await captureService.$captureCapabilities.values` and the body line were not given; the loop variable name was not in the text. | low | Caption gives both lines. |
| 4 | 9.4.1 (note) | copier, self-implementer | The note said that the project does not compile, but not at which step it compiles again (4.6). | low | Note says "after step 6 of this section". |
| 5 | 9.3.2 | self-implementer | The cover has two placeholders (the method head; the two lines of the pair and the closing brace), and the caption did not say what goes where. | low | Caption says it. |
| 6 | 10.3.3 | self-implementer, copier | The `color` and `message` lines of the sample start with tab characters, and the two new cases do too on the branch. A learner who types in Xcode gets spaces, and a diff with the branch shows a white-space difference. Chapter 4 said this for the file; this page did not. | low | Caption says that the new lines can start with spaces and that the difference means nothing. |
| 7 | 10.4.4 (note) | self-implementer | The note explained why Git reports the `ThumbnailButton` line, but not what to do with it: the first placeholder and the delete box stand for the same line. A learner can delete the line and type it again, or wonder what the first placeholder is for. | low | Note says to keep the line with spaces, and that only the comment and the modifier are new. |
| 8 | 10.5.3 | self-implementer | The signature `func updateCoverOpacity(_: ScenePhase, _ phase: ScenePhase)` was not given. The name `phase` is needed in 5.4, and a different name differs from the branch. | low | Caption gives the signature and points to `updateBlurRadius(_:_:)` as the model. |
| 9 | 10.5.4 | self-implementer | The form `switch phase`, `case .background:`, `coverOpacity = 1`, `default: break` was not given. An `if phase == .background` or `1.0` compiles and differs. | low | Caption gives the form. |
| 10 | 10.1.3, 10.2.1 | self-implementer | The line form of the loop heads was not given: each `compactMap` on its own line, the opening brace at the end of the last line. A one-line loop differs from the branch. | low | Both captions say it. |

Counts: medium 1, low 9. No main code fence and no `remove` fence changed. No `copy` mark added: the two chapters have no new file.

### Checks that passed

- Copier, chapter 9: `git diff chapter-08 chapter-09` touches 8 Swift files (111 added lines, 3 removed). Every added line is highlighted in a step of the same file. The delete boxes of 2.1, 2.4, and 5.5 cover the three removed lines. No line is highlighted in two steps, and no highlighted line exists on `chapter-08` before the step (the highlighted braces of 3.2, 3.3, 4.3, 4.4, 5.1, 5.3, 5.5 are new lines).
- Copier, chapter 10: `git diff chapter-09 chapter-10` touches 9 Swift files (113 added lines, 2 removed; the hero text says "approximately 110 lines to nine files"). The delete boxes of 3.2 and 4.4 cover the two removed lines. No line is highlighted in two steps. The closing braces of the actor (1.2, 2.1), of `observeState()` (3.5), and of the method in 2.1 are context lines.
- Build gaps: chapter 9 has two (1.3 to 1.5, said in 1.3; 4.1 to 4.6, said in the note, now with the step number) and one warning gap (3.3, said). Chapter 10 compiles between all steps; the warning at 2.1 is said. The empty `Task { }` (10.1.2), the empty `didSet { }` (9.4.4), and the empty method body (10.5.3) compile without a warning.
- Covers: "Inside …" is correct on every step that has it (for example `actor CaptureService › func setHDRVideoEnabled(_ isEnabled: Bool)` on 9.3.3 to 9.3.5, `final class CameraModel: Camera › var isHDRVideoEnabled = false` on 9.4.5, `actor CaptureService › private func observeNotifications()` on 10.1.3 to 10.2.2, `struct PreviewContainer<…>: View › func updateCoverOpacity(_: ScenePhase, _ phase: ScenePhase)` on 10.5.4 and 10.5.5). The top-level steps 9.1.1, 9.1.3, 10.3.4, 10.4.2 show only the file, which is correct. The context line numbers match the branches.
- Placeholders: one per highlighted run after merging. Two or three placeholders on 9.2.1, 9.3.2, 9.3.3, 9.4.1, 9.4.3, 10.1.3, 10.1.4, 10.3.3, 10.3.5, 10.4.1, 10.4.4, 10.5.1; the captions say what goes where (round 1, and findings 5 and 7).
- Hint lines: the covers show the comment lines and the string literals of the solutions (the log text on 9.3.3, the message on 10.3.3, the preview name on 10.3.4, the comment lines on 14 steps). The one wrong hint is finding 1.
- Pictures: `ch10-s3-4.jpg` shows the "Interrupted" preview with the yellow message, the dimmed controls, and all controls visible, which is the state at step 3.4 (before section 4 hides them). `ch10-s4-8-b.jpg` shows the running app with all controls, as the caption says. Chapter 9 has no picture (suggestion 3).
- Glossary: the card "if with a condition list" at 9.3.3 is the first use in chapter order; the glossary pattern does not match the `if case … let` of chapter 7. `??`, `$0`, `defer`, `guard`, `@Published`, `private(set)`, `didSet`, `@ViewBuilder`, `some View`, `Task`, `for await`, `@Environment`, `#Preview`, the key path `\.scenePhase`, and the ternary are `common` or appeared earlier, so no card and no pointer. Chapter 10 has no card, which is correct.
- The section 4 note of chapter 10 is correct: `PreviewCameraModel()` starts with `status = .unknown`, and only `start()` changes it to `.running`, so a toolbar preview shows hidden controls.
- Checkpoints, the three Experiments per chapter, and the quiz answers match the code at each point.

## Suggestions for the generator, the glossary, and the coordinator (not fixable on the pages)

1. **Generator: hint extraction and string interpolation.** The "texts in this code" line uses `/"((?:[^"\\]|\\.)*)"/g` in `src/lib/render.mjs` (line 419). A string with an interpolation that contains a string, such as `"HDR \(camera.isHDRVideoEnabled ? "On" : "Off")"`, is split into three wrong parts. A small scanner that skips `\( … )` with nesting would give one correct hint, or the extractor could drop a line that contains `\(`.
2. **Glossary: `notifications(named:)` as an asynchronous sequence** (round-1 suggestion 1 of chapter 10, still open). The first use is chapter 6, step 3 (`subjectAreaDidChangeNotification`), so the card would land there, and chapters 10 would get a pointer.
3. **Picture for 9.5.6.** Chapter 9 has no picture. A capture with `tools/capture.py` of video mode without the HDR button would show the learner that the empty features toolbar is the correct result.
4. **Coordinator: tab characters on the branches.** `StatusOverlayView.swift` (most lines) and the `ThumbnailButton` line of `MainToolbar.swift` keep the tabs of the Apple sample. Three notes (chapter 4, 10.3.3, 10.4.4) exist only for this. Spaces on all branches would remove the notes and the white-space difference that a learner sees.
5. **Generator: placeholder labels** (round-1 suggestion 3 of chapter 10, still open). Twelve covers on the two pages have two or three placeholders. A label from the instruction would replace the caption sentences of findings 5 and 7 and the round-1 captions.
6. **Replay: the `claims` flag** (round-1 suggestion 4 of chapter 9, still open). Section 5 of chapter 9 still prints `claims=n`, because the Note, Experiment, and Text items follow the last checkpoint.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2d.json && REPLAY_DIR=/tmp/replay-r2d python3 tools/replay.py /tmp/steps-r2d.json ch09-build ch10-build`): chapter 9, sections 1 to 4 `claims=Y build=ok`, section 5 `claims=n build=ok` (suggestion 6; the section builds), end state equals the branch `chapter-09`. Chapter 10, sections 1 to 5 all `claims=Y build=ok`, end state equals the branch `chapter-10`.

## Verdict

**Chapter 9.** Ready for both personas. Every round-1 finding is fixed, and the comment lines are now hints in the covers. The one medium finding of this round is the `Text` label with its interpolation, where the cover hint is wrong; the caption now gives the exact expression, and the hint itself needs the generator fix (suggestion 1). The four low findings are text additions (the `if` form in `setCaptureMode(_:)`, the loop line in `observeState()`, the compile step in the note, the placeholders of 3.2), all applied.

**Chapter 10.** Ready for both personas. Every round-1 finding is fixed. The five new findings are low: the tabs in `StatusOverlayView.swift`, what to do with the `ThumbnailButton` line, the signature of `updateCoverOpacity(_:_:)`, the `switch` form, and the line form of the two loop heads. All are applied. The pictures match the state of their steps. The remaining items are generator, glossary, and coordinator decisions (suggestions 2, 4, 5).
