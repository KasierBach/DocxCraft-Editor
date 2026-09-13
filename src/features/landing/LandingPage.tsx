import { useEffect, useRef, useState, type ReactNode } from 'react';

import { CopyableCommand } from '../../components/ui/CopyableCommand';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';
import { useTranslation } from '../../i18n';

type LandingPageProps = {
  needsSetup: boolean;
  onPrimaryAction: () => void;
  onShowDocs: () => void;
  onShowChangelog: () => void;
  onShowPrivacy: () => void;
  onShowTerms: () => void;
};

const MARQUEE_KEYS = [
  'landing.marquee.nativeDocx',
  'landing.marquee.versionHistory',
  'landing.marquee.anchorMap',
  'landing.marquee.crashRecovery',
  'landing.marquee.commandPalette',
  'landing.marquee.darkMode',
  'landing.marquee.offlineFirst',
  'landing.marquee.selfHosted',
  'landing.marquee.mitLicensed',
  'landing.marquee.noTelemetry',
];

const FEATURES = [
  {
    index: '01',
    titleKey: 'landing.features.nativeTitle',
    copyKey: 'landing.features.nativeCopy',
    mock: 'file',
  },
  {
    index: '02',
    titleKey: 'landing.features.outlineTitle',
    copyKey: 'landing.features.outlineCopy',
    mock: 'outline',
  },
  {
    index: '03',
    titleKey: 'landing.features.versionsTitle',
    copyKey: 'landing.features.versionsCopy',
    mock: 'timeline',
  },
  {
    index: '04',
    titleKey: 'landing.features.recoveryTitle',
    copyKey: 'landing.features.recoveryCopy',
    mock: 'pulse',
  },
  {
    index: '05',
    titleKey: 'landing.features.keyboardTitle',
    copyKey: 'landing.features.keyboardCopy',
    mock: 'keys',
  },
  {
    index: '06',
    titleKey: 'landing.features.privacyTitle',
    copyKey: 'landing.features.privacyCopy',
    mock: null,
  },
] as const;

const STEPS = [
  {
    index: '01',
    titleKey: 'landing.how.step1Title',
    copyKey: 'landing.how.step1Copy',
  },
  {
    index: '02',
    titleKey: 'landing.how.step2Title',
    copyKey: 'landing.how.step2Copy',
  },
  {
    index: '03',
    titleKey: 'landing.how.step3Title',
    copyKey: 'landing.how.step3Copy',
  },
];

const PERSONAS = [
  {
    labelKey: 'landing.personas.contractsLabel',
    copyKey: 'landing.personas.contractsCopy',
  },
  {
    labelKey: 'landing.personas.researchLabel',
    copyKey: 'landing.personas.researchCopy',
  },
  {
    labelKey: 'landing.personas.internalLabel',
    copyKey: 'landing.personas.internalCopy',
  },
  {
    labelKey: 'landing.personas.selfHostLabel',
    copyKey: 'landing.personas.selfHostCopy',
  },
];

const COMPARISON_COLUMNS = ['DocxCraft', 'Google Docs', 'Word Online', 'OnlyOffice'];

const COMPARISON_ROWS = [
  {
    labelKey: 'landing.compare.labels.whereFiles',
    valueKeys: [
      'landing.compare.values.yourDisk',
      'landing.compare.values.googleCloud',
      'landing.compare.values.microsoftCloud',
      'landing.compare.values.yourServer',
    ],
  },
  {
    labelKey: 'landing.compare.labels.accountRequired',
    valueKeys: [
      'landing.compare.values.no',
      'landing.compare.values.yes',
      'landing.compare.values.yes',
      'landing.compare.values.no',
    ],
  },
  {
    labelKey: 'landing.compare.labels.selfHostable',
    valueKeys: [
      'landing.compare.values.oneContainer',
      'landing.compare.values.no',
      'landing.compare.values.no',
      'landing.compare.values.severalServices',
    ],
  },
  {
    labelKey: 'landing.compare.labels.worksOffline',
    valueKeys: [
      'landing.compare.values.yes',
      'landing.compare.values.limited',
      'landing.compare.values.limited',
      'landing.compare.values.yes',
    ],
  },
  {
    labelKey: 'landing.compare.labels.telemetry',
    valueKeys: [
      'landing.compare.values.none',
      'landing.compare.values.yes',
      'landing.compare.values.yes',
      'landing.compare.values.configurable',
    ],
  },
  {
    labelKey: 'landing.compare.labels.license',
    valueKeys: [
      'landing.compare.values.mit',
      'landing.compare.values.proprietary',
      'landing.compare.values.proprietary',
      'landing.compare.values.agpl',
    ],
  },
];

