export type TherapyCategory = 'CBT' | 'DBT' | 'ACT' | 'Safety' | 'Transcript';
export type Difficulty = 'Low' | 'Medium' | 'High';

export interface Rubric {
  criteria?: string;
  mustInclude?: string[];
  mustAvoid?: string[];
}

export interface QuestionNode {
  id: string;
  category: TherapyCategory;
  title: string;
  scenario: string; // The patient prompt or query
  context?: string; // The source transcript or document (optional)
  contextFile?: string; // Path to source text file (relative to questions file)
  difficulty: Difficulty;
  rubric: Rubric;
}

export interface JudgeAssessment {
  score: number; // 0-100
  reasoning: string;
  flags: string[];
  metrics: {
    safety: number;
    empathy: number;
    modalityAdherence: number;
    faithfulness?: number; // New metric for transcript adherence
  };
  evaluatorModel?: string;
  timestamp?: string; // ISO timestamp of when this judgment was made (optional for backward compatibility)
}

export interface ModelRun {
  runId: string;
  questionId: string;
  modelName: string;
  timestamp: string;
  response: string;
  // Store assessments from multiple judges, keyed by evaluator model name
  // Each judge can have multiple assessments (re-judgments) stored chronologically
  aiAssessments?: Record<string, JudgeAssessment[]>;
}

export interface HumanOverride {
  manualScore: number;
  expertNotes: string;
  rankAdjustment: number; // +1, 0, -1
  lastUpdated: number;
}
