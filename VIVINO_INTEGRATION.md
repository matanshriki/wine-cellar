# 🍷 Vivino Integration Guide

Wine Cellar Brain now supports **seamless import from Vivino**! Since Vivino doesn't provide a public API, we've built smart CSV detection and parsing to import your entire Vivino cellar with just a few clicks.

## 📥 How to Export from Vivino

### Desktop / Web (vivino.com)

1. **Log in to Vivino**
   - Go to https://www.vivino.com
   - Sign in to your account

2. **Access Your Cellar**
   - Click on your profile icon (top right)
   - Select "My wines" or "Cellar"

3. **Export to CSV**
   - Look for the **"Export"** or **"Download"** button
   - Usually found in the top right of your cellar page
   - Click to download your `vivino_wines.csv` file

### Mobile App (iOS/Android)

Unfortunately, the Vivino mobile app doesn't have a direct CSV export feature. You'll need to:

1. Access Vivino from a desktop browser
2. Or use the workaround below

### Alternative: Manual CSV Creation

If you can't find the export button, you can manually create a CSV with this format:

```csv
Wine,Producer,Vintage,Type,Region,Country,Rating,Quantity,Notes
Château Margaux,Château Margaux,2015,Red,Bordeaux,France,4.5,2,Premier Grand Cru
Dom Pérignon,Moët & Chandon,2012,Sparkling,Champagne,France,4.8,1,Vintage champagne
```

## 📤 Import into Wine Cellar Brain

### Step 1: Navigate to Import

1. Open Wine Cellar Brain: http://localhost:5173
2. Go to the **Cellar** page
3. Click **"Import CSV"** button

### Step 2: Upload Vivino CSV

1. Click **"Choose CSV File"**
2. Select your `vivino_wines.csv` file
3. Click **"Next: Map Columns"**

### Step 3: Automatic Vivino Detection

The app will automatically:
- ✅ Detect Vivino CSV format
- ✅ Auto-map all columns
- ✅ Convert ratings from 1-5 to 0-100 scale
- ✅ Normalize wine styles (Red, White, Rosé, Sparkling)
- ✅ Parse all metadata (producer, vintage, region, etc.)

You'll see a **purple banner** confirming Vivino detection!

### Step 4: Review & Import

1. Review the column mapping (already done for you!)
2. Check the preview (first 5 rows)
3. Adjust mapping if needed
4. Click **"Import Bottles"**
5. 🎉 Done! Your Vivino cellar is now in Wine Cellar Brain

## 📊 What Gets Imported

From Vivino CSV, we import:

| Vivino Column | Maps To | Notes |
|---------------|---------|-------|
| Wine / Wine Name | Name | Required |
| Producer / Winery | Producer | Optional |
| Vintage / Year | Vintage | Parsed as number |
| Type / Wine Type | Style | Converted to: red, white, rose, sparkling |
| Region / Appellation | Region | Optional |
| Grapes / Varietal | Grapes | Optional |
| Rating / Vivino Rating | Rating | **Converted from 1-5 to 0-100 scale** |
| Quantity / Bottles | Quantity | Defaults to 1 if not present |
| Notes / Tasting Notes | Notes | Optional |

### Rating Conversion

Vivino uses a 1-5 star rating system. We automatically convert:
- ⭐ 1.0 → 20/100
- ⭐⭐ 2.0 → 40/100
- ⭐⭐⭐ 3.0 → 60/100
- ⭐⭐⭐⭐ 4.0 → 80/100
- ⭐⭐⭐⭐⭐ 5.0 → 100/100

Partial stars work too: 4.5 stars = 90/100

### Style Normalization

We intelligently normalize wine types:
- "Red Wine", "Rouge", "Tinto", "Rosso" → `red`
- "White Wine", "Blanc", "Blanco", "Bianco" → `white`
- "Rosé", "Rosado", "Rosato" → `rose`
- "Sparkling", "Champagne", "Prosecco", "Cava" → `sparkling`

## 🎯 After Import

Once imported, each bottle will:

