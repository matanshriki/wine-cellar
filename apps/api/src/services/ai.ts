import OpenAI from 'openai';
import { config } from '../config.js';
import { Bottle, BottleAnalysis } from '@prisma/client';

const openai = config.openaiApiKey
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : null;

export type ReadinessStatus =
  | 'TooYoung'
  | 'Approaching'
  | 'InWindow'
  | 'Peak'
  | 'PastPeak'
  | 'Unknown';

export interface AnalysisResult {
  readinessStatus: ReadinessStatus;
  drinkFromYear?: number;
  drinkToYear?: number;
  decantMinutes?: number;
  serveTempC?: number;
  explanation: string;
  aiGenerated: boolean;
}

export interface RecommendationContext {
  mealType?: string;
  occasion?: string;
  vibe?: string;
  constraints?: {
    avoidTooYoung?: boolean;
    preferReadyToDrink?: boolean;
    maxPrice?: number;
  };
}

export interface RecommendationResult {
  bottleId: string;
  explanation: string;
  servingInstructions: string;
  score: number;
}

export async function analyzeBottle(bottle: Bottle): Promise<AnalysisResult> {
  if (!openai) {
    return fallbackAnalysis(bottle);
  }

  try {
    const prompt = `Analyze this wine bottle and provide recommendations:

Wine Details:
- Name: ${bottle.name}
- Producer: ${bottle.producer || 'Unknown'}
- Vintage: ${bottle.vintage || 'NV'}
- Region: ${bottle.region || 'Unknown'}
- Grapes: ${bottle.grapes || 'Unknown'}
- Style: ${bottle.style}
- Rating: ${bottle.rating || 'Not rated'}

Provide a JSON response with:
1. readinessStatus: one of "TooYoung", "Approaching", "InWindow", "Peak", "PastPeak", "Unknown"
2. drinkFromYear: earliest recommended year to drink (number)
3. drinkToYear: latest recommended year to drink (number)
4. decantMinutes: recommended decanting time in minutes (0 if not needed)
5. serveTempC: optimal serving temperature in Celsius
6. explanation: 2-3 sentence explanation of your assessment

Respond ONLY with valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a sommelier expert. Provide wine analysis in JSON format only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    return {
      readinessStatus: parsed.readinessStatus || 'Unknown',
      drinkFromYear: parsed.drinkFromYear,
      drinkToYear: parsed.drinkToYear,
      decantMinutes: parsed.decantMinutes,
      serveTempC: parsed.serveTempC,
      explanation: parsed.explanation || 'Analysis completed.',
      aiGenerated: true,
    };
  } catch (error) {
    console.error('AI analysis failed, using fallback:', error);
    return fallbackAnalysis(bottle);
  }
}

function fallbackAnalysis(bottle: Bottle): AnalysisResult {
  const currentYear = new Date().getFullYear();
  const vintage = bottle.vintage || currentYear;
  const age = currentYear - vintage;

  let readinessStatus: ReadinessStatus = 'Unknown';
  let drinkFromYear: number | undefined;
  let drinkToYear: number | undefined;
  let decantMinutes = 0;
  let serveTempC = 16;
  let explanation = '';

  // Heuristics based on style
  switch (bottle.style.toLowerCase()) {
    case 'white':
      serveTempC = 10;
      if (age < 1) {
        readinessStatus = 'InWindow';
        drinkFromYear = vintage;
        drinkToYear = vintage + 3;
        explanation = `Most white wines are best enjoyed young and fresh. This ${vintage} vintage is ready to drink now.`;
      } else if (age <= 3) {
        readinessStatus = 'InWindow';
        drinkFromYear = vintage;
        drinkToYear = vintage + 5;
        explanation = `Still in good drinking window. White wines typically peak within 3-5 years.`;
      } else if (age <= 5) {
        readinessStatus = 'Peak';
        drinkFromYear = vintage;
        drinkToYear = vintage + 7;
        explanation = `Getting mature. Drink soon for best enjoyment.`;
      } else {
        readinessStatus = 'PastPeak';
        explanation = `This white wine may be past its prime. Best consumed soon if stored properly.`;
      }
      break;

    case 'rose':
      serveTempC = 8;
      if (age < 1) {
        readinessStatus = 'InWindow';
        drinkFromYear = vintage;
        drinkToYear = vintage + 2;
        explanation = `Rosé wines are best enjoyed young. This ${vintage} is perfect for immediate consumption.`;
      } else {
        readinessStatus = 'PastPeak';
        drinkFromYear = vintage;
        drinkToYear = vintage + 2;
        explanation = `Rosé is typically best within 1-2 years. Drink soon.`;
      }
      break;

    case 'sparkling':
      serveTempC = 6;
      if (age < 3) {
        readinessStatus = 'InWindow';
        drinkFromYear = vintage || currentYear;
        drinkToYear = (vintage || currentYear) + 5;
        explanation = `Most sparkling wines are ready upon release. Enjoy the freshness and bubbles now.`;
      } else if (age <= 7) {
        readinessStatus = 'Peak';
        explanation = `Vintage sparkling can age well. This is at a good drinking stage.`;
      } else {
        readinessStatus = 'PastPeak';
        explanation = `Older sparkling wine. Best consumed soon.`;
      }
      break;

    case 'red':
    default:
      serveTempC = 16;
      if (age < 2) {
        readinessStatus = 'TooYoung';
        drinkFromYear = vintage + 2;
        drinkToYear = vintage + 10;
        decantMinutes = 60;
        explanation = `Young red wine. Can be enjoyed now with decanting, but will improve with 2-3 years of aging.`;
      } else if (age < 5) {
        readinessStatus = 'Approaching';
        drinkFromYear = vintage + 3;
        drinkToYear = vintage + 12;
        decantMinutes = 45;
        explanation = `This red is approaching its drinking window. Benefits from decanting to open up.`;
      } else if (age <= 10) {
        readinessStatus = 'InWindow';
        drinkFromYear = vintage + 3;
        drinkToYear = vintage + 15;
        decantMinutes = 30;
        explanation = `In prime drinking window. This red has developed complexity while retaining structure.`;
      } else if (age <= 15) {
        readinessStatus = 'Peak';
        drinkFromYear = vintage;
        drinkToYear = vintage + 18;
        decantMinutes = 30;
        explanation = `At peak maturity. Enjoy this well-aged red wine soon for optimal experience.`;
      } else {
        readinessStatus = 'PastPeak';
        drinkFromYear = vintage;
        drinkToYear = vintage + 20;
        decantMinutes = 15;
        explanation = `This red is quite mature. If stored properly, it may still offer enjoyment. Decant gently and drink soon.`;
      }
      break;
  }

  return {
    readinessStatus,
    drinkFromYear,
    drinkToYear,
    decantMinutes,
    serveTempC,
    explanation,
    aiGenerated: false,
  };
}

export async function recommendBottles(
  context: RecommendationContext,
  bottles: (Bottle & { analysis: BottleAnalysis | null })[]
): Promise<RecommendationResult[]> {
  if (!openai || bottles.length === 0) {
    return fallbackRecommendation(context, bottles);
  }

  try {
    const bottlesData = bottles.map((b) => ({
      id: b.id,
      name: b.name,
      producer: b.producer,
      vintage: b.vintage,
      style: b.style,
      region: b.region,
      grapes: b.grapes,
      rating: b.rating,
      quantity: b.quantity,
      readiness: b.analysis?.readinessStatus,
      explanation: b.analysis?.explanation,
    }));

    const prompt = `You are a sommelier. Based on this context, recommend 1-3 bottles from the user's cellar:

Context:
- Meal type: ${context.mealType || 'any'}
- Occasion: ${context.occasion || 'casual'}
- Vibe: ${context.vibe || 'any'}
- Constraints: ${JSON.stringify(context.constraints || {})}

Available bottles:
${JSON.stringify(bottlesData, null, 2)}

Provide a JSON array of recommendations (1-3 bottles). Each recommendation should include:
1. bottleId: the bottle ID from the list
2. explanation: why this bottle is a good match (2-3 sentences)
3. servingInstructions: specific serving advice (temperature, decanting, etc.)
4. score: confidence score 0-100

Respond ONLY with valid JSON array.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a sommelier expert. Provide recommendations in JSON array format only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const recommendations = JSON.parse(content);

    return recommendations.slice(0, 3);
  } catch (error) {
    console.error('AI recommendation failed, using fallback:', error);
    return fallbackRecommendation(context, bottles);
  }
}

