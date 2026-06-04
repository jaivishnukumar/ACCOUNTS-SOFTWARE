import { useState } from 'react';
import axios from 'axios';
import { Lock, User, ArrowRight } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const baseUrl = '';
            const endpoint = isLogin ? `${baseUrl}/api/login` : `${baseUrl}/api/register`;
            console.log("Attempting login to:", endpoint); // Debug log

            const res = await axios.post(endpoint, formData);

            if (isLogin) {
                // Return token and user info
                onLogin(res.data);
            } else {
                alert('Registration successful! Please login.');
                setIsLogin(true);
            }
        } catch (err) {
            console.error("Login/Register Error:", err);
            const msg = err.response?.data?.error || err.message || 'An error occurred';
            setError(`Error: ${msg} (Status: ${err.response?.status})`);
        }
    };

    return (
        <div className="min-h-screen bg-[#080b13] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0d1220] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-8">
                {/* Form Section */}
                <div className="w-full">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-100 mb-1">
                            {isLogin ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {isLogin ? 'Enter your credentials to access the portal' : 'Sign up to get started'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Invite Code</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        className="pl-10 block w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2.5 outline-none border uppercase font-mono text-sm"
                                        placeholder="INVITE123"
                                        value={formData.inviteCode || ''}
                                        onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-4 w-4 text-slate-500" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="pl-10 block w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2.5 outline-none border text-sm"
                                    placeholder="admin"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-slate-500" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="pl-10 block w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2.5 outline-none border text-sm"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none transition-all cursor-pointer"
                        >
                            {isLogin ? 'Sign In' : 'Sign Up'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => { setIsLogin(!isLogin); setError(''); }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                        >
                            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
