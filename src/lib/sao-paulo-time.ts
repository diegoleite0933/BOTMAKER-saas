const timeZone = "America/Sao_Paulo";

export function saoPauloDateParts(date: Date): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
}

export function saoPauloDateKey(date: Date) {
  const parts = saoPauloDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function saoPauloDayStart(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day);
  let timestamp = targetWallTime;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = saoPauloDateParts(new Date(timestamp));
    const currentWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    timestamp += targetWallTime - currentWallTime;
  }

  return new Date(timestamp);
}

export function formatSaoPauloDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}