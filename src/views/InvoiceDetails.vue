<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, type Invoice, type InvoiceVersion } from '../db/db';
import PageHeader from '../components/ui/PageHeader.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import { Clock, Edit, CheckCircle, Printer, Download } from 'lucide-vue-next';
import { numberToWords } from '../utils/formatters';
import { downloadInvoicePDF, printInvoicePDF } from '../services/pdfService';

// Router
const route = useRoute();
const router = useRouter();

// State
const invoice = ref<Invoice | undefined>(undefined);
const versions = ref<InvoiceVersion[]>([]);
const selectedVersionId = ref<number | undefined>(undefined);
const loading = ref(true);

// Computed
const currentVersion = computed(() => {
    if (!versions.value.length) return undefined;
    if (selectedVersionId.value) {
        return versions.value.find(v => v.id === selectedVersionId.value);
    }
    // Default to invoice's current version
    if (invoice.value?.currentVersionId) {
        return versions.value.find(v => v.id === invoice.value!.currentVersionId);
    }
    return versions.value[0]; // Fallback
});

const isLatestActive = computed(() => {
    if (!invoice.value || !currentVersion.value) return false;
    return invoice.value.currentVersionId === currentVersion.value.id;
});

const amountInWords = computed(() => {
    return currentVersion.value ? numberToWords(currentVersion.value.grandTotal) : '';
});

// Load Data
const loadData = async () => {
    loading.value = true;
    try {
        const invNo = route.params.invoiceNo as string;
        if (!invNo) return;
        
        // Lookup by Invoice Number
        invoice.value = await db.invoices.where('invoiceNumber').equals(invNo).first();

        if (invoice.value) {
            const id = invoice.value.id!;
            versions.value = await db.invoiceVersions
                .where('invoiceId')
                .equals(id)
                .reverse() // Newest first
                .toArray();

            // Handle Query Param for deep linking
            const qVid = Number(route.query.versionId);
            if (qVid) selectedVersionId.value = qVid;
            else if (invoice.value.currentVersionId) selectedVersionId.value = invoice.value.currentVersionId;
            else if (versions.value.length) selectedVersionId.value = versions.value[0].id; // Fallback to latest
        }
    } catch (e) {
        console.error("Error loading invoice details", e);
    } finally {
        loading.value = false;
    }
};

onMounted(loadData);

// Watchers
watch(() => route.params.invoiceNo, (newVal) => {
    if (newVal) loadData();
});

watch(() => route.query.versionId, (newVid) => {
    if (newVid) selectedVersionId.value = Number(newVid);
});

// Actions
const setAsActive = async () => {
    // console.log("Restore: Initiated");
    
    if (!invoice.value || !currentVersion.value || !invoice.value.id) {
        // console.error("Restore: Error - Missing invoice ID or current version");
        return;
    }
    
    loading.value = true;
    try {
        const invId = invoice.value.id; 
        const curVerData = JSON.parse(JSON.stringify(currentVersion.value)); 

        const newId = await db.transaction('rw', db.invoices, db.invoiceVersions, async () => {
            // console.log("Restore: Transaction started");
            
            const allVersions = await db.invoiceVersions
                .where('invoiceId')
                .equals(invId)
                .toArray();
                
            const maxVer = allVersions.length > 0 
                ? Math.max(...allVersions.map(v => v.version)) 
                : 0;
            const nextVersion = maxVer + 1;
            // console.log(`Restore: Version computed: ${nextVersion}`);

            const newRef = `${invoice.value!.invoiceNumber}-v${nextVersion}`;

            const newVersion: InvoiceVersion = {
                invoiceId: invId,
                version: nextVersion,
                date: new Date(),
                items: curVerData.items,
                subTotal: curVerData.subTotal,
                totalTax: curVerData.totalTax,
                grandTotal: curVerData.grandTotal,
                referenceNumber: newRef,
                sellerDetails: curVerData.sellerDetails,
                buyerDetails: curVerData.buyerDetails,
                taxType: curVerData.taxType || 'IGST',
                roundOff: curVerData.roundOff || 0,
                vehicleNumber: curVerData.vehicleNumber,
                createdAt: new Date()
            };

            const addedId = await db.invoiceVersions.add(newVersion);
            // console.log(`Restore: Version added (ID: ${addedId})`);

            await db.invoices.update(invId, { 
                currentVersionId: Number(addedId),
                grandTotal: newVersion.grandTotal,
                date: newVersion.date
            });
            // console.log("Restore: Invoice updated");
            
            return addedId; // Return ID
        });

        if (newId) {
             const newIdStr = String(newId);
             // console.log(`Restore: Updating Route to ID ${newIdStr}...`);
             
             // Update route
             await router.replace({ query: { ...route.query, versionId: newIdStr } });
             // console.log(`Restore: Route replaced. Query: ${JSON.stringify(route.query)}`);
             
             // Reload data 
             await loadData();
             // console.log("Restore: Data reloaded");
             
             // Ensure selection
             selectedVersionId.value = Number(newId);
             // console.log(`Restore: Success. Selected ID: ${selectedVersionId.value}`);
        }

    } catch (e: any) {
        // console.log(`Restore: Failed - ${e.message}`);
        alert("Failed to restore version.");
    } finally {
        loading.value = false;
    }
};

