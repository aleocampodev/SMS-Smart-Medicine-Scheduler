import { strict as assert } from "node:assert";

import { maskDocumentNumber } from "../sanitize";

console.log("🧪 Testing shared PII masking (P-SEC-02)...\n");

assert.equal(maskDocumentNumber("1234567890"), "******7890");
console.log("✅ Standard national ID masked to ******7890");

assert.equal(maskDocumentNumber("1234"), "****");
console.log("✅ Four-digit input is fully masked");

assert.equal(maskDocumentNumber("12345"), "*2345");
console.log("✅ Five-digit input keeps only the last four");

assert.equal(maskDocumentNumber(""), "****");
console.log("✅ Empty input returns the safe fallback");

console.log("\n🎉 ALL PII MASKING TESTS PASSED SUCCESSFULLY!");
