import type { Database } from '../../types/database';
import { equipmentCatalog, languages, species } from '../schema';

export async function seedCatalogs(db: Database) {
  await db.transaction(async tx => {
    await tx.insert(languages).values([
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'fil', name: 'Filipino / Tagalog', nativeName: 'Filipino / Tagalog' },
      { code: 'ceb', name: 'Cebuano / Bisaya', nativeName: 'Cebuano / Bisaya', requiresNativeReview: true },
    ]).onConflictDoNothing();
    await tx.insert(species).values(['Tilapia', 'Bangus', 'Shrimp'].map(name => ({ name }))).onConflictDoNothing();
    await tx.insert(equipmentCatalog).values(['Paddlewheel Aerator', 'Air Pump', 'Water Pump', 'Generator', 'DO Meter', 'pH Meter', 'Thermometer', 'Water Test Kit', 'Net', 'Seine Net', 'Feeding Equipment', 'Backup Power Source', 'Siphon Equipment', 'Drainage Equipment'].map(name => ({ name }))).onConflictDoNothing();
  });
}
