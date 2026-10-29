// Domain glossary used by the LOCAL similarity engine (no API key needed).
//
// Testers describe the same thing with different words ("froze", "hangs",
// "stopped responding"). The glossary maps those phrases to one concept so the
// engine can see they match. A real UAT manager would grow this list per
// project; when an AI key is set, embeddings handle most of this instead.
//
// `symptom: true` concepts describe WHAT went wrong, and count double when
// comparing two reports (sharing a symptom matters more than sharing a noun).

export interface Concept {
  id: string;
  label: string; // shown to people
  symptom?: boolean;
  phrases: string[]; // lower-case; matched on word boundaries
}

export const GLOSSARY: Concept[] = [
  // Symptoms
  { id: "freeze", label: "freezes / stops responding", symptom: true, phrases: ["stopped responding", "stops responding", "not responding", "unresponsive", "spin forever", "spins forever", "spinning", "froze", "freezes", "freeze", "frozen", "freezing", "hangs", "hang", "hung"] },
  { id: "silentfail", label: "fails with no error", symptom: true, phrases: ["nothing happened", "no error", "fails silently", "failed silently", "never appears", "isn't there", "is not there", "not there", "doesn't appear", "no file in the list"] },
  { id: "duplicate", label: "duplicated", symptom: true, phrases: ["two identical", "duplicate", "duplicated", "twice", "double clicked", "double-clicked", "double click", "two approval requests"] },
  { id: "delay", label: "late / delayed", symptom: true, phrases: ["didn't receive", "did not receive", "never received", "arrived late", "minutes late", "late", "delayed", "delay", "waited"] },
  { id: "slow", label: "slow to load", symptom: true, phrases: ["took ages", "takes ages", "slow", "slowly", "took over", "loads slowly"] },
  { id: "blank", label: "blank / grey screen", symptom: true, phrases: ["goes blank", "blank", "grey box", "gray box", "white page"] },
  { id: "rejected", label: "rejected / invalid", symptom: true, phrases: ["rejected", "unsupported file type", "invalid", "doesn't accept", "does not accept"] },
  { id: "wrongcurrency", label: "wrong currency", symptom: true, phrases: ["usd", "dollars", "$", "instead of gbp", "currency is wrong", "currency"] },

  // Things in the app
  { id: "costcentre", label: "cost centre", phrases: ["cost centre", "cost center", "cost-centre", "department code", "cc code"] },
  { id: "dropdown", label: "dropdown", phrases: ["drop down", "drop-down", "dropdown"] },
  { id: "upload", label: "upload", phrases: ["upload", "uploaded", "uploading", "attach", "attached", "attaching"] },
  { id: "receipt", label: "receipt", phrases: ["receipt", "receipts", "invoice", "scan", "scanned"] },
  { id: "pdf", label: "PDF", phrases: ["pdf", "pdfs"] },
  { id: "largefile", label: "large file", phrases: ["7mb", "large pdf", "bigger pdfs", "big file", "large file", "larger file"] },
  { id: "photo", label: "photo", phrases: ["photo", "photos", "iphone", "heic", "picture"] },
  { id: "submit", label: "submit", phrases: ["submit", "submitted", "submitting", "submission"] },
  { id: "email", label: "email", phrases: ["email", "e-mail"] },
  { id: "notification", label: "notification", phrases: ["notification", "notifications"] },
  { id: "approval", label: "approval", phrases: ["approval", "approved", "approve", "approver"] },
  { id: "rail", label: "train / rail", phrases: ["train journeys", "train", "trains", "rail", "railway"] },
  { id: "vpn", label: "VPN", phrases: ["vpn"] },
  { id: "dashboard", label: "dashboard", phrases: ["dashboard"] },
  { id: "summary", label: "summary page", phrases: ["summary page", "summary"] },
  { id: "gbp", label: "GBP / pounds", phrases: ["gbp", "pounds", "£"] },
];

export const CONCEPT_BY_ID: Record<string, Concept> = Object.fromEntries(
  GLOSSARY.map((c) => [c.id, c]),
);
