---
kind: tutorial
chapter: 10
title: Build: record video
abstract: Add a microphone and a movie file output, change the session between photo mode and video mode, record a movie with a recording time, and save it to Photos.
estimatedMinutes: 60
startBranch: chapter-09
branch: chapter-10
uncovered: AVCam.xcodeproj/project.pbxproj
---

In this tutorial, you add video to the app. At the end, a picker changes between photo mode and video mode. In video mode, the capture button is red. A tap starts a recording, a time view counts, and a second tap stops the recording and saves the movie to the Photos library.

This is the largest chapter of the tutorial. The work has three parts. First you add the microphone and a service around [`AVCaptureMovieFileOutput`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput). Then you teach the capture service and the model to change the mode and to record. Last, you build the interface: the mode picker, the movie button, the time view, and the changes to the preview.

Read [Concepts: record video](ch10-concepts.md) first if you want the background for each step. HDR video and camera formats are the subject of chapter 11.

## Describe a movie and a capture mode

The capture code and the views exchange small value types. In this section, you add the values that video needs: an activity for a recording, the capture mode, and a type for a recorded movie.

### Step
In `DataTypes.swift`, add the `movieCapture` case to the `CaptureActivity` enumeration.

The associated value has the label `duration`, the type `TimeInterval`, and the default value `0.0`. It is the length of the recording in seconds. The default value lets the code write `.movieCapture()` at the start of a recording, when the length is zero. Give the case a doc comment, as `photoCapture` has.

```swift file=AVCam/Model/DataTypes.swift highlight=8-9
/// An enumeration that defines the activity states the capture service supports.
///
/// This type provides feedback to the UI regarding the active status of the `CaptureService` actor.
enum CaptureActivity {
    case idle
    /// A status that indicates the capture service is performing photo capture.
    case photoCapture(willCapture: Bool = false, isLivePhoto: Bool = false)
    /// A status that indicates the capture service is performing movie capture.
    case movieCapture(duration: TimeInterval = 0.0)

    var isLivePhoto: Bool {
        if case .photoCapture(_, let isLivePhoto) = self {
            return isLivePhoto
        }
        return false
    }
```

### Step
Below the `willCapture` property, add the computed properties `currentTime: TimeInterval` and `isRecording: Bool`.

The time view reads `currentTime`. Buttons read `isRecording` to know if they must be disabled. Each property returns a neutral value for all the cases that are not a movie capture, so the views need no `switch` statement. `currentTime` returns the `duration` of a `movieCapture` case, and `.zero` for the other cases. `isRecording` returns `true` for a `movieCapture` case, and `false` for the other cases. Use `if case`, as the two properties above do.

```swift file=AVCam/Model/DataTypes.swift highlight=8-13,15-20
    var willCapture: Bool {
        if case .photoCapture(let willCapture, _) = self {
            return willCapture
        }
        return false
    }

    var currentTime: TimeInterval {
        if case .movieCapture(let duration) = self {
            return duration
        }
        return .zero
    }

    var isRecording: Bool {
        if case .movieCapture = self {
            return true
        }
        return false
    }
}
```

### Step
Below `CaptureActivity`, add the `CaptureMode` enumeration with its two cases and the `systemName` property.

The declaration is `enum CaptureMode: String, Identifiable, CaseIterable, Codable`. The cases are `photo` and `video`, each with a doc comment. The `id` property returns `self` (`var id: Self { self }`). `CaseIterable` supplies `allCases`, and `Identifiable` lets a `ForEach` use the cases. You use both in the mode picker. `systemName` is the name of the symbol that the picker shows: `"camera.fill"` for `photo` and `"video.fill"` for `video`. The sample writes the `switch` without `return`. The `String` raw value and `Codable` are for chapter 15, where the app stores the mode.

The closing brace of `CaptureActivity` is highlighted too, because git counts it as new. Do not add a second brace. In Try first mode, the first placeholder stands for this brace: write nothing there.

```swift file=AVCam/Model/DataTypes.swift highlight=7,9-15,17-25
    var isRecording: Bool {
        if case .movieCapture = self {
            return true
        }
        return false
    }
}

/// An enumeration of the capture modes that the camera supports.
enum CaptureMode: String, Identifiable, CaseIterable, Codable {
    var id: Self { self }
    /// A mode that enables photo capture.
    case photo
    /// A mode that enables video capture.
    case video

    var systemName: String {
        switch self {
        case .photo:
            "camera.fill"
        case .video:
            "video.fill"
        }
    }
}

/// A structure that represents a captured photo.
struct Photo: Sendable {
    let data: Data
    let isProxy: Bool
    let livePhotoMovieURL: URL?
}
```

### Step
Below the `Photo` structure, add the `Movie` structure with one constant, `url: URL`, the URL of a movie file.

A `Photo` holds its data in memory. A movie can be very large, so the app does not load it. A `Movie` holds only the URL of the file that the movie output writes. A URL is `Sendable`, so the value can go from the capture actor to the main actor.

```swift file=AVCam/Model/DataTypes.swift highlight=8-12
/// A structure that represents a captured photo.
struct Photo: Sendable {
    let data: Data
    let isProxy: Bool
    let livePhotoMovieURL: URL?
}

/// A structure that contains the uniform type identifier and movie URL.
struct Movie: Sendable {
    /// The temporary location of the file on disk.
    let url: URL
}

struct PhotoFeatures {
    let isLivePhotoEnabled: Bool
    let qualityPrioritization: QualityPrioritization
}
```

### Step
Add the `audioDeviceUnavailable` case to the `CameraError` enumeration, below the `videoDeviceUnavailable` case.

The device lookup throws this error when the device has no microphone.

```swift file=AVCam/Model/DataTypes.swift highlight=3
enum CameraError: Error {
    case videoDeviceUnavailable
    case audioDeviceUnavailable
    case addInputFailed
    case addOutputFailed
    case setupFailed
}
```

### Step
Build the project to make sure that the new types compile.

No code uses the new types yet, so the app does not change.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the microphone

A movie needs sound. Audio comes into the session in the same way as video: a capture device in a device input. In this section, you give the app the right to use the microphone, find the microphone, and add it to the session.

The first step is a build setting. Xcode writes it to the project file, `AVCam.xcodeproj/project.pbxproj`. You do not edit this file by hand, so no step shows it.

### Step
Select the AVCam target, open the Build Settings tab, find the Info.plist Values group, and add the usage description for the microphone.

