---
kind: tutorial
chapter: 15
title: Build: fix the sample
abstract: Correct four defects of the sample: save a recording that ends by itself, keep the Live Photo badge on, give a new movie connection its rotation angle, and play the capture sound before the capture work.
estimatedMinutes: 35
startBranch: chapter-14
branch: chapter-15
---

In this tutorial, you correct four defects that the earlier chapters found in the Apple sample. At the end, the app saves a movie when the recording ends by itself, the "LIVE" badge stays on while a Live Photo records, a movie gets the correct rotation after a change of mode, and a person with AirPods hears the capture sound at the click.

This chapter changes code that came from Apple. The fixes are the design of this tutorial. They are not in the Apple sample. The defects come from a careful read of the code and of the SDK headers. Apple confirmed only the rotation defect, in the article [Supporting device rotation in your camera app](https://developer.apple.com/documentation/avfoundation/supporting-device-rotation-in-your-camera-app).

You add no new files. You add approximately 85 lines to five files, and you remove 13 lines. Most of the work is the first fix, the recording. It has three sections. The other three fixes are small, and each has one section.

Only the first fix has a result that you can see in the Simulator. The other three fixes need a Live Photo, a rotation of the device, or AirPods. Nobody ran them for this tutorial. Each section tells you how to test its fix on a real iPhone. Read [Concepts: fix the sample](ch15-concepts.md) first if you want the reason for each defect.

## Make a stream for unexpected results

A recording can end before the app stops it. The movie output reaches a limit, the disk is full, or the system interrupts the session. The output then calls the delegate, but in the sample nobody waits for this call. The result is lost, the timer continues, and a later call of `stopRecording()` never returns.

The repair needs a second way for a result to leave `MovieCapture`. In this section, you make this way: an asynchronous stream. You also make an error for a stop request that comes too late.

![The two paths of the finish callback: the app stops the recording and a continuation waits for the result, or the recording ends by itself and the result goes into a stream](../images/ch15-finish-paths.svg)

### Step
In `MovieCapture.swift`, add the `MovieCaptureError` enumeration above the `MovieCapture` class.

`stopRecording()` needs an error for the case in which there is no recording to stop. `PhotoCapture.swift` has an enumeration of the same form, `PhotoCaptureError`.

```swift file=AVCam/Capture/MovieCapture.swift highlight=4-6
import AVFoundation
import Combine

enum MovieCaptureError: Error {
    case notRecording
}

/// An object that manages a movie capture output to record videos.
final class MovieCapture: OutputService {
```

### Step
Below the `isHDRSupported` property, add the `unexpectedResults` stream and its continuation.

An [`AsyncStream`](https://developer.apple.com/documentation/swift/asyncstream) gives values to one reader during a period of time. Its continuation is the end into which you write. Each value is a `Result`, because a recording that ends by itself can also fail, and the model must know about the two cases.

Xcode shows an error now, because the two constants have no value. The next step corrects this.

```swift file=AVCam/Capture/MovieCapture.swift highlight=5-8
    // A Boolean value that indicates whether the currently selected camera's
    // active format supports HDR.
    private var isHDRSupported = false
    
    /// A stream of the results of recordings that end without a request from the app,
    /// for example because of an interruption or a full disk.
    let unexpectedResults: AsyncStream<Result<Movie, Error>>
    private let unexpectedResultsContinuation: AsyncStream<Result<Movie, Error>>.Continuation

    // MARK: - Capturing a movie
```

### Step
Add an initializer that makes the stream and stores its two parts.

[`makeStream(of:bufferingPolicy:)`](https://developer.apple.com/documentation/swift/asyncstream/makestream(of:bufferingpolicy:)) returns the stream and the continuation together. The photo capture delegate from chapter 3 makes its activity stream in the same way. With the default buffering policy, the stream keeps each value until the reader takes it. Thus a result that arrives before the reader is ready is not lost.

```swift file=AVCam/Capture/MovieCapture.swift highlight=4-8
    let unexpectedResults: AsyncStream<Result<Movie, Error>>
    private let unexpectedResultsContinuation: AsyncStream<Result<Movie, Error>>.Continuation
    
    init() {
        let (unexpectedResults, continuation) = AsyncStream.makeStream(of: Result<Movie, Error>.self)
        self.unexpectedResults = unexpectedResults
        self.unexpectedResultsContinuation = continuation
    }

    // MARK: - Capturing a movie
```

### Step
In the `MovieCaptureDelegate` class, add the `unexpectedFinishHandler` property below the `continuation` property.

The delegate now has two ways to give its result away. The continuation is for a caller that waits in `stopRecording()`. The closure is for the case in which nobody waits. A closure keeps the delegate simple: the delegate does not know the `MovieCapture` object or the stream.

```swift file=AVCam/Capture/MovieCapture.swift highlight=7-8
    // MARK: - Movie capture delegate
    /// A delegate object that responds to the capture output finalizing movie recording.
    private class MovieCaptureDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
        
        var continuation: CheckedContinuation<Movie, Error>?
        
        /// A closure to call when the recording ends before the app stops it.
        var unexpectedFinishHandler: ((Result<Movie, Error>) -> Void)?
        
```

### Step
Build the project to make sure that the new declarations compile.

No code uses the stream or the closure yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Send each result to the correct place

The header of [`AVCaptureFileOutputRecordingDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate) makes one promise about [`fileOutput(_:didFinishRecordingTo:from:error:)`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate/fileoutput(_:didfinishrecordingto:from:error:)): the output calls the method one time for each recording request. The call comes after `stopRecording()`, and it also comes when an error or a limit ends the recording.

In this section, you change the delegate so that it is correct for the two cases. Then you change `startRecording()` and `stopRecording()` so that the service is also correct for the two cases.

### Step
At the end of the `MovieCaptureDelegate` class, below the `fileOutput` method, add the `isMovieUsable(after:)` method.

An error in the callback does not always mean a bad file. The `userInfo` dictionary of the error can contain [`AVErrorRecordingSuccessfullyFinishedKey`](https://developer.apple.com/documentation/avfoundation/averrorrecordingsuccessfullyfinishedkey). The header says that its value is a Boolean number that tells you if the recording is playable. When the key is not there, the method returns `false`, which is the safe answer.

```swift file=AVCam/Capture/MovieCapture.swift highlight=1-8
        /// Returns a Boolean value that indicates whether the output wrote a complete movie file although an error occurred.
        ///
        /// A recording can stop with an error, for example when it reaches a size limit or
        /// when the disk is full, and still produce a file that plays.
        private func isMovieUsable(after error: Error) -> Bool {
            let userInfo = (error as NSError).userInfo
            return userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? false
        }
    }
    
    // MARK: - Monitoring recorded duration
```

### Step
In the `fileOutput` method, replace the `if` statement with code that makes one `Result` value from the callback.

The old code decided two things in one place: if the recording failed, and who gets the answer. The new code makes the first decision only. The result is a failure only when there is an error and the file is not usable. With no error, or with an error that leaves a usable file, the result is a movie.

Xcode can show a warning that `result` is not used. The next step uses it.

```swift file=AVCam/Capture/MovieCapture.swift remove
            if let error {
                // If an error occurs, throw it to the caller.
                continuation?.resume(throwing: error)
            } else {
                // Return a new movie object.
                continuation?.resume(returning: Movie(url: outputFileURL))
            }
```

```swift file=AVCam/Capture/MovieCapture.swift highlight=2-9
        func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
            let result: Result<Movie, Error>
            if let error, !isMovieUsable(after: error) {
                // The movie file isn't usable. Report the error.
                result = .failure(error)
            } else {
                // The movie file is complete. Report a new movie object.
                result = .success(Movie(url: outputFileURL))
            }
        }
```

### Step
Below the result, give the result to the continuation if there is one, and to the handler if there is none.

Only `stopRecording()` sets the continuation. So a continuation means "the app asked to stop, and a caller waits". `resume(with:)` takes the `Result` and returns the movie or throws the error. No continuation means "the recording ended by itself". The old code used `continuation?`, which does nothing in this case, and the result went away.

```swift file=AVCam/Capture/MovieCapture.swift highlight=11-17
        func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
            let result: Result<Movie, Error>
            if let error, !isMovieUsable(after: error) {
                // The movie file isn't usable. Report the error.
                result = .failure(error)
            } else {
                // The movie file is complete. Report a new movie object.
                result = .success(Movie(url: outputFileURL))
            }
            
            if let continuation {
                // The app asked to stop the recording. Return the result to the caller.
                continuation.resume(with: result)
            } else {
                // The recording ended by itself. Nobody waits for the result, so report it separately.
                unexpectedFinishHandler?(result)
            }
        }
```

### Step
In `startRecording()`, set the handler of the new delegate to a closure that captures `self` weakly.

The service keeps the delegate, and the delegate keeps the closure. A strong reference from the closure to the service would make a cycle. The closure has no work yet. You add it in the next step.

```swift file=AVCam/Capture/MovieCapture.swift highlight=10-13
    /// Starts movie recording.
    func startRecording() {
        // Return early if already recording.
        guard !movieOutput.isRecording else { return }

        // Start a timer to update the recording time.
        startMonitoringDuration()

        let delegate = MovieCaptureDelegate()
        // Handle a recording that ends before the app stops it.
        delegate.unexpectedFinishHandler = { [weak self] result in
            guard let self else { return }
        }
        self.delegate = delegate
        movieOutput.startRecording(to: URL.movieFileURL, recordingDelegate: delegate)
    }
```

### Step
In the closure, stop the timer, release the delegate, and write the result into the stream.

Each line repairs one part of the defect. `stopMonitoringDuration()` cancels the timer and sets the capture activity to `idle`, so the interface leaves its recording state. Without a delegate, a later call of `stopRecording()` knows that there is nothing to stop. And `yield(_:)` gives the result to the reader of the stream, so the movie is not lost.

```swift file=AVCam/Capture/MovieCapture.swift highlight=5-7
        let delegate = MovieCaptureDelegate()
        // Handle a recording that ends before the app stops it.
        delegate.unexpectedFinishHandler = { [weak self] result in
            guard let self else { return }
            stopMonitoringDuration()
            self.delegate = nil
            unexpectedResultsContinuation.yield(result)
        }
        self.delegate = delegate
        movieOutput.startRecording(to: URL.movieFileURL, recordingDelegate: delegate)
```

### Step
In `stopRecording()`, throw the `notRecording` error at once when there is no delegate or the output does not record.

A [`CheckedContinuation`](https://developer.apple.com/documentation/swift/checkedcontinuation) must be resumed exactly one time. In the old code, the only place that resumed it was the delegate callback. If the callback came before, the caller waited without end. The guard asks first: can a callback still come? If not, the method resumes the continuation itself.

The guard also unwraps the delegate. Thus the line that stores the continuation needs no `?`.

```swift file=AVCam/Capture/MovieCapture.swift remove
            delegate?.continuation = continuation
```

```swift file=AVCam/Capture/MovieCapture.swift highlight=6-10,12
    /// Stops movie recording.
    /// - Returns: A `Movie` object that represents the captured movie.
    func stopRecording() async throws -> Movie {
        // Use a continuation to adapt the delegate-based capture API to an async interface.
        return try await withCheckedThrowingContinuation { continuation in
            guard let delegate, movieOutput.isRecording else {
                // The output isn't recording, so the delegate receives no callback. Don't wait for one.
                continuation.resume(throwing: MovieCaptureError.notRecording)
                return
            }
            // Set the continuation on the delegate to handle the capture result.
            delegate.continuation = continuation
            
            /// Stops recording, which causes the output to call the `MovieCaptureDelegate` object.
            movieOutput.stopRecording()
            stopMonitoringDuration()
        }
    }
```

### Step
In the `else` block of the guard, stop the timer before the method throws.

When the method comes here, the interface possibly still shows a recording that does not exist. This line makes sure that the timer stops and that the capture activity is `idle` again.

```swift file=AVCam/Capture/MovieCapture.swift highlight=4
        return try await withCheckedThrowingContinuation { continuation in
            guard let delegate, movieOutput.isRecording else {
                // The output isn't recording, so the delegate receives no callback. Don't wait for one.
                stopMonitoringDuration()
                continuation.resume(throwing: MovieCaptureError.notRecording)
                return
            }
```

### Step
Build the project to make sure that the changed class compiles.

A normal recording works as before. A recording that ends by itself now resets the timer, but nothing reads the stream yet, so its movie is not saved. You do that in the next section.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

### Note
The header says that you must not expect the delegate callback on a specific thread. So the handler closure runs on a thread that the output selects, and it writes `captureActivity` and `delegate` from there. The timer of the sample also writes `captureActivity` from the main thread. This chapter does not correct these writes from more than one thread. [Concepts: fix the sample](ch15-concepts.md#what-this-chapter-does-not-fix) lists this point.

## Save the unexpected movie

The results now go into a stream in `MovieCapture`. But the object that saves movies is the model, two layers above. In this section, the capture service passes the stream on, and the model reads it and saves each movie.

### Step
In `CaptureService.swift`, add the `unexpectedRecordingResults` property below the `previewSource` property.

The property is a constant, and it is `nonisolated`, as `previewSource` is. Thus the model can read it with no `await`. Xcode shows an error until the initializer gives the property a value in the next step.

```swift file=AVCam/CaptureService.swift highlight=4-5
    /// A type that connects a preview destination with the capture session.
    nonisolated let previewSource: PreviewSource
    
    /// A stream of the results of recordings that end without a request from the app.
    nonisolated let unexpectedRecordingResults: AsyncStream<Result<Movie, Error>>
    
    // The app's capture session.
    private let captureSession = AVCaptureSession()
```

### Step
In the initializer, set the property to the stream of the movie capture service.

The capture service does not make a second stream. It gives the model the stream that `MovieCapture` made. The model does not know `MovieCapture`, so the service is the place that connects the two.

```swift file=AVCam/CaptureService.swift highlight=4-5
    init() {
        // Create a source object to connect the preview view with the capture session.
        previewSource = DefaultPreviewSource(session: captureSession)
        // Pass on the stream of the movie capture service.
        unexpectedRecordingResults = movieCapture.unexpectedResults
    }
```

### Step
In `observeState()` in `CameraModel.swift`, add a task that reads the stream, below the task for the Camera Control.

The task has the same form as the other tasks in this method. The loop waits for a result, and it runs one time for each recording that ends by itself. The stream never ends, so the task lives as long as the app. Xcode can show a warning that `result` is not used.

```swift file=AVCam/CameraModel.swift highlight=11-15
        Task {
            // Await updates to a person's interaction with the Camera Control HUD.
            for await isShowingFullscreenControls in await captureService.$isShowingFullscreenControls.values {
                withAnimation {
                    // Prefer showing a minimized UI when capture controls enter a fullscreen appearance.
                    prefersMinimizedUI = isShowingFullscreenControls
                }
            }
        }
        
        Task {
            // Await the results of recordings that end without a request from the app.
            for await result in captureService.unexpectedRecordingResults {
            }
        }
        
        Task {
            // Await new zoom levels from the capture service, for example after a camera switch.
```

### Step
In the loop, save the movie of the result, and store an error if there is one.

`result.get()` returns the movie of a success and throws the error of a failure. So one `catch` block handles a recording that failed and a save that failed. This is the same code that `toggleRecording()` has for a movie that the person stopped.

```swift file=AVCam/CameraModel.swift highlight=4-9
        Task {
            // Await the results of recordings that end without a request from the app.
            for await result in captureService.unexpectedRecordingResults {
                do {
                    // Save the movie, if the recording produced one.
                    try await mediaLibrary.save(movie: result.get())
                } catch {
                    self.error = error
                }
            }
        }
```

### Step
Build and run the app. Select video mode, start a recording, and stop it after some seconds.

This is the path that the app had before. The continuation is set, so the delegate gives the movie to `toggleRecording()`, and the stream stays empty.

```settings title="Checkpoint"
Action: Product > Run (Command-R), select video mode, tap the record button, tap it again
Result: The recording stops, and the thumbnail of the movie appears, as before.
```

### Experiment
You can make a recording end by itself in the Simulator. In `startRecording()` in `MovieCapture.swift`, add this temporary line directly above the line that calls `movieOutput.startRecording(to:recordingDelegate:)`. [`maxRecordedDuration`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/maxrecordedduration) is a hard time limit. The header says that the output stops the recording at the limit and calls the delegate with an error. This line is not part of the branch `chapter-15`. You remove it again in the last step of this section.

```swift
movieOutput.maxRecordedDuration = CMTime(seconds: 3, preferredTimescale: 600)
```

### Step
Run the app, select video mode, tap the record button one time, and then wait and do not touch the screen.

The author of the code made this test in the Simulator with SimCam. After 3 seconds, the output ends the recording. No continuation is set, so the result goes through the handler and the stream to the model. The movie arrives in the Photos library, so the delegate made a success from the callback.

```settings title="Checkpoint"
Action: Product > Run (Command-R), select video mode, tap the record button one time, wait 3 seconds
Timer: The recording time returns to 00:00:00.
Button: The record button returns to its idle form.
Movie: The thumbnail appears, and the movie is in the Photos app of the simulator.
```

### Step
Delete the temporary `maxRecordedDuration` line from `startRecording()`, and build the project again.

With the line, each movie of the app stops after 3 seconds. Your code must be equal to the branch `chapter-15` again before you continue.

```settings title="Checkpoint"
Action: Delete the temporary line, then Product > Build (Command-B)
Result: The build succeeds, and startRecording() has no line that sets maxRecordedDuration.
```

### Note
Only the time limit was tested. From the code, the same path is expected to handle a size limit, a full disk, and an interruption, for example a phone call during a recording. Nobody tested these cases for this tutorial. For an interruption, the result can be a movie or an error. That depends on the value that the system puts into the error for `AVErrorRecordingSuccessfullyFinishedKey`.

## Keep the Live Photo badge on

`PhotoCapture` counts the Live Photo captures that are in progress, so that the "LIVE" badge stays on while one of them records. But the sample tests the counter with `> 1`. When the first of two captures ends, the counter goes from 2 to 1, the test is `false`, and the badge goes off while the second capture still records. The section [Things to know about the sample](ch07-concepts.md#things-to-know-about-the-sample) of chapter 7 shows the full sequence.

### Step
In `monitorProgress(of:isolation:)` in `PhotoCapture.swift`, change the test to `> 0`, and change the comment to agree with it.

The counter already contains the capture that reported the change. So after the end of one capture, a value above zero means "a different Live Photo still records". The badge must stay on in exactly this case. The old comment described two captures that run at the same time, which is the condition `> 1`.

```swift file=AVCam/Capture/PhotoCapture.swift remove
                    if livePhotoCount > 1 {
                        /// Set `isLivePhoto` to `true` when there are concurrent Live Photos in progress.
```

```swift file=AVCam/Capture/PhotoCapture.swift highlight=5-6
                if activity.isLivePhoto != isLivePhoto {
                    isLivePhoto = activity.isLivePhoto
                    // Increment or decrement as appropriate.
                    livePhotoCount += isLivePhoto ? 1 : -1
                    if livePhotoCount > 0 {
                        /// Set `isLivePhoto` to `true` while another Live Photo is still in progress.
                        /// This prevents the "Live" badge in the UI from flickering.
                        currentActivity = .photoCapture(willCapture: activity.willCapture, isLivePhoto: true)
                    }
                }
                captureActivity = currentActivity
```

### Step
Build the project to make sure that the change compiles.

Live Photo capture does not work in the Simulator, so you cannot see this fix there. Nobody ran it on an iPhone for this tutorial.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

### Experiment
On a real iPhone, select photo mode with Live Photo on, and tap the capture button two times quickly. The expected result is that the "LIVE" badge stays on, with no break, until the movie of the second photo stops. To see the defect, change the test back to `> 1` and do the same test: the badge is expected to go off for a moment after the first movie stops. Then restore `> 0`.

## Give a new movie connection its rotation angle

The capture service gives the capture rotation angle to the outputs at two moments: when it makes the rotation coordinator, and when the angle changes. But each change to video mode adds the movie output to the session again, and that makes a new connection. The new connection does not get the angle of the old connection. Until the next rotation of the device, a movie can have the wrong orientation.

### Step
In `setCaptureMode(_:)` in `CaptureService.swift`, apply the current capture angle directly after the line that adds the movie output.

[`addOutput(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutput(_:)) makes the connection, so the connection exists on the next line. `updateCaptureRotation(_:)` is the method from chapter 3 that sets [`videoRotationAngle`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle) on the video connection of each output. The coordinator always has the current value in [`videoRotationAngleForHorizonLevelCapture`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture), so the code can read it at any time.

```swift file=AVCam/CaptureService.swift highlight=10-11
        // Configure the capture session for the selected capture mode.
        switch captureMode {
        case .photo:
            // The app needs to remove the movie capture output to perform Live Photo capture.
            captureSession.sessionPreset = .photo
            captureSession.removeOutput(movieCapture.output)
        case .video:
            captureSession.sessionPreset = .high
            try addOutput(movieCapture.output)
            // Adding the output creates a new connection. Give it the current capture rotation angle.
            updateCaptureRotation(rotationCoordinator.videoRotationAngleForHorizonLevelCapture)
            if isHDRVideoEnabled {
                setHDRVideoEnabled(true)
            }
        }
```

### Step
Build and run the app. Select video mode, record a short movie, and stop it.

The Simulator does not show the orientation of a movie, so this checkpoint only makes sure that the change of mode and the recording still work. Nobody tested the orientation on an iPhone for this tutorial.

```settings title="Checkpoint"
Action: Product > Run (Command-R), select video mode, record a short movie, stop it
Result: The mode changes, and the thumbnail of the movie appears, as before.
```

### Experiment
On a real iPhone, start the app in photo mode and turn the iPhone to landscape. Then select video mode, record a short movie immediately, and do not turn the iPhone again. Open the movie in the Photos app. The expected result is a level landscape movie. To see the defect, put a comment in front of the new `updateCaptureRotation` line and do the same test. Remove the comment after the test.

## Play the capture sound first

For a click on an AirPods stem, the app must play the capture sound itself. The sample plays it after `await camera.capturePhoto()` returns. That method waits for the capture, for a location, and for the save to the Photos library. So the person hears the sound late. And [`play(_:)`](https://developer.apple.com/documentation/avkit/avcaptureevent/play(_:)) does nothing when the event is older than 15 seconds.

In this section, you divide the work of the closure into three parts, in this order: select the sound, play the sound, capture.

### Step
In the `onCameraCaptureEvent` closure in `CameraView.swift`, remove the two capture calls and their comments from the `switch` statement.

The `switch` statement now has one job: it selects the sound. In video mode, it still reads `isRecording` before the recording state changes, which is necessary to select the correct one of the two video sounds. Until the next step, a hardware button captures nothing.

```swift file=AVCam/CameraView.swift remove
                                // Capture a photo when pressing a hardware button.
                                await camera.capturePhoto()
```

```swift file=AVCam/CameraView.swift remove
                                // Toggle video recording when pressing a hardware button.
                                await camera.toggleRecording()
```

```swift file=AVCam/CameraView.swift
                    .onCameraCaptureEvent(defaultSoundDisabled: true) { event in
                        if event.phase == .ended {
                            let sound: AVCaptureEventSound
                            switch camera.captureMode {
                            case .photo:
                                sound = .cameraShutter
                            case .video:
                                sound = camera.captureActivity.isRecording ?
                                    .endVideoRecording : .beginVideoRecording
                            }
```

### Step
Below the `if` statement that plays the sound, add a second `switch` statement that does the capture work.

The capture calls are the same as before. Only their position is new: they come after the sound. The `await` calls can now take as much time as they need, because nothing waits behind them.

```swift file=AVCam/CameraView.swift highlight=14-21
                    .onCameraCaptureEvent(defaultSoundDisabled: true) { event in
                        if event.phase == .ended {
                            let sound: AVCaptureEventSound
                            switch camera.captureMode {
                            case .photo:
                                sound = .cameraShutter
                            case .video:
                                sound = camera.captureActivity.isRecording ?
                                    .endVideoRecording : .beginVideoRecording
                            }
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
                        }
                    }
```

### Step
Replace the comment above the `if` statement with a comment that gives the reason for the order.

The order is the full fix, and nothing in the code makes it necessary. A comment tells the next developer not to move the lines back.

```swift file=AVCam/CameraView.swift remove
                            // Play a sound when capturing by clicking an AirPods stem.
```

```swift file=AVCam/CameraView.swift highlight=3-4
                                    .endVideoRecording : .beginVideoRecording
                            }
                            // Play a sound when capturing by clicking an AirPods stem. Play it before
                            // the capture, so that the person hears it at the moment of the click.
                            if event.shouldPlaySound {
                                event.play(sound)
                            }
                            switch camera.captureMode {
```

### Step
Build and run the app, and make sure that the capture button on the screen works as before.

The system sends no capture events in the Simulator, so the closure does not run there. Nobody tested the sound with AirPods for this tutorial.

```settings title="Checkpoint"
Action: Product > Run (Command-R), take a photo, then record a short movie
Result: The app captures the photo and the movie as before.
```

### Experiment
On a real iPhone with AirPods that support the camera remote, select photo mode and click the stem. The expected result is that you hear the shutter sound at the moment of the click, not after the save. Do the same in video mode: you are expected to hear the start sound at the first click and the stop sound at the second click. In the European Union, this test is not possible at this time.

### Text
Your code is now equal to the branch `chapter-15`. Four defects are gone, and one of the fixes ran in the Simulator. The list of weak points that stay in the code is in [Concepts: fix the sample](ch15-concepts.md#what-this-chapter-does-not-fix). In chapter 16, you prepare the app for a new device: iPhone Duo.

## Check your understanding

### A recording reaches a time limit. Nobody called `stopRecording()`. The delegate callback has an error, and the value for `AVErrorRecordingSuccessfullyFinishedKey` in the error is `true`. What does the new delegate do?

- [ ] It makes a failure, because the `error` parameter is not `nil`.
  > That is what the old code did. The new code calls `isMovieUsable(after:)`, which reads the key. With the value `true`, the result is a success.
- [ ] It makes a success and resumes the continuation with it.
  > Only `stopRecording()` sets the continuation. Nobody called that method, so there is no continuation to resume.
- [x] It makes a success and gives it to `unexpectedFinishHandler`, which writes it into the stream.
  > Correct. The key tells the delegate that the file is usable, and the missing continuation tells it that nobody waits. So the result goes through the handler and the stream to the model, which saves the movie.

### Why does `stopRecording()` test `movieOutput.isRecording` before it stores the continuation on the delegate?

- [x] When the output does not record, no callback comes, and a stored continuation is never resumed. The caller then waits without end.
  > Correct. The output calls the delegate one time for each recording. If that call came before, the only safe thing is to resume the continuation immediately, here with the `notRecording` error.
- [ ] The delegate cannot keep a continuation while the output records.
  > It can, and the normal path does exactly that: the method stores the continuation while the output records, and the callback resumes it.
- [ ] The test makes the method faster, because it does not wait for the file.
  > In the normal path, the method must wait: the file is complete only when the delegate callback arrives. The test is there for the case in which no callback can come.

### The new closure plays the capture sound before it calls `capturePhoto()`. What is a cost of this order?

- [ ] The event is older than 15 seconds when the sound plays, so `play(_:)` does nothing.
  > The opposite is true. The sound is now the first work after the click, so the age of the event is not a problem. The old order had this risk.
- [x] The person hears the sound also when the capture or the save fails after it.
  > Correct. The sound now confirms the click, not the result. That agrees with its job: feedback at the moment of the action for a person who does not look at the screen.
- [ ] The closure can no longer select the correct sound in video mode.
  > The first `switch` statement still reads `isRecording` before `toggleRecording()` changes the recording state. The selection of the sound did not change.
