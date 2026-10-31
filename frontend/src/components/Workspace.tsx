import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Mic, Paperclip, ChevronDown, Check,
  Terminal, Pencil, GraduationCap, Compass, Loader2
} from 'lucide-react';

interface WorkspaceProps {
  conversationId: string | null;
  messages: any[];
  streamingText: string;
  streamingError: string;
  isStreaming: boolean;
  onSendMessage: (text: string, model: string) => void;
  inputText: string;
  setInputText: (text: string) => void;
}

const MODELS = [
  'DeepSeek R1',
  'DeepSeek Coder',
  'ChatGPT-4o',
  'Qwen 2.5',
  'Mistral Large',
  'Nemotron 70B',
  'MiniMax',
  'GLM-4'
];

const QUICK_ACTIONS = [
  { id: 'write', label: 'Write essay', Icon: Pencil, text: 'Write a comprehensive essay on ' },
  { id: 'code', label: 'Code script', Icon: Terminal, text: 'Write a clean TypeScript script to ' },
  { id: 'learn', label: 'Learn topic', Icon: GraduationCap, text: 'Explain the core concepts of ' },
  { id: 'life', label: 'Life planning', Icon: Compass, text: 'Create a weekly task planner to ' }
];

export const Workspace: React.FC<WorkspaceProps> = ({
  conversationId,
  messages,
  streamingText,
  streamingError,
  isStreaming,
  onSendMessage,
  inputText,
  setInputText
}) => {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingError]);

  // Click outside to close model dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isStreaming || !conversationId) return;

    let payload = inputText;
    if (attachmentName) {
      payload = `[Attachment: ${attachmentName}]\n\n${payload}`;
    }

    onSendMessage(payload, selectedModel);
    // Reset file uploads
    setAttachmentName(null);
    setUploadProgress(null);
  };

  const handleQuickAction = (text: string) => {
    setInputText(text);
  };

  // Mock voice recognizer
  const handleToggleVoice = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      triggerVoiceSimulation();
    }
  };

  const triggerVoiceSimulation = () => {
    setTimeout(() => {
      setInputText(inputText ? inputText + ' explain key rotation' : 'Explain key rotation');
      setIsListening(false);
    }, 2500);
  };

  // Mock file attachment selector
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
      setUploadProgress(10);
      let p = 10;
      const interval = setInterval(() => {
        p += 30;
        if (p >= 100) {
          setUploadProgress(null);
          clearInterval(interval);
        } else {
          setUploadProgress(p);
        }
      }, 150);
    }
  };

  // Formatting response body: replaces [artifact-...] blocks visually inside the chat logs,
  // showing a clean visual badge that informs the user the artifact is rendered in the right-hand panel
  const formatMessageContent = (text: string) => {
    // Regex for artifact markers
    const regex = /\[artifact-(doc|sheet|markdown)\s+title="([^"]+)"\s+id="([^"]+)"\]([\s\S]*?)\[\/artifact-\1\]/g;
    
    // Check if contains artifacts
    const hasArtifacts = regex.test(text);
    if (!hasArtifacts) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }

    const cleanText = text.replace(regex, (_match, _type, title, _id) => {
      return `\n*Artifact: [${title}] successfully generated and loaded in the workspace split pane.*\n`;
    });

    return (
      <div className="space-y-3">
        <span className="whitespace-pre-wrap">{cleanText}</span>
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-violet-500/20 bg-violet-950/20 max-w-sm">
          <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wide">Workspace Artifact Opened</span>
            <span className="text-[11px] text-gray-300">View detailed contents in the side workspace pane.</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-grow h-screen flex flex-col bg-bg-dark overflow-hidden relative">
      
      {/* Workspace topbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-bg-panel/40 flex-shrink-0">
        
        {/* Model dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-xs text-gray-300 hover:text-white transition-colors border border-white/5 bg-bg-panel"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>{selectedModel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {showModelDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-48 rounded-lg border border-white/10 bg-bg-panel shadow-2xl z-25 overflow-hidden py-1 animate-in fade-in duration-100">
              {MODELS.map(model => (
                <button
                  key={model}
                  onClick={() => {
                    setSelectedModel(model);
                    setShowModelDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-left text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {model}
                  {selectedModel === model && <Check className="w-3.5 h-3.5 text-violet-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 font-medium">Auto-Saving History</span>
        </div>
      </div>

      {/* Messages Feeds scrollbox */}
      <div className="flex-grow overflow-y-auto px-6 py-6 space-y-6">
        {!conversationId ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <GraduationCap className="w-12 h-12 text-violet-500/20" />
            <h2 className="text-md font-bold text-white">Create a Conversation Session</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Click the "New Conversation" button in the left sidebar to generate a chat space and start testing providers and models.
            </p>
          </div>
        ) : messages.length === 0 && !streamingText && !streamingError ? (
          <div className="h-full flex flex-col justify-center max-w-xl mx-auto space-y-6">
            
            {/* Logo grid mock */}
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                What can I build for you today?
              </h2>
              <p className="text-xs text-gray-500">
                Write documents, edit sheet CSVs, code utilities, or test rotating keys.
              </p>
            </div>

            {/* Quick action grid cards */}
            <div className="grid grid-cols-2 gap-3.5">
              {QUICK_ACTIONS.map(act => (
                <button
                  key={act.id}
                  onClick={() => handleQuickAction(act.text)}
                  className="glass-panel p-4 rounded-xl border border-white/5 hover:border-violet-500/25 hover:bg-white/2 hover:scale-[1.01] transition-all text-left flex flex-col gap-2 group"
                >
                  <act.Icon className="w-5 h-5 text-violet-400 group-hover:text-violet-300 transition-colors" />
                  <span className="text-xs font-bold text-white">{act.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={index} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {/* Left avatar icon */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-violet-950/40 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0 font-bold text-xs uppercase animate-pulse">
                      NTL
                    </div>
                  )}

                  {/* Message Bubble text container */}
                  <div className={`px-4 py-3 rounded-xl max-w-[80%] border text-xs shadow-md ${isUser ? 'bg-violet-600/10 border-violet-500/25 text-white' : 'bg-white/2 border-white/5 text-gray-200'}`}>
                    {formatMessageContent(msg.content)}
                  </div>

                  {/* Right avatar icon */}
                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 font-bold text-xs uppercase">
                      ME
                    </div>
                  )}
                </div>
              );
            })}

            {/* Streaming Message Indicator */}
            {(isStreaming || streamingText) && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-violet-950/40 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0 font-bold text-xs uppercase animate-pulse">
                  NTL
                </div>

                <div className="px-4 py-3 rounded-xl max-w-[80%] border bg-white/2 border-white/5 text-xs text-gray-200 shadow-md">
                  {streamingText ? (
                    formatMessageContent(streamingText)
                  ) : (
                    <div className="flex items-center gap-1.5 py-1 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      <span>Generating completion stream...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message Bubble */}
            {streamingError && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-rose-950/40 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0 font-bold text-xs uppercase">
                  ERR
                </div>

                <div className="px-4 py-3 rounded-xl max-w-[80%] border border-rose-500/20 bg-rose-950/10 text-xs text-rose-300 font-semibold shadow-md">
                  {streamingError}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form area */}
      <div className="p-4 border-t border-white/5 bg-bg-panel/40 flex-shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex flex-col gap-2">
          
          {/* File Upload Attachment Indicator */}
          {attachmentName && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-[10px] text-gray-300 w-fit">
              <Paperclip className="w-3.5 h-3.5 text-violet-400" />
              <span>{attachmentName}</span>
              {uploadProgress !== null ? (
                <span className="text-gray-500">({uploadProgress}%)</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAttachmentName(null)}
                  className="text-gray-500 hover:text-white ml-1 font-bold"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {/* Text Area block */}
          <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl p-2 focus-within:border-violet-500 transition-colors">
            
            {/* Attachment Button */}
            <label className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0">
              <Paperclip className="w-4 h-4" />
              <input type="file" onChange={handleFileAttach} className="hidden" />
            </label>

            {/* Main Prompt Input */}
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="flex-grow bg-transparent border-0 text-xs text-white placeholder-gray-500 focus:outline-none resize-none px-1 py-1"
              placeholder={isListening ? "Listening..." : "Ask NoTokenLimit, shift+enter for newline..."}
              disabled={isListening || !conversationId}
            />

            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              disabled={!conversationId}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isListening ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Submit Arrow */}
            <button
              type="submit"
              disabled={!inputText.trim() || isStreaming || !conversationId}
              className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors flex-shrink-0 disabled:opacity-30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
