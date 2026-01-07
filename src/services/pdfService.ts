import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from '../utils/formatters';
import { db } from '../db/db';

const getPDFSettings = async () => {
    const saved = await db.settings.toArray();
    const settings: any = {};
    saved.forEach(s => settings[s.key] = s.value);

    // Fetch custom fonts
    const fonts = await db.fonts.toArray();

    const getNum = (val: any, def: number) => {
        if (val === undefined || val === null || val === '') return def;
        const n = Number(val);
        return isNaN(n) ? def : n;
    };

    return {
        company: getNum(settings.pdfFontSizeCompany, 26),
        header: getNum(settings.pdfFontSizeHeader, 10),
        contentHeader: getNum(settings.pdfFontSizeContentHeader, 10),
        regular: getNum(settings.pdfFontSizeRegular, 9),
        marginLeft: getNum(settings.pdfMarginLeft, 14),
        marginRight: getNum(settings.pdfMarginRight, 14),
        marginTop: getNum(settings.pdfMarginTop, 15),
        marginBottom: getNum(settings.pdfMarginBottom, 15),
        fontCompany: settings.pdfFontCompany || 'helvetica',
        fontCompanyBold: settings.pdfFontCompanyBold === true,
        fontCompanyItalic: settings.pdfFontCompanyItalic === true,
        fontBody: settings.pdfFontBody || 'helvetica',
        customFonts: fonts || [],
        pageSizeInvoice: settings.pdfPageSizeInvoice || 'a4',
        pageSizeChallan: settings.pdfPageSizeChallan || 'a4',
        quality: settings.pdfQuality || 'standard'
    };
};

const getPageFormat = (size: string) => {
    switch (size.toLowerCase()) {
        case 'executive': return [184.15, 266.7]; // Executive (7.25 x 10.5 in)
        case 'b5': return 'b5'; // ISO B5 (176 x 250 mm)
        case 'letter': return 'letter'; // US Letter
        default: return 'a4';
    }
};

