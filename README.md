# Ox WorkerHub

Mobile-first operational hub for tradespeople and field workers: view the day's schedule, clock in and out of jobs, and manage timesheets.

Built with **React Native + Expo + TypeScript** (expo-router, Zustand). Runs on web today and is architected for native iOS/Android deployment — all components use cross-platform primitives.

## Getting started

```bash
npm install
npm run web        # run in the browser
npm run ios        # iOS simulator (macOS)
npm run android    # Android emulator
```

## Features

- **Calendar (default tab)** — swipeable week ribbon with a full-month drop-down, job cards for the selected day ordered by office-set priority, and a job details modal (contractor/manager info, status changes, image upload placeholder).
- **Clock in / out** — sticky bottom bar; clock into a scheduled job or a custom-named project from a bottom sheet. While clocked in the bar shows a live running timer; clocking out instantly writes a finished timesheet log.
- **Timesheets** — totals for hours worked and estimated earnings (Today / This Week Mon–Fri / Last 30 Days), scrolling log feed, and inline editing of start/end times and notes with immediate saves.
- **Settings** — profile card and a form to edit name, phone, email, and password, saved straight to local state.

## Project structure

```
src/
  app/            expo-router routes (tabs + job details modal)
  components/     reusable UI (cards, ribbon, clock bar, modals)
  store/          Zustand store (user, jobs, logs, active shift)
  data/           mock data (generated relative to today)
  utils/          time parsing/formatting helpers
  theme.ts        color palette, Inter font weights, spacing, radii
```

The store in `src/store/useAppStore.ts` is the single integration point: signed out it runs on mock data, signed in it hydrates from Supabase and writes every change through. See [docs/Handoff.md](docs/Handoff.md) for architecture, commands, and backend setup, and [docs/Dev-Tracker.md](docs/Dev-Tracker.md) for what's in flight.
