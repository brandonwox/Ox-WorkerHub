import { addDays, format, set, subDays } from 'date-fns';

import {
  Crew,
  DailyCrew,
  Job,
  WorkRequest,
  ScheduleAssignment,
  TimesheetLog,
  TimesheetSendStatus,
  Worker,
} from '@/types';

/** The installer who owns the seeded jobs/logs (the default native session). */
export const PRIMARY_INSTALLER_ID = 'w-i1';

/** The Developer — the only identity allowed to use the "View as" switcher. */
export const DEVELOPER_ID = 'w-dev';

/**
 * Seed roster covering every role (two installers so the dev can switch between
 * them, plus one of each other role) so every interface is previewable via the
 * dev "View as" switcher. Replaced by the Supabase `workers` table once the
 * backend is wired.
 */
export const mockWorkers: Worker[] = [
  {
    id: DEVELOPER_ID,
    name: 'Developer',
    email: 'dev@ox-glass.com',
    phone: '',
    role: 'developer',
    tradeRole: 'Developer',
    hourlyRate: 0,
    status: 'active',
  },
  {
    id: 'w-op',
    name: 'Brandon Wallace',
    email: 'brandonw@ox-glass.com',
    phone: '(555) 214-8830',
    role: 'operator',
    tradeRole: 'Owner',
    hourlyRate: 0,
    status: 'active',
  },
  {
    // Finance Manager: reviews timesheets pre-QBT-push and owns jobcode
    // mapping + labor budgets (testable via the dev "View as" switcher).
    id: 'w-fin',
    name: 'Priya Shah',
    email: 'priya@ox-glass.com',
    phone: '(555) 480-1122',
    role: 'finance_manager',
    tradeRole: 'Finance Manager',
    hourlyRate: 0,
    status: 'active',
  },
  {
    id: 'w-sch',
    name: 'Janet Cole',
    email: 'janet@ox-glass.com',
    phone: '(555) 902-7741',
    role: 'scheduler',
    tradeRole: 'Scheduler',
    hourlyRate: 0,
    status: 'active',
  },
  {
    id: 'w-fs',
    name: 'Derek Nolan',
    email: 'derek@ox-glass.com',
    phone: '(555) 640-3312',
    role: 'field_super',
    tradeRole: 'Field Super',
    hourlyRate: 0,
    status: 'active',
  },
  {
    // A second Field Super so the "each Field Super sees only their own jobs"
    // rule is testable via the dev "View as" switcher (Derek and Alicia share
    // job-1, differ elsewhere).
    id: 'w-fs2',
    name: 'Alicia Gomez',
    email: 'alicia@ox-glass.com',
    phone: '(555) 771-2093',
    role: 'field_super',
    tradeRole: 'Field Super',
    hourlyRate: 0,
    status: 'active',
  },
  {
    id: PRIMARY_INSTALLER_ID,
    name: 'Marcus Lee',
    email: 'marcus@ox-glass.com',
    phone: '(555) 332-1098',
    role: 'installer',
    tradeRole: 'Glazier',
    hourlyRate: 42.5,
    status: 'active',
  },
  {
    id: 'w-i2',
    name: 'Sofia Ramirez',
    email: 'sofia@ox-glass.com',
    phone: '(555) 887-4421',
    role: 'installer',
    tradeRole: 'Glazier',
    hourlyRate: 38,
    status: 'active',
  },
];

/** Convenience lookup for a worker's pay rate. */
function rateOf(workerId: string): number {
  return mockWorkers.find((w) => w.id === workerId)?.hourlyRate ?? 0;
}

function at(daysFromToday: number, hours: number, minutes = 0): string {
  return set(addDays(new Date(), daysFromToday), {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  }).toISOString();
}

/** yyyy-MM-dd for a day relative to today. */
function day(daysFromToday: number): string {
  return format(addDays(new Date(), daysFromToday), 'yyyy-MM-dd');
}

