/**
 * Uso: node test-api.mjs <ruta-imagen> [dni|acta]
 * Ejemplo: node test-api.mjs ./foto_dni.jpg dni
 */

import { readFileSync } from "fs";
import { extname } from "path";

const [, , imagePath, docType = "dni"] = process.argv;

if (!imagePath) {
  console.error("Uso: node test-api.mjs <ruta-imagen> [dni|acta]");
  process.exit(1);
}

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const ext = extname(imagePath).toLowerCase();
const mime = MIME[ext];
if (!mime) {
  console.error(`Extensión no soportada: ${ext}. Usa .jpg, .png o .webp`);
  process.exit(1);
}

let buffer;
try {
  buffer = readFileSync(imagePath);
} catch {
  console.error(`No se pudo leer el archivo: ${imagePath}`);
  process.exit(1);
}

const form = new FormData();
form.append("document", new Blob([buffer], { type: mime }), imagePath);
form.append("type", docType);

console.log(`\nEnviando '${imagePath}' al endpoint como tipo '${docType}'…\n`);

const res = await fetch("http://localhost:3000/api/validate", {
  method: "POST",
  body: form,
});

const data = await res.json();

console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(data, null, 2));
