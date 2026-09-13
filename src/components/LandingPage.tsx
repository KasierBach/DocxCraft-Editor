import { useEffect, useRef, useState, type ReactNode } from 'react';

import { CopyableCommand } from './ui/CopyableCommand';

type LandingPageProps = {
  needsSetup: boolean;
  onPrimaryAction: () => void;
  onShowDocs: () => void;
  onShowChangelog: () => void;
  onShowPrivacy: () => void;
  onShowTerms: () => void;
};

const HEADLINE = 'Your documents.\nYour server.\nYour rules.';

const MARQUEE_ITEMS = [
  'Native .docx',
  'Version history',
  'Anchor Map',
  'Crash recovery',
  'Command palette',
  'Dark mode',
  'Offline-first',
  'Self-hosted',
  'MIT licensed',
  'No telemetry',
];

const FEATURES = [
  {
    index: '01',
    title: 'Real Word files, zero lock-in',
    copy: 'Documents stay native .docx on your disk. Open them in Word, LibreOffice, or here — no exports, no conversions.',
    mock: 'file',
  },
  {
    index: '02',
    title: 'Anchor Map',
    copy: 'A live outline of every heading, synced to your cursor. One click jumps and flash-highlights the target.',
    mock: 'outline',
  },
  {
    index: '03',
    title: 'Version history',
    copy: 'Every save snapshots. Restore or download any of the last 100 versions.',
    mock: 'timeline',
  },
  {
    index: '04',
    title: 'Crash recovery',
    copy: 'Unsaved edits are backed up to your browser between saves — reload after a crash and keep working.',
    mock: 'pulse',
  },
  {
    index: '05',
    title: 'Keyboard-first',
    copy: 'Palette, deep links, and shortcuts drive the whole workflow.',
    mock: 'keys',
  },
  {
    index: '06',
    title: 'Nothing leaves your server',
    copy: 'No analytics. No telemetry. No account. The only network requests go to the one server you control.',
    mock: null,
  },
] as const;

const STEPS = [
  {
    index: '01',
    title: 'Deploy in one command',
    copy: 'A single Docker command puts the whole editor on your own machine or VPS.',
  },
  {
    index: '02',
    title: 'Set your passphrase',
    copy: 'The first visit locks the editor with a passphrase you choose. Stored encrypted — even the operator cannot read it.',
  },
  {
    index: '03',
    title: 'Write like you own it',
    copy: 'Open .docx files, edit with full fidelity, and let versioning guard your work.',
  },
];

const PERSONAS = [
  {
    label: 'Contracts & legal',
    copy: 'Client agreements and case files stay on infrastructure you control, not a vendor’s.',
  },
  {
    label: 'Research & writing',
    copy: 'Long documents with headings, tables, and images — navigable from the Anchor Map.',
  },
  {
    label: 'Internal documents',
    copy: 'Policies, reports, and drafts that should not sit in somebody else’s cloud.',
  },
  {
    label: 'Self-hosters',
    copy: 'One container, one volume, no database — happy on a NAS, home server, or $5 VPS.',
  },
];

const COMPARISON_COLUMNS = ['DocxCraft', 'Google Docs', 'Word Online', 'OnlyOffice'];

const COMPARISON_ROWS = [
  { label: 'Where files live', values: ['Your disk', 'Google cloud', 'Microsoft cloud', 'Your server'] },
  { label: 'Account required', values: ['No', 'Yes', 'Yes', 'No'] },
  { label: 'Self-hostable', values: ['One container', 'No', 'No', 'Several services'] },
  { label: 'Works without internet', values: ['Yes', 'Limited', 'Limited', 'Yes'] },
  { label: 'Telemetry', values: ['None', 'Yes', 'Yes', 'Configurable'] },
  { label: 'License', values: ['MIT', 'Proprietary', 'Proprietary', 'AGPL-3.0'] },
];

const INSTALL_COMMAND =
  'docker run -d -p 4175:4175 -v docxcraft-data:/app/data ghcr.io/kasierbach/docxcraft-editor';

const REPOSITORY_URL = 'https://github.com/KasierBach/DocxCraft-Editor';

