---
kind: article
chapter: 9
title: Concepts: HDR video
abstract: What a camera format is, how a session preset and the active format decide the video that a camera makes, and how AVCam selects a 10-bit HDR format.
estimatedMinutes: 14
branch: chapter-09
---

In chapter 8, the app records movies. You set one value, the `.high` session preset, and the session decided all other things: the size of the picture, the frame rate, the number of bits for each pixel, and the color. In this chapter, you add an HDR button for video mode. To do that, the app must decide one of these things itself.

The code of this chapter is small. The idea behind it is large. Each property of the video that a camera makes comes from one object: the **format**. When you know how to read the formats of a camera and how to select one, you know the way to HDR, to 4K, to slow motion, and to most of the professional video features of an iPhone. This article explains formats first, and then what "HDR video" means in AVCam. You write the code in [Build: HDR video](ch09-build.md).

## How it works

### A camera has many formats

An [`AVCaptureDevice.Format`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format) object describes one way in which a camera can operate. The sensor and the image pipeline behind it cannot do all things at the same time. A camera can make large frames, or many frames in each second, or frames with more bits, but only in specified combinations. Each permitted combination is one format.

A camera has many formats. The [`formats`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/formats) property of the device is the full list. The [`activeFormat`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat) property is the format that the camera uses now. A format object does not change. You cannot edit a format. You can only select a different one from the list.

### How to read a format

A format answers many questions. These are the most important ones for video:

