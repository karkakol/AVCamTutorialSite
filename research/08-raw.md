# RAW and Apple ProRAW: research (15 Oct 2026)

Sources: SDK headers of iPhoneOS 27.1 [H], a device test of the chapter 8 build on the user's iPhone with a Pro camera on 16 Oct 2026 [T] (`AVCapturePhotoOutput.h`, `AVCaptureDevice.h`, `PHAssetCreationRequest.h`, `PHAssetResource.h`, `PhotosTypes.h`, `PHAsset.h`), Apple documentation from the JSON endpoint [D], the WWDC21 session 10160 transcript [W], the app code on branch `chapter-07` [A], and `research/05-simcam.md` and `notes/chapter-07.md` for the Simulator [S]. Nothing was run. Nothing was tested on a real iPhone.

## Surprises (read first)

1. **Apple advises against the plan's save model.** [W] WWDC21 session 10160 says the "RAW plus JPEG" model (JPEG as `.photo`, RAW as `.alternatePhoto`) "is not recommended for Apple ProRAW". It advises one DNG as the `.photo` resource, with a full-size JPEG preview embedded in the DNG (`rawEmbeddedThumbnailPhotoFormat`). The plan chose "HEIF as `.photo`, DNG as `.alternatePhoto`". See "Saving the DNG": there are three options, not two.
2. **Apple's own article uses the reverse order.** [D] "Capturing photos in RAW and Apple ProRAW formats" saves the DNG as `.photo` and the processed HEIF as `.alternatePhoto`. The `alternatePhoto` page says the opposite model: JPEG primary, RAW alternate. The iOS 27 headers follow the page [H]. The sources disagree. A real iPhone must settle it.
3. **There is no `rawFileDataRepresentation`.** [H] `AVCapturePhoto` has only `fileDataRepresentation()`. For a RAW photo it returns DNG data. Use `photo.isRawPhoto` to tell the two photos apart.
4. **Constant color and RAW exclude each other.** [H] "If rawPhotoPixelFormatType is non-zero, constantColorEnabled must be set to NO." The plan lists constant color as an option of the RAW chapter. It cannot combine with RAW in one request.
5. **Bayer RAW forces `.speed`.** [H] The app's default prioritization is `.quality` (chapter 7). A Bayer RAW request with `.quality` or `.balanced` throws `NSInvalidArgumentException`. The settings code must override the picker. **Corrected by the device (G):** on iOS 26 the setter itself throws for a Bayer RAW request, also with `.speed`; the app does not call it for RAW.
6. **The SF Symbol `camera.raw` does not exist.** [A] I checked `name_availability.plist` of this Mac's SF Symbols: no `camera.raw`, no `raw`. Use `r.square` and `r.square.fill` (2019), or `Text("RAW")`.
7. **WWDC21 10047 is the wrong session.** Its title is "What's new in camera capture". It does not teach ProRAW. The ProRAW session is WWDC21 10160, "Capture and process ProRAW images". Both pages return 200.
8. **New in the iOS 27 SDK.** [H] `PHAssetCreationRequest.originalResourceChoice` (`.compressed` or `.raw`) and `PHAsset.originalResourceChoice`. Both apply to RAW+compressed assets only. This is the first header sign that Photos models "RAW alternate" assets. The app target supports iOS 26.0 (only the project level says 27.0) [A], so these need `#available(iOS 27, *)`; see F. The `contentType` option of `PHAssetResourceCreationOptions` needs iOS 26.

## What the API is

Two kinds of RAW exist. [H][W]

| | Bayer RAW | Apple ProRAW |
|---|---|---|
| What it is | Raw sensor data, no processing, mosaic pattern | Demosaiced, partly processed, scene-referred. A "Linear DNG" |
| Since | iOS 10 | iOS 14.3, iPhone 12 Pro and later [W] |
| Where | Single-camera devices (wide, tele) [W] | All devices, including virtual multi-camera devices [W] |
| Quality prioritization | Must be `.speed` [H] | `.balanced` and `.quality` allowed [W] |
| Zoom | `videoZoomFactor` and `videoScaleAndCropFactor` must both be 1.0 [H] | No such rule in the header |
| Live Photo | Allowed by the header rules; WWDC21 says "only supported with Bayer RAW" [W] | `livePhotoMovieFileURL` must be nil [H] |
| Typical file size | Not stated | 10 to 40 MB, grows with the scene [W] |
| Pixel format | Check with `isBayerRAWPixelFormat(_:)` | Check with `isAppleProRAWPixelFormat(_:)` (example: `l64r`) [W] |

### Support checks and enabling (on the photo output)

- [H] `isAppleProRAWSupported`: "Indicates whether the current configuration supports Apple ProRAW pixel formats. The AVCapturePhotoSettings appleProRAWEnabled property may only be set to YES if this property returns YES. This property is key-value observable." Read it only after the output is in a session with a video input. It depends on the configuration (camera, format, preset). ProRAW needs a format that supports the highest quality photos, for example `sessionPreset = .photo` [W]. The app uses `.photo` [A].
- [H] `isAppleProRAWEnabled`: "Indicates whether the photo output is configured for delivery of Apple ProRAW pixel formats as well as Bayer RAW formats." It "may only be set to YES if appleProRAWSupported returns YES". "Enabling this property requires a lengthy reconfiguration of the capture render pipeline, so you should set this property to YES before calling -[AVCaptureSession startRunning]." Default is NO.
- [H] The ProRAW formats "will be added to -availableRawPhotoPixelFormatTypes after any existing Bayer RAW formats". So one `isAppleProRAWEnabled = true` gives both kinds in one list (when the device has both).
- [H] `availableRawPhotoPixelFormatTypes`: "If you've not yet added your receiver to an AVCaptureSession with a video source, no RAW formats are available. See AVCapturePhotoOutput.appleProRAWEnabled on how to enable support for partially processed RAW formats. This property is key-value observable. RAW capture is not supported on all platforms." The type is `[OSType]` in Swift.
- [H] `isBayerRAWPixelFormat(_:)`: "Returns YES if the given pixel format is a Bayer RAW format. May be used to distinguish Bayer RAW from Apple ProRAW pixel formats in -availableRawPhotoPixelFormatTypes once appleProRAWEnabled has been set to YES." `isAppleProRAWPixelFormat(_:)` is the same for ProRAW. Both are class functions: `AVCapturePhotoOutput.isAppleProRAWPixelFormat(format)`.
- [D] Apple's article finds the format with `availableRawPhotoPixelFormatTypes.first(where:)` and one of the two class functions.
- [H] The ProRAW state is not said to revert when `isAppleProRAWSupported` becomes NO (other features say so). Set the value again on each camera change, with the support check.

### Creating the settings

- [H] `AVCapturePhotoSettings(rawPixelFormatType:processedFormat:)`: "Creates an instance of AVCapturePhotoSettings specifying RAW + a processed format (such as JPEG)." `rawPixelFormatType` "must be one of the OSTypes contained in AVCapturePhotoOutput's -availableRawPhotoPixelFormatTypes array". "Passing a nil processedFormat dictionary is analogous to calling +photoSettingsWithRawPixelFormatType:" (RAW only). The processed format needs `AVVideoCodecKey` (in `availablePhotoCodecTypes`) or `kCVPixelBufferPixelFormatTypeKey`, not both.
- [H] `rawPhotoPixelFormatType` (on the settings, read-only): "The rawPixelFormatType you specified in one of the creation methods. Returns 0 if you did not specify RAW capture."
- [H] A longer form exists: `init(rawPixelFormatType:rawFileType:processedFormat:processedFileType:)`. The default RAW container is DNG.
- [H] iOS 18: `rawFileFormat` (key `AVVideoAppleProRAWBitDepthKey` 8 to 16, optional `AVVideoQualityKey` below 1.0 for lossy), `availableRawPhotoCodecTypes`. This makes smaller DNG files. The chapter does not need it.
- [H] `settings.uniqueID` is new for each settings object. "It is illegal to re-use settings."

### Rules that `capturePhoto(with:delegate:)` enforces

[H] A violation throws `NSInvalidArgumentException`. The header text:

