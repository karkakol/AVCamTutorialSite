# Chapter 11 build page: learner review

Date: 15 Oct 2026
Page: `content/pages/ch11-build.md` (13 steps in 3 sections: 10 code steps, 1 review step, and 2 checkpoints), rendered as `dist/ch11-build.html` after `node src/build.mjs`.

## Method

The same two personas as in the reviews of chapters 2 to 10 went through all 13 steps.

- **The copier** reads the code card and the delete boxes, pastes the highlighted lines at the place the fence shows, and builds at each checkpoint. Checked: is the place clear, is anything needed that no step says (import, Xcode action, deletion), do the delete boxes cover every line that `git diff chapter-10 chapter-11` removes or changes, is a line highlighted in two steps, is a highlighted line one that the learner already has, does the project build between steps.
- **The self-implementer** uses the "Try first" mode. This person sees the instruction, the caption, the cover (file, "Inside …", context lines, placeholder, and the comment lines of the solution as hints), and the Swift notes, but not the code. Checked: does the text give each new identifier with its type, parameters, and `await`; does it name each API, each sound identifier, each parameter name of a closure, and each SwiftUI modifier with its arguments (`onCameraCaptureEvent(defaultSoundDisabled:action:)`, `AVCaptureEvent.phase`, `AVCaptureEventSound` with `.cameraShutter`, `.beginVideoRecording`, `.endVideoRecording`, `shouldPlaySound`, `play(_:)`, `onChange(of:)`, `withAnimation`, `configuresApplicationAudioSessionForBluetoothHighQualityRecording`); does the text say when the project does not compile or compiles with a warning between steps.

The cover text of each of the 10 code steps was extracted from the rendered HTML and compared with the diff and with `git show chapter-10:<file>`. The claims about `shouldPlaySound`, the 15 second limit of `play(_:)`, the three sound names, `isSwitchingModes`, and the property of the capture session were checked in `research/04-system-integration.md` and `research/01-capture-pipeline.md`. The findings were fixed on the page in the same pass (captions, one instruction, and one Text; no code fence, no `remove` fence, and no `copy` mark changed, because the chapter has no new file and no removed line). Then `npm run validate` and the replay ran.

## Findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 1.6 | self-implementer | The two sound identifiers `.endVideoRecording` and `.beginVideoRecording` were not named; the text said only "the end sound" and "the begin sound". The form (the `?:` operator on two lines, `?` at the end of the first line) was not said. A learner who writes `if`/`else` or one line gets a different file. | high | The caption names both identifiers and the two-line form. |
| 2 | 1.4 | self-implementer | The name `sound` of the constant was not given; the instruction said "a constant for the sound". The type was in the caption, but the lines `switch camera.captureMode {`, `case .photo:`, and `sound = .cameraShutter` were not written out. | medium | The caption gives `let sound: AVCaptureEventSound` and the three lines. |
| 3 | 2.2 | self-implementer | `withAnimation(.easeInOut(duration: 0.25))` was not named. The caption said "the same curve and the same duration as the animation that the button uses for a tap", so the learner had to search `MovieCaptureButton` further down in the file. | medium | The caption gives the call on three lines and says where the tap animation is. |
| 4 | 1.6, 1.7 | self-implementer, copier | After 1.6 the file compiles again, but with one warning, because nothing reads `sound` until 1.8. No step said so. | medium | The caption of 1.6 says that the file compiles, that Xcode shows one warning, and that step 8 removes it. |
| 5 | Text after 3.2 | both | "`CameraView` and `CaptureButton` are now the same as the files of Apple's sample" is wrong: `git diff chapter-11 chapter-18` changes both files (the dual mode of chapters 14 to 18). Only chapters 12 and 13 leave them unchanged. | medium | The Text says that chapters 12 and 13 add nothing to the two files. |
| 6 | 1.2, 2.1 | self-implementer | The parameter names of the closures were not given: `event` in `onCameraCaptureEvent` (the cover of 1.3 uses it), and `newValue` in `onChange` (the cover of 2.2 uses it). 2.1 did not say that the closure stays empty. | low | Both captions give the names; 2.1 says to leave the closure empty. |
| 7 | 1.7 | self-implementer | `await` before `toggleRecording()` was not said. 1.5 explains `await` for `capturePhoto()`, so most learners carry it over. | low | The instruction says "with `await`". |
| 8 | 3.1 | self-implementer | The receiver `captureSession` was not named (the cover shows only `deviceLookup` lines), and the empty line after the new line was not said. The diff adds that empty line. | low | The caption names `captureSession` and the empty line. |

Counts: high 1, medium 4, low 3.

### Checks that passed