The key behind this name is [`NSMicrophoneUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription). The system shows the text in the alert that asks for microphone access. Without the text, iOS stops the app when it asks for access. This is the value of the Apple sample.

```settings title="Target AVCam › Build Settings › Info.plist Values"
Privacy - Microphone Usage Description: To record audio for Live Photos and videos.
```

### Step
In `DeviceLookup.swift`, add the property `defaultMic: AVCaptureDevice` below the `defaultCamera` property. Give it a `get throws` getter, as `defaultCamera` has.

For cameras, you used discovery sessions, because the app selects between cameras. For audio, [`AVCaptureDevice.default(for:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/default(for:)) with the media type `.audio` is sufficient. When the result is `nil`, throw `CameraError.audioDeviceUnavailable`. The app does not select a microphone. The capture session does this for you, and it selects a microphone that agrees with the camera in use.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=11-19
    /// Returns the system-preferred camera for the host system.
    var defaultCamera: AVCaptureDevice {
        get throws {
            guard let videoDevice = AVCaptureDevice.systemPreferredCamera else {
                throw CameraError.videoDeviceUnavailable
            }
            return videoDevice
        }
    }

    /// Returns the default microphone for the device on which the app runs.
    var defaultMic: AVCaptureDevice {
        get throws {
            guard let audioDevice = AVCaptureDevice.default(for: .audio) else {
                throw CameraError.audioDeviceUnavailable
            }
            return audioDevice
        }
    }
```

### Step
In the `setUpSession()` method of `CaptureService.swift`, get the default microphone and add an input for it. Change the two comments.

Get the microphone with `try deviceLookup.defaultMic` into a local constant `defaultMic`, below `defaultCamera`. Then add it with `try addInput(for: defaultMic)`, below the line that sets `activeVideoInput`. The service keeps the camera input in `activeVideoInput`, because it replaces that input when the camera changes. It never changes the microphone input, so it ignores the result of `addInput(for:)`. The method has the `@discardableResult` attribute for this purpose. The two new comment texts are "Retrieve the default camera and microphone." and "Add inputs for the default camera and microphone devices."

> [!NOTE]
> `isAuthorized` asks only for camera access. The system asks for microphone access when the app creates the input with [`AVCaptureDeviceInput(device:)`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/init(device:)). If the person denies the microphone, the app probably cannot create the input, and then `setUpSession()` throws. The tutorial did not test this case on an iPhone.

```swift file=AVCam/CaptureService.swift remove
            // Retrieve the default camera.
            // Add an input for the default camera device.
```

```swift file=AVCam/CaptureService.swift highlight=7,9,11,13
    // Performs the initial capture session configuration.
    private func setUpSession() throws {
        // Observe internal state and notifications.
        observeOutputServices()

        do {
            // Retrieve the default camera and microphone.
            let defaultCamera = try deviceLookup.defaultCamera
            let defaultMic = try deviceLookup.defaultMic

            // Add inputs for the default camera and microphone devices.
            activeVideoInput = try addInput(for: defaultCamera)
            try addInput(for: defaultMic)

            // Configure the session for photo capture.
            captureSession.sessionPreset = .photo

            // Add the photo capture output as the default output type.
            try addOutput(photoCapture.output)

            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
            // Observe changes to the default camera's subject area.
            observeSubjectAreaChanges(of: defaultCamera)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
Build and run the app to make sure that the session still starts with the two inputs.

If an alert asks for access to the microphone, allow it. The microphone input also gives Live Photos their sound, so the session uses it in photo mode too.

```settings title="Checkpoint"
Action: Product > Run (Command-R)
Result: The app shows the live preview and takes photos as before.
```

## Create the movie capture service

In chapter 3, you wrote `PhotoCapture`, an object that owns the photo output. In this section, you write `MovieCapture`, which does the same for the movie file output. It adopts the same `OutputService` protocol, so the capture service can use the two objects in the same way.

A recording is not one request with one result. You start it, and at some later time you stop it. Only after that, the output tells its delegate that the file is complete.

![The four stages of a recording: the start request, the recording, the stop request, and the delegate callback that completes the file](../images/ch10-recording-timeline.svg)

### Step
Create a new Swift file with the name `MovieCapture.swift` in the `Capture` group, and replace its contents.

The file starts like `PhotoCapture.swift`: the license comment, `import AVFoundation`, and `import Combine`. The class is `final class MovieCapture: OutputService`. It has four members at this time:

- `@Published private(set) var captureActivity: CaptureActivity = .idle`, the state of the movie capture.
- `let output = AVCaptureMovieFileOutput()`, the output object. The class has one output object for the life of the app. The capture service adds this object to the session and removes it when the mode changes.
- `private var movieOutput: AVCaptureMovieFileOutput { output }`, a computed alias with the concrete type. The later steps use `movieOutput`.
- `var capabilities: CaptureCapabilities { CaptureCapabilities() }`, below the mark `// MARK: - Configuration`. The property returns a value with all features off, because this chapter has no optional video feature. Chapter 11 changes this for HDR video.

The protocol has a default implementation of `updateConfiguration(for:)`, so the class compiles without it. You add the real method in the next section.

```swift file=AVCam/Capture/MovieCapture.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
An object that manages a movie capture output to record videos.
*/

import AVFoundation
import Combine

/// An object that manages a movie capture output to record videos.
final class MovieCapture: OutputService {

    /// A value that indicates the current state of movie capture.
    @Published private(set) var captureActivity: CaptureActivity = .idle

    /// The capture output type for this service.
    let output = AVCaptureMovieFileOutput()
    // An internal alias for the output.
    private var movieOutput: AVCaptureMovieFileOutput { output }

    // MARK: - Configuration
    /// Returns the capabilities for this capture service.
    var capabilities: CaptureCapabilities {
        CaptureCapabilities()
    }
}
```

### Step
Inside the class, below `movieOutput`, add the nested class `private class MovieCaptureDelegate: NSObject, AVCaptureFileOutputRecordingDelegate` with the property `continuation`.

The class inherits from `NSObject`, because [`AVCaptureFileOutputRecordingDelegate`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutputrecordingdelegate) is an Objective-C protocol. The continuation is an optional variable of the type `CheckedContinuation<Movie, Error>?`, as in `PhotoCapture` with `Photo`. It is `nil` during the recording, and the service sets it when somebody asks for the result. Put the mark `// MARK: - Movie capture delegate` and a doc comment above the class.

```swift file=AVCam/Capture/MovieCapture.swift highlight=6-8,10-11
    /// The capture output type for this service.
    let output = AVCaptureMovieFileOutput()
    // An internal alias for the output.
    private var movieOutput: AVCaptureMovieFileOutput { output }

    // MARK: - Movie capture delegate
    /// A delegate object that responds to the capture output finalizing movie recording.
    private class MovieCaptureDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {

        var continuation: CheckedContinuation<Movie, Error>?
    }

    // MARK: - Configuration
    /// Returns the capabilities for this capture service.
    var capabilities: CaptureCapabilities {
        CaptureCapabilities()
    }
}
```

### Step
In the delegate class, add the `fileOutput(_:didFinishRecordingTo:from:error:)` method, which resumes the continuation.

This is the only required method of the protocol. Its parameters are `_ output: AVCaptureFileOutput`, `didFinishRecordingTo outputFileURL: URL`, `from connections: [AVCaptureConnection]`, and `error: Error?`. Xcode completes the signature when you type `fileOutput`. The output calls it one time for each recording, also after an error. Only at this time is the movie file complete. With `if let error`, call `continuation?.resume(throwing: error)`. Otherwise call `continuation?.resume(returning: Movie(url: outputFileURL))`. The optional chaining has a result that you must know: if no continuation is set, the delegate discards the result.

```swift file=AVCam/Capture/MovieCapture.swift highlight=7-15
    // MARK: - Movie capture delegate
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

### Step
Between `movieOutput` and the delegate class, add the property `private var delegate: MovieCaptureDelegate?` and the method `startRecording()`, which is not `async` and does not throw.

Put the mark `// MARK: - Capturing a movie` between the property and the method. On iOS, a movie output makes one recording at a time, so the method first returns with a `guard` when `movieOutput.isRecording` is `true`. Each recording gets a new delegate: create a `MovieCaptureDelegate()`, store it in the property, and give it to the output. The property keeps it alive. `URL.movieFileURL` returns a new URL in the temporary directory for each call. That is necessary, because a recording fails if a file exists at the URL. [`startRecording(to:recordingDelegate:)`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/startrecording(to:recordingdelegate:)) returns immediately.

```swift file=AVCam/Capture/MovieCapture.swift highlight=6-7,9,11-14,16-19
    /// The capture output type for this service.
    let output = AVCaptureMovieFileOutput()
    // An internal alias for the output.
    private var movieOutput: AVCaptureMovieFileOutput { output }

    // A delegate object to respond to movie capture events.
    private var delegate: MovieCaptureDelegate?

    // MARK: - Capturing a movie

    /// Starts movie recording.
    func startRecording() {
        // Return early if already recording.
        guard !movieOutput.isRecording else { return }

        let delegate = MovieCaptureDelegate()
        self.delegate = delegate
        movieOutput.startRecording(to: URL.movieFileURL, recordingDelegate: delegate)
    }
```

### Step
Below `startRecording()`, add the method `stopRecording() async throws -> Movie`, which waits for the delegate with a checked continuation.

For a photo, you created the continuation at the start of the capture. For a movie, you create it at the stop request, because only the stop request has a result. Return `try await withCheckedThrowingContinuation { continuation in ... }`. In the closure, the order of the two lines is important: first `delegate?.continuation = continuation`, and then `movieOutput.stopRecording()`. Thus the callback cannot arrive before the continuation is in its place.

```swift file=AVCam/Capture/MovieCapture.swift highlight=11-17,19-22
    /// Starts movie recording.
    func startRecording() {
        // Return early if already recording.
        guard !movieOutput.isRecording else { return }

        let delegate = MovieCaptureDelegate()
        self.delegate = delegate
        movieOutput.startRecording(to: URL.movieFileURL, recordingDelegate: delegate)
    }

    /// Stops movie recording.
    /// - Returns: A `Movie` object that represents the captured movie.
    func stopRecording() async throws -> Movie {
        // Use a continuation to adapt the delegate-based capture API to an async interface.
        return try await withCheckedThrowingContinuation { continuation in
            // Set the continuation on the delegate to handle the capture result.
            delegate?.continuation = continuation

            /// Stops recording, which causes the output to call the `MovieCaptureDelegate` object.
            movieOutput.stopRecording()
        }
    }
```

### Step
Build the project to make sure that `MovieCapture` conforms to `OutputService`.

The class can start and stop a recording, but no code uses it yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Report the duration and configure the connection

The movie service has two more jobs. It must tell the interface how long the recording is, and it must configure the connection between the camera and the movie output.

The movie output sends no progress callbacks. It has a [`recordedDuration`](https://developer.apple.com/documentation/avfoundation/avcapturefileoutput/recordedduration) property, and the service reads it on a timer.

### Step
In `MovieCapture.swift`, add the constant `private let refreshInterval = TimeInterval(0.25)` and the property `private var timerCancellable: AnyCancellable?` below the `delegate` property.

The service reads the duration four times each second. The time view shows full seconds, and with this interval the number changes near the correct moment. An `AnyCancellable` object keeps a Combine subscription alive. When you cancel it or release it, the subscription stops. The comment above the constant is "The interval at which to update the recording time."

```swift file=AVCam/Capture/MovieCapture.swift highlight=9-11
    /// The capture output type for this service.
    let output = AVCaptureMovieFileOutput()
    // An internal alias for the output.
    private var movieOutput: AVCaptureMovieFileOutput { output }

    // A delegate object to respond to movie capture events.
    private var delegate: MovieCaptureDelegate?

    // The interval at which to update the recording time.
    private let refreshInterval = TimeInterval(0.25)
    private var timerCancellable: AnyCancellable?

    // MARK: - Capturing a movie
```

### Step
Below the delegate class, add the private method `startMonitoringDuration()`, which sets `captureActivity` to `.movieCapture()`.

The interface observes `captureActivity`. With this line, it shows a recording immediately, with a duration of zero. Put the mark `// MARK: - Monitoring recorded duration` above the method.

```swift file=AVCam/Capture/MovieCapture.swift highlight=16,18-21
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

    // MARK: - Monitoring recorded duration

    // Starts a timer to update the recording time.
    private func startMonitoringDuration() {
        captureActivity = .movieCapture()
    }
```

### Step
In `startMonitoringDuration()`, start a timer that reads the recorded duration and publishes it.

Assign the result to `timerCancellable`. [`Timer.publish(every:on:in:)`](https://developer.apple.com/documentation/foundation/timer/publish(every:tolerance:on:in:options:)) with `refreshInterval`, `.main`, and `.common` makes a publisher that fires on the main run loop. The `.common` mode keeps the timer active while the person touches a control. `autoconnect()` starts the timer when `sink` subscribes. The `sink` closure captures `[weak self]`, ignores its parameter, and returns with `guard let self`. `movieOutput.recordedDuration` is a `CMTime` value, and its `seconds` property gives the number for `captureActivity = .movieCapture(duration: duration)`.

> [!NOTE]
> The timer closure runs on the main thread. The capture service actor calls this class from its session queue. This is the design of the Apple sample. The concepts page tells you more.

```swift file=AVCam/Capture/MovieCapture.swift highlight=4-11
    // Starts a timer to update the recording time.
    private func startMonitoringDuration() {
        captureActivity = .movieCapture()
        timerCancellable = Timer.publish(every: refreshInterval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                // Poll the movie output for its recorded duration.
                let duration = movieOutput.recordedDuration.seconds
                captureActivity = .movieCapture(duration: duration)
            }
    }
```

### Step
Below `startMonitoringDuration()`, add the private method `stopMonitoringDuration()`, which calls `timerCancellable?.cancel()` and sets `captureActivity` to `.idle`.

The `.idle` value enables the controls of the interface again and sets the time view back to zero.

```swift file=AVCam/Capture/MovieCapture.swift highlight=14-18
    // Starts a timer to update the recording time.
    private func startMonitoringDuration() {
        captureActivity = .movieCapture()
        timerCancellable = Timer.publish(every: refreshInterval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                // Poll the movie output for its recorded duration.
                let duration = movieOutput.recordedDuration.seconds
                captureActivity = .movieCapture(duration: duration)
            }
    }

    /// Stops the timer and resets the time to `CMTime.zero`.
    private func stopMonitoringDuration() {
        timerCancellable?.cancel()
        captureActivity = .idle
    }
```

### Step
Call `startMonitoringDuration()` in `startRecording()`, below the `guard` statement. Call `stopMonitoringDuration()` in `stopRecording()`, as the last line of the continuation closure.

The service publishes the recording state before it asks the output to start. The interface is thus a short time ahead of the output. The timer corrects the duration: `recordedDuration` stays at zero until the output writes.

```swift file=AVCam/Capture/MovieCapture.swift highlight=6-7,24
    /// Starts movie recording.
    func startRecording() {
        // Return early if already recording.
        guard !movieOutput.isRecording else { return }

        // Start a timer to update the recording time.
        startMonitoringDuration()

        let delegate = MovieCaptureDelegate()
        self.delegate = delegate
        movieOutput.startRecording(to: URL.movieFileURL, recordingDelegate: delegate)
    }

    /// Stops movie recording.
    /// - Returns: A `Movie` object that represents the captured movie.
    func stopRecording() async throws -> Movie {
        // Use a continuation to adapt the delegate-based capture API to an async interface.
        return try await withCheckedThrowingContinuation { continuation in
            // Set the continuation on the delegate to handle the capture result.
            delegate?.continuation = continuation

            /// Stops recording, which causes the output to call the `MovieCaptureDelegate` object.
            movieOutput.stopRecording()
            stopMonitoringDuration()
        }
    }
```

### Step
Below `stopMonitoringDuration()`, add the protocol method `updateConfiguration(for device: AVCaptureDevice)`. Get the video connection, and select the HEVC codec when the output supports it.

The capture service calls this method on each output service after each change of the camera or of the mode. Get the connection with `guard let connection = movieOutput.connection(with: .video) else { return }`. In photo mode, the movie output is not in the session and has no connection, so the method returns. HEVC gives a smaller file than H.264 at approximately the same quality. The codec must be in [`availableVideoCodecTypes`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/availablevideocodectypes), so the code tests `.contains(.hevc)` first. Then call `movieOutput.setOutputSettings([AVVideoCodecKey: AVVideoCodecType.hevc], for: connection)`. The method is not private, because the protocol requires it.

```swift file=AVCam/Capture/MovieCapture.swift highlight=7-11,13-17
    /// Stops the timer and resets the time to `CMTime.zero`.
    private func stopMonitoringDuration() {
        timerCancellable?.cancel()
        captureActivity = .idle
    }

    func updateConfiguration(for device: AVCaptureDevice) {
        // The output has a video connection only while the session contains it, which is the
        // case in video capture mode. Adding the output creates a new connection, so the service
        // configures it here rather than when recording starts.
        guard let connection = movieOutput.connection(with: .video) else { return }

        // Configure the connection for HEVC capture.
        if movieOutput.availableVideoCodecTypes.contains(.hevc) {
            movieOutput.setOutputSettings([AVVideoCodecKey: AVVideoCodecType.hevc], for: connection)
        }
    }

    // MARK: - Configuration
    /// Returns the capabilities for this capture service.
    var capabilities: CaptureCapabilities {
        CaptureCapabilities()
    }
}
```

### Step
At the end of `updateConfiguration(for:)`, ask for automatic video stabilization.

Test `connection.isVideoStabilizationSupported` first. Then ask for stabilization on the connection, with [`preferredVideoStabilizationMode`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/preferredvideostabilizationmode). With `.auto`, the system selects a mode for the active format and frame rate. Stabilization crops the picture. If you turn it on when the recording starts, the framing changes at that moment. Thus the code sets it here, when the connection is new.

> [!NOTE]
> The Simulator with SimCam probably does not support HEVC and stabilization. The two `if` statements then do nothing.

```swift file=AVCam/Capture/MovieCapture.swift highlight=12-18
    func updateConfiguration(for device: AVCaptureDevice) {
        // The output has a video connection only while the session contains it, which is the
        // case in video capture mode. Adding the output creates a new connection, so the service
        // configures it here rather than when recording starts.
        guard let connection = movieOutput.connection(with: .video) else { return }

        // Configure the connection for HEVC capture.
        if movieOutput.availableVideoCodecTypes.contains(.hevc) {
            movieOutput.setOutputSettings([AVVideoCodecKey: AVVideoCodecType.hevc], for: connection)
        }

        // Stabilize the video this output records. Stabilization crops the video to leave room to
        // correct for camera motion, so configuring it here, rather than when recording starts,
        // avoids changing the framing at the moment recording begins. Passing `auto` lets the
        // system choose a mode that suits the active format and frame rate.
        if connection.isVideoStabilizationSupported {
            connection.preferredVideoStabilizationMode = .auto
        }
    }
```

### Step
Build the project. `MovieCapture.swift` is now complete for this chapter.

The movie output is not part of the capture session yet, so the app cannot record.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Change the session between photo and video

A session has one configuration at a time. Photo mode and video mode are two configurations with the same inputs, a different preset, and a different set of outputs. In this section, you write the method that changes between them.

![The capture session in photo mode and in video mode: the same inputs, a different preset, and the movie file output only in video mode](../images/ch10-session-modes.svg)

### Step
In `CaptureService.swift`, add the constant `private let movieCapture = MovieCapture()` below `photoCapture`, and the property `private(set) var captureMode = CaptureMode.photo` below `activeVideoInput`. Add `movieCapture` to the array in `outputServices`.

In chapter 3, you wrote code that sends the rotation angle and the configuration update to each element of `outputServices`. That code now reaches the movie service with no change. The service starts in photo mode, as before.

```swift file=AVCam/CaptureService.swift remove
    private var outputServices: [any OutputService] { [photoCapture] }
```

```swift file=AVCam/CaptureService.swift highlight=7-8,11,16-17
    // The app's capture session.
    private let captureSession = AVCaptureSession()

    // An object that manages the app's photo capture behavior.
    private let photoCapture = PhotoCapture()

    // An object that manages the app's video capture behavior.
    private let movieCapture = MovieCapture()

    // An internal collection of output services.
    private var outputServices: [any OutputService] { [photoCapture, movieCapture] }

    // The video input for the currently selected device camera.
    private var activeVideoInput: AVCaptureDeviceInput?

    // The mode of capture, either photo or video. Defaults to photo.
    private(set) var captureMode = CaptureMode.photo

    // An object the service uses to retrieve capture devices.
    private let deviceLookup = DeviceLookup()
```

### Step
Below `currentDevice`, add the method `setCaptureMode(_ captureMode: CaptureMode) throws`. Store the new mode in `self.captureMode`, and open a configuration block.

Put the mark `// MARK: - Capture mode selection` above the method. [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()) make the session apply all changes between them together. The `defer` statement runs the commit at each exit of the method, also when the method throws an error. The method throws, because the next step adds an output with the throwing helper `addOutput(_:)`.

```swift file=AVCam/CaptureService.swift highlight=9,11-16,18-21
    // The device for the active video input.
    private var currentDevice: AVCaptureDevice {
        guard let device = activeVideoInput?.device else {
            fatalError("No device found for current video input.")
        }
        return device
    }

    // MARK: - Capture mode selection

    /// Changes the mode of capture, which can be `photo` or `video`.
    ///
    /// - Parameter `captureMode`: The capture mode to enable.
    func setCaptureMode(_ captureMode: CaptureMode) throws {
        // Update the internal capture mode value before performing the session configuration.
        self.captureMode = captureMode

        // Change the configuration atomically.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
    }

    // MARK: - Device selection
```

### Step
In the configuration block, add a `switch` on `captureMode` that sets the preset for the mode, and removes or adds `movieCapture.output`.

The [`.photo`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/photo) preset is for photos at the full resolution. The [`.high`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/high) preset is for video. While a movie file output is in the session, the photo output cannot capture Live Photos. So the service removes the movie output for photo mode with `captureSession.removeOutput(_:)`, and adds it for video mode with `try addOutput(_:)`, the helper from chapter 3. The photo output stays in the session in both modes.

```swift file=AVCam/CaptureService.swift highlight=9-18
    func setCaptureMode(_ captureMode: CaptureMode) throws {
        // Update the internal capture mode value before performing the session configuration.
        self.captureMode = captureMode

        // Change the configuration atomically.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

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
    }
```

### Step
At the end of `setCaptureMode(_:)`, call `updateCaptureCapabilities()` to configure the outputs for the new mode.

When the session gets the movie output, it makes a new connection for it. This call makes the movie service configure the new connection. The call is before the commit, because the `defer` statement runs last. Thus the codec and the stabilization are part of the same change as the new output.

```swift file=AVCam/CaptureService.swift highlight=20-21
    func setCaptureMode(_ captureMode: CaptureMode) throws {
        // Update the internal capture mode value before performing the session configuration.
        self.captureMode = captureMode

        // Change the configuration atomically.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

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

        // Update the advertised capabilities after reconfiguration.
        updateCaptureCapabilities()
    }
```

### Step
In `updateCaptureCapabilities()`, replace the assignment with a `switch` on `captureMode` that selects the capabilities of `photoCapture` or `movieCapture`.

The service publishes `captureCapabilities` for the interface. In video mode, the value now comes from the movie service, which reports no Live Photo capture. The new comment text is "Set the capture service's capabilities for the selected mode." The model starts to read this value in chapter 11, for the HDR video button.

```swift file=AVCam/CaptureService.swift remove
        // Set the capture service's capabilities.
        captureCapabilities = photoCapture.capabilities
```

```swift file=AVCam/CaptureService.swift highlight=10-16
    // MARK: - Internal state management
    /// Updates the state of the actor to ensure its advertised capabilities are accurate.
    ///
    /// When the capture session changes, such as changing modes or input devices, the service
    /// calls this method to update its configuration and capabilities. The app uses this state to
    /// determine which features to enable in the user interface.
    private func updateCaptureCapabilities() {
        // Update the output service configuration.
        outputServices.forEach { $0.updateConfiguration(for: currentDevice) }
        // Set the capture service's capabilities for the selected mode.
        switch captureMode {
        case .photo:
            captureCapabilities = photoCapture.capabilities
        case .video:
            captureCapabilities = movieCapture.capabilities
        }
    }
```

### Step
Build the project to make sure that the mode change compiles.

No code calls `setCaptureMode(_:)` yet. The app stays in photo mode.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Record and save a movie

The capture service can now prepare the session for video. In this section, you give it the methods to start and stop a recording, send the activity of the movie service to the interface, and teach the media library to save a movie.

### Step
In `observeOutputServices()`, merge the activity publishers of the photo service and the movie service.

`Publishers.Merge(_:_:)` makes one publisher from the two `$captureActivity` publishers. Each value from the photo service or the movie service goes to the `captureActivity` property of the actor, with the same `assign(to:)` call as before. Only one of the two services is busy at a time, so the values do not mix. Change the doc comment to "Merge the `captureActivity` values of the photo and movie capture services, and assign the value to the actor's property." on two lines. The sample has a stray backtick at the end of the second line; keep it, so that your file equals the branch.

```swift file=AVCam/CaptureService.swift remove
    /// Assign the `captureActivity` value of the photo capture service
    /// to the actor's property.
        photoCapture.$captureActivity
```

```swift file=AVCam/CaptureService.swift highlight=1-2,4
    /// Merge the `captureActivity` values of the photo and movie capture services,
    /// and assign the value to the actor's property.`
    private func observeOutputServices() {
        Publishers.Merge(photoCapture.$captureActivity, movieCapture.$captureActivity)
            .assign(to: &$captureActivity)
    }
}
```

### Step
Below `capturePhoto(with:)`, add the method `startRecording()` and the method `stopRecording() async throws -> Movie`, under the mark `// MARK: - Movie capture`.

The two methods only send the call to the movie service. They are methods of the actor, so they start on the session queue, and the model calls them with `await`. `startRecording()` is not `async` and does not throw, like the method of the movie service. `stopRecording()` returns `try await movieCapture.stopRecording()`, when the delegate has the complete file.

```swift file=AVCam/CaptureService.swift highlight=6-11,13-16
    // MARK: - Photo capture
    func capturePhoto(with features: PhotoFeatures) async throws -> Photo {
        try await photoCapture.capturePhoto(with: features)
    }

    // MARK: - Movie capture
    /// Starts recording video. The video records until the user stops recording,
    /// which calls the following `stopRecording()` method.
    func startRecording() {
        movieCapture.startRecording()
    }

    /// Stops the recording and returns the captured movie.
    func stopRecording() async throws -> Movie {
        try await movieCapture.stopRecording()
    }

    // MARK: - Internal state management
```

### Step
In `MediaLibrary.swift`, add the method `save(movie: Movie) async throws` below the `save(photo:)` method.

The method gets `currentLocation` first, as `save(photo:)` does. Then it uses the `performChange(_:)` method from chapter 4, so the permission test and the thumbnail are the same as for a photo. In the closure, create a `PHAssetResourceCreationOptions` object with the name `options`, set its `shouldMoveFile` to `true`, and then create a request with `PHAssetCreationRequest.forAsset()`. Call `addResource(with: .video, fileURL: movie.url, options:)`, set the `location`, and return `placeholderForCreatedAsset`. The resource type is `.video`, and the resource is a file, not data. With [`shouldMoveFile`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions/shouldmovefile), the Photos library moves the file and does not copy it. A movie can be very large, and a copy uses two times the space for a moment. The move also removes the temporary file.

```swift file=AVCam/Model/MediaLibrary.swift highlight=12-23
            // Save Live Photo data.
            if let url = photo.livePhotoMovieURL {
                let livePhotoOptions = PHAssetResourceCreationOptions()
                livePhotoOptions.shouldMoveFile = true
                creationRequest.addResource(with: .pairedVideo, fileURL: url, options: livePhotoOptions)
            }

            return creationRequest.placeholderForCreatedAsset
        }
    }

    /// Saves a movie to the Photos library.
    func save(movie: Movie) async throws {
        let location = try await currentLocation
        try await performChange {
            let options = PHAssetResourceCreationOptions()
            options.shouldMoveFile = true
            let creationRequest = PHAssetCreationRequest.forAsset()
            creationRequest.addResource(with: .video, fileURL: movie.url, options: options)
            creationRequest.location = location
            return creationRequest.placeholderForCreatedAsset
        }
    }
```

### Step
Build the project to make sure that the capture service and the media library compile.

The app can record and save a movie now, but the model and the interface do not use the new methods yet.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the mode and the recording to the model

The views talk to the model, not to the capture service. In this section, you add three members to the model: the capture mode, a value that is `true` during a mode change, and a method that starts or stops a recording. Then you add the same members to the `Camera` protocol and to the preview model.

### Step
In `CameraModel.swift`, add the property `private(set) var isSwitchingModes = false` below `isSwitchingVideoDevices`, and change three comments so that they also name movies.

The preview container reads this property to blur the preview during a mode change. You did the same with `isSwitchingVideoDevices` in chapter 2. The three comments get the words "photo or movie capture", "photo or video", and "photo or movie capture". The new property gets the comment "A Boolean value that indicates whether the app is currently switching capture modes."

```swift file=AVCam/CameraModel.swift remove
    /// The current state of photo capture.
    /// A thumbnail for the last captured photo.
    /// An error that indicates the details of an error during photo capture.
```

```swift file=AVCam/CameraModel.swift highlight=6,12-13,18,21
final class CameraModel: Camera {

    /// The current status of the camera, such as unauthorized, running, or failed.
    private(set) var status = CameraStatus.unknown

    /// The current state of photo or movie capture.
    private(set) var captureActivity = CaptureActivity.idle

    /// A Boolean value that indicates whether the app is currently switching video devices.
    private(set) var isSwitchingVideoDevices = false

    /// A Boolean value that indicates whether the app is currently switching capture modes.
    private(set) var isSwitchingModes = false

    /// A Boolean value that indicates whether to show visual feedback when capture begins.
    private(set) var shouldFlashScreen = false

    /// A thumbnail for the last captured photo or video.
    private(set) var thumbnail: CGImage?

    /// An error that indicates the details of an error during photo or movie capture.
    private(set) var error: Error?
```

### Step
Change the mark above `switchVideoDevices()` to `// MARK: - Changing modes and devices`. Below the mark, add the property `var captureMode = CaptureMode.photo` with a `didSet` observer.

The mode picker writes to this property through a binding. A binding cannot call an `async` method, so the property observer starts the work. For now, the observer has only a `guard` statement, `guard status == .running else { return }`, which stops the work while the camera does not run. The property is not `private(set)`, because the picker writes it.

```swift file=AVCam/CameraModel.swift remove
    // MARK: - Changing devices
```

```swift file=AVCam/CameraModel.swift highlight=1,3-8
    // MARK: - Changing modes and devices

    /// A value that indicates the mode of capture for the camera.
    var captureMode = CaptureMode.photo {
        didSet {
            guard status == .running else { return }
        }
    }

    /// Selects the next available video device for capture.
    func switchVideoDevices() async {
        isSwitchingVideoDevices = true
        defer { isSwitchingVideoDevices = false }
        await captureService.selectNextVideoDevice()
    }
```

### Step
In the observer, start a task that sets `isSwitchingModes` and tells the capture service to change the mode.

In the `Task`, set `isSwitchingModes = true`, and then `defer { isSwitchingModes = false }`. The `defer` statement sets the property back to `false` when the capture service completes the change. The call is `try? await captureService.setCaptureMode(captureMode)`. It uses `try?`, so the model ignores an error from the capture service. The concepts page tells you what this means.

```swift file=AVCam/CameraModel.swift highlight=5-10
    /// A value that indicates the mode of capture for the camera.
    var captureMode = CaptureMode.photo {
        didSet {
            guard status == .running else { return }
            Task {
                isSwitchingModes = true
                defer { isSwitchingModes = false }
                // Update the configuration of the capture service for the new mode.
                try? await captureService.setCaptureMode(captureMode)
            }
        }
    }
```

### Step
Below `flashScreen()`, add the method `toggleRecording() async` under the mark `// MARK: - Video capture`. For now, it starts a recording in each case.

The method has a `switch` on `await captureService.captureActivity` with only a `default` case, which calls `await captureService.startRecording()`. The method asks the capture service for its activity. It does not use a value from the interface. The capture service is the object that knows if a recording is in progress.

```swift file=AVCam/CameraModel.swift highlight=9,11-18
    /// Sets the `showCaptureFeedback` state to indicate that capture is underway.
    private func flashScreen() {
        shouldFlashScreen = true
        withAnimation(.linear(duration: 0.01)) {
            shouldFlashScreen = false
        }
    }

    // MARK: - Video capture

    /// Toggles the state of recording.
    func toggleRecording() async {
        switch await captureService.captureActivity {
        default:
            // In any other case, start recording.
            await captureService.startRecording()
        }
    }

    // MARK: - Internal state observations
```

### Step
Add the `movieCapture` case, which stops the recording and saves the movie to the Photos library.

`stopRecording()` returns only after the delegate callback, so the movie file is complete and closed when the media library moves it. If the stop or the save fails, the model keeps the error in its `error` property.

```swift file=AVCam/CameraModel.swift highlight=4-11
    /// Toggles the state of recording.
    func toggleRecording() async {
        switch await captureService.captureActivity {
        case .movieCapture:
            do {
                // If currently recording, stop the recording and write the movie to the library.
                let movie = try await captureService.stopRecording()
                try await mediaLibrary.save(movie: movie)
            } catch {
                self.error = error
            }
        default:
            // In any other case, start recording.
            await captureService.startRecording()
        }
    }
```

### Step
In `Camera.swift`, add the three new members to the `Camera` protocol: `captureMode: CaptureMode { get set }` and `isSwitchingModes: Bool { get }` below `start()`, and `toggleRecording() async` below `shouldFlashScreen`. Change two comments.

`captureMode` has a getter and a setter, because the picker reads and writes it. The other views only read the state. The two changed comments say "photo capture, movie capture, or idle" and "the most recent photo or video capture". Give each new member a doc comment.

```swift file=AVCam/Model/Camera.swift remove
    /// The camera's current activity state, which can be photo capture or idle.
    /// A thumbnail image for the most recent photo capture.
```

```swift file=AVCam/Model/Camera.swift highlight=7,16-17,19-20,43-44,46
@MainActor
protocol Camera: AnyObject, SendableMetatype {

    /// Provides the current status of the camera.
    var status: CameraStatus { get }

    /// The camera's current activity state, which can be photo capture, movie capture, or idle.
    var captureActivity: CaptureActivity { get }

    /// The source of video content for a camera preview.
    var previewSource: PreviewSource { get }

    /// Starts the camera capture pipeline.
    func start() async

    /// The capture mode, which can be photo or video.
    var captureMode: CaptureMode { get set }

    /// A Boolean value that indicates whether the camera is currently switching capture modes.
    var isSwitchingModes: Bool { get }

    /// Switches between video devices available on the host system.
    func switchVideoDevices() async

    /// A Boolean value that indicates whether the camera is currently switching video devices.
    var isSwitchingVideoDevices: Bool { get }

    /// Performs a one-time automatic focus and exposure operation.
    func focusAndExpose(at point: CGPoint) async

    /// A Boolean value that indicates whether to capture Live Photos when capturing stills.
    var isLivePhotoEnabled: Bool { get set }

    /// A value that indicates how to balance the photo capture quality versus speed.
    var qualityPrioritization: QualityPrioritization { get set }

    /// Captures a photo and writes it to the user's photo library.
    func capturePhoto() async

    /// A Boolean value that indicates whether to show visual feedback when capture begins.
    var shouldFlashScreen: Bool { get }

    /// Starts or stops recording a movie, and writes it to the user's photo library when complete.
    func toggleRecording() async

    /// A thumbnail image for the most recent photo or video capture.
    var thumbnail: CGImage? { get }

    /// An error if the camera encountered a problem.
    var error: Error? { get }
}
```

### Note
The project does not compile at this time, because `PreviewCameraModel` does not have the new members. You add them in the next step.

### Step
In `PreviewCameraModel.swift`, add the same members, and give the initializer a `captureMode` parameter.

The preview model has no session. Its forms differ from `CameraModel`:

- `var captureMode = CaptureMode.photo` with a `didSet` observer, below `captureActivity`. The observer sets `isSwitchingModes = true`, and then a `Task` waits with `try? await Task.sleep(until: .now + .seconds(0.3), clock: .continuous)` and sets `self.isSwitchingModes = false`. Thus an Xcode preview shows the same blur as the real app.
- `private(set) var isSwitchingModes = false`, directly below the property.
- `init(captureMode: CaptureMode = .photo, status: CameraStatus = .unknown)`, which sets `self.captureMode` first. The new parameter lets a preview start in video mode.
- `func toggleRecording()`, not `async`, at the end of the class. It logs `"Moving capture isn't implemented in PreviewCamera."`, the text of the Apple sample.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift remove
    init(status: CameraStatus = .unknown) {
```

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=4-14,20-21,43-45
    private(set) var status = CameraStatus.unknown
    private(set) var captureActivity = CaptureActivity.idle

    var captureMode = CaptureMode.photo {
        didSet {
            isSwitchingModes = true
            Task {
                // Create a short delay to mimic the time it takes to reconfigure the session.
                try? await Task.sleep(until: .now + .seconds(0.3), clock: .continuous)
                self.isSwitchingModes = false
            }
        }
    }
    private(set) var isSwitchingModes = false
    private(set) var isSwitchingVideoDevices = false
    private(set) var thumbnail: CGImage?

    var error: Error?

    init(captureMode: CaptureMode = .photo, status: CameraStatus = .unknown) {
        self.captureMode = captureMode
        self.status = status
    }

    func start() async {
        if status == .unknown {
            status = .running
        }
    }

    func switchVideoDevices() {
        logger.debug("Device switching isn't implemented in PreviewCamera.")
    }

    func capturePhoto() {
        logger.debug("Photo capture isn't implemented in PreviewCamera.")
    }

    func focusAndExpose(at point: CGPoint) {
        logger.debug("Focus and expose isn't implemented in PreviewCamera.")
    }

    func toggleRecording() {
        logger.debug("Moving capture isn't implemented in PreviewCamera.")
    }
}
```

### Step
Build the project to make sure that the two models conform to the protocol.

The interface has no control for the mode yet, so the app stays in photo mode.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds with no errors.
```

## Add the mode picker and the swipe gesture

The person changes the mode in two ways: with a picker above the toolbar, or with a horizontal swipe on the preview. In this section, you build the two controls.

The gesture is on the preview, in `CameraView`. The picker is in `CameraUI`. A small state value, the direction of the last swipe, connects them.

### Step
At the end of `CameraView.swift`, add the `SwipeDirection` enumeration.

The enumeration has four cases, `left`, `right`, `up`, and `down`, as in the Apple sample. The app uses only `left` and `right`.

```swift file=AVCam/CameraView.swift highlight=7-12
#Preview {
    PreviewBackground {
        CameraView(camera: PreviewCameraModel())
    }
}

enum SwipeDirection {
    case left
    case right
    case up
    case down
}
```

### Step
In the `Views` group, create a group with the name `Controls`. In it, create the Swift file `CaptureModeView.swift`, and replace its contents.

The view is `struct CaptureModeView<CameraModel: Camera>: View`. It has `@State var camera: CameraModel` and `@Binding private var direction: SwipeDirection`. Its initializer `init(camera: CameraModel, direction: Binding<SwipeDirection>)` sets `self.camera` and `_direction = direction`, the storage of the binding. The body is `Picker("Capture Mode", selection: $camera.captureMode)` with a `ForEach(CaptureMode.allCases)` that shows `Image(systemName: $0.systemName)` with `.tag($0.rawValue)`. The sample writes `.tag($0.rawValue)`; keep it, so that your file equals the branch. The modifiers are `.frame(width: 180)`, `.pickerStyle(.segmented)`, and `.disabled(camera.captureActivity.isRecording)`. The picker is disabled during a recording, because a mode change removes the movie output and thus ends the recording.

The [`onChange(of:)`](https://developer.apple.com/documentation/swiftui/view/onchange(of:initial:_:)) modifier does the swipe: `.onChange(of: direction) { _, _ in ... }`. In the closure, get `CaptureMode.allCases`, the index of `camera.captureMode` in it (`firstIndex(of:)`, with `-1` when not found), and the new index: one more for a swipe to the right, one less for a swipe to the left. A `guard` statement keeps the new index in the list. Then set `camera.captureMode` to the mode at the new index. End the file with a `#Preview` in a `PreviewBackground` with `PreviewCameraModel()` and `direction: .constant(.left)`. The closure runs only when the direction changes its value. With two modes, that is sufficient for swipes only: a second swipe in the same direction has no mode to go to. But after the person changes the mode with the picker, a swipe in the same direction as the last swipe has no effect.

```swift file=AVCam/Views/Controls/CaptureModeView.swift new result="../images/ch10-s8-6.jpg|The mode picker in the Xcode preview canvas: a segmented control with a camera symbol and a video symbol."
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that toggles the camera's capture mode.
*/

import SwiftUI

/// A view that toggles the camera's capture mode.
struct CaptureModeView<CameraModel: Camera>: View {
    
    @State var camera: CameraModel
    @Binding private var direction: SwipeDirection
    
    init(camera: CameraModel, direction: Binding<SwipeDirection>) {
        self.camera = camera
        _direction = direction
    }
    
    var body: some View {
        Picker("Capture Mode", selection: $camera.captureMode) {
            ForEach(CaptureMode.allCases) {
                Image(systemName: $0.systemName)
                    .tag($0.rawValue)
            }
        }
        .frame(width: 180)
        .pickerStyle(.segmented)
        .disabled(camera.captureActivity.isRecording)
        .onChange(of: direction) { _, _ in
            let modes = CaptureMode.allCases
            let selectedIndex = modes.firstIndex(of: camera.captureMode) ?? -1
            // Increment the selected index when swiping right.
            let increment = direction == .right
            let newIndex = selectedIndex + (increment ? 1 : -1)
            
            guard newIndex >= 0, newIndex < modes.count else { return }
            camera.captureMode = modes[newIndex]
        }
    }
}

#Preview {
    PreviewBackground {
        CaptureModeView(camera: PreviewCameraModel(), direction: .constant(.left))
    }
}
```

### Step
In `CameraUI.swift`, add `@Binding var swipeDirection: SwipeDirection` below `camera`.

The state lives in `CameraView`, where the gesture is. `CameraUI` only gives the binding to the picker. The project does not compile until step 8.5, because the calls of `CameraUI` do not give the binding yet.

```swift file=AVCam/Views/CameraUI.swift highlight=5
/// A view that presents the main camera user interface.
struct CameraUI<CameraModel: Camera>: PlatformView {

    @State var camera: CameraModel
    @Binding var swipeDirection: SwipeDirection

    @Environment(\.verticalSizeClass) var verticalSizeClass
    @Environment(\.horizontalSizeClass) var horizontalSizeClass

    // The size of the window that contains the camera UI.
    @State private var windowSize = CGSize.zero
```

### Step
Add `CaptureModeView(camera: camera, direction: $swipeDirection)` to the compact layout and to the regular layout, and give the preview the binding `.constant(.left)`.

In the compact layout, the picker is between the spacer and the main toolbar. In the regular layout, it is the first view in the `ZStack`, and `.offset(x: -250)` puts it on the left side of the bar, opposite to the features toolbar. The sample's comment on that line says "vertical"; keep it, so that your file equals the branch.

```swift file=AVCam/Views/CameraUI.swift remove
    CameraUI(camera: PreviewCameraModel())
```

```swift file=AVCam/Views/CameraUI.swift highlight=7,19-20,43
    /// This view arranges UI elements vertically.
    @ViewBuilder
    var compactUI: some View {
        VStack(spacing: 0) {
            FeaturesToolbar(camera: camera)
            Spacer()
            CaptureModeView(camera: camera, direction: $swipeDirection)
            MainToolbar(camera: camera)
                .padding(.bottom, bottomPadding)
        }
    }
    
    /// This view arranges UI elements in a layered stack.
    @ViewBuilder
    var regularUI: some View {
        VStack {
            Spacer()
            ZStack {
                CaptureModeView(camera: camera, direction: $swipeDirection)
                    .offset(x: -250) // The vertical offset from center.
                MainToolbar(camera: camera)
                FeaturesToolbar(camera: camera)
                    .frame(width: 250)
                    .offset(x: 250) // The vertical offset from center.
            }
            .frame(width: 740)
            .background(.ultraThinMaterial.opacity(0.8))
            .cornerRadius(12)
            .padding(.bottom, 32)
        }
    }
    
    var bottomPadding: CGFloat {
        // Dynamically calculate the offset for the bottom toolbar in iOS.
        let bounds = CGRect(origin: .zero, size: windowSize)
        let rect = AVMakeRect(aspectRatio: movieAspectRatio, insideRect: bounds)
        return (rect.minY.rounded() / 2) + 12
    }
}

#Preview {
    PreviewBackground {
        CameraUI(camera: PreviewCameraModel(), swipeDirection: .constant(.left))
    }
}
```

### Step
In `CameraView.swift`, add `import AVFoundation` and `import AVKit`, and the state `@State var swipeDirection = SwipeDirection.left` below `camera`. Give `$swipeDirection` to `CameraUI`.

The two imports are from the Apple sample. This chapter does not need them. Chapter 13 uses AVKit for the hardware buttons. The comment above the state is "The direction a person swipes on the camera preview or mode selector."

```swift file=AVCam/CameraView.swift remove
            CameraUI(camera: camera)
```

```swift file=AVCam/CameraView.swift highlight=2-3,13-14,32
import SwiftUI
import AVFoundation
import AVKit

@MainActor
struct CameraView<CameraModel: Camera>: PlatformView {

    @Environment(\.verticalSizeClass) var verticalSizeClass
    @Environment(\.horizontalSizeClass) var horizontalSizeClass

    @State var camera: CameraModel

    // The direction a person swipes on the camera preview or mode selector.
    @State var swipeDirection = SwipeDirection.left

    var body: some View {
        ZStack {
            // A container view that manages the placement of the preview.
            PreviewContainer(camera: camera) {
                // A view that provides a preview of the captured content.
                CameraPreview(source: camera.previewSource)
                    // Focus and expose at the tapped point.
                    .onTapGesture { location in
                        Task { await camera.focusAndExpose(at: location) }
                    }
                    /// The value of `shouldFlashScreen` changes briefly to `true` when capture
                    /// starts, and then immediately changes to `false`. Use this change to
                    /// flash the screen to provide visual feedback when capturing photos.
                    .opacity(camera.shouldFlashScreen ? 0 : 1)
            }
            // The main camera user interface.
            CameraUI(camera: camera, swipeDirection: $swipeDirection)
        }
    }
}
```

### Step
Below `body`, add the property `swipeGesture: some Gesture`, and attach it to the camera preview with `.simultaneousGesture(swipeGesture)`, between `onTapGesture` and `opacity`.

The property returns `DragGesture(minimumDistance: 50)` with an `onEnded` closure. A drag must be 50 points long before it counts. When it ends, the sign of `$0.translation.width` gives the direction: `.left` when it is less than zero, otherwise `.right`. `simultaneousGesture` lets the drag gesture and the tap gesture for focus work on the same view.

```swift file=AVCam/CameraView.swift highlight=11-12,23-29
    var body: some View {
        ZStack {
            // A container view that manages the placement of the preview.
            PreviewContainer(camera: camera) {
                // A view that provides a preview of the captured content.
                CameraPreview(source: camera.previewSource)
                    // Focus and expose at the tapped point.
                    .onTapGesture { location in
                        Task { await camera.focusAndExpose(at: location) }
                    }
                    // Switch between capture modes by swiping left and right.
                    .simultaneousGesture(swipeGesture)
                    /// The value of `shouldFlashScreen` changes briefly to `true` when capture
                    /// starts, and then immediately changes to `false`. Use this change to
                    /// flash the screen to provide visual feedback when capturing photos.
                    .opacity(camera.shouldFlashScreen ? 0 : 1)
            }
            // The main camera user interface.
            CameraUI(camera: camera, swipeDirection: $swipeDirection)
        }
    }

    var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 50)
            .onEnded {
                // Capture swipe direction.
                swipeDirection = $0.translation.width < 0 ? .left : .right
            }
    }
}
```

### Step
Build and run the app. Find the picker with a camera symbol and a video symbol above the main toolbar, and select the video symbol.

The capture service changes the session to the video configuration. The capture button and the shape of the preview do not change yet. You do this work in the next sections.

> [!NOTE]
> The tutorial did not test the swipe gesture in the Simulator. Use the picker for the checkpoints.

```settings title="Checkpoint" result="../images/ch10-s8-7.jpg|The mode picker above the main toolbar, in the photo mode."
Action: Product > Run (Command-R), then select the video symbol in the picker
Result: The picker shows the video mode as selected. The app continues to show the live preview.
```

## Add the movie capture button

A camera shows the mode also in its capture button. In photo mode, the button is white. In video mode, it is red, and it changes its shape during a recording. In this section, you add the movie button and show it in video mode.

### Step
At the end of `CaptureButton.swift`, add `private struct MovieCaptureButton: View` with its properties, its initializer, and a nested button style.

The properties are `private let action: (Bool) -> Void`, `private let lineWidth = CGFloat(4.0)`, and `@Binding private var isRecording: Bool`. The initializer is `init(isRecording: Binding<Bool>, action: @escaping (Bool) -> Void)`; it sets `_isRecording = isRecording` and `self.action = action`. The recording state is a binding. The `CaptureButton` view owns the state, and chapter 13 uses that to change the button from outside. The nested `struct NoFadeButtonStyle: ButtonStyle` returns `configuration.label` from `makeBody(configuration:)` with no change, so the button does not become dim while the person presses it. The next step adds `body` between the initializer and the style.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=10,12-13,15,17-20,22-27
    struct PhotoButtonStyle: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .scaleEffect(configuration.isPressed ? 0.85 : 1.0)
                .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
        }
    }
}

private struct MovieCaptureButton: View {

    private let action: (Bool) -> Void
    private let lineWidth = CGFloat(4.0)

    @Binding private var isRecording: Bool

    init(isRecording: Binding<Bool>, action: @escaping (Bool) -> Void) {
        _isRecording = isRecording
        self.action = action
    }

    struct NoFadeButtonStyle: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
        }
    }
}
```

### Step
Add the `body` property, which draws a white ring and a red shape that changes with the recording state.

The body is a `ZStack` with two views. The first is a `Circle()` with `.stroke(lineWidth: lineWidth)` and `.foregroundColor(Color.white)`. The second is a `Button` with `.buttonStyle(NoFadeButtonStyle())`. Its label is a `GeometryReader` with a `RoundedRectangle`. The corner radius is `geometry.size.width` divided by `2.0` when the app does not record, which gives a circle, and by `4.0` during a recording. The rectangle has `.inset(by: lineWidth * 1.2)`, `.fill(.red)`, and `.scaleEffect(isRecording ? 0.6 : 1.0)`. Thus during a recording the shape is smaller and its corners are less round, which gives the usual stop symbol. The action of the button calls `isRecording.toggle()` inside `withAnimation(.easeInOut(duration: 0.25))`, and then `action(isRecording)`.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=13-33
private struct MovieCaptureButton: View {

    private let action: (Bool) -> Void
    private let lineWidth = CGFloat(4.0)

    @Binding private var isRecording: Bool

    init(isRecording: Binding<Bool>, action: @escaping (Bool) -> Void) {
        _isRecording = isRecording
        self.action = action
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(lineWidth: lineWidth)
                .foregroundColor(Color.white)
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    isRecording.toggle()
                }
                action(isRecording)
            } label: {
                GeometryReader { geometry in
                    RoundedRectangle(cornerRadius: geometry.size.width / (isRecording ? 4.0 : 2.0))
                        .inset(by: lineWidth * 1.2)
                        .fill(.red)
                        .scaleEffect(isRecording ? 0.6 : 1.0)
                }
            }
            .buttonStyle(NoFadeButtonStyle())
        }
    }

    struct NoFadeButtonStyle: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
        }
    }
}
```

