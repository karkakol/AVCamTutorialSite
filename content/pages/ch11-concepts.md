---
kind: article
chapter: 11
title: Concepts: hardware buttons and AirPods
abstract: How the system sends a press of a hardware button or an AirPods stem to a camera app as a capture event, how the app answers with the correct sound, and how AirPods become a high-quality microphone.
estimatedMinutes: 12
branch: chapter-11
---

A person who holds an iPhone as a camera does not always want to touch the screen. A finger on the screen can hide the subject, and a tap can move the device. People know from the Camera app that a volume button also takes the photo. With AirPods, a person can put the iPhone on a tripod, walk into the picture, and click the stem of an AirPod.

Until now, AVCam captures only from its button on the screen. In this chapter, the volume buttons, the Action button, the Camera Control, and an AirPods stem click do the same job. AirPods also become a microphone with a good sound quality.

The chapter has little code: 31 lines. The ideas behind the lines are what you must know. You write the code in [Build: hardware buttons and AirPods](ch11-build.md).

> [!IMPORTANT]
> Nothing in this chapter works in the Simulator, with or without SimCam. All of it needs a real iPhone, and this tutorial did not run the code on one. The descriptions come from the SDK, from Apple's documentation, and from Apple's WWDC sessions. The two AirPods features are also not available in the European Union at this time.

## How it works

### Before capture events

For many years, iOS had no API that told an app about a press of a volume button. Camera apps wanted a hardware shutter, so they used tricks. The usual trick was to observe the output volume of the audio session: when the value changed, a volume button was pressed.

The trick had many problems. The volume really changed with each photo. At the maximum volume, the value could not go higher, so the app had to set it back in secret. The app also had to hide the volume indicator of the system. And the trick knew nothing about buttons that came later, such as the Camera Control.

Do not use this trick in new code. Since iOS 17.2, there is an API for this job.

### Capture events

