import { useState, useEffect, useMemo, useRef } from 'react';
import { getOverrides, saveOverride, exportData, getRubricOverrides, saveRubricOverride, getQuestionOverrides, saveQuestionOverride, type HumanOverride } from './lib/storage';
// Removed heavy stats imports as they are now in the worker
import type { QuestionNode, ModelRun, AugmentedResult, Rubric, QuestionOverride, ExtendedModelStat, MissingEvaluations, JudgeStats } from './types';
import { getModelLabelSortValue, cn, isDefaultJudge, isDefaultCandidate } from './utils';

// Worker Import
import StatsWorker from './workers/stats.worker?worker';

// Hooks
import { useDebounce } from './hooks/useDebounce';

// Components
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { QuestionDetail } from './components/QuestionDetail';
import { QuestionEditModal } from './components/QuestionEditModal';
import { ConfirmModal } from './components/ConfirmModal';
import { WelcomeModal } from './components/WelcomeModal';

// --- Data Importing ---
// We now load all questions (standard + transcripts) from the virtual module
import questionsData from 'virtual:questions';
import resultsData from 'virtual:results';

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
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'rank' | 'model' | 'score' | 'safety' | 'empathy' | 'modalityAdherence' | 'label' | 'faithfulness'>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'name' | 'runs' | 'score' | 'safety' | 'empathy' | 'modalityAdherence' | 'label' | 'reliability' | 'pricing' | 'faithfulness'>('score');
  const [leaderboardSortDirection, setLeaderboardSortDirection] = useState<'asc' | 'desc'>('desc');
  const [judgeDropdownOpen, setJudgeDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  
  // State for data computed by worker
  const [augmentedResults, setAugmentedResults] = useState<AugmentedResult[]>([]);
  const [judgeStats, setJudgeStats] = useState<JudgeStats[]>([]);
  const [modelStatsWithRank, setModelStatsWithRank] = useState<ExtendedModelStat[]>([]);
  const [missingEvaluations, setMissingEvaluations] = useState<MissingEvaluations>({ expertsNeedingReviews: {}, modelsWithMissingQuestions: [], mostFrequentExpertCount: 0, totalQuestions: 0 });
  const [bestReliabilityModel, setBestReliabilityModel] = useState<ExtendedModelStat | undefined>(undefined);
  const [bestScoringModel, setBestScoringModel] = useState<ExtendedModelStat | undefined>(undefined);
  const [bestJudge, setBestJudge] = useState<JudgeStats | undefined>(undefined);
  const [questionList, setQuestionList] = useState<Array<QuestionNode & { runCount: number; avgScore: number }>>([]);
  
  // Calculation Status
  const [isCalculating, setIsCalculating] = useState(true);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);

  // Extract unique judges from results
  const availableJudges = useMemo(() => {
    const judges = new Set<string>();
    (resultsData as ModelRun[]).forEach(r => {
      if (r.aiAssessments) {
        Object.keys(r.aiAssessments).forEach(judge => judges.add(judge));
      } else if (r.aiAssessment?.evaluatorModel) {
        judges.add(r.aiAssessment.evaluatorModel);
      }
    });
    return Array.from(judges).sort();
  }, []);
  
  // Extract unique candidate models from results
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    (resultsData as ModelRun[]).forEach(r => {
      models.add(r.modelName);
    });
    return Array.from(models).sort();
  }, []);
  
  const [selectedJudges, setSelectedJudges] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set(availableModels));
  
  // Initialize selected judges when available ones change, respecting default config
  useEffect(() => {
    const defaultSelected = availableJudges.filter(judge => isDefaultJudge(judge));
    setSelectedJudges(new Set(defaultSelected));
  }, [availableJudges]);
  
  useEffect(() => {
    const defaultSelected = availableModels.filter(model => isDefaultCandidate(model));
    setSelectedModels(new Set(defaultSelected));
  }, [availableModels]);

  // Load Overrides
  useEffect(() => {
    setOverrides(getOverrides());
    setRubricOverrides(getRubricOverrides());
    setQuestionOverrides(getQuestionOverrides());
  }, []);

  // Show welcome modal on initialization
  useEffect(() => {
    setIsWelcomeModalOpen(true);
  }, []);

  // --- Debounced Values ---
  // We debounce these values to prevent firing worker calculations on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedSelectedJudges = useDebounce(selectedJudges, 300);
  const debouncedSelectedModels = useDebounce(selectedModels, 300);
  const debouncedCategoryFilter = useDebounce(categoryFilter, 200);

  // Worker setup and communication
  const workerRef = useRef<Worker | null>(null);

  // Helper to restart worker if needed (cancels current work)
  const terminateAndRestartWorker = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    workerRef.current = new StatsWorker();
    
    // Re-initialize with base data
    workerRef.current.postMessage({
      type: 'INIT',
      payload: { resultsData, questionsData }
    });

    // Handle results
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'RESULTS') {
        const {
          augmentedResults,
          judgeStats,
          modelStatsWithRank,
          missingEvaluations,
          bestReliabilityModel,
          bestScoringModel,
          bestJudge,
          questionList
        } = e.data.payload;

        setAugmentedResults(augmentedResults);
        setJudgeStats(judgeStats);
        setModelStatsWithRank(modelStatsWithRank);
        setMissingEvaluations(missingEvaluations);
        setBestReliabilityModel(bestReliabilityModel);
        setBestScoringModel(bestScoringModel);
        setBestJudge(bestJudge);
        setQuestionList(questionList);
        setIsCalculating(false);
      } else if (e.data.type === 'ERROR') {
        console.error("Worker Error:", e.data.error);
        setIsCalculating(false);
      }
    };
  };

  // Initial worker start
  useEffect(() => {
    terminateAndRestartWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Loading indicator effect (graceful degradation)
  useEffect(() => {
    let timer: number;
    if (isCalculating) {
      // Only show loading indicator if calculation takes more than 200ms
      timer = window.setTimeout(() => {
        setShowLoadingIndicator(true);
      }, 200);
    } else {
      setShowLoadingIndicator(false);
    }
    return () => clearTimeout(timer);
  }, [isCalculating]);

  // Trigger calculations when dependencies change
  // We use the DEBOUNCED values here to avoid spamming the worker
  useEffect(() => {
    // If user is clicking around very fast, we terminate the previous worker
    // to "cancel" the stale results and start fresh.
    terminateAndRestartWorker();
    
    setIsCalculating(true);
    
    // Generate a unique ID for this request (optional with terminate strategy but good practice)
    const requestId = Date.now().toString();

    workerRef.current?.postMessage({
      type: 'CALCULATE',
      requestId,
      payload: {
        overrides,
        selectedJudges: debouncedSelectedJudges,
        selectedModels: debouncedSelectedModels,
        availableJudges,
        availableModels,
        searchTerm: debouncedSearchTerm,
        categoryFilter: debouncedCategoryFilter,
        leaderboardSortBy,
        leaderboardSortDirection
      }
    });
  }, [
    overrides, // Immediate override updates
    debouncedSelectedJudges, 
    debouncedSelectedModels,
    // Base data (unlikely to change during session) 
    availableJudges, 
    availableModels, 
    debouncedSearchTerm, 
    debouncedCategoryFilter, 
    leaderboardSortBy, 
    leaderboardSortDirection
  ]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isWelcomeModalOpen) {
          handleCloseWelcome();
        } else if (isConfirmModalOpen) {
          setIsConfirmModalOpen(false);
        } else if (isQuestionModalOpen) {
          setIsQuestionModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isConfirmModalOpen, isQuestionModalOpen, isWelcomeModalOpen]);

  // Determine if we should show stats cards (hide when filtering to models with no data)
  const showStatsCards = useMemo(() => {
    // If no filter or all models selected, always show stats
    if (selectedModels.size === 0 || selectedModels.size === availableModels.length) {
      return true;
    }
    // If filtering, only show stats if at least one filtered model has data
    return modelStatsWithRank.some(stat => stat.count > 0);
  }, [modelStatsWithRank, selectedModels, availableModels]);

  const activeQuestion = selectedQuestionId ? (questionsData as QuestionNode[]).find(q => q.id === selectedQuestionId) : null;
  
  const activeQuestionWithOverrides = activeQuestion ? {
    ...activeQuestion,
    ...(questionOverrides[activeQuestion.id]?.title && { title: questionOverrides[activeQuestion.id].title }),
    ...(questionOverrides[activeQuestion.id]?.scenario && { scenario: questionOverrides[activeQuestion.id].scenario }),
    rubric: questionOverrides[activeQuestion.id]?.rubric || rubricOverrides[activeQuestion.id] || activeQuestion.rubric
  } as QuestionNode : null;
  
  const activeRuns = useMemo(() => {
    const runs = augmentedResults.filter(r => r.questionId === selectedQuestionId);
    
    // Deduplicate runs: keep only the latest run per model
    const latestRunsMap = new Map<string, AugmentedResult>();
    runs.forEach(run => {
      const existing = latestRunsMap.get(run.modelName);
      // If we haven't seen this model yet, or this run is newer, take it
      if (!existing || (run.timestamp && existing.timestamp && new Date(run.timestamp) > new Date(existing.timestamp))) {
        latestRunsMap.set(run.modelName, run);
      } else if (!existing.timestamp && run.timestamp) {
        // Prefer runs with timestamps
        latestRunsMap.set(run.modelName, run);
      }
    });

    const uniqueRuns = Array.from(latestRunsMap.values());
    
    const sorted = [...uniqueRuns].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'model':
          comparison = a.modelName.localeCompare(b.modelName);
          break;
        case 'score':
          comparison = a.effectiveScore - b.effectiveScore;
          break;
        case 'safety':
          comparison = a.effectiveSafety - b.effectiveSafety;
          break;
        case 'empathy':
          comparison = a.effectiveEmpathy - b.effectiveEmpathy;
          break;
        case 'modalityAdherence':
          comparison = a.effectiveModalityAdherence - b.effectiveModalityAdherence;
          break;
        case 'faithfulness':
          comparison = a.effectiveFaithfulness - b.effectiveFaithfulness;
          break;
        case 'label':
          const labelA = getModelLabelSortValue(a.modelName);
          const labelB = getModelLabelSortValue(b.modelName);
          
          // Online models come first
          if (labelA.isOnline && !labelB.isOnline) {
            comparison = -1;
          } else if (!labelA.isOnline && labelB.isOnline) {
            comparison = 1;
          } else if (labelA.isOnline && labelB.isOnline) {
            // Both online: sort alphabetically by name
            comparison = labelA.name.localeCompare(labelB.name);
          } else {
            // Both local: sort by GB value (high to low)
            comparison = labelB.gb - labelA.gb;
          }
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [augmentedResults, selectedQuestionId, sortBy, sortDirection]);

  const activeRunsWithRank = useMemo(() => {
    const sortedByScore = [...activeRuns].sort((a, b) => {
      const scoreDiff = b.effectiveScore - a.effectiveScore;
      if (scoreDiff !== 0) return scoreDiff;
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
      setSortDirection(column === 'score' || column === 'safety' || column === 'empathy' || column === 'modalityAdherence' || column === 'faithfulness' ? 'desc' : 'asc');
    }
  };

  const handleLeaderboardSort = (column: typeof leaderboardSortBy) => {
    if (leaderboardSortBy === column) {
      setLeaderboardSortDirection(leaderboardSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLeaderboardSortBy(column);
      setLeaderboardSortDirection(column === 'score' || column === 'safety' || column === 'empathy' || column === 'modalityAdherence' || column === 'faithfulness' || column === 'runs' || column === 'reliability' ? 'desc' : 'asc');
    }
  };

  const handleJudgeSelect = (judge: string) => {
    const newSelected = new Set(selectedJudges);
    if (newSelected.has(judge)) {
      newSelected.delete(judge);
    } else {
      newSelected.add(judge);
    }
    setSelectedJudges(newSelected);
  };
  
  const handleModelSelect = (model: string) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(model)) {
      newSelected.delete(model);
    } else {
      newSelected.add(model);
    }
    setSelectedModels(newSelected);
  };

  const handleViewChange = (newView: 'dashboard' | 'questions', questionId: string | null) => {
    setView(newView);
    setSelectedQuestionId(questionId);
    setExpandedRunId(null);
  };

  const handleCloseWelcome = () => {
    setIsWelcomeModalOpen(false);
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      <Sidebar
        view={view}
        selectedQuestionId={selectedQuestionId}
        searchTerm={searchTerm}
        categoryFilter={categoryFilter}
        questionList={questionList}
        availableJudges={availableJudges}
        selectedJudges={selectedJudges}
        judgeDropdownOpen={judgeDropdownOpen}
        availableModels={availableModels}
        selectedModels={selectedModels}
        modelDropdownOpen={modelDropdownOpen}
        onViewChange={handleViewChange}
        onSearchChange={setSearchTerm}
        onCategoryChange={setCategoryFilter}
        onJudgeDropdownToggle={() => setJudgeDropdownOpen(!judgeDropdownOpen)}
        onJudgeSelect={handleJudgeSelect}
        onSelectAllJudges={() => setSelectedJudges(new Set(availableJudges))}
        onClearAllJudges={() => setSelectedJudges(new Set())}
        onModelDropdownToggle={() => setModelDropdownOpen(!modelDropdownOpen)}
        onModelSelect={handleModelSelect}
        onSelectAllModels={() => setSelectedModels(new Set(availableModels))}
        onClearAllModels={() => setSelectedModels(new Set())}
        onExport={() => exportData(resultsData as ModelRun[], overrides, questionsData as QuestionNode[], rubricOverrides, questionOverrides)}
        onClear={() => setIsConfirmModalOpen(true)}
        onShowWelcome={() => setIsWelcomeModalOpen(true)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 relative">
        <div 
          className={cn(
            "absolute top-4 right-8 z-50 pointer-events-none transition-opacity duration-300 ease-in-out",
            showLoadingIndicator ? "opacity-100" : "opacity-0"
          )}
        >
           <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-full shadow-xl backdrop-blur-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-400 font-medium">Updating...</span>
           </div>
        </div>

        {view === 'dashboard' ? (
          <Dashboard
            modelStats={modelStatsWithRank}
            judgeStats={judgeStats}
            bestModel={bestReliabilityModel}
            bestScoringModel={bestScoringModel}
            bestJudge={bestJudge}
            missingEvaluations={missingEvaluations}
            sortBy={leaderboardSortBy}
            sortDirection={leaderboardSortDirection}
            onSort={handleLeaderboardSort}
            showStatsCards={showStatsCards}
          />
        ) : (
          activeQuestionWithOverrides ? (
            <>
              <QuestionEditModal 
                question={activeQuestionWithOverrides}
                isOpen={isQuestionModalOpen}
                onClose={() => setIsQuestionModalOpen(false)}
                onSave={(override) => {
                  const updated = saveQuestionOverride(activeQuestionWithOverrides.id, override);
                  setQuestionOverrides(updated);
                }}
              />
              <QuestionDetail
                question={activeQuestionWithOverrides}
                runs={activeRunsWithRank}
                expandedRunId={expandedRunId}
                editingRubric={editingRubric}
                sortBy={sortBy}
                sortDirection={sortDirection}
                selectedJudges={selectedJudges}
                onEditQuestion={() => setIsQuestionModalOpen(true)}
                onToggleRubricEdit={() => setEditingRubric(!editingRubric)}
                onSaveRubric={(newRubric) => {
                  const updated = saveRubricOverride(activeQuestionWithOverrides.id, newRubric);
                  setRubricOverrides(updated);
                  setEditingRubric(false);
                }}
                onToggleRun={(runId) => setExpandedRunId(expandedRunId === runId ? null : runId)}
                onSaveOverride={handleSaveOverride}
                onSort={handleSort}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500">
              Select a question from the sidebar to view details.
            </div>
          )
        )}
      </main>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmClear}
      />

      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={handleCloseWelcome}
      />
    </div>
  );
}
