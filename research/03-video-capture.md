# Dossier 03 — Video (movie) capture and audio in AVCam

Scope: movie recording and audio only. Session and device basics, photo capture, Camera Control, hardware button events, and the Lock Screen extension are in other dossiers.

## How to read this dossier

**Sources and trust.**

- **[H]** = SDK header in `iPhoneOS27.1.sdk` (Xcode 27.1, build 27A9269). Ground truth for names and availability. Path: `/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk/System/Library/Frameworks/AVFoundation.framework/Headers/`.
- **[D]** = Apple documentation page (fetched as JSON, HTTP 200 checked).
- **[W]** = WWDC session transcript (fetched from the session page).
- **[S]** = the sample code, cited as `path:line`.
- **[I]** = my inference. Not stated by Apple. Test on a device before you teach it as fact.

**Sample facts.** Deployment target is iOS 26.0 for all targets (`AVCam.xcodeproj/project.pbxproj:635`). `SWIFT_VERSION = 5.0`. `README.md:17` still says "iOS 18 or later", which is out of date: the code calls iOS 26 API without availability checks (`CaptureService.swift:128`, `:140`, `:143`).

**The video path in one picture.**

```
CaptureButton (CaptureButton.swift:42-46)
  -> CameraModel.toggleRecording()        (CameraModel.swift:178-192)
     -> CaptureService.startRecording()   (CaptureService.swift:489-491)   [actor, session queue]
        -> MovieCapture.startRecording()  (MovieCapture.swift:36-46)
           -> AVCaptureMovieFileOutput.startRecording(to:recordingDelegate:)
     -> CaptureService.stopRecording()    (CaptureService.swift:494-496)
        -> MovieCapture.stopRecording()   (MovieCapture.swift:50-60)   continuation <- delegate callback
     -> MediaLibrary.save(movie:)         (MediaLibrary.swift:76-86)   file moved into Photos
```

---

## What the newest commit changed in MovieCapture.swift

Commit `72b0fdb` ("Incorporated WWDC26 session 303 content into AVCam"). Run `git show HEAD -- AVCam/Capture/MovieCapture.swift` to see it.

**What moved.** Two pieces of connection setup left `startRecording()` and went into `updateConfiguration(for:)`:

| Before (in `startRecording`) | After (in `updateConfiguration`, `MovieCapture.swift:100-121`) |
|---|---|
| `guard let connection … else { fatalError(…) }` | `guard let connection = movieOutput.connection(with: .video) else { return }` (`:107`) |
| Set HEVC with `setOutputSettings` on every record tap | Same call, once per new connection (`:110-112`) |
| Set `preferredVideoStabilizationMode = .auto` on every record tap | Same call, once per new connection (`:118-120`) |
| `delegate = MovieCaptureDelegate()` then `recordingDelegate: delegate!` | Local `let delegate`, no force unwrap (`:43-45`) |

**Why.** The reasons are in the new code comments, not in the session.

1. **Framing.** Stabilization crops the image. If you turn it on at the record tap, the picture changes size at the moment recording starts. The comment at `MovieCapture.swift:114-117` says this in plain words. [S]
2. **Connection lifetime.** A video connection exists only while the movie output is in the session. `addOutput` makes a new connection each time. So the right moment to configure it is "the connection was just created", not "the user tapped record" (`MovieCapture.swift:104-106`). [S]
3. **One commit.** `updateConfiguration` runs from `updateCaptureCapabilities()` (`CaptureService.swift:525-535`). The callers `setCaptureMode` (`:274-275`) and `changeCaptureDevice` (`:330-331`) hold a `beginConfiguration`/`commitConfiguration` pair open, so the stabilization change joins the same atomic commit as the output or input change. The old code changed the pipeline outside any bracket, right before `startRecording`. [S][I]
4. **No crash in photo mode.** `updateConfiguration` now runs for both output services in both modes (`CaptureService.swift:527`). In photo mode the movie output is not in the session, so there is no connection. The old `fatalError` would be wrong here; the new `guard … return` is correct. [S]

**What session 303 really covers.** WWDC26 session 303 is "Build a responsive camera app that launches quickly". I searched its transcript: the words "stabilization" and "HEVC" do not occur. Its topics are deferred start, preview rendering, `hardwareCost`/system pressure, and `AVProVideoStorage`. One line fits this change: commit one configuration and avoid extra lengthy reconfigurations. So present the move as "consistent with the session's advice", not as "taught in the session". [W]

**Other parts of the same commit that touch video** (`CaptureService.swift:137-151`): `automaticallyRunsDeferredStart = true` and `isDeferredStartEnabled` on the movie output. See section 3 and section 10.

---

## 1. AVCaptureMovieFileOutput

### (a) Concept

`AVCaptureMovieFileOutput` is the "do it all for me" recorder. You give it a file URL. It takes video and audio from the session, compresses them, keeps them in sync, and writes a QuickTime (`.mov`) file. You do not see the frames. The class is a subclass of `AVCaptureFileOutput`, which holds the start/stop API and the limits. [H `AVCaptureFileOutput.h:23-36`, `:396-405`]

A recording has three moments:

1. **Start request.** `startRecording(to:recordingDelegate:)` returns at once. Writing starts a little later.
2. **Running.** The output writes samples. `recordedDuration` and `recordedFileSize` grow.
3. **Finish.** After `stopRecording()` (or an error, or a limit), the output writes the remaining data in the background. Only when the delegate receives `fileOutput(_:didFinishRecordingTo:from:error:)` is the file complete. [H `:85-97`]

### (b) Key APIs

| API | Facts | Source |
|---|---|---|
| `startRecording(to:recordingDelegate:)` | Fails if a file exists at the URL. On iOS only one recording at a time (`AVError.recordingAlreadyInProgress`, -11859). You must stop before you start again. | [H `:62-83`], [H `AVError.h:97`], [D] |
| `stopRecording()` | Asynchronous. Wait for the delegate before you use the file. | [H `:85-97`] |
| `isRecording` | True while the output has a file open. | [H `:99-107`] |
| `pauseRecording()` / `resumeRecording()` / `isRecordingPaused` | **iOS 18.0+** (macOS since 10.7). Several segments go into one file. A format or device change stops the recording even when paused. | [H `:109-145`] |
| `recordedDuration` (`CMTime`), `recordedFileSize` (`Int64`) | Live values for the current file. The header does not say they are key-value observable. | [H `:147-165`] |
| `maxRecordedDuration` | Hard limit. Default `CMTime.invalid` = no limit. | [H `:167-175`] |
| `maxRecordedFileSize` | Hard limit in bytes. Default 0 = no limit. | [H `:177-185`] |
| `minFreeDiskSpaceLimit` | Stop when free space falls below this. | [H `:187-195`] |
| `movieFragmentInterval` | Default 10 s. `CMTime.invalid` turns fragments off. For external storage use 10 s or more. | [H `:415-427`] |
| `metadata` | `[AVMetadataItem]`, top-level items written to each file. | [H `:429-437`] |
| `availableVideoCodecTypes` | Codecs you may put in `AVVideoCodecKey`. **The first one is the default.** The list can change with the session preset. | [H `:439-447`] |
| `supportedOutputSettingsKeys(for:)` | The only keys iOS accepts in `setOutputSettings`. iOS 12+. | [H `:449-460`] |
| `outputSettings(for:)` / `setOutputSettings(_:for:)` | Per connection. `nil` = the preset decides. Empty dictionary = do not re-encode. | [H `:462-494`] |
| `setRecordsVideoOrientationAndMirroringChangesAsMetadataTrack(_:for:)` | Adds a timed metadata track with orientation changes. Read only at record start. | [H `:509-530`] |
| `isPrimaryConstituentDeviceSwitchingBehaviorForRecordingEnabled` and `setPrimaryConstituentDeviceSwitchingBehaviorForRecording(_:restrictedSwitchingBehaviorConditions:)` | Controls lens switching of a virtual camera during recording. Default: enabled, behavior `.restricted`. | [H `:532-570`] |

**Delegate (`AVCaptureFileOutputRecordingDelegate`)** [H `:200-336`]

| Method (Swift name) | Required | iOS | Note |
|---|---|---|---|
| `fileOutput(_:didStartRecordingTo:from:)` | no | 4.0 | Might not be called if an error prevents all writing. |
| `fileOutput(_:didStartRecordingTo:startPTS:from:)` | no | 18.2 | Gives the timestamp of the first buffer on the session's `synchronizationClock`. If you implement it, the older variant is not called. |
| `fileOutput(_:didPauseRecordingTo:from:)` | no | 18.0 | Not guaranteed if the recording stops first. |
| `fileOutput(_:didResumeRecordingTo:from:)` | no | 18.0 | Same. |
| `fileOutput(_:willFinishRecordingTo:from:error:)` | no | macOS only | Not available on iOS. |
| `fileOutput(_:didFinishRecordingTo:from:error:)` | **yes** | 4.0 | **Always** called once for each recording request, even if nothing was written. |

All callbacks arrive on an unspecified thread. [H `:225`, `:330`]

**Output settings rules on iOS** [H `:477-494`]

- Only keys from `supportedOutputSettingsKeys(for:)` are legal. Any other key throws `NSInvalidArgumentException`.
- `AVVideoCodecKey` must be a member of `availableVideoCodecTypes`.
- If you pass `AVVideoCompressionPropertiesKey` (iOS 12+), you must also pass `AVVideoCodecKey`. The compression sub-dictionary may be sparse; the output fills in the rest.
- `outputSettings(for:)` returns a fully populated dictionary. If you read it, change a value, and write it back, you must first remove the keys that are not supported.

**Codecs.** Constants in `AVVideoSettings.h:43-57` [H]:

| Swift | FourCC | iOS |
|---|---|---|
| `.hevc` | `hvc1` | 11 |
| `.h264` | `avc1` | 11 |
| `.jpeg` | `jpeg` | 11 |
| `.proRes4444` | `ap4h` | 11 |
| `.proRes4444XQ` | `ap4x` | 18 |
| `.proRes422` / `.proRes422HQ` / `.proRes422LT` / `.proRes422Proxy` | `apcn` / `apch` / `apcs` / `apco` | 11 / 13 / 13 / 13 |
| `.proResRAW` / `.proResRAWHQ` | `aprn` / `aprh` | 26 |
| `.hevcWithAlpha` | `muxa` | 13 |

A constant in the header does not mean the camera can record it. Only `availableVideoCodecTypes`, read after the session is configured, tells you what this device offers for the active format.

- **HEVC versus H.264.** HEVC gives about the same quality in a smaller file and is the codec for 10-bit HDR. H.264 plays on more non-Apple systems. Apple's article says the framework picks HEVC by default on most iPhone and iPad models, and that the system share sheet converts for the destination. [D "Recording movies in alternative formats"]
- **ProRes (overview).** An editing codec with very high data rates. It is available only on supported devices and formats. It is usually combined with Apple Log, external storage, or (iOS 27) Pro Video Storage. See sections 4 and 10.

### (c) Why AVCam does it this way, and the alternatives

- **One long-lived output object.** `let output = AVCaptureMovieFileOutput()` (`MovieCapture.swift:18`). The service adds and removes this same object when the mode changes. [S]
- **A new delegate object for each recording** (`MovieCapture.swift:43-45`). The delegate holds the continuation for that recording. `MovieCapture` keeps a strong reference in `delegate` (`:23`); the header does not promise that the output retains the delegate. [S][I]
- **Async bridge.** `stopRecording()` creates a `CheckedContinuation`, stores it on the delegate, and then calls `movieOutput.stopRecording()` (`MovieCapture.swift:50-60`). The delegate resumes it with a `Movie` or an error (`:68-76`). This turns "start, then later a callback" into `let movie = try await stopRecording()`. [S]
- **Explicit HEVC** (`MovieCapture.swift:110-112`). On most devices HEVC is already first in the list, so this line mostly documents the intent. It matters on devices or presets where another codec is first. The `contains(.hevc)` check keeps the call legal. [S][H]
- **No limits, no metadata, default fragments.** The sample sets no `maxRecordedDuration`, no `metadata`, and keeps the 10 s fragment interval. Location goes on the Photos asset, not into the file (`MediaLibrary.swift:83`). [S]