| Question | Where you read it |
|---|---|
| How large is a frame? | `formatDescription.dimensions`, a width and a height in pixels. |
| How are the pixels stored? | `formatDescription.mediaSubType`, a four-character code such as `420v` or `x420`. |
| How fast can the camera run? | [`videoSupportedFrameRateRanges`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videosupportedframerateranges), one or more ranges with a minimum and a maximum rate. |
| Which colors can it describe? | [`supportedColorSpaces`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/supportedcolorspaces), for example sRGB, P3, or HLG BT.2020. |
| Does it combine sensor pixels? | [`isVideoBinned`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideobinned). A binned format is more sensitive to light and has less resolution. |
| Which stabilization modes work? | [`isVideoStabilizationModeSupported(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideostabilizationmodesupported(_:)). |
| How large can a photo be? | [`supportedMaxPhotoDimensions`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/supportedmaxphotodimensions), which you used in chapter 3. |

The first two answers are in the [`formatDescription`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/formatdescription) of the format. This is a Core Media object, a [`CMFormatDescription`](https://developer.apple.com/documentation/coremedia/cmformatdescription).

The best way to learn the formats of a camera is to print the list. This loop is a sketch that writes the main values of each format to the console:

```swift
for format in device.formats {
    let size = format.formatDescription.dimensions
    let pixelFormat = format.formatDescription.mediaSubType
    let rates = format.videoSupportedFrameRateRanges.map { "\($0.minFrameRate)-\($0.maxFrameRate)" }
    let hasHLG = format.supportedColorSpaces.contains(.HLG_BT2020)
    print("\(size.width) x \(size.height), \(pixelFormat), \(rates) fps, HLG: \(hasHLG)")
}
```

When you read such a list, you see that two formats can have the same size and the same frame rates and still be different formats. They can differ in the pixel format, in the field of view, in binning, or in the features that they support. Since iPhone 12, some formats come in groups of three with the same size and the same frame rate range: one with the code `420v`, one with `420f`, and one with `x420`. The third one is the subject of this chapter.

### Presets against the active format

There are two ways to select a format. On iOS, you use one or the other.

- **A preset.** You set [`sessionPreset`](https://developer.apple.com/documentation/avfoundation/avcapturesession/sessionpreset) on the session, and the session selects a format for you. This is what the app did until now: `.photo` in photo mode and [`.high`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/high) in video mode. A preset is a quality level, not a format. Apple does not state a frame size for `.high`. The result depends on the device.
- **The format itself.** You lock the device and set `activeFormat` to one of the entries in `formats`. The session then changes its preset to [`.inputPriority`](https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/inputpriority) by itself. This value means: the app selected the format, and the session does not change it.

![With the high preset the session selects the format; after the app sets the active format, the preset is inputPriority](../images/ch09-format-control.svg)

The way back is also simple. When you set a preset again, for example `.high`, the session takes control again and can replace your format.

Three rules apply when you set the format yourself:

- You need the configuration lock: [`lockForConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/lockforconfiguration()) before the change and `unlockForConfiguration()` after it. [Concepts: focus and exposure](ch06-concepts.md) explains the lock. Without the lock, the device raises an exception.
- The format must be an entry of the `formats` list of that device. A format of a different camera raises an exception.
- A format change builds the capture pipeline again. The preview can stop for a moment, and a recording that is in progress ends. Put the change between [`beginConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/beginconfiguration()) and [`commitConfiguration()`](https://developer.apple.com/documentation/avfoundation/avcapturesession/commitconfiguration()), so that the session applies it together with your other changes.

### Pixel formats: 8 bits and 10 bits

The pixel format says how the camera stores each frame in memory. The camera does not store red, green, and blue values. It stores one brightness value (luma) for each pixel and two color values (chroma) for a group of pixels. These are the codes that you see in a format list:

| Code | Bits | Meaning |
|---|---|---|
| `420v` | 8 | Chroma at half resolution in each direction (4:2:0). Video range: the values do not use the full number range. |
| `420f` | 8 | 4:2:0, full range: the values use the full number range. |
| `x420` | 10 | 4:2:0, video range. The luma values go from 64 to 940. |
| `x422` | 10 | Chroma at half resolution in one direction only (4:2:2), video range. |
| `xf20` | 10 | 4:2:0, full range. |

The number of bits is the important difference. With 8 bits, a value has 256 possible levels. With 10 bits, it has 1024 levels. HDR video describes a much larger range of brightness than standard video. If you divide a larger range into only 256 levels, the steps between two levels become visible as bands, for example in a sky. With 1024 levels, the steps stay small.

The full name of `x420` in code is [`kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange`](https://developer.apple.com/documentation/corevideo/kcvpixelformattype_420ypcbcr10biplanarvideorange). "BiPlanar" means that the frame has two planes in memory: one for luma and one for chroma.

### HLG and BT.2020

More bits are only a container. Two more definitions say what the numbers mean. Together they are the **color space** of the video.

- **The color primaries** say which red, green, and blue the numbers refer to. **BT.2020** is a set of primaries with a wide range of colors. HDR video uses it.
- **The transfer function** is the rule that changes an amount of light into a number. **HLG** (Hybrid Log-Gamma) is a transfer function for HDR. It can describe highlights that are much brighter than the white of standard video.

In AVFoundation, the [`AVCaptureColorSpace`](https://developer.apple.com/documentation/avfoundation/avcapturecolorspace) enumeration names the color spaces of a camera:

| Value | Since | Meaning |
|---|---|---|
| `.sRGB` | iOS 10 | The standard color space. |
| `.P3_D65` | iOS 10 | Wide color. |
| [`.HLG_BT2020`](https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/hlg_bt2020) | iOS 14.1 | BT.2020 primaries with the HLG transfer function. The color space of HDR video. |
| `.appleLog` | iOS 17 | BT.2020 primaries with a log curve from Apple, for video that a colorist grades later. |
| `.appleLog2` | iOS 26 | Apple Gamut primaries with the log curve from Apple. |

The `supportedColorSpaces` property of a format lists what the format permits. The [`activeColorSpace`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activecolorspace) property of the device is the color space in use.

Usually you do not set the color space. The session has a property, [`automaticallyConfiguresCaptureDeviceForWideColor`](https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfigurescapturedeviceforwidecolor), which is `true` by default. With this value, the session selects the color space. If you set `activeColorSpace` yourself, set this property to `false` first. If you do not, the session can undo your selection, also when the preset is `.inputPriority`.

When the camera records a 10-bit HLG BT.2020 format into a movie, the movie also contains **Dolby Vision** metadata for each frame. This is automatic. No capture API turns it on or off.

### Two features with the name "HDR video"

AVFoundation uses the words "HDR video" for two different features. This is a frequent source of confusion.

| | Video HDR (also named EDR) | 10-bit HDR |
|---|---|---|
| API | [`isVideoHDRSupported`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/isvideohdrsupported) on the format, [`isVideoHDREnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvideohdrenabled) on the device | A 10-bit format with the HLG BT.2020 color space |
| How it works | The sensor runs at two times the frame rate. The system merges a dark frame and a normal frame into one frame. | The camera stores more levels, with the HLG transfer function and the BT.2020 primaries. |
| On and off | A switch on the device. By default the system decides ([`automaticallyAdjustsVideoHDREnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/automaticallyadjustsvideohdrenabled) is `true`). | No switch. It is a property of the format. To turn it off, you select a different format. |
| The movie | A normal 8-bit movie with better highlights | A 10-bit HEVC movie with Dolby Vision metadata |

The two features do not combine. For a 10-bit format that supports only HLG BT.2020, `isVideoHDRSupported` is always `false`, and the system ignores `isVideoHDREnabled` while the color space is HLG BT.2020.

**The HDR button in AVCam means 10-bit HDR.** The sample never touches `isVideoHDREnabled`. The model of the app has a property with almost the same name, `isHDRVideoEnabled`, but that is the app's own state. Do not confuse the two.

### How AVCam finds the 10-bit format

"Turn HDR on" thus means "select a different format". But which one? The app wants to keep all that the person has now, the size and the frame rate, and change only the bit depth. AVCam does this with three small properties:

```swift file=AVCam/Support/CaptureExtensions.swift
extension AVCaptureDevice {
    var activeFormat10BitVariant: AVCaptureDevice.Format? {
        formats.filter {
            $0.maxFrameRate == activeFormat.maxFrameRate &&
            $0.formatDescription.dimensions == activeFormat.formatDescription.dimensions
        }
        .first(where: { $0.isTenBitFormat })
    }
}

extension AVCaptureDevice.Format {
    var isTenBitFormat: Bool {
        formatDescription.mediaSubType.rawValue == kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange
    }
    var maxFrameRate: Double {
        videoSupportedFrameRateRanges.last?.maxFrameRate ?? 0
    }
}
```

The search has four steps:

1. Take all formats of the camera.
2. Keep the formats that have the same pixel size as the active format.
3. Keep the formats that have the same maximum frame rate as the active format. The "maximum frame rate" of a format is the maximum of its last frame rate range.
4. Return the first of these formats that has the pixel format `x420`. If there is none, return `nil`.

![An example format list: the search keeps the formats with the size and rate of the active format and returns the first 10-bit one](../images/ch09-format-search.svg)

The result has two uses. If it is not `nil`, the camera can record HDR in its current configuration, and the app shows the HDR button. And the result is the format that the app sets when the person turns HDR on.

The search starts from the active format. Its answer thus depends on the current preset. If the 10-bit format is already active, the search finds a format with the same size and rate again, so the answer stays "supported".

### How AVCam turns HDR on and off

The capture service has one method for the two directions, `setHDRVideoEnabled(_:)`.

- **On.** The method locks the device and sets `activeFormat` to the 10-bit variant. The preset becomes `.inputPriority`.
- **Off.** The method sets the preset to `.high`. The app did not keep the old format, and it does not need it. The preset gives control back to the session, and the session selects its normal 8-bit format again.

The same "off" path runs when the person asks for HDR but the camera has no 10-bit variant.

One more place needs care. Each change to video mode sets the `.high` preset, as in chapter 8. This removes a 10-bit format that was active before. For this reason, the capture service keeps its own `isHDRVideoEnabled` flag, and `setCaptureMode(_:)` calls `setHDRVideoEnabled(true)` again when the flag is set.

The capability travels to the interface on the path that you built in chapter 7. The movie service computes `isHDRSupported` each time the capture service calls `updateConfiguration(for:)`. The capture service publishes the value in `CaptureCapabilities`. The model copies it to `isHDRVideoSupported`, and the toolbar shows the button only when the value is `true`.

### Frame rates

A format does not have one frame rate. It has one or more ranges, each an [`AVFrameRateRange`](https://developer.apple.com/documentation/avfoundation/avframeraterange) object with a minimum and a maximum rate. The camera runs at a rate inside a range. In low light, automatic exposure can make the rate lower to get a longer exposure time for each frame.

You control the rate with two properties of the device. AVFoundation states them as frame **durations**, which is the inverse of the rate:

- [`activeVideoMinFrameDuration`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideominframeduration) is 1 divided by the **maximum** frame rate.
- [`activeVideoMaxFrameDuration`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideomaxframeduration) is 1 divided by the **minimum** frame rate.

The minimum duration limits the top speed. Many people read it the wrong way the first time. To get a constant rate, set the two properties to the same value:

```swift
try device.lockForConfiguration()
device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 30)
device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 30)
device.unlockForConfiguration()
```

The values must be inside a range of the active format. A value that the format does not support raises an exception. The system sets the two properties back to their defaults when the format changes, when the preset changes, and when you add the input to a session. Thus you set the format first and the durations second.

AVCam does not set a frame rate. It uses the default range of the format that the preset or the HDR search selected. The only frame rate code in the sample is the `maxFrameRate` property of the search.

## What the camera can do

The format list and the properties around it give access to much more than this chapter uses. The "Since" column shows the iOS version of the API.

**Dynamic range and color**

| Capability | How you get it | Since | In this tutorial |
|---|---|---|---|
| 10-bit HDR video (HLG) | Select a 10-bit format with the HLG BT.2020 color space. | 14.1 | This chapter |
| Dolby Vision | Automatic: a movie from a 10-bit HLG format contains the metadata. | | This chapter, with no code |
| Video HDR (EDR) | Set `automaticallyAdjustsVideoHDREnabled` to `false`, then set `isVideoHDREnabled`. | | Not in AVCam |
| Apple Log and Apple Log 2 | Select a format that supports the log color space, turn off the automatic wide color configuration, and set `activeColorSpace`. While a log color space is active, the photo output does not work. | 17 and 26 | Not in AVCam |
| Global tone mapping | [`isGlobalToneMappingEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isglobaltonemappingenabled) on the device. | | Not in AVCam |

