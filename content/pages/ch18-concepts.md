---
kind: article
chapter: 18
title: Concepts: record picture in picture
abstract: Why a movie file output cannot record a mixed picture, how data outputs give your code each frame, how a Metal kernel draws the small picture into the full picture, and how an asset writer turns the frames into a movie file.
estimatedMinutes: 15
branch: chapter-18
---

Chapter 17 showed the back camera and the front camera at the same time, but the dual mode captured nothing. In this chapter, the dual mode records a movie. The movie shows what the screen shows: one camera fills the frame, and the other camera is a small picture in a corner. A tap on the preview exchanges the two pictures on the screen and in the recording.

You learn why the movie file output of chapter 8 cannot make this movie, and what replaces it: a data output for each camera, a Metal compute kernel that mixes two frames into one, and an [`AVAssetWriter`](https://developer.apple.com/documentation/avfoundation/avassetwriter) that writes the frames to a file. You also learn how the microphone joins the multi-camera session, and why the first version of this chapter crashed in the simulator. Then you write the code in [Build: record picture in picture](ch18-build.md).

This chapter is a part of "Beyond the sample". The code is not in the Apple sample. The design follows the Apple sample [AVMultiCamPiP: Capturing from multiple cameras](https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras), which has a mixer and a recorder of the same shape. The code of this chapter is new, and the Metal kernel is our own.

> [!IMPORTANT]
> Read this before you rely on the chapter. **Verified:** the app builds with no warnings, and it ran in the iPhone 18 Pro simulator (iOS 27.0) with a simulated camera from SimCam. There, a tap on the record button started a recording, the time counted, a second tap stopped it, and the movie went to the Photos library: 10.8 seconds, 640 by 480 pixels, about 30 frames per second, the small picture at the top left of the full picture. The movie had no audio track, for a reason that this page explains. **Not verified:** all behavior on a real iPhone, the audio track, the HEVC compression settings, the costs of the three outputs, the hardware button and the AirPods stem in the dual mode, and a recording that a phone call interrupts.

## How it works

### Why the movie file output cannot do this

In chapter 8, `AVCaptureMovieFileOutput` recorded a movie with two method calls. The output received the frames of one connection, compressed them, and wrote the file. It did all the work, and the app saw only the result.

That is also its limit. A movie file output records what a connection delivers. A connection delivers the frames of one camera. The mixed picture of the dual mode exists in no connection: no camera produces it. The app has to make each mixed frame itself, and then the app has to write the file itself. That is the work of this chapter. The diagram shows the parts.

![The recording pipeline of the dual mode. Each camera input feeds its preview layer and a video data output. The microphone feeds an audio data output. The three outputs deliver their sample buffers to the dual recorder on one queue. The mixer draws the small picture into the full picture with a Metal kernel. The movie recorder writes the mixed frames and the audio to a file with an asset writer.](../images/ch18-pipeline.svg)

### Data outputs and sample buffers

An [`AVCaptureVideoDataOutput`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput) gives your code each frame of a camera. An [`AVCaptureAudioDataOutput`](https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput) does the same for the samples of the microphone. Both outputs call a delegate method, [`captureOutput(_:didOutput:from:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutputsamplebufferdelegate/captureoutput(_:didoutput:from:)), one time for each frame or each block of audio samples.

The data arrives as a `CMSampleBuffer`. A sample buffer has three parts that matter here:

- **The pixels.** For a video frame, `imageBuffer` is a `CVPixelBuffer`. The property [`videoSettings`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/videosettings) of the output selects the pixel format. The app asks for `kCVPixelFormatType_32BGRA`, because a Metal texture reads that format directly. Without this setting, the camera delivers a format with separate brightness and color planes, and the mixer would need a conversion.
- **The time.** [`presentationTimeStamp`](https://developer.apple.com/documentation/coremedia/cmsamplebuffer/presentationtimestamp) is the time of the frame on the clock of the session. The app keeps this time on each mixed frame, so that the movie plays at the speed of the recording.
- **The format description.** It tells the size and the pixel format of the frame. The mixer uses it to make output buffers of the same size.

You give each output a delegate and a queue with [`setSampleBufferDelegate(_:queue:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/setsamplebufferdelegate(_:queue:)). The queue must be serial. The output calls the delegate on that queue, and it drops a frame when the delegate is still busy with the last one. The app gives all three outputs the same delegate, `DualRecorder`, and the same queue. So the frames of both cameras and the audio samples arrive one after the other, never at the same time, and the recorder needs no lock.

The delegate sorts the frames by the output that delivered them. A frame of the camera in the small picture is stored. A frame of the camera in the full picture starts a mix: the mixer draws the stored small picture into it. So the full picture sets the frame rate and the time stamps of the movie, and the small picture is always the latest frame that arrived.

In the session, each data output is connected like a preview layer in chapter 17: [`addOutputWithNoConnections(_:)`](https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutputwithnoconnections(_:)), then an [`AVCaptureConnection(inputPorts:output:)`](https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputports:output:)) from the video port of one camera to the output. The connection gets the same mirroring as the preview, and the rotation angle for capture, [`videoRotationAngleForHorizonLevelCapture`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture). The preview uses the angle for preview; a recorded frame uses the angle for capture, as the photos of chapter 3 do.

### The Metal compute path

The mixer draws the small picture into the full picture. It does this on the GPU, with a compute kernel in the Metal shading language. A compute kernel is a small function that runs one time for each pixel of the output, with thousands of runs at the same time. In plain words, the path for one frame is this:

1. **Textures without a copy.** A [`CVMetalTextureCache`](https://developer.apple.com/documentation/corevideo/cvmetaltexturecache) wraps a `CVPixelBuffer` in an `MTLTexture`. The function [`CVMetalTextureCacheCreateTextureFromImage`](https://developer.apple.com/documentation/corevideo/cvmetaltexturecachecreatetexturefromimage(_:_:_:_:_:_:_:_:_:)) makes no copy: the texture and the pixel buffer share the same memory. The mixer makes three textures: the full picture, the small picture, and the output.
2. **An output buffer from a pool.** A [`CVPixelBufferPool`](https://developer.apple.com/documentation/corevideo/cvpixelbufferpool) gives the mixer a buffer for the result. The pool reuses buffers that the writer has released, so the app does not allocate memory for each frame. The pool makes BGRA buffers with an IOSurface, so that the GPU and the asset writer can share them.
3. **The kernel.** The kernel `pictureInPictureMixer` gets the three textures and a small structure with the position and the size of the small picture, in pixels of the output. For each output pixel, it tests if the pixel is inside the frame of the small picture. Inside, it reads a pixel of the small picture through a sampler, which scales the small picture down with linear filtering. Outside, it copies the pixel of the full picture. Then it writes the result to the output texture.
4. **The pipeline state.** [`makeDefaultLibrary()`](https://developer.apple.com/documentation/metal/mtldevice/makedefaultlibrary()) loads every `.metal` file that Xcode compiled into the target. The mixer takes the kernel function from the library and makes an [`MTLComputePipelineState`](https://developer.apple.com/documentation/metal/mtlcomputepipelinestate) from it, one time at the start. The pipeline state is the compiled kernel, ready to run.
5. **Thread groups.** The GPU runs the kernel in groups of threads. The pipeline state tells the best width of a group, `threadExecutionWidth`, and the largest size of a group, `maxTotalThreadsPerThreadgroup`. The mixer divides the output into groups of that size and tells the [`MTLComputeCommandEncoder`](https://developer.apple.com/documentation/metal/mtlcomputecommandencoder) to dispatch enough groups for every pixel. The last groups can reach beyond the edge of the texture, so the kernel returns at once for a position outside the output.
6. **Commit and wait.** The encoder puts the work into a command buffer. `commit()` sends it to the GPU, and `waitUntilCompleted()` blocks the data output queue until the frame is complete. Then the output buffer is safe to give to the writer.

The Swift code and the Metal code share one structure, `MixerParameters`. The two definitions must have the same layout: two pairs of 32-bit floats. The Swift side uses `SIMD2<Float>`, and the Metal side uses `float2`. The [Metal Shading Language Specification](https://developer.apple.com/metal/Metal-Shading-Language-Specification.pdf) describes the types and the kernel attributes.

### The asset writer life cycle

An [`AVAssetWriter`](https://developer.apple.com/documentation/avfoundation/avassetwriter) writes media samples to a container file. It is the writing half of what the movie file output did by itself. The app drives it through a short life cycle:

1. **Create the writer and its inputs.** The writer gets a file URL and a file type. Each track of the movie needs an [`AVAssetWriterInput`](https://developer.apple.com/documentation/avfoundation/avassetwriterinput): one for the video, and one for the audio when the movie has sound. An input gets its compression settings as a dictionary. The app does not invent them: [`recommendedVideoSettingsForAssetWriter(writingTo:)`](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/recommendedvideosettingsforassetwriter(writingto:)) and [`recommendedAudioSettingsForAssetWriter(writingTo:)`](https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput/recommendedaudiosettingsforassetwriter(writingto:)) return settings that fit the current format of the output and the file type.
2. **Real time.** Each input gets [`expectsMediaDataInRealTime`](https://developer.apple.com/documentation/avfoundation/avassetwriterinput/expectsmediadatainrealtime) set to `true`. A writer for a file conversion can wait for a full buffer of samples. A writer for live capture cannot: the camera delivers 30 frames per second, and a frame that waits is a frame that is late.
3. **Start the session at the first frame.** `startWriting()` opens the file. Then [`startSession(atSourceTime:)`](https://developer.apple.com/documentation/avfoundation/avassetwriter/startsession(atsourcetime:)) sets the time zero of the movie. The app passes the time stamp of the first video frame. With a time zero of 0, the movie would start with an empty gap as long as the time since the session started.
4. **Append when the input is ready.** Before each `append`, the app checks [`isReadyForMoreMediaData`](https://developer.apple.com/documentation/avfoundation/avassetwriterinput/isreadyformoremediadata). When the input is not ready, the app drops the frame. In real time, a dropped frame is better than a growing queue of frames.
5. **Finish.** `markAsFinished()` on each input, then [`finishWriting()`](https://developer.apple.com/documentation/avfoundation/avassetwriter/finishwriting()), which writes the index of the file. The call is asynchronous. After it, the writer has a `status` and, on failure, an `error`. The app then gives the file to the Photos library, as in chapter 4.

A mixed frame is a new pixel buffer with no time. [`CMSampleBufferCreateReadyWithImageBuffer`](https://developer.apple.com/documentation/coremedia/cmsamplebuffercreatereadywithimagebuffer(allocator:imagebuffer:formatdescription:sampletiming:samplebufferout:)) wraps it in a sample buffer with the format description of the output pool and the time stamp of the source frame. The writer then puts the frame at the correct time.

### The microphone and its port

The microphone joins the multi-camera session like a camera: an input with no connections, then one connection from an audio port to the audio data output. An input has one [`AVCaptureInput.Port`](https://developer.apple.com/documentation/avfoundation/avcaptureinput/port) for each stream that it supplies, in the list [`ports`](https://developer.apple.com/documentation/avfoundation/avcaptureinput/ports). On an iPhone, the microphone input has an audio port for each direction: one for the back, one for the front. The port for the back gives the sound of the scene in front of the back camera. The app asks for the port with the back position. When no port has that position, as in the simulator, the app takes the first audio port.

The Apple sample goes further. It uses two audio data outputs, one for each camera, and connects the front port to the front camera and the back port to the back camera. This app records one audio track.

### The crash in the simulator

The first version of this chapter crashed at the start of each recording in the simulator. The reason was in the audio settings. `recommendedAudioSettingsForAssetWriter(writingTo:)` returns valid settings only after the microphone delivered samples. In the simulator, the microphone had delivered nothing, and the settings had a sample rate of 0. `AVAssetWriterInput` raises an exception for that value, and an exception stops the app.

The fix is a guard: the recorder reads `AVSampleRateKey` from the settings, and when the value is 0 or less, it records without an audio input. That is why the movie in the test had no audio track. On a real iPhone, the microphone delivers samples as soon as the session runs, so the settings are valid there. But nobody verified that, so the audio track is in the "Not verified" list at the top of this page.

## What the camera can do

Data outputs open the camera pipeline to your code. The API offers more than this chapter uses:

- **Filters and effects.** A video data output and a Metal kernel can change each frame before it goes to the screen or to a file: a color filter, a blur, a beauty effect. The kernel of this chapter copies and samples pixels. A kernel can compute anything.
- **Machine learning.** A frame from a data output can go to Vision or to a Core ML model. The app then knows what is in the picture: a face, a text, a barcode. A pixel format with separate planes is often better for that work than BGRA.
- **Custom encoders and streams.** The asset writer compresses the frames to a file. An app can instead send the frames to a video encoder and stream them over a network.
- **Two audio tracks.** The microphone has one port for each direction. The Apple sample records the sound of each side with the picture of that side.
- **The time of each frame.** Each sample buffer has its time stamp on the clock of the session. An app can measure the frame rate, detect dropped frames, or synchronize the frames with other data.
- **Dropped frames.** The delegate protocol also has a method for a dropped frame, with the reason. This app ignores it.
- **System pressure.** A multi-camera session with data outputs and a GPU mixer costs power. [`systemPressureCost`](https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/systempressurecost) and the system pressure state of a camera tell an app when to reduce the frame rate.

## Why this app does it this way

**An asset writer, not a movie file output.** `AVCaptureMovieFileOutput` writes what a connection delivers. The mixed frames exist only in the app, after the mixer. So the app needs the writing half of the movie file output as a separate object. `MovieRecorder` is that object: it has the asset writer, a video input, and an optional audio input. The other modes keep their movie file output from chapter 8.

**One data output for each camera, one queue for all outputs.** The recorder must know which camera a frame comes from, and the delegate method tells only the output. So each camera gets its own output, and the delegate compares the output with the two outputs that it knows. One serial queue for all three outputs means that no two delegate calls run at the same time, so the recorder needs no lock. `MultiCamCapture` also calls `startRecording()` and `stopRecording()` on that queue, so the recorder changes its state only there.

**The latest small picture, mixed on each full picture frame.** The two cameras do not deliver their frames at the same instant. The recorder keeps only the latest frame of the camera in the small picture, and it mixes when a frame of the full picture arrives. The full picture sets the frame rate and the time stamps. A small picture that is one frame old is not visible.

**Mixing only while recording.** The preview layers show the live pictures by themselves, as in chapter 17. The GPU work is needed only for the file. So the delegate returns at once when no recorder exists. A tap on the preview changes `smallPicture` in the recorder, so the next mix uses the new layout.

**The sample-rate guard.** The simulator returns audio settings with a sample rate of 0 before the microphone delivers samples. The guard turns such a recording into a movie without sound instead of a crash. A shipping app could wait for the first audio samples, or log the case.

**`waitUntilCompleted()`.** The mixer waits for the GPU before it returns the frame. This is simple and correct: the writer gets a complete frame. The cost is that the data output queue waits for the GPU for each frame. In the simulator, the recording still ran at full frame rate. A production app would give the command buffer a completion handler and use more output buffers, so that the CPU and the GPU work at the same time.

**`receive(on: sessionQueue)` for the activity.** The recorder publishes `captureActivity` from the data output queue. The capture service is an actor, and its property must change on the actor's queue. So the service subscribes with `receive(on: sessionQueue)` before it assigns the values. Chapter 8 did not need this, because the movie capture object published from the session queue already.

**Detach, then finish.** `stopRecording()` has two halves. First, on the data output queue, the dual recorder gives up its movie recorder. After that, no frame reaches the writer. Then, on any queue, the service calls `finish()` on the movie recorder and waits. The order matters: a frame that arrives during `finishWriting()` would be an error.

**The audio port by position.** The port with the back position gives the sound of the scene. The fallback to the first audio port keeps the simulator working, where the microphone input has one port with no position.

**Ideas for later.** The Apple sample reads the two costs after the configuration and reduces the resolution, the frame rate, or the number of ports until each cost is 1.0 or less. It observes the system pressure state and lowers the frame rate under pressure. It also starts a background task during the save, so that the system does not stop the app before the file is complete. This app does none of that. Other ideas: HDR for the mixed movie, and the direction coordinator of chapter 16 in the dual mode.

## Common mistakes

- **A movie file output for a mixed picture.** The output records a connection, and no connection carries the mixed frames. Use data outputs and an asset writer.
- **A pixel format that Metal cannot read.** Without `videoSettings`, the camera delivers a format with separate planes, and the texture cache fails. Ask the output for `kCVPixelFormatType_32BGRA`.
- **A concurrent queue for the outputs.** The delegate then runs for two frames at the same time, and the recorder needs a lock. Use one serial queue.
- **A session that starts at time zero.** `startSession(atSourceTime: .zero)` puts an empty gap at the start of the movie. Pass the time stamp of the first frame.
- **An `append` without `isReadyForMoreMediaData`.** The writer raises an exception when the input is not ready. Check the property, and drop the frame when it is `false`.
- **A frame after `markAsFinished()`.** The writer fails. Detach the recorder on the data output queue first, and finish the file after that.
- **Audio settings with a sample rate of 0.** `AVAssetWriterInput` raises an exception. Check `AVSampleRateKey` before you create the input.
- **A Metal file in one target only.** The capture extension of chapter 13 compiles `CaptureService.swift`, and `CaptureService` uses the recorder, so each new file must belong to both targets. A missing `.metal` file gives no build error: `makeDefaultLibrary()` returns `nil` at run time, and the mixer produces nothing.
- **A new buffer for each frame.** An allocation for each frame costs time and memory. Take the output buffers from a pool.
- **A kernel that writes outside the texture.** The thread groups cover more pixels than the texture has. Test the position against the size of the output at the start of the kernel.

## Documentation

```links
AVCaptureVideoDataOutput | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput | The output that gives your code the frames of a camera.
AVCaptureAudioDataOutput | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput | The output that gives your code the samples of a microphone.
setSampleBufferDelegate(_:queue:) | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/setsamplebufferdelegate(_:queue:) | Gives a data output its delegate and the serial queue for the calls.
videoSettings | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/videosettings | The pixel format that a video data output delivers.
AVCaptureVideoDataOutputSampleBufferDelegate | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutputsamplebufferdelegate | The protocol that receives the video frames.
AVCaptureAudioDataOutputSampleBufferDelegate | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutputsamplebufferdelegate | The protocol that receives the audio samples.
captureOutput(_:didOutput:from:) | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutputsamplebufferdelegate/captureoutput(_:didoutput:from:) | The delegate method that gets one sample buffer.
recommendedVideoSettingsForAssetWriter(writingTo:) | https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput/recommendedvideosettingsforassetwriter(writingto:) | Compression settings for the video track that fit the output.
recommendedAudioSettingsForAssetWriter(writingTo:) | https://developer.apple.com/documentation/avfoundation/avcaptureaudiodataoutput/recommendedaudiosettingsforassetwriter(writingto:) | Compression settings for the audio track that fit the output.
AVAssetWriter | https://developer.apple.com/documentation/avfoundation/avassetwriter | The object that writes media samples to a file.
AVAssetWriterInput | https://developer.apple.com/documentation/avfoundation/avassetwriterinput | One track of the file that the writer makes.
expectsMediaDataInRealTime | https://developer.apple.com/documentation/avfoundation/avassetwriterinput/expectsmediadatainrealtime | Tells an input that the samples come from live capture.
startSession(atSourceTime:) | https://developer.apple.com/documentation/avfoundation/avassetwriter/startsession(atsourcetime:) | Sets the time zero of the movie.
isReadyForMoreMediaData | https://developer.apple.com/documentation/avfoundation/avassetwriterinput/isreadyformoremediadata | Tells you if an input accepts a sample now.
finishWriting() | https://developer.apple.com/documentation/avfoundation/avassetwriter/finishwriting() | Closes the file.
CMSampleBuffer.presentationTimeStamp | https://developer.apple.com/documentation/coremedia/cmsamplebuffer/presentationtimestamp | The time of a sample buffer.
CMSampleBufferCreateReadyWithImageBuffer | https://developer.apple.com/documentation/coremedia/cmsamplebuffercreatereadywithimagebuffer(allocator:imagebuffer:formatdescription:sampletiming:samplebufferout:) | Wraps a pixel buffer in a sample buffer with a time.
CVMetalTextureCache | https://developer.apple.com/documentation/corevideo/cvmetaltexturecache | The cache that turns pixel buffers into Metal textures.
CVMetalTextureCacheCreateTextureFromImage | https://developer.apple.com/documentation/corevideo/cvmetaltexturecachecreatetexturefromimage(_:_:_:_:_:_:_:_:_:) | Makes a texture that shares the memory of a pixel buffer.
CVPixelBufferPool | https://developer.apple.com/documentation/corevideo/cvpixelbufferpool | A pool that reuses pixel buffers.
makeDefaultLibrary() | https://developer.apple.com/documentation/metal/mtldevice/makedefaultlibrary() | Loads the Metal functions of the target.
MTLComputePipelineState | https://developer.apple.com/documentation/metal/mtlcomputepipelinestate | A compiled compute kernel.
MTLComputeCommandEncoder | https://developer.apple.com/documentation/metal/mtlcomputecommandencoder | The encoder that sets the textures and dispatches the thread groups.
Metal Shading Language Specification | https://developer.apple.com/metal/Metal-Shading-Language-Specification.pdf | The language of the kernel.
AVCaptureInput.ports | https://developer.apple.com/documentation/avfoundation/avcaptureinput/ports | The ports of an input, one for each stream.
AVCaptureInput.Port | https://developer.apple.com/documentation/avfoundation/avcaptureinput/port | One stream of an input, with a media type and a position.
addOutputWithNoConnections(_:) | https://developer.apple.com/documentation/avfoundation/avcapturesession/addoutputwithnoconnections(_:) | Adds an output and makes no connection.
AVCaptureConnection(inputPorts:output:) | https://developer.apple.com/documentation/avfoundation/avcaptureconnection/init(inputports:output:) | A connection from ports to an output.
videoRotationAngleForHorizonLevelCapture | https://developer.apple.com/documentation/avfoundation/avcapturedevice/rotationcoordinator/videorotationangleforhorizonlevelcapture | The rotation angle for recorded frames.
systemPressureCost | https://developer.apple.com/documentation/avfoundation/avcapturemulticamsession/systempressurecost | The thermal and power load of the configuration.
AVMultiCamPiP sample | https://developer.apple.com/documentation/avfoundation/avmulticampip-capturing-from-multiple-cameras | The Apple sample with a mixer and a recorder of the same shape.
WWDC19 session 225 | https://developer.apple.com/videos/play/wwdc2019/225/ | Introducing Multi-Camera Capture for iOS.
Concepts: two cameras at once | ch17-concepts.md | The multi-camera session and the connections made by hand.
Concepts: record video | ch08-concepts.md | The movie file output and the capture activity.
Build: record picture in picture | ch18-build.md | The tutorial for this chapter.
```
