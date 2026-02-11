import { useState, useEffect, useCallback } from 'react'

import { FileText, Users, ShoppingBag, LayoutDashboard, Menu, X, Building, Package, FileDown, ShoppingCart } from 'lucide-react'
import PartyMaster from './components/PartyMaster';
import ProductMaster from './components/ProductMaster';
import SalesEntry from './components/SalesEntry';
import SalesReport from './components/SalesReport';
import PurchaseEntry from './components/PurchaseEntry';
import PurchaseReport from './components/PurchaseReport';
import Login from './components/Login';
import CompanySelection from './components/CompanySelection';
import axios from 'axios';
import TaxReport from './components/TaxReport';
import StockRecording from './components/StockRecording';
import ConsolidatedReport from './components/ConsolidatedReport';
import DailyDelivery from './components/DailyDelivery';

const DASHBOARD_API = '/api/dashboard';

function App() {
  /* Lazy initialization to avoid effect cascade */
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Company Context
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [financialYear, setFinancialYear] = useState(null);

  const [stats, setStats] = useState({
    totalSales: 0,
    totalGST: 0,
    totalBags: 0,
    totalBills: 0,
    lastBillNo: 0
  });

  const [editingSale, setEditingSale] = useState(null);
  const [editingPurchase, setEditingPurchase] = useState(null);

  // Removed useEffect for initial auth check (handled by lazy state)

  // Set up Axios interceptor for Company/FY headers whenever they change
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(config => {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;

      if (selectedCompany) config.headers['company-id'] = selectedCompany.id;
      if (financialYear) config.headers['financial-year'] = financialYear;

      return config;
    });

    return () => axios.interceptors.request.eject(interceptor);
  }, [selectedCompany, financialYear]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await axios.get(DASHBOARD_API);
      setStats(res.data);
    } catch (e) {
      console.error("Dashboard fetch error", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard' && isAuthenticated && selectedCompany) {
      fetchDashboardStats();
    }
  }, [activeTab, isAuthenticated, selectedCompany, financialYear, fetchDashboardStats]);

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({
      username: data.username,
      role: data.role,
      max_companies: data.max_companies,
      allowed_years: data.allowed_years
    }));
    setIsAuthenticated(true);
    setUser({
      username: data.username,
      role: data.role,
      max_companies: data.max_companies,
      allowed_years: data.allowed_years
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('companyId');
    localStorage.removeItem('financialYear');
    setIsAuthenticated(false);
    setUser(null);
    setSelectedCompany(null);
    setFinancialYear(null);
  };

  const handleCompanySelect = (company, fy) => {
    setSelectedCompany(company);
    setFinancialYear(fy);
  };

  /* Moved fetchDashboardStats up */

  const handleEditSale = (sale) => {
    setEditingSale(sale);
    setActiveTab('sales_entry');
  };

  const handleSaleSaved = () => {
    setEditingSale(null);
  };

  const handleEditPurchase = (purchase) => {
    setEditingPurchase(purchase);
    setActiveTab('purchase_entry');
  };

  const handlePurchaseSaved = () => {
    setEditingPurchase(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // If authenticated but no company selected, show selection screen
  if (!selectedCompany) {
    return <CompanySelection onSelect={handleCompanySelect} onLogout={handleLogout} user={user} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setIsMobileMenuOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside className={`
          fixed md:relative z-30 w-64 h-full bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-blue-400">Sales Manager</h2>
              <p className="text-xs text-slate-500">Welcome, {user?.username}</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          {/* Company Info in Sidebar */}
          <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Workspace</div>
            <div className="font-semibold text-white truncate">{selectedCompany.name}</div>
            <div className="text-xs text-blue-400 mt-1">{financialYear}</div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {['dashboard', 'sales_entry', 'purchase_entry', 'daily_delivery', 'party_master', 'product_master', 'stock_recording', 'reports', 'purchase_reports', 'tax_report', 'consolidated'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'sales_entry') setEditingSale(null);
                if (tab === 'purchase_entry') setEditingPurchase(null);
                setIsMobileMenuOpen(false); // Close on mobile
              }}
              className={`flex items-center space-x-3 w-full p-3 rounded transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {tab === 'dashboard' && <LayoutDashboard size={20} />}
              {tab === 'party_master' && <Users size={20} />}
              {tab === 'product_master' && <Package size={20} />}
              {tab === 'sales_entry' && <FileText size={20} />}
              {tab === 'purchase_entry' && <ShoppingCart size={20} />}
              {tab === 'daily_delivery' && <Package size={20} />}
              {tab === 'reports' && <ShoppingBag size={20} />}
              {tab === 'purchase_reports' && <FileDown size={20} />}
              {tab === 'tax_report' && <FileText size={20} />}
              {tab === 'stock_recording' && <Package size={20} />}
              {tab === 'consolidated' && <FileDown size={20} />}
              <span className="capitalize">
                {(() => {
                  if (tab === 'consolidated') return 'Export All';
                  if (tab === 'consolidated') return 'Export All';
                  if (tab === 'reports') return 'Sales Report';
                  if (tab === 'daily_delivery') return 'Daily Delivery';
                  return tab.replace('_', ' ');
                })()}
              </span>
            </button>
          ))}
        </nav>


      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50/50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md shadow-sm p-4 sticky top-0 z-10 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent truncate max-w-[200px] md:max-w-none">{selectedCompany.name.toUpperCase()}</h1>
              <p className="text-xs text-slate-500 hidden md:block tracking-wide">Financial Year: {financialYear}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs md:text-sm text-slate-500 font-medium bg-gray-100 px-3 py-1 rounded-full hidden md:block">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: '2-digit', month: 'short', day: 'numeric' })}
            </div>
            <button
              onClick={() => setSelectedCompany(null)}
              className="text-slate-500 hover:text-blue-600 text-sm font-medium flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              title="Switch Company"
            >
              <Building size={18} /> <span className="hidden md:inline">Switch</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Sign Out"
            >
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {/* Content Container */}
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-fade-in">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white transform hover:scale-[1.02] transition-transform">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-blue-100 font-medium">Total Sales</h3>
                    <div className="p-2 bg-white/20 rounded-lg"><ShoppingBag size={20} className="text-white" /></div>
                  </div>
                  <p className="text-3xl font-bold">₹ {stats.totalSales ? stats.totalSales.toFixed(2) : '0.00'}</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white transform hover:scale-[1.02] transition-transform">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-indigo-100 font-medium">Total GST</h3>
                    <div className="p-2 bg-white/20 rounded-lg"><FileText size={20} className="text-white" /></div>
                  </div>
                  <p className="text-3xl font-bold">₹ {stats.totalGST ? stats.totalGST.toFixed(2) : '0.00'}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="text-gray-500 text-sm font-medium mb-2 uppercase tracking-wide">Total Bags</div>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalBags || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="text-gray-500 text-sm font-medium mb-2 uppercase tracking-wide">Total Bills</div>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalBills || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="text-gray-500 text-sm font-medium mb-2 uppercase tracking-wide">Last Bill No</div>
                  <p className="text-3xl font-bold text-blue-600">{stats.lastBillNo || 0}</p>
                </div>
              </div>
            )}

            <div className="animate-fade-in">
              {activeTab === 'sales_entry' && (
                <SalesEntry saleToEdit={editingSale} onSave={handleSaleSaved} />
              )}
              {activeTab === 'daily_delivery' && (
                <DailyDelivery />
              )}
              {activeTab === 'party_master' && (
                <PartyMaster />
              )}
              {activeTab === 'product_master' && (
                <ProductMaster />
              )}
              {activeTab === 'reports' && (
                <SalesReport onEdit={handleEditSale} company={selectedCompany} />
              )}
              {activeTab === 'purchase_entry' && (
                <PurchaseEntry purchaseToEdit={editingPurchase} onSave={handlePurchaseSaved} />
              )}
              {activeTab === 'purchase_reports' && (
                <PurchaseReport onEdit={handleEditPurchase} company={selectedCompany} />
              )}
              {activeTab === 'tax_report' && (
                <TaxReport company={selectedCompany} />
              )}
              {activeTab === 'stock_recording' && (
                <StockRecording financialYear={financialYear} />
              )}
              {activeTab === 'consolidated' && (
                <ConsolidatedReport company={selectedCompany} financialYear={financialYear} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
