import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createDatabase } from './index';
import { actionEquipment, actionLibrary, actionTranslations, languages, thresholdRules } from './schema';

const label = z.string().trim().min(1).max(200);
const instruction = z.string().trim().min(1).max(350);
const finite = z.number().finite();
const guidance = z.object({
  reviewedBy: label, reviewedAt: z.iso.datetime({ offset: true }).transform(v => new Date(v)).refine(v => v.getTime() <= Date.now(), 'Review timestamp cannot be in the future.'),
  rule: z.object({ speciesId: z.uuid(), waterType: z.enum(['freshwater','brackish','marine']), version: z.number().int().positive(),
    densityMin: finite.min(0), densityMax: finite.min(0), doMin: finite.min(0).max(100), phMin: finite.min(0).max(14), phMax: finite.min(0).max(14),
    temperatureMin: finite.min(-5).max(60), temperatureMax: finite.min(-5).max(60), weatherRainWatchMm: finite.positive(), weatherHeatWatchC: finite.min(-50).max(60), weatherWindWatchKmh: finite.positive(),
  }).strict(),
  actions: z.array(z.object({ riskType: z.enum(['low_oxygen','ph','temperature','weather_watch']), instruction,
    effectiveness: z.number().int().min(0).max(100), priority: z.number().int().default(0), automaticEligible: z.boolean(), equipmentIds: z.array(z.uuid()).max(100).default([]),
    translations: z.array(z.object({ languageCode: label, instruction, reviewedBy: label, nativeSpeakerReviewed: z.boolean() }).strict()).max(50).default([]),
  }).strict()).max(100),
}).strict();

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('Provide a reviewed guidance JSON file path.');
  const input = guidance.parse(JSON.parse(await readFile(path, 'utf8')));
  const connection = createDatabase();
  try {
    await connection.db.transaction(async tx => {
      const [rule] = await tx.insert(thresholdRules).values({ ...input.rule, approvalStatus: 'approved', reviewedBy: input.reviewedBy, reviewedAt: input.reviewedAt }).returning();
      for (const source of input.actions) {
        const { equipmentIds, translations, ...action } = source;
        const [created] = await tx.insert(actionLibrary).values({ ...action, ruleId: rule!.id, approvalStatus: 'approved', reviewedBy: input.reviewedBy, reviewedAt: input.reviewedAt }).returning();
        if (equipmentIds.length) await tx.insert(actionEquipment).values([...new Set(equipmentIds)].map(equipmentId => ({ actionId: created!.id, equipmentId })));
        for (const translation of translations) {
          const language = (await tx.select().from(languages).where(eq(languages.code, translation.languageCode)))[0];
          if (!language || (language.requiresNativeReview && !translation.nativeSpeakerReviewed)) throw new Error('Required native-speaker review missing.');
          await tx.insert(actionTranslations).values({ actionId: created!.id, languageCode: translation.languageCode, instruction: translation.instruction, reviewedBy: translation.reviewedBy, reviewedAt: input.reviewedAt });
        }
      }
    });
    console.log('Reviewed guidance imported transactionally. Existing rule versions were not overwritten.');
  } finally { await connection.close(); }
}
main().catch(() => { console.error('Guidance import failed. Check file validation, review evidence, references, unique version, and database readiness. No partial import is retained.'); process.exitCode = 1; });
