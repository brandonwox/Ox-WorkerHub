import { format, isValid, parse } from 'date-fns';
import { Check, Search, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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

import { FormInput } from '@/components/FormInput';
import { TimeField } from '@/components/TimeField';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { TimesheetLog } from '@/types';
import { formatLogDate, formatTime, parseTimeInput } from '@/utils/time';

interface Props {
  log: TimesheetLog | null;
  /** Current project title for the timecard, used to seed the project field. */
  projectName: string;
  onClose: () => void;
}

export function EditLogModal({ log, projectName, onClose }: Props) {
  const workRequests = useAppStore((s) => s.workRequests);
  const updateLog = useAppStore((s) => s.updateLog);
  const deleteLog = useAppStore((s) => s.deleteLog);

  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (log) {
      setQuery(projectName);
      setSelectedJobId(log.workRequestId ?? null);
      setStartDate(format(new Date(log.startTime), 'yyyy-MM-dd'));
      setStartTime(formatTime(log.startTime));
      setEndDate(format(new Date(log.endTime), 'yyyy-MM-dd'));
      setEndTime(formatTime(log.endTime));
      setError(null);
    }
  }, [log, projectName]);

  const trimmed = query.trim();
  const matches =
    trimmed && !selectedJobId
      ? workRequests.filter((j) =>
          j.title.toLowerCase().includes(trimmed.toLowerCase())
        )
      : [];

  const pickJob = (jobId: string, title: string) => {
    setSelectedJobId(jobId);
    setQuery(title);
  };

  const save = () => {
    if (!log) return;
    if (!trimmed) {
      setError('Choose a project or type a name.');
      return;
    }
    const sDate = parse(startDate.trim(), 'yyyy-MM-dd', new Date());
    const eDate = parse(endDate.trim(), 'yyyy-MM-dd', new Date());
    if (!isValid(sDate) || !isValid(eDate)) {
      setError('Enter dates as YYYY-MM-DD.');
      return;
    }
    const start = parseTimeInput(startTime, format(sDate, 'yyyy-MM-dd'));
    const end = parseTimeInput(endTime, format(eDate, 'yyyy-MM-dd'));
    if (!start || !end) {
      setError('Enter times like "7:30 AM" or "15:45".');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setError('End must be after start.');
      return;
    }
    updateLog(log.id, {
      date: format(sDate, 'yyyy-MM-dd'),
      workRequestId: selectedJobId ?? undefined,
      customProjectName: selectedJobId ? undefined : trimmed,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    onClose();
  };

  const remove = () => {
    if (!log) return;
    deleteLog(log.id);
    onClose();
  };

  return (
    <Modal
      visible={log !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {trimmed || 'Timecard'}
            </Text>
            <Pressable
              onPress={remove}
              hitSlop={8}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deletePressed,
              ]}
            >
              <Trash2 size={18} color={colors.danger} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            <Text style={styles.fieldLabel}>Project</Text>
            <View style={styles.inputRow}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setSelectedJobId(null);
                }}
                placeholder="Search jobs or type a custom name…"
                placeholderTextColor={colors.textTertiary}
              />
              {selectedJobId ? (
                <Check size={18} color={colors.success} />
              ) : trimmed.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={16} color={colors.textTertiary} />
                </Pressable>
              ) : null}
            </View>

            {matches.length > 0 && (
              <View style={styles.results}>
                {matches.map((job) => (
                  <Pressable
                    key={job.id}
                    style={({ pressed }) => [
                      styles.result,
                      pressed && styles.resultPressed,
                    ]}
                    onPress={() => pickJob(job.id, job.title)}
                  >
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {job.title}
                    </Text>
                    <Text style={styles.resultSubtitle}>
                      {formatLogDate(job.date)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {!selectedJobId && trimmed.length > 0 && matches.length === 0 && (
              <Text style={styles.customHint}>
                Will be saved as custom project “{trimmed}”.
              </Text>
            )}

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <FormInput
                  label="Start date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.timeField}>
                <TimeField
                  label="Start time"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="7:00 AM"
                />
              </View>
            </View>

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <FormInput
                  label="End date"
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.timeField}>
                <TimeField
                  label="End time"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="3:30 PM"
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg + 4,
    borderTopRightRadius: radii.lg + 4,
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerDim,
  },
  deletePressed: {
    opacity: 0.7,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: spacing.lg,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginBottom: -spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  results: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  result: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  resultPressed: {
    backgroundColor: colors.surfaceLight,
  },
  resultTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  resultSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  customHint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: -spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeField: {
    flex: 1,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg - 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  saveText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
}));