### Step
In the `CaptureButton` view, add `@State var isRecording = false` below `camera`, and put a `switch` on `camera.captureMode` in `captureButton`. Then replace the preview with one preview for each mode.

The `.photo` case keeps the `PhotoCaptureButton` call. The `.video` case is `MovieCaptureButton(isRecording: $isRecording) { _ in ... }` with a `Task` that calls `await camera.toggleRecording()`. The action ignores its parameter. The model then asks the capture service if a recording is in progress. The `isRecording` state of the view only controls the shape of the button. The two previews are `#Preview("Photo")` and `#Preview("Video")`, each with a `PreviewBackground` and a `PreviewCameraModel(captureMode:)` with `.photo` or `.video`. Delete the old preview and paste the two new ones in one go: the highlighted lines contain the first two lines of the old preview again.

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift remove
        PhotoCaptureButton(readiness: camera.captureReadiness) {
            Task {
                await camera.capturePhoto()
            }
        }
```

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift remove
#Preview("Photo") {
    PreviewBackground {
        CaptureButton(camera: PreviewCameraModel())
    }
}
```

```swift file=AVCam/Views/Toolbars/MainToolbar/CaptureButton.swift highlight=6,18-31,35-39,41-45
/// A view that displays an appropriate capture button for the selected mode.
@MainActor
struct CaptureButton<CameraModel: Camera>: View {

    @State var camera: CameraModel
    @State var isRecording = false

    private let mainButtonDimension: CGFloat = 68

    var body: some View {
        captureButton
            .aspectRatio(1.0, contentMode: .fit)
            .frame(width: mainButtonDimension)
    }

    @ViewBuilder
    var captureButton: some View {
        switch camera.captureMode {
        case .photo:
            PhotoCaptureButton(readiness: camera.captureReadiness) {
                Task {
                    await camera.capturePhoto()
                }
            }
        case .video:
            MovieCaptureButton(isRecording: $isRecording) { _ in
                Task {
                    await camera.toggleRecording()
                }
            }
        }
    }
}

#Preview("Photo") {
    PreviewBackground {
        CaptureButton(camera: PreviewCameraModel(captureMode: .photo))
    }
}

#Preview("Video") {
    PreviewBackground {
        CaptureButton(camera: PreviewCameraModel(captureMode: .video))
    }
}
```

