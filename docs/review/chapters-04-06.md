# Technical review: chapters 4, 5, and 6

Pages: `ch04-concepts.md`, `ch04-build.md`, `ch05-concepts.md`, `ch05-build.md`, `ch06-concepts.md`, `ch06-build.md`.
Date: 2026-10-01. SDK: `iPhoneOS27.1.sdk`. App branches: `chapter-04`, `chapter-05`, `chapter-06`.

About 190 claims were checked. The result is 5 WRONG findings and 5 UNSUPPORTED findings. No quiz question needed a new answer. One quiz explanation changed (finding 8).

Short names for the evidence:

- **D.h** = `AVFoundation.framework/Headers/AVCaptureDevice.h`
- **PL.h** = `.../AVCaptureVideoPreviewLayer.h`
- **S.h** = `.../AVCaptureSession.h`
- **IM.h** = `Photos.framework/Headers/PHImageManager.h`
- **PL-lib.h** = `Photos.framework/Headers/PHPhotoLibrary.h`
- **CR.h** = `Photos.framework/Headers/PHAssetCreationRequest.h`
- **LU.h** = `CoreLocation.framework/Headers/CLLocationUpdater.h`
- **Doc** = Apple documentation JSON, `https://developer.apple.com/tutorials/data/documentation/<path>.json`
- **Experiment** = a small Swift program in `scratchpad/review-b/` (`MediaLibrary.swift` + `stub.swift`, `ph.swift`, `cancel.swift`, `mk.swift`)

## Findings

| # | Page | Claim | Verdict | Evidence | Change |
|---|---|---|---|---|---|
| 1 | ch04-concepts, Things to know, "The change block writes to a captured variable" | "The strict concurrency checks of Swift 6 do not accept it." | WRONG | Experiment: `MediaLibrary.swift` of branch `chapter-04` plus a stub `Photo` type, `swiftc -emit-sil -swift-version 6` with the iPhoneOS 27.1 SDK. No error and no warning. `-swift-version 5 -strict-concurrency=complete` gives the same result. PL-lib.h:142: the change block is a plain `dispatch_block_t`, not a `@Sendable` closure. The claim came from dossier 02, section 9 (d), which has no evidence mark. | The text now says that the compiler accepts the code in Swift 5 mode, and that a test with Xcode 27.1 also accepted it in Swift 6 mode. |
| 2 | ch05-build, step "add an extension with the default implementations" | "You use `isCompactSize` in chapter 7." | WRONG | `git grep isCompactSize` in the app: branches `chapter-07` and `chapter-08` have only the definition. The first use is `chapter-09:AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift:68`. `ch09-build.md:592` also says so. | "chapter 9". |
| 3 | ch04-build, step `createThumbnail(for:)` | "`requestImage` returns immediately. The image arrives later in the closure." | WRONG in one case | IM.h:180: with the opportunistic delivery mode (the default), "resultHandler may be called synchronously on the calling thread if any image data is immediately available". Doc `photos/phimagemanager/requestimage(for:targetsize:contentmode:options:resulthandler:)`: "the first call may occur before the method returns". | The text now says that the method does not wait for the final image, that the closure usually runs later, and that the first call can occur before the method returns. |
| 4 | ch06-concepts, "The device owns the hardware settings" | "The lock protects the change. It does not hold the value." | WRONG (the last sentence) | D.h:276: "Clients should only hold the device lock if they require settable device properties to remain unchanged." D.h:286: unlock "when an application no longer needs to keep device hardware properties from changing automatically". D.h:1164: `.autoFocus` changes the mode to `.locked` by itself. | The last sentence is now: after the unlock, the system can change the value again, for example when a one-time focus operation is complete. |
| 5 | ch06-concepts, limits, "Errors of the automatic path are discarded" | "If the lock fails there, the camera stays locked on the tapped point until the next tap." | WRONG (incomplete) | `chapter-06:AVCam/CaptureService.swift`, `focusAndExpose(at:isUserInitiated:)`: when the lock fails, the line that sets `isSubjectAreaChangeMonitoringEnabled` does not run, so the monitor stays on. D.h:2022: with the monitor on, the device sends the notification "whenever it detects a change". The loop then calls the method again. | "until the next notification or the next tap". |
| 6 | ch05-concepts, capability table, row "Layer point to device point" | The method "includes the gravity, the rotation, and the mirroring in its calculation". | UNSUPPORTED (rotation is implied, mirroring is not stated) | PL.h:148 and Doc `avfoundation/avcapturevideopreviewlayer/capturedevicepointconverted(fromlayerpoint:)`: "The conversion takes frameSize and videoGravity into consideration", and the device point refers to "an unrotated picture". Only `transformedMetadataObject(for:)` (PL.h:208) names "orientation, mirroring". Dossier 01, section 5 (c) has the claim with no evidence mark. | The row now gives what the header says: frame size, gravity, and a point of the image that is not rotated. |
| 7 | ch06-concepts, "From a view point to a device point"; ch06-build, step "convert the view point" | "The preview layer knows all three operations, so it does the conversion for you." / "gives the correct device point in each situation". | UNSUPPORTED (same as finding 6) | Same as finding 6. | The two pages now say what the header says. They also say that the header does not mention the mirror state, and that the tutorial did not test a front camera. The list of the three operations on the video stays, because it only describes the preview. |
| 8 | ch06-build, quiz question 3, explanation of the correct answer | "`captureDevicePointConverted(fromLayerPoint:)` takes account of all three operations." | UNSUPPORTED (same as finding 6) | Same as finding 6. The marked answer is still the only correct one: Doc `avfoundation/avcapturedevice/focuspointofinterest` says that the coordinates are "always relative to a landscape device orientation". | "... does this conversion for you." |
| 9 | ch04-concepts, The location; ch04-build, step "set it on the creation request" | "It does not write GPS data into the image file." | UNSUPPORTED | Doc `photos/phassetchangerequest/location`: only "The location information saved with the asset." `PHAssetChangeRequest.h:57` has no comment. Dossier 02, section 9 (c) has the claim with no evidence mark. | The two pages now say that the location is a property of the asset, that it is probably not written into the file, and that the tutorial did not verify that. |
| 10 | ch04-concepts, Things to know, "Each save waits for a location" | "The first photo also waits while the person answers the permission requests." | UNSUPPORTED for the location request | LU.h:139-145: `authorizationRequestInProgress` is "True if the system is requesting authorization from the user on behalf of the app, but no response has been received yet", and LU.h:147-153: `location` is nil if it is not available. So the first update can arrive during the alert, with no location. Then `first(where:)` returns, and the save continues. For the Photos request the claim is correct: the code awaits `requestAuthorization(for:)`. | The bullet now says "waits for a location update", keeps the claim for the Photos request, and says that the location request is not sure and was not tested. |
| 11 | ch04-concepts, The thumbnail; ch04-build, step `createThumbnail(for:)` | "The library does not load the full photo into the memory of your app." | UNSUPPORTED | Doc `requestImage(...)`: "Photos loads or generates an image of the asset at, or near, the size you specify." No source says what the framework holds in the memory of the app process. | "Your app gets a small image, not the full photo." |
| 12 | ch04-concepts, capability table, row "Change observer" | "This needs read access." | UNSUPPORTED | PL-lib.h:147 (`registerChangeObserver:`) has no statement about access. Only the new persistent observer has one (PL-lib.h:158, read-write). Dossier 02, section 9 (e) has the claim with no evidence mark. | "This is for an app that reads the library." |

