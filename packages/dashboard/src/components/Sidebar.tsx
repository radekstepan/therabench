import { 
  LayoutDashboard, 
  Activity, 
  Search, 
  Gavel, 
  ChevronDown, 
  ChevronRight,
  Download,
  Trash2
} from 'lucide-react';
import { cn, formatPercentWithColor } from '../utils';
import type { QuestionNode } from '../types';

interface SidebarProps {
  view: 'dashboard' | 'questions';
  selectedQuestionId: string | null;
  searchTerm: string;
  categoryFilter: string;
  questionList: Array<QuestionNode & { runCount: number; avgScore: number }>;
  availableJudges: string[];
  selectedJudges: Set<string>;
  judgeDropdownOpen: boolean;
  onViewChange: (view: 'dashboard' | 'questions', questionId: string | null) => void;
  onSearchChange: (term: string) => void;
  onCategoryChange: (category: string) => void;
  onJudgeDropdownToggle: () => void;
  onJudgeSelect: (judge: string) => void;
  onSelectAllJudges: () => void;
  onClearAllJudges: () => void;
  onExport: () => void;
  onClear: () => void;
}

export const Sidebar = ({
  view,
  selectedQuestionId,
  searchTerm,
  categoryFilter,
  questionList,
  availableJudges,
  selectedJudges,
  judgeDropdownOpen,
  onViewChange,
  onSearchChange,
  onCategoryChange,
  onJudgeDropdownToggle,
  onJudgeSelect,
  onSelectAllJudges,
  onClearAllJudges,
  onExport,
  onClear
}: SidebarProps) => {
  return (
    <div className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-950/50">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-emerald-500 font-semibold mb-1">
          <Activity className="w-5 h-5" />
          <span>Thera<span className="text-white">Bench</span></span>
        </div>
        <div className="text-xs text-zinc-500">Therapy Model Evaluator</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <button 
          onClick={() => onViewChange('dashboard', null)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
            view === 'dashboard' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          Overview
        </button>
        
        {/* Judge Filter Dropdown */}
        {availableJudges.length > 0 && (
          <div className="pt-4 pb-2">
            <div className="px-3 mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                Judges ({availableJudges.length})
              </div>
            </div>
            <div className="px-2">
              <button
                onClick={onJudgeDropdownToggle}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-xs transition-colors border",
                  selectedJudges.size === availableJudges.length
                    ? "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                    : "bg-amber-900/20 text-amber-400 border-amber-500/30 hover:bg-amber-900/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <Gavel className="w-3 h-3" />
                  <span>
                    {selectedJudges.size === 0
                      ? "No judges (showing all)"
                      : selectedJudges.size === availableJudges.length
                      ? "All judges"
                      : `${selectedJudges.size} of ${availableJudges.length} selected`}
                  </span>
                </div>
                {judgeDropdownOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {judgeDropdownOpen && (
                <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded p-2 space-y-1">
                  {availableJudges.map(judge => {
                    const isSelected = selectedJudges.has(judge);
                    return (
                      <button
                        key={judge}
                        onClick={() => onJudgeSelect(judge)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2",
                          isSelected
                            ? "bg-zinc-800 text-zinc-200"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        )}
                      >
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full flex-shrink-0 border-2 transition-all",
                            isSelected
                              ? "bg-emerald-600 border-emerald-600"
                              : "border-zinc-600 bg-transparent"
                          )}
                        />
                        <span className="font-mono text-[10px] flex-1">{judge}</span>
                      </button>
                    );
                  })}
                  <div className="pt-2 mt-2 border-t border-zinc-800 flex gap-2">
                    <button
                      onClick={onSelectAllJudges}
                      className="flex-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={onClearAllJudges}
                      className="flex-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="pt-4 pb-2 px-3 text-xs font-semibold text-zinc-600 uppercase tracking-wider">
          Questions ({questionList.length})
        </div>
        
        <div className="px-2 mb-2 space-y-2">
          <div className="flex gap-1 flex-wrap">
            {['all', 'CBT', 'DBT', 'ACT'].map(cat => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium uppercase transition-colors",
                  categoryFilter === cat 
                    ? "bg-emerald-600 text-white" 
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2 w-3 h-3 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Filter..." 
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
            />
          </div>
        </div>

        <div className="space-y-0.5">
          {questionList.map(q => (
            <button
              key={q.id}
              onClick={() => onViewChange('questions', q.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded text-xs transition-all relative group",
                selectedQuestionId === q.id ? "bg-emerald-900/10 text-emerald-400" : "text-zinc-400 hover:bg-zinc-900"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-600">{q.id}</span>
                <div className="font-medium truncate flex-1">{q.title}</div>
                <span className='ml-2'>{q.runCount > 0 ? formatPercentWithColor(q.avgScore) : '-'}</span>
              </div>
            </button>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-zinc-800 space-y-2">
        <button 
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300 transition-colors"
        >
          <Download className="w-3 h-3" /> Export JSON
        </button>
        <button 
          onClick={onClear}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 hover:bg-red-900/20 text-red-400/50 hover:text-red-400 rounded text-xs transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Reset
        </button>
      </div>
    </div>
  );
};
