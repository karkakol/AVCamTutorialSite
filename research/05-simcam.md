# SimCam in the iOS Simulator: what works

Tested on 1 Oct 2026 with the unmodified Apple AVCam sample, iPhone 18 Pro simulator (iOS 27.0), Xcode 27.1, SimCam 1.0.

SimCam (https://simcam.swmansion.com/) injects a virtual camera into apps in the Simulator. No code changes are needed. The menu bar app must be running. CLI: `/Applications/SimCam.app/Contents/MacOS/simcamctl` (`help`, `diagnostics`, `set-source`).

## Sources

The user set two looping videos as sources and wants to keep them: `~/Desktop/back.MOV` for the back camera and `~/Desktop/front.MOV` for the front camera. Do not change the source.

`tools/simcam/back.png` and `front.png` are test patterns that were used for the first test only (`python3 tools/simcam/make_patterns.py` creates them again).

## Results

| Feature | Result in Simulator with SimCam |
|---|---|
| Camera permission prompt, `AVCaptureSession` start | Works. |
| `AVCaptureVideoPreviewLayer` live preview | Works. For about 2 seconds after launch the preview shows the text "Waiting for SimCam...". |
| Device discovery, back and front cameras, camera switch | Works. The front and back cameras show their own source. |
| `AVCapturePhotoOutput` photo capture | Works. The delegate callbacks arrive and the photo saves to Photos. The file is a 640 x 480 JPEG with no orientation metadata (not HEIC, not full resolution). |
| Photo orientation (rotation coordinator) | NOT reliable. The saved photo is landscape 640 x 480 while the phone is in portrait, so the thumbnail looks rotated by 90 degrees. Check rotation on a real iPhone. |
| Live Photo | NOT seen. A capture with Live Photo on produced only a JPEG, no paired movie. Treat as "needs a real iPhone". |
| Photos library save, thumbnail | Works. |
| Mode switch photo/video, `AVCaptureMovieFileOutput` recording | Works. A 4 second recording produced a 0.9 MB `.MOV` in the Photos library, and the recording timer ran. |
| HDR video, 10-bit formats, stabilization | Not tested. Expect "not supported" in the Simulator. |
| Camera Control, hardware button capture events, AirPods | Not available in the Simulator. Needs a real iPhone. |
| Lock Screen capture extension | Not tested. |

## Use in checks

- `xcrun simctl launch` is enough; SimCam loads by itself. `simcamctl diagnostics --device <udid>` must report "SimCam loaded" and "SimCam connected".
- Saved media appears in `~/Library/Developer/CoreSimulator/Devices/<udid>/data/Media/DCIM/100APPLE/`. Count the files before and after a capture to verify a save.
- Wait about 3 seconds after launch before a screenshot.
