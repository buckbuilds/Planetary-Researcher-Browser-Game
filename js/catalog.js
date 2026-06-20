// ═══════════════════════════════════════════════════════════════
// CATALOG: Progressive detail based on instrument scans
// ═══════════════════════════════════════════════════════════════

const Catalog = {
  add() {
    const ps = getCurrentPlanetState();
    if (!ps) return;
    const key = ps.x + ',' + ps.y;
    if (!Knowledge.isBioScanned(ps.x, ps.y)) {
      UI.appendOutput(`<span class="warn">No scan data here. Use IR, Spectrometer, or Observe first.</span>`);
      return;
    }
    const tile = getTile(ps.x, ps.y);
    const organisms = [...tile.flora, ...tile.fauna];
    const scans = Knowledge.getSpeciesScans(ps.x, ps.y);
    let added = 0;
    organisms.forEach(o => {
      const existing = ps.catalog.find(c => c.id === o.id);
      if (existing) {
        if (scans.ir) existing.scans.ir = true;
        if (scans.spec) existing.scans.spec = true;
        if (scans.observe) existing.scans.observe = true;
      } else {
        ps.catalog.push({
          ...o,
          location: key,
          time: formatTime(),
          biome: tile.biome,
          scans: { ir: scans.ir, spec: scans.spec, observe: scans.observe }
        });
        added++;
        Events.emit('speciesFound', { species: o, scans });
        // No auto-journal entry — player decides what to record
      }
    });
    if (added > 0) { UI.appendOutput(`<span class="bio">Catalogued ${added} new species at this location.</span>`); UI.printLocation(); }
    else if (organisms.length === 0) UI.appendOutput(`<span class="dim">No organisms to catalog here.</span>`);
    else UI.appendOutput(`<span class="dim">All species here already catalogued. Scan layers updated.</span>`);
    this.render();
    Journal.renderStats();
    saveGame();
  },

  render() {
    const ps = getCurrentPlanetState();
    const el = document.getElementById('catalog-list');
    if (!ps || ps.catalog.length === 0) {
      el.innerHTML = '<span class="dim">No species catalogued.</span>';
      return;
    }
    el.innerHTML = ps.catalog.map(c => {
      const scanTags = ['ir','spec','observe'].map(s =>
        `<span class="scan-tag ${c.scans[s] ? 'done' : 'missing'}">${s.toUpperCase()}</span>`
      ).join('');

      let details = '';
      if (c.scans.ir) {
        if (c.type === 'fauna') details += `Thermal profile detected. ${c.eyes !== undefined ? (c.eyes === 0 ? 'No optical organs.' : c.eyes + ' sensor(s) visible.') : ''}`;
        else details += `Thermal signature: ${c.bioluminescent ? 'anomalous emission detected' : 'standard organic profile'}.`;
      }
      if (c.scans.spec) {
        if (c.type === 'flora') details += ` Pigmentation: ${c.color}. Structure: ${c.feature}.`;
        else details += ` Surface composition: ${c.cover || 'unknown'}.`;
      }
      if (c.scans.observe && c.type === 'fauna') {
        details += ` Locomotion: ${c.loco}. Body plan: ${c.body}, ${c.limbs} limbs.`;
      }
      const fullScans = c.type === 'fauna' ? (c.scans.ir && c.scans.observe) : (c.scans.ir && c.scans.spec);
      if (fullScans) details += `<br><span style="color:var(--text)">${c.desc}</span>`;

      return `<div class="entry">
        <span class="entry-name">${c.type === 'flora' ? '\uD83C\uDF3F' : '\uD83D\uDC3E'} ${c.name}</span><br>
        <span class="entry-type">${BIOME_NAMES[c.biome]} (${c.location}) \u2014 ${c.time}</span>
        <div class="scan-layers">${scanTags}</div>
        <div class="dim" style="margin-top:3px">${details || 'Run more instrument scans to reveal details.'}</div>
      </div>`;
    }).join('');
  }
};
