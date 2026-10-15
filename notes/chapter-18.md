# Chapter 18 hand-off notes: iPhone Duo (code by the coordinator)

Branch `chapter-18`, start `chapter-17`. Full change: `git -C ../AVCamTutorialApp diff chapter-17 chapter-18` (about 160 added lines; the branch has two commits). NOT in the Apple sample. Read `research/06-iphone-duo.md` first: it has the Apple documentation summary, the simulator measurements, and the verified links. The full text of Apple's article "Choosing a camera by the direction it faces" is in `research/raw/duo-docs.txt`; the code follows that article, adapted to the structure of this app. Do not copy Apple's text.

## Result and verification
- Build succeeded with no warnings, for the iPhone 18 Pro simulator (iOS 27.0) and the iPhone Duo simulator (iOS 27.1).
- Layout, verified in the Duo simulator: before, the interface sat at the leading side with an empty band of 84 points at the trailing side. Now the preview and the controls are in the center of the display (measured margins: 126 and 128 pixels of 1398).
- Layout on iPhone 18 Pro: unchanged. The first version of the layout code made the app hang at launch there (an endless layout loop); rounding the measured value fixed it. Tell this story on the page: it is a real trap with `onGeometryChange` plus state.
- Direction coordinator, verified in the Duo simulator: the change handler ran and reported the front SimCam camera as forward facing and the back SimCam camera as backward facing. On iOS 27.0 (iPhone 18 Pro simulator) the code path is skipped by the availability check.
- NOT verified: a change of direction (open or close the device), the camera change that follows it, the mirroring, the new ultra-wide device types, and anything on a real iPhone Duo.

## What the chapter adds
- `DataTypes`: `CameraDirections` (`forwardFacing`, `backwardFacing`: unique identifiers; `Sendable`).
- `DeviceLookup`: `builtInCameraTypes` (static, with the two iOS 27.1 types behind `#available`), `camera(withUniqueIDIn:)`.
- `CameraPreview`: `import AVKit`; `directionsHandler` and the new initializer parameter `onDirectionsChange`; `PreviewView.directionCoordinator` (type `AnyObject`, because the class needs iOS 27.1) and `observeCameraDirections(with:)` (availability check, coordinator creation, map to `CameraDirections`).
- `CameraView`: the trailing closure of `CameraPreview` that calls `camera.setCameraDirections`; `sideInsetDifference`; the three layout modifiers after the `ZStack` (`padding`, `ignoresSafeArea`, `onGeometryChange` with `.rounded()`).
- `Camera`, `CameraModel`, `PreviewCameraModel`: `setCameraDirections(_:)`.
- `CaptureService`: `cameraDirections`, `isForwardFacingCameraSelected`; `setCameraDirections(_:)`; `applyCameraDirections()` (called also at the end of `setUpSession()`, because the first report arrives before the setup is complete); `updatePreviewMirroring()` (also called in `changeCaptureDevice(to:)`); one line in `selectNextVideoDevice()` that stores the selected direction.

## Design decisions to explain
- The app keeps the deployment target iOS 26.0, so each use of the new API is behind `#available(iOS 27.1, *)`. The rest of the app works with a plain value type, `CameraDirections`, so that the protocol and the model need no availability marks.
- The coordinator lives in `PreviewView`, on the main actor, because the view is its frame of reference. Only identifiers go to the capture actor, where `AVCaptureDevice(uniqueID:)` resolves them.
- The app follows a direction only for cameras that are in the map. An external camera and the virtual front camera are in neither array, so the app leaves them alone (the system moves the virtual front camera by itself).
- The front discovery session still returns the virtual front camera on iPhone Duo (per Apple's article), so the selfie camera works with no change. The coordinator matters when a rear camera turns toward the person, or a selected camera turns away.
- Mirroring follows Apple's rule: take over only when position and direction disagree.
- Layout: the trailing safe area inset of the Duo display is its status area. The app hides the status bar, so it uses the full width and gives both sides the same space.
- Not done, list as ideas: capture from the two physical front cameras for their full capabilities; mask the preview during a direction change (the existing blur during a switch runs only for a button tap); the camera capture scene accessory; mirroring of captured media.

## Page plan
- Concepts (about 14 minutes): position against direction, with a diagram of the device in two configurations; the virtual front camera; the coordinator, the map, the descriptor; mirroring; rotation on a device with two displays; the Duo display and its safe area (with a diagram of the measured insets); availability checks; capability map (scene accessory, physical front cameras); what was and was not verified.
- Build (about 45 minutes, about 35 steps): sections for the layout fix, the directions value type and device lookup, the coordinator in the preview view, the path through the model, the capture service logic, mirroring. Checkpoints: the layout section can be checked in the iPhone Duo simulator; the direction sections only build.
