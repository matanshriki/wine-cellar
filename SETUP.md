# Setup Instructions

## Quick Setup

Since the `.env` file is gitignored, you need to create it manually:

### 1. Create .env file for API

```bash
cat > apps/api/.env << 'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret-change-in-production-12345"
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=""
EOF
```

Or manually create `apps/api/.env` with these contents:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret-change-in-production-12345"
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=""
```

### 2. Install Dependencies (if not already done)

```bash
npm install
```

### 3. Run Database Migration (if not already done)

```bash
cd apps/api
npx prisma migrate dev
npx tsx prisma/seed.ts
cd ../..
```

### 4. Start the Application

```bash
npm run dev
```

This will start:
- **API**: http://localhost:3001
- **Web**: http://localhost:5173

### 5. Login

Use the demo credentials:
- **Email**: demo@winecellarbrain.com
- **Password**: demo123

## Done! 🎉

Your Wine Cellar Brain is now running!

