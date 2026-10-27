---
publishDate: 2026-10-24T09:30
title: Getting the User's Location
slug: location
metadescription: 'Read the phone location with expo-location: ask for permission, get the current position, turn it into a city name and watch the user move.'
updateDate: 2026-10-24T09:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo', 'location', 'device-features']
course: react-native
---

## What you will build

Phones know where they are. Maps, delivery apps and fitness trackers all use that. In this lesson you will use **expo-location** to:

- ask the user for permission to use their location
- read the current position as latitude and longitude
- turn those numbers into a city name like "Kolkata"
- follow the user as they move, for a simple walk tracker

In HabitHop you will add a small **location badge** to the Today screen header. It shows "📍 Kolkata" (or wherever the user is). It is a friendly touch, and it teaches every step you need for bigger location features later.

Two words first. **Latitude** is how far north or south a place is, from -90 to 90. **Longitude** is how far east or west, from -180 to 180. Together they are called **coordinates**, and they point to one spot on Earth.

## Installing expo-location

```bash
npx expo install expo-location
```

expo-location is included in Expo Go, so the normal "where am I right now" features work there. There is one exception: **background location** (tracking the user while your app is closed or hidden). The library itself warns that in Expo Go it is not available at all on Android, and on iOS it only works in the Simulator. Background tracking also needs extra setup with expo-task-manager. So for that, plan on a development build. You can read why in [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds).

For development builds and store builds, set the text iOS shows in the permission dialog with the config plugin in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "HabitHop shows your city on the Today screen."
        }
      ]
    ]
  }
}
```

If you skip this, the default text is "Allow HabitHop to access your location". A clear reason gets more people to tap Allow.

## Step 1: ask for permission

Location is private, so both iOS and Android ask the user first. expo-location has two levels:

- **Foreground permission**: your app can read the location while it is open on screen. iOS calls this "While Using the App". This is what most apps need.
- **Background permission**: your app can read the location even when it is not on screen. Ask for this only if you really need it. App reviewers check it carefully.

Ask for foreground permission like this:

```tsx
// src/lib/location.ts
import * as Location from 'expo-location';

