import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import '../components/AddClientModal.css';
import './ConfirmDialog.css';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  const close = useCallback((value: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    resolve?.(value);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false);
      resolveRef.current = resolve;
      setOptions(next);
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open ? (
        <div className="modal-overlay confirm-overlay" onClick={() => close(false)}>
          <div
            ref={dialogRef}
            className="modal-content confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="confirm-title">{options.title || 'Onay'}</h2>
            </div>
            <p id="confirm-message" className="confirm-message">
              {options.message}
            </p>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => close(false)}>
                {options.cancelLabel || 'Vazgeç'}
              </button>
              <button
                type="button"
                className={options.danger ? 'confirm-ok confirm-ok-danger' : 'confirm-ok'}
                onClick={() => close(true)}
              >
                {options.confirmLabel || 'Tamam'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
};
