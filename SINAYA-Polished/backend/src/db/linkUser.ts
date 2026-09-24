import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createDatabase } from './index';
import { farmers } from './schema';

async function main() {
  const operatorId = z.uuid().parse(process.argv[2]);
  const authUserId = z.uuid().parse(process.argv[3]);
  const connection = createDatabase();
  try {
    const rows = await connection.db.update(farmers).set({ authUserId }).where(and(eq(farmers.id, operatorId), isNull(farmers.authUserId))).returning({ id: farmers.id });
    if (!rows.length) throw new Error('Operator missing or already linked.');
    console.log('Existing operator linked. Verify the user ID against Supabase Auth before granting access.');
  } finally { await connection.close(); }
}
main().catch(() => { console.error('User link failed. Supply operator UUID and verified Supabase Auth user UUID; existing links cannot be overwritten.'); process.exitCode = 1; });
