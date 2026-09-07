import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { DateField } from '@/components/DateField';
import { KEYBOARD_DONE_ID } from '@/components/KeyboardDoneBar';
import { TimeField } from '@/components/TimeField';
import { useAppStore, uuid } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import {
  Job,
  JobScope,
  PRIORITY_CHOICES,
  PriorityChoice,
  READINESS_PRESETS,
  WORK_REQUEST_SCOPES,
  WorkRequest,
} from '@/types';
import { jobAllowsWindows } from '@/utils/jobScopes';
import { datesForPriorityChoice, effectivePriority } from '@/utils/priorityRange';
import { formatTime, parseTimeInput } from '@/utils/time';
import {
  CASEMENT_TASK_PREFIX,
  casementTaskText,
  DELIVERY_AUTO_TASKS,
  withAutoTasks,
  withoutAutoTasks,
} from '@/utils/workRequestAutoTasks';

interface Props {
  /** The card being edited — the create sheet's draft, or the live stored card. */
  card: WorkRequest;
  /** The card's primary job (undefined on a standalone request). */
  parentJob?: Job;
  /** Whether `card` is an unsaved create draft (relaxes the min-1 rules). */
  creating: boolean;
  /** Route a change to the draft or the store — the quick view's applyChange. */
  onChange: (patch: Partial<WorkRequest>) => void;
  /** Hide the title field (the create sheet renders its own, up top). */
  hideTitle?: boolean;
}

/**
 * The office-authored fields of a work request, phone layout — everything the
 * web quick view edits that isn't a field action: title, arrival time, scopes
 * (with the Delivery / casement auto-tasks and the per-scope extras), tasks
 * (add / edit / delete), readiness, priority window, materials, pickup, and
 * office notes. Every complete change fires `onChange` right away (text
 * fields commit on blur), so the same component backs both the create sheet
 * (draft) and the detail page's edit mode (autosave).
 */
