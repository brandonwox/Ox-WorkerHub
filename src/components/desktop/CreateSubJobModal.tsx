import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MultiCombobox } from '@/components/desktop/Combobox';
import { FormInput } from '@/components/FormInput';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { JOB_SCOPES, Job, JobScope } from '@/types';

export interface NewSubJobInput {
  name: string;
  location: string;
  scopes?: JobScope[];
  flashingMaterial?: string;
}

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));

interface Props {
  /** The parent job the sub-job goes under, or null when the modal is closed. */
  parentJob: Job | null;
  onClose: () => void;
  onSubmit: (input: NewSubJobInput) => void;
}

/**
 * Create a sub-job under a parent job. The name field leads with the parent's
 * name as a fixed, non-editable prefix — the worker types only the piece
 * ("Lot 2", "Phase 3"); the sub-job's STORED name is just that piece. Address,
 * scopes, and flashing material arrive autofilled from the parent and stay
 * editable. No QBT jobcode here — the Finance Manager assigns those.
 */
export function CreateSubJobModal({ parentJob, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [scopes, setScopes] = useState<JobScope[] | null>(null);
  const [flashing, setFlashing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Autofill from the parent until the worker edits a field.
  const effectiveLocation = location ?? parentJob?.location ?? '';
  const effectiveScopes = scopes ?? parentJob?.scopes ?? [];
  const effectiveFlashing = flashing ?? parentJob?.flashingMaterial ?? '';

  const reset = () => {
    setName('');
    setLocation(null);
    setScopes(null);
    setFlashing(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Sub-job name is required.');
      return;
    }
    onSubmit({
      name: name.trim(),
      location: effectiveLocation.trim(),
      scopes: effectiveScopes.length > 0 ? effectiveScopes : undefined,
      flashingMaterial: effectiveFlashing.trim() || undefined,
    });
    close();
  };

  if (!parentJob) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>New Sub-Job</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Sub-job name</Text>
            {/* The parent's name is a fixed prefix, not typed — the stored
                name is only what the worker enters after it. */}
            <View style={styles.nameRow}>
              <View style={styles.prefixChip}>
                <Text style={styles.prefixText} numberOfLines={1}>
                  {parentJob.name}
                </Text>
              </View>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Lot 2, Phase 3, Building B…"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            </View>
            <Text style={styles.fieldHint}>
              No need to type “{parentJob.name}” — it shows in front of the
              sub-job&apos;s name automatically where it matters.
            </Text>
          </View>

          <FormInput
            label="Jobsite address"
            value={effectiveLocation}
            onChangeText={setLocation}
            placeholder="123 Main St, Park City, UT"
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Scopes</Text>
            <MultiCombobox
              values={effectiveScopes}
              options={SCOPE_OPTIONS}
              onChange={(vals) => setScopes(vals as JobScope[])}
              placeholder="Windows, Mirrors, Storefront…"
            />
          </View>

          {effectiveScopes.includes('Windows') && (
            <FormInput
              label="Window Opening Flashing Material"
              value={effectiveFlashing}
              onChangeText={setFlashing}
              placeholder="e.g. regular rainbuster"
            />
          )}

          <Text style={styles.fieldHint}>
            Address, scopes, and flashing material start as the parent
            job&apos;s. Field Supers carry over from the parent automatically;
            the Finance Manager assigns the QBT jobcode later.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitText}>Create sub-job</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    card: {
      width: '100%',
      maxWidth: 620,
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 20,
    },
    field: {
      gap: spacing.xs + 2,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    fieldHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    prefixChip: {
      backgroundColor: colors.surfaceLight,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      maxWidth: '55%',
    },
    prefixText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    nameInput: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
      outlineWidth: 0,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md + 2,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 15,
    },
    submitButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    submitText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 15,
    },
  })
);
