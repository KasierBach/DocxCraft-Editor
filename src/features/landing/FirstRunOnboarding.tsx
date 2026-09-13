import { useState } from 'react';

const STORAGE_KEY = 'docxcraft:onboarded';

const STEPS = [
  {
    title: 'Open something',
    copy: 'Drag in any .docx file (Ctrl+O) or start from the built-in sample — everything stays on your server.',
  },
  {
    title: 'Navigate with the Anchor Map',
    copy: 'The left panel lists every heading and paragraph by page. Click one to jump straight to it; it follows your cursor as you type.',
  },
  {
    title: 'Nothing gets lost',
    copy: 'Unsaved edits are backed up to this browser automatically, every save creates a restorable version, and Ctrl+S keeps your cursor in place.',
  },
];

export function FirstRunOnboarding() {
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
          <h2 id="onboarding-title">Welcome to DOCX Workspace</h2>
        </div>
        <div className="modal-body">
          <p className="onboarding__step-count" aria-hidden="true">
            {stepIndex + 1} / {STEPS.length}
          </p>
          <h3 className="onboarding__title">{step.title}</h3>
          <p className="onboarding__copy">{step.copy}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="action-button" onClick={finish}>
            Skip
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
            {isLastStep ? 'Start editing' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  );
}
