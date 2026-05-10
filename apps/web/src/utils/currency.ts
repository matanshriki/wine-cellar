/**
 * Currency Utilities
 * 
 * Provides locale-aware currency formatting based on the app's current language.
 * 
 * Supported currencies:
 * - English (en) → USD ($)
 * - Hebrew (he) → ILS (₪)
 */

/**
 * Get currency code based on current language
 */
export function getCurrencyCode(locale: string): string {
  switch (locale) {
    case 'he':
      return 'ILS'; // Israeli New Shekel
    case 'en':
    default:
      return 'USD'; // US Dollar
  }
}

/**
 * Get currency symbol based on current language
 */
export function getCurrencySymbol(locale: string): string {
  switch (locale) {
    case 'he':
      return '₪'; // Shekel symbol
    case 'en':
    default:
      return '$'; // Dollar symbol
  }
}

/**
 * Format a price with the appropriate currency symbol
 * 
 * @param amount - The amount to format
 * @param locale - The current language locale ('en' or 'he'), used for number formatting
 * @param options - Formatting options
 * @returns Formatted price string (e.g., "$50.00" or "₪50.00")
 */
export function formatCurrency(
  amount: number | null | undefined,
  locale: string,
  options: {
    showSymbol?: boolean;
    decimals?: number;
    /** Override the currency code (e.g. 'ILS') instead of deriving from locale */
    currencyOverride?: string;
  } = {}
): string {
  const { showSymbol = true, decimals = 2, currencyOverride } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    return '';
  }

  const currencyCode = currencyOverride || getCurrencyCode(locale);
  const symbol = currencyCode === 'ILS' ? '₪' : '$';

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return formatter.format(amount);
  } catch (error) {
    const formattedAmount = amount.toFixed(decimals);
    return showSymbol ? `${symbol}${formattedAmount}` : formattedAmount;
  }
}

/**
 * Get the currency placeholder text for input fields
 * 
 * @param locale - The current language locale
 * @returns Example price string (e.g., "50.00" or "50.00")
 */
export function getCurrencyPlaceholder(locale: string): string {
  const symbol = getCurrencySymbol(locale);
  return `${symbol}50.00`;
}

/**
 * Parse a currency string to a number
 * Removes currency symbols and handles both comma and period decimals
 * 
 * @param value - The currency string to parse
 * @returns The numeric value or null if invalid
 */
export function parseCurrencyInput(value: string): number | null {
  if (!value || value.trim() === '') {
    return null;
  }

  // Remove currency symbols and spaces
  const cleaned = value.replace(/[$₪,\s]/g, '');
  
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Currency conversion rate
 * 1 USD = 3.2 ILS (static rate)
 */
const USD_TO_ILS_RATE = 3.2;

/**
 * Convert an amount from one currency to another
 * 
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency code ('USD' or 'ILS')
 * @param toCurrency - Target currency code ('USD' or 'ILS')
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Convert USD to ILS
  if (fromCurrency === 'USD' && toCurrency === 'ILS') {
    return amount * USD_TO_ILS_RATE;
  }

  // Convert ILS to USD
  if (fromCurrency === 'ILS' && toCurrency === 'USD') {
    return amount / USD_TO_ILS_RATE;
  }

  // Unknown currency pair, return as-is
  return amount;
}

/**
 * Get the display price in the user's current currency
 * Converts if necessary based on stored currency
 * 
 * @param amount - The stored amount
 * @param storedCurrency - The currency the amount was stored in ('USD' or 'ILS')
 * @param displayLocale - The current display locale ('en' or 'he')
 * @param displayCurrencyOverride - Explicit display currency ('USD' or 'ILS'); overrides locale-derived currency
 * @returns Object with converted amount and display currency
 */
export function getDisplayPrice(
  amount: number | null | undefined,
  storedCurrency: string | null | undefined,
  displayLocale: string,
  displayCurrencyOverride?: string
): { amount: number | null; currency: string } {
  if (amount === null || amount === undefined || isNaN(amount)) {
    const currency = displayCurrencyOverride || getCurrencyCode(displayLocale);
    return { amount: null, currency };
  }

  const displayCurrency = displayCurrencyOverride || getCurrencyCode(displayLocale);
  const sourceCurrency = storedCurrency || 'USD';

  const convertedAmount = convertCurrency(amount, sourceCurrency, displayCurrency);

  return {
    amount: convertedAmount,
    currency: displayCurrency,
  };
}

