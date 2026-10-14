# Chapter 4 build page: learner review

Date: 14 Oct 2026
Page: `content/pages/ch04-build.md` (22 code steps and 7 settings steps in 7 sections), rendered as `dist/ch04-build.html` after `node src/build.mjs`.

## Method

The same two personas as in the chapter 2 reviews went through all steps.

- **The copier** reads the instruction, pastes the highlighted lines at the place the fence shows, and builds at each checkpoint. Checked: is the place clear, is anything needed that no step says (folder, file, import, Xcode action, Info.plist key, deletion), does a step depend on a later step, are the checkpoints true. `git diff chapter-03 chapter-04` was compared with the steps: 7 Swift files change, and the project file gets the two usage description keys (section 1). The `remove` fences were compared with every deleted line of the diff.
- **The self-implementer** uses the "Try first" mode. This person sees only the instruction, the caption, the cover (file, "Inside …", context lines, placeholder, delete boxes), and the Swift notes. Checked: does the text give every new identifier with its type, access level, `async`/`throws`, and parameters; does it name every API the solution calls; do boilerplate steps have a spec; do captions give sizes, colors, and symbols for views.

The rendered cover text of each step was extracted from the HTML. The enclosing declarations of each fence were read from the analyzer (`fence.enclosing`). The Swift notes of the page were listed: the page has only two pointers, `actor` (2.1, to chapter 1) and `AsyncStream` (2.2, to chapter 2), and no card.

After the fixes, `npm run validate` and the replay (`tools/replay.py`) ran again. See the results at the end.

## Findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 3.1 | self-implementer | The signature of `performChange(_:)` was not given: private, `async throws`, parameter `change` of type `@Sendable @escaping () -> PHObjectPlaceholder?`. Steps 3.2, 3.3, and 4.3 build on this exact type. The error case `unauthorized` was not named. | high | Instruction names private and `async throws`. Caption gives the closure type, says why `@escaping` and `@Sendable`, and names `Error.unauthorized`. |
| 2 | 7.2 | self-implementer | `ThumbnailButton.swift` had no spec: the generic `Camera` pattern, `@State var camera`, the `PhotosUI` import, the `PhotosPicker` arguments, the 64 x 64 frame, the corner radius 8, the symbol `photo.on.rectangle`, `resizable`, `aspectRatio(.fill)`, the animation `.easeInOut(duration: 0.3)`, the `@ViewBuilder` property, the type `[PhotosPickerItem]`, and the preview with `PreviewBackground`. Step 7.3 calls `ThumbnailButton(camera:)`. | high | Caption now lists all of these, and says that it is fine to press Show solution and copy the file. It also says that the sample file has tab characters, so a white space difference in `git diff` means nothing. |
| 3 | 4.1 | self-implementer, generator | The fence of 4.1 contains the three closure body lines that step 4.2 adds (lines 14 to 16, not highlighted). The cover of 4.1 shows them as "already in your file", which is false, and it shows the solution of 4.2. | medium | Instruction: "leave the closure of the request empty. The next step fills it." Caption: the place card shows three lines that are the code of the next step. The fence is unchanged (see suggestion 1). |
| 4 | 2.1 | self-implementer | The cases of the `Error` enumeration, `unauthorized` and `saveFailed`, were not named. The `Photos` import was not named; only `UIKit` was. | medium | Caption names the two cases, `Swift.Error`, and the three imports. |
| 5 | 2.2 | self-implementer | `AsyncStream.makeStream(of:)` was not named, and neither were the exact types `AsyncStream<CGImage?>` and `AsyncStream<CGImage?>.Continuation?`, nor that `continuation` is private. | medium | Caption names the types, the access, and `makeStream(of:)` with `CGImage?.self` (verified link from `research/02-photo-capture.md`). |
| 6 | 2.3 | self-implementer | `isAuthorized` was not given as private `Bool` with `get async`. `PHPhotoLibrary` was named only in a link. The local `var isAuthorized` that step 2.4 changes was not mentioned, so the self-implementer writes `return status == .authorized` and must restructure in 2.4. The `// MARK: - Authorization` line was not mentioned. | medium | Instruction gives the declaration. Caption names `PHPhotoLibrary.authorizationStatus(for: .addOnly)`, the local `var`, and the mark comment. |
| 7 | 5.2 | self-implementer | `currentLocation` was not given as private `CLLocation?` with `get async throws`. `authorizationStatus` of the location manager was not named. That `liveUpdates()` throws (`try await`) was not said. | medium | Instruction gives the declaration. Caption names `authorizationStatus`, `.notDetermined`, and `try await`. |
| 8 | 4.1 | self-implementer | `createThumbnail(for:)` was not given as private `async` with parameter `asset: PHAsset`. A self-implementer writes a synchronous method (nothing inside waits), and the `await` in 4.3 then gives a warning. The arguments `PHImageManager.default()`, `CGSize(width: 256, height: 256)`, `.default`, `nil`, the two closure parameters, and `[weak self]` were not named. The `// MARK: - Thumbnail handling` line was not mentioned. | medium | Instruction gives the declaration. Caption explains the `async`, lists the arguments, the closure parameters, `[weak self]`, and the mark comment. |
| 9 | 3.3 | self-implementer | `save(photo:)` was not given as `async throws` with parameter type `Photo`, and not as non-private. The `// MARK: - Saving media` line was not mentioned. | medium | Instruction: "add the method `save(photo: Photo) async throws`". Caption: not private, `Photo` from chapter 3, mark comment. |
| 10 | 1.1 | copier | The Build Settings tab shows the Info.plist Values group only in the All view, and a learner can set the value in the Debug row alone. The branch has the keys in Debug and Release. | medium | Caption: select All, filter with `Photo Library`, enter the value in the row of the setting itself so that the two configurations get it. |
| 11 | 5.1 | self-implementer | `locationManager` was not given as a private constant. The file has no `import CoreLocation`, and the text did not say that none is needed. A self-implementer who adds the import is also fine. | low | Instruction names the private constant and the mark comment. Caption: no `import CoreLocation` is needed, because `Photos` imports Core Location. |
| 12 | 6.2 | self-implementer | `thumbnail` was not given as `private(set)` `CGImage?`, and `mediaLibrary` not as a private constant. The places (below `shouldFlashScreen`, above `captureService`) were only in the cover. | low | Instruction gives access, types, and places. |
| 13 | 3.2 | self-implementer | "the shared library" did not name `PHPhotoLibrary.shared()`. | low | Caption names it. |
| 14 | 3.4 | self-implementer | The options type `PHAssetResourceCreationOptions` and the data argument `photo.data` were not named. | low | Caption names both. |
| 15 | 4.2 | self-implementer | `yield(_:)`, the `cgImage` property, and the optional chaining on `continuation` were not named. | low | Caption gives `guard let` and `continuation?.yield(image.cgImage)`. |
| 16 | 4.3 | self-implementer | `localIdentifier`, `firstObject`, the `if let` unwrap, the `guard ... else { return }`, and the place (after `performChanges`, inside the `do` block) were not named. | low | Caption names all of them. |
| 17 | 7.1 | self-implementer | The two initializers `UIImage(cgImage:)` and `Image(uiImage:)` and the signature `init(_ image: CGImage)` were not named. | low | Caption names them. |
| 18 | 3.3 | self-implementer, generator | The cover shows three placeholders, because the blank fence line 11 between two highlighted runs is not highlighted. The place is still clear. | low | None on the page (see suggestion 2). |
| 19 | 2.3, 5.2, 3.1, 4.3 | self-implementer, Swift notes | No Swift note exists for `get async` (2.3) and `get async throws` (5.2), for `@escaping` (3.1), and for the `if let placeholder` shorthand (4.3). `get throws` has an entry, but its pattern does not match `get async`. | low | None on the page (see suggestion 3). |

