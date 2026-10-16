# Device test: chapter 8 (RAW), round 7, the final code of 16 Oct 2026

Goal: test the final save of a RAW capture, for Apple ProRAW and for Bayer RAW. Time: about 15 minutes. You need the iPhone 17 Pro Max and Xcode.

What changed since round 6:

- Round 6 showed that Photos takes the pair: the processed photo as the main photo, and the DNG file as the alternate. Photos showed one picture with the badge "JPG + RAW".
- New design: the app now behaves like the Camera app. It saves the DNG alone, with a full-size JPEG preview inside the DNG. This request has not run on a device yet.
- If Photos refuses the DNG alone, the app saves the pair of round 6. If Photos refuses the pair too, the app saves the processed photo alone.
- The test matrix and the "Save variant" lines are gone.
- Round 6 stopped the app with Bayer RAW (`setPhotoQualityPrioritization: Unsupported when capturing RAW`). Now the app does not set the prioritization for a RAW capture. It logs "Quality prioritization ...: ignored for RAW".

## 1. Update your checkout

The branch `chapter-08` now points at the new commit `04bee6a`. It is one commit on top of `chapter-07`. Your main checkout is still on `chapter-08`, but two of its files can be the old version.

1. In Terminal, run:
   ```sh
   cd ~/tutorials/AVCamTutorialApp
   git status --short
   ```
   You expect these lines:
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
   git log --oneline -2
   ```
   Only ` M AVCam.xcodeproj/project.pbxproj` shows. The log shows `04bee6a Chapter 8: RAW and Apple ProRAW capture` and below it `bcf64be Previews: ...` (chapter 7).
4. Do not use `git reset --hard`. It removes your signing change.

## 2. Prepare

1. Open `AVCam.xcodeproj`. Connect the iPhone. Choose it as the run destination.
2. Product > Run. Open the debug console (View > Debug Area > Activate Console). Clear the filter field.
3. Look at the first line that starts with `RAW on`. It names the camera. For Bayer RAW (section 5), you need `virtual: false`, for example `RAW on Back Telephoto Camera (virtual: false): Apple ProRAW true, Bayer RAW true`. If the camera is virtual, open the Camera app, take a zoomed photo with the telephoto camera, and start AVCam again. The app starts with the camera that the system prefers.

## 3. A normal photo first

1. Make sure the RAW menu (the `r.square` button) is on Off.
2. Take a photo. Expected: `Saved asset <identifier>`. Send the lines only if this line does not come.

## 4. Apple ProRAW

1. Choose Apple ProRAW in the RAW menu. The Live Photo button shows the symbol with a slash and does not react.
2. Take a photo. Wait 5 seconds.
3. Expected lines, in this order:
   - `Capturing with RAW format: Apple ProRAW`
   - `RAW file types: com.adobe.raw-image`
   - `RAW preview: JPEG 8064x6048` (or the size of your camera)
   - `Quality prioritization Quality: ignored for RAW`
   - `Resolved settings: 2 photos, photo ..., RAW ..., proxy 0x0`
   - `Captured RAW photo, N bytes` and `Captured processed photo, N bytes`
   - `RAW data: N bytes, header 4D 4D 00 2A, type com.adobe.raw-image, images N`
   - `Resource .photo: N bytes, file <UUID>.dng`
4. Then one of three endings:
   - A, the DNG alone saved: `Saved asset <identifier>` and `Saved the RAW as the DNG alone`.
   - B, the pair saved: `Saving to Photos failed: ... (code name)`, `Photos refused the DNG alone. Saving the processed photo with the DNG as alternate.`, `Resource .photo: N bytes, type public.heic, images 1`, `Resource .alternatePhoto: N bytes, file <UUID>.dng`, `Saved asset <identifier>`, `Saved the RAW as the processed photo with the DNG as alternate`.
   - C, the processed photo alone: after the lines of B, a second `Saving to Photos failed: ...`, then `Saved asset <identifier>` and `Saved the processed photo without the RAW: ...`.
5. Check the newest picture in Photos:
   - Is it one picture (one tile)?
   - Which badge does it show (top left): `RAW`, `JPG + RAW`, or none?
   - Share > Options. Which choices does Format offer? Choose Unmodified Original (if it is there), save to Files. Which file comes out (`.DNG`, `.HEIC`, or both)? What is its size?
   - Swipe up on the picture. What does the info panel show (for example "Apple ProRAW", the size, the camera)?
   - Does the picture look sharp at full zoom? (This shows whether Photos shows the full-size preview.)

## 5. Bayer RAW

You need a physical camera (section 2, step 3). In round 6 this capture stopped the app.

1. Choose RAW in the RAW menu. Set the quality menu to Quality.
2. Take a photo. Wait 5 seconds.
3. Expected: the app does not stop. The lines are the same as in section 4, with `Capturing with RAW format: RAW` and `Quality prioritization Quality: ignored for RAW`, and one of the endings A, B, or C.
4. If the app stops, send the console text from the line `*** Terminating app` to the end.
5. Check the newest picture in Photos with the questions of section 4, step 5.

## 6. Back to Off

1. Choose Off in the RAW menu. The Live Photo button works again and shows your old choice.
2. Take a photo. Expected: `Saved asset <identifier>`.

## 7. What to send back

- Section 4: all lines from `Capturing with RAW format` to the last `Saved ...` line, with the full `UserInfo={...}` part of each error.
- Section 4, step 5: the answers about Photos.
- Section 5: the same lines and answers for Bayer RAW, or the crash text.
- The `RAW on ...` line of section 2.

The lines that decide this round: `Saved the RAW as the DNG alone` (the Camera app model works), or `Saved the RAW as the processed photo with the DNG as alternate` (only the pair works), for each RAW kind.
