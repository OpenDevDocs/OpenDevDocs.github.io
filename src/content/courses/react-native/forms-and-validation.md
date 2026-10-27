---
publishDate: 2026-10-22T21:30
title: Building Forms and Checking Input
slug: forms-and-validation
metadescription: 'Build the HabitHop add habit form in React Native: controlled inputs, emoji and color pickers, friendly validation messages and a clean submit flow.'
updateDate: 2026-10-22T21:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'forms', 'validation', 'habithop']
course: react-native
---

## A form for new habits

Right now HabitHop has three habits baked into the code. Riya wants to track "Practice guitar", Sam wants "No phone after 10". They need a way to add their own. In this lesson you build the **add habit form**:

- a text field for the name
- a row of emojis to pick from
- a row of color swatches from the HabitHop palette
- a "Save habit" button
- friendly error messages when the input is not right

You will put all of this in one reusable component, `HabitForm`, that does not care where the new habit goes. It just hands the values to its parent. That makes it easy to move the form into its own modal screen later in [Modal Screens](/courses/react-native/modal-screens).

This lesson builds on [Getting Text from Users with TextInput](/courses/react-native/text-input) and [State and Props in a Mobile App](/courses/react-native/state-and-props).

## Forms on a phone are different

On the web you have `<form>`, `<input>`, `<select>`, `name` attributes and a submit event. React Native has **none of that**. There is no `<form>` element and no built-in submit. A form is simply:

- some state (one `useState` per field)
- some components that show and change that state (`TextInput`, `Pressable`, `Switch`)
- a function that runs when the user presses your save button

That sounds like more work, but it is actually simpler. There is no hidden browser behavior, and everything is plain React.

## Step 1: a controlled text field

You know this pattern from the TextInput lesson. The text lives in state, and the field shows that state. This is called a **controlled input**:

```tsx
// src/components/HabitForm.tsx (part)
const [name, setName] = useState('');

<TextInput
  value={name}
  onChangeText={setName}
  placeholder="e.g. Drink water"
  maxLength={40}
  style={styles.input}
/>
```

`maxLength={40}` stops the user from typing more than 40 characters. The keyboard simply stops accepting letters. That is the nicest kind of validation: the user cannot even make the mistake.

## Step 2: pickers without a select element

There is no `<select>` in React Native. For a small set of choices, a row of tappable "chips" is better anyway: the user sees all options at once and picks with one tap.

```tsx
// src/components/HabitForm.tsx (part)
const emojis = ['💧', '📚', '🧘', '🏃', '🥗', '😴'];

// inside the component:
const [emoji, setEmoji] = useState(emojis[0]);

<View style={styles.row}>
  {emojis.map((e) => (
    <Pressable key={e} onPress={() => setEmoji(e)} style={[styles.chip, e === emoji && styles.chipActive]}>
      <Text style={styles.chipText}>{e}</Text>
    </Pressable>
  ))}
</View>
```

Each emoji is a [Pressable](/courses/react-native/buttons-and-pressable). Pressing it stores that emoji in state. The style array `[styles.chip, e === emoji && styles.chipActive]` adds the "selected" style only to the chosen one. When the condition is `false`, React Native ignores the `false` in the array.

The color picker works the same way, using the palette from `src/constants/colors.ts`:

```tsx
// src/components/HabitForm.tsx (part)
import { habitColors } from '@/constants/colors';

const [color, setColor] = useState(habitColors[0]);

<View style={styles.row}>
  {habitColors.map((c) => (
    <Pressable
      key={c}
      onPress={() => setColor(c)}
      accessibilityLabel={`Color ${c}`}
      style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchActive]}
    />
  ))}
</View>
```

The swatches are empty circles, so they have no text for a screen reader to announce. `accessibilityLabel` gives each one a name. You will learn more about this in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

Notice that these pickers always have a valid value: there is always a selected emoji and color. Again, the best validation is making mistakes impossible.

## Step 3: the validation rules

