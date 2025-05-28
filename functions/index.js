/**
 * Firebase Cloud Functions: Google Sheets–backed RSVP service (v2-fix)
 * - Removes stray new-lines in the A1 range that broke the Sheets API
 * - Adds defensive try/catch so errors surface with an explanatory 500
 * - Caches the Sheets client to speed up subsequent invocations
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const {google} = require("googleapis");

// === Configuration constants ===
const SPREADSHEET_ID = "1tN5JcR2ZAgBFdUYwycTznZsq8uxoovdAtRfPvQaLJuI";
const RANGE_DATA = "Guests!A2:Z"; // sheet name and covered columns
const COL_ID = 6; // F = inviteId (1-based)
const COL_ATTENDING = 24; // X
const COL_GUESTS = 25; // Y
const COL_TS = 26; // Z
const ADMIN_KEY = "moon-phase-delta";

// === Helper: return (cached) authenticated Sheets client ===
let sheetsInstance; // reuse across invocations / warm boots
/* eslint-disable-next-line require-jsdoc */
async function getSheets() {
  if (sheetsInstance) return sheetsInstance;
  const auth = new google.auth.GoogleAuth({
    keyFile: "keys/key.json", // keep this out of VCS
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsInstance = google.sheets({version: "v4", auth});
  return sheetsInstance;
}


// === Helper: locate row by inviteId ===
/* eslint-disable-next-line require-jsdoc */
async function findRowById(sheets, id) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE_DATA,
    majorDimension: "ROWS",
  });
  const rows = resp.data.values || [];
  const idx = rows.findIndex((r) => r[COL_ID - 1] === id);
  return idx === -1 ? null : {rowNumber: idx + 2, row: rows[idx]};
}

// === 1. Save RSVP ===
exports.saveRsvp = functions.https.onRequest(async (req, res) => {
  // ---- CORS ----
  const origin = req.headers.origin;
  if (["https://gerzl.github.io"].includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);

  // ---- Validate body ----
  const {inviteId, name, attendance, guests} = req.body || {};
  if (!inviteId || !name) return res.status(400).send("Missing fields");

  try {
    const sheets = await getSheets();
    const record = await findRowById(sheets, inviteId);
    if (!record) return res.status(404).send("Unknown invite ID");

    // Build proper A1 range: e.g. "Guests!X5:Z5"
    const sheetName = RANGE_DATA.split("!")[0];
    const startCol = String.fromCharCode(64 + COL_ATTENDING);
    const endCol = String.fromCharCode(64 + COL_TS);
    const range = `${sheetName}!${startCol}
    ${record.rowNumber}:${endCol}${record.rowNumber}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      resource: {values: [[attendance, guests, new Date().toISOString()]]},
    });

    return res.json({ok: true});
  } catch (err) {
    console.error("saveRsvp: Sheets update failed", err);
    return res.status(500).send("Sheets update failed");
  }
});

// === 2. List all RSVPs (admin) ===
exports.listRsvps = functions.https.onRequest(async (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.sendStatus(403);
  try {
    const sheets = await getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE_DATA,
    });
    const rows = resp.data.values || [];
    const result = rows.map((r) => ({
      inviteId: r[COL_ID - 1],
      name: r[1],
      attendance: r[COL_ATTENDING - 1] || "",
      guests: r[COL_GUESTS - 1] || "",
      dietary: r[22] || "",
    }));
    return res.json(result);
  } catch (err) {
    console.error("listRsvps failed", err);
    return res.status(500).send("List failed");
  }
});

// === 3. Get guest metadata ===
exports.getGuest = functions.https.onRequest(async (req, res) => {
  try {
    const id = req.query.id;
    const sheets = await getSheets();
    const record = await findRowById(sheets, id);
    if (!record) return res.status(404).send("Unknown invite ID");
    const d = record.row;
    return res.json({
      name: d[1],
      isChild: d[2],
      alreadyConfirmed: d[3],
      religion: d[4],
    });
  } catch (err) {
    console.error("getGuest failed", err);
    return res.status(500).send("Get guest failed");
  }
});

// === 4. Mirror hook: Sheet ➜ Firestore (realtime) ===
exports.mirror = functions.https.onRequest(async (req, res) => {
  const secret = req.get("x-mirror-key");
  if (secret !== "sheet-to-fb") return res.sendStatus(403);

  const data = req.body;
  if (!data.inviteId) return res.status(400).send("Bad payload");

  try {
    await admin.firestore()
        .collection("rsvps")
        .doc(data.inviteId) // 1 doc per inviteId
        .set(data, {merge: true}); // merge so partial updates work

    return res.json({ok: true});
  } catch (err) {
    console.error("mirror failed", err);
    return res.status(500).send("mirror failed");
  }
});
