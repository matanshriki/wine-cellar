import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { parseCSV, mapCSVToBottles } from '../services/csv.js';
import { detectVivinoFormat, parseVivinoCSV } from '../services/vivino.js';
import { csvMappingSchema } from '../validation/schemas.js';

export const importsRouter = Router();

importsRouter.use(authenticate);

// Parse CSV and return preview with Vivino detection
importsRouter.post('/preview', async (req: AuthRequest, res) => {
  try {
    const { csvText } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'CSV text is required' });
    }

    const preview = parseCSV(csvText);
    
    // Detect if it's a Vivino CSV
    const vivinoDetection = detectVivinoFormat(csvText);

    return res.json({
      ...preview,
      vivino: vivinoDetection,
    });
  } catch (error: any) {
    console.error('CSV preview error:', error);
    return res.status(400).json({ error: error.message || 'Failed to parse CSV' });
  }
});

// Import bottles from CSV (supports both standard and Vivino format)
importsRouter.post('/execute', async (req: AuthRequest, res) => {
  try {
    const { csvText, mapping, isVivino } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'CSV text is required' });
    }

    if (!mapping) {
      return res.status(400).json({ error: 'Column mapping is required' });
    }

    const validatedMapping = csvMappingSchema.parse(mapping);

    // Use Vivino parser if detected, otherwise use standard parser
    let bottlesData;
    if (isVivino) {
      bottlesData = parseVivinoCSV(csvText, validatedMapping);
    } else {
      bottlesData = mapCSVToBottles(csvText, validatedMapping);
    }

    if (bottlesData.length === 0) {
      return res.status(400).json({ error: 'No valid bottles found in CSV' });
    }

    // Import bottles
    const imported = await prisma.bottle.createMany({
      data: bottlesData.map((bottle) => ({
        ...bottle,
        userId: req.userId!,
      })),
    });

    return res.json({
      message: `Successfully imported ${imported.count} bottles${isVivino ? ' from Vivino' : ''}`,
      count: imported.count,
      source: isVivino ? 'vivino' : 'csv',
    });
  } catch (error: any) {
    console.error('CSV import error:', error);
    return res.status(400).json({ error: error.message || 'Failed to import CSV' });
  }
});

