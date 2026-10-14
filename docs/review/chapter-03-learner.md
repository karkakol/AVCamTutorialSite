# Chapter 3 build page: learner review

Date: 14 Oct 2026
Page: `content/pages/ch03-build.md` (56 steps in 7 sections), rendered as `dist/ch03-build.html` after `node src/build.mjs`.

## Method

The same two personas as in the chapter 2 reviews went through all 56 steps.

- **The copier** reads the code card and the delete boxes, pastes the highlighted lines at the place the fence shows, and builds at each checkpoint. Checked: is the place clear, is anything needed that no step says (folder, file, import, target, Xcode action, deletion), do the delete boxes cover every line that `git diff chapter-02 chapter-03` removes or moves.
- **The self-implementer** uses the "Try first" mode. This person sees the instruction, the caption, the cover (file, "Inside …", context lines, placeholder), and the Swift notes, but not the code. Checked: does the text give each new identifier with its type, access level, `async`/`throws`, and parameters; does it name each API that the solution calls; do boilerplate steps give a spec or say "press Show solution and copy the file"; do captions give sizes, colors, and symbols for views.

The cover text of each step and the Swift note cards were extracted from the rendered HTML and compared with `git show chapter-03:<file>`. The findings were fixed on the page in the same pass (instructions and captions only; no code fence changed). Then `npm run validate` and the replay ran.

## Findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 1.4 | self-implementer | The five members of `OutputService` are not named. The caption only explains the associated type. Steps 2.2, 5.1, 5.4, 6.2 depend on the exact names. | high | Caption lists `Output: AVCaptureOutput`, `output`, `captureActivity`, `updateConfiguration(for:)`, `setVideoRotationAngle(_:)` with types. |
| 2 | 2.2 | self-implementer | The new file `PhotoCapture.swift` has no spec: `PhotoCaptureError` with `noPhotoData` (used by name in 3.7), `final class`, `private(set)`, the `photoOutput` alias (used in 2.3 to 2.7, 4.4), the two imports. | high | Caption gives the two types, the three properties with full declarations, the imports, and "press Show solution and copy the file". |
| 3 | 7.10 | self-implementer | `CaptureButton.swift` has no sizes: 68 points, line width 4, inset 1.2 x line width, scale 0.85, animation 0.15 s, generic over `Camera`, `@State var camera`, `action` closure, `#Preview` with `PreviewBackground`. | high | Caption gives the spec and "press Show solution and copy the file". |
| 4 | 1.1 | self-implementer | The two cases `idle` and `photoCapture(willCapture: Bool = false)` are not named. The default value is load-bearing for 3.4 (`.photoCapture()`). | medium | Caption names the cases. |
| 5 | 1.5 | self-implementer | The API `output.connection(with: .video)?.videoRotationAngle` is not named; the empty default of `updateConfiguration(for:)` is not said. | medium | Caption names the API and the empty body. |
| 6 | 2.1 | self-implementer | `CaptureExtensions.swift` has no spec: `zero`, the `==` and `<` semantics, `public static func`. | medium | Caption gives the spec and "press Show solution and copy the file". |
| 7 | 2.5, 2.6 | self-implementer | `availablePhotoCodecTypes`, `.hevc`, `AVCapturePhotoSettings(format:)`, `AVVideoCodecKey`, `availablePreviewPhotoPixelFormatTypes`, `previewPhotoFormat`, `kCVPixelBufferPixelFormatTypeKey` are not named. These cannot be guessed. | medium | Captions name the APIs and the dictionary form. |
| 8 | 3.1, 3.2 | self-implementer | The property names `continuation`, `photoData`, `activityStream`, `activityContinuation` and their types are not given. Steps 3.4 to 3.9 and 4.2 use these names. `PhotoContinuation` has no generic parameters in the text. | medium | 3.1 gives `CheckedContinuation<Photo, Error>`, `private class`, and `continuation`. 3.2 names the three properties with types and access. |
| 9 | 3.4 | self-implementer | The two delegate methods are named by their argument labels only. The first yields `.photoCapture()`; the text did not say this. `activityContinuation.yield(_:)` is not named. The place ("below the initializer") is not said. | medium | Instruction says "Below the initializer". Caption names `photoOutput(_:willBeginCaptureFor:)`, `photoOutput(_:willCapturePhotoFor:)`, `yield(_:)`, and both values. |
| 10 | 4.1 | self-implementer | The signature `isolation: isolated (any Actor)? = #isolation` cannot be guessed. The caption only mentions `#isolation`. | medium | Caption gives the full signature and "a `Task` with an empty closure". |
| 11 | 6.3 | self-implementer | The coordinator property `videoRotationAngleForHorizonLevelCapture` is not named. The new comment text is not given. | medium | Caption names the property, the place (below the preview call), and the comment text. |
| 12 | 2.3, 2.4, 4.3, 5.4, 5.9, 7.5 | self-implementer | `// MARK:` comment lines are highlighted, and later instructions refer to them ("Above the `// MARK: - Update the photo output configuration` line"), but the step that adds the MARK line did not say so. | low | Each instruction names its MARK comment. |
| 13 | 1.2, 1.3 | self-implementer | 1.2: the type `Bool` and the `if case` form are not given. 1.3: the property name `data` is not given (used in 3.8 and 7.3). | low | 1.2 names `Bool` and `if case .photoCapture(let willCapture) = self`. 1.3 names `data: Data`. |
| 14 | 2.3 | self-implementer | `supportedMaxPhotoDimensions` and the `?? .zero` fallback are not named. | low | Caption names both. |
| 15 | 2.4 | self-implementer | The method is private, returns `AVCapturePhotoSettings`, and uses `var photoSettings`; the text did not say this. | low | Instruction and caption say it. |
| 16 | 3.3, 3.5, 3.6, 3.7, 3.8 | self-implementer | `init(continuation:)`, the tuple from `makeStream(of:)`, the full delegate method names, the error log and `return` in 3.5, `resume(throwing:)`, `guard let photoData else`, `resume(returning:)` are not named. | low | Captions name them. |
| 17 | 4.3 | self-implementer | `async throws -> Photo` and the empty `try await withCheckedThrowingContinuation { continuation in }` body are not said. | low | Caption says it. |
| 18 | 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.9 | self-implementer | Access levels and types are missing: `[any OutputService]` computed, `private`, `throws`, `CameraError.addOutputFailed`, `sessionPreset`, `currentDevice`, `@Published private(set) … = .idle`, `assign(to: &$captureActivity)`, `async throws -> Photo`. Places are missing in 5.1 ("below `captureSession`"), 5.3 ("after the input"), 5.6 ("above `previewSource`"). | low | Instructions and captions give them. |
| 19 | 6.2, 6.4 | self-implementer | 6.2: `private`, `CGFloat`, `outputServices` not said. 6.4: the key path of the second observer not named. | low | Captions name them. |
| 20 | 7.1, 7.4, 7.5 | self-implementer | 7.1: the types of the three properties. 7.4: `withAnimation(.linear(duration: 0.01))` and `private`. 7.5: the place ("below `flashScreen()`"), `private`, the loop form with `await` before the actor property. | low | Captions and instructions give them. |
| 21 | 7.8 | self-implementer | The four new protocol members and their order in the file are not listed; the learner's order differs from the code card. | low | Instruction lists the members; caption gives the places and `async`. |
| 22 | 7.11, 7.12 | self-implementer | 7.11: `largeButtonSize` and the order in the `HStack` not named. 7.12: the `.opacity` modifier not named. | low | Captions name them. |

Counts: high 3, medium 8, low 11.

### Checks that passed

