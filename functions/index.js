/**
 * Firebase Cloud Functions: Google Sheets–backed RSVP service
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const {google} = require("googleapis");

// === Configuration constants ===
const SPREADSHEET_ID = "1tN5JcR2ZAgBFdUYwycTznZsq8uxoovdAtRfPvQaLJuI";
const RANGE_DATA = "Guests!A2:Z"; // sheet name and data range
const COL_ID = 6; // F = inviteId (1-based)
const COL_ATTENDING = 24; // X = attendance
const COL_GUESTS = 25; // Y = guests
const COL_TS = 26; // Z = timestamp
const ADMIN_KEY = "moon-phase-delta";

// === Helper: create an authenticated Sheets client ===
/* eslint-disable-next-line require-jsdoc */
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "keys/key.json", // ensure this file exists and is .gitignored
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({version: "v4", auth});
}

// === Helper: find a row by invite ID ===
/* eslint-disable-next-line require-jsdoc */
async function findRowById(sheets, id) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE_DATA,
    majorDimension: "ROWS",
  });
  const rows = resp.data.values || [];
  const idx = rows.findIndex((r) => r[COL_ID - 1] === id);
  if (idx === -1) return null;
  return {rowNumber: idx + 2, row: rows[idx]};
}

// === 1. Save RSVP to Google Sheets ===
exports.saveRsvp = functions.https.onRequest(async (req, res) => {
  // CORS setup
  const origin = req.headers.origin;
  if (origin === "https://gerzl.github.io" || origin === "https://gelaiandgerzl.web.app") {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  const {inviteId, name, attendance, guests} = req.body || {};
  if (!inviteId || !name) return res.status(400).send("Missing fields");

  const sheets = await getSheetsClient();
  const record = await findRowById(sheets, inviteId);
  if (!record) return res.status(404).send("Unknown invite ID");

  // Build A1 range, e.g. X5:Z5
  const startCol = String.fromCharCode(64 + COL_ATTENDING);
  const endCol = String.fromCharCode(64 + COL_TS);
  const range = `${RANGE_DATA.split("!")[0]}!
  ${startCol}
  ${record.rowNumber}:${endCol}${record.rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    resource: {values: [[attendance, guests, new Date().toISOString()]]},
  });

  res.json({ok: true});
});

// === 2. List all RSVPs (admin only) ===
exports.listRsvps = functions.https.onRequest(async (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) return res.sendStatus(403);

  const sheets = await getSheetsClient();
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

  res.json(result);
});

// === 3. Get guest metadata by ID ===
exports.getGuest = functions.https.onRequest(async (req, res) => {
  const id = req.query.id;
  const sheets = await getSheetsClient();
  const record = await findRowById(sheets, id);
  if (!record) return res.status(404).send("Unknown invite ID");
  const data = record.row;
  res.json({
    name: data[1],
    isChild: data[2],
    alreadyConfirmed: data[3],
    religion: data[4],
  });
});

// === 4. Mirror hook (placeholder) ===
exports.mirror = functions.https.onRequest(async (req, res) => {
  // Implement mirroring from Apps Script onEdit if desired
  res.json({ok: true});
});
