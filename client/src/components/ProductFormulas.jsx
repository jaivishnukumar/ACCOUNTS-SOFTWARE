import { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Plus, ArrowRight } from 'lucide-react';

const ProductFormulas = ({ productId, productName, onClose, isModal = true }) => {
    const [baseQuantity, setBaseQuantity] = useState(1);
    const [formulas, setFormulas] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newIngredient, setNewIngredient] = useState({ ingredient_id: '', quantity: '', unit_type: 'primary' });
    const [error, setError] = useState('');

    useEffect(() => {
        if (productId) fetchData();
    }, [productId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [formulaRes, productRes] = await Promise.all([
                axios.get(`/api/formulas/${productId}`),
                axios.get('/api/products')
            ]);
            setFormulas(formulaRes.data);

            const allProducts = productRes.data;
            // Filter: Exclude self for ingredient dropdown
            setProducts(allProducts.filter(p => p.id !== productId));

            // Find self to set baseQuantity
            const self = allProducts.find(p => p.id === productId);
            if (self && self.formula_base_qty) {
                setBaseQuantity(self.formula_base_qty);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to load formula data');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            // Normalize Quantity: User enters "Qty for Base Batch", we store "per 1 unit"
            const normalizedQty = parseFloat(newIngredient.quantity) / parseFloat(baseQuantity || 1);

            await axios.post('/api/formulas', {
                product_id: productId,
                ingredient_id: newIngredient.ingredient_id,
                quantity: normalizedQty,
                unit_type: newIngredient.unit_type
            });
            setNewIngredient({ ingredient_id: '', quantity: '', unit_type: 'primary' });
            fetchData();
        } catch (err) {
            setError('Failed to add ingredient');
        }
    };

    // Derived state for selected ingredient
    const selectedProduct = products.find(p => p.id == newIngredient.ingredient_id);

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/api/formulas/${id}`);
            fetchData();
        } catch (err) {
            setError('Failed to remove ingredient');
        }
    };

    const containerClasses = isModal
        ? "fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
        : "w-full h-full flex flex-col";

    const cardClasses = isModal
        ? "bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        : "bg-white rounded-xl shadow-sm border border-gray-200 w-full flex flex-col h-full";

    return (
        <div className={containerClasses}>
            <div className={cardClasses}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Production Formula (BOM)</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">Recipe for</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                className="w-20 p-1 text-sm border border-gray-300 rounded text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                value={baseQuantity}
                                onChange={(e) => {
                                    const val = Math.floor(e.target.value);
                                    setBaseQuantity(val);
                                    // Auto-save debounce could be better, but for now direct save
                                    if (val > 0) {
                                        axios.put(`/api/products/${productId}/formula-info`, { base_qty: val }).catch(console.error);
                                    }
                                }}
                            />
                            <span className="text-sm text-gray-500">Unit(s) of <span className="font-semibold text-blue-600">{productName}</span></span>
                        </div>
                    </div>
                    {isModal && <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>}
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 px-6 py-3 text-sm border-b border-red-100">
                        {error}
                    </div>
                )}

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Add Ingredient Form */}
                    <form onSubmit={handleAdd} className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-6 flex gap-4 items-end flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Ingredient (Raw Material)</label>
                            <select
                                required
                                className="w-full p-2 border border-blue-200 rounded-md"
                                value={newIngredient.ingredient_id}
                                onChange={e => setNewIngredient({ ...newIngredient, ingredient_id: e.target.value, unit_type: 'primary' })}
                            >
                                <option value="">Select Ingredient</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.packing_type}) {p.current_stock ? `[Stock: ${p.current_stock}]` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedProduct && selectedProduct.has_dual_units === 1 && (
                            <div className="w-32">
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Unit</label>
                                <select
                                    className="w-full p-2 border border-blue-200 rounded-md text-sm"
                                    value={newIngredient.unit_type}
                                    onChange={e => setNewIngredient({ ...newIngredient, unit_type: e.target.value })}
                                >
                                    <option value="primary">{selectedProduct.packing_type}</option>
                                    <option value="secondary">{selectedProduct.secondary_unit} (x{selectedProduct.conversion_rate})</option>
                                </select>
                            </div>
                        )}

                        <div className="w-32">
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
                                Qty {selectedProduct && newIngredient.unit_type === 'secondary' ? `(${selectedProduct.secondary_unit})` : selectedProduct ? `(${selectedProduct.packing_type})` : ''}
                            </label>
                            {(() => {
                                const unitStr = (selectedProduct && newIngredient.unit_type === 'secondary'
                                    ? (selectedProduct.secondary_unit || '')
                                    : (selectedProduct?.packing_type || '')).toUpperCase();

                                // Strategy: Fail-open. Allow decimals by default, restrict only for known discrete units.
                                const discreteUnits = ['NOS', 'PCS', 'BAG', 'BOX', 'PKT', 'SET', 'PAIR'];
                                const isDiscrete = discreteUnits.some(u => unitStr.includes(u));

                                // If discrete, enforce 1. Else allow 0.001 (decimals)
                                const stepVal = isDiscrete ? "1" : "0.001";

                                return (
                                    <input
                                        type="number"
                                        step={stepVal}
                                        required
                                        className="w-full p-2 border border-blue-200 rounded-md"
                                        value={newIngredient.quantity}
                                        onChange={e => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                        placeholder="0"
                                    />
                                );
                            })()}
                        </div>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md shadow-sm transition-colors">
                            <Plus size={20} />
                        </button>
                    </form>

                    {/* Ingredients List */}
                    {loading ? (
                        <div className="text-center py-8 text-gray-400">Loading formula...</div>
                    ) : formulas.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-xl">
                            <div className="text-gray-400 mb-2">No ingredients defined</div>
                            <p className="text-xs text-gray-400">Add raw materials needed to manufacture this product.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {formulas.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                                            IN
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-800">{item.ingredient_name}</div>
                                            <div className="text-xs text-gray-500">Unit: {item.unit}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-gray-700">
                                                {parseFloat((parseFloat(item.quantity) * parseFloat(baseQuantity || 1)).toFixed(3))} {item.unit}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                REQUIRED FOR {baseQuantity} {baseQuantity == 1 ? 'UNIT' : 'UNITS'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-center my-2">
                                <ArrowRight className="text-gray-300 transform rotate-90" />
                            </div>

                            <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">
                                        OUT
                                    </div>
                                    <span className="font-bold text-green-800">{baseQuantity} {baseQuantity == 1 ? 'Unit' : 'Units'} of {productName}</span>
                                </div>
                                <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">Finished Good</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductFormulas;
