export function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '0:00';
  const total = Math.floor(Number(seconds));
  const hours = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (hours > 0) {
    return `${hours}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function chapterDuration(chapter) {
  const start = Number(chapter?.start_seconds || 0);
  const end = Number(chapter?.end_seconds || 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '-';
  return formatDuration(end - start);
}
