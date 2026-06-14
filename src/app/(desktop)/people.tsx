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
import { AddWorkerModal, NewWorkerInput } from '@/components/desktop/AddWorkerModal';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { Toast } from '@/components/Toast';
import { ROLE_LABELS } from '@/roles';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { AppRole, Worker } from '@/types';

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as AppRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

export default function PeopleScreen() {
  const role = useCurrentRole();
  const workers = useAppStore((s) => s.workers);
  const addWorker = useAppStore((s) => s.addWorker);
  const setWorkerRole = useAppStore((s) => s.setWorkerRole);
  const setWorkerRate = useAppStore((s) => s.setWorkerRate);

  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (role !== 'operator') return <AccessDenied />;

  const handleAdd = (input: NewWorkerInput) => {
    // TODO(supabase): route through the `invite-worker` Edge Function so the
    // email invite is actually sent. For now this seeds the roster locally.
    addWorker({
      name: input.name,
      email: input.email,
      phone: '',
      role: input.role,
      hourlyRate: input.hourlyRate,
      tradeRole: input.role === 'installer' ? 'Glazier' : ROLE_LABELS[input.role],
    });
    setToast(`Invite sent to ${input.email}`);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.subtitle}>
              {workers.length} {workers.length === 1 ? 'person' : 'people'} on the
              team
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={() => setAddOpen(true)}
          >
            <Feather name="user-plus" size={16} color={colors.textPrimary} />
            <Text style={styles.addButtonText}>Add worker</Text>
          </Pressable>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.cell, styles.colName, styles.headText]}>Name</Text>
            <Text style={[styles.cell, styles.colRole, styles.headText]}>Role</Text>
            <Text style={[styles.cell, styles.colRate, styles.headText]}>Rate</Text>
            <Text style={[styles.cell, styles.colStatus, styles.headText]}>
              Status
            </Text>
          </View>

          {workers.map((worker, index) => (
            <View
              key={worker.id}
              style={[styles.row, { zIndex: workers.length - index }]}
            >
              <View style={[styles.cell, styles.colName]}>
                <Text style={styles.name} numberOfLines={1}>
                  {worker.name}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {worker.email}
                </Text>
              </View>

              <View style={[styles.cell, styles.colRole]}>
                <InlineSelect
                  value={worker.role}
                  options={ROLE_OPTIONS}
                  onChange={(role) => setWorkerRole(worker.id, role)}
                  minWidth={140}
                />
              </View>

              <View style={[styles.cell, styles.colRate]}>
                {worker.role === 'installer' ? (
                  <RateCell
                    worker={worker}
                    onCommit={(rate) => setWorkerRate(worker.id, rate)}
                  />
                ) : (
                  <Text style={styles.muted}>—</Text>
                )}
              </View>

              <View style={[styles.cell, styles.colStatus]}>
                <StatusBadge status={worker.status} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Toast message={toast} onDone={() => setToast(null)} />

      <AddWorkerModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />
    </View>
  );
}

/** Editable hourly-rate cell for installers; commits on blur. */
function RateCell({
  worker,
  onCommit,
}: {
  worker: Worker;
  onCommit: (rate: number) => void;
}) {
  const [text, setText] = useState(String(worker.hourlyRate));

  const commit = () => {
    const value = Number(text);
    if (Number.isFinite(value) && value >= 0) onCommit(value);
    else setText(String(worker.hourlyRate));
  };

  return (
    <View style={styles.rateWrap}>
      <Text style={styles.rateDollar}>$</Text>
      <TextInput
        style={styles.rateInput}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onEndEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <Text style={styles.rateSuffix}>/hr</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: Worker['status'] }) {
  const active = status === 'active';
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: active ? colors.successDim : colors.warningDim },
      ]}
    >
      <Text
        style={[
          styles.statusText,
          { color: active ? colors.success : colors.warning },
        ]}
      >
        {active ? 'Active' : 'Invited'}
      </Text>
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
    maxWidth: 1000,
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
    flex: 3,
    gap: 2,
  },
  colRole: {
    flex: 2,
  },
  colRate: {
    flex: 2,
  },
  colStatus: {
    flex: 1.4,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  email: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  muted: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  rateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  rateDollar: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  rateInput: {
    minWidth: 56,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  rateSuffix: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
