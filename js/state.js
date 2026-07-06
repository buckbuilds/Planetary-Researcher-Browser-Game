// ═══════════════════════════════════════════════════════════════
// STATE: Globals, init, Knowledge, save/load
// ═══════════════════════════════════════════════════════════════

let starSystem = null;
let planet = null;  // alias for current planet: starSystem.planets[state.currentPlanetIndex]
let state = null;
let activeExpeditionId = null;

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
    savedJournals: [],
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
// SAVE / LOAD with expedition slots and legacy migration
// ═══════════════════════════════════════════════════════════════
const LEGACY_SAVE_KEY = 'expedition_save';
const EXPEDITION_STORE_KEY = 'expedition_log_v1';

function createExpeditionStore() {
  return { version: 1, activeId: null, legacyImported: false, expeditions: [] };
}

function makeExpeditionId() {
  return 'exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function expeditionDefaultName(seed) {
  const date = new Date().toLocaleDateString();
  return `Expedition ${seed || date}`;
}

function serializeGame() {
  return {
    seed: starSystem.seed,
    state: {
      ...state,
      planetStates: state.planetStates.map(ps => ({
        ...ps,
        tileCache: undefined
      }))
    }
  };
}

function countExpeditionEntries(saveData) {
  const current = saveData && saveData.state && saveData.state.journal ? saveData.state.journal.length : 0;
  const archived = saveData && saveData.state && saveData.state.savedJournals
    ? saveData.state.savedJournals.reduce((sum, journal) => sum + (journal.entries ? journal.entries.length : 0), 0)
    : 0;
  return current + archived;
}

function countVisitedPlanets(saveData) {
  return saveData && saveData.state && saveData.state.visitedPlanets
    ? Object.keys(saveData.state.visitedPlanets).length
    : 0;
}

function summarizeExpedition(saveData) {
  return {
    seed: saveData.seed,
    entries: countExpeditionEntries(saveData),
    visited: countVisitedPlanets(saveData),
    mode: saveData.state ? saveData.state.gameMode : 'map'
  };
}

function normalizeJournalEntries(entries) {
  if (!Array.isArray(entries)) return [];

  const usedIds = new Set();
  let nextId = 0;

  return entries.map(entry => {
    const rawId = Number(entry && entry.id);
    let id = Number.isInteger(rawId) && rawId >= 0 ? rawId : nextId;
    while (usedIds.has(id)) id = nextId;
    usedIds.add(id);
    nextId = Math.max(nextId, id + 1);

    return {
      id,
      time: String(entry && entry.time != null ? entry.time : '--:--'),
      pos: String(entry && entry.pos != null ? entry.pos : 'ship'),
      category: String(entry && entry.category ? entry.category : 'note'),
      title: String(entry && entry.title ? entry.title : 'Note Entry'),
      text: String(entry && entry.text != null ? entry.text : '')
    };
  });
}

function normalizeSavedJournals(savedJournals) {
  if (!Array.isArray(savedJournals)) return [];
  return savedJournals.map(journal => ({
    name: String(journal && journal.name ? journal.name : 'Archived Journal'),
    date: String(journal && journal.date ? journal.date : ''),
    entries: normalizeJournalEntries(journal && journal.entries)
  }));
}

function normalizeSaveData(data) {
  if (!data || !data.seed || !data.state) return null;

  // v1 -> v2 migration: old single-planet save
  if (!data.state.saveVersion || data.state.saveVersion < 2) {
    const migratedSystem = generateStarSystem(data.seed);
    const oldState = data.state;
    const oldJournal = normalizeJournalEntries(oldState.journal || []);
    normalizePlanetState(oldState);

    const migrated = initState(migratedSystem.planets.length);
    migrated.journal = oldJournal;
    migrated.gameMode = 'surface';
    migrated.currentPlanetIndex = 0;
    migrated.visitedPlanets = { 0: true };
    migrated.planetStates[0] = oldState;
    migrated.saveVersion = 2;
    return { seed: data.seed, state: migrated };
  }

  if (!data.state.journal) {
    data.state.journal = [];
    if (data.state.planetStates) {
      data.state.planetStates.forEach(ps => {
        if (ps.journal) {
          data.state.journal.push(...ps.journal);
          delete ps.journal;
        }
      });
    }
  }
  data.state.journal = normalizeJournalEntries(data.state.journal);
  data.state.savedJournals = normalizeSavedJournals(data.state.savedJournals);

  if (!data.state.planetStates) data.state.planetStates = [];
  data.state.planetStates.forEach(ps => normalizePlanetState(ps));
  data.state.saveVersion = 2;
  return data;
}

