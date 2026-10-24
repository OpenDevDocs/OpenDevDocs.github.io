---
publishDate: 2026-07-30T19:10
title: Maths for Problem Solving
slug: maths-for-problem-solving
metadescription: The small amount of arithmetic that actually comes up in algorithms, from modular arithmetic and primes to overflow and combinatorics.
updateDate: 2026-09-07T19:10
author: ['bishal-biswas']
level: 2
tags: ['maths', 'number theory', 'algorithms']
course: dsa
---

## Only a little maths is needed

Algorithm work needs surprisingly little mathematics, but the parts it does need come up constantly. This topic covers them.

## Integer division and remainder

```csharp
Console.WriteLine(7 / 2);       // 3, truncated towards zero
Console.WriteLine(7 % 2);       // 1
Console.WriteLine(-7 / 2);      // -3, not -4
Console.WriteLine(-7 % 2);      // -1, not 1
```

The negative cases are the trap. In C#, `%` takes the sign of the **left** operand, so `-7 % 3` is `-1`, not `2`.

That matters whenever you use `%` to wrap an index.

```csharp
int index = -1, length = 5;

Console.WriteLine(index % length);                    // -1, an invalid index
Console.WriteLine(((index % length) + length) % length);   // 4, correct
```

Adding the length before the second `%` is the standard fix, and it appears in every circular buffer.

**Ceiling division** without floating point:

```csharp
static int CeilingDivide(int a, int b) => (a + b - 1) / b;

Console.WriteLine(CeilingDivide(7, 3));    // 3, since 7/3 is 2.33
Console.WriteLine(CeilingDivide(6, 3));    // 2
```

Used constantly for "how many pages", "how many batches", "how many hours".

## Overflow

`int` holds up to about 2.1 billion. Cross that and it wraps around silently.

```csharp
int big = int.MaxValue;

Console.WriteLine(big + 1);            // -2147483648, wrapped around

checked
{
    try { Console.WriteLine(big + 1); }
    catch (OverflowException) { Console.WriteLine("Overflow detected"); }
}
```

Three places this bites in algorithm code.

```csharp
// 1. The midpoint in binary search
int mid = (low + high) / 2;              // overflows for large indexes
int safe = low + (high - low) / 2;       // correct

// 2. Sums
int total = 0;
foreach (int n in largeNumbers) total += n;    // use long

// 3. Products
int product = a * b;                     // use long, or check first
long safeProduct = (long)a * b;          // cast BEFORE multiplying
```

`(long)(a * b)` is too late. The multiplication already happened in `int`. Cast one operand first.

Use `long` by default for sums, counts and products. The extra memory is almost never the problem.

## Modular arithmetic

When results grow enormous, problems ask for the answer modulo a large prime, usually `1_000_000_007`.

The rules:

```text
(a + b) % m = ((a % m) + (b % m)) % m
(a * b) % m = ((a % m) * (b % m)) % m
(a - b) % m = ((a % m) - (b % m) + m) % m      the + m avoids a negative
```

Division does **not** work this way. It needs a modular inverse.

```csharp
const long Modulus = 1_000_000_007;

static long ModAdd(long a, long b) => (a + b) % Modulus;

static long ModMultiply(long a, long b) => a % Modulus * (b % Modulus) % Modulus;

static long ModSubtract(long a, long b) => ((a - b) % Modulus + Modulus) % Modulus;

static long Factorial(int n)
{
    long result = 1;

    for (int i = 2; i <= n; i++) result = ModMultiply(result, i);

    return result;
}

Console.WriteLine(Factorial(20));
```

Applying the modulus at every step keeps values small enough to never overflow a `long`.

## Fast exponentiation

Computing `base^exponent` by multiplying `exponent` times is `O(n)`. Squaring repeatedly is `O(log n)`.

```csharp
static long Power(long baseValue, long exponent, long modulus)
{
    long result = 1;
    baseValue %= modulus;

    while (exponent > 0)
    {
        if ((exponent & 1) == 1) result = result * baseValue % modulus;

        baseValue = baseValue * baseValue % modulus;
        exponent >>= 1;
    }

    return result;
}

Console.WriteLine(Power(2, 10, 1_000_000_007));   // 1024
Console.WriteLine(Power(2, 1_000_000, 1_000_000_007));   // instant
```

Reading the exponent bit by bit is what makes this work. When a bit is set, multiply in the current square. `2^1000000` takes about 20 multiplications.

## Greatest common divisor

Euclid's algorithm, and the oldest algorithm still in daily use.