The name field is the only one where the user can type something wrong. **Validation** means checking the input against your rules before you accept it. Our rules:

1. The name cannot be empty (spaces only also counts as empty).
2. At least 2 letters.
3. At most 40 letters.
4. No two habits with the same name (ignoring upper and lower case).

Write the rules as a **plain function**, outside the component. It takes the name and returns an error message, or `null` when all is well:

```ts
// src/components/HabitForm.tsx (part)
export function validateName(name: string, existingNames: string[]): string | null {
  const clean = name.trim();
  if (clean.length === 0) return 'Please give your habit a name.';
  if (clean.length < 2) return 'The name needs at least 2 letters.';
  if (clean.length > 40) return 'Keep the name under 40 letters.';
  const taken = existingNames.some((n) => n.toLowerCase() === clean.toLowerCase());
  if (taken) return 'You already have a habit with this name.';
  return null;
}
```

Why a separate function?

- It is easy to read: one rule per line, checked in order, first failure wins.
- It is easy to **test** without rendering anything. You will do that in [Testing with Jest and React Native Testing Library](/courses/react-native/testing).
- `trim()` removes spaces at the start and end, so `"  Read  "` counts as `"Read"`. Users often add a space by accident, especially with autocorrect.

The 40 letter check looks useless next to `maxLength={40}`, but it protects you if the value ever comes from somewhere else, such as pasted text on some keyboards or a future "edit habit" screen. Cheap rules are worth keeping.

## Step 4: when to show the error

Here is a question that makes forms feel good or annoying: **when** should the error appear?

- If you show "Please give your habit a name" the moment the form opens, it scolds the user before they did anything.
- If you only check on save, the user has to press the button to find out.

A friendly middle ground: show errors once the user has **touched** the field. "Touched" means they left the field (the **blur** event, when the field loses focus) or tried to save.

```tsx
// src/components/HabitForm.tsx (part)
const [touched, setTouched] = useState(false);

const error = validateName(name, existingNames);
const showError = touched && error !== null;
```

Notice that `error` is **not** state. It is a **derived value**, calculated from `name` on every render, just like `doneToday` in the HabitCard. Storing it in state would mean keeping two things in sync by hand. Calculating it means it is always right.

Then the field turns red and a message appears below it:

```tsx
// src/components/HabitForm.tsx (part)
<TextInput
  value={name}
  onChangeText={setName}
  onBlur={() => setTouched(true)}
  placeholder="e.g. Drink water"
  maxLength={40}
  style={[styles.input, showError && styles.inputError]}
/>
{showError ? <Text style={styles.error}>{error}</Text> : null}
```

Once touched, the message updates **live** as the user types. Type "R": "The name needs at least 2 letters." Type "e": the message disappears. That instant feedback feels great.

Why `showError ? ... : null` instead of `showError && ...`? In React Native, every piece of text must be inside a `<Text>`. If the left side of `&&` is an empty string or `0`, React Native tries to draw it as text outside a `<Text>` and crashes. Using `? :` with `null` avoids that whole class of bugs. Here `showError` is always a boolean, so `&&` would be safe, but the habit is good.

## Step 5: saving

The save handler marks the form as touched (so errors show even if the user never left the field), stops if there is an error, and otherwise hands the values to the parent:

```tsx
// src/components/HabitForm.tsx (part)
type HabitFormProps = {
  existingNames: string[];
  onSubmit: (values: { name: string; emoji: string; color: string }) => void;
};

// inside the component:
function handleSave() {
  setTouched(true);
  if (error) return; // stop here, the message is now visible
  onSubmit({ name: name.trim(), emoji, color });
  setName(''); // reset the form for the next habit
  setTouched(false);
}
```

- `onSubmit` is a **callback prop**. The form does not know or care what happens to the new habit. That is the parent's job.
- We send the **trimmed** name, so `"  Read "` is saved as `"Read"`.
- After saving we clear the name and reset `touched`, so the empty form does not immediately show "Please give your habit a name".

