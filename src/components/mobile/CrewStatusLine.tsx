import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Crew, DailyCrew, Worker } from '@/types';
import { buildCrewColorMap, crewColorFrom, withAlpha } from '@/utils/crewColors';
import { installerShortName } from '@/utils/dailyCrewName';

interface Props {
  installerId: string;
  /** The agenda's selected day, yyyy-MM-dd. */
  date: string;
  /** "Today" / "Thursday, Sep 10" — the sheet's title. */
  dateLabel: string;
}

/** One person in the sheet's roster. */
interface Member {
  worker: Worker;
  foreman: boolean;
  /** Set when a permanent-crew mate is away on a daily crew that day. */
  awayOn?: string;
}

/** One crew card in the sheet. */
interface CrewGroup {
  id: string;
  name: string;
  daily: boolean;
  color: string;
  members: Member[];
}

/** Join up to two short names, then "+N more". */
function nameList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(' & ');
  return `${names[0]} & ${names[1]} +${names.length - 2} more`;
}

/**
 * The installer's crew status for the selected day — one muted line under
 * the agenda's day label, with the crew's color dot; tapping it opens a
 * bottom sheet listing who they're working with (foreman marked, phones
 * tap-to-call). Three states:
 *   • on a daily crew that day → "With Timothy B & Sam K" (everyone but me,
 *     capped at two names; a second daily crew adds "+1 more crew")
 *   • permanent crew intact     → "Crew B · full crew"
 *   • a crewmate pulled away    → "Crew B · without Tim"
 * Derived entirely from crews / daily crews / assignments — a daily crew only
 * counts on a day it actually has work (same rule as the agenda itself).
 */
