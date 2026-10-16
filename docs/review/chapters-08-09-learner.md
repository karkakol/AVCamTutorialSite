# Chapters 8 and 9 build pages: learner review

Date: 16 Oct 2026
Pages: `content/pages/ch08-build.md` (61 steps in 7 sections) and `content/pages/ch09-build.md` (30 steps in 5 sections), rendered as `dist/ch08-build.html` and `dist/ch09-build.html` after `node src/build.mjs`.

## Method

The same two personas as in `docs/review/chapter-07-learner.md` and `chapters-07-08-round-2.md`.

- **The copier** reads the code card and the delete boxes in order and builds after each section. I applied the steps with `tools/replay.py` and, in a second run, built the app after every single step. This showed exactly where a copier would see an error or a warning (the first column of the table below). I also compared each box with `git diff chapter-07 chapter-08` and `git diff chapter-08 chapter-09` and looked for a highlighted line that the learner already has (a copier trap).
- **The self-implementer** uses the "Try first" mode. I extracted the cover of each step from the rendered HTML (file, "Inside ...", context lines, placeholders, hint lines, delete boxes) and read the instruction and the caption. For each step I asked: could I write this code without the box, and would the result equal the branch? I looked for names, types, access levels, argument labels, string texts, and the place that the text does not give.

Both personas also record: a step that says something the box does not do, a term with no glossary card, and a wrong claim. The findings were fixed on the pages in the same pass; no main code fence and no `remove` fence was changed.

Note: a second session edited `ch08-build.md` at the same time (one `result=` attribute on the fence of step 7.4). I re-read each line before I changed it, and I did not touch that attribute.

## Chapter 9

### Copier, step by step

| Section | Steps | Build after each step | Result |
|---|---|---|---|
| 1. Describe the readiness | 1.1 to 1.6 | 1.1 ok, 1.2 ok, 1.3 fails, 1.4 fails, 1.5 ok, 1.6 ok | The text of 1.3 says "does not compile until step 1.5". Right. Each box has one clear paste place. |
| 2. Enable zero shutter lag | 2.1 to 2.3 | all ok | The `let output = photoOutput` line is highlighted once. No trap. |
| 3. Observe the readiness | 3.1 to 3.9 | 3.1 fails, 3.2 ok, 3.3 fails, 3.4 to 3.9 ok | The text of 3.1 says "until step 3.2" and the text of 3.3 says "until step 3.4". Right. |
| 4. Send the value | 4.1 to 4.5 | all ok | No trap. |
| 5. Show the readiness | 5.1 to 5.7 | 5.1 fails, 5.2 to 5.7 ok | The text of 5.1 says "until step 5.2". Right. |

- Every section end builds with no warnings (the five checkpoints that say "no warnings" are right).
- The delete boxes of 5.1 (the old `init` line) and 5.2 (the old call line) cover everything that the diff removes. No other line leaves.
- No line is highlighted twice. No highlighted line exists before the step. The closing braces that are highlighted (3.1, 3.3, 3.6, 5.3) are all new lines.
- Step numbers inside the text (1.5, 3.2, 3.4, 3.6, 4.3, 5.2, 5.5) point to the right steps.

### Self-implementer, step by step

