import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Save, X, FileUp } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = '/api/parties';

function PartyMaster() {
    const [parties, setParties] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingParty, setEditingParty] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        gst_number: '',
        address: '',
        contact: ''
    });

    const fetchParties = useCallback(async () => {
        try {
            const response = await axios.get(API_URL);
            setParties(response.data);
        } catch (error) {
            console.error('Error fetching parties:', error);
        }
    }, []);

    useEffect(() => {
        fetchParties();
    }, [fetchParties]);



    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingParty) {
                await axios.put(`${API_URL}/${editingParty.id}`, formData);
            } else {
                await axios.post(API_URL, formData);
            }
            fetchParties();
            closeModal();
        } catch (error) {
            console.error('Error saving party:', error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this party?')) {
            try {
                await axios.delete(`${API_URL}/${id}`);
                fetchParties();
            } catch (error) {
                console.error('Error deleting party:', error);
            }
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                // Read as array of arrays (Row 1 is assumed data if no headers, or adjust accordingly)
                // User said: "coloumn 1 contains of all my partiers and column 2 contains of their GSTN"
                // This implies A1..Ax is Names, B1..Bx is GST.
                // We'll treat it as 'header: 1' to get raw arrays
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Transform to object array, skipping empty rows or header if it looks like one
                const partiesToImport = data
                    .filter(row => row[0]) // Must have name
                    .map(row => ({
                        name: row[0],
                        gst_number: row[1] ? row[1].toString() : ''
                    }));

                if (partiesToImport.length > 0) {
                    if (window.confirm(`Found ${partiesToImport.length} parties. Import them?`)) {
                        await axios.post(`${API_URL}/bulk`, partiesToImport);
                        alert('Import successful!');
                        fetchParties();
                    }
                } else {
                    alert('No data found in file');
                }
            } catch (err) {
                console.error("Import Error", err);
                alert("Failed to read file");
            }
            // Reset input
            e.target.value = null;
        };
        reader.readAsBinaryString(file);
    };

    const openModal = (party = null) => {
        if (party) {
            setEditingParty(party);
            setFormData({
                name: party.name,
                gst_number: party.gst_number || '',
                address: party.address || '',
                contact: party.contact || ''
            });
        } else {
            setEditingParty(null);
            setFormData({ name: '', gst_number: '', address: '', contact: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingParty(null);
        setFormData({ name: '', gst_number: '', address: '', contact: '' });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Party Master</h2>
                {/* Import Button */}
                <div className="flex gap-2">
                    <label className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors cursor-pointer">
                        <FileUp size={18} />
                        <span>Import Excel</span>
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={18} />
                        <span>Add New Party</span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 text-gray-500 text-sm">
                            <th className="py-3 px-4">Party Name</th>
                            <th className="py-3 px-4">GST Number</th>
                            <th className="py-3 px-4">Address</th>
                            <th className="py-3 px-4">Contact</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {parties.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-8 text-center text-gray-500">
                                    No parties found. Add one to get started.
                                </td>
                            </tr>
                        ) : (
                            parties.map((party) => (
                                <tr key={party.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 font-medium text-gray-900">{party.name}</td>
                                    <td className="py-3 px-4 text-gray-600 font-mono text-sm">{party.gst_number}</td>
                                    <td className="py-3 px-4 text-gray-600 truncate max-w-xs">{party.address}</td>
                                    <td className="py-3 px-4 text-gray-600">{party.contact}</td>
                                    <td className="py-3 px-4 text-right space-x-2">
                                        <button
                                            onClick={() => openModal(party)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(party.id)}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl animation-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingParty ? 'Edit Party' : 'Add New Party'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Party Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="Enter party name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                                <input
                                    type="text"
                                    name="gst_number"
                                    value={formData.gst_number}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
                                    placeholder="GSTIN"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    rows="3"
                                    placeholder="Full address"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Details</label>
                                <input
                                    type="text"
                                    name="contact"
                                    value={formData.contact}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="Phone / Email"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2 transition-colors"
                                >
                                    <Save size={18} />
                                    <span>{editingParty ? 'Update' : 'Save'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PartyMaster;
