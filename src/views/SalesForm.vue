<script setup lang="ts">
import { computed, reactive, watch, onMounted, ref } from 'vue';
import { db, type InvoiceItem } from '../db/db';
import { useRouter, useRoute } from 'vue-router';
import { Trash2, Plus, Save, ChevronDown } from 'lucide-vue-next';
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
    id: undefined as number | undefined,
    companyId: '' as string | number,
    customerId: '' as string | number,
    invoiceNumber: '',
    referenceNumber: '',
    date: new Date().toISOString().split('T')[0],
    vehicleNumber: '',
    deliveryAddress: '', 
    summaryItem: {
        description: '', hsn: '', numberOfBags: 0, quantity: 0,
        unitPrice: 0, taxRate: 18, taxAmount: 0, totalAmount: 0
    },
    items: [] as any[],
    status: 'final' 
});

const isLoading = ref(true);

// Computed Helpers
const isEditMode = computed(() => !!state.id);
const customerOptions = computed(() => customers.value?.map(c => ({ id: c.id!, name: c.name })) || []);
const companyOptions = computed(() => companies.value?.map(c => ({ id: c.id!, name: c.name })) || []);
const productOptions = computed(() => products.value?.map(p => ({ id: p.id!, name: p.name })) || []);

const selectedCompany = computed(() => companies.value?.find(c => c.id === state.companyId));
const selectedCustomer = computed(() => customers.value?.find(c => c.id === state.customerId));

// v3: Delivery Address Logic
const availableDeliveryAddresses = computed(() => {
    if (!selectedCustomer.value) return [];
    if (!selectedCustomer.value.enableDelivery) return [];
    return selectedCustomer.value.deliveryAddresses || [];
});

const showDeliveryDropdown = computed(() => {
    return selectedCustomer.value?.enableDelivery && availableDeliveryAddresses.value.length > 0;
});

// Watcher: Auto-select Delivery Address
watch(() => state.customerId, (newId) => {
    if (newId) {
        const c = customers.value?.find(x => x.id === newId);
        if (c) {
            if (c.enableDelivery && c.deliveryAddresses?.length) {
                state.deliveryAddress = c.deliveryAddresses[0];
            } else {
                state.deliveryAddress = ''; // Reset if disabled
            }
        }
    }
});

// Smart Invoice Number
watch(() => state.companyId, async (newId) => {
    if (isEditMode.value) return; 
    if (newId) {
        const id = Number(newId);
        if (!isNaN(id)) {
            state.invoiceNumber = await store.generateNextInvoiceNumber(id);
            state.referenceNumber = `${state.invoiceNumber}-v1`;
        }
    } else {
        state.invoiceNumber = '';
        state.referenceNumber = '';
    }
});

// Load Data
onMounted(async () => {
    let invId: number | undefined = undefined;
    if (route.params.invoiceNo) {
        const inv = await db.invoices.where('invoiceNumber').equals(route.params.invoiceNo as string).first();
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
                state.deliveryAddress = ver.buyerDetails.deliveryAddress || '';
                
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
                    producerId: i.producerId,
                    producerName: i.producerName
                }));

                if (ver.summaryItem) {
                    state.summaryItem = { ...ver.summaryItem };
                } else {
                    performSummaryCalculation();
                }
                state.status = (ver as any).status || 'final';
            }
        }
    }
    setTimeout(() => isLoading.value = false, 100);
});

