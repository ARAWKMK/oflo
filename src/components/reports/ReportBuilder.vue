<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { db } from '../../db/db';
import { useLiveQuery } from '../../composables/useLiveQuery';
import BaseButton from '../ui/BaseButton.vue';
import MultiSelectDropdown from '../ui/MultiSelectDropdown.vue';
import { Filter, BarChart2, Settings2 } from 'lucide-vue-next';
import type { GroupOption, MetricOption } from '../../services/reportService';

// Data for Filters
const companies = useLiveQuery(() => db.companies.toArray());
const customers = useLiveQuery(() => db.customers.toArray());
const products = useLiveQuery(() => db.products.toArray());

const emit = defineEmits(['generate']);

// State
const datePreset = ref('thisMonth');
const dateStart = ref('');
const dateEnd = ref('');

// Advanced Config
const xAxis = ref<GroupOption>('day');
const yAxis = ref<MetricOption[]>(['totalAmount']);
const compareBy = ref<GroupOption | 'none'>('none');
const chartType = ref('bar');

const selectedSellers = ref<number[]>([]);
const selectedCustomers = ref<number[]>([]);
const selectedProducts = ref<number[]>([]);

// Metrics Options
const metricOptions = [
    { id: 'totalAmount', name: 'Revenue (₹)' },
    { id: 'totalBags', name: 'Bags' },
    { id: 'quantity', name: 'Quantity (Kg)' },
    { id: 'count', name: 'Invoices' },
    { id: 'taxableValue', name: 'Taxable Value' }
];

// Helper: Get YYYY-MM-DD in Local Time
const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Presets Logic
const applyPreset = () => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (datePreset.value === 'today') {
        // start/end = today
    } else if (datePreset.value === 'yesterday') {
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
    } else if (datePreset.value === 'thisWeek') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
        start.setDate(diff);
    } else if (datePreset.value === 'thisMonth') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (datePreset.value === 'lastMonth') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (datePreset.value === 'thisYear') {
        start = new Date(today.getFullYear(), 0, 1);
    } else if (datePreset.value === 'thisFinancialYear') {
        const month = today.getMonth();
        const year = today.getFullYear();
        const startYear = month >= 3 ? year : year - 1;
        start = new Date(startYear, 3, 1); // April 1st
    } else if (datePreset.value === 'lastFinancialYear') {
        const month = today.getMonth();
        const year = today.getFullYear();
        const startYear = month >= 3 ? year - 1 : year - 2;
        start = new Date(startYear, 3, 1); // April 1st
        end = new Date(startYear + 1, 2, 31); // March 31st
    }

    if (datePreset.value !== 'custom') {
        dateStart.value = getLocalDateStr(start);
        dateEnd.value = getLocalDateStr(end);
        emitChange();
    }
};

const emitChange = () => {
    emit('generate', {
        xAxis: xAxis.value,
        yAxis: yAxis.value,
        compareBy: compareBy.value,
        chartType: chartType.value,
        filters: {
            dateStart: dateStart.value ? new Date(dateStart.value) : undefined,
            dateEnd: dateEnd.value ? new Date(dateEnd.value) : undefined,
            sellerId: selectedSellers.value.length ? selectedSellers.value : undefined,
            customerId: selectedCustomers.value.length ? selectedCustomers.value : undefined,
            productId: selectedProducts.value.length ? selectedProducts.value : undefined,
        }
    });
};

// Metric Mapped
const metricOptionsMapped = metricOptions.map((m, i) => ({ id: i, name: m.name, key: m.id }));
const selectedMetricsIdx = ref<number[]>([0]);

watch(selectedMetricsIdx, (newVal) => {
    yAxis.value = newVal.map(i => metricOptionsMapped[i].key as MetricOption);
    emitChange();
});

watch([xAxis, compareBy, chartType, selectedSellers, selectedCustomers, selectedProducts], () => {
    emitChange();
});

// Init
onMounted(() => {
    applyPreset();
});
</script>

