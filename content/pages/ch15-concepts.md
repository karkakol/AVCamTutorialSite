---
kind: article
chapter: 15
title: Concepts: fix the sample
abstract: How to find defects in sample code, and how this tutorial corrects four of them: a recording that ends by itself, the Live Photo badge, the rotation angle of a new movie connection, and a late capture sound.
estimatedMinutes: 12
branch: chapter-15
---

> [!IMPORTANT]
> This chapter changes code that came from Apple. The fixes are the design of this tutorial. They are not in the Apple sample. Apple did not confirm the four defects: they come from a careful read of the code and of the SDK headers.

In chapters 7, 8, and 11, a section with the title "Things to know about the sample" listed weak points of AVCam. Until now, you kept the code as Apple wrote it. In this chapter, you correct four of these points.

The four fixes are small. Together they are approximately 85 new lines. The more important subject of this article is the method: how do you find such defects in code that looks correct and that works each time you try it? In [Build: fix the sample](ch15-build.md), you write the fixes.

## Why sample code has defects

A sample has one job: it shows you how to use an API, on the shortest path. That job explains most of its weak points. The reasons below are probable reasons. Apple does not publish them.

- **A sample follows the normal path.** The person starts a recording and stops it. The person takes one photo and waits. Code for the other paths makes a sample longer and harder to read.
- **The other paths are hard to produce.** A full disk, a phone call during a recording, two Live Photos that overlap, AirPods: you cannot make these events at a desk in one minute. Code that nobody runs keeps its defects.
- **A sample grows each year.** AVCam got new features after each WWDC. New code goes around old code, and nobody examines again the old assumptions.

So do not copy a sample into a product without a review. The review has three questions.

1. **What does the contract say?** For each delegate method and each property that the code uses, read the comment in the SDK header. Look for the words "always", "never", "can", and "must". Then compare: does the code handle each case that the contract permits?
2. **What if this callback arrives at a different time, or never?** Code with callbacks usually assumes one order of events. Go through the other orders. For each continuation, find the code that resumes it on each path. A continuation that nobody resumes blocks its caller without end.
3. **Where does each state end?** List each thing that the code starts: a timer, a counter, a continuation, a temporary file, a "recording" state in the interface. For each one, find the line that ends it. Then ask if all paths go through that line. For a counter, write down a sequence of events with small numbers.

Each of the four defects in this chapter is the answer to one of these questions.

| Defect | The question that finds it |
|---|---|
| A recording that ends by itself is lost | 1 and 2: the header says that the callback also comes after an error. The code expects it only after a stop request. |
| The Live Photo badge goes off too early | 3: follow the counter through two captures that overlap. |
| A new movie connection has no rotation angle | 3: the angle is a state of the connection, and the connection ends when the output leaves the session. |
| The capture sound comes late | 2: what happens between the click and the sound? A capture, a location request, and a save. |

## How it works

### Defect 1: a recording that ends by itself

