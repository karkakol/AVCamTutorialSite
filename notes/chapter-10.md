# Chapter 10 (was chapter 8 before the RAW and fast capture chapters) hand-off notes: RAW and Apple ProRAW (code by a Sonnet agent)

Branch `chapter-08-raw`, start `chapter-07`. One commit `c16d761`. Full change: `git -C ../AVCamTutorialApp diff chapter-07 chapter-08-raw` (7 files, 143 added, 8 removed lines). No new files, so the project file does not change. Decisions from `docs/PLAN-raw-and-fast-capture.md` and `research/08-raw.md`.

## Result and verification
- Build for the iPhone 18 Pro simulator (iOS 27.1 SDK): `BUILD SUCCEEDED`, no warnings (checked with a full, non-quiet build and a filter for `warning:` and `error:`).
- Launch in the Simulator with SimCam: the normal interface shows. The features toolbar has the Live Photo button and the quality menu. The RAW menu is NOT there, as planned. The live picture from SimCam shows. The log has no error and no RAW line.
- First launch failed ("The camera failed to start", `CameraError.setupFailed`, AVError -11800 / -12782). Cause: the SimCam menu bar app was not running (`simcamctl diagnostics` said `isConfiguredForSimCam: false`). I started SimCam with `open -a SimCam` and relaunched. The second launch worked. I did not test chapter 7 again to prove that the failure had nothing to do with `isAppleProRAWEnabled`, but the working second launch with the same build shows the line is harmless in the Simulator.
- NOT run: a capture. A tap on the capture button is not possible from `xcrun simctl`. The DCIM folder had 20 files before the launch; I did not take a photo, so the count is unchanged. The fallback path is verified by reading only: with no RAW format, `rawPixelFormat(for:)` returns `nil` for every choice, the `if let rawType` block is skipped, `livePhotoMovieFileURL` and prioritization are the chapter 7 lines, `rawData` stays `nil`, and `MediaLibrary.save` takes the `else` branch that is the old code.
- Simulator-only inference: `availableRawPhotoPixelFormatTypes` is empty on SimCam, so both flags are false and the menu is hidden. The launch confirms the hidden menu (the flags came out false). The canvas preview (`PreviewCameraModel` reports both supported) was not opened in Xcode.
- NOT verified (needs a real iPhone with a Pro model): see the last section.

## What the chapter adds
- `Model/DataTypes.swift`: `enum RAWFormat: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable` with `off`, `appleProRAW`, `bayerRAW` (descriptions "Off", "Apple ProRAW", "RAW"); `PhotoFeatures.rawFormat` (`var rawFormat = RAWFormat.off`, so the memberwise initializer keeps the old two-argument form); `Photo.rawData: Data?`; `CaptureCapabilities.isAppleProRAWSupported` and `isBayerRAWSupported` (initializer parameters, default false).
- `Capture/PhotoCapture.swift`: private `rawPixelFormat(for:) -> OSType?` (first ProRAW or first Bayer format from `availableRawPhotoPixelFormatTypes`); in `createPhotoSettings(with:)` the RAW block (`AVCapturePhotoSettings(rawPixelFormatType:processedFormat:)`, HEVC or JPEG as processed codec), `excludesLivePhoto`, the Bayer `.speed` override, a `logger.debug` line with the chosen format; in `updateConfiguration(for:)` `isAppleProRAWEnabled = isAppleProRAWSupported`; in `updateCapabilities(for:)` the two flags; in the delegate `rawData`, the `isRawPhoto` branch with a `logger.debug` line with the DNG size, and `rawData:` in the `Photo(...)` call.
- `Model/MediaLibrary.swift`: `save(photo:)` saves the DNG as `.photo` and the processed data as `.alternatePhoto` when `rawData` exists.
- `Model/Camera.swift`: `rawFormat { get set }` and `captureCapabilities { get }`.
- `CameraModel.swift`: `rawFormat`, `captureCapabilities`, `rawFormat:` in `PhotoFeatures(...)`, a new `Task` in `observeState()` that copies the capabilities and resets an unsupported `rawFormat` to `.off`.
- `Preview Content/PreviewCameraModel.swift`: `rawFormat`, and `captureCapabilities` with both flags true.
- `Views/Toolbars/FeatureToolbar/FeatureToolbar.swift`: `rawMenu` (after `prioritizePicker` in the `HStack`), private `supportedRAWFormats`. The menu shows only when more than one choice exists (Off plus at least one RAW kind). Symbols `r.square` and `r.square.fill`.

## Changes to earlier code (use `remove` fences)
- `PhotoCapture.createPhotoSettings`: the line `photoSettings.livePhotoMovieFileURL = features.isLivePhotoEnabled ? URL.movieFileURL : nil` becomes the version with `&& !excludesLivePhoto`.
- `PhotoCapture.updateCapabilities`: the one-line `capabilities = CaptureCapabilities(isLivePhotoCaptureSupported: ...)` becomes three lines.
- Delegate `didFinishProcessingPhoto`: the line `photoData = photo.fileDataRepresentation()` moves into the `else` branch.
- Delegate `didFinishCaptureFor`: the `Photo(data: photoData, isProxy: isProxyPhoto, livePhotoMovieURL: livePhotoMovieURL)` call gets `rawData: rawData`.
- `MediaLibrary.save(photo:)`: the line `creationRequest.addResource(with: photo.isProxy ? .photoProxy : .photo, data: photo.data, options: options)` and its comment move into the `else` branch (re-indented).
- `CameraModel.capturePhoto()`: the `PhotoFeatures(isLivePhotoEnabled: isLivePhotoEnabled, qualityPrioritization: qualityPrioritization)` line gets a third argument (the line is split in two).
- `CaptureCapabilities.init`: the one-parameter initializer is replaced by a three-parameter one.

