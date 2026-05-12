import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { analyzeBottle } from '../services/ai.js';

export const analysisRouter = Router();

// ── Legacy route guard ────────────────────────────────────────────────────────
// This router uses Prisma/SQLite + direct OpenAI with NO Sommi credit enforcement.
// It is disabled by default to prevent production use.
// Set LEGACY_ROUTES_ENABLED=true in your local .env if you need it for dev testing.
// Production AI analysis MUST go through supabase/functions/analyze-wine (credit-enforced).
if (process.env.LEGACY_ROUTES_ENABLED !== 'true') {
  analysisRouter.all('*', (_req: Request, res: Response) => {
    res.status(503).json({
      error: 'disabled_in_production',
      message: 'This endpoint is disabled. Use the Supabase Edge Function analyze-wine instead.',
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────

analysisRouter.use(authenticate);

// Trigger analysis for a bottle
analysisRouter.post('/bottles/:bottleId', async (req: AuthRequest, res) => {
  try {
    // Check bottle ownership
    const bottle = await prisma.bottle.findFirst({
      where: {
        id: req.params.bottleId,
        userId: req.userId,
      },
    });

    if (!bottle) {
      return res.status(404).json({ error: 'Bottle not found' });
    }

    // Run analysis
    const result = await analyzeBottle(bottle);

    // Check if analysis already exists
    const existingAnalysis = await prisma.bottleAnalysis.findUnique({
      where: { bottleId: bottle.id },
    });

    let analysis;
    if (existingAnalysis) {
      // Update existing
      analysis = await prisma.bottleAnalysis.update({
        where: { bottleId: bottle.id },
        data: {
          readinessStatus: result.readinessStatus,
          drinkFromYear: result.drinkFromYear,
          drinkToYear: result.drinkToYear,
          decantMinutes: result.decantMinutes,
          serveTempC: result.serveTempC,
          explanation: result.explanation,
          aiGenerated: result.aiGenerated,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new
      analysis = await prisma.bottleAnalysis.create({
        data: {
          bottleId: bottle.id,
          readinessStatus: result.readinessStatus,
          drinkFromYear: result.drinkFromYear,
          drinkToYear: result.drinkToYear,
          decantMinutes: result.decantMinutes,
          serveTempC: result.serveTempC,
          explanation: result.explanation,
          aiGenerated: result.aiGenerated,
        },
      });
    }

    return res.json({ analysis });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze bottle' });
  }
});

// Get analysis for a bottle
analysisRouter.get('/bottles/:bottleId', async (req: AuthRequest, res) => {
  try {
    // Check bottle ownership
    const bottle = await prisma.bottle.findFirst({
      where: {
        id: req.params.bottleId,
        userId: req.userId,
      },
      include: {
        analysis: true,
      },
    });

    if (!bottle) {
      return res.status(404).json({ error: 'Bottle not found' });
    }

    if (!bottle.analysis) {
      return res.status(404).json({ error: 'No analysis found for this bottle' });
    }

    return res.json({ analysis: bottle.analysis });
  } catch (error: any) {
    console.error('Get analysis error:', error);
    return res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

