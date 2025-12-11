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
        fontBody: settings.pdfFontBody || 'helvetica',
        customFonts: fonts || []
    };
};

export const generateInvoicePDF = (data: any, settings: any) => {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });

    // --- LOAD CUSTOM FONTS ---
    if (settings.customFonts && settings.customFonts.length > 0) {
        settings.customFonts.forEach((font: any) => {
            try {
                const filename = `${font.name}.ttf`;
                doc.addFileToVFS(filename, font.data);
                doc.addFont(filename, font.name, 'normal');
                // Map other styles to normal for now as we only upload one file
                doc.addFont(filename, font.name, 'bold');
                doc.addFont(filename, font.name, 'italic');
            } catch (e) {
                console.error('Failed to load font:', font.name, e);
            }
        });
    }

    // Helper to switch fonts
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

    // --- Helper: Footer Height Calculation ---
    // We need to know how much space the Footer needs to 'Push' it to bottom.
    // Footer Blocks:
    // 1. Bank + Totals (Side by Side) -> Max Height of either
    // 2. In Words + Grand Total (Side by Side) -> Max Height
    // 3. Terms (Full Width)
    // 4. Signatory (Inside Terms box or below? Logic was Terms then Signatory inside?)
    //    Actually Signatory is Overlay/Below Terms. Let's check logic.
    //    Signatory is drawn relative to Terms Bottom.

    // Rerun logic virtually to get heights

    // 1. Bank/Totals
    const boxHeightLocal = 35; // Fixed height in previous code

    // 2. Words/GrandTotal
    const leftBoxWidth = (contentWidth * 0.6) - 2;
    const wordsStr = numberToWords(data.grandTotal || 0);
    const wordsLabelW = 20;
    const wAvailW = leftBoxWidth - (3 + wordsLabelW + 3) - 2;
    doc.setFontSize(settings.regular);
    setFont('body', 'normal'); // Set font for text measurement
    const wLines = doc.splitTextToSize(wordsStr, wAvailW);
    const wLineH = settings.regular * ptToMm;
    const wTextHeight = wLines.length * wLineH * 1.5;
    const wordsBoxH = Math.max(15, wTextHeight + 6);

    // 3. Terms
    const termsMaxW = leftBoxWidth - 6;
    let tLines: string[] = [];
    if (data.sellerDetails.terms) {
        doc.setFontSize(settings.contentHeader); // Terms Content Font
        tLines = doc.splitTextToSize(data.sellerDetails.terms, termsMaxW);
    } else {
        tLines.push('1. Payment due within 90 days');
        tLines.push('2. Interest @18% p.a. will be charged on delayed payments');
        tLines.push('3. Subject to local jurisdiction only');
    }
    const th = settings.contentHeader * ptToMm;
    const termsHeadH = settings.header * ptToMm;
    const termsContentH = tLines.length * th * 1.5;
    const termsBoxH = Math.max(35, 5 + termsHeadH + 5 + termsContentH + 5);

    // Total Footer Height (Blocks + Spacing)
    // - Bank/Totals (35)
    // - Spacing (2)
    // - Words (wordsBoxH)
    // - Spacing (2)
    // - Terms (termsBoxH)
    // - Bottom Margin will be respected
    const totalFooterHeight = boxHeightLocal + 2 + wordsBoxH + 2 + termsBoxH;

    // Footer Start Y (Top of Footer Block)
    // We want footer to end exactly at (PageHeight - MarginBottom)
    const footerEndY = pageHeight - settings.marginBottom;
    const footerStartY = footerEndY - totalFooterHeight;


    // --- DRAWING STARTS ---
    let currentY = marginTop;

    // Header
    const headerH = settings.header * ptToMm;
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, currentY + headerH, { align: 'center' });

    if (data.sellerDetails.phone) {
        doc.setFontSize(settings.regular);
        setFont('body', 'normal');
        doc.text(`M: ${data.sellerDetails.phone}`, pageWidth - marginRight, currentY + headerH, { align: 'right' });
    }
    currentY += headerH + 2;

    // Company
    const companyH = settings.company * ptToMm;
    doc.setFontSize(settings.company);
    setFont('company', 'bold');
    doc.text(data.sellerDetails.name || 'Company Name', pageWidth / 2, currentY + companyH, { align: 'center' });
    currentY += companyH + 3;

    // Tagline
    if (data.sellerDetails.tagline) {
        const taglineH = settings.contentHeader * ptToMm;
        doc.setFontSize(settings.contentHeader);
        setFont('company', 'italic');
        doc.text(data.sellerDetails.tagline, pageWidth / 2, currentY + taglineH, { align: 'center' });
        currentY += taglineH + 2;
    } else {
        currentY += 2;
    }
    currentY += 1;

    // Box 1
    const box1Start = currentY;
    const pad = 4;
    const leftX = marginLeft + pad;
    const box1LeftLabelW = 22;
    const box1RightLabelW = 25;
    const addrWidth = contentWidth - (box1LeftLabelW + 3) - 5;

    const lineHeight = settings.regular * ptToMm * 1.4;
    let line1Y = box1Start + pad + (settings.regular * ptToMm);

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
        rightCursorY += lineHeight;
        if (valLines.length > 1) rightCursorY += (valLines.length - 1) * lineHeight;
    };

    const invNo = data.invoiceNumber || data.invoice_number || '-';
    drawMeta('Invoice No', invNo);
    drawMeta('Date', data.date ? new Date(data.date).toLocaleDateString('en-GB') : '-');
    if (data.vehicleNumber) drawMeta('Vehicle No', data.vehicleNumber);

    const contentMaxY = Math.max(leftCursorY, rightCursorY);
    const box1Height = (contentMaxY - box1Start) + 2;

    doc.setLineWidth(standardLineWidth);
    doc.roundedRect(marginLeft, box1Start, contentWidth, box1Height, 3, 3, 'S');
    currentY = box1Start + box1Height + 2;

    // Box 2
    const box2Start = currentY;
    let box2Y = box2Start + pad + (settings.regular * ptToMm);
    const box2LabelW = 32;
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
    doc.setFontSize(settings.header);
    doc.text('Client GST', leftX, box2Y);
    doc.text(':', leftX + box2LabelW, box2Y);
    doc.text(data.buyerDetails.gstin || '-', clientX, box2Y);

    const box2H = (box2Y - box2Start) + pad;
    doc.roundedRect(marginLeft, box2Start, contentWidth, box2H, 3, 3, 'S');
    currentY = box2Start + box2H + 2;

    // Table
    const tableBody = data.items.map((item: any, index: number) => {
        const descText = item.description || item.name;
        const bagsLine = `${item.numberOfBags || '-'} Bags of 25 Kg`;
        const fullDesc = `${descText}\n${bagsLine}`;

        return [
            index + 1,
            fullDesc,
            item.hsn || '',
            item.numberOfBags || '-',
            Number(item.quantity).toLocaleString('en-IN'),
            Number(item.unitPrice).toFixed(1),
            (item.quantity * item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ];
    });

    const bodyFont = settings.fontBody;

    autoTable(doc, {
        startY: currentY,
        head: [['#', 'Description', 'H.S.N.\nCode', 'No. of\nBags', 'Qty', 'Price\nper Kg', 'Taxable\nin Rs.']],
        body: tableBody,
        theme: 'plain',
        styles: {
            fontSize: settings.regular,
            lineColor: [0, 0, 0],
            lineWidth: 0,
            textColor: [0, 0, 0],
            valign: 'middle',
            font: bodyFont,
            cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            font: bodyFont, // Use selected body font
            lineWidth: standardLineWidth,
            lineColor: [0, 0, 0],
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 25, halign: 'center' },
            6: { cellWidth: 35, halign: 'right' }
        },
        margin: { left: marginLeft, right: marginRight },
        didDrawCell: (data) => {
            if (data.section === 'body') {
                doc.setDrawColor(0);
                doc.setLineWidth(standardLineWidth);
                if (data.column.index === 0) {
                    doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
                }
                doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
            }
        }
    });

    const tableFinalY = (doc as any).lastAutoTable.finalY;
    let finalTableBottom = tableFinalY;

    // --- EXPANSION LOGIC ---
    // If table ends before footerStartY, extend borders down.
    // Ensure we have a gap of at least 2mm before footer starts.
    // Target Bottom: footerStartY - 2.

    if (footerStartY > tableFinalY + 5) {
        const extensionBottom = footerStartY - 2;

        // Define Column Widths
        // 10, Auto, 20, 20, 20, 25, 35
        // Auto = ContentWidth - 130
        const cols = [10, contentWidth - 130, 20, 20, 20, 25, 35];

        doc.setDrawColor(0);
        doc.setLineWidth(standardLineWidth);

        let curX = marginLeft;
        // Draw First Vertical Line
        doc.line(curX, tableFinalY, curX, extensionBottom);

        cols.forEach(w => {
            curX += w;
            doc.line(curX, tableFinalY, curX, extensionBottom);
        });

        finalTableBottom = extensionBottom; // Update bottom y
    }

    // Draw Table Bottom Border
    doc.setLineWidth(standardLineWidth);
    doc.line(marginLeft, finalTableBottom, pageWidth - marginRight, finalTableBottom);


    // --- FOOTER RENDER ---
    // Start exactly at calculated FooterStartY
    // But we added 2mm spacing? 
    // Yes. boxHeightLocal is 35. Start Y for BankBox = footerStartY.
    let footerStart = footerStartY;

    const rightBoxWidth = (contentWidth * 0.4) - 2;
    const rightBoxX = marginLeft + leftBoxWidth + 4;

    // Bank Box
    doc.roundedRect(marginLeft, footerStart, leftBoxWidth, boxHeightLocal, 3, 3, 'S');

    let bankY = footerStart + 5 + (settings.header * ptToMm);
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('Bank Details', marginLeft + 3, bankY);
    bankY += 5;

    const bankLabelW = 22;
    const drawBank = (lbl: string, val: string) => {
        const h = settings.regular * ptToMm;
        doc.setFontSize(settings.regular);
        setFont('body', 'normal');
        doc.text(lbl, marginLeft + 3, bankY);
        doc.text(':', marginLeft + 3 + bankLabelW, bankY);
        doc.text(val, marginLeft + 3 + bankLabelW + 3, bankY);
        bankY += (h * 1.5);
    };
    if (data.sellerDetails.bankName) {
        drawBank('Bank Name', data.sellerDetails.bankName);
        drawBank('A/c No.', data.sellerDetails.accountNumber || '-');
        drawBank('IFSC Code', data.sellerDetails.ifscCode || '-');
    }

    // Totals Box
    doc.roundedRect(rightBoxX, footerStart, rightBoxWidth, boxHeightLocal, 3, 3, 'S');

    let tY = footerStart + 5 + (settings.header * ptToMm) + 3;
    const tLabelX = rightBoxX + 3;
    const tValX = pageWidth - marginRight - 3;
    const totalLabelW = 22;
    const tColonX = tLabelX + totalLabelW;

    const printTotalRow = (label: string, value: string, size: number, bold: boolean) => {
        const h = size * ptToMm;
        doc.setFontSize(size);
        setFont('body', bold ? 'bold' : 'normal');
        doc.text(label, tLabelX, tY);
        setFont('body', 'normal');
        doc.text(':', tColonX, tY);
        setFont('body', bold ? 'bold' : 'normal');
        doc.text(value, tValX, tY, { align: 'right' });
        tY += (h * 1.5) + 1;
    };

    printTotalRow('Subtotal', parseFloat(data.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }), settings.regular, false);
    const taxAmt = parseFloat(data.totalTax);
    const taxType = (data.taxType || '').toUpperCase();
    const isInterState = taxType === 'IGST';

    if (taxAmt > 0) {
        if (isInterState) {
            const rate = data.items[0]?.taxRate || 18;
            printTotalRow(`IGST ${rate}%`, taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), settings.regular, false);
        } else {
            const halfTax = taxAmt / 2;
            const rate = data.items[0]?.taxRate || 18;
            const halfRate = rate / 2;
            printTotalRow(`CGST ${halfRate}%`, halfTax.toLocaleString('en-IN', { minimumFractionDigits: 2 }), settings.regular, false);
            printTotalRow(`SGST ${halfRate}%`, halfTax.toLocaleString('en-IN', { minimumFractionDigits: 2 }), settings.regular, false);
        }
    } else {
        printTotalRow('Tax', '0.00', settings.regular, false);
    }

    // Words Box
    const wordsY = footerStart + boxHeightLocal + 2;

    doc.roundedRect(marginLeft, wordsY, leftBoxWidth, wordsBoxH, 3, 3, 'S');

    const wValX = marginLeft + 3 + wordsLabelW + 3;
    let wStartY;
    if (wLines.length > 1) {
        wStartY = wordsY + 4 + wLineH;
    } else {
        wStartY = wordsY + (wordsBoxH / 2) + (wLineH / 3);
    }

    doc.setFontSize(settings.regular);
    setFont('body', 'normal');
    doc.text('In Words', marginLeft + 3, wStartY);
    doc.text(':', marginLeft + 3 + wordsLabelW, wStartY);
    doc.text(wLines, wValX, wStartY);

    // Grand Total Box
    doc.roundedRect(rightBoxX, wordsY, rightBoxWidth, wordsBoxH, 3, 3, 'S');
    const gtMidY = wordsY + (wordsBoxH / 2) + 2;
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('Grand Total Rs.', rightBoxX + 3, gtMidY);
    const gtVal = Math.round(parseFloat(data.grandTotal)).toLocaleString('en-IN');
    doc.text(gtVal, tValX, gtMidY, { align: 'right' });

    // Terms
    const termsY = wordsY + wordsBoxH + 2;
    doc.roundedRect(marginLeft, termsY, contentWidth, termsBoxH, 3, 3, 'S');

    const termHeadY = termsY + 5 + termsHeadH;
    doc.setFontSize(settings.header);
    setFont('body', 'bold');
    doc.text('TERMS & CONDITIONS', marginLeft + 3, termHeadY);

    let termContentY = termHeadY + 5;
    doc.setFontSize(settings.contentHeader);
    setFont('body', 'normal');

    for (let i = 0; i < tLines.length; i++) {
        doc.text(tLines[i], marginLeft + 3, termContentY);
        termContentY += (th * 1.5);
    }

    // Signatory
    const signY = termsY + termsBoxH - 8;
    const signX = pageWidth - marginRight - 30;
    doc.setDrawColor(0);
    doc.line(signX - 25, signY - 5, pageWidth - marginRight - 5, signY - 5);
    doc.setFontSize(settings.contentHeader);
    doc.text('Authorized Signatory', signX, signY, { align: 'center' });
    setFont('body', 'bold');
    doc.text(data.sellerDetails.name || '', signX, signY + 4, { align: 'center' });

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
