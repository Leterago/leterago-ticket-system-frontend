// Utilidades de fecha/hora para las reservas de salones. Todo en hora LOCAL:
// las reservas guardan "YYYY-MM-DD" y "HH:mm" sin zona (hora de la empresa).

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Lunes de la semana de `d` (semana laboral dominicana: lunes a viernes). */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // 0 = lunes
  out.setDate(out.getDate() - dow);
  return out;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTime12(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function formatDuration(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatFechaLarga(ymd: string): string {
  const s = new Intl.DateTimeFormat("es-DO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(parseYmd(ymd));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Minutos transcurridos hoy (hora local). */
export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** ¿La franja ya terminó? (misma regla que el backend: no se reserva en el pasado). */
export function slotHasEnded(fecha: string, horaHasta: string): boolean {
  const today = toYmd(new Date());
  if (fecha !== today) return fecha < today;
  return toMinutes(horaHasta) <= nowMinutes();
}

export type TimeSlot = { salon: string; fecha: string; horaDesde: string; horaHasta: string };

/** Mismo salón y día, y las franjas se pisan (los bordes no chocan). Espejo del backend. */
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return (
    a.salon === b.salon &&
    a.fecha === b.fecha &&
    a.horaDesde < b.horaHasta &&
    b.horaDesde < a.horaHasta
  );
}