### Step
Build and run the app. Select the video mode, tap the red button, wait some seconds, and tap the button again.

The first tap starts a recording, and the red circle changes to a rounded square. The second tap stops the recording, and the app saves the movie. Open the Photos app in the Simulator to see the movie. You cannot see the recording time yet.

```settings title="Checkpoint" result="../images/ch10-s9-4.jpg|The video mode: the capture button is red. The picture is from the end of the chapter. At this step, your screen still shows the two photo controls at the top, no time view, and the 3:4 preview. Sections 10 and 11 change this."
Action: Product > Run (Command-R), select the video mode, then tap the capture button two times
Result: The button is red in video mode and changes its shape during the recording. A new movie is in the Photos library.
```

## Show the recording time

During a recording, the person wants to see that the camera records and for how long. In this section, you add a view for the recording time and show it at the top of the screen in video mode. You also hide the photo controls in video mode.

### Step
Create a new Swift file with the name `RecordingTimeView.swift` in the `Overlays` group, and replace its contents.

In Try first mode, the code of this step stays visible. Copy it as it is. The view is `struct RecordingTimeView: PlatformView` with the two size class properties and the constant `time: TimeInterval`. The body is `Text(time.formatted)` with these modifiers, in this order: `.padding([.leading, .trailing], 12)`, `.padding([.top, .bottom], isRegularSize ? 8 : 0)`, `.background(Color(white: 0.0, opacity: 0.5))`, `.foregroundColor(.white)`, `.font(.title2.weight(.semibold))`, and `.clipShape(.capsule)`. Thus the view shows the time in a dark capsule. The extension of `TimeInterval` adds the computed property `formatted: String`. It changes a number of seconds into a text with hours, minutes, and seconds, with the format `"%0.2d:%0.2d:%0.2d"`. The conversion to `Int` removes the fraction, so the text changes one time each second, although a new value arrives four times each second.

