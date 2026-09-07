import { isValid, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';

import { FormInput } from '@/components/FormInput';

interface Props {
  label: string;
  /** yyyy-MM-dd, or '' when not set. */
  value: string;
  /** Receives the typed day as yyyy-MM-dd once it parses. */
  onChange: (ymd: string) => void;
  placeholder?: string;
}

/**
 * Web fallback for {@link DateField}: no native date picker in the browser,
 * so the day is typed as yyyy-MM-dd and committed on blur once it parses to a
 * real date (anything else is left in the box for the worker to fix).
 */
export function DateField({ label, value, onChange, placeholder }: Props) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = () => {
    const t = text.trim();
    if (!t) {
      if (value) onChange('');
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t) && isValid(parseISO(t)) && t !== value) {
      onChange(t);
    }
  };

  return (
    <FormInput
      label={label}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      placeholder={placeholder ?? 'YYYY-MM-DD'}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}
