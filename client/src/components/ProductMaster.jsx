import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Trash2, Edit2, Plus, X, Search, Package, FlaskConical } from 'lucide-react';
import ProductFormulas from './ProductFormulas';

const ProductMaster = () => {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [formulaModalProduct, setFormulaModalProduct] = useState(null); // { id, name }
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');

    const [currentProduct, setCurrentProduct] = useState({
        id: null,
        name: '',
        hsn_code: '',
        tax_rate: '',
        packing_type: 'BAG', // Default
        opening_stock: '', // For new products
        opening_unit_mode: 'primary',
        maintain_stock: true,
        has_dual_units: false,
        secondary_unit: '',
        conversion_rate: ''
    });

    const API_URL = '/api/products';

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(API_URL);
            setProducts(res.data);
            setError('');
        } catch (err) {
            console.error("Error fetching products", err);
            setError('Failed to load products');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);



    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (currentProduct.id) {
                await axios.put(`${API_URL}/${currentProduct.id}`, currentProduct);
            } else {
                await axios.post(API_URL, currentProduct);
            }
            fetchProducts();
            setIsProductModalOpen(false);
            resetForm();
        } catch (err) {
            console.error("Error saving product", err);
            setError(err.response?.data?.error || 'Failed to save product');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            await axios.delete(`${API_URL}/${id}`);
            fetchProducts();
        } catch (err) {
            console.error("Error deleting product", err);
            setError('Failed to delete product');
        }
    };

    const resetForm = () => {
        setCurrentProduct({
            id: null,
            name: '',
            hsn_code: '',
            tax_rate: '',
            packing_type: 'BAG',
            opening_stock: '',
            maintain_stock: true,
            has_dual_units: false,
            secondary_unit: '',
            conversion_rate: ''
        });
    };

    const openEdit = (product) => {
        setCurrentProduct({
            ...product,
            packing_type: product.packing_type || 'BAG',
            opening_stock: product.opening_stock || '', // Populate from fetched data
            maintain_stock: product.maintain_stock === 1,
            has_dual_units: product.has_dual_units === 1,
            secondary_unit: product.secondary_unit || '',
            conversion_rate: product.conversion_rate || ''
        });
        setIsProductModalOpen(true);
    };

    const filteredProducts = products.filter(p =>
        (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.hsn_code?.toString() || '').includes(searchTerm)
    );

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Package className="text-blue-600" />
                    Product Master
                </h2>
                <button
                    onClick={() => { resetForm(); setIsProductModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Add Product
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 border border-red-100">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-sm font-semibold border-b border-gray-200">
                                <th className="px-6 py-4">Product Name</th>
                                <th className="px-6 py-4">Packing</th>
                                <th className="px-6 py-4">HSN Code</th>
                                <th className="px-6 py-4">Tax Rate (%)</th>
                                <th className="px-6 py-4 text-right">Current Stock</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr><td colSpan="5" className="text-center py-8 text-gray-500">Loading...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-8 text-gray-500">No products found</td></tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${product.packing_type === 'CAN' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                {product.packing_type || 'BAG'}
                                            </span>
                                            {product.has_dual_units === 1 && (
                                                <span className="ml-2 px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                                                    + {product.secondary_unit}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                                                {product.hsn_code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{product.tax_rate}%</td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-700">
                                            <div>
                                                {product.current_stock ? parseFloat(product.current_stock).toFixed(2) : '0.00'} {product.packing_type}
                                            </div>
                                            {product.has_dual_units === 1 && product.conversion_rate && (
                                                <div className="text-xs text-purple-600 font-medium">
                                                    {(function () {
                                                        const pUnit = product.packing_type ? product.packing_type.toUpperCase() : '';
                                                        const sUnit = product.secondary_unit ? product.secondary_unit.toUpperCase() : '';
                                                        const rate = parseFloat(product.conversion_rate);
                                                        const base = parseFloat(product.current_stock || 0);

                                                        const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                                                        const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

                                                        const isSecSmall = smallUnits.some(u => sUnit.includes(u));
                                                        const isPrimLarge = largeUnits.some(u => pUnit.includes(u));

                                                        let secQty = 0;
                                                        // Explicit logic to avoid confusion
                                                        if (isSecSmall && isPrimLarge) {
                                                            // BAG -> KGS (Multiply)
                                                            secQty = base * rate;
                                                        } else if (smallUnits.some(u => pUnit.includes(u)) && largeUnits.some(u => sUnit.includes(u))) {
                                                            // KGS -> BAG (Divide)
                                                            secQty = base / rate;
                                                        } else {
                                                            // Default Fallback (Multiply)
                                                            secQty = base * rate;
                                                        }

                                                        // Format to remove decimals if KGS/GRM etc
                                                        const showDec = ['KG', 'KGS', 'gm', 'ltr'].some(x => sUnit.toLowerCase().includes(x));
                                                        const fmtSec = showDec ? secQty.toFixed(2) : Math.round(secQty);

                                                        return `(${fmtSec} ${product.secondary_unit})`;
                                                    })()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setFormulaModalProduct({ id: product.id, name: product.name })}
                                                    className="p-1.5 hover:bg-purple-50 text-purple-600 rounded-md transition-colors"
                                                    title="Formula / BOM"
                                                >
                                                    <FlaskConical size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openEdit(product)}
                                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-800">
                                {currentProduct.id ? 'Edit Product' : 'Add New Product'}
                            </h3>
                            <button
                                onClick={() => setIsProductModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    value={currentProduct.name}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                    placeholder="e.g. Wheat Flour"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Packing Type</label>
                                <select
                                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    value={currentProduct.packing_type}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, packing_type: e.target.value })}
                                >
                                    <option value="BAG">BAG</option>
                                    <option value="CAN">CAN</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                        value={currentProduct.hsn_code}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, hsn_code: e.target.value })}
                                        placeholder="e.g. 1101"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        value={currentProduct.tax_rate}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, tax_rate: e.target.value })}
                                        placeholder="e.g. 5"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        checked={currentProduct.maintain_stock}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, maintain_stock: e.target.checked })}
                                    />
                                    <span className="text-sm font-semibold text-gray-700">Maintain Stock</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer ml-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        checked={currentProduct.has_dual_units}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, has_dual_units: e.target.checked })}
                                    />
                                    <span className="text-sm font-semibold text-gray-700">Enable Dual Units</span>
                                </label>
                            </div>

                            {currentProduct.maintain_stock && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock (Adjustable)</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-yellow-50"
                                                value={currentProduct.opening_stock}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, opening_stock: e.target.value })}
                                                placeholder="Initial quantity on hand"
                                            />
                                        </div>
                                        {currentProduct.has_dual_units && (
                                            <select
                                                className="w-32 p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50 text-sm font-bold text-gray-700"
                                                value={currentProduct.opening_unit_mode || 'primary'}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, opening_unit_mode: e.target.value })}
                                            >
                                                <option value="primary">{currentProduct.packing_type || 'Unit'}</option>
                                                <option value="secondary">{currentProduct.secondary_unit || 'Sec'}</option>
                                            </select>
                                        )}
                                        {!currentProduct.has_dual_units && (
                                            <div className="w-24 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-bold text-gray-500">
                                                {currentProduct.packing_type}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Updates will adjust the Opening Balance ledger entry.</p>
                                </div>
                            )}

                            {currentProduct.has_dual_units && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Unit</label>
                                        <select
                                            className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-blue-50"
                                            value={currentProduct.secondary_unit}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, secondary_unit: e.target.value })}
                                        >
                                            <option value="">Select Unit</option>
                                            <option value="KGS">KGS</option>
                                            <option value="BAG">BAG</option>
                                            <option value="CAN">CAN</option>
                                            <option value="NOS">NOS</option>
                                            <option value="BOX">BOX</option>
                                            <option value="MTR">MTR</option>
                                            <option value="LTR">LTR</option>
                                            <option value="DOZ">DOZ</option>
                                            <option value="PAC">PAC</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Conversion Rate</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-400">1 {currentProduct.packing_type} =</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                                                value={currentProduct.conversion_rate}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, conversion_rate: e.target.value })}
                                                placeholder="0.00"
                                            />
                                            <span className="text-xs font-bold text-gray-400">{currentProduct.secondary_unit || 'Unit'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all hover:shadow-md active:transform active:scale-95"
                                >
                                    Save Product
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Formula Modal */}
            {formulaModalProduct && (
                <ProductFormulas
                    productId={formulaModalProduct.id}
                    productName={formulaModalProduct.name}
                    onClose={() => setFormulaModalProduct(null)}
                />
            )}
        </div>
    );
};

export default ProductMaster;
