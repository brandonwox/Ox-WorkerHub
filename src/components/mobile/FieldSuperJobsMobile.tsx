import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/FormInput';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { jobsForFieldSuper, useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job, JOB_SCOPES, JobScope } from '@/types';
import { editableCountDefs, JOB_COUNT_DEFS } from '@/utils/jobCounts';
import { jobAllowsWindows } from '@/utils/jobScopes';

/**
 * The Field Super's jobs on the phone. Mirrors the desktop page's scope: tap
 * a job to open its details page; the chevron expands an inline editor for
 * the jobsite address and flashing material.
 */
export function FieldSuperJobsMobile() {
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const workRequests = useAppStore((s) => s.workRequests);
  const assignments = useAppStore((s) => s.assignments);
  const updateJob = useAppStore((s) => s.updateJob);
  const addJob = useAppStore((s) => s.addJob);
  const flash = useAppStore((s) => s.flash);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Sub-jobs stay out of this office list — they're managed from the web job
  // details sidebar (their work requests still show on the Work Requests tab).
  const myJobs = useMemo(
    () =>
      (me ? jobsForFieldSuper(jobs, me.id) : []).filter(
        (job) => !job.parentJobId
      ),
    [jobs, me]
  );

  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.workRequestId)),
    [assignments]
  );

  const countsFor = (job: Job) => {
    const cards = workRequests.filter((c) => c.jobId === job.id);
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
        <Text style={styles.hint}>
          Tap a job to open it. Use the arrow to edit its address and flashing
          material.
        </Text>

        <ScrollView contentContainerStyle={styles.listContent}>
          {myJobs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="briefcase" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No jobs</Text>
              <Text style={styles.emptySubtitle}>
                Jobs the Operator assigns to you show up here.
              </Text>
            </View>
          ) : (
            myJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                counts={countsFor(job)}
                expanded={expandedId === job.id}
                onToggle={() =>
                  setExpandedId((id) => (id === job.id ? null : job.id))
                }
                onSave={(changes) => updateJob(job.id, changes)}
              />
            ))
          )}
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
  onSubmit: (input: {
    name: string;
    location: string;
    scopes?: JobScope[];
  }) => void;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [scopes, setScopes] = useState<JobScope[]>([]);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setName('');
    setLocation('');
    setScopes([]);
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
    onSubmit({
      name: name.trim(),
      location: location.trim(),
      scopes: scopes.length > 0 ? scopes : undefined,
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

          <FormInput
            label="Job name"
            value={name}
            onChangeText={setName}
            placeholder="Snyderville Commercial Complex"
            autoCapitalize="words"
          />
          <FormInput
            label="Jobsite address"
            value={location}
            onChangeText={setLocation}
            placeholder="123 Main St, Park City, UT"
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

function JobRow({
  job,
  counts,
  expanded,
  onToggle,
  onSave,
}: {
  job: Job;
  counts: { total: number; scheduled: number };
  expanded: boolean;
  onToggle: () => void;
  onSave: (changes: Partial<Job>) => void;
}) {
  const router = useRouter();
  const [location, setLocation] = useState(job.location);
  const [flashing, setFlashing] = useState(job.flashingMaterial ?? '');
  const windowsAllowed = jobAllowsWindows(job);
  // The count pairs this job's scopes cover — each edits done/total as text
  // (blank = unset), keyed by the done/total field names.
  const countDefs = editableCountDefs(job);
  const [countText, setCountText] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const def of JOB_COUNT_DEFS) {
      init[def.doneField] = numToText(job[def.doneField]);
      init[def.totalField] = numToText(job[def.totalField]);
    }
    return init;
  });
  const [saved, setSaved] = useState(false);

  const setCount = (field: string, text: string) => {
    setCountText((prev) => ({ ...prev, [field]: text }));
    setSaved(false);
  };

  const dirty =
    location.trim() !== job.location ||
    flashing.trim() !== (job.flashingMaterial ?? '') ||
    countDefs.some(
      (def) =>
        parseCount(countText[def.doneField]) !== job[def.doneField] ||
        parseCount(countText[def.totalField]) !== job[def.totalField]
    );

  const save = () => {
    const countChanges: Partial<Job> = {};
    for (const def of countDefs) {
      countChanges[def.doneField] = parseCount(countText[def.doneField]);
      countChanges[def.totalField] = parseCount(countText[def.totalField]);
    }
    onSave({
      location: location.trim(),
      flashingMaterial: flashing.trim(),
      ...countChanges,
    });
    setSaved(true);
  };

  const archived = job.status === 'Finished';

  return (
    <View style={[styles.card, archived && styles.cardArchived]}>
      {/* Tapping the row opens the job's details page; the chevron alone
          expands the inline address/flashing editor. */}
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
          <Text style={styles.cardTitle} numberOfLines={1}>
            {job.name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {counts.total} {counts.total === 1 ? 'work request' : 'work requests'} ·{' '}
            {counts.scheduled} on calendar
            {archived ? ' · Finished' : ''}
          </Text>
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
            label="Jobsite address"
            value={location}
            onChangeText={(text) => {
              setLocation(text);
              setSaved(false);
            }}
            placeholder="Street, city"
          />
          {/* Hidden entirely for jobs whose scopes exclude window work. */}
          {windowsAllowed && (
            <>
              <FormInput
                label="Flashing material"
                value={flashing}
                onChangeText={(text) => {
                  setFlashing(text);
                  setSaved(false);
                }}
                placeholder="e.g. regular rainbuster"
              />
              <FlashingPhotoField job={job} editable />
            </>
          )}
          {/* One done/total row per count pair the job's scopes cover. */}
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
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  cardSub: {
    color: colors.textSecondary,
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
  scopeField: {
    gap: spacing.sm,
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
