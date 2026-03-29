/**
 * Currency symbols for display. Maps ISO 4217 codes to their symbols.
 * Used across transaction displays to show e.g. "€120.50" instead of "120.50 EUR".
 */
export const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CHF: 'Fr',
    CAD: 'C$', AUD: 'A$', NZD: 'NZ$',
    CZK: 'Kč', PLN: 'zł', HUF: 'Ft', RON: 'lei',
    BGN: 'лв', HRK: 'kn', RSD: 'din', UAH: '₴',
    SEK: 'kr', NOK: 'kr', DKK: 'kr', ISK: 'kr',
    GEL: '₾', BYN: 'Br', RUB: '₽',
    CNY: '¥', HKD: 'HK$', TWD: 'NT$', KRW: '₩',
    SGD: 'S$', MYR: 'RM', THB: '฿', IDR: 'Rp',
    PHP: '₱', VND: '₫', INR: '₹', PKR: '₨',
    BDT: '৳', LKR: 'Rs', KZT: '₸', MNT: '₮',
    AED: 'د.إ', SAR: '﷼', ILS: '₪', TRY: '₺',
    KWD: 'KD', BHD: 'BD', JOD: 'JD', OMR: '﷼',
    ZAR: 'R', EGP: 'E£', NGN: '₦', KES: 'KSh', GHS: '₵',
    MXN: 'MX$', BRL: 'R$', ARS: 'AR$', CLP: 'CL$',
    COP: 'COL$', PEN: 'S/.', CRC: '₡',
};

/**
 * Format amount with currency symbol.
 * For currencies with a known symbol, uses "symbol + amount" format.
 * Falls back to "amount + code" for unknown currencies.
 */
export function formatCurrency(amount, currencyCode = 'CZK') {
    const n = Number(amount);
    const num = isFinite(n)
        ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';
    const symbol = CURRENCY_SYMBOLS[currencyCode];

    if (!symbol) {
        return `${num} ${currencyCode}`;
    }

    // Currencies where symbol goes after the amount
    const suffixCurrencies = ['CZK', 'PLN', 'HUF', 'RON', 'BGN', 'HRK',
        'RSD', 'SEK', 'NOK', 'DKK', 'ISK', 'KZT', 'MNT'];

    if (suffixCurrencies.includes(currencyCode)) {
        return `${num} ${symbol}`;
    }

    return `${symbol}${num}`;
}

/**
 * Format amount with 2 decimal places, no currency symbol.
 * Use for inline money displays where currency is appended separately.
 */
export function formatMoney(amount) {
    const n = Number(amount);
    if (!isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
