# Chapter 11 and 12 build pages: learner review, round 2

Date: 15 Oct 2026
Pages: `content/pages/ch11-build.md` (13 steps in 3 sections) and `content/pages/ch12-build.md` (33 steps in 5 sections), rendered as `dist/ch11-build.html` and `dist/ch12-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholders, the comment lines and string literals of the solution as hints, delete boxes), and the Swift notes. The rendered cover of each code step was extracted from the HTML and compared with `git diff chapter-10 chapter-11`, `git diff chapter-11 chapter-12`, and `git show chapter-11:AVCam/CaptureService.swift`. The glossary `src/lib/swift-notes.mjs` was checked for the constructs on the two pages.

Both builds in this round had all "Inside …" texts (10 on chapter 11, 30 on chapter 12). The working tree of the app repository was not touched. The site repository has uncommitted changes to `ch09-build.md` and `ch10-build.md` from another session; this review did not read or touch them. One build in this round came out incomplete (no "Inside …" texts); a second build was complete.

## Verification of the round-1 findings: chapter 11

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | The caption of 1.6 names `.endVideoRecording` and `.beginVideoRecording`, the `?:` operator on two lines, `?` at the end of the first line, and the deeper indentation of the second line. |
| 2 | fixed | The caption of 1.4 gives `let sound: AVCaptureEventSound` without a value, `switch camera.captureMode {`, `case .photo:`, and `sound = .cameraShutter`. |
| 3 | fixed | The caption of 2.2 gives `withAnimation(.easeInOut(duration: 0.25)) { isRecording = newValue }` on three lines and points to `withAnimation` in `MovieCaptureButton` further down in the file. `git show chapter-10:…/CaptureButton.swift` has that call at line 107. |
| 4 | fixed | The caption of 1.6 says that the file compiles, that Xcode shows one warning because nothing reads `sound`, and that step 8 removes it. |
| 5 | fixed | The Text after 3.2 says that chapters 12 and 13 add nothing to `CameraView` and `CaptureButton`. `git diff chapter-11 chapter-13 --stat` on the two files is empty. |
| 6 | fixed | 1.2 says "Name the parameter of the closure `event`". 2.1 gives `_` and `newValue` and says to leave the closure empty. |
| 7 | fixed | The instruction of 1.7 ends with "with `await`". |
| 8 | fixed | The caption of 3.1 says that the property belongs to `captureSession` and asks for an empty line after the new line. |

Counts: fixed 8, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 11, checked on the page: the page still has no Swift card (the glossary has no entry for `let` without a value, and the two-line `?:` form is `common`). Sections 2 and 3 still print `claims=n` in the replay, because the Note, the Experiments, and the Text follow the last checkpoint. Both are generator and tool items.

## Verification of the round-1 findings: chapter 12

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | The caption of 1.4 gives `let lensSlider = AVCaptureSlider("Lens Position", symbolName: "circle.dotted.circle", in: 0...1)` and the warning until the next step. The cover also shows the two strings as a hint line. |
| 2 | fixed | 2.2 gives `sessionControlsDidBecomeActive(_ session: AVCaptureSession)` and `sessionControlsDidBecomeInactive(_ session: AVCaptureSession)`, the two log texts, and says the project compiles only after the next step. 2.3 gives `sessionControlsWillExitFullscreenAppearance(_ session: AVCaptureSession)`, the order "set the property, then log", the two log texts, and the empty line. |
| 3 | fixed | The caption of 1.2 gives `func createControls(for device: AVCaptureDevice) -> [AVCaptureControl]` without `private`, `guard let controls = controlsMap[device.uniqueID] else { }`, and `return controls` after the block. |
| 4 | fixed | The caption of 4.4 gives `var prefersMinimizedUI: Bool { get }` and says that the project does not compile until both models have the property, two steps later. |
| 5 | fixed | The caption of 1.3 gives `var controls = [` with the two initializers, says why `var`, names the warning, and explains that the inner variable does not clash with the `guard` binding. |
| 6 | fixed | The caption of 3.1 gives `private func configureControls(for device: AVCaptureDevice)`, the empty line after the brace, and `else { return }` on one line. |
| 7 | fixed | 1.6 gives `device.setFocusModeLocked(lensPosition: lensPosition)` without the completion handler and `logger.info("Unable to change the lens position: \(error)")`. 3.4 gives `logger.info("Unable to add control \(control).")`. |
| 8 | fixed | The caption of 4.1 gives `@Published var isShowingFullscreenControls = false` and says "without `private(set)`". |
| 9 | fixed | 2.1 gives the class head and `@Published private(set) var isShowingFullscreenControls = false`. 2.4 gives `private var controlsDelegate = CaptureControlsDelegate()` with `var`. |
| 10 | fixed | 1.5 gives `lensSlider.setActionQueue(sessionQueue) { lensPosition in` and the type `Float`. 4.7 gives the `for await` line with `isShowingFullscreenControls` and the warning. |
| 11 | fixed | 3.3 names `removeControl(_:)`. 4.2 says `private` and gives `.assign(to: &$isShowingFullscreenControls)`. |
| 12 | fixed | The caption of 5.1 says that the sample puts four spaces on the empty line above `@State var camera` and that `git diff chapter-12` can show it. |

Counts: fixed 12, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 12, checked on the page: the glossary still has no entry for `&$name` (the `inout-argument` pattern `&\w` does not match `&$`), so 4.2 has no card. The cover now shows string literals as hints ("texts in this code: …" on 1.4, 1.6, 2.2, 2.3, 3.4), so suggestion 3 of round 1 is done by the generator. Section 5 still prints `claims=n`.

## New findings (round 2)

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 12.1.1 | self-implementer | The declaration of `controlsMap` was not given: not the access level, not the type `[String: [AVCaptureControl]]`, not the start value `[:]`. The caption named only the key and the value in words. The cover shows no hint for a declaration line. | medium | The caption gives `private var controlsMap: [String: [AVCaptureControl]] = [:]`. |
| 2 | 12.5.2 | self-implementer | The modifier line `.opacity(camera.prefersMinimizedUI ? 0 : 1)` was not written anywhere on the page. The instruction said "set the opacity … to zero", so `? 0.0 : 1.0`, `if`-based code, or `Double(…)` forms were all possible. Steps 5.3 and 5.4 said "the opacity modifier" and depended on it. | medium | The caption of 5.2 gives the line and says that it goes under each of the two views with its comment line above it. 5.3 and 5.4 say that the modifier is the same line as in step 2. |
| 3 | 12.4.8 | self-implementer | `withAnimation` without arguments was not said. Chapter 11 used `withAnimation(.easeInOut(duration: 0.25))`, so a learner who carries that form over gets a different file. The three-line form was not said. | low | The caption gives `withAnimation {`, the assignment, and the closing brace on three lines, and says that it has no arguments here. |
| 4 | 12.4.6 | self-implementer | `private(set) var prefersMinimizedUI = false` was not written out. The caption said "the setter is private", and the value `false` was only in the step for the preview model. | low | The caption gives the declaration. |
| 5 | 12.1.7 | self-implementer | `append(_:)` was not named; the instruction said "add the slider to the array". `controls += [lensSlider]` or `controls.insert` give a different file. | low | The caption gives `controls.append(lensSlider)`. |
| 6 | 11.1.3 | self-implementer | The `if` form was not said. In a closure, `guard event.phase == .ended else { return }` is a natural choice, and it gives a different structure for all later steps. The cover of 1.4 is the first place that shows `if event.phase == .ended {`. | low | The caption says to write `if event.phase == .ended {` with its closing brace, and that all later lines of the closure go inside this block. |

Counts: medium 2, low 4. No copier finding in this round.

### Checks that passed

- Copier, chapter 11: 31 added lines in three files, 0 removed, no new file. The 21 highlighted lines of the closure are covered one time each (1.2: 3, 1.3: 2, 1.4: 5, 1.5: 2, 1.6: 3, 1.7: 2, 1.8: 4). Each closing brace is highlighted only in the step that adds it. No highlighted line exists on `chapter-10`. The build gap (1.4 to 1.5) and the warning gap (1.6 to 1.7) are said in the captions.
- Copier, chapter 12: 135 added lines in seven files, 2 removed lines (one comment with a delete box in 5.3, one white-space line said in 5.1). No line is highlighted in two steps; the runs of 1.2 to 1.8, 2.1 to 2.3, 3.1 to 3.5, and 4.7 to 4.8 are disjoint. The `remove` box of 5.3 does not appear as context in the main fence. The build gaps (1.2, 2.1 to 2.2, 4.4 to 4.5) and the warning gaps (1.3, 1.4, 4.7) are said. `logger` is a global constant in `AVCamApp.swift` on `chapter-11`.
- Covers: "Inside …" is correct on all 10 covers of chapter 11 and on the 28 covers of chapter 12 that have it. The covers at file level (12.2.1, 12.5.1) have none, which is correct. The string hints on chapter 12 match the branch.
- The queue rule: `sessionQueue` is the `unownedExecutor` of `CaptureService` on `chapter-11` (lines 60 to 64), so the captions of 12.1.5 and 12.3.5 are correct. The four delegate methods match `AVCaptureSessionControlsDelegate`.
- `hidden(until:)` in `ViewExtensions.swift` uses `opacity(isRunning ? 1 : 0)`, so the caption of 12.5.2 about the two opacities is correct.
- Chapter 11, 2.2: `isRecording` is a `@State` of `CaptureButton` and a `@Binding` of `MovieCaptureButton` on `chapter-10`.
- The checkpoints and the quiz answers match the code at each point.
- Glossary: neither page has a Swift card or a pointer. The constructs on the pages (`switch`, `?:`, `guard`, `@Published`, `private(set)`, `for await`, `Task`, `defer`, `withAnimation`) are `common` or have no entry.

## Suggestions (not fixable on the pages)

1. **Glossary: `&$name`.** Still open from round 1 of chapter 12. The `inout-argument` pattern does not match `&$isShowingFullscreenControls` in 12.4.2.
2. **Glossary: `let` without a value, and the closed range `0...1`.** 11.1.4 declares `let sound: AVCaptureEventSound` without a value. 12.1.4 uses `in: 0...1`. Neither has an entry.
3. **Generator: a warning gap and a compile gap.** Five captions on the two pages say "does not compile until …" or "Xcode shows a warning until …". A fence attribute would render a standard note (open since the chapter 9 review).
4. **Generator: declaration lines as hints.** Three of the six new findings are declaration lines (`controlsMap`, `prefersMinimizedUI`, the `opacity` modifier). The cover shows comment lines and string literals as hints. A hint for the first highlighted line of a property declaration (name and type, without the value) would remove this class of finding.
5. **Replay: the `claims` flag.** Sections 11.2, 11.3, and 12.5 print `claims=n` because a Note, Experiment, or Text follows the last checkpoint.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2e.json && REPLAY_DIR=/tmp/replay-r2e python3 tools/replay.py /tmp/steps-r2e.json ch11-build ch12-build`): chapter 11, section 1 `claims=Y build=ok`, sections 2 and 3 `claims=n build=ok`, end state equals the branch `chapter-11`. Chapter 12, sections 1 to 4 `claims=Y build=ok`, section 5 `claims=n build=ok`, end state equals the branch `chapter-12`.

## Verdict

**Chapter 11.** Ready for both personas. All eight round-1 findings are fixed. The one new finding (the `if` form in 1.3) is a low item, applied. The copier has one paste place per step, no duplicate line, and no delete box to handle. The self-implementer has every identifier, type, sound name, argument label, modifier value, and `await` in the text or in the cover hints.

**Chapter 12.** Ready for both personas after this round. All twelve round-1 findings are fixed. Round 2 found five text gaps for the self-implementer (two medium: the `controlsMap` declaration and the `opacity` modifier line; three low), all applied. No copier finding. The remaining items are glossary and generator work (suggestions 1 to 4).
