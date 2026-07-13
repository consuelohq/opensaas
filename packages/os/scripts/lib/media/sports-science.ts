import { Effect } from 'effect';

import { MediaBreakdownPlanSchema } from './schema';

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function overlayType(overlay: JsonObject): string {
  return String(overlay.type ?? overlay.primitive ?? overlay.component ?? '');
}

function hasAvailableRef(ref: unknown, availableRefs: string[]): boolean {
  return typeof ref === 'string' && ref.length > 0 && availableRefs.includes(ref);
}

function hasCoordinateData(overlay: JsonObject, availableRefs: string[]): boolean {
  const data = objectValue(overlay.data);
  const coordinates = objectValue(overlay.coordinates);
  return (
    (Array.isArray(data.start) && Array.isArray(data.end)) ||
    (Array.isArray(coordinates.start) && Array.isArray(coordinates.end)) ||
    hasAvailableRef(overlay.coordinateRef, availableRefs) ||
    hasAvailableRef(data.coordinateRef, availableRefs) ||
    stringArray(overlay.requiredData).some((ref) => availableRefs.includes(ref) && (ref.includes('coordinate') || ref.includes('metric')))
  );
}

function hasPoseData(overlay: JsonObject, availableRefs: string[]): boolean {
  const data = objectValue(overlay.data);
  return (
    hasAvailableRef(overlay.poseTrackRef, availableRefs) ||
    hasAvailableRef(data.poseTrackId, availableRefs) ||
    availableRefs.includes('media.pose-track.v1') ||
    stringArray(overlay.requiredData).some((ref) => ref === 'media.pose-track.v1' && availableRefs.includes(ref))
  );
}

function hasMotionData(overlay: JsonObject, availableRefs: string[]): boolean {
  const data = objectValue(overlay.data);
  return (
    hasAvailableRef(overlay.motionTrackRef, availableRefs) ||
    hasAvailableRef(data.motionTrackId, availableRefs) ||
    availableRefs.includes('media.motion-track.v1') ||
    stringArray(overlay.requiredData).some((ref) => ref === 'media.motion-track.v1' && availableRefs.includes(ref))
  );
}

function assertClaimIsGrounded(claim: JsonObject, index: number, availableRefs: string[]): void {
  const requiredFields = ['timestampSeconds', 'frameRef', 'metricRef', 'provenanceRef'];
  for (const field of requiredFields) {
    if (claim[field] === undefined || claim[field] === null || claim[field] === '') {
      throw new Error('sports-science claim ' + index + ' is missing required data link: ' + field);
    }
  }
  if (typeof claim.metricRef === 'string' && availableRefs.length > 0 && !availableRefs.includes(claim.metricRef)) {
    throw new Error('sports-science claim ' + index + ' references unavailable metricRef: ' + claim.metricRef);
  }
  if (typeof claim.provenanceRef === 'string' && availableRefs.length > 0 && !availableRefs.includes(claim.provenanceRef)) {
    throw new Error('sports-science claim ' + index + ' references unavailable provenanceRef: ' + claim.provenanceRef);
  }
}

export function validateBreakdownPlan(input: unknown): JsonObject {
  return MediaBreakdownPlanSchema.parse(input) as JsonObject;
}

export function assertBreakdownPlanIsDataBacked(plan: unknown, availableRefs: string[]): void {
  const value = objectValue(plan);
  const claims = Array.isArray(value.claims) ? value.claims.map(objectValue) : [];
  const plannedOverlays = Array.isArray(value.plannedOverlays) ? value.plannedOverlays.map(objectValue) : [];

  for (const [index, claim] of claims.entries()) assertClaimIsGrounded(claim, index, availableRefs);

  for (const [index, overlay] of plannedOverlays.entries()) {
    for (const ref of stringArray(overlay.requiredData)) {
      if (!availableRefs.includes(ref)) throw new Error('planned overlay ' + index + ' requires unavailable data source: ' + ref);
    }

    const type = overlayType(overlay);
    if (type === 'force-vector' && !hasCoordinateData(overlay, availableRefs)) {
      throw new Error('force-vector planned overlay requires coordinate data');
    }
    if (type === 'joint-angle' && !hasPoseData(overlay, availableRefs)) {
      throw new Error('joint-angle planned overlay requires pose data');
    }
    if (type === 'velocity-trail' && !hasMotionData(overlay, availableRefs)) {
      throw new Error('velocity-trail planned overlay requires motion-track data');
    }
  }
}

export function buildBreakdownPlan(input: unknown, availableRefs: string[] = []): JsonObject {
  const parsed = validateBreakdownPlan(input);
  assertBreakdownPlanIsDataBacked(parsed, availableRefs);
  return {
    ...parsed,
    dataBacked: true,
    allowsInventedMeasurements: false,
  };
}

export const breakdownPlanEffect = (input: { plan: unknown; availableRefs?: string[] }) => Effect.succeed(buildBreakdownPlan(input.plan, input.availableRefs ?? []));

export function breakdownPlanForCli(input: { plan: unknown; availableRefs?: string[] }) {
  return Effect.map(breakdownPlanEffect(input), (data) => ({ schema: 'media.breakdown-plan.v1', ok: true, data }));
}