The complete component, with its styles, is in the code panel.

## Step 6: using the form on the Today screen

The Today screen owns the habit list, so it creates the full `Habit` object. The form only gives `name`, `emoji` and `color`. The screen adds the rest:

```tsx
// src/app/index.tsx (part)
import { HabitForm } from '@/components/HabitForm';

// inside TodayScreen, next to toggleToday:
function addHabit(values: { name: string; emoji: string; color: string }) {
  const newHabit: Habit = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    doneDates: [],
    ...values,
  };
  setHabits((current) => [...current, newHabit]);
}

// in the JSX, below the list:
<HabitForm existingNames={habits.map((h) => h.name)} onSubmit={addHabit} />
```

- `Date.now().toString()` makes a simple unique id from the current time in milliseconds. Good enough for one person tapping a button.
- `new Date().toISOString()` records when the habit was created.
- `...values` copies `name`, `emoji` and `color` in.
- `existingNames` lets the form check for duplicates without knowing about the whole list.

To show the form below the list, pass it to the FlatList as `ListFooterComponent={...}`. That way it scrolls with the list.

Try it. Type "Drink water" (already taken) and press save: the field turns red with "You already have a habit with this name." Change it to "Practice guitar", pick 🏃 and orange, and save. A new orange card appears in the list, and the form is empty and ready again.

You will notice one problem on a real phone: the keyboard can cover the field and the save button. Fixing that is the whole next lesson, [Handling the Keyboard](/courses/react-native/keyboard-handling).

## Numbers and other field types

HabitHop only needs a name, but here is how you would check a number, for example "days per week":

```tsx
// src/components/GoalField.tsx
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

export function GoalField() {
  const [goal, setGoal] = useState('');
  const goalNumber = Number(goal);
  const goalError =
    goal !== '' && (!Number.isInteger(goalNumber) || goalNumber < 1 || goalNumber > 7)
      ? 'Pick a whole number from 1 to 7.'
      : null;

  return (
    <View>
      <TextInput value={goal} onChangeText={setGoal} keyboardType="number-pad" placeholder="Days per week (1 to 7)" maxLength={1} />
      {goalError ? <Text>{goalError}</Text> : null}
    </View>
  );
}
```

`TextInput` always gives you a **string**, even with a number keyboard. Keep the string in state (so the user can clear the field), and convert with `Number()` when you check or save. A `Switch` (see [Switch, ActivityIndicator and Other Handy Components](/courses/react-native/switch-and-activity-indicator)) gives you a boolean and needs no validation at all.

### What about form libraries?

For big forms (sign-up with ten fields, nested data), libraries like React Hook Form and Zod save a lot of typing. They work in React Native too. The React course covers them in [Forms with React Hook Form](/courses/react/forms-with-react-hook-form) and [Form Validation with Zod](/courses/react/form-validation-with-zod). For a small form like ours, plain state is clearer, and you now understand what those libraries do for you.

## Common mistakes

**1. The error shows before the user typed anything.** The form opens with a red "Please give your habit a name." Fix: only show errors when the field is `touched`, as in step 4.

**2. Storing the error in state.** You call `setError(...)` in `onChangeText` and it lags one key behind, or you forget to clear it. Fix: calculate the error from the current value on every render.

**3. Saving untrimmed text.** Users end up with "Read" and "Read " as two different habits, and the duplicate check misses them. Fix: `trim()` when checking and when saving.

**4. Text outside a Text component.** Writing `{name.length && <Text>...</Text>}` crashes when the name is empty, with:

```text
Error: Text strings must be rendered within a <Text> component.
```

Here `name.length` is `0`, and React Native tries to draw that `0`. Fix: use a real boolean (`name.length > 0 && ...`) or `condition ? <Text /> : null`.

## Quick recap

