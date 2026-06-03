"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  ClipboardList,
  Syringe,
  Truck,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import {
  catalogosDe,
  colorOficial,
  crearCatalogo,
  crearProducto,
  crearProveedor,
  desactivarCatalogo,
  desactivarProducto,
  desactivarProveedor,
  guardarEstablecimiento,
  productosDe,
  proveedoresDe,
} from "@/lib/catalogos";
import type { TipoEvento } from "@/lib/types";

type Seccion = "establecimiento" | "eventos" | "productos" | "proveedores";

const SECCIONES: { key: Seccion; label: string; Icon: any }[] = [
  { key: "establecimiento", label: "Establecimiento", Icon: Building2 },
  { key: "eventos", label: "Catálogo de eventos", Icon: ClipboardList },
  { key: "productos", label: "Productos sanitarios", Icon: Syringe },
  { key: "proveedores", label: "Proveedores", Icon: Truck },
];

export default function CatalogosPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  const [sec, setSec] = useState<Seccion>("establecimiento");

  if (!puede(rol, "catalogos")) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        Sólo el Productor puede administrar los catálogos del establecimiento (RN11).
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted max-w-2xl">
        Datos maestros del establecimiento. Estandarizan la carga (RN12, sin texto libre) y
        son precondición de las altas, eventos sanitarios y movimientos (CU-10).
      </p>

      <div className="flex flex-wrap gap-2">
        {SECCIONES.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setSec(key)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              sec === key
                ? "border-accent/50 bg-accent/10 text-ink"
                : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {sec === "establecimiento" && <Establecimiento campoId={id} onSaved={refresh} />}
      {sec === "eventos" && <Eventos campoId={id} onChange={refresh} />}
      {sec === "productos" && <Productos campoId={id} onChange={refresh} />}
      {sec === "proveedores" && <Proveedores campoId={id} onChange={refresh} />}
    </div>
  );
}

function Establecimiento({ campoId, onSaved }: { campoId: string; onSaved: () => void }) {
  const { db } = useApp();
  const campo = db.campos.find((c) => c.id === campoId)!;
  const [form, setForm] = useState({
    renspa: campo.renspa ?? "",
    cuig: campo.cuig ?? "",
    partido: campo.partido ?? "",
    provincia: campo.provincia ?? "",
    superficieHa: campo.superficieHa != null ? String(campo.superficieHa) : "",
    zonaVacunacionAftosa: campo.zonaVacunacionAftosa ?? false,
    tokenSenasa: campo.tokenSenasa ?? "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const color = colorOficial(form.zonaVacunacionAftosa);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const r = guardarEstablecimiento(campoId, {
      renspa: form.renspa,
      cuig: form.cuig,
      partido: form.partido,
      provincia: form.provincia,
      superficieHa: form.superficieHa ? Number(form.superficieHa) : undefined,
      zonaVacunacionAftosa: form.zonaVacunacionAftosa,
      tokenSenasa: form.tokenSenasa,
    });
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    setMsg({ ok: true, text: "Datos del establecimiento guardados." });
    onSaved();
  }

  return (
    <form onSubmit={guardar} className="card p-5 space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <Campo label="RENSPA" hint="Identificación ante SENASA (única, RN16)">
          <input
            className="input"
            value={form.renspa}
            onChange={(e) => setForm({ ...form, renspa: e.target.value })}
            placeholder="00.000.0.00000/00"
          />
        </Campo>
        <Campo label="CUIG" hint="Código Único de Identificación Ganadera">
          <input
            className="input"
            value={form.cuig}
            onChange={(e) => setForm({ ...form, cuig: e.target.value })}
          />
        </Campo>
        <Campo label="Partido / Departamento">
          <input
            className="input"
            value={form.partido}
            onChange={(e) => setForm({ ...form, partido: e.target.value })}
          />
        </Campo>
        <Campo label="Provincia">
          <input
            className="input"
            value={form.provincia}
            onChange={(e) => setForm({ ...form, provincia: e.target.value })}
          />
        </Campo>
        <Campo label="Superficie (ha)">
          <input
            className="input"
            type="number"
            value={form.superficieHa}
            onChange={(e) => setForm({ ...form, superficieHa: e.target.value })}
          />
        </Campo>
        <Campo label="Token SENASA" hint="Para sincronizar (RN15)">
          <input
            className="input"
            value={form.tokenSenasa}
            onChange={(e) => setForm({ ...form, tokenSenasa: e.target.value })}
            placeholder="token de prueba"
          />
        </Campo>
      </div>

      <div className="rounded-xl border border-line bg-bg-soft/40 p-3 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            className="accent-accent"
            checked={form.zonaVacunacionAftosa}
            onChange={(e) =>
              setForm({ ...form, zonaVacunacionAftosa: e.target.checked })
            }
          />
          Zona con vacunación antiaftosa
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Color oficial de caravana (RN04):</span>
          <span
            className={`chip uppercase ${
              color === "blanco"
                ? "bg-white/90 text-black border-white"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
            }`}
          >
            {color}
          </span>
        </div>
      </div>

      {msg && (
        <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>
          {msg.text}
        </div>
      )}
      <div className="flex justify-end">
        <button className="btn-primary text-sm">
          <Save size={14} /> Guardar establecimiento
        </button>
      </div>
    </form>
  );
}

