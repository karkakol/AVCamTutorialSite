# Dossier 02 — Photo capture and saving to the Photos library

Scope: `AVCapturePhotoOutput`, the capture life cycle, async bridging, formats, resolution, quality, responsiveness, Live Photos, flash and related options, and PhotoKit saving.
Not in scope: session and device setup, video capture, system integration (other dossiers).

Sample: `/Users/karolkakol/tutorials/AVCamBuildingACameraApp` at commit `72b0fdb` (2026-08-20). Deployment target iOS 26.0, Swift language mode 5, `SWIFT_STRICT_CONCURRENCY = minimal` (`AVCam.xcodeproj/project.pbxproj:936`, `:949`, `:950`).
SDK used as ground truth: `iPhoneOS27.1.sdk` (Xcode 27.1, Swift 6.4 compiler).

Source tags used in this file:

| Tag | Meaning |
|---|---|
| [H] | SDK header on this Mac (`AVCapturePhotoOutput.h`, `AVCaptureDevice.h`, `AVCaptureOutputBase.h`, Photos headers) |
| [D] | Apple documentation page (JSON endpoint returned 200) |
| [W] | WWDC session transcript |
| [S] | The sample code |
| [A] | My analysis. Not confirmed on a device. |
| [E] | My experiment on this Mac (see section 2) |

All sample references use `path:line` relative to the repository root.

---

## 0. Key findings first

1. **The photo code at HEAD is the WWDC24 code.** `AVCam/Capture/PhotoCapture.swift` at HEAD differs from the version before commit `880e3f9` only in one apostrophe in the licence comment. The newest commit removed everything that `880e3f9` added to photo capture. See section 0.1.
2. **Two WWDC26 sessions matter, not one.** Session 303 is "Build a responsive camera app that launches quickly" (deferred start). Session 304 is "Implement high resolution photo capture" (12/18/24/48 MP, prepared settings, readiness). The code that commit `880e3f9` added matches session 304. The sample at HEAD contains only session 303 content.
3. **24 MP exists only with deferred delivery.** [H] The 24 MP size (5712 x 4284) "is only serviced as 24MP via deferred photo delivery". [W] WWDC26-304 says the same for 18 MP, and says 18/24 MP also need `.quality`.
4. **The `isolation` parameter in `monitorProgress` does nothing in this build configuration.** [E] In a model with the same shape, `#isolation` is `nil` and the `Task` runs off the session queue. See section 2.
5. **Nothing in the app stores the capture delegate. The progress `Task` keeps it alive.** [S][A] See section 2.
6. **The "Live" badge counter has a probable off-by-one.** [A] `PhotoCapture.swift:102` tests `livePhotoCount > 1`. Apple's own article says to hide the badge only when the count is zero. See section 7.
7. **A Live Photo request is not guarded by a support check.** [A] `PhotoCapture.swift:75` sets `livePhotoMovieFileURL` from the UI toggle only. [H] The output throws `NSInvalidArgumentException` if Live Photo capture is not enabled. See section 7.
8. **The sample asks for `.addOnly` but declares `NSPhotoLibraryUsageDescription`.** [S] It then reads the new asset back to make a thumbnail. Both points need a device test. See section 9.
9. **`MediaLibrary.swift` has no locked-capture branch.** [S] The capture extension compiles the same file and saves with PhotoKit. It does not use `sessionContentURL`. See section 9.
10. **The preview photo format is requested but never used.** [S] `PhotoCapture.swift:65-67` sets `previewPhotoFormat`. No code reads `previewPixelBuffer` or `previewCGImageRepresentation()`.

### 0.1 What the last two commits did to photo capture

Facts from `git log --stat -3` and `git diff`:

| Commit | Date | Message | `PhotoCapture.swift` |
|---|---|---|---|
| `880e3f9` | 2026-05-22 | "Add 24/48 and 18MP resolution selection in AVCam sample app" | +83 / -23 (230 lines to 290 lines) |
| `72b0fdb` | 2026-08-20 | "Incorporated WWDC26 session 303 content into AVCam." | +22 / -82 (back to 230 lines) |

**Commit `880e3f9` added** (all in the photo path):

- `PhotoFeatures.maxPhotoDimensions` and `CaptureCapabilities.supportedPhotoDimensions` (`DataTypes.swift`).
- A per-capture size choice: `photoSettings.maxPhotoDimensions = features.maxPhotoDimensions` when the active format supports it, otherwise the output maximum.
- `prepareForCapture(with:)`, which calls `photoOutput.setPreparedPhotoSettingsArray([settings])`.
- An `AVCapturePhotoOutputReadinessCoordinator` with a `ReadinessDelegate`, a published `captureReadiness`, and `startTrackingCaptureRequest(using:)` before each capture.
- Three switches: `isDeferredProcessingEnabled`, `isFastCapturePrioritizationEnabled`, `isResponsiveCaptureEnabled`, shown in a gear menu in `FeatureToolbar.swift`.
- A resolution picker in the toolbar ("12MP", "24MP", "48MP", "18MP"), built from `CMVideoDimensions.displayString`, which computes megapixels after a 4:3 crop.
- A `BusyShutterButton` (spinner) shown when `captureReadiness != .ready`.
- `CaptureService.switchToDeviceSupportingDimensions(_:)`, which changed the active format or the camera to reach a requested size.
- `.builtInUltraWideCamera` in the front discovery session (`DeviceLookup.swift`). [W] WWDC26-304 says 18 MP is only on the Center Stage front camera of iPhone 17.

**Commit `72b0fdb` removed all of the above** and added:

- Deferred start: `captureSession.automaticallyRunsDeferredStart = true` and `output.isDeferredStartEnabled = output.isDeferredStartSupported` (`CaptureService.swift:140`, `:143`, `:148`).
- A `hidden(until:)` view modifier. Controls fade in only when the session runs (`FeatureToolbar.swift:36`, `MainToolbar.swift:25`, `:35`).
- A preview cover on background/foreground changes (`PreviewContainer.swift:81-92`).
- It also deleted `loadInitialThumbnail()` from `MediaLibrary.swift`. That method was dead code. It existed since the WWDC24 commit and nothing called it.

**Why the removal might have happened.** These are hypotheses [A]. The repository gives no reason.

- H1, most likely: the session 303 work started from the WWDC25 code, and the publish overwrote the session 304 changes. Evidence: HEAD photo files are byte-identical to the pre-`880e3f9` files except for the comment line. Even small unrelated edits from `880e3f9` were reverted (for example `case .movieCapture(_)` in `DataTypes.swift:58`).
- H2: Apple chose to keep AVCam small. Session 304 needed format switching, a readiness spinner and a settings menu. That is a lot of UI for a "basic camera" sample.
- H3: the `880e3f9` code had rough edges. It created a new readiness coordinator on every `updateConfiguration(for:)` call. The coordinator calls its delegate on the main queue [H], and the delegate wrote `PhotoCapture.captureReadiness` from there with no isolation. `startTrackingCaptureRequest(using:)` ran off the main queue, but the header says the synchronous update happens only "when called on the main queue".

**What this means for the tutorial.**

- The README in the repository is stale. It still says "iOS 18 or later" and shows `EnabledPhotoFeatures` (`README.md:17`, `:213`). The online article says "iOS 26 or later" [D].
- The removed code is still the best Apple-written example of `setPreparedPhotoSettingsArray`, the readiness coordinator and per-shot `maxPhotoDimensions`. Read it with `git show 880e3f9:AVCam/Capture/PhotoCapture.swift`.
- One effect of the revert: HEAD always asks for the largest size (section 4), and nobody can pick 12 or 24 MP.

---

## 1. `AVCapturePhotoOutput` and the capture life cycle

### (a) Concept

A photo is not one event. It is a request that moves through stages: settings resolved, exposure, processing, delivery, end. `AVCapturePhotoOutput` reports each stage to a delegate. Several requests can be in flight at the same time.

Three objects carry the request:

- **`AVCapturePhotoSettings`** is what you ask for. It is mutable until you use it. It is single use. [H] The output copies it, and throws `NSInvalidArgumentException` if the `uniqueID` matches any settings used before. `uniqueID` is an `Int64`, unique for the life of the process.
- **`AVCaptureResolvedPhotoSettings`** is what you get. The output decides "auto" values (flash, size, fusion) at capture time. Every callback receives the resolved object. Its `uniqueID` equals the request `uniqueID`. This is the key that joins callbacks to requests.
- **`AVCapturePhoto`** is one result image in memory. It holds the encoded image, metadata, and optional extras (preview buffer, depth, mattes). `fileDataRepresentation()` flattens it to `Data` in the container format the settings asked for (HEIC, JPEG, DNG).

Two-level configuration is the central design rule. Expensive features are enabled on the **output** before the session runs. Each **settings** object then chooses within what the output prepared. Changing the output while the session runs causes a slow pipeline rebuild [H].

### (b) Key APIs

Start: `AVCapturePhotoOutput.capturePhoto(with:delegate:)`.

Delegate callbacks, `AVCapturePhotoCaptureDelegate`. All are optional at compile time. Some become mandatory at run time depending on the settings [H].

| Order | Swift name | When | Notes |
|---|---|---|---|
| Always first | `photoOutput(_:willBeginCaptureFor:)` | Settings are resolved | Read `livePhotoMovieDimensions`, `isFlashEnabled`, `photoDimensions`, `photoProcessingTimeRange`, `deferredPhotoProxyDimensions` here. |
| Middle | `photoOutput(_:willCapturePhotoFor:)` | Exposure starts | [H] Delivered right after the shutter sound. Good moment for a screen flash. |
| Middle | `photoOutput(_:didCapturePhotoFor:)` | Exposure ends | AVCam does not implement it. |
| Middle | `photoOutput(_:didFinishProcessingPhoto:error:)` | A processed or RAW image is ready | Fires `resolvedSettings.expectedPhotoCount` times. [H] `photo` is non-nil even when `error` is set. |
| Middle | `photoOutput(_:didFinishCapturingDeferredPhotoProxy:error:)` | A proxy is ready instead of the final image | iOS 17+. Mandatory when `isAutoDeferredPhotoDeliveryEnabled` is true. Replaces `didFinishProcessingPhoto` for that shot. |
| Middle | `photoOutput(_:didFinishRecordingLivePhotoMovieForEventualFileAt:resolvedSettings:)` | Live Photo movie stopped recording | File is not complete yet. [H] The right time to hide a "Live" badge. |
| Middle | `photoOutput(_:didFinishProcessingLivePhotoToMovieFileAt:duration:photoDisplayTime:resolvedSettings:error:)` | Movie file is complete | Mandatory when `livePhotoMovieFileURL` is set. |
| Always last | `photoOutput(_:didFinishCaptureFor:error:)` | Request is finished | Clean up here. No more callbacks follow. |

Order guarantee [H]: `willBeginCapture` is first and `didFinishCapture` is last. "None of the other callbacks can be assumed to come in any particular order." On error, all expected callbacks still fire, with an error.

Thread [H]: callbacks arrive "on a common dispatch queue — not necessarily the main queue".

Other useful members:

- `AVCapturePhotoSettings.init(from:)` clones settings with a new `uniqueID`.
- `AVCaptureResolvedPhotoSettings.expectedPhotoCount`, `AVCapturePhoto.photoCount` (1-based) tell you when the last image arrived.
- `AVCapturePhoto.fileDataRepresentation()`, `fileDataRepresentation(with:)` (customizer), `cgImageRepresentation()`, `previewCGImageRepresentation()`, `metadata`, `timestamp`, `isRawPhoto`, `pixelBuffer`, `previewPixelBuffer`.
- `setPreparedPhotoSettingsArray(_:completionHandler:)` pre-allocates resources for the kinds of capture you plan.

