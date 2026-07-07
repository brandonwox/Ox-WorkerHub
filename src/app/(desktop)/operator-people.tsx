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
import { EditWorkerModal, WorkerChanges } from '@/components/desktop/EditWorkerModal';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { inviteWorker } from '@/integrations/supabase';
import { ROLE_LABELS } from '@/roles';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { AppRole, INSTALLER_TYPES, InstallerType, Worker } from '@/types';

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as AppRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

/** Order the per-role tables are stacked in on the People screen. */
const ROLE_ORDER = Object.keys(ROLE_LABELS) as AppRole[];

/** Installer-type picker options, with a placeholder for "not yet set". */
const INSTALLER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Set type…' },
  ...INSTALLER_TYPES.map((value) => ({ value, label: value })),
];

export default function PeopleScreen() {
  const role = useCurrentRole();
  const workers = useAppStore((s) => s.workers);
  const authWorker = useAppStore((s) => s.authWorker);
  const addWorker = useAppStore((s) => s.addWorker);
  const setWorkerRole = useAppStore((s) => s.setWorkerRole);
  const setWorkerRate = useAppStore((s) => s.setWorkerRate);
  const updateWorker = useAppStore((s) => s.updateWorker);
  const removeWorker = useAppStore((s) => s.removeWorker);
  const flash = useAppStore((s) => s.flash);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);

  if (role !== 'operator') return <AccessDenied />;

  const handleAdd = async (input: NewWorkerInput) => {
    const tradeRole =
      input.role === 'installer' ? 'Glazier' : ROLE_LABELS[input.role];

    // Signed-in operator: send the real email invite via the Edge Function.
    if (authWorker) {
      try {
        const worker = await inviteWorker({
          email: input.email,
          name: input.name,
          role: input.role,
          hourlyRate: input.hourlyRate,
          tradeRole,
        });
        addWorker(worker); // reflect in the roster (until 7d reads from the DB)
        flash(`Invite sent to ${input.email}`, 'success');
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Could not send invite.', 'warning');
      }
      return;
    }

    // Dev mode (no real session): seed the roster locally.
    addWorker({
      name: input.name,
      email: input.email,
      phone: '',
      role: input.role,
      hourlyRate: input.hourlyRate,
      tradeRole,
    });
    flash(`Invite sent to ${input.email} (local)`, 'success');
  };

  const handleSave = (id: string, changes: WorkerChanges) => {
    updateWorker(id, changes);
    flash(`${changes.name} updated`, 'success');
  };

  const handleDelete = (id: string) => {
    const name = workers.find((w) => w.id === id)?.name ?? 'Worker';
    removeWorker(id);
    flash(`${name} removed`, 'success');
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

        {ROLE_ORDER.map((groupRole) => {
          const members = workers.filter((w) => w.role === groupRole);
          if (members.length === 0) return null;
          return (
            <RoleTable
              key={groupRole}
              role={groupRole}
              members={members}
              onSetRole={setWorkerRole}
              onSetRate={setWorkerRate}
              onSetInstallerType={(id, installerType) =>
                updateWorker(id, { installerType })
              }
              onEdit={setEditing}
            />
          );
        })}
      </ScrollView>

      <AddWorkerModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />

      <EditWorkerModal
        worker={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </View>
  );
}

/** One titled table holding every worker that currently has `role`. */
function RoleTable({
  role,
  members,
  onSetRole,
  onSetRate,
  onSetInstallerType,
  onEdit,
}: {
  role: AppRole;
  members: Worker[];
  onSetRole: (id: string, role: AppRole) => void;
  onSetRate: (id: string, rate: number) => void;
  onSetInstallerType: (id: string, type: InstallerType | undefined) => void;
  onEdit: (worker: Worker) => void;
}) {
  const isInstaller = role === 'installer';
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{ROLE_LABELS[role]}</Text>
      <View style={styles.table}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.cell, styles.colName, styles.headText]}>Name</Text>
          <Text style={[styles.cell, styles.colRole, styles.headText]}>Role</Text>
          <Text style={[styles.cell, styles.colRate, styles.headText]}>Rate</Text>
          <Text style={[styles.cell, styles.colActions, styles.headText]} />
        </View>

        {members.map((worker, index) => (
          <View
            key={worker.id}
            style={[styles.row, { zIndex: members.length - index }]}
          >
            <View style={[styles.cell, styles.colName]}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {worker.name}
                </Text>
                {worker.status !== 'active' && <InvitedTag />}
              </View>
              <Text style={styles.email} numberOfLines={1}>
                {worker.email}
              </Text>
            </View>

            <View style={[styles.cell, styles.colRole]}>
              <InlineSelect
                value={worker.role}
                options={ROLE_OPTIONS}
                onChange={(next) => onSetRole(worker.id, next)}
                minWidth={140}
              />
              {isInstaller && (
                <View style={styles.installerTypeWrap}>
                  <InlineSelect
                    value={worker.installerType ?? ''}
                    options={INSTALLER_TYPE_OPTIONS}
                    onChange={(value) =>
                      onSetInstallerType(
                        worker.id,
                        (value || undefined) as InstallerType | undefined
                      )
                    }
                    minWidth={140}
                  />
                </View>
              )}
            </View>

            <View style={[styles.cell, styles.colRate]}>
              {isInstaller ? (
                <RateCell
                  worker={worker}
                  onCommit={(rate) => onSetRate(worker.id, rate)}
                />
              ) : (
                <Text style={styles.muted}>—</Text>
              )}
            </View>

            <View style={[styles.cell, styles.colActions]}>
              <Pressable
                onPress={() => onEdit(worker)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.editButton,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="edit-2" size={15} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
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

/**
 * Small inline "Invited" pill shown next to a worker's name while their account
 * is still pending. Active workers render nothing, so the common case adds no
 * visual noise and no dedicated column.
 */
function InvitedTag() {
  return (
    <View style={styles.invitedPill}>
      <Text style={styles.invitedText}>Invited</Text>
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
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
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
    gap: spacing.sm,
  },
  installerTypeWrap: {
    alignSelf: 'flex-start',
  },
  colRate: {
    flex: 2,
  },
  colActions: {
    flex: 0.6,
    alignItems: 'flex-end',
    paddingRight: 0,
  },
  editButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    flexShrink: 1,
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
  invitedPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.warningDim,
  },
  invitedText: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
});
