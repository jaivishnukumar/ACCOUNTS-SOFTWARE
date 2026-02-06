import { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { downloadBlob } from '../utils/downloadHelper';

const API_Base = '/api';

function ConsolidatedReport({ company, financialYear }) {
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('April');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!financialYear) return;
        // Generate Month List based on Financial Year (Apr - Mar)
        const fyStart = parseInt(financialYear.split('-')[0]);
        const fyEnd = parseInt(financialYear.split('-')[1]);
        const m = [
            { name: 'April', val: 0, year: fyStart },
            { name: 'May', val: 1, year: fyStart },
            { name: 'June', val: 2, year: fyStart },
            { name: 'July', val: 3, year: fyStart },
            { name: 'August', val: 4, year: fyStart },
            { name: 'September', val: 5, year: fyStart },
            { name: 'October', val: 6, year: fyStart },
            { name: 'November', val: 7, year: fyStart },
            { name: 'December', val: 8, year: fyStart },
            { name: 'January', val: 0, year: fyEnd },
            { name: 'February', val: 1, year: fyEnd },
            { name: 'March', val: 2, year: fyEnd }
        ];
        setMonths(m);
        // Default to current month or first month
        const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
        const exists = m.find(month => month.name === currentMonthName);
        setSelectedMonth(exists ? currentMonthName : m[0].name);
    }, [financialYear]);

    const fetchRawData = async () => {
        const [salesRes, purchaseRes, taxRes] = await Promise.all([
            axios.get(`${API_Base}/sales`),
            axios.get(`${API_Base}/purchases`),
            axios.get(`${API_Base}/tax-report/monthly`)
        ]);
        return { salesAll: salesRes.data, purchaseAll: purchaseRes.data, taxAll: taxRes.data };
    };

    const addMonthToDoc = (doc, monthObj, salesData, purchaseData, taxData, company, financialYear) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const monthName = monthObj.name;
        const monthYear = monthObj.year;

        // --- PAGE 1: SALES & TAX ---

        // Header
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(company.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Sales Report - ${monthName} ${monthYear} (FY: ${financialYear})`, pageWidth / 2, 16, { align: 'center' });

        // Sales Table
        const salesColumns = [
            "Date", "Bill No", "Party Name", "GSTIN", "HSN",
            "Bags", "Unit", "Taxable", "CGST", "SGST", "Total"
        ];

        const salesRows = salesData.map(s => [
            new Date(s.date).toLocaleDateString('en-GB'),
            s.bill_no,
            s.party_name,
            s.gst_number || '-',
            s.hsn_code || '-',
            s.bags || '0',
            s.unit || 'BAG',
            parseFloat(s.bill_value).toFixed(2),
            (parseFloat(s.cgst) || 0).toFixed(2),
            (parseFloat(s.sgst) || 0).toFixed(2),
            parseFloat(s.total).toFixed(2)
        ]);

        // Sales Totals
        const sTotalTaxable = salesData.reduce((acc, curr) => acc + (parseFloat(curr.bill_value) || 0), 0);
        const sTotalCGST = salesData.reduce((acc, curr) => acc + (parseFloat(curr.cgst) || 0), 0);
        const sTotalSGST = salesData.reduce((acc, curr) => acc + (parseFloat(curr.sgst) || 0), 0);
        const sGrandTotal = salesData.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);

        salesRows.push(['', '', 'Total', '', '', '', '',
            sTotalTaxable.toFixed(2),
            sTotalCGST.toFixed(2), sTotalSGST.toFixed(2),
            sGrandTotal.toFixed(2)
        ]);

        autoTable(doc, {
            head: [salesColumns],
            body: salesRows,
            startY: 22,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], halign: 'center', fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' }, // overflow: linebreak is default but strictly explicit widths help
            columnStyles: {
                0: { cellWidth: 22 }, // Date
                1: { cellWidth: 20 }, // Bill No
                2: { cellWidth: 'auto' }, // Party Name
                3: { cellWidth: 38 }, // GSTIN (Increased to prevent wrap)
                4: { cellWidth: 22 }, // HSN (Increased to prevent wrap)
                5: { cellWidth: 12 }, // Bags
                6: { cellWidth: 12 }, // Unit
                7: { halign: 'right', cellWidth: 22 }, // Taxable
                8: { halign: 'right', cellWidth: 18 }, // CGST
                9: { halign: 'right', cellWidth: 18 }, // SGST
                10: { halign: 'right', cellWidth: 25 } // Total
            },
            didParseCell: (data) => {
                if (data.row.index === salesRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        // Tax Report
        const finalY = doc.lastAutoTable.finalY || 100;
        if (finalY > 150) doc.addPage('a4', 'l'); // Explicit Landscape
        let taxY = finalY > 150 ? 20 : finalY + 10;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Tax Liability Summary - ${monthName}`, 14, taxY);

        const taxBody = [
            ['Output Tax (Sales)', (taxData.salesTax || 0).toFixed(2)],
            ['Input Tax (Purchases)', (taxData.purchaseTax || 0).toFixed(2)],
            ['Sub Total (Payable/Credit)', (taxData.subTotal || 0).toFixed(2)],
            ['Add: RCM Payable', (taxData.rcmPayable || 0).toFixed(2)],
            ['Less: RCM Input Credit', (taxData.rcmInput || 0).toFixed(2)],
            ['Net Tax Liability', (taxData.grandTotal || 0).toFixed(2)]
        ];

        autoTable(doc, {
            body: taxBody,
            startY: taxY + 5,
            theme: 'plain',
            styles: { fontSize: 10 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 80 },
                1: { halign: 'right', cellWidth: 40 }
            }
        });

        // --- PAGE 2: PURCHASES ---
        doc.addPage('a4', 'l'); // Explicit Landscape

        // Header
        doc.setFontSize(18);
        doc.text(company.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Purchase Report - ${monthName} ${monthYear} (FY: ${financialYear})`, pageWidth / 2, 16, { align: 'center' });

        // Purchase Table with 2-Row Layout
        const purColumns = [
            "Date", "Bill No", "Party", "GST No", "Qty", "Taxable", "CGST", "SGST", "Bill Value"
        ];

        const purRows = [];
        purchaseData.forEach(p => {
            // Row 1: Main Details
            purRows.push([
                new Date(p.date).toLocaleDateString('en-GB'),
                p.bill_no,
                p.party_name || '-',
                p.gst_number || '-',
                `${p.quantity || 0} ${p.unit || ''}`,
                parseFloat(p.taxable_value).toFixed(2),
                (parseFloat(p.cgst) || 0).toFixed(2),
                (parseFloat(p.sgst) || 0).toFixed(2),
                parseFloat(p.bill_value).toFixed(2)
            ]);

            // Row 2: Expenses
            purRows.push([
                `AMT: ${(parseFloat(p.taxable_value) || 0).toFixed(2)}`,
                `Fre: ${(parseFloat(p.freight_charges) || 0).toFixed(2)}`,
                `Load: ${(parseFloat(p.loading_charges) || 0).toFixed(2)}`,
                `Unload: ${(parseFloat(p.unloading_charges) || 0).toFixed(2)}`,
                `Auto: ${(parseFloat(p.auto_charges) || 0).toFixed(2)}`,
                `Exp: ${(parseFloat(p.expenses_total) || 0).toFixed(2)}`,
                `RCM: ${(parseFloat(p.rcm_tax_payable) || 0).toFixed(2)}`,
                '',
                ''
            ]);
        });

        // Purchase Totals
        const pTotalTaxable = purchaseData.reduce((acc, curr) => acc + (parseFloat(curr.taxable_value) || 0), 0);
        const pTotalCGST = purchaseData.reduce((acc, curr) => acc + (parseFloat(curr.cgst) || 0), 0);
        const pTotalSGST = purchaseData.reduce((acc, curr) => acc + (parseFloat(curr.sgst) || 0), 0);
        const pGrandTotal = purchaseData.reduce((acc, curr) => acc + (parseFloat(curr.bill_value) || 0), 0);
        const pTotalExp = purchaseData.reduce((acc, curr) => acc + (parseFloat(curr.expenses_total) || 0), 0);
        const pTotalRCM = purchaseData.reduce((acc, curr) => acc + (parseFloat(curr.rcm_tax_payable) || 0), 0);

        // Add Totals Row
        purRows.push([
            'TOTAL', '', '', '', '',
            pTotalTaxable.toFixed(2),
            pTotalCGST.toFixed(2),
            pTotalSGST.toFixed(2),
            pGrandTotal.toFixed(2)
        ]);
        // Add Expense Totals Row
        purRows.push([
            '', '', '', '', '',
            `Exp Tot: ${pTotalExp.toFixed(2)}`,
            `RCM Tot: ${pTotalRCM.toFixed(2)}`,
            '',
            ''
        ]);


        autoTable(doc, {
            head: [purColumns],
            body: purRows,
            startY: 22,
            theme: 'grid',
            headStyles: { fillColor: [39, 174, 96], halign: 'center', fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 1.5, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 20 }, // Reduced Bill No slightly
                2: { cellWidth: 'auto' }, // Party Width
                3: { cellWidth: 35 }, // GST
                4: { cellWidth: 22 }, // Qty
                5: { halign: 'right', cellWidth: 22 }, // Taxable
                6: { halign: 'right', cellWidth: 18 }, // CGST
                7: { halign: 'right', cellWidth: 18 }, // SGST
                8: { halign: 'right', cellWidth: 30 }  // Bill Value
            },
            didParseCell: (data) => {
                // Formatting for Row 2 (Expenses)
                if (data.row.index % 2 !== 0) { // Odd index = Row 2 (0-indexed: 0=Row1, 1=Row2)
                    data.cell.styles.fillColor = [250, 250, 250];
                    data.cell.styles.fontSize = 8;
                    data.cell.styles.textColor = [80, 80, 80];
                    // Reset halign for expense row to match text flow if needed, or keep inherited.
                    // The mapped columns align with header.
                }
                // Bold Total Rows
                if (data.row.index >= purRows.length - 2) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });
    };

    const generatePDF = async () => {
        if (!company) return;
        setLoading(true);
        try {
            const { salesAll, purchaseAll, taxAll } = await fetchRawData();
            const selectedMonthObj = months.find(m => m.name === selectedMonth);
            if (!selectedMonthObj) throw new Error("Selected month not found.");

            // Standardize Filtering
            const isMatch = (dateStr) => {
                const d = new Date(dateStr);
                return d.toLocaleString('en-US', { month: 'long' }) === selectedMonthObj.name && d.getFullYear() === selectedMonthObj.year;
            };

            const salesData = salesAll.filter(s => isMatch(s.date));
            const purchaseData = purchaseAll.filter(p => isMatch(p.date));

            // Fix Tax Month Matching
            // Tax API returns 1-12 usually. April is 4.
            const monthIndex = new Date(`${selectedMonthObj.name} 1, 2000`).getMonth() + 1;
            const taxData = taxAll.find(t =>
                t.month === monthIndex && t.year === selectedMonthObj.year
            ) || {};

            const doc = new jsPDF('l', 'mm', 'a4');
            addMonthToDoc(doc, selectedMonthObj, salesData, purchaseData, taxData, company, financialYear);

            const fileName = `${company.name.replace(/\s+/g, '_')}_${selectedMonth}_${financialYear}.pdf`;
            doc.save(fileName);

            setLoading(false);
            alert('Consolidated Report (PDF) Exported Successfully!');

        } catch (error) {
            console.error(error);
            setLoading(false);
            alert('Failed to generate report: ' + error.message);
        }
    };

    const generateFullYearPDF = async () => {
        if (!company) return;
        setLoading(true);
        try {
            const { salesAll, purchaseAll, taxAll } = await fetchRawData();
            const doc = new jsPDF('l', 'mm', 'a4');

            // Iterate 12 months
            for (let i = 0; i < months.length; i++) {
                const month = months[i];
                if (i > 0) doc.addPage('a4', 'l'); // Explicit Landscape for new month start

                // Helper to check month match (Standardized Locale)
                const isMatch = (dateStr) => {
                    const d = new Date(dateStr);
                    return d.toLocaleString('en-US', { month: 'long' }) === month.name && d.getFullYear() === month.year;
                };

                const salesData = salesAll.filter(s => isMatch(s.date));
                const purchaseData = purchaseAll.filter(p => isMatch(p.date));

                // Correct Tax Finding: April is 4, not 1 (which was val+1 if val=0).
                const monthIndex = new Date(`${month.name} 1, 2000`).getMonth() + 1;

                const tData = taxAll.find(t =>
                    t.month === monthIndex && t.year === month.year
                ) || {};

                addMonthToDoc(doc, month, salesData, purchaseData, tData, company, financialYear);
            }

            const fileName = `${company.name.replace(/\s+/g, '_')}_Full_Year_Report_${financialYear}.pdf`;
            doc.save(fileName);
            setLoading(false);
            alert('Full Year Report Exported Successfully!');

        } catch (error) {
            console.error(error);
            setLoading(false);
            alert('Failed to generate full year report: ' + error.message);
        }
    };


    const exportToExcel = async () => {
        if (!company) return;
        setLoading(true);
        try {
            const { salesAll, purchaseAll } = await fetchRawData(); // Reused
            const selectedMonthObj = months.find(m => m.name === selectedMonth);
            if (!selectedMonthObj) throw new Error("Selected month not found.");

            // Filter
            const isMatch = (dateStr) => {
                const d = new Date(dateStr);
                return d.toLocaleString('default', { month: 'long' }) === selectedMonthObj.name && d.getFullYear() === selectedMonthObj.year;
            };
            const salesData = salesAll.filter(s => isMatch(s.date));
            const purchaseData = purchaseAll.filter(p => isMatch(p.date));

            const wb = XLSX.utils.book_new();

            // --- SHEET 1: SALES ---
            const sData = [];
            sData.push([`SALES REPORT - ${selectedMonth} ${selectedMonthObj.year} (FY: ${financialYear}) - ${company.name.toUpperCase()}`]);
            sData.push([]);
            const sHeaders = ["Date", "Bill No", "Party Name", "GSTIN", "HSN", "Bags", "Unit", "Taxable", "Rate", "CGST", "SGST", "Total"];
            sData.push(sHeaders);

            salesData.forEach(s => {
                sData.push([
                    new Date(s.date).toLocaleDateString('en-GB'),
                    s.bill_no,
                    s.party_name,
                    s.gst_number,
                    s.hsn_code,
                    s.bags,
                    s.unit,
                    parseFloat(s.bill_value), // Taxable
                    `${s.tax_rate}%`,
                    parseFloat(s.cgst),
                    parseFloat(s.sgst),
                    parseFloat(s.total)
                ]);
            });

            // Sales Totals
            const sTotalRow = [
                'TOTAL', '', '', '', '', '', '',
                salesData.reduce((a, c) => a + (parseFloat(c.bill_value) || 0), 0),
                '',
                salesData.reduce((a, c) => a + (parseFloat(c.cgst) || 0), 0),
                salesData.reduce((a, c) => a + (parseFloat(c.sgst) || 0), 0),
                salesData.reduce((a, c) => a + (parseFloat(c.total) || 0), 0)
            ];
            sData.push(sTotalRow);

            const wsSales = XLSX.utils.aoa_to_sheet(sData);
            // Column Widths
            wsSales['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsSales, "Sales");


            // --- SHEET 2: PURCHASES ---
            const pData = [];
            pData.push([`PURCHASE REPORT - ${selectedMonth} ${selectedMonthObj.year} (FY: ${financialYear}) - ${company.name.toUpperCase()}`]);
            pData.push([]);
            const pHeaders = ["Date", "Bill No", "Party Name", "GSTIN", "HSN", "Qty", "Unit", "Taxable", "Rate", "CGST", "SGST", "Converted Qty", "Exp Total", "RCM", "Bill Value"];
            pData.push(pHeaders);

            purchaseData.forEach(p => {
                pData.push([
                    new Date(p.date).toLocaleDateString('en-GB'),
                    p.bill_no,
                    p.party_name,
                    p.gst_number,
                    p.hsn_code,
                    p.quantity,
                    p.unit,
                    parseFloat(p.taxable_value),
                    `${p.tax_rate}%`,
                    parseFloat(p.cgst),
                    parseFloat(p.sgst),
                    `${(p.quantity * (p.conversion_factor || 1)).toFixed(2)} ${company.secondary_unit || 'Units'}`,
                    parseFloat(p.expenses_total),
                    parseFloat(p.rcm_tax_payable),
                    parseFloat(p.bill_value)
                ]);
            });

            // Purchase Totals
            const pTotalRow = [
                'TOTAL', '', '', '', '', '', '',
                purchaseData.reduce((a, c) => a + (parseFloat(c.taxable_value) || 0), 0),
                '',
                purchaseData.reduce((a, c) => a + (parseFloat(c.cgst) || 0), 0),
                purchaseData.reduce((a, c) => a + (parseFloat(c.sgst) || 0), 0),
                '',
                purchaseData.reduce((a, c) => a + (parseFloat(c.expenses_total) || 0), 0),
                purchaseData.reduce((a, c) => a + (parseFloat(c.rcm_tax_payable) || 0), 0),
                purchaseData.reduce((a, c) => a + (parseFloat(c.bill_value) || 0), 0)
            ];
            pData.push(pTotalRow);

            const wsPurchase = XLSX.utils.aoa_to_sheet(pData);
            wsPurchase['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsPurchase, "Purchases");

            // Write File
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            downloadBlob(blob, `${company.name.replace(/\s+/g, '_')}_${selectedMonth}_${financialYear}.xlsx`);

            setLoading(false);
            alert("Excel Exported Successfully!");

        } catch (e) {
            console.error(e);
            setLoading(false);
            alert("Excel Export Failed: " + e.message);
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 max-w-2xl mx-auto mt-10">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FileDown className="text-blue-600" /> Consolidated Report
                </h2>
            </div>

            <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-800">
                        Export all your business data for a specific month.
                        <br />
                        <strong>PDF:</strong> Optimized for printing (Sales Page 1, Purchase Page 2).
                        <br />
                        <strong>Excel:</strong> Downloadable data sheets for analysis.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Month</label>
                        <select
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            {months.map((m, idx) => (
                                <option key={idx} value={m.name}>{m.name} {m.year}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-3 justify-end">
                        <button
                            onClick={generatePDF}
                            disabled={loading}
                            className={`w-full py-3 px-6 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2
                                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-rose-600 hover:scale-[1.02]'}
                            `}
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    <FileDown size={20} /> Export PDF
                                </>
                            )}
                        </button>
                        <button
                            onClick={generateFullYearPDF}
                            disabled={loading}
                            className={`w-full py-3 px-6 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2
                                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.02]'}
                            `}
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    <FileDown size={20} /> Export Full Year PDF
                                </>
                            )}
                        </button>
                        <button
                            onClick={exportToExcel}
                            disabled={loading}
                            className={`w-full py-3 px-6 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2
                                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:scale-[1.02]'}
                            `}
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    <FileSpreadsheet size={20} /> Export Excel
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ConsolidatedReport;
