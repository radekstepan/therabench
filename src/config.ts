import 'dotenv/config';

function getEnv(key: string,
  defaultValue?: string
): string {
  const value = process.env[key];
  if (value) {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  // When using the Infisical wrapper, the real secret is injected before this code runs.
  // If it's still missing, it means it wasn't set in .env or resolved by Infisical.
  throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file or Infisical project.`);
}

export const cfg = {
  db: {
    path: process.env.DB_PATH ?? 'thera-bench.db',
  },
  expert: {
    base: getEnv('EXPERT_BASE_URL'),
    model: getEnv('EXPERT_MODEL'),
    key: getEnv('EXPERT_API_KEY'),
  },
  candidate: {
    base: getEnv('CANDIDATE_BASE_URL'),
    model: getEnv('CANDIDATE_MODEL'),
  },
  maxParallel: Number(getEnv('MAX_CONCURRENCY', '4')),
};
