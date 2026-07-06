// ═══════════════════════════════════════════════════════════════
// WORLD: Star system, planet, and tile generation
// ═══════════════════════════════════════════════════════════════

function generateStarSystem(seed) {
  const r = seedRng(seed);

  // Generate star first (shared across system)
  const starTypes = ['M','K','G','F'];
  const starTypeKey = starTypes[Math.floor(r() * 4)];
  const st = STAR_TYPES[starTypeKey];
  const starTemp = lerp(st.tempRange[0], st.tempRange[1], r());
  const starMass = lerp(st.massRange[0], st.massRange[1], r());
  const starLum = lerp(st.lumFactor[0], st.lumFactor[1], r()) * SUN_LUMINOSITY;
  const starPeakWavelength = WIEN / starTemp * 1e9;

  const star = {
    type: starTypeKey,
    temp: starTemp,
    mass: starMass,
    luminosity: starLum,
    peakWavelength: starPeakWavelength,
    color: st.color
  };

  // Planet count: 2-10 seeded
  const planetCount = Math.floor(lerp(2, 10, r()));
  const planets = [];

  for (let i = 0; i < planetCount; i++) {
    const subSeed = seed + ':planet:' + i;
    const p = generatePlanet(subSeed, star);
    p.orbitalAngle = (i / planetCount) * 360 + lerp(-20, 20, r());
    p.systemIndex = i;
    planets.push(p);
  }

  // Sort by orbital distance
  planets.sort((a, b) => a.orbit.au - b.orbit.au);
  planets.forEach((p, i) => p.systemIndex = i);

  // Generate fleet requests
  const fleetRequests = generateFleetRequests(seed, planets);

  return { seed, star, planets, fleetRequests };
}

function generateFleetRequests(seed, planets) {
  const r = seedRng(hashStr(seed + ':fleet'));
  const count = Math.floor(lerp(2, 5, r()));
  const requests = [];

  const ranks = ['Dr.','Prof.','Lt.','Cmdr.','Specialist'];
  const ships = ['RSS Heliotrope','ISV Cartographer','Survey Vessel Antares','RSV Meridian','Deep Range Scout Vela','ISV Copernicus','RSS Kepler\'s Wake','Survey Barge Ptolemy'];
  const teams = ['Survey Team Kappa-7','Research Cell Tau-12','Geological Division 3','Spectral Analysis Group','Orbital Mapping Corps','Atmospheric Studies Unit','Subsurface Recon Wing'];

  const instrumentRequests = [
    { instrument: 'atmo', desc: 'atmospheric composition readings', detail: 'Comparing pressure gradients across multiple worlds in this region.' },
    { instrument: 'rad', desc: 'radiation dosimeter data', detail: 'Building a radiation map of habitable zone planets.' },
    { instrument: 'lidar', desc: 'LIDAR topography scans', detail: 'Need elevation profiles for erosion modeling.' },
    { instrument: 'radar', desc: 'subsurface radar sweeps', detail: 'Cataloguing subsurface cavity distribution in volcanic terrain.' },
    { instrument: 'ir', desc: 'infrared thermal surveys', detail: 'Mapping geothermal activity for energy potential assessment.' },
    { instrument: 'spec', desc: 'spectrometer mineral analyses', detail: 'Cross-referencing mineral signatures across star systems.' },
    { instrument: 'mag', desc: 'magnetometer readings', detail: 'Studying magnetic field decay patterns in low-mass worlds.' },
    { instrument: 'seismo', desc: 'seismometer data', detail: 'Investigating tectonic correlation with orbital eccentricity.' },
    { instrument: 'star', desc: 'star tracker observations', detail: 'Calibrating stellar position maps from multiple vantage points.' },
    { instrument: 'solar', desc: 'solar tracker measurements', detail: 'Monitoring stellar output variance at different orbital distances.' },
  ];

  const biomeRequests = [
    'from any volcanic terrain',
    'in mountainous regions',
    'along ocean shorelines',
    'in ice sheet environments',
    'from desert terrain',
    'within forested biomes',
    'from marshland areas',
    'at cave entrances',
  ];

  for (let i = 0; i < count; i++) {
    const useTeam = r() > 0.5;
    const sender = useTeam
      ? teams[Math.floor(r() * teams.length)]
      : `${ranks[Math.floor(r() * ranks.length)]} ${genName(seedRng(hashStr(seed + ':fleet:name:' + i)))}, ${ships[Math.floor(r() * ships.length)]}`;

    const req = instrumentRequests[Math.floor(r() * instrumentRequests.length)];
    const targetsPlanet = r() > 0.4 && planets.length > 0;
    const targetPlanet = targetsPlanet ? planets[Math.floor(r() * planets.length)] : null;
    const biomeSpec = r() > 0.5 ? biomeRequests[Math.floor(r() * biomeRequests.length)] : '';
    const priority = r() > 0.7 ? 'HIGH' : r() > 0.3 ? 'MED' : 'LOW';

    let message = `Requesting ${req.desc}`;
    if (biomeSpec) message += ` ${biomeSpec}`;
    if (targetPlanet) message += ` on ${targetPlanet.name}`;
    else message += ' in this system';
    message += `. ${req.detail}`;

    requests.push({
      id: i,
      sender,
      message,
      priority,
      instrument: req.instrument,
      planetName: targetPlanet ? targetPlanet.name : null
    });
  }

  return requests;
}

