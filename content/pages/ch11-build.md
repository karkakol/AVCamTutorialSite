---
kind: tutorial
chapter: 11
title: Build: hardware buttons and AirPods
abstract: Handle capture events from the hardware buttons and from AirPods, play the correct sound for each action, keep the capture button in the correct state, and make AirPods available as a high-quality microphone.
estimatedMinutes: 20
startBranch: chapter-10
branch: chapter-11
---

At the end of chapter 10, the only way to capture is the button on the screen. In this tutorial, you connect the hardware of the iPhone to the same capture code: the volume buttons, the Action button, the full press of the Camera Control, and the stem click of AirPods. You also make AirPods available as a microphone with a good sound quality.

You add no new files. You add 31 lines to three files. Most of them are one closure, and you write it slowly: a few lines in each step.

Read [Concepts: hardware buttons and AirPods](ch11-concepts.md) first. It explains capture events, their phases, the sound rules, and the two AirPods features.

> [!IMPORTANT]
> The Simulator has no hardware buttons that send capture events, no Camera Control, and no AirPods. You can build and run all steps there, but you see nothing new. To use the features of this chapter, you need a real iPhone. This tutorial did not run the code on one, so it gives you the expected results in words. The two AirPods features are also not available in the European Union at this time.

## Handle the capture event

A capture event is the message that the system sends to a camera app when a person presses a hardware control. In SwiftUI, you get the events with the `onCameraCaptureEvent` modifier on a view of the camera interface. While the modifier is active and the capture session runs, the volume buttons do not change the volume. They send events to your closure.

In this section, you write that closure. It takes a photo or toggles a recording, and it plays a sound for a person who used AirPods.

![Four hardware controls send a primary event. The volume up button sends a secondary event, or a primary event when the app has no secondary handler. AVCam handles the two kinds in one closure.](../images/ch11-event-sources.svg)

### Step
Open `CameraView.swift`, and make sure that the file imports `SwiftUI`, `AVFoundation`, and `AVKit`.

You add nothing in this step. The modifier and the event types are in the AVKit framework, not in AVFoundation. The modifier is available only in a file that imports `SwiftUI` and `AVKit` together. The file has the `AVKit` import since chapter 8.

```swift file=AVCam/CameraView.swift
import SwiftUI
import AVFoundation
import AVKit

@MainActor
struct CameraView<CameraModel: Camera>: PlatformView {
```

### Step
Add the `onCameraCaptureEvent` modifier to `CameraPreview`, as its first modifier, with `defaultSoundDisabled` set to `true` and an empty closure.

