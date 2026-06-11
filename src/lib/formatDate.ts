export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "—";
  const fmt = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", year: "numeric" });
  const parts = fmt.formatToParts(date);
  const day   = parts.find((p) => p.type === "day")?.value   ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year  = parts.find((p) => p.type === "year")?.value  ?? "";
  return `${day} ${month.slice(0, 3)}. ${year}`;
}

export function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "ahora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `hace ${day} d`;
  return formatDate(new Date(ts));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "—";
  const datePart = formatDate(date);
  const timeFmt = new Intl.DateTimeFormat("es-DO", { hour: "numeric", minute: "2-digit", hour12: true });
  const timeParts = timeFmt.formatToParts(date);
  const hour    = timeParts.find((p) => p.type === "hour")?.value   ?? "";
  const minute  = timeParts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = (timeParts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase().replace(/\.\s?/g, "");
  return `${datePart} ${hour}:${minute}${dayPeriod}`;
}