### (c) What AVCam does and why

- One `AVCapturePhotoOutput` lives in `PhotoCapture` (`AVCam/Capture/PhotoCapture.swift:22`). `CaptureService` owns it (`AVCam/CaptureService.swift:34`).
- Each shot builds fresh settings (`PhotoCapture.swift:54-83`) and a fresh delegate object (`:43`). One delegate per request means no dictionary keyed by `uniqueID`. Apple's article "Capturing still and Live Photos" recommends this [D].
- The delegate collects results in properties (`photoData`, `livePhotoMovieURL`, `isProxyPhoto`, `:146-150`) and reports once, in `didFinishCaptureFor` (`:206-229`). Apple's article "Tracking photo capture progress" recommends this: cache results, then save in `didFinishCapture` [D].
- It turns the image into `Data` inside the callback (`:203`, `:194`). `Data` is `Sendable`, so it can cross actors. `AVCapturePhoto` is not.
- It implements 7 of the callbacks. It skips `didCapturePhotoFor`.

Alternatives:

- One long-lived delegate with a `[Int64: CaptureState]` dictionary keyed by `uniqueID`. Needed if you want one object to own all state.
- Save the still image at once in `didFinishProcessingPhoto` and add the paired video later. This gets data to disk sooner but needs two Photos changes or an own file store.
- Return `AVCapturePhoto` itself and decide later how to encode. This allows `fileDataRepresentation(with:)` to strip location or replace the thumbnail. It needs `@unchecked Sendable` wrapping.

### (d) Pitfalls

- **Reused settings crash.** Create new settings for every call. Use `init(from:)` to copy.
- **Validation throws Objective-C exceptions, not Swift errors.** Swift `try` does not catch them. The header lists the rules at `AVCapturePhotoOutput.h:75-116`: format must be in `availablePhotoCodecTypes`, `photoQualityPrioritization` must not exceed `maxPhotoQualityPrioritization`, `flashMode` must be in `supportedFlashModes`, Live Photo must be enabled on the output, and so on.
- **Errors are easy to lose.** AVCam logs the error in `didFinishProcessingPhoto` and returns (`PhotoCapture.swift:199-202`). The final callback then reports either its own `error` or `PhotoCaptureError.noPhotoData` (`:220-223`). The original processing error does not reach the caller.
- **`cgImageRepresentation()` ignores EXIF orientation** [H]. Read `metadata[kCGImagePropertyOrientation]` yourself.
- **A BGRA `CGImage` of a 12 MP photo costs about 48 MB per call** [H]. Use the preview image for UI.
- **Photo capture is not supported with the Apple Log colour spaces** [H] (`AVCaptureColorSpace_AppleLog`, `AppleLog2`).
- **The settings object created at `PhotoCapture.swift:56` is thrown away** when HEVC is available (`:60`). This is harmless, but it is not a pattern to teach. An `if/else` is cleaner.

### (e) Beyond AVCam

- `setPreparedPhotoSettingsArray` [H][W]: prepares buffers ahead of time for RAW, brackets, or large sizes. Call it when the user enters a mode. The prepared object cannot be reused for the capture. Make a new one with the same configuration (WWDC26-304).
- `photoProcessingTimeRange` on the resolved settings tells you the expected wait. Show a spinner when the maximum is long [H][W].
- Bracketed capture: `AVCapturePhotoBracketSettings` with `AVCaptureAutoExposureBracketedStillImageSettings` or `AVCaptureManualExposureBracketedStillImageSettings`. Limit: `maxBracketedCapturePhotoCount`. No flash, no Live Photo.
- Virtual-device constituent photos: `isVirtualDeviceConstituentPhotoDeliveryEnabled` on the output and `virtualDeviceConstituentPhotoDeliveryEnabledDevices` on settings give one photo per physical camera, with optional `AVCameraCalibrationData`.
- Custom metadata: `AVCapturePhotoSettings.metadata` (ImageIO keys) is written into every photo of the request.
- `AVCapturePhotoFileDataRepresentationCustomizer` replaces or strips metadata, thumbnail, depth and mattes at flatten time.
- iOS 26: `isCameraSensorOrientationCompensationSupported/Enabled` [H]. Default is on when supported.

### (f) Links

See the table at the end: AVCapturePhotoOutput, AVCapturePhotoSettings, AVCaptureResolvedPhotoSettings, AVCapturePhotoCaptureDelegate, AVCapturePhoto, "Capturing still and Live Photos", "Tracking photo capture progress", WWDC16-501, WWDC16-511.

---

## 2. Bridging the delegate API to async/await

### (a) Concept

The capture API is "call now, get many callbacks later". Swift concurrency wants "await one value". AVCam bridges with two tools:

- A **checked throwing continuation** for the single final result. `withCheckedThrowingContinuation` suspends the caller and hands out a `CheckedContinuation`. Somebody must resume it exactly once. "Checked" means the runtime traps on a double resume and logs a leak if it is never resumed.
- An **`AsyncStream`** for progress events. A stream can yield many values and then finish.

### (b) Key APIs

- `withCheckedThrowingContinuation(isolation:function:_:)`, `CheckedContinuation.resume(returning:)`, `resume(throwing:)`.
- `AsyncStream.makeStream(of:bufferingPolicy:)` returns `(stream, continuation)`. `AsyncStream.Continuation.yield(_:)`, `finish()`.
- `#isolation` macro and `isolated (any Actor)?` parameters (SE-0420).
- `Task { }` and its isolation inheritance.
- Custom actor executor: `unownedExecutor` (SE-0392). `CaptureService` runs on a serial `sessionQueue` (`CaptureService.swift:68-73`).

### (c) What AVCam does and why

The flow, in order:

1. `CameraModel.capturePhoto()` (main actor) awaits `captureService.capturePhoto(with:)` (`CameraModel.swift:125-133`).
2. `CaptureService.capturePhoto` forwards to `PhotoCapture.capturePhoto` (`CaptureService.swift:482-484`).
3. `PhotoCapture.capturePhoto` opens the continuation (`PhotoCapture.swift:38`). The closure runs at once, synchronously. It builds settings, creates the delegate with the continuation inside it (`:43`), starts monitoring (`:44`), and calls the output (`:47`). Then the function suspends.
4. The delegate yields `CaptureActivity` values into its `AsyncStream` (`:168`, `:173`, `:178`).
5. `monitorProgress` runs a `Task` that reads the stream and writes `captureActivity` (`:89-111`).
6. In `didFinishCaptureFor`, the delegate finishes the stream (`:210`, in a `defer`) and resumes the continuation once (`:215`, `:221` or `:228`).
7. `CaptureService` merges `photoCapture.$captureActivity` and `movieCapture.$captureActivity` with Combine and re-publishes (`CaptureService.swift:539-542`). `CameraModel` reads the values as an async sequence (`CameraModel.swift:205-216`). A `willCapture` value triggers the screen flash (`:208-210`, `CameraView.swift:59`).

**Delegate lifetime.** No property stores the delegate. Three things could hold it:

- The photo output. The old AVCam source says it does not: "The photo output holds a weak reference to the photo capture delegate" (`git show eadd5ab:Swift/AVCam/CameraViewController.swift`, line 705). The old sample kept a dictionary `inProgressPhotoCaptureDelegates` for this reason. The current header does not state the reference type.
- The `Task` in `monitorProgress`. Its closure captures `delegate` to read `delegate.activityStream` (`PhotoCapture.swift:94`). [A] This strong capture is what keeps the delegate alive. The task ends when the stream finishes, which happens in `didFinishCaptureFor`.
- The local variable in the continuation closure. It dies when the closure returns.

So the life of the delegate is: created, kept by the task, released after the last callback. This is neat, but it is implicit. If you remove the progress stream, the delegate dies at once and no callback arrives. The tutorial should say this in plain words.

**The `isolation` parameter.** The signature is:

```swift
private func monitorProgress(of delegate: PhotoCaptureDelegate, isolation: isolated (any Actor)? = #isolation)
```

The intent [A]: `PhotoCapture` is a plain class, not an actor. `CaptureService` owns it and wants all its state touched on the session queue. `monitorProgress` writes `livePhotoCount` and `captureActivity`. A plain `Task { }` in a non-isolated method runs on the global executor. With an `isolated` parameter, the function becomes isolated to the actor passed in. `#isolation` as default value passes the caller's actor. A `Task { }` inherits that isolation only if its closure captures the isolated parameter (SE-0420). That is why the body has the odd line `_ = isolation` (`PhotoCapture.swift:91`).

**Does it work here?** [E] I built a small model with the same shape: an actor with a custom serial-queue executor calls an `async` method on a plain class, which calls `withCheckedContinuation`, and inside the closure calls a function with `isolation: isolated (any Actor)? = #isolation` that starts a `Task`. Files: `scratchpad/research/iso/main.swift`, `varA.swift`, `varB.swift`, `varC.swift`. Compiler: Swift 6.4, `-swift-version 5 -strict-concurrency=minimal`, the same settings as the app target.

| Variant | Class method runs on session queue | `isolation` value in `monitor` | Task runs on session queue |
|---|---|---|---|
| As in AVCam | no | `nil` | no |
| `-enable-upcoming-feature NonisolatedNonsendingByDefault` | yes | `nil` | no |
| A: `capture(isolation: isolated (any Actor)? = #isolation)` only | yes | `nil` | no |
| B: variant A, and pass it on: `monitor(isolation: isolation)` | yes | non-nil | **yes** |

Reading of the result [A]:

- `PhotoCapture.capturePhoto` is a non-isolated `async` method. In Swift 5 mode it leaves the actor and runs on the global executor (SE-0461 describes this old behaviour and the new option).
- Inside the continuation closure, `#isolation` is `nil`, because that closure is not isolated.
- So in AVCam the progress task and the call to `photoOutput.capturePhoto` run off the session queue. `livePhotoCount` and `captureActivity` are written from global-executor threads. Two overlapping captures can race. `minimal` concurrency checking hides this.
- Variant B is a verified fix: give `capturePhoto` its own isolated parameter and pass it explicitly.

Caveat: this is a model on macOS, not the app on a device. Confirm in the app with `dispatchPrecondition(condition: .onQueue(sessionQueue))` or a breakpoint before you state it as fact in the tutorial.

Related [A]: `Publishers.Merge(...).assign(to: &$captureActivity)` (`CaptureService.swift:540-541`) writes an actor property from whatever thread publishes. It works, and it also bypasses actor isolation.

Alternatives:

- Per-capture delegate with completion closures and an explicit `Set` or dictionary of in-flight delegates. This is the classic pattern in Apple's article [D].
- One `AsyncThrowingStream<CaptureEvent, Error>` whose last event carries the photo. One primitive instead of two.
- Make `PhotoCapture` an actor that shares the executor of `CaptureService`, and mark delegate methods `nonisolated`.

### (d) Pitfalls

- **Resume exactly once.** Every exit path of the final callback must resume. AVCam does this in one method only, which is the safe design.
- **A continuation that never resumes leaks the awaiting task.** If the delegate were released early, `capturePhoto()` would hang forever.
- **No cancellation.** Cancelling the Swift task does not cancel the capture.
- **`AsyncStream` buffers without limit by default.** Fine here (three or four events).
- **The published activity never returns to `.idle`** after a photo [A]. The stream ends with a `.photoCapture(...)` value. Nothing resets it. `.idle` is only the initial value (`PhotoCapture.swift:19`).
- **Delegate state is not locked.** It is safe only because the output serializes callbacks on one queue [H].

