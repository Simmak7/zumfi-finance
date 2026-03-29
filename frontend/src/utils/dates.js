/**
 * Format a date string or Date object as dd.mm.yyyy (European format).
 * @param {string|Date} dateStr - ISO date string or Date object
 * @returns {string} Formatted date like "15.01.2025"
 */
export function formatDate(dateStr) {
    if (!dateStr) return 'Not set';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Format a YYYY-MM month string as "Month YYYY" for page headers.
 * @param {string} monthStr - Month string like "2025-01"
 * @returns {string} Formatted like "January 2025"
 */
export function formatMonthLabel(monthStr) {
    const d = new Date(monthStr + '-01');
    return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

/**
 * Format a YYYY-MM month string as short label for charts.
 * @param {string} monthStr - Month string like "2025-01"
 * @returns {string} Formatted like "Jan '25"
 */
export function formatMonthShort(monthStr) {
    const [year, month] = monthStr.split('-');
    const d = new Date(Number(year), Number(month) - 1);
    const short = d.toLocaleDateString('en', { month: 'short' });
    return `${short} '${year.slice(2)}`;
}
