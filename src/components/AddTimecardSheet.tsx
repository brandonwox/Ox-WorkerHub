import { format, isValid, parse } from 'date-fns';
import { Check, Search, X } from 'lucide-react-native';
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
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { formatLogDate, parseTimeInput } from '@/utils/time';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Bottom sheet for adding a timecard by hand: pick a project (by search, or
 * type a custom name) and enter the date plus start and end times.
 */
export function AddTimecardSheet({ visible, onClose }: Props) {
  const jobs = useAppStore((s) => s.jobs);
  const addLog = useAppStore((s) => s.addLog);

  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [dateText, setDateText] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedJobId(null);
      setDateText(format(new Date(), 'yyyy-MM-dd'));
      setStartText('');
      setEndText('');
      setError(null);
    }
  }, [visible]);

  const trimmed = query.trim();
  const matches =
    trimmed && !selectedJobId
      ? jobs.filter((j) => j.title.toLowerCase().includes(trimmed.toLowerCase()))
      : [];

  const pickJob = (jobId: string, title: string) => {
    setSelectedJobId(jobId);
    setQuery(title);
  };

  const save = () => {
    if (!trimmed) {
      setError('Choose a project or type a name.');
      return;
    }
    const date = parse(dateText.trim(), 'yyyy-MM-dd', new Date());
    if (!isValid(date)) {
      setError('Enter the date as YYYY-MM-DD.');
      return;
    }
    const dateStr = format(date, 'yyyy-MM-dd');
    const start = parseTimeInput(startText, dateStr);
    const end = parseTimeInput(endText, dateStr);
    if (!start || !end) {
      setError('Enter times like "7:30 AM" or "15:45".');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setError('End time must be after start time.');
      return;
    }
    addLog({
      jobId: selectedJobId ?? undefined,
      customProjectName: selectedJobId ? undefined : trimmed,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
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
          <Text style={styles.title}>Add Timecard</Text>

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
              ) : trimmed ? (
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

            <FormInput
              label="Date"
              value={dateText}
              onChangeText={setDateText}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <FormInput
                  label="Start time"
                  value={startText}
                  onChangeText={setStartText}
                  placeholder="7:00 AM"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.timeField}>
                <FormInput
                  label="End time"
                  value={endText}
                  onChangeText={setEndText}
                  placeholder="3:30 PM"
                  autoCapitalize="characters"
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
              <Text style={styles.saveText}>Add Timecard</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
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
    flex: 2,
    alignItems: 'center',
    paddingVertical: spacing.lg - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  saveText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
