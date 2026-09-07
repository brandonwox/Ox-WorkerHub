import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IssueCard } from '@/components/issues/IssueCard';
import { KEYBOARD_DONE_ID } from '@/components/KeyboardDoneBar';
import { DisplayPhoto } from '@/components/photos/useJobPhotos';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore, useCurrentWorker, uuid } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { addTodo, editTodoText, removeTodo, setTodoDone } from '@/utils/jobTodos';

/** RN's Pressable state on web also carries `hovered` (react-native-web). */
type PressState = { pressed: boolean; hovered?: boolean };

interface Props {
  job: Job;
  /** The job's photos (uploaded + pending) — each TO-DO shows its own. */
  photos: DisplayPhoto[];
  /** Open the tapped photo in the host screen's viewer. */
  onPhotoPress: (photo: DisplayPhoto, all: DisplayPhoto[]) => void;
}

/**
 * The job's TO-DOs section — the Field Super's own check-off list on a job
 * (parent or sub-job), on web and phone alike. Each row works like a work
 * request task: check it off, take/upload photos FOR it (tagged with the
 * TO-DO's id; they live only inside the TO-DO — the host pages keep them off
 * the job's Pictures wall via utils/jobTodos isTodoPhoto), raise an issue
 * under it, edit the text inline (blank = delete), plus an add row at the
 * bottom. Installers never see this section — the host pages gate it to
 * Field Supers.
 */
