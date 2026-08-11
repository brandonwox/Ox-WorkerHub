import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Worker } from '@/types';
import { buildCrewColorMap, CREW_COLOR_CHOICES } from '@/utils/crewColors';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Permanent crew names are a single letter — they tag calendar chips. */
const CREW_NAME_RE = /^[A-Za-z]$/;
/** Daily crew names are freer: anything up to this many characters. */
const DAILY_NAME_MAX = 20;

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

  // The automatic (palette) color each crew currently reads as — the
  // fallback shown on the "Auto" swatch. Same composition as CalendarBoard.
  const autoColors = useMemo(
    () => buildCrewColorMap([...crews, ...dailyCrews].map(({ id }) => ({ id }))),
    [crews, dailyCrews]
  );

  // One permanent crew per installer: which OTHER crew holds each installer
  // (excluding `exceptCrewId`'s own members) — drives the disabled "· on A"
  // entries in the add picker. Daily crews don't restrict.
  const heldByOtherCrew = (exceptCrewId?: string) => {
    const map = new Map<string, string>();
    crews.forEach((c) => {
      if (c.id === exceptCrewId) return;
      c.installerIds.forEach((wid) => map.set(wid, c.name));
    });
    return map;
  };

  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewMembers, setNewCrewMembers] = useState<string[]>([]);
  const [newCrewForeman, setNewCrewForeman] = useState<string | null>(null);
  const [newCrewColor, setNewCrewColor] = useState<string | undefined>();
  const [newDailyName, setNewDailyName] = useState('');
  const [newDailyDate, setNewDailyDate] = useState('');
  const [newDailyMembers, setNewDailyMembers] = useState<string[]>([]);
  const [newDailyColor, setNewDailyColor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const createCrew = () => {
    const name = newCrewName.trim().toUpperCase();
    if (!CREW_NAME_RE.test(name)) {
      setError('Crew names must be a single letter (e.g. "A").');
      return;
    }
    // Every permanent crew needs exactly one foreman — no more, no less.
    if (!newCrewForeman || !newCrewMembers.includes(newCrewForeman)) {
      setError('Pick exactly one foreman for the crew.');
      return;
    }
    addCrew({
      name,
      installerIds: newCrewMembers,
      foremanId: newCrewForeman,
      color: newCrewColor,
    });
    setNewCrewName('');
    setNewCrewMembers([]);
    setNewCrewForeman(null);
    setNewCrewColor(undefined);
    setError(null);
  };

  const createDailyCrew = () => {
    const name = newDailyName.trim();
    if (name.length === 0 || name.length > DAILY_NAME_MAX) {
      setError(`Daily crew names can be 1–${DAILY_NAME_MAX} characters.`);
      return;
    }
    if (!DATE_RE.test(newDailyDate.trim())) {
      setError('Daily crew date must be in YYYY-MM-DD format.');
      return;
    }
    addDailyCrew({
      name,
      date: newDailyDate.trim(),
      installerIds: newDailyMembers,
      color: newDailyColor,
    });
    setNewDailyName('');
    setNewDailyDate('');
    setNewDailyMembers([]);
    setNewDailyColor(undefined);
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
                  <MemberEditor
                    installers={installers}
                    selected={crew.installerIds}
                    heldBy={heldByOtherCrew(crew.id)}
                    onAdd={(id) =>
                      updateCrew(crew.id, {
                        installerIds: [...crew.installerIds, id],
                      })
                    }
                    onRemove={(id) =>
                      updateCrew(crew.id, {
                        installerIds: crew.installerIds.filter((x) => x !== id),
                      })
                    }
                  />
                  <Text style={styles.fieldLabel}>Foreman (exactly one)</Text>
                  {crew.installerIds.length === 0 ? (
                    <Text style={styles.muted}>
                      Add members before picking a foreman.
                    </Text>
                  ) : (
                    <ForemanChips
                      installers={installers.filter((w) =>
                        crew.installerIds.includes(w.id)
                      )}
                      foremanId={crew.foremanId}
                      onPick={(id) => updateCrew(crew.id, { foremanId: id })}
                    />
                  )}
                  {!crew.foremanId && crew.installerIds.length > 0 && (
                    <Text style={styles.error}>
                      This crew has no foreman yet — pick one.
                    </Text>
                  )}
                  <Text style={styles.fieldLabel}>Color</Text>
                  <ColorPicker
                    value={crew.color}
                    fallback={autoColors.get(crew.id) ?? colors.textTertiary}
                    onPick={(color) => updateCrew(crew.id, { color })}
                  />
                </View>
              ))
            )}

            <View style={styles.formBlock}>
              <FormInput
                label="New crew name (single letter)"
                value={newCrewName}
                onChangeText={setNewCrewName}
                placeholder="C"
                autoCapitalize="characters"
                maxLength={1}
              />
              <Text style={styles.fieldLabel}>Members (installers only)</Text>
              <MemberEditor
                installers={installers}
                selected={newCrewMembers}
                heldBy={heldByOtherCrew()}
                onAdd={(id) => setNewCrewMembers((m) => [...m, id])}
                onRemove={(id) => {
                  setNewCrewMembers((m) => m.filter((x) => x !== id));
                  // Removing the chosen foreman un-picks them.
                  setNewCrewForeman((f) => (f === id ? null : f));
                }}
              />
              {newCrewMembers.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Foreman (exactly one)</Text>
                  <ForemanChips
                    installers={installers.filter((w) =>
                      newCrewMembers.includes(w.id)
                    )}
                    foremanId={newCrewForeman ?? undefined}
                    onPick={setNewCrewForeman}
                  />
                </>
              )}
              <Text style={styles.fieldLabel}>Color</Text>
              <ColorPicker
                value={newCrewColor}
                fallback={colors.textTertiary}
                onPick={setNewCrewColor}
              />
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={createCrew}
              >
                <Feather name="plus" size={15} color={colors.textOnAccent} />
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
                  {/* No heldBy: daily crews don't restrict membership. */}
                  <MemberEditor
                    installers={installers}
                    selected={dc.installerIds}
                    onAdd={(id) =>
                      updateDailyCrew(dc.id, {
                        installerIds: [...dc.installerIds, id],
                      })
                    }
                    onRemove={(id) =>
                      updateDailyCrew(dc.id, {
                        installerIds: dc.installerIds.filter((x) => x !== id),
                      })
                    }
                  />
                  <Text style={styles.fieldLabel}>Color</Text>
                  <ColorPicker
                    value={dc.color}
                    fallback={autoColors.get(dc.id) ?? colors.textTertiary}
                    onPick={(color) => updateDailyCrew(dc.id, { color })}
                  />
                </View>
              ))
            )}

            <View style={styles.formBlock}>
              <FormInput
                label={`New daily crew name (up to ${DAILY_NAME_MAX} characters)`}
                value={newDailyName}
                onChangeText={setNewDailyName}
                placeholder="Punch list"
                maxLength={DAILY_NAME_MAX}
              />
              <FormInput
                label="Date"
                value={newDailyDate}
                onChangeText={setNewDailyDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>Members (installers only)</Text>
              <MemberEditor
                installers={installers}
                selected={newDailyMembers}
                onAdd={(id) => setNewDailyMembers((m) => [...m, id])}
                onRemove={(id) =>
                  setNewDailyMembers((m) => m.filter((x) => x !== id))
                }
              />
              <Text style={styles.fieldLabel}>Color</Text>
              <ColorPicker
                value={newDailyColor}
                fallback={colors.textTertiary}
                onPick={setNewDailyColor}
              />
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={createDailyCrew}
              >
                <Feather name="plus" size={15} color={colors.textOnAccent} />
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

/**
 * Single-select foreman picker over a crew's members. Exactly one foreman per
 * permanent crew — picking a different member moves the tag.
 */
function ForemanChips({
  installers,
  foremanId,
  onPick,
}: {
  installers: Worker[];
  foremanId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {installers.map((w) => {
        const active = foremanId === w.id;
        return (
          <Pressable
            key={w.id}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onPick(w.id)}
          >
            <Feather
              name="star"
              size={12}
              color={active ? colors.primary : colors.textTertiary}
            />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {w.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A crew's member list: only the SELECTED installers show as chips (tap one
 * to remove it), with a "+ Add" chip that unfolds the pickable roster. On
 * permanent-crew pickers, installers already on another permanent crew render
 * disabled with that crew's letter — deselect them there first (one permanent
 * crew per installer; daily crews pass no `heldBy` and don't restrict).
 */
function MemberEditor({
  installers,
  selected,
  heldBy,
  onAdd,
  onRemove,
}: {
  installers: Worker[];
  selected: string[];
  /** installerId → the OTHER permanent crew's name holding them. */
  heldBy?: Map<string, string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  if (installers.length === 0) {
    return <Text style={styles.muted}>No installers on the roster.</Text>;
  }
  const selectedWorkers = selected
    .map((id) => installers.find((w) => w.id === id))
    .filter((w): w is Worker => w != null);
  const addable = installers.filter((w) => !selected.includes(w.id));
  return (
    <View style={styles.memberEditor}>
      <View style={styles.chips}>
        {selectedWorkers.map((w) => (
          <Pressable
            key={w.id}
            style={({ pressed }) => [
              styles.chip,
              styles.chipActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onRemove(w.id)}
            accessibilityLabel={`Remove ${w.name}`}
          >
            <Text style={[styles.chipText, styles.chipTextActive]}>
              {w.name}
            </Text>
            <Feather name="x" size={12} color={colors.textSecondary} />
          </Pressable>
        ))}
        <Pressable
          style={({ pressed }) => [
            styles.chip,
            styles.addChip,
            pressed && styles.pressed,
          ]}
          onPress={() => setAdding((v) => !v)}
        >
          <Feather
            name={adding ? 'chevron-up' : 'plus'}
            size={12}
            color={colors.primary}
          />
          <Text style={styles.addChipText}>{adding ? 'Done' : 'Add'}</Text>
        </Pressable>
      </View>
      {adding &&
        (addable.length === 0 ? (
          <Text style={styles.muted}>
            Every installer is already on this crew.
          </Text>
        ) : (
          <View style={styles.chips}>
            {addable.map((w) => {
              const holder = heldBy?.get(w.id);
              if (holder) {
                return (
                  <View key={w.id} style={[styles.chip, styles.chipDisabled]}>
                    <Text style={styles.chipTextDisabled}>
                      {w.name} · on {holder}
                    </Text>
                  </View>
                );
              }
              return (
                <Pressable
                  key={w.id}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onAdd(w.id)}
                  accessibilityLabel={`Add ${w.name}`}
                >
                  <Feather name="plus" size={12} color={colors.textTertiary} />
                  <Text style={styles.chipText}>{w.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
    </View>
  );
}

/**
 * Crew color control: collapsed, it's just a small rounded square in the
 * crew's current color (the automatic palette color while nothing is picked).
 * Clicking it unfolds the selector — the swatches plus an explicit "Use
 * automatic color" reset — and picking either way folds it back up.
 */
function ColorPicker({
  value,
  fallback,
  onPick,
}: {
  value?: string;
  /** The automatic color the crew reads as while nothing is picked. */
  fallback: string;
  onPick: (color?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.colorPicker}>
      <View style={styles.colorHead}>
        <Pressable
          style={({ pressed }) => [
            styles.colorSquare,
            { backgroundColor: value ?? fallback },
            open && styles.colorSquareOpen,
            pressed && styles.pressed,
          ]}
          onPress={() => setOpen((v) => !v)}
          accessibilityLabel="Edit crew color"
        />
        {!value && <Text style={styles.colorAutoTag}>Automatic</Text>}
      </View>
      {open && (
        <>
          <View style={styles.swatchRow}>
            {CREW_COLOR_CHOICES.map((color) => (
              <Pressable
                key={color}
                style={({ pressed }) => [
                  styles.swatch,
                  { backgroundColor: color },
                  value === color && styles.swatchActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  onPick(color);
                  setOpen(false);
                }}
                accessibilityLabel={`Crew color ${color}`}
              />
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.autoBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              onPick(undefined);
              setOpen(false);
            }}
          >
            <View
              style={[styles.autoBtnSwatch, { backgroundColor: fallback }]}
            />
            <Text style={styles.autoBtnText}>Use automatic color</Text>
          </Pressable>
        </>
      )}
    </View>
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
    maxWidth: 520,
    maxHeight: '86%',
    backgroundColor: colors.surface,
    ...modalShadow,
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
  chipDisabled: {
    opacity: 0.55,
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
  chipTextDisabled: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  memberEditor: {
    gap: spacing.sm,
  },
  addChip: {
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  addChipText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  colorPicker: {
    gap: spacing.sm,
  },
  colorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorSquare: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorSquareOpen: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  colorAutoTag: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  autoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  autoBtnSwatch: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  autoBtnText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
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
    color: colors.textOnAccent,
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
}));
