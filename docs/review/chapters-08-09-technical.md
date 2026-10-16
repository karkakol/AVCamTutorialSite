# Chapters 8 and 9: technical review

Date: 16 Oct 2026
Pages: `content/pages/ch08-concepts.md`, `ch08-build.md`, `ch09-concepts.md`, `ch09-build.md`.
App branches: `chapter-07` (start of chapter 8), `chapter-08`, `chapter-09`.

## Method

1. Every code box of both build pages was compared with `git diff chapter-07 chapter-08` and `git diff chapter-08 chapter-09`. The validator checks the lines of each box, the order, and the coverage of every added line. In addition, the replay tool applied all steps in order, and a second run built the app after each single step (61 steps on chapter 8, 30 on chapter 9), so that every sentence "the project does not compile until ..." could be checked against the compiler.
2. The `highlight` and `remove` marks were checked against the diff. The "Inside ..." hint of each step was read from the rendered page (58 hints on chapter 8, 25 on chapter 9).
3. Each claim of the concept pages was compared with `research/08-raw.md`, `research/09-fast-capture.md`, `notes/chapter-08.md`, `notes/chapter-09.md`, `docs/device-test-chapter-08.md`, and the device facts in the review brief.
4. Warnings: the section-end builds and the single-step builds were scanned for `warning:`.

## Result in one line

No code box differs from the branches, and the highlight and remove marks are right. Seven claims were wrong or too strong and are fixed. Four build-state sentences were wrong or missing and are fixed. Three glossary entries were added.

## Findings

### Wrong claim (fixed)

| # | Page and place | Problem | Fix |
|---|---|---|---|
| 1 | `ch08-build.md` step 4.7 | Said that a RAW capture of the app has "a photo size of 0x0". The device showed "Resolved settings: 1 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0". | Caption gives the device line and says that the photo size is not 0x0. |
| 2 | `ch08-build.md` Important box before the last checkpoint, and the Experiment | Both said "photo size 0x0" (expected). The box also said that the `sessionNotRunning` dip came "because of this rebuild", a cause that nobody proved. | Box and Experiment give the device line. The box says "The cause is not proven" and links to chapter 9. |
| 3 | `ch08-concepts.md`, "What nobody tested", first bullet | Expected "photo 0x0" for the final request (`processedFormat: nil`). The final code ran on the device and gave 4032x3024. | Bullet removed. New section "The final code" in "What the device tests showed" gives the result. The intro box and the "One request, one photo" section name the device line. |
| 4 | `ch08-concepts.md`, finding 7 and the conditions table | "The capture itself does not cause this" and "the change builds the pipeline again, so the readiness can show `sessionNotRunning`". `notes/chapter-09.md` says the cause is open. | Both say "does not seem to cause this, and the cause is not proven". The table says the change "can" build the pipeline again. |
| 5 | `ch08-build.md`, last `Text` | "In the next chapter, you make capture feel faster with responsive capture". Chapter 7 already turned on responsive capture; chapter 9 adds zero shutter lag and the readiness. | Text names zero shutter lag and the readiness, and says that chapter 7 turned on responsive capture. |
| 6 | `ch09-build.md` Important box and `ch09-concepts.md` "A fast series": "This is responsive capture at work" | The log does not show which switch made the output drop the 24 MP path. The concepts page said this in the next sentence, but the first sentence was a claim. | "This is probably the work of responsive capture ..." and "an observation and not a proven cause". |
| 7 | `ch09-concepts.md`, "The readiness after a RAW capture" | (a) "The capture code cannot cause this". (b) "The deferred delivery switch changes only when the person picks a RAW choice". `updateDeferredPhotoDelivery()` also runs in `updateConfiguration(for:)`. (c) The discriminator was wrong: a camera switch also prints the "Deferred photo delivery" line, not only a RAW choice. (d) "or that the output rebuilds its pipeline" is not in the SDK text. (e) The mapping `default: self = .sessionNotRunning` is a third possible source and was missing. | All five points rewritten. A RAW choice prints the deferred line only; a camera switch prints the three switch lines, the deferred line, and "RAW on ...". |

Smaller wrong or imprecise statements, also fixed:

- `ch09-concepts.md` line 62 pointed to "the next section" for the trade-off; the section is later and has another name.
- `ch09-concepts.md` "Chapter 7 already set three switches" did not say that chapter 8 changed the deferred switch (off while RAW is chosen).
- `ch09-concepts.md` and `ch09-build.md` called the new task "the third task". `observeState()` has four tasks after the step.
- `ch09-concepts.md`: "the `x = x.isSupported` lines turn each switch on". For zero shutter lag the output already enables it. Now: "all four switches were on".
- `ch09-build.md` last checkpoint said that the library gets several photos in the Simulator. Only the button state is verified there. The sentence now says "should".
- `ch08-concepts.md` rule table: "the setter raised an exception for a RAW request" now says "for a Bayer RAW request", as findings 6 and the common-mistakes list say.

### Code box mismatch

None. The validator reports 0 errors and 0 warnings. The replay (section end builds and the final state) matches both branches. The 10 `remove` boxes of chapter 8 (steps 1.5, 2.4, 2.13, 2.15, 3.4, 3.9, 3.10, 4.4, 6.4, 6.5) and the 2 of chapter 9 (steps 5.1, 5.2) cover every removed or moved line in the diffs.

Build states found by the single-step builds (sentences fixed or confirmed):

