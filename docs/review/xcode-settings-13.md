# Xcode interface check: chapter 13 settings steps

Date: 8 Oct 2026. Scope: the `settings` blocks of `content/pages/ch13-build.md` and the step text around them, except the blocks "Checkpoint" and "Product › Run". Nobody did these steps in the Xcode window. This check compares the page with the files of Xcode 27.1 and with the project file.

Result: 15 settings blocks checked. 0 values wrong. 3 steps corrected with more exact text from the Apple documentation (two Target Membership steps, one scheme and Team note). 5 items stay unverified, because the evidence does not show the Xcode dialogs. Each unverified step now says that it was not checked in the Xcode window. `npm run validate -- ch13-build`: 0 errors.

## Evidence

- T1: `Xcode.app/.../Project Templates/iOS/Application Extension/Capture Extension.xctemplate` (`TemplateInfo.plist`, `SecureCaptureExtension.swift`, `ViewFinder.swift`).
- T2: `.../Widget Extension.xctemplate` (`TemplateInfo.plist`, `Widget-Static.swift`, `Control-Static.swift`, `WidgetBundle-Control.swift`, `Assets.xcassets`).
- T3: `.../iOS/Base/iOS ExtensionKit Extension Base.xctemplate`, `.../Base/ExtensionKit Extension Base.xctemplate`, `.../Base/App Extension Base.xctemplate`, `.../iOS App Extension Base.xctemplate`, `.../Base/Base_Options.xctemplate`.
- S1: `XCBSpecifications.ideplugin/Contents/Resources/CoreBuildSystem.xcspec` (lines 518, 4095, 4263, 4277).
- S2: `.../Resources/Swift.xcspec` (lines 565, 644, 861, 982).
- D1: `DVTCorePlistStructDefs.xcplugindata` (localized names of the three usage keys).
- A1: Apple, "Configuring a new target in your project" (JSON).
- A2: Apple, "Creating a camera experience for the Lock Screen" (JSON).
- A3: Apple, "Creating controls to perform actions across the system" (JSON).
- P1: `git show chapter-13:AVCam.xcodeproj/project.pbxproj`, `chapter-13:AVCamCaptureExtension/Info.plist`, `chapter-13:AVCamControlCenterExtension/Info.plist`.
- P2: the Apple sample `AVCam.xcodeproj/project.pbxproj` (written by Xcode).

## Rows

