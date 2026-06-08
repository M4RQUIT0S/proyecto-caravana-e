"use client";

import { useEffect, useRef, useState } from "react";
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
  Layers,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import {
  importarAnimales,
  parseCSV,
  parseFile,
  nombreBaseSinExtension,
  sugerirLote,
  crearLoteParaImport,
  type CsvRow,
  type SugerenciaLote,
} from "@/lib/csv";
import {
  bluetoothDisponible,
  conectarLectorRFID,
  bufferAcsv,
  type BluetoothSesion,
} from "@/lib/bluetooth";

type Tab = "archivo" | "drive" | "bluetooth";

interface PreviewState {
  rows: CsvRow[];
  baseNombre: string;
}

export default function ImportarPage() {
  const { id } = useParams<{ id: string }>();
  const { user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  const puedeEditar = rol === "admin" || rol === "usuario";
  const [tab, setTab] = useState<Tab>("archivo");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [resultado, setResultado] = useState<{
    agregados: number;
    actualizados: number;
    omitidos: number;
    eventos: number;
    loteNombre: string;
  } | null>(null);

  if (!puedeEditar) {
    return (
      <div className="card p-8 text-ink-muted">
        Tu rol es <strong className="text-ink">sólo vista</strong>: no podés importar
        animales. Pedile a un admin que cambie tu rol.
      </div>
    );
  }

  function aplicar(rows: CsvRow[], datosLote: SugerenciaLote) {
    const lote = crearLoteParaImport(id, datosLote);
    const r = importarAnimales(id, rows, { loteId: lote.id, usuarioId: user!.id });
    setResultado({ ...r, loteNombre: lote.nombre });
    setPreview(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-display text-xl text-ink">Importar animales</h3>
        <p className="text-sm text-ink-muted mt-1">
          Cada archivo importado <strong className="text-ink">se carga como un lote nuevo</strong>.
          El nombre del lote se sugiere a partir del archivo, pero podés editarlo
          antes de confirmar.
        </p>
        <p className="text-sm text-ink-muted mt-2">
          Columnas reconocidas:{" "}
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
        <p className="text-sm text-ink-muted mt-2">
          Si el archivo trae columnas de vacunas/tratamientos (grupos tipo{" "}
          <code className="font-mono">Triple</code>,{" "}
          <code className="font-mono">Triple Dosis</code>,{" "}
          <code className="font-mono">Triple Treated</code>…), se registran como{" "}
          <strong className="text-ink">eventos sanitarios</strong> en cada animal y
          aparecen en <strong className="text-ink">Sanidad</strong> y en su historial.
        </p>
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
          rows={preview.rows}
          baseNombre={preview.baseNombre}
          onCancel={() => setPreview(null)}
          onConfirm={(datos) => aplicar(preview.rows, datos)}
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
                Lote creado: <strong className="text-ink">{resultado.loteNombre}</strong>
                {" — "}
                {resultado.agregados} agregados · {resultado.actualizados}{" "}
                actualizados · {resultado.omitidos} omitidos
                {resultado.eventos > 0 && (
                  <>
                    {" · "}
                    <strong className="text-ink">{resultado.eventos}</strong> eventos
                    sanitarios
                  </>
                )}
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

function ArchivoLocal({ onParsed }: { onParsed: (state: PreviewState) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function manejar(file: File) {
    setErr(null);
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        setErr("No se detectaron filas en el archivo.");
        return;
      }
      onParsed({ rows, baseNombre: nombreBaseSinExtension(file.name) });
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
      <div className="font-display text-xl text-ink">Arrastrá tu .csv o .xlsx acá</div>
      <p className="text-sm text-ink-muted mt-1">
        O hacé click para elegirlo desde tu equipo. El nombre del archivo se usará
        como nombre del lote.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
      {err && <div className="text-sm text-error mt-4">{err}</div>}
    </div>
  );
}

function DriveImport({ onParsed }: { onParsed: (state: PreviewState) => void }) {
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
      const baseNombre =
        extraerNombreContentDisposition(res.headers.get("content-disposition")) ||
        `Lote Drive ${new Date().toLocaleDateString("es-AR")}`;
      onParsed({ rows, baseNombre });
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
        <div className="mt-4 flex items-start gap-2 text-sm text-error">
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

function extraerNombreContentDisposition(cd: string | null): string {
  if (!cd) return "";
  const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!m) return "";
  return nombreBaseSinExtension(decodeURIComponent(m[1]));
}

function BluetoothImport({ onParsed }: { onParsed: (state: PreviewState) => void }) {
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
    const ts = new Date();
    const baseNombre = `Lectura BT ${ts.toLocaleDateString("es-AR")} ${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}`;
    onParsed({ rows, baseNombre });
  }

  function limpiar() {
    setBuffer("");
  }

  if (!disponible) {
    return (
      <div className="card p-6 text-sm text-ink-muted">
        <div className="flex items-center gap-2 text-warning mb-2">
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
        <div className="flex items-start gap-2 text-sm text-error">
          <AlertTriangle size={14} className="mt-0.5" /> {err}
        </div>
      )}
    </div>
  );
}

function Preview({
  rows,
  baseNombre,
  onCancel,
  onConfirm,
}: {
  rows: CsvRow[];
  baseNombre: string;
  onCancel: () => void;
  onConfirm: (datos: SugerenciaLote) => void;
}) {
  const sugerencia = sugerirLote(rows, baseNombre);
  const [nombre, setNombre] = useState(sugerencia.nombre);
  const [categoria, setCategoria] = useState(sugerencia.categoria);
  const [raza, setRaza] = useState(sugerencia.raza);

  useEffect(() => {
    setNombre(sugerencia.nombre);
    setCategoria(sugerencia.categoria);
    setRaza(sugerencia.raza);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNombre, rows]);

  const cols = Array.from(
    rows.slice(0, 8).reduce((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  ).slice(0, 6);

  function confirmar() {
    if (!nombre.trim()) return;
    onConfirm({ nombre: nombre.trim(), categoria: categoria.trim(), raza: raza.trim() });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 space-y-5"
    >
      <div className="flex items-center justify-between">
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
          <button
            onClick={confirmar}
            disabled={!nombre.trim()}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Crear lote e importar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={15} className="text-accent" />
          <div className="font-display text-sm text-ink">Lote nuevo a crear</div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label block mb-1.5">
              Nombre del lote <span className="text-accent">*</span>
            </label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej: Vacas Angus 2026"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Categoría</label>
            <input
              className="input"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Vacas, Vaquillonas…"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Raza</label>
            <input
              className="input"
              value={raza}
              onChange={(e) => setRaza(e.target.value)}
              placeholder="Angus, Hereford…"
            />
          </div>
        </div>
        <p className="text-[11px] text-ink-dim mt-3">
          Si ya existe un lote con este nombre, se le sumará un sufijo automático
          ({"“"}({"2"}){"”"}, {"“"}({"3"}){"”"}…) para mantenerlos separados.
        </p>
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
