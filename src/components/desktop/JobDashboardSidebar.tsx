import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CollapsibleIssueList } from '@/components/issues/CollapsibleIssueList';
import { IssueCard } from '@/components/issues/IssueCard';
import { FlashingMaterialBanner } from '@/components/jobsite/FlashingMaterialBanner';
import { JobDocumentsSection } from '@/components/jobsite/JobDocumentsSection';
import { LayoutPlanBanner } from '@/components/jobsite/LayoutPlanBanner';
import {
  CreateSubJobModal,
  NewSubJobInput,
} from '@/components/desktop/CreateSubJobModal';
import {
  NewWorkRequestInput,
  WorkRequestQuickView,
} from '@/components/desktop/WorkRequestQuickView';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import {
  PhotoScopeFilterChips,
  usePhotoScopeFilter,
} from '@/components/photos/PhotoScopeFilter';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useJobPhotos } from '@/components/photos/useJobPhotos';
import { StatusPill } from '@/components/StatusPill';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { editableCountDefs, formatCount, jobCounts } from '@/utils/jobCounts';
import { jobAllowsWindows } from '@/utils/jobScopes';
import { newWorkRequestPayload } from '@/utils/workRequestCreate';
import { workRequestLinksJob } from '@/utils/workRequestJobs';

type SectionKey = 'issues' | 'documents' | 'work requests' | 'subjobs';

/** The section open by default: Sub-Jobs on a parent that has them, else Issues. */
const defaultSectionFor = (job: Job | null): SectionKey =>
  job?.hasSubJobs && !job.parentJobId ? 'subjobs' : 'issues';

interface Props {
  /** The job to dashboard, or null when the sidebar is closed. */
  job: Job | null;
  onClose: () => void;
  /**
   * Whether the viewer may edit the jobsite address / flashing material inline
   * (Field Supers and the Operator; RLS matches). Gates the Edit pencil.
   */
  editable?: boolean;
  /**
   * Whether the viewer may edit ONLY the flashing material (+ its photo) via
   * the same Edit pencil — Schedulers, whose DB guard allows exactly that.
   * Defaults to `editable` (full editors already cover it).
   */
  canEditFlashing?: boolean;
  /**
   * Whether the Work Requests section shows a "+ Work Request" button that
   * opens the creation popup pre-linked to this job (web Field Supers and
   * Schedulers).
   */
  canCreateWorkRequests?: boolean;
  /**
   * Whether the viewer may toggle "This job has Sub-Jobs" and create sub-jobs
   * (schedulers may, despite not being `editable`; RLS matches). Defaults to
   * `editable`.
   */
  canManageSubJobs?: boolean;
  /**
   * Whether the viewer may DELETE this job / sub-job from the options popup
   * (Schedulers and Field Supers — and the Operator, who also keeps the
   * type-to-confirm flow in EditJobModal; RLS matches). Deleting a parent job
   * cascades its sub-jobs and every affected work request.
   */
  canDelete?: boolean;
  /** Jobs passed through to the work request quick view (the viewer's scope). */
  quickViewJobs: Job[];
  /**
   * Swap the sidebar to another job — used by the Sub-Jobs section (open a
   * sub-job) and a sub-job's parent link (back to the parent). Without it,
   * those rows render non-navigable.
   */
  onOpenJob?: (jobId: string) => void;
  /**
   * When set, the sidebar was opened on top of another view (a work request's
   * parent-job link): the top-left X becomes a back arrow calling this.
   */
  onBack?: () => void;
}

/**
 * The desktop job dashboard: a wide right-hand sidebar mirroring the mobile
 * installer job details page — cover photo (tap to view/change), centered
 * name / tappable location / Field Supers, then the Issues / Documents /
 * Work Requests section cards (one section open at a time; every card stays
 * visible and the active one carries an accent border), with
 * the photo wall always visible below. Editable viewers additionally get the
 * inline jobsite-address and flashing-material fields.
 */
