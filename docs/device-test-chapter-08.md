# Device test: chapter 8 (Apple ProRAW), completed

Status: COMPLETED on 16 Oct 2026, round 7. One optional check remains (section 3).

## 1. Result of round 7

Device: iPhone 17 Pro Max, iOS 26. Build: `108eea6` (the request still had a processed photo; the save first tried the DNG alone).

- Back camera: "Back Dual Camera" (virtual). Front camera: "Front TrueDepth Camera". The front camera offers Apple ProRAW (`RAW on Front TrueDepth Camera ...: Apple ProRAW true`).
- On both cameras, with Apple ProRAW: `Resolved settings: 2 photos, ...`, `RAW preview: JPEG WxH`, `Resource .photo: N bytes, file <UUID>.dng`, `Saved asset <identifier>`, `Saved the RAW as the DNG alone`. The first request (the DNG alone as `.photo`, from a temporary `.dng` file with `shouldMoveFile`) saved both times. No fallback ran.
- Photos: one picture per capture, shown as RAW. Share > Options > Format: Unmodified Original ("Export Unmodified Original") gives the DNG. 12 MP (4032x3024) on the virtual camera. Round 6 gave 48 MP (8064x6048, 54 MB) on the physical telephoto camera.
- Earlier rounds: the pair (processed `.photo` from `Data`, DNG file `.alternatePhoto`) also saved (round 6, badge "JPG + RAW"). The pair with the DNG as `.photo` and the processed photo as `.alternatePhoto` gave 3300 `changeNotSupported` (rounds 4 and 5).
- With the chapter 9 build: after a RAW capture, the readiness went to `sessionNotRunning` and back to `ready`. The deferred delivery switch rebuilds the capture pipeline.

## 2. What changed after the test

The final commit `aae9ddf` keeps only the path that saved, and it drops the processed photo:

- The request is `AVCapturePhotoSettings(rawPixelFormatType:processedFormat: nil)`: the RAW photo alone, with the full-size embedded JPEG preview.
- `Photo.isRAW` marks that `Photo.data` holds the DNG.
- `MediaLibrary.save(rawData:location:)` has one request: the DNG alone as `.photo`. No pair, no fallback to the processed photo alone. A refused request logs `Saving to Photos failed: ... (code name)` and `Photo capture failed: ...`.

## 3. Optional check (about 5 minutes)

1. Update your checkout (your signing change in the project file stays). The branch `chapter-09` now points at `cd72e2c`, on the new `chapter-08` `aae9ddf`. In Terminal:
   ```sh
   cd ~/tutorials/AVCamTutorialApp
   git status --short
   ```
   If only ` M AVCam.xcodeproj/project.pbxproj` shows, go to step 2. If the five Swift files below show with `M ` in the first column, restore them from the new commit:
   ```sh
   git restore --source=HEAD --staged --worktree AVCam/CameraModel.swift AVCam/Capture/PhotoCapture.swift AVCam/Model/Camera.swift AVCam/Model/DataTypes.swift AVCam/Model/MediaLibrary.swift
   ```
   Do not use `git reset --hard`. It removes your signing change.
2. Run the app on the iPhone. Choose Apple ProRAW. Take a photo.
3. Expected lines: `Capturing with RAW format: Apple ProRAW`, `RAW file types: com.adobe.raw-image`, `RAW preview: JPEG WxH`, `Quality prioritization ...: ignored for RAW`, `Resolved settings: 1 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0 (the device reported the photo size although the request was RAW only)`, `Captured RAW photo, N bytes`, `RAW data: N bytes, header 4D 4D 00 2A, type com.adobe.raw-image, images N`, `Resource .photo: N bytes, file <UUID>.dng`, `Saved asset <identifier>`.
4. In Photos, open the new picture. Write down the text of the badge at the top left (for example `RAW`).

Send back: the `Resolved settings` line and the badge text. Only if a line is missing or `Saving to Photos failed` shows: all lines from `Capturing with RAW format` to the end.