- "If rawPhotoPixelFormatType is non-zero, it must be present in the receiver's -availableRawPhotoPixelFormatTypes array."
- "If rawPhotoPixelFormatType is non-zero, constantColorEnabled must be set to NO."
- "If rawPhotoPixelFormatType is non-zero, highResolutionPhotoEnabled may be YES or NO, but the setting only applies to the processed image, if you've specified one." (This is the old flag; the header says nothing equal for `maxPhotoDimensions`. See below.)
- Bayer: "photoQualityPrioritization must be set to AVCapturePhotoQualityPrioritizationSpeed". "the videoZoomFactor of the source device and the videoScaleAndCropFactor of the photo output's video connection must both be 1.0."
- ProRAW: "livePhotoMovieFileURL must be nil". These are switched off by themselves: content-aware distortion correction, red-eye reduction, portrait effects matte, semantic segmentation mattes.
- Processed format: "The photoQualityPrioritization you specify may not be a greater number than the photo output's maxPhotoQualityPrioritization." The app sets `.quality` as maximum [A].
- [H] RAW photos never get geometric distortion correction. [H] Sensor orientation compensation (iOS 26) is "never applied to Bayer RAW or Apple ProRaw captures".

### The delegate

- [H] Call order: "willBeginCapture... always comes first and ... didFinishCaptureFor... always comes last, none of the other callbacks can be assumed to come in any particular order."
- [H] `photoOutput(_:didFinishProcessingPhoto:error:)`: "A callback fired when photos are ready to be delivered to you (RAW or processed). ... This callback fires resolvedSettings.expectedPhotoCount number of times for a given capture request. Note that the photo parameter is always non nil, even if an error is returned. The delivered AVCapturePhoto's rawPhoto property can be queried to know if it's a RAW image or processed image."
- [H] `expectedPhotoCount`: "For instance, if you've requested an auto exposure bracket of 3 with JPEG and RAW, the expectedPhotoCount is 6." A RAW+HEIF request gives 2.
- [H] `isRawPhoto`: "Your delegate's didFinishProcessingPhoto method may be called one or more times with image results, including RAW or non-RAW images. This property distinguishes RAW from non-RAW image results, for instance, if you've requested a RAW + JPEG capture."
- [H] `fileDataRepresentation()`: "Flattens the AVCapturePhoto to an NSData using the file container format (processedFileType or rawFileType) specified in the AVCapturePhotoSettings (e.g. JFIF, HEIF, DNG, DICOM)." [D] On a RAW photo it returns DNG data; on a processed photo, compressed data.
- [D] ProRAW is lossless by default. A customizer (`AVCapturePhotoFileDataRepresentationCustomizer.replacementAppleProRAWCompressionSettings`) can lower bit depth or add lossy compression. Not used in the chapter.
- [H] `resolvedSettings.rawPhotoDimensions` gives the size of the RAW photo ({0,0} for a non-RAW request). `photoDimensions` is {0,0} for a RAW-only request.
- [H] In case of an error "all expected callbacks are fired with an appropriate error". The app must decide what to do when the RAW fails and the HEIF works (suggestion: save the HEIF, log the RAW error).

### `maxPhotoDimensions` with RAW

- [H] The output's `maxPhotoDimensions` must match a value of `activeFormat.supportedMaxPhotoDimensions`. The settings' `maxPhotoDimensions` "defaults to the smallest dimensions returned by supportedMaxPhotoDimensions" and may not exceed the output's value.
- [H] The header has no sentence on RAW and `maxPhotoDimensions`. Whether a ProRAW request honours 48 MP is NOT in the headers. [A] The app sets the settings to the output's value, which is the largest size. For a RAW capture this can mean a very large DNG. Log `resolvedSettings.rawPhotoDimensions` on a device and decide. (Suggestion: leave the size as is, show the real size in the console.)
- [H] "The 24MP setting (5712, 4284), when supported, is only serviced as 24MP via deferred photo delivery." A RAW request cannot use deferred delivery (next point), so expect another size for the processed photo.

### Deferred delivery and RAW

- [H] `AVCaptureDeferredPhotoProxy.isRawPhoto` is "Always NO, as deferred processing isn't available for raw photos."
- The header does not say what a RAW+HEIF request does when `isAutoDeferredPhotoDeliveryEnabled` is true (chapter 7 turns it on [A]). Answered by the device test on 16 Oct 2026, see "Device finding" below: no RAW photo arrived [T]. The fix sets `isAutoDeferredPhotoDeliveryEnabled = false` while a RAW mode is chosen.

## Device finding (16 Oct 2026)

### A. Apple ProRAW with deferred delivery on: no RAW photo

- [T] Chapter 8 build (`c16d761`), RAW menu on Apple ProRAW, one capture. Console: "Capturing with RAW format: Apple ProRAW", then no "Captured RAW photo, N bytes" (the log of the `isRawPhoto` branch of `didFinishProcessingPhoto`), no "Error capturing photo" line, no "Error capturing deferred photo" line. Photos received a plain HEIF without a RAW badge. The iPhone model is not known yet.
- [H] `AVCapturePhotoOutput.autoDeferredPhotoDeliverySupported`: "When it's appropriate for the receiver to deliver a photo proxy for deferred processing, the delegate callback -captureOutput:didFinishCapturingDeferredPhotoProxy:error: will be invoked instead of -captureOutput:didFinishProcessingPhoto:error:."
- [H] `AVCaptureDeferredPhotoProxy`, property `rawPhoto`: "Always NO, as deferred processing isn't available for raw photos."
- [H] `AVCaptureDeferredPhotoProxy`: the proxy data must be added with `PHAssetResourceTypePhotoProxy`; "If the data provided to the PHAssetCreationRequest does not come from an AVCaptureDeferredPhotoProxy, then PHAssetCreationRequest will fail". [D] The `AVCaptureDeferredPhotoProxy` page says the same in shorter form.
- [H] `autoDeferredPhotoDeliveryEnabled`: "Setting this value to either YES or NO requires a lengthy reconfiguration of the capture pipeline, so you should set this property before calling -[AVCaptureSession startRunning]." [D] The same on the `isAutoDeferredPhotoDeliveryEnabled` page. "Should", not "must": a change while the session runs is allowed and costs a pipeline rebuild.
- [H] `AVCaptureResolvedPhotoSettings.expectedPhotoCount`: the number of `didFinishProcessingPhoto` calls; `rawPhotoDimensions` is {0,0} for a non-RAW request; `deferredPhotoProxyDimensions` is {0,0} without deferred delivery, and with a proxy, `photoDimensions` is the size of the final photo.
- Conclusion: the hypothesis is consistent with every source and with the symptom, but no source states it outright. The headers say a proxy replaces the processed photo and that a proxy is never RAW; they do not say that a RAW request with deferred delivery loses the RAW photo. The proxy branch of the build had no log line, so the console could not show the proxy. Status: confirmed as the most likely cause; the next device test with the new log lines confirms or refutes it ("Resolved settings" with a proxy size not 0x0 and a RAW size of 0x0 before the fix would prove it; after the fix, the count must be 2 and the proxy size 0x0).
- Decision: `PhotoCapture.updateDeferredPhotoDelivery()` enables deferred delivery only when `rawFormat == .off`; `CameraModel.rawFormat.didSet` calls `CaptureService.setRAWFormat(_:)`, which wraps `PhotoCapture.setRAWFormat(_:)` in `beginConfiguration()`/`commitConfiguration()`; `updateConfiguration(for:)` calls the same method, so a camera change respects the choice. The change happens on the menu choice, not per capture, because each change rebuilds the pipeline.
- Save path: [H] proxy data is valid only as `.photoProxy`. The first version would have added proxy data as `.alternatePhoto` next to a DNG (not reached in the test, because no DNG came). The fix makes the RAW pair only when `!photo.isProxy`; a proxy always takes the old `.photoProxy` path.

### C. Second test (16 Oct 2026): the RAW photo arrives, nothing reaches Photos

