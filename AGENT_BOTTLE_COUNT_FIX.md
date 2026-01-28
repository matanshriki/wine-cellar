# Agent Bottle Count Discrepancy Fix

## Issue
The agent was showing 51 bottles while the cellar view showed 46 bottles, causing confusion about the actual cellar inventory.

## Root Cause
The discrepancy occurred due to different counting methods:

1. **Agent (Before Fix)**: Counted database entries (`bottles.length = 51`)
   - Included ALL bottles in the database, even those with `quantity = 0`
   - These are bottles that were marked as "opened" or "consumed"

2. **Cellar View**: Counted physical bottles (`sum of quantities = 46`)
   - Filtered bottles with `quantity > 0`
   - Summed up the quantities to get total physical bottles

## Solution
Updated three files to ensure consistent bottle counting:

### 1. `apps/web/src/pages/AgentPage.tsx`
- Added filtering to exclude bottles with `quantity = 0` before sending to agent
- Now uses same logic as `CellarPage`: `bottles.filter(bottle => bottle.quantity > 0)`

### 2. `apps/web/src/services/agentService.ts`
- Changed from counting entries (`bottles.length`) to summing quantities
- Now calculates: `bottles.reduce((sum, b) => sum + b.quantity, 0)`
- Applied both in summary text and `totalBottles` field

### 3. `apps/api/src/routes/agent.ts`
- Updated backend API to also count physical bottles instead of entries
- Improved summary message to accurately reflect bottle counts by color

## Result
Both the agent and cellar view now show the same count:
- **46 physical bottles** in your cellar
- Consistent experience across the application
- Agent only recommends from bottles you actually have (quantity > 0)

## Technical Details
- Bottles with `quantity = 0` remain in the database for history/tracking
- These "consumed" bottles are now properly excluded from:
  - Agent recommendations
  - Bottle counts shown to user
  - Cellar context sent to AI

The fix maintains data integrity while ensuring accurate user-facing information.
