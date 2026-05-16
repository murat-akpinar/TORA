import { TaskStatus } from '../types/Task';

export const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case TaskStatus.OPEN:
      return '#f5e0dc'; // Rosewater
    case TaskStatus.IN_PROGRESS:
      return '#89dceb'; // Sky
    case TaskStatus.TESTING:
      return '#cba6f7'; // Mauve
    case TaskStatus.COMPLETED:
      return '#94e2d5'; // Teal
    case TaskStatus.CANCELLED:
      return '#7f849c'; // Overlay1
    default:
      return '#9399b2';
  }
};

export const getStatusLabel = (status: TaskStatus): string => {
  switch (status) {
    case TaskStatus.OPEN:
      return 'Açık';
    case TaskStatus.IN_PROGRESS:
      return 'Yapılıyor';
    case TaskStatus.TESTING:
      return 'Test Aşamasında';
    case TaskStatus.COMPLETED:
      return 'Tamamlandı';
    case TaskStatus.CANCELLED:
      return 'İptal Edildi';
    default:
      return status;
  }
};