export const generateInvoicePDF = (data: any, settings: any) => {
    const doc = new jsPDF({
        format: getPageFormat(settings.pageSizeInvoice),
        unit: 'mm',
        compress: settings.quality === 'standard'
    });

    // --- LOAD CUSTOM FONTS ---
    if (settings.customFonts && settings.customFonts.length > 0) {
        settings.customFonts.forEach((font: any) => {
            try {
                const filename = `${font.name}.ttf`;
                doc.addFileToVFS(filename, font.data);
                doc.addFont(filename, font.name, 'normal');
                doc.addFont(filename, font.name, 'bold');
                doc.addFont(filename, font.name, 'italic');
            } catch (e) {
                console.error('Failed to load font:', font.name, e);
            }
        });
    }

    const setFont = (type: 'company' | 'body', style: 'normal' | 'bold' | 'italic') => {
        const fontName = type === 'company' ? settings.fontCompany : settings.fontBody;
        doc.setFont(fontName, style);
    };

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const marginLeft = settings.marginLeft;
    const marginRight = settings.marginRight;
    const marginTop = settings.marginTop;
    const contentWidth = pageWidth - (marginLeft + marginRight);
    const ptToMm = 0.352778;
    const standardLineWidth = 0.3;

    // --- FOOTER PRE-CALCULATION (V3) ---
    const leftBoxWidth = (contentWidth * 0.55) - 2;
    const rightBoxWidth = (contentWidth * 0.45) - 2;
    const footerPad = 1; // Tight padding

    // 1. Words Box Height (Full Width V42)
    const wordsStr = numberToWords(data.grandTotal || 0);
    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    // Calculate using full contentWidth minus padding
    const wLines = doc.splitTextToSize(wordsStr, contentWidth - 30);
    const wLineH = settings.regular * ptToMm;
    const wTextHeight = wLines.length * wLineH * 1.3; // Tight 1.3
    // Tighten: Remove bottom padding (Keep top footerPad)
    const wordsBoxH = Math.max(10, wTextHeight + footerPad);



    // 3. Bank/Totals Height (Dynamic Max)
    // Bank Calc
    let bankCursor = 0;
    const bankHeaderH = settings.header * ptToMm;
    bankCursor += footerPad + bankHeaderH + 2;
    if (data.sellerDetails.bankName) {
        const h = settings.regular * ptToMm;
        // Bank now has: Name, A/c, IFSC (3 lines)
        bankCursor += (h * 1.3) * 3;
    }
    const bankContentH = bankCursor;

    // Totals Calc
    let totalCursor = 0;
    totalCursor += footerPad + 2; // Top pad + gap
    // Subtotal
    totalCursor += (settings.regular * ptToMm * 1.3) + 1;
    // Tax
    const taxAmtLit = parseFloat(data.totalTax);
    const taxTypeLit = (data.taxType || '').toUpperCase();
    const isInterStateLit = taxTypeLit === 'IGST';
    if (taxAmtLit > 0) {
        if (isInterStateLit) totalCursor += (settings.regular * ptToMm * 1.3) + 1;
        else totalCursor += ((settings.regular * ptToMm * 1.3) + 1) * 2;
    } else {
        totalCursor += (settings.regular * ptToMm * 1.3) + 1;
    }
    // Grand Total (V42: Added to Totals Box)
    // Add gap ? 2mm then GT Line
    totalCursor += 2;
    totalCursor += (settings.header * ptToMm * 1.3); // Grand Total uses Header Font equivalent height

    const totalContentH = totalCursor;

    const boxHeightLocal = Math.max(bankContentH, totalContentH);

    // Total Footer Height (V43 Layout Stack)
    // [Row 1: Bank/Totals (boxHeightLocal)]
    // [Gap 2]
    // [Row 2: Words (wordsBoxH)]
    // [Gap 8] (User Requested 8mm)
    // [Row 3: Terms (termsBoxH)]
    // Anchor to Bottom 5mm (Red Zone Logic)
    // const footerEndY = pageHeight - settings.marginBottom;



    // --- DRAWING ---
    let currentY = marginTop;

    // Header
    const headerH = settings.header * ptToMm;
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, currentY + headerH, { align: 'center' });
    currentY += headerH + 2; // V45: Gap reduced to 2mm

    // Company
    const companyH = settings.company * ptToMm;
    doc.setFontSize(settings.company);
    let companyStyle = 'normal';
    if (settings.fontCompanyBold && settings.fontCompanyItalic) companyStyle = 'bolditalic';
    else if (settings.fontCompanyBold) companyStyle = 'bold';
    else if (settings.fontCompanyItalic) companyStyle = 'italic';
    setFont('company', companyStyle as any);
    doc.text(data.sellerDetails.name || 'Company Name', pageWidth / 2, currentY + companyH, { align: 'center' });

    currentY += companyH + 2; // V45: Gap reduced to 2mm

    // Tagline
    if (data.sellerDetails.tagline) {
        const taglineH = settings.contentHeader * ptToMm;
        doc.setFontSize(settings.contentHeader);
        setFont('company', 'italic');
        doc.text(data.sellerDetails.tagline, pageWidth / 2, currentY + taglineH, { align: 'center' });
        currentY += taglineH + 1; // Set gap to 1mm
    } else {
        currentY += 1;
    }
    // Gap to Address Box
    currentY += 0;

    // Box 1 (Seller)
    const box1Start = currentY;
    const boxPad = 3; // Match Bank Details (3mm)
    const leftX = marginLeft + boxPad;
    const box1LeftLabelW = 22;
    const box1RightLabelW = 25;
    const addrWidth = contentWidth - (box1LeftLabelW + 3) - 5;
    const lineHeight = settings.regular * ptToMm * 1.3; // Tight 1.3
    let line1Y = box1Start + boxPad + (settings.regular * ptToMm);

    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    doc.text('ADDRESS', leftX, line1Y);
    doc.text(':', leftX + box1LeftLabelW, line1Y);
    const contentX = leftX + box1LeftLabelW + 3;

    const msgAddress = data.sellerDetails.address || '';
    const addrLines = doc.splitTextToSize(msgAddress, addrWidth);
    if (addrLines.length > 0) doc.text(addrLines[0], contentX, line1Y);
    let leftCursorY = line1Y;
    for (let i = 1; i < addrLines.length; i++) {
        leftCursorY += lineHeight;
        doc.text(addrLines[i], contentX, leftCursorY);
    }

    leftCursorY += lineHeight;
    let rightCursorY = leftCursorY;

    doc.text('GST No.', leftX, leftCursorY);
    doc.text(':', leftX + box1LeftLabelW, leftCursorY);
    doc.text(data.sellerDetails.gstin || '-', contentX, leftCursorY);
    leftCursorY += lineHeight;

    doc.text('Email', leftX, leftCursorY);
    doc.text(':', leftX + box1LeftLabelW, leftCursorY);
    doc.text(data.sellerDetails.email || '-', contentX, leftCursorY);

    if (data.sellerDetails.phone) {
        leftCursorY += lineHeight;
        doc.text('Phone', leftX, leftCursorY);
        doc.text(':', leftX + box1LeftLabelW, leftCursorY);
        doc.text(data.sellerDetails.phone, contentX, leftCursorY);
    }
    leftCursorY += lineHeight; // Fix: Ensure left cursor reflects full height

    // Meta Data
    const splitRatio = 0.6;
    const splitX = marginLeft + (contentWidth * splitRatio);
    const metaX = splitX;
    const drawMeta = (lbl: string, val: string) => {
        doc.text(lbl, metaX, rightCursorY);
        doc.text(':', metaX + box1RightLabelW, rightCursorY);
        const valX = metaX + box1RightLabelW + 3;
        const maxValW = (marginLeft + contentWidth) - valX - 2;
        const valLines = doc.splitTextToSize(val, maxValW);
        doc.text(valLines, valX, rightCursorY);
        rightCursorY += lineHeight * valLines.length;
    };

    const invNo = data.invoiceNumber || data.invoice_number || '-';
    drawMeta('Invoice No', invNo);
    drawMeta('Date', data.date ? new Date(data.date).toLocaleDateString('en-GB') : '-');
    if (data.vehicleNumber) drawMeta('Vehicle No', data.vehicleNumber);

    // Box 1 Height
    const contentMaxY = Math.max(leftCursorY, rightCursorY);
    // Tighten: Remove padding entirely (User Request)
    const tightMaxY = contentMaxY - (settings.regular * ptToMm * 0.6);
    const box1Height = (tightMaxY - box1Start); // No extra padding

    doc.setLineWidth(standardLineWidth);
    doc.roundedRect(marginLeft, box1Start, contentWidth, box1Height, 3, 3, 'S');
    currentY = box1Start + box1Height + 8; // Top Gap: 8mm (Standardized)

    // Box 2 (Client)
    const box2Start = currentY;
    let box2Y = box2Start + boxPad + (settings.regular * ptToMm);

    // Dynamic Column Width Calculation for Client Section
    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    // Calculate Max Width for Labels (Client, GST, Delivery)
    const clientLabelW = Math.max(
        doc.getTextWidth('Client Address'),
        doc.getTextWidth('Client GST'),
        doc.getTextWidth('Delivery Address')
    ) + 2; // +2mm buffer

    const box2LabelW = clientLabelW;
    const clientX = leftX + box2LabelW + 3;

    doc.text('Client Address', leftX, box2Y);
    doc.text(':', leftX + box2LabelW, box2Y);
    const cStr = `${data.buyerDetails.name || ''}, ${data.buyerDetails.address || ''}`;
    const cLines = doc.splitTextToSize(cStr, contentWidth - box2LabelW - 15);
    if (cLines.length > 0) {
        doc.text(cLines[0], clientX, box2Y);
        for (let i = 1; i < cLines.length; i++) {
            box2Y += lineHeight;
            doc.text(cLines[i], clientX, box2Y);
        }
    }
    box2Y += lineHeight;

    doc.text('Client GST', leftX, box2Y);
    doc.text(':', leftX + box2LabelW, box2Y);
    doc.text(data.buyerDetails.gstin || '-', clientX, box2Y);
    box2Y += lineHeight;

    if (data.buyerDetails.deliveryAddress) {
        doc.text('Delivery Address', leftX, box2Y);
        doc.text(':', leftX + box2LabelW, box2Y);
        const dStr = data.buyerDetails.deliveryAddress;
        const dLines = doc.splitTextToSize(dStr, contentWidth - box2LabelW - 15);
        if (dLines.length > 0) {
            doc.text(dLines[0], clientX, box2Y);
            for (let i = 1; i < dLines.length; i++) {
                box2Y += lineHeight;
                doc.text(dLines[i], clientX, box2Y);
            }
        }
        box2Y += lineHeight;
    }

    // Tighten Box 2 similarly
    const tightBox2Y = box2Y - (settings.regular * ptToMm * 0.6);
    const box2H = (tightBox2Y - box2Start); // No extra padding
    doc.roundedRect(marginLeft, box2Start, contentWidth, box2H, 3, 3, 'S');
    currentY = box2Start + box2H + 2; // Matched to Footer Gap (2mm)

    // --- TABLE PREP ---
    let tableBody = [];
    if (data.summaryItem) {
        const s = data.summaryItem;
        const weight = s.numberOfBags > 0 ? (s.quantity / s.numberOfBags) : 0;
        const bagLine = s.numberOfBags > 0
            ? `${s.numberOfBags} Bags of ${parseFloat(weight.toFixed(2))} Kg`
            : '';
        tableBody = [[
            1, `${s.description}\n${bagLine}`, s.hsn, s.numberOfBags,
            Number(s.quantity).toLocaleString('en-IN'),
            Number(s.unitPrice).toFixed(1),
            Number(s.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ]];
    } else {
        tableBody = data.items.map((item: any, index: number) => {
            const descText = item.description || item.name;
            const bagsLine = `${item.numberOfBags || '-'} Bags of 25 Kg`;
            const fullDesc = `${descText}\n${bagsLine}`;
            return [
                index + 1, fullDesc, item.hsn || '', item.numberOfBags || '-',
                Number(item.quantity).toLocaleString('en-IN'),
                Number(item.unitPrice).toFixed(1),
                (item.quantity * item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
        });
    }

    // --- TABLE ---
    const bodyFont = settings.fontBody;

    // Hardcode Description (User Request v49)
    // First line always 'PLASTIC REPROCESS GRANULES'
    if (tableBody.length > 0) {
        tableBody.forEach((row: any) => {
            // row[1] is Description
            const parts = row[1].toString().split('\n');
            // Keep the second line (Bags info) if it exists
            const bagsLine = parts.length > 1 ? parts[1] : '';
            row[1] = `PLASTIC REPROCESS GRANULES\n${bagsLine}`;
        });
    }

    // --- MANUAL COLUMN WIDTH CALCULATION (V26) ---
    doc.setFontSize(settings.regular - 1); // Use body font size for calc
    const paddingBuffer = 5; // Fixed buffer (5mm)

    const getColWidth = (headerVal: string, colIndex: number) => {
        // Handle multi-line headers: measure longest line
        const lines = headerVal.split('\n');
        let maxW = 0;
        lines.forEach(line => {
            const w = doc.getTextWidth(line);
            if (w > maxW) maxW = w;
        });
        maxW += 1; // Header buffer

        // Check all rows for this column
        tableBody.forEach((row: any) => {
            const val = String(row[colIndex]);
            const w = doc.getTextWidth(val);
            if (w > maxW) maxW = w;
        });
        return maxW + paddingBuffer;
    };

    // Calculate widths for numeric columns
    const colWidths = {
        0: getColWidth('#', 0),
        2: getColWidth('H.S.N.\nCode', 2),
        3: getColWidth('No. of\nBags', 3),
        4: getColWidth('Qty\n(in Kg)', 4),
        5: getColWidth('Price\nper Kg', 5),
        6: getColWidth('Taxable\n(in Rs.)', 6)
    };

    autoTable(doc, {
        startY: currentY,
        head: [['#', 'Description', 'H.S.N.\nCode', 'No. of\nBags', 'Qty\n(in Kg)', 'Price\nper Kg', 'Taxable\n(in Rs.)']], // Shortened Header
        body: tableBody,
        theme: 'plain',
        styles: {
            fontSize: settings.regular - 1,
            lineColor: [0, 0, 0],
            lineWidth: 0,
            textColor: [0, 0, 0],
            valign: 'middle',
            font: bodyFont,
            cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: bodyFont,
            fontSize: settings.regular - 1.5,
            lineWidth: standardLineWidth,
            lineColor: [0, 0, 0],
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: colWidths[0], halign: 'center' },
            1: { cellWidth: 'auto', halign: 'center' },
            2: { cellWidth: colWidths[2], halign: 'center' },
            3: { cellWidth: colWidths[3], halign: 'center' },
            4: { cellWidth: colWidths[4], halign: 'center' },
            5: { cellWidth: colWidths[5], halign: 'center' },
            6: { cellWidth: colWidths[6], halign: 'right', cellPadding: { top: 2, bottom: 2, left: 0, right: 2 } }
        },
        didParseCell: (data) => {
            if (data.column.index === 6) {
                if (data.section === 'head') {
                    data.cell.styles.halign = 'right';
                    data.cell.styles.cellPadding = { top: 2, bottom: 2, left: 0, right: 2 };
                }
            }
        },
        didDrawCell: (data) => {
            if (data.section === 'body') {
                doc.setDrawColor(0);
                doc.setLineWidth(standardLineWidth);
                doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
                if (data.column.index === 6) {
                    doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                }
            }
        },
        margin: { left: marginLeft, right: marginRight }
    });

    const lastTable = (doc as any).lastAutoTable;
    const tableFinalY = lastTable.finalY;

    // Determine where the table box should end
    let tableBottomY = tableFinalY;
    // --- V49 Height Recalculation (Strict 60/40) ---
    const rawTerms_recalc = data.sellerDetails.terms || "1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.";
    const termsW_recalc = contentWidth * 0.6;
    const termsTextMaxW_recalc = termsW_recalc - 6;
    let tOps_recalc: { text: string; isBold: boolean }[] = [];

    rawTerms_recalc.split('\n').forEach((p: string) => {
        let lineText = p.trim();
        let isBold = false;
        if (lineText.startsWith('*')) {
            isBold = true;
            lineText = lineText.substring(1).trim();
        }
        doc.setFontSize(settings.contentHeader);
        setFont('body', isBold ? 'bold' : 'normal');
        const splitLines = doc.splitTextToSize(lineText, termsTextMaxW_recalc);
        splitLines.forEach((l: string) => tOps_recalc.push({ text: l, isBold }));
    });

    const th_recalc = settings.contentHeader * ptToMm;
    const termsHeadH_recalc = settings.header * ptToMm;
    const termsContentH_recalc = tOps_recalc.length * th_recalc * 1.3;
    let termsBoxH_recalc = termsHeadH_recalc + 1 + termsContentH_recalc + 1 + 1;
    if (termsBoxH_recalc < 30) termsBoxH_recalc = 30;

    const totalFooterHeight_v49 = boxHeightLocal + 2 + wordsBoxH + 8 + termsBoxH_recalc;
    const footerStartY_v49 = pageHeight - settings.marginBottom - totalFooterHeight_v49;

    // --- EXPANSION LOGIC (Using v49 Y) ---
    tableBottomY = tableFinalY;
    if (footerStartY_v49 > tableFinalY + 4) {
        tableBottomY = footerStartY_v49 - 2;
    }

    // Draw Closing Horizontal Line
    doc.setDrawColor(0);
    doc.setLineWidth(standardLineWidth);
    doc.line(marginLeft, tableBottomY, pageWidth - marginRight, tableBottomY);

    // Extension Lines
    if (tableBottomY > tableFinalY) {
        const columns = lastTable.columns;
        let curX = marginLeft;
        doc.line(curX, tableFinalY, curX, tableBottomY);
        if (columns && columns.length) {
            columns.forEach((col: any) => {
                curX += col.width;
                doc.line(curX, tableFinalY, curX, tableBottomY);
            });
        }
    }

    // --- DRAW FOOTER ---
    const footerStart = footerStartY_v49;

    // 1. Bank & Totals
    const rightBoxX = marginLeft + leftBoxWidth + 4;

    // Calculate Bank Label Width
    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    const bankLabelW = Math.max(
        doc.getTextWidth('Bank Name'),
        doc.getTextWidth('A/c No.'),
        doc.getTextWidth('IFSC Code')
    ) + 2;

    doc.roundedRect(marginLeft, footerStart, leftBoxWidth, boxHeightLocal, 3, 3, 'S');

    let bankY = footerStart + footerPad + (settings.header * ptToMm);
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('Bank Details', marginLeft + 3, bankY);
    bankY += 5;
    if (data.sellerDetails.bankName) {
        const drawBank = (lbl: string, val: string) => {
            const h = settings.regular * ptToMm;
            doc.setFontSize(settings.regular);
            setFont('body', 'normal');
            doc.text(lbl, marginLeft + 3, bankY);
            doc.text(':', marginLeft + 3 + bankLabelW, bankY);
            doc.text(val, marginLeft + 3 + bankLabelW + 3, bankY);
            bankY += (h * 1.3);
        };
        drawBank('Bank Name', data.sellerDetails.bankName);
        drawBank('A/c No.', data.sellerDetails.accountNumber || '-');
        drawBank('IFSC Code', data.sellerDetails.ifscCode || '-');
    }

    // Totals
    doc.roundedRect(rightBoxX, footerStart, rightBoxWidth, boxHeightLocal, 3, 3, 'S');
    let tY = footerStart + footerPad + (settings.header * ptToMm) + 4;
    const tLabelX = rightBoxX + 3;
    const tValX = pageWidth - marginRight - 3;
    const tColonX = tLabelX + 22;

    const printTotalRow = (label: string, value: string, bold: boolean) => {
        const h = settings.regular * ptToMm;
        doc.setFontSize(settings.regular);
        setFont('body', bold ? 'bold' : 'normal');
        doc.text(label, tLabelX, tY);
        setFont('body', 'normal');
        doc.text(':', tColonX, tY);
        setFont('body', bold ? 'bold' : 'normal');
        doc.text(value, tValX, tY, { align: 'right' });
        tY += (h * 1.3);
    };
    printTotalRow('Subtotal', parseFloat(data.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }), false);

    const taxAmt = parseFloat(data.totalTax);
    const taxType = (data.taxType || '').toUpperCase();
    if (taxAmt > 0) {
        if (taxType === 'IGST') {
            const rate = data.items[0]?.taxRate || 18;
            printTotalRow(`IGST ${rate}%`, taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), false);
        } else {
            const halfTax = taxAmt / 2;
            const rate = data.items[0]?.taxRate || 18;
            const halfRate = rate / 2;
            printTotalRow(`CGST ${halfRate}%`, halfTax.toLocaleString('en-IN', { minimumFractionDigits: 2 }), false);
            printTotalRow(`SGST ${halfRate}%`, halfTax.toLocaleString('en-IN', { minimumFractionDigits: 2 }), false);
        }
    } else {
        printTotalRow('Tax', '0.00', false);
    }

    // Grand Total (Inside Totals Box)
    tY += 2; // Gap before Grand Total
    const gtVal = Math.round(parseFloat(data.grandTotal)).toLocaleString('en-IN');
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('Grand Total Rs.', tLabelX, tY);
    doc.text(gtVal, tValX, tY, { align: 'right' });

    // 2. Words Box
    const wordsY = footerStart + boxHeightLocal + 2;
    doc.roundedRect(marginLeft, wordsY, contentWidth, wordsBoxH, 3, 3, 'S');
    let wStartY = wordsY + 2 + wLineH;
    if (wLines.length <= 1) wStartY = wordsY + (wordsBoxH / 2) + (wLineH / 3);
    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    doc.text('In Words', marginLeft + 3, wStartY);
    doc.text(':', marginLeft + 3 + doc.getTextWidth('In Words') + 1, wStartY);
    doc.text(wLines, marginLeft + 3 + doc.getTextWidth('In Words') + 1 + 3, wStartY);

    // 3. Terms & Signatory (Strict 60/40)
    // New Vars to avoid conflict with top scope if any
    const termsY_new = wordsY + wordsBoxH + 8;
    const termsW_new = contentWidth * 0.6;
    const signW_new = contentWidth * 0.4;
    const splitX_footer = marginLeft + termsW_new;

    // Calc Terms H
    const termsTextMaxW = termsW_new - 6;
    let tOps_new: { text: string; isBold: boolean }[] = [];
    const rawTerms_v49 = data.sellerDetails.terms ||
        "1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction."; // Fallback

    rawTerms_v49.split('\n').forEach((p: string) => {
        let lineText = p.trim();
        let isBold = false;
        if (lineText.startsWith('*')) {
            isBold = true;
            lineText = lineText.substring(1).trim();
        }
        doc.setFontSize(settings.contentHeader);
        setFont('body', isBold ? 'bold' : 'normal');
        const splitLines = doc.splitTextToSize(lineText, termsTextMaxW);
        splitLines.forEach((l: string) => tOps_new.push({ text: l, isBold }));
    });

    const th_v49 = settings.contentHeader * ptToMm;
    const termsHeadH_v49 = settings.header * ptToMm;
    const termsContentH_new = tOps_new.length * th_v49 * 1.3;
    let termsBoxH_new = termsHeadH_v49 + 1 + termsContentH_new + 1 + 1;
    if (termsBoxH_new < 30) termsBoxH_new = 30;

    // Draw Footer Border (Full Width)
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginLeft, termsY_new, contentWidth, termsBoxH_new, 3, 3, 'S');

    // Terms Content (60%)
    const termHeadY = termsY_new + (settings.header * ptToMm) + 1;
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('TERMS & CONDITIONS', marginLeft + 3, termHeadY);

    let termContentY = termHeadY + (settings.contentHeader * ptToMm) + 1; // Gap 1mm
    doc.setFontSize(settings.contentHeader);
    tOps_new.forEach(op => {
        setFont('body', op.isBold ? 'bold' : 'normal');
        doc.text(op.text, marginLeft + 3, termContentY);
        termContentY += (th_v49 * 1.3);
    });

    // Signatory (40%)
    const signCenterX = splitX_footer + (signW_new / 2);
    const signatoryBoxBottom = termsY_new + termsBoxH_new;
    const signY = signatoryBoxBottom - 2;

    doc.setFontSize(settings.contentHeader);
    setFont('body', 'bold');
    doc.text(data.sellerDetails.name || '', signCenterX, signY, { align: 'center' });

    const titleY = signY - (settings.contentHeader * ptToMm) - 1; // Gap 1mm
    doc.setFontSize(settings.contentHeader);
    setFont('body', 'normal');
    doc.text('Authorized Signatory', signCenterX, titleY, { align: 'center' });

    const lineY = titleY - (settings.contentHeader * ptToMm) - 1;
    const lineW = 40;
    doc.line(signCenterX - (lineW / 2), lineY, signCenterX + (lineW / 2), lineY);

    return doc;
};

