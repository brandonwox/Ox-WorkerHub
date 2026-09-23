import { Feather } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FormInput } from '@/components/FormInput';
import { KEYBOARD_DONE_ID } from '@/components/KeyboardDoneBar';
import { TimePartsPicker } from '@/components/TimePartsPicker';
import { useAppStore, uuid } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { CalendarTask, WorkRequestTask } from '@/types';
import { parseTimeInput } from '@/utils/time';

/** RN's Pressable state on web also carries `hovered` (react-native-web). */
type PressState = { pressed: boolean; hovered?: boolean };

interface Props {
  visible: boolean;
  /** The calendar day the task sits on (yyyy-MM-dd). */
  date: string;
  /**
   * Edit this task instead of creating a new one (its checklist can be
   * checked off, and a Delete control appears). Null/undefined = create.
   */
  task?: CalendarTask | null;
  onClose: () => void;
}

/** A checklist row being edited (existing rows keep their id + done state). */
interface DraftItem {
  id: string;
  text: string;
  done: boolean;
  doneById?: string;
  doneAt?: string;
}

/**
 * Create / edit a Field Super's calendar task — the day-cell hover-＋ popup
 * on the web calendar and the "Add task" sheet on the phone calendar. Modeled
 * on work request creation but far lighter: a required title, an optional
 * description, an optional checklist ("Tasks", like a work request's), and
 * an optional reminder time on that day. The reminder is delivered by the
 * server at that moment as an in-app notification, a phone push, and an
 * email — nothing about it lives on this device.
 */
