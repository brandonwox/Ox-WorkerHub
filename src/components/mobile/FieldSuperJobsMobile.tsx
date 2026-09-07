import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldSuperPicker } from '@/components/desktop/FieldSuperPicker';
import { FormInput } from '@/components/FormInput';
import { ArchivedJobsMobile } from '@/components/mobile/ArchivedJobsMobile';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { jobsForFieldSuper, useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job, JOB_SCOPES, JobScope, Worker } from '@/types';
import { activeJobs } from '@/utils/jobArchive';
import { CountTotalField, JOB_COUNT_DEFS } from '@/utils/jobCounts';
import { SUB_JOB_TYPE_PRESETS } from '@/utils/jobName';
import { PO_TAKEN_MESSAGE, poTaken } from '@/utils/jobPo';
import { workRequestLinksJob } from '@/utils/workRequestJobs';

/**
 * The Field Super's jobs on the phone. Mirrors the desktop page's scope: a
 * name/PO/address search over the list; tap a job to open its details page;
 * the chevron expands an inline editor for the job's details — name, PO,
 * jobsite address, builder, scopes, assigned Field Supers, flashing material,
 * and scope counts — plus the "This job has Sub-Jobs" toggle and (for
 * assigned supers) Archive. Archived jobs collapse into an Archived section
 * at the bottom, where they can be restored or permanently deleted.
 */
export function FieldSuperJobsMobile() {
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const workers = useAppStore((s) => s.workers);
  const workRequests = useAppStore((s) => s.workRequests);
  const assignments = useAppStore((s) => s.assignments);
  const updateJob = useAppStore((s) => s.updateJob);
  const addJob = useAppStore((s) => s.addJob);
  const archiveJob = useAppStore((s) => s.archiveJob);
  const flash = useAppStore((s) => s.flash);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  // "All jobs" widens the list from assigned-only to EVERY job — each row
  // then shows its assigned supers. Unassigned jobs are fully editable too
  // (helping out needs no assignment); the details page still offers
  // "Assign myself" to take responsibility for one.
  const [showAll, setShowAll] = useState(false);

  // Sub-jobs stay out of this office list — they live inside their parent's
  // Sub-Jobs section on the job page, which is also where new ones are
  // created (their work requests still show on the Work Requests tab).
  const myJobs = useMemo(
    () =>
      activeJobs(
        showAll ? jobs : me ? jobsForFieldSuper(jobs, me.id) : []
      ).filter((job) => !job.parentJobId),
    [jobs, me, showAll]
  );

  // Same search as the web page: name, PO, or address.
  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return myJobs;
    return myJobs.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        (job.po ?? '').toLowerCase().includes(q) ||
        (job.location ?? '').toLowerCase().includes(q)
    );
  }, [myJobs, query]);

  const superNamesFor = (job: Job) =>
    (job.fieldSuperIds ?? [])
      .map((id) => workers.find((w) => w.id === id)?.name)
      .filter((name): name is string => !!name)
      .join(', ');

  // Roster for the inline editor's assignment picker.
  const fieldSuperRoster = useMemo(
    () => workers.filter((w) => w.role === 'field_super'),
    [workers]
  );

  // Every builder ever applied to a job — the editor's Builder suggestions.
  const builderOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const j of jobs) {
      const b = j.builder?.trim();
      if (b) seen.add(b);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.workRequestId)),
    [assignments]
  );

  const countsFor = (job: Job) => {
    const cards = workRequests.filter((c) => workRequestLinksJob(c, job.id));
    const scheduled = cards.filter((c) => scheduledIds.has(c.id)).length;
    return { total: cards.length, scheduled };
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Jobs</Text>
          <View style={styles.headingActions}>
            <Pressable
              style={[styles.allToggle, showAll && styles.allToggleOn]}
              onPress={() => setShowAll((v) => !v)}
            >
              <Feather
                name="eye"
                size={13}
                color={showAll ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.allToggleText,
                  showAll && styles.allToggleTextOn,
                ]}
              >
                All jobs
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.newJobButton,
                pressed && styles.saveDim,
              ]}
              onPress={() => setCreateOpen(true)}
            >
              <Feather name="plus" size={15} color={colors.textOnAccent} />
              <Text style={styles.newJobText}>New job</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.hint}>
          Tap a job to open it. Use the arrow to edit its details — name, PO,
          address, builder, scopes, flashing material, and assigned supers.
        </Text>

        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search jobs by name, PO, or address…"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={15} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {myJobs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="briefcase" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No jobs</Text>
              <Text style={styles.emptySubtitle}>
                {showAll
                  ? 'No jobs yet.'
                  : 'Jobs you’re assigned to show up here — turn on "All jobs" to browse every job and assign yourself.'}
              </Text>
            </View>
          ) : visibleJobs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="search" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No jobs match</Text>
              <Text style={styles.emptySubtitle}>
                Nothing matches “{query.trim()}”.
              </Text>
            </View>
          ) : (
            visibleJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                counts={countsFor(job)}
                // With "All jobs" on, each row shows who's assigned.
                supersLine={
                  showAll
                    ? superNamesFor(job) || 'No Field Super assigned'
                    : undefined
                }
                fieldSuperRoster={fieldSuperRoster}
                builderOptions={builderOptions}
                // Archiving stays with the supers assigned to the job (the
                // web page's rule; RLS gates the eventual permanent delete
                // the same way). Everything else is open to any super.
                canArchive={!!me && (job.fieldSuperIds ?? []).includes(me.id)}
                expanded={expandedId === job.id}
                onToggle={() =>
                  setExpandedId((id) => (id === job.id ? null : job.id))
                }
                onSave={(changes) => {
                  if (changes.po && poTaken(changes.po, jobs, job.id)) {
                    flash(
                      'That PO is already used by another job — change discarded.',
                      'warning'
                    );
                    return false;
                  }
                  updateJob(job.id, changes);
                  return true;
                }}
                onArchive={() => {
                  archiveJob(job.id);
                  flash(`Job "${job.name}" archived`, 'success');
                  setExpandedId(null);
                }}
              />
            ))
          )}

          <ArchivedJobsMobile showAll={showAll} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CreateJobSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => {
          const created = addJob({ ...input, fieldSuperIds: [] });
          flash(`Job "${created.name}" created`, 'success');
        }}
      />
    </SafeAreaView>
  );
}