// --- CHALLAN GENERATION (Refactored) ---
export const generateChallanPDF = (data: any, settings: any, type: 'Internal' | 'External') => {
    const doc = new jsPDF({
        format: getPageFormat(settings.pageSizeChallan),
        unit: 'mm',
        compress: settings.quality === 'standard'
    });

    if (settings.customFonts && settings.customFonts.length > 0) {
        settings.customFonts.forEach((font: any) => {
            try {
                const filename = `${font.name}.ttf`;
                doc.addFileToVFS(filename, font.data);
                doc.addFont(filename, font.name, 'normal');
                doc.addFont(filename, font.name, 'bold');
                doc.addFont(filename, font.name, 'italic');
            } catch (e) {
                console.error('Failed to load font:', font.name, e);
            }
        });
    }

    const setFont = (t: 'company' | 'body', style: 'normal' | 'bold' | 'italic') => {
        const fontName = t === 'company' ? settings.fontCompany : settings.fontBody;
        doc.setFont(fontName, style);
    };

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const marginLeft = settings.marginLeft;
    const marginRight = settings.marginRight;
    const marginTop = settings.marginTop;
    const contentWidth = pageWidth - (marginLeft + marginRight);
    const ptToMm = 0.352778;

    let currentY = marginTop;

    // Header
    const headerH = settings.header * ptToMm;
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('DELIVERY CHALLAN', pageWidth / 2, currentY + headerH, { align: 'center' });
    currentY += headerH + 2;

    const companyH = settings.company * ptToMm;
    doc.setFontSize(settings.company);

    let companyStyle = 'normal';
    if (settings.fontCompanyBold && settings.fontCompanyItalic) companyStyle = 'bolditalic';
    else if (settings.fontCompanyBold) companyStyle = 'bold';
    else if (settings.fontCompanyItalic) companyStyle = 'italic';

    setFont('company', companyStyle as any);
    doc.text(data.sellerDetails.name || 'Company Name', pageWidth / 2, currentY + companyH, { align: 'center' });
    currentY += companyH + 2;

    // Tagline Logic
    // Tagline Logic
    if (data.sellerDetails.tagline) {
        const taglineH = settings.contentHeader * ptToMm; // Match Invoice
        doc.setFontSize(settings.contentHeader);
        setFont('company', 'italic');
        doc.text(data.sellerDetails.tagline || '', pageWidth / 2, currentY + taglineH, { align: 'center' });
        currentY += taglineH + 1; // Gap 1mm
    } else {
        currentY += 1;
    }
    // Gap to Address Box: 0 (Match Invoice)
    currentY += 0;

    // Address Box
    const box1Start = currentY;
    const boxPad = 3; // Match Invoice (3mm)
    const leftX = marginLeft + boxPad;
    const box1LeftLabelW = 22;
    const box1RightLabelW = 25;
    const addrWidth = contentWidth - (box1LeftLabelW + 3) - 5;
    const lineHeight = settings.regular * ptToMm * 1.3; // Match Invoice (1.3)
    let line1Y = box1Start + boxPad + (settings.regular * ptToMm);

    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    doc.text('ADDRESS', leftX, line1Y);
    doc.text(':', leftX + box1LeftLabelW, line1Y);
    const contentX = leftX + box1LeftLabelW + 3;
    const msgAddress = data.sellerDetails.address || '';
    const addrLines = doc.splitTextToSize(msgAddress, addrWidth);
    if (addrLines.length > 0) doc.text(addrLines[0], contentX, line1Y);
    let leftCursorY = line1Y;
    for (let i = 1; i < addrLines.length; i++) {
        leftCursorY += lineHeight;
        doc.text(addrLines[i], contentX, leftCursorY);
    }
    leftCursorY += lineHeight;
    let rightCursorY = leftCursorY;

    doc.text('GST No.', leftX, leftCursorY);
    doc.text(':', leftX + box1LeftLabelW, leftCursorY);
    doc.text(data.sellerDetails.gstin || '-', contentX, leftCursorY);
    leftCursorY += lineHeight;
    doc.text('Email', leftX, leftCursorY);
    doc.text(':', leftX + box1LeftLabelW, leftCursorY);
    doc.text(data.sellerDetails.email || '-', contentX, leftCursorY);
    // Add Phone
    leftCursorY += lineHeight;
    doc.text('Phone', leftX, leftCursorY);
    doc.text(':', leftX + box1LeftLabelW, leftCursorY);
    doc.text(data.sellerDetails.phone || '-', contentX, leftCursorY);
    leftCursorY += lineHeight; // Fix: Ensure left cursor reflects full height for border

    const splitRatio = 0.6;
    const metaX = marginLeft + (contentWidth * splitRatio);
    const drawMeta = (lbl: string, val: string) => {
        doc.text(lbl, metaX, rightCursorY);
        doc.text(':', metaX + box1RightLabelW, rightCursorY);
        const valX = metaX + box1RightLabelW + 3;
        doc.text(val, valX, rightCursorY);
        rightCursorY += lineHeight;
    };

    const invNo = data.invoiceNumber || data.invoice_number || '-';
    drawMeta('Challan No', invNo);
    drawMeta('Date', data.date ? new Date(data.date).toLocaleDateString('en-GB') : '-');
    if (data.vehicleNumber) drawMeta('Vehicle No', data.vehicleNumber);

    const contentMaxY = Math.max(leftCursorY, rightCursorY);
    // Tight Height Logic (Match Invoice)
    const tightMaxY = contentMaxY - (settings.regular * ptToMm * 0.6);
    const box1Height = (tightMaxY - box1Start);
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginLeft, box1Start, contentWidth, box1Height, 3, 3, 'S');
    currentY = box1Start + box1Height + 8; // Match Invoice Gap (8mm)

    // Box 2
    const box2Start = currentY;
    let box2Y = box2Start + boxPad + (settings.regular * ptToMm);

    // Dynamic Label Width (Match Invoice)
    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    const clientLabelW = Math.max(
        doc.getTextWidth('Client Address'),
        doc.getTextWidth('Client GST'),
        doc.getTextWidth('Delivery Address')
    ) + 2;

    const box2LabelW = clientLabelW;
    const clientX = leftX + box2LabelW + 3;

    doc.text('Client Address', leftX, box2Y);
    doc.text(':', leftX + box2LabelW, box2Y);
    const cStr = `${data.buyerDetails.name || ''}, ${data.buyerDetails.address || ''}`;
    const cLines = doc.splitTextToSize(cStr, contentWidth - box2LabelW - 15);
    if (cLines.length > 0) {
        doc.text(cLines[0], clientX, box2Y);
        for (let i = 1; i < cLines.length; i++) {
            box2Y += lineHeight;
            doc.text(cLines[i], clientX, box2Y);
        }
    }
    box2Y += lineHeight;
    doc.text('Client GST', leftX, box2Y);
    doc.text(':', leftX + box2LabelW, box2Y);
    doc.text(data.buyerDetails.gstin || '-', clientX, box2Y);
    box2Y += lineHeight;

    if (data.buyerDetails.deliveryAddress) {
        doc.text('Delivery Address', leftX, box2Y);
        doc.text(':', leftX + box2LabelW, box2Y);
        const dStr = data.buyerDetails.deliveryAddress;
        const dLines = doc.splitTextToSize(dStr, contentWidth - box2LabelW - 15);
        if (dLines.length > 0) {
            doc.text(dLines[0], clientX, box2Y);
            for (let i = 1; i < dLines.length; i++) {
                box2Y += lineHeight;
                doc.text(dLines[i], clientX, box2Y);
            }
        }
        box2Y += lineHeight;
    }

    // Tight Height Logic (Match Invoice)
    const tightBox2Y = box2Y - (settings.regular * ptToMm * 0.6);
    const box2H = (tightBox2Y - box2Start);
    doc.roundedRect(marginLeft, box2Start, contentWidth, box2H, 3, 3, 'S');
    currentY = box2Start + box2H + 2; // Match Invoice Footer Gap (2mm)

    // --- TABLE ITEMS ---
    const bodyFont = settings.fontBody as string;
    const isInternal = type === 'Internal';

    let processedItems = [...data.items];

    // MERGE LOGIC (External Only)
    if (!isInternal) {
        const mergedMap = new Map<string, any>();
        processedItems.forEach(item => {
            // Group by Description
            const key = (item.description || item.name || '').trim().toLowerCase();
            if (mergedMap.has(key)) {
                const existing = mergedMap.get(key);
                existing.numberOfBags = (Number(existing.numberOfBags) || 0) + (Number(item.numberOfBags) || 0);
                existing.quantity = (Number(existing.quantity) || 0) + (Number(item.quantity) || 0);
            } else {
                mergedMap.set(key, { ...item }); // Clone
            }
        });
        processedItems = Array.from(mergedMap.values());
    }

    // --- MANUAL COLUMN WIDTH CALCULATION (V48 Polish) ---
    doc.setFontSize(settings.regular - 1); // Use body font size for calc
    const paddingBuffer = 8; // INCREASED: 8mm buffer to prevent Producer wrapping

    // Helper to get max width of a column (derived from Invoice)
    const getColWidth = (headerVal: string, colIndex: number, dataSrc: any[]) => {
        const lines = headerVal.split('\n');
        let maxW = 0;
        lines.forEach(line => {
            const w = doc.getTextWidth(line);
            if (w > maxW) maxW = w;
        });
        maxW += 1; // Header buffer

        dataSrc.forEach((row: any) => {
            const val = String(row[colIndex]);
            const w = doc.getTextWidth(val);
            if (w > maxW) maxW = w;
        });
        return maxW + paddingBuffer;
    };

    // Prepare table data first to measure it
    // Mapped Body:
    // Internal: [Sr, Producer, Desc(full), Bags, Qty]
    // External: [Sr, Desc(full), Bags, Qty]
    const tableBody = processedItems.map((item: any, index: number) => {
        const descText = item.description || item.name;
        const bags = Number(item.numberOfBags) || 0;
        const qty = Number(item.quantity) || 0;
        let bagsLine = '';
        if (bags > 0 && qty > 0) {
            const weight = qty / bags;
            bagsLine = `${bags} Bags of ${parseFloat(weight.toFixed(2))} Kg`;
        }
        const fullDesc = bagsLine ? `${descText}\n(${bagsLine})` : descText;
        if (isInternal) {
            const producer = item.producerName || '-';
            return [
                index + 1,
                producer,
                fullDesc,
                bags || '-',
                Number(qty).toLocaleString('en-IN')
            ];
        } else {
            return [
                index + 1,
                fullDesc,
                bags || '-',
                Number(qty).toLocaleString('en-IN')
            ];
        }
    });

    let head = [];
    let colStyles: any = {};
    // Store calculate widths for extension lines
    let finalWidths: number[] = [];

    if (isInternal) {
        // [#, Producer, Desc, Bags, Qty]
        head = [['#', 'Producer', 'Description', 'Bags', 'Qty\n(in Kg)']];

        const w0 = getColWidth('#', 0, tableBody);
        const w1 = getColWidth('Producer', 1, tableBody) + 5; // +5mm Buffer
        const w3 = getColWidth('Bags', 3, tableBody);
        const w4 = getColWidth('Qty\n(in Kg)', 4, tableBody);

        // Ensure Producer doesn't explode, cap it?
        // Invoice caps at auto. Let's maximize Desc.
        // Let's cap Producer to say 25% max if it gets huge, but usually it's short.

        colStyles = {
            0: { cellWidth: w0, halign: 'center' },
            1: { cellWidth: w1, halign: 'center' }, // Producer: Center
            2: { cellWidth: 'auto', halign: 'center' }, // Description: Center
            3: { cellWidth: w3, halign: 'center' },
            4: { cellWidth: w4, halign: 'center' }
        };
        finalWidths = [w0, w1, 0, w3, w4]; // 0 placeholder for auto
    } else {
        // [#, Desc, Bags, Qty]
        head = [['#', 'Description', 'Bags', 'Qty\n(in Kg)']];

        const w0 = getColWidth('#', 0, tableBody);
        const w2 = getColWidth('Bags', 2, tableBody);
        const w3 = getColWidth('Qty\n(in Kg)', 3, tableBody);

        colStyles = {
            0: { cellWidth: w0, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'center' }, // Description: Center
            2: { cellWidth: w2, halign: 'center' },
            3: { cellWidth: w3, halign: 'center' }
        };
        finalWidths = [w0, 0, w2, w3];
    }

    autoTable(doc, {
        startY: currentY,
        head: head,
        body: tableBody,
        theme: 'plain',
        styles: {
            fontSize: settings.regular - 1, // Match Invoice
            lineColor: [0, 0, 0],
            lineWidth: 0,
            textColor: [0, 0, 0],
            valign: 'middle',
            font: bodyFont,
            cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: bodyFont,
            fontSize: settings.regular - 1.5,
            lineWidth: 0.3,
            lineColor: [0, 0, 0],
            halign: 'center'
        },
        columnStyles: colStyles,
        margin: { left: marginLeft, right: marginRight },
        didDrawCell: (data) => {
            if (data.section === 'body') {
                doc.setDrawColor(0);
                doc.setLineWidth(0.3);
                if (data.column.index === 0) doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
                doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
            }
        }
    });

    const tableFinalY = (doc as any).lastAutoTable.finalY;

    // --- FOOTER (V49 Strict 60/40 Split) ---
    // 1. Terms Section (60% Width)
    const termsWidth = contentWidth * 0.6;
    const signWidth = contentWidth * 0.4;
    const footerSplitX = marginLeft + termsWidth;

    // Use a slightly smaller max width for text to avoid hitting the imaginary border
    const termsTextMaxW = termsWidth - 6;

    // Calculate Terms Height
    let tOps: { text: string; isBold: boolean }[] = [];
    const rawTerms = data.sellerDetails.terms ||
        "1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.";

    rawTerms.split('\n').forEach((p: string) => {
        let lineText = p.trim();
        let isBold = false;
        if (lineText.startsWith('*')) {
            isBold = true;
            lineText = lineText.substring(1).trim();
        }
        doc.setFontSize(settings.contentHeader);
        setFont('body', isBold ? 'bold' : 'normal');
        const splitLines = doc.splitTextToSize(lineText, termsTextMaxW);
        splitLines.forEach((l: string) => tOps.push({ text: l, isBold }));
    });

    const th = settings.contentHeader * ptToMm;
    const termsHeadH = settings.header * ptToMm;
    const termsContentH = tOps.length * th * 1.3;
    let termsBoxH = termsHeadH + 1 + termsContentH + 1 + 1;
    if (termsBoxH < 30) termsBoxH = 30; // Min height for aesthetics

    const totalFooterHeight = termsBoxH;
    const footerEndY = pageHeight - settings.marginBottom;
    const footerStartY = footerEndY - totalFooterHeight;

    // --- EXPANSION LOGIC ---
    let finalTableBottom = tableFinalY;

    // If we have space, extend lines to top of footer
    if (footerStartY > tableFinalY + 5) {
        const extensionBottom = footerStartY - 8; // Keep 8mm gap from footer box
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);

        let curX = marginLeft;
        let usedWidth = 0;
        let autoCount = 0;
        finalWidths.forEach(w => {
            usedWidth += w;
            if (w === 0) autoCount++;
        });

        const remaining = contentWidth - usedWidth;
        const autoW = autoCount > 0 ? remaining / autoCount : 0;

        // Draw Lines
        doc.line(curX, tableFinalY, curX, extensionBottom); // Left Border
        finalWidths.forEach(w => {
            const thisW = w === 0 ? autoW : w;
            curX += thisW;
            doc.line(curX, tableFinalY, curX, extensionBottom);
        });

        finalTableBottom = extensionBottom;
    }

    doc.setLineWidth(0.3);
    doc.line(marginLeft, finalTableBottom, pageWidth - marginRight, finalTableBottom);

    const termsY = finalTableBottom + 8; // CHANGED: 8mm Gap
    if (termsY + termsBoxH > footerEndY + 5) {
        doc.addPage();
    }

    // --- TERMS BOX ---
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginLeft, termsY, contentWidth, termsBoxH, 3, 3, 'S');

    // Title: 1mm from Top
    const termHeadY = termsY + (settings.header * ptToMm) + 1;
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('TERMS & CONDITIONS', marginLeft + 3, termHeadY);

    // Content: 1mm from Title
    let termContentY = termHeadY + (settings.contentHeader * ptToMm) + 1; // Gap 1mm
    doc.setFontSize(settings.contentHeader);
    tOps.forEach(op => {
        setFont('body', op.isBold ? 'bold' : 'normal');
        doc.text(op.text, marginLeft + 3, termContentY);
        termContentY += (th * 1.3);
    });

    // --- SIGNATORY (Usage of footerSplitX) ---
    const signCenterX = footerSplitX + (signWidth / 2);

    const signatoryBoxBottom = termsY + termsBoxH;
    const signY = signatoryBoxBottom - 2;

    doc.setFontSize(settings.contentHeader);
    setFont('body', 'bold');
    doc.text(data.sellerDetails.name || '', signCenterX, signY, { align: 'center' });

    const titleY = signY - (settings.contentHeader * ptToMm) - 1; // Gap 1mm
    doc.setFontSize(settings.contentHeader);
    setFont('body', 'normal');
    doc.text('Authorized Signatory', signCenterX, titleY, { align: 'center' });

    const lineY = titleY - (settings.contentHeader * ptToMm) - 1;
    const lineW = 40;
    doc.line(signCenterX - (lineW / 2), lineY, signCenterX + (lineW / 2), lineY);

    return doc;
};




export const downloadInvoicePDF = async (invoiceData: any) => {
    const settings = await getPDFSettings();
    const doc = generateInvoicePDF(invoiceData, settings);
    const fileName = `Invoice_${invoiceData.referenceNumber || invoiceData.invoiceNumber}.pdf`;
    doc.save(fileName);
};

export const printInvoicePDF = async (invoiceData: any) => {
    const settings = await getPDFSettings();
    const doc = generateInvoicePDF(invoiceData, settings);
    doc.autoPrint();
    const blob = doc.output('bloburl');
    window.open(blob, '_blank');
};

export const downloadChallanPDF = async (data: any, type: 'Internal' | 'External') => {
    const settings = await getPDFSettings();
    const doc = generateChallanPDF(data, settings, type);
    doc.save(`${type}_Challan_${data.invoiceNumber}.pdf`);
};

export const printChallanPDF = async (data: any, type: 'Internal' | 'External') => {
    const settings = await getPDFSettings();
    const doc = generateChallanPDF(data, settings, type);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
};
