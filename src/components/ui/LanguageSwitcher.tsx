import { useEffect, useRef, useState } from 'react';

import { useTranslation, type Language } from '../../i18n';

const LANGUAGES: ReadonlyArray<{ code: Language; label: string; short: string }> = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
];

type LanguageSwitcherProps = {
  className?: string;
};

/**
 * Language menu: a compact trigger that opens a list of the available locales.
 * Each language is labelled in its own language, so it is readable regardless
 * of the active locale.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeLanguage = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  // Move focus into the menu so keyboard users land on the current language.
  useEffect(() => {
    if (!isOpen) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="language-menu">
      <button
        ref={triggerRef}
        type="button"
        className={className ?? 'action-button action-button--menu action-button--menu-secondary'}
        onClick={() => setIsOpen((open) => !open)}
        title={t('common.switchLanguage')}
        aria-label={t('common.switchLanguage')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {activeLanguage.short}
      </button>

      {isOpen && (
        <div className="toolbar-dropdown toolbar-dropdown--language" role="menu" aria-label={t('common.languageLabel')}>
          <h4>{t('common.languageLabel')}</h4>
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              role="menuitemradio"
              aria-checked={item.code === language}
              className={`action-button toolbar-dropdown__button${item.code === language ? ' toolbar-dropdown__button--active' : ''}`}
              onClick={() => {
                setLanguage(item.code);
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
