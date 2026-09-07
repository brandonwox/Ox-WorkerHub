import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
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

import type { NewSubJobInput } from '@/components/desktop/CreateSubJobModal';
import { FormInput } from '@/components/FormInput';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { JOB_SCOPES, Job, JobScope } from '@/types';
import { CountTotalField, JOB_COUNT_DEFS } from '@/utils/jobCounts';
import { subJobTypeSingular } from '@/utils/jobName';
import { PO_TAKEN_MESSAGE, poTaken } from '@/utils/jobPo';

interface Props {
  /** The parent job the sub-job goes under, or null when the sheet is closed. */
  parentJob: Job | null;
  onClose: () => void;
  onSubmit: (input: NewSubJobInput) => void;
}

/**
 * Phone-layout sub-job creation — the mobile port of the web
 * CreateSubJobModal with the same rules: the parent's name is a fixed prefix
 * (never typed), the parent's saved sub-job type leads the typed piece so
 * "159" under "Lots" is stored as "Lot 159", and the PO auto-fills as parent
 * PO + piece until edited by hand. Address, scopes, and flashing material
 * arrive autofilled from the parent and stay editable (scopes as chips, the
 * phone's picker); each selected scope requires the sub-job's OWN count
 * total. No QBT jobcode — the Finance Manager assigns those.
 */
export function CreateSubJobSheet({ parentJob, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [po, setPo] = useState('');
  const [poEdited, setPoEdited] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [scopes, setScopes] = useState<JobScope[] | null>(null);
  const [flashing, setFlashing] = useState<string | null>(null);
  // Count totals as typed, keyed by their Job field — kept when a scope is
  // toggled off (only selected scopes' values are validated/submitted).
  const [totals, setTotals] = useState<
    Partial<Record<CountTotalField, string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  // For the duplicate-PO check (archived jobs included).
  const jobs = useAppStore((s) => s.jobs);

  // Autofill from the parent until the worker edits a field.
  const effectiveLocation = location ?? parentJob?.location ?? '';
  const effectiveScopes = scopes ?? parentJob?.scopes ?? [];
  const effectiveFlashing = flashing ?? parentJob?.flashingMaterial ?? '';

  const countDefs = JOB_COUNT_DEFS.filter((def) =>
    effectiveScopes.includes(def.scope)
  );

  const reset = () => {
    setName('');
    setPo('');
    setPoEdited(false);
    setLocation(null);
    setScopes(null);
    setFlashing(null);
    setTotals({});
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  // Name keystrokes refresh the auto-PO ("126" under parent PO "4500" → PO
  // "4500 126"; the type prefix never enters it) until the PO is edited.
  const handleNameChange = (text: string) => {
    setName(text);
    if (poEdited) return;
    const parentPo = parentJob?.po?.trim() ?? '';
    const piece = text.trim();
    setPo(parentPo && piece ? `${parentPo} ${piece}` : parentPo + piece);
  };

  const toggleScope = (scope: JobScope) =>
    setScopes(
      effectiveScopes.includes(scope)
        ? effectiveScopes.filter((s) => s !== scope)
        : [...effectiveScopes, scope]
    );

  const typePrefix = subJobTypeSingular(parentJob?.subJobType);

  const submit = () => {
    if (!name.trim()) {
      setError('Sub-job name is required.');
      return;
    }
    if (!po.trim()) {
      setError('PO is required.');
      return;
    }
    if (poTaken(po, jobs)) {
      setError(PO_TAKEN_MESSAGE);
      return;
    }
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
      name: typePrefix ? `${typePrefix} ${name.trim()}` : name.trim(),
      po: po.trim(),
      location: effectiveLocation.trim(),
      scopes: effectiveScopes.length > 0 ? effectiveScopes : undefined,
      flashingMaterial: effectiveFlashing.trim() || undefined,
      ...countTotals,
    });
    close();
  };

  if (!parentJob) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>New Sub-Job</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
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
                {typePrefix ? (
                  <View style={[styles.prefixChip, styles.typeChip]}>
                    <Text style={styles.prefixText} numberOfLines={1}>
                      {typePrefix}
                    </Text>
                  </View>
                ) : null}
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={handleNameChange}
                  placeholder={
                    typePrefix
                      ? `Which ${typePrefix.toLowerCase()}?`
                      : 'Lot 2, Phase 3…'
                  }
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                />
              </View>
              <Text style={styles.fieldHint}>
                {typePrefix
                  ? `No need to type “${parentJob.name}” or “${typePrefix}” — both are added automatically.`
                  : `No need to type “${parentJob.name}” — it shows in front of the sub-job’s name automatically.`}
              </Text>
            </View>

            <FormInput
              label="PO"
              value={po}
              onChangeText={(t) => {
                setPo(t);
                setPoEdited(true);
              }}
              placeholder="e.g. 4501"
              autoCapitalize="none"
            />

            <FormInput
              label="Jobsite address"
              value={effectiveLocation}
              onChangeText={setLocation}
              placeholder="123 Main St, Park City, UT"
            />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Scopes</Text>
              <View style={styles.scopeChips}>
                {JOB_SCOPES.map((scope) => {
                  const active = effectiveScopes.includes(scope);
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
              {/* Each selected scope requires the SUB-JOB's own count total
                  up front. Never prefilled from the parent. */}
              {countDefs.length > 0 && (
                <>
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
                  <Text style={styles.fieldHint}>
                    How many of each this sub-job covers — its own numbers,
                    not the parent&apos;s. Required for the selected scopes
                    (0 is fine).
                  </Text>
                </>
              )}
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
              job&apos;s. Field Supers carry over from the parent
              automatically; the Finance Manager assigns the QBT jobcode later.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              onPress={close}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
              ]}
              onPress={submit}
            >
              <Text style={styles.submitText}>Create sub-job</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '92%',
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
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
      fontSize: 18,
    },
    body: {
      gap: spacing.lg,
    },
    pressed: {
      opacity: 0.6,
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
      // Ellipsizes only when the input's minWidth forces it.
      flexShrink: 1,
      minWidth: 0,
    },
    prefixText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    // The type chip is short and must stay readable — the parent chip gives
    // way instead.
    typeChip: {
      flexShrink: 0,
    },
    nameInput: {
      flex: 1,
      minWidth: 110,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
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
    countGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    countCell: {
      flexGrow: 1,
      flexBasis: '40%',
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
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    submitButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    submitText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 14,
    },
  })
);
