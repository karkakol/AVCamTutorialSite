---
kind: article
chapter: 0
title: Welcome
abstract: What you build in this tutorial, what you need, and how the chapters, the app repository, and this site work.
estimatedMinutes: 5
---

In this tutorial, you build a full camera app for iPhone and iPad. You start from an empty Xcode project. At the end, your code is almost the same as AVCam, the camera sample from Apple.

You do not only copy code. Each chapter explains why the code has this form, and what the camera can do that the sample does not use. The goal is that you can design your own camera app after the last chapter.

## What you build

[AVCam](https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app) is the sample app that Apple uses to show the camera API of AVFoundation. It shows a live preview, takes photos and Live Photos, records video, saves media to the Photos library, and works with the Camera Control and the Lock Screen.

You build this app in 13 chapters. Each chapter adds one feature. The app builds and runs at the end of each chapter.

A second part, "Beyond the sample", has three more chapters. Their code is not from Apple: it adds features that the sample does not have, and it corrects defects of the sample.

| Chapter | Title | The result |
|---|---|---|
| 1 | First preview | The app asks for permission and shows a live camera preview. |
| 2 | Cameras | A button changes between the back camera and the front camera. |
| 3 | Take a photo | The capture button takes a photo, and the screen flashes. |
| 4 | Save to Photos | Each photo goes to the Photos library. A thumbnail shows the last photo. |
| 5 | Layout | The interface adapts to iPhone and iPad sizes. |
| 6 | Focus and exposure | A tap on the preview sets the focus and the exposure. |
| 7 | Photo features | Live Photos, a quality setting, and faster capture. |
| 10 | Record video | A second capture mode records movies with sound. |
| 11 | HDR video | The app records HDR video on cameras that support it. |
| 12 | A robust session | The app handles interruptions and errors, and it starts fast. |
| 13 | Hardware buttons and AirPods | The volume buttons and AirPods capture media. |
| 14 | Camera Control | The Camera Control shows zoom, exposure, and a focus slider. |
| 15 | Lock Screen and Control Center | The app starts from the Lock Screen and from Control Center. |
| 16 | Zoom and lenses | Part 2. The app uses the back camera with the most lenses and has a zoom control. |
| 17 | Fix the sample | Part 2. You correct four defects of the Apple sample. |
| 18 | iPhone Duo | Part 2. The app follows the direction of each camera and fits the Duo display. |

> [!NOTE]
> All 16 chapters are ready. Chapters 1, 3, 6, 7, 11, 13, 14, and 15 contain features that you can see only on a real iPhone; each page tells you which ones.

## How a chapter works

Each chapter has two pages:

1. A **concept article** (10 to 15 minutes). It explains the camera concepts of the chapter, the design of the sample, the alternatives, and the common mistakes. Read it first.
2. A **build tutorial** (35 to 45 minutes). It gives you the steps to write the code.

The finished code of a chapter is the start code of the next chapter.

## What you need

