"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Bluetooth,
  Cloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plug,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { importarAnimales, parseCSV, readFileAsText, type CsvRow } from "@/lib/csv";
import {
  bluetoothDisponible,
  conectarLectorRFID,
  bufferAcsv,
  type BluetoothSesion,
} from "@/lib/bluetooth";

type Tab = "archivo" | "drive" | "bluetooth";

export default function ImportarPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  const puedeEditar = rol === "admin" || rol === "usuario";
  const lotes = db.lotes.filter((l) => l.campoId === id);
  const [tab, setTab] = useState<Tab>("archivo");
  const [loteId, setLoteId] = useState<string>("");
  const [preview, setPreview] = useState<CsvRow[] | null>(null);
  const [resultado, setResultado] = useState<{
    agregados: number;
    actualizados: number;
    omitidos: number;
  } | null>(null);

  if (!puedeEditar) {
    return (
      <div className="card p-8 text-ink-muted">
        Tu rol es <strong className="text-ink">sólo vista</strong>: no podés importar
        animales. Pedile a un admin que cambie tu rol.
      </div>
    );
  }

  function aplicar(rows: CsvRow[]) {
    const r = importarAnimales(id, rows, { loteId: loteId || undefined });
    setResultado(r);
    setPreview(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h3 className="font-display text-xl text-ink">Importar animales</h3>
            <p className="text-sm text-ink-muted mt-1">
              Las columnas reconocidas son:{" "}
              <code className="font-mono text-accent">caravana</code> (o{" "}
              <code className="font-mono text-accent">rfid</code> /{" "}
              <code className="font-mono text-accent">eid</code> /{" "}
              <code className="font-mono text-accent">id</code>),{" "}
              <code className="font-mono">nombre</code>,{" "}
              <code className="font-mono">sexo</code> (M/H),{" "}
              <code className="font-mono">raza</code>,{" "}
              <code className="font-mono">categoria</code>,{" "}
              <code className="font-mono">peso</code> (o{" "}
              <code className="font-mono">weight</code>),{" "}
              <code className="font-mono">fecha_nacimiento</code>,{" "}
              <code className="font-mono">observaciones</code>.
            </p>
          </div>
          <div>
            <label className="label block mb-1.5">Asignar a lote</label>
            <select
              className="input"
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
            >
              <option value="">Sin lote</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "archivo"} onClick={() => setTab("archivo")} Icon={Upload}>
          Archivo local
        </TabBtn>
        <TabBtn active={tab === "drive"} onClick={() => setTab("drive")} Icon={Cloud}>
          Google Drive
        </TabBtn>
        <TabBtn
          active={tab === "bluetooth"}
          onClick={() => setTab("bluetooth")}
          Icon={Bluetooth}
        >
          Lector RFID Bluetooth
        </TabBtn>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "archivo" && <ArchivoLocal onParsed={setPreview} />}
          {tab === "drive" && <DriveImport onParsed={setPreview} />}
          {tab === "bluetooth" && <BluetoothImport onParsed={setPreview} />}
        </motion.div>
      </AnimatePresence>

      {preview && (
        <Preview
          rows={preview}
          onCancel={() => setPreview(null)}
          onConfirm={() => aplicar(preview)}
        />
      )}

      {resultado && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 border-accent/40"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-accent" />
            <div>
              <div className="font-display text-lg text-ink">Importación lista</div>
              <div className="text-sm text-ink-muted">
                {resultado.agregados} agregados · {resultado.actualizados}{" "}
                actualizados · {resultado.omitidos} omitidos
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: any;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition border ${
        active
          ? "border-accent bg-accent/10 text-ink"
          : "border-line text-ink-muted hover:text-ink"
      }`}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

function ArchivoLocal({ onParsed }: { onParsed: (rows: CsvRow[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function manejar(file: File) {
    setErr(null);
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setErr("No se detectaron filas en el archivo.");
        return;
      }
      onParsed(rows);
    } catch (e: any) {
      setErr(e.message ?? "Error leyendo el archivo.");
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) manejar(f);
      }}
      className={`card p-10 text-center transition ${
        drag ? "border-accent/60 bg-accent/5" : ""
      }`}
    >
      <FileText className="mx-auto mb-3 text-ink-dim" />
      <div className="font-display text-xl text-ink">Arrastrá tu .csv acá</div>
      <p className="text-sm text-ink-muted mt-1">
        O hacé click para elegirlo desde tu equipo.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) manejar(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="btn-primary text-sm mt-5"
      >
        <Upload size={14} /> Elegir archivo
      </button>
      {err && <div className="text-sm text-red-300 mt-4">{err}</div>}
    </div>
  );
}

function DriveImport({ onParsed }: { onParsed: (rows: CsvRow[]) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function importar() {
    setErr(null);
    setLoading(true);
    try {
      const direct = normalizarDriveURL(url.trim());
      if (!direct) {
        setErr(
          "Pegá un link válido de Google Drive (compartido como 'cualquiera con el enlace')."
        );
        return;
      }
      const res = await fetch(direct);
      if (!res.ok) throw new Error("No se pudo descargar el archivo.");
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error("El archivo no tiene filas.");
      onParsed(rows);
    } catch (e: any) {
      setErr(
        e.message ??
          "No se pudo descargar. Asegurate de que el archivo esté en 'cualquiera con el enlace puede ver'."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-3 text-ink">
        <Cloud size={16} className="text-accent" />
        <h4 className="font-display text-lg">Importar desde Google Drive</h4>
      </div>
      <p className="text-sm text-ink-muted">
        Compartí el archivo en Drive como <strong>“Cualquiera con el enlace”</strong>{" "}
        y pegá la URL acá. Funciona con archivos .csv directos.
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/file/d/…"
        />
        <button onClick={importar} disabled={loading || !url} className="btn-primary text-sm">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Cloud size={14} />}
          Descargar
        </button>
      </div>
      {err && (
        <div className="mt-4 flex items-start gap-2 text-sm text-red-300">
          <AlertTriangle size={14} className="mt-0.5" /> {err}
        </div>
      )}
    </div>
  );
}

function normalizarDriveURL(url: string): string | null {
  // Acepta links del tipo /file/d/<ID>/view o ?id=<ID>
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const id = m1?.[1] ?? m2?.[1];
  if (!id) return null;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function BluetoothImport({ onParsed }: { onParsed: (rows: CsvRow[]) => void }) {
  const [sesion, setSesion] = useState<BluetoothSesion | null>(null);
  const [buffer, setBuffer] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [estado, setEstado] = useState<"idle" | "conectando" | "escuchando">("idle");

  const disponible = bluetoothDisponible();

  async function conectar() {
    setErr(null);
    setEstado("conectando");
    try {
      const s = await conectarLectorRFID((chunk) => {
        setBuffer((b) => b + chunk);
      });
      setSesion(s);
      setEstado("escuchando");
    } catch (e: any) {
      setErr(e.message ?? "No se pudo conectar.");
      setEstado("idle");
    }
  }

  async function desconectar() {
    await sesion?.stop();
    setSesion(null);
    setEstado("idle");
  }

  function procesar() {
    const csv = bufferAcsv(buffer);
    const rows = parseCSV(csv);
    if (rows.length === 0) {
      setErr("No hay datos válidos en el buffer del lector.");
      return;
    }
    onParsed(rows);
  }

  function limpiar() {
    setBuffer("");
  }

  if (!disponible) {
    return (
      <div className="card p-6 text-sm text-ink-muted">
        <div className="flex items-center gap-2 text-amber-300 mb-2">
          <AlertTriangle size={14} /> Web Bluetooth no disponible
        </div>
        Este navegador no soporta Web Bluetooth. Usá Chrome o Edge en escritorio
        (HTTPS) o Chrome en Android. Mientras tanto, cargá el archivo del lector
        como CSV desde la pestaña <strong>Archivo local</strong>.
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2 text-ink">
        <Bluetooth size={16} className="text-accent" />
        <h4 className="font-display text-lg">Lector RFID por Bluetooth</h4>
      </div>
      <p className="text-sm text-ink-muted">
        Conectá tu lector por BLE (perfil Nordic UART). A medida que pasa caravanas,
        las vas a ver acá. Cuando termines, presioná{" "}
        <strong>Procesar lecturas</strong> para importarlas.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {!sesion ? (
          <button onClick={conectar} className="btn-primary text-sm">
            {estado === "conectando" ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Plug size={14} />
            )}
            Conectar lector
          </button>
        ) : (
          <button onClick={desconectar} className="btn-ghost text-sm">
            Desconectar
          </button>
        )}
        {buffer && (
          <>
            <button onClick={procesar} className="btn-primary text-sm">
              Procesar lecturas
            </button>
            <button onClick={limpiar} className="btn-ghost text-sm">
              Limpiar
            </button>
          </>
        )}
        {sesion && (
          <span className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            {sesion.deviceName}
          </span>
        )}
      </div>

      <div>
        <div className="label mb-1.5">Buffer recibido</div>
        <pre className="max-h-60 overflow-auto rounded-xl border border-line bg-bg-soft/70 p-3 text-xs text-ink-muted whitespace-pre-wrap">
          {buffer ||
            "// Esperando lecturas… podés probar con un archivo si tu lector exporta directamente CSV."}
        </pre>
      </div>

      {err && (
        <div className="flex items-start gap-2 text-sm text-red-300">
          <AlertTriangle size={14} className="mt-0.5" /> {err}
        </div>
      )}
    </div>
  );
}

function Preview({
  rows,
  onCancel,
  onConfirm,
}: {
  rows: CsvRow[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cols = Array.from(
    rows.slice(0, 8).reduce((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  ).slice(0, 6);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-display text-lg text-ink">Vista previa</div>
          <div className="text-xs text-ink-muted">
            {rows.length} fila{rows.length !== 1 ? "s" : ""} detectadas. Mostrando
            primeras 8.
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button onClick={onConfirm} className="btn-primary text-sm">
            Importar
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="bg-bg-soft">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 text-left text-ink-dim uppercase tracking-wider">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r, i) => (
              <tr key={i} className="border-t border-line/60">
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2 text-ink">
                    {String(r[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