### (e) Beyond AVCam

- `AsyncStream.makeStream(of:bufferingPolicy: .bufferingNewest(1))` for UI state where only the last value matters.
- `withTaskCancellationHandler` if you add a cancellable step (for example your own post-processing).
- Swift 6 language mode with full checking would flag the cross-isolation writes found above.

### (f) Links

`withCheckedThrowingContinuation`, `CheckedContinuation`, `AsyncStream`, `makeStream`, `#isolation`, `unownedExecutor`, SE-0300, SE-0314, SE-0388, SE-0392, SE-0420, SE-0461, WWDC21-10132, WWDC21-10058. See the table.

---

## 3. Formats

### (a) Concept

A photo request names a **codec** and, optionally, a **file container**.

- **HEIF/HEVC**: HEVC-compressed image in a HEIF container (`.heic`). [D] "Improved image quality at smaller file sizes" than JPEG. [H] HEIC files can hold depth data, mattes and thumbnails up to full resolution.
- **JPEG**: the default of `AVCapturePhotoSettings()` [H]: codec `.jpeg`, file type `.jpg`, prioritization `.balanced`.
- **Uncompressed**: a pixel format such as `420f` or `BGRA`. You get a `CVPixelBuffer` in `photo.pixelBuffer`.
- **RAW**: Bayer RAW (minimal processing) or Apple ProRAW (demosaiced, fused, still scene-referred, stored as Linear DNG).

Two small images can go with the main one [D]:

- A **preview image**: uncompressed, screen size or smaller, in memory only, for instant UI feedback.
- An **embedded thumbnail**: compressed, stored inside the file for other software.

### (b) Key APIs

- `photoOutput.availablePhotoCodecTypes`, `availablePhotoPixelFormatTypes`, `availablePhotoFileTypes`, `supportedPhotoCodecTypes(for:)`. All are empty until the output is in a session with a video source [H].
- `AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])`. A compressed format may add `AVVideoCompressionPropertiesKey: [AVVideoQualityKey: 0...1]`.
- `AVCapturePhotoSettings(rawPixelFormatType:rawFileType:processedFormat:processedFileType:)`.
- `settings.availablePreviewPhotoPixelFormatTypes`, `settings.previewPhotoFormat`. Optional `kCVPixelBufferWidthKey` and `kCVPixelBufferHeightKey` (both or neither).
- `settings.availableEmbeddedThumbnailPhotoCodecTypes`, `settings.embeddedThumbnailPhotoFormat` (`AVVideoCodecKey`, optional `AVVideoWidthKey`/`AVVideoHeightKey`).
- Results: `photo.previewPixelBuffer`, `photo.previewCGImageRepresentation()`, `resolvedSettings.previewDimensions`, `embeddedThumbnailDimensions`.

### (c) What AVCam does and why

- It uses HEVC when present, else the JPEG default (`PhotoCapture.swift:56-61`). This is the pattern from Apple's article [D].
- It requests a preview image in the first available pixel format (`:65-67`). [H] The list is sorted so that the first entry needs the fewest conversions. It sets no size, so the system picks one.
- It never reads the preview image [S]. The thumbnail in the UI comes from Photos after the save (`MediaLibrary.swift:114-124`). The preview request is left over from the older AVCam design. It costs a little memory per shot for no gain.

Alternative for the tutorial: use `photo.previewCGImageRepresentation()` for the thumbnail. It is ready at capture time, needs no Photos read access, and also works for proxies. [H] For a deferred proxy, `pixelBuffer`, `previewPixelBuffer` and both `CGImage` methods all return the same proxy image.

### (d) Pitfalls

- Passing a codec that is not in `availablePhotoCodecTypes` throws.
- `.hevc` is only valid in HEIF/HEIC containers [H].
- Wide colour: the output follows the device `activeColorSpace`. `420v` output drops wide colour [H].
- The preview image has no metadata and is not rotated. Apply the orientation from the main image.
- With responsive capture on, uncompressed output disables overlap. [H] You must release the `AVCapturePhoto` and its pixel buffer before the next capture.

### (e) Beyond AVCam (overview only)

- **Bayer RAW** [H]: `availableRawPhotoPixelFormatTypes`, test with `AVCapturePhotoOutput.isBayerRAWPixelFormat(_:)`. Rules: prioritization must be `.speed`, zoom must be 1.0, no red-eye reduction on the RAW image.
- **Apple ProRAW** [H]: `isAppleProRAWSupported` / `isAppleProRAWEnabled` on the output (iOS 14.3+, slow to enable, set before `startRunning`). Test formats with `isAppleProRAWPixelFormat(_:)`. Rules: no Live Photo movie, no portrait matte, no segmentation mattes, no content-aware distortion correction. iOS 18 adds `availableRawPhotoCodecTypes` and `settings.rawFileFormat` (bit depth 8-16 with `AVVideoAppleProRAWBitDepthKey`, lossy or lossless with `AVVideoQualityKey`).
- RAW + processed in one request gives two `didFinishProcessingPhoto` calls. Check `photo.isRawPhoto`. Deferred delivery never applies to RAW [H].
- **Depth** [H]: `isDepthDataDeliverySupported/Enabled` on the output, `isDepthDataDeliveryEnabled`, `embedsDepthDataInPhoto`, `isDepthDataFiltered` on settings, result in `photo.depthData`. Stored in HEIF and JPEG only. Enabling depth can turn off zero shutter lag and responsive capture.
- **Portrait effects matte** [H]: needs depth. `isPortraitEffectsMatteDeliveryEnabled` on output and settings. `photo.portraitEffectsMatte` can be `nil` when there is no clear subject.
- **Semantic segmentation mattes** [H]: types `.skin`, `.hair`, `.teeth` (iOS 13) and `.glasses` (iOS 14.1). Enable the superset on the output with `enabledSemanticSegmentationMatteTypes`, then choose per shot. Read with `photo.semanticSegmentationMatte(for:)`.
- **Content-aware distortion correction** (iOS 14.1) for wide lenses.

### (f) Links

"Capturing thumbnail and preview images", "Capturing uncompressed image data", "Capturing photos in RAW and Apple ProRAW formats", "Capturing photos with depth", AVPortraitEffectsMatte, AVSemanticSegmentationMatte, AVDepthData, WWDC17-513, WWDC21-10160, WWDC19-225.

---

## 4. Resolution

### (a) Concept

A camera format streams video at one size and can make photos at other, larger sizes. Since iOS 16 the format publishes a list of allowed photo sizes. You set a ceiling on the output once, and a ceiling per shot on the settings. The result can be smaller than the ceiling, never larger [H].

Sizes on current iPhones [W, WWDC26-304]:

| Size | How it is made | Needs |
|---|---|---|
| 12 MP (4032 x 3024) | Binned pixels, multi-frame fusion | Any prioritization |
| 48 MP | One full-resolution frame from the quad-pixel sensor | `.balanced` or `.quality` |
| 24 MP (5712 x 4284) | A 12 MP fused image combined with a 48 MP frame | `.quality` and deferred delivery |
| 18 MP | Multi-frame fused, Center Stage front camera of iPhone 17 only | `.quality` and deferred delivery |

Hardware [W]: 48 MP from iPhone 14 Pro. 24 MP from iPhone 15. Telephoto on iPhone 16 Pro and ultra wide on iPhone 17 also support 24/48 MP. Only the `.photo` session preset supports 24 and 48 MP.

The header states only the 24 MP dimensions. It does not state the 48 MP or 18 MP dimensions. (48 MP is commonly 8064 x 6048. Print `supportedMaxPhotoDimensions` on a device to confirm.)

### (b) Key APIs

- `AVCaptureDevice.Format.supportedMaxPhotoDimensions: [CMVideoDimensions]` (iOS 16).
- `AVCapturePhotoOutput.maxPhotoDimensions`. Must be one of the format's values. Changing it can trigger a slow reconfiguration.
- `AVCapturePhotoSettings.maxPhotoDimensions`. Must be one of the format's values and not larger than the output value. [H] Default is the **smallest** supported size.
- `AVCaptureResolvedPhotoSettings.photoDimensions` is the real size. With a proxy, `photoDimensions` is the final size and `deferredPhotoProxyDimensions` is the proxy size [H].
- Deprecated in iOS 16 [H]: `AVCapturePhotoOutput.isHighResolutionCaptureEnabled`, `AVCapturePhotoSettings.isHighResolutionPhotoEnabled`, `AVCaptureDevice.Format.highResolutionStillImageDimensions`. Message: "Use maxPhotoDimensions instead."

**Why `highResolutionCaptureEnabled` is deprecated** [A]: a Boolean can say only "stream size" or "largest size". With a 48 MP sensor one format offers three sizes or more. A list of sizes replaces the switch. The deprecation arrived in iOS 16, the release for iPhone 14 Pro. Note: two Apple articles still show `isHighResolutionCaptureEnabled = true` in their code [D]. Do not copy that.

### (c) What AVCam does and why

- On every pipeline change it sets the output ceiling to the last entry of the list (`PhotoCapture.swift:121`).
- Each shot copies the output ceiling into the settings (`:72`). Without this line the shot would use the smallest size (the default).
- Result: AVCam always asks for the largest size the active format offers. On a 48 MP camera with `.speed`, the system gives a smaller photo. The request "is a request, not a guarantee" [W].
- The session uses the `.photo` preset in photo mode (`CaptureService.swift:135`, `:281`), so the large sizes are offered.

Alternative: the `880e3f9` design. Publish the list to the UI, let the user choose, validate the choice against the current format, and fall back to the output ceiling.

### (d) Pitfalls

- `supportedMaxPhotoDimensions.last` assumes ascending order. The header does not promise an order. The removed code sorted the values itself. Use `max(by:)` on the pixel count to be safe.
- `?? .zero` (`PhotoCapture.swift:121`) [A]: if the list were empty, the code would set `{0, 0}`, which is not a supported value. The header says the value "must match one of the dimensions". Guard this case. It matters for external cameras on iPad.
- Setting the output ceiling to 48 MP reserves more memory even if every shot is 12 MP.
- 24 MP without `isAutoDeferredPhotoDeliveryEnabled` silently gives another size [H].
- Large captures need `setPreparedPhotoSettingsArray` to avoid a slow first shot [W].
- `CMVideoDimensions` is not `Equatable` in the SDK. AVCam adds the conformance with `@retroactive` (`AVCam/Support/CaptureExtensions.swift:10-21`). Its `<` is true only if both width and height are smaller, so it is not a total order.
- Video stabilization or disabling geometric distortion correction can shrink the photo [H].

### (e) Beyond AVCam

- Per-shot choice between 12, 24 and 48 MP in one session with no reconfiguration [W].
- `AVCaptureDevice.Format.isHighestPhotoQualitySupported` marks "photo formats" [H]. `isHighPhotoQualitySupported` (iOS 15) marks video formats that can still produce high-quality stills.
- `secondaryNativeResolutionZoomFactors` on the format (the "2x optical quality" crop of a 48 MP sensor). This belongs to the device dossier.

### (f) Links

`maxPhotoDimensions` (output and settings), `supportedMaxPhotoDimensions`, `isHighResolutionCaptureEnabled`, WWDC26-304, WWDC21-10247.

---

## 5. Quality prioritization

### (a) Concept

The camera has many processing paths. You do not choose an algorithm. You state what you value, and the system picks. [W, WWDC21-10247] "The quality prioritization specified only serves as a hint ... it doesn't dictate what algorithms to use."

Three levels, `AVCapturePhotoOutput.QualityPrioritization` (iOS 13), raw values 1, 2, 3 [H]:

