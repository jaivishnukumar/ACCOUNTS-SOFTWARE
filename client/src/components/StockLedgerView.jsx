import PropTypes from 'prop-types';
import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Save, FileText, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_Base = '/api';

function StockLedgerView({ id, products, financialYear, onRemove, showRemove }) {
    // 1. Local State for Filters
    const getFYStartDate = () => {
        if (!financialYear) return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const parts = financialYear.split('-');
        if (parts.length === 2) return `${parts[0]}-04-01`;
        return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    };

    const [filters, setFilters] = useState({
        product_id: '',
        start_date: getFYStartDate(),
        end_date: new Date().toISOString().split('T')[0]
    });

    // Unit Display State
    const [unitDisplayMode, setUnitDisplayMode] = useState('primary'); // 'primary', 'secondary'

    useEffect(() => {
        setFilters(prev => ({ ...prev, start_date: getFYStartDate() }));
    }, [financialYear]);

    const [ledgerData, setLedgerData] = useState({});
    const [loading, setLoading] = useState(false);

    // 2. Data Fetching
    const fetchLedger = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(filters);
            const res = await axios.get(`${API_Base}/stock/ledger?${params}`);

            let rawData = [];
            let openingMap = {};

            if (res.data && res.data.ledger) {
                console.log("API RESPONSE SAMPLE:", res.data.ledger[0]); // DEBUG
                rawData = res.data.ledger;
                openingMap = res.data.opening_balances || {};
            } else if (Array.isArray(res.data)) {
                rawData = res.data;
            } else if (res.data && res.data.transactions) {
                rawData = res.data.transactions;
            }

            const grouped = {};
            rawData.forEach(row => {
                const pName = row.product_name || 'Unknown Product';
                if (!grouped[pName]) grouped[pName] = [];
                grouped[pName].push(row);
            });

            const processedGroups = {};
            Object.keys(grouped).sort().forEach(pName => {
                const rows = grouped[pName];
                const pId = rows[0]?.product_id;

                // Robust lookup
                let openVal = 0;
                if (openingMap[pId] !== undefined) openVal = openingMap[pId];
                else if (openingMap[String(pId)] !== undefined) openVal = openingMap[String(pId)];

                let running = parseFloat(openVal);

                processedGroups[pName] = rows.map(row => {
                    const currentOpening = running;
                    const qtyIn = parseFloat(row.quantity_in) || 0;
                    const qtyOut = parseFloat(row.quantity_out) || 0;
                    running = running + qtyIn - qtyOut; // In Primary Units

                    return { ...row, opening_stock: currentOpening, closing_stock: running };
                });
            });

            setLedgerData(processedGroups);
        } catch (error) {
            console.error("Error fetching ledger", error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    // 3. Helpers
    const fmt = (val, row) => {
        let numVal = parseFloat(val);
        if (isNaN(numVal) && val !== 0) return '-';
        if (numVal === 0 && (val === 0 || val === '0')) {
            // Zero handling - continue to format 0
        } else if (numVal === 0) {
            return '-';
        }

        // --- UNIT CONVERSION LOGIC ---
        let displayUnit = row.primary_unit || row.unit || '';
        let displayVal = numVal;

        if (unitDisplayMode === 'secondary' && row.has_dual_units && row.conversion_rate) {
            const rate = parseFloat(row.conversion_rate);
            // DEBUG LOG
            // console.log(`FMT DEBUG: Mode=${unitDisplayMode}, Dual=${row.has_dual_units}, Rate=${row.conversion_rate}, Parsed=${rate}, Num=${numVal}`);

            if (rate > 0) {
                const pUnit = (row.primary_unit || '').toUpperCase();
                const sUnit = (row.secondary_unit || '').toUpperCase();

                const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

                const isSecSmall = smallUnits.some(u => sUnit.includes(u));
                const isPrimLarge = largeUnits.some(u => pUnit.includes(u));
                // Also check reverse
                const isSecLarge = largeUnits.some(u => sUnit.includes(u));
                const isPrimSmall = smallUnits.some(u => pUnit.includes(u));

                if (isSecSmall && isPrimLarge) {
                    // Base (Large) -> Sec (Small) : MULTIPLY
                    // 1 Bag = 50 Kg. 10 Bags = 500 Kg.
                    displayVal = numVal * rate;
                } else if (isSecLarge && isPrimSmall) {
                    // Base (Small) -> Sec (Large) : DIVIDE
                    // 1 Bag = 50 Kg. 100 Kg = 2 Bags.
                    displayVal = numVal / rate;
                } else {
                    // Ambiguous or Same Category - Default to Multiply as per standard "Unit of Measure" definitions
                    displayVal = numVal * rate;
                }

                displayUnit = row.secondary_unit || '';
            }
        }

        const unitStr = displayUnit.toUpperCase();
        const needsDecimal = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER'].some(x => unitStr.includes(x));

        let formattedStr = needsDecimal ? displayVal.toFixed(2) : Math.round(displayVal).toString();

        return `${formattedStr} ${displayUnit}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getDescription = (row, productName) => {
        if (row.description) return row.description;
        if (row.transaction_type === 'CONSUMPTION') return `Consumption`;
        if (row.transaction_type === 'PRODUCTION') return `Produced ${productName}`;
        if (row.transaction_type === 'SALE') return 'Sale (Unknown)';
        return row.transaction_type;
    };

    // 4. Export Functions
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        if (Object.keys(ledgerData).length === 0) {
            alert("No data to export");
            return;
        }

        Object.entries(ledgerData).forEach(([productName, rows]) => {
            const sheetData = rows.map(r => {
                let op = parseFloat(r.opening_stock) || 0;
                let receipts = parseFloat(r.quantity_in) || 0;
                const out = parseFloat(r.quantity_out) || 0;

                // Treat 'OPENING' transactions as part of Opening Stock, not Receipts
                if (r.transaction_type === 'OPENING') {
                    op += receipts;
                    receipts = 0;
                }

                const totalAvail = op + receipts;
                const close = parseFloat(r.closing_stock) || 0;

                let sales = 0;
                let issued = 0;
                if (out > 0) {
                    if (r.transaction_type === 'SALE') sales = out;
                    else issued = out;
                }

                return {
                    Date: formatDate(r.date),
                    Description: getDescription(r, productName),
                    BillNo: r.bill_no || '-',
                    OpStock: fmt(op, r),
                    Receipts: receipts > 0 ? fmt(receipts, r) : '-',
                    TotalAvail: fmt(totalAvail, r),
                    Sales: sales > 0 ? fmt(sales, r) : '-',
                    Issued: issued > 0 ? fmt(issued, r) : '-',
                    Closing: fmt(close, r),
                    Unit: unitDisplayMode === 'secondary' && r.has_dual_units ? r.secondary_unit : (r.primary_unit || r.unit)
                };
            });

            // Sanitize sheet name (max 31 chars, no special chars)
            const sheetName = productName.replace(/[:\/?*\[\]\\]/g, "").substring(0, 31);
            const ws = XLSX.utils.json_to_sheet(sheetData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        XLSX.writeFile(wb, `Stock_Ledger_${filters.start_date}_to_${filters.end_date}.xlsx`);
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF('l');

            Object.entries(ledgerData).forEach(([productName, rows], index) => {
                if (index > 0) doc.addPage();

                doc.setFontSize(14);
                // Removed (Secondary Units) / (Primary Units) text
                doc.text(`Stock Ledger: ${productName}`, 14, 15);
                doc.setFontSize(10);
                doc.text(`${filters.start_date} to ${filters.end_date}`, 14, 22);

                const tableBody = rows.map(r => {
                    let op = parseFloat(r.opening_stock) || 0;
                    let receipts = parseFloat(r.quantity_in) || 0;
                    const out = parseFloat(r.quantity_out) || 0;

                    // Treat 'OPENING' transactions as part of Opening Stock, not Receipts
                    if (r.transaction_type === 'OPENING') {
                        op += receipts;
                        receipts = 0;
                    }

                    const totalAvail = op + receipts;
                    const close = parseFloat(r.closing_stock) || 0;

                    let sales = 0;
                    let issued = 0;
                    if (out > 0) {
                        if (r.transaction_type === 'SALE') sales = out;
                        else issued = out;
                    }

                    return [
                        formatDate(r.date),
                        getDescription(r, productName),
                        r.bill_no || '-',
                        fmt(op, r),
                        receipts > 0 ? fmt(receipts, r) : '-',
                        fmt(totalAvail, r),
                        sales > 0 ? fmt(sales, r) : '-',
                        issued > 0 ? fmt(issued, r) : '-',
                        fmt(close, r)
                    ];
                });

                autoTable(doc, {
                    startY: 25,
                    head: [['Date', 'Description', 'Bill', 'Op Stock', 'Receipts', 'Total Avail', 'Sales', 'Issued', 'Closing']],
                    body: tableBody,
                    styles: { fontSize: 8 },
                    columnStyles: {
                        0: { cellWidth: 20 },
                        1: { cellWidth: 50 },
                        2: { cellWidth: 20 }
                    }
                });
            });

            doc.save(`Stock_Ledger_${filters.start_date}_to_${filters.end_date}.pdf`);
        } catch (err) {
            console.error("PDF Export Error:", err);
            alert("Failed to export PDF: " + err.message);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6">
            {/* Header / Filter Bar */}
            <div className="bg-gray-50 p-4 border-b border-gray-200">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Product</label>
                        <select
                            value={filters.product_id}
                            onChange={(e) => setFilters({ ...filters, product_id: e.target.value })}
                            className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-purple-500"
                        >
                            <option value="">All Products</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Start</label>
                        <input type="date" value={filters.start_date} onChange={e => setFilters({ ...filters, start_date: e.target.value })} className="p-2 text-sm border rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">End</label>
                        <input type="date" value={filters.end_date} onChange={e => setFilters({ ...filters, end_date: e.target.value })} className="p-2 text-sm border rounded" />
                    </div>
                    {/* Unit Toggle */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Units</label>
                        <select
                            value={unitDisplayMode}
                            onChange={(e) => setUnitDisplayMode(e.target.value)}
                            className="p-2 text-sm border rounded"
                        >
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={fetchLedger} className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Refresh">
                            <RefreshCw size={18} />
                        </button>
                        <button onClick={handleExportExcel} className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Export Excel">
                            <FileText size={18} />
                        </button>
                        <button onClick={handleExportPDF} className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Export PDF">
                            <Download size={18} />
                        </button>
                        {showRemove && (
                            <button onClick={() => onRemove(id)} className="p-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-300" title="Remove View">
                                <span className="text-xl font-bold leading-none">&times;</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-0">
                {Object.keys(ledgerData).length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        {loading ? 'Loading...' : 'No data found. Select filters or Refresh.'}
                    </div>
                ) : (
                    Object.entries(ledgerData).map(([productName, rows]) => (
                        <div key={productName} className="border-b last:border-0">
                            <div className="bg-purple-50 px-4 py-2 font-bold text-purple-800 text-sm flex justify-between">
                                {productName} <span className="bg-white px-2 rounded-full text-xs border text-gray-600">{rows.length} Txns</span>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-gray-500 font-semibold">Date</th>
                                            <th className="px-4 py-2 text-left text-gray-500 font-semibold">Description</th>
                                            <th className="px-4 py-2 text-left text-gray-500 font-semibold">Bill</th>
                                            <th className="px-4 py-2 text-right text-gray-500 font-semibold text-blue-600 bg-blue-50/50">Op Stock</th>
                                            <th className="px-4 py-2 text-right text-gray-500 font-semibold text-green-600 bg-green-50/50">Receipts</th>
                                            <th className="px-4 py-2 text-right text-gray-500 font-semibold bg-gray-100/50">Total Avail</th>
                                            <th className="px-4 py-2 text-right text-gray-500 font-semibold text-red-600 bg-red-50/50">Sales</th>
                                            <th className="px-4 py-2 text-right text-gray-500 font-semibold text-orange-600 bg-orange-50/50">Issued (Own)</th>
                                            <th className="px-4 py-2 text-right text-gray-500 font-semibold text-purple-600 bg-purple-50/50">Closing Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {rows.map((row, idx) => {
                                            let op = parseFloat(row.opening_stock) || 0;
                                            let receipts = parseFloat(row.quantity_in) || 0;
                                            const out = parseFloat(row.quantity_out) || 0;

                                            // Treat 'OPENING' transactions as part of Opening Stock, not Receipts
                                            if (row.transaction_type === 'OPENING') {
                                                op += receipts;
                                                receipts = 0;
                                            }

                                            const totalAvail = op + receipts;
                                            const close = parseFloat(row.closing_stock) || 0;

                                            // Split Sales vs Issued
                                            let sales = 0;
                                            let issued = 0;
                                            if (out > 0) {
                                                if (row.transaction_type === 'SALE') sales = out;
                                                else issued = out;
                                            }

                                            return (
                                                <tr key={idx} className="hover:bg-blue-50">
                                                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                                                    <td className="px-4 py-2 max-w-[200px] truncate" title={getDescription(row, productName)}>{getDescription(row, productName)}</td>
                                                    <td className="px-4 py-2 font-mono text-gray-400">{row.bill_no || '-'}</td>

                                                    <td className="px-4 py-2 text-right font-mono text-blue-600 bg-blue-50/30">{fmt(op, row)}</td>
                                                    <td className="px-4 py-2 text-right font-mono text-green-600 font-bold bg-green-50/30">
                                                        {receipts > 0 ? `+${fmt(receipts, row)}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-gray-500 bg-gray-100/30">{fmt(totalAvail, row)}</td>

                                                    <td className="px-4 py-2 text-right font-mono text-red-600 font-bold bg-red-50/30">
                                                        {sales > 0 ? `-${fmt(sales, row)}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-orange-600 font-bold bg-orange-50/30">
                                                        {issued > 0 ? `-${fmt(issued, row)}` : '-'}
                                                    </td>

                                                    <td className="px-4 py-2 text-right font-mono text-purple-700 font-bold bg-purple-50/30">{fmt(close, row)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

StockLedgerView.propTypes = {
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    products: PropTypes.array.isRequired,
    financialYear: PropTypes.string,
    onRemove: PropTypes.func.isRequired,
    showRemove: PropTypes.bool.isRequired
};

export default StockLedgerView;
