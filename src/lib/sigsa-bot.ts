import { chromium, type Browser, type Page } from "playwright-core";
import * as XLSX from "xlsx";

export interface AnimalParaBot {
  caravana: string;
  sexo?: "M" | "H";
  raza?: string;
  categoria?: string;
  fechaNacimiento?: string;
}

export interface BotInput {
  cuit: string;
  clave: string;
  acta: string;
  animales: AnimalParaBot[];
  loteNombre: string;
}

export type BotResultado =
  | { ok: true; mensaje: string; animalesDeclarados: string[] }
  | {
      ok: false;
      etapa: "login" | "navegacion" | "carga" | "confirmacion" | "browser";
      mensaje: string;
      necesitaIntervencion?: boolean;
      screenshotBase64?: string;
    };

const AFIP_LOGIN_URL = "https://auth.afip.gob.ar/contribuyente_/login.xhtml";

function generarBufferXLSX(input: BotInput): Buffer {
  const rows = input.animales.map((a) => ({
    acta: input.acta,
    caravana: a.caravana,
    sexo: a.sexo === "M" ? "Macho" : a.sexo === "H" ? "Hembra" : "",
    raza: a.raza ?? "",
    categoria: a.categoria ?? "",
    fecha_nacimiento: a.fechaNacimiento ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SIGSA");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

async function capturar(page: Page): Promise<string | undefined> {
  try {
    const buf = await page.screenshot({ fullPage: true });
    return buf.toString("base64");
  } catch {
    return undefined;
  }
}

async function loginAfip(page: Page, cuit: string, clave: string): Promise<void> {
  await page.goto(AFIP_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });

  // El formulario de AFIP tiene 2 pantallas: primero CUIT, luego clave.
  // Selectors basados en la página pública de AFIP — ajustar si cambian.
  await page.fill('input[name="F1:username"]', cuit);
  await page.click('input[name="F1:btnSiguiente"]');

  await page.waitForSelector('input[name="F1:password"]', { timeout: 20_000 });
  await page.fill('input[name="F1:password"]', clave);
  await page.click('input[name="F1:btnIngresar"]');

  // Esperar a que cargue la portada del contribuyente. El selector real va a
  // depender de qué muestra AFIP — esto es un placeholder razonable.
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
}

async function navegarASigsa(page: Page): Promise<void> {
  // TODO: reemplazar con el deeplink/selector real al servicio SIGSA dentro
  // del portal AFIP cuando lo tengamos confirmado. Por ahora intentamos buscar
  // un link visible llamado "SIGSA".
  const link = page.getByRole("link", { name: /sigsa/i });
  await link.first().click({ timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 45_000 });
}

async function subirArchivoYConfirmar(
  page: Page,
  archivo: { nombre: string; contenido: Buffer }
): Promise<void> {
  // TODO: reemplazar selectors reales una vez que tengamos acceso a SIGSA.
  // Patrón estándar de Playwright para inputs file:
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: archivo.nombre,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: archivo.contenido,
  });

  // Botón de confirmar carga (placeholder; nombre real depende de SIGSA).
  await page.getByRole("button", { name: /confirmar|enviar|cargar/i }).first().click();

  // Esperar mensaje de éxito.
  await page.waitForSelector("text=/éxito|exitosa|cargado correctamente/i", {
    timeout: 60_000,
  });
}

export async function sincronizarSIGSA(input: BotInput): Promise<BotResultado> {
  let browser: Browser | undefined;
  let page: Page | undefined;
  try {
    // En el contenedor (imagen de Playwright) se usa el Chromium incluido. Para correrlo
    // localmente sin Docker se puede apuntar al Chrome del sistema con estas variables:
    //   BOT_CHROME_CHANNEL=chrome   (usa el Google Chrome instalado)
    //   BOT_CHROME_PATH=C:\...\chrome.exe   (ruta directa, alternativa)
    const channel = process.env.BOT_CHROME_CHANNEL || undefined;
    const executablePath = process.env.BOT_CHROME_PATH || undefined;
    browser = await chromium.launch({
      headless: true,
      ...(channel ? { channel } : {}),
      ...(executablePath ? { executablePath } : {}),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const context = await browser.newContext({
      locale: "es-AR",
      viewport: { width: 1366, height: 900 },
    });
    page = await context.newPage();

    try {
      await loginAfip(page, input.cuit, input.clave);
    } catch (err: any) {
      const captcha = await page.locator('img[src*="captcha" i], iframe[src*="captcha" i]').count();
      return {
        ok: false,
        etapa: "login",
        mensaje:
          captcha > 0
            ? "AFIP está pidiendo captcha o 2FA — el bot no puede resolverlo solo. Iniciá sesión manualmente esta vez."
            : `No se pudo iniciar sesión en AFIP: ${err?.message ?? err}`,
        necesitaIntervencion: captcha > 0,
        screenshotBase64: await capturar(page),
      };
    }

    try {
      await navegarASigsa(page);
    } catch (err: any) {
      return {
        ok: false,
        etapa: "navegacion",
        mensaje: `No se pudo abrir SIGSA después del login: ${err?.message ?? err}`,
        screenshotBase64: await capturar(page),
      };
    }

    try {
      const buffer = generarBufferXLSX(input);
      const slug = input.loteNombre.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40);
      await subirArchivoYConfirmar(page, {
        nombre: `sigsa-${slug || "lote"}.xlsx`,
        contenido: buffer,
      });
    } catch (err: any) {
      return {
        ok: false,
        etapa: "carga",
        mensaje: `Falló la carga del archivo en SIGSA: ${err?.message ?? err}`,
        screenshotBase64: await capturar(page),
      };
    }

    return {
      ok: true,
      mensaje: `Carga SIGSA completada para ${input.animales.length} caravana(s) con acta ${input.acta}.`,
      animalesDeclarados: input.animales.map((a) => a.caravana),
    };
  } catch (err: any) {
    return {
      ok: false,
      etapa: "browser",
      mensaje: `Error iniciando el navegador headless: ${err?.message ?? err}`,
      screenshotBase64: page ? await capturar(page) : undefined,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}
