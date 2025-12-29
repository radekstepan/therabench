import { useState, useEffect, useMemo } from 'react';
import { getOverrides, saveOverride, exportData, getRubricOverrides, saveRubricOverride, getQuestionOverrides, saveQuestionOverride, type HumanOverride } from './lib/storage';
import type { QuestionNode, ModelRun, AugmentedResult, Rubric, QuestionOverride } from './types';
import { getModelLabelSortValue } from './utils';

// Components
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { QuestionDetail } from './components/QuestionDetail';
import { QuestionEditModal } from './components/QuestionEditModal';
import { ConfirmModal } from './components/ConfirmModal';
import { WelcomeModal } from './components/WelcomeModal';

// --- Data Importing ---
import questionsDataRaw from '../../eval-engine/data/questions.json';
import resultsData from 'virtual:results';

// Extract questions array from the JSON structure
const questionsData = (questionsDataRaw as any).questions || questionsDataRaw;

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
  const [sortBy, setSortBy] = useState<'rank' | 'model' | 'score' | 'safety' | 'empathy' | 'label'>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'name' | 'runs' | 'score' | 'safety' | 'empathy' | 'label'>('score');
  const [leaderboardSortDirection, setLeaderboardSortDirection] = useState<'asc' | 'desc'>('desc');
  const [judgeDropdownOpen, setJudgeDropdownOpen] = useState(false);
  
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
  
  const [selectedJudges, setSelectedJudges] = useState<Set<string>>(new Set(availableJudges));
  
  // Initialize selected judges when available judges change
  useEffect(() => {
    setSelectedJudges(new Set(availableJudges));
  }, [availableJudges]);

  // Load Overrides
  useEffect(() => {
    setOverrides(getOverrides());
    setRubricOverrides(getRubricOverrides());
    setQuestionOverrides(getQuestionOverrides());
  }, []);

  // Show welcome modal on first visit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('therabench_has_seen_welcome');
    if (!hasSeenWelcome) {
      setIsWelcomeModalOpen(true);
    }
  }, []);

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

  // Merge Data and filter by selected judges
  const augmentedResults = useMemo(() => {
    if (!Array.isArray(resultsData) || !Array.isArray(questionsData)) return [];
    
    return (resultsData as ModelRun[])
      .map((r) => {
        const q = (questionsData as QuestionNode[]).find((q) => q.id === r.questionId);
        const override = overrides[r.runId];
        
        // Calculate effective score and metrics from selected judges
        // Use the most recent judgment from each judge
        let effectiveScore: number;
        let effectiveSafety: number;
        let effectiveEmpathy: number;
        
        if (override) {
          effectiveScore = override.manualScore;
        } else if (r.aiAssessments) {
          const judgeScores = Object.entries(r.aiAssessments)
            .filter(([judge]) => selectedJudges.size === 0 || selectedJudges.has(judge))
            .map(([_, assessments]) => {
              // Handle both array and single assessment for backward compatibility
              const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
              // Get the most recent assessment (last in array)
              return assessmentArray.length > 0 ? assessmentArray[assessmentArray.length - 1].score : 0;
            })
            .filter(score => score > 0);
          
          if (judgeScores.length > 0) {
            effectiveScore = Math.round(judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length);
          } else {
            effectiveScore = r.aiAssessment?.score ?? 0;
          }
        } else {
          effectiveScore = r.aiAssessment?.score ?? 0;
        }
        
        if (r.aiAssessments) {
          const selectedAssessments = Object.entries(r.aiAssessments)
            .filter(([judge]) => selectedJudges.size === 0 || selectedJudges.has(judge))
            .flatMap(([_, assessments]) => {
              // Handle both array and single assessment for backward compatibility
              const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
              // Get the most recent assessment (last in array)
              return assessmentArray.length > 0 ? [assessmentArray[assessmentArray.length - 1].metrics] : [];
            })
            .filter(metrics => metrics && typeof metrics.safety === 'number' && typeof metrics.empathy === 'number');
          
          if (selectedAssessments.length > 0) {
            effectiveSafety = Math.round(
              selectedAssessments.reduce((a, b) => a + b.safety, 0) / selectedAssessments.length
            );
            effectiveEmpathy = Math.round(
              selectedAssessments.reduce((a, b) => a + b.empathy, 0) / selectedAssessments.length
            );
          } else {
            effectiveSafety = r.aiAssessment?.metrics?.safety || 0;
            effectiveEmpathy = r.aiAssessment?.metrics?.empathy || 0;
          }
        } else {
          effectiveSafety = r.aiAssessment?.metrics?.safety || 0;
          effectiveEmpathy = r.aiAssessment?.metrics?.empathy || 0;
        }
        
        return { 
          ...r, 
          question: q!, 
          override, 
          effectiveScore,
          effectiveSafety,
          effectiveEmpathy
        } as AugmentedResult;
      })
      .filter(r => r.question)
      .filter(r => {
        if (selectedJudges.size === 0) return true;
        if (r.aiAssessments) {
          return Object.keys(r.aiAssessments).some(judge => selectedJudges.has(judge));
        }
        return r.aiAssessment?.evaluatorModel && selectedJudges.has(r.aiAssessment.evaluatorModel);
      });
  }, [overrides, selectedJudges]);

  // Model Leaderboard Stats
  const modelStats = useMemo(() => {
    const stats: Record<string, { totalScore: number; safety: number; empathy: number; count: number; judgeScoreMap: Record<string, number[]>; uniqueJudges: Set<string> }> = {};
    
    augmentedResults.forEach(r => {
      if (!stats[r.modelName]) {
        stats[r.modelName] = { totalScore: 0, safety: 0, empathy: 0, count: 0, judgeScoreMap: {}, uniqueJudges: new Set() };
      }
      stats[r.modelName].totalScore += r.effectiveScore;
      stats[r.modelName].safety += r.effectiveSafety;
      stats[r.modelName].empathy += r.effectiveEmpathy;
      stats[r.modelName].count += 1;
      
      if (r.aiAssessments) {
        Object.entries(r.aiAssessments).forEach(([judge, assessments]) => {
          if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
            stats[r.modelName].uniqueJudges.add(judge);
            if (!stats[r.modelName].judgeScoreMap[judge]) {
              stats[r.modelName].judgeScoreMap[judge] = [];
            }
            // Handle both array and single assessment for backward compatibility
            const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
            // Use most recent assessment
            if (assessmentArray.length > 0) {
              stats[r.modelName].judgeScoreMap[judge].push(assessmentArray[assessmentArray.length - 1].score);
            }
          }
        });
      } else if (r.aiAssessment?.evaluatorModel) {
        const judge = r.aiAssessment.evaluatorModel;
        if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
          stats[r.modelName].uniqueJudges.add(judge);
          if (!stats[r.modelName].judgeScoreMap[judge]) {
            stats[r.modelName].judgeScoreMap[judge] = [];
          }
          stats[r.modelName].judgeScoreMap[judge].push(r.aiAssessment.score);
        }
      }
    });

    const mapped = Object.entries(stats).map(([name, s]) => {
      const judgeScores = Object.entries(s.judgeScoreMap).map(([judge, scores]) => ({
        judge,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      })).sort((a, b) => b.score - a.score);
      
      return {
        name,
        avgScore: Math.round(s.totalScore / s.count),
        avgSafety: Math.round(s.safety / s.count),
        avgEmpathy: Math.round(s.empathy / s.count),
        count: s.count,
        expertCount: s.uniqueJudges.size,
        judgeScores
      };
    });

    return mapped.sort((a, b) => {
      let comparison = 0;
      
      switch (leaderboardSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'runs':
          comparison = a.expertCount - b.expertCount;
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
        case 'label':
          const labelA = getModelLabelSortValue(a.name);
          const labelB = getModelLabelSortValue(b.name);
          
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
      }
      
      return leaderboardSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [augmentedResults, leaderboardSortBy, leaderboardSortDirection, selectedJudges]);

  const modelStatsWithRank = useMemo(() => {
    const sortedByScore = [...modelStats].sort((a, b) => {
      const scoreDiff = b.avgScore - a.avgScore;
      if (scoreDiff !== 0) return scoreDiff;
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

  // Calculate missing evaluations
  const missingEvaluations = useMemo(() => {
    const totalQuestions = (questionsData as QuestionNode[]).length;
    
    // Count expert reviews per model
    const expertCounts = modelStatsWithRank.map(stat => stat.expertCount);
    
    // Find the most frequent expert count (mode)
    const countFrequency: Record<number, number> = {};
    expertCounts.forEach(count => {
      countFrequency[count] = (countFrequency[count] || 0) + 1;
    });
    const mostFrequentCount = parseInt(
      Object.entries(countFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '0'
    );
    
    // Find which experts need to review which models (either missing entirely or missing some questions)
    const expertsNeedingReviews: Record<string, string[]> = {};
    const allExperts = selectedJudges.size > 0 ? Array.from(selectedJudges) : availableJudges;
    
    modelStatsWithRank.forEach(stat => {
      const modelRuns = augmentedResults.filter(r => r.modelName === stat.name);
      
      // Count how many questions each expert has reviewed for this model
      const expertQuestionCounts: Record<string, Set<string>> = {};
      
      modelRuns.forEach(run => {
        if (run.aiAssessments) {
          Object.keys(run.aiAssessments).forEach(judge => {
            if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
              if (!expertQuestionCounts[judge]) {
                expertQuestionCounts[judge] = new Set();
              }
              expertQuestionCounts[judge].add(run.questionId);
            }
          });
        } else if (run.aiAssessment?.evaluatorModel) {
          const judge = run.aiAssessment.evaluatorModel;
          if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
            if (!expertQuestionCounts[judge]) {
              expertQuestionCounts[judge] = new Set();
            }
            expertQuestionCounts[judge].add(run.questionId);
          }
        }
      });
      
      // Check each expert to see if they've reviewed all questions for this model
      allExperts.forEach(expert => {
        const questionsReviewed = expertQuestionCounts[expert]?.size || 0;
        if (questionsReviewed < totalQuestions) {
          if (!expertsNeedingReviews[expert]) {
            expertsNeedingReviews[expert] = [];
          }
          expertsNeedingReviews[expert].push(`${stat.name} (${questionsReviewed}/${totalQuestions})`);
        }
      });
    });
    
    // Models missing question responses
    const modelsWithMissingQuestions = modelStatsWithRank
      .filter(stat => stat.count < totalQuestions)
      .map(stat => ({
        name: stat.name,
        answered: stat.count,
        missing: totalQuestions - stat.count
      }));
    
    return {
      expertsNeedingReviews,
      modelsWithMissingQuestions,
      mostFrequentExpertCount: mostFrequentCount,
      totalQuestions
    };
  }, [modelStatsWithRank, questionsData, augmentedResults, selectedJudges, availableJudges]);

  const topPerformer = useMemo(() => {
    return modelStatsWithRank.find(stat => stat.scoreRank === 1);
  }, [modelStatsWithRank]);

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

  const activeQuestion = selectedQuestionId ? (questionsData as QuestionNode[]).find(q => q.id === selectedQuestionId) : null;
  
  const activeQuestionWithOverrides = activeQuestion ? {
    ...activeQuestion,
    ...(questionOverrides[activeQuestion.id]?.title && { title: questionOverrides[activeQuestion.id].title }),
    ...(questionOverrides[activeQuestion.id]?.scenario && { scenario: questionOverrides[activeQuestion.id].scenario }),
    rubric: questionOverrides[activeQuestion.id]?.rubric || rubricOverrides[activeQuestion.id] || activeQuestion.rubric
  } as QuestionNode : null;
  
  const activeRuns = useMemo(() => {
    const runs = augmentedResults.filter(r => r.questionId === selectedQuestionId);
    
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
          comparison = a.effectiveSafety - b.effectiveSafety;
          break;
        case 'empathy':
          comparison = a.effectiveEmpathy - b.effectiveEmpathy;
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

  const handleJudgeSelect = (judge: string) => {
    const newSelected = new Set(selectedJudges);
    if (newSelected.has(judge)) {
      newSelected.delete(judge);
    } else {
      newSelected.add(judge);
    }
    setSelectedJudges(newSelected);
  };

  const handleViewChange = (newView: 'dashboard' | 'questions', questionId: string | null) => {
    setView(newView);
    setSelectedQuestionId(questionId);
    setExpandedRunId(null);
  };

  const handleCloseWelcome = () => {
    setIsWelcomeModalOpen(false);
    localStorage.setItem('therabench_has_seen_welcome', 'true');
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
        onViewChange={handleViewChange}
        onSearchChange={setSearchTerm}
        onCategoryChange={setCategoryFilter}
        onJudgeDropdownToggle={() => setJudgeDropdownOpen(!judgeDropdownOpen)}
        onJudgeSelect={handleJudgeSelect}
        onSelectAllJudges={() => setSelectedJudges(new Set(availableJudges))}
        onClearAllJudges={() => setSelectedJudges(new Set())}
        onExport={() => exportData(resultsData as ModelRun[], overrides, questionsData as QuestionNode[], rubricOverrides, questionOverrides)}
        onClear={() => setIsConfirmModalOpen(true)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
        {view === 'dashboard' ? (
          <Dashboard
            modelStats={modelStatsWithRank}
            topPerformer={topPerformer}
            totalEvaluations={augmentedResults.length}
            reviewsCompleted={Object.keys(overrides).length}
            missingEvaluations={missingEvaluations}
            sortBy={leaderboardSortBy}
            sortDirection={leaderboardSortDirection}
            onSort={handleLeaderboardSort}
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