| Step | Verdict | Note |
|---|---|---|
| 1.1 | ok | Cases, order, comment start, no raw values, and the reason for `==` are in the text. Six placeholders in the cover, because each comment is a hint line. |
| 1.2 | ok | Expression body and the three-line comment are given. |
| 1.3 to 1.5 | ok | Types, places, and comment texts are given. |
| 2.1 | ok | Exact line given. |
| 2.2 | finding 3 | The text did not say why the constant `output` exists. A learner who writes `photoOutput.isZeroShutterLagSupported` in the log text gets the error "reference to property ... requires explicit use of 'self'". |
| 3.1 | ok | Class line, the MARK line, the two stored properties. |
| 3.2 | ok | `makeStream(of:)` form and the order before `super.init()` are given. |
| 3.3 | ok | Both parameters with labels, the line break, the body. |
| 3.4 | ok | `private extension`, the `switch`, the `default` meaning. |
| 3.5 | ok | The four declarations in order; four placeholders with the comments as hints. |
| 3.6 | ok | Signature with `isolation`, the loop, both lines of the body. |
| 3.7 | finding 1 | The instruction said "At the end of `updateConfiguration(for:)`", but the box puts the code above the last line. |
| 3.8 | ok | Comment and call given. |
| 4.1, 4.2 | ok | |
| 4.3 | finding 2 | "a third `Task`". The method has four tasks after the step. The cover shows the place, but the text counted. |
| 4.4 | finding 3 | The `self.` in the log text was not explained. |
| 5.1 to 5.4 | ok | The `ZStack` structure is clear: `.disabled` on the button, the `if` inside the stack, `.opacity` on the stack. |
| 5.5 | ok, finding 5 | The `let _ =` form is explained in the caption, but had no Swift card. |
| 5.6 | ok | Canvas steps and the two pictures are clear. |
| 5.7 | finding 4 | Claims stronger than the test (see below). |

### Chapter 9 findings

| # | Step | Persona | Problem | Severity | Fix |
|---|---|---|---|---|---|
| 1 | 3.7 | self-implementer | "At the end of `updateConfiguration(for:)`" does not match the box: the new code goes between the log lines and `updateCapabilities(for: device)`. | low | "In `updateConfiguration(for:)`, below the log lines, ..." |
| 2 | 4.3, concepts | self-implementer | "a third `Task`" is ambiguous. | low | "a new `Task` ... between the task for the capabilities and the task for the capture activity". Caption: four tasks after the step. The concepts page says "a new task". |
| 3 | 2.2, 4.4 | self-implementer | `let output = photoOutput` and `self.captureReadiness` in log texts had no reason. A self-implementer meets a compiler error. | low | 2.2 says that a log text needs `self.` before each property, and the constant keeps the lines short. 4.4 says to write `self.`. |
| 4 | 5.7 text, Important box | copier, self-implementer | "The library gets several photos" in the Simulator is not verified (only the button state is). "This is responsive capture at work" is a claim; the log does not show which switch decided. | medium | 5.7 says "should start a capture", and says that about 15 taps on the iPhone gave the same result. The Important box says "probably the work of responsive capture and fast capture prioritization". The checkpoint result says that the button did not change. |
| 5 | 5.5 | self-implementer | `let _ = ...` is a new construct without a Swift card. | low | Glossary entry added (see the technical review). |

Pictures: `ch09-s5-1-ready.jpg` and `ch09-s5-1.jpg` match their captions (the ready button, and the dimmed button with a spinner). The picture belongs to step 5.6, which is the first step that shows a visible change, and the text of 5.2 and 5.4 says that the button does not look different yet. Right.

## Chapter 8

### Copier, step by step

| Section | Steps | Build after each step | Result |
|---|---|---|---|
| 1. Describe the RAW choices | 1.1 to 1.6 | 1.1 fails, 1.2 ok, 1.3 ok, 1.4 fails, 1.5 ok, 1.6 ok | Both gaps are announced in the text (1.1 "until then", 1.4 "until the next step"). |
| 2. Save the DNG | 2.1 to 2.17 | 2.1 to 2.12 ok, 2.13 FAILS, 2.14 FAILS, 2.15 to 2.17 ok | **Finding 1.** Steps 2.13 and 2.14 do not build, and no text said it. Step 2.11 said "The project compiles again after this step", but nothing was broken before it. Steps 2.8 to 2.10 show a compiler warning (`defer` at the end of scope); no text said it. |
| 3. Ask the camera for RAW | 3.1 to 3.11 | 3.1 fails (`switch must be exhaustive`), 3.2 to 3.11 ok | The text of 3.1 says "do not build now", and 3.2 says "compiles again". Right. |
| 4. Turn off deferred delivery | 4.1 to 4.10 | 4.1 ok. 4.2 to 4.8: the replay reports `Attribute 'private' can only be used in a non-local scope`. 4.9 and 4.10 ok. | **Finding 2.** This is the replay artifact of a moved closing brace (the technical review explains it). A learner has no error in 4.2 to 4.8. But the box of 4.9 highlights a closing brace that the learner has already, and the caption did not say "do not add a second one". |
| 5. Pass the choice through the model | 5.1 to 5.6 | all ok | The protocol members come last, as the section intro says. |
| 6. Send the choice, and lock Live Photo | 6.1 to 6.6 | all ok | |
| 7. Add the RAW menu | 7.1 to 7.5 | all ok | |

