// Backup completo de las tablas de Supabase via REST (service_role).
// Uso:
//   node scripts/backup.js [directorioSalida]
// Requiere las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// (se leen de .env.local si no están en el entorno).
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const TABLAS = [
  "alumnos",
  "docentes",
  "cursos",
  "horario",
  "asistencia",
  "multas",
  "configuracion",
  "clases_abiertas",
];

async function main() {
  const env = loadEnv();
  const url = process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const outDir = process.argv[2] || path.join(__dirname, "..", "backups");
  const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const carpeta = path.join(outDir, `backup-${fecha}`);
  fs.mkdirSync(carpeta, { recursive: true });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let total = 0;

  for (const tabla of TABLAS) {
    let todos = [];
    let desde = 0;
    const page = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from(tabla)
        .select("*")
        .order("id", { ascending: true })
        .range(desde, desde + page - 1);
      if (error) {
        console.error(`Error en ${tabla}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      todos = todos.concat(data);
      if (data.length < page) break;
      desde += page;
    }
    const archivo = path.join(carpeta, `${tabla}.json`);
    fs.writeFileSync(archivo, JSON.stringify(todos, null, 2), "utf8");
    total += todos.length;
    console.log(`${tabla.padEnd(14)} ${todos.length} filas`);
  }

  const resumen = {
    generado: new Date().toISOString(),
    tablas: TABLAS,
    totalFilas: total,
  };
  fs.writeFileSync(path.join(carpeta, "_resumen.json"), JSON.stringify(resumen, null, 2), "utf8");
  console.log(`\nBackup completo en ${carpeta} (${total} filas en total).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
