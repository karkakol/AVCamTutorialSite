---
kind: tutorial
chapter: 18
title: Build: iPhone Duo
abstract: Move the interface to the center of the Duo display, observe the direction of each camera with a direction coordinator, change the camera when the direction changes, and mirror the preview by direction.
estimatedMinutes: 45
startBranch: chapter-17
branch: chapter-18
---

In this tutorial, you prepare the app for iPhone Duo, a device with a display on each side. First, you move the interface to the center of the Duo display. Then you add a direction coordinator, which tells the app which way each camera faces. The capture service uses its reports to change the camera and to mirror the preview.

You add no new files. You add approximately 170 lines to eight files that you know from the earlier chapters.

This chapter is a part of "Beyond the sample". The code is not in the Apple sample. It follows an Apple article, changed to fit this app. Read [Concepts: iPhone Duo](ch18-concepts.md) first if you want the background for each step.

> [!IMPORTANT]
> The test for this tutorial ran in the iPhone Duo simulator (iOS 27.1) with SimCam. You can see the layout change there. You cannot see a change of direction there, and nobody ran this chapter on a real iPhone Duo. Thus the sections about the direction end with a build, not with a visible result.

## Center the interface on the Duo display

The Duo display keeps an area at its trailing side for the status items. The safe area leaves this area out. But the app hides the status bar, so the area is an empty band, and the viewfinder is not in the center of the display.

In this section, you measure the difference between the two side insets. Then you let the interface use the full width, and you give each side half of the difference as padding.

![The Duo display in the simulator. Before the change, the interface is in the safe area at the leading side. After the change, it is in the center, with 42 points at each side.](../images/ch18-duo-safe-area.svg)

### Step
In the run destination menu of Xcode, select the iPhone Duo simulator. Run the app to see the problem.

The iPhone Duo simulator comes with the iOS 27.1 simulator runtime. SimCam must run, because it supplies the camera of this simulator too.

```settings title="Checkpoint"
Destination: the iPhone Duo simulator (iOS 27.1), with SimCam in operation
Action: Product > Run (Command-R)
Result: The preview and the controls are at the leading (left) side of the display. At the trailing side, a band of 84 points is empty.
```

### Step
In `CameraView.swift`, add the `sideInsetDifference` state property below the `swipeDirection` property.

The view measures the insets during layout, and the layout uses the result. A state property connects the two: a new value makes SwiftUI calculate the layout again. Write `@State private var sideInsetDifference = CGFloat.zero`. The start value is zero, so the layout does not change before the first measurement.

```swift file=AVCam/CameraView.swift highlight=4-5
    // The direction a person swipes on the camera preview or mode selector.
    @State var swipeDirection = SwipeDirection.left
    
    // The difference between the safe area insets at the two sides of the screen.
    @State private var sideInsetDifference = CGFloat.zero
    
    // The zoom factor at the start of a pinch gesture.
    @State private var pinchStartFactor: CGFloat?
```

### Step
After the closing brace of the `ZStack`, add an `onGeometryChange` modifier that calculates the difference of the two side insets and stores it.

The modifier is `.onGeometryChange(for: CGFloat.self) { proxy in … } action: { difference in … }`. The first closure gets a `GeometryProxy`. It reads `proxy.safeAreaInsets.leading` and `proxy.safeAreaInsets.trailing`, takes the difference with `abs`, and calls `rounded()` on the result. The first closure returns one value. SwiftUI calls the second closure, with the label `action:`, only when that value changes. The second closure writes its parameter to `sideInsetDifference`. The call to `rounded()` is necessary: an inset can change by a very small amount from one layout pass to the next. Without it, each small change writes the state, and each write starts a new layout pass.

```swift file=AVCam/CameraView.swift highlight=4-10
            // The main camera user interface.
            CameraUI(camera: camera, swipeDirection: $swipeDirection)
        }
        .onGeometryChange(for: CGFloat.self) { proxy in
            // Round the value. A layout pass can change an inset by a very small amount, and
            // a new value starts a new layout pass.
            abs(proxy.safeAreaInsets.trailing - proxy.safeAreaInsets.leading).rounded()
        } action: { difference in
            sideInsetDifference = difference
        }
    }
```

### Note
The first version of this code had no `rounded()` call. It worked in the Duo simulator. In the iPhone 18 Pro simulator, the app did not respond after its launch, because the layout never became stable. When you write state from a geometry measurement, make sure that small changes of the value do not start a new layout pass.

### Step
Above the `onGeometryChange` modifier, add an `ignoresSafeArea` modifier for the horizontal edges of the container.

Write `.ignoresSafeArea(.container, edges: .horizontal)`. The first argument is the region. `.container` is the safe area of the display, without the keyboard. The interface can now use the full width of the display, with the status area. The modifier names only the horizontal edges, so the insets at the top and at the bottom stay in effect.

```swift file=AVCam/CameraView.swift highlight=4
            // The main camera user interface.
            CameraUI(camera: camera, swipeDirection: $swipeDirection)
        }
        .ignoresSafeArea(.container, edges: .horizontal)
        .onGeometryChange(for: CGFloat.self) { proxy in
            // Round the value. A layout pass can change an inset by a very small amount, and
            // a new value starts a new layout pass.
            abs(proxy.safeAreaInsets.trailing - proxy.safeAreaInsets.leading).rounded()
        } action: { difference in
            sideInsetDifference = difference
        }
    }
```

