// ═══════════════════════════════════════════════════════════════
// UI: All rendering — output, map, HUD, tabs, planet info
// ═══════════════════════════════════════════════════════════════

const UI = {
  setOutput(html) {
    document.getElementById('output').innerHTML = html;
    document.getElementById('output').scrollTop = 0;
  },

  appendOutput(html) {
    const out = document.getElementById('output');
    out.innerHTML += '\n<span class="separator">\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</span>\n' + html;
    out.scrollTop = out.scrollHeight;
  },

  showReadout(html) {
    state.lastReading = html;
    let el = document.getElementById('instrument-readout');
    if (!el) {
      const out = document.getElementById('output');
      out.insertAdjacentHTML('afterend', '<div id="instrument-readout" style="padding:12px;border-top:1px solid var(--card-border);overflow-y:auto;max-height:40vh;flex-shrink:0;white-space:pre-wrap;font-size:13px;line-height:1.6"></div>');
      el = document.getElementById('instrument-readout');
    }
    el.innerHTML = `<span class="reading">${html}</span>`;
  },

  showTab(name, clickedBtn) {
    document.querySelectorAll('.right-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    if (clickedBtn) clickedBtn.classList.add('active');
    this.updateAnomalyTabSignal();
    this.updateEquipmentTabSignal();
  },

  describeLocation(tile) {
    const ps = getCurrentPlanetState();
    if (!ps) return '';
    const phase = getDayPhase();
    const biome = tile.biome;
    const r = tileRng(planet.seed, ps.x, ps.y);
    for (let i = 0; i < 10; i++) r();
    const biomeKnown = Knowledge.isBiomeKnown(ps.x, ps.y);
    const biomeName = biomeKnown ? BIOME_NAMES[biome] : 'Uncharted Region';

    const timeDescs = {
      night: 'The sky is dark, lit by unfamiliar stars.',
      dawn: 'The horizon glows as the star rises, casting long shadows.',
      day: `The ${planet.star.type}-class star hangs in the sky, bathing everything in ${planet.star.type === 'M' ? 'reddish' : planet.star.type === 'K' ? 'amber' : planet.star.type === 'F' ? 'blue-white' : 'warm'} light.`,
      dusk: 'The star sinks toward the horizon. Colors shift and deepen.'
    };

    const biomeDescs = {
      plains: ['A broad, open expanse stretches in every direction. The ground is covered in fine-grained sediment.', 'Flat terrain extends to the horizon. Subtle undulations hint at ancient geological processes.', 'An open plain of compacted regolith. Wind has carved faint ripple patterns into the surface.'],
      mountain: ['Jagged peaks rise sharply. Exposed rock strata reveal layers of geological history.', 'Rocky terrain climbs steeply here. Fractured cliff faces show mineral veins.', 'A mountainous ridge with weathered formations. The thin atmosphere is even thinner at this altitude.'],
      cave: ['A dark opening in the rock face leads underground. Cool air flows outward.', 'A cave entrance, partially obscured by debris. The walls show signs of fluid erosion.', 'A fissure in the terrain reveals a passage downward. Faint echoes suggest a large cavity below.'],
      ocean: ["Waves lap against a rocky shore. The liquid stretches to the horizon, its color shifted by the star's light.", 'A coastline of dark pebbles and tidal pools. Foam traces patterns on the shore.', 'The ocean meets the land in a gentle slope. The water is surprisingly clear near the edge.'],
      volcanic: ['Dark, hardened lava flows cover the ground. Wisps of gas rise from cracks in the surface.', 'A volcanic landscape of black rock and sulfurous vents. The ground radiates heat.', 'Cinder cones and old lava tubes dot this harsh terrain. The air tastes of sulfur.'],
      ice: ['A vast sheet of ice extends outward, cracked into geometric patterns. The cold is intense.', 'Frozen terrain. The ice has a faint blue tint and creaks under pressure.', 'An ice field with pressure ridges and shallow crevasses. Frost crystals catch the light.'],
      forest: ['Dense growths of alien organisms rise around you, forming a canopy of unfamiliar shapes and colors.', 'A forest of xeno-flora. The organisms here have evolved complex structures for light capture.', 'Tall, branching organisms crowd together, their various forms creating a layered ecosystem.'],
      desert: ['Arid, wind-scoured terrain. The ground is bare except for scattered rocks.', 'A desert landscape of fine dust and exposed bedrock. Heat shimmers rise from the surface.', 'Dry, barren ground stretches ahead. Wind has polished the rocks smooth.'],
      marsh: ['Saturated ground squelches underfoot. Pools of liquid dot the terrain.', 'A marshy area where liquid seeps from the ground. The air is thick with moisture.', 'Waterlogged terrain with standing pools. Dense, low-growing organisms thrive here.']
    };
    const descs = biomeDescs[biome] || biomeDescs.plains;
    const desc = descs[Math.floor(r() * descs.length)];

    let text = [];
    text.push(`<span class="location-name">${biomeName} \u2014 (${ps.x}, ${ps.y})</span>`);
    if (!biomeKnown) text.push(`<span class="dim">Use LIDAR or Drone to classify this terrain.</span>`);
    text.push(`<span class="dim">${timeDescs[phase]}</span>`);
    text.push('');
    text.push(desc);

    // Weather description
    const weatherDesc = Weather.describe(ps.x, ps.y);
    if (weatherDesc) {
      text.push('');
      text.push(weatherDesc);
    }

    text.push('');
    if (tile.hasGeothermal) text.push(`<span class="warn">You feel warmth radiating from somewhere nearby. Use instruments to investigate.</span>`);
    if (tile.flora.length > 0) { text.push(''); text.push(`<span class="bio">You notice alien growths in the area. Use instruments to study them.</span>`); }
    if (tile.fauna.length > 0) { text.push(''); text.push(`<span class="bio">Something is moving nearby. Use IR scan or Observe for details.</span>`); }
    if (tile.flora.length === 0 && tile.fauna.length === 0 && planet.hasLife) text.push(`<span class="dim">The area seems quiet.</span>`);
    return text.join('\n');
  },

  printLocation() {
    if (!planet || state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    if (!ps) return;
    const tile = getTile(ps.x, ps.y);
    this.setOutput(this.describeLocation(tile));
    const readoutEl = document.getElementById('instrument-readout');
    if (readoutEl) readoutEl.innerHTML = '';
    this.updateHUD();
    this.renderMap();
    this.renderAnomalies();
    const btn = document.getElementById('btn-observe');
    if (btn) btn.style.display = tile.fauna.length > 0 ? 'inline-block' : 'none';
  },

  renderMap() {
    const ps = getCurrentPlanetState();
    if (!ps) return;
    const radius = 6;
    const confirmedAnomalies = Anomalies.listProgress()
      .filter(a => a.status === 'confirmed')
      .reduce((map, a) => {
        map[a.x + ',' + a.y] = true;
        return map;
      }, {});
    let rows = [];
    for (let dy = -radius; dy <= radius; dy++) {
      let row = '';
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = ps.x + dx, ty = ps.y + dy;
        const key = tx + ',' + ty;
        if (dx === 0 && dy === 0) row += `<span class="you">@</span>`;
        else if (confirmedAnomalies[key]) row += `<span style="color:var(--orange);font-weight:700">!</span>`;
        else if (ps.explored[key]) {
          const t = getTile(tx, ty);
          if (Knowledge.isBiomeKnown(tx, ty)) {
            const ch = BIOME_CHARS[t.biome] || '.';
            row += `<span class="explored" style="color:${BIOME_COLORS[t.biome]}">${ch}</span>`;
          } else {
            row += `<span style="color:var(--text-dim)">?</span>`;
          }
        } else row += ' ';
      }
      rows.push(row);
    }
    document.getElementById('map-display').innerHTML = rows.join('\n');
  },

  renderAnomalies() {
    const el = document.getElementById('anomaly-list');
    if (!el) return;
    el.innerHTML = Anomalies.renderList();
    this.updateAnomalyTabSignal();
  },

  renderEquipment() {
    const el = document.getElementById('equipment-list');
    if (!el) return;
    el.innerHTML = Equipment.renderList();
    this.updateEquipmentTabSignal();
  },

  updateEquipmentTabSignal() {
    const btn = document.getElementById('tab-equipment');
    if (!btn) return;
    const view = document.getElementById('view-equipment');
    const tabOpen = view && view.classList.contains('active');
    if (tabOpen || !state) {
      btn.classList.remove('attention');
      return;
    }
    // Pulse when the researcher can afford something they don't own yet.
    const points = Equipment.points();
    const affordable = Equipment.CATALOG.some(item => !Equipment.isUpgraded(item.id) && points >= item.cost);
    btn.classList.toggle('attention', affordable);
  },

  updateAnomalyTabSignal() {
    const btn = document.getElementById('tab-anomalies');
    if (!btn) return;
    const view = document.getElementById('view-anomalies');
    const tabOpen = view && view.classList.contains('active');
    if (tabOpen || !state || state.gameMode !== 'surface' || !planet) {
      btn.classList.remove('attention');
      return;
    }

    const ps = getCurrentPlanetState();
    if (!ps) {
      btn.classList.remove('attention');
      return;
    }

    const unresolvedNearby = Anomalies.findNearby(ps.x, ps.y, { radius: 1 })
      .some(match => !match.reported);
    const actionableLog = Anomalies.listProgress()
      .some(progress => progress.status === 'confirmed' && !Anomalies.isReported(progress.id));

    btn.classList.toggle('attention', unresolvedNearby || actionableLog);
  },

  updateHUD() {
    if (!planet || state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    if (!ps) return;
    const tile = getTile(ps.x, ps.y);
    const rad = planet.surfaceRadiation * tile.radMultiplier;
    const biomeKnown = Knowledge.isBiomeKnown(ps.x, ps.y);

    const planetEl = document.getElementById('hud-planet');
    if (planetEl) planetEl.textContent = planet.name;
    document.getElementById('hud-pos').textContent = `${ps.x}, ${ps.y}`;
    document.getElementById('hud-biome').textContent = biomeKnown ? BIOME_NAMES[tile.biome] : '???';
    document.getElementById('hud-biome').style.color = biomeKnown ? BIOME_COLORS[tile.biome] : 'var(--text-dim)';
    document.getElementById('hud-time').textContent = formatTime();

    if (Knowledge.hasUsedInstrument('rad')) {
      document.getElementById('hud-rad').textContent = rad.toFixed(2) + ' mSv/hr';
      document.getElementById('hud-rad').style.color = rad > 10 ? 'var(--accent3)' : rad > 5 ? 'var(--orange)' : 'var(--green)';
    } else {
      document.getElementById('hud-rad').textContent = '\u2014';
      document.getElementById('hud-rad').style.color = 'var(--text-dim)';
    }

    if (Knowledge.hasUsedInstrument('lidar') || Knowledge.hasUsedInstrument('atmo')) {
      document.getElementById('hud-grav').textContent = (planet.surfaceGravity / 9.81).toFixed(2) + 'g';
    } else {
      document.getElementById('hud-grav').textContent = '\u2014';
      document.getElementById('hud-grav').style.color = 'var(--text-dim)';
    }

    const phaseEl = document.getElementById('hud-phase');
    if (phaseEl) {
      const phase = getDayPhase();
      phaseEl.textContent = formatDayPhase();
      phaseEl.style.color = phase === 'night' ? 'var(--accent2)'
        : phase === 'dawn' || phase === 'dusk' ? 'var(--orange)'
        : 'var(--green)';
    }

    const rpEl = document.getElementById('hud-rp');
    if (rpEl) {
      const points = Equipment.points();
      rpEl.textContent = points + ' RP';
      const affordable = Equipment.CATALOG.some(item => !Equipment.isUpgraded(item.id) && points >= item.cost);
      rpEl.style.color = affordable ? 'var(--green)' : 'var(--text-dim)';
    }
  },

  renderPlanetInfo() {
    if (!planet) return;
    const p = planet;
    const T = p.surfaceTemp - 273.15;
    const comp = roundCompositionPercents(p.atmosphere.composition, 2).map(([g, pct]) => `${g}: ${formatPercentValue(pct, 2)}%`).join(', ');
    const unk = '<span style="color:var(--text-dim)">??? (use instruments)</span>';
    const hasSolar = Knowledge.hasUsedInstrument('solar') || Knowledge.hasUsedInstrument('star');
    const hasAtmo = Knowledge.hasUsedInstrument('atmo');
    const hasRad = Knowledge.hasUsedInstrument('rad');
    const hasMag = Knowledge.hasUsedInstrument('mag');
    const hasLidar = Knowledge.hasUsedInstrument('lidar');
    const hasIR = Knowledge.hasUsedInstrument('ir');
    document.getElementById('planet-info').innerHTML = `
<div class="prop"><span class="prop-label">Name:</span> <span class="prop-value">${p.name}</span></div>
<div class="prop"><span class="prop-label">System:</span> <span class="prop-value">${starSystem.star.type}-class, ${starSystem.planets.length} planets</span></div>
<div class="prop" style="margin-top:8px"><span class="prop-label">\u2500\u2500 Star \u2500\u2500</span></div>
<div class="prop"><span class="prop-label">Type:</span> ${hasSolar ? `<span class="prop-value">${p.star.type}-class (${p.star.temp.toFixed(0)} K)</span>` : unk}</div>
<div class="prop"><span class="prop-label">Mass:</span> ${hasSolar ? `<span class="prop-value">${p.star.mass.toFixed(2)} M\u2609</span>` : unk}</div>
<div class="prop"><span class="prop-label">Luminosity:</span> ${hasSolar ? `<span class="prop-value">${(p.star.luminosity / SUN_LUMINOSITY).toFixed(4)} L\u2609</span>` : unk}</div>
<div class="prop"><span class="prop-label">Peak \u03BB:</span> ${hasSolar ? `<span class="prop-value">${p.star.peakWavelength.toFixed(0)} nm</span>` : unk}</div>
<div class="prop" style="margin-top:8px"><span class="prop-label">\u2500\u2500 Orbit \u2500\u2500</span></div>
<div class="prop"><span class="prop-label">Semi-major axis:</span> ${hasSolar ? `<span class="prop-value">${p.orbit.au.toFixed(3)} AU</span>` : unk}</div>
<div class="prop"><span class="prop-label">Eccentricity:</span> ${hasSolar ? `<span class="prop-value">${p.orbit.eccentricity.toFixed(3)}</span>` : unk}</div>
<div class="prop"><span class="prop-label">Orbital period:</span> ${hasSolar ? `<span class="prop-value">${p.orbit.periodDays.toFixed(1)} days</span>` : unk}</div>
<div class="prop" style="margin-top:8px"><span class="prop-label">\u2500\u2500 Planet \u2500\u2500</span></div>
<div class="prop"><span class="prop-label">Mass:</span> ${hasLidar ? `<span class="prop-value">${p.massFactor.toFixed(2)} M\u2295</span>` : unk}</div>
<div class="prop"><span class="prop-label">Radius:</span> ${hasLidar ? `<span class="prop-value">${(p.radius / EARTH_RADIUS).toFixed(2)} R\u2295</span>` : unk}</div>
<div class="prop"><span class="prop-label">Surface gravity:</span> ${hasLidar ? `<span class="prop-value">${p.surfaceGravity.toFixed(2)} m/s\u00B2 (${(p.surfaceGravity / 9.81).toFixed(2)} g)</span>` : unk}</div>
<div class="prop"><span class="prop-label">Escape velocity:</span> ${hasLidar ? `<span class="prop-value">${(p.escapeVelocity / 1000).toFixed(1)} km/s</span>` : unk}</div>
<div class="prop"><span class="prop-label">Rotation:</span> ${hasSolar ? `<span class="prop-value">${p.rotationPeriod.toFixed(1)} hours</span>` : unk}</div>
<div class="prop"><span class="prop-label">Axial tilt:</span> ${hasSolar ? `<span class="prop-value">${p.axialTilt.toFixed(1)}\u00B0</span>` : unk}</div>
<div class="prop" style="margin-top:8px"><span class="prop-label">\u2500\u2500 Atmosphere \u2500\u2500</span></div>
<div class="prop"><span class="prop-label">Pressure:</span> ${hasAtmo ? `<span class="prop-value">${p.atmosphere.pressure.toFixed(3)} atm (${(p.atmosphere.pressure * 101.325).toFixed(1)} kPa)</span>` : unk}</div>
<div class="prop"><span class="prop-label">Composition:</span> ${hasAtmo ? `<span class="prop-value">${comp}</span>` : unk}</div>
<div class="prop"><span class="prop-label">Greenhouse factor:</span> ${hasAtmo ? `<span class="prop-value">\u00D7${p.atmosphere.greenhouse.toFixed(2)}</span>` : unk}</div>
<div class="prop" style="margin-top:8px"><span class="prop-label">\u2500\u2500 Surface \u2500\u2500</span></div>
<div class="prop"><span class="prop-label">Temperature:</span> ${hasAtmo || hasIR ? `<span class="prop-value">${T.toFixed(1)}\u00B0C (${p.surfaceTemp.toFixed(1)} K)</span>` : unk}</div>
<div class="prop"><span class="prop-label">Radiation:</span> ${hasRad ? `<span class="prop-value">${p.surfaceRadiation.toFixed(3)} mSv/hr</span>` : unk}</div>
<div class="prop"><span class="prop-label">Magnetic field:</span> ${hasMag ? `<span class="prop-value">${p.magneticField.strength.toFixed(2)} \u03BCT</span>` : unk}</div>
`;
  },

  // Toggle radio tuner UI
  showRadioTuner(show) {
    const el = document.getElementById('radio-tuner');
    if (el) el.style.display = show ? 'block' : 'none';
  },

  updateRadioFreq() {
    const el = document.getElementById('radio-freq-display');
    if (el) el.textContent = state.radioFreq.toFixed(1) + ' MHz';
  }
};
