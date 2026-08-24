import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FormInput } from '@/components/FormInput';
import { Combobox, MultiCombobox } from '@/components/desktop/Combobox';
import { FieldSuperPicker } from '@/components/desktop/FieldSuperPicker';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { JOB_SCOPES, JobScope, Worker } from '@/types';
import { CountTotalField, JOB_COUNT_DEFS } from '@/utils/jobCounts';
import { SUB_JOB_TYPE_PRESETS } from '@/utils/jobName';
import { PO_TAKEN_MESSAGE, poTaken } from '@/utils/jobPo';

// The count totals ride at the top level so the input can be handed straight
// to addJob (they're Job fields: windowCountTotal, sgdCountTotal, …).
export interface NewJobInput extends Partial<Record<CountTotalField, number>> {
  name: string;
  /** The job's PO number — required at creation, typed next to the name. */
  po: string;
  location: string;
  qbtJobcodeId?: string;
  fieldSuperIds: string[];
  /** Trade scopes the job covers; can also be added later from Edit job. */
  scopes?: JobScope[];
  /** The builder/GC the job is for — optional, also editable later. */
  builder?: string;
  /** "This job has Sub-Jobs" — always paired with {@link subJobType}. */
  hasSubJobs?: boolean;
  /** What the sub-jobs are called ("Lots", …) — drives naming ("Lot 159"). */
  subJobType?: string;
}

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));

interface Props {
  visible: boolean;
  /**
   * Who is creating: the Operator's full form (default), or the trimmed
   * 'field' form for Schedulers / Field Supers — no QBT jobcode (the Finance
   * Manager fills it in later), but with a jobsite address input.
   */
  mode?: 'operator' | 'field';
  /**
   * Roster of field supers the creator can assign to this job. Passing a
   * non-empty roster shows the picker — the Operator always does; Schedulers
   * do too (they may assign supers at creation; RLS matches). Field Super
   * callers omit it (a creating Field Super is auto-assigned).
   */
  fieldSupers?: Worker[];
  onClose: () => void;
  onSubmit: (job: NewJobInput) => void;
}

