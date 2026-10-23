"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="paper-modal"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button
          type="button"
          className="modal-close"
          aria-label="닫기"
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    </dialog>
  );
}
