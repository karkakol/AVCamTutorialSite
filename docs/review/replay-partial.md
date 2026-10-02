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

