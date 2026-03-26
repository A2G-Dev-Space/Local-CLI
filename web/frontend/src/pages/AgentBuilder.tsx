import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Save, Lock, Plus, Trash2, Play, X, Terminal, FileText,
  FolderOpen, Search, Code, CheckCircle2, XCircle, Loader2, ChevronRight,
  Eye, Puzzle, MessageSquareText, Wrench, Zap, Globe2, type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

interface CustomTool {
  id: string; name: string; description: string; endpoint: string;
  method: string; headers: string; bodyTemplate: string; parameters: string;
}
interface AgentData {
  id?: string; name: string; description: string; systemPrompt: string;
  isPublic: boolean; enabledTools: string[]; customTools: CustomTool[];
}

const builtinTools: { id: string; name: string; icon: LucideIcon; desc: string; category: string }[] = [
  { id: 'bash', name: 'Bash', icon: Terminal, desc: 'Execute shell commands', category: 'Shell' },
  { id: 'read_file', name: 'Read File', icon: FileText, desc: 'Read file contents', category: 'File System' },
  { id: 'create_file', name: 'Create File', icon: FileText, desc: 'Create new files', category: 'File System' },
  { id: 'edit_file', name: 'Edit File', icon: Code, desc: 'Edit existing files', category: 'File System' },
  { id: 'list_directory', name: 'List Dir', icon: FolderOpen, desc: 'List directory contents', category: 'File System' },
  { id: 'search_files', name: 'Search', icon: Search, desc: 'Search file contents', category: 'Search' },
];
const toolCategories = [...new Set(builtinTools.map((t) => t.category))];
const promptTemplates = [
  { label: 'Coding', value: 'You are an expert software engineer. Help the user write clean, efficient, well-tested code.' },
  { label: 'DevOps', value: 'You are a DevOps specialist. Help with CI/CD, Docker, Kubernetes, and infrastructure tasks.' },
  { label: 'Data', value: 'You are a data analyst. Help analyze data, write queries, and create visualizations.' },
  { label: 'Writer', value: 'You are a technical writer. Help create clear, concise documentation and guides.' },
];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;
const tabs = [
  { id: 'basic', icon: Bot, label: 'agent.tabBasic' },
  { id: 'tools', icon: Puzzle, label: 'agent.tabTools' },
  { id: 'custom', icon: Wrench, label: 'agent.tabCustom' },
  { id: 'prompt', icon: MessageSquareText, label: 'agent.tabPrompt' },
  { id: 'preview', icon: Eye, label: 'agent.tabPreview' },
] as const;
type TabId = (typeof tabs)[number]['id'];

function emptyTool(): CustomTool {
  return { id: crypto.randomUUID(), name: '', description: '', endpoint: '', method: 'GET', headers: '{}', bodyTemplate: '{}', parameters: '{}' };
}