export function JobTodosSection({ job, photos, onPhotoPress }: Props) {
  const router = useRouter();
  const me = useCurrentWorker();
  const updateJob = useAppStore((s) => s.updateJob);
  const addJobIssue = useAppStore((s) => s.addJobIssue);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const jobIssues = useAppStore((s) => s.jobIssues);
  const [newText, setNewText] = useState('');
  const [picking, setPicking] = useState(false);
  const todos = job.todos ?? [];

  // This job's TO-DO issues (issues with a task id but no work request).
  const todoIssues = useMemo(
    () =>
      jobIssues
        .filter((i) => i.jobId === job.id && !i.workRequestId && !!i.taskId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobIssues, job.id]
  );

  const save = (next: Job['todos']) => updateJob(job.id, { todos: next });

  // Photos FOR one TO-DO: the in-app camera on native, the image picker on
  // web. Photos carry the TO-DO's id as their task id.
  const takePhotos = async (todoId: string) => {
    if (Platform.OS !== 'web') {
      router.push({
        pathname: '/camera/[jobId]',
        params: { jobId: job.id, taskId: todoId },
      });
      return;
    }
    if (picking) return;
    setPicking(true);
    try {
      const items = await pickJobPhotos();
      if (items.length) {
        await addJobPhotos({ jobId: job.id, taskId: todoId, items });
      }
    } finally {
      setPicking(false);
    }
  };

  const add = () => {
    const t = newText.trim();
    if (!t) return;
    save(addTodo(todos, t, uuid));
    setNewText('');
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>TO-DOs</Text>
        <Text style={styles.headerHint}>Field Supers only</Text>
      </View>

      {todos.length === 0 && (
        <Text style={styles.emptyText}>No TO-DOs yet — add one below.</Text>
      )}

      {todos.map((todo) => {
        const issues = todoIssues.filter((i) => i.taskId === todo.id);
        const todoPhotos = photos.filter((p) => p.taskId === todo.id);
        return (
          <View key={todo.id} style={styles.todoBlock}>
            <View style={styles.todoRow}>
              <Pressable
                hitSlop={10}
                onPress={() => save(setTodoDone(todos, todo.id, !todo.done, me?.id))}
              >
                <Feather
                  name={todo.done ? 'check-square' : 'square'}
                  size={22}
                  color={todo.done ? colors.success : colors.textSecondary}
                />
              </Pressable>
              <TodoText
                text={todo.text}
                done={todo.done}
                onCommit={(text) => {
                  const t = text.trim();
                  if (!t) save(removeTodo(todos, todo.id));
                  else if (t !== todo.text) save(editTodoText(todos, todo.id, t));
                }}
              />
              <Pressable
                style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}
                hitSlop={6}
                disabled={picking}
                onPress={() => takePhotos(todo.id)}
              >
                <Feather
                  name={Platform.OS === 'web' ? 'upload' : 'camera'}
                  size={12}
                  color={colors.primary}
                />
                {todoPhotos.length > 0 && (
                  <Text style={styles.cameraText}>{todoPhotos.length}</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.issueButton, pressed && styles.pressed]}
                hitSlop={6}
                onPress={() => addJobIssue({ jobId: job.id, taskId: todo.id })}
              >
                <Feather name="plus" size={12} color={colors.warning} />
                <Text style={styles.issueText}>Issue</Text>
              </Pressable>
              <Pressable
                hitSlop={6}
                style={({ pressed, hovered }: PressState) => [
                  styles.trashButton,
                  (hovered || pressed) && styles.trashButtonHover,
                ]}
                onPress={() => save(removeTodo(todos, todo.id))}
                accessibilityLabel="Delete TO-DO"
              >
                {({ pressed, hovered }: PressState) => (
                  <Feather
                    name="trash-2"
                    size={16}
                    color={hovered || pressed ? colors.danger : colors.textTertiary}
                  />
                )}
              </Pressable>
            </View>
            {/* The TO-DO's own photos/videos — shown here and nowhere else. */}
            {todoPhotos.length > 0 && (
              <View style={styles.photosRow}>
                {todoPhotos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    style={({ pressed }) => [pressed && styles.pressed]}
                    onPress={() => onPhotoPress(photo, todoPhotos)}
                  >
                    {photo.isVideo ? (
                      <View style={[styles.photoThumb, styles.videoThumb]}>
                        <Feather name="play-circle" size={16} color={colors.textPrimary} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: photo.url }}
                        style={styles.photoThumb}
                        contentFit="cover"
                        transition={100}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
            {issues.length > 0 && (
              <View style={styles.issues}>
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    editable
                    onPhotoPress={onPhotoPress}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.todoRow}>
        <Feather name="plus" size={22} color={colors.primary} />
        <TextInput
          style={styles.addInput}
          value={newText}
          onChangeText={setNewText}
          onSubmitEditing={add}
          onBlur={add}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder="Add a TO-DO…"
          placeholderTextColor={colors.textTertiary}
          inputAccessoryViewID={KEYBOARD_DONE_ID}
        />
      </View>
    </View>
  );
}

/** A TO-DO's text: reads as text, edits inline; commits on blur. */
function TodoText({
  text,
  done,
  onCommit,
}: {
  text: string;
  done: boolean;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(text);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(text);
  }, [text, focused]);
  return (
    <TextInput
      style={[styles.todoText, done && styles.todoTextDone]}
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
  );
}

const styles = themed(() =>
  StyleSheet.create({
    section: {
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionHeader: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 11,
    },
    emptyText: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    pressed: {
      opacity: 0.6,
    },
    todoBlock: {
      gap: spacing.sm,
    },
    todoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    todoText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 15,
      paddingVertical: 0,
      paddingTop: 1,
      // Reads as plain text until tapped (no box) — keeps the row calm.
      ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
    },
    todoTextDone: {
      color: colors.textTertiary,
      textDecorationLine: 'line-through',
    },
    addInput: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 15,
      paddingVertical: 0,
      paddingTop: 1,
      ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
    },
    cameraButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      marginTop: 1,
    },
    cameraText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 11,
    },
    issueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.warning,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      marginTop: 1,
    },
    issueText: {
      color: colors.warning,
      fontFamily: fonts.semiBold,
      fontSize: 11,
    },
    // Same height as the pill buttons beside it, so the three line up; the
    // hover/press state tints the icon red on a soft disc.
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
    photosRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginLeft: spacing.xl + spacing.sm,
    },
    photoThumb: {
      width: 44,
      height: 44,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceLight,
    },
    videoThumb: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    issues: {
      marginLeft: spacing.xl + spacing.sm,
      gap: spacing.sm,
    },
  })
);
