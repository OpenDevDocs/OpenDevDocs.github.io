---
course: javascript
slug: bigint-and-money-calculations
experienceLevel: senior
difficulty: hard
tags:
  - numbers
  - bigint
  - finance
question: How should you handle money in JavaScript, and where does BigInt fit in?
answer: |
  Never use binary floating point for money. JavaScript's `number` is an IEEE 754 double, which can't represent most decimal fractions exactly: `0.1 + 0.2` is `0.30000000000000004`, and errors accumulate across sums, taxes and currency conversion.

  The standard approach is to store **integer minor units** (cents, pence, or the smallest unit the currency defines) together with the currency code. Integers are exact in a `number` up to `Number.MAX_SAFE_INTEGER` (2^53 - 1, about 9 quadrillion), which is enough for most ledgers. Beyond that, or for high-precision rates and crypto amounts, use **`BigInt`**, which has arbitrary precision.

  BigInt details to know:

  - You can't mix `bigint` and `number` in arithmetic. `1n + 1` throws a `TypeError`, so conversions must be explicit.
  - Division **truncates toward zero** (`7n / 2n` is `3n`). Implement the rounding rule your domain requires (half-up, half-even), and test negative values.
  - `JSON.stringify` throws on BigInt. Serialise amounts as strings and parse them back explicitly.
  - `Math` functions don't accept BigInt, and BigInt arithmetic is slower than number arithmetic.

  Business rules that bite:

  - **Allocation**: splitting 100.00 three ways must produce 33.34, 33.33 and 33.33, not lose a cent. Distribute the remainder deterministically.
  - **Rounding points**: round at the steps the business or regulator defines (per line or per invoice), not wherever the code happens to.
  - **Currency exponents** differ: JPY has 0 decimals, BHD has 3.

  Format only at the edges with `Intl.NumberFormat`, which accepts BigInt directly. For decimal arithmetic with arbitrary scales, use a decimal library (decimal.js, big.js, dinero.js). A native `Decimal` type has been proposed at TC39 but isn't standard.
codeExample: |
  console.log(0.1 + 0.2);                          // Output: 0.30000000000000004

  // Amounts as BigInt minor units (cents)
  const toCents = (str) => {
    const [whole, frac = ''] = str.split('.');
    return BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0').slice(0, 2));
  };

  const subtotal = toCents('19.99') * 3n;          // 5997n
  // 8.25% tax with half-up rounding: multiply by 825, divide by 10000
  const tax = (subtotal * 825n + 5000n) / 10000n;  // division truncates, so add half first
  console.log(subtotal, tax);                      // Output: 5997n 495n

  // Split without losing a cent: hand out the remainder one by one
  function allocate(total, parts) {
    const base = total / parts, remainder = total % parts;
    return Array.from({ length: Number(parts) }, (_, i) => base + (BigInt(i) < remainder ? 1n : 0n));
  }
  console.log(allocate(10000n, 3n));               // Output: [ 3334n, 3333n, 3333n ]

  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const format = (cents) => usd.format(`${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`);
  console.log(format(subtotal + tax));             // Output: $64.92

  try { JSON.stringify({ amount: tax }); } catch (e) { console.log(e.constructor.name); }
  // Output: TypeError
popularity: 7.5
isPublished: true
---
