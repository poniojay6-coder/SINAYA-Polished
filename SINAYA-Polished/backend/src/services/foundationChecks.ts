import { eq } from "drizzle-orm";
import { languages, farmers, farms, ponds } from "../db/schema";
import type { Database } from "../types/database";
import { HttpError, required } from "../utils/httpError";

export function coordinates(value: { latitude?: string | null; longitude?: string | null }) {
  if ((value.latitude == null) !== (value.longitude == null)) {
    throw new HttpError(422, "COORDINATE_PAIR_REQUIRED", "Supply or clear latitude and longitude together.");
  }
}
export function active(value: boolean, label: string) {
  if (!value) throw new HttpError(409, "INACTIVE_RECORD", `${label} is inactive.`);
}
export async function requireLanguage(db: Database, code: string) {
  const row = required((await db.select().from(languages).where(eq(languages.code, code)))[0], "Language");
  active(row.isActive, "Language");
}
export async function requireOperator(db: Database, id: string) {
  const row = required((await db.select().from(farmers).where(eq(farmers.id, id)))[0], "Operator");
  active(row.accountStatus === "active", "Operator");
  return row;
}
export async function requireFarm(db: Database, id: string) {
  const row = required((await db.select().from(farms).where(eq(farms.id, id)))[0], "Farm");
  active(row.isActive, "Farm");
  await requireOperator(db, row.operatorId);
  return row;
}
export async function requirePond(db: Database, id: string) {
  const row = required((await db.select().from(ponds).where(eq(ponds.id, id)))[0], "Pond");
  active(row.isActive, "Pond");
  await requireFarm(db, row.farmId);
  return row;
}
