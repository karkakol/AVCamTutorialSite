---
kind: article
chapter: 8
title: Concepts: record video
abstract: How the movie file output records a movie with sound, why AVCam changes the session between a photo configuration and a video configuration, and how stabilization, the recording time, and the save to Photos work.
estimatedMinutes: 14
branch: chapter-08
---

A photo is one moment. A movie is a process: it starts, it runs for a time that nobody knows in advance, and it ends. The camera must compress video and audio during all this time, keep them in step, and write them to a file.

AVFoundation has an output that does all this work for you. But this output does not go together with Live Photo capture. So AVCam has two modes, and a change of mode builds the capture pipeline again. This article explains the output, the two modes, and the parts around them: the microphone, stabilization, the recording time, and the save to the Photos library. In [Build: record video](ch08-build.md), you write the code.

## How it works

### The movie file output

[`AVCaptureMovieFileOutput`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput) is a recorder that does the full job. You give it a file URL. It takes the video and the audio from the session, compresses them, keeps them in step, and writes a QuickTime movie file (`.mov`). Your code does not see the frames.

Most of its interface comes from its superclass, [`AVCaptureFileOutput`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput): the methods that start and stop a recording, the duration of the current file, and the limits.

### Four stages of a recording

![The four stages of a recording: the start request, the recording, the stop request, and the delegate callback that completes the file](../images/ch08-recording-timeline.svg)

1. **Start.** [`startRecording(to:recordingDelegate:)`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/startrecording(to:recordingdelegate:)) returns immediately. The output starts to write a short time later. The call fails if a file exists at the URL. On iOS, an output makes only one recording at a time.
2. **Record.** The output writes samples. Its [`recordedDuration`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/recordedduration) value increases.
3. **Stop.** [`stopRecording()`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/stoprecording()) also returns immediately. The output still has data to write.
4. **Finish.** The output calls [`fileOutput(_:didFinishRecordingTo:from:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didfinishrecordingto:from:error:)) on the recording delegate. Only now is the file complete.

The finish callback is the only required method of [`AVCaptureFileOutputRecordingDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate). The output calls it one time for each recording request, also when it wrote nothing. The callback arrives on a thread that the documentation does not specify.

A stop request from your code is not the only way to the last stage. A recording also ends when the session is interrupted (for example by a phone call), when the disk is full, when a limit that you set is reached, or when the camera or its format changes.

### From the delegate to `async` code

In chapter 3, you made `capturePhoto()` an `async` method: a continuation waited for the last delegate callback. A recording uses the same tool, but at a different moment.

A photo capture is one request with one result, so the continuation starts with the request. A recording has two requests. The start request has no result: the caller must not wait for the full length of the recording. The stop request has the result. So `MovieCapture` creates the continuation in `stopRecording()`, gives it to the delegate, and then asks the output to stop.

```swift file=AVCam/Capture/MovieCapture.swift
    /// A delegate object that responds to the capture output finalizing movie recording.
    private class MovieCaptureDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {

        var continuation: CheckedContinuation<Movie, Error>?

        func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
            if let error {
                // If an error occurs, throw it to the caller.
                continuation?.resume(throwing: error)
            } else {
                // Return a new movie object.
                continuation?.resume(returning: Movie(url: outputFileURL))
            }
        }
    }
```

The delegate changes "a callback at some later time" into `let movie = try await stopRecording()`. The value that goes back is a `Movie`, which holds only the URL of the file. A URL is `Sendable`, so it can go from the capture actor to the main actor.

`MovieCapture` keeps the delegate in a property. The documentation does not promise that the output keeps a strong reference to its delegate, so the app keeps one.

### Two configurations of one session

A session has one configuration at a time. "Photo mode" and "video mode" are two configurations of the same session. They have the same inputs, but a different preset and a different set of outputs.

![The capture session in photo mode and in video mode: the same inputs, a different preset, and the movie file output only in video mode](../images/ch08-session-modes.svg)

