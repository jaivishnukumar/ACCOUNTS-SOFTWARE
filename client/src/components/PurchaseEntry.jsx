import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { Save, ShoppingCart, Plus, Trash2, Upload, AlertCircle, Check, Loader2, Sparkles, X, Pencil } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import * as XLSX from 'xlsx';
import ProductFormulas from './ProductFormulas';

const getBaseUrl = () => '/api';

const formatDateValue = (val) => {
    if (!val) return '';
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    const num = parseFloat(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const dateObj = new Date((num - 25569) * 86400 * 1000);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const str = String(val).trim();
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const d = dmyMatch[1].padStart(2, '0');
        const m = dmyMatch[2].padStart(2, '0');
        const y = dmyMatch[3];
        return `${y}-${m}-${d}`;
    }

    const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
        const y = ymdMatch[1];
        const m = ymdMatch[2].padStart(2, '0');
        const d = ymdMatch[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return str;
};

const parseNumberValue = (val) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(/[^\d\.\-]/g, '').trim();
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const parseQuantityAndUnit = (val) => {
    if (val === undefined || val === null) return { qty: 0, unit: '' };
    if (typeof val === 'number') return { qty: val, unit: '' };
    
    const str = String(val).trim();
    const match = str.match(/^([\d\.\-]+)\s*([a-zA-Z]+)/);
    if (match) {
        const qty = parseFloat(match[1]);
        const unit = match[2].toUpperCase().trim();
        return { qty: isNaN(qty) ? 0 : qty, unit };
    }
    
    const qty = parseFloat(str.replace(/[^\d\.\-]/g, ''));
    return { qty: isNaN(qty) ? 0 : qty, unit: '' };
};

function PurchaseEntry({ purchaseToEdit = null, onSave }) {
    const [parties, setParties] = useState([]);
    const [productList, setProductList] = useState([]);

    // Header State
    const [headerData, setHeaderData] = useState({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        bill_no: '',
        received_date: new Date().toISOString().split('T')[0],
        party_id: '',
        gst_number: '',
        freight_charges: 0,
        loading_charges: 0,
        unloading_charges: 0,
        auto_charges: 0,
        expenses_total: 0,
        rcm_tax_payable: 0,
        round_off: 0
    });

    // Items State
    const [items, setItems] = useState([]);
    const [editIndex, setEditIndex] = useState(null);

    // Current Item Input State
    const [currentItem, setCurrentItem] = useState({
        product_id: '',
        product_name: '',
        hsn_code: '',
        quantity: '',
        unit: '',
        conversion_factor: 1,
        taxable_value: '',
        tax_rate: 0,
        cgst: 0,
        sgst: 0,
        bill_value: 0
    });

    const [purchaseToEditId, setPurchaseToEditId] = useState(null);

    // Importer State
    const [showImportModal, setShowImportModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [importStep, setImportStep] = useState('select'); // select, mapping, preview, importing, finished
    const [parsedHeaders, setParsedHeaders] = useState([]);
    const [rawDataRows, setRawDataRows] = useState([]);
    const [pdfWarning, setPdfWarning] = useState(false);
    const [columnMapping, setColumnMapping] = useState({
        date: '',
        bill_no: '',
        party_name: '',
        gstin: '',
        product_name: '',
        hsn_code: '',
        gst_rate: '',
        quantity: '',
        unit: '',
        taxable_value: '',
        cgst: '',
        sgst: '',
        round_off: '',
        total: ''
    });
    const [previewData, setPreviewData] = useState([]);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [importLogs, setImportLogs] = useState([]);

    // Post-Import BOM prompt state
    const [showBomPrompt, setShowBomPrompt] = useState(false);
    const [newProductsCreated, setNewProductsCreated] = useState([]); // [{id, name}]
    const [selectedBomProduct, setSelectedBomProduct] = useState(null); // {id, name}

    // Refs
    const dateInputRef = useRef(null);
    const partyInputRef = useRef(null);
    const productInputRef = useRef(null);
    const quantityInputRef = useRef(null);

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

    function resetCurrentItem() {
        setCurrentItem({
            product_id: '',
            product_name: '',
            hsn_code: '',
            quantity: '',
            unit: '',
            conversion_factor: 1,
            taxable_value: '',
            tax_rate: 0,
            cgst: 0,
            sgst: 0,
            bill_value: 0
        });
        setEditIndex(null);
    }

    function resetForm() {
        setHeaderData({
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0].slice(0, 5),
            bill_no: '',
            received_date: new Date().toISOString().split('T')[0],
            party_id: '',
            gst_number: '',
            freight_charges: 0,
            loading_charges: 0,
            unloading_charges: 0,
            auto_charges: 0,
            expenses_total: 0,
            rcm_tax_payable: 0,
            round_off: 0
        });
        setItems([]);
        resetCurrentItem();
    }

    // Init Logic
    useEffect(() => {
        fetchParties();
        fetchProducts();
        if (purchaseToEdit) {
            const fullDate = purchaseToEdit.date || '';
            const [d, t] = fullDate.includes(' ') ? fullDate.split(' ') : [fullDate, '12:00'];

            setHeaderData({
                date: d,
                time: t || '12:00',
                bill_no: purchaseToEdit.bill_no,
                received_date: purchaseToEdit.received_date || new Date().toISOString().split('T')[0],
                party_id: purchaseToEdit.party_id,
                gst_number: purchaseToEdit.gst_number || '',
                freight_charges: purchaseToEdit.freight_charges || 0,
                loading_charges: purchaseToEdit.loading_charges || 0,
                unloading_charges: purchaseToEdit.unloading_charges || 0,
                auto_charges: purchaseToEdit.auto_charges || 0,
                expenses_total: purchaseToEdit.expenses_total || 0,
                rcm_tax_payable: purchaseToEdit.rcm_tax_payable || 0,
                round_off: purchaseToEdit.round_off || 0
            });

            setItems([{
                product_id: purchaseToEdit.product_id,
                product_name: purchaseToEdit.product_name,
                hsn_code: purchaseToEdit.hsn_code,
                quantity: purchaseToEdit.quantity,
                unit: purchaseToEdit.unit,
                conversion_factor: purchaseToEdit.conversion_factor,
                taxable_value: purchaseToEdit.taxable_value,
                tax_rate: purchaseToEdit.tax_rate,
                cgst: purchaseToEdit.cgst,
                sgst: purchaseToEdit.sgst,
                bill_value: purchaseToEdit.bill_value
            }]);

            setPurchaseToEditId(purchaseToEdit.id);
        } else {
            resetForm();
            setPurchaseToEditId(null);
        }
    }, [purchaseToEdit, fetchParties, fetchProducts]);

    // Calculation Logic
    const calculateItemTotals = (item) => {
        const taxable = parseFloat(item.taxable_value) || 0;
        const taxRate = parseFloat(item.tax_rate) || 0;

        const cgst = (taxable * (taxRate / 2)) / 100;
        const sgst = (taxable * (taxRate / 2)) / 100;
        const taxAmount = cgst + sgst;
        const itemTotal = taxable + taxAmount;

        return {
            ...item,
            cgst: parseFloat(cgst.toFixed(2)),
            sgst: parseFloat(sgst.toFixed(2)),
            bill_value: parseFloat(itemTotal.toFixed(2))
        };
    };

    const calculateHeaderTotals = (header, currentItems) => {
        const expenses = (parseFloat(header.freight_charges) || 0) +
            (parseFloat(header.loading_charges) || 0) +
            (parseFloat(header.unloading_charges) || 0) +
            (parseFloat(header.auto_charges) || 0);

        const rcm = expenses * 0.05;

        const itemsTotal = currentItems.reduce((sum, item) => sum + (parseFloat(item.bill_value) || 0), 0);
        const rawTotal = itemsTotal + expenses;
        const roundedTotal = Math.round(rawTotal);
        const roundOff = roundedTotal - rawTotal;

        return {
            ...header,
            expenses_total: parseFloat(expenses.toFixed(2)),
            rcm_tax_payable: parseFloat(rcm.toFixed(2)),
            round_off: parseFloat(roundOff.toFixed(2)),
            grand_total: parseFloat(roundedTotal.toFixed(2))
        };
    };

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeaderData(prev => {
            const updated = { ...prev, [name]: value };
            return calculateHeaderTotals(updated, items);
        });
    };

    const handlePartyChange = (option) => {
        setHeaderData(prev => ({
            ...prev,
            party_id: option ? option.value : '',
            gst_number: option ? option.gst : ''
        }));
    };

    const handleItemInputChange = (e) => {
        const { name, value } = e.target;
        setCurrentItem(prev => {
            const updated = { ...prev, [name]: value };
            return calculateItemTotals(updated);
        });
    };

    const handleProductChange = (option) => {
        if (option) {
            const matched = productList.find(p => p.id === option.value);
            setCurrentItem(prev => ({
                ...prev,
                product_name: option.label,
                product_id: matched ? matched.id : null,
                hsn_code: matched ? matched.hsn_code : '',
                unit: matched ? matched.packing_type : '',
                conversion_factor: 1,
                tax_rate: matched ? matched.tax_rate : 0
            }));
        } else {
            resetCurrentItem();
        }
    };

    const editItem = (index) => {
        setCurrentItem(items[index]);
        setEditIndex(index);
    };

    const addItem = () => {
        if (!currentItem.product_id || !currentItem.quantity || !currentItem.taxable_value) {
            alert("Please fill all product details");
            return;
        }
        let newItems;
        if (editIndex !== null) {
            newItems = items.map((item, idx) => idx === editIndex ? currentItem : item);
            setEditIndex(null);
        } else {
            newItems = [...items, currentItem];
        }
        setItems(newItems);
        setHeaderData(prev => calculateHeaderTotals(prev, newItems));
        resetCurrentItem();
        productInputRef.current?.focus();
    };

    const removeItem = (index) => {
        if (editIndex === index) {
            setEditIndex(null);
            resetCurrentItem();
        } else if (editIndex !== null && index < editIndex) {
            setEditIndex(prev => prev - 1);
        }
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        setHeaderData(prev => calculateHeaderTotals(prev, newItems));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!headerData.party_id || !headerData.bill_no) {
            alert("Please fill Party and Bill information");
            return;
        }

        if (items.length === 0) {
            alert("Please add at least one product");
            return;
        }

        const combinedDate = `${headerData.date} ${headerData.time}`;

        const payload = {
            ...headerData,
            date: combinedDate,
            items: items
        };

        try {
            const idToUpdate = purchaseToEdit?.id || purchaseToEditId;

            if (idToUpdate) {
                if (items.length > 1) {
                    alert("Editing multi-product bills is restricted. Only the first item will be updated.");
                }
                const singleItemPayload = { ...headerData, date: combinedDate, ...items[0], product_id: items[0].product_id };
                await axios.put(`${getBaseUrl()}/purchases/${idToUpdate}`, singleItemPayload);
                alert('Purchase updated!');
            } else {
                await axios.post(`${getBaseUrl()}/purchases`, payload);
                alert('Purchase saved successfully!');
            }

            if (onSave) onSave();
            if (!purchaseToEdit) resetForm();

        } catch (error) {
            console.error('Error saving purchase:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // Importer Logic
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadFile(file);
        setPdfWarning(false);
        const reader = new FileReader();

        if (file.name.toLowerCase().endsWith('.pdf')) {
            setPdfWarning(true);
            return;
        }

        if (file.name.endsWith('.json') || file.name.endsWith('.jsonl')) {
            reader.onload = (event) => {
                try {
                    let data = [];
                    if (file.name.endsWith('.jsonl')) {
                        const lines = event.target.result.split('\n');
                        data = lines.filter(l => l.trim()).map(l => JSON.parse(l));
                    } else {
                        data = JSON.parse(event.target.result);
                        if (!Array.isArray(data)) data = [data];
                    }
                    if (data.length > 0) {
                        const headers = Object.keys(data[0]);
                        setParsedHeaders(headers);
                        autoMatchMapping(headers);
                        setRawDataRows(data);
                        setImportStep('mapping');
                    } else {
                        alert('Empty JSON file.');
                    }
                } catch (err) {
                    alert('Failed to parse JSON file');
                }
            };
            reader.readAsText(file);
        } else {
            reader.onload = (event) => {
                try {
                    const bstr = event.target.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws, { header: 1, cellDates: true });
                    if (data.length > 0) {
                        // Scan for header row index (scanning first 15 rows)
                        let headerRowIdx = 0;
                        let maxMatches = 0;
                        const headerKeywords = ['date', 'bill', 'inv', 'party', 'particular', 'ledger', 'qty', 'bag', 'quantity', 'amount', 'value', 'total', 'rate', 'item', 'product'];
                        for (let r = 0; r < Math.min(15, data.length); r++) {
                            const row = data[r];
                            if (!Array.isArray(row)) continue;
                            let matches = 0;
                            row.forEach(cell => {
                                const val = String(cell || '').toLowerCase();
                                if (headerKeywords.some(kw => val.includes(kw))) {
                                    matches++;
                                }
                            });
                            if (matches > maxMatches) {
                                maxMatches = matches;
                                headerRowIdx = r;
                            }
                        }

                        const headers = data[headerRowIdx].map(h => String(h || '').trim());
                        setParsedHeaders(headers);
                        autoMatchMapping(headers);
                        setRawDataRows(data.slice(headerRowIdx + 1));
                        setImportStep('mapping');
                    } else {
                        alert('File has insufficient rows.');
                    }
                } catch (err) {
                    alert('Failed to parse Excel file');
                }
            };
            reader.readAsBinaryString(file);
        }
    };

    const autoMatchMapping = (headers) => {
        const mapping = {
            date: '',
            bill_no: '',
            party_name: '',
            gstin: '',
            product_name: '',
            hsn_code: '',
            gst_rate: '',
            quantity: '',
            unit: '',
            taxable_value: '',
            cgst: '',
            sgst: '',
            round_off: '',
            total: ''
        };
        headers.forEach(h => {
            const lower = h.toLowerCase();
            if (lower.includes('date')) mapping.date = h;
            else if (lower.includes('bill') || lower.includes('inv') || lower.includes('voucher') || lower.includes('invoice') || lower.includes('no')) {
                if (!mapping.bill_no) mapping.bill_no = h;
            }
            else if (lower.includes('party') || lower.includes('ledger') || lower.includes('particular') || lower.includes('vendor') || lower.includes('supplier')) {
                if (!mapping.party_name) mapping.party_name = h;
            }
            else if (lower.includes('gstin') || lower.includes('uin')) {
                mapping.gstin = h;
            }
            else if (lower.includes('hsn') || lower.includes('code')) {
                mapping.hsn_code = h;
            }
            else if (lower.includes('gst rate') || (lower.includes('rate') && !lower.includes('taxable') && !lower.includes('gross') && !lower.includes('value') && !lower.includes('amount') && !lower.includes('total'))) {
                mapping.gst_rate = h;
            }
            else if (lower.includes('qty') || lower.includes('bag') || lower.includes('quantity') || lower.includes('volume') || lower.includes('can')) {
                mapping.quantity = h;
            }
            else if (lower === 'unit' || lower === 'uom' || lower === 'packing' || lower === 'pkg' || lower === 'measure' || lower === 'qty unit' || lower === 'quantity unit') {
                mapping.unit = h;
            }
            else if (lower.includes('gross') || lower.includes('taxable') || (lower.includes('value') && !lower.includes('total') && !lower.includes('net') && !lower.includes('round')) || (lower.includes('amount') && !lower.includes('total') && !lower.includes('net') && !lower.includes('round'))) {
                mapping.taxable_value = h;
            }
            else if (lower.includes('cgst')) {
                mapping.cgst = h;
            }
            else if (lower.includes('sgst')) {
                mapping.sgst = h;
            }
            else if (lower.includes('round') || lower.includes('off')) {
                mapping.round_off = h;
            }
            else if (lower.includes('total') || lower.includes('net value') || lower.includes('grand total')) {
                mapping.total = h;
            }
        });

        // Default product_name to same column as party_name (Particulars) for look-ahead
        if (mapping.party_name) {
            mapping.product_name = mapping.party_name;
        }

        setColumnMapping(mapping);
    };

    const handleMappingChange = (field, value) => {
        setColumnMapping(prev => ({ ...prev, [field]: value }));
    };

    const generatePreview = async () => {
        // Load existing bills to check duplicates (grouped by party + bill_no)
        let dbPurchases = new Set();
        try {
            const res = await axios.get(`${getBaseUrl()}/purchases`);
            res.data.forEach(p => {
                dbPurchases.add(`${String(p.bill_no).trim().toLowerCase()}_${p.party_id}`);
            });
        } catch (e) {
            console.error(e);
        }

        const preview = [];
        const isJson = uploadFile && (uploadFile.name.endsWith('.json') || uploadFile.name.endsWith('.jsonl'));

        const dateIdx = parsedHeaders.indexOf(columnMapping.date);
        const billIdx = parsedHeaders.indexOf(columnMapping.bill_no);
        const partyIdx = parsedHeaders.indexOf(columnMapping.party_name);
        const prodIdx = parsedHeaders.indexOf(columnMapping.product_name);
        const gstinIdx = parsedHeaders.indexOf(columnMapping.gstin);
        const hsnIdx = parsedHeaders.indexOf(columnMapping.hsn_code);
        const rateIdx = parsedHeaders.indexOf(columnMapping.gst_rate);
        const qtyIdx = parsedHeaders.indexOf(columnMapping.quantity);
        const unitIdx = parsedHeaders.indexOf(columnMapping.unit);
        const valIdx = parsedHeaders.indexOf(columnMapping.taxable_value);
        const cgstIdx = parsedHeaders.indexOf(columnMapping.cgst);
        const sgstIdx = parsedHeaders.indexOf(columnMapping.sgst);
        const roundIdx = parsedHeaders.indexOf(columnMapping.round_off);
        const totalIdx = parsedHeaders.indexOf(columnMapping.total);

        for (let i = 0; i < rawDataRows.length; i++) {
            const row = rawDataRows[i];
            if (!row) continue;

            let dateVal = '';
            let billNoVal = '';
            let partyNameVal = '';
            let gstinVal = '';
            let productNameVal = '';
            let hsnCodeVal = '';
            let gstRateVal = '';
            let quantityVal = '';
            let unitVal = '';
            let taxableValueVal = '';
            let cgstVal = '';
            let sgstVal = '';
            let roundOffVal = '';
            let totalVal = '';

            if (isJson) {
                dateVal = row[columnMapping.date] !== undefined ? String(row[columnMapping.date]) : '';
                billNoVal = row[columnMapping.bill_no] !== undefined ? String(row[columnMapping.bill_no]) : '';
                partyNameVal = row[columnMapping.party_name] !== undefined ? String(row[columnMapping.party_name]) : '';
                gstinVal = row[columnMapping.gstin] !== undefined ? String(row[columnMapping.gstin]) : '';
                productNameVal = row[columnMapping.product_name] !== undefined ? String(row[columnMapping.product_name]) : '';
                hsnCodeVal = row[columnMapping.hsn_code] !== undefined ? String(row[columnMapping.hsn_code]) : '';
                gstRateVal = row[columnMapping.gst_rate] !== undefined ? String(row[columnMapping.gst_rate]) : '';
                quantityVal = row[columnMapping.quantity] !== undefined ? String(row[columnMapping.quantity]) : '';
                unitVal = row[columnMapping.unit] !== undefined ? String(row[columnMapping.unit]) : '';
                taxableValueVal = row[columnMapping.taxable_value] !== undefined ? String(row[columnMapping.taxable_value]) : '';
                cgstVal = row[columnMapping.cgst] !== undefined ? String(row[columnMapping.cgst]) : '';
                sgstVal = row[columnMapping.sgst] !== undefined ? String(row[columnMapping.sgst]) : '';
                roundOffVal = row[columnMapping.round_off] !== undefined ? String(row[columnMapping.round_off]) : '';
                totalVal = row[columnMapping.total] !== undefined ? String(row[columnMapping.total]) : '';
            } else {
                dateVal = dateIdx !== -1 && row[dateIdx] !== undefined ? row[dateIdx] : '';
                billNoVal = billIdx !== -1 && row[billIdx] !== undefined ? row[billIdx] : '';
                partyNameVal = partyIdx !== -1 && row[partyIdx] !== undefined ? row[partyIdx] : '';
                gstinVal = gstinIdx !== -1 && row[gstinIdx] !== undefined ? row[gstinIdx] : '';
                productNameVal = prodIdx !== -1 && row[prodIdx] !== undefined ? row[prodIdx] : '';
                hsnCodeVal = hsnIdx !== -1 && row[hsnIdx] !== undefined ? row[hsnIdx] : '';
                gstRateVal = rateIdx !== -1 && row[rateIdx] !== undefined ? row[rateIdx] : '';
                quantityVal = qtyIdx !== -1 && row[qtyIdx] !== undefined ? row[qtyIdx] : '';
                unitVal = unitIdx !== -1 && row[unitIdx] !== undefined ? row[unitIdx] : '';
                taxableValueVal = valIdx !== -1 && row[valIdx] !== undefined ? row[valIdx] : '';
                cgstVal = cgstIdx !== -1 && row[cgstIdx] !== undefined ? row[cgstIdx] : '';
                sgstVal = sgstIdx !== -1 && row[sgstIdx] !== undefined ? row[sgstIdx] : '';
                roundOffVal = roundIdx !== -1 && row[roundIdx] !== undefined ? row[roundIdx] : '';
                totalVal = totalIdx !== -1 && row[totalIdx] !== undefined ? row[totalIdx] : '';
            }

            const dateStr = formatDateValue(dateVal);
            const billNoStr = String(billNoVal).trim();
            const partyNameStr = String(partyNameVal).trim();

            // Skip conditions: empty spacers and total/summary lines
            if (!dateStr && !billNoStr && !partyNameStr) continue;
            const lowerParty = partyNameStr.toLowerCase();
            const lowerDate = dateStr.toLowerCase();
            if (lowerParty.includes('total') || lowerParty.includes('grand') || lowerParty.includes('summary') ||
                lowerDate.includes('total') || lowerDate.includes('grand') || lowerDate.includes('summary')) {
                continue;
            }

            // Look-ahead logic: find the product name on the next row's Particulars column
            let finalProductName = '';
            let hasProductRow = false;
            if (i + 1 < rawDataRows.length) {
                const nextRow = rawDataRows[i + 1];
                if (nextRow) {
                    let nextParticularsVal = '';
                    if (isJson) {
                        nextParticularsVal = nextRow[columnMapping.party_name] !== undefined ? String(nextRow[columnMapping.party_name]) : '';
                    } else {
                        nextParticularsVal = partyIdx !== -1 && nextRow[partyIdx] !== undefined ? nextRow[partyIdx] : '';
                    }

                    // Check if next row does NOT contain a new transaction (empty date, bill_no)
                    let nextDateVal = '';
                    let nextBillNoVal = '';
                    if (isJson) {
                        nextDateVal = nextRow[columnMapping.date] !== undefined ? String(nextRow[columnMapping.date]) : '';
                        nextBillNoVal = nextRow[columnMapping.bill_no] !== undefined ? String(nextRow[columnMapping.bill_no]) : '';
                    } else {
                        nextDateVal = dateIdx !== -1 && nextRow[dateIdx] !== undefined ? nextRow[dateIdx] : '';
                        nextBillNoVal = billIdx !== -1 && nextRow[billIdx] !== undefined ? nextRow[billIdx] : '';
                    }

                    const nextDateStr = formatDateValue(nextDateVal);
                    const nextBillNoStr = String(nextBillNoVal).trim();

                    if (!nextDateStr && !nextBillNoStr && nextParticularsVal) {
                        finalProductName = String(nextParticularsVal).trim();
                        hasProductRow = true;
                    }
                }
            }

            // Fallback to current row's product_name if not found in look-ahead
            if (!finalProductName) {
                finalProductName = String(productNameVal).trim();
            }

            if (hasProductRow) {
                i++; // Consumed the product row, so increment index i to skip it
            }

            const parseRes = parseQuantityAndUnit(quantityVal);
            let qtyValParsed = parseRes.qty;
            let parsedUnit = parseRes.unit;
            if (unitVal) {
                parsedUnit = String(unitVal).trim().toUpperCase();
            }

            const valueVal = parseNumberValue(taxableValueVal);
            const numCgst = parseNumberValue(cgstVal);
            const numSgst = parseNumberValue(sgstVal);
            const numRoundOff = parseNumberValue(roundOffVal);
            const numTotal = parseNumberValue(totalVal);

            const mapped = {
                date: dateStr,
                bill_no: billNoStr,
                party_name: partyNameStr,
                gstin: String(gstinVal).trim(),
                product_name: finalProductName,
                hsn_code: String(hsnCodeVal).trim(),
                gst_rate: parseNumberValue(gstRateVal),
                quantity: qtyValParsed,
                unit: parsedUnit,
                taxable_value: valueVal,
                cgst: numCgst,
                sgst: numSgst,
                round_off: numRoundOff,
                total: numTotal
            };

            // Basic Validation
            const errors = {};
            if (!mapped.date) errors.date = 'Date is required';
            if (!mapped.bill_no) errors.bill_no = 'Bill number is required';
            if (!mapped.party_name) errors.party_name = 'Party/Vendor name is required';
            if (!mapped.product_name) errors.product_name = 'Product name is required';

            if (mapped.quantity <= 0) errors.quantity = 'Quantity must be positive number';
            if (mapped.taxable_value <= 0) errors.taxable_value = 'Taxable value must be positive number';

            // Check if party & product exists in database copies
            const matchedParty = parties.find(p => p.name.toLowerCase() === mapped.party_name.toLowerCase());
            const partyExists = !!matchedParty;
            const productExists = productList.some(p => p.name.toLowerCase() === mapped.product_name.toLowerCase());

            // Check duplicate bills
            if (matchedParty && dbPurchases.has(`${mapped.bill_no.toLowerCase()}_${matchedParty.id}`)) {
                errors.bill_no = 'Duplicate invoice number for this vendor';
            }

            preview.push({
                index: i + 1,
                ...mapped,
                partyExists,
                productExists,
                errors
            });
        }

        setPreviewData(preview);
        setImportStep('preview');
    };

    const startImport = async () => {
        setImportStep('importing');
        
        // Group rows with identical bill_no + party_name to submit as single multi-product purchases
        const groupedInvoices = {};
        previewData.forEach(row => {
            if (Object.keys(row.errors).length > 0) return;
            const key = `${row.bill_no.trim().toLowerCase()}_${row.party_name.trim().toLowerCase()}`;
            if (!groupedInvoices[key]) {
                groupedInvoices[key] = {
                    date: row.date,
                    bill_no: row.bill_no,
                    party_name: row.party_name,
                    items: []
                };
            }
            groupedInvoices[key].items.push(row);
        });

        const invoiceKeys = Object.keys(groupedInvoices);
        setImportProgress({ current: 0, total: invoiceKeys.length });
        const logs = [];
        const createdProducts = [];

        for (let i = 0; i < invoiceKeys.length; i++) {
            const key = invoiceKeys[i];
            const invoice = groupedInvoices[key];
            setImportProgress(prev => ({ ...prev, current: i + 1 }));

            try {
                // 1. Resolve Party/Vendor
                let partyId = null;
                const matchedParty = parties.find(p => p.name.toLowerCase() === invoice.party_name.toLowerCase());
                if (matchedParty) {
                    partyId = matchedParty.id;
                    if (invoice.items[0]?.gstin && (!matchedParty.gst_number || matchedParty.gst_number !== invoice.items[0].gstin)) {
                        logs.push({ status: 'info', msg: `Updating GSTIN for Vendor "${invoice.party_name}"` });
                        await axios.put(`${getBaseUrl()}/parties/${partyId}`, {
                            ...matchedParty,
                            gst_number: invoice.items[0].gstin
                        });
                        matchedParty.gst_number = invoice.items[0].gstin; // Update local cache
                    }
                } else {
                    logs.push({ status: 'info', msg: `Creating Vendor: "${invoice.party_name}"` });
                    const pRes = await axios.post(`${getBaseUrl()}/parties`, {
                        name: invoice.party_name,
                        gst_number: invoice.items[0]?.gstin || '',
                        maintain_balance: 1
                    });
                    partyId = pRes.data.id;
                    parties.push({ id: partyId, name: invoice.party_name, gst_number: invoice.items[0]?.gstin });
                }

                // 2. Resolve Items & Products
                const payloadItems = [];
                for (const item of invoice.items) {
                    let productId = null;
                    let hsn = item.hsn_code || '9999';
                    let taxRate = item.gst_rate || 18;
                    let packingType = 'BAG';
                    let unit = 'BAG';
                    let conversionFactor = 1.0;

                    const matchedProduct = productList.find(p => p.name.toLowerCase() === item.product_name.toLowerCase());
                    if (matchedProduct) {
                        productId = matchedProduct.id;
                        hsn = item.hsn_code || matchedProduct.hsn_code || '9999';
                        taxRate = item.gst_rate || matchedProduct.tax_rate || 18;
                        packingType = matchedProduct.packing_type || 'BAG';

                        const rowUnit = String(item.unit || '').toUpperCase().trim();
                        const primUnit = String(matchedProduct.packing_type || '').toUpperCase().trim();
                        const secUnit = String(matchedProduct.secondary_unit || '').toUpperCase().trim();

                        if (rowUnit && matchedProduct.has_dual_units && rowUnit === secUnit) {
                            unit = matchedProduct.secondary_unit;
                            conversionFactor = matchedProduct.conversion_rate ? (1.0 / parseFloat(matchedProduct.conversion_rate)) : 1.0;
                        } else if (rowUnit && rowUnit === primUnit) {
                            unit = matchedProduct.packing_type;
                            conversionFactor = 1.0;
                        } else {
                            unit = matchedProduct.packing_type || 'BAG';
                            conversionFactor = 1.0;
                        }
                    } else {
                        logs.push({ status: 'info', msg: `Creating Product: "${item.product_name}"` });
                        const prodRes = await axios.post(`${getBaseUrl()}/products`, {
                            name: item.product_name,
                            hsn_code: hsn,
                            tax_rate: taxRate,
                            packing_type: packingType,
                            maintain_stock: 1
                        });
                        productId = prodRes.data.id;
                        productList.push({ id: productId, name: item.product_name, hsn_code: hsn, tax_rate: taxRate, packing_type: packingType });
                        createdProducts.push({ id: productId, name: item.product_name });
                    }

                    // Calculate taxes for item or use Excel values
                    const qty = parseFloat(item.quantity);
                    const taxable = parseFloat(item.taxable_value);
                    const cgst = item.cgst !== undefined && item.cgst !== 0 ? item.cgst : parseFloat(((taxable * (taxRate / 2)) / 100).toFixed(2));
                    const sgst = item.sgst !== undefined && item.sgst !== 0 ? item.sgst : parseFloat(((taxable * (taxRate / 2)) / 100).toFixed(2));
                    const bill_value = item.total !== undefined && item.total !== 0 ? item.total : parseFloat((taxable + cgst + sgst).toFixed(2));

                    payloadItems.push({
                        product_id: productId,
                        product_name: item.product_name,
                        hsn_code: hsn,
                        quantity: qty,
                        unit: unit,
                        conversion_factor: conversionFactor,
                        taxable_value: taxable,
                        tax_rate: taxRate,
                        cgst,
                        sgst,
                        bill_value
                    });
                }

                // Standard payload format
                const finalDate = invoice.date.includes(' ') ? invoice.date : `${invoice.date} 12:00`;
                const purchasePayload = {
                    date: finalDate,
                    received_date: invoice.date,
                    bill_no: invoice.bill_no,
                    party_id: partyId,
                    gst_number: invoice.items[0]?.gstin || '',
                    freight_charges: 0,
                    loading_charges: 0,
                    unloading_charges: 0,
                    auto_charges: 0,
                    expenses_total: 0,
                    rcm_tax_payable: 0,
                    round_off: 0,
                    items: payloadItems
                };

                // Add round off
                const itemsTotal = payloadItems.reduce((sum, item) => sum + item.bill_value, 0);
                const roundedTotal = Math.round(itemsTotal);
                const excelRoundOff = invoice.items[0]?.round_off;
                purchasePayload.round_off = excelRoundOff !== undefined && excelRoundOff !== 0 ? excelRoundOff : parseFloat((roundedTotal - itemsTotal).toFixed(2));

                await axios.post(`${getBaseUrl()}/purchases`, purchasePayload);
                logs.push({ status: 'success', msg: `Invoice ${invoice.bill_no} containing ${payloadItems.length} products imported.` });

            } catch (err) {
                console.error(err);
                logs.push({ status: 'error', msg: `Invoice ${invoice.bill_no} failed: ${err.response?.data?.error || err.message}` });
            }
        }

        // Handle skipped lines
        const errorsCount = previewData.filter(r => Object.keys(r.errors).length > 0).length;
        if (errorsCount > 0) {
            logs.push({ status: 'error', msg: `Skipped ${errorsCount} rows containing errors.` });
        }

        setImportLogs(logs);
        setImportStep('finished');

        fetchParties();
        fetchProducts();

        if (createdProducts.length > 0) {
            setNewProductsCreated(createdProducts);
            setShowBomPrompt(true);
        }
    };

    return (
        <div className="bg-[#0c1122] rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden max-w-6xl mx-auto">
            <div className="bg-slate-900/80 p-6 border-b border-slate-800/80 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-emerald-600 rounded-lg text-white"><ShoppingCart size={20} /></div>
                    <span className="text-slate-100">{purchaseToEdit ? 'Edit Purchase' : 'New Purchase Entry'}</span>
                </h2>
                <div className="flex gap-3">
                    {!purchaseToEdit && (
                        <button
                            type="button"
                            onClick={() => {
                                setUploadFile(null);
                                setImportStep('select');
                                setPdfWarning(false);
                                setPreviewData([]);
                                setShowImportModal(true);
                            }}
                            className="bg-slate-800 text-slate-200 hover:text-white px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Upload size={16} /> Import File
                        </button>
                    )}
                    <div className="text-sm opacity-80 text-emerald-400 font-mono hidden md:block">
                        Multi-Product Supported
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Header Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-5 bg-slate-900/40 rounded-2xl border border-slate-800/60">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bill Date & Time</label>
                        <div className="flex gap-2">
                            <input
                                ref={dateInputRef}
                                type="date"
                                name="date"
                                value={headerData.date}
                                onChange={handleHeaderChange}
                                required
                                className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono outline-none"
                            />
                            <input
                                type="time"
                                name="time"
                                value={headerData.time}
                                onChange={handleHeaderChange}
                                className="w-24 p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bill Number</label>
                        <input
                            type="text"
                            name="bill_no"
                            value={headerData.bill_no}
                            onChange={handleHeaderChange}
                            required
                            placeholder="e.g. INV-001"
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono outline-none"
                        />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Party / Vendor</label>
                        <SearchableSelect
                            placeholder="Select Vendor..."
                            options={parties.map(p => ({ value: p.id, label: p.name, gst: p.gst_number }))}
                            value={headerData.party_id}
                            onChange={handlePartyChange}
                            onNext={() => productInputRef.current?.focus()}
                            inputRef={partyInputRef}
                        />
                        {headerData.gst_number && <div className="text-[10px] text-emerald-400 font-mono mt-1">GST: {headerData.gst_number}</div>}
                    </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/20">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="p-3.5">Product</th>
                                <th className="p-3.5 text-right">Qty</th>
                                <th className="p-3.5 text-center">Unit</th>
                                <th className="p-3.5 text-right">Taxable</th>
                                <th className="p-3.5 text-right">Tax%</th>
                                <th className="p-3.5 text-right">Total</th>
                                <th className="p-3.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                            {items.map((item, index) => {
                                const isEditing = editIndex === index;
                                return (
                                    <tr 
                                        key={index} 
                                        className={`hover:bg-slate-900/40 transition-colors ${
                                            isEditing ? 'bg-blue-950/30 border-l-2 border-l-blue-500 hover:bg-blue-950/45' : ''
                                        }`}
                                    >
                                        <td className="p-3 font-semibold text-slate-200">{item.product_name}</td>
                                        <td className="p-3 text-right font-mono">{item.quantity}</td>
                                        <td className="p-3 text-center text-slate-400">{item.unit}</td>
                                        <td className="p-3 text-right font-mono">₹{parseFloat(item.taxable_value).toFixed(2)}</td>
                                        <td className="p-3 text-right font-mono">{item.tax_rate}%</td>
                                        <td className="p-3 text-right font-bold text-emerald-400 font-mono">₹{parseFloat(item.bill_value).toFixed(2)}</td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => editItem(index)} 
                                                    className={`hover:scale-110 transition-transform ${isEditing ? 'text-blue-400' : 'text-slate-400 hover:text-blue-400'}`}
                                                    title="Edit item"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeItem(index)} 
                                                    className="text-red-400 hover:text-red-300 hover:scale-110 transition-transform"
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-500 italic">No products added to this invoice yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Add/Edit Item Row */}
                    <div className={`p-4 grid grid-cols-1 md:grid-cols-7 gap-3 items-end border-t border-slate-800 transition-colors duration-300 ${
                        editIndex !== null ? 'bg-blue-950/20' : 'bg-emerald-950/20'
                    }`}>
                        <div className="md:col-span-2 space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                                editIndex !== null ? 'text-blue-400' : 'text-emerald-400'
                            }`}>Product</label>
                            <SearchableSelect
                                placeholder="Search Product..."
                                options={productList.map(p => ({ value: p.id, label: p.name, hsn: p.hsn_code, packing: p.packing_type, tax: p.tax_rate }))}
                                value={currentItem.product_name}
                                onChange={handleProductChange}
                                onNext={() => quantityInputRef.current?.focus()}
                                inputRef={productInputRef}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                                editIndex !== null ? 'text-blue-400' : 'text-emerald-400'
                            }`}>Qty</label>
                            <input
                                ref={quantityInputRef}
                                type="number"
                                name="quantity"
                                value={currentItem.quantity}
                                onChange={handleItemInputChange}
                                className="w-full p-2 bg-slate-950 border border-slate-800 text-slate-100 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                                editIndex !== null ? 'text-blue-400' : 'text-emerald-400'
                            }`}>Unit</label>
                            <input
                                type="text"
                                value={currentItem.unit}
                                readOnly
                                className="w-full p-2 bg-slate-900 border border-slate-800 text-slate-400 rounded text-center font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                                editIndex !== null ? 'text-blue-400' : 'text-emerald-400'
                            }`}>Value</label>
                            <input
                                type="number"
                                name="taxable_value"
                                value={currentItem.taxable_value}
                                onChange={handleItemInputChange}
                                className="w-full p-2 bg-slate-950 border border-slate-800 text-slate-100 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                            />
                        </div>
                        <div className="space-y-1.5 text-center">
                            <label className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                                editIndex !== null ? 'text-blue-400' : 'text-emerald-400'
                            }`}>Tax ({currentItem.tax_rate}%)</label>
                            <div className={`text-xs font-mono pt-2 transition-colors duration-300 ${
                                editIndex !== null ? 'text-blue-400' : 'text-emerald-400'
                            }`}>
                                ₹{(currentItem.cgst + currentItem.sgst).toFixed(2)}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                            <button
                                type="button"
                                onClick={addItem}
                                className={`w-full text-white p-2 rounded font-bold flex justify-center items-center gap-1 shadow-md transition-colors duration-300 cursor-pointer ${
                                    editIndex !== null 
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10' 
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                                }`}
                            >
                                {editIndex !== null ? <Check size={16} /> : <Plus size={16} />}
                                <span>{editIndex !== null ? 'Update Item' : 'Add Item'}</span>
                            </button>
                            {editIndex !== null && (
                                <button
                                    type="button"
                                    onClick={resetCurrentItem}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded font-semibold text-center text-[10px] cursor-pointer transition-colors duration-300"
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Expenses Footer */}
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800/60">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Freight</label>
                            <input type="number" name="freight_charges" value={headerData.freight_charges} onChange={handleHeaderChange} className="w-full p-2 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Loading</label>
                            <input type="number" name="loading_charges" value={headerData.loading_charges} onChange={handleHeaderChange} className="w-full p-2 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Unloading</label>
                            <input type="number" name="unloading_charges" value={headerData.unloading_charges} onChange={handleHeaderChange} className="w-full p-2 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Auto</label>
                            <input type="number" name="auto_charges" value={headerData.auto_charges} onChange={handleHeaderChange} className="w-full p-2 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total Expenses</label>
                            <div className="p-2 bg-slate-950 border border-slate-800 rounded font-bold text-slate-300 text-right font-mono">{headerData.expenses_total}</div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-end items-center gap-6 border-t border-slate-800 pt-4">
                        <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Products Value</div>
                            <div className="text-xl font-bold text-slate-200 font-mono">
                                ₹{items.reduce((sum, item) => sum + (parseFloat(item.bill_value) || 0), 0).toFixed(2)}
                            </div>
                        </div>
                        <div className="text-xl text-slate-600 font-light">+</div>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Expenses & Taxes</div>
                            <div className="text-base font-bold text-slate-300 font-mono">
                                ₹{(
                                    parseFloat(headerData.expenses_total || 0) +
                                    parseFloat(headerData.rcm_tax_payable || 0) +
                                    parseFloat(headerData.round_off || 0)
                               ).toFixed(2)}
                            </div>
                        </div>
                        <div className="text-xl text-slate-600 font-light">=</div>
                        <div className="text-right bg-emerald-950/20 p-3 rounded-2xl border border-emerald-500/20">
                            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Grand Total</div>
                            <div className="text-2xl font-bold text-emerald-400 font-mono">₹{headerData.grand_total || '0.00'}</div>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/10 active:scale-[0.99] transition-all flex justify-center items-center gap-2 cursor-pointer"
                >
                    <Save size={20} />
                    <span>Save Purchase Entry</span>
                </button>
            </form>

            {/* Purchase Bulk Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0d1220] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <Upload size={20} className="text-emerald-500" />
                                <span>Bulk Import Purchases</span>
                            </h3>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 text-slate-300">
                            {importStep === 'select' && (
                                <div className="space-y-6 text-center py-10">
                                    <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-8 transition-colors flex flex-col items-center justify-center bg-slate-950/40">
                                        <Upload size={48} className="text-slate-500 mb-4" />
                                        <span className="text-sm font-semibold text-slate-200 mb-1">Select purchase report file</span>
                                        <span className="text-xs text-slate-500 mb-4">Excel (.xlsx, .xls), CSV, JSON, or JSONL files exported from Tally/ERP</span>
                                        <input
                                            type="file"
                                            id="purchaseImportFile"
                                            accept=".xlsx,.xls,.csv,.json,.jsonl,.pdf"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="purchaseImportFile"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-lg text-sm"
                                        >
                                            Browse Files
                                        </label>
                                    </div>

                                    {pdfWarning && (
                                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 flex gap-3 text-left">
                                            <AlertCircle size={20} className="shrink-0" />
                                            <div>
                                                <div className="font-bold text-sm">PDF Files Cannot Be Parsed Directly</div>
                                                <p className="text-xs mt-1">Please convert your PDF report to Excel (.xlsx) or CSV format first using any free online tool, then select the converted file.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {importStep === 'mapping' && (
                                <div className="space-y-6">
                                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
                                        <span className="font-bold text-emerald-400 uppercase tracking-wide">Column Mapping step:</span>
                                        <p className="text-slate-400 mt-1">Map the report headers to the purchase entry fields below. We have pre-matched common terms.</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {Object.keys(columnMapping).map((field) => {
                                            const isOptional = ['gstin', 'hsn_code', 'gst_rate', 'cgst', 'sgst', 'round_off', 'total', 'product_name', 'unit'].includes(field);
                                            return (
                                                <div key={field} className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                                        {field.replace('_', ' ')} {isOptional ? '(Optional)' : '*'}
                                                    </label>
                                                    <select
                                                        value={columnMapping[field]}
                                                        onChange={(e) => handleMappingChange(field, e.target.value)}
                                                        className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg text-sm outline-none"
                                                    >
                                                        <option value="">-- Choose Column --</option>
                                                        {parsedHeaders.map(h => (
                                                            <option key={h} value={h}>{h}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                                        <button
                                            onClick={generatePreview}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-lg shadow-lg text-sm cursor-pointer"
                                        >
                                            Preview Data & Validate
                                        </button>
                                    </div>
                                </div>
                            )}

                            {importStep === 'preview' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                                        <div className="text-xs">
                                            <span className="font-bold text-slate-200 block">Previewing {previewData.length} records:</span>
                                            <span className="text-slate-400">Identical invoices (matching Bill No and Vendor) will be grouped automatically. Errors are highlighted in red.</span>
                                        </div>
                                        <button
                                            onClick={startImport}
                                            disabled={previewData.some(r => Object.keys(r.errors).length > 0)}
                                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-lg shadow-lg text-sm transition-colors cursor-pointer"
                                        >
                                            Proceed to Import
                                        </button>
                                    </div>

                                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider sticky top-0">
                                                <tr className="border-b border-slate-800">
                                                    <th className="p-3 text-center">Row</th>
                                                    <th className="p-3">Bill No</th>
                                                    <th className="p-3">Date</th>
                                                    <th className="p-3">Vendor</th>
                                                    <th className="p-3">Product Name</th>
                                                    <th className="p-3 text-right">Qty</th>
                                                    <th className="p-3 text-right">Taxable Value</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                                                {previewData.map((row) => {
                                                    const hasError = Object.keys(row.errors).length > 0;
                                                    return (
                                                        <tr
                                                            key={row.index}
                                                            className={`hover:bg-slate-900/60 ${hasError ? 'bg-red-500/5' : ''}`}
                                                        >
                                                            <td className="p-3 text-slate-500 text-center font-mono">{row.index}</td>
                                                            <td className="p-3 font-mono">
                                                                {row.errors.bill_no ? (
                                                                    <div className="border border-red-500/50 bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-[11px] font-bold max-w-fit" title={row.errors.bill_no}>
                                                                        {row.bill_no || 'Missing'} - {row.errors.bill_no}
                                                                    </div>
                                                                ) : (
                                                                    row.bill_no
                                                                )}
                                                            </td>
                                                            <td className="p-3 font-mono">
                                                                {row.errors.date ? (
                                                                    <span className="text-red-400 underline font-bold" title={row.errors.date}>{row.date || 'Empty'}</span>
                                                                ) : (
                                                                    row.date
                                                                )}
                                                            </td>
                                                            <td className="p-3">
                                                                {row.party_name}
                                                                {!row.partyExists && (
                                                                    <span className="ml-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">New Vendor</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3">
                                                                {row.product_name}
                                                                {!row.productExists && (
                                                                    <span className="ml-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">New Product</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-mono">
                                                                {row.errors.quantity ? (
                                                                    <span className="text-red-400 font-bold" title={row.errors.quantity}>{row.quantity}</span>
                                                                ) : (
                                                                    row.quantity
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-bold text-slate-200">
                                                                {row.errors.taxable_value ? (
                                                                    <span className="text-red-400 font-bold" title={row.errors.taxable_value}>{row.taxable_value}</span>
                                                                ) : (
                                                                    `₹${parseFloat(row.taxable_value).toFixed(2)}`
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {importStep === 'importing' && (
                                <div className="space-y-6 text-center py-10 flex flex-col items-center">
                                    <Loader2 size={40} className="text-emerald-500 animate-spin mb-4" />
                                    <div className="text-sm font-semibold text-slate-200">Importing Purchases...</div>
                                    <div className="text-xs text-slate-500 mt-1">Processed {importProgress.current} of {importProgress.total} invoices</div>
                                    <div className="w-full bg-slate-900 rounded-full h-2 max-w-md mt-4 border border-slate-800">
                                        <div
                                            className="bg-emerald-500 h-2 rounded-full transition-all duration-200"
                                            style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {importStep === 'finished' && (
                                <div className="space-y-6">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-4 flex gap-3 text-left items-center">
                                        <Check size={24} className="shrink-0" />
                                        <div>
                                            <div className="font-bold">Purchases Imported Successfully!</div>
                                            <p className="text-xs mt-0.5">Transactions have been saved. Review details below.</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-60 overflow-y-auto font-mono text-xs space-y-1">
                                        {importLogs.map((log, idx) => (
                                            <div
                                                key={idx}
                                                className={
                                                    log.status === 'success' ? 'text-emerald-400' :
                                                    log.status === 'error' ? 'text-rose-400' : 'text-blue-400'
                                                }
                                            >
                                                [{log.status.toUpperCase()}] {log.msg}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-lg text-sm cursor-pointer"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Post-Import BOM prompt Modal */}
            {showBomPrompt && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[55] flex items-center justify-center p-4">
                    <div className="bg-[#0d1220] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl animate-fade-in">
                        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <Sparkles size={20} className="text-amber-400" />
                                <span>Configure Bill of Materials (BOM)</span>
                            </h3>
                            <button
                                onClick={() => {
                                    setShowBomPrompt(false);
                                    setSelectedBomProduct(null);
                                }}
                                className="text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {!selectedBomProduct ? (
                                <div className="space-y-4">
                                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-xs">
                                        <p className="font-semibold text-sm mb-1">New Products Created During Import</p>
                                        We auto-created some products from your import file. If these are finished goods you manufacture, define their recipe formulas (BOM) below. Skip for raw materials.
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Product to configure:</label>
                                        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                                            {newProductsCreated.map(p => (
                                                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
                                                    <span className="font-semibold text-sm text-slate-200">{p.name}</span>
                                                    <button
                                                        onClick={() => setSelectedBomProduct(p)}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer"
                                                    >
                                                        Configure BOM
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4 border-t border-slate-800">
                                        <button
                                            onClick={() => {
                                                setShowBomPrompt(false);
                                                setSelectedBomProduct(null);
                                            }}
                                            className="text-slate-400 hover:text-slate-200 text-sm font-semibold cursor-pointer"
                                        >
                                            Skip All
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-h-[70vh] overflow-y-auto">
                                    <ProductFormulas
                                        productId={selectedBomProduct.id}
                                        productName={selectedBomProduct.name}
                                        isModal={false}
                                    />
                                    <div className="flex justify-end p-4 border-t border-slate-800 bg-slate-900/40 mt-4 rounded-xl">
                                        <button
                                            onClick={() => {
                                                const remaining = newProductsCreated.filter(p => p.id !== selectedBomProduct.id);
                                                setNewProductsCreated(remaining);
                                                setSelectedBomProduct(null);
                                                if (remaining.length === 0) {
                                                    setShowBomPrompt(false);
                                                }
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg shadow text-sm cursor-pointer"
                                        >
                                            Confirm & Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PurchaseEntry;

PurchaseEntry.propTypes = {
    purchaseToEdit: PropTypes.object,
    onSave: PropTypes.func
};
