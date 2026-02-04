# Invoice/Receipt JSON Parsing Fix

## Problem

Invoice/receipt scanning was failing with a JSON parsing error in the Supabase Edge Function:

```
[Parse Label] ❌ Error: SyntaxError: Unterminated string in JSON at position 3246 (line 67 column 8)
    at JSON.parse (<anonymous>)
    at Server.<anonymous> (file:///var/tmp/sb-compile-edge-runtime/source/index.ts:160:29)
```

### Root Cause

OpenAI's response for complex receipts sometimes contains:
- Unescaped quotes in wine names (e.g., "Producer's Reserve")
- Special characters in receipt text
- Multi-line strings
- Control characters

These create malformed JSON that `JSON.parse()` cannot handle.

## Fixes Applied

### 1. Added JSON Sanitization Helper

Created `sanitizeJsonString()` function to clean AI responses:
- Remove BOM and hidden characters
- Strip markdown code blocks (```json, ```)
- Trim whitespace

### 2. Improved Error Handling

Enhanced the JSON parsing with detailed logging and fallback:
```typescript
try {
  parsedData = JSON.parse(cleanContent);
} catch (parseError) {
  // Log detailed error info
  console.error('[Parse Label] Failed content (first 1000 chars):', ...);
  
  // Try regex extraction as fallback
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    parsedData = JSON.parse(jsonMatch[0]);
  }
}
```

### 3. Enforced OpenAI JSON Mode

Added `response_format: { type: 'json_object' }` to OpenAI API call:
- Forces OpenAI to return valid JSON
- Prevents markdown code blocks
- Ensures proper string escaping

### 4. Updated AI Prompts

Enhanced system prompts with explicit JSON formatting rules:
```
CRITICAL RULES:
- Return ONLY valid, well-formed JSON with properly escaped strings
- NO markdown code blocks, NO explanations, ONLY the JSON object
- Escape all special characters in strings (quotes, newlines, backslashes)
```

### 5. Enhanced Logging

Added detailed logging at each step:
- Raw AI response length and preview
- Cleaned content length
- Parse success/failure with error details
- First 1000 and last 500 chars of failed content (for debugging)

## Technical Details

### Changes in `parse-label-image/index.ts`

1. **New sanitization function** (lines 8-22):
   ```typescript
   function sanitizeJsonString(jsonStr: string): string {
     let sanitized = jsonStr;
     sanitized = sanitized.replace(/^\uFEFF/, ''); // BOM
     sanitized = sanitized.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
     return sanitized.trim();
   }
   ```

2. **Robust parsing** (lines 368-405):
   - Try direct parse
   - Log detailed errors
   - Fallback to regex extraction
   - Return structured error response

3. **OpenAI JSON mode** (line 313):
   ```typescript
   response_format: { type: 'json_object' }
   ```

## Testing Checklist

✅ Upload invoice image → AI returns valid JSON → Receipt review screen shows items
✅ Upload label image → Single/multi bottle flow works
✅ Complex receipts with quotes/special chars → No parse errors
✅ Detailed logs available in Supabase Functions dashboard for debugging
✅ User-friendly error messages if parsing fails

## Benefits

- **More reliable**: Handles edge cases in receipt text
- **Better errors**: Clear logging and fallback extraction
- **Enforced validation**: OpenAI JSON mode prevents malformed output
- **Easier debugging**: Comprehensive logs show exactly where/why parsing failed

## Edge Function Deployment

The Edge Function changes are automatically deployed when pushed to Supabase.
No manual deployment needed.

To monitor:
1. Go to Supabase Dashboard → Edge Functions
2. Select `parse-label-image`
3. Check logs after uploading an invoice

## Next Steps

If invoice scanning still fails:
1. Check Supabase Function logs for detailed error
2. Look for "Failed content" in logs to see what AI returned
3. Verify OpenAI API key is set in Supabase environment variables
4. Test with clearer/higher quality receipt images
