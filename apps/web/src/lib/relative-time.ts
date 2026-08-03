export function relativeTimeFa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ساعت پیش`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "دیروز";
  if (diffDay < 30) return `${diffDay} روز پیش`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} ماه پیش`;

  return `${Math.floor(diffMonth / 12)} سال پیش`;
}

export function clockTimeFa(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}
