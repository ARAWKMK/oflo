<script setup lang="ts">
import { ref, computed } from 'vue';
import { type GroupOption } from '../../services/reportService';
import BaseButton from '../ui/BaseButton.vue';
import ReportTable from './ReportTable.vue';
import { generateAdvancedReport, type ReportRow } from '../../services/reportService';
import { BarChart2 } from 'lucide-vue-next';

// --- OPTIONS ---
const groupByOptions = [
    { value: 'seller', label: 'Company' },
    { value: 'customer', label: 'Customer' },
    { value: 'product', label: 'Product' },
    { value: 'producer', label: 'Producer' }
];

const timeframeOptions = [
    { value: 'thisMonth', label: 'This Month' },
    { value: 'specificMonthFY', label: 'Specific Month (Current FY)' },
    { value: 'thisFY', label: 'This Financial Year' },
    { value: 'prevFY', label: 'Previous Financial Year' }
];

// --- STATE ---
const selectedGroupBy = ref<GroupOption>('seller');
const selectedTimeframe = ref('thisFY');

// Secondary Selectors
const selectedMonthIndex = ref(0); // 0=Apr, 1=May... 11=Mar
const selectedPrevFYOffset = ref(1); // 1 = Last FY, 2 = FY before that...

// Data
const isLoading = ref(false);
const tableData = ref<ReportRow[]>([]);

// --- HELPERS ---
const months = [
    'April', 'May', 'June', 'July', 'August', 'September', 
    'October', 'November', 'December', 'January', 'February', 'March'
];

// Helper to get FY Years
const getFYLabel = (offset: number) => {
    const today = new Date();
    let currentFYStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const start = currentFYStart - offset;
    return `FY ${start}-${start + 1}`;
};

const prevFYOptions = computed(() => {
    return [
        { value: 1, label: getFYLabel(1) },
        { value: 2, label: getFYLabel(2) },
        { value: 3, label: getFYLabel(3) }
    ];
});

// --- GENERATE ---
const handleGenerate = async () => {
    isLoading.value = true;
    try {
        const today = new Date();
        let start = new Date();
        let end = new Date();
        
        // --- DATE LOGIC ---
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11
        const currentFYStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

        if (selectedTimeframe.value === 'thisMonth') {
            start = new Date(currentYear, currentMonth, 1);
            end = new Date(currentYear, currentMonth + 1, 0); // Last day
        } else if (selectedTimeframe.value === 'specificMonthFY') {
            // Month index is 0=April .. 11=March
            // If index <= 8 (Apr-Dec), Year = FYStart
            // If index >= 9 (Jan-Mar), Year = FYStart + 1
            // Real month index:
            // 0(Apr) -> 3 (Apr in JS Date)
            // 8(Dec) -> 11(Dec)
            // 9(Jan) -> 0(Jan next year)
            
            let targetMonth = selectedMonthIndex.value + 3; // Shift Apr(0) to 3
            let targetYear = currentFYStartYear;
            if (targetMonth > 11) {
                targetMonth -= 12;
                targetYear += 1;
            }
            start = new Date(targetYear, targetMonth, 1);
            end = new Date(targetYear, targetMonth + 1, 0);
        } else if (selectedTimeframe.value === 'thisFY') {
            start = new Date(currentFYStartYear, 3, 1); // Apr 1
            end = new Date(currentFYStartYear + 1, 2, 31); // Mar 31
        } else if (selectedTimeframe.value === 'prevFY') {
            const offset = selectedPrevFYOffset.value;
            const targetStartYear = currentFYStartYear - offset;
            start = new Date(targetStartYear, 3, 1);
            end = new Date(targetStartYear + 1, 2, 31);
        }

        // Call Service
        // We set xAxis to the Group By option to group by that entity
        // We pass ALL key metrics to ensure table shows everything
        const result = await generateAdvancedReport({
            xAxis: selectedGroupBy.value,
            yAxis: ['totalAmount', 'totalBags', 'quantity', 'taxableValue'],
            compareBy: 'none',
            filters: {
                dateStart: start,
                dateEnd: end
            },
            chartType: 'bar' // Unused
        });

        tableData.value = result.tableData;

    } catch (e) {
        console.error(e);
    } finally {
        isLoading.value = false;
    }
};
</script>

<template>
    <div class="static-builder">
        <!-- Controls -->
        <div class="control-row">
            <div class="control-group">
                <label>Group By</label>
                <select v-model="selectedGroupBy" class="input-select">
                    <option v-for="opt in groupByOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                    </option>
                </select>
            </div>

            <div class="control-group">
                <label>Timeframe</label>
                <select v-model="selectedTimeframe" class="input-select">
                    <option v-for="opt in timeframeOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                    </option>
                </select>
            </div>

            <!-- Conditional: Specific Month -->
            <div class="control-group" v-if="selectedTimeframe === 'specificMonthFY'">
                <label>Select Month</label>
                <select v-model="selectedMonthIndex" class="input-select">
                    <option v-for="(m, i) in months" :key="i" :value="i">
                        {{ m }}
                    </option>
                </select>
            </div>

            <!-- Conditional: Previous FY -->
            <div class="control-group" v-if="selectedTimeframe === 'prevFY'">
                <label>Select Year</label>
                <select v-model="selectedPrevFYOffset" class="input-select">
                    <option v-for="opt in prevFYOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                    </option>
                </select>
            </div>

            <BaseButton @click="handleGenerate" class="generate-btn">
                <BarChart2 :size="16" /> Generate
            </BaseButton>
        </div>

        <div class="report-results">
            <div v-if="isLoading" class="loading">Generating...</div>
            <ReportTable v-else-if="tableData.length" :data="tableData" />
            <div v-else class="empty-state">Click Generate to view report.</div>
        </div>
    </div>
</template>

<style scoped>
.static-builder {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
}

.control-row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;
    background: var(--color-bg-card);
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 160px;
    flex: 1;
}

label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-fg-secondary);
    text-transform: uppercase;
}

.input-select {
    padding: 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-app);
    color: var(--color-fg-primary);
    width: 100%;
}

.generate-btn {
    height: 38px;
}

.report-results {
    min-height: 200px;
}
.loading, .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--color-fg-secondary);
}
</style>
