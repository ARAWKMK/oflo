<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { db, type Company } from '../db/db';
import { Plus, Pencil, Trash2 } from 'lucide-vue-next';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import PageHeader from '../components/ui/PageHeader.vue';

// Simple Reactive State
const showModal = ref(false);
const isEditing = ref(false);
const formData = ref<Partial<Company>>({});
const companies = ref<Company[]>([]);

// Fetch Data (Simple version without complex composables first)
const refresh = async () => {
    companies.value = await db.companies.toArray();
};

onMounted(refresh);

const openNew = () => {
    formData.value = { 
        salesPrefix: 'SAL', 
        name: '', alias: '', gstin: '', address: '', phone: '', email: '',
        tagline: '', bankName: '', accountNumber: '', ifscCode: ''
    };
    isEditing.value = false;
    showModal.value = true;
};

const edit = (company: Company) => {
    formData.value = { ...company };
    isEditing.value = true;
    showModal.value = true;
};

// v5: Enforce Alphanumeric Prefix
watch(() => formData.value.salesPrefix, (newVal) => {
    if (newVal) {
        const cleaned = newVal.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (cleaned !== newVal) {
            formData.value.salesPrefix = cleaned;
        }
    }
});


const showDeleteConfirm = ref(false);
const deleteId = ref<number | null>(null);

const confirmDelete = (id?: number) => {
    if(!id) return;
    deleteId.value = id;
    showDeleteConfirm.value = true;
};

const remove = async () => {
    if(!deleteId.value) return;
    await db.companies.delete(deleteId.value);
    await refresh();
    showDeleteConfirm.value = false;
    deleteId.value = null;
};

const save = async () => {
    if (!formData.value.name) return alert('Name Required');
    
    try {
        const payload = JSON.parse(JSON.stringify(formData.value));
        if (isEditing.value && payload.id) {
            await db.companies.update(payload.id, payload);
        } else {
            delete payload.id; // Ensure auto-increment works
            await db.companies.add(payload);
        }
        showModal.value = false;
        await refresh();
    } catch (e: any) {
        console.error(e);
        alert('Error saving company: ' + e.message);
    }
};
</script>

<template>
<div class="page-container">
    <PageHeader title="Companies">
        <template #actions>
            <BaseButton @click="openNew" class="btn-compact">
                <span>Add<br>New</span>
                <Plus :size="20"/>
            </BaseButton>
        </template>
    </PageHeader>

    <div class="grid">
        <div v-for="c in companies" :key="c.id" class="company-card card">
            <div class="card-header">
                <div class="header-main">
                    <h4 class="text-white">{{ c.alias || c.name }}</h4>
                    <span v-if="c.alias && c.alias !== c.name" class="official-name">{{ c.name }}</span>
                </div>
                <div class="actions">
                    <button @click="edit(c)" class="btn-icon"><Pencil :size="16"/></button>
                    <button @click="confirmDelete(c.id)" class="btn-icon text-red"><Trash2 :size="16"/></button>
                </div>
            </div>
            
            <p class="tagline" v-if="c.tagline">{{ c.tagline }}</p>
            
            <div class="details">
                <div class="info-row flex-row" v-if="c.salesPrefix">
                    <span class="label">Prefix:</span>
                    <span class="value">{{ c.salesPrefix }}</span>
                </div>
                <div class="info-row flex-row" v-if="c.gstin">
                    <span class="label">GSTIN:</span>
                    <span class="value-mono">{{ c.gstin }}</span>
                </div>
                <div class="info-row flex-row" v-if="c.phone">
                    <span class="label">M:</span>
                    <span class="value">{{ c.phone }}</span>
                </div>
                 <div class="info-row flex-row" v-if="c.email">
                    <span class="label">E:</span>
                    <span class="value" style="word-break: break-all;">{{ c.email }}</span>
                </div>

                <div class="info-block mt-3" v-if="c.address">
                     <p class="address">{{ c.address }}</p>
                </div>

                <div v-if="c.bankName" class="bank-section mt-3">
                    <div class="section-label" style="margin-bottom: 0.25rem;">BANK DETAILS</div>
                    <div class="bank-row">
                        <span class="value text-white">{{ c.bankName }}</span>
                        <span class="text-sec" v-if="c.accountNumber">• {{ c.accountNumber }}</span>
                    </div>
                    <div class="info-row flex-row" v-if="c.ifscCode" style="margin-top: 0.2rem;">
                         <span class="label" style="font-size: 0.7rem;">IFSC:</span>
                         <span class="value" style="font-size: 0.7rem; opacity: 0.8;">{{ c.ifscCode }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Overlay -->
    <div v-if="showModal" class="modal-overlay">
        <div class="modal card">
            <h3>{{ isEditing ? 'Edit' : 'New' }} Company</h3>
            <div class="form-grid">
                <BaseInput label="Company Name (Official)" v-model="formData.name!" placeholder="Acme Corp Pvt Ltd" />
                <BaseInput label="Company Alias (Nick Name)" v-model="formData.alias!" placeholder="Acme" />
                <BaseInput label="Tagline" v-model="formData.tagline!" placeholder="Solutions for you" />
                <BaseInput label="GSTIN" v-model="formData.gstin!" placeholder="29ABCDE1234F1Z5" />
                <BaseInput label="Sales Prefix" v-model="formData.salesPrefix!" placeholder="SAL" />
                
                <BaseInput label="Phone" v-model="formData.phone!" placeholder="+91..." />
                <BaseInput label="Email" v-model="formData.email!" type="email" />
                
                <div class="full-width">
                    <BaseInput label="Address" v-model="formData.address!" placeholder="Full address" />
                </div>
                
                <div class="full-width">
                    <label>Bank Details</label>
                    <div class="bank-grid">
                         <BaseInput label="Bank Name" v-model="formData.bankName!" placeholder="HDFC" />
                         <BaseInput label="Account No" v-model="formData.accountNumber!" placeholder="000..." />
                         <BaseInput label="IFSC" v-model="formData.ifscCode!" placeholder="HDFC000..." />
                    </div>
                </div>

                <div class="full-width">
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #888;">Terms & Conditions</label>
                    <textarea 
                        v-model="formData.terms" 
                        rows="4" 
                        placeholder="Enter payment terms, delivery notes, etc."
                        style="width: 100%; padding: 0.75rem; background: #222; border: 1px solid #333; color: white; border-radius: 6px; resize: vertical;"
                    ></textarea>
                </div>
            </div>
            <div class="modal-actions">
                <BaseButton variant="ghost" @click="showModal = false">Cancel</BaseButton>
                <BaseButton @click="save">Save Company</BaseButton>
            </div>
        </div>
    </div>

    <!-- Delete Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay">
        <div class="modal card" style="max-width: 400px;">
            <h3>Delete Company?</h3>
            <p>Are you sure you want to delete this company? This action cannot be undone.</p>
            <div class="modal-actions" style="margin-top: 1.5rem;">
                <BaseButton variant="ghost" @click="showDeleteConfirm = false">Cancel</BaseButton>
                <BaseButton variant="danger" @click="remove">Delete</BaseButton>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; }