### Step
Above the `ignoresSafeArea` modifier, add a comment and a `padding` modifier that gives each side half of the difference.

Write `.padding(.horizontal, sideInsetDifference / 2)`. The `padding` modifier is nearer to the `ZStack` than `ignoresSafeArea`, so it adds the space inside the full width. On the Duo display, the difference is 84 points, so each side gets 42 points. The interface keeps the width that it had in the safe area, but it is now in the center. On an iPhone with equal side insets, the difference is 0, and the layout does not change.

```swift file=AVCam/CameraView.swift highlight=4-7
            // The main camera user interface.
            CameraUI(camera: camera, swipeDirection: $swipeDirection)
        }
        // iPhone Duo shows its status items in an area at one side of the display. The safe area
        // leaves that area out, so the interface isn't in the center of the display. Use the full
        // width, and give both sides the same space.
        .padding(.horizontal, sideInsetDifference / 2)
        .ignoresSafeArea(.container, edges: .horizontal)
        .onGeometryChange(for: CGFloat.self) { proxy in
```

### Step
Build and run the app in the iPhone Duo simulator. Make sure that the preview and the controls are in the center of the display.

In the test for this tutorial, the two side margins were 126 and 128 pixels on a display that is 1398 pixels wide. That is approximately 42 points at each side. In the iPhone 18 Pro simulator, the layout was the same as before.

```settings title="Checkpoint"
Destination: the iPhone Duo simulator (iOS 27.1), with SimCam in operation
Action: Product > Run (Command-R)
Result: The preview and the controls are in the center of the display, with the same black space at the two sides.
```

## Describe the camera directions

The remaining sections are about the direction that each camera faces. The system reports the directions with classes that need iOS 27.1. The app supports iOS 26.0, so most of its code must not use these classes.

In this section, you add a small value type that describes the directions with strings only. You also teach the device lookup two things: the list of camera types that the app uses, and how to find the best camera for a list of identifiers.

### Step
In `DataTypes.swift`, add the `CameraDirections` structure below the `CaptureCapabilities` structure.

Write `struct CameraDirections: Sendable, Equatable` with two constants: `let forwardFacing: [String]` and `let backwardFacing: [String]`. Each array holds the unique identifiers of cameras. A string array is `Sendable`, so the value can go from the main actor to the capture actor. `Equatable` lets code compare two reports. The type uses no new API, so the protocol and the model need no availability marks.

```swift file=AVCam/Model/DataTypes.swift highlight=4-13
    static let unknown = CaptureCapabilities()
}

/// The cameras of the device, grouped by the direction that they face in relation to the camera preview.
///
/// On a device with one display, the front camera always faces the person and the back cameras
/// always face the scene. On iPhone Duo, the direction of a camera changes when a person opens or closes the device.
struct CameraDirections: Sendable, Equatable {
    /// The unique identifiers of the cameras that face the person who looks at the preview.
    let forwardFacing: [String]
    /// The unique identifiers of the cameras that face the scene behind the preview.
    let backwardFacing: [String]
}

/// A zoom level that the camera interface offers, such as 0.5x, 1x, or 2x.
struct ZoomLevel: Identifiable, Hashable {
```

### Step
In `DeviceLookup.swift`, add the static `builtInCameraTypes` property below the initializer. It returns the camera types of the discovery sessions.

The direction coordinator reports only the camera types that you give it. The list has the back cameras too, because on iPhone Duo a back camera can face the person. The order is the order of preference: a virtual device with more lenses comes first.

Write `static var builtInCameraTypes: [AVCaptureDevice.DeviceType]` as a computed property. Inside, declare `var types: [AVCaptureDevice.DeviceType]` with the five types `.builtInTripleCamera`, `.builtInDualWideCamera`, `.builtInDualCamera`, `.builtInWideAngleCamera`, and `.builtInTrueDepthCamera`, and return it. Write the list on two lines, as the solution shows, so that your file equals the branch. The list is `var`, not `let`, because the next step appends to it. Until then, Xcode warns that `types` is never changed.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=7-12
        // If the host doesn't currently define a system-preferred camera device, set the user's preferred selection to the back camera.
        if AVCaptureDevice.systemPreferredCamera == nil {
            AVCaptureDevice.userPreferredCamera = backCameraDiscoverySession.devices.first
        }
    }
    
    /// The built-in camera types that the app captures from, in the order of preference.
    static var builtInCameraTypes: [AVCaptureDevice.DeviceType] {
        var types: [AVCaptureDevice.DeviceType] = [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera,
                                                   .builtInWideAngleCamera, .builtInTrueDepthCamera]
        return types
    }
    
    /// Returns the system-preferred camera for the host system.
    var defaultCamera: AVCaptureDevice {
```

### Step
Before the `return` statement, add the two physical front camera types of iPhone Duo behind an availability check.

[`.builtInOuterUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtinouterultrawidecamera) and [`.builtInInnerUltraWideCamera`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/devicetype-swift.struct/builtininnerultrawidecamera) need iOS 27.1, so the compiler demands the `#available` check. The coordinator never reports the virtual front camera. Apple tells you to list these two types in its place. Append them with `types += [...]`.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=5-8
    /// The built-in camera types that the app captures from, in the order of preference.
    static var builtInCameraTypes: [AVCaptureDevice.DeviceType] {
        var types: [AVCaptureDevice.DeviceType] = [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera,
                                                   .builtInWideAngleCamera, .builtInTrueDepthCamera]
        // iPhone Duo has a physical front camera above each of its two displays.
        if #available(iOS 27.1, *) {
            types += [.builtInOuterUltraWideCamera, .builtInInnerUltraWideCamera]
        }
        return types
    }
