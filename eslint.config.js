import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'coverage', 'node_modules', 'e2e', '.kilo'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2023,
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            // Data-fetching hooks intentionally kick off async loads from effects
            // and settle state after `await`. The compiler rule cannot tell this
            // apart from synchronous cascading setState, so downgrade it to a
            // warning instead of forbidding the standard fetch-on-mount pattern.
            'react-hooks/set-state-in-effect': 'warn',
        },
    },
    {
        // Prisma-generated client code is not ours to lint.
        ignores: ['server/generated/**'],
    },
    {
        // Test helpers and mocks are not part of the HMR surface.
        files: ['src/test/**', '**/*.test.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
    {
        // The i18n module ships hooks and pure helpers alongside the provider;
        // it is not an HMR component boundary.
        files: ['src/i18n/**'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
);