## Build order (each section compiles)
1. `DataTypes.swift`: `RAWFormat`, `PhotoFeatures.rawFormat`, the two capability flags and the new initializer. Compiles (all new members have defaults).
2. Saving: `Photo.rawData`, the delegate (`rawData`, the `isRawPhoto` branch, the `Photo(...)` call) and `MediaLibrary.save`. Do `Photo.rawData` and the `Photo(...)` call together: after `Photo.rawData` alone the project does NOT compile. Compiles at the end of the section.
3. Settings: `rawPixelFormat(for:)`, the RAW block, `excludesLivePhoto`, the Bayer override, `isAppleProRAWEnabled`, the two flags in `updateCapabilities`. Compiles. `RAWFormat` is used only through `features.rawFormat`.
4. The model: `Camera` protocol, `CameraModel`, `PreviewCameraModel`. After the protocol edit alone the project does NOT compile (two conformers miss the members). Add all three before the next build. In the Simulator nothing changes.
5. The toolbar: `supportedRAWFormats`, `rawMenu`, the line in `body`. Build and run: no RAW control in the Simulator; the canvas preview shows it.

## Design decisions to explain
- Two levels again: enable ProRAW on the output (`isAppleProRAWEnabled`, before `startRunning()`; `setUpSession()` calls `updateConfiguration` before that), choose a RAW format per capture in the settings.
- One list of RAW formats: ProRAW formats are added after the Bayer ones. `isBayerRAWPixelFormat(_:)` and `isAppleProRAWPixelFormat(_:)` sort them. The capability flags come from the list (not from `isAppleProRAWSupported`) so the flag and the request use the same test.
- A RAW plus processed request calls `didFinishProcessingPhoto` twice. Without the `isRawPhoto` branch, the second call would overwrite the processed data with the DNG (or the reverse). `fileDataRepresentation()` returns DNG data for the RAW photo.
- The processed photo always has a codec (HEVC, JPEG when HEVC is missing), because a RAW request needs a `processedFormat` for a processed photo; `nil` would give RAW only.
- Rules that throw an exception: Bayer needs `.speed` (the code overrides the picker for that capture only); ProRAW must have no Live Photo movie URL. Bayer also needs zoom 1.0. This app has no zoom control yet, so the code has no zoom line (a later chapter that adds zoom must reset it before a Bayer capture). Constant color is out of scope (it cannot combine with RAW).
- Live Photo with Bayer RAW is allowed by the header, so only ProRAW removes the movie URL. If a device test shows a problem, remove it for both.
- Hiding: the menu hides when the device offers no RAW. `CameraModel` also resets a stored choice to `.off` after a camera switch if the new camera does not support it, so no unsupported request reaches `capturePhoto`. The `rawPixelFormat(for:)` check is a second guard.
- Saving follows Apple's article: DNG `.photo`, processed `.alternatePhoto`. Research says other sources use the reverse order; the device check decides. The `.photo` resource is added from `Data`, as the article does.
- A deferred proxy with RAW: the code sends the processed data as `.alternatePhoto` even if `isProxy` is true (a proxy with a DNG is untested). If the device test fails, turn off `isAutoDeferredPhotoDeliveryEnabled` while a RAW mode is chosen.
- Quality: `maxPhotoDimensions` stays at the largest size, so a ProRAW DNG may be very big. The log line shows the size.

## What needs a real iPhone (Pro model)
- The RAW menu shows, with Apple ProRAW and RAW as separate choices (Bayer only on single cameras, so it may not show on the virtual back camera). Check the Xcode console for `Capturing with RAW format: ...` and `Captured RAW photo, N bytes`.
- The capture itself: no exception for ProRAW with Live Photo on; no exception for Bayer with the quality menu on Quality.
- The DNG in Photos: one asset or two; the RAW badge; whether Photos shows the DNG or the HEIF first (primary or alternate order).
- Deferred delivery with RAW: does the processed photo arrive as a proxy, and does the save work.
- `resolvedSettings.rawPhotoDimensions` and the DNG size with the largest `maxPhotoDimensions` (the code does not log the dimensions; only the byte size).
- Whether normal photos stay as fast after `isAppleProRAWEnabled = true` (it changes the capture pipeline).
- The expected error path: if the RAW fails and the HEIF works, the delegate logs the error and returns without data, so `noPhotoData` or the processed photo alone result. Not tested.

## Coordinator check (15 Oct 2026)
- The chapter 8 build launches in the iPhone 18 Pro simulator with SimCam; the RAW control is hidden, as planned.
- A tap on the capture button saved NO photo (DCIM count stayed at 20, no thumbnail). The same happened with the chapter 7 end state, with Live Photo on and off. The chapter 4 end state saved a photo earlier the same day. The app log shows no error line. So the fault is not in chapter 8; something between chapters 4 and 7 (quality prioritization, deferred delivery, responsive capture, Live Photo settings) no longer completes a capture in the Simulator. On 1 Oct the chapter 7 build saved a JPEG. Open item for the chapter 9 agent: find the step at which the Simulator capture stops working, and whether a setting must be guarded with its `isSupported` flag.
