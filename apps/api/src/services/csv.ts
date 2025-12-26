import Papa from 'papaparse';

export interface CSVColumn {
  name: string;
  index: number;
}

export interface CSVPreview {
  headers: string[];
  rows: string[][];
}

export function parseCSV(csvText: string): CSVPreview {
  const result = Papa.parse(csvText, {
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing error: ${result.errors[0].message}`);
  }

  const data = result.data as string[][];
  
  if (data.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = data[0];
  const rows = data.slice(1, 11); // Preview first 10 rows

  return {
    headers,
    rows,
  };
}

export interface CSVMapping {
  nameColumn: string;
  producerColumn?: string;
  vintageColumn?: string;
  regionColumn?: string;
  grapesColumn?: string;
  styleColumn: string;
  ratingColumn?: string;
  quantityColumn?: string;
  notesColumn?: string;
}

export interface BottleImportData {
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  grapes?: string;
  style: string;
  rating?: number;
  quantity: number;
  notes?: string;
}

export function mapCSVToBottles(
  csvText: string,
  mapping: CSVMapping
): BottleImportData[] {
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
        continue; // Skip rows without required fields
      }

      // Normalize style
      let normalizedStyle = style;
      if (style.includes('red') || style === 'rouge') {
        normalizedStyle = 'red';
      } else if (style.includes('white') || style === 'blanc' || style === 'blanco') {
        normalizedStyle = 'white';
      } else if (style.includes('ros') || style === 'rosado') {
        normalizedStyle = 'rose';
      } else if (style.includes('spark') || style.includes('champagne') || style.includes('prosecco') || style === 'cava') {
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
        if (!isNaN(rating) && rating >= 0 && rating <= 100) {
          bottle.rating = rating;
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
      console.error('Error mapping row:', row, error);
      // Continue with next row
    }
  }

  return bottles;
}

