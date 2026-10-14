---
kind: tutorial
chapter: 2
title: Build: cameras
abstract: Find the cameras of the device, add a button that changes between them, follow the system-preferred camera, and keep the preview level.
estimatedMinutes: 45
startBranch: chapter-01
branch: chapter-02
---

At the end of chapter 1, the app shows the preview of one fixed camera. In this chapter, you let the system and the person select the camera.

You write a class that finds the cameras. You teach the capture service to change the camera of a running session. You add a switch button with a blur effect. Then you make the app follow the system-preferred camera, and you keep the preview level with a rotation coordinator.

Read [Concepts: cameras](ch02-concepts.md) first. It explains the ideas behind this code.

## Find the cameras

In chapter 1, `setUpSession()` asks for the wide camera on the back. Now you write `DeviceLookup`, a class that finds the best back camera, the best front camera, and an external camera. It also tells the capture service which camera to use at the start.

The class uses [`AVCaptureDevice.DiscoverySession`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession) objects. A discovery session returns the cameras that match a list of device types and a position.

![Three physical back cameras and the three virtual devices that group them](../images/ch02-virtual-devices.svg)

### Step
In the `AVCam` folder, create a folder with the name `Capture`. In it, create `DeviceLookup.swift`, and replace its contents with a `final class DeviceLookup` that has three private discovery session properties.

The three properties are `frontCameraDiscoverySession`, `backCameraDiscoverySession`, and `externalCameraDiscoverSession`, all of type `AVCaptureDevice.DiscoverySession`. The file imports `Combine` as in Apple's sample; nothing in this chapter uses it. A discovery session filters by one position. So the class keeps one session for the back, one for the front, and one for external cameras, which have no position. The header comment also names microphones. You add the microphone lookup in chapter 8.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=1-18
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
An object that retrieves camera and microphone devices.
*/

import AVFoundation
import Combine

/// An object that retrieves camera and microphone devices.
final class DeviceLookup {

    // Discovery sessions to find the front and back cameras, and external cameras in iPadOS.
    private let frontCameraDiscoverySession: AVCaptureDevice.DiscoverySession
    private let backCameraDiscoverySession: AVCaptureDevice.DiscoverySession
    private let externalCameraDiscoverSession: AVCaptureDevice.DiscoverySession
}
```

### Step
Add an initializer that creates the three discovery sessions.

The back session asks for `[.builtInDualCamera, .builtInWideAngleCamera]` with the position `.back`. The front session asks for `[.builtInTrueDepthCamera, .builtInWideAngleCamera]` with `.front`. The external session asks for `[.external]` with `.unspecified`. The media type is `.video` for all three. The order of the device types is a priority list, and the result has the same order. The back session returns the dual camera first if the device has one, and the wide camera if not. An external camera has the position `.unspecified`.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=8-18
final class DeviceLookup {

    // Discovery sessions to find the front and back cameras, and external cameras in iPadOS.
    private let frontCameraDiscoverySession: AVCaptureDevice.DiscoverySession
    private let backCameraDiscoverySession: AVCaptureDevice.DiscoverySession
    private let externalCameraDiscoverSession: AVCaptureDevice.DiscoverySession

    init() {
        backCameraDiscoverySession = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInDualCamera, .builtInWideAngleCamera],
                                                                      mediaType: .video,
                                                                      position: .back)
        frontCameraDiscoverySession = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInTrueDepthCamera, .builtInWideAngleCamera],
                                                                       mediaType: .video,
                                                                       position: .front)
        externalCameraDiscoverSession = AVCaptureDevice.DiscoverySession(deviceTypes: [.external],
                                                                         mediaType: .video,
                                                                         position: .unspecified)
    }
```

### Step
At the end of the initializer, set the user-preferred camera to the back camera if the system has no preferred camera.

[`userPreferredCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/userpreferredcamera) holds the camera that the person selected. This is the only place where the app writes it without a tap. It gives the system a start value: a camera app usually starts with the back camera.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=5-9
    init() {
        externalCameraDiscoverSession = AVCaptureDevice.DiscoverySession(deviceTypes: [.external],
                                                                         mediaType: .video,
                                                                         position: .unspecified)

        // If the host doesn't currently define a system-preferred camera device, set the user's preferred selection to the back camera.
        if AVCaptureDevice.systemPreferredCamera == nil {
            AVCaptureDevice.userPreferredCamera = backCameraDiscoverySession.devices.first
        }
    }
```

### Note
The documentation says that `systemPreferredCamera` is `nil` only when no camera is available. The sample tests for `nil` here all the same. This tutorial did not verify on a real device when the test is true.

### Step
Below the initializer, add the `defaultCamera` property of type `AVCaptureDevice`, which returns the system-preferred camera or throws `CameraError.videoDeviceUnavailable`.

[`systemPreferredCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempreferredcamera) is the camera that the system recommends at this time. The system calculates it from the user's selections and from events such as the connection of an external camera. A computed property can throw an error when its getter has the `throws` keyword.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=2-11
    }

    /// Returns the system-preferred camera for the host system.
    var defaultCamera: AVCaptureDevice {
        get throws {
            guard let videoDevice = AVCaptureDevice.systemPreferredCamera else {
                throw CameraError.videoDeviceUnavailable
            }
            return videoDevice
        }
    }
```

### Step
Add the `cameras` property, which collects the first camera of each discovery session.

The result has a maximum of three cameras: back, front, and external. The switch button goes through the list in this order. The [`devices`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/discoverysession/devices) array is always up to date, so the property finds an external camera that connected after the app started.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=3-18
        }
    }

    var cameras: [AVCaptureDevice] {
        // Populate the cameras array with the available cameras.
        var cameras: [AVCaptureDevice] = []
        if let backCamera = backCameraDiscoverySession.devices.first {
            cameras.append(backCamera)
        }
        if let frontCamera = frontCameraDiscoverySession.devices.first {
            cameras.append(frontCamera)
        }
        // iPadOS supports connecting external cameras.
        if let externalCamera = externalCameraDiscoverSession.devices.first {
            cameras.append(externalCamera)
        }
        return cameras
    }
}
```

### Step
Before the `return` statement, stop the app if the list is empty. Use a compiler condition to keep this check out of Simulator builds.

A camera app cannot do its work without a camera, so the sample stops with a clear message. A Simulator can be without a camera, and the app must not stop there.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=5-10
        // iPadOS supports connecting external cameras.
        if let externalCamera = externalCameraDiscoverSession.devices.first {
            cameras.append(externalCamera)
        }

#if !targetEnvironment(simulator)
        if cameras.isEmpty {
            fatalError("No camera devices are found on this system.")
        }
#endif
        return cameras
    }
}
```

