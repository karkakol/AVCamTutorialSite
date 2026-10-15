# Chapter 15 and 16 build pages: learner review, round 2

Date: 15 Oct 2026
Pages: `content/pages/ch15-build.md` (28 steps in 6 sections: 19 code steps, 9 checkpoints) and `content/pages/ch16-build.md` (40 steps in 6 sections: 33 code steps, 7 checkpoints), rendered as `dist/ch15-build.html` and `dist/ch16-build.html` after `node src/build.mjs`.

## Method

The same two personas as in round 1 went through all steps again. The copier reads the code card and the delete boxes. The self-implementer reads the "Try first" view: instruction, caption, cover (file, "Inside …", context lines, placeholders, the comment lines and string literals of the solution as hints, delete boxes), and the Swift cards and pointers. The rendered cover of each code step was extracted from the HTML (18 covers with "Inside …" on chapter 15, 34 on chapter 16; both builds complete) and compared with `git diff chapter-14 chapter-15 -- '*.swift'`, `git diff chapter-15 chapter-16 -- '*.swift'`, and `git show chapter-14:<file>` and `chapter-15:<file>` for the facts that the captions state (`makeStream` in `PhotoCapture`, `stopMonitoringDuration()`, `currentDevice`, `videoPreviewLayer`, `updatePreviewRotation(_:)`, the `defaultCamera` constant, `rotationCoordinator`). The glossary cards and pointers were checked against `src/lib/swift-notes.mjs`. The chapter 16 API facts were checked against `research/06-iphone-duo.md`.

The glossary now has entries for `Result<Success, Failure>`, `Type.self` (common), and `MainActor.assumeIsolated`. This closes suggestions 1 and 3 of the chapter 15 round-1 review and suggestion 1 of the chapter 16 round-1 review. Chapter 15 now shows one card (`Result` at 1.2) and five pointers (`AsyncStream` to chapter 2 step 5.2 at 1.2, 1.3, and 3.1; `Result` at 1.3, 1.4, 2.2, and 3.1; `nonisolated` to chapter 1 step 2.9 at 3.1). Chapter 16 shows two cards (`#available` at 2.3, `MainActor.assumeIsolated` at 3.5) and four pointers (`#available` and `@escaping` at 3.3, `@escaping` at 3.6, `if` with a condition list at 4.5, `Task { @MainActor in }` at 5.3).

## Verification of the round-1 findings: chapter 15

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 1.2 gives `let unexpectedResults: AsyncStream<Result<Movie, Error>>` and `private let unexpectedResultsContinuation: AsyncStream<Result<Movie, Error>>.Continuation`, and says that the stream is not private because the capture service reads it in section 3. |
| 2 | fixed | 2.5 gives the three lines `stopMonitoringDuration()`, `self.delegate = nil`, `unexpectedResultsContinuation.yield(result)` in this order, and says that the local constant `delegate` hides the property. |
| 3 | fixed | 2.2 gives `let result: Result<Movie, Error>` without a value, says why Swift permits it, and gives `if let error, !isMovieUsable(after: error)`, `.failure(error)`, and `.success(Movie(url: outputFileURL))`. |
| 4 | fixed | 2.1 gives `private func isMovieUsable(after error: Error) -> Bool`, the cast `(error as NSError).userInfo`, and the read `as? Bool ?? false`. |
| 5 | fixed | 2.4 gives `delegate.unexpectedFinishHandler = { [weak self] result in`, `guard let self else { return }`, and the warning until the next step. |
| 6 | fixed | 1.1 gives `enum MovieCaptureError: Error` with the case `notRecording`, and says to put it above the doc comment so that the comment stays with the class. The cover shows the placeholder between `import Combine` and the doc comment. |
| 7 | fixed | 1.4 gives `var unexpectedFinishHandler: ((Result<Movie, Error>) -> Void)?` and says why it is an optional variable. |
| 8 | fixed | 2.6 gives `guard let delegate, movieOutput.isRecording else { … }`, `continuation.resume(throwing: MovieCaptureError.notRecording)`, `return`, and the change from `delegate?.continuation` to `delegate.continuation`. |
| 9 | fixed | 1.3 gives `init()` with no parameters, `let (unexpectedResults, continuation) = AsyncStream.makeStream(of: Result<Movie, Error>.self)`, and the two stores with `self.`. The reference "the photo capture delegate from chapter 3" is correct: `ch03-build.md` adds `activityStream` with `makeStream(of:)`. |
| 10 | fixed | 3.3 gives `for await result in captureService.unexpectedRecordingResults`, says that `await` is not necessary because the property is `nonisolated`, says to leave the body empty, and names the warning. |
| 11 | fixed | 3.1 gives `nonisolated let unexpectedRecordingResults: AsyncStream<Result<Movie, Error>>`. 3.4 gives `try await mediaLibrary.save(movie: result.get())` and `self.error = error`. 5.1 names `rotationCoordinator` and gives `updateCaptureRotation(rotationCoordinator.videoRotationAngleForHorizonLevelCapture)`. |
| 12 | fixed | 2.7 names `stopMonitoringDuration()` and its place above the `resume` call. |

