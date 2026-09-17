import { useQuery } from '@tanstack/react-query';
import { NavLink, useNavigate, useParams } from 'react-router';

import { useTranslation } from '../../i18n';
import { listDocuments } from '../../lib/documentApi';
import { ProfileHeader } from './ProfileHeader';
import { DataSection } from './sections/DataSection';
import { ProfileSection } from './sections/ProfileSection';
import { SecuritySection } from './sections/SecuritySection';
import { WorkspaceSection } from './sections/WorkspaceSection';

const SECTIONS = [
  { id: 'profile', labelKey: 'profile.sectionProfile' },
  { id: 'workspace', labelKey: 'profile.sectionWorkspace' },
  { id: 'security', labelKey: 'profile.sectionSecurity' },
  { id: 'data', labelKey: 'profile.sectionData' },
] as const;

type ProfileSectionId = (typeof SECTIONS)[number]['id'];

function isSectionId(value: string | undefined): value is ProfileSectionId {
  return SECTIONS.some((entry) => entry.id === value);
}

/** The profile hub: identity and stats above a router-driven section rail. */
export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const documentsQuery = useQuery({ queryKey: ['account', 'documents'], queryFn: listDocuments });
  const activeSection = isSectionId(section) ? section : 'profile';

  return (
    <main className="profile-page">
      <header className="profile-page__topbar">
        <div>
          <h1 className="profile-page__title">{t('profile.title')}</h1>
          <p className="profile-page__intro">{t('profile.intro')}</p>
        </div>
        <button type="button" className="action-button" onClick={() => navigate('/app')}>
          {t('profile.backToEditor')}
        </button>
      </header>

      <ProfileHeader documents={documentsQuery.data ?? []} />

      <div className="profile-page__body">
        <nav className="profile-rail" aria-label={t('profile.railLabel')}>
          {SECTIONS.map((entry) => (
            <NavLink
              key={entry.id}
              to={`/settings/${entry.id}`}
              className={({ isActive }) =>
                `profile-rail__link${
                  isActive || (entry.id === 'profile' && section === undefined)
                    ? ' profile-rail__link--active'
                    : ''
                }`
              }
            >
              {t(entry.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="profile-content">
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'workspace' && <WorkspaceSection />}
          {activeSection === 'security' && <SecuritySection />}
          {activeSection === 'data' && <DataSection />}
        </div>
      </div>
    </main>
  );
}
