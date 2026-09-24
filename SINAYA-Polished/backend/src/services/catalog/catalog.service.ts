import { and, eq } from "drizzle-orm";
import { equipmentCatalog, languages, regionLanguages, species } from "../../db/schema";
import type { Database } from "../../types/database";
import type { Page } from "../../validators/foundation";

export function catalogService(db: Database) {
  return {
    languages: (p: Page & { regionCode?: string }) => p.regionCode
      ? db.select({ code: languages.code, name: languages.name, nativeName: languages.nativeName, requiresNativeReview: languages.requiresNativeReview, isActive: languages.isActive }).from(languages)
        .innerJoin(regionLanguages, eq(regionLanguages.languageCode, languages.code)).where(and(eq(languages.isActive, true), eq(regionLanguages.regionCode, p.regionCode))).orderBy(languages.code).limit(p.limit).offset(p.offset)
      : db.select().from(languages).where(eq(languages.isActive, true)).orderBy(languages.code).limit(p.limit).offset(p.offset),
    species: (p: Page) => db.select().from(species).where(eq(species.isActive, true)).orderBy(species.id).limit(p.limit).offset(p.offset),
    equipment: (p: Page) => db.select().from(equipmentCatalog).where(eq(equipmentCatalog.isActive, true)).orderBy(equipmentCatalog.id).limit(p.limit).offset(p.offset),
  };
}
