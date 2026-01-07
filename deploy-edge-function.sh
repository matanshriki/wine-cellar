#!/bin/bash

# Deploy parse-label-image edge function to Supabase
# Run this script to deploy the edge function after making changes

echo "🚀 Deploying parse-label-image edge function..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    brew install supabase/tap/supabase
fi

# Login to Supabase (if not already logged in)
echo "🔐 Checking Supabase login..."
supabase login

# Deploy the function
echo "📦 Deploying function..."
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase functions deploy parse-label-image

echo "✅ Deployment complete! Wait 1-2 minutes for the function to be live."
echo "🧪 Test by uploading a bottle in your app."

