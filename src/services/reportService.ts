import { db, type Sale, type SaleVersion, type SaleItem } from '../db/db';

export type GroupOption = 'day' | 'week' | 'month' | 'financialYear' | 'sale' | 'customer' | 'seller' | 'product' | 'producer' | 'alias';
export type MetricOption = 'totalAmount' | 'totalBags' | 'totalTax' | 'count' | 'quantity' | 'taxableValue';

export interface ReportFilter {
    dateStart?: Date;
    dateEnd?: Date;
    sellerId?: number[];
    customerId?: number[];
    productId?: number[];
}

export interface AdvancedReportOptions {
    xAxis: GroupOption;
    yAxis: MetricOption[]; // Multi-select
    compareBy: GroupOption | 'none';
    filters: ReportFilter;
    chartType?: string; // Optional chart type context
}

// Table Row (Aggregated by X-Axis)
export interface ReportRow {
    label: string;
    // Metrics
    count: number;
    totalAmount: number;
    taxableValue: number;
    totalTax: number;
    totalBags: number;
    quantity: number;
    // Dimension Info
    producerName?: string;
    sortKey: string;
    ids: number[];
}

export interface ChartDataset {
    label: string;
    data: (number | null)[];
    borderColor: string;
    backgroundColor: string;
    yAxisID?: string;
    fill?: boolean | string;
    tension?: number;
    spanGaps?: boolean;
    stepped?: boolean | string;
}

export interface ChartResult {
    labels: string[];
    datasets: ChartDataset[];
}