Alternatives:

- Resume the continuation from an `AsyncStream` of finished recordings, so a recording that ends on its own is not lost (see pitfalls).
- Use `fileOutput(_:didStartRecordingTo:…)` to switch the UI to "recording" only when writing has really started.
- Write location into the file with an `AVMetadataItem` whose identifier is `.quickTimeMetadataLocationISO6709`, so the location survives outside Photos.
- Use `AVCaptureVideoDataOutput` + `AVAssetWriter` (section 2).

### (d) Pitfalls

1. **A non-nil error does not always mean a bad file.** When a limit stops the recording (`maximumDurationReached`, `maximumFileSizeReached`, `diskFull`), or the session is interrupted, the delegate gets an error. Look at `AVErrorRecordingSuccessfullyFinishedKey` in `userInfo` (a Bool: "is the recording playable"). [H `AVError.h:20`, `:40-51`] The sample throws on every error (`MovieCapture.swift:69-71`), so it would discard a good file. A better delegate:

   ```swift
   // Sketch, not compiled.
   func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo url: URL,
                   from connections: [AVCaptureConnection], error: Error?) {
       let finishedOK = (error as NSError?)?
           .userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? (error == nil)
       if finishedOK { /* keep and save the file */ } else { try? FileManager.default.removeItem(at: url) }
   }
   ```

2. **A recording that ends on its own is lost in the sample.** [S][I] The continuation is set only inside `stopRecording()` (`MovieCapture.swift:54`). If the output finishes first (phone call, app moves to the background, disk full, camera format changes), the delegate runs with `continuation == nil` and the result is dropped (`:71`, `:74` use optional chaining). The timer keeps running, so the UI still shows "recording". When the user then taps stop, `stopRecording()` waits for a callback that already happened. That `await` never returns, the file stays in `tmp`, and no error is shown.
3. **`stopRecording()` with no delegate never resumes.** If `delegate` is `nil`, `delegate?.continuation = continuation` does nothing and the continuation is never resumed. [S]
4. **The UI state is optimistic.** `startMonitoringDuration()` sets `.movieCapture()` before `startRecording` is called (`MovieCapture.swift:41`, `:83`). The UI shows "recording" before any frame is written. [S]
5. **File exists.** Recording fails if the URL already has a file. The sample avoids this with a UUID file name (`FoundationExtensions.swift:12-14`). [H][S]
6. **Callback thread.** The delegate runs on an unspecified thread. Do not touch actor or main-actor state there without a hop. [H]
7. **Rotation is fixed at start.** The file gets one display matrix, taken at record start. Later rotation changes are not stored unless you turn on the orientation metadata track. [H `:519-528`]
8. **Fragments.** With `movieFragmentInterval = .invalid`, a crash during recording leaves an unreadable file. Keep the default unless you have a reason. [D][H]
9. **Order of configuration.** `availableVideoCodecTypes` depends on the preset. Read it after the session has the final preset and format. [H]
10. **Lens switching is restricted while recording** by default on virtual cameras. Zoom during a recording might not change lens as it does in preview. [H `:553-570`]

### (e) Beyond what AVCam uses

- Pause and resume (iOS 18).
- Start timestamp callback (iOS 18.2) for exact sync with other data.
- Duration, size, and free-space limits.
- `AVVideoCompressionPropertiesKey` (bit rate, key frame interval, profile) — check `supportedOutputSettingsKeys(for:)` first.
- Timed metadata from your app into the movie: `AVCaptureMetadataInput` (iOS 9) connects only to a movie file output. [H `AVCaptureInput.h` `AVCaptureMetadataInput`]
- Spatial video, Cinematic video metadata, Pro Video Storage (section 10).
- Low light video noise reduction on the connection (iOS 27; automatic by default for movie file output connections). [H `AVCaptureSession.h:1275-1288`]

### (f) Links

See the table at the end: AVCaptureMovieFileOutput, AVCaptureFileOutput, AVCaptureFileOutputRecordingDelegate, startRecording, stopRecording, pause/resume, recordedDuration, maxRecordedDuration, movieFragmentInterval, metadata, availableVideoCodecTypes, setOutputSettings, AVVideoCodecType, "Recording movies in alternative formats", AVErrorRecordingSuccessfullyFinishedKey.

---

## 2. Movie file output versus data outputs + AVAssetWriter

### (a) Concept

There are two ways to make a movie file.

- **Movie file output.** The system owns compression, sync, and the file. You own one start call, one stop call, and one callback.
- **Data outputs + asset writer.** `AVCaptureVideoDataOutput` and `AVCaptureAudioDataOutput` give you each `CMSampleBuffer`. You pass the buffers to `AVAssetWriterInput` objects of an `AVAssetWriter`. You own everything: timing, back-pressure, orientation, and finishing the file.

### (b) When you need each

| Need | Movie file output | Data outputs + AVAssetWriter |
|---|---|---|
| Plain recording of what the camera sees | Best choice | More work, no gain |
| Filters or drawing burned into the video | Not possible | Required |
| Per-frame analysis (Vision, Core ML), live streaming | Not possible | Required |
| Custom preview rendered with Metal | Not possible | Required |
| Pause/resume before iOS 18 | Not possible | Drop buffers and shift timestamps yourself |
| Pause/resume on iOS 18+ | `pauseRecording()` | Still manual |
| File container other than `.mov`, fragmented MP4/HLS segments | Not possible | `AVAssetWriter` |
| Start/stop on an exact sample | Not on iOS | You choose the first and last buffer |
| 10-bit HDR with Dolby Vision metadata | Automatic | Possible; see `preservesDynamicHDRMetadata` |
| Spatial video, Cinematic video | One flag on the output (spatial) or the input (Cinematic) | More complex |
| Spatial Audio | `multichannelAudioMode` on the input | iOS 26: two audio data outputs + a metadata generator |
| Live Photo capture in the same session | **Blocks** Live Photo | **Allowed** |

The last row is from the photo output header: Live Photo and movie file output cannot be used together, but Live Photo and video data output can. [H `AVCapturePhotoOutput.h:43`]

### (c) Key APIs for the data-output route (overview)

