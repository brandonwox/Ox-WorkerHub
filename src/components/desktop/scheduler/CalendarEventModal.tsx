import { format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** What the modal is showing: a new event draft, or an existing event. */
export type EventModalState =
  | { mode: 'create'; date: string }
  | { mode: 'view'; eventId: string };

interface Props {
  /** null = closed. */
  state: EventModalState | null;
  /** Schedulers edit/delete; everyone else views date/title/description only. */
  canEdit: boolean;
  onClose: () => void;
}

/**
 * The Event popup. Events deliberately show only their date, title, and
 * description — no crew, status, or tasks. Schedulers create them here (from
 * the "+ Event" buttons), edit them in place, and delete them; other roles
 * get a read-only view.
 */
export function CalendarEventModal({ state, canEdit, onClose }: Props) {
  const events = useAppStore((s) => s.calendarEvents);
  const addCalendarEvent = useAppStore((s) => s.addCalendarEvent);
  const updateCalendarEvent = useAppStore((s) => s.updateCalendarEvent);
  const deleteCalendarEvent = useAppStore((s) => s.deleteCalendarEvent);
  const flash = useAppStore((s) => s.flash);

  const event =
    state?.mode === 'view' ? events.find((e) => e.id === state.eventId) : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the draft whenever the popup opens (or the target event changes).
  useEffect(() => {
    if (!state) return;
    if (state.mode === 'create') {
      setTitle('');
      setDescription('');
      setDate(state.date);
    } else {
      setTitle(event?.title ?? '');
      setDescription(event?.description ?? '');
      setDate(event?.date ?? '');
    }
    setError(null);
    setConfirmDelete(false);
    // The event object identity changes on every store write; keying the seed
    // on the ids keeps typing from being clobbered mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.mode, state?.mode === 'view' ? state.eventId : state?.date]);

  if (!state) return null;
  // The viewed event vanished (deleted elsewhere) — nothing to show.
  if (state.mode === 'view' && !event) return null;

  const editable = canEdit;
  const dirty =
    state.mode === 'create' ||
    (event != null &&
      (title.trim() !== event.title ||
        (description.trim() || undefined) !== event.description ||
        date.trim() !== event.date));

  const save = () => {
    const t = title.trim();
    const d = date.trim();
    if (!t) {
      setError('Give the event a title.');
      return;
    }
    if (!DATE_RE.test(d)) {
      setError('Date must be in YYYY-MM-DD format.');
      return;
    }
    if (state.mode === 'create') {
      addCalendarEvent({ title: t, description: description.trim(), date: d });
      flash(`Event "${t}" created`, 'success');
    } else if (event) {
      updateCalendarEvent(event.id, {
        title: t,
        description: description.trim() || undefined,
        date: d,
      });
      flash('Event updated', 'success');
    }
    onClose();
  };

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (event) {
      deleteCalendarEvent(event.id);
      flash(`Event "${event.title}" deleted`, 'success');
    }
    onClose();
  };

  const prettyDate = DATE_RE.test(date)
    ? format(parseISO(date), 'EEEE, MMMM d, yyyy')
    : date;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.heading}>
            {state.mode === 'create' ? 'New event' : 'Event'}
          </Text>

          {editable ? (
            <>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Brandon off all day"
                placeholderTextColor={colors.textTertiary}
                autoFocus={state.mode === 'create'}
              />
              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Details the crews should know…"
                placeholderTextColor={colors.textTertiary}
                multiline
              />
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
              />
            </>
          ) : (
            <>
              <Text style={styles.viewTitle}>{title}</Text>
              <Text style={styles.viewDate}>{prettyDate}</Text>
              {description ? (
                <Text style={styles.viewDescription}>{description}</Text>
              ) : null}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            {editable && state.mode === 'view' && (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteBtn,
                  confirmDelete && styles.deleteBtnArmed,
                  pressed && styles.pressed,
                ]}
                onPress={remove}
              >
                <Text style={styles.deleteText}>
                  {confirmDelete ? 'Click again to delete' : 'Delete'}
                </Text>
              </Pressable>
            )}
            <View style={styles.actionsRight}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                onPress={onClose}
              >
                <Text style={styles.cancelText}>
                  {editable ? 'Cancel' : 'Close'}
                </Text>
              </Pressable>
              {editable && (
                <Pressable
                  disabled={!dirty}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    !dirty && styles.saveBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={save}
                >
                  <Text style={styles.saveText}>
                    {state.mode === 'create' ? 'Create event' : 'Save changes'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
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
      maxWidth: 440,
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    heading: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 18,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    inputMultiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    viewTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 20,
    },
    viewDate: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    viewDescription: {
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      marginTop: spacing.sm,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    actionsRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginLeft: 'auto',
    },
    deleteBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.dangerDim,
    },
    deleteBtnArmed: {
      backgroundColor: colors.dangerDim,
      borderColor: colors.danger,
    },
    deleteText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    cancelBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    saveBtnDisabled: {
      opacity: 0.45,
    },
    saveText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.7,
    },
  })
);