export function CrewStatusLine({ installerId, date, dateLabel }: Props) {
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const workers = useAppStore((s) => s.workers);
  const [open, setOpen] = useState(false);

  const status = useMemo(() => {
    const colorMap = buildCrewColorMap([...dailyCrews, ...crews]);
    const workerOf = (id: string) => workers.find((w) => w.id === id);
    const shortName = (id: string) => {
      const w = workerOf(id);
      return w ? installerShortName(w.name) : undefined;
    };
    // Daily crews working THIS day (an assignment row on the date).
    const workingDailies = dailyCrews.filter((dc) =>
      assignments.some((a) => a.crewId === dc.id && a.date === date)
    );
    const myDailies = workingDailies.filter((dc) =>
      dc.installerIds.includes(installerId)
    );
    const permanent = crews.find((c) => c.installerIds.includes(installerId));
    const foremanIds = new Set(
      crews.map((c) => c.foremanId).filter((id): id is string => !!id)
    );

    const membersOf = (
      crew: Crew | DailyCrew,
      awayOnFor?: (id: string) => string | undefined
    ): Member[] =>
      crew.installerIds
        .map((id) => workerOf(id))
        .filter((w): w is Worker => !!w)
        .map((worker) => ({
          worker,
          foreman:
            'foremanId' in crew
              ? crew.foremanId === worker.id
              : foremanIds.has(worker.id),
          awayOn: awayOnFor?.(worker.id),
        }));

    if (myDailies.length > 0) {
      const primary = myDailies[0];
      const others = primary.installerIds
        .filter((id) => id !== installerId)
        .map(shortName)
        .filter((n): n is string => !!n);
      const line =
        (others.length > 0 ? `With ${nameList(others)}` : 'Daily crew · just you') +
        (myDailies.length > 1 ? ` · +${myDailies.length - 1} more crew` : '');
      return {
        line,
        color: crewColorFrom(colorMap, primary.id),
        groups: myDailies.map<CrewGroup>((dc) => ({
          id: dc.id,
          name: dc.name,
          daily: true,
          color: crewColorFrom(colorMap, dc.id),
          members: membersOf(dc),
        })),
        note: permanent
          ? `You're off ${permanent.name} for the day.`
          : undefined,
      };
    }

    if (!permanent) {
      return { line: 'No crew assigned', color: colors.textTertiary, groups: [] as CrewGroup[] };
    }

    // Crewmates pulled onto a daily crew that's working today.
    const awayOn = (id: string) =>
      id === installerId
        ? undefined
        : workingDailies.find((dc) => dc.installerIds.includes(id))?.name;
    const away = permanent.installerIds
      .filter((id) => id !== installerId && awayOn(id))
      .map(shortName)
      .filter((n): n is string => !!n);
    return {
      line:
        away.length === 0
          ? `${permanent.name} · full crew`
          : `${permanent.name} · without ${nameList(away)}`,
      color: crewColorFrom(colorMap, permanent.id),
      groups: [
        {
          id: permanent.id,
          name: permanent.name,
          daily: false,
          color: crewColorFrom(colorMap, permanent.id),
          members: membersOf(permanent, awayOn),
        },
      ],
    };
  }, [crews, dailyCrews, assignments, workers, installerId, date]);

  const call = (phone: string) => {
    if (Platform.OS === 'web') return;
    void Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
        onPress={() => status.groups.length > 0 && setOpen(true)}
        disabled={status.groups.length === 0}
        accessibilityRole="button"
        accessibilityLabel={`Crew for ${dateLabel}: ${status.line}`}
      >
        <View style={[styles.dot, { backgroundColor: status.color }]} />
        <Text style={styles.lineText} numberOfLines={1}>
          {status.line}
        </Text>
        {status.groups.length > 0 && (
          <Feather name="chevron-right" size={13} color={colors.textTertiary} />
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.dismiss} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetTitle}>Your crew · {dateLabel}</Text>
                {status.note ? (
                  <Text style={styles.sheetNote}>{status.note}</Text>
                ) : null}
              </View>
              <Pressable hitSlop={8} onPress={() => setOpen(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {status.groups.map((group) => (
                <View
                  key={group.id}
                  style={[styles.crewCard, { borderLeftColor: group.color }]}
                >
                  <View style={styles.crewHeader}>
                    <Text style={styles.crewName} numberOfLines={1}>
                      {group.name}
                    </Text>
                    {group.daily && (
                      <View
                        style={[
                          styles.dailyPill,
                          { backgroundColor: withAlpha(group.color, 0.16) },
                        ]}
                      >
                        <Text style={[styles.dailyPillText, { color: group.color }]}>
                          Daily
                        </Text>
                      </View>
                    )}
                  </View>
                  {group.members.map((m) => {
                    const me = m.worker.id === installerId;
                    const canCall = !!m.worker.phone && !me && Platform.OS !== 'web';
                    return (
                      <Pressable
                        key={m.worker.id}
                        style={({ pressed }) => [
                          styles.memberRow,
                          pressed && canCall && styles.pressed,
                        ]}
                        disabled={!canCall}
                        onPress={() => call(m.worker.phone)}
                      >
                        <Feather
                          name="user"
                          size={15}
                          color={m.awayOn ? colors.textTertiary : colors.textSecondary}
                        />
                        <View style={styles.memberText}>
                          <Text
                            style={[styles.memberName, m.awayOn && styles.memberAway]}
                            numberOfLines={1}
                          >
                            {m.worker.name}
                            {me ? ' (you)' : ''}
                          </Text>
                          <Text style={styles.memberMeta} numberOfLines={1}>
                            {[
                              m.foreman ? 'Foreman' : '',
                              m.awayOn ? `Away today on ${m.awayOn}` : '',
                              m.worker.phone && !me ? m.worker.phone : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        {canCall && (
                          <Feather name="phone" size={15} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      marginTop: -spacing.xs,
    },
    pressed: {
      opacity: 0.7,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: radii.pill,
    },
    lineText: {
      flexShrink: 1,
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    dismiss: {
      flex: 1,
    },
    sheet: {
      maxHeight: '70%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitleWrap: {
      flex: 1,
      gap: 2,
    },
    sheetTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 15,
    },
    sheetNote: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    sheetBody: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    crewCard: {
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      padding: spacing.md,
      gap: spacing.sm,
    },
    crewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    crewName: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 15,
    },
    dailyPill: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    dailyPillText: {
      fontFamily: fonts.semiBold,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    memberText: {
      flex: 1,
      gap: 1,
    },
    memberName: {
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    memberAway: {
      color: colors.textTertiary,
    },
    memberMeta: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
  })
);
