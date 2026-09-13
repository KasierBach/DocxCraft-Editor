import { hashPassphrase } from '../server/auth.ts';

const passphrase = process.argv[2];

if (!passphrase) {
  console.error('Usage: npm run hash-passphrase -- <passphrase>');
  process.exit(1);
}

console.log(hashPassphrase(passphrase));