### Step
In `CaptureService.swift`, add the property `activeVideoInput` of type `AVCaptureDeviceInput?` and the constant `deviceLookup` with a new `DeviceLookup`, both private.

An [`AVCaptureDeviceInput`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput) connects one camera to the session. The service keeps the input of the camera in use, because it must remove this object from the session when the camera changes.

```swift file=AVCam/CaptureService.swift highlight=9-13
actor CaptureService {

    /// A type that connects a preview destination with the capture session.
    nonisolated let previewSource: PreviewSource

    // The app's capture session.
    private let captureSession = AVCaptureSession()

    // The video input for the currently selected device camera.
    private var activeVideoInput: AVCaptureDeviceInput?

    // An object the service uses to retrieve capture devices.
    private let deviceLookup = DeviceLookup()
```

### Step
In `setUpSession()`, get the camera from `deviceLookup.defaultCamera`, and keep the input that `addInput(for:)` returns.

The session now starts with the camera that the system prefers. If the property throws an error, the `catch` block changes it to `setupFailed`, as before.

```swift file=AVCam/CaptureService.swift remove
            guard let defaultCamera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
                throw CameraError.videoDeviceUnavailable
            }
```

```swift file=AVCam/CaptureService.swift remove
            try addInput(for: defaultCamera)
```

```swift file=AVCam/CaptureService.swift highlight=6,9
    // MARK: - Capture setup
    // Performs the initial capture session configuration.
    private func setUpSession() throws {
        do {
            // Retrieve the default camera.
            let defaultCamera = try deviceLookup.defaultCamera

            // Add an input for the default camera device.
            activeVideoInput = try addInput(for: defaultCamera)
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
Build and run the app in the Simulator. Make sure that the preview looks the same as at the end of chapter 1.

With SimCam, the Simulator has one back camera and one front camera. The app shows the back camera, but the camera now comes from the device lookup.

```settings title="Checkpoint"
Destination: an iPhone simulator, with SimCam in operation
Action: Product > Run (Command-R)
Result: the live preview of the back camera, as in chapter 1
```

## Change the camera in the capture service

A normal capture session accepts one camera input at a time. To change the camera, the service removes the old input and adds a new one. It does the two operations in one configuration group, so that the session applies them together.

In this section, you write the method that changes the input, and the method that selects the next camera for the switch button.

![The four operations of a camera switch, and the fallback when the new input fails](../images/ch02-switch-input.svg)

### Step
In `CaptureService.swift`, below the `addInput(for:)` method, add the `currentDevice` property for the camera in use.

The service uses this property to compare the camera in use with other cameras. The `fatalError` call documents a rule: after the setup, the service always has a video input.

```swift file=AVCam/CaptureService.swift highlight=3-10
        return input
    }

    // The device for the active video input.
    private var currentDevice: AVCaptureDevice {
        guard let device = activeVideoInput?.device else {
            fatalError("No device found for current video input.")
        }
        return device
    }
```

### Step
Below `currentDevice`, add the `changeCaptureDevice(to:)` method. Get the current input, and start a configuration group.

All changes between [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()) are applied together when the commit runs. The `defer` statement makes sure that the commit runs on each path out of the method.

```swift file=AVCam/CaptureService.swift highlight=3-12
        return device
    }

    // Changes the device the service uses for video capture.
    private func changeCaptureDevice(to device: AVCaptureDevice) {
        // The service must have a valid video input prior to calling this method.
        guard let currentInput = activeVideoInput else { fatalError() }

        // Bracket the following configuration in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
    }
```

### Step
Remove the current input with `removeInput(_:)`. Then try to add an input for the new device with the `addInput(for:)` helper from chapter 1, and add the old input again with `addInput(_:)` of the session after a failure.

- The removal comes first, because the session does not accept a second camera input: [`canAddInput(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/canaddinput(_:)) returns `false`, and `addInput(for:)` throws an error.
- The `catch` block is the fallback. It connects the old camera again, so that the session is not without a camera when the commit runs.
- `activeVideoInput` changes only when the new input is in the session. After a failure, it still holds the old input.

