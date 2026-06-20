// ═══════════════════════════════════════════════════════════════
// INSTRUMENTS: All 11 instruments — each returns a reading string
// ═══════════════════════════════════════════════════════════════

const Instruments = {
  withAnomalyAnnotations(type, tile, lines) {
    const annotations = Anomalies.getScanAnnotation(type, tile);
    if (annotations.length === 0) return lines;
    const closing = lines.pop();
    lines.push(...annotations);
    lines.push(closing);
    return lines;
  },

  getStarObstruction(tile) {
    const ps = getCurrentPlanetState();
    if (!ps || !planet) return null;
    const phase = getDayPhase();
    if (phase === 'day' || phase === 'dawn' || phase === 'dusk') {
      return {
        reason: 'Sky too bright for stellar observations.',
        advice: 'Wait for nightfall.',
        phase
      };
    }

    if (planet.atmosphere.pressure <= 0.01) return null;

    const w = Weather.getConditions(ps.x, ps.y);
    if (w.storm.active && w.storm.severity > 0.45) {
      const dusty = tile.biome === 'desert' || tile.biome === 'volcanic';
      return {
        reason: dusty ? 'Dust-loaded winds are obscuring the star field.' : 'Storm turbulence is scattering the star field.',
        advice: 'Wait for clearer conditions or move out of the storm cell.',
        phase
      };
    }
    if (w.fog && w.visibility < 0.2) {
      return {
        reason: 'Dense low cloud and fog are washing out the star field.',
        advice: 'Wait for the fog to lift.',
        phase
      };
    }
    if (w.precipitation.type !== 'none' && w.precipitation.intensity > 0.45) {
      return {
        reason: `${w.precipitation.type[0].toUpperCase() + w.precipitation.type.slice(1)} is obscuring the optics.`,
        advice: 'Try again when precipitation weakens.',
        phase
      };
    }
    if (w.visibility < 0.16) {
      return {
        reason: 'Sky visibility is below tracker lock threshold.',
        advice: 'Try again after local conditions change.',
        phase
      };
    }
    return null;
  },

  canRecordEvidence(type, tile) {
    return !(type === 'star' && this.getStarObstruction(tile));
  },

  atmo(tile) {
    const ps = getCurrentPlanetState();
    const comp = planet.atmosphere.composition;
    const baseP = planet.atmosphere.pressure;
    const T = planet.surfaceTemp + tile.tempVariation;
    const w = Weather.getConditions(ps.x, ps.y);
    const Tw = T + w.tempMod;
    const m_avg = (comp.N2 || 0) > 0.5 ? 29 * 1.66e-27 : 44 * 1.66e-27;
    const h = Math.max(0, tile.elevation);
    const P = baseP * Math.exp(-m_avg * planet.surfaceGravity * h / (BOLTZMANN * Tw));

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 ATMOSPHERIC ANALYSIS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Temperature: ${(Tw - 273.15).toFixed(1)}\u00B0C (${Tw.toFixed(1)} K)`);
    lines.push(`\u2502 Pressure:    ${(P * 101.325).toFixed(2)} kPa (${P.toFixed(4)} atm)`);
    lines.push(`\u2502 Altitude:    ${tile.elevation.toFixed(0)} m`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Wind:        ${w.wind.speed.toFixed(1)} m/s ${w.wind.direction} (gusts ${w.wind.gust.toFixed(1)})`);
    lines.push(`\u2502 Visibility:  ${(w.visibility * 100).toFixed(0)}%`);
    if (w.precipitation.type !== 'none') {
      lines.push(`\u2502 Precip:      ${w.precipitation.type} (${(w.precipitation.intensity * 100).toFixed(0)}%)`);
    }
    if (w.storm.active) {
      lines.push(`\u2502 \u26A0 STORM WARNING \u2014 severity ${(w.storm.severity * 100).toFixed(0)}%`);
    }
    lines.push(`\u2502`);
    lines.push(`\u2502 Composition:`);
    Object.entries(comp).sort((a, b) => b[1] - a[1]).forEach(([gas, frac]) => {
      if (frac > 0.0001) {
        const bar = '\u2588'.repeat(Math.max(1, Math.round(frac * 30)));
        lines.push(`\u2502  ${gas.padEnd(4)} ${(frac * 100).toFixed(frac < 0.01 ? 3 : 1).padStart(7)}%  ${bar}`);
      }
    });
    lines.push(`\u2502`);
    lines.push(`\u2502 Mean molecular mass: ${(m_avg / 1.66e-27).toFixed(1)} amu`);
    lines.push(`\u2502 Scale height: ${(BOLTZMANN * Tw / (m_avg * planet.surfaceGravity) / 1000).toFixed(1)} km`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('atmo', tile, lines).join('\n');
  },

  rad(tile) {
    const ps = getCurrentPlanetState();
    const base = planet.surfaceRadiation * tile.radMultiplier;
    const underground = ps.underground;
    const rad = underground ? base * Math.exp(-0.1 * 5) : base;
    const phase = getDayPhase();
    const solarContrib = phase === 'day' ? 1.0 : phase === 'dawn' || phase === 'dusk' ? 0.3 : 0.05;
    const total = rad * 0.5 + rad * 0.5 * solarContrib;

    let level = 'NOMINAL';
    if (total > 0.01) level = 'LOW';
    if (total > 0.5) level = 'ELEVATED';
    if (total > 2.0) level = 'HIGH';
    if (total > 10) level = 'DANGEROUS';

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 RADIATION DOSIMETER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Dose rate: ${total.toFixed(3)} mSv/hr`);
    lines.push(`\u2502 Status:    ${level}`);
    lines.push(`\u2502 Source breakdown:`);
    lines.push(`\u2502   Cosmic:  ${(rad * 0.3).toFixed(3)} mSv/hr`);
    lines.push(`\u2502   Stellar: ${(rad * 0.5 * solarContrib).toFixed(3)} mSv/hr`);
    lines.push(`\u2502   Surface: ${(rad * 0.2).toFixed(3)} mSv/hr`);
    if (underground) lines.push(`\u2502 \u26A0 Underground shielding active (est. 5m rock)`);
    if (tile.radMultiplier > 1.5) lines.push(`\u2502 \u26A0 Local anomaly detected \u2014 elevated readings`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('rad', tile, lines).join('\n');
  },

  star(tile) {
    const ps = getCurrentPlanetState();
    const obstruction = this.getStarObstruction(tile);
    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 STAR TRACKER / SEXTANT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    if (obstruction) {
      lines.push(`\u2502 ${obstruction.reason}`);
      lines.push(`\u2502 ${obstruction.advice}`);
      lines.push(`\u2502 Current sky: ${formatDayPhase()}`);
    } else {
      lines.push(`\u2502 Stellar observations \u2014 clear sky`);
      lines.push(`\u2502 Observer position: ${ps.x}, ${ps.y}`);
      lines.push(`\u2502`);
      lines.push(`\u2502 Visible constellations:`);
      planet.constellations.forEach(c => {
        const visible = c.stars.filter(s => s.mag < 4.5);
        if (visible.length > 0) {
          lines.push(`\u2502  \u2605 ${c.name} \u2014 ${visible.length} stars visible`);
          visible.slice(0, 3).forEach(s => {
            lines.push(`\u2502    RA ${s.ra.toFixed(1)}\u00B0 Dec ${s.dec.toFixed(1)}\u00B0 mag ${s.mag.toFixed(1)}`);
          });
        }
      });
      const zenithDec = ps.y * -0.5;
      lines.push(`\u2502`);
      lines.push(`\u2502 Zenith declination: ~${zenithDec.toFixed(1)}\u00B0`);
      lines.push(`\u2502 Estimated latitude: ~${(-zenithDec).toFixed(1)}\u00B0`);
    }
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('star', tile, lines).join('\n');
  },

  solar(tile) {
    const ps = getCurrentPlanetState();
    const alt = getSunAltitude();
    const phase = getDayPhase();
    const rot = planet.rotationPeriod;
    const h = ps.timeHours % rot;
    const sunrise = rot * 0.25;
    const sunset = rot * 0.75;
    const dayLength = sunset - sunrise;
    const dayOfYear = ps.timeHours / rot;
    const seasonAngle = Math.sin(dayOfYear * 2 * Math.PI / (planet.orbit.periodDays / (rot / 24))) * planet.axialTilt;

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 SOLAR TRACKER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Star type:    ${planet.star.type}-class (${planet.star.temp.toFixed(0)} K)`);
    lines.push(`\u2502 Peak \u03BB:       ${planet.star.peakWavelength.toFixed(0)} nm`);
    lines.push(`\u2502 Sun altitude: ${alt.toFixed(1)}\u00B0`);
    lines.push(`\u2502 Phase:        ${phase}`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Rotation period: ${rot.toFixed(2)} hours`);
    lines.push(`\u2502 Day length:      ${dayLength.toFixed(2)} hours`);
    lines.push(`\u2502 Sunrise:         ${sunrise.toFixed(2)}h`);
    lines.push(`\u2502 Sunset:          ${sunset.toFixed(2)}h`);
    lines.push(`\u2502 Current:         ${h.toFixed(2)}h`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Axial tilt:      ${planet.axialTilt.toFixed(1)}\u00B0`);
    lines.push(`\u2502 Season angle:    ${seasonAngle.toFixed(1)}\u00B0`);
    lines.push(`\u2502 Orbital period:  ${planet.orbit.periodDays.toFixed(1)} days`);
    lines.push(`\u2502 Distance:        ${planet.orbit.au.toFixed(3)} AU`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Sun arc (E\u2192W):`);
    let arc = '\u2502  ';
    for (let i = 0; i < 24; i++) {
      const frac = i / 24;
      const a = Math.sin((frac * 360 - 90) * Math.PI / 180) * 90;
      if (a > 0) arc += a > 45 ? '\u2588' : a > 20 ? '\u2593' : a > 5 ? '\u2592' : '\u2591';
      else arc += '\u00B7';
    }
    lines.push(arc);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('solar', tile, lines).join('\n');
  },

  mag(tile) {
    const ps = getCurrentPlanetState();
    const B0 = planet.magneticField.strength;
    const latRad = ps.y * 0.01;
    const Br = 2 * B0 * Math.sin(latRad);
    const Bt = B0 * Math.cos(latRad);
    const Btotal = Math.sqrt(Br * Br + Bt * Bt);
    const inclination = Math.atan2(Br, Bt) * 180 / Math.PI;
    const declination = planet.magneticField.declination + Math.sin(ps.x * 0.05) * 5;
    const magNorthDir = declination > 0 ? `${Math.abs(declination).toFixed(1)}\u00B0 E of grid N` : `${Math.abs(declination).toFixed(1)}\u00B0 W of grid N`;

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 MAGNETOMETER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Field strength: ${Btotal.toFixed(2)} \u03BCT`);
    lines.push(`\u2502 Inclination:    ${inclination.toFixed(1)}\u00B0`);
    lines.push(`\u2502 Declination:    ${declination.toFixed(1)}\u00B0`);
    lines.push(`\u2502 Mag North:      ${magNorthDir}`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Components:`);
    lines.push(`\u2502   Radial (Br):    ${Br.toFixed(2)} \u03BCT`);
    lines.push(`\u2502   Tangential (B\u03B8):${Bt.toFixed(2)} \u03BCT`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Dipole model: B = B\u2080(R/r)\u00B3`);
    lines.push(`\u2502 B\u2080 (equatorial): ${B0.toFixed(2)} \u03BCT`);
    if (Math.abs(inclination) > 80) lines.push(`\u2502 \u26A0 Near magnetic pole!`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('mag', tile, lines).join('\n');
  },

  lidar(tile) {
    const ps = getCurrentPlanetState();
    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 LIDAR TOPOGRAPHY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Scan center: (${ps.x}, ${ps.y})`);
    lines.push(`\u2502 Biome: ${BIOME_NAMES[tile.biome]}`);
    lines.push(`\u2502 Elevation: ${tile.elevation.toFixed(0)} m`);
    lines.push(`\u2502`);

    // E-W cross-section profile (±4 tiles)
    lines.push(`\u2502 E\u2194W Cross-section (\u00B14 tiles):`);
    const elevations = [];
    for (let dx = -4; dx <= 4; dx++) {
      elevations.push(getTile(ps.x + dx, ps.y).elevation);
    }
    const maxElev = Math.max(...elevations);
    const minElev = Math.min(...elevations);
    const range = maxElev - minElev || 1;
    const barChars = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
    let profile = '\u2502  ';
    elevations.forEach((e, i) => {
      const norm = (e - minElev) / range;
      const idx = Math.min(7, Math.floor(norm * 8));
      if (i === 4) profile += `<span style="color:var(--accent3)">${barChars[idx]}</span>`;
      else profile += barChars[idx];
    });
    lines.push(profile);
    lines.push(`\u2502  W----@----E  (${minElev.toFixed(0)}m \u2014 ${maxElev.toFixed(0)}m)`);

    lines.push(`\u2502`);
    lines.push(`\u2502 Local elevation map (\u00B12 tiles):`);
    for (let dy = -2; dy <= 2; dy++) {
      let row = '\u2502  ';
      for (let dx = -2; dx <= 2; dx++) {
        const t = getTile(ps.x + dx, ps.y + dy);
        const e = t.elevation;
        if (dx === 0 && dy === 0) row += '[' + e.toFixed(0).padStart(5) + ']';
        else row += ' ' + e.toFixed(0).padStart(5) + ' ';
      }
      lines.push(row);
    }
    lines.push(`\u2502`);
    lines.push(`\u2502 Surface gravity: ${planet.surfaceGravity.toFixed(2)} m/s\u00B2`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('lidar', tile, lines).join('\n');
  },

  radar(tile) {
    const ps = getCurrentPlanetState();
    const r = tileRng(planet.seed + ':radar', ps.x, ps.y);
    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 SUBSURFACE RADAR \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Ground-penetrating scan at (${ps.x}, ${ps.y})`);
    lines.push(`\u2502 Depth range: 0-50m`);
    lines.push(`\u2502`);
    if (tile.subsurface.cave) {
      lines.push(`\u2502 \u25C9 CAVITY DETECTED at ~${Math.floor(r() * 20 + 5)}m depth`);
      lines.push(`\u2502   Estimated size: ${Math.floor(r() * 30 + 10)}m across`);
    }
    if (tile.subsurface.waterTable) {
      lines.push(`\u2502 \u2248 WATER TABLE detected at ~${Math.floor(r() * 15 + 3)}m`);
      lines.push(`\u2502   Liquid phase confirmed (impedance contrast)`);
    }
    if (tile.subsurface.mineralDeposit) {
      lines.push(`\u2502 \u25C6 MINERAL DEPOSIT: ${tile.subsurface.mineralType}`);
      lines.push(`\u2502   High-density anomaly at ~${Math.floor(r() * 25 + 2)}m`);
    }
    if (!tile.subsurface.cave && !tile.subsurface.waterTable && !tile.subsurface.mineralDeposit) {
      lines.push(`\u2502 No significant subsurface features detected.`);
      lines.push(`\u2502 Homogeneous regolith to scan depth.`);
    }
    lines.push(`\u2502`);
    lines.push(`\u2502 Bedrock density: ~${(planet.densityFactor * 2800 + r() * 500).toFixed(0)} kg/m\u00B3`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('radar', tile, lines).join('\n');
  },

  ir(tile) {
    const ps = getCurrentPlanetState();
    const T = planet.surfaceTemp + tile.tempVariation;
    const phase = getDayPhase();
    const solarHeating = phase === 'day' ? lerp(5, 25, 0.5) : phase === 'dawn' || phase === 'dusk' ? lerp(1, 8, 0.5) : 0;
    const r = tileRng(planet.seed + ':ir', ps.x, ps.y);

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 INFRARED CAMERA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Thermal scan at (${ps.x}, ${ps.y})`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Ambient surface: ${(T - 273.15 + solarHeating).toFixed(1)}\u00B0C`);
    lines.push(`\u2502 Background:      ${(T - 273.15).toFixed(1)}\u00B0C`);
    if (tile.hasGeothermal) {
      lines.push(`\u2502`);
      lines.push(`\u2502 \u25C9 THERMAL ANOMALY DETECTED`);
      lines.push(`\u2502   Geothermal source: ${tile.geothermalTemp.toFixed(0)}\u00B0C`);
      lines.push(`\u2502   Peak wavelength: ${(WIEN / (tile.geothermalTemp + 273.15) * 1e6).toFixed(1)} \u03BCm`);
    }
    if (tile.fauna.length > 0) {
      lines.push(`\u2502`);
      lines.push(`\u2502 Biological heat signatures:`);
      tile.fauna.forEach(f => {
        const bodyTemp = T - 273.15 + lerp(2, 15, r());
        lines.push(`\u2502   \u25E6 ${bodyTemp.toFixed(1)}\u00B0C \u2014 moving target (${f.name.split('(')[0].trim()})`);
      });
    }
    if (tile.flora.length > 0) {
      lines.push(`\u2502`);
      lines.push(`\u2502 Static thermal signatures: ${tile.flora.length} cluster${tile.flora.length > 1 ? 's' : ''}`);
      tile.flora.forEach(f => {
        if (f.bioluminescent) lines.push(`\u2502   \u25E6 Anomalous emission \u2014 possible bioluminescence`);
      });
    }
    if (phase === 'day') {
      lines.push(`\u2502`);
      lines.push(`\u2502 Solar-heated surfaces visible.`);
      lines.push(`\u2502 Rock faces: +${solarHeating.toFixed(1)}\u00B0C above ambient`);
    }
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('ir', tile, lines).join('\n');
  },

  spec(tile) {
    const ps = getCurrentPlanetState();
    const isRepeat = Knowledge.getTileScans(ps.x, ps.y).spec;

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 SPECTROMETER ANALYSIS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Sample: surface material at (${ps.x}, ${ps.y})`);
    lines.push(`\u2502 Biome: ${BIOME_NAMES[tile.biome]}`);
    lines.push(`\u2502`);

    // ASCII emission spectrum (40 chars wide)
    lines.push(`\u2502 Emission Spectrum (380-780nm):`);
    const specBins = new Array(40).fill(0);
    const sorted = Object.entries(tile.minerals).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([element, abundance]) => {
      if (ELEMENTS_SPECTRAL[element]) {
        ELEMENTS_SPECTRAL[element].lines.forEach(wl => {
          const bin = Math.floor((wl - 380) / (780 - 380) * 40);
          if (bin >= 0 && bin < 40) specBins[bin] += abundance * 8;
        });
      }
    });
    const maxBin = Math.max(...specBins, 0.01);
    const barChars = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
    let specLine = '\u2502  ';
    specBins.forEach(v => {
      const norm = Math.min(1, v / maxBin);
      specLine += barChars[Math.min(7, Math.floor(norm * 8))];
    });
    lines.push(specLine);
    lines.push(`\u2502  380nm${''.padEnd(28)}780nm`);

    lines.push(`\u2502`);
    lines.push(`\u2502 Detected emission lines (nm):`);
    sorted.forEach(([element, abundance]) => {
      if (abundance > 0.05 && ELEMENTS_SPECTRAL[element]) {
        const spec = ELEMENTS_SPECTRAL[element];
        const lineStr = spec.lines.slice(0, 4).map(l => l.toFixed(1)).join(', ');
        const bar = '\u2588'.repeat(Math.max(1, Math.round(abundance * 20)));
        lines.push(`\u2502  ${element.padEnd(10)} ${(abundance * 100).toFixed(1).padStart(5)}%  \u03BB: ${lineStr}`);
        lines.push(`\u2502  ${''.padEnd(10)} ${' '.padStart(5)}   ${bar}`);
      }
    });

    if (tile.biome === 'ocean' || tile.subsurface.waterTable) {
      lines.push(`\u2502`);
      lines.push(`\u2502  H\u2082O absorption: 720nm, 820nm, 940nm`);
    }
    if (tile.flora.length > 0) {
      lines.push(`\u2502`);
      lines.push(`\u2502 Organic compounds detected:`);
      tile.flora.forEach(f => {
        lines.push(`\u2502   \u25E6 Complex carbon chains \u2014 ${f.color} pigmentation`);
      });
    }

    if (isRepeat) {
      lines.push(`\u2502`);
      lines.push(`\u2502 [REPEAT SCAN \u2014 enhanced analysis]`);
      lines.push(`\u2502 Trace elements detected below threshold.`);
      const r = tileRng(planet.seed + ':spec:deep', ps.x, ps.y);
      const traces = ['Lithium','Beryllium','Strontium','Barium','Zirconium'];
      const trace1 = traces[Math.floor(r() * traces.length)];
      const trace2 = traces[Math.floor(r() * traces.length)];
      lines.push(`\u2502   ${trace1}: ~${(r() * 0.01).toFixed(4)}%`);
      lines.push(`\u2502   ${trace2}: ~${(r() * 0.01).toFixed(4)}%`);
    }

    lines.push(`\u2502`);
    lines.push(`\u2502 Note: Abundances are surface estimates.`);
    lines.push(`\u2502 Deep core samples may differ.`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('spec', tile, lines).join('\n');
  },

  // ═══════════════════════════════════════════════════════════════
  // NEW: Seismometer
  // ═══════════════════════════════════════════════════════════════
  seismo(tile) {
    const ps = getCurrentPlanetState();
    const r = systemRng(planet.seed, 'seismo', ps.x * 1000 + ps.y, Math.floor(ps.timeHours));

    const baseNoise = planet.tectonicActivity * lerp(0.5, 3.0, r());
    const localNoise = tile.biome === 'volcanic' ? baseNoise * 2.5 : tile.biome === 'mountain' ? baseNoise * 1.5 : baseNoise;
    const hasTremor = r() < planet.tectonicActivity * 0.15;
    const tremorMag = hasTremor ? lerp(1.0, 5.0, r()) : 0;
    const pWaveVelocity = lerp(3.0, 8.0, r()) * Math.sqrt(planet.densityFactor);

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 SEISMOMETER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Station: (${ps.x}, ${ps.y})`);
    lines.push(`\u2502 Noise floor: ${localNoise.toFixed(2)} \u03BCm/s`);
    lines.push(`\u2502 Tectonic activity: ${(planet.tectonicActivity * 100).toFixed(0)}%`);
    lines.push(`\u2502`);

    // ASCII waveform
    lines.push(`\u2502 Waveform (last 30s):`);
    let waveform = '\u2502  ';
    for (let i = 0; i < 36; i++) {
      const amp = localNoise * lerp(-1, 1, r());
      const spike = hasTremor && i > 15 && i < 25 ? tremorMag * lerp(-1, 1, r()) : 0;
      const total = amp + spike;
      if (Math.abs(total) < 0.5) waveform += '\u2500';
      else if (total > 2) waveform += '\u2580';
      else if (total > 0.5) waveform += '\u2594';
      else if (total < -2) waveform += '\u2584';
      else waveform += '\u2582';
    }
    lines.push(waveform);

    if (hasTremor) {
      lines.push(`\u2502`);
      lines.push(`\u2502 \u26A0 SEISMIC EVENT DETECTED`);
      lines.push(`\u2502   Magnitude: ${tremorMag.toFixed(1)} (local scale)`);
      lines.push(`\u2502   P-wave velocity: ${pWaveVelocity.toFixed(1)} km/s`);
      lines.push(`\u2502   Estimated depth: ${Math.floor(lerp(5, 80, r()))} km`);
      lines.push(`\u2502   Duration: ${lerp(2, 20, r()).toFixed(1)}s`);
    } else {
      lines.push(`\u2502`);
      lines.push(`\u2502 No significant seismic events detected.`);
      lines.push(`\u2502 P-wave velocity: ${pWaveVelocity.toFixed(1)} km/s`);
    }

    lines.push(`\u2502`);
    if (tile.biome === 'volcanic') lines.push(`\u2502 Volcanic microseisms present in background.`);
    if (tile.subsurface.cave) lines.push(`\u2502 Resonance pattern suggests subsurface void.`);
    lines.push(`\u2502 Bedrock type: ${planet.densityFactor > 1 ? 'dense igneous' : 'porous sedimentary'}`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('seismo', tile, lines).join('\n');
  },

  // ═══════════════════════════════════════════════════════════════
  // NEW: Radio
  // ═══════════════════════════════════════════════════════════════
  radio(tile) {
    const ps = getCurrentPlanetState();
    const freq = state.radioFreq;
    const r = systemRng(planet.seed, 'radio:' + freq.toFixed(1), ps.x, Math.floor(ps.timeHours));
    const w = Weather.getConditions(ps.x, ps.y);

    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 RADIO RECEIVER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502 Frequency: ${freq.toFixed(1)} MHz`);
    lines.push(`\u2502 Signal strength: ${w.storm.active ? 'POOR (storm interference)' : 'NOMINAL'}`);
    lines.push(`\u2502`);

    // Check if tuned to ship frequency
    const shipFreq = planet.shipFrequency;
    const freqDiff = Math.abs(freq - shipFreq);

    if (freqDiff < 0.5) {
      lines.push(`\u2502 \u2588\u2588 SHIP CONTACT ESTABLISHED \u2588\u2588`);
      lines.push(`\u2502`);
      lines.push(`\u2502 "Reading you, expedition. Telemetry nominal."`);
      lines.push(`\u2502`);
      lines.push(`\u2502 Orbital data available \u2014 use radio from`);
      lines.push(`\u2502 system map for planet scans.`);
      lines.push(`\u2502`);
      lines.push(`\u2502 Ship frequency locked: ${shipFreq.toFixed(1)} MHz`);
    } else {
      // Check pulsars
      let foundPulsar = false;
      planet.pulsarFrequencies.forEach((pf, i) => {
        if (Math.abs(freq - pf) < 2.0) {
          foundPulsar = true;
          const period = lerp(0.01, 2.0, seedRng(hashStr(planet.seed + ':pulsar:' + i))());
          lines.push(`\u2502 \u25C9 PULSAR SIGNAL DETECTED`);
          lines.push(`\u2502   Designation: PSR-${planet.name.replace(/\s/g, '')}-${i + 1}`);
          lines.push(`\u2502   Period: ${period.toFixed(4)}s`);
          lines.push(`\u2502   Frequency: ${pf.toFixed(1)} MHz`);
          lines.push(`\u2502`);
          // ASCII pulse pattern
          let pulse = '\u2502   ';
          for (let j = 0; j < 30; j++) {
            if (j % Math.max(2, Math.floor(period * 10)) === 0) pulse += '\u2502';
            else pulse += '\u00B7';
          }
          lines.push(pulse);
        }
      });

      if (!foundPulsar) {
        // Static / atmospheric noise
        const noiseLevel = w.storm.active ? 'heavy' : planet.atmosphere.pressure > 1 ? 'moderate' : 'light';
        lines.push(`\u2502 Static \u2014 ${noiseLevel} atmospheric noise`);
        lines.push(`\u2502`);
        let noise = '\u2502  ';
        for (let j = 0; j < 36; j++) {
          const n = r();
          if (n > 0.9) noise += '\u2588';
          else if (n > 0.7) noise += '\u2593';
          else if (n > 0.5) noise += '\u2592';
          else if (n > 0.3) noise += '\u2591';
          else noise += ' ';
        }
        lines.push(noise);
        lines.push(`\u2502`);
        lines.push(`\u2502 Tip: Tune to ship freq for comms.`);
        lines.push(`\u2502 Try scanning between 20-800 MHz for signals.`);
      }
    }

    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return this.withAnomalyAnnotations('radio', tile, lines).join('\n');
  },

  // Radio from orbit (system map) — orbital scan of a target planet
  radioOrbitalScan(targetPlanet) {
    let lines = [];
    lines.push(`\u250C\u2500\u2500\u2500 ORBITAL SCAN: ${targetPlanet.name} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Distance: ${targetPlanet.orbit.au.toFixed(3)} AU from star`);
    lines.push(`\u2502 Mass:     ${targetPlanet.massFactor.toFixed(2)} M\u2295`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Atmosphere:`);
    const topGases = Object.entries(targetPlanet.atmosphere.composition)
      .sort((a, b) => b[1] - a[1]).slice(0, 3);
    topGases.forEach(([gas, frac]) => {
      lines.push(`\u2502   ${gas}: ${(frac * 100).toFixed(1)}%`);
    });
    lines.push(`\u2502   Pressure: ${targetPlanet.atmosphere.pressure.toFixed(2)} atm`);
    lines.push(`\u2502`);
    lines.push(`\u2502 Surface temp: ~${(targetPlanet.surfaceTemp - 273.15).toFixed(0)}\u00B0C`);

    lines.push(`\u2502`);
    lines.push(`\u2502 "Data relayed from ship sensors."`);
    lines.push(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
    return lines.join('\n');
  }
};