// Actions
const addItem = () => {
    state.items.push({
        productId: 0, description: '', name: '', hsn: '',
        numberOfBags: 0, quantity: 0, unitPrice: 0, taxRate: 18,
        taxAmount: 0, totalAmount: 0, producerId: ''
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
    if (bags > 0) row.quantity = bags * 25;

    const qty = Number(row.quantity) || 0;
    const price = Number(row.unitPrice) || 0;
    const base = qty * price;
    row.taxAmount = Number((base * (Number(row.taxRate)/100 || 0)).toFixed(2));
    row.totalAmount = base; 
};

const performSummaryCalculation = () => {
    if (!state.items.length) return;
    
    // Calculate Totals from Items
    const sumBags = state.items.reduce((s, i) => s + (Number(i.numberOfBags)||0), 0);
    const sumQty = state.items.reduce((s, i) => s + (Number(i.quantity)||0), 0);
    const first = state.items[0];

    // Check if Summary needs initialization (Fresh start or empty)
    // We treat "Description" as the key. If it's empty, we assume it's uninitialized.
    // Also if unitPrice is 0, we can assume it's uninitialized or needs sync.
    const isUninitialized = !state.summaryItem.description;

    if (isUninitialized) {
        // Full Sync (Copy everything)
        state.summaryItem = {
            description: first.description,
            hsn: first.hsn,
            unitPrice: Number(first.unitPrice) || 0,
            taxRate: Number(first.taxRate) || 0,
            numberOfBags: sumBags,
            quantity: sumQty,
            taxAmount: 0, // Will be calc by recalculateSummary
            totalAmount: 0 // Will be calc by recalculateSummary
        };
    } else {
        // Partial Sync (Preserve Manual Price/Desc, Update Qty only)
        state.summaryItem.numberOfBags = sumBags;
        state.summaryItem.quantity = sumQty;
    }

    // Always recalculate totals (Price * Qty)
    recalculateSummary();
};

const computeSummary = () => {
    if (isLoading.value) return;
    performSummaryCalculation();
};

const recalculateSummary = () => {
   const s = state.summaryItem;
   const base = (Number(s.quantity)||0) * (Number(s.unitPrice)||0);
   s.taxAmount = Number((base * ((Number(s.taxRate)||0) / 100)).toFixed(2));
   s.totalAmount = Number(base.toFixed(2));
};

watch(() => state.items, computeSummary, { deep: true });

const finance = computed(() => {
    const s = state.summaryItem;
    const subTotal = Number(s.totalAmount) || 0;
    const totalTax = Number((subTotal * (Number(s.taxRate)/100 || 0.18)).toFixed(2));

    let taxType = 'IGST';
    let sgst = 0, cgst = 0, igst = 0;

    if (selectedCompany.value && selectedCustomer.value) {
        const sellerState = selectedCompany.value.gstin.substring(0, 2);
        const buyerState = selectedCustomer.value.gstin.substring(0, 2);
        
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

    return { subTotal, totalTax, grandTotal, roundOff, taxType, cgst, sgst, igst };
});

const save = async () => {
    if (!state.companyId) return alert('Select a Company');
    if (!state.customerId) return alert('Select a Customer');
    if (!state.items.length) return alert('Add at least one item');

    try {
        const seller = JSON.parse(JSON.stringify(selectedCompany.value));
        const buyer = JSON.parse(JSON.stringify(selectedCustomer.value));
        
        // Save snapshot of delivery address used
        buyer.deliveryAddress = state.deliveryAddress;
        
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

        await db.transaction('rw', db.invoices, db.invoiceVersions, async () => {
            let invId = state.id;
            let newRef = state.referenceNumber;

            if (isEditMode.value && invId) {
                const allVers = await db.invoiceVersions.where('invoiceId').equals(invId).toArray();
                const maxVer = allVers.length > 0 ? Math.max(...allVers.map(v => v.version)) : 0;
                const nextVer = maxVer + 1;
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
                    summaryItem: JSON.parse(JSON.stringify(state.summaryItem)),
                    status: state.status as any,
                    createdAt: new Date()
                });

                await db.invoices.update(invId, { 
                    currentVersionId: Number(newVerId),
                    grandTotal: finance.value.grandTotal,
                    date: new Date(state.date),
                    status: state.status as any
                });

            } else {
                invId = await db.invoices.add({
                    invoiceNumber: state.invoiceNumber,
                    customerId: state.customerId as number,
                    date: new Date(state.date),
                    grandTotal: finance.value.grandTotal,
                    vehicleNumber: state.vehicleNumber
                } as any);

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
                    summaryItem: JSON.parse(JSON.stringify(state.summaryItem)),
                    status: state.status as any,
                    createdAt: new Date()
                });
                
                await db.invoices.update(invId, { currentVersionId: Number(v1Id), status: state.status as any });
            }
        });

        alert('Sale Saved Successfully');
        if (state.id) router.push(`/sales/${state.invoiceNumber}`);
        else router.push(`/sales`);
       
    } catch (e: any) {
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
            <div class="row-ref-center">
                <span class="label">Ref:</span>
                <span class="value">{{ state.referenceNumber || '---' }}</span>
            </div>

            <!-- Company Select -->
            <div class="row-company-select">
                <select v-model="state.companyId" class="input-glass select-company" :disabled="isEditMode">
                    <option value="" disabled>Select Company</option>
                    <option v-for="c in companyOptions" :value="c.id">{{ c.name }}</option>
                </select>
                <div v-if="isEditMode" class="text-xs text-sec mt-1">(Company locked in Edit Mode)</div>
            </div>

            <template v-if="selectedCompany">
                <!-- Tagline -->
                <div class="row-tagline" v-if="selectedCompany.tagline">
                    {{ selectedCompany.tagline }}
                </div>
                <!-- Address -->
                <div class="row-address-left">
                    <span class="label">ADDRESS:</span>
                    <span class="value">{{ selectedCompany.address }}</span>
                </div>

                <!-- Metrics Grid -->
                <!-- Metrics Split Layout -->
                <div class="header-split">
                    <!-- Left Column: Company Info -->
                    <div class="col-left sub-grid">
                        <span class="label">GSTIN:</span> 
                        <span class="value-mono">{{ selectedCompany.gstin }}</span>
                        
                        <span class="label">Email:</span> 
                        <span class="value">{{ selectedCompany.email || '---' }}</span>

                        <span class="label">Mobile:</span> 
                        <span class="value">{{ selectedCompany.phone || '---' }}</span>
                    </div>

                    <!-- Right Column: Invoice Info -->
                    <div class="col-right sub-grid">
                        <span class="label text-right">Invoice No:</span> 
                        <span class="value-mono highlight">{{ state.invoiceNumber || '---' }}</span>

                        <span class="label text-right">Date:</span> 
                        <div class="input-wrapper-fix">
                            <input type="date" v-model="state.date" class="input-glass-sm" />
                        </div>

                        <span class="label text-right">Vehicle No:</span> 
                        <div class="input-wrapper-fix">
                            <input v-model="state.vehicleNumber" @input="state.vehicleNumber = state.vehicleNumber.toUpperCase()" placeholder="MH12..." class="input-glass-sm" />
                        </div>
                    </div>
                </div>
            </template>
        </header>

        <div class="separator"></div>

        <!-- SECTION 2: CUSTOMER -->
        <section class="section-customer">
            <select v-model="state.customerId" class="input-glass select-customer">
                <option value="" disabled>Select Customer</option>
                <option v-for="c in customerOptions" :value="c.id">{{ c.name }}</option>
            </select>
            
            <template v-if="selectedCustomer">
                <div class="customer-details">
                    <div class="row-address-left">
                        <span class="label">Billing Address:</span>
                        <span class="value">{{ selectedCustomer.address }}</span>
                    </div>
                    <div class="field-group">
                        <span class="label">GSTIN:</span> 
                        <span class="value-mono">{{ selectedCustomer.gstin }}</span>
                    </div>
                    
                    <!-- Delivery Address Logic -->
                    <div class="delivery-address-block">
                        <div class="flex-between">
                            <span class="label">Delivery Address:</span>
                            <span v-if="showDeliveryDropdown" class="text-xs text-accent">Mode: Specific Location</span>
                            <span v-else class="text-xs text-sec">Mode: Default</span>
                        </div>
                        
                        <!-- If Enabled -> Dropdown -->
                        <div v-if="showDeliveryDropdown" class="mt-1">
                            <div class="select-wrapper">
                                <select v-model="state.deliveryAddress" class="input-glass w-full">
                                    <option v-for="addr in availableDeliveryAddresses" :value="addr">{{ addr }}</option>
                                </select>
                                <ChevronDown :size="14" class="select-icon"/>
                            </div>
                        </div>
                        <!-- Else -> Static Display -->
                        <div v-else class="mt-1 value text-sm opacity-80">
                            {{ state.deliveryAddress || selectedCustomer.address }}
                        </div>
                    </div>
                </div>
            </template>
        </section>

        <!-- SECTION 3: ITEMS TABLE -->
        <section class="section-items">
            <div class="table-container">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th style="width: 14%">Producer</th>
                            <th style="width: 18%">Product</th>
                            <th style="width: 19%">Description</th>
                            <th style="width: 8%; text-align: center;">HSN</th>
                            <th style="width: 8%; text-align: right;">Bags</th>
                            <th style="width: 10%; text-align: right;">Qty</th>
                            <th style="width: 9%; text-align: right;">Price</th>
                            <th style="width: 6%; text-align: right;">Tax %</th>
                            <th style="width: 10%; text-align: right;">Taxable</th>
                            <th style="width: 2%"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in state.items" :key="idx">
                            <td>
                                <select v-model="item.producerId" class="input-table">
                                    <option value="" disabled>Producer</option>
                                    <option v-for="c in companyOptions" :value="c.id">{{ c.name }}</option>
                                </select>
                            </td>
                            <td>
                                <select v-model="item.productId" @change="onProductSelect(item, item.productId)" class="input-table">
                                    <option :value="0" disabled>Select Product</option>
                                    <option v-for="p in productOptions" :value="p.id">{{ p.name }}</option>
                                </select>
                            </td>
                            <td><input v-model="item.description" class="input-table" placeholder="Desc" /></td>
                            <td><input v-model="item.hsn" class="input-table" placeholder="HSN" /></td>
                            <td><input type="number" v-model="item.numberOfBags" @input="calculateRow(item)" class="input-table text-right" /></td>
                            <td><input type="number" v-model="item.quantity" @input="calculateRow(item)" class="input-table text-right" /></td>
                            <td><input type="number" v-model="item.unitPrice" @input="calculateRow(item)" class="input-table text-right" /></td>
                            <td><input type="number" v-model="item.taxRate" @input="calculateRow(item)" class="input-table text-right" /></td>
                            <td class="text-right font-mono">{{ ((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2) }}</td>
                            <td class="text-center"><button @click="removeItem(idx)" class="btn-icon-danger"><Trash2 :size="14"/></button></td>
                        </tr>
                        <tr v-if="state.items.length === 0"><td colspan="10" class="empty-state">Add items to start sale</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="table-actions">
                 <BaseButton variant="ghost" @click="addItem" class="btn-sm text-accent"><Plus :size="14"/> Add Line</BaseButton>
            </div>
        </section>

        <!-- SUMMARY SECTION -->
        <section class="section-summary-item" style="margin-top: 2rem;">
             <div class="section-header">INVOICE SUMMARY (Auto-Calculated)</div>
             <div class="table-container">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th style="width: 30%">Description</th>
                            <th style="width: 10%; text-align: center;">HSN</th>
                            <th style="width: 10%; text-align: right;">Bags</th>
                            <th style="width: 10%; text-align: right;">Qty</th>
                            <th style="width: 10%; text-align: right;">Price</th>
                            <th style="width: 10%; text-align: right;">Tax %</th>
                            <th style="width: 15%; text-align: right;">Taxable</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input v-model="state.summaryItem.description" class="input-table" /></td>
                            <td><input v-model="state.summaryItem.hsn" class="input-table" /></td>
                            <td><input type="number" v-model="state.summaryItem.numberOfBags" class="input-table text-right" /></td>
                            <td><input type="number" v-model="state.summaryItem.quantity" @input="recalculateSummary" class="input-table text-right" /></td>
                            <td><input type="number" v-model="state.summaryItem.unitPrice" @input="recalculateSummary" class="input-table text-right" /></td>
                            <td><input type="number" v-model="state.summaryItem.taxRate" @input="recalculateSummary" class="input-table text-right" /></td>
                            <td class="text-right font-mono">{{ state.summaryItem.totalAmount }}</td>
                        </tr>
                    </tbody>
                </table>
             </div>
        </section>

        <div class="separator-dashed"></div>

        <!-- FOOTER GRID -->
        <section class="footer-grid">
            <!-- Bank Details -->
            <div class="col-bank">
                <div class="section-header">BANK DETAILS</div>
                <div class="bank-box card-inset">
                    <template v-if="selectedCompany && selectedCompany.bankName">
                        <div class="info-row"><span class="label">Bank:</span> <span class="val">{{ selectedCompany.bankName }}</span></div>
                        <div class="info-row"><span class="label">A/C:</span> <span class="val">{{ selectedCompany.accountNumber }}</span></div>
                        <div class="info-row" v-if="selectedCompany.ifscCode"><span class="label">IFSC:</span> <span class="val">{{ selectedCompany.ifscCode }}</span></div>
                    </template>
                    <div v-else class="text-sm opacity-50 italic">No bank details configured.</div>
                </div>
            </div>

            <!-- Totals -->
            <div class="col-totals">
                <div class="total-row"><span class="label">Subtotal</span> <span class="val">₹{{ finance.subTotal.toFixed(2) }}</span></div>
                <template v-if="finance.taxType === 'CGST_SGST'">
                    <div class="total-row"><span class="label">CGST</span> <span class="val">₹{{ finance.cgst.toFixed(2) }}</span></div>
                    <div class="total-row"><span class="label">SGST</span> <span class="val">₹{{ finance.sgst.toFixed(2) }}</span></div>
                </template>
                <template v-else>
                    <div class="total-row"><span class="label">IGST</span> <span class="val">₹{{ finance.igst.toFixed(2) }}</span></div>
                </template>
                
                <div class="grand-total-box mt-4">
                    <div class="gt-label">GRAND TOTAL</div>
                    <div class="gt-value">₹{{ finance.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}</div>
                </div>
                <div class="words-text mt-2">{{ amountInWords }}</div>
            </div>
            
            <!-- Terms -->
            <div class="col-terms mt-4">
                <div class="section-header">TERMS</div>
                <div class="text-sm opacity-80 whitespace-pre-wrap">{{ selectedCompany?.terms || '--' }}</div>
            </div>
        </section>

        <!-- Actions -->
         <section class="action-bar">
            <div class="flex items-center gap-4">
                <span class="text-sm font-medium text-sec">Status:</span>
                <div class="toggle-switch">
                    <input type="checkbox" id="statusToggle" v-model="state.status" true-value="final" false-value="draft">
                    <label for="statusToggle" class="toggle-label">
                        <span class="toggle-text px-3 py-1 text-xs font-bold rounded" :class="state.status === 'draft' ? 'bg-red-500/20 text-red-500' : 'opacity-40'">DRAFT</span>
                        <span class="toggle-text px-3 py-1 text-xs font-bold rounded" :class="state.status === 'final' ? 'bg-green-500/20 text-green-500' : 'opacity-40'">FINAL</span>
                    </label>
                </div>
            </div>

            <BaseButton @click="save" class="btn-primary shadow-glow">
                <Save :size="18"/> Save Sale
            </BaseButton>
         </section>

    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem 4rem; max-width: 1100px; margin: 0 auto; color: var(--color-fg-primary); }

.invoice-paper {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 2.5rem;
    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
    display: flex; flex-direction: column; gap: 2rem;
}

/* Typography & Layout */
.label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-fg-tertiary); }
.value { font-size: 0.95rem; font-weight: 500; color: var(--color-fg-primary); }
.value-mono { font-family: var(--font-mono); font-size: 0.9rem; letter-spacing: -0.02em; }
.text-sec { color: var(--color-fg-secondary); }
.text-accent { color: var(--color-primary); }
.separator { height: 1px; background: var(--color-border); width: 100%; opacity: 0.5; }
.separator-dashed { height: 1px; border-bottom: 1px dashed var(--color-border); width: 100%; opacity: 0.5; margin: 1rem 0; }