const FAQ_ITEMS = [
  {
    question: 'Where are my documents actually stored?',
    answer:
      'On the server you run, as native .docx files plus their version snapshots. Nothing is uploaded to a third-party service, and the app makes no network requests beyond your own server.',
  },
  {
    question: 'Is it really free?',
    answer:
      'Yes. MIT licensed, no accounts, no subscription, no usage limits, and no telemetry. Self-hosting costs whatever your machine or VPS costs — nothing else.',
  },
  {
    question: 'Does it need a server?',
    answer:
      'A small one. The Fastify server serves the editor and stores documents on disk; there is no database and no cloud dependency. One Docker container is enough.',
  },
  {
    question: 'What happens if I forget my passphrase?',
    answer:
      'It is stored as a salted hash, so it cannot be recovered. Delete data/auth.json on the server (or reset the volume) and the next visit lets you claim the instance with a new passphrase. Your documents are untouched.',
  },
  {
    question: 'Can I use it offline?',
    answer:
      'The editor is served from your own server, so it works without internet access once reachable. Unsaved edits are also backed up inside your browser, so a crash or reload does not lose work.',
  },
  {
    question: 'How do I back up my documents?',
    answer:
      'Copy the data directory (or the Docker volume). Documents and their version history are plain files on disk, so a normal file backup is enough — no export step.',
  },
  {
    question: 'Does it work on phones and tablets?',
    answer:
      'Yes. The workspace is responsive: on small screens the sidebars become drawers and the toolbar folds down, but it is the same editor — not a stripped-down mode.',
  },
  {
    question: 'Can several people use one instance?',
    answer:
      'Not at the same time. DocxCraft is deliberately a single-user workspace: one passphrase, one document library, no accounts or sharing. Collaborate by giving each person their own instance.',
  },
];

