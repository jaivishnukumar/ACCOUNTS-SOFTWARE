import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { Save, ShoppingCart } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const getBaseUrl = () => '/api';

function PurchaseEntry({ purchaseToEdit = null, onSave }) {
    const [parties, setParties] = useState([]);
    const [productList, setProductList] = useState([]);
    const dateInputRef = useRef(null);

    // State Init
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        bill_no: '',
        received_date: new Date().toISOString().split('T')[0],
        party_id: '',
        gst_number: '',
        product_name: '',
        hsn_code: '',
        quantity: '',
        unit: '',
        conversion_factor: 1,
        taxable_value: '',
        tax_rate: 0,
        cgst: 0,
        sgst: 0,
        bill_value: 0,
        freight_charges: 0,
        loading_charges: 0,
        unloading_charges: 0,
        auto_charges: 0,
        expenses_total: 0,
        rcm_tax_payable: 0,
        round_off: 0,
        product_id: ''
    });

    const [purchaseToEditId, setPurchaseToEditId] = useState(null);

    // Refs
    const partyInputRef = useRef(null);
    const productInputRef = useRef(null);
    const quantityInputRef = useRef(null);

    const currentProduct = productList.find(p => p.id === formData.product_id);

    // Helpers
    const calculateTotals = (data) => {
        const qty = parseFloat(data.quantity) || 0;
        let taxable = parseFloat(data.taxable_value) || 0;
        const taxRate = parseFloat(data.tax_rate) || 0;

        const cgst = (taxable * (taxRate / 2)) / 100;
        const sgst = (taxable * (taxRate / 2)) / 100;
        const taxAmount = cgst + sgst;

        const expenses = (parseFloat(data.freight_charges) || 0) +
            (parseFloat(data.loading_charges) || 0) +
            (parseFloat(data.unloading_charges) || 0) +
            (parseFloat(data.auto_charges) || 0);

        // Auto-Round Off Logic (GST Standard: Nearest Rupee)
        // User Request: Bill Value = Taxable + CGST + SGST (Expenses are separate)
        const rawTotal = taxable + taxAmount;
        const billTotal = Math.round(rawTotal);
        const roundOff = billTotal - rawTotal;
        const rcm = expenses * 0.05;

        return {
            ...data,
            cgst: parseFloat(cgst.toFixed(2)),
            sgst: parseFloat(sgst.toFixed(2)),
            bill_value: parseFloat(billTotal.toFixed(2)),
            expenses_total: parseFloat(expenses.toFixed(2)),
            rcm_tax_payable: parseFloat(rcm.toFixed(2)),
            round_off: parseFloat(roundOff.toFixed(2))
        };
    };

    // API Calls
    const fetchProducts = useCallback(async () => {
        try {
            const res = await axios.get(`${getBaseUrl()}/products`);
            if (Array.isArray(res.data)) {
                setProductList(res.data);
            } else {
                setProductList([]);
            }
        } catch (error) {
            console.error("Error fetching products", error);
        }
    }, []);

    const fetchParties = useCallback(async () => {
        try {
            const res = await axios.get(`${getBaseUrl()}/parties`);
            setParties(res.data);
        } catch (error) {
            console.error("Error fetching parties", error);
        }
    }, []);

    // Form Handlers
    const resetForm = useCallback(() => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            bill_no: '',
            received_date: new Date().toISOString().split('T')[0],
            party_id: '',
            gst_number: '',
            product_name: '',
            hsn_code: '',
            quantity: '',
            unit: '',
            conversion_factor: 1,
            taxable_value: '',
            tax_rate: 0,
            cgst: 0,
            sgst: 0,
            bill_value: 0,
            freight_charges: 0,
            loading_charges: 0,
            unloading_charges: 0,
            auto_charges: 0,
            expenses_total: 0,
            rcm_tax_payable: 0,
            round_off: 0,
            product_id: ''
        });
    }, []);

    const handlePartyChange = (option) => {
        setFormData(prev => ({
            ...prev,
            party_id: option ? option.value : '',
            gst_number: option ? option.gst : ''
        }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            return calculateTotals(updated);
        });
    };

    const handleProductChange = (option) => {
        if (option) {
            const matched = productList.find(p => p.id === option.value);
            setFormData(prev => ({
                ...prev,
                product_name: option.label,
                product_id: matched ? matched.id : null,
                hsn_code: matched ? matched.hsn_code : '',
                unit: matched ? matched.packing_type : '',
                conversion_factor: 1,
                tax_rate: matched ? matched.tax_rate : 0
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                product_name: '',
                hsn_code: '',
                unit: '',
                conversion_factor: 1,
                tax_rate: 0
            }));
        }
    };

    // Effects
    useEffect(() => {
        fetchParties();
        fetchProducts();
        if (purchaseToEdit) {
            setFormData({
                date: purchaseToEdit.date,
                bill_no: purchaseToEdit.bill_no,
                received_date: purchaseToEdit.received_date || new Date().toISOString().split('T')[0],
                party_id: purchaseToEdit.party_id,
                gst_number: purchaseToEdit.gst_number || '',
                product_name: purchaseToEdit.product_name || '',
                product_id: purchaseToEdit.product_id || null,
                hsn_code: purchaseToEdit.hsn_code || '',
                quantity: purchaseToEdit.quantity || '',
                unit: purchaseToEdit.unit || '',
                conversion_factor: purchaseToEdit.conversion_factor || 1,
                taxable_value: purchaseToEdit.taxable_value || '',
                tax_rate: purchaseToEdit.tax_rate ?? 0,
                cgst: purchaseToEdit.cgst ?? 0,
                sgst: purchaseToEdit.sgst ?? 0,
                bill_value: purchaseToEdit.bill_value || 0,
                freight_charges: purchaseToEdit.freight_charges || 0,
                loading_charges: purchaseToEdit.loading_charges || 0,
                unloading_charges: purchaseToEdit.unloading_charges || 0,
                auto_charges: purchaseToEdit.auto_charges || 0,
                expenses_total: purchaseToEdit.expenses_total || 0,
                rcm_tax_payable: purchaseToEdit.rcm_tax_payable || 0,
                round_off: purchaseToEdit.round_off || 0
            });
            setPurchaseToEditId(purchaseToEdit.id);
        } else {
            resetForm();
            setPurchaseToEditId(null);
        }
    }, [purchaseToEdit, fetchParties, fetchProducts, resetForm]);

    const handleUnitChange = (e) => {
        const selectedUnit = e.target.value;
        const matched = productList.find(p => p.id === formData.product_id);

        let newFactor = 1;
        if (matched && matched.has_dual_units && selectedUnit === matched.secondary_unit) {
            newFactor = matched.conversion_rate ? (1 / parseFloat(matched.conversion_rate)) : 1;
        }

        setFormData(prev => ({
            ...prev,
            unit: selectedUnit,
            conversion_factor: newFactor
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.party_id) {
            alert("Please select a valid Party from the list.");
            return;
        }
        if (!formData.bill_no) {
            alert("Please enter a Bill Number.");
            return;
        }

        try {
            const idToUpdate = purchaseToEdit?.id || purchaseToEditId;

            if (idToUpdate) {
                await axios.put(`${getBaseUrl()}/purchases/${idToUpdate}`, formData);
                alert('Purchase entry updated successfully!');
            } else {
                await axios.post(`${getBaseUrl()}/purchases`, formData);
                alert('Purchase entry saved successfully!');
            }

            if (onSave) onSave();

            if (!purchaseToEdit) {
                setPurchaseToEditId(null);
                resetForm();
                setTimeout(() => {
                    if (dateInputRef.current) dateInputRef.current.focus();
                }, 100);
            }
        } catch (error) {
            console.error('Error saving purchase entry:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to save entry';
            alert(`Error: ${errorMessage}`);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-5xl mx-auto">
            <div className="bg-emerald-900 p-6 text-white flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-emerald-600 rounded-lg"><ShoppingCart size={24} /></div>
                    <span>{(purchaseToEdit || purchaseToEditId) ? 'Edit Purchase Entry' : 'New Purchase Entry'}</span>
                </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Row 1: Basic Info */}
                <div className="space-y-2">
                    <label htmlFor="bill_date" className="block text-sm font-semibold text-gray-700">Bill Date</label>
                    <input
                        id="bill_date"
                        ref={dateInputRef}
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="bill_no" className="block text-sm font-semibold text-gray-700">Bill Number</label>
                    <input
                        id="bill_no"
                        type="text"
                        name="bill_no"
                        value={formData.bill_no}
                        onChange={handleInputChange}
                        required
                        placeholder="Vendor Bill No"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="received_date" className="block text-sm font-semibold text-gray-700">Received Date</label>
                    <input
                        id="received_date"
                        type="date"
                        name="received_date"
                        value={formData.received_date}
                        onChange={handleInputChange}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>

                {/* Row 2: Party Selection */}
                <div className="md:col-span-2">
                    <SearchableSelect
                        label="Party Name"
                        placeholder="Search Party..."
                        options={useMemo(() => parties.map(p => ({
                            value: p.id,
                            label: p.name,
                            gst: p.gst_number,
                            subLabel: p.gst_number ? `GST: ${p.gst_number}` : ''
                        })), [parties])}
                        value={formData.party_id}
                        onChange={handlePartyChange}
                        onNext={() => productInputRef.current?.focus()}
                        inputRef={partyInputRef}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="gst_number" className="block text-sm font-semibold text-gray-700">GST Number</label>
                    <input
                        id="gst_number"
                        type="text"
                        name="gst_number"
                        value={formData.gst_number}
                        readOnly
                        className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none text-gray-600"
                    />
                </div>

                {/* Row 3: Product Details */}
                <div className="space-y-2">
                    <SearchableSelect
                        label="Product Name"
                        placeholder="Search Product..."
                        options={useMemo(() => productList.map(p => ({
                            value: p.id,
                            label: p.name,
                            subLabel: `HSN: ${p.hsn_code}`
                        })), [productList])}
                        value={formData.product_name}
                        onChange={handleProductChange}
                        onNext={() => quantityInputRef.current?.focus()}
                        inputRef={productInputRef}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="hsn_code" className="block text-sm font-semibold text-gray-700">HSN Code</label>
                    <input
                        id="hsn_code"
                        type="text"
                        name="hsn_code"
                        value={formData.hsn_code}
                        onChange={handleInputChange}
                        readOnly={!!formData.product_name}
                        className={`w-full p-3 border border-gray-200 rounded-lg focus:outline-none ${formData.product_name ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-emerald-500'}`}
                        placeholder={formData.product_name ? "Auto-filled" : "Enter HSN(Optional)"}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="unit" className="block text-sm font-semibold text-gray-700">Unit</label>
                    {currentProduct && currentProduct.has_dual_units ? (
                        <select
                            id="unit"
                            name="unit"
                            value={formData.unit}
                            onChange={handleUnitChange}
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-semibold"
                        >
                            <option value={currentProduct.packing_type}>{currentProduct.packing_type} (Primary)</option>
                            <option value={currentProduct.secondary_unit}>{currentProduct.secondary_unit} (Secondary)</option>
                        </select>
                    ) : (
                        <input
                            id="unit"
                            type="text"
                            name="unit"
                            value={formData.unit}
                            readOnly
                            className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none text-gray-600"
                        />
                    )}
                </div>

                {/* Row 4: Quantity & Taxable */}
                <div className="space-y-2">
                    <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700">Quantity</label>
                    <input
                        id="quantity"
                        ref={quantityInputRef}
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Qty"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="taxable_value" className="block text-sm font-semibold text-gray-700">Taxable Value</label>
                    <input
                        id="taxable_value"
                        type="number"
                        step="0.01"
                        name="taxable_value"
                        value={formData.taxable_value}
                        onChange={handleInputChange}
                        required
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                        placeholder="0.00"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="tax_rate" className="block text-sm font-semibold text-gray-700">Tax Rate (%)</label>
                    <input
                        id="tax_rate"
                        type="number"
                        name="tax_rate"
                        value={formData.tax_rate}
                        onChange={handleInputChange}
                        readOnly={!!formData.product_name}
                        className={`w-full p-3 border border-gray-200 rounded-lg focus:outline-none ${formData.product_name ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-emerald-500'}`}
                        placeholder="0"
                    />
                </div>

                {/* Row 5: Tax Breakdown */}
                <div className="space-y-2">
                    <label htmlFor="cgst" className="block text-sm font-semibold text-gray-700">CGST</label>
                    <input
                        id="cgst"
                        type="number"
                        name="cgst"
                        value={formData.cgst}
                        readOnly
                        className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none text-gray-600"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="sgst" className="block text-sm font-semibold text-gray-700">SGST</label>
                    <input
                        id="sgst"
                        type="number"
                        name="sgst"
                        value={formData.sgst}
                        readOnly
                        className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none text-gray-600"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="bill_value" className="block text-sm font-semibold text-emerald-800">Bill Value (Total)</label>
                    <input
                        id="bill_value"
                        type="number"
                        name="bill_value"
                        value={formData.bill_value}
                        readOnly
                        className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-lg focus:outline-none text-emerald-800 font-bold text-lg"
                    />
                </div>

                {/* Row 6: Expenses (Full Width Section) */}
                <div className="md:col-span-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Expenses & RCM</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label htmlFor="freight_charges" className="text-xs font-semibold text-gray-600">Freight Charges</label>
                            <input
                                id="freight_charges"
                                type="number"
                                step="0.01"
                                name="freight_charges"
                                value={formData.freight_charges}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="loading_charges" className="text-xs font-semibold text-gray-600">Loading Cooly</label>
                            <input
                                id="loading_charges"
                                type="number"
                                step="0.01"
                                name="loading_charges"
                                value={formData.loading_charges}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="unloading_charges" className="text-xs font-semibold text-gray-600">Unloading Cooly</label>
                            <input
                                id="unloading_charges"
                                type="number"
                                step="0.01"
                                name="unloading_charges"
                                value={formData.unloading_charges}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="auto_charges" className="text-xs font-semibold text-gray-600">Auto Charges</label>
                            <input
                                id="auto_charges"
                                type="number"
                                step="0.01"
                                name="auto_charges"
                                value={formData.auto_charges}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="expenses_total" className="text-xs font-semibold text-gray-600">Expenses Total</label>
                            <input
                                id="expenses_total"
                                type="number"
                                value={formData.expenses_total}
                                readOnly
                                className="w-full p-2 bg-gray-100 border border-gray-300 rounded font-bold text-gray-700"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-3 flex-wrap">
                        <div className="w-full md:w-1/4 space-y-1">
                            <label htmlFor="rcm_tax_payable" className="text-xs font-bold text-emerald-700 uppercase">Tax Payable (RCM 5%)</label>
                            <input
                                id="rcm_tax_payable"
                                type="number"
                                value={formData.rcm_tax_payable}
                                readOnly
                                className="w-full p-2 bg-emerald-50 border border-emerald-200 rounded font-bold text-emerald-800"
                            />
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="md:col-span-3 pt-2">
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                    >
                        <Save size={20} />
                        <span>{(purchaseToEdit || purchaseToEditId) ? 'Update Purchase' : 'Save Purchase Entry'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

export default PurchaseEntry;

PurchaseEntry.propTypes = {
    purchaseToEdit: PropTypes.shape({
        id: PropTypes.number,
        date: PropTypes.string,
        bill_no: PropTypes.string,
        received_date: PropTypes.string,
        party_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        gst_number: PropTypes.string,
        product_name: PropTypes.string,
        hsn_code: PropTypes.string,
        quantity: PropTypes.number,
        unit: PropTypes.string,
        taxable_value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        tax_rate: PropTypes.number,
        cgst: PropTypes.number,
        sgst: PropTypes.number,
        bill_value: PropTypes.number,
        freight_charges: PropTypes.number,
        loading_charges: PropTypes.number,
        unloading_charges: PropTypes.number,
        auto_charges: PropTypes.number,
        expenses_total: PropTypes.number,
        rcm_tax_payable: PropTypes.number,
        round_off: PropTypes.number
    }),
    onSave: PropTypes.func
};
