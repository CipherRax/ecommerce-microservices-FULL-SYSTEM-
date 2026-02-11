import admin from 'firebase-admin';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, '../../../firebase-service-account.json');

console.log('[Firebase Init] Loading service account from:', serviceAccountPath);

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log('[Firebase Init] Service account loaded successfully');
  console.log('[Firebase Init] Project ID from service account:', serviceAccount.project_id);
} catch (err: any) {
  console.error('[Firebase Init] ERROR loading service account:', err.message);
  process.exit(1);
}

let app: admin.app.App;

if (admin.apps.length === 0) {
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    });

    console.log('[Firebase Init] Admin SDK initialized successfully');
    console.log('[Firebase Init] Project ID used:', app.options.credential?.projectId);
    console.log('[Firebase Init] Database name:', app.options.databaseName || '(default)');

    // Quick test connection
    const testDb = app.firestore();
    console.log('[Firebase Init] Firestore instance created');
  } catch (err) {
    console.error('[Firebase Init] ERROR during initializeApp:', err);
    process.exit(1);
  }
} else {
  app = admin.app();
  console.log('[Firebase Init] Reusing existing app instance');
}

// export const firestore = app.firestore();
// @ts-ignore
export const firestore = admin.firestore(app, '(default)')
export const auth = app.auth();