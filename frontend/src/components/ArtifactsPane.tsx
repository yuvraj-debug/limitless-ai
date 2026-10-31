import React, { useState, useEffect } from 'react';
import { FileText, Table, FileEdit, Clock, Copy, Download, Files, MessageSquare, Plus, Trash2, Split, X } from 'lucide-react';
import { apiCall } from '../utils/api';

interface ArtifactProps {
  conversationId: string;
  artifactId: string;
  onClose: () => void;
  onInjectPrompt: (text: string) => void;
  triggerToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const ArtifactsPane: React.FC<ArtifactProps> = ({
  conversationId,
  artifactId,
  onClose,
  onInjectPrompt,
  triggerToast
}) => {
  const [artifact, setArtifact] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'history'>('view');
  const [subTypeTab, setSubTypeTab] = useState<'Document' | 'Sheet' | 'Markdown'>('Document');
  
  // Sheet Data state
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  
  // Markdown editor content
  const [editorContent, setEditorContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (artifactId) {
      fetchArtifact();
    }
  }, [artifactId, conversationId]);

  const fetchArtifact = async () => {
    try {
      const data = await apiCall(`/artifacts/${conversationId}/${artifactId}`);
      setArtifact(data);
      setSubTypeTab(data.type);
      setEditorContent(data.content);

      if (data.type === 'Sheet') {
        parseSheetContent(data.content);
      }
    } catch (err) {
      console.error('Failed to load artifact details:', err);
    }
  };

