import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Save, X, Hash } from 'lucide-react';

const getBaseUrl = () => '/api';

function HSNMaster() {
    const [hsnCodes, setHsnCodes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, code: '', description: '', rate: '' });

    useEffect(() => {
        fetchHSNCodes();
    }, []);

    const fetchHSNCodes = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${getBaseUrl()}/hsn`);
            setHsnCodes(res.data);
        } catch (error) {
            console.error("Error fetching HSN codes", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (hsn = null) => {
        if (hsn) {
            setFormData({ id: hsn.id, code: hsn.code, description: hsn.description, rate: hsn.rate });
        } else {
            setFormData({ id: null, code: '', description: '', rate: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData({ id: null, code: '', description: '', rate: '' });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await axios.put(`${getBaseUrl()}/hsn/${formData.id}`, formData);
            } else {
                await axios.post(`${getBaseUrl()}/hsn`, formData);
            }
            fetchHSNCodes();
            handleCloseModal();
        } catch (error) {
            console.error("Error saving HSN code", error);
            const msg = error.response?.data?.error || "Failed to save HSN Code";
            alert(msg);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this HSN Code?")) {
            try {
                await axios.delete(`${getBaseUrl()}/hsn/${id}`);
                fetchHSNCodes();
            } catch (error) {
                console.error("Error deleting HSN code", error);
                alert("Failed to delete HSN Code");
            }
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Hash className="text-blue-600" /> HSN Code Master
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Manage HSN Codes and Tax Rates</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus size={18} /> Add New Code
                </button>
            </div>

            <div className="flex-1 overflow-auto border rounded-xl bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">HSN Code</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Rate (%)</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan="4" className="text-center py-10 text-gray-500">Loading HSN Codes...</td></tr>
                        ) : hsnCodes.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-10 text-gray-500">No HSN Codes found. Add one to get started.</td></tr>
                        ) : (
                            hsnCodes.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono">{item.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.description || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-blue-600">{item.rate}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-900 mr-3 p-1 hover:bg-blue-50 rounded">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded">
                                            <Trash2 size={16} />
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">{formData.id ? 'Edit HSN Code' : 'Add HSN Code'}</h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="e.g. 11062020"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="e.g. Flour Exempted"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.rate}
                                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="0"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2"
                                >
                                    <Save size={18} /> Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HSNMaster;
