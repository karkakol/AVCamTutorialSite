# Device test: chapter 8 (Apple ProRAW), round 7, the final code

Goal: test the final save of an Apple ProRAW capture. Time: about 10 minutes. You need the iPhone 17 Pro Max and Xcode.

What changed since round 6:

- The RAW menu now offers Off and Apple ProRAW only. Bayer RAW moves to chapter 16 (zoom and lenses), because it needs a single physical camera. The app uses the virtual back camera that the system prefers.
- Round 6 showed that Photos takes the pair: the processed photo as the main photo, and the DNG file as the alternate. Photos showed one picture with the badge "JPG + RAW". This result stands.
- The app now behaves like the Camera app. It first saves the DNG alone, with a full-size JPEG preview inside the DNG. This request has not run on a device yet.
- If Photos refuses the DNG alone, the app saves the pair of round 6. If Photos refuses the pair too, the app saves the processed photo alone.
- The app does not set the quality prioritization for a RAW capture. It logs "Quality prioritization ...: ignored for RAW".

## 1. Update your checkout

The branch `chapter-08` now points at the new commit `108eea6`. It is one commit on top of `chapter-07`. Your main checkout is still on `chapter-08`, but five of its files are the old version.

1. In Terminal, run:
   ```sh
   cd ~/tutorials/AVCamTutorialApp
   git status --short
   ```
   You expect these lines:
   ```
    M AVCam.xcodeproj/project.pbxproj
   M  AVCam/CameraModel.swift
   M  AVCam/Capture/PhotoCapture.swift
   M  AVCam/Model/DataTypes.swift
   M  "AVCam/Preview Content/PreviewCameraModel.swift"
   M  AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift
   ```
   If only the project file shows, your checkout is already up to date. Go to step 3. If other files show, stop and send the output.
2. Restore the five Swift files from the new commit. This does not touch the project file, so your signing team stays:
   ```sh
   git restore --source=HEAD --staged --worktree AVCam/CameraModel.swift AVCam/Capture/PhotoCapture.swift AVCam/Model/DataTypes.swift "AVCam/Preview Content/PreviewCameraModel.swift" AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift
   ```
3. Check:
   ```sh
   git status --short
   git log --oneline -2
   ```
   Only ` M AVCam.xcodeproj/project.pbxproj` shows. The log shows `108eea6 Chapter 8: RAW and Apple ProRAW capture` and below it `bcf64be Previews: ...` (chapter 7).
4. Do not use `git reset --hard`. It removes your signing change.

## 2. Prepare

1. Open `AVCam.xcodeproj`. Connect the iPhone. Choose it as the run destination.
2. Product > Run. Open the debug console (View > Debug Area > Activate Console). Clear the filter field.
3. Look at the first line that starts with `RAW on`. It names the camera and says whether it is virtual, for example `RAW on Back Triple Camera (virtual: true): Apple ProRAW true`. Any camera with `Apple ProRAW true` is fine for this test.

## 3. A normal photo first

1. Make sure the RAW menu (the `r.square` button) is on Off.
2. Take a photo. Expected: `Saved asset <identifier>`. Send the lines only if this line does not come.

## 4. Apple ProRAW

1. Choose Apple ProRAW in the RAW menu. The menu has two choices: Off and Apple ProRAW. The Live Photo button shows the symbol with a slash and does not react.
2. Take a photo. Wait 5 seconds.
3. Expected lines, in this order:
   - `Capturing with RAW format: Apple ProRAW`
   - `RAW file types: com.adobe.raw-image`
   - `RAW preview: JPEG 4032x3024` (or the size of your camera, for example 8064x6048)
   - `Quality prioritization Quality: ignored for RAW`
   - `Resolved settings: 2 photos, photo ..., RAW ..., proxy 0x0`
   - `Captured RAW photo, N bytes` and `Captured processed photo, N bytes`
   - `RAW data: N bytes, header 4D 4D 00 2A, type com.adobe.raw-image, images N`
   - `Resource .photo: N bytes, file <UUID>.dng`
4. Then one of three endings. This is the first check that is still open:
   - A, the DNG alone saved: `Saved asset <identifier>` and `Saved the RAW as the DNG alone`.
   - B, the pair saved: `Saving to Photos failed: ... (code name)`, `Photos refused the DNG alone. Saving the processed photo with the DNG as alternate.`, `Resource .photo: N bytes, type public.heic, images 1`, `Resource .alternatePhoto: N bytes, file <UUID>.dng`, `Saved asset <identifier>`, `Saved the RAW as the processed photo with the DNG as alternate`.
   - C, the processed photo alone: after the lines of B, a second `Saving to Photos failed: ...`, then `Saved asset <identifier>` and `Saved the processed photo without the RAW: ...`.
5. Check the newest picture in Photos:
   - Is it one picture (one tile)?
   - Which badge does it show (top left): `RAW`, `JPG + RAW`, or none?
   - Share > Options. Which choices does Format offer? Choose Unmodified Original (if it is there), save to Files. Which file comes out (`.DNG`, `.HEIC`, or both)? What is its size?
   - Swipe up on the picture. What does the info panel show (for example "Apple ProRAW", the size, the camera)?
   - Does the picture look sharp at full zoom? (This shows whether Photos shows the full-size preview.)

## 5. The front camera

1. Choose Off in the RAW menu. Tap the switch camera button (two arrows in a circle) to use the front camera.
2. Look at the new `RAW on ...` line. It names the front camera and says whether it offers Apple ProRAW. This is the second check that is still open.
3. If the line says `Apple ProRAW true`, the RAW menu shows, and you can repeat section 4 with the front camera. If it says `false`, the RAW menu is hidden.
4. Switch back to the back camera.

## 6. Back to Off

1. Make sure the RAW menu is on Off. The Live Photo button works again and shows your old choice.
2. Take a photo. Expected: `Saved asset <identifier>`.

## 7. What to send back

- Section 4: all lines from `Capturing with RAW format` to the last `Saved ...` line, with the full `UserInfo={...}` part of each error.
- Section 4, step 5: the answers about Photos.
- The `RAW on ...` line of section 2 (back camera) and of section 5 (front camera).

The line that decides this round: `Saved the RAW as the DNG alone` (the Camera app model works), or `Saved the RAW as the processed photo with the DNG as alternate` (only the pair works).
