## Streamline — GPS-Accurate Photo Capture (Concise Guide)

Mobile app (Expo/React Native) to capture photos with reliable GPS and embedded EXIF, then save to device gallery.

### Key modules
- Camera/UI: `app/camera/index.tsx`
- Hooks: `hooks/use-location-watcher.ts`, `hooks/use-camera-capture.ts`
- EXIF + gallery utils: `utils/exif-processor.ts`
- Types: `types/*.ts`

### Core functions
- `burnExifAndSaveToGallery(uri, exif, albumName?)` — writes EXIF via `@lodev09/react-native-exify` then saves with `expo-media-library` (dynamic import, permission‑aware). Returns saved asset `uri`.
- `useCameraCapture(latestCoordinateRef)` — takes a photo and snapshots the latest GPS coordinate.
- `useLocationWatcher()` — foreground GPS watcher; exposes `coordinate`, `error`, `latestCoordinateRef`.

### Install & run
- Install deps: `npm install`
- Start Metro: `npx expo start`

Native modules (required for EXIF write + gallery save):
- Install: `npx expo install expo-media-library @lodev09/react-native-exify`
- Run on dev client/EAS (Expo Go won’t work for these):
  - Android: `npx expo run:android`
  - iOS (macOS): `npx expo run:ios` or `eas build --profile development`

### Minimum app config
- iOS `app.json -> ios.infoPlist` includes `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSCameraUsageDescription`, location descriptions.
- Plugins: `expo-media-library`, `expo-location`, `expo-camera`.

### Environment
- No backend is required. All EXIF writing is performed on device.

### Capture flow (high level)
1) `useLocationWatcher` warms GPS; latest coordinate kept in a ref.
2) `useCameraCapture` takes picture using `expo-camera`.
3) Minimal EXIF is built locally with GPS fields (and timestamp).
4) `burnExifAndSaveToGallery` writes EXIF to file, requests permission, saves to gallery (album e.g., "Streamline"). Use returned asset `uri`.
5) Build payload and send to API (replace `sendToAPI` placeholder) — optional.

### Important snippets
- Burn EXIF + save to gallery
```ts
import { burnExifAndSaveToGallery } from '@/utils/exif-processor';

const saved = await burnExifAndSaveToGallery(photo.uri, exif, 'Streamline');
const savedUri = saved.uri; // use this in payload/UI
```

- Minimal EXIF (no backend) to write GPS
```ts
const exif = {
  GPSLatitude: lat,
  GPSLongitude: lon,
  GPSAltitude: altitude ?? undefined,
  GPSAltitudeRef: altitude !== undefined && altitude < 0 ? 1 : 0,
  DateTimeOriginal: new Date(timestamp).toISOString(),
};
```

- Dynamic import safety (inside `burnExifAndSaveToGallery`)
```ts
let MediaLibrary: typeof import('expo-media-library') | null = null;
try { MediaLibrary = await import('expo-media-library'); }
catch { return { uri: writtenUri }; }
```

### Troubleshooting
- “Could not find 'expo-media-library'” → run `npx expo install expo-media-library` and rebuild a Dev Client/EAS app. Web/Expo Go are not supported for native EXIF write.
- Permission denied when saving → the function returns the local file `uri`; photo may not appear in gallery.
- GPS accuracy too high (red/yellow badge) → wait for a better lock or go outdoors.

### Scripts
- `npx expo start` — start dev server
- `npm run android` / `npm run ios` — launch platform target

### License
No license declared yet.
