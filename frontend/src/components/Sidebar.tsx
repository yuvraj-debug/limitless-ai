import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Plus, Search, ShieldAlert, Sparkles, Settings,
  LogOut, Gift, Globe, FileText, Table, FileEdit, Trash2, Edit3, Check
} from 'lucide-react';
import { removeToken } from '../utils/api';

interface SidebarProps {
  user: any;
  conversations: any[];
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  isIncognito: boolean;
  setIsIncognito: (val: boolean) => void;
  onOpenSettings: (tab: 'settings' | 'personalize') => void;
  onOpenAdmin: () => void;
  onNewChat: (title?: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
  artifacts: any[];
  onOpenArtifact: (artifactId: string) => void;
  triggerToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  conversations,
  currentChatId,
  setCurrentChatId,
  isIncognito,
  setIsIncognito,
  onOpenSettings,
  onOpenAdmin,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  artifacts,
  onOpenArtifact,
  triggerToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState<any[]>([]);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Referral code mock
  const referralCode = `REF-NTL${user?.username?.toUpperCase().substring(0, 3)}${Math.floor(100 + Math.random() * 900)}`;

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(conversations);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = conversations.filter(
        c => c.title.toLowerCase().includes(lowerQuery)
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, conversations]);

  const handleLogout = () => {
    removeToken();
    window.location.reload();
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    triggerToast('success', 'Referral code copied! Share with friends.');
  };

  const startRename = (chatId: string, title: string) => {
    setRenameId(chatId);
    setRenameText(title);
  };

  const saveRename = (chatId: string) => {
    if (renameText.trim() !== '') {
      onRenameChat(chatId, renameText);
    }
    setRenameId(null);
  };

  return (
    <div className="w-80 h-screen bg-bg-panel border-r border-white/5 flex flex-col overflow-hidden select-none">
      
      {/* Brand Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-white/2">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-violet-400 animate-spin duration-[15s]" />
          <span className="text-sm font-extrabold text-white tracking-widest uppercase">
            NoTokenLimit
          </span>
        </div>
        {user?.accountTier === 'Admin' && (
          <button
            onClick={onOpenAdmin}
            title="Admin Console"
            className="p-1 rounded-lg border border-red-500/20 bg-red-950/20 text-rose-300 hover:text-white transition-all shadow-sm shadow-red-500/5"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary Actions */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <button
          onClick={() => onNewChat('New Conversation')}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 hover:scale-[1.01]"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500 placeholder-gray-500 transition-colors"
          />
        </div>

        {/* Incognito mode toggle */}
        <div className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${isIncognito ? 'bg-orange-950/20 border-orange-500/20' : 'bg-white/2 border-white/5'}`}>
          <div className="flex flex-col">
            <span className={`text-xs font-bold ${isIncognito ? 'text-orange-400' : 'text-white'}`}>
              Incognito Mode
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5">Do not log chat logs</span>
          </div>
          <input
            type="checkbox"
            checked={isIncognito}
            onChange={e => setIsIncognito(e.target.checked)}
            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 bg-white/5 border-white/10 cursor-pointer"
          />
        </div>
      </div>

      {/* Scrollable Conversation Lists */}
      <div className="flex-grow overflow-y-auto px-2 space-y-4">
        
        {/* Chats Category */}
        <div className="space-y-1">
          <span className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Recent Chats
          </span>
          <div className="space-y-0.5">
            {filteredChats.map(chat => {
              const active = currentChatId === chat.conversationId;
              const isEditing = renameId === chat.conversationId;

              return (
                <div
                  key={chat.conversationId}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${active ? 'bg-white/10 text-white border-l-2 border-violet-500' : 'text-gray-400 hover:text-white hover:bg-white/4'}`}
                >
                  <div
                    onClick={() => !isEditing && setCurrentChatId(chat.conversationId)}
                    className="flex items-center gap-2 flex-grow truncate mr-2"
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0 text-violet-400" />
                    {isEditing ? (
                      <input
                        type="text"
                        value={renameText}
                        onChange={e => setRenameText(e.target.value)}
                        onBlur={() => saveRename(chat.conversationId)}
                        onKeyDown={e => e.key === 'Enter' && saveRename(chat.conversationId)}
                        className="bg-bg-dark border border-white/10 text-xs text-white rounded px-1.5 py-0.5 focus:outline-none w-full"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate">{chat.title}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startRename(chat.conversationId, chat.title)}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteChat(chat.conversationId)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <button onClick={() => saveRename(chat.conversationId)}>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                  )}
                </div>
              );
            })}
            
            {filteredChats.length === 0 && (
              <div className="text-center py-6 text-gray-600 text-[10px]">
                No chats found
              </div>
            )}
          </div>
        </div>

        {/* Current Conversation Artifacts */}
        {artifacts.length > 0 && (
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Generated Artifacts
            </span>
            <div className="space-y-0.5">
              {artifacts.map(art => (
                <div
                  key={art.artifactId}
                  onClick={() => onOpenArtifact(art.artifactId)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/4 cursor-pointer transition-colors"
                >
                  {art.type === 'Document' && <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                  {art.type === 'Sheet' && <Table className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                  {art.type === 'Markdown' && <FileEdit className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                  <span className="truncate">{art.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom User Area */}
      <div className="p-4 border-t border-white/5 space-y-3 bg-white/2 flex-shrink-0">
        
        {/* Referral Card */}
        <div className="p-2.5 rounded bg-violet-950/20 border border-violet-500/10 flex items-center justify-between text-[10px]">
          <div className="flex flex-col">
            <span className="font-bold text-violet-300 flex items-center gap-1">
              <Gift className="w-3 h-3" /> Share & Unlock
            </span>
            <span className="text-gray-400 mt-0.5 font-mono select-all">{referralCode}</span>
          </div>
          <button
            onClick={handleCopyReferral}
            className="px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            Copy
          </button>
        </div>

        {/* Settings button controls */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <button
            onClick={() => onOpenSettings('personalize')}
            className="py-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[10px] font-bold border border-white/5 transition-colors flex items-center justify-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-violet-400" /> Personalize
          </button>
          <button
            onClick={() => onOpenSettings('settings')}
            className="py-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[10px] font-bold border border-white/5 transition-colors flex items-center justify-center gap-1"
          >
            <Settings className="w-3 h-3 text-gray-400" /> Settings
          </button>
        </div>

        {/* User Card info */}
        <div className="flex items-center gap-3 border-t border-white/5 pt-3">
          <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold border border-white/10 uppercase">
            {user?.username?.substring(0, 2)}
          </div>
          <div className="flex flex-col flex-grow min-w-0">
            <span className="text-xs font-bold text-white truncate">{user?.username}</span>
            <span className="text-[10px] text-gray-500 truncate">{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="text-gray-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
