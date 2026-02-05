# Wine Profile Schema

## Database Schema

### Wine Profile JSONB Structure

Stored in `wines.wine_profile`:

```json
{
  "body": 3,              // 1-5: Light to Full
  "tannin": 4,            // 1-5: Low to High
  "acidity": 3,           // 1-5: Low to High
  "oak": 2,               // 1-5: None to Heavy
  "sweetness": 0,         // 0-5: Bone dry to Sweet
  "alcohol_est": 13.5,    // number or null: Estimated ABV
  "power": 7,             // 1-10: Computed intensity score
  "style_tags": [         // Array of descriptive tags
    "full-bodied",
    "bold-tannins",
    "dark-fruit",
    "structured"
  ],
  "confidence": "high",   // low | med | high
  "source": "ai",         // ai | vivino | heuristic
  "updated_at": "2026-02-05T13:00:00Z"
}
```

### Power Calculation

Server-side formula (clamped to 1-10):

```
base = (body * 2) + (tannin * 1.5) + (oak * 1) + (acidity * 0.8) + (sweetness * 0.2)
power = round(clamp(base / 2.0, 1, 10))
```

### Database Columns

**wines table:**
- `wine_profile` - jsonb (nullable) - The profile object
- `wine_profile_updated_at` - timestamptz (nullable) - Last update timestamp
- `wine_profile_source` - text (nullable) - 'ai' | 'vivino' | 'heuristic'
- `wine_profile_confidence` - text (nullable) - 'low' | 'med' | 'high'

**profile_backfill_jobs table:**
- `id` - uuid (pk)
- `user_id` - uuid (fk to auth.users)
- `status` - text - 'running' | 'completed' | 'failed'
- `total` - int - Total wines to process
- `processed` - int - Wines processed so far
- `failed` - int - Wines that failed
- `error_details` - jsonb - Error information
- `created_at` - timestamptz
- `updated_at` - timestamptz (auto-updated)

**profiles table:**
- `is_admin` - boolean (default false) - Admin access flag

## OpenAI Integration

### Structured Output Schema

Use OpenAI's response format with JSON schema to ensure valid JSON:

```typescript
{
  type: "json_schema",
  json_schema: {
    name: "wine_profile",
    strict: true,
    schema: {
      type: "object",
      properties: {
        body: { type: "integer", minimum: 1, maximum: 5 },
        tannin: { type: "integer", minimum: 1, maximum: 5 },
        acidity: { type: "integer", minimum: 1, maximum: 5 },
        oak: { type: "integer", minimum: 1, maximum: 5 },
        sweetness: { type: "integer", minimum: 0, maximum: 5 },
        alcohol_est: { type: ["number", "null"] },
        style_tags: {
          type: "array",
          items: { type: "string" },
          maxItems: 8
        },
        confidence: {
          type: "string",
          enum: ["low", "med", "high"]
        }
      },
      required: ["body", "tannin", "acidity", "oak", "sweetness", "style_tags", "confidence"],
      additionalProperties: false
    }
  }
}
```

## Food Pairing Logic

### Food Profile Structure

```typescript
{
  protein: 'beef' | 'lamb' | 'chicken' | 'fish' | 'veggie',
  fat: 'low' | 'med' | 'high',
  sauce: 'tomato' | 'bbq' | 'creamy' | 'none',
  spice: 'low' | 'med' | 'high',
  smoke: 'low' | 'med' | 'high'
}
```

### Pairing Rules

**High fat + red meat (beef/lamb):**
- Reward: body >= 4, tannin >= 3, acidity >= 3
- Penalty: body < 3

**Tomato sauce:**
- Reward: acidity >= 4, body 2-4, oak < 3
- Penalty: acidity < 3

**Spicy food:**
- Reward: sweetness > 0, body 2-3, tannin < 4
- Penalty: tannin >= 4 AND alcohol_est > 13.5

**Smoky/BBQ:**
- Reward: oak >= 3, body >= 4
- Penalty: oak < 2

**Fish:**
- Reward: body 1-2, acidity >= 4, oak < 3
- Penalty: tannin > 2
