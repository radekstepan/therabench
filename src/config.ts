import 'dotenv/config';

/**
 * Gets a required environment variable. Throws an error if it's not set.
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file or Infisical project.`);
  }
  return value;
}

/**
 * Resolves a secret value.
 * It first reads the value of `keyName` from the environment.
 * It then checks if that value is a reference to ANOTHER environment variable.
 * This enables the pattern: `EXPERT_API_KEY=OPENAI_API_KEY` in .env, where
 * Infisical provides the actual value for `OPENAI_API_KEY`.
 *
 * @param keyName The primary key to look up (e.g., 'EXPERT_API_KEY').
 * @returns The resolved secret.
 */
function resolveSecret(keyName: string): string {
  // Get the initial value, which could be the secret itself or a reference name.
  const valueOrReference = getRequiredEnv(keyName);

  // Check if this value corresponds to another environment variable.
  const resolvedValue = process.env[valueOrReference];

  // If `resolvedValue` exists, it means `valueOrReference` was a reference.
  // Otherwise, `valueOrReference` was the literal secret.
  return resolvedValue ?? valueOrReference;
}


export const cfg = {
  db: {
    path: process.env.DB_PATH ?? 'thera-bench.db',
  },
  expert: {
    base: getRequiredEnv('EXPERT_BASE_URL'),
    model: getRequiredEnv('EXPERT_MODEL'),
    key: resolveSecret('EXPERT_API_KEY'),
  },
  candidate: {
    base: getRequiredEnv('CANDIDATE_BASE_URL'),
    model: getRequiredEnv('CANDIDATE_MODEL'),
  },
  maxParallel: Number(process.env.MAX_CONCURRENCY ?? 4),
};