/* Company Header */
.section-company { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.row-ref-center { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; opacity: 0.7; }
.select-company { font-size: 1.5rem; font-weight: 700; color: var(--color-primary); text-align: center; width: auto; min-width: 300px; border-bottom: 2px solid transparent !important; }
.select-company:hover { border-bottom-color: var(--color-border) !important; }
.select-company:focus { border-bottom-color: var(--color-primary) !important; }
.row-tagline { font-style: italic; color: var(--color-fg-secondary); font-size: 0.9rem; }
.row-address-left { display: flex; gap: 0.5rem; text-align: left; }

/* Header Split Layout */
.header-split { 
    display: grid; 
    grid-template-columns: 1fr 1fr; 
    gap: 4rem; 
    margin-top: 2rem; 
    align-items: start;
}

.sub-grid { 
    display: grid; 
    grid-template-columns: max-content 1fr; 
    column-gap: 2rem; 
    row-gap: 0.75rem; 
    align-items: center; 
}

/* Specific alignments for Right Column */
.col-right.sub-grid {
    grid-template-columns: 1fr min-content; 
    justify-content: end;
    grid-template-columns: max-content 140px; /* Reduced width from 180px */
    justify-content: end;
}

.col-left.sub-grid {
    grid-template-columns: max-content 1fr;
    justify-content: start;
}

.header-split .label { font-size: 0.75rem; font-weight: 700; color: var(--color-fg-tertiary); letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
.header-split .value, .header-split .value-mono { font-size: 0.95rem; color: var(--color-fg-primary); }
.header-split .value-mono { font-family: var(--font-mono); font-size: 0.9rem; }

/* Right Align Text in Right Col */
.col-right .label { text-align: right; }
.col-right .value, .col-right .value-mono { text-align: right; display: block; }

.input-wrapper-fix {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    position: relative;
}

/* Inputs */
.input-glass { background: transparent; border: none; color: inherit; padding: 0.25rem; transition: all 0.2s; font-family: inherit; }
.input-glass:hover { background: rgba(255,255,255,0.03); border-radius: 4px; }
.input-glass:focus { outline: none; background: rgba(255,255,255,0.05); }

/* Responsive */
@media (max-width: 768px) {
    .invoice-paper { padding: 1rem; }
    .header-split { 
        grid-template-columns: 1fr; 
        gap: 1.5rem; /* Reduced gap between blocks */
    } 
    /* Stack and Align both sub-grids identically */
    .sub-grid, .col-left.sub-grid, .col-right.sub-grid {
        grid-template-columns: 100px 1fr !important; /* Fixed Key Width for perfect alignment */
        column-gap: 0.5rem;
        justify-content: start;
    }
    .col-right .label, .col-right .value, .col-right .value-mono { text-align: left; } 
    .input-wrapper-fix { justify-content: flex-start; width: 100%; }
    .input-glass-sm { text-align: left; min-width: 0; width: 100%; } /* Fill space */
    
    .grid-2 { grid-template-columns: 1fr; gap: 0.5rem; }
    .footer-grid { grid-template-columns: 1fr; gap: 1.5rem; }
    .col-terms { grid-column: span 1; }
    .table-container { overflow-x: auto; }
}

/* Header Small Inputs (Date, Vehicle, etc) */
.input-glass-sm { 
    background: transparent; 
    border: none; 
    border-bottom: 1px dashed transparent; /* Hidden by default */
    color: var(--color-fg-primary); /* Match text color */
    text-align: right; 
    min-width: 140px; 
    font-size: 0.9rem; 
    font-family: var(--font-mono); /* Use mono for alignment */
    padding: 0;
    transition: all 0.2s;
}
.input-glass-sm:hover, .input-glass-sm:focus {
    border-bottom-color: var(--color-border);
    background: rgba(255,255,255,0.02);
}
.input-glass-sm:focus { outline: none; border-bottom-color: var(--color-primary); }

.input-glass-sm::-webkit-calendar-picker-indicator {
    filter: invert(1);
    opacity: 0.3; /* Make icon very subtle */
    cursor: pointer;
    transform: scale(0.8);
}
.input-glass-sm::-webkit-calendar-picker-indicator:hover { opacity: 0.8; }

.input-wrapper-icon { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; color: var(--color-fg-secondary); }
.input-wrapper-icon:focus-within { color: var(--color-primary); }

/* Customer Section */
.section-customer { background: var(--color-bg-elevated); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--color-border); }
.select-customer { font-size: 1.25rem; font-weight: 600; color: var(--color-fg-primary); width: 100%; border-bottom: 1px dashed var(--color-border) !important; }
.customer-details { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.delivery-address-block { background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--color-border); }
.select-wrapper { position: relative; display: flex; align-items: center; }
.select-icon { position: absolute; right: 0.5rem; pointer-events: none; opacity: 0.5; }

/* Tables */
.table-container { border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.premium-table { width: 100%; min-width: 800px; border-collapse: collapse; font-size: 0.9rem; }
.premium-table th { background: var(--color-bg-muted); padding: 0.75rem; text-align: left; font-weight: 600; color: var(--color-fg-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
.premium-table td { border-top: 1px solid var(--color-border); padding: 0.1rem; vertical-align: middle; }
.input-table { width: 100%; background: transparent; border: none; padding: 0.6rem 0.5rem; color: var(--color-fg-primary); font-family: inherit; }
.input-table:focus { background: var(--color-bg-elevated); outline: none; }
.text-right { text-align: right; }
.btn-icon-danger { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-fg-muted); background: transparent; border: none; cursor: pointer; }
.btn-icon-danger:hover { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); }
.empty-state { padding: 2rem; text-align: center; color: var(--color-fg-secondary); font-style: italic; }

/* Footer Grid */
.footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; }
.section-header { font-size: 0.75rem; font-weight: 700; color: var(--color-fg-secondary); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
.card-inset { background: var(--color-bg-app); border: 1px solid var(--color-border); border-radius: 6px; padding: 1rem; }
.col-totals { display: flex; flex-direction: column; align-items: flex-end; }
.total-row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.95rem; width: 280px; }
.grand-total-box { background: var(--color-bg-elevated); border: 1px solid var(--color-primary-dim); border-radius: 8px; padding: 1.25rem; text-align: center; }
.gt-label { font-size: 0.7rem; letter-spacing: 0.1em; color: var(--color-fg-secondary); margin-bottom: 0.25rem; font-weight: 700; }
.gt-value { font-size: 2rem; font-weight: 800; color: var(--color-primary); line-height: 1; text-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.2); }
.words-text { font-style: italic; color: var(--color-fg-secondary); text-align: right; font-size: 0.9rem; }
.col-terms { grid-column: span 2; }

