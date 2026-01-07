<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type Customer } from '../db/db';
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-vue-next';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import PageHeader from '../components/ui/PageHeader.vue';

const showModal = ref(false);
const isEditing = ref(false);
const formData = ref<Partial<Customer>>({
    name: '', gstin: '', address: '', phone: '', email: '',
    deliveryAddresses: [], enableDelivery: false
});
const customers = ref<Customer[]>([]);

const refresh = async () => {
    customers.value = await db.customers.toArray();
};

onMounted(refresh);

const openNew = () => {
    formData.value = { 
        name: '', gstin: '', address: '', phone: '', email: '',
        deliveryAddresses: [], enableDelivery: false 
    };
    isEditing.value = false;
    showModal.value = true;
};

const edit = (c: Customer) => {
    // Deep copy to ensure reactivity for arrays
    formData.value = JSON.parse(JSON.stringify(c));
    // Ensure v5 defaults
    if (!formData.value.deliveryAddresses) formData.value.deliveryAddresses = [];
    if (formData.value.enableDelivery === undefined) formData.value.enableDelivery = false;
    
    isEditing.value = true;
    showModal.value = true;
};

// Delivery Address Logic
const addAddress = () => {
    if (!formData.value.deliveryAddresses) formData.value.deliveryAddresses = [];
    formData.value.deliveryAddresses.push('');
};
const removeAddress = (index: number) => {
    formData.value.deliveryAddresses?.splice(index, 1);
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
    await db.customers.delete(deleteId.value);
    await refresh();
    showDeleteConfirm.value = false;
    deleteId.value = null;
};

const save = async () => {
    if (!formData.value.name) return alert('Name Required');
    try {
        const payload = JSON.parse(JSON.stringify(formData.value));
        // Clean empty addresses
        if (payload.enableDelivery && payload.deliveryAddresses) {
            payload.deliveryAddresses = payload.deliveryAddresses.filter((a: string) => a.trim() !== '');
        } else {
            // Reset if disabled
            payload.deliveryAddresses = []; 
        }

        if (isEditing.value && payload.id) {
            await db.customers.update(payload.id, payload);
        } else {
            delete payload.id;
            await db.customers.add(payload);
        }
        showModal.value = false;
        await refresh();
    } catch (e: any) {
        console.error(e);
        alert('Error saving customer: ' + e.message);
    }
};
</script>

