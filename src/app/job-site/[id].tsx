import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { CollapsibleIssueList } from '@/components/issues/CollapsibleIssueList';
import { IssueCard } from '@/components/issues/IssueCard';
import { JobDocumentsSection } from '@/components/jobsite/JobDocumentsSection';
import { FlashingMaterialBanner } from '@/components/jobsite/FlashingMaterialBanner';
import { LayoutPlanBanner } from '@/components/jobsite/LayoutPlanBanner';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import {
  PhotoScopeFilterChips,
  usePhotoScopeFilter,
} from '@/components/photos/PhotoScopeFilter';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useJobPhotos } from '@/components/photos/useJobPhotos';
import { StatusPill } from '@/components/StatusPill';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import {
  colors,
  fonts,
  modalShadow,
  radii,
  spacing,
  themed,
} from '@/theme';
import { Job } from '@/types';
import { formatCount, jobCounts } from '@/utils/jobCounts';

type SectionKey = 'issues' | 'documents' | 'work requests' | 'subjobs';

/** The section open by default: Sub-Jobs on a parent that has them, else Issues. */
const defaultSectionFor = (job?: Job): SectionKey =>
  job?.hasSubJobs && !job.parentJobId ? 'subjobs' : 'issues';

/**
 * A parent Job's page: centered cover photo + header, section cards
 * (Issues / Documents / Work Requests — one section open at a time; every
 * card stays visible, the active one carries an accent border), and the
 * photo wall.
 * Installers open it from the Jobs tab. Capture/upload float at the bottom as
 * icon buttons (no live camera on web — upload only there).
 */
