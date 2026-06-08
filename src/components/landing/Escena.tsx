"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Float, Html } from "@react-three/drei";
import * as THREE from "three";

// Escena isométrica low-poly del flujo de trazabilidad ganadera (AgroTrace).
// Tres zonas alineadas en X: campo (RFID) → manga (lectura) → transporte (DT-e/SENASA).
// La cámara viaja con easing entre ellas (waypoints) manteniendo el ángulo isométrico,
// y cada animal lleva un punto de datos (EID, peso, ADPV, estado sanitario).

// Paleta AgroTrace (misma de tailwind.config.ts)
const C = {
  crema: "#F4F4EF",
  papel: "#FAFAF5",
  linea: "#DEE1D8",
  lineaFuerte: "#C8C8C0",
  verde: "#164113",
  verdePrimario: "#285820",
  verdeMedio: "#486848",
  sage: "#8C9A82",
  naranja: "#FC8B00",
  naranjaSuave: "#FFC078",
  ambar: "#B45309",
};

// Centros de cada zona en X (la cámara recorre el eje X).
export const ZONA_X = [-12, 0, 12];

// Dirección isométrica clásica (35.26°), estilo juego de construcción.
const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
const DIST = 20;
const Y_OBJETIVO = 1.0;

function posCamara(x: number, out: THREE.Vector3) {
  return out.copy(ISO_DIR).multiplyScalar(DIST).add(new THREE.Vector3(x, Y_OBJETIVO, 0));
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Controlador de cámara: recorrido con aceleración/desaceleración (no un lerp plano) y un
// leve cabeceo para darle vida a la toma.
function CamaraTour({ activo }: { activo: number }) {
  const { camera } = useThree();
  const desde = useRef(ZONA_X[0]);
  const hasta = useRef(ZONA_X[0]);
  const actualX = useRef(ZONA_X[0]);
  const t = useRef(1);
  const pos = useRef(new THREE.Vector3());
  const mira = useRef(new THREE.Vector3(ZONA_X[0], Y_OBJETIVO, 0));

  useEffect(() => {
    desde.current = actualX.current;
    hasta.current = ZONA_X[activo] ?? 0;
    t.current = 0;
  }, [activo]);

  useFrame(({ clock }, dt) => {
    t.current = Math.min(1, t.current + dt / 1.35); // ~1.35 s de viaje
    const x = THREE.MathUtils.lerp(desde.current, hasta.current, easeInOutCubic(t.current));
    actualX.current = x;
    posCamara(x, pos.current);
    const respira = Math.sin(clock.elapsedTime * 0.5) * 0.07;
    camera.position.set(pos.current.x, pos.current.y + respira, pos.current.z);
    mira.current.set(x, Y_OBJETIVO, 0);
    camera.lookAt(mira.current);
  });
  return null;
}

// ---------- Primitivas ----------

function Caja({
  args,
  position,
  color,
  borde,
  rotation,
}: {
  args: [number, number, number];
  position?: [number, number, number];
  color: string;
  borde?: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} flatShading roughness={0.85} metalness={0} />
      {borde && <Edges color={borde} threshold={20} />}
    </mesh>
  );
}

// ---------- Punto de datos (infografía por animal) ----------

type EstadoSanidad = { texto: string; alerta?: boolean };

function PuntoDato({
  position,
  altura = 1.7,
  children,
  color = C.verdePrimario,
}: {
  position: [number, number, number];
  altura?: number;
  children: ReactNode;
  color?: string;
}) {
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (dot.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.22;
      dot.current.scale.setScalar(s);
    }
  });
  return (
    <group position={position}>
      {/* tallo */}
      <mesh position={[0, altura / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, altura, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      {/* punto pulsante sobre el animal */}
      <mesh ref={dot}>
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      <Html
        position={[0, altura + 0.05, 0]}
        center
        distanceFactor={8.5}
        zIndexRange={[6, 0]}
        style={{ pointerEvents: "none" }}
      >
        {children}
      </Html>
    </group>
  );
}

function FichaAnimal({
  eid,
  lineas,
  estado,
}: {
  eid: string;
  lineas: string[];
  estado: EstadoSanidad;
}) {
  const tono = estado.alerta ? C.ambar : C.verdePrimario;
  return (
    <div
      className="pointer-events-none select-none rounded-lg border border-line bg-bg-card/95 px-2.5 py-1.5 shadow-soft"
      style={{ width: "max-content" }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: tono }}
        />
        <span className="font-mono text-[11px] font-semibold" style={{ color: C.verde }}>
          {eid}
        </span>
      </div>
      {lineas.map((l, i) => (
        <div key={i} className="text-[10px] leading-tight" style={{ color: C.verdeMedio }}>
          {l}
        </div>
      ))}
      <div
        className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[9px] font-medium"
        style={{
          background: estado.alerta ? "rgba(180,83,9,0.12)" : "rgba(40,88,32,0.12)",
          color: tono,
        }}
      >
        <span className="inline-block h-1 w-1 rounded-full" style={{ background: tono }} />
        {estado.texto}
      </div>
    </div>
  );
}