| Level | Meaning | What Apple says about processing (photo formats) |
|---|---|---|
| `.speed` | Fastest delivery, lower quality | [W] "WYSIWYG" photos, "lightly processed only with some noise reduction applied". Fit for bursts. |
| `.balanced` | Middle | [W] "a collection of fast fusion algorithms". Default for settings and for the output on `AVCaptureSession`. |
| `.quality` | Best quality, longest wait | [W] "depending on the current device and lux level ... heavy machineries such as Deep Fusion". WWDC23 names Deep Fusion on iPhone 11 Pro and newer. |

What is documented and what is not:

- The names "Deep Fusion", "Smart HDR", "Night mode" and "Photonic Engine" do **not** appear in any AVFoundation header in this SDK (grep found none). They appear only in WWDC talks: Smart HDR and Deep Fusion in WWDC21-10247 and WWDC23-10105, Photonic Engine in WWDC26-304.
- I found no Apple statement that third-party apps get Night mode. Do not promise it in the tutorial.
- [H] Setting `maxPhotoQualityPrioritization = .quality` turns on optical image stabilization if the active format has `isHighPhotoQualitySupported`.
- [W] `.balanced` and `.quality` may "fuse several differently exposed images to improve dynamic range". The photo can then look different from video recorded at the same time.
- [W] For video formats without high photo quality, all three levels use the lightest processing.

### (b) Key APIs

- `photoOutput.maxPhotoQualityPrioritization`: the ceiling. Default `.balanced` on `AVCaptureSession`, `.speed` on `AVCaptureMultiCamSession` [H]. Changing it while running causes a long rebuild.
- `photoSettings.photoQualityPrioritization`: per shot. Must not exceed the ceiling, or the call throws.
- `resolvedSettings.photoProcessingTimeRange`: expected minimum (`start`) and maximum (`start + duration`) wait.
- Deprecated since iOS 13: `isAutoStillImageStabilizationEnabled`, `isStillImageStabilizationSupported`, `isStillImageStabilizationScene`.

### (c) What AVCam does and why

- The output ceiling is `.quality` (`PhotoCapture.swift:123`), so the user may choose any level per shot.
- The app enum `QualityPrioritization` has raw values 1-3 on purpose (`AVCam/Model/DataTypes.swift:117-121`). `PhotoCapture.swift:78` converts by raw value. This keeps AVFoundation out of the model and the views.
- The default is `.quality` (`CameraModel.swift:144`, `AVCam/Model/CameraState.swift:17`). The value is stored in the shared `CameraState` so the Lock Screen extension starts with the same choice (`CameraModel.swift:93`, `:147`).
- UI: a menu with three entries and a dial icon (`FeatureToolbar.swift:48-68`).
- `.quality` is practical only because AVCam also turns on responsive capture, fast capture prioritization and deferred delivery (`PhotoCapture.swift:124-126`).

Alternative: fix the level at `.balanced` and drop the menu. Simpler, and it is Apple's default.

### (d) Pitfalls

- A per-shot level above the ceiling throws.
- A ceiling of `.quality` costs memory and power all the time. [W] "Choose responsibly and only take what you need."
- Bayer RAW needs `.speed` [H].
- With fast capture prioritization on, the system may lower `.quality` to `.balanced` during rapid shooting. Check `resolvedSettings.isFastCapturePrioritizationEnabled`.
- `.quality` during a movie recording can drop video frames (apps linked on iOS 15 or later) [H].
- Size depends on the level (section 4): 24 MP needs `.quality`, 48 MP needs at least `.balanced`.

### (e) Beyond AVCam

- Show a spinner when `photoProcessingTimeRange` is long.
- Use `.speed` when the still must match a video frame.
- `photoSettingsForSceneMonitoring` with `isFlashScene` for a live "flash will fire" indicator.

### (f) Links

`AVCapturePhotoOutput.QualityPrioritization`, `maxPhotoQualityPrioritization`, `photoQualityPrioritization`, `photoProcessingTimeRange`, `isHighPhotoQualitySupported`, WWDC21-10247, WWDC23-10105.

---

## 6. Responsiveness

### (a) Concept

A request has three phases: capture frames, process them, encode [W]. By default the next request waits until the last one finishes processing. That wait is the shot-to-shot time. Five features attack the delay. They build on each other.

| Feature | What it does | Enable | Since | Depends on |
|---|---|---|---|---|
| Zero shutter lag (ZSL) | Keeps a ring buffer of past frames. The photo uses frames from the moment of the tap, not after it. | Automatic when supported, for apps linked on iOS 17+. Opt out with `isZeroShutterLagEnabled = false`. | iOS 17 | Photo preset or a format with `isHighestPhotoQualitySupported` [W] |
| Responsive capture | Overlaps phases. A new capture starts while the last one is processing. | `isResponsiveCaptureEnabled` | iOS 17, A12 or newer [W] | ZSL enabled [H] |
| Fast capture prioritization | Detects rapid shooting and lowers quality toward `.balanced` to keep the pace. | `isFastCapturePrioritizationEnabled` | iOS 17, A12 or newer [W] | Responsive capture enabled [H] |
| Deferred photo delivery | Delivers a light proxy now. Photos finishes the processing later. | `isAutoDeferredPhotoDeliveryEnabled` | iOS 17, iPhone 11 Pro or newer [W]. Not on Mac Catalyst [H]. | Photo preset [W] |
| Capture readiness | Tells the UI when another shot makes sense. | `captureReadiness`, `AVCapturePhotoOutputReadinessCoordinator` | iOS 17, all devices | — |

Also related, iOS 26: **deferred start** (`AVCaptureOutput.isDeferredStartEnabled`). The photo output initializes after the first preview frame. [H][W] To accept shots before it is ready, enable responsive capture. AVCam relies on this (`MainToolbar.swift:27-28`). Details belong to the session dossier.

**Deferred delivery in detail.**

- It is automatic per shot. There is no per-settings switch [W]. If the shot would need long processing, you get `didFinishCapturingDeferredPhotoProxy`. Otherwise you get `didFinishProcessingPhoto`. One session produces both kinds. [W] Example: a flash capture at `.quality` is not deferred.
- `AVCaptureDeferredPhotoProxy` is a subclass of `AVCapturePhoto` [H]. Its `fileDataRepresentation()` holds a proxy-quality image plus a reference to intermediate data that your process cannot read.
- You must save it with `PHAssetCreationRequest.addResource(with: .photoProxy, data:options:)`. [H] Data that does not come from a proxy fails with `PHPhotosErrorInvalidResource`.
- Photos finishes the image on demand, when someone requests the image data, or in the background when the device is idle [H][W].
- [H] Save "as quickly as possible". A periodic job removes abandoned intermediates. [W] The app can also be suspended or killed in the background before it saves.
- [W] Changes made with a file-data customizer or to pixels do not appear in the final photo. Apply them later as Photos adjustments.
- [W] Write access is enough to store the proxy. Read access is needed to show or edit the final photo.
- [W, WWDC26-304] Background processing does not share memory with the capture session. That is why 18 and 24 MP fusion is possible only this way. From iOS 27 on iPhone 16 and 17, `.balanced` fast captures are also deferred.

**Capture readiness.** `AVCapturePhotoOutput.CaptureReadiness` [H]:

| Value | Meaning | Suggested UI [H] |
|---|---|---|
| `.sessionNotRunning` | No session | — |
| `.ready` | Take the shot | Enabled |
| `.notReadyMomentarily` | Brief pause | Disable input, do not change the look |
| `.notReadyWaitingForCapture` | Busy capturing (flash, long exposure) | Dim the button |
| `.notReadyWaitingForProcessing` | Busy processing | Dim, show a spinner |

The output still accepts requests when not ready. They just wait longer [H]. The coordinator exists because the app calls the output on a background queue but must update the button on the main thread at once. Call `startTrackingCaptureRequest(using: settings)` on the main queue at the tap, then call `capturePhoto` on the session queue with the same settings. The delegate is called on the main queue, and synchronously when you start tracking from the main queue [H]. If the capture call does not happen, call `stopTrackingCaptureRequest(using: uniqueID)`.

### (b) Key APIs

`isZeroShutterLagSupported/Enabled`, `isResponsiveCaptureSupported/Enabled`, `isFastCapturePrioritizationSupported/Enabled`, `isAutoDeferredPhotoDeliverySupported/Enabled`, `captureReadiness`, `AVCapturePhotoOutputReadinessCoordinator`, `AVCapturePhotoOutputReadinessCoordinatorDelegate.readinessCoordinator(_:captureReadinessDidChange:)`, `AVCaptureDeferredPhotoProxy`, `resolvedSettings.deferredPhotoProxyDimensions`, `resolvedSettings.isFastCapturePrioritizationEnabled`, `PHAssetResourceType.photoProxy`, `PHImageRequestOptions.allowSecondaryDegradedImage`.

### (c) What AVCam does and why

- `updateConfiguration(for:)` sets each feature to its "supported" value (`PhotoCapture.swift:124-126`). The order is correct: responsive first, then fast capture, because the second depends on the first.
- It runs again after every camera or mode change (`CaptureService.swift:525-535`), because [H] these flags fall back to `false` when a new configuration does not support them. The calls happen before `startRunning` or inside `beginConfiguration`/`commitConfiguration` (`CaptureService.swift:274-275`, `:330-331`), as the header asks.
- ZSL is not mentioned in the code. It is on by default for this deployment target.
- The delegate handles both result kinds and records which one it got (`PhotoCapture.swift:188-204`). The flag travels in `Photo.isProxy` (`DataTypes.swift:84-88`) and selects `.photoProxy` or `.photo` (`MediaLibrary.swift:61`).
- AVCam at HEAD has **no** readiness handling. The shutter is always enabled (`CaptureButton.swift:36-40`). Each tap starts a new `Task`, so captures overlap freely.

Alternatives: the `880e3f9` version (readiness coordinator, spinner, user switches). Or no deferred delivery at all, if the app must show or share the final image at once [W].

### (d) Pitfalls

- **Late save of the proxy** [A]. AVCam waits for `didFinishCaptureFor`, which for a Live Photo comes after the movie is complete. Then `MediaLibrary.save(photo:)` first awaits a location update (`MediaLibrary.swift:54`, `:130-138`) and only then writes. This is the opposite of "as quickly as possible". A tutorial version should start the Photos write without waiting for location.
- **No time-out on location** [A]. `CLLocationUpdate.liveUpdates().first(...)` can take long if no update arrives. The photo data waits in memory.
- **Tap-up, not tap-down** [A]. The SwiftUI `Button` fires on release (`CaptureButton.swift:72-74`), then a `Task` hops to the main actor and to the capture actor. [H] recommends calling `capturePhoto` "as early as possible when handling the touch down event", because ZSL reaches back in time and a late call adds shake.
- ZSL does not apply to flash, manual exposure, brackets or constituent photo delivery [H][W].
- Responsive capture raises peak memory [W].
- With responsive capture, `willBeginCapture` for shot B can arrive before `didFinishProcessingPhoto` for shot A [H]. Per-request delegate objects make this harmless.
- Setting an "enabled" flag to `true` when "supported" is `false` throws [H].
- `.photoProxy` with normal data fails. `.photo` with proxy data stores only the low-quality proxy.
- Without Photos read access you cannot show the final deferred image.

### (e) Beyond AVCam

