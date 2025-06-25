import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cfg } from './config.js';
import type { Transcript, QAPair, Run, Result } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const db = new Database(cfg.db.path);

function initializeDatabase() {
  const schemaPath = path.join(__dirname, '../migrations/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('Database initialized.');
}

// Check if tables exist and initialize if they don't
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transcripts'").get();
if (!tableCheck) {
  initializeDatabase();
}

// Prepared statements for performance
const insertTranscriptStmt = db.prepare<[string, string, string]>(
  'INSERT OR IGNORE INTO transcripts (sha256, path, content) VALUES (?, ?, ?)'
);
const getUnlabeledTranscriptsStmt = db.prepare<[]>(`
  SELECT t.* FROM transcripts t
  LEFT JOIN qa_pairs q ON t.id = q.transcript_id
  WHERE q.id IS NULL
`);
const insertQAPairStmt = db.prepare<[number, string, string, string]>(
  'INSERT INTO qa_pairs (transcript_id, question, answer, span) VALUES (?, ?, ?, ?)'
);
const getAllQAPairsWithContextStmt = db.prepare<[]>(`
  SELECT q.id as qa_id, q.question, q.answer as ground_truth_answer, t.content as context
  FROM qa_pairs q
  JOIN transcripts t ON q.transcript_id = t.id
`);
const createRunStmt = db.prepare<[string, string]>(
  'INSERT INTO runs (candidate_model, settings_json) VALUES (?, ?)'
);
const insertResultStmt = db.prepare<[number, number, string, number, number, number]>(
  `INSERT INTO results (run_id, qa_id, candidate_answer, faithfulness, relevancy, judge_score)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const getRunInfoStmt = db.prepare<[number]>(
  'SELECT id, started_at, candidate_model FROM runs WHERE id = ?'
);
const getLatestRunIdStmt = db.prepare<[]>(
  'SELECT id FROM runs ORDER BY id DESC LIMIT 1'
);
const getRunResultsStmt = db.prepare<[number]>(
  'SELECT faithfulness, relevancy, judge_score FROM results WHERE run_id = ?'
);

// Transaction-wrapped functions for safety and performance
export const dbOps = {
  insertTranscript: (params: Omit<Transcript, 'id'>) => {
    return insertTranscriptStmt.run(params.sha256, params.path, params.content);
  },
  getUnlabeledTranscripts: (): Transcript[] => {
    return getUnlabeledTranscriptsStmt.all() as Transcript[];
  },
  insertQAPairs: db.transaction((pairs: Omit<QAPair, 'id'>[]) => {
    for (const pair of pairs) {
      insertQAPairStmt.run(pair.transcript_id, pair.question, pair.answer, pair.span);
    }
  }),
  getAllQAPairsWithContext: (): { qa_id: number; question: string; ground_truth_answer: string; context: string }[] => {
    return getAllQAPairsWithContextStmt.all() as any[];
  },
  createRun: (model: string, settings: object): number => {
    const info = createRunStmt.run(model, JSON.stringify(settings));
    return Number(info.lastInsertRowid);
  },
  insertResult: (result: Omit<Result, 'id'>) => {
    return insertResultStmt.run(
      result.run_id,
      result.qa_id,
      result.candidate_answer,
      result.faithfulness,
      result.relevancy,
      result.judge_score
    );
  },
  getRunInfo: (runId: number): Run | undefined => {
    return getRunInfoStmt.get(runId) as Run | undefined;
  },
  getLatestRunId: (): number | undefined => {
    const result = getLatestRunIdStmt.get() as { id: number } | undefined;
    return result?.id;
  },
  getRunResults: (runId: number) => {
    return getRunResultsStmt.all(runId) as Pick<Result, 'faithfulness' | 'relevancy' | 'judge_score'>[];
  },
};
