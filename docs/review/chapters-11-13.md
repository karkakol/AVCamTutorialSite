# Technical review: chapters 11 to 13 and the wrap-up

Date: 1 Oct 2026. Reviewer: an independent agent that did not write the pages.

Pages: `ch11-concepts.md`, `ch11-build.md`, `ch12-concepts.md`, `ch12-build.md`, `ch13-concepts.md`, `ch13-build.md`, `wrap-up.md`.

Result: approximately 230 claims checked. 10 findings are WRONG. 6 findings are UNSUPPORTED. All 16 are corrected on the pages. `ch12-concepts.md`, `ch12-build.md`, and `wrap-up.md` have no changes. `npm run validate` gives 0 errors for the four changed pages.

## Evidence

- **SDK**: `iPhoneOS27.1.sdk` in Xcode 27.1 (27A9269). Paths below are relative to `System/Library/Frameworks/`.
- **App**: `/Users/karolkakol/tutorials/AVCamTutorialApp`, branches `chapter-11`, `chapter-12`, `chapter-13`, read with `git archive` and `git show`.
- **Sample**: `/Users/karolkakol/tutorials/AVCamBuildingACameraApp`.
- **Templates**: `Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/Xcode/Templates/Project Templates/iOS/Application Extension/`, `Capture Extension.xctemplate` and `Widget Extension.xctemplate`.
- **WWDC**: the transcripts of WWDC25 sessions 253 and 251 and of WWDC24 session 10204, read from the session pages.
- **Documentation**: the JSON endpoint of developer.apple.com, the Human Interface Guidelines JSON, and three Apple Support pages.

The research dossier uses the markers [DOC], [WWDC], [INFERENCE], and [UNVERIFIED]. This review treated [INFERENCE] claims as not proven.

## Findings

| # | Page | Claim | Verdict | Evidence | Change |
|---|---|---|---|---|---|
| 1 | ch11-concepts | After the camera failed to start, a volume button does not change the volume. | WRONG | WWDC25-253: apps "that do not have an active AVCaptureSession running, won't receive any events", and a press then does its system action. `CameraModel.swift:81-84` sets `failed` only when `start(with:)` throws, and then `startRunning()` did not run (`CaptureService.swift:107-108`). | Removed the failed-start case. Added a sentence that the buttons do their usual job then. Changed "captures nothing useful" to "probably". |
| 2 | ch11-concepts | `MovieCaptureButton` has its own `isRecording` state. | WRONG | `CaptureButton.swift`: `@State var isRecording` is in `CaptureButton`. `MovieCaptureButton` has `@Binding private var isRecording`. | The sentence now names `CaptureButton` as the owner of the state. |
| 3 | ch11-concepts, ch11-build | After the toggle, `isRecording` has the opposite value (three places). | UNSUPPORTED | `CameraModel.swift:205-215`: the model gets the value through an asynchronous stream. No source says that the value is there when `toggleRecording()` returns. The quiz already says "possibly". | "has" changed to "can have", "plays" changed to "can then play". |
| 4 | ch11-concepts | The AirPods mode makes the voice sound near. | UNSUPPORTED | WWDC25-251 says the tuning "strikes a great balance between voice and background sounds", as a lav microphone does. | The sentence now says what the session says. |
| 5 | ch11-concepts, ch11-build | If the person selects nothing, the iPhone microphone records. | UNSUPPORTED | `AVCaptureSession.h:566-569` says only that the property lets a person select AirPods. The Apple Support page also has the choice "Same as System" and a system input setting. | Added "probably" in the two places. |
| 6 | ch11-concepts, ch11-build | The order of the line makes the session configure the audio one time. | UNSUPPORTED | No header, article, or session says when the session configures the audio session. | Changed to "probably" in the two places. |
| 7 | ch13-concepts | If the person never opened the app, the Photos and location requests run in the extension. | WRONG | WWDC24-10204: without camera permission, the system opens the app and not the extension. `MediaLibrary.swift:36-43, 132-133`: the app makes the two requests at the first save, not at launch. | The condition is now "never saved a photo or a movie in the app". The advice is now "take one photo in the app first". |
| 8 | ch13-build | Open the app one time and give it access to Photos and the location. | WRONG | Same code as finding 7. A launch does not show these two alerts. | The step now tells the learner to take a photo, and says why. |
| 9 | ch13-concepts | The intent is not in all three targets, and no build error tells you why. | WRONG | `CameraState.swift:36, 46` uses `AVCamCaptureIntent`, and `CameraState.swift` is in all three targets (`project.pbxproj:64-104`). In this project a missing membership is a build error. | "A build error does not always tell you why." |
| 10 | ch13-concepts, ch13-build | After a change of `kind`, the controls that people added disappear. | UNSUPPORTED | The `StaticControlConfiguration` page says only that `kind` identifies the control. The dossier gives no source. | Added "probably" in the two places. |
| 11 | ch13-build | After `setHDRVideoEnabled(_:)`, the published value is always the real state of the camera. | WRONG | `changeCaptureDevice(to:)` does not call the method, so the value can be old after a change of the camera. The wrap-up lists this weak point. | "always" changed to "after this call". |
| 12 | ch13-build | The stored state has no visible effect in a first run, and the default values are the old values. | WRONG | `CameraState.swift:25`: `isVideoHDREnabled = true`. `CameraModel.swift:166`: the model starts with `false`. `CaptureService.swift:286-288` turns HDR on at the change to video mode. | Added two sentences about the HDR default. |
| 13 | ch13-build | Xcode names the widget target `AVCamControlCenterExtension`. | WRONG | `Widget Extension.xctemplate/TemplateInfo.plist`: `Targets[0].Name = ___PACKAGENAME___Extension`. The sample confirms it: `productName = AVCamControlCenterExtensionExtension` and `remoteInfo` (sample `project.pbxproj:91, 425`), with the target renamed (`:424`). | Added a paragraph: the template makes `AVCamControlCenterExtensionExtension`, rename it, and the rename is not verified in the Xcode interface. |
| 14 | ch13-build | The names of the widget template files were not checked. | WRONG (now checked) | Same template, options Control yes, Live Activity no, Configuration no: `<name>.swift` from `Widget-Static.swift`, `<name>Control.swift` from `Control-Static.swift`, `<name>Bundle.swift` from `WidgetBundle-Control.swift`. | The step names the three files. The `settings` row names `AVCamControlCenterExtensionControl.swift` as the file to delete. |
| 15 | ch13-build | "The asset catalogs" of the `AVCam` group. | WRONG | The tutorial project has one catalog, `AVCam/Assets.xcassets`. The preview catalog is only in the sample. | "The asset catalog". |
| 16 | ch11-concepts | During a mode change, a volume button captures nothing useful. | UNSUPPORTED | The dossier marks this [INFERENCE]. | "probably" (same edit as finding 1). |

