---
publishDate: 2026-10-25T02:00
title: Testing with Jest and React Native Testing Library
slug: testing
metadescription: 'Set up jest-expo and React Native Testing Library, then write real tests for HabitHop: date helpers, the reducer, the habits context and HabitCard.'
updateDate: 2026-10-25T02:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'testing', 'jest', 'expo']
course: react-native
---

## Why write tests?

Every time you change HabitHop, something you did not touch might break. Maybe a streak stops counting, or the done button stops working. You could open the app and tap through every screen after every change, but that gets boring fast, and you will forget something.

A **test** is a small piece of code that runs your real code and checks the result. Once written, it runs in a second, as many times as you want. If a test fails, you know right away what broke.

In this lesson you will:

1. Set up **Jest** (the test runner) with the **jest-expo** preset.
2. Test plain functions (`todayKey` and `getStreak`) and the `habitsReducer`.
3. Test `HabitsProvider` and `useHabits()`, including saving to AsyncStorage.
4. Test the `HabitCard` component like a user would, with **React Native Testing Library**.

All the tests and output below were run for real on an Expo SDK 58 project. If you have used Jest before in [the JavaScript course](/courses/javascript/testing-javascript-jest-mocha), much of this will feel familiar.

## The tools

- **Jest** finds your test files, runs them, and prints which passed and which failed. It runs in Node.js on your computer, not on a phone.
- **jest-expo** is a **preset**: a ready-made Jest setup for Expo apps. It knows how to read TypeScript and JSX, and it **mocks** the native parts of Expo and React Native. A **mock** is a fake stand-in. There is no real phone inside Jest, so the preset swaps native modules for simple fakes that behave well enough for tests.
- **React Native Testing Library** (RNTL for short) renders your components in memory and lets you find things the way a user would: by text, by role, by label. It is the React Native cousin of the library you may know from [testing React on the web](/courses/react/testing-react-with-vitest-and-rtl).

## Setting up

Inside your `habit-hop` folder, install the tools as **dev dependencies** (packages you need while building, not inside the app itself):

```bash
npx expo install --dev jest-expo jest
npm install --save-dev @testing-library/react-native test-renderer @jest/globals
```

- `npx expo install --dev` picks the `jest-expo` and `jest` versions that match your Expo SDK.
- `test-renderer` is what RNTL uses under the hood to render components without a phone.
- `@jest/globals` gives you typed `describe`, `it`, `expect` and `jest` that you import at the top of each test file. That way TypeScript knows about them without any extra setup.

HabitHop saves habits with AsyncStorage (from [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage)). AsyncStorage is a native module, and Jest has no phone, so every test that touches it needs a fake. AsyncStorage ships one. Create a **setup file** that Jest runs before every test file:

```js
// jest.setup.js
// Jest has no real phone storage, so every test uses the fake AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
```

Now tell Jest about the preset and the setup file, and add a script. Open `package.json` and add these parts:

```json
{
  "scripts": {
    "test": "jest --watchAll"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFiles": ["./jest.setup.js"]
  }
}
```

Keep everything else in `package.json` as it is. `npm test` now starts Jest in **watch mode**: it reruns the tests every time you save a file. Press `q` to quit. When you want one single run (for example on a build server), use `npx jest`.

## Where test files go

Jest looks for files inside a `__tests__` folder, or files whose names end in `.test.ts(x)` or `-test.ts(x)`. Put tests next to the code they test, in a `__tests__` folder:

```text
src/
  components/
    HabitCard.tsx
    __tests__/
      HabitCard-test.tsx
  context/
    HabitsContext.tsx
    __tests__/
      habitsReducer-test.ts
      HabitsContext-test.tsx
  lib/
    dates.ts
    __tests__/
      dates-test.ts
```

**Never put test files inside `src/app/`.** Expo Router turns every file in `src/app` into a screen (see [How Expo Router Works](/courses/react-native/expo-router-basics)), so a test file there would become a broken route.

## Test 1: plain functions

Start with the easiest kind of test: a function that takes input and returns output. Here is `src/lib/dates.ts` from [State and Props in a Mobile App](/courses/react-native/state-and-props), for reference:

```ts
// src/lib/dates.ts
// Turns a Date into 'YYYY-MM-DD' using the phone's local time zone.
export function todayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Counts how many days in a row the habit was done, ending today.
// If today is not done yet, the streak can still continue from yesterday.
export function getStreak(doneDates: string[]): number {
  const done = new Set(doneDates);
  const day = new Date();
  if (!done.has(todayKey(day))) {
    day.setDate(day.getDate() - 1);
  }
  let streak = 0;
  while (done.has(todayKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

export function isDoneToday(doneDates: string[]): boolean {
  return doneDates.includes(todayKey());
}
```

Remember the rule in `getStreak`: if today is not done yet, the streak still counts from yesterday, so the user does not lose it at breakfast. There is a problem for testing, though: both functions depend on *today*. A test that passes today might fail tomorrow. The fix is **fake timers**: Jest can pretend the clock says any date you want.

```ts
// src/lib/__tests__/dates-test.ts
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getStreak, todayKey } from '@/lib/dates';

describe('dates', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 25, 9, 0)); // 25 October 2026, 9:00
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('todayKey returns YYYY-MM-DD', () => {
    expect(todayKey()).toBe('2026-10-25');
  });

  it('counts days in a row up to today', () => {
    expect(getStreak(['2026-10-23', '2026-10-24', '2026-10-25'])).toBe(3);
  });

  it('stops at the first missed day', () => {
    expect(getStreak(['2026-10-22', '2026-10-24', '2026-10-25'])).toBe(2);
  });

  it('keeps the streak alive when only yesterday is done', () => {
    expect(getStreak(['2026-10-23', '2026-10-24'])).toBe(2);
  });

  it('is 0 when neither today nor yesterday is done', () => {
    expect(getStreak(['2026-10-22'])).toBe(0);
  });
});
```

New words:

- `describe` groups related tests under one name.
- `it` is one test. Its first argument is a sentence that says what should happen.
- `expect(value).toBe(other)` is an **assertion**: a check. If it is false, the test fails.
- `beforeEach` and `afterEach` run before and after every test in the group. Here they turn fake time on and off again. (Months in `new Date(2026, 9, 25)` start at 0, so `9` is October.)

## Test 2: the habits reducer

In [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks) you moved HabitHop's state changes into `habitsReducer`: a plain function that takes the current habits and an action, and returns the new habits. It is exported from `src/context/HabitsContext.tsx`, together with its action type:

```tsx
// src/context/HabitsContext.tsx (part)
export type HabitsAction =
  | { type: 'added'; habit: Habit }
  | { type: 'toggled_today'; id: string }
  | { type: 'deleted'; id: string }
  | { type: 'loaded'; habits: Habit[] } // from the AsyncStorage lesson
  | { type: 'photo_set'; id: string; photoUri: string }; // from the camera lesson

export function habitsReducer(habits: Habit[], action: HabitsAction): Habit[] {
  // ... the switch statement from that lesson
}
```

Because a reducer is a plain function, you test it without rendering anything. You choose the starting list yourself:

```ts
// src/context/__tests__/habitsReducer-test.ts
import { describe, expect, it } from '@jest/globals';
import { habitsReducer } from '@/context/HabitsContext';
import { todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';

const read: Habit = {
  id: 'h2',
  name: 'Read 10 pages',
  emoji: '📚',
  color: '#7C5CFC',
  createdAt: '2026-10-01T08:00:00.000Z',
  doneDates: [],
};

describe('habitsReducer', () => {
  it('adds a habit to the end of the list', () => {
    const result = habitsReducer([], { type: 'added', habit: read });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Read 10 pages');
  });

  it('toggles today on and off', () => {
    const on = habitsReducer([read], { type: 'toggled_today', id: 'h2' });
    expect(on[0].doneDates).toEqual([todayKey()]);

    const off = habitsReducer(on, { type: 'toggled_today', id: 'h2' });
    expect(off[0].doneDates).toEqual([]);
  });

  it('does not change the old array', () => {
    const before = [read];
    habitsReducer(before, { type: 'toggled_today', id: 'h2' });

    expect(before[0].doneDates).toEqual([]);
  });

  it('deletes a habit by id', () => {
    const result = habitsReducer([read], { type: 'deleted', id: 'h2' });

    expect(result).toEqual([]);
  });
});
```

The third test checks the most important reducer rule: it must never change the old array, only return a new one. `toEqual` compares the *contents* of arrays and objects. `toBe` checks that two values are exactly the same thing, which is right for strings and numbers but not for arrays.