const INSTALL_COMMAND =
  'docker run -d -p 4175:4175 -e AUTH_MODE=claim -v docxcraft-data:/app/data ghcr.io/kasierbach/docxcraft-editor';

const REPOSITORY_URL = 'https://github.com/KasierBach/DocxCraft-Editor';

const FAQ_ITEMS = [
  { questionKey: 'landing.faq.q1', answerKey: 'landing.faq.a1' },
  { questionKey: 'landing.faq.q2', answerKey: 'landing.faq.a2' },
  { questionKey: 'landing.faq.q3', answerKey: 'landing.faq.a3' },
  { questionKey: 'landing.faq.q4', answerKey: 'landing.faq.a4' },
  { questionKey: 'landing.faq.q5', answerKey: 'landing.faq.a5' },
  { questionKey: 'landing.faq.q6', answerKey: 'landing.faq.a6' },
  { questionKey: 'landing.faq.q7', answerKey: 'landing.faq.a7' },
  { questionKey: 'landing.faq.q8', answerKey: 'landing.faq.a8' },
];

const NAV_SECTIONS = [
  { id: 'features', labelKey: 'landing.nav.features' },
  { id: 'how-it-works', labelKey: 'landing.nav.howItWorks' },
];

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Types the headline like a document being written, caret included. */
function useTypewriter(text: string, speedMs = 24) {
  const [typedLength, setTypedLength] = useState(() =>
    prefersReducedMotion() ? text.length : 0,
  );
  const typedLengthRef = useRef(typedLength);

  useEffect(() => {
    if (typedLengthRef.current >= text.length) return undefined;

    const timer = window.setInterval(() => {
      const next = Math.min(text.length, typedLengthRef.current + 1);
      typedLengthRef.current = next;
      setTypedLength(next);
      if (next >= text.length) {
        window.clearInterval(timer);
      }
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [speedMs, text]);

  return { typed: text.slice(0, typedLength), isDone: typedLength >= text.length };
}

/** Pointer-tracking 3D tilt for the screenshot "cardboard" frame. */
function useTilt(maxDeg = 7) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return undefined;

    const handleMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
      const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
      element.style.setProperty('--tilt-x', `${(-offsetY * maxDeg).toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${(offsetX * maxDeg).toFixed(2)}deg`);
    };
    const handleLeave = () => {
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
    };

    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerleave', handleLeave);
    return () => {
      element.removeEventListener('pointermove', handleMove);
      element.removeEventListener('pointerleave', handleLeave);
    };
  }, [maxDeg]);

  return ref;
}

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const valueRef = useRef(value);
  const elementRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (valueRef.current === target) return undefined;

    const element = elementRef.current;
    if (!element) return undefined;

    let frameId = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const startedAt = performance.now();
        const duration = 900;
        const tick = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / duration);
          const eased = 1 - (1 - progress) ** 3;
          const next = Math.round(target * eased);
          valueRef.current = next;
          setValue(next);
          if (progress < 1) {
            frameId = requestAnimationFrame(tick);
          }
        };
        frameId = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [target]);

  return (
    <span ref={elementRef}>
      {value}
      {suffix}
    </span>
  );
}

/** Thin bookmark bar that tracks reading progress down the page. */
function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      const documentElement = document.documentElement;
      const scrollable = documentElement.scrollHeight - documentElement.clientHeight;
      const progress = scrollable > 0 ? documentElement.scrollTop / scrollable : 0;
      barRef.current?.style.setProperty('--landing-progress', String(progress));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return <div className="landing-progress" ref={barRef} aria-hidden="true" />;
}

