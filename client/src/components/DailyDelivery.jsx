import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Filter, Search } from 'lucide-react';

const DailyDelivery = () => {
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        name: '',
        product_name: 'TAPIOCA FLOUR',
        quantity: ''
    });

    const [filters, setFilters] = useState({
        date: '',
        name: '',
        product: ''
    });

    const products = ['TAPIOCA FLOUR', 'BINDING PASTE', 'WHITE GLUE', 'GUM'];

    const getBaseUrl = () => {
        return window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
    };

    const fetchDeliveries = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.date) params.append('date', filters.date);
            if (filters.name) params.append('name', filters.name);
            if (filters.product) params.append('product', filters.product);

            const res = await axios.get(`${getBaseUrl()}/daily-deliveries?${params.toString()}`);
            setDeliveries(res.data);
        } catch (error) {
            console.error('Error fetching deliveries:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveries();
    }, [filters]); // Refetch when filters change

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.quantity) {
            alert('Please fill all fields');
            return;
        }

        try {
            await axios.post(`${getBaseUrl()}/daily-deliveries`, formData);
            // Reset form but keep date
            setFormData(prev => ({
                ...prev,
                name: '',
                quantity: '',
                product_name: 'TAPIOCA FLOUR'
            }));
            fetchDeliveries();
            alert('Entry added successfully');
        } catch (error) {
            console.error('Error adding delivery:', error);
            alert('Failed to add entry');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this entry?')) return;
        try {
            await axios.delete(`${getBaseUrl()}/daily-deliveries/${id}`);
            fetchDeliveries();
        } catch (error) {
            console.error('Error deleting delivery:', error);
            alert('Failed to delete entry');
        }
    };

    // Calculate Total Quantity based on filtered results
    const totalQuantity = deliveries.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Daily Delivery</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Entry Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-emerald-600" />
                        New Entry
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="Enter Name"
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Product</label>
                            <select
                                name="product_name"
                                value={formData.product_name}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {products.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Quantity</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleInputChange}
                                placeholder="Enter Quantity"
                                step="any"
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors font-semibold shadow-md"
                        >
                            Add Entry
                        </button>
                    </form>
                </div>

                {/* Data Table & Filters */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Filters */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Filter Date</label>
                            <input
                                type="date"
                                name="date"
                                value={filters.date}
                                onChange={handleFilterChange}
                                className="w-full p-2 border border-gray-200 rounded text-sm"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Filter Name</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    name="name"
                                    value={filters.name}
                                    onChange={handleFilterChange}
                                    placeholder="Search Name..."
                                    className="w-full pl-8 p-2 border border-gray-200 rounded text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Filter Product</label>
                            <select
                                name="product"
                                value={filters.product}
                                onChange={handleFilterChange}
                                className="w-full p-2 border border-gray-200 rounded text-sm"
                            >
                                <option value="">All Products</option>
                                {products.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        {/* Clear Filters */}
                        <button
                            onClick={() => setFilters({ date: '', name: '', product: '' })}
                            className="text-sm text-red-500 hover:underline px-2 py-2"
                        >
                            Clear
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex justify-between items-center">
                        <span className="text-emerald-800 font-medium">Total Quantity (Filtered)</span>
                        <span className="text-2xl font-bold text-emerald-700">{totalQuantity.toFixed(2)}</span>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-bold uppercase">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Product</th>
                                        <th className="p-3 text-right">Quantity</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan="5" className="p-4 text-center text-gray-500">Loading...</td></tr>
                                    ) : deliveries.length === 0 ? (
                                        <tr><td colSpan="5" className="p-4 text-center text-gray-500">No records found</td></tr>
                                    ) : (
                                        deliveries.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="p-3">{item.date}</td>
                                                <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                                                        ${item.product_name === 'TAPIOCA FLOUR' ? 'bg-yellow-100 text-yellow-800' :
                                                            item.product_name === 'BINDING PASTE' ? 'bg-orange-100 text-orange-800' :
                                                                item.product_name === 'WHITE GLUE' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-purple-100 text-purple-800'}`}>
                                                        {item.product_name}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-bold text-gray-700">{item.quantity}</td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="text-red-400 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyDelivery;