```swift file=AVCam/CaptureService.swift highlight=8-17
    private func changeCaptureDevice(to device: AVCaptureDevice) {
        // The service must have a valid video input prior to calling this method.
        guard let currentInput = activeVideoInput else { fatalError() }

        // Bracket the following configuration in a begin/commit configuration pair.
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

        // Remove the existing video input before attempting to connect a new one.
        captureSession.removeInput(currentInput)
        do {
            // Attempt to connect a new input and device to the capture session.
            activeVideoInput = try addInput(for: device)
        } catch {
            // Reconnect the existing camera on failure.
            captureSession.addInput(currentInput)
        }
    }
```

### Step
Above `changeCaptureDevice(to:)`, add the `selectNextVideoDevice()` method. Get the list of cameras, and find the index of the current camera.

This method is not `private`, because the camera model calls it. If the current camera is not in the list, the code uses index 0 as the index of the current camera.

```swift file=AVCam/CaptureService.swift highlight=3-17
        return device
    }

    // MARK: - Device selection

    /// Changes the capture device that provides video input.
    ///
    /// The app calls this method in response to the user tapping the button in the UI to change cameras.
    /// The implementation switches between the front and back cameras and, in iPadOS,
    /// connected external cameras.
    func selectNextVideoDevice() {
        // The array of available video capture devices.
        let videoDevices = deviceLookup.cameras

        // Find the index of the currently selected video device.
        let selectedIndex = videoDevices.firstIndex(of: currentDevice) ?? 0
    }

    // Changes the device the service uses for video capture.
    private func changeCaptureDevice(to device: AVCaptureDevice) {
```

### Step
Calculate the index of the next camera. Go back to index 0 after the last camera in the list.

With two cameras, the button changes between the back and the front. With an external camera on an iPad, the order is back, front, external, and then back again.

```swift file=AVCam/CaptureService.swift highlight=7-14
    func selectNextVideoDevice() {
        // The array of available video capture devices.
        let videoDevices = deviceLookup.cameras

        // Find the index of the currently selected video device.
        let selectedIndex = videoDevices.firstIndex(of: currentDevice) ?? 0
        // Get the next index.
        var nextIndex = selectedIndex + 1
        // Wrap around if the next index is invalid.
        if nextIndex == videoDevices.endIndex {
            nextIndex = 0
        }

        let nextDevice = videoDevices[nextIndex]
    }
```

### Step
Change the session to the next camera, and store this camera as the user's preferred camera.

You write `userPreferredCamera` here, and not in `changeCaptureDevice(to:)`, for a reason. This method runs only after a tap on the switch button, so the camera is a selection of the person. The other method also runs when the system changes the camera, as you see later. A change by the system must not go into the history of the user's selections.

```swift file=AVCam/CaptureService.swift highlight=2-7
        let nextDevice = videoDevices[nextIndex]
        // Change the session's active capture device.
        changeCaptureDevice(to: nextDevice)

        // The app only calls this method in response to the user requesting to switch cameras.
        // Set the new selection as the user's preferred camera.
        AVCaptureDevice.userPreferredCamera = nextDevice
    }
```

### Note
The project compiles again at this point. Nothing calls `selectNextVideoDevice()` yet, so the app does not look different. You add the button in the next section.

## Add the switch button

The views of the app do not use the capture service directly. They use the `Camera` protocol, and `CameraModel` sends their requests to the service.

In this section, you add a method and a state property to the protocol and to its two model classes. Then you build the views: a button style, the switch button, a toolbar, and a view for the full camera interface.

### Step
In `Camera.swift`, add the `async` method `switchVideoDevices()` and the read-only `Bool` property `isSwitchingVideoDevices` to the protocol.

`CameraModel` and `PreviewCameraModel` conform to this protocol. The project does not compile until you add the two members to the two classes.

```swift file=AVCam/Model/Camera.swift highlight=12-17
@MainActor
protocol Camera: AnyObject, SendableMetatype {

    /// Provides the current status of the camera.
    var status: CameraStatus { get }

    /// The source of video content for a camera preview.
    var previewSource: PreviewSource { get }

    /// Starts the camera capture pipeline.
    func start() async

    /// Switches between video devices available on the host system.
    func switchVideoDevices() async

    /// A Boolean value that indicates whether the camera is currently switching video devices.
    var isSwitchingVideoDevices: Bool { get }
}
```

### Step
In `CameraModel.swift`, add the `isSwitchingVideoDevices` property below the `status` property.

Views can read the property, but only the model can change it. The class is `@Observable`, so a view that reads the property updates when the value changes.

```swift file=AVCam/CameraModel.swift highlight=6-8
final class CameraModel: Camera {

    /// The current status of the camera, such as unauthorized, running, or failed.
    private(set) var status = CameraStatus.unknown

    /// A Boolean value that indicates whether the app is currently switching video devices.
    private(set) var isSwitchingVideoDevices = false

    /// An object that provides the connection between the capture session and the video preview layer.
```

### Step
At the end of `CameraModel`, add the `switchVideoDevices()` method.

The property is `true` while the method waits for the capture service. The `defer` statement sets it back to `false` when the method ends. The work runs on the queue of the service, so the main thread stays free for the interface.