```

### Step
Below the property, add the `camera(withUniqueIDIn:)` method. First, it creates a device for each identifier.

Write `func camera(withUniqueIDIn identifiers: [String]) -> AVCaptureDevice?`. It is an instance method, not `static`, and it is not `private`, because the capture service calls it. Store the devices in a constant `devices`. `AVCaptureDevice(uniqueID:)` returns `nil` when no camera has the identifier. That can occur, because the set of cameras can change at each moment. `compactMap` drops these results, so the code never force-unwraps a device. The method has no `return` statement yet. You add it in the next step. Until then, the project does not compile, because the method returns nothing.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=4-8
        return types
    }
    
    /// Returns the preferred camera from a list of unique identifiers.
    func camera(withUniqueIDIn identifiers: [String]) -> AVCaptureDevice? {
        // A camera can go away at any time, so an identifier can be without a device.
        let devices = identifiers.compactMap { AVCaptureDevice(uniqueID: $0) }
    }
    
    /// Returns the system-preferred camera for the host system.
```

### Step
Return the device with the type that comes first in the `builtInCameraTypes` list.

First, read the list into a constant: `let types = DeviceLookup.builtInCameraTypes`. An instance method must name the type to read a static property. `min` with a closure returns the smallest element by your rule. The rule compares `types.firstIndex(of: $0.deviceType)` with the same value for `$1`. A type that is not in the list gets `types.endIndex`, so it comes last. For an empty array, `min` returns `nil`.

```swift file=AVCam/Capture/DeviceLookup.swift highlight=5-9
    /// Returns the preferred camera from a list of unique identifiers.
    func camera(withUniqueIDIn identifiers: [String]) -> AVCaptureDevice? {
        // A camera can go away at any time, so an identifier can be without a device.
        let devices = identifiers.compactMap { AVCaptureDevice(uniqueID: $0) }
        let types = DeviceLookup.builtInCameraTypes
        // Select the device with the type that comes first in the order of preference.
        return devices.min {
            (types.firstIndex(of: $0.deviceType) ?? types.endIndex) < (types.firstIndex(of: $1.deviceType) ?? types.endIndex)
        }
    }
```

### Step
Build the project with Command-B to make sure that the new code has no errors.

Nothing uses the new type and the new lookup code yet. The app behaves as it did at the end of the first section.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds.
```

## Observe the directions in the preview view

An [`AVCaptureDeviceDirectionCoordinator`](https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator) reports the directions in relation to one view. In this app, that view is `PreviewView`, the UIKit view that shows the preview layer. In this section, the view creates the coordinator, changes each report into a `CameraDirections` value, and gives the value to a closure.

The coordinator must live on the main actor, and `PreviewView` is a `UIView`, so this is the correct place for it.

![The path of a direction report. The coordinator in the preview view makes a map on the main actor. The app keeps only the identifiers. The capture service creates the device on the capture actor.](../images/ch18-direction-flow.svg)

### Step
In `CameraPreview.swift`, import the AVKit framework below the AVFoundation import.

The direction coordinator, its map, and its descriptor are classes of AVKit, not of AVFoundation.

```swift file=AVCam/Views/CameraPreview.swift highlight=3
import SwiftUI
@preconcurrency import AVFoundation
import AVKit

struct CameraPreview: UIViewRepresentable {
```

### Step
In the `PreviewView` class, add the `directionCoordinator` property below the `previewLayer` property.

You must hold a strong reference to the coordinator while the view is on the screen. The type is `AnyObject`, because the type of a stored property must exist on each system that the app supports, and the coordinator class does not exist before iOS 27.1. The app only keeps the object alive, so it needs no more than `AnyObject`. Write `private var directionCoordinator: AnyObject?`.

```swift file=AVCam/Views/CameraPreview.swift highlight=5-7
        var previewLayer: AVCaptureVideoPreviewLayer {
            layer as! AVCaptureVideoPreviewLayer
        }
        
        // An object that reports the direction that each camera faces in relation to this view.
        // The type of the property is `AnyObject`, because the coordinator class needs iOS 27.1.
        private var directionCoordinator: AnyObject?
        
