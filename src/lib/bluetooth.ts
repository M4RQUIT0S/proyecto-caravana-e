"use client";

// Servicio genérico Nordic UART (común en lectores RFID BLE).
// Si tu lector usa otro UUID, cambialo acá.
const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify

export interface BluetoothLectura {
  raw: string;
  appendCsv(headerIfNeeded?: string): string;
}

export interface BluetoothSesion {
  deviceName: string;
  buffer: string;
  onChunk: (chunk: string) => void;
  stop(): Promise<void>;
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(opts: any): Promise<any>;
    };
  }
}

export function bluetoothDisponible(): boolean {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export async function conectarLectorRFID(
  onChunk: (chunk: string) => void
): Promise<BluetoothSesion> {
  if (!bluetoothDisponible()) {
    throw new Error(
      "Web Bluetooth no está disponible en este navegador. Probá con Chrome/Edge en escritorio o Android."
    );
  }
  const device = await navigator.bluetooth!.requestDevice({
    acceptAllDevices: true,
    optionalServices: [UART_SERVICE],
  });
  const server = await device.gatt.connect();
  let characteristic: any;
  try {
    const service = await server.getPrimaryService(UART_SERVICE);
    characteristic = await service.getCharacteristic(UART_TX);
  } catch (e) {
    throw new Error(
      "No se encontró el servicio UART en el dispositivo. Verificá que tu lector exponga el perfil Nordic UART o cargá los datos por archivo."
    );
  }
  const decoder = new TextDecoder();
  let buffer = "";
  const handler = (ev: any) => {
    const value = ev.target?.value as DataView | undefined;
    if (!value) return;
    const text = decoder.decode(value);
    buffer += text;
    onChunk(text);
  };
  characteristic.addEventListener("characteristicvaluechanged", handler);
  await characteristic.startNotifications();
  return {
    deviceName: device.name || "Lector RFID",
    buffer,
    onChunk,
    async stop() {
      try {
        characteristic.removeEventListener("characteristicvaluechanged", handler);
        await characteristic.stopNotifications();
      } catch {}
      try {
        server.disconnect();
      } catch {}
    },
  };
}

// Normaliza un buffer crudo del lector a un CSV mínimo (una caravana por línea).
export function bufferAcsv(buffer: string): string {
  const lineas = buffer
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Si ya parece CSV con header, lo devolvemos tal cual.
  if (lineas[0] && lineas[0].toLowerCase().includes("caravana")) {
    return lineas.join("\n");
  }
  return ["caravana", ...lineas].join("\n");
}
