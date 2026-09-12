export type ShortcutDefinition = {
  keys: string[];
  description: string;
};

export const APP_SHORTCUTS: ShortcutDefinition[] = [
  { keys: ['Ctrl', 'S'], description: 'Save current document' },
  { keys: ['Ctrl', 'Shift', 'S'], description: 'Save as new document' },
  { keys: ['Ctrl', 'O'], description: 'Open .docx from computer' },
  { keys: ['Ctrl', '/'], description: 'Show or hide this help' },
  { keys: ['Ctrl', '\\'], description: 'Toggle document outline' },
  { keys: ['Ctrl', 'I'], description: 'Toggle document details' },
  { keys: ['Ctrl', 'P'], description: 'Open command palette' },
];
