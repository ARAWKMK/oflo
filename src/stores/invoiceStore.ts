import { defineStore } from 'pinia';
import { db, type Invoice, type InvoiceVersion, type Company, type Customer, type InvoiceItem } from '../db/db';
import { getNextMasterId } from '../services/sequenceService';

export const useInvoiceStore = defineStore('invoices', {
    state: () => ({
        // We generally fetch live from DB, but can keep some UI state here
        lastInvoiceNumber: '...'
    }),
    actions: {
        async generateNextInvoiceNumber(companyId: number, date: Date): Promise<string> {
            const company = await db.companies.get(companyId);
            if (!company) return 'YXX-UNKNOWN-1:G1';

            const prefix = (company.invoicePrefix || 'INV').trim();
            return await getNextMasterId(prefix, date);
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
                const invNum = await this.generateNextInvoiceNumber(data.company.id!, data.date);

                // 1. Create Master Record
                const invoiceId = await db.invoices.add({
                    salesNumber: invNum,
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
