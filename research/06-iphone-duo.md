# iPhone Duo and camera direction: research (2 Oct 2026)

Sources: the iPhoneOS 27.1 SDK headers on this Mac [H], Apple documentation fetched from the JSON endpoint [D] (full text in `research/raw/duo-docs.txt`), and tests in the iPhone Duo simulator (iOS 27.1) with SimCam [S]. Nothing was tested on a real iPhone Duo.

## What the device is

- [D] iPhone Duo "has a display on each side and a camera above each one". Opening or closing the device moves an app to the other display. A camera that faced the same way as the interface can then face the opposite way.
- [H] New device types, iOS 27.1: `AVCaptureDevice.DeviceType.builtInOuterUltraWideCamera` and `.builtInInnerUltraWideCamera`. They can be found only with an `AVCaptureDevice.DiscoverySession`.
- [D] With the front position, the `.builtInWideAngleCamera` and `.builtInUltraWideCamera` types return a **virtual front camera** on iPhone Duo. It streams from the camera above the display that the app appears on, and follows the app when a person opens or closes the device. `isVirtualDevice` is true; `activePrimaryConstituent` tells which camera streams (nil until the session runs). Its capabilities are those that both cameras have in common. An app that uses the front camera works unchanged.
- [D] Apple's advice: start from the virtual front camera. Capture from the two physical cameras "when capture is your app's main job"; then the app must follow the direction itself with a coordinator.

## Direction against position

- [D] `AVCaptureDevice.position` is a fixed hardware property: where the camera sits. It is not the direction that the camera faces. "Two cameras that report different positions can face the same way."
- [D] Only `AVCaptureDeviceDirectionCoordinator` (AVKit, iOS 27.1) reports the direction, and it reports again after each change.
- [D] A rear camera can face forward. That is how a person takes a selfie with it.

## AVCaptureDeviceDirectionCoordinator [H][D]

- `init(view:deviceTypes:changeHandler:)`. Create it on the main actor only. The view is the frame of reference (the view that shows the preview). Hold a strong reference while the view is on screen.
- `deviceTypes`: list each built-in camera type that the app captures from, the rear cameras too. External, Continuity, and Desk View cameras have no effect. The coordinator leaves out the virtual front camera; list `.builtInOuterUltraWideCamera` and `.builtInInnerUltraWideCamera` in its place.
- The change handler runs on the main queue, soon after creation and after each change. Until the first call, `deviceDirections` is an empty map.
- `AVCaptureDeviceDirectionMap`: `forwardFacingDeviceDescriptors` (cameras that face the person who looks at the view) and `backwardFacingDeviceDescriptors` (cameras that face the scene). Either array can be empty.
- `AVCaptureDeviceDescriptor`: `Sendable`; `deviceType`, `mediaTypes`, `position`, `uniqueID`, `localizedName`. It identifies a camera; it does not reserve one. Resolve it with `AVCaptureDevice(uniqueID:)` on the capture actor, and handle a nil result.
- [D] "Don't call AVFoundation from the change handler. Pass the descriptor to the actor that owns your session."
- [D] One coordinator for each preview view. With previews on both displays, the same camera is forward facing for one and backward facing for the other.
- [D] On an iPhone with one display the coordinator also works: front cameras are forward facing, back cameras backward facing, cameras with an unspecified position are in neither array, and the handler runs one time. So one code path serves each iPhone.

## Apple's recommended handling [D]

1. Keep the active camera if it is still in the wanted array. If not, select a replacement from the array.
2. Reconfigure a single video input; do not use a multi-camera session for this.
3. Mask the preview during the change (frames of the old camera can still arrive).
4. Mirroring: a connection mirrors the preview of each camera whose position is front. When a rear camera faces forward, mirror the preview yourself; when a front camera faces backward, show it not mirrored. Set `automaticallyAdjustsVideoMirroring = false` before `isVideoMirrored` (else an exception), and check `isVideoMirroringSupported`. Do it again after each new input, because a new input makes a new preview connection.
5. Create a new `AVCaptureDevice.RotationCoordinator` after each camera change. On iPhone Duo the angle also changes when the app moves between the displays.

## Scene accessory for capture [H][D]

- `UISceneAccessory.cameraCapture(sceneConfiguration:)` (iOS 27.1) declares content that the system can present during camera capture, while the app is in the foreground with an active capture session. "The system determines whether and where to present it. The content can be interactive." Register it with `UIViewController.registerSceneAccessory(_:)`. The tutorial app does not use it (capability map only). What the system shows, and on which display, is not documented in the pages that were read.

## Measurements in the iPhone Duo simulator [S]

- Screen: 466 x 678 points (1398 x 2034 pixels, scale 3). The device idiom is phone. A second display of 720 x 480 pixels exists in the simulator.
- Size classes for the app: horizontal compact, vertical regular.
- Safe area insets for the app (status bar hidden): top 0, leading 0 (the value was -2.8e-14, floating-point noise), bottom 34, **trailing 84**. So the layout area is 382 x 644 points and sits at the leading side.
- The display mask has round corners at the trailing side only. In Safari, the time and the Wi-Fi symbol are drawn in the trailing area, one above the other. So the trailing inset is the status area of this display.
- Before chapter 16, the app (and the Apple sample) drew its interface in the 382 point wide area, with an empty band of 84 points at the trailing side.
- A layout that reads the insets in `onGeometryChange` and writes a state value made an endless layout loop on the iPhone 18 Pro simulator until the value was rounded. The inset values can differ by floating-point noise between layout passes.
- Direction coordinator with SimCam: the handler ran one time, before the session setup was complete, with forward = the front SimCam camera and backward = the back SimCam camera. A change of direction (open, close) was NOT tested: no way to fold the simulated device was used.
- SimCam cameras report `maxAvailableVideoZoomFactor` 0, `minAvailableVideoZoomFactor` 0, and `displayVideoZoomFactorMultiplier` 0. Setting `videoZoomFactor` to any value raises an exception there.

## Verified links

| Title | URL |
|---|---|
| Choosing a camera by the direction it faces | https://developer.apple.com/documentation/avkit/choosing-a-camera-by-the-direction-it-faces |
| AVCaptureDeviceDirectionCoordinator | https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator |
| init(view:deviceTypes:changeHandler:) | https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator/init(view:devicetypes:changehandler:) |
| AVCaptureDeviceDirectionMap | https://developer.apple.com/documentation/avkit/avcapturedevicedirectionmap |
| AVCaptureDeviceDescriptor | https://developer.apple.com/documentation/avkit/avcapturedevicedescriptor |
| builtInOuterUltraWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera |
| builtInInnerUltraWideCamera | https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtininnerultrawidecamera |
| UISceneAccessory | https://developer.apple.com/documentation/uikit/uisceneaccessory |
| cameraCapture(sceneConfiguration:) | https://developer.apple.com/documentation/uikit/uisceneaccessory/cameracapture(sceneconfiguration:) |
| registerSceneAccessory(_:) | https://developer.apple.com/documentation/uikit/uiviewcontroller/registersceneaccessory(_:) |

All ten returned HTTP 200 from the documentation JSON endpoint on 2 Oct 2026. For zoom links, use the verified links in `01-capture-pipeline.md`.
