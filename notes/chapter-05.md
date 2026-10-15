# Chapter 5 hand-off notes (code by the coordinator)

Branch `chapter-05`, start `chapter-04`. Full change: `git -C ../AVCamTutorialApp diff chapter-04 chapter-05`. The chapter title is "Layout" (rotation moved to chapters 2 and 3).

## Result and verification
- Build succeeded, no warnings. Run with SimCam on iPhone 18 Pro: the preview is now a 3:4 viewfinder frame, moved up by 44 points, with black bars above and below, and the toolbar sits lower. The layout is the same as the Apple sample's. Verified with a screenshot.
- Not verified: the regular (iPad) layout. No iPad simulator run was made.

## What the chapter adds
- `Support/ViewExtensions.swift`: the `PlatformView` protocol and its extension (`isRegularSize`, `isCompactSize`).
- `Views/CameraUI.swift`: rewritten. `PlatformView`, size class environment values, `windowSize` with `onGeometryChange`, `compactUI`, `regularUI`, `bottomPadding` (uses `AVMakeRect` and `movieAspectRatio`), `import AVFoundation`.
- `Views/PreviewContainer.swift`: `AspectRatio`, `photoAspectRatio`, `movieAspectRatio`, `horizontalSizeClass`, `photoModeOffset`, the compact branch with `.clipped()`, `.aspectRatio`, `.offset`, the `aspectRatio` property (photo ratio only; chapter 10 adds the mode check).
- `MainToolbar` and `CameraView` now conform to `PlatformView` and declare the two size class environment values. `MainToolbar` gets `width`.
- Build setting: "Supported Interface Orientations (iPhone)" is now Portrait only (`INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = UIInterfaceOrientationPortrait`). iPad keeps all four. Explain why a camera app locks the iPhone interface to portrait and lets the rotation coordinator handle the capture orientation.

## Things to explain
- Size classes; why the sample tests both classes for "regular"; why `bottomPadding` is computed from the window size and the 9:16 ratio; `onGeometryChange` and safe area insets; `.ultraThinMaterial` panel on iPad.
- This chapter is mostly SwiftUI. The concept page can be shorter (about 8 minutes) and should cover: preview aspect ratios (4:3 photo sensor, 16:9 video), `videoGravity`, why the preview frame matches the capture format, interface orientation against capture orientation, the capability map for preview (resize modes, point conversion, mirroring). Use research/01-capture-pipeline.md sections on preview and rotation.
