import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createBottleSchema, updateBottleSchema } from '../validation/schemas.js';

export const bottlesRouter = Router();

// All routes require authentication
bottlesRouter.use(authenticate);

// Get all bottles for current user
bottlesRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const bottles = await prisma.bottle.findMany({
      where: { userId: req.userId },
      include: {
        analysis: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ bottles });
  } catch (error: any) {
    console.error('Get bottles error:', error);
    return res.status(500).json({ error: 'Failed to fetch bottles' });
  }
});

// Get single bottle
bottlesRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const bottle = await prisma.bottle.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        analysis: true,
      },
    });

    if (!bottle) {
      return res.status(404).json({ error: 'Bottle not found' });
    }

    return res.json({ bottle });
  } catch (error: any) {
    console.error('Get bottle error:', error);
    return res.status(500).json({ error: 'Failed to fetch bottle' });
  }
});

// Create bottle
bottlesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createBottleSchema.parse(req.body);

    const bottle = await prisma.bottle.create({
      data: {
        ...data,
        userId: req.userId!,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      },
      include: {
        analysis: true,
      },
    });

    return res.status(201).json({ bottle });
  } catch (error: any) {
    console.error('Create bottle error:', error);
    return res.status(400).json({ error: error.message || 'Failed to create bottle' });
  }
});

// Update bottle
bottlesRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const data = updateBottleSchema.parse(req.body);

    // Check ownership
    const existing = await prisma.bottle.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Bottle not found' });
    }

    const bottle = await prisma.bottle.update({
      where: { id: req.params.id },
      data: {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      },
      include: {
        analysis: true,
      },
    });

    return res.json({ bottle });
  } catch (error: any) {
    console.error('Update bottle error:', error);
    return res.status(400).json({ error: error.message || 'Failed to update bottle' });
  }
});

// Delete bottle
bottlesRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    // Check ownership
    const existing = await prisma.bottle.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Bottle not found' });
    }

    await prisma.bottle.delete({
      where: { id: req.params.id },
    });

    return res.json({ message: 'Bottle deleted' });
  } catch (error: any) {
    console.error('Delete bottle error:', error);
    return res.status(500).json({ error: 'Failed to delete bottle' });
  }
});

