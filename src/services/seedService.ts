import { db, type InvoiceVersion, type InvoiceItem, type Company, type Customer, type Product } from '../db/db';

// Extended types for Seeding only (to include stateCode for logic)
interface SeedCompany extends Company {
    stateCode: string;
}
interface SeedCustomer extends Customer {
    stateCode: string;
}

const COMPANIES: SeedCompany[] = [
    { name: "AgriCorp Solutions", alias: "AgriCorp", tagline: "Farming the Future", gstin: "29AAAAA0000A1Z5", address: "123 Green Way, Bangalore, KA", phone: "9988776655", email: "info@agricorp.com", invoicePrefix: "ACS", bankName: "HDFC", accountNumber: "50100012345678", ifscCode: "HDFC0001234", stateCode: "KA" },
    { name: "FarmTech India", alias: "FarmTech", tagline: "Tech for Farmers", gstin: "29BBBBB1111B1Z6", address: "45 Tech Park, Mysore, KA", phone: "9876543210", email: "sales@farmtech.com", invoicePrefix: "FTI", bankName: "SBI", accountNumber: "30001234567", ifscCode: "SBIN0001234", stateCode: "KA" },
    { name: "GreenHarvest Ltd", alias: "Harvest", tagline: "Pure & Organic", gstin: "27CCCCC2222C1Z7", address: "88 Market St, Pune, MH", phone: "020-12345678", email: "contact@greenharvest.com", invoicePrefix: "GHL", bankName: "ICICI", accountNumber: "100012345678", ifscCode: "ICIC0001234", stateCode: "MH" },
    { name: "Rural Supplies Co", alias: "Rural", tagline: "Supplying Villages", gstin: "33DDDDD3333D1Z8", address: "12 Village Rd, Chennai, TN", phone: "9123456789", email: "support@ruralsupplies.com", invoicePrefix: "RSC", bankName: "Axis", accountNumber: "91234567891234", ifscCode: "UTIB0001234", stateCode: "TN" },
    { name: "CropCare Systems", alias: "CropCare", tagline: "Caring for Crops", gstin: "36EEEEE4444E1Z9", address: "55 Field Ave, Hyderabad, TS", phone: "9900990099", email: "hello@cropcare.com", invoicePrefix: "CCS", bankName: "Kotak", accountNumber: "8877665544", ifscCode: "KKBK0001234", stateCode: "TS" },
    { name: "SeedGro Pvt Ltd", alias: "SeedGro", tagline: "Quality Seeds", gstin: "24FFFFF5555F1Z0", address: "22 Seed Ln, Ahmedabad, GJ", phone: "9898989898", email: "sales@seedgro.com", invoicePrefix: "SGL", bankName: "BoB", accountNumber: "200012345678", ifscCode: "BARB0ABCD", stateCode: "GJ" },
    { name: "Fertilizer Plus", alias: "FertiPlus", tagline: "Maximum Yield", gstin: "09GGGGG6666G1Z1", address: "33 Growth St, Lucknow, UP", phone: "9765432109", email: "orders@fertiplus.com", invoicePrefix: "FP", bankName: "PNB", accountNumber: "400012345678", ifscCode: "PUNB0123400", stateCode: "UP" },
    { name: "AgroMachinery Inc", alias: "AgroMach", tagline: "Tools for Toil", gstin: "03HHHHH7777H1Z2", address: "77 Machine Rd, Ludhiana, PB", phone: "9112233445", email: "service@agromach.com", invoicePrefix: "AMI", bankName: "Canara", accountNumber: "112233445566", ifscCode: "CNRB0001234", stateCode: "PB" },
    { name: "NatureBounty", alias: "Bounty", tagline: "Nature's Best", gstin: "32IIIII8888I1Z3", address: "99 Nature Dr, Kochi, KL", phone: "9444555666", email: "info@naturebounty.com", invoicePrefix: "NB", bankName: "Union", accountNumber: "556677889900", ifscCode: "UBIN0530000", stateCode: "KL" },
    { name: "Organic Roots", alias: "Roots", tagline: "Back to Roots", gstin: "19JJJJJ9999J1Z4", address: "11 Root Way, Kolkata, WB", phone: "9333444555", email: "contact@organicroots.com", invoicePrefix: "OR", bankName: "IndusInd", accountNumber: "223344556677", ifscCode: "INDB0000123", stateCode: "WB" }
];