function normalizeAtmosphereComposition(composition) {
  const normalized = {};
  const total = Object.values(composition).reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return { CO2: 1 };

  Object.keys(composition).forEach(gas => {
    const value = Math.max(0, composition[gas]) / total;
    if (value > 0) normalized[gas] = value;
  });

  return normalized;
}

function generatePlanet(seed, sharedStar) {
  const r = seedRng(seed);

  let star;
  if (sharedStar) {
    star = sharedStar;
    // Consume the star generation RNG calls to keep seed consistent
    for (let i = 0; i < 6; i++) r();
  } else {
    const starTypes = ['M','K','G','F'];
    const starTypeKey = starTypes[Math.floor(r() * 4)];
    const st = STAR_TYPES[starTypeKey];
    const starTemp = lerp(st.tempRange[0], st.tempRange[1], r());
    const starMass = lerp(st.massRange[0], st.massRange[1], r());
    const starLum = lerp(st.lumFactor[0], st.lumFactor[1], r()) * SUN_LUMINOSITY;
    const starPeakWavelength = WIEN / starTemp * 1e9;
    star = { type: starTypeKey, temp: starTemp, mass: starMass, luminosity: starLum, peakWavelength: starPeakWavelength, color: STAR_TYPES[starTypeKey].color };
  }

  const starLum = star.luminosity;
  const starMass = star.mass;
  const habZoneInner = Math.sqrt(starLum / SUN_LUMINOSITY) * 0.95;
  const habZoneOuter = Math.sqrt(starLum / SUN_LUMINOSITY) * 1.4;
  const orbitalAU = lerp(habZoneInner * 0.5, habZoneOuter * 1.8, r());
  const eccentricity = r() * 0.15;
  const orbitalPeriod = Math.sqrt(orbitalAU ** 3 / starMass) * 365.25;

  const massFactor = lerp(0.1, 5.0, r());
  const planetMass = massFactor * EARTH_MASS;
  const densityFactor = lerp(0.7, 1.3, r());
  const planetRadius = Math.pow(massFactor / densityFactor, 1/3) * EARTH_RADIUS;
  const surfaceGravity = G_CONST * planetMass / (planetRadius ** 2);
  const escapeVelocity = Math.sqrt(2 * G_CONST * planetMass / planetRadius);
  const rotationPeriod = lerp(8, 100, r());
  const axialTilt = r() * 45;

  const distM = orbitalAU * AU;
  const T_eff = Math.pow(starLum / (16 * Math.PI * STEFAN_BOLTZMANN * distM ** 2), 0.25);
  const canRetainN2 = escapeVelocity > 3000;

  let atmoComp = {}, surfacePressure;
  if (!canRetainN2) {
    surfacePressure = lerp(0.0001, 0.01, r());
    atmoComp = { CO2: 0.9, Ar: 0.08, SO2: 0.02 };
  } else {
    surfacePressure = lerp(0.2, 5.0, r()) * massFactor;
    const hasO2 = r() > 0.6 && T_eff > 180 && T_eff < 380;
    if (hasO2) {
      const o2 = lerp(0.05, 0.3, r());
      const co2 = lerp(0.0001, 0.05, r());
      const ar = lerp(0.005, 0.02, r());
      const ch4 = r() > 0.5 ? lerp(0.00001, 0.005, r()) : 0;
      const h2o = T_eff > 270 ? lerp(0.001, 0.04, r()) : 0;
      const n2 = 1 - o2 - co2 - ar - ch4 - h2o;
      atmoComp = { N2: n2, O2: o2, CO2: co2, Ar: ar };
      if (ch4 > 0) atmoComp.CH4 = ch4;
      if (h2o > 0) atmoComp.H2O = h2o;
    } else {
      const co2 = lerp(0.5, 0.96, r());
      const n2 = lerp(0.01, 0.4, r());
      const so2 = r() > 0.5 ? lerp(0.001, 0.05, r()) : 0;
      const ar = 1 - co2 - n2 - so2;
      atmoComp = { CO2: co2, N2: n2, Ar: Math.max(0, ar) };
      if (so2 > 0) atmoComp.SO2 = so2;
    }
  }
  atmoComp = normalizeAtmosphereComposition(atmoComp);

  const co2Frac = atmoComp.CO2 || 0;
  const ch4Frac = atmoComp.CH4 || 0;
  const greenhouse = 1 + co2Frac * surfacePressure * 30 + ch4Frac * surfacePressure * 80;
  const surfaceTemp = T_eff * Math.pow(greenhouse, 0.25);
  const magBase = lerp(5, 80, r());
  const magStrength = magBase * Math.pow(massFactor, 0.5) * (24 / rotationPeriod);
  const magDeclination = lerp(-25, 25, r());
  const hasLiquidWater = surfaceTemp > 273 && surfaceTemp < 373 && (atmoComp.H2O > 0 || co2Frac < 0.95);
  const waterCoverage = hasLiquidWater ? lerp(0.05, 0.8, r()) : 0;
  const lifeProbability = hasLiquidWater && surfaceTemp > 260 && surfaceTemp < 330 && (atmoComp.O2 || 0) > 0.01 ? 0.03 : hasLiquidWater && surfaceTemp > 220 && surfaceTemp < 400 ? 0.008 : 0.001;
  const hasLife = r() < lifeProbability;
  const hasComplexLife = hasLife && r() < 0.1;
  const baseRadiation = lerp(0.5, 20, r()) * (1 / (surfacePressure + 0.1)) * (1 / (magStrength / 30 + 0.5));
  const surfaceRadiation = Math.max(0.01, baseRadiation);

  let terrainWeights = { plains: 30, mountain: 15, desert: 10 };
  if (hasLiquidWater) { terrainWeights.ocean = waterCoverage * 60; terrainWeights.marsh = 10; terrainWeights.forest = hasLife ? 20 : 0; }
  if (surfaceTemp > 350) terrainWeights.volcanic = 25;
  if (surfaceTemp < 250) { terrainWeights.ice = 30; terrainWeights.desert = 0; terrainWeights.marsh = 0; }
  terrainWeights.cave = 5;

  const minerals = ['Iron','Silicon','Magnesium','Calcium','Aluminum','Titanium','Sulfur','Carbon'];
  const planetMinerals = {};
  minerals.forEach(m => { planetMinerals[m] = lerp(0.01, 0.3, r()); });
  const mTotal = Object.values(planetMinerals).reduce((a, b) => a + b, 0);
  Object.keys(planetMinerals).forEach(k => planetMinerals[k] /= mTotal);

  const constellations = [];
  for (let i = 0; i < Math.floor(lerp(6, 14, r())); i++) {
    const nStars = Math.floor(lerp(3, 8, r()));
    const stars = [];
    const cx = r() * 360, cy = r() * 180 - 90;
    for (let j = 0; j < nStars; j++) stars.push({ ra: cx + r() * 40 - 20, dec: cy + r() * 30 - 15, mag: lerp(1, 6, r()) });
    constellations.push({ name: genName(seedRng(hashStr(seed + ':const:' + i))), stars });
  }

  const planetName = genPlanetName(seedRng(hashStr(seed + ':name')));

  // New fields for radio and seismometer
  const shipFrequency = lerp(140.0, 160.0, seedRng(hashStr(seed + ':shipfreq'))());
  const pulsarCount = Math.floor(lerp(1, 4, seedRng(hashStr(seed + ':pulsars'))()));
  const pulsarFrequencies = [];
  const pr = seedRng(hashStr(seed + ':pulsarfreqs'));
  for (let i = 0; i < pulsarCount; i++) {
    pulsarFrequencies.push(lerp(20.0, 800.0, pr()));
  }
  const tectonicActivity = lerp(0.0, 1.0, seedRng(hashStr(seed + ':tectonic'))());

  return {
    seed, name: planetName, star,
    orbit: { au: orbitalAU, eccentricity, periodDays: orbitalPeriod },
    mass: planetMass, radius: planetRadius, massFactor, densityFactor,
    surfaceGravity, escapeVelocity, rotationPeriod, axialTilt,
    atmosphere: { composition: atmoComp, pressure: surfacePressure, greenhouse },
    surfaceTemp,
    magneticField: { strength: magStrength, declination: magDeclination },
    hasLiquidWater, waterCoverage, hasLife, hasComplexLife,
    surfaceRadiation, terrainWeights,
    minerals: planetMinerals, constellations,
    shipFrequency, pulsarFrequencies, tectonicActivity,
    orbitalAngle: 0, systemIndex: 0
  };
}