// ---------- Vaca con animación orgánica ----------

function Vaca({
  position,
  rotation = 0,
  seed = 0,
}: {
  position: [number, number, number];
  rotation?: number;
  seed?: number;
}) {
  const cuerpo = useRef<THREE.Group>(null);
  const cabeza = useRef<THREE.Group>(null);
  const cola = useRef<THREE.Group>(null);
  const orejaIzq = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 12.3;
    // respiración + cambio de peso del cuerpo
    if (cuerpo.current) {
      cuerpo.current.scale.set(1, 1 + Math.sin(t * 1.5) * 0.02, 1);
      cuerpo.current.position.y = 0.95 + Math.sin(t * 0.8) * 0.018;
      cuerpo.current.rotation.z = Math.sin(t * 0.45) * 0.025;
    }
    // cabeza: cabeceo lento y pastoreo ocasional (baja a comer)
    if (cabeza.current) {
      const ciclo = (Math.sin(t * 0.27) + 1) / 2; // 0..1 lento
      const pastar = Math.pow(ciclo, 4); // mayormente arriba, a veces abajo
      cabeza.current.rotation.z = -pastar * 1.05;
      cabeza.current.position.y = 1.15 - pastar * 0.55;
      cabeza.current.rotation.y = Math.sin(t * 0.6) * 0.14;
    }
    // cola: coletazos (rápido y con pausas)
    if (cola.current) {
      cola.current.rotation.z = Math.sin(t * 3.2) * 0.45 + Math.sin(t * 7.0) * 0.1;
    }
    // oreja: tic ocasional
    if (orejaIzq.current) orejaIzq.current.rotation.x = Math.sin(t * 5.5) * 0.25;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={0.62}>
      {/* cuerpo */}
      <group ref={cuerpo} position={[0, 0.95, 0]}>
        <mesh>
          <boxGeometry args={[1.5, 0.85, 0.85]} />
          <meshStandardMaterial color={C.papel} flatShading roughness={0.85} />
          <Edges color={C.verde} threshold={20} />
        </mesh>
        <Caja args={[0.5, 0.4, 0.45]} position={[0.35, 0.2, 0.44]} color={C.verde} />
        <Caja args={[0.4, 0.5, 0.45]} position={[-0.4, -0.05, -0.44]} color={C.verde} />
      </group>

      {/* cabeza (pivote en el cuello) */}
      <group ref={cabeza} position={[0.78, 1.15, 0]}>
        <mesh position={[0.25, 0, 0]}>
          <boxGeometry args={[0.55, 0.55, 0.6]} />
          <meshStandardMaterial color={C.papel} flatShading roughness={0.85} />
          <Edges color={C.verde} threshold={20} />
        </mesh>
        {/* hocico */}
        <Caja args={[0.2, 0.3, 0.42]} position={[0.55, -0.1, 0]} color={C.sage} />
        {/* orejas */}
        <group ref={orejaIzq} position={[0.1, 0.3, 0.28]}>
          <Caja args={[0.12, 0.2, 0.06]} position={[0, 0.05, 0]} color={C.verdeMedio} />
        </group>
        <Caja args={[0.12, 0.2, 0.06]} position={[0.1, 0.35, -0.28]} color={C.verdeMedio} />
        {/* caravana (ear tag) naranja */}
        <Caja args={[0.16, 0.22, 0.05]} position={[0.08, 0.18, 0.34]} color={C.naranja} />
      </group>

      {/* patas (estáticas, el peso lo sugiere el cuerpo) */}
      {(
        [
          [0.5, 0.42],
          [0.5, -0.42],
          [-0.5, 0.42],
          [-0.5, -0.42],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <Caja key={i} args={[0.18, 0.55, 0.18]} position={[x, 0.3, z]} color={C.verdeMedio} />
      ))}

      {/* cola (pivote arriba, cuelga y se mueve) */}
      <group ref={cola} position={[-0.78, 1.25, 0]}>
        <Caja args={[0.08, 0.7, 0.08]} position={[0, -0.35, 0]} color={C.verdeMedio} />
        <Caja args={[0.13, 0.18, 0.13]} position={[0, -0.72, 0]} color={C.verde} />
      </group>
    </group>
  );
}

