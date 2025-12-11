<script setup lang="ts">
import { ref, onMounted } from 'vue';
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
        invoicePrefix: 'INV', 
        name: '', gstin: '', address: '', phone: '', email: '',
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
            <div class="header-row">
                <h4>{{ c.name }}</h4>
            </div>
            <p class="tagline" v-if="c.tagline">{{ c.tagline }}</p>
            <div class="details">
                <span v-if="c.invoicePrefix">Prefix: {{ c.invoicePrefix }}</span>
                <span v-if="c.gstin">GST: {{ c.gstin }}</span>
                <span v-if="c.phone">{{ c.phone }}</span>
                <span v-if="c.email">{{ c.email }}</span>
                <span v-if="c.address" class="address">{{ c.address }}</span>
                <div v-if="c.bankName" class="bank-lite">
                    <span>{{ c.bankName }}</span> • 
                    <span>{{ c.accountNumber }}</span>
                    <br/><span v-if="c.ifscCode" style="font-size: 0.7em; opacity: 0.7">IFSC: {{ c.ifscCode }}</span>
                </div>
            </div>
            <div class="actions">
                <button @click="edit(c)" class="btn-icon"><Pencil :size="16"/></button>
                <button @click="confirmDelete(c.id)" class="btn-icon text-red"><Trash2 :size="16"/></button>
            </div>
        </div>
    </div>

    <!-- Modal Overlay -->
    <div v-if="showModal" class="modal-overlay">
        <div class="modal card">
            <h3>{{ isEditing ? 'Edit' : 'New' }} Company</h3>
            <div class="form-grid">
                <BaseInput label="Company Name" v-model="formData.name!" placeholder="Acme Corp" />
                <BaseInput label="Tagline" v-model="formData.tagline!" placeholder="Solutions for you" />
                <BaseInput label="GSTIN" v-model="formData.gstin!" placeholder="29ABCDE1234F1Z5" />
                <BaseInput label="Invoice Prefix" v-model="formData.invoicePrefix!" placeholder="INV" />
                
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

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
.company-card { position: relative; display: flex; flex-direction: column; gap: 0.5rem; }
.tagline { color: var(--color-fg-muted); font-style: italic; font-size: 0.8rem; }
.details { font-size: 0.8rem; color: var(--color-fg-secondary); display: flex; flex-direction: column; gap: 0.2rem; margin-top: auto; padding-top: 1rem; }
.address { white-space: pre-line; opacity: 0.8; margin-top: 0.2rem; }
.bank-lite { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--color-border); font-size: 0.75rem; }
.actions { position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem; opacity: 0; transition: opacity 0.2s; }
.company-card:hover .actions { opacity: 1; }
.btn-icon { background: none; border: none; color: var(--color-fg-secondary); cursor: pointer; padding: 4px; border-radius: 4px; }
.btn-icon:hover { background: var(--color-bg-muted); color: var(--color-fg-primary); }
.text-red:hover { color: var(--color-danger); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(2px); }
.modal { width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
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