        nonisolated func setSession(_ session: AVCaptureSession) {
```

### Step
Below the property, add the `observeCameraDirections(with:)` method. It returns at once on a system that is older than iOS 27.1.

Write `func observeCameraDirections(with handler: @escaping @MainActor (CameraDirections) -> Void)`. The closure is `@escaping`, because the coordinator keeps it and calls it later. It is `@MainActor`, because it runs on the main actor and changes state there. The body starts with `guard #available(iOS 27.1, *) else { return }`. After the `guard` statement, the compiler knows that the code runs on iOS 27.1 or later, and lets you use the new classes. On an older system, the handler never runs, and the app continues to use the position of a camera.

```swift file=AVCam/Views/CameraPreview.swift highlight=5-9
        // An object that reports the direction that each camera faces in relation to this view.
        // The type of the property is `AnyObject`, because the coordinator class needs iOS 27.1.
        private var directionCoordinator: AnyObject?
        
        /// Starts to observe the directions that the cameras face, and reports each change to the handler.
        func observeCameraDirections(with handler: @escaping @MainActor (CameraDirections) -> Void) {
            // Earlier systems don't have the coordinator. On those systems, the app uses the position of a camera.
            guard #available(iOS 27.1, *) else { return }
        }
        
        nonisolated func setSession(_ session: AVCaptureSession) {
```

### Step
Create the coordinator with the view, the list of camera types, and a change handler with an empty body. Store it in the property.

[`init(view:deviceTypes:changeHandler:)`](https://developer.apple.com/documentation/avkit/avcapturedevicedirectioncoordinator/init(view:devicetypes:changehandler:)) takes the view as the frame of reference: "forward" means "the same way as this view". Write `directionCoordinator = AVCaptureDeviceDirectionCoordinator(view: self, deviceTypes: DeviceLookup.builtInCameraTypes) { directionMap in }`. The coordinator calls the handler a short time after its creation, so the app gets the directions at the start with no additional code.

```swift file=AVCam/Views/CameraPreview.swift highlight=5-7
        /// Starts to observe the directions that the cameras face, and reports each change to the handler.
        func observeCameraDirections(with handler: @escaping @MainActor (CameraDirections) -> Void) {
            // Earlier systems don't have the coordinator. On those systems, the app uses the position of a camera.
            guard #available(iOS 27.1, *) else { return }
            directionCoordinator = AVCaptureDeviceDirectionCoordinator(view: self, deviceTypes: DeviceLookup.builtInCameraTypes) { directionMap in
                // The coordinator calls this handler on the main actor, soon after its creation and after each change.
            }
        }
```

### Step
In the change handler, make a `CameraDirections` value from the two descriptor arrays of the map, and give it to the handler of the caller.

An [`AVCaptureDeviceDirectionMap`](https://developer.apple.com/documentation/avkit/avcapturedevicedirectionmap) has an array of [`AVCaptureDeviceDescriptor`](https://developer.apple.com/documentation/avkit/avcapturedevicedescriptor) objects for each direction: `forwardFacingDeviceDescriptors` and `backwardFacingDeviceDescriptors`. The code keeps only the `uniqueID` of each descriptor: `.map(\.uniqueID)` turns each array into `[String]`. Store the `CameraDirections` value in a constant `directions`. The SDK header says that the handler runs on the main queue, but the closure type does not tell the compiler. [`MainActor.assumeIsolated`](https://developer.apple.com/documentation/swift/mainactor/assumeisolated(_:file:line:)) states this fact, so that the code can call a main-actor closure with no `await`.

```swift file=AVCam/Views/CameraPreview.swift highlight=3-8
            directionCoordinator = AVCaptureDeviceDirectionCoordinator(view: self, deviceTypes: DeviceLookup.builtInCameraTypes) { directionMap in
                // The coordinator calls this handler on the main actor, soon after its creation and after each change.
                // A descriptor identifies a camera. Keep only the identifiers, which are safe to pass to the capture actor.
                let directions = CameraDirections(forwardFacing: directionMap.forwardFacingDeviceDescriptors.map(\.uniqueID),
                                                  backwardFacing: directionMap.backwardFacingDeviceDescriptors.map(\.uniqueID))
                MainActor.assumeIsolated {
                    handler(directions)
                }
            }
        }
```

### Step
At the top of the `CameraPreview` structure, add the `directionsHandler` property, and give the initializer a second parameter that sets it.

Write `private let directionsHandler: @MainActor (CameraDirections) -> Void`. The initializer becomes `init(source: PreviewSource, onDirectionsChange directionsHandler: @escaping @MainActor (CameraDirections) -> Void = { _ in })`, and its body assigns `self.directionsHandler = directionsHandler`. The parameter has a default value, a closure that does nothing. Thus the existing call in `CameraView` continues to compile, and a SwiftUI preview needs no handler.

```swift file=AVCam/Views/CameraPreview.swift remove
    init(source: PreviewSource) {
```

```swift file=AVCam/Views/CameraPreview.swift highlight=5-6,8,10
struct CameraPreview: UIViewRepresentable {
    
    private let source: PreviewSource
    
    // A closure to call when the directions that the cameras face change.
    private let directionsHandler: @MainActor (CameraDirections) -> Void
    
    init(source: PreviewSource, onDirectionsChange directionsHandler: @escaping @MainActor (CameraDirections) -> Void = { _ in }) {
        self.source = source
        self.directionsHandler = directionsHandler
    }
```

### Step
In `makeUIView(context:)`, start the observation after the source connects the preview.

SwiftUI calls `makeUIView(context:)` one time for each preview view. So each preview view gets one coordinator, and the coordinator lives as long as the view.

```swift file=AVCam/Views/CameraPreview.swift highlight=5-6
    func makeUIView(context: Context) -> PreviewView {
        let preview = PreviewView()
        // Connect the preview layer to the capture session.
        source.connect(to: preview)
        // Report the directions that the cameras face in relation to the preview.
        preview.observeCameraDirections(with: directionsHandler)
        return preview
    }
```

### Step
Build the project with Command-B to make sure that the preview code has no errors.

On iOS 27.1, the coordinator now runs and calls its handler. The handler of `CameraView` is still the default closure, so nothing receives the directions.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds.
```

## Follow the direction in the capture service

The capture service owns the session, so it is the place that changes the camera. In this section, the service stores the directions and the direction that the person selected. When new directions arrive, it examines the selected camera. If that camera no longer faces the selected direction, the service changes to a camera that does.

### Step
In `CaptureService.swift`, add the `cameraDirections` and `isForwardFacingCameraSelected` properties below the `deviceLookup` property.

`cameraDirections` is optional: it stays `nil` on a system with no coordinator. `isForwardFacingCameraSelected` keeps what the person wants: a camera that looks at them, or a camera that looks at the scene. The service needs this value later, when the camera that the person selected turns away. Write `private var cameraDirections: CameraDirections?` and `private var isForwardFacingCameraSelected = false`.

```swift file=AVCam/CaptureService.swift highlight=4-5,7-8
    // An object the service uses to retrieve capture devices.
    private let deviceLookup = DeviceLookup()
    
    // The directions that the cameras face in relation to the preview, if the system reports them.
    private var cameraDirections: CameraDirections?
    
    // A Boolean value that indicates whether the person selected a camera that faces them.
    private var isForwardFacingCameraSelected = false
    
    // An object that monitors the state of the system-preferred camera.
    private let systemPreferredCamera = SystemPreferredCameraObserver()
```

### Step
Below the `changeCaptureDevice(to:)` method, add a mark and the `setCameraDirections(_:)` method. It stores the directions, and applies them only after the setup.

In the simulator, the first report arrived before the setup of the session was complete. At that time the session has no camera, and `currentDevice` stops the app with a fatal error. So the method only stores the value before the setup. Write `func setCameraDirections(_ directions: CameraDirections)` without `private`, because the camera model calls it. The body stores the value, returns with `guard isSetUp else { return }`, and calls `applyCameraDirections()`. That method does not exist yet. You add it two steps later. Until then, the project does not compile.

```swift file=AVCam/CaptureService.swift highlight=7,9-18
        } catch {
            // Reconnect the existing camera on failure.
            captureSession.addInput(currentInput)
        }
    }
    
    // MARK: - Camera directions
    
    /// Stores the directions that the cameras face in relation to the preview.
    ///
    /// The app calls this method when the preview view reports new directions, for
    /// example after a person opens or closes iPhone Duo.
    func setCameraDirections(_ directions: CameraDirections) {
        cameraDirections = directions
        // Before the setup, the session has no camera. The setup applies the directions later.
        guard isSetUp else { return }
        applyCameraDirections()
    }
    
    /// Monitors changes to the system's preferred camera selection.
```

### Step
Below that method, add the `updateSelectedDirection(for:)` method. It stores the direction of one camera as the direction that the person selected.

Write `private func updateSelectedDirection(for device: AVCaptureDevice)`. One line does the work. `cameraDirections?.forwardFacing.contains(device.uniqueID)` gives an optional `Bool`: with directions from the system, the forward-facing array decides. `?? (device.position == .front)` supplies the value with no directions: then the position of the camera decides, as on each earlier iPhone. Two places need this calculation, so it is a method of its own.

```swift file=AVCam/CaptureService.swift highlight=4-8
        applyCameraDirections()
    }
    