const NAV_SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it works' },
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
        <span className="landing-mock__tag">v42 · 2 min ago</span>
      </div>
    );
  }

  if (kind === 'pulse') {
    return (
      <div className="landing-mock landing-mock--pulse" aria-hidden="true">
        <span className="landing-mock__pulse-dot" />
        <span className="landing-mock__pulse-label">autosaved · IndexedDB</span>
      </div>
    );
  }

  if (kind === 'keys') {
    return (
      <div className="landing-mock landing-mock--keys" aria-hidden="true">
        <kbd>Ctrl</kbd>
        <span>+</span>
        <kbd>P</kbd>
        <span className="landing-mock__keys-caption">command palette</span>
      </div>
    );
  }

  if (kind === 'file') {
    return (
      <div className="landing-mock landing-mock--file" aria-hidden="true">
        <span className="landing-mock__file-icon">📄</span>
        <span className="landing-mock__file-name">report-final-FINAL.docx</span>
        <span className="landing-mock__file-size">42 KB · yours</span>
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
        <div className="landing-nav__sections" aria-label="Pages">
          {NAV_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className="landing-nav__link"
              onClick={() => scrollToSection(section.id)}
            >
              {section.label}
            </button>
          ))}
          <button type="button" className="landing-nav__link" onClick={onShowDocs}>
            Docs
          </button>
          <button type="button" className="landing-nav__link" onClick={onShowChangelog}>
            Changelog
          </button>
        </div>
        <div className="landing-nav__actions">
          <a
            className="landing-button landing-button--small landing-button--star"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">★</span> Star on GitHub
          </a>
          <button
            type="button"
            className="landing-button landing-button--small landing-button--primary"
            onClick={onPrimaryAction}
          >
            {needsSetup ? 'Get started' : 'Sign in'}
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <Reveal>
          <span className="landing-hero__badge">Local-first .docx editing</span>
        </Reveal>

        <h1 className="landing-hero__title" aria-label={HEADLINE.replace(/\n/g, ' ')}>
          {isDone ? (
            <>
              Your documents.
              <br />
              Your server.
              <br />
              <span className="landing-hero__title-accent">
                <span className="landing-hero__title-accent-text">Your rules.</span>
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

        <p className="landing-hero__copy">
          A full Word workspace — version history, smart navigation, crash recovery — running
          entirely on your machine. No accounts. No telemetry. No cloud.
        </p>

        <div className="landing-hero__actions">
          <button
            type="button"
            className="landing-button landing-button--primary"
            onClick={onPrimaryAction}
          >
            {needsSetup ? 'Get started — set your passphrase' : 'Sign in to your workspace'}
          </button>
          <button type="button" className="landing-button" onClick={() => scrollToSection('features')}>
            See what&apos;s inside ↓
          </button>
        </div>

        <p className={`landing-hero__autosave ${isDone ? 'landing-hero__autosave--visible' : ''}`}>
          ✓ Saved — to your server, and nowhere else.
        </p>

        <div className="landing-hero__install">
          <span className="landing-hero__install-label">Or run it yourself</span>
          <CopyableCommand code={INSTALL_COMMAND} wrap />
          <button type="button" className="landing-hero__install-link" onClick={onShowDocs}>
            Full setup guide →
          </button>
        </div>

        <div className="landing-hero__shot-wrap">
          <div className="landing-shot-tilt" ref={tiltRef}>
            <figure className="landing-shot">
              <div className="landing-shot__chrome" aria-hidden="true">
                <span className="landing-shot__dot" />
                <span className="landing-shot__dot" />
                <span className="landing-shot__dot" />
                <span className="landing-shot__url">your-server.local</span>
              </div>
              <img
                className="landing-shot__image"
                src="/screenshot.png"
                alt="DocxCraft Editor with the document outline, editor, and version history open"
                width={1536}
                height={864}
              />
            </figure>
            <span className="landing-sticker landing-sticker--local" aria-hidden="true">
              100% LOCAL
            </span>
            <span className="landing-sticker landing-sticker--cloud" aria-hidden="true">
              NO CLOUD ✂
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
            <dd className="landing-stats__label">automated tests, run in CI</dd>
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
            <dd className="landing-stats__label">browser engines tested</dd>
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
            <dd className="landing-stats__label">licensed, no strings</dd>
          </div>
          <div className="landing-stats__item">
            <dt className="landing-stats__value landing-stats__value--static">100%</dt>
            <dd className="landing-stats__label">of data on your server</dd>
          </div>
        </dl>
      </section>

      <div className="landing-marquee" aria-hidden="true">
        <div className="landing-marquee__track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
            <span key={`${item}-${index}`} className="landing-marquee__item">
              {item} <span className="landing-marquee__star">✦</span>
            </span>
          ))}
        </div>
      </div>

      <section className="landing-section" id="features" aria-label="What you get">
        <Reveal>
          <span className="landing-section__eyebrow">Features</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">Everything a word processor should be</span>
          </h2>
          <p className="landing-section__copy">
            All the machinery of a modern editor — none of the reach of a modern platform.
          </p>
        </Reveal>

        <div className="landing-grid">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.index} delayMs={(index % 3) * 90}>
              <article className="landing-card">
                <span className="landing-card__index">{feature.index}</span>
                <h3 className="landing-card__title">{feature.title}</h3>
                <p className="landing-card__copy">{feature.copy}</p>
                <FeatureMock kind={feature.mock} />
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section--centered" aria-label="In the details">
        <Reveal>
          <span className="landing-section__eyebrow">In the details</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">See it for real</span>
          </h2>
          <p className="landing-section__copy">
            Not mockups — these are windows from the app itself.
          </p>
        </Reveal>

        <div className="landing-proof">
          <Reveal className="landing-proof__figures">
            <div className="landing-proof__stage">
              <figure className="landing-proof__window">
                <div className="landing-proof__chrome" aria-hidden="true">
                  <span className="landing-shot__dot" />
                  <span className="landing-shot__dot" />
                  <span className="landing-shot__dot" />
                  <span className="landing-shot__url">Version history</span>
                </div>
                <img
                  className="landing-proof__image"
                  src="/shot-versions.png"
                  alt="Version history panel listing restore points for a document, each with restore and download actions"
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
                  alt="Document outline drawer open over the editor on a phone-sized screen"
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
              <h3 className="landing-proof__title">Every save is a restore point</h3>
              <p className="landing-proof__copy">
                Up to 100 versions per document — restore or download any of them, or
                reopen after a crash.
              </p>
            </div>
            <div className="landing-proof__text">
              <h3 className="landing-proof__title">The full workspace, in your pocket</h3>
              <p className="landing-proof__copy">
                On phones the sidebars become drawers and the toolbar folds down — the same
                editor, not a stripped-down mode.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="landing-section" aria-label="Who it's for">
        <Reveal>
          <span className="landing-section__eyebrow">Who it's for</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">Built for people with documents to keep</span>
          </h2>
        </Reveal>
        <div className="landing-personas">
          {PERSONAS.map((persona, index) => (
            <Reveal key={persona.label} delayMs={index * 80}>
              <article className="landing-persona">
                <h3 className="landing-persona__label">{persona.label}</h3>
                <p className="landing-persona__copy">{persona.copy}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="how-it-works" aria-label="How it works">
        <Reveal>
          <span className="landing-section__eyebrow">How it works</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">Up in three steps</span>
          </h2>
        </Reveal>
        <ol className="landing-steps">
          {STEPS.map((step, index) => (
            <Reveal key={step.index} delayMs={index * 100} className="landing-steps__wrap">
              <li className="landing-steps__item">
                <span className="landing-steps__index">{step.index}</span>
                <h3 className="landing-steps__title">{step.title}</h3>
                <p className="landing-steps__copy">{step.copy}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="landing-section" id="compare" aria-label="Compare">
        <Reveal>
          <span className="landing-section__eyebrow">Compare</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">Why not just use Google Docs?</span>
          </h2>
          <p className="landing-section__copy">
            Because the document is the point — and it should live somewhere you control.
          </p>
        </Reveal>

        <Reveal>
          <table className="landing-compare">
            <caption className="visually-hidden">
              Feature comparison between DocxCraft, Google Docs, Word Online, and OnlyOffice
            </caption>
            <thead>
              <tr>
                <th scope="col" className="landing-compare__corner">
                  <span className="visually-hidden">Feature</span>
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
                <tr key={row.label}>
                  <th scope="row" className="landing-compare__label">
                    {row.label}
                  </th>
                  {row.values.map((value, index) => (
                    <td
                      key={`${row.label}-${COMPARISON_COLUMNS[index]}`}
                      className={index === 0 ? 'landing-compare__us' : undefined}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="landing-compare__footnote">
            Publicly documented behavior of each product, checked in 2026 — always read the
            vendors' own terms. DocxCraft keeps every file on the server you run.
          </p>
        </Reveal>
      </section>

      <section className="landing-section landing-section--centered" id="faq" aria-label="FAQ">
        <Reveal>
          <span className="landing-section__eyebrow">FAQ</span>
          <h2 className="landing-section__title">
            <span className="landing-marker">Questions, answered</span>
          </h2>
          <p className="landing-section__copy">
            The honest details about storage, security, and running your own instance.
          </p>
        </Reveal>

        <div className="landing-faq">
          {FAQ_ITEMS.map((item, index) => (
            <Reveal key={item.question} delayMs={Math.min(index * 60, 240)}>
              <details className="landing-faq__item">
                <summary className="landing-faq__question">{item.question}</summary>
                <p className="landing-faq__answer">{item.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <Reveal>
          <h2 className="landing-cta__title">
            <span className="landing-marker landing-marker--sweep">Own your words.</span>
          </h2>
          <button
            type="button"
            className="landing-button landing-button--primary landing-button--huge"
            onClick={onPrimaryAction}
          >
            {needsSetup ? 'Claim your instance' : 'Sign in'}
          </button>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__top">
          <div className="landing-footer__brand-col">
            <span className="landing-footer__brand">DOCXCRAFT</span>
            <p className="landing-footer__tagline">
              A local-first .docx workspace that runs on your own server.
            </p>
            <span className="landing-footer__note">MIT licensed · No telemetry · Self-hosted</span>
          </div>

          <nav className="landing-footer__col" aria-label="Product">
            <h3>Product</h3>
            <button type="button" onClick={() => scrollToSection('features')}>
              Features
            </button>
            <button type="button" onClick={() => scrollToSection('how-it-works')}>
              How it works
            </button>
            <button type="button" onClick={onShowDocs}>
              Docs
            </button>
            <button type="button" onClick={onShowChangelog}>
              Changelog
            </button>
          </nav>

          <nav className="landing-footer__col" aria-label="Resources">
            <h3>Resources</h3>
            <a href={`${REPOSITORY_URL}#readme`} target="_blank" rel="noreferrer">
              README
            </a>
            <a href={`${REPOSITORY_URL}/releases`} target="_blank" rel="noreferrer">
              Releases
            </a>
            <a href={`${REPOSITORY_URL}/pkgs/container/docxcraft-editor`} target="_blank" rel="noreferrer">
              Container image
            </a>
            <a href={`${REPOSITORY_URL}/issues`} target="_blank" rel="noreferrer">
              Issues
            </a>
          </nav>

          <nav className="landing-footer__col" aria-label="Legal">
            <h3>Legal</h3>
            <button type="button" onClick={onShowPrivacy}>
              Privacy policy
            </button>
            <button type="button" onClick={onShowTerms}>
              Terms of use
            </button>
            <a href={`${REPOSITORY_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
              MIT license
            </a>
          </nav>
        </div>

        <div className="landing-footer__bottom">
          <span>Built in the open — issues and pull requests welcome.</span>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </footer>
    </main>
  );
}
