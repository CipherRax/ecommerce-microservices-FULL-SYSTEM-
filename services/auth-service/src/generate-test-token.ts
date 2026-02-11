// generate-test-token.ts  (run once with npx tsx generate-test-token.ts)
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBcxa5w2wqiPwR1_OrBM1KKpAUhj3Ryth4",
  authDomain: "micro-services-23b2a.firebaseapp.com",
  projectId: "micro-services-23b2a",
  storageBucket: "micro-services-23b2a.firebasestorage.app",
  messagingSenderId: "72927734050",
  appId: "1:72927734050:web:42febca0ba5ad36be51d7b",
  measurementId: "G-1SHFM6GFJL",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function getIdToken() {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      "mike11@gmail.com", // ← change to your test email
      "mike11", // ← change to the password
    );

    const idToken = await userCredential.user.getIdToken(
      /* forceRefresh */ true,
    );
    console.log("\n=== YOUR VALID ID TOKEN ===\n");
    console.log(idToken);
    console.log(
      "\nPaste this into curl or Postman Authorization: Bearer <token>",
    );
  } catch (error: any) {
    console.error("Error getting token:", error.code, error.message);
  }
}

getIdToken();