## Test 3: the habits context

The reducer test proves the logic. Now check that `HabitsProvider` and `useHabits()` (from [Sharing State with Context](/courses/react-native/context-for-shared-state)) wire everything up, including loading and saving. RNTL's `renderHook` runs a hook inside a tiny test component. The `wrapper` option puts the provider around it:

```tsx
// src/context/__tests__/HabitsContext-test.tsx
import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { HabitsProvider, useHabits } from '@/context/HabitsContext';
import { habitColors } from '@/constants/colors';
import { todayKey } from '@/lib/dates';

function wrapper({ children }: { children: ReactNode }) {
  return <HabitsProvider>{children}</HabitsProvider>;
}

// Render the hook and wait until the saved habits have loaded.
async function renderUseHabits() {
  const hook = await renderHook(() => useHabits(), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
  return hook;
}

describe('useHabits', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('adds a habit to the end of the list', async () => {
    const { result } = await renderUseHabits();
    const startCount = result.current.habits.length;

    await act(() => {
      result.current.addHabit({ name: 'Stretch', emoji: '🧘', color: habitColors[1] });
    });

    expect(result.current.habits).toHaveLength(startCount + 1);
    const added = result.current.habits[startCount];
    expect(added.name).toBe('Stretch');
    expect(added.doneDates).toEqual([]);
  });

  it('toggles today on and off', async () => {
    const { result } = await renderUseHabits();
    await act(() => {
      result.current.addHabit({ name: 'Read', emoji: '📚', color: habitColors[0] });
    });
    const added = result.current.habits[result.current.habits.length - 1];
    const id = added.id;
    const find = () => result.current.habits.find((h) => h.id === id);

    await act(() => {
      result.current.toggleToday(id);
    });
    expect(find()?.doneDates).toEqual([todayKey()]);

    await act(() => {
      result.current.toggleToday(id);
    });
    expect(find()?.doneDates).toEqual([]);
  });

  it('saves habits to AsyncStorage', async () => {
    const { result } = await renderUseHabits();
    await act(() => {
      result.current.addHabit({ name: 'Walk', emoji: '🚶', color: habitColors[2] });
    });

    await waitFor(async () => {
      const saved = await AsyncStorage.getItem('habithop.habits.v1');
      const names = JSON.parse(saved ?? '[]').map((h: { name: string }) => h.name);
      expect(names).toContain('Walk');
    });
  });

  it('deletes a habit', async () => {
    const { result } = await renderUseHabits();
    await act(() => {
      result.current.addHabit({ name: 'Walk', emoji: '🚶', color: habitColors[2] });
    });
    const count = result.current.habits.length;
    const walk = result.current.habits[count - 1];

    await act(() => {
      result.current.deleteHabit(walk.id);
    });
    expect(result.current.habits).toHaveLength(count - 1);
    expect(result.current.habits.some((h) => h.id === walk.id)).toBe(false);
  });
});
```

What is going on:

- `result.current` is whatever the hook returned on its latest render.
- The provider loads saved habits when it starts, so `renderUseHabits` waits with `waitFor` until `isLoaded` is `true`. `waitFor` keeps retrying its check until it passes or times out (after 1 second by default).
- `act` tells React "a state change happens here, finish all updates before moving on". Wrap every call that changes state in `await act(...)`.
- The tests never assume how many habits the list starts with (your provider may add starter habits). They compare with the count before the change, or look a habit up by its id.
- `beforeEach` empties the fake storage, so one test cannot leak data into the next.
- The "saves" test reads the fake AsyncStorage directly, with the same key HabitHop uses.

In React Native Testing Library version 14 (the one that works with React 19), `render`, `renderHook` and `act` are **async**: they return a Promise, so you always `await` them inside an `async` test.

## Test 4: HabitCard, tested like a user

Component tests should act like a person: find things on the screen, press them, and check what happens. They should not poke at internal state. Here is the test for the `HabitCard` from [the accessibility lesson](/courses/react-native/accessibility):

