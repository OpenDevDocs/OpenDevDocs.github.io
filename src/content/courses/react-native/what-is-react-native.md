---
publishDate: 2026-10-21T08:00
title: 'What is React Native? Phone Apps with React'
slug: what-is-react-native
metadescription: 'Learn what React Native is, how it turns React components into real native views, and why Expo is the easiest way to start building phone apps.'
updateDate: 2026-10-21T08:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'mobile', 'expo']
course: react-native
---

## Phone apps, written in React

**React Native** lets you build real apps for iPhone and Android phones using React and JavaScript (or TypeScript). You write components, props, state and hooks, the same ideas you already know from React on the web. React Native then shows them on the phone using the phone's own buttons, text and scroll views.

That last part matters. A React Native app is not a website squeezed into an app. When you write a `<Text>` component, the phone shows a real iOS text view on an iPhone and a real Android text view on an Android phone. Scrolling feels like a normal app because it *is* the normal scrolling of the phone.

In this course you will go from "I have never built a phone app" to "my app is in the stores". This first lesson explains what React Native is, what it is good at, and how the course is laid out.

## One codebase, two (or three) platforms

A **platform** is the system an app runs on. Phones mostly run one of two platforms:

- **iOS**: the system on iPhones and iPads, made by Apple.
- **Android**: the system on most other phones (Samsung, Pixel, Xiaomi and many more), made by Google.

Before React Native, a company that wanted both usually built two separate apps. The iOS app was written in Swift, the Android app in Kotlin. Two teams, two codebases, two sets of bugs.

With React Native you write one set of components and most of your code runs on both. You can still write a little platform-specific code when iOS and Android really need to be different (you will learn how in [Writing Platform-Specific Code](/courses/react-native/platform-specific-code)). The same project can even run in a web browser, which is handy for testing.

Here is a tiny but complete React Native screen:

```tsx
// src/app/index.tsx
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Hello from HabitHop!</Text>
    </View>
  );
}
```

If you know React, you can read this already. It is a function component that returns JSX. The only new things are the components themselves:

- `View` is a box. It is like a `<div>` on the web: it holds other things and can have a background, a border and padding.
- `Text` shows text. On the phone, **all text must be inside a `Text` component**. You cannot put a bare string inside a `View`.
- `style` takes a JavaScript object, not a CSS string. You will learn the details in [Styling with StyleSheet](/courses/react-native/stylesheet-basics).

## What React Native is not

A few things people often mix up:

- **It is not a web view.** Some tools (like Cordova or Capacitor) put a web page inside an app. React Native does not use HTML or the browser to draw your screens. There is no `<div>`, no `<p>`, no CSS files for native screens.
- **It is not a different React.** It uses the very same `react` package you use on the web. Hooks like `useState` and `useEffect` work the same. What changes is the **renderer**, the part of React that turns your components into something on screen. On the web that is `react-dom`. On phones it is React Native.
- **It is not "write once, never think about platforms".** Most code is shared, but phones have real differences: notches, the Android back button, permissions, different keyboards. A good app respects them, and this course shows you how.

If you would like a short side-by-side of what transfers from web React and what does not, the React course has a lesson on it: [React Native: Reusing React Skills on Mobile](/courses/react/react-native-fundamentals).

## Where Expo fits in

You will see the word **Expo** all over this course. Expo is a free and open source set of tools built around React Native. Think of the relationship like this:

- **React Native** is the core: it knows how to turn React components into native views.
- **Expo** is everything around it that makes daily work easy: a project template, a dev server, a router for screens, ready-made libraries for the camera, location, storage and notifications, and cloud services that build and publish your app.

The official React Native website recommends starting with a framework, and Expo is the one it recommends. So in this course you will create apps with Expo from the very first day. You are still writing React Native the whole time. Expo just removes the boring setup.

Here is what one Expo command looks like. You will run it for real in [Creating Your First App with Expo](/courses/react-native/create-your-first-app):

```bash
npx create-expo-app@latest habit-hop
```

## The versions this course uses

Mobile tools move fast, so it helps to know exactly what this course was written for:

```text
Expo SDK         58
React Native     0.88
React            19.3
TypeScript       6
Expo Router      58
Node.js          22.13 or newer (or 24.3 or newer)
```

An **SDK** (Software Development Kit) is a bundle of tools and libraries that are tested together. Each Expo SDK picks one React Native version and a matching version of every Expo library, so they all work together. When you see "SDK 58" in this course, it means all of the above.

Two more facts you will meet later:

- React Native runs your JavaScript with an engine called **Hermes**, which was built for phones.
- React Native uses its **New Architecture**, a faster way for JavaScript and the native side to talk. It is the only architecture now, so there is nothing to switch on. You will see how it works in [How React Native Works Under the Hood](/courses/react-native/how-react-native-works).

## Meet HabitHop, the app you will build

Learning is easier with one real project, so across this course you will build **HabitHop**, a small daily habit tracker. You add habits like "Drink water 💧" or "Read 10 pages 📚", tap a button each day you do them, and HabitHop shows your **streak** (how many days in a row you kept it up).

Here is what a single habit looks like in code. You will write this file yourself in [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics):