- [T] Build `2ccbaa7` (deferred delivery off for RAW). iPhone with a "Back Triple Camera" (a Pro model). Console: "Deferred photo delivery (supported/enabled): true/true"; "RAW on Back Triple Camera (virtual: true): Apple ProRAW true, Bayer RAW false"; after the choice "true/false"; per capture "Capturing with RAW format: Apple ProRAW", "Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0", "Captured RAW photo, 13987651 bytes". Three captures, each DNG 14 to 15 MB, no error line. None of the three photos reached Photos. Finding A's fix is confirmed: two photos resolved, no proxy, the RAW photo arrives.
- Capture side, ruled out as the cause: [H] `AVCapturePhotoCaptureDelegate`: "-captureOutput:willBeginCaptureForResolvedSettings: callback always comes first and the -captureOutput:didFinishCaptureForResolvedSettings: callback always comes last"; "In the event of an error, all expected callbacks are fired with an appropriate error." The delegate logs every error of `didFinishProcessingPhoto`, and none showed, so the processed photo arrived without error and `photoData` was set (the only silent gap is `fileDataRepresentation()` returning nil, which would end in `noPhotoData`). `didFinishCaptureFor` builds `Photo` with both `photoData` and `rawData`.
- Authorization, ruled out: the app asks for `.addOnly`; the same `performChange(_:)` saved the normal photos of the first test (Photos got the HEIF). The thumbnail fetch after the save does not run under add-only access, but that does not stop the save.
- Save side, the most likely cause [inference]: two silent paths. `MediaLibrary.performChange(_:)` replaced any error of `performChanges` with `MediaLibrary.Error.saveFailed`; `CameraModel.capturePhoto()` stored the error in `error`, which no view reads, with no log. [H] `PHAssetCreationRequest.h`: "Adding resources to a creation request always succeeds; validation of the request is performed later, and any errors are reported after the performChanges block." The request was: DNG as `.photo` from `Data`, HEIF as `.alternatePhoto` from `Data`, both with one options object and no `contentType`. [H] `PHAssetResourceCreationOptions.contentType` (iOS 26): "If not specified, one will be inferred from the PHAssetResourceType or file URL extension (if provided)." So the DNG had no type except the one inferred from `.photo`, and the HEIF had the one inferred from `.alternatePhoto`. [D] The article does the same order but gives the DNG as a file URL with the `.dng` extension (`shouldMoveFile = true`), so its DNG type comes from the extension. [D] `PHAssetResourceType.alternatePhoto`: "Provides photo data that isn't the primary form of its asset", with the example of a JPEG (primary) and a RAW file (alternate photo). [H] iOS 27 `PHOriginalResourceChoice`: "assets that have a RAW alternate, such as RAW+JPEG assets"; `originalResourceChoice` "applies to RAW+JPEG assets only". No source states that Photos refuses the article's order with `Data`. Status: not proven; the third test shows the error text.
- Tried, not possible here: a save test in the Simulator needs a decodable DNG. This Mac has no DNG file, ImageIO cannot write DNG (`CGImageDestinationCopyTypeIdentifiers` has no `com.adobe.raw-image`), and a hand-made linear DNG did not decode (`CGImageSourceGetCount` 0). Downloading a sample DNG was not done.
- Decision: the documented order. `save(photo:)` adds the processed data as `.photo` (options unchanged) and the DNG as `.alternatePhoto` with its own options, `contentType = .dng` (`UTType.dng`; the app targets iOS 27, `contentType` needs iOS 26). Logs: "Captured processed photo, N bytes" (delegate, else branch), "Saved asset <localIdentifier>" and "Saving to Photos failed: <error>" (`performChange(_:)`, so also for movies), "Photo capture failed: <error>" (`CameraModel.capturePhoto()` catch, keeps `self.error`). Commit `87747f2` on `chapter-08`.
- Simulator check of the new build (no RAW path): "Resolved settings: 1 photos, photo 640x480, RAW 0x0, proxy 0x0", "Captured processed photo, 48139 bytes", "Saved asset 8F2EB3D0-.../L0/001".
- If the third test shows "Saving to Photos failed" for the documented order: next options are the article's order with the DNG written to a temporary `.dng` file and added by file URL (`shouldMoveFile = true`), or two assets (option B). The third test did show it (3300); see D.

### D. Third test (16 Oct 2026): Photos refuses the pair with error 3300

- [T] Build `87747f2`. iPhone 17 Pro Max, "Back Triple Camera", Apple ProRAW chosen, deferred delivery off for RAW. Four captures, each with the same lines: "Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0", "Captured RAW photo, 14378684 bytes", "Captured processed photo, 1671447 bytes", "Saving to Photos failed: Error Domain=PHPhotosErrorDomain Code=3300 "(null)"", "Photo capture failed: AVCam.MediaLibrary.Error.saveFailed". A capture with RAW Off saved: "Saved asset ...", proxy path, photo 5712x4284. So both photos arrive, and Photos refuses the request, not the access.
- [H] `PHError.h` (iOS 27.1 SDK): `PHPhotosErrorChangeNotSupported = 3300`, "The change request is not supported as configured". `PHPhotosErrorInvalidResource = 3302`, "Asset resource validation failed". The coordinator's note called 3300 `invalidResource`; that is wrong. 3300 is `changeNotSupported`: Photos refused the configuration of the request (resource types, their order, `Data` against file URL, options), not the bytes. The header does not say which part.
- [H] `PHAssetCreationRequest.h`: `supportsAssetResourceTypes:` tells if a combination of resource types is supported; "Adding resources to a creation request always succeeds; validation of the request is performed later". `addResourceWithType:fileURL:options:` and `addResourceWithType:data:options:` exist for every type; the header does not restrict a type to one of them.
- [H] `PHAssetResourceCreationOptions`: `originalFilename` "If not specified, one will be inferred from a fileURL if available, or else generated"; `contentType` (iOS 26) "If not specified, one will be inferred from the PHAssetResourceType or file URL extension (if provided)"; `uniformTypeIdentifier` is `API_DEPRECATED("Use contentType instead", ios(9, API_TO_BE_DEPRECATED))` (no compiler warning); `shouldMoveFile`: the file "will be moved into the photo library without duplicating the file data (the original file is removed if the asset is created successfully)", default NO, "Attempting to move a file that is open or hardlinked will fail".
- [D] Article "Capturing photos in RAW and Apple ProRAW formats", read from the JSON endpoint on 16 Oct 2026. Delegate listing: `didFinishProcessingPhoto` writes the RAW `fileDataRepresentation()` to `temporaryDirectory/<globallyUniqueString>.dng` ("Write the RAW (DNG) file data to a URL") and keeps the compressed data as `Data`. Save listing: one `PHAssetCreationRequest.forAsset()`; `options.shouldMoveFile = true`; `addResource(with: .photo, fileURL: rawFileURL, options: options)`; `addResource(with: .alternatePhoto, data: compressedData, options: nil)`. Text: "specify the DNG version as the asset's main photo resource, and the processed image as an alternatePhoto resource". No `originalFilename`, no type in the options.
- Requests tried so far: [T] round 2: DNG `.photo` from `Data`, HEIF `.alternatePhoto` from `Data`, no type: nothing saved (error hidden). [T] round 3: HEIF `.photo` from `Data`, DNG `.alternatePhoto` from `Data` with `contentType = .dng`: 3300. Neither is the article's request, which is the only complete code in Apple's sources.
- Conclusion [inference]: the valid combination that Apple shows is the article's: DNG as `.photo` from a file URL with the `.dng` extension (`shouldMoveFile` applies, because it is a file), processed photo as `.alternatePhoto` from `Data`. `shouldMoveFile` has no meaning for `Data`. Not proven on a device yet; round 4 decides. Round 4 refused it too; see E.
- Decision: commit `1f03e26` on `chapter-08` (parent `87747f2`). `URL.rawFileURL` (`FoundationExtensions.swift`, `<UUID>.dng` in the temporary directory). `MediaLibrary.save(rawData:processedData:location:)` writes the file, `defer` removes it when Photos did not take it, adds the DNG as `.photo` by file URL with `shouldMoveFile = true`, `originalFilename` `<UUID>.dng` and `uniformTypeIdentifier` `com.adobe.raw-image`, and the processed data as `.alternatePhoto` with `originalFilename` `<UUID>.heic` or `.jpeg` and the type read with `CGImageSourceGetType` (`public.heic` or `public.jpeg`). `uniformTypeIdentifier` instead of `contentType`, because round 3 failed with `contentType` and the older property is what RAW+JPEG imports have used since iOS 9 (no evidence that `contentType` was the cause). Logs before `performChanges`: "RAW pair, .photo with .alternatePhoto supported: <Bool>", "Resource .photo: N bytes, com.adobe.raw-image, file <UUID>.dng", "Resource .alternatePhoto: N bytes, public.heic, file <UUID>.heic". `performChange(_:)` logs "Saving to Photos failed: <error> (<code name>)" with `PHPhotosError.Code.name` (a switch; interpolation of the code gives only "PHPhotosError(rawValue: 3300)", tested with `swift` on the Mac). `MediaLibrary.Error.saveFailed(reason:)` carries the error. Fallback in `save(photo:)`: on any error of the pair, save the processed photo alone as `.photo` and log "Saved the processed photo without the RAW: <error>". The non-RAW path is the chapter 7 code again, byte for byte.
- Known limit: the RAW path drops a Live Photo movie. Apple ProRAW never has one (the movie URL is `nil`); Bayer RAW with Live Photo would lose the movie and leave its temporary file. Bayer RAW is not available on the test device.
- Simulator: no RAW (SimCam), so neither the pair nor the fallback runs; the non-RAW path is unchanged, verified by reading. Build with zero warnings.

