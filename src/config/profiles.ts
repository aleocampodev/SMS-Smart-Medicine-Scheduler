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
    console.warn(`[Profiles] Advertencia: No se encontró profiles.json ni profiles.example.json`);
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePathToRead, 'utf-8');
    const parsedJson = JSON.parse(fileContent);
    return ProfilesArraySchema.parse(parsedJson);
  } catch (error) {
    console.error(`[Profiles] Error al parsear perfiles desde ${filePathToRead}:`, error);
    return [];
  }
}

export function getProfileById(id: string): Profile | undefined {
  const profiles = loadProfiles();
  return profiles.find((p) => p.id === id);
}
