import { Feather } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radii, spacing, themed } from '@/theme';
import { JobIssue } from '@/types';

interface Props {
  /** Issues in display order (the caller sorts). */
  issues: JobIssue[];
  /** Render one issue (an IssueCard with the caller's props). */
  renderIssue: (issue: JobIssue) => ReactNode;
  /** How many issues show before the list collapses (default 3). */
  previewCount?: number;
}

/**
 * Issue list that stays short when a job/work request accumulates many issues:
 * the first few render as usual, the rest sit behind a "View all n issues"
 * toggle that expands them in place (scrolling with the page).
 */
export function CollapsibleIssueList({
  issues,
  renderIssue,
  previewCount = 3,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = issues.length > previewCount;
  const visible =
    collapsible && !expanded ? issues.slice(0, previewCount) : issues;

  return (
    <>
      {visible.map(renderIssue)}
      {collapsible && (
        <Pressable
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          onPress={() => setExpanded((e) => !e)}
        >
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={colors.primary}
          />
          <Text style={styles.toggleText}>
            {expanded ? 'Show fewer issues' : `View all ${issues.length} issues`}
          </Text>
        </Pressable>
      )}
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
      paddingVertical: spacing.sm + 2,
    },
    pressed: {
      opacity: 0.8,
    },
    toggleText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
  })
);