/* ── Custom tool modal ─────────────────────────────────────── */
function ToolModal({ open, onClose, onSave, tool }: { open: boolean; onClose: () => void; onSave: (t: CustomTool) => void; tool?: CustomTool }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CustomTool>(tool || emptyTool());
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; status?: number; data: string } | null>(null);
  useEffect(() => { if (tool) setForm(tool); }, [tool]);
  const validUrl = useMemo(() => { try { new URL(form.endpoint); return true; } catch { return false; } }, [form.endpoint]);
  const set = (p: Partial<CustomTool>) => setForm((f) => ({ ...f, ...p }));

  const handleTest = async () => {
    setTesting(true); setResult(null);
    try {
      const r = await fetch(form.endpoint, { method: form.method, headers: JSON.parse(form.headers || '{}'), body: form.method !== 'GET' ? form.bodyTemplate : undefined });
      setResult({ ok: r.ok, status: r.status, data: (await r.text()).slice(0, 2000) });
    } catch (e) { setResult({ ok: false, data: String(e) }); }
    setTesting(false);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]/90 backdrop-blur-2xl shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)] via-purple-500 to-pink-500" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('agent.addTool')}</h2>
            <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.toolName')}</label><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="my_api_tool" /></div>
            <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.toolMethod')}</label>
              <div className="flex gap-1">{METHODS.map((m) => (<button key={m} onClick={() => set({ method: m })} className={clsx('flex-1 py-2 text-xs font-semibold rounded-lg transition-all', form.method === m ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]')}>{m}</button>))}</div>
            </div>
          </div>
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.toolDesc')}</label><input className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.toolEndpoint')}</label>
            <div className="relative"><input className="input font-mono text-sm pr-10" value={form.endpoint} onChange={(e) => set({ endpoint: e.target.value })} placeholder="https://api.example.com/endpoint" />{form.endpoint && <span className="absolute right-3 top-1/2 -translate-y-1/2">{validUrl ? <CheckCircle2 size={16} className="text-green-400" /> : <XCircle size={16} className="text-red-400" />}</span>}</div>
          </div>
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.toolHeaders')}</label><textarea className="input font-mono text-sm" rows={2} value={form.headers} onChange={(e) => set({ headers: e.target.value })} /></div>
          {form.method !== 'GET' && <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.toolBody')}</label><textarea className="input font-mono text-sm" rows={3} value={form.bodyTemplate} onChange={(e) => set({ bodyTemplate: e.target.value })} /></div>}
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.toolParams')}</label><textarea className="input font-mono text-sm" rows={3} value={form.parameters} onChange={(e) => set({ parameters: e.target.value })} /></div>
          <AnimatePresence>{result && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={clsx('border rounded-xl p-3', result.ok ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5')}>
              <div className="flex items-center gap-2 mb-1">{result.ok ? <CheckCircle2 size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}<span className="text-xs font-semibold">{result.ok ? 'Success' : 'Failed'}</span>{result.status && <span className="text-[10px] font-mono text-[var(--text-secondary)] ml-auto">HTTP {result.status}</span>}</div>
              <pre className="text-xs font-mono max-h-32 overflow-auto text-[var(--text-secondary)] whitespace-pre-wrap">{result.data}</pre>
            </motion.div>
          )}</AnimatePresence>
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
            <button onClick={handleTest} disabled={!validUrl || testing} className="btn-secondary flex items-center gap-2">{testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{t('agent.testTool')}</button>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
              <button onClick={() => { onSave(form); onClose(); }} disabled={!form.name || !validUrl} className="btn-primary">{t('common.save')}</button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────── */
export default function AgentBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEdit = !!id;
  const [tab, setTab] = useState<TabId>('basic');
  const [prevIdx, setPrevIdx] = useState(0);
  const [agent, setAgent] = useState<AgentData>({ name: '', description: '', systemPrompt: '', isPublic: false, enabledTools: builtinTools.map((t) => t.id), customTools: [] });
  const [toolModal, setToolModal] = useState(false);
  const [editTool, setEditTool] = useState<CustomTool | undefined>();
  const [saving, setSaving] = useState(false);

  const idx = tabs.findIndex((t) => t.id === tab);
  const dir = idx > prevIdx ? 1 : -1;
  const promptLen = agent.systemPrompt.length;
  const promptColor = promptLen < 2000 ? 'text-green-400' : promptLen < 4000 ? 'text-yellow-400' : 'text-red-400';

  useEffect(() => { if (id) api.get<AgentData>(`/api/agents/${id}`).then(setAgent).catch(() => {}); }, [id]);

  const switchTab = (t: TabId) => { setPrevIdx(idx); setTab(t); };
  const toggleTool = (id: string) => setAgent((p) => ({ ...p, enabledTools: p.enabledTools.includes(id) ? p.enabledTools.filter((t) => t !== id) : [...p.enabledTools, id] }));
  const saveTool = (tool: CustomTool) => { setAgent((p) => { const i = p.customTools.findIndex((t) => t.id === tool.id); if (i >= 0) { const u = [...p.customTools]; u[i] = tool; return { ...p, customTools: u }; } return { ...p, customTools: [...p.customTools, tool] }; }); setEditTool(undefined); };
  const delTool = (id: string) => setAgent((p) => ({ ...p, customTools: p.customTools.filter((t) => t.id !== id) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit) { await api.put(`/api/agents/${id}`, agent); toast.success(t('agent.saved', 'Agent saved')); }
      else { const c = await api.post<{ id: string }>('/api/agents', agent); toast.success(t('agent.created', 'Agent created')); navigate(`/agents/${c.id}/edit`, { replace: true }); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save agent'); }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{isEdit ? t('agent.edit') : t('agent.new')}</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving || !agent.name} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{t('agent.save')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 border-b border-[var(--border)]">
        {tabs.map((tb) => { const Icon = tb.icon; const active = tab === tb.id; return (
          <button key={tb.id} onClick={() => switchTab(tb.id)} className={clsx('relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap', active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
            <Icon size={16} /><span className="hidden sm:inline">{t(tb.label, tb.id)}</span>
            {active && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />}
          </button>
        ); })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -dir * 40 }} transition={{ duration: 0.2 }}>

          {tab === 'basic' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 flex items-center justify-center flex-shrink-0"><Bot size={32} className="text-[var(--accent)]" /></div>
                <div className="flex-1 space-y-3">
                  <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.name')}</label><input className="input" value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} placeholder="My Agent" /></div>
                  <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">{t('agent.description')}</label><input className="input" value={agent.description} onChange={(e) => setAgent({ ...agent, description: e.target.value })} placeholder="A brief description..." /></div>
                </div>
              </div>
              <button onClick={() => switchTab('tools')} className="btn-ghost text-sm flex items-center gap-1.5 ml-auto">Next: Tools <ChevronRight size={16} /></button>
            </div>
          )}

          {tab === 'tools' && (
            <div className="space-y-6">
              {toolCategories.map((cat) => (
                <div key={cat}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">{cat}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {builtinTools.filter((t) => t.category === cat).map((tool) => { const on = agent.enabledTools.includes(tool.id); return (
                      <button key={tool.id} onClick={() => toggleTool(tool.id)} className={clsx('relative flex items-center gap-3 p-4 rounded-xl border transition-all text-left', on ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--border)] opacity-60 hover:opacity-90')}>
                        <tool.icon size={20} className={on ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                        <div className="flex-1 min-w-0"><div className="text-sm font-medium text-[var(--text-primary)]">{tool.name}</div><div className="text-xs text-[var(--text-secondary)] truncate">{tool.desc}</div></div>
                        <div className={clsx('w-9 h-5 rounded-full flex items-center px-0.5 transition-colors', on ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]')}><motion.div className="w-4 h-4 rounded-full bg-white shadow-sm" animate={{ x: on ? 16 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} /></div>
                      </button>
                    ); })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'custom' && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <div><h2 className="text-base font-semibold text-[var(--text-primary)]">{t('agent.customTools')}</h2><p className="text-xs text-[var(--text-secondary)] mt-0.5">Add external API endpoints as tools</p></div>
                <button onClick={() => { setEditTool(undefined); setToolModal(true); }} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={16} />{t('agent.addTool')}</button>
              </div>
              {agent.customTools.length === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4"><Globe2 size={28} className="text-[var(--text-secondary)]" /></div>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">{t('common.noData')}</p>
                  <button onClick={() => { setEditTool(undefined); setToolModal(true); }} className="btn-ghost text-sm flex items-center gap-1.5"><Plus size={14} />Add first custom tool</button>
                </div>
              ) : (
                <div className="space-y-2">{agent.customTools.map((tool) => (
                  <div key={tool.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--accent)]/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center"><Zap size={14} className="text-[var(--accent)]" /></div>
                      <div className="min-w-0"><div className="text-sm font-medium text-[var(--text-primary)]">{tool.name}</div><div className="text-xs text-[var(--text-secondary)] truncate"><span className="font-mono font-semibold">{tool.method}</span> {tool.endpoint}</div></div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditTool(tool); setToolModal(true); }} className="btn-ghost p-1.5 text-xs">{t('common.edit')}</button>
                      <button onClick={() => delTool(tool.id)} className="btn-ghost p-1.5 text-[var(--error)]"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          )}

          {tab === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Templates:</span>
                {promptTemplates.map((tpl) => (<button key={tpl.label} onClick={() => setAgent({ ...agent, systemPrompt: tpl.value })} className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">{tpl.label}</button>))}
              </div>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="px-4 py-2 bg-[var(--bg-tertiary)]/50 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('agent.systemPrompt')}</span>
                  <span className={clsx('text-xs font-mono', promptColor)}>{promptLen} chars</span>
                </div>
                <textarea className="w-full px-4 py-3 bg-[#0d1117] text-[var(--text-primary)] font-mono text-sm leading-relaxed resize-none outline-none min-h-[280px]" value={agent.systemPrompt} onChange={(e) => setAgent({ ...agent, systemPrompt: e.target.value })} placeholder={t('agent.systemPromptHint')} spellCheck={false} />
                <div className="h-1 bg-[var(--bg-tertiary)]"><div className={clsx('h-full transition-all', promptLen < 2000 ? 'bg-green-500' : promptLen < 4000 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${Math.min(100, (promptLen / 6000) * 100)}%` }} /></div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs text-[var(--text-secondary)] mb-2">Preview (as seen by LLM):</p>
                <div className="text-xs font-mono text-[var(--text-secondary)]/50 italic mb-2">[HIDDEN: Base System Prompt]</div>
                <div className="text-xs font-mono text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{agent.systemPrompt || <span className="text-[var(--text-secondary)] italic">No system prompt set</span>}</div>
              </div>
            </div>
          )}

          {tab === 'preview' && (
            <div className="space-y-6">
              <div className="max-w-sm mx-auto">
                <div className="card p-6 hover:border-[var(--accent)]/30 transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 flex items-center justify-center"><Bot size={28} className="text-[var(--accent)]" /></div>
                    <div className="min-w-0 flex-1"><h3 className="text-base font-semibold text-[var(--text-primary)] truncate">{agent.name || 'Untitled Agent'}</h3><p className="text-xs text-[var(--text-secondary)] mt-0.5">by You</p></div>
                    <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"><Lock size={10} className="mr-1" />Private</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-3">{agent.description || 'No description provided.'}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {agent.enabledTools.slice(0, 4).map((id) => { const tl = builtinTools.find((t) => t.id === id); return tl ? <span key={id} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">{tl.name}</span> : null; })}
                    {agent.enabledTools.length > 4 && <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">+{agent.enabledTools.length - 4}</span>}
                    {agent.customTools.length > 0 && <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--accent)]/10 text-[var(--accent)]">{agent.customTools.length} custom</span>}
                  </div>
                  <div className="pt-3 border-t border-[var(--border)]"><button className="btn-primary w-full text-sm">Use Agent</button></div>
                </div>
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div><div className="text-2xl font-bold text-[var(--accent)]">{agent.enabledTools.length}</div><div className="text-xs text-[var(--text-secondary)]">Built-in Tools</div></div>
                  <div><div className="text-2xl font-bold text-purple-400">{agent.customTools.length}</div><div className="text-xs text-[var(--text-secondary)]">Custom APIs</div></div>
                  <div><div className="text-2xl font-bold text-[var(--text-primary)]">{promptLen}</div><div className="text-xs text-[var(--text-secondary)]">Prompt Chars</div></div>
                  <div><div className="text-2xl font-bold text-[var(--text-secondary)]">Private</div><div className="text-xs text-[var(--text-secondary)]">Visibility</div></div>
                </div>
              </div>
              <div className="flex justify-center">
                <button onClick={handleSave} disabled={saving || !agent.name} className="btn-primary px-8 py-3 text-base flex items-center gap-2">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{isEdit ? t('agent.save') : 'Create Agent'}
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      <ToolModal open={toolModal} onClose={() => { setToolModal(false); setEditTool(undefined); }} onSave={saveTool} tool={editTool} />
    </div>
  );
}
