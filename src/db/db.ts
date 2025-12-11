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
    name: string; // Added for snapshot
    description: string;
    hsn: string;
    numberOfBags: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    // Calculated
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

    referenceNumber: string; // e.g. INV-001-v1

    // Financials
    subTotal: number;
    totalTax: number;
    grandTotal: number;

    // Tax Details
    taxType?: string;
    roundOff?: number;

    createdAt: Date;
}

export interface Font {
    id?: number;
    name: string;
    data: string; // Base64
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
        this.version(2).stores({
            companies: '++id, name, gstin',
            customers: '++id, name, gstin',
            products: '++id, name, sku',
            invoices: '++id, invoiceNumber, currentVersionId, customerId, date',
            invoiceVersions: '++id, invoiceId, version, date',
            settings: 'key',
            fonts: '++id, name' // New table
        });
    }
}

export const db = new OfloDB();
