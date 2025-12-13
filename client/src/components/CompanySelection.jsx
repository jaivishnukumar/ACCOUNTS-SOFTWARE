import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Building2, Plus, ArrowRight, Trash2, Calendar, Settings, Users, Lock, Shield } from 'lucide-react';

// Dynamic API Base URL helper
const getApiBaseUrl = () => {
    return '/api';
};

function CompanySelection({ onSelect, onLogout, user }) {
    const [companies, setCompanies] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newCompany, setNewCompany] = useState({ name: '', address: '', gst_number: '' });
    const [customCode, setCustomCode] = useState('');
    const [editingCode, setEditingCode] = useState(null); // { id, code }
    const [editingUser, setEditingUser] = useState(null);
    const [deletingUser, setDeletingUser] = useState(null);
    const [showAdmin, setShowAdmin] = useState(false);
    const [adminUsers, setAdminUsers] = useState([]);
    const [adminCodes, setAdminCodes] = useState([]);
    const [financialYears, setFinancialYears] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedFinancialYear, setSelectedFinancialYear] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null); // Debugging state

    const generateFinancialYears = useCallback(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = 0; i < 5; i++) { // Generate 5 years into the future
            const startYear = currentYear + i;
            years.push(`${startYear}-${startYear + 1}`);
        }
        setFinancialYears(years);
    }, []);

    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${getApiBaseUrl()}/companies`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompanies(response.data);
            if (response.data.length > 0 && !selectedCompanyId) {
                setSelectedCompanyId(response.data[0].id);
            }
        } catch (err) {
            // console.error("Error fetching companies:", err);
            setError(err.response?.data?.error || err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCompanyId]);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this company? This action cannot be undone.")) {
            return;
        }
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${getApiBaseUrl()}/companies/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCompanies();
            if (selectedCompanyId === id) {
                setSelectedCompanyId(''); // Clear selected if deleted
            }
        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            alert(`Failed to delete company: ${msg}`);
            // console.error("Error deleting company:", error);
        }
    };

    useEffect(() => {
        generateFinancialYears();
        fetchCompanies();
        // User state removed from here as it is not used

        const savedCompanyId = localStorage.getItem('companyId');
        if (savedCompanyId) setSelectedCompanyId(savedCompanyId);

        const savedFY = localStorage.getItem('financialYear');
        if (savedFY) {
            setSelectedFinancialYear(savedFY);
        } else {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
            setSelectedFinancialYear(`${startYear}-${startYear + 1}`);
        }
    }, [generateFinancialYears, fetchCompanies]);

    const fetchAdminData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [usersRes, codesRes] = await Promise.all([
                axios.get(`${getApiBaseUrl()}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${getApiBaseUrl()}/admin/invite-codes`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setAdminUsers(usersRes.data);
            setAdminCodes(codesRes.data);
        } catch (error) {
            console.error("Admin Fetch Error", error);
        }
    };

    useEffect(() => {
        if (showAdmin) fetchAdminData();
    }, [showAdmin]);

    const handleGenerateCode = async () => {
        try {
            const token = localStorage.getItem('token');
            // Send custom code if entered, else empty for random
            await axios.post(`${getApiBaseUrl()}/admin/invite-codes`, { code: customCode }, { headers: { Authorization: `Bearer ${token}` } });
            setCustomCode('');
            fetchAdminData();
            fetchAdminData();
        } catch {
            alert('Failed to generate code.');
        }
    };

    const handleEditCodeCheck = (codeRec) => {
        setEditingCode({ id: codeRec.id, code: codeRec.code });
    };

    const handleSaveCode = async () => {
        if (!editingCode) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${getApiBaseUrl()}/admin/invite-codes/${editingCode.id}`, { code: editingCode.code }, { headers: { Authorization: `Bearer ${token}` } });
            setEditingCode(null);
            fetchAdminData();
        } catch (e) { alert("Failed to update code"); }
    };

    const handleUpdateUser = async (id, data) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${getApiBaseUrl()}/admin/users/${id}`, data, { headers: { Authorization: `Bearer ${token}` } });
            fetchAdminData();
        } catch (e) { alert("Failed to update user"); }
    };

    const confirmDeleteUser = async () => {
        if (!deletingUser) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${getApiBaseUrl()}/admin/users/${deletingUser.id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchAdminData();
            setDeletingUser(null);
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            alert(`Failed to delete user: ${msg}`);
        }
    };

    const handleCreateCompany = async (e) => {
        e.preventDefault();

        // Enforce Limit
        const maxCompanies = user?.max_companies || 5;
        if (companies.length >= maxCompanies) {
            alert(`Limit Reached: You can only create up to ${maxCompanies} companies. Contact Admin.`);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${getApiBaseUrl()}/companies`, newCompany, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewCompany({ name: '', address: '', gst_number: '' });
            setIsCreating(false);
            fetchCompanies();
        } catch (error) {
            alert('Failed to create company. Network error?');
        }
    };

    const handleProceed = () => {
        if (!selectedCompanyId) {
            alert("Please select a company");
            return;
        }
        if (!selectedFinancialYear) {
            alert("Please select a financial year");
            return;
        }

        // Enforce Allowed Years
        const allowed = user?.allowed_years || 'all';
        if (allowed !== 'all') {
            const years = allowed.split(',');
            if (!years.includes(selectedFinancialYear)) {
                alert(`Access Denied: You are not allowed to access ${selectedFinancialYear}. Allowed: ${allowed}`);
                return;
            }
        }

        const company = companies.find(c => c.id == selectedCompanyId);
        if (!company) return;

        localStorage.setItem('companyId', company.id);
        localStorage.setItem('financialYear', selectedFinancialYear);

        onSelect(company, selectedFinancialYear);
    };

    if (showAdmin) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                {/* ... admin ui ... */}
                <div className="w-full px-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">Admin Control Panel</h2>
                        <button onClick={() => setShowAdmin(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Back to Dashboard</button>
                    </div>
                    {/* ... rest of admin ui ... */}


                    <div className="flex flex-col gap-6">
                        {/* Users Management */}
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Users size={20} className="text-blue-600" /> User Management
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase">
                                        <tr>
                                            <th className="p-2">User</th>
                                            <th className="p-2">Status</th>
                                            <th className="p-2">Max Comp</th>
                                            <th className="p-2">Years</th>
                                            <th className="p-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {adminUsers.filter(u => u.username !== 'vishnu').map(u => (
                                            <tr key={u.id}>
                                                <td className="p-2 font-medium">{u.username}</td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${u.is_approved === 1 ? 'bg-green-100 text-green-800' : u.is_approved === 2 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {u.is_approved === 1 ? 'Active' : u.is_approved === 2 ? 'Blocked' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="p-2">{u.max_companies}</td>
                                                <td className="p-2 text-xs text-gray-500 max-w-[150px] truncate" title={u.allowed_years}>
                                                    {u.allowed_years === 'all' ? 'All Years' : u.allowed_years}
                                                </td>
                                                <td className="p-2 flex gap-2">
                                                    <button
                                                        onClick={() => setEditingUser(u)}
                                                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingUser(u);
                                                        }}
                                                        className="text-gray-400 hover:text-red-600" title="Delete User"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Edit User Modal */}
                        {editingUser && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                                    <h3 className="text-xl font-bold mb-4">Edit User: {editingUser.username}</h3>

                                    <div className="space-y-4">
                                        {/* Status */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                            <select
                                                className="w-full border rounded p-2"
                                                value={editingUser.is_approved}
                                                onChange={(e) => setEditingUser({ ...editingUser, is_approved: parseInt(e.target.value) })}
                                            >
                                                <option value={0}>Pending</option>
                                                <option value={1}>Active</option>
                                                <option value={2}>Blocked</option>
                                            </select>
                                        </div>

                                        {/* Max Companies */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Max Companies</label>
                                            <select
                                                className="w-full border rounded p-2"
                                                value={editingUser.max_companies}
                                                onChange={(e) => setEditingUser({ ...editingUser, max_companies: parseInt(e.target.value) })}
                                            >
                                                <option value={1}>1 Company</option>
                                                <option value={3}>3 Companies</option>
                                                <option value={5}>5 Companies</option>
                                                <option value={10}>10 Companies</option>
                                                <option value={20}>20 Companies</option>
                                                <option value={50}>50 Companies</option>
                                                <option value={100}>Unlimited (100)</option>
                                            </select>
                                        </div>

                                        {/* Allowed Years */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Financial Years</label>
                                            <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                                                <label className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingUser.allowed_years === 'all'}
                                                        onChange={(e) => setEditingUser({ ...editingUser, allowed_years: e.target.checked ? 'all' : '' })}
                                                    />
                                                    <span className="font-medium">All Years</span>
                                                </label>
                                                {editingUser.allowed_years !== 'all' && financialYears.map(year => (
                                                    <label key={year} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer ml-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingUser.allowed_years.split(',').includes(year)}
                                                            onChange={(e) => {
                                                                const current = editingUser.allowed_years ? editingUser.allowed_years.split(',') : [];
                                                                let updated;
                                                                if (e.target.checked) {
                                                                    updated = [...current, year];
                                                                } else {
                                                                    updated = current.filter(y => y !== year);
                                                                }
                                                                setEditingUser({ ...editingUser, allowed_years: updated.join(',') });
                                                            }}
                                                        />
                                                        <span>{year}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            onClick={() => setEditingUser(null)}
                                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleUpdateUser(editingUser.id, editingUser);
                                                setEditingUser(null);
                                            }}
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Invite Codes */}
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <div className="flex flex-col gap-4 mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Lock size={20} className="text-emerald-600" /> Invite Codes
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Customize Code (Optional)"
                                        className="flex-1 p-2 border rounded uppercase text-sm"
                                        value={customCode}
                                        onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                                    />
                                    <button onClick={handleGenerateCode} className="px-3 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 whitespace-nowrap">
                                        + Create / Generate
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {adminCodes.map(code => (
                                    <div key={code.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                                        {/* Edit Mode Logic */}
                                        {editingCode && editingCode.id === code.id ? (
                                            <div className="flex gap-2 items-center flex-1">
                                                <input
                                                    type="text"
                                                    className="w-full p-1 border rounded uppercase font-mono font-bold"
                                                    value={editingCode.code}
                                                    onChange={(e) => setEditingCode({ ...editingCode, code: e.target.value.toUpperCase() })}
                                                />
                                                <button onClick={handleSaveCode} className="text-green-600 font-bold p-1">✓</button>
                                                <button onClick={() => setEditingCode(null)} className="text-red-600 font-bold p-1">✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-lg tracking-wider">{code.code}</span>
                                                    <button
                                                        onClick={() => handleEditCodeCheck(code)}
                                                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                                                        title="Edit Code"
                                                    >
                                                        <span className="text-xl">✎</span>
                                                    </button>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xs block ${code.is_used ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}`}>
                                                        {code.is_used ? 'Used' : 'Active'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">by {code.created_by}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Confirm Delete User Modal */}
                    {deletingUser && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
                            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-red-100">
                                <h3 className="text-xl font-bold mb-2 text-red-600 flex items-center gap-2">
                                    <Trash2 size={24} /> Delete User?
                                </h3>
                                <p className="text-gray-600 mb-6">
                                    Are you sure you want to delete user <span className="font-bold text-gray-800">{deletingUser.username}</span>?
                                    <br /><br />
                                    <span className="text-red-500 text-xs font-bold uppercase tracking-wide">Warning: This action cannot be undone and will delete all companies associated with this user.</span>
                                </p>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setDeletingUser(null)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDeleteUser}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md font-medium transition-colors"
                                    >
                                        Yes, Delete User
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100 animate-fade-in relative">
                {(user?.role === 'admin' || user?.username === 'vishnu') && (
                    <button
                        onClick={() => setShowAdmin(true)}
                        className="absolute top-4 right-4 flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-white shadow-sm"
                        title="Admin Panel"
                    >
                        <Settings size={18} />
                        <span className="text-sm font-medium">Admin Panel</span>
                    </button>
                )}

                <button
                    onClick={onLogout}
                    className="absolute top-4 left-4 text-red-400 hover:text-red-600 transition-colors text-sm font-medium"
                >
                    Sign Out
                </button>

                <div className="text-center mb-8">
                    {/* ... existing header ... */}
                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="text-blue-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Select Company</h2>
                    <p className="text-gray-500 text-sm mt-1">Choose workspace & financial year</p>
                </div>

                {!isCreating ? (
                    <div className="space-y-6">
                        {/* ... Existing Selection UI ... */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                            {isLoading ? (
                                <div className="text-center py-4 text-gray-500">Loading companies...</div>
                            ) : companies.length > 0 ? (
                                <select
                                    value={selectedCompanyId}
                                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                >
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                                    No companies found. Create one.
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                                Financial Year
                                <span className="text-xs text-blue-500 cursor-pointer hover:underline" onClick={() => {
                                    // Add next year logic
                                    const lastYearStr = financialYears[financialYears.length - 1];
                                    if (lastYearStr) {
                                        const lastStartYear = parseInt(lastYearStr.split('-')[0]);
                                        const nextStartYear = lastStartYear + 1;
                                        const nextFY = `${nextStartYear}-${nextStartYear + 1}`;
                                        setFinancialYears([...financialYears, nextFY]);
                                        setSelectedFinancialYear(nextFY);
                                    }
                                }}>+ Add Next Year</span>
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-gray-400" size={20} />
                                <select
                                    value={selectedFinancialYear}
                                    onChange={(e) => setSelectedFinancialYear(e.target.value)}
                                    className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                >
                                    {financialYears.length === 0 && <option>Loading...</option>}
                                    {financialYears.map(fy => (
                                        <option key={fy} value={fy}>{fy}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleProceed}
                            disabled={companies.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Enter Dashboard <ArrowRight size={20} />
                        </button>

                        {/* Divider */}
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Create New Company
                        </button>

                        {/* ... Existing Manage Companies List ... */}
                        {companies.length > 0 && (
                            <div className="mt-8 pt-4 border-t">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Manage Companies</h3>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {companies.map(c => (
                                        <div key={c.id} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded group">
                                            <span className="font-medium text-gray-700 truncate">{c.name}</span>
                                            <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleCreateCompany} className="space-y-4 animate-fade-in">
                        {/* ... existing form ... */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                            <input
                                required
                                type="text"
                                value={newCompany.name}
                                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. Srinivas Flour Mills"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                            <input
                                type="text"
                                value={newCompany.gst_number}
                                onChange={(e) => setNewCompany({ ...newCompany, gst_number: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Optional"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                            <input
                                type="text"
                                value={newCompany.address}
                                onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="City, State"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow hover:shadow-md transition-all"
                            >
                                Save Company
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* ERROR / DEBUG DISPLAY */}
            <div className="fixed bottom-4 left-4 bg-white p-4 rounded shadow-lg border border-gray-200 text-xs z-50">
                <p className="font-bold text-gray-700 underline mb-1">Debug Info:</p>
                <p>Status: {isLoading ? 'Loading...' : 'Idle'}</p>
                <p>Companies Count: {companies.length}</p>
                {error && <p className="text-red-600 font-bold">Error: {error}</p>}
                <button onClick={fetchCompanies} className="mt-2 bg-blue-100 px-2 py-1 rounded text-blue-600 hover:bg-blue-200">Retry Fetch</button>
            </div>
        </div>
    );
}

export default CompanySelection;
