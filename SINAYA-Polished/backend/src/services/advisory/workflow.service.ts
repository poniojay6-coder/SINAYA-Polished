import { and, desc, eq, inArray } from 'drizzle-orm';
import { actionEquipment, actionLibrary, actionTranslations, advisories, assessments, farmContacts, farmerEquipment, farmers, farms, languages, smsDeliveries, stockingCycles, thresholdRules } from '../../db/schema';
import type { Database } from '../../types/database';
import type { WeatherProvider } from '../weather/openMeteo.provider';
import { weatherService } from '../weather/weather.service';
import { sensorService, STALE_AFTER_SECONDS } from '../sensor/sensor.service';
import { requirePond } from '../foundationChecks';
import { HttpError, required } from '../../utils/httpError';
import type { Page } from '../../validators/foundation';
import { draftLocalizer, type Localizer } from '../ai/localization.service';

type Source = 'device' | 'simulated';
type Action = typeof actionLibrary.$inferSelect;
type EvaluationSnapshot = {
  sensor: Awaited<ReturnType<ReturnType<typeof sensorService>['latest']>>;
  weather: unknown; cycle: typeof stockingCycles.$inferSelect; rule: typeof thresholdRules.$inferSelect | null;
  risks: string[]; selectedActions: Action[]; candidates: Array<Action & { feasible: boolean }>;
  availableEquipmentIds: string[];
};

