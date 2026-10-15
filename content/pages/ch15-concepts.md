---
kind: article
chapter: 15
title: Concepts: Lock Screen and Control Center
abstract: How a person starts a camera app from the Lock Screen, Control Center, the Action button, and the Camera Control, what a capture extension is, and how the app and the extension share their state.
estimatedMinutes: 14
branch: chapter-15
---

The best photo moment is short. A person who must unlock the iPhone, find the app icon, and wait for the app loses that moment. Thus iOS lets a camera app start from places that are faster than the Home Screen, also while the iPhone is locked.

This is not only a shortcut to your app. On a locked iPhone, the system does not start your app at all. It starts a small second program from your app bundle, a capture extension, which has strict limits. This article explains the parts, the limits, and the method that the app and the extension use to share their state. In [Build: Lock Screen and Control Center](ch15-build.md), you add two extension targets to the project.

> [!IMPORTANT]
> Nobody tested this chapter on an iPhone. The two extensions build, and the app contains them. The start from the Lock Screen, Control Center, and the Action button needs a real iPhone and a development team for code signing. The facts in this article come from the Apple documentation, the WWDC sessions, the SDK, and a careful read of the sample.

## How it works

### Four ways to start without the Home Screen

| Start location | What the person does one time | What the app must supply |
|---|---|---|
| Lock Screen | Customizes the Lock Screen and replaces one of the two controls at the bottom. | A control and a capture extension |
| Control Center | Opens Control Center, adds a control, and selects "Open AVCam". | A control |
| Action button | Opens Settings › Action Button and selects a control. | A control |
| Camera Control | Opens Settings › Camera › Camera Control and selects the app. | The LockedCameraCapture framework |