export function JobDashboardSidebar({
  job,
  onClose,
  editable = false,
  canEditFlashing = editable,
  canCreateWorkRequests = false,
  canManageSubJobs = editable,
  canDelete = false,
  quickViewJobs,
  onOpenJob,
  onBack,
}: Props) {
  const workers = useAppStore((s) => s.workers);
  const jobs = useAppStore((s) => s.jobs);
  const workRequests = useAppStore((s) => s.workRequests);
  const jobIssues = useAppStore((s) => s.jobIssues);
  const jobDocuments = useAppStore((s) => s.jobDocuments);
  const updateJob = useAppStore((s) => s.updateJob);
  const addSubJob = useAppStore((s) => s.addSubJob);
  const removeJob = useAppStore((s) => s.removeJob);
  const addWorkRequest = useAppStore((s) => s.addWorkRequest);
  const deleteWorkRequest = useAppStore((s) => s.deleteWorkRequest);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const flash = useAppStore((s) => s.flash);
  const photos = useJobPhotos(job?.id);
  // Pictures filters: by work-request scope, plus SGD videos.
  const photoFilter = usePhotoScopeFilter(photos);

  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  // "+ Work Request": the creation popup, pre-linked to this job (rendered
  // shifted left so the job sidebar stays visible beside it).
  const [creatingWorkRequest, setCreatingWorkRequest] = useState(false);
  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);
  // One section is always open (no "closed" state) — you cycle by clicking
  // another card. Defaults per {@link defaultSectionFor}.
  const [section, setSection] = useState<SectionKey>(() =>
    defaultSectionFor(job)
  );
  const [resolvedOpen, setResolvedOpen] = useState(false);
  // Sub-Jobs section: name search + collapse-to-3.
  const [subJobSearch, setSubJobSearch] = useState('');
  const [subJobsExpanded, setSubJobsExpanded] = useState(false);
  // Edit toggle: address (and flashing) are read-only until this is on.
  const [editMode, setEditMode] = useState(false);
  // Cover popup: 'view' shows the image + change button; 'pick' the grid.
  const [coverModal, setCoverModal] = useState<'view' | 'pick' | null>(null);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  // Options popup; 'confirm-hide' is the deactivation confirmation step,
  // 'confirm-delete' the job/sub-job deletion one.
  const [optionsOpen, setOptionsOpen] = useState<
    'menu' | 'confirm-hide' | 'confirm-delete' | null
  >(null);
  const [subJobModalOpen, setSubJobModalOpen] = useState(false);

  // Reset transient view state when the sidebar switches to another job.
  const [lastJobId, setLastJobId] = useState(job?.id);
  if (job?.id !== lastJobId) {
    setLastJobId(job?.id);
    setSection(defaultSectionFor(job));
    setResolvedOpen(false);
    setSubJobSearch('');
    setSubJobsExpanded(false);
    setEditMode(false);
    setCoverModal(null);
    setMapsOpen(false);
    setOptionsOpen(null);
    setSubJobModalOpen(false);
    setCreatingWorkRequest(false);
  }

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
      job?.parentJobId
        ? jobs.find((j) => j.id === job.parentJobId)
        : undefined,
    [jobs, job?.parentJobId]
  );

  // Cards linked to this job — including multi-sub-job cards that list it
  // among their links, not just as the primary jobId.
  const jobWorkRequests = useMemo(
    () =>
      workRequests
        .filter((card) => (job ? workRequestLinksJob(card, job.id) : false))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [workRequests, job]
  );

  const issues = useMemo(
    () =>
      jobIssues
        .filter((issue) => issue.jobId === job?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobIssues, job?.id]
  );
  const openIssues = issues.filter((issue) => issue.status === 'open');
  const resolvedIssues = issues.filter((issue) => issue.status === 'resolved');

  const documentCount = useMemo(
    () => jobDocuments.filter((d) => d.jobId === job?.id).length,
    [jobDocuments, job?.id]
  );

  const fieldSupers = useMemo(
    () =>
      (job?.fieldSuperIds ?? [])
        .map((fsId) => workers.find((w) => w.id === fsId)?.name)
        .filter((name): name is string => !!name),
    [job, workers]
  );

  // Cover: the explicitly chosen photo, else the job's OLDEST photo (photos
  // arrive newest-first), else a placeholder — same rule as mobile.
  const coverPhoto = useMemo(() => {
    const chosen = job?.coverPhotoId
      ? photos.find((p) => p.id === job.coverPhotoId)
      : undefined;
    return chosen ?? (photos.length ? photos[photos.length - 1] : undefined);
  }, [job?.coverPhotoId, photos]);

  if (!job) return null;

  const copyAddress = async () => {
    if (!job.location) return;
    await Clipboard.setStringAsync(job.location);
    setCopied(true);
    setTimeout(() => {
      setMapsOpen(false);
      setCopied(false);
    }, 700);
  };

  const openInMaps = () => {
    if (!job.location) return;
    const q = encodeURIComponent(job.location);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
    setMapsOpen(false);
  };

  const uploadPhotos = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const items = await pickJobPhotos();
      if (items.length) await addJobPhotos({ jobId: job.id, items });
    } finally {
      setPicking(false);
    }
  };

  const openPhoto = (photo: DisplayPhoto, all: DisplayPhoto[]) =>
    setViewer({ photos: all, index: all.findIndex((p) => p.id === photo.id) });

  // Scope counts: display any pair with a total; edit-mode inputs are gated
  // by the job's scopes (every scope's pair, not just Windows/Mirrors).
  const counts = jobCounts(job);
  const windowsAllowed = jobAllowsWindows(job);
  const editCounts = editableCountDefs(job);
  // Flashing-only editors (Schedulers) get the pencil just on windows jobs —
  // on any other job their edit mode would have nothing to edit.
  const showEditPencil = editable || (canEditFlashing && windowsAllowed);

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
    <View style={styles.panel}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* X top-left, mirroring the mobile page; edit toggle + options
            top-right (options: sub-job controls, parent jobs only). */}
        <View style={styles.topRow}>
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            hitSlop={12}
            onPress={onBack ?? onClose}
          >
            <Feather
              name={onBack ? 'arrow-left' : 'x'}
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          {(showEditPencil || canManageSubJobs || canDelete) && (
            <View style={styles.topRowActions}>
              {showEditPencil && (
                <Pressable
                  style={({ pressed }) => [
                    styles.optionsButton,
                    editMode && styles.editButtonActive,
                    pressed && styles.pressed,
                  ]}
                  hitSlop={8}
                  onPress={() => setEditMode((on) => !on)}
                >
                  <Feather
                    name={editMode ? 'check' : 'edit-2'}
                    size={17}
                    color={
                      editMode ? colors.textOnAccent : colors.textSecondary
                    }
                  />
                </Pressable>
              )}
              {((canManageSubJobs && !job.parentJobId) || canDelete) && (
                <Pressable
                  style={({ pressed }) => [
                    styles.optionsButton,
                    pressed && styles.pressed,
                  ]}
                  hitSlop={8}
                  onPress={() => setOptionsOpen('menu')}
                >
                  <Feather
                    name="more-horizontal"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Cover: centered rounded square; tap to view / change. */}
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
                  disabled={!onOpenJob}
                  onPress={() => onOpenJob?.(parentJob.id)}
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
          {job.po ? <Text style={styles.poLine}>PO {job.po}</Text> : null}
          {/* The one jobsite address: a tappable maps link, or an inline
              editor while Edit mode is on (no duplicate field below).
              Flashing-only editors (Schedulers) keep the read-only link. */}
          {editMode && editable ? (
            <View style={styles.headerEditRow}>
              <Feather name="map-pin" size={14} color={colors.textSecondary} />
              <AddressInput
                key={`addr-${job.id}`}
                value={job.location ?? ''}
                onCommit={(location) => updateJob(job.id, { location })}
              />
            </View>
          ) : (
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
          )}
          <View style={styles.infoRow}>
            <Feather name="user" size={14} color={colors.textSecondary} />
            <Text style={styles.infoValue} numberOfLines={2}>
              {fieldSupers.length
                ? fieldSupers.join(', ')
                : 'No Field Super assigned'}
            </Text>
          </View>
          {/* Scope counts, "done/total" — shown once a total is set. */}
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
          {/* Missing flashing material blocks work request creation — warn
              the roles that can fix it (component gates itself). */}
          <FlashingMaterialBanner job={job} />
        </View>

        {/* Edit mode extras: flashing material (window jobs) and the scope
            counts' done/total numbers. The address is edited up in the
            header. Flashing-only editors (Schedulers) see just the flashing
            field here. */}
        {editMode &&
          ((canEditFlashing && windowsAllowed) ||
            (editable && editCounts.length > 0)) && (
          <View style={styles.editBlock}>
            {canEditFlashing && windowsAllowed && (
              <>
                <Text style={styles.fieldLabel}>
                  Window Opening Flashing Material
                </Text>
                <View style={styles.flashRow}>
                  <FlashingInput
                    key={`flash-${job.id}`}
                    value={job.flashingMaterial ?? ''}
                    onCommit={(flashingMaterial) =>
                      updateJob(job.id, { flashingMaterial })
                    }
                  />
                  <FlashingPhotoField job={job} editable />
                </View>
              </>
            )}
            {/* One done/total editor per count pair the job's scopes cover.
                The wrapper keeps the label/editor spacing of the parent's gap. */}
            {editable &&
              editCounts.map((def) => (
              <View key={`${def.doneField}-${job.id}`} style={styles.countPair}>
                <Text style={styles.fieldLabel}>
                  {def.label} (done / total)
                </Text>
                <CountPairEditor
                  done={job[def.doneField]}
                  total={job[def.totalField]}
                  onCommit={(done, total) =>
                    updateJob(job.id, {
                      [def.doneField]: done,
                      [def.totalField]: total,
                    })
                  }
                />
              </View>
            ))}
          </View>
        )}

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
              <View
                style={[styles.sectionIcon, { backgroundColor: card.dim }]}
              >
                <Feather name={card.icon} size={17} color={card.tint} />
              </View>
              <Text style={styles.sectionLabel}>{card.label}</Text>
              <Text style={styles.sectionSub}>{card.sub}</Text>
            </Pressable>
          ))}
        </View>

        {section === 'issues' && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Issues</Text>
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
                    showWorkRequestLink
                    onPhotoPress={openPhoto}
                  />
                )}
              />
            )}
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
                      onPhotoPress={openPhoto}
                    />
                  ))}
              </>
            )}
          </View>
        )}

        {section === 'documents' && <JobDocumentsSection jobId={job.id} />}

        {section === 'work requests' && (
          <View style={styles.section}>
            <View style={styles.picturesHeader}>
              <Text style={styles.sectionHeader}>Work Requests</Text>
              {canCreateWorkRequests && (
                <Pressable
                  style={({ pressed }) => [
                    styles.uploadButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setCreatingWorkRequest(true)}
                >
                  <Feather name="plus" size={13} color={colors.primary} />
                  <Text style={styles.uploadText}>Work Request</Text>
                </Pressable>
              )}
            </View>
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
                    onPress={() => setViewingCardId(card.id)}
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

        {/* Sub-Jobs — a section card like the others (never on sub-jobs
            themselves; one level only). Names render PLAIN here — no parent
            prefix inside the parent's own page. */}
        {section === 'subjobs' && hasSubJobsSection && (
          <View style={styles.section}>
            <View style={styles.picturesHeader}>
              <Text style={styles.sectionHeader}>Sub-Jobs</Text>
              {canManageSubJobs && (
                <Pressable
                  style={({ pressed }) => [
                    styles.uploadButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setSubJobModalOpen(true)}
                >
                  <Feather name="plus" size={13} color={colors.primary} />
                  <Text style={styles.uploadText}>New Sub-Job</Text>
                </Pressable>
              )}
            </View>
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
                {visibleSubJobs.map((sub) => {
                  const count = workRequests.filter((c) =>
                    workRequestLinksJob(c, sub.id)
                  ).length;
                  return (
                    <Pressable
                      key={sub.id}
                      style={({ pressed }) => [
                        styles.workRequestRow,
                        pressed && styles.pressed,
                      ]}
                      disabled={!onOpenJob}
                      onPress={() => onOpenJob?.(sub.id)}
                    >
                      <View style={styles.workRequestText}>
                        <Text style={styles.workRequestTitle} numberOfLines={1}>
                          {sub.name}
                        </Text>
                        <Text style={styles.workRequestMeta} numberOfLines={1}>
                          {sub.po ? `PO ${sub.po} · ` : ''}
                          {count} {count === 1 ? 'work request' : 'work requests'}
                          {sub.location ? ` · ${sub.location}` : ''}
                        </Text>
                      </View>
                      {sub.status === 'Finished' && (
                        <View style={styles.archivedPill}>
                          <Text style={styles.archivedText}>Finished</Text>
                        </View>
                      )}
                      <Feather
                        name="chevron-right"
                        size={16}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  );
                })}
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

        {/* Photo wall — always visible, like mobile. */}
        <View style={styles.section}>
          <View style={styles.picturesHeader}>
            <Text style={styles.sectionHeader}>Pictures</Text>
            <Pressable
              style={({ pressed }) => [
                styles.uploadButton,
                pressed && styles.pressed,
              ]}
              onPress={uploadPhotos}
              disabled={picking}
            >
              <Feather name="upload" size={13} color={colors.primary} />
              <Text style={styles.uploadText}>
                {picking ? 'Opening…' : 'Upload'}
              </Text>
            </Pressable>
          </View>
          <PhotoScopeFilterChips
            filter={photoFilter.filter}
            setFilter={photoFilter.setFilter}
            options={photoFilter.options}
          />
          <JobPhotoGrid photos={photoFilter.filtered} onPhotoPress={openPhoto} />
        </View>
      </ScrollView>

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
                    <Feather
                      name="image"
                      size={30}
                      color={colors.textTertiary}
                    />
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

      {/* Location popup: copy the address, or open it in Google Maps. */}
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
                Open in Google Maps
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Options popup: the "This job has Sub-Jobs" toggle (parent jobs) and
          Delete (jobs and sub-jobs alike). Deactivating sub-jobs asks for
          confirmation — it hides the section, the sub-jobs live on; deleting
          confirms too — it cascades sub-jobs and work requests. */}
      <Modal
        visible={optionsOpen != null}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsOpen(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOptionsOpen(null)}
          />
          <View style={styles.mapsCard}>
            {optionsOpen === 'confirm-delete' ? (
              <>
                <Text style={styles.optionsTitle}>
                  Delete “{job.name}”?
                </Text>
                <Text style={styles.optionsHint}>
                  {job.parentJobId
                    ? 'This permanently deletes the sub-job and every work request on it.'
                    : subJobs.length > 0
                      ? `This permanently deletes the job, its ${
                          subJobs.length === 1
                            ? 'sub-job'
                            : `${subJobs.length} sub-jobs`
                        }, and every work request on them.`
                      : 'This permanently deletes the job and every work request on it.'}{' '}
                  This can&apos;t be undone.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.mapsButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setOptionsOpen('menu')}
                >
                  <Text style={styles.mapsButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.mapsButton,
                    styles.deleteButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    removeJob(job.id);
                    flash(
                      `${job.parentJobId ? 'Sub-job' : 'Job'} "${job.name}" deleted`,
                      'success'
                    );
                    setOptionsOpen(null);
                    onClose();
                  }}
                >
                  <Feather
                    name="trash-2"
                    size={15}
                    color={colors.textOnAccent}
                  />
                  <Text style={styles.deleteButtonText}>
                    Delete {job.parentJobId ? 'Sub-Job' : 'Job'}
                  </Text>
                </Pressable>
              </>
            ) : optionsOpen === 'confirm-hide' ? (
              <>
                <Text style={styles.optionsTitle}>Hide Sub-Jobs?</Text>
                <Text style={styles.optionsHint}>
                  This hides the Sub-Jobs section on this job&apos;s page. The{' '}
                  {subJobs.length === 1
                    ? 'sub-job itself is'
                    : `${subJobs.length} sub-jobs themselves are`}{' '}
                  kept and stay where they already show.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.mapsButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setOptionsOpen('menu')}
                >
                  <Text style={styles.mapsButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.mapsButton,
                    styles.mapsButtonPrimary,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    updateJob(job.id, { hasSubJobs: false });
                    setOptionsOpen(null);
                  }}
                >
                  <Text style={styles.mapsButtonPrimaryText}>
                    Hide Sub-Jobs section
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.optionsTitle}>Options</Text>
                {canManageSubJobs && !job.parentJobId && (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.optionRow,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        if (job.hasSubJobs) {
                          setOptionsOpen('confirm-hide');
                        } else {
                          updateJob(job.id, { hasSubJobs: true });
                          setOptionsOpen(null);
                        }
                      }}
                    >
                      <Feather
                        name={job.hasSubJobs ? 'check-square' : 'square'}
                        size={18}
                        color={
                          job.hasSubJobs ? colors.primary : colors.textSecondary
                        }
                      />
                      <Text style={styles.optionRowText}>
                        This job has Sub-Jobs
                      </Text>
                    </Pressable>
                    <Text style={styles.optionsHint}>
                      Adds a Sub-Jobs section to this job&apos;s page, where the
                      job can be broken into pieces that work exactly like jobs.
                    </Text>
                  </>
                )}
                {canDelete && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.optionRow,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setOptionsOpen('confirm-delete')}
                  >
                    <Feather name="trash-2" size={18} color={colors.danger} />
                    <Text style={[styles.optionRowText, styles.optionRowDanger]}>
                      Delete this {job.parentJobId ? 'Sub-Job' : 'Job'}…
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      <CreateSubJobModal
        parentJob={subJobModalOpen ? job : null}
        onClose={() => setSubJobModalOpen(false)}
        onSubmit={(input: NewSubJobInput) => {
          const created = addSubJob({ parentJobId: job.id, ...input });
          if (created) {
            flash(`Sub-job "${job.name} ${created.name}" created`, 'success');
          }
        }}
      />

      {/* Viewing opens the centered popup; "+ Work Request" reuses it in
          create mode, shifted left so this sidebar stays visible beside it
          and pre-linked to this job. */}
      <WorkRequestQuickView
        workRequestId={viewingCardId}
        creating={creatingWorkRequest}
        initialJobId={job.id}
        popupShifted={creatingWorkRequest}
        jobs={quickViewJobs}
        onClose={() => {
          setViewingCardId(null);
          setCreatingWorkRequest(false);
        }}
        onDelete={(id) => {
          const title = jobWorkRequests.find((c) => c.id === id)?.title;
          deleteWorkRequest(id);
          setViewingCardId(null);
          flash(
            title ? `Work Request "${title}" deleted` : 'Work Request deleted',
            'success'
          );
        }}
        onCreate={(input: NewWorkRequestInput) => {
          addWorkRequest(newWorkRequestPayload(input, jobs));
          flash(`Work Request "${input.title}" created`, 'success');
        }}
      />

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