export default function JobSiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const jobs = useAppStore((s) => s.jobs);
  const job = jobs.find((j) => j.id === id);
  const workers = useAppStore((s) => s.workers);
  const workRequests = useAppStore((s) => s.workRequests);
  const jobDocuments = useAppStore((s) => s.jobDocuments);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const updateJob = useAppStore((s) => s.updateJob);
  const jobIssues = useAppStore((s) => s.jobIssues);
  const addJobIssue = useAppStore((s) => s.addJobIssue);
  const me = useCurrentWorker();
  const assignFieldSuperToJob = useAppStore((s) => s.assignFieldSuperToJob);
  const flash = useAppStore((s) => s.flash);
  const photos = useJobPhotos(job?.id);
  // Pictures filters: by work-request scope, plus SGD videos.
  const photoFilter = usePhotoScopeFilter(photos);

  // This job's issues from every work request, newest first; split by status below.
  const issues = useMemo(
    () =>
      jobIssues
        .filter((issue) => issue.jobId === job?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobIssues, job?.id]
  );
  const openIssues = useMemo(
    () => issues.filter((issue) => issue.status === 'open'),
    [issues]
  );
  const resolvedIssues = useMemo(
    () => issues.filter((issue) => issue.status === 'resolved'),
    [issues]
  );

  const jobWorkRequests = useMemo(
    () =>
      workRequests
        .filter((card) => card.jobId === job?.id)
        .sort((a, b) =>
          (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        ),
    [workRequests, job?.id]
  );

  const documentCount = useMemo(
    () => jobDocuments.filter((d) => d.jobId === job?.id).length,
    [jobDocuments, job?.id]
  );

  // This job's sub-jobs (for the Sub-Jobs section) and — when the job IS a
  // sub-job — its parent (for the header link back).
  const subJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.parentJobId === job?.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [jobs, job?.id]
  );
  const parentJob = useMemo(
    () =>
      job?.parentJobId ? jobs.find((j) => j.id === job.parentJobId) : undefined,
    [jobs, job?.parentJobId]
  );

  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);
  const [picking, setPicking] = useState(false);
  // One section is always open (no "closed" state); cycle by tapping a card.
  const [section, setSection] = useState<SectionKey>(() =>
    defaultSectionFor(job)
  );
  const [resolvedOpen, setResolvedOpen] = useState(false);
  // Sub-Jobs section: name search + collapse-to-3.
  const [subJobSearch, setSubJobSearch] = useState('');
  const [subJobsExpanded, setSubJobsExpanded] = useState(false);
  // Cover popup: 'view' shows the image + change button; 'pick' the grid.
  const [coverModal, setCoverModal] = useState<'view' | 'pick' | null>(null);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fieldSupers = useMemo(
    () =>
      (job?.fieldSuperIds ?? [])
        .map((fsId) => workers.find((w) => w.id === fsId)?.name)
        .filter((name): name is string => !!name),
    [job, workers]
  );

  // Cover: the explicitly chosen photo, else the job's OLDEST photo (photos
  // arrive newest-first), else a placeholder.
  const coverPhoto = useMemo(() => {
    const chosen = job?.coverPhotoId
      ? photos.find((p) => p.id === job.coverPhotoId)
      : undefined;
    return chosen ?? (photos.length ? photos[photos.length - 1] : undefined);
  }, [job?.coverPhotoId, photos]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Platform.OS === 'web' ? '/installer-pics' : '/pics');
  };

  if (!job) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.notFound}>Job not found.</Text>
      </View>
    );
  }

  const uploadFromLibrary = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const items = await pickJobPhotos();
      if (items.length) await addJobPhotos({ jobId: job.id, items });
    } finally {
      setPicking(false);
    }
  };

  const copyAddress = async () => {
    await Clipboard.setStringAsync(job.location);
    setCopied(true);
    setTimeout(() => {
      setMapsOpen(false);
      setCopied(false);
    }, 700);
  };

  const openInMaps = () => {
    const q = encodeURIComponent(job.location);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?q=${q}`
        : Platform.OS === 'android'
          ? `geo:0,0?q=${q}`
          : `https://www.google.com/maps/search/?api=1&query=${q}`;
    void Linking.openURL(url);
    setMapsOpen(false);
  };

  // Scope counts, display-only here (totals are office-edited; done numbers
  // change from the work request popup).
  const counts = jobCounts(job);

  // Only a parent job with sub-jobs enabled gets the Sub-Jobs section/card.
  const hasSubJobsSection = !!job.hasSubJobs && !job.parentJobId;
  // Sub-Jobs list: name/PO search, then collapse to 3 unless expanded.
  const subJobQuery = subJobSearch.trim().toLowerCase();
  const filteredSubJobs = subJobs.filter(
    (s) =>
      s.name.toLowerCase().includes(subJobQuery) ||
      (s.po ?? '').toLowerCase().includes(subJobQuery)
  );
  const visibleSubJobs = subJobsExpanded
    ? filteredSubJobs
    : filteredSubJobs.slice(0, 3);

  const sectionCards: {
    key: SectionKey;
    label: string;
    sub: string;
    icon: keyof typeof Feather.glyphMap;
    tint: string;
    dim: string;
  }[] = [
    // Sub-Jobs leads the row when present (it's the default-open section).
    ...(hasSubJobsSection
      ? [
          {
            key: 'subjobs' as const,
            label: 'Sub-Jobs',
            sub: `${subJobs.length} Total`,
            icon: 'git-branch' as const,
            tint: colors.warning,
            dim: colors.warningDim,
          },
        ]
      : []),
    {
      key: 'issues',
      label: 'Issues',
      sub: `${openIssues.length} Open`,
      icon: 'alert-circle',
      tint: colors.danger,
      dim: colors.dangerDim,
    },
    {
      key: 'documents',
      label: 'Documents',
      sub: `${documentCount} Total`,
      icon: 'file-text',
      tint: colors.primary,
      dim: colors.primaryDim,
    },
    {
      key: 'work requests',
      label: 'Work Requests',
      sub: `${jobWorkRequests.length} Total`,
      icon: 'clipboard',
      tint: colors.success,
      dim: colors.successDim,
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Keyboard insets (iOS): otherwise the open keyboard covers the bottom
          of the page and it can't be scrolled fully into view. */}
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            hitSlop={12}
            onPress={close}
          >
            <Feather name="x" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Cover: a centered rounded square. Tapping opens the cover popup
            with the "Change jobsite photo" button. */}
        <Pressable
          style={({ pressed }) => [
            styles.coverWrap,
            pressed && photos.length > 0 && styles.pressed,
          ]}
          disabled={photos.length === 0}
          onPress={() => setCoverModal('view')}
        >
          {coverPhoto ? (
            <Image
              source={{ uri: coverPhoto.url }}
              style={styles.cover}
              contentFit="cover"
              transition={120}
            />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Feather name="image" size={26} color={colors.textTertiary} />
            </View>
          )}
        </Pressable>

        {/* Centered header: name, tappable location, Field Supers. A sub-job
            leads with its parent's name (a link back to the parent) on the
            SAME line as its own name, separated by a dot. */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {parentJob && (
              <>
                <Pressable
                  hitSlop={6}
                  onPress={() =>
                    router.push({
                      pathname: '/job-site/[id]',
                      params: { id: parentJob.id },
                    })
                  }
                >
                  <Text style={styles.parentLink}>{parentJob.name}</Text>
                </Pressable>
                <Text style={styles.titleDot}>·</Text>
              </>
            )}
            <Text style={styles.title}>{job.name}</Text>
            {job.status === 'Finished' && (
              <View style={styles.archivedPill}>
                <Text style={styles.archivedText}>Finished</Text>
              </View>
            )}
          </View>
          {/* The job's PO, right under the name (smaller than the name). */}
          {job.po ? <Text style={styles.poLine}>{job.po}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
            onPress={() => job.location && setMapsOpen(true)}
            disabled={!job.location}
          >
            <Feather name="map-pin" size={14} color={colors.textSecondary} />
            <Text
              style={[styles.infoValue, job.location && styles.locationText]}
              numberOfLines={2}
            >
              {job.location || 'No location set'}
            </Text>
          </Pressable>
          <View style={styles.infoRow}>
            <Feather name="user" size={14} color={colors.textSecondary} />
            <Text style={styles.infoValue} numberOfLines={2}>
              {/* The FIRST-assigned super is the job's displayed name; when
                  they're unassigned the next-oldest takes over (the list is
                  ordered by assignment date and only holds current supers). */}
              {fieldSupers.length ? fieldSupers[0] : 'No Field Super assigned'}
            </Text>
          </View>
          {/* A Field Super viewing a job they're NOT on (the Jobs tab's "All
              jobs" toggle gets them here) can take responsibility for it —
              assignment puts it on their default jobs list and in the
              displayed-super line-up. Editing never requires it. */}
          {me?.role === 'field_super' &&
            !(job.fieldSuperIds ?? []).includes(me.id) && (
              <Pressable
                style={({ pressed }) => [
                  styles.assignSelfButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  assignFieldSuperToJob(job.id, me.id);
                  flash('You are now assigned to this job', 'success');
                }}
              >
                <Feather name="user-plus" size={14} color={colors.primary} />
                <Text style={styles.assignSelfText}>
                  Assign myself to this job
                </Text>
              </Pressable>
            )}
          {/* Scope counts, "done/total" — shown once a total is set (totals
              are edited from the office surfaces; done from work requests). */}
          {counts.length > 0 && (
            <View style={styles.infoRow}>
              <Feather name="hash" size={14} color={colors.textSecondary} />
              <Text style={styles.infoValue} numberOfLines={2}>
                {counts
                  .map((c) => `${c.label} ${formatCount(c)}`)
                  .join('  ·  ')}
              </Text>
            </View>
          )}
          {/* Field-Super-only layout-plan warnings (component gates itself). */}
          <LayoutPlanBanner job={job} kind="window" />
          <LayoutPlanBanner job={job} kind="mirror" />
          <LayoutPlanBanner job={job} kind="shower" />
          {/* Missing flashing material blocks work request creation — warn
              the roles that can fix it (component gates itself). */}
          <FlashingMaterialBanner job={job} />
        </View>

        {/* Section cards — every card stays visible; the active one is
            highlighted with an accent border and its section shows below. */}
        <View style={styles.cardsRow}>
          {sectionCards.map((card) => (
            <Pressable
              key={card.key}
              style={({ pressed }) => [
                styles.sectionCard,
                card.key === section && styles.sectionCardActive,
                pressed && styles.pressed,
              ]}
              onPress={() => setSection(card.key)}
            >
              <View style={[styles.sectionIcon, { backgroundColor: card.dim }]}>
                <Feather name={card.icon} size={17} color={card.tint} />
              </View>
              <Text style={styles.sectionLabel}>{card.label}</Text>
              <Text style={styles.sectionSub}>{card.sub}</Text>
            </Pressable>
          ))}
        </View>

        {section === 'issues' && (
          <View style={styles.issuesSection}>
            <View style={styles.issuesHeaderRow}>
              <Text style={styles.sectionHeader}>Issues</Text>
              {/* Job-level issue: raised right here, attached to no work
                  request. The new card starts expanded for its description. */}
              <Pressable
                style={({ pressed }) => [
                  styles.addIssueButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => addJobIssue({ jobId: job.id })}
              >
                <Feather name="plus" size={13} color={colors.primary} />
                <Text style={styles.addIssueText}>Issue</Text>
              </Pressable>
            </View>
            {openIssues.length === 0 && resolvedIssues.length === 0 && (
              <Text style={styles.emptyText}>No issues.</Text>
            )}
            {openIssues.length > 0 && (
              <CollapsibleIssueList
                issues={openIssues}
                renderIssue={(issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    editable
                    showWorkRequestLink
                    onPhotoPress={(photo, all) =>
                      setViewer({
                        photos: all,
                        index: all.findIndex((p) => p.id === photo.id),
                      })
                    }
                  />
                )}
              />
            )}
            {/* Resolved issues live in a collapsed group at the very bottom. */}
            {resolvedIssues.length > 0 && (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.resolvedToggle,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setResolvedOpen((o) => !o)}
                >
                  <Feather
                    name={resolvedOpen ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.resolvedToggleText}>
                    Resolved ({resolvedIssues.length})
                  </Text>
                </Pressable>
                {resolvedOpen &&
                  resolvedIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      showWorkRequestLink
                      onPhotoPress={(photo, all) =>
                        setViewer({
                          photos: all,
                          index: all.findIndex((p) => p.id === photo.id),
                        })
                      }
                    />
                  ))}
              </>
            )}
          </View>
        )}

        {section === 'documents' && <JobDocumentsSection jobId={job.id} />}

        {section === 'work requests' && (
          <View style={styles.issuesSection}>
            <Text style={styles.sectionHeader}>Work Requests</Text>
            {jobWorkRequests.length === 0 ? (
              <Text style={styles.emptyText}>No work requests yet.</Text>
            ) : (
              jobWorkRequests.map((card) => {
                const tasks = card.tasks ?? [];
                const done = tasks.filter((t) => t.done).length;
                return (
                  <Pressable
                    key={card.id}
                    style={({ pressed }) => [
                      styles.workRequestRow,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/work-request/[id]',
                        params: { id: card.id },
                      })
                    }
                  >
                    <View style={styles.workRequestText}>
                      <Text style={styles.workRequestTitle} numberOfLines={1}>
                        {card.title}
                      </Text>
                      {tasks.length > 0 && (
                        <Text style={styles.workRequestMeta}>
                          {done}/{tasks.length} tasks
                        </Text>
                      )}
                    </View>
                    <StatusPill status={card.status} />
                    <Feather
                      name="chevron-right"
                      size={16}
                      color={colors.textTertiary}
                    />
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* Sub-Jobs — a section card like the others. Names render PLAIN here
            (no parent prefix inside the parent's own page); rows open each
            sub-job's page. Managed (created/toggled) from the web console. */}
        {section === 'subjobs' && hasSubJobsSection && (
          <View style={styles.issuesSection}>
            <Text style={styles.sectionHeader}>Sub-Jobs</Text>
            {/* Search once the list is long enough to warrant it (name only). */}
            {subJobs.length > 3 && (
              <View style={styles.searchRow}>
                <Feather name="search" size={14} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={subJobSearch}
                  onChangeText={setSubJobSearch}
                  placeholder="Search sub-jobs by name or PO…"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            )}
            {subJobs.length === 0 ? (
              <Text style={styles.emptyText}>No sub-jobs yet.</Text>
            ) : filteredSubJobs.length === 0 ? (
              <Text style={styles.emptyText}>No sub-jobs match.</Text>
            ) : (
              <>
                {visibleSubJobs.map((sub) => (
                  <Pressable
                    key={sub.id}
                    style={({ pressed }) => [
                      styles.workRequestRow,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/job-site/[id]',
                        params: { id: sub.id },
                      })
                    }
                  >
                    <View style={styles.workRequestText}>
                      <Text style={styles.workRequestTitle} numberOfLines={1}>
                        {sub.name}
                      </Text>
                      {sub.po || sub.location ? (
                        <Text style={styles.workRequestMeta} numberOfLines={1}>
                          {[sub.po ?? '', sub.location]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Feather
                      name="chevron-right"
                      size={16}
                      color={colors.textTertiary}
                    />
                  </Pressable>
                ))}
                {/* Collapsed to 3 by default; expand/collapse the rest. */}
                {filteredSubJobs.length > 3 && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.resolvedToggle,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setSubJobsExpanded((o) => !o)}
                  >
                    <Feather
                      name={subJobsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.resolvedToggleText}>
                      {subJobsExpanded
                        ? 'Show fewer'
                        : `View all ${filteredSubJobs.length} sub-jobs`}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        <PhotoScopeFilterChips
          filter={photoFilter.filter}
          setFilter={photoFilter.setFilter}
          options={photoFilter.options}
        />
        <JobPhotoGrid
          photos={photoFilter.filtered}
          onPhotoPress={(photo, sorted) =>
            setViewer({
              photos: sorted,
              index: sorted.findIndex((p) => p.id === photo.id),
            })
          }
        />
      </ScrollView>

      {/* Floating capture bar: icon-only camera (native) + upload, centered. */}
      <View
        style={[styles.actionBar, { bottom: insets.bottom + spacing.lg }]}
        pointerEvents="box-none"
      >
        {Platform.OS !== 'web' && (
          <Pressable
            style={({ pressed }) => [
              styles.cameraFab,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              router.push({
                pathname: '/camera/[jobId]',
                params: { jobId: job.id },
              })
            }
            accessibilityLabel="Take photos"
          >
            <Feather name="camera" size={24} color={colors.textOnAccent} />
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.uploadFab,
            (pressed || picking) && styles.pressed,
          ]}
          onPress={uploadFromLibrary}
          disabled={picking}
          accessibilityLabel="Upload photos"
        >
          <Feather name="upload" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Cover popup: the image plus "Change jobsite photo" (which flips the
          popup into a picker over the job's photos). */}
      <Modal
        visible={coverModal != null}
        transparent
        animationType="fade"
        onRequestClose={() => setCoverModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCoverModal(null)}
          />
          <View style={styles.coverCard}>
            <View style={styles.coverCardHeader}>
              <Text style={styles.modalTitle}>
                {coverModal === 'pick' ? 'Pick a jobsite photo' : 'Jobsite photo'}
              </Text>
              <Pressable onPress={() => setCoverModal(null)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {coverModal === 'view' ? (
              <>
                {coverPhoto ? (
                  <Image
                    source={{ uri: coverPhoto.url }}
                    style={styles.coverLarge}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <View style={[styles.coverLarge, styles.coverEmpty]}>
                    <Feather name="image" size={30} color={colors.textTertiary} />
                  </View>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.changeCoverButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setCoverModal('pick')}
                >
                  <Feather name="image" size={15} color={colors.textOnAccent} />
                  <Text style={styles.changeCoverText}>
                    Change jobsite photo
                  </Text>
                </Pressable>
              </>
            ) : (
              <ScrollView style={styles.pickScroll}>
                <View style={styles.pickGrid}>
                  {photos.map((photo) => (
                    <Pressable
                      key={photo.id}
                      style={styles.pickCell}
                      onPress={() => {
                        updateJob(job.id, { coverPhotoId: photo.id });
                        setCoverModal(null);
                      }}
                    >
                      <Image
                        source={{ uri: photo.url }}
                        style={[
                          styles.pickThumb,
                          photo.id === coverPhoto?.id && styles.pickThumbActive,
                        ]}
                        contentFit="cover"
                        transition={100}
                      />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Location popup: copy the address, or open it in the maps app. */}
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
            <Text style={styles.mapsAddress}>{job.location}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.mapsButton,
                pressed && styles.pressed,
              ]}
              onPress={copyAddress}
            >
              <Feather
                name={copied ? 'check' : 'copy'}
                size={15}
                color={colors.primary}
              />
              <Text style={styles.mapsButtonText}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.mapsButton,
                styles.mapsButtonPrimary,
                pressed && styles.pressed,
              ]}
              onPress={openInMaps}
            >
              <Feather name="map" size={15} color={colors.textOnAccent} />
              <Text style={styles.mapsButtonPrimaryText}>
                {Platform.OS === 'web' ? 'Open in Google Maps' : 'Open in Maps'}
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
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    // Extra air between the major blocks (header / sections / photos).
    gap: spacing.xl,
    // Clears the floating capture bar so the last grid rows stay reachable.
    paddingBottom: spacing.xxl * 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverWrap: {
    alignSelf: 'center',
  },
  cover: {
    width: 132,
    height: 132,
    borderRadius: radii.lg + 8,
    backgroundColor: colors.surfaceLight,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  parentLink: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 16,
    textAlign: 'center',
  },
  titleDot: {
    color: colors.textTertiary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: '92%',
  },
  poLine: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  archivedPill: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  archivedText: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    maxWidth: '90%',
  },
  assignSelfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  assignSelfText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  infoValue: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'center',
  },
  locationText: {
    color: colors.primary,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sectionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  sectionCardActive: {
    borderColor: colors.primary,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  sectionSub: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  issuesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addIssueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  addIssueText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  issuesSection: {
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  resolvedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    paddingVertical: spacing.sm + 2,
  },
  resolvedToggleText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  workRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  workRequestText: {
    flex: 1,
    gap: 2,
  },
  workRequestTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  workRequestMeta: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  cameraFab: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
  },
  uploadFab: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.18)',
  },
  pressed: {
    opacity: 0.85,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  coverCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...modalShadow,
    padding: spacing.lg,
    gap: spacing.md,
  },
  coverCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  coverLarge: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLight,
  },
  changeCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
  },
  changeCoverText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  pickScroll: {
    flexShrink: 1,
  },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -spacing.xs / 2,
  },
  pickCell: {
    width: '25%',
    aspectRatio: 1,
    padding: spacing.xs / 2,
  },
  pickThumb: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
  },
  pickThumbActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  mapsCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...modalShadow,
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
  mapsButtonPrimary: {
    backgroundColor: colors.primary,
  },
  mapsButtonPrimaryText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
}));
