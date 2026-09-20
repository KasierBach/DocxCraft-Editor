import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listWorkspaceDocuments, updateWorkspaceDocument, bulkUpdateWorkspaceDocuments, type WorkspaceDocument } from '../../../lib/workspaceApi';

export function WorkspaceToolsPanel() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkFolder, setBulkFolder] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { folder: string; tags: string }>>({});
  const documentsQuery = useQuery({ queryKey: ['workspace-documents', query], queryFn: () => listWorkspaceDocuments(query), enabled });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Pick<WorkspaceDocument, 'folder' | 'tags' | 'isStarred'>> }) => updateWorkspaceDocument(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workspace-documents'] }),
  });
  const bulkMutation = useMutation({
    mutationFn: (input: { folder?: string | null; isStarred?: boolean }) => bulkUpdateWorkspaceDocuments(selected, input),
    onSuccess: () => {
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ['workspace-documents'] });
    },
  });

  if (!enabled) {
    return (
      <section className="profile-section">
        <h2>Organization</h2>
        <p className="panel-copy">Search document text, assign folders and tags, star important work, or update many documents at once.</p>
        <button type="button" className="action-button" onClick={() => setEnabled(true)}>Load organization tools</button>
      </section>
    );
  }

  const documents = documentsQuery.data ?? [];
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <section className="profile-section">
      <h2>Organization</h2>
      <div className="filter-group">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document text" aria-label="Search document text" />
        {selected.length > 0 && (
          <>
            <input
              value={bulkFolder}
              onChange={(event) => setBulkFolder(event.target.value)}
              placeholder="Folder for selected"
              aria-label="Folder for selected documents"
            />
            <button type="button" className="action-button" onClick={() => bulkMutation.mutate({ folder: bulkFolder.trim() || null })}>
              Apply folder
            </button>
            <button type="button" className="action-button" onClick={() => bulkMutation.mutate({ isStarred: true })}>
              Star selected
            </button>
          </>
        )}
      </div>
      {documentsQuery.isError ? <p className="panel-copy">Organization tools require hosted Postgres accounts.</p> : null}
      <div className="profile-list">
        {documents.map((document) => (
          <div key={document.id} className="profile-list__row">
            <label className="profile-list__main">
              <input type="checkbox" checked={selected.includes(document.id)} onChange={() => toggle(document.id)} />
              <span className="profile-list__name">{document.isStarred ? '★ ' : ''}{document.name}</span>
              <span className="profile-list__meta">{document.folder ?? 'No folder'} · {document.tags.join(', ') || 'No tags'} · {document.role}</span>
            </label>
            <div className="profile-list__actions">
              <input
                value={drafts[document.id]?.folder ?? document.folder ?? ''}
                onChange={(event) => setDrafts((current) => ({ ...current, [document.id]: { folder: event.target.value, tags: current[document.id]?.tags ?? document.tags.join(', ') } }))}
                placeholder="Folder"
                aria-label={`${document.name} folder`}
              />
              <input
                value={drafts[document.id]?.tags ?? document.tags.join(', ')}
                onChange={(event) => setDrafts((current) => ({ ...current, [document.id]: { folder: current[document.id]?.folder ?? document.folder ?? '', tags: event.target.value } }))}
                placeholder="Tags, comma separated"
                aria-label={`${document.name} tags`}
              />
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  const draft = drafts[document.id] ?? { folder: document.folder ?? '', tags: document.tags.join(', ') };
                  updateMutation.mutate({ id: document.id, input: { folder: draft.folder.trim() || null, tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean) } });
                }}
              >
                Save metadata
              </button>
              <button type="button" className="action-button" onClick={() => updateMutation.mutate({ id: document.id, input: { isStarred: !document.isStarred } })}>
                {document.isStarred ? 'Unstar' : 'Star'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
