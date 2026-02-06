import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Package, Save, History, Plus, Trash2, SlidersHorizontal, FlaskConical } from 'lucide-react';
import StockAdjustmentModal from './StockAdjustmentModal';
import ProductFormulas from './ProductFormulas';
import StockLedgerView from './StockLedgerView';

const API_Base = '/api';

function StockRecording({ financialYear }) {
    const [activeTab, setActiveTab] = useState('production'); // 'production', 'status', 'ledger', 'formulas'
    const [products, setProducts] = useState([]);
    const [stockStatus, setStockStatus] = useState([]);
    const [unitDisplayMode, setUnitDisplayMode] = useState('both'); // 'both', 'primary', 'secondary'

    // Formula Tab State
    const [selectedFormulaProdId, setSelectedFormulaProdId] = useState('');

    // Ledger State
    const [ledgerViewIds, setLedgerViewIds] = useState([1]); // Default one view

    // Production Form State
    const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
    const [outputProductId, setOutputProductId] = useState('');
    const [outputQuantity, setOutputQuantity] = useState('');
    const [batchNo, setBatchNo] = useState('');
    const [inputs, setInputs] = useState([{ product_id: '', quantity: '' }]);
    const [notes, setNotes] = useState('');

    // Transfer Modal State
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [prodRes, stockRes] = await Promise.all([
                axios.get(`${API_Base}/products`),
                axios.get(`${API_Base}/stock`)
            ]);
            setProducts(prodRes.data);
            setStockStatus(stockRes.data);
        } catch (error) {
            console.error("Error fetching data", error);
        }
    }, []);



    useEffect(() => {
        // ALWAYS fetch products/status to ensure lookups work
        fetchData();
    }, [activeTab, fetchData]);


    const handleAddInputRow = () => {
        setInputs([...inputs, { product_id: '', quantity: '' }]);
    };

    const handleRemoveInputRow = (index) => {
        const newInputs = [...inputs];
        newInputs.splice(index, 1);
        setInputs(newInputs);
    };

    const handleInputChange = (index, field, value) => {
        const newInputs = [...inputs];
        newInputs[index][field] = value;
        setInputs(newInputs);
    };

    // Auto-fill ingredients from formula
    const autoFillIngredients = async (prodId) => {
        try {
            const res = await axios.get(`${API_Base}/product-formulas/${prodId}`);
            if (res.data && res.data.length > 0) {
                // Map formula ingredients to input rows
                const formulaInputs = res.data.map(item => ({
                    product_id: item.ingredient_id,
                    quantity: item.quantity, // This is per-unit quantity.
                    // For total input, we need to multiply by output quantity dynamically?
                    // Usually user enters Output Qty, then we calculate Input.
                    // But here we just pre-fill the rows.
                    // Ideally we should calculate based on current Output Qty.
                    // But for now, let's keep it simple or set 0 and let user type?
                    // Actually, let's just prefill rows with 1 unit logic or let backend handle?
                    // The UI normally auto-calculates if logic exists, but here we are just filling rows.
                    unit_mode: item.unit_type || 'primary'
                }));
                // We keep quantity empty or 0 because it depends on Batch Size.
                // Or we can pre-fill based on '1' Batch?
                // Let's just fill product IDs.
                setInputs(formulaInputs.map(i => ({ ...i, quantity: '' })));
            }
        } catch (error) {
            console.error("Error fetching formula", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                date: productionDate,
                output: {
                    product_id: outputProductId,
                    quantity: outputQuantity,
                    batch_no: batchNo
                },
                inputs: inputs.filter(i => i.product_id && i.quantity),
                notes
            };

            await axios.post(`${API_Base}/production`, payload);
            alert('Production recorded successfully');

            // Reset Form (keep date)
            setOutputProductId('');
            setOutputQuantity('');
            setBatchNo('');
            setInputs([{ product_id: '', quantity: '' }]);
            setNotes('');
            fetchData(); // Refresh stock
        } catch (error) {
            console.error(error);
            alert('Error recording production');
        }
    };

    // Ledger Managers
    const addLedgerView = () => {
        setLedgerViewIds(prev => [...prev, Date.now()]);
    };

    const removeLedgerView = (id) => {
        setLedgerViewIds(prev => prev.filter(vid => vid !== id));
    };

    return (
        <div className="space-y-6">
            {/* --- DASHBOARD HEADER --- */}
            <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 text-purple-700">
                    <Package size={28} />
                    <h2 className="text-xl font-bold">Stock & Manufacturing</h2>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAdjustmentModalOpen(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <SlidersHorizontal size={16} />
                        Adjust / Transfer
                    </button>
                    <div className="w-px bg-gray-300 mx-2"></div>
                    <button
                        onClick={() => setActiveTab('production')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'production' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Production Entry
                    </button>
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'status' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Current Stock
                    </button>
                    <button
                        onClick={() => setActiveTab('formulas')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'formulas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FlaskConical size={18} />
                        Formulas (BOM)
                    </button>
                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'ledger' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <History size={18} />
                        Stock Ledger
                    </button>
                </div>
            </div>

            {/* --- CONTENT --- */}
            {activeTab === 'production' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Record Production</h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Top Row: Date, Product, Qty, Batch */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label htmlFor="productionDate" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    id="productionDate"
                                    type="date"
                                    required
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={productionDate}
                                    onChange={e => setProductionDate(e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="outputProduct" className="block text-sm font-medium text-gray-700 mb-1">Output Product (Made)</label>
                                <select
                                    id="outputProduct"
                                    required
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={outputProductId}
                                    onChange={e => {
                                        const pid = e.target.value;
                                        setOutputProductId(pid);
                                        if (pid) autoFillIngredients(pid);
                                    }}
                                >
                                    <option value="">Select Product...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.packing_type})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="outputQty" className="block text-sm font-medium text-gray-700 mb-1">Output Quantity</label>
                                <input
                                    id="outputQty"
                                    type="number"
                                    required
                                    step="0.01"
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={outputQuantity}
                                    onChange={e => {
                                        setOutputQuantity(e.target.value);
                                    }}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="batchNo" className="block text-sm font-medium text-gray-700 mb-1">Batch / Lot No</label>
                                <input
                                    id="batchNo"
                                    type="text"
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={batchNo}
                                    onChange={e => setBatchNo(e.target.value)}
                                    placeholder="Auto-generated if empty"
                                />
                            </div>
                            <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <input
                                    id="notes"
                                    type="text"
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Optional remarks"
                                />
                            </div>
                        </div>

                        {/* Ingredients Section */}
                        <div className="border-t border-gray-100 pt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-gray-700">Input Materials (Consumed)</h4>
                                <button
                                    type="button"
                                    onClick={handleAddInputRow}
                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                                >
                                    <Plus size={16} /> Add Item
                                </button>
                            </div>

                            <div className="space-y-3">
                                {inputs.map((input, index) => (
                                    <div key={input._id || index} className="flex gap-4 items-center animate-fade-in-up">
                                        <div className="flex-1">
                                            <label htmlFor={`input-prod-${index}`} className="sr-only">Input Material</label>
                                            <select
                                                id={`input-prod-${index}`}
                                                required
                                                className="w-full p-2 border border-gray-200 rounded-md text-sm"
                                                value={input.product_id}
                                                onChange={e => handleInputChange(index, 'product_id', e.target.value)}
                                            >
                                                <option value="">Select Material...</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.packing_type}) {p.current_stock ? `[Stock: ${p.current_stock}]` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-24">
                                            <select
                                                className="w-full p-2 border border-gray-200 rounded-md text-sm bg-gray-50"
                                                value={input.unit_mode || 'primary'}
                                                onChange={e => handleInputChange(index, 'unit_mode', e.target.value)}
                                            >
                                                <option value="primary">Primary</option>
                                                <option value="secondary">Secondary</option>
                                            </select>
                                        </div>
                                        <div className="w-32">
                                            <input
                                                type="number"
                                                step="0.001"
                                                required
                                                className="w-full p-2 border border-gray-200 rounded-md text-sm"
                                                value={input.quantity}
                                                onChange={e => handleInputChange(index, 'quantity', e.target.value)}
                                                placeholder="Qty"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveInputRow(index)}
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            disabled={inputs.length === 1}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors"
                            >
                                <Save size={18} />
                                Save Production
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {
                activeTab === 'status' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-0">
                        <div className="flex justify-end p-4">
                            <select
                                value={unitDisplayMode}
                                onChange={(e) => setUnitDisplayMode(e.target.value)}
                                className="p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="both">Show Both Units (if applicable)</option>
                                <option value="primary">Primary Unit Only</option>
                                <option value="secondary">Secondary Unit Only</option>
                            </select>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total In</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Out</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {stockStatus.map(item => {
                                        // Unit Display Logic
                                        const isDual = item.has_dual_units;
                                        let displayStock;

                                        let primaryQty = item.current_stock;
                                        let secondaryQty = item.current_stock;
                                        let primaryUnit = item.unit; // Default Packing
                                        let secondaryUnit = item.secondary_unit;

                                        if (isDual && item.conversion_rate) {
                                            const rate = Number.parseFloat(item.conversion_rate);
                                            const base = Number.parseFloat(item.current_stock);
                                            // Simple conversion logic for display
                                            secondaryQty = base * rate;
                                        }

                                        // Render based on mode
                                        if (isDual) {
                                            if (unitDisplayMode === 'both') {
                                                displayStock = (
                                                    <div>
                                                        <div>{secondaryQty.toFixed(2)} {secondaryUnit}</div>
                                                        <div className="text-xs text-gray-500">({primaryQty.toFixed(2)} {primaryUnit})</div>
                                                    </div>
                                                );
                                            } else if (unitDisplayMode === 'primary') {
                                                displayStock = `${primaryQty.toFixed(2)} ${primaryUnit}`;
                                            } else {
                                                displayStock = `${secondaryQty.toFixed(2)} ${secondaryUnit}`;
                                            }
                                        } else {
                                            // Normal Product
                                            displayStock = `${item.current_stock.toFixed(2)} ${item.unit}`;
                                        }

                                        return (
                                            <tr key={item.product_id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.product_name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{item.total_in}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{item.total_out}</td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${item.current_stock < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {displayStock}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'ledger' && (
                    <div className="space-y-8 animate-fade-in-up">
                        {/* Header / Add View Button */}
                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 text-purple-700">
                                <History size={24} />
                                <h3 className="text-lg font-bold">Stock Ledger & History</h3>
                            </div>
                            <button
                                onClick={addLedgerView}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
                            >
                                <Plus size={16} />
                                Add Comparison Table
                            </button>
                        </div>

                        {ledgerViewIds.map(id => (
                            <StockLedgerView
                                key={id}
                                id={id}
                                products={products}
                                financialYear={financialYear}
                                onRemove={removeLedgerView}
                                showRemove={ledgerViewIds.length > 1}
                            />
                        ))}
                    </div>
                )
            }

            {
                activeTab === 'formulas' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
                        <div className="mb-6 max-w-md">
                            <label htmlFor="formulaProductSelect" className="block text-sm font-medium text-gray-700 mb-2">Select Product to Manage Formula (BOM)</label>
                            <select
                                id="formulaProductSelect"
                                className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={selectedFormulaProdId}
                                onChange={(e) => setSelectedFormulaProdId(e.target.value)}
                            >
                                <option value="">-- Select Product --</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.packing_type})</option>
                                ))}
                            </select>
                        </div>

                        {selectedFormulaProdId ? (
                            <ProductFormulas
                                productId={Number.parseInt(selectedFormulaProdId, 10)}
                                productName={products.find(p => p.id == selectedFormulaProdId)?.name}
                                isModal={false}
                                onClose={() => setSelectedFormulaProdId('')}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                <FlaskConical size={48} className="mb-4 opacity-20" />
                                <p>Select a product above to view or edit its production formula.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Modals */}
            <StockAdjustmentModal
                isOpen={isAdjustmentModalOpen}
                onClose={() => setIsAdjustmentModalOpen(false)}
                products={products}
                onSuccess={fetchData}
            />
        </div >
    );
}

StockRecording.propTypes = {
    financialYear: PropTypes.string
};

export default StockRecording;
