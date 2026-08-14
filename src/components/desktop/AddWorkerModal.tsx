import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { ROLE_LABELS } from '@/roles';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { AppRole } from '@/types';

export interface NewWorkerInput {
  name: string;
  email: string;
  /** Required for Field Supers (shown to installers on work requests). */
  phone: string;
  role: AppRole;
  hourlyRate: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (worker: NewWorkerInput) => void;
}

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as AppRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

export function AddWorkerModal({ visible, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AppRole>('installer');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setRole('installer');
    setRate('');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    // Field Supers must be reachable — their number shows on every work
    // request of their jobs, so they can't operate without one.
    if (role === 'field_super' && !phone.trim()) {
      setError('Field Supers need a phone number to operate.');
      return;
    }
    let hourlyRate = 0;
    if (role === 'installer') {
      hourlyRate = Number(rate);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        setError('Enter an hourly rate for the installer.');
        return;
      }
    }
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      hourlyRate,
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Add worker</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            An email invite is sent so they can set a password and sign in.
          </Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Full name"
                value={name}
                onChangeText={setName}
                placeholder="Jordan Pike"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="name@ox-glass.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label={
                  role === 'field_super' ? 'Phone (required)' : 'Phone'
                }
                value={phone}
                onChangeText={setPhone}
                placeholder="(801) 555-0134"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.col}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Role</Text>
                <InlineSelect
                  value={role}
                  options={ROLE_OPTIONS}
                  onChange={setRole}
                  minWidth={200}
                />
              </View>
            </View>
          </View>

          {role === 'installer' && (
            <FormInput
              label="Hourly rate ($)"
              value={rate}
              onChangeText={setRate}
              placeholder="42.50"
              keyboardType="decimal-pad"
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitText}>Send invite</Text>
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
    maxWidth: 580,
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
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: -spacing.md,
  },
  // Two-column row for paired fields on the wide desktop layout.
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  col: {
    flex: 1,
  },
  field: {
    gap: spacing.xs + 2,
    zIndex: 10,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
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