  // Convert Sheet raw text (CSV style) to headers and grid cells matrix
  const parseSheetContent = (content: string) => {
    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(r => r.split(',').map(c => c.trim()));
        setSheetHeaders(headers);
        setSheetRows(rows);
      } else {
        setSheetHeaders(['Col 1', 'Col 2']);
        setSheetRows([['', '']]);
      }
    } catch (e) {
      // Fallback
      setSheetHeaders(['Error Header']);
      setSheetRows([['Failed to parse table grid']]);
    }
  };

  // Compile grid headers/rows back to raw CSV string content
  const compileSheetContent = (headers: string[], rows: string[][]): string => {
    const headerLine = headers.join(',');
    const rowLines = rows.map(r => r.join(','));
    return [headerLine, ...rowLines].join('\n');
  };

  // Handle spreadsheet cell edit changes
  const handleCellChange = (rowIndex: number, colIndex: number, val: string) => {
    const updated = [...sheetRows];
    updated[rowIndex][colIndex] = val;
    setSheetRows(updated);
  };

  const handleHeaderChange = (colIndex: number, val: string) => {
    const updated = [...sheetHeaders];
    updated[colIndex] = val;
    setSheetHeaders(updated);
  };

  const addRow = () => {
    const emptyRow = Array(sheetHeaders.length).fill('');
    setSheetRows(prev => [...prev, emptyRow]);
  };

  const deleteRow = (idx: number) => {
    if (sheetRows.length <= 1) return;
    setSheetRows(prev => prev.filter((_, i) => i !== idx));
  };

  const addColumn = () => {
    setSheetHeaders(prev => [...prev, `Col ${prev.length + 1}`]);
    setSheetRows(prev => prev.map(r => [...r, '']));
  };

  const deleteColumn = (colIdx: number) => {
    if (sheetHeaders.length <= 1) return;
    setSheetHeaders(prev => prev.filter((_, i) => i !== colIdx));
    setSheetRows(prev => prev.map(r => r.filter((_, i) => i !== colIdx)));
  };

  // Save changes to backend
  const saveArtifactChanges = async (overrideContent?: string) => {
    let finalContent = editorContent;
    if (subTypeTab === 'Sheet') {
      finalContent = compileSheetContent(sheetHeaders, sheetRows);
    } else if (overrideContent !== undefined) {
      finalContent = overrideContent;
    }

    setSaving(true);
    try {
      const data = await apiCall(`/artifacts/${conversationId}/${artifactId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: finalContent })
      });
      setArtifact(data);
      triggerToast('success', 'Changes saved successfully to history version.');
    } catch (err: any) {
      triggerToast('error', err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Save manual snapshot version
  const saveManualSnapshot = async () => {
    try {
      const data = await apiCall(`/artifacts/${conversationId}/${artifactId}/version`, {
        method: 'POST'
      });
      setArtifact(data.artifact);
      triggerToast('success', 'Manual version snapshot stored.');
    } catch (err: any) {
      triggerToast('error', err.message);
    }
  };

  const handleRestoreVersion = async (content: string) => {
    setEditorContent(content);
    if (subTypeTab === 'Sheet') {
      parseSheetContent(content);
    }
    await saveArtifactChanges(content);
    setActiveTab('view');
  };

  const handleCopy = () => {
    let copyText = editorContent;
    if (subTypeTab === 'Sheet') {
      copyText = compileSheetContent(sheetHeaders, sheetRows);
    }
    navigator.clipboard.writeText(copyText);
    triggerToast('success', 'Content copied to clipboard.');
  };

  const handleDownload = () => {
    let dlText = editorContent;
    let ext = 'txt';
    if (subTypeTab === 'Sheet') {
      dlText = compileSheetContent(sheetHeaders, sheetRows);
      ext = 'csv';
    } else if (subTypeTab === 'Markdown') {
      ext = 'md';
    }
    const blob = new Blob([dlText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact?.title || 'artifact'}.${ext}`;
    a.click();
    triggerToast('info', 'File downloaded successfully.');
  };

  const handleDuplicate = async () => {
    // Inject into chat to duplicate/recreate
    const content = subTypeTab === 'Sheet' ? compileSheetContent(sheetHeaders, sheetRows) : editorContent;
    onInjectPrompt(`Please duplicate this artifact with a new title:\n\n${content}`);
    triggerToast('info', 'Instructions copied to message box.');
  };

  // Safe HTML parser (handles partial markup for preview panel safely)
  const renderSafeMarkdown = (rawText: string) => {
    try {
      // Basic paragraph/header parsing without external libraries for ultimate speed/safety
      return rawText
        .split('\n')
        .map((line, _idx) => {
          const l = line.trim();
          if (l.startsWith('# ')) return `<h1 class="text-xl font-bold border-b border-white/10 pb-1 mt-3 mb-1 text-white">${l.substring(2)}</h1>`;
          if (l.startsWith('## ')) return `<h2 class="text-lg font-bold mt-3 mb-1 text-gray-200">${l.substring(3)}</h2>`;
          if (l.startsWith('### ')) return `<h3 class="text-md font-semibold mt-2 mb-1 text-gray-300">${l.substring(4)}</h3>`;
          if (l.startsWith('- ')) return `<li class="ml-4 list-disc text-gray-300 text-xs">${l.substring(2)}</li>`;
          if (l === '') return '<br/>';
          return `<p class="text-gray-300 text-xs leading-relaxed mb-1">${line}</p>`;
        })
        .join('');
    } catch (e) {
      return `<p class="text-red-400">Rendering preview failed.</p>`;
    }
  };

  if (!artifact) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg-panel border-l border-white/10">
        <span className="w-6 h-6 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-bg-panel border-l border-white/10 overflow-hidden relative">
      
      {/* Top Navbar Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/2">
        <div className="flex items-center gap-2">
          {subTypeTab === 'Document' && <FileText className="w-4 h-4 text-sky-400" />}
          {subTypeTab === 'Sheet' && <Table className="w-4 h-4 text-emerald-400" />}
          {subTypeTab === 'Markdown' && <FileEdit className="w-4 h-4 text-violet-400" />}
          <span className="text-xs font-bold text-white max-w-[150px] truncate">{artifact.title}</span>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopy} title="Copy" className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDownload} title="Export File" className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDuplicate} title="Duplicate to chat" className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <Files className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onInjectPrompt(`Regarding this artifact (${artifactId}), `)}
            title="Discuss in Chat"
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 text-gray-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode selectors */}
      <div className="flex border-b border-white/5 bg-white/1">
        <button
          onClick={() => setActiveTab('view')}
          className={`flex-1 py-2 text-xs font-bold text-center border-b transition-colors ${activeTab === 'view' ? 'border-violet-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Preview View
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 py-2 text-xs font-bold text-center border-b transition-colors ${activeTab === 'edit' ? 'border-violet-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Live Editor
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-bold text-center border-b transition-colors ${activeTab === 'history' ? 'border-violet-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Version History ({artifact.versions?.length || 0})
        </button>
      </div>

      {/* Pane Content */}
      <div className="flex-grow p-4 overflow-auto">
        {activeTab === 'view' && (
          <div className="h-full">
            {subTypeTab === 'Document' && (
              <div className="prose prose-invert max-w-none text-xs text-gray-300 leading-relaxed font-sans whitespace-pre-wrap">
                {editorContent}
              </div>
            )}

            {subTypeTab === 'Sheet' && (
              <div className="overflow-x-auto border border-white/5 rounded-lg">
                <table className="min-w-full text-xs divide-y divide-white/5">
                  <thead className="bg-white/2">
                    <tr>
                      {sheetHeaders.map((head, i) => (
                        <th key={i} className="px-3 py-2 text-left font-bold text-white border-r border-white/5">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sheetRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-white/1">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 text-gray-300 border-r border-white/5">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {subTypeTab === 'Markdown' && (
              <div
                className="prose prose-invert max-w-none break-words text-xs text-gray-300"
                dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(editorContent) }}
              />
            )}
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="h-full flex flex-col gap-4">
            {subTypeTab === 'Sheet' && (
              <div className="flex-grow flex flex-col gap-3">
                {/* Sheet controls */}
                <div className="flex gap-2">
                  <button onClick={addRow} className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1 border border-white/5">
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                  <button onClick={addColumn} className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1 border border-white/5">
                    <Plus className="w-3.5 h-3.5" /> Add Column
                  </button>
                  <button onClick={() => saveArtifactChanges()} className="ml-auto px-4 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors">
                    {saving ? 'Saving...' : 'Save Spreadsheet'}
                  </button>
                </div>

                {/* Edit Grid Table */}
                <div className="overflow-auto border border-white/5 rounded-lg flex-grow max-h-[50vh]">
                  <table className="min-w-full text-xs divide-y divide-white/5">
                    <thead className="bg-white/4">
                      <tr>
                        {sheetHeaders.map((head, colIdx) => (
                          <th key={colIdx} className="px-2 py-1 text-left border-r border-white/5 relative group">
                            <input
                              type="text"
                              value={head}
                              onChange={e => handleHeaderChange(colIdx, e.target.value)}
                              className="bg-transparent border-0 text-white font-bold text-xs focus:outline-none w-full pr-6"
                            />
                            <button
                              onClick={() => deleteColumn(colIdx)}
                              className="absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </th>
                        ))}
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sheetRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-white/1">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2 py-1 border-r border-white/5">
                              <input
                                type="text"
                                value={cell}
                                onChange={e => handleCellChange(rIdx, cIdx, e.target.value)}
                                className="bg-transparent border-0 text-gray-300 text-xs w-full focus:outline-none focus:bg-white/5 px-1 py-0.5 rounded"
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1 text-center">
                            <button
                              onClick={() => deleteRow(rIdx)}
                              className="text-gray-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {subTypeTab !== 'Sheet' && (
              <div className="flex-grow flex flex-col gap-3 h-full">
                <div className="flex gap-2">
                  <span className="text-xs text-gray-400">Modify raw code content in workspace</span>
                  <button
                    onClick={() => saveArtifactChanges()}
                    className="ml-auto px-4 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save File'}
                  </button>
                </div>

                <div className="flex-grow grid grid-cols-2 gap-4 h-[55vh]">
                  {/* Left Code editor */}
                  <textarea
                    value={editorContent}
                    onChange={e => setEditorContent(e.target.value)}
                    className="w-full h-full p-3 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-200 font-mono focus:outline-none focus:border-violet-500 resize-none"
                  />
                  {/* Right split preview */}
                  <div className="w-full h-full p-3 rounded-lg bg-black/10 border border-white/5 overflow-auto">
                    <span className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex items-center gap-1 border-b border-white/5 pb-1">
                      <Split className="w-3 h-3" /> Live Render Preview
                    </span>
                    <div
                      className="prose prose-invert text-xs text-gray-300 whitespace-pre-wrap font-sans"
                      dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(editorContent) }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs text-gray-400 font-medium">Save a manually targeted version snapshot</span>
              <button
                onClick={saveManualSnapshot}
                className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/5 transition-colors"
              >
                Snapshot Current
              </button>
            </div>

            <div className="space-y-2">
              {artifact.versions && artifact.versions.length > 0 ? (
                artifact.versions.map((ver: any, index: number) => (
                  <div
                    key={index}
                    className="glass-card p-3 rounded-lg flex items-center justify-between border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-violet-400" />
                      <div className="flex flex-col">
                        <span className="text-xs text-white font-semibold">Version #{index + 1}</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          Saved: {new Date(ver.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(ver.content)}
                      className="px-2.5 py-1 rounded bg-white/5 hover:bg-violet-600/30 text-white hover:text-violet-300 text-xs font-semibold transition-all border border-white/5"
                    >
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-gray-500 border border-white/5 border-dashed rounded-lg">
                  No historical versions saved yet. Saving changes creates new historical tracks.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
