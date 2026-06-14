import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';
import { Jobcard, JobcardPriority } from '@/types';

const PRIORITY_META: Record<JobcardPriority, { bg: string; fg: string }> = {
  Low: { bg: colors.surfaceLight, fg: colors.textSecondary },
  Medium: { bg: colors.primaryDim, fg: colors.primary },
  High: { bg: colors.dangerDim, fg: colors.danger },
};

interface Props {
  /** Unassigned jobcards (no row in `assignments`). */
  cards: Jobcard[];
  jobNameFor: (jobId?: string) => string;
  placingCardId: string | null;
  onTogglePlacing: (cardId: string) => void;
}

/** Right-column pool of unassigned jobcards waiting for a crew + date. */
export function Backlog({
  cards,
  jobNameFor,
  placingCardId,
  onTogglePlacing,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Backlog</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{cards.length}</Text>
        </View>
      </View>
      <Text style={styles.hint}>
        Select a card, then click a calendar day to assign it.
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {cards.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-circle" size={24} color={colors.success} />
            <Text style={styles.emptyText}>Backlog clear — everything assigned.</Text>
          </View>
        ) : (
          cards.map((card) => {
            const meta = PRIORITY_META[card.priority];
            const selected = placingCardId === card.id;
            const hint = card.flashingMaterial || card.materials;
            return (
              <Pressable
                key={card.id}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => onTogglePlacing(card.id)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <View style={[styles.priorityPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.priorityText, { color: meta.fg }]}>
                      {card.priority}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardJob} numberOfLines={1}>
                  {jobNameFor(card.jobId)}
                </Text>
                {hint ? (
                  <View style={styles.hintRow}>
                    <Feather name="layers" size={11} color={colors.textTertiary} />
                    <Text style={styles.hintText} numberOfLines={1}>
                      {hint}
                    </Text>
                  </View>
                ) : null}
                {selected && (
                  <View style={styles.selectedRow}>
                    <Feather name="crosshair" size={12} color={colors.primary} />
                    <Text style={styles.selectedText}>Placing — pick a day</Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  countPill: {
    minWidth: 22,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  countText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  hint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: 2,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  pressed: {
    opacity: 0.85,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  cardJob: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hintText: {
    flex: 1,
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  priorityPill: {
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  priorityText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  selectedText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
});