```swift file=AVCam/CaptureService.swift
        // Configure the capture session for the selected capture mode.
        switch captureMode {
        case .photo:
            // The app needs to remove the movie capture output to perform Live Photo capture.
            captureSession.sessionPreset = .photo
            captureSession.removeOutput(movieCapture.output)
        case .video:
            captureSession.sessionPreset = .high
            try addOutput(movieCapture.output)
        }
```

Three rules are behind these few lines:

- **[`.photo`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/photo) is for photos.** This preset selects a camera format for photos at the full resolution. With this preset, a movie output records only at the resolution of the preview. Thus it is the wrong preset for video.
- **[`.high`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/high) is for video.** It means "high-quality video and audio", and it is the default preset of a new session. The preset does not name a picture size. The size depends on the device.
- **A movie file output stops Live Photo capture.** While a movie file output is in the session, [`isLivePhotoCaptureSupported`](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocapturesupported) of the photo output is `false`. So the app removes the movie output with [`removeOutput(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/removeoutput(_:)) when it goes back to photo mode.

The photo output stays in the session in both modes. Only the movie output comes and goes.

The service puts the changes between [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()), as it did for the camera switch in chapter 2. The session then applies the new preset and the new set of outputs together.

### The cost of a mode change

A change of the preset and a change of the outputs each make the session build its pipeline again. The preview can stop for a moment. AVCam hides this: the model sets `isSwitchingModes` during the change, and the preview is blurred while the value is `true`. This is the same effect that you made for the camera switch.

There is a second cost, and it is easy to forget. A connection exists only while its output is in the session. Each time the app adds the movie output, the session makes new connections. All that you set on the old connection is gone: the codec, the stabilization mode, and the rotation angle.

### The connection: codec and stabilization

Because the connection is new after each mode change and each camera switch, `MovieCapture` configures it in `updateConfiguration(for:)`. The capture service calls this method at the end of each of these changes, inside the same configuration block. The method does two things.

**Codec.** [`availableVideoCodecTypes`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/availablevideocodectypes) lists the codecs that the output can use for the current configuration. The first entry is the default. HEVC gives approximately the same quality as H.264 in a smaller file. On most iPhone models, HEVC is already the default, so [`setOutputSettings(_:for:)`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/setoutputsettings(_:for:)) with the HEVC codec mostly shows the intent. The codec that you set must be a member of the list, so the test with `contains(.hevc)` is necessary.

**Stabilization.** Stabilization removes camera shake. The system keeps a margin around the visible picture and moves a crop window against the motion. So stabilization has a price: a smaller field of view, and for the stronger modes also a delay and more memory. You do not turn stabilization on for a device. You ask for it on a connection with [`preferredVideoStabilizationMode`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/preferredvideostabilizationmode). AVCam asks for `.auto`, and the system selects a mode for the active format and frame rate. [`activeVideoStabilizationMode`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/activevideostabilizationmode) tells you what you got.

The moment is important. The newest version of the Apple sample moved these two settings from the start of a recording to the creation of the connection. The reason is the crop: if the app turns stabilization on at the moment of the tap, the framing changes at the moment when the recording starts.

### Orientation

The rotation code from chapter 3 sends the capture angle to each output service. The movie service is now in that list. While the movie output is in the session, its connection gets each new angle. For a movie, the output reads the angle when the recording starts. A turn of the device during a recording does not change the file.

### Audio

Audio comes into the session in the same way as video: a microphone device in an [`AVCaptureDeviceInput`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput). [`AVCaptureDevice.default(for:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/default(for:)) with `.audio` gives the default microphone. When a movie output is in the session, the session connects the audio to it, and the movie gets an audio track.

AVCam adds the microphone input one time and keeps it in both modes. In photo mode, it supplies the sound of Live Photos.

The app has no audio code other than this input. On iOS, the microphone hardware and its processing belong to the [`AVAudioSession`](https://developer.apple.com/documentation/avfaudio/avaudiosession) of the app, and the capture session manages that object for you. With the default of [`automaticallyConfiguresApplicationAudioSession`](https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfiguresapplicationaudiosession), the capture session sets an audio category for recording and selects a microphone that agrees with the camera in use.

Two results of these defaults are good to know:

- **The sound is mono.** The default of [`multichannelAudioMode`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/multichannelaudiomode) on the microphone input is `.none`, which records one channel.
- **The session interrupts other audio.** Music from a different app stops when the session starts.

The microphone needs its own permission and its own usage description, [`NSMicrophoneUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription). AVCam does not ask for this permission with a separate call. The system asks when the app creates the input for the microphone.

### The recording time

The movie output does not send progress callbacks. It has a property, `recordedDuration`, with the length of the current file. The documentation does not say that you can observe this property, so `MovieCapture` reads it on a timer, four times each second.

Each timer event writes a new `CaptureActivity` value, `.movieCapture(duration:)`. The value then goes the same way as the photo activity in chapter 3: from the movie service to the capture service, which merges it with the photo activity, then to the model, and then to the view that shows the time.

This one value does two jobs. Its duration is the text of the time view. Its case tells the interface that a recording is in progress, so the mode picker, the camera switch button, and the thumbnail button are disabled.

### The movie goes to Photos

The output writes the movie to a URL in the temporary directory of the app. The name is a UUID, so a file never exists at the URL. You made this helper, `URL.movieFileURL`, in chapter 7 for the Live Photo movie.

When `stopRecording()` returns, the file is complete. The model gives the `Movie` to the media library, which creates an asset from the file. This is the code from chapter 4 with two differences. The resource type is `.video`. And the option [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile) is `true`: the Photos library moves the file into the library and does not make a copy. A movie can be very large. A copy needs two times the space for a moment, and it leaves a file that the app must delete.

The order is important. A move fails while the file is open. Because the save comes after `await stopRecording()`, the delegate callback is always first.

## What the camera can do

AVCam uses a small part of the video features. This table shows the map.

| Capability | What it does | In this tutorial |
|---|---|---|
| Codec selection | HEVC, H.264, and on some devices ProRes, from `availableVideoCodecTypes`. | HEVC, in this chapter |
| Stabilization modes | Off, standard, cinematic, extended cinematic modes, a low-latency mode, and automatic. Each stronger mode crops more or delays more. | `.auto`, in this chapter |
| 10-bit HDR video, formats, frame rates | You select a device format, not a preset. | Chapter 9 |
| Recording with AirPods | High-quality audio from a Bluetooth microphone. | Chapter 11 |
| Pause and resume | `pauseRecording()` and `resumeRecording()` put more than one segment into one file (iOS 18). | Not in AVCam |
| Limits | A maximum duration, a maximum file size, and a minimum of free disk space stop a recording automatically. | Not in AVCam |
| Stereo and Spatial Audio | `multichannelAudioMode` on the microphone input, with the built-in microphones only. | Not in AVCam |
| Mix with other audio | A session property lets music continue during capture (iOS 18). | Not in AVCam |
| Metadata in the file | Items such as the location in the movie file itself. AVCam puts the location on the Photos asset only. | Not in AVCam |
| Orientation changes in the file | A metadata track records each turn of the device during a recording. | Not in AVCam |
| Frames for your code | `AVCaptureVideoDataOutput` and `AVCaptureAudioDataOutput` deliver each buffer. | Not in AVCam |
| Cinematic video and spatial video | Special recording modes on devices that support them. | Not in AVCam |
| External storage | Record directly to a drive that is connected to the device. | Not in AVCam |

> [!NOTE]
> You can read a property named `isVideoStabilizationSupported` on a connection. It tells you that some format of the device supports stabilization. It does not tell you that the active format supports the mode that you asked for. Read `activeVideoStabilizationMode` after the session commits its configuration.

## Why AVCam does it this way

**The movie file output, not data outputs.** There are two ways to make a movie file. The second way uses [`AVCaptureVideoDataOutput`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput) and [`AVCaptureAudioDataOutput`](https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput), which give each sample buffer to your code. You send the buffers to an [`AVAssetWriter`](https://developer.apple.com/documentation/avfoundation/avassetwriter). Then you own all the work: the timing, the buffers that arrive too fast, the orientation, and the end of the file.

| You need | Movie file output | Data outputs and asset writer |
|---|---|---|
| A recording of what the camera sees | The best selection | More work, no advantage |
| Filters or drawings in the video | Not possible | Necessary |
| Analysis of each frame, or live streaming | Not possible | Necessary |
| A different container than `.mov` | Not possible | Possible |
| Live Photo capture in the same configuration | Not possible | Possible |

AVCam records the camera picture without changes. The movie file output does this with a small quantity of code. The price is the last row of the table, and thus the mode switch.

**One configuration for each mode.** The alternatives show what AVCam gets and what it pays.

| Design | Advantage | Disadvantage |
|---|---|---|
| AVCam: change the preset and the output for each mode | Live Photo in photo mode, and a good format for each mode | A pause that you can see at each change |
| Keep the movie output in the session | A recording can start from photo mode with no delay | No Live Photo, and video at a low resolution with the `.photo` preset |
| Photo mode with data outputs and an asset writer | Live Photo and video in one configuration | Much more code |
| Select the device format yourself | Full control, fewer changes | You must select a format for each device |

**A new delegate for each recording.** As for a photo, each recording gets its own delegate object, and the object holds the continuation of that recording. There is no table that connects callbacks to requests.

**A timer that polls.** The output is the one source of truth for the duration. Its value does not increase before the output writes. A timer of the app that counts from the moment of the tap is simpler, but it can show a time that the file does not have.

**Move, not copy.** The temporary file goes away as a side effect of the save.

**Nothing for the audio session.** The defaults select a microphone that agrees with the camera. Code that configures `AVAudioSession` at the same time as the capture session can work against it.

## Things to know about the sample

These points come from a careful read of the Apple sample. Nobody verified them on an iPhone for this tutorial. In normal use, they do not stop the app from working.

- **A recording that ends by itself is lost.** The delegate gets its continuation only inside `stopRecording()`. If the output ends the recording first, for example because of a phone call, the callback arrives when the continuation is `nil`, and the result goes away. The timer continues, so the interface still shows a recording. When the person then taps the button, `stopRecording()` waits for a callback that came before. The method never returns, and the file stays in the temporary directory.
- **Each error counts as a failure.** When a limit or an interruption ends a recording, the delegate gets an error, but the file can be good. The key [`AVErrorRecordingSuccessfullyFinishedKey`](https://developer.apple.com/documentation/avfoundation/averrorrecordingsuccessfullyfinishedkey) in the error tells you. The sample does not read it, so it discards such a file.
- **The timer writes state on the main thread.** All other code of `MovieCapture` runs on the session queue of the capture service actor. The timer runs on the main run loop, and there it reads the output and writes `captureActivity`. This compiles in the Swift 5 language mode with minimal concurrency checking. It is not correct for strict concurrency.
- **The interface is ahead of the output.** The service publishes `.movieCapture` before it calls the output, and the capture button changes its shape at the tap. The interface shows a recording before the output writes the first frame.
- **The mode is stored before the change can fail.** `setCaptureMode(_:)` writes the new mode first. If the session then does not accept the movie output, the stored mode is `.video`, but the session has no movie output. The model calls the method with `try?`, so nobody sees the error.
- **A denied microphone probably stops the camera.** If the person denies the microphone, the app cannot create the microphone input. Then `setUpSession()` throws, and the camera does not start. The sample has no "video without sound" path.
- **A failed save leaves a file.** If the Photos library refuses the change, nobody deletes the movie in the temporary directory.
- **The mode change does not set the rotation angle.** The service applies the capture angle when it creates the rotation coordinator and when the angle changes. `setCaptureMode(_:)` does not apply it to the new connection of the movie output. Record a movie immediately after a mode change on your iPhone, and examine its orientation.

## Common mistakes

- **You use the file after `stopRecording()` returns from the output.** The output method returns immediately. The file is complete only in the delegate callback.
- **You record to a URL where a file exists.** The recording fails. Use a new name for each recording.
- **You keep the movie output in the session and expect Live Photos.** The photo output reports that Live Photo capture is not supported.
- **You record video with the `.photo` preset.** The movie has the resolution of the preview.
- **You configure the connection one time.** After you remove the output and add it again, the connection is new and has its default values.
- **You change the mode or the camera during a recording.** A change of the format or of the outputs ends the recording. Disable these controls while the app records.
- **You turn stabilization on at the start of the recording.** The framing changes at that moment.
- **You set a codec that is not in `availableVideoCodecTypes`.** Such settings are not legal. Read the list after the session has its final preset, because the list can change with the preset.
- **You have no microphone usage description.** The system stops the app when it asks for access to the microphone.
- **You change actor state or the interface in the delegate callback.** The callback is not on your queue.

> [!NOTE]
> In the Simulator with SimCam, the mode change, the recording, the recording time, and the save to Photos work. The tutorial did not examine the sound of the movie in the Simulator. HEVC and stabilization are probably not available there. To see the real video quality, the stabilization, and the sound, use an iPhone.

## Documentation

```links
AVCaptureMovieFileOutput | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput | The output that records QuickTime movies.
AVCaptureFileOutput | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput | The superclass with start, stop, pause, and the limits.
AVCaptureFileOutputRecordingDelegate | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate | The callbacks of one recording.
Recording movies in alternative formats | https://developer.apple.com/documentation/avfoundation/recording-movies-in-alternative-formats | The Apple article about HEVC and H.264.
AVCaptureSession.Preset | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset | All session presets.
isLivePhotoCaptureSupported | https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/islivephotocapturesupported | The property that is false while a movie output is in the session.
AVCaptureConnection | https://developer.apple.com/documentation/avfoundation/avcaptureconnection | The object where you set rotation and stabilization.
AVCaptureVideoStabilizationMode | https://developer.apple.com/documentation/avfoundation/avcapturevideostabilizationmode | All stabilization modes.
isVideoStabilizationModeSupported(_:) | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideostabilizationmodesupported(_:) | The test for one format and one mode.
AVErrorRecordingSuccessfullyFinishedKey | https://developer.apple.com/documentation/avfoundation/averrorrecordingsuccessfullyfinishedkey | The value that tells you if a file is good after an error.
automaticallyConfiguresApplicationAudioSession | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfiguresapplicationaudiosession | How the capture session manages the audio session.
configuresApplicationAudioSessionToMixWithOthers | https://developer.apple.com/documentation/avfoundation/avcapturesession/configuresapplicationaudiosessiontomixwithothers | The property that lets other audio continue.
multichannelAudioMode | https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/multichannelaudiomode | Mono, stereo, or Spatial Audio for the microphone input.
Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media | The Apple article about camera, microphone, and Photos permission.
AVCaptureVideoDataOutput | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput | The output that gives each video frame to your code.
AVAssetWriter | https://developer.apple.com/documentation/avfoundation/avassetwriter | The object that writes a media file from sample buffers.
PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest | The request that creates an asset from resources.
shouldMoveFile | https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile | The option that moves a file into the library.
Timer.publish(every:tolerance:on:in:options:) | https://developer.apple.com/documentation/foundation/timer/publish(every:tolerance:on:in:options:) | The Combine timer that the sample uses.
withCheckedThrowingContinuation | https://developer.apple.com/documentation/swift/withcheckedthrowingcontinuation(isolation:function:_:) | The function that connects callback code to async code.
WWDC26: Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | The session behind the newest version of the Apple sample. It does not discuss codecs or stabilization.
WWDC25: Enhance your app's audio recording capabilities | https://developer.apple.com/videos/play/wwdc2025/251/ | Audio capture, Spatial Audio, and AirPods recording.
AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The documentation page of the Apple sample.
Build: record video | ch08-build.md | The tutorial for this chapter.
```
