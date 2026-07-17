import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ZoomableImage } from '@/components/photos/ZoomableImage';
import {
  captureSingleJobPhoto,
  pickSingleJobPhoto,
} from '@/lib/photoCapture';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import {
  colors,
  darkColors,
  fonts,
  modalShadow,
  radii,
  spacing,
  themed,
} from '@/theme';
import {
  JOB_DOCUMENT_TYPE_LABELS,
  JobDocument,
  JobDocumentKind,
  JobDocumentType,
} from '@/types';

interface Props {
  jobId: string;
}

const KIND_META: Record<
  JobDocumentKind,
  { icon: keyof typeof Feather.glyphMap; label: string }
> = {
  photo: { icon: 'image', label: 'Photo' },
  pdf: { icon: 'file', label: 'PDF' },
  text: { icon: 'align-left', label: 'Text' },
};

/**
 * A job's Documents section: photos, PDFs, and text notes, each with a typed
 * title. Everyone views; non-installers create via the + button (photo from
 * camera/library, PDF from the file picker, text typed in place). Files
 * upload immediately, so creating a photo/pdf document needs a connection.
 */
export function JobDocumentsSection({ jobId }: Props) {
  const { width, height } = useWindowDimensions();
  const role = useCurrentRole();
  const jobDocuments = useAppStore((s) => s.jobDocuments);
  const workers = useAppStore((s) => s.workers);
  const addJobDocument = useAppStore((s) => s.addJobDocument);
  const isOnline = useAppStore((s) => s.isOnline);

  const docs = useMemo(
    () =>
      jobDocuments
        .filter((d) => d.jobId === jobId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobDocuments, jobId]
  );

  const canCreate = role !== 'installer';

  // Which text document is unfolded to show its body.
  const [openTextId, setOpenTextId] = useState<string | null>(null);
  // Full-screen viewer for a photo document.
  const [photoView, setPhotoView] = useState<JobDocument | null>(null);
  // Creation flow: the + menu, then the draft form for the picked kind.
  const [kindMenuOpen, setKindMenuOpen] = useState(false);
  const [draftKind, setDraftKind] = useState<JobDocumentKind | null>(null);
  const [draftType, setDraftType] = useState<JobDocumentType | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startDraft = (kind: JobDocumentKind) => {
    setKindMenuOpen(false);
    setDraftKind(kind);
    setDraftType(null);
    setTitle('');
    setBody('');
    setFileUri(null);
    setFileName(null);
    setContentType(null);
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setFileUri(asset.uri);
    setFileName(asset.name);
    setContentType(asset.mimeType ?? 'application/pdf');
  };

  const takePhoto = async () => {
    const uri = await captureSingleJobPhoto();
    if (uri) {
      setFileUri(uri);
      setFileName(null);
      setContentType('image/jpeg');
    }
  };

  const choosePhoto = async () => {
    const uri = await pickSingleJobPhoto();
    if (uri) {
      setFileUri(uri);
      setFileName(null);
      setContentType('image/jpeg');
    }
  };

  const canSave =
    !!draftKind &&
    !!title.trim() &&
    (draftKind === 'text' ? !!body.trim() : !!fileUri);

  const save = async () => {
    if (!draftKind || !canSave || saving) return;
    setSaving(true);
    try {
      const ok = await addJobDocument({
        jobId,
        kind: draftKind,
        docType: draftType ?? undefined,
        title,
        body: draftKind === 'text' ? body.trim() : undefined,
        localUri: fileUri ?? undefined,
        contentType: contentType ?? undefined,
      });
      if (ok) setDraftKind(null);
    } finally {
      setSaving(false);
    }
  };

  const openDoc = (doc: JobDocument) => {
    if (doc.kind === 'text') {
      setOpenTextId((cur) => (cur === doc.id ? null : doc.id));
    } else if (doc.kind === 'photo') {
      setPhotoView(doc);
    } else if (doc.url) {
      void WebBrowser.openBrowserAsync(doc.url);
    }
  };

  const workerName = (id: string) =>
    workers.find((w) => w.id === id)?.name ?? 'Unknown';

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Documents</Text>
        {canCreate && (
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={() => setKindMenuOpen(true)}
            accessibilityLabel="Add document"
          >
            <Feather name="plus" size={18} color={colors.textOnAccent} />
          </Pressable>
        )}
      </View>

      {docs.length === 0 ? (
        <Text style={styles.emptyText}>No documents yet.</Text>
      ) : (
        docs.map((doc) => (
          <View key={doc.id} style={styles.docCard}>
            <Pressable
              style={({ pressed }) => [styles.docRow, pressed && styles.pressed]}
              onPress={() => openDoc(doc)}
            >
              <View style={styles.docIcon}>
                <Feather
                  name={KIND_META[doc.kind].icon}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={styles.docText}>
                {/* Typed documents lead with the type so installers can spot
                    e.g. every Window Layout Plan at a glance. */}
                {doc.docType && (
                  <Text style={styles.docTypeTag} numberOfLines={1}>
                    {JOB_DOCUMENT_TYPE_LABELS[doc.docType]}
                  </Text>
                )}
                <Text style={styles.docTitle} numberOfLines={1}>
                  {doc.title}
                </Text>
                <Text style={styles.docMeta} numberOfLines={1}>
                  {KIND_META[doc.kind].label} · {workerName(doc.workerId)} ·{' '}
                  {format(parseISO(doc.createdAt), 'MMM d, yyyy')}
                </Text>
              </View>
              <Feather
                name={
                  doc.kind === 'text'
                    ? openTextId === doc.id
                      ? 'chevron-up'
                      : 'chevron-down'
                    : doc.kind === 'pdf'
                      ? 'external-link'
                      : 'maximize-2'
                }
                size={15}
                color={colors.textTertiary}
              />
            </Pressable>
            {doc.kind === 'text' && openTextId === doc.id && (
              <Text style={styles.docBody}>{doc.body}</Text>
            )}
            {doc.kind !== 'text' && !isOnline && (
              <Text style={styles.offlineHint}>
                Connect to the internet to open this document.
              </Text>
            )}
          </View>
        ))
      )}

      {/* Kind menu: Photo / PDF / Text. */}
      <Modal
        visible={kindMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setKindMenuOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setKindMenuOpen(false)}
          />
          <View style={styles.menuCard}>
            <Text style={styles.modalTitle}>New document</Text>
            {(Object.keys(KIND_META) as JobDocumentKind[]).map((kind) => (
              <Pressable
                key={kind}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.pressed,
                ]}
                onPress={() => startDraft(kind)}
              >
                <View style={styles.docIcon}>
                  <Feather
                    name={KIND_META[kind].icon}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.menuItemText}>{KIND_META[kind].label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Draft form: title + kind-specific content. */}
      <Modal
        visible={draftKind != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDraftKind(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDraftKind(null)}
          />
          <View style={styles.formCard}>
            <Text style={styles.modalTitle}>
              New {draftKind ? KIND_META[draftKind].label.toLowerCase() : ''}{' '}
              document
            </Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Title (required)"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Optional type tag — helps installers identify layout plans. */}
            <Text style={styles.typeLabel}>Type (optional)</Text>
            <View style={styles.typeRow}>
              {(
                Object.keys(JOB_DOCUMENT_TYPE_LABELS) as JobDocumentType[]
              ).map((type) => {
                const active = draftType === type;
                return (
                  <Pressable
                    key={type}
                    style={({ pressed }) => [
                      styles.typeChip,
                      active && styles.typeChipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setDraftType(active ? null : type)}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        active && styles.typeChipTextActive,
                      ]}
                    >
                      {JOB_DOCUMENT_TYPE_LABELS[type]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {draftKind === 'text' && (
              <TextInput
                style={[styles.input, styles.bodyInput]}
                value={body}
                onChangeText={setBody}
                placeholder="Write the document…"
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            )}

            {draftKind === 'photo' && (
              <View style={styles.fileArea}>
                {fileUri ? (
                  <Image
                    source={{ uri: fileUri }}
                    style={styles.photoPreview}
                    contentFit="cover"
                  />
                ) : null}
                <View style={styles.fileButtons}>
                  {Platform.OS !== 'web' && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.fileButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={takePhoto}
                    >
                      <Feather name="camera" size={14} color={colors.primary} />
                      <Text style={styles.fileButtonText}>Take photo</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [
                      styles.fileButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={choosePhoto}
                  >
                    <Feather name="upload" size={14} color={colors.primary} />
                    <Text style={styles.fileButtonText}>
                      {fileUri ? 'Replace photo' : 'Choose photo'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {draftKind === 'pdf' && (
              <View style={styles.fileArea}>
                {fileName ? (
                  <View style={styles.pdfChip}>
                    <Feather name="file" size={14} color={colors.primary} />
                    <Text style={styles.pdfChipText} numberOfLines={1}>
                      {fileName}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.fileButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.fileButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={pickPdf}
                  >
                    <Feather name="upload" size={14} color={colors.primary} />
                    <Text style={styles.fileButtonText}>
                      {fileUri ? 'Replace PDF' : 'Choose PDF'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.formActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setDraftKind(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  (!canSave || saving) && styles.saveDisabled,
                  pressed && canSave && styles.pressed,
                ]}
                disabled={!canSave || saving}
                onPress={save}
              >
                <Text style={styles.saveText}>
                  {saving ? 'Saving…' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen viewer for photo documents (chrome pinned dark). */}
      <Modal
        visible={photoView != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoView(null)}
      >
        {/* RN Modals don't inherit the app root's gesture root — mount our own
            so pinch-to-zoom works inside the viewer. */}
        <GestureHandlerRootView style={styles.viewerBackdrop}>
          {photoView?.url && (
            <ZoomableImage uri={photoView.url} width={width} height={height} />
          )}
          <View style={styles.viewerTopBar}>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {photoView?.title ?? ''}
            </Text>
            <Pressable
              style={styles.viewerClose}
              onPress={() => setPhotoView(null)}
              hitSlop={10}
            >
              <Feather name="x" size={22} color={darkColors.textPrimary} />
            </Pressable>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
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
    header: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    emptyText: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    docCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    docRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    docIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryDim,
    },
    docText: {
      flex: 1,
      gap: 1,
    },
    docTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    docTypeTag: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    typeLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 12,
    },
    typeRow: {
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
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeChipText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    typeChipTextActive: {
      color: colors.textOnAccent,
    },
    docMeta: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 11,
    },
    docBody: {
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
    },
    offlineHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 11,
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
    menuCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...modalShadow,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 16,
      marginBottom: spacing.xs,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
      padding: spacing.md,
    },
    menuItemText: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    formCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...modalShadow,
      padding: spacing.lg,
      gap: spacing.md,
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
    bodyInput: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    fileArea: {
      gap: spacing.md,
    },
    photoPreview: {
      width: '100%',
      height: 160,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
    },
    fileButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    fileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    fileButtonText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    pdfChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      backgroundColor: colors.primaryDim,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 1,
      maxWidth: '100%',
    },
    pdfChipText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      flexShrink: 1,
    },
    formActions: {
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
    viewerBackdrop: {
      flex: 1,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerTopBar: {
      position: 'absolute',
      top: Platform.OS === 'web' ? spacing.lg : spacing.xxl + spacing.lg,
      left: spacing.lg,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    viewerTitle: {
      flexShrink: 1,
      color: darkColors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
      backgroundColor: darkColors.overlay,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      overflow: 'hidden',
    },
    viewerClose: {
      backgroundColor: darkColors.overlay,
      borderRadius: radii.pill,
      padding: spacing.sm,
    },
  })
);
