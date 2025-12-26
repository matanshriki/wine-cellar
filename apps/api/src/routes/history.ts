import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createOpenEventSchema } from '../validation/schemas.js';

export const historyRouter = Router();

historyRouter.use(authenticate);

// Get all open events for user
historyRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const events = await prisma.openEvent.findMany({
      where: { userId: req.userId },
      include: {
        bottle: {
          select: {
            id: true,
            name: true,
            producer: true,
            vintage: true,
            style: true,
            region: true,
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    return res.json({ events });
  } catch (error: any) {
    console.error('Get history error:', error);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Create open event (mark bottle as opened)
historyRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createOpenEventSchema.parse(req.body);

    // Check bottle ownership and quantity
    const bottle = await prisma.bottle.findFirst({
      where: {
        id: data.bottleId,
        userId: req.userId,
      },
    });

    if (!bottle) {
      return res.status(404).json({ error: 'Bottle not found' });
    }

    if (bottle.quantity <= 0) {
      return res.status(400).json({ error: 'No bottles available to open' });
    }

    // Create event and decrement quantity in transaction
    const [event] = await prisma.$transaction([
      prisma.openEvent.create({
        data: {
          userId: req.userId!,
          bottleId: data.bottleId,
          mealType: data.mealType,
          occasion: data.occasion,
          vibe: data.vibe,
          constraintsJson: data.constraintsJson,
          userRating: data.userRating,
          notes: data.notes,
        },
        include: {
          bottle: {
            select: {
              id: true,
              name: true,
              producer: true,
              vintage: true,
              style: true,
              region: true,
            },
          },
        },
      }),
      prisma.bottle.update({
        where: { id: data.bottleId },
        data: { quantity: { decrement: 1 } },
      }),
    ]);

    return res.status(201).json({ event });
  } catch (error: any) {
    console.error('Create open event error:', error);
    return res.status(400).json({ error: error.message || 'Failed to create open event' });
  }
});

// Get statistics
historyRouter.get('/stats', async (req: AuthRequest, res) => {
  try {
    const events = await prisma.openEvent.findMany({
      where: { userId: req.userId },
      include: {
        bottle: true,
      },
    });

    // Opens per month (last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    
    const monthlyOpens = events
      .filter((e) => e.openedAt >= twelveMonthsAgo)
      .reduce((acc, event) => {
        const month = event.openedAt.toISOString().substring(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Favorite regions
    const regionCounts = events.reduce((acc, event) => {
      const region = event.bottle.region || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const favoriteRegions = Object.entries(regionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([region, count]) => ({ region, count }));

    // Favorite styles
    const styleCounts = events.reduce((acc, event) => {
      const style = event.bottle.style;
      acc[style] = (acc[style] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const favoriteStyles = Object.entries(styleCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([style, count]) => ({ style, count }));

    // Average rating
    const ratingsEvents = events.filter((e) => e.userRating !== null);
    const averageRating =
      ratingsEvents.length > 0
        ? ratingsEvents.reduce((sum, e) => sum + (e.userRating || 0), 0) / ratingsEvents.length
        : null;

    return res.json({
      totalOpens: events.length,
      monthlyOpens,
      favoriteRegions,
      favoriteStyles,
      averageRating,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

