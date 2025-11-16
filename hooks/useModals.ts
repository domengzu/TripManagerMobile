import { useState } from 'react';

interface ConfirmationState {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm?: () => void;
}

interface SuccessState {
  visible: boolean;
  title: string;
  message: string;
  buttonText?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const useModals = () => {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    visible: false,
    title: '',
    message: '',
  });

  const [successState, setSuccessState] = useState<SuccessState>({
    visible: false,
    title: '',
    message: '',
  });

  const showConfirmation = (config: Omit<ConfirmationState, 'visible'>) => {
    setConfirmationState({
      ...config,
      visible: true,
    });
  };

  const hideConfirmation = () => {
    setConfirmationState(prev => ({ ...prev, visible: false }));
  };

  const showSuccess = (config: Omit<SuccessState, 'visible'>) => {
    setSuccessState({
      ...config,
      visible: true,
    });
  };

  const hideSuccess = () => {
    setSuccessState(prev => ({ ...prev, visible: false }));
  };

  const handleConfirm = () => {
    if (confirmationState.onConfirm) {
      confirmationState.onConfirm();
    }
    hideConfirmation();
  };

  return {
    // Confirmation modal
    confirmationState: {
      ...confirmationState,
      onConfirm: handleConfirm,
      onCancel: hideConfirmation,
    },
    showConfirmation,
    hideConfirmation,
    
    // Success modal
    successState: {
      ...successState,
      onClose: hideSuccess,
    },
    showSuccess,
    hideSuccess,
  };
};

export default useModals;