// Small shared helpers.

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "Create the session" -> "create-the-session" */
export function slugify(text) {
  const slug = String(text)
    .toLowerCase()
    .replace(/[`'’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** Returns a function that makes each id unique inside one page. */
export function uniqueIds() {
  const used = new Map();
  return (base) => {
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

export function minutesLabel(minutes) {
  if (!minutes) return '';
  return `${minutes} min`;
}

export function hoursLabel(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return rest ? `${h} ${rest} minutes` : h;
}

export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

/** A short, stable, file-name-safe key. */
export function fileKey(text) {
  return String(text).replace(/[^A-Za-z0-9._-]+/g, '-');
}
