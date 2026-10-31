import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { ArtifactsPane } from './components/ArtifactsPane';
import { SettingsModal } from './components/SettingsModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthView } from './components/AuthView';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { apiCall, getToken, setToken } from './utils/api';

function App() {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [user, setUser] = useState<any>(null);
  
  // Modals state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'settings' | 'personalize'>('settings');
  const [showAdmin, setShowAdmin] = useState(false);

  // Core Chat state
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isIncognito, setIsIncognito] = useState(false);

  // Streaming state
  const [streamingText, setStreamingText] = useState('');
  const [streamingError, setStreamingError] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Artifact split view state
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [conversationArtifacts, setConversationArtifacts] = useState<any[]>([]);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const triggerToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Check URL parameters for Discord login returns
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      setTokenState(urlToken);
      // Clean query parameters from history
      window.history.replaceState({}, document.title, window.location.pathname);
      triggerToast('success', 'Logged in via Discord OAuth!');
    }
  }, []);

  // Fetch initial profile if token exists
  useEffect(() => {
    if (token) {
      fetchUser();
      fetchConversations();
    } else {
      setUser(null);
    }
  }, [token]);

  // Load chat messages when current chat changes
  useEffect(() => {
    if (currentChatId) {
      fetchChatMessages(currentChatId);
      fetchConversationArtifacts(currentChatId);
    } else {
      setCurrentMessages([]);
      setConversationArtifacts([]);
      setActiveArtifactId(null);
    }
  }, [currentChatId]);

  const fetchUser = async () => {
    try {
      const data = await apiCall('/auth/me');
      setUser(data);
    } catch (err) {
      console.error('Failed to load credentials state:', err);
      // Token is stale or invalid, clear it
      setTokenState(null);
    }
  };

  const fetchConversations = async () => {
    try {
      const data = await apiCall('/chats');
      setConversations(data);
      if (data.length > 0 && !currentChatId) {
        setCurrentChatId(data[0].conversationId);
      }
    } catch (err) {
      console.error('Failed to load chat listing:', err);
    }
  };

  const fetchChatMessages = async (chatId: string) => {
    try {
      const data = await apiCall(`/chats/${chatId}`);
      setCurrentMessages(data.messages || []);
      setIsIncognito(data.isIncognito || false);
    } catch (err) {
      console.error('Failed to load chat details:', err);
    }
  };

  const fetchConversationArtifacts = async (chatId: string) => {
    try {
      const data = await apiCall(`/artifacts/conversation/${chatId}`);
      setConversationArtifacts(data || []);
    } catch (err) {
      console.error('Error fetching conversation artifacts:', err);
    }
  };

  // Chat Actions
  const handleNewChat = async (title = 'New Conversation') => {
    try {
      const data = await apiCall('/chats/new', {
        method: 'POST',
        body: JSON.stringify({ title, isIncognito })
      });
      setConversations(prev => [data, ...prev]);
      setCurrentChatId(data.conversationId);
      triggerToast('info', 'New chat session initialized.');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleRenameChat = async (chatId: string, newTitle: string) => {
    try {
      const data = await apiCall(`/chats/${chatId}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle })
      });
      setConversations(prev => prev.map(c => c.conversationId === chatId ? data : c));
      triggerToast('success', 'Conversation renamed.');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Delete this conversation log?')) return;
    try {
      await apiCall(`/chats/${chatId}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.conversationId !== chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
      }
      triggerToast('info', 'Chat record deleted.');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleSendMessage = async (text: string, model: string) => {
    if (!currentChatId) return;

    // Reset stream buffers
    setStreamingText('');
    setStreamingError('');
    setIsStreaming(true);
    setInputText('');

    // Optimistically add user query to UI log
    const userMsg = { role: 'user', content: text, timestamp: new Date() };
    setCurrentMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch(`http://localhost:5000/api/chats/${currentChatId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          modelLabel: model,
          isIncognito
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Readable stream not supported');
      }

      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          // Keep last unfinished line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleaned = line.trim();
            if (cleaned === '' || cleaned === 'data: [DONE]') continue;

            if (cleaned.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(cleaned.substring(6));
                if (parsed.error) {
                  setStreamingError(parsed.error);
                } else if (parsed.text) {
                  setStreamingText(prev => {
                    const next = prev + parsed.text;
                    // Scan text for artifact tags during streaming to trigger preview panels dynamically!
                    scanForArtifactTrigger(next);
                    return next;
                  });
                }
              } catch (e) {
                // Ignore parsing errors of partial lines
              }
            }
          }
        }
      }

      // Finish streaming, sync back chat history from DB (if not incognito)
      setIsStreaming(false);
      
      // Let's force a brief delay to ensure the backend writes files/database fully before refreshing
      setTimeout(() => {
        if (!isIncognito) {
          fetchChatMessages(currentChatId);
          fetchConversationArtifacts(currentChatId);
        }
      }, 800);

    } catch (err: any) {
      console.error('Streaming failure:', err);
      setStreamingError(err.message || 'Connection lost during streaming completion.');
      setIsStreaming(false);
    }
  };

  // Heuristic scan to open right panel as soon as artifact boundaries are found in the text delta
  const scanForArtifactTrigger = (text: string) => {
    // Matches [artifact-doc/sheet/markdown title="..." id="I"]
    const regex = /\[artifact-(doc|sheet|markdown)\s+title="([^"]+)"\s+id="([^"]+)"\]/i;
    const match = text.match(regex);
    if (match) {
      const artId = match[3];
      if (activeArtifactId !== artId) {
        setActiveArtifactId(artId);
        // Refresh artifacts listing
        if (currentChatId) fetchConversationArtifacts(currentChatId);
      }
    }
  };

  const handleInjectPrompt = (text: string) => {
    setInputText(prev => prev + text);
  };

  if (!token) {
    return (
      <>
        <AuthView onAuthSuccess={setTokenState} triggerToast={triggerToast} />
        <Toast toasts={toasts} setToasts={setToasts} />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-dark text-gray-200">
      
      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        conversations={conversations}
        currentChatId={currentChatId}
        setCurrentChatId={setCurrentChatId}
        isIncognito={isIncognito}
        setIsIncognito={setIsIncognito}
        onOpenSettings={(tab) => {
          setSettingsTab(tab);
          setShowSettings(true);
        }}
        onOpenAdmin={() => setShowAdmin(true)}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        artifacts={conversationArtifacts}
        onOpenArtifact={setActiveArtifactId}
        triggerToast={triggerToast}
      />

      {/* Main Workspace split */}
      <div className="flex-grow flex overflow-hidden">
        <div className={`transition-all duration-300 h-full ${activeArtifactId ? 'w-1/2' : 'w-full'}`}>
          <Workspace
            conversationId={currentChatId}
            messages={currentMessages}
            streamingText={streamingText}
            streamingError={streamingError}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            inputText={inputText}
            setInputText={setInputText}
          />
        </div>

        {/* Right Artifacts Pane split panel */}
        {activeArtifactId && currentChatId && (
          <div className="w-1/2 h-full transition-all duration-300 transform animate-in slide-in-from-right duration-300">
            <ArtifactsPane
              conversationId={currentChatId}
              artifactId={activeArtifactId}
              onClose={() => setActiveArtifactId(null)}
              onInjectPrompt={handleInjectPrompt}
              triggerToast={triggerToast}
            />
          </div>
        )}
      </div>

      {/* Global Modals overlay containers */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        setUser={setUser}
        triggerToast={triggerToast}
        initialTab={settingsTab}
      />

      {showAdmin && (
        <AdminDashboard
          onClose={() => setShowAdmin(false)}
          triggerToast={triggerToast}
        />
      )}

      {/* Animated notification toast panel */}
      <Toast toasts={toasts} setToasts={setToasts} />
    </div>
  );
}

export default App;
