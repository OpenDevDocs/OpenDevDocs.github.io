---
publishDate: 2026-10-21T21:30
title: Showing Images
slug: images
metadescription: 'Show local and remote images in React Native with the core Image component and expo-image: sizing, resize modes, placeholders, transitions and caching.'
updateDate: 2026-10-21T21:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'images', 'expo-image']
course: react-native
---

## Pictures make apps friendly

A logo on the welcome screen, a profile photo in settings, a picture next to a quote: images make an app feel finished. React Native gives you two good options:

- The core **`Image`** component from `react-native`, always available.
- **`expo-image`**, a faster and more capable image component from Expo. It is already installed in your project (the template uses it on the Explore screen).

This lesson covers both. You will learn how to show images from your project and from the internet, how to size them, and why `expo-image` is the better default for real apps.

## Local images with require()

A **local image** is a file inside your project, usually in `assets/images`. Put a file there, for example `assets/images/habit-hop-logo.png`, and show it like this:

```tsx
// src/app/index.tsx
import { Image, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={require('@/assets/images/habit-hop-logo.png')}
        style={{ width: 120, height: 120 }}
      />
    </View>
  );
}
```

Some details:

- `source` tells the component where the picture comes from.
- `require(...)` is how you include a file in the app **bundle**. Metro sees it while bundling and packs the image with your app, so it works offline.
- `@/assets/images/...` uses the alias from `tsconfig.json`, which points `@/assets/` at the `assets` folder (see [Understanding the Project Files](/courses/react-native/project-structure)).
- The path must be a **fixed string**. Metro reads it while bundling, before your code runs, so you cannot build it from a variable.

That last rule trips people up. This does **not** work:

```tsx
// src/components/Broken.tsx
const name = 'logo';
const image = require(`@/assets/images/${name}.png`); // Metro cannot follow this
```

If you need to pick an image at runtime, list all the options with fixed `require` calls first, then pick one:

```tsx
// src/constants/badges.ts
export const badgeImages = {
  bronze: require('@/assets/images/badge-bronze.png'),
  silver: require('@/assets/images/badge-silver.png'),
  gold: require('@/assets/images/badge-gold.png'),
};

// later: source={badgeImages[level]}
```

### Sharp images on every screen: @2x and @3x

Phone screens pack pixels at different densities. A 120 dp image needs 120 real pixels on an older phone, 240 on a sharper one and 360 on the sharpest. You can provide all three:

```text
assets/images/
├── habit-hop-logo.png      120 x 120 pixels
├── habit-hop-logo@2x.png   240 x 240 pixels
└── habit-hop-logo@3x.png   360 x 360 pixels
```

You still write `require('@/assets/images/habit-hop-logo.png')`. React Native picks the right file for the phone automatically. The template does this for `react-logo.png`. If you only have one file, make it large enough for the sharpest screens.

## Remote images with a URI

A **remote image** comes from the internet. Pass an object with a `uri` (a web address) instead of `require`:

```tsx
// src/app/index.tsx
import { Image, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Image
        source={{ uri: 'https://picsum.photos/seed/habithop/600/400' }}
        style={{ width: '100%', height: 200, borderRadius: 16 }}
      />
    </View>
  );
}
```

(`picsum.photos` is a free placeholder image service, handy for practice.)

The big difference: **remote images must be given a size.** React Native cannot know how big a remote picture is before it downloads it, so without a `width` and `height` (or `flex`, or an `aspectRatio`) the image has a size of zero and you see nothing at all.

`aspectRatio` is a neat way to size images that should fill the width:

```tsx
// src/components/Banner.tsx
import { Image } from 'react-native';

export function Banner() {
  return (
    <Image
      source={{ uri: 'https://picsum.photos/seed/morning/1200/600' }}
      style={{ width: '100%', aspectRatio: 2, borderRadius: 16 }}
    />
  );
}
```

`aspectRatio: 2` means "the width is twice the height". The image is as wide as its parent, and its height follows.

Use `https://` addresses. Plain `http://` images are blocked by default in published iOS and Android apps, for security.

## How the image fills its box: resizeMode

When the box and the picture have different shapes, `resizeMode` decides what happens:

```text
cover    fill the whole box, keep the shape, crop the overflow (default)
contain  show the whole picture, keep the shape, leave empty space
stretch  fill the box exactly, squashing the picture if needed
center   center the picture without scaling it up
repeat   tile the picture to fill the box
```

