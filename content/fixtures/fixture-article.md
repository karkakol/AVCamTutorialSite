---
kind: article
chapter: 0
title: Fixture: every article feature
abstract: A test page that uses each part of the article format.
estimatedMinutes: 4
branch: fixture-end
---

This page is a test for the site generator. The paragraphs before the first heading are the intro in the page header.

It is not part of the real tutorial.

## How it works

A capture session is the central object of each camera app. It takes data from inputs, such as a camera, and sends the data to outputs, such as a photo output. This paragraph is long enough to show the line length of the article text, which must be between 65 and 75 characters for easy reading.

![The capture pipeline: an input, a session, and two outputs](images/fixture-pipeline.svg)

The important types:

- [`AVCaptureSession`](https://developer.apple.com/documentation/avfoundation/avcapturesession) connects inputs to outputs.
- `AVCaptureDeviceInput` supplies media from a device.
  - A nested list item.
- `AVCapturePhotoOutput` captures photos.

The order of the work:

1. Ask for permission.
2. Configure the session.
3. Start the session.

### A third-level heading

Code from the project has a file name. The validator checks it against the branch of the page:

```swift file=AVCam/CaptureService.swift highlight=2
    private let captureSession = AVCaptureSession()
    private var isSetUp = false
```

Code without a file name is a plain listing:

```swift
let session = AVCaptureSession()
session.sessionPreset = .photo // A comment at the end of a line that is long, to test the sideways scroll of plain listings.
```

```sh
git switch fixture-start
```

## Tables

| Preset | Use | Resolution |
|---|---|---|
| `.photo` | Photo capture | The full resolution of the sensor |
| `.high` | Video recording | Depends on the device |
| `.hd4K3840x2160` | 4K video | 3840 x 2160 |

## Asides

> [!NOTE]
> A note gives extra information. It can have `code` and [links](fixture-tutorial.md).

> [!TIP]
> A tip gives a faster or better way.

> [!IMPORTANT]
> An important aside warns about a mistake that has bad results.

> [!EXPERIMENT]
> An experiment asks you to try a change.
>
> It can have two paragraphs.

> A normal block quote is not an aside.

## Images

A screenshot from the Simulator:

![The app in the Simulator with a grey preview area and a round capture button](images/fixture-screenshot.png)

See [How it works](#how-it-works), the [welcome page](welcome.md), or a page that is not written yet: [chapter 1](ch01-build.md).

## Documentation

```links
AVCaptureSession | https://developer.apple.com/documentation/avfoundation/avcapturesession | The object that connects inputs to outputs.
AVCaptureDevice | https://developer.apple.com/documentation/avfoundation/avcapturedevice | A camera or a microphone.
Setting up a capture session | https://developer.apple.com/documentation/avfoundation/setting-up-a-capture-session | An article about the session architecture.
The fixture tutorial | fixture-tutorial.md | An internal link in a link card.
```

## Check your understanding

### Which object connects inputs to outputs?

- [x] `AVCaptureSession`
  > Correct. The session is the central object.
- [ ] `AVCaptureDevice`
  > A device is a camera or a microphone.
