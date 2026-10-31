import React, { useState } from 'react';
import { Sparkles, MessageSquareCode } from 'lucide-react';
import { apiCall, setToken } from '../utils/api';

interface AuthProps {
  onAuthSuccess: (token: string) => void;
  triggerToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AuthView: React.FC<AuthProps> = ({ onAuthSuccess, triggerToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const data = await apiCall('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            usernameOrEmail: email || username, // support either
            password
          })
        });
        setToken(data.token);
        triggerToast('success', `Welcome back, ${data.user.username}!`);
        onAuthSuccess(data.token);
      } else {
        // Sign up
        if (!username || !email || !password) {
          triggerToast('error', 'All registration fields are required.');
          setLoading(false);
          return;
        }
        const data = await apiCall('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ username, email, password })
        });
        setToken(data.token);
        triggerToast('success', 'Account registered successfully! Balancing servers...');
        onAuthSuccess(data.token);
      }
    } catch (err: any) {
      triggerToast('error', err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = () => {
    // Redirect to backend Discord OAuth initiation
    window.location.href = 'http://localhost:5000/api/auth/discord';
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-25%] w-[80%] h-[80%] rounded-full bg-violet-950/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-25%] w-[80%] h-[80%] rounded-full bg-pink-950/10 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 border border-white/5 shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center shadow-lg shadow-violet-500/5 mb-4 animate-pulse">
            <MessageSquareCode className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            NoTokenLimit
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isLogin ? 'Enter details to access your workspace' : 'Create an account to start writing without limits'}
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="e.g. janesmith"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              {isLogin ? 'Username or Email' : 'Email Address'}
            </label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              placeholder={isLogin ? "Enter username or email" : "e.g. jane@company.com"}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold tracking-wide shadow-lg shadow-indigo-500/10 focus:outline-none transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-violet-200" />
                {isLogin ? 'Sign In' : 'Create Free Account'}
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center my-6">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="flex-shrink mx-4 text-xs font-medium text-gray-500 uppercase tracking-widest">
            or continue with
          </span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>

        {/* Discord Login Button */}
        <button
          onClick={handleDiscordLogin}
          type="button"
          className="w-full py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#5865F2]/10 hover:scale-[1.01]"
        >
          {/* Discord standard SVG Icon */}
          <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.79.71,1.63,1.4,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.24,48.24,122.91,25.56,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
          </svg>
          Continue with Discord
        </button>

        {/* View Toggle */}
        <div className="text-center mt-6">
          <button
            onClick={() => setIsLogin(!isLogin)}
            type="button"
            className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors focus:outline-none"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};
