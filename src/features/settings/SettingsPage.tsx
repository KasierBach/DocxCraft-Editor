import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useTranslation } from '../../i18n';
import { deleteAccount, exportAccount, logout, readAuthSession } from '../../lib/documentApi';
import { triggerBlobDownload } from '../../lib/download';
import { hardNavigate } from '../../lib/navigation';
import { useAuthGate } from '../auth/AuthGateContext';

/** Account and data controls: export, delete, sign out. */
export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAnonymous } = useAuthGate();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: readAuthSession });
  const email = sessionQuery.data?.user?.email ?? null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const json = await exportAccount();
      triggerBlobDownload('docxcraft-export.json', new Blob([json], { type: 'application/json' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      hardNavigate('/');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    hardNavigate('/');
  };

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <div>
          <h1 className="settings-page__title">{t('settings.title')}</h1>
          <p className="settings-page__intro">{t('settings.intro')}</p>
        </div>
        <button type="button" className="action-button" onClick={() => navigate('/app')}>
          {t('settings.backToEditor')}
        </button>
      </header>

      <section className="settings-section">
        <h2>{t('settings.accountSection')}</h2>
        {email && !isAnonymous ? (
          <p className="panel-copy">{t('settings.signedInAs', { email })}</p>
        ) : (
          <p className="panel-copy">{t('settings.anonymousNotice')}</p>
        )}
        <div className="settings-section__actions">
          <button type="button" className="action-button" onClick={() => void handleSignOut()}>
            {t('settings.signOut')}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.dataSection')}</h2>
        <h3>{t('settings.exportTitle')}</h3>
        <p className="panel-copy">{t('settings.exportHint')}</p>
        <button
          type="button"
          className="action-button"
          onClick={() => void handleExport()}
          disabled={isExporting}
        >
          {isExporting ? t('settings.exporting') : t('settings.export')}
        </button>
      </section>

      <section className="settings-section">
        <h3>{t('settings.deleteTitle')}</h3>
        <p className="panel-copy">{t('settings.deleteHint')}</p>
        {isConfirmingDelete ? (
          <div className="settings-section__actions">
            <p className="saved-document-card__warning" role="status">
              {t('settings.deleteConfirm')}
            </p>
            <button
              type="button"
              className="action-button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? t('settings.deleting') : t('settings.confirmDelete')}
            </button>
            <button
              type="button"
              className="action-button"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isDeleting}
            >
              {t('settings.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="action-button"
            onClick={() => setIsConfirmingDelete(true)}
          >
            {t('settings.deleteAccount')}
          </button>
        )}
      </section>
    </main>
  );
}