- The modifier is on the preview, because capture events belong to a view that shows the camera. The system sends events only while the app is in the foreground and its capture session runs.
- With one `action` closure, the closure gets the primary events and the secondary events. So the two volume buttons do the same thing, as in the Camera app.
- For an AirPods stem click, the system plays a default tone in the AirPods. [`defaultSoundDisabled: true`](https://developer.apple.com/documentation/swiftui/view/oncameracaptureevent(isenabled:defaultsounddisabled:action:)) stops that tone. Your code now has the responsibility for the sound. You write that part at the end of this section.

```swift file=AVCam/CameraView.swift highlight=4-6
            PreviewContainer(camera: camera) {
                // A view that provides a preview of the captured content.
                CameraPreview(source: camera.previewSource)
                    // Handle capture events from device hardware buttons.
                    .onCameraCaptureEvent(defaultSoundDisabled: true) { event in
                    }
                    // Focus and expose at the tapped point.
                    .onTapGesture { location in
                        Task { await camera.focusAndExpose(at: location) }
                    }
```

### Step
In the closure, continue only when the phase of the event is `.ended`.

One press calls the closure more than one time. The [`phase`](https://developer.apple.com/documentation/avkit/avcaptureeventphase) of the [`AVCaptureEvent`](https://developer.apple.com/documentation/avkit/avcaptureevent) is `.began` when the person pushes the control down, and `.ended` when the person releases it. Without this test, one click captures two times. The third phase, `.cancelled`, means that the press must not count, so the closure ignores it too.

```swift file=AVCam/CameraView.swift highlight=3-4
                    // Handle capture events from device hardware buttons.
                    .onCameraCaptureEvent(defaultSoundDisabled: true) { event in
                        if event.phase == .ended {
                        }
                    }
```

### Step
Declare a constant for the sound, and start a `switch` statement on the capture mode. In the `.photo` case, select the shutter sound.

[`AVCaptureEventSound`](https://developer.apple.com/documentation/avkit/avcaptureeventsound) is a sound that an event can play through AirPods. The system supplies three sounds, and `.cameraShutter` is the sound for a photo. The constant has no value at its declaration. Each case of the `switch` statement gives it one value, and the Swift compiler makes sure that no case forgets it.

The file does not compile until you add the `.video` case, because a `switch` statement must have a case for each value.

```swift file=AVCam/CameraView.swift highlight=2-6
                        if event.phase == .ended {
                            let sound: AVCaptureEventSound
                            switch camera.captureMode {
                            case .photo:
                                sound = .cameraShutter
                            }
                        }
```

### Step
In the `.photo` case, call `capturePhoto()` of the camera model.

This is the method that the capture button on the screen calls. A hardware control and the screen button thus do the same work, and all rules for a capture stay in the model. The call has `await` and no `Task` around it. Because of the `await`, the compiler selects the overload of the modifier that takes an `async` closure. That overload exists since iOS 26.

```swift file=AVCam/CameraView.swift highlight=5-6
                            let sound: AVCaptureEventSound
                            switch camera.captureMode {
                            case .photo:
                                sound = .cameraShutter
                                // Capture a photo when pressing a hardware button.
                                await camera.capturePhoto()
                            }
```

### Step
Add the `.video` case. Select the end sound when a recording is in progress, and the begin sound when it is not.

In video mode, one press has two possible meanings: start or stop. The closure reads `camera.captureActivity.isRecording` to know which one it is. A person who is not near the screen then hears a different sound for each of the two.

```swift file=AVCam/CameraView.swift highlight=4-6
                                sound = .cameraShutter
                                // Capture a photo when pressing a hardware button.
                                await camera.capturePhoto()
                            case .video:
                                sound = camera.captureActivity.isRecording ?
                                    .endVideoRecording : .beginVideoRecording
                            }
```

### Step
After the sound selection in the `.video` case, call `toggleRecording()` of the camera model.

The order of these lines is necessary. The closure must read `isRecording` before the toggle. After the toggle, the property has the opposite value, and the closure would select the begin sound for a stop and the end sound for a start.

```swift file=AVCam/CameraView.swift highlight=4-5
                            case .video:
                                sound = camera.captureActivity.isRecording ?
                                    .endVideoRecording : .beginVideoRecording
                                // Toggle video recording when pressing a hardware button.
                                await camera.toggleRecording()
                            }
```

### Step
After the `switch` statement, play the sound if the event asks for one.

- [`shouldPlaySound`](https://developer.apple.com/documentation/avkit/avcaptureevent/shouldplaysound) is `true` only when the event came from an AirPods stem click and the app disabled the default tone. For a volume button, the Action button, and the Camera Control, it is `false`.
- [`play(_:)`](https://developer.apple.com/documentation/avkit/avcaptureevent/play(_:)) plays the sound through the AirPods. It does nothing when `shouldPlaySound` is `false`, and it does nothing when the event is more than 15 seconds old.
- This sound is not the usual shutter sound of the iPhone. The photo output plays that one by itself.

```swift file=AVCam/CameraView.swift highlight=3-6
                                await camera.toggleRecording()
                            }
                            // Play a sound when capturing by clicking an AirPods stem.
                            if event.shouldPlaySound {
                                event.play(sound)
                            }
                        }
                    }
```

### Note
Look at the place of the `play(_:)` call: it is after `await camera.capturePhoto()`. That method returns after the capture and after the save to the Photos library. So, from the order of the code, the sound comes after the save, not at the moment of the capture. The sample does it in this way, and this tutorial follows the sample. [Concepts: hardware buttons and AirPods](ch11-concepts.md#things-to-know-about-the-sample) describes this limit and a better order.

### Step
Build the project to make sure that the closure compiles.

The closure is complete. In the Simulator, it never runs, because no capture events arrive there.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: Build Succeeded, with no errors
```

## Keep the capture button in step

The movie capture button from chapter 8 has its own `isRecording` state. A tap on the button changes that state, and the state changes the form of the button from a circle to a square. A hardware control does not tap the button. Without more code, a volume button starts a recording, and the button on the screen continues to show a circle.

In this section, the capture button observes the model and copies each change of the recording state into its own state.

### Step
In `CaptureButton.swift`, add an `onChange` modifier to `captureButton` that observes `camera.captureActivity.isRecording`.

The model is the object that knows if a recording is in progress, for each source of the capture: the screen button, a hardware button, or AirPods. The closure of `onChange` gets the old value and the new value. It needs only the new value, so the first parameter is `_`.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=5-7
    var body: some View {
        captureButton
            .aspectRatio(1.0, contentMode: .fit)
            .frame(width: mainButtonDimension)
            // Respond to recording state changes that occur from hardware button presses.
            .onChange(of: camera.captureActivity.isRecording) { _, newValue in
            }
    }
```

### Step
In the closure, set the `isRecording` state to the new value, inside an animation.

`MovieCaptureButton` has a binding to this state. When the value changes, the button draws its other form. The animation has the same curve and the same duration as the animation that the button uses for a tap, so the person sees no difference between a tap and a press of a hardware button. After a tap on the screen button, the state already has the new value, and this closure changes nothing.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=3-6
            // Respond to recording state changes that occur from hardware button presses.
            .onChange(of: camera.captureActivity.isRecording) { _, newValue in
                // Ensure the button animation occurs when toggling recording state from a hardware button.
                withAnimation(.easeInOut(duration: 0.25)) {
                    isRecording = newValue
                }
            }
    }
```

## Make AirPods available as a microphone

The usual Bluetooth microphone mode was made for phone calls, and its sound quality is low. iOS 26 has a high-quality recording mode for AirPods that support it. An app must ask for the mode. Because the capture session of AVCam manages the audio session of the app, one property of the capture session is sufficient.

### Step
In `CaptureService.swift`, in `setUpSession()`, set `configuresApplicationAudioSessionForBluetoothHighQualityRecording` to `true` before the lines that add the inputs.

- [`configuresApplicationAudioSessionForBluetoothHighQualityRecording`](https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessionforbluetoothhighqualityrecording) is `false` by default. With `true`, the capture session includes the high-quality mode when it configures the audio session.
- The line is before the microphone input and before the start of the session, so the session configures the audio one time, with the correct value.
- The property does not select the AirPods. It makes them available. The person selects the microphone, for example in Control Center. If the person selects nothing, the microphone of the iPhone records, as before.
- The line has no availability test, because the deployment target of the project is iOS 26.

```swift file=AVCam/CaptureService.swift highlight=5-6
            // Retrieve the default camera and microphone.
            let defaultCamera = try deviceLookup.defaultCamera
            let defaultMic = try deviceLookup.defaultMic

            // Enable using AirPods as a high-quality lapel microphone.
            captureSession.configuresApplicationAudioSessionForBluetoothHighQualityRecording = true

            // Add inputs for the default camera and microphone devices.
            activeVideoInput = try addInput(for: defaultCamera)
            try addInput(for: defaultMic)
```

### Step
Build and run the app. Take a photo and record a short movie with the button on the screen.

The project builds with no errors and no warnings. In the Simulator, expect the same behavior as at the end of chapter 10: nothing that you added in this chapter can run there. This step only makes sure that the new code did not break the screen button.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then take a photo and record a movie with the screen button
Expected in the Simulator: the app behaves as at the end of chapter 10
Needs a real iPhone: capture with the hardware buttons and with AirPods, the AirPods sounds, the AirPods microphone
Note: This tutorial did not test this chapter on a real iPhone.
```

### Note
If you have a real iPhone, run the app there. This is what the code asks the system to do. Nobody verified these results for this tutorial.

- **Volume buttons.** In photo mode, a press and release of the volume up button or the volume down button takes a photo. The volume does not change, and no volume indicator appears. In video mode, the first press starts a recording, and the capture button on the screen changes to a square. The second press stops the recording.
- **Action button and Camera Control.** The Action button and a full press of the Camera Control do the same as a volume button.
- **AirPods stem click.** First turn on the Camera Remote setting of the AirPods in the Settings app. Then a stem click captures, and you hear the shutter sound, the begin sound, or the end sound in the AirPods.
- **AirPods microphone.** In video mode, open Control Center, select the AirPods as the audio input, and record a movie. Compare the sound with a movie from the microphone of the iPhone.

In the European Union, the last two tests are not possible at this time.

### Experiment
On a real iPhone with AirPods, move the three lines that play the sound to a position before the `switch` statement. The compiler then stops you, because `sound` has no value there. Find a way to select the sound first, to play it second, and to capture third. Listen for the difference in photo mode: the sound must now come at the moment of the click. Put the code back when you finish, so that your code stays equal to the branch `chapter-11`.

### Experiment
On a real iPhone, add the argument `isEnabled: !camera.isSwitchingModes` in front of `defaultSoundDisabled: true`. While the app changes between photo mode and video mode, the volume buttons then change the volume again. This shows the rule of the API: when the app cannot capture, it gives the buttons back to the system. Remove the argument when you finish.

### Text
Your code is now the same as the `chapter-11` branch. `CameraView` and `CaptureButton` are now the same as the files of Apple's sample. One closure connects four hardware controls and the AirPods to the capture methods of the model. In chapter 12, you use the other functions of the Camera Control: the light press and the slide, which change the zoom, the exposure, and the focus.

## Check your understanding

### In the `.video` case, a developer puts the `toggleRecording()` call before the line that selects the sound. A person starts a recording with an AirPods stem click. What does the closure select?

- [ ] The begin sound, because the model knows that a recording started.
  > The line selects `.endVideoRecording` when `isRecording` is `true`. If the model already reports the new recording, the result is the end sound.
- [x] Possibly the end sound, because the closure reads the recording state after the toggle and not before it.
  > Correct. The sound must describe the action that the press starts. Only the state from before the toggle tells the closure which action that is.
- [ ] No sound, because `play(_:)` works only before a capture.
  > `play(_:)` has a time limit of 15 seconds from the event. It has no rule about the order of the capture and the sound.

### A person without AirPods takes a photo with the volume down button. The modifier has `defaultSoundDisabled: true`. What does `event.play(sound)` do?

- [ ] It plays the shutter sound through the speaker of the iPhone.
  > The sounds of a capture event are for AirPods only. The usual shutter sound of the iPhone comes from the photo output.
- [ ] It stops the app, because no AirPods are connected.
  > `play(_:)` is safe to call. When the event does not ask for a sound, the method does nothing.
- [x] The line does not run, because `shouldPlaySound` is `false` for a volume button.
  > Correct. `shouldPlaySound` is `true` only for an AirPods stem click with the default tone disabled. For the buttons of the iPhone, the closure skips the call.

### You remove the `onChange` modifier from `CaptureButton`. In video mode, a person presses a volume button. What is the result?

- [ ] Nothing occurs, because the capture button starts each recording.
  > The event closure in `CameraView` calls `toggleRecording()` of the model directly. It does not need the button.
- [x] The recording starts, but the button on the screen continues to show a circle.
  > Correct. The button draws its form from its own `isRecording` state. Only a tap, or the `onChange` closure, changes that state.
- [ ] The app does not compile, because `MovieCaptureButton` needs the modifier.
  > `MovieCaptureButton` needs only the binding to `isRecording`. The modifier is an addition that keeps the state equal to the model.
