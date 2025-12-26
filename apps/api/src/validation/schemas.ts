import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Bottle schemas
export const createBottleSchema = z.object({
  name: z.string().min(1),
  producer: z.string().optional(),
  vintage: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
  region: z.string().optional(),
  grapes: z.string().optional(),
  style: z.enum(['red', 'white', 'rose', 'sparkling']),
  rating: z.number().min(0).max(100).optional(),
  quantity: z.number().int().min(0).default(1),
  purchaseDate: z.string().datetime().optional(),
  purchasePrice: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const updateBottleSchema = createBottleSchema.partial();

// Recommendation schemas
export const recommendationRequestSchema = z.object({
  mealType: z.enum(['pizza', 'steak', 'pasta', 'fish', 'spicy_asian', 'cheese', 'custom']).optional(),
  occasion: z.enum(['casual', 'date_night', 'hosting_friends', 'celebration']).optional(),
  vibe: z.enum(['easy_drinking', 'crowd_pleaser', 'special', 'surprise_me']).optional(),
  constraints: z.object({
    avoidTooYoung: z.boolean().optional(),
    preferReadyToDrink: z.boolean().optional(),
    maxPrice: z.number().optional(),
  }).optional(),
});

// Open event schemas
export const createOpenEventSchema = z.object({
  bottleId: z.string().uuid(),
  mealType: z.string().optional(),
  occasion: z.string().optional(),
  vibe: z.string().optional(),
  constraintsJson: z.string().optional(),
  userRating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

// CSV import schemas
export const csvMappingSchema = z.object({
  nameColumn: z.string(),
  producerColumn: z.string().optional(),
  vintageColumn: z.string().optional(),
  regionColumn: z.string().optional(),
  grapesColumn: z.string().optional(),
  styleColumn: z.string(),
  ratingColumn: z.string().optional(),
  quantityColumn: z.string().optional(),
  notesColumn: z.string().optional(),
});