- Every section end builds. The end state of the replay equals `chapter-08`.
- The 10 delete boxes (1.5, 2.4, 2.13, 2.15, 3.4, 3.9, 3.10, 4.4, 6.4, 6.5) cover every line that `git diff chapter-07 chapter-08` removes or moves. No highlighted line exists before its step except the brace of 4.9.
- The paste places are clear in all 61 steps. The order of insertions in `PhotoCapture.swift` (4.2, then 4.5 between `updateCapabilities` and `updateDeferredPhotoDelivery`, then 4.9 inside `updateCapabilities`) gives the same file as the branch.
- The picture `ch08-s7-4.jpg` belongs to step 7.4 (RAW menu next to the quality menu). The caption matches.

### Self-implementer, step by step

| Step | Verdict | Note |
|---|---|---|
| 1.1 | ok | Protocol list in order, `var id: Self { self }`, the two comments. |
| 1.2 | finding 4 | "A `switch` on `self` returns ..." did not say `return` in each case. The sample style, and the branch, use `return`. A learner who writes the expression form gets a different file. |
| 1.3 to 1.5 | ok | `var` with default (and why the memberwise initializer still works), `let`, parameter defaults, one parameter per line. |
| 2.1 to 2.5 | ok | `self.` in the log text is explained (2.3). The `/// ` comment texts are given or are hint lines. |
| 2.6, 2.7 | ok | Import order, method form, the empty body. |
| 2.8 | ok | The warning is now named (finding 1). |
| 2.9 | finding 5 | The text gave `CGImageSourceCreateWithData(_:_:)` but not `data as CFData` or `nil`, and not that `CGImageSourceGetType` returns a `CFString?` (so `.map { $0 as String }`). |
| 2.10, 2.11 | ok | The format string `"%02X"`, `prefix(4)`, `joined(separator: " ")`, the options object, `shouldMoveFile`, the order of the calls. |
| 2.12, 2.13 | ok | `return` after the call; `Swift.Error` and why. |
| 2.14 | ok | `copy` mark with the full cases. |
| 2.15, 2.16 | ok | The `as? PHPhotosError` cast and the fallback text are given. |
| 3.1 to 3.10 | ok | Names (`formats`, `rawType`, `dimensions`, `excludesLivePhoto`), the keys, the log texts, the one-line `else if`. |
| 4.1 to 4.9 | ok | Names (`isEnabled`, `photo`, `raw`, `proxy`, `isAppleProRAWSupported`), the "only inside an `if`" rule. Finding 3 corrects the claim in 4.7. |
| 5.1 to 5.6 | ok | `didSet` with the `Task`, the preview `let`, the loop and the reset. |
| 6.1 to 6.5 | ok | |
| 7.1 to 7.4 | ok | `case .off: true` is explained ("no `return`"); `@ViewBuilder`; the symbol names; the picker title. |

### Chapter 8 findings

