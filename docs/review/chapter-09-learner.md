# Chapter 9 build page: learner review

Date: 15 Oct 2026
Page: `content/pages/ch09-build.md` (31 steps in 5 sections: 25 code steps and 6 checkpoints), rendered as `dist/ch09-build.html` after `node src/build.mjs`.

## Method

The same two personas as in the reviews of chapters 2 to 8 went through all 31 steps.

- **The copier** reads the code card and the delete boxes, pastes the highlighted lines at the place the fence shows, and builds at each checkpoint. Checked: is the place clear, is anything needed that no step says (import, Xcode action, deletion), do the delete boxes cover every line that `git diff chapter-08 chapter-09` removes or changes, is a line highlighted in two steps, is a highlighted line one that the learner already has.
- **The self-implementer** uses the "Try first" mode. This person sees the instruction, the caption, the cover (file, "Inside …", context lines, placeholder, delete box), and the Swift notes, but not the code. Checked: does the text give each new identifier with its type, access level, `async`/`throws`, start value, and parameters; does it name each API, each SwiftUI modifier with its arguments, and the log text; does the text say when the project does not compile between steps.

The cover text of each step was extracted from the rendered HTML (26 covers, 24 with an "Inside …" text) and compared with `git show chapter-09:<file>` and the diff. The findings were fixed on the page in the same pass (captions and two instructions; no main code fence and no `remove` fence changed; no `copy` mark needed, because the chapter has no new file). Then `npm run validate` and the replay ran.

## Findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 3.3 | self-implementer | The step adds the `do`/`catch` skeleton, but the text gave neither the condition `if isEnabled, let format = currentDevice.activeFormat10BitVariant` nor the log text of the `catch` block. The log text appears only in the cover of the next step. A learner cannot guess a log string. The step also leaves `format` unused and a `catch` that cannot run, so Xcode shows two warnings, and the text did not say so. | high | The caption gives the condition, `logger.error(...)` with the exact text, and the sentence about the two warnings until the next step. |
| 2 | 5.1 | self-implementer | The toggle button had no spec: `var hdrToggleButton: some View`, `Button` with two trailing closures, `camera.isHDRVideoEnabled.toggle()`, `Text` with `.font(.body.weight(.semibold))`. The caption gave only the two label texts. | medium | The caption lists the declaration, the two closures, the `toggle()` call, and the font modifier. |
| 3 | 5.4 | self-implementer | "give the button a border in the form of a capsule" named no modifier. `.buttonStyle(.bordered)` and `.buttonBorderShape(.capsule)` cannot be guessed, and a learner who writes `.border(...)` gets a different view. | medium | The caption names the two modifiers in order. |
| 4 | 3.2 | self-implementer | The signature `func setHDRVideoEnabled(_ isEnabled: Bool)` was not given: the parameter label `_`, the name `isEnabled` (the cover of 3.3 uses it), and that the method is not `async` and does not throw although it uses `try` inside. | medium | The caption gives the signature and says why the method does not throw. |
| 5 | 1.3 | self-implementer | The type `AVCaptureDevice.Format?` of `activeFormat10BitVariant` and the expression `formatDescription.dimensions` were not in the text; the cover has no "Inside …" text, because the property is a new top-level extension. The `==` comparison was described as "same pixel size". | medium | The caption gives the type and `formatDescription.dimensions` of `$0` and `activeFormat`. |
| 6 | 2.1 | self-implementer | The cover has two placeholders. The first one stands for the property and for the new two-line head of the initializer, while the delete box names the old head. The caption did not say that the second parameter goes on its own line, and did not give `let isHDRSupported: Bool`. | medium | The caption gives the property declaration, the parameter with its default value on its own line, and the assignment. |
| 7 | 5.3 | self-implementer | `@ViewBuilder` was mentioned only in 5.4. In 5.3, the two branches have the same type, so the learner who omits the attribute builds, but gets a diff and must add it in the next step. | low | The caption says to write `@ViewBuilder` above `var hdrButton: some View` and that the next step needs it. |
| 8 | 5.2 | self-implementer | "Disable the button" named neither `.disabled(_:)` nor `camera.captureActivity.isRecording`. The instruction (8 words) did not say the place. | low | The instruction says "In `hdrToggleButton`"; the caption names the modifier and its argument. |
| 9 | 1.1, 1.2 | self-implementer | `isTenBitFormat`: the type `Bool` and `rawValue` were not given. `maxFrameRate`: the type `Double`, `last?.maxFrameRate`, and `?? 0` were not given. | low | Both captions give the type and the expression. |
| 10 | 2.2, 3.1, 4.2 | self-implementer | The start value `false` and the access level were not given: `private var` (2.2), `@Published var` without `private(set)` (3.1), `private(set) var` (4.2). 2.2 has a two-line `//` comment. | low | The captions give them. |
| 11 | 2.3, 3.4, 4.5 | self-implementer | 2.3: "set the property from the device" did not say `!= nil`. 3.4: `try` before `lockForConfiguration()` and `isHDRVideoEnabled = true` were not said. 4.5: the `guard` named "the session does not run" and "photo mode" instead of `status == .running` and `captureMode == .video`. | low | The captions give the expressions. |
| 12 | 1.4, 1.5 | self-implementer | 1.4: the line ends with `&&` (a line-level diff if the learner puts `&&` at the start of the next line). 1.5: the sample writes `first(where: { … })` in parentheses, not as a trailing closure. | low | The captions say so. |
| 13 | 4.1 | self-implementer | The type `Bool` of the two protocol properties and the `///` comment lines were not given. | low | The caption gives them. |
| 14 | 5.5 | self-implementer | "the HDR button" was ambiguous: `hdrButton` or `hdrToggleButton`. | low | The instruction says `hdrButton`. |
| 15 | 2.2, 2.3, 3.1 to 3.3, 4.1 to 4.4, 5.3 | self-implementer | The solutions contain the sample's comment lines (`///` doc comments and `//` comments). The text names them only where a step is a comment and code (2.2, 4.1). | low | Not fixed, as in the chapter 5, 7, and 8 reviews: the comments are not load-bearing. |