/** Inline editable jobsite address; commits on blur. */
function AddressInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => onCommit(text.trim());
  return (
    <TextInput
      style={styles.addressInput}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="123 Main St, Park City, UT"
      placeholderTextColor={colors.textTertiary}
    />
  );
}

/**
 * Done / total inputs for one scope count; commits on blur. Empty total
 * clears the pair from display (a count shows once its total is set).
 */
function CountPairEditor({
  done,
  total,
  onCommit,
}: {
  done: number | undefined;
  total: number | undefined;
  onCommit: (done: number | undefined, total: number | undefined) => void;
}) {
  const [doneText, setDoneText] = useState(done != null ? String(done) : '');
  const [totalText, setTotalText] = useState(
    total != null ? String(total) : ''
  );
  const parse = (text: string): number | undefined => {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  };
  const commit = () => onCommit(parse(doneText), parse(totalText));
  return (
    <View style={styles.countRow}>
      <TextInput
        style={[styles.addressInput, styles.countInput]}
        value={doneText}
        onChangeText={setDoneText}
        onBlur={commit}
        onEndEditing={commit}
        placeholder="0"
        placeholderTextColor={colors.textTertiary}
        keyboardType="number-pad"
      />
      <Text style={styles.countSlash}>/</Text>
      <TextInput
        style={[styles.addressInput, styles.countInput]}
        value={totalText}
        onChangeText={setTotalText}
        onBlur={commit}
        onEndEditing={commit}
        placeholder="total"
        placeholderTextColor={colors.textTertiary}
        keyboardType="number-pad"
      />
    </View>
  );
}

