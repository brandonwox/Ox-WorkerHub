import { Play, Search } from 'lucide-react-native';
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

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { activeWorkRequests } from '@/utils/jobArchive';
import { formatJobWindow, formatLogDate } from '@/utils/time';

export type ClockEntryMode = 'custom' | 'search' | null;

interface Props {
  mode: ClockEntryMode;
  /**
   * When true, choosing a project reassigns the in-progress shift instead of
   * starting a new one (used by the clocked-in "edit shift" flow).
   */
  editing?: boolean;
  onClose: () => void;
}

/**
 * Bottom sheet for the two expanded project options: "Custom" (type a project
 * name) and "Search" (find any job by name). Used both to clock in and — when
 * `editing` is set — to switch the project of the in-progress shift.
 */
export function ClockEntrySheet({ mode, editing, onClose }: Props) {
  const workRequests = useAppStore((s) => s.workRequests);
  const jobs = useAppStore((s) => s.jobs);
  const clockIn = useAppStore((s) => s.clockIn);
  const updateShiftProject = useAppStore((s) => s.updateShiftProject);
  const [text, setText] = useState('');

  const applyProject = editing ? updateShiftProject : clockIn;

  useEffect(() => {
    if (mode) setText('');
  }, [mode]);

  const startCustom = () => {
    const name = text.trim();
    if (!name) return;
    applyProject({ customProjectName: name });
    onClose();
  };

  const startWorkRequest = (workRequestId: string) => {
    applyProject({ workRequestId });
    onClose();
  };

  const query = text.trim().toLowerCase();
  // Archived jobs' cards aren't offered for clocking in.
  const matches =
    mode === 'search' && query
      ? activeWorkRequests(workRequests, jobs).filter((j) =>
          j.title.toLowerCase().includes(query)
        )
      : [];

  return (
    <Modal
      visible={mode !== null}
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
          <Text style={styles.title}>
            {mode === 'search'
              ? editing
                ? 'Switch Job'
                : 'Search Jobs'
              : 'Custom Project'}
          </Text>

          <View style={styles.inputRow}>
            {mode === 'search' && (
              <Search size={16} color={colors.textTertiary} />
            )}
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={
                mode === 'search'
                  ? 'Type a job name…'
                  : 'e.g. Shop Fabrication'
              }
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType={mode === 'custom' ? 'done' : 'search'}
              onSubmitEditing={mode === 'custom' ? startCustom : undefined}
            />
          </View>

          {mode === 'custom' ? (
            <Pressable
              style={[
                styles.startButton,
                !text.trim() && styles.startButtonDisabled,
              ]}
              onPress={startCustom}
              disabled={!text.trim()}
            >
              <Text style={styles.startButtonText}>
                {editing ? 'Switch Project' : 'Start Shift'}
              </Text>
            </Pressable>
          ) : (
            <ScrollView
              style={styles.results}
              keyboardShouldPersistTaps="handled"
            >
              {query.length === 0 ? (
                <Text style={styles.hint}>Start typing to find a job.</Text>
              ) : matches.length === 0 ? (
                <Text style={styles.hint}>No jobs match “{text.trim()}”.</Text>
              ) : (
                matches.map((job) => (
                  <Pressable
                    key={job.id}
                    style={({ pressed }) => [
                      styles.result,
                      pressed && styles.resultPressed,
                    ]}
                    onPress={() => startWorkRequest(job.id)}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {job.title}
                      </Text>
                      <Text style={styles.resultSubtitle}>
                        {formatLogDate(job.date)}
                        {formatJobWindow(job.startTime, job.endTime)
                          ? ` · ${formatJobWindow(job.startTime, job.endTime)}`
                          : ''}
                      </Text>
                    </View>
                    <Play size={18} color={colors.primary} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
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
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  results: {
    maxHeight: 260,
  },
  hint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  resultPressed: {
    backgroundColor: colors.border,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
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
}));
