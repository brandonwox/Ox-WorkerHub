import { FormInput } from '@/components/FormInput';

interface Props {
  label: string;
  /** Display text, e.g. "7:30 AM". Empty = not set yet. */
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/**
 * Web fallback for {@link TimeField}: there is no native time picker in the
 * browser, so the field stays a typed input ("7:30 AM" / "15:45") exactly as
 * before — callers still validate with parseTimeInput on save.
 */
export function TimeField({ label, value, onChangeText, placeholder }: Props) {
  return (
    <FormInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoCapitalize="characters"
    />
  );
}