export function WorkRequestOfficeFields({
  card,
  parentJob,
  creating,
  onChange,
  hideTitle = false,
}: Props) {
  const flash = useAppStore((s) => s.flash);
  const workers = useAppStore((s) => s.workers);
  const tasks = card.tasks ?? [];
  const scopes = card.scopes ?? [];
  // Flashing only exists when the card covers windows AND the parent job's
  // scopes allow window work at all.
  const windowsAllowed = jobAllowsWindows(parentJob);
  const includesWindows = windowsAllowed && scopes.includes('Windows');
  const includesDelivery = scopes.includes('Delivery');
  const scopeOptions = windowsAllowed
    ? WORK_REQUEST_SCOPES
    : WORK_REQUEST_SCOPES.filter((s) => s !== 'Windows');
  // The responsible Field Super's name (first-assigned on the parent job) —
  // injected into the auto-added casement cranks task.
  const fieldSuperName = workers.find(
    (w) => w.id === (parentJob?.fieldSuperIds ?? [])[0]
  )?.name;
  // "Yes" readiness drops the request into the schedulers' pool — it gets an
  // explicit confirm step, like the web quick view.
  const [pendingYes, setPendingYes] = useState(false);
  const [newTask, setNewTask] = useState('');

  // --- Commits (each fires onChange directly) ------------------------------

  const commitTitle = (text: string) => {
    const t = text.trim();
    if (!t) {
      if (!creating) flash('Title is required — change discarded.', 'warning');
      return;
    }
    if (t === card.title) return;
    // On creation, typing the title auto-authors the first task from it (and
    // keeps following title retypes until the task is edited or others exist).
    const autoFirstTask = creating
      ? tasks.length === 0
        ? [{ id: uuid(), text: t, done: false }]
        : tasks.length === 1 && tasks[0].text === card.title
          ? [{ ...tasks[0], text: t }]
          : null
      : null;
    onChange({ title: t, ...(autoFirstTask ? { tasks: autoFirstTask } : {}) });
  };

  // Arrival time: stored on the card's startTime; blank clears it.
  const commitArrival = (text: string) => {
    const t = text.trim();
    if (!t) {
      if (card.startTime || card.endTime) {
        onChange({ startTime: undefined, endTime: undefined });
      }
      return;
    }
    const parsed = parseTimeInput(
      t,
      card.date || format(new Date(), 'yyyy-MM-dd')
    );
    if (!parsed) return;
    const iso = parsed.toISOString();
    if (iso !== card.startTime) onChange({ startTime: iso });
  };

  const toggleScope = (scope: JobScope) => {
    const next = scopes.includes(scope)
      ? scopes.filter((s) => s !== scope)
      : [...scopes, scope];
    if (next.length === 0 && !creating) {
      flash('A work request needs at least one scope.', 'warning');
      return;
    }
    // Delivery injects its two check tasks on select and pulls the
    // not-yet-done ones back out (plus the counts) on deselect; dropping
    // Windows likewise pulls the casement cranks task.
    const addedDelivery = next.includes('Delivery') && !includesDelivery;
    const removedDelivery = !next.includes('Delivery') && includesDelivery;
    const removedWindows = !next.includes('Windows') && scopes.includes('Windows');
    let nextTasks = tasks;
    if (addedDelivery) {
      nextTasks = withAutoTasks(nextTasks, DELIVERY_AUTO_TASKS, uuid);
    }
    if (removedDelivery) {
      nextTasks = withoutAutoTasks(nextTasks, (text) =>
        DELIVERY_AUTO_TASKS.includes(text)
      );
    }
    if (removedWindows && card.windowsCasements) {
      nextTasks = withoutAutoTasks(nextTasks, (text) =>
        text.startsWith(CASEMENT_TASK_PREFIX)
      );
    }
    onChange({
      scopes: next,
      ...(nextTasks !== tasks ? { tasks: nextTasks } : {}),
      ...(next.includes('Windows')
        ? {}
        : { flashingMaterial: undefined, windowsCasements: undefined }),
      ...(removedDelivery
        ? { deliveryCountTotal: undefined, deliveryCountDone: undefined }
        : {}),
    });
  };

  const changeCasements = (checked: boolean) => {
    if (checked === (card.windowsCasements ?? false)) return;
    onChange({
      windowsCasements: checked,
      tasks: checked
        ? withAutoTasks(tasks, [casementTaskText(fieldSuperName)], uuid)
        : withoutAutoTasks(tasks, (text) =>
            text.startsWith(CASEMENT_TASK_PREFIX)
          ),
    });
  };

  const commitDeliveryTotal = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const parsed = Number(t);
    if (!Number.isInteger(parsed) || parsed < 0) {
      flash('Enter a whole number for the delivery count.', 'warning');
      return;
    }
    if (parsed !== card.deliveryCountTotal) {
      onChange({ deliveryCountTotal: parsed });
    }
  };

  const commitTask = (index: number, text: string) => {
    const t = text.trim();
    if (!t) {
      removeTask(index);
      return;
    }
    if (t !== tasks[index].text) {
      // Text edits keep the task's id (and check-off state) intact so
      // installer check-offs and per-task issues stay linked.
      onChange({
        tasks: tasks.map((task, i) => (i === index ? { ...task, text: t } : task)),
      });
    }
  };

  const removeTask = (index: number) => {
    if (!creating && tasks.length <= 1) {
      flash('A work request needs at least one task.', 'warning');
      return;
    }
    onChange({ tasks: tasks.filter((_, i) => i !== index) });
  };

  const addTask = () => {
    const t = newTask.trim();
    if (!t) return;
    onChange({ tasks: [...tasks, { id: uuid(), text: t, done: false }] });
    setNewTask('');
  };

  const changeReadiness = (value: string) => {
    if (value === card.readiness) {
      setPendingYes(false);
      return;
    }
    if (value === 'Yes') {
      setPendingYes(true);
      return;
    }
    setPendingYes(false);
    onChange({ readiness: value });
  };

  const pickPriority = (choice: PriorityChoice) => {
    const dates = datesForPriorityChoice(choice);
    onChange({
      priority: choice,
      priorityStartDate: dates.startDate || undefined,
      priorityEndDate: dates.endDate || undefined,
    });
  };

  const priorityInfo = card.priority ? effectivePriority(card) : null;
  const flashingValue =
    card.flashingMaterial ??
    (creating ? parentJob?.flashingMaterial : undefined) ??
    '';

  return (
    <View style={styles.stack}>
      {!hideTitle && (
        <CommitField
          label="Title"
          value={card.title}
          onCommit={commitTitle}
          placeholder="What needs doing"
          autoCapitalize="sentences"
        />
      )}

      {/* Arrival time — the time of day the installers must be on site. */}
      <ArrivalField
        startTime={card.startTime}
        onCommit={commitArrival}
      />

      {/* Scopes — the trades this card covers. */}
      <View style={styles.field}>
        <Text style={styles.label}>Scopes</Text>
        <View style={styles.chips}>
          {scopeOptions.map((scope) => (
            <Chip
              key={scope}
              label={scope}
              active={scopes.includes(scope)}
              onPress={() => toggleScope(scope)}
            />
          ))}
        </View>
        {includesDelivery && (
          <Text style={styles.hint}>
            Delivery adds its two check tasks and needs a delivery count.
          </Text>
        )}
      </View>

      {includesWindows && (
        <>
          <CommitField
            label="Window Opening Flashing Material"
            value={flashingValue}
            onCommit={(text) => {
              const v = text.trim() || undefined;
              if (v !== card.flashingMaterial) onChange({ flashingMaterial: v });
            }}
            placeholder={
              parentJob?.flashingMaterial
                ? `Job default: ${parentJob.flashingMaterial}`
                : 'e.g. regular rainbuster'
            }
          />
          {/* Checking adds the gather-casement-cranks task; unchecking removes
              it unless an installer already checked it off. */}
          <Pressable
            style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
            onPress={() => changeCasements(!card.windowsCasements)}
          >
            <Feather
              name={card.windowsCasements ? 'check-square' : 'square'}
              size={20}
              color={card.windowsCasements ? colors.primary : colors.textSecondary}
            />
            <View style={styles.checkText}>
              <Text style={styles.checkLabel}>Are any of the Windows Casements?</Text>
              <Text style={styles.hint}>
                {card.windowsCasements
                  ? 'Yes — casement cranks task added'
                  : 'Yes adds the “gather casement cranks” task'}
              </Text>
            </View>
          </Pressable>
        </>
      )}

      {includesDelivery && (
        <CommitField
          label="Delivery count (total)"
          value={card.deliveryCountTotal != null ? String(card.deliveryCountTotal) : ''}
          onCommit={commitDeliveryTotal}
          placeholder="How many items are being delivered"
          keyboardType="number-pad"
        />
      )}

      {/* Tasks — the installers' check-off list. Text edits keep each task's
          id so check-offs and per-task issues stay linked. */}
      <View style={styles.field}>
        <Text style={styles.label}>Tasks</Text>
        {tasks.map((task, index) => (
          <View key={task.id} style={styles.taskRow}>
            <Feather
              name={task.done ? 'check-square' : 'square'}
              size={18}
              color={task.done ? colors.success : colors.textTertiary}
            />
            <View style={styles.taskInputWrap}>
              <CommitField
                value={task.text}
                onCommit={(text) => commitTask(index, text)}
                placeholder="Task"
                multiline
                compact
              />
            </View>
            <Pressable
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => removeTask(index)}
              accessibilityLabel="Delete task"
            >
              <Feather name="trash-2" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))}
        <View style={styles.taskRow}>
          <Feather name="plus" size={18} color={colors.primary} />
          <TextInput
            style={[styles.input, styles.inputCompact, styles.taskInputWrap]}
            value={newTask}
            onChangeText={setNewTask}
            onSubmitEditing={addTask}
            onBlur={addTask}
            blurOnSubmit={false}
            returnKeyType="done"
            placeholder="Add a task…"
            placeholderTextColor={colors.textTertiary}
            inputAccessoryViewID={KEYBOARD_DONE_ID}
          />
        </View>
      </View>

      {/* Readiness — "Yes" puts the request in the schedulers' pool. */}
      <View style={styles.field}>
        <Text style={styles.label}>Ready for installers?</Text>
        <View style={styles.chips}>
          {READINESS_PRESETS.map((r) => (
            <Chip
              key={r}
              label={r}
              active={card.readiness === r}
              onPress={() => changeReadiness(r)}
            />
          ))}
          {card.readiness &&
            !(READINESS_PRESETS as readonly string[]).includes(card.readiness) && (
              <Chip label={card.readiness} active onPress={() => {}} />
            )}
        </View>
        {pendingYes && (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>
              &ldquo;Yes&rdquo; drops this request into the schedulers&apos; pool. Confirm?
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={({ pressed }) => [styles.confirmCancel, pressed && styles.pressed]}
                onPress={() => setPendingYes(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmOk, pressed && styles.pressed]}
                onPress={() => {
                  onChange({ readiness: 'Yes' });
                  setPendingYes(false);
                }}
              >
                <Text style={styles.confirmOkText}>Yes, ready</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Priority — a window the request should land in. "Set dates" opens
          both pickers; the others fill them in. */}
      <View style={styles.field}>
        <Text style={styles.label}>Priority</Text>
        <View style={styles.chips}>
          {PRIORITY_CHOICES.map((choice) => (
            <Chip
              key={choice}
              label={choice}
              active={card.priority === choice}
              onPress={() => pickPriority(choice)}
            />
          ))}
          {card.priority &&
            !(PRIORITY_CHOICES as readonly string[]).includes(card.priority) && (
              // A legacy / custom label renders as its own (active) chip.
              <Chip label={card.priority} active onPress={() => {}} />
            )}
        </View>
        {card.priority === 'Set dates' && (
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <DateField
                label="Start"
                value={card.priorityStartDate ?? ''}
                onChange={(ymd) => onChange({ priorityStartDate: ymd || undefined })}
              />
            </View>
            <View style={styles.dateCol}>
              <DateField
                label="End"
                value={card.priorityEndDate ?? ''}
                onChange={(ymd) => onChange({ priorityEndDate: ymd || undefined })}
              />
            </View>
          </View>
        )}
        {priorityInfo?.range && (
          <Text style={styles.hint}>
            {priorityInfo.escalated
              ? `Escalated to Now — window was ${priorityInfo.range}`
              : `Window: ${priorityInfo.range}`}
          </Text>
        )}
      </View>

      <CommitField
        label="Materials needed"
        value={card.materials ?? ''}
        onCommit={(text) => {
          const v = text.trim() || undefined;
          if (v !== card.materials) onChange({ materials: v });
        }}
        placeholder="Task-specific or extra materials (optional)"
        multiline
      />

      {/* Pickup — required Yes/No; Yes also needs the location. */}
      <View style={styles.field}>
        <Text style={styles.label}>Pickup required?</Text>
        <View style={styles.chips}>
          <Chip
            label="Yes"
            active={card.pickupRequired === true}
            onPress={() => {
              if (card.pickupRequired !== true) onChange({ pickupRequired: true });
            }}
          />
          <Chip
            label="No"
            active={card.pickupRequired === false}
            onPress={() => {
              if (card.pickupRequired !== false) {
                // "No" clears any stale location so it can't silently reappear.
                onChange({ pickupRequired: false, pickupLocation: undefined });
              }
            }}
          />
        </View>
        {card.pickupRequired && (
          <CommitField
            label="Pickup location"
            value={card.pickupLocation ?? ''}
            onCommit={(text) => {
              const v = text.trim() || undefined;
              if (v !== card.pickupLocation) onChange({ pickupLocation: v });
            }}
            placeholder="Where the pickup is"
          />
        )}
      </View>

      <CommitField
        label="Office notes"
        value={card.notes ?? ''}
        onCommit={(text) => {
          const v = text.trim() || undefined;
          if (v !== card.notes) onChange({ notes: v });
        }}
        placeholder="Notes for the crew (optional)"
        multiline
      />
    </View>
  );
}

