export interface BranchInfo {
  branchId: string;
  lineId: string;
  name: string;
}

export const BRANCH_MAP: Record<string, BranchInfo> = {
  '118': {
    branchId: 'P44gWuLwrWvKAMd7YrHF',
    lineId: 'G26hsHGJQWHLWsSUghdK',
    name: 'MEDELLÍN - ANTIOQUIA - NUEVA EPS - PROMEDAN CR 49 #44 99 LOCAL 118',
  },
  '6035': {
    branchId: 'ZOLH5f1ydz6XQxFvpL0e',
    lineId: '49P4qDGm7i87QLeyjG25',
    name: 'MEDELLIN – ANTIOQUIA – NUEVA EPS CR 46 #47 66 LOCAL 6035',
  },
};

export interface ResolveBranchResult {
  targetBranchId: string;
  targetLineId: string;
  branchMapping?: BranchInfo;
  isRealQanty: boolean;
}

export function resolveBranch(requestedBranch: string, endpoint: string): ResolveBranchResult {
  const branchMapping = BRANCH_MAP[requestedBranch];
  const isRealQanty = endpoint.includes('qanty.com');
  const targetBranchId = isRealQanty && branchMapping ? branchMapping.branchId : requestedBranch;
  const targetLineId = branchMapping?.lineId || 'G26hsHGJQWHLWsSUghdK';

  return {
    targetBranchId,
    targetLineId,
    branchMapping,
    isRealQanty,
  };
}

export function tomorrowLocalDay(now: Date = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface BuildDayPayloadOptions {
  companyId: string;
  branchKey: string;
  endpoint: string;
  lineId?: string;
  serviceId?: string | number;
  day: string;
  endDate?: string;
  sessionId: string;
  customPayload?: Record<string, any>;
}

export function buildDayPayload(options: BuildDayPayloadOptions): Record<string, any> {
  const { targetBranchId, targetLineId, isRealQanty } = resolveBranch(options.branchKey, options.endpoint);

  const payload: Record<string, any> = {
    company_id: options.companyId,
    branch_id: targetBranchId,
    line_id: options.lineId || targetLineId,
    service_id: options.serviceId || '1',
    start_date: options.day,
    end_date: options.endDate,
    day: options.day,
    session: options.sessionId,
    origin: 'appointments',
    ...options.customPayload,
  };

  // Ensure backwards-compatibility for mock endpoints expecting literal branch key
  if (!isRealQanty) {
    payload.branch_id = options.branchKey;
  }

  return payload;
}
