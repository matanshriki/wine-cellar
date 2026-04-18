/**
 * Wine Data Hebrew Translations
 *
 * Static dictionaries for translating wine-related data (countries, regions,
 * grape varieties) into Hebrew.  These cover the most common values encountered
 * in wine databases.  For wine names and producers (proper nouns) we fall back
 * to the stored AI-generated translation when available, or to the original
 * Latin-script text.
 */

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const COUNTRY_HE: Record<string, string> = {
  'France': 'צרפת',
  'Italy': 'איטליה',
  'Spain': 'ספרד',
  'Portugal': 'פורטוגל',
  'Germany': 'גרמניה',
  'Austria': 'אוסטריה',
  'Greece': 'יוון',
  'United States': 'ארצות הברית',
  'USA': 'ארצות הברית',
  'US': 'ארצות הברית',
  'Argentina': 'ארגנטינה',
  'Chile': 'צ\'ילה',
  'Australia': 'אוסטרליה',
  'New Zealand': 'ניו זילנד',
  'South Africa': 'דרום אפריקה',
  'Israel': 'ישראל',
  'Lebanon': 'לבנון',
  'Hungary': 'הונגריה',
  'Romania': 'רומניה',
  'Georgia': 'גאורגיה',
  'Moldova': 'מולדובה',
  'Croatia': 'קרואטיה',
  'Slovenia': 'סלובניה',
  'Switzerland': 'שוויץ',
  'Canada': 'קנדה',
  'Brazil': 'ברזיל',
  'Uruguay': 'אורוגוואי',
  'Mexico': 'מקסיקו',
  'Turkey': 'טורקיה',
  'Bulgaria': 'בולגריה',
  'England': 'אנגליה',
  'United Kingdom': 'בריטניה',
  'UK': 'בריטניה',
  'China': 'סין',
  'Japan': 'יפן',
  'India': 'הודו',
};

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