export const generateAdvancedReport = async (
    options: AdvancedReportOptions
): Promise<{ tableData: ReportRow[]; chartData: ChartResult }> => {
    // 1. Fetch & Filter
    const allSales = await db.sales.toArray();
    const versionIds = allSales.map(i => i.currentVersionId).filter(id => id !== undefined) as number[];
    const allVersions = await db.salesVersions.bulkGet(versionIds);
    const versionMap = new Map<number, SaleVersion>();
    allVersions.forEach(v => v && versionMap.set(v.id!, v));

    let processed: { sale: Sale; ver: SaleVersion; items: SaleItem[] }[] = [];

    allSales.forEach(sale => {
        const ver = versionMap.get(sale.currentVersionId!);
        if (!ver) return;

        // Date Filter
        const d = new Date(sale.date);
        if (options.filters.dateStart && d < options.filters.dateStart) return;
        if (options.filters.dateEnd) {
            const end = new Date(options.filters.dateEnd);
            end.setHours(23, 59, 59, 999);
            if (d > end) return;
        }

        // Filters
        if (options.filters.customerId?.length && !options.filters.customerId.includes(sale.customerId)) return;
        if (options.filters.sellerId?.length && ver.sellerDetails.id && !options.filters.sellerId.includes(ver.sellerDetails.id)) return;

        let items = ver.items;
        if (options.filters.productId?.length) {
            items = items.filter(i => options.filters.productId!.includes(i.productId));
            if (items.length === 0) return;
        }

        processed.push({ sale, ver, items });
    });

    // 2. Build Aggregation Maps
    const tableMap = new Map<string, ReportRow>();
    const chartSeriesMap = new Map<string, Map<string, number>>();

    // Helper: Keys
    const getKeys = (dim: GroupOption, sale: Sale, ver: SaleVersion, item?: SaleItem): { label: string; sort: string } => {
        const d = new Date(sale.date);
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const date = d.getDate().toString().padStart(2, '0');

        if (dim === 'day') return { label: d.toLocaleDateString('en-GB'), sort: `${y}${m}${date}` };
        if (dim === 'month') return { label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), sort: `${y}${m}` };
        if (dim === 'financialYear') {
            const month = d.getMonth(); // 0-11
            const year = d.getFullYear();
            const fyStart = month >= 3 ? year : year - 1;
            return { label: `FY ${fyStart}-${(fyStart + 1).toString().slice(-2)}`, sort: `${fyStart}` };
        }
        if (dim === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const mon = new Date(new Date(sale.date).setDate(diff));
            return { label: 'Wk ' + mon.toLocaleDateString('en-GB'), sort: `${mon.getFullYear()}${(mon.getMonth()+1).toString().padStart(2,'0')}${mon.getDate().toString().padStart(2,'0')}` };
        }
        if (dim === 'sale') return { label: `Sale #${sale.salesNumber}`, sort: sale.salesNumber };
        if (dim === 'customer') return { label: ver.buyerDetails.name, sort: ver.buyerDetails.name };
        if (dim === 'seller') return { label: ver.sellerDetails.name, sort: ver.sellerDetails.name };
        if (dim === 'product' && item) return { label: item.name, sort: item.name };
        if (dim === 'producer' && item) return { label: item.producerName || 'Unknown', sort: item.producerName || 'Unknown' };
        if (dim === 'alias' && item) return { label: item.producerAlias || item.producerName || 'Unknown', sort: item.producerAlias || item.producerName || 'Unknown' };
        return { label: 'Total', sort: '0' };
    };

    // Helper: Add to Row
    const addToRow = (row: ReportRow, amt: number, tax: number, taxVal: number, bags: number, qty: number, count: number) => {
        row.totalAmount += amt;
        row.totalTax += tax;
        row.taxableValue += taxVal;
        row.totalBags += bags;
        row.quantity += qty;
        row.count += count;
    };

    // 3. Iterate
    processed.forEach(({ sale, ver, items }) => {
        const isItemLevelX = options.xAxis === 'product' || options.xAxis === 'producer' || options.xAxis === 'alias';
        const isItemLevelCompare = options.compareBy === 'product' || options.compareBy === 'producer' || options.compareBy === 'alias';

        if (isItemLevelX || isItemLevelCompare) {
            items.forEach(item => {
                const keys = getKeys(options.xAxis, sale, ver, item);
                const xKey = keys.label;
                const compareKey = options.compareBy !== 'none' ? getKeys(options.compareBy, sale, ver, item).label : 'All';

                const iAmt = item.quantity * item.unitPrice;
                const iTax = (iAmt * item.taxRate) / 100;
                const iTotal = iAmt + iTax;
                const iBags = Number(item.numberOfBags) || 0;
                const iQty = item.quantity;

                if (!tableMap.has(xKey)) {
                    tableMap.set(xKey, {
                        label: xKey,
                        sortKey: keys.sort,
                        count: 0, totalAmount: 0, totalTax: 0, taxableValue: 0, totalBags: 0, quantity: 0, ids: []
                    });
                }
                addToRow(tableMap.get(xKey)!, iTotal, iTax, iAmt, iBags, iQty, 1);

                if (options.compareBy !== 'none') {
                    const metricKey = options.yAxis[0];
                    let val = 0;
                    if (metricKey === 'totalAmount') val = iTotal;
                    if (metricKey === 'totalBags') val = iBags;
                    if (metricKey === 'quantity') val = iQty;

                    if (!chartSeriesMap.has(compareKey)) chartSeriesMap.set(compareKey, new Map());
                    const series = chartSeriesMap.get(compareKey)!;
                    series.set(xKey, (series.get(xKey) || 0) + val);
                }
            });
        } else {
            const keys = getKeys(options.xAxis, sale, ver);
            const xKey = keys.label;
            const compareKey = options.compareBy !== 'none' ? getKeys(options.compareBy, sale, ver).label : 'All';

            const bags = items.reduce((a, b) => a + (Number(b.numberOfBags) || 0), 0);
            const qty = items.reduce((a, b) => a + b.quantity, 0);

            if (!tableMap.has(xKey)) {
                tableMap.set(xKey, {
                    label: xKey,
                    sortKey: keys.sort,
                    count: 0, totalAmount: 0, totalTax: 0, taxableValue: 0, totalBags: 0, quantity: 0, ids: []
                });
            }
            addToRow(tableMap.get(xKey)!, sale.grandTotal, ver.totalTax, ver.subTotal, bags, qty, 1);

            if (options.compareBy !== 'none') {
                const metricKey = options.yAxis[0];
                let val = 0;
                if (metricKey === 'totalAmount') val = sale.grandTotal;
                else if (metricKey === 'totalBags') val = bags;
                else if (metricKey === 'quantity') val = qty;

                if (!chartSeriesMap.has(compareKey)) chartSeriesMap.set(compareKey, new Map());
                const series = chartSeriesMap.get(compareKey)!;
                series.set(xKey, (series.get(xKey) || 0) + val);
            }
        }
    });

    // 4. Finalize Data
    let tableRows = Array.from(tableMap.values());
    
    // Sort logic
    tableRows.sort((a, b) => {
        if (options.xAxis === 'day' || options.xAxis === 'month' || options.xAxis === 'week' || options.xAxis === 'financialYear') {
             return a.sortKey.localeCompare(b.sortKey);
        }
        return a.label.localeCompare(b.label);
    });

    const labels = tableRows.map(r => r.label);
    const tableData = tableRows;

    // Chart Data
    const datasets: ChartDataset[] = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    if (options.compareBy !== 'none') {
        let cIdx = 0;
        chartSeriesMap.forEach((dataMap, seriesLabel) => {
            const data = labels.map(l => dataMap.get(l) ?? null);
            datasets.push({
                label: seriesLabel,
                data: data as any,
                borderColor: colors[cIdx % colors.length],
                backgroundColor: colors[cIdx % colors.length],
            });
            cIdx++;
        });
    } else {
        options.yAxis.forEach((metric, idx) => {
            const data = tableData.map(row => row[metric]);
            let label: string = metric;
            if (metric === 'totalAmount') label = 'Revenue';
            if (metric === 'totalBags') label = 'Bags';
            if (metric === 'quantity') label = 'Qty';
            if (metric === 'count') label = 'Sales';
            if (metric === 'taxableValue') label = 'Taxable';

            datasets.push({
                label,
                data,
                borderColor: colors[idx % colors.length],
                backgroundColor: colors[idx % colors.length],
                yAxisID: idx === 0 ? 'y' : 'y1'
            });
        });
    }

    // Cumulative Logic
    if (options.chartType === 'cumulativeLine') {
        datasets.forEach(ds => {
            let runningTotal = 0;
            ds.data = ds.data.map((val: any) => {
                const currentVal = Number(val) || 0;
                runningTotal += currentVal;
                if (currentVal === 0) return null;
                return runningTotal;
            });
            ds.spanGaps = true;
        });
    }

    return { tableData, chartData: { labels, datasets } };
};
