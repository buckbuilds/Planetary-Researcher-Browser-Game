// ═══════════════════════════════════════════════════════════════
// EQUIPMENT: Fleet Requisition Points and field equipment upgrades
// Earn RP by reporting anomalies, cataloguing new species, and
// classifying new biomes. Spend RP to requisition Mk II equipment.
// Equipment belongs to the researcher: it applies expedition-wide.
// ═══════════════════════════════════════════════════════════════

const Equipment = {
  AWARDS: {
    anomalyReport: 3,
    newSpecies: 1,
    newBiome: 1
  },

  CATALOG: [
    {
      id: 'drone',
      name: 'Survey Drone — High-Density Battery',
      cost: 6,
      effect: 'Aerial survey radius 3 → 5. One flight maps an 11×11 area.',
      flavor: 'Extended cell pack rated for low-temperature flight.'
    },
    {
      id: 'lidar',
      name: 'LIDAR — Long-Range Optics',
      cost: 5,
      effect: 'Terrain classification radius 2 → 4 per sweep.',
      flavor: 'Higher pulse energy and a wider receiver aperture.'
    },
    {
      id: 'star',
      name: 'Star Tracker — Adaptive Optics',
      cost: 5,
      effect: 'Holds stellar lock through storms, fog, and precipitation. Daylight is still too bright — physics wins.',
      flavor: 'Deformable mirror corrects atmospheric distortion in real time.'
    },
    {
      id: 'radio',
      name: 'Radio — Digital Noise Filter',
      cost: 4,
      effect: 'Suppresses atmospheric static on the waterfall display. Weak signals stand out.',
      flavor: 'Adaptive band-stop filtering, −18 dB noise floor.'
    },
    {
      id: 'spec',
      name: 'Spectrometer — High-Gain Detector',
      cost: 5,
      effect: 'Resolves trace emission lines below 5% abundance.',
      flavor: 'Cooled sensor array with photon-counting readout.'
    },
    {
      id: 'suit',
      name: 'Suit — Mobility Servos',
      cost: 6,
      effect: 'Surface travel takes 3 minutes per move instead of 6. More ground per day.',
      flavor: 'Powered joint assistance tuned to local gravity.'
    }
  ],

  // ── State access ───────────────────────────────────────────────
  ensureState() {
    if (!state) return null;
    if (!state.equipment) state.equipment = {};
    if (!state.requisition) state.requisition = { points: 0, totalEarned: 0, log: [] };
    if (!Array.isArray(state.requisition.log)) state.requisition.log = [];
    return state.requisition;
  },

  points() {
    const req = this.ensureState();
    return req ? req.points : 0;
  },

  isUpgraded(id) {
    return !!(state && state.equipment && state.equipment[id]);
  },

  getItem(id) {
    return this.CATALOG.find(item => item.id === id) || null;
  },

  // ── Effect helpers (read by game.js / instruments.js) ──────────
  droneRadius() { return this.isUpgraded('drone') ? 5 : 3; },
  lidarRadius() { return this.isUpgraded('lidar') ? 4 : 2; },
  moveTimeCost() { return this.isUpgraded('suit') ? 0.05 : 0.1; },
  hasAdaptiveOptics() { return this.isUpgraded('star'); },
  hasRadioFilter() { return this.isUpgraded('radio'); },
  hasHighGainSpec() { return this.isUpgraded('spec'); },

  // ── Earning ────────────────────────────────────────────────────
  award(points, reason) {
    const req = this.ensureState();
    if (!req || points <= 0) return;
    req.points += points;
    req.totalEarned += points;
    req.log.unshift({ points, reason, time: typeof formatTime === 'function' && planet ? formatTime() : '' });
    if (req.log.length > 12) req.log.length = 12;
    UI.appendOutput(`<span style="color:var(--green)">▸ Fleet Requisition: +${points} RP — ${reason}. Balance: ${req.points} RP.</span>`);
    UI.renderEquipment();
  },

  // ── Spending ───────────────────────────────────────────────────
  purchase(id) {
    const req = this.ensureState();
    const item = this.getItem(id);
    if (!req || !item) return;
    if (this.isUpgraded(id)) {
      UI.appendOutput(`<span class="dim">${item.name} is already Mk II.</span>`);
      return;
    }
    if (req.points < item.cost) {
      UI.appendOutput(`<span class="warn">Fleet requisition denied — ${item.cost} RP required, balance is ${req.points} RP.</span>`);
      return;
    }
    req.points -= item.cost;
    state.equipment[id] = 2;

    let lines = [];
    lines.push(`┌─── FLEET REQUISITION APPROVED ──────────┐`);
    lines.push(`│ ${item.name}`);
    lines.push(`│ Mk I → <span style="color:var(--green)">Mk II</span>`);
    lines.push(`│`);
    lines.push(`│ <span style="color:var(--text-dim)">"${item.flavor}"</span>`);
    lines.push(`│`);
    lines.push(`│ Supply drop confirmed. Equipment installed`);
    lines.push(`│ and calibrated. ${item.effect}`);
    lines.push(`│`);
    lines.push(`│ Remaining balance: ${req.points} RP`);
    lines.push(`└───────────────────────────────────────┘`);
    UI.showReadout(lines.join('\n'));
    UI.renderEquipment();
    UI.updateHUD();
    saveGame();
  },

  // ── Rendering (Equipment tab) ──────────────────────────────────
  renderList() {
    const req = this.ensureState();
    if (!req) return '<span class="dim">Start an expedition to access Fleet requisitions.</span>';

    let html = '';
    html += `<div style="padding:4px 0 8px 0"><span class="section-title">FLEET REQUISITION</span>`;
    html += `<div style="font-size:16px;color:var(--green);font-weight:700">${req.points} RP</div>`;
    html += `<div class="dim" style="margin-top:4px">Fleet grants Requisition Points for field science:</div>`;
    html += `<div class="dim">• Anomaly reported to Fleet: +${this.AWARDS.anomalyReport} RP</div>`;
    html += `<div class="dim">• New species catalogued: +${this.AWARDS.newSpecies} RP</div>`;
    html += `<div class="dim">• New biome classified: +${this.AWARDS.newBiome} RP</div></div>`;

    html += this.CATALOG.map(item => {
      const owned = this.isUpgraded(item.id);
      const affordable = req.points >= item.cost;
      let action;
      if (owned) {
        action = `<span style="color:var(--green);font-weight:700">✓ Mk II DELIVERED</span>`;
      } else {
        action = `<button onclick="Equipment.purchase('${item.id}')" ${affordable ? '' : 'disabled'} style="font-size:11px;padding:3px 8px${affordable ? '' : ';opacity:.45'}">Requisition — ${item.cost} RP</button>`;
      }
      return `<div class="entry">
        <span class="entry-name">${item.name}</span> <span class="entry-type">${owned ? 'Mk II' : 'Mk I'}</span><br>
        <div class="dim" style="margin:3px 0">${item.effect}</div>
        <div style="margin-top:4px">${action}</div>
      </div>`;
    }).join('');

    if (req.log.length > 0) {
      html += `<div style="margin-top:8px"><span class="section-title">RECENT GRANTS</span>`;
      html += req.log.map(entry =>
        `<div class="dim" style="font-size:11px">+${entry.points} RP — ${entry.reason}${entry.time ? ' — ' + entry.time : ''}</div>`
      ).join('');
      html += `</div>`;
    }
    return html;
  }
};