function genName(r) {
  const c = 'bcdfghjklmnpqrstvwxyz', v = 'aeiou';
  let s = '';
  const len = Math.floor(r() * 3) + 2;
  for (let i = 0; i < len; i++) s += (i % 2 === 0 ? c : v)[Math.floor(r() * (i % 2 === 0 ? c.length : v.length))];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function genPlanetName(r) {
  const prefixes = ['Nova','Kepler','Gliese','HD','TrES','WASP','Proxima','Tau','Wolf'];
  const p = prefixes[Math.floor(r() * prefixes.length)];
  const n = Math.floor(r() * 9000) + 100;
  const suffix = String.fromCharCode(98 + Math.floor(r() * 5));
  return p + ' ' + n + suffix;
}

// ═══════════════════════════════════════════════════════════════
// TILE GENERATION
// ═══════════════════════════════════════════════════════════════
function getTile(x, y) {
  const ps = getCurrentPlanetState();
  const key = x + ',' + y;
  if (ps && ps.tileCache && ps.tileCache[key]) return ps.tileCache[key];
  const r = tileRng(planet.seed, x, y);
  const w = planet.terrainWeights;
  const entries = Object.entries(w);
  const total = entries.reduce((s, e) => s + e[1], 0);
  let roll = r() * total, biome = 'plains';
  for (const [b, wt] of entries) { roll -= wt; if (roll <= 0) { biome = b; break; } }

  const baseElev = biome === 'mountain' ? lerp(800, 4000, r()) : biome === 'ocean' ? lerp(-200, -10, r()) : biome === 'volcanic' ? lerp(200, 1500, r()) : biome === 'cave' ? lerp(50, 300, r()) : lerp(0, 500, r());
  const localTempVar = lerp(-8, 8, r()) + (biome === 'volcanic' ? lerp(5, 30, r()) : 0) + (biome === 'ice' ? lerp(-20, -5, r()) : 0);

  let flora = [], fauna = [];
  if (planet.hasLife) {
    const floraCount = biome === 'forest' ? Math.floor(r() * 2) + 1 : biome === 'marsh' ? Math.floor(r() * 2) : biome === 'ocean' ? Math.floor(r() * 1.5) : biome === 'ice' || biome === 'volcanic' ? 0 : Math.floor(r() * 1.5);
    for (let i = 0; i < floraCount; i++) flora.push(genFlora(seedRng(hashStr(planet.seed + ':flora:' + x + ':' + y + ':' + i)), biome));
    if (planet.hasComplexLife) {
      const faunaChance = biome === 'forest' ? 0.15 : biome === 'marsh' ? 0.12 : biome === 'plains' ? 0.08 : biome === 'ocean' ? 0.06 : 0.02;
      if (r() < faunaChance) fauna.push(genFauna(seedRng(hashStr(planet.seed + ':fauna:' + x + ':' + y)), biome));
    }
  }

  const localMinerals = {};
  const mEntries = Object.entries(planet.minerals);
  mEntries.forEach(([m, base]) => {
    let v = base + lerp(-0.1, 0.1, r());
    if (biome === 'volcanic' && (m === 'Iron' || m === 'Sulfur')) v += 0.15;
    if (biome === 'mountain' && (m === 'Silicon' || m === 'Aluminum')) v += 0.1;
    localMinerals[m] = Math.max(0, Math.min(1, v));
  });

  const hasCaveBelow = r() < 0.15;
  const hasWaterTable = planet.hasLiquidWater && r() < 0.3;
  const hasMineralDeposit = r() < 0.1;
  const mineralType = hasMineralDeposit ? mEntries[Math.floor(r() * mEntries.length)][0] : null;
  const radMultiplier = biome === 'volcanic' ? lerp(1.2, 2.5, r()) : hasMineralDeposit && mineralType === 'Titanium' ? lerp(1.5, 3, r()) : lerp(0.8, 1.2, r());
  const hasGeothermal = biome === 'volcanic' ? r() < 0.6 : r() < 0.05;
  const geothermalTemp = hasGeothermal ? lerp(60, 350, r()) : 0;

  const tile = {
    biome, elevation: baseElev, tempVariation: localTempVar,
    flora, fauna, minerals: localMinerals,
    subsurface: { cave: hasCaveBelow, waterTable: hasWaterTable, mineralDeposit: hasMineralDeposit, mineralType },
    radMultiplier, hasGeothermal, geothermalTemp
  };
  if (ps) {
    if (!ps.tileCache) ps.tileCache = {};
    ps.tileCache[key] = tile;
  }
  return tile;
}

function genFlora(r, biome) {
  const types = ['fungoid','photosynthetic','crystalline','moss-analog','vine-like','succulent','spore-bearing','colonial'];
  const colors = ['deep crimson','pale azure','golden','violet','emerald','silver-white','bioluminescent teal','dusty orange','iridescent','dark indigo'];
  const sizes = ['tiny (2-5cm)','small (10-30cm)','medium (0.5-1m)','tall (1-3m)','towering (3-8m)'];
  const features = ['spiral-patterned leaves','translucent membranes','fractal branching','pulsing bioluminescence','crystalline nodules','symbiotic root networks','airborne spore clouds','rhythmic swaying motion'];
  const type = types[Math.floor(r() * types.length)];
  const color = colors[Math.floor(r() * colors.length)];
  const size = sizes[Math.floor(r() * sizes.length)];
  const feature = features[Math.floor(r() * features.length)];
  const name = genName(r) + ' ' + genName(r);
  let desc = `A ${size} ${color} ${type} organism`;
  if (biome === 'ocean') desc += ', clustered along the waterline';
  else if (biome === 'marsh') desc += ', rooted in saturated soil';
  else if (biome === 'forest') desc += ', growing amid dense growth';
  desc += `. Notable for its ${feature}.`;
  const biolum = r() < 0.15;
  if (biolum) desc += ` Emits a faint ${['blue-green','amber','violet','pale white'][Math.floor(r() * 4)]} glow in low light.`;
  return { name: `${name} (${type})`, desc, bioluminescent: biolum, type: 'flora', id: name, color, size, feature };
}

function genFauna(r, biome) {
  const bodyTypes = ['arthropoid','vermiform','radial','bilateral','amorphous','colonial-swarm','sessile-filter'];
  const locomotion = ['crawling','gliding','burrowing','swimming','drifting','hopping','undulating'];
  const coverings = ['chitinous plates','smooth membrane','fine cilia','crystalline scales','mucous sheath','feathery filaments'];
  const sizes = ['minuscule (1-3cm)','small (5-15cm)','medium (20-50cm)','large (0.5-1.5m)','massive (2-4m)'];
  const behaviors = ['feeding on surface growths','slowly traversing the terrain','partially buried','resting motionless','clustered in a group','inspecting surroundings'];
  const body = bodyTypes[Math.floor(r() * bodyTypes.length)];
  const loco = locomotion[Math.floor(r() * locomotion.length)];
  const cover = coverings[Math.floor(r() * coverings.length)];
  const size = sizes[Math.floor(r() * sizes.length)];
  const behavior = behaviors[Math.floor(r() * behaviors.length)];
  const name = genName(r) + ' ' + genName(r);
  const limbs = Math.floor(r() * 8) + 2;
  const eyes = Math.floor(r() * 6);
  let desc = `A ${size} ${body} creature with ${cover} and ${limbs} limbs. Observed ${loco}, currently ${behavior}.`;
  if (eyes === 0) desc += ` No visible optical organs.`;
  else desc += ` ${eyes} eye-like sensor${eyes > 1 ? 's' : ''} visible.`;
  if (r() < 0.2) desc += ` Appears to respond to vibrations.`;
  if (r() < 0.1) desc += ` Produces faint clicking sounds.`;
  return { name: `${name} (${body})`, desc, type: 'fauna', id: name, body, loco, cover, limbs, eyes };
}
