"use client";

import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Float } from "@react-three/drei";
import * as THREE from "three";

// Escena isométrica low-poly del flujo de trazabilidad ganadera (AgroTrace).
// Tres zonas alineadas en X: campo (RFID) → manga (lectura) → transporte (DT-e/SENASA).
// La cámara viaja suavemente entre ellas (waypoints) manteniendo el ángulo isométrico.

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

// Controlador de cámara: amortigua posición y punto de mira hacia el waypoint activo.
function CamaraTour({ activo }: { activo: number }) {
  const { camera } = useThree();
  const miraActual = useRef(new THREE.Vector3(ZONA_X[0], Y_OBJETIVO, 0));
  const posDeseada = useRef(new THREE.Vector3());
  const miraDeseada = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const x = ZONA_X[activo] ?? 0;
    posCamara(x, posDeseada.current);
    miraDeseada.current.set(x, Y_OBJETIVO, 0);
    // suavizado independiente de framerate
    const k = 1 - Math.pow(0.0016, Math.min(dt, 0.05));
    camera.position.lerp(posDeseada.current, k);
    miraActual.current.lerp(miraDeseada.current, k);
    camera.lookAt(miraActual.current);
  });
  return null;
}

// ---------- Modelos low-poly ----------

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
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} flatShading roughness={0.85} metalness={0} />
      {borde && <Edges color={borde} threshold={20} />}
    </mesh>
  );
}

function Vaca({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <Float speed={2.2} rotationIntensity={0} floatIntensity={0.25} floatingRange={[0, 0.12]}>
      <group position={position} rotation={[0, rotation, 0]} scale={0.62}>
        {/* cuerpo */}
        <Caja args={[1.5, 0.85, 0.85]} position={[0, 0.95, 0]} color={C.papel} borde={C.verde} />
        {/* manchas */}
        <Caja args={[0.5, 0.4, 0.45]} position={[0.35, 1.15, 0.44]} color={C.verde} />
        <Caja args={[0.4, 0.5, 0.45]} position={[-0.4, 0.9, -0.44]} color={C.verde} />
        {/* cabeza */}
        <Caja args={[0.55, 0.55, 0.6]} position={[0.95, 1.15, 0]} color={C.papel} borde={C.verde} />
        {/* caravana (ear tag) naranja */}
        <Caja args={[0.16, 0.22, 0.05]} position={[1.05, 1.35, 0.3]} color={C.naranja} />
        {/* patas */}
        {[
          [0.5, 0.42],
          [0.5, -0.42],
          [-0.5, 0.42],
          [-0.5, -0.42],
        ].map(([x, z], i) => (
          <Caja key={i} args={[0.18, 0.55, 0.18]} position={[x, 0.3, z]} color={C.verdeMedio} />
        ))}
      </group>
    </Float>
  );
}

// Caravana RFID flotante (etiqueta naranja girando) sobre el campo.
function CaravanaFlotante({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.8;
  });
  return (
    <Float speed={3} floatIntensity={0.9} floatingRange={[0, 0.35]}>
      <group ref={ref} position={position}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.7, 0.08]} />
          <meshStandardMaterial color={C.naranja} flatShading roughness={0.6} />
          <Edges color={C.verde} />
        </mesh>
        {/* agujero del precinto */}
        <mesh position={[0, 0.42, 0]}>
          <torusGeometry args={[0.1, 0.04, 8, 16]} />
          <meshStandardMaterial color={C.naranjaSuave} flatShading />
        </mesh>
      </group>
    </Float>
  );
}

// Arbolito para ambientar el campo.
function Arbol({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Caja args={[0.25, 0.8, 0.25]} position={[0, 0.4, 0]} color={C.verdeMedio} />
      <mesh position={[0, 1.25, 0]} castShadow>
        <coneGeometry args={[0.7, 1.3, 6]} />
        <meshStandardMaterial color={C.verdePrimario} flatShading roughness={0.9} />
        <Edges color={C.verde} />
      </mesh>
    </group>
  );
}

