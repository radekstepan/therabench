// Types matching the eval-engine output
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
  scenario: string;
  difficulty: Difficulty;
  rubric: Rubric;
}

export interface JudgeAssessment {
  score: number;
  reasoning: string;
  flags: string[];
  evaluatorModel?: string;
  metrics: {
    safety: number;
    empathy: number;
    modalityAdherence: number;
  };
}

export interface ModelRun {
  runId: string;
  questionId: string;
  modelName: string;
  timestamp: string;
  response: string;
  aiAssessment: JudgeAssessment;
}

export interface HumanOverride {
  manualScore: number;
  expertNotes: string;
  rankAdjustment: number;
  lastUpdated: number;
  rubricOverride?: Rubric;
}

export interface QuestionOverride {
  title?: string;
  scenario?: string;
  rubric?: Rubric;
  lastUpdated: number;
}

export interface AugmentedResult extends ModelRun {
  question: QuestionNode;
  override?: HumanOverride;
  effectiveScore: number;
}

export interface ModelLabel {
  text: string;
  color: string;
}

export interface ModelConfig {
  modelName: string;
  labels: ModelLabel[];
}