### E. Fourth test (16 Oct 2026): the DNG file is refused, Photos names it

- [T] Build `1f03e26`. iPhone 17 Pro Max, "Back Triple Camera", Apple ProRAW. Console: "Captured RAW photo, 15584824 bytes", "Captured processed photo, 2014683 bytes", "RAW pair, .photo with .alternatePhoto supported: true", "Resource .photo: 15584824 bytes, com.adobe.raw-image, file 9A7ED4CC-….dng", "Resource .alternatePhoto: 2014683 bytes, public.heic, file 9A7ED4CC-….heic", "Saving to Photos failed: Error Domain=PHPhotosErrorDomain Code=3300 "(null)" UserInfo={_PHResourceUrlsErrorKey=("file:///private/var/mobile/Containers/Data/Application/…/tmp/9A7ED4CC-….dng")} (changeNotSupported)", then the fallback: "Saved asset B057858A-…/L0/001", "Saved the processed photo without the RAW: …" (same 3300).
- Facts: `supportsAssetResourceTypes([.photo, .alternatePhoto])` is true; both resources were added; the fallback (HEIF alone as `.photo` from `Data`, no options) saves. `_PHResourceUrlsErrorKey` is a private key; it lists only the DNG file URL. The header `PHError.h` has only the public key `PHLocalIdentifiersErrorKey` [H]; nothing documents the private key. Inference: Photos ties the refusal to the DNG resource.
- Requests refused so far with 3300: round 3 (HEIF `.photo` from `Data`, DNG `.alternatePhoto` from `Data`, `contentType = .dng`), round 4 (DNG `.photo` by file URL, `shouldMoveFile`, `originalFilename`, `uniformTypeIdentifier`; HEIF `.alternatePhoto` from `Data` with `originalFilename` and `uniformTypeIdentifier`). Round 2 (DNG `.photo` from `Data`, no type) failed with a hidden error. The DNG is the only part in every failed request. A HEIF alone always saves.
- The log value `com.adobe.raw-image` of round 4 was a constant (`UTType.dng.identifier`), not read from the data. No round has checked the bytes of the RAW data.
- Candidates, checked against the sources:
  - (a) Options. [D] The article sets only `shouldMoveFile` on the DNG and `nil` on the processed photo. Round 4 added `originalFilename` and `uniformTypeIdentifier` to both. [H] `originalFilename` "If not specified, one will be inferred from a fileURL"; `contentType` "If not specified, one will be inferred from the PHAssetResourceType or file URL extension". Low likelihood (round 3 failed without names), but it is the only difference from the article. Removed in the fix.
  - (b) The RAW bytes. [H] `fileDataRepresentation`: "Flattens the AVCapturePhoto to an NSData using the file container format (processedFileType or rawFileType) specified in the AVCapturePhotoSettings (e.g. JFIF, HEIF, DNG, DICOM)." [H] Four-argument initializer: rawFileType "Pass nil if you have no preferred file container. A default container will be chosen for you." [D] `rawFileType` page: if not specified, the value is `nil` and the output chooses "a default file format appropriate to the rawPhotoPixelFormatType". [D] The article: on a RAW photo, `fileDataRepresentation()` "returns the data in the industry-standard DNG file format", with the two-argument initializer. [H] Rule: "If rawFileType is specified, it must be present in -availableRawPhotoFileTypes and must support the rawPhotoPixelFormatType specified using -supportedRawPhotoPixelFormatTypesForFileType:." No source says that `rawFileType = .dng` is required. There is no `rawData` on `AVCapturePhoto`; for RAW the header offers `pixelBuffer` and `fileDataRepresentation()`. `rawEmbeddedThumbnailPhotoFormat` is optional [H][D]; the article shows it as an option for ProRAW, not as a requirement. Decision: keep the two-argument initializer (as the article) and log the facts: header bytes, Image I/O type, image count, `availableRawPhotoFileTypes`.
  - (c) Temporary directory and `shouldMoveFile`. [D] The article uses the same. The Live Photo movie of chapter 4 uses the temporary directory with `shouldMoveFile` and saves. Round 3 used `Data` and failed too. Not likely.
  - (d) `maxPhotoDimensions`. Rounds 3 and 4: "photo 4032x3024, RAW 4032x3024" in the resolved settings. The settings ask for the output's maximum (5712x4284), which [H] is "only serviced as 24MP via deferred photo delivery"; deferred delivery is off for RAW, so both photos are 12 MP. No size mismatch. Not likely.
  - (e) Not in the brief, noted: the app has `.addOnly` access. [D] The article also asks for `.addOnly`, so this should be allowed. Not testable from the headers.
- Hypothesis [inference]: Photos refuses the DNG resource itself: either the data is not a DNG that Photos accepts, or the options of round 4 made the resource unacceptable. 3300 (`changeNotSupported`) and not 3302 (`invalidResource`) argues for the configuration, the private key for the DNG. Round 5 decides between (a) and (b): if "RAW data" shows a TIFF header, `com.adobe.raw-image` and at least 1 image, and the article's exact request still fails, the bytes are a DNG and (a) is ruled out; the next test is the DNG alone as `.photo` (option C), to separate "Photos refuses this DNG" from "Photos refuses this pair".
- Decision: commit `3baa017` on `chapter-08` (parent `1f03e26`), message "Chapter 8: the RAW save request as in Apple's article; RAW data diagnostics". `MediaLibrary.save(rawData:processedData:location:)`: first logs "RAW data: N bytes, header XX XX XX XX, type <Image I/O type>, images <count>"; the DNG file as `.photo` with an options object that sets only `shouldMoveFile = true`; the processed data as `.alternatePhoto` with `options: nil`; the location stays (the normal save sets it too). The resource lines are now "Resource .photo: N bytes, file <UUID>.dng" and "Resource .alternatePhoto: N bytes, type <Image I/O type>, images <count>". The helper `imageType(of:) -> UTType` became `imageInfo(of:) -> (type: String, count: Int)`; the import `UniformTypeIdentifiers` is gone from `MediaLibrary.swift`. `PhotoCapture.createPhotoSettings(with:)` logs "RAW file types: <list>" after "Capturing with RAW format: …". Fallback and error logs unchanged.
- Rebase: `chapter-09` … `chapter-20` and `main` onto `3baa017`, no conflicts, each tip builds with zero warnings. Old SHAs: `scratchpad/old-branches-fix4.txt` of the session.

### F. Fifth test (16 Oct 2026): a valid DNG, the article's exact request refused