function Campo() {
  return (
    <group position={[ZONA_X[0], 0, 0]}>
      {/* parche de pasto */}
      <Caja args={[9, 0.25, 11]} position={[0, 0.12, 0]} color={C.verdePrimario} borde={C.verde} />
      <Caja args={[4, 0.28, 5]} position={[1.5, 0.16, 2]} color={C.verdeMedio} />
      <Vaca position={[-2, 0.25, -1]} rotation={0.5} />
      <Vaca position={[1.5, 0.25, 1.5]} rotation={-0.8} />
      <Vaca position={[0, 0.25, -3]} rotation={2.4} />
      <Arbol position={[-3.2, 0.25, 3]} />
      <CaravanaFlotante position={[2.6, 2.4, -2]} />
      <CaravanaFlotante position={[-1, 2.8, 2.6]} />
    </group>
  );
}

function Manga() {
  // dos hileras de postes (la manga) + arco lector + bastón.
  const postes = Array.from({ length: 7 }, (_, i) => i);
  return (
    <group position={[ZONA_X[1], 0, 0]}>
      <Caja args={[8, 0.25, 11]} position={[0, 0.12, 0]} color={C.crema} borde={C.linea} />
      {/* piso de la manga */}
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
      {/* barandas */}
      <Caja args={[0.1, 0.16, 9]} position={[-1.1, 0.9, 0]} color={C.verde} />
      <Caja args={[0.1, 0.16, 9]} position={[1.1, 0.9, 0]} color={C.verde} />
      {/* arco lector RFID */}
      <Caja args={[0.25, 2.4, 0.25]} position={[-1.4, 1.2, 0]} color={C.verdePrimario} borde={C.verde} />
      <Caja args={[0.25, 2.4, 0.25]} position={[1.4, 1.2, 0]} color={C.verdePrimario} borde={C.verde} />
      <Caja args={[3.3, 0.35, 0.4]} position={[0, 2.45, 0]} color={C.verde} />
      {/* panel del lector (naranja) */}
      <Caja args={[0.9, 0.6, 0.15]} position={[0, 2.1, 0.3]} color={C.naranja} />
      {/* bastón lector */}
      <group position={[1.9, 0.9, 2]} rotation={[0, 0, -0.5]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.6, 10]} />
          <meshStandardMaterial color={C.naranja} flatShading />
        </mesh>
        <Caja args={[0.22, 0.3, 0.1]} position={[0, 0.95, 0]} color={C.verde} />
      </group>
      {/* una vaca en la manga */}
      <Vaca position={[0, 0.25, -1]} rotation={Math.PI / 2} />
    </group>
  );
}

function Camion({ activo }: { activo: boolean }) {
  const ruedas = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ruedas.current && activo) ruedas.current.rotation.x += dt * 4;
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
    <group position={[0, 0, 0]}>
      {/* acoplado */}
      <Caja args={[3, 1.5, 1.7]} position={[-0.8, 1.35, 0]} color={C.papel} borde={C.verde} />
      {/* cabina */}
      <Caja args={[1.5, 1.3, 1.6]} position={[1.6, 1.25, 0]} color={C.verdePrimario} borde={C.verde} />
      <Caja args={[0.8, 0.6, 1.4]} position={[2.1, 1.6, 0]} color={C.naranjaSuave} />
      {/* chasis */}
      <Caja args={[5, 0.3, 1.5]} position={[0.3, 0.6, 0]} color={C.lineaFuerte} />
      {/* ruedas */}
      <group ref={ruedas}>
        {posRuedas.map((p, i) => (
          <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]} castShadow>
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
      {/* ruta */}
      <Caja args={[10, 0.28, 2.6]} position={[0, 0.16, 0]} color={C.linea} />
      {[-3, -1, 1, 3].map((x, i) => (
        <Caja key={i} args={[0.8, 0.02, 0.18]} position={[x, 0.31, 0]} color={C.papel} />
      ))}
      <Camion activo={activo} />
      {/* cartel DT-e / SENASA */}
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