The API has the name **capture events**. Its idea is simple: you attach a handler to a view of your camera interface. While the handler is active, the system sends a press of a hardware control to your app as an [`AVCaptureEvent`](https://developer.apple.com/documentation/avkit/avcaptureevent) object, and it does not do the usual job of the button. A volume button does not change the volume.

The API is in the AVKit framework, not in AVFoundation. It has two forms, and the two forms behave in the same way:

| | UIKit | SwiftUI |
|---|---|---|
| API | [`AVCaptureEventInteraction`](https://developer.apple.com/documentation/avkit/avcaptureeventinteraction), an interaction object that you add to a view | The `onCameraCaptureEvent` view modifier |
| Since | iOS 17.2 | iOS 18 |
| Import | `AVKit` | `SwiftUI` and `AVKit` |

In UIKit, you make the interaction with a closure and add it to the view that shows the preview:

```swift
let interaction = AVCaptureEventInteraction { event in
    if event.phase == .ended {
        capture()
    }
}
previewView.addInteraction(interaction)
```

This code is not in the project. It compiles against the iOS 26 SDK, and nobody ran it.

In SwiftUI, the modifier does the same work. AVCam uses the modifier, because its interface is SwiftUI.

> [!NOTE]
> The modifier is in a small module that Swift loads only when a file imports `SwiftUI` and `AVKit` together. `import AVFoundation` does not give you the modifier or the `AVCaptureEvent` type. `CameraView.swift` already has the two imports. You added `import AVKit` in chapter 8.

### When the system sends events

The system sends capture events only when all of these conditions are true:

- The app is in the foreground.
- The app uses the camera. In practice, this means that a capture session runs.
- The view that has the handler is part of the interface.
- The app uses the events to capture media, and for nothing else.

The conditions protect the person. A game or a reader app cannot take the volume buttons for its own functions. Only a camera that the person can see gets the events.

The conditions also give a rule for you. Because the handler replaces the usual job of the button, your app must do something for each event. If the app cannot capture at this time, disable the handler. Then the buttons do their usual job again. The `isEnabled` parameter of the modifier, and the [`isEnabled`](https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/isenabled) property in UIKit, are for this.

### Primary and secondary events

There are two kinds of event. A **primary** event is the shutter. A **secondary** event is for a second function that the app selects, for example a camera switch.

![Four hardware controls send a primary event. The volume up button sends a secondary event, or a primary event when the app has no secondary handler. AVCam handles the two kinds in one closure.](../images/ch11-event-sources.svg)

| Hardware control | Event | Notes |
|---|---|---|
| Volume down button | Primary | Since iOS 17.2 |
| Volume up button | Secondary | Becomes a primary event when the app has no secondary handler |
| Action button | Primary | |
| Camera Control, full press | Primary | iPhone 16 and later, since iOS 18 |
| AirPods stem click | Primary | Since iOS 26, AirPods with the H2 chip |

Three more rules:

- One press calls one handler only. It never calls the two handlers.
- If one control starts an event, the system ignores the other controls until that event ends or is cancelled.
- The event has no property for the control that sent it. Your code knows only if the event is primary or secondary.

The Camera Control does more than the full press. A light press and a slide change camera settings, with a different API. That is the subject of chapter 12.

### The phases of an event

One press gives more than one call of your handler. Each call has a [`phase`](https://developer.apple.com/documentation/avkit/avcaptureeventphase):

| Phase | Meaning |
|---|---|
| `.began` | The person pushed the control down. |
| `.ended` | The person released the control. |
| `.cancelled` | The system stopped the event before the person released the control. The press must not count. |

For "one click, one photo", you act on one phase only. If you act on all phases, one click takes two photos. AVCam acts on `.ended`.

The `.began` phase is for a function that needs to know how long the press is. For example, an app can start a timer at `.began`. If the control is still down after half a second, the app records a movie until `.ended`. If `.ended` comes first, the app takes a photo. An app that starts something at `.began` must also stop it at `.cancelled`.

### The overloads of the modifier

The SDK has six overloads of `onCameraCaptureEvent`. They differ in three ways:

- **One closure or two.** With `action:`, one closure gets the primary and the secondary events. With `primaryAction:` and `secondaryAction:`, each kind has its own closure.
- **With or without a sound parameter.** The iOS 18 overloads have only [`isEnabled`](https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:action:)). The iOS 26 overloads add [`defaultSoundDisabled`](https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:defaultsounddisabled:action:)).
- **Synchronous or `async` closures.** The iOS 26 overloads exist with synchronous closures and with `async` closures. Apple's documentation pages show only the synchronous forms. The `async` forms are in the interface file of the SDK.

You do not select an overload by name. The compiler selects it from the arguments and from the body of the closure. AVCam gives one closure, the `defaultSoundDisabled` argument, and a body that contains `await`. So the compiler selects the iOS 26 overload with one `async` closure.

The modifier is a main actor API, and `CameraView` is a main actor type. The model lives on the main actor too, so the closure can read the model directly.

### Sounds for a person who is not near the screen

When a person presses a volume button, the person holds the iPhone and sees the screen flash. When a person clicks an AirPods stem, the iPhone can be some meters away. That person needs a different confirmation: a sound in the AirPods.

iOS 26 adds the sound API to capture events:

- **The default sound.** For a stem click, the system plays a default tone in the AirPods. The app does nothing.
- **`defaultSoundDisabled`.** If you set this parameter to `true`, the system plays no tone. Your app now has the responsibility for the sound. In UIKit, the same switch is the class property [`defaultCaptureSoundDisabled`](https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/defaultcapturesounddisabled), which applies to the full app.
- **[`shouldPlaySound`](https://developer.apple.com/documentation/avkit/avcaptureevent/shouldplaysound).** This property of the event is `true` only when two things are true: the event came from an AirPods stem click, and the app disabled the default sound.
- **[`play(_:)`](https://developer.apple.com/documentation/avkit/avcaptureevent/play(_:)).** This method of the event plays a sound through the AirPods.
- **[`AVCaptureEventSound`](https://developer.apple.com/documentation/avkit/avcaptureeventsound).** The sound itself. The system supplies three: `.cameraShutter`, `.beginVideoRecording`, and `.endVideoRecording`. You can also make a sound from a file in your app bundle with `AVCaptureEventSound(url:)`.

Why would an app disable the default tone? Because the default tone is the same for each action. AVCam has three actions: a photo, the start of a movie, and the end of a movie. With its own sounds, the person can hear which of the three occurred.

The sound API has limits that you must know:

- `play(_:)` does nothing when `shouldPlaySound` is `false`. So it does nothing for a volume button, for the Action button, and for the Camera Control.
- `play(_:)` does nothing when the event is more than 15 seconds old.
- The sound is not the usual shutter sound of the iPhone. The photo output plays that sound by itself, as it did in chapter 3. Do not use `shouldPlaySound` to control the usual shutter sound.
- When you disable the default tone and then play nothing, the person hears nothing at all. The person cannot know if the capture occurred.

### What AVCam does with an event

This is the complete code that AVCam adds to its preview:

```swift file=AVCam/CameraView.swift
                CameraPreview(source: camera.previewSource)
                    // Handle capture events from device hardware buttons.
                    .onCameraCaptureEvent(defaultSoundDisabled: true) { event in
                        if event.phase == .ended {
                            let sound: AVCaptureEventSound
                            switch camera.captureMode {
                            case .photo:
                                sound = .cameraShutter
                                // Capture a photo when pressing a hardware button.
                                await camera.capturePhoto()
                            case .video:
                                sound = camera.captureActivity.isRecording ?
                                    .endVideoRecording : .beginVideoRecording
                                // Toggle video recording when pressing a hardware button.
                                await camera.toggleRecording()
                            }
                            // Play a sound when capturing by clicking an AirPods stem.
                            if event.shouldPlaySound {
                                event.play(sound)
                            }
                        }
                    }
```

Read it from top to bottom:

1. The closure ignores all phases but `.ended`.
2. It reads the capture mode. In photo mode, it selects the shutter sound and takes a photo.
3. In video mode, it selects the sound first and toggles the recording second. This order is necessary. After the toggle, `isRecording` can have the opposite value, and the closure would then select the wrong sound.
4. At the end, it plays the sound, but only if the event asks for one.

The closure calls `capturePhoto()` and `toggleRecording()`. These are the same two methods that the button on the screen calls. So a hardware control and the screen button always do the same thing.

### AirPods as a remote control

The stem click is not a separate API. It arrives as a primary capture event, the same as a volume down press. An app that already used capture events got this feature in iOS 26 with no new code. The only new work for a developer is the sound.

The person must turn the feature on. In the Settings app, the page of the connected AirPods has a **Camera Remote** setting, with the choices "Press Once" and "Press and Hold". Apple's support page [Use AirPods with supported camera apps](https://support.apple.com/guide/airpods/use-airpods-with-camera-apps-dev8e2a2ba2e/web) lists the steps and the AirPods models. While a camera app is in use, the selected stem gesture does not do its usual job, for example play and pause.

### AirPods as a microphone

The second AirPods feature is about audio and is independent of capture events.

In the usual Bluetooth recording mode, a headset sends its microphone signal with the Hands-Free Profile (HFP). That profile was made for phone calls, and its audio quality is low. iOS 26 adds a high-quality recording mode for AirPods that support it. Apple tuned it for people who make videos: it balances the voice and the background sounds, as a small microphone on the clothes does.

An app must ask for this mode. In [chapter 8](ch08-concepts.md), you learned that the capture session configures the audio session of the app by default. So the request is one property of the session:

```swift file=AVCam/CaptureService.swift
            // Enable using AirPods as a high-quality lapel microphone.
            captureSession.configuresApplicationAudioSessionForBluetoothHighQualityRecording = true
```

[`configuresApplicationAudioSessionForBluetoothHighQualityRecording`](https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessionforbluetoothhighqualityrecording) is `false` by default. When it is `true`, the session includes the high-quality mode in the audio session configuration that it makes.

> [!IMPORTANT]
> The property does not select the AirPods as the microphone. It only makes them available. The person selects the microphone, for example in Control Center while the camera app is in use. If the person selects nothing, the microphone of the iPhone probably records, as before. Apple's sources do not say this directly.

## What the camera can do

AVCam uses a small part of the two APIs. This is the full map.

> [!NOTE]
> Nobody tested these features on a real device for this tutorial. Test each one on hardware before you rely on it.

### Capture events

- **Two functions.** Give a `primaryAction` and a `secondaryAction`. The volume up button then has its own function. This sketch takes a photo for a primary event and changes the camera for a secondary event. It is not in the project, and `isReady` is a Boolean value that you must supply. The sketch compiles against the iOS 26 SDK, and nobody ran it.

```swift
CameraPreview(source: camera.previewSource)
    .onCameraCaptureEvent(isEnabled: isReady, defaultSoundDisabled: true) { event in
        // Primary: volume down, Action button, Camera Control, AirPods stem.
        guard event.phase == .ended else { return }
        if event.shouldPlaySound { event.play(.cameraShutter) }
        await camera.capturePhoto()
    } secondaryAction: { event in
        // Secondary: volume up.
        guard event.phase == .ended else { return }
        await camera.switchVideoDevices()
    }
```

- **Press and hold.** Use `.began` and `.ended` together to tell a short click from a long press, as the section about phases describes.
- **A switch.** Give `isEnabled: false` while the app cannot capture. The buttons then do their usual job.
- **A custom sound.** Make an `AVCaptureEventSound` from a sound file in the app bundle.
- **The default tone.** Leave `defaultSoundDisabled` out. The system then plays its tone for a stem click, and your closure does not need sound code.
- **UIKit.** [`init(handler:)`](https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/init(handler:)) and [`init(primary:secondary:)`](https://developer.apple.com/documentation/avkit/avcaptureeventinteraction/init(primary:secondary:)) give the same two choices as the modifier.

### Audio for video

- **A manual audio session.** An app that configures its `AVAudioSession` itself does not use the session property. It adds the category option [`bluetoothHighQualityRecording`](https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/bluetoothhighqualityrecording) to a play-and-record category with the default mode. Together with the HFP option, HFP is the fallback for a headset that does not support the new mode.
- **A microphone picker in the app.** [`AVInputPickerInteraction`](https://developer.apple.com/documentation/avkit/avinputpickerinteraction) (AVKit, iOS 26) shows the system menu of audio inputs from a button in your interface. The person then does not have to open Control Center.
- **A question to the microphone.** A Bluetooth input port has a [`bluetoothMicrophoneExtension`](https://developer.apple.com/documentation/avfaudio/avaudiosessionportdescription/bluetoothmicrophoneextension). It tells you if the microphone supports high-quality recording, and if the mode is on. An app can use it to show which microphone records.
- **No ringtone in the recording.** [`setPrefersNoInterruptionsFromSystemAlerts(_:)`](https://developer.apple.com/documentation/avfaudio/avaudiosession/setprefersnointerruptionsfromsystemalerts(_:)) asks the system not to interrupt a recording with the sound of an incoming call.
- **Audio from other apps.** [`configuresApplicationAudioSessionToMixWithOthers`](https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessiontomixwithothers) lets music from a different app continue while your session runs.
- **Stereo and Spatial Audio.** The [`multichannelAudioMode`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/multichannelaudiomode) property of the microphone input records stereo or Spatial Audio. It applies to the built-in microphones only. With an external microphone, and AirPods are one, the system ignores it.

### Limits

- **Region.** The AirPods remote control and the high-quality recording mode are not available in the European Union at this time. A learner there cannot test them.
- **Hardware.** The stem click needs AirPods with the H2 chip. The Camera Control exists on iPhone 16 models and later, and not on iPad.
- **Delay.** The high-quality mode can add a delay to the microphone signal. It is for recordings, not for calls.
- **Other platforms.** The SDK marks the sound API and the session property as not available for Mac Catalyst.
- **Unknown.** No Apple source that this tutorial found says if a Bluetooth shutter remote from a different company sends capture events.

## Why AVCam does it this way

**One closure for all controls.** The sample has no second function for the volume up button. With the `action:` form, the volume up button is a shutter too, as in the Camera app.

**The modifier is on the preview.** A capture event belongs to a camera view. `CameraPreview` is the view that shows the camera, and it is on the screen as long as the camera interface is.

**The `.ended` phase.** A photo at the release of the button is the behavior of a click. It also leaves the `.began` phase free for a press-and-hold function, which the sample does not have.

**The same model methods as the screen button.** The closure does not talk to the capture service. It calls the `Camera` protocol, as `CaptureButton` does. All rules of a capture stay in one place: the model.

**An `async` closure.** Before iOS 26, the sample used the synchronous overload and started a `Task` in it, as the tap gesture from chapter 6 still does. The `async` overload removes the `Task`. It also lets the closure wait for the capture before it plays the sound.

**Three sounds.** The sample disables the default tone, because one tone cannot tell a photo from the start or the end of a movie.

**The capture button follows the model.** `CaptureButton` has its own `isRecording` state, and `MovieCaptureButton` changes the state when the person taps it. A hardware control does not tap the button. So `CaptureButton` now observes `camera.captureActivity.isRecording` and copies each change into the state, with the same animation that a tap uses:

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift
            // Respond to recording state changes that occur from hardware button presses.
            .onChange(of: camera.captureActivity.isRecording) { _, newValue in
                // Ensure the button animation occurs when toggling recording state from a hardware button.
                withAnimation(.easeInOut(duration: 0.25)) {
                    isRecording = newValue
                }
            }
```

**One Boolean for the audio.** AVCam lets the capture session manage the audio session, as chapter 8 explained. So one property of the capture session is sufficient, and the sample has no `AVAudioSession` code. The sample sets the property before it adds the microphone input and before the session starts. The session then probably configures the audio one time, with the correct value.

**One more reason, for chapter 13.** A capture extension for the Lock Screen must have a camera view that handles capture events. If it has none, the system stops the extension a short time after launch. The extension of AVCam uses the same `CameraView`, so it gets the handler from this chapter.

## Things to know about the sample

These points come from a careful read of the code. Nobody tested them on an iPhone for this tutorial.

- **The sound comes late.** In photo mode, the closure plays the sound after `await camera.capturePhoto()` returns. That method waits for the capture, and then for the save to the Photos library, which includes the location. So the person hears the shutter sound after the save, not at the moment of the capture. If the work takes more than 15 seconds, `play(_:)` does nothing. A better order is to play the sound first and to capture second. The sketch in the capability map does this.

![The event closure waits for the capture and the save, and plays the sound after them. After 15 seconds, the sound does not play.](../images/ch11-sound-timeline.svg)

- **The handler is always enabled.** The sample never gives `isEnabled: false`. While the app changes the capture mode, a volume button does not change the volume, and it probably captures nothing useful. A better value is a condition such as "the status is `running`, and no mode change is in progress". After the camera failed to start, no session runs, so the system sends no events and the buttons do their usual job.
- **`.cancelled` is ignored.** For a click, this is correct: a cancelled press must not take a photo.
- **The stop sound depends on a value that arrives later.** `captureActivity` goes from the capture service to the model through an asynchronous stream. If a person clicks two times very quickly, the closure can read an old value of `isRecording` and select the wrong sound.
- **The button has two sources for one fact.** A tap on the screen button changes the local `isRecording` state immediately. The model value follows later. If a recording does not start, the model value stays `false`, `onChange` does not run, and the button can stay in the "recording" form.
- **No availability check.** The sample sets the audio property with no `if #available`. That is correct for a deployment target of iOS 26. A project with an older target needs the check.
- **No microphone indicator.** The interface does not show which microphone records. A person who thinks that the AirPods record can get a movie with the sound of the iPhone microphone.

## Common mistakes

- **Only `import AVFoundation`.** The modifier and the event types are in AVKit. Without `import AVKit`, the compiler does not find `onCameraCaptureEvent`.
- **No phase test.** The closure runs for `.began` and for `.ended`. Without a test, one click captures two times.
- **A handler that does nothing.** When the handler is enabled, the volume buttons do not change the volume. If your closure does nothing in some state, the buttons look broken. Disable the handler in that state.
- **A handler outside a camera interface.** The system sends events only to an app that uses the camera for capture. The modifier is not a general "volume button" API.
- **A test before the session runs.** No events arrive in a SwiftUI preview, in the Simulator, before `startRunning()`, or in the background. This is not a bug in your code.
- **The default tone disabled, and no sound played.** A person with AirPods then gets no confirmation. If you set `defaultSoundDisabled` to `true`, each path through your closure must call `play(_:)` when `shouldPlaySound` is `true`.
- **`play(_:)` after long work.** The person waits for the confirmation, and after 15 seconds the sound does not play at all.
- **The recording state read after the toggle.** The closure can then play the start sound for a stop, and the stop sound for a start.
- **`shouldPlaySound` used for the usual shutter sound.** The value is `false` for the buttons of the iPhone. The photo output plays the usual shutter sound by itself.
- **The belief that the audio property selects the AirPods.** It only makes them available. The person selects the microphone.
- **A feature that depends on the AirPods.** The two AirPods features do not exist in all regions and not with all AirPods models. Your app must be fully usable without them.

## Documentation

```links
AVCaptureEventInteraction | https://developer.apple.com/documentation/avkit/avcaptureeventinteraction | The UIKit interaction that sends hardware capture events to a view.
AVCaptureEvent | https://developer.apple.com/documentation/avkit/avcaptureevent | The event object, with its phase and its sound methods.
AVCaptureEventPhase | https://developer.apple.com/documentation/avkit/avcaptureeventphase | The three phases: began, ended, and cancelled.
AVCaptureEventSound | https://developer.apple.com/documentation/avkit/avcaptureeventsound | The three system sounds, and sounds from your app bundle.
shouldPlaySound | https://developer.apple.com/documentation/avkit/avcaptureevent/shouldplaysound | The property that tells you if your app must play a sound for the event.
play(_:) | https://developer.apple.com/documentation/avkit/avcaptureevent/play(_:) | The method that plays a capture sound through the AirPods.
onCameraCaptureEvent(isEnabled:action:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:action:) | The SwiftUI modifier with one closure, since iOS 18.
onCameraCaptureEvent(isEnabled:primaryAction:secondaryAction:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:primaryaction:secondaryaction:) | The SwiftUI modifier with two closures, since iOS 18.
onCameraCaptureEvent(isEnabled:defaultSoundDisabled:action:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:defaultsounddisabled:action:) | The iOS 26 modifier with the sound parameter. AVCam uses the async form of it.
onCameraCaptureEvent(isEnabled:defaultSoundDisabled:primaryAction:secondaryAction:) | https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:defaultsounddisabled:primaryaction:secondaryaction:) | The iOS 26 modifier with the sound parameter and two closures.
configuresApplicationAudioSessionForBluetoothHighQualityRecording | https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessionforbluetoothhighqualityrecording | The session property that makes AirPods available as a high-quality microphone.
automaticallyConfiguresApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfiguresapplicationaudiosession | The property that decides if the capture session configures the audio session for you.
bluetoothHighQualityRecording | https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/bluetoothhighqualityrecording | The audio session option for apps that configure their audio session themselves.
AVInputPickerInteraction | https://developer.apple.com/documentation/avkit/avinputpickerinteraction | The system menu of audio inputs, for use in your app.
Use AirPods with supported camera apps | https://support.apple.com/guide/airpods/use-airpods-with-camera-apps-dev8e2a2ba2e/web | Apple's steps for the person: the Camera Remote setting, the AirPods models, and the microphone choice.
HIG: Action button | https://developer.apple.com/design/human-interface-guidelines/action-button | Apple's design rules for the Action button.
WWDC25: Enhancing your camera experience with capture controls | https://developer.apple.com/videos/play/wwdc2025/253/ | The session about capture events, primary and secondary events, and the AirPods remote control.
WWDC25: Enhance your app's audio recording capabilities | https://developer.apple.com/videos/play/wwdc2025/251/ | The session about high-quality recording with AirPods and the input picker.
Build: hardware buttons and AirPods | ch11-build.md | The tutorial for this chapter.
```
