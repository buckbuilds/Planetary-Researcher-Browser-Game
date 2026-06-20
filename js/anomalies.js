// ═══════════════════════════════════════════════════════════════
// ANOMALIES: Generation, evidence, confirmation, and reporting
// ═══════════════════════════════════════════════════════════════

const Anomalies = {
  TYPES: {
    thermal: {
      code: 'THM',
      label: 'Thermal Bloom',
      evidence: ['ir', 'spec', 'radar']
    },
    magnetic: {
      code: 'MAG',
      label: 'Magnetic Shear',
      evidence: ['mag', 'rad', 'seismo']
    },
    radio: {
      code: 'RAD',
      label: 'Narrowband Echo',
      evidence: ['radio', 'star', 'mag']
    },
    subsurface: {
      code: 'SUB',
      label: 'Subsurface Void',
      evidence: ['radar', 'lidar', 'seismo']
    },
    biological: {
      code: 'BIO',
      label: 'Biogenic Trace',
      evidence: ['ir', 'spec', 'observe']
    },
    weather: {
      code: 'WX',
      label: 'Stationary Weather Cell',
      evidence: ['atmo', 'solar', 'rad']
    },
    seismic: {
      code: 'SEI',
      label: 'Seismic Resonance',
      evidence: ['seismo', 'radar', 'lidar']
    }
  },

  getPlanetProgress() {
    const ps = getCurrentPlanetState();
    if (!ps) return null;
    if (!ps.anomalies) ps.anomalies = {};
    if (!ps.anomalyEvidence) ps.anomalyEvidence = {};
    if (!ps.reportedAnomalies) ps.reportedAnomalies = {};
    return ps;
  },

  getProgress(id) {
    const ps = this.getPlanetProgress();
    if (!ps || !id) return null;
    return ps.anomalies[id] || null;
  },

  listProgress() {
    const ps = this.getPlanetProgress();
    if (!ps) return [];
    return Object.values(ps.anomalies);
  },

  upsertProgress(id, data) {
    const ps = this.getPlanetProgress();
    if (!ps || !id) return null;
    const existing = ps.anomalies[id] || {};
    ps.anomalies[id] = {
      ...existing,
      ...data,
      id
    };
    return ps.anomalies[id];
  },

  getEvidence(id) {
    const ps = this.getPlanetProgress();
    if (!ps || !id) return {};
    return ps.anomalyEvidence[id] || {};
  },

  recordEvidence(id, type, details) {
    const ps = this.getPlanetProgress();
    if (!ps || !id || !type) return null;
    if (!ps.anomalyEvidence[id]) ps.anomalyEvidence[id] = {};
    if (ps.anomalyEvidence[id][type]) {
      return {
        ...ps.anomalyEvidence[id][type],
        repeated: true
      };
    }
    ps.anomalyEvidence[id][type] = {
      type,
      recordedAt: formatTime(),
      ...(details || {})
    };
    return ps.anomalyEvidence[id][type];
  },

  isConfirmed(id) {
    const progress = this.getProgress(id);
    return !!(progress && progress.status === 'confirmed');
  },

  isReported(id) {
    const ps = this.getPlanetProgress();
    return !!(ps && ps.reportedAnomalies[id]);
  },

  markReported(id) {
    const ps = this.getPlanetProgress();
    if (!ps || !id) return null;
    ps.reportedAnomalies[id] = {
      reportedAt: formatTime()
    };
    return ps.reportedAnomalies[id];
  },

  getTypeDef(type) {
    return this.TYPES[type] || { code: 'UNK', label: 'Unclassified Signature', evidence: [] };
  },

  escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  statusFor(progress) {
    if (!progress) return 'suspected';
    if (this.isReported(progress.id)) return 'reported';
    return progress.status || 'suspected';
  },

  firstEvidence(progress) {
    const evidence = this.getEvidence(progress.id);
    const firstKey = Object.keys(evidence)[0];
    return firstKey ? evidence[firstKey] : null;
  },

  locationText(progress) {
    if (!progress) return 'location unknown';
    if (progress.status === 'confirmed') return `confirmed at (${progress.x}, ${progress.y})`;
    const first = this.firstEvidence(progress);
    if (!first) return 'location unresolved';
    if (first.exact) return `centered near (${first.x}, ${first.y})`;
    return `signal edge near (${first.x}, ${first.y})`;
  },

  summaryText(progress) {
    const site = planet ? this.getSiteById(planet, progress.id) : null;
    const f = site ? site.flavor : {};
    const summaries = {
      thermal: `Heat model departs by roughly ${f.tempDelta ? f.tempDelta.toFixed(1) : '??'} K without a matching terrain source.`,
      magnetic: `Local vector drift repeats against the expected dipole field.`,
      radio: `A narrow periodic carrier remains after ordinary static is removed.`,
      subsurface: `Subsurface returns suggest an organized reflector below the mapped layer.`,
      biological: `Organic-like modulation is present without a catalogued organism profile.`,
      weather: `A fixed atmospheric disturbance resists the local wind pattern.`,
      seismic: `Microtremor phase repeats in a way the surface model cannot explain.`
    };
    return summaries[progress.type] || 'The collected readings no longer match the local environmental model.';
  },

  evidenceLabel(type) {
    const labels = {
      atmo: 'ATMO',
      rad: 'RAD',
      star: 'STAR',
      solar: 'SOLAR',
      mag: 'MAG',
      lidar: 'LIDAR',
      radar: 'RADAR',
      ir: 'IR',
      spec: 'SPEC',
      seismo: 'SEIS',
      radio: 'RADIO',
      observe: 'OBS'
    };
    return labels[type] || String(type).toUpperCase();
  },

  renderList() {
    const items = this.listProgress().sort((a, b) => {
      const statusOrder = { confirmed: 0, suspected: 1 };
      return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2)
        || (a.discoveredAt || '').localeCompare(b.discoveredAt || '')
        || a.id.localeCompare(b.id);
    });
    if (items.length === 0) {
      return '<span class="dim">No anomalous signatures logged.</span>';
    }
    return items.map(progress => this.renderEntry(progress)).join('');
  },

  renderEntry(progress) {
    const def = this.getTypeDef(progress.type);
    const status = this.statusFor(progress);
    const evidence = this.getEvidence(progress.id);
    const required = progress.requiredEvidence || def.evidence || [];
    const name = progress.status === 'confirmed'
      ? progress.name
      : `${def.code} signature`;
    const tags = required.map(type => {
      const done = !!evidence[type];
      return `<span class="a-tag ${done ? 'done' : 'missing'}">${this.evidenceLabel(type)}</span>`;
    }).join('');
    const action = progress.status === 'confirmed' && !this.isReported(progress.id)
      ? `<button onclick="Game.reportAnomaly('${this.escapeHtml(progress.id)}')">Transmit to Fleet</button>`
      : '';
    const reported = this.isReported(progress.id)
      ? '<span class="dim">Fleet report logged.</span>'
      : '';

    return `<div class="a-entry">
      <div class="a-head">
        <div>
          <div class="a-name">${this.escapeHtml(name)}</div>
          <div class="a-meta">${this.escapeHtml(def.label)} · ${this.escapeHtml(this.locationText(progress))}</div>
        </div>
        <span class="a-status ${status}">${status}</span>
      </div>
      <div class="a-desc">${this.escapeHtml(this.summaryText(progress))}</div>
      <div class="a-evidence">${tags}</div>
      <div class="a-actions">${action}${reported}</div>
    </div>`;
  },

  confirmedCount() {
    return this.listProgress().filter(a => a.status === 'confirmed').length;
  },

  suspectedCount() {
    return this.listProgress().filter(a => a.status === 'suspected').length;
  },

  getCollectedEvidence(id) {
    return Object.keys(this.getEvidence(id));
  },

  hasRequiredEvidence(site) {
    const evidence = this.getEvidence(site.id);
    return site.requiredEvidence.every(type => !!evidence[type]);
  },

  recordScanEvidence(type, tile) {
    const ps = getCurrentPlanetState();
    if (!ps || !planet || !type) return null;

    const matches = this.findNearby(ps.x, ps.y, { instrument: type });
    const match = matches.find(m => m.relevant);
    if (!match) return null;

    const site = match.site;
    const existingProgress = this.getProgress(site.id);
    const alreadyConfirmed = existingProgress && existingProgress.status === 'confirmed';
    const now = formatTime();

    if (!existingProgress) {
      this.upsertProgress(site.id, {
        id: site.id,
        type: site.type,
        code: site.code,
        name: site.name,
        x: site.x,
        y: site.y,
        status: 'suspected',
        discoveredAt: now,
        confirmedAt: null,
        requiredEvidence: [...site.requiredEvidence]
      });
    }

    const evidence = this.recordEvidence(site.id, type, {
      x: ps.x,
      y: ps.y,
      siteX: site.x,
      siteY: site.y,
      distance: match.distance,
      distanceBand: match.distanceBand,
      exact: match.exact,
      anomalyType: site.type
    });
    const repeated = !!(evidence && evidence.repeated);
    const collectedEvidence = this.getCollectedEvidence(site.id);

    let progress = this.upsertProgress(site.id, {
      lastEvidenceAt: now,
      collectedEvidence
    });

    let newlyConfirmed = false;
    if (!alreadyConfirmed && this.hasRequiredEvidence(site)) {
      progress = this.upsertProgress(site.id, {
        status: 'confirmed',
        confirmedAt: now,
        collectedEvidence: this.getCollectedEvidence(site.id)
      });
      newlyConfirmed = true;
    }

    return {
      match,
      site,
      progress,
      evidence,
      repeated,
      newlySuspected: !existingProgress,
      newlyConfirmed
    };
  },

  confirmationMessage(result) {
    if (!result || !result.progress) return '';
    const p = result.progress;
    const evidence = (p.collectedEvidence || []).map(e => e.toUpperCase()).join(', ');
    let lines = [];
    lines.push(`<span class="accent">\u250C\u2500\u2500\u2500 ANOMALY CONFIRMED \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510</span>`);
    lines.push(`<span class="accent">\u2502 ${p.name}</span>`);
    lines.push(`<span class="accent">\u2502 Location: (${p.x}, ${p.y})</span>`);
    lines.push(`<span class="accent">\u2502 Evidence: ${evidence}</span>`);
    lines.push(`<span class="accent">\u2502 Classification logged. Further notes remain manual.</span>`);
    lines.push(`<span class="accent">\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518</span>`);
    return lines.join('\n');
  },

  reportMessage(progress) {
    if (!progress) return '';
    const def = this.getTypeDef(progress.type);
    const ps = getCurrentPlanetState();
    const r = systemRng(planet.seed, `anomaly-report:${progress.id}`, progress.x, progress.y);
    const sender = starSystem.fleetRequests && starSystem.fleetRequests.length > 0
      ? starSystem.fleetRequests[Math.floor(r() * starSystem.fleetRequests.length)].sender
      : 'Fleet Science Desk';
    const responses = {
      thermal: 'That thermal bloom is not following any volcanic profile in our archive. Keep it marked for return survey.',
      magnetic: 'Confirmed magnetic shear received. Navigation will want that correction before the next descent window.',
      radio: 'Narrowband echo confirmed. We are assigning a listening array before the signal drifts again.',
      subsurface: 'Subsurface void confirmed. Structural team is already asking for a second-pass transect.',
      biological: 'Biogenic trace confirmed. That one goes straight to xenobiology. Careful work down there.',
      weather: 'Stationary weather cell confirmed. Atmospheric group says the fixed position is the interesting part.',
      seismic: 'Seismic resonance confirmed. The repetition is too clean to dismiss as local settling.'
    };

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 ANOMALY REPORT ACCEPTED \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Field ID: ${progress.name}`);
    lines.push(`\u2502 Classification: ${def.label}`);
    lines.push(`\u2502 Location: (${progress.x}, ${progress.y}) on ${planet.name}`);
    lines.push(`\u2502 From: ${ps ? `(${ps.x}, ${ps.y})` : 'surface station'}`);
    lines.push(`\u2502`);
    lines.push(`\u2502 <span style="color:var(--green)">\u2588\u2588 FLEET ACKNOWLEDGEMENT \u2588\u2588</span>`);
    lines.push(`\u2502 <span style="color:var(--accent3)">${sender}:</span>`);
    lines.push(`\u2502 <span style="color:var(--text-dim)">"${responses[progress.type] || 'Confirmed anomaly packet received. This is a useful departure from baseline.'}"</span>`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return lines.join('\n');
  },

  getAvailableTypes(targetPlanet) {
    if (!targetPlanet) return [];
    const types = ['thermal', 'magnetic', 'radio', 'subsurface', 'seismic'];
    if (targetPlanet.hasLife) types.push('biological');
    if (targetPlanet.atmosphere && targetPlanet.atmosphere.pressure > 0.05) types.push('weather');
    return types;
  },

  getSiteCount(targetPlanet, r) {
    if (!targetPlanet) return 0;
    const barren =
      !targetPlanet.hasLiquidWater &&
      !targetPlanet.hasLife &&
      (!targetPlanet.atmosphere || targetPlanet.atmosphere.pressure < 0.05) &&
      targetPlanet.massFactor < 0.35;

    if (barren && r() < 0.35) return 0;
    if (barren && r() < 0.55) return 1;
    return Math.floor(lerp(1, 4, r()));
  },

  makeFieldId(targetPlanet, type, index, x, y) {
    const def = this.TYPES[type];
    const n = hashStr(`${targetPlanet.seed}:anomaly:${type}:${index}:${x}:${y}`) % 1000;
    return `${def.code}-${String(n).padStart(3, '0')}`;
  },

  makeFlavor(targetPlanet, type, r) {
    const intensity = lerp(0.35, 0.98, r());
    const phase = Math.floor(lerp(2, 12, r()));
    const depth = Math.floor(lerp(4, 80, r()));
    const frequency = lerp(18, 820, r());
    const drift = lerp(0.2, 7.5, r());
    const tempDelta = lerp(8, 140, r());
    const mineralKeys = Object.keys(targetPlanet.minerals || {});
    const mineral = mineralKeys[Math.floor(r() * mineralKeys.length)] || 'Iron';

    return {
      intensity,
      phase,
      depth,
      frequency,
      drift,
      tempDelta,
      mineral,
      signature: hashStr(`${targetPlanet.seed}:${type}:${intensity.toFixed(3)}`).toString(16).slice(0, 6).toUpperCase()
    };
  },

  makeSite(targetPlanet, type, index, r, usedCoords) {
    let x = 0, y = 0, key = '0,0';
    for (let tries = 0; tries < 24; tries++) {
      x = Math.floor(lerp(-12, 13, r()));
      y = Math.floor(lerp(-12, 13, r()));
      key = `${x},${y}`;
      if (key !== '0,0' && !usedCoords[key]) break;
    }
    usedCoords[key] = true;

    const def = this.TYPES[type];
    const id = this.makeFieldId(targetPlanet, type, index, x, y);
    return {
      id,
      type,
      code: def.code,
      name: `${id} ${def.label}`,
      x,
      y,
      requiredEvidence: [...def.evidence],
      flavor: this.makeFlavor(targetPlanet, type, r)
    };
  },

  getSitesForPlanet(targetPlanet) {
    if (!targetPlanet) return [];
    if (targetPlanet._anomalySites) return targetPlanet._anomalySites;

    const r = seedRng(hashStr(`${targetPlanet.seed}:anomaly-sites`));
    const availableTypes = this.getAvailableTypes(targetPlanet);
    const count = Math.min(3, this.getSiteCount(targetPlanet, r), availableTypes.length);
    const usedTypes = {};
    const usedCoords = {};
    const sites = [];

    for (let i = 0; i < count; i++) {
      let type = availableTypes[Math.floor(r() * availableTypes.length)];
      for (let tries = 0; tries < availableTypes.length && usedTypes[type]; tries++) {
        type = availableTypes[(availableTypes.indexOf(type) + 1) % availableTypes.length];
      }
      usedTypes[type] = true;
      sites.push(this.makeSite(targetPlanet, type, i, r, usedCoords));
    }

    targetPlanet._anomalySites = sites;
    return sites;
  },

  getSiteById(targetPlanet, id) {
    if (!targetPlanet || !id) return null;
    return this.getSitesForPlanet(targetPlanet).find(site => site.id === id) || null;
  },

  getSiteAt(targetPlanet, x, y) {
    if (!targetPlanet) return null;
    return this.getSitesForPlanet(targetPlanet).find(site => site.x === x && site.y === y) || null;
  },

  distanceTo(site, x, y) {
    if (!site) return Infinity;
    const dx = site.x - x;
    const dy = site.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  gridDistanceTo(site, x, y) {
    if (!site) return Infinity;
    return Math.max(Math.abs(site.x - x), Math.abs(site.y - y));
  },

  getDistanceBand(distance) {
    if (distance === 0) return 'exact';
    if (distance <= 1) return 'adjacent';
    if (distance <= 2) return 'nearby';
    return 'distant';
  },

  isRelevantInstrument(site, instrument) {
    if (!site || !instrument) return false;
    return site.requiredEvidence.includes(instrument);
  },

  describeProximity(site, x, y, instrument) {
    const distance = this.gridDistanceTo(site, x, y);
    const progress = this.getProgress(site.id);
    const evidence = this.getEvidence(site.id);
    return {
      site,
      id: site.id,
      type: site.type,
      x: site.x,
      y: site.y,
      distance,
      distanceBand: this.getDistanceBand(distance),
      exact: distance === 0,
      relevant: this.isRelevantInstrument(site, instrument),
      suspected: !!progress,
      confirmed: !!(progress && progress.status === 'confirmed'),
      reported: this.isReported(site.id),
      evidence,
      collectedEvidence: Object.keys(evidence),
      requiredEvidence: [...site.requiredEvidence]
    };
  },

  findNearby(x, y, options) {
    const opts = options || {};
    const targetPlanet = opts.planet || planet;
    const radius = opts.radius === undefined ? 2 : opts.radius;
    const instrument = opts.instrument || opts.type || null;
    const includeDistant = !!opts.includeDistant;
    const sites = this.getSitesForPlanet(targetPlanet);

    return sites
      .map(site => this.describeProximity(site, x, y, instrument))
      .filter(match => includeDistant || match.distance <= radius || match.exact)
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  },

  typeHint(match) {
    const f = match.site.flavor;
    const exact = match.exact;
    const hints = {
      thermal: exact
        ? `Unexplained thermal gradient persists at scan center (+${f.tempDelta.toFixed(1)} K equivalent).`
        : `A faint heat imbalance is bleeding into this reading from nearby terrain.`,
      magnetic: exact
        ? `Field vector drifts ${f.drift.toFixed(1)}° from the local dipole model.`
        : `Minor compass disagreement detected at the edge of the sensor envelope.`,
      radio: exact
        ? `Repeating carrier fragment present near ${f.frequency.toFixed(1)} MHz.`
        : `Weak periodic radio structure rises above background static nearby.`,
      subsurface: exact
        ? `Density return shows a coherent reflector at approximately ${f.depth}m depth.`
        : `Subsurface echoes show a shallow phase mismatch near the scan area.`,
      biological: exact
        ? `Metabolism-like modulation detected without matching catalogued organism profile.`
        : `Low-confidence organic rhythm detected near the edge of instrument range.`,
      weather: exact
        ? `Pressure and electrical variation remain fixed against local wind flow.`
        : `Atmospheric readings suggest a stationary disturbance nearby.`,
      seismic: exact
        ? `Repeating microtremor phase locks every ${f.phase} cycles.`
        : `Faint ground resonance repeats below local noise threshold.`
    };
    return hints[match.type] || 'Instrument residuals do not match the local environmental model.';
  },

  nonResolvingHint(match) {
    const hints = {
      thermal: 'Current channel sees secondary heat scatter only; thermal or material scans may resolve it.',
      magnetic: 'Current channel cannot resolve the field drift; magnetic/radiation correlation may help.',
      radio: 'Current channel catches only timing noise; radio and sky-reference data may resolve it.',
      subsurface: 'Current channel sees surface effects only; terrain or subsurface scans may help.',
      biological: 'Current channel cannot separate organic signal from background; bio-sensitive scans may help.',
      weather: 'Current channel sees a secondary disturbance; atmosphere and solar context may help.',
      seismic: 'Current channel cannot resolve the repeating vibration; ground-coupled scans may help.'
    };
    return hints[match.type] || 'Current instrument is not resolving the source of the residual.';
  },

  getScanAnnotation(type, tile) {
    const ps = getCurrentPlanetState();
    if (!ps || !planet) return [];

    const matches = this.findNearby(ps.x, ps.y, { instrument: type });
    if (matches.length === 0) return [];

    const relevant = matches.find(m => m.relevant);
    const match = relevant || matches[0];
    const label = match.exact ? 'ANOMALOUS RESIDUAL' : 'WEAK ANOMALOUS RESIDUAL';
    const lines = [];
    lines.push(`\u2502`);
    lines.push(`\u2502 \u25C7 ${label}: ${this.typeHint(match)}`);
    if (!match.relevant) {
      lines.push(`\u2502   ${this.nonResolvingHint(match)}`);
    } else if (!match.exact) {
      lines.push(`\u2502   Signal strength is low; closer readings may improve confidence.`);
    }
    return lines;
  }
};
