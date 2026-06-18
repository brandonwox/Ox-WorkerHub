import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export function FormInput({ label, error, style, ...inputProps }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.textTertiary}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs + 2,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
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
    // Web: drop the browser focus ring (we show focus via border instead).
    outlineWidth: 0,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
