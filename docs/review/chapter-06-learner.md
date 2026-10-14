# Chapter 6 build page: learner review

Date: 14 Oct 2026
Page: `content/pages/ch06-build.md` (21 steps in 4 sections before the review, 22 after it), rendered as `dist/ch06-build.html` after `node src/build.mjs`.

## Method

The same two personas as in the chapter 2 and 3 reviews went through all steps.

- **The copier** reads the code card, pastes the highlighted lines at the place the fence shows, and builds at each checkpoint. Checked: is the place clear, is anything needed that no step says (folder, file, import, target, Xcode action, deletion), do the delete boxes cover every line that `git diff chapter-05 chapter-06` removes or moves.
- **The self-implementer** uses the "Try first" mode. This person sees the instruction, the caption, the cover (file, "Inside …", context lines, placeholder), and the Swift notes, but not the code. Checked: does the text give each new identifier with its type, access level, `async`/`throws`, and parameters; does it name each AVFoundation API that the solution calls (focus and exposure modes, points of interest, support tests, device lock, the coordinate conversion of the preview layer, the gesture); do boilerplate steps have the `copy` mark and a spec.

The cover text of each step was extracted from the rendered HTML and compared with `git show chapter-06:AVCam/CaptureService.swift` and the diff. The findings were fixed on the page in the same pass (instructions and captions; one checkpoint step added; no code fence changed). Then `npm run validate` and the replay ran.

## Findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 4.1 | self-implementer | The instruction does not say that the protocol method is `async`. The solutions of 4.2 and 4.4 depend on it (`await`, `Task`). The learner writes a synchronous requirement and must change it later. | medium | Instruction: "add the `async` method `focusAndExpose(at point: CGPoint)`". Caption says why. |
| 2 | 1.4 | self-implementer | The two support tests `isFocusPointOfInterestSupported` and `isFocusModeSupported(_:)` are not named. The caption says "the two tests" and the quiz names one of them. | medium | Caption names both, with links. |
| 3 | 1.5 | self-implementer | `.autoExpose`, `.continuousAutoExposure`, the `exposureMode` property, `isExposurePointOfInterestSupported`, `isExposureModeSupported(_:)`, and the constant `exposureMode` are not named. The case names cannot be guessed from the focus names (`autoExpose`, not `autoExposure`). | medium | Caption names the two cases, the two properties, the two tests; instruction names the constant. |
| 4 | 3.1 | self-implementer | The property name `subjectAreaChangeTask`, the parameter `of device: AVCaptureDevice`, `private` for both, and the place of the property (below the method) are not given. Steps 3.2 and 3.3 use the names. | medium | Instruction names the method, the property, `private`, and "below it". Caption gives the parameter and `Task<Void, Never>?`. |
| 5 | 2.3 | self-implementer | The log message text is not given. The checkpoint 4.5 looks for "Unable to perform focus and exposure operation" in the console, so the text is load-bearing. `do`/`catch` and `logger.debug(_:)` are not named. | medium | Caption names `do`, `catch`, `logger.debug(_:)`, the message, and says the checkpoint looks for it. |
| 6 | 1.1 | self-implementer | The full signature (`private`, `at devicePoint: CGPoint`, `isUserInitiated: Bool`), the constant name `device`, and the `MARK` text are not given. Step 2.1 refers to "the `MARK` comment". The section intro gives `private` and the base name only. | low | Caption gives the signature and the `MARK` text; instruction names the constant `device`. |
| 7 | 1.3 | self-implementer | The constant name `focusMode` and the full type `AVCaptureDevice.FocusMode` are not written; the caption only says "its full type name". | low | Instruction names `focusMode`; caption writes `AVCaptureDevice.FocusMode.autoFocus`. |
| 8 | 2.1, 2.2 | self-implementer | 2.1: the parameter `at point: CGPoint` is not written; the text does not say that the method is not `async`. 2.2: the constant `devicePoint` is not named (2.3 uses it). | low | 2.1 gives `func focusAndExpose(at point: CGPoint)` and says why it is not `async`. 2.2 names `devicePoint`. |
| 9 | 3.2 | self-implementer | `NotificationCenter.default`, `AVCaptureDevice.subjectAreaDidChangeNotification` (only the section intro links it), and the `for await _ in` form are not in the step. | low | Caption names all three. |
| 10 | 4.2 | self-implementer | `async` and "await the same method of `captureService`" are not in the instruction; the caption mentions `await` only. | low | Instruction says both. |
| 11 | section 2 | copier | The section has no checkpoint. The replay reported `claims=n` for it. The two overloads with the same base name are a place where a self-implementer can get a compile error. | low | Added step 2.4 "Build the project" with a Checkpoint settings fence. |
| 12 | 1.1, 1.2 | self-implementer, generator | The cover shows two "// your code goes here" lines for one step, because the `highlight=` has a gap on a blank line (`4,6-9` and `5-6,8-9`). The learner may think that two separate pieces go in two places. | low | Not fixable on the page. See generator suggestion 1. |

