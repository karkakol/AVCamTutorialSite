# RAW and Apple ProRAW: research (15 Oct 2026)

Sources: SDK headers of iPhoneOS 27.1 [H] (`AVCapturePhotoOutput.h`, `AVCaptureDevice.h`, `PHAssetCreationRequest.h`, `PHAssetResource.h`, `PhotosTypes.h`, `PHAsset.h`), Apple documentation from the JSON endpoint [D], the WWDC21 session 10160 transcript [W], the app code on branch `chapter-07` [A], and `research/05-simcam.md` and `notes/chapter-07.md` for the Simulator [S]. Nothing was run. Nothing was tested on a real iPhone.

## Surprises (read first)

1. **Apple advises against the plan's save model.** [W] WWDC21 session 10160 says the "RAW plus JPEG" model (JPEG as `.photo`, RAW as `.alternatePhoto`) "is not recommended for Apple ProRAW". It advises one DNG as the `.photo` resource, with a full-size JPEG preview embedded in the DNG (`rawEmbeddedThumbnailPhotoFormat`). The plan chose "HEIF as `.photo`, DNG as `.alternatePhoto`". See "Saving the DNG": there are three options, not two.
2. **Apple's own article uses the reverse order.** [D] "Capturing photos in RAW and Apple ProRAW formats" saves the DNG as `.photo` and the processed HEIF as `.alternatePhoto`. The `alternatePhoto` page says the opposite model: JPEG primary, RAW alternate. The iOS 27 headers follow the page [H]. The sources disagree. A real iPhone must settle it.
3. **There is no `rawFileDataRepresentation`.** [H] `AVCapturePhoto` has only `fileDataRepresentation()`. For a RAW photo it returns DNG data. Use `photo.isRawPhoto` to tell the two photos apart.
4. **Constant color and RAW exclude each other.** [H] "If rawPhotoPixelFormatType is non-zero, constantColorEnabled must be set to NO." The plan lists constant color as an option of the RAW chapter. It cannot combine with RAW in one request.
5. **Bayer RAW forces `.speed`.** [H] The app's default prioritization is `.quality` (chapter 7). A Bayer RAW request with `.quality` or `.balanced` throws `NSInvalidArgumentException`. The settings code must override the picker.
6. **The SF Symbol `camera.raw` does not exist.** [A] I checked `name_availability.plist` of this Mac's SF Symbols: no `camera.raw`, no `raw`. Use `r.square` and `r.square.fill` (2019), or `Text("RAW")`.
7. **WWDC21 10047 is the wrong session.** Its title is "What's new in camera capture". It does not teach ProRAW. The ProRAW session is WWDC21 10160, "Capture and process ProRAW images". Both pages return 200.
8. **New in the iOS 27 SDK.** [H] `PHAssetCreationRequest.originalResourceChoice` (`.compressed` or `.raw`) and `PHAsset.originalResourceChoice`. Both apply to RAW+compressed assets only. This is the first header sign that Photos models "RAW alternate" assets. The app targets iOS 27.0 [A], so these are usable. The `contentType` option of `PHAssetResourceCreationOptions` needs iOS 26.

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
- The header does not say what a RAW+HEIF request does when `isAutoDeferredPhotoDeliveryEnabled` is true (chapter 7 turns it on [A]). Two cases are possible: the processed photo arrives as a proxy, or it arrives as a normal photo. The delegate must handle both, and the save code must cope with a proxy plus a DNG. Test on a device. If the combination fails, the fallback is to set `isAutoDeferredPhotoDeliveryEnabled = false` while a RAW mode is chosen (a lengthy reconfiguration, so do it inside `beginConfiguration()` and `commitConfiguration()`).

### Constant color (not combinable with RAW)

- [H] iOS 18. `isConstantColorSupported` (output, read-only): "Constant color captures require the flash to be fired and may require pre-flash sequence ... it might take several seconds to acquire a constant color photo. ... a constant color capture can only be taken with AVCaptureFlashModeAuto or AVCaptureFlashModeOn as the flash mode, otherwise an exception is thrown." "Constant color should not be used in conjunction with locked or manual white balance." "When this property changes from YES to NO, constantColorEnabled also reverts to NO."
- [H] `isConstantColorEnabled` (output): "Default is NO. ... may only be set to YES if constantColorSupported is YES. Enabling constant color requires a lengthy reconfiguration of the capture render pipeline", so set it before `startRunning()`. The settings have their own `isConstantColorEnabled`: "Throws an exception if -[AVCapturePhotoOutput constantColorEnabled] is not set to YES."
- [H] `constantColorFallbackPhotoDeliveryEnabled` (settings): "Default is NO. Set to YES if you wish to receive a fallback photo that can be used in case the main constant color photo's confidence level is too low for your use case." The fallback photo is one more call of `didFinishProcessingPhoto`; check `photo.isConstantColorFallbackPhoto`. `constantColorCenterWeightedMeanConfidenceLevel` and `constantColorConfidenceMap` tell how good the result is.
- The app has no flash control [A]. So constant color needs a flash mode first. Recommendation: do not put it in the RAW chapter. Or keep it as a short separate note, with the rule that choosing it sets the RAW control to Off.

### Photo quality and `photoQualityPrioritization`

- [H] Default for the settings is `.balanced`. Default for the output's `maxPhotoQualityPrioritization` is `.balanced` on a normal session.
- Bayer: force `.speed` for that capture (the whole request, so the processed HEIF also gets `.speed`). ProRAW: keep the user's choice.
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

1. Does a RAW+HEIF request with deferred delivery on give a proxy or a normal photo for the HEIF?
2. `rawPhotoDimensions` for ProRAW with the largest `maxPhotoDimensions`; file size.
3. Does Photos show a RAW badge for option A? Which resource does Photos show first?
4. Do normal photos keep their speed (zero shutter lag, responsive capture) after `isAppleProRAWEnabled = true`? (It reconfigures the pipeline.)
5. Is Bayer RAW listed with ProRAW enabled on the tester's iPhone? On which camera?
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