## Important claims verified as correct

**Capture events (chapter 11)**

- Primary and secondary events. WWDC25-253: volume down, the Action button, and the Camera Control give a primary event. Volume up gives a secondary event, or a primary event when no secondary handler exists. One button never calls the two handlers.
- AirPods stem click: a primary event, iOS 26, H2 chip, no new code for apps that use the API (WWDC25-253).
- Six overloads of `onCameraCaptureEvent`: two for iOS 18, four for iOS 26, two of them `async` (`_AVKit_SwiftUI.swiftinterface:12-37`). The documentation page shows only the synchronous declaration.
- `AVCaptureEventInteraction` and the phases are iOS 17.2. The event has no property for its source (`AVCaptureEvent.h`).
- Sound rules (`AVCaptureEvent.h:55-80`): `shouldPlaySound` is `true` only for a stem click with the default sound disabled. `play(_:)` does nothing when it is `false` or when the event is older than 15 seconds. The three system sounds and `init(url:)` are in `AVCaptureEventSound.h`.
- `defaultCaptureSoundDisabled` is a class property (`AVCaptureEventInteraction.h:110`).
- EU: the four AVKit headers say that AirPods Camera Control is not available in the European Union. The `bluetoothHighQualityRecording` documentation and the Apple Support page say the same for high-quality recording.
- Mac Catalyst: the sound API and the session property are marked not available.
- `configuresApplicationAudioSessionForBluetoothHighQualityRecording`: default `false`, iOS 26, lets a person select AirPods (`AVCaptureSession.h:566-569`).
- The manual audio session rules, the delay, and the ringtone advice (`AVAudioSessionTypes.h:614-635`). `multichannelAudioMode` applies only to the built-in microphone (`AVCaptureInput.h:380-383`).
- The Camera Remote setting with "Press Once" and "Press and Hold", and the microphone choice in Control Center (Apple Support).
- The sample used the synchronous overload with a `Task` before commit `c93a0f0`.
- 31 added lines in three files. `CameraView.swift` and `CaptureButton.swift` on `chapter-11` are the same as the sample files. `import AVKit` came in chapter 8.

**Camera Control (chapter 12)**

