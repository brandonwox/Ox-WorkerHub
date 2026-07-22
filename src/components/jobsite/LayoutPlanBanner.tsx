import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useJobPhotos } from '@/components/photos/useJobPhotos';
import {
  captureSingleJobPhoto,
  pickSingleJobPhoto,
} from '@/lib/photoCapture';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import {
  colors,
  fonts,
  modalShadow,
  radii,
  spacing,
  themed,
} from '@/theme';
import { Job, JOB_DOCUMENT_TYPE_LABELS, JobDocumentType } from '@/types';

interface Props {
  job: Job;
  /** Which layout plan this banner nags about (Windows / Mirrors / Showers scope). */
  kind: 'window' | 'mirror' | 'shower';
}

/** RN's Pressable state on web also carries `hovered` (react-native-web). */
type PressState = { pressed: boolean; hovered?: boolean };

/** Per-kind wiring: scope, doc type, copy, and the job's not-needed flag. */
const KIND_META = {
  window: {
    scope: 'Windows' as const,
    docType: 'window_layout' as JobDocumentType,
    warning: 'The installers need an image of the window layout.',
    notNeededLabel: 'Window layout plans not necessary',
    notNeededPatch: { windowLayoutNotNeeded: true } as Partial<Job>,
    notNeeded: (job: Job) => !!job.windowLayoutNotNeeded,
  },
  mirror: {
    scope: 'Mirrors' as const,
    docType: 'mirror_layout' as JobDocumentType,
    warning: 'The installers need an image of the mirror layout.',
    notNeededLabel: 'Mirror layout plans not necessary',
    notNeededPatch: { mirrorLayoutNotNeeded: true } as Partial<Job>,
    notNeeded: (job: Job) => !!job.mirrorLayoutNotNeeded,
  },
  shower: {
    scope: 'Showers' as const,
    docType: 'shower_layout' as JobDocumentType,
    warning: 'The installers need an image of the shower layout.',
    notNeededLabel: 'Shower layout plans not necessary',
    notNeededPatch: { showerLayoutNotNeeded: true } as Partial<Job>,
    notNeeded: (job: Job) => !!job.showerLayoutNotNeeded,
  },
};

/**
 * Field-Super-only warning under the job header: a Windows-scoped job with no
 * "Window Layout Plans" document (and not flagged "not necessary") warns that
 * installers need the layout image, with a + button offering: take a photo,
 * upload an image, pick one of the job's photos, assign an existing job
 * document, or mark layout plans unnecessary. The first three create a new
 * typed photo document that MUST be labeled ("West face") so installers can
 * tell the plans apart. Mirrors- and Showers-scoped jobs get the identical
 * Mirror / Shower flows.
 */
