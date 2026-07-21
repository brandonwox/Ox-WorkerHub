import { format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  StatusChangeModal,
  statusNeedsNote,
} from '@/components/StatusChangeModal';
import { workRequestStatusColors } from '@/components/StatusPill';
import { activeCrewIdFor, useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import {
  SELECTABLE_WORK_REQUEST_STATUSES,
  WorkRequest,
  WorkRequestStatus,
} from '@/types';
import { workRequestJobsLabel } from '@/utils/workRequestJobs';

/**
 * The undefined-status catch-up popup. When an installer opens the app and
 * their crew has work requests from yesterday (or today, once 3:30 PM has
 * passed) still sitting at 'Undefined', this modal lists them with an inline
 * status selector per request — picking Untouched / False Start / Finished
 * routes through the usual reason/completion popup. Rows disappear as they're
 * answered; "Later" dismisses for this session.
 *
 * Mounted once in each layout; renders nothing for non-installers or when
 * there is nothing to catch up on.
 */
export function UndefinedStatusCatchUp() {
  const me = useCurrentWorker();
  const workRequests = useAppStore((s) => s.workRequests);
  const assignments = useAppStore((s) => s.assignments);
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const jobs = useAppStore((s) => s.jobs);
  const setWorkRequestStatus = useAppStore((s) => s.setWorkRequestStatus);

  const [dismissed, setDismissed] = useState(false);
  // The status pick awaiting its reason / completion note.
  const [pending, setPending] = useState<{
    card: WorkRequest;
    status: WorkRequestStatus;
  } | null>(null);

  const dueCards = useMemo(() => {
    if (!me || me.role !== 'installer') return [];
    const now = new Date();
    // Yesterday's board is always overdue; today's only counts once the
    // 3:30 PM reporting deadline has passed (mirrors the foreman sweep).
    const dates = [format(subDays(now, 1), 'yyyy-MM-dd')];
    if (now.getHours() * 60 + now.getMinutes() >= 15 * 60 + 30) {
      dates.push(format(now, 'yyyy-MM-dd'));
    }
    const ids = new Set<string>();
    for (const date of dates) {
      const crewId = activeCrewIdFor({ crews, dailyCrews }, me.id, date);
      if (!crewId) continue;
      for (const a of assignments) {
        if (a.crewId === crewId && a.date === date) ids.add(a.workRequestId);
      }
    }
    return workRequests.filter(
      (c) => ids.has(c.id) && c.status === 'Undefined'
    );
  }, [me, workRequests, assignments, crews, dailyCrews]);

  if (!me || me.role !== 'installer' || dismissed || dueCards.length === 0) {
    return null;
  }

  const pick = (card: WorkRequest, status: WorkRequestStatus) => {
    if (statusNeedsNote(status)) {
      setPending({ card, status });
      return;
    }
    setWorkRequestStatus(card.id, status);
  };

  return (
    <>
      <Modal
        visible={!pending}
        transparent
        animationType="fade"
        onRequestClose={() => setDismissed(true)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>
              {dueCards.length === 1
                ? 'A work request status needs updating'
                : 'Some work request statuses need updating'}
            </Text>
            <Text style={styles.subtitle}>
              These were on your crew&apos;s board but never got a status —
              pick one for each.
            </Text>
            <ScrollView style={styles.list} contentContainerStyle={styles.listBody}>
              {dueCards.map((card) => (
                <View key={card.id} style={styles.rowCard}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {workRequestJobsLabel(card, jobs) || 'No parent job'} ·{' '}
                    {card.date}
                  </Text>
                  <View style={styles.statusChips}>
                    {SELECTABLE_WORK_REQUEST_STATUSES.map((status) => (
                      <Pressable
                        key={status}
                        style={({ pressed }) => [
                          styles.statusChip,
                          {
                            backgroundColor:
                              workRequestStatusColors[status].bg,
                          },
                          pressed && styles.pressed,
                        ]}
                        onPress={() => pick(card, status)}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            { color: workRequestStatusColors[status].fg },
                          ]}
                        >
                          {status}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}
              onPress={() => setDismissed(true)}
            >
              <Text style={styles.laterText}>Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <StatusChangeModal
        status={pending?.status ?? null}
        workRequestTitle={pending?.card.title ?? ''}
        windowsScope={(pending?.card.scopes ?? []).includes('Windows')}
        onConfirm={(note) => {
          if (pending) {
            setWorkRequestStatus(pending.card.id, pending.status, note);
          }
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: 'rgba(0, 0, 0, 0.25)',
    },
    card: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '80%',
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 18,
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    list: {
      flexGrow: 0,
    },
    listBody: {
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowCard: {
      backgroundColor: colors.background,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.xs,
    },
    rowTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 15,
    },
    rowMeta: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    statusChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    statusChip: {
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusChipText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    laterBtn: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
    },
    laterText: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.7,
    },
  })
);
