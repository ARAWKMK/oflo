<script setup lang="ts">
import BaseSelect from '../components/ui/BaseSelect.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import { ref } from 'vue';

const reportType = ref('sales');
const reportOptions = [
    { value: 'sales', label: 'Sales Report' },
    { value: 'tax', label: 'Tax Summary' },
    { value: 'customer', label: 'Customer Performance' }
];

</script>

<template>
<div class="page-container">
    <PageHeader title="Reports" :showBack="true" />

    <div class="card filter-card">
        <div class="filter-row">
            <BaseSelect label="Report Type" v-model="reportType" :options="reportOptions" />
            <!-- Date Range Placeholder -->
        </div>
    </div>

    <div class="empty-state">
        <div class="chart-placeholder">
            <p>Chart Visualization Area</p>
            <small>Select a report type to view data</small>
        </div>
    </div>
</div>
</template>

<style scoped>
.page-container { padding: 0 1rem; }
.header { margin-bottom: 2rem; }
.header h2 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; }
.icon { color: var(--color-fg-primary); }

.filter-card { margin-bottom: 2rem; }
.filter-row { display: flex; gap: 1rem; max-width: 300px; }

.empty-state { display: flex; justify-content: center; align-items: center; min-height: 300px; border: 2px dashed var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-muted); opacity: 0.5; }
.chart-placeholder { text-align: center; color: var(--color-fg-secondary); }
</style>