const REGION_HE: Record<string, string> = {
  // France
  'Bordeaux': 'בורדו',
  'Burgundy': 'בורגונדי',
  'Bourgogne': 'בורגונדי',
  'Champagne': 'שמפניה',
  'Rhône': 'רון',
  'Rhone': 'רון',
  'Northern Rhône': 'רון הצפוני',
  'Southern Rhône': 'רון הדרומי',
  'Loire': 'לואר',
  'Loire Valley': 'עמק הלואר',
  'Alsace': 'אלזס',
  'Provence': 'פרובנס',
  'Languedoc': 'לנגדוק',
  'Languedoc-Roussillon': 'לנגדוק-רוסיון',
  'Roussillon': 'רוסיון',
  'Beaujolais': 'בוז\'ולה',
  'Jura': 'ז\'ורה',
  'Corsica': 'קורסיקה',
  'Sud-Ouest': 'דרום-מערב',
  'Southwest France': 'דרום-מערב צרפת',

  // Italy
  'Tuscany': 'טוסקנה',
  'Toscana': 'טוסקנה',
  'Piedmont': 'פיימונטה',
  'Piemonte': 'פיימונטה',
  'Veneto': 'ונטו',
  'Sicily': 'סיציליה',
  'Sicilia': 'סיציליה',
  'Sardinia': 'סרדיניה',
  'Sardegna': 'סרדיניה',
  'Lombardy': 'לומברדיה',
  'Lombardia': 'לומברדיה',
  'Puglia': 'פוליה',
  'Campania': 'קמפניה',
  'Abruzzo': 'אברוצו',
  'Friuli-Venezia Giulia': 'פריולי-ונציה ג\'וליה',
  'Friuli': 'פריולי',
  'Trentino-Alto Adige': 'טרנטינו-אלטו אדיג\'ה',
  'Emilia-Romagna': 'אמיליה-רומאניה',
  'Umbria': 'אומבריה',
  'Marche': 'מארקה',
  'Liguria': 'ליגוריה',
  'Basilicata': 'בזיליקטה',
  'Calabria': 'קלבריה',

  // Spain
  'Rioja': 'ריוחה',
  'Ribera del Duero': 'ריברה דל דוארו',
  'Priorat': 'פריוראט',
  'Penedès': 'פנדס',
  'Penedes': 'פנדס',
  'Galicia': 'גליסיה',
  'Rías Baixas': 'ריאס באישאס',
  'Jerez': 'חרס',
  'Navarra': 'נאווארה',
  'Catalonia': 'קטלוניה',
  'Catalunya': 'קטלוניה',
  'Castilla y León': 'קסטיליה ולאון',
  'Castilla-La Mancha': 'קסטיליה-לה מנצ\'ה',

  // USA
  'California': 'קליפורניה',
  'Napa Valley': 'עמק נאפה',
  'Napa': 'נאפה',
  'Sonoma': 'סונומה',
  'Sonoma County': 'מחוז סונומה',
  'Oregon': 'אורגון',
  'Washington': 'וושינגטון',
  'Washington State': 'מדינת וושינגטון',
  'Willamette Valley': 'עמק וילאמט',
  'Paso Robles': 'פאסו רובלס',
  'Central Coast': 'החוף המרכזי',
  'Santa Barbara': 'סנטה ברברה',
  'Mendocino': 'מנדוסינו',

  // Argentina
  'Mendoza': 'מנדוזה',
  'Patagonia': 'פטגוניה',
  'Salta': 'סלטה',

  // Chile
  'Maipo Valley': 'עמק מאיפו',
  'Colchagua Valley': 'עמק קולצ\'אגואה',
  'Casablanca Valley': 'עמק קזבלנקה',
  'Central Valley': 'העמק המרכזי',

  // Australia
  'Barossa Valley': 'עמק ברוסה',
  'Barossa': 'ברוסה',
  'McLaren Vale': 'מקלארן וייל',
  'Hunter Valley': 'עמק הנטר',
  'Margaret River': 'מרגרט ריבר',
  'Yarra Valley': 'עמק יארה',
  'Coonawarra': 'קונוורה',
  'Adelaide Hills': 'גבעות אדלייד',
  'Clare Valley': 'עמק קלייר',
  'Eden Valley': 'עמק עדן',
  'Tasmania': 'טסמניה',

  // New Zealand
  'Marlborough': 'מרלבורו',
  'Hawke\'s Bay': 'מפרץ הוקס',
  'Central Otago': 'מרכז אוטגו',

  // South Africa
  'Stellenbosch': 'סטלנבוש',
  'Franschhoek': 'פרנשוק',
  'Paarl': 'פארל',
  'Swartland': 'סוורטלנד',
  'Constantia': 'קונסטנטיה',
  'Western Cape': 'הכף המערבי',

  // Germany
  'Mosel': 'מוזל',
  'Rheingau': 'ריינגאו',
  'Pfalz': 'פאלץ',
  'Baden': 'באדן',
  'Rheinhessen': 'ריינהסן',
  'Nahe': 'נאהה',
  'Franken': 'פרנקן',

  // Austria
  'Wachau': 'ואכאו',
  'Burgenland': 'בורגנלנד',
  'Kamptal': 'קמפטל',
  'Kremstal': 'קרמסטל',

  // Portugal
  'Douro': 'דואורו',
  'Alentejo': 'אלנטז\'ו',
  'Dão': 'דאו',
  'Vinho Verde': 'וינו ורדה',
  'Porto': 'פורטו',

  // Israel
  'Galilee': 'גליל',
  'Upper Galilee': 'גליל עליון',
  'Lower Galilee': 'גליל תחתון',
  'Golan Heights': 'רמת הגולן',
  'Golan': 'גולן',
  'Judean Hills': 'הרי יהודה',
  'Negev': 'נגב',
  'Samson': 'שמשון',
  'Shomron': 'שומרון',
  'Carmel': 'כרמל',
  'Jerusalem Hills': 'הרי ירושלים',

  // Greece
  'Santorini': 'סנטוריני',
  'Macedonia': 'מקדוניה',
  'Peloponnese': 'פלופונס',
  'Crete': 'כרתים',
};

// ---------------------------------------------------------------------------
// Grape Varieties
// ---------------------------------------------------------------------------

