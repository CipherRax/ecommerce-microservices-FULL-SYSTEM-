import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";

// For local development — adjust path if needed
const serviceAccountPath = join(
  __dirname,
  "../../../firebase-service-account.json",
);

let app: admin.app.App;

// Prevent double initialization (good practice)
if (admin.apps.length === 0) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: 'https://your-project-id.firebaseio.com',   // optional for now
    // projectId: 'your-project-id',                             // usually auto-detected
  });

  console.log("Firebase Admin initialized successfully");
} else {
  app = admin.app(); // reuse existing
}

export const auth = app.auth();
export const firestore = app.firestore(); // we'll use later in other services

// Optional: export the whole admin for flexibility
export { admin };
