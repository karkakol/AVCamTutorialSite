# Chapter 1 hand-off notes: First preview

Code repository: `/Users/karolkakol/tutorials/AVCamTutorialApp`.
Branches: `start` (commit `e027d94`), `chapter-01` (commits `7973f8e` settings, `f05ff1b` code). `main` equals `chapter-01`.

## 1. Result and verification

Result: the app asks for camera permission, then shows a live camera preview on a black screen without a status bar. If the person denies access, a red status message appears. If the camera cannot start, an orange message appears.

Verification (Xcode 27.1, iPhone 18 Pro simulator, iOS 27.0):

- `start`: `xcodebuild -list` shows target `AVCam` and scheme `AVCam`. The build succeeds. The app shows the template "Hello, world!" screen with the globe.
- `chapter-01`: the Debug build for the simulator succeeds with 0 errors and 0 Swift warnings. A Release build for the simulator also succeeds.
- Run with camera permission granted and SimCam: the screen shows a live feed. Three screenshots taken some seconds apart show different pictures, so the feed is live. The status bar is hidden. The area around the preview is black.
- Run with camera permission revoked (and SimCam not loaded, see section 5): the red message "You haven't authorized AVCam to use the camera or microphone. ..." appears on black.
- Run with permission granted but without SimCam (the Simulator has no camera then): the orange message "The camera failed to start. Please try relaunching the app." appears. This checks the `.failed` path.
- The built `Info.plist` contains `MinimumOSVersion 26.0`, `NSCameraUsageDescription`, and `UIUserInterfaceStyle Dark`.

## 2. The `start` branch: Xcode "new project" options

File > New > Project > iOS > App, then:

| Option | Value |
|---|---|
| Product Name | `AVCam` |
| Team | None (the project file has no `DEVELOPMENT_TEAM`) |
| Organization Identifier | `com.karolkakol` (bundle identifier becomes `com.karolkakol.AVCam`) |
| Interface | SwiftUI |
| Language | Swift |
| Testing System | None |
| Storage | None |

Xcode creates: `AVCam.xcodeproj`, `AVCam/AVCamApp.swift`, `AVCam/ContentView.swift`, `AVCam/Assets.xcassets` (`AccentColor`, `AppIcon`). No `Info.plist` file, no `Preview Content` folder, no shared scheme file.

How I made it: no command line tool creates the project, so I copied the structure of a real project that Xcode 27.1 created on this Mac (iOS App template, same options) and changed the names and object identifiers. I checked each build setting against the template definitions in `Xcode.app` (`iOS/Application/App.xctemplate` and its ancestors). The Swift files and asset files come from the template files. The file header says "Created by Karol Kakol on 01/10/2026."; the learner sees their own name and date.

Facts about the Xcode 27.1 template that the writer can use:

- Project format: `objectVersion = 110`. The `AVCam` folder is a file-system-synchronized group. New files and folders in Finder or Xcode need no project file edits.
- Project level: `IPHONEOS_DEPLOYMENT_TARGET = 27.0`, `SDKROOT = iphoneos`.
- Target level: `SWIFT_VERSION = 5.0` (Swift 5 language mode), `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`, `SWIFT_APPROACHABLE_CONCURRENCY = YES`, `SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY = YES`, `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone and iPad), `GENERATE_INFOPLIST_FILE = YES`, `ENABLE_PREVIEWS = YES`.
- `INFOPLIST_KEY_*` entries: `UIApplicationSceneManifest_Generation`, `UIApplicationSupportsIndirectInputEvents`, `UILaunchScreen_Generation`, `UISupportedInterfaceOrientations_iPad` (all four), `UISupportedInterfaceOrientations_iPhone` (portrait, landscape left, landscape right).
- No `SWIFT_STRICT_CONCURRENCY` entry. The default is `minimal`, the same value the sample sets.
- No `DEVELOPMENT_ASSET_PATHS` entry (no development assets).

## 3. Setting changes in chapter 1

All changes are on the target `AVCam`, for both Debug and Release. Location: project navigator > project `AVCam` > target `AVCam`.

| # | Xcode UI location | Setting (UI name / build setting) | Old value | New value |
|---|---|---|---|---|
| 1 | General > Minimum Deployments > iOS | `IPHONEOS_DEPLOYMENT_TARGET` | 27.0 (from the project level) | 26.0 (written on the target level) |
| 2 | Build Settings > Swift Compiler - Concurrency | Default Actor Isolation / `SWIFT_DEFAULT_ACTOR_ISOLATION` | MainActor | nonisolated |
| 3 | Build Settings > Swift Compiler - Concurrency | Approachable Concurrency / `SWIFT_APPROACHABLE_CONCURRENCY` | Yes | No |
| 4 | Build Settings > Swift Compiler - Upcoming Features | Member Import Visibility / `SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY` | Yes | No |
| 5 | Build Settings > Info.plist Values (or the Info tab: add the key "Privacy - Camera Usage Description") | Privacy - Camera Usage Description / `INFOPLIST_KEY_NSCameraUsageDescription` | not set | `To capture photos and videos.` |
| 6 | Build Settings > Info.plist Values (Info tab name: "Appearance") | User Interface Style / `INFOPLIST_KEY_UIUserInterfaceStyle` | not set (Automatic) | Dark |

Tip for the page: in Build Settings, select "All" and "Combined", then type the setting name in the filter field.

Why each change (measured, not guessed):

- 1: the sample supports iOS 26.0. The template uses the newest iOS (27.0).
- 2: the sample has no default actor isolation. With `MainActor`, each type without an annotation becomes main-actor isolated. Measured effect on the chapter 1 code: the build still succeeds, but with the warning "call to main actor-isolated initializer 'init(session:)' in a synchronous nonisolated context" at `CaptureService.init` (`DefaultPreviewSource`). The design of the sample needs capture types that are not on the main actor. This is the important change for the concept article.
- 3: the sample does not use approachable concurrency. With the chapter 1 code the build gives the same result for Yes and No. The change keeps the settings equal to the sample for later chapters.
- 4: needed now. With Yes, the build fails in `CameraModel.swift`: "instance method 'error' is not available due to missing import of defining module 'os'". The sample imports `os` only in `AVCamApp.swift` and uses the global `logger` in other files.
- 5: needed now. Without a usage description, iOS stops the app when it asks for camera access.
- 6: gives the black background and a dark launch screen. The sample has the same setting. Without it, the area above and below the preview is white in light mode.

Sample settings that I did NOT apply in chapter 1:

- `DEVELOPMENT_ASSET_PATHS = "AVCam/Preview Content"` (General > Development Assets). Not needed for the build. I tested it: an install-style Release build then fails with "cannot find 'PreviewCameraModel' in scope", because the `#Preview` blocks use the excluded file. Recommendation: leave it out of the tutorial.
- Supported orientations (the sample allows only portrait on iPhone). The plan puts this in chapter 5.
- `SWIFT_STRICT_CONCURRENCY = minimal`: this is already the default.
- Other usage descriptions, app category, code signing entries: later chapters or not needed.

## 4. Proposed section and step order

The project compiles at the end of each section, except where noted.

1. **Create the project** (or check out `start`). Run it once: "Hello, world!".
2. **Change the settings** (table above, items 1 to 6). The template code still builds and runs after this section.
3. **Data types**: create group `Model`, file `Model/DataTypes.swift` with `CameraStatus` (`unknown`, `unauthorized`, `failed`, `running`) and `CameraError` (`videoDeviceUnavailable`, `addInputFailed`, `setupFailed`). Builds.
4. **Preview view**: create group `Views`, file `Views/CameraPreview.swift` with `PreviewSource`, `PreviewTarget`, `DefaultPreviewSource`, then `CameraPreview` and its `PreviewView`. Builds.
5. **Capture service**: `CaptureService.swift`. Order inside: the actor with `captureSession`, `sessionQueue`, and `unownedExecutor`; `previewSource` and `init`; `isAuthorized`; `addInput(for:)`; `setUpSession()`; `start()`. Builds.
6. **Global logger**: add `import os` and `let logger = Logger()` to `AVCamApp.swift` (the next section needs it). Builds.
7. **Camera protocol and model**: `Model/Camera.swift`, then `CameraModel.swift`. Builds.
8. **Preview model**: create group `Preview Content`, file `Preview Content/PreviewCameraModel.swift`. Builds.
9. **Views**: `Views/Overlays/StatusOverlayView.swift` and `CameraView.swift`. Each file uses the other one (`StatusOverlayView` previews use `CameraView`), so the project builds only when both exist. Show the Xcode canvas previews "Failed" and "Unauthorized" here.
10. **App entry point**: change `AVCamApp.swift` (`@State camera`, `CameraView`, `.statusBarHidden(true)`, `.task`). Delete `ContentView.swift`. Build and run. Allow camera access.
11. **Test the denied state**: Settings > Privacy & Security > Camera, turn AVCam off, start the app again (on a real iPhone).

Note: steps 6 and 10 both edit `AVCamApp.swift`. The writer can also move the logger to step 10 and put section 7 after it, but then `CameraModel.swift` does not compile for a short time.

## 5. Changes to earlier code

- `AVCam/ContentView.swift`: removed.
- `AVCam/AVCamApp.swift`: the template content is replaced. The file gets the Apple header comment, `import os`, the `camera` state, `CameraView`, and the global `logger`.
- Project settings: see section 3.

