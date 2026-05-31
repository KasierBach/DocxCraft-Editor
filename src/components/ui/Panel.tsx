import type { ReactNode } from 'react';

type PanelProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  error?: boolean;
};

export function Panel({ title, children, className = '', error = false }: PanelProps) {
  const baseClass = error ? 'panel panel--error' : 'panel';
  
  return (
    <section className={`${baseClass} ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
