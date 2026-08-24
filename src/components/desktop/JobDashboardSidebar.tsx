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
import { Combobox, MultiCombobox } from '@/components/desktop/Combobox';
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
import { FieldSuperPicker } from '@/components/desktop/FieldSuperPicker';
import { StatusPill } from '@/components/StatusPill';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job, JOB_SCOPES, JobScope } from '@/types';
import {
  editableCountDefs,
  formatCount,
  JOB_COUNT_DEFS,
  jobCounts,
} from '@/utils/jobCounts';
import { SUB_JOB_TYPE_PRESETS } from '@/utils/jobName';
import { poTaken } from '@/utils/jobPo';
import { jobAllowsWindows } from '@/utils/jobScopes';
import { newWorkRequestPayload } from '@/utils/workRequestCreate';
import { workRequestLinksJob } from '@/utils/workRequestJobs';

type SectionKey = 'issues' | 'documents' | 'work requests' | 'subjobs';

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));

/** The section open by default: Sub-Jobs on a parent that has them, else Issues. */
const defaultSectionFor = (job: Job | null): SectionKey =>
  job?.hasSubJobs && !job.parentJobId ? 'subjobs' : 'issues';

interface Props {
  /** The job to dashboard, or null when the sidebar is closed. */
  job: Job | null;
  onClose: () => void;
  /**
   * Whether the viewer may edit the job's details inline — name, PO, jobsite
   * address, flashing material, scopes/counts, builder, and the assigned
   * Field Supers (Field Supers, Schedulers, and the Operator; RLS matches).
   * Gates the Edit pencil.
   */
  editable?: boolean;
  /**
   * Whether the viewer may edit ONLY the flashing material (+ its photo) via
   * the same Edit pencil. Defaults to `editable` (full editors already cover
   * it) — kept for any future flashing-only role.
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
   * (RLS matches). Defaults to `editable`.
   */
  canManageSubJobs?: boolean;
  /**
   * Whether the viewer may ARCHIVE this job / sub-job from the edit-mode
   * controls (Schedulers and Field Supers — and the Operator, whose flow
   * lives in EditJobModal; RLS matches). Archiving a parent job takes its
   * sub-jobs (and hides their work requests) with it; it's recoverable from
   * the jobs pages' Archived section, where permanent deletion also lives.
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
  const me = useCurrentWorker();
  const workers = useAppStore((s) => s.workers);
  const jobs = useAppStore((s) => s.jobs);
  const workRequests = useAppStore((s) => s.workRequests);
  const assignFieldSuperToJob = useAppStore((s) => s.assignFieldSuperToJob);
  const jobIssues = useAppStore((s) => s.jobIssues);
  const jobDocuments = useAppStore((s) => s.jobDocuments);
  const updateJob = useAppStore((s) => s.updateJob);
  const addJobIssue = useAppStore((s) => s.addJobIssue);
  const addSubJob = useAppStore((s) => s.addSubJob);
  const archiveJob = useAppStore((s) => s.archiveJob);
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
  // Sub-Jobs section: search (behind the header's search icon) + collapse-to-3.
  const [subJobSearch, setSubJobSearch] = useState('');
  const [subJobSearchOpen, setSubJobSearchOpen] = useState(false);
  const [subJobsExpanded, setSubJobsExpanded] = useState(false);
  // Edit toggle: address (and flashing) are read-only until this is on.
  const [editMode, setEditMode] = useState(false);
  // Cover popup: 'view' shows the image + change button; 'pick' the grid.
  const [coverModal, setCoverModal] = useState<'view' | 'pick' | null>(null);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  // Confirmation popups for the edit-mode sub-job/delete controls:
  // 'confirm-hide' deactivates the Sub-Jobs section, 'confirm-delete' deletes.
  const [optionsOpen, setOptionsOpen] = useState<
    'confirm-hide' | 'confirm-delete' | null
  >(null);
  const [subJobModalOpen, setSubJobModalOpen] = useState(false);
  // Enabling "This job has Sub-Jobs": the required what-are-they-called
  // picker is open (choosing a type is what actually turns the section on).
  const [subJobTypePicking, setSubJobTypePicking] = useState(false);
  const [customSubJobType, setCustomSubJobType] = useState('');

  // Reset transient view state when the sidebar switches to another job.
  const [lastJobId, setLastJobId] = useState(job?.id);
  if (job?.id !== lastJobId) {
    setLastJobId(job?.id);
    setSection(defaultSectionFor(job));
    setResolvedOpen(false);
    setSubJobSearch('');
    setSubJobSearchOpen(false);
    setSubJobsExpanded(false);
    setEditMode(false);
    setCoverModal(null);
    setMapsOpen(false);
    setOptionsOpen(null);
    setSubJobModalOpen(false);
    setSubJobTypePicking(false);
    setCustomSubJobType('');
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

  // Roster for the edit-mode assignment picker.
  const fieldSuperRoster = useMemo(
    () => workers.filter((w) => w.role === 'field_super'),
    [workers]
  );

  // Every builder ever applied to a job — the Builder edit field's options.
  const builderOptions = useMemo(() => {
    const names = new Set<string>();
    jobs.forEach((j) => {
      const b = j.builder?.trim();
      if (b) names.add(b);
    });
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((b) => ({ value: b, label: b }));
  }, [jobs]);

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

  // Edit-mode scopes editor. Dropping a scope also clears its now-hidden
  // done/total counts (and the flashing material when Windows goes) so stale
  // numbers don't keep displaying. Empty = legacy "not narrowed" (all allowed),
  // same as the Operator's Edit-job modal.
  const changeScopes = (vals: string[]) => {
    const next = vals as JobScope[];
    const nextScopes = next.length > 0 ? next : undefined;
    const allows = (scope: JobScope) =>
      nextScopes == null || nextScopes.includes(scope);
    const clears: Partial<Job> = {};
    for (const def of JOB_COUNT_DEFS) {
      if (
        !allows(def.scope) &&
        (job[def.doneField] != null || job[def.totalField] != null)
      ) {
        clears[def.doneField] = undefined;
        clears[def.totalField] = undefined;
      }
    }
    if (!allows('Windows') && job.flashingMaterial) {
      clears.flashingMaterial = undefined;
    }
    updateJob(job.id, { scopes: nextScopes, ...clears });
  };
  // The pencil is the only top-right control (the old 3-dots menu is gone) —
  // sub-job managers and deleters need it even when nothing else is editable.
  const showEditPencil =
    editable ||
    (canEditFlashing && windowsAllowed) ||
    (canManageSubJobs && !job.parentJobId) ||
    canDelete;

  // Picking a type is what enables "This job has Sub-Jobs" — the two persist
  // together, and sub-job creation prefixes the singular form ("Lot 159").
  const chooseSubJobType = (type: string) => {
    updateJob(job.id, { hasSubJobs: true, subJobType: type });
    setSubJobTypePicking(false);
    setCustomSubJobType('');
  };

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
        {/* X top-left, mirroring the mobile page; the Edit pencil top-right
            (edit mode also holds the sub-job controls and delete — the old
            3-dots menu is gone). */}
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
          {showEditPencil && (
            <View style={styles.topRowActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.optionsButton,
                  editMode && styles.editButtonActive,
                  pressed && styles.pressed,
                ]}
                hitSlop={8}
                onPress={() => {
                  setEditMode((on) => !on);
                  setSubJobTypePicking(false);
                  setCustomSubJobType('');
                }}
              >
                <Feather
                  name={editMode ? 'check' : 'edit-2'}
                  size={17}
                  color={
                    editMode ? colors.textOnAccent : colors.textSecondary
                  }
                />
                {/* Every edit already autosaved on blur/tap — the label just
                    says what leaving edit mode means. */}
                {editMode && (
                  <Text style={styles.editButtonLabel}>Save changes</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Edit-mode banner — the unmissable "you are editing" signal, paired
            with the accented Save pill above and the form below. */}
        {editMode && (
          <View style={styles.editBanner}>
            <Feather name="edit-3" size={16} color={colors.primary} />
            <View style={styles.editBannerText}>
              <Text style={styles.editBannerTitle}>Editing job details</Text>
              <Text style={styles.editBannerHint}>
                Changes save as you go — click “Save changes” when you’re done.
              </Text>
            </View>
          </View>
        )}

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
          {/* The job's PO, right under the name (smaller than the name). Its
              editor lives in the edit form below. */}
          {job.po ? <Text style={styles.poLine}>{job.po}</Text> : null}
          {/* The one jobsite address: a tappable maps link (edited via the
              form below — the header keeps displaying the saved value). */}
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
          {/* A Field Super viewing a job they're NOT on (the jobs page's "All
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
          <LayoutPlanBanner job={job} kind="shower" />
          {/* Missing flashing material blocks work request creation — warn
              the roles that can fix it (component gates itself). */}
          <FlashingMaterialBanner job={job} />
        </View>

        {/* The edit form: every editable job-detail field in one labeled,
            borderless stack — name / PO / address first, then flashing,
            scopes, counts, Builder, Field Supers, the "This job has
            Sub-Jobs" controls, and (divider-separated) Archive. */}
        {editMode &&
          ((canEditFlashing && windowsAllowed) ||
            editable ||
            (canManageSubJobs && !job.parentJobId) ||
            canDelete) && (
          <View style={styles.editBlock}>
            {editable && (
              <>
                <View style={styles.countPair}>
                  <Text style={styles.fieldLabel}>Job name</Text>
                  <NameInput
                    key={`name-${job.id}`}
                    value={job.name}
                    onCommit={(name) => updateJob(job.id, { name })}
                  />
                </View>
                <View style={styles.countPair}>
                  <Text style={styles.fieldLabel}>PO number</Text>
                  <PoInput
                    key={`po-${job.id}`}
                    value={job.po ?? ''}
                    onCommit={(po) => {
                      if (poTaken(po, jobs, job.id)) {
                        flash(
                          'That PO is already used by another job — change discarded.',
                          'warning'
                        );
                        return;
                      }
                      updateJob(job.id, { po });
                    }}
                  />
                </View>
                <View style={styles.countPair}>
                  <Text style={styles.fieldLabel}>Jobsite address</Text>
                  <AddressInput
                    key={`addr-${job.id}`}
                    value={job.location ?? ''}
                    onCommit={(location) => updateJob(job.id, { location })}
                  />
                </View>
              </>
            )}
            {canEditFlashing && windowsAllowed && (
              <View style={styles.countPair}>
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
              </View>
            )}
            {/* Scopes — the trades this job covers. Changing them re-gates
                the count editors below (and the flashing field) live. */}
            {editable && (
              <View style={styles.countPair}>
                <Text style={styles.fieldLabel}>Scopes</Text>
                <MultiCombobox
                  key={`scopes-${job.id}`}
                  values={job.scopes ?? []}
                  options={SCOPE_OPTIONS}
                  onChange={changeScopes}
                  placeholder="Windows, Mirrors, Storefront…"
                />
                <Text style={styles.scopeHint}>
                  Removing a scope also clears its done/total counts. No scopes
                  selected means the job isn&apos;t narrowed — every scope (and
                  count) stays available.
                </Text>
              </View>
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
            {/* Builder — dropdown of every builder used on a past job; typing
                an unmatched name + Enter creates it. */}
            {editable && (
              <View style={styles.countPair}>
                <Text style={styles.fieldLabel}>Builder</Text>
                <Combobox
                  key={`builder-${job.id}`}
                  value={job.builder ?? ''}
                  options={builderOptions}
                  allowCustom
                  placeholder="Type to search or add a builder…"
                  onChange={(builder) =>
                    updateJob(job.id, {
                      builder: builder.trim() || undefined,
                    })
                  }
                />
              </View>
            )}
            {/* Assigned Field Supers — chips commit on tap. A sub-job inherits
                its parent's supers (store + DB trigger), so only parents get
                the picker. */}
            {editable && !job.parentJobId && (
              <View style={styles.countPair}>
                <Text style={styles.fieldLabel}>Field supers</Text>
                <FieldSuperPicker
                  fieldSupers={fieldSuperRoster}
                  selected={job.fieldSuperIds ?? []}
                  onToggle={(id) => {
                    const ids = job.fieldSuperIds ?? [];
                    updateJob(job.id, {
                      fieldSuperIds: ids.includes(id)
                        ? ids.filter((x) => x !== id)
                        : [...ids, id],
                    });
                  }}
                />
              </View>
            )}
            {/* "This job has Sub-Jobs" — enabling requires choosing what the
                sub-jobs are called (it drives sub-job naming: "Lot 159"). */}
            {canManageSubJobs && !job.parentJobId && (
              <View style={styles.countPair}>
                <View style={styles.editDivider} />
                <Pressable
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (job.hasSubJobs) {
                      setOptionsOpen('confirm-hide');
                    } else {
                      setSubJobTypePicking((on) => !on);
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
                {(subJobTypePicking || job.hasSubJobs) && (
                  <View style={styles.subJobTypeBlock}>
                    <Text style={styles.optionsHint}>
                      {job.hasSubJobs
                        ? 'What the sub-jobs are called — used when naming new ones:'
                        : 'What are the sub-jobs called? Choosing one turns the section on.'}
                    </Text>
                    <View style={styles.typeChipRow}>
                      {[
                        ...SUB_JOB_TYPE_PRESETS,
                        // A saved custom term renders as its own (active) chip.
                        ...(job.subJobType &&
                        !(SUB_JOB_TYPE_PRESETS as readonly string[]).includes(
                          job.subJobType
                        )
                          ? [job.subJobType]
                          : []),
                      ].map((type) => {
                        const active =
                          job.hasSubJobs && job.subJobType === type;
                        return (
                          <Pressable
                            key={type}
                            style={({ pressed }) => [
                              styles.typeChip,
                              active && styles.typeChipActive,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => chooseSubJobType(type)}
                          >
                            <Text
                              style={[
                                styles.typeChipText,
                                active && styles.typeChipTextActive,
                              ]}
                            >
                              {type}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      style={styles.customTypeInput}
                      value={customSubJobType}
                      onChangeText={setCustomSubJobType}
                      placeholder="Custom term — press Enter to use it"
                      placeholderTextColor={colors.textTertiary}
                      onSubmitEditing={() => {
                        const t = customSubJobType.trim();
                        if (t) chooseSubJobType(t);
                      }}
                    />
                  </View>
                )}
              </View>
            )}
            {/* Archive — the "delete" action, with its confirmation popup.
                Recoverable from the jobs pages' Archived section; permanent
                deletion lives only there. */}
            {canDelete && (
              <>
                <View style={styles.editDivider} />
                <Pressable
                  style={({ pressed }) => [
                    styles.archiveRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setOptionsOpen('confirm-delete')}
                >
                  <Feather name="archive" size={18} color={colors.danger} />
                  <Text style={[styles.optionRowText, styles.optionRowDanger]}>
                    Archive this {job.parentJobId ? 'Sub-Job' : 'Job'}…
                  </Text>
                </Pressable>
              </>
            )}
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
            <View style={styles.picturesHeader}>
              <Text style={styles.sectionHeader}>Issues</Text>
              {/* Job-level issue: raised right here, attached to no work
                  request. The new card starts expanded for its description. */}
              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => addJobIssue({ jobId: job.id })}
              >
                <Feather name="plus" size={13} color={colors.primary} />
                <Text style={styles.uploadText}>Issue</Text>
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
              <View style={styles.sectionHeaderActions}>
                {/* The search icon expands/collapses the filter field. */}
                {subJobs.length > 0 && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.iconButton,
                      subJobSearchOpen && styles.iconButtonActive,
                      pressed && styles.pressed,
                    ]}
                    hitSlop={6}
                    onPress={() => {
                      if (subJobSearchOpen) setSubJobSearch('');
                      setSubJobSearchOpen(!subJobSearchOpen);
                    }}
                  >
                    <Feather
                      name={subJobSearchOpen ? 'x' : 'search'}
                      size={14}
                      color={
                        subJobSearchOpen
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                  </Pressable>
                )}
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
            </View>
            {subJobSearchOpen && (
              <View style={styles.searchRow}>
                <Feather name="search" size={14} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={subJobSearch}
                  onChangeText={setSubJobSearch}
                  placeholder="Search sub-jobs by name or PO…"
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
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
                          {sub.po ? `${sub.po} · ` : ''}
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

      {/* Confirmation popups for the edit-mode controls. Deactivating
          sub-jobs asks for confirmation — it hides the section, the sub-jobs
          live on; deleting confirms too — it cascades sub-jobs and work
          requests. */}
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
                  Archive “{job.name}”?
                </Text>
                <Text style={styles.optionsHint}>
                  {job.parentJobId
                    ? 'This archives the sub-job and hides its work requests everywhere.'
                    : subJobs.length > 0
                      ? `This archives the job, its ${
                          subJobs.length === 1
                            ? 'sub-job'
                            : `${subJobs.length} sub-jobs`
                        }, and hides their work requests everywhere.`
                      : 'This archives the job and hides its work requests everywhere.'}{' '}
                  Restore it — or permanently delete it — from the Archived
                  section on the Jobs page.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.mapsButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setOptionsOpen(null)}
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
                    archiveJob(job.id);
                    flash(
                      `${job.parentJobId ? 'Sub-job' : 'Job'} "${job.name}" archived`,
                      'success'
                    );
                    setOptionsOpen(null);
                    onClose();
                  }}
                >
                  <Feather
                    name="archive"
                    size={15}
                    color={colors.textOnAccent}
                  />
                  <Text style={styles.deleteButtonText}>
                    Archive {job.parentJobId ? 'Sub-Job' : 'Job'}
                  </Text>
                </Pressable>
              </>
            ) : (
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
                  onPress={() => setOptionsOpen(null)}
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

/** Inline editable job name; commits on blur (empty reverts — required). */
function NameInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else if (!trimmed) setText(value);
  };
  return (
    <TextInput
      style={styles.addressInput}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="Job name"
      placeholderTextColor={colors.textTertiary}
    />
  );
}

/** Inline editable PO number; commits on blur (empty clears). */
function PoInput({
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
      style={styles.addressInput}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="PO — e.g. 4501"
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      padding: spacing.xs + 2,
    },
    editButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
    },
    editButtonLabel: {
      color: colors.textOnAccent,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    editBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.primaryDim,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    editBannerText: {
      flex: 1,
      gap: 1,
    },
    editBannerTitle: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 14,
    },
    editBannerHint: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 12,
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
    editBlock: {
      gap: spacing.md,
    },
    editDivider: {
      alignSelf: 'stretch',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    },
    archiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.dangerDim,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    countPair: {
      gap: spacing.xs + 2,
    },
    scopeHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 15,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    subJobTypeBlock: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    typeChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    typeChip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    typeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryDim,
    },
    typeChipText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    typeChipTextActive: {
      color: colors.primary,
    },
    customTypeInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 13,
      outlineWidth: 0,
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
    sectionHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      padding: spacing.xs + 1,
    },
    iconButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryDim,
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