```tsx
// src/components/Avatar.tsx
import { Image } from 'react-native';

export function Avatar({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={{ width: 64, height: 64, borderRadius: 32 }}
    />
  );
}
```

`borderRadius` equal to half the width turns a square image into a circle, a classic profile photo.

### Text on top of a picture: ImageBackground

To place other components **over** an image, use `ImageBackground`. It works like a `View` with a picture behind its children:

```tsx
// src/components/WelcomeBanner.tsx
import { ImageBackground, Text } from 'react-native';

export function WelcomeBanner() {
  return (
    <ImageBackground
      source={{ uri: 'https://picsum.photos/seed/sunrise/800/400' }}
      style={{ height: 160, justifyContent: 'flex-end', padding: 16 }}
      imageStyle={{ borderRadius: 16 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>Good morning, Sam</Text>
    </ImageBackground>
  );
}
```

`imageStyle` styles just the picture (here: rounded corners), while `style` styles the box.

## expo-image: the better default

The core `Image` is fine for simple cases. For real apps, Expo recommends `expo-image`, and the template already uses it. It adds:

- **Reliable caching.** Remote images are saved on disk by default, so they show instantly the next time, even after the app restarts. You control this with `cachePolicy` (`'disk'` is the default; `'memory-disk'`, `'memory'` and `'none'` are the others).
- **Placeholders.** Show a small image, or a blurry preview, while the real one downloads.
- **Transitions.** Fade the image in smoothly instead of it popping in.
- **More formats.** WebP, AVIF, animated GIF and SVG work out of the box.
- **Better performance in lists**, with less flicker when rows are reused.

It also works in Expo Go, so you can use it right away.

### The same image, with expo-image

The API is very close to the core `Image`. Import `Image` from `expo-image` instead:

```tsx
// src/components/QuotePhoto.tsx
import { Image } from 'expo-image';

export function QuotePhoto() {
  return (
    <Image
      source="https://picsum.photos/seed/quote/800/500"
      contentFit="cover"
      transition={300}
      style={{ width: '100%', aspectRatio: 1.6, borderRadius: 16 }}
    />
  );
}
```

What changed:

- `source` can be a plain string URL (the `{ uri }` object and `require(...)` also work).
- `contentFit` replaces `resizeMode`. Its values match the CSS `object-fit` property: `'cover'` (default), `'contain'`, `'fill'`, `'none'` and `'scale-down'`.
- `transition={300}` fades the image in over 300 milliseconds when it loads.
- You still need a size, just like the core `Image`.

### Placeholders while loading

A **placeholder** shows while the real image loads. It can be a local image:

```tsx
// src/components/ProfilePhoto.tsx
import { Image } from 'expo-image';

export function ProfilePhoto({ uri }: { uri: string }) {
  return (
    <Image
      source={uri}
      placeholder={require('@/assets/images/avatar-placeholder.png')}
      placeholderContentFit="cover"
      contentFit="cover"
      transition={200}
      style={{ width: 96, height: 96, borderRadius: 48 }}
    />
  );
}
```

Or it can be a **blurhash**: a short string (about 30 characters) that describes a blurry version of the picture. Image services and tools can generate it for you, and `expo-image` draws it instantly, with no download:

```tsx
// src/components/BlurryPhoto.tsx
import { Image } from 'expo-image';

const blurhash = 'LKO2:N%2Tw=w]~RBVZRi};RPxuwH';

export function BlurryPhoto() {
  return (
    <Image
      source="https://picsum.photos/seed/forest/800/500"
      placeholder={{ blurhash }}
      contentFit="cover"
      transition={400}
      style={{ width: '100%', height: 220 }}
    />
  );
}
```

`placeholderContentFit` matters: the placeholder's default fit is `'scale-down'`, so set it to the same value as `contentFit` if you see the placeholder jump in size.

### Images in lists

When you show images in a long list (you will build one in [Long Lists with FlatList](/courses/react-native/flatlist)), the list **recycles** rows: it reuses a row's view for a new item as you scroll. Give `expo-image` a `recyclingKey` (usually the item's id) so an old picture does not flash in a reused row:

```tsx
// src/components/HabitPhoto.tsx
import { Image } from 'expo-image';

export function HabitPhoto({ id, uri }: { id: string; uri: string }) {
  return <Image source={uri} recyclingKey={id} style={{ width: 56, height: 56, borderRadius: 12 }} />;
}
```

