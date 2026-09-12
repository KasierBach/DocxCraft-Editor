type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (toastId: number) => void;
};

function getToastRole(tone: ToastTone) {
  return tone === 'error' ? 'alert' : 'status';
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div className="app-toast-viewport">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`app-toast app-toast--${toast.tone}`}
          role={getToastRole(toast.tone)}
        >
          <p className="app-toast__message">{toast.message}</p>
          <button
            type="button"
            className="app-toast__dismiss"
            onClick={() => onDismiss(toast.id)}
            aria-label={`Dismiss notification: ${toast.message}`}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
