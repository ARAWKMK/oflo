<script setup lang="ts">
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { ref, onMounted } from 'vue';
import { db } from '../db/db';
import { Trash } from 'lucide-vue-next';

const appSettings = ref({
    theme: 'Dark Premium',
    currency: 'INR',
    language: 'English',
    // PDF Typography
    pdfFontSizeCompany: 26,
    pdfFontSizeHeader: 10,
    pdfFontSizeContentHeader: 10,
    pdfFontSizeRegular: 9,
    // PDF Margins (mm)
    pdfMarginLeft: 14,
    pdfMarginRight: 14,
    pdfMarginTop: 15,
    pdfMarginBottom: 15,
    // PDF Fonts
    pdfFontCompany: 'helvetica',
    pdfFontBody: 'helvetica'
});

const fontList = ref<any[]>([]);

const loadSettings = async () => {
    const saved = await db.settings.toArray();
    if (saved.length) {
        saved.forEach(s => {
            if (s.key in appSettings.value) {
                (appSettings.value as any)[s.key] = s.value;
            }
        });
    }
    await loadFonts();
};

const loadFonts = async () => {
    fontList.value = await db.fonts.toArray();
};

const uploadFont = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ttf')) {
        alert('Only .ttf files are supported');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
        try {
            const base64String = e.target.result.split(',')[1];
            // Name without .ttf
            const fontName = file.name.replace(/\.ttf$/i, '');
            
            await db.fonts.add({
                name: fontName,
                data: base64String
            });
            await loadFonts();
            alert(`Font "${fontName}" uploaded successfully!`);
        } catch (err: any) {
            alert('Error saving font: ' + err.message);
        }
    };
    reader.readAsDataURL(file);
};

const deleteFont = async (id: number) => {
    if (!confirm('Delete this font?')) return;
    await db.fonts.delete(id);
    await loadFonts();
    
    // Reset selection if deleted
    const fonts = await db.fonts.toArray();
    const fontNames = fonts.map(f => f.name);
    if (!fontNames.includes(appSettings.value.pdfFontCompany) && appSettings.value.pdfFontCompany !== 'helvetica' && appSettings.value.pdfFontCompany !== 'times' && appSettings.value.pdfFontCompany !== 'courier') {
        appSettings.value.pdfFontCompany = 'helvetica';
    }
    if (!fontNames.includes(appSettings.value.pdfFontBody) && appSettings.value.pdfFontBody !== 'helvetica' && appSettings.value.pdfFontBody !== 'times' && appSettings.value.pdfFontBody !== 'courier') {
        appSettings.value.pdfFontBody = 'helvetica';
    }
};

const save = async () => {
    try {
        const settingsToSave = Object.entries(appSettings.value).map(([key, value]) => ({ key, value }));
        await db.settings.bulkPut(settingsToSave);
        alert('Settings Saved Successfully');
    } catch (e: any) {
        alert('Error saving settings: ' + e.message);
    }
};

const seedData = async () => {
    if (!confirm('This will add demo data (Companies, Customers, Products). Continue?')) return;
    
    try {
        await db.transaction('rw', db.companies, db.customers, db.products, async () => {
            // Companies
            if ((await db.companies.count()) === 0) {
                 await db.companies.bulkAdd([
                    { name: "TechNova Solutions", tagline: "Innovating the Future", gstin: "29AAAAA0000A1Z5", address: "123 Silicon Valley, Bangalore, KA 560100", phone: "9988776655", email: "accounts@technova.com", invoicePrefix: "TN", bankName: "HDFC Bank", accountNumber: "50100012345678", ifscCode: "HDFC0001234" },
                    { name: "GreenEarth Agro", tagline: "Sustainable Farming", gstin: "29BBBBB1111B1Z6", address: "45 Farm Road, Mysore, KA 570001", phone: "9876543210", email: "sales@greenearth.com", invoicePrefix: "GE", bankName: "State Bank of India", accountNumber: "30001234567", ifscCode: "SBIN0001234" }
                ]);
            }
            
            // Customers
            if ((await db.customers.count()) === 0) {
                await db.customers.bulkAdd([
                    { name: "Global Traders Ltd", gstin: "27CCCCC2222C1Z7", address: "88 Market Street, Mumbai, MH 400001", phone: "022-12345678", email: "purchasing@globaltraders.com", placeOfSupply: "Maharashtra" },
                    { name: "Ravi Enterprises", gstin: "29DDDDD3333D1Z8", address: "12 Industrial Area, Tumkur, KA 572101", phone: "9123456789", email: "ravi@enterprises.com", placeOfSupply: "Karnataka" }
                ]);
            }

            // Products
             if ((await db.products.count()) === 0) {
                await db.products.bulkAdd([
                    { name: "Web Development Service", description: "Custom Website Design & Development", hsn: "9983", unitPrice: 25000, taxRate: 18 },
                    { name: "Annual Maintenance Contract", description: "Server & Software AMC", hsn: "9973", unitPrice: 12000, taxRate: 18 },
                    { name: "Cement (50kg Bag)", description: "UltraGrade 53 Cement", hsn: "2523", unitPrice: 420, taxRate: 28 },
                    { name: "Steel Rods (1 Ton)", description: "TMT Bars 12mm", hsn: "7214", unitPrice: 65000, taxRate: 18 }
                ]);
            }
        });
        alert('Demo Data Added!');
    } catch (e: any) {
        alert('Error seeding data: ' + e.message);
    }
};