const seededWorkRequests: WorkRequest[] = [
  // Today
  {
    id: 'j-1',
    title: 'Storefront Glass Install',
    address: '1420 W Fulton Market, Chicago, IL',
    date: day(0),
    startTime: at(0, 7),
    endTime: at(0, 11, 30),
    status: 'Made Progress',
    priorityOrder: 1,
    priority: 'High',
    // Windows scope: exercises the SGD-videos flow and the Pictures filters.
    scopes: ['Windows', 'Storefront'],
    scopeOfWork:
      'Set and seal three storefront glass panels at the main entry. Verify plumb before final caulk.',
    materials: 'Structural silicone, setting blocks, backer rod',
    details: {
      generalContractor: 'Meridian Build Group',
      managerName: 'Carlos Reyes',
      managerPhone: '(555) 391-2204',
    },
  },
  {
    id: 'j-2',
    title: 'Curtain Wall Repair — Tower B',
    address: '233 S Wacker Dr, Chicago, IL',
    date: day(0),
    startTime: at(0, 12, 30),
    endTime: at(0, 16),
    status: 'Undefined',
    priorityOrder: 2,
    priority: 'Medium',
    scopes: ["IGU's", 'Swing Doors'],
    scopeOfWork: 'Replace cracked curtain-wall units on Tower B, floors 4–6.',
    materials: 'Replacement gaskets, weep covers',
    details: {
      generalContractor: 'Skyline Commercial',
      managerName: 'Dana Whitfield',
      managerPhone: '(555) 760-1188',
    },
  },
  {
    id: 'j-3',
    title: 'Shower Door Measure',
    address: '88 Oakdale Ave, Evanston, IL',
    date: day(0),
    // No time window assigned — worker fits this in around their other jobs.
    status: 'Undefined',
    priorityOrder: 3,
    priority: 'Low',
    details: {
      generalContractor: 'Homefront Remodeling',
      managerName: 'Priya Natarajan',
      managerPhone: '(555) 442-9071',
    },
  },
  // Yesterday
  {
    id: 'j-4',
    title: 'Office Partition Glazing',
    address: '500 N Michigan Ave, Chicago, IL',
    date: day(-1),
    startTime: at(-1, 8),
    endTime: at(-1, 15),
    status: 'Finished',
    priorityOrder: 1,
    priority: 'Medium',
    details: {
      generalContractor: 'Meridian Build Group',
      managerName: 'Carlos Reyes',
      managerPhone: '(555) 391-2204',
    },
  },
  // Tomorrow
  {
    id: 'j-5',
    title: 'Lobby Mirror Wall Install',
    address: '740 N Rush St, Chicago, IL',
    date: day(1),
    startTime: at(1, 7, 30),
    endTime: at(1, 13),
    status: 'Undefined',
    priorityOrder: 1,
    priority: 'High',
    scopeOfWork: 'Mount lobby mirror wall; level and anchor to substrate.',
    details: {
      generalContractor: 'Lakeside Interiors',
      managerName: 'Mike Okafor',
      managerPhone: '(555) 218-6645',
    },
  },
  {
    id: 'j-6',
    title: 'Window Reglaze — Unit 12F',
    address: '1255 S Prairie Ave, Chicago, IL',
    date: day(1),
    // No time window assigned.
    status: 'Undefined',
    priorityOrder: 2,
    priority: 'Low',
    details: {
      generalContractor: 'Skyline Commercial',
      managerName: 'Dana Whitfield',
      managerPhone: '(555) 760-1188',
    },
  },
  // Day after tomorrow
  {
    id: 'j-7',
    title: 'Storefront Punch List',
    address: '1420 W Fulton Market, Chicago, IL',
    date: day(2),
    startTime: at(2, 8),
    endTime: at(2, 12),
    status: 'Undefined',
    priorityOrder: 1,
    priority: 'Medium',
    details: {
      generalContractor: 'Meridian Build Group',
      managerName: 'Carlos Reyes',
      managerPhone: '(555) 391-2204',
    },
  },
];

/**
 * Jobsites/projects the Operator owns. Work Requests (below) hang off these.
 *
 * `fieldSuperIds` are the assigned Field Supers: Derek (w-fs) and Alicia (w-fs2)
 * share job-1 (exercises the multi-Field-Super case) and otherwise cover
 * different jobs, so switching between them shows each a distinct slice.
 */
