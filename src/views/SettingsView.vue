<script setup lang="ts">
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { ref, onMounted } from 'vue';
import { db } from '../db/db';
import { Trash, Shield, Key } from 'lucide-vue-next';
import { accessControlService } from '../services/accessControlService';
import { APP_VERSION } from '../version';
import { DB_VERSION } from '../db/db';
import { isDbEmpty } from '../services/seedService';

const securitySection = ref({
    hasAdmin: false,
    hasViewer: false,
    adminPass: '',
    confirmAdminPass: '',
    regularPass: '',
    confirmRegularPass: '',
    currentAdminPass: '', // New authentication field
    isLoading: false,
    msg: ''
});

const loadSecurityStatus = async () => {
    securitySection.value.hasAdmin = await accessControlService.hasAdminPassword();
    securitySection.value.hasViewer = await accessControlService.hasViewerPassword();
};

const handleSetAdmin = async () => {
    const s = securitySection.value;
    
    // Auth Check: If Admin exists, must verify current password
    if (s.hasAdmin) {
        if (!s.currentAdminPass) {
            alert('Please enter your Current Admin Password to make changes.');
            return;
        }
        const isValid = await accessControlService.verifyAdmin(s.currentAdminPass);
        if (!isValid) {
            alert('❌ Incorrect Current Admin Password.');
            return;
        }
    }

    if (s.adminPass.length < 4) {
        alert('Admin password is too short. It must be at least 4 characters.');
        return;
    }
    if (s.adminPass !== s.confirmAdminPass) {
        alert('Admin passwords do not match. Please re-enter.');
        return;
    }

    s.isLoading = true;
    try {
        await accessControlService.setAdminPassword(s.adminPass);
        alert('✅ SUCCESS: Admin Password has been updated successfully.');
        s.msg = 'Admin password updated successfully';
        s.adminPass = ''; s.confirmAdminPass = ''; s.currentAdminPass = '';
        await loadSecurityStatus();
    } catch (e) {
        alert('❌ ERROR: Failed to set Admin Password. Please try again.');
        console.error(e);
        s.msg = 'Error setting admin password';
    } finally {
        s.isLoading = false;
    }
};

const handleSetRegular = async () => {
    const s = securitySection.value;

    // Auth Check: If Admin exists, must verify current password
    if (s.hasAdmin) {
        if (!s.currentAdminPass) {
            alert('Please enter the Admin Password to authorize this change.');
            return;
        }
        const isValid = await accessControlService.verifyAdmin(s.currentAdminPass);
        if (!isValid) {
            alert('❌ Authorization Failed: Incorrect Admin Password.');
            return;
        }
    }

    if (s.regularPass.length < 4) {
        alert('Regular password is too short. It must be at least 4 characters.');
        return;
    }
    if (s.regularPass !== s.confirmRegularPass) {
        alert('Regular passwords do not match. Please re-enter.');
        return;
    }
    
    s.isLoading = true;
    try {
        await accessControlService.setViewerPassword(s.regularPass);
        alert('✅ SUCCESS: Regular Viewer Password has been updated successfully.');
        s.msg = 'Regular Viewer password updated';
        s.regularPass = ''; s.confirmRegularPass = ''; s.currentAdminPass = '';
        await loadSecurityStatus(); 
    } catch (e) {
        alert('❌ ERROR: Failed to set Regular Password. Please try again.');
        console.error(e);
        s.msg = 'Error setting regular password';
    } finally {
        s.isLoading = false;
    }
};

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
    pdfFontCompanyBold: true,
    pdfFontCompanyItalic: false,
    pdfFontBody: 'helvetica',
    pdfQuality: 'standard', // 'standard' | 'high'
    // PDF Config
    pdfPageSizeSale: 'a4',
    pdfPageSizeChallan: 'a4'
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

const canSeed = ref(false);

const loadSeedingStatus = async () => {
    try {
        canSeed.value = await isDbEmpty();
    } catch (e) {
        console.error("Failed to check DB status", e);
    }
};