Findings 6, 7, and 8 are one fact on three places, and findings 9 and 11 are each on two pages. Counted as facts: 5 WRONG and 5 UNSUPPORTED.

Not changed, but related: the diagram `content/images/ch06-point-of-interest.svg` has the label "rotation, crop, mirror" below the method name. The numbers in the diagram are correct (see below). The image files were not in the scope of this review.

## Important claims verified as correct

Chapter 4

- The two access levels and their keys. PL-lib.h:31-34 has `PHAccessLevelAddOnly` and `PHAccessLevelReadWrite` only. Doc `photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app`: "If your app only adds to the library, use the NSPhotoLibraryAddUsageDescription key. For all other cases, use NSPhotoLibraryUsageDescription." The same article: an access "without a valid usage description causes your app to crash".
- The sample declares only `NSPhotoLibraryUsageDescription` and asks for `.addOnly` (`chapter-04` project file, lines 248 and 284; `MediaLibrary.swift`). The note on the page says correctly that nobody tested this combination.
- Limited access belongs to the read-write level (PL-lib.h:28, the privacy article).
- A creation request is valid only in a change block, and `addResource` does not report bad data (CR.h:32 and CR.h:45).
- The placeholder has the identifier of the future asset (`PHAssetChangeRequest.h:34-36`).
- The target size is in pixels (IM.h:160). With the default options the result closure can run more than one time (IM.h:35 and IM.h:180).
- The picker runs in a different process and needs no permission (the privacy article, about `PHPickerViewController`).
- `requestWhenInUseAuthorization()` does not wait for the answer (`CLLocationManager.h:456-489`: the result comes through the delegate).
- Chapter 3 asks for a preview image (`chapter-04:AVCam/Capture/PhotoCapture.swift:61`), and no code reads it.
- `Photo` is `Sendable`, `CameraModel` is on the main actor, and `MediaLibrary` has no custom executor (app code).
- The build warning "variable 'placeholder' was written to, but never read" at the second checkpoint (Experiment `ph.swift`).
- The table rows for `.pairedVideo`, `.photoProxy`, `.alternatePhoto`, `shouldMoveFile`, `originalFilename`, and `contentType` (CR.h, `PhotosTypes.h:236-250`), and the chapters that they name (app branches `chapter-07`, `chapter-08`, `chapter-13`).
- The SimCam statements (`research/05-simcam.md`).

