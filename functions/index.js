/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

/* ---- 1. Save a single RSVP (POST /saveRsvp) ---- */
exports.saveRsvp = functions.https.onRequest(async (req, res) => {
  // CORS – allow your domain only, adjust as needed
  res.set("Access-Control-Allow-Origin", "https://gerzl.github.io/wedding-rsvp");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");

  if (req.method !== "POST") return res.status(405).send("Use POST");

  const {inviteId, name, attendance, guests, dietary, song} = req.body || {};
  if (!inviteId || !name) return res.status(400).send("Missing fields");

  await db.collection("rsvps").doc(inviteId).set({
    inviteId, name, attendance, guests, dietary, song,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  });
  return res.json({ok: true});
});

/* ---- 2. List all RSVPs – admin only ---- */
exports.listRsvps = functions.https.onRequest(async (req, res) => {
  const {key} = req.query;
  if (key !== "moon-phase-delta") return res.status(403).send("Forbidden");

  const snap = await db.collection("rsvps").orderBy("name").get();
  const list = snap.docs.map((d) => (d.data()));
  return res.json(list);
});
