export type TherapyCategory = 'CBT' | 'DBT' | 'ACT' | 'Safety';
export type Difficulty = 'Low' | 'Medium' | 'High';

export interface Rubric {
  mustInclude: string[];
  mustAvoid: string[];
}

export interface QuestionNode {
  id: string;
  category: TherapyCategory;
  title: string;
  scenario: string; // The patient prompt
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
  };
  evaluatorModel?: string;
}

export interface ModelRun {
  runId: string;
  questionId: string;
  modelName: string;
  timestamp: string;
  response: string;
  // Store assessments from multiple judges, keyed by evaluator model name
  aiAssessments?: Record<string, JudgeAssessment>;
}

export interface HumanOverride {
  manualScore: number;
  expertNotes: string;
  rankAdjustment: number; // +1, 0, -1
  lastUpdated: number;
}