const goToEdit = () => {
    if (!currentVersion.value) return;
    router.push({
        path: `/invoices/edit/${invoice.value?.invoiceNumber}`,
        query: { versionId: currentVersion.value.id }
    });
};

const downloadPDF = async () => {
    if (!currentVersion.value) return;
    const data = { ...currentVersion.value, invoiceNumber: invoice.value?.invoiceNumber };
    downloadInvoicePDF(data);
};

const printNative = () => {
    if (!currentVersion.value) return;
    const data = { ...currentVersion.value, invoiceNumber: invoice.value?.invoiceNumber };
    printInvoicePDF(data);
};

const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB') : '-';
const formatCurrency = (n: number | undefined) => (n || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
</script>

<template>
<div v-if="!loading && invoice" class="view-wrapper">
    <PageHeader :title="`Invoice ${invoice.invoiceNumber}`" :showBack="true" backUrl="/invoices">
        <template #title>
             <div class="header-title-split">
                <span>Invoice</span>
                <span class="header-ref-no">{{ invoice.invoiceNumber }}</span>
             </div>
        </template>
        <template #actions>
            <div class="actions-group">
                <!-- Print/Download Group -->
                <div class="btn-group">
                    <button @click="printNative" class="btn btn-secondary btn-icon-only-mobile" title="Print page">
                        <Printer :size="18" />
                        <span class="btn-text">Print</span>
                    </button>
                    <button @click="downloadPDF" class="btn btn-secondary btn-icon-only-mobile" title="Download PDF">
                        <Download :size="18" />
                        <span class="btn-text">Download</span>
                    </button>
                </div>

                <div class="divider-vertical"></div>

                <!-- Action Group -->
                <div class="btn-group">
                    <button v-if="currentVersion && !isLatestActive" @click="setAsActive" class="btn btn-secondary btn-icon-only-mobile" :disabled="loading">
                        <CheckCircle :size="18" />
                        <span class="btn-text">{{ loading ? 'Restoring...' : 'Restore' }}</span>
                    </button>
                    <BaseButton v-if="currentVersion" @click="goToEdit" class="btn-icon-only-mobile">
                        <Edit :size="18" />
                        <span class="btn-text">Edit</span>
                    </BaseButton>
                </div>
            </div>
        </template>
    </PageHeader>

    <div class="page-container">
        <div class="detail-layout" v-if="currentVersion">
            <!-- Sidebar: Versions -->
            <aside class="versions-sidebar">
                <h3 class="sidebar-title">Version History</h3>
                <div class="version-list">
                    <div 
                        v-for="ver in versions" 
                        :key="ver.id"
                        class="version-item"
                        :class="{ active: ver.id === currentVersion.id, current: ver.id === invoice.currentVersionId }"
                        @click="selectedVersionId = ver.id"
                    >
                        <div class="v-header">
                            <span class="v-ref">{{ ver.referenceNumber || 'v' + ver.version }}</span>
                            <span v-if="ver.id === invoice.currentVersionId" class="badge-current">Active</span>
                        </div>
                        <div class="v-date">{{ formatDate(ver.date) }}</div>
                        <div class="v-total">{{ formatCurrency(ver.grandTotal) }}</div>
                    </div>
                </div>
            </aside>

            <!-- Main Content: Strict Layout -->
            <main class="invoice-content">
                <!-- Alert if viewing old version -->
                <div v-if="!isLatestActive" class="version-alert">
                    <Clock :size="16" />
                    <span>Viewing historical version <strong>{{ currentVersion.referenceNumber }}</strong>.</span>
                </div>

                <!-- Invoice Paper (Matches InvoiceForm) -->
                <div class="invoice-paper">
                    
                    <!-- SECTION 1: HEADER & COMPANY -->
                    <header class="section-company">
                        <!-- Line 0: Reference No (Center) -->
                        <div class="row-ref-center">
                            <span class="label">Reference No:</span>
                            <span class="value">{{ currentVersion.referenceNumber || '---' }}</span>
                        </div>

                        <!-- Line 1: Company Name (Center) -->
                        <div class="row-company-name" style="margin-top: 1rem;">
                            {{ currentVersion.sellerDetails?.name }}
                        </div>

                        <!-- Line 2: Tagline (Center) -->
                        <div class="row-tagline">
                            {{ currentVersion.sellerDetails?.tagline || '' }}
                        </div>

                        <!-- Line 3: Address (Left with Label) -->
                        <div class="row-address-left">
                            <span class="label">ADDRESS:</span>
                            <span class="value">{{ currentVersion.sellerDetails?.address }}</span>
                        </div>

                        <!-- Metric Rows -->
                        <div class="row-split">
                            <div class="left"><span class="label">GSTIN:</span> <span class="value">{{ currentVersion.sellerDetails?.gstin }}</span></div>
                            <div class="right"><span class="label">Invoice No:</span> <span class="value">{{ invoice.invoiceNumber || '---' }}</span></div>
                        </div>
                        <div class="row-split">
                            <div class="left"><span class="label">Email:</span> <span class="value">{{ currentVersion.sellerDetails?.email || '---' }}</span></div>
                            <div class="right"><span class="label">Date:</span> <span class="value">{{ formatDate(currentVersion.date) }}</span></div>
                        </div>
                        <div class="row-split">
                            <div class="left"><span class="label">Mobile:</span> <span class="value">{{ currentVersion.sellerDetails?.phone || '---' }}</span></div>
                            <div class="right"><span class="label">Vehicle No:</span> <span class="value">{{ currentVersion.vehicleNumber || '---' }}</span></div>
                        </div>
                    </header>

                    <hr class="separator" />

                    <!-- SECTION 2: CUSTOMER -->
                    <section class="section-customer">
                        <div class="row-customer-name-left">
                            {{ currentVersion.buyerDetails?.name }}
                        </div>
                        <div class="row-address-left">
                             <span class="label">Customer Address:</span>
                             <span class="value">{{ currentVersion.buyerDetails?.address }}</span>
                        </div>
                        <div class="row-gst-left"><span class="label">Customer GST:</span> <span class="value">{{ currentVersion.buyerDetails?.gstin }}</span></div>
                    </section>

                    <!-- SECTION 3: ITEMS TABLE -->
                    <section class="section-items">
                        <div class="table-container">
                            <table class="compact-table">
                                <thead>
                                    <tr>
                                        <th style="width: 25%">Product</th>
                                        <th style="width: 20%">Description</th>
                                        <th style="width: 8%">HSN</th>
                                        <th style="width: 6%">Bags</th>
                                        <th style="width: 8%">Qty</th>
                                        <th style="width: 10%">Price</th>
                                        <th style="width: 6%">Tax %</th>
                                        <th style="width: 10%">Taxable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(item, idx) in currentVersion.items" :key="idx">
                                        <td>{{ item.name }}</td>
                                        <td>{{ item.description }}</td>
                                        <td>{{ item.hsn }}</td>
                                        <td class="text-right">{{ item.numberOfBags }}</td>
                                        <td class="text-right">{{ item.quantity }}</td>
                                        <td class="text-right">{{ formatCurrency(item.unitPrice) }}</td>
                                        <td class="text-right">{{ item.taxRate }}%</td>
                                        <td class="text-right val-cell">{{ formatCurrency(item.totalAmount || (item.quantity * item.unitPrice)) }}</td>
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

                        <!-- Row 2: Content -->
                        <div class="f-cell f-bank-content">
                            <template v-if="currentVersion.sellerDetails && currentVersion.sellerDetails.bankName">
                                <div class="info-row"><span class="label">Bank Name:</span> <span class="value">{{ currentVersion.sellerDetails.bankName }}</span></div>
                                <div class="info-row"><span class="label">Acc. No.:</span> <span class="value">{{ currentVersion.sellerDetails.accountNumber }}</span></div>
                                <div class="info-row" v-if="currentVersion.sellerDetails.ifscCode"><span class="label">IFSC Code:</span> <span class="value">{{ currentVersion.sellerDetails.ifscCode }}</span></div>
                            </template>
                            <div v-else class="placeholder-text">-- No Bank Details --</div>
                        </div>

                        <div class="f-cell f-subtotals">
                            <div class="f-finance-row"><span class="label">Subtotal</span> <span class="val">{{ formatCurrency(currentVersion.subTotal) }}</span></div>
                            <template v-if="currentVersion.taxType === 'CGST_SGST'">
                                <div class="f-finance-row"><span class="label">CGST</span> <span class="val">{{ formatCurrency(currentVersion.totalTax / 2) }}</span></div>
                                <div class="f-finance-row"><span class="label">SGST</span> <span class="val">{{ formatCurrency(currentVersion.totalTax / 2) }}</span></div>
                            </template>
                            <template v-else>
                                <div class="f-finance-row"><span class="label">IGST</span> <span class="val">{{ formatCurrency(currentVersion.totalTax) }}</span></div>
                            </template>
                            <!-- Round Off Removed -->
                        </div>

                        <!-- Row 3: Words vs Grand Total (Aligned Sections) -->
                        <div class="f-cell f-words-section">
                            <div class="f-words-header">In Words</div>
                            <div class="words-text">{{ amountInWords }}</div>
                        </div>
                        
                        <div class="f-cell f-grand-total">
                            <div class="grand-total-box">
                                <div class="gt-label">GRAND TOTAL</div>
                                <div class="gt-value">{{ (currentVersion.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 0, style: 'currency', currency: 'INR' }) }}</div>
                            </div>
                        </div>

                        <!-- Row 4: Terms (Left Only) -->
                        <div class="f-cell f-terms-header">TERMS</div>
                        <div class="f-cell f-empty"></div>

                        <div class="f-cell f-terms-content">
                            <div class="terms-text" v-if="currentVersion.sellerDetails && currentVersion.sellerDetails.terms">{{ currentVersion.sellerDetails.terms }}</div>
                            <div class="placeholder-text" v-else>--</div>
                        </div>
                        <div class="f-cell f-empty"></div>

                    </section>

                </div>
            </main>
        </div>
    </div>