1. **Appear in your Cellar** - View all bottles from Vivino
2. **Get AI Analysis** - Click "Analyze" on any bottle for readiness status
3. **Show in Recommendations** - Use "What Should I Open Tonight?" feature
4. **Track in History** - Mark bottles as opened and see stats

## 🔄 Syncing Updates

Vivino doesn't provide real-time sync. To update your cellar:

1. Export fresh CSV from Vivino
2. Import again
3. Duplicate detection: Wine Cellar Brain will add as new bottles (we recommend cleaning old ones first or adjusting quantities manually)

**Pro Tip**: Before re-importing, you can delete all bottles and start fresh, or manually update changed bottles.

## 🆚 Vivino vs Wine Cellar Brain

| Feature | Vivino | Wine Cellar Brain |
|---------|--------|-------------------|
| Social features | ✅ Yes | ❌ No |
| Wine discovery | ✅ Yes | ❌ No |
| Cellar management | ✅ Basic | ✅ **Advanced** |
| AI readiness analysis | ❌ No | ✅ **Yes** |
| Smart recommendations | ❌ No | ✅ **Yes (meal/occasion based)** |
| Serving instructions | ❌ No | ✅ **Yes (temp, decanting)** |
| CSV Import/Export | ✅ Yes | ✅ **Yes (auto-detection)** |
| Track opened bottles | ❌ No | ✅ **Yes** |
| Statistics dashboard | ❌ Limited | ✅ **Detailed** |
| Offline usage | ❌ No | ✅ **Yes (after sync)** |

## 🎬 Quick Demo

### Example Vivino CSV

```csv
Wine,Producer,Vintage,Type,Region,Country,Rating,Quantity
Opus One,Opus One Winery,2018,Red,Napa Valley,USA,4.6,1
Cloudy Bay Sauvignon Blanc,Cloudy Bay,2022,White,Marlborough,New Zealand,4.2,3
Whispering Angel,Château d'Esclans,2022,Rosé,Provence,France,3.8,6
```

### After Import

You'll see:
- **Opus One 2018** - Red, Rating: 92/100, Quantity: 1
- **Cloudy Bay 2022** - White, Rating: 84/100, Quantity: 3
- **Whispering Angel 2022** - Rosé, Rating: 76/100, Quantity: 6

Each ready for analysis and recommendations!

## 🐛 Troubleshooting

### "No valid bottles found"
- Ensure CSV has at least `Wine` and `Type` columns
- Check that wine types are spelled correctly (Red, White, Rosé, Sparkling)
- Verify CSV is properly formatted (no extra blank rows)

### "Failed to parse CSV"
- Make sure file is actually a CSV (not Excel .xlsx)
- Try opening in a text editor to verify format
- Re-export from Vivino and try again

### Ratings not showing correctly
- Vivino ratings should be 1-5 scale
- We auto-convert to 0-100
- If your CSV has 0-100 already, we keep it as-is

### Column mapping wrong
- You can manually adjust any column mapping
- Make sure "Name" and "Style" are mapped correctly (required)
- All other fields are optional

## 💡 Pro Tips

1. **Export regularly** - Keep your local cellar in sync with Vivino
2. **Add notes after import** - Enhance bottles with personal tasting notes
3. **Use AI analysis** - Get recommendations Vivino doesn't provide
4. **Track opened bottles** - Feature Vivino lacks
5. **Combine sources** - Import from Vivino + manually add other bottles

## 📞 Support

Having issues with Vivino import?

1. Check that your Vivino CSV is properly formatted
2. Try the manual mapping if auto-detection fails
3. Create an issue on GitHub with your CSV header row (don't share bottle data)

## 🚀 What's Next?

After importing from Vivino, try:

- **Analyze bottles**: Get AI-powered readiness recommendations
- **Tonight flow**: "What should I open tonight?" with smart pairing
- **Track history**: Mark bottles as opened and see your stats
- **Export back to CSV**: Download your enhanced cellar data

---

**Happy importing! 🍷**

Your Vivino collection is now in Wine Cellar Brain with enhanced AI features!