function saveExpeditionStore(store) {
  localStorage.setItem(EXPEDITION_STORE_KEY, JSON.stringify(store));
}

function loadExpeditionStore() {
  let store = createExpeditionStore();
  const raw = localStorage.getItem(EXPEDITION_STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      store = {
        ...createExpeditionStore(),
        ...parsed,
        expeditions: Array.isArray(parsed.expeditions) ? parsed.expeditions : []
      };
    } catch (e) {
      console.warn('Expedition log failed to parse:', e);
    }
  }

  if (!store.legacyImported) {
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacyRaw) {
      try {
        const legacyData = normalizeSaveData(JSON.parse(legacyRaw));
        if (legacyData) {
          const now = new Date().toISOString();
          const id = makeExpeditionId();
          store.expeditions.push({
            id,
            name: expeditionDefaultName(legacyData.seed),
            createdAt: now,
            updatedAt: now,
            data: legacyData,
            summary: summarizeExpedition(legacyData)
          });
          if (!store.activeId) store.activeId = id;
        }
      } catch (e) {
        console.warn('Legacy save failed to migrate:', e);
      }
    }
    store.legacyImported = true;
    saveExpeditionStore(store);
  }

  return store;
}

function getExpeditions() {
  return loadExpeditionStore().expeditions;
}

function getExpedition(id) {
  return getExpeditions().find(expedition => expedition.id === id) || null;
}

function createExpeditionSlot(seed, name, saveData) {
  const store = loadExpeditionStore();
  const now = new Date().toISOString();
  const data = saveData || { seed, state: initState(generateStarSystem(seed).planets.length) };
  const id = makeExpeditionId();
  store.expeditions.push({
    id,
    name: name || expeditionDefaultName(seed),
    createdAt: now,
    updatedAt: now,
    data,
    summary: summarizeExpedition(data)
  });
  store.activeId = id;
  activeExpeditionId = id;
  saveExpeditionStore(store);
  return id;
}

function updateExpeditionSlot(id, saveData) {
  const store = loadExpeditionStore();
  const slot = store.expeditions.find(expedition => expedition.id === id);
  if (!slot) return false;
  slot.data = saveData;
  slot.updatedAt = new Date().toISOString();
  slot.summary = summarizeExpedition(saveData);
  store.activeId = id;
  saveExpeditionStore(store);
  return true;
}

function deleteExpeditionSlot(id) {
  const store = loadExpeditionStore();
  store.expeditions = store.expeditions.filter(expedition => expedition.id !== id);
  if (store.activeId === id) store.activeId = store.expeditions[0] ? store.expeditions[0].id : null;
  if (activeExpeditionId === id) activeExpeditionId = null;
  saveExpeditionStore(store);
}

function saveGame() {
  if (!starSystem || !state) return;
  const saveData = serializeGame();
  if (!activeExpeditionId) {
    activeExpeditionId = createExpeditionSlot(saveData.seed, expeditionDefaultName(saveData.seed), saveData);
  } else if (!updateExpeditionSlot(activeExpeditionId, saveData)) {
    activeExpeditionId = createExpeditionSlot(saveData.seed, expeditionDefaultName(saveData.seed), saveData);
  }
  localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(saveData));
}

function loadGame(expeditionId) {
  const store = loadExpeditionStore();
  const id = expeditionId || store.activeId;
  const slot = store.expeditions.find(expedition => expedition.id === id);
  if (!slot) return false;

  const data = normalizeSaveData(JSON.parse(JSON.stringify(slot.data)));
  if (!data) return false;

  starSystem = generateStarSystem(data.seed);
  state = data.state;
  if (state.currentPlanetIndex >= 0) {
    planet = starSystem.planets[state.currentPlanetIndex];
  } else {
    planet = null;
  }
  activeExpeditionId = slot.id;
  store.activeId = slot.id;
  saveExpeditionStore(store);
  return true;
}