export const mockJobs: Job[] = [
  {
    id: 'job-1',
    name: 'Fulton Market Storefront',
    location: '1420 W Fulton Market, Chicago, IL',
    po: '4501',
    status: 'Active',
    qbtJobcodeId: '90112',
    flashingMaterial: 'Regular rainbuster',
    fieldSuperIds: ['w-fs', 'w-fs2'],
    // Exercises the multi-scope count pairs (Window + SGD from Windows,
    // Shower and Screen from their own scopes).
    scopes: ['Windows', 'Showers', 'Screens', 'Storefront'],
    windowCountDone: 12,
    windowCountTotal: 40,
    sgdCountDone: 2,
    sgdCountTotal: 6,
    showerCountDone: 0,
    showerCountTotal: 8,
    screenCountDone: 5,
    screenCountTotal: 20,
  },
  {
    id: 'job-2',
    name: 'Wacker Tower B Curtain Wall',
    location: '233 S Wacker Dr, Chicago, IL',
    po: '4502',
    status: 'Active',
    qbtJobcodeId: '90113',
    flashingMaterial: 'Regular rainbuster',
    fieldSuperIds: ['w-fs'],
    scopes: ['Windows', 'Mirrors', 'Swing Doors', "IGU's"],
    mirrorCountDone: 3,
    mirrorCountTotal: 15,
    swingDoorCountDone: 1,
    swingDoorCountTotal: 4,
    iguCountDone: 10,
    iguCountTotal: 32,
  },
  {
    id: 'job-3',
    name: 'Oakdale Residence',
    location: '88 Oakdale Ave, Evanston, IL',
    status: 'Active',
    // Not yet mapped to a QBT jobcode — shows the unmapped state in the table.
    fieldSuperIds: ['w-fs'],
  },
  {
    id: 'job-4',
    name: 'Michigan Ave Office Build-out',
    location: '500 N Michigan Ave, Chicago, IL',
    po: '4510',
    status: 'Active',
    qbtJobcodeId: '90120',
    fieldSuperIds: ['w-fs2'],
  },
  {
    id: 'job-5',
    name: 'Rush Street Lobby',
    location: '740 N Rush St, Chicago, IL',
    status: 'Active',
    qbtJobcodeId: '90131',
    fieldSuperIds: ['w-fs2'],
  },
  {
    id: 'job-6',
    name: 'Prairie Ave Condos',
    location: '1255 S Prairie Ave, Chicago, IL',
    status: 'Finished',
    qbtJobcodeId: '88004',
    fieldSuperIds: ['w-fs'],
  },
];

/** Which jobsite each seeded work request belongs to. */
const WORK_REQUEST_TO_JOB: Record<string, string> = {
  'j-1': 'job-1',
  'j-2': 'job-2',
  'j-3': 'job-3',
  'j-4': 'job-4',
  'j-5': 'job-5',
  'j-6': 'job-6',
  'j-7': 'job-1',
};

/**
 * Seeded work requests, parented to jobs and (temporarily) all assigned to the
 * primary installer until crew-based scheduling exists. The parent Job's
 * `flashingMaterial` is snapshotted onto each card here, mirroring the
 * auto-inheritance rule in `addWorkRequest` so seed data stays consistent.
 */
export const mockWorkRequests: WorkRequest[] = seededWorkRequests.map((card) => {
  const jobId = WORK_REQUEST_TO_JOB[card.id];
  const parentJob = mockJobs.find((job) => job.id === jobId);
  return {
    ...card,
    jobId,
    assignedInstallerId: PRIMARY_INSTALLER_ID,
    flashingMaterial: parentJob?.flashingMaterial,
  };
});

/**
 * Permanent crews, installers only. Marcus (the primary installer) is in Crew
 * Alpha, which is assigned every seeded work request below — so once Step 5 switches
 * the installer agenda to crew resolution, Marcus keeps seeing exactly the cards
 * he sees today.
 */
export const mockCrews: Crew[] = [
  {
    id: 'crew-alpha',
    name: 'Crew Alpha',
    installerIds: [PRIMARY_INSTALLER_ID], // Marcus Lee
    foremanId: PRIMARY_INSTALLER_ID,
  },
  {
    id: 'crew-bravo',
    name: 'Crew Bravo',
    installerIds: ['w-i2'], // Sofia Ramirez
    foremanId: 'w-i2',
  },
];

