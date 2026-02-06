import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Save, Calculator } from 'lucide-react';

// Dynamic API URL
const getBaseUrl = () => '/api'; // Fixed build


function SalesEntry({ saleToEdit = null, onSave }) {
    const [parties, setParties] = useState([]);
    const [productList, setProductList] = useState([]);
    const [lastBillNo, setLastBillNo] = useState(null);
    const dateInputRef = useRef(null);
    const billValueRef = useRef(null); // New Ref for Bill Value

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        bill_no: '',
        party_id: '',
        bill_value: '',
        bags: '',
        product_name: '',
        hsn_code: '',
        packing_type: '',
        unit: '', // Sync with packing_type
        tax_rate: 0,
        cgst: 0,
        sgst: 0,
        round_off: 0,
        tax_amount: 0,
        total: 0
    });

    // Searchable Party State
    const [partySearchTerm, setPartySearchTerm] = useState('');
    const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [saleToEditId, setSaleToEditId] = useState(null); // Track ID for existing bills
    const wrapperRef = useRef(null);
    const itemRefs = useRef([]);

    const fetchParties = useCallback(async () => {
        try {
            const res = await axios.get(`${getBaseUrl()}/parties`);
            setParties(res.data);
        } catch (error) {
            console.error("Error fetching parties", error);
        }
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const res = await axios.get(`${getBaseUrl()}/products`);
            setProductList(res.data);
        } catch (error) {
            console.error("Error fetching products", error);
        }
    }, []);

    const fetchNextBillNo = useCallback(async () => {
        try {
            const res = await axios.get(`${getBaseUrl()}/sales/next-bill-no`);
            setFormData(prev => ({ ...prev, bill_no: String(res.data.next_bill_no).split('.')[0] }));
            setLastBillNo(String(res.data.last_bill_no).split('.')[0]);
        } catch (err) {
            console.error("Error fetching bill no", err);
        }
    }, []);

    const resetFormAndFetchBillNo = useCallback(() => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            bill_no: '',
            party_id: '',
            bill_value: '',
            bags: '',
            product_name: '',
            hsn_code: '',
            packing_type: '',
            unit: '',
            tax_rate: 0,
            cgst: 0,
            sgst: 0,
            round_off: 0,
            tax_amount: 0,
            total: 0
        });
        fetchNextBillNo();
    }, [fetchNextBillNo]);

    // Initial Data Fetch
    useEffect(() => {
        fetchParties();
        fetchProducts();
    }, [fetchParties, fetchProducts]);

    // Form Sync Logic
    useEffect(() => {
        if (saleToEdit) {
            // Robust Product Name Lookup
            let pname = saleToEdit.product_name || '';
            const pid = saleToEdit.product_id;

            console.log("Edit Mode Debug:", { saleToEdit, pid, productListLen: productList.length });

            // If name is missing or we want to ensure consistency
            if (pid && productList.length > 0) {
                // Use loose comparison (==) to handle string/number differences
                const found = productList.find(p => p.id == pid);
                if (found) {
                    pname = found.name;
                    console.log("Found product match:", found.name);
                } else {
                    console.warn("Product ID found but not in list:", pid);
                }
            }

            setFormData({
                date: saleToEdit.date,
                bill_no: saleToEdit.bill_no,
                party_id: saleToEdit.party_id,
                bill_value: saleToEdit.bill_value,
                bags: saleToEdit.bags,
                product_id: pid,
                product_name: pname,
                hsn_code: saleToEdit.hsn_code || '',
                packing_type: saleToEdit.packing_type || '',
                unit: saleToEdit.unit || saleToEdit.packing_type || '',
                tax_rate: saleToEdit.tax_rate ?? 0,
                cgst: saleToEdit.cgst ?? 0,
                sgst: saleToEdit.sgst ?? 0,
                round_off: saleToEdit.round_off ?? 0,
                tax_amount: (saleToEdit.cgst || 0) + (saleToEdit.sgst || 0),
                total: saleToEdit.total
            });
            setSaleToEditId(saleToEdit.id);
        } else {
            // New Entry - Only reset if we are explicitly switching to "New Mode" 
            // from an Edit Mode or on initial Mount, NOT just when productList loads.
            // But we can't easily distinguish "list load" from "user switch".

            // However, since this effect depends on [saleToEdit], it runs when that prop changes.
            // It ALSO depends on [productList].

            // Critical check: If we are already in "New Mode" (saleToEdit is null),
            // and simply receiving a productList update, we should NOT reset the form
            // if the user has started typing.

            // Simplification: resetFormAndFetchBillNo resets EVERY time productList updates?
            // Yes, that's bad.

            // Fix: Check if we are already in 'clean' state? No.
            // Better: Only reset if saleToEdit CHANGED to null.
            // But hooks don't give "prevProps".

            // Workaround: We can assume if productList changed, we might want to re-validate, 
            // but resetting the whole form is aggressive.
            // ACTUALLY: The primary use case for this 'else' is when the parent passes `saleToEdit={null}`.

            // If I omit the 'else' block here, how do we handle "Switch from Edit to New"?
            // We can check if `saleToEditId` matches `saleToEdit?.id`.

            if (saleToEditId !== null) {
                // We were editing, now we are not. Refetch defaults.
                resetFormAndFetchBillNo();
                setSaleToEditId(null);
            } else if (!formData.bill_no) {
                // Initial load (bill_no empty) -> Fetch it.
                resetFormAndFetchBillNo();
            }
        }
    }, [saleToEdit, productList, resetFormAndFetchBillNo, saleToEditId, formData.bill_no]);

    // Sync Party Name when ID changes
    useEffect(() => {
        if (formData.party_id && parties.length > 0) {
            const selectedParty = parties.find(p => p.id === formData.party_id);
            if (selectedParty) {
                setPartySearchTerm(selectedParty.name);
            }
        } else if (!formData.party_id) {
            setPartySearchTerm('');
        }
    }, [formData.party_id, parties]);

    // Close Dropdown on Click Outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsPartyDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredParties = parties.filter(party =>
        (party.name || '').toLowerCase().includes((partySearchTerm || '').toLowerCase())
    );

    // Keyboard Navigation
    const handleKeyDown = (e) => {
        if (!isPartyDropdownOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter") setIsPartyDropdownOpen(true);
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredParties.length - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === "Enter" || e.key === "Tab") {
            if (e.key === "Enter") e.preventDefault();
            if (filteredParties[highlightedIndex]) {
                const party = filteredParties[highlightedIndex];
                setFormData(prev => ({ ...prev, party_id: party.id }));
                setPartySearchTerm(party.name);
                setIsPartyDropdownOpen(false);
            }
        } else if (e.key === "Escape") {
            setIsPartyDropdownOpen(false);
        }
    };

    // Auto-scroll to highlighted item
    useEffect(() => {
        if (isPartyDropdownOpen && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [highlightedIndex, isPartyDropdownOpen]);



    const handleUnitChange = (e) => {
        const mode = e.target.value;
        const product = productList.find(p => p.id === parseInt(formData.product_id));

        let newUnit = '';
        let newFactor = 1.0;

        if (product) {
            if (mode === 'secondary') {
                newUnit = product.secondary_unit;
                newFactor = product.conversion_rate || 1.0;
            } else {
                newUnit = product.packing_type;
                newFactor = 1.0;
            }
        }

        setFormData(prev => ({
            ...prev,
            unit_mode: mode,
            unit: newUnit,
            conversion_factor: newFactor
        }));
    };

    // Auto-calculations
    useEffect(() => {
        const value = parseFloat(formData.bill_value) || 0;
        const rate = parseFloat(formData.tax_rate) || 0;

        if (value > 0) {
            const gstAmount = (value * rate) / 100;
            const cgst = parseFloat((gstAmount / 2).toFixed(2));
            const sgst = parseFloat((gstAmount / 2).toFixed(2));

            const exactTotal = value + cgst + sgst;
            const roundedTotal = Math.round(exactTotal);
            const round_off = parseFloat((roundedTotal - exactTotal).toFixed(2));

            setFormData(prev => ({
                ...prev,
                cgst,
                sgst,
                round_off,
                tax_amount: parseFloat((cgst + sgst).toFixed(2)),
                total: roundedTotal
            }));
        }
    }, [formData.bill_value, formData.tax_rate]);

    const handleBillNoBlur = async () => {
        const billNo = formData.bill_no;
        if (!billNo) return;

        try {
            // Don't check if we are simply editing the same bill we started with
            if (saleToEdit && String(saleToEdit.bill_no) === String(billNo)) return;

            const res = await axios.get(`${getBaseUrl()}/sales/by-bill/${billNo}`);
            if (res.data) {
                const foundSale = res.data;
                // Bill exists, switch to edit mode
                setSaleToEditId(foundSale.id);
                setFormData({
                    date: foundSale.date,
                    bill_no: foundSale.bill_no,
                    party_id: foundSale.party_id,
                    bill_value: foundSale.bill_value,
                    bags: foundSale.bags,
                    product_name: foundSale.product_name || '', // Use foundSale product if available
                    hsn_code: foundSale.hsn_code || '',
                    packing_type: foundSale.packing_type || '',
                    tax_rate: foundSale.tax_rate ?? 0,
                    cgst: foundSale.cgst ?? 0,
                    sgst: foundSale.sgst ?? 0,
                    round_off: foundSale.round_off ?? 0,
                    tax_amount: (foundSale.cgst || 0) + (foundSale.sgst || 0),
                    total: foundSale.total
                });
                alert(`Bill No ${billNo} already exists. Loaded data for editing.`);
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // Not found, clean slate for this bill no (it is new)
                setSaleToEditId(null);
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePartyChange = (e) => {
        setFormData(prev => ({ ...prev, party_id: e.target.value }));
    };

    // Derive current product for checking dual unit status
    const currentProduct = productList.find(p => p.name === formData.product_name);

    const handleProductChange = (e) => {
        const productName = e.target.value;
        const matched = productList.find(p => p.name === productName);

        setFormData(prev => ({
            ...prev,
            product_name: productName,
            product_id: matched ? matched.id : null,
            hsn_code: matched ? matched.hsn_code : '',
            packing_type: matched ? matched.packing_type : '',
            unit: matched ? matched.packing_type : '', // Set unit
            tax_rate: matched ? matched.tax_rate : 0
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Priority: Prop ID (explicit edit) > Discovered ID (bill lookup)
            const idToUpdate = saleToEdit?.id || saleToEditId;

            if (idToUpdate) {
                await axios.put(`${getBaseUrl()}/sales/${idToUpdate}`, formData);
                alert('Sales entry updated successfully!');
            } else {
                await axios.post(`${getBaseUrl()}/sales`, formData);
                alert('Sales entry saved successfully!');
            }

            if (onSave) onSave();

            // Reset and Focus if we weren't explicitly editing from parent
            if (!saleToEdit) {
                setSaleToEditId(null); // Clear local edit state
                resetFormAndFetchBillNo();
                // Focus back on Date field
                setTimeout(() => {
                    if (dateInputRef.current) dateInputRef.current.focus();
                }, 100);
            }
        } catch (error) {
            console.error('Error saving sales entry:', error);
            alert('Failed to save entry');
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-4xl mx-auto">
            <div className="bg-gray-900 p-6 text-white flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg"><Calculator size={24} /></div>
                    <span>{(saleToEdit || saleToEditId) ? 'Edit Sales Entry' : 'New Sales Entry'}</span>
                </h2>
                <div className="flex gap-4">
                    {lastBillNo > 0 && (
                        <div className="text-sm text-gray-400 font-medium flex flex-col items-end">
                            <span className="text-xs uppercase tracking-wider">Last Entered</span>
                            <span className="text-white font-mono font-bold">{lastBillNo}</span>
                        </div>
                    )}
                    <div className="text-sm text-gray-400 font-medium flex flex-col items-end">
                        <span className="text-xs uppercase tracking-wider">Current Bill</span>
                        <span className="text-white font-mono bg-gray-800 px-2 py-0.5 rounded border border-gray-700">{formData.bill_no || '...'}</span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Row 1 */}
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Bill Date</label>
                    <input
                        ref={dateInputRef}
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Bill Number</label>
                    <input
                        type="text"
                        name="bill_no"
                        value={formData.bill_no}
                        onChange={handleInputChange}
                        onBlur={handleBillNoBlur}
                        required
                        placeholder="e.g. 1024"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono"
                    />
                </div>

                {/* Row 2 */}
                <div className="md:col-span-2 space-y-2 relative" ref={wrapperRef}>
                    <label className="block text-sm font-semibold text-gray-700">Party Name</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={partySearchTerm}
                            onChange={(e) => {
                                setPartySearchTerm(e.target.value);
                                setIsPartyDropdownOpen(true);
                                setHighlightedIndex(0);
                                setFormData(prev => ({ ...prev, party_id: '' }));
                            }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsPartyDropdownOpen(true)}
                            placeholder="Type to search party..."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                        {isPartyDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredParties.length > 0 ? (
                                    filteredParties.map((party, index) => (
                                        <div
                                            key={party.id}
                                            ref={el => itemRefs.current[index] = el}
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, party_id: party.id }));
                                                setPartySearchTerm(party.name);
                                                setIsPartyDropdownOpen(false);
                                            }}
                                            className={`p-3 cursor-pointer border-b border-gray-50 last:border-0 ${index === highlightedIndex ? 'bg-blue-100 text-blue-900' : 'hover:bg-blue-50 text-gray-800'
                                                }`}
                                        >
                                            <div className="font-medium">{party.name}</div>
                                            {party.gst_number && <div className="text-xs text-gray-500">GST: {party.gst_number}</div>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-gray-500 text-sm text-center">No matching parties found</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 3 */}
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Quantity</label>
                    <input
                        type="number"
                        name="bags"
                        value={formData.bags}
                        onChange={handleInputChange}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Quantity"
                    />
                </div>

                {/* Product Selection */}
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Product Name</label>
                    <select
                        name="product_name"
                        value={formData.product_name}
                        onChange={handleProductChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault();
                                if (billValueRef.current) billValueRef.current.focus();
                            }
                        }}
                        required
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="">Select Product</option>
                        {productList.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* HSN, Packing & Tax Rate (Auto-filled & Read-only) */}
                <div className="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">HSN Code</label>
                        <input
                            type="text"
                            name="hsn_code"
                            value={formData.hsn_code}
                            readOnly
                            className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none cursor-not-allowed text-gray-500 font-mono"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Unit / Packing</label>
                        {currentProduct && currentProduct.has_dual_units ? (
                            <select
                                name="unit"
                                value={formData.unit}
                                onChange={handleUnitChange}
                                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold"
                            >
                                <option value={currentProduct.packing_type}>{currentProduct.packing_type} (Primary)</option>
                                <option value={currentProduct.secondary_unit}>{currentProduct.secondary_unit} (Secondary)</option>
                            </select>
                        ) : (
                            <input
                                type="text"
                                name="packing_type"
                                value={formData.packing_type}
                                readOnly
                                className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none cursor-not-allowed text-gray-500 font-semibold"
                            />
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">GST Rate (%)</label>
                        <input
                            type="number"
                            name="tax_rate"
                            value={formData.tax_rate}
                            readOnly
                            className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none cursor-not-allowed text-gray-500"
                        />
                    </div>
                </div>

                {/* Row 4 - Calculations */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <div className="flex justify-between mb-1">
                            <label className="block text-sm font-semibold text-blue-900">Bill Value (Taxable)</label>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-blue-400 font-bold">₹</span>
                            <input
                                ref={billValueRef}
                                type="number"
                                step="0.01"
                                name="bill_value"
                                value={formData.bill_value}
                                onChange={handleInputChange}
                                required
                                className="w-full pl-8 p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-bold text-gray-800 outline-none transition-all shadow-sm"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-blue-900">Total Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-blue-600 font-bold">₹</span>
                            <input
                                type="number"
                                value={formData.total}
                                readOnly
                                className="w-full pl-8 p-3 border border-blue-200 bg-blue-100/50 rounded-lg font-black text-2xl text-blue-700 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 col-span-1 md:col-span-2 border-t border-blue-200 pt-4">
                        <div>
                            <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Tax Amount</label>
                            <input
                                type="number"
                                value={formData.tax_amount}
                                readOnly
                                className="w-full p-2 border border-blue-200 rounded text-sm text-gray-700 bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">C.G.S.T</label>
                            <input
                                type="number"
                                step="0.01"
                                name="cgst"
                                value={formData.cgst}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-blue-200 rounded text-sm text-gray-700 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">S.G.S.T</label>
                            <input
                                type="number"
                                step="0.01"
                                name="sgst"
                                value={formData.sgst}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-blue-200 rounded text-sm text-gray-700 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Round Off</label>
                            <input
                                type="number"
                                step="0.01"
                                name="round_off"
                                value={formData.round_off}
                                readOnly
                                className="w-full p-2 border border-blue-200 rounded text-sm text-gray-500 bg-gray-50"
                            />
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="md:col-span-2 pt-4">
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                    >
                        <Save size={20} />
                        <span>{(saleToEdit || saleToEditId) ? 'Update Entry' : 'Save Sales Entry'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

export default SalesEntry;