**Frame rate**

| Capability | How you get it | Since | In this tutorial |
|---|---|---|---|
| Constant frame rate | Set the two frame durations to the same value. | | Not in AVCam |
| Slow motion | Select a format with a high rate (120 or 240 frames in a second on many iPhone models) through `activeFormat`, then set the two frame durations. The movie is a normal movie with many frames. "Slow" is a decision at playback. | | Not in AVCam |
| Automatic frame rate | [`isAutoVideoFrameRateEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/isautovideoframerateenabled): the device makes the rate lower in low light, for example from 30 to 24. | 18 | Not in AVCam |
| Locked frame rate and external sync | [`activeLockedVideoFrameDuration`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/activelockedvideoframeduration) on the input, for productions with more than one camera. | 26 | Not in AVCam |
| Low light video noise reduction | [`isLowLightVideoNoiseReductionEnabled`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/islowlightvideonoisereductionenabled) on the connection. Automatic by default for a movie file output. | 27 | Not in AVCam |

**Codecs and storage**

| Capability | How you get it | Since | In this tutorial |
|---|---|---|---|
| HEVC | The output settings of the movie output. | | Chapter 8 |
| ProRes | When `availableVideoCodecTypes` of the movie output contains a ProRes type for the active format, pass it in the output settings. The data rates are very high. | | Not in AVCam |
| ProRes RAW | The codec types `.proResRAW` and `.proResRAWHQ`. Stabilization gives only metadata. | 26 | Not in AVCam |
| External storage | [`AVExternalStorageDevice`](https://developer.apple.com/documentation/avfoundation/avexternalstoragedevice): record directly to a USB-C drive. | 17 | Not in AVCam |
| Pro Video Storage | [`AVProVideoStorage`](https://developer.apple.com/documentation/avfoundation/avprovideostorage): space that the system prepares for constant writes at a high data rate. | 27 | Not in AVCam |

**Other video features**

| Capability | How you get it | Since | In this tutorial |
|---|---|---|---|
| Video stabilization | The preferred stabilization mode of the connection. The format decides which modes work. | | Chapter 8 |
| Cinematic video | [`isCinematicVideoCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturedeviceinput/iscinematicvideocaptureenabled) on the device input: a shallow depth of field with focus that follows a subject. `simulatedAperture` sets the strength of the blur. | 26 | Not in AVCam |
| Cinematic video metadata | [`isCinematicVideoMetadataCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/iscinematicvideometadatacaptureenabled) on the movie output: data for later edits with the Cinematic framework. | 27 | Not in AVCam |
| Spatial video | [`isSpatialVideoCaptureEnabled`](https://developer.apple.com/documentation/avfoundation/avcapturemoviefileoutput/isspatialvideocaptureenabled) on the movie output: video from two cameras for Apple Vision Pro. It needs a format that supports it and a cinematic stabilization mode. | 18 | Not in AVCam |
| Pause and resume | `pauseRecording()` and `resumeRecording()` on the movie output. | 18 | Not in AVCam |
| Dynamic aspect ratio | `setDynamicAspectRatio(_:completionHandler:)` on the device: a different aspect ratio with no format change. | 26 | Not in AVCam |
| Timecode | [`AVCaptureTimecodeGenerator`](https://developer.apple.com/documentation/avfoundation/avcapturetimecodegenerator): timecode for sync in post-production. | 26 | Not in AVCam |
| More than one camera | [`AVCaptureMultiCamSession`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession). | 13 | Not in AVCam |

> [!NOTE]
> The research for this tutorial found no capture API with the name "Action mode" in the iOS 27.1 SDK. The public tools for a stable picture are the stabilization modes of the connection.

Most of these features have the same structure as HDR in this chapter. First you ask the format (or the output) if it supports the feature. Then you select a format that does. Then you turn the feature on. A format with a high frame rate frequently does not support HDR, some stabilization modes, or large photos. You must examine each format.

## Why AVCam does it this way

**A variant of the active format, not a fixed format.** The sample does not contain a line such as "use 4K HDR at 30". It lets the preset select a format first and then looks for the 10-bit format with the same size and rate. The picture keeps its size, and the code works on each camera with no table of devices. The cost: the search is simple, and it has limits (see the next section).

**A preset to go back.** To turn HDR off, the sample sets `.high` again. The alternative is to keep the old format in a property and to set it again. The preset is less code, and it is also correct after a change of camera, when an old format object is not valid for the new device.

**The button appears only when the feature is there.** Not each camera has a 10-bit format. The sample asks the device each time the configuration changes and publishes the answer. The interface does not show a control that cannot work.

**The service keeps the state.** The model has `isHDRVideoEnabled` for the interface. The capture service has its own flag, because only the service knows when a preset removed the 10-bit format, and it must apply HDR again in the same configuration change.

**A nested configuration pair.** `setHDRVideoEnabled(_:)` opens its own `beginConfiguration()` and `commitConfiguration()` pair. When `setCaptureMode(_:)` calls the method, the pair is inside the pair of the caller. That is legal: the session applies the changes at the outer commit. The method thus works alone and as part of a larger change.

**The session selects the color space.** The sample never sets `activeColorSpace`. It relies on the automatic wide color configuration of the session to select HLG BT.2020 for the 10-bit format. This is the conclusion from the code and the documentation. Nobody verified it on an iPhone for this tutorial.

**No button during a recording.** A format change ends a recording. Thus the toolbar disables the HDR button while the movie output records.

## Things to know about the sample

These points come from a careful read of the Apple sample and of the SDK. Nobody verified them on an iPhone for this tutorial. HDR recording needs a real iPhone.

- **"Maximum frame rate" is the last range, not the maximum.** `maxFrameRate` reads `videoSupportedFrameRateRanges.last`. This assumes that the ranges are in order. The documentation does not promise an order.
- **The search does not examine the color space.** It never reads `supportedColorSpaces`. It treats a format as "HDR" because of its pixel format only.
- **The search knows only `x420`.** It ignores 10-bit formats with the codes `x422` and `xf20`.
- **The same size and rate are not the same format.** Two formats can agree in these two values and differ in the field of view, in binning, or in the stabilization modes. `first` takes the format that comes first in the list.
- **The frame rate does not move to the new format.** A format change sets the frame durations back to the defaults. This does not matter for AVCam, which sets no frame rate.
- **HDR after a change of camera.** `changeCaptureDevice(to:)` does not call `setHDRVideoEnabled(_:)` for the new camera. The preset is still `.inputPriority`, so the session selects no format for the new camera. It is possible that the button shows "HDR On" while the new camera uses an 8-bit format. This is not verified.
- **The order inside a mode change.** In `setCaptureMode(_:)`, the code sets `.high` and then calls `setHDRVideoEnabled(true)` before the commit. The search reads `activeFormat` at that moment. The sample depends on `activeFormat` to show the format of the new preset before the commit. This is not verified.
- **The model does not learn about a failure.** If the lock fails, the service writes to the log and changes nothing. The model keeps the value that the button set, so the button can show a state that is not true.

A more careful search also compares the color space, the binning, and the field of view, and takes the maximum of all frame rate ranges. Write it when you build your own camera app.

## Common mistakes

- **You confuse the two HDR features.** `isVideoHDREnabled` does not give you a 10-bit HLG movie. For that, you select a 10-bit format.
- **You set `activeFormat` without the lock, or with a format of a different camera.** The device raises an Objective-C exception. Swift `try` does not catch it.
- **You set a preset after you set a format.** The session takes control again and can replace your format. This is the "off" path of the sample, but it is a bug when you do not intend it.
- **You set the frame durations before the format.** The format change sets them back to the defaults. Set the format first.
- **You read the minimum frame duration as the minimum frame rate.** It is the inverse: the minimum duration gives the maximum rate.
- **You change the format during a recording.** The recording ends. Disable the control while the output records.
- **You show a control for a feature that the camera does not have.** Ask the device first, and ask again after each change of mode or camera.
- **You show 10-bit frames with your own renderer and do not handle HLG.** The colors are then wrong. `AVCaptureVideoPreviewLayer` does the HDR tone mapping for you.
- **You set `activeColorSpace` and leave the automatic wide color configuration on.** The session can undo your selection.

> [!NOTE]
> In the Simulator with SimCam, the HDR button does not appear. The search for a 10-bit format finds nothing for the SimCam camera, so `isHDRVideoSupported` stays `false`. This is the correct behavior of the code. To record HDR video, you need a real iPhone.

## Documentation

```links
Formats | https://developer.apple.com/documentation/avfoundation/capture-device-formats | The collection of the format and frame duration API.
Color | https://developer.apple.com/documentation/avfoundation/capture-device-color | The collection of the HDR and color space API.
AVCaptureDevice.Format | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format | One way in which a camera can operate.
activeFormat | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activeformat | The format in use, and the rules to set it.
AVCaptureSession.Preset | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset | All session presets.
Preset.inputPriority | https://developer.apple.com/documentation/avfoundation/avcapturesession/preset/inputpriority | The preset after the app sets the active format.
kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange | https://developer.apple.com/documentation/corevideo/kcvpixelformattype_420ypcbcr10biplanarvideorange | The 10-bit pixel format with the code x420.
AVCaptureColorSpace | https://developer.apple.com/documentation/avfoundation/avcapturecolorspace | The color spaces of a camera.
AVCaptureColorSpace.appleLog | https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/applelog | The Apple Log color space.
automaticallyConfiguresCaptureDeviceForWideColor | https://developer.apple.com/documentation/avfoundation/avcapturesession/automaticallyconfigurescapturedeviceforwidecolor | How the session selects the color space.
isVideoHDREnabled | https://developer.apple.com/documentation/avfoundation/avcapturedevice/isvideohdrenabled | The switch of the older video HDR feature.
videoSupportedFrameRateRanges | https://developer.apple.com/documentation/avfoundation/avcapturedevice/format/videosupportedframerateranges | The frame rate ranges of a format.
activeVideoMinFrameDuration | https://developer.apple.com/documentation/avfoundation/avcapturedevice/activevideominframeduration | The maximum frame rate, as a duration.
Recording movies in alternative formats | https://developer.apple.com/documentation/avfoundation/recording-movies-in-alternative-formats | The Apple article about the codecs of the movie output.
Capturing Cinematic video | https://developer.apple.com/documentation/avfoundation/capturing-cinematic-video | The Apple sample for Cinematic video.
AVCam: Building a camera app | https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app | The documentation page of the Apple sample.
WWDC21: What's new in camera capture | https://developer.apple.com/videos/play/wwdc2021/10047/ | The session that introduces 10-bit HDR video and the 10-bit search of AVCam.
WWDC20: Edit and play back HDR video with AVFoundation | https://developer.apple.com/videos/play/wwdc2020/10009/ | How to play and edit HDR movies.
WWDC20: Export HDR media in your app with AVFoundation | https://developer.apple.com/videos/play/wwdc2020/10010/ | Background about HLG, PQ, and Dolby Vision.
WWDC25: Capture cinematic video in your app | https://developer.apple.com/videos/play/wwdc2025/319/ | The Cinematic video capture API.
WWDC24: Build compelling spatial photo and video experiences | https://developer.apple.com/videos/play/wwdc2024/10166/ | Spatial video with the movie file output.
WWDC26: Build a responsive camera app that launches quickly | https://developer.apple.com/videos/play/wwdc2026/303/ | Preview rendering, hardware cost, and Pro Video Storage.
Build: HDR video | ch09-build.md | The tutorial for this chapter.
```