    /// Stores the direction that the specified camera faces as the direction that the person selected.
    private func updateSelectedDirection(for device: AVCaptureDevice) {
        // Without a report from the system, use the position of the camera.
        isForwardFacingCameraSelected = cameraDirections?.forwardFacing.contains(device.uniqueID) ?? (device.position == .front)
    }
    
    /// Monitors changes to the system's preferred camera selection.
```

### Step
Below that method, add the `applyCameraDirections()` method. It continues only when the selected camera is in one of the two arrays.

The coordinator reports no direction for an external camera. It also leaves out the virtual front camera, which the system moves by itself. For these cameras, the service must not change the selection, so the method returns. Write `private func applyCameraDirections()`. Unwrap the property into a constant `directions` with `guard let`, store `currentDevice.uniqueID` in a constant `selectedID`, and return unless one of the two arrays contains it. The project compiles again after this step.

```swift file=AVCam/CaptureService.swift highlight=4-11
        isForwardFacingCameraSelected = cameraDirections?.forwardFacing.contains(device.uniqueID) ?? (device.position == .front)
    }
    
    /// Changes the camera if the selected one no longer faces the selected direction.
    private func applyCameraDirections() {
        guard let directions = cameraDirections else { return }
        let selectedID = currentDevice.uniqueID
        // Only follow the cameras that the system reports a direction for. It reports no direction
        // for an external camera, or for the virtual front camera, which the system moves by itself.
        guard directions.forwardFacing.contains(selectedID) || directions.backwardFacing.contains(selectedID) else { return }
    }
    
    /// Monitors changes to the system's preferred camera selection.
```

### Step
Get the cameras that face the selected direction. If the selected camera is not one of them, change to the best camera of that list.

Store the array in a constant `candidates` with the conditional operator. The `if` statement combines two conditions: `!candidates.contains(selectedID)` and `let device = deviceLookup.camera(withUniqueIDIn: candidates)`. Inside, write the log message with `logger.debug`, and change the camera. This is the rule of the Apple article: keep the selected camera while it faces the correct way, and replace it when it does not. The replacement uses `changeCaptureDevice(to:)` from chapter 2, so it also gets new capture controls, new zoom levels, and a new rotation coordinator. When the list has no usable camera, the lookup returns `nil`, and the selection stays.

```swift file=AVCam/CaptureService.swift highlight=9-14
    /// Changes the camera if the selected one no longer faces the selected direction.
    private func applyCameraDirections() {
        guard let directions = cameraDirections else { return }
        let selectedID = currentDevice.uniqueID
        // Only follow the cameras that the system reports a direction for. It reports no direction
        // for an external camera, or for the virtual front camera, which the system moves by itself.
        guard directions.forwardFacing.contains(selectedID) || directions.backwardFacing.contains(selectedID) else { return }
        
        // The cameras that face the direction that the person selected.
        let candidates = isForwardFacingCameraSelected ? directions.forwardFacing : directions.backwardFacing
        if !candidates.contains(selectedID), let device = deviceLookup.camera(withUniqueIDIn: candidates) {
            logger.debug("Switching camera selection, because the selected camera changed its direction.")
            changeCaptureDevice(to: device)
        }
    }
