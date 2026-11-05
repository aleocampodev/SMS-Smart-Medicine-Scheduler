/**
 * Masks sensitive national document IDs for logs and public interfaces (P-SEC-02).
 * Example: 1234567890 -> ******7890
 */
export function maskDocumentNumber(documentNumber: string): string {
  if (!documentNumber || documentNumber.length <= 4) {
    return "****";
  }
  const visiblePart = documentNumber.slice(-4);
  const maskedPart = "*".repeat(documentNumber.length - 4);
  return `${maskedPart}${visiblePart}`;
}
