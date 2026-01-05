#!/bin/bash
# AI Label Art Deployment Setup Script
# Run this with: bash setup-ai-deployment.sh

set -e  # Exit on error

echo "🚀 AI Label Art Deployment Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if npm is installed
echo "📦 Step 1: Checking npm installation..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install Node.js first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found${NC}"
echo ""

# Step 2: Install Supabase CLI via npm
echo "📦 Step 2: Installing Supabase CLI..."
echo "This may take a minute..."
npm install -g supabase
echo -e "${GREEN}✅ Supabase CLI installed${NC}"
echo ""

# Step 3: Verify installation
echo "📦 Step 3: Verifying Supabase CLI..."
if command -v supabase &> /dev/null; then
    VERSION=$(supabase --version)
    echo -e "${GREEN}✅ Supabase CLI installed: $VERSION${NC}"
else
    echo -e "${RED}❌ Supabase CLI installation failed${NC}"
    exit 1
fi
echo ""

# Step 4: Login to Supabase
echo "🔐 Step 4: Login to Supabase..."
echo "This will open your browser for authentication..."
echo ""
read -p "Press ENTER to continue with login, or Ctrl+C to exit: "
supabase login
echo ""

# Step 5: Link project
echo "🔗 Step 5: Linking to your Supabase project..."
echo "You'll need your database password."
echo ""
read -p "Press ENTER to continue with project link, or Ctrl+C to exit: "
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase link --project-ref oktelrzzyllbwrmcfqgocx
echo -e "${GREEN}✅ Project linked${NC}"
echo ""

# Step 6: Set OpenAI API key
echo "🔑 Step 6: Set OpenAI API Key"
echo ""
echo -e "${YELLOW}⚠️  You need an OpenAI API key from: https://platform.openai.com/api-keys${NC}"
echo -e "${YELLOW}⚠️  Billing must be enabled: https://platform.openai.com/account/billing${NC}"
echo ""
read -p "Enter your OpenAI API key (starts with sk-...): " OPENAI_KEY

if [[ ! $OPENAI_KEY =~ ^sk- ]]; then
    echo -e "${RED}❌ Invalid key format. Key should start with 'sk-'${NC}"
    exit 1
fi

echo "Setting OpenAI API key..."
supabase secrets set OPENAI_API_KEY=$OPENAI_KEY
echo -e "${GREEN}✅ OpenAI API key set${NC}"
echo ""

# Step 7: Deploy Edge Function
echo "🚀 Step 7: Deploying Edge Function..."
echo "This may take 30-60 seconds..."
supabase functions deploy generate-label-art
echo -e "${GREEN}✅ Edge Function deployed${NC}"
echo ""

# Success message
echo ""
echo "================================================"
echo -e "${GREEN}🎉 SUCCESS! AI Label Art is deployed!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Hard refresh your browser: Cmd+Shift+R"
echo "2. Click a bottle in your cellar"
echo "3. Click 'Generate Label Art' button"
echo "4. Wait 10-30 seconds for AI to generate"
echo "5. ✨ Enjoy your AI-generated label!"
echo ""
echo "Cost: \$0.04 per image (cached images are free)"
echo ""