/** Inline editable flashing material; commits on blur (empty clears). */
function FlashingInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string | undefined) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    const trimmed = text.trim();
    onCommit(trimmed || undefined);
  };
  return (
    <TextInput
      style={[styles.addressInput, styles.flashInput]}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="e.g. regular rainbuster"
      placeholderTextColor={colors.textTertiary}
    />
  );
}

const styles = themed(() =>
  StyleSheet.create({
    panel: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 640,
      maxWidth: '88%',
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      ...modalShadow,
      padding: spacing.xl,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topRowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    optionsButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      padding: spacing.xs + 2,
    },
    editButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    headerEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      alignSelf: 'stretch',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
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
      outlineWidth: 0,
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
    poLine: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 14,
      textAlign: 'center',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    optionRowText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    optionRowDanger: {
      color: colors.danger,
    },
    optionsHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
    },
    optionsTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 16,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      gap: spacing.xl,
      paddingBottom: spacing.xl,
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
    titleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      maxWidth: '92%',
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
    editBlock: {
      gap: spacing.xs + 2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    countPair: {
      gap: spacing.xs + 2,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    addressInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
      outlineWidth: 0,
    },
    flashRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    flashInput: {
      flex: 1,
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    countInput: {
      flex: 0,
      width: 110,
    },
    countSlash: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 15,
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
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyText: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
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
    picturesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 1,
    },
    uploadText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
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
    deleteButton: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    deleteButtonText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 14,
    },
  })
);
