import { Alert } from 'react-native';

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

export class ErrorHandler {
  static handleApiError(error: any): ApiError {
    // If error is already in our format
    if (error.message && typeof error.message === 'string') {
      return error;
    }

    // Axios error with response
    if (error.response) {
      const { status, data } = error.response;
      
      // Laravel validation errors
      if (status === 422 && data.errors) {
        return {
          message: data.message || 'Validation failed',
          status,
          errors: data.errors
        };
      }
      
      // Other API errors
      return {
        message: data.message || `Server error (${status})`,
        status,
      };
    }
    
    // Network error
    if (error.request) {
      return {
        message: 'Network error. Please check your connection.',
      };
    }
    
    // Other errors
    return {
      message: error.message || 'An unexpected error occurred',
    };
  }

  static showError(error: any) {
    const apiError = this.handleApiError(error);
    
    let message = apiError.message;
    
    // Add validation errors if present
    if (apiError.errors) {
      const validationMessages = Object.values(apiError.errors)
        .flat()
        .join('\n');
      message += '\n\n' + validationMessages;
    }
    
    Alert.alert('Error', message);
  }

  // Alias for showError - for convenience
  static handle(error: any, customMessage?: string) {
    const apiError = this.handleApiError(error);
    
    let message = customMessage || apiError.message;
    
    // Add validation errors if present
    if (apiError.errors) {
      const validationMessages = Object.values(apiError.errors)
        .flat()
        .join('\n');
      message += '\n\n' + validationMessages;
    }
    
    Alert.alert('Error', message);
  }

  static getValidationErrors(error: any): Record<string, string> {
    const apiError = this.handleApiError(error);
    const result: Record<string, string> = {};
    
    if (apiError.errors) {
      Object.keys(apiError.errors).forEach(field => {
        result[field] = apiError.errors![field][0]; // Take first error for each field
      });
    }
    
    return result;
  }
}