```ts
// src/types/habit.ts
export type Habit = {
  id: string;          // e.g. 'h1'
  name: string;        // 'Drink water'
  emoji: string;       // '💧'
  color: string;       // one of the palette colors
  createdAt: string;   // ISO date-time
  doneDates: string[]; // days it was done, as 'YYYY-MM-DD'
};
```

By the end of the course HabitHop will have:

- A **Today** tab with your habits and a "done" button on each one.
- A **Stats** tab and a **Settings** tab.
- A screen to add a new habit, and a details screen for each habit.
- Data saved on the phone, so habits are still there tomorrow.
- A "quote of the day" card loaded from the internet.
- Reminders, haptics (small vibrations), animations and swipe gestures.
- A real build you can send to Google Play and the Apple App Store.

You will not build it all at once. The early lessons use small practice screens and slowly add HabitHop pieces. From the State and Logic section on, you build the real app step by step.

## How the course is laid out

The course has nine sections. Each one builds on the last:

```text
1. Getting Started            what React Native is, setup, your first app
2. Core Components            View, Text, Image, TextInput, lists, modals
3. Styling and Layout         StyleSheet, Flexbox, safe areas, dark mode
4. State and Logic            state, forms, keyboard, context, hooks
5. Navigation (Expo Router)   screens, stacks, tabs, modals, deep links
6. Data and Storage           fetching, caching, AsyncStorage, SQLite
7. Device Features            camera, photos, location, notifications
8. Animations and Gestures    Animated, Reanimated, Gesture Handler
9. Quality and Shipping       debugging, speed, tests, building, publishing
```

## What you need to know first

You should be comfortable with:

- **JavaScript basics**: variables, functions, arrays, objects, `import` and `export`, arrow functions. The [JavaScript course](/courses/javascript/what-is-javascript-history-setup) covers all of it.
- **A little React**: what a component is, JSX, props and `useState`. If those words feel new, read [Components and Functional Components](/courses/react/components-functional-components) and [State and the useState Hook](/courses/react/state-and-usestate-hook) first.

You do **not** need to know anything about iOS, Android, Swift, Kotlin or app stores. You also do not need a Mac to follow most of the course: you can test on your own phone with a free app. When something really needs a Mac (like the iOS simulator), the lesson says so and shows a cloud option.

TypeScript helps but is not required up front. The project uses it, and [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics) teaches the small part you need.

## When React Native is a good choice

React Native is a great fit when:

- You want one team and one codebase for iOS and Android.
- Your team already knows React or JavaScript.
- Your app is mostly screens, lists, forms and data from an API (which is most apps).
- You want to ship fixes fast. Expo can even send small JavaScript updates straight to users, which you will learn in [Shipping Fixes Fast with EAS Update](/courses/react-native/eas-update).

It is a weaker fit when the whole app is heavy 3D graphics (like a big game) or when you need a brand new platform feature on the very day Apple or Google releases it. Even then, React Native lets you mix in native code, so it is rarely a dead end.

Big, well known apps use React Native for many of their screens, so you are learning a tool that is used in real production apps every day.

## Common mistakes

**Putting text directly inside a View.** On the web, `<div>Hello</div>` is fine. In React Native it is not:

```tsx
// Wrong: text outside a Text component
<View>Hello</View>
```

You will see an error like this:

```text
Error: Text strings must be rendered within a <Text> component.
```

The fix is to wrap the text: `<View><Text>Hello</Text></View>`.

**Using HTML tags.** Writing `<div>`, `<span>`, `<p>` or `<img>` in a native screen fails because those tags do not exist on a phone. Use `View`, `Text` and `Image` from `react-native` instead.

**Thinking you must learn Swift or Kotlin first.** You do not. Everything in this course is TypeScript and React. Native code is something you may explore much later, if ever.

## Quick recap

- React Native lets you build iOS and Android apps with React, and it draws real native views, not a web page.
- It uses the same `react` package as the web. Only the renderer and the components (`View`, `Text`, `Image`) are different.
- Expo is the recommended framework around React Native: templates, a dev server, a router, device libraries and build services.
- This course uses Expo SDK 58, React Native 0.88, React 19.3 and TypeScript, with Hermes and the New Architecture.
- You will build **HabitHop**, a daily habit tracker, step by step across the course.
- Next, see [How React Native Works Under the Hood](/courses/react-native/how-react-native-works).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
// Your very first React Native screen: a View (a box) holding Text.
import { StyleSheet, Text, View } from 'react-native';
// ---
export default function Index() {
  return (
    &lt;View style={styles.container}&gt;
      &lt;Text style={styles.logo}&gt;🐸&lt;/Text&gt;
      &lt;Text style={styles.title}&gt;Hello from HabitHop!&lt;/Text&gt;
      &lt;Text style={styles.subtitle}&gt;
        One codebase. Real native views on iOS and Android.
      &lt;/Text&gt;
    &lt;/View&gt;
  );
}
// ---
// Styles are plain JavaScript objects, not CSS files.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F5F3FF',
  },
  logo: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7C5CFC',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    marginTop: 8,
  },
});
</code></pre>