const CUSTOMERS: SeedCustomer[] = [
    { name: "Laxmi General Store", gstin: "29LGS1234L1Z1", address: "Market Yard, Bangalore", phone: "9000100010", placeOfSupply: "Karnataka", email: "laxmi@store.com", stateCode: "KA", invoiceProductName: "HDPE GRANULES" },
    { name: "Kisan Seva Kendra", gstin: "29KSK5678K1Z2", address: "Rural Rd, Mandya", phone: "9000200020", placeOfSupply: "Karnataka", email: "kisan@seva.com", stateCode: "KA", invoiceProductName: "LDPE PELLETS" },
    { name: "Annapurna Traders", gstin: "27ANA4321A1Z3", address: "Main Bazaar, Solapur", phone: "9000300030", placeOfSupply: "Maharashtra", email: "annapurna@traders.com", stateCode: "MH", invoiceProductName: "PP REPRO GRANULES" },
    { name: "Global Exports", gstin: "33GLE8765G1Z4", address: "Port Rd, Chennai", phone: "9000400040", placeOfSupply: "Tamil Nadu", email: "global@exports.com", stateCode: "TN", invoiceProductName: "LLDPE MASTERBATCH" },
    { name: "Vinayaka Agencies", gstin: "36VNA1122V1Z5", address: "Ring Road, Warangal", phone: "9000500050", placeOfSupply: "Telangana", email: "vinayaka@agencies.com", stateCode: "TS", invoiceProductName: "PVC RESIN" },
    { name: "Jai Hind Fertilizers", gstin: "24JHF3344J1Z6", address: "Station Rd, Surat", phone: "9000600060", placeOfSupply: "Gujarat", email: "jaihind@ferti.com", stateCode: "GJ", invoiceProductName: "NYLON CHIPS" },
    { name: "Ganga Farmers Club", gstin: "09GFC5566G1Z7", address: "River Bank, Varanasi", phone: "9000700070", placeOfSupply: "Uttar Pradesh", email: "ganga@club.com", stateCode: "UP", invoiceProductName: "ABS PELLETS" },
    { name: "Punjab Wheats", gstin: "03PWH7788P1Z8", address: "GT Road, Amritsar", phone: "9000800080", placeOfSupply: "Punjab", email: "punjab@wheats.com", stateCode: "PB", invoiceProductName: "HIPS GRANULES" },
    { name: "Kerala Spices", gstin: "32KSP9900K1Z9", address: "Hill Top, Munnar", phone: "9000900090", placeOfSupply: "Kerala", email: "kerala@spices.com", stateCode: "KL", invoiceProductName: "PET FLAKES" },
    { name: "Eastern Traders", gstin: "19EST1234E1Z0", address: "New Market, Siliguri", phone: "9000011111", placeOfSupply: "West Bengal", email: "eastern@traders.com", stateCode: "WB", invoiceProductName: "PC GRANULES" }
];

const PRODUCTS = [
    { name: "Premium Urea (50kg)", description: "High nitrogen fertilizer", hsn: "3102", unitPrice: 350, taxRate: 18 },
    { name: "DAP (50kg)", description: "Di-ammonium Phosphate", hsn: "3105", unitPrice: 1200, taxRate: 18 },
    { name: "Potash (50kg)", description: "Muriate of Potash", hsn: "3104", unitPrice: 900, taxRate: 18 },
    { name: "Hybrid Maize Seeds (1kg)", description: "High yield variety", hsn: "1205", unitPrice: 450, taxRate: 18 },
    { name: "Pesticide - KillerX (1L)", description: "Broad spectrum insecticide", hsn: "3808", unitPrice: 850, taxRate: 18 },
    { name: "Fungicide - CureAll (500g)", description: "Systemic fungicide", hsn: "3808", unitPrice: 600, taxRate: 18 },
    { name: "Tractor Oil (5L)", description: "High performance engine oil", hsn: "2710", unitPrice: 1500, taxRate: 18 },
    { name: "Sprayer Pump (Battery)", description: "16L knapsack sprayer", hsn: "8424", unitPrice: 3500, taxRate: 18 },
    { name: "Drip Irrigation Pipe (100m)", description: "16mm lateral pipe", hsn: "3917", unitPrice: 1200, taxRate: 18 },
    { name: "Bio-Fertilizer (1L)", description: "Organic growth promoter", hsn: "3101", unitPrice: 300, taxRate: 18 }
];

export const isDbEmpty = async () => {
    const c = await db.companies.count();
    const cu = await db.customers.count();
    const p = await db.products.count();
    const i = await db.invoices.count();
    return c === 0 && cu === 0 && p === 0 && i === 0;
};

const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomDate = (start: Date, end: Date) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

