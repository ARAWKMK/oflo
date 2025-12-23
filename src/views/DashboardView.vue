<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { db } from '../db/db';
import PageHeader from '../components/ui/PageHeader.vue';
import { Building2, Users, Package, FileText, Settings, Database, BarChart3 } from 'lucide-vue-next';

const router = useRouter();

const counts = ref({
    companies: 0,
    customers: 0,
    products: 0,
    invoices: 0
});

onMounted(async () => {
    counts.value.companies = await db.companies.count();
    counts.value.customers = await db.customers.count();
    counts.value.products = await db.products.count();
    counts.value.invoices = await db.invoices.count();
});

const navigateTo = (path: string) => {
    router.push(path);
};
</script>

<template>
  <div class="page-container">
    <PageHeader title="Dashboard" />
    
    <div class="dashboard-grid">
        <div class="stat-card card clickable" @click="navigateTo('/companies')">
            <div class="card-icon"><Building2 :size="24" /></div>
            <h3>Companies</h3>
            <div class="count">{{ counts.companies }}</div>
        </div>
        <div class="stat-card card clickable" @click="navigateTo('/customers')">
            <div class="card-icon"><Users :size="24" /></div>
            <h3>Customers</h3>
            <div class="count">{{ counts.customers }}</div>
        </div>
        <div class="stat-card card clickable" @click="navigateTo('/products')">
            <div class="card-icon"><Package :size="24" /></div>
            <h3>Products</h3>
            <div class="count">{{ counts.products }}</div>
        </div>
        <div class="stat-card card clickable" @click="navigateTo('/sales')">
            <div class="card-icon"><FileText :size="24" /></div>
            <h3>Sales</h3>
            <div class="count">{{ counts.invoices }}</div>
        </div>
        
        <!-- New Sections -->
        <div class="stat-card card clickable" @click="navigateTo('/reports')">
            <div class="card-icon"><BarChart3 :size="24" /></div>
            <h3>Reports</h3>
            <div class="action-text">View</div>
        </div>
        <div class="stat-card card clickable" @click="navigateTo('/backup')">
            <div class="card-icon"><Database :size="24" /></div>
            <h3>Backup</h3>
            <div class="action-text">Manage</div>
        </div>
        <div class="stat-card card clickable" @click="navigateTo('/settings')">
            <div class="card-icon"><Settings :size="24" /></div>
            <h3>Settings</h3>
            <div class="action-text">Configure</div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.page-container { padding: 0 1rem; }
.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
}

.stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    transition: all 0.2s ease;
    border: 1px solid var(--color-border);
    position: relative;
    overflow: hidden;
}

.stat-card.clickable {
    cursor: pointer;
}

.stat-card.clickable:hover {
    transform: translateY(-2px);
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.card-icon {
    margin-bottom: 0.5rem;
    color: var(--color-primary);
    opacity: 0.8;
}

.stat-card h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-fg-secondary);
    font-weight: 500;
}

.stat-card .count {
    margin-top: 0.5rem;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--color-fg-primary);
    line-height: 1;
}

.action-text {
    margin-top: 0.5rem;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--color-primary);
}
</style>
