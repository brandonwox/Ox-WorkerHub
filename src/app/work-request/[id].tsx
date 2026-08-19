import { Feather } from '@expo/vector-icons';
import { format, parse } from 'date-fns';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Animated,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KEYBOARD_DONE_ID } from '@/components/KeyboardDoneBar';
import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { CollapsibleIssueList } from '@/components/issues/CollapsibleIssueList';
import { IssueCard } from '@/components/issues/IssueCard';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import {
  DisplayPhoto,
  useWorkRequestPhotos,
} from '@/components/photos/useJobPhotos';
import {
  StatusChangeModal,
  statusNeedsNote,
} from '@/components/StatusChangeModal';
import { workRequestStatusColors } from '@/components/StatusPill';
import { CountEditModal } from '@/components/jobsite/CountEditModal';
import { pickJobPhotos } from '@/lib/photoCapture';
import {
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { SELECTABLE_WORK_REQUEST_STATUSES, WorkRequestStatus } from '@/types';
import { formatCount, JobCount, jobCounts } from '@/utils/jobCounts';
import { jobAllowsWindows } from '@/utils/jobScopes';
import { formatJobWindow } from '@/utils/time';
import { workRequestPoLabel } from '@/utils/workRequestJobs';

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const job = useAppStore((s) => s.workRequests.find((j) => j.id === id));
  // Parent job — carries the Window Flashing Material reference photo.
  const parentJob = useAppStore((s) =>
    s.jobs.find((parent) => parent.id === job?.jobId)
  );
  const allJobs = useAppStore((s) => s.jobs);
  const workers = useAppStore((s) => s.workers);
  const setWorkRequestStatus = useAppStore((s) => s.setWorkRequestStatus);
  const setWorkRequestTaskDone = useAppStore((s) => s.setWorkRequestTaskDone);
  const updateWorkRequestNotes = useAppStore((s) => s.updateWorkRequestNotes);
  const updateJob = useAppStore((s) => s.updateJob);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const addJobIssue = useAppStore((s) => s.addJobIssue);
  const jobIssues = useAppStore((s) => s.jobIssues);
  const role = useCurrentRole();
  const photos = useWorkRequestPhotos(job?.id);
  // This card's issues, newest first (right under the button that raised them).
  const issues = useMemo(
    () =>
      jobIssues
        .filter((issue) => issue.workRequestId === job?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobIssues, job?.id]
  );
  // Issues whose task is gone (or that predate per-task issues) — rendered in
  // a fallback list at the bottom instead of silently disappearing.
  const orphanIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          !issue.taskId ||
          !job?.tasks?.some((task) => task.id === issue.taskId)
      ),
    [issues, job?.tasks]
  );
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  // Address tap → the maps menu (open in an installed maps app, or copy).
  const [mapsOpen, setMapsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Status picks that need a typed note (Untouched / False Start / Finished)
  // route through the StatusChangeModal before committing.
  const [pendingNoteStatus, setPendingNoteStatus] =
    useState<WorkRequestStatus | null>(null);
  const [notes, setNotes] = useState(job?.fieldNotes ?? '');
  const [picking, setPicking] = useState(false);
  // The parent JOB's scope counts ("Window Count 0/100") — tapping one opens
  // the done-number popup for the roles that update progress.
  const [editingCount, setEditingCount] = useState<JobCount | null>(null);
  const me = useCurrentWorker();
  const counts = jobCounts(parentJob);
  const canEditCounts =
    parentJob != null &&
    (role === 'installer' || role === 'field_super' || role === 'operator');
  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);
  const statusWrapRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  // Swipe-down-to-close (native): the sheet follows a downward drag that
  // starts while the content is scrolled to the top; past the threshold it
  // slides off and closes, otherwise it springs back. The x button stays.
  const sheetY = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const dismissPan = useRef(
    PanResponder.create({
      // Capture phase so the drag wins over the ScrollView's own bounce when
      // already at the top. Taps never trip the movement threshold.
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        Platform.OS !== 'web' &&
        scrollOffset.current <= 0 &&
        g.dy > 8 &&
        Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_evt, g) => {
        if (g.dy > 0) sheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dy > 140 || g.vy > 0.9) {
          Animated.timing(sheetY, {
            toValue: 800,
            duration: 160,
            useNativeDriver: true,
          }).start(() => router.back());
        } else {
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;
  // Installers must attach at least one photo to a task before checking it
  // off; office roles (and the dev switcher's other views) are not gated.
  const requireTaskPhotos = me?.role === 'installer';
  // Task whose "take a photo first" hint is showing (cleared after a moment).
  const [photoHintTaskId, setPhotoHintTaskId] = useState<string | null>(null);
  const photoHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (photoHintTimer.current) clearTimeout(photoHintTimer.current);
    },
    []
  );

  if (!job) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.notFound}>Work Request not found.</Text>
      </View>
    );
  }

  const palette =
    workRequestStatusColors[job.status] ?? workRequestStatusColors.Undefined;
  const timeWindow = formatJobWindow(job.startTime, job.endTime);
  // The job's responsible Field Super (first-assigned still on the job) —
  // shown to every role here, installers included, with their phone number.
  const fieldSuper = workers.find(
    (w) => w.id === (parentJob?.fieldSuperIds ?? [])[0]
  );
  const fieldSuperLabel = fieldSuper
    ? fieldSuper.phone
      ? `${fieldSuper.name} · ${fieldSuper.phone}`
      : fieldSuper.name
    : 'No Field Super assigned';
  const callFieldSuper = () => {
    if (!fieldSuper?.phone) return;
    void Linking.openURL(`tel:${fieldSuper.phone.replace(/[^+\d]/g, '')}`);
  };

  const copyAddress = async () => {
    if (!job.address) return;
    await Clipboard.setStringAsync(job.address);
    setCopied(true);
    setTimeout(() => {
      setMapsOpen(false);
      setCopied(false);
    }, 700);
  };

  // Universal links — each opens the matching app when installed (no
  // canOpenURL scheme querying needed, which Expo Go can't do anyway).
  const openMapsApp = (app: 'apple' | 'google' | 'waze') => {
    const q = encodeURIComponent(job.address);
    const url =
      app === 'apple'
        ? `http://maps.apple.com/?q=${q}`
        : app === 'google'
          ? `https://www.google.com/maps/search/?api=1&query=${q}`
          : `https://waze.com/ul?q=${q}&navigate=yes`;
    void Linking.openURL(url);
    setMapsOpen(false);
  };

  const showPhotoHint = (taskId: string) => {
    setPhotoHintTaskId(taskId);
    if (photoHintTimer.current) clearTimeout(photoHintTimer.current);
    photoHintTimer.current = setTimeout(() => setPhotoHintTaskId(null), 4000);
  };

  // Capture photos FOR one task: the in-app camera on native, the image picker
  // on web. Photos carry the task id (and the work request/job links as usual).
  const takeTaskPhotos = async (taskId: string) => {
    if (!job.jobId) return;
    if (Platform.OS !== 'web') {
      router.push({
        pathname: '/camera/[jobId]',
        params: { jobId: job.jobId, workRequestId: job.id, taskId },
      });
      return;
    }
    if (picking) return;
    setPicking(true);
    try {
      const items = await pickJobPhotos();
      if (items.length) {
        await addJobPhotos({
          jobId: job.jobId,
          workRequestId: job.id,
          taskId,
          items,
        });
      }
    } finally {
      setPicking(false);
    }
  };

  return (
    // The sheet: page behind stays visible (and undimmed) above the card.
    <View style={[styles.sheetRoot, { paddingTop: insets.top }]}>
      <Animated.View
        style={[styles.sheetCard, { transform: [{ translateY: sheetY }] }]}
        {...dismissPan.panHandlers}
      >
      {/* Keyboard insets (iOS): otherwise the open keyboard covers the bottom
          of the page and it can't be scrolled fully into view. */}
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollOffset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.topRow}>
          <Pressable
            style={({ pressed }) => [pressed && styles.closePressed]}
            hitSlop={12}
            onPress={() => router.back()}
          >
            <Feather name="x" size={28} color={colors.textPrimary} />
          </Pressable>
          <View ref={statusWrapRef} style={styles.statusWrap}>
            <Pressable
              style={[styles.statusPill, { backgroundColor: palette.bg }]}
              onPress={() => setStatusMenuOpen((open) => !open)}
            >
              <Text style={[styles.statusPillText, { color: palette.fg }]}>
                {job.status}
              </Text>
              <Feather
                name={statusMenuOpen ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={palette.fg}
              />
            </Pressable>
            <DropdownPortal
              anchorRef={statusWrapRef}
              open={statusMenuOpen}
              onClose={() => setStatusMenuOpen(false)}
              align="right"
              minWidth={170}
            >
              <View style={styles.statusMenu}>
                {SELECTABLE_WORK_REQUEST_STATUSES.map((status) => {
                  const active = job.status === status;
                  return (
                    <Pressable
                      key={status}
                      style={({ pressed }) => [
                        styles.statusMenuItem,
                        pressed && styles.statusMenuItemPressed,
                      ]}
                      onPress={() => {
                        setStatusMenuOpen(false);
                        if (active) return;
                        if (statusNeedsNote(status)) {
                          setPendingNoteStatus(status);
                          return;
                        }
                        setWorkRequestStatus(job.id, status);
                      }}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: workRequestStatusColors[status].fg },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusMenuText,
                          active && styles.statusMenuTextActive,
                        ]}
                      >
                        {status}
                      </Text>
                      {active && (
                        <Feather
                          name="check"
                          size={14}
                          color={colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </DropdownPortal>
          </View>
        </View>

        <View style={styles.header}>
          {parentJob && (
            <Pressable
              hitSlop={8}
              onPress={() =>
                router.push({
                  pathname: '/job-site/[id]',
                  params: { id: parentJob.id },
                })
              }
            >
              {/* The office identifies jobs by PO — show that, not the name. */}
              <Text style={styles.parentJobLink}>
                {workRequestPoLabel(job, allJobs) || parentJob.name}
              </Text>
            </Pressable>
          )}
          <Text style={styles.title}>{job.title}</Text>
        </View>

        <View style={styles.section}>
          {/* Tapping the address opens the maps menu (Apple/Google/Waze/copy). */}
          <Pressable
            style={({ pressed }) => [pressed && styles.countPressed]}
            disabled={!job.address}
            onPress={() => setMapsOpen(true)}
          >
            <InfoRow icon="map-pin" label="Address" value={job.address} />
          </Pressable>
          {/* The Field Super, phone on the same line — tap to call. */}
          {parentJob && (
            <Pressable
              style={({ pressed }) => [pressed && styles.countPressed]}
              disabled={!fieldSuper?.phone || Platform.OS === 'web'}
              onPress={callFieldSuper}
            >
              <InfoRow icon="user" label="Field Super" value={fieldSuperLabel} />
            </Pressable>
          )}
          <InfoRow
            icon="calendar"
            label="Date"
            value={format(
              parse(job.date, 'yyyy-MM-dd', new Date()),
              'EEEE, MMMM d, yyyy'
            )}
          />
          {timeWindow ? (
            <InfoRow
              icon="clock"
              label={job.endTime ? 'Time Window' : 'Arrival Time'}
              value={timeWindow}
            />
          ) : null}
          {job.pickupRequired ? (
            <InfoRow
              icon="truck"
              label="Pickup Required"
              value={job.pickupLocation || 'Yes'}
            />
          ) : null}
          {/* Parent job's scope counts — installers tap to update the done
              number (office roles too); others see them read-only. */}
          {counts.map((count) =>
            canEditCounts ? (
              <Pressable
                key={count.doneField}
                style={({ pressed }) => [pressed && styles.countPressed]}
                onPress={() => setEditingCount(count)}
              >
                <InfoRow
                  icon="hash"
                  label={count.label}
                  value={formatCount(count)}
                />
              </Pressable>
            ) : (
              <InfoRow
                key={count.doneField}
                icon="hash"
                label={count.label}
                value={formatCount(count)}
              />
            )
          )}
        </View>

        <View style={styles.section}>
          {/* Hidden entirely for jobs whose scopes exclude window work. */}
          {jobAllowsWindows(parentJob) && (
            <View style={styles.flashingRow}>
              <View style={styles.flashingInfo}>
                <InfoRow
                  icon="layers"
                  label="Window Opening Flashing Material (site-wide)"
                  value={job.flashingMaterial ?? 'Not specified'}
                />
              </View>
              {/* The Field Super's reference photo of the material (tap to expand). */}
              <FlashingPhotoField job={parentJob} />
            </View>
          )}
          {job.materials ? (
            <InfoRow icon="package" label="Materials Needed" value={job.materials} />
          ) : null}
          {job.scopeOfWork ? (
            <InfoRow icon="clipboard" label="Scope of Work" value={job.scopeOfWork} />
          ) : null}
        </View>

        {/* The Field Super's task list: installers check each task off as it
            completes, and raise issues per task (nested under the task). */}
        {(job.tasks?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Feather
                  name="check-square"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Tasks</Text>
              </View>
            </View>
            {job.tasks!.map((task) => {
              const taskIssues = issues.filter((i) => i.taskId === task.id);
              // Photos taken for THIS task (uploaded + still-uploading).
              const taskPhotos = photos.filter((p) => p.taskId === task.id);
              return (
                <View key={task.id} style={styles.taskBlock}>
                  <View style={styles.taskRow}>
                    <Pressable
                      hitSlop={10}
                      onPress={() => {
                        // Installers can't check a task off without at least
                        // one photo taken for it (unchecking is always fine).
                        if (
                          !task.done &&
                          requireTaskPhotos &&
                          taskPhotos.length === 0
                        ) {
                          showPhotoHint(task.id);
                          return;
                        }
                        setWorkRequestTaskDone(job.id, task.id, !task.done);
                      }}
                    >
                      <Feather
                        name={task.done ? 'check-square' : 'square'}
                        size={22}
                        color={task.done ? colors.success : colors.textSecondary}
                      />
                    </Pressable>
                    <Text
                      style={[styles.taskText, task.done && styles.taskTextDone]}
                    >
                      {task.text}
                    </Text>
                    {job.jobId && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.taskCameraButton,
                          pressed && styles.closePressed,
                        ]}
                        hitSlop={6}
                        onPress={() => takeTaskPhotos(task.id)}
                      >
                        <Feather name="camera" size={12} color={colors.primary} />
                        {taskPhotos.length > 0 && (
                          <Text style={styles.taskCameraText}>
                            {taskPhotos.length}
                          </Text>
                        )}
                      </Pressable>
                    )}
                    {job.jobId && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.taskIssueButton,
                          pressed && styles.closePressed,
                        ]}
                        hitSlop={6}
                        onPress={() =>
                          addJobIssue({
                            jobId: job.jobId!,
                            workRequestId: job.id,
                            taskId: task.id,
                          })
                        }
                      >
                        <Feather name="plus" size={12} color={colors.warning} />
                        <Text style={styles.taskIssueText}>Issue</Text>
                      </Pressable>
                    )}
                  </View>
                  {photoHintTaskId === task.id && (
                    <Text style={styles.taskPhotoHint}>
                      Take at least one photo of this task before checking it
                      off.
                    </Text>
                  )}
                  {/* The task's own photos/videos, right inside the task (they
                      also show in the Photos section below). */}
                  {taskPhotos.length > 0 && (
                    <View style={styles.taskPhotosRow}>
                      {taskPhotos.map((photo) => (
                        <Pressable
                          key={photo.id}
                          style={({ pressed }) => [
                            pressed && styles.closePressed,
                          ]}
                          onPress={() =>
                            setViewer({
                              photos: taskPhotos,
                              index: taskPhotos.findIndex(
                                (p) => p.id === photo.id
                              ),
                            })
                          }
                        >
                          {photo.isVideo ? (
                            <View
                              style={[
                                styles.taskPhotoThumb,
                                styles.taskVideoThumb,
                              ]}
                            >
                              <Feather
                                name="play-circle"
                                size={16}
                                color={colors.textPrimary}
                              />
                            </View>
                          ) : (
                            <Image
                              source={{ uri: photo.url }}
                              style={styles.taskPhotoThumb}
                              contentFit="cover"
                              transition={100}
                            />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {taskIssues.length > 0 && (
                    <View style={styles.taskIssues}>
                      {taskIssues.map((issue) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          editable
                          onPhotoPress={(photo, all) =>
                            setViewer({
                              photos: all,
                              index: all.findIndex((p) => p.id === photo.id),
                            })
                          }
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="edit-3" size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Field Notes</Text>
              <Text style={styles.notesCaption}>
                Shared with every crew on this work request.
              </Text>
            </View>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            onBlur={() => updateWorkRequestNotes(job.id, notes)}
            placeholder="Add notes from the field…"
            placeholderTextColor={colors.textTertiary}
            multiline
            inputAccessoryViewID={KEYBOARD_DONE_ID}
          />
        </View>

        {/* Photos taken here land on the PARENT job's photo wall, each linked
            back to this work request. Hidden for legacy cards with no parent job. */}
        {job.jobId && (
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Feather name="image" size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Photos</Text>
              </View>
            </View>
            <View style={styles.photoButtonsRow}>
              {Platform.OS !== 'web' && (
                <Pressable
                  style={({ pressed }) => [
                    styles.cameraButton,
                    pressed && styles.cameraPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/camera/[jobId]',
                      params: { jobId: job.jobId!, workRequestId: job.id },
                    })
                  }
                >
                  <Feather name="camera" size={18} color={colors.textOnAccent} />
                  <Text style={styles.cameraText}>Take Photos</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  pressed && styles.uploadPressed,
                ]}
                disabled={picking}
                onPress={async () => {
                  if (picking) return;
                  setPicking(true);
                  try {
                    const items = await pickJobPhotos();
                    if (items.length) {
                      await addJobPhotos({
                        jobId: job.jobId!,
                        workRequestId: job.id,
                        items,
                      });
                    }
                  } finally {
                    setPicking(false);
                  }
                }}
              >
                <Feather name="upload" size={18} color={colors.primary} />
                <Text style={styles.uploadText}>
                  {picking ? 'Opening…' : 'Upload Images'}
                </Text>
              </Pressable>
            </View>
            {photos.length > 0 && (
              <JobPhotoGrid
                photos={photos}
                onPhotoPress={(photo, sorted) =>
                  setViewer({
                    photos: sorted,
                    index: sorted.findIndex((p) => p.id === photo.id),
                  })
                }
              />
            )}
          </View>
        )}

        {/* Issues that don't belong to a task anymore (raised before tasks
            were checkable, or their task was deleted). Hidden when empty. */}
        {orphanIssues.length > 0 && (
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Feather
                  name="alert-triangle"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Issues</Text>
              </View>
            </View>
            <CollapsibleIssueList
              issues={orphanIssues}
              renderIssue={(issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  editable
                  onPhotoPress={(photo, all) =>
                    setViewer({
                      photos: all,
                      index: all.findIndex((p) => p.id === photo.id),
                    })
                  }
                />
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* Maps menu: open the jobsite address in an installed maps app, or
          copy it. Waze/Apple Maps are native-only offerings; web keeps
          Google Maps + copy. */}
      <Modal
        visible={mapsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMapsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMapsOpen(false)}
          />
          <View style={styles.mapsCard}>
            <Text style={styles.mapsAddress}>{job.address}</Text>
            {Platform.OS === 'ios' && (
              <Pressable
                style={({ pressed }) => [
                  styles.mapsButton,
                  pressed && styles.countPressed,
                ]}
                onPress={() => openMapsApp('apple')}
              >
                <Feather name="map" size={15} color={colors.primary} />
                <Text style={styles.mapsButtonText}>Apple Maps</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.mapsButton,
                pressed && styles.countPressed,
              ]}
              onPress={() => openMapsApp('google')}
            >
              <Feather name="map-pin" size={15} color={colors.primary} />
              <Text style={styles.mapsButtonText}>Google Maps</Text>
            </Pressable>
            {Platform.OS !== 'web' && (
              <Pressable
                style={({ pressed }) => [
                  styles.mapsButton,
                  pressed && styles.countPressed,
                ]}
                onPress={() => openMapsApp('waze')}
              >
                <Feather name="navigation" size={15} color={colors.primary} />
                <Text style={styles.mapsButtonText}>Waze</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.mapsButton,
                pressed && styles.countPressed,
              ]}
              onPress={copyAddress}
            >
              <Feather
                name={copied ? 'check' : 'copy'}
                size={15}
                color={colors.primary}
              />
              <Text style={styles.mapsButtonText}>
                {copied ? 'Copied' : 'Copy address'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />

      <CountEditModal
        count={editingCount}
        onClose={() => setEditingCount(null)}
        onSave={(doneField, done) => {
          if (parentJob) updateJob(parentJob.id, { [doneField]: done });
        }}
      />

      <StatusChangeModal
        status={pendingNoteStatus}
        workRequestTitle={job.title}
        windowsScope={(job.scopes ?? []).includes('Windows')}
        onConfirm={(note) => {
          if (pendingNoteStatus) {
            setWorkRequestStatus(job.id, pendingNoteStatus, note);
          }
          setPendingNoteStatus(null);
        }}
        onCancel={() => setPendingNoteStatus(null)}
      />
      </Animated.View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Transparent backdrop — the page behind stays visible above the card,
  // undimmed. The safe-area top padding is applied inline.
  sheetRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheetCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: Platform.OS === 'web' ? 0 : 20,
    borderTopRightRadius: Platform.OS === 'web' ? 0 : 20,
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  content: {
    padding: spacing.lg,
    // No top padding — the X/status row sits right at the top of the sheet.
    paddingTop: spacing.xs,
    gap: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -spacing.sm,
    zIndex: 10,
  },
  closePressed: {
    opacity: 0.6,
  },
  header: {
    gap: 2,
  },
  parentJobLink: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 26,
  },
  taskBlock: {
    gap: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  taskText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    marginTop: 1,
  },
  taskTextDone: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  taskIssueButton: {
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
  taskIssueText: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  taskCameraButton: {
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
  taskCameraText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  taskPhotoHint: {
    marginLeft: spacing.xl + spacing.sm,
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  taskPhotosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginLeft: spacing.xl + spacing.sm,
  },
  taskPhotoThumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
  },
  taskVideoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIssues: {
    marginLeft: spacing.xl + spacing.sm,
    gap: spacing.sm,
  },
  statusWrap: {
    position: 'relative',
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  statusMenu: {
    minWidth: 150,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
  },
  statusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  statusMenuItemPressed: {
    backgroundColor: colors.border,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  statusMenuText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  statusMenuTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  section: {
    gap: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  countPressed: {
    opacity: 0.7,
  },
  flashingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flashingInfo: {
    flex: 1,
  },
  infoIcon: {
    width: 24,
    alignItems: 'center',
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  notesCaption: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  mapsCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  mapsAddress: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    textAlign: 'center',
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md - 2,
  },
  mapsButtonText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 84,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cameraButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md + 2,
  },
  cameraPressed: {
    opacity: 0.85,
  },
  cameraText: {
    color: colors.textOnAccent,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md + 2,
  },
  uploadPressed: {
    backgroundColor: colors.primaryDim,
  },
  uploadText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
}));
