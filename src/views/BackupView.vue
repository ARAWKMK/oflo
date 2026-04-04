<script setup lang="ts">
import { Upload, Download, Check, FileJson } from 'lucide-vue-next';
import BaseButton from '../components/ui/BaseButton.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { db } from '../db/db';
import { ref, toRaw, computed } from 'vue';
import { normalizeData, auditRestoreData } from '../services/migrationService';

import { APP_VERSION } from '../version';
import { DB_VERSION } from '../db/db';

const showRestoreModal = ref(false);
const restoreData = ref<any>(null); // Holds { meta, data }
const restoreSource = ref<'v1' | 'v2'>('v2');
const shouldClear = ref(false); // Toggle for "Wipe & Restore"


// Selection State
const selection = ref({
    companies: true,
    customers: true,
    products: true,
    settings: true,
    sales: true, // Includes Versions
    fonts: true
});

// Helper to get counts safely
const getCount = (key: string) => {
    if (!restoreData.value?.data) return 0;
    const list = restoreData.value.data[key];
    return Array.isArray(list) ? list.length : (list ? 1 : 0);
};

// Current App Version for Metadata
const SCHEMA_VERSION = DB_VERSION;

const backup = async () => {
    try {
        const fullData = {
            companies: await db.companies.toArray(),
            customers: await db.customers.toArray(),
            products: await db.products.toArray(),
            settings: await db.settings.toArray(),
            sales: await db.sales.toArray(),
            salesVersions: await db.salesVersions.toArray(),
            fonts: await db.fonts.toArray()
        };

        // v5.1.7: Healing on Export (Ensure the backup file is perfectly clean v10 Sales format)
        const normalized = normalizeData(fullData);
        fullData.sales = normalized.sales;
        fullData.salesVersions = normalized.versions;
        fullData.settings = normalized.settings;
        fullData.companies = normalized.companies;
        fullData.customers = normalized.customers;
        fullData.products = normalized.products;
        fullData.fonts = normalized.fonts;

        const exportPayload = {
            meta: {
                appName: 'Oflo',
                appVersion: APP_VERSION,
                schemaVersion: SCHEMA_VERSION,
                timestamp: new Date().toISOString(),
                exportedBy: 'User'
            },
            data: fullData
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0,10);
        a.download = `oflo_backup_sales_v5.1.7_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e: any) {
        alert('Backup Failed: ' + e.message);
    }
};

const triggerRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evt: any) => {
            try {
                const json = JSON.parse(evt.target.result);
                
                // Detect Format
                if (json.meta && json.data) {
                    // V2 Format
                    restoreSource.value = 'v2';
                    restoreData.value = json;
                } else {
                    // V1 Format (Flat) - Wrap it
                    restoreSource.value = 'v1';
                    restoreData.value = {
                        meta: { version: '1.0', timestamp: new Date().toISOString(), legacy: true },
                        data: json
                    };
                }

                // Reset selection based on availability
                const d = restoreData.value.data;
                selection.value.companies = !!(d.companies?.length);
                selection.value.customers = !!(d.customers?.length);
                selection.value.products = !!(d.products?.length);
                selection.value.settings = !!(d.settings?.length);
                selection.value.fonts = !!(d.fonts?.length);
                selection.value.sales = !!(d.sales?.length || d.salesVersions?.length || d.invoices?.length || d.invoiceVersions?.length);
                
                showRestoreModal.value = true;
            } catch (err) {
                alert('Invalid Backup File: Could not parse JSON.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

const confirmRestore = async () => {
    if (!restoreData.value?.data) return;

    try {
        const rawData = toRaw(restoreData.value.data);

        // Transactional Restore
        await db.transaction('rw', [
            db.companies, db.customers, db.products, 
            db.settings, db.sales, db.salesVersions, db.fonts
        ], async () => {
            
            // --- STEP 1: CLEAR EXISTING (IF REQUESTED) ---
            if (shouldClear.value) {
                if (selection.value.companies) await db.companies.clear();
                if (selection.value.customers) await db.customers.clear();
                if (selection.value.products) await db.products.clear();
                if (selection.value.settings) await db.settings.clear();
                if (selection.value.fonts) await db.fonts.clear();
                if (selection.value.sales) {
                    await db.sales.clear();
                    await db.salesVersions.clear();
                }
            }

            // --- STEP 2: NORMALIZE & RESTORE DATA ---
            const normalized = normalizeData(rawData);
            
            // 1. Profiles
            if (selection.value.companies && normalized.companies.length) {
                await db.companies.bulkPut(normalized.companies);
            }

            if (selection.value.customers && normalized.customers.length) {
                await db.customers.bulkPut(normalized.customers);
            }

            if (selection.value.products && normalized.products.length) {
                await db.products.bulkPut(normalized.products);
            }

            // 2. Settings & Assets
            if (selection.value.settings && normalized.settings.length) {
                await db.settings.bulkPut(normalized.settings);
            }
            if (selection.value.fonts && normalized.fonts.length) {
                 await db.fonts.bulkPut(normalized.fonts);
            }

            // 3. Transactions (Sales + Versions)
            if (selection.value.sales && normalized.sales.length) {
                await db.sales.bulkPut(normalized.sales);
                if (normalized.versions.length) {
                    await db.salesVersions.bulkPut(normalized.versions);
                }
            }
        });

            // --- STEP 4: AUDIT DATA ---
            await auditRestoreData();
            
            alert('Restore Completed Successfully! The application will now reload to apply changes.');
            window.location.reload();
    } catch (e: any) {
        console.error(e);
        alert('Restore Failed: ' + e.message);
    }
};



const restoreMeta = computed(() => restoreData.value?.meta || {});
</script>

<template>
<div class="page-container">
    <PageHeader title="Backup & Restore" :showBack="true" />

    <div class="grid">
        <div class="card action-card backup-card">
             <div class="icon-circle bg-primary-dim text-primary"><Download :size="24"/></div>
            <div class="content">
                <h3>Full Backup</h3>
                <p>Export a complete copy of your database, including all profiles, inventory, sales, settings, and custom fonts.</p>
                <BaseButton @click="backup" class="w-full">Download Backup JSON</BaseButton>
            </div>
        </div>

        <div class="card action-card restore-card">
            <div class="icon-circle bg-sec-dim text-sec"><Upload :size="24"/></div>
            <div class="content">
                <h3>Restore Data</h3>
                <p>Import data from a backup file. Existing records with matching IDs will be updated; new records will be added.</p>
                <BaseButton variant="secondary" @click="triggerRestore" class="w-full">Select File...</BaseButton>
            </div>
        </div>
    </div>

    <!-- Restore Modal -->
    <div v-if="showRestoreModal" class="modal-overlay">
        <div class="modal card">
            <div class="modal-header">
                <h3><FileJson :size="20"/> Restore Selection</h3>
                <div class="meta-badge" v-if="restoreSource === 'v2'">
                    v{{ restoreMeta.schemaVersion || '?' }} • {{ new Date(restoreMeta.timestamp).toLocaleDateString() }}
                </div>
                <div class="meta-badge warning" v-else>Legacy Backup Format</div>
            </div>

            <p class="modal-desc">Select the categories you want to verify and merge into your current database.</p>

            <div class="selection-list">
                <!-- Profiles -->
                <label class="checkbox-row" :class="{ disabled: !getCount('companies') }">
                    <input type="checkbox" v-model="selection.companies" :disabled="!getCount('companies')">
                    <div class="row-info">
                        <span class="row-title">Companies (Seller Profiles)</span>
                        <span class="row-count">{{ getCount('companies') }} items</span>
                    </div>
                </label>

                <label class="checkbox-row" :class="{ disabled: !getCount('customers') }">
                    <input type="checkbox" v-model="selection.customers" :disabled="!getCount('customers')">
                    <div class="row-info">
                        <span class="row-title">Customers</span>
                        <span class="row-count">{{ getCount('customers') }} items</span>
                    </div>
                </label>
                
                <label class="checkbox-row" :class="{ disabled: !getCount('products') }">
                    <input type="checkbox" v-model="selection.products" :disabled="!getCount('products')">
                    <div class="row-info">
                        <span class="row-title">Products (Inventory)</span>
                        <span class="row-count">{{ getCount('products') }} items</span>
                    </div>
                </label>

                <div class="separator"></div>

                <!-- Transactions -->
                <label class="checkbox-row" :class="{ disabled: !getCount('sales') && !getCount('invoices') }">
                    <input type="checkbox" v-model="selection.sales" :disabled="!getCount('sales') && !getCount('invoices')">
                    <div class="row-info">
                        <span class="row-title">Sales & History</span>
                        <span class="row-count">
                            {{ getCount('sales') || getCount('invoices') }} sales, 
                            {{ getCount('salesVersions') || getCount('invoiceVersions') }} versions
                        </span>
                    </div>
                </label>

                <div class="separator"></div>

                <!-- Config -->
                <label class="checkbox-row" :class="{ disabled: !getCount('settings') }">
                    <input type="checkbox" v-model="selection.settings" :disabled="!getCount('settings')">
                    <div class="row-info">
                        <span class="row-title">App Settings</span>
                        <span class="row-count">{{ getCount('settings') || 0 }} items</span>
                    </div>
                </label>
                
                <label class="checkbox-row" :class="{ disabled: !getCount('fonts') }">
                    <input type="checkbox" v-model="selection.fonts" :disabled="!getCount('fonts')">
                    <div class="row-info">
                        <span class="row-title">Custom Fonts</span>
                        <span class="row-count">{{ getCount('fonts') }} items</span>
                    </div>
                </label>
            </div>

            <!-- Clear Data Toggle -->
            <div class="clear-toggle-container">
                <label class="toggle-row" :title="shouldClear ? 'This will DELETE ALL EXISTING DATA in selected categories before restoring!' : ''">
                    <div class="toggle-info">
                        <span class="toggle-title">Zero-Difference Restore</span>
                        <span class="toggle-desc">Wipe existing data in selected categories before importing breakdown</span>
                    </div>
                    <input type="checkbox" v-model="shouldClear" class="switch">
                </label>
                <div v-if="shouldClear" class="warning-box">
                    <span class="warning-text">⚠️ <b>Warning:</b> This will permanently delete your current records for the selected categories!</span>
                </div>
            </div>

            <div class="modal-actions">
                <BaseButton variant="ghost" @click="showRestoreModal = false">Cancel</BaseButton>
                <BaseButton @click="confirmRestore" class="btn-primary shadow-glow">
                    <Check :size="16"/> Confirm Merge
                </BaseButton>
            </div>
        </div>
    </div>

</div>
</template>

<style scoped>
/* Premium Stylings */
.page-container { padding: 0 1rem; max-width: 900px; margin: 0 auto; color: var(--color-fg-primary); }

.grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); 
    gap: 2rem; 
    margin-top: 1.5rem;
}

.action-card { 
    padding: 2.5rem; 
    display: flex; 
    flex-direction: row; 
    gap: 1.5rem; 
    align-items: flex-start; 
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    background: var(--color-bg-card);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.action-card:hover { 
    transform: translateY(-4px); 
    box-shadow: 0 15px 40px -10px rgba(0,0,0,0.5); 
    border-color: var(--color-primary-dim); 
}

/* Subtle Glow on Hover */
.backup-card:hover .icon-circle { 
    background: var(--color-primary); 
    color: var(--color-bg-app); 
    box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.4); 
}
.restore-card:hover .icon-circle { 
    background: var(--color-fg-primary); 
    color: var(--color-bg-app); 
    box-shadow: 0 0 20px rgba(255,255,255, 0.4); 
}

.icon-circle {
    width: 64px; height: 64px; 
    border-radius: 16px; 
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: all 0.3s ease;
    font-size: 1.5rem;
}

.bg-primary-dim { background: rgba(var(--color-primary-rgb), 0.1); }
.bg-sec-dim { background: var(--color-bg-muted); }

.text-primary { color: var(--color-primary); }
.text-sec { color: var(--color-fg-secondary); }

.content { flex: 1; display: flex; flex-direction: column; gap: 1rem; }
.content h3 { font-size: 1.35rem; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.content p { font-size: 0.95rem; color: var(--color-fg-secondary); line-height: 1.6; margin-bottom: 0.5rem; opacity: 0.8; }

/* Modal */
.modal-overlay { 
    position: fixed; inset: 0; background: rgba(0,0,0,0.85); 
    display: flex; align-items: center; justify-content: center; 
    z-index: 100; backdrop-filter: blur(8px); 
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
}

.modal { 
    width: 100%; max-width: 500px; 
    padding: 0; overflow: hidden;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 25px 60px rgba(0,0,0,0.6);
    animation: scaleUp 0.2s ease-out;
    display: flex; flex-direction: column;
    max-height: 90vh; /* Ensure modal fits within viewport */
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.modal-header { padding: 1.5rem; border-bottom: 1px solid var(--color-border); background: var(--color-bg-elevated); }
.modal-header h3 { display: flex; align-items: center; gap: 0.75rem; margin: 0; font-size: 1.15rem; font-weight: 700; }

.meta-badge { 
    margin-top: 0.5rem; 
    display: inline-block; 
    font-size: 0.75rem; 
    font-weight: 600;
    padding: 3px 10px; 
    border-radius: 99px; 
    background: var(--color-bg-muted); 
    color: var(--color-fg-secondary); 
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
}
.meta-badge.warning { background: rgba(255, 165, 0, 0.1); color: orange; border-color: rgba(255, 165, 0, 0.2); }

.modal-desc { padding: 1.5rem 1.5rem 0.5rem; font-size: 0.95rem; color: var(--color-fg-secondary); line-height: 1.5; }

/* Selection List */
.selection-list { padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; max-height: 35vh; overflow-y: auto; flex: 1 1 auto; }

.checkbox-row { 
    display: flex; align-items: center; gap: 1rem; 
    padding: 1rem; 
    border-radius: 10px; 
    border: 1px solid var(--color-border); 
    background: var(--color-bg-app); /* Deeper contrast */
    cursor: pointer; 
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

/* Premium Hover & Checked States using :has relational selector */
.checkbox-row:hover:not(.disabled) { 
    border-color: var(--color-border-hover); 
    background: var(--color-bg-elevated);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.checkbox-row:has(input:checked) {
    background: rgba(var(--color-primary-rgb), 0.08); /* More subtle */
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px rgba(var(--color-primary-rgb), 0.15) inset;
}

.checkbox-row input[type="checkbox"] {
    width: 1.25rem; height: 1.25rem;
    accent-color: var(--color-primary);
    cursor: pointer;
    border-radius: 4px;
}

.checkbox-row.disabled { 
    opacity: 0.4; 
    cursor: not-allowed; 
    background: rgba(0,0,0,0.1);
    border-style: dashed; 
    box-shadow: none !important;
    transform: none !important;
}

.row-info { display: flex; flex-direction: column; gap: 0.2rem; }
.row-title { font-weight: 600; font-size: 1rem; color: var(--color-fg-primary); letter-spacing: -0.01em; }
.row-count { font-size: 0.8rem; color: var(--color-fg-tertiary); font-family: var(--font-mono); opacity: 0.8; }

.separator { height: 1px; background: var(--color-border); margin: 0.5rem 0; opacity: 0.3; }

.modal-actions { 
    padding: 1.5rem; 
    border-top: 1px solid var(--color-border); 
    display: flex; justify-content: flex-end; gap: 1rem; 
}

/* Clear Toggle Styling */
.clear-toggle-container {
    padding: 0.75rem 1.5rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-app);
}

.toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
}

.toggle-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.toggle-title {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--color-primary);
}

.toggle-desc {
    font-size: 0.75rem;
    color: var(--color-fg-secondary);
    opacity: 0.7;
}

.switch {
    width: 2.5rem;
    height: 1.25rem;
    appearance: none;
    background: var(--color-border);
    border-radius: 99px;
    position: relative;
    cursor: pointer;
    transition: background 0.3s;
}

.switch:checked {
    background: var(--color-primary);
}

.switch::before {
    content: '';
    position: absolute;
    width: 1rem;
    height: 1rem;
    background: white;
    border-radius: 50%;
    top: 0.125rem;
    left: 0.125rem;
    transition: transform 0.3s;
}

.switch:checked::before {
    transform: translateX(1.25rem);
}

.warning-box {
    margin-top: 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    animation: slideDown 0.3s ease-out;
}

.warning-text {
    font-size: 0.75rem;
    color: #ef4444;
    display: block;
    line-height: 1.3;
}

@keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Audit Report Styles */
.audit-report-modal { max-width: 650px; }
.report-content { padding: 1.5rem; overflow-y: auto; flex: 1; }
.report-summary { margin-bottom: 1.5rem; color: var(--color-fg-secondary); font-size: 0.95rem; line-height: 1.5; }
.results-list { display: flex; flex-direction: column; gap: 1rem; }
.audit-item { padding: 1rem; border-radius: 8px; border-left: 4px solid #ccc; background: var(--color-bg-app); }
.audit-item.warning { border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
.audit-item.error { border-left-color: #ef4444; background: rgba(239, 68, 68, 0.05); }

.audit-header { display: flex; justify-content: space-between; margin-bottom: 0.4rem; }
.audit-type { font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: var(--color-fg-tertiary); }
.audit-id { font-family: var(--font-mono); font-size: 0.8rem; font-weight: 500; }
.audit-message { font-size: 0.9rem; color: var(--color-fg-primary); line-height: 1.4; }
</style>
