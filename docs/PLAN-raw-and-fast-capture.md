# Plan: chapters "RAW and Apple ProRAW" and "Fast capture", inserted after chapter 7

Written 15 Oct 2026. Goal: two new chapters that sit after chapter 7 ("Photo features") as chapters 8 and 9, with the old chapters 8 to 18 renumbered to 10 to 20. The work is split so that cheaper models (Sonnet) do the mechanical and the writing parts, and the Fable coordinator only plans, decides, and checks.

## Status (16 Oct 2026, scope change)

Chapter 8 offers Off and Apple ProRAW only (user decision: the app uses the virtual back camera that the system prefers, so Bayer RAW, which needs a single physical camera, cannot be tested before chapter 16). Bayer RAW moves to chapter 16 as a section "Bayer RAW on a single lens" (physical camera selection, zoom 1.0, no prioritization setter); see `notes/chapter-16.md` and `research/08-raw.md` section H. Chapter 8 code: one commit `108eea6` on `chapter-07`; `chapter-09` rebased onto it (`851873f`). `chapter-10` … `chapter-20` and `main` still sit on the old `04bee6a` until the user has tested chapters 8 and 9 on the device; then rebase them (chapter 11 `CaptureCapabilities`: live photo, Apple ProRAW, HDR) and fix the `ch10-build.md` and `ch11-build.md` fences. The RAW save first stores the DNG alone with a full-size JPEG preview (the Camera app model, untested), then the RAW+JPEG pair (processed `.photo`, DNG `.alternatePhoto` file; verified in round 6, badge "JPG + RAW"), then the processed photo alone. A RAW request does not set `photoQualityPrioritization` (the setter is unsupported for RAW; Bayer RAW crashed at it on iOS 26). Round 7 (`docs/device-test-chapter-08.md`) tests the DNG alone for Apple ProRAW. The paragraphs below are the history of the decision.

## Order of the new chapters

Decided by the user on 15 Oct 2026: RAW is chapter 8, fast capture is chapter 9; the RAW control offers a choice between Apple ProRAW and Bayer RAW (changed 16 Oct 2026: Apple ProRAW only, Bayer RAW in chapter 16); the DNG and the processed photo go into one asset (option A, decided 15 Oct 2026). Research found that Apple's article makes the DNG the `.photo` resource and the HEIF the `.alternatePhoto`; the chapter first followed the article. The second device test (16 Oct 2026) saved nothing, so the chapter now follows the documentation and the iOS 27 headers (HEIF `.photo`, DNG `.alternatePhoto` with `contentType = .dng`), and a device check settles it. Constant color is out of chapter 8 (it cannot combine with RAW). Bayer RAW forces `.speed` prioritization and zoom 1.0; ProRAW excludes Live Photo. The RAW symbol is `r.square` / `r.square.fill`.

1. **Chapter 9, Fast capture**: responsive capture, fast capture prioritization, zero shutter lag, the readiness coordinator on the capture button, deferred photo delivery that chapter 7 already started. Source: WWDC23 session 10105 "Create a more responsive camera experience"; Apple documentation of `AVCapturePhotoOutput` (`isResponsiveCaptureEnabled`, `isFastCapturePrioritizationEnabled`, `isZeroShutterLagEnabled`, `isAutoDeferredPhotoDeliveryEnabled`) and `AVCapturePhotoOutputReadinessCoordinator`.
2. **Chapter 8, RAW and Apple ProRAW** (written and coded first): a RAW control with the choices Off, ProRAW, and RAW in the features toolbar, `isAppleProRAWEnabled` and `isAppleProRAWSupported`, the choice of a RAW pixel format (`availableRawPhotoPixelFormatTypes`, Bayer RAW against ProRAW), `AVCapturePhotoSettings(rawPixelFormatType:processedFormat:)`, the two delegate callbacks (one for the RAW photo, one for the processed photo), saving the DNG next to the HEIF with `PHAssetCreationRequest` (`.photo` plus `.alternatePhoto`), constant color as an option. Source: Apple's article "Capturing photos in RAW and Apple ProRAW formats"; WWDC21 session 10047.

Both chapters follow the part 2 rules: our own code, a stated deviation from the sample, verified in the Simulator as far as possible, and a checkpoint that says what a real iPhone shows.

## Phases, and which model does each