export function CreateJobModal({
  visible,
  mode = 'operator',
  fieldSupers = [],
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [po, setPo] = useState('');
  const [location, setLocation] = useState('');
  const [qbtJobcodeId, setQbtJobcodeId] = useState('');
  const [builder, setBuilder] = useState('');
  const [scopes, setScopes] = useState<JobScope[]>([]);
  // Count totals as typed, keyed by their Job field. Kept even when a scope
  // is deselected (only selected scopes' values are validated/submitted), so
  // toggling a scope back doesn't lose the number.
  const [totals, setTotals] = useState<
    Partial<Record<CountTotalField, string>>
  >({});
  const [fieldSuperIds, setFieldSuperIds] = useState<string[]>([]);
  // "This job has Sub-Jobs": checking the row opens the required
  // what-are-they-called picker; a type must be chosen to create.
  const [subJobsOn, setSubJobsOn] = useState(false);
  const [subJobType, setSubJobType] = useState<string | null>(null);
  const [customSubJobType, setCustomSubJobType] = useState('');
  const [error, setError] = useState<string | null>(null);
  // For the duplicate-PO check (archived jobs included).
  const jobs = useAppStore((s) => s.jobs);

  // Every builder ever applied to a job — same options as the job details
  // sidebar's Builder field; typing something new adds it.
  const builderOptions = useMemo(() => {
    const names = new Set<string>();
    jobs.forEach((j) => {
      const b = j.builder?.trim();
      if (b) names.add(b);
    });
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((b) => ({ value: b, label: b }));
  }, [jobs]);

  // The count pairs the selected scopes require (Windows carries two: Window
  // + SGD; Storefront carries none).
  const countDefs = JOB_COUNT_DEFS.filter((def) => scopes.includes(def.scope));

  const reset = () => {
    setName('');
    setPo('');
    setLocation('');
    setQbtJobcodeId('');
    setBuilder('');
    setScopes([]);
    setTotals({});
    setFieldSuperIds([]);
    setSubJobsOn(false);
    setSubJobType(null);
    setCustomSubJobType('');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  // The picker shows whenever a roster was passed (Operator and Schedulers).
  const showFieldSuperPicker = fieldSupers.length > 0;

  const submit = () => {
    if (!name.trim()) {
      setError('Job name is required.');
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
    // Sub-jobs enabled → a type is required (it drives sub-job naming).
    if (subJobsOn && !subJobType) {
      setError('Choose what the sub-jobs are called (Lots, Phases, …).');
      return;
    }
    // Operator mode leaves the address to the Field Super; field mode offers
    // it right on the form (still optional — editable later either way).
    onSubmit({
      name: name.trim(),
      po: po.trim(),
      location: mode === 'field' ? location.trim() : '',
      qbtJobcodeId:
        mode === 'operator' ? qbtJobcodeId.trim() || undefined : undefined,
      builder: builder.trim() || undefined,
      fieldSuperIds: showFieldSuperPicker ? fieldSuperIds : [],
      scopes: scopes.length > 0 ? scopes : undefined,
      hasSubJobs: subJobsOn && subJobType != null ? true : undefined,
      subJobType: subJobsOn && subJobType != null ? subJobType : undefined,
      ...countTotals,
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Create job</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Name + PO share the line — both are required to create. */}
          <View style={styles.nameRow}>
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
          {mode === 'operator' ? (
            <FormInput
              label="QuickBooks Time jobcode ID"
              value={qbtJobcodeId}
              onChangeText={setQbtJobcodeId}
              placeholder="e.g. 90112 — maps hours to QBT"
              autoCapitalize="none"
            />
          ) : (
            <>
              <FormInput
                label="Jobsite address"
                value={location}
                onChangeText={setLocation}
                placeholder="123 Main St, Park City, UT"
              />
              <Text style={styles.fieldHint}>
                The QuickBooks Time jobcode ID is filled in later by the
                Finance Manager.
              </Text>
            </>
          )}

          {/* Builder — dropdown of every builder used on a past job; typing
              something new adds it. Optional, also editable later. */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Builder (optional)</Text>
            <Combobox
              value={builder}
              options={builderOptions}
              allowCustom
              placeholder="Type to search or add a builder…"
              onChange={setBuilder}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Scopes</Text>
            <MultiCombobox
              values={scopes}
              options={SCOPE_OPTIONS}
              onChange={(vals) => setScopes(vals as JobScope[])}
              placeholder="Windows, Mirrors, Storefront…"
            />
            <Text style={styles.fieldHint}>
              The trades this job covers — more can be added later.
            </Text>
            {/* Each selected scope requires its count total up front (the
                Windows scope carries two — Window + SGD). */}
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
                  How many of each the job covers — required for the selected
                  scopes (0 is fine). Installers tick the done numbers up from
                  the field.
                </Text>
              </>
            )}
          </View>

          {/* "This job has Sub-Jobs" — enabling requires choosing what the
              sub-jobs are called (it drives sub-job naming: "Lot 159"). Same
              option as the job details sidebar's edit mode. */}
          <View style={styles.field}>
            <Pressable
              style={({ pressed }) => [
                styles.optionRow,
                pressed && styles.optionRowPressed,
              ]}
              onPress={() =>
                setSubJobsOn((on) => {
                  // Unchecking clears the choice so a re-check starts fresh.
                  if (on) {
                    setSubJobType(null);
                    setCustomSubJobType('');
                  }
                  return !on;
                })
              }
            >
              <Feather
                name={subJobsOn ? 'check-square' : 'square'}
                size={18}
                color={subJobsOn ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.optionRowText}>This job has Sub-Jobs</Text>
            </Pressable>
            {subJobsOn && (
              <View style={styles.subJobTypeBlock}>
                <Text style={styles.fieldHint}>
                  What are the sub-jobs called? Used when naming new ones
                  (&ldquo;Lot 159&rdquo;).
                </Text>
                <View style={styles.typeChipRow}>
                  {[
                    ...SUB_JOB_TYPE_PRESETS,
                    // A committed custom term renders as its own (active) chip.
                    ...(subJobType &&
                    !(SUB_JOB_TYPE_PRESETS as readonly string[]).includes(
                      subJobType
                    )
                      ? [subJobType]
                      : []),
                  ].map((type) => {
                    const active = subJobType === type;
                    return (
                      <Pressable
                        key={type}
                        style={({ pressed }) => [
                          styles.typeChip,
                          active && styles.typeChipActive,
                          pressed && styles.optionRowPressed,
                        ]}
                        onPress={() => setSubJobType(type)}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            active && styles.typeChipTextActive,
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
                  placeholder="Custom term — press Enter to use it"
                  placeholderTextColor={colors.textTertiary}
                  onSubmitEditing={() => {
                    const t = customSubJobType.trim();
                    if (t) {
                      setSubJobType(t);
                      setCustomSubJobType('');
                    }
                  }}
                />
              </View>
            )}
          </View>

          {showFieldSuperPicker && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Field supers</Text>
              <FieldSuperPicker
                fieldSupers={fieldSupers}
                selected={fieldSuperIds}
                onToggle={(id) =>
                  setFieldSuperIds((ids) =>
                    ids.includes(id)
                      ? ids.filter((x) => x !== id)
                      : [...ids, id]
                  )
                }
              />
              <Text style={styles.fieldHint}>
                Assigned field supers see this job and its work requests. You can
                pick more than one.
              </Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitText}>Create job</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
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
  nameRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  nameCol: {
    flex: 2,
  },
  poCol: {
    flex: 1,
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
  // "This job has Sub-Jobs" row + its type picker — same look as the job
  // details sidebar's edit-mode option.
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  optionRowPressed: {
    opacity: 0.85,
  },
  optionRowText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  subJobTypeBlock: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  typeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  typeChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  typeChipTextActive: {
    color: colors.primary,
  },
  customTypeInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 13,
    outlineWidth: 0,
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
}));
