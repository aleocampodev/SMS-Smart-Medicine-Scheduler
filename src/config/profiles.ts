import fs from 'fs';
import path from 'path';
import { Profile, ProfileSchema } from '../types/index.js';
import { z } from 'zod';

const ProfilesArraySchema = z.array(ProfileSchema);

export function loadProfiles(): Profile[] {
  const customProfilesPath = path.resolve(process.cwd(), 'profiles.json');
  const exampleProfilesPath = path.resolve(process.cwd(), 'profiles.example.json');

  const filePathToRead = fs.existsSync(customProfilesPath)
    ? customProfilesPath
    : exampleProfilesPath;

  if (!fs.existsSync(filePathToRead)) {
    console.warn(`[Profiles] Warning: Neither profiles.json nor profiles.example.json was found.`);
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePathToRead, 'utf-8');
    const parsedJson = JSON.parse(fileContent);
    return ProfilesArraySchema.parse(parsedJson);
  } catch (error) {
    console.error(`[Profiles] Error parsing profiles from ${filePathToRead}:`, error);
    return [];
  }
}

export function getProfileById(id: string): Profile | undefined {
  const profiles = loadProfiles();
  return profiles.find((p) => p.id === id);
}

/**
 * Masks sensitive national document IDs for logs and public interfaces (G-SEC-02)
 * Example: 1234567890 -> ******7890
 */
export function maskDocument(documentNumber: string): string {
  if (!documentNumber || documentNumber.length <= 4) {
    return '****';
  }
  const visiblePart = documentNumber.slice(-4);
  const maskedPart = '*'.repeat(documentNumber.length - 4);
  return `${maskedPart}${visiblePart}`;
}
