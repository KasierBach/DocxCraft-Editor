import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useTranslation } from '../../../i18n';
import { importDocumentUrl } from '../../../lib/workspaceApi';

const TEMPLATES = [
  { name: 'Built-in sample', description: 'A small document for trying the editor and anchor map.' },
  { name: 'Meeting notes', description: 'Import a public .docx template from a URL or Google Drive.' },
  { name: 'Project brief', description: 'Keep goals, owners, decisions, and next steps together.' },
];

function normalizeImportUrl(value: string) {
  const match = value.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/i);
  return match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : value;
}

export function TemplatesSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const importMutation = useMutation({
    mutationFn: () => importDocumentUrl(normalizeImportUrl(url.trim())),
    onSuccess: (document) => navigate(`/app?source=saved&documentId=${encodeURIComponent(document.id)}`),
  });

  return (
    <div className="profile-section-stack">
      <section className="profile-section">
        <h2>{t('profile.templatesTitle')}</h2>
        <p className="panel-copy">{t('profile.templatesCopy')}</p>
        <div className="profile-list">
          {TEMPLATES.map((template, index) => (
            <div key={template.name} className="profile-list__row">
              <div className="profile-list__main">
                <span className="profile-list__name">{template.name}</span>
                <span className="profile-list__meta">{template.description}</span>
              </div>
              {index === 0 && (
                <button type="button" className="action-button" onClick={() => navigate('/app')}>
                  {t('profile.open')}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="profile-section">
        <h2>{t('profile.importTitle')}</h2>
        <p className="panel-copy">{t('profile.importCopy')}</p>
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); importMutation.mutate(); }}>
          <label className="profile-form__field">
            <span>{t('profile.importUrl')}</span>
            <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/template.docx" required />
          </label>
          <button type="submit" className="action-button" disabled={importMutation.isPending}>
            {importMutation.isPending ? t('profile.importing') : t('profile.import')}
          </button>
        </form>
        {importMutation.isError && <p className="profile-state" role="alert">{t('profile.importFailed')}</p>}
      </section>
    </div>
  );
}
