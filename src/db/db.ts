import Dexie, { type Table } from 'dexie';

export const DB_VERSION = 9;

export interface Company {
    id?: number;
    name: string;
    gstin: string;
    tagline?: string;
    address: string;
    phone: string;
    email: string;
    invoicePrefix: string;
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
    invoiceProductName?: string;
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

export interface InvoiceItem {
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
export interface InvoiceSummaryItem {
    description: string;
    hsn: string;
    numberOfBags: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    // v4
    invoiceProductName?: string; 
}

export interface Invoice {
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

export interface InvoiceVersion {
    id?: number;
    invoiceId: number;
    version: number;
    date: Date;
    vehicleNumber?: string;

    // Snapshots
    sellerDetails: Company;
    buyerDetails: Customer;
    items: InvoiceItem[];
    summaryItem?: InvoiceSummaryItem; // Added v3

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
    invoices!: Table<Invoice>;
    invoiceVersions!: Table<InvoiceVersion>;
    settings!: Table<{ key: string, value: any }>;
    fonts!: Table<Font>;

    constructor() {
        super('OfloDB');

        // Define Version 9 (final branding: salesNumber)
        this.version(DB_VERSION).stores({
            companies: '++id, name, alias, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, salesNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        }).upgrade(async tx => {
            // Migration v9: Rename invoiceNumber to salesNumber for branding
            await tx.table('invoices').toCollection().modify((i: any) => {
                if (i.invoiceNumber && !i.salesNumber) {
                    i.salesNumber = i.invoiceNumber;
                    delete i.invoiceNumber;
                }
            });
        });

        // Define Version 8 (v5 branding: salesNumber)
        this.version(8).stores({
            companies: '++id, name, alias, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date, status',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        }).upgrade(async tx => {
            // Migration v8: Rename referenceNumber to salesNumber for branding
            await tx.table('invoiceVersions').toCollection().modify((v: any) => {
                if (v.referenceNumber && !v.salesNumber) {
                    v.salesNumber = v.referenceNumber;
                    delete v.referenceNumber;
                }
            });
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
        }).upgrade(async tx => {
            // Migration v7: Initialize alias for companies
            await tx.table('companies').toCollection().modify(c => {
                if (!c.alias) c.alias = c.name;
            });
            // Migration v7: Initialize producerAlias for all invoice versions
            await tx.table('invoiceVersions').toCollection().modify((v: InvoiceVersion) => {
                if (v.items) {
                    v.items.forEach(item => {
                        if (!item.producerAlias) item.producerAlias = item.producerName || '';
                    });
                }
            });
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
        }).upgrade(async tx => {
            // Migration v6: Initialize invoiceProductName for customers if missing
            await tx.table('customers').toCollection().modify(c => {
                if (!c.invoiceProductName) {
                    c.invoiceProductName = ''; 
                }
            });
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
        }).upgrade(async tx => {
            // Migration v5: Initialize deliveryAddresses from existing address
            await tx.table('customers').toCollection().modify(c => {
                if (!c.deliveryAddresses) {
                    c.deliveryAddresses = c.deliveryAddress ? [c.deliveryAddress] : (c.address ? [c.address] : []);
                }
                if (c.enableDelivery === undefined) {
                    c.enableDelivery = false;
                }
            });
        });

        // Define Version 4
        this.version(4).stores({
            companies: '++id, name, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date, status', // Added status index
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name'
        }).upgrade(async tx => {
            // Migration v4: Set default status 'final' for existing
            await tx.table('invoices').toCollection().modify(i => i.status = 'final');
            await tx.table('invoiceVersions').toCollection().modify(v => v.status = 'final');
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
        }).upgrade(async tx => {
            // Migration: Create default Summary Item for existing versions
            await tx.table('invoiceVersions').toCollection().modify((ver: InvoiceVersion) => {
                if (!ver.summaryItem && ver.items && ver.items.length > 0) {
                    const first = ver.items[0];
                    ver.summaryItem = {
                        description: first.description,
                        hsn: first.hsn,
                        unitPrice: first.unitPrice,
                        taxRate: first.taxRate,
                        // Sums
                        numberOfBags: ver.items.reduce((sum, item) => sum + (Number(item.numberOfBags) || 0), 0),
                        quantity: ver.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
                        taxAmount: ver.items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0),
                        totalAmount: ver.items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0)
                    };
                }
            });
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
