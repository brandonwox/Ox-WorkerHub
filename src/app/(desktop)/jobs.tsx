import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CreateJobModal, NewJobInput } from '@/components/desktop/CreateJobModal';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { Toast } from '@/components/Toast';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Job, JobStatus } from '@/types';

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Archived', label: 'Archived' },
];

export default function JobsScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const addJob = useAppStore((s) => s.addJob);
  const updateJob = useAppStore((s) => s.updateJob);

  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (role !== 'operator') return <AccessDenied />;

  const handleCreate = (input: NewJobInput) => {
    addJob(input);
    setToast(`Job "${input.name}" created`);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} ·{' '}
            {jobs.filter((j) => j.status === 'Active').length} active
          </Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={() => setCreateOpen(true)}
          >
            <Feather name="plus" size={16} color={colors.textPrimary} />
            <Text style={styles.addButtonText}>Create job</Text>
          </Pressable>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.cell, styles.colName, styles.headText]}>Job</Text>
            <Text style={[styles.cell, styles.colLocation, styles.headText]}>
              Location
            </Text>
            <Text style={[styles.cell, styles.colCode, styles.headText]}>
              QBT Jobcode
            </Text>
            <Text style={[styles.cell, styles.colFlashing, styles.headText]}>
              Window Opening Flashing
            </Text>
            <Text style={[styles.cell, styles.colStatus, styles.headText]}>
              Status
            </Text>
          </View>

          {jobs.map((job, index) => (
            <View key={job.id} style={[styles.row, { zIndex: jobs.length - index }]}>
              <View style={[styles.cell, styles.colName]}>
                <Text style={styles.name} numberOfLines={1}>
                  {job.name}
                </Text>
              </View>
              <View style={[styles.cell, styles.colLocation]}>
                <Text style={styles.location} numberOfLines={2}>
                  {job.location}
                </Text>
              </View>
              <View style={[styles.cell, styles.colCode]}>
                <JobcodeCell
                  job={job}
                  onCommit={(qbtJobcodeId) => updateJob(job.id, { qbtJobcodeId })}
                />
              </View>
              <View style={[styles.cell, styles.colFlashing]}>
                <FlashingCell
                  job={job}
                  onCommit={(flashingMaterial) =>
                    updateJob(job.id, { flashingMaterial })
                  }
                />
              </View>
              <View style={[styles.cell, styles.colStatus]}>
                <InlineSelect
                  value={job.status}
                  options={STATUS_OPTIONS}
                  onChange={(status) => updateJob(job.id, { status })}
                  minWidth={120}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Toast message={toast} onDone={() => setToast(null)} />

      <CreateJobModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </View>
  );
}

/** Inline editable QBT jobcode mapping; commits on blur. */
function JobcodeCell({
  job,
  onCommit,
}: {
  job: Job;
  onCommit: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(job.qbtJobcodeId ?? '');

  const commit = () => {
    const trimmed = text.trim();
    onCommit(trimmed || undefined);
  };

  const unmapped = !job.qbtJobcodeId;

  return (
    <View style={[styles.codeWrap, unmapped && styles.codeWrapUnmapped]}>
      <TextInput
        style={styles.codeInput}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onEndEditing={commit}
        placeholder="unmapped"
        placeholderTextColor={colors.warning}
        autoCapitalize="none"
      />
    </View>
  );
}

/** Inline editable site-wide flashing material; commits on blur. */
function FlashingCell({
  job,
  onCommit,
}: {
  job: Job;
  onCommit: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(job.flashingMaterial ?? '');

  const commit = () => {
    const trimmed = text.trim();
    onCommit(trimmed || undefined);
  };

  return (
    <View style={styles.codeWrap}>
      <TextInput
        style={styles.flashInput}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onEndEditing={commit}
        placeholder="not set"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 1100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  pressed: {
    opacity: 0.85,
  },
  addButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  table: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headRow: {
    backgroundColor: colors.surfaceLight,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  headText: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cell: {
    paddingRight: spacing.md,
    justifyContent: 'center',
  },
  colName: {
    flex: 2.4,
  },
  colLocation: {
    flex: 2.6,
  },
  colCode: {
    flex: 1.6,
  },
  colFlashing: {
    flex: 2.4,
  },
  colStatus: {
    flex: 1.5,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  location: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  codeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  codeWrapUnmapped: {
    borderColor: colors.warningDim,
  },
  codeInput: {
    minWidth: 90,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    outlineWidth: 0,
  },
  flashInput: {
    minWidth: 120,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    outlineWidth: 0,
  },
});