const handleSeedData = async () => {
    // Check if we can seed
    const isEmpty = await isDbEmpty();
    
    let confirmMsg = 'This will add ~450 demo sales, companies, and products. Continue?';
    if (!isEmpty) {
        confirmMsg = 'Database is NOT empty. To seed demo data, we need to CLEAR all existing Transactions, Companies, and Customers first. Proceed with WIPE & SEED?';
    }

    if (!confirm(confirmMsg)) return;
    
    securitySection.value.isLoading = true;
    securitySection.value.msg = 'Seeding demo data... please wait...';
    
    try {
        const { seedDemoData } = await import('../services/seedService');
        
        // If not empty, we must wipe first (since seedDemoData throws if not empty)
        if (!isEmpty) {
            await db.transaction('rw', [db.companies, db.customers, db.products, db.sales, db.salesVersions], async () => {
                await db.companies.clear();
                await db.customers.clear();
                await db.products.clear();
                await db.sales.clear();
                await db.salesVersions.clear();
            });
        }

        await seedDemoData();
        alert('✅ SUCCESS: Demo Data Added! Your dashboard and reports are now populated.');
        securitySection.value.msg = 'Demo data seeded successfully';
        canSeed.value = false; 
    } catch (e: any) {
        alert('❌ ERROR: Failed to seed data: ' + e.message);
        securitySection.value.msg = 'Error seeding data';
    } finally {
        securitySection.value.isLoading = false;
        await loadSeedingStatus();
    }
};

onMounted(async () => {
    await loadSettings();
    await loadSeedingStatus();
    await loadSecurityStatus();
});
</script>

