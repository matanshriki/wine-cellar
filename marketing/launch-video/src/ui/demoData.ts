/** Explicitly fictional sample cellar for marketing video only. */
export const DEMO_BOTTLES = [
  {
    id: '1',
    producer: 'Domaine Sample',
    name: 'Côtes du Rhône',
    vintage: 2019,
    color: '#6B1F2F',
    region: 'Rhône',
    readiness: 'ready' as const,
    readinessLabelEn: 'In window',
    readinessLabelHe: 'בחלון טוב',
  },
  {
    id: '2',
    producer: 'Casa Demo',
    name: 'Barolo',
    vintage: 2016,
    color: '#4A1722',
    region: 'Piedmont',
    readiness: 'hold' as const,
    readinessLabelEn: 'Hold',
    readinessLabelHe: 'לשמור',
  },
  {
    id: '3',
    producer: 'Maison Example',
    name: 'Chablis',
    vintage: 2021,
    color: '#C9A227',
    region: 'Burgundy',
    readiness: 'ready' as const,
    readinessLabelEn: 'In window',
    readinessLabelHe: 'בחלון טוב',
  },
] as const;

export const DEMO_ASK_EN = 'We’re having roast chicken tonight. What should I open?';
export const DEMO_ASK_HE = 'יש לנו עוף צלוי הערב. מה לפתוח?';

export const DEMO_WHY_EN =
  'Savory depth for roast chicken without overpowering the dish—and it’s in a good window to drink, not hold.';
export const DEMO_WHY_HE =
  'יש בו מספיק עומק לעוף צלוי בלי להשתלט על המנה—והוא בחלון טוב לשתות, לא לשמור.';