The system adds nothing by itself. The person must add the control. The [design guidelines for controls](https://developer.apple.com/design/human-interface-guidelines/controls) tell you to show instructions for this in your app. AVCam shows none.

> [!NOTE]
> The Apple article about the [Camera Control](https://developer.apple.com/documentation/avfoundation/enhancing-your-app-experience-with-the-camera-control) says only that an app must adopt the LockedCameraCapture framework before the Camera Control can start it. It does not say whether the app also needs the control. Nobody tested this for the tutorial.

### Three parts in one app bundle

The feature has three parts. Each part is a target in Xcode, and each target makes one program.

- **The app.** You built it in chapters 1 to 14.
- **The capture extension.** It shows the camera interface when the start comes from the Lock Screen.
- **The control extension.** It supplies the button that the person puts in Control Center, on the Lock Screen, or on the Action button. It never opens the camera.

One small type connects the three parts: a capture intent. The control performs the intent. The system then starts the app or the capture extension.

![The control performs the capture intent, iOS starts the app or the capture extension, and the two programs read and write one app context](../images/ch15-shared-context.svg)

### The capture extension

An app extension is a separate program in the app bundle. The system starts it for one task. A **capture extension** (the full name is "locked camera capture extension") has the task to show a camera interface without an unlock. The framework is [LockedCameraCapture](https://developer.apple.com/documentation/lockedcameracapture), and it is available from iOS 18.

The capture extension uses [ExtensionKit](https://developer.apple.com/documentation/extensionkit), the newer of the two extension systems of iOS. You see this in three places:

- Its `Info.plist` file has the key `EXAppExtensionAttributes` with the extension point `com.apple.securecapture`.
- Xcode puts the built extension into the `Extensions` folder of the app.
- Its entry point is a Swift structure with a `body`, almost the same as a SwiftUI app.

The life of a capture extension has these stages:

1. **Launch.** The person uses the control on the Lock Screen. The system starts the extension and gives it a session object.
2. **Capture.** The extension shows its viewfinder. The person takes photos or records video.
3. **Save.** The extension writes the media to the Photos library, or it writes files into a directory that the session object supplies.
4. **Dismiss.** The person swipes up or presses the side button. The system suspends the extension. Then it moves the session directory to the app and erases all other data of the extension.

### The limits on a locked device

A locked iPhone protects the data of its owner. A program that runs without an unlock must not become a way around that protection. Thus the extension has these limits:

- **No network.**
- **No shared container.** The extension cannot read or write an App Group container or shared preferences.
- **No memory of earlier launches.** The system erases the container of the extension after each use.
- **A viewfinder immediately.** The extension must show a camera preview at launch, and it must handle hardware capture events. The [`onCameraCaptureEvent`](https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:defaultsounddisabled:action:)) modifier from chapter 13 does this. If the extension does not do these things, the system stops it after a short time.
- **Photos: write, and read only its own media.** The extension can add media to the library. While the device is locked, it can read only the media of the current capture session.
- **Permissions come from the app.** The extension uses the camera and Photos permissions of the app. If the app has no camera permission, the system asks the person to unlock and opens the app.
- **Usage descriptions in the two targets.** The app and the extension must each have [`NSCameraUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription).

These limits also apply when the person starts the extension on an iPhone that is not locked.

### The LockedCameraCapture types

The framework is small. Apple added no type to it after iOS 18.1.

| Type | Where | Task |
|---|---|---|
| [`LockedCameraCaptureExtension`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracaptureextension) | Extension | The protocol of the `@main` type. It has a `body` that returns a scene. |
| [`LockedCameraCaptureUIScene`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracaptureuiscene) | Extension | The scene. Its closure gets the session object and returns your SwiftUI view. |
| [`LockedCameraCaptureSession`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession) | Extension | The session object. It supplies [`sessionContentURL`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession/sessioncontenturl), the directory that the system moves to the app, and [`openApplication(for:)`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession/openapplication(for:)), which opens the app after the person unlocks the device. |
| [`LockedCameraCaptureManager`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager) | App | Gives the app the directories that capture sessions left. [`sessionContentUpdates`](https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager/sessioncontentupdates) is an async sequence of these directories. |

Do not confuse `LockedCameraCaptureSession` with `AVCaptureSession`. The first is one use of the extension. The second is the camera pipeline. The extension has one of each.

### The capture intent

An app intent is a type that describes one action of your app to the system. [`CameraCaptureIntent`](https://developer.apple.com/documentation/appintents/cameracaptureintent) is a special protocol for one action: "start the camera experience of this app". When a control performs such an intent, the system knows that it can start the capture extension. A normal intent that opens the app, for example an [`OpenIntent`](https://developer.apple.com/documentation/appintents/openintent), can only open the app, and that needs an unlock.

The intent type must be a part of all three targets. The control extension needs it for its button. The system looks for it in the app and in the capture extension to start them.

The intent of AVCam is small:

```swift file=AVCam/Model/Intent/AVCamCaptureIntent.swift
struct AVCamCaptureIntent: CameraCaptureIntent {

    /// The context object for the capture intent.
    typealias AppContext = CameraState
    
    static let title: LocalizedStringResource = "AVCamCaptureIntent"
    static let description: IntentDescription = IntentDescription("Capture photos and videos with AVCam.")

    @MainActor
    func perform() async throws -> some IntentResult {
        os.Logger().debug("AVCam capture intent performed successfully.")
        // The return type of this intent is None; the success status isn't user-visible.
        return .result()
    }
}
```

`perform()` only writes to the log. The system starts the camera experience because the type conforms to the protocol, not because of code in `perform()`. An app with more than one screen can use `perform()` to go to its camera screen.

### The app context

The extension cannot use shared preferences. So how does it know that the person used video mode in the app the last time?

The answer is the [`AppContext`](https://developer.apple.com/documentation/appintents/cameracaptureintent/appcontext-swift.associatedtype) of the intent. It is a `Codable` type that you define. The system stores one value of it for your app. Each program that contains the intent can read the value with [`appContext`](https://developer.apple.com/documentation/appintents/cameracaptureintent/appcontext-swift.type.property) and replace it with [`updateAppContext(_:)`](https://developer.apple.com/documentation/appintents/cameracaptureintent/updateappcontext(_:)). The value must not be larger than 4 kB as JSON. It is for settings, not for images.

In AVCam, the context type is `CameraState`, a structure with five values: the capture mode, the Live Photo setting, the quality prioritization, and two HDR values. The flow is this:

1. **Read at start.** `CameraModel.start()` calls `syncState()`. This method reads the context and copies the values into the model. Then the model gives the state to `CaptureService.start(with:)`, so the capture session starts in the correct mode with one configuration.
2. **Write on each change.** Each property of the model that is in the state has a `didSet` observer. The observer copies the new value into `cameraState`. Each property of `CameraState` also has a `didSet` observer, which sends the full structure to the system.
3. **Read again when the app becomes active.** The app calls `syncState()` each time its scene becomes active. Thus the app gets the changes that the person made in the extension.

The same `CameraModel` runs in the app and in the extension, so steps 1 and 2 occur in the two programs. Step 3 is in the app only.

### The control

A control is a small button or toggle from your app. You build it with WidgetKit, and it is in a widget extension. A widget extension is an extension of the older type: its `Info.plist` file has the key `NSExtension` with the extension point `com.apple.widgetkit-extension`, and Xcode puts it into the `PlugIns` folder of the app.

The control of AVCam uses three types:

- [`ControlWidget`](https://developer.apple.com/documentation/swiftui/controlwidget) is the protocol of a control.
- [`StaticControlConfiguration`](https://developer.apple.com/documentation/widgetkit/staticcontrolconfiguration) describes a control that the person cannot configure. Its `kind` string identifies the control.
- [`ControlWidgetButton`](https://developer.apple.com/documentation/widgetkit/controlwidgetbutton) is a button that performs an app intent. A button is correct here, because the action starts something. A toggle is for a state that is on or off.

A [`WidgetBundle`](https://developer.apple.com/documentation/swiftui/widgetbundle) is the `@main` type of the widget extension. It lists the widgets and the controls that the extension supplies. For AVCam, that is one control.

### Which one starts: the app or the extension

Apple documents the rule only in general terms. The WWDC24 session about the Lock Screen camera says that the system decides, from conditions such as "Lock Screen or Home Screen", whether to start the extension or the app. These facts are documented:

- The extension runs when the start comes from the Lock Screen. It does not matter whether the device is locked at that moment.
- If the app has no camera permission, the system asks for an unlock and opens the app.
- The Camera Control can start the experience from a locked device, from the Home Screen, and from other apps.

A reasonable reading is: a start from the Lock Screen gives the extension, and a start from an unlocked context gives the app. This is an inference, and Apple does not publish an exact table. To find out on your iPhone, write a log line in each `@main` type and look at which line appears.

## What the camera can do

AVCam uses the minimum of the system integrations. The system offers more.

| Capability | What it gives | In this tutorial |
|---|---|---|
| Control with a capture intent | A start from the Lock Screen, Control Center, and the Action button. | This chapter |
| Capture extension | The camera interface on a locked device. | This chapter |
| App context | Small shared state for the app and the extension. | This chapter |
| Open the app from the extension | `openApplication(for:)` asks for an unlock and gives the app a user activity. Use it for "view", "edit", or "share" actions. | Not in AVCam |
| Session content directory | Files that the extension writes into `sessionContentURL` go to the app. The app reads them with `LockedCameraCaptureManager`. | Not in AVCam |
| Controls with options or state | [`AppIntentControlConfiguration`](https://developer.apple.com/documentation/widgetkit/appintentcontrolconfiguration) for a control that the person configures, and [`ControlWidgetToggle`](https://developer.apple.com/documentation/widgetkit/controlwidgettoggle) for a state. For example, a second control that starts in video mode. | Not in AVCam |
| [App Shortcuts](https://developer.apple.com/documentation/appintents/app-shortcuts) | Actions of the app in Siri, Spotlight, the Shortcuts app, and on the Action button. | Not in AVCam |
| [Camera schemas for Siri](https://developer.apple.com/documentation/appintents/assistantschemas/cameraintent) | Intents that Siri and Apple Intelligence understand: start or stop a capture, change the camera, open in a capture mode. | Not in AVCam |
| [Home Screen quick actions](https://developer.apple.com/documentation/uikit/add-home-screen-quick-actions) | A menu on the app icon, for example "Record Video". | Not in AVCam |
| Live Activities | The recording state on the Lock Screen and in the Dynamic Island, with [ActivityKit](https://developer.apple.com/documentation/activitykit). | Not in AVCam |
| Hardware capture events | The volume buttons, the Action button, and AirPods take the photo. | Chapter 13 |
| Camera Control overlay | Zoom, exposure, and custom controls. | Chapter 14 |

## Why AVCam does it this way

**The same model and views in the extension.** The capture extension creates a `CameraModel` and shows a `CameraView`, the same as the app. To make this possible, 28 Swift files of the app are also a part of the extension target. The person sees one camera interface in the two places, and you maintain one set of code. The alternative is a framework target that the app and the extension link. That is cleaner for a large app, but it is more project setup than a sample needs.

**The state goes through the intent.** One small `Codable` structure, a write on each change, and a read at the start. No App Group, no entitlement, no file. The alternative that most developers know, `UserDefaults` in an App Group, does not work in a capture extension.

**The session starts in the stored mode.** Before this chapter, the session always started in photo mode. Now `setUpSession()` reads the mode: it selects the preset, and in video mode it adds the movie output immediately. The alternative is to start in photo mode and then change the mode. That configures the session two times, and the person sees it.

**Media goes directly to Photos.** `MediaLibrary` has no special code for the extension. It saves with a [`PHAssetCreationRequest`](https://developer.apple.com/documentation/photos/phassetcreationrequest), and a write to the Photos library is permitted on a locked device. Apple recommends this path for photos and videos. AVCam only saves to Photos, so it needs no code in the app that collects files later.

**AVCam ignores the session object.** The closure of `LockedCameraCaptureUIScene` gets a `LockedCameraCaptureSession`, and the code never uses it. Thus AVCam has no button that opens the app from the Lock Screen, and it writes no files into the session directory. This keeps the sample small. It also leaves out features that a real camera app needs. See the next section.

## Things to know about the sample

These points come from a careful read of the Apple sample. Nobody verified them on an iPhone for this tutorial. Read each point as "probably".

- **A recording can get lost.** A movie in progress is a file in the temporary directory of the extension. If the person dismisses the extension before the recording stops and the save completes, the system erases that directory. A robust app writes the movie into `sessionContentURL` and collects it in the app.
- **The thumbnail button opens the photo picker in the extension too.** What the picker does on a locked device is not documented. The correct design is a call to `openApplication(for:)`, so that the person unlocks the device and sees the library in the app.
- **Each activation runs the mode change again.** `syncState()` assigns `captureMode`. The `didSet` observer of that property then calls `setCaptureMode(_:)` of the capture service, also when the mode is the same as before. In video mode, that method tries to add the movie output a second time and throws an error. The model uses `try?`, so nobody sees the error. Your own app can compare the old value with the new value first.
- **The writes have no order.** One call to `syncState()` sets four properties of the model, and their observers write the same values back into the state. Each write starts a new task that sends the full structure to the system. Swift does not promise the order of these tasks, so an old value can arrive last. One serial task, or a short delay that collects the changes, prevents this.
- **HDR is on in the default state.** `CameraState` starts with `isVideoHDREnabled = true`, and the model starts with `false`. When no stored state exists, `syncState()` copies `true` into the model. On a camera with a 10-bit format, the first change to video mode then turns HDR on.
- **`isVideoHDRSupported` is stored, but no code reads it.**
- **Errors only go to the log.** If the read of the context fails, the app uses the default state and tells nobody.
- **The extension does not sync again.** It reads the state one time, at its start. This is sufficient, because the system starts the extension again for each use.
- **Permission requests in the extension.** `MediaLibrary` requests access to Photos and to the location. The app makes these requests at the first save, not at launch. If the person never saved a photo or a movie in the app, these requests run in the extension, possibly on a locked device. What the system does then is not documented. Tell the person to take one photo in the app first.
- **The symbol of the control is `curlybraces`.** On the Lock Screen and on the Action button, the person sees only the symbol. A real app uses a symbol that shows a camera.

## Common mistakes

- **The intent is not a part of all three targets.** The control then does not start the camera experience. A build error does not always tell you why.
- **The app entry point is a part of the extension.** A program can have only one `@main` type. `AVCamApp.swift` must stay out of the capture extension.
- **You use an App Group for the shared state.** It works in the app and fails in the capture extension. Use the app context.
- **You put large data into the app context.** The system does not store a context that is larger than 4 kB.
- **You change a stored type carelessly.** The system keeps the old JSON. If a new app version cannot decode it, the read fails, and the app starts with defaults. The raw values of `CaptureMode` and `QualityPrioritization` are a part of the stored data. Do not change them.
- **The extension has no camera usage description.** The key must be in the extension target too, not only in the app.
- **The extension shows no viewfinder, or it does not handle capture events.** The system stops it shortly after the launch.
- **You change the `kind` string of a control.** The string identifies the control. After a change, the controls that people added probably disappear.
- **The bundle identifier of an extension does not start with the identifier of the app.** The identifier must be the identifier of the app, a period, and a name. Xcode does this for you when it creates the target.
- **You use a different team for one target.** All three targets must have the same team for code signing.
- **You expect the control to appear by itself.** The person must add it. Show the steps in your app.

## Documentation

```links
Creating a camera experience for the Lock Screen | https://developer.apple.com/documentation/lockedcameracapture/creating-a-camera-experience-for-the-lock-screen | The main Apple article: the limits, the template, the intent, and the move to the app. Its code for the user activity has an error: create the activity with NSUserActivity(activityType:).
LockedCameraCapture | https://developer.apple.com/documentation/lockedcameracapture | The framework of the capture extension.
LockedCameraCaptureExtension | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracaptureextension | The protocol of the entry point of the extension.
LockedCameraCaptureSession | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturesession | The session object that AVCam does not use.
LockedCameraCaptureManager | https://developer.apple.com/documentation/lockedcameracapture/lockedcameracapturemanager | How the app gets the files of a capture session.
CameraCaptureIntent | https://developer.apple.com/documentation/appintents/cameracaptureintent | The intent protocol that starts a camera experience.
updateAppContext(_:) | https://developer.apple.com/documentation/appintents/cameracaptureintent/updateappcontext(_:) | The write operation for the shared state. The page gives the 4 kB limit.
Creating controls to perform actions across the system | https://developer.apple.com/documentation/widgetkit/creating-controls-to-perform-actions-across-the-system | How to build a control with WidgetKit.
Adding refinements and configuration to controls | https://developer.apple.com/documentation/widgetkit/adding-refinements-and-configuration-to-controls | Tint, labels, and controls that the person configures.
ControlWidgetButton | https://developer.apple.com/documentation/widgetkit/controlwidgetbutton | The button template of a control.
Human Interface Guidelines: Controls | https://developer.apple.com/design/human-interface-guidelines/controls | Design rules for controls and for camera experiences on a locked device.
Human Interface Guidelines: Action button | https://developer.apple.com/design/human-interface-guidelines/action-button | Design rules for actions on the Action button.
Use the Camera Control to open another app on iPhone | https://support.apple.com/guide/iphone/use-the-camera-control-to-open-another-app-iph3940f00d2/ios | The steps for the person in Settings.
Configuring a new target in your project | https://developer.apple.com/documentation/xcode/configuring-a-new-target-in-your-project | How to add a target in Xcode.
WWDC24: Build a great Lock Screen camera capture experience | https://developer.apple.com/videos/play/wwdc2024/10204/ | The source for the life of the extension, the limits, and the intent.
WWDC24: Extend your app's controls across the system | https://developer.apple.com/videos/play/wwdc2024/10157/ | How to build controls.
WWDC24: Bring your app's core features to users with App Intents | https://developer.apple.com/videos/play/wwdc2024/10210/ | Background for app intents.
Build: Lock Screen and Control Center | ch15-build.md | The tutorial for this chapter.
```