const GRAPE_HE: Record<string, string> = {
  // Red
  'Cabernet Sauvignon': 'קברנה סוביניון',
  'Merlot': 'מרלו',
  'Pinot Noir': 'פינו נואר',
  'Syrah': 'סירה',
  'Shiraz': 'שיראז',
  'Grenache': 'גרנאש',
  'Tempranillo': 'טמפרניו',
  'Sangiovese': 'סנג\'ובזה',
  'Nebbiolo': 'נביולו',
  'Malbec': 'מלבק',
  'Zinfandel': 'זינפנדל',
  'Barbera': 'ברברה',
  'Mourvèdre': 'מורבדר',
  'Mourvedre': 'מורבדר',
  'Petit Verdot': 'פטי ורדו',
  'Cabernet Franc': 'קברנה פראן',
  'Carmenère': 'קרמנר',
  'Carmenere': 'קרמנר',
  'Pinotage': 'פינוטאז\'',
  'Carignan': 'קריניאן',
  'Primitivo': 'פרימיטיבו',
  'Montepulciano': 'מונטפולצ\'אנו',
  'Nero d\'Avola': 'נרו ד\'אבולה',
  'Aglianico': 'אליאניקו',
  'Dolcetto': 'דולצ\'טו',
  'Corvina': 'קורבינה',
  'Touriga Nacional': 'טוריגה נסיונל',
  'Petite Sirah': 'פטיט סירה',
  'Gamay': 'גמאי',
  'Cinsault': 'סנסו',
  'Tannat': 'טאנא',
  'Graciano': 'גרסיאנו',
  'Mencía': 'מנסיה',
  'Mencia': 'מנסיה',
  'Xinomavro': 'קסינומברו',
  'Blaufränkisch': 'בלאופרנקיש',
  'Blaufrankisch': 'בלאופרנקיש',
  'Zweigelt': 'צוויגלט',
  'Bonarda': 'בונרדה',

  // White
  'Chardonnay': 'שרדונה',
  'Sauvignon Blanc': 'סוביניון בלאן',
  'Riesling': 'ריזלינג',
  'Pinot Grigio': 'פינו גריג\'ו',
  'Pinot Gris': 'פינו גרי',
  'Gewürztraminer': 'גוורצטרמינר',
  'Gewurztraminer': 'גוורצטרמינר',
  'Viognier': 'ויונייה',
  'Chenin Blanc': 'שנין בלאן',
  'Sémillon': 'סמיון',
  'Semillon': 'סמיון',
  'Moscato': 'מוסקטו',
  'Muscat': 'מוסקט',
  'Grüner Veltliner': 'גרינר ולטלינר',
  'Gruner Veltliner': 'גרינר ולטלינר',
  'Vermentino': 'ורמנטינו',
  'Albariño': 'אלברינו',
  'Albarino': 'אלברינו',
  'Trebbiano': 'טרביאנו',
  'Garganega': 'גרגנגה',
  'Fiano': 'פיאנו',
  'Greco': 'גרקו',
  'Verdejo': 'ורדחו',
  'Torrontés': 'טורונטס',
  'Torrontes': 'טורונטס',
  'Marsanne': 'מרסאן',
  'Roussanne': 'רוסאן',
  'Godello': 'גודלו',
  'Assyrtiko': 'אסירטיקו',
  'Furmint': 'פורמינט',
  'Melon de Bourgogne': 'מלון דה בורגונדי',
  'Colombard': 'קולומברד',
  'Pecorino': 'פקורינו',
  'Verdicchio': 'ורדיקיו',
  'Arneis': 'ארנייס',
  'Cortese': 'קורטזה',
  'Malvasia': 'מלוזיה',
  'Müller-Thurgau': 'מולר-טורגאו',
  'Muller-Thurgau': 'מולר-טורגאו',
  'Silvaner': 'סילבנר',
  'Petit Manseng': 'פטי מנסנג',

  // Rosé / Sparkling / Other
  'Glera': 'גלרה',
  'Macabeo': 'מקבאו',
  'Xarel-lo': 'חארלו',
  'Parellada': 'פרלאדה',
};

// ---------------------------------------------------------------------------
// Appellations
// ---------------------------------------------------------------------------

