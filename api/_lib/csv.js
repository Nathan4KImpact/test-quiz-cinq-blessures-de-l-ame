// Petit utilitaire CSV — parsing et sérialisation avec guillemets doubles.
// Assez pour nos besoins d'import/export admin, sans dépendance npm.

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows, columns) {
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((col) => escapeCell(row[col])).join(","))
    .join("\n");
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

// Parse CSV : gère les guillemets doubles, les virgules et les sauts de
// ligne à l'intérieur des champs. Retourne un tableau de tableaux.
function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      current.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Dernier champ / ligne non terminée par \n
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}

function parseCSVToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell && cell.trim().length > 0))
    .map((row) => {
      const obj = {};
      header.forEach((key, idx) => {
        obj[key] = row[idx] !== undefined ? row[idx] : "";
      });
      return obj;
    });
}

module.exports = { toCSV, parseCSV, parseCSVToObjects };