```swift file=AVCam/CameraModel.swift highlight=3-11
        }
    }

    // MARK: - Changing devices

    /// Selects the next available video device for capture.
    func switchVideoDevices() async {
        isSwitchingVideoDevices = true
        defer { isSwitchingVideoDevices = false }
        await captureService.selectNextVideoDevice()
    }
}
```

### Step
In `PreviewCameraModel.swift`, add the same property, and a `switchVideoDevices()` method that only writes a log message.

SwiftUI previews use this model, and it has no camera. The method is not `async` here: Swift accepts a synchronous method for an `async` requirement of a protocol.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=3-4,14-17
    private(set) var status = CameraStatus.unknown

    private(set) var isSwitchingVideoDevices = false

    init(status: CameraStatus = .unknown) {
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
}
```

### Step
In the `AVCam` folder, create a folder with the name `Support`. In it, create `ViewExtensions.swift`, and replace its contents.

This file holds small view helpers that all controls of the app share:

- `largeButtonSize` is a global `CGSize` constant of 64 by 64 points, the size of the large buttons in the toolbar.
- `DefaultButtonStyle` is a `ButtonStyle`. Its nested enumeration `Size` has the cases `small` (raw value 22) and `large` (24), the font size of the label. The initializer takes `size:`.
- `makeBody(configuration:)` draws the label with the font size, in `.primary` when the button is enabled and in `Color(white: 0.4)` when it is not. The background is `.black.opacity(0.4)`, which lets the preview show through. A large button is clipped to a `Circle`, a small one to a `Rectangle`; `AnyShape` makes the two cases one type.
- The style reads `isEnabled`, `verticalSizeClass`, and `horizontalSizeClass` from the environment. It adds a padding of 10 points for a large button, and also for a small one in a regular size class, where there is more space, for example on iPad.

This file is boilerplate. If you work in "Try first" mode, it is fine to copy it.

SwiftUI has a type with the same name. In your app, the name refers to your type, because a type of your module has priority over a type of an imported module.

```swift file=AVCam/Support/ViewExtensions.swift new
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
Extensions and supporting SwiftUI types.
*/

import SwiftUI
import UIKit

let largeButtonSize = CGSize(width: 64, height: 64)

struct DefaultButtonStyle: ButtonStyle {

    @Environment(\.isEnabled) private var isEnabled: Bool
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    enum Size: CGFloat {
        case small = 22
        case large = 24
    }

    private let size: Size

    init(size: Size) {
        self.size = size
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(isEnabled ? .primary : Color(white: 0.4))
            .font(.system(size: size.rawValue))
            // Pad buttons on devices that use the `regular` size class,
            // and also when explicitly requesting large buttons.
            .padding(isRegularSize || size == .large ? 10.0 : 0)
            .background(.black.opacity(0.4))
            .clipShape(size == .small ? AnyShape(Rectangle()) : AnyShape(Circle()))
    }

    var isRegularSize: Bool {
        horizontalSizeClass == .regular && verticalSizeClass == .regular
    }
}
```

### Step
In the `Views` folder, create the folders `Toolbars/MainToolbar`. In `MainToolbar`, create `SwitchCameraButton.swift`, and replace its contents.

The button shows the symbol `arrow.triangle.2.circlepath` with your `DefaultButtonStyle` in the large size, in a frame of `largeButtonSize`. A button action is synchronous, and the model method is `async`, so the action starts a `Task`. The `allowsHitTesting(_:)` modifier makes the button ignore taps while a switch is in progress. Thus the person cannot start a second switch before the first one ends.

The app does not show the button yet: the interface is connected in the next section. The preview block at the end of the file shows the button in the Xcode canvas now. Open the canvas with Option-Command-Return. `PreviewBackground` is the gray stand-in for the camera picture from chapter 1.

```swift file=AVCam/Views/Toolbars/MainToolbar/SwitchCameraButton.swift new result="../images/ch02-s3-6.jpg|The switch button in the Xcode preview canvas, on the preview background. The app does not show it yet."
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that displays a button to switch between available cameras.
*/

import SwiftUI

/// A view that displays a button to switch between available cameras.
struct SwitchCameraButton<CameraModel: Camera>: View {
    
    @State var camera: CameraModel
    
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
        .allowsHitTesting(!camera.isSwitchingVideoDevices)
    }
}

#Preview {
    PreviewBackground {
        SwitchCameraButton(camera: PreviewCameraModel())
    }
}
```


### Step
In the same folder, create `MainToolbar.swift`, and replace its contents.

The `Spacer` moves the switch button to the trailing edge. In later chapters, you add the capture button and the thumbnail button to this `HStack`.

```swift file=AVCam/Views/Toolbars/MainToolbar/MainToolbar.swift new result="../images/ch02-s3-7.jpg|The main toolbar in the Xcode preview canvas: the switch button at the trailing side. The toolbar alone sits in the middle. CameraUI moves it to the bottom in the next step."
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that displays controls to capture, switch cameras, and view the last captured media item.
*/

import SwiftUI

/// A view that displays controls to capture, switch cameras, and view the last captured media item.
struct MainToolbar<CameraModel: Camera>: View {

    @State var camera: CameraModel
    
    var body: some View {
        HStack {
            Spacer()
            SwitchCameraButton(camera: camera)
        }
        .foregroundColor(.white)
        .font(.system(size: 24))
        .frame(height: height)
        .padding([.leading, .trailing])
    }
    
