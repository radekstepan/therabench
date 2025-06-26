export interface QAPair {
  question: string;
  answer: string;
  span: string;
}

export interface QAPairsFile {
  qa_pairs: QAPair[];
}

export interface EvaluationResult {
  question: string;
  ground_truth_answer: string;
  candidate_answer: string;
  faithfulness: number | null;
  relevancy: number;
  judge_score: number;
}

export interface RunMeta {
  runId: string;
  runType: 'rag' | 'knowledge';
  candidateModel: string;
  startedAt: string;
}

export interface EvaluationFile {
  runMeta: RunMeta;
  results: EvaluationResult[];
}