- `AVCaptureVideoDataOutput.setSampleBufferDelegate(_:queue:)`, `alwaysDiscardsLateVideoFrames`, `videoSettings`.
- `AVCaptureAudioDataOutput.setSampleBufferDelegate(_:queue:)` — use a serial queue, or audio arrives out of order. [H `AVCaptureAudioDataOutput.h:41-58`]
- Helpers that give settings "comparable to that of AVCaptureMovieFileOutput": `recommendedVideoSettingsForAssetWriter(writingTo:)`, `recommendedVideoSettings(forVideoCodecType:assetWriterOutputFileType:)`, `availableVideoCodecTypesForAssetWriter(writingTo:)`, `recommendedAudioSettingsForAssetWriter(writingTo:)`. Ask for them after the session is configured; they depend on the configuration. [H `AVCaptureVideoDataOutput.h:95-184`]
- iOS 26 additions: `recommendedMovieMetadata(forVideoCodecType:assetWriterOutputFileType:)`, `recommendedMediaTimeScaleForAssetWriter`, `preservesDynamicHDRMetadata` (set it and also set `kVTCompressionPropertyKey_PreserveDynamicHDRMetadata` in the writer's compression settings to record HDR movies with the writer). [H `:186-204`, `:275-278`]

### (d) Mixing both

- A normal `AVCaptureSession` can hold a movie file output **and** video data outputs. The header for `hardwareCost` names exactly this combination. Check `hardwareCost` after the commit. [H `AVCaptureSession.h:640-646`]
- iOS 26: a session can run a movie file output and an audio data output at the same time, so you can record to a file and draw an audio waveform. [W WWDC25-251]

### (e) Why AVCam uses the movie file output

The sample records the camera image without changes. The movie file output gives that with about 40 lines of code (`MovieCapture.swift:36-77`). The price is the Live Photo conflict, which forces the mode switch in section 3. [S]

### (f) Pitfalls of the data-output route

- A slow delegate drops frames (`captureOutput(_:didDrop:from:)`).
- You must call `startSession(atSourceTime:)` with the first buffer's timestamp and keep audio and video in step.
- You must set the track transform for orientation.
- You must finish the writer, also on interruption.
- `AVAssetWriterInput.isReadyForMoreMediaData` must be respected, with `expectsMediaDataInRealTime = true`.

---

## 3. Switching capture mode

### (a) Concept

A session has one configuration at a time. "Photo mode" and "video mode" are two configurations with a different preset and a different set of outputs. A change of mode is a reconfiguration of the capture pipeline.

### (b) What the sample does

`setCaptureMode(_:)` at `CaptureService.swift:269-293`:

```
photo:  sessionPreset = .photo ; removeOutput(movieCapture.output)
video:  sessionPreset = .high  ; addOutput(movieCapture.output) ; if HDR was on, setHDRVideoEnabled(true)
both:   updateCaptureCapabilities()   // also configures HEVC + stabilization on the new connection
```

The photo output stays in the session in both modes (`CaptureService.swift:142-144`). The first configuration happens in `setUpSession()` (`:135-151`) with the same rules.

### (c) Why

- **`.photo` for photos.** This preset selects a format for full-resolution, photo-quality output. [H `AVCaptureSessionPreset.h:23-31`] With the photo preset, a movie output would record only at preview resolution, not sensor resolution. [H `AVCaptureDevice.h` `unsupportedCaptureOutputClasses` discussion] So `.photo` is the wrong preset for video.
- **`.high` for video.** "High quality video and audio output", and the default preset of a new session. [H `:33-41`] The header gives no resolution. It depends on the device. [I: on recent iPhones this is usually a 16:9 1080p format at up to 30 fps; print `activeFormat` on your device.]
- **Remove the movie output in photo mode.** If a movie file output is in the session, `AVCapturePhotoOutput.isLivePhotoCaptureSupported` returns `false`. [H `AVCapturePhotoOutput.h:43`] The comment at `CaptureService.swift:280` says the same. Live Photo matters more than instant recording for this sample.
- **`beginConfiguration()` / `commitConfiguration()`.** All changes between the two calls are applied together at the outermost commit. Pairs can be nested. You must commit before `startRunning()` or `stopRunning()`. [H `AVCaptureSession.h:460-478`] The sample uses `defer` so the commit also runs when `addOutput` throws (`CaptureService.swift:274-275`). `setHDRVideoEnabled` opens its own pair inside (`:501-502`), which is a legal nested pair.

### (d) The cost

- A preset change, a format change, and an output change each rebuild the pipeline. The header calls this a "lengthy reconfiguration". [H `AVCaptureDevice.h:2310-2313`] The preview can freeze for a moment.
- The sample hides this: `CameraModel` sets `isSwitchingModes` around the call (`CameraModel.swift:105-106`) and the preview is blurred while it is true (`PreviewContainer.swift:65`).
- A preset change resets `activeVideoMinFrameDuration` and `activeVideoMaxFrameDuration` to the defaults. [H `AVCaptureDevice.h:399-402`]
- A new output means a new connection. Everything set on the old connection (rotation angle, stabilization, output settings) is gone. This is why `updateConfiguration` re-applies HEVC and stabilization, and why rotation is re-applied elsewhere.
- Deferred start (iOS 26): a movie output is deferred by default for apps linked with the iOS 26 SDK. The session prepares it after the preview is up. If a capture needs the output earlier, the session runs the deferred start for you. [H `AVCaptureOutputBase.h:117-131`, `AVCaptureSession.h:670-679`] The sample sets the flag only in `setUpSession` (`CaptureService.swift:148`); for a later switch to video it relies on the default.

### (e) Alternatives

| Design | Gain | Loss |
|---|---|---|
| Sample: swap preset and output for each mode | Live Photo in photo mode; best format for each mode | A visible pause at each switch |
| Keep the movie output always attached | Instant recording from photo mode | No Live Photo; photo preset gives low-resolution video |
| Photo mode + video data output + asset writer | Live Photo and video recording in one configuration | Much more code |
| Set `activeFormat` yourself (preset becomes `.inputPriority`) and pick a format that is good for both | Full control, fewer switches | You must choose formats for each device; check `isHighestPhotoQualitySupported` for photos |

### (f) Pitfalls

1. **Unverified ordering inside the open configuration.** [I] In `setCaptureMode(.video)` the code sets `.high` and then calls `setHDRVideoEnabled(true)` before the outer commit. `activeFormat10BitVariant` reads `device.activeFormat`. The header says changes are "pended" until the commit. If `activeFormat` still showed the photo format at that moment, the HDR search would use the wrong dimensions. The sample depends on `activeFormat` already showing the `.high` format. Test this on a device: log `activeFormat` after the preset assignment and after the commit.
2. **State is changed before it can fail.** `self.captureMode = captureMode` runs first (`CaptureService.swift:271`). If `addOutput` throws, the stored mode says `.video` but the session has no movie output. `CameraModel` uses `try?` (`CameraModel.swift:108`), so nobody sees the error.
3. **Calling `.video` twice** makes `canAddOutput` return `false` and throws `addOutputFailed`.
4. **The mode picker is disabled during recording** (`CaptureModeView.swift:30`). Keep this: removing the output or changing the format ends a recording.
5. **README drift.** The README version of `setCaptureMode` (`README.md:147-168`) does not have the HDR lines that the code has (`CaptureService.swift:286-288`).

---

## 4. Formats and HDR video

### (a) Concept

**Format.** An `AVCaptureDevice.Format` is one way the sensor and image pipeline can run: a pixel size, a pixel format, frame-rate ranges, field of view, binning, supported color spaces, supported stabilization modes, and more. A camera has many formats. Objects are immutable. [H `AVCaptureDevice.h:3349-3363`]

**Two ways to choose a format.** [H `AVCaptureDevice.h:369-384`, `AVCaptureSessionPreset.h:153-161`]

- **Preset.** You set `session.sessionPreset`. The session chooses `activeFormat` for you.
- **Direct.** You set `device.activeFormat`. The session's preset then changes to `.inputPriority` by itself. This means "the input decides; the session keeps its hands off the format".
- The two are mutually exclusive on iOS. If you later set a preset other than `.inputPriority`, the session takes control again and may replace your format.

**Pixel formats you see in the format list.** [H `CVPixelBuffer.h:111-116`], [W WWDC21-10047]

| FourCC | Constant | Meaning |
|---|---|---|
| `420v` | `kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange` | 8-bit, 4:2:0, video range |
| `420f` | `kCVPixelFormatType_420YpCbCr8BiPlanarFullRange` | 8-bit, 4:2:0, full range |
| `x420` | `kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange` | **10-bit**, 4:2:0, video range (luma 64–940) |
| `x422` | `kCVPixelFormatType_422YpCbCr10BiPlanarVideoRange` | 10-bit, 4:2:2, video range |
| `xf20` | `kCVPixelFormatType_420YpCbCr10BiPlanarFullRange` | 10-bit, 4:2:0, full range |

Since iPhone 12, some formats come in groups of three: `420v`, `420f`, and `x420` with the same size and frame-rate range. [W WWDC21-10047]

**Two different things are called "HDR video".** [H `AVCaptureDevice.h:3568-3577`, `:2305-2314`]

| | "Video HDR" = EDR | 10-bit HDR |
|---|---|---|
| API | `format.isVideoHDRSupported`, `device.isVideoHDREnabled`, `device.automaticallyAdjustsVideoHDREnabled` | A 10-bit format (`x420`) with color space `.HLG_BT2020` |
| How it works | The sensor runs at twice the frame rate. An under-exposed frame and a normal frame are merged. | More bits and the HLG transfer function with BT.2020 primaries |
| On/off | Can be switched. Default is automatic (`automaticallyAdjustsVideoHDREnabled == true`). | "Always on". Cannot be switched off for that format. |
| File | Normal 8-bit SDR movie with better highlights | 10-bit HEVC movie that contains Dolby Vision metadata |
| Relation | `isVideoHDRSupported` is always `false` for 10-bit formats that support only HLG BT.2020. `isVideoHDREnabled` is ignored when the active color space is HLG BT.2020. | |

**The sample's "HDR" button means 10-bit HDR.** It never touches `isVideoHDREnabled`.

**Color spaces** (`AVCaptureColorSpace`). [H `AVCaptureDevice.h:2318-2330`]

| Swift case | iOS | Meaning |
|---|---|---|
| `.sRGB` | 10 | Standard |
| `.P3_D65` | 10 | Wide color |
| `.HLG_BT2020` | 14.1 | BT.2020 primaries + Hybrid Log-Gamma: the HDR video color space |
| `.appleLog` | 17 | BT.2020 primaries + Apple log curve, for grading |
| `.appleLog2` | 26 | Apple Gamut primaries + Apple log curve |

- `format.supportedColorSpaces` lists what a format allows, from narrow to wide.
- `device.activeColorSpace` is the current one. To set it you need `lockForConfiguration()`. A change while the session runs is disruptive: movie recordings end at once and the preview freezes for a moment. [H `:2336-2343`]
- `session.automaticallyConfiguresCaptureDeviceForWideColor` (default `true`): the session sets format and color space for you and prefers wide color when a photo output is present. If you set `activeColorSpace` yourself, set this property to `false`, or the session can undo your choice. With `.inputPriority` the session leaves `activeFormat` alone but **might still change `activeColorSpace`**. [H `AVCaptureSession.h:570-578`]
- With `.appleLog` or `.appleLog2` active, every photo output connection to that device becomes inactive. [H `:2326-2328`]

**Dolby Vision.** Apple documents only this: 10-bit HLG BT.2020 formats, when recorded to a movie, contain Dolby Vision metadata. [H `:3575`] The WWDC21 session adds that the metadata is per frame and is inserted for both the movie file output and the data-output + asset-writer route. [W WWDC21-10047] There is no capture API to switch it on or off or to pick a profile. The Dolby Vision profile number is **not** in the headers; treat any number as UNVERIFIED.

### (b) Exactly how `activeFormat10BitVariant` works

Code: `AVCam/Support/CaptureExtensions.swift:23-40`.

```swift
var activeFormat10BitVariant: AVCaptureDevice.Format? {
    formats.filter {
        $0.maxFrameRate == activeFormat.maxFrameRate &&
        $0.formatDescription.dimensions == activeFormat.formatDescription.dimensions
    }
    .first(where: { $0.isTenBitFormat })
}
```

Step by step:

1. Take all formats of the device.
2. Keep those with the same pixel dimensions as the active format. `==` on `CMVideoDimensions` comes from the sample's own extension (`:10-21`).
3. Keep those with the same "max frame rate". `maxFrameRate` is `videoSupportedFrameRateRanges.last?.maxFrameRate ?? 0` (`:37-39`).
4. From the rest, return the first whose media subtype is `x420` (`isTenBitFormat`, `:34-36`). Return `nil` if there is none.

How it is used:

- **Capability.** `MovieCapture.updateConfiguration` sets `isHDRSupported = device.activeFormat10BitVariant != nil` (`MovieCapture.swift:102`). This travels through `CaptureCapabilities` to `CameraModel.isHDRVideoSupported` (`CameraModel.swift:221`) and shows or hides the HDR button (`FeatureToolbar.swift:26`).
- **Switching on.** `setHDRVideoEnabled(true)` locks the device and sets `activeFormat` to the variant (`CaptureService.swift:505-509`). The preset becomes `.inputPriority`.
- **Switching off.** The `else` branch sets `sessionPreset = .high` (`CaptureService.swift:511`). The session takes control again and picks its own (8-bit) format.
- **Color space.** The sample never sets `activeColorSpace`. It relies on the session's automatic wide-color configuration to select HLG for the 10-bit format. [S][I]
- **Idempotent.** If the active format is already the 10-bit one, the search finds a format with the same size and rate (usually itself), so "supported" stays `true`.

This is the Swift form of the `tenBitVariantOfFormat` helper that Apple introduced with the WWDC21 version of AVCam. [W WWDC21-10047]

### (c) Limits of `activeFormat10BitVariant`

1. **"Max frame rate" is the last range, not the maximum.** `.last` assumes the ranges are sorted. The header gives no order. Use `.map(\.maxFrameRate).max()`.
2. **It does not check the color space.** It never looks at `supportedColorSpaces.contains(.HLG_BT2020)`. A 10-bit format is treated as "HDR" by pixel format alone.
3. **It only knows `x420`.** Formats in `x422` or `xf20` are ignored.
4. **Same size + same rate is not "same format".** Two formats can match on both and differ in field of view, binning (`isVideoBinned`), stabilization support, multi-cam support, or photo dimensions. `first` takes whatever is first in the list.
5. **It depends on the current active format.** The answer changes with the preset. In photo mode it answers for the photo format.
6. **The frame rate is not carried over.** A format change resets the frame durations to the defaults of the new format.
7. **Camera switch with HDR on.** [I] `changeCaptureDevice` (`CaptureService.swift:325-350`) does not call `setHDRVideoEnabled` for the new device. The preset is still `.inputPriority`, so the session does not choose a format for the new camera. The UI can say "HDR On" while the new camera runs an 8-bit format. Test on a device.
8. **Errors are swallowed.** If `lockForConfiguration()` throws, the code logs and keeps the old state (`CaptureService.swift:514-516`).
9. **The toggle is disabled during recording** (`FeatureToolbar.swift:88`). Keep this: a format change stops a recording.
10. **The persisted default is `true`.** `CameraState.isVideoHDREnabled` defaults to `true` (`CameraState.swift:25`) while `CameraModel.isHDRVideoEnabled` starts as `false` (`CameraModel.swift:166`); `syncState()` copies the stored value (`:95`).

A stricter search (sketch, not compiled):

```swift
extension AVCaptureDevice {
    func hlgVariant(of base: Format) -> Format? {
        func maxRate(_ f: Format) -> Double { f.videoSupportedFrameRateRanges.map(\.maxFrameRate).max() ?? 0 }
        let size = base.formatDescription.dimensions
        return formats.first { f in
            let d = f.formatDescription.dimensions
            return f.formatDescription.mediaSubType.rawValue == kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange
                && f.supportedColorSpaces.contains(.HLG_BT2020)
                && d.width == size.width && d.height == size.height
                && maxRate(f) == maxRate(base)
                && f.isVideoBinned == base.isVideoBinned
                && abs(f.videoFieldOfView - base.videoFieldOfView) < 0.5
        }
    }
}
```

### (d) Other pitfalls

- Set `activeFormat` only between `lockForConfiguration()` and `unlockForConfiguration()`. Without the lock it throws `NSGenericException`. A format that is not in `formats` throws `NSInvalidArgumentException`. [H `:369-373`]
- Put format, frame durations, and other changes inside one `beginConfiguration`/`commitConfiguration` pair so they are applied together. [H `:375-384`]
- Do not show a 10-bit recording as "HDR" with your own renderer unless you handle HLG. `AVCaptureVideoPreviewLayer` does the HDR tone mapping for you. [W WWDC26-303]
- Editing and playing HDR needs care; see WWDC20 sessions 10009 and 10010.

### (e) Beyond AVCam

- **EDR control.** Set `automaticallyAdjustsVideoHDREnabled = false`, then `isVideoHDREnabled`.
- **Apple Log / Apple Log 2.** Pick a format whose `supportedColorSpaces` contains the log space, set `automaticallyConfiguresCaptureDeviceForWideColor = false`, then set `activeColorSpace`. Photo capture is off while log is active.
- **ProRes.** If `availableVideoCodecTypes` contains a ProRes type for the active format, pass it in `setOutputSettings`. Data rates are very high: plan storage (section 10).
- **ProRes RAW (iOS 26).** Stabilization only produces metadata; rotation must stay at 0 for video data output; white balance must be locked before some queries. [H `AVCaptureSession.h:1089`, `:1209`, `AVCaptureVideoDataOutput.h:196`]
- **Global tone mapping:** `isGlobalToneMappingEnabled`.
- **Dynamic aspect ratio (iOS 26):** `setDynamicAspectRatio(_:completionHandler:)`.

### (f) Links

AVCaptureDevice.Format, formats, activeFormat, "Formats" collection, "Color" collection, Preset.inputPriority, isVideoHDRSupported, isVideoHDREnabled, automaticallyAdjustsVideoHDREnabled, AVCaptureColorSpace and its cases, activeColorSpace, supportedColorSpaces, automaticallyConfiguresCaptureDeviceForWideColor, the `x420` constant, WWDC21-10047, WWDC20-10009, WWDC20-10010.

---

## 5. Frame rates

### (a) Concept

A format does not have one frame rate. It has one or more **ranges** (`AVFrameRateRange`: `minFrameRate`, `maxFrameRate`, and the same as durations). The device runs at a rate inside the range. Auto exposure can lower the rate in low light to get a longer exposure.

AVFoundation states frame rate as a **frame duration**, the reciprocal:

- `activeVideoMinFrameDuration` = 1 / maximum frame rate.
- `activeVideoMaxFrameDuration` = 1 / minimum frame rate.

"Min duration" limits the **top** speed. This is the usual source of confusion.

### (b) Key APIs

| API | Facts | Source |
|---|---|---|
| `format.videoSupportedFrameRateRanges` | Array of `AVFrameRateRange`. | [H `:3391-3399`] |
| `device.activeVideoMinFrameDuration`, `activeVideoMaxFrameDuration` | Need `lockForConfiguration()`. An unsupported value throws. `CMTime.invalid` restores the default. **Reset to default** when the format changes, the preset changes, or the input is added to a session. | [H `:386-434`] |
| `device.isAutoVideoFrameRateEnabled` (iOS 18) | The device changes the rate with the light level: 30→24 for 30 fps formats, 60→30→24 for 60 fps formats. While `true`, setting the durations throws. Resets to `false` on a format change. Check `format.isAutoVideoFrameRateSupported`. | [H `:457-470`, `:3725-3734`] |
| `input.videoMinFrameDurationOverride` (iOS 13) | Tells the session you will never use more than this rate, so it reserves less hardware. Lowers `hardwareCost`. Resets when the input is added to a session. | [H `AVCaptureInput.h` `videoMinFrameDurationOverride`] |
| `input.activeLockedVideoFrameDuration` (iOS 26) | An exact, locked frame duration. Check `isLockedVideoFrameDurationSupported` and `device.minSupportedLockedVideoFrameDuration`. Not available with auto frame rate or spatial video. | [H `AVCaptureInput.h`] |
| External sync (iOS 26) | `follow(_:videoFrameDuration:delegate:)` for genlock-style sync. | [H] |

Fixed 30 fps (sketch):

```swift
try device.lockForConfiguration()
device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 30)
device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 30)
device.unlockForConfiguration()
```

### (c) What AVCam does

Nothing. It never sets a frame duration. It uses the default range of the format that the preset or the HDR search selected. The only frame-rate code is the `maxFrameRate` helper used to match formats (`CaptureExtensions.swift:37-39`). [S]

### (d) Slow motion (overview)

- High-frame-rate formats (120 or 240 fps on many iPhones) are in `formats`. You reach them by setting `activeFormat` (preset becomes `.inputPriority`), then setting both durations to the high rate. [I: no session preset selects them.]
- The file is a normal movie with many frames per second. "Slow motion" is a playback or edit decision. [I]
- High-rate formats often lack features (some stabilization modes, HDR, high photo resolution). Check each with the format's query methods.
- Hardware cost grows with frame rate. [W WWDC26-303]

### (e) Pitfalls

1. Set the format first, then the durations, in one configuration block. The format change resets durations.
2. A fixed rate removes the ability of auto exposure to slow down in low light. Video gets darker or noisier.
3. In custom exposure mode, a long exposure duration lengthens `activeVideoMaxFrameDuration` by itself. [H `:428-430`]
4. Cinematic stabilization modes want identical or near-identical min and max durations. [H `:3317-3323`]
5. Do not compare frame rates as `Double` with `==` across formats without care; ranges can be 29.97-like values on external cameras. [I]

### (f) Beyond AVCam

- Auto frame rate for low light (iOS 18).
- Low light video noise reduction (iOS 27): `connection.isLowLightVideoNoiseReductionSupported`, `automaticallyEnablesLowLightVideoNoiseReduction` (default `true` for movie file output connections), `isLowLightVideoNoiseReductionEnabled`. Costs power. [H `AVCaptureSession.h:1275-1288`]
- Locked frame duration and external sync (iOS 26) for multi-camera productions.

---

## 6. Video stabilization

### (a) Concept

Stabilization removes camera shake. The system keeps a margin around the visible image and moves a crop window against the motion. Stronger modes also look at future frames, so they hold frames back before they deliver them. So each mode has three costs: **a smaller field of view (crop), delay (latency), and memory**.

You do not turn stabilization on for a device. You ask for it on a **connection** (the link from the camera input to one output).

### (b) Key APIs

`AVCaptureConnection` [H `AVCaptureSession.h:1203-1233`]:

- `isVideoStabilizationSupported` — `true` if the device has at least one format that supports stabilization and the output supports it. It does not say the **active** format supports it.
- `preferredVideoStabilizationMode` — what you ask for. Default `.off`.
- `activeVideoStabilizationMode` — what you got. Read-only, key-value observable, never returns `.auto`. If the preferred mode is not available for the active format, this is `.off`.

`AVCaptureDevice.Format.isVideoStabilizationModeSupported(_:)` — the exact check for one format and one mode. [H `AVCaptureDevice.h:3421-3432`]

**Modes** (`AVCaptureVideoStabilizationMode`) [H `AVCaptureDevice.h:3310-3328`]:

| Swift case | Raw | iOS | Crop | Latency / memory | Notes from the header |
|---|---|---|---|---|---|
| `.off` | 0 | 8 | none | none | Default. |
| `.standard` | 1 | 8 | reduced field of view | may add latency | The original algorithm. |
| `.cinematic` | 2 | 8 | more than standard | "much more" latency, "significantly more" memory | Use narrow or identical min/max frame durations. |
| `.cinematicExtended` | 3 | 13 | — | longer latency and more memory than cinematic | Better stability. Face-aware on a front ultra wide iPhone camera. |
| `.previewOptimized` | 4 | 17 | — | low latency, low power | Only on connections to a preview layer or a preview-sized video data output. |
| `.cinematicExtendedEnhanced` | 5 | 18 | more than cinematic extended | no noticeable extra latency over cinematic extended | Best stability. Also face-aware on the front ultra wide. |
| `.lowLatency` | 6 | **26** | reduced field of view | **no** added latency | Exists in the header: `API_AVAILABLE(ios(26.0)) API_UNAVAILABLE(macos, macCatalyst, tvos, visionos)`. |
| `.auto` | -1 | 8 | — | — | The system picks a mode for the format and frame rate. |

Apple gives no crop percentages. Measure them: compare `activeFormat.videoFieldOfView` or the picture itself with each mode. The docs page for `.lowLatency` also lists Mac Catalyst 26; the header says unavailable there. The header wins.

### (c) Why AVCam uses `.auto`, and why at connection creation

- `.auto` (`MovieCapture.swift:118-120`) lets the system weigh format and frame rate. The app has no table of "which mode for which format". [S][H]
- It is set when the connection is created, not at record start, because of the crop: a change at record start changes the framing at that moment (`MovieCapture.swift:114-117`). [S]
- Extra reasons [I]: a change of stabilization mode reconfigures the pipeline (the header speaks of added latency and memory); doing that at the record tap delays the start of the recording. Inside `updateConfiguration` the change is part of the one commit that added the output.
- The connection is recreated when the output is re-added (mode switch) and when the camera input is replaced (camera switch). Both paths end in `updateCaptureCapabilities()` → `updateConfiguration(for:)` (`CaptureService.swift:292`, `:345`, `:527`).

Alternatives: choose a mode yourself with a fallback chain, for example `.cinematicExtendedEnhanced` → `.cinematic` → `.standard`, each checked with `isVideoStabilizationModeSupported(_:)`; or expose a user setting ("more stable" versus "wider view").

### (d) Pitfalls

1. `isVideoStabilizationSupported == true` and still `activeVideoStabilizationMode == .off`: the active format does not support the mode. Read the active mode after the commit.
2. A format change (for example the HDR toggle) can change the active mode. Observe `activeVideoStabilizationMode` if the UI shows it.
3. Preview and recording can have a different field of view if only the movie connection is stabilized. Check on a device. [I]
4. Camera intrinsic matrix delivery is not supported when stabilization is on. [H `AVCaptureSession.h:1261`]
5. Latency of the cinematic modes delays the frames. With a video data output this delay is visible to you.
6. With ProRes RAW, stabilization only writes metadata; the frames are not stabilized. [H `:1209`]

### (e) Beyond AVCam

- Spatial video **requires** `.cinematic`, `.cinematicExtended`, or `.cinematicExtendedEnhanced` as the active mode. [H `AVCaptureFileOutput.h:572-577`]
- Apple's Cinematic video and spatial video sessions both use `.cinematicExtendedEnhanced`. [W WWDC25-319, WWDC24-10166]
- `.previewOptimized` on the preview connection for a steadier viewfinder.
- **"Action mode"**: there is no API with this name in the iOS 27.1 headers (searched all AVFoundation headers). The public tools are the modes above.

---

## 7. Audio

### (a) Concept

Audio enters the session like video: a microphone `AVCaptureDevice` wrapped in an `AVCaptureDeviceInput`. When a movie file output is added, the session connects the audio port to it and the movie gets an audio track. The audio **hardware route and processing** are not configured on the capture device. On iOS they belong to the app's `AVAudioSession`. Audio devices "do not expose any user-configurable formats on iOS". [H `AVCaptureDevice.h:377`]

By default the capture session manages the audio session for you.

### (b) What the sample does

- Gets the default microphone: `AVCaptureDevice.default(for: .audio)` (`DeviceLookup.swift:47-54`).
- Sets `captureSession.configuresApplicationAudioSessionForBluetoothHighQualityRecording = true` **before** it adds the inputs (`CaptureService.swift:127-128`).
- Adds the microphone input once, in both modes (`CaptureService.swift:132`). In photo mode it supplies sound for Live Photos (`NSMicrophoneUsageDescription`: "To record audio for Live Photos and videos.", `project.pbxproj:634`).
- Never touches `AVAudioSession` directly. No `multichannelAudioMode`. No audio settings on the movie output.
- Treats `audioDeviceInUseByAnotherClient` as an interruption (`CaptureService.swift:557`).

**Result: AVCam records one channel (mono) audio.** The default `multichannelAudioMode` is `.none`, "in which case the default single channel audio recording is used". [H `AVCaptureInput.h` `multichannelAudioMode`]

### (c) Key APIs

**How `AVCaptureSession` manages `AVAudioSession`** [H `AVCaptureSession.h:536-569`]

| Property | iOS | Default | Meaning |
|---|---|---|---|
| `usesApplicationAudioSession` | 7 | `true` | The capture session records through the app's shared `AVAudioSession`. `false` gives the old behavior: a private audio session, which can cause interruptions between the two. |
| `automaticallyConfiguresApplicationAudioSession` | 7 | `true` | The capture session sets the category to play-and-record and chooses a microphone and polar pattern that fit the camera in use. If `false` (and the first property is `true`), you configure the audio session yourself; a wrong setup can make audio recording fail. |
| `configuresApplicationAudioSessionToMixWithOthers` | 18 | `false` | `true`: do not interrupt other audio (for example music); mix with it. No effect when `usesApplicationAudioSession` is `false`. No effect on Live Photo movies, which always mix. |
| `configuresApplicationAudioSessionForBluetoothHighQualityRecording` | **26** | `false` | See below. |

**AirPods high-quality recording — exact name and availability.** [H `AVCaptureSession.h:566-569`]

```objc
@property(nonatomic) BOOL configuresApplicationAudioSessionForBluetoothHighQualityRecording
    API_AVAILABLE(ios(26.0)) API_UNAVAILABLE(macos, macCatalyst, tvos, visionos);
```

- Swift: `captureSession.configuresApplicationAudioSessionForBluetoothHighQualityRecording`.
- `true` opts the session in to high-quality Bluetooth recording, so the user can **select** AirPods as the microphone. It does not force AirPods.
- No effect when `usesApplicationAudioSession` is `false`.
- The documentation page lists "Mac Catalyst 26.0". The header says unavailable on Mac Catalyst. The header wins.
- The matching `AVAudioSession` option is `AVAudioSession.CategoryOptions.bluetoothHighQualityRecording` (iOS 26 only). It works only with mode `.default`. Combined with `.allowBluetoothHFP`, HFP is the fallback. It can add input latency, so it is not for real-time calls. [H `AVAudioSessionTypes.h:614-635`]
- How the user selects the microphone: the system audio input menu, or in your app with `AVInputPickerInteraction` (AVKit, iOS 26). [W WWDC25-251]
- The mode uses a tuning for content creators, "like a lav microphone". [W WWDC25-251]
- Not the same feature: a press on the AirPods stem can start and stop capture through `AVCaptureEventInteraction` (other dossier). [W WWDC25-253]

**Stereo and Spatial Audio: `AVCaptureDeviceInput.multichannelAudioMode`** (iOS 18) [H `AVCaptureInput.h`]

| Case | Result |
|---|---|
| `.none` (default) | Mono. |
| `.stereo` | Stereo. |
| `.firstOrderAmbisonics` | Spatial Audio (FOA, four channels). A movie file also gets a stereo track for compatibility. |

- Check `isMultichannelAudioModeSupported(_:)` first.
- It works only with the built-in microphones. It is ignored when an external microphone is in use.
- Set it on the **microphone's** `AVCaptureDeviceInput`.
- A Spatial Audio movie holds a stereo AAC track, a spatial track (APAC codec; PCM during ProRes recording), and a metadata track. [W WWDC25-251]

**Wind noise removal** (iOS 18): `isWindNoiseRemovalSupported`, `isWindNoiseRemovalEnabled`. Available only when `multichannelAudioMode` is not `.none`. [H]

**Audio zoom** (iOS 26.4): `isAudioZoomSupported`, `isAudioZoomEnabled` (default `true` when supported). The sound field narrows with the video zoom. Needs a multichannel mode and a video device in the session. [H]

**Microphone modes** (iOS 15): `AVCaptureDevice.preferredMicrophoneMode` and `activeMicrophoneMode` (`.standard`, `.wideSpectrum`, `.voiceIsolation`). Both are read-only class properties: the **user** chooses in Control Center. `AVCaptureDevice.showSystemUserInterface(.microphoneModes)` opens that UI. [H `AVCaptureDevice.h:2720-2795`]

**"Cinematic audio".** There is **no capture API with this name** in the headers. "Cinematic" is one style of the **Audio Mix** effect, applied at playback or edit time to recordings that have Spatial Audio. The API is in the Cinematic framework (iOS 26): `CNAssetSpatialAudioInfo`, `CNSpatialAudioRenderingStyle` (`.cinematic`, `.studio`, `.inFrame`, `.standard`, and stem styles). [H `Cinematic.framework/Headers/CNSpatialAudio.h:14-37`], [W WWDC25-251] To make it possible, record with `.firstOrderAmbisonics`. Cinematic **video** can be recorded with Spatial Audio too. [W WWDC25-251, WWDC25-319]

**Spatial Audio with your own writer** (iOS 26): two `AVCaptureAudioDataOutput` objects, one with `spatialAudioChannelLayoutTag = kAudioChannelLayoutTag_Stereo` and one with `kAudioChannelLayoutTag_HOA_ACN_SN3D | 4`, plus `AVCaptureSpatialAudioMetadataSampleGenerator` for the metadata sample. [H `AVCaptureAudioDataOutput.h`, `AVCaptureSpatialAudioMetadataSampleGenerator.h`]

**Levels:** `connection.audioChannels` → `AVCaptureAudioChannel.averagePowerLevel`, `peakHoldLevel` for a level meter. [H `AVCaptureSession.h:1305-1332`]

### (d) Why AVCam does it this way

- The defaults are good: the capture session picks the microphone that fits the camera and configures the audio session. The sample needs no audio session code.
- One line gives AirPods as a microphone choice (`CaptureService.swift:128`). This came with the WWDC25 update (commit `c93a0f0`, "AirPods additions for WWDC25").
- The property is set before the inputs are added and before `startRunning()`, so the session configures the audio session once.

### (e) Pitfalls

1. **Microphone permission is implicit.** `isAuthorized` checks only `.video` (`CaptureService.swift:84-96`). The microphone prompt appears when `AVCaptureDeviceInput(device:)` is created for the microphone; the header documents this implicit prompt. [H `AVCaptureInput.h` `initWithDevice:error:`] If the user denies the microphone, creating the input is expected to fail, `setUpSession` throws `CameraError.setupFailed` (`:165-167`), and the camera does not start. The sample has no "video without sound" fallback. [I: verify the denied case on a device.]
2. **Recording stops other audio.** With the defaults, starting the session interrupts music. Use `configuresApplicationAudioSessionToMixWithOthers` if you want mixing.
3. **Your own `AVAudioSession` code can fight the capture session.** If you must control the audio session, set `automaticallyConfiguresApplicationAudioSession = false` and then set it up completely.
4. **Mono by default.** Users expect stereo from a modern iPhone. Add `multichannelAudioMode` if you want it.
5. **Multichannel modes are ignored with an external microphone**, which includes AirPods.
6. **Wind noise removal without a multichannel mode has no effect.**
7. **Incoming calls.** With Bluetooth high-quality recording, consider `AVAudioSession.setPrefersNoInterruptionsFromSystemAlerts(_:)` so a ringtone does not interrupt. [H `AVAudioSessionTypes.h:632-634`]
8. **Silent video.** To record without sound, remove the microphone input or set `movieOutput.connection(with: .audio)?.isEnabled = false`.

### (f) Links

usesApplicationAudioSession, automaticallyConfiguresApplicationAudioSession, configuresApplicationAudioSessionToMixWithOthers, configuresApplicationAudioSessionForBluetoothHighQualityRecording, AVAudioSession bluetoothHighQualityRecording, AVInputPickerInteraction, multichannelAudioMode, AVCaptureMultichannelAudioMode, wind noise, audio zoom, microphone modes, "Capturing Spatial Audio in your iOS app", Cinematic framework, TN3177, WWDC25-251.

---

## 8. Saving movies to Photos, temporary files, cleanup

### (a) Concept

The movie file output writes to a URL that the app owns. The Photos library is a separate database. To put the movie there you create an asset inside a `performChanges` block. You can copy the file or let Photos **move** it.

### (b) What the sample does

- **URL.** `URL.movieFileURL` (`FoundationExtensions.swift:10-15`): `URL.temporaryDirectory` + a UUID + the `.mov` extension (`.quickTimeMovie`). A computed property, so each access gives a new URL. The same helper makes the Live Photo movie URL (`PhotoCapture.swift:75`).
- **Hand-off.** The delegate wraps the URL in `Movie(url:)` (`MovieCapture.swift:74`, `DataTypes.swift:91-94`). `CameraModel.toggleRecording()` passes it to `mediaLibrary.save(movie:)` (`CameraModel.swift:183-184`).
- **Save.** `MediaLibrary.save(movie:)` (`MediaLibrary.swift:76-86`):

  ```swift
  let options = PHAssetResourceCreationOptions()
  options.shouldMoveFile = true
  let creationRequest = PHAssetCreationRequest.forAsset()
  creationRequest.addResource(with: .video, fileURL: movie.url, options: options)
  creationRequest.location = location
  ```

- **Authorization.** `performChange` asks for `.addOnly` access (`MediaLibrary.swift:34-48`, `:90-92`).
- **Thumbnail.** After the change, it fetches the new asset by the placeholder's identifier and makes a 256×256 thumbnail (`:101-106`, `:114-124`).
- **Location.** `currentLocation` waits for the first `CLLocationUpdate` (`:130-138`).

### (c) Key APIs

| API | Facts |
|---|---|
| `PHAssetCreationRequest.forAsset()` | Builds a new asset from one or more resources. Must be called inside a change block. |
| `addResource(with: .video, fileURL:options:)` | `.video` = the main video of a video asset. (`.pairedVideo` is the movie part of a Live Photo, `MediaLibrary.swift:68`.) |
| `PHAssetResourceCreationOptions.shouldMoveFile` | `true`: the file is moved into the library without duplicating the data, and the original is removed **if the asset is created successfully**. Default `false` (copy). **A move fails if the file is open or hard-linked.** [H `PHAssetCreationRequest.h:26-27`] |
| `PHAssetResourceCreationOptions.originalFilename`, `contentType` (iOS 26) | Optional name and type. |
| `creationRequest.location`, `creationDate` | Metadata on the asset (not inside the file). |
| `PHPhotoLibrary.shared().performChanges` | Runs the change block; async form used at `MediaLibrary.swift:96`. |
| `PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL:)` | Simpler alternative. It copies. |

### (d) Why move, not copy

A movie can be very large. A copy needs twice the space for a moment and takes time. A move inside one volume is close to free. It also removes the temporary file for you. [H][I]

### (e) Pitfalls and cleanup

1. **Failed saves leave files in `tmp`.** If the user denies Photos access (`Error.unauthorized`) or the change fails (`Error.saveFailed`), nobody deletes the movie. The same is true for a recording that ended early (section 1, pitfall 2). The system can purge `tmp`, but not at a known time. Add: delete in the `catch` path, and sweep old `.mov` files in `tmp` at launch. [S][I]
2. **Wait for the delegate.** Save only after `didFinishRecordingTo`. Before that the file is still open, and a move of an open file fails. The sample's `await stopRecording()` guarantees the order. [H][S]
3. **Location delays the save.** `save(movie:)` first awaits a location (`MediaLibrary.swift:77`). If no location update arrives soon, the save waits. Consider reading the location at record start or with a timeout. [S][I]
4. **Thumbnail with add-only access.** [I] The thumbnail code fetches the asset back (`MediaLibrary.swift:103`). With add-only authorization the app has no read access, so this fetch can come back empty and no thumbnail appears. Test on a device with add-only access.
5. **Usage strings.** `NSPhotoLibraryUsageDescription` is present only on some targets (`project.pbxproj:929`, `:976`). Check that the right key for add-only access (`NSPhotoLibraryAddUsageDescription`) is set where needed. [I]
6. **Errors lose detail.** `performChange` maps every error to `Error.saveFailed` (`MediaLibrary.swift:107-109`).

### (f) Beyond AVCam

- Write to the app's own container (Documents) and offer export later.
- Record directly to external storage: `AVExternalStorageDeviceDiscoverySession.shared`, `AVExternalStorageDevice.nextAvailableURLs(withPathExtensions:)` (iOS 17). In iOS 27, `reasonsNotRecommendedForCaptureUse` tells why a drive is a poor choice (encrypted, unsupported file system, slow or unknown write speed). [H `AVExternalStorageDevice.h`]
- Set `minFreeDiskSpaceLimit` so a recording ends cleanly before the disk is full.

---

## 9. The recording timer

### (a) What the sample does

`MovieCapture.swift:25-27`, `:79-98`:

```swift
timerCancellable = Timer.publish(every: refreshInterval, on: .main, in: .common)   // 0.25 s
    .autoconnect()
    .sink { [weak self] _ in
        guard let self else { return }
        let duration = movieOutput.recordedDuration.seconds
        captureActivity = .movieCapture(duration: duration)
    }
```

The value then travels:

1. `MovieCapture.$captureActivity` (a `@Published`, `MovieCapture.swift:15`)
2. merged with the photo activity and assigned to the actor's `@Published captureActivity` (`CaptureService.swift:539-542`)
3. read as an async sequence by `CameraModel` (`CameraModel.swift:205-216`)
4. shown by `RecordingTimeView(time: camera.captureActivity.currentTime)` (`CameraUI.swift:46`; `DataTypes.swift:50-55`)
5. formatted as `HH:MM:SS`, seconds cut to an `Int` (`RecordingTimeView.swift:29-37`).

`stopMonitoringDuration()` cancels the timer and sets `.idle` (`MovieCapture.swift:95-98`).

### (b) Why this way

- The output is the single source of truth. `recordedDuration` is the real duration of the file, and it does not advance while writing has not started (or while paused).
- The header does not say `recordedDuration` is key-value observable, so polling is the safe way. [H]
- Four updates each second make the seconds digit change close to the right moment.
- `.common` run-loop mode keeps the timer firing while the user scrolls or touches controls.
- The same `captureActivity` value also carries "is recording" for the button and the mode picker (`CaptureButton.swift:24`, `CaptureModeView.swift:30`).

### (c) Pitfalls

1. **Threads.** [I] The timer fires on the main run loop. There it reads the output and writes `captureActivity`. All other access to `MovieCapture` happens on the actor's session queue (`CaptureService.swift:68-73`). The `.assign(to: &$captureActivity)` in the actor is also driven from the main thread. This works in Swift 5 mode with `@preconcurrency import AVFoundation`, but it is not strict-concurrency clean. A tutorial for Swift 6 needs a different design.
2. **Optimistic start.** The UI shows 00:00:00 and "recording" before the output writes (section 1, pitfall 4).
3. **Early finish.** If the recording ends on its own, the timer continues to publish `.movieCapture` (section 1, pitfall 2).
4. **Wasted work.** Four cross-actor updates per second for a label that changes once per second.
5. **A second start** replaces `timerCancellable`; the old subscription is cancelled when it is released. Fine, but `guard !movieOutput.isRecording` (`MovieCapture.swift:38`) is the real protection.

### (d) Alternatives

| Approach | How | Trade-off |
|---|---|---|
| Start date + SwiftUI timer text | Store the date in `fileOutput(_:didStartRecordingTo:from:)`. Show `Text(startDate, style: .timer)` or `Text(timerInterval:pauseTime:countsDown:showsHours:)`. | No polling and no cross-actor traffic. Wall-clock time, not file time; needs extra care for pause. |
| `TimelineView(.periodic(from:by:))` | The view asks the model for the duration on a schedule. | Polling moves into the view layer. |
| Async loop on the actor | `while movieOutput.isRecording { publish(recordedDuration); try await Task.sleep(for: .milliseconds(250)) }` | Stays on the session queue. Concurrency-clean. |
| Exact start time | `fileOutput(_:didStartRecordingTo:startPTS:from:)` (iOS 18.2) with `session.synchronizationClock` | Frame-accurate elapsed time; more code. |
| Video data output | Count from sample buffer timestamps. | Only if you already use data outputs. |

---

## 10. Capability map: other video features

Each row: what it is, the entry-point API, minimum iOS from the header, and where to read more.

| Capability | Entry point | iOS | Notes | Read more |
|---|---|---|---|---|
| **Pause / resume** | `AVCaptureFileOutput.pauseRecording()`, `resumeRecording()`, `isRecordingPaused`; delegate `didPauseRecordingTo`, `didResumeRecordingTo` | **18.0** | On macOS since 10.7; on iOS since 18. No newer pause API was found in the 26/27 headers. A format or device change stops the recording. | AVCaptureFileOutput docs |
| **Cinematic video capture** | `AVCaptureDeviceInput.isCinematicVideoCaptureSupported` / `isCinematicVideoCaptureEnabled`, `simulatedAperture`; `AVCaptureDevice.setCinematicVideoTrackingFocus(detectedObjectID:focusMode:)`, `setCinematicVideoTrackingFocus(at:focusMode:)`, `setCinematicVideoFixedFocus(at:focusMode:)`; `Format.isCinematicVideoCaptureSupported`, `videoFrameRateRangeForCinematicVideo` | 26.0 | Forces continuous autofocus. Not together with `AVCaptureDepthDataOutput`. Lengthy reconfiguration: enable before `startRunning()` or inside a configuration block. Limited zoom range. | "Capturing Cinematic video" sample, WWDC25-319 |
| **Cinematic video metadata** | `AVCaptureMovieFileOutput.isCinematicVideoMetadataCaptureSupported`, `automaticallyAdjustsCinematicVideoMetadataCaptureEnabled` (default `true`), `isCinematicVideoMetadataCaptureEnabled`; `Format.isCinematicVideoMetadataCaptureSupported` | 27.0 | Stores data for later editing with the Cinematic framework. Needs 16:9 or 9:16; not with spatial video. | AVCaptureMovieFileOutput docs |
| **Spatial video** | `Format.isSpatialVideoCaptureSupported`; `AVCaptureMovieFileOutput.isSpatialVideoCaptureSupported` / `isSpatialVideoCaptureEnabled`; `AVCaptureDevice.spatialCaptureDiscomfortReasons` | 18.0 | Needs an active cinematic-family stabilization mode. Overwrites the zoom factor range. Setting frame durations throws while enabled. | WWDC24-10166 |
| **Action mode** | — | — | **No API with this name in the iOS 27.1 headers.** Use stabilization modes (section 6). | — |
| **ProRes** | `AVVideoCodecType.proRes422…` in `availableVideoCodecTypes`; `setOutputSettings` | codec constants 11+; device dependent | Very high data rates. | "Recording movies in alternative formats" |
| **ProRes RAW** | `.proResRAW`, `.proResRAWHQ` | 26.0 | Stabilization and distortion correction as metadata only. | Header notes; support.apple.com/en-us/118584 |
| **Apple Log / Apple Log 2** | `activeColorSpace = .appleLog` / `.appleLog2` | 17.0 / 26.0 | Photo output connections become inactive. | AVCaptureColorSpace docs |
| **External storage** | `AVExternalStorageDeviceDiscoverySession.shared`, `AVExternalStorageDevice` (`freeSize`, `isConnected`, `nextAvailableURLs(withPathExtensions:)`, `requestAccess`) | 17.0 | Record straight to a USB-C drive. Fragment interval ≥ 10 s is recommended. iOS 27 adds `reasonsNotRecommendedForCaptureUse`. | AVExternalStorageDevice docs |
| **Pro Video Storage** | `AVProVideoStorage.shared`, `isSupported`, `remainingCapacity`, `busyReasons`, `replenishCapacity(completionHandler:)`, `openSettings()`; `AVCaptureMovieFileOutput.isProVideoStorageSupported`, `usesProVideoStorage` | 27.0 | Pre-allocated, system-wide space for steady high-rate writes. The recording goes to the pre-allocated storage and is moved to your URL when it finishes. Starting a capture while `busyReasons` is not empty fails. | WWDC26-303 |
| **Deferred start** | `AVCaptureOutput.isDeferredStartSupported` / `isDeferredStartEnabled`; `AVCaptureSession.automaticallyRunsDeferredStart`, `runDeferredStartWhenNeeded()`, deferred start delegate | 26.0 | Default `true` for photo and file outputs when linked with the iOS 26 SDK. Used at `CaptureService.swift:140-148`. | "Building a responsive camera app that launches quickly", WWDC26-303 |
| **Auto frame rate** | `isAutoVideoFrameRateEnabled` | 18.0 | Section 5. | AVCaptureDevice docs |
| **Low light video noise reduction** | `AVCaptureConnection.isLowLightVideoNoiseReductionEnabled` and friends | 27.0 | Automatic by default on movie file output connections. | AVCaptureConnection docs |
| **Locked frame rate, external sync** | `activeLockedVideoFrameDuration`, `follow(_:videoFrameDuration:delegate:)` | 26.0 | Multi-camera productions. | AVCaptureDeviceInput docs |
| **Timecode** | `AVCaptureTimecodeGenerator` | 26.0 | SMPTE timecode for sync in post-production. | Capture setup collection |
| **Dynamic aspect ratio** | `setDynamicAspectRatio(_:completionHandler:)`, `Format.supportedDynamicAspectRatios` | 26.0 | Change aspect ratio without a format change. | AVCaptureDevice docs |
| **Multi-camera recording** | `AVCaptureMultiCamSession` | 13.0 | Several cameras at once; check `hardwareCost` and `systemPressureCost`. | AVMultiCamPiP sample, WWDC19-249 |
| **Movie + frames together** | Movie file output + video data output in one session | not stated; `hardwareCost` (iOS 16) names this combination | Record and analyze at once. Check `hardwareCost`. | AVCaptureSession.hardwareCost |
| **Movie + audio buffers together** | Movie file output + audio data output | 26.0 | Record and draw a waveform. | WWDC25-251 |
| **App-supplied timed metadata** | `AVCaptureMetadataInput` | 9.0 | Connects only to a movie file output. | AVCaptureMetadataInput docs |
| **Spatial Audio, wind noise, audio zoom** | Section 7 | 18.0 / 18.0 / 26.4 | | WWDC25-251 |

---

## Could not verify (summary)

1. Whether `device.activeFormat` already shows the new preset's format **before** `commitConfiguration()` (section 3, pitfall 1). The sample depends on it.
2. Whether HDR stays active after a camera switch (section 4, limit 7).
3. The resolution and frame rate of `.high` on each device.
4. Crop percentages and latency numbers of each stabilization mode. Apple publishes none.
5. Whether preview framing changes when only the movie connection is stabilized.
6. The exact behavior when the microphone permission is denied.
7. Whether the thumbnail fetch works with add-only Photos access.
8. The Dolby Vision profile number. Not in headers or the checked documentation.
9. WWDC17 session 503 and 511, and WWDC18 session 501: the URLs return HTTP 200 but show a generic page, not the session. Not listed.
10. Documentation and header disagree on Mac Catalyst availability for `configuresApplicationAudioSessionForBluetoothHighQualityRecording` and `.lowLatency`. I followed the header (iOS only).

All items marked [I] are inferences from code and headers. I had no device to run the app.

---

## Glossary

| Term | Meaning |
|---|---|
| Active format | The `AVCaptureDevice.Format` the camera uses now. |
| Ambisonics (FOA) | First-order Ambisonics: a four-channel description of a 3D sound field. The storage form of Spatial Audio. |
| Apple Log | A log transfer curve from Apple for footage that is color graded later. |
| Audio Mix | A playback effect (Cinematic framework) that changes the balance of voice and background in Spatial Audio recordings. Styles include "cinematic". |
| Binning | Combining sensor pixels. More light sensitivity, less resolution. |
| BT.2020 | A wide color gamut used for HDR video. |
| Checked continuation | A Swift object that lets callback code resume an `await`. Must be resumed exactly once. |
| Codec | The compression method for video (HEVC, H.264, ProRes). |
| Connection | `AVCaptureConnection`: the link from input ports to one output. Rotation, mirroring, and stabilization are set here. |
| Deferred start | iOS 26 feature: the session starts the preview first and prepares other outputs a moment later. |
| Display matrix | The transform in a movie track that tells players how to rotate the picture. |
| Dolby Vision | An HDR format with dynamic metadata. iPhone 10-bit HLG movies contain this metadata. |
| EDR | Extended Dynamic Range: the older "video HDR" that merges two exposures per frame. API: `isVideoHDREnabled`. |
| Frame duration | Seconds per frame. The reciprocal of frame rate. |
| HEVC | H.265. The default movie codec on most iPhones. |
| HLG | Hybrid Log-Gamma: an HDR transfer function. |
| Input priority | The preset value that means "the app chose `activeFormat`; the session must not change it". |
| Movie fragment | A piece of index data written at intervals so an unfinished movie file can still be played. |
| Preset | A named quality level for the session. The session picks the format. |
| ProRes | Apple's family of editing codecs with high data rates. |
| Recording delegate | The object that receives start, pause, resume, and finish callbacks for one recording. |
| Session queue | The serial queue on which the sample makes all capture calls. The `CaptureService` actor uses it as its executor. |
| Spatial video | Stereoscopic video from two cameras, for Apple Vision Pro. |
| Stabilization crop | The part of the picture given up so the visible window can move against shake. |
| `x420` | FourCC of the 10-bit 4:2:0 video-range pixel format. The marker of a 10-bit HDR capture format. |

---

## Verified links

Every URL below returned HTTP 200 on 2026-10-01. For documentation pages, both the page and its JSON (`https://developer.apple.com/tutorials/data/documentation/….json`) returned 200. For WWDC pages, the page title matched the session.

### Movie file output

| Title | URL | Description |
|---|---|---|
| AVCaptureMovieFileOutput | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput | The class that records QuickTime movies. |
| AVCaptureFileOutput | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput | Superclass with start, stop, pause, and limits. |
| AVCaptureFileOutputRecordingDelegate | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate | Callbacks for one recording. |
| startRecording(to:recordingDelegate:) | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/startrecording(to:recordingdelegate:) | Start; rules for existing files and iOS. |
| stopRecording() | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/stoprecording() | Stop; file is ready only after the delegate call. |
| pauseRecording() | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/pauserecording() | Pause (iOS 18). |
| resumeRecording() | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/resumerecording() | Resume (iOS 18). |
| isRecordingPaused | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/isrecordingpaused | Pause state. |
| recordedDuration | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/recordedduration | Duration of the current file. |
| maxRecordedDuration | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/maxrecordedduration | Duration limit. |
| maxRecordedFileSize | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/maxrecordedfilesize | Size limit. |
| minFreeDiskSpaceLimit | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/minfreediskspacelimit | Free-space limit. |
| fileOutput(_:didFinishRecordingTo:from:error:) | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didfinishrecordingto:from:error:) | The required finish callback. |
| fileOutput(_:didStartRecordingTo:from:) | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didstartrecordingto:from:) | Start callback. |
| fileOutput(_:didStartRecordingTo:startPTS:from:) | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didstartrecordingto:startpts:from:) | Start callback with first timestamp (iOS 18.2). |
| movieFragmentInterval | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/moviefragmentinterval | Fragment interval and why fragments exist. |
| metadata | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/metadata | Top-level metadata for the file. |
| availableVideoCodecTypes | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/availablevideocodectypes | Codecs this output can record. |
| setOutputSettings(_:for:) | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/setoutputsettings(_:for:) | Per-connection encoder settings. |
| supportedOutputSettingsKeys(for:) | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/supportedoutputsettingskeys(for:) | Legal keys on iOS. |
| setRecordsVideoOrientationAndMirroringChangesAsMetadataTrack(_:for:) | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/setrecordsvideoorientationandmirroringchangesasmetadatatrack(_:for:) | Orientation metadata track. |
| isPrimaryConstituentDeviceSwitchingBehaviorForRecordingEnabled | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/isprimaryconstituentdeviceswitchingbehaviorforrecordingenabled | Lens switching while recording. |
| Recording movies in alternative formats | https://developer.apple.com/documentation/avfoundation/recording-movies-in-alternative-formats | Article: HEVC default, how to choose H.264. |
| Exporting video to alternative formats | https://developer.apple.com/documentation/avfoundation/exporting-video-to-alternative-formats | Article: convert after capture. |
| AVVideoCodecType | https://developer.apple.com/documentation/avfoundation/avvideocodectype | All codec constants. |
| AVVideoCodecType.hevc | https://developer.apple.com/documentation/avfoundation/avvideocodectype/hevc | HEVC constant. |
| AVVideoCodecType.h264 | https://developer.apple.com/documentation/avfoundation/avvideocodectype/h264 | H.264 constant. |
| AVVideoCodecType.proRes422 | https://developer.apple.com/documentation/avfoundation/avvideocodectype/prores422 | ProRes 422 constant. |
| AVVideoCodecType.proResRAW | https://developer.apple.com/documentation/avfoundation/avvideocodectype/proresraw | ProRes RAW constant (iOS 26). |
| AVVideoCodecKey | https://developer.apple.com/documentation/avfoundation/avvideocodeckey | Settings key for the codec. |
| AVVideoCompressionPropertiesKey | https://developer.apple.com/documentation/avfoundation/avvideocompressionpropertieskey | Settings key for encoder properties. |
| AVErrorRecordingSuccessfullyFinishedKey | https://developer.apple.com/documentation/avfoundation/averrorrecordingsuccessfullyfinishedkey | "Is the file playable" flag in the error. |
| AVError.Code.maximumDurationReached | https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/maximumdurationreached | Error when a duration limit stops recording. |
| AVMetadataItem | https://developer.apple.com/documentation/avfoundation/avmetadataitem | Metadata item type. |
| quickTimeMetadataLocationISO6709 | https://developer.apple.com/documentation/avfoundation/avmetadataidentifier/quicktimemetadatalocationiso6709 | Identifier for location metadata in a movie. |
| AVCaptureMetadataInput | https://developer.apple.com/documentation/avfoundation/avcapturemetadatainput | App-supplied timed metadata into a movie. |

