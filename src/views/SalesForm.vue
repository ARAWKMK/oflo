<script setup lang="ts">
import { computed, reactive, watch, onMounted, ref } from 'vue';
import { db, type InvoiceItem } from '../db/db';
import { useRouter, useRoute } from 'vue-router';
import { Trash2, Plus, Save } from 'lucide-vue-next';
import BaseButton from '../components/ui/BaseButton.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { useLiveQuery } from '../composables/useLiveQuery';
import { numberToWords } from '../utils/formatters';
import { useInvoiceStore } from '../stores/invoiceStore';

const router = useRouter();
const route = useRoute();
const store = useInvoiceStore();

// Data Loading
const products = useLiveQuery(() => db.products.toArray());
const customers = useLiveQuery(() => db.customers.toArray());
const companies = useLiveQuery(() => db.companies.toArray());

// Form State
const state = reactive({
    id: undefined as number | undefined, // Invoice ID if editing
// ... (lines 21-88 omitted, assume matched by context if I keep context small? No, replace_file_content is better)
// I will just replace the top import and the watcher block separately if possible, or all together.
// Let's replace the top imports first.
    companyId: '' as string | number,
    customerId: '' as string | number,
    invoiceNumber: '',
    referenceNumber: '',
    date: new Date().toISOString().split('T')[0],
    vehicleNumber: '',
    deliveryAddress: '', // v3
    summaryItem: { // v3
        description: '',
        hsn: '',
        numberOfBags: 0,
        quantity: 0,
        unitPrice: 0,
        taxRate: 18,
        taxAmount: 0,
        totalAmount: 0
    },
    items: [] as any[],
    status: 'final' // v4 Default
});

const isLoading = ref(true); // Lock for initial load

const isEditMode = computed(() => !!state.id);
const customerOptions = computed(() => customers.value?.map(c => ({ id: c.id!, name: c.name })) || []);
const companyOptions = computed(() => companies.value?.map(c => ({ id: c.id!, name: c.name })) || []);
const productOptions = computed(() => products.value?.map(p => ({ id: p.id!, name: p.name })) || []);

const selectedCompany = computed(() => companies.value?.find(c => c.id === state.companyId));
const selectedCustomer = computed(() => customers.value?.find(c => c.id === state.customerId));

// Load Data if Edit Mode
onMounted(async () => {
    let invId: number | undefined = undefined;
    
    if (route.params.invoiceNo) {
        // Edit Mode with Invoice No
        const invNo = route.params.invoiceNo as string;
        const inv = await db.invoices.where('invoiceNumber').equals(invNo).first();
        if (inv) invId = inv.id;
    } else if (route.params.id) {
        invId = Number(route.params.id);
    }

    if (invId) {
        const verId = route.query.versionId ? Number(route.query.versionId) : undefined;
        const inv = await db.invoices.get(invId);
        if (inv) {
            state.id = inv.id;
            state.invoiceNumber = inv.invoiceNumber;
            
            let ver = undefined;
            if (verId) ver = await db.invoiceVersions.get(verId);
            else if (inv.currentVersionId) ver = await db.invoiceVersions.get(inv.currentVersionId);

            if (ver) {
                state.companyId = ver.sellerDetails.id!;
                state.customerId = ver.buyerDetails.id!;
                state.date = ver.date.toISOString().split('T')[0];
                state.vehicleNumber = ver.vehicleNumber || '';
                state.referenceNumber = ver.referenceNumber;
                state.deliveryAddress = ver.buyerDetails.deliveryAddress || ''; // v3
                
                state.items = ver.items.map(i => ({
                    productId: i.productId,
                    description: i.description,
                    name: i.name, 
                    hsn: i.hsn,
                    numberOfBags: i.numberOfBags,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    taxRate: i.taxRate,
                    taxAmount: i.taxAmount,
                    totalAmount: (i.quantity * i.unitPrice).toFixed(2),
                    producerId: i.producerId, // v3
                    producerName: i.producerName // v3
                }));

                // Load Summary if exists, else compute
                if (ver.summaryItem) {
                    state.summaryItem = { ...ver.summaryItem };
                } else {
                    computeSummary();
                }

                // Load Status (default final if missing)
                state.status = (ver as any).status || 'final';
            }
        }
    }

    // Release Lock after DOM updates
    setTimeout(() => {
        isLoading.value = false;
    }, 100);
});


