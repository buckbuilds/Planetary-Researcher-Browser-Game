// ═══════════════════════════════════════════════════════════════
// GAME: Main controller — actions, screen management, boot
// ═══════════════════════════════════════════════════════════════

const Game = {
  move(dx, dy) {
    if (state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    ps.x += dx; ps.y += dy;
    ps.timeHours += Equipment.moveTimeCost();
    ps.explored[ps.x + ',' + ps.y] = true;
    const tile = getTile(ps.x, ps.y);
    Events.emit('move', { x: ps.x, y: ps.y, tile });
    UI.printLocation();
    this.save();
  },

  wait() {
    if (state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    ps.timeHours += 1;
    UI.appendOutput(`<span class="dim">\u2014 One hour passes. \u2014</span>`);
    Events.emit('timePass', { hours: 1 });
    UI.updateHUD();
    this.save();
  },

  scan(type) {
    if (state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    const tile = getTile(ps.x, ps.y);
    ps.scanned[type] = true;
    Knowledge.recordTileScan(ps.x, ps.y, type);

    // Terrain-revealing instruments
    if (type === 'lidar') {
      const lr = Equipment.lidarRadius();
      for (let dy = -lr; dy <= lr; dy++) for (let dx = -lr; dx <= lr; dx++) {
        Knowledge.revealTerrain(ps.x + dx, ps.y + dy);
      }
    }
    if (type === 'spec') Knowledge.revealTerrain(ps.x, ps.y);

    // Special dispatch for radio
    if (type === 'radio') {
      UI.showRadioTuner(true);
    }

    // Get reading
    const reading = Instruments[type](tile);
    UI.showReadout(reading);
    const anomalyResult = Instruments.canRecordEvidence(type, tile)
      ? Anomalies.recordScanEvidence(type, tile)
      : null;
    if (anomalyResult && anomalyResult.newlyConfirmed) {
      UI.appendOutput(Anomalies.confirmationMessage(anomalyResult));
    }
    if (anomalyResult) {
      UI.renderAnomalies();
      Journal.renderStats();
    }

    // No auto-journal entries — player decides what to record

    ps.timeHours += 0.05;
    UI.updateHUD();
    UI.renderPlanetInfo();
    UI.renderMap();
    UI.renderAnomalies();
    this.save();
    Events.emit('scan', { type, tile, pos: `${ps.x},${ps.y}`, reading });
  },

  deployDrone() {
    if (state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    const radius = Equipment.droneRadius();
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const tx = ps.x + dx, ty = ps.y + dy;
      ps.explored[tx + ',' + ty] = true;
      Knowledge.revealTerrain(tx, ty);
    }

    let text = [];
    text.push(`<span class="accent">\u250C\u2500\u2500\u2500 DRONE AERIAL SURVEY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510</span>`);
    text.push(`<span class="accent">\u2502 Surveying ${(radius * 2 + 1)}\u00D7${(radius * 2 + 1)} area around (${ps.x}, ${ps.y})</span>`);
    text.push(`<span class="accent">\u2502</span>`);
    for (let dy = -radius; dy <= radius; dy++) {
      let row = `<span class="accent">\u2502 </span>`;
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = ps.x + dx, ty = ps.y + dy;
        const t = getTile(tx, ty);
        if (dx === 0 && dy === 0) row += `<span class="you">@</span>`;
        else row += `<span style="color:${BIOME_COLORS[t.biome]}">${BIOME_CHARS[t.biome]}</span>`;
      }
      text.push(row);
    }
    text.push(`<span class="accent">\u2502</span>`);
    text.push(`<span class="accent">\u2502 Legend: . plains  ^ mountain  ~ ocean  \u25B2 volcanic</span>`);
    text.push(`<span class="accent">\u2502         \u2744 ice  \u2663 forest  \u25CB cave  \u2591 desert  \u2248 marsh</span>`);
    text.push(`<span class="accent">\u2502 Terrain classified and mapped.</span>`);
    text.push(`<span class="accent">\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518</span>`);

    UI.showReadout(text.join('\n'));
    // No auto-journal entry

    ps.timeHours += 0.1;
    UI.updateHUD();
    UI.renderMap();
    Events.emit('droneDeployed', { center: { x: ps.x, y: ps.y }, radius });
    this.save();
  },

  catalog() { Catalog.add(); },

  observe() {
    if (state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    const tile = getTile(ps.x, ps.y);
    if (tile.fauna.length === 0) return;
    Knowledge.recordTileScan(ps.x, ps.y, 'observe');

    // Time-seeded RNG instead of Math.random()
    const r = systemRng(planet.seed, 'observe', ps.x * 1000 + ps.y, Math.floor(ps.timeHours * 10));
    const f = tile.fauna[Math.floor(r() * tile.fauna.length)];

    const behaviors = ['Resting motionless. Appears to be conserving energy.', 'Moving slowly across the terrain. Stops periodically to inspect the ground.', 'Feeding on nearby organic material. Uses repetitive motion to consume.', 'Two individuals interacting \u2014 appears to be a social greeting or territorial display.', 'Digging or burrowing into the substrate. May be searching for food or building a shelter.', 'Emitting low-frequency vibrations. Possibly communication or echolocation.', 'Basking in sunlight. Thermoregulation behavior likely.', 'Grooming itself meticulously. Possible parasite removal or social signaling.', 'Frozen in place. May have detected your presence. Camouflage response?', 'Following a repeated path between two points. Patrol behavior or foraging route.', 'Interacting with local flora \u2014 rubbing against it or consuming parts of it.', 'Partially submerged or burrowed. Only heat signature visible on IR.', 'Sleeping or dormant. Breathing rate is very slow. Metabolic conservation.', 'Vocalizing \u2014 short rhythmic calls. Possibly attracting a mate or marking territory.', 'A juvenile spotted nearby. This individual appears protective \u2014 parental behavior.'];
    const activities = ['Feeding patterns suggest herbivorous diet.', 'Movement speed: approximately ' + ((r() * 3 + 0.5).toFixed(1)) + ' m/min.', 'Body temperature estimated at ' + (r() * 20 + 270).toFixed(1) + ' K via IR.', 'Appears ' + (r() > 0.5 ? 'solitary' : 'social \u2014 stays within range of others') + '.', 'Active during ' + (r() > 0.5 ? 'daylight hours' : 'twilight periods') + '.', 'Estimated mass: ' + (r() * 50 + 0.5).toFixed(1) + ' kg based on stride and footprint depth.', 'Respiratory rate: ~' + (Math.floor(r() * 30) + 5) + ' cycles/min.', 'Skin/surface appears to ' + (r() > 0.7 ? 'absorb' : 'reflect') + ' significant IR radiation.', 'Shows ' + (r() > 0.5 ? 'awareness' : 'no awareness') + ' of observer presence at this distance.'];

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 FIELD OBSERVATION LOG \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Subject: ${f.name}`);
    lines.push(`\u2502 Location: (${ps.x}, ${ps.y}) \u2014 ${BIOME_NAMES[tile.biome]}`);
    lines.push(`\u2502 Time: ${formatTime()}`);
    lines.push(`\u2502`);
    const behavior = behaviors[Math.floor(r() * behaviors.length)];
    lines.push(`\u2502 <span style="color:var(--orange)">Observation (${Math.floor(r() * 20 + 10)} min from cover):</span>`);
    lines.push(`\u2502`);
    lines.push(`\u2502 ${behavior}`);
    lines.push(`\u2502`);
    lines.push(`\u2502 <span style="color:var(--text-dim)">Notes:</span>`);
    const a1 = activities[Math.floor(r() * activities.length)];
    const a2 = activities[Math.floor(r() * activities.length)];
    const a3 = activities[Math.floor(r() * activities.length)];
    lines.push(`\u2502 \u2022 ${a1}`);
    lines.push(`\u2502 \u2022 ${a2}`);
    lines.push(`\u2502 \u2022 ${a3}`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);

    UI.showReadout(lines.join('\n'));
    const anomalyResult = Anomalies.recordScanEvidence('observe', tile);
    if (anomalyResult && anomalyResult.newlyConfirmed) {
      UI.appendOutput(Anomalies.confirmationMessage(anomalyResult));
    }
    if (anomalyResult) {
      UI.renderAnomalies();
      UI.renderMap();
      Journal.renderStats();
    }
    // No auto-journal entry
    ps.timeHours += 0.3;
    UI.updateHUD();
    this.save();
  },

  // ═══════════════════════════════════════════════════════════════
  // RADIO TUNING
  // ═══════════════════════════════════════════════════════════════
  tuneRadio(delta) {
    state.radioFreq = Math.max(1, Math.min(999, state.radioFreq + delta));
    UI.updateRadioFreq();
    if (state.gameMode === 'surface') {
      const ps = getCurrentPlanetState();
      const tile = getTile(ps.x, ps.y);
      const reading = Instruments.radio(tile);
      UI.showReadout(reading);
    }
  },

  sendFleetReport() {
    if (state.gameMode !== 'surface') return;
    const ps = getCurrentPlanetState();
    if (!state.lastReading) {
      UI.appendOutput(`<span class="warn">No instrument data to transmit. Take a reading first.</span>`);
      return;
    }

    const r = systemRng(planet.seed, 'fleetreply', ps.x, Math.floor(ps.timeHours * 100));
    const acknowledgments = [
      'Received and logged. Much appreciated, expedition.',
      'Data packet confirmed. This fills a gap in our survey. Thank you.',
      'Excellent work. Relaying to the fleet cartography division now.',
      'Copy that. Your readings are consistent with our orbital estimates. Good work out there.',
      'Acknowledged. We\'ve updated the shared database. The fleet thanks you.',
      'Signal received, data integrity confirmed. Keep up the good work, researcher.',
      'Outstanding. This is exactly what we needed. Your contribution is noted in the fleet log.',
      'Transmission received. Cross-referencing with existing data now. Thank you for your diligence.',
    ];
    const ack = acknowledgments[Math.floor(r() * acknowledgments.length)];
    const sender = starSystem.fleetRequests && starSystem.fleetRequests.length > 0
      ? starSystem.fleetRequests[Math.floor(r() * starSystem.fleetRequests.length)].sender
      : 'Fleet Command';

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 TRANSMISSION SENT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Data packet transmitted on ${state.radioFreq.toFixed(1)} MHz`);
    lines.push(`\u2502 From: (${ps.x}, ${ps.y}) on ${planet.name}`);
    lines.push(`\u2502`);
    lines.push(`\u2502 <span style="color:var(--green)">\u2588\u2588 REPLY RECEIVED \u2588\u2588</span>`);
    lines.push(`\u2502`);
    lines.push(`\u2502 <span style="color:var(--accent3)">${sender}:</span>`);
    lines.push(`\u2502 <span style="color:var(--text-dim)">"${ack}"</span>`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    UI.showReadout(lines.join('\n'));
  },

  reportAnomaly(id) {
    if (state.gameMode !== 'surface') return;
    const progress = Anomalies.getProgress(id);
    if (!progress || progress.status !== 'confirmed') {
      UI.appendOutput(`<span class="warn">Fleet requires a confirmed anomaly packet before transmission.</span>`);
      return;
    }
    if (Anomalies.isReported(id)) {
      UI.appendOutput(`<span class="dim">This anomaly report is already logged with Fleet.</span>`);
      return;
    }

    Anomalies.markReported(id);
    UI.showReadout(Anomalies.reportMessage(progress));
    Equipment.award(Equipment.AWARDS.anomalyReport, `Anomaly ${progress.id} reported to Fleet`);
    UI.renderAnomalies();
    Journal.renderStats();
    UI.updateHUD();
    this.save();
  },


  // ═══════════════════════════════════════════════════════════════
  // SCREEN STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  returnToShip() {
    if (state.gameMode !== 'surface') return;
    // State is already in planetStates array — just switch mode
    state.gameMode = 'map';
    state.currentPlanetIndex = -1;
    planet = null;
    Screens.renderSystemMap();
    document.getElementById('btn-return-ship').style.display = 'none';
    this.save();
  },

  // System history for back/forward navigation
  _systemHistory: [],
  _systemHistoryIndex: -1,

  _pushSystemHistory(seed) {
    // If we're not at the end, trim forward history
    if (this._systemHistoryIndex < this._systemHistory.length - 1) {
      this._systemHistory = this._systemHistory.slice(0, this._systemHistoryIndex + 1);
    }
    this._systemHistory.push(seed);
    this._systemHistoryIndex = this._systemHistory.length - 1;
  },

  _navigateToSystem(seed) {
    starSystem = generateStarSystem(seed);
    state = initState(starSystem.planets.length);
    state.gameMode = 'map';
    const seedInput = document.getElementById('seed-input');
    if (seedInput) seedInput.value = seed;
    Screens.renderSystemMap();
    this.save();
  },

  prevSystem() {
    if (state.gameMode !== 'map') return;
    if (this._systemHistoryIndex <= 0) return;
    state.gameMode = 'travel';
    const targetIndex = this._systemHistoryIndex - 1;
    Screens.playGalaxyJump(() => {
      this._systemHistoryIndex = targetIndex;
      this._navigateToSystem(this._systemHistory[targetIndex]);
    });
  },

  nextSystem() {
    if (state.gameMode !== 'map') return;
    if (this._systemHistoryIndex >= this._systemHistory.length - 1) return;
    state.gameMode = 'travel';
    const targetIndex = this._systemHistoryIndex + 1;
    Screens.playGalaxyJump(() => {
      this._systemHistoryIndex = targetIndex;
      this._navigateToSystem(this._systemHistory[targetIndex]);
    });
  },

  launchTo(planetIndex) {
    if (state.gameMode !== 'map') return;
    state.gameMode = 'travel';
    this.save();

    Screens.playTravel(planetIndex, () => {
      state.gameMode = 'landing';
      const targetPlanet = starSystem.planets[planetIndex];

      Screens.playLanding(targetPlanet, () => {
        // Set up surface mode
        state.gameMode = 'surface';
        state.currentPlanetIndex = planetIndex;
        state.visitedPlanets[planetIndex] = true;
        planet = starSystem.planets[planetIndex];

        Screens.hide();
        document.getElementById('btn-return-ship').style.display = 'inline-block';

        const ps = getCurrentPlanetState();
        if (!ps.explored['0,0']) {
          // First visit to this planet
          ps.explored['0,0'] = true;
        }

        let landing = [];
        landing.push(`<span class="accent">\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550</span>`);
        landing.push(`<span class="accent">  PLANETARY EXPEDITION \u2014 FIELD COMPUTER</span>`);
        landing.push(`<span class="accent">\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550</span>`);
        landing.push('');
        landing.push(`Landing confirmed on <span class="location-name">${planet.name}</span>`);
        landing.push(`<span class="dim">Planet ${planetIndex + 1} of ${starSystem.planets.length} in system.</span>`);
        landing.push('');
        landing.push(`<span class="dim">Systems online. All instrument readings nominal.</span>`);
        landing.push(`<span class="dim">No preliminary survey data available \u2014 use your instruments to analyze this world.</span>`);
        landing.push('');
        landing.push(`<span class="dim">Use instruments to take readings. Move to explore.</span>`);
        landing.push(`<span class="dim">Arrow keys or WASD to move. Deploy drone for aerial survey.</span>`);
        landing.push(`<span class="dim">Write your own notes in the journal. Copy instrument readings with the clipboard button.</span>`);
        landing.push('');

        UI.setOutput(landing.join('\n'));

        setTimeout(() => {
          const tile = getTile(ps.x, ps.y);
          UI.appendOutput(UI.describeLocation(tile));
          UI.updateHUD();
          UI.renderMap();
          UI.renderPlanetInfo();
          UI.renderAnomalies();
          UI.renderEquipment();
          Catalog.render();
          Journal.render();
          Journal.renderStats();
          this.save();
        }, 100);
      });
    });
  },

  _resetSystemHistory(seed) {
    this._systemHistory = [seed];
    this._systemHistoryIndex = 0;
  },

  _resumeLoadedGame() {
    const seedInput = document.getElementById('seed-input');
    if (seedInput) seedInput.value = starSystem.seed;

    if (state.gameMode === 'surface' && state.currentPlanetIndex >= 0) {
      Screens.hide();
      document.getElementById('btn-return-ship').style.display = 'inline-block';
      UI.printLocation();
      UI.renderPlanetInfo();
      UI.renderAnomalies();
      UI.renderEquipment();
      Catalog.render();
      Journal.render();
      Journal.renderStats();
    } else {
      state.gameMode = 'map';
      state.currentPlanetIndex = -1;
      planet = null;
      Screens.renderSystemMap();
    }
  },

  showExpeditionLog() {
    Screens.renderExpeditionLog();
  },

  openExpedition(id) {
    if (!this.load(id)) return;
    this._resetSystemHistory(starSystem.seed);
    this._resumeLoadedGame();
  },

  newExpedition() {
    const seed = Math.random().toString(36).substr(2, 8);
    const defaultName = expeditionDefaultName(seed);
    const name = prompt('Name this expedition:', defaultName);
    if (name === null) return;
    this.startNewExpedition(seed, name.trim() || defaultName);
  },

  startNewExpedition(seed, name) {
    starSystem = generateStarSystem(seed);
    state = initState(starSystem.planets.length);
    state.gameMode = 'map';
    planet = null;
    activeExpeditionId = null;
    activeExpeditionId = createExpeditionSlot(seed, name || expeditionDefaultName(seed), serializeGame());
    this._resetSystemHistory(seed);
    Screens.renderSystemMap();
    this.save();
  },

  exportExpedition(id) {
    const expedition = getExpedition(id);
    if (!expedition) return;
    const payload = {
      type: 'planetary-expedition-save',
      version: 1,
      exportedAt: new Date().toISOString(),
      expedition: {
        name: expedition.name,
        createdAt: expedition.createdAt,
        updatedAt: expedition.updatedAt,
        data: expedition.data
      }
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (expedition.name || 'expedition').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    link.href = url;
    link.download = `${safeName || 'expedition'}-save.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  importExpedition() {
    const input = document.getElementById('expedition-import-file');
    if (input) input.click();
  },

  importExpeditionFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const saveData = normalizeSaveData(
          payload.expedition && payload.expedition.data
            ? payload.expedition.data
            : payload.data || payload
        );
        if (!saveData) throw new Error('Invalid save file');
        const name = payload.expedition && payload.expedition.name
          ? payload.expedition.name
          : expeditionDefaultName(saveData.seed);
        createExpeditionSlot(saveData.seed, name, saveData);
        Screens.renderExpeditionLog();
      } catch (e) {
        alert('That save file could not be imported.');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  },

  deleteExpedition(id) {
    const expedition = getExpedition(id);
    if (!expedition) return;
    if (!confirm(`Delete "${expedition.name}"? Export it first if you want a backup.`)) return;
    deleteExpeditionSlot(id);
    Screens.renderExpeditionLog();
  },

  // ═══════════════════════════════════════════════════════════════
  // SAVE / LOAD
  // ═══════════════════════════════════════════════════════════════
  save() { saveGame(); },

  load(id) { return loadGame(id); },

  loadSeed() {
    const seedInput = document.getElementById('seed-input');
    const seed = seedInput ? seedInput.value.trim() : '';
    if (!seed) return;
    this.startSystem(seed);
  },

  randomPlanet() {
    const seed = Math.random().toString(36).substr(2, 8);
    if (!state || state.gameMode !== 'map') {
      // First boot or non-map state — go directly
      this.startSystem(seed);
      return;
    }
    state.gameMode = 'travel';
    Screens.playGalaxyJump(() => {
      const seedInput = document.getElementById('seed-input');
      if (seedInput) seedInput.value = seed;
      starSystem = generateStarSystem(seed);
      state = initState(starSystem.planets.length);
      state.gameMode = 'map';
      this._pushSystemHistory(seed);
      Screens.renderSystemMap();
      this.save();
    });
  },

  randomPlanetInSystem() {
    if (!starSystem || !state || state.gameMode !== 'map') return;

    const planetIndexes = starSystem.planets
      .map((_, index) => index)
      .filter(index => index !== state.selectedPlanetIndex);
    const options = planetIndexes.length ? planetIndexes : [state.selectedPlanetIndex];
    const planetIndex = options[Math.floor(Math.random() * options.length)];

    Screens.selectPlanet(planetIndex);
  },

  // ═══════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════
  startSystem(seed) {
    starSystem = generateStarSystem(seed);
    state = initState(starSystem.planets.length);
    state.gameMode = 'map';
    const seedInput = document.getElementById('seed-input');
    if (seedInput) seedInput.value = seed;
    this._pushSystemHistory(seed);
    Screens.renderSystemMap();
    this.save();
  },

  boot() {
    loadExpeditionStore();
    Screens.renderExpeditionLog();
  }
};

// ═══════════════════════════════════════════════════════════════
// NO EVENT LISTENERS for auto-journal (all 10 removed)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// INPUT: Keyboard controls
// ═══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
  if (!starSystem) return;

  if (state.gameMode === 'map') {
    // System map controls
    switch (e.key) {
      case 'ArrowLeft': case 'a':
        state.selectedPlanetIndex = (state.selectedPlanetIndex - 1 + starSystem.planets.length) % starSystem.planets.length;
        Screens.renderSystemMap();
        e.preventDefault();
        break;
      case 'ArrowRight': case 'd':
        state.selectedPlanetIndex = (state.selectedPlanetIndex + 1) % starSystem.planets.length;
        Screens.renderSystemMap();
        e.preventDefault();
        break;
      case 'Enter':
        Game.launchTo(state.selectedPlanetIndex);
        e.preventDefault();
        break;
      case 'r': case 'R':
        Screens.scanOrToggle();
        e.preventDefault();
        break;
      case '[':
        Game.prevSystem();
        e.preventDefault();
        break;
      case ']':
        Game.nextSystem();
        e.preventDefault();
        break;
    }
  } else if (state.gameMode === 'surface') {
    // Surface exploration controls
    if (!planet) return;
    switch (e.key) {
      case 'ArrowUp': case 'w': Game.move(0, -1); e.preventDefault(); break;
      case 'ArrowDown': case 's': Game.move(0, 1); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': Game.move(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': Game.move(1, 0); e.preventDefault(); break;
      case 'c': Game.catalog(); e.preventDefault(); break;
      case 'r': case 'R':
        Game.scan('radio');
        e.preventDefault();
        break;
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// BOOT on page load
// ═══════════════════════════════════════════════════════════════
Game.boot();
