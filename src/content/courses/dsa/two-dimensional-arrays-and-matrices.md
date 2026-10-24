---
publishDate: 2026-07-04T09:20
title: Two Dimensional Arrays and Matrices
slug: two-dimensional-arrays-and-matrices
metadescription: Work with grids in C# using rectangular and jagged arrays, walk them row by row or column by column, and solve classic matrix problems.
updateDate: 2026-09-07T09:20
author: ['bishal-biswas']
level: 1
tags: ['arrays', 'matrix', 'grids']
course: dsa
---

## Grids everywhere

A game board, a spreadsheet, an image, a maze, a seating plan. All of them are grids, and a grid is a two dimensional array.

C# gives you two kinds, and they are genuinely different.

## Rectangular arrays

Every row has the same length. One comma inside the brackets.

```csharp
int[,] grid = new int[3, 4];      // 3 rows, 4 columns, all zeros

int[,] board =
{
    { 1, 2, 3 },
    { 4, 5, 6 },
    { 7, 8, 9 }
};

Console.WriteLine(board[1, 2]);   // 6, row 1, column 2
board[0, 0] = 99;
```

Sizes come from `GetLength`:

```csharp
Console.WriteLine(board.GetLength(0));   // 3, number of rows
Console.WriteLine(board.GetLength(1));   // 3, number of columns
Console.WriteLine(board.Length);         // 9, total cells
```

Under the hood this is a single flat block of memory. `board[1, 2]` becomes `start + (1 * columns + 2)`, so access is still `O(1)`.

## Jagged arrays

An array of arrays. Each row is its own array and can be a different length.

```csharp
int[][] jagged = new int[3][];
jagged[0] = new int[] { 1, 2 };
jagged[1] = new int[] { 3, 4, 5, 6 };
jagged[2] = new int[] { 7 };

Console.WriteLine(jagged[1][2]);      // 5
Console.WriteLine(jagged.Length);     // 3, number of rows
Console.WriteLine(jagged[1].Length);  // 4, length of row 1
```

Note the syntax difference. Rectangular uses `[1, 2]`, jagged uses `[1][2]`.

Jagged arrays are usually faster in .NET, because each row is a normal array and the runtime optimises those heavily. Rectangular arrays are tidier when every row really is the same length.

## Walking a grid

The standard pattern is a loop inside a loop.

```csharp
int[,] board = { { 1, 2, 3 }, { 4, 5, 6 }, { 7, 8, 9 } };

for (int row = 0; row < board.GetLength(0); row++)
{
    for (int col = 0; col < board.GetLength(1); col++)
    {
        Console.Write($"{board[row, col],3}");
    }
    Console.WriteLine();
}
```

This is `O(rows * cols)`. People often call it `O(n^2)`, which is only accurate for a square grid. If a grid has `r` rows and `c` columns, say `O(r * c)`.

`foreach` also works and visits every cell in row order:

```csharp
foreach (int cell in board) Console.Write(cell + " ");   // 1 2 3 4 5 6 7 8 9
```

## Row order matters for speed

A rectangular array is stored row by row. Walking it in that order reads memory in sequence, which the processor cache loves. Walking column by column jumps around.

```csharp
// Fast: follows the memory layout
for (int row = 0; row < rows; row++)
    for (int col = 0; col < cols; col++)
        total += grid[row, col];

// Slower: jumps a whole row on every step
for (int col = 0; col < cols; col++)
    for (int row = 0; row < rows; row++)
        total += grid[row, col];
```

Same Big O, noticeably different wall clock time on large grids. Keep the row loop on the outside.

## Sum of each row and column

```csharp
static void PrintTotals(int[,] grid)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);

    for (int row = 0; row < rows; row++)
    {
        int total = 0;
        for (int col = 0; col < cols; col++) total += grid[row, col];
        Console.WriteLine($"Row {row} sums to {total}");
    }

    for (int col = 0; col < cols; col++)
    {
        int total = 0;
        for (int row = 0; row < rows; row++) total += grid[row, col];
        Console.WriteLine($"Column {col} sums to {total}");
    }
}
```

## Transposing

Flip rows into columns.

```csharp
static int[,] Transpose(int[,] grid)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);
    var result = new int[cols, rows];      // note the swap

    for (int r = 0; r < rows; r++)
    {
        for (int c = 0; c < cols; c++) result[c, r] = grid[r, c];
    }

    return result;
}
```

## Rotating 90 degrees

A favourite interview question. The trick is that rotating clockwise is transposing, then reversing each row.

