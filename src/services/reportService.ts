import { db, type Invoice, type InvoiceVersion, type InvoiceItem } from '../db/db';

export type GroupOption = 'day' | 'week' | 'month' | 'financialYear' | 'invoice' | 'customer' | 'seller' | 'product' | 'producer' | 'alias';
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
    const allInvoices = await db.invoices.toArray();
    const versionIds = allInvoices.map(i => i.currentVersionId).filter(id => id !== undefined) as number[];
    const allVersions = await db.invoiceVersions.bulkGet(versionIds);
    const versionMap = new Map<number, InvoiceVersion>();
    allVersions.forEach(v => v && versionMap.set(v.id!, v));

    let processed: { inv: Invoice; ver: InvoiceVersion; items: InvoiceItem[] }[] = [];

    allInvoices.forEach(inv => {
        const ver = versionMap.get(inv.currentVersionId!);
        if (!ver) return;

        // Date Filter
        const d = new Date(inv.date);
        if (options.filters.dateStart && d < options.filters.dateStart) return;
        if (options.filters.dateEnd) {
            const end = new Date(options.filters.dateEnd);
            end.setHours(23, 59, 59, 999);
            if (d > end) return;
        }

        // Filters
        if (options.filters.customerId?.length && !options.filters.customerId.includes(inv.customerId)) return;
        if (options.filters.sellerId?.length && ver.sellerDetails.id && !options.filters.sellerId.includes(ver.sellerDetails.id)) return;

        let items = ver.items;
        if (options.filters.productId?.length) {
            items = items.filter(i => options.filters.productId!.includes(i.productId));
            if (items.length === 0) return;
        }

        processed.push({ inv, ver, items });
    });

    // 2. Build Aggregation Maps
    const tableMap = new Map<string, ReportRow>();
    const chartSeriesMap = new Map<string, Map<string, number>>();

    // Helper: Keys
    const getKey = (dim: GroupOption, inv: Invoice, ver: InvoiceVersion, item?: InvoiceItem): string => {
        const d = new Date(inv.date);

        if (dim === 'day') return d.toLocaleDateString('en-GB');
        if (dim === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        if (dim === 'financialYear') {
            const month = d.getMonth(); // 0-11
            const year = d.getFullYear();
            const fyStart = month >= 3 ? year : year - 1;
            return `FY ${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
        }
        if (dim === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const mon = new Date(d.setDate(diff));
            return 'Wk ' + mon.toLocaleDateString('en-GB');
        }
        if (dim === 'invoice') return `Inv #${inv.invoiceNumber}`;
        if (dim === 'customer') return ver.buyerDetails.name;
        if (dim === 'seller') return ver.sellerDetails.name;
        if (dim === 'product' && item) return item.name;
        if (dim === 'producer' && item) return item.producerName || 'Unknown';
        if (dim === 'alias' && item) return item.producerAlias || item.producerName || 'Unknown';
        return 'Total';
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
    processed.forEach(({ inv, ver, items }) => {
        const isItemLevelX = options.xAxis === 'product' || options.xAxis === 'producer' || options.xAxis === 'alias';
        const isItemLevelCompare = options.compareBy === 'product' || options.compareBy === 'producer' || options.compareBy === 'alias';

        if (isItemLevelX || isItemLevelCompare) {
            items.forEach(item => {
                const xKey = getKey(options.xAxis, inv, ver, item);
                const compareKey = options.compareBy !== 'none' ? getKey(options.compareBy, inv, ver, item) : 'All';

                const iAmt = item.quantity * item.unitPrice;
                const iTax = (iAmt * item.taxRate) / 100;
                const iTotal = iAmt + iTax;
                const iBags = Number(item.numberOfBags) || 0;
                const iQty = item.quantity;

                if (!tableMap.has(xKey)) {
                    tableMap.set(xKey, {
                        label: xKey,
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
                    // others ignored in compare mode for now

                    if (!chartSeriesMap.has(compareKey)) chartSeriesMap.set(compareKey, new Map());
                    const series = chartSeriesMap.get(compareKey)!;
                    series.set(xKey, (series.get(xKey) || 0) + val);
                }
            });
        } else {
            const xKey = getKey(options.xAxis, inv, ver);
            const compareKey = options.compareBy !== 'none' ? getKey(options.compareBy, inv, ver) : 'All';

            const bags = items.reduce((a, b) => a + (Number(b.numberOfBags) || 0), 0);
            const qty = items.reduce((a, b) => a + b.quantity, 0);

            if (!tableMap.has(xKey)) {
                tableMap.set(xKey, {
                    label: xKey,
                    count: 0, totalAmount: 0, totalTax: 0, taxableValue: 0, totalBags: 0, quantity: 0, ids: []
                });
            }
            addToRow(tableMap.get(xKey)!, inv.grandTotal, ver.totalTax, ver.subTotal, bags, qty, 1);

            if (options.compareBy !== 'none') {
                const metricKey = options.yAxis[0];
                let val = 0;
                if (metricKey === 'totalAmount') val = inv.grandTotal;
                else if (metricKey === 'totalBags') val = bags;
                else if (metricKey === 'quantity') val = qty;

                if (!chartSeriesMap.has(compareKey)) chartSeriesMap.set(compareKey, new Map());
                const series = chartSeriesMap.get(compareKey)!;
                series.set(xKey, (series.get(xKey) || 0) + val);
            }
        }
    });

    // 4. Finalize Data
    let labels = Array.from(tableMap.keys());
    if (options.xAxis === 'day' || options.xAxis === 'month') {
        labels.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }

    const tableData = labels.map(l => tableMap.get(l)!);

    // Chart Data
    const datasets: ChartDataset[] = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    if (options.compareBy !== 'none') {
        let cIdx = 0;
        chartSeriesMap.forEach((dataMap, seriesLabel) => {
            const data = labels.map(l => dataMap.get(l) ?? null);
            datasets.push({
                label: seriesLabel,
                data: data as any, // Cast to any to avoid type complaints if Typescript expects numbers
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
            if (metric === 'count') label = 'Invoices';
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
            // Map data to running total
            ds.data = ds.data.map((val: any) => {
                const currentVal = Number(val) || 0;
                runningTotal += currentVal;
                // If there's no change (currentVal is 0), don't plot a point (return null)
                // UNLESS it's the very first point and it's 0 (optional, but cleaner generally to hide)
                // But wait, if we return null, the running total isn't visualized until the next jump.
                // With stepped: 'after', we need the point BEFORE the jump to stay flat?
                // Actually, if we use null, spanGaps will connect the previous point to next point.
                // If stepped: 'after', it draws flat from Prev -> Next X.
                // So returning null for 0-change days is CORRECT for stepped chart to skip intermediate dots.
                if (currentVal === 0) return null;
                return runningTotal;
            });
            ds.spanGaps = true;
        });
    }

    return { tableData, chartData: { labels, datasets } };
};
