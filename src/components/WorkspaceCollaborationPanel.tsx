import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDocumentComment, deleteDocumentShare, listDocumentComments, listDocumentShares, resolveDocumentComment, upsertDocumentShare } from '../lib/workspaceApi';
import { Panel } from './ui/Panel';

type Props = { documentId: string | null; activeParaId: string | null };

export function WorkspaceCollaborationPanel({ documentId, activeParaId }: Props) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const commentsQuery = useQuery({ queryKey: ['document-comments', documentId], queryFn: () => listDocumentComments(documentId!), enabled: Boolean(documentId) });
  const sharesQuery = useQuery({ queryKey: ['document-shares', documentId], queryFn: () => listDocumentShares(documentId!), enabled: Boolean(documentId) });
  const addCommentMutation = useMutation({ mutationFn: () => addDocumentComment(documentId!, { body: comment, paraId: activeParaId }), onSuccess: () => { setComment(''); void queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] }); } });
  const resolveMutation = useMutation({ mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => resolveDocumentComment(id, resolved), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] }) });
  const shareMutation = useMutation({ mutationFn: () => upsertDocumentShare(documentId!, email, role), onSuccess: () => { setEmail(''); void queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] }); } });
  const deleteShareMutation = useMutation({ mutationFn: (shareId: string) => deleteDocumentShare(documentId!, shareId), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] }) });

  if (!documentId) return <Panel title="Collaboration"><p className="panel-copy">Save a document to share and review it.</p></Panel>;

  return (
    <>
      <Panel title="Sharing & permissions">
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); if (email.trim()) shareMutation.mutate(); }}>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" aria-label="Share with email" required />
          <select value={role} onChange={(event) => setRole(event.target.value as 'viewer' | 'editor')} aria-label="Share role">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button type="submit" className="action-button" disabled={shareMutation.isPending}>Share</button>
        </form>
        <div className="saved-documents-list">
          {(sharesQuery.data ?? []).map((share) => (
            <div className="saved-document-card" key={share.id}>
              <span className="saved-document-card__name">{share.email}</span>
              <span className="saved-document-card__meta">{share.role}</span>
              <button type="button" className="action-button" onClick={() => deleteShareMutation.mutate(share.id)}>Remove</button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Comments & review">
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); if (comment.trim()) addCommentMutation.mutate(); }}>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={activeParaId ? `Comment on ${activeParaId}` : 'Add a document comment'} aria-label="Comment" rows={3} required />
          <button type="submit" className="action-button" disabled={!comment.trim() || addCommentMutation.isPending}>Add comment</button>
        </form>
        <div className="saved-documents-list">
          {(commentsQuery.data ?? []).map((entry) => (
            <div className={`saved-document-card${entry.resolvedAt ? ' saved-document-card--muted' : ''}`} key={entry.id}>
              <span className="saved-document-card__name">{entry.authorName}</span>
              <span className="saved-document-card__meta">{entry.body}{entry.paraId ? ` · ${entry.paraId}` : ''}</span>
              <button type="button" className="action-button" onClick={() => resolveMutation.mutate({ id: entry.id, resolved: !entry.resolvedAt })}>{entry.resolvedAt ? 'Reopen' : 'Resolve'}</button>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