### Loading images early

If you know the user is about to see some images, start downloading them now with `Image.prefetch`. It puts them in the cache, so they appear instantly later:

```ts
// src/lib/prefetch.ts
import { Image } from 'expo-image';

export async function prefetchHeaderImages() {
  await Image.prefetch([
    'https://picsum.photos/seed/morning/1200/600',
    'https://picsum.photos/seed/evening/1200/600',
  ]);
}
```

## Which one should I use?

```text
Simple local icon or logo        either one works
Remote images (photos, avatars)  expo-image (caching, placeholder, fade-in)
Images in long lists             expo-image (recyclingKey, performance)
Text over a picture              ImageBackground (core), or expo-image
                                 behind content with absolute positioning
GIF, SVG, AVIF                   expo-image
```

In HabitHop, use `expo-image` everywhere for consistency. The core `Image` is still worth knowing, because many tutorials and libraries use it.

## Accessible images

Screen readers (the tools blind and low-vision people use to hear the screen) cannot see pictures. For meaningful images, add a short description with `accessibilityLabel` (works on both components; `alt` also works):

```tsx
// src/components/Logo.tsx
import { Image } from 'expo-image';

export function Logo() {
  return (
    <Image
      source={require('@/assets/images/habit-hop-logo.png')}
      accessibilityLabel="HabitHop logo, a green frog"
      style={{ width: 96, height: 96 }}
    />
  );
}
```

Purely decorative images can be hidden from screen readers with `accessible={false}`. More in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

## Common mistakes

**A remote image with no size.** The image is downloaded but drawn at 0 by 0, so nothing appears and there is no error. Add `width` and `height`, or `width` plus `aspectRatio`.

**A wrong path in `require`.** Metro stops with an error like:

```text
Unable to resolve "@/assets/images/habit-hop-logo.png" from "src/app/index.tsx"
```

Check the file name and its case (`Logo.png` is not `logo.png` on case-sensitive systems), and that it is inside `assets/images`.

**Building the require path from a variable.** Metro needs fixed strings. Use an object of fixed `require` calls and pick from it.

**Using `resizeMode` on `expo-image`.** It is called `contentFit` there. Old `resizeMode` code copied from a core `Image` example will not do what you expect, so switch to `contentFit`.

## Quick recap

- Local images: `source={require('@/assets/images/file.png')}` with a fixed path; add `@2x` and `@3x` files for sharp screens.
- Remote images: `source={{ uri: 'https://...' }}`, and **always give them a size** (or an `aspectRatio`).
- `resizeMode` (core) or `contentFit` (expo-image) decides how a picture fills its box; `cover` is the default.
- `ImageBackground` puts content on top of a picture.
- `expo-image` is the better default: disk caching, placeholders (even blurhash), `transition` fade-ins, more formats, `recyclingKey` for lists and `Image.prefetch`.
- Add `accessibilityLabel` to meaningful images. Next: [Getting Text from Users with TextInput](/courses/react-native/text-input).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
// HabitHop home with a local logo (core Image) and a remote banner (expo-image).
import { Image as ExpoImage } from 'expo-image';
import { Image, StyleSheet, Text, View } from 'react-native';
// ---
// A blurry preview string shown while the banner downloads
const blurhash = 'LKO2:N%2Tw=w]~RBVZRi};RPxuwH';
// ---
export default function Index() {
  return (
    &lt;View style={styles.container}&gt;
      {/* Local image: bundled with the app, works offline */}
      &lt;Image
        source={require('@/assets/images/icon.png')}
        style={styles.logo}
        accessibilityLabel="HabitHop logo"
      /&gt;
      &lt;Text style={styles.title}&gt;Good morning, Mia&lt;/Text&gt;
      {/* Remote image: cached on disk, blurry placeholder, fades in */}
      &lt;ExpoImage
        source="https://picsum.photos/seed/habithop/1200/600"
        placeholder={{ blurhash }}
        placeholderContentFit="cover"
        contentFit="cover"
        transition={300}
        style={styles.banner}
        accessibilityLabel="A calm morning landscape"
      /&gt;
      &lt;Text style={styles.caption}&gt;Small habits, one hop at a time.&lt;/Text&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#F5F3FF',
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginTop: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  banner: {
    width: '100%',
    aspectRatio: 2,
    borderRadius: 16,
  },
  caption: {
    color: '#666666',
  },
});
</code></pre>
