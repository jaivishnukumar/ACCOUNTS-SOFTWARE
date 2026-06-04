import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Save, Calculator, Upload, AlertCircle, Check, Loader2, Sparkles, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import ProductFormulas from './ProductFormulas';

// Dynamic API URL
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

function SalesEntry({ saleToEdit = null, onSave }) {
    const [parties, setParties] = useState([]);
    const [productList, setProductList] = useState([]);
    const [lastBillNo, setLastBillNo] = useState(null);
    const dateInputRef = useRef(null);
    const billValueRef = useRef(null);

    const [formData, setFormData] = useState({
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

    // Searchable Party State
    const [partySearchTerm, setPartySearchTerm] = useState('');
    const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [saleToEditId, setSaleToEditId] = useState(null);
    const [loadedBillNo, setLoadedBillNo] = useState(null);
    const wrapperRef = useRef(null);
    const itemRefs = useRef([]);

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
        bags: '',
        unit: '',
        bill_value: '',
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
        setPartySearchTerm('');
        fetchNextBillNo();
    }, [fetchNextBillNo]);

    // Initial Data Fetch
    useEffect(() => {
        fetchParties();
        fetchProducts();
    }, [fetchParties, fetchProducts]);

    // Form Sync Logic when editing
    useEffect(() => {
        if (saleToEdit) {
            let pname = saleToEdit.product_name || '';
            const pid = saleToEdit.product_id;

            if (pid && productList.length > 0) {
                const found = productList.find(p => p.id == pid);
                if (found) pname = found.name;
            }

            let partyName = '';
            if (saleToEdit.party_id && parties.length > 0) {
                const foundParty = parties.find(p => p.id == saleToEdit.party_id);
                if (foundParty) partyName = foundParty.name;
            } else if (saleToEdit.party_name) {
                partyName = saleToEdit.party_name;
            }
            setPartySearchTerm(partyName);

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
            setLoadedBillNo(saleToEdit.bill_no);
        } else {
            if (saleToEditId !== null) {
                resetFormAndFetchBillNo();
                setSaleToEditId(null);
                setLoadedBillNo(null);
            } else if (!formData.bill_no) {
                resetFormAndFetchBillNo();
            }
        }
    }, [saleToEdit, productList, parties, resetFormAndFetchBillNo, saleToEditId, formData.bill_no]);

    // Dynamic Tax Calculations: Auto-calculate CGST/SGST when bill_value or tax_rate changes
    useEffect(() => {
        const billValue = parseFloat(formData.bill_value) || 0;
        const taxRate = parseFloat(formData.tax_rate) || 0;
        const taxAmount = (billValue * taxRate) / 100;
        const cgst = parseFloat((taxAmount / 2).toFixed(2));
        const sgst = parseFloat((taxAmount / 2).toFixed(2));

        setFormData(prev => {
            if (prev.cgst === cgst && prev.sgst === sgst) return prev;
            return { ...prev, cgst, sgst };
        });
    }, [formData.bill_value, formData.tax_rate]);

    // Dynamic Total & Round Off calculations when bill_value, cgst or sgst changes
    useEffect(() => {
        const billValue = parseFloat(formData.bill_value) || 0;
        const cgst = parseFloat(formData.cgst) || 0;
        const sgst = parseFloat(formData.sgst) || 0;
        const taxTotal = cgst + sgst;

        const rawTotal = billValue + taxTotal;
        const total = Math.round(rawTotal);
        const roundOff = parseFloat((total - rawTotal).toFixed(2));

        setFormData(prev => {
            if (
                prev.tax_amount === taxTotal &&
                prev.total === total &&
                prev.round_off === roundOff
            ) {
                return prev;
            }
            return {
                ...prev,
                tax_amount: taxTotal,
                total,
                round_off: roundOff
            };
        });
    }, [formData.bill_value, formData.cgst, formData.sgst]);

    const handleBillNoBlur = async () => {
        const billNo = formData.bill_no;
        if (!billNo) return;
        if (String(loadedBillNo) === String(billNo)) return;
        if (saleToEdit && String(saleToEdit.bill_no) === String(billNo)) return;

        try {
            const res = await axios.get(`${getBaseUrl()}/sales/by-bill/${billNo}`);
            if (res.data) {
                const foundSale = res.data;
                setSaleToEditId(foundSale.id);
                setLoadedBillNo(foundSale.bill_no);

                let partyName = '';
                if (foundSale.party_id && parties.length > 0) {
                    const foundParty = parties.find(p => p.id == foundSale.party_id);
                    if (foundParty) partyName = foundParty.name;
                } else if (foundSale.party_name) {
                    partyName = foundSale.party_name;
                }
                setPartySearchTerm(partyName);

                setFormData({
                    date: foundSale.date,
                    bill_no: foundSale.bill_no,
                    party_id: foundSale.party_id,
                    bill_value: foundSale.bill_value,
                    bags: foundSale.bags,
                    product_name: foundSale.product_name || '',
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
                if (saleToEditId && String(loadedBillNo) !== String(billNo)) {
                    // Renaming bill number, keep edit ID
                } else {
                    setSaleToEditId(null);
                    setLoadedBillNo(null);
                }
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

    const filteredParties = parties.filter(party =>
        (party.name || '').toLowerCase().includes(partySearchTerm.toLowerCase())
    );

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev < filteredParties.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isPartyDropdownOpen && filteredParties.length > 0) {
                const selected = filteredParties[highlightedIndex];
                setFormData(prev => ({ ...prev, party_id: selected.id }));
                setPartySearchTerm(selected.name);
                setIsPartyDropdownOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsPartyDropdownOpen(false);
        }
    };

    const currentProduct = productList.find(p => p.name === formData.product_name);

    const handleUnitChange = (e) => {
        const selectedUnit = e.target.value;
        let newFactor = 1.0;

        if (currentProduct && currentProduct.has_dual_units && selectedUnit === currentProduct.secondary_unit) {
            newFactor = currentProduct.conversion_rate ? (1 / parseFloat(currentProduct.conversion_rate)) : 1.0;
        }

        setFormData(prev => ({
            ...prev,
            unit: selectedUnit,
            conversion_factor: newFactor
        }));
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsPartyDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleProductChange = (e) => {
        const productName = e.target.value;
        const matched = productList.find(p => p.name === productName);

        setFormData(prev => ({
            ...prev,
            product_name: productName,
            product_id: matched ? matched.id : null,
            hsn_code: matched ? matched.hsn_code : '',
            packing_type: matched ? matched.packing_type : '',
            unit: matched ? matched.packing_type : '',
            tax_rate: matched ? matched.tax_rate : 0
        }));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        try {
            const idToUpdate = saleToEdit?.id || saleToEditId;

            if (idToUpdate) {
                await axios.put(`${getBaseUrl()}/sales/${idToUpdate}`, formData);
                alert('Sales entry updated successfully!');
            } else {
                await axios.post(`${getBaseUrl()}/sales`, formData);
                alert('Sales entry saved successfully!');
            }

            if (onSave) onSave();

            if (!saleToEdit) {
                setSaleToEditId(null);
                resetFormAndFetchBillNo();
                setTimeout(() => {
                    if (dateInputRef.current) dateInputRef.current.focus();
                }, 100);
            }
        } catch (error) {
            console.error('Error saving sales entry:', error);
            alert('Failed to save entry');
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
                        alert('Empty JSON array.');
                    }
                } catch (err) {
                    alert('Failed to parse JSON file');
                }
            };
            reader.readAsText(file);
        } else {
            // Excel/CSV
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
                        alert('Spreadsheet has insufficient rows.');
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
            bags: '',
            unit: '',
            bill_value: '',
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
            else if (lower.includes('party') || lower.includes('ledger') || lower.includes('particular') || lower.includes('customer') || lower.includes('vendor')) {
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
                mapping.bags = h;
            }
            else if (lower === 'unit' || lower === 'uom' || lower === 'packing' || lower === 'pkg' || lower === 'measure' || lower === 'qty unit' || lower === 'quantity unit') {
                mapping.unit = h;
            }
            else if (lower.includes('gross') || lower.includes('taxable') || (lower.includes('value') && !lower.includes('total') && !lower.includes('net') && !lower.includes('round')) || (lower.includes('amount') && !lower.includes('total') && !lower.includes('net') && !lower.includes('round'))) {
                mapping.bill_value = h;
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
        // Load existing sales bills to check for duplicates client-side
        let dbBillNos = new Set();
        try {
            const res = await axios.get(`${getBaseUrl()}/sales`);
            dbBillNos = new Set(res.data.map(s => String(s.bill_no)));
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
        const bagsIdx = parsedHeaders.indexOf(columnMapping.bags);
        const unitIdx = parsedHeaders.indexOf(columnMapping.unit);
        const valIdx = parsedHeaders.indexOf(columnMapping.bill_value);
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
            let bagsVal = '';
            let unitVal = '';
            let billValueVal = '';
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
                bagsVal = row[columnMapping.bags] !== undefined ? String(row[columnMapping.bags]) : '';
                unitVal = row[columnMapping.unit] !== undefined ? String(row[columnMapping.unit]) : '';
                billValueVal = row[columnMapping.bill_value] !== undefined ? String(row[columnMapping.bill_value]) : '';
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
                bagsVal = bagsIdx !== -1 && row[bagsIdx] !== undefined ? row[bagsIdx] : '';
                unitVal = unitIdx !== -1 && row[unitIdx] !== undefined ? row[unitIdx] : '';
                billValueVal = valIdx !== -1 && row[valIdx] !== undefined ? row[valIdx] : '';
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

            const parseRes = parseQuantityAndUnit(bagsVal);
            let numBags = parseRes.qty;
            let parsedUnit = parseRes.unit;
            if (unitVal) {
                parsedUnit = String(unitVal).trim().toUpperCase();
            }

            const numValue = parseNumberValue(billValueVal);
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
                tax_rate: parseNumberValue(gstRateVal),
                bags: numBags,
                unit: parsedUnit,
                bill_value: numValue,
                cgst: numCgst,
                sgst: numSgst,
                round_off: numRoundOff,
                total: numTotal
            };

            // Basic Validation
            const errors = {};
            if (!mapped.date) errors.date = 'Date is required';
            if (!mapped.bill_no) errors.bill_no = 'Bill number is required';
            else if (dbBillNos.has(mapped.bill_no)) errors.bill_no = 'Duplicate Bill No in database';

            if (!mapped.party_name) errors.party_name = 'Party name is required';
            if (!mapped.product_name) errors.product_name = 'Product name is required';
            
            if (mapped.bags <= 0) errors.bags = 'Quantity must be positive number';
            if (mapped.bill_value <= 0) errors.bill_value = 'Value must be positive number';

            // Check if party & product exists in current master lists
            const partyExists = parties.some(p => p.name.toLowerCase() === mapped.party_name.toLowerCase());
            const productExists = productList.some(p => p.name.toLowerCase() === mapped.product_name.toLowerCase());

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
        setImportProgress({ current: 0, total: previewData.length });
        const logs = [];
        const createdProducts = []; // track any new products created

        // Resolve sequential inserts
        for (let i = 0; i < previewData.length; i++) {
            const row = previewData[i];
            setImportProgress(prev => ({ ...prev, current: i + 1 }));

            if (Object.keys(row.errors).length > 0) {
                logs.push({ status: 'error', msg: `Row ${row.index} skipped: ${Object.values(row.errors).join(', ')}` });
                continue;
            }

            try {
                // 1. Resolve Party (Auto-create if not exists)
                let partyId = null;
                const matchedParty = parties.find(p => p.name.toLowerCase() === row.party_name.toLowerCase());
                if (matchedParty) {
                    partyId = matchedParty.id;
                    if (row.gstin && (!matchedParty.gst_number || matchedParty.gst_number !== row.gstin)) {
                        logs.push({ status: 'info', msg: `Updating GSTIN for Party "${row.party_name}"` });
                        await axios.put(`${getBaseUrl()}/parties/${partyId}`, {
                            ...matchedParty,
                            gst_number: row.gstin
                        });
                        matchedParty.gst_number = row.gstin; // Update local cache
                    }
                } else {
                    logs.push({ status: 'info', msg: `Creating Party: "${row.party_name}"` });
                    const pRes = await axios.post(`${getBaseUrl()}/parties`, {
                        name: row.party_name,
                        gst_number: row.gstin || '',
                        maintain_balance: 1
                    });
                    partyId = pRes.data.id;
                    // Update local state copy to prevent duplicate creations
                    parties.push({ id: partyId, name: row.party_name, gst_number: row.gstin });
                }

                // 2. Resolve Product (Auto-create if not exists)
                let productId = null;
                let hsn = row.hsn_code || '9999';
                let taxRate = row.tax_rate || 18;
                let packingType = 'BAG';
                let unit = 'BAG';
                let conversionFactor = 1.0;
                const matchedProduct = productList.find(p => p.name.toLowerCase() === row.product_name.toLowerCase());
                if (matchedProduct) {
                    productId = matchedProduct.id;
                    hsn = row.hsn_code || matchedProduct.hsn_code || '9999';
                    taxRate = row.tax_rate || matchedProduct.tax_rate || 18;
                    packingType = matchedProduct.packing_type || 'BAG';
                    
                    const rowUnit = String(row.unit || '').toUpperCase().trim();
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
                    logs.push({ status: 'info', msg: `Creating Product: "${row.product_name}"` });
                    const prodRes = await axios.post(`${getBaseUrl()}/products`, {
                        name: row.product_name,
                        hsn_code: hsn,
                        tax_rate: taxRate,
                        packing_type: packingType,
                        maintain_stock: 1
                    });
                    productId = prodRes.data.id;
                    productList.push({ id: productId, name: row.product_name, hsn_code: hsn, tax_rate: taxRate, packing_type: packingType });
                    createdProducts.push({ id: productId, name: row.product_name });
                }

                // 3. Tax calculations or use Excel values
                const billValue = parseFloat(row.bill_value);
                const cgst = row.cgst !== undefined && row.cgst !== 0 ? row.cgst : parseFloat(((billValue * taxRate) / 200).toFixed(2));
                const sgst = row.sgst !== undefined && row.sgst !== 0 ? row.sgst : parseFloat(((billValue * taxRate) / 200).toFixed(2));
                const roundOff = row.round_off !== undefined && row.round_off !== 0 ? row.round_off : parseFloat((Math.round(billValue + cgst + sgst) - (billValue + cgst + sgst)).toFixed(2));
                const total = row.total !== undefined && row.total !== 0 ? row.total : Math.round(billValue + cgst + sgst + roundOff);

                const salePayload = {
                    date: row.date,
                    bill_no: row.bill_no,
                    party_id: partyId,
                    bill_value: billValue,
                    bags: row.bags,
                    product_id: productId,
                    product_name: row.product_name,
                    hsn_code: hsn,
                    packing_type: packingType,
                    unit,
                    conversion_factor: conversionFactor,
                    tax_rate: taxRate,
                    cgst,
                    sgst,
                    total,
                    round_off: roundOff
                };

                await axios.post(`${getBaseUrl()}/sales`, salePayload);
                logs.push({ status: 'success', msg: `Row ${row.index}: Invoice ${row.bill_no} imported successfully.` });
            } catch (err) {
                console.error(err);
                logs.push({ status: 'error', msg: `Row ${row.index} failed: ${err.response?.data?.error || err.message}` });
            }
        }

        setImportLogs(logs);
        setImportStep('finished');
        
        // Refresh master lists and bill details
        fetchParties();
        fetchProducts();
        fetchNextBillNo();

        if (createdProducts.length > 0) {
            setNewProductsCreated(createdProducts);
            setShowBomPrompt(true);
        }
    };

    return (
        <div className="bg-[#0c1122] rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden max-w-4xl mx-auto">
            <div className="bg-slate-900/80 p-6 border-b border-slate-800/80 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg text-white"><Calculator size={20} /></div>
                    <span className="text-slate-100">{(saleToEdit || saleToEditId) ? 'Edit Sales Entry' : 'New Sales Entry'}</span>
                </h2>
                <div className="flex gap-3">
                    {!saleToEdit && !saleToEditId && (
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
                    {lastBillNo > 0 && (
                        <div className="text-sm text-slate-400 font-medium flex flex-col items-end hidden md:flex">
                            <span className="text-[10px] uppercase tracking-wider">Last Entered</span>
                            <span className="text-white font-mono font-bold">{lastBillNo}</span>
                        </div>
                    )}
                    <div className="text-sm text-slate-400 font-medium flex flex-col items-end">
                        <span className="text-[10px] uppercase tracking-wider">Current Bill</span>
                        <span className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{formData.bill_no || '...'}</span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Row 1 */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Bill Date</label>
                    <input
                        ref={dateInputRef}
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                        className="w-full p-3 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Bill Number</label>
                    <input
                        type="text"
                        name="bill_no"
                        value={formData.bill_no}
                        onChange={handleInputChange}
                        onBlur={handleBillNoBlur}
                        required
                        placeholder="e.g. 1024"
                        className="w-full p-3 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono"
                    />
                </div>

                {/* Row 2 */}
                <div className="md:col-span-2 space-y-2 relative" ref={wrapperRef}>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Party Name</label>
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
                            className="w-full p-3 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        />
                        {isPartyDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-[#0d1220] border border-slate-800 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                                            className={`p-3 cursor-pointer border-b border-slate-800 last:border-0 ${index === highlightedIndex ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-slate-900 text-slate-300'
                                                }`}
                                        >
                                            <div className="font-medium text-sm">{party.name}</div>
                                            {party.gst_number && <div className="text-[10px] opacity-80 font-mono mt-0.5">GST: {party.gst_number}</div>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-slate-500 text-sm text-center">No matching parties found</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 3 */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Quantity (Bags)</label>
                    <input
                        type="number"
                        name="bags"
                        value={formData.bags}
                        onChange={handleInputChange}
                        className="w-full p-3 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono"
                        placeholder="Quantity"
                    />
                </div>

                {/* Product Selection */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Product Name</label>
                    <select
                        name="product_name"
                        value={formData.product_name}
                        onChange={handleProductChange}
                        required
                        className="w-full p-3 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-semibold"
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
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">HSN Code</label>
                        <input
                            type="text"
                            name="hsn_code"
                            value={formData.hsn_code}
                            readOnly
                            className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 font-mono focus:outline-none cursor-not-allowed text-center"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Unit / Packing</label>
                        {currentProduct && currentProduct.has_dual_units ? (
                            <select
                                name="unit"
                                value={formData.unit}
                                onChange={handleUnitChange}
                                className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-center"
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
                                className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 font-semibold focus:outline-none cursor-not-allowed text-center"
                            />
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">GST Rate (%)</label>
                        <input
                            type="number"
                            name="tax_rate"
                            value={formData.tax_rate}
                            readOnly
                            className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 font-mono focus:outline-none cursor-not-allowed text-center"
                        />
                    </div>
                </div>

                {/* Row 4 - Calculations */}
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider">Bill Value (Taxable)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-blue-500 font-bold">₹</span>
                            <input
                                ref={billValueRef}
                                type="number"
                                step="0.01"
                                name="bill_value"
                                value={formData.bill_value}
                                onChange={handleInputChange}
                                required
                                className="w-full pl-8 p-3 bg-slate-950 border border-slate-800 rounded-lg text-lg font-bold text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">Total Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-indigo-400 font-bold">₹</span>
                            <input
                                type="number"
                                value={formData.total}
                                readOnly
                                className="w-full pl-8 p-3 border border-slate-800 bg-slate-950 rounded-lg font-bold text-2xl text-indigo-400 outline-none font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 col-span-1 md:col-span-2 border-t border-slate-800 pt-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tax Total</label>
                            <input
                                type="number"
                                value={formData.tax_amount}
                                readOnly
                                className="w-full p-2 border border-slate-800 rounded text-sm text-slate-300 bg-slate-950 font-mono text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">C.G.S.T</label>
                            <input
                                type="number"
                                step="0.01"
                                name="cgst"
                                value={formData.cgst}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-slate-800 rounded text-sm text-slate-100 bg-slate-950 font-mono text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">S.G.S.T</label>
                            <input
                                type="number"
                                step="0.01"
                                name="sgst"
                                value={formData.sgst}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-slate-800 rounded text-sm text-slate-100 bg-slate-950 font-mono text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Round Off</label>
                            <input
                                type="number"
                                step="0.01"
                                name="round_off"
                                value={formData.round_off}
                                readOnly
                                className="w-full p-2 border border-slate-800 rounded text-sm text-slate-400 bg-slate-900 font-mono text-center"
                            />
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="md:col-span-2 pt-4">
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 active:scale-[0.99] transition-all flex justify-center items-center gap-2 cursor-pointer"
                    >
                        <Save size={18} />
                        <span>{(saleToEdit || saleToEditId) ? 'Update Entry' : 'Save Sales Entry'}</span>
                    </button>
                </div>
            </form>

            {/* Bulk Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0d1220] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <Upload size={20} className="text-blue-500" />
                                <span>Bulk Import Sales Invoices</span>
                            </h3>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Step content */}
                        <div className="p-6 overflow-y-auto flex-1 text-slate-300">
                            {importStep === 'select' && (
                                <div className="space-y-6 text-center py-10">
                                    <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-xl p-8 transition-colors flex flex-col items-center justify-center bg-slate-950/40">
                                        <Upload size={48} className="text-slate-500 mb-4" />
                                        <span className="text-sm font-semibold text-slate-200 mb-1">Select transaction report file</span>
                                        <span className="text-xs text-slate-500 mb-4">Excel (.xlsx, .xls), CSV, JSON, or JSONL files exported from Tally/ERP</span>
                                        <input
                                            type="file"
                                            id="salesImportFile"
                                            accept=".xlsx,.xls,.csv,.json,.jsonl,.pdf"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="salesImportFile"
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-lg text-sm"
                                        >
                                            Browse Files
                                        </label>
                                    </div>

                                    {pdfWarning && (
                                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 flex gap-3 text-left">
                                            <AlertCircle size={20} className="shrink-0" />
                                            <div>
                                                <div className="font-bold text-sm">PDF Files Cannot Be Parsed Directly</div>
                                                <p className="text-xs mt-1">Arbitrary PDF print layouts are highly variable. Please convert your PDF report to Excel (.xlsx) or CSV format first using any free online tool, then select the converted file.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {importStep === 'mapping' && (
                                <div className="space-y-6">
                                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
                                        <span className="font-bold text-blue-400 uppercase tracking-wide">Column Mapping step:</span>
                                        <p className="text-slate-400 mt-1">Tally voucher exports may contain custom header names. Map the file headers to the system fields below. We have auto-matched what we could.</p>
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
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg shadow-lg text-sm cursor-pointer"
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
                                            <span className="text-slate-400">Errors are highlighted in red. Missing party/product masters will be auto-created.</span>
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
                                                    <th className="p-3">Party Name</th>
                                                    <th className="p-3">Product Name</th>
                                                    <th className="p-3 text-right">Qty</th>
                                                    <th className="p-3 text-right">Value</th>
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
                                                                    <span className="ml-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">New Party</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3">
                                                                {row.product_name}
                                                                {!row.productExists && (
                                                                    <span className="ml-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">New Product</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-mono">
                                                                {row.errors.bags ? (
                                                                    <span className="text-red-400 font-bold" title={row.errors.bags}>{row.bags}</span>
                                                                ) : (
                                                                    row.bags
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-bold text-slate-200">
                                                                {row.errors.bill_value ? (
                                                                    <span className="text-red-400 font-bold" title={row.errors.bill_value}>{row.bill_value}</span>
                                                                ) : (
                                                                    `₹${parseFloat(row.bill_value).toFixed(2)}`
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
                                    <Loader2 size={40} className="text-blue-500 animate-spin mb-4" />
                                    <div className="text-sm font-semibold text-slate-200">Importing records...</div>
                                    <div className="text-xs text-slate-500 mt-1">Processed {importProgress.current} of {importProgress.total}</div>
                                    <div className="w-full bg-slate-900 rounded-full h-2 max-w-md mt-4 border border-slate-800">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-200"
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
                                            <div className="font-bold">Import Completed!</div>
                                            <p className="text-xs mt-0.5">We processed the file and loaded transactions. Review log logs below for details.</p>
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
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-lg text-sm cursor-pointer"
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
                                        Some imported products did not exist in the database. If these are finished goods manufactured by you, you must configure their ingredient formulas (BOM) so stocks auto-production works. Skip for raw materials.
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Product to define recipe:</label>
                                        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                                            {newProductsCreated.map(p => (
                                                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
                                                    <span className="font-semibold text-sm text-slate-200">{p.name}</span>
                                                    <button
                                                        onClick={() => setSelectedBomProduct(p)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer"
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
                                            Configure Later / Skip All
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
                                                // Remove configured product from list
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

export default SalesEntry;
