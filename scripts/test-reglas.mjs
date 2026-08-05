// Chequeo de las reglas de negocio y de los dos caminos sensibles (permisos y saneo de
// exportaciones). Node 24 ejecuta los .ts directamente: estos módulos son puros y sólo
// tienen `import type`, que el type-stripping borra, así que no hace falta build ni runner.
//
//   npm test
//
// Si algo de esto falla, hay un bug de dominio: no lo "arregles" cambiando el assert.

import assert from "node:assert/strict";

import {
  aptoParaFaena,
  calcularADPV,
  calcularFinCarencia,
  caravanaUnicaActiva,
  coherenciaCategoriaSexo,
  colorCaravana,
  contarPendientes,
  diasEntre,
  diasRestantesCarencia,
  dosisEnRango,
  esActivo,
  estaEnCarencia,
  fechaNoFutura,
  identificacionTemprana,
  pesoFueraDeRango,
  puedeMoverse,
  rangoPesoCategoria,
  renspaUnico,
  tokenValido,
  transicionEstadoValida,
  validarFormatoCII,
} from "../src/lib/reglas.ts";
import { PERMISOS_OPERADOR_DEFAULT, puede } from "../src/lib/permisos.ts";
import { passwordValida } from "../src/lib/password.ts";
import { sanitizarFilas } from "../src/lib/csv-safe.ts";
import { CATEGORIAS } from "../src/lib/clasificacion.ts";

