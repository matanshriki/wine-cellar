import Papa from 'papaparse';
import { BottleImportData } from './csv.js';

/**
 * Vivino CSV format detection and parsing
 * 
 * Vivino exports CSVs with columns like:
 * - Wine, Vintage, Type, Rating, Region, Country, Price, Notes, etc.
 */

export interface VivinoDetectionResult {
  isVivinoFormat: boolean;
  confidence: number;
  suggestedMapping?: {
    nameColumn: string;
    styleColumn: string;
    producerColumn?: string;
    vintageColumn?: string;
    regionColumn?: string;
    ratingColumn?: string;
    quantityColumn?: string;
    notesColumn?: string;
  };
}

/**
 * Detect if CSV is in Vivino format
 */
export function detectVivinoFormat(csvText: string): VivinoDetectionResult {
  try {
    const result = Papa.parse(csvText, {
      preview: 1,
      skipEmptyLines: true,
    });

    if (result.errors.length > 0 || !result.data || result.data.length === 0) {
      return { isVivinoFormat: false, confidence: 0 };
    }

    const headers = (result.data[0] as string[]).map((h) => h.toLowerCase().trim());

    // Vivino-specific header patterns
    const vivinoIndicators = {
      wine: headers.some((h) => h === 'wine' || h === 'wine name'),
      vintage: headers.some((h) => h === 'vintage' || h === 'year'),
      type: headers.some((h) => h === 'type' || h === 'wine type' || h === 'color'),
      rating: headers.some((h) => h.includes('rating') || h.includes('vivino')),
      region: headers.some((h) => h === 'region' || h === 'appellation'),
      country: headers.some((h) => h === 'country'),
    };

    // Calculate confidence score
    const indicators = Object.values(vivinoIndicators);
    const matchCount = indicators.filter((v) => v).length;
    const confidence = matchCount / indicators.length;

    const isVivinoFormat = confidence >= 0.5; // At least 50% match

    if (!isVivinoFormat) {
      return { isVivinoFormat: false, confidence };
    }

    // Create suggested mapping
    const originalHeaders = result.data[0] as string[];
    const suggestedMapping: any = {};

    // Map columns
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const originalHeader = originalHeaders[i];

      if (header === 'wine' || header === 'wine name') {
        suggestedMapping.nameColumn = originalHeader;
      } else if (header === 'producer' || header === 'winery') {
        suggestedMapping.producerColumn = originalHeader;
      } else if (header === 'vintage' || header === 'year') {
        suggestedMapping.vintageColumn = originalHeader;
      } else if (
        header === 'region' ||
        header === 'appellation' ||
        header === 'wine region'
      ) {
        suggestedMapping.regionColumn = originalHeader;
      } else if (header === 'grapes' || header === 'grape' || header === 'varietal') {
        suggestedMapping.grapesColumn = originalHeader;
      } else if (header === 'type' || header === 'wine type' || header === 'color') {
        suggestedMapping.styleColumn = originalHeader;
      } else if (
        header === 'rating' ||
        header === 'vivino rating' ||
        header === 'score'
      ) {
        suggestedMapping.ratingColumn = originalHeader;
      } else if (
        header === 'quantity' ||
        header === 'qty' ||
        header === 'bottles' ||
        header === 'count'
      ) {
        suggestedMapping.quantityColumn = originalHeader;
      } else if (
        header === 'note' ||
        header === 'notes' ||
        header === 'tasting notes' ||
        header === 'description'
      ) {
        suggestedMapping.notesColumn = originalHeader;
      }
    }

    return {
      isVivinoFormat: true,
      confidence,
      suggestedMapping,
    };
  } catch (error) {
    return { isVivinoFormat: false, confidence: 0 };
  }
}

/**
 * Parse Vivino CSV with smart defaults
 * Vivino ratings are typically 1-5, we convert to 0-100 scale
 */
export function parseVivinoCSV(csvText: string, mapping: any): BottleImportData[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing error: ${result.errors[0].message}`);
  }

  const data = result.data as Record<string, string>[];
  const bottles: BottleImportData[] = [];

  for (const row of data) {
    try {
      const name = row[mapping.nameColumn]?.trim();
      const style = row[mapping.styleColumn]?.trim().toLowerCase();

      if (!name || !style) {
        continue;
      }

      // Normalize style
      let normalizedStyle = style;
      if (
        style.includes('red') ||
        style === 'rouge' ||
        style === 'tinto' ||
        style === 'rosso'
      ) {
        normalizedStyle = 'red';
      } else if (
        style.includes('white') ||
        style === 'blanc' ||
        style === 'blanco' ||
        style === 'bianco'
      ) {
        normalizedStyle = 'white';
      } else if (style.includes('ros') || style === 'rosado' || style === 'rosato') {
        normalizedStyle = 'rose';
      } else if (
        style.includes('spark') ||
        style.includes('champagne') ||
        style.includes('prosecco') ||
        style === 'cava' ||
        style.includes('cremant')
      ) {
        normalizedStyle = 'sparkling';
      } else if (!['red', 'white', 'rose', 'sparkling'].includes(normalizedStyle)) {
        normalizedStyle = 'red'; // default fallback
      }

      const bottle: BottleImportData = {
        name,
        style: normalizedStyle,
        quantity: 1,
      };

      if (mapping.producerColumn && row[mapping.producerColumn]) {
        bottle.producer = row[mapping.producerColumn].trim();
      }

      if (mapping.vintageColumn && row[mapping.vintageColumn]) {
        const vintageStr = row[mapping.vintageColumn].trim();
        const vintage = parseInt(vintageStr, 10);
        if (!isNaN(vintage) && vintage >= 1800 && vintage <= new Date().getFullYear() + 1) {
          bottle.vintage = vintage;
        }
      }

      if (mapping.regionColumn && row[mapping.regionColumn]) {
        bottle.region = row[mapping.regionColumn].trim();
      }

      if (mapping.grapesColumn && row[mapping.grapesColumn]) {
        bottle.grapes = row[mapping.grapesColumn].trim();
      }

      if (mapping.ratingColumn && row[mapping.ratingColumn]) {
        const ratingStr = row[mapping.ratingColumn].trim();
        const rating = parseFloat(ratingStr);

        if (!isNaN(rating)) {
          // Vivino uses 1-5 scale, convert to 0-100
          if (rating <= 5) {
            bottle.rating = rating * 20; // 5 stars = 100
          } else if (rating <= 100) {
            bottle.rating = rating; // Already 0-100 scale
          }
        }
      }

      if (mapping.quantityColumn && row[mapping.quantityColumn]) {
        const quantityStr = row[mapping.quantityColumn].trim();
        const quantity = parseInt(quantityStr, 10);
        if (!isNaN(quantity) && quantity >= 0) {
          bottle.quantity = quantity;
        }
      }

      if (mapping.notesColumn && row[mapping.notesColumn]) {
        bottle.notes = row[mapping.notesColumn].trim();
      }

      bottles.push(bottle);
    } catch (error) {
      console.error('Error parsing Vivino row:', row, error);
      continue;
    }
  }

  return bottles;
}