export function workflowService(db: Database, provider: WeatherProvider, localizer: Localizer = draftLocalizer) {
  const weather = weatherService(db, provider);
  const sensors = sensorService(db);
  const get = async (pondId: string, assessmentId: string) => required((await db.select().from(assessments).where(and(eq(assessments.id, assessmentId), eq(assessments.pondId, pondId))))[0], 'Assessment');
  return {
    get,
    list: (pondId: string, p: Page) => db.select().from(assessments).where(eq(assessments.pondId, pondId)).orderBy(desc(assessments.createdAt), assessments.id).limit(p.limit).offset(p.offset),
    async evaluate(pondId: string, cycleId: string, source: Source, availableEquipmentIds: string[]) {
      const pond = await requirePond(db, pondId);
      const cycle = required((await db.select().from(stockingCycles).where(and(eq(stockingCycles.id, cycleId), eq(stockingCycles.pondId, pondId))))[0], 'Stocking cycle');
      if (cycle.status !== 'active') throw new HttpError(409, 'CYCLE_CLOSED', 'Assess an active stocking cycle.');
      const farm = required((await db.select().from(farms).where(eq(farms.id, pond.farmId)))[0], 'Farm');
      const owned = await db.select().from(farmerEquipment).where(eq(farmerEquipment.farmerId, farm.operatorId));
      if (availableEquipmentIds.some(id => !owned.some(item => item.equipmentId === id && item.quantity > 0))) throw new HttpError(422, 'EQUIPMENT_NOT_OWNED', 'Available equipment must be in the operator inventory.');
      const sensor = await sensors.latest(pondId, source);
      let forecast: Awaited<ReturnType<typeof weather.forPond>> | null = null;
      try { forecast = await weather.forPond(pondId); } catch (error) {
        if (!(error instanceof HttpError && error.code === 'POND_COORDINATES_REQUIRED')) throw error;
      }
      const rules = await db.select().from(thresholdRules).where(and(eq(thresholdRules.speciesId, cycle.speciesId), eq(thresholdRules.waterType, pond.waterType), eq(thresholdRules.approvalStatus, 'approved'))).orderBy(desc(thresholdRules.version));
      const density = Number(cycle.stockingDensityPerM2);
      const rule = rules.find(r => density >= r.densityMin && density <= r.densityMax) ?? null;
      const reasons: string[] = [];
      const risks: string[] = [];
      let status = 'review_required', confidence = 'unavailable';
      const reading = sensor.reading;
      if (sensor.status !== 'fresh' || !reading) {
        status = 'data_unavailable'; reasons.push(`Sensor data: ${sensor.status}. No current threshold conclusion.`);
      } else if (!rule) {
        reasons.push('No approved rule matches this species, water type, and density.');
      } else {
        if (reading.dissolvedOxygenMgL < rule.doMin) risks.push('low_oxygen');
        if (reading.ph < rule.phMin || reading.ph > rule.phMax) risks.push('ph');
        if (reading.waterTemperatureC < rule.temperatureMin || reading.waterTemperatureC > rule.temperatureMax) risks.push('temperature');
        const summary = forecast?.status === 'available' ? forecast.forecast?.next48Hours : undefined;
        const elevated = !!summary && ((summary.rainTotalMm.value ?? -Infinity) >= rule.weatherRainWatchMm || (summary.airTemperatureMaxC.value ?? -Infinity) >= rule.weatherHeatWatchC || (summary.windGustMaxKmh.value ?? -Infinity) >= rule.weatherWindWatchKmh);
        const complete = !!summary && summary.availableSamples === 48 && summary.rainTotalMm.samples === 48 && summary.airTemperatureMaxC.samples === 48 && summary.windGustMaxKmh.samples === 48;
        status = risks.length ? 'warning' : elevated ? 'watch' : 'within_reviewed_ranges';
        confidence = risks.length ? (elevated && complete ? 'high' : 'standard') : complete ? 'standard' : 'limited';
        if (!risks.length && elevated) risks.push('weather_watch');
        reasons.push(risks.length ? `Reviewed rule ${rule.id} v${rule.version}: ${risks.join(', ')}.` : 'Current readings are within the reviewed ranges; this is not a prediction or guarantee.');
        reasons.push(elevated ? 'Weather exceeds a reviewed watch threshold.' : 'Weather does not corroborate a watch signal or is incomplete/unavailable.');
      }
      if (!forecast || forecast.status !== 'available') reasons.push(`Weather: ${forecast?.status ?? 'coordinates_missing'}.`);
      const candidates: EvaluationSnapshot['candidates'] = [];
      const selectedActions: Action[] = [];
      if (rule && risks.length) {
        const actions = await db.select().from(actionLibrary).where(and(eq(actionLibrary.ruleId, rule.id), eq(actionLibrary.approvalStatus, 'approved'), eq(actionLibrary.automaticEligible, true), inArray(actionLibrary.riskType, risks))).orderBy(desc(actionLibrary.effectiveness), desc(actionLibrary.priority), actionLibrary.id);
        for (const action of actions) {
          const equipment = await db.select().from(actionEquipment).where(eq(actionEquipment.actionId, action.id));
          candidates.push({ ...action, feasible: !equipment.length || equipment.some(e => availableEquipmentIds.includes(e.equipmentId)) });
        }
        for (const risk of risks) {
          const selected = candidates.find(a => a.riskType === risk && a.feasible);
          if (selected) selectedActions.push(selected);
          else reasons.push(`No approved, feasible automatic action for ${risk}.`);
        }
      }
      const snapshot: EvaluationSnapshot = { sensor, weather: forecast, cycle, rule, risks, selectedActions, candidates, availableEquipmentIds };
      return (await db.insert(assessments).values({ pondId, cycleId, source, status, confidence, reasons, snapshot }).returning())[0]!;
    },
    async createAdvisory(pondId: string, assessmentId: string, languageCode: string) {
      const assessment = await get(pondId, assessmentId);
      const language = required((await db.select().from(languages).where(eq(languages.code, languageCode)))[0], 'Language');
      if (!language.isActive) throw new HttpError(409, 'LANGUAGE_INACTIVE', 'Language is inactive.');
      const previous = (await db.select().from(advisories).where(and(eq(advisories.assessmentId, assessmentId), eq(advisories.languageCode, languageCode))))[0];
      if (previous) return previous;
      const snapshot = assessment.snapshot as unknown as EvaluationSnapshot;
      let status = assessment.status === 'within_reviewed_ranges' ? 'no_alert' : 'review_required';
      const instructions: string[] = [];
      if (['warning', 'watch'].includes(assessment.status) && snapshot.risks.length && snapshot.selectedActions.length === snapshot.risks.length) {
        for (const action of snapshot.selectedActions) {
          if (languageCode === 'en' && !language.requiresNativeReview) instructions.push(action.instruction);
          else {
            const translation = (await db.select().from(actionTranslations).where(and(eq(actionTranslations.actionId, action.id), eq(actionTranslations.languageCode, languageCode))))[0];
            if (translation?.reviewedAt && translation.reviewedBy?.trim()) instructions.push(translation.instruction);
          }
        }
        if (instructions.length === snapshot.selectedActions.length) status = 'ready';
      }
      const reading = snapshot.sensor.reading;
      const message = reading ? `SINAYA${assessment.source === 'simulated' ? ' [SIMULATED DATA]' : ''}\nDO: ${reading.dissolvedOxygenMgL} mg/L\npH: ${reading.ph}\nTemp: ${reading.waterTemperatureC}°C\n${instructions.join('\n')}` : '';
      if (!message || message.length > 480 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(message)) status = 'review_required';
      const inserted = await db.insert(advisories).values({ assessmentId, languageCode, status, actionIds: snapshot.selectedActions.map(a => a.id), finalText: status === 'ready' ? message : null }).onConflictDoNothing().returning();
      return inserted[0] ?? required((await db.select().from(advisories).where(and(eq(advisories.assessmentId, assessmentId), eq(advisories.languageCode, languageCode))))[0], 'Advisory');
    },
    async advisories(pondId: string, assessmentId: string) {
      await get(pondId, assessmentId);
      return db.select().from(advisories).where(eq(advisories.assessmentId, assessmentId)).orderBy(advisories.id);
    },
    async draft(pondId: string, assessmentId: string, advisoryId: string) {
      const assessment = await get(pondId, assessmentId);
      const advisory = required((await db.select().from(advisories).where(and(eq(advisories.id, advisoryId), eq(advisories.assessmentId, assessmentId))))[0], 'Advisory');
      const snapshot = assessment.snapshot as unknown as EvaluationSnapshot;
      if (!snapshot.selectedActions.length) throw new HttpError(409, 'REVIEW_REQUIRED', 'Approved source instructions are required before drafting a translation.');
      const language = required((await db.select().from(languages).where(eq(languages.code, advisory.languageCode)))[0], 'Language');
      let generatedText: string | null = null;
      try {
        const result = (await localizer.translate(snapshot.selectedActions.map(a => a.instruction), language.name)).trim();
        if (result && result.length <= 1000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) generatedText = result;
      } catch { /* Provider errors must not leak credentials or block approved wording. */ }
      return (await db.update(advisories).set({ generatedText, generationStatus: generatedText ? 'draft' : 'unavailable', generatedAt: new Date() }).where(eq(advisories.id, advisoryId)).returning())[0]!;
    },
    async simulate(pondId: string, assessmentId: string, advisoryId: string) {
      // Network-free simulator only. Never instantiate an SMS/voice provider here.
      return db.transaction(async tx => {
        const assessment = required((await tx.select().from(assessments).where(and(eq(assessments.id, assessmentId), eq(assessments.pondId, pondId))))[0], 'Assessment');
        const advisory = required((await tx.select().from(advisories).where(and(eq(advisories.id, advisoryId), eq(advisories.assessmentId, assessmentId))).for('update'))[0], 'Advisory');
        if (advisory.status !== 'ready' || !advisory.finalText) throw new HttpError(409, 'REVIEW_REQUIRED', 'Only a validated advisory can be simulated.');
        const snapshot = assessment.snapshot as unknown as EvaluationSnapshot;
        if (!snapshot.sensor.reading || Date.now() - new Date(snapshot.sensor.reading.observedAt).getTime() >= STALE_AFTER_SECONDS * 1000) throw new HttpError(409, 'ASSESSMENT_STALE', 'Create a new assessment from fresh readings.');
        const latest = await sensorService(tx).latest(pondId, assessment.source as Source);
        if (latest.status !== 'fresh' || latest.reading?.id !== snapshot.sensor.reading.id) throw new HttpError(409, 'ASSESSMENT_SUPERSEDED', 'Sensor data changed; create a new assessment.');
        const cycle = required((await tx.select().from(stockingCycles).where(eq(stockingCycles.id, assessment.cycleId)))[0], 'Stocking cycle');
        if (cycle.status !== 'active') throw new HttpError(409, 'CYCLE_CLOSED', 'The assessed stocking cycle is closed.');
        const rule = snapshot.rule && (await tx.select().from(thresholdRules).where(eq(thresholdRules.id, snapshot.rule.id)))[0];
        if (!rule || rule.approvalStatus !== 'approved') throw new HttpError(409, 'REVIEW_REQUIRED', 'The assessment rule is no longer approved.');
        for (const key of ['version','doMin','phMin','phMax','temperatureMin','temperatureMax','densityMin','densityMax','weatherRainWatchMm','weatherHeatWatchC','weatherWindWatchKmh'] as const) {
          if (rule[key] !== snapshot.rule![key]) throw new HttpError(409, 'REVIEW_REQUIRED', 'The reviewed rule changed; create a new assessment.');
        }
        const language = required((await tx.select().from(languages).where(eq(languages.code, advisory.languageCode)))[0], 'Language');
        if (!language.isActive) throw new HttpError(409, 'LANGUAGE_INACTIVE', 'Language is inactive.');
        const instructions: string[] = [];
        for (const chosen of snapshot.selectedActions) {
          const current = (await tx.select().from(actionLibrary).where(eq(actionLibrary.id, chosen.id)))[0];
          if (!current || current.approvalStatus !== 'approved' || !current.automaticEligible || current.instruction !== chosen.instruction) throw new HttpError(409, 'REVIEW_REQUIRED', 'An action changed or is no longer approved.');
          if (advisory.languageCode === 'en' && !language.requiresNativeReview) instructions.push(current.instruction);
          else {
            const translation = (await tx.select().from(actionTranslations).where(and(eq(actionTranslations.actionId, current.id), eq(actionTranslations.languageCode, advisory.languageCode))))[0];
            if (!translation?.reviewedAt || !translation.reviewedBy?.trim()) throw new HttpError(409, 'REVIEW_REQUIRED', 'Translation requires review.');
            instructions.push(translation.instruction);
          }
        }
        const reading = snapshot.sensor.reading;
        const validatedText = `SINAYA${assessment.source === 'simulated' ? ' [SIMULATED DATA]' : ''}\nDO: ${reading.dissolvedOxygenMgL} mg/L\npH: ${reading.ph}\nTemp: ${reading.waterTemperatureC}°C\n${instructions.join('\n')}`;
        if (validatedText !== advisory.finalText) throw new HttpError(409, 'REVIEW_REQUIRED', 'Reviewed wording changed; create a new assessment and advisory.');
        const pond = await requirePond(tx, pondId);
        if (rule.speciesId !== cycle.speciesId || rule.waterType !== pond.waterType || Number(cycle.stockingDensityPerM2) < rule.densityMin || Number(cycle.stockingDensityPerM2) > rule.densityMax) throw new HttpError(409, 'ASSESSMENT_SUPERSEDED', 'Pond or stocking context changed; create a new assessment.');
        const farm = required((await tx.select().from(farms).where(eq(farms.id, pond.farmId)))[0], 'Farm');
        const operator = required((await tx.select().from(farmers).where(eq(farmers.id, farm.operatorId)))[0], 'Operator');
        const owned = await tx.select().from(farmerEquipment).where(eq(farmerEquipment.farmerId, operator.id));
        for (const chosen of snapshot.selectedActions) {
          const requirements = await tx.select().from(actionEquipment).where(eq(actionEquipment.actionId, chosen.id));
          if (requirements.length && !requirements.some(r => snapshot.availableEquipmentIds.includes(r.equipmentId) && owned.some(e => e.equipmentId === r.equipmentId && e.quantity > 0))) throw new HttpError(409, 'EQUIPMENT_UNAVAILABLE', 'Equipment eligibility changed; create a new assessment.');
        }
        const contacts = await tx.select().from(farmContacts).where(eq(farmContacts.farmId, farm.id));
        const recipients = [
          ...(farm.notifyOperator && operator.smsConsent && operator.preferredLanguageCode === advisory.languageCode ? [{ id: `operator:${operator.id}`, phone: operator.mobileNumber }] : []),
          ...contacts.filter(c => c.isActive && c.receivesAlerts && c.smsConsent && c.preferredLanguageCode === advisory.languageCode).map(c => ({ id: `contact:${c.id}`, phone: c.mobileNumber })),
        ];
        const seen = new Set<string>();
        for (const recipient of recipients) {
          if (seen.has(recipient.phone)) continue;
          seen.add(recipient.phone);
          await tx.insert(smsDeliveries).values({ advisoryId, recipientKey: recipient.id, maskedPhone: `${recipient.phone.slice(0,3)}******${recipient.phone.slice(-3)}`, message: advisory.finalText }).onConflictDoNothing();
        }
        return { simulated: true, eligibleRecipients: seen.size, deliveries: await tx.select().from(smsDeliveries).where(eq(smsDeliveries.advisoryId, advisoryId)) };
      });
    },
  };
}
