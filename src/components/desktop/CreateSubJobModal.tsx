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
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { JOB_SCOPES, Job, JobScope } from '@/types';
import { CountTotalField, JOB_COUNT_DEFS } from '@/utils/jobCounts';
import { subJobTypeSingular } from '@/utils/jobName';
import { PO_TAKEN_MESSAGE, poTaken } from '@/utils/jobPo';

// The count totals ride at the top level so the input can be handed straight
// to addSubJob (they're Job fields: windowCountTotal, sgdCountTotal, …).
export interface NewSubJobInput
  extends Partial<Record<CountTotalField, number>> {
  name: string;
  /** The sub-job's own PO number — required at creation, typed next to the name. */
  po: string;
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
 * name as a fixed, non-editable prefix, followed by the parent's sub-job type
 * in singular form ("Lot") when one is saved — the worker types only the
 * piece ("159") and the STORED name becomes type + piece ("Lot 159"; parents
 * with no saved type keep the old free-text naming). Address, scopes, and
 * flashing material arrive autofilled from the parent and stay editable. No
 * QBT jobcode here — the Finance Manager assigns those.
 */
export function CreateSubJobModal({ parentJob, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [po, setPo] = useState('');
  // Until the PO is typed into directly, it auto-fills as parent PO + the
  // typed name piece ("4500" + "126" → "4500126"); a manual edit takes over.
  const [poEdited, setPoEdited] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [scopes, setScopes] = useState<JobScope[] | null>(null);
  const [flashing, setFlashing] = useState<string | null>(null);
  // The sub-job's OWN count totals as typed, keyed by their Job field —
  // deliberately NOT prefilled from the parent (each sub-job carries its own
  // counts). Kept when a scope is toggled off (only selected scopes' values
  // are validated/submitted).
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

  // The count pairs the selected scopes require (Windows carries two: Window
  // + SGD; Storefront carries none) — same rule as the create-job forms.
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

  // Name keystrokes refresh the auto-PO ("Lot 126" ends up PO "MH 126" for
  // parent PO "MH" — a space joins the two, and the type prefix never enters
  // the PO) until the PO is edited by hand.
  const handleNameChange = (text: string) => {
    setName(text);
    if (poEdited) return;
    const parentPo = parentJob?.po?.trim() ?? '';
    const piece = text.trim();
    setPo(parentPo && piece ? `${parentPo} ${piece}` : parentPo + piece);
  };

  const close = () => {
    reset();
    onClose();
  };

  // The parent's sub-job type, singular ('' when the parent has none saved).
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
    // Every selected scope's count total is required (0 is fine — it just has
    // to be entered deliberately).
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
      // "159" typed under type "Lots" is stored as "Lot 159".
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
            {/* Name + PO share the line — both are required to create. */}
            <View style={styles.namePoRow}>
              <View style={styles.nameCol}>
                <Text style={styles.fieldLabel}>Sub-job name</Text>
                {/* The parent's name is a fixed prefix, not typed — the stored
                    name is only what the worker enters after it. */}
                <View style={styles.nameRow}>
                  <View style={styles.prefixChip}>
                    <Text style={styles.prefixText} numberOfLines={1}>
                      {parentJob.name}
                    </Text>
                  </View>
                  {/* The saved sub-job type leads the typed piece — the
                      stored name becomes "Lot 159". */}
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
                        ? `Which ${typePrefix.toLowerCase()} is this?`
                        : 'Lot 2, Phase 3, Building B…'
                    }
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                  />
                </View>
              </View>
              <View style={styles.poCol}>
                <Text style={styles.fieldLabel}>PO</Text>
                <TextInput
                  style={styles.poInput}
                  value={po}
                  onChangeText={(t) => {
                    setPo(t);
                    setPoEdited(true);
                  }}
                  placeholder="e.g. 4501"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>
            <Text style={styles.fieldHint}>
              {typePrefix
                ? `No need to type “${parentJob.name}” or “${typePrefix}” — both are added automatically.`
                : `No need to type “${parentJob.name}” — it shows in front of the sub-job’s name automatically where it matters.`}
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
            {/* Each selected scope requires the SUB-JOB's own count total up
                front (the Windows scope carries two — Window + SGD). Never
                prefilled from the parent. */}
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
                  How many of each this sub-job covers — its own numbers, not
                  the parent&apos;s. Required for the selected scopes (0 is
                  fine).
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
      // Wide enough that the name row (parent chip + type chip + input) has
      // room even for long parent job names.
      maxWidth: 760,
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
    namePoRow: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    nameCol: {
      flex: 1,
      gap: spacing.xs + 2,
    },
    poCol: {
      width: 130,
      gap: spacing.xs + 2,
    },
    poInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
      outlineWidth: 0,
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
      // Shrinks (with ellipsis) only when the row runs out of room — the
      // input's minWidth is what forces it, so it never clips mid-word
      // otherwise. minWidth 0 lets the text actually ellipsize on web.
      flexShrink: 1,
      minWidth: 0,
    },
    prefixText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    // The sub-job type chip rides next to the parent-name chip, same look —
    // but never shrinks (it's short and must stay readable; the parent chip
    // gives way instead).
    typeChip: {
      flexShrink: 0,
    },
    nameInput: {
      flex: 1,
      // Keeps typing room when a long parent name would eat the row — the
      // prefix chip ellipsizes past this point instead.
      minWidth: 150,
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
