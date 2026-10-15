# Chapter 10 build page: learner review

Date: 15 Oct 2026
Page: `content/pages/ch10-build.md` (33 steps in 5 sections: 28 code steps and 5 checkpoints), rendered as `dist/ch10-build.html` after `node src/build.mjs`.

## Method

The same two personas as in the reviews of chapters 2 to 8 went through all 33 steps.

- **The copier** reads the code card and the delete boxes, pastes the highlighted lines at the place the fence shows, and builds at each checkpoint. Checked: is the place clear, is anything needed that no step says (import, Xcode action, deletion), do the delete boxes cover every line that `git diff chapter-09 chapter-10` removes or changes, is any line highlighted in two steps, does a highlighted run contain a line that already exists.
- **The self-implementer** uses the "Try first" mode. This person sees the instruction, the caption, the cover (file, "Inside …", context lines, placeholder, delete box), and the Swift notes, but not the code. Checked: does the text give each new identifier with its type, access level, and parameters; does it name each notification, `userInfo` key, API, and SwiftUI modifier with its arguments (the three notifications, the two keys, the interruption reasons, the deferred start properties, `hidden(until:)`, `overlay`, `onChange`, `ScenePhase`); does it give the comment texts that the branch contains, so that the file equals the branch at the end.

The cover text of each of the 28 code steps was extracted from the rendered HTML and compared with the diff and with `git show chapter-09:<file>`. `PreviewCameraModel(status:)` and the dark gray text color for yellow in `StatusOverlayView` (step 3.3) were confirmed on `chapter-09`. The findings were fixed on the page in the same pass (captions and two instructions; no code fence, `remove` fence, or `copy` mark changed). Then `npm run validate` and the replay ran.

## Findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 1.3 | self-implementer | The notification name `AVCaptureSession.wasInterruptedNotification`, the two reason cases `.audioDeviceInUseByAnotherClient` and `.videoDeviceInUseByAnotherClient`, the cast `as AnyObject?` with `$0.integerValue`, and `InterruptionReason(rawValue:)` were not given. The caption named only the key and the reason type. None of these names can be guessed. | high | The caption gives the `for await reason in` loop with the notification name, the two `compactMap` expressions, the `contains` line with the two cases, and the comment line. |
| 2 | 4.1 | self-implementer | The two deferred start properties `automaticallyRunsDeferredStart` and `isDeferredStartEnabled` were not named; the caption named only `isDeferredStartSupported`. The places of the two lines (after `sessionPreset`; between the "Add the photo capture output" comment and `addOutput`) and the three comment lines were not given. | high | The caption names both properties with their documentation links (verified in `research/`), the owner of each one, the two places, and says that the three comment lines of the solution go above the first line. |
| 3 | 1.4, 2.1 | self-implementer | The notification names `AVCaptureSession.interruptionEndedNotification` and `AVCaptureSession.runtimeErrorNotification` were not given. 2.1 named the key and `AVError` but not the loop form. | medium | Both captions give the `for await` loop with the notification name; 2.1 gives `as? AVError`; 1.4 gives the comment. |
| 4 | 4.3, 5.3 | self-implementer | The documentation comments (four lines on `hidden(until:)`, five lines on `updateCoverOpacity(_:_:)`) were not given, although the instructions say "add the documentation comment". The learner cannot reach the branch text. `.easeIn` was not named on 4.3. | medium | Both captions give the comment lines in order. 4.3 gives `.animation(.easeIn(duration: 0.3), value: isRunning)`. |
| 5 | 4.5 | self-implementer | "Add the comment above the capture button" did not give the two comment lines. The modifier and the comment for `SwitchCameraButton` were not said. | medium | The caption gives both comment lines and says that the switch button gets the same modifier and comment as the thumbnail button. |
| 6 | 3.3 | self-implementer | The message text for the `interrupted` status was not given in the step (it appeared only in the Experiment after the checkpoint). The place of the case in `message` (between `unauthorized` and `failed`, not after `failed` as in `color`) was not said; the cover shows two placeholders. | medium | The caption gives `.yellow`, the message string, and the place of the case in each `switch`. |
| 7 | 1.1, 1.2, 2.3 | self-implementer | The declarations were incomplete: `private(set)` and `= false` on `isInterrupted` (1.1), `private` and the doc comment on `observeNotifications()` (1.2), `private var isSetUp = false` with its comment (2.3). | medium | The captions give the full declarations and the comment texts. 1.2 says "private" in the instruction. |
| 8 | 5.1 | self-implementer | `private` and the start value `0.0` (a `Double`) were not given. A learner who copies the form of `blurRadius` writes `CGFloat.zero`, which compiles but differs from the branch. | low | The caption gives both declarations. |
| 9 | 4.2, 5.2, 5.5 | self-implementer | The parameter name `isRunning`, the return type `some View`, and the body `opacity(isRunning ? 1 : 0)` (4.2); the form `.overlay(Color.black.opacity(coverOpacity))` (5.2); `withAnimation(.easeIn(duration: 0.3))` (5.5) were not given. | low | The captions give them. |
| 10 | 2.2, 2.4 | self-implementer | 2.2 did not say that the sample nests two `if` statements and checks `isRunning` first. 2.4 did not give the comment "Return early if already set up." and the empty line after the guard. | low | The captions give the form and the comments. |
| 11 | 3.1, 3.4, 3.5, 4.4, 4.6, 4.7 | self-implementer | Comment texts were not given (the `interrupted` case comment; the two comments in the model task; the three different "Hide …" comments). The preview name "Interrupted" was not in the instruction of 3.4. | low | The captions give the comments. 3.4 names the preview and says it has the form of the "Failed" preview. |

