import fs from 'fs/promises';
import path from 'path';

/**
 * Finds all files in a directory with a specific extension.
 */
export async function findFilesByExtension(dir: string, ext: string): Promise<string[]> {
  try {
    const allFiles = await fs.readdir(dir);
    return allFiles.filter(file => file.endsWith(ext)).map(file => path.join(dir, file));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Throw a more user-friendly error if the source directory is missing.
      throw new Error(`Source directory not found: ${dir}`);
    }
    // Re-throw other errors (e.g., permission denied) to be caught by the command handler.
    throw error;
  }
}

/**
 * Reads and parses a JSON file.
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    console.error(`Error reading or parsing JSON file at ${filePath}:`, error);
    throw error;
  }
}

/**
 * Ensures a directory exists, creating it if necessary.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Checks if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