- Copier: `git diff chapter-10 chapter-11` touches three Swift files, 31 added lines (one of them empty), 0 removed lines. No new file, so no `copy` mark and no `remove` fence is needed. The project file does not change.
- Copier: no line is highlighted in two steps. The 21 lines of the closure in `CameraView.swift` are covered one time each across 1.2 to 1.8. The closing braces are highlighted in the step that adds them (1.2 the closure, 1.3 the `if`, 1.4 the `switch`, 1.8 the `if`), and they are context lines in all later steps. No highlighted line is one that the learner already has.
- Copier: every paste place is clear. 1.2 says "as its first modifier" and the cover shows `CameraPreview` above and `onTapGesture` below. 2.1 shows `.frame` above and the closing brace of `body` below. 3.1 shows the `deviceLookup` lines above and the "Add inputs" comment below.
- Copier: 1.1 is a review step without highlight; the three imports exist on `chapter-10`. The gap inside section 1 (1.4 and 1.5 do not compile: the `switch` is not exhaustive) is said in the caption of 1.4. The empty closures of 1.2 and 2.1 compile.
- Copier: the checkpoints 1.9 and 3.2 are consistent with the code. Both say that the Simulator shows nothing new and that the tutorial did not test the chapter on an iPhone. Section 2 has no checkpoint; the two steps are one modifier, and 3.2 covers them.
- Self-implementer: the comment lines of the solution now appear in the covers as hints (1.2, 1.5, 1.7, 1.8, 2.1, 2.2, 3.1), so no comment text is a finding on this page.
- Self-implementer: the APIs are named with their arguments: `onCameraCaptureEvent(defaultSoundDisabled: true)` (1.2), `event.phase == .ended` (1.3), `.cameraShutter` (1.4), `await camera.capturePhoto()` (1.5), `camera.captureActivity.isRecording` (1.6), `shouldPlaySound` and `play(_:)` with `sound` (1.8), `onChange(of: camera.captureActivity.isRecording)` with `_` (2.1), `captureSession.configuresApplicationAudioSessionForBluetoothHighQualityRecording = true` (3.1).
- Covers: "Inside …" is correct on all 10 covers (`struct CameraView<CameraModel: Camera>: PlatformView › var body: some View` on 1.2 to 1.8; `struct CaptureButton<CameraModel: Camera>: View › var body: some View` on 2.1 and 2.2; `actor CaptureService › private func setUpSession() throws` on 3.1). Each cover has one placeholder.
- Swift notes: the page has no card and no pointer. `switch`, `async` closures, `withAnimation`, and the `?:` operator have no entry or are `common`. See suggestion 1.
- The diagram `ch11-event-sources.svg` is at section 1, and its alt text matches the text about primary and secondary events.
- The claims in the captions match `research/04-system-integration.md`: `shouldPlaySound` is `true` only for an AirPods stem click with the default sound disabled; `play(_:)` does nothing after 15 seconds; the three sound names; `isSwitchingModes` exists on the `Camera` protocol at `chapter-10` (second Experiment).
- The quiz answers match the code and the captions.

## Suggestions for the generator and the glossary

1. **Glossary: a constant without a value, and the `?:` operator.** Step 1.4 writes `let sound: AVCaptureEventSound` without a value and assigns it in each `switch` case. The glossary has no entry for this form. Suggested entry: pattern `/\blet\s+\w+\s*:\s*[A-Z]\w*\s*$/m`, title "let without a value", text: "A constant can get its value later, one time. The compiler checks that every path assigns it before the first read." Step 1.6 writes the `?:` operator on two lines. If an earlier chapter has `common` use of `?:` (chapter 10 has `opacity(isRunning ? 1 : 0)`), a `common` entry with the pattern `/\?\s*$/m` would at least mark the two-line form.
2. **Generator: a step that compiles with a warning.** Steps 1.6 and 1.7 build with one warning (`sound` never read) until 1.8. As in the chapter 9 review (suggestion 2), a `warnings` attribute on the fence would render a standard note, and the caption would not need the sentence.
3. **Generator: closure parameter names on the cover.** Three findings here (6, and the `event` part of 1.3's dependency) are names of closure parameters that a later cover shows but the step that writes them does not. When a highlighted line ends with `in`, the cover could show that line as a hint, like it does for comment lines, because the parameter names carry no logic.
4. **Replay: the `claims` flag.** Section 2 has no checkpoint, and section 3 ends with a Note, two Experiments, and a Text after the checkpoint. The replay prints `claims=n` for both. The flag should look for the last checkpoint step of the section, not the last items (same as suggestion 4 of the chapter 9 review).
5. **Content budget.** The page has 13 steps in 3 sections (section 2 has 2 steps). The budget says 25 to 45 steps and 5 to 10 steps per section. The chapter is small (31 lines), so the page cannot reach the budget without padding. The budget note could allow a smaller page when the diff is under 50 lines.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-ch11.json && REPLAY_DIR=/tmp/replay-ch11 python3 tools/replay.py /tmp/steps-ch11.json ch11-build`): section 1 `claims=Y build=ok`; sections 2 and 3 `claims=n build=ok` (see suggestion 4; both sections build); end state equals the branch `chapter-11`.
