import fs from "fs";
import path from "path";

import { z } from "zod";

import { ProfileSchema, type Profile } from "../types/index.js";
import type { ProfileSource } from "./profileSource.js";

const ProfilesArraySchema = z.array(ProfileSchema);

function readProfilesFromDisk(): Profile[] {
  const customProfilesPath = path.resolve(process.cwd(), "profiles.json");
  const exampleProfilesPath = path.resolve(process.cwd(), "profiles.example.json");

  const filePathToRead = fs.existsSync(customProfilesPath)
    ? customProfilesPath
    : exampleProfilesPath;

  if (!fs.existsSync(filePathToRead)) {
    console.warn(`[Profiles] Warning: Neither profiles.json nor profiles.example.json was found.`);
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePathToRead, "utf-8");
    const parsedJson = JSON.parse(fileContent);
    return ProfilesArraySchema.parse(parsedJson);
  } catch (error) {
    console.error(`[Profiles] Error parsing profiles from ${filePathToRead}:`, error);
    return [];
  }
}

/**
 * Legacy file-backed source. Kept as the default until the Postgres source is
 * proven in production (decision 1a).
 */
export function createJsonProfileSource(): ProfileSource {
  return {
    async list(): Promise<Profile[]> {
      return readProfilesFromDisk();
    },

    async getById(id: string): Promise<Profile | undefined> {
      return readProfilesFromDisk().find((profile) => profile.id === id);
    },
  };
}
