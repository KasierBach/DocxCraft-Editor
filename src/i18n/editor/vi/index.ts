import type { Translations } from '@eigenpal/docx-editor-i18n';

import { coreVi } from './core';
import { colorPickerVi } from './colorPicker';
import { dialogsVi } from './dialogs';
import { tablesVi } from './tables';
import { mediaVi } from './media';
import { miscVi } from './misc';

/**
 * Vietnamese overrides for the editor's built-in UI, split into slices so each
 * section can be translated and reviewed independently. Any key left out falls
 * back to the editor's English default (see `@eigenpal/docx-editor-i18n`).
 */
export const editorVi: Translations = {
  ...coreVi,
  ...colorPickerVi,
  ...dialogsVi,
  ...tablesVi,
  ...mediaVi,
  ...miscVi,
};
