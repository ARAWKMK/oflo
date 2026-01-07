<script setup lang="ts">
import { computed } from 'vue';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps<{
    type: string;
    data: any;
}>();

const chartConfig = computed(() => {
    let cType = 'bar';
    let stacked = false;
    let fill = false;

    if (props.type === 'line' || props.type === 'area' || props.type === 'stackedArea' || props.type === 'cumulativeLine') cType = 'line';
    if (props.type === 'pie') cType = 'pie';
    if (props.type === 'doughnut') cType = 'doughnut';
    if (props.type === 'bar' || props.type === 'stackedBar') cType = 'bar';
    
    if (props.type === 'stackedBar' || props.type === 'stackedArea') stacked = true;
    if (props.type === 'area' || props.type === 'stackedArea') fill = true;

    // Clone data to avoid mutating prop
    const finalData = { ...props.data };
    if (finalData.datasets) {
        finalData.datasets = finalData.datasets.map((ds: any) => ({
            ...ds,
            fill: fill ? 'origin' : false,
            tension: 0.3,
            spanGaps: true
        }));
    }

    return { type: cType, data: finalData, stacked };
});

const chartOptions = computed(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const colorGrid = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const colorText = isDark ? '#9ca3af' : '#4b5563';

    const { type, stacked } = chartConfig.value;

    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: colorText } },
            title: { display: false }
        },
        scales: (type === 'pie' || type === 'doughnut') ? {} : {
            x: {
                grid: { color: colorGrid },
                ticks: { color: colorText },
                stacked: stacked
            },
            y: {
                grid: { color: colorGrid },
                ticks: { color: colorText },
                beginAtZero: true,
                stacked: stacked
            }
        }
    };
});
</script>

<template>
    <div class="chart-container">
        <Bar v-if="chartConfig.type === 'bar'" :data="chartConfig.data" :options="chartOptions" />
        <Line v-else-if="chartConfig.type === 'line'" :data="chartConfig.data" :options="chartOptions" />
        <Doughnut v-else-if="chartConfig.type === 'doughnut'" :data="chartConfig.data" :options="chartOptions" />
        <Pie v-else-if="chartConfig.type === 'pie'" :data="chartConfig.data" :options="chartOptions" />
    </div>
</template>

<style scoped>
.chart-container {
    position: relative;
    height: 100%;
    width: 100%;
    min-height: 300px;
}
</style>
