import React, { useState, useEffect } from 'react';
import {
  Users, MessageSquare, AlertTriangle, DollarSign, Key, Server, Activity, Terminal,
  BarChart3, ShieldAlert, Database, Cpu, Gift, X, Plus, Check, RefreshCw
} from 'lucide-react';
import { apiCall } from '../utils/api';

interface AdminProps {
  onClose: () => void;
  triggerToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

type TabType =
  | 'users' | 'chats' | 'errors' | 'costs' | 'keys' | 'providers'
  | 'health' | 'logs' | 'analytics' | 'ratelimits' | 'storage' | 'memory' | 'codes';

export const AdminDashboard: React.FC<AdminProps> = ({ onClose, triggerToast }) => {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // Key form state
  const [rawKey, setRawKey] = useState('');
  const [modelFamily, setModelFamily] = useState('DeepSeek');
  const [groupArea, setGroupArea] = useState('group-A');

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const fetchTabData = async (tab: TabType) => {
    setLoading(true);
    try {
      let endpoint = `/admin/${tab}`;
      if (tab === 'chats') endpoint = '/admin/chats/stats';
      const result = await apiCall(endpoint);
      setData(result);
    } catch (err: any) {
      triggerToast('error', `Failed to load dashboard tab ${tab}: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleUpdateUserTier = async (userId: string, tier: string) => {
    try {
      await apiCall(`/admin/users/${userId}/tier`, {
        method: 'POST',
        body: JSON.stringify({ tier })
      });
      triggerToast('success', `User tier updated to ${tier}.`);
      fetchTabData('users');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
      triggerToast('info', 'User deleted successfully.');
      fetchTabData('users');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  // Key Actions
  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawKey.trim()) return;

    try {
      await apiCall('/admin/keys', {
        method: 'POST',
        body: JSON.stringify({ rawKey, modelFamily, groupArea })
      });
      setRawKey('');
      triggerToast('success', 'API key encrypted and added.');
      fetchTabData('keys');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleReviveKey = async (keyId: string) => {
    try {
      await apiCall(`/admin/keys/${keyId}/revive`, { method: 'POST' });
      triggerToast('success', 'Key status reset to Active.');
      fetchTabData('keys');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await apiCall(`/admin/keys/${keyId}`, { method: 'DELETE' });
      triggerToast('info', 'API key deleted.');
      fetchTabData('keys');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  // Code Actions
  const handleGenerateCode = async () => {
    try {
      const result = await apiCall('/admin/codes/generate', { method: 'POST' });
      triggerToast('success', `Code generated: ${result.code}`);
      fetchTabData('codes');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleExpireCode = async (codeId: string) => {
    try {
      await apiCall(`/admin/codes/${codeId}/expire`, { method: 'POST' });
      triggerToast('info', 'Code expired, unlimited access revoked.');
      fetchTabData('codes');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  // Menu tabs sidebar navigation
  const sidebarItems = [
    { id: 'users', label: 'Users', Icon: Users },
    { id: 'chats', label: 'Chats', Icon: MessageSquare },
    { id: 'errors', label: 'Errors', Icon: AlertTriangle },
    { id: 'costs', label: 'Costs', Icon: DollarSign },
    { id: 'keys', label: 'API Keys', Icon: Key },
    { id: 'providers', label: 'Providers', Icon: Server },
    { id: 'health', label: 'Health', Icon: Activity },
    { id: 'logs', label: 'Logs', Icon: Terminal },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
    { id: 'ratelimits', label: 'Rate Limits', Icon: ShieldAlert },
    { id: 'storage', label: 'Storage', Icon: Database },
    { id: 'memory', label: 'Memory Usage', Icon: Cpu },
    { id: 'codes', label: 'Redeem Codes', Icon: Gift }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#070709] flex flex-col overflow-hidden animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-bg-panel">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-violet-400" />
          <h1 className="text-md font-extrabold text-white tracking-wide">ADMIN CONTROLS</h1>
          <span className="text-[10px] bg-violet-600/20 text-violet-300 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
            Superuser Sandbox
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg border border-white/5"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Left tabs menu */}
        <div className="w-64 bg-white/1 border-r border-white/5 p-4 flex flex-col gap-1 overflow-y-auto">
          {sidebarItems.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${active ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <item.Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right Tab Content Area */}
        <div className="flex-grow p-6 overflow-y-auto bg-bg-dark relative">
          
          {loading && (
            <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-violet-400 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing...
            </div>
          )}

          {activeTab === 'users' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white mb-2">Registered Accounts ({data.length})</h2>
              <div className="border border-white/5 rounded-lg overflow-x-auto">
                <table className="min-w-full text-xs text-left divide-y divide-white/5">
                  <thead className="bg-white/2 text-white">
                    <tr>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Group Area</th>
                      <th className="px-4 py-3">Account Tier</th>
                      <th className="px-4 py-3">Created At</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {data.map((user: any) => (
                      <tr key={user._id} className="hover:bg-white/1">
                        <td className="px-4 py-3 font-semibold text-white">{user.username}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3 font-mono text-[10px]">{user.groupArea}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${user.accountTier === 'Admin' ? 'bg-rose-500/20 text-rose-300' : user.accountTier === 'Unlimited' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>
                            {user.accountTier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5">
                          <button
                            onClick={() => handleUpdateUserTier(user._id, user.accountTier === 'Admin' ? 'Free' : 'Admin')}
                            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-medium text-[10px]"
                          >
                            Toggle Admin
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-300 font-medium text-[10px]"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'chats' && data && (
            <div className="space-y-6">
              {/* Stat Boxes */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Total Conversations</span>
                  <div className="text-2xl font-extrabold text-white mt-1">{data.totalChats}</div>
                </div>
                <div className="glass-card p-4 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Incognito Sessions</span>
                  <div className="text-2xl font-extrabold text-violet-400 mt-1">{data.incognitoChats}</div>
                </div>
                <div className="glass-card p-4 rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Logged Chats</span>
                  <div className="text-2xl font-extrabold text-emerald-400 mt-1">{data.standardChats}</div>
                </div>
              </div>

              {/* Chat Log list */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2.5">Recent Conversations (History log)</h3>
                <div className="border border-white/5 rounded-lg overflow-x-auto">
                  <table className="min-w-full text-xs text-left divide-y divide-white/5">
                    <thead className="bg-white/2 text-white">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Conversation ID</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Last Modified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {data.recentChats?.map((chat: any) => (
                        <tr key={chat._id} className="hover:bg-white/1">
                          <td className="px-4 py-3 font-semibold text-white">
                            {chat.userId?.username || 'Deleted User'}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-400 text-[10px]">
                            {chat.conversationId}
                          </td>
                          <td className="px-4 py-3">{chat.title}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(chat.lastModified).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'errors' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">System Diagnostics & Exception Logs ({data.length})</h2>
              <div className="space-y-2">
                {data.map((err: any) => (
                  <div key={err._id} className="border border-rose-500/20 bg-rose-950/10 p-3.5 rounded-lg flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-300 uppercase">{err.errorType}</span>
                      <span className="text-[10px] text-gray-400">{new Date(err.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-300">{err.message}</p>
                    {err.apiKeyId && (
                      <span className="text-[9px] text-gray-400 font-mono mt-1">
                        Affected Key ID: {err.apiKeyId._id} ({err.apiKeyId.modelFamily} | {err.apiKeyId.groupArea})
                      </span>
                    )}
                  </div>
                ))}
                {data.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-500 border border-white/5 border-dashed rounded-lg">
                    No diagnostics errors reported. System functioning nominally.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'costs' && data && (
            <div className="space-y-6">
              {/* Box */}
              <div className="glass-card p-5 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Estimated Provider Spend</span>
                  <div className="text-3xl font-black text-white mt-1">${data.estimatedTotalCost?.toFixed(4)}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 font-medium">Accumulated Message Volume</span>
                  <div className="text-md font-bold text-violet-400 mt-1">{data.totalUsageCount} completions</div>
                </div>
              </div>

              {/* Breakdown */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2">Estimated Costs per Rotated API Key</h3>
                <div className="border border-white/5 rounded-lg overflow-x-auto">
                  <table className="min-w-full text-xs text-left divide-y divide-white/5">
                    <thead className="bg-white/2 text-white">
                      <tr>
                        <th className="px-4 py-3">Key ID</th>
                        <th className="px-4 py-3">Model Family</th>
                        <th className="px-4 py-3">Group Area</th>
                        <th className="px-4 py-3">Completions Count</th>
                        <th className="px-4 py-3 text-right">Estimated Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {data.breakdown?.map((item: any) => (
                        <tr key={item.keyId} className="hover:bg-white/1">
                          <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{item.keyId}</td>
                          <td className="px-4 py-3 font-bold text-white">{item.modelFamily}</td>
                          <td className="px-4 py-3 font-mono text-[10px]">{item.groupArea}</td>
                          <td className="px-4 py-3 font-mono">{item.usageCount}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">${item.estimatedCost?.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'keys' && data && (
            <div className="space-y-6">
              {/* Add Key Form */}
              <form onSubmit={handleAddKey} className="glass-card p-4 rounded-xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Raw API Key
                  </label>
                  <input
                    type="password"
                    value={rawKey}
                    onChange={e => setRawKey(e.target.value)}
                    placeholder="nvapi-..."
                    className="w-full px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Model Family
                  </label>
                  <select
                    value={modelFamily}
                    onChange={e => setModelFamily(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="DeepSeek" className="bg-bg-panel">DeepSeek</option>
                    <option value="Llama" className="bg-bg-panel">Llama</option>
                    <option value="Qwen" className="bg-bg-panel">Qwen</option>
                    <option value="Mistral" className="bg-bg-panel">Mistral</option>
                    <option value="Nemotron" className="bg-bg-panel">Nemotron</option>
                    <option value="MiniMax" className="bg-bg-panel">MiniMax</option>
                    <option value="GLM" className="bg-bg-panel">GLM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    User Balancing Group
                  </label>
                  <select
                    value={groupArea}
                    onChange={e => setGroupArea(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="group-A" className="bg-bg-panel">group-A</option>
                    <option value="group-B" className="bg-bg-panel">group-B</option>
                    <option value="group-C" className="bg-bg-panel">group-C</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Encrypt & Add Key
                </button>
              </form>

              {/* Key List table */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2">Configured API Keys ({data.length})</h3>
                <div className="border border-white/5 rounded-lg overflow-x-auto">
                  <table className="min-w-full text-xs text-left divide-y divide-white/5">
                    <thead className="bg-white/2 text-white">
                      <tr>
                        <th className="px-4 py-3">Key ID</th>
                        <th className="px-4 py-3">Family</th>
                        <th className="px-4 py-3">Group</th>
                        <th className="px-4 py-3">State</th>
                        <th className="px-4 py-3">Usage Count</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {data.map((key: any) => (
                        <tr key={key._id} className="hover:bg-white/1">
                          <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{key._id}</td>
                          <td className="px-4 py-3 font-semibold text-white">{key.modelFamily}</td>
                          <td className="px-4 py-3 font-mono text-[10px]">{key.groupArea}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${key.statusState === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : key.statusState === 'CoolingDown' ? 'bg-amber-500/20 text-amber-300 animate-pulse' : 'bg-red-500/20 text-red-300'}`}>
                              {key.statusState}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">{key.usageCount}</td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            {key.statusState !== 'Active' && (
                              <button
                                onClick={() => handleReviveKey(key._id)}
                                className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[10px] font-semibold"
                              >
                                Revive
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteKey(key._id)}
                              className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-300 text-[10px]"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'providers' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white mb-2">Provider Status Matrices</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.map((prov: any) => (
                  <div key={prov._id} className="glass-card p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-white">{prov._id} Mappings</span>
                      <span className="text-[10px] bg-violet-600/10 text-violet-300 px-2 py-0.5 rounded font-bold">
                        {prov.activeKeys} / {prov.totalKeys} keys active
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-emerald-950/20 p-2 rounded">
                        <div className="font-bold text-emerald-400">{prov.activeKeys}</div>
                        <div className="text-[9px] text-gray-400">Active</div>
                      </div>
                      <div className="bg-amber-950/20 p-2 rounded">
                        <div className="font-bold text-amber-400">{prov.coolingDownKeys}</div>
                        <div className="text-[9px] text-gray-400">Cooldown</div>
                      </div>
                      <div className="bg-rose-950/20 p-2 rounded">
                        <div className="font-bold text-rose-400">{prov.deadKeys}</div>
                        <div className="text-[9px] text-gray-400">Dead</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'health' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white mb-2">System Diagnostics Telemetry</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-lg border border-white/5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Database</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">{data.dbStatus}</div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-white/5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Uptime</div>
                  <div className="text-sm font-bold text-white mt-1">{Math.floor(data.uptime / 60)} minutes</div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-white/5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Platform</div>
                  <div className="text-sm font-bold text-white mt-1">{data.platform} ({data.arch})</div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-white/5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Server Ping</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">{data.ping}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && data && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-white">Live System Logs Console</h2>
              <div className="bg-black/80 rounded-xl p-4 border border-white/5 font-mono text-[11px] leading-relaxed space-y-1.5 max-h-[60vh] overflow-y-auto">
                {data.map((log: any, i: number) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="text-gray-500">[{log.timestamp}]</span>
                    <span className={`font-semibold ${log.level === 'SUCCESS' ? 'text-emerald-400' : log.level === 'WARN' ? 'text-amber-400' : 'text-sky-400'}`}>
                      {log.level}
                    </span>
                    <span className="text-gray-300">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white mb-2">Completions Analytics</h2>
              <div className="border border-white/5 rounded-lg overflow-hidden">
                <table className="min-w-full text-xs text-left divide-y divide-white/5 bg-white/1">
                  <thead className="bg-white/2 text-white">
                    <tr>
                      <th className="px-4 py-3">Model Family</th>
                      <th className="px-4 py-3">Active Key ID</th>
                      <th className="px-4 py-3">Queries Dispatched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {data.map((item: any) => (
                      <tr key={item._id} className="hover:bg-white/1">
                        <td className="px-4 py-3 font-semibold text-white">{item.modelFamily}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{item._id}</td>
                        <td className="px-4 py-3 font-mono">{item.usageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ratelimits' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">Rate Limits Parameters</h2>
              <div className="glass-card p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                <div>
                  <span className="text-gray-400">Sliding Window:</span>{' '}
                  <span className="font-semibold text-white">{(data.windowMs / 60000).toFixed(0)} minutes</span>
                </div>
                <div>
                  <span className="text-gray-400">Capacity per IP:</span>{' '}
                  <span className="font-semibold text-white">{data.maxRequests} requests</span>
                </div>
                <div>
                  <span className="text-gray-400">Current active blocks:</span>{' '}
                  <span className="text-emerald-400 font-semibold">None (Healthy status)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white mb-2">MongoDB Storage Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="glass-card p-4 rounded border border-white/5">
                  <div className="text-gray-400">Database Name</div>
                  <div className="text-sm font-bold text-white mt-1">{data.dbName}</div>
                </div>
                <div className="glass-card p-4 rounded border border-white/5">
                  <div className="text-gray-400">Collections count</div>
                  <div className="text-sm font-bold text-white mt-1">{data.collectionsCount}</div>
                </div>
                <div className="glass-card p-4 rounded border border-white/5">
                  <div className="text-gray-400">Data size</div>
                  <div className="text-sm font-bold text-white mt-1">{(data.dataSize / 1024).toFixed(2)} KB</div>
                </div>
                <div className="glass-card p-4 rounded border border-white/5">
                  <div className="text-gray-400">Storage size</div>
                  <div className="text-sm font-bold text-white mt-1">{(data.storageSize / 1024).toFixed(2)} KB</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && data && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white mb-2">RAM telemetry</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="glass-card p-4 rounded border border-white/5">
                  <div className="text-gray-400">RSS allocation</div>
                  <div className="text-sm font-bold text-white mt-1">{(data.rss / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div className="glass-card p-4 rounded border border-white/5">
                  <div className="text-gray-400">Heap Total</div>
                  <div className="text-sm font-bold text-white mt-1">{(data.heapTotal / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div className="glass-card p-4 rounded border border-white/5">
                  <div className="text-gray-400">Heap Used</div>
                  <div className="text-sm font-bold text-violet-400 mt-1">{(data.heapUsed / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'codes' && data && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-white">5-Digit Access Code Generator</h2>
                <button
                  onClick={handleGenerateCode}
                  className="px-4.5 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Generate Code
                </button>
              </div>

              {/* Redeem code Table list */}
              <div className="border border-white/5 rounded-lg overflow-x-auto">
                <table className="min-w-full text-xs text-left divide-y divide-white/5">
                  <thead className="bg-white/2 text-white">
                    <tr>
                      <th className="px-4 py-3">Redeem Code</th>
                      <th className="px-4 py-3">Redeemed</th>
                      <th className="px-4 py-3">Redeemed By</th>
                      <th className="px-4 py-3">Redeemed At</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {data.map((code: any) => (
                      <tr key={code._id} className="hover:bg-white/1">
                        <td className="px-4 py-3 font-mono font-bold text-white tracking-widest">
                          {code.code}
                        </td>
                        <td className="px-4 py-3">
                          {code.isRedeemed ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-gray-500">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {code.isRedeemed && code.redeemedBy ? (
                            <div className="flex flex-col">
                              <span className="text-white font-semibold">{code.redeemedBy.username}</span>
                              <span className="text-[10px] text-gray-400">{code.redeemedBy.email}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {code.redeemedAt ? new Date(code.redeemedAt).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${code.isExpired ? 'bg-red-500/20 text-red-300' : code.isRedeemed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-violet-500/20 text-violet-300'}`}>
                            {code.isExpired ? 'Expired' : code.isRedeemed ? 'Redeemed' : 'Unredeemed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!code.isExpired && (
                            <button
                              onClick={() => handleExpireCode(code._id)}
                              className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-300 font-semibold text-[10px]"
                            >
                              Expire/Revoke
                            </button>
                          )}
                          {code.isExpired && (
                            <span className="text-gray-500 text-[10px]">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