- Four control classes and one base class, all iOS 18. No other subclass of `AVCaptureControl` is in the SDK headers.
- The system sliders: range from the active format, device property set by the control, action on the main actor only for changes by this control, exception for a device without support (`AVCaptureSystemZoomSlider.h`, `AVCaptureSystemExposureBiasSlider.h`).
- The session API: `addControl` exception, nested begin and commit pairs, serial delegate queue, "A controls delegate must be specified for controls to become active" (`AVCaptureSession.h:351-461`).
- Four required delegate methods. The exit callback comes before the inactive callback. The header names sliders and shutter buttons (`AVCaptureSession.h:712-773`).
- `canAddControl` is `false` at `maxControlsCount` (Camera Control article), without an action (header), and for a second system zoom control (WWDC25-253).
- The action queue rule, the `value` and `selectedIndex` rule, the `%@` rule, the default value at the minimum (`AVCaptureSlider.h`, `AVCaptureIndexPicker.h`).
- `prominentValues`: "the system more easily lands on prominent values" (HIG). The middle of the list, the space for the overlay, and SF Symbols only are also in the HIG.
- Do not start a session only for the Camera Control (WWDC25-253). Update the value of a control when the setting changes in a different place (Camera Control article).
- 135 added lines in seven files ("approximately 140" on the page).

**Lock Screen (chapter 13)**

- The limits of the extension, its life cycle, the Photos rules, the inherited camera and Photos permissions, the camera usage description in the two targets, and the intent in all three targets (WWDC24-10204 and the Lock Screen article).
- The LockedCameraCapture types. The newest availability in the interface file is iOS 18.1.
- `CameraCaptureIntent`, `appContext`, `updateAppContext(_:)`, and the 4 kB limit (`AppIntents.swiftinterface:10626-10644` and the documentation page).
- App or extension: the WWDC24 sentence and the HIG sentence are quoted correctly. The page marks its own reading as an inference.
- The article code for the user activity does not compile as written. The page says so correctly.
- All values in the `settings` blocks: bundle identifiers, deployment target 26.0, Swift 5, `nonisolated`, Approachable Concurrency `NO`, Member Import Visibility `NO`, the three usage descriptions, the two embed phases with `Extensions` and `PlugIns`, the two dependencies (`project.pbxproj` on `chapter-13`).
- Membership: 28 files in the capture extension, 3 files in the control extension, `AVCamApp.swift` only in the app. The two `Info.plist` files have the extension points that the page gives.
- Capture Extension template: the name, the group, the two Swift files, the `Info.plist` key, `UIImagePickerController` in the viewfinder, "Embed in Application".
- Widget Extension template: the three option names, all on by default, the asset catalog with `AccentColor`, `WidgetBackground`, and an app icon set. The bundle identifier comes from the product name.
- The inferences about the code: the HDR default, the mode change at each activation, the writes without order, `isVideoHDRSupported` never read, the `session` parameter never used.
- Settings › Camera › Camera Control for the app selection (Apple Support).

**Wrap-up**

- `diff -r` of the sample and the `chapter-13` branch: the Swift files differ in exactly the four places of the table. The other differences are the app icon, the accent color, and the preview assets.
- All groups of the tutorial project are synchronized folders.
- The iOS 27.1 SDK has `builtInInnerUltraWideCamera`, `builtInOuterUltraWideCamera`, and `AVCaptureDeviceDirectionCoordinator`. The "iPhone Duo" article exists.
- The titles of the nine WWDC sessions in the link list agree with the session pages.

## Claims that this review could not check

1. Nothing ran on an iPhone. All behavior on a device is from text sources only.
2. The Xcode interface steps: Target Membership in the File inspector for files in a synchronized folder, the "Info.plist Values" group, the scheme dialog, "Team: None", the rename of the widget target, and Product › Show Build Folder in Finder. The templates prove the files and options, not the dialogs.
3. The history of the volume trick before iOS 17.2 (ch11-concepts). No source in the evidence list.
4. "The view that has the handler is part of the interface" as a condition for events (ch11-concepts).
5. A normal `OpenIntent` needs an unlock (ch13-concepts). The dossier gives no source.
6. The system starts the extension again for each use (ch13-concepts). The page marks the section as "probably".
7. `canAddOutput` returns `false` for an output that is already on the session. The claim "the mode change throws at each activation" depends on it.
8. The bundle identifier rule and the same-team rule for extensions. These are general Xcode rules, not in the evidence list.
9. "SimCam gives the app camera access without the alert" (wrap-up). `05-simcam.md` says only "Camera permission prompt: Works". Chapter 1 says the same as the wrap-up.
10. The UIKit snippet in ch11-concepts "compiles against the iOS 26 SDK". This review did not compile it.
11. `MainToolbar.swift` compiles without `import PhotosUI`. Probable, because the `chapter-11` file has no such import. Not built here.
12. The wrap-up weak points for chapters 2 to 10. They are outside this review.

## Notes for the author

- ch13-build says that each Swift file is the same as the sample file after the chapter. The diff from `chapter-12` to `chapter-13` also removes spaces on one empty line in `Camera.swift` (line 28). No step covers this. It has no effect on the build.
- The dossier (section 7) describes the sample project, where `AVCam` is a classic group. The tutorial project uses synchronized folders with membership exceptions. The page is correct for the tutorial project.
