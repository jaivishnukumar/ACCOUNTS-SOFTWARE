import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FileDown, Filter, Trash2, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadBlob } from '../utils/downloadHelper';

const PURCHASE_API_URL = '/api/purchases';

function PurchaseReport({ onEdit, company }) {
    const [purchases, setPurchases] = useState([]);
    const [parties, setParties] = useState([]);
    const [hsnList, setHsnList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        hsn: '',
        party: ''
    });

    const fetchParties = useCallback(async () => {
        try {
            const response = await axios.get('/api/parties');
            setParties(response.data);
        } catch (error) {
            console.error('Error fetching parties:', error);
        }
    }, []);

    const fetchHSNCodes = useCallback(async () => {
        try {
            const res = await axios.get('/api/hsn');
            setHsnList(res.data);
        } catch (error) {
            console.error("Error fetching HSN codes", error);
        }
    }, []);

    const fetchPurchases = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (filters.month !== 'all') params.month = filters.month;
            if (filters.year !== 'all') params.year = filters.year;
            if (filters.hsn) params.hsn = filters.hsn;
            if (filters.party) params.party = filters.party;

            const response = await axios.get(PURCHASE_API_URL, { params });
            setPurchases(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching purchases:', error);
            setPurchases([]);
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchParties();
        fetchHSNCodes();
    }, [fetchParties, fetchHSNCodes]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchPurchases();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [filters, fetchPurchases]);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this purchase entry?')) {
            try {
                await axios.delete(`${PURCHASE_API_URL}/${id}`);
                fetchPurchases();
            } catch (error) {
                console.error('Error deleting purchase:', error);
                alert('Failed to delete purchase');
            }
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // Calculate Totals
    const totals = purchases.reduce((acc, curr) => {
        const unit = curr.unit || '';
        const qty = parseInt(curr.quantity) || 0;
        acc.qtyByUnit[unit] = (acc.qtyByUnit[unit] || 0) + qty;

        acc.taxable += (parseFloat(curr.taxable_value) || 0);
        acc.cgst += (parseFloat(curr.cgst) || 0);
        acc.sgst += (parseFloat(curr.sgst) || 0);
        acc.billValue += (parseFloat(curr.bill_value) || 0);

        // Detailed Expenses
        acc.freight += (parseFloat(curr.freight_charges) || 0);
        acc.loading += (parseFloat(curr.loading_charges) || 0);
        acc.unloading += (parseFloat(curr.unloading_charges) || 0);
        acc.auto += (parseFloat(curr.auto_charges) || 0);

        acc.expenses += (parseFloat(curr.expenses_total) || 0);
        acc.rcmTax += (parseFloat(curr.rcm_tax_payable) || 0);
        return acc;
    }, {
        qtyByUnit: {},
        taxable: 0,
        cgst: 0,
        sgst: 0,
        billValue: 0,
        freight: 0,
        loading: 0,
        unloading: 0,
        auto: 0,
        expenses: 0,
        rcmTax: 0
    });

    const formatCurrency = (amount) => `Rs. ${parseFloat(amount || 0).toFixed(2)}`;

    const getQtyStringExport = (qtyByUnit) => {
        return Object.entries(qtyByUnit)
            .map(([unit, qty]) => `${qty} ${unit}`)
            .join('\n');
    };

    const getReportDateRange = () => {
        if (filters.month !== 'all' && filters.year !== 'all') {
            const startDate = `01-${String(filters.month).padStart(2, '0')}-${filters.year}`;
            const lastDay = new Date(filters.year, filters.month, 0).getDate();
            const endDate = `${lastDay}-${String(filters.month).padStart(2, '0')}-${filters.year}`;
            return `${startDate} TO ${endDate}`;
        } else if (filters.year !== 'all') {
            return `01-01-${filters.year} TO 31-12-${filters.year}`;
        } else {
            return "ALL DATES";
        }
    };

    // Helper to format currency string for Excel
    const formatExcelCurrency = (val) => `Rs. ${parseFloat(val || 0).toFixed(2)}`;

    const exportToExcel = () => {
        const companyName = company ? company.name.toUpperCase() : 'COMPANY';
        const dateRange = getReportDateRange();
        const statementLine = `PURCHASE STATEMENT AS ON ${dateRange}`;

        // Define Headers
        const headers = [
            'Date', 'Bill No', 'Received Date', 'Party Name', 'GST No',
            'HSN Code', 'Quantity', 'Taxable Value', 'CGST', 'SGST', 'Bill Value'
        ];

        const data = [];

        // Add Title Rows
        data.push([companyName]);
        data.push([statementLine]);
        data.push([]); // Empty row
        data.push(headers);

        purchases.forEach(p => {
            // Row 1: Main Details
            data.push([
                formatDate(p.date),
                p.bill_no,
                formatDate(p.received_date),
                p.party_name,
                p.gst_number,
                p.hsn_code || '-',
                `${p.quantity || 0} ${p.unit || ''}`,
                formatExcelCurrency(p.taxable_value),
                formatExcelCurrency(p.cgst),
                formatExcelCurrency(p.sgst),
                formatExcelCurrency(p.bill_value)
            ]);

            // Row 2: Expense Details (Start from Column 1)
            data.push([
                'Freight:', formatExcelCurrency(p.freight_charges),
                'Loading:', formatExcelCurrency(p.loading_charges),
                'Unloading:', formatExcelCurrency(p.unloading_charges),
                'Auto:', formatExcelCurrency(p.auto_charges),
                'Exp Total:', formatExcelCurrency(p.expenses_total),
                'RCM (5%):', formatExcelCurrency(p.rcm_tax_payable)
            ]);
        });

        // Add Total Row
        data.push([
            'TOTAL', '', '', '', '', '',
            getQtyStringExport(totals.qtyByUnit),
            formatExcelCurrency(totals.taxable),
            formatExcelCurrency(totals.cgst),
            formatExcelCurrency(totals.sgst),
            formatExcelCurrency(totals.billValue)
        ]);

        // Add Expense Totals Row
        data.push([
            'Freight:', formatExcelCurrency(totals.freight),
            'Loading:', formatExcelCurrency(totals.loading),
            'Unloading:', formatExcelCurrency(totals.unloading),
            'Auto:', formatExcelCurrency(totals.auto),
            'Exp Total:', formatExcelCurrency(totals.expenses),
            'RCM Total:', formatExcelCurrency(totals.rcmTax)
        ]);

        const ws = XLSX.utils.aoa_to_sheet(data);

        // Adjust Column Widths
        ws['!cols'] = [
            { wch: 25 }, // Date / Freight Label (Increased)
            { wch: 25 }, // Bill No / Freight Amt (Increased)
            { wch: 15 }, // Rec Date / Loading Label
            { wch: 25 }, // Party / Loading Amt
            { wch: 20 }, // GST / Unloading Label (Increased from 15)
            { wch: 15 }, // HSN / Unloading Amt
            { wch: 20 }, // Qty / Auto Label (Increased)
            { wch: 22 }, // Taxable / Auto Amt (Increased from 20)
            { wch: 15 }, // CGST / Exp Label
            { wch: 15 }, // SGST / Exp Amt
            { wch: 20 }, // Bill Value / RCM Label
            { wch: 20 }, // Col 11: RCM Amt
        ];

        // Merge headers
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }); // Company Name
        ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }); // Statement Line

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Purchases");
        // Write to buffer instead of file directly
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });

        downloadBlob(blob, "Purchase_Statement.xlsx");
    };

    const exportToPDF = () => {
        try {
            const doc = new jsPDF('l');
            const companyName = company ? company.name.toUpperCase() : 'COMPANY';
            const dateRange = getReportDateRange();
            const statementLine = `PURCHASE STATEMENT AS ON ${dateRange}`;

            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. Company Name
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            const companyWidth = doc.getTextWidth(companyName);
            doc.text(companyName, (pageWidth - companyWidth) / 2, 15);

            // 2. Statement Line
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const statementWidth = doc.getTextWidth(statementLine);
            doc.text(statementLine, (pageWidth - statementWidth) / 2, 22);

            // Define 12-column grid
            // Header: Bill Value spans last 2 cols
            const tableHead = [
                [
                    "Date", "Bill No", "Received Date", "Party Name", "GST No", "HSN Code",
                    "Qty", "Taxable Value", "CGST", "SGST", { content: "Bill Value", colSpan: 2, styles: { halign: 'center' } }
                ]
            ];

            const tableRows = [];

            purchases.forEach(p => {
                // Row 1: Main Data
                // Ends with Bill Value spanning 2 cols
                tableRows.push([
                    formatDate(p.date),
                    p.bill_no,
                    formatDate(p.received_date),
                    p.party_name || '-',
                    p.gst_number || '-',
                    p.hsn_code || '-',
                    `${p.quantity || 0} ${p.unit || ''}`,
                    formatCurrency(p.taxable_value),
                    formatCurrency(p.cgst),
                    formatCurrency(p.sgst),
                    {
                        content: `${formatCurrency(p.bill_value)}${p.round_off ? `\n(R.O: ${parseFloat(p.round_off).toFixed(2)})` : ''}`,
                        colSpan: 2,
                        styles: { fontStyle: 'bold', halign: 'right' }
                    }
                ]);

                // Row 2: Expenses (12 cells align with columns)
                tableRows.push([
                    { content: "Freight:", styles: { fontStyle: 'bold' } },
                    formatCurrency(p.freight_charges),
                    { content: "Loading:", styles: { fontStyle: 'bold' } },
                    formatCurrency(p.loading_charges),
                    { content: "Unloading:", styles: { fontStyle: 'bold' } },
                    formatCurrency(p.unloading_charges),
                    { content: "Auto:", styles: { fontStyle: 'bold' } },
                    formatCurrency(p.auto_charges),
                    { content: "Exp Total:", styles: { fontStyle: 'bold' } },
                    formatCurrency(p.expenses_total),
                    { content: "RCM(5%):", styles: { fontStyle: 'bold' } },
                    formatCurrency(p.rcm_tax_payable)
                ]);
            });

            // Calculate Totals
            const totalTaxable = purchases.reduce((sum, p) => sum + (parseFloat(p.taxable_value) || 0), 0);
            const totalCGST = purchases.reduce((sum, p) => sum + (parseFloat(p.cgst) || 0), 0);
            const totalSGST = purchases.reduce((sum, p) => sum + (parseFloat(p.sgst) || 0), 0);
            const totalBill = purchases.reduce((sum, p) => sum + (parseFloat(p.bill_value) || 0), 0);
            const totalQty = purchases.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0); // Simple sum

            // Totals Row 1
            tableRows.push([
                { content: "TOTAL", colSpan: 6, styles: { halign: 'center', fontStyle: 'bold' } },
                { content: `${totalQty} units`, styles: { fontStyle: 'bold' } }, // Qty col 7
                { content: formatCurrency(totalTaxable), styles: { fontStyle: 'bold', halign: 'right' } }, // Taxable col 8
                { content: formatCurrency(totalCGST), styles: { fontStyle: 'bold', halign: 'right' } }, // CGST col 9
                { content: formatCurrency(totalSGST), styles: { fontStyle: 'bold', halign: 'right' } }, // SGST col 10
                { content: formatCurrency(totalBill), colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } } // Bill Value col 11-12
            ]);

            // Totals Row 2 (Expenses)
            tableRows.push([
                { content: "Freight:", styles: { fontStyle: 'bold' } },
                formatCurrency(totals.freight),
                { content: "Loading:", styles: { fontStyle: 'bold' } },
                formatCurrency(totals.loading),
                { content: "Unloading:", styles: { fontStyle: 'bold' } },
                formatCurrency(totals.unloading),
                { content: "Auto:", styles: { fontStyle: 'bold' } },
                formatCurrency(totals.auto),
                { content: "Exp Total:", styles: { fontStyle: 'bold' } },
                formatCurrency(totals.expenses),
                { content: "RCM Total:", styles: { fontStyle: 'bold' } },
                formatCurrency(totals.rcmTax)
            ]);

            autoTable(doc, {
                head: tableHead,
                body: tableRows,
                startY: 30,
                theme: 'grid',
                styles: {
                    fontSize: 7, // Smaller font to fit 12 cols
                    cellPadding: 1,
                    overflow: 'linebreak',
                    lineColor: [0, 0, 0], // Black borders
                    lineWidth: 0.1,
                    textColor: [0, 0, 0]
                },
                headStyles: {
                    fillColor: [22, 163, 74], // Green-600 (Professional Green)
                    textColor: [255, 255, 255], // White Text
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: 0.1,
                    lineColor: [22, 163, 74]
                },
                columnStyles: {
                    0: { cellWidth: 20 }, // Date
                    1: { cellWidth: 22 }, // Bill No
                    2: { cellWidth: 20 }, // Rec Date
                    3: { cellWidth: 'auto' }, // Party Name
                    4: { cellWidth: 28 }, // GST No
                    5: { cellWidth: 18 }, // HSN
                    6: { cellWidth: 18 }, // Qty
                    7: { halign: 'right', cellWidth: 22 }, // Taxable
                    8: { halign: 'right', cellWidth: 20 }, // CGST
                    9: { halign: 'right', cellWidth: 22 }, // SGST
                    10: { halign: 'right', cellWidth: 20 }, // RCM/Bill Part 1
                    11: { halign: 'right', cellWidth: 20 }  // RCM/Bill Part 2
                },
                didParseCell: function (data) {
                    // Zebra Striping Logic for 2-row Groups
                    // Main Row (Even index in tableRows array) = White or Light Green
                    // Expense Row (Odd index) = Same as Main Row to keep them grouped visually

                    const actualRowIndex = Math.floor(data.row.index / 2); // Group every 2 rows

                    if (data.section === 'body') {
                        if (actualRowIndex % 2 === 1) {
                            data.cell.styles.fillColor = [240, 253, 244]; // Very Light Green (Green-50)
                        } else {
                            data.cell.styles.fillColor = [255, 255, 255]; // White
                        }
                    }

                    // Highlight Total Row (Last 2 rows)
                    if (data.row.index >= tableRows.length - 2) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [220, 252, 231]; // Green-100 (Slightly darker for Total)
                    }
                },
                didDrawPage: function (data) {
                    // Footer
                    const str = 'Page ' + doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(100);
                    doc.text(str, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);
                    doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, doc.internal.pageSize.getHeight() - 10);
                }
            });

            doc.save("Purchase_Statement.pdf");
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("Failed to export PDF. See console for details.");
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <FileDown className="text-emerald-600" /> Monthly Purchase Report
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={exportToExcel} className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors shadow-sm">
                            Excel
                        </button>
                        <button onClick={exportToPDF} className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors shadow-sm">
                            PDF
                        </button>
                        <button onClick={fetchPurchases} className="px-3 py-2 bg-emerald-100 text-emerald-700 text-sm rounded hover:bg-emerald-200 transition-colors shadow-sm">
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                        <Filter size={18} />
                        <span className="text-sm font-medium">Filters:</span>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-2 rounded border shadow-sm">
                        <select
                            name="month"
                            value={filters.month}
                            onChange={handleFilterChange}
                            className="bg-transparent outline-none text-sm font-medium text-gray-700"
                        >
                            <option value="all">All Months</option>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                        <select
                            name="year"
                            value={filters.year}
                            onChange={handleFilterChange}
                            className="bg-transparent outline-none text-sm font-medium text-gray-700 border-l pl-2"
                        >
                            <option value="all">All Years</option>
                            {Array.from({ length: 5 }, (_, i) => {
                                const y = new Date().getFullYear() - 2 + i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <select
                            name="party"
                            value={filters.party}
                            onChange={handleFilterChange}
                            className="w-full p-2 text-sm border-gray-200 rounded border shadow-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 bg-white"
                        >
                            <option value="">All Parties</option>
                            {parties.map(party => (
                                <option key={party.id} value={party.name}>{party.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-[180px]">
                        <select
                            name="hsn"
                            value={filters.hsn}
                            onChange={handleFilterChange}
                            className="w-full p-2 text-sm border-gray-200 rounded border shadow-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 bg-white"
                        >
                            <option value="">All HSN Codes</option>
                            {hsnList.map(item => (
                                <option key={item.id} value={item.code}>{item.code} - {item.description}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Value</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RCM Tax</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan="9" className="text-center py-8 text-gray-500">Loading data...</td></tr>
                        ) : purchases.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(p.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.bill_no}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="font-medium text-gray-900">{p.party_name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-500">{p.gst_number || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.quantity} {p.unit}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {p.taxable_value}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">Rs. {p.bill_value}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {p.expenses_total}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {p.rcm_tax_payable}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => onEdit && onEdit(p)}
                                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!isLoading && purchases.length === 0 && (
                            <tr><td colSpan="9" className="text-center py-8 text-gray-500">No purchases found.</td></tr>
                        )}
                        {/* Summary Footer */}
                        {!isLoading && purchases.length > 0 && (
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                <td colSpan={3} className="px-6 py-4 text-right text-gray-700">TOTALS:</td>
                                <td className="px-6 py-4 whitespace-pre-line text-sm text-gray-900">
                                    {Object.entries(totals.qtyByUnit).map(([unit, qty]) => `${qty} ${unit}`).join('\n')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {totals.taxable.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {totals.billValue.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {totals.expenses.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {totals.rcmTax.toFixed(2)}</td>
                                <td></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default PurchaseReport;
