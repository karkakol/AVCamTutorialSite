# Device test: chapter 8 (RAW), round 5, after the fourth save fix of 16 Oct 2026

Goal: find out if the DNG data is a good DNG, and if Photos takes the exact request of Apple's article. Time: about 10 minutes. You need the iPhone 17 Pro Max and Xcode.

What changed since round 4: round 4 showed that Photos supports the pair of resources, but it refused the request with error 3300. The error names the DNG file. Round 4 also gave each resource a file name and a type. Apple's article does not do that. Now the app sends the article's request without additions. Before the save, the app also logs the first 4 bytes of the DNG data and the type that the system reads from them. The fallback stays: if Photos refuses the pair, you still get the processed photo.

## 1. Update your checkout

The branch `chapter-08` now points at the new commit `3baa017`. Your main checkout is still on `chapter-08`, but its files can be the old version. Then Git shows two files as changed, plus your signing change in the project file.

1. In Terminal, run:
   ```sh
   cd ~/tutorials/AVCamTutorialApp
   git status --short
   ```
   You expect these lines (the order can differ):
   ```
    M AVCam.xcodeproj/project.pbxproj
   M  AVCam/Capture/PhotoCapture.swift
   M  AVCam/Model/MediaLibrary.swift
   ```
   If only the project file shows, your checkout is already up to date. Go to step 3. If other files show, stop and send the output.
2. Restore the two Swift files from the new commit. This does not touch the project file, so your signing team stays:
   ```sh
   git restore --source=HEAD --staged --worktree AVCam/Capture/PhotoCapture.swift AVCam/Model/MediaLibrary.swift
   ```
3. Check:
   ```sh
   git status --short
   git log --oneline -1
   ```
   Only ` M AVCam.xcodeproj/project.pbxproj` shows. The log shows `3baa017 Chapter 8: the RAW save request as in Apple's article; RAW data diagnostics`.
4. Do not use `git reset --hard`. It removes your signing change.

## 2. Prepare

1. Open `AVCam.xcodeproj`. Connect the iPhone. Choose it as the run destination.
2. Product > Run. Open the debug console (View > Debug Area > Activate Console).
3. Clear the filter field of the console, so that you see all lines.

## 3. A normal photo first

1. Make sure the RAW menu (the `r.square` button) is on Off.
2. Take a photo. Wait until the thumbnail updates.
3. Expected: `Saved asset <identifier>`. Send the lines only if this line does not come.

## 4. Apple ProRAW

1. Choose Apple ProRAW in the RAW menu.
2. Point the camera at a normal scene. Tap the capture button. Wait 3 seconds.
3. Send all lines from the tap to the end, in order, completely. Expected:
   - `Capturing with RAW format: Apple ProRAW`
   - `RAW file types: com.adobe.raw-image` (send the list as it is)
   - `Resolved settings: 2 photos, photo 4032x3024, RAW 4032x3024, proxy 0x0`
   - `Captured RAW photo, N bytes` and `Captured processed photo, N bytes` (either order)
   - `RAW data: N bytes, header 49 49 2A 00, type com.adobe.raw-image, images 1` (the header can also be `4D 4D 00 2A`)
   - `RAW pair, .photo with .alternatePhoto supported: true`
   - `Resource .photo: N bytes, file <UUID>.dng`
   - `Resource .alternatePhoto: N bytes, type public.heic, images 1`
   - `Saved asset <identifier>`
4. If the pair fails, you see these lines instead of the last one. Send all of them completely, with the full `UserInfo={...}` part:
   - `Saving to Photos failed: ... (changeNotSupported)` (or another name)
   - `Saved asset <identifier>`
   - `Saved the processed photo without the RAW: saveFailed(reason: ...)`
5. If you see `Photo capture failed: ...`, send it too. Then the fallback failed as well.
6. If `Saved asset` came without `Saved the processed photo without the RAW`, open the newest photo in Photos and answer:
   - Is it one asset (one tile), or two?
   - Does it show a `RAW` badge (top left)?
   - Share > Options > "All Photos Data" (or "Export Unmodified Original" on a Mac), save to Files. Which file types come out (`.DNG`, `.HEIC`, or both)?
7. Take a second ProRAW photo. Send only the `RAW data` line and the line with `Saved asset` or `Saved the processed photo without the RAW`.

## 5. Back to Off

1. Choose Off in the RAW menu.
2. Take a photo. Expected: `Saved asset <identifier>`.

## 6. What to send back

- The console lines of section 4, step 3, or of steps 4 and 5.
- If the RAW asset saved: the answers of section 4, step 6.
- The two lines of section 4, step 7.
- Any crash: the console text from the line `*** Terminating app` to the end.

The lines that decide this round:

- `RAW file types: ...`: which RAW containers the camera offers.
- `RAW data: ... header ..., type ..., images ...`: whether the RAW data is a DNG that the system can read. A good DNG has the header `49 49 2A 00` or `4D 4D 00 2A`, the type `com.adobe.raw-image`, and at least 1 image.
- `Saved asset <identifier>` alone (the RAW saved), or `Saving to Photos failed: ... (name)` with its `UserInfo`, followed by `Saved the processed photo without the RAW: ...`.
