// ═══════════════════════════════════════════════════════════════
// WEATHER: Dynamic conditions, storms, rare phenomena
// ═══════════════════════════════════════════════════════════════

const Weather = {
  // Deterministic weather per (seed, tile, timeStep)
  getConditions(x, y) {
    if (!planet) return this._default();
    const ps = getCurrentPlanetState();
    if (!ps) return this._default();
    const timeStep = Math.floor(ps.timeHours / 2); // weather changes every 2 hours
    const r = systemRng(planet.seed, 'weather', x * 1000 + y, timeStep);

    const tile = getTile(x, y);
    const baseTemp = planet.surfaceTemp + tile.tempVariation;
    const hasAtmo = planet.atmosphere.pressure > 0.01;
    const phase = getDayPhase();

    // Wind
    const windBase = hasAtmo ? lerp(0, 30, r()) * Math.sqrt(planet.atmosphere.pressure) : 0;
    const windGust = windBase * lerp(1.0, 2.5, r());
    const windDir = ['N','NE','E','SE','S','SW','W','NW'][Math.floor(r() * 8)];

    // Precipitation
    const moistureChance = (planet.hasLiquidWater ? 0.3 : 0.02) * (tile.biome === 'ocean' ? 1.5 : tile.biome === 'marsh' ? 1.3 : tile.biome === 'desert' ? 0.1 : 1.0);
    const isPrecip = hasAtmo && r() < moistureChance;
    let precipType = 'none';
    if (isPrecip) {
      if (baseTemp < 273) precipType = 'snow';
      else if (baseTemp < 280) precipType = 'sleet';
      else precipType = 'rain';
    }
    const precipIntensity = isPrecip ? lerp(0.1, 1.0, r()) : 0;

    // Fog
    const fogChance = (tile.biome === 'marsh' ? 0.25 : tile.biome === 'ocean' ? 0.15 : tile.biome === 'forest' ? 0.1 : 0.03) * (phase === 'dawn' ? 2.0 : phase === 'night' ? 1.5 : 0.5);
    const hasFog = hasAtmo && r() < fogChance;

    // Storm
    const stormChance = hasAtmo ? 0.04 * planet.atmosphere.pressure : 0;
    const hasStorm = r() < stormChance;
    const stormSeverity = hasStorm ? lerp(0.3, 1.0, r()) : 0;

    // Visibility
    let visibility = 1.0;
    if (hasFog) visibility *= 0.3;
    if (hasStorm) visibility *= lerp(0.2, 0.5, stormSeverity);
    if (isPrecip) visibility *= lerp(0.5, 0.9, 1 - precipIntensity);
    if (phase === 'night') visibility *= 0.4;

    // Temperature variation from weather
    let tempMod = 0;
    if (hasStorm) tempMod -= lerp(2, 8, stormSeverity);
    if (hasFog) tempMod -= lerp(1, 3, r());
    if (isPrecip) tempMod -= lerp(1, 5, precipIntensity);

    return {
      wind: { speed: windBase, gust: windGust, direction: windDir },
      precipitation: { type: precipType, intensity: precipIntensity },
      fog: hasFog,
      storm: { active: hasStorm, severity: stormSeverity },
      visibility,
      tempMod,
      pressure: planet.atmosphere.pressure * lerp(0.97, 1.03, r())
    };
  },

  // Rare phenomena — checked less frequently
  checkPhenomena(x, y) {
    if (!planet) return null;
    const ps = getCurrentPlanetState();
    if (!ps) return null;
    const timeStep = Math.floor(ps.timeHours / 4);
    const r = systemRng(planet.seed, 'phenomena', x * 1000 + y, timeStep);
    const tile = getTile(x, y);
    const phase = getDayPhase();

    const phenomena = [];

    // Aurora — near magnetic poles, at night, with atmosphere
    if (planet.magneticField.strength > 20 && phase === 'night' && planet.atmosphere.pressure > 0.1) {
      const latFactor = Math.abs(y * 0.01);
      if (r() < 0.02 * latFactor) {
        const colors = ['green','violet','crimson','blue-white','amber'];
        phenomena.push({
          type: 'aurora',
          desc: `Shimmering curtains of ${colors[Math.floor(r() * colors.length)]} light ripple across the sky. The planet's magnetic field channels stellar wind into a luminous display.`
        });
      }
    }

    // Meteor shower — at night
    if (phase === 'night' && r() < 0.01) {
      phenomena.push({
        type: 'meteor',
        desc: `Bright streaks trace across the sky as debris burns through the upper atmosphere. A brief, brilliant display.`
      });
    }

    // Geyser — volcanic/geothermal areas
    if ((tile.biome === 'volcanic' || tile.hasGeothermal) && r() < 0.08) {
      phenomena.push({
        type: 'geyser',
        desc: `A sudden eruption of superheated vapor shoots skyward nearby, hissing and steaming. The plume reaches ${Math.floor(lerp(5, 40, r()))} meters before collapsing.`
      });
    }

    // Tremor — tectonic activity
    if (planet.tectonicActivity > 0.4 && r() < 0.03 * planet.tectonicActivity) {
      const mag = lerp(1.0, 4.5, r());
      phenomena.push({
        type: 'tremor',
        desc: `A ${mag < 2 ? 'faint' : mag < 3 ? 'noticeable' : 'strong'} tremor runs through the ground. Duration: ${lerp(2, 15, r()).toFixed(0)} seconds. The seismometer would tell you more.`
      });
    }

    // Tide — ocean biome
    if (tile.biome === 'ocean' && r() < 0.06) {
      const rising = r() > 0.5;
      phenomena.push({
        type: 'tide',
        desc: `The waterline is ${rising ? 'advancing steadily inland' : 'receding, exposing dark wet stone'}. Tidal forces from the star shift the shore.`
      });
    }

    // Dust devil — desert
    if (tile.biome === 'desert' && planet.atmosphere.pressure > 0.1 && r() < 0.05) {
      phenomena.push({
        type: 'dustdevil',
        desc: `A spinning column of dust rises ${Math.floor(lerp(3, 20, r()))} meters into the air, drifting slowly across the terrain before dissipating.`
      });
    }

    return phenomena.length > 0 ? phenomena : null;
  },

  // HTML description for location text
  describe(x, y) {
    const w = this.getConditions(x, y);
    const parts = [];

    if (w.storm.active) {
      if (w.storm.severity > 0.7) parts.push(`<span class="warn">A violent storm rages. Wind howls at ${w.wind.gust.toFixed(0)} m/s. Visibility is severely reduced.</span>`);
      else parts.push(`<span class="warn">A storm is passing through. Strong gusts buffet the area.</span>`);
    } else if (w.wind.speed > 15) {
      parts.push(`<span class="dim">A stiff wind blows from the ${w.wind.direction}, ${w.wind.speed.toFixed(0)} m/s.</span>`);
    } else if (w.wind.speed > 5) {
      parts.push(`<span class="dim">A light breeze drifts from the ${w.wind.direction}.</span>`);
    }

    if (w.precipitation.type !== 'none') {
      const intensity = w.precipitation.intensity;
      if (w.precipitation.type === 'rain') {
        parts.push(`<span class="dim">${intensity > 0.7 ? 'Heavy rain hammers the ground.' : intensity > 0.3 ? 'Rain falls steadily.' : 'A light drizzle mists the air.'}</span>`);
      } else if (w.precipitation.type === 'snow') {
        parts.push(`<span class="dim">${intensity > 0.7 ? 'Thick snow falls, blanketing everything.' : 'Snowflakes drift down silently.'}</span>`);
      } else {
        parts.push(`<span class="dim">Sleet patters against exposed surfaces.</span>`);
      }
    }

    if (w.fog) {
      parts.push(`<span class="dim">Fog hangs low, muffling sound and limiting visibility.</span>`);
    }

    const phenomena = this.checkPhenomena(x, y);
    if (phenomena) {
      phenomena.forEach(p => {
        parts.push(`<span class="warn">${p.desc}</span>`);
      });
    }

    return parts.join('\n');
  },

  _default() {
    return {
      wind: { speed: 0, gust: 0, direction: 'N' },
      precipitation: { type: 'none', intensity: 0 },
      fog: false,
      storm: { active: false, severity: 0 },
      visibility: 1.0,
      tempMod: 0,
      pressure: 0
    };
  }
};
