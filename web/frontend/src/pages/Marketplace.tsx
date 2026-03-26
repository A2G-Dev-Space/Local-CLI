import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Bot, Users, Star, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useSessionStore } from '@/stores/session.store';
import { toast } from '@/components/Toast';

interface Agent {
  id: string;
  name: string;
  description: string;
  creatorName: string;
  usageCount: number;
  rating: number;
  category: string;
}

const categories = ['all', 'coding', 'devops', 'data', 'writing'] as const;

export default function Marketplace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createSession } = useSessionStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 12;

  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoading(true);
      try {
        const data = await api.get<Agent[]>('/api/agents/public');
        setAgents(data);
      } catch {
        /* empty marketplace */
      }
      setIsLoading(false);
    };
    fetchAgents();
  }, []);

  const filtered = agents.filter((a) => {
    const matchesSearch =
      !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseAgent = async (agent: Agent) => {
    try {
      const session = await createSession({ name: `${agent.name} Session`, agentId: agent.id });
      navigate(`/chat/${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start agent session');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {t('marketplace.title')}
        </h1>

        {/* Search */}
        <div className="relative max-w-lg mt-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <input
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder={t('marketplace.search')}
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setPage(1); }}
              className={clsx(
                'px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
                activeCategory === cat
                  ? 'bg-[var(--accent)] text-white shadow-glow-sm'
                  : 'bg-[var(--bg-tertiary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] ring-1 ring-[var(--border)]',
              )}
            >
              {t(`marketplace.${cat}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/15 flex items-center justify-center mx-auto mb-4">
            <Bot size={28} className="text-[var(--accent)]" />
          </div>
          <p className="text-[var(--text-secondary)]">{t('marketplace.empty')}</p>
        </div>
      )}

      {/* Agent grid */}
      {!isLoading && filtered.length > 0 && (() => {
        const totalPages = Math.ceil(filtered.length / perPage);
        const paged = filtered.slice((page - 1) * perPage, page * perPage);
        return (<>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paged.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-interactive p-6 group flex flex-col"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0">
                  <Bot size={22} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {t('marketplace.by')} {agent.creatorName}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[var(--text-secondary)] mb-4 flex-1 line-clamp-3">
                {agent.description}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {agent.usageCount} {t('marketplace.uses')}
                  </span>
                  {agent.rating > 0 && (
                    <span className="flex items-center gap-1">
                      <Star size={12} className="text-yellow-400" />
                      {agent.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleUseAgent(agent)}
                  className="btn-ghost text-xs text-[var(--accent)] flex items-center gap-1 hover:gap-2 transition-all"
                >
                  {t('marketplace.useAgent')}
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost p-2"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-[var(--text-secondary)]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost p-2"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        </>);
      })()}
    </div>
  );
}