Counts: fixed 12, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 15, checked on the page: suggestions 1 and 3 (glossary `Result`, `Type.self`) are implemented. Suggestion 2 (a `let` without a value) is not in the glossary; the caption of 2.2 still explains it. Suggestions 4 (a constant that hides a property), 5 (a cover for a deletion-only step: 6.1 still has no cover), and 6 (a `warnings` attribute) are generator items and stay open.

## Verification of the round-1 findings: chapter 16

| # | Status | Evidence |
|---|--------|----------|
| 1 | fixed | 3.6 gives `private let directionsHandler: @MainActor (CameraDirections) -> Void`, `init(source: PreviewSource, onDirectionsChange directionsHandler: @escaping @MainActor (CameraDirections) -> Void = { _ in })`, and `self.directionsHandler = directionsHandler`. |
| 2 | fixed | 2.1 gives `struct CameraDirections: Sendable, Equatable`, `let forwardFacing: [String]`, `let backwardFacing: [String]`, and the reason for `Equatable`. |
| 3 | fixed | 2.2 gives `static var builtInCameraTypes: [AVCaptureDevice.DeviceType]` as a computed property, `var types: [AVCaptureDevice.DeviceType]`, the five types in order, the reason for `var`, and the warning. |
| 4 | fixed | 3.3 gives `func observeCameraDirections(with handler: @escaping @MainActor (CameraDirections) -> Void)`, the reasons for `@escaping` and `@MainActor`, and `guard #available(iOS 27.1, *) else { return }`. |
| 5 | fixed | 2.4 gives `func camera(withUniqueIDIn identifiers: [String]) -> AVCaptureDevice?`, "not `static`, not `private`", the constant `devices`, and says that the project does not compile until the next step. |
| 6 | fixed | 4.2 gives `func setCameraDirections(_ directions: CameraDirections)` without `private`, the body (`cameraDirections = directions`, `guard isSetUp else { return }`, `applyCameraDirections()`), and says that the project does not compile until two steps later. 4.4 says "The project compiles again after this step." |
| 7 | fixed | 6.1 gives `func setCameraDirections(_ directions: CameraDirections) async`, the reason for `async`, and says that the project does not compile until both models have the method. 6.2 says that it compiles again after the next step. |
| 8 | fixed | 5.1 gives `private func updatePreviewMirroring()`, `guard let` into `directions`, `let device = currentDevice`, and the warning. 5.2 gives `isFacingForward`, `isFacingBackward`, `isFrontCamera` with their expressions, `let needsOverride`, and the warning. |
| 9 | fixed | 1.3 gives `.onGeometryChange(for: CGFloat.self) { proxy in … } action: { difference in … }`, `GeometryProxy`, `proxy.safeAreaInsets.leading` and `.trailing`, `abs`, and `rounded()`. |
| 10 | fixed | 1.4 gives `.ignoresSafeArea(.container, edges: .horizontal)` and explains the region `.container`. |
| 11 | fixed | 5.3 gives `let connection = videoPreviewLayer.connection` before the task, the reason, and `guard let connection, connection.isVideoMirroringSupported else { return }`. |
| 12 | fixed | 3.5 names `forwardFacingDeviceDescriptors`, `backwardFacingDeviceDescriptors`, `.map(\.uniqueID)`, and the constant `directions`. |
| 13 | fixed | 4.3 gives `private func updateSelectedDirection(for device: AVCaptureDevice)` and explains `cameraDirections?.forwardFacing.contains(device.uniqueID) ?? (device.position == .front)`. 4.4 gives `private func applyCameraDirections()`, `directions`, `selectedID`, and `currentDevice.uniqueID`. |
| 14 | fixed | 4.5 names `candidates`, `!candidates.contains(selectedID)`, `let device = deviceLookup.camera(withUniqueIDIn: candidates)`, and `logger.debug`. The cover lists the log text. |
| 15 | fixed | 5.4 gives `automaticallyAdjustsVideoMirroring = false`, `isVideoMirrored = isFacingForward`, and `automaticallyAdjustsVideoMirroring = true` in the `else` branch. |
| 16 | fixed | 1.2 gives `@State private var sideInsetDifference = CGFloat.zero`. 3.2 gives `private var directionCoordinator: AnyObject?`. 4.1 gives `private var cameraDirections: CameraDirections?` and `private var isForwardFacingCameraSelected = false`. |
| 17 | fixed | 2.5 gives `let types = DeviceLookup.builtInCameraTypes`, the reason for `DeviceLookup.`, `min`, `types.firstIndex(of: $0.deviceType)`, `$1`, and `types.endIndex`. |
| 18 | fixed | 4.6 names the `defaultCamera` constant of `setUpSession()`. `git show chapter-15:AVCam/CaptureService.swift` has `let defaultCamera = try deviceLookup.defaultCamera` in that method. |
| 19 | fixed | 5.5 says "Replace the closing brace of the `if` statement with `} else {`, call `updatePreviewMirroring()`, and close the block." |
| 20 | fixed | 1.5 gives `.padding(.horizontal, sideInsetDifference / 2)` and the order. 2.3 gives `types += [...]`. 3.4 gives the full line with `view: self` and `{ directionMap in }`. 6.3 says "without `async`" and names `logger.debug`. 6.4 names the parameter `directions` and gives `Task { await camera.setCameraDirections(directions) }`. |