// Smart Invoice Number Generation
// Smart Invoice Number Generation
watch(() => state.companyId, async (newId) => {
    if (isEditMode.value) return; 

    if (newId) {
        if (typeof newId === 'number') {
             state.invoiceNumber = await store.generateNextInvoiceNumber(newId);
             state.referenceNumber = `${state.invoiceNumber}-v1`;
        } else {
             const id = Number(newId);
             if (!isNaN(id)) {
                 state.invoiceNumber = await store.generateNextInvoiceNumber(id);
                 state.referenceNumber = `${state.invoiceNumber}-v1`;
             }
        }
    } else {
        state.invoiceNumber = '';
        state.referenceNumber = '';
    }
});

// Auto-fill Delivery Address
watch(() => state.customerId, (newId) => {
    if (newId) {
        const c = customers.value?.find(x => x.id === newId);
        if (c) {
             // Fallback to address if deliveryAddress not present (User requirement: "same as Client Address")
             state.deliveryAddress = c.deliveryAddress || c.address; 
        }
    }
});

// Actions
const addItem = () => {
    state.items.push({
        productId: 0,
        description: '',
        name: '',
        hsn: '',
        numberOfBags: 0,
        quantity: 0,
        unitPrice: 0,
        taxRate: 18,
        taxAmount: 0,
        totalAmount: 0,
        producerId: '' // v3
    });
};

const removeItem = (index: number) => {
    state.items.splice(index, 1);
};

// Calculations
const onProductSelect = (row: any, prodId: any) => {
    const p = products.value?.find(x => x.id === Number(prodId));
    if (p) {
        row.description = p.description || p.name; 
        row.name = p.name;
        row.unitPrice = p.unitPrice;
        row.taxRate = p.taxRate;
        row.hsn = p.hsn;
        calculateRow(row);
    }
};

const calculateRow = (row: any) => {
    const bags = Number(row.numberOfBags) || 0;
    if (bags > 0) {
        row.quantity = bags * 25;
    }

    const qty = Number(row.quantity) || 0;
    const price = Number(row.unitPrice) || 0;
    const base = qty * price;
    const taxRate = Number(row.taxRate) || 0;
    row.taxAmount = Number((base * (taxRate / 100)).toFixed(2));
    row.totalAmount = base; 
};

const computeSummary = () => {
    // Logic: Take 1st row attrs, Sum Qty/Bags
    if (!state.items.length) return;
    if (isLoading.value) return; // Prevent overwriting during load
    
    const first = state.items[0];
    const sumBags = state.items.reduce((s, i) => s + (Number(i.numberOfBags)||0), 0);
    const sumQty = state.items.reduce((s, i) => s + (Number(i.quantity)||0), 0);
    // User Update: Taxable in Summary should be Qty * Price
    const price = Number(first.unitPrice) || 0;
    const rate = Number(first.taxRate) || 0;
    
    // Recalculate based on Summary Qty (Source of Truth for Tax Invoice)
    const base = sumQty * price;
    const tax = base * (rate / 100);

    state.summaryItem = {
        description: first.description,
        hsn: first.hsn,
        unitPrice: price,
        taxRate: rate,
        numberOfBags: sumBags,
        quantity: sumQty,
        taxAmount: Number(tax.toFixed(2)),
        totalAmount: Number(base.toFixed(2)) // "Taxable" as per user request (was Total)
    };
};

const recalculateSummary = () => {
   // Triggered on Manual Edit of Summary Items
   const s = state.summaryItem;
   const qty = Number(s.quantity) || 0;
   const price = Number(s.unitPrice) || 0;
   const rate = Number(s.taxRate) || 0;
   
   const base = qty * price;
   const tax = base * (rate / 100);
   
   s.taxAmount = Number(tax.toFixed(2));
   s.totalAmount = Number(base.toFixed(2));
};

watch(() => state.items, computeSummary, { deep: true });