<template>
    <div class="builder-container">
        <!-- Section: Chart Configuration -->
        <div class="section-label">
            <Settings2 :size="14" /> CHART CONFIGURATION
        </div>
        <div class="control-row">
             <div class="control-group">
                <label>X-Axis</label>
                <select v-model="xAxis" class="input-select">
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="financialYear">Financial Year</option>
                    <option value="invoice">Invoice</option>
                    <option value="customer">Customer</option>
                    <option value="product">Product</option>
                    <option value="producer">Producer</option>
                    <option value="seller">Company</option>
                    <option value="alias">Alias</option>
                </select>
            </div>

            <div class="control-group">
                <label>Y-Axis (Metrics)</label>
                <MultiSelectDropdown 
                    v-model="selectedMetricsIdx" 
                    :options="metricOptionsMapped" 
                    label="Select Metrics" 
                />
            </div>

            <div class="control-group">
                <label>Compare By</label>
                <select v-model="compareBy" class="input-select">
                    <option value="none">None (Single Series)</option>
                    <option value="customer">Customer</option>
                    <option value="product">Product</option>
                    <option value="producer">Producer</option>
                    <option value="seller">Company</option>
                    <option value="alias">Alias</option>
                </select>
            </div>

             <div class="control-group">
                <label>Chart Type</label>
                <select v-model="chartType" class="input-select">
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="cumulativeLine">Cumulative Line</option>
                    <option value="stackedBar">Stacked Bar</option>
                    <option value="area">Line Area</option>
                    <option value="stackedArea">Stacked Area</option>
                    <option value="pie">Pie</option>
                    <option value="doughnut">Doughnut</option>
                </select>
            </div>
        </div>

        <div class="divider"></div>

        <!-- Section: Data Filters -->
        <div class="section-label">
            <Filter :size="14" /> DATA FILTERS
        </div>
        <div class="control-row">
            <div class="control-group">
                <label>Period</label>
                <select v-model="datePreset" @change="applyPreset" class="input-select">
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="thisWeek">This Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="thisYear">This Year (Civil)</option>
                    <option value="thisFinancialYear">This Financial Year</option>
                    <option value="lastFinancialYear">Last Financial Year</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            
            <div class="control-group dates" v-if="datePreset === 'custom'">
                <input type="date" v-model="dateStart" class="input-date" @change="emitChange">
                <span class="sep">-</span>
                <input type="date" v-model="dateEnd" class="input-date" @change="emitChange">
            </div>

             <div class="control-group">
                <label>Company</label>
                <MultiSelectDropdown 
                    v-model="selectedSellers" 
                    :options="companies || []" 
                    label="All Companies" 
                />
            </div>
             <div class="control-group">
                <label>Customer</label>
                <MultiSelectDropdown 
                    v-model="selectedCustomers" 
                    :options="customers || []" 
                    label="All Customers" 
                />
            </div>
             <div class="control-group">
                <label>Product</label>
                <MultiSelectDropdown 
                    v-model="selectedProducts" 
                    :options="products || []" 
                    label="All Products" 
                />
            </div>
            
            <BaseButton @click="emitChange" class="refresh-btn">
                <BarChart2 :size="16"/>
                Refresh
            </BaseButton>
        </div>
    </div>
</template>

<style scoped>
.builder-container {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
}

.control-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: flex-end;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1;
    min-width: 140px;
}

.control-group.dates {
    flex-direction: row;
    align-items: center;
    flex: 2;
}

.sep { color: var(--color-fg-secondary); }

label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-fg-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.input-select, .input-date {
    background: var(--color-bg-app);
    border: 1px solid var(--color-border);
    color: var(--color-fg-primary);
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.9rem;
    outline: none;
    width: 100%;
}

.refresh-btn {
    height: 38px;
    margin-top: auto;
}

.section-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-fg-secondary);
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    letter-spacing: 0.5px;
}

.divider {
    height: 1px;
    background: var(--color-border);
    margin: 0.2rem 0;
}
</style>