The preview names an image, `video_mode`. The asset catalog of the Apple sample does not contain an image with this name, and your asset catalog does not contain one. This has no effect on the app.

```swift file=AVCam/Views/Overlays/RecordingTimeView.swift new copy result="../images/ch10-s10-1.jpg|The recording time view in the Xcode preview canvas, with 500 seconds as 00:08:20."
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that displays the current recording time.
*/

import SwiftUI

/// A view that displays the current recording time.
struct RecordingTimeView: PlatformView {

    @Environment(\.verticalSizeClass) var verticalSizeClass
    @Environment(\.horizontalSizeClass) var horizontalSizeClass

    let time: TimeInterval

    var body: some View {
        Text(time.formatted)
            .padding([.leading, .trailing], 12)
            .padding([.top, .bottom], isRegularSize ? 8 : 0)
            .background(Color(white: 0.0, opacity: 0.5))
            .foregroundColor(.white)
            .font(.title2.weight(.semibold))
            .clipShape(.capsule)
    }
}

extension TimeInterval {
    var formatted: String {
        let time = Int(self)
        let seconds = time % 60
        let minutes = (time / 60) % 60
        let hours = (time / 3600)
        let formatString = "%0.2d:%0.2d:%0.2d"
        return String(format: formatString, hours, minutes, seconds)
    }
}

#Preview {
    RecordingTimeView(time: TimeInterval(floatLiteral: 500))
        .background(Image("video_mode"))
}
```

