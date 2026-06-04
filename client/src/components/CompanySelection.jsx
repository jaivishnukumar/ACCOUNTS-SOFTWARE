import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
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
    const [editingCode, setEditingCode] = useState(null);
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

    const getStatusLabel = (status) => {
        if (status === 1) return 'Active';
        if (status === 2) return 'Blocked';
        return 'Pending';
    };

    const generateFinancialYears = useCallback(() => {
        const today = new Date();
        const currentMonth = today.getMonth(); // 0-11 (0=Jan, 3=April)
        const currentYear = today.getFullYear();

        // If before April (Jan, Feb, Mar), the current FY started in the previous calendar year
        let startYear = currentMonth < 3 ? currentYear - 1 : currentYear;

        const years = [];
        // Show 2 previous years, current year, and 2 future years
        for (let i = -2; i < 3; i++) {
            const y = startYear + i;
            years.push(`${y}-${y + 1}`);
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
            setError(err.response?.data?.error || err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCompanyId]);

    const [deletingCompanyId, setDeletingCompanyId] = useState(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [deleteError, setDeleteError] = useState(null);

    const handleDelete = (id) => {
        setDeletingCompanyId(id);
        setAdminPassword('');
        setDeleteError(null);
    };

    const confirmCompanyDelete = async () => {
        if (!adminPassword) {
            setDeleteError("Password is required");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${getApiBaseUrl()}/companies/${deletingCompanyId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'admin-password': adminPassword
                }
            });

            // Success Logic
            fetchCompanies();
            if (selectedCompanyId === deletingCompanyId) {
                setSelectedCompanyId('');
            }
            // Close Modal
            setDeletingCompanyId(null);
            setAdminPassword('');
        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            setDeleteError(msg);
        }
    };

    useEffect(() => {
        generateFinancialYears();
        fetchCompanies();

        // Load Defaults
        const savedFY = localStorage.getItem('financialYear');
        if (savedFY) {
            setSelectedFinancialYear(savedFY);
        } else {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
            setSelectedFinancialYear(`${startYear}-${startYear + 1}`);
        }
    }, [generateFinancialYears]); // Removed fetchCompanies from array to prevent loops, though useCallback handles it

    // Effect to validate selected ID against loaded companies
    useEffect(() => {
        if (companies.length > 0) {
            const savedId = localStorage.getItem('companyId');
            if (savedId && companies.some(c => c.id.toString() === savedId.toString())) {
                if (!selectedCompanyId) setSelectedCompanyId(savedId);
            } else if (!selectedCompanyId) {
                // Default to first if saved is invalid or empty
                setSelectedCompanyId(companies[0].id);
            }
        }
    }, [companies]); // Run validation when companies load

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
        } catch (err) {
            console.error(err);
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
        } catch (e) {
            console.error(e);
            alert("Failed to update code");
        }
    };

    const handleUpdateUser = async (id, data) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${getApiBaseUrl()}/admin/users/${id}`, data, { headers: { Authorization: `Bearer ${token}` } });
            fetchAdminData();
        } catch (e) {
            console.error(e);
            alert("Failed to update user");
        }
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
            fetchCompanies();
        } catch (error) {
            console.error(error);
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

    const renderSelectionView = () => (
        <div className="space-y-6 text-slate-300">
            <div>
                <label htmlFor="company-select" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company Name</label>
                {isLoading ? (
                    <div className="text-center py-4 text-slate-500 font-mono text-xs">Loading companies...</div>
                ) : companies.length > 0 ? (
                    <select
                        id="company-select"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold"
                    >
                        {companies.map(c => (
                            <option key={c.id} value={c.id} className="bg-[#0d1220]">{c.name}</option>
                        ))}
                    </select>
                ) : (
                    <div className="text-center py-6 text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                        No companies found. Create one.
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mb-2">
                <label htmlFor="fy-select" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Financial Year</label>
                <button
                    type="button"
                    className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 bg-transparent border-none p-0 font-bold"
                    onClick={() => {
                        const lastYearStr = financialYears.at(-1);
                        if (lastYearStr) {
                            const lastStartYear = Number.parseInt(lastYearStr.split('-')[0]);
                            const nextStartYear = lastStartYear + 1;
                            const nextFY = `${nextStartYear}-${nextStartYear + 1}`;
                            setFinancialYears([...financialYears, nextFY]);
                            setSelectedFinancialYear(nextFY);
                        }
                    }}
                >
                    + Add Next Year
                </button>
            </div>
            <div className="relative">
                <Calendar className="absolute left-3 top-3 text-slate-500" size={18} />
                <select
                    id="fy-select"
                    value={selectedFinancialYear}
                    onChange={(e) => setSelectedFinancialYear(e.target.value)}
                    className="w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
                >
                    {financialYears.length === 0 && <option className="bg-[#0d1220]">Loading...</option>}
                    {financialYears.map(fy => (
                        <option key={fy} value={fy} className="bg-[#0d1220]">{fy}</option>
                    ))}
                </select>
            </div>

            <button
                onClick={handleProceed}
                disabled={companies.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-lg shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
                Enter Dashboard <ArrowRight size={18} />
            </button>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink-0 mx-4 text-slate-600 text-xs font-bold font-mono">OR</span>
                <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
                onClick={() => setIsCreating(true)}
                className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
                <Plus size={18} /> Create New Company
            </button>

            {companies.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-800">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Manage Companies</h3>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {companies.map(c => (
                            <div key={c.id} className="flex justify-between items-center text-sm p-2 hover:bg-slate-950 rounded-lg group border border-transparent hover:border-slate-800/80">
                                <span className="font-semibold text-slate-300 truncate">{c.name}</span>
                                <button onClick={() => handleDelete(c.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderCreateView = () => (
        <form onSubmit={handleCreateCompany} className="space-y-4 animate-fade-in text-slate-300">
            <div>
                <label htmlFor="new-company-name" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Company Name</label>
                <input
                    id="new-company-name"
                    required
                    type="text"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Srinivas Flour Mills"
                />
            </div>
            <div>
                <label htmlFor="new-company-gst" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">GST Number</label>
                <input
                    id="new-company-gst"
                    type="text"
                    value={newCompany.gst_number}
                    onChange={(e) => setNewCompany({ ...newCompany, gst_number: e.target.value })}
                    className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Optional"
                />
            </div>
            <div>
                <label htmlFor="new-company-address" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Address</label>
                <input
                    id="new-company-address"
                    type="text"
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                    className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="City, State"
                />
            </div>
            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 font-semibold py-3 rounded-lg transition-colors cursor-pointer"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer"
                >
                    Save Company
                </button>
            </div>
        </form>
    );

    if (showAdmin) {
        return (
            <div className="min-h-screen bg-[#080b13] p-6 text-slate-100 animate-fade-in">
                <div className="w-full max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">Admin Control Panel</h2>
                        <button onClick={() => setShowAdmin(false)} className="px-4 py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-700 font-semibold transition-colors cursor-pointer text-sm">Back to Dashboard</button>
                    </div>

                    <div className="flex flex-col gap-6">
                        {/* Users Management */}
                        <div className="bg-[#0d1220] p-6 rounded-2xl border border-slate-800 shadow-xl">
                            <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-200">
                                <Users size={18} className="text-blue-400" /> User Management
                            </h3>
                            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                                        <tr>
                                            <th className="p-3">User</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3">Max Comp</th>
                                            <th className="p-3">Years</th>
                                            <th className="p-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 text-slate-300">
                                        {adminUsers.filter(u => u.username !== 'vishnu').map(u => (
                                            <tr key={u.id} className="hover:bg-slate-900/40">
                                                <td className="p-3 font-semibold text-slate-200">{u.username}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${u.is_approved === 1 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : u.is_approved === 2 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                        {getStatusLabel(u.is_approved)}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono">{u.max_companies}</td>
                                                <td className="p-3 font-mono max-w-[150px] truncate" title={u.allowed_years}>
                                                    {u.allowed_years === 'all' ? 'All Years' : u.allowed_years}
                                                </td>
                                                <td className="p-3 flex gap-3">
                                                    <button
                                                        onClick={() => setEditingUser(u)}
                                                        className="text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingUser(u);
                                                        }}
                                                        className="text-slate-500 hover:text-red-400 cursor-pointer" title="Delete User"
                                                    >
                                                        <Trash2 size={14} />
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
                            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                                <div className="bg-[#0d1220] border border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md text-slate-300">
                                    <h3 className="text-lg font-bold mb-4 text-slate-200">Edit User: {editingUser.username}</h3>

                                    <div className="space-y-4">
                                        {/* Status */}
                                        <div>
                                            <label htmlFor="status-select" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Status</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 outline-none"
                                                value={editingUser.is_approved}
                                                onChange={(e) => setEditingUser({ ...editingUser, is_approved: Number.parseInt(e.target.value) })}
                                                id="status-select"
                                            >
                                                <option value={0} className="bg-[#0d1220]">Pending</option>
                                                <option value={1} className="bg-[#0d1220]">Active</option>
                                                <option value={2} className="bg-[#0d1220]">Blocked</option>
                                            </select>
                                        </div>

                                        {/* Max Companies */}
                                        <div>
                                            <label htmlFor="max-companies-select" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Max Companies</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 outline-none"
                                                value={editingUser.max_companies}
                                                onChange={(e) => setEditingUser({ ...editingUser, max_companies: Number.parseInt(e.target.value) })}
                                                id="max-companies-select"
                                            >
                                                <option value={1} className="bg-[#0d1220]">1 Company</option>
                                                <option value={3} className="bg-[#0d1220]">3 Companies</option>
                                                <option value={5} className="bg-[#0d1220]">5 Companies</option>
                                                <option value={10} className="bg-[#0d1220]">10 Companies</option>
                                                <option value={20} className="bg-[#0d1220]">20 Companies</option>
                                                <option value={50} className="bg-[#0d1220]">50 Companies</option>
                                                <option value={100} className="bg-[#0d1220]">Unlimited (100)</option>
                                            </select>
                                        </div>

                                        {/* Allowed Years */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Allowed Financial Years</label>
                                            <div className="border border-slate-800 bg-slate-950/40 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                                                <label className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingUser.allowed_years === 'all'}
                                                        onChange={(e) => setEditingUser({ ...editingUser, allowed_years: e.target.checked ? 'all' : '' })}
                                                        id="allowed-all"
                                                        className="accent-blue-500"
                                                    />
                                                    <span className="font-semibold text-xs text-slate-200">All Years</span>
                                                </label>
                                                {editingUser.allowed_years !== 'all' && financialYears.map(year => (
                                                    <label key={year} className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer ml-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingUser.allowed_years.split(',').includes(year)}
                                                            className="accent-blue-500"
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
                                                        <span className="text-xs font-mono">{year}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            onClick={() => setEditingUser(null)}
                                            className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleUpdateUser(editingUser.id, editingUser);
                                                setEditingUser(null);
                                            }}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Invite Codes */}
                        <div className="bg-[#0d1220] p-6 rounded-2xl border border-slate-800 shadow-xl">
                            <div className="flex flex-col gap-4 mb-4">
                                <h3 className="text-base font-bold flex items-center gap-2 text-slate-200">
                                    <Lock size={18} className="text-emerald-400" /> Invite Codes
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Customize Code (Optional)"
                                        className="flex-1 p-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg uppercase text-xs font-mono outline-none"
                                        value={customCode}
                                        onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                                    />
                                    <button onClick={handleGenerateCode} className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 whitespace-nowrap cursor-pointer shadow-lg shadow-emerald-500/10">
                                        + Generate
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {adminCodes.map(code => (
                                    <div key={code.id} className="flex justify-between items-center p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                                        {editingCode && editingCode.id === code.id ? (
                                            <div className="flex gap-2 items-center flex-1">
                                                <input
                                                    type="text"
                                                    className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded uppercase font-mono font-bold text-slate-100 outline-none"
                                                    value={editingCode.code}
                                                    onChange={(e) => setEditingCode({ ...editingCode, code: e.target.value.toUpperCase() })}
                                                />
                                                <button onClick={handleSaveCode} className="text-emerald-400 font-bold p-1">✓</button>
                                                <button onClick={() => setEditingCode(null)} className="text-rose-400 font-bold p-1">✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-sm tracking-wider text-slate-200">{code.code}</span>
                                                    <button
                                                        onClick={() => handleEditCodeCheck(code)}
                                                        className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-slate-900 transition-colors cursor-pointer text-xs"
                                                        title="Edit Code"
                                                    >
                                                        ✎
                                                    </button>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-bold block ${code.is_used ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {code.is_used ? 'Used' : 'Active'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">by {code.created_by}</span>
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
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                            <div className="bg-[#0d1220] border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-slate-300">
                                <h3 className="text-lg font-bold mb-2 text-red-400 flex items-center gap-2">
                                    <Trash2 size={20} /> Delete User?
                                </h3>
                                <p className="text-slate-400 text-xs mb-6">
                                    Are you sure you want to delete user <span className="font-bold text-slate-200">{deletingUser.username}</span>?
                                    <br /><br />
                                    <span className="text-red-400 font-bold uppercase tracking-wide">Warning: This action will delete all companies associated with this user.</span>
                                </p>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setDeletingUser(null)}
                                        className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDeleteUser}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer"
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
        <div className="min-h-screen bg-[#080b13] flex items-center justify-center p-4">
            <div className="bg-[#0d1220] border border-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in relative text-slate-300">
                {(user?.role === 'admin' || user?.username === 'vishnu') && (
                    <button
                        onClick={() => setShowAdmin(true)}
                        className="absolute top-4 right-4 flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 shadow-sm cursor-pointer hover:bg-slate-950"
                        title="Admin Panel"
                    >
                        <Settings size={15} />
                        <span className="text-xs font-semibold">Admin</span>
                    </button>
                )}

                <button
                    onClick={onLogout}
                    className="absolute top-4 left-4 text-slate-500 hover:text-red-400 transition-colors text-xs font-semibold cursor-pointer"
                >
                    Sign Out
                </button>

                <div className="text-center mb-8 mt-4">
                    <div className="bg-blue-600/10 border border-blue-500/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-400">
                        <Building2 size={28} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100">Select Company</h2>
                    <p className="text-slate-400 text-xs mt-1">Choose workspace & financial year</p>
                </div>

                {isCreating ? renderCreateView() : renderSelectionView()}
            </div>

            {/* ERROR / DEBUG DISPLAY */}
            <div className="fixed bottom-4 left-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg text-[10px] font-mono text-slate-400 z-50 max-w-xs">
                <p className="font-bold text-slate-300 underline mb-1">Workspace Status:</p>
                <p>Status: {isLoading ? 'Loading...' : 'Ready'}</p>
                <p>Companies: {companies.length}</p>
                {error && <p className="text-red-400 font-bold mt-1">Error: {error}</p>}
                <button onClick={fetchCompanies} className="mt-2 bg-slate-950 text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-slate-800 block w-full text-center hover:bg-slate-900 cursor-pointer">Reload Workspace</button>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {deletingCompanyId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
                    <div className="bg-[#0d1220] border border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm text-slate-300">
                        <div className="text-center mb-5">
                            <div className="bg-red-500/10 border border-red-500/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 text-red-400">
                                <Shield size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-100">Verification Required</h3>
                            <p className="text-slate-400 text-xs mt-1">
                                Deleting this company is permanent. Enter your password to confirm.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="admin-password" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Admin Password</label>
                                <input
                                    id="admin-password"
                                    type="password"
                                    autoFocus
                                    className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg outline-none focus:border-red-500"
                                    placeholder="Enter password"
                                    value={adminPassword}
                                    onChange={(e) => {
                                        setAdminPassword(e.target.value);
                                        setDeleteError(null);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && confirmCompanyDelete()}
                                />
                                {deleteError && <p className="text-red-400 text-xs mt-2 font-medium">⚠ {deleteError}</p>}
                            </div>

                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => {
                                        setDeletingCompanyId(null);
                                        setAdminPassword('');
                                        setDeleteError(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 font-semibold rounded-lg hover:bg-slate-900 transition-colors cursor-pointer text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmCompanyDelete}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow transition-all flex justify-center items-center gap-1.5 cursor-pointer text-xs"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

CompanySelection.propTypes = {
    onSelect: PropTypes.func.isRequired,
    onLogout: PropTypes.func.isRequired,
    user: PropTypes.shape({
        username: PropTypes.string,
        role: PropTypes.string,
        max_companies: PropTypes.number,
        allowed_years: PropTypes.string
    }).isRequired
};

export default CompanySelection;
