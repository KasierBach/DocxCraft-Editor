type DrawerCloseButtonProps = {
  ariaLabel: string;
  onClick: () => void;
};

export function DrawerCloseButton({ ariaLabel, onClick }: DrawerCloseButtonProps) {
  return (
    <button
      type="button"
      className="drawer-close"
      onClick={onClick}
      aria-label={ariaLabel}
      autoFocus
    >
      &times;
    </button>
  );
}
