<script setup lang="ts">
import { computed, ref } from 'vue';
import { db } from '../db/db';
import { useLiveQuery } from '../composables/useLiveQuery';
import BaseButton from '../components/ui/BaseButton.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { Plus, Search, Calendar, X, Filter } from 'lucide-vue-next';

// Data Loading
const sales = useLiveQuery(() => db.sales.toArray());
const versions = useLiveQuery(() => db.salesVersions.toArray());
const companies = useLiveQuery(() => db.companies.toArray());
const customers = useLiveQuery(() => db.customers.toArray());

// State
const searchQuery = ref('');
const dateStart = ref('');
const dateEnd = ref('');
const statusFilter = ref('all');
const selectedCompanyId = ref('all');
const selectedCustomerId = ref('all');

// Derived Data
const enrichedSales = computed(() => {
    if (!sales.value || !versions.value) return [];
    
    const all = sales.value?.map(sale => {
        const ver = versions.value?.find(v => v.id === sale.currentVersionId);
        return {
            ...sale,
            companyId: ver?.sellerDetails?.id, // Get from snapshots
            sellerName: ver?.sellerDetails?.name || '---',
            sellerAlias: ver?.sellerDetails?.alias || '---',
            buyerName: ver?.buyerDetails?.name || '---',
            totalBags: ver?.items?.reduce((acc, i) => acc + (Number(i.numberOfBags) || 0), 0) || 0,
            versionData: ver,
            status: (sale as any).status || 'final'
        };
    }) || [];

    // Sort: Date Descending, then Global Number Descending
    return all.sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        
        // Tie-breaker: Extract numeric suffix from G-format (e.g. :G14)
        const getNum = (s: string) => {
            const match = s.match(/:G(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        };
        return getNum(b.salesNumber) - getNum(a.salesNumber);
    });
});

// Filtering
const filteredSales = computed(() => {
    let result = enrichedSales.value;

    // Search
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(sale => 
            sale.salesNumber.toLowerCase().includes(q) ||
            (sale.globalSalesNo && sale.globalSalesNo.toLowerCase().includes(q)) ||
            sale.sellerName.toLowerCase().includes(q) ||
            sale.buyerName.toLowerCase().includes(q)
        );
    }

    // Date Range
    if (dateStart.value) {
        result = result.filter(sale => new Date(sale.date) >= new Date(dateStart.value));
    }
    if (dateEnd.value) {
        const d = new Date(dateEnd.value);
        d.setHours(23, 59, 59, 999);
        result = result.filter(sale => new Date(sale.date) <= d);
    }
    
    // Status
    if (statusFilter.value !== 'all') {
        result = result.filter(sale => sale.status === statusFilter.value);
    }

    // Company Filter
    if (selectedCompanyId.value !== 'all') {
        result = result.filter(sale => sale.companyId === Number(selectedCompanyId.value));
    }

    // Customer Filter
    if (selectedCustomerId.value !== 'all') {
        result = result.filter(sale => sale.customerId === Number(selectedCustomerId.value));
    }

    return result;
});

const resetFilters = () => {
    searchQuery.value = '';
    dateStart.value = '';
    dateEnd.value = '';
    statusFilter.value = 'all';
    selectedCompanyId.value = 'all';
    selectedCustomerId.value = 'all';
};

const showPicker = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target && target.showPicker) {
        target.showPicker();
    }
};
</script>

