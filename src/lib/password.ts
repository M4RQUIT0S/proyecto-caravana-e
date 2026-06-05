// Política de contraseñas (compartida por registro y restablecimiento).
// Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo especial.

export interface RequisitoPassword {
  id: string;
  label: string;
  ok: boolean;
}

export function requisitosPassword(pw: string): RequisitoPassword[] {
  return [
    { id: "largo", label: "Al menos 8 caracteres", ok: pw.length >= 8 },
    { id: "mayus", label: "Una letra mayúscula (A-Z)", ok: /[A-Z]/.test(pw) },
    { id: "minus", label: "Una letra minúscula (a-z)", ok: /[a-z]/.test(pw) },
    { id: "numero", label: "Un número (0-9)", ok: /[0-9]/.test(pw) },
    {
      id: "simbolo",
      label: "Un símbolo especial (!@#$…)",
      ok: /[^A-Za-z0-9]/.test(pw),
    },
  ];
}

export function passwordValida(pw: string): boolean {
  return requisitosPassword(pw).every((r) => r.ok);
}