- Readiness coordinator with a dimmed or spinning shutter.
- `PHImageRequestOptions.allowSecondaryDegradedImage` (iOS 17): a better interim image while a deferred photo finishes [W].
- User switches for the three features (Camera's own setting is called "Prioritize Faster Shooting") [W].
- `setPreparedPhotoSettingsArray` for the first-shot delay.

### (f) Links

WWDC23-10105 (main source), WWDC26-303, WWDC26-304, AVCaptureDeferredPhotoProxy, AVCapturePhotoOutputReadinessCoordinator, the four `is…Enabled` property pages, `PHAssetResourceType.photoProxy`.

---

## 7. Live Photos

### (a) Concept

A Live Photo is two files and one identity: a still image and a short QuickTime movie (about 3 seconds, around the moment of capture) with sound. Both carry the same content identifier. The photo has it in its Apple MakerNote. The movie has it as `AVMetadataQuickTimeMetadataKeyContentIdentifier` [H]. Photos pairs them by this identifier. The output generates the identifier for you.

The movie comes from a rolling buffer that the photo output keeps while Live Photo capture is enabled. That buffer is why the feature must be enabled on the output ahead of time, and why it conflicts with a movie file output.

### (b) Key APIs

- Output: `isLivePhotoCaptureSupported`, `isLivePhotoCaptureEnabled`, `isLivePhotoCaptureSuspended`, `preservesLivePhotoCaptureSuspendedOnSessionStop`, `isLivePhotoAutoTrimmingEnabled` (default `true` when supported), `availableLivePhotoVideoCodecTypes`.
- Settings: `livePhotoMovieFileURL`, `livePhotoVideoCodecType`, `livePhotoMovieMetadata`.
- Resolved: `livePhotoMovieDimensions` (`{0, 0}` when the shot is not live).
- Callbacks: `didFinishRecordingLivePhotoMovieForEventualFileAt` and `didFinishProcessingLivePhotoToMovieFileAt` (gives `duration` and `photoDisplayTime`).
- Saving: `addResource(with: .pairedVideo, fileURL:options:)` in the same `PHAssetCreationRequest` as the photo.

**Why no movie file output in the session** [H]: "Simultaneous Live Photo capture and MovieFileOutput capture is not supported. If an AVCaptureMovieFileOutput is added to your session, AVCapturePhotoOutput's livePhotoCaptureSupported property returns NO." A video data output is allowed.

### (c) What AVCam does and why

- Photo mode removes the movie output and sets the `.photo` preset (`CaptureService.swift:279-282`). Video mode adds the movie output again (`:283-285`). Setup adds the movie output only in video mode (`:146-151`).
- After each change, `isLivePhotoCaptureEnabled = isLivePhotoCaptureSupported` (`PhotoCapture.swift:122`).
- A microphone input is always in the session (`CaptureService.swift:132`), so Live Photos have sound. The usage string says so (`project.pbxproj:928`).
- Per shot, a unique temporary `.mov` URL is set when the toggle is on (`PhotoCapture.swift:75`, `AVCam/Support/FoundationExtensions.swift:12-14`).
- The delegate decides "is live" from the resolved settings, not from the request (`PhotoCapture.swift:167`).
- It keeps the movie URL from the "finished processing" callback (`:185`) and returns it in `Photo.livePhotoMovieURL`.
- Saving adds `.pairedVideo` with `shouldMoveFile = true` (`MediaLibrary.swift:65-69`).
- UI: a toggle button (`FeatureToolbar.swift:40-46`), and a "LIVE" badge at the top (`AVCam/Views/Overlays/LiveBadge.swift:11-22`) whose opacity follows `captureActivity.isLivePhoto` (`AVCam/Views/CameraUI.swift:43-44`).

**The badge logic with overlapping captures.**

Events per capture: `willBeginCapture` yields `isLivePhoto: true`. `willCapturePhoto` yields `willCapture: true` with the same flag. `didFinishRecordingLivePhotoMovie` yields `isLivePhoto: false` (`PhotoCapture.swift:165-179`).

`monitorProgress` keeps a local flag per capture and a shared counter (`:92`, `:31`). The counter goes up when a capture turns live and down when it stops (`:98-101`). If the counter is above 1, the code forces `isLivePhoto: true` in the value it publishes (`:102-106`).

[A] Trace with two overlapping Live Photos A and B:

| Step | Event | Counter | Published `isLivePhoto` | Correct? |
|---|---|---|---|---|
| 1 | A begins | 1 | true | yes |
| 2 | B begins | 2 | true (forced) | yes |
| 3 | A movie ends | 1 | **false** (not forced, because 1 is not > 1) | no, B still records |
| 4 | B movie ends | 0 | false | yes |

Between steps 3 and 4 the badge is hidden while B records. `CameraModel` does not forward `willCapture` values to the UI state (`CameraModel.swift:208-213`), so nothing turns the badge on again. The condition should be `livePhotoCount > 0`. Apple's article says to "hide your indicator only when that number reaches zero" [D]. Verify on a device with two quick shots before the tutorial calls it a bug. Section 2 also shows that the counter is written without isolation.

Alternative: keep one counter in the owner, increment in `willBeginCapture` when live, decrement in `didFinishRecordingLivePhotoMovie`, and publish `count > 0`.

### (d) Pitfalls

- **No support check at request time** [A]. `PhotoCapture.swift:75` uses only the UI toggle, which defaults to `true` (`CameraModel.swift:136`). [H] rule: "The receiver's livePhotoCaptureEnabled must be YES if settings.livePhotoMovieURL is non-nil", else `NSInvalidArgumentException`. On a camera without Live Photo support (possible with external cameras on iPad) this would crash. The old AVCam guarded with `isLivePhotoCaptureSupported`. `CaptureCapabilities.isLivePhotoCaptureSupported` is computed (`PhotoCapture.swift:131`) but the real model never reads it (only `PreviewCameraModel` sets it). Not tested on a device.
- **A damaged movie is still saved** [A]. On error, the code logs and still stores the URL (`PhotoCapture.swift:182-185`). [H] says the error means the file is damaged.
- **Temp files can leak.** `shouldMoveFile` removes the movie only after a successful save. If the save throws (no authorization), the `.mov` stays in the temporary directory.
- **Shutter sound.** [H] The system suppresses the shutter sound during Live Photo capture, so the sound is not in the movie.
- Enabling Live Photo capture while running rebuilds the pipeline, ends running Live Photo movies and aborts pending requests [H].
- Not available with ProRAW or brackets [H].
- [H] `shouldMoveFile` fails if the file is open or hard-linked.
- Add the still and the movie in one creation request, as Apple's article does [D]. I found no documented way to attach a paired video to an existing asset.

### (e) Beyond AVCam

- `isLivePhotoCaptureSuspended = true` cuts running movies at once, for example before you play a sound [H].
- `livePhotoVideoCodecType` to force H.264 for compatibility.
- `livePhotoMovieMetadata` for custom movie metadata (never the content identifier).
- Show the result with `PHLivePhoto` and `PHLivePhotoView` [D].

### (f) Links

"Capturing and saving Live Photos", `isLivePhotoCaptureEnabled`, `isLivePhotoCaptureSupported`, `livePhotoMovieFileURL`, `isLivePhotoCaptureSuspended`, `isLivePhotoAutoTrimmingEnabled`, `PHAssetResourceType.pairedVideo`, "Displaying Live Photos", PHLivePhoto.

---

## 8. Flash, red-eye, HDR, constant colour, shutter sound (overview)

AVCam uses none of these. The current sample has no flash control.

### (a)+(b) Concepts and APIs

**Flash.**

- `photoSettings.flashMode`: `.off` (default), `.on`, `.auto`. [H] `AVCaptureDevice.flashMode` has no effect on the photo output.
- The mode must be in `photoOutput.supportedFlashModes` or the call throws. The list depends on the camera and the configuration. Read it again after each camera change.
- `resolvedSettings.isFlashEnabled` is the truth. [H] When the device is hot the flash is unavailable, yet `supportedFlashModes` still lists `.on`. Observe `AVCaptureDevice.isFlashAvailable`.
- Live indicator: set `photoOutput.photoSettingsForSceneMonitoring` (settings with `flashMode = .auto`), then observe `isFlashScene` with KVO.
- Flash shots do not get ZSL, are not deferred at `.quality`, and put readiness into `.notReadyWaitingForCapture` [W].

**Red-eye.** `photoOutput.isAutoRedEyeReductionSupported`, `photoSettings.isAutoRedEyeReductionEnabled` (default `true` when supported, not for brackets or RAW-only), `resolvedSettings.isRedEyeReductionEnabled`. It adds processing time on flash shots.

**HDR photos.** [H] The string "HDR" does not occur in `AVCapturePhotoOutput.h`. There is no HDR photo switch.

- Multi-exposure fusion for dynamic range is part of `.balanced` and `.quality` [W].
- `AVCaptureDevice.isVideoHDREnabled` and `automaticallyAdjustsVideoHDREnabled` are about the video stream. AVCam's `isHDRSupported` capability and HDR button are for video (`DataTypes.swift:106`, `FeatureToolbar.swift:70-89`).
- HDR display of stills (gain maps, ISO HDR) is an ImageIO, Core Image and Photos topic. See WWDC23-10181 and WWDC24-10177. `PHImageManager.h` in this SDK has an option documented as "Request HDR image data if available".
- I did not verify whether HEIC files from `AVCapturePhotoOutput` contain a gain map. Treat that as unverified.

**Constant colour** (iOS 18). Produces a photo with colours as under a standard light, by using the flash [H].

- Output: `isConstantColorSupported/Enabled` (slow to enable). Settings: `isConstantColorEnabled`, `isConstantColorFallbackPhotoDeliveryEnabled`.
- Needs `flashMode` `.auto` or `.on`, else it throws. Not with RAW. Not with locked or manual white balance. Can take seconds.
- Result: `photo.constantColorConfidenceMap`, `constantColorCenterWeightedMeanConfidenceLevel`, `isConstantColorFallbackPhoto`.

**Shutter sound.**

- The system plays it just before `willCapturePhotoFor` [H]. It is suppressed during Live Photo capture [H].
- iOS 18: `photoOutput.isShutterSoundSuppressionSupported` and `photoSettings.isShutterSoundSuppressionEnabled`. [H] Supported is `false` "in jurisdictions where shutter sound production cannot be disabled". Setting it when unsupported throws.
- Hardware-button capture has its own sound API. AVCam uses `onCameraCaptureEvent(defaultSoundDisabled: true)` and `event.play(.cameraShutter)` for AirPods (`AVCam/CameraView.swift:30-49`). That belongs to the system-integration dossier.

### (c) Why AVCam leaves them out

[A] The sample focuses on the pipeline and on responsiveness. Flash would add a third toolbar control and special cases (no ZSL, no deferral).

### (d) Pitfalls

- A flash mode that is not supported throws. Always check `supportedFlashModes`.
- Do not show "flash fired" from the request. Use the resolved settings.
- Constant colour with `.off` flash throws.
- Do not promise a silent shutter. Check support at run time.

### (e) Beyond

Torch for video (`AVCaptureDevice.torchMode`) is a different API. Content-aware distortion correction and sensor orientation compensation are covered in sections 1 and 3.

### (f) Links

`flashMode`, `isFlashScene`, `photoSettingsForSceneMonitoring`, `isAutoRedEyeReductionEnabled`, `isConstantColorEnabled`, "Capturing consistent color images", `isShutterSoundSuppressionEnabled`, `isShutterSoundSuppressionSupported`, WWDC24-10162, WWDC23-10181, WWDC24-10177.

---

## 9. Saving with PhotoKit

### (a) Concept

The photo library is a database owned by the system. An app changes it only inside a change block: `PHPhotoLibrary.shared().performChanges { ... }`. Inside the block you create request objects. The system applies them after the block returns and reports success or an error.

An **asset** is one item in the library. It is made of **resources** (files). A Live Photo asset has a photo resource and a paired-video resource. `PHAssetCreationRequest` builds an asset from several resources.

Access has two levels, `PHAccessLevel` (iOS 14):

| Level | Allows | Info.plist key [D] | Possible status |
|---|---|---|---|
| `.addOnly` | Add assets. No reading. | `NSPhotoLibraryAddUsageDescription` | notDetermined, restricted, denied, authorized |
| `.readWrite` | Read, change, add | `NSPhotoLibraryUsageDescription` | the same, plus `.limited` (user-selected subset) [A: `.limited` describes what the app can read, so it belongs to this level] |

[D] "If your app only adds to the library, use the NSPhotoLibraryAddUsageDescription key. For all other cases, use NSPhotoLibraryUsageDescription." [D] "Attempting to access the Photos library without a valid usage description causes your app to crash."

### (b) Key APIs

- `PHPhotoLibrary.authorizationStatus(for:)`, `PHPhotoLibrary.requestAuthorization(for:)` (async form of `requestAuthorization(for:handler:)`).
- `PHPhotoLibrary.shared().performChanges(_:)` (async throws form of `performChanges(_:completionHandler:)`).
- `PHAssetCreationRequest.forAsset()`, `addResource(with:data:options:)`, `addResource(with:fileURL:options:)`, `supportsAssetResourceTypes(_:)`.
- `PHAssetResourceType`: `.photo`, `.video`, `.pairedVideo`, `.photoProxy` (iOS 17), `.alternatePhoto` (for RAW + processed).
- `PHAssetResourceCreationOptions`: `shouldMoveFile`, `originalFilename`, `contentType` (iOS 26, replaces `uniformTypeIdentifier`).
- `PHAssetChangeRequest.placeholderForCreatedAsset` gives a `PHObjectPlaceholder` with the future `localIdentifier`. Also `creationDate`, `location`.
- `PHAsset.fetchAssets(withLocalIdentifiers:options:)`.
- `PHImageManager.default().requestImage(for:targetSize:contentMode:options:resultHandler:)`. `PHCachingImageManager` adds `startCachingImages(for:...)` for grids.
- `PHImageRequestOptions.deliveryMode` (`.opportunistic` default, `.highQualityFormat`, `.fastFormat`), `isSynchronous`, `isNetworkAccessAllowed`, `allowSecondaryDegradedImage`.

### (c) What AVCam does and why

- `MediaLibrary` is an actor (`AVCam/Model/MediaLibrary.swift:13`). `CameraModel` owns it next to the capture service (`CameraModel.swift:54`). Capture and saving are two separate services. The model joins them: capture, then save (`CameraModel.swift:128-129`).
- **Authorization: `.addOnly`** (`MediaLibrary.swift:36`, `:43`). The app asks lazily, at the first save, not at launch. Reason [A]: least privilege. The app only writes. To look at photos, the thumbnail button opens the system `PhotosPicker` (`AVCam/Views/Toolbars/MainToolbar/ThumbnailButton.swift:21`). The picker runs out of process and needs no permission [D].
- **Photo save** (`:53-73`): one creation request. The main resource type is `.photoProxy` or `.photo` (`:61`), from in-memory `Data`. The Live Photo movie is added as `.pairedVideo` from a file URL with `shouldMoveFile = true` (`:65-69`).
- **Movie save** (`:76-86`): `.video` from a file URL, also moved.
- **`shouldMoveFile`** [H][D]: Photos moves the file into the library with no copy and removes the original after success. This saves time and disk space. It applies only to the file-URL variant.
- **Location**: `creationRequest.location` (`:62`, `:83`) from one `CLLocationUpdate` (`:130-138`). This sets the asset's location in Photos. It does not write GPS data into the file.
- **Template method**: `performChange` (`:89-110`) checks authorization, runs the change, then reads the new asset through the placeholder identifier (`:103-104`) and makes a thumbnail (`:105`). Any failure inside becomes `Error.saveFailed` (`:107-109`).
- **Thumbnail** (`:114-124`): `PHImageManager.default().requestImage` at 256 x 256, default options. The image goes into an `AsyncStream<CGImage?>` (`:22`, `:122`). `CameraModel` reads the stream (`CameraModel.swift:198-203`) and `ThumbnailButton` shows it (`ThumbnailButton.swift:30-39`).

**The locked-capture extension.** [S] `MediaLibrary.swift` has no special branch. No file in the repository mentions `sessionContentURL`. The extension target compiles the same `MediaLibrary.swift` and `PhotoCapture.swift` (two build-file entries each in `project.pbxproj:14`, `:47`, `:34`, `:66`). The extension ignores its `LockedCameraCaptureSession` parameter (`AVCamCaptureExtension/AVCamCaptureExtension.swift:20`). So the extension saves with PhotoKit, exactly like the app.

This is an allowed design:

- [D] "Use PhotoKit or sessionContentURL from LockedCameraCaptureSession to store all captured content."
- [W, WWDC24-10204] "We recommend using PhotoKit to save photo and video assets captured from your extension." It works on a locked device.
- [W] "Your extension inherits Photos permissions from your app." This explains why the extension target has camera, microphone and location usage strings but no Photos string (`project.pbxproj:631-634`).
- [W] On a locked device, the extension can read only assets written in the current capture session.
- [D] The system erases the extension's container when the extension is suspended. The temporary Live Photo movie is safe only because Photos moves it during the save.

Use `sessionContentURL` when you must keep data that Photos cannot hold (an edit recipe, a project file), or when the user has not granted Photos access. The app then reads `LockedCameraCaptureManager.shared.sessionContentUpdates` [D].

Alternatives: `.readWrite` access to build an in-app gallery. `PHCachingImageManager` for a scrolling grid. An own file store plus a later import.

### (d) Pitfalls and open questions

- **Usage-description mismatch** [S][D]. The app target declares only `NSPhotoLibraryUsageDescription` (`project.pbxproj:929`, `:976`) but requests `.addOnly`. Apple's documentation names `NSPhotoLibraryAddUsageDescription` for add-only access. I could not test what iOS 26 does with only the read-write key. In the tutorial, declare the add key (or both keys). **UNVERIFIED on device.**
- **Reading back with add-only access** [A]. `performChange` fetches the new asset and asks `PHImageManager` for a thumbnail. Add-only access does not include reading. WWDC23-10105 says read permission is needed to show the final photo. If the fetch returns nothing, the `guard ... else { return }` at `MediaLibrary.swift:103-104` ends silently and the button keeps the placeholder icon. The deleted `loadInitialThumbnail()` checked for `.readWrite` before it fetched, which points the same way. **UNVERIFIED on device.** A robust design takes the thumbnail from the capture (`previewCGImageRepresentation()`), not from the library.
- **The result handler can run more than once** [H]. With default options the mode is `.opportunistic`: first a degraded image, then the final one. Each call yields into the stream. For a proxy asset, the final image request can trigger the deferred processing on demand.
- **`fetchAssets` and `requestImage` are synchronous or main-thread calls made inside an actor.** The handler is called on the main thread [H]. The closure captures `self` weakly and touches `continuation`, which is a `let`, so it is safe.
- **All errors collapse into `saveFailed`** (`:107-109`). The real `PHPhotosError` is lost: `.accessUserDenied` (3311), `.invalidResource` (3302), `.notEnoughSpace` (3305).
- **`.limited` is not handled**, and does not need to be for add-only. If you move to `.readWrite`, treat `.limited` as usable. [D] Assets the app creates are added to the limited selection automatically.
- **Validation is late** [H]: "Adding resources to a creation request always succeeds; validation of the request is performed later, and any errors are reported after the performChanges block."
- **Creation requests exist only inside the change block** [H]. Do not create one outside.
- **`shouldMoveFile` fails for open or hard-linked files** [H].
- **Authorization prompt timing** [D]: avoid PhotoKit calls at launch. AVCam asks at the first save, which is the right moment. But the first photo is then held in memory while two prompts may show (location, then Photos).
- **The async change closure mutates a captured `var`** (`placeholder`, `:95-99`). Swift 6 strict checking would reject this.

### (e) Beyond AVCam

- RAW + processed: [D] add the DNG as `.photo` and the processed image as `.alternatePhoto` in one request. iOS 27 adds `originalResourceChoice` to pick which one is the original [H].
- Albums: `PHAssetCollectionChangeRequest` with the placeholder, in the same change block.
- `PHAssetResourceCreationOptions.originalFilename` and `contentType` for clean file names and types.
- `PHPhotoLibrary.shared().register(_:)` change observer to refresh a gallery (needs read access).
- `presentLimitedLibraryPicker(from:)` for limited access.
- `PHImageRequestOptions.allowSecondaryDegradedImage` for deferred photos.

### (f) Links

PHPhotoLibrary, `requestAuthorization(for:handler:)`, `authorizationStatus(for:)`, PHAccessLevel, PHAuthorizationStatus, PHAssetCreationRequest, PHAssetResourceType, `shouldMoveFile`, `placeholderForCreatedAsset`, PHImageManager, PHCachingImageManager, "Delivering an Enhanced Privacy Experience in Your Photos App", "Saving captured photos", the two Info.plist keys, LockedCameraCapture, "Creating a camera experience for the Lock Screen", `sessionContentURL`, WWDC24-10204, WWDC20-10652, WWDC20-10641.

---

## Glossary

| Term | Meaning |
|---|---|
| Photo output | `AVCapturePhotoOutput`. The session output that takes still photos. |
| Photo settings | `AVCapturePhotoSettings`. The request for one shot. Single use. |
| Resolved settings | `AVCaptureResolvedPhotoSettings`. What the system decided for that shot. Same `uniqueID` as the request. |
| `uniqueID` | 64-bit number that joins a request to its callbacks. |
| Capture delegate | Object that conforms to `AVCapturePhotoCaptureDelegate` and receives the callbacks of one or more requests. |
| `AVCapturePhoto` | One result image in memory, with metadata and optional extras. |
| File data representation | The photo flattened to `Data` in its container format (HEIC, JPEG, DNG). |
| HEIF / HEIC | Container format. `.heic` is HEIF with an HEVC-coded image. |
| HEVC | H.265 codec. Used for stills in HEIC and for video. |
| Preview image | Small uncompressed image delivered in memory with the photo, for UI. |
| Embedded thumbnail | Small compressed image stored inside the photo file. |
| Bayer RAW | Sensor data with minimal processing. |
| Apple ProRAW | Demosaiced, fused, scene-referred image in a Linear DNG file. |
| Depth data | `AVDepthData`. A per-pixel distance or disparity map. |
| Portrait effects matte | Mask that separates a person from the background. |
| Semantic segmentation matte | Mask for hair, skin, teeth or glasses. |
| Max photo dimensions | Ceiling for the photo size, set on the output and per shot. |
| Quad-pixel sensor | 48 MP sensor that can bin 2 x 2 pixels to give 12 MP with more light. |
| Quality prioritization | `.speed`, `.balanced`, `.quality`. A hint about speed against quality. |
| Deep Fusion | Apple's name for a multi-frame fusion method. Named in WWDC talks only. |
| Shutter lag | Delay between the tap and the frames used for the photo. |
| Zero shutter lag (ZSL) | Use of buffered past frames so the photo matches the moment of the tap. |
| Responsive capture | Overlap of capture and processing between shots. |
| Fast capture prioritization | Automatic drop from quality to balanced during rapid shots. |
| Shot-to-shot time | Time before the next capture can start. |
| Capture readiness | State that tells the UI whether a new shot will start soon. |
| Readiness coordinator | `AVCapturePhotoOutputReadinessCoordinator`. Delivers readiness on the main queue and tracks requests that are not yet enqueued. |
| Deferred photo delivery | The app gets a proxy now. Photos makes the final image later. |
| Proxy | `AVCaptureDeferredPhotoProxy`. Lightly processed stand-in for a deferred photo. |
| Deferred start | iOS 26. Outputs initialize after the first preview frame. Different from deferred photo delivery. |
| Live Photo | A still plus a short paired movie with the same content identifier. |
| Paired video | The movie resource of a Live Photo asset (`.pairedVideo`). |
| Content identifier | The shared ID that pairs the still and the movie. |
| Constant colour | iOS 18 mode that uses the flash to remove the colour cast of ambient light. |
| Checked continuation | Bridge from a callback to `await`. Must be resumed exactly once. |
| `AsyncStream` | An async sequence fed by `yield` and closed by `finish`. |
| `#isolation` | Macro that gives the actor of the current code, or `nil`. |
| Isolated parameter | A parameter of type `isolated (any Actor)?`. The function runs on that actor. |
| Asset | `PHAsset`. One item in the photo library. |
| Asset resource | One file that belongs to an asset. |
| Creation request | `PHAssetCreationRequest`. Builds a new asset from resources inside a change block. |
| Change block | The closure passed to `performChanges`. |
| Placeholder | `PHObjectPlaceholder`. Stands for an asset that the change block will create. |
| Add-only access | Photos permission that allows writing new assets and nothing else. |
| Limited library | Read-write permission for a user-chosen subset of assets. |
| Locked capture extension | Extension (LockedCameraCapture) that runs the camera UI on a locked device. |
| Session content URL | Directory where a locked capture extension can store files for the app. |

---

## Verified links

Method: for documentation pages I requested `https://developer.apple.com/tutorials/data/documentation/<path>.json` and got HTTP 200. For WWDC and GitHub pages I requested the page and got HTTP 200 with the expected title. Date: 2026-10-01.

### AVFoundation

| Title | URL | Description |
|---|---|---|
| Photo capture (topic root) | https://developer.apple.com/documentation/avfoundation/photo-capture | List of all photo capture types and articles. |
| Capturing still and Live Photos | https://developer.apple.com/documentation/avfoundation/capturing-still-and-live-photos | Main how-to. Its code still uses the deprecated high-resolution flag. |
| Tracking photo capture progress | https://developer.apple.com/documentation/avfoundation/tracking-photo-capture-progress | The five capture steps and delegate lifetime advice. |
| Capturing and saving Live Photos | https://developer.apple.com/documentation/avfoundation/capturing-and-saving-live-photos | Live Photo capture, badge counting, paired save. |
| Saving captured photos | https://developer.apple.com/documentation/avfoundation/saving-captured-photos | From `AVCapturePhoto` to the library. |
| Capturing thumbnail and preview images | https://developer.apple.com/documentation/avfoundation/capturing-thumbnail-and-preview-images | Preview image against embedded thumbnail. |
| Capturing uncompressed image data | https://developer.apple.com/documentation/avfoundation/capturing-uncompressed-image-data | Pixel-buffer output. |
| Capturing photos in RAW and Apple ProRAW formats | https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats | RAW overview. |
| Capturing photos with depth | https://developer.apple.com/documentation/avfoundation/capturing-photos-with-depth | Depth delivery. |
| Capturing a bracketed photo sequence | https://developer.apple.com/documentation/avfoundation/capturing-a-bracketed-photo-sequence | Brackets. |
| Capturing consistent color images | https://developer.apple.com/documentation/avfoundation/capturing-consistent-color-images | Constant colour. |
| AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The sample's article. Says iOS 26 or later. |
| Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media | Camera, microphone and Photos permission. |
| AVCapturePhotoOutput | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput | Class reference. |
| capturePhoto(with:delegate:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:) | Start a capture. |
| setPreparedPhotoSettingsArray(_:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:) | Pre-allocate resources. |
| availablePhotoCodecTypes | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablephotocodectypes | Codecs for the current configuration. |
| availablePhotoFileTypes | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablephotofiletypes | Containers for the current configuration. |
| AVCapturePhotoOutput.QualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/qualityprioritization | The three levels. |
| maxPhotoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization | Output ceiling for quality. |
| maxPhotoDimensions (output) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotodimensions | Output ceiling for size. |
| isHighResolutionCaptureEnabled (deprecated) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/ishighresolutioncaptureenabled | The old Boolean. |
| isZeroShutterLagEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagenabled | ZSL switch. |
| isZeroShutterLagSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iszeroshutterlagsupported | ZSL support. |
| isResponsiveCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecaptureenabled | Overlapping captures. |
| isResponsiveCaptureSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isresponsivecapturesupported | Support check. |
| isFastCapturePrioritizationEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationenabled | Adaptive quality. |
| isFastCapturePrioritizationSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isfastcaptureprioritizationsupported | Support check. |
| isAutoDeferredPhotoDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliveryenabled | Deferred delivery switch. |
| isAutoDeferredPhotoDeliverySupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautodeferredphotodeliverysupported | Support check. |
| captureReadiness (property) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.property | Current readiness. |
| AVCapturePhotoOutput.CaptureReadiness (enum) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturereadiness-swift.enum | Readiness values. |
| AVCapturePhotoOutputReadinessCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator | Main-queue readiness helper. |
| startTrackingCaptureRequest(using:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/starttrackingcapturerequest(using:) | Track a request before it is enqueued. |
| stopTrackingCaptureRequest(using:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinator/stoptrackingcapturerequest(using:) | Stop tracking when no capture follows. |
| AVCapturePhotoOutputReadinessCoordinatorDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotooutputreadinesscoordinatordelegate | Readiness callback. |
| isLivePhotoCaptureSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocapturesupported | Live Photo support. |
| isLivePhotoCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocaptureenabled | Live Photo switch. |
| isLivePhotoCaptureSuspended | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocapturesuspended | Cut running movies. |
| isLivePhotoAutoTrimmingEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotoautotrimmingenabled | Automatic trimming. |
| availableLivePhotoVideoCodecTypes | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablelivephotovideocodectypes | Movie codecs. |
| isFlashScene | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isflashscene | Scene needs flash. |
| photoSettingsForSceneMonitoring | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/photosettingsforscenemonitoring | Drives `isFlashScene`. |
| isAutoRedEyeReductionSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isautoredeyereductionsupported | Red-eye support. |
| isConstantColorEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorenabled | Constant colour switch. |
| isShutterSoundSuppressionSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isshuttersoundsuppressionsupported | Region rule for the shutter sound. |
| isAppleProRAWEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled | ProRAW switch. |
| isDepthDataDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isdepthdatadeliveryenabled | Depth switch. |
| isPortraitEffectsMatteDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isportraiteffectsmattedeliveryenabled | Matte switch. |
| enabledSemanticSegmentationMatteTypes | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/enabledsemanticsegmentationmattetypes | Segmentation mattes. |
| isCameraSensorOrientationCompensationEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/iscamerasensororientationcompensationenabled | iOS 26 rotation compensation. |
| AVCapturePhotoSettings | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings | Class reference. |
| init(format:) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(format:) | Settings with a codec or pixel format. |
| init(from:) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(from:) | Copy with a new `uniqueID`. |
| uniqueID | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/uniqueid | Request identifier. |
| maxPhotoDimensions (settings) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/maxphotodimensions | Per-shot size ceiling. |
| photoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization | Per-shot quality level. |
| livePhotoMovieFileURL | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/livephotomoviefileurl | Request a Live Photo. |
| previewPhotoFormat | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/previewphotoformat | Request a preview image. |
| embeddedThumbnailPhotoFormat | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/embeddedthumbnailphotoformat | Request an embedded thumbnail. |
| flashMode | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/flashmode | Per-shot flash. |
| isAutoRedEyeReductionEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/isautoredeyereductionenabled | Per-shot red-eye reduction. |
| isShutterSoundSuppressionEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/isshuttersoundsuppressionenabled | Per-shot silent shutter. |
| AVCapturePhotoBracketSettings | https://developer.apple.com/documentation/avfoundation/avcapturephotobracketsettings | Bracket requests. |
| AVCaptureResolvedPhotoSettings | https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings | Class reference. |
| livePhotoMovieDimensions | https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/livephotomoviedimensions | Non-zero when the shot is live. |
| expectedPhotoCount | https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/expectedphotocount | Number of result images. |
| photoProcessingTimeRange | https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/photoprocessingtimerange | Expected processing time. |
| deferredPhotoProxyDimensions | https://developer.apple.com/documentation/avfoundation/avcaptureresolvedphotosettings/deferredphotoproxydimensions | Proxy size. |
| AVCapturePhotoCaptureDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate | Protocol reference. |
| photoOutput(_:willBeginCaptureFor:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:willbegincapturefor:) | First callback. |
| photoOutput(_:willCapturePhotoFor:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:willcapturephotofor:) | Exposure start. |
| photoOutput(_:didCapturePhotoFor:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didcapturephotofor:) | Exposure end. |
| photoOutput(_:didFinishProcessingPhoto:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:) | Image delivery. |
| photoOutput(_:didFinishCapturingDeferredPhotoProxy:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishcapturingdeferredphotoproxy:error:) | Proxy delivery. |
| photoOutput(_:didFinishRecordingLivePhotoMovieForEventualFileAt:resolvedSettings:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishrecordinglivephotomovieforeventualfileat:resolvedsettings:) | Live movie stopped recording. |
| photoOutput(_:didFinishProcessingLivePhotoToMovieFileAt:duration:photoDisplayTime:resolvedSettings:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessinglivephototomoviefileat:duration:photodisplaytime:resolvedsettings:error:) | Live movie file complete. |
| photoOutput(_:didFinishCaptureFor:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishcapturefor:error:) | Last callback. |
| AVCapturePhoto | https://developer.apple.com/documentation/avfoundation/avcapturephoto | Class reference. |
| fileDataRepresentation() | https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation() | Flatten to file data. |
| fileDataRepresentation(with:) | https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation(with:) | Flatten with a customizer. |
| previewPixelBuffer | https://developer.apple.com/documentation/avfoundation/avcapturephoto/previewpixelbuffer | Preview image buffer. |
| previewCGImageRepresentation() | https://developer.apple.com/documentation/avfoundation/avcapturephoto/previewcgimagerepresentation() | Preview as `CGImage`. |
| cgImageRepresentation() | https://developer.apple.com/documentation/avfoundation/avcapturephoto/cgimagerepresentation() | Main image as `CGImage`. |
| AVCapturePhotoFileDataRepresentationCustomizer | https://developer.apple.com/documentation/avfoundation/avcapturephotofiledatarepresentationcustomizer | Replace or strip metadata. |
| AVCaptureDeferredPhotoProxy | https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy | Proxy class. |
| supportedMaxPhotoDimensions | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/supportedmaxphotodimensions | Photo sizes of a format. |
| isHighPhotoQualitySupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/ishighphotoqualitysupported | High-quality stills from video formats. |
| isHighestPhotoQualitySupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/ishighestphotoqualitysupported | Marks photo formats. |
| AVCaptureSession.Preset.photo | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/photo | The photo preset. |
| AVCaptureOutput.isDeferredStartEnabled | https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartenabled | iOS 26 deferred start. |
| automaticallyRunsDeferredStart | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyrunsdeferredstart | iOS 26 deferred start on the session. |
| AVVideoCodecType.hevc | https://developer.apple.com/documentation/avfoundation/avvideocodectype/hevc | HEVC codec constant. |
| AVCaptureMovieFileOutput | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput | Conflicts with Live Photo capture. |
| AVPortraitEffectsMatte | https://developer.apple.com/documentation/avfoundation/avportraiteffectsmatte | Portrait matte. |
| AVSemanticSegmentationMatte | https://developer.apple.com/documentation/avfoundation/avsemanticsegmentationmatte | Segmentation mattes. |
| AVDepthData | https://developer.apple.com/documentation/avfoundation/avdepthdata | Depth map. |

### PhotoKit, PhotosUI, Info.plist, LockedCameraCapture

| Title | URL | Description |
|---|---|---|
| PhotoKit | https://developer.apple.com/documentation/photokit | Framework root. |
| Delivering an Enhanced Privacy Experience in Your Photos App | https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app | Access levels, usage keys, limited library. |
| Fetching Objects and Requesting Changes | https://developer.apple.com/documentation/photokit/fetching-objects-and-requesting-changes | Fetches and change blocks. |
| Loading and Caching Assets and Thumbnails | https://developer.apple.com/documentation/photokit/loading-and-caching-assets-and-thumbnails | Image manager use. |
| Displaying Live Photos | https://developer.apple.com/documentation/photokit/displaying-live-photos | `PHLivePhotoView`. |
| PHPhotoLibrary | https://developer.apple.com/documentation/photos/phphotolibrary | Library object. |
| requestAuthorization(for:handler:) | https://developer.apple.com/documentation/photos/phphotolibrary/requestauthorization(for:handler:) | Ask for access. |
| authorizationStatus(for:) | https://developer.apple.com/documentation/photos/phphotolibrary/authorizationstatus(for:) | Read the status. |
| performChanges(_:completionHandler:) | https://developer.apple.com/documentation/photos/phphotolibrary/performchanges(_:completionhandler:) | Change block. |
| PHAccessLevel | https://developer.apple.com/documentation/photos/phaccesslevel | `.addOnly` and `.readWrite`. |
| PHAccessLevel.addOnly | https://developer.apple.com/documentation/photos/phaccesslevel/addonly | Add-only access. |
| PHAuthorizationStatus | https://developer.apple.com/documentation/photos/phauthorizationstatus | Status values. |
| PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest | Build an asset from resources. |
| forAsset() | https://developer.apple.com/documentation/photos/phassetcreationrequest/forasset() | Create the request. |
| addResource(with:data:options:) | https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:data:options:) | Add in-memory data. |
| addResource(with:fileURL:options:) | https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:) | Add a file. |
| PHAssetResourceType | https://developer.apple.com/documentation/photos/phassetresourcetype | Resource kinds. |
| PHAssetResourceType.photoProxy | https://developer.apple.com/documentation/photos/phassetresourcetype/photoproxy | Proxy resource. The page has no text. |
| PHAssetResourceType.pairedVideo | https://developer.apple.com/documentation/photos/phassetresourcetype/pairedvideo | Live Photo movie resource. |
| PHAssetResourceCreationOptions | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions | Options for a resource. |
| shouldMoveFile | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile | Move, do not copy. |
| placeholderForCreatedAsset | https://developer.apple.com/documentation/photos/phassetchangerequest/placeholderforcreatedasset | Placeholder for the new asset. |
| PHAssetChangeRequest.location | https://developer.apple.com/documentation/photos/phassetchangerequest/location | Location of the asset. |
| PHObjectPlaceholder | https://developer.apple.com/documentation/photos/phobjectplaceholder | Placeholder class. |
| fetchAssets(withLocalIdentifiers:options:) | https://developer.apple.com/documentation/photos/phasset/fetchassets(withlocalidentifiers:options:) | Fetch by identifier. |
| PHImageManager | https://developer.apple.com/documentation/photos/phimagemanager | Image requests. |
| requestImage(for:targetSize:contentMode:options:resultHandler:) | https://developer.apple.com/documentation/photos/phimagemanager/requestimage(for:targetsize:contentmode:options:resulthandler:) | Thumbnail request. |
| PHCachingImageManager | https://developer.apple.com/documentation/photos/phcachingimagemanager | Pre-caching for grids. |
| PHImageRequestOptions | https://developer.apple.com/documentation/photos/phimagerequestoptions | Request options. |
| deliveryMode | https://developer.apple.com/documentation/photos/phimagerequestoptions/deliverymode | One or several results. |
| allowSecondaryDegradedImage | https://developer.apple.com/documentation/photos/phimagerequestoptions/allowsecondarydegradedimage | Interim image for deferred photos. |
| PHLivePhoto | https://developer.apple.com/documentation/photos/phlivephoto | Live Photo object for display. |
| PhotosPicker | https://developer.apple.com/documentation/photosui/photospicker | SwiftUI picker. No permission needed. |
| PHPickerViewController | https://developer.apple.com/documentation/photosui/phpickerviewcontroller | UIKit picker. |
| NSPhotoLibraryAddUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryaddusagedescription | Usage text for add-only access. |
| NSPhotoLibraryUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryusagedescription | Usage text for read-write access. |
| LockedCameraCapture | https://developer.apple.com/documentation/lockedcameracapture | Framework root. |
| Creating a camera experience for the Lock Screen | https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen | Extension rules and storage choices. |
| LockedCameraCaptureSession | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession | Session object of the extension. |
| sessionContentURL | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession/sessioncontenturl | Directory that survives the extension. |
| LockedCameraCaptureManager | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager | App side: read session content. |

### Swift concurrency

| Title | URL | Description |
|---|---|---|
| withCheckedThrowingContinuation(isolation:function:_:) | https://developer.apple.com/documentation/swift/withcheckedthrowingcontinuation(isolation:function:_:) | Throwing continuation. |
| withCheckedContinuation(isolation:function:_:) | https://developer.apple.com/documentation/swift/withcheckedcontinuation(isolation:function:_:) | Non-throwing continuation. |
| CheckedContinuation | https://developer.apple.com/documentation/swift/checkedcontinuation | Continuation type. |
| AsyncStream | https://developer.apple.com/documentation/swift/asyncstream | Stream type. |
| makeStream(of:bufferingPolicy:) | https://developer.apple.com/documentation/swift/asyncstream/makestream(of:bufferingpolicy:) | Stream and continuation pair. |
| AsyncStream.Continuation.finish() | https://developer.apple.com/documentation/swift/asyncstream/continuation/finish() | End a stream. |
| isolation() | https://developer.apple.com/documentation/swift/isolation() | The `#isolation` macro. |
| Actor.unownedExecutor | https://developer.apple.com/documentation/swift/actor/unownedexecutor | Custom executor hook. |
| Task | https://developer.apple.com/documentation/swift/task | Unstructured tasks. |
| SE-0300 Continuations | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0300-continuation.md | Design of continuations. |
| SE-0314 AsyncStream | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0314-async-stream.md | Design of `AsyncStream`. |
| SE-0388 makeStream | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0388-async-stream-factory.md | Factory method. |
| SE-0392 Custom actor executors | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0392-custom-actor-executors.md | Actor on a dispatch queue. |
| SE-0420 Inheritance of actor isolation | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0420-inheritance-of-actor-isolation.md | `isolated` parameters and `#isolation`. |
| SE-0461 Async function isolation | https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md | Where non-isolated async functions run. |

### WWDC sessions

| Title | URL | Description |
|---|---|---|
| WWDC23-10105 Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | Deferred processing, ZSL, responsive capture, readiness. Main source for section 6. |
| WWDC26-303 Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | Deferred start. The source of commit `72b0fdb`. |
| WWDC26-304 Implement high resolution photo capture | https://developer.apple.com/videos/play/wwdc2026/304/ | 12/18/24/48 MP rules, prepared settings. Matches commit `880e3f9`. |
| WWDC26-341 Support the Center Stage front camera in your iOS app | https://developer.apple.com/videos/play/wwdc2026/341/ | The 18 MP front camera. Title checked only. |
| WWDC21-10247 Capture high-quality photos using video formats | https://developer.apple.com/videos/play/wwdc2021/10247/ | Best explanation of quality prioritization. |
| WWDC21-10160 Capture and process ProRAW images | https://developer.apple.com/videos/play/wwdc2021/10160/ | ProRAW. |
| WWDC24-10204 Build a great Lock Screen camera capture experience | https://developer.apple.com/videos/play/wwdc2024/10204/ | Extension storage and Photos permission. |
| WWDC24-10162 Keep colors consistent across captures | https://developer.apple.com/videos/play/wwdc2024/10162/ | Constant colour. |
| WWDC22-110429 Discover advancements in iOS camera capture | https://developer.apple.com/videos/play/wwdc2022/110429/ | iOS 16 capture changes. |
| WWDC19-225 Advances in Camera Capture & Photo Segmentation | https://developer.apple.com/videos/play/wwdc2019/225/ | Segmentation mattes. |
| WWDC17-507 Capturing Depth in iPhone Photography | https://developer.apple.com/videos/play/wwdc2017/507/ | Depth. |
| WWDC17-513 High Efficiency Image File Format | https://developer.apple.com/videos/play/wwdc2017/513/ | HEIF. |
| WWDC16-501 Advances in iOS Photography | https://developer.apple.com/videos/play/wwdc2016/501/ | Introduction of `AVCapturePhotoOutput` and Live Photo capture. |
| WWDC16-511 AVCapturePhotoOutput - Beyond the Basics | https://developer.apple.com/videos/play/wwdc2016/511/ | RAW, brackets, prepared settings. |
| WWDC20-10652 Meet the new Photos picker | https://developer.apple.com/videos/play/wwdc2020/10652/ | Picker with no permission. |
| WWDC20-10641 Handle the Limited Photos Library in your app | https://developer.apple.com/videos/play/wwdc2020/10641/ | Limited access. |
| WWDC23-10181 Support HDR images in your app | https://developer.apple.com/videos/play/wwdc2023/10181/ | HDR stills. |
| WWDC24-10177 Use HDR for dynamic image experiences in your app | https://developer.apple.com/videos/play/wwdc2024/10177/ | HDR stills and gain maps. |
| WWDC21-10132 Meet async/await in Swift | https://developer.apple.com/videos/play/wwdc2021/10132/ | Continuations. |
| WWDC21-10058 Meet AsyncSequence | https://developer.apple.com/videos/play/wwdc2021/10058/ | Async sequences. |

### Not verified

| Item | Status |
|---|---|
| https://developer.apple.com/documentation/avfoundation/build-a-responsive-camera-app-that-launches-quickly | UNVERIFIED. The WWDC26-303 page links to it. The JSON endpoint returned 404. |
| `avcapturephotooutput/supportedflashmodes`, `avcapturephotosettings/availablepreviewphotopixelformattypes`, `avcapturedevice/flashmode` documentation pages | UNVERIFIED. JSON endpoints returned 404. The symbols exist in the header and the Swift interface. |
| Behaviour of `.addOnly` with only `NSPhotoLibraryUsageDescription` in Info.plist | UNVERIFIED. Needs a device. |
| Whether `PHAsset.fetchAssets` and `PHImageManager` return the new asset under add-only access | UNVERIFIED. Needs a device. |
| The isolation result of section 2 inside the real app | Verified only in a reduced model on macOS with the same compiler settings. |
| The "Live" badge off-by-one and the missing Live Photo support check | Found by reading the code and the header. Not run on a device. |
| 48 MP and 18 MP pixel dimensions | Not in the header. Print `supportedMaxPhotoDimensions` on a device. |
| Whether the photo output keeps a strong or weak reference to the delegate | The header does not say. The old AVCam source comment says weak. |
| Night mode for third-party apps, gain maps in captured HEIC files | No Apple statement found. |