| Phase | What | Who | Checks |
|---|---|---|---|
| 0 | Research dossiers `research/08-raw.md` and `research/09-fast-capture.md`: verified links (JSON endpoint 200), API facts from the SDK headers, what the Simulator supports | Sonnet | Coordinator reads the dossiers (10 minutes) |
| 1 | Code for chapter 8 on a worktree branch `chapter-08-fast` from `chapter-07`: output switches in `PhotoCapture.updateConfiguration(for:)`, a readiness coordinator owned by `PhotoCapture`, a `captureReadiness` value through `Camera` to the model, the capture button that dims or disables while not ready, a fast tap sequence test | Sonnet (code agent), builds and runs in the Simulator with SimCam stills, writes `notes/chapter-08.md` | Coordinator: build, run, screenshot, read the diff |
| 2 | Code for chapter 9 on `chapter-09-raw` from the chapter 8 branch: `isRAWEnabled` in `PhotoFeatures`, RAW button with a `camera.raw` symbol, support check, settings object with RAW plus processed format, delegate callbacks, DNG save with the alternate resource, constant color behind `isConstantColorSupported`, fallback when unsupported (the Simulator path) | Sonnet (code agent), writes `notes/chapter-09.md` | Coordinator: same; the Simulator takes the fallback path |
| 3 | Renumber: rename branches (`chapter-08` to `chapter-20` shift by two, new ones become `chapter-08` and `chapter-09`), rebase the old chapters 8 to 18 onto the new chapter 9 (conflicts expected in `PhotoCapture.swift`, `FeatureToolbar.swift`, `PhotoFeatures`, `PreviewCameraModel.swift`), rename page files and images, update `collection.json`, every `startBranch`/`branch`/`chapter:` front matter, every cross-reference "chapter N" in prose, `docs/PLAN.md`, the notes. Replay all 20 chapters | Sonnet (one careful agent with a script), the coordinator wrote a similar branch rewrite on 14 Oct (`scratchpad/tools/previews.py`) | Coordinator: replay results, `git log --graph` of the branches, `main` moved to chapter-20 |
| 4 | Pages: concepts and build pages for both chapters (format `docs/AUTHORING.md`; the two learner personas from the start: name every identifier, type, access level, API; `copy` marks for boilerplate; pictures with `tools/capture.py` for the button states and the readiness states) | Sonnet (writer agent per chapter) | validate 0/0, replay, pictures viewed |
| 5 | Reviews: technical review against headers and documentation (as `docs/review/chapters-16-18.md`), then the two-persona learner review, two rounds | Sonnet (reviewers) | Coordinator reads the reports, applies generator fixes |
| 6 | Device check by the user on a real iPhone: a RAW capture produces a DNG in Photos; zero shutter lag and the fast sequence; the console lines named in the checkpoints | User | The coordinator adjusts the pages from the user's notes |

Fable (coordinator) work: phases 0 and 1 to 5 review points only, about 10 short turns. Sonnet does the research, code, rewrite, pages, and reviews.

## Decisions to make before phase 1

- Zero shutter lag and responsive capture are **on by default** on devices that support them when the app links the iOS 17 SDK or later. The chapter therefore shows the switches, explains the defaults, and adds the readiness coordinator as the visible feature. Confirm in phase 0 from the headers.
- The RAW control offers Off, Apple ProRAW (when `isAppleProRAWSupported`), and Bayer RAW (when `availableRawPhotoPixelFormatTypes` has a Bayer format); a choice that the device does not support is hidden. Decided. Changed 16 Oct 2026: Off and Apple ProRAW only; Bayer RAW moves to chapter 16.
- Where the DNG goes: as an alternate resource of the same asset (Photos shows one photo with a RAW badge), which is what the system camera does. Decided (option A).
- `main` after the rewrite equals the new chapter 20 (the old 18).
- The user's branch `following-tutorial` stays untouched; the user is in chapter 2, before the insertion point, so the renumbering does not affect their work. The site serves the renumbered pages after a rebuild.

## Risks

- The rebase of eleven chapters over two new ones touches `PhotoCapture.swift` and `FeatureToolbar.swift`, which chapters 8 (video), 9 (HDR), 10 (robust session), 12 (Camera Control), and 15 (fixes) also change. Expect a few conflicts; the replay catches a wrong resolution.
- Prose references to chapter numbers ("chapter 8 adds the movie service") are in many pages; a script finds them, a reviewer checks them.
- Nothing RAW-related can be verified in the Simulator; the pages must say so clearly, as chapters 9 and 11 do.

## Budget

Sonnet: about 8 agents (research, 2 code, rewrite, 2 writers, 2 reviewers plus second rounds). Fable: review points only, well under one 5-hour window. The user keeps 10 percent of each window free.