Chapter 5

- The default video gravity is `.resizeAspect`, and the three values fit, fill, and stretch (PL.h:123, `AVAnimation.h:27-46`).
- The two angles of the rotation coordinator: preview relative to the layer, capture relative to gravity (D.h:3122-3140). The coordinator is connected in chapters 2 and 3 (app code).
- `AVMakeRect(aspectRatio:insideRect:)` returns the largest rectangle with the ratio, in the center (Experiment `mk.swift`: a 9:16 ratio in 402 x 874 gives y = 79.67 and height 714.67).
- `View` is a main actor protocol (SwiftUICore interface, line 17750).
- The iPhone setting is `UIInterfaceOrientationPortrait`, and the iPad setting has four orientations (`chapter-05` project file, lines 252-253).
- The layout code: 740, 250, 44, 12, and 32 points, the two different size class tests, and `CameraView` does not read the size classes (app code).
- `isPreviewing`, `isEnabled` of the connection, `.previewOptimized`, and `videoRotationAngleRelative(toDeviceOrientation:)` for iOS 27 (PL.h:135, S.h:1007, D.h:3320, D.h:3149).

Chapter 6

- The point-of-interest example. Doc `avfoundation/avcapturedevice/focuspointofinterest`: (0,0) is the top left, (1,1) is the bottom right, "always relative to a landscape device orientation with the home button on the right". In portrait, the device origin is thus at the top right of the preview, and a tap near the top left is near the device point (0, 1), the bottom left of the sensor image. The numbers of the diagram agree: a tap at (90, 100) in 300 x 400 points gives (100/400, 1 - 90/300) = (0.25, 0.70).
- The `compactMap({ _ in true })` explanation. Doc `foundation/notificationcenter/notifications(named:object:)`: "Notification doesn't conform to Sendable", and it recommends `map` or `compactMap` to get sendable values. The Foundation interface marks the `Sendable` conformance of `Notification` as unavailable.
- The notification loop ends when the task is cancelled (Experiment `cancel.swift`).
- The lock rules and the Objective-C exceptions: `NSGenericException` without the lock, `NSInvalidArgumentException` or `NSRangeException` for a value that is not supported (D.h:276, D.h:1228, D.h:1248, D.h:1373).
- The three modes, the one-time modes that change to `.locked`, and the fourth exposure mode (D.h:1161-1171, D.h:1425-1438, D.h:1781-1785).
- "Point first, mode second" (D.h:1248 and the documentation of the two properties).
- The subject area monitor and its notification (D.h:49, D.h:2022).
- A new format sets the points of interest and the frame durations back to their defaults (D.h:1264, D.h:400-403).
- Custom exposure and the photo quality prioritization (D.h:1466, D.h:1646).
- All rows of the capability lists that have an API name: availability (iOS 26 and iOS 27 items), ranges, and Swift names (D.h, S.h:1282, `AVFoundation.apinotes`).
- The tap location is in the local coordinates of the view with the modifier (`onTapGesture(count:coordinateSpace:perform:)` has the default `.local`, SwiftUI interface line 30694).
- The task in `observeSubjectAreaChanges(of:)` starts in the actor, and the actor uses the session queue as its executor (`CaptureService.swift:45-49`).

## Claims that could not be checked either way

- What iOS does with `.addOnly` access and only `NSPhotoLibraryUsageDescription`, and if the fetch and the thumbnail work with add-only access on an iPhone. The pages already say that this was not tested.
- The order of the two permission alerts at the first photo (ch04-build, last step of "Save each photo from the model"). The code sends the location request first. Nobody looked at the alerts.
- "By default, the system mirrors the preview of the front camera" (ch05-concepts table). S.h:1060 says only "For some session configurations, video data flowing through the connection will be mirrored by default". Dossier 01 has the claim with no evidence mark. The text stays.
- "The front camera of many devices has a lens with a fixed focus" (ch06). No header names the devices. The text stays, because it says "many".
- "It copies the Camera app" and the "AE/AF lock" of the Camera app (ch06-concepts). No Apple source in the dossiers describes the behavior of the Camera app.
- The sensor ratio 4:3 and "a video format usually has the ratio 16:9" (ch05). Dossier 01 line 141 says the same with no evidence mark. The preset header says only "full resolution photo quality output".
- The size class table for iPad windows (ch05-concepts). It is the documented convention, but nothing was run on an iPad.
- All behavior on a real device: rotation with a locked interface, focus and exposure after a tap, and the conversion for a mirrored front camera.
- The Xcode interface texts ("Info.plist Values" group, the menu names). Xcode was not opened.
