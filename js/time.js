// ═══════════════════════════════════════════════════════════════
// TIME & ENVIRONMENT
// ═══════════════════════════════════════════════════════════════

function getDayPhase() {
  const ps = getCurrentPlanetState();
  if (!ps || !planet) return 'day';
  const rot = planet.rotationPeriod;
  const h = ps.timeHours % rot;
  const dayFrac = h / rot;
  if (dayFrac < 0.2) return 'night';
  if (dayFrac < 0.3) return 'dawn';
  if (dayFrac < 0.7) return 'day';
  if (dayFrac < 0.8) return 'dusk';
  return 'night';
}

function formatDayPhase() {
  const labels = {
    dawn: 'Dawn',
    day: 'Daylight',
    dusk: 'Dusk',
    night: 'Night'
  };
  return labels[getDayPhase()] || 'Daylight';
}

function formatTime() {
  const ps = getCurrentPlanetState();
  if (!ps || !planet) return '—';
  const rot = planet.rotationPeriod;
  const h = ps.timeHours % rot;
  const dayNum = Math.floor(ps.timeHours / rot) + 1;
  return `Day ${dayNum}, ${h.toFixed(1)}h / ${rot.toFixed(1)}h (${getDayPhase()})`;
}

function getSunAltitude() {
  const ps = getCurrentPlanetState();
  if (!ps || !planet) return 0;
  const rot = planet.rotationPeriod;
  const h = ps.timeHours % rot;
  const angle = (h / rot) * 360 - 90;
  return Math.sin(angle * Math.PI / 180) * 90;
}