Counts: high 1, medium 5, low 9.

### Checks that passed

- Copier: `git diff chapter-08 chapter-09` touches 8 Swift files, 111 added lines, 3 removed lines. The project file does not change. The chapter has no new file, so no `copy` mark is needed.
- Copier: the delete boxes cover the three removed lines: the old initializer head (2.1), `CaptureCapabilities()` (2.4), `EmptyView()` (5.5). No line moves to another place. No line is highlighted in two steps: 1.3/1.4/1.5 add to one property in three steps, each with its own lines; 5.1/5.2 and 5.3/5.4 split one view each; the fences of 5.1 and 5.3 show the same context, and each one highlights only its own property.
- Copier: no highlighted line is one that the learner already has. The highlighted closing braces in 3.2 (the method), 3.3 (the `catch`), 4.3 (the task), and 4.4 (the observer) are new lines. Git counts only real new lines; the diff has no moved tail.
- Copier: every paste place is clear in all 25 code steps. `currentDevice`, `logger`, `captureSession`, `status`, `captureMode`, `isCompactSize`, and `captureActivity.isRecording` exist on `chapter-08`. No import, target, or Xcode action is missing.
- Copier: the project builds at every checkpoint (1.6, 2.5, 3.7, 4.7, 5.6). The gap inside section 1 (1.3 to 1.5) is said in the caption of 1.3. The gap in section 4 (4.1 to 4.6) is said in the note after 4.1. The warnings at 3.3 are now said (finding 1).
- Covers: "Inside …" is correct on the 24 steps that have it (for example `extension AVCaptureDevice › var activeFormat10BitVariant: AVCaptureDevice.Format?` on 1.4 and 1.5, `actor CaptureService › func setHDRVideoEnabled(_ isEnabled: Bool)` on 3.3 to 3.5, `final class CameraModel: Camera › var isHDRVideoEnabled = false` on 4.5, `struct FeaturesToolbar<CameraModel: Camera>: PlatformView › var body: some View` on 5.5). The steps 1.1 and 1.3 (top-level extensions) show only the file, which is correct. The placeholder of 1.1 is after the closing brace of the `CMVideoDimensions` extension, with four context lines above it.
- Placeholders: one per highlighted run. 2.1 has two runs and two placeholders; the text now says what goes where (finding 6). 4.1 has two runs that merge into one placeholder, because only an empty line separates them.
- Swift notes: this page has no card and no pointer. `defer`, `didSet`, `guard`, `@Published`, `private(set)`, `@ViewBuilder`, `for await`, `$0`, `some View`, and `Task` are `common` or appeared earlier. See suggestion 1 for two gaps.
- The two diagrams (`ch09-format-search.svg`, `ch09-format-control.svg`) are at the right sections, and their alt texts match the code.
- The checkpoint 5.6 and the note after it say correctly that the Simulator shows no HDR button, and why.
- Quiz answers match the code.

## Suggestions for the generator and the glossary

1. **Glossary: a condition list with optional binding, and `??`.** Step 3.3 writes `if isEnabled, let format = …`: a Boolean and an optional binding in one `if`, separated by a comma. The glossary has `if-let-shorthand` only. Suggested entry: pattern `/\bif\s+[^{]*,\s*let\s+\w+\s*=/`, title "if with a condition list", text: "An `if` can have more than one condition, separated by commas. Each condition can be a Boolean or an optional binding. The body runs only when all conditions are true." Step 1.2 writes `?? 0`; the glossary has no entry for the nil-coalescing operator. Its first use is probably in an earlier chapter; check with `grep -n '??' content/pages/*.md`.
2. **Generator: a step whose code compiles only with warnings.** Step 3.3 leaves an unused binding and an unreachable `catch`. The page now says so in the caption. A generator note "This step builds with warnings until step N" would make this general, but the writer cannot mark it today; a `warnings` attribute on the fence could render such a note.
3. **Generator: two placeholders for one declaration (2.1).** The cover of 2.1 shows a placeholder for `let isHDRSupported: Bool` plus the two-line initializer head, and a second one for the assignment, while the delete box names the old head. A learner can read the first placeholder as "one property only". When a `remove` fence line sits between two highlighted runs on `startBranch`, the cover could show the delete box at the place of the removed line, not below the context.
4. **Replay: the `claims` flag.** The replay prints `claims=n` for section 5, because the Note, Experiment, and Text items after the last checkpoint are the last three texts it reads. The flag should look at the last checkpoint step, not at the last three items.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-ch09.json && REPLAY_DIR=/tmp/replay-ch09 python3 tools/replay.py /tmp/steps-ch09.json ch09-build`): sections 1 to 4 `claims=Y build=ok`; section 5 `claims=n build=ok` (see suggestion 4; the section builds); end state equals the branch `chapter-09`.