    var height: CGFloat? { 80 }
}

#Preview {
    PreviewBackground {
        Group {
            MainToolbar(camera: PreviewCameraModel())
        }
    }
}
```

### Step
In the `Views` folder, create `CameraUI.swift`, and replace its contents.

This view holds all controls that lie on top of the preview. The toolbar is at the bottom. The status overlay from chapter 1 is an overlay of this view now.

```swift file=AVCam/Views/CameraUI.swift new result="../images/ch02-s3-8.jpg|CameraUI in the Xcode preview canvas: the toolbar over the full screen. The status overlay shows nothing, because the status is not failed."
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that presents the main camera user interface.
*/

import SwiftUI

/// A view that presents the main camera user interface.
struct CameraUI<CameraModel: Camera>: View {

    @State var camera: CameraModel
    
    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            MainToolbar(camera: camera)
        }
        .overlay {
            StatusOverlayView(status: camera.status)
        }
    }
}

#Preview {
    PreviewBackground {
        CameraUI(camera: PreviewCameraModel())
    }
}
```

### Step
Build the project to make sure that the model and the new views compile.

No view shows `CameraUI` yet, so do not run the app now. You connect the interface in the next section.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: Build Succeeded, with no errors
```

## Blur the preview during the switch

When the camera changes, there is a short gap in the frames of the preview. Then the other camera appears, with a different field of view. A blur effect hides this change.

In this section, you write `PreviewContainer`, a view that holds the preview and applies the effect. Then you put the container and the camera interface into `CameraView`.

### Step
In the `Views` folder, create `PreviewContainer.swift` with a generic container view that keeps its content.

The container is generic, so it can hold any view. The `@ViewBuilder` attribute lets the caller give the content as a closure of view code. The body shows a `previewView` property, which you add in the next step.

```swift file=AVCam/Views/PreviewContainer.swift highlight=1-28
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
A view that provides a container view around the camera preview.
*/

import SwiftUI

/// A view that provides a container view around the camera preview.
///
/// This view applies transition effects when changing capture modes or switching devices.
@MainActor
struct PreviewContainer<Content: View, CameraModel: Camera>: View {

    @State var camera: CameraModel

    private let content: Content

    init(camera: CameraModel, @ViewBuilder content: () -> Content) {
        self.camera = camera
        self.content = content()
    }

    var body: some View {
        previewView
    }
}
```

### Step
Add a `blurRadius` state property, and add the `previewView` property, which applies a blur with this radius to the content.

`previewView` is the place where the container attaches effects to the content. A radius of zero gives no blur. The `opaque` argument makes a blur without transparent edges, which is correct for a preview that fills its frame.

```swift file=AVCam/Views/PreviewContainer.swift highlight=5-7,18-23
struct PreviewContainer<Content: View, CameraModel: Camera>: View {

    @State var camera: CameraModel

    // State values for transition effects.
    @State private var blurRadius = CGFloat.zero

    private let content: Content

    init(camera: CameraModel, @ViewBuilder content: () -> Content) {
        self.camera = camera
        self.content = content()
    }

    var body: some View {
        previewView
    }

    /// Attach animations to the camera preview.
    var previewView: some View {
        content
            .blur(radius: blurRadius, opaque: true)
    }
```

### Step
Add the `updateBlurRadius(_:_:)` method, and call it when `isSwitchingVideoDevices` changes.

The `onChange` modifier gives the old value and the new value to the method. The method uses only the new value. `withAnimation` makes the radius change smoothly between 0 and 30, so the blur fades in when the switch starts and fades out when it ends.

```swift file=AVCam/Views/PreviewContainer.swift highlight=5,7-12
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
}
```

### Step
In `CameraView.swift`, replace the whole content of the `ZStack`: put `CameraPreview` into a `PreviewContainer`, and replace the status overlay with `CameraUI`.

The preview moves into the closure of the container, one indentation level deeper. `CameraUI` contains the status overlay, so `CameraView` does not need its own.

```swift file=AVCam/CameraView.swift remove
            // A view that provides a preview of the captured content.
            CameraPreview(source: camera.previewSource)
            // A view that presents a status message over the camera preview.
            StatusOverlayView(status: camera.status)
```

```swift file=AVCam/CameraView.swift highlight=3-9 result="../images/ch02-s4-4.jpg|CameraView in the Xcode preview canvas. The preview model has no camera, so the preview background shows through. The real camera picture comes when you run the app."
    var body: some View {
        ZStack {
            // A container view that manages the placement of the preview.
            PreviewContainer(camera: camera) {
                // A view that provides a preview of the captured content.
                CameraPreview(source: camera.previewSource)
            }
            // The main camera user interface.
            CameraUI(camera: camera)
        }
    }
```

### Step
Build and run the app. Tap the switch button at the bottom right of the screen.

The preview becomes blurred for a short time. Then it shows the front camera. A second tap brings back the back camera. With SimCam, each camera shows its own source. The blur lasts a fraction of a second, too short for a screenshot; the pictures show the states before and after it.

```settings title="Checkpoint" result="../images/ch02-s4-5-a.jpg|At the start: the back camera, with the switch button at the bottom right.; ../images/ch02-s4-5-c.jpg|After the tap: the front camera."
Action: Product > Run (Command-R), then tap the switch button
Result: a short blur, then the preview of the front camera
Second tap: a short blur, then the preview of the back camera
```

