import { type Invoice, type InvoiceVersion } from '../db/db';
import { getFiscalYear, formatMasterId } from './sequenceService';

/**
 * Standardizes historical sales data into the Master ID format: YXX-Prefix-Seq:GGlobalSeq
 * Logic: Chronological re-indexing (G1 is the oldest in each FY).
 */
export function standardizeSalesData(invoices: Invoice[], versions: InvoiceVersion[]): { invoices: Invoice[], versions: InvoiceVersion[] } {
    // 1. Mandatory Branding Check: Ensure all records have salesNumber
    invoices.forEach((inv: any) => {
        if (inv.invoiceNumber && !inv.salesNumber) {
            inv.salesNumber = inv.invoiceNumber;
        }
        delete inv.invoiceNumber;
    });

    versions.forEach((v: any) => {
        if (v.referenceNumber && !v.salesNumber) {
            v.salesNumber = v.referenceNumber;
        }
        delete v.referenceNumber;
    });

    console.log(`Migration: Standardizing ${invoices.length} sales...`);

    // 2. Clone to avoid mutating inputs directly
    const clonedInvoices = JSON.parse(JSON.stringify(invoices)) as Invoice[];
    const clonedVersions = JSON.parse(JSON.stringify(versions)) as InvoiceVersion[];

    // 3. Group by Fiscal Year
    const fyGroups = new Map<number, Invoice[]>();
    clonedInvoices.forEach(inv => {
        const fy = getFiscalYear(new Date(inv.date));
        if (!fyGroups.has(fy)) fyGroups.set(fy, []);
        fyGroups.get(fy)!.push(inv);
    });

    // 4. Process each FY chronologically
    fyGroups.forEach((group, fy) => {
        // Sort: Oldest First (Primary: Date, Secondary: ID)
        group.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (a.id || 0) - (b.id || 0);
        });

        // Re-index G1...GN
        group.forEach((inv, index) => {
            const gSeq = index + 1;
            const oldId = inv.salesNumber || '';
            
            // Extract Prefix and Sequence from old format (e.g. NB-001 or Y26-NB-1:G1)
            let prefix = 'NB';
            let seq = 1;

            if (oldId.includes(':G')) {
                // Already partially modern, extract middle part
                const parts = oldId.split('-');
                if (parts.length >= 3) {
                   prefix = parts[1];
                   seq = parseInt(parts[2].split(':')[0], 10);
                }
            } else {
                // Legacy Format (e.g. NB-001 or INV-LP-1)
                const parts = oldId.split('-');
                if (parts.length >= 2) {
                    prefix = parts[0];
                    seq = parseInt(parts[1], 10);
                }
            }

            if (isNaN(seq)) seq = 1;

            // Generate the New "Golden" Master ID
            const newMasterId = formatMasterId(fy, prefix, seq, gSeq);
            
            // Update Invoice
            inv.salesNumber = newMasterId;

            // Update all related versions
            clonedVersions.forEach(v => {
                if (v.invoiceId === inv.id) {
                    v.salesNumber = `${newMasterId}-v${v.version}`;
                }
            });
        });
    });

    return { invoices: clonedInvoices, versions: clonedVersions };
}