// Caravana RFID flotante (etiqueta naranja con giro orgánico) sobre el campo.
function CaravanaFlotante({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (ref.current) {
      const t = clock.elapsedTime;
      ref.current.rotation.y += dt * (0.5 + Math.sin(t * 0.8) * 0.35);
      ref.current.rotation.z = Math.sin(t * 1.3) * 0.12;
    }
  });
  return (
    <Float speed={2.4} floatIntensity={0.8} floatingRange={[0, 0.3]}>
      <group ref={ref} position={position}>
        <mesh>
          <boxGeometry args={[0.5, 0.7, 0.08]} />
          <meshStandardMaterial color={C.naranja} flatShading roughness={0.55} />
          <Edges color={C.verde} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <torusGeometry args={[0.1, 0.04, 8, 16]} />
          <meshStandardMaterial color={C.naranjaSuave} flatShading />
        </mesh>
      </group>
    </Float>
  );
}

// Pulso de lectura RFID (anillo que se expande y desvanece).
function PulsoRFID({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 1.7) / 1.7;
    if (ref.current) {
      const s = 0.3 + t * 1.7;
      ref.current.scale.set(s, s, 1);
    }
    if (mat.current) mat.current.opacity = (1 - t) * 0.7;
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.5, 0.045, 8, 36]} />
      <meshBasicMaterial ref={mat} color={C.naranja} transparent />
    </mesh>
  );
}

// Hierba que se mece (vida ambiental).
function Pasto({ position, seed = 0 }: { position: [number, number, number]; seed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.6 + seed * 6) * 0.18;
  });
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.09, 0.5, 4]} />
        <meshStandardMaterial color={C.verdeMedio} flatShading />
      </mesh>
    </group>
  );
}

