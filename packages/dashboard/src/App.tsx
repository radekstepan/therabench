import { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Trophy, 
  Brain, 
  Shield, 
  Activity, 
  ChevronDown, 
  ChevronRight, 
  Save, 
  Download, 
  Trash2,
  Search,
  Gavel,
  History,
  Info,
  Edit2,
  Plus,
  X,
  ArrowUpDown
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getOverrides, saveOverride, exportData, getRubricOverrides, saveRubricOverride, getQuestionOverrides, saveQuestionOverride, type HumanOverride } from './lib/storage';
import type { QuestionNode, ModelRun, AugmentedResult, Rubric, QuestionOverride } from './types';

// --- Data Importing ---
import questionsDataRaw from '../../eval-engine/data/questions.json';
import resultsData from '../../eval-engine/data/results.json';

// Extract questions array from the JSON structure
const questionsData = (questionsDataRaw as any).questions || questionsDataRaw;

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 60) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

// --- Components ---

const QuestionEditModal = ({
  question,
  isOpen,
  onClose,
  onSave
}: {
  question: QuestionNode;
  isOpen: boolean;
  onClose: () => void;
  onSave: (override: QuestionOverride) => void;
}) => {
  const [editTitle, setEditTitle] = useState(question.title);
  const [editScenario, setEditScenario] = useState(question.scenario);
  const [editMustInclude, setEditMustInclude] = useState<string[]>(question.rubric.mustInclude);
  const [editMustAvoid, setEditMustAvoid] = useState<string[]>(question.rubric.mustAvoid);
  const [newInclude, setNewInclude] = useState('');
  const [newAvoid, setNewAvoid] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEditTitle(question.title);
      setEditScenario(question.scenario);
      setEditMustInclude(question.rubric.mustInclude);
      setEditMustAvoid(question.rubric.mustAvoid);
    }
  }, [isOpen, question]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      title: editTitle,
      scenario: editScenario,
      rubric: {
        mustInclude: editMustInclude,
        mustAvoid: editMustAvoid
      },
      lastUpdated: Date.now()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{zIndex: 10000}} onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Edit Question</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">Scenario</label>
            <textarea
              rows={4}
              value={editScenario}
              onChange={(e) => setEditScenario(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-emerald-500 mb-2 block">Must Include</label>
              <div className="space-y-2">
                {editMustInclude.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm">
                    <span className="flex-1 text-zinc-300">{item}</span>
                    <button
                      onClick={() => setEditMustInclude(editMustInclude.filter((_, idx) => idx !== i))}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInclude}
                    onChange={(e) => setNewInclude(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newInclude.trim()) {
                        setEditMustInclude([...editMustInclude, newInclude.trim()]);
                        setNewInclude('');
                      }
                    }}
                    placeholder="Add item..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => {
                      if (newInclude.trim()) {
                        setEditMustInclude([...editMustInclude, newInclude.trim()]);
                        setNewInclude('');
                      }
                    }}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-red-500 mb-2 block">Must Avoid</label>
              <div className="space-y-2">
                {editMustAvoid.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm">
                    <span className="flex-1 text-zinc-300">{item}</span>
                    <button
                      onClick={() => setEditMustAvoid(editMustAvoid.filter((_, idx) => idx !== i))}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAvoid}
                    onChange={(e) => setNewAvoid(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAvoid.trim()) {
                        setEditMustAvoid([...editMustAvoid, newAvoid.trim()]);
                        setNewAvoid('');
                      }
                    }}
                    placeholder="Add item..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                  <button
                    onClick={() => {
                      if (newAvoid.trim()) {
                        setEditMustAvoid([...editMustAvoid, newAvoid.trim()]);
                        setNewAvoid('');
                      }
                    }}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const RubricEditor = ({ 
  rubric, 
  isEditing, 
  onToggleEdit, 
  onSave 
}: { 
  rubric: Rubric;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (rubric: Rubric) => void;
}) => {
  const [editedRubric, setEditedRubric] = useState<Rubric>(rubric);
  const [newIncludeItem, setNewIncludeItem] = useState('');
  const [newAvoidItem, setNewAvoidItem] = useState('');

  useEffect(() => {
    setEditedRubric(rubric);
  }, [rubric, isEditing]);

  const handleSave = () => {
    onSave(editedRubric);
  };

  const addIncludeItem = () => {
    if (newIncludeItem.trim()) {
      setEditedRubric({
        ...editedRubric,
        mustInclude: [...editedRubric.mustInclude, newIncludeItem.trim()]
      });
      setNewIncludeItem('');
    }
  };

  const addAvoidItem = () => {
    if (newAvoidItem.trim()) {
      setEditedRubric({
        ...editedRubric,
        mustAvoid: [...editedRubric.mustAvoid, newAvoidItem.trim()]
      });
      setNewAvoidItem('');
    }
  };

  const removeIncludeItem = (index: number) => {
    setEditedRubric({
      ...editedRubric,
      mustInclude: editedRubric.mustInclude.filter((_, i) => i !== index)
    });
  };

  const removeAvoidItem = (index: number) => {
    setEditedRubric({
      ...editedRubric,
      mustAvoid: editedRubric.mustAvoid.filter((_, i) => i !== index)
    });
  };

  if (!isEditing) {
    return (
      <div className="flex gap-6 text-xs text-zinc-500">
        <div className="flex-1">
          <span className="text-emerald-500 font-semibold block mb-1">Must Include:</span>
          <ul className="list-disc list-inside space-y-0.5">
            {rubric.mustInclude.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        <div className="flex-1">
          <span className="text-red-500 font-semibold block mb-1">Must Avoid:</span>
          <ul className="list-disc list-inside space-y-0.5">
            {rubric.mustAvoid.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Edit Rubric</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditedRubric(rubric);
              onToggleEdit();
            }}
            className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-emerald-500 font-semibold text-sm mb-2">Must Include:</div>
          <div className="space-y-2">
            {editedRubric.mustInclude.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm">
                <span className="flex-1 text-zinc-300">{item}</span>
                <button
                  onClick={() => removeIncludeItem(i)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newIncludeItem}
                onChange={(e) => setNewIncludeItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIncludeItem()}
                placeholder="Add new item..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                onClick={addIncludeItem}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="text-red-500 font-semibold text-sm mb-2">Must Avoid:</div>
          <div className="space-y-2">
            {editedRubric.mustAvoid.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm">
                <span className="flex-1 text-zinc-300">{item}</span>
                <button
                  onClick={() => removeAvoidItem(i)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAvoidItem}
                onChange={(e) => setNewAvoidItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAvoidItem()}
                placeholder="Add new item..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
              />
              <button
                onClick={addAvoidItem}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ComparisonRow = ({ 
  run, 
  rank, 
  isExpanded, 
  onToggle, 
  onSaveOverride 
}: { 
  run: AugmentedResult, 
  rank: number, 
  isExpanded: boolean, 
  onToggle: () => void,
  onSaveOverride: (runId: string, override: HumanOverride) => void
}) => {
  const [editScore, setEditScore] = useState(run.effectiveScore);
  const [editNotes, setEditNotes] = useState(run.override?.expertNotes || '');

  // Reset local state when run changes or override updates
  useEffect(() => {
    setEditScore(run.effectiveScore);
    setEditNotes(run.override?.expertNotes || '');
  }, [run.effectiveScore, run.override]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOverride(run.runId, {
      manualScore: Number(editScore),
      expertNotes: editNotes,
      rankAdjustment: 0,
      lastUpdated: Date.now()
    });
  };

  return (
    <>
      <tr 
        onClick={onToggle} 
        className={cn(
          "cursor-pointer transition-colors border-b border-zinc-800/50",
          isExpanded ? "bg-zinc-800/40" : "hover:bg-zinc-800/20"
        )}
      >
        <td className="p-4 text-center w-16 text-zinc-500 font-mono text-sm">#{rank}</td>
        <td className="p-4">
          <div className="font-medium text-zinc-200">{run.modelName}</div>
          <div className="text-xs text-zinc-500 font-mono mt-0.5">
            {new Date(run.timestamp).toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </td>
        <td className="p-4 text-right">
          <div className={cn("inline-block px-3 py-1 rounded-full text-sm font-bold border", getScoreBg(run.effectiveScore), getScoreColor(run.effectiveScore))}>
            {run.effectiveScore}
          </div>
          {run.override && <div className="text-[10px] text-amber-500 mt-1 flex justify-end items-center gap-1"><Gavel className="w-3 h-3"/> Reviewed</div>}
        </td>
        <td className="p-4 text-center text-zinc-400 font-mono">{run.aiAssessment.metrics.safety}</td>
        <td className="p-4 text-center text-zinc-400 font-mono">{run.aiAssessment.metrics.empathy}</td>
        <td className="p-4 text-right">
          {isExpanded ? <ChevronDown className="w-5 h-5 ml-auto text-zinc-500" /> : <ChevronRight className="w-5 h-5 ml-auto text-zinc-500" />}
        </td>
      </tr>
      
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-zinc-900/30 p-0">
            <div className="border-b border-zinc-800/50 p-6 grid grid-cols-12 gap-8">
              {/* Left: Response & Analysis */}
              <div className="col-span-8 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Model Response
                  </h4>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-300 leading-relaxed text-sm whitespace-pre-wrap">
                    {run.response}
                  </div>
                </div>

                <div>
                   <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> AI Evaluation Reasoning
                    {run.aiAssessment.evaluatorModel && (
                      <span className="text-xs text-zinc-600 font-mono ml-auto">by {run.aiAssessment.evaluatorModel}</span>
                    )}
                  </h4>
                  <div className="text-sm text-zinc-400 italic bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
                    "{run.aiAssessment.reasoning}"
                  </div>
                </div>
              </div>

              {/* Right: Review Form */}
              <div className="col-span-4 bg-zinc-950 border border-zinc-800 rounded-xl p-5 h-fit">
                <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-amber-500" /> Expert Review
                </h4>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 block">Score (0-100)</label>
                    <input 
                      type="number" 
                      min="0" max="100"
                      value={editScore}
                      onChange={(e) => setEditScore(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 block">Notes</label>
                    <textarea 
                      rows={4}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Explain why the score was adjusted..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save & Rerank
                  </button>
                  
                  {run.override && (
                    <div className="text-center text-xs text-zinc-500 pt-2">
                      Last updated: {new Date(run.override.lastUpdated).toLocaleDateString()}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default function App() {
  const [overrides, setOverrides] = useState<Record<string, HumanOverride>>({});
  const [rubricOverrides, setRubricOverrides] = useState<Record<string, Rubric>>({});
  const [questionOverrides, setQuestionOverrides] = useState<Record<string, QuestionOverride>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'questions'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingRubric, setEditingRubric] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'rank' | 'model' | 'score' | 'safety' | 'empathy'>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'name' | 'runs' | 'score' | 'safety' | 'empathy'>('score');
  const [leaderboardSortDirection, setLeaderboardSortDirection] = useState<'asc' | 'desc'>('desc');

  // Load Overrides
  useEffect(() => {
    setOverrides(getOverrides());
    setRubricOverrides(getRubricOverrides());
    setQuestionOverrides(getQuestionOverrides());
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConfirmModalOpen) {
          setIsConfirmModalOpen(false);
        } else if (isQuestionModalOpen) {
          setIsQuestionModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isConfirmModalOpen, isQuestionModalOpen]);

  // Merge Data
  const augmentedResults = useMemo(() => {
    if (!Array.isArray(resultsData) || !Array.isArray(questionsData)) return [];
    
    return (resultsData as ModelRun[]).map((r) => {
      const q = (questionsData as QuestionNode[]).find((q) => q.id === r.questionId);
      const override = overrides[r.runId];
      return { 
        ...r, 
        question: q!, 
        override, 
        effectiveScore: override ? override.manualScore : r.aiAssessment.score 
      } as AugmentedResult;
    }).filter(r => r.question); // Filter out orphans
  }, [overrides]);

  // Model Leaderboard Stats
  const modelStats = useMemo(() => {
    const stats: Record<string, { totalScore: number; safety: number; empathy: number; count: number }> = {};
    
    augmentedResults.forEach(r => {
      if (!stats[r.modelName]) {
        stats[r.modelName] = { totalScore: 0, safety: 0, empathy: 0, count: 0 };
      }
      stats[r.modelName].totalScore += r.effectiveScore;
      stats[r.modelName].safety += r.aiAssessment.metrics.safety;
      stats[r.modelName].empathy += r.aiAssessment.metrics.empathy;
      stats[r.modelName].count += 1;
    });

    const mapped = Object.entries(stats).map(([name, s]) => ({
      name,
      avgScore: Math.round(s.totalScore / s.count),
      avgSafety: Math.round(s.safety / s.count),
      avgEmpathy: Math.round(s.empathy / s.count),
      count: s.count
    }));

    // Apply sorting
    return mapped.sort((a, b) => {
      let comparison = 0;
      
      switch (leaderboardSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'runs':
          comparison = a.count - b.count;
          break;
        case 'score':
          comparison = a.avgScore - b.avgScore;
          break;
        case 'safety':
          comparison = a.avgSafety - b.avgSafety;
          break;
        case 'empathy':
          comparison = a.avgEmpathy - b.avgEmpathy;
          break;
      }
      
      return leaderboardSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [augmentedResults, leaderboardSortBy, leaderboardSortDirection]);

  // Calculate score-based ranks for leaderboard (and top performer)
  const modelStatsWithRank = useMemo(() => {
    const sortedByScore = [...modelStats].sort((a, b) => {
      // Sort by score first (descending)
      const scoreDiff = b.avgScore - a.avgScore;
      if (scoreDiff !== 0) return scoreDiff;
      // Then by name (ascending) for consistent ranks when scores are tied
      return a.name.localeCompare(b.name);
    });
    const ranks = new Map<string, number>();
    sortedByScore.forEach((stat, idx) => {
      ranks.set(stat.name, idx + 1);
    });
    return modelStats.map(stat => ({
      ...stat,
      scoreRank: ranks.get(stat.name)!
    }));
  }, [modelStats]);

  // Top performer (always the #1 ranked model by score)
  const topPerformer = useMemo(() => {
    return modelStatsWithRank.find(stat => stat.scoreRank === 1);
  }, [modelStatsWithRank]);

  // Question List for Sidebar
  const questionList = useMemo(() => {
    return (questionsData as QuestionNode[]).map(q => {
      const runs = augmentedResults.filter(r => r.questionId === q.id);
      return { ...q, runCount: runs.length, avgScore: runs.length ? Math.round(runs.reduce((a,b)=>a+b.effectiveScore,0)/runs.length) : 0 };
    }).filter(q => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' || 
                           q.title.toLowerCase().includes(searchLower) || 
                           q.scenario.toLowerCase().includes(searchLower) ||
                           q.category.toLowerCase().includes(searchLower) ||
                           q.id.toLowerCase().includes(searchLower) ||
                           q.rubric.mustInclude.some(item => item.toLowerCase().includes(searchLower)) ||
                           q.rubric.mustAvoid.some(item => item.toLowerCase().includes(searchLower));
      const matchesCategory = categoryFilter === 'all' || q.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [augmentedResults, searchTerm, categoryFilter]);

  // Active Data for Details View
  const activeQuestion = selectedQuestionId ? (
    questionsData as QuestionNode[]
  ).find(q => q.id === selectedQuestionId) : null;
  
  const activeQuestionWithOverrides = activeQuestion ? {
    ...activeQuestion,
    ...(questionOverrides[activeQuestion.id]?.title && { title: questionOverrides[activeQuestion.id].title }),
    ...(questionOverrides[activeQuestion.id]?.scenario && { scenario: questionOverrides[activeQuestion.id].scenario }),
    rubric: questionOverrides[activeQuestion.id]?.rubric || rubricOverrides[activeQuestion.id] || activeQuestion.rubric
  } as QuestionNode : null;
  
  const activeRuns = useMemo(() => {
    const runs = augmentedResults.filter(r => r.questionId === selectedQuestionId);
    
    // Sort the runs
    const sorted = [...runs].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'model':
          comparison = a.modelName.localeCompare(b.modelName);
          break;
        case 'score':
          comparison = a.effectiveScore - b.effectiveScore;
          break;
        case 'safety':
          comparison = a.aiAssessment.metrics.safety - b.aiAssessment.metrics.safety;
          break;
        case 'empathy':
          comparison = a.aiAssessment.metrics.empathy - b.aiAssessment.metrics.empathy;
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [augmentedResults, selectedQuestionId, sortBy, sortDirection]);

  // Calculate score-based ranks for Model Responses
  const activeRunsWithRank = useMemo(() => {
    const sortedByScore = [...activeRuns].sort((a, b) => {
      // Sort by score first (descending)
      const scoreDiff = b.effectiveScore - a.effectiveScore;
      if (scoreDiff !== 0) return scoreDiff;
      // Then by model name (ascending) for consistent ranks when scores are tied
      return a.modelName.localeCompare(b.modelName);
    });
    const ranks = new Map<string, number>();
    sortedByScore.forEach((run, idx) => {
      ranks.set(run.runId, idx + 1);
    });
    return activeRuns.map(run => ({
      ...run,
      scoreRank: ranks.get(run.runId)!
    }));
  }, [activeRuns]);

  const handleSaveOverride = (runId: string, override: HumanOverride) => {
    const updated = saveOverride(runId, override);
    setOverrides(updated);
  };

  const handleClear = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmClear = () => {
    localStorage.removeItem('therapy_eval_overrides');
    localStorage.removeItem('therapy_eval_rubrics');
    localStorage.removeItem('therapy_eval_questions');
    setOverrides({});
    setRubricOverrides({});
    setQuestionOverrides({});
    setIsConfirmModalOpen(false);
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection(column === 'score' || column === 'safety' || column === 'empathy' ? 'desc' : 'asc');
    }
  };

  const handleLeaderboardSort = (column: typeof leaderboardSortBy) => {
    if (leaderboardSortBy === column) {
      setLeaderboardSortDirection(leaderboardSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLeaderboardSortBy(column);
      setLeaderboardSortDirection(column === 'score' || column === 'safety' || column === 'empathy' || column === 'runs' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <div className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-950/50">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-emerald-500 font-semibold mb-1">
            <Activity className="w-5 h-5" />
            <span>Eval<span className="text-white">Dashboard</span></span>
          </div>
          <div className="text-xs text-zinc-500">Therapy Model Evaluator</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          <button 
            onClick={() => { setView('dashboard'); setSelectedQuestionId(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              view === 'dashboard' ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Overview
          </button>
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-zinc-600 uppercase tracking-wider">
            Questions ({questionList.length})
          </div>
          
          <div className="px-2 mb-2 space-y-2">
            <div className="flex gap-1 flex-wrap">
              {['all', 'CBT', 'DBT', 'ACT'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            {questionList.map(q => (
              <button
                key={q.id}
                onClick={() => { setView('questions'); setSelectedQuestionId(q.id); }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all relative group",
                  selectedQuestionId === q.id ? "bg-emerald-900/10 text-emerald-400" : "text-zinc-400 hover:bg-zinc-900"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-600">{q.id}</span>
                  <div className="font-medium truncate pr-4 flex-1">{q.title}</div>
                </div>
                <div className="flex items-center justify-between mt-1 opacity-70">
                   <span>{q.category}</span>
                   <span className={cn(
                     q.avgScore >= 80 ? "text-emerald-500" : q.avgScore >= 60 ? "text-amber-500" : "text-zinc-500"
                   )}>{q.runCount > 0 ? `${q.avgScore}%` : '-'}</span>
                </div>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-zinc-800 space-y-2">
          <button 
            onClick={() => exportData(resultsData as ModelRun[], overrides, questionsData as QuestionNode[], rubricOverrides, questionOverrides)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300 transition-colors"
          >
            <Download className="w-3 h-3" /> Export JSON
          </button>
           <button 
            onClick={handleClear}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 hover:bg-red-900/20 text-red-400/50 hover:text-red-400 rounded text-xs transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
        {view === 'dashboard' ? (
          <div className="p-8 max-w-5xl mx-auto w-full overflow-y-auto">
            <header className="mb-8">
              <h1 className="text-3xl font-light text-white mb-2">Model Leaderboard</h1>
              <p className="text-zinc-500">Aggregated performance across {questionsData.length} therapeutic scenarios.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {topPerformer && (
                <div className="bg-emerald-900/10 border border-emerald-500/20 p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-emerald-500/20"><Trophy className="w-16 h-16" /></div>
                  <div className="relative z-10">
                    <div className="text-emerald-500 text-sm font-medium uppercase tracking-wide mb-1">Top Performer</div>
                    <div className="text-2xl font-bold text-white mb-1">{topPerformer.name}</div>
                    <div className="text-3xl font-light text-emerald-400">{topPerformer.avgScore}% <span className="text-sm text-emerald-600/70 ml-1">avg</span></div>
                  </div>
                </div>
              )}
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <div className="text-zinc-500 text-sm font-medium uppercase tracking-wide mb-1">Total Evaluations</div>
                <div className="text-4xl font-light text-white">{augmentedResults.length}</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                 <div className="text-zinc-500 text-sm font-medium uppercase tracking-wide mb-1">Reviews Completed</div>
                 <div className="text-4xl font-light text-amber-400">{Object.keys(overrides).length}</div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-zinc-900/50 border-b border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rank</th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleLeaderboardSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Model Name
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleLeaderboardSort('runs')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Runs
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleLeaderboardSort('score')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Avg Score
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleLeaderboardSort('safety')}
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        Safety
                        <ArrowUpDown className="w-3 h-3" />
                        <Info className="w-3 h-3 cursor-help ml-1" />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Safety Score (0-100)</div>
                          Measures risk assessment, crisis detection, and avoidance of harmful advice. High scores indicate appropriate safety protocols and harm prevention.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => handleLeaderboardSort('empathy')}
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        Empathy
                        <ArrowUpDown className="w-3 h-3" />
                        <Info className="w-3 h-3 cursor-help ml-1" />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Empathy Score (0-100)</div>
                          Evaluates validation, active listening, and emotional attunement. High scores reflect compassionate responses that acknowledge feelings without judgment.
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {modelStatsWithRank.map((stat) => (
                    <tr key={stat.name} className="group hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 text-zinc-500 font-mono">#{stat.scoreRank}</td>
                      <td className="px-6 py-4 font-medium text-white group-hover:text-emerald-400 transition-colors">{stat.name}</td>
                      <td className="px-6 py-4 text-right text-zinc-400">{stat.count}</td>
                      <td className="px-6 py-4 text-right font-medium text-white">{stat.avgScore}</td>
                      <td className="px-6 py-4 text-center text-zinc-400">{stat.avgSafety}</td>
                      <td className="px-6 py-4 text-center text-zinc-400">{stat.avgEmpathy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Question Detail View */
          activeQuestionWithOverrides ? (
            <div className="flex flex-col h-full">
              <QuestionEditModal 
                question={activeQuestionWithOverrides}
                isOpen={isQuestionModalOpen}
                onClose={() => setIsQuestionModalOpen(false)}
                onSave={(override) => {
                  const updated = saveQuestionOverride(activeQuestionWithOverrides.id, override);
                  setQuestionOverrides(updated);
                }}
              />
              
              {/* Question Header */}
              <div className="bg-zinc-900/50 border-b border-zinc-800 p-8">
                <div className="max-w-5xl mx-auto">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">                        <span className="text-zinc-600 font-mono text-xs">{activeQuestionWithOverrides.id}</span>                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium border",
                          activeQuestionWithOverrides.category === 'Safety' ? "bg-red-900/20 text-red-400 border-red-900/30" : "bg-sky-900/20 text-sky-400 border-sky-900/30"
                        )}>
                          {activeQuestionWithOverrides.category}
                        </span>
                        <span className="text-zinc-500 text-xs">Difficulty: {activeQuestionWithOverrides.difficulty}</span>
                      </div>
                      <h2 className="text-2xl font-light text-white">{activeQuestionWithOverrides.title}</h2>
                    </div>
                    <button
                      onClick={() => setIsQuestionModalOpen(true)}
                      className="p-2 text-zinc-600 hover:text-emerald-400 hover:bg-zinc-900 rounded-lg transition-colors"
                      title="Edit question"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-xl text-zinc-300 italic mb-6">
                    "{activeQuestionWithOverrides.scenario}"
                  </div>

                  <RubricEditor 
                    rubric={activeQuestionWithOverrides.rubric}
                    isEditing={editingRubric}
                    onToggleEdit={() => setEditingRubric(!editingRubric)}
                    onSave={(newRubric) => {
                      const updated = saveRubricOverride(activeQuestionWithOverrides.id, newRubric);
                      setRubricOverrides(updated);
                      setEditingRubric(false);
                    }}
                  />
                </div>
              </div>

              {/* Comparison Table Area */}
              <div className="flex-1 overflow-y-auto bg-zinc-950 p-8">
                <div className="max-w-5xl mx-auto">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-zinc-500" /> Model Responses
                      </h3>
                      <span className="text-xs text-zinc-500">{activeRuns.length} runs found</span>
                   </div>

                   {activeRuns.length === 0 ? (
                     <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl">
                       <p className="text-zinc-500">No models have been run on this question yet.</p>
                     </div>
                   ) : (
                     <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-visible shadow-lg">
                       <table className="w-full">
                         <thead className="bg-zinc-950 border-b border-zinc-800">
                           <tr>
                             <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase w-16 text-center">Rank</th>
                             <th 
                               className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors"
                               onClick={() => handleSort('model')}
                             >
                               <div className="flex items-center gap-1">
                                 Model
                                 <ArrowUpDown className="w-3 h-3" />
                               </div>
                             </th>
                             <th 
                               className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase text-right cursor-pointer hover:text-zinc-300 transition-colors"
                               onClick={() => handleSort('score')}
                             >
                               <div className="flex items-center justify-end gap-1">
                                 Score
                                 <ArrowUpDown className="w-3 h-3" />
                               </div>
                             </th>
                             <th 
                               className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors"
                               onClick={() => handleSort('safety')}
                             >
                               <div className="flex items-center justify-center gap-1 group relative">
                                 Safety
                                 <ArrowUpDown className="w-3 h-3" />
                                 <Info className="w-3 h-3 cursor-help ml-1" />
                                 <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl" style={{zIndex: 9999}}>
                                   <div className="font-semibold text-white mb-1">Safety Score (0-100)</div>
                                   Measures risk assessment, crisis detection, and avoidance of harmful advice. High scores indicate appropriate safety protocols and harm prevention.
                                 </div>
                               </div>
                             </th>
                             <th 
                               className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors"
                               onClick={() => handleSort('empathy')}
                             >
                               <div className="flex items-center justify-center gap-1 group relative">
                                 Empathy
                                 <ArrowUpDown className="w-3 h-3" />
                                 <Info className="w-3 h-3 cursor-help ml-1" />
                                 <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl" style={{zIndex: 9999}}>
                                   <div className="font-semibold text-white mb-1">Empathy Score (0-100)</div>
                                   Evaluates validation, active listening, and emotional attunement. High scores reflect compassionate responses that acknowledge feelings without judgment.
                                 </div>
                               </div>
                             </th>
                             <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase text-right w-16"></th>
                           </tr>
                         </thead>
                         <tbody className="bg-zinc-900">
                           {activeRunsWithRank.map((run) => (
                             <ComparisonRow 
                               key={run.runId} 
                               run={run} 
                               rank={run.scoreRank}
                               isExpanded={expandedRunId === run.runId}
                               onToggle={() => setExpandedRunId(expandedRunId === run.runId ? null : run.runId)}
                               onSaveOverride={handleSaveOverride}
                             />
                           ))}
                         </tbody>
                       </table>
                     </div>
                   )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500">
              Select a question from the sidebar to view details.
            </div>
          )
        )}
      </main>

      {/* Confirm Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setIsConfirmModalOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-3">Confirm Reset</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Clear all manual reviews and rubric edits? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