- [T] Build `3baa017`. iPhone 17 Pro Max ("iOS 27" in the first note; round 6 showed iOS 26, see G), "Back Triple Camera", Apple ProRAW. Console: "RAW file types: com.adobe.raw-image", "Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0", "Captured RAW photo, 15995281 bytes", "Captured processed photo, 1998470 bytes", "RAW data: 15995281 bytes, header 4D 4D 00 2A, type com.adobe.raw-image, images 1", "RAW pair, .photo with .alternatePhoto supported: true", "Resource .photo: 15995281 bytes, file ….dng", "Resource .alternatePhoto: 1998470 bytes, type public.heic, images 1", "Saving to Photos failed: Error Domain=PHPhotosErrorDomain Code=3300 UserInfo={_PHResourceUrlsErrorKey=("file:///…/tmp/….dng")} (changeNotSupported)", then the fallback "Saved asset …".
- Facts: the DNG is valid (TIFF big-endian header, Image I/O type `com.adobe.raw-image`, 1 image); the only RAW container is DNG; the request was the article's without additions (DNG file `.photo` with only `shouldMoveFile`, HEIF `Data` `.alternatePhoto` with `nil` options, location). Candidates (a) options and (b) bytes of section E are ruled out.
- Requests refused so far: round 2 (DNG `.photo` `Data`, HEIF `.alternatePhoto` `Data`; error hidden), round 3 (HEIF `.photo` `Data`, DNG `.alternatePhoto` `Data` with `contentType`: 3300), round 4 (DNG `.photo` file with name and type, HEIF `.alternatePhoto` `Data` with name and type: 3300), round 5 (the article's request: 3300). Never tried: HEIF `.photo` `Data` with the DNG `.alternatePhoto` from a FILE; the DNG alone; `originalResourceChoice`.
- [H] iOS 27.1 SDK, Photos headers, read on 16 Oct 2026:
  - `PhotosTypes.h`: `PHOriginalResourceChoice` (`NS_SWIFT_NAME(PHAsset.OriginalResourceChoice)`, iOS 27): `PHOriginalResourceChoiceCompressed = 0` ("such as a JPEG or HEIC"), `PHOriginalResourceChoiceRaw = 1`. "This choice is only meaningful for assets that have a RAW alternate, such as RAW+JPEG assets. For all other assets, the asset has a single original resource and the value is always" `.compressed`.
  - `PHAssetCreationRequest.h`: `originalResourceChoice` (read-write, iOS 27): "The original resource to use as the unadjusted base for rendering derivatives of the new asset." "This property applies to RAW+JPEG assets only, where it selects whether the RAW or the compressed resource serves as the original. Setting it on assets that have only a single original resource is an error." Next to it, unchanged: `supportsAssetResourceTypes:` ("Whether we support a given combination of PHAssetResourceTypes") and "Adding resources to a creation request always succeeds; validation of the request is performed later". No text in any Photos header lists which resource types combine, or in which order. `supportsAssetResourceTypes:` takes an array, so it cannot tell `.photo`=HEIF from `.photo`=DNG.
  - `PHAssetChangeRequest.h`: `revertAssetContentToOriginalResourceChoice:` (iOS 27, "applies to RAW+JPEG assets only"); `PHContentEditingInputRequestOptions.originalResourceChoice` (iOS 27, "Setting it for an asset that has only a RAW resource is an error"). Not a property of `PHAssetChangeRequest` itself.
  - `PHAsset.h`: read-only `originalResourceChoice` (iOS 27), "only meaningful for assets that have a RAW alternate".
  - `PHAssetResource.h` (iOS 27 additions): `filename` (replaces deprecated `originalFilename`), `dataSize`, `assetResourceForUploadJob:`. Nothing about RAW.
  - `PHImageManager.h`: `PHImageRequestOptionsVersionOriginal`, "in the case of a combined format the highest fidelity format will be returned (e.g. RAW for a RAW+JPG source image)".
  - `PHAssetResourceType` (`PhotosTypes.h`): no new type in iOS 27; `.alternatePhoto` = 4, `.photo` = 1.
- [D] JSON endpoint, 16 Oct 2026: `photos/phassetcreationrequest/originalresourcechoice` (iOS 27.0): the same text as the header. `photos/phassetresourcetype/alternatephoto`: "Provides photo data that isn't the primary form of its asset", example: a JPEG (primary) and a RAW file (alternate). `photos/phassetresourcetype/photo`: "Provides the original photo data for its asset", nothing on RAW. `photos/phassetresource`: "A photo asset can contain both JPEG and RAW files representing the same photo." `photos/phasset/originalresourcechoice` and `photos/phassetchangerequest/originalresourcechoice`: 404.
- [H] `AVCapturePhotoOutput.h`, Apple ProRAW rules: "livePhotoMovieFileURL must be nil in AVCapturePhotoSettings settings".
- [A] Correction to surprise 8: the AVCam target has `IPHONEOS_DEPLOYMENT_TARGET = 26.0`; only the project level says 27.0. So the iOS 27 API needs `#available(iOS 27, *)`. `MediaLibrary` asks for `.addOnly` access (`authorizationStatus(for: .addOnly)` and `requestAuthorization(for: .addOnly)`), not full access.
- Conclusions [inference]: (1) every Photos source that names a RAW pair (headers, `.alternatePhoto` page, `PHAssetResource` page, `PHImageManager.h`) uses the model "compressed is primary, RAW is alternate"; only the AVFoundation article uses the reverse. (2) Nothing says that `originalResourceChoice` must be set; its default is `.compressed`, and it is "an error" only on an asset with one original. (3) Nothing lists allowed combinations. So the compressed-primary order with the DNG from a file is the best untested candidate, and the DNG alone separates "this DNG" from "this pair". Not proven; round 6 decides.
- Decision: commit `11c0675` on `chapter-08` (parent `3baa017`; an earlier draft was `b801ee8`), "Chapter 8: save variants for the device test; Live Photo off while ProRAW is selected". `MediaLibrary.save(rawData:processedData:location:)` keeps all logs, writes the DNG file once, then loops over the private `enum RAWSaveVariant: Int, CaseIterable, CustomStringConvertible` (1 `processedWithRAWAlternateAsOriginal`, 2 `processedWithRAWAlternate`, 3 `rawWithProcessedAlternate`, 4 `rawAlone`), marked "DIAGNOSTIC MATRIX". Per variant: "Save variant N: <description>"; if the file is gone, write it again and log "Save variant N: wrote the DNG file again"; `performChange { Self.makeRequest(for:rawFileURL:processedData:location:) }`; "Save variant N result: saved" and `return`, or "Save variant N result: failed" and the next variant; after variant 4 the error goes to `save(photo:)`. Variant 1 sets `originalResourceChoice = .raw` in `if #available(iOS 27, *)` and logs "Save variant 1: originalResourceChoice .raw" (else "… needs iOS 27, not set"). Variant 5 is the existing fallback in `save(photo:)`, which now logs "Save variant 5: processed photo alone .photo (Data)" before its request and "Saved the processed photo without the RAW: <error>" after it. The DNG options set only `shouldMoveFile`; the processed photo always has `nil` options. The `defer` removes the file at the end.
- Live Photo lock: `CameraModel.isLivePhotoAvailable` (`rawFormat != .appleProRAW`), a `Camera` protocol member, and a one-line copy in `PreviewCameraModel`; `capturePhoto()` passes `isLivePhotoEnabled && isLivePhotoAvailable`; `FeaturesToolbar.livePhotoButton` shows `livephoto.slash` and `.disabled(!camera.isLivePhotoAvailable)`. `isLivePhotoEnabled` is not changed, so the choice comes back with RAW Off. `excludesLivePhoto` in `PhotoCapture` stays.
- Rebase: none in round 6; `chapter-09` … `chapter-20` stayed on `3baa017` until G.

### G. Sixth test (16 Oct 2026) and the final code

- [T] Build `11c0675` (the save matrix). iPhone 17 Pro Max. The line "Save variant 1: originalResourceChoice needs iOS 27, not set" shows that `#available(iOS 27, *)` was false, so the device runs iOS 26 (rounds 5 and earlier noted iOS 27 by assumption). The system-preferred camera was the "Back Telephoto Camera" (physical; the user had taken a zoomed shot in the Camera app), so the menu offered Off, Apple ProRAW, and RAW.
- [T] Apple ProRAW: "Save variant 1: processed photo .photo (Data), DNG .alternatePhoto (file, shouldMoveFile)", then "Saved asset …", "Save variant 1 result: saved". RAW 8064x6048 (48 MP), 54 MB. Variants 2 to 4 did not run, so the DNG alone (variant 4) and the article's order with the matrix build (variant 3) are untested in this round. Photos shows ONE picture with the badge "JPG + RAW" (the word JPG although the main photo is a HEIF). The DNG comes out with Share > Options > Format: Unmodified Original.
- [T] RAW Off on the same camera: "Resolved settings" photo 8064x6048 with a proxy (deferred delivery), saved.
- [T] Bayer RAW: crash `*** -[AVCapturePhotoSettings setPhotoQualityPrioritization:] Unsupported when capturing RAW`, at the line that set `.speed` for Bayer RAW. In the same build, the line before it set the person's value (`.quality`) for every capture, and the Apple ProRAW capture with `.quality` did not crash. So the exception is tied to the Bayer RAW request, not to the value.
- [H] Discrepancy. `AVCapturePhotoOutput.h`, rules of `capturePhotoWithSettings:delegate:` for Bayer RAW: "photoQualityPrioritization must be set to AVCapturePhotoQualityPrioritizationSpeed". `AVCapturePhotoSettings.photoQualityPrioritization`: "Default value is AVCapturePhotoQualityPrioritizationBalanced". The header text implies that a Bayer request sets `.speed`; on iOS 26 the setter itself throws for a RAW settings object. Surprise 5 above ("Bayer RAW forces `.speed`") is wrong for the device. Whether the default of a RAW settings object is `.speed` is not documented; the capture with the default has not run yet (round 7).
- Decision on `originalResourceChoice`: dropped. It never ran (iOS 26), the pair saved without it, and on iOS 27 an untested line could make Photos refuse the pair.
- Decision on the prioritization: `createPhotoSettings(with:)` does not call the setter when `rawType != nil` (both RAW kinds, one rule) and logs "Quality prioritization <choice>: ignored for RAW".
- Design change by the user after round 6: behave like the Camera app. The settings keep `init(rawPixelFormatType:processedFormat:)` with a processed format and add `rawEmbeddedThumbnailPhotoFormat` = JPEG at `maxPhotoDimensions` (only when `availableRawEmbeddedThumbnailPhotoCodecTypes` contains `.jpeg`; log "RAW preview: JPEG WxH"). [H] `rawEmbeddedThumbnailPhotoFormat`: codec from `availableRawEmbeddedThumbnailPhotoCodecTypes`, width and height together, larger dimension honored, aspect ratio kept; "Beginning in iOS 12, DNG files may contain thumbnails up to the full resolution of the RAW image." [W] WWDC21 10160 advises one DNG with a full-size preview for ProRAW. The processed format stays (not `nil` as the brief said) because both fallbacks need the processed photo and the delegate's `photoData` guard needs it; with `nil`, the delegate would throw `noPhotoData`.
- Final save, `MediaLibrary.save(rawData:processedData:location:)`: log "RAW data"; write `<UUID>.dng`; `defer` remove. (1) "Resource .photo: N bytes, file <UUID>.dng"; DNG alone as `.photo` by file URL, `shouldMoveFile`; "Saved the RAW as the DNG alone". UNTESTED. (2) On error: notice "Photos refused the DNG alone. Saving the processed photo with the DNG as alternate."; "Resource .photo: N bytes, type …, images …", "Resource .alternatePhoto: N bytes, file <UUID>.dng"; processed `.photo` from `Data` (nil options) + DNG `.alternatePhoto` by file URL with `shouldMoveFile`; "Saved the RAW as the processed photo with the DNG as alternate". VERIFIED (round 6). (3) `save(photo:)` catch: the processed photo alone, "Saved the processed photo without the RAW: <error>". The matrix extension and every "Save variant" line are gone.
- Commits: the five iteration commits squashed into one "Chapter 8: RAW and Apple ProRAW capture" on `chapter-07`; `chapter-09` … `chapter-20` and `main` rebased onto it with no conflicts, each tip builds with zero warnings.

### H. Scope change: Bayer RAW moves to chapter 16 (16 Oct 2026)

- Decision by the user (tester: iPhone 17 Pro Max). The app uses the virtual back camera that the system prefers. Bayer RAW exists only on a single physical camera, so it cannot be tested inside the app before chapter 16 teaches lenses and zoom. In round 6 it showed only because a zoomed shot in the Camera app had made the "Back Telephoto Camera" the preferred camera. Chapter 8 now offers Off and Apple ProRAW only.
- Code (`chapter-08`, one commit `108eea6` on `chapter-07`): `RAWFormat` has `off` and `appleProRAW`; `CaptureCapabilities` has `isLivePhotoCaptureSupported` and `isAppleProRAWSupported`; `rawPixelFormat(for:)` handles Apple ProRAW only; `excludesLivePhoto = rawType != nil`; the "RAW on <camera> (virtual: …): Apple ProRAW …" log stays. The rule "no `photoQualityPrioritization` setter for a RAW request" stays with its log, for all RAW; the comment no longer names Bayer RAW. `PreviewCameraModel` reports Apple ProRAW only. Unchanged: the Live Photo lock, the embedded preview, the save order (DNG alone, then the pair, then the processed photo alone) with its logs, deferred delivery off for RAW, the diagnostics logs.
- The facts below stay for the chapter 16 writer. Bayer RAW: only on a single physical camera [W][T]; the zoom factor must be 1.0 [H]; the header says `photoQualityPrioritization` must be `.speed`, but on iOS 26 the setter itself raised "Unsupported when capturing RAW" for a Bayer RAW request, also with `.speed` [T] (section G), so do not call the setter; Live Photo is allowed by the header [H] but the RAW save does not keep the movie; the Bayer formats come before the Apple ProRAW formats in `availableRawPhotoPixelFormatTypes` [H]; `isBayerRAWPixelFormat(_:)` is the test [H]. Not yet known: the resolution and size of a Bayer DNG, the badge in Photos, which save path Photos accepts, and the default prioritization of a RAW settings object.
- Plan for chapter 16 (`notes/chapter-16.md`, "Planned addition: Bayer RAW on a single lens"): while Bayer RAW is selected, switch to the physical camera that matches the zoom level; back to the virtual camera when RAW is Off; no prioritization setter; check zoom 1.0 before the capture.

### B. No Bayer RAW in the menu

- [T] The menu offered Off and Apple ProRAW only.
- [H] `appleProRAWEnabled`: Apple ProRAW formats "allow capturing RAW photos in modes where there is no traditional sensor/Bayer RAW available. Examples are any modes that rely on fusion of multiple captures." [D] Same on the `isAppleProRAWEnabled` page.
- [W] WWDC21 session 10160: "Bayer RAW is only supported on single-camera AVCaptureDevices, like wide and tele."
- [D] `builtInDualCamera` is a wide plus telephoto camera that fuses images; [A] chapter 2 discovers `.builtInDualCamera` first on the back (chapter 16 later adds the triple and dual wide cameras before it). So on an iPhone with a telephoto camera the app's back camera is virtual, and Bayer RAW is absent. Neither the headers nor the documentation say it in one sentence for virtual devices; the session does.
- Decision: keep the control as it is; the chapter explains that Bayer RAW appears only on a physical camera (for example the back camera of an iPhone without a telephoto camera, where discovery falls back to `.builtInWideAngleCamera`). Reason: a camera switch for Bayer RAW needs a second device path, drops the lens change of the virtual device, and the app cannot know whether the physical camera offers Bayer RAW before it switches. A log line "RAW on <camera> (virtual: ...)" shows the facts per camera on a device.
- Open: the front camera (`.builtInTrueDepthCamera` first) — not known whether it offers Bayer RAW.

### Constant color (not combinable with RAW)

- [H] iOS 18. `isConstantColorSupported` (output, read-only): "Constant color captures require the flash to be fired and may require pre-flash sequence ... it might take several seconds to acquire a constant color photo. ... a constant color capture can only be taken with AVCaptureFlashModeAuto or AVCaptureFlashModeOn as the flash mode, otherwise an exception is thrown." "Constant color should not be used in conjunction with locked or manual white balance." "When this property changes from YES to NO, constantColorEnabled also reverts to NO."
- [H] `isConstantColorEnabled` (output): "Default is NO. ... may only be set to YES if constantColorSupported is YES. Enabling constant color requires a lengthy reconfiguration of the capture render pipeline", so set it before `startRunning()`. The settings have their own `isConstantColorEnabled`: "Throws an exception if -[AVCapturePhotoOutput constantColorEnabled] is not set to YES."
- [H] `constantColorFallbackPhotoDeliveryEnabled` (settings): "Default is NO. Set to YES if you wish to receive a fallback photo that can be used in case the main constant color photo's confidence level is too low for your use case." The fallback photo is one more call of `didFinishProcessingPhoto`; check `photo.isConstantColorFallbackPhoto`. `constantColorCenterWeightedMeanConfidenceLevel` and `constantColorConfidenceMap` tell how good the result is.
- The app has no flash control [A]. So constant color needs a flash mode first. Recommendation: do not put it in the RAW chapter. Or keep it as a short separate note, with the rule that choosing it sets the RAW control to Off.

### Photo quality and `photoQualityPrioritization`

- [H] Default for the settings is `.balanced`. Default for the output's `maxPhotoQualityPrioritization` is `.balanced` on a normal session.
- Bayer: force `.speed` for that capture (the whole request, so the processed HEIF also gets `.speed`). ProRAW: keep the user's choice. SUPERSEDED by G and H: no setter for any RAW request.
- [H] Fast capture prioritization lowers the quality on rapid shots. It is not said how it treats a RAW request. See `research/09-fast-capture.md`.

## How the tutorial app will use it (chapter 8)

All names are suggestions for the code agent. The base is branch `chapter-07`.

**`Model/DataTypes.swift`**
- New enum `RAWFormat: Int, Identifiable, CaseIterable, CustomStringConvertible, Codable` with cases `off`, `proRAW`, `bayer`. Same style as `QualityPrioritization`: no AVFoundation type in the model.
- `PhotoFeatures` gets `let rawFormat: RAWFormat`. (The plan said `isRAWEnabled`; a three-way choice needs the enum.)
- `Photo` gets `let rawData: Data?` (the DNG). Alternative: `rawFileURL: URL?`, see the save options.
- `CaptureCapabilities` gets `isProRAWSupported` and `isBayerRAWSupported` (both default false), and the initializer parameters.
- `CaptureActivity` needs no change.

**`Capture/PhotoCapture.swift`**
- `updateConfiguration(for:)`: first `photoOutput.isAppleProRAWEnabled = photoOutput.isAppleProRAWSupported` (before the first `startRunning()`; `setUpSession()` calls it before that [A]). Then read `availableRawPhotoPixelFormatTypes`.
- `updateCapabilities(for:)`: `isProRAWSupported = formats.contains(where: AVCapturePhotoOutput.isAppleProRAWPixelFormat)` and `isBayerRAWSupported` with the Bayer test.
- A private helper `rawPixelFormat(for: RAWFormat) -> OSType?` that returns the first matching format, or nil.
- `createPhotoSettings(with:)`: build the processed format first (`[AVVideoCodecKey: AVVideoCodecType.hevc]` when `.hevc` is available, else `.jpeg`; the JPEG case matters for the Simulator). If `features.rawFormat != .off` and `rawPixelFormat(for:)` returns a value, create `AVCapturePhotoSettings(rawPixelFormatType:processedFormat:)` instead of `AVCapturePhotoSettings(format:)`. The rest of the method stays: preview format, `maxPhotoDimensions`.
  - Set `livePhotoMovieFileURL = nil` when RAW is on (a rule for ProRAW; do the same for Bayer to keep it simple, a choice for the code agent).
  - For `.bayer` set `photoQualityPrioritization = .speed`. Otherwise use the user's choice.
  - Option for ProRAW-only: `rawEmbeddedThumbnailPhotoFormat = [AVVideoCodecKey: first of availableRawEmbeddedThumbnailPhotoCodecTypes, AVVideoWidthKey/HeightKey: settings.maxPhotoDimensions]` (see save option C).
- `PhotoCaptureDelegate`: add `private var rawData: Data?`. In `didFinishProcessingPhoto`: `if photo.isRawPhoto { rawData = photo.fileDataRepresentation() } else { photoData = photo.fileDataRepresentation() }`. Today the method sets `photoData` for any photo, so without this change the RAW call would overwrite the HEIF. In `didFinishCaptureFor`: pass `rawData` into `Photo`. In `willBeginCaptureFor`: log `resolvedSettings.rawPhotoDimensions` and `expectedPhotoCount`.
- Keep the `photoData == nil` guard. For a RAW-only fallback decide: with RAW but no processed photo, the guard throws `noPhotoData`.
- Call `photoOutput.setPreparedPhotoSettingsArray(_:completionHandler:)` when the user picks a RAW mode (header: RAW "require[s] the receiver to allocate additional buffers"). Optional.

**`CameraModel.swift`, `Model/Camera.swift`, `Preview Content/PreviewCameraModel.swift`**
- `var rawFormat = RAWFormat.off` in the `Camera` protocol (get/set), `CameraModel`, and `PreviewCameraModel`.
- `capturePhoto()`: `PhotoFeatures(isLivePhotoEnabled:..., qualityPrioritization:..., rawFormat: rawFormat)`.
- `captureCapabilities` already flows from `CaptureService` to the model; add the two flags to what the toolbar reads. (`CameraModel` does not expose capabilities in chapter 7; the code agent adds `var captureCapabilities` to the `Camera` protocol if it is missing.)
- When the capabilities change (camera switch) and the chosen `rawFormat` is no longer supported, reset it to `.off`.

**`Views/Toolbars/FeatureToolbar/FeatureToolbar.swift`**
- New `rawPicker` next to `prioritizePicker`: a `Menu` with a `Picker("RAW", selection: $camera.rawFormat)`; show "Apple ProRAW" only if `isProRAWSupported`, "RAW" only if `isBayerRAWSupported`; hide the whole menu when both are false. Icons: `r.square` (off) and `r.square.fill` (on). Not `camera.raw` (does not exist).
- Live Photo button: show it as off while RAW is on, or let RAW win silently. A small UI choice.

**`Model/MediaLibrary.swift`**
- `save(photo:)`: after the main resource, add the DNG (see options). Keep `creationRequest.location`. Keep the `.pairedVideo` block (nil when RAW is on).
- Before saving, `PHAssetCreationRequest.supportsAssetResourceTypes([.photo, .alternatePhoto])` [H] tells if the combination is valid. For a proxy, test `[.photoProxy, .alternatePhoto]`. (The header says adding resources always succeeds and errors come later, in the completion handler.)

## What the Simulator supports (inference)

Facts: SimCam delivers 640 x 480 JPEG stills, no HEIC, no Live Photo, no orientation metadata [S]. `notes/chapter-07.md` says responsive capture and deferred delivery did not work.

Inference, not tested:
- No RAW capture. The virtual SimCam camera is not an Apple built-in camera with the image pipeline. The header on the old DNG helper says "Only RAW images from Apple built-in cameras are supported." [H] I expect `isAppleProRAWSupported == false` and `availableRawPhotoPixelFormatTypes` empty. The RAW control is then hidden. This is the "fallback path" of the plan.
- `availablePhotoCodecTypes` probably has no `.hevc`. The existing `if ... contains(.hevc)` branch already covers that. The new RAW branch is never taken.
- What the Simulator can show: the toolbar with the RAW control hidden; capture and save unchanged with the RAW control absent. A preview with a forced capability value (`PreviewCameraModel`) can show the menu.
- What may be testable without a sensor: the Photos save. Put a small sample DNG in a debug path and call `MediaLibrary.save` with a fake `Photo`. Then read the asset back with `PHAssetResource.assetResources(for:)` and check the resource types. Photos works in the Simulator [S]. Whether the Simulator's Photos accepts a DNG as `.alternatePhoto` is unknown.
- A real iPhone with a Pro model is needed for: the RAW menu, the DNG file, the size and dimensions, the delegate order, the proxy question, and the badge in Photos.

## Saving the DNG: options for the user to decide

All three use `PHAssetCreationRequest` in one `performChanges` block.

**Option A, one asset, HEIF is the photo, DNG is the alternate (the plan).**
`addResource(with: .photo, data: heif)` and `addResource(with: .alternatePhoto, ...dng)`. Optional (iOS 27): `creationRequest.originalResourceChoice = .raw` makes the DNG the base for edits; without it the compressed resource is the base [H].
- For: one tile in the grid. The picture is easy to share. Matches the iOS 27 header model ("RAW+JPEG assets"). Live Photo and a proxy might still pair with it (not tested).
- Against: Apple says this model is "not recommended for Apple ProRAW" [W]. Apple's article orders the resources the other way [D]. Bigger library footprint. A proxy plus an alternate is untested.
- Data note: for the DNG use a file URL with the `.dng` extension and `shouldMoveFile = true`, or set `contentType` and `originalFilename` in the options [H]. With plain `Data` the type is inferred "from the PHAssetResourceType", which would be wrong for a DNG as `.alternatePhoto`.

**Option B, two separate assets.**
Two `PHAssetCreationRequest` objects in one `performChanges` block: the HEIF (with Live Photo and proxy handling as today) and the DNG as its own `.photo`.
- For: simplest and safest. No resource-order question. Works with a proxy. Needs no iOS 27 API.
- Against: two tiles per shot. No link between them. Apple calls multiple assets "harder to keep track of in the photo library" [W]. The thumbnail code must pick one asset.

**Option C, one asset, DNG only, with an embedded full-size JPEG preview (Apple's advice for ProRAW).**
`AVCapturePhotoSettings(rawPixelFormatType:)` or with a processed format but save only the DNG as `.photo`; set `rawEmbeddedThumbnailPhotoFormat` to a JPEG at full size [H][W]. No HEIF is saved. Sketch: `shouldMoveFile` with a DNG URL as in Apple's article.
- For: Apple's recommended model. One asset. One file. Photos and other apps show the embedded preview. No pairing question. Smallest library footprint.
- Against: no HEIF to share. The app's Live Photo and deferred processing do not apply to that shot. It changes the plan (no pair). For Bayer RAW the preview can be small and low value (the full-size claim is for DNG in general [H], tested only for ProRAW in the session [W]).

My lean, for the user to confirm: A as planned if the goal is "what the system camera does"; C if the goal is "what Apple teaches for ProRAW". B only as a fallback if A fails the device check. The coordinator should not pick; the page text differs a lot between A and C.

## Open items for the device check (phase 6)

1. Does a RAW+HEIF request with deferred delivery on give a proxy or a normal photo for the HEIF? Answered [T] 16 Oct 2026: no RAW photo arrived, Photos got a HEIF. Deferred delivery is now off for RAW.
2. `rawPhotoDimensions` for ProRAW with the largest `maxPhotoDimensions`; file size.
3. Does Photos show a RAW badge for option A? Which resource does Photos show first?
4. Do normal photos keep their speed (zero shutter lag, responsive capture) after `isAppleProRAWEnabled = true`? (It reconfigures the pipeline.)
5. Is Bayer RAW listed with ProRAW enabled on the tester's iPhone? On which camera? Answered in part [T]: not on the virtual back camera. Front camera unknown.
6. What does the app do if the user zooms (Bayer rule)? Chapter 7 has no zoom control [A]; later chapters may add one.

## Verified links

HTTP 200 on 15 Oct 2026 for the JSON endpoint `https://developer.apple.com/tutorials/data/documentation/<path>.json`.

| Title | URL |
|---|---|
| Capturing photos in RAW and Apple ProRAW formats (article) | https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats |
| AVCapturePhotoOutput | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput |
| isAppleProRAWSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported |
| isAppleProRAWEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawenabled |
| availableRawPhotoPixelFormatTypes (Swift) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotopixelformattypes-9t9k5 |
| availableRawPhotoPixelFormatTypes (Objective-C) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotopixelformattypes-5fatm |
| isBayerRAWPixelFormat(_:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isbayerrawpixelformat(_:) |
| isAppleProRAWPixelFormat(_:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawpixelformat(_:) |
| availableRawPhotoFileTypes | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/availablerawphotofiletypes |
| maxPhotoDimensions (output) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotodimensions |
| maxPhotoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/maxphotoqualityprioritization |
| capturePhoto(with:delegate:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/capturephoto(with:delegate:) |
| preparedPhotoSettingsArray | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/preparedphotosettingsarray |
| setPreparedPhotoSettingsArray(_:completionHandler:) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/setpreparedphotosettingsarray(_:completionhandler:) |
| isConstantColorSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorsupported |
| isConstantColorEnabled (output) | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isconstantcolorenabled |
| AVCapturePhotoSettings init(rawPixelFormatType:processedFormat:) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init(rawpixelformattype:processedformat:) |
| rawPhotoPixelFormatType | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/rawphotopixelformattype |
| photoQualityPrioritization | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/photoqualityprioritization |
| maxPhotoDimensions (settings) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/maxphotodimensions |
| isConstantColorEnabled (settings) | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/isconstantcolorenabled |
| isConstantColorFallbackPhotoDeliveryEnabled | https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/isconstantcolorfallbackphotodeliveryenabled |
| AVCapturePhoto | https://developer.apple.com/documentation/avfoundation/avcapturephoto |
| isRawPhoto | https://developer.apple.com/documentation/avfoundation/avcapturephoto/israwphoto |
| fileDataRepresentation() | https://developer.apple.com/documentation/avfoundation/avcapturephoto/filedatarepresentation() |
| isConstantColorFallbackPhoto | https://developer.apple.com/documentation/avfoundation/avcapturephoto/isconstantcolorfallbackphoto |
| AVCapturePhotoCaptureDelegate | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate |
| photoOutput(_:didFinishProcessingPhoto:error:) | https://developer.apple.com/documentation/avfoundation/avcapturephotocapturedelegate/photooutput(_:didfinishprocessingphoto:error:) |
| AVCaptureDeferredPhotoProxy | https://developer.apple.com/documentation/avfoundation/avcapturedeferredphotoproxy |
| supportedMaxPhotoDimensions | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/supportedmaxphotodimensions |
| PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest |
| forAsset() | https://developer.apple.com/documentation/photos/phassetcreationrequest/forasset() |
| addResource(with:data:options:) | https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:data:options:) |
| originalResourceChoice (creation request, iOS 27) | https://developer.apple.com/documentation/photos/phassetcreationrequest/originalresourcechoice |
| PHAssetResourceType | https://developer.apple.com/documentation/photos/phassetresourcetype |
| PHAssetResourceType.alternatePhoto | https://developer.apple.com/documentation/photos/phassetresourcetype/alternatephoto |
| PHAssetResourceCreationOptions | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions |
| shouldMoveFile | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile |
| originalFilename (options) | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/originalfilename |
| PHAssetResource | https://developer.apple.com/documentation/photos/phassetresource |
| WWDC21 session 10160, Capture and process ProRAW images | https://developer.apple.com/videos/play/wwdc2021/10160/ |
| WWDC21 session 10047, What's new in camera capture (not a ProRAW session) | https://developer.apple.com/videos/play/wwdc2021/10047/ |
| WWDC23 session 10105, Create a more responsive camera experience | https://developer.apple.com/videos/play/wwdc2023/10105/ |

Not verified (404 on the JSON endpoint): `avcapturephotooutput/availablerawphotopixelformattypes` without the suffix, `photos/phasset/originalresourcechoice`, and every path under `photokit/` (use `photos/`). The `PHAsset.originalResourceChoice` property is in the iOS 27 header only. Do not link it.
