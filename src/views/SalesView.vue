<script setup lang="ts">
import { computed, ref } from 'vue';
import { db, type InvoiceVersion } from '../db/db';
import { useLiveQuery } from '../composables/useLiveQuery';
import BaseButton from '../components/ui/BaseButton.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { Plus, Search, Calendar, X } from 'lucide-vue-next';

// Data Loading
const invoices = useLiveQuery(() => db.invoices.toArray());
const versions = useLiveQuery(() => db.invoiceVersions.toArray());

// State
const searchQuery = ref('');
const dateStart = ref('');
const dateEnd = ref('');

// Derived Data
const enrichedInvoices = computed(() => {
    if (!invoices.value || !versions.value) return [];
    
    // Create a map of latest versions
    const versionMap = new Map<number, InvoiceVersion>();
    versions.value.forEach(v => versionMap.set(v.id!, v));

    const all = invoices.value?.map(inv => {
        const ver = versions.value?.find(v => v.id === inv.currentVersionId);
        return {
            ...inv,
            sellerName: ver?.sellerDetails?.name || '---',
            buyerName: ver?.buyerDetails?.name || '---',
            totalBags: ver?.items?.reduce((acc, i) => acc + (Number(i.numberOfBags) || 0), 0) || 0,
            versionData: ver,
            status: (inv as any).status || 'final' // v4
        };
    }) || [];

    // Sort by Date Descending, then ID Descending
    return all.sort((a, b) => {
        const d1 = new Date(a.date).getTime();
        const d2 = new Date(b.date).getTime();
        if (d1 !== d2) return d2 - d1;
        return (b.id || 0) - (a.id || 0);
    });
});

// Filtering
const filteredInvoices = computed(() => {
    let result = enrichedInvoices.value;

    // Search
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(inv => 
            inv.invoiceNumber.toLowerCase().includes(q) ||
            inv.sellerName.toLowerCase().includes(q) ||
            inv.buyerName.toLowerCase().includes(q)
        );
    }

    // Date Range
    if (dateStart.value) {
        result = result.filter(inv => inv.date >= new Date(dateStart.value));
    }
    if (dateEnd.value) {
         // Set end date to end of day
        const d = new Date(dateEnd.value);
        d.setHours(23, 59, 59, 999);
        result = result.filter(inv => inv.date <= d);
    }

    return result;
});

const resetFilters = () => {
    searchQuery.value = '';
    dateStart.value = '';
    dateEnd.value = '';
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

    <!-- Controls Section -->
    <div class="controls-section">
        <!-- Search -->
        <div class="search-bar">
            <Search :size="18" class="search-icon"/>
            <input v-model="searchQuery" type="text" placeholder="Search sales #, company, or customer..." class="search-input" />
        </div>

        <!-- Filters -->
        <div class="filters-row">
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
            
            <button v-if="searchQuery || dateStart || dateEnd" class="btn-reset" @click="resetFilters" title="Reset Filters">
                <X :size="16" />
                <span>Reset</span>
            </button>
        </div>
    </div>

    <!-- Cards Grid -->
    <div class="grid">
        <div v-if="!filteredInvoices.length" class="empty-state">
            <template v-if="searchQuery || dateStart || dateEnd">No sales match your filters.</template>
            <template v-else>No sales found. Create your first sale!</template>
        </div>

        <div 
            v-for="inv in filteredInvoices" 
            :key="inv.id" 
            class="card invoice-card"
            @click="$router.push(`/sales/${inv.invoiceNumber}`)"
            style="cursor: pointer;"
        >
            <!-- Header: Number & Date -->
            <div class="card-header">
                <div class="inv-number">{{ inv.invoiceNumber }}</div>
                <div class="status-badge" :class="inv.status === 'draft' ? 'status-draft' : 'status-final'">
                    {{ inv.status === 'draft' ? 'DRAFT' : 'FINAL' }}
                </div>
                <div class="inv-date">{{ new Date(inv.date).toLocaleDateString('en-GB') }}</div>
            </div>

            <!-- Body: Stacked Layout -->
            <div class="card-body">
                <div class="party-stack">
                    <div class="party-row">
                        <span class="p-label">From:</span>
                        <span class="p-name" :title="inv.sellerName">{{ inv.sellerName }}</span>
                    </div>
                    <div class="party-row">
                        <span class="p-label">To:</span>
                        <span class="p-name" :title="inv.buyerName">{{ inv.buyerName }}</span>
                    </div>
                </div>
            </div>

            <!-- Footer: Metrics -->
            <div class="card-footer">
                <div class="badges">
                    <div class="badge-pill">
                        <span class="b-val">{{ inv.totalBags }}</span>
                        <span class="b-unit">Bags</span>
                    </div>
                </div>
                <div class="total-amount">
                    ₹{{ inv.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }}
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; padding-bottom: 4rem; max-width: 1200px; margin: 0 auto; }

