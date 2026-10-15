# Chapter 13 and 14 build pages: learner review, round 2

Date: 15 Oct 2026
Pages: `content/pages/ch13-build.md` (51 steps in 6 sections: 36 code steps, 15 Xcode steps) and `content/pages/ch14-build.md` (44 steps in 6 sections: 37 code steps, 1 settings step, 6 checkpoints), rendered as `dist/ch13-build.html` and `dist/ch14-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholders, the comment lines and string literals of the solution as hints, delete boxes), the "What you see" picture, and the Swift notes. The rendered cover of each code step was extracted from the HTML (28 "Inside …" texts on chapter 13, 35 on chapter 14; both builds complete) and compared with `git diff chapter-12 chapter-13`, `git diff chapter-13 chapter-14`, and `git show chapter-13:<file>`. The 15 Xcode steps of chapter 13 and the one of chapter 14 were compared with the project file, the two `Info.plist` files, and `git ls-tree` on `chapter-13` and `chapter-14`. The picture `ch14-s5-7.jpg` was viewed. The glossary cards and pointers were checked against `src/lib/swift-notes.mjs`.

The working tree of the site repository has changes to `ch09-build.md` and `ch10-build.md` from another session; this review did not read or touch them.

The generator now shows the string literals of the highlighted lines on the cover ("texts in this code: …", for example on 13.1.2, 13.1.5, 13.6.4, 14.3.3, 14.5.3). This closes suggestion 1 of the chapter 13 round-1 review and suggestion 3 of the chapter 14 round-1 review.

## Verification of the round-1 findings: chapter 13

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 6.3 gives the three imports, `struct AVCamControlCenterExtension: ControlWidget` without `@main`, and `static var kind = "com.karolkakol.AVCam.AVCamControlCenterExtension.ControlButton"`, `displayName: LocalizedStringResource = "Open AVCam"`, `description: LocalizedStringResource = "Launch AVCam app."`. The cover of 6.4 lists `"Open AVCam"` and `"curlybraces"` as texts. |
| 2 | fixed | 5.7 says "29 files" in the caption and in the settings row; the alt text of the diagram says 26 + 3. `git ls-tree chapter-13 -- AVCam` has 30 Swift files; the exception list of the capture extension names 29 (all except `AVCamApp.swift`). |
| 3 | fixed | 1.1 gives `os` and `Foundation`, the five `var` lines with their start values in order, and `didSet { save() }`. |
| 4 | fixed | 1.2 gives `private func save()`, the `do`/`catch` form, the log text, and the reason for `os.Logger()`. 1.3 gives `static var current: CameraState` with `get async`, the `if let context = try await … { return context }` form, the log text, and `return CameraState()`. |
| 5 | fixed | 1.4 gives the three imports, `typealias AppContext = CameraState`, `static let title: LocalizedStringResource = "AVCamCaptureIntent"`, and the `IntentDescription`. 1.5 gives `@MainActor`, `func perform() async throws -> some IntentResult`, the log text, and `return .result()`. |
| 6 | fixed | 5.4 gives the five imports in order, `@main`, the structure line, and `@State private var camera = CameraModel()`. 5.5 gives `var body: some LockedCameraCaptureExtensionScene`, `LockedCameraCaptureUIScene { session in … }`, `CameraView(camera: camera)`, `.statusBarHidden(true)`, and the `.task` modifier. |
| 7 | fixed | A Note after 5.3 says that the `AVCam` scheme does not build until the end of the section, and why. A Note after 6.2 says the same for the control extension until the membership step. |
| 8 | fixed | 6.4 gives `var body: some ControlWidgetConfiguration`, `StaticControlConfiguration(kind: AVCamControlCenterExtension.kind)`, `ControlWidgetButton(action: AVCamCaptureIntent())`, `Label("Open AVCam", systemImage: "curlybraces")`, and the two modifiers in order. |
| 9 | fixed | 2.1 says "The parameter has the label `with` and the name `state`" and "From this step until you change the call in `CameraModel` (section 3), the project does not compile." |
| 10 | fixed | 3.1 gives `func syncState() async`, says that the project does not compile until the two models have the method, and mentions the four spaces on the empty line below `func start() async`. |
| 11 | fixed | 4.6 gives `private func capabilities(for mode: CaptureMode) -> CaptureCapabilities`, the two `switch` cases with their initializer calls, and the line break after the comma. |
| 12 | fixed | 4.1 gives `@Environment(\.scenePhase) var scenePhase`. 4.2 gives `{ _, newPhase in` and the `guard` line. 4.3 gives `Task { @MainActor in await camera.syncState() }` on three lines. |
| 13 | fixed | 3.2 gives `logger.debug("Syncing state isn't implemented in PreviewCamera.")`. The cover now also lists the text. |
| 14 | fixed | 3.4 gives `private var cameraState = CameraState()`. 4.7 gives `private(set) var isVideoDeviceSwitchable = true`. |
| 15 | fixed | 6.5 gives the two imports, `@main`, `struct AVCamControlCenterExtensionBundle: WidgetBundle`, `var body: some Widget`, and says that the template file already has this form: replace the header, delete the example control line. |

Counts: fixed 15, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 13, checked on the page: suggestion 1 (string literals on the cover) is implemented by the generator. Suggestions 2 (a replaced template file: 5.4, 6.3, and 6.5 still show "create the new file"), 3 (`compiles=no`), and 4 (file counts in `--budget`) are generator and validator items and stay open. Suggestion 5: `content/images/ch13-targets.svg` still says "25 files"; this review did not change the SVG. Suggestion 6: the replay of section 2 still prints `claims=n build=FAILS`, which is correct.

## Verification of the round-1 findings: chapter 14

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 5.4 lists the five modifiers with their values in order: `.font(.system(size: isSelected ? 13 : 11, weight: .semibold))`, `.monospacedDigit()`, `.foregroundStyle(isSelected ? .yellow : .white)`, `.frame(width: isSelected ? 40 : 30, height: isSelected ? 40 : 30)`, `.background(.black.opacity(0.5), in: Circle())`. |
| 2 | fixed | 5.1 gives `struct ZoomControl<CameraModel: Camera>: View`, `@State var camera: CameraModel`, the abstract text, `import SwiftUI`, `HStack(spacing: 8)`, `ForEach(camera.zoomLevels)` without `id:`, `Task { await camera.setZoom(to: level) }`, and `label(for: level)`. |
| 3 | fixed | 4.3 writes out the four members with `{ get }` and `async`, and says that the project does not compile until both models have them, and that the checkpoint of the section builds again. |
| 4 | fixed | 5.3 gives `@ViewBuilder private func label(for level: ZoomLevel) -> some View`, the reason for the attribute, `let isSelected = level == selectedLevel`, the sign × (U+00D7), and the two texts. The cover now also lists the selected text with the sign. |
| 5 | fixed | 4.2 gives `zoomObserver = device.observe(\.videoZoomFactor, options: [.initial, .new]) { [weak self] device, _ in … }`, the constant `zoomFactor`, the `Task` with `self?`, and the reason for `[weak self]`. |
| 6 | fixed | 2.3 gives `private func configureZoom(for device: AVCaptureDevice)`, the names `multiplier` and `factors`, `var` because 2.4 appends, `CGFloat(truncating: $0)` for the `NSNumber` values, and the two warnings. |
| 7 | fixed | 3.2 gives the signature, the three constant names, explains that `factor` hides the parameter, and names the warning. The duration of the warning was wrong; see new finding 2. |
| 8 | fixed | 4.7 gives the device values 1.0, 2.0, 6.0 and the display values 0.5, 1.0, 3.0 in order, `let zoomLevels`, the `{ get }` reason, and `private(set) var displayZoomFactor: CGFloat = 1.0`. |
| 9 | fixed | 5.5 gives `.padding(4)`, `.background(.black.opacity(0.25), in: Capsule())`, `.animation(.easeInOut(duration: 0.2), value: selectedLevel)`. 5.6 gives the two `opacity` conditions and `.hidden(until: camera.status == .running)`. 5.7 gives `ZoomControl(camera: PreviewCameraModel(status: .running))`, `.padding()`, `.background(.gray)`. |
| 10 | fixed | 6.2 links `MagnifyGesture` and gives `var pinchGesture: some Gesture`, `onChanged`, `value.magnification`, `startFactor`, and the `setZoom(displayFactor:)` call. 6.3 gives `.onEnded { _ in pinchStartFactor = nil }`. |
| 11 | fixed | 1.2 gives `let videoZoomFactor: CGFloat`, `let displayFactor: CGFloat`, and `var id: CGFloat { videoZoomFactor }`. 1.3 gives the static signature and `Double(displayFactor).formatted(.number.precision(.fractionLength(0...1)))`. 1.4 gives `var label: String` with `ZoomLevel.label(for: displayFactor)` and the reason for the type name. |
| 12 | fixed | 2.1 gives the two `@Published private(set) var` lines. 3.1 gives `private var zoomObserver: NSKeyValueObservation?` and `private let maxDisplayZoomFactor: CGFloat = 10.0`. 4.4 says "the same two declarations, without `@Published`". 6.1 gives `@State private var pinchStartFactor: CGFloat?`. |
| 13 | fixed | 3.3 gives `"Unable to change the zoom factor: \(error)"`. The cover now also lists the text. |
| 14 | fixed | 2.2 gives `private func displayMultiplier(for device: AVCaptureDevice) -> CGFloat` and the conditional operator. 3.5 gives the two signatures, "not private and not `async`", and the constant `device`. 4.1 gives the private signature and the one-line body. 4.5 says `async` with one `await` line each. 4.8 says that a synchronous method satisfies the `async` requirement. 5.2 gives `private var selectedLevel: ZoomLevel?` and the `last { … } ?? first` form. |
| 15 | fixed | 1.1 says "Write the list on two lines, as the solution shows, so that your file equals the branch." |

Counts: fixed 15, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 14, checked on the page: suggestion 3 (string literals and the × sign as hints) is implemented by the generator; the cover of 5.3 shows `"\(ZoomLevel.label(for: camera.displayZoomFactor))×"`. Suggestions 1 and 2 (glossary), 4 (`compiles=no`), 5 (a second "and inside …" on 5.9), and 6 (`NSNumber` note in `AUTHORING.md`) stay open. The page has no card and no pointer, which agrees with the glossary: no entry matches a first use on this page.

## New findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 14.5.7 | self-implementer and copier | The picture caption said "The zoom control in the Xcode preview canvas". The picture is a phone-shaped capture: the control alone in the middle of a gray screen, and the first button shows "0,5" with a comma. Step 5.10 says that nobody opened the canvas and that the view was checked in a temporary build. The canvas on a Mac with an English region shows "0.5", so a learner who compares sees two differences that the caption did not explain. | medium | The caption says that the picture comes from a temporary build in the Simulator, not from the canvas, and that the region of the Simulator uses a comma. |
| 2 | 14.3.2, 14.3.3 | copier | 3.2 said "Until the next step, Xcode warns that `factor` is never used." Step 3.3 adds only the lock and the unlock and does not use `factor`. The warning stays until 3.4, where the ramp and the assignment use the constant. | low | 3.2 says "Until step 4 of this section, where the ramp uses the constant". 3.3 says that the warning stays until the next step. |
| 3 | 13.2.2 | self-implementer | The two names of the HDR setting differ: the service has `isHDRVideoEnabled`, the state has `isVideoHDREnabled`. The caption said "copy the capture mode and the HDR setting", and the cover hint is only "Set initial operating state." A learner who writes `isHDRVideoEnabled = state.isHDRVideoEnabled` gets a compile error and must look for the name. | low | The caption gives the line `isHDRVideoEnabled = state.isVideoHDREnabled`. |
| 4 | 13.3.6 | self-implementer | The order of the four assignment lines was not given. The cover shows one placeholder and no hint (the lines have no comment). A different order compiles but differs from the branch. | low | The caption names the four properties in the order of the solution, with the state name for the HDR line. |
| 5 | 13, Note after 2.5 | copier | The empty line below the preset line has twelve spaces on `chapter-12` and no spaces on `chapter-13`; `git diff` shows it as a changed line. A copier who deletes the two lines of the delete box and pastes the two highlighted lines keeps the spaces. The Note mentioned only the empty line below `stopRecording()`. | low | The Note says that this empty line has no spaces in the sample and that the difference has no effect. The validator and the replay ignore white space. |

## Checks with no finding

- Xcode steps, chapter 13: the bundle identifiers (5.11, 6.7), `IPHONEOS_DEPLOYMENT_TARGET = 26.0` in all six target configurations (5.8, 6.7), the four Swift settings (`SWIFT_VERSION = 5.0`, `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated`, `SWIFT_APPROACHABLE_CONCURRENCY = NO`, `SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY = NO`) in all six (5.9, 6.7), the three usage descriptions in the two configurations of the capture extension and none in the control extension, the Photos description only in the app (5.10), the phase names `Embed ExtensionKit Extensions` and `Embed Foundation Extensions` with the two target dependencies (5.2, 6.2, 6.8), and the extension points `com.apple.securecapture` (`EXAppExtensionAttributes`) and `com.apple.widgetkit-extension` (`NSExtension`) in the two `Info.plist` files (5.2, 6.2) agree with the project file on `chapter-13`.
- Membership, chapter 13: the capture extension exception list has 29 entries and the control extension list has exactly `Model/CameraState.swift`, `Model/DataTypes.swift`, `Model/Intent/AVCamCaptureIntent.swift` (5.7, 6.6). The two extension folders have only `Info.plist` as an exception. Chapter 14: the only project file change adds `Views/Controls/ZoomControl.swift` to the capture extension list (5.8).
- Copier: the delete boxes of 13.2.1, 13.2.3, 13.3.7, 13.3.9, 13.3.10, 13.4.5, and 14.1.1 cover every removed or moved line of the two diffs. No highlighted run contains a line that exists on the start branch. The closing braces that git counts as new (13.1.2, 13.1.3, 13.4.6, 14.1.2, 14.2.3, 14.3.2) belong to new declarations, so the learner types them anyway. No line is highlighted in two steps.
- Build gaps: 13.1.1 to 13.1.5 (Note), 13.2.1 to 13.3.7 (caption of 2.1, Note after 2.5, caption of 3.1), 13.5.3 to 13.5.11 and 13.6.2 to 13.6.6 (Notes), 14.4.3 to 14.4.8 (caption), 14.5.1 to 14.5.3 (Note). Warning gaps: 14.2.3 (caption), 14.3.2 to 14.3.4 (finding 2). No other step leaves a warning: unused private methods and stored properties (13.4.6, 14.3.1, 14.4.1) give no warning, and an unused closure parameter (`session` in 13.5.5) gives none.
- Covers: "Inside …" is correct on every step that has it. The hint lines show the comments and now the string literals. The placeholders are split correctly around the comment lines (for example 13.1.5 "1 of 2" and "2 of 2" around the return comment, 14.2.3 "1 of 4" to "4 of 4", 14.5.6 "1 of 3" to "3 of 3"). The context line numbers match the branches (for example 98 to 109 around `start(with:)` in chapter 13, 308 to 349 around `setVideoZoomFactor(_:on:animated:)` in chapter 14).
- `PreviewCameraModel(status: .running)` (14.5.7) uses `init(captureMode:status:)`, which exists on `chapter-13`.
- Swift notes: chapter 13 has one card, `@main` at 5.4, and three pointers: `get async` (1.3, to chapter 1 step 4.1), `typealias` (1.4, to chapter 3 step 3.1), and `Task { @MainActor in }` (4.3, to chapter 1 step 2.9). Chapter 14 has none. `didSet`, `private(set)`, `@Published`, `@State`, `@ViewBuilder`, `some View`, `[weak self]`, the key path, `$0`, `??`, the ternary, `Task`, `for await`, and `#Preview` are `common`.
- Checkpoints and quiz answers match the code at each point. The three "as before" checkpoints of chapter 14 are correct for the Simulator.

## Suggestions for the generator, the validator, and the coordinator (not fixable on the pages)

1. **Picture `content/images/ch14-s5-7.jpg`.** A new capture from the Xcode canvas, or from a Simulator with an English region, would let the two caption sentences of finding 1 go. The caption of 5.10 already expects "0.5" in the canvas.
2. **Diagram `content/images/ch13-targets.svg`.** Still says "25 files" (round-1 suggestion 5). The alt text on the page says 26 + 3.
3. **Generator: a replaced template file.** 13.5.4, 13.6.3, and 13.6.5 still show "create the new file … and write the whole file yourself" for a file that Xcode created (round-1 suggestion 2 of chapter 13).
4. **Generator: `compiles=no` and a warning note.** The two chapters have six build gaps and two warning gaps, all in prose (round-1 suggestion 3 of chapter 13 and 4 of chapter 14). Finding 2 of this round is a wrong duration in such a sentence; a fence attribute would make the duration a computed value.
5. **Glossary: a constant that hides a parameter** (14.3.2) and **a synchronous method for an `async` requirement** (14.4.8): round-1 suggestions 1 and 2 of chapter 14, still open.
6. **Validator: white-space-only changes.** Three of the empty-line differences in chapter 13 (`CaptureService.swift` below the preset and below `stopRecording()`, `Camera.swift` below `start()`) are only in prose. A `--budget` note that lists the white-space-only lines of `git diff -w` versus `git diff` would give the writer the list.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2f.json && REPLAY_DIR=/tmp/replay-r2f python3 tools/replay.py /tmp/steps-r2f.json ch13-build ch14-build`): chapter 13, section 1 `claims=Y build=ok`, section 2 `claims=n build=FAILS` (known: the section ends with a Note that says that the project does not compile, and the page claims no build), section 3 `claims=Y build=unclear (brace position)` (known and acceptable), sections 4 to 6 `claims=Y build=ok`, end state equals the branch `chapter-13`. Chapter 14, sections 1 to 6 all `claims=Y build=ok`, end state equals the branch `chapter-14`.

## Verdict

**Chapter 13.** Ready for both personas. Every round-1 finding is fixed. The three new findings on this page are small text additions (a property name, the order of four lines, one empty line), all applied. The 15 Xcode steps name the template, the options, the targets, and the values that the project file on `chapter-13` has, and the two membership lists are complete. The self-implementer has every name, type, access level, argument label, string value, and modifier in the text or in the cover hints. The remaining warts are generator and diagram items (suggestions 2 to 4).

**Chapter 14.** Ready for both personas after this round. Every round-1 finding is fixed. The picture caption that contradicted step 5.10 is corrected, and the one wrong duration of a warning is corrected. The copier has one clear paste place per step and the one delete box. The self-implementer has every declaration and value in the captions and the hints. The remaining warts are the picture itself (suggestion 1) and the two glossary entries (suggestion 5).
