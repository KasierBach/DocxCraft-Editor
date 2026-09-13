import { useState } from 'react';

import { useTranslation } from '../../i18n';

const STORAGE_KEY = 'docxcraft:onboarded';

const STEPS = [
  { titleKey: 'onboarding.openTitle', copyKey: 'onboarding.openCopy' },
  { titleKey: 'onboarding.navigateTitle', copyKey: 'onboarding.navigateCopy' },
  { titleKey: 'onboarding.safeTitle', copyKey: 'onboarding.safeCopy' },
];

export function FirstRunOnboarding() {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== 'done';
    } catch {
      return false;
    }
  });
  const [stepIndex, setStepIndex] = useState(0);

  if (!isActive) return null;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'done');
    } catch {
      // Storage unavailable: hide for this session only.
    }
    setIsActive(false);
  };

  return (
    <div className="modal-overlay" role="presentation">
      <section
        className="modal-content onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="modal-header">
          <h2 id="onboarding-title">{t('onboarding.title')}</h2>
        </div>
        <div className="modal-body">
          <p className="onboarding__step-count" aria-hidden="true">
            {stepIndex + 1} / {STEPS.length}
          </p>
          <h3 className="onboarding__title">{t(step.titleKey)}</h3>
          <p className="onboarding__copy">{t(step.copyKey)}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="action-button" onClick={finish}>
            {t('onboarding.skip')}
          </button>
          <button
            type="button"
            className="action-button action-button--primary"
            onClick={() => {
              if (isLastStep) {
                finish();
              } else {
                setStepIndex((index) => index + 1);
              }
            }}
          >
            {isLastStep ? t('onboarding.startEditing') : t('onboarding.next')}
          </button>
        </div>
      </section>
    </div>
  );
}