/**
 * One Daily Crew on day+2 regroups Marcus + Sofia for a punch-list push,
 * overriding their permanent crews for that one day (exercises the override
 * path). The day+2 card (`j-7`) is also assigned to this crew below, so Marcus
 * still sees it that day despite being pulled out of Crew Alpha.
 */
export const mockDailyCrews: DailyCrew[] = [
  {
    id: 'dc-1',
    name: 'Punch List Crew',
    installerIds: [PRIMARY_INSTALLER_ID, 'w-i2'], // Marcus Lee, Sofia Ramirez
  },
];

/**
 * Schedule assignments (the single-source-of-truth fan-out). Every seeded
 * work request is placed on Crew Alpha for its existing date; `j-7` is additionally
 * placed on the day+2 Daily Crew so the override resolves to the same card.
 */
export const mockAssignments: ScheduleAssignment[] = [
  ...mockWorkRequests.map((card, i) => ({
    id: `asn-${i + 1}`,
    workRequestId: card.id,
    crewId: 'crew-alpha',
    date: card.date,
  })),
  { id: 'asn-dc-1', workRequestId: 'j-7', crewId: 'dc-1', date: day(2) },
];

function makeLog(
  id: string,
  workerId: string,
  daysAgo: number,
  startHour: number,
  endHour: number,
  endMinutes: number,
  ref: { workRequestId?: string; customProjectName?: string },
  sendStatus: TimesheetSendStatus = 'sent'
): TimesheetLog {
  const day = subDays(new Date(), daysAgo);
  const start = set(day, { hours: startHour, minutes: 0, seconds: 0, milliseconds: 0 });
  const end = set(day, { hours: endHour, minutes: endMinutes, seconds: 0, milliseconds: 0 });
  const totalHours = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100;
  return {
    id,
    workerId,
    date: format(day, 'yyyy-MM-dd'),
    ...ref,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    totalHours,
    earnedAmount: Math.round(totalHours * rateOf(workerId) * 100) / 100,
    sendStatus,
  };
}

const M = PRIMARY_INSTALLER_ID; // Marcus Lee
const S = 'w-i2'; // Sofia Ramirez — gives the Operator review a second installer

export const mockLogs: TimesheetLog[] = [
  // Marcus — current week (not yet swept) + history (already sent to QBT)
  makeLog('t-1', M, 0, 7, 11, 30, { workRequestId: 'j-1' }, 'unsent'),
  makeLog('t-2', M, 1, 8, 12, 0, { workRequestId: 'j-4' }, 'unsent'),
  makeLog('t-3', M, 1, 12, 15, 0, { workRequestId: 'j-4' }, 'unsent'),
  // Sofia — current week, so the Operator sees more than one installer
  makeLog('t-s1', S, 0, 8, 16, 0, { customProjectName: 'Lobby Glazing — North Loop' }, 'unsent'),
  makeLog('t-s2', S, 1, 7, 15, 30, { customProjectName: 'Lobby Glazing — North Loop' }, 'unsent'),
  // One older log failed to send — exercises the "Failed to send to QBT" badge.
  makeLog('t-4', M, 2, 7, 15, 30, { customProjectName: 'Shop Fabrication' }, 'failed'),
  makeLog('t-5', M, 3, 8, 16, 0, { customProjectName: 'Warehouse Inventory' }),
  makeLog('t-6', M, 6, 7, 14, 30, { customProjectName: 'Glass Tempering Run' }),
  makeLog('t-7', M, 8, 8, 16, 30, { customProjectName: 'Retail Buildout — Oak Park' }),
  makeLog('t-8', M, 10, 7, 15, 0, { customProjectName: 'Retail Buildout — Oak Park' }),
  makeLog('t-9', M, 13, 8, 12, 0, { customProjectName: 'Service Calls' }),
  makeLog('t-10', M, 15, 7, 15, 30, { customProjectName: 'Hotel Atrium Skylight' }),
  makeLog('t-11', M, 17, 7, 16, 0, { customProjectName: 'Hotel Atrium Skylight' }),
  makeLog('t-12', M, 21, 8, 14, 0, { customProjectName: 'Shop Fabrication' }),
  makeLog('t-13', M, 24, 7, 15, 0, { customProjectName: 'Condo Balcony Rails' }),
  makeLog('t-14', M, 28, 8, 16, 30, { customProjectName: 'Condo Balcony Rails' }),
];