### Step
In `CameraUI.swift`, change the top overlay: show the Live Photo badge in photo mode and the recording time in video mode.

Replace the two lines of the badge with a `switch` on `camera.captureMode`. The `.photo` case keeps the badge and its `opacity` modifier. The `.video` case shows `RecordingTimeView(time: camera.captureActivity.currentTime)` with `.offset(y: isRegularSize ? 20 : 0)`. `currentTime` is zero when no recording is in progress, so the view shows `00:00:00` in video mode before the first recording.

```swift file=AVCam/Views/CameraUI.swift remove
            LiveBadge()
                .opacity(camera.captureActivity.isLivePhoto ? 1.0 : 0.0)
```

```swift file=AVCam/Views/CameraUI.swift highlight=2-9
        .overlay(alignment: .top) {
            switch camera.captureMode {
            case .photo:
                LiveBadge()
                    .opacity(camera.captureActivity.isLivePhoto ? 1.0 : 0.0)
            case .video:
                RecordingTimeView(time: camera.captureActivity.currentTime)
                    .offset(y: isRegularSize ? 20 : 0)
            }
        }
        .overlay {
            StatusOverlayView(status: camera.status)
        }
    }
```

### Step
In `FeatureToolbar.swift`, show the Live Photo button, the quality picker, and the RAW menu only in photo mode.

