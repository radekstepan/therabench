export interface Transcript {
  id: number;
  sha256: string;
  path: string;
  content: string;
}

export interface QAPair {
  id: number;
  transcript_id: number;
  question: string;
  answer: string;
  span: string;
}

export interface Run {
  id: number;
  started_at: string;
  candidate_model: string;
  settings_json: string;
}

export interface Result {
  run_id: number;
  qa_id: number;
  candidate_answer: string;
  faithfulness: number;
  relevancy: number;
  judge_score: number;
}