Counts: fixed 20, partly fixed 0, not fixed 0.

Round-1 suggestions for chapter 16, checked on the page: suggestion 1 (glossary `MainActor.assumeIsolated`) is implemented; the card is at 3.5. Suggestions 2 (`AnyObject` note in `AUTHORING.md`), 3 (a synchronous method for an `async` requirement), 4 (`compiles=no`), 5 (argument labels on the cover), and 6 (a `} else {` that replaces a brace) stay open. Suggestion 7: all six sections still print `claims=Y`.

## New findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 16.5.3 | copier and self-implementer | 5.2 said that the `needsOverride` warning stays "until the step that sets the mirroring". 5.3 adds the connection and the task but does not read `needsOverride`, and its caption said nothing. A learner who builds after 5.3 sees the warning and does not know if the step is wrong. Same class as chapter 14 round-2 finding 2. | low | The caption of 5.3 says "The warning that `needsOverride` is never used stays until the next step." |
| 2 | 16.2.2 | self-implementer | The solution writes the array of five types on two lines, with the second line aligned under the first element. The caption gave the five types but not the line break. A one-line array compiles and differs from the branch. Same class as chapter 14 round-1 finding 15. | low | The caption says "Write the list on two lines, as the solution shows, so that your file equals the branch." |
| 3 | 16.6.2 | self-implementer | The sentence "The `CameraDirections` value can make this step because it is `Sendable`" did not say what step. The sentence is about the value crossing from the main actor to the capture actor. | low | The sentence now says "can go from the main actor to the capture actor because it is `Sendable`". |

Counts: low 3. No instruction, main code fence, `remove` fence, or `copy` mark changed.

## Checks with no finding