### Experiment
Change to the front camera, stop the app, and run it again. Which camera does the app show at the start? The system keeps the user-preferred camera between launches. This tutorial did not verify this behavior in the Simulator, so also try it on a real iPhone if you have one.

## Follow the system-preferred camera

The app reads `systemPreferredCamera` one time, at the start. But the value can change while the app runs. For example, a person connects a USB camera to an iPad, and the system then prefers that camera.

In this section, you write an observer that reports each change as a value of an asynchronous stream. The capture service reads the stream and changes the camera.

### Step
In the `Capture` folder, create `SPCObserver.swift`, and replace its contents with the class `SystemPreferredCameraObserver`, a subclass of `NSObject`, which observes the `systemPreferredCamera` class property with key-value observing (KVO).

`systemPreferredCamera` is a property of the `AVCaptureDevice` class, not of one device object. The Swift `observe(_:options:changeHandler:)` method with a key path cannot observe a class property. So the code uses the older form of KVO: a string for the key path, and the class object `AVCaptureDevice.self` as the object to observe. This form needs an observer that inherits from `NSObject`.

```swift file=AVCam/Capture/SPCObserver.swift highlight=1-20
/*
See the LICENSE.txt file for this sample's licensing information.

Abstract:
An object that provides an asynchronous stream capture devices that represent the system-preferred camera.
*/
import AVFoundation

/// An object that provides an asynchronous stream capture devices that represent the system-preferred camera.
class SystemPreferredCameraObserver: NSObject {

    private let systemPreferredKeyPath = "systemPreferredCamera"

    override init() {
        super.init()

        /// Key-value observe the `systemPreferredCamera` class property on `AVCaptureDevice`.
        AVCaptureDevice.self.addObserver(self, forKeyPath: systemPreferredKeyPath, options: [.new], context: nil)
    }
}
```

### Step
Add an asynchronous stream of camera devices to the class: two properties, the code that creates the stream, and a `deinit` that ends it.