export const seedDemoData = async () => {
    if (!(await isDbEmpty())) {
        throw new Error("Database is not empty. Cannot seed data.");
    }

    await db.transaction('rw', [db.companies, db.customers, db.products, db.invoices, db.invoiceVersions], async () => {
        // 1. Add Entities
        // Remove stateCode before inserting to DB to avoid type error? 
        // IndexedDB is schema-less/flexible in JS, it will just store the extra prop. 
        // But TS might complain if we cast to Company.
        // Let's rely on 'as any' for insertion to bypass strict interface check for the extra field,
        // or cleaner: destructure.

        const companiesWithIds: (SeedCompany & { id: number })[] = [];
        const customersWithIds: (SeedCustomer & { id: number })[] = [];

        // Setup Companies
        for (const c of COMPANIES) {
            const { stateCode, ...dbComp } = c;
            const id = await db.companies.add(dbComp as Company);
            companiesWithIds.push({ ...c, id: id as number });
        }

        // Setup Customers
        for (const c of CUSTOMERS) {
            const { stateCode, ...dbCust } = c;
            const id = await db.customers.add(dbCust as Customer);
            customersWithIds.push({ ...c, id: id as number });
        }

        // Setup Products
        const prodIds = await db.products.bulkAdd(PRODUCTS as Product[], { allKeys: true }) as number[];
        const loadedProds = (await db.products.bulkGet(prodIds)).filter((p): p is Product => !!p);

        // 2. Generate Invoices
        // Date Range: April 1, 2024 to Present
        const startDate = new Date('2024-04-01');
        const endDate = new Date();

        const TOTAL_INVOICES = getRandomInt(400, 500);

        // Track counters per company
        const companyCounters: Record<number, number> = {};
        companiesWithIds.forEach(c => companyCounters[c.id] = 1);

        for (let i = 0; i < TOTAL_INVOICES; i++) {
            // Pick Random Company & Customer
            const comp = companiesWithIds[getRandomInt(0, companiesWithIds.length - 1)];
            const cust = customersWithIds[getRandomInt(0, customersWithIds.length - 1)];

            // Increment Invoice Counter
            const seq = companyCounters[comp.id];
            companyCounters[comp.id]++;
            const invoiceNumber = `${comp.invoicePrefix}-${seq}`;

            const invDate = getRandomDate(startDate, endDate);

            // Tax Logic
            const isIntrastate = comp.stateCode === cust.stateCode;
            const taxType = isIntrastate ? 'CGST_SGST' : 'IGST';

            // Random Items (1 to 3)
            const numItems = getRandomInt(1, 3);
            const items: InvoiceItem[] = [];
            let totalTax = 0;
            let subTotal = 0;

            for (let j = 0; j < numItems; j++) {
                const prod = loadedProds[getRandomInt(0, loadedProds.length - 1)];
                const bags = getRandomInt(1, 100);
                const quantity = bags * 25; // 1 Bag = 25kg
                const unitPrice = prod.unitPrice; // Fixed Price
                const taxRate = 18; // Fixed Tax

                const amount = quantity * unitPrice;
                const taxAmount = (amount * taxRate) / 100;

                subTotal += amount;
                totalTax += taxAmount;

                // Random Producer (from Companies)
                const producer = companiesWithIds[getRandomInt(0, companiesWithIds.length - 1)];

                items.push({
                    productId: prod.id!,
                    name: prod.name,
                    description: prod.description,
                    hsn: prod.hsn,
                    quantity,
                    unitPrice,
                    taxRate,
                    totalAmount: amount, // Logic Change (v4-calc): Use Subtotal only
                    taxAmount,
                    numberOfBags: bags,
                    producerName: producer.name,
                    producerId: producer.id
                });
            }

            const grandTotal = subTotal + totalTax;

            // v4: Generate Summary Item for Seeding
            const first = items[0];
            const sumBags = items.reduce((s, i) => s + (Number(i.numberOfBags)||0), 0);
            const sumQty = items.reduce((s, i) => s + (Number(i.quantity)||0), 0);

            const summaryItem = {
                description: first.description,
                hsn: first.hsn,
                unitPrice: first.unitPrice,
                taxRate: first.taxRate,
                numberOfBags: sumBags,
                quantity: sumQty,
                taxAmount: totalTax,
                totalAmount: subTotal,
                invoiceProductName: cust.invoiceProductName || 'PLASTIC REPROCESS GRANULES'
            };

            // Remove stateCode for DB object
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { stateCode: _sc, ...dbComp } = comp;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { stateCode: _cc, ...dbCust } = cust;

            // Version
            const version: InvoiceVersion = {
                invoiceId: 0, // Set later
                version: 1,
                date: invDate,
                items,
                subTotal,
                totalTax,
                grandTotal,
                sellerDetails: dbComp,
                buyerDetails: dbCust,
                referenceNumber: invoiceNumber,
                createdAt: invDate,
                taxType, // Populated
                summaryItem // Added (v4)
            };

            const invId = await db.invoices.add({
                invoiceNumber,
                date: invDate,
                customerId: cust.id,
                grandTotal,
                status: 'final',
            });

            version.invoiceId = invId as number;
            const verId = await db.invoiceVersions.add(version);

            await db.invoices.update(invId, { currentVersionId: verId as number });
        }
    });
};