### Data outputs and asset writer

| Title | URL | Description |
|---|---|---|
| Audio and video capture | https://developer.apple.com/documentation/avfoundation/audio-and-video-capture | Collection page: file capture and stream capture. |
| AVCaptureVideoDataOutput | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput | Per-frame video access. |
| AVCaptureAudioDataOutput | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput | Per-buffer audio access. |
| alwaysDiscardsLateVideoFrames | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/alwaysdiscardslatevideoframes | Frame dropping policy. |
| recommendedVideoSettingsForAssetWriter(writingTo:) | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/recommendedvideosettingsforassetwriter(writingto:) | Writer settings like the movie output's. |
| recommendedVideoSettings(forVideoCodecType:assetWriterOutputFileType:) | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/recommendedvideosettings(forvideocodectype:assetwriteroutputfiletype:) | Same, for a chosen codec. |
| availableVideoCodecTypesForAssetWriter(writingTo:) | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/availablevideocodectypesforassetwriter(writingto:) | Codecs for the writer route. |
| recommendedAudioSettingsForAssetWriter(writingTo:) | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput/recommendedaudiosettingsforassetwriter(writingto:) | Audio writer settings. |
| preservesDynamicHDRMetadata | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/preservesdynamichdrmetadata | HDR metadata for the writer route (iOS 26). |
| AVAssetWriter | https://developer.apple.com/documentation/avfoundation/avassetwriter | Writes media files from sample buffers. |
| AVAssetWriterInput | https://developer.apple.com/documentation/avfoundation/avassetwriterinput | One track of an asset writer. |
| hardwareCost | https://developer.apple.com/documentation/avfoundation/avcapturesession/hardwarecost | Cost of the session configuration. |