/**
 * Arrival time on the phone: the platform time picker (TimeField) hands back
 * "h:mm a" text, committed at once. A Clear link drops the time.
 */
function ArrivalField({
  startTime,
  onCommit,
}: {
  startTime?: string;
  onCommit: (text: string) => void;
}) {
  const display = startTime ? formatTime(startTime) : '';
  const [text, setText] = useState(display);
  useEffect(() => setText(display), [display]);
  return (
    <View style={styles.field}>
      <TimeField
        label="Arrival time (optional)"
        value={text}
        onChangeText={(t) => {
          setText(t);
          // Native pickers hand back a complete time; typed web input commits
          // as soon as it parses.
          if (parseTimeInput(t, format(new Date(), 'yyyy-MM-dd'))) onCommit(t);
        }}
        placeholder="No arrival time"
      />
      {startTime ? (
        <Pressable
          hitSlop={6}
          style={({ pressed }) => [styles.clearLink, pressed && styles.pressed]}
          onPress={() => {
            setText('');
            onCommit('');
          }}
        >
          <Text style={styles.clearLinkText}>Clear arrival time</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A text field that keeps a local draft and commits it on blur (or Done),
 * re-seeding from `value` when the stored value changes underneath it.
 */
function CommitField({
  label,
  value,
  onCommit,
  compact = false,
  ...inputProps
}: {
  label?: string;
  value: string;
  onCommit: (text: string) => void;
  compact?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'>) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);
  const commit = () => {
    setFocused(false);
    if (text !== value) onCommit(text);
  };
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        style={[
          styles.input,
          compact && styles.inputCompact,
          inputProps.multiline && styles.inputMultiline,
        ]}
        value={text}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onSubmitEditing={inputProps.multiline ? undefined : commit}
        placeholderTextColor={colors.textTertiary}
        inputAccessoryViewID={KEYBOARD_DONE_ID}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipOn,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    stack: {
      gap: spacing.lg,
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
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 15,
    },
    inputCompact: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 14,
    },
    inputMultiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    chipOn: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    chipTextOn: {
      color: colors.primary,
    },
    pressed: {
      opacity: 0.7,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    checkText: {
      flex: 1,
      gap: 2,
    },
    checkLabel: {
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    taskInputWrap: {
      flex: 1,
    },
    confirmRow: {
      gap: spacing.sm,
      backgroundColor: colors.surfaceLight,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    confirmText: {
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    confirmButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    confirmCancel: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    confirmCancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    confirmOk: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    confirmOkText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 13,
    },
    dateRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    dateCol: {
      flex: 1,
    },
    clearLink: {
      alignSelf: 'flex-start',
    },
    clearLinkText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
  })
);