- React Native has no `<form>`. A form is state, inputs that show it, and a save function.
- Use controlled inputs: `value` plus `onChangeText`. Use `maxLength` and chip pickers to make mistakes impossible.
- Put validation rules in a plain function that returns an error message or `null`.
- Calculate the error on every render, and show it once the field is **touched** (blur or save).
- On save: mark as touched, stop on error, pass trimmed values to an `onSubmit` callback prop, then reset the form.
- The parent builds the full `Habit` with `id`, `createdAt` and `doneDates`.

<code id="code-content" class="language-tsx">
// src/components/HabitForm.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { habitColors } from '@/constants/colors';
const emojis = ['💧', '📚', '🧘', '🏃', '🥗', '😴'];
type HabitFormProps = {
  existingNames: string[];
  onSubmit: (values: { name: string; emoji: string; color: string }) =&gt; void;
};
// Returns an error message, or null when the name is fine
export function validateName(name: string, existingNames: string[]): string | null {
  const clean = name.trim();
  if (clean.length === 0) return 'Please give your habit a name.';
  if (clean.length &lt; 2) return 'The name needs at least 2 letters.';
  if (clean.length &gt; 40) return 'Keep the name under 40 letters.';
  const taken = existingNames.some((n) =&gt; n.toLowerCase() === clean.toLowerCase());
  if (taken) return 'You already have a habit with this name.';
  return null;
}
export function HabitForm({ existingNames, onSubmit }: HabitFormProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(emojis[0]);
  const [color, setColor] = useState(habitColors[0]);
  const [touched, setTouched] = useState(false);
  const error = validateName(name, existingNames);
  const showError = touched &amp;&amp; error !== null;
  function handleSave() {
    setTouched(true);
    if (error) return; // stop here, the message is now visible
    onSubmit({ name: name.trim(), emoji, color });
    setName(''); // reset the form for the next habit
    setTouched(false);
  }
  return (
    &lt;View style={styles.form}&gt;
      &lt;Text style={styles.label}&gt;Habit name&lt;/Text&gt;
      &lt;TextInput
        value={name}
        onChangeText={setName}
        onBlur={() =&gt; setTouched(true)}
        placeholder="e.g. Drink water"
        maxLength={40}
        style={[styles.input, showError &amp;&amp; styles.inputError]}
      /&gt;
      {showError ? &lt;Text style={styles.error}&gt;{error}&lt;/Text&gt; : null}
      &lt;Text style={styles.label}&gt;Emoji&lt;/Text&gt;
      &lt;View style={styles.row}&gt;
        {emojis.map((e) =&gt; (
          &lt;Pressable key={e} onPress={() =&gt; setEmoji(e)} style={[styles.chip, e === emoji &amp;&amp; styles.chipActive]}&gt;
            &lt;Text style={styles.chipText}&gt;{e}&lt;/Text&gt;
          &lt;/Pressable&gt;
        ))}
      &lt;/View&gt;
      &lt;Text style={styles.label}&gt;Color&lt;/Text&gt;
      &lt;View style={styles.row}&gt;
        {habitColors.map((c) =&gt; (
          &lt;Pressable key={c} onPress={() =&gt; setColor(c)} accessibilityLabel={`Color ${c}`}
            style={[styles.swatch, { backgroundColor: c }, c === color &amp;&amp; styles.swatchActive]} /&gt;
        ))}
      &lt;/View&gt;
      &lt;Pressable onPress={handleSave} style={[styles.save, { backgroundColor: color }]}&gt;
        &lt;Text style={styles.saveText}&gt;Save habit&lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  form: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 16 },
  inputError: { borderColor: '#DC2626' }, // red border when invalid
  error: { color: '#DC2626', fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  chipActive: { borderColor: '#7C5CFC', backgroundColor: '#EEE9FF' },
  chipText: { fontSize: 22 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchActive: { borderWidth: 3, borderColor: '#111' },
  save: { marginTop: 16, padding: 14, borderRadius: 12, alignItems: 'center' }, saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
</code></pre>
