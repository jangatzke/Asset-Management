/**
 * Password Strength Validator
 * 
 * Enforces ISO 27001 / BSI compliance password policy:
 * - Minimum length: 12 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:',.<>?/`~)
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const MIN_LENGTH = 12;

const PASSWORD_RULES = [
  {
    regex: /[A-Z]/,
    message: 'Password must contain at least one uppercase letter',
  },
  {
    regex: /[a-z]/,
    message: 'Password must contain at least one lowercase letter',
  },
  {
    regex: /[0-9]/,
    message: 'Password must contain at least one digit',
  },
  {
    regex: /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~]/,
    message: 'Password must contain at least one special character',
  },
];

/**
 * Validate password strength against ISO 27001 compliance requirements.
 * @param password - The password to validate
 * @returns PasswordValidationResult with validity and error messages
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters long`);
  }

  for (const rule of PASSWORD_RULES) {
    if (!rule.regex.test(password)) {
      errors.push(rule.message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Throw an AppError if password doesn't meet strength requirements.
 * @param password - The password to validate
 * @param context - Context string for the error message (e.g., 'register', 'createUser')
 */
export function ensurePasswordStrength(password: string, context: string): void {
  const result = validatePasswordStrength(password);
  if (!result.valid) {
    throw new Error(
      `Password strength validation failed during ${context}: ${result.errors.join(', ')}`
    );
  }
}