function Eventos({ campoId, onChange }: { campoId: string; onChange: () => void }) {
  const { db, refresh } = useApp();
  const lista = catalogosDe(campoId, db.catalogos);
  const [form, setForm] = useState<{
    tipoEvento: TipoEvento;
    codigo: string;
    descripcion: string;
    requiereProducto: boolean;
  }>({ tipoEvento: "sanitario", codigo: "", descripcion: "", requiereProducto: false });

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.codigo.trim() || !form.descripcion.trim()) return;
    crearCatalogo(campoId, form);
    setForm({ tipoEvento: "sanitario", codigo: "", descripcion: "", requiereProducto: false });
    refresh();
    onChange();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="card p-4 grid sm:grid-cols-[140px_1fr_1.4fr_auto] gap-2 items-end">
        <Campo label="Tipo">
          <select
            className="input"
            value={form.tipoEvento}
            onChange={(e) => setForm({ ...form, tipoEvento: e.target.value as TipoEvento })}
          >
            <option value="sanitario">Sanitario</option>
            <option value="pesaje">Pesaje</option>
            <option value="movimiento">Movimiento</option>
          </select>
        </Campo>
        <Campo label="Código">
          <input
            className="input"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            placeholder="VAC-AFT"
          />
        </Campo>
        <Campo label="Descripción">
          <input
            className="input"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Vacunación antiaftosa"
          />
        </Campo>
        <button className="btn-primary text-sm h-[42px]">
          <Plus size={14} /> Agregar
        </button>
        {form.tipoEvento === "sanitario" && (
          <label className="sm:col-span-4 flex items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              className="accent-accent"
              checked={form.requiereProducto}
              onChange={(e) => setForm({ ...form, requiereProducto: e.target.checked })}
            />
            Requiere producto sanitario (trae período de carencia)
          </label>
        )}
      </form>

      <ListaSimple
        vacio="No hay tipos de evento en el catálogo todavía."
        items={lista.map((c) => ({
          id: c.id,
          titulo: `${c.codigo} · ${c.descripcion}`,
          sub: `${c.tipoEvento}${c.requiereProducto ? " · requiere producto" : ""}`,
          onDelete: () => {
            desactivarCatalogo(c.id);
            refresh();
            onChange();
          },
        }))}
      />
    </div>
  );
}

function Productos({ campoId, onChange }: { campoId: string; onChange: () => void }) {
  const { db, refresh } = useApp();
  const lista = productosDe(campoId, db.productos);
  const proveedores = proveedoresDe(campoId, db.proveedores);
  const [form, setForm] = useState({
    nombreComercial: "",
    principioActivo: "",
    diasCarencia: "",
    unidadMedida: "ml",
    dosisMin: "",
    dosisMax: "",
    proveedorId: "",
  });

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombreComercial.trim()) return;
    crearProducto(campoId, {
      nombreComercial: form.nombreComercial,
      principioActivo: form.principioActivo.trim() || undefined,
      diasCarencia: form.diasCarencia ? Number(form.diasCarencia) : 0,
      unidadMedida: form.unidadMedida || undefined,
      dosisMin: form.dosisMin ? Number(form.dosisMin) : undefined,
      dosisMax: form.dosisMax ? Number(form.dosisMax) : undefined,
      proveedorId: form.proveedorId || undefined,
    });
    setForm({
      nombreComercial: "",
      principioActivo: "",
      diasCarencia: "",
      unidadMedida: "ml",
      dosisMin: "",
      dosisMax: "",
      proveedorId: "",
    });
    refresh();
    onChange();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="card p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <Campo label="Nombre comercial">
            <input
              className="input"
              value={form.nombreComercial}
              onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
            />
          </Campo>
          <Campo label="Principio activo">
            <input
              className="input"
              value={form.principioActivo}
              onChange={(e) => setForm({ ...form, principioActivo: e.target.value })}
            />
          </Campo>
          <Campo label="Días de carencia (RN03)">
            <input
              className="input"
              type="number"
              value={form.diasCarencia}
              onChange={(e) => setForm({ ...form, diasCarencia: e.target.value })}
            />
          </Campo>
          <Campo label="Unidad">
            <input
              className="input"
              value={form.unidadMedida}
              onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
            />
          </Campo>
          <Campo label="Dosis mín. (RN20)">
            <input
              className="input"
              type="number"
              value={form.dosisMin}
              onChange={(e) => setForm({ ...form, dosisMin: e.target.value })}
            />
          </Campo>
          <Campo label="Dosis máx. (RN20)">
            <input
              className="input"
              type="number"
              value={form.dosisMax}
              onChange={(e) => setForm({ ...form, dosisMax: e.target.value })}
            />
          </Campo>
        </div>
        <div className="flex items-end justify-between gap-2">
          <Campo label="Proveedor">
            <select
              className="input sm:max-w-[240px]"
              value={form.proveedorId}
              onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
            >
              <option value="">—</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razonSocial}
                </option>
              ))}
            </select>
          </Campo>
          <button className="btn-primary text-sm">
            <Plus size={14} /> Agregar producto
          </button>
        </div>
      </form>

      <ListaSimple
        vacio="No hay productos sanitarios cargados."
        items={lista.map((p) => ({
          id: p.id,
          titulo: p.nombreComercial,
          sub: `${p.diasCarencia} días de carencia${
            p.principioActivo ? ` · ${p.principioActivo}` : ""
          }`,
          onDelete: () => {
            desactivarProducto(p.id);
            refresh();
            onChange();
          },
        }))}
      />
    </div>
  );
}