// ── Earning hooks: discovery events already emitted by the game ──
Events.on('speciesFound', data => {
  if (!state || !data || !data.species) return;
  Equipment.award(Equipment.AWARDS.newSpecies, `New species catalogued: ${data.species.name}`);
});

Events.on('newBiome', data => {
  if (!state || !data || !data.biome) return;
  const biomeName = (typeof BIOME_NAMES !== 'undefined' && BIOME_NAMES[data.biome]) ? BIOME_NAMES[data.biome] : data.biome;
  Equipment.award(Equipment.AWARDS.newBiome, `New biome classified: ${biomeName}`);
});

// ═══════════════════════════════════════════════════════════════
// FLEET REQUESTS: Fleet Comms objectives that actually pay.
// Collect the requested data (right instrument, right place), then
// transmit with Send Report to receive the RP reward.
// ═══════════════════════════════════════════════════════════════
const FleetRequests = {
  list() {
    return (typeof starSystem !== 'undefined' && starSystem && starSystem.fleetRequests) || [];
  },

  progress(id) {
    if (!state.fleetRequestProgress) state.fleetRequestProgress = {};
    if (!state.fleetRequestProgress[id]) state.fleetRequestProgress[id] = { collected: false, paid: false };
    return state.fleetRequestProgress[id];
  },

  status(req) {
    const p = this.progress(req.id);
    return p.paid ? 'paid' : p.collected ? 'ready' : 'open';
  },

  // Called after each successful surface scan.
  recordScan(type, tile) {
    if (!state || !planet) return;
    this.list().forEach(req => {
      if (req.instrument !== type) return;
      const p = this.progress(req.id);
      if (p.collected || p.paid) return;
      if (req.planetName && req.planetName !== planet.name) return;
      if (req.biome && tile.biome !== req.biome) return;
      // Star tracker data only counts if the sky actually allowed a lock.
      if (type === 'star' && !Instruments.canRecordEvidence('star', tile)) return;
      p.collected = true;
      UI.appendOutput(`<span style="color:var(--orange)">📡 Fleet request fulfilled — this is the data ${req.sender} asked for. Send Report to transmit it (+${req.reward} RP).</span>`);
    });
  },

  // Called from Send Report: pays out everything collected and unpaid.
  payCollected() {
    const paid = [];
    this.list().forEach(req => {
      const p = this.progress(req.id);
      if (p.collected && !p.paid) {
        p.paid = true;
        Equipment.award(req.reward, `Fleet request completed — ${req.sender}`);
        paid.push(req);
      }
    });
    return paid;
  }
};
