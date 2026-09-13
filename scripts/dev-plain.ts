// Starts the dev servers without auth: the editor opens directly, with no
// landing page or passphrase. Useful for quick editing sessions.
process.env.AUTH_MODE = 'off';

await import('./dev.ts');