```tsx
// src/components/__tests__/HabitCard-test.tsx
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';
import { HabitCard } from '@/components/HabitCard';
import { todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';

// A fixed test habit: no days done yet
const water: Habit = {
  id: 'h1',
  name: 'Drink water',
  emoji: '💧',
  color: '#0EA5E9',
  createdAt: '2026-10-01T08:00:00.000Z',
  doneDates: [],
};

describe('HabitCard', () => {
  it('shows the habit name and streak', async () => {
    await render(<HabitCard habit={water} onToggle={() => {}} />);

    expect(screen.getByText('Drink water')).toBeOnTheScreen();
    expect(screen.getByText(/0 day streak/)).toBeOnTheScreen();
  });

  it('calls onToggle with the habit id when pressed', async () => {
    const onToggle = jest.fn(); // a fake function that records its calls
    const user = userEvent.setup();
    await render(<HabitCard habit={water} onToggle={onToggle} />);

    // Find the button the way a screen reader user would
    await user.press(screen.getByRole('checkbox', { name: 'Mark Drink water as done today' }));

    expect(onToggle).toHaveBeenCalledWith('h1');
  });

  it('shows as checked when done today', async () => {
    const doneToday = { ...water, doneDates: [todayKey()] };
    await render(<HabitCard habit={doneToday} onToggle={() => {}} />);

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText(/1 day streak/)).toBeOnTheScreen();
  });

  it('calls onPress when the name is pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<HabitCard habit={water} onToggle={() => {}} onPress={onPress} />);

    await user.press(screen.getByText('Drink water'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

What is going on:

- `render` draws the component in memory. `screen` is how you look at what was drawn.
- `getByText('Drink water')` finds an element with exactly that text. If there is none, the test fails with a helpful message.
- `getByText(/0 day streak/)` uses a **regular expression**, so it matches text that *contains* "0 day streak". The real text is "🔥 0 day streak", and this way the test does not care about the emoji.
- `getByRole('checkbox', { name: '...' })` finds an element by its accessibility role and label. This is the best way to find buttons, because it is how a screen reader user finds them. A nice bonus: if someone removes the `accessibilityRole` or `accessibilityLabel` from `HabitCard`, this test fails. Your tests protect your accessibility work.
- `jest.fn()` makes a **mock function**: a fake function that remembers how it was called. `toHaveBeenCalledWith('h1')` checks it got the right id.
- `userEvent.setup()` creates a fake user. `await user.press(...)` presses the element the same way a finger would, running the press in, press and press out events.
- `toBeOnTheScreen()` and `toBeChecked()` are extra **matchers** from RNTL. They load automatically when you import anything from `@testing-library/react-native`.

There are three families of queries:

| Query | When nothing is found | Use it when |
| --- | --- | --- |
| `getBy...` | throws an error | the element must be there now |
| `queryBy...` | returns `null` | you want to check something is *not* there |
| `findBy...` | waits, then throws | the element appears later (after a fetch, say) |

## Running the tests

```bash
npx jest --verbose
```

`--verbose` prints the name of every test. This is the real output for the four test files above:

```text
PASS src/lib/__tests__/dates-test.ts
  dates
    ✓ todayKey returns YYYY-MM-DD (11 ms)
    ✓ counts days in a row up to today (2 ms)
    ✓ stops at the first missed day (1 ms)
    ✓ keeps the streak alive when only yesterday is done (1 ms)
    ✓ is 0 when neither today nor yesterday is done

PASS src/context/__tests__/habitsReducer-test.ts
  habitsReducer
    ✓ adds a habit to the end of the list (6 ms)
    ✓ toggles today on and off (2 ms)
    ✓ does not change the old array
    ✓ deletes a habit by id (1 ms)

PASS src/context/__tests__/HabitsContext-test.tsx
  useHabits
    ✓ adds a habit to the end of the list (27 ms)
    ✓ toggles today on and off (5 ms)
    ✓ saves habits to AsyncStorage (3 ms)
    ✓ deletes a habit (2 ms)

PASS src/components/__tests__/HabitCard-test.tsx
  HabitCard
    ✓ shows the habit name and streak (111 ms)
    ✓ calls onToggle with the habit id when pressed (164 ms)
    ✓ shows as checked when done today (3 ms)
    ✓ calls onPress when the name is pressed (152 ms)

Test Suites: 4 passed, 4 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        2.737 s
Ran all test suites.
```

Without `--verbose` you only see the `PASS` lines and the summary. The order of the files can change between runs. The very first run is slower (up to a minute is normal) because Jest transforms all the code once and then caches it. On Windows the tick may show as `√`.

Now break something on purpose. Change `'Drink water'` in the first HabitCard test to `'Drink Water'` (capital W) and run again:

```text
FAIL src/components/__tests__/HabitCard-test.tsx
  ● HabitCard › shows the habit name and streak

    Unable to find an element with text: Drink Water

    <View>
      ...
        <Text>
          Drink water
        </Text>
      ...
