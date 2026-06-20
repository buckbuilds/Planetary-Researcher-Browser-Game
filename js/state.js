// ═══════════════════════════════════════════════════════════════
// STATE: Globals, init, Knowledge, save/load
// ═══════════════════════════════════════════════════════════════

let starSystem = null;
let planet = null;  // alias for current planet: starSystem.planets[state.currentPlanetIndex]
let state = null;

function initPlanetState() {
  return {
    x: 0, y: 0, underground: false, timeHours: 8.0,
    explored: {},
    terrainKnown: {},
    scanned: {},
    tileScans: {},
    catalog: [],
    anomalies: {},
    anomalyEvidence: {},
    reportedAnomalies: {},
    biomesFound: {},
    tileCache: {}
  };
}

function normalizePlanetState(ps) {
  if (!ps.explored) ps.explored = {};
  if (!ps.terrainKnown) ps.terrainKnown = {};
  if (!ps.scanned) ps.scanned = {};
  if (!ps.tileScans) ps.tileScans = {};
  if (!ps.catalog) ps.catalog = [];
  if (!ps.anomalies) ps.anomalies = {};
  if (!ps.anomalyEvidence) ps.anomalyEvidence = {};
  if (!ps.reportedAnomalies) ps.reportedAnomalies = {};
  if (!ps.biomesFound) ps.biomesFound = {};
  ps.tileCache = {};
  delete ps.journal;
  return ps;
}

function initState(planetCount) {
  const planetStates = [];
  for (let i = 0; i < planetCount; i++) {
    planetStates.push(initPlanetState());
  }
  return {
    gameMode: 'map',
    currentPlanetIndex: -1,
    selectedPlanetIndex: 0,
    visitedPlanets: {},
    planetStates: planetStates,
    radioFreq: 145.0,
    lastReading: '',
    journal: [],
    saveVersion: 2
  };
}

// Get the working state for the current planet
function getCurrentPlanetState() {
  if (!state) return null;
  if (state.currentPlanetIndex < 0) return null;
  return state.planetStates[state.currentPlanetIndex];
}

// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE: What does the player know? (gates all info display)
// ═══════════════════════════════════════════════════════════════
const Knowledge = {
  isBiomeKnown(x, y) {
    const ps = getCurrentPlanetState();
    return ps && !!ps.terrainKnown[x + ',' + y];
  },

  revealTerrain(x, y) {
    const ps = getCurrentPlanetState();
    if (!ps) return;
    const key = x + ',' + y;
    if (!ps.terrainKnown[key]) {
      ps.terrainKnown[key] = true;
      const tile = getTile(x, y);
      Events.emit('tileScanned', { key, tile });
      if (!ps.biomesFound[tile.biome]) {
        ps.biomesFound[tile.biome] = key;
        Events.emit('newBiome', { biome: tile.biome, pos: key });
      }
    }
  },

  getTileScans(x, y) {
    const ps = getCurrentPlanetState();
    return ps ? (ps.tileScans[x + ',' + y] || {}) : {};
  },

  recordTileScan(x, y, type) {
    const ps = getCurrentPlanetState();
    if (!ps) return;
    const key = x + ',' + y;
    if (!ps.tileScans[key]) ps.tileScans[key] = {};
    ps.tileScans[key][type] = true;
  },

  isBioScanned(x, y) {
    const scans = this.getTileScans(x, y);
    return scans.ir || scans.spec || scans.observe;
  },

  hasUsedInstrument(type) {
    const ps = getCurrentPlanetState();
    return ps && !!ps.scanned[type];
  },

  instrumentCount() {
    const ps = getCurrentPlanetState();
    return ps ? Object.keys(ps.scanned).length : 0;
  },

  getSpeciesScans(x, y) {
    const scans = this.getTileScans(x, y);
    return {
      ir: !!scans.ir,
      spec: !!scans.spec,
      observe: !!scans.observe,
      count: (scans.ir ? 1 : 0) + (scans.spec ? 1 : 0) + (scans.observe ? 1 : 0)
    };
  }
};

// ═══════════════════════════════════════════════════════════════
// SAVE / LOAD with migration
// ═══════════════════════════════════════════════════════════════
function saveGame() {
  const saveData = {
    seed: starSystem.seed,
    state: {
      ...state,
      planetStates: state.planetStates.map(ps => ({
        ...ps,
        tileCache: undefined
      }))
    }
  };
  localStorage.setItem('expedition_save', JSON.stringify(saveData));
}

function loadGame() {
  const raw = localStorage.getItem('expedition_save');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);

    // v1 → v2 migration: old single-planet save
    if (!data.state.saveVersion || data.state.saveVersion < 2) {
      starSystem = generateStarSystem(data.seed);
      const oldState = data.state;
      const oldJournal = oldState.journal || [];
      normalizePlanetState(oldState);

      state = initState(starSystem.planets.length);
      state.journal = oldJournal;
      state.gameMode = 'surface';
      state.currentPlanetIndex = 0;
      state.visitedPlanets = { 0: true };
      state.planetStates[0] = oldState;
      state.saveVersion = 2;
      planet = starSystem.planets[0];
      return true;
    }

    // v2 load
    starSystem = generateStarSystem(data.seed);
    state = data.state;
    if (!state.journal) {
      // Merge any per-planet journals into global
      state.journal = [];
      state.planetStates.forEach(ps => {
        if (ps.journal) { state.journal.push(...ps.journal); delete ps.journal; }
      });
    }
    state.planetStates.forEach(ps => {
      normalizePlanetState(ps);
    });

    if (state.currentPlanetIndex >= 0) {
      planet = starSystem.planets[state.currentPlanetIndex];
    } else {
      planet = null;
    }
    return true;
  } catch (e) {
    console.error('Load failed:', e);
    return false;
  }
}