**The contract.** The movie output writes the file in the background. It tells the app that the file is complete with one delegate method, [`fileOutput(_:didFinishRecordingTo:from:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didfinishrecordingto:from:error:)). The header of [`AVCaptureFileOutput`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput) says these things about it:

- The output calls the method when the recording was stopped by [`stopRecording()`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/stoprecording()), or because an error occurred.
- The output always calls the method one time for each recording request, also when it wrote no data.
- Do not expect the call on a specific thread.
- A limit, such as [`maxRecordedDuration`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/maxrecordedduration), stops the recording, and the method then gets an error.

A second header, `AVError.h`, has the key [`AVErrorRecordingSuccessfullyFinishedKey`](https://developer.apple.com/documentation/avfoundation/averrorrecordingsuccessfullyfinishedkey). Its value in the `userInfo` dictionary of the error is a Boolean number that tells you if the recording is playable. So an error in the callback has two possible meanings: "the file is bad", or "the recording stopped early, and the file is good".

**The cause.** This is the delegate of the sample, as you wrote it in chapter 8:

```swift
func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
    if let error {
        // If an error occurs, throw it to the caller.
        continuation?.resume(throwing: error)
    } else {
        // Return a new movie object.
        continuation?.resume(returning: Movie(url: outputFileURL))
    }
}
```

The delegate gets its continuation only inside `stopRecording()`. The code assumes one order of events: the app asks to stop, and then the callback comes. Now go through the other order. The output ends the recording first. The callback comes, `continuation` is `nil`, and the two lines with `continuation?` do nothing.

**The symptom.** Three things go wrong, and the person sees two of them.

- The movie is lost. Nobody gets the URL, and the file stays in the temporary directory.
- The timer continues, because only `stopRecording()` stops it. The interface shows a recording that does not exist.
- The person taps the button to stop. `stopRecording()` stores a continuation and waits for a callback that came before. The method never returns.

A second defect is in the same lines. Each error is a failure for this code, also an error that leaves a good file.

**The fix.** The new delegate divides the two decisions. First, it makes one `Result` value from the callback. Then it asks who waits for the result.

```swift file=AVCam/Capture/MovieCapture.swift
            if let continuation {
                // The app asked to stop the recording. Return the result to the caller.
                continuation.resume(with: result)
            } else {
                // The recording ended by itself. Nobody waits for the result, so report it separately.
                unexpectedFinishHandler?(result)
            }
```

![The two paths of the finish callback: the app stops the recording and a continuation waits for the result, or the recording ends by itself and the result goes into a stream](../images/ch15-finish-paths.svg)

The left path is the path of the sample. The right path is new. It has four parts:

- **A handler on the delegate.** `startRecording()` gives each new delegate a closure. The closure stops the timer, releases the delegate, and writes the result into a stream.
- **A stream.** `MovieCapture` has an [`AsyncStream`](https://developer.apple.com/documentation/swift/asyncstream) with the name `unexpectedResults`. The capture service passes it on as `unexpectedRecordingResults`.
- **A reader.** A task in the model reads the stream. It saves each movie, or it stores the error.
- **A guard in `stopRecording()`.** When the output does not record, no callback can come. The method then throws the new `notRecording` error immediately, and it does not store a continuation that nobody can resume.

This method decides if an error leaves a usable file:

```swift file=AVCam/Capture/MovieCapture.swift
        private func isMovieUsable(after error: Error) -> Bool {
            let userInfo = (error as NSError).userInfo
            return userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? false
        }
```

**How to test.** A time limit is the easiest way to make a recording end by itself. One temporary line, `movieOutput.maxRecordedDuration = CMTime(seconds: 3, preferredTimescale: 600)`, ends each recording after 3 seconds. The tutorial page has this experiment.

**What was verified.** The author of the code ran this test in the Simulator with SimCam. After 3 seconds, the recording ended, the timer went back to 00:00:00, the button returned to its idle form, the thumbnail appeared, and the movie was in the Photos library. A normal start and stop still saved the movie. A size limit, a full disk, and an interruption use the same path in the code, but nobody tested them.

### Defect 2: the Live Photo badge

**The symptom.** With responsive capture, a person can take a second Live Photo while the movie of the first one still records. The "LIVE" badge then goes off when the first movie stops, although the second movie still records. [Chapter 7](ch07-concepts.md#things-to-know-about-the-sample) described this.

**The cause.** `PhotoCapture` has a counter, `livePhotoCount`, of the Live Photo captures that are in progress. When a capture reports a change, the code adds 1 or subtracts 1. Then it forces the badge on if other captures are in progress. The sample tests this with `livePhotoCount > 1`. Follow the counter through two captures, A and B:

| Event | Counter | Badge with `> 1` | Badge with `> 0` |
|---|---|---|---|
| A begins | 1 | on | on |
| B begins | 2 | on | on |
| The movie of A stops | 1 | **off** | on |
| The movie of B stops | 0 | off | off |

In the third row, the counter is 1 after the subtraction. That 1 is capture B. The test `1 > 1` is `false`, so the code publishes the value of capture A, which says "not live".

**The fix.** The counter already contains the change of the capture that reported it. So "a different capture is in progress" is `> 0`:

```swift file=AVCam/Capture/PhotoCapture.swift
                    if livePhotoCount > 0 {
                        /// Set `isLivePhoto` to `true` while another Live Photo is still in progress.
                        /// This prevents the "Live" badge in the UI from flickering.
                        currentActivity = .photoCapture(willCapture: activity.willCapture, isLivePhoto: true)
                    }
