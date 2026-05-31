type BreadcrumbsProps = {
  documentName: string;
  sourceKind: string;
};

export function Breadcrumbs({ documentName, sourceKind }: BreadcrumbsProps) {
  const rootLabel = sourceKind === 'sample' ? 'Samples' : 'My Library';
  const categoryLabel = sourceKind === 'local-file' ? 'Uploaded' : 'Documents';

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumbs">
      <ol className="breadcrumbs__list">
        <li className="breadcrumbs__item">
          <span className="breadcrumbs__link">{rootLabel}</span>
        </li>
        <li className="breadcrumbs__separator">/</li>
        <li className="breadcrumbs__item">
          <span className="breadcrumbs__link">{categoryLabel}</span>
        </li>
        <li className="breadcrumbs__separator">/</li>
        <li className="breadcrumbs__item breadcrumbs__item--active">
          <span className="breadcrumbs__current" title={documentName}>
            {documentName}
          </span>
        </li>
      </ol>
    </nav>
  );
}
