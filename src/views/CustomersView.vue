<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type Customer } from '../db/db';
import { Plus, Pencil, Trash2 } from 'lucide-vue-next';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import PageHeader from '../components/ui/PageHeader.vue';

const showModal = ref(false);
const isEditing = ref(false);
const formData = ref<Partial<Customer>>({});
const customers = ref<Customer[]>([]);

const refresh = async () => {
    customers.value = await db.customers.toArray();
};

onMounted(refresh);

const openNew = () => {
    formData.value = { name: '', gstin: '', address: '', deliveryAddress: '', phone: '', email: '' };
    isEditing.value = false;
    showModal.value = true;
};

const edit = (c: Customer) => {
    formData.value = { ...c };
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
    await db.customers.delete(deleteId.value);
    await refresh();
    showDeleteConfirm.value = false;
    deleteId.value = null;
};

const save = async () => {
    console.log('Customer Save Called', formData.value);
    if (!formData.value.name) return alert('Name Required');
    try {
        const payload = JSON.parse(JSON.stringify(formData.value));
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
            <BaseButton @click="openNew" class="btn-compact">
                <span>Add<br>New</span>
                <Plus :size="20"/>
            </BaseButton>
        </template>
    </PageHeader>

    <div class="grid">
        <div v-for="c in customers" :key="c.id" class="customer-card card">
            <div class="header-row">
                <h4>{{ c.name }}</h4>
            </div>
            <div class="details">
                <span v-if="c.gstin">GST: {{ c.gstin }}</span>
                <span v-if="c.phone">{{ c.phone }}</span>
                <span v-if="c.email">{{ c.email }}</span>
                <span v-if="c.address" class="address">{{ c.address }}</span>
                <span v-if="c.deliveryAddress" class="address" style="color: var(--color-primary); opacity: 0.8;">Del: {{ c.deliveryAddress }}</span>
            </div>
            <div class="actions">
                <button @click="edit(c)" class="btn-icon"><Pencil :size="16"/></button>
                <button @click="confirmDelete(c.id)" class="btn-icon text-red"><Trash2 :size="16"/></button>
            </div>
        </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay">
        <div class="modal card">
            <h3>{{ isEditing ? 'Edit' : 'New' }} Customer</h3>
            <div class="form-grid">
                <BaseInput label="Name" v-model="formData.name!" />
                <BaseInput label="GSTIN" v-model="formData.gstin!" />
                <BaseInput label="Phone" v-model="formData.phone!" />
                <BaseInput label="Email" v-model="formData.email!" />
                <div class="full-width">
                    <BaseInput label="Address" v-model="formData.address!" />
                    <BaseInput label="Delivery Address" v-model="formData.deliveryAddress!" style="margin-top: 1rem;" />
                </div>
            </div>
            <div class="modal-actions">
                <BaseButton variant="ghost" @click="showModal = false">Cancel</BaseButton>
                <BaseButton @click="save">Save Customer</BaseButton>
            </div>
        </div>
    </div>

    <!-- Delete Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay">
        <div class="modal card" style="max-width: 400px;">
            <h3>Delete Customer?</h3>
            <p>Are you sure you want to delete this customer? This action cannot be undone.</p>
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
.customer-card { position: relative; display: flex; flex-direction: column; gap: 0.5rem; }
.details { font-size: 0.8rem; color: var(--color-fg-secondary); display: flex; flex-direction: column; gap: 0.2rem; margin-top: 1rem; }
.address { white-space: pre-line; opacity: 0.8; margin-top: 0.2rem; }
.actions { position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem; opacity: 0; transition: opacity 0.2s; }
.customer-card:hover .actions { opacity: 1; }
.btn-icon { background: none; border: none; color: var(--color-fg-secondary); cursor: pointer; padding: 4px; border-radius: 4px; }
.btn-icon:hover { background: var(--color-bg-muted); color: var(--color-fg-primary); }
.text-red:hover { color: var(--color-danger); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(2px); }
.modal { width: 100%; max-width: 500px; }
.form-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; margin: 1.5rem 0; }
.full-width { grid-column: 1 / -1; }
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