<template>
<div class="page-container">
    <PageHeader title="Settings" :showBack="true" />

    <div class="card settings-card">
        <h3 style="margin-top: 0; padding-top: 0;">PDF Configuration</h3>
        <div class="form-grid">
             <div class="input-group">
                <label>Page Size (Sale)</label>
                <select v-model="appSettings.pdfPageSizeSale" class="base-select">
                    <option value="a4">A4 (210mm x 297mm)</option>
                    <option value="letter">Letter (216mm x 279mm)</option>
                    <option value="executive">Executive (184mm x 267mm)</option>
                    <option value="b5">B5 (176mm x 250mm)</option>
                </select>
            </div>
             <div class="input-group">
                <label>Page Size (Challan)</label>
                <select v-model="appSettings.pdfPageSizeChallan" class="base-select">
                    <option value="a4">A4 (210mm x 297mm)</option>
                    <option value="letter">Letter (216mm x 279mm)</option>
                    <option value="executive">Executive (184mm x 267mm)</option>
                    <option value="b5">B5 (176mm x 250mm)</option>
                </select>
            </div>
             <div class="input-group">
                <label>Quality</label>
                <select v-model="appSettings.pdfQuality" class="base-select">
                    <option value="standard">Standard (Efficient)</option>
                    <option value="high">High Quality (Precision)</option>
                </select>
            </div>
        </div>

            <!-- Security Section -->
            <h3 style="margin-top: 2rem; border-top: 1px solid var(--color-border); padding-top: 1rem;">Security & Access Control</h3>
            <p style="font-size: 0.8rem; opacity: 0.7; margin-bottom: 1rem;">Protect your reports with tiered password access.</p>
            
            <div class="form-grid" style="grid-template-columns: 1fr;">
                
                <!-- Admin Setup -->
                <div class="card p-4 bg-surface rounded-lg border border-border">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <Shield class="w-5 h-5 text-primary" />
                            <h4 class="font-bold">Admin Access</h4>
                        </div>
                        <div class="text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"
                             :class="securitySection.hasAdmin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                            <span v-if="securitySection.hasAdmin">● Active</span>
                            <span v-else>○ Not Set</span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Auth Field -->
                        <div v-if="securitySection.hasAdmin" class="input-group md:col-span-2">
                            <label class="text-primary font-bold mb-2">Current Admin Password (Required)</label>
                            <input type="password" v-model="securitySection.currentAdminPass" class="base-input border-primary" placeholder="Required to authorize changes" />
                        </div>

                        <div class="input-group">
                            <label>{{ securitySection.hasAdmin ? 'Change Admin Password' : 'Set Admin Password' }}</label>
                            <input type="password" v-model="securitySection.adminPass" class="base-input" placeholder="New Admin Password" />
                        </div>
                        <div class="input-group">
                            <label>Confirm Password</label>
                            <input type="password" v-model="securitySection.confirmAdminPass" class="base-input" placeholder="Confirm Password" />
                        </div>
                    </div>

                    <div class="mt-4 flex justify-end">
                        <BaseButton variant="primary" :loading="securitySection.isLoading" @click="handleSetAdmin">
                            {{ securitySection.hasAdmin ? 'Update Admin Password' : 'Set Admin Password' }}
                        </BaseButton>
                    </div>
                </div>

                <!-- Regular Viewer Setup -->
                <div class="card p-4 bg-surface rounded-lg border border-border mt-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <Key class="w-5 h-5 text-secondary" />
                            <h4 class="font-bold">Regular Viewer Access</h4>
                        </div>
                        <div class="text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"
                             :class="securitySection.hasViewer ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                            <span v-if="securitySection.hasViewer">● Active</span>
                            <span v-else>○ Not Set</span>
                        </div>
                    </div>
                    
                    <div v-if="!securitySection.hasAdmin" class="p-4 bg-gray-100 rounded text-center text-sm text-gray-500">
                        <Shield class="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        Please set an <strong>Admin Password</strong> first to enable Viewer Access configuration.
                    </div>
                    
                    <div v-else>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Auth Field for Regular Changes -->
                            <div class="input-group md:col-span-2">
                                <label class="text-primary font-bold">Current Admin Password (Required)</label>
                                <input type="password" v-model="securitySection.currentAdminPass" class="base-input border-primary" placeholder="Authorize this change" />
                            </div>

                            <div class="input-group">
                                <label>Set Regular Password</label>
                                <input type="password" v-model="securitySection.regularPass" class="base-input" placeholder="New Regular Password" />
                            </div>
                            <div class="input-group">
                                <label>Confirm Password</label>
                                <input type="password" v-model="securitySection.confirmRegularPass" class="base-input" placeholder="Confirm Password" />
                            </div>
                        </div>

                        <div class="mt-4 flex justify-end">
                            <BaseButton variant="secondary" :loading="securitySection.isLoading" @click="handleSetRegular">
                                Update Viewer Password
                            </BaseButton>
                        </div>
                    </div>
                </div>
                
                <div v-if="securitySection.msg" class="mt-4 p-3 rounded bg-bg-subtle text-green-400 text-center font-bold">
                    {{ securitySection.msg }}
                </div>
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
                <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="appSettings.pdfFontCompanyBold"> Bold
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="appSettings.pdfFontCompanyItalic"> Italic
                    </label>
                </div>
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
             <BaseButton variant="secondary" @click="handleSeedData" :loading="securitySection.isLoading" style="margin-right: auto;">
                 Seed Demo Data
             </BaseButton>
            <BaseButton @click="save">Save Settings</BaseButton>
        </div>

        <!-- System Information -->
        <div class="system-info">
            <div class="info-title">System Information</div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">App Version:</span>
                    <span class="info-value">v{{ APP_VERSION }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Database:</span>
                    <span class="info-value">v{{ DB_VERSION }}</span>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem 15rem 1rem; }
.header { margin-bottom: 2rem; }
.header h2 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; }
.icon { color: var(--color-fg-primary); }
.icon { color: var(--color-fg-primary); }
.settings-card { max-width: 600px; padding-bottom: 2rem; }
.form-grid { display: grid; gap: 1rem; margin: 1.5rem 0; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--color-fg-primary); cursor: pointer; }
.checkbox-label input { width: auto; margin: 0; }
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
    background-size: 1em;
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

/* System Info Section */
.system-info {
    margin-top: 3rem;
    padding: 1.5rem;
    background: var(--color-bg-app);
    border: 1px solid var(--color-border);
    border-radius: 8px;
}

.info-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-fg-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 1rem;
}

.info-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.info-label {
    font-size: 0.7rem;
    color: var(--color-fg-secondary);
}

.info-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-primary);
    font-family: monospace;
}
</style>
