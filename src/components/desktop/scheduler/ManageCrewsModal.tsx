import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormInput } from '@/components/FormInput';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Worker } from '@/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toggle = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Crew CRUD. Only installer-role workers can ever be added to a crew. */
export function ManageCrewsModal({ visible, onClose }: Props) {
  const workers = useAppStore((s) => s.workers);
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const addCrew = useAppStore((s) => s.addCrew);
  const updateCrew = useAppStore((s) => s.updateCrew);
  const removeCrew = useAppStore((s) => s.removeCrew);
  const addDailyCrew = useAppStore((s) => s.addDailyCrew);
  const updateDailyCrew = useAppStore((s) => s.updateDailyCrew);
  const removeDailyCrew = useAppStore((s) => s.removeDailyCrew);

  // Hard constraint: the picker only ever lists installers.
  const installers = workers.filter((w) => w.role === 'installer');

  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewMembers, setNewCrewMembers] = useState<string[]>([]);
  const [newDailyName, setNewDailyName] = useState('');
  const [newDailyDate, setNewDailyDate] = useState('');
  const [newDailyMembers, setNewDailyMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createCrew = () => {
    if (!newCrewName.trim()) {
      setError('Crew name is required.');
      return;
    }
    addCrew({ name: newCrewName.trim(), installerIds: newCrewMembers });
    setNewCrewName('');
    setNewCrewMembers([]);
    setError(null);
  };

  const createDailyCrew = () => {
    if (!newDailyName.trim()) {
      setError('Daily crew name is required.');
      return;
    }
    if (!DATE_RE.test(newDailyDate.trim())) {
      setError('Daily crew date must be in YYYY-MM-DD format.');
      return;
    }
    addDailyCrew({
      name: newDailyName.trim(),
      date: newDailyDate.trim(),
      installerIds: newDailyMembers,
    });
    setNewDailyName('');
    setNewDailyDate('');
    setNewDailyMembers([]);
    setError(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Manage crews</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {/* Permanent crews */}
            <Text style={styles.sectionTitle}>Permanent crews</Text>
            {crews.length === 0 ? (
              <Text style={styles.muted}>No crews yet.</Text>
            ) : (
              crews.map((crew) => (
                <View key={crew.id} style={styles.crewBlock}>
                  <View style={styles.crewHead}>
                    <Text style={styles.crewName}>{crew.name}</Text>
                    <Pressable
                      onPress={() => removeCrew(crew.id)}
                      hitSlop={6}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Feather name="trash-2" size={15} color={colors.danger} />
                    </Pressable>
                  </View>
                  <InstallerChips
                    installers={installers}
                    selected={crew.installerIds}
                    onToggle={(id) =>
                      updateCrew(crew.id, {
                        installerIds: toggle(crew.installerIds, id),
                      })
                    }
                  />
                </View>
              ))
            )}

            <View style={styles.formBlock}>
              <FormInput
                label="New crew name"
                value={newCrewName}
                onChangeText={setNewCrewName}
                placeholder="Crew Charlie"
                autoCapitalize="words"
              />
              <Text style={styles.fieldLabel}>Members (installers only)</Text>
              <InstallerChips
                installers={installers}
                selected={newCrewMembers}
                onToggle={(id) => setNewCrewMembers((m) => toggle(m, id))}
              />
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={createCrew}
              >
                <Feather name="plus" size={15} color={colors.textPrimary} />
                <Text style={styles.addBtnText}>Add crew</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* Daily crews */}
            <Text style={styles.sectionTitle}>Daily crews (date overrides)</Text>
            {dailyCrews.length === 0 ? (
              <Text style={styles.muted}>No daily overrides.</Text>
            ) : (
              dailyCrews.map((dc) => (
                <View key={dc.id} style={styles.crewBlock}>
                  <View style={styles.crewHead}>
                    <Text style={styles.crewName}>
                      {dc.name}{' '}
                      <Text style={styles.crewDate}>· {dc.date}</Text>
                    </Text>
                    <Pressable
                      onPress={() => removeDailyCrew(dc.id)}
                      hitSlop={6}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Feather name="trash-2" size={15} color={colors.danger} />
                    </Pressable>
                  </View>
                  <InstallerChips
                    installers={installers}
                    selected={dc.installerIds}
                    onToggle={(id) =>
                      updateDailyCrew(dc.id, {
                        installerIds: toggle(dc.installerIds, id),
                      })
                    }
                  />
                </View>
              ))
            )}

            <View style={styles.formBlock}>
              <FormInput
                label="New daily crew name"
                value={newDailyName}
                onChangeText={setNewDailyName}
                placeholder="Punch List Crew"
                autoCapitalize="words"
              />
              <FormInput
                label="Date"
                value={newDailyDate}
                onChangeText={setNewDailyDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>Members (installers only)</Text>
              <InstallerChips
                installers={installers}
                selected={newDailyMembers}
                onToggle={(id) => setNewDailyMembers((m) => toggle(m, id))}
              />
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={createDailyCrew}
              >
                <Feather name="plus" size={15} color={colors.textPrimary} />
                <Text style={styles.addBtnText}>Add daily crew</Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InstallerChips({
  installers,
  selected,
  onToggle,
}: {
  installers: Worker[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (installers.length === 0) {
    return <Text style={styles.muted}>No installers on the roster.</Text>;
  }
  return (
    <View style={styles.chips}>
      {installers.map((w) => {
        const active = selected.includes(w.id);
        return (
          <Pressable
            key={w.id}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onToggle(w.id)}
          >
            {active && <Feather name="check" size={12} color={colors.primary} />}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {w.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  muted: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  crewBlock: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  crewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  crewName: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  crewDate: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  formBlock: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  addBtnText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});