function Proveedores({ campoId, onChange }: { campoId: string; onChange: () => void }) {
  const { db, refresh } = useApp();
  const lista = proveedoresDe(campoId, db.proveedores);
  const [form, setForm] = useState({
    razonSocial: "",
    cuit: "",
    tipoProveedor: "hacienda" as "hacienda" | "sanitario" | "dispositivos" | "otro",
    zonaOrigen: "",
  });

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.razonSocial.trim()) return;
    crearProveedor(campoId, {
      razonSocial: form.razonSocial,
      cuit: form.cuit.trim() || undefined,
      tipoProveedor: form.tipoProveedor,
      zonaOrigen: form.zonaOrigen.trim() || undefined,
    });
    setForm({ razonSocial: "", cuit: "", tipoProveedor: "hacienda", zonaOrigen: "" });
    refresh();
    onChange();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="card p-4 grid sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-end">
        <Campo label="Razón social">
          <input
            className="input"
            value={form.razonSocial}
            onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
          />
        </Campo>
        <Campo label="CUIT">
          <input
            className="input"
            value={form.cuit}
            onChange={(e) => setForm({ ...form, cuit: e.target.value })}
          />
        </Campo>
        <Campo label="Tipo">
          <select
            className="input"
            value={form.tipoProveedor}
            onChange={(e) =>
              setForm({ ...form, tipoProveedor: e.target.value as typeof form.tipoProveedor })
            }
          >
            <option value="hacienda">Hacienda</option>
            <option value="sanitario">Sanitario</option>
            <option value="dispositivos">Dispositivos</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>
        <Campo label="Zona de origen">
          <input
            className="input"
            value={form.zonaOrigen}
            onChange={(e) => setForm({ ...form, zonaOrigen: e.target.value })}
          />
        </Campo>
        <button className="btn-primary text-sm h-[42px]">
          <Plus size={14} /> Agregar
        </button>
      </form>

      <ListaSimple
        vacio="No hay proveedores cargados."
        items={lista.map((p) => ({
          id: p.id,
          titulo: p.razonSocial,
          sub: `${p.tipoProveedor ?? ""}${p.zonaOrigen ? ` · ${p.zonaOrigen}` : ""}`,
          onDelete: () => {
            desactivarProveedor(p.id);
            refresh();
            onChange();
          },
        }))}
      />
    </div>
  );
}

function ListaSimple({
  items,
  vacio,
}: {
  items: { id: string; titulo: string; sub?: string; onDelete: () => void }[];
  vacio: string;
}) {
  if (items.length === 0)
    return <div className="card p-8 text-center text-ink-muted text-sm">{vacio}</div>;
  return (
    <div className="card overflow-hidden">
      <ul>
        {items.map((it, idx) => (
          <motion.li
            key={it.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.02 }}
            className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line/60 last:border-0"
          >
            <div>
              <div className="text-ink text-sm">{it.titulo}</div>
              {it.sub && <div className="text-ink-dim text-xs">{it.sub}</div>}
            </div>
            <button
              onClick={it.onDelete}
              className="text-ink-dim hover:text-red-300"
              title="Desactivar (baja lógica, RN07)"
            >
              <Trash2 size={15} />
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label block mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-ink-dim mt-1">{hint}</div>}
    </div>
  );
}
