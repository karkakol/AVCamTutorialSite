# Device test: chapter 8 (RAW), round 4, after the third save fix of 16 Oct 2026

Goal: check that a RAW capture now reaches Photos as one asset with a RAW badge. If Photos refuses it again, get the name of the error code. Time: about 10 minutes. You need the iPhone 17 Pro Max and Xcode.

What changed since round 3: round 3 showed that both photos arrive, but Photos refused the pair with error 3300. The SDK header names this code `changeNotSupported`: "The change request is not supported as configured". Now the app follows Apple's article exactly. It writes the DNG to a temporary file with the extension `.dng` and saves that file as the main photo. The processed photo is the alternate. Each resource has a file name and a type. The app logs each resource before the save. If Photos still refuses the pair, the app saves the processed photo alone, so you always get a picture.

## 1. Update your checkout

The branch `chapter-08` now points at the new commit `1f03e26`. Your main checkout is still on `chapter-08`, but its files can be the old version. Then Git shows two files as changed, plus your signing change in the project file.

1. In Terminal, run:
   ```sh
   cd ~/tutorials/AVCamTutorialApp
   git status --short
   ```
   You expect these lines (the order can differ):
   ```
    M AVCam.xcodeproj/project.pbxproj
   M  AVCam/Model/MediaLibrary.swift
   M  AVCam/Support/FoundationExtensions.swift
   ```
   If only the project file shows, your checkout is already up to date. Go to step 3. If other files show, stop and send the output.
2. Restore the two Swift files from the new commit. This does not touch the project file, so your signing team stays:
   ```sh
   git restore --source=HEAD --staged --worktree AVCam/Model/MediaLibrary.swift AVCam/Support/FoundationExtensions.swift
   ```
3. Check:
   ```sh
   git status --short
   git log --oneline -1
   ```
   Only ` M AVCam.xcodeproj/project.pbxproj` shows. The log shows `1f03e26 Chapter 8: save the DNG as a file, the processed photo as alternate, with a fallback`.
4. Do not use `git reset --hard`. It removes your signing change.

## 2. Prepare

1. Open `AVCam.xcodeproj`. Connect the iPhone. Choose it as the run destination.
2. Product > Run. Open the debug console (View > Debug Area > Activate Console).
3. Clear the filter field of the console, so that you see all lines.

## 3. A normal photo first

1. Make sure the RAW menu (the `r.square` button) is on Off.
2. Take a photo. Wait until the thumbnail updates.
3. Expected: `Saved asset <identifier>`, as in round 3. Send the lines only if this line does not come.

## 4. Apple ProRAW

1. Choose Apple ProRAW in the RAW menu.
2. Point the camera at a normal scene. Tap the capture button. Wait 3 seconds.
3. Send all lines from the tap to the end, in order. Expected:
   - `Capturing with RAW format: Apple ProRAW`
   - `Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0`
   - `Captured RAW photo, N bytes` and `Captured processed photo, N bytes` (either order)
   - `RAW pair, .photo with .alternatePhoto supported: true` (or `false`; send the value)
   - `Resource .photo: N bytes, com.adobe.raw-image, file <UUID>.dng`
   - `Resource .alternatePhoto: N bytes, public.heic, file <UUID>.heic`
   - `Saved asset <identifier>`
4. If the pair fails, you see these lines instead of the last one. Send all of them completely. The name in parentheses at the end of the first line is the most important part:
   - `Saving to Photos failed: ... (changeNotSupported)` (or another name)
   - `Saved asset <identifier>`
   - `Saved the processed photo without the RAW: saveFailed(reason: ...)`
5. If you see `Photo capture failed: ...`, send it too. Then the fallback failed as well.
6. Open the newest photo in Photos. Answer these questions:
   - Is it one asset (one tile), or two?
   - Does it show a `RAW` badge (top left)?
   - Share > "Export Unmodified Original" (or Share > Options, if offered), save to Files. Which file types come out (`.DNG`, `.HEIC`, or both)?
   On a Mac with the same iCloud library: File > Export > Export Unmodified Original works too.
   If the fallback ran (step 4), the photo has no RAW badge. Still tell what you see.
7. Take a second ProRAW photo. Send only the line with `Saved asset` or `Saved the processed photo without the RAW`. This shows if the result is the same each time.

## 5. Back to Off

1. Choose Off in the RAW menu.
2. Take a photo. Expected: `Saved asset <identifier>`.

## 6. What to send back

- The console lines of section 4, step 3, or of step 4 (with the code name) and step 5.
- The answers of section 4, step 6: one or two assets, RAW badge or not, file types of the export.
- The line of section 4, step 7.
- Any crash: the console text from the line `*** Terminating app` to the end.

The lines that decide this round: the three `RAW pair` and `Resource ...` lines, then `Saved asset <identifier>`, or `Saved the processed photo without the RAW: ...` together with `Saving to Photos failed: ... (name)`.
