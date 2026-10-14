# Multi-camera capture: research (14 Oct 2026)

Sources: Apple documentation fetched from the JSON endpoint [D], Apple's sample "AVMultiCamPiP: Capturing from multiple cameras" at `~/tutorials/AVMultiCamPiPCapturingFromMultipleCameras` [S], and tests in the iPhone 18 Pro simulator (iOS 27.0) with SimCam [T]. Nothing was tested on a real iPhone.

## What the API is

- [D] `AVCaptureMultiCamSession` is a subclass of `AVCaptureSession`. It can run more than one input of the same media type at the same time (two cameras, or two microphones). A plain `AVCaptureSession` rejects a second camera input.
- [D] `AVCaptureMultiCamSession.isMultiCamSupported` (class property) tells whether the device can run it. Multi-camera capture needs the A12 chip or later. In the Simulator it returns true with SimCam [T].
- [D] `AVCaptureDevice.DiscoverySession.supportedMultiCamDeviceSets` lists the sets of cameras that can run together. Not every pair works (for example two cameras of the same position can be limited).
- [D] `AVCaptureDevice.Format.isMultiCamSupported`: only some formats of a camera work in a multi-camera session. The app must set an `activeFormat` that supports it, else the session cannot add the input. The session presets do not apply; a multi-camera session uses the `inputPriority` preset.
- [D] Costs: `hardwareCost` is the part of the hardware budget (sensors, ISP bandwidth) that the configuration uses. `systemPressureCost` is the thermal and power load. Both are floats; above 1.0 the session cannot run (hardware) or the device overheats soon (system pressure). Lower a cost with a smaller format, a lower frame rate, or fewer video ports [S].

## Connections by hand

- [D] `addInputWithNoConnections(_:)` and `addOutputWithNoConnections(_:)` add an input or an output without automatic connections. A plain `addInput` connects the new camera to every output that accepts video, which is not what a multi-camera app wants.
- [D] `AVCaptureInput.ports(for:sourceDeviceType:sourceDevicePosition:)` returns the ports of an input for one media type, device type, and position. The video port of a camera input carries its frames. (Documentation JSON for this method returned 404 on 14 Oct 2026; the method exists in the SDK and the sample uses it [S].)
- [D] `AVCaptureVideoPreviewLayer.setSessionWithNoConnection(_:)` gives the layer its session without connecting it. Then `AVCaptureConnection(inputPort:videoPreviewLayer:)` connects one port to the layer. For an output, `AVCaptureConnection(inputPorts:output:)`.
- [D] `canAddConnection(_:)` and `addConnection(_:)` check and add the connection.
- [T] A connection that the app creates gets no automatic mirroring and no rotation. The front preview is not mirrored, and the back preview was mirrored in a first test (the layer had an old automatic setting). Set `automaticallyAdjustsVideoMirroring = false`, then `isVideoMirrored` per camera, and `videoRotationAngle` from a `RotationCoordinator`.

## What Apple's sample does [S]

- One `AVCaptureMultiCamSession`, two camera inputs, two `AVCaptureVideoDataOutput`s, one microphone input with two `AVCaptureAudioDataOutput`s (one per camera: front audio is for the front camera, back audio is for the back camera, selected with the ports of the microphone input by position).
- Two preview layers, each connected to its camera port.
- A Metal mixer (`PiPVideoMixer`, `PiPMixer.metal`) draws the picture-in-picture frame into the full-screen frame. A `MovieRecorder` writes the mixed frames and the audio with `AVAssetWriter`. The movie is saved with `PHPhotoLibrary`.
- `checkSystemCost()` reduces the resolution, the frame rate, or the number of video ports when a cost exceeds 1.0. `systemPressureState` observation lowers the frame rate under pressure.
- A session with two cameras must not start on the main queue, because `startRunning()` blocks.

## Decisions in the tutorial app (chapter 17)

- A second session object `MultiCamCapture` beside the single `AVCaptureSession`, not a replacement. Reason: the photo and video modes keep their outputs and their deferred start; a multi-camera session cannot use session presets, and two sessions cannot run at the same time, so the app stops one before it starts the other.
- The dual mode is a third `CaptureMode` case. The mode picker hides it when `isMultiCamSupported` is false. A stored dual mode falls back to photo on a device without support.
- Format selection: the largest multi-camera format up to 1920 pixels wide, with the highest frame rate at that width. This keeps the hardware cost low; the sample uses the same idea in reverse (reduce until the cost fits).
- The single `CameraPreview` stays in the view tree in every mode, because `CaptureService` needs its preview connection at setup. The dual preview is an overlay.
- Costs are logged after start (hardware and system pressure). The chapter does not react to them; the concept page explains them.

## Measurements in the simulator with SimCam [T]

- `isMultiCamSupported` is true. Two camera inputs run at the same time; a probe got 71 frames in 3 seconds from each camera.
- The second preview can take up to 20 seconds to show frames after the first one. Terminate and relaunch the app if a preview stays black: SimCam hooks in at launch.
- Costs logged: hardware 0, system pressure 0 (the Simulator reports nothing useful).
- `supportedMultiCamDeviceSets` was not checked in the Simulator.

## Verified links

| Title | URL |
|---|---|
| AVCaptureMultiCamSession | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession |
| isMultiCamSupported (session) | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/ismulticamsupported |
| hardwareCost | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/hardwarecost |
| systemPressureCost | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/systempressurecost |
| addInputWithNoConnections(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addinputwithnoconnections(_:) |
| addOutputWithNoConnections(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutputwithnoconnections(_:) |
| canAddConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddconnection(_:) |
| addConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addconnection(_:) |
| AVCaptureConnection(inputPort:videoPreviewLayer:) | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputport:videopreviewlayer:) |
| AVCaptureConnection(inputPorts:output:) | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputports:output:) |
| setSessionWithNoConnection(_:) | https://developer.apple.com/documentation/avfoundation/avcapturevideopreviewlayer/setsessionwithnoconnection(_:) |
| Format.isMultiCamSupported | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/ismulticamsupported |
| supportedMultiCamDeviceSets | https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/supportedmulticamdevicesets |
| automaticallyAdjustsVideoMirroring | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyadjustsvideomirroring |
| isVideoMirrored | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored |
| startRunning() | https://developer.apple.com/documentation/avfoundation/avcapturesession/startrunning() |
| AVCaptureVideoDataOutput | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput |
| AVCaptureAudioDataOutput | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput |
| AVAssetWriter | https://developer.apple.com/documentation/avfoundation/avassetwriter |
| AVMultiCamPiP sample | https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras |
| WWDC19 session 225, Introducing Multi-Camera Capture for iOS | https://developer.apple.com/videos/play/wwdc2019/225/ |

Not verified (404): `avcaptureinput/ports(for:sourcedevicetype:sourcedeviceposition:)`. Do not link it.
