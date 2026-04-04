import { db } from '../db/db';

/**
 * Returns the ending year of the financial period (April 1st to March 31st).
 * E.g., March 31, 2026 (FY25-26) -> 2026 (Y26)
 * E.g., April 1, 2026 (FY26-27) -> 2027 (Y27)
 */
export function getFiscalYear(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed (April is 3)
    
    if (month < 3) {
        return year; // E.g., Feb 2025 is part of FY24-25 ending in 2025
    }
    return year + 1; // E.g., May 2024 is part of FY24-25 ending in 2025
}

/**
 * Formats components into the Master ID: YXX-Prefix-Seq:GGlobalSeq
 */
export function formatMasterId(year: number, prefix: string, seq: number, gSeq: number): string {
    const shortYear = year.toString().slice(-2);
    return `Y${shortYear}-${prefix}-${seq}:G${gSeq}`;
}

/**
 * Generates the next Unified Master ID for a new sale.
 * Both the company sequence and global sequence reset every financial year.
 */
export async function getNextMasterId(companyPrefix: string, date: Date): Promise<string> {
    const fiscalYear = getFiscalYear(date);
    
    // Define the date range for the fiscal year
    // Since fiscalYear is the END year (e.g., 2027 for Y27), the start must be 2026.
    const start = new Date(fiscalYear - 1, 3, 1); // April 1st of previous year
    const end = new Date(fiscalYear, 2, 31, 23, 59, 59, 999); // March 31st of fiscalYear

    // Find all sales in this fiscal year
    const yearSales = await db.sales
        .where('date')
        .between(start, end)
        .toArray();

    let maxSeq = 0;   // Max for the specific company
    let maxGSeq = 0;  // Max global across all companies

    // Regex to parse: YXX-Prefix-Seq:GGlobalSeq
    // Group 1: Sequence, Group 2: Global Sequence
    const masterRegex = new RegExp(`Y\\d{2}-${companyPrefix}-(\\d+):G(\\d+)`);
    const globalRegex = /Y\d{2}-.*-(\d+):G(\d+)/;

    yearSales.forEach(s => {
        if (s.salesNumber) {
            // Check for current company sequence
            const match = s.salesNumber.match(masterRegex);
            if (match) {
                const seq = parseInt(match[1], 10);
                if (!isNaN(seq) && seq > maxSeq) {
                    maxSeq = seq;
                }
            }

            // Check for global sequence
            const gMatch = s.salesNumber.match(globalRegex);
            if (gMatch) {
                const gSeq = parseInt(gMatch[2], 10);
                if (!isNaN(gSeq) && gSeq > maxGSeq) {
                    maxGSeq = gSeq;
                }
            }
        }
    });

    return formatMasterId(fiscalYear, companyPrefix, maxSeq + 1, maxGSeq + 1);
}