export async function askForLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  console.log(permission.status); // 'granted', 'denied' or 'undetermined'
  return permission.granted;
}
```

The first time, the system dialog appears. After that, the function returns the saved answer without showing anything. The result also has `canAskAgain`. When it is `false`, the system will not show the dialog again, and the only way forward is to send the user to the Settings app with `Linking.openSettings()`.

Modern phones also let users share only an **approximate** location. On iOS this is the "Precise" switch in the dialog. On Android it is "Approximate" versus "Precise". You can check what the user chose:

```tsx
// still in src/lib/location.ts
const permission = await Location.getForegroundPermissionsAsync();
console.log(permission.ios?.accuracy);     // 'full' or 'reduced'
console.log(permission.android?.accuracy); // 'fine', 'coarse' or 'none'
```

For a city name, approximate is fine. For a walk tracker, you need precise. There is also a hook version, `Location.useForegroundPermissions()`, that returns `[permission, requestPermission]`, just like the camera hook. The full pattern (explain first, then ask, then handle "denied") is in [Asking for Permissions the Right Way](/courses/react-native/permissions). The `PermissionGate` component from that lesson works with this hook too: pass it `permission`, `request` and the third item (the "get" function) as `refresh`, and it re-checks when the user comes back from Settings. For a small badge like the one in this lesson, a simpler inline check is enough.

## Step 2: check that location is switched on

Even with permission, the user may have turned off location for the whole phone (Location Services on iOS, the Location quick setting on Android). Check it first so you can show a helpful message instead of an error:

```tsx
const enabled = await Location.hasServicesEnabledAsync();
if (!enabled) {
  // show "Turn on Location in your phone settings"
}
```

## Step 3: read the position

There are two ways to get the position, and they make a real difference to speed.

`getLastKnownPositionAsync` returns the last position the phone already knows, or `null`. It is almost instant, but it might be a few minutes old:

```tsx
const last = await Location.getLastKnownPositionAsync({
  maxAge: 10 * 60 * 1000, // ignore anything older than 10 minutes
});
```

`getCurrentPositionAsync` asks the phone for a fresh position. It can take several seconds, especially indoors:

```tsx
const position = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,
});
const { latitude, longitude, accuracy } = position.coords;
```

A good habit is to try the fast one first and fall back to the fresh one: `(await getLast...) ?? (await getCurrent...)`.

The `accuracy` option is a trade between precision and battery. `Location.Accuracy` has these values:

| Value | Roughly accurate to |
| --- | --- |
| `Lowest` | 3 km |
| `Low` | 1 km |
| `Balanced` (default) | 100 m |
| `High` | 10 m |
| `Highest` | best available |
| `BestForNavigation` | best, plus extra sensors, for navigation apps |

Low accuracy can skip the GPS chip and use Wi-Fi and cell towers, which saves battery. For a city name, `Low` is plenty.

The returned object is a `LocationObject`. Logged, it looks like this:

```json
{
  "coords": {
    "latitude": 22.5726,
    "longitude": 88.3639,
    "accuracy": 35,
    "altitude": 9.1,
    "altitudeAccuracy": 3,
    "heading": 0,
    "speed": 0
  },
  "timestamp": 1792915200000,
  "mocked": false
}
```

`coords.accuracy` is in meters: "the real spot is probably within 35 m of this point". `timestamp` is when the position was measured.

## Step 4: turn coordinates into a place name

Coordinates are not friendly to read. **Reverse geocoding** turns them into an address. expo-location uses the phone's built-in service for this:

```tsx
const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
console.log(place.city, place.region, place.country);
```

```text
iOS  LOG  Kolkata West Bengal India
```

You get an array (usually with one item) of addresses with fields like `city`, `region`, `country`, `street`, `postalCode` and `formattedAddress`. Every field can be `null`, so always have a fallback, for example `place?.city ?? place?.region`.

Three things to know:

- It works on iOS and Android, not on the web.
- On Android you must have location permission before calling it.
- The phone limits how often you can call it. Call it once when the screen opens, not inside a loop. Too many calls fail with `Geocoding rate limit exceeded - too many requests`.

The opposite, `geocodeAsync('Park Street, Kolkata')`, turns an address into coordinates.

## Putting it together in HabitHop

The `LocationBadge` component in the code panel runs all four steps once when it appears: ask, check, read, reverse geocode. It keeps a small `status` state so it can show the right thing for each case: "Finding you...", a "Tap to open Settings" link when permission was denied, or the city.

Put it at the top of the Today screen:

```tsx
// src/app/(tabs)/index.tsx (top of the screen)
import { LocationBadge } from '@/components/LocationBadge';

// inside the returned JSX, above the habit list:
<LocationBadge />
```

What you will see: the first time, the permission dialog. Tap "Allow While Using App" and, after a second, "📍 Kolkata" (your city) appears above your habits. If you tap "Don't Allow", you see the Settings link instead, and the rest of the app still works. That is the important part: a missing permission should never break the screen.

The component wraps the steps in `try`/`catch`. Location can fail for many reasons (no signal, airplane mode, a timeout). Without the `catch`, the error would be lost inside the async function and the badge would stay on "Finding you..." forever.

## Following the user with watchPositionAsync

For a walk or run tracker, you want updates as the user moves. `watchPositionAsync` calls your function each time the position changes:

```tsx
// src/components/WalkTracker.tsx
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as Location from 'expo-location';
import { distanceInMeters } from '@/lib/distance';

export function WalkTracker() {
  const [meters, setMeters] = useState(0);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let previous: Location.LocationObjectCoords | null = null;
    let stopped = false;

    async function start() {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (location) => {
          const from = previous;
          if (from) setMeters((m) => m + distanceInMeters(from, location.coords));
          previous = location.coords;
        },
      );
      if (stopped) sub.remove();
      else subscription = sub;
    }

    start();
    return () => {
      stopped = true;
      subscription?.remove();
    };
  }, []);

  return <Text>You walked {Math.round(meters)} m</Text>;
}
```

The important parts:

- `distanceInterval: 10` means "only tell me when the user moved at least 10 meters". This saves battery and avoids noise. On Android you can also set `timeInterval` in milliseconds.
- `watchPositionAsync` returns a **subscription** (an object that keeps the updates coming). You must call `subscription.remove()` when the component goes away. Otherwise the GPS keeps running and draining the battery. The cleanup function of `useEffect` is the right place, as you learned in [Effects and the App Lifecycle](/courses/react-native/effects-and-app-state).
- The `stopped` flag handles a small race: if the user leaves the screen before `watchPositionAsync` finishes starting, you still remove it.
- `distanceInMeters` is a small helper that uses the **haversine formula** (a standard formula for the distance between two points on a ball like the Earth):

```ts
// src/lib/distance.ts
type Point = { latitude: number; longitude: number };