<template>
<div class="page-container">
    <PageHeader title="Customers">
        <template #actions>
            <BaseButton @click="openNew" class="btn-primary shadow-glow">
                <Plus :size="18"/> <span>New Customer</span>
            </BaseButton>
        </template>
    </PageHeader>

    <div class="grid">
        <div v-for="c in customers" :key="c.id" class="card customer-card">
            <div class="card-header">
                <h4 class="text-white">{{ c.name }}</h4>
                <div class="actions">
                    <button @click="edit(c)" class="btn-icon"><Pencil :size="16"/></button>
                    <button @click="confirmDelete(c.id)" class="btn-icon text-red"><Trash2 :size="16"/></button>
                </div>
            </div>
            
            <div class="details">
                <div class="section-label">BUSINESS DETAILS</div>
                <div class="info-row flex-row" v-if="c.gstin">
                    <span class="label">GSTIN:</span>
                    <span class="value">{{ c.gstin }}</span>
                </div>
                
                <div class="section-label mt-3">CONTACT INFO</div>
                <div class="info-row" v-if="c.phone || c.email">
                    <div class="col">
                        <div v-if="c.phone" class="flex-row"><span class="label">M:</span> <span class="value">{{ c.phone }}</span></div>
                        <div v-if="c.email" class="flex-row"><span class="label">E:</span> <span class="value">{{ c.email }}</span></div>
                    </div>
                </div>
                
                <div class="section-label mt-3">ADDRESS</div>
                <div class="info-block">
                    <p class="address">{{ c.address || '—' }}</p>
                </div>

                <div v-if="c.enableDelivery" class="delivery-badge mt-3" style="background: transparent; border: none; padding: 0;">
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span class="label" style="text-transform: none; color: var(--color-fg-secondary); font-size: 0.8rem;">Delivery Points</span>
                        <span class="count-badge">{{ c.deliveryAddresses?.length || 0 }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay">
        <div class="modal card glass-panel">
            <div class="modal-header">
                <h3>{{ isEditing ? 'Edit' : 'New' }} Customer</h3>
                <button @click="showModal = false" class="btn-icon-close"><X :size="20"/></button>
            </div>
            
            <div class="scroll-area">
                <div class="form-section">
                    <div class="section-title">BASIC INFORMATION</div>
                    <div class="form-grid">
                        <BaseInput label="Company Name" v-model="formData.name!" />
                        <BaseInput label="GSTIN" v-model="formData.gstin!" />
                        <BaseInput label="Phone" v-model="formData.phone!" />
                        <BaseInput label="Email" v-model="formData.email!" />
                    </div>
                </div>

                <div class="form-section mt-4">
                    <div class="section-title">BILLING ADDRESS</div>
                    <BaseInput label="Full Address" v-model="formData.address!" isTextarea />
                </div>

                <!-- Delivery Section -->
                <div class="form-section mt-4">
                    <div class="flex-between mb-2">
                        <div class="section-title mb-0">DELIVERY LOCATIONS</div>
                        <label class="toggle-flex">
                            <input type="checkbox" v-model="formData.enableDelivery">
                            <span class="toggle-track"></span>
                            <span class="ml-2 text-sm text-sec">Enable</span>
                        </label>
                    </div>

                    <div v-if="formData.enableDelivery" class="delivery-list-container">
                        <div v-if="!formData.deliveryAddresses?.length" class="empty-list">
                            No delivery locations added.
                        </div>
                        <div v-else class="address-list">
                            <div v-for="(_, idx) in formData.deliveryAddresses" :key="idx" class="address-item">
                                <div class="addr-header">
                                    <span class="addr-label">Location {{ idx + 1 }}</span>
                                    <button @click="removeAddress(idx)" class="btn-icon-del"><X :size="14"/></button>
                                </div>
                                <BaseInput v-model="formData.deliveryAddresses![idx]" placeholder="Enter address details..." />
                            </div>
                        </div>
                        <BaseButton variant="ghost" @click="addAddress" class="btn-add-loc">
                            <Plus :size="14"/> Add New Location
                        </BaseButton>
                    </div>
                </div>
            </div>

            <div class="modal-actions">
                <BaseButton variant="ghost" @click="showModal = false">Cancel</BaseButton>
                <BaseButton variant="primary" @click="save">Save Customer</BaseButton>
            </div>
        </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="showDeleteConfirm" class="modal-overlay">
        <div class="modal card bg-elevated" style="max-width: 400px;">
            <div class="flex-center text-red mb-2"><AlertTriangle :size="32"/></div>
            <h3 class="text-center">Delete Customer?</h3>
            <p class="text-center text-sec mt-2">This action cannot be undone.</p>
            <div class="modal-actions justify-center mt-6">
                <BaseButton variant="ghost" @click="showDeleteConfirm = false">Cancel</BaseButton>
                <BaseButton variant="danger" @click="remove">Delete Forever</BaseButton>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem 2rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }

/* Card Premium - Headers added */
.customer-card { 
    transition: all 0.2s; 
    border: 1px solid var(--color-border);
    background: linear-gradient(145deg, var(--color-bg-card) 0%, rgba(255,255,255,0.02) 100%);
    padding: 0; /* Reset padding for header layout */
    overflow: hidden;
}
.customer-card:hover { transform: translateY(-4px); border-color: var(--color-primary-dim); box-shadow: 0 10px 20px -5px rgba(0,0,0,0.3); }