const animal = (extra = {}) => ({
  id: "a1",
  campoId: "c1",
  caravana: "0123456789",
  alertas: [],
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

// ---------- CII (bloqueo duro) ----------
assert.ok(validarFormatoCII("0123456789").ok);
for (const malo of ["", "123", "12345678901", "12345678a9", " 123456789", "1234 56789"])
  assert.equal(validarFormatoCII(malo).ok, false, `CII inválido aceptado: "${malo}"`);
assert.ok(validarFormatoCII("  0123456789  ").ok, "debe tolerar espacios alrededor");

// ---------- No-duplicidad de caravana activa ----------
const activos = [animal(), animal({ id: "a2", caravana: "9999999999", activo: false })];
assert.equal(caravanaUnicaActiva("0123456789", "c1", activos).ok, false);
assert.ok(caravanaUnicaActiva("0123456789", "c1", activos, "a1").ok, "excluir el propio id");
assert.ok(caravanaUnicaActiva("9999999999", "c1", activos).ok, "el dado de baja no bloquea");
assert.ok(caravanaUnicaActiva("0123456789", "otro", activos).ok, "otro campo no bloquea");

// ---------- Carencia ----------
assert.equal(calcularFinCarencia("2026-01-30", 5), "2026-02-04", "debe cruzar fin de mes");
assert.equal(calcularFinCarencia("2026-02-27", 2), "2026-03-01", "2026 no es bisiesto");
assert.equal(calcularFinCarencia("2026-01-01", 0), undefined);
assert.equal(calcularFinCarencia("no-es-fecha", 5), undefined);

const hoy = new Date("2026-08-04T10:00:00");
assert.ok(estaEnCarencia(animal({ fechaCarenciaHasta: "2026-08-10" }), hoy));
assert.ok(estaEnCarencia(animal({ fechaCarenciaHasta: "2026-08-04" }), hoy), "el último día cuenta");
assert.equal(estaEnCarencia(animal({ fechaCarenciaHasta: "2026-08-03" }), hoy), false);
assert.equal(estaEnCarencia(animal(), hoy), false);
assert.equal(diasRestantesCarencia(animal({ fechaCarenciaHasta: "2026-08-10" }), hoy), 6);
assert.equal(diasRestantesCarencia(animal({ fechaCarenciaHasta: "2026-07-01" }), hoy), 0);

// En carencia = no apto para faena, y no se mueve sin el Productor.
const enCarencia = animal({ fechaCarenciaHasta: "2026-08-10" });
assert.equal(aptoParaFaena(enCarencia, hoy).ok, false);
assert.equal(puedeMoverse(enCarencia, false, hoy).ok, false);
assert.ok(puedeMoverse(enCarencia, true, hoy).ok, "el Productor puede autorizar");
assert.equal(puedeMoverse(animal({ estado: "muerto" }), true, hoy).ok, false, "muerto no se mueve");
assert.equal(puedeMoverse(animal({ estado: "restringido" }), false, hoy).ok, false);

// ---------- ADPV ----------
assert.equal(calcularADPV(220, 190, 30), 1);
assert.equal(calcularADPV(200, 210, 20), -0.5, "debe admitir pérdida de peso");
assert.equal(calcularADPV(220, 190, 0), undefined, "sin días no hay ADPV (no divide por cero)");
assert.equal(diasEntre("2026-01-01", "2026-03-01"), 59);
assert.equal(diasEntre("2026-03-01", "2026-01-01"), 0, "no devuelve días negativos");

// ---------- Peso por categoría ----------
assert.deepEqual(rangoPesoCategoria("Vaquillona"), [160, 480]);
assert.deepEqual(rangoPesoCategoria("VAQUILLONA"), [160, 480], "case-insensitive");
assert.equal(rangoPesoCategoria("Macho entero joven (MEJ)"), null);
assert.ok(pesoFueraDeRango(0), "peso 0 es imposible");
assert.ok(pesoFueraDeRango(2000), "2000 kg es imposible");
assert.ok(pesoFueraDeRango(90, "Vaquillona"));
assert.equal(pesoFueraDeRango(300, "Vaquillona"), false);
assert.equal(pesoFueraDeRango(300, "categoría inventada"), false, "sin rango no alerta");

// Toda categoría del desplegable debe aceptar un peso plausible de su rango.
for (const cat of CATEGORIAS) {
  const r = rangoPesoCategoria(cat);
  if (r) assert.equal(pesoFueraDeRango((r[0] + r[1]) / 2, cat), false, `rango roto: ${cat}`);
}

// ---------- Coherencia categoría / sexo ----------
assert.equal(coherenciaCategoriaSexo("Vaca", "M").ok, false);
assert.equal(coherenciaCategoriaSexo("Toro", "H").ok, false);
assert.ok(coherenciaCategoriaSexo("Vaca", "H").ok);
assert.ok(coherenciaCategoriaSexo("Ternero/a", "H").ok, "la categoría mixta no debe bloquear");
assert.ok(coherenciaCategoriaSexo("Ternero/a", "M").ok);
assert.ok(coherenciaCategoriaSexo(undefined, "M").ok);

// ---------- Fechas ----------
assert.equal(fechaNoFutura("2026-08-05", hoy).ok, false);
assert.ok(fechaNoFutura("2026-08-04", hoy).ok, "hoy no es futuro");
assert.ok(fechaNoFutura(undefined, hoy).ok);
assert.equal(identificacionTemprana("2026-05-01", "2026-04-01").ok, false);
assert.ok(identificacionTemprana("2026-05-01", "2026-05-01").ok);

// ---------- Estados ----------
assert.ok(transicionEstadoValida("activo", "en_carencia"));
assert.ok(transicionEstadoValida("muerto", "muerto"), "misma a misma es válida");
assert.equal(transicionEstadoValida("muerto", "activo"), false, "muerto es terminal");
assert.equal(transicionEstadoValida("egresado", "activo"), false, "egresado es terminal");

// ---------- Varios de dominio ----------
assert.equal(colorCaravana({ zonaVacunacionAftosa: true }), "blanco");
assert.equal(colorCaravana({ zonaVacunacionAftosa: false }), "verde");
assert.equal(esActivo({}), true, "undefined = activo");
assert.equal(esActivo({ activo: false }), false);
assert.equal(dosisEnRango(0.5, { dosisMin: 1, dosisMax: 5 }).ok, false);
assert.equal(dosisEnRango(9, { dosisMin: 1, dosisMax: 5 }).ok, false);
assert.ok(dosisEnRango(3, { dosisMin: 1, dosisMax: 5 }).ok);
assert.ok(dosisEnRango(undefined, { dosisMin: 1 }).ok, "sin dosis no valida");
assert.equal(tokenValido("").ok, false);
assert.equal(tokenValido("corto").ok, false);
assert.ok(tokenValido("token-largo-ok").ok);
assert.equal(renspaUnico("01.001.0.00001/00", [{ id: "c2", renspa: "01.001.0.00001/00" }]).ok, false);
assert.ok(renspaUnico("01.001.0.00001/00", [{ id: "c1", renspa: "01.001.0.00001/00" }], "c1").ok);
assert.equal(
  contarPendientes([
    { estadoSincronizacion: "local" },
    { estadoSincronizacion: "pendiente" },
    { estadoSincronizacion: "sincronizado" },
    { estadoSincronizacion: "local", activo: false },
  ]),
  2
);

// ---------- Permisos: el Operador delegado NO escribe plata ni regulatorio ----------
for (const denegada of ["costos", "reportes", "senasa", "documentacion", "catalogos", "admin"])
  assert.equal(puede("operador", denegada), false, `operador no debería poder ${denegada}`);
assert.equal(puede("operador", "movimiento", PERMISOS_OPERADOR_DEFAULT), false, "por defecto no mueve");
assert.ok(puede("operador", "sanidad", PERMISOS_OPERADOR_DEFAULT));
// El alta sigue a `capturar`: las pantallas de animales/importar/lotes se apoyan en esto.
assert.ok(puede("operador", "alta", PERMISOS_OPERADOR_DEFAULT), "operador con captura da de alta");
assert.equal(puede("operador", "alta", { ...PERMISOS_OPERADOR_DEFAULT, capturar: false }), false);
assert.ok(puede("operador", "movimiento", { ...PERMISOS_OPERADOR_DEFAULT, movimiento: true }));
assert.ok(puede("operador", "ver"));
assert.ok(puede("admin", "admin"), "el Productor puede todo");
assert.ok(puede("vista", "ver"));
for (const accion of ["alta", "sanidad", "pesaje", "costos", "admin"])
  assert.equal(puede("vista", accion), false, `vista no debería poder ${accion}`);
assert.equal(puede("usuario", "admin"), false);
assert.equal(puede("usuario", "catalogos"), false);
assert.ok(puede("usuario", "reportes"));
assert.equal(puede(null, "ver"), false, "sin rol no hay acceso");

// ---------- Política de contraseñas ----------
assert.ok(passwordValida("Abcdef1!"));
for (const mala of ["Abcdef1", "abcdef1!", "ABCDEF1!", "Abcdefg!", "Abc1!"])
  assert.equal(passwordValida(mala), false, `contraseña débil aceptada: "${mala}"`);

// ---------- Saneo anti fórmula en exportaciones (CWE-1236) ----------
const saneadas = sanitizarFilas([
  { observaciones: "=1+1", nombre: "+cmd", raza: "-2", categoria: "@SUM(A1)", peso: 320 },
  { observaciones: "sin fórmula", nombre: "", raza: "Angus", categoria: "Vaca", peso: 0 },
]);
assert.equal(saneadas[0].observaciones, "'=1+1");
assert.equal(saneadas[0].nombre, "'+cmd");
assert.equal(saneadas[0].raza, "'-2");
assert.equal(saneadas[0].categoria, "'@SUM(A1)");
assert.equal(saneadas[0].peso, 320, "los números no se tocan");
assert.equal(saneadas[1].observaciones, "sin fórmula", "el texto normal no se toca");

console.log("OK — todas las reglas, permisos y saneos pasan.");
