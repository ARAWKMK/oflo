import { defineStore } from 'pinia';
import { db, type Invoice, type InvoiceVersion, type Company, type Customer, type InvoiceItem } from '../db/db';

export const useInvoiceStore = defineStore('invoices', {
    state: () => ({
        // We generally fetch live from DB, but can keep some UI state here
        lastInvoiceNumber: '...'
    }),
    actions: {
        async generateNextInvoiceNumber(companyId: number): Promise<string> {
            const company = await db.companies.get(companyId);
            if (!company) return 'INV-001';

            const rawPrefix = company.invoicePrefix;
            const prefix = (rawPrefix || 'INV').trim();
            console.log(`[DEBUG] Company: "${company.name}" (ID: ${companyId}) -> RawPrefix: "${rawPrefix}" -> UsedPrefix: "${prefix}"`);

            // Get all invoices that strictly start with "${prefix}-"
            const invoices = await db.invoices
                .filter(inv => inv.invoiceNumber.startsWith(`${prefix}-`))
                .toArray();

            console.log(`[DEBUG] Found ${invoices.length} invoices matching prefix "${prefix}-"`);

            let maxSeq = 0;
            const regex = new RegExp(`^${prefix}-(\\d+)$`);

            invoices.forEach(inv => {
                const match = inv.invoiceNumber.match(regex);
                if (match) {
                    const seq = parseInt(match[1]);
                    if (!isNaN(seq) && seq > maxSeq) {
                        maxSeq = seq;
                    }
                }
            });

            const nextNum = `${prefix}-${(maxSeq + 1).toString().padStart(3, '0')}`;
            console.log(`[DEBUG] MaxSeq: ${maxSeq} -> Generated: ${nextNum}`);
            return nextNum;
        },

        async createInvoice(data: {
            company: Company,
            customer: Customer,
            date: Date,
            vehicleNumber?: string,
            items: InvoiceItem[],
            financials: { subTotal: number, totalTax: number, grandTotal: number }
        }) {
            return await db.transaction('rw', db.invoices, db.invoiceVersions, async () => {
                const invNum = await this.generateNextInvoiceNumber(data.company.id!);

                // 1. Create Master Record
                const invoiceId = await db.invoices.add({
                    invoiceNumber: invNum,
                    customerId: data.customer.id!,
                    date: data.date,
                    vehicleNumber: data.vehicleNumber,
                    grandTotal: data.financials.grandTotal
                } as Invoice);

                // 2. Create Version Snapshot
                const versionId = await db.invoiceVersions.add({
                    invoiceId: Number(invoiceId),
                    version: 1,
                    date: data.date,
                    vehicleNumber: data.vehicleNumber,
                    sellerDetails: JSON.parse(JSON.stringify(data.company)), // Deep copy snapshot
                    buyerDetails: JSON.parse(JSON.stringify(data.customer)),
                    items: JSON.parse(JSON.stringify(data.items)),
                    subTotal: data.financials.subTotal,
                    totalTax: data.financials.totalTax,
                    grandTotal: data.financials.grandTotal,
                    createdAt: new Date()
                } as InvoiceVersion);

                // Update master with pointer
                await db.invoices.update(Number(invoiceId), { currentVersionId: Number(versionId) });

                return invoiceId;
            });
        }
    }
});