const finance = computed(() => {
    const seller = companies.value?.find(c => c.id === state.companyId);
    const buyer = customers.value?.find(c => c.id === state.customerId);
    
    // User Update: Financials linked to Summary Table
    const s = state.summaryItem;
    const subTotal = Number(s.totalAmount) || 0; // Taxable Value
    
    // Re-verify Tax from SubTotal (Consistency)
    const tax = subTotal * (Number(s.taxRate)/100 || 0.18);
    const totalTax = Number(tax.toFixed(2));

    let taxType = 'IGST';
    let sgst = 0;
    let cgst = 0;
    let igst = 0;

    if (seller && buyer) {
        const sellerState = seller.gstin.substring(0, 2);
        const buyerState = buyer.gstin.substring(0, 2);
        
        if (sellerState === buyerState) {
            taxType = 'CGST_SGST';
            cgst = totalTax / 2;
            sgst = totalTax / 2;
        } else {
            taxType = 'IGST';
            igst = totalTax;
        }
    } else {
         igst = totalTax;
    }

    const grandTotalRaw = subTotal + totalTax;
    const grandTotal = Math.ceil(grandTotalRaw);
    const roundOff = grandTotal - grandTotalRaw;

    return {
        subTotal,
        totalTax,
        grandTotal,
        roundOff,
        taxType, 
        cgst,
        sgst,
        igst
    };
});

const save = async () => {
    // console.log("Save: Initiated", state);
    if (!state.companyId) return alert('Select a Company');
    if (!state.customerId) return alert('Select a Customer');
    if (!state.items.length) return alert('Add at least one item');

    try {
        // console.log("Save: Preparing Data");
        const seller = JSON.parse(JSON.stringify(companies.value?.find(c => c.id === state.companyId)));
        const buyer = JSON.parse(JSON.stringify(customers.value?.find(c => c.id === state.customerId)));
        
        // Update Snapshot with current Delivery Address
        buyer.deliveryAddress = state.deliveryAddress;
        
        if (!seller || !buyer) throw new Error("Invalid Selection");

        const finalItems: InvoiceItem[] = state.items.map(i => ({
            productId: i.productId,
            name: i.name || i.description,
            description: i.description,
            hsn: i.hsn,
            numberOfBags: Number(i.numberOfBags),
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            taxRate: Number(i.taxRate),
            taxAmount: Number(((Number(i.quantity) * Number(i.unitPrice)) * (Number(i.taxRate) / 100)).toFixed(2)),
            totalAmount: Number(((Number(i.quantity) * Number(i.unitPrice)) * (1 + Number(i.taxRate) / 100)).toFixed(2)),
            producerId: i.producerId ? Number(i.producerId) : undefined,
            producerName: i.producerId ? (companies.value?.find(c => c.id === Number(i.producerId))?.name) : undefined
        }));

        // console.log("Save: Starting Transaction");
        await db.transaction('rw', db.invoices, db.invoiceVersions, async () => {
            let invId = state.id;
            let newRef = state.referenceNumber;

            if (isEditMode.value && invId) {
                // console.log("Save: Edit Mode - Creating new version for Invoice", invId);
                // Versioning logic
                // Ensure we count ALL versions (robust check)
                const allVers = await db.invoiceVersions.where('invoiceId').equals(invId).toArray();
                const maxVer = allVers.length > 0 ? Math.max(...allVers.map(v => v.version)) : 0;
                const nextVer = maxVer + 1;
                
                // console.log("Save: Next Version", nextVer);
                newRef = `${state.invoiceNumber}-v${nextVer}`;

                const newVerId = await db.invoiceVersions.add({
                    invoiceId: invId,
                    version: nextVer,
                    date: new Date(state.date),
                    sellerDetails: seller,
                    buyerDetails: buyer,
                    items: finalItems,
                    vehicleNumber: state.vehicleNumber,
                    subTotal: finance.value.subTotal,
                    totalTax: finance.value.totalTax,
                    grandTotal: finance.value.grandTotal,
                    roundOff: finance.value.roundOff,
                    referenceNumber: newRef,
                    taxType: finance.value.taxType as any,
                    summaryItem: JSON.parse(JSON.stringify(state.summaryItem)), // v3 Fix Clone
                    status: state.status as any, // v4
                    createdAt: new Date()
                });
                // console.log("Save: Added Version", newVerId);

                await db.invoices.update(invId, { 
                    currentVersionId: Number(newVerId),
                    grandTotal: finance.value.grandTotal,
                    date: new Date(state.date),
                    status: state.status as any // v4
                });
                // console.log("Save: Updated Invoice Pointer");

            } else {
                // console.log("Save: New Invoice Mode");
                invId = await db.invoices.add({
                    invoiceNumber: state.invoiceNumber,
                    customerId: state.customerId as number,
                    date: new Date(state.date),
                    grandTotal: finance.value.grandTotal,
                    vehicleNumber: state.vehicleNumber
                } as any);
                // console.log("Save: Added Invoice", invId);

                const v1Id = await db.invoiceVersions.add({
                    invoiceId: Number(invId),
                    version: 1,
                    date: new Date(state.date),
                    sellerDetails: seller,
                    buyerDetails: buyer,
                    items: finalItems,
                    vehicleNumber: state.vehicleNumber,
                    subTotal: finance.value.subTotal,
                    totalTax: finance.value.totalTax,
                    grandTotal: finance.value.grandTotal,
                    roundOff: finance.value.roundOff,
                    referenceNumber: state.referenceNumber, 
                    taxType: finance.value.taxType as any,
                    summaryItem: JSON.parse(JSON.stringify(state.summaryItem)), // v3 Fix Clone
                    status: state.status as any, // v4
                    createdAt: new Date()
                });
                // console.log("Save: Added V1", v1Id);
                
                await db.invoices.update(invId, { currentVersionId: Number(v1Id), status: state.status as any });
            }
        });

        // console.log("Save: Complete");
        alert('Sale Saved Successfully');
        if (state.id) {
             router.push(`/sales/${state.invoiceNumber}`);
        } else {
             router.push(`/sales`);
        }
       
    } catch (e: any) {
        // console.error("Save: Failed", e);
        alert('Error: ' + e.message);
    }
};