/* Controls */
.controls-section { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; background: var(--color-bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--color-border); }

.search-bar { display: flex; align-items: center; gap: 0.75rem; background: var(--color-bg-app); border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; border-radius: 6px; }
.search-icon { color: var(--color-fg-secondary); }
.search-input { background: none; border: none; color: var(--color-fg-primary); flex: 1; font-size: 0.95rem; outline: none; }
.search-input::placeholder { color: var(--color-fg-secondary); opacity: 0.7; }

.filters-row { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; justify-content: space-between; }
.date-filters { display: flex; gap: 1rem; flex: 1; flex-wrap: wrap; }
.filter-group { display: flex; align-items: center; gap: 0.5rem; background: var(--color-bg-app); border: 1px solid var(--color-border); padding: 0.4rem 0.75rem; border-radius: 6px; min-width: 140px; flex: 1; }
.filter-icon { color: var(--color-fg-secondary); }
.filter-label { font-size: 0.8rem; color: var(--color-fg-secondary); white-space: nowrap; }
.filter-date { background: none; border: none; color: var(--color-fg-primary); font-size: 0.9rem; outline: none; width: 100%; cursor: pointer; }

.btn-reset { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; background: var(--color-bg-muted); border: 1px solid var(--color-border); border-radius: 6px; font-size: 0.85rem; color: var(--color-fg-primary); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.btn-reset:hover { background: var(--color-bg-app); border-color: var(--color-primary); color: var(--color-primary); }

/* Grid */
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.empty-state { grid-column: 1 / -1; text-align: center; color: var(--color-fg-secondary); margin-top: 3rem; font-style: italic; }

/* Invoice Card Polished */
.invoice-card { 
    background: var(--color-bg-card); 
    border: 1px solid var(--color-border); 
    border-radius: 8px; 
    padding: 0; 
    overflow: hidden; 
    display: flex; 
    flex-direction: column; 
    transition: all 0.2s ease; 
    position: relative;
    height: 100%;
}
.invoice-card:hover { 
    transform: translateY(-2px); 
    box-shadow: 0 8px 16px rgba(0,0,0,0.1); 
    border-color: var(--color-primary); 
}

/* Header */
.card-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    padding: 0.6rem 1rem; 
    background: rgba(0,0,0,0.02); 
    border-bottom: 1px dashed var(--color-border); 
}

.inv-number { font-weight: 700; color: var(--color-primary); font-family: monospace; font-size: 0.9rem; letter-spacing: 0.5px; opacity: 0.9; }
.inv-date { font-size: 0.75rem; color: var(--color-fg-secondary); font-weight: 500; }

.status-badge {
    font-size: 0.7rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}
.status-draft { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.status-final { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

/* Body - Stacked Layout */
.card-body { padding: 1rem; display: flex; flex-direction: column; flex: 1; justify-content: center; }
.party-stack { display: flex; flex-direction: column; gap: 0.4rem; }
.party-row { display: flex; align-items: baseline; gap: 0.5rem; }

.p-label { font-size: 0.75rem; color: var(--color-fg-secondary); width: 40px; }
.p-name { font-size: 0.95rem; font-weight: 500; color: var(--color-fg-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }


/* Footer */
.card-footer { 
    padding: 0.6rem 1rem; 
    /* border-top: 1px solid var(--color-border); */
    background: rgba(0,0,0,0.02);
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
}

.badges { display: flex; gap: 0.5rem; }
.badge-pill { 
    background: var(--color-bg-app); 
    border: 1px solid var(--color-border); 
    border-radius: 12px; 
    padding: 0.15rem 0.6rem; 
    display: flex; 
    align-items: baseline; 
    gap: 0.2rem; 
    font-size: 0.75rem; 
}
.b-val { font-weight: 700; color: var(--color-fg-primary); }
.b-unit { color: var(--color-fg-secondary); font-size: 0.7rem; text-transform: lowercase; }

.total-amount { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); letter-spacing: -0.5px; }

/* Compact Button from global */
:deep(.btn-compact) { display: flex; align-items: center; gap: 0.5rem; line-height: 1.1; text-align: right; padding: 0.4rem 0.8rem; height: auto; }
:deep(.btn-compact span) { font-size: 0.8rem; font-weight: 600; }

@media (max-width: 640px) {
    .grid { grid-template-columns: 1fr; }
    .filters-row { flex-direction: column; align-items: stretch; gap: 0.75rem; }
    .date-filters { flex-direction: row; gap: 0.5rem; }
    .btn-reset { justify-content: center; width: 100%; }
    .hover-actions { opacity: 1; position: static; margin-left: auto; display: none; } /* Hide print on mobile list for cleanliness, or keep it */
    .card-footer .hover-actions { display: block; position: static; opacity: 1; margin-left: 1rem; }
}
</style>
