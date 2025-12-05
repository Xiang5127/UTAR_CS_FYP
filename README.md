## Streamline — GPS-Accurate Photo Capture with EXIF

Streamline is a mobile app built with Expo/React Native to capture photos that are precisely tagged with GPS coordinates and EXIF metadata. It ensures a reliable GPS lock before capturing, merges coordinates into EXIF, and prepares an upload payload for a backend service.

Current status: The UI, camera flow, GPS watcher, and EXIF merge logic are implemented. EXIF extraction is designed to be handled by a (pluggable) backend endpoint; a placeholder URL is used until the backend is connected.

### What this project is trying to achieve
- Accurate, repeatable field photo capture for logistics/inspection workflows
- Enforce GPS accuracy threshold before allowing capture (default < 10 m)
- Attach/merge EXIF + GPS data to the photo
- Provide a clean, modular foundation (hooks/utilities) for integrating an API

---

## Features
- Live GPS watcher using `expo-location` with `BestForNavigation` accuracy
  - 1s/1m updates; on-screen accuracy badge with color states (green/yellow/red)
  - Capture is disabled until GPS accuracy is below 10 meters (configurable in code)
- Camera UI using `expo-camera` with a simple overlay and guidance lines/text
- EXIF metadata processing utility designed to call a Node.js backend
  - If backend extraction fails/unavailable, falls back to minimal EXIF + GPS
- Modular hooks
  - `useLocationWatcher` — warm GPS, keep latest reading in a ref for instant snapshot
  - `useCameraCapture` — capture photo and pair it with the latest GPS reading
- Typed data models for camera, EXIF, and location

---

## Quick start

Prerequisites:
- Node.js (LTS) and a package manager (npm)
- Android Studio (emulator) or Xcode (simulator), or a physical device with GPS
- Expo Go for quick previews, or a dev build for full functionality

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npx expo start
```

Then press `a` (Android), `i` (iOS), or scan the QR with the Expo Go app.

Permissions:
- The app requests Camera and Foreground Location permissions at runtime.
- For real devices, ensure Location Services are enabled and you have a clear sky view for a good GPS lock.

---

## Environment variables (EXIF backend)
`utils/exif-processor.ts` calls an endpoint to extract EXIF data server-side to keep the client lightweight.

- Public runtime variable: `EXPO_PUBLIC_EXIF_API_URL`
  - Default (if not set): `http://localhost:3000/api/exif`
  - Set it via an `.env` file or your CI/EAS environment.

Example `.env`:

```env
EXPO_PUBLIC_EXIF_API_URL=https://your-backend.example.com/api/exif
```

Notes:
- Variables prefixed with `EXPO_PUBLIC_` are exposed to the client bundle by design.
- Make sure your backend accepts `multipart/form-data` with the field name `photo`.

---

## How it works (high level)
1. Home screen (`app/index.tsx`) navigates to the Camera screen.
2. `useLocationWatcher` starts immediately and warms up GPS; the latest reading is stored in a ref for instant access.
3. `useCameraCapture` takes a picture with `expo-camera` and snapshots the latest GPS coordinate.
4. `processEXIFMetadata(photoUri)` POSTs the image to the backend for EXIF extraction. If it fails, we fall back to minimal EXIF.
5. GPS is merged into EXIF via `mergeGPSIntoEXIF` before building an upload payload.
6. A placeholder `sendToAPI` logs the final payload; replace it with your real API integration.

Example capture payload shape (logged to console today):

```json
{
  "photoUri": "file:///.../photo.jpg",
  "location": {
    "latitude": 3.14159,
    "longitude": 101.68685,
    "accuracy": 4.8,
    "altitude": 50.2,
    "timestamp": 1733400000000
  },
  "exif": {
    "GPSLatitude": 3.14159,
    "GPSLongitude": 101.68685,
    "GPSAltitude": 50.2,
    "GPSAltitudeRef": 0,
    "DateTimeOriginal": "2025-12-05T09:00:00.000Z"
  }
}
```

---

## Project structure

Top-level folders and key files:

```
.
├─ app/                      # Expo Router (file-based navigation)
│  ├─ index.tsx              # Home screen (Start Capturing button)
│  └─ camera/
│     └─ index.tsx           # Camera screen, overlay, capture flow, GPS lock
│
├─ hooks/                    # Reusable logic hooks
│  ├─ use-location-watcher.ts   # Foreground GPS watcher (BestForNavigation)
│  ├─ use-camera-capture.ts     # Camera capture + snapshot latest GPS
│  └─ usePreciseLocation.ts     # DEPRECATED placeholder (do not use)
│
├─ utils/
│  └─ exif-processor.ts      # EXIF extraction via backend + GPS merge helper
│
├─ types/                    # Shared TypeScript types (EXIF, location, camera)
│  ├─ exif.types.ts          # EXIFMetadata, EXIFProcessingResult
│  ├─ location.types.ts      # LocationCoordinate, LocationWatcherState
│  └─ camera.types.ts        # CameraCaptureResult, CameraState
│
├─ assets/                   # Images, fonts, etc.
│
├─ global.css                # Global styles (NativeWind/Tailwind integration)
├─ tailwind.config.js        # Tailwind config for NativeWind
├─ nativewind-env.d.ts       # NativeWind type helpers
├─ expo-env.d.ts             # Typed environment variable access
├─ app.json                  # Expo app config
├─ babel.config.js           # Babel configuration
├─ metro.config.js           # Metro bundler config
├─ tsconfig.json             # TypeScript configuration
├─ eslint.config.js          # ESLint configuration
└─ package.json              # Scripts and dependencies
```

---

## Tech stack
- Expo + React Native
- Expo Router
- `expo-camera` and `expo-location`
- TypeScript
- NativeWind/Tailwind for styling

---

## Development tips
- If the GPS badge stays gray/red, wait outdoors or near a window; accuracy improves with time and clear sky.
- On emulators, GPS accuracy and altitude may be synthetic; prefer testing on a real device.
- If EXIF API calls fail, check `EXPO_PUBLIC_EXIF_API_URL` and your backend CORS/logs.

---

## Roadmap / TODO
- Connect real backend and replace `sendToAPI` with a production uploader
- Offline queue + retry for poor connectivity areas
- Local photo preview screen and re-take flow
- Configurable GPS accuracy threshold via settings
- Annotate captured images with overlays (optional)
- Add unit/integration tests and CI

---

## Scripts
- `npm install` — install dependencies
- `npx expo start` — start the dev server

---

## License
This repository currently does not declare a license. Add one if you plan to distribute.
