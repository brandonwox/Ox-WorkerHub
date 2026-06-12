import { addDays, format, set, subDays } from 'date-fns';

import { Job, TimesheetLog, User } from '@/types';

export const mockUser: User = {
  id: 'u-1',
  name: 'Brandon Wallace',
  email: 'brandonw@ox-glass.com',
  phone: '(555) 214-8830',
  tradeRole: 'Glazier',
  hourlyRate: 42.5,
};

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

export const mockJobs: Job[] = [
  // Today
  {
    id: 'j-1',
    title: 'Storefront Glass Install',
    address: '1420 W Fulton Market, Chicago, IL',
    date: day(0),
    startTime: at(0, 7),
    endTime: at(0, 11, 30),
    status: 'In Progress',
    priorityOrder: 1,
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
    status: 'Upcoming',
    priorityOrder: 2,
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
    status: 'Upcoming',
    priorityOrder: 3,
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
    status: 'Upcoming',
    priorityOrder: 1,
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
    status: 'Upcoming',
    priorityOrder: 2,
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
    status: 'Upcoming',
    priorityOrder: 1,
    details: {
      generalContractor: 'Meridian Build Group',
      managerName: 'Carlos Reyes',
      managerPhone: '(555) 391-2204',
    },
  },
];

function makeLog(
  id: string,
  daysAgo: number,
  startHour: number,
  endHour: number,
  endMinutes: number,
  ref: { jobId?: string; customProjectName?: string },
  hourlyRate: number
): TimesheetLog {
  const day = subDays(new Date(), daysAgo);
  const start = set(day, { hours: startHour, minutes: 0, seconds: 0, milliseconds: 0 });
  const end = set(day, { hours: endHour, minutes: endMinutes, seconds: 0, milliseconds: 0 });
  const totalHours = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100;
  return {
    id,
    date: format(day, 'yyyy-MM-dd'),
    ...ref,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    totalHours,
    earnedAmount: Math.round(totalHours * hourlyRate * 100) / 100,
  };
}

const rate = mockUser.hourlyRate;

export const mockLogs: TimesheetLog[] = [
  makeLog('t-1', 0, 7, 11, 30, { jobId: 'j-1' }, rate),
  makeLog('t-2', 1, 8, 12, 0, { jobId: 'j-4' }, rate),
  makeLog('t-3', 1, 12, 15, 0, { jobId: 'j-4' }, rate),
  makeLog('t-4', 2, 7, 15, 30, { customProjectName: 'Shop Fabrication' }, rate),
  makeLog('t-5', 3, 8, 16, 0, { customProjectName: 'Warehouse Inventory' }, rate),
  makeLog('t-6', 6, 7, 14, 30, { customProjectName: 'Glass Tempering Run' }, rate),
  makeLog('t-7', 8, 8, 16, 30, { customProjectName: 'Retail Buildout — Oak Park' }, rate),
  makeLog('t-8', 10, 7, 15, 0, { customProjectName: 'Retail Buildout — Oak Park' }, rate),
  makeLog('t-9', 13, 8, 12, 0, { customProjectName: 'Service Calls' }, rate),
  makeLog('t-10', 15, 7, 15, 30, { customProjectName: 'Hotel Atrium Skylight' }, rate),
  makeLog('t-11', 17, 7, 16, 0, { customProjectName: 'Hotel Atrium Skylight' }, rate),
  makeLog('t-12', 21, 8, 14, 0, { customProjectName: 'Shop Fabrication' }, rate),
  makeLog('t-13', 24, 7, 15, 0, { customProjectName: 'Condo Balcony Rails' }, rate),
  makeLog('t-14', 28, 8, 16, 30, { customProjectName: 'Condo Balcony Rails' }, rate),
];
