#!/bin/bash
# Fix AI Label Art Generation - Complete Setup

set -e
echo "🔧 Fixing AI Label Art Generation"
echo "=================================="
echo ""

cd /Users/matanshr/Desktop/Projects/Playground/wine

# Step 1: Link to correct project
echo "📡 Step 1: Linking to correct Supabase project..."
npx supabase link --project-ref pktelrzyllbwrmcfgocx
echo "✅ Project linked"
echo ""

# Step 2: Check if OpenAI key is set
echo "🔑 Step 2: Checking OpenAI API key..."
echo "Current secrets:"
npx supabase secrets list
echo ""

# If OPENAI_API_KEY is not in the list above, uncomment and run:
# npx supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE

# Step 3: Deploy Edge Function
echo "🚀 Step 3: Deploying Edge Function..."
npx supabase functions deploy generate-label-art
echo "✅ Edge Function deployed"
echo ""

# Step 4: Verify deployment
echo "📋 Step 4: Verifying deployment..."
npx supabase functions list
echo ""

echo "================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Go to Supabase Storage and verify 'generated-labels' bucket exists"
echo "   https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/storage/buckets"
echo ""
echo "2. If bucket is missing, run this SQL:"
echo "   See: fix-storage-bucket.sql"
echo ""
echo "3. Hard refresh your browser (Cmd+Shift+R)"
echo ""
echo "4. Try generating AI label art again!"
echo ""