```

Apple's article [Capturing and saving Live Photos](https://developer.apple.com/documentation/avfoundation/capturing-and-saving-live-photos) gives the same rule: hide the indicator only when the number of captures in progress is zero.

**How to test.** On a real iPhone, take two Live Photos quickly, one after the other, and look at the badge.

**What was verified.** Nothing at run time. Live Photo capture does not work in the Simulator. The fix follows from the table above.

### Defect 3: the rotation angle of a new connection

**The symptom.** Turn the iPhone to landscape in photo mode, change to video mode, and record immediately. The movie can have the wrong orientation. [Chapter 8](ch08-concepts.md#things-to-know-about-the-sample) described this.

**The cause.** The rotation angle of a capture is a property of a connection: [`videoRotationAngle`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle). The capture service sets it at two moments: when it makes the [`RotationCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator), and when the coordinator reports a new angle. But a connection lives only while its output is in the session. In photo mode, the movie output is not in the session. Each change to video mode calls [`addOutput(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutput(_:)), and that makes a new connection. The new connection has a default angle, not the current angle. It gets the correct angle only at the next rotation of the device or at the next change of camera.

**The fix.** Apply the current angle immediately after the output is in the session:

```swift file=AVCam/CaptureService.swift
            try addOutput(movieCapture.output)
            // Adding the output creates a new connection. Give it the current capture rotation angle.
            updateCaptureRotation(rotationCoordinator.videoRotationAngleForHorizonLevelCapture)
```

The coordinator always has the current value in [`videoRotationAngleForHorizonLevelCapture`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture). You do not need to wait for a change.

**How to test.** On a real iPhone: landscape, change to video mode, record, and open the movie in the Photos app.

**What was verified.** Nothing at run time. The Simulator does not show the orientation of a capture. In the Simulator, the change of mode and a recording still work with the new line. This tutorial did not measure which angle a new connection has, so it does not say how the movie looks without the fix.

### Defect 4: the late capture sound

**The symptom.** A person with AirPods clicks the stem to take a photo. The shutter sound comes late, after the app saved the photo. In an unusual case, it does not come. [Chapter 11](ch11-concepts.md#things-to-know-about-the-sample) described this, with a diagram.

**The cause.** The app disabled the default sound, so it must play a sound itself with [`play(_:)`](https://developer.apple.com/documentation/avkit/avcaptureevent/play(_:)). In the sample, this call is the last statement of the closure. Before it, the closure waits for `camera.capturePhoto()`. That method waits for the capture, for a location, and for the save to the Photos library. The header of the event says that `play(_:)` does nothing when the event is older than 15 seconds.

**The fix.** The new closure has three parts in a new order: select the sound, play the sound, capture.

```swift file=AVCam/CameraView.swift
                            // Play a sound when capturing by clicking an AirPods stem. Play it before
                            // the capture, so that the person hears it at the moment of the click.
                            if event.shouldPlaySound {
                                event.play(sound)
                            }
                            switch camera.captureMode {
                            case .photo:
                                // Capture a photo when pressing a hardware button.
                                await camera.capturePhoto()
                            case .video:
                                // Toggle video recording when pressing a hardware button.
                                await camera.toggleRecording()
                            }
```

The first `switch` statement of the closure stays. It selects the sound, and in video mode it reads `isRecording` before the recording state changes.

**How to test.** On a real iPhone with AirPods that support the camera remote: click the stem and listen for the moment of the sound.

**What was verified.** Nothing at run time. The Simulator sends no capture events, and nobody tested with AirPods.

## What the camera can do

The first fix uses a small part of what the movie output offers for the end of a recording.

| Capability | What it does | In this tutorial |
|---|---|---|
| The finish callback | The output calls it one time for each recording, after a stop request, an error, or a limit. | This chapter handles the two paths. |
| `AVErrorRecordingSuccessfullyFinishedKey` | A Boolean value in the error of the finish callback: is the file playable? | This chapter |
| `maxRecordedDuration` | A hard time limit. The default value is "no limit". | The experiment only |
| [`maxRecordedFileSize`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/maxrecordedfilesize) | A hard size limit in bytes. The default value 0 means "no limit". | Not in AVCam |
| [`minFreeDiskSpaceLimit`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/minfreediskspacelimit) | The recording stops when the free space on the disk falls below this number of bytes. A recording can then end in a controlled way before the disk is full. | Not in AVCam |
| Pause and resume | [`pauseRecording()`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/pauserecording()) and [`resumeRecording()`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/resumerecording()) put more than one segment into one file (iOS 18). A change of format or device stops the recording, also during a pause. | Not in AVCam |
| The start callback | [`fileOutput(_:didStartRecordingTo:from:)`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didstartrecordingto:from:)) tells you when the output really writes. An app can show its recording state at that moment. The header says that this call possibly does not come when an error prevents all writing. | Not in AVCam |
| [`recordedDuration`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/recordedduration) | The duration of the file until now. The output also has `recordedFileSize`. | The timer from chapter 8 |
| [`movieFragmentInterval`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/moviefragmentinterval) | The output writes the movie in fragments, by default each 10 seconds. With fragments, a file stays readable when the recording ends in a crash. | Default value |
| One recording at a time | On iOS, the movie output makes one recording at a time. A second start request during a recording fails. | The guard in `startRecording()` |

**Errors that can leave a usable movie.** The research for this tutorial names these causes: a time limit ([`maximumDurationReached`](https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/maximumdurationreached)), a size limit (`maximumFileSizeReached`), a full disk (`diskFull`), and an interruption of the session. The header does not say which error code comes with a usable file. So do not decide by the code. Read the key.

Capabilities that are related to the other three fixes:

| Capability | What it does | In this tutorial |
|---|---|---|
| An angle for each new output | Apple's article [Supporting device rotation in your camera app](https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app) describes a newer design. There, the method that adds an output applies the stored capture angle to each new output. | This chapter does it for the movie output only. |
| The default sound | Without `defaultSoundDisabled: true`, the system plays one default tone for a stem click, and the app plays nothing. | Not in AVCam |
| A custom sound | [`AVCaptureEventSound`](https://developer.apple.com/documentation/avkit/avcaptureeventsound) can also play a sound file from the app bundle. | Not in AVCam |
| [`shouldPlaySound`](https://developer.apple.com/documentation/avkit/avcaptureevent/shouldplaysound) | `true` only for a stem click when the app disabled the default sound. For a volume button, it is `false`. | Chapter 11 |

## Why this design

**A second path, not a new design.** The fix keeps the path of the sample: `toggleRecording()` calls `stopRecording()`, waits, and saves the movie. It adds one path for the results that nobody waits for. The change is small, and you can see what is from Apple and what is new. The cost is two places that save a movie: `toggleRecording()` and the new task.

**Why a stream.** An unexpected result is an event that the model did not ask for. It can come at any time, and more than one can come while the app runs. The model reads all other events of the capture service with `for await` loops in `observeState()`. A stream has the same form. With the default buffering policy of [`makeStream(of:bufferingPolicy:)`](https://developer.apple.com/documentation/swift/asyncstream/makestream(of:bufferingpolicy:)), the stream also keeps each result until the reader takes it.

The alternatives:

| Design | How it works | Why not here |
|---|---|---|
| One stream for all finished recordings | `stopRecording()` only asks the output to stop. Each result, expected or not, comes through the stream. | This is the cleaner design: one path, no continuation that can stay open. But it changes `toggleRecording()` and removes the `async` form of the sample. For new code, it is a good choice. |
| Keep the result on the delegate | The delegate stores an early result. A later call of `stopRecording()` returns it. | The movie waits until the person taps the button. Until then, the interface shows a recording, or the app needs a separate signal to reset it. |
| A `@Published` property | `MovieCapture` publishes the last unexpected result. | A published property keeps one value and gives it to each new subscriber. A result is an event, not a state: the model must get each one exactly one time. |
| Observe the session | Interruption notifications, or key-value observation of `isRecording`, tell the app that a recording ended. | They do not give you the file and the error. Only the delegate callback does, and only that call says that the file is complete. |

**Why `Result`.** A recording that ends by itself can also fail. An `AsyncStream` cannot throw, so the error goes through the stream as a value. In the model, `result.get()` changes it back into a thrown error, and one `catch` block handles a bad recording and a bad save.

**Why a closure on the delegate.** The delegate does not know `MovieCapture`. It only knows "nobody waits, so call this". The closure captures `self` weakly, because the service keeps the delegate and the delegate keeps the closure.

**Why `notRecording` is an error.** `stopRecording()` must return a movie or throw. When there is no recording, it has no movie. The model stores the error, as it does for each capture error.

**Why the fix for the angle is one line.** After the setup, `setCaptureMode(_:)` is the only place that adds an output. A more general fix is in `addOutput(_:)`, as in Apple's newer article. In this app, the two do the same thing.

**Why the sound comes first.** The sound is feedback for a person who does not look at the screen. Its job is to confirm the click, not the result. The cost: the person hears the sound also when the capture fails after it.

## What this chapter does not fix

The four fixes do not make the sample free of defects. These points stay. They are ideas for your own work.

- **The capture activity never returns to idle after a photo.** The last value of the progress stream stays in `captureActivity`. See [chapter 3](ch03-concepts.md#things-to-know-about-the-sample).
- **A photo processing error can get lost.** The photo delegate writes the error to the log. The caller then gets the general error "no photo data", not the cause.
- **`MovieCapture` writes state from more than one thread.** The timer writes `captureActivity` on the main thread. The new handler writes `captureActivity` and `delegate` on the thread of the delegate callback. The capture service calls the object from the session queue. This compiles in the Swift 5 language mode. It is not correct for strict concurrency.
- **`CameraState` has HDR on by default.** See [chapter 13](ch13-concepts.md#things-to-know-about-the-sample).
- **A failed save leaves a file.** When the Photos library refuses a movie or a photo, nobody deletes the file in the temporary directory. This is also true for a movie from the new path.
- **The badge has one more gap.** The code forces the badge on only when a capture changes its "live" value. From a read of the code, a photo without Live Photo that begins while a Live Photo still records publishes "not live", and the badge goes off. Nobody tested this.
- **A late tap can store an error.** From a read of the code: if the person taps the button in the moment after the recording ended by itself, the model can still call `stopRecording()`. The method then throws `notRecording`, and the model stores this error. The movie is still saved through the stream.

The sections "Things to know about the sample" of the earlier chapters have more points.

## Common mistakes

- **You set a continuation only in the "stop" method and expect that the callback comes after it.** Each path to the callback must resume the continuation, or must have a different place for the result.
- **You store a continuation when no callback can come.** Test first if the operation still runs. If it does not, resume the continuation immediately.
- **You resume a continuation two times.** A checked continuation stops the app in this case. In the new delegate, the `if` statement makes sure that each result goes to one place only.
- **You make a failure from each error of the finish callback.** Read `AVErrorRecordingSuccessfullyFinishedKey` first. A recording that reached a limit can be a good movie.
- **You use the movie file before the finish callback.** The output writes the last data in the background. The file is complete only when the callback arrives.
- **You stop the timer only in the "stop" method.** Each path that ends the recording must also end the recording state of the interface.
- **You count from 1 when the counter already contains the current item.** Write down the sequence with small numbers before you select `> 0` or `> 1`.
- **You set a property of a connection one time and expect that it stays.** A connection ends when its output or its input leaves the session. Apply the settings again after each `addOutput(_:)`.
- **You put feedback behind an `await`.** Sounds and visual feedback come first. Slow work comes after them.
- **You leave a test line in the code.** A line such as the 3-second limit of the experiment changes each recording. Remove it before you continue.
- **You call a defect "confirmed" after a read of the code.** A read gives you a hypothesis. Only a test on a device confirms it. Three of the four fixes in this chapter are not tested.

> [!NOTE]
> The Simulator with SimCam shows the result of the first fix only. The Live Photo badge, the orientation of a movie, and the AirPods sound need a real iPhone. The tutorial page tells you how to test them.

## Documentation

```links
AVCaptureFileOutput | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput | The superclass of the movie output, with start, stop, pause, and the limits.
AVCaptureFileOutputRecordingDelegate | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate | The callbacks for one recording.
fileOutput(_:didFinishRecordingTo:from:error:) | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didfinishrecordingto:from:error:) | The finish callback, which the output always calls.
AVErrorRecordingSuccessfullyFinishedKey | https://developer.apple.com/documentation/avfoundation/averrorrecordingsuccessfullyfinishedkey | The key that tells you if a recording with an error is playable.
AVError.Code.maximumDurationReached | https://developer.apple.com/documentation/avfoundation/averror-swift.struct/code/maximumdurationreached | The error code for a recording that reached its time limit.
maxRecordedDuration | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/maxrecordedduration | The time limit of a recording.
maxRecordedFileSize | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/maxrecordedfilesize | The size limit of a recording.
minFreeDiskSpaceLimit | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/minfreediskspacelimit | The free disk space below which a recording stops.
stopRecording() | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/stoprecording() | The stop request. The file is complete only after the finish callback.
pauseRecording() | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/pauserecording() | Pause a recording (iOS 18).
resumeRecording() | https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/resumerecording() | Continue a paused recording (iOS 18).
fileOutput(_:didStartRecordingTo:from:) | https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didstartrecordingto:from:) | The callback for the moment when the output starts to write.
movieFragmentInterval | https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/moviefragmentinterval | The fragment interval, and why fragments exist.
AsyncStream | https://developer.apple.com/documentation/swift/asyncstream | The stream type for the unexpected results.
makeStream(of:bufferingPolicy:) | https://developer.apple.com/documentation/swift/asyncstream/makestream(of:bufferingpolicy:) | The method that makes a stream and its continuation together.
CheckedContinuation | https://developer.apple.com/documentation/swift/checkedcontinuation | The continuation type, which must be resumed exactly one time.
withCheckedThrowingContinuation(isolation:function:_:) | https://developer.apple.com/documentation/swift/withcheckedthrowingcontinuation(isolation:function:_:) | The function that connects a callback to `async` code.
Capturing and saving Live Photos | https://developer.apple.com/documentation/avfoundation/capturing-and-saving-live-photos | The Apple article with the rule for the Live Photo indicator.
Supporting device rotation in your camera app | https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app | The Apple article with a newer rotation design, which applies the angle to each new output.
AVCaptureDevice.RotationCoordinator | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator | The object that supplies the preview angle and the capture angle.
videoRotationAngle | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle | The rotation angle of one connection.
addOutput(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutput(_:) | The method that adds an output and makes its connections.
AVCaptureEvent | https://developer.apple.com/documentation/avkit/avcaptureevent | The event of a hardware button or an AirPods stem.
play(_:) | https://developer.apple.com/documentation/avkit/avcaptureevent/play(_:) | The method that plays a capture sound through AirPods.
AVCaptureEventSound | https://developer.apple.com/documentation/avkit/avcaptureeventsound | The system sounds and custom sounds for capture events.
WWDC25: Enhancing your camera experience with capture controls | https://developer.apple.com/videos/play/wwdc2025/253/ | The session about capture events and the AirPods remote.
Concepts: photo features | ch07-concepts.md | The chapter that introduced the Live Photo badge and its counter.
Concepts: record video | ch08-concepts.md | The chapter that introduced the movie output and the recording delegate.
Concepts: hardware buttons and AirPods | ch11-concepts.md | The chapter that introduced capture events and their sounds.
Build: fix the sample | ch15-build.md | The tutorial for this chapter.
```
