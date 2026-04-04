import { defineStore } from 'pinia';
import { db, type Sale, type SaleVersion, type Company, type Customer, type SaleItem } from '../db/db';
import { getNextMasterId } from '../services/sequenceService';

export const useSalesStore = defineStore('sales', {
    state: () => ({
        // We generally fetch live from DB, but can keep some UI state here
        lastSalesNumber: '...'
    }),
    actions: {
        async generateNextSalesNumber(companyId: number, date: Date): Promise<string> {
            const company = await db.companies.get(companyId);
            if (!company) return 'YXX-UNKNOWN-1:G1';

            const prefix = (company.salesPrefix || 'SAL').trim(); // Default changed to SAL
            return await getNextMasterId(prefix, date);
        },

        async createSale(data: {
            company: Company,
            customer: Customer,
            date: Date,
            vehicleNumber?: string,
            items: SaleItem[],
            financials: { subTotal: number, totalTax: number, grandTotal: number }
        }) {
            return await db.transaction('rw', db.sales, db.salesVersions, async () => {
                const salesNum = await this.generateNextSalesNumber(data.company.id!, data.date);

                // 1. Create Master Record
                const saleId = await db.sales.add({
                    salesNumber: salesNum,
                    customerId: data.customer.id!,
                    date: data.date,
                    vehicleNumber: data.vehicleNumber,
                    grandTotal: data.financials.grandTotal,
                    status: 'final'
                } as Sale);

                // 2. Create Version Snapshot
                const versionId = await db.salesVersions.add({
                    saleId: Number(saleId),
                    version: 1,
                    date: data.date,
                    vehicleNumber: data.vehicleNumber,
                    sellerDetails: JSON.parse(JSON.stringify(data.company)), // Deep copy snapshot
                    buyerDetails: JSON.parse(JSON.stringify(data.customer)),
                    items: JSON.parse(JSON.stringify(data.items)),
                    subTotal: data.financials.subTotal,
                    totalTax: data.financials.totalTax,
                    grandTotal: data.financials.grandTotal,
                    salesNumber: salesNum,
                    status: 'final',
                    createdAt: new Date()
                } as SaleVersion);

                // Update master with pointer
                await db.sales.update(Number(saleId), { currentVersionId: Number(versionId) });

                return saleId;
            });
        }
    }
});