/**
 * Phone-layout job creation: name, jobsite address, and scope chips. No QBT
 * jobcode — the Finance Manager fills it in later — and the creating Field
 * Super is auto-assigned to the job (store + DB trigger).
 */
function CreateJobSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    input: {
      name: string;
      po: string;
      location: string;
      builder?: string;
      scopes?: JobScope[];
    } & Partial<Record<CountTotalField, number>>
  ) => void;
}) {
  const [name, setName] = useState('');
  const [po, setPo] = useState('');
  const [location, setLocation] = useState('');
  const [builder, setBuilder] = useState('');
  const [scopes, setScopes] = useState<JobScope[]>([]);
  // Count totals as typed, keyed by their Job field — kept when a scope is
  // toggled off (only selected scopes' values are validated/submitted).
  const [totals, setTotals] = useState<
    Partial<Record<CountTotalField, string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  // For the duplicate-PO check (archived jobs included).
  const allJobs = useAppStore((s) => s.jobs);

  // The count pairs the selected scopes require (Windows carries two: Window
  // + SGD; Storefront carries none) — same rule as the desktop form.
  const countDefs = JOB_COUNT_DEFS.filter((def) => scopes.includes(def.scope));

  const close = () => {
    setName('');
    setPo('');
    setLocation('');
    setBuilder('');
    setScopes([]);
    setTotals({});
    setError(null);
    onClose();
  };

  const toggleScope = (scope: JobScope) =>
    setScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );

  const submit = () => {
    if (!name.trim()) {
      setError('Job name is required.');
      return;
    }
    if (!po.trim()) {
      setError('PO is required.');
      return;
    }
    if (poTaken(po, allJobs)) {
      setError(PO_TAKEN_MESSAGE);
      return;
    }
    // Every selected scope's count total is required (0 is fine — it just
    // has to be entered deliberately).
    const countTotals: Partial<Record<CountTotalField, number>> = {};
    for (const def of countDefs) {
      const raw = (totals[def.totalField] ?? '').trim();
      if (!/^\d+$/.test(raw)) {
        setError(`Enter the ${def.label} total — 0 is fine.`);
        return;
      }
      countTotals[def.totalField] = Number(raw);
    }
    onSubmit({
      name: name.trim(),
      po: po.trim(),
      location: location.trim(),
      builder: builder.trim() || undefined,
      scopes: scopes.length > 0 ? scopes : undefined,
      ...countTotals,
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Create job</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Name + PO share the line — both are required to create. */}
          <View style={styles.namePoRow}>
            <View style={styles.nameCol}>
              <FormInput
                label="Job name"
                value={name}
                onChangeText={setName}
                placeholder="Snyderville Commercial Complex"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.poCol}>
              <FormInput
                label="PO"
                value={po}
                onChangeText={setPo}
                placeholder="e.g. 4501"
                autoCapitalize="none"
              />
            </View>
          </View>
          <FormInput
            label="Jobsite address"
            value={location}
            onChangeText={setLocation}
            placeholder="123 Main St, Park City, UT"
          />
          <FormInput
            label="Builder (optional)"
            value={builder}
            onChangeText={setBuilder}
            placeholder="The builder/GC this job is for"
            autoCapitalize="words"
          />

          <View style={styles.scopeField}>
            <Text style={styles.scopeLabel}>Scopes</Text>
            <View style={styles.scopeChips}>
              {JOB_SCOPES.map((scope) => {
                const active = scopes.includes(scope);
                return (
                  <Pressable
                    key={scope}
                    style={[styles.scopeChip, active && styles.scopeChipOn]}
                    onPress={() => toggleScope(scope)}
                  >
                    <Text
                      style={[
                        styles.scopeChipText,
                        active && styles.scopeChipTextOn,
                      ]}
                    >
                      {scope}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Each selected scope requires its count total up front (the
                Windows scope carries two — Window + SGD). */}
            {countDefs.length > 0 && (
              <View style={styles.countGrid}>
                {countDefs.map((def) => (
                  <View key={def.totalField} style={styles.countCell}>
                    <FormInput
                      label={`${def.label} total`}
                      value={totals[def.totalField] ?? ''}
                      onChangeText={(t) =>
                        setTotals((prev) => ({
                          ...prev,
                          [def.totalField]: t,
                        }))
                      }
                      placeholder="0"
                      keyboardType="number-pad"
                      autoCapitalize="none"
                    />
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.sheetHint}>
              The QuickBooks Time jobcode ID is filled in later by the Finance
              Manager.
            </Text>
          </View>

          {error ? <Text style={styles.sheetError}>{error}</Text> : null}

          <View style={styles.sheetActions}>
            <Pressable
              style={({ pressed }) => [
                styles.sheetCancel,
                pressed && styles.saveDim,
              ]}
              onPress={close}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.sheetSubmit,
                pressed && styles.saveDim,
              ]}
              onPress={submit}
            >
              <Text style={styles.sheetSubmitText}>Create job</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const numToText = (n: number | undefined) => (n != null ? String(n) : '');
/** "12" → 12; blank/garbage → undefined (clears the value). */
const parseCount = (text: string): number | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

/** Order-insensitive equality of two scope lists. */
const sameScopes = (a: JobScope[], b: JobScope[]) =>
  a.length === b.length && a.every((s) => b.includes(s));

function JobRow({
  job,
  counts,
  supersLine,
  fieldSuperRoster,
  builderOptions,
  canArchive,
  expanded,
  onToggle,
  onSave,
  onArchive,
}: {
  job: Job;
  counts: { total: number; scheduled: number };
  /** Assigned supers, rendered under the counts ("All jobs" mode only). */
  supersLine?: string;
  /** Every field super on the roster — the assignment picker's options. */
  fieldSuperRoster: Worker[];
  /** Every builder already on some job — the Builder field's suggestions. */
  builderOptions: string[];
  /** Whether the Archive row shows (assigned supers only). */
  canArchive: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Returns whether the save went through (false = rejected, e.g. PO taken). */
  onSave: (changes: Partial<Job>) => boolean;
  onArchive: () => void;
}) {
  const router = useRouter();
  const updateJob = useAppStore((s) => s.updateJob);
  const [name, setName] = useState(job.name);
  const [location, setLocation] = useState(job.location);
  const [po, setPo] = useState(job.po ?? '');
  const [builder, setBuilder] = useState(job.builder ?? '');
  const [scopes, setScopes] = useState<JobScope[]>(job.scopes ?? []);
  const [fieldSuperIds, setFieldSuperIds] = useState<string[]>(
    job.fieldSuperIds ?? []
  );
  const [flashing, setFlashing] = useState(job.flashingMaterial ?? '');
  // The count pairs the DRAFT scopes cover — rows appear/disappear as chips
  // are toggled, before saving. Empty = legacy "not narrowed" (every pair).
  const countDefs =
    scopes.length === 0
      ? JOB_COUNT_DEFS
      : JOB_COUNT_DEFS.filter((def) => scopes.includes(def.scope));
  // Flashing follows the draft scopes the same way (jobAllowsWindows' rule).
  const windowsAllowed = scopes.length === 0 || scopes.includes('Windows');
  const [countText, setCountText] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const def of JOB_COUNT_DEFS) {
      init[def.doneField] = numToText(job[def.doneField]);
      init[def.totalField] = numToText(job[def.totalField]);
    }
    return init;
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sub-job type picking (enabling "This job has Sub-Jobs" requires a type).
  const [subJobTypePicking, setSubJobTypePicking] = useState(false);
  const [customSubJobType, setCustomSubJobType] = useState('');
  // Two-tap confirms: hiding the Sub-Jobs section and archiving the job.
  const [armed, setArmed] = useState<'hide-subjobs' | 'archive' | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    []
  );
  const arm = (what: 'hide-subjobs' | 'archive') => {
    setArmed(what);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(null), 4000);
  };
  const disarm = () => {
    setArmed(null);
    if (armTimer.current) clearTimeout(armTimer.current);
  };

  const touch = () => {
    setSaved(false);
    setError(null);
  };

  const setCount = (field: string, text: string) => {
    setCountText((prev) => ({ ...prev, [field]: text }));
    touch();
  };

  const toggleScope = (scope: JobScope) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
    touch();
  };

  // Order-insensitive: toggling a super off and back on isn't a change.
  const supersChanged =
    fieldSuperIds.length !== (job.fieldSuperIds ?? []).length ||
    fieldSuperIds.some((id) => !(job.fieldSuperIds ?? []).includes(id));
  const scopesChanged = !sameScopes(scopes, job.scopes ?? []);

  const dirty =
    name.trim() !== job.name ||
    location.trim() !== job.location ||
    po.trim() !== (job.po ?? '') ||
    builder.trim() !== (job.builder ?? '') ||
    scopesChanged ||
    supersChanged ||
    (windowsAllowed && flashing.trim() !== (job.flashingMaterial ?? '')) ||
    countDefs.some(
      (def) =>
        parseCount(countText[def.doneField]) !== job[def.doneField] ||
        parseCount(countText[def.totalField]) !== job[def.totalField]
    );

  const save = () => {
    if (!name.trim()) {
      setError('Job name is required.');
      return;
    }
    const countChanges: Partial<Job> = {};
    for (const def of countDefs) {
      countChanges[def.doneField] = parseCount(countText[def.doneField]);
      countChanges[def.totalField] = parseCount(countText[def.totalField]);
    }
    // Dropping a scope also clears its now-hidden done/total counts (and the
    // flashing material when Windows goes) so stale numbers don't keep
    // displaying — the same rule as the web sidebar's scopes editor.
    const clears: Partial<Job> = {};
    if (scopesChanged) {
      for (const def of JOB_COUNT_DEFS) {
        if (
          !countDefs.includes(def) &&
          (job[def.doneField] != null || job[def.totalField] != null)
        ) {
          clears[def.doneField] = undefined;
          clears[def.totalField] = undefined;
        }
      }
    }
    const ok = onSave({
      name: name.trim(),
      location: location.trim(),
      po: po.trim() || undefined,
      builder: builder.trim() || undefined,
      // Empty = legacy "not narrowed" (all scopes allowed).
      scopes: scopes.length > 0 ? scopes : undefined,
      flashingMaterial: windowsAllowed ? flashing.trim() : undefined,
      // Assignments only when actually changed — updateJob writes the
      // job_field_supers join table exactly when this key is present.
      ...(supersChanged ? { fieldSuperIds } : {}),
      ...countChanges,
      ...clears,
    });
    if (ok) {
      setSaved(true);
      // Local drafts for fields the save may have normalized away.
      if (!windowsAllowed) setFlashing('');
      setCountText((prev) => {
        const next = { ...prev };
        for (const def of JOB_COUNT_DEFS) {
          if (!countDefs.includes(def) && scopesChanged) {
            next[def.doneField] = '';
            next[def.totalField] = '';
          }
        }
        return next;
      });
    }
  };

  // Picking a type is what enables "This job has Sub-Jobs" — the two persist
  // together (immediately, like the web sidebar), and sub-job creation
  // prefixes the singular form ("Lot 159").
  const chooseSubJobType = (type: string) => {
    updateJob(job.id, { hasSubJobs: true, subJobType: type });
    setSubJobTypePicking(false);
    setCustomSubJobType('');
  };

  // Builder suggestions: existing builders matching what's typed (hidden once
  // the typed value IS one of them, or when nothing's typed and the list is
  // long — the chips are a shortcut, not a directory).
  const builderQuery = builder.trim().toLowerCase();
  const builderSuggestions = builderOptions.filter(
    (b) =>
      b.toLowerCase() !== builderQuery &&
      (builderQuery ? b.toLowerCase().includes(builderQuery) : true)
  );
  const showBuilderSuggestions =
    builderSuggestions.length > 0 && (builderQuery.length > 0 || builderOptions.length <= 6);

  const archived = job.status === 'Finished';
  const isParent = !job.parentJobId;

  return (
    <View style={[styles.card, archived && styles.cardArchived]}>
      {/* Tapping the row opens the job's details page; the chevron alone
          expands the inline editor. */}
      <View style={styles.cardHeader}>
        <Pressable
          style={({ pressed }) => [
            styles.cardTitleWrap,
            pressed && styles.saveDim,
          ]}
          onPress={() =>
            router.push({ pathname: '/job-site/[id]', params: { id: job.id } })
          }
        >
          <View style={styles.cardTitleRow}>
            {/* Jobs broken into sub-jobs read as folders, not standalone
                jobsites. */}
            {job.hasSubJobs && (
              <Text style={styles.masterFolderLabel}>Master Folder</Text>
            )}
            <Text style={styles.cardTitle} numberOfLines={1}>
              {job.name}
            </Text>
            {job.po ? <Text style={styles.poText}>{job.po}</Text> : null}
          </View>
          <Text style={styles.cardSub} numberOfLines={1}>
            {counts.total} {counts.total === 1 ? 'work request' : 'work requests'} ·{' '}
            {counts.scheduled} on calendar
            {archived ? ' · Finished' : ''}
          </Text>
          {supersLine ? (
            <Text style={styles.cardSupers} numberOfLines={1}>
              {supersLine}
            </Text>
          ) : null}
        </Pressable>
        <Pressable
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.saveDim]}
          onPress={onToggle}
        >
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {expanded && (
        <View style={styles.cardBody}>
          <FormInput
            label="Job name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              touch();
            }}
            placeholder="Job name"
            autoCapitalize="words"
          />
          <FormInput
            label="PO"
            value={po}
            onChangeText={(text) => {
              setPo(text);
              touch();
            }}
            placeholder="e.g. 4501"
            autoCapitalize="none"
          />
          <FormInput
            label="Jobsite address"
            value={location}
            onChangeText={(text) => {
              setLocation(text);
              touch();
            }}
            placeholder="Street, city"
          />
          {/* Builder — free text, with tappable suggestions drawn from the
              builders already on other jobs (the phone's stand-in for the
              web's searchable dropdown). */}
          <View style={styles.supersField}>
            <FormInput
              label="Builder"
              value={builder}
              onChangeText={(text) => {
                setBuilder(text);
                touch();
              }}
              placeholder="The builder/GC this job is for"
              autoCapitalize="words"
            />
            {showBuilderSuggestions && (
              <View style={styles.suggestionChips}>
                {builderSuggestions.slice(0, 8).map((b) => (
                  <Pressable
                    key={b}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      pressed && styles.saveDim,
                    ]}
                    onPress={() => {
                      setBuilder(b);
                      touch();
                    }}
                  >
                    <Text style={styles.suggestionChipText}>{b}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          {/* Scopes — the trades this job covers. Toggling a chip re-gates the
              count rows and the flashing field below live; the change (and
              any cleared counts) lands on Save. */}
          <View style={styles.supersField}>
            <Text style={styles.supersLabel}>Scopes</Text>
            <View style={styles.editScopeChips}>
              {JOB_SCOPES.map((scope) => {
                const active = scopes.includes(scope);
                return (
                  <Pressable
                    key={scope}
                    style={[
                      styles.editScopeChip,
                      active && styles.editScopeChipOn,
                    ]}
                    onPress={() => toggleScope(scope)}
                  >
                    <Text
                      style={[
                        styles.editScopeChipText,
                        active && styles.editScopeChipTextOn,
                      ]}
                    >
                      {scope}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldHint}>
              Removing a scope also clears its done/total counts. No scopes
              selected means the job isn&apos;t narrowed — every scope (and
              count) stays available.
            </Text>
          </View>
          {/* Assigned Field Supers. A sub-job inherits its parent's supers
              (store + DB trigger) — but sub-jobs never appear in this list. */}
          <View style={styles.supersField}>
            <Text style={styles.supersLabel}>Field supers</Text>
            <FieldSuperPicker
              fieldSupers={fieldSuperRoster}
              selected={fieldSuperIds}
              onToggle={(id) => {
                setFieldSuperIds((ids) =>
                  ids.includes(id)
                    ? ids.filter((x) => x !== id)
                    : [...ids, id]
                );
                touch();
              }}
            />
          </View>
          {/* Hidden entirely while the draft scopes exclude window work. */}
          {windowsAllowed && (
            <>
              <FormInput
                label="Flashing material"
                value={flashing}
                onChangeText={(text) => {
                  setFlashing(text);
                  touch();
                }}
                placeholder="e.g. regular rainbuster"
              />
              <FlashingPhotoField job={job} editable />
            </>
          )}
          {/* One done/total row per count pair the draft scopes cover. */}
          {countDefs.map((def) => (
            <View key={def.doneField} style={styles.countRow}>
              <View style={styles.countCol}>
                <FormInput
                  label={`${def.label} (done)`}
                  value={countText[def.doneField]}
                  onChangeText={(t) => setCount(def.doneField, t)}
                  placeholder="0"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.countCol}>
                <FormInput
                  label="(total)"
                  value={countText[def.totalField]}
                  onChangeText={(t) => setCount(def.totalField, t)}
                  placeholder="total"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          ))}
          {error ? <Text style={styles.sheetError}>{error}</Text> : null}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (!dirty || pressed) && styles.saveDim,
            ]}
            onPress={save}
            disabled={!dirty}
          >
            <Text style={styles.saveText}>
              {saved && !dirty ? 'Saved ✓' : 'Save'}
            </Text>
          </Pressable>

          {/* "This job has Sub-Jobs" — parents only. Enabling requires choosing
              what the sub-jobs are called (it drives sub-job naming: "Lot
              159"); the choice commits immediately, like the web sidebar.
              Turning it off is a two-tap confirm and only hides the section —
              the sub-jobs themselves are kept. */}
          {isParent && (
            <View style={styles.optionBlock}>
              <View style={styles.editDivider} />
              <Pressable
                style={({ pressed }) => [
                  styles.optionRow,
                  pressed && styles.saveDim,
                ]}
                onPress={() => {
                  if (job.hasSubJobs) {
                    if (armed === 'hide-subjobs') {
                      disarm();
                      updateJob(job.id, { hasSubJobs: false });
                    } else {
                      arm('hide-subjobs');
                    }
                  } else {
                    setSubJobTypePicking((on) => !on);
                  }
                }}
              >
                <Feather
                  name={job.hasSubJobs ? 'check-square' : 'square'}
                  size={18}
                  color={job.hasSubJobs ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.optionRowText,
                    armed === 'hide-subjobs' && styles.optionRowWarn,
                  ]}
                >
                  {armed === 'hide-subjobs'
                    ? 'Tap again to hide the Sub-Jobs section (sub-jobs are kept)'
                    : 'This job has Sub-Jobs'}
                </Text>
              </Pressable>
              {(subJobTypePicking || job.hasSubJobs) && (
                <View style={styles.subJobTypeBlock}>
                  <Text style={styles.fieldHint}>
                    {job.hasSubJobs
                      ? 'What the sub-jobs are called — used when naming new ones:'
                      : 'What are the sub-jobs called? Choosing one turns the section on.'}
                  </Text>
                  <View style={styles.editScopeChips}>
                    {[
                      ...SUB_JOB_TYPE_PRESETS,
                      // A saved custom term renders as its own (active) chip.
                      ...(job.subJobType &&
                      !(SUB_JOB_TYPE_PRESETS as readonly string[]).includes(
                        job.subJobType
                      )
                        ? [job.subJobType]
                        : []),
                    ].map((type) => {
                      const active = job.hasSubJobs && job.subJobType === type;
                      return (
                        <Pressable
                          key={type}
                          style={[
                            styles.editScopeChip,
                            active && styles.editScopeChipOn,
                          ]}
                          onPress={() => chooseSubJobType(type)}
                        >
                          <Text
                            style={[
                              styles.editScopeChipText,
                              active && styles.editScopeChipTextOn,
                            ]}
                          >
                            {type}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    style={styles.customTypeInput}
                    value={customSubJobType}
                    onChangeText={setCustomSubJobType}
                    placeholder="Custom term — tap Done to use it"
                    placeholderTextColor={colors.textTertiary}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const t = customSubJobType.trim();
                      if (t) chooseSubJobType(t);
                    }}
                  />
                </View>
              )}
            </View>
          )}

          {/* Archive — the "delete" action, two-tap confirmed. Recoverable
              from the Archived section below the list; permanent deletion
              lives only there. Sub-jobs archive with their parent. */}
          {canArchive && (
            <View style={styles.optionBlock}>
              <View style={styles.editDivider} />
              <Pressable
                style={({ pressed }) => [
                  styles.optionRow,
                  armed === 'archive' && styles.archiveRowArmed,
                  pressed && styles.saveDim,
                ]}
                onPress={() => {
                  if (armed === 'archive') {
                    disarm();
                    onArchive();
                  } else {
                    arm('archive');
                  }
                }}
              >
                <Feather
                  name="archive"
                  size={18}
                  color={
                    armed === 'archive' ? colors.textOnAccent : colors.danger
                  }
                />
                <Text
                  style={[
                    styles.optionRowText,
                    styles.optionRowDanger,
                    armed === 'archive' && styles.optionRowArmedText,
                  ]}
                >
                  {armed === 'archive'
                    ? 'Tap again to archive this job'
                    : 'Archive this Job…'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  heading: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  headingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  allToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  allToggleOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  allToggleText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  allToggleTextOn: {
    color: colors.primary,
  },
  newJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  newJobText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardArchived: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  masterFolderLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  poText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  cardSub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  cardSupers: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  countRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  supersField: {
    gap: spacing.sm,
  },
  supersLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  countCol: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveDim: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  sheetOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    ...modalShadow,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  namePoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameCol: {
    flex: 2,
  },
  poCol: {
    flex: 1,
  },
  scopeField: {
    gap: spacing.sm,
  },
  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  countCell: {
    flexGrow: 1,
    flexBasis: '40%',
  },
  scopeLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  scopeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scopeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  scopeChipOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  scopeChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  scopeChipTextOn: {
    color: colors.primary,
  },
  sheetHint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  sheetError: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sheetCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetCancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  sheetSubmit: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  sheetSubmitText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  fieldHint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  suggestionChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  editScopeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  editScopeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  editScopeChipOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  editScopeChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  editScopeChipTextOn: {
    color: colors.primary,
  },
  optionBlock: {
    gap: spacing.md,
  },
  editDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  optionRowText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  optionRowWarn: {
    color: colors.textSecondary,
  },
  optionRowDanger: {
    color: colors.danger,
  },
  archiveRowArmed: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionRowArmedText: {
    color: colors.textOnAccent,
    fontFamily: fonts.semiBold,
  },
  subJobTypeBlock: {
    gap: spacing.sm,
  },
  customTypeInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
}));