export function CalendarTaskSheet({ visible, date, task, onClose }: Props) {
  const addCalendarTask = useAppStore((s) => s.addCalendarTask);
  const updateCalendarTask = useAppStore((s) => s.updateCalendarTask);
  const deleteCalendarTask = useAppStore((s) => s.deleteCalendarTask);
  const flash = useAppStore((s) => s.flash);
  const editing = !!task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [remind, setRemind] = useState(false);
  // Reminder time as typed/picked text ("7:30 AM"); parsed on save.
  const [reminderTime, setReminderTime] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const newItemRef = useRef<TextInput>(null);

  // Fresh draft every time the sheet opens — seeded from the task in edit
  // mode. `task` is deliberately not a dep: a background refresh must not
  // wipe in-progress edits.
  useEffect(() => {
    if (!visible) return;
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setItems(
      (task?.tasks ?? []).map((t) => ({
        id: t.id,
        text: t.text,
        done: t.done,
        doneById: t.doneById,
        doneAt: t.doneAt,
      }))
    );
    setNewItem('');
    const at = task?.reminderAt ? parseISO(task.reminderAt) : null;
    setRemind(!!at && isValid(at));
    setReminderTime(at && isValid(at) ? format(at, 'h:mm a') : '');
    setDone(task?.done ?? false);
    setError(null);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, task?.id]);

  const dayDate = parseISO(date);
  const dayLabel = isValid(dayDate) ? format(dayDate, 'EEEE, MMMM d') : date;

  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    setItems((prev) => [...prev, { id: uuid(), text: t, done: false }]);
    setNewItem('');
    setError(null);
  };

  const commitItem = (id: string, text: string) => {
    const t = text.trim();
    setItems((prev) =>
      t
        ? prev.map((it) => (it.id === id ? { ...it, text: t } : it))
        : prev.filter((it) => it.id !== id)
    );
  };

  const toggleItem = (id: string) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              done: !it.done,
              doneById: !it.done ? task?.workerId : undefined,
              doneAt: !it.done ? new Date().toISOString() : undefined,
            }
          : it
      )
    );

  const submit = () => {
    const t = title.trim();
    if (!t) {
      setError('Add a title.');
      return;
    }
    // A typed-but-unsaved checklist line still counts.
    const pendingLine = newItem.trim();
    const allItems: DraftItem[] = pendingLine
      ? [...items, { id: uuid(), text: pendingLine, done: false }]
      : items;

    let reminderAt: string | undefined;
    if (remind) {
      const timeText = reminderTime.trim();
      if (!timeText) {
        setError('Pick the hour, minute, and AM/PM — or turn the reminder off.');
        return;
      }
      const parsed = parseTimeInput(timeText, date);
      if (!parsed) {
        setError('Pick the hour, minute, and AM/PM for the reminder.');
        return;
      }
      reminderAt = parsed.toISOString();
      // A NEW or CHANGED reminder must be in the future — the server sweep
      // would otherwise fire it on its next pass.
      const changed = reminderAt !== task?.reminderAt;
      if (changed && parsed.getTime() <= Date.now()) {
        setError('That reminder time has already passed today.');
        return;
      }
    }

    if (editing && task) {
      const checklist: WorkRequestTask[] = allItems.map((it) => ({
        id: it.id,
        text: it.text,
        done: it.done,
        doneById: it.doneById,
        doneAt: it.doneAt,
      }));
      updateCalendarTask(task.id, {
        title: t,
        description: description.trim() || undefined,
        tasks: checklist.length > 0 ? checklist : undefined,
        reminderAt,
        done,
      });
      flash(`Task "${t}" saved`, 'success');
      onClose();
      return;
    }

    const created = addCalendarTask({
      title: t,
      date,
      description: description.trim() || undefined,
      tasks: allItems.map((it) => it.text),
      reminderAt,
    });
    if (!created) {
      setError('Sign in to create tasks.');
      return;
    }
    flash(
      reminderAt
        ? `Task "${t}" created — reminder set for ${format(parseISO(reminderAt), 'h:mm a')}`
        : `Task "${t}" created`,
      'success'
    );
    onClose();
  };

  const remove = () => {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteCalendarTask(task.id);
    flash(`Task "${task.title}" deleted`, 'success');
    onClose();
  };

  const reminderSent = editing && !!task?.reminderSentAt && remind && (
    reminderTime.trim() ===
      (task?.reminderAt ? format(parseISO(task.reminderAt), 'h:mm a') : '')
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.heading}>{editing ? 'Task' : 'New Task'}</Text>
              <Text style={styles.subheading}>{dayLabel}</Text>
            </View>
            {editing && (
              <Pressable
                onPress={remove}
                style={({ pressed, hovered }: PressState) => [
                  styles.iconButton,
                  confirmDelete && styles.deleteArmed,
                  (hovered || pressed) && !confirmDelete && styles.iconButtonHover,
                ]}
                accessibilityLabel="Delete task"
              >
                <Feather
                  name="trash-2"
                  size={16}
                  color={confirmDelete ? colors.textOnAccent : colors.textSecondary}
                />
                {confirmDelete && (
                  <Text style={styles.deleteArmedText}>Tap again to delete</Text>
                )}
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={8} style={styles.iconButton}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            onStartShouldSetResponderCapture={() => {
              if (confirmDelete) setConfirmDelete(false);
              return false;
            }}
          >
            <FormInput
              label="Title"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                setError(null);
              }}
              placeholder="Walk the Smith job with the builder"
              autoFocus={!editing}
              returnKeyType="done"
              inputAccessoryViewID={KEYBOARD_DONE_ID}
            />

            <FormInput
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Anything worth remembering…"
              multiline
              style={styles.multiline}
              inputAccessoryViewID={KEYBOARD_DONE_ID}
            />

            {/* Checklist — "Tasks", exactly like a work request's. */}
            <View style={styles.field}>
              <Text style={styles.label}>Tasks (optional)</Text>
              <View style={styles.checklist}>
                {items.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    checkable={editing}
                    onToggle={() => toggleItem(item.id)}
                    onCommit={(text) => commitItem(item.id, text)}
                    onRemove={() => commitItem(item.id, '')}
                  />
                ))}
                <View style={styles.checkRow}>
                  <Feather name="plus" size={18} color={colors.primary} />
                  <TextInput
                    ref={newItemRef}
                    style={styles.checkInput}
                    value={newItem}
                    onChangeText={setNewItem}
                    onSubmitEditing={addItem}
                    blurOnSubmit={false}
                    returnKeyType="done"
                    placeholder="Add a task…"
                    placeholderTextColor={colors.textTertiary}
                    inputAccessoryViewID={KEYBOARD_DONE_ID}
                  />
                  {newItem.trim().length > 0 && (
                    <Pressable
                      onPress={addItem}
                      hitSlop={6}
                      style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
                    >
                      <Text style={styles.addChipText}>Add</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {/* Reminder — a time of day on the task's date. */}
            <View style={styles.field}>
              <Pressable
                style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
                onPress={() => {
                  setRemind((on) => !on);
                  setError(null);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: remind }}
              >
                <Feather
                  name={remind ? 'check-square' : 'square'}
                  size={20}
                  color={remind ? colors.primary : colors.textSecondary}
                />
                <Feather name="bell" size={15} color={colors.textSecondary} />
                <Text style={styles.toggleText}>Remind me</Text>
              </Pressable>
              {remind && (
                <>
                  <TimePartsPicker
                    label={`Reminder time · ${dayLabel}`}
                    value={reminderTime}
                    onChange={(text) => {
                      setReminderTime(text);
                      setError(null);
                    }}
                  />
                  <Text style={styles.hint}>
                    {reminderSent
                      ? 'This reminder already went out. Change the time to send it again.'
                      : 'At that time you get an app notification, a phone push, and an email.'}
                  </Text>
                </>
              )}
            </View>

            {editing && (
              <Pressable
                style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
                onPress={() => setDone((on) => !on)}
                accessibilityRole="switch"
                accessibilityState={{ checked: done }}
              >
                <Feather
                  name={done ? 'check-square' : 'square'}
                  size={20}
                  color={done ? colors.success : colors.textSecondary}
                />
                <Text style={styles.toggleText}>Done</Text>
              </Pressable>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
              onPress={submit}
            >
              <Text style={styles.submitText}>{editing ? 'Save' : 'Create Task'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One checklist line: optional check-off, inline text edit, remove. */
function ChecklistRow({
  item,
  checkable,
  onToggle,
  onCommit,
  onRemove,
}: {
  item: DraftItem;
  checkable: boolean;
  onToggle: () => void;
  onCommit: (text: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(item.text);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(item.text);
  }, [item.text, focused]);
  return (
    <View style={styles.checkRow}>
      {checkable ? (
        <Pressable hitSlop={8} onPress={onToggle}>
          <Feather
            name={item.done ? 'check-square' : 'square'}
            size={18}
            color={item.done ? colors.success : colors.textSecondary}
          />
        </Pressable>
      ) : (
        <View style={styles.bullet} />
      )}
      <TextInput
        style={[styles.checkInput, item.done && styles.checkInputDone]}
        value={draft}
        onChangeText={setDraft}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onCommit(draft);
        }}
        multiline
        inputAccessoryViewID={KEYBOARD_DONE_ID}
      />
      <Pressable
        hitSlop={6}
        onPress={onRemove}
        style={({ pressed, hovered }: PressState) => [
          styles.trashButton,
          (hovered || pressed) && styles.trashButtonHover,
        ]}
        accessibilityLabel="Remove task"
      >
        {({ pressed, hovered }: PressState) => (
          <Feather
            name="x"
            size={14}
            color={hovered || pressed ? colors.danger : colors.textTertiary}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '94%',
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    heading: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 18,
    },
    subheading: {
      color: colors.primary,
      fontFamily: fonts.medium,
      fontSize: 12,
    },
    iconButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 32,
      minWidth: 32,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
    },
    iconButtonHover: {
      backgroundColor: colors.surfaceLight,
    },
    deleteArmed: {
      backgroundColor: colors.danger,
      paddingHorizontal: spacing.md,
    },
    deleteArmedText: {
      color: colors.textOnAccent,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    body: {
      gap: spacing.lg,
    },
    multiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    field: {
      gap: spacing.xs + 2,
    },
    label: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    hint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
    },
    checklist: {
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginHorizontal: 6,
      backgroundColor: colors.textSecondary,
    },
    checkInput: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 15,
      paddingVertical: spacing.xs,
      ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
    },
    checkInputDone: {
      color: colors.textTertiary,
      textDecorationLine: 'line-through',
    },
    addChip: {
      borderRadius: radii.pill,
      backgroundColor: colors.primaryDim,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    addChipText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    trashButton: {
      width: 26,
      height: 26,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trashButtonHover: {
      backgroundColor: colors.dangerDim,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      alignSelf: 'flex-start',
    },
    toggleText: {
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 15,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    pressed: {
      opacity: 0.7,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    submitButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    submitText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 14,
    },
  })
);
