# Replay report

Each tutorial page is applied step by step to its start branch. The app is built at the end of each section.

## ch01-build (start to chapter-01)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Create the project and change the settings | yes | ok |
| 2. Create the data types and the preview view | yes | ok |
| 3. Create the capture service | yes | ok |
| 4. Authorize, configure, and start the session | yes | ok |
| 5. Create the camera model | yes | ok |
| 6. Show the preview on the screen | no | ok |

End state: equal to the branch (empty lines ignored).

## ch02-build (chapter-01 to chapter-02)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Find the cameras | yes | ok |
| 2. Change the camera in the capture service | no | ok |
| 3. Add the switch button | yes | ok |
| 4. Blur the preview during the switch | yes | ok |
| 5. Follow the system-preferred camera | yes | ok |
| 6. Keep the preview level | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch03-build (chapter-02 to chapter-03)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Describe a capture | yes | ok |
| 2. Create the photo capture service | yes | ok |
| 3. Create the capture delegate | yes | ok |
| 4. Bridge the delegate to async code | yes | ok |
| 5. Add the photo output to the session | yes | ok |
| 6. Give the photo the correct orientation | yes | ok |
| 7. Add the capture button and the flash | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch04-build (chapter-03 to chapter-04)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Add the usage descriptions | no | ok |
| 2. Create the media library | yes | ok |
| 3. Save a photo as an asset | yes | ok |
| 4. Make a thumbnail | yes | ok |
| 5. Add the location | yes | ok |
| 6. Save each photo from the model | yes | ok |
| 7. Show the thumbnail | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch05-build (chapter-04 to chapter-05)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Prepare the project for two layouts | yes | ok |
| 2. Give the preview a viewfinder frame | yes | ok |
| 3. Build the two layouts | yes | ok |
| 4. Put the toolbar in its position | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch06-build (chapter-05 to chapter-06)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Configure the device | yes | ok |
| 2. Convert the tap to a device point | no | ok |
| 3. Return to the continuous modes | yes | ok |
| 4. Connect the tap gesture | no | ok |

End state: equal to the branch (empty lines ignored).

## ch07-build (chapter-06 to chapter-07)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Describe the photo features | yes | unclear (brace position) |
| 2. Collect the movie and the proxy | yes | ok |
| 3. Enable the features on the photo output | yes | ok |
| 4. Select the features for each capture | yes | ok |
| 5. Show the Live Photo badge | yes | ok |
| 6. Add the features toolbar | yes | ok |

Errors after section 1:
- `/tmp/claude-501/-Users-karolkakol-tutorials-AVCamBuildingACameraApp/20e0aae5-9a96-4535-a48a-86b0b0803d27/scratchpad/replay/ch07-build/src/AVCam/Model/DataTypes.swift:101:1: error: Declaration is only valid at file scope (in target 'AVCam' from project 'AVCam')`
- `/tmp/claude-501/-Users-karolkakol-tutorials-AVCamBuildingACameraApp/20e0aae5-9a96-4535-a48a-86b0b0803d27/scratchpad/replay/ch07-build/src/AVCam/Model/DataTypes.swift:108:1: error: Expected '}' in struct (in target 'AVCam' from project 'AVCam')`

End state: equal to the branch (empty lines ignored).

## ch08-build (chapter-07 to chapter-08)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Describe a movie and a capture mode | yes | ok |
| 2. Add the microphone | yes | ok |
| 3. Create the movie capture service | yes | ok |
| 4. Report the duration and configure the connection | yes | ok |
| 5. Change the session between photo and video | yes | ok |
| 6. Record and save a movie | yes | ok |
| 7. Add the mode and the recording to the model | yes | ok |
| 8. Add the mode picker and the swipe gesture | yes | ok |
| 9. Add the movie capture button | yes | ok |
| 10. Show the recording time | yes | ok |
| 11. Adapt the preview to the mode | yes | ok |
| 12. Lock the controls during a recording | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch09-build (chapter-08 to chapter-09)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Find the 10-bit variant of a format | yes | ok |
| 2. Report HDR support | yes | ok |
| 3. Change the format in the capture service | yes | ok |
| 4. Add the HDR state to the model | yes | ok |
| 5. Add the HDR button | no | ok |

End state: equal to the branch (empty lines ignored).

## ch10-build (chapter-09 to chapter-10)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Observe interruptions | yes | ok |
| 2. Recover from a runtime error | yes | ok |
| 3. Show the interruption status | yes | ok |
| 4. Start fast and show controls late | yes | ok |
| 5. Cover the stale preview frame | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch11-build (chapter-10 to chapter-11)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Handle the capture event | yes | ok |
| 2. Keep the capture button in step | no | ok |
| 3. Make AirPods available as a microphone | no | ok |

End state: equal to the branch (empty lines ignored).

## ch12-build (chapter-11 to chapter-12)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Create the controls | yes | ok |
| 2. Create the controls delegate | yes | ok |
| 3. Add the controls to the session | yes | ok |
| 4. Send the overlay state to the model | yes | ok |
| 5. Reduce the interface | no | ok |

End state: equal to the branch (empty lines ignored).

## ch13-build (chapter-12 to chapter-13)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Persist the camera state | yes | ok |
| 2. Start the session from the state | no | FAILS |
| 3. Read and write the state in the model | yes | unclear (brace position) |
| 4. Sync when the app becomes active | yes | ok |
| 5. Add the capture extension | yes | ok |
| 6. Add the control extension | yes | ok |

Errors after section 2:
- `/tmp/claude-501/-Users-karolkakol-tutorials-AVCamBuildingACameraApp/20e0aae5-9a96-4535-a48a-86b0b0803d27/scratchpad/replay/ch13-build/src/AVCam/CameraModel.swift:72:44: error: missing argument for parameter 'with' in call`

Errors after section 3:
- `/tmp/claude-501/-Users-karolkakol-tutorials-AVCamBuildingACameraApp/20e0aae5-9a96-4535-a48a-86b0b0803d27/scratchpad/replay/ch13-build/src/AVCam/Preview Content/PreviewCameraModel.swift:77:1: error: Expected '}' in class (in target 'AVCam' from project 'AVCam')`

End state: equal to the branch (empty lines ignored).

## ch14-build (chapter-13 to chapter-14)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Select the cameras and describe a zoom level | yes | ok |
| 2. Create the zoom levels | yes | ok |
| 3. Change the zoom | yes | ok |
| 4. Publish the zoom to the model | yes | ok |
| 5. Build the zoom control | yes | ok |
| 6. Add the pinch gesture | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch15-build (chapter-14 to chapter-15)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Make a stream for unexpected results | yes | ok |
| 2. Send each result to the correct place | yes | ok |
| 3. Save the unexpected movie | yes | ok |
| 4. Keep the Live Photo badge on | yes | ok |
| 5. Give a new movie connection its rotation angle | yes | ok |
| 6. Play the capture sound first | yes | ok |

End state: equal to the branch (empty lines ignored).

## ch16-build (chapter-15 to chapter-16)

| Section | Page says it builds | Build |
|---|---|---|
| 1. Center the interface on the Duo display | yes | ok |
| 2. Describe the camera directions | yes | ok |
| 3. Observe the directions in the preview view | yes | ok |
| 4. Follow the direction in the capture service | yes | ok |
| 5. Mirror the preview by direction | yes | ok |
| 6. Connect the preview to the capture service | yes | ok |

End state: equal to the branch (empty lines ignored).

