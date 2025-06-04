/**
 * Key storage service for storing and retrieving keys
 * This implementation uses both in-memory storage and file-based persistence
 * to ensure keys are available across application restarts
 */

import fs from 'fs';
import path from 'path';

// In-memory cache for faster access
const keyStore: Record<string, any> = {};

// Directories for storing persistent data
const DATA_DIR = path.join(process.cwd(), 'data');
const KEYS_DIR = path.join(DATA_DIR, 'keys');

// Ensure the directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
}

/**
 * Store a key directly to the file system without encryption
 * @param keyId The ID of the key
 * @param keyData The key data to store
 */
export async function storeKey(keyId: string, keyData: any): Promise<void> {
  try {
    // Store in memory
    keyStore[keyId] = keyData;

    // Store to file system
    const filePath = path.join(KEYS_DIR, `${keyId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(keyData, null, 2));
    console.log(`Key stored successfully: ${keyId}`);
  } catch (error) {
    console.error(`Error storing key ${keyId}:`, error);
    throw new Error(`Failed to store key: ${error}`);
  }
}

/**
 * Retrieve a key directly from the file system
 * @param keyId The ID of the key to retrieve
 * @returns The key data, or null if not found
 */
export async function retrieveKey(keyId: string): Promise<any> {
  // Check memory first
  if (keyStore[keyId]) {
    return keyStore[keyId];
  }

  try {
    const filePath = path.join(KEYS_DIR, `${keyId}.json`);
    if (fs.existsSync(filePath)) {
      const keyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Cache in memory
      keyStore[keyId] = keyData;

      console.log(`Key retrieved successfully: ${keyId}`);
      return keyData;
    }
  } catch (error) {
    console.error(`Error retrieving key ${keyId}:`, error);
  }

  return null;
}
