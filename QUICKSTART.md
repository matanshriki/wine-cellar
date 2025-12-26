# 🍷 Wine Cellar Brain - Quick Start

## ✅ Application is Running!

Your Wine Cellar Brain MVP is now fully operational:

- **🔧 API Server**: http://localhost:3001
- **🌐 Web App**: http://localhost:5173

## 🎯 Demo Credentials

```
Email: demo@winecellarbrain.com
Password: demo123
```

## 🚀 What's Built

### Core Features
✅ **Cellar Dashboard** - Manage all your wine bottles
✅ **AI Bottle Analysis** - Get readiness status and serving recommendations (with fallback heuristics)
✅ **Tonight Recommendations** - Smart pairing suggestions based on meal/occasion
✅ **🍷 Vivino Import** - Seamlessly import from Vivino with auto-detection
✅ **CSV Import** - Bulk import with intelligent column mapping
✅ **History & Stats** - Track opened bottles and view statistics

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + Prisma
- **Database**: SQLite (with 10 sample bottles pre-loaded)
- **Auth**: JWT cookies
- **AI**: OpenAI integration (optional, currently using fallback heuristics)

## 📝 Pre-loaded Sample Data

The demo account includes 10 premium bottles:
1. Château Margaux 2015 (Bordeaux)
2. Opus One 2018 (Napa Valley)
3. Dom Pérignon 2012 (Champagne)
4. Cloudy Bay Sauvignon Blanc 2022 (NZ)
5. Barolo Riserva 2013 (Piedmont)
6. Penfolds Grange 2016 (Australia)
7. Chablis Grand Cru 2020 (Burgundy)
8. Rioja Gran Reserva 2012 (Spain)
9. Whispering Angel 2022 (Provence)
10. Tignanello 2018 (Tuscany)

Each bottle has AI-generated analysis with readiness status!

## 🎮 Try These Actions

1. **Import from Vivino**: Export your Vivino cellar and import with auto-detection! 🍷
2. **Add a Bottle**: Click "+ Add Bottle" and fill in details manually
3. **Analyze**: Click "Analyze" on any bottle to get serving recommendations
4. **Get Recommendation**: Go to "Tonight?" and answer questions to get pairing suggestions
5. **Mark as Opened**: After getting a recommendation, mark a bottle as opened
6. **View History**: Check your opening history and statistics

## 🍷 Vivino Import

**New!** Import your entire Vivino collection:

1. Export CSV from vivino.com (go to your cellar → Export)
2. Click "Import CSV" in Wine Cellar Brain
3. Upload your Vivino CSV
4. Auto-detection handles everything!
5. Ratings converted from 1-5 to 0-100 scale

See [VIVINO_INTEGRATION.md](./VIVINO_INTEGRATION.md) for detailed guide.

## 📂 CSV Import Example

Download template from the app or use this format:

```csv
name,producer,vintage,region,style,rating,quantity
Sassicaia,Tenuta San Guido,2017,"Tuscany, Italy",red,96,2
```

## 🔧 Important Notes

### Environment Setup
A `.env` file is needed for the API but is gitignored. The servers are currently running with inline environment variables. For persistent setup, create:

```bash
cat > apps/api/.env << 'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret-change-in-production"
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=""
EOF
```

### AI Integration
- Currently running with **fallback heuristics** (no OpenAI API key)
- To enable AI: Add your OpenAI API key to `apps/api/.env`
- Fallback heuristics provide good default recommendations based on wine style, age, and context

### Stopping the Servers
```bash
# Kill API (port 3001)
lsof -ti:3001 | xargs kill -9

# Kill Web (port 5173)
lsof -ti:5173 | xargs kill -9
```

### Restarting
```bash
# From project root
npm run dev
```

Or start individually:
```bash
# API
cd apps/api && DATABASE_URL="file:./dev.db" npm run dev

# Web (in new terminal)
cd apps/web && npm run dev
```

## 📚 Full Documentation

See `README.md` for complete documentation including:
- Full feature list
- Architecture details
- API endpoints
- Deployment guide
- Troubleshooting

## 🎉 Happy Wine Tracking!

Your production-grade Wine Cellar Brain is ready to use. Enjoy managing your collection!

