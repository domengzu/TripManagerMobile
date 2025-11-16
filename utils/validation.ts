/**
 * Validation utilities for forms and user input
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export class ValidationUtils {
  /**
   * Validate a single field
   */
  static validateField(value: any, rules: ValidationRule): string | null {
    // Check required
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return 'This field is required';
    }

    // If field is empty and not required, it's valid
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    const stringValue = String(value);

    // Check min length
    if (rules.minLength && stringValue.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }

    // Check max length
    if (rules.maxLength && stringValue.length > rules.maxLength) {
      return `Must be no more than ${rules.maxLength} characters`;
    }

    // Check pattern
    if (rules.pattern && !rules.pattern.test(stringValue)) {
      return 'Invalid format';
    }

    // Check custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        return customError;
      }
    }

    return null;
  }

  /**
   * Validate multiple fields
   */
  static validateFields(data: Record<string, any>, rules: Record<string, ValidationRule>): ValidationResult {
    const errors: Record<string, string> = {};

    Object.keys(rules).forEach(field => {
      const error = this.validateField(data[field], rules[field]);
      if (error) {
        errors[field] = error;
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Common validation rules
   */
  static email: ValidationRule = {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value) => {
      if (value && !value.includes('@')) {
        return 'Please enter a valid email address';
      }
      return null;
    }
  };

  static phone: ValidationRule = {
    pattern: /^\+?[\d\s\-\(\)]+$/,
    minLength: 10,
    custom: (value) => {
      if (value) {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 10) {
          return 'Phone number must have at least 10 digits';
        }
      }
      return null;
    }
  };

  static password: ValidationRule = {
    minLength: 8,
    custom: (value) => {
      if (value && value.length >= 8) {
        if (!/(?=.*[a-z])/.test(value)) {
          return 'Password must contain at least one lowercase letter';
        }
        if (!/(?=.*[A-Z])/.test(value)) {
          return 'Password must contain at least one uppercase letter';
        }
        if (!/(?=.*\d)/.test(value)) {
          return 'Password must contain at least one number';
        }
      }
      return null;
    }
  };

  static licensePlate: ValidationRule = {
    pattern: /^[A-Z0-9\-\s]+$/i,
    minLength: 2,
    maxLength: 10,
    custom: (value) => {
      if (value && value.trim().length < 2) {
        return 'License plate must be at least 2 characters';
      }
      return null;
    }
  };

  static positiveNumber: ValidationRule = {
    custom: (value) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return 'Must be a positive number';
      }
      return null;
    }
  };

  static currency: ValidationRule = {
    pattern: /^\d+(\.\d{1,2})?$/,
    custom: (value) => {
      if (value) {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          return 'Must be a valid amount';
        }
        if (value.includes('.')) {
          const decimals = value.split('.')[1];
          if (decimals && decimals.length > 2) {
            return 'Maximum 2 decimal places allowed';
          }
        }
      }
      return null;
    }
  };

  /**
   * Sanitize input text
   */
  static sanitizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Format phone number for display
   */
  static formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }
}