<template>
<div class="page-container">
    <PageHeader title="Sales" :showBack="true">
        <template #actions>
            <router-link to="/sales/new">
                <BaseButton class="btn-compact">
                    <span>Add<br>New</span>
                    <Plus :size="20"/>
                </BaseButton>
            </router-link>
        </template>
    </PageHeader>

    <!-- Advanced Filter Bar -->
    <div class="filter-section card">
        <div class="filter-row main-filter">
            <div class="search-box-unified flex-1">
                <Search :size="18" class="search-icon" />
                <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Search Number, Customer, Provider..."
                    class="search-input"
                >
                <X v-if="searchQuery" @click="searchQuery = ''" :size="16" class="clear-icon" />
            </div>

            <!-- Provider Filter -->
            <div class="filter-dropdown comp-filter">
                <select v-model="selectedCompanyId" class="minimal-select">
                    <option value="all">All Providers</option>
                    <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.alias || c.name }}</option>
                </select>
            </div>

            <!-- Customer Filter -->
            <div class="filter-dropdown cust-filter">
                <select v-model="selectedCustomerId" class="minimal-select">
                    <option value="all">All Customers</option>
                    <option v-for="cust in customers" :key="cust.id" :value="cust.id">{{ cust.name }}</option>
                </select>
            </div>
        </div>

        <div class="filter-row secondary-filter">
            <div class="date-filters">
                <div class="filter-group">
                    <Calendar :size="16" class="filter-icon"/>
                    <span class="filter-label">From</span>
                    <input type="date" v-model="dateStart" class="filter-date" @click="showPicker"/>
                </div>
                <div class="filter-group">
                    <Calendar :size="16" class="filter-icon"/>
                    <span class="filter-label">To</span>
                    <input type="date" v-model="dateEnd" class="filter-date" @click="showPicker"/>
                </div>
            </div>

            <div class="status-filter">
                <div class="filter-group">
                    <Filter :size="16" class="filter-icon" />
                    <span class="filter-label">Status</span>
                    <select v-model="statusFilter" class="filter-select">
                        <option value="all">All Sales</option>
                        <option value="final">Final Only</option>
                        <option value="draft">Drafts Only</option>
                    </select>
                </div>
            </div>
            
            <button v-if="searchQuery || dateStart || dateEnd || statusFilter !== 'all'" class="btn-reset" @click="resetFilters" title="Reset Filters">
                <X :size="16" />
                <span>Reset</span>
            </button>
        </div>
    </div>

    <!-- Cards Grid -->
    <div class="grid">
        <div v-if="!filteredSales.length" class="empty-state">
            <template v-if="searchQuery || dateStart || dateEnd">No sales match your filters.</template>
            <template v-else>No sales found. Create your first sale!</template>
        </div>

        <div 
            v-for="sale in filteredSales" 
            :key="sale.id" 
            class="card sale-card"
            @click="$router.push(`/sales/${sale.salesNumber}`)"
            style="cursor: pointer;"
        >
            <!-- Header: Number & Date -->
            <div class="card-header">
                <div class="sale-number">{{ sale.salesNumber || '---' }}</div>
                <div class="status-badge" :class="sale.status === 'draft' ? 'status-draft' : 'status-final'">
                    {{ sale.status === 'draft' ? 'DRAFT' : 'FINAL' }}
                </div>
                <div class="sale-date">{{ new Date(sale.date).toLocaleDateString('en-GB') }}</div>
            </div>

            <!-- Body: Stacked Layout -->
            <div class="card-body">
                <div class="party-stack">
                    <div class="party-row">
                        <span class="p-label">From:</span>
                        <span class="p-name" :title="sale.sellerName">{{ sale.sellerName }}</span>
                    </div>
                    <div class="party-row">
                        <span class="p-label">To:</span>
                        <span class="p-name" :title="sale.buyerName">{{ sale.buyerName }}</span>
                    </div>
                </div>
            </div>

            <!-- Footer: Metrics -->
            <div class="card-footer">
                <div class="badges">
                    <div class="badge-pill">
                        <span class="b-val">{{ sale.totalBags }}</span>
                        <span class="b-unit">Bags</span>
                    </div>
                </div>
                <div class="total-amount">
                    ₹{{ sale.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; padding-bottom: 4rem; max-width: 1200px; margin: 0 auto; }

/* Filter Bar */
.filter-section { 
    padding: 1rem; 
    margin-bottom: 2rem; 
    background: var(--color-bg-card); 
    border: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-radius: 8px;
}

.main-filter { display: flex; gap: 0.75rem; align-items: stretch; width: 100%; }
.secondary-filter { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.flex-1 { flex: 1; min-width: 200px; }

.filter-dropdown { flex: 0 0 200px; position: relative; display: flex; align-items: center; }
.minimal-select {
    width: 100%;
    height: 100%;
    min-height: 40px;
    padding: 0 2rem 0 0.75rem;
    font-size: 0.9rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-app);
    color: var(--color-fg-primary);
    appearance: none;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    transition: all 0.2s;
}
.minimal-select:hover { border-color: var(--color-primary); }

.search-box-unified {
    background: var(--color-bg-app);
    border: 1px solid var(--color-border);
    padding: 0 0.75rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 40px;
}
.search-input { background: none; border: none; color: var(--color-fg-primary); flex: 1; font-size: 0.95rem; outline: none; }
.search-icon { color: var(--color-fg-secondary); }
.clear-icon { color: var(--color-fg-secondary); cursor: pointer; opacity: 0.6; }

.date-filters { display: flex; gap: 1rem; flex: 1; flex-wrap: wrap; }
.filter-group { display: flex; align-items: center; gap: 0.5rem; background: var(--color-bg-app); border: 1px solid var(--color-border); padding: 0.4rem 0.75rem; border-radius: 6px; min-width: 140px; flex: 1; }
.filter-icon { color: var(--color-fg-secondary); }
.filter-label { font-size: 0.8rem; color: var(--color-fg-secondary); white-space: nowrap; margin-right: auto; }
.filter-date { background: none; border: none; color: var(--color-fg-primary); font-size: 0.9rem; outline: none; flex: 1; min-width: 120px; cursor: pointer; text-align: right; }
input::-webkit-calendar-picker-indicator { cursor: pointer; margin-left: 0.5rem; filter: invert(0.5); }

.status-filter { display: flex; gap: 0.5rem; }
.filter-select { background: none; border: none; color: var(--color-fg-primary); font-size: 0.9rem; outline: none; width: 100%; cursor: pointer; appearance: none; }

.btn-reset { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; background: var(--color-bg-muted); border: 1px solid var(--color-border); border-radius: 6px; font-size: 0.85rem; color: var(--color-fg-primary); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.btn-reset:hover { background: var(--color-bg-app); border-color: var(--color-primary); color: var(--color-primary); }

/* Grid */
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.empty-state { grid-column: 1 / -1; text-align: center; color: var(--color-fg-secondary); margin-top: 3rem; font-style: italic; }

/* Sale Card */
.sale-card { 
    background: var(--color-bg-card); 
    border: 1px solid var(--color-border); 
    border-radius: 8px; 
    padding: 0; 
    overflow: hidden; 
    display: flex; 
    flex-direction: column; 
    transition: all 0.2s ease; 
    height: 100%;
}
.sale-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.1); border-color: var(--color-primary); }