```

### Step
At the end of the `do` block in `setUpSession()`, store the direction of the start camera, and apply the directions that arrived earlier.

The start camera is the `defaultCamera` constant of the method. It is the system-preferred camera, and that can be a front camera. The selected direction starts as "backward". Without the first call, the second call sees a front camera that faces the wrong way, and replaces it with a back camera at each launch. Without the second call, an early report stays in the property, and nothing uses it until the next change of direction.

```swift file=AVCam/CaptureService.swift highlight=6-9
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
            
            isSetUp = true
            
            // The app can start with a front camera, for example when a person selected it in the last session.
            updateSelectedDirection(for: defaultCamera)
            // The directions can arrive before the setup is complete. Apply them now.
            applyCameraDirections()
        } catch {
            throw CameraError.setupFailed
        }
```

### Step
In `selectNextVideoDevice()`, store the direction of the new camera after the service changes to it.

A tap on the button is the moment when the person tells the app which direction they want. The service keeps the direction of the new camera, and follows it when a later report moves that camera.

```swift file=AVCam/CaptureService.swift highlight=5-6
        let nextDevice = videoDevices[nextIndex]
        // Change the session's active capture device.
        changeCaptureDevice(to: nextDevice)
        
        // Keep the direction of the selection, so that the app can follow it when the directions change.
        updateSelectedDirection(for: nextDevice)
        
        // The app only calls this method in response to the user requesting to switch cameras.
        // Set the new selection as the user's preferred camera.
        AVCaptureDevice.userPreferredCamera = nextDevice
```

### Step
Build the project with Command-B to make sure that the capture service has no errors.

The service can now follow a direction, but nothing calls `setCameraDirections(_:)` yet. You connect it in the last section.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds.
```

## Mirror the preview by direction

The preview connection mirrors the preview of each camera with the front position. That is correct while the position and the direction agree. In this section, the service takes control of the mirroring in the two situations where they disagree: a back camera that faces the person, and a front camera that faces the scene.

### Step
Below `applyCameraDirections()`, add the `updatePreviewMirroring()` method. It needs the directions and the selected camera.

Write `private func updatePreviewMirroring()`. Unwrap the property into a constant `directions` with `guard let`, and store `currentDevice` in a constant `device`. With no directions, the method returns, and the connection continues to decide the mirroring by itself. So the behavior on an earlier system does not change. Until the next step, Xcode warns that the two constants are never used.

```swift file=AVCam/CaptureService.swift highlight=5-9
            changeCaptureDevice(to: device)
        }
    }
    
    /// Mirrors the preview when the position of the selected camera and its direction disagree.
    private func updatePreviewMirroring() {
        guard let directions = cameraDirections else { return }
        let device = currentDevice
    }
    
    /// Monitors changes to the system's preferred camera selection.
```

### Step
Calculate the direction and the position of the camera, and find out if the two disagree.

Write three constants: `isFacingForward` and `isFacingBackward` from `contains(device.uniqueID)` on the two arrays, and `isFrontCamera` from `device.position == .front`. Then write `let needsOverride`. The method uses two Boolean values for the direction, because a camera can be in neither array. For such a camera, the two values are `false`, so `needsOverride` is `false` too. The value is `true` only for a back camera that faces the person, and for a front camera that faces the scene. Nothing reads `needsOverride` before the step that sets the mirroring, so Xcode warns that it is never used until then.

```swift file=AVCam/CaptureService.swift highlight=5-7,9-11
    /// Mirrors the preview when the position of the selected camera and its direction disagree.
    private func updatePreviewMirroring() {
        guard let directions = cameraDirections else { return }
        let device = currentDevice
        let isFacingForward = directions.forwardFacing.contains(device.uniqueID)
        let isFacingBackward = directions.backwardFacing.contains(device.uniqueID)
        let isFrontCamera = device.position == .front
        
        // The connection mirrors the preview of each camera with the front position by itself.
        // Take over only when a back camera faces the person, or a front camera faces the scene.
        let needsOverride = (isFacingForward && !isFrontCamera) || (isFacingBackward && isFrontCamera)
    }
```

### Step
Get the connection of the preview layer. In a task on the main actor, make sure that the connection supports mirroring.

Store `videoPreviewLayer.connection` in a constant `connection` before the task, because the layer property belongs to the actor. Inside `Task { @MainActor in }`, write `guard let connection, connection.isVideoMirroringSupported else { return }`. The task on the main actor is the pattern of `updatePreviewRotation(_:)`, which also changes the preview connection. An assignment to [`isVideoMirrored`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/isvideomirrored) raises an exception when the connection does not support mirroring, so the code asks first. The warning that `needsOverride` is never used stays until the next step.