/* .header remove */

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
.company-card { position: relative; display: flex; flex-direction: column; gap: 0.5rem; min-height: 280px; }
.card-header { margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: flex-start; }
.header-main { display: flex; flex-direction: column; gap: 2px; }
.card-header h4 { font-size: 1.1rem; font-weight: 600; line-height: 1.2; }
.official-name { font-size: 0.75rem; color: var(--color-fg-secondary); font-style: italic; }

.tagline { color: var(--color-fg-muted); font-style: italic; font-size: 0.8rem; margin-bottom: 0.5rem; }
.details { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }

.info-row { font-size: 0.9rem; margin-bottom: 0.25rem; }
.flex-row { display: flex; gap: 0.5rem; align-items: baseline; }
.label { color: var(--color-fg-secondary); font-size: 0.8rem; font-weight: 600; min-width: 40px; }
.value { color: var(--color-fg-primary); }
.value-mono { font-family: var(--font-mono); color: var(--color-fg-primary); letter-spacing: 0.5px; }

.address { white-space: pre-line; color: var(--color-fg-secondary); font-size: 0.85rem; line-height: 1.5; }
.bank-section { padding-top: 0.5rem; border-top: 1px solid var(--color-border); }
.section-label { font-size: 0.65rem; font-weight: 700; color: var(--color-fg-tertiary); letter-spacing: 0.1em; text-transform: uppercase; }

.actions { display: flex; gap: 0.5rem; opacity: 0.4; transition: opacity 0.2s; }
.company-card:hover .actions { opacity: 1; }
.btn-icon { background: rgba(255,255,255,0.05); border: none; color: var(--color-fg-primary); cursor: pointer; padding: 6px; border-radius: 4px; }
.btn-icon:hover { background: var(--color-primary); color: #000; }
.text-red:hover { background: var(--color-danger); color: white; }

.text-white { color: var(--color-fg-primary); }
.text-sec { color: var(--color-fg-secondary); }
.mt-3 { margin-top: 0.75rem; }

/* Modal */
/* Modal */
.modal-overlay { 
    position: fixed; 
    inset: 0; 
    background: rgba(0,0,0,0.7); 
    display: flex; 
    align-items: flex-start; 
    justify-content: center; 
    z-index: 50; 
    backdrop-filter: blur(2px); 
    padding-top: 6rem; 
    padding-bottom: 10rem; 
    overflow-y: auto; 
}
@media (max-width: 640px) {
    .modal-overlay { padding-top: 8rem; }
}
.modal { width: 100%; max-width: 500px; height: auto; }
.form-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; margin: 1.5rem 0; }
.full-width { grid-column: 1 / -1; }
.bank-grid { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; }

/* Compact Button */
:deep(.btn-compact) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    line-height: 1.1;
    text-align: right;
    padding: 0.4rem 0.8rem;
    height: auto;
}
:deep(.btn-compact span) {
    font-size: 0.8rem;
    font-weight: 600;
}
</style>
