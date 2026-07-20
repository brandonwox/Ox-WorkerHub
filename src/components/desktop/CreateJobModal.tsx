import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { MultiCombobox } from '@/components/desktop/Combobox';
import { FieldSuperPicker } from '@/components/desktop/FieldSuperPicker';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { JOB_SCOPES, JobScope, Worker } from '@/types';

export interface NewJobInput {
  name: string;
  location: string;
  qbtJobcodeId?: string;
  fieldSuperIds: string[];
  /** Trade scopes the job covers; can also be added later from Edit job. */
  scopes?: JobScope[];
}

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));

interface Props {
  visible: boolean;
  /**
   * Who is creating: the Operator's full form (default), or the trimmed
   * 'field' form for Schedulers / Field Supers — no QBT jobcode (the Finance
   * Manager fills it in later) and no Field Super picker (a creating Field
   * Super is auto-assigned), but with a jobsite address input.
   */
  mode?: 'operator' | 'field';
  /** Roster of field supers the Operator can assign to this job. */
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
  const [location, setLocation] = useState('');
  const [qbtJobcodeId, setQbtJobcodeId] = useState('');
  const [scopes, setScopes] = useState<JobScope[]>([]);
  const [fieldSuperIds, setFieldSuperIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setLocation('');
    setQbtJobcodeId('');
    setScopes([]);
    setFieldSuperIds([]);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Job name is required.');
      return;
    }
    // Operator mode leaves the address to the Field Super; field mode offers
    // it right on the form (still optional — editable later either way).
    onSubmit({
      name: name.trim(),
      location: mode === 'field' ? location.trim() : '',
      qbtJobcodeId:
        mode === 'operator' ? qbtJobcodeId.trim() || undefined : undefined,
      fieldSuperIds: mode === 'operator' ? fieldSuperIds : [],
      scopes: scopes.length > 0 ? scopes : undefined,
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

          <FormInput
            label="Job name"
            value={name}
            onChangeText={setName}
            placeholder="Snyderville Commercial Complex"
            autoCapitalize="words"
          />
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

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Scopes</Text>
            <MultiCombobox
              values={scopes}
              options={SCOPE_OPTIONS}
              onChange={(vals) => setScopes(vals as JobScope[])}
              placeholder="Windows, Mirrors, Storefront…"
            />
            <Text style={styles.fieldHint}>
              The trades this job covers — more can be added later from Edit
              job. Without the Windows scope, the flashing material never shows
              for this job or its work requests.
            </Text>
          </View>

          {mode === 'operator' && (
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
