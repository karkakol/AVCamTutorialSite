# Device test: chapter 8 (RAW), round 3, after the save fix of 16 Oct 2026

Goal: check that a RAW capture now reaches Photos. If it does not, get the error text from Photos. Time: about 10 minutes. You need the iPhone with the "Back Triple Camera" and Xcode.

What changed since round 2: the app saves the processed photo as the main photo and the DNG as its RAW alternate (the order of the Apple documentation). It also logs the processed photo, the saved asset, and every error. Round 2 showed that the capture works (2 photos, a 14 MB DNG) but that nothing reached Photos, with no log line that told why.

## 1. Update your checkout

The branch `chapter-08` now points at the new commit `87747f2`. Your main checkout is still on `chapter-08`, but its files can be the old version. Then Git shows three files as changed, plus your signing change in the project file.

1. In Terminal, run:
   ```sh
   cd ~/tutorials/AVCamTutorialApp
   git status --short
   ```
   You expect these lines (the order can differ):
   ```
    M AVCam.xcodeproj/project.pbxproj
   M  AVCam/CameraModel.swift
   M  AVCam/Capture/PhotoCapture.swift
   M  AVCam/Model/MediaLibrary.swift
   ```
   If only the project file shows, the coordinator already updated your checkout. Go to step 3. If other files show, stop and send the output.
2. Restore the three Swift files from the new commit. This does not touch the project file, so your signing team stays:
   ```sh
   git restore --source=HEAD --staged --worktree AVCam/CameraModel.swift AVCam/Capture/PhotoCapture.swift AVCam/Model/MediaLibrary.swift
   ```
3. Check:
   ```sh
   git status --short
   git log --oneline -1
   ```
   Only ` M AVCam.xcodeproj/project.pbxproj` shows. The log shows `87747f2 Chapter 8: save the processed photo with the DNG as alternate; log capture and save results`.
4. Do not use `git reset --hard`. It removes your signing change.

## 2. Prepare

1. Open `AVCam.xcodeproj`. Connect the iPhone. Choose it as the run destination.
2. Product > Run. Open the debug console (View > Debug Area > Activate Console).
3. Clear the filter field of the console, so that you see all lines.
4. Write down the iPhone model (Settings > General > About).

## 3. A normal photo first

1. Make sure the RAW menu (the `r.square` button) is on Off.
2. Take a photo. Wait until the thumbnail updates.
3. Send the lines from the tap to the end. Expected:
   - `Resolved settings: 1 photos, ...`
   - `Captured processed photo, N bytes` or `Captured deferred photo proxy, N bytes`
   - `Saved asset <identifier>`
4. Check that the photo is in Photos.

## 4. Apple ProRAW

1. Choose Apple ProRAW in the RAW menu. Send the line `Deferred photo delivery (supported/enabled): true/false`.
2. Point the camera at a normal scene. Tap the capture button. Wait 3 seconds.
3. Send all lines from the tap to the end, in order. Expected:
   - `Capturing with RAW format: Apple ProRAW`
   - `Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0`
   - `Captured RAW photo, N bytes` (about 14 MB)
   - `Captured processed photo, N bytes` (a few MB; this line and the RAW line can come in either order)
   - `Saved asset <identifier>`
4. If you see these two lines instead of `Saved asset`, send both lines completely. The error text tells what Photos refused:
   - `Saving to Photos failed: ...`
   - `Photo capture failed: ...`
5. If `Photo capture failed: ...` comes without `Saving to Photos failed`, send it too. Then the error is in the capture (for example `noPhotoData`) or in the access to Photos (`unauthorized`).
6. Only if you see `Saved asset`: open the photo in Photos.
   - Is it one asset (one tile), or two?
   - Does it show a `RAW` badge (top left)?
   - Share > Options (if offered), or the share sheet action "Export Unmodified Original", save to Files. Which file types come out (`.DNG`, `.HEIC`, or both)?
   On a Mac with the same iCloud library: File > Export > Export Unmodified Original works too.
7. Optional: turn the Live Photo button on and repeat step 2. Expected: no crash, the same lines, and no Live Photo in Photos.

## 5. Back to Off

1. Choose Off in the RAW menu. Send the line `Deferred photo delivery (supported/enabled): true/true`.
2. Take a photo. Send the lines as in section 3.

## 6. Front camera (optional)

1. Tap the camera switch button to use the front camera. Send the new `RAW on ...` line.
2. Only if that line says `Bayer RAW true`: choose RAW in the menu, set the quality menu to Quality, take a photo, and send the lines as in section 4.

## 7. What to send back

- The iPhone model.
- The console lines of sections 3, 4, 5, and 6.
- The answers of section 4, step 6 (one or two assets, RAW badge, file types of the export).
- Any crash: the console text from the line `*** Terminating app` to the end.

The three lines that decide this round: `Captured processed photo, N bytes`, `Saved asset <identifier>`, and, if the save fails, `Photo capture failed: ...` (with `Saving to Photos failed: ...` before it).
