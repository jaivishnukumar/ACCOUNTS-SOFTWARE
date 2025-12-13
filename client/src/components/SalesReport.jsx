import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FileDown, Filter, Trash2, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const SALES_API_URL = '/api/sales';

function SalesReport({ onEdit, company }) {
    const [sales, setSales] = useState([]);
    const [parties, setParties] = useState([]);
    const [hsnList, setHsnList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState({
        month: new Date().getMonth() + 1, // Default current month
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

    const fetchSales = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (filters.month !== 'all') params.month = filters.month;
            if (filters.year !== 'all') params.year = filters.year;
            if (filters.hsn) params.hsn = filters.hsn;
            if (filters.party) params.party = filters.party;

            const response = await axios.get(SALES_API_URL, { params });
            setSales(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching sales:', error);
            setSales([]);
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchParties();
        fetchHSNCodes();
    }, [fetchParties, fetchHSNCodes]);

    useEffect(() => {
        // Debounce fetch for text inputs to avoid too many requests
        const timeoutId = setTimeout(() => {
            fetchSales();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [filters, fetchSales]);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this sale entry?')) {
            try {
                await axios.delete(`${SALES_API_URL}/${id}`);
                fetchSales();
            } catch (error) {
                console.error('Error deleting sale:', error);
                alert('Failed to delete sale');
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

    // Calculate Totals with Unit Grouping
    const totals = sales.reduce((acc, curr) => {
        // Group bags by unit
        const unit = curr.unit || ''; // Use stored unit or empty string
        const qty = parseInt(curr.bags) || 0;
        acc.qtyByUnit[unit] = (acc.qtyByUnit[unit] || 0) + qty;

        acc.billValue += (parseFloat(curr.bill_value) || 0);
        acc.cgst += (parseFloat(curr.cgst) || 0);
        acc.sgst += (parseFloat(curr.sgst) || 0);
        acc.total += (parseFloat(curr.total) || 0);
        return acc;
    }, { qtyByUnit: {}, billValue: 0, cgst: 0, sgst: 0, total: 0 });

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

    const exportToExcel = () => {
        console.log("Exporting to Excel...");
        if (!sales || sales.length === 0) {
            alert("No sales data available to export for the selected period.");
            return;
        }

        try {
            const companyName = company ? company.name.toUpperCase() : 'COMPANY';
            const dateRange = getReportDateRange();
            const statementLine = `SALES STATEMENT AS ON ${dateRange}`;

            const data = sales.map(s => ({
                Date: formatDate(s.date),
                'Bill No': String(s.bill_no).split('.')[0],
                'Party Name': s.party_name,
                'GST No': s.gst_number,
                'HSN Code': s.hsn_code || '-',
                'Quantity': `${s.bags || 0} ${s.unit || ''}`, // Show unit
                'Taxable Value': parseFloat(s.bill_value) || 0,
                'CGST': parseFloat(s.cgst) || 0,
                'SGST': parseFloat(s.sgst) || 0,
                'Total': parseFloat(s.total) || 0
            }));

            // Add Total Row
            data.push({
                Date: 'TOTAL',
                'Bill No': '',
                'Party Name': '',
                'GST No': '',
                'HSN Code': '',
                'Quantity': getQtyStringExport(totals.qtyByUnit),
                'Taxable Value': totals.billValue,
                'CGST': totals.cgst,
                'SGST': totals.sgst,
                'Total': totals.total
            });

            const ws = XLSX.utils.json_to_sheet(data, { origin: 'A3' }); // Start data at A3

            // Add Headers
            XLSX.utils.sheet_add_aoa(ws, [[companyName]], { origin: 'A1' });
            XLSX.utils.sheet_add_aoa(ws, [[statementLine]], { origin: 'A2' });

            // Merge headers
            if (!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }); // Company Name
            ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }); // Statement Line

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sales");
            XLSX.writeFile(wb, "Sales_Statement.xlsx");
        } catch (e) {
            console.error(e);
            alert("Failed to export Excel: " + e.message);
        }
    };

    const exportToPDF = () => {
        console.log("Exporting to PDF...");
        if (!sales || sales.length === 0) {
            alert("No sales data available to export for the selected period.");
            return;
        }

        try {
            const doc = new jsPDF('l');
            const companyName = company ? company.name.toUpperCase() : 'COMPANY';
            const dateRange = getReportDateRange();
            const statementLine = `SALES STATEMENT AS ON ${dateRange}`;

            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. Company Name (Bold, Larger)
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            const companyWidth = doc.getTextWidth(companyName);
            doc.text(companyName, (pageWidth - companyWidth) / 2, 15);

            // 2. Statement Line (Normal, Smaller)
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const statementWidth = doc.getTextWidth(statementLine);
            doc.text(statementLine, (pageWidth - statementWidth) / 2, 22);

            const tableColumn = ["Date", "Bill No", "Party Name", "GST No", "HSN Code", "Quantity", "Taxable", "CGST", "SGST", "Total"];
            const tableRows = sales.map(s => [
                formatDate(s.date),
                String(s.bill_no).split('.')[0],
                s.party_name || '-',
                s.gst_number || '-',
                s.hsn_code || '-',
                `${s.bags || 0} ${s.unit || ''}`, // Show unit
                formatCurrency(s.bill_value),
                formatCurrency(s.cgst),
                formatCurrency(s.sgst),
                formatCurrency(s.total)
            ]);

            // Add Total Row
            tableRows.push([
                'TOTAL', '', '', '', '',
                getQtyStringExport(totals.qtyByUnit),
                formatCurrency(totals.billValue),
                formatCurrency(totals.cgst),
                formatCurrency(totals.sgst),
                formatCurrency(totals.total)
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 30,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: [41, 128, 185],
                    textColor: 255,
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' }, // Date
                    1: { cellWidth: 20, halign: 'center' }, // Bill No
                    2: { cellWidth: 'auto', halign: 'center' }, // Party Name
                    3: { halign: 'center' }, // GST No
                    4: { halign: 'center' }, // HSN Code
                    5: { cellWidth: 25, halign: 'center' }, // Quantity
                    6: { halign: 'right' }, // Taxable
                    7: { halign: 'right' }, // CGST
                    8: { halign: 'right' }, // SGST
                    9: { fontStyle: 'bold', halign: 'right' } // Total
                }
            });

            doc.save("Sales_Statement.pdf");
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("Failed to export PDF: " + error.message);
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <FileDown className="text-blue-600" /> Monthly Sales Report
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={exportToExcel} className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors shadow-sm">
                            Excel
                        </button>
                        <button onClick={exportToPDF} className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors shadow-sm">
                            PDF
                        </button>
                        <button onClick={fetchSales} className="px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors shadow-sm">
                            Refresh
                        </button>
                    </div>
                </div>

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
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <select
                            name="party"
                            value={filters.party}
                            onChange={handleFilterChange}
                            className="w-full p-2 text-sm border-gray-200 rounded border shadow-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white"
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
                            className="w-full p-2 text-sm border-gray-200 rounded border shadow-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white"
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HSN</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan="9" className="text-center py-8 text-gray-500">Loading data...</td></tr>
                        ) : sales.map((sale) => (
                            <tr key={sale.id || Math.random()} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(sale.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{String(sale.bill_no).split('.')[0]}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="font-medium text-gray-900">{sale.party_name || 'Unknown Party'}</div>
                                    <div className="text-xs text-gray-500">{sale.gst_number || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.hsn_code || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.bags || 0} {sale.unit || ''}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.tax_rate ?? 0}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {sale.bill_value}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">Rs. {sale.total}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => onEdit && onEdit(sale)}
                                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(sale.id)}
                                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {!isLoading && sales.length === 0 && (
                            <tr><td colSpan="9" className="text-center py-8 text-gray-500">No sales found. Try adjusting filters or add a new entry.</td></tr>
                        )}
                        {/* Summary Footer in UI */}
                        {!isLoading && sales.length > 0 && (
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                <td colSpan={4} className="px-6 py-4 text-right text-gray-700">TOTALS:</td>
                                <td className="px-6 py-4 whitespace-pre-line text-sm text-gray-900">
                                    {Object.entries(totals.qtyByUnit).map(([unit, qty]) => `${qty} ${unit}`).join('\n')}
                                </td>
                                <td></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {totals.billValue.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {totals.total.toFixed(2)}</td>
                                <td></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default SalesReport;
