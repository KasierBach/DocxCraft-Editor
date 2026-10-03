import { describe, expect, it } from 'vitest';
import { serializeDocx, type Paragraph } from '@eigenpal/docx-editor-core';

import { createDemoDocument } from '../demoDocument';

describe('built-in sample document', () => {
  it('serializes navigable paragraphs, headings and page breaks into valid OOXML', () => {
    const document = createDemoDocument();
    const paragraphs = document.package.document.content.filter((item): item is Paragraph => item.type === 'paragraph');
    expect(paragraphs).toHaveLength(10);
    expect(new Set(paragraphs.map((paragraph) => paragraph.paraId)).size).toBe(10);
    const xml = new DOMParser().parseFromString(serializeDocx(document), 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect(xml.documentElement.textContent).toContain('Docx Editor Scroll Demo');
    expect(xml.documentElement.textContent).toContain('2. Second page target');
    expect(xml.documentElement.textContent).toContain('3. Final checkpoint');
    const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    expect(xml.getElementsByTagNameNS(namespace, 'p')).toHaveLength(10);
    expect(xml.getElementsByTagNameNS(namespace, 'pageBreakBefore')).toHaveLength(2);
    const headingStyles = [...xml.getElementsByTagNameNS(namespace, 'pStyle')]
      .filter((style) => style.getAttributeNS(namespace, 'val') === 'Heading1');
    expect(headingStyles).toHaveLength(3);
  });

  it('creates independent documents so editing one sample cannot corrupt a fresh one', () => {
    const edited = createDemoDocument();
    edited.package.document.content.splice(0, 3);
    const fresh = createDemoDocument();
    expect(fresh.package.document.content).toHaveLength(10);
    expect(fresh.package.document.content[0]).toMatchObject({
      type: 'paragraph', content: [{ type: 'run', content: [{ type: 'text', text: 'Docx Editor Scroll Demo' }] }],
    });
  });
});
