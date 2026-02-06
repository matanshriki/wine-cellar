# Bottle Count Discrepancy Fix

## Problem
The "Analyze Cellar" modal showed **51 bottles**, but the cellar header showed **44 bottles**.

## Explanation

The discrepancy was caused by counting different things:

### Before Fix
- **Cellar Header (44 bottles)**: Counted physical bottles by summing quantities
  ```tsx
  totalBottleCount = bottles.reduce((sum, bottle) => sum + bottle.quantity, 0)
  ```
  Example: If you have 3 entries with quantities [2, 1, 1], this counts as 4 bottles

- **Analyze Modal (51 bottles)**: Counted ALL wine entries including consumed ones
  ```tsx
  totalBottles={bottles.length}  // Includes bottles with quantity=0
  ```
  Example: 51 unique wine entries in your database (including 7 consumed bottles)

### Why the Gap?
You have **7 consumed wine entries** (bottles you've opened and finished) that still exist in your database with `quantity=0`. These were included in the analyze count but not in the cellar count.

## Fix Applied

Changed the Analyze Modal to use the same count as the header:

```tsx
// Before
totalBottles={bottles.length}  // 51 (includes consumed)

// After  
totalBottles={totalBottleCount}  // 44 (only in-stock quantities)
```

## Result
Now both displays show **44 bottles** consistently - the actual physical bottles you have in your cellar.

The "Unanalyzed" count remains separate and counts unique wine entries (not summing quantities), which is correct for analysis purposes.

## Database State
Your database has:
- **51 unique wine entries** (lifetime)
- **7 consumed entries** (quantity=0)
- **44 in-stock entries** (quantity > 0)
- **44 physical bottles** (sum of quantities)

This is healthy and expected behavior - the app keeps a history of consumed wines.