function fallbackRecommendation(
  context: RecommendationContext,
  bottles: (Bottle & { analysis: BottleAnalysis | null })[]
): RecommendationResult[] {
  if (bottles.length === 0) {
    return [];
  }

  const scored = bottles
    .filter((b) => b.quantity > 0)
    .map((bottle) => {
      let score = 50; // base score

      // Filter by constraints
      if (context.constraints?.avoidTooYoung) {
        if (bottle.analysis?.readinessStatus === 'TooYoung') {
          score -= 30;
        }
      }

      if (context.constraints?.preferReadyToDrink) {
        if (
          bottle.analysis?.readinessStatus === 'InWindow' ||
          bottle.analysis?.readinessStatus === 'Peak'
        ) {
          score += 20;
        }
      }

      if (
        context.constraints?.maxPrice &&
        bottle.purchasePrice &&
        bottle.purchasePrice > context.constraints.maxPrice
      ) {
        score -= 20;
      }

      // Meal type pairing
      const style = bottle.style.toLowerCase();
      const meal = context.mealType?.toLowerCase() || '';

      if (meal === 'steak') {
        if (style === 'red') score += 25;
        if (style === 'white' || style === 'rose') score -= 10;
      } else if (meal === 'fish') {
        if (style === 'white' || style === 'sparkling') score += 25;
        if (style === 'red') score -= 15;
      } else if (meal === 'pizza' || meal === 'pasta') {
        if (style === 'red' || style === 'white') score += 15;
      } else if (meal === 'spicy_asian') {
        if (style === 'white' || style === 'rose') score += 20;
        if (style === 'red') score -= 5;
      } else if (meal === 'cheese') {
        if (style === 'red' || style === 'white') score += 15;
      }

      // Occasion
      if (context.occasion === 'celebration' || context.occasion === 'date_night') {
        if (bottle.rating && bottle.rating > 85) score += 15;
        if (style === 'sparkling') score += 10;
      }

      // Vibe
      if (context.vibe === 'special' && bottle.rating && bottle.rating > 90) {
        score += 20;
      }

      return { bottle, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map(({ bottle, score }) => {
    const analysis = bottle.analysis;
    let explanation = `${bottle.name} (${bottle.vintage || 'NV'}) - `;
    
    if (context.mealType) {
      explanation += `A good pairing for ${context.mealType}. `;
    }
    
    if (analysis?.readinessStatus) {
      explanation += `This bottle is ${analysis.readinessStatus.toLowerCase()}. `;
    }
    
    explanation += `${bottle.style} wine${bottle.region ? ` from ${bottle.region}` : ''}.`;

    let servingInstructions = `Serve at ${analysis?.serveTempC || 16}°C. `;
    
    if (analysis?.decantMinutes && analysis.decantMinutes > 0) {
      servingInstructions += `Decant for ${analysis.decantMinutes} minutes before serving.`;
    } else {
      servingInstructions += `No decanting needed.`;
    }

    return {
      bottleId: bottle.id,
      explanation,
      servingInstructions,
      score,
    };
  });
}