Counts: high 0, medium 5, low 7.

### Checks that passed

- Copier: `git diff chapter-05 chapter-06` touches 5 Swift files and only adds lines (77 insertions, 0 deletions). No line moves. No `remove` fence is needed, and the page has none. The project file does not change.
- Copier: every paste place is clear in all steps. 1.1 names the property above and shows the `// MARK: - Photo capture` line below. 3.1 shows the property after the method, as in the branch. 3.4 and 3.5 name the line above ("after the line that creates the rotation coordinator"). 4.1 to 4.4 name the member above or below. No import is missing: `Camera.swift`, `CameraModel.swift`, and `PreviewCameraModel.swift` import `SwiftUI`, which brings `CGPoint`. No target, Info.plist, or Xcode action is needed.
- Copier: no step needs code from a later step. The caption of 4.1 says that the project does not compile until 4.3.
- Checkpoints 1.7, 3.6, and 4.5 are consistent with the code at that point. 4.5 says honestly what the Simulator can and cannot show.
- Covers: "Inside …" and the context lines are correct on every step. The enclosing type is `actor CaptureService`, `protocol Camera`, `final class CameraModel`, `class PreviewCameraModel`, `struct CameraView`, and the method is right where the code goes inside a method (1.2 to 1.6, 2.2, 2.3, 3.2, 3.3, 3.4, 3.5, 4.4). No step creates a file, so no "create the new file" cover appears.
- Self-implementer, APIs: `lockForConfiguration()` and `unlockForConfiguration()` (1.2), `focusPointOfInterest` and `focusMode` (1.4), `isSubjectAreaChangeMonitoringEnabled` (1.6), `captureDevicePointConverted(fromLayerPoint:)` and `videoPreviewLayer` (2.2), `notifications(named:object:)` and `compactMap` (3.2), `(0.5, 0.5)` and `try?` (3.3), `onTapGesture` with the location closure and `Task` (4.4) were all named before the review.
- Boilerplate: no step is a boilerplate file, so no `copy` mark is needed.
- Swift notes: the page has no Swift note card and no pointer. The constructs on the page (`Task { }`, `try?`, `for await`, optional chaining, `Task<Void, Never>`) are either `common` entries or have no glossary entry (see suggestions). Nothing on the page is wrong because of this.
- The two diagrams (sections 1 and 2) are at the right sections. The second diagram shows the conversion that step 2.2 explains.
- The Note after 1.6 (`defer`) and the two Experiments are correct for the code and say to set the code back.

## Suggestions for the generator or glossary

1. **Generator: one placeholder per step.** When the highlighted lines of a step are separated only by blank lines that are not highlighted (1.1 `4,6-9`, 1.2 `5-6,8-9`), the cover shows two "// your code goes here" lines next to each other. Merge adjacent placeholders when only blank lines lie between the highlighted groups.
2. **Glossary: `try?`.** First use in chapter 2; used again at 3.3 here. Suggested `common` entry: pattern `/\btry\?/`, text: "Runs a throwing call and gives `nil` instead of an error. Use it when nobody can act on the error."
3. **Glossary: `for await`.** First use in chapter 2 (`AsyncStream`); used at 3.2 here on a sequence from `notifications(named:object:)`. Suggested `common` entry: pattern `/\bfor\s+await\b/`, text: "A loop over an asynchronous sequence. The loop waits for each value and ends when the sequence ends or the task is cancelled."
4. **Glossary: `Task<Void, Never>`.** Step 3.1 is the first place where a task type is written out. A short `common` entry for the two generic parameters (the result type and the error type) would help; the caption of 3.1 explains it in words now.
5. **Replay tool: count a "Run" checkpoint as a claim.** Section 4 ends with a Run checkpoint, and the replay reports `claims=n` for it. The build still ran and passed.
6. **Validator rule for identifiers (from the chapter 2 review).** Five of the findings here are names that the solution uses and the text did not give. A rule that checks each declared identifier of a highlighted line against the step text would find these before a review.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings. `--budget`: the page has 22 steps (budget 25 to 45) and section 2 has 4 steps (budget 5 to 10); no instruction is over 25 words.
- Replay (`node src/dump-steps.mjs > /tmp/steps-ch06.json && REPLAY_DIR=/tmp/replay-ch06 python3 tools/replay.py /tmp/steps-ch06.json ch06-build`): sections 1, 2, 3 `claims=Y build=ok`; section 4 `claims=n build=ok` (Run checkpoint, see suggestion 5); end state equals the branch `chapter-06`.