| Place | Page said | Compiler | Action |
|---|---|---|---|
| ch08 1.1, 1.4 | "does not compile until 1.2 / 1.5" | confirmed | none |
| ch08 2.11 | "The project compiles again after this step" | The project compiled at every step from 2.1 to 2.12. The sentence was a leftover. | sentence removed |
| ch08 2.13 and 2.14 | no sentence | build FAILS: `thrown expression type '(any Error) -> MediaLibrary.Error' does not conform to 'Error'`, because `performChange(_:)` still throws `Error.saveFailed` | 2.13 says "does not compile until step 2.15"; 2.15 says "compiles again" |
| ch08 2.8 to 2.10 | no sentence | WARNING: `'defer' statement at end of scope always executes immediately` | 2.8 names the warning and says when it goes away |
| ch08 3.1 | "do not build now" | confirmed (`switch must be exhaustive`) | none |
| ch08 4.2 to 4.8 | no sentence | The replay shows `Attribute 'private' can only be used in a non-local scope`. This is the known brace artifact: git counts the closing brace of `updateCapabilities(for:)` as new in step 4.9, so the replay file lacks it before. A learner has the brace from chapter 7, and the steps build. | 4.9 now says "Your file has this brace already, so do not add a second one" |
| ch09 1.3, 1.4, 3.1, 3.3, 5.1 | each names the step where the build works again | all five confirmed | none |
| ch09 all other steps, and all section ends | build | ok, 0 warnings at the five checkpoints that say "no warnings" | none |

### "Inside ..." hints

Correct on every step that has one (58 on chapter 8, 25 on chapter 9). Steps with no hint are top-level code (ch08 1.1, 2.6, 2.14; ch09 1.1, 3.1, 3.4, 5.5), which is right.

### Missing glossary card (fixed)

Entries added to `src/lib/swift-notes.mjs`. Each was checked with `grep` first and with a build: the card appears at its first use only.

| Entry | First use | Why |
|---|---|---|
| `let _ = ...` (discard a value) | ch09 step 5.5 | The preview line `let _ = camera.captureReadiness = ...` has no other explanation than the caption. |
| switch as an expression | ch08 step 2.14 | `case .internalError: "internalError"` and (step 7.1) `case .off: true`. Open since the chapter 7 and 8 round 2 review (suggestion 2). |
| Tuple with names | ch08 step 2.9 | `-> (type: String, count: Int)` and `rawImage.type`. |

Not added: `as?` (first used in chapter 2, not in these chapters), `didSet` and `lazy var` (the cards already exist and appear at ch08 5.1 and ch09 3.5), `.map { $0 as String }` (explained in the caption).

### Claims checked and found right

- Chapter 8: the Off / Apple ProRAW menu; Bayer RAW not offered on virtual cameras and planned for chapter 16; the RAW-only request with `processedFormat: nil` and the embedded JPEG preview; deferred delivery off for RAW; the DNG saved alone with `.photo`, a temporary `.dng` file, and `shouldMoveFile`; the 3300 error of the pair in the order DNG `.photo` and HEIF `.alternatePhoto`; Live Photo excluded with ProRAW; `photoQualityPrioritization` not set for RAW.
- Chapter 9: all four switches `true/true`; about 15 fast taps all saved; only `ready` and `notReadyMomentarily` seen; the dimmed button and the spinner not visible on this phone (the pages send the learner to the preview "Waiting for processing"); the 12 MP photos in a burst; the dip stated as an observation.
- Chapter 9 claims taken from the SDK header (weak delegate, synchronous callback only on the main queue, first value at once when the delegate is set, `stopTrackingCaptureRequest` argument, the ordering rule of the switches, `isZeroShutterLagEnabled` default for apps linked on or after iOS 17) match `research/09-fast-capture.md`.
- Links: every internal link and anchor resolves (`npm run validate`).

## Open items

1. **`photoQualityPrioritization` for RAW.** The review brief says "must not be set for a RAW request (crash)". The pages say that the setter crashed for a Bayer RAW request and that an Apple ProRAW capture accepted it in the same test (finding 6, the build step 3.10, quiz question 2). `notes/chapter-16.md` has the same record ("Apple ProRAW with `.quality` did not crash in the same build"). The code never calls the setter for any RAW request, so the learner's code is safe. If the brief means that ProRAW crashes too, the pages need a change; the device log would settle it.
2. **Chapter 16 has no Bayer section yet.** `ch08-concepts.md` ("Bayer RAW comes in chapter 16") and the build page say that chapter 16 "adds Bayer RAW in a section 'Bayer RAW on a single lens'". `ch16-concepts.md` and `ch16-build.md` do not mention Bayer RAW (the plan is in `notes/chapter-16.md`). The sentences read as a fact. The coordinator decides: write the section, or change the wording to "planned".
3. **`docs/device-test-chapter-08.md`, section 3, step 3** still expects "photo 0x0". The device showed `photo 4032x3024`. The file is a protocol, not a page; it was not changed.
4. **`notes/chapter-09.md`, "Cause of the dip"** says "The deferred switch runs only in `setRAWFormat(_:)`". `updateDeferredPhotoDelivery()` also runs from `updateConfiguration(for:)`. The page is correct now; the note is not.
5. **Replay brace artifact on chapter 8, steps 4.2 to 4.8.** The single-step replay reports a build failure there (see above). A learner does not have the problem. The tool could treat a closing brace that git moves in the same way as for the section-end result.
6. **Zero shutter lag time stamps and a fast series of RAW captures** were not tested. The concepts page of chapter 9 says so.
7. **Side effect:** `tools/replay.py` writes `docs/review/replay-partial.md` in the site repository. The file is part of the working tree after the replay.

## Validate and replay

See the end of `docs/review/chapters-08-09-learner.md`.
