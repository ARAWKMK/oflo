import Dexie, { type Table } from 'dexie';

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
}

export interface Customer {
    id?: number;
    name: string;
    gstin: string;
    address: string;
    deliveryAddress?: string; // Added v3
    phone: string;
    email: string;
    placeOfSupply?: string;
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
}

export interface Invoice {
    id?: number;
    invoiceNumber: string;
    customerId: number;
    date: Date;
    vehicleNumber?: string;
    currentVersionId?: number;
    grandTotal: number;
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

    referenceNumber: string;

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
