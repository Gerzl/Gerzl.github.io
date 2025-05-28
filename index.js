  /* ------------- 0. Configuration ------------- */
  // hard-coded invite IDs → name shown on landing
  const INVITEES = {
    "7cPxy6": "HA",
    "L9n2Qw": "Chris R.",
    "Q1bV02": "Riley & Pat",
  };

  // endpoint of your Firebase Function
  const ENDPOINT = "https://us-central1-gelaiandgerzl.cloudfunctions.net/saveRsvp";
  // secret key to access the admin listing endpoint
  const ADMIN_KEY = "moon-phase-delta";

  /* ------------- 1. Helper shortcuts ------------- */
  const $ = sel => document.querySelector(sel);
  const qs = new URLSearchParams(location.search);
  const inviteId = qs.get("id");
  const admin = qs.get("admin") === ADMIN_KEY;

  /* ------------- 2. Routing ------------- */
  if (admin) {
    // Admin mode (/?admin=moon-phase-delta)
    $("#adminPanel").hidden = false;
    loadAllResponses();
  } else if (inviteId && INVITEES[inviteId]) {
    // Normal guest mode
    $("#rsvpSection").hidden = false;
    $("#inviteId").value = inviteId;
    $("#greeting").innerHTML =
      `Hi <b>${INVITEES[inviteId]}</b>, we’re so excited to celebrate with you!`;
  } else {
    // Invalid / missing link
    document.body.innerHTML =
      "<main><p style='margin-top:3rem;font-size:1.25rem'>Sorry – that link isn’t recognised.<br>Please check with the couple.</p></main>";
  }

  /* ------------- 3. Guest submission ------------- */
  $("#rsvpForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    $("#status").textContent = "Saving…";

    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
      });
      if (res.ok) {
        $("#rsvpSection").hidden = true;
        $("#thanks").hidden = false;
      } else throw new Error(await res.text());
    } catch (err) {
      console.error(err);
      $("#status").textContent =
        "❌ Oops, something went wrong. Please try again later.";
    }
  });

  /* ------------- 4. Admin listing ------------- */
  async function loadAllResponses() {
    const tbody = $("#adminTable tbody");
    try {
      const res = await fetch(`${ENDPOINT}?list=1&key=${ADMIN_KEY}`);
      const list = await res.json();             // [{...doc}, …]
      for (const g of list) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${g.name}</td><td>${g.inviteId}</td>
          <td>${g.attendance}</td><td>${g.guests}</td><td>${g.dietary || ""}</td>`;
        tbody.appendChild(tr);
      }
    } catch (err) {
      tbody.innerHTML =
        "<tr><td colspan='5'>Couldn’t load responses. Check the key.</td></tr>";
    }
  }