| Line | The page says | The evidence says | Verdict | Evidence |
|---|---|---|---|---|
| 644-652 | File › New › Target › iOS › Capture Extension; the template is in the Application Extension group. | "Choose File > New > Target", "Select the platform", "From the Application Extension group, select Capture Extension". The template folder has no `Name` key, so Xcode shows the folder name "Capture Extension". | correct | A1, A2, T1 |
| 649 | Product Name: AVCamCaptureExtension | The option is "Product Name:". The target and the group take the product name; the base templates give the target no other name. | correct | T3 (Base_Options), T1 |
| 650 | Team: None | No template file defines a Team field. The project file has no `DEVELOPMENT_TEAM`, so "None" agrees with the project. The dialog itself is not in the evidence. | unverified | P1 |
| 651 | Embed in Application: AVCam | `PopUpTitle` = "Embed in Application:"; `AssociatedTargetIsDependent` and `AssociatedTargetNeedsProductBuildPhaseInjection` are true, which agrees with the step text (dependency and embed). | correct | T3 (iOS ExtensionKit Extension Base) |
| 646 | If Xcode asks about a scheme, keep `AVCam`. | No source shows this dialog. | unverified; sentence added: "The Team field and the scheme dialog were not checked in the Xcode window." | — |
| 660 | AVCamCaptureExtension.swift: the entry point | `___PACKAGENAME:identifier___.swift` comes from `SecureCaptureExtension.swift`, which has `@main struct ...: LockedCameraCaptureExtension`. | correct | T1 |
| 661 | AVCamCaptureExtensionViewFinder.swift: a viewfinder | `___PACKAGENAME:identifier___ViewFinder.swift` comes from `ViewFinder.swift`, which uses `UIImagePickerController`. | correct | T1, A2 |
| 662 | Info.plist › EXAppExtensionAttributes › EXExtensionPointIdentifier: com.apple.securecapture | The template definition `Info.plist:EXAppExtensionAttributes` has this key and value. The branch file is the same. | correct | T1, P1 |
| 663 | Target AVCam › Build Phases: a new phase, Embed ExtensionKit Extensions | The sample project, written by Xcode, has the phase "Embed ExtensionKit Extensions" with `dstPath = $(EXTENSIONS_FOLDER_PATH)`. The branch has the same. | correct | P2, P1 |
| 657 | The group is a synchronized folder. | `PBXFileSystemSynchronizedRootGroup` for `AVCamCaptureExtension` in the branch. | correct | P1 |
| 667-673 | Delete the viewfinder file; Move to Trash | The file is the second file of the template. The text of the delete dialog is not in the evidence. | unverified (dialog); sentence added | T1 |
| 740-751 | Select all Swift files except `AVCamApp.swift`; File inspector › Target Membership; 28 files in AVCam and AVCamCaptureExtension; the asset catalog only in AVCam | The branch has 29 Swift files in `AVCam/`; the exception set for the capture extension lists 28 files, all except `AVCamApp.swift`; no asset catalog in the list. Apple: "Under Target Membership, click the Add button (+). In the Choose Targets dialog, select the targets you want to add the file to and click Save." | corrected: the step now gives the Add button, the Choose Targets dialog, and Save | P1, A1 |
| 745 | Tip: View › Inspectors › File; Shift-click, Command-click | Menu and selection gestures are not in the evidence. The "Important" note above the section says that nobody did the steps in Xcode. | unverified | — |
| 754-760 | Target AVCamCaptureExtension › General › Minimum Deployments › iOS: 26.0 | `IPHONEOS_DEPLOYMENT_TARGET = 26.0` in the two configurations of the target. The General tab exists (A1). The section name "Minimum Deployments" is not in the evidence. | value correct; section name unverified; sentence added | P1, A1 |
| 767-772 | Build Settings: Swift Language Version: Swift 5; Default Actor Isolation: nonisolated; Approachable Concurrency: No; Member Import Visibility: No | `DisplayName` values are exactly these four names. `SWIFT_DEFAULT_ACTOR_ISOLATION` values: `nonisolated`, `MainActor`. `SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY` values: `YES`, `MIGRATE`, `NO`. The branch has `SWIFT_VERSION = 5.0`, `nonisolated`, `NO`, `NO`. | correct | S2, P1 |
| 779-783 | Build Settings › Info.plist Values: Privacy - Camera Usage Description; Privacy - Microphone Usage Description; Privacy - Location When In Use Usage Description; the three texts | `Category = "Info.plist Values"` and the three `DisplayName` values are the same, letter for letter. The Info tab uses the same localized names. The texts are the same as `INFOPLIST_KEY_...` in the branch. No Photos key in the extension. | correct | S1, D1, P1 |
| 790-792 | Signing & Capabilities › Bundle Identifier: com.karolkakol.AVCam.AVCamCaptureExtension; Xcode writes it | The tab exists (A1). The template rule: `bundleIdentifier` = `bundleIdentifierPrefix.productName`, and for a target the prefix is the bundle identifier of the host app. This gives exactly the value of the branch. | correct | T3 (Base_Options, ExtensionKit Extension Base), P1, A1 |
| 808 | The target name is `AVCamControlCenterExtensionExtension`; rename it; not verified in Xcode | `Targets[0].Name = ___PACKAGENAME___Extension`. The sample project has `productName = AVCamControlCenterExtensionExtension` with `name = AVCamControlCenterExtension`. | correct (kept from the earlier review) | T2, P2 |
| 811-816 | Widget Extension: Product Name; Team: None; Include Control: Yes; Include Live Activity: No; Include Configuration App Intent: No; Embed in Application: AVCam | Option names: "Include Live Activity", "Include Control", "Include Configuration App Intent", all default true. Apple: "Select the Include Control checkbox." `PopUpTitle` = "Embed in Application:". The plist lists the options in the order Live Activity, Control, Configuration; the dialog order is not in the evidence. Team: see line 650. | correct (Team unverified) | T2, A3 |
| 822-830 | Three Swift files: `AVCamControlCenterExtension.swift` (widget), `...Control.swift` (control), `...Bundle.swift`; keep the first and the bundle, delete the control; keep Assets.xcassets; Info.plist › NSExtension › NSExtensionPointIdentifier: com.apple.widgetkit-extension; Embed Foundation Extensions | With Control true, Live Activity false, Configuration false: `___PACKAGENAME:identifier___.swift` from `Widget-Static.swift`, `___PACKAGENAME:identifier___Control.swift` from `Control-Static.swift`, `___PACKAGENAME:identifier___Bundle.swift` from `WidgetBundle-Control.swift`. The catalog has `AccentColor`, `WidgetBackground`, and the generated `AppIcon`; the branch has the same four items. The `Info.plist:NSExtension` definition has the key and the value. The sample project has the phase "Embed Foundation Extensions". | correct | T2, P1, P2 |
| 911-915 | Three Model files in all three targets | The exception set for the control extension lists exactly `Model/CameraState.swift`, `Model/DataTypes.swift`, `Model/Intent/AVCamCaptureIntent.swift`. Apple: the intent must be in the app, the control extension, and the capture extension. | corrected: the step now gives the Add button, the Choose Targets dialog, and Save | P1, A1, A2, A3 |
| 922-929 | Control target: Minimum Deployments iOS 26.0; the four Swift settings; Bundle Identifier com.karolkakol.AVCam.AVCamControlCenterExtension | Same values in the two configurations of the control target. The bundle identifier follows the template rule with the product name, not the target name. | correct (section name unverified, see line 754) | P1, S2, T2 |
| 936-940 | Target AVCam › Build Phases: Target Dependencies: both extensions; Embed ExtensionKit Extensions: AVCamCaptureExtension.appex; Embed Foundation Extensions: AVCamControlCenterExtension.appex | The app target has two `PBXTargetDependency` items and the two phases with these files. `dstPath = $(EXTENSIONS_FOLDER_PATH)` (Extensions) and `dstSubfolderSpec = 13` (PlugIns). | correct | P1 |
| 947-950 | AVCam.app › Show Package Contents: Extensions, PlugIns | Follows from the two `dstPath` values. The page says that this result was verified with a build. The menu item "Product › Show Build Folder in Finder" is not in the evidence. | correct (menu name unverified) | P1 |
| 957-963 | On an iPhone (not tested): Team, Control Center, Lock Screen, Action button | Apple: a control can launch a capture extension "from Control Center, the Lock Screen, or by using the Action button". The block title already says "not tested for this tutorial". | unverified, as labelled | A3 |

## Changes on the page

1. Line 646: added "The Team field and the scheme dialog were not checked in the Xcode window."
2. Line 669: added "The text of the delete dialog was not checked in the Xcode window."
3. Line 740: the Target Membership step now says "under Target Membership, click the Add button (+). In the Choose Targets dialog, select `AVCamCaptureExtension`, and click Save." (A1)
4. Line 756: added "The name of the section in the General tab was not checked in the Xcode window."
5. Line 907: the second Target Membership step now gives the same three actions with `AVCamControlCenterExtension`. (A1)

No value in a `settings` block changed. No code fence with `file=` changed. The corrections of the earlier review (`chapters-11-13.md`, findings 13 to 15) stay.

## Not checked

- The Xcode dialogs: the Team field, the scheme activation dialog, the delete dialog, the Choose Targets dialog for files in a synchronized folder, and the order of the three checkboxes in the Widget Extension dialog.
- The names "Minimum Deployments" (General tab), "View › Inspectors › File", and "Product › Show Build Folder in Finder". These are not in the template, xcspec, plist, or documentation files.
- The categories in which the Build Settings tab shows the four Swift settings. The xcspec gives "Language", "Concurrency", and "Upcoming Features"; the page does not name categories, so nothing was changed.
