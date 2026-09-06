import { emptyLead, validateLead, type LeadInput } from "./model";
export const csvHeaders = [
  "name",
  "address",
  "email",
  "phone",
  "website",
  "websiteStatus",
  "contacted",
  "notes",
] as const;
export function parseCsv(text: string): LeadInput[] {
  if (text.length > 1_000_000)
    throw new Error("CSV must be smaller than 1 MB.");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw new Error("Unexpected quote in CSV.");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed) throw new Error("Unexpected text after a quoted CSV field.");
      cell += c;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quote.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim().toLowerCase());
  if (!headers?.includes("name"))
    throw new Error(
      "CSV needs a name column. Download the template for supported columns.",
    );
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV contains duplicate column names.");
  if (rows.length > 500)
    throw new Error("Import up to 500 businesses at a time.");
  if (!rows.length) throw new Error("CSV has no business rows.");
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `Row ${index + 2}: column count does not match the header.`,
      );
    const o = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
    const contacted = o.contacted?.toLowerCase() || "false";
    if (!["true", "false", "yes", "no", "1", "0"].includes(contacted))
      throw new Error(`Row ${index + 2}: contacted must be true or false.`);
    try {
      return validateLead({
        ...emptyLead,
        ...o,
        source: "csv",
        websiteStatus: o.websitestatus || (o.website ? "present" : "unknown"),
        contacted: ["true", "yes", "1"].includes(contacted),
      });
    } catch (e) {
      throw new Error(
        `Row ${index + 2}: ${e instanceof Error ? e.message : "Invalid record"}`,
      );
    }
  });
}
export function makeCsv(rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [
    csvHeaders.join(","),
    ...rows.map((r) => csvHeaders.map((k) => escape(r[k])).join(",")),
  ].join("\r\n");
}
