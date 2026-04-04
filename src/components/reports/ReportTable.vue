<template>
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th @click="sort('label')">Group <arrow-up-down :size="12"/></th>
                    <th @click="sort('count')" class="text-right">Sales</th>
                    <th v-if="hasProducer" class="text-left">Producer</th>
                    <th @click="sort('quantity')" class="text-right">Qty (Kg)</th>
                    <th @click="sort('totalBags')" class="text-right">Bags</th>
                    <th @click="sort('taxableValue')" class="text-right">Taxable</th>
                    <th @click="sort('totalTax')" class="text-right">Tax</th>
                    <th @click="sort('totalAmount')" class="text-right">Grand Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(row, idx) in sortedData" :key="idx">
                    <td class="font-medium">{{ row.label }}</td>
                    <td class="text-right">{{ row.count }}</td>
                    <td v-if="hasProducer" class="text-left">{{ row.producerName || '-' }}</td>
                    <td class="text-right">{{ formatNum(row.quantity) }}</td>
                    <td class="text-right">{{ formatNum(row.totalBags) }}</td>
                    <td class="text-right">₹{{ formatCurrency(row.taxableValue) }}</td>
                    <td class="text-right">₹{{ formatCurrency(row.totalTax) }}</td>
                    <td class="text-right font-bold">₹{{ formatCurrency(row.totalAmount) }}</td>
                </tr>
                <!-- Total Row -->
                <tr class="total-row">
                    <td>Total</td>
                    <td class="text-right">{{ totalCount }}</td>
                    <td v-if="hasProducer"></td>
                    <td class="text-right">{{ formatNum(totalQty) }}</td>
                    <td class="text-right">{{ formatNum(totalBags) }}</td>
                    <td class="text-right">₹{{ formatCurrency(totalTaxable) }}</td>
                    <td class="text-right">₹{{ formatCurrency(totalTax) }}</td>
                    <td class="text-right">₹{{ formatCurrency(totalRevenue) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpDown } from 'lucide-vue-next';
import type { ReportRow } from '../../services/reportService';

const props = defineProps<{
    data: ReportRow[];
}>();

const sortKey = ref<keyof ReportRow>('totalAmount');
const sortAsc = ref(false);

const sort = (key: keyof ReportRow) => {
    if (sortKey.value === key) {
        sortAsc.value = !sortAsc.value;
    } else {
        sortKey.value = key;
        sortAsc.value = false; // Default desc for numbers
    }
};

const hasProducer = computed(() => {
    return props.data.some(r => r.producerName);
});

const sortedData = computed(() => {
    return [...props.data].sort((a, b) => {
        const valA = a[sortKey.value] || 0;
        const valB = b[sortKey.value] || 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortAsc.value ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc.value ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
});

const totalRevenue = computed(() => props.data.reduce((a, b) => a + b.totalAmount, 0));
const totalBags = computed(() => props.data.reduce((a, b) => a + b.totalBags, 0));
const totalTax = computed(() => props.data.reduce((a, b) => a + b.totalTax, 0));
const totalTaxable = computed(() => props.data.reduce((a, b) => a + b.taxableValue, 0));
const totalQty = computed(() => props.data.reduce((a, b) => a + b.quantity, 0));
const totalCount = computed(() => props.data.reduce((a, b) => a + b.count, 0));

const formatCurrency = (val: number) => val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNum = (val: number) => val.toLocaleString('en-IN');
</script>

<style scoped>
.table-container {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
}

th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-fg-primary);
}

th {
    background: var(--color-bg-muted);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    color: var(--color-fg-secondary);
}

th:hover {
    color: var(--color-fg-primary);
}

.text-right { text-align: right; }
.text-left { text-align: left; }
.font-bold { font-weight: 700; }
.font-medium { font-weight: 500; }

.total-row {
    background: var(--color-bg-muted);
    font-weight: 700;
}
</style>