Replace the three lines with a `switch` on `camera.captureMode`. The `.photo` case keeps the three controls. The three controls have no function for a movie. The `.video` case has `EmptyView()`, a placeholder. In chapter 11, you replace it with a button for HDR video.

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift remove
            livePhotoButton
            prioritizePicker
            rawMenu
```

```swift file=AVCam/Views/Toolbars/FeatureToolbar/FeatureToolbar.swift highlight=4-11
    var body: some View {
        HStack(spacing: 30) {
            Spacer()
            switch camera.captureMode {
            case .photo:
                livePhotoButton
                prioritizePicker
                rawMenu
            case .video:
                EmptyView()
            }
        }
        .buttonStyle(DefaultButtonStyle(size: isRegularSize ? .large : .small))
        .padding([.leading, .trailing])
    }
```

### Step
Build and run the app. Select the video mode, and record a movie of some seconds.

In video mode, the photo controls at the top go away, and the time view shows `00:00:00`. During the recording, the time view counts the seconds. After the second tap, it goes back to `00:00:00`.

```settings title="Checkpoint" result="../images/ch10-s10-4.jpg|During a recording: the time at the top, the red button as a square. The dim camera switch button in the picture comes in section 12."
Action: Product > Run (Command-R), select the video mode, then record a movie
Result: The time view at the top counts during the recording.
```

## Adapt the preview to the mode

In chapter 5, you gave the preview the shape of a photo, 3:4, and moved it up a small distance. A movie from the `.high` preset has a different shape. In this section, the preview container follows the mode, and it hides the mode change behind a blur.

### Step
In `PreviewContainer.swift`, make the offset and the aspect ratio depend on the capture mode.

Write `camera.captureMode == .photo ? photoModeOffset : 0` for the offset, and `camera.captureMode == .photo ? photoAspectRatio : movieAspectRatio` for the aspect ratio. `movieAspectRatio` is 9:16. You defined it in chapter 5 for the calculation of the toolbar position. In video mode, the preview has this ratio and no offset, so it fills more of the screen.

```swift file=AVCam/Views/PreviewContainer.swift remove
            .offset(y: photoModeOffset)
