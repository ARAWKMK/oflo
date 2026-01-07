<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type Product } from '../db/db';
import { Plus, Pencil, Trash2 } from 'lucide-vue-next';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import PageHeader from '../components/ui/PageHeader.vue';

const showModal = ref(false);
const isEditing = ref(false);
const formData = ref<Partial<Product>>({});
const products = ref<Product[]>([]);

const refresh = async () => {
    products.value = await db.products.toArray();
};

onMounted(refresh);

const openNew = () => {
    formData.value = { name: '', description: '', hsn: '', unitPrice: 0, taxRate: 18 };
    isEditing.value = false;
    showModal.value = true;
};

const edit = (p: Product) => {
    formData.value = { ...p };
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
    await db.products.delete(deleteId.value);
    await refresh();
    showDeleteConfirm.value = false;
    deleteId.value = null;
};

const save = async () => {
    console.log('Product Save Called', formData.value);
    if (!formData.value.name) return alert('Product Name Required');
    
    try {
        const payload = JSON.parse(JSON.stringify(formData.value));
        // Ensure numbers
        payload.unitPrice = Number(payload.unitPrice);
        payload.taxRate = Number(payload.taxRate);

        if (isEditing.value && payload.id) {
            await db.products.update(payload.id, payload);
        } else {
            delete payload.id;
            await db.products.add(payload);
        }
        showModal.value = false;
        await refresh();
    } catch (e: any) {
        console.error(e);
        alert('Error saving product: ' + e.message);
    }
};
</script>

<template>
<div class="page-container">
    <PageHeader title="Products">
        <template #actions>
            <BaseButton @click="openNew" class="btn-compact">
                <span>Add<br>New</span>
                <Plus :size="20"/>
            </BaseButton>
        </template>
    </PageHeader>

    <div class="grid">
        <div v-for="p in products" :key="p.id" class="product-card card">
            <div class="card-header">
                <h4 class="text-white">{{ p.name }}</h4>
                <div class="actions">
                    <button @click="edit(p)" class="btn-icon"><Pencil :size="16"/></button>
                    <button @click="confirmDelete(p.id)" class="btn-icon text-red"><Trash2 :size="16"/></button>
                </div>
            </div>
            
            <div class="details">
                 <p class="desc" v-if="p.description">{{ p.description }}</p>

                 <div class="info-row flex-row mt-3">
                    <span class="label">Price:</span>
                    <span class="value text-white" style="font-size: 1.1rem; font-weight: 600;">₹{{ p.unitPrice }}</span>
                 </div>
                 <div class="info-row flex-row">
                    <span class="label">Tax:</span>
                    <span class="value">{{ p.taxRate }}%</span>
                 </div>
                 <div class="info-row flex-row" v-if="p.hsn">
                    <span class="label">HSN:</span>
                    <span class="value-mono">{{ p.hsn }}</span>
                 </div>
            </div>
        </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay">
        <div class="modal card">
            <h3>{{ isEditing ? 'Edit' : 'New' }} Product</h3>
            <div class="form-grid">
                <div class="full-width">
                     <BaseInput label="Name" v-model="formData.name!" />
                </div>
                <div class="full-width">
                     <BaseInput label="Description" v-model="formData.description!" />
                </div>
                <BaseInput label="HSN Code" v-model="formData.hsn!" />
                <BaseInput label="Tax Rate (%)" v-model.number="formData.taxRate!" type="number" />
                <BaseInput label="Unit Price" v-model.number="formData.unitPrice!" type="number" step="0.01" />
            </div>
            <div class="modal-actions">
                <BaseButton variant="ghost" @click="showModal = false">Cancel</BaseButton>
                <BaseButton @click="save">Save Product</BaseButton>
            </div>
        </div>
    </div>

    <!-- Delete Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay">
        <div class="modal card" style="max-width: 400px;">
            <h3>Delete Product?</h3>
            <p>Are you sure you want to delete this product? This action cannot be undone.</p>
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
/* .header remove - replaced by PageHeader */

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
.product-card { position: relative; display: flex; flex-direction: column; gap: 0.5rem; min-height: 200px; }

.card-header { margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
.card-header h4 { font-size: 1.1rem; font-weight: 600; }

.desc { color: var(--color-fg-muted); font-size: 0.9rem; margin-bottom: 0.5rem; line-height: 1.4; font-style: italic; }
.details { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }

.info-row { font-size: 0.9rem; margin-bottom: 0.25rem; }
.flex-row { display: flex; gap: 0.5rem; align-items: baseline; }
.label { color: var(--color-fg-secondary); font-size: 0.8rem; font-weight: 600; min-width: 40px; }
.value { color: var(--color-fg-primary); }
.value-mono { font-family: var(--font-mono); color: var(--color-fg-primary); letter-spacing: 0.5px; }

.actions { display: flex; gap: 0.5rem; opacity: 0.4; transition: opacity 0.2s; }
.product-card:hover .actions { opacity: 1; }
.btn-icon { background: rgba(255,255,255,0.05); border: none; color: var(--color-fg-primary); cursor: pointer; padding: 6px; border-radius: 4px; }
.btn-icon:hover { background: var(--color-primary); color: #000; }
.text-red:hover { background: var(--color-danger); color: white; }

.text-white { color: var(--color-fg-primary); }
.mt-3 { margin-top: auto; padding-top: 0.75rem; border-top: 1px dashed var(--color-border); }

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
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; }

/* Compact Button Style (local - should be global eventually but here for now so it works) */
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