## 6. Differences from the Apple sample

Approved deviations in use:

- Queue label `com.karolkakol.AVCam.sessionQueue` (from the bundle identifier).
- `PreviewView.init()` has no `#if targetEnvironment(simulator)` placeholder image.

Reductions for chapter 1 (each one is a subset of the sample; later chapters add lines):

- `CaptureService.setUpSession()`: the camera comes from `AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)` with a `guard` that throws `CameraError.videoDeviceUnavailable`. Chapter 2 replaces these four lines with `let defaultCamera = try deviceLookup.defaultCamera`. No fallback to `AVCaptureDevice.default(for: .video)` is necessary: SimCam supplies a back wide-angle camera.
- `setUpSession()` has no `isSetUp` guard, because the plan gives `isSetUp` to chapter 12. `start()` already returns early when the session runs.
- `setUpSession()` calls `try addInput(for: defaultCamera)` and ignores the result. `activeVideoInput` arrives in chapter 2. `addInput(for:)` is in its final form (`@discardableResult`).
- `CaptureService.start()` has no `with state:` parameter (chapter 15).
- `CameraStatus` has no `interrupted` case. `StatusOverlayView` has no `interrupted` entries and no "Interrupted" preview (chapter 12 adds them). The line `.foregroundColor(color == .yellow ? ...)` stays as in the sample; yellow is not in use until chapter 12.
- `CameraView` conforms to `View`, not `PlatformView` (chapter 5), and has no size class properties. The body is a `ZStack` with `CameraPreview` and `StatusOverlayView`. In the sample, the status overlay is in `CameraUI`; chapter 2 moves it there. The comment "A view that presents a status message over the camera preview." above `StatusOverlayView` in `CameraView` is mine; chapter 2 removes that line.
- `CameraView.swift` imports only `SwiftUI` (the sample also imports `AVFoundation` and `AVKit` for later features). `CameraModel.swift` and `CaptureService.swift` do not import `Combine` yet.
- `DataTypes.swift` keeps `import AVFoundation` from the sample although chapter 1 does not need it (chapter 3 needs it).

Comments copied from the sample that can confuse a learner:

- `AVCamApp.swift`: "Simulator doesn't support the AVFoundation capture APIs. Use the preview camera when running in Simulator." The code uses `CameraModel` in all cases. The comment is old in the sample too.
- `isAuthorized` and `CameraModel.start()` mention microphones. Chapter 1 asks only for the camera. The sample also asks only for video access here.
- The abstract of `AVCamApp.swift` contains the typo "how to a use". It is in the sample.

## 7. Simulator and SimCam behavior, and things that need a real iPhone

- **The feed is sideways in the Simulator.** In portrait, the SimCam picture appears rotated by 90 degrees. Chapter 1 has no rotation code (chapter 5 adds the rotation coordinator). I did not test a real iPhone. Someone must check on a real iPhone whether the chapter 1 preview is upright in portrait, before the page makes a claim about it.
- **The feed fills the whole preview view in the Simulator.** The default `videoGravity` of `AVCaptureVideoPreviewLayer` is `resizeAspect`, so a real iPhone shows the complete picture with black bars. SimCam fills the layer.
- The preview stays inside the safe area (same as the sample, which never ignores the safe area). The black bars at the top and bottom come from the dark interface style.
- **SimCam skips the permission system.** With SimCam loaded, the app is always authorized. `simctl privacy revoke` and `reset` have no effect, and the system permission alert never appears. So the learner cannot see the alert or the denied state in the Simulator with SimCam. To test the denied state I started the app without SimCam for one launch: `xcrun simctl privacy <udid> revoke camera com.karolkakol.AVCam`, then `SIMCTL_CHILD_DYLD_INSERT_LIBRARIES="" xcrun simctl launch <udid> com.karolkakol.AVCam`. This does not change the SimCam configuration. On a real iPhone, use the Settings app.
- Without SimCam, the Simulator has no camera. The app then shows the orange "failed" message. This is a useful note for learners without SimCam.
- The permission alert with the usage description text needs a real iPhone (or a Simulator without SimCam, where the alert appears but the camera then fails).
- iPhone landscape is still allowed in chapter 1 (template default). The preview does not rotate with the device until chapter 5.

## 8. Screenshots

- `content/images/ch01-unauthorized.png`: saved. Red status message on black, 1206 x 2622.
- `content/images/ch01-preview.png`: NOT saved. The SimCam source is a real camera that points at the user's desk and computer screens (a private room, with readable window shapes). The brief forbids saving such a picture. To get this screenshot, someone must point the camera at a neutral scene or set a SimCam image source (`simcamctl set-source --back --image <file>`), which my brief did not allow. Then: grant the permission, launch, and run `xcrun simctl io <udid> screenshot`.