```

RNTL prints the rendered tree, so you can see what *is* on the screen. Very handy.

## What to test, and what not to

- Test the **logic** that matters most: streaks, the reducer, date handling, input checks from [Building Forms and Checking Input](/courses/react-native/forms-and-validation).
- Test **components** through what the user sees and does.
- Do not test that React Native works (for example, that a `Text` shows text).
- Do not test styles or exact layouts with these tests. Jest has no real screen, so it cannot tell you if something looks right.

Native features (camera, notifications, real storage) are mocked or missing in Jest. For flows that need a real phone, people use **end-to-end** tools like Maestro or Detox, which drive a real app on a simulator. That is a bigger topic for after this course.

## Common mistakes

**Forgetting `await` before `render`.** The test fails with:

```text
`render` function has not been called
```

In RNTL 14, `render` is async. Write `await render(...)` inside an `async` test.

**No AsyncStorage mock.** Any test that imports `HabitsContext` (even the reducer test, because the file also imports `storage.ts`) fails before it starts:

```text
[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.
```

Fix: add the `jest.setup.js` file and `"setupFiles"` from the setup section, so every test file gets the fake.

**A test file inside `src/app/`.** Symptom: Expo Router shows a strange extra route, or warns about a missing default export. Fix: move tests to `__tests__` folders outside `src/app`.

**Tests that depend on today's date.** Symptom: tests pass today and fail tomorrow (or right after midnight). Fix: use `jest.useFakeTimers()` and `jest.setSystemTime(...)`, or build dates with `todayKey()` inside the test like the HabitCard test does.

## Quick recap

- Install with `npx expo install --dev jest-expo jest` and `npm install --save-dev @testing-library/react-native test-renderer @jest/globals`, then set `"preset": "jest-expo"` and a `setupFiles` entry that mocks AsyncStorage.
- Put tests in `__tests__` folders, never in `src/app`.
- Test plain functions and reducers directly. Use fake timers for anything date-based.
- Use `renderHook` with a `wrapper`, `act` and `waitFor` to test the context.
- Use `await render`, `screen.getByRole`, `getByText` and `userEvent` to test components like a user.
- In RNTL 14, `render`, `renderHook` and `act` are async: always `await` them.

With tests in place, you can ship with confidence. The next section starts with [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash).

<code id="code-content" class="language-tsx">
// src/components/__tests__/HabitCard-test.tsx
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';
import { HabitCard } from '@/components/HabitCard';
import { todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
// A fixed test habit: no days done yet
const water: Habit = {
  id: 'h1',
  name: 'Drink water',
  emoji: '💧',
  color: '#0EA5E9',
  createdAt: '2026-10-01T08:00:00.000Z',
  doneDates: [],
};
describe('HabitCard', () =&gt; {
  it('shows the habit name and streak', async () =&gt; {
    await render(&lt;HabitCard habit={water} onToggle={() =&gt; {}} /&gt;);
    expect(screen.getByText('Drink water')).toBeOnTheScreen();
    expect(screen.getByText(/0 day streak/)).toBeOnTheScreen();
  });
  it('calls onToggle with the habit id when pressed', async () =&gt; {
    const onToggle = jest.fn(); // a fake function that records its calls
    const user = userEvent.setup();
    await render(&lt;HabitCard habit={water} onToggle={onToggle} /&gt;);
    // Find the button the way a screen reader user would
    await user.press(screen.getByRole('checkbox', { name: 'Mark Drink water as done today' }));
    expect(onToggle).toHaveBeenCalledWith('h1');
  });
  it('shows as checked when done today', async () =&gt; {
    const doneToday = { ...water, doneDates: [todayKey()] };
    await render(&lt;HabitCard habit={doneToday} onToggle={() =&gt; {}} /&gt;);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText(/1 day streak/)).toBeOnTheScreen();
  });
  it('calls onPress when the name is pressed', async () =&gt; {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(&lt;HabitCard habit={water} onToggle={() =&gt; {}} onPress={onPress} /&gt;);
    await user.press(screen.getByText('Drink water'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
</code></pre>