```csharp
static int Gcd(int a, int b)
{
    while (b != 0) (a, b) = (b, a % b);
    return Math.Abs(a);
}

static long Lcm(int a, int b) => (long)a / Gcd(a, b) * b;   // divide first

Console.WriteLine(Gcd(48, 18));   // 6
Console.WriteLine(Lcm(4, 6));     // 12
```

Dividing before multiplying in `Lcm` is deliberate. `a * b` can overflow while `a / gcd * b` does not.

`O(log(min(a, b)))`, which is remarkably fast.

Used for reducing fractions, finding cycle lengths, and any problem about repeating patterns.

## Prime numbers

**Testing one number:**

```csharp
static bool IsPrime(int n)
{
    if (n < 2) return false;
    if (n < 4) return true;             // 2 and 3
    if (n % 2 == 0) return false;

    for (int i = 3; (long)i * i <= n; i += 2)   // only odd divisors, up to sqrt(n)
    {
        if (n % i == 0) return false;
    }

    return true;
}
```

Only checking up to the square root is the key optimisation. If `n = a * b` and both were above `sqrt(n)`, their product would exceed `n`. So one factor is always at or below the square root.

`(long)i * i <= n` rather than `i <= Math.Sqrt(n)` avoids both floating point and overflow.

**Finding all primes up to n:**

```csharp
static List<int> PrimesUpTo(int limit)
{
    var isComposite = new bool[limit + 1];
    var primes = new List<int>();

    for (int i = 2; i <= limit; i++)
    {
        if (isComposite[i]) continue;

        primes.Add(i);

        for (long multiple = (long)i * i; multiple <= limit; multiple += i)
        {
            isComposite[multiple] = true;
        }
    }

    return primes;
}

Console.WriteLine(string.Join(", ", PrimesUpTo(30)));
// 2, 3, 5, 7, 11, 13, 17, 19, 23, 29
```

The Sieve of Eratosthenes. Starting the inner loop at `i * i` rather than `2 * i` is correct because smaller multiples were already crossed off by smaller primes.

`O(n log log n)`, which is effectively linear.

**Prime factorisation:**

```csharp
static Dictionary<int, int> Factorise(int n)
{
    var factors = new Dictionary<int, int>();

    for (int d = 2; (long)d * d <= n; d++)
    {
        while (n % d == 0)
        {
            factors[d] = factors.GetValueOrDefault(d) + 1;
            n /= d;
        }
    }

    if (n > 1) factors[n] = factors.GetValueOrDefault(n) + 1;   // a leftover prime

    return factors;
}

foreach (var (prime, power) in Factorise(360)) Console.WriteLine($"{prime}^{power}");
// 2^3, 3^2, 5^1
```

The final check matters. After the loop, anything left above 1 is itself prime.

## Combinatorics

**Permutations**, orderings of `k` items from `n`: `n! / (n - k)!`

**Combinations**, choices of `k` items from `n` ignoring order: `n! / (k! * (n - k)!)`

Computing the factorials directly overflows almost immediately. Build it up instead.

```csharp
static long Combinations(int n, int k)
{
    if (k > n - k) k = n - k;        // C(n, k) equals C(n, n-k), pick the smaller

    long result = 1;

    for (int i = 0; i < k; i++)
    {
        result = result * (n - i) / (i + 1);
    }

    return result;
}

Console.WriteLine(Combinations(52, 5));   // 2598960, poker hands
```

Multiplying then dividing in that order keeps every intermediate an exact integer, because the product of `i + 1` consecutive integers is always divisible by `(i + 1)!`.

Pascal's triangle gives the same answers with only addition, which avoids overflow entirely for moderate sizes.

```csharp
static long[,] PascalTriangle(int rows)
{
    var triangle = new long[rows, rows];

    for (int r = 0; r < rows; r++)
    {
        triangle[r, 0] = 1;

        for (int c = 1; c <= r; c++)
        {
            triangle[r, c] = triangle[r - 1, c - 1] + triangle[r - 1, c];
        }
    }

    return triangle;
}
```

## Digits

```csharp
static IEnumerable<int> Digits(int n)
{
    if (n == 0) { yield return 0; yield break; }

    n = Math.Abs(n);

    while (n > 0)
    {
        yield return n % 10;    // rightmost digit
        n /= 10;                // drop it
    }
}

static int DigitSum(int n) => Digits(n).Sum();

static int Reverse(int n)
{
    int result = 0;

    while (n > 0)
    {
        result = result * 10 + n % 10;
        n /= 10;
    }

    return result;
}

Console.WriteLine(DigitSum(12345));   // 15
Console.WriteLine(Reverse(12345));    // 54321
```