```swift file=AVCam/CaptureService.swift highlight=5-9
        // The connection mirrors the preview of each camera with the front position by itself.
        // Take over only when a back camera faces the person, or a front camera faces the scene.
        let needsOverride = (isFacingForward && !isFrontCamera) || (isFacingBackward && isFrontCamera)
        
        let connection = videoPreviewLayer.connection
        Task { @MainActor in
            // Assigning `isVideoMirrored` raises an exception when the connection doesn't support mirroring.
            guard let connection, connection.isVideoMirroringSupported else { return }
        }
    }
```

### Step
In the task, take control of the mirroring when position and direction disagree. In the other case, give the mirroring back to the connection.

In the first branch, set `automaticallyAdjustsVideoMirroring` to `false`, then `isVideoMirrored` to `isFacingForward`. A back camera that faces the person gets a mirror image, and a front camera that faces the scene does not. In the `else` branch, set `automaticallyAdjustsVideoMirroring` to `true`. The order of the two assignments in the first branch is important: `isVideoMirrored` raises an exception while [`automaticallyAdjustsVideoMirroring`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/automaticallyadjustsvideomirroring) is `true`. The `else` branch is for a camera that stays selected while its direction changes two times. After the second change, the position and the direction agree again. Without this branch, the value of the first change stays on the connection, and the preview has the wrong mirroring.

```swift file=AVCam/CaptureService.swift highlight=5-12
        let connection = videoPreviewLayer.connection
        Task { @MainActor in
            // Assigning `isVideoMirrored` raises an exception when the connection doesn't support mirroring.
            guard let connection, connection.isVideoMirroringSupported else { return }
            if needsOverride {
                // Assigning `isVideoMirrored` raises an exception while automatic adjustment stays on.
                connection.automaticallyAdjustsVideoMirroring = false
                connection.isVideoMirrored = isFacingForward
            } else {
                // Position and direction agree again. Give the mirroring back to the connection.
                connection.automaticallyAdjustsVideoMirroring = true
            }
        }
    }
```

### Step
In `applyCameraDirections()`, add an `else` branch to the `if` statement, and update the mirroring there.

Replace the closing brace of the `if` statement with `} else {`, call `updatePreviewMirroring()`, and close the block. When the selected camera stays, its direction can still be new. An example: no camera faces the scene, so a back camera that now faces the person stays selected. Its preview must change to a mirror image.

```swift file=AVCam/CaptureService.swift highlight=6-7
        // The cameras that face the direction that the person selected.
        let candidates = isForwardFacingCameraSelected ? directions.forwardFacing : directions.backwardFacing
        if !candidates.contains(selectedID), let device = deviceLookup.camera(withUniqueIDIn: candidates) {
            logger.debug("Switching camera selection, because the selected camera changed its direction.")
            changeCaptureDevice(to: device)
        } else {
            updatePreviewMirroring()
        }
    }
```

### Step
In `changeCaptureDevice(to:)`, update the mirroring at the end of the `do` block.

A new input creates a new preview connection, and the new connection starts with automatic mirroring. So each change of the camera must set the mirroring again: a tap on the button, a new system-preferred camera, and a change of direction.

```swift file=AVCam/CaptureService.swift highlight=5-6
            // Register for device observations.
            observeSubjectAreaChanges(of: device)
            // Update the service's advertised capabilities.
            updateCaptureCapabilities()
            // A new input creates a new preview connection. Set its mirroring again.
            updatePreviewMirroring()
        } catch {
            // Reconnect the existing camera on failure.
            captureSession.addInput(currentInput)
        }
```

### Step
Build the project with Command-B to make sure that the mirroring code has no errors.

The capture service is complete. Nobody saw the mirroring change on a device or in the simulator, because the simulated cameras never change their direction.

```settings title="Checkpoint"
Action: Product > Build (Command-B)
Result: The build succeeds.
```

## Connect the preview to the capture service

The preview view reports the directions, and the capture service can use them. In this section, you connect the two ends: a requirement in the `Camera` protocol, its implementation in the two models, and a closure in `CameraView`.

### Step
In `Camera.swift`, add the `setCameraDirections(_:)` requirement below the `switchVideoDevices()` requirement.

Write `func setCameraDirections(_ directions: CameraDirections) async`. The requirement is `async`, because `CameraModel` must wait for the capture actor. The parameter is the plain `CameraDirections` type. Thus the protocol needs no availability mark, and it does not import AVKit. The project does not compile until both models have the method.

```swift file=AVCam/Model/Camera.swift highlight=4-5
    /// Switches between video devices available on the host system.
    func switchVideoDevices() async
    
    /// Tells the camera the directions that the cameras of the device face in relation to the preview.
    func setCameraDirections(_ directions: CameraDirections) async
    
    /// A Boolean value that indicates whether the camera is currently switching video devices.
    var isSwitchingVideoDevices: Bool { get }
```

### Step
In `CameraModel.swift`, add the `setCameraDirections(_:)` method above the `switchVideoDevices()` method. It gives the directions to the capture service.

Write `func setCameraDirections(_ directions: CameraDirections) async`, and call `await captureService.setCameraDirections(directions)`. The model runs on the main actor, and the service is a different actor, so the call needs `await`. The `CameraDirections` value can go from the main actor to the capture actor because it is `Sendable`. The project compiles again after the next step.

```swift file=AVCam/CameraModel.swift highlight=1-4
    /// Tells the capture service the directions that the cameras face in relation to the preview.
    func setCameraDirections(_ directions: CameraDirections) async {
        await captureService.setCameraDirections(directions)
    }
    
    /// Selects the next available video device for capture.
    func switchVideoDevices() async {
        isSwitchingVideoDevices = true
```