</div>
<div v-else class="loading-state">Loading...</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; padding-bottom: 2rem; max-width: 95%; margin: 0 auto; display: flex; flex-direction: column; color: var(--color-fg-primary); }
.view-wrapper { flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.loading-state { padding: 2rem; text-align: center; color: var(--color-fg-secondary); }

.detail-layout { display: flex; gap: 1.5rem; flex: 1; margin-top: 1rem; align-items: flex-start; }

/* Sidebar (Kept Original) */
.versions-sidebar { width: 250px; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.sidebar-title { padding: 1rem; font-size: 0.9rem; font-weight: 600; border-bottom: 1px solid var(--color-border); margin: 0; background: var(--color-bg-muted); }
.version-list { overflow-y: auto; flex: 1; }
.version-item { padding: 0.8rem 1rem; border-bottom: 1px solid var(--color-border); cursor: pointer; transition: background 0.2s; border-left: 3px solid transparent; }
.version-item:hover { background: var(--color-bg-muted); }
.version-item.active { background: var(--color-bg-muted); border-left-color: var(--color-primary); }
.version-item.current { background: rgba(var(--color-primary-rgb), 0.05); }

.v-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
.v-ref { font-weight: 600; font-size: 0.85rem; color: var(--color-fg-primary); }
.badge-current { font-size: 0.65rem; background: var(--color-primary); color: #000; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700; }
.v-date { font-size: 0.75rem; color: var(--color-fg-secondary); }
.v-total { font-size: 0.8rem; font-weight: 500; color: var(--color-fg-primary); margin-top: 0.2rem; }

/* Main Content */
.invoice-content { flex: 1; display: flex; flex-direction: column; gap: 1rem; padding-bottom: 2rem; }
.version-alert { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 0.75rem 1rem; border-radius: 6px; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }

/* Paper Layout (Shared with InvoiceForm) */
.invoice-paper {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 2rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 100%; /* Force constraint */
    overflow-wrap: break-word; /* Prevent long text overflow */
}

/* Common Styles */
.label { font-weight: 600; font-size: 0.9rem; color: var(--color-fg-secondary); margin-right: 0.5rem; }
.value { font-weight: 500; font-size: 1rem; color: var(--color-fg-primary); }
.separator { border: none; border-bottom: 2px solid var(--color-border); margin: 0.5rem 0; }
.row-company-name, .row-customer-name { font-size: 1.2rem; font-weight: 700; text-align: center; color: var(--color-primary); margin-bottom: 0.2rem; }
.row-customer-name-left { font-size: 1.2rem; font-weight: 700; text-align: left; color: var(--color-primary); margin-bottom: 0.2rem; }
.placeholder-text { font-style: italic; color: var(--color-fg-secondary); opacity: 0.5; font-size: 0.9rem; }
.row-tagline { text-align: center; font-style: italic; color: var(--color-fg-secondary); font-size: 0.9rem; margin-bottom: 0.2rem; min-height: 1.2rem; }
.row-address-left { text-align: left; white-space: pre-wrap; margin: 0; font-size: 0.95rem; line-height: 1.4; margin-bottom: 0.5rem; display: flex; gap: 0.5rem; }
.row-split { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 0.2rem; }
.row-split .left { text-align: left; }
.row-split .right { text-align: right; }
.row-ref-center { text-align: center; display: flex; justify-content: center; align-items: center; font-size: 0.9rem; margin-bottom: -1rem; }
.row-gst-left { text-align: left; margin-top: 0.5rem; }

/* Items Section */
.section-items { margin-top: 1rem; }
.table-container { border: 1px solid var(--color-border); border-radius: 4px; overflow-x: auto; }
.compact-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.compact-table th { background: var(--color-bg-muted); padding: 0.5rem; text-align: left; font-weight: 600; border-bottom: 1px solid var(--color-border); }
.compact-table td { padding: 0.4rem; border-bottom: 1px solid var(--color-border); vertical-align: middle; color: var(--color-fg-primary); }
.text-right { text-align: right; }
.val-cell { font-weight: 600; font-family: monospace; }
.item-name { font-weight: 600; color: var(--color-primary); }
.item-desc { opacity: 0.8; }
.item-hsn { font-size: 0.75rem; color: var(--color-fg-secondary); }

/* STRICT FOOTER GRID */
.section-footer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr; 
    gap: 1rem 3rem; 
    align-items: start;
}

.f-cell { display: flex; flex-direction: column; }
.f-bank-header, .f-words-header, .f-terms-header { font-weight: 700; text-transform: uppercase; font-size: 0.8rem; color: var(--color-fg-secondary); letter-spacing: 0.5px; opacity: 0.8; margin-bottom: 0.2rem; }
.f-words-header { margin-bottom: 0.5rem; }
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
    margin-top: 1.5rem; 
}
.words-text { font-style: italic; font-weight: 500; font-size: 1rem; color: var(--color-primary); line-height: 1.4; }

.f-grand-total { 
    display: flex; 
    justify-content: flex-start; 
    margin-top: 1.5rem;
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

@media (max-width: 900px) {
    .section-footer-grid { grid-template-columns: 1fr; gap: 1rem; }
    .f-words-header, .f-grand-total, .f-terms-header { margin-top: 1rem; }
    .invoice-paper { padding: 1.5rem; }
}

@media (max-width: 768px) {
    .detail-layout { 
        flex-direction: column; 
        width: 100%;
        align-items: stretch; /* Force children to full width */
    }
    .invoice-content {
        width: 100%; /* Explicitly fill width */
    }
    .versions-sidebar { 
        width: 100%; 
        height: auto; 
        max-height: 400px; 
        order: 2; 
        margin-top: 1rem; 
    }
    
    /* Ensure page container doesn't overflow */
    .page-container {
        padding: 0 0.5rem 2rem 0.5rem; /* Add bottom padding */
        width: 100%;
        max-width: 100vw;
        overflow-x: hidden; 
        margin: 0; 
    }

    /* Ensure responsiveness on tablets too */
    .row-split { grid-template-columns: 1fr; gap: 0.5rem; }
    .row-split .left, .row-split .right { text-align: left; }
}

@media (max-width: 640px) {
    .invoice-paper { 
        padding: 1rem; 
        width: 100%; 
        min-width: 0; /* Critical: Prevent flex item expansion in parent */
        box-sizing: border-box; 
        display: block; 
    }
    .invoice-paper > * {
        margin-bottom: 1.5rem; /* Replicate gap since flex is gone */
    }
    .invoice-paper > *:last-child {
        margin-bottom: 0;
    }

    .row-address-left { font-size: 0.9rem; }
    
    /* Horizontal Scroll Enabled Table */
    .section-items {
        width: 100%;
        max-width: 100%;
        display: block;
    }
    .table-container { 
        width: 100%; 
        max-width: 100%; 
        overflow-x: auto; 
        display: block; 
        border: 1px solid var(--color-border);
        -webkit-overflow-scrolling: touch; /* Smooth scroll on iOS */
    }
    .compact-table { 
        width: 100%; 
        min-width: 650px; 
        font-size: 0.85rem; 
        table-layout: auto; 
    } 
    
    .section-company, .section-customer, .section-footer-grid {
        width: 100%;
        max-width: 100%;
        overflow-wrap: break-word;
    }

    /* Split Title Styling */
    .header-title-split {
        display: flex;
        flex-direction: column;
        align-items: center; 
        line-height: 1.2;
    }
    .header-ref-no {
        margin-top: 0.2rem;
        /* Optional: make it smaller or different color if needed, but user just said 2 lines */
    }
}

/* Header Action Styles */
.actions-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.btn-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-icon-only-mobile {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.8rem;
    height: 36px;
    background: var(--color-bg-app);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-fg-primary);
    font-weight: 500;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.btn-icon-only-mobile:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.btn-icon-only-mobile:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.divider-vertical {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    margin: 0 0.5rem;
}

@media (max-width: 640px) {
    .btn-text { display: none; }
    .btn-icon-only-mobile { padding: 0.5rem; width: 36px; justify-content: center; } 
    .actions-group { gap: 0.5rem; width: 100%; justify-content: center; } 
    .divider-vertical { margin: 0 0.2rem; }
    
    .btn-group {
        gap: 0.5rem;
    }
}
</style>