`makeStream(of:)` returns an [`AsyncStream`](https://developer.apple.com/documentation/swift/asyncstream) and its continuation. The observer sends values into the continuation, and the capture service reads them from the `changes` stream. Swift needs a value for each property before the `super.init()` call, so the new lines come first in the initializer.

```swift file=AVCam/Capture/SPCObserver.swift highlight=5-7,9-12,18-21
class SystemPreferredCameraObserver: NSObject {

    private let systemPreferredKeyPath = "systemPreferredCamera"

    let changes: AsyncStream<AVCaptureDevice?>
    private var continuation: AsyncStream<AVCaptureDevice?>.Continuation?

    override init() {
        let (changes, continuation) = AsyncStream.makeStream(of: AVCaptureDevice?.self)
        self.changes = changes
        self.continuation = continuation

        super.init()

        /// Key-value observe the `systemPreferredCamera` class property on `AVCaptureDevice`.
        AVCaptureDevice.self.addObserver(self, forKeyPath: systemPreferredKeyPath, options: [.new], context: nil)
    }

    deinit {
        continuation?.finish()
    }
```

### Step
Override `observeValue(forKeyPath:of:change:context:)`, and send each new camera to the stream.

The system calls this method each time the observed property changes. The `.new` option, which you set in the initializer, puts the new value into the `change` dictionary, and `yield(_:)` sends it to the stream. The `default` case gives all other key paths to the superclass.

```swift file=AVCam/Capture/SPCObserver.swift highlight=4-14
    deinit {
        continuation?.finish()
    }

    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey: Any]?, context: UnsafeMutableRawPointer?) {
        switch keyPath {
        case systemPreferredKeyPath:
            // Update the observer's system-preferred camera value.
            let newDevice = change?[.newKey] as? AVCaptureDevice
            continuation?.yield(newDevice)
        default:
            super.observeValue(forKeyPath: keyPath, of: object, change: change, context: context)
        }
    }
}
```

### Step
In `CaptureService.swift`, add the private constant `systemPreferredCamera` with a new `SystemPreferredCameraObserver`.

```swift file=AVCam/CaptureService.swift highlight=4-6
    // An object the service uses to retrieve capture devices.
    private let deviceLookup = DeviceLookup()

    // An object that monitors the state of the system-preferred camera.
    private let systemPreferredCamera = SystemPreferredCameraObserver()

```

### Step
Below `changeCaptureDevice(to:)`, add the `monitorSystemPreferredCamera()` method with a task that reads the stream of changes.

The task starts inside the actor, so the loop runs on the actor too. The loop waits for the next value and does not end while the observer exists.

```swift file=AVCam/CaptureService.swift highlight=3-16
        }
    }

    /// Monitors changes to the system's preferred camera selection.
    ///
    /// iPadOS supports external cameras. When someone connects an external camera to their iPad,
    /// they're signaling the intent to use the device. The system responds by updating the
    /// system-preferred camera (SPC) selection to this new device. When this occurs, if the SPC
    /// isn't the currently selected camera, switch to the new device.
    private func monitorSystemPreferredCamera() {
        Task {
            // An object monitors changes to system-preferred camera (SPC) value.
            for await camera in systemPreferredCamera.changes {
            }
        }
    }
```

### Step
In the loop, change to the new camera if it is not the camera in use.

The comparison prevents a change that is not necessary. An example: after a tap on the switch button, the system can report the camera that the session uses already. This code calls `changeCaptureDevice(to:)` and does not write `userPreferredCamera`, because the system made this selection.

```swift file=AVCam/CaptureService.swift highlight=5-9
    private func monitorSystemPreferredCamera() {
        Task {
            // An object monitors changes to system-preferred camera (SPC) value.
            for await camera in systemPreferredCamera.changes {
                // If the SPC isn't the currently selected camera, attempt to change to that device.
                if let camera, currentDevice != camera {
                    logger.debug("Switching camera selection to the system-preferred camera.")
                    changeCaptureDevice(to: camera)
                }
            }
        }
    }
```

### Step
In `setUpSession()`, start the monitor after the service adds the input for the default camera.

The order is important. The loop reads `currentDevice`, and that property stops the app if the service has no video input.

```swift file=AVCam/CaptureService.swift highlight=8-10
    private func setUpSession() throws {
        do {
            // Retrieve the default camera.
            let defaultCamera = try deviceLookup.defaultCamera

            // Add an input for the default camera device.
            activeVideoInput = try addInput(for: defaultCamera)

            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
Build and run the app. Make sure that the preview and the switch button work as before.

You see no difference in the Simulator. To see the automatic change, you need an iPad and an external USB camera. This tutorial did not verify that path on hardware.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the switch button
Result: the same behavior as at the end of the last section
Not visible in the Simulator: the change to an external camera
```

## Keep the preview level

The sensor of a camera has a fixed position in the device. When the person turns the device, the app must rotate the video. An [`AVCaptureDevice.RotationCoordinator`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator) calculates two angles. The preview angle keeps the video level on the screen. The capture angle keeps photos and movies level relative to gravity. The two angles are different when the interface does not turn with the device.

In this section, you apply the preview angle. You apply the capture angle in chapter 3, when the app has a photo output.

![A rotation coordinator gives a preview angle to the preview layer and a capture angle to the outputs](../images/ch02-rotation-angles.svg)

### Step
In `CaptureService.swift`, add the private property `rotationCoordinator` of type `AVCaptureDevice.RotationCoordinator!` and the private array `rotationObservers` of `AnyObject`.

The coordinator is an implicitly unwrapped optional, because the service can create it only when it knows the camera. The array holds the observation objects. An observation stops when its object goes away.

```swift file=AVCam/CaptureService.swift highlight=4-7
    // An object that monitors the state of the system-preferred camera.
    private let systemPreferredCamera = SystemPreferredCameraObserver()

    // An object that monitors video device rotations.
    private var rotationCoordinator: AVCaptureDevice.RotationCoordinator!
    private var rotationObservers = [AnyObject]()

```

### Step
At the end of the actor, add the `videoPreviewLayer` property, which finds the preview layer in the connections of the session.

The service has no reference to the preview view. But in chapter 1, the view gave the session to its layer, and that made a connection between the session and the layer. The service follows this connection back to the layer: it reads the `connections` array of the session and takes the first connection whose `videoPreviewLayer` is not `nil`. If there is none, the app is misconfigured, and the property stops it with `fatalError`.

```swift file=AVCam/CaptureService.swift highlight=2-9
    }

    private var videoPreviewLayer: AVCaptureVideoPreviewLayer {
        // Access the capture session's connected preview layer.
        guard let previewLayer = captureSession.connections.compactMap({ $0.videoPreviewLayer }).first else {
            fatalError("The app is misconfigured. The capture session should have a connection to a preview layer.")
        }
        return previewLayer
    }
}
```

### Important
This property stops the app if the session has no connection to a preview layer. So the preview view must exist before the session setup runs. In AVCam, the order is correct: SwiftUI builds the preview view, and the view gives the session to its layer, before `start()` gets to the session setup. Keep this dependency in mind if you change how the app starts.

### Step
Above `videoPreviewLayer`, add the `updatePreviewRotation(_:)` method, which sets an angle on the connection of the preview layer.

The service runs on the session queue, but the preview layer is an interface object that belongs to the main thread. So the method reads the `connection` of the layer and then sets [`videoRotationAngle`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/videorotationangle) inside `Task { @MainActor in ... }`, a task on the main actor.

```swift file=AVCam/CaptureService.swift highlight=3-10
    }

    private func updatePreviewRotation(_ angle: CGFloat) {
        let connection = videoPreviewLayer.connection
        Task { @MainActor in
            // Set initial rotation angle on the video preview.
            connection?.videoRotationAngle = angle
        }
    }

    private var videoPreviewLayer: AVCaptureVideoPreviewLayer {
```

### Step
Above `updatePreviewRotation(_:)`, add the `createRotationCoordinator(for:)` method. Create the coordinator, and apply its current preview angle.

The coordinator needs the camera and the layer that shows the preview. Key-value observing reports only the changes that occur later. So the method applies the current value of [`videoRotationAngleForHorizonLevelPreview`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelpreview) one time here. The coordinator also has a capture angle, because a photo must be level relative to gravity also when the interface does not turn with the device.

```swift file=AVCam/CaptureService.swift highlight=3-13
    }

    // MARK: - Rotation handling

    /// Create a new rotation coordinator for the specified device and observe its state to monitor rotation changes.
    private func createRotationCoordinator(for device: AVCaptureDevice) {
        // Create a new rotation coordinator for this device.
        rotationCoordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: videoPreviewLayer)

        // Set initial rotation state on the preview connection.
        updatePreviewRotation(rotationCoordinator.videoRotationAngleForHorizonLevelPreview)
    }

    private func updatePreviewRotation(_ angle: CGFloat) {
```

### Step
Remove the old observers. Then observe the preview angle of the new coordinator, and send each new angle to `updatePreviewRotation(_:)`.

- `removeAll()` releases the observation objects of an earlier coordinator, which stops those observations.
- The change handler does not run on the actor. So it starts a task that calls the actor method with `await`.
- The handler captures `self` weakly, so that the observation does not keep the service alive.

```swift file=AVCam/CaptureService.swift highlight=7-18
    private func createRotationCoordinator(for device: AVCaptureDevice) {
        // Create a new rotation coordinator for this device.
        rotationCoordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: videoPreviewLayer)

        // Set initial rotation state on the preview connection.
        updatePreviewRotation(rotationCoordinator.videoRotationAngleForHorizonLevelPreview)

        // Cancel previous observations.
        rotationObservers.removeAll()

        // Add observers to monitor future changes.
        rotationObservers.append(
            rotationCoordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: .new) { [weak self] _, change in
                guard let self, let angle = change.newValue else { return }
                // Update the capture preview rotation.
                Task { await self.updatePreviewRotation(angle) }
            }
        )
    }
```

### Step
In `setUpSession()`, create the rotation coordinator for the default camera.

```swift file=AVCam/CaptureService.swift highlight=11-12
    private func setUpSession() throws {
        do {
            // Retrieve the default camera.
            let defaultCamera = try deviceLookup.defaultCamera

            // Add an input for the default camera device.
            activeVideoInput = try addInput(for: defaultCamera)

            // Monitor the system-preferred camera state.
            monitorSystemPreferredCamera()
            // Configure a rotation coordinator for the default video device.
            createRotationCoordinator(for: defaultCamera)
        } catch {
            throw CameraError.setupFailed
        }
    }
```

### Step
In `changeCaptureDevice(to:)`, create a new rotation coordinator after the service adds the new input.

A coordinator belongs to one camera for its full life. After a switch, the old coordinator still calculates angles for the old camera. The call is inside the `do` block, so it runs only when the new input is in the session.

```swift file=AVCam/CaptureService.swift highlight=6-7
        // Remove the existing video input before attempting to connect a new one.
        captureSession.removeInput(currentInput)
        do {
            // Attempt to connect a new input and device to the capture session.
            activeVideoInput = try addInput(for: device)
            // Configure a new rotation coordinator for the new device.
            createRotationCoordinator(for: device)
        } catch {
            // Reconnect the existing camera on failure.
            captureSession.addInput(currentInput)
        }
    }
```

### Step
Build and run the app. Make sure that the preview and the switch button work as before.

The app now applies the preview angle during the setup and after each switch. The Simulator is not a test for rotation, and this tutorial did not verify the rotation on a real device. If you have an iPhone, run the app there, turn the device, and look at the preview.

```settings title="Checkpoint"
Action: Product > Run (Command-R), then tap the switch button
Result: the preview of the back camera, then of the front camera
Needs a real device: a check of the preview while you turn the device
```

### Text
Your code is now the same as the `chapter-02` branch. In chapter 3, you add a photo output and a capture button, and you use the second angle of the rotation coordinator for the photos.

## Check your understanding

### A discovery session for the back position has this list of device types. What is `devices.first` on an iPhone that has a wide camera and a telephoto camera on the back?

```swift
deviceTypes: [.builtInWideAngleCamera, .builtInDualCamera]
```

- [ ] The dual camera, because a virtual device always comes before a physical device.
  > The session does not rank the devices by itself. It uses the order of your list.
- [x] The wide camera, because the result has the order of the device type list.
  > Correct. The list is a priority list. To get the dual camera first, put `.builtInDualCamera` first, as `DeviceLookup` does.
- [ ] The telephoto camera, because it is the newest camera in the list.
  > The list does not name `.builtInTelephotoCamera`, so the telephoto camera is not in the result as a device of its own.

### Why does `selectNextVideoDevice()` set `userPreferredCamera`, while `changeCaptureDevice(to:)` does not?

- [ ] Because `changeCaptureDevice(to:)` is `private`, and a private method cannot write a class property.
  > Access control of the method has no effect on what the method can write.
- [ ] Because the property must be set after `commitConfiguration()` runs.
  > The property is not part of the session configuration. The order relative to the commit is not the reason.
- [x] Because `changeCaptureDevice(to:)` also runs when the system-preferred camera changes, and that is not a selection of the person.
  > Correct. Only a tap on the switch button is a selection of the person. A change by the system must not go into the history of the user's selections.

### Why does `createRotationCoordinator(for:)` call `updatePreviewRotation(_:)` directly, before it adds the observer?

- [ ] Because the observer can run only one time.
  > The observer runs each time the angle changes, as long as the observation object exists.
- [x] Because the observer reports only later changes, and the preview needs the current angle immediately.
  > Correct. Without this call, the preview has the default angle until the person turns the device for the first time.
- [ ] Because the preview layer accepts an angle only before the session starts.
  > You can set the angle of the preview connection at any time. The app does it after each camera switch too.