```

```swift file=AVCam/Views/PreviewContainer.swift remove
        photoAspectRatio
```

```swift file=AVCam/Views/PreviewContainer.swift highlight=11,32
    var body: some View {
        // On compact devices, show a view finder rectangle around the video preview bounds.
        if horizontalSizeClass == .compact {
            ZStack {
                previewView
            }
            .clipped()
            // Apply an appropriate aspect ratio based on the selected capture mode.
            .aspectRatio(aspectRatio, contentMode: .fit)
            // In photo mode, adjust the vertical offset of the preview area to better fit the UI.
            .offset(y: camera.captureMode == .photo ? photoModeOffset : 0)
        } else {
            // On regular-sized UIs, show the content in full screen.
            previewView
        }
    }

    /// Attach animations to the camera preview.
    var previewView: some View {
        content
            .blur(radius: blurRadius, opaque: true)
            .onChange(of: camera.isSwitchingVideoDevices, updateBlurRadius(_:_:))
    }

    func updateBlurRadius(_: Bool, _ isSwitching: Bool) {
        withAnimation {
            blurRadius = isSwitching ? 30 : 0
        }
    }

    var aspectRatio: AspectRatio {
        camera.captureMode == .photo ? photoAspectRatio : movieAspectRatio
    }
}
```

### Step
In `previewView`, add `.onChange(of: camera.isSwitchingModes, updateBlurRadius(_:_:))` above the existing `onChange` modifier.

A change of the preset and of the outputs makes the session build its pipeline again, and the preview can stop for a moment. The blur hides this. The modifier uses the `updateBlurRadius(_:_:)` method that you wrote for the camera switch.

```swift file=AVCam/Views/PreviewContainer.swift highlight=5
    /// Attach animations to the camera preview.
    var previewView: some View {
        content
            .blur(radius: blurRadius, opaque: true)
            .onChange(of: camera.isSwitchingModes, updateBlurRadius(_:_:))
            .onChange(of: camera.isSwitchingVideoDevices, updateBlurRadius(_:_:))
    }
```

### Step
Build and run the app, and change between the photo mode and the video mode.

The preview is blurred for a moment during each change. In video mode, the preview is taller and narrower than in photo mode.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then change the mode two times
Result: The preview has the 9:16 shape in video mode and the 3:4 shape in photo mode, with a blur during the change.
```

## Lock the controls during a recording

A change of the camera replaces the video input of the session. That ends a recording. In this last section, you disable the controls that must not be used while the app records.

The mode picker already has this modifier. You wrote it in `CaptureModeView`.

### Step
In `SwitchCameraButton.swift`, add `.disabled(camera.captureActivity.isRecording)` between `frame` and `allowsHitTesting`.

`isRecording` comes from the capture activity, which the capture service publishes. Thus the button follows the real state of the service, not the state of a different view.

```swift file=AVCam/Views/Toolbars/MainToolbar/SwitchCameraButton.swift highlight=11
    var body: some View {
        Button {
            Task {
                await camera.switchVideoDevices()
            }
        } label: {
            Image(systemName: "arrow.triangle.2.circlepath")
        }
        .buttonStyle(DefaultButtonStyle(size: .large))
        .frame(width: largeButtonSize.width, height: largeButtonSize.height)
        .disabled(camera.captureActivity.isRecording)
        .allowsHitTesting(!camera.isSwitchingVideoDevices)
    }
```

### Step
In `ThumbnailButton.swift`, add the same `disabled` modifier below `cornerRadius`.

The thumbnail button opens the photo picker, which covers the camera interface. With this modifier, the picker cannot open on top of a recording that is in progress.

```swift file=AVCam/Views/Toolbars/MainToolbar/ThumbnailButton.swift highlight=7
    var body: some View {
        PhotosPicker( selection: $selectedItems, matching: .images, photoLibrary: .shared()) {
            thumbnail
        }
		.frame(width: 64.0, height: 64.0)
		.cornerRadius(8)
        .disabled(camera.captureActivity.isRecording)
    }
```

### Step
Build and run the app. Select the video mode, start a recording, and look at the controls. Then stop the recording.

During the recording, the mode picker and the camera switch button are dim. These two controls and the thumbnail button do not react to a tap. After the recording, they are active again. In the Simulator with SimCam, a recording of some seconds gives a `.MOV` file of approximately 1 MB in the Photos library.

```settings title="Checkpoint" result="../images/ch10-s10-4.jpg|During a recording: the mode picker and the switch button are dimmed and do not react."
Action: Product > Run (Command-R), select the video mode, then record a movie
Result: The mode picker and the camera switch button are dim during the recording. The time view counts. After the second tap, the movie is in the Photos library.
```

### Experiment
In `MovieCapture.swift`, change `refreshInterval` from `0.25` to `2.0`. Run the app, record a movie, and look at the time view. Then set the value back to `0.25`, so that your code stays equal to the branch `chapter-10`.

### Text
The app now records movies with the preset that the session selects. You have no control of the format, the frame rate, or the dynamic range. In the next chapter, you select a camera format yourself and record HDR video.

## Check your understanding

### Why does `setCaptureMode(_:)` remove the movie output from the session in photo mode?

- [ ] The `.photo` preset does not accept a movie file output, and the session raises an exception.
  > The session accepts the output with this preset. The movie then has only the resolution of the preview, but that is not the reason for the removal.
- [x] The photo output cannot capture Live Photos while a movie file output is in the session.
  > Correct. The two features do not work together. AVCam prefers Live Photo capture in photo mode and pays for it with a session change at each mode change.
- [ ] An output that is not in use records to the temporary directory and fills the disk.
  > A movie output writes a file only between a start request and the end of the recording.

### Why does `MovieCapture` ask for stabilization in `updateConfiguration(for:)`, and not in `startRecording()`?

- [ ] You can set the stabilization mode only while the session does not run.
  > You can set the mode on a connection of a session that runs. The capture service calls `updateConfiguration(for:)` while the session runs.
- [ ] The video connection does not exist during a recording.
  > The connection exists as long as the output is in the session. A recording needs it.
- [x] The connection is new each time the session gets the output, and stabilization crops the picture, so a change at the start of a recording changes the framing.
  > Correct. The service configures each new connection immediately. The person then sees the stabilized framing before the recording starts.

### `toggleRecording()` calls `mediaLibrary.save(movie:)` immediately after `try await captureService.stopRecording()`. Why is the movie file complete at that time?

- [ ] The `stopRecording()` method of the movie output writes the rest of the file before it returns.
  > The method of the output returns immediately. The output completes the file later.
- [x] The `stopRecording()` method of the service returns only when the delegate resumes the continuation in the callback that reports the end of the recording.
  > Correct. The continuation changes the delegate callback into the return of an `async` method. The save cannot start before the callback.
- [ ] The Photos library waits until the file is closed before it moves the file.
  > The library does not wait. A move of a file that is open fails.