/* Action Bar */
.action-bar { margin-top: 2rem; border-top: 1px solid var(--color-border); padding-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
.toggle-switch { display: flex; background: var(--color-bg-muted); padding: 4px; border-radius: 6px; border: 1px solid var(--color-border); }
.toggle-switch input { display: none; }
.toggle-label { display: flex; cursor: pointer; gap: 4px; }
.toggle-text { transition: all 0.2s; }

/* Responsive */
@media (max-width: 768px) {
    .invoice-paper { padding: 1rem; }
    .grid-2 { grid-template-columns: 1fr; gap: 0.5rem; }
    .footer-grid { grid-template-columns: 1fr; gap: 1.5rem; }
    .col-terms { grid-column: span 1; }
    .table-container { overflow-x: auto; }
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

/* Toggle Fix */
.toggle-switch {
    position: relative;
    display: inline-block;
    width: auto;
    background: var(--color-bg-muted);
    border-radius: 6px;
    padding: 4px;
    border: 1px solid var(--color-border);
}
.toggle-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;
    z-index: 1;
    gap: 0;
}
.toggle-text {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 4px;
    transition: all 0.2s;
    opacity: 0.5;
}
input:checked + .toggle-label .toggle-text:nth-child(2) {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    opacity: 1;
}
input:not(:checked) + .toggle-label .toggle-text:nth-child(1) {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    opacity: 1;
}
</style>
