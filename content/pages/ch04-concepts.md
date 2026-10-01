---
kind: article
chapter: 4
title: Concepts: save to Photos
abstract: How PhotoKit adds a photo to the Photos library, which access level a camera app needs, and how AVCam makes a thumbnail and a location tag.
estimatedMinutes: 10
branch: chapter-04
---

In chapter 3, the app made a photo and then discarded it. A photo is useful only when the person can find it again. On iOS, the place for photos is the Photos library, and the framework that writes to it is PhotoKit.

This article explains how the library accepts a new photo, which permission a camera app needs, and how AVCam makes a thumbnail and adds a location. In [Build: save to Photos](ch04-build.md), you write the code.

## How it works

### The Photos library

The Photos library is a database that the system owns. Your app has no direct access to its files. The app talks to the shared [`PHPhotoLibrary`](https://developer.apple.com/documentation/photos/phphotolibrary) object, and the system does the work. [PhotoKit](https://developer.apple.com/documentation/photokit) is the name of the framework. In code, you import the `Photos` module.

One item in the library is an **asset**. An asset is made of one or more **resources**. A resource is one file. A normal photo has one resource. A Live Photo has two: the image and a short movie.

![An asset is made of resources and has properties such as a location and an identifier](../images/ch04-asset-resources.svg)

### Access levels

The person decides how much of the library your app can use. PhotoKit has two levels, in [`PHAccessLevel`](https://developer.apple.com/documentation/photos/phaccesslevel):

| Level | What the app can do | Usage description key |
|---|---|---|
| [`.addOnly`](https://developer.apple.com/documentation/photos/phaccesslevel/addonly) | Add new assets. The app cannot read the library. | [`NSPhotoLibraryAddUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryaddusagedescription) |
| `.readWrite` | Read, change, and add assets. | [`NSPhotoLibraryUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryusagedescription) |

With the read-write level, the person can also give "limited" access. Then the app sees only the photos that the person selected.

A usage description is a sentence in the `Info.plist` data of the app. The system shows it in the permission alert. If the app touches the library and has no valid usage description, the system stops the app.

You read the status with [`authorizationStatus(for:)`](https://developer.apple.com/documentation/photos/phphotolibrary/authorizationstatus(for:)), and you ask the person with [`requestAuthorization(for:)`](https://developer.apple.com/documentation/photos/phphotolibrary/requestauthorization(for:handler:)). The system shows the alert only when the status is `.notDetermined`. After the person makes a decision, only the Settings app can change it.

### A change request creates an asset

You cannot change the library directly. You describe the change, and the system applies it. The steps are:

1. Call `performChanges` on the shared library object and give it a closure. This closure is the **change block**.
2. In the change block, create a [`PHAssetCreationRequest`](https://developer.apple.com/documentation/photos/phassetcreationrequest) object with [`forAsset()`](https://developer.apple.com/documentation/photos/phassetcreationrequest/forasset()).
3. Add each resource with [`addResource(with:data:options:)`](https://developer.apple.com/documentation/photos/phassetcreationrequest/addresource(with:data:options:)). The first argument is a [`PHAssetResourceType`](https://developer.apple.com/documentation/photos/phassetresourcetype) value, for example `.photo`.
4. Set properties of the new asset, for example its [`location`](https://developer.apple.com/documentation/photos/phassetchangerequest/location).
5. The system applies the request after the change block returns. Then `performChanges` returns, or it throws an error.

This is the complete save code of AVCam for this chapter:

```swift file=AVCam/Model/MediaLibrary.swift
    func save(photo: Photo) async throws {
        let location = try await currentLocation
        try await performChange {
            let creationRequest = PHAssetCreationRequest.forAsset()
            
            // Save primary photo.
            let options = PHAssetResourceCreationOptions()
            creationRequest.addResource(with: .photo, data: photo.data, options: options)
            creationRequest.location = location
            
            return creationRequest.placeholderForCreatedAsset
        }
    }
```

Two rules are important:

- A creation request is valid only in a change block. Do not create one in other code.
- `addResource` does not report bad data. The system examines the request later, and the error comes from `performChanges`.

### The placeholder

In the change block, the asset does not exist yet. But the app frequently needs a reference to it, for example to show it. The property [`placeholderForCreatedAsset`](https://developer.apple.com/documentation/photos/phassetchangerequest/placeholderforcreatedasset) solves this problem. It returns a [`PHObjectPlaceholder`](https://developer.apple.com/documentation/photos/phobjectplaceholder) object, which has the `localIdentifier` that the new asset gets.

After `performChanges` returns, the app uses this identifier to get the asset with [`fetchAssets(withLocalIdentifiers:options:)`](https://developer.apple.com/documentation/photos/phasset/fetchassets(withlocalidentifiers:options:)). Without the placeholder, the app must search the library for "the newest photo", which is slow and can find the wrong item.

### The thumbnail

A camera app shows a small image of the last photo. AVCam asks the library for it. [`PHImageManager`](https://developer.apple.com/documentation/photos/phimagemanager) makes an image of an asset at the size that you want, with [`requestImage(for:targetSize:contentMode:options:resultHandler:)`](https://developer.apple.com/documentation/photos/phimagemanager/requestimage(for:targetsize:contentmode:options:resulthandler:)). AVCam asks for 256 x 256 pixels. Your app gets a small image, not the full photo.

The result comes in a closure, and the closure can run more than one time. With the default options, the image manager can give a fast image of low quality first, and the final image later.

AVCam puts each image into an [`AsyncStream`](https://developer.apple.com/documentation/swift/asyncstream). The model reads the stream and keeps the last image. The thumbnail button shows it.

![The path of one photo through the media library actor, and the path of the thumbnail back to the interface](../images/ch04-save-flow.svg)

There is a second way to get a thumbnail. In chapter 3, the capture settings asked for a preview image. The method [`previewCGImageRepresentation()`](https://developer.apple.com/documentation/avfoundation/avcapturephoto/previewcgimagerepresentation()) of `AVCapturePhoto` returns it as a `CGImage`. This image is ready at the moment of capture, and the app does not have to read the library. The sample does not use it.

### The location

Photos shows where a photo was made. AVCam gets the position from Core Location and gives it to the creation request. Two things are necessary:

- A usage description for the location, with the key [`NSLocationWhenInUseUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nslocationwheninuseusagedescription).
- A request for "when in use" access. The app sends it through a `CLLocationManager` object.

Then the app reads one value from `CLLocationUpdate.liveUpdates()`. This is an asynchronous sequence of location updates. AVCam takes the first update and stops.

The `location` property of the request sets the location of the asset in the library. It is a property of the asset. It probably does not write GPS data into the image file, but this tutorial did not verify that.

This design has a cost. `save(photo:)` waits for the location before it starts the change block. Thus each save starts later, and the photo data stays in memory during the wait. The code has no time limit for this wait.

## What the Photos library can do

PhotoKit has more features than this chapter uses.

| Capability | What it does | In this tutorial |
|---|---|---|
| Add-only access | The app adds assets and cannot read the library. | Chapter 4 |
| Create an asset from data | `addResource(with:data:options:)` with a `.photo` resource. | Chapter 4 |
| Location of an asset | `location` on the creation request. | Chapter 4 |
| System photo picker | [`PhotosPicker`](https://developer.apple.com/documentation/photosui/photospicker) lets the person look at the library and select items. It needs no permission. | Chapter 4 |
| Live Photo asset | A `.photo` resource and a `.pairedVideo` resource in one request. | Chapter 7 |
| Deferred photo | A `.photoProxy` resource. The system makes the final photo later. | Chapter 7 |
| Create an asset from a file | `addResource(with:fileURL:options:)`. With `shouldMoveFile`, the library moves the file and makes no copy. | Chapters 7 and 8 |
| Save from the Lock Screen extension | The capture extension saves with PhotoKit and uses the permission of the app. | Chapter 13 |
| Read-write access and the limited library | Read assets, build a gallery in the app, and work with a selection that the person made. | Not in AVCam |
| RAW with a processed image | A `.photo` resource and an `.alternatePhoto` resource in one asset. | Not in AVCam |
| Albums | `PHAssetCollectionChangeRequest` adds the placeholder to an album in the same change block. | Not in AVCam |
| File name and type | `originalFilename` and `contentType` in [`PHAssetResourceCreationOptions`](https://developer.apple.com/documentation/photos/phassetresourcecreationoptions). | Not in AVCam |
| Image request options | [`PHImageRequestOptions`](https://developer.apple.com/documentation/photos/phimagerequestoptions) selects one result or many, and permits a download from iCloud. | Not in AVCam |
| Image cache for a grid | [`PHCachingImageManager`](https://developer.apple.com/documentation/photos/phcachingimagemanager) prepares thumbnails for many assets. | Not in AVCam |
| Change observer | The library tells the app when its contents change. This is for an app that reads the library. | Not in AVCam |

## Why AVCam does it this way

**An actor for the library.** `MediaLibrary` is an [actor](https://developer.apple.com/documentation/swift/actor). A save includes a wait for the location, a possible permission alert, and a write to a database. This work must not run on the main actor, where it stops the interface. An actor also gives the model a simple `async` interface: `try await mediaLibrary.save(photo:)`. `MediaLibrary` does not use the session queue of the capture service. Thus a slow save does not stop the camera, and the person can take the next photo.

**Two services, one model.** The capture service makes the photo. The media library saves it. The two objects do not know each other. `CameraModel` joins them: capture first, then save. You can change the place where photos go and not touch the capture code.

**Add-only access.** The app only writes photos, so it asks for the smaller permission. This is the rule of least privilege: a person gives a small permission more easily than a large one. To let the person look at photos, the thumbnail button opens the system picker. The picker runs in a different process, so the app needs no read permission for it.

**Permission at the first save, not at launch.** `MediaLibrary` asks for access when the person takes the first photo. At that moment, the person understands why the app asks.

**A stream for thumbnails.** The image manager can call its closure more than one time, and at a later time. A return value can carry only one image. A stream can carry each image when it is ready. The stream also stays the same when chapter 8 adds movies: each kind of media sends its thumbnail through the same stream.

**A template method.** `performChange` contains the steps that each save needs: the authorization check, the change block, the fetch of the new asset, and the thumbnail. `save(photo:)` only says what the change is. Chapter 8 adds `save(movie:)` with a few lines.

## Things to know about the sample

These points come from a careful read of the Apple sample and from the research for this tutorial. Read them before you copy this design into your own app.

> [!IMPORTANT]
> **The usage description key does not match the access level.** The sample requests `.addOnly` access, but it declares only `NSPhotoLibraryUsageDescription`, the key for read-write access. The Apple documentation names `NSPhotoLibraryAddUsageDescription` for an app that only adds. The research for this tutorial did not test what iOS does with this combination on an iPhone. The tutorial keeps the settings of the sample. In your own app, declare the key that matches the level that you request.

- **The thumbnail reads the library with add-only access.** `performChange` fetches the new asset and asks the image manager for an image. These are read operations, and add-only access does not include reading. If the fetch returns nothing, the code returns with no error, and the button keeps its icon. In the test for this tutorial, the thumbnail appeared in the Simulator, where a command-line tool granted the permissions. Nobody verified the behavior on an iPhone with the permission alert. A thumbnail from the capture preview image does not have this problem.
- **The thumbnail can arrive two times.** With the default options, the image manager can send an image of low quality and then the final image. The stream carries the two images, and the model shows the last one.
- **Each save waits for a location update.** If no location update arrives, the save does not start. The first photo also waits while the person answers the Photos permission request. For the location request, this is not sure: the SDK header says that an update can arrive with no location while the request is in progress. Then the save continues, and the photo gets no location. This tutorial did not test this.
- **An error from the location stops the save.** `try await currentLocation` is the first line of `save(photo:)`. If it throws, the app does not save the photo.
- **All save errors become one error.** The `catch` block of `performChange` throws `saveFailed` for each error. The caller cannot find out if the disk was full or if the data was bad.
- **The selection of the picker is not used.** `ThumbnailButton` keeps the selected items in a state property, and no code reads them. The picker is only a way to look at the library.
- **The change block writes to a captured variable.** The closure sets `placeholder`, a local `var`, and the method reads it after the change. The project uses Swift 5 mode, and the compiler accepts this. In a test for this tutorial, the compiler of Xcode 27.1 also accepted the file in Swift 6 mode.

## Common mistakes

- **You have no usage description.** The system stops the app at the first access to the library.
- **You ask for read-write access when you only add photos.** The alert asks for more than the app needs, and more people refuse.
- **You expect that add-only access lets you read your own photo.** Add-only means no reading. If you need the image, keep it from the capture.
- **You create a request outside a change block.** A creation request is valid only in the closure of `performChanges`.
- **You look for errors at `addResource`.** The error for bad data comes later, from `performChanges`.
- **You assume that the result closure runs one time.** With the default options, the image manager can call it two times. Do not resume a continuation in this closure.
- **You ask for a full-size image for a small view.** Give the image manager the size of the view. A full photo uses much memory.
- **You ask for all permissions at launch.** The person sees alerts with no context. Ask when the feature is necessary.
- **You wait for a location with no time limit.** A save must not depend on a signal that possibly never comes. Use a time limit, and save the photo without a location when the time ends.
- **You do the save on the main actor.** The interface stops during the save. Use an actor or a background task.

> [!NOTE]
> In the Simulator with SimCam, the save and the thumbnail work. The photo is a 640 x 480 JPEG with no orientation data, so the thumbnail can look turned by 90 degrees. Examine the orientation on a real iPhone.

## Documentation

```links
PhotoKit | https://developer.apple.com/documentation/photokit | The framework for the Photos library.
Delivering an Enhanced Privacy Experience in Your Photos App | https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app | The access levels, the usage description keys, and the limited library.
Fetching Objects and Requesting Changes | https://developer.apple.com/documentation/photokit/fetching-objects-and-requesting-changes | How fetches and change blocks work.
Loading and Caching Assets and Thumbnails | https://developer.apple.com/documentation/photokit/loading-and-caching-assets-and-thumbnails | How to use the image manager.
Saving captured photos | https://developer.apple.com/documentation/avfoundation/saving-captured-photos | The Apple article about the path from a captured photo to the library.
Requesting authorization to capture and save media | https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media | The permissions for the camera, the microphone, and Photos.
PHPhotoLibrary | https://developer.apple.com/documentation/photos/phphotolibrary | The shared library object.
PHAccessLevel | https://developer.apple.com/documentation/photos/phaccesslevel | The add-only level and the read-write level.
PHAuthorizationStatus | https://developer.apple.com/documentation/photos/phauthorizationstatus | The values of the authorization status.
performChanges(_:completionHandler:) | https://developer.apple.com/documentation/photos/phphotolibrary/performchanges(_:completionhandler:) | The method that runs a change block.
PHAssetCreationRequest | https://developer.apple.com/documentation/photos/phassetcreationrequest | The request that builds an asset from resources.
PHAssetResourceType | https://developer.apple.com/documentation/photos/phassetresourcetype | The kinds of resources.
placeholderForCreatedAsset | https://developer.apple.com/documentation/photos/phassetchangerequest/placeholderforcreatedasset | The placeholder for the new asset.
PHImageManager | https://developer.apple.com/documentation/photos/phimagemanager | The object that makes images of assets.
deliveryMode | https://developer.apple.com/documentation/photos/phimagerequestoptions/deliverymode | The option that selects one result or many.
PhotosPicker | https://developer.apple.com/documentation/photosui/photospicker | The SwiftUI view that opens the system photo picker.
Capturing thumbnail and preview images | https://developer.apple.com/documentation/avfoundation/capturing-thumbnail-and-preview-images | The preview image as a second source for a thumbnail.
NSPhotoLibraryAddUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryaddusagedescription | The usage description for add-only access.
NSPhotoLibraryUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryusagedescription | The usage description for read-write access.
NSLocationWhenInUseUsageDescription | https://developer.apple.com/documentation/bundleresources/information-property-list/nslocationwheninuseusagedescription | The usage description for the location.
AsyncStream | https://developer.apple.com/documentation/swift/asyncstream | The type that carries the thumbnails.
WWDC20: Meet the new Photos picker | https://developer.apple.com/videos/play/wwdc2020/10652/ | The picker that needs no permission.
WWDC20: Handle the Limited Photos Library in your app | https://developer.apple.com/videos/play/wwdc2020/10641/ | How limited access works.
WWDC21: Meet AsyncSequence | https://developer.apple.com/videos/play/wwdc2021/10058/ | Asynchronous sequences and streams.
Build: save to Photos | ch04-build.md | The tutorial for this chapter.
```