function Arbol({ position }: { position: [number, number, number] }) {
  const copa = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (copa.current) copa.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.05;
  });
  return (
    <group position={position}>
      <Caja args={[0.25, 0.8, 0.25]} position={[0, 0.4, 0]} color={C.verdeMedio} />
      <group ref={copa} position={[0, 1.25, 0]}>
        <mesh>
          <coneGeometry args={[0.7, 1.3, 6]} />
          <meshStandardMaterial color={C.verdePrimario} flatShading roughness={0.9} />
          <Edges color={C.verde} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Zonas ----------

const CAMPO_ANIMALES: {
  pos: [number, number, number];
  rot: number;
  seed: number;
  eid: string;
  lineas: string[];
  estado: EstadoSanidad;
}[] = [
  {
    pos: [-2, 0.25, -1],
    rot: 0.5,
    seed: 0.1,
    eid: "AR 0445",
    lineas: ["312 kg · ADPV 0,82", "Última: pesaje"],
    estado: { texto: "Sanidad al día" },
  },
  {
    pos: [1.6, 0.25, 1.6],
    rot: -0.8,
    seed: 0.55,
    eid: "AR 0457",
    lineas: ["298 kg · antiparasitario", "Doramectina"],
    estado: { texto: "Carencia 9 días", alerta: true },
  },
  {
    pos: [0.2, 0.25, -3.2],
    rot: 2.4,
    seed: 0.83,
    eid: "AR 0463",
    lineas: ["341 kg · ADPV 0,91", "Vacuna aftosa ✓"],
    estado: { texto: "Apto para faena" },
  },
];

function Campo() {
  return (
    <group position={[ZONA_X[0], 0, 0]}>
      <Caja args={[9, 0.25, 11]} position={[0, 0.12, 0]} color={C.verdePrimario} borde={C.verde} />
      <Caja args={[4, 0.28, 5]} position={[1.5, 0.16, 2]} color={C.verdeMedio} />

      {CAMPO_ANIMALES.map((a, i) => (
        <group key={i}>
          <Vaca position={a.pos} rotation={a.rot} seed={a.seed} />
          <PuntoDato
            position={[a.pos[0], a.pos[1] + 1.1, a.pos[2]]}
            color={a.estado.alerta ? C.ambar : C.verdePrimario}
          >
            <FichaAnimal eid={a.eid} lineas={a.lineas} estado={a.estado} />
          </PuntoDato>
        </group>
      ))}

      <Arbol position={[-3.2, 0.25, 3]} />
      {[
        [-1.5, 2.2],
        [2.3, -1.2],
        [-2.8, -2],
        [3, 3.2],
      ].map((p, i) => (
        <Pasto key={i} position={[p[0], 0.25, p[1]]} seed={i} />
      ))}
      <CaravanaFlotante position={[2.8, 2.5, -2]} />
      <CaravanaFlotante position={[-1, 2.9, 2.6]} />
    </group>
  );
}

function Manga() {
  const postes = Array.from({ length: 7 }, (_, i) => i);
  return (
    <group position={[ZONA_X[1], 0, 0]}>
      <Caja args={[8, 0.25, 11]} position={[0, 0.12, 0]} color={C.crema} borde={C.linea} />
      <Caja args={[2, 0.3, 9]} position={[0, 0.16, 0]} color={C.lineaFuerte} />
      {postes.map((i) => {
        const z = -4 + i * 1.35;
        return (
          <group key={i}>
            <Caja args={[0.16, 1, 0.16]} position={[-1.1, 0.6, z]} color={C.verdeMedio} />
            <Caja args={[0.16, 1, 0.16]} position={[1.1, 0.6, z]} color={C.verdeMedio} />
          </group>
        );
      })}
      <Caja args={[0.1, 0.16, 9]} position={[-1.1, 0.9, 0]} color={C.verde} />
      <Caja args={[0.1, 0.16, 9]} position={[1.1, 0.9, 0]} color={C.verde} />
      {/* arco lector RFID */}
      <Caja args={[0.25, 2.4, 0.25]} position={[-1.4, 1.2, 0]} color={C.verdePrimario} borde={C.verde} />
      <Caja args={[0.25, 2.4, 0.25]} position={[1.4, 1.2, 0]} color={C.verdePrimario} borde={C.verde} />
      <Caja args={[3.3, 0.35, 0.4]} position={[0, 2.45, 0]} color={C.verde} />
      <Caja args={[0.9, 0.6, 0.15]} position={[0, 2.1, 0.3]} color={C.naranja} />
      {/* bastón lector */}
      <group position={[1.9, 0.9, 2]} rotation={[0, 0, -0.5]}>
        <mesh>
          <cylinderGeometry args={[0.07, 0.07, 1.6, 10]} />
          <meshStandardMaterial color={C.naranja} flatShading />
        </mesh>
        <Caja args={[0.22, 0.3, 0.1]} position={[0, 0.95, 0]} color={C.verde} />
      </group>

      {/* animal en lectura + pulso RFID + ficha "leyendo" */}
      <Vaca position={[0, 0.25, -0.5]} rotation={Math.PI / 2} seed={0.4} />
      <PulsoRFID position={[0, 0.16, -0.5]} />
      <PuntoDato position={[0, 1.35, -0.5]} color={C.naranja} altura={1.9}>
        <div
          className="pointer-events-none select-none rounded-lg border bg-bg-card/95 px-2.5 py-1.5 shadow-soft"
          style={{ width: "max-content", borderColor: C.naranjaSuave }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: C.naranja }}
            />
            <span className="font-mono text-[11px] font-semibold" style={{ color: C.verde }}>
              AR 0471
            </span>
          </div>
          <div className="text-[10px] leading-tight" style={{ color: C.verdeMedio }}>
            Leyendo caravana…
          </div>
          <div className="text-[10px] leading-tight" style={{ color: C.verdeMedio }}>
            Registrando sanidad + pesaje
          </div>
        </div>
      </PuntoDato>
    </group>
  );
}