export function LayoutPlanBanner({ job, kind }: Props) {
  const meta = KIND_META[kind];
  const role = useCurrentRole();
  const jobDocuments = useAppStore((s) => s.jobDocuments);
  const addJobDocument = useAppStore((s) => s.addJobDocument);
  const setJobDocumentType = useAppStore((s) => s.setJobDocumentType);
  const updateJob = useAppStore((s) => s.updateJob);
  const photos = useJobPhotos(job.id);

  // Steps: the option menu → (label a new image | pick a job image → label |
  // pick an existing document). Null = collapsed to just the warning row.
  const [step, setStep] = useState<
    'menu' | 'label' | 'pick-image' | 'pick-document' | null
  >(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [notNeededHovered, setNotNeededHovered] = useState(false);

  const hasPlan = useMemo(
    () =>
      jobDocuments.some(
        (d) => d.jobId === job.id && d.docType === meta.docType
      ),
    [jobDocuments, job.id, meta.docType]
  );

  // Documents assignable via "Choose from Job documents" (files only —
  // a text note can't be a layout image).
  const assignableDocs = useMemo(
    () =>
      jobDocuments
        .filter((d) => d.jobId === job.id && d.kind !== 'text')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobDocuments, job.id]
  );

  if (
    role !== 'field_super' ||
    !job.scopes?.includes(meta.scope) ||
    meta.notNeeded(job) ||
    hasPlan
  ) {
    return null;
  }

  const close = () => {
    setStep(null);
    setPickedUri(null);
    setLabel('');
    setNotNeededHovered(false);
  };

  const startLabel = (uri: string) => {
    setPickedUri(uri);
    setLabel('');
    setStep('label');
  };

  const takePhoto = async () => {
    const uri = await captureSingleJobPhoto();
    if (uri) startLabel(uri);
  };

  const uploadImage = async () => {
    const uri = await pickSingleJobPhoto();
    if (uri) startLabel(uri);
  };

  const createLabeled = async () => {
    if (!pickedUri || !label.trim() || saving) return;
    setSaving(true);
    try {
      const ok = await addJobDocument({
        jobId: job.id,
        kind: 'photo',
        docType: meta.docType,
        title: label,
        localUri: pickedUri,
        contentType: 'image/jpeg',
      });
      if (ok) close();
    } finally {
      setSaving(false);
    }
  };

  const menuOptions: {
    key: string;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    onPress: () => void | Promise<void>;
  }[] = [
    // No live camera on web — the picker covers it there.
    ...(Platform.OS !== 'web'
      ? [
          {
            key: 'take',
            label: 'Take photo',
            icon: 'camera' as const,
            onPress: takePhoto,
          },
        ]
      : []),
    {
      key: 'upload',
      label: 'Upload Image',
      icon: 'upload',
      onPress: uploadImage,
    },
    {
      key: 'job-images',
      label: 'Choose from Job images',
      icon: 'image',
      onPress: () => setStep('pick-image'),
    },
    {
      key: 'job-documents',
      label: 'Choose from Job documents',
      icon: 'file-text',
      onPress: () => setStep('pick-document'),
    },
  ];

  return (
    <View style={styles.row}>
      <Feather name="alert-triangle" size={16} color={colors.warning} />
      <Text style={styles.warningText}>{meta.warning}</Text>
      <Pressable
        style={({ pressed, hovered }: PressState) => [
          styles.plusButton,
          (hovered || pressed) && styles.plusButtonHover,
        ]}
        hitSlop={6}
        onPress={() => setStep('menu')}
        accessibilityLabel={`Assign ${JOB_DOCUMENT_TYPE_LABELS[meta.docType]}`}
      >
        <Feather name="plus" size={15} color={colors.textSecondary} />
      </Pressable>

      <Modal
        visible={step != null}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />

          {step === 'menu' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {JOB_DOCUMENT_TYPE_LABELS[meta.docType]}
              </Text>
              {menuOptions.map((option) => (
                <Pressable
                  key={option.key}
                  style={({ pressed, hovered }: PressState) => [
                    styles.menuItem,
                    (hovered || pressed) && styles.menuItemHover,
                  ]}
                  onPress={option.onPress}
                >
                  <View style={styles.menuIcon}>
                    <Feather
                      name={option.icon}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.menuItemText}>{option.label}</Text>
                </Pressable>
              ))}
              {/* Deliberately quiet — the escape hatch, not a peer option.
                  The label brightens on hover so it still reads as a button. */}
              <Pressable
                style={({ pressed }) => [
                  styles.notNeededButton,
                  pressed && styles.pressed,
                ]}
                onHoverIn={() => setNotNeededHovered(true)}
                onHoverOut={() => setNotNeededHovered(false)}
                onPress={() => {
                  updateJob(job.id, meta.notNeededPatch);
                  close();
                }}
              >
                <Text
                  style={[
                    styles.notNeededText,
                    notNeededHovered && styles.notNeededTextHover,
                  ]}
                >
                  {meta.notNeededLabel}
                </Text>
              </Pressable>
            </View>
          )}

          {step === 'label' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Label these plans</Text>
              <Text style={styles.cardHint}>
                Installers find the right plan by its label — e.g. “West
                face”.
              </Text>
              {pickedUri && (
                <Image
                  source={{ uri: pickedUri }}
                  style={styles.preview}
                  contentFit="cover"
                />
              )}
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Label (required)"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={close}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    (!label.trim() || saving) && styles.saveDisabled,
                    pressed && !!label.trim() && styles.pressed,
                  ]}
                  disabled={!label.trim() || saving}
                  onPress={createLabeled}
                >
                  <Text style={styles.saveText}>
                    {saving ? 'Saving…' : 'Create'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === 'pick-image' && (
            <View style={[styles.card, styles.pickCard]}>
              <Text style={styles.cardTitle}>Choose a job image</Text>
              {photos.length === 0 ? (
                <Text style={styles.emptyText}>This job has no photos.</Text>
              ) : (
                <ScrollView style={styles.pickScroll}>
                  <View style={styles.pickGrid}>
                    {photos.map((photo) => (
                      <Pressable
                        key={photo.id}
                        style={styles.pickCell}
                        onPress={() => startLabel(photo.url)}
                      >
                        <Image
                          source={{ uri: photo.url }}
                          style={styles.pickThumb}
                          contentFit="cover"
                          transition={100}
                        />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          {step === 'pick-document' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Choose a job document</Text>
              {assignableDocs.length === 0 ? (
                <Text style={styles.emptyText}>
                  This job has no image or PDF documents yet.
                </Text>
              ) : (
                <ScrollView style={styles.pickScroll}>
                  <View style={styles.docList}>
                    {assignableDocs.map((doc) => (
                      <Pressable
                        key={doc.id}
                        style={({ pressed, hovered }: PressState) => [
                          styles.menuItem,
                          (hovered || pressed) && styles.menuItemHover,
                        ]}
                        onPress={() => {
                          setJobDocumentType(doc.id, meta.docType);
                          close();
                        }}
                      >
                        <View style={styles.menuIcon}>
                          <Feather
                            name={doc.kind === 'pdf' ? 'file' : 'image'}
                            size={16}
                            color={colors.primary}
                          />
                        </View>
                        <Text style={styles.menuItemText} numberOfLines={1}>
                          {doc.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // Bare text + button — the spec wants no background or border here.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm + 2,
      alignSelf: 'center',
      maxWidth: '94%',
    },
    warningText: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    // Quiet neutral button (the old solid-blue pill read way too loud here).
    plusButton: {
      width: 26,
      height: 26,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    plusButtonHover: {
      backgroundColor: colors.surfaceLight,
    },
    pressed: {
      opacity: 0.8,
    },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '85%',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...modalShadow,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 16,
      marginBottom: spacing.xs,
    },
    cardHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
      padding: spacing.md,
    },
    menuItemHover: {
      backgroundColor: colors.border,
    },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryDim,
    },
    menuItemText: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    notNeededButton: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
    },
    notNeededText: {
      color: colors.textTertiary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    notNeededTextHover: {
      color: colors.textPrimary,
    },
    preview: {
      width: '100%',
      height: 160,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
    },
    input: {
      backgroundColor: colors.surfaceLight,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    cancelButton: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 1,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    saveButton: {
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 1,
    },
    saveDisabled: {
      opacity: 0.5,
    },
    saveText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 13,
    },
    emptyText: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    // The image picker gets a wider card + 3-across cells so the thumbnails
    // are big enough to actually tell apart.
    pickCard: {
      maxWidth: 560,
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
      width: '33.333%',
      aspectRatio: 1,
      padding: spacing.xs / 2,
    },
    pickThumb: {
      flex: 1,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceLight,
    },
    docList: {
      gap: spacing.sm,
    },
  })
);
