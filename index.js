  /* ------------- 0. Configuration ------------- */
  // hard-coded invite IDs → name shown on landing
  const INVITEES = {
    "7cPxy6": "HA",
    "L9n2Qw": "Michael Jackson",
    "Q1bV02": "Chris Pratt",
    "ABCDEF": "Gelai & Gerzl",
    "KHRIST": "Khristia & Khrizteen",
  };

  // endpoint of your Firebase Function
  const ENDPOINT = "https://us-central1-gelaiandgerzl.cloudfunctions.net/saveRsvp";
  // secret key to access the admin listing endpoint
  const ADMIN_KEY = "pee-pee-poo-poo";

  const $ = sel => document.querySelector(sel);
  const qs = new URLSearchParams(location.search);
  const inviteId = qs.get("id");
  const admin = qs.get("admin") === ADMIN_KEY;


  if (admin) {
    // Admin mode (/?admin=pee-pee-poo-poo)
    $("#adminPanel").hidden = false;
    loadAllResponses();
  } else if (inviteId && INVITEES[inviteId]) {
    // Normal guest mode
    $("#rsvpSection").hidden = false;
    $("#inviteId").value = inviteId;
    $("#greeting").innerHTML =
      `Hi <b>${INVITEES[inviteId]}</b>, we’re so excited to celebrate with you!`;
  } else {
    document.body.innerHTML =
      "<main><p style='margin-top:3rem;font-size:1.25rem'>Sorry – that link isn’t recognised.<br>Please check with the couple.</p></main>";
  }


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