Counts: high 2, medium 5, low 4.

### Checks that passed

- Copier: `git diff chapter-09 chapter-10` touches nine Swift files; no new file. The two removed lines (`handled` in `StatusOverlayView.swift`, the `ThumbnailButton` line with its tab change in `MainToolbar.swift`) have delete boxes (3.2, 4.4), and the note on 4.4 explains the tab characters.
- Copier: no line is highlighted in two steps. The splits 1.3/1.4, 2.1/2.2, 4.2/4.3, 4.4/4.5, 5.4/5.5 are correct. No highlighted run contains a line that already exists on `chapter-09` (the `}` on 3.4 and the method `}` on 2.1 are context lines).
- Copier: every paste place is clear in all 28 code steps. No import, target, or Xcode action is missing.
- Copier: the project compiles between all steps. An empty `Task { }` (1.2) and an empty method body (5.3) compile. 2.1 gives a warning about the unused `error`, and the caption says so.
- Copier: the checkpoints 1.6, 2.6, 3.6, 4.8, 5.7 are consistent with the code at that point, and each one says what the Simulator can show. The three Experiments and the checkpoint 5.7 say that the tutorial did not test the recovery, the interruption, and the cover.
- Covers: "Inside …" is correct on 25 of the 28 covers (for example `actor CaptureService › private func observeNotifications()` on 1.3, 1.4, 2.1, 2.2; `actor CaptureService › private func setUpSession() throws` on 1.5, 2.4, 2.5, 4.1; `struct StatusOverlayView: View › var color: Color` on 3.3; `struct PreviewContainer<…>: View › func updateCoverOpacity(_: ScenePhase, _ phase: ScenePhase)` on 5.4, 5.5). The three covers without "Inside …" (3.4, 4.2 at file level; 4.3 shows `extension View`) are correct.
- Placeholders: 3.3, 4.1, 4.3, 4.5, 5.1 have two placeholders, and the text now says what goes where (findings 2, 4, 5, 6, 8).
- Swift notes: the page has no card and no pointer. `for await`, `Task`, `@Environment`, `compactMap` with `$0`, `switch`, `guard`, `#Preview`, and the ternary operator are `common` or appeared in earlier chapters.
- The two diagrams (`ch10-session-states.svg`, `ch10-deferred-start.svg`) are at the right sections.
- The quiz answers match the code and the captions.

## Suggestions for the generator and the glossary

1. **Glossary: `NotificationCenter.notifications(named:)` as an asynchronous sequence.** Steps 1.3, 1.4, and 2.1 are the first use of `for await` over a notification sequence with `compactMap`. The `for await` entry is `common`, so the learner gets no card. A short entry (pattern `/notifications\(named:/`, title "Notifications as a sequence", text: "`NotificationCenter.notifications(named:)` gives an `AsyncSequence`. `compactMap` on it drops the elements for which the closure returns `nil`.") would help the self-implementer with the two `compactMap` calls.
2. **Generator: comment lines in a highlighted run.** Eleven of the findings here are comment texts that the branch contains and that the self-implementer cannot know. The cover could show the comment lines of the solution as context (they carry no code), or the validator could ignore pure comment lines when it compares the learner's file with the branch. Either change would make most of the "comment text" captions on this page and on the chapter 7 and 8 pages unnecessary.
3. **Generator: two placeholders in one cover.** 3.3, 4.1, 4.5, and 5.1 have two placeholders. A short label on each placeholder (for example the first words of the instruction part) would tell the learner what goes where without a caption sentence.
4. **Validator: links.** The page now has two new links to Apple documentation (`automaticallyRunsDeferredStart`, `isDeferredStartEnabled`). Both are in `research/01-capture-pipeline.md`. A validator check that each external `developer.apple.com` link on a page appears in `research/` would make this rule automatic.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-ch10.json && REPLAY_DIR=/tmp/replay-ch10 python3 tools/replay.py /tmp/steps-ch10.json ch10-build`): sections 1 to 5 all `claims=Y build=ok`; end state equals the branch `chapter-10`.
