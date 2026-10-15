# Chapter 4 hand-off notes (code by the coordinator)

Branch `chapter-04`, start `chapter-03`. Full change: `git -C ../AVCamTutorialApp diff chapter-03 chapter-04`.

## Result and verification
- Build for the iPhone 18 Pro simulator succeeded, no warnings.
- Run with SimCam: a tap on the capture button saved a new JPEG in the Photos library of the simulator (the file count in `Media/DCIM/100APPLE` went from 8 to 9), and the thumbnail of the photo appeared in the left toolbar position. Verified with a screenshot.
- Not verified: the location tag (the simulator permission was granted with `simctl privacy`, the saved location was not inspected), the Photos permission alert, the photo picker that opens on a thumbnail tap.

## What the chapter adds
- `Model/MediaLibrary.swift`: the sample's actor without `save(movie:)` (chapter 10) and with a simpler `save(photo:)`: one `.photo` resource, no proxy, no paired video (chapter 7 adds those).
- Build settings (target AVCam, Info): `NSLocationWhenInUseUsageDescription` = "AVCam uses your location to tag where photos and videos are taken." and `NSPhotoLibraryUsageDescription` = "To save captured photos and videos." (Xcode names: "Privacy - Location When In Use Usage Description", "Privacy - Photo Library Usage Description"). These are in `project.pbxproj`, so list that file in `uncovered:` and use `settings` steps.
- `Camera`, `CameraModel`, `PreviewCameraModel`: `thumbnail`. `CameraModel`: `mediaLibrary`, the save call, the thumbnail task in `observeState()`.
- Views: `ThumbnailButton.swift` (sample without the `.disabled(...isRecording)` line), the `Image(CGImage)` extension in `ViewExtensions.swift`, `MainToolbar` (the placeholder is replaced by `ThumbnailButton`).

## Changes to earlier code
- `CameraModel.capturePhoto()`: the log line is replaced by `try await mediaLibrary.save(photo: photo)`.
- `MainToolbar`: the `Color.clear` placeholder is removed.
- Doc comments of `capturePhoto()` changed in `Camera` and `CameraModel`.

## Things to explain (research/02-photo-capture.md, section 9)
- The sample requests `.addOnly` access but declares `NSPhotoLibraryUsageDescription` (not the Add key), and then fetches the new asset for the thumbnail. The research could not verify the behaviour on a device.
- `PHAssetCreationRequest`, resource types, `performChanges`, the placeholder and the fetch, `PHImageManager` for the thumbnail, the `AsyncStream` of thumbnails.
- Location: `CLLocationManager`, `CLLocationUpdate.liveUpdates()`; `save` waits for the first location update, which delays the save.
