<script setup lang="ts">
import { ref } from 'vue';
import PageHeader from '../components/ui/PageHeader.vue';
import ReportBuilder from '../components/reports/ReportBuilder.vue';
import ReportChart from '../components/reports/ReportChart.vue';
import ReportTable from '../components/reports/ReportTable.vue';
import { generateAdvancedReport, type ReportRow, type ChartResult } from '../services/reportService';
import { LayoutList, PieChart, ShieldAlert } from 'lucide-vue-next';
import StaticSalesSummary from '../components/reports/StaticSalesSummary.vue';
import AccessLock from '../components/auth/AccessLock.vue';

const isLoading = ref(false);
const tableData = ref<ReportRow[]>([]);
const chartData = ref<ChartResult | null>(null);
const chartType = ref<string>('bar');
const activeTab = ref<'dynamic' | 'static' | 'admin'>('dynamic');

// Auth State
const isAuthenticated = ref(false);
const userRole = ref<'viewer' | 'admin'>('viewer');

const handleUnlock = (role: 'viewer' | 'admin') => {
    isAuthenticated.value = true;
    userRole.value = role;
};

const handleGenerate = async (options: any) => {
    isLoading.value = true;
    try {
        chartType.value = options.chartType || 'bar';
        const result = await generateAdvancedReport(options);
        tableData.value = result.tableData;
        chartData.value = result.chartData;
    } catch (e) {
        console.error(e);
    } finally {
        isLoading.value = false;
    }
};
</script>

<template>
    <div v-if="!isAuthenticated">
        <AccessLock @unlock="handleUnlock" />
    </div>

    <div v-else class="page-container">
    <div class="header-row">
        <PageHeader title="Reports" :showBack="true" />
        <div class="view-toggles">
            <button 
                :class="['toggle-btn', { active: activeTab === 'dynamic' }]" 
                @click="activeTab = 'dynamic'"
            >
                <PieChart :size="16" class="icon" /> Dynamic
            </button>
            <button 
                :class="['toggle-btn', { active: activeTab === 'static' }]" 
                @click="activeTab = 'static'"
            >
                <LayoutList :size="16" class="icon" /> Static
            </button>
            <button 
                v-if="userRole === 'admin'"
                :class="['toggle-btn', { active: activeTab === 'admin' }]" 
                @click="activeTab = 'admin'"
            >
                <ShieldAlert :size="16" class="icon" /> Admin
            </button>
        </div>
    </div>
    
    <!-- Dynamic Report Tab -->
    <div v-show="activeTab === 'dynamic'">
        <ReportBuilder @generate="handleGenerate" />

        <div class="report-content">
            <div v-if="isLoading" class="loading">Generating Report...</div>
            
            <div v-else-if="tableData.length === 0" class="empty-state">
                No data found for the selected criteria.
            </div>

            <template v-else>
                <!-- Chart Section -->
                <div class="viz-section">
                    <ReportChart 
                        v-if="chartData"
                        :type="chartType"
                        :data="chartData"
                    />
                </div>
                
                <div class="divider"></div>

                <!-- Table Section -->
                <ReportTable :data="tableData" />
            </template>
        </div>
    </div>

    <!-- Static Report Tab -->
    <div v-show="activeTab === 'static'" class="static-tab">
        <StaticSalesSummary />
    </div>
    
    <!-- Admin Report Tab -->
    <div v-if="userRole === 'admin'" v-show="activeTab === 'admin'" class="static-tab">
        <div class="text-center p-8">
            <ShieldAlert class="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 class="text-xl font-bold mb-2">Admin Reports</h2>
            <p class="text-gray-400">Restricted financial data and audit logs will appear here.</p>
            <p class="text-sm mt-4 text-gray-500">(Feature coming in next update)</p>
        </div>
    </div>
    </div>
</template>

<style scoped>
.page-container { padding: 0 1rem; padding-bottom: 4rem; max-width: 1200px; margin: 0 auto; }

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.view-toggles {
    display: flex;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 2px;
}

.toggle-btn {
    background: none;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-fg-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    transition: all 0.2s;
}

.toggle-btn:hover {
    color: var(--color-fg-primary);
}

.toggle-btn.active {
    background: var(--color-bg-app);
    color: var(--color-primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.icon {
    opacity: 0.8;
}

.static-tab {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    min-height: 400px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.static-controls {
    width: 100%;
    max-width: 400px;
    margin-bottom: 2rem;
}

.static-controls label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-fg-secondary);
}

.static-controls select {
    width: 100%;
    padding: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-app);
    color: var(--color-fg-primary);
    font-size: 1rem;
}

.empty-state {
    color: var(--color-fg-secondary);
    font-style: italic;
    text-align: center;
    padding: 2rem;
}

.viz-area {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    min-height: 400px;
}

.loading, .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: var(--color-fg-secondary);
    font-style: italic;
}
</style>