Counts: high 2, medium 8, low 9.

### Checks that passed

- Copier: every change of `git diff chapter-03 chapter-04` has a step. The `remove` fences cover every deleted line: the comment in `Camera.swift` (6.1), the comment and the log line in `CameraModel.swift` (6.3), and the three placeholder lines in `MainToolbar.swift` (7.3). No line moves to a new indentation. The project file changes only by the two keys of section 1, and the `uncovered:` front matter names it.
- Copier: the highlighted lines of 4.1 (6, 8 to 13, 17 to 18) give a method with an empty closure, which compiles. Step 4.2 then adds the body. The checkpoint 3.5 claims one warning (`placeholder` written but never read), which is true for the code at that point.
- The place of each paste is clear in all 22 code steps. The covers show "Inside `actor MediaLibrary`" for the type-level steps and "Inside `actor MediaLibrary` › `method`" for 2.4, 3.2, 3.4, 4.2, 4.3, and 5.3. Camera.swift, CameraModel.swift, PreviewCameraModel.swift, and MainToolbar.swift show the correct enclosing declarations. 7.1 (an extension at file level) has none, which is correct.
- The create-file cover appears only on 2.1 and 7.2 (the first step of each new file). The later steps of `MediaLibrary.swift` show context lines.
- Step order: every step uses only code from earlier steps, except 4.1, which now says that the closure body is the next step.
- The permission order in 6.6 (location first, then Photos) matches the code: `save(photo:)` reads `currentLocation` before `performChange(_:)` reads `isAuthorized`.
- The quiz answers match the code.

## Steps that are fine for both personas

1.2, 2.4, 2.5, 3.5, 4.4, 5.3, 5.4, 6.1, 6.3, 6.4, 6.5, 6.6, 7.3, 7.4 (14 of 29).

## Suggestions for the coordinator (not fixed on the page)

1. **Fence of 4.1.** Remove the three closure body lines (`// Set the latest thumbnail image.`, `guard let self, let image = image else { return }`, `continuation?.yield(image.cgImage)`) from the fence of 4.1. The validator allows lines of a later step between two fence lines. Then the cover of 4.1 does not show the solution of 4.2, and the caption sentence about the place card can go. The fence was left unchanged in this review as instructed.
2. **Generator: placeholders separated by a blank line.** In 3.3, fence line 11 is blank and not highlighted, between the highlighted runs 7 to 10 and 12 to 14. The cover shows three placeholders. The generator could treat a blank context line between two highlighted runs as part of the run, or the writer could highlight blank lines too (the validator ignores empty added lines).
3. **Glossary entries.** Add `get async` (pattern `\bget\s+async\b`, title "get async", text about an asynchronous getter that the caller reads with `await`, and `get async throws` for one that can also throw). Add `@escaping` (pattern `@escaping\b`, text: the closure lives longer than the call; the function stores it or runs it later). Add the `if let x` shorthand (pattern `\bif\s+let\s+\w+\s*[{,]`, Swift 5.7: `if let placeholder` is short for `if let placeholder = placeholder`). The `get throws` entry (`/\bget\s+throws\b/`) does not match `get async throws` in 5.2, so that step gets no note either.
4. **`async` on `createThumbnail(for:)`.** The sample marks the method `async`, although nothing inside waits. The page now explains this. If the branch changes, the method could lose the keyword and 4.3 the `await`.
5. **Pictures.** `content/images/ch04-s7-2.jpg` and `ch04-s7-3.jpg` exist but are not yet on the page. 7.2 (the preview of `ThumbnailButton` in the canvas, icon only) and 7.4 (the toolbar before and after the first photo) are the steps with a visible change.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-ch04.json && REPLAY_DIR=/tmp/replay-ch04 python3 tools/replay.py /tmp/steps-ch04.json ch04-build`): sections 1 to 7 build (`build=ok`), the claims of sections 2 to 7 hold (`claims=Y`; section 1 has no claim), and the end state equals the branch `chapter-04`.
