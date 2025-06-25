import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { dbOps } from './db.js';

export async function loadTranscripts(folderPath: string): Promise<number> {
  let newFilesCount = 0;
  try {
    const files = await fs.readdir(folderPath);
    const txtFiles = files.filter(file => file.endsWith('.txt'));

    if (txtFiles.length === 0) {
      console.warn(`Warning: No .txt files found in "${folderPath}"`);
      return 0;
    }

    for (const file of txtFiles) {
      const fullPath = path.join(folderPath, file);
      const content = await fs.readFile(fullPath, 'utf-8');

      if (!content.trim()) {
        console.warn(`Skipping empty file: ${file}`);
        continue;
      }
      
      const sha256 = crypto.createHash('sha256').update(content).digest('hex');

      const result = dbOps.insertTranscript({ sha256, path: fullPath, content });
      if (result.changes > 0) {
        newFilesCount++;
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Directory not found: ${folderPath}`);
    }
    throw error;
  }
  return newFilesCount;
}