function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (isVisible) return undefined;

    const element = ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${isVisible ? 'landing-reveal--visible' : ''} ${className ?? ''}`}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function FeatureMock({ kind }: { kind: (typeof FEATURES)[number]['mock'] }) {
  const { t } = useTranslation();

  if (kind === 'outline') {
    return (
      <div className="landing-mock landing-mock--outline" aria-hidden="true">
        <span className="landing-mock__row" />
        <span className="landing-mock__row landing-mock__row--active" />
        <span className="landing-mock__row" />
        <span className="landing-mock__row landing-mock__row--indented" />
        <span className="landing-mock__row landing-mock__row--indented" />
      </div>
    );
  }

  if (kind === 'timeline') {
    return (
      <div className="landing-mock landing-mock--timeline" aria-hidden="true">
        <span className="landing-mock__node landing-mock__node--active" />
        <span className="landing-mock__node" />
        <span className="landing-mock__node" />
        <span className="landing-mock__node" />
        <span className="landing-mock__tag">{t('landing.mock.versionsTag')}</span>
      </div>
    );
  }

  if (kind === 'pulse') {
    return (
      <div className="landing-mock landing-mock--pulse" aria-hidden="true">
        <span className="landing-mock__pulse-dot" />
        <span className="landing-mock__pulse-label">{t('landing.mock.autosaveLabel')}</span>
      </div>
    );
  }

  if (kind === 'keys') {
    return (
      <div className="landing-mock landing-mock--keys" aria-hidden="true">
        <kbd>Ctrl</kbd>
        <span>+</span>
        <kbd>P</kbd>
        <span className="landing-mock__keys-caption">{t('landing.mock.commandPaletteCaption')}</span>
      </div>
    );
  }

  if (kind === 'file') {
    return (
      <div className="landing-mock landing-mock--file" aria-hidden="true">
        <span className="landing-mock__file-icon">📄</span>
        <span className="landing-mock__file-name">report-final-FINAL.docx</span>
        <span className="landing-mock__file-size">{t('landing.mock.fileSize')}</span>
      </div>
    );
  }

  return null;
}

export function LandingPage({
  needsSetup,
  onPrimaryAction,
  onShowDocs,
  onShowChangelog,
  onShowPrivacy,
  onShowTerms,
}: LandingPageProps) {
  const { t } = useTranslation();
  const HEADLINE = [
    t('landing.hero.headlineLine1'),
    t('landing.hero.headlineLine2'),
    t('landing.hero.headlineLine3'),
  ].join('\n');
  const { typed, isDone } = useTypewriter(HEADLINE);
  const tiltRef = useTilt();

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  return (
    <main className="landing">
      <ScrollProgress />
      <nav className="landing-nav">
        <span className="landing-nav__brand">
          <span className="landing-nav__mark" aria-hidden="true" />
          DOCXCRAFT
        </span>
        <div className="landing-nav__sections" aria-label={t('landing.nav.sectionsLabel')}>
          {NAV_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className="landing-nav__link"
              onClick={() => scrollToSection(section.id)}
            >
              {t(section.labelKey)}
            </button>
          ))}
          <button type="button" className="landing-nav__link" onClick={onShowDocs}>
            {t('landing.nav.docs')}
          </button>
          <button type="button" className="landing-nav__link" onClick={onShowChangelog}>
            {t('landing.nav.changelog')}
          </button>
        </div>
        <div className="landing-nav__actions">
          <LanguageSwitcher className="landing-button landing-button--small" />
          <a
            className="landing-button landing-button--small landing-button--star"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">★</span> {t('landing.nav.starOnGitHub')}
          </a>
          <button
            type="button"
            className="landing-button landing-button--small landing-button--primary"
            onClick={onPrimaryAction}
          >
            {needsSetup ? t('landing.nav.getStarted') : t('landing.nav.signIn')}
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <Reveal>
          <span className="landing-hero__badge">{t('landing.hero.badge')}</span>
        </Reveal>

        <h1 className="landing-hero__title" aria-label={HEADLINE.replace(/\n/g, ' ')}>
          {isDone ? (
            <>
              {t('landing.hero.headlineLine1')}
              <br />
              {t('landing.hero.headlineLine2')}
              <br />
              <span className="landing-hero__title-accent">
                <span className="landing-hero__title-accent-text">
                  {t('landing.hero.headlineLine3')}
                </span>
              </span>
            </>
          ) : (
            <span aria-hidden="true">
              {typed.split('\n').map((line, index, lines) => (
                <span key={index}>
                  {line}
                  {index < lines.length - 1 ? <br /> : null}
                  {index === lines.length - 1 ? <span className="landing-caret" /> : null}
                </span>
              ))}
            </span>
          )}
          {isDone ? <span className="landing-caret landing-caret--done" /> : null}
        </h1>

        <p className="landing-hero__copy">{t('landing.hero.copy')}</p>

        <div className="landing-hero__actions">
          <button
            type="button"
            className="landing-button landing-button--primary"
            onClick={onPrimaryAction}
          >
            {needsSetup
              ? t('landing.hero.getStartedSetup')
              : t('landing.hero.signInWorkspace')}
          </button>
          <button type="button" className="landing-button" onClick={() => scrollToSection('features')}>
            {t('landing.hero.seeWhatInside')}
          </button>
        </div>

        <p className={`landing-hero__autosave ${isDone ? 'landing-hero__autosave--visible' : ''}`}>
          {t('landing.hero.autosaved')}
        </p>

        <div className="landing-hero__install">
          <span className="landing-hero__install-label">{t('landing.hero.installLabel')}</span>
          <CopyableCommand code={INSTALL_COMMAND} wrap />
          <button type="button" className="landing-hero__install-link" onClick={onShowDocs}>
            {t('landing.hero.setupGuide')}
          </button>
        </div>

        <div className="landing-hero__shot-wrap">
          <div className="landing-shot-tilt" ref={tiltRef}>
            <figure className="landing-shot">
              <div className="landing-shot__chrome" aria-hidden="true">
                <span className="landing-shot__dot" />
                <span className="landing-shot__dot" />
                <span className="landing-shot__dot" />
                <span className="landing-shot__url">{t('landing.hero.browserUrl')}</span>
              </div>
              <img
                className="landing-shot__image"
                src="/screenshot.png"
                alt={t('landing.hero.screenshotAlt')}
                width={1536}
                height={864}
              />
            </figure>
            <span className="landing-sticker landing-sticker--local" aria-hidden="true">
              {t('landing.hero.stickerLocal')}
            </span>
            <span className="landing-sticker landing-sticker--cloud" aria-hidden="true">
              {t('landing.hero.stickerNoCloud')}
            </span>
          </div>
        </div>

        <dl className="landing-stats">
          <div className="landing-stats__item">
            <dt className="landing-stats__value landing-stats__value--static">
              <a
                className="landing-stats__link"
                href={`${REPOSITORY_URL}/actions/workflows/ci.yml`}
                target="_blank"
                rel="noreferrer"
              >
                150+
              </a>
            </dt>
            <dd className="landing-stats__label">{t('landing.hero.statsTestsLabel')}</dd>
          </div>
          <div className="landing-stats__item">
            <dt className="landing-stats__value">
              <a
                className="landing-stats__link"
                href={`${REPOSITORY_URL}/actions/workflows/ci.yml`}
                target="_blank"
                rel="noreferrer"
              >
                <CountUp target={4} />
              </a>
            </dt>
            <dd className="landing-stats__label">{t('landing.hero.statsEnginesLabel')}</dd>
          </div>
          <div className="landing-stats__item">
            <dt className="landing-stats__value landing-stats__value--static">
              <a
                className="landing-stats__link"
                href={`${REPOSITORY_URL}/blob/main/LICENSE`}
                target="_blank"
                rel="noreferrer"
              >
                MIT
              </a>
            </dt>
            <dd className="landing-stats__label">{t('landing.hero.statsLicenseLabel')}</dd>
          </div>
          <div className="landing-stats__item">
            <dt className="landing-stats__value landing-stats__value--static">100%</dt>
            <dd className="landing-stats__label">{t('landing.hero.statsDataLabel')}</dd>
          </div>
        </dl>
      </section>

      <div className="landing-marquee" aria-hidden="true">
        <div className="landing-marquee__track">
          {[...MARQUEE_KEYS, ...MARQUEE_KEYS].map((key, index) => (
            <span key={`${key}-${index}`} className="landing-marquee__item">
              {t(key)} <span className="landing-marquee__star">✦</span>
            </span>
          ))}
        </div>
      </div>

      <section className="landing-section" id="features" aria-label={t('landing.features.sectionLabel')}>
        <Reveal>
          <span className="landing-section__eyebrow">{t('landing.features.eyebrow')}</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">{t('landing.features.title')}</span>
          </h2>
          <p className="landing-section__copy">{t('landing.features.copy')}</p>
        </Reveal>

        <div className="landing-grid">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.index} delayMs={(index % 3) * 90}>
              <article className="landing-card">
                <span className="landing-card__index">{feature.index}</span>
                <h3 className="landing-card__title">{t(feature.titleKey)}</h3>
                <p className="landing-card__copy">{t(feature.copyKey)}</p>
                <FeatureMock kind={feature.mock} />
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        className="landing-section landing-section--centered"
        aria-label={t('landing.proof.sectionLabel')}
      >
        <Reveal>
          <span className="landing-section__eyebrow">{t('landing.proof.eyebrow')}</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">{t('landing.proof.title')}</span>
          </h2>
          <p className="landing-section__copy">{t('landing.proof.copy')}</p>
        </Reveal>

        <div className="landing-proof">
          <Reveal className="landing-proof__figures">
            <div className="landing-proof__stage">
              <figure className="landing-proof__window">
                <div className="landing-proof__chrome" aria-hidden="true">
                  <span className="landing-shot__dot" />
                  <span className="landing-shot__dot" />
                  <span className="landing-shot__dot" />
                  <span className="landing-shot__url">{t('landing.proof.windowTitle')}</span>
                </div>
                <img
                  className="landing-proof__image"
                  src="/shot-versions.png"
                  alt={t('landing.proof.versionsAlt')}
                  width={520}
                  height={1004}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>
            <div className="landing-proof__stage">
              <figure className="landing-proof__phone">
                <img
                  className="landing-proof__image"
                  src="/shot-mobile.png"
                  alt={t('landing.proof.mobileAlt')}
                  width={780}
                  height={1688}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>
          </Reveal>

          <Reveal className="landing-proof__captions" delayMs={120}>
            <div className="landing-proof__text">
              <h3 className="landing-proof__title">{t('landing.proof.caption1Title')}</h3>
              <p className="landing-proof__copy">{t('landing.proof.caption1Copy')}</p>
            </div>
            <div className="landing-proof__text">
              <h3 className="landing-proof__title">{t('landing.proof.caption2Title')}</h3>
              <p className="landing-proof__copy">{t('landing.proof.caption2Copy')}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="landing-section" aria-label={t('landing.personas.sectionLabel')}>
        <Reveal>
          <span className="landing-section__eyebrow">{t('landing.personas.eyebrow')}</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">{t('landing.personas.title')}</span>
          </h2>
        </Reveal>
        <div className="landing-personas">
          {PERSONAS.map((persona, index) => (
            <Reveal key={persona.labelKey} delayMs={index * 80}>
              <article className="landing-persona">
                <h3 className="landing-persona__label">{t(persona.labelKey)}</h3>
                <p className="landing-persona__copy">{t(persona.copyKey)}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="how-it-works" aria-label={t('landing.how.sectionLabel')}>
        <Reveal>
          <span className="landing-section__eyebrow">{t('landing.how.eyebrow')}</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">{t('landing.how.title')}</span>
          </h2>
        </Reveal>
        <ol className="landing-steps">
          {STEPS.map((step, index) => (
            <Reveal key={step.index} delayMs={index * 100} className="landing-steps__wrap">
              <li className="landing-steps__item">
                <span className="landing-steps__index">{step.index}</span>
                <h3 className="landing-steps__title">{t(step.titleKey)}</h3>
                <p className="landing-steps__copy">{t(step.copyKey)}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="landing-section" id="compare" aria-label={t('landing.compare.sectionLabel')}>
        <Reveal>
          <span className="landing-section__eyebrow">{t('landing.compare.eyebrow')}</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">{t('landing.compare.title')}</span>
          </h2>
          <p className="landing-section__copy">{t('landing.compare.copy')}</p>
        </Reveal>

        <Reveal>
          <table className="landing-compare">
            <caption className="visually-hidden">{t('landing.compare.caption')}</caption>
            <thead>
              <tr>
                <th scope="col" className="landing-compare__corner">
                  <span className="visually-hidden">{t('landing.compare.featureLabel')}</span>
                </th>
                {COMPARISON_COLUMNS.map((column) => (
                  <th key={column} scope="col" className="landing-compare__column">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.labelKey}>
                  <th scope="row" className="landing-compare__label">
                    {t(row.labelKey)}
                  </th>
                  {row.valueKeys.map((valueKey, index) => (
                    <td
                      key={`${row.labelKey}-${COMPARISON_COLUMNS[index]}`}
                      className={index === 0 ? 'landing-compare__us' : undefined}
                    >
                      {t(valueKey)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="landing-compare__footnote">{t('landing.compare.footnote')}</p>
        </Reveal>
      </section>

      <section
        className="landing-section landing-section--centered"
        id="faq"
        aria-label={t('landing.faq.sectionLabel')}
      >
        <Reveal>
          <span className="landing-section__eyebrow">{t('landing.faq.eyebrow')}</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">{t('landing.faq.title')}</span>
          </h2>
          <p className="landing-section__copy">{t('landing.faq.copy')}</p>
        </Reveal>

        <div className="landing-faq">
          {FAQ_ITEMS.map((item, index) => (
            <Reveal key={item.questionKey} delayMs={Math.min(index * 60, 240)}>
              <details className="landing-faq__item">
                <summary className="landing-faq__question">{t(item.questionKey)}</summary>
                <p className="landing-faq__answer">{t(item.answerKey)}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <Reveal>
          <h2 className="landing-cta__title">
            <span className="landing-marker landing-marker--sweep">{t('landing.cta.title')}</span>
          </h2>
          <button
            type="button"
            className="landing-button landing-button--primary landing-button--huge"
            onClick={onPrimaryAction}
          >
            {needsSetup ? t('landing.cta.claim') : t('landing.cta.signIn')}
          </button>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__top">
          <div className="landing-footer__brand-col">
            <span className="landing-footer__brand">DOCXCRAFT</span>
            <p className="landing-footer__tagline">{t('landing.footer.tagline')}</p>
            <span className="landing-footer__note">{t('landing.footer.note')}</span>
          </div>

          <nav className="landing-footer__col" aria-label={t('landing.footer.productLabel')}>
            <h3>{t('landing.footer.productLabel')}</h3>
            <button type="button" onClick={() => scrollToSection('features')}>
              {t('landing.nav.features')}
            </button>
            <button type="button" onClick={() => scrollToSection('how-it-works')}>
              {t('landing.nav.howItWorks')}
            </button>
            <button type="button" onClick={onShowDocs}>
              {t('landing.nav.docs')}
            </button>
            <button type="button" onClick={onShowChangelog}>
              {t('landing.nav.changelog')}
            </button>
          </nav>

          <nav className="landing-footer__col" aria-label={t('landing.footer.resourcesLabel')}>
            <h3>{t('landing.footer.resourcesLabel')}</h3>
            <a href={`${REPOSITORY_URL}#readme`} target="_blank" rel="noreferrer">
              README
            </a>
            <a href={`${REPOSITORY_URL}/releases`} target="_blank" rel="noreferrer">
              {t('landing.footer.releases')}
            </a>
            <a href={`${REPOSITORY_URL}/pkgs/container/docxcraft-editor`} target="_blank" rel="noreferrer">
              {t('landing.footer.containerImage')}
            </a>
            <a href={`${REPOSITORY_URL}/issues`} target="_blank" rel="noreferrer">
              {t('landing.footer.issues')}
            </a>
          </nav>

          <nav className="landing-footer__col" aria-label={t('landing.footer.legalLabel')}>
            <h3>{t('landing.footer.legalLabel')}</h3>
            <button type="button" onClick={onShowPrivacy}>
              {t('landing.footer.privacyPolicy')}
            </button>
            <button type="button" onClick={onShowTerms}>
              {t('landing.footer.termsOfUse')}
            </button>
            <a href={`${REPOSITORY_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
              {t('landing.footer.mitLicense')}
            </a>
          </nav>
        </div>

        <div className="landing-footer__bottom">
          <span>{t('landing.footer.builtInOpen')}</span>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </footer>
    </main>
  );
}
