# Device test: chapter 8 (RAW) after the fix of 16 Oct 2026

Goal: check the fix for RAW with deferred delivery, and record what each camera offers. Time: about 10 minutes. You need the iPhone with a Pro camera and Xcode.

## 1. Update your checkout

The branch `chapter-08` now points at the new commit `2ccbaa7`. Your main checkout is still on `chapter-08`, but its files are the old version. Git therefore shows four files as changed, plus your signing change in the project file.

1. In Terminal, run:
   ```sh
   cd ~/tutorials/AVCamTutorialApp
   git status --short
   ```
   You expect exactly these lines (the order can differ):
   ```
    M AVCam.xcodeproj/project.pbxproj
   M  AVCam/CameraModel.swift
   M  AVCam/Capture/PhotoCapture.swift
   M  AVCam/CaptureService.swift
   M  AVCam/Model/MediaLibrary.swift
   ```
   If other files show, stop and send the output.
2. Restore the four Swift files from the new commit. This does not touch the project file, so your signing team stays:
   ```sh
   git restore --source=HEAD --staged --worktree AVCam/CameraModel.swift AVCam/Capture/PhotoCapture.swift AVCam/CaptureService.swift AVCam/Model/MediaLibrary.swift
   git status --short
   git log --oneline -1
   ```
   Now only ` M AVCam.xcodeproj/project.pbxproj` shows, and the log shows `2ccbaa7 Chapter 8: RAW without deferred delivery; ...`.
3. Do not use `git reset --hard`. It removes your signing change.

Other way, in Xcode only: Source Control > Discard All Changes, then set your team again in Signing & Capabilities.

## 2. Prepare

1. Open `AVCam.xcodeproj`. Connect the iPhone. Choose it as the run destination.
2. Product > Run. Open the debug console (View > Debug Area > Activate Console).
3. In the console filter field, type `RAW` or clear the filter to see all lines.
4. Write down the iPhone model (Settings > General > About).

## 3. At launch

Send these lines (copy them from the console):
- `Deferred photo delivery (supported/enabled): x/y` (expected: `true/true`).
- `RAW on <camera name> (virtual: ...): Apple ProRAW ..., Bayer RAW ...` (expected for the back camera: `virtual: true`, Apple ProRAW `true`, Bayer RAW `false`).

## 4. Apple ProRAW

1. Tap the `r.square` button in the features toolbar. Choose Apple ProRAW. The icon changes to `r.square.fill`.
2. Send the new line `Deferred photo delivery (supported/enabled): true/false`.
3. Point the camera at a normal scene. Tap the capture button. Wait until the thumbnail updates.
4. Send all lines from the tap to the end, in order. Expected:
   - `Capturing with RAW format: Apple ProRAW`
   - `Resolved settings: 2 photos, photo WxH, RAW WxH, proxy 0x0` (RAW size not `0x0`)
   - `Captured RAW photo, N bytes` (N is many megabytes)
   - No `Captured deferred photo proxy` line, no `Error ...` line.
5. In Photos on the iPhone, open the photo:
   - Is it one asset (one tile), or two?
   - Does it show a `RAW` badge (top left)?
   - Share > Options (if offered) or the share sheet action "Export Unmodified Original", save to Files. Which file types come out (`.DNG`, `.HEIC`, or both)?
   On a Mac with the same iCloud library: File > Export > Export Unmodified Original works too.
6. Optional: turn the Live Photo button on and repeat step 3. Expected: no crash, the same lines, and no Live Photo in Photos.

## 5. Back to Off

1. Choose Off in the RAW menu. Send the line `Deferred photo delivery (supported/enabled): true/true`.
2. Take a photo. Send the `Resolved settings: ...` line and the next line. Expected: `1 photos`, and maybe `Captured deferred photo proxy, N bytes`.

## 6. Bayer RAW

Bayer RAW exists only on a physical camera. On your iPhone the back camera of this chapter is the virtual dual camera, so the menu does not offer RAW there. That is expected.

1. Tap the camera switch button to use the front camera. Send the new `RAW on ...` line.
2. Only if that line says `Bayer RAW true`: open the RAW menu, choose RAW, set the quality menu to Quality, take a photo, and send the lines as in section 4 (expected: `Capturing with RAW format: RAW`, `Resolved settings: 2 photos, ...`, `Captured RAW photo, N bytes`, and no crash). Check Photos as in section 4, step 5.
3. If it says `Bayer RAW false`, the test of Bayer RAW needs an iPhone without a telephoto camera. Skip it.

## 7. What to send back

- The iPhone model.
- The console lines of sections 3, 4, 5, and 6.
- The answers of section 4, step 5 (one or two assets, RAW badge, file types of the export).
- Any crash: the console text from the line `*** Terminating app` to the end.
