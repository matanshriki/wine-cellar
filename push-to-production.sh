#!/bin/bash
# Push AI Label Art Feature to Production

set -e  # Exit on error

echo "🚀 Deploying AI Label Art to Production"
echo "========================================"
echo ""

# Go to project directory
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Add all changes
echo "📦 Adding all changes..."
git add -A

# Show what will be committed
echo ""
echo "📋 Files to be committed:"
git status --short
echo ""

# Commit
echo "💾 Committing changes..."
git commit -m "feat: AI label art feature - production ready

✨ New Feature: AI-Generated Wine Label Art

FEATURES:
- Per-user AI label art feature flag system
- Edge Function deployed for AI generation (OpenAI DALL-E 3)
- Beautiful gold \"Generate Label Art\" button
- Two styles: Classic and Modern
- Caching system (same prompt = instant result)
- \"AI\" badge on generated images
- Graceful error handling with helpful messages

INFRASTRUCTURE:
- Database migration: ai_label_art_enabled column on profiles
- Supabase Edge Function: generate-label-art
- Storage bucket: generated-labels with RLS policies
- Environment variable: VITE_FEATURE_GENERATED_LABEL_ART

IMPROVEMENTS:
- Fixed React Hooks violation in WineDetailsModal
- Added comprehensive deployment guides
- Enhanced error messages for deployment issues
- Debug logging for feature flag checks
- Mobile-optimized button and interactions

DOCUMENTATION:
- DEPLOY_AI_LABEL_ART.md (comprehensive guide)
- DEPLOY_QUICK_START.md (5-command quick start)
- INSTALL_EVERYTHING.md (installation guide)
- FIX_AI_GENERATION_401.md (troubleshooting)
- DEPLOY_TO_PRODUCTION.md (production deployment)
- setup-ai-deployment.sh (automated setup script)

COST:
- \$0.04 per AI-generated image (1024x1024 DALL-E 3)
- Cached images: Free (no regeneration)
- Feature-flagged per user for cost control

SECURITY:
- OpenAI API key stored server-side only (Supabase secrets)
- User authentication required
- Wine ownership validation
- RLS policies on storage bucket

ACCEPTANCE CRITERIA MET:
✅ Button visible for users with feature enabled
✅ AI generation works end-to-end
✅ Images cached (idempotency via prompt hash)
✅ Mobile-first UX
✅ Error handling with helpful messages
✅ Legal compliance (100% original artwork)
✅ Per-user access control
✅ Production-ready deployment guides

Ready for production deployment to Vercel! 🍷"

# Push to GitHub
echo ""
echo "🌐 Pushing to GitHub..."
git push origin main

echo ""
echo "================================================"
echo "✅ SUCCESS! Code pushed to GitHub!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Vercel will auto-deploy in 2-3 minutes"
echo "2. Set environment variable in Vercel:"
echo "   VITE_FEATURE_GENERATED_LABEL_ART=true"
echo "3. Redeploy from Vercel dashboard"
echo "4. Test on your phone!"
echo ""
echo "Check deployment: https://vercel.com/dashboard"
echo ""