- A Mac with **Xcode 27.1**. The app supports iOS 26.0 and later.
- Experience with Swift and SwiftUI. You must know what `async` and `await` do. You do not need experience with AVFoundation.
- A camera. You have two options:
  - **A real iPhone.** All features work.
  - **An iPhone simulator with SimCam.** The Simulator has no camera. [SimCam](https://simcam.swmansion.com/) is a Mac app that gives the Simulator a camera feed. You need no code changes for it.

With SimCam, most of the tutorial works in the Simulator: the preview, the camera change, photo capture, movie recording, and saving to Photos. These features need a real iPhone:

| Feature | Chapter |
|---|---|
| The system permission alert (SimCam gives the app access without it) | 1 |
| The correct orientation of photos | 3 |
| The visible effect of focus and exposure | 6 |
| Live Photos | 7 |
| HDR video | 11 |
| Capture with the hardware buttons and AirPods | 13 |
| The Camera Control | 14 |
| The start from the Lock Screen (not tested in the Simulator) | 15 |

> [!NOTE]
> The code for these features is in the tutorial, and it builds. You can type it without an iPhone, but you cannot see the result in the Simulator.

## The app repository

The code of the tutorial is in the app repository, `AVCamTutorialApp`. It is a Git repository with one branch for each state of the project:

| Branch | Contents |
|---|---|
| `start` | The empty project that Xcode creates from the App template. |
| `chapter-01` to `chapter-15` | The finished code of each chapter. `chapter-15` is the Apple sample. |
| `chapter-16` to `chapter-20` | The finished code of each chapter of part 2. |
| `main` | The same as the last finished chapter. |

Each build tutorial shows two branch names at the top: the branch that it starts from, and the branch with the result.

### Start a chapter

Make your own branch from the start branch of the chapter. For chapter 1, that is `start`:

```sh
git switch -c my-chapter-01 start
```

For chapter 2, start from the finished chapter 1. You can use your own code, or you can take the branch:

```sh
git switch -c my-chapter-02 chapter-01
```

In chapter 1, you can also create the project in Xcode yourself. The tutorial shows the options.

### Compare your code

When something does not work, compare your files with the finished chapter:

```sh
git diff chapter-01
```

The command shows each line that is different between your working files and the branch `chapter-01`. No output means that your code is the same. To compare only one file, add its path:

```sh
git diff chapter-01 -- AVCam/CaptureService.swift
```

To see everything that a chapter adds, compare two chapter branches:

```sh
git diff start chapter-01
```

> [!TIP]
> Commit your work at the end of each chapter. Then you can go back when a later change breaks the app.

## How to use this site

Keep this site open next to Xcode.

- **Steps.** A build tutorial has sections, and each section has numbered steps. One step is one small change. The first paragraph of a step tells you what to do. The text below it tells you why.
- **Code.** Each step shows the code after the change, with the new lines highlighted. Type the highlighted lines. The other lines show you where you are in the file.
- **Done marks.** Each step has a check button. Select it when you finish the step. The page counts your finished steps, and you can mark the full page as complete at the end. The site keeps these marks in your browser.
- **Quiz.** Each build tutorial ends with three questions. Each answer has an explanation, also the wrong ones.
- **Asides.** Notes, tips, and experiments give extra information. An experiment asks you to change something and look at the result.

## A tour of the app

It helps to know the final design before you start. AVCam has three layers. Each object has one task.

![The views and the camera model are on the main actor. The capture service, the photo and movie capture objects, and the media library are off the main actor.](../images/ch00-architecture.svg)

- **The views** are SwiftUI views. `CameraView` is the main screen. `CameraPreview` shows the live picture. `CameraUI` contains the buttons and toolbars. The views read their state from the model and call its methods.
- **`CameraModel`** is an `@Observable` class on the main actor. It holds the state that the views show, such as the camera status and the capture mode. It does not use the camera itself. It passes each request to the capture service.
- **`CaptureService`** is an actor. It owns the capture session, the camera inputs, and the outputs. All camera work runs here, away from the main thread, so the interface stays smooth.
- **`PhotoCapture` and `MovieCapture`** are helper objects of the capture service. Each one manages one output: the photo output or the movie file output.
- **`MediaLibrary`** is a second actor. It saves photos and movies to the Photos library and makes the thumbnail.

The views do not know the capture service, and the capture service does not know SwiftUI. The model is the only connection between them. A second model, `PreviewCameraModel`, replaces the real one in Xcode previews, where no camera is available.

You build these parts in small steps. Chapter 1 creates the model, the capture service, and the preview. Chapter 3 adds `PhotoCapture`, chapter 4 adds `MediaLibrary`, and chapter 10 adds `MovieCapture`.

## Start

Go to chapter 1. Read the [concept article](ch01-concepts.md) first, then build the [first preview](ch01-build.md).
