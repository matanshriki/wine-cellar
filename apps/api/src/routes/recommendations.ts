import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { recommendationRequestSchema } from '../validation/schemas.js';
import { recommendBottles } from '../services/ai.js';

export const recommendationsRouter = Router();

recommendationsRouter.use(authenticate);

// Get recommendations based on context
recommendationsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const context = recommendationRequestSchema.parse(req.body);

    // Get user's bottles with analysis
    const bottles = await prisma.bottle.findMany({
      where: {
        userId: req.userId,
        quantity: { gt: 0 },
      },
      include: {
        analysis: true,
      },
    });

    if (bottles.length === 0) {
      return res.json({
        recommendations: [],
        message: 'No bottles available in your cellar.',
      });
    }

    // Get recommendations
    const recommendations = await recommendBottles(context, bottles);

    // Enrich with full bottle data
    const enriched = recommendations.map((rec) => {
      const bottle = bottles.find((b) => b.id === rec.bottleId);
      return {
        ...rec,
        bottle: bottle
          ? {
              id: bottle.id,
              name: bottle.name,
              producer: bottle.producer,
              vintage: bottle.vintage,
              style: bottle.style,
              region: bottle.region,
              quantity: bottle.quantity,
            }
          : null,
      };
    });

    return res.json({ recommendations: enriched });
  } catch (error: any) {
    console.error('Recommendation error:', error);
    return res.status(400).json({ error: error.message || 'Failed to get recommendations' });
  }
});