onMounted(loadSettings);
</script>

<template>
<div class="page-container">
    <PageHeader title="Settings" :showBack="true" />

    <div class="card settings-card">
        <h3>App Preferences</h3>
        <div class="form-grid">
            <BaseInput label="Theme" v-model="appSettings.theme" disabled />
            <BaseInput label="Currency" v-model="appSettings.currency" />
            <BaseInput label="Language" v-model="appSettings.language" />
        </div>

        <!-- Typography Section -->
        <h3 style="margin-top: 2rem; border-top: 1px solid var(--color-border); padding-top: 1rem;">PDF Typography</h3>
        <p style="font-size: 0.8rem; opacity: 0.7; margin-bottom: 1rem;">Configure fonts and sizes for the invoice PDF.</p>
        
        <div class="form-grid">
            <!-- Font Selection -->
            <div class="input-group">
                <label>Company Name Font</label>
                <select v-model="appSettings.pdfFontCompany" class="base-select">
                    <option value="helvetica">Helvetica (Standard)</option>
                    <option value="times">Times (Standard)</option>
                    <option value="courier">Courier (Standard)</option>
                    <option v-for="f in fontList" :key="f.id" :value="f.name">{{ f.name }} (Custom)</option>
                </select>
            </div>

            <div class="input-group">
                <label>Body Text Font</label>
                <select v-model="appSettings.pdfFontBody" class="base-select">
                    <option value="helvetica">Helvetica (Standard)</option>
                    <option value="times">Times (Standard)</option>
                    <option value="courier">Courier (Standard)</option>
                    <option v-for="f in fontList" :key="f.id" :value="f.name">{{ f.name }} (Custom)</option>
                </select>
            </div>
        </div>

        <div class="form-grid" style="margin-top: 1rem;">
             <BaseInput label="Company Name Size" type="number" v-model="appSettings.pdfFontSizeCompany" />
            <BaseInput label="Section Headers Size" type="number" v-model="appSettings.pdfFontSizeHeader" />
            <BaseInput label="Content Headers Size" type="number" v-model="appSettings.pdfFontSizeContentHeader" />
            <BaseInput label="Regular Text Size" type="number" v-model="appSettings.pdfFontSizeRegular" />
        </div>

        <!-- Font Manager -->
        <div class="font-manager" style="margin-top: 1rem; padding: 1rem; border: 1px dashed var(--color-border); border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                 <h4 style="margin: 0;">Custom Fonts</h4>
                 <label class="upload-btn">
                     Upload .ttf
                     <input type="file" accept=".ttf" @change="uploadFont" hidden>
                 </label>
            </div>
            
            <div v-if="fontList.length === 0" style="text-align: center; color: var(--color-fg-secondary); font-size: 0.9rem;">
                No custom fonts uploaded.
            </div>
            <div v-else class="font-list">
                <div v-for="font in fontList" :key="font.id" class="font-item">
                    <span>{{ font.name }}</span>
                    <button @click="deleteFont(font.id)" class="icon-btn danger"><Trash :size="16"/></button>
                </div>
            </div>
        </div>


        <h3 style="margin-top: 2rem; border-top: 1px solid var(--color-border); padding-top: 1rem;">PDF Margins (mm)</h3>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <BaseInput label="Top" type="number" v-model="appSettings.pdfMarginTop" />
            <BaseInput label="Bottom" type="number" v-model="appSettings.pdfMarginBottom" />
            <BaseInput label="Left" type="number" v-model="appSettings.pdfMarginLeft" />
            <BaseInput label="Right" type="number" v-model="appSettings.pdfMarginRight" />
        </div>

        <div class="actions">
             <BaseButton variant="secondary" @click="seedData" style="margin-right: auto;">Seed Demo Data</BaseButton>
            <BaseButton @click="save">Save Settings</BaseButton>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; }
.header { margin-bottom: 2rem; }
.header h2 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; }
.icon { color: var(--color-fg-primary); }
.settings-card { max-width: 600px; padding-bottom: 2rem; }
.form-grid { display: grid; gap: 1rem; margin: 1.5rem 0; }
.actions { display: flex; justify-content: flex-end; margin-top: 2rem; }

/* Font Manager Styles */
.base-select {
    width: 100%;
    padding: 0.75rem;
    background: var(--color-bg-muted);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-fg-primary);
    font-size: 1rem;
    cursor: pointer;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1em;
    color-scheme: dark;
}
.base-select option {
    background: var(--color-bg-muted);
    color: var(--color-fg-primary);
}
.input-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: var(--color-fg-secondary);
}
.upload-btn {
    background: var(--color-primary);
    color: var(--color-primary-fg);
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    font-weight: 600;
}
.upload-btn:hover {
    opacity: 0.9;
}
.font-list { display: flex; flex-direction: column; gap: 0.5rem; }
.font-item { 
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.5rem; background: var(--color-bg-muted); border-radius: 4px;
}
.icon-btn.danger { background: none; border: none; color: #ff4d4d; cursor: pointer; padding: 4px; }
.icon-btn.danger:hover { background: rgba(255, 77, 77, 0.1); border-radius: 4px; }
</style>