`n % 10` and `n /= 10` is the digit extraction pattern. Note it produces digits right to left.

`Reverse` can overflow for large inputs. Use `long` and check the range if it matters.

## Floating point

```csharp
Console.WriteLine(0.1 + 0.2 == 0.3);        // False
Console.WriteLine(0.1 + 0.2);               // 0.30000000000000004

const double Epsilon = 1e-9;
Console.WriteLine(Math.Abs(0.1 + 0.2 - 0.3) < Epsilon);   // True
```

Never compare doubles with `==`. Compare the difference against a small tolerance.

For money, use `decimal`. It is base 10 and represents `0.1` exactly.

```csharp
Console.WriteLine(0.1m + 0.2m == 0.3m);   // True
```

Better still, store money as integer minor units, such as pence or paise, and avoid the question entirely.

## Quick recap

- `%` takes the sign of the left operand, so wrap indexes with `((i % n) + n) % n`.
- `(a + b - 1) / b` is ceiling division without floating point.
- Use `low + (high - low) / 2` and cast to `long` before multiplying.
- Apply the modulus after every operation to keep values small.
- Fast exponentiation reads the exponent bit by bit for `O(log n)`.
- Only test divisors up to the square root, and use the sieve for many primes.
- Never compare doubles with `==`, and use `decimal` for money.

<code id="code-content" class="language-csharp">
// % takes the sign of the LEFT operand. Wrap indexes safely.
int index = -1, length = 5;
Console.WriteLine(((index % length) + length) % length);   // 4, not -1
// Ceiling division with no floating point
static int CeilingDivide(int a, int b) =&gt; (a + b - 1) / b;
Console.WriteLine(CeilingDivide(7, 3));      // 3
// Overflow: cast BEFORE multiplying, not after
int a = 100_000, b = 100_000;
long safe = (long)a * b;                     // correct
Console.WriteLine(safe);                     // 10000000000
// int mid = (low + high) / 2;   overflows. Use low + (high - low) / 2.
// Modular arithmetic: apply the modulus after every step
const long Modulus = 1_000_000_007;
static long ModMultiply(long x, long y) =&gt; x % Modulus * (y % Modulus) % Modulus;
static long Factorial(int n)
{
    long result = 1;
    for (int i = 2; i &lt;= n; i++) result = ModMultiply(result, i);
    return result;
}
Console.WriteLine(Factorial(20));
// Fast exponentiation: read the exponent bit by bit, O(log n)
static long Power(long b, long e, long m)
{
    long result = 1;
    b %= m;
    while (e &gt; 0)
    {
        if ((e &amp; 1) == 1) result = result * b % m;
        b = b * b % m;
        e &gt;&gt;= 1;
    }
    return result;
}
Console.WriteLine(Power(2, 1_000_000, Modulus));   // instant
// Euclid's algorithm. Divide before multiplying in Lcm to avoid overflow.
static int Gcd(int x, int y) { while (y != 0) (x, y) = (y, x % y); return Math.Abs(x); }
static long Lcm(int x, int y) =&gt; (long)x / Gcd(x, y) * y;
Console.WriteLine($"{Gcd(48, 18)} {Lcm(4, 6)}");   // 6 12
// Sieve of Eratosthenes: start the inner loop at i*i, everything below is done
static List&lt;int&gt; PrimesUpTo(int limit)
{
    var composite = new bool[limit + 1];
    var primes = new List&lt;int&gt;();
    for (int i = 2; i &lt;= limit; i++)
    {
        if (composite[i]) continue;
        primes.Add(i);
        for (long m = (long)i * i; m &lt;= limit; m += i) composite[m] = true;
    }
    return primes;
}
Console.WriteLine(string.Join(",", PrimesUpTo(30)));
// Combinations without factorials: multiply then divide keeps it exact
static long Combinations(int n, int k)
{
    if (k &gt; n - k) k = n - k;
    long result = 1;
    for (int i = 0; i &lt; k; i++) result = result * (n - i) / (i + 1);
    return result;
}
Console.WriteLine(Combinations(52, 5));      // 2598960
// Never compare doubles with ==. Use decimal for money.
Console.WriteLine(0.1 + 0.2 == 0.3);         // False
Console.WriteLine(0.1m + 0.2m == 0.3m);      // True
</code></pre>
