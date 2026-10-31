import React, { useState, useEffect } from 'react';
import { X, Trash2, Key, Bell, Shield, Sparkles, AlertTriangle } from 'lucide-react';
import { apiCall } from '../utils/api';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  setUser: (user: any) => void;
  triggerToast: (type: 'success' | 'error' | 'info', text: string) => void;
  initialTab?: 'settings' | 'personalize';
}

const AVATARS = [
  { label: '🟣 Purple Orbit', color: 'bg-violet-600' },
  { label: '💖 Rose Star', color: 'bg-pink-600' },
  { label: '🟢 Mint Flux', color: 'bg-emerald-600' },
  { label: '🔵 Teal wave', color: 'bg-cyan-600' },
  { label: '🟠 Amber core', color: 'bg-amber-600' }
];

const SKILL_LIST = [
  'Conciseness',
  'Refactoring',
  'Code generation',
  'Research mode',
  'Writing mode',
  'Data mode',
  'Language mode',
  'Ops mode'
];

export const SettingsModal: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  user,
  setUser,
  triggerToast,
  initialTab = 'settings'
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'personalize'>(initialTab);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [notifications, setNotifications] = useState(false);
  const [facts, setFacts] = useState<string[]>([]);
  const [newFact, setNewFact] = useState('');
  const [instructions, setInstructions] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [redeemCode, setRedeemCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      setActiveTab(initialTab);
      // Load local states
      setNotifications(localStorage.getItem('notifications') === 'true');
      setAvatarIndex(parseInt(localStorage.getItem('avatarIndex') || '0', 10));
    }
  }, [isOpen, initialTab]);

  const fetchProfile = async () => {
    try {
      const data = await apiCall('/profile');
      setFacts(data.persistentFacts || []);
      setInstructions(data.agentsMd || '');
      setSkills(data.enabledSkills || []);
    } catch (err) {
      console.error('Failed to load profile details:', err);
    }
  };

  const handleSaveInstructions = async () => {
    try {
      await apiCall('/profile/instructions', {
        method: 'POST',
        body: JSON.stringify({ instructions })
      });
      triggerToast('success', 'Custom instructions updated.');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleToggleSkill = async (skill: string) => {
    let updatedSkills = [...skills];
    if (updatedSkills.includes(skill)) {
      updatedSkills = updatedSkills.filter(s => s !== skill);
    } else {
      updatedSkills.push(skill);
    }

    try {
      setSkills(updatedSkills);
      await apiCall('/profile/skills', {
        method: 'POST',
        body: JSON.stringify({ skills: updatedSkills })
      });
      triggerToast('success', `${skill} skill toggled.`);
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;

    try {
      const data = await apiCall('/profile/facts', {
        method: 'POST',
        body: JSON.stringify({ fact: newFact })
      });
      setFacts(data.persistentFacts);
      setNewFact('');
      triggerToast('success', 'Fact saved to AI memory.');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleDeleteFact = async (factToDelete: string) => {
    try {
      const data = await apiCall('/profile/facts', {
        method: 'DELETE',
        body: JSON.stringify({ fact: factToDelete })
      });
      setFacts(data.persistentFacts);
      triggerToast('info', 'Memory statement deleted.');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim() || redeemCode.length !== 5) {
      triggerToast('error', 'Redeem code must be exactly 5 alphanumeric digits.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiCall('/admin/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: redeemCode })
      });
      setUser(data.user);
      setRedeemCode('');
      triggerToast('success', data.message);
      onClose();
    } catch (err: any) {
      triggerToast('error', err.message || 'Invalid or expired redeem code');
    } finally {
      setLoading(false);
    }
  };

  const handleNuke = async () => {
    if (!confirm('CRITICAL WARNING: This will permanently delete your account and all associated messages, memory facts, and artifacts. This action CANNOT be undone. Proceed?')) {
      return;
    }

    try {
      await apiCall('/profile/nuke', { method: 'DELETE' });
      triggerToast('info', 'Account successfully deleted.');
      localStorage.clear();
      window.location.reload();
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleToggleNotifications = (val: boolean) => {
    setNotifications(val);
    localStorage.setItem('notifications', val.toString());
    triggerToast('info', val ? 'Desktop notifications enabled' : 'Notifications muted');
  };

  const handleSetAvatar = (idx: number) => {
    setAvatarIndex(idx);
    localStorage.setItem('avatarIndex', idx.toString());
    triggerToast('success', `Avatar updated to ${AVATARS[idx].label}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-bg-panel border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-white">
              {activeTab === 'settings' ? 'Account Settings' : 'Personalization & Skills'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex bg-white/2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-violet-500 text-white bg-white/3' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/1'}`}
          >
            Basic Settings
          </button>
          <button
            onClick={() => setActiveTab('personalize')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'personalize' ? 'border-violet-500 text-white bg-white/3' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/1'}`}
          >
            Memory & Skill modifiers
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          {activeTab === 'settings' && (
            <>
              {/* Account Tier Badge */}
              <div className="glass-card rounded-lg p-4 flex items-center justify-between border border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 font-medium">Subscription Tier</span>
                  <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-4 h-4 text-violet-400" />
                    {user?.accountTier || 'Free'} Tier
                  </span>
                </div>

                {user?.accountTier === 'Free' && (
                  <form onSubmit={handleRedeem} className="flex gap-2 max-w-[280px] w-full">
                    <input
                      type="text"
                      maxLength={5}
                      value={redeemCode}
                      onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                      placeholder="Redeem 5-Digit Code"
                      className="flex-grow px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 uppercase tracking-widest text-center"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-colors"
                    >
                      {loading ? '...' : 'Upgrade'}
                    </button>
                  </form>
                )}

                {user?.accountTier !== 'Free' && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <Key className="w-3.5 h-3.5" /> Unlimited System Access Enabled
                  </span>
                )}
              </div>

              {/* Avatar Picker */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Choose Avatar Theme</h3>
                <div className="flex gap-3">
                  {AVATARS.map((av, index) => (
                    <button
                      key={index}
                      onClick={() => handleSetAvatar(index)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${av.color} ${avatarIndex === index ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-bg-dark scale-105' : 'opacity-70 hover:opacity-100'}`}
                      title={av.label}
                    >
                      <span className="text-white text-xs font-bold uppercase">
                        {user?.username?.substring(0, 2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Browser Notification */}
              <div className="flex items-center justify-between glass-card p-4 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">Browser Notifications</span>
                    <span className="text-xs text-gray-400">Receive alerts when long processes complete</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={e => handleToggleNotifications(e.target.checked)}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-white/5 border-white/10"
                />
              </div>

              {/* Nuke Data Zone */}
              <div className="border border-red-500/20 bg-red-950/20 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-red-200">Delete Account & Data</span>
                    <span className="text-xs text-red-400/80">Permanently erase profile information and history</span>
                  </div>
                </div>
                <button
                  onClick={handleNuke}
                  className="px-3 py-1.5 rounded border border-red-500/30 bg-red-950/40 hover:bg-red-900/40 text-red-300 text-xs font-semibold transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </>
          )}

          {activeTab === 'personalize' && (
            <>
              {/* Skill Toggles */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-400" /> Toggle AI Skill Modifiers
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SKILL_LIST.map(skill => {
                    const active = skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        onClick={() => handleToggleSkill(skill)}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium text-center transition-all ${active ? 'bg-violet-600/20 border-violet-500/40 text-violet-300 shadow-sm shadow-violet-500/5' : 'bg-white/2 border-white/5 text-gray-400 hover:bg-white/4'}`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom System Instructions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Custom System Instructions</h3>
                  <button
                    onClick={handleSaveInstructions}
                    className="text-xs text-violet-400 hover:text-violet-300 font-semibold"
                  >
                    Save Instructions
                  </button>
                </div>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full h-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none font-mono"
                  placeholder="e.g. 'Always write responses in Python if code is asked. Keep comments minimal.'"
                />
              </div>

              {/* Memory (Facts List) */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">AI Memory (Persistent Facts)</h3>
                
                {/* Add Fact Form */}
                <form onSubmit={handleAddFact} className="flex gap-2">
                  <input
                    type="text"
                    value={newFact}
                    onChange={e => setNewFact(e.target.value)}
                    placeholder="Add custom fact about yourself (e.g. 'I build websites using Node.js')"
                    className="flex-grow px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/5 transition-colors"
                  >
                    Add Fact
                  </button>
                </form>

                {/* Facts List */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {facts.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-500 border border-white/5 border-dashed rounded-lg">
                      No memory facts stored yet. Explicit statements in chat will build memory.
                    </div>
                  ) : (
                    facts.map((fact, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-2 rounded bg-white/2 border border-white/5 text-xs text-gray-300"
                      >
                        <span className="flex-grow truncate pr-4">{fact}</span>
                        <button
                          onClick={() => handleDeleteFact(fact)}
                          className="text-gray-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
