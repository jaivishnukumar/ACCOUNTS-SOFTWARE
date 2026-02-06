import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FileDown, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TAX_REPORT_API = '/api/reports/tax-summary';

function TaxReport({ company }) {
    const [taxData, setTaxData] = useState([]);
    const [rawTaxData, setRawTaxData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [taxLogic, setTaxLogic] = useState('auto'); // 'auto', 'exempted', 'taxable'

    const fetchTaxData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(TAX_REPORT_API, {
                params: { year }
            });
            setRawTaxData(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching tax data:', error);
            setRawTaxData([]);
            setTaxData([]);
        } finally {
            setIsLoading(false);
        }
    }, [year]);

    useEffect(() => {
        fetchTaxData();
    }, [fetchTaxData, company]);

    useEffect(() => {
        if (!rawTaxData.length) {
            setTaxData([]);
            return;
        }

        const processed = rawTaxData.map(item => {
            const netLiability = (item.salesTax || 0) - (item.purchaseTax || 0) + (item.rcmPayable || 0);
            let rcmInput = 0;

            if (taxLogic === 'auto') {
                rcmInput = item.rcmInput || 0;
            } else if (taxLogic === 'exempted') {
                rcmInput = 0;
            } else if (taxLogic === 'taxable') {
                rcmInput = item.rcmPayable || 0;
            }

            return {
                ...item,
                subTotal: (item.salesTax || 0) - (item.purchaseTax || 0),
                netLiability,
                rcmInput,
                grandTotal: netLiability - rcmInput
            };
        });

        setTaxData(processed);
    }, [rawTaxData, taxLogic]);

    const formatCurrency = (val) => `Rs. ${parseFloat(val || 0).toFixed(2)}`;

    const getMonthName = (m) => {
        return new Date(0, m - 1).toLocaleString('default', { month: 'long' });
    };

    const exportExcelRow = (row) => {
        const companyName = company ? company.name.toUpperCase() : 'COMPANY';
        const title = `TAX LIABILITY REPORT - ${getMonthName(row.month)} ${row.year}`;

        const headers = [
            'Description', 'Amount'
        ];

        const data = [
            [companyName],
            [title],
            [],
            headers,
            ['Sales Tax (Output)', formatCurrency(row.salesTax)],
            ['Purchase Tax (Input)', formatCurrency(row.purchaseTax)],
            ['Sub Total', formatCurrency(row.subTotal)],
            ['Add: RCM Payable', formatCurrency(row.rcmPayable)],
            ['Net Liability', formatCurrency(row.netLiability)], // New Column E
            ['Less: RCM Payment', formatCurrency(row.rcmInput)],
            ['Grand Total', formatCurrency(row.grandTotal)]
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tax Report");
        XLSX.writeFile(wb, `Tax_Report_${getMonthName(row.month)}_${row.year}.xlsx`);
    };

    const exportPDFRow = (row) => {
        const doc = new jsPDF();
        const companyName = company ? company.name.toUpperCase() : 'COMPANY';
        const title = `TAX LIABILITY REPORT - ${getMonthName(row.month)} ${row.year}`;

        doc.setFontSize(16);
        doc.text(companyName, 14, 15);
        doc.setFontSize(10);
        doc.text(title, 14, 22);

        const tableColumn = ["Description", "Amount"];
        const tableRows = [
            ['Sales Tax (Output)', formatCurrency(row.salesTax)],
            ['Purchase Tax (Input)', formatCurrency(row.purchaseTax)],
            ['Sub Total (Sales - Purchase)', formatCurrency(row.subTotal)],
            ['Add: RCM Payable', formatCurrency(row.rcmPayable)],
            ['Net Liability', formatCurrency(row.netLiability)], // New Column E
            ['Less: RCM Payment', formatCurrency(row.rcmInput)],
            ['Grand Total', formatCurrency(row.grandTotal)]
        ];

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
        });
        doc.save(`Tax_Report_${getMonthName(row.month)}_${row.year}.pdf`);
    };

    const exportToExcel = () => {
        const companyName = company ? company.name.toUpperCase() : 'COMPANY';
        const title = `ANNUAL TAX LIABILITY REPORT - ${year}`;

        const headers = [
            'Month',
            'Sales Tax (A)',
            'Purchase Tax (B)',
            'Sub Total',
            'Add RCM',
            'Net Liability', // New
            'Less RCM',
            'Grand Total'
        ];

        const data = [];
        data.push([companyName]);
        data.push([title]);
        data.push([]);
        data.push(headers);

        taxData.forEach(row => {
            data.push([
                `${getMonthName(row.month)} ${row.year}`,
                formatCurrency(row.salesTax),
                formatCurrency(row.purchaseTax),
                formatCurrency(row.subTotal),
                formatCurrency(row.rcmPayable),
                formatCurrency(row.netLiability), // New
                formatCurrency(row.rcmInput),
                formatCurrency(row.grandTotal)
            ]);
        });

        // Totals
        const totalSales = taxData.reduce((s, i) => s + (i.salesTax || 0), 0);
        const totalPurchase = taxData.reduce((s, i) => s + (i.purchaseTax || 0), 0);
        const totalSub = taxData.reduce((s, i) => s + (i.subTotal || 0), 0);
        const totalRCMAdd = taxData.reduce((s, i) => s + (i.rcmPayable || 0), 0);
        const totalNetLiability = taxData.reduce((s, i) => s + (i.netLiability || 0), 0);
        const totalRCMSub = taxData.reduce((s, i) => s + (i.rcmInput || 0), 0);
        const totalGrand = taxData.reduce((s, i) => s + (i.grandTotal || 0), 0);

        data.push([
            'TOTAL',
            formatCurrency(totalSales),
            formatCurrency(totalPurchase),
            formatCurrency(totalSub),
            formatCurrency(totalRCMAdd),
            formatCurrency(totalNetLiability),
            formatCurrency(totalRCMSub),
            formatCurrency(totalGrand)
        ]);

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tax Report");
        XLSX.writeFile(wb, `Annual_Tax_Report_${year}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape mode for wider tables
        const companyName = company ? company.name.toUpperCase() : 'COMPANY';
        const title = `ANNUAL TAX LIABILITY REPORT - ${year}`;

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(companyName, 14, 15);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(title, 14, 22);

        const tableColumn = [
            "Month", "Sales Tax (A)", "Pur Tax (B)",
            "Sub Total", "Add RCM", "Net Liab", "Less RCM", "Grand Total"
        ];

        const tableRows = [];

        taxData.forEach(row => {
            tableRows.push([
                `${getMonthName(row.month)} ${row.year}`,
                formatCurrency(row.salesTax),
                formatCurrency(row.purchaseTax),
                formatCurrency(row.subTotal),
                formatCurrency(row.rcmPayable),
                formatCurrency(row.netLiability),
                formatCurrency(row.rcmInput),
                formatCurrency(row.grandTotal)
            ]);
        });

        const totalSales = taxData.reduce((s, i) => s + (i.salesTax || 0), 0);
        const totalPurchase = taxData.reduce((s, i) => s + (i.purchaseTax || 0), 0);
        const totalSub = taxData.reduce((s, i) => s + (i.subTotal || 0), 0);
        const totalRCMAdd = taxData.reduce((s, i) => s + (i.rcmPayable || 0), 0);
        const totalNetLiability = taxData.reduce((s, i) => s + (i.netLiability || 0), 0);
        const totalRCMSub = taxData.reduce((s, i) => s + (i.rcmInput || 0), 0);
        const totalGrand = taxData.reduce((s, i) => s + (i.grandTotal || 0), 0);

        tableRows.push([
            'TOTAL',
            formatCurrency(totalSales),
            formatCurrency(totalPurchase),
            formatCurrency(totalSub),
            formatCurrency(totalRCMAdd),
            formatCurrency(totalNetLiability),
            formatCurrency(totalRCMSub),
            formatCurrency(totalGrand)
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: {
                fillColor: [16, 185, 129],
                textColor: 255,
                halign: 'center',
                valign: 'middle'
            },
            styles: {
                overflow: 'visible', // Prevent wrapping
                cellWidth: 'auto'
            },
            columnStyles: {
                0: { halign: 'center' },
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right', fontStyle: 'bold', fillColor: [240, 253, 244] }
            },
            didParseCell: function (data) {
                // Highlight Total Row
                if (data.row.index === tableRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        doc.save("Tax_Liability_Report.pdf");
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center mr-100">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <FileDown className="text-emerald-600" /> Tax Liability Report
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={exportToExcel} className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors shadow-sm">
                            Excel
                        </button>
                        <button onClick={exportToPDF} className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors shadow-sm">
                            PDF
                        </button>
                        <button onClick={fetchTaxData} className="px-3 py-2 bg-emerald-100 text-emerald-700 text-sm rounded hover:bg-emerald-200 transition-colors shadow-sm">
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 bg-gray-50/50 p-4 rounded-lg border border-gray-100 w-fit">
                    <div className="flex items-center gap-2 text-gray-600">
                        <Filter size={18} />
                        <span className="text-sm font-medium">Filter Year:</span>
                    </div>
                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="p-2 text-sm border-gray-200 rounded border shadow-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 bg-white"
                    >
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                    </select>

                    <div className="w-px h-8 bg-gray-300 mx-2"></div>

                    <div className="flex items-center gap-2 text-gray-600">
                        <Filter size={18} />
                        <span className="text-sm font-medium">Tax Logic:</span>
                    </div>
                    <select
                        value={taxLogic}
                        onChange={(e) => setTaxLogic(e.target.value)}
                        className="p-2 text-sm border-gray-200 rounded border shadow-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 bg-white"
                    >
                        <option value="auto">Auto (Default)</option>
                        <option value="exempted">Exempted Only</option>
                        <option value="taxable">Tax Rates Only</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Tax (A)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Tax (B)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Total</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Add: RCM Payable</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Net Liability</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Less: RCM Payment</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Grand Total</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan="7" className="text-center py-8 text-gray-500">Loading data...</td></tr>
                        ) : taxData.length > 0 ? (
                            <>
                                {taxData.map((row) => (
                                    <tr key={`${row.year}-${row.month}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                            {getMonthName(row.month)} {row.year}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">{formatCurrency(row.salesTax)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">{formatCurrency(row.purchaseTax)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatCurrency(row.subTotal)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 text-right">{formatCurrency(row.rcmPayable)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-right bg-gray-50">{formatCurrency(row.netLiability)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">{formatCurrency(row.rcmInput)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-700 text-right">{formatCurrency(row.grandTotal)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => exportExcelRow(row)}
                                                className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                                                title="Export Month Excel"
                                            >
                                                <FileDown size={16} />
                                            </button>
                                            <button
                                                onClick={() => exportPDFRow(row)}
                                                className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                                                title="Export Month PDF"
                                            >
                                                <FileDown size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Total Row */}
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                    <td className="px-6 py-4 text-gray-700">TOTAL</td>
                                    <td className="px-6 py-4 text-right">
                                        {formatCurrency(taxData.reduce((s, i) => s + (i.salesTax || 0), 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {formatCurrency(taxData.reduce((s, i) => s + (i.purchaseTax || 0), 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {formatCurrency(taxData.reduce((s, i) => s + (i.subTotal || 0), 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {formatCurrency(taxData.reduce((s, i) => s + (i.rcmPayable || 0), 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right bg-gray-50">
                                        {formatCurrency(taxData.reduce((s, i) => s + (i.netLiability || 0), 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {formatCurrency(taxData.reduce((s, i) => s + (i.rcmInput || 0), 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right text-emerald-700">
                                        {formatCurrency(taxData.reduce((s, i) => s + (i.grandTotal || 0), 0))}
                                    </td>
                                    <td></td>
                                </tr>
                            </>
                        ) : (
                            <tr><td colSpan="7" className="text-center py-8 text-gray-500">No tax data found for this year.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TaxReport;