.card-header { padding: 1.25rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
.details { padding: 1.25rem; }

.section-label { font-size: 0.65rem; font-weight: 700; color: var(--color-fg-tertiary); letter-spacing: 0.1em; margin-bottom: 0.5rem; text-transform: uppercase; }
.info-row { font-size: 0.9rem; margin-bottom: 0.5rem; }
.flex-row { display: flex; gap: 0.5rem; align-items: baseline; }
.label { color: var(--color-fg-secondary); font-size: 0.8rem; font-weight: 600; min-width: 40px; }
.value { color: var(--color-fg-primary); }
.address { white-space: pre-line; color: var(--color-fg-secondary); font-size: 0.85rem; line-height: 1.5; }

.delivery-badge { background: rgba(var(--color-primary-rgb), 0.1); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid rgba(var(--color-primary-rgb), 0.2); }
.count-badge { background: var(--color-primary); color: #000; font-weight: 700; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; }
.text-accent { color: var(--color-primary); }
.text-white { color: var(--color-fg-primary); font-size: 1.1rem; }

/* Actions */
.actions { display: flex; gap: 0.5rem; opacity: 0.4; transition: opacity 0.2s; }
.customer-card:hover .actions { opacity: 1; }
.btn-icon { background: rgba(255,255,255,0.05); border: none; color: var(--color-fg-primary); cursor: pointer; padding: 8px; border-radius: 6px; }
.btn-icon:hover { background: var(--color-primary); color: #000; }
.btn-icon.text-red:hover { background: var(--color-danger); color: #fff; }

/* Modal */
.modal-overlay { 
    position: fixed; 
    inset: 0; 
    background: rgba(0,0,0,0.7); 
    backdrop-filter: blur(8px); 
    display: flex; 
    align-items: flex-start; 
    justify-content: center; 
    z-index: 50; 
    padding-top: 6rem; 
    padding-bottom: 10rem; 
    overflow-y: auto; 
}
@media (max-width: 640px) {
    .modal-overlay { padding-top: 8rem; }
}
.modal { width: 95%; max-width: 650px; height: auto; display: flex; flex-direction: column; overflow: visible; border: 1px solid var(--color-primary-dim); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
.modal-header { padding: 1.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); }
.scroll-area { overflow-y: auto; padding: 1.5rem; max-height: 65vh; }
.section-title { font-size: 0.75rem; font-weight: 700; color: var(--color-primary); letter-spacing: 0.1em; margin-bottom: 1rem; text-transform: uppercase; border-left: 2px solid var(--color-primary); padding-left: 0.5rem; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
@media (max-width: 640px) {
    .form-grid { grid-template-columns: 1fr; gap: 0.75rem; }
}

/* Delivery List */
.delivery-list-container { background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid var(--color-border); margin-top: 1rem; }
.empty-list { text-align: center; color: var(--color-fg-muted); font-style: italic; font-size: 0.9rem; padding: 1rem; }
.address-item { background: var(--color-bg-card); padding: 1rem; border-radius: 6px; border: 1px solid var(--color-border); margin-bottom: 0.75rem; position: relative; }
.addr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--color-bg-muted); padding-bottom: 0.5rem; }
.addr-label { font-size: 0.75rem; font-weight: 600; color: var(--color-fg-secondary); text-transform: uppercase; }
.btn-icon-del { background: transparent; border: none; color: var(--color-fg-muted); cursor: pointer; }
.btn-icon-del:hover { color: var(--color-danger); }
.btn-add-loc { width: 100%; border: 1px dashed var(--color-border); color: var(--color-fg-secondary); }
.btn-add-loc:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.05); }

.modal-actions { padding: 1.5rem; border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; gap: 1rem; background: var(--color-bg-elevated); }
.btn-icon-close { background: transparent; border: none; color: var(--color-fg-secondary); cursor: pointer; }
.btn-icon-close:hover { color: var(--color-fg-primary); }

/* Toggle */
.toggle-flex { display: flex; align-items: center; cursor: pointer; }
.toggle-flex input { display: none; }
.toggle-track { width: 36px; height: 20px; background: var(--color-bg-muted); border-radius: 10px; position: relative; border: 1px solid var(--color-border); transition: 0.2s; }
.toggle-track::after { content: ''; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px; background: var(--color-fg-muted); border-radius: 50%; transition: 0.2s; }
.toggle-flex input:checked + .toggle-track { background: var(--color-primary); border-color: var(--color-primary); }
.toggle-flex input:checked + .toggle-track::after { transform: translateX(16px); background: #000; }

.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
.mb-0 { margin-bottom: 0; }
.text-sec { color: var(--color-fg-secondary); }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
</style>