### Session, presets, mode switch

| Title | URL | Description |
|---|---|---|
| AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The sample's documentation page. |
| Capture setup | https://developer.apple.com/documentation/avfoundation/capture-setup | Collection page for capture. |
| Setting up a capture session | https://developer.apple.com/documentation/avfoundation/setting-up-a-capture-session | Article on session basics. |
| Building a responsive camera app that launches quickly | https://developer.apple.com/documentation/avfoundation/building-a-responsive-camera-app-that-launches-quickly | Article on deferred start. |
| AVCaptureSession | https://developer.apple.com/documentation/avfoundation/avcapturesession | The session class. |
| sessionPreset | https://developer.apple.com/documentation/avfoundation/avcapturesession/sessionpreset | Current preset. |
| AVCaptureSession.Preset | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset | All presets. |
| Preset.photo | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/photo | Photo preset. |
| Preset.high | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/high | High preset (default). |
| Preset.inputPriority | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/inputpriority | Preset after you set `activeFormat`. |
| Preset.hd4K3840x2160 | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/hd4k3840x2160 | 4K preset. |
| beginConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration() | Start of an atomic change. |
| commitConfiguration() | https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration() | End of an atomic change. |
| removeOutput(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/removeoutput(_:) | Remove an output. |
| isLivePhotoCaptureSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocapturesupported | False when a movie output is attached. |
| isDeferredStartEnabled | https://developer.apple.com/documentation/avfoundation/avcaptureoutput/isdeferredstartenabled | Per-output deferred start. |
| automaticallyRunsDeferredStart | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyrunsdeferredstart | Automatic deferred start. |
| runDeferredStartWhenNeeded() | https://developer.apple.com/documentation/avfoundation/avcapturesession/rundeferredstartwhenneeded() | Manual deferred start. |
| AVCaptureSession.InterruptionReason | https://developer.apple.com/documentation/avfoundation/avcapturesession/interruptionreason | Why a session was interrupted. |

### Formats, HDR, color, frame rate

| Title | URL | Description |
|---|---|---|
| Formats | https://developer.apple.com/documentation/avfoundation/capture-device-formats | Collection: formats and frame durations. |
| Color | https://developer.apple.com/documentation/avfoundation/capture-device-color | Collection: HDR and color space. |
| AVCaptureDevice.Format | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format | The format class. |
| formats | https://developer.apple.com/documentation/avfoundation/avcapturedevice/formats | All formats of a device. |
| activeFormat | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat | The current format; rules for setting it. |
| formatDescription | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/formatdescription | Size and pixel format of a format. |
| CMFormatDescription | https://developer.apple.com/documentation/coremedia/cmformatdescription | Core Media format description. |
| kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange | https://developer.apple.com/documentation/corevideo/kcvpixelformattype_420ypcbcr10biplanarvideorange | The `x420` 10-bit pixel format. |
| isVideoHDRSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideohdrsupported | EDR support of a format. |
| isVideoHDREnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvideohdrenabled | EDR on/off. |
| automaticallyAdjustsVideoHDREnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/automaticallyadjustsvideohdrenabled | Automatic EDR. |
| supportedColorSpaces | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/supportedcolorspaces | Color spaces of a format. |
| activeColorSpace | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activecolorspace | Current color space. |
| AVCaptureColorSpace | https://developer.apple.com/documentation/avfoundation/avcapturecolorspace | Color space enum. |
| AVCaptureColorSpace.HLG_BT2020 | https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/hlg_bt2020 | HDR video color space. |
| AVCaptureColorSpace.appleLog | https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/applelog | Apple Log. |
| AVCaptureColorSpace.appleLog2 | https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/applelog2 | Apple Log 2 (iOS 26). |
| automaticallyConfiguresCaptureDeviceForWideColor | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfigurescapturedeviceforwidecolor | Session's automatic color handling. |
| isGlobalToneMappingEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isglobaltonemappingenabled | Global tone mapping. |
| isVideoBinned | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideobinned | Binned format flag. |
| unsupportedCaptureOutputClasses | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/unsupportedcaptureoutputclasses | Outputs a format cannot feed. |
| isHighestPhotoQualitySupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/ishighestphotoqualitysupported | Photo-grade format flag. |
| videoSupportedFrameRateRanges | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videosupportedframerateranges | Frame-rate ranges of a format. |
| AVFrameRateRange | https://developer.apple.com/documentation/avfoundation/avframeraterange | Range type. |
| activeVideoMinFrameDuration | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideominframeduration | Maximum frame rate as a duration. |
| activeVideoMaxFrameDuration | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideomaxframeduration | Minimum frame rate as a duration. |
| isAutoVideoFrameRateEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isautovideoframerateenabled | Auto frame rate (iOS 18). |
| isAutoVideoFrameRateSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isautovideoframeratesupported | Format support for auto frame rate. |
| videoMinFrameDurationOverride | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/videominframedurationoverride | Declare a lower top rate. |
| activeLockedVideoFrameDuration | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/activelockedvideoframeduration | Locked frame rate (iOS 26). |
| isLowLightVideoNoiseReductionEnabled | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/islowlightvideonoisereductionenabled | Low light noise reduction (iOS 27). |

### Stabilization

| Title | URL | Description |
|---|---|---|
| AVCaptureConnection | https://developer.apple.com/documentation/avfoundation/avcaptureconnection | Connection class. |
| preferredVideoStabilizationMode | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/preferredvideostabilizationmode | The mode you ask for. |
| activeVideoStabilizationMode | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/activevideostabilizationmode | The mode in use. |
| isVideoStabilizationSupported | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideostabilizationsupported | Connection-level support. |
| AVCaptureVideoStabilizationMode | https://developer.apple.com/documentation/avfoundation/avcapturevideostabilizationmode | All modes. |
| .previewOptimized | https://developer.apple.com/documentation/avfoundation/avcapturevideostabilizationmode/previewoptimized | Preview mode (iOS 17). |
| .cinematicExtendedEnhanced | https://developer.apple.com/documentation/avfoundation/avcapturevideostabilizationmode/cinematicextendedenhanced | Strongest mode (iOS 18). |
| .lowLatency | https://developer.apple.com/documentation/avfoundation/avcapturevideostabilizationmode/lowlatency | No-latency mode (iOS 26). |
| isVideoStabilizationModeSupported(_:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideostabilizationmodesupported(_:) | Per-format, per-mode check. |
| videoRotationAngle | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle | Rotation on the connection. |

### Audio

| Title | URL | Description |
|---|---|---|
| usesApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/usesapplicationaudiosession | Share the app's audio session. |
| automaticallyConfiguresApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfiguresapplicationaudiosession | Let the capture session configure audio. |
| configuresApplicationAudioSessionToMixWithOthers | https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessiontomixwithothers | Mix with other audio (iOS 18). |
| configuresApplicationAudioSessionForBluetoothHighQualityRecording | https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessionforbluetoothhighqualityrecording | AirPods high-quality recording (iOS 26). |
| AVAudioSession | https://developer.apple.com/documentation/avfaudio/avaudiosession | The app's audio session. |
| CategoryOptions.bluetoothHighQualityRecording | https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/bluetoothhighqualityrecording | The audio-session form of the option. |
| AVInputPickerInteraction | https://developer.apple.com/documentation/avkit/avinputpickerinteraction | In-app audio input picker (iOS 26). |
| AVCaptureDeviceInput | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput | Input class; audio properties. |
| AVCaptureDevice.default(for:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/default(for:) | Default device for a media type. |
| multichannelAudioMode | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/multichannelaudiomode | Mono, stereo, or Spatial Audio. |
| isMultichannelAudioModeSupported(_:) | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/ismultichannelaudiomodesupported(_:) | Support check. |
| AVCaptureMultichannelAudioMode | https://developer.apple.com/documentation/avfoundation/avcapturemultichannelaudiomode | Mode enum. |
| isWindNoiseRemovalSupported | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/iswindnoiseremovalsupported | Wind noise support. |
| isWindNoiseRemovalEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/iswindnoiseremovalenabled | Wind noise on/off. |
| isAudioZoomEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/isaudiozoomenabled | Audio zoom (iOS 26.4). |
| System video effects and microphone modes | https://developer.apple.com/documentation/avfoundation/system-video-effects-and-microphone-modes | Collection: microphone modes. |
| AVCaptureDevice.MicrophoneMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/microphonemode | Mode enum. |
| activeMicrophoneMode | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activemicrophonemode | Mode in use. |
| showSystemUserInterface(_:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/showsystemuserinterface(_:) | Open the system UI for modes. |
| AVCaptureAudioChannel | https://developer.apple.com/documentation/avfoundation/avcaptureaudiochannel | Audio levels on a connection. |
| isEnabled (connection) | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isenabled | Turn a connection off. |
| spatialAudioChannelLayoutTag | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput/spatialaudiochannellayouttag | Layout for Spatial Audio buffers (iOS 26). |
| AVCaptureSpatialAudioMetadataSampleGenerator | https://developer.apple.com/documentation/avfoundation/avcapturespatialaudiometadatasamplegenerator | Metadata for writer-based Spatial Audio. |
| Capturing Spatial Audio in your iOS app | https://developer.apple.com/documentation/avfoundation/capturing-spatial-audio-in-your-ios-app | Sample code (WWDC25-251). |
| Cinematic | https://developer.apple.com/documentation/cinematic | Framework for Cinematic video and Audio Mix. |
| CNAssetSpatialAudioInfo | https://developer.apple.com/documentation/cinematic/cnassetspatialaudioinfo-7hdev | Audio Mix information of an asset. |
| CNSpatialAudioRenderingStyle | https://developer.apple.com/documentation/cinematic/cnspatialaudiorenderingstyle | Audio Mix styles, including cinematic. |
| TN3177 | https://developer.apple.com/documentation/technotes/tn3177-understanding-alternate-audio-track-groups-in-movie-files | Technote: alternate audio track groups. |
| Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media | Article: camera, microphone, Photos permission. |

### Photos, files, timer

| Title | URL | Description |
|---|---|---|
| PhotoKit | https://developer.apple.com/documentation/photokit | Framework overview. |
| PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest | Create an asset from resources. |
| addResource(with:fileURL:options:) | https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:fileurl:options:) | Add a file resource. |
| PHAssetResourceCreationOptions | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions | Options type. |
| shouldMoveFile | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile | Move, do not copy. |
| PHAssetResourceType.video | https://developer.apple.com/documentation/photos/phassetresourcetype/video | Video resource type. |
| PHAssetResourceType.pairedVideo | https://developer.apple.com/documentation/photos/phassetresourcetype/pairedvideo | Live Photo movie resource type. |
| performChanges(_:completionHandler:) | https://developer.apple.com/documentation/photos/phphotolibrary/performchanges(_:completionhandler:) | Run a change block. |
| requestAuthorization(for:handler:) | https://developer.apple.com/documentation/photos/phphotolibrary/requestauthorization(for:handler:) | Ask for Photos access. |
| PHAccessLevel.addOnly | https://developer.apple.com/documentation/photos/phaccesslevel/addonly | Add-only access. |
| creationRequestForAssetFromVideo(atFileURL:) | https://developer.apple.com/documentation/photos/phassetchangerequest/creationrequestforassetfromvideo(atfileurl:) | Simple alternative (copies). |
| Delivering an Enhanced Privacy Experience in Your Photos App | https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app | Article: access levels. |
| URL.temporaryDirectory | https://developer.apple.com/documentation/foundation/url/temporarydirectory | Temporary directory URL. |
| Timer.publish(every:tolerance:on:in:options:) | https://developer.apple.com/documentation/foundation/timer/publish(every:tolerance:on:in:options:) | The Combine timer the sample uses. |
| TimelineView | https://developer.apple.com/documentation/swiftui/timelineview | SwiftUI view that updates on a schedule. |
| Text(_:style:) | https://developer.apple.com/documentation/swiftui/text/init(_:style:) | Self-updating date text. |
| Text.DateStyle.timer | https://developer.apple.com/documentation/swiftui/text/datestyle/timer | Timer style. |
| Text(timerInterval:pauseTime:countsDown:showsHours:) | https://developer.apple.com/documentation/swiftui/text/init(timerinterval:pausetime:countsdown:showshours:) | Timer text with pause support. |
| withCheckedThrowingContinuation | https://developer.apple.com/documentation/swift/withcheckedthrowingcontinuation(isolation:function:_:) | Bridge a callback to `async`. |
| synchronizationClock | https://developer.apple.com/documentation/avfoundation/avcapturesession/synchronizationclock | Session clock for timestamps. |
| CMTime | https://developer.apple.com/documentation/coremedia/cmtime | Time type. |

### Other capabilities

| Title | URL | Description |
|---|---|---|
| Capturing Cinematic video | https://developer.apple.com/documentation/avfoundation/capturing-cinematic-video | Sample code. |
| isCinematicVideoCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/iscinematicvideocaptureenabled | Turn Cinematic video on (iOS 26). |
| isCinematicVideoCaptureSupported (input) | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/iscinematicvideocapturesupported | Support check. |
| isCinematicVideoCaptureSupported (format) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/iscinematicvideocapturesupported | Format support. |
| simulatedAperture | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/simulatedaperture | Blur strength. |
| isCinematicVideoMetadataCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/iscinematicvideometadatacaptureenabled | Cinematic metadata in movies (iOS 27). |
| isSpatialVideoCaptureEnabled | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/isspatialvideocaptureenabled | Turn spatial video on (iOS 18). |
| isSpatialVideoCaptureSupported (output) | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/isspatialvideocapturesupported | Support check. |
| isSpatialVideoCaptureSupported (format) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isspatialvideocapturesupported | Format support. |
| AVExternalStorageDevice | https://developer.apple.com/documentation/avfoundation/avexternalstoragedevice | External drive for capture. |
| AVExternalStorageDeviceDiscoverySession | https://developer.apple.com/documentation/avfoundation/avexternalstoragedevicediscoverysession | Find external drives. |
| AVProVideoStorage | https://developer.apple.com/documentation/avfoundation/avprovideostorage | Pre-allocated storage (iOS 27). |
| usesProVideoStorage | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/usesprovideostorage | Opt the movie output in. |
| isProVideoStorageSupported | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/isprovideostoragesupported | Support check. |
| AVCaptureTimecodeGenerator | https://developer.apple.com/documentation/avfoundation/avcapturetimecodegenerator | Timecode (iOS 26). |
| AVCaptureMultiCamSession | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession | Several cameras at once. |
| AVMultiCamPiP sample | https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras | Multi-camera recording sample. |
| Apple ProRes and ProRes RAW Authorized Products | https://support.apple.com/en-us/118584 | Support article named in the headers for ProRes RAW. |

### WWDC sessions

| Title | URL | Description |
|---|---|---|
| WWDC26-303 Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | Deferred start, preview, hardware cost, Pro Video Storage. Source of the newest commit. |
| WWDC25-251 Enhance your app's audio recording capabilities | https://developer.apple.com/videos/play/wwdc2025/251/ | AirPods high-quality recording, Spatial Audio capture, Audio Mix. |
| WWDC25-253 Enhancing your camera experience with capture controls | https://developer.apple.com/videos/play/wwdc2025/253/ | AirPods stem click as a capture trigger. |
| WWDC25-319 Capture cinematic video in your app | https://developer.apple.com/videos/play/wwdc2025/319/ | Cinematic video capture API. |
| WWDC24-10166 Build compelling spatial photo and video experiences | https://developer.apple.com/videos/play/wwdc2024/10166/ | Spatial video with the movie file output. |
| WWDC23-10105 Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ | Responsiveness; referenced by session 303. |
| WWDC23-10106 Support external cameras in your iPadOS app | https://developer.apple.com/videos/play/wwdc2023/10106/ | External cameras and microphones. |
| WWDC22-110429 Discover advancements in iOS camera capture | https://developer.apple.com/videos/play/wwdc2022/110429/ | Multitasking, depth, focus. |
| WWDC21-10047 What's new in camera capture | https://developer.apple.com/videos/play/wwdc2021/10047/ | 10-bit HDR video, `x420`, EDR versus HDR, AVCam's 10-bit helper. |
| WWDC20-10009 Edit and play back HDR video with AVFoundation | https://developer.apple.com/videos/play/wwdc2020/10009/ | HDR playback and editing. |
| WWDC20-10010 Export HDR media in your app with AVFoundation | https://developer.apple.com/videos/play/wwdc2020/10010/ | HLG, PQ, Dolby Vision background. |
| WWDC19-249 Introducing Multi-Camera Capture for iOS | https://developer.apple.com/videos/play/wwdc2019/249/ | Multi-cam session and hardware cost. |
| WWDC16-501 Advances in iOS Photography | https://developer.apple.com/videos/play/wwdc2016/501/ | Wide color and the photo output; background for color handling. |