const amountInWords = computed(() => numberToWords(finance.value.grandTotal));
</script>

<template>
<div class="page-container">
    <PageHeader title="New Sale" :showBack="true" />

    <div class="invoice-paper">
        
        <!-- SECTION 1: HEADER & COMPANY -->
        <header class="section-company">
            <!-- Line 0: Reference No (Center) - User change -->
            <div class="row-ref-center">
                <span class="label">Reference No:</span>
                <span class="value">{{ state.referenceNumber || '---' }}</span>
            </div>

            <!-- Line 1: Company Select (Center) -->
            <div class="row-company-select">
                <select v-model="state.companyId" class="input-compact select-company" :disabled="isEditMode">
                    <option value="" disabled>Select Company</option>
                    <option v-for="c in companyOptions" :value="c.id">{{ c.name }}</option>
                </select>
                <div v-if="isEditMode" style="font-size: 0.75rem; color: var(--color-fg-secondary); margin-top: 0.2rem;">(Cannot change Company on Edit)</div>
            </div>

            <template v-if="selectedCompany">
                <!-- Line 2: Tagline (Center) -->
                <div class="row-tagline" v-if="selectedCompany.tagline">
                    {{ selectedCompany.tagline }}
                </div>
                <!-- Line 3: Address (Left with Label) - User change -->
                <div class="row-address-left">
                    <span class="label">ADDRESS:</span>
                    <span class="value">{{ selectedCompany.address }}</span>
                </div>

                <!-- Metrics Grid -->
                <div class="row-split">
                    <div class="left"><span class="label">GSTIN:</span> <span class="value">{{ selectedCompany.gstin }}</span></div>
                    <div class="right"><span class="label">Invoice No:</span> <span class="value">{{ state.invoiceNumber || '---' }}</span></div>
                </div>
                <div class="row-split">
                    <div class="left"><span class="label">Email:</span> <span class="value">{{ selectedCompany.email || '---' }}</span></div>
                    <div class="right"><span class="label">Date:</span> <input type="date" v-model="state.date" class="input-inline" /></div>
                </div>
                <div class="row-split">
                    <div class="left"><span class="label">Mobile:</span> <span class="value">{{ selectedCompany.phone || '---' }}</span></div>
                    <div class="right"><span class="label">Vehicle No:</span> <input v-model="state.vehicleNumber" @input="state.vehicleNumber = state.vehicleNumber.toUpperCase()" placeholder="Enter vehicle no." class="input-inline" /></div>
                </div>
            </template>
        </header>

        <hr class="separator" />

        <!-- SECTION 2: CUSTOMER (Left Aligned) - User change -->
        <section class="section-customer">
            <div class="row-customer-select-left">
                <select v-model="state.customerId" class="input-compact select-customer-left">
                    <option value="" disabled>Select Customer</option>
                    <option v-for="c in customerOptions" :value="c.id">{{ c.name }}</option>
                </select>
            </div>
            <template v-if="selectedCustomer">
                <div class="row-address-left">
                    <span class="label">Customer Address:</span>
                    <span class="value">{{ selectedCustomer.address }}</span>
                </div>
                <!-- GST Left -->
                <div class="row-gst-left"><span class="label">Customer GST:</span> <span class="value">{{ selectedCustomer.gstin }}</span></div>
                <!-- Delivery Address -->
                <!-- Delivery Address -->
                <div class="row-address-left" style="white-space: pre-wrap; margin-top: 0.5rem;">
                    <span class="label">Delivery Address:</span>
                    <span class="value">{{ state.deliveryAddress }}</span>
                </div>
            </template>
        </section>

        <!-- SECTION 3: ITEMS TABLE -->
        <section class="section-items">
            <div class="table-container">
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th style="width: 15%">Producer</th>
                            <th style="width: 20%">Product</th>
                            <th style="width: 15%">Description</th>
                            <th style="width: 8%">HSN</th>
                            <th style="width: 6%">Bags</th>
                            <th style="width: 8%">Qty</th>
                            <th style="width: 10%">Price</th>
                            <th style="width: 6%">Tax %</th>
                            <th style="width: 10%">Taxable</th>
                            <th style="width: 2%"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in state.items" :key="idx">
                            <td>
                                <select v-model="item.producerId" class="input-compact select-table">
                                    <option value="" disabled>Select</option>
                                    <option v-for="c in companyOptions" :value="c.id">{{ c.name }}</option>
                                </select>
                            </td>
                            <td>
                                <select v-model="item.productId" @change="onProductSelect(item, item.productId)" class="input-compact select-table">
                                    <option :value="0" disabled>Select</option>
                                    <option v-for="p in productOptions" :value="p.id">{{ p.name }}</option>
                                </select>
                            </td>
                            <td><input v-model="item.description" class="input-compact" /></td>
                            <td><input v-model="item.hsn" class="input-compact" /></td>
                            <td><input type="number" v-model="item.numberOfBags" @input="calculateRow(item)" class="input-compact text-right" /></td>
                            <td><input type="number" v-model="item.quantity" @input="calculateRow(item)" class="input-compact text-right" /></td>
                            <td><input type="number" v-model="item.unitPrice" @input="calculateRow(item)" class="input-compact text-right" /></td>
                            <td><input type="number" v-model="item.taxRate" @input="calculateRow(item)" class="input-compact text-right" /></td>
                            <td class="text-right val-cell">{{ ((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2) }}</td>
                            <td class="text-center"><button @click="removeItem(idx)" class="btn-icon-danger"><Trash2 :size="14"/></button></td>
                        </tr>
                        <tr v-if="state.items.length === 0"><td colspan="9" class="empty-row">No items added</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="table-actions">
                 <BaseButton variant="secondary" @click="addItem" class="btn-add-sm"><Plus :size="14"/> Add Item</BaseButton>
            </div>
        </section>

        <section class="section-summary-item" style="margin-top: 1rem;">
             <div class="f-words-header">INVOICE SUMMARY (Auto-Calculated)</div>
             <div class="table-container">
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th style="width: 30%">Description</th>
                            <th style="width: 10%">HSN</th>
                            <th style="width: 10%">Bags</th>
                            <th style="width: 10%">Qty</th>
                            <th style="width: 10%">Price</th>
                            <th style="width: 10%">Tax %</th>
                            <th style="width: 15%">Taxable</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input v-model="state.summaryItem.description" class="input-compact" /></td>
                            <td><input v-model="state.summaryItem.hsn" class="input-compact" /></td>
                            <td><input type="number" v-model="state.summaryItem.numberOfBags" class="input-compact text-right" /></td>
                            <td><input type="number" v-model="state.summaryItem.quantity" @input="recalculateSummary" class="input-compact text-right" /></td>
                            <td><input type="number" v-model="state.summaryItem.unitPrice" @input="recalculateSummary" class="input-compact text-right" /></td>
                            <td><input type="number" v-model="state.summaryItem.taxRate" @input="recalculateSummary" class="input-compact text-right" /></td>
                            <td class="text-right val-cell">{{ state.summaryItem.totalAmount }}</td>
                        </tr>
                    </tbody>
                </table>
             </div>
        </section>

        <hr class="separator" />

        <!-- SECTION 4: FOOTER (Single Grid) -->
        <section class="section-footer-grid">
            
            <!-- Row 1: Headers -->
            <div class="f-cell f-bank-header">BANK DETAILS</div>
            <div class="f-cell f-spacer"></div>

            <!-- Row 2: Content (Bank & Subtotals take up space naturally) -->
            <div class="f-cell f-bank-content">
                <template v-if="selectedCompany && selectedCompany.bankName">
                    <div class="info-row"><span class="label">Bank Name:</span> <span class="value">{{ selectedCompany.bankName }}</span></div>
                    <div class="info-row"><span class="label">Acc. No.:</span> <span class="value">{{ selectedCompany.accountNumber }}</span></div>
                    <div class="info-row" v-if="selectedCompany.ifscCode"><span class="label">IFSC Code:</span> <span class="value">{{ selectedCompany.ifscCode }}</span></div>
                </template>
                <div v-else class="placeholder-text">-- No Bank Details --</div>
            </div>

            <div class="f-cell f-subtotals">
                <div class="f-finance-row"><span class="label">Subtotal</span> <span class="val">₹{{ finance.subTotal.toFixed(2) }}</span></div>
                <template v-if="finance.taxType === 'CGST_SGST'">
                    <div class="f-finance-row"><span class="label">CGST</span> <span class="val">₹{{ finance.cgst.toFixed(2) }}</span></div>
                    <div class="f-finance-row"><span class="label">SGST</span> <span class="val">₹{{ finance.sgst.toFixed(2) }}</span></div>
                </template>
                <template v-else>
                    <div class="f-finance-row"><span class="label">IGST</span> <span class="val">₹{{ finance.igst.toFixed(2) }}</span></div>
                </template>
                <!-- Round Off Removed per user request -->
            </div>

            <!-- Row 3: Words vs Grand Total (Aligned Sections) -->
            <div class="f-cell f-words-section">
                 <div class="f-words-header">In Words</div>
                 <div class="words-text">{{ amountInWords }}</div>
            </div>
            
            <div class="f-cell f-grand-total">
                <div class="grand-total-box">
                    <div class="gt-label">GRAND TOTAL</div>
                    <div class="gt-value">₹{{ finance.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}</div>
                </div>
            </div>

            <!-- Row 4: Terms (Left Only) -->
            <div class="f-cell f-terms-header">TERMS</div>
            <div class="f-cell f-empty"></div>

            <div class="f-cell f-terms-content">
                 <div class="terms-text" v-if="selectedCompany && selectedCompany.terms">{{ selectedCompany.terms }}</div>
                 <div class="placeholder-text" v-else>--</div>
            </div>
            <div class="f-cell f-empty"></div>

        </section>



        <!-- Status Toggle & Save -->
         <section class="status-action-row">
            <div class="status-toggle-wrapper">
                <span class="status-label">Status:</span>
                <div class="toggle-switch">
                    <input type="checkbox" id="statusToggle" v-model="state.status" true-value="final" false-value="draft">
                    <label for="statusToggle" class="toggle-slider">
                        <span class="toggle-text-draft">DRAFT</span>
                        <span class="toggle-text-final">FINAL</span>
                    </label>
                </div>
            </div>

            <button @click="save" class="btn btn-primary btn-save">
                <Save :size="16"/> Save Sale
            </button>
         </section>

    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; max-width: 1000px; margin: 0 auto; padding-bottom: 4rem; color: var(--color-fg-primary); }

/* Paper Layout */
.invoice-paper {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 2rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* Common Styles */
.label { font-weight: 600; font-size: 0.9rem; color: var(--color-fg-secondary); margin-right: 0.5rem; }
.value { font-weight: 500; font-size: 1rem; color: var(--color-fg-primary); }
.separator { border: none; border-bottom: 2px solid var(--color-border); margin: 0.5rem 0; }
.select-company { font-size: 1.2rem; font-weight: 700; text-align: center; border: 1px solid transparent; background: transparent; color: var(--color-primary); width: 100%; max-width: 400px; margin: 0 auto; display: block; }
.select-customer-left { font-size: 1.2rem; font-weight: 700; text-align: left; border: 1px solid transparent; background: transparent; color: var(--color-primary); width: 100%; display: block; margin: 0; }
.select-company:hover, .select-customer-left:hover { border-color: var(--color-border); background: var(--color-bg-app); }
.input-inline { border: none; border-bottom: 1px dashed var(--color-border); background: transparent; padding: 0 0.5rem; width: 150px; text-align: left; color: var(--color-fg-primary); font-family: inherit; font-size: 0.95rem; }
.input-inline:focus { border-bottom-style: solid; border-color: var(--color-primary); outline: none; }

/* Header & Customer Sections */
.section-company, .section-customer { display: flex; flex-direction: column; gap: 0.5rem; }
.row-ref-center { text-align: center; display: flex; justify-content: center; align-items: center; font-size: 0.9rem; margin-bottom: -1rem; }
.row-company-select { text-align: center; margin-bottom: 0.5rem; }
.row-customer-select-left { text-align: left; margin-bottom: 0.5rem; }
.row-tagline { text-align: center; font-style: italic; color: var(--color-fg-secondary); font-size: 0.9rem; margin-bottom: 0.2rem; min-height: 1.2rem; }
.row-address-left { text-align: left; white-space: pre-wrap; margin: 0; font-size: 0.95rem; line-height: 1.4; margin-bottom: 0.5rem; display: flex; gap: 0.5rem; }
.row-split { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 0.2rem; }
.row-split .left { text-align: left; }
.row-split .right { text-align: right; }
.row-gst-left { text-align: left; margin-top: 0.5rem; }

/* Items Section */
.section-items { margin-top: 1rem; }
.table-container { border: 1px solid var(--color-border); border-radius: 4px; overflow-x: auto; }
.compact-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.compact-table th { background: var(--color-bg-muted); padding: 0.5rem; text-align: left; font-weight: 600; border-bottom: 1px solid var(--color-border); }
.compact-table td { padding: 0.4rem; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
.compact-table input { width: 100%; background: transparent; border: none; padding: 0.2rem; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.btn-icon-danger { color: #ef4444; background: none; border: none; cursor: pointer; }
.table-actions { margin-top: 0.5rem; }

/* STRICT FOOTER GRID */
.section-footer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr; 
    gap: 1rem 3rem; 
    align-items: start;
}

.f-cell { display: flex; flex-direction: column; }
.f-bank-header, .f-words-header, .f-terms-header { font-weight: 700; text-transform: uppercase; font-size: 0.8rem; color: var(--color-fg-secondary); letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 0.2rem; }
.f-words-header { margin-bottom: 0.5rem; } /* Gap between header and text */
.f-terms-header { margin-top: 1.5rem; }

.f-bank-content { gap: 0.3rem; }
.info-row { display: flex; gap: 0.5rem; font-size: 0.9rem; }

.f-subtotals { gap: 0.5rem; justify-content: flex-start; }
.f-finance-row { display: flex; justify-content: space-between; font-size: 0.95rem; }
.f-finance-row .label { color: var(--color-fg-secondary); }
.f-finance-row .val { font-weight: 600; font-family: monospace; }

.f-words-section { 
    display: flex; 
    flex-direction: column; 
    margin-top: 1.5rem; /* Gap from bank details */
}
.words-text { font-style: italic; font-weight: 500; font-size: 1rem; color: var(--color-primary); line-height: 1.4; }

.f-grand-total { 
    display: flex; 
    justify-content: flex-start; 
    margin-top: 1.5rem; /* Match words section top */
}
.grand-total-box {
    background: var(--color-bg-app); 
    border: 2px solid var(--color-border); 
    padding: 1rem; 
    border-radius: 4px; 
    text-align: center; 
    width: 100%;
}
.gt-label { font-size: 0.8rem; color: var(--color-fg-secondary); font-weight: 600; text-transform: uppercase; margin-bottom: 0.2rem; }
.gt-value { font-size: 1.8rem; font-weight: 700; color: var(--color-primary); line-height: 1; }

.f-terms-content {}
.terms-text { white-space: pre-wrap; font-size: 0.85rem; color: var(--color-fg-primary); opacity: 0.9; }

.placeholder-text { font-style: italic; color: var(--color-fg-secondary); opacity: 0.5; font-size: 0.9rem; }

/* Status Toggle Styles */
.status-action-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 2rem;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}

.status-toggle-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.status-label {
    font-weight: 600;
    color: var(--color-fg-secondary);
}

.toggle-switch {
    position: relative;
    width: 160px; /* Increased width for better visibility */
    height: 36px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #1a1a1a;
    transition: .4s;
    border-radius: 36px;
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 5px; /* Reduced padding */
    overflow: hidden;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 28px;
    width: 28px;
    left: 4px;
    bottom: 3px;
    background-color: var(--color-fg-primary);
    transition: .4s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    z-index: 2;
}

input:checked + .toggle-slider {
    background-color: rgba(var(--color-primary-rgb), 0.2);
    border-color: var(--color-primary);
}

input:checked + .toggle-slider:before {
    transform: translateX(122px); /* Adjusted for new width */
    background-color: var(--color-primary);
}

.toggle-text-draft, .toggle-text-final {
    font-size: 0.8rem;
    font-weight: 800;
    z-index: 1;
    user-select: none;
    letter-spacing: 0.5px;
}

.toggle-text-draft { margin-left: 2.2rem; color: #ef4444; opacity: 1; }
.toggle-text-final { margin-right: 2.5rem; color: #22c55e; } /* Adjusted margins */

input:checked + .toggle-slider .toggle-text-draft { opacity: 0; }
input:not(:checked) + .toggle-slider .toggle-text-final { opacity: 0; }
input:not(:checked) + .toggle-slider { background-color: #2a2a2a; border-color: #444; }
input:not(:checked) + .toggle-slider:before { background-color: #ef4444; }

/* Invisible Input for Delivery */
.input-invisible {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--color-fg-primary);
    font-size: 0.95rem; /* Match body font size */
    font-weight: 500; /* Match label weight */
    font-family: 'Inter', sans-serif; /* Explicitly set font */
    resize: none;
    outline: none;
    padding: 0;
    line-height: 1.5; /* Match line height of spans */
    margin: 0;
    overflow: hidden;
}
.input-invisible::placeholder {
    font-style: normal; /* Remove italic */
    color: var(--color-fg-secondary);
    opacity: 0.5;
}
.delivery-input-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
}
.delivery-input-wrapper:hover .input-invisible {
    background: rgba(255,255,255,0.02);
}

@media (max-width: 768px) {
    .section-footer-grid { grid-template-columns: 1fr; gap: 1rem; }
    .f-words-header, .f-grand-total, .f-terms-header { margin-top: 1rem; }
    .row-split { grid-template-columns: 1fr; text-align: center !important; gap: 0.5rem; }
    .row-split .left, .row-split .right { text-align: center; }
    .status-action-row { flex-direction: column; gap: 1rem; }
}
</style>
