import { type Sale, type SaleVersion, db } from '../db/db';

export interface AuditResult {
    type: 'Company' | 'Customer' | 'Product' | 'Sale';
    id: string;
    message: string;
    severity: 'warning' | 'error';
}

/**
 * Comprehensive Normalization: 
 * Ensures all raw data (from DB or JSON) is upgraded to the latest schema.
 * Handles terminology renames, missing fields, and deep snapshot re-hydration.
 */
export function normalizeData(rawData: any): { 
    companies: any[], 
    customers: any[], 
    products: any[], 
    settings: any[], 
    sales: Sale[], 
    versions: SaleVersion[],
    fonts: any[] 
} {
    const data = rawData || {};

    // 1. Companies (Branding Fixes)
    const companies = (data.companies || []).map((c: any) => {
        const item = { ...c };
        if (item.invoicePrefix && !item.salesPrefix) item.salesPrefix = item.invoicePrefix;
        delete item.invoicePrefix;
        item.alias = item.alias || item.name; // Removed 'Unknown' default
        return item;
    });

    // 2. Customers (Branding Fixes)
    const customers = (data.customers || []).map((c: any) => {
        const item = { ...c };
        item.deliveryAddresses = item.deliveryAddresses || (item.deliveryAddress ? [item.deliveryAddress] : (item.address ? [item.address] : []));
        item.enableDelivery = item.enableDelivery ?? false;
        if (item.invoiceProductName && !item.saleProductName) item.saleProductName = item.invoiceProductName;
        delete item.invoiceProductName;
        return item;
    });

    // 3. Products
    const products = (data.products || []).map((p: any) => ({
        ...p,
        hsn: p.hsn || '',
        taxRate: p.taxRate !== undefined ? p.taxRate : 18
    }));

    // 4. Sales Terminology & Dates
    const incomingSales = data.sales || data.invoices || [];
    const sales = incomingSales.map((s: any) => {
        const item = { ...s };
        if (item.invoiceNumber && !item.salesNumber) item.salesNumber = item.invoiceNumber;
        delete item.invoiceNumber;
        item.date = item.date ? new Date(item.date) : new Date();
        item.status = item.status || 'final';
        return item as Sale;
    });

    // 5. Versions Terminology & Dates (Snapshot Healing)
    const incomingVers = data.salesVersions || data.invoiceVersions || [];

    const versions = incomingVers.map((v: any) => {
        const sv = { ...v };
        if (sv.referenceNumber && !sv.salesNumber) sv.salesNumber = sv.referenceNumber;
        delete sv.referenceNumber;
        if (sv.invoiceId && !sv.saleId) sv.saleId = sv.invoiceId;
        delete sv.invoiceId;
        
        sv.date = sv.date ? new Date(sv.date) : new Date();
        sv.createdAt = sv.createdAt ? new Date(sv.createdAt) : new Date(sv.date);
        sv.status = sv.status || 'final';
        
        // Deep Normalize Snapshots
        sv.sellerDetails = sv.sellerDetails ? normalizeData({ companies: [sv.sellerDetails] }).companies[0] : sv.sellerDetails;
        sv.buyerDetails = sv.buyerDetails ? normalizeData({ customers: [sv.buyerDetails] }).customers[0] : sv.buyerDetails;

        sv.items = (sv.items || []).map((i: any) => ({
            ...i,
            producerAlias: i.producerAlias || i.producerName || '' 
        }));

        if (sv.summaryItem) {
            if (sv.summaryItem.invoiceProductName && !sv.summaryItem.saleProductName) {
                sv.summaryItem.saleProductName = sv.summaryItem.invoiceProductName;
            }
            delete sv.summaryItem.invoiceProductName;
        }

        return sv as SaleVersion;
    });

    // 6. Settings
    const settings = (data.settings || []).map((s: any) => {
        if (s.key === 'pdfPageSizeInvoice') return { ...s, key: 'pdfPageSizeSale' };
        return s;
    });

    // 7. Fonts
    const fonts = data.fonts || [];

    return { companies, customers, products, settings, sales, versions, fonts };
}

/**
 * Data Auditor: Scans for legacy formats and buffers issues for persistent logging.
 * Logs are stored in localStorage to survive the post-restore reload.
 */
export async function auditRestoreData(): Promise<void> {
    const companies = await db.companies.toArray();
    const customers = await db.customers.toArray();
    const sales = await db.sales.toArray();

    const logs: { type: 'warn' | 'info', message: string }[] = [];
    
    companies.forEach(c => {
        if (!c.alias) logs.push({ type: 'warn', message: `[Audit] Company ${c.name} is missing a short Alias.` });
        if (!c.bankName || !c.accountNumber) logs.push({ type: 'warn', message: `[Audit] Company ${c.name} is missing Bank Details.` });
        if (!c.salesPrefix) logs.push({ type: 'warn', message: `[Audit] Company ${c.name} has no Sales Prefix (Numerical sequence will be broken).` });
    });

    customers.forEach(c => {
        // v5.1.11 Refined Delivery Logic:
        // A customer is valid if they have a main 'address' OR 'deliveryAddresses'.
        const hasMainAddress = !!c.address;
        const hasDeliveryList = c.deliveryAddresses && c.deliveryAddresses.length > 0;
        
        if (!hasMainAddress && !hasDeliveryList) {
            logs.push({ type: 'warn', message: `[Audit] Customer ${c.name} has no address details (neither main nor delivery list).` });
        }

        if (c.enableDelivery && !hasDeliveryList) {
            logs.push({ type: 'warn', message: `[Audit] Customer ${c.name} has 'Delivery Locations' enabled but the list is empty.` });
        }

        if (!c.saleProductName) {
            logs.push({ type: 'warn', message: `[Audit] Customer ${c.name} is missing a 'Sale Product Name' (will display correctly as blank).` });
        }
    });

    sales.forEach(s => {
        const id = s.salesNumber || 'REF-?';
        const isModern = /^Y\d{2}-.*-.*:G\d+$/.test(id);
        if (!isModern) logs.push({ type: 'info', message: `[Audit] Sale ${id} uses legacy Master ID format.` });
    });

    if (logs.length > 0) {
        localStorage.setItem('oflo_audit_buffer', JSON.stringify(logs));
    }
}

/**
 * Diagnostic Printer: Checks for buffered logs (from a recent restore) 
 * and prints them to the console after the reload.
 */
export function printStoredAudit(): void {
    const raw = localStorage.getItem('oflo_audit_buffer');
    if (!raw) return;

    try {
        const logs = JSON.parse(raw);
        console.group('%c --- OFLO INTEGRITY AUDIT ---', 'color: #3b82f6; font-weight: bold; font-size: 1.1rem;');
        logs.forEach((l: any) => {
            if (l.type === 'warn') console.warn(l.message);
            else console.info(l.message);
        });
        console.groupEnd();
        localStorage.removeItem('oflo_audit_buffer');
    } catch (e) {
        localStorage.removeItem('oflo_audit_buffer');
    }
}