### Step
In `PreviewCameraModel.swift`, add a `setCameraDirections(_:)` method at the end of the class. It only writes a log message.

Write `func setCameraDirections(_ directions: CameraDirections)` without `async`. A method without `async` can satisfy an `async` requirement. The body calls `logger.debug` with the text in the code. The preview model has no capture service. It needs the method only because the protocol demands it.

```swift file=AVCam/Preview Content/PreviewCameraModel.swift highlight=5-7
    func setZoom(displayFactor: CGFloat) {
        displayZoomFactor = displayFactor
    }
    
    func setCameraDirections(_ directions: CameraDirections) {
        logger.debug("Camera directions aren't implemented in PreviewCamera.")
    }
}
```

### Step
In `CameraView.swift`, give `CameraPreview` a trailing closure that starts a task and sends the directions to the camera model.

The closure runs on the main actor, each time the coordinator reports. It must not wait for the capture service, so it starts a task. The closure parameter is `directions`, and the body is one line: `Task { await camera.setCameraDirections(directions) }`. The modifiers below the preview stay as they are.

```swift file=AVCam/CameraView.swift remove
                CameraPreview(source: camera.previewSource)
```

```swift file=AVCam/CameraView.swift highlight=4-7
            // A container view that manages the placement of the preview.
            PreviewContainer(camera: camera) {
                // A view that provides a preview of the captured content.
                CameraPreview(source: camera.previewSource) { directions in
                    // Tell the camera which way each camera faces now.
                    Task { await camera.setCameraDirections(directions) }
                }
                    // Handle capture events from device hardware buttons.
                    .onCameraCaptureEvent(defaultSoundDisabled: true) { event in
```

### Step
Build and run the app in the iPhone Duo simulator. Make sure that the button still changes the camera.

The direction code now runs, but the simulated cameras never change their direction. So the screen shows nothing new: the front camera faces forward, the back camera faces backward, and the service keeps the selected camera.

```settings title="Checkpoint"
Destination: the iPhone Duo simulator (iOS 27.1), with SimCam in operation
Action: Product > Run (Command-R), then tap the button that changes the camera two times
Result: The interface is in the center of the display. The preview shows the front camera, and then the back camera again.
```

### Experiment
To see a report, add the temporary line `print(directions)` as the first line of the closure in `CameraView.swift`, and run the app in the iPhone Duo simulator. In the test for this tutorial, the handler ran one time, before the setup of the session was complete. The front SimCam camera was in the forward-facing array, and the back SimCam camera was in the backward-facing array. Remove the line after the experiment, so that your code stays equal to the branch `chapter-18`.

### Note
To test this chapter fully, you need a real iPhone Duo. Nobody did this test for this tutorial, so the next lines tell you what the code and the Apple documentation make you expect. Select the back camera, and then open or close the device. The Xcode console shows "Switching camera selection, because the selected camera changed its direction." when a different camera now faces the scene, and the preview shows that camera. When a back camera faces you and stays selected, its preview is a mirror image.

### Text
The app now uses the direction of a camera, not only its position, and its interface is in the center of the Duo display. Build and run the app in the iPhone 18 Pro simulator with iOS 27.0 too. There, the availability check skips the coordinator, and the app behaves as at the end of chapter 17. This is the last chapter of "Beyond the sample".

## Check your understanding

### The change handler of the coordinator keeps only the `uniqueID` of each descriptor, and the capture service creates the device. Why does the handler not create the `AVCaptureDevice` objects itself?

- [ ] A descriptor has no unique identifier before the session runs.
  > A descriptor always has its five properties, and `uniqueID` is one of them. The question is where the device must be created.
- [x] The handler runs on the main actor, and calls into the capture system belong to the actor that owns the session.
  > Correct. Apple tells you not to call AVFoundation from the change handler. The identifiers are plain strings, so they can go to the `CaptureService` actor, and the lookup there also handles an identifier that has no device.
- [ ] `AVCaptureDevice(uniqueID:)` is not available before iOS 27.1.
  > The initializer is an old API. Only the coordinator, the map, the descriptor, and the two new device types need iOS 27.1.

### On iPhone Duo, the selected camera is the virtual front camera. A person closes the device, and a new map arrives. What does `applyCameraDirections()` do?

- [ ] It changes to the first camera in the forward-facing array.
  > The method looks for a replacement only when the selected camera is in one of the two arrays. The virtual front camera is in neither.
- [ ] It mirrors the preview, because the position of the camera is front.
  > The method returns before it gets to the mirroring. The connection continues to mirror the front position by itself.
- [x] Nothing. The coordinator does not report the virtual front camera, so the first `guard` statement returns.
  > Correct. The system moves the virtual front camera to the correct physical camera by itself. The app follows only the cameras that the map contains.

### You remove the call to `rounded()` in the `onGeometryChange` modifier of `CameraView`. What can occur?

- [ ] The interface moves to the trailing side, because the padding becomes negative.
  > `abs` makes the difference positive, with or without `rounded()`.
- [x] The layout can run again and again, because a very small change of an inset gives a new value, and a new value writes the state.
  > Correct. This occurred in the iPhone 18 Pro simulator during the work on this chapter. The rounded value stays the same between two layout passes, so SwiftUI does not call the action again.
- [ ] The app does not compile, because the padding needs a whole number.
  > A padding value is a `CGFloat` and can have a fraction. The problem is the stability of the value, not its type.