- Copier, chapter 15: the delete boxes of 2.2 (seven lines), 2.6, 4.1 (two lines), 6.1 (two boxes), and 6.3 cover all 13 lines that `git diff chapter-14 chapter-15` removes or changes. No line is highlighted in two steps. The closing braces that git counts as added (the `}` of the `if`/`else` in 2.3 and the `}` of `isMovieUsable(after:)` in 2.1, which is the old `}` of `fileOutput` moved down) are each highlighted one time. The moved lines of 6.1/6.2 (the two `await` calls with their comments) are in the delete boxes of 6.1 and highlighted in 6.2; the validator accepts them.
- Copier, chapter 16: the two delete boxes (3.6, 6.4) cover the two removed lines. The `}` that 4.5 highlights becomes `} else {` in 5.5 (caption says so); the `}` that closes the `else` is typed in 5.5 ("close the block"); the `}` of `applyCameraDirections()` is highlighted in 4.4. The three new modifiers of section 1 are inserted in the order 1.3, 1.4 (above `onGeometryChange`), 1.5 (above `ignoresSafeArea`), and each fence shows the context that makes the place unique.
- Build gaps, chapter 15: 1.2 (error, caption), 3.1 (error, caption). Warning gaps: 2.2 (`result` written, never read; until 2.3), 2.4 (`self` bound, never used; until 2.5), 3.3 (`result` never used; until 3.4), each in the caption. 2.1 (an unused private method) and 1.4 (an unused stored property) give no warning. 6.1 (a closure without `await`) compiles with no warning.
- Build gaps, chapter 16: 2.4 (missing return; until 2.5), 4.2 to 4.3 (`applyCameraDirections()` missing; until 4.4), 6.1 to 6.2 (protocol requirement; until 6.3), each in the captions. Warning gaps: 2.2 (`types` never mutated; until 2.3), 5.1 (`directions` and `device` never used; until 5.2), 5.2 to 5.3 (`needsOverride` never used; until 5.4, now in both captions). 3.3 and 3.4 (an unused closure parameter, an unused method parameter) give no warning.
- Caption facts, chapter 15: `stopMonitoringDuration()` on `chapter-14` cancels the timer and sets `captureActivity = .idle` (2.5). `rotationCoordinator` is `AVCaptureDevice.RotationCoordinator!` on `chapter-14` (5.1). `updateCaptureRotation(_:)` is from chapter 3 (`ch03-build.md`). `MovieCapture()` has no initializer on `chapter-14`, so two constants without a value give the error "no initializers" (1.2).
- Caption facts, chapter 16: `currentDevice` on `chapter-15` calls `fatalError` when there is no video input (4.2). `updatePreviewRotation(_:)` on `chapter-15` reads `videoPreviewLayer.connection` before `Task { @MainActor in }` (5.3). `videoPreviewLayer` is a private computed property of the actor (5.3). `onGeometryChange(for:of:action:)` is available from iOS 16, so it needs no availability check (1.3). The API names, the device types, the iOS 27.1 checks, the main-actor rule, the mirroring order, and the new connection after a new input agree with `research/06-iphone-duo.md`.
- Covers: "Inside …" is correct on all 18 covers of chapter 15 that have it (1.1 is at file level) and on all 32 of chapter 16 that have it (2.1 and 3.1 are at file level). The placeholders are split correctly around the hint lines (for example 15.2.2 "1 of 3" to "3 of 3", 15.2.6 "1 of 3" to "3 of 3", 16.2.1 "1 of 3" to "3 of 3", 16.5.4 "1 of 3" to "3 of 3"). The two string literals of chapter 16 appear as hints (4.5, 6.3). Chapter 15 has no string literal in a highlighted line.
- Swift notes: the cards and pointers listed under "Method" match the glossary. `[weak self]`, `guard`, `if let x`, `??`, `$0`, `Task`, `for await`, the key path, `Sendable`, `@State`, the multiple trailing closures, and `Type.self` are `common` and get no pointer.
- Checkpoints and quiz answers match the code at each point. The experiment of chapter 15 section 3 (`maxRecordedDuration`) and of chapter 16 section 6 (`print(directions)`) each say to remove the temporary line.

## Suggestions for the generator, the validator, and the glossary (not fixable on the pages)

1. **Generator: `compiles=no` and a warning note.** The two chapters have five build gaps and six warning gaps, all in prose. Finding 1 of this round is a missing duration sentence in such a chain; a fence attribute would make the duration a computed value (round-1 suggestion 6 of chapter 15 and 4 of chapter 16).
2. **Generator: a deletion-only step.** 15.6.1 still has no cover in the "Try first" mode (round-1 suggestion 5 of chapter 15).
3. **Generator: a multi-line array literal.** Findings 2 of this round and 15 of chapter 14 round 1 are the same: the solution breaks an array literal over two lines, and only the prose can say so. The cover could show "this code has N lines" when a highlighted statement spans more than one line.
4. **Glossary: a `let` without a value** (15.2.2), **a constant that hides a property** (15.2.5), and **a synchronous method for an `async` requirement** (16.6.3): round-1 suggestions 2 and 4 of chapter 15 and 3 of chapter 16, still open.
5. **Generator: argument labels and a replaced brace** (16.3.6, 16.5.5): round-1 suggestions 5 and 6 of chapter 16, still open.

## Validate and replay results

- `npm run validate`: 38 pages checked, 0 errors, 0 warnings.
- Replay (`node src/dump-steps.mjs > /tmp/steps-r2g.json && REPLAY_DIR=/tmp/replay-r2g python3 tools/replay.py /tmp/steps-r2g.json ch15-build ch16-build`): chapter 15, sections 1 to 6 all `claims=Y build=ok`, end state equals the branch `chapter-15`; chapter 16, sections 1 to 6 all `claims=Y build=ok`, end state equals the branch `chapter-16`.

## Verdict

**Chapter 15.** Ready for both personas. All 12 round-1 findings are fixed, and this round found nothing new on the page. The copier has one clear paste place per step and six delete boxes that cover all 13 removed lines. The self-implementer has every declaration, type, access level, argument label, and value in the captions and the cover hints, and the `Result` card now explains the type at its first use. The remaining warts are generator items (the cover of 6.1, the warning sentences).

**Chapter 16.** Ready for both personas after this round. All 20 round-1 findings are fixed. The three new findings are small text additions (a warning duration, a line break, one unclear sentence), all applied. The API facts agree with the research notes. The remaining warts are generator and glossary items (suggestions 1, 3, 4, 5).