- Copier: `git diff chapter-02 chapter-03` touches 10 Swift files and removes exactly one line (`// Set initial rotation state on the preview connection.` in `CaptureService.swift`). Step 6.3 has a `remove` fence for it, and the cover shows "Also delete these lines". No line moves to another indentation. The project file does not change.
- Copier: every paste place is clear in all 56 steps. The three new files name their group (`Support`, `Capture`, `MainToolbar`) and say "replace its contents". The `Combine` import in `CaptureService.swift` is in step 5.6. `DataTypes.swift` already imports `AVFoundation`, `CameraModel.swift` already imports `SwiftUI`, so no other import is needed. No target, Info.plist, or Xcode action is missing.
- Copier: no step needs code from a later step. The note after 7.8 says that the project does not compile until 7.9.
- Checkpoints 1.6, 2.8, 3.10, 4.5, 5.10, 6.5, and 7.13 are consistent with the code at that point. 7.13 names the console line and says that the number changes.
- Covers: "Inside …" is correct on every step that has it (`enum CaptureActivity`, `final class PhotoCapture: OutputService`, `private class PhotoCaptureDelegate …`, `actor CaptureService`, `final class CameraModel: Camera`, `protocol Camera …`, `class PreviewCameraModel: Camera`, `struct MainToolbar …`, `struct CameraView …`), and the method is right where the code goes inside a method (2.5 to 2.7, 3.6 to 3.9, 4.2, 4.4, 5.3, 5.5, 5.8, 6.3, 6.4, 7.3, 7.6, 7.7, 7.11, 7.12). Top-level steps (1.1, 1.3, 1.4, 1.5, 3.1, 5.6) show only the file, which is correct. The "create the new file" cover appears only on 2.1, 2.2, and 7.10, the first and only step of each new file.
- Swift notes: `@retroactive` card at 2.1, `@Published` card at 2.2, `AsyncStream` pointers at 3.2 and 3.3 (to chapter 2, step 5.2), `any Protocol` card at 4.1, `withCheckedThrowingContinuation` card at 4.3. All at the first use on the page; the texts fit the code of the step.
- The three diagrams (sections 3, 4, 7) are at the right sections and their alt texts describe the step content.

## Suggestions for the coordinator (not fixable on the page)

1. **Glossary: `isolated` parameter and `#isolation`.** Step 4.1 is the first use of `isolation: isolated (any Actor)? = #isolation`. There is no card. Suggested entry: pattern `/\bisolated\s*\(|#isolation\b/`, title "isolated parameter and #isolation", text: "A parameter marked isolated gives the method the actor of the argument. The default value #isolation passes the actor of the caller, so a task inside the method can run on that actor."
2. **Glossary: `associatedtype`.** Step 1.4 is the first use on the tutorial. No card. Suggested entry: pattern `/\bassociatedtype\b/`, text: "A placeholder type in a protocol. Each adopting type says which concrete type it uses, for example by the type of a property."
3. **Glossary: `if case` / `guard let x else` shorthand.** Step 1.2 uses `if case .photoCapture(let willCapture) = self`; step 3.6 uses `if let error` and 3.7 `guard let photoData else` (the Swift 5.7 shorthand). A card for `if case` (pattern matching of one enum case) would help the self-implementer at 1.2. `if let x` shorthand could be a `common` entry.
4. **Glossary: `typealias`.** Step 3.1. A one-line `common` entry is enough.
5. **Generator: "copy this file" attribute.** Three steps on this page (2.1, 2.2, 7.10) are boilerplate files. The captions now say "press Show solution and copy the file". A fence attribute that keeps the code visible in Try first mode (chapter 2 round 1, suggestion 3) would be cleaner than this sentence.
6. **Generator: review steps without highlights.** Step 6.1 ("review the method") has a fence with no `highlight=`. In Try first mode the cover shows the whole code with no placeholder and a "Show solution" button, which is odd for a review step. The generator could show such a fence as a normal code card in both modes.
7. **Generator: placeholder indentation.** As in chapter 2 round 2 finding 2, the placeholder has no indentation when the first highlighted line is blank (for example 1.3, 1.4, 3.1, 5.6, 7.2). The context lines show the depth, so this is low.
8. **Checkpoint 7.13 on a real iPhone.** The caption says the tutorial did not verify the byte count on a real iPhone. This is honest; the coordinator may want a real-device number for the "Console" row.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-ch03.json && REPLAY_DIR=/tmp/replay-ch03 python3 tools/replay.py /tmp/steps-ch03.json ch03-build`): sections 1 to 7 all `claims=Y build=ok`; end state equals the branch `chapter-03`.