```csharp
static void RotateInPlace(int[,] m)
{
    int n = m.GetLength(0);   // square grids only

    // transpose
    for (int r = 0; r < n; r++)
    {
        for (int c = r + 1; c < n; c++)
        {
            (m[r, c], m[c, r]) = (m[c, r], m[r, c]);
        }
    }

    // reverse each row
    for (int r = 0; r < n; r++)
    {
        for (int c = 0; c < n / 2; c++)
        {
            (m[r, c], m[r, n - 1 - c]) = (m[r, n - 1 - c], m[r, c]);
        }
    }
}
```

Starting the inner transpose loop at `r + 1` matters. Starting at 0 would swap every pair twice and leave the grid unchanged.

## Visiting the neighbours

Almost every grid problem needs the cells around a cell. Store the offsets once.

```csharp
static readonly int[] dRow = { -1, 1, 0, 0 };
static readonly int[] dCol = { 0, 0, -1, 1 };

static void VisitNeighbours(int[,] grid, int row, int col)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);

    for (int d = 0; d < 4; d++)
    {
        int r = row + dRow[d];
        int c = col + dCol[d];

        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;   // off the grid

        Console.WriteLine($"Neighbour at [{r},{c}] = {grid[r, c]}");
    }
}
```

Add the four diagonals to the offset arrays when you need all eight neighbours. This pattern powers flood fill, maze solving and Conway's Game of Life.

## Counting a region

A worked example, counting islands of ones in a grid of zeros and ones:

```csharp
static int CountIslands(int[,] grid)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);
    var visited = new bool[rows, cols];
    int islands = 0;

    for (int r = 0; r < rows; r++)
    {
        for (int c = 0; c < cols; c++)
        {
            if (grid[r, c] != 1 || visited[r, c]) continue;

            islands++;
            Flood(grid, visited, r, c);
        }
    }

    return islands;
}

static void Flood(int[,] grid, bool[,] visited, int row, int col)
{
    if (row < 0 || row >= grid.GetLength(0)) return;
    if (col < 0 || col >= grid.GetLength(1)) return;
    if (grid[row, col] != 1 || visited[row, col]) return;

    visited[row, col] = true;

    Flood(grid, visited, row - 1, col);
    Flood(grid, visited, row + 1, col);
    Flood(grid, visited, row, col - 1);
    Flood(grid, visited, row, col + 1);
}
```

## Quick recap

- Rectangular arrays use `[r, c]`, jagged arrays use `[r][c]`.
- Rectangular arrays are one flat block, jagged arrays are an array of arrays.
- Jagged rows can have different lengths and are often faster in .NET.
- Use `GetLength(0)` and `GetLength(1)`, not `Length`, on rectangular arrays.
- Keep the row loop outside for cache friendly access.
- Rotating a square grid is transpose then reverse each row.
- Direction offset arrays make neighbour visiting clean and reusable.

<code id="code-content" class="language-csharp">
// Rectangular: one flat block, fixed row length, indexed with [r, c]
int[,] board = { { 1, 2, 3 }, { 4, 5, 6 }, { 7, 8, 9 } };
Console.WriteLine(board[1, 2]);            // 6
Console.WriteLine(board.GetLength(0));     // 3 rows
Console.WriteLine(board.GetLength(1));     // 3 columns
// Jagged: an array of arrays, rows can differ, indexed with [r][c]
int[][] jagged = { new[] { 1, 2 }, new[] { 3, 4, 5, 6 }, new[] { 7 } };
Console.WriteLine(jagged[1][2]);           // 5
// Walk it: keep the row loop outside so memory is read in order
for (int r = 0; r &lt; board.GetLength(0); r++)
{
    for (int c = 0; c &lt; board.GetLength(1); c++) Console.Write($"{board[r, c],3}");
    Console.WriteLine();
}
// Rotate a square grid 90 degrees: transpose, then reverse each row
static void Rotate(int[,] m)
{
    int n = m.GetLength(0);
    for (int r = 0; r &lt; n; r++)
        for (int c = r + 1; c &lt; n; c++)          // start at r+1 or you swap twice
            (m[r, c], m[c, r]) = (m[c, r], m[r, c]);
    for (int r = 0; r &lt; n; r++)
        for (int c = 0; c &lt; n / 2; c++)
            (m[r, c], m[r, n - 1 - c]) = (m[r, n - 1 - c], m[r, c]);
}
Rotate(board);
Console.WriteLine(board[0, 0]);            // 7
// Neighbours: store the offsets once and reuse them everywhere
int[] dRow = { -1, 1, 0, 0 }, dCol = { 0, 0, -1, 1 };
int row = 1, col = 1;
for (int d = 0; d &lt; 4; d++)
{
    int r = row + dRow[d], c = col + dCol[d];
    if (r &lt; 0 || r &gt;= board.GetLength(0) || c &lt; 0 || c &gt;= board.GetLength(1)) continue;
    Console.WriteLine($"[{r},{c}] = {board[r, c]}");
}
</code></pre>