const APPELLATION_HE: Record<string, string> = {
  'Saint-Émilion': 'סן אמיליון',
  'Saint-Emilion': 'סן אמיליון',
  'Pauillac': 'פויאק',
  'Margaux': 'מרגו',
  'Saint-Julien': 'סן ז\'וליאן',
  'Pomerol': 'פומרול',
  'Médoc': 'מדוק',
  'Medoc': 'מדוק',
  'Haut-Médoc': 'או-מדוק',
  'Haut-Medoc': 'או-מדוק',
  'Graves': 'גראב',
  'Pessac-Léognan': 'פסאק-לאוניאן',
  'Pessac-Leognan': 'פסאק-לאוניאן',
  'Sauternes': 'סוטרן',
  'Côtes du Rhône': 'קוט דו רון',
  'Cotes du Rhone': 'קוט דו רון',
  'Châteauneuf-du-Pape': 'שאטונף דו פאפ',
  'Chateauneuf-du-Pape': 'שאטונף דו פאפ',
  'Hermitage': 'ארמיטאז\'',
  'Côte-Rôtie': 'קוט רוטי',
  'Cote-Rotie': 'קוט רוטי',
  'Cornas': 'קורנאס',
  'Crozes-Hermitage': 'קרוז-ארמיטאז\'',
  'Gigondas': 'ז\'יגונדאס',
  'Vacqueyras': 'ואקיירס',
  'Chablis': 'שאבלי',
  'Meursault': 'מרסו',
  'Puligny-Montrachet': 'פוליני-מונטרשה',
  'Gevrey-Chambertin': 'ז\'ברה-שמברטן',
  'Vosne-Romanée': 'וון-רומנה',
  'Nuits-Saint-Georges': 'ניי-סן ז\'ורז\'',
  'Pommard': 'פומאר',
  'Volnay': 'וולנה',
  'Sancerre': 'סנסר',
  'Pouilly-Fumé': 'פויי-פומה',
  'Vouvray': 'ווברה',
  'Chinon': 'שינון',
  'Muscadet': 'מוסקדה',
  'Barolo': 'ברולו',
  'Barbaresco': 'ברברסקו',
  'Brunello di Montalcino': 'ברונלו די מונטלצ\'ינו',
  'Chianti': 'קיאנטי',
  'Chianti Classico': 'קיאנטי קלאסיקו',
  'Valpolicella': 'ואלפוליצ\'לה',
  'Amarone': 'אמרונה',
  'Amarone della Valpolicella': 'אמרונה דלה ואלפוליצ\'לה',
  'Soave': 'סואבה',
  'Prosecco': 'פרוסקו',
  'Franciacorta': 'פרנצ\'אקורטה',
  'Cava': 'קאווה',
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function caseInsensitiveLookup(dict: Record<string, string>, key: string | null | undefined): string | null {
  if (key == null || key === '') return null;
  const keyStr = typeof key === 'string' ? key : String(key);

  // Try exact match first (fast path)
  if (dict[keyStr]) return dict[keyStr];

  // Try case-insensitive match
  const lowerKey = keyStr.toLowerCase();
  for (const [k, v] of Object.entries(dict)) {
    if (k.toLowerCase() === lowerKey) return v;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function translateCountry(country: string | null | undefined): string | null {
  return caseInsensitiveLookup(COUNTRY_HE, country);
}

export function translateRegion(region: string | null | undefined): string | null {
  return caseInsensitiveLookup(REGION_HE, region);
}

export function translateAppellation(appellation: string | null | undefined): string | null {
  return caseInsensitiveLookup(APPELLATION_HE, appellation);
}

export function translateGrape(grape: unknown): string {
  if (grape == null) return '';
  const s = typeof grape === 'string' ? grape : String(grape);
  return caseInsensitiveLookup(GRAPE_HE, s) ?? s;
}

export function translateGrapes(grapes: string[] | null | undefined): string[] | null {
  if (!grapes || grapes.length === 0) return null;
  return grapes.map(translateGrape);
}

export interface LocalizedWineData {
  wine_name: string;
  producer: string;
  country: string | null;
  region: string | null;
  appellation: string | null;
  grapes: string[] | null;
}

/**
 * Returns Hebrew-localised wine display data.
 *
 * Priority for each field:
 *   1. AI-generated translation stored in `wine.translations.he`
 *   2. Static dictionary lookup (countries, regions, grapes)
 *   3. Original value (fallback)
 */
export function getLocalizedWineData(
  wine: {
    wine_name: string;
    producer: string;
    country?: string | null;
    region?: string | null;
    appellation?: string | null;
    grapes?: string[] | any | null;
    translations?: any;
  },
  language: string,
): LocalizedWineData {
  if (language !== 'he') {
    const grapes = Array.isArray(wine.grapes) ? wine.grapes : null;
    return {
      wine_name: wine.wine_name,
      producer: wine.producer,
      country: wine.country ?? null,
      region: wine.region ?? null,
      appellation: wine.appellation ?? null,
      grapes,
    };
  }

  const heTranslations = wine.translations?.he;

  const grapesSrc = Array.isArray(wine.grapes) ? wine.grapes : null;

  return {
    wine_name: heTranslations?.wine_name || wine.wine_name,
    producer: heTranslations?.producer || wine.producer,
    country: heTranslations?.country || translateCountry(wine.country) || wine.country || null,
    region: heTranslations?.region || translateRegion(wine.region) || wine.region || null,
    appellation: heTranslations?.appellation || translateAppellation(wine.appellation) || wine.appellation || null,
    grapes: heTranslations?.grapes
      ? heTranslations.grapes
      : translateGrapes(grapesSrc) ?? grapesSrc,
  };
}
