<script setup lang="ts">
import { Upload, Download, Check } from 'lucide-vue-next';
import BaseButton from '../components/ui/BaseButton.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { db } from '../db/db';
import { ref, toRaw } from 'vue';

const showRestoreModal = ref(false);
const restoreData = ref<any>(null);
const selection = ref({
    companies: true,
    customers: true,
    products: true,
    settings: true,
    invoices: true,
    fonts: true
});

const backup = async () => {
    try {
        const data = {
            timestamp: new Date().toISOString(),
            companies: await db.companies.toArray(),
            customers: await db.customers.toArray(),
            products: await db.products.toArray(),
            settings: await db.settings.toArray(),
            invoices: await db.invoices.toArray(), // Added
            invoiceVersions: await db.invoiceVersions.toArray(), // Added
            fonts: await db.fonts.toArray() // Added
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oflo_backup_${new Date().toISOString().slice(0,10)}.json`;
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
                restoreData.value = JSON.parse(evt.target.result);
                // Reset selection based on available keys
                selection.value.companies = !!restoreData.value.companies;
                selection.value.customers = !!restoreData.value.customers;
                selection.value.products = !!restoreData.value.products;
                selection.value.settings = !!restoreData.value.settings;
                selection.value.fonts = !!restoreData.value.fonts; // Added
                // Treat invoices and versions as a single "Invoices" unit
                (selection.value as any).invoices = !!(restoreData.value.invoices && restoreData.value.invoiceVersions);
                
                showRestoreModal.value = true;
            } catch (err) {
                alert('Invalid Backup File');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

const confirmRestore = async () => {
    if (!restoreData.value) return;

    try {
        const rawData = toRaw(restoreData.value);

        // Add invoices tables to transaction
        await db.transaction('rw', [db.companies, db.customers, db.products, db.settings, db.invoices, db.invoiceVersions, db.fonts], async () => {
            if (selection.value.companies && rawData.companies) {
                await db.companies.bulkPut(rawData.companies);
            }
            if (selection.value.customers && rawData.customers) {
                await db.customers.bulkPut(rawData.customers);
            }
            if (selection.value.products && rawData.products) {
                await db.products.bulkPut(rawData.products);
            }
            if (selection.value.settings && rawData.settings) {
                await db.settings.bulkPut(rawData.settings);
            }
            if (selection.value.fonts && rawData.fonts) { // Added
                 await db.fonts.bulkPut(rawData.fonts);
            }
            // Restore Invoices
            if ((selection.value as any).invoices && rawData.invoices) {
                const fixDates = (list: any[]) => list.map(item => ({
                    ...item,
                    date: item.date ? new Date(item.date) : null,
                    status: item.status || 'final', // Default to final for backward compatibility
                    createdAt: item.createdAt ? new Date(item.createdAt) : undefined
                }));

                await db.invoices.bulkPut(fixDates(rawData.invoices));
                if (rawData.invoiceVersions) {
                    await db.invoiceVersions.bulkPut(fixDates(rawData.invoiceVersions));
                }
            }
        });
        alert('Restore Completed Successfully');
        showRestoreModal.value = false;
        restoreData.value = null;
    } catch (e: any) {
        alert('Restore Failed: ' + e.message);
    }
};
</script>

<template>
<div class="page-container">
    <PageHeader title="Backup & Restore" :showBack="true" />

    <div class="grid">
        <div class="card action-card">
            <h3><Download class="icon-sm"/> Backup Data</h3>
            <p>Export all your Companies, Customers, Products, and Settings to a secure JSON file.</p>
            <BaseButton @click="backup">Download Backup</BaseButton>
        </div>

        <div class="card action-card">
            <h3><Upload class="icon-sm"/> Restore Data</h3>
            <p>Restore your data from a previously created backup file. This will merge/update existing records.</p>
            <BaseButton variant="secondary" @click="triggerRestore">Select File to Restore</BaseButton>
        </div>
    </div>

    <!-- Restore Modal -->
    <div v-if="showRestoreModal" class="modal-overlay">
        <div class="modal card">
            <h3>Select Data to Restore</h3>
            <div class="selection-list">
                <label class="checkbox-row" v-if="restoreData.companies">
                    <input type="checkbox" v-model="selection.companies">
                    <span>Companies ({{ restoreData.companies.length }} items)</span>
                </label>
                <label class="checkbox-row" v-if="restoreData.customers">
                    <input type="checkbox" v-model="selection.customers">
                    <span>Customers ({{ restoreData.customers.length }} items)</span>
                </label>
                <label class="checkbox-row" v-if="restoreData.products">
                    <input type="checkbox" v-model="selection.products">
                    <span>Products ({{ restoreData.products.length }} items)</span>
                </label>
                <label class="checkbox-row" v-if="restoreData.settings">
                    <input type="checkbox" v-model="selection.settings">
                    <span>Settings</span>
                </label>
                <label class="checkbox-row" v-if="restoreData.fonts">
                    <input type="checkbox" v-model="selection.fonts">
                    <span>Custom Fonts ({{ restoreData.fonts.length }} items)</span>
                </label>
                <!-- Added Invoices Checkbox -->
                <label class="checkbox-row" v-if="(restoreData.invoices && restoreData.invoices.length) || (restoreData.invoiceVersions && restoreData.invoiceVersions.length)">
                    <input type="checkbox" v-model="selection.invoices">
                    <span>Invoices ({{ (restoreData.invoices?.length || 0) }} items)</span>
                </label>
            </div>
            <div class="modal-actions">
                <BaseButton variant="ghost" @click="showRestoreModal = false">Cancel</BaseButton>
                <BaseButton @click="confirmRestore"><Check :size="16"/> Confirm Restore</BaseButton>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; }
.header { margin-bottom: 2rem; }
.header h2 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; }
.icon { color: var(--color-fg-primary); }
.icon-sm { width: 20px; height: 20px; margin-right: 0.5rem; vertical-align: middle; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
.action-card { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
.action-card p { color: var(--color-fg-secondary); font-size: 0.9rem; line-height: 1.4; flex: 1; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(2px); }
.modal { width: 100%; max-width: 400px; }
.modal h3 { margin-bottom: 1rem; }
.selection-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
.checkbox-row { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--color-border); }
.checkbox-row:hover { background: var(--color-bg-muted); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; }
</style>