| # | Step | Persona | Problem | Severity | Fix |
|---|---|---|---|---|---|
| 1 | 2.8, 2.11, 2.13, 2.14 | copier | No text told the learner that the build fails at 2.13 and 2.14 (`performChange(_:)` still throws `Error.saveFailed` without a reason), or that Xcode warns about `defer` at 2.8 to 2.10. The sentence "The project compiles again after this step" at 2.11 was false. | medium | 2.8 names the warning and says when it goes away. 2.11: sentence removed. 2.13: "does not compile until step 2.15". 2.15: "compiles again after this step". |
| 2 | 4.9 | copier | The closing brace of `updateCapabilities(for:)` is highlighted because git counts it as new. The learner has it from chapter 7. The caption said only that it is highlighted. A copier who pastes all four highlighted lines gets a second brace. The same trap as chapter 7, step 3.6. | medium | Caption: "Your file has this brace already, so do not add a second one." The fence is unchanged. |
| 3 | 4.7 | self-implementer, wrong claim | "a photo size of 0x0". The device showed `photo 4032x3024`. A learner who compares the console with the text thinks that the capture is wrong. | high | Caption gives the device line and says that the photo size is not 0x0. The Important box and the Experiment at the end are corrected in the same way. |
| 4 | 1.2 | self-implementer | `return` in each case not given. | low | Caption says "with a `return` in each case". |
| 5 | 2.9 | self-implementer | `data as CFData`, `nil`, and `.map { $0 as String }` not given. | low | Two sentences added. |
| 6 | 7.5 box, last text | wrong claim | "because of this rebuild" (an unproven cause of the readiness dip); "responsive capture" as the content of the next chapter. | medium | See the technical review, findings 2 and 5. |
| 7 | 2.9, 2.14, 7.1 | glossary | No card for a named tuple (2.9) or for a `switch` that is an expression (2.14, 7.1). The second one was open since round 2. | low | Two entries added. |

## Counts

Chapter 9: high 0, medium 1, low 4. Chapter 8: high 1, medium 3, low 3 (finding 6 counts the two wrong claims once).

## Checks that passed

- Copier: every paste place is clear. No import, target, or Xcode action is missing; the project file does not change on either branch (synchronized folders). Chapter 9 adds no file.
- Self-implementer: the "Inside ..." hints are correct everywhere (see the technical review). The `copy` mark of 8.2.14 gives the full cases. Placeholders: one per highlighted run after merging, and the comment lines of the solution are hints.
- Quiz: the three questions of each page match the code and the concepts pages. The answers need no change.
- Pictures: three pictures, three matching captions (8.7.4, 9.5.6 two pictures).
- Links: every link and anchor between the four pages resolves (`npm run validate`).

## Suggestions (not fixable on the pages)

1. **Replay tool: moved closing brace.** The single-step replay reports a failure in chapter 8 steps 4.2 to 4.8 because git attributes the closing brace of `updateCapabilities(for:)` to step 4.9. The section-end build is right. The tool could pair such a brace with the same step as the learner, so that a per-step build can be used as a check.
2. **Validator: a highlighted brace that exists.** Still open from round 2: 4.9 is the third case (7.3.6, 8.1.3 in the old numbering, now 8.4.9). A rule that warns when the last highlighted line of a run is a brace and the line after the run on `startBranch` is the same brace would find all three.
3. **Chapter 16 and the Bayer RAW section.** See the technical review, open item 2.

## Validate and replay results

- `npm run validate`: 42 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > steps-r89.json && REPLAY_DIR=... python3 tools/replay.py steps-r89.json ch08-build ch09-build`): chapter 8, sections 1 to 7 all `claims=Y build=ok`, end state equals `chapter-08`. Chapter 9, sections 1 to 5 all `claims=Y build=ok`, end state equals `chapter-09`. The section-end builds have 0 warnings.
- Single-step builds (a private variant of the replay tool): the failing steps are exactly the ones that the text announces (chapter 9: 1.3, 1.4, 3.1, 3.3, 5.1; chapter 8: 1.1, 1.4, 3.1), plus chapter 8 steps 2.13 and 2.14 (finding 1, now announced) and 4.2 to 4.8 (the replay brace artifact).
- `node src/build.mjs`: 42 pages built.
