export interface PhoneValidationResult {
  valid: boolean;
  clean: string;
  formatted?: string;
  error?: string;
}

/**
 * Validates Indian 10-digit mobile number according to national numbering plan.
 * Valid numbers are 10 digits starting with 6, 7, 8, or 9.
 */
export function validatePhoneNumber(input: string | undefined | null): PhoneValidationResult {
  if (!input || !input.trim()) {
    return { valid: false, clean: '', error: 'Mobile number is required' };
  }

  const raw = input.trim();
  let digits = raw.replace(/\D/g, '');

  // Handle +91 or 91 country code prefix if 12 digits
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Handle leading 0 (STD prefix)
    digits = digits.slice(1);
  }

  if (digits.length === 0) {
    return { valid: false, clean: '', error: 'Mobile number is required' };
  }

  if (!/^[6-9]/.test(digits)) {
    return {
      valid: false,
      clean: digits,
      error: 'Indian mobile numbers must start with 6, 7, 8, or 9',
    };
  }

  if (digits.length < 10) {
    return {
      valid: false,
      clean: digits,
      error: `Mobile number must be 10 digits (${digits.length}/10 entered)`,
    };
  }

  if (digits.length > 10) {
    return {
      valid: false,
      clean: digits,
      error: `Mobile number cannot exceed 10 digits (${digits.length} digits entered)`,
    };
  }

  return {
    valid: true,
    clean: digits,
    formatted: `${digits.slice(0, 5)} ${digits.slice(5)}`,
  };
}

/**
 * Strips non-digit characters and caps at 10 digits for form input handlers.
 */
export function sanitizePhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2, 12);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1, 11);
  }
  return digits.slice(0, 10);
}
