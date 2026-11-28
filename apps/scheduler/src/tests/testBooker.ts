import { strict as assert } from "node:assert";
import http from "node:http";

import {
  PlaywrightBooker,
  evaluateSubmissionOutcome,
  resolveBranchLabels,
} from "../automation/playwrightBooker.js";
import type { Profile, QantySlot } from "../types/index.js";

const sampleProfile: Profile = {
  id: "profile_test",
  displayName: "Test User",
  documentType: "CC",
  documentNumber: "1234567890",
  firstName: "Aleja",
  lastName: "Ocampo",
  birthDate: "1995-04-20",
  phone: "3001234567",
  email: "aleja@example.com",
};

async function withMockServer(html: string, fn: (url: string) => Promise<void>): Promise<void> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("Failed to bind mock HTTP server");
  }

  try {
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function runTests() {
  console.log("===========================================================");
  console.log("🧪 RUNNING PLAYWRIGHT BOOKER UNIT TESTS");
  console.log("===========================================================\n");

  console.log("Test 1: resolveBranchLabels maps PISO3 to full name + short token");
  const labels = resolveBranchLabels("PISO3");
  assert.ok(labels.some((l) => l.includes("PISO 3")));
  assert.ok(labels.includes("PISO3"));
  console.log("✅ Passed: resolveBranchLabels resolved PISO3 labels.");

  console.log("\nTest 2: evaluateSubmissionOutcome detects confirmations and fails closed");
  const okOutcome = evaluateSubmissionOutcome("Cita confirmada. Código: QNT-4821", false);
  assert.equal(okOutcome.confirmed, true);
  assert.equal(okOutcome.confirmationCode, "QNT-4821");

  const errOutcome = evaluateSubmissionOutcome("Error al agendar: turno no disponible", false);
  assert.equal(errOutcome.confirmed, false);

  const silentOutcome = evaluateSubmissionOutcome("Formulario de citas", true);
  assert.equal(silentOutcome.confirmed, false);
  console.log(
    "✅ Passed: evaluateSubmissionOutcome handles confirmation, error, and silent states.",
  );

  const booker = new PlaywrightBooker();

  console.log("\nTest 3: PlaywrightBooker fails closed when required form inputs are missing");
  await withMockServer("<html><body><h1>Portal vacio</h1></body></html>", async (url) => {
    const slot: QantySlot = {
      date: "2026-12-01",
      time: "09:00",
      status: "free",
      branch: "PISO3",
      raw: { booking_url: url },
    };
    const res = await booker.bookAppointment(slot, sampleProfile);
    assert.equal(res.success, false, "Expected fail-closed booking result when form is missing");
    assert.ok(res.message.includes("missing required field"), `Unexpected message: ${res.message}`);
  });
  console.log("✅ Passed: PlaywrightBooker failed closed on missing form fields.");

  console.log("\nTest 4: PlaywrightBooker confirms booking and extracts confirmation code");
  const validHtml = `
    <html>
      <body>
        <form id="booking-form">
          <input id="documentNumber" name="doc" />
          <input id="firstName" name="first" />
          <input id="lastName" name="last" />
          <input id="email" type="email" name="email" />
          <button type="submit">Confirmar</button>
        </form>
        <div id="result"></div>
        <script>
          document.getElementById("booking-form").addEventListener("submit", function (e) {
            e.preventDefault();
            document.getElementById("booking-form").style.display = "none";
            document.getElementById("result").innerText = "Cita confirmada exitosamente. Código: QNT-9912";
          });
        </script>
      </body>
    </html>
  `;
  await withMockServer(validHtml, async (url) => {
    const slot: QantySlot = {
      date: "2026-12-01",
      time: "09:00",
      status: "free",
      branch: "PISO3",
      raw: { booking_url: url },
    };
    const res = await booker.bookAppointment(slot, sampleProfile);
    assert.equal(res.success, true, `Expected booking success, got: ${res.message}`);
    assert.equal(res.confirmationCode, "QNT-9912");
  });
  console.log("✅ Passed: PlaywrightBooker filled form, submitted, and extracted QNT-9912.");

  console.log("\n🎉 ALL PLAYWRIGHT BOOKER TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ PlaywrightBooker test failed:", err);
  process.exit(1);
});
