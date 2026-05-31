export type DeepLinkSource = 'sample' | 'saved';

export type DeepLinkState = {
  source: DeepLinkSource | null;
  documentId: string | null;
  paraId: string | null;
};

export function readDeepLink(search: string): DeepLinkState {
  const params = new URLSearchParams(search);
  const source = params.get('source');
  const documentId = params.get('documentId');
  const paraId = params.get('paraId');

  return {
    source: source === 'saved' || source === 'sample' ? source : null,
    documentId: documentId?.trim() || null,
    paraId: paraId?.trim() || null,
  };
}

export function buildDeepLinkSearch({
  source,
  documentId,
  paraId,
}: DeepLinkState) {
  const params = new URLSearchParams();

  if (source) {
    params.set('source', source);
  }

  if (source === 'saved' && documentId) {
    params.set('documentId', documentId);
  }

  if (paraId) {
    params.set('paraId', paraId);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
