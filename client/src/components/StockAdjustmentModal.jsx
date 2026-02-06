import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { X, ArrowRight, ArrowDown, ArrowUp, Repeat } from 'lucide-react';

const StockAdjustmentModal = ({ isOpen, onClose, onSuccess }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [type, setType] = useState('ADJUSTMENT_IN'); // ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [productId, setProductId] = useState('');
    const [relatedProductId, setRelatedProductId] = useState(''); // Target for transfer
    const [quantity, setQuantity] = useState('');
    const [remarks, setRemarks] = useState('');
    const [unitMode, setUnitMode] = useState('primary'); // 'primary' or 'secondary'
    const [error, setError] = useState('');

    useEffect(() => {
        // Reset unit mode when product changes
        setUnitMode('primary');
    }, [productId, relatedProductId]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await axios.get('/api/products');
                setProducts(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchProducts();
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const prod = products.find(p => p.id == (type === 'TRANSFER' ? relatedProductId : productId));
            const isSecondary = unitMode === 'secondary' && prod?.secondary_unit;

            await axios.post('/api/stock/adjust', {
                date,
                type,
                // This is confusing. 
                // Let's look at API implementation intent: 
                // "Deduct from Source (related) -> Add to Target (product)".
                // So: related=Source, product=Target.
                product_id: type === 'TRANSFER' ? relatedProductId : productId, // Target
                related_product_id: type === 'TRANSFER' ? productId : null, // Source
                quantity,
                remarks,
                unit_mode: unitMode,
                conversion_factor: isSecondary ? prod.conversion_rate : 1,
                unit_name: isSecondary ? prod.secondary_unit : prod.packing_type
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to adjust stock');
        } finally {
            setLoading(false);
        }
    };

    const getSubmitButtonClass = () => {
        const baseClass = "w-full py-4 rounded-xl text-white font-bold shadow-lg transition-transform active:scale-[0.98]";
        if (type === 'ADJUSTMENT_IN') return `${baseClass} bg-green-600 hover:bg-green-700`;
        if (type === 'ADJUSTMENT_OUT') return `${baseClass} bg-red-600 hover:bg-red-700`;
        return `${baseClass} bg-blue-600 hover:bg-blue-700`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-800">Stock Operations</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Operation Type Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                        <button
                            type="button"
                            onClick={() => setType('ADJUSTMENT_IN')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${type === 'ADJUSTMENT_IN' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ArrowDown size={16} /> Add Stock
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('ADJUSTMENT_OUT')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${type === 'ADJUSTMENT_OUT' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ArrowUp size={16} /> Reduce Stock
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('TRANSFER')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${type === 'TRANSFER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Repeat size={16} /> Transfer
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

                        {/* Date */}
                        <div>
                            <label htmlFor="adjustment-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input
                                id="adjustment-date"
                                type="date"
                                required
                                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>

                        {/* Product Selection Logic */}
                        {type === 'TRANSFER' ? (
                            <div className="grid grid-cols-2 gap-4 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-100 rounded-full p-1 z-10 border border-white">
                                    <ArrowRight size={16} className="text-gray-500" />
                                </div>
                                <div>
                                    <label htmlFor="source-product" className="block text-xs font-bold text-gray-500 uppercase mb-1">From (Source)</label>
                                    <select
                                        id="source-product"
                                        required
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={productId}
                                        onChange={e => setProductId(e.target.value)}
                                    >
                                        <option value="">Select Source</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id} disabled={p.id == relatedProductId}>
                                                {p.name} ({p.packing_type})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="target-product" className="block text-xs font-bold text-gray-500 uppercase mb-1">To (Target)</label>
                                    <select
                                        id="target-product"
                                        required
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={relatedProductId}
                                        onChange={e => setRelatedProductId(e.target.value)}
                                    >
                                        <option value="">Select Target</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id} disabled={p.id == productId}>
                                                {p.name} ({p.packing_type})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="product-select" className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                                <select
                                    id="product-select"
                                    required
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={productId}
                                    onChange={e => setProductId(e.target.value)}
                                >
                                    <option value="">Select Product</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.packing_type})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Quantity with Unit Display */}
                        <div>
                            <label htmlFor="adjustment-quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <div className="flex gap-2">
                                <input
                                    id="adjustment-quantity"
                                    type="number"
                                    required
                                    step="0.001"
                                    className="flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                    placeholder="0.00"
                                />
                                {(() => {
                                    const prod = products.find(p => p.id == (type === 'TRANSFER' ? relatedProductId : productId));
                                    const hasSec = prod?.secondary_unit && prod?.conversion_rate > 1;

                                    if (hasSec) {
                                        return (
                                            <select
                                                className="w-32 bg-gray-100 border border-gray-200 rounded-lg px-2 font-bold text-gray-700 outline-none"
                                                value={unitMode}
                                                onChange={e => setUnitMode(e.target.value)}
                                                aria-label="Unit Selection"
                                            >
                                                <option value="primary">{prod.packing_type}</option>
                                                <option value="secondary">{prod.secondary_unit}</option>
                                            </select>
                                        );
                                    }
                                    return (
                                        <div className="w-24 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center font-bold text-gray-600">
                                            {prod?.packing_type || '-'}
                                        </div>
                                    );
                                })()}
                            </div>
                            {/* Conversion Hint */}
                            {(() => {
                                const prod = products.find(p => p.id == (type === 'TRANSFER' ? relatedProductId : productId));
                                if (prod?.secondary_unit && prod?.conversion_rate > 1 && unitMode === 'secondary') {
                                    return (
                                        <div className="text-xs text-gray-500 mt-1">
                                            1 {prod.secondary_unit} = {prod.conversion_rate} {prod.packing_type}.
                                            Total: {quantity ? (Number.parseFloat(quantity) * prod.conversion_rate).toFixed(2) : 0} {prod.packing_type}
                                        </div>
                                    );
                                }
                            })()}
                        </div>

                        {/* Remarks */}
                        <div>
                            <label htmlFor="adjustment-remarks" className="block text-sm font-medium text-gray-700 mb-1">Reason / Remarks</label>
                            <span className="text-sm text-gray-500 mb-2 block">Please describe the reason for this adjustment.</span>
                            <textarea
                                id="adjustment-remarks"
                                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                rows="2"
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                                placeholder="e.g. Audit correction, Damaged goods, Conversion"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={getSubmitButtonClass()}
                        >
                            {loading ? 'Processing...' : 'Confirm Operation'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

StockAdjustmentModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired
};

export default StockAdjustmentModal;
