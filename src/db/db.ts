import Dexie, { type Table } from 'dexie';

export const DB_VERSION = 10;

export interface Company {
    id?: number;
    name: string;
    gstin: string;
    tagline?: string;
    address: string;
    phone: string;
    email: string;
    salesPrefix: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    terms?: string;
    alias?: string;
}

export interface Customer {
    id?: number;
    name: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
    placeOfSupply?: string;

    // v3 Updates
    deliveryAddresses?: string[];
    enableDelivery?: boolean;
    deliveryAddress?: string; // Deprecated but kept for type safety during migration

    // v4 Updates
    saleProductName?: string;
}

export interface Product {
    id?: number;
    name: string;
    sku?: string;
    description: string;
    hsn: string;
    unitPrice: number;
    taxRate: number;
}

export interface SaleItem {
    productId: number;
    name: string;
    description: string;
    hsn: string;
    numberOfBags: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    // v3
    producerId?: number;
    producerName?: string; // Snapshot
    producerAlias?: string; // v5 Snapshot
    // Calculated
    taxAmount: number;
    totalAmount: number;
}

// v3: Single Summary Row for Tax Invoice
export interface SaleSummaryItem {
    description: string;
    hsn: string;
    numberOfBags: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    // v4
    saleProductName?: string; 
}

export interface Sale {
    id?: number;
    salesNumber: string;
    globalSalesNo?: string; // v5 Global Year Counter (YXX-GXXXX)
    customerId: number;
    date: Date;
    vehicleNumber?: string;
    currentVersionId?: number;
    grandTotal: number;
    status?: 'draft' | 'final'; // v4
}

export interface SaleVersion {
    id?: number;
    saleId: number; // Formerly invoiceId
    version: number;
    date: Date;
    vehicleNumber?: string;

    // Snapshots
    sellerDetails: Company;
    buyerDetails: Customer;
    items: SaleItem[];
    summaryItem?: SaleSummaryItem; // Added v3

    salesNumber: string;

    // Financials
    subTotal: number;
    totalTax: number;
    grandTotal: number;

    // Tax Details
    taxType?: string;
    roundOff?: number;

    status?: 'draft' | 'final'; // v4
    createdAt: Date;
}

export interface Font {
    id?: number;
    name: string;
    data: string;
}

export class OfloDB extends Dexie {
    companies!: Table<Company>;
    customers!: Table<Customer>;
    products!: Table<Product>;
    sales!: Table<Sale>;
    salesVersions!: Table<SaleVersion>;
    settings!: Table<{ key: string, value: any }>;
    fonts!: Table<Font>;

    constructor() {
        super('OfloDB');

        // Define Version 10 (Full Sales Refactor)
        this.version(10).stores({
            companies: '++id, name, alias, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            sales: '++id, salesNumber, currentVersionId, customerId, date, status',
            salesVersions: '++id, saleId, version, date',
            settings: 'key',
            fonts: '++id, name'
        }).upgrade(async tx => {
            // Migration v10: Move data from invoices tables to sales tables
            const invoices = await tx.table('invoices').toArray();
            if (invoices.length > 0) {
                await tx.table('sales').bulkAdd(invoices);
            }
            const versions = await tx.table('invoiceVersions').toArray();
            if (versions.length > 0) {
                const mapped = versions.map((v: any) => ({
                    ...v,
                    saleId: v.invoiceId // Map old FK to new property
                }));
                await tx.table('salesVersions').bulkAdd(mapped);
            }
        });

        // Version 9 (Branding: salesNumber)
        this.version(9).stores({
            companies: '++id, name, alias, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, salesNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });

        // Version 8 (v5 branding)
        this.version(8).stores({
            companies: '++id, name, alias, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });

        // Define Version 7 (v5: Company Alias)
        this.version(7).stores({
            companies: '++id, name, alias, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });

        // Define Version 6 (v4: Dynamic Product Name)
        this.version(6).stores({
            companies: '++id, name, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });

        // Define Version 5 (v3 Update: Multi-Address)
        this.version(5).stores({
            companies: '++id, name, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });

        // Define Version 4
        this.version(4).stores({
            companies: '++id, name, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });

        // Define Version 3
        this.version(3).stores({
            companies: '++id, name, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });

        this.version(2).stores({
            companies: '++id, name, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        });
    }
}

export const db = new OfloDB();