function Camion({ activo }: { activo: boolean }) {
  const ruedas = useRef<THREE.Group>(null);
  const carroceria = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (ruedas.current && activo) ruedas.current.rotation.x += dt * 4;
    // leve vibración de motor en ralentí
    if (carroceria.current)
      carroceria.current.position.y = activo ? Math.sin(clock.elapsedTime * 22) * 0.012 : 0;
  });
  const posRuedas: [number, number, number][] = [
    [-1.6, 0.35, 0.65],
    [-1.6, 0.35, -0.65],
    [1, 0.35, 0.65],
    [1, 0.35, -0.65],
    [1.8, 0.35, 0.65],
    [1.8, 0.35, -0.65],
  ];
  return (
    <group>
      <group ref={carroceria}>
        <Caja args={[3, 1.5, 1.7]} position={[-0.8, 1.35, 0]} color={C.papel} borde={C.verde} />
        <Caja args={[1.5, 1.3, 1.6]} position={[1.6, 1.25, 0]} color={C.verdePrimario} borde={C.verde} />
        <Caja args={[0.8, 0.6, 1.4]} position={[2.1, 1.6, 0]} color={C.naranjaSuave} />
        <Caja args={[5, 0.3, 1.5]} position={[0.3, 0.6, 0]} color={C.lineaFuerte} />
      </group>
      <group ref={ruedas}>
        {posRuedas.map((p, i) => (
          <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.38, 0.38, 0.25, 14]} />
            <meshStandardMaterial color={C.verde} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Transporte({ activo }: { activo: boolean }) {
  return (
    <group position={[ZONA_X[2], 0, 0]}>
      <Caja args={[9, 0.25, 11]} position={[0, 0.12, 0]} color={C.crema} borde={C.linea} />
      <Caja args={[10, 0.28, 2.6]} position={[0, 0.16, 0]} color={C.linea} />
      {[-3, -1, 1, 3].map((x, i) => (
        <Caja key={i} args={[0.8, 0.02, 0.18]} position={[x, 0.31, 0]} color={C.papel} />
      ))}
      <Camion activo={activo} />
      {/* ficha del envío (DT-e / SENASA) */}
      <PuntoDato position={[-0.8, 2.2, 0]} color={C.verdePrimario} altura={1.8}>
        <FichaAnimal
          eid="DT-e 0042"
          lineas={["38 animales · tránsito", "Frigorífico · carencias OK"]}
          estado={{ texto: "SENASA sincronizado" }}
        />
      </PuntoDato>
      {/* cartel */}
      <group position={[-3.5, 0, 3]}>
        <Caja args={[0.18, 1.8, 0.18]} position={[0, 0.9, 0]} color={C.verdeMedio} />
        <Caja args={[1.7, 1, 0.12]} position={[0, 2, 0]} color={C.verde} borde={C.naranja} />
      </group>
    </group>
  );
}

export function Escena({ activo }: { activo: number }) {
  const inicial = posCamara(ZONA_X[0], new THREE.Vector3());
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: 22, position: [inicial.x, inicial.y, inicial.z], near: 0.1, far: 200 }}
      gl={{ antialias: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={[C.crema]} />
      <fog attach="fog" args={[C.crema, 46, 86]} />

      <hemisphereLight args={["#ffffff", "#dde8d5", 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[12, 18, 8]} intensity={1.3} color="#fff7e8" />

      {/* plataforma base (isla) */}
      <Caja args={[42, 1, 14]} position={[0, -0.4, 0]} color={C.crema} borde={C.linea} />
      <Caja args={[42, 0.6, 14]} position={[0, -1, 0]} color={C.linea} />

      <Campo />
      <Manga />
      <Transporte activo={activo === 2} />

      <ContactShadows
        position={[0, 0.13, 0]}
        scale={48}
        far={6}
        blur={2.6}
        opacity={0.32}
        color={C.verde}
      />

      <CamaraTour activo={activo} />
    </Canvas>
  );
}

export default Escena;