.card-header { 
    display: flex; justify-content: space-between; align-items: center; 
    padding: 0.6rem 1rem; 
    background: rgba(0,0,0,0.02); 
    border-bottom: 1px dashed var(--color-border); 
}
.sale-number { font-weight: 700; color: var(--color-primary); font-family: monospace; font-size: 0.9rem; letter-spacing: 0.5px; }
.sale-date { font-size: 0.75rem; color: var(--color-fg-secondary); font-weight: 500; }

.status-badge { font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
.status-draft { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.status-final { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

.card-body { padding: 1rem; display: flex; flex-direction: column; flex: 1; justify-content: center; }
.party-stack { display: flex; flex-direction: column; gap: 0.4rem; }
.party-row { display: flex; align-items: baseline; gap: 0.5rem; }
.p-label { font-size: 0.75rem; color: var(--color-fg-secondary); width: 40px; }
.p-name { font-size: 0.95rem; font-weight: 500; color: var(--color-fg-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

.card-footer { padding: 0.6rem 1rem; background: rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center; }
.badges { display: flex; gap: 0.5rem; }
.badge-pill { background: var(--color-bg-app); border: 1px solid var(--color-border); border-radius: 12px; padding: 0.15rem 0.6rem; display: flex; align-items: baseline; gap: 0.2rem; font-size: 0.75rem; }
.b-val { font-weight: 700; color: var(--color-fg-primary); }
.b-unit { color: var(--color-fg-secondary); font-size: 0.7rem; text-transform: lowercase; }
.total-amount { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); letter-spacing: -0.5px; }

:deep(.btn-compact) { display: flex; align-items: center; gap: 0.5rem; line-height: 1.1; text-align: right; padding: 0.4rem 0.8rem; height: auto; }
:deep(.btn-compact span) { font-size: 0.8rem; font-weight: 600; }

@media (max-width: 850px) {
    .main-filter { flex-direction: column; }
    .filter-dropdown { width: 100%; flex: 0 0 auto; }
    .secondary-filter { flex-direction: column; align-items: stretch; }
    .date-filters { flex-direction: column; width: 100%; }
    .filter-group { min-width: 0; min-height: 48px; }
    .status-filter .filter-group { min-height: 48px; }
}
@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
</style>
