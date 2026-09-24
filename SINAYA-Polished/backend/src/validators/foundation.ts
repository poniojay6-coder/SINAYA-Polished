import { z } from "zod";

export const id = z.uuid();
export const text = z.string().trim().min(1).max(200);
const mobile = z.string().trim().regex(/^\+63\d{10}$/, "Use a Philippine number in +63 followed by 10 digits format.");
const language = z.string().trim().min(1).max(50);
const coordinate = (max: number) => z.number().finite().min(-max).max(max).transform((n) => n.toFixed(6)).nullable().optional();
const location = { region: text, province: text, municipalityCity: text, barangay: text,
  latitude: coordinate(90), longitude: coordinate(180) };
const area = z.number().finite().min(0.01).max(999999999999.99).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.001, "Use at most two decimal places.").transform((n) => n.toFixed(2));
const date = z.iso.date();
function nonempty(value: object) { return Object.keys(value).length > 0; }

export const page = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export type Page = z.output<typeof page>;
export const farmerList = page.extend({ accountStatus: z.enum(["active", "inactive", "suspended"]).optional() }).strict();
export const farmList = page.extend({ operatorId: id.optional() }).strict();
export const pondList = page.extend({ farmId: id.optional() }).strict();
export const cycleList = page.extend({ pondId: id.optional() }).strict();
export const catalogueList = page.extend({ regionCode: text.optional() }).strict();

export const farmerCreate = z.object({ firstName: text, lastName: text, mobileNumber: mobile, ...location,
  preferredLanguageCode: language, smsConsent: z.boolean().optional() }).strict();
export const farmerPatch = farmerCreate.partial().extend({ accountStatus: z.enum(["active", "inactive", "suspended"]).optional() }).strict().refine(nonempty, "Supply at least one field.");
export const farmCreate = z.object({ operatorId: id, name: text, ...location, notifyOperator: z.boolean().optional() }).strict();
export const farmPatch = farmCreate.omit({ operatorId: true }).partial().extend({ isActive: z.boolean().optional() }).strict().refine(nonempty, "Supply at least one field.");
export const contactCreate = z.object({ name: text, mobileNumber: mobile, role: text.optional(),
  preferredLanguageCode: language, receivesAlerts: z.boolean().optional(), smsConsent: z.boolean().optional() }).strict();
export const contactPatch = contactCreate.partial().extend({ isActive: z.boolean().optional() }).strict().refine(nonempty, "Supply at least one field.");
export const pondCreate = z.object({ farmId: id, name: text, areaM2: area,
  waterType: z.enum(["freshwater", "brackish", "marine"]), latitude: coordinate(90), longitude: coordinate(180) }).strict();
export const pondPatch = pondCreate.omit({ farmId: true }).partial().extend({ isActive: z.boolean().optional() }).strict().refine(nonempty, "Supply at least one field.");
export const equipmentCreate = z.object({ equipmentId: id.optional(), customName: text.optional(), quantity: z.number().int().min(1).max(2147483647).default(1) }).strict()
  .refine((v) => Boolean(v.equipmentId) !== Boolean(v.customName), "Supply either equipmentId or customName, not both.");
export const equipmentPatch = z.object({ quantity: z.number().int().min(1).max(2147483647) }).strict();
export const cycleCreate = z.object({ pondId: id, speciesId: id, quantityStocked: z.number().int().min(1).max(2147483647),
  stockingDate: date, expectedHarvestDate: date.nullable().optional() }).strict();
export const cyclePatch = z.object({ expectedHarvestDate: date.nullable().optional(),
  status: z.enum(["harvested", "cancelled"]).optional(), actualHarvestDate: date.optional() }).strict().refine(nonempty, "Supply at least one field.");

export type FarmerCreate = z.output<typeof farmerCreate>;
export type FarmerPatch = z.output<typeof farmerPatch>;
export type FarmCreate = z.output<typeof farmCreate>;
export type FarmPatch = z.output<typeof farmPatch>;
export type ContactCreate = z.output<typeof contactCreate>;
export type ContactPatch = z.output<typeof contactPatch>;
export type PondCreate = z.output<typeof pondCreate>;
export type PondPatch = z.output<typeof pondPatch>;
export type EquipmentCreate = z.output<typeof equipmentCreate>;
export type CycleCreate = z.output<typeof cycleCreate>;
export type CyclePatch = z.output<typeof cyclePatch>;
