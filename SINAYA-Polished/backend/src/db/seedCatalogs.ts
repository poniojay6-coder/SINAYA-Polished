import { createDatabase } from './index';
import { seedCatalogs } from './seed/catalogs';
async function main() {
  const connection = createDatabase();
  try { await seedCatalogs(connection.db); console.log('Catalogues seeded. No safety rules or actions were approved.'); }
  finally { await connection.close(); }
}
main().catch(() => { console.error('Catalogue seeding failed. Check database configuration and migrations.'); process.exitCode = 1; });