export function distanceInMeters(a: Point, b: Point) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

These updates only arrive while the app is in the foreground. When the app goes to the background, they stop. True background tracking uses `startLocationUpdatesAsync` with expo-task-manager in a development build.

## Testing on simulators and emulators

You do not have to walk around to test:

- **iOS Simulator** (needs a Mac): in the menu bar, choose Features, then Location. Pick "Apple" or "City Run" for a moving position, or "Custom Location..." to type coordinates.
- **Android emulator**: click the three dots (Extended controls) on the emulator side bar, then Location. Type coordinates or load a route and press play.

A real phone near a window gives the most realistic results. Positions set by these tools may come back with `mocked: true`.

## Common mistakes

**Reading the location before asking.** Without permission, Android throws `Not authorized to use location services` and iOS throws `Location permission is required to do this operation`. Always call `requestForegroundPermissionsAsync` first and check `granted`.

**Waiting forever indoors.** `getCurrentPositionAsync` with `Highest` accuracy can take a long time inside a building. Use `getLastKnownPositionAsync` first, and pick the lowest accuracy that does the job.

**Forgetting to remove the watcher.** The symptom is a phone that gets warm and a battery that drains, even after leaving the screen. Return a cleanup function that calls `subscription.remove()`.

**Asking for background permission "just in case".** It scares users and can get your app rejected in review. Ask for foreground only, unless a feature truly needs the background.

## Quick recap

- Install with `npx expo install expo-location`. Foreground location works in Expo Go. Background location needs a development build.
- Ask with `requestForegroundPermissionsAsync()` and check `granted` and `canAskAgain`. Users may share only an approximate location.
- Check `hasServicesEnabledAsync()` for a phone-wide "location off" switch.
- `getLastKnownPositionAsync` is fast and may be old. `getCurrentPositionAsync` is fresh and slower. Choose `Location.Accuracy` to balance precision and battery.
- `reverseGeocodeAsync(coords)` turns coordinates into a city and address. Call it rarely.
- `watchPositionAsync` gives live updates. Always `remove()` the subscription in your effect cleanup.

<code id="code-content" class="language-tsx">
// src/components/LocationBadge.tsx
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import * as Location from 'expo-location';
type Status = 'loading' | 'ready' | 'denied' | 'off' | 'error';
export function LocationBadge() {
  const [status, setStatus] = useState&lt;Status&gt;('loading');
  const [city, setCity] = useState&lt;string | null&gt;(null);
  useEffect(() =&gt; {
    async function load() {
      try {
        // 1. Ask for "while using the app" permission
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return setStatus('denied');
        // 2. Location can be switched off for the whole phone
        if (!(await Location.hasServicesEnabledAsync())) return setStatus('off');
        // 3. Try the fast cached position first, then a fresh one
        const position =
          (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        // 4. Turn the coordinates into a place name
        const [place] = await Location.reverseGeocodeAsync(position.coords);
        setCity(place?.city ?? place?.region ?? null);
        setStatus('ready');
      } catch (e) {
        console.warn('Could not get the location', e);
        setStatus('error');
      }
    }
    load();
  }, []);
  if (status === 'loading') return &lt;Text style={styles.badge}&gt;📍 Finding you...&lt;/Text&gt;;
  if (status === 'denied') {
    return (
      &lt;Pressable onPress={() =&gt; Linking.openSettings()}&gt;
        &lt;Text style={styles.badge}&gt;📍 Location is off. Tap to open Settings&lt;/Text&gt;
      &lt;/Pressable&gt;
    );
  }
  if (status !== 'ready' || !city) return null;
  return &lt;Text style={styles.badge}&gt;📍 {city}&lt;/Text&gt;;
}
const styles = StyleSheet.create({
  badge: { color: '#6B7280', fontSize: 14, marginBottom: 8 },
});
</code></pre>
