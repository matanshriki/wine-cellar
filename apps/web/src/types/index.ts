export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Bottle {
  id: string;
  userId: string;
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  grapes?: string;
  style: 'red' | 'white' | 'rose' | 'sparkling';
  rating?: number;
  quantity: number;
  purchaseDate?: string;
  purchasePrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  analysis?: BottleAnalysis;
}

export type ReadinessStatus =
  | 'TooYoung'
  | 'Approaching'
  | 'InWindow'
  | 'Peak'
  | 'PastPeak'
  | 'Unknown';

export interface BottleAnalysis {
  id: string;
  bottleId: string;
  readinessStatus: ReadinessStatus;
  drinkFromYear?: number;
  drinkToYear?: number;
  decantMinutes?: number;
  serveTempC?: number;
  explanation?: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpenEvent {
  id: string;
  userId: string;
  bottleId: string;
  openedAt: string;
  mealType?: string;
  occasion?: string;
  vibe?: string;
  constraintsJson?: string;
  userRating?: number;
  notes?: string;
  createdAt: string;
  bottle?: {
    id: string;
    name: string;
    producer?: string;
    vintage?: number;
    style: string;
    region?: string;
  };
}

export interface Recommendation {
  bottleId: string;
  explanation: string;
  servingInstructions: string;
  score: number;
  bottle?: {
    id: string;
    name: string;
    producer?: string;
    vintage?: number;
    style: string;
    region?: string;
    quantity: number;
  };
}

export interface Stats {
  totalOpens: number;
  monthlyOpens: Record<string, number>;
  favoriteRegions: Array<{ region: string; count: number }>;
  favoriteStyles: Array<{ style: string; count: number }>;
  averageRating?: number;
}

