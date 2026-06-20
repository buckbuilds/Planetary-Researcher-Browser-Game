// ═══════════════════════════════════════════════════════════════
// SCREENS: System map, travel animation, landing sequence
// ═══════════════════════════════════════════════════════════════

const Screens = {
  _animFrame: null,

  show(hideJournal) {
    document.getElementById('screen-container').style.display = 'flex';
    document.getElementById('left-panel').style.display = 'none';
    document.getElementById('right-panel').style.display = hideJournal ? 'none' : 'flex';
    document.getElementById('top-bar').style.display = 'none';
  },

  hide() {
    document.getElementById('screen-container').style.display = 'none';
    document.getElementById('left-panel').style.display = 'flex';
    document.getElementById('right-panel').style.display = 'flex';
    document.getElementById('top-bar').style.display = 'flex';
  },

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM MAP
  // ═══════════════════════════════════════════════════════════════
  renderSystemMap() {
    this.show();
    const container = document.getElementById('screen-container');
    const width = 70;
    const height = 35;

    const planets = starSystem.planets;
    const selected = state.selectedPlanetIndex;

    // Build ASCII grid
    const grid = [];
    for (let y = 0; y < height; y++) {
      grid.push(new Array(width).fill(' '));
    }

    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);

    // Draw star
    grid[cy][cx] = '\u2726';

    // Draw orbital rings and planets
    planets.forEach((p, i) => {
      const maxRadius = Math.min(cx - 2, cy - 2);
      const orbRadius = Math.floor(lerp(3, maxRadius, (i + 1) / (planets.length + 1)));

      // Draw orbital ring with dots
      const steps = orbRadius * 12;
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * 2 * Math.PI;
        const ox = cx + Math.round(Math.cos(angle) * orbRadius * 1.8); // stretch horizontally
        const oy = cy + Math.round(Math.sin(angle) * orbRadius);
        if (ox >= 0 && ox < width && oy >= 0 && oy < height && grid[oy][ox] === ' ') {
          grid[oy][ox] = '\u00B7';
        }
      }

      // Place planet on its orbital ring
      const pAngle = (p.orbitalAngle || 0) * Math.PI / 180;
      const px = cx + Math.round(Math.cos(pAngle) * orbRadius * 1.8);
      const py = cy + Math.round(Math.sin(pAngle) * orbRadius);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        // Planet glyph by mass
        let glyph;
        if (p.massFactor < 0.5) glyph = '.';
        else if (p.massFactor < 1.5) glyph = 'o';
        else if (p.massFactor < 3.0) glyph = 'O';
        else glyph = '\u25CF';

        grid[py][px] = glyph;

        // Store position for rendering
        p._mapX = px;
        p._mapY = py;
      }
    });

    // Render grid with highlights
    let html = '';
    html += `<div style="color:var(--text-dim);margin-bottom:8px;text-align:center">`;
    html += `<span style="color:var(--accent1);font-weight:700">\u2550\u2550\u2550 ${starSystem.star.type}-CLASS STAR SYSTEM \u2550\u2550\u2550</span>`;
    html += `</div>`;

    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const ch = grid[y][x];
        let styled = ch;

        // Star glyph
        if (x === cx && y === cy) {
          styled = `<span style="color:${starSystem.star.color};font-weight:700">${ch}</span>`;
        }
        // Check if this is a planet position
        else {
          let isPlanet = false;
          planets.forEach((p, i) => {
            if (p._mapX === x && p._mapY === y) {
              isPlanet = true;
              if (i === selected) {
                styled = `<span style="color:var(--accent3);font-weight:700;text-decoration:underline">${ch}</span>`;
              } else if (state.visitedPlanets[i]) {
                styled = `<span style="color:var(--green)">${ch}</span>`;
              } else {
                styled = `<span style="color:var(--text)">${ch}</span>`;
              }
            }
          });
          if (!isPlanet && ch === '\u00B7') {
            styled = `<span style="color:var(--card-border)">${ch}</span>`;
          }
        }
        line += styled;
      }
      html += line + '\n';
    }

    // Info bar
    const sp = planets[selected];
    html += `\n<div style="text-align:center;margin-top:4px">`;
    html += `<span style="color:var(--accent3);font-weight:700">\u25B6 ${sp.name}</span>`;
    html += `<span style="color:var(--text-dim)"> \u2014 ${sp.orbit.au.toFixed(2)} AU</span>`;
    if (state.visitedPlanets[selected]) {
      html += ` <span style="color:var(--green)">[VISITED]</span>`;
    }
    html += `</div>`;
    html += `<div style="text-align:center;color:var(--text-dim);font-size:11px;margin-top:4px">`;
    html += `\u2190\u2192 select planet \u2502 ENTER launch`;
    html += `</div>`;

    // Build container: wrapper holds pre (centered) + nav (bottom)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;justify-content:center;width:100%';
    wrapper.innerHTML = `<pre style="font-family:var(--font);line-height:1.2;font-size:13px">${html}</pre>`;

    const nav = document.createElement('div');
    nav.className = 'nav-bar';

    const canBack = typeof Game !== 'undefined' && Game._systemHistoryIndex > 0;
    const canFwd = typeof Game !== 'undefined' && Game._systemHistoryIndex < Game._systemHistory.length - 1;
    const hasFleet = starSystem.fleetRequests && starSystem.fleetRequests.length > 0;
    const isScanned = state.orbitalScans && state.orbitalScans[selected];
    const scanOpen = !!container.querySelector('.orbital-scan-panel');
    const fleetOpen = !!container.querySelector('.fleet-comms-panel');

    nav.innerHTML = `
      <button onclick="Game.prevSystem()" ${canBack ? '' : 'disabled style="opacity:0.3"'}>\u25C0 Prev System</button>
      <button onclick="Game.nextSystem()" ${canFwd ? '' : 'disabled style="opacity:0.3"'}>\u25B6 Next System</button>
      <button onclick="Game.randomPlanet()" style="border-color:var(--green)">\uD83C\uDF0C Random System</button>
      ${hasFleet ? `<button id="btn-fleet" onclick="Screens.toggleFleetComms()" class="${fleetOpen ? 'btn-active' : ''}" style="border-color:var(--orange)">\uD83D\uDCE1 Fleet Comms</button>` : ''}
      <button id="btn-scan" onclick="Screens.scanOrToggle()" class="${scanOpen ? 'btn-active' : ''}" style="border-color:${isScanned ? 'var(--accent1)' : 'var(--text-dim)'}">\uD83D\uDCE1 ${isScanned ? 'Orbital Scan' : 'Scan Planet'}</button>
    `;

    const seedValue = String(starSystem.seed || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const seedBar = document.createElement('div');
    seedBar.className = 'seed-bar';
    seedBar.innerHTML = `
      <span class="seed-label">New Expedition</span>
      <input id="seed-input" type="text" value="${seedValue}" placeholder="system seed" onkeydown="if(event.key==='Enter')Game.loadSeed()">
      <button onclick="Game.loadSeed()">Go</button>
      <button onclick="Game.randomPlanet()">\uD83E\uDE90 Random</button>
    `;

    container.innerHTML = '';
    container.appendChild(wrapper);
    container.appendChild(seedBar);
    container.appendChild(nav);
  },

  scanOrToggle() {
    const idx = state.selectedPlanetIndex;
    if (!state.orbitalScans) state.orbitalScans = {};
    const container = document.getElementById('screen-container');
    const btn = document.getElementById('btn-scan');

    if (!state.orbitalScans[idx]) {
      // First scan
      state.orbitalScans[idx] = true;
      this._showScanPanel(idx);
      if (btn) { btn.style.borderColor = 'var(--accent1)'; btn.textContent = '\uD83D\uDCE1 Orbital Scan'; btn.classList.add('btn-active'); }
      saveGame();
    } else {
      // Toggle
      const existing = container.querySelector('.orbital-scan-panel');
      if (existing) {
        existing.remove();
        if (btn) btn.classList.remove('btn-active');
      } else {
        this._showScanPanel(idx);
        if (btn) btn.classList.add('btn-active');
      }
    }
  },

  _showScanPanel(planetIndex) {
    const container = document.getElementById('screen-container');
    const existing = container.querySelector('.orbital-scan-panel');
    if (existing) existing.remove();

    const target = starSystem.planets[planetIndex];
    const reading = Instruments.radioOrbitalScan(target);
    const panel = document.createElement('div');
    panel.className = 'orbital-scan-panel popup-panel';
    panel.innerHTML = `<span class="reading">${reading}</span>`;
    container.appendChild(panel);
  },

  toggleFleetComms() {
    const container = document.getElementById('screen-container');
    const btn = document.getElementById('btn-fleet');
    const existing = container.querySelector('.fleet-comms-panel');
    if (existing) { existing.remove(); if (btn) btn.classList.remove('btn-active'); return; }
    if (btn) btn.classList.add('btn-active');

    const panel = document.createElement('div');
    panel.className = 'fleet-comms-panel';
    panel.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--card);border:1px solid var(--orange);padding:16px 20px;font-size:12px;white-space:pre-wrap;max-width:500px;z-index:20;border-radius:4px';

    let html = '';
    html += `<div style="color:var(--orange);font-weight:700;margin-bottom:8px">\uD83D\uDCE1 FLEET COMMS \u2014 ${starSystem.fleetRequests.length} ACTIVE REQUESTS</div>`;
    html += `<div style="color:var(--text-dim);margin-bottom:12px;font-size:11px">"Researchers, we respectfully request your assistance\n in gathering data on the following:"</div>`;

    starSystem.fleetRequests.forEach(req => {
      const priColor = req.priority === 'HIGH' ? 'var(--orange)' : req.priority === 'MED' ? 'var(--accent1)' : 'var(--text-dim)';
      html += `<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--card-border)">`;
      html += `<span style="color:var(--accent3)">${req.sender}</span> <span style="color:${priColor}">[${req.priority}]</span>\n`;
      html += `<span style="color:var(--text-dim)">"${req.message}"</span>`;
      html += `</div>`;
    });

    html += `<div style="text-align:center;margin-top:8px"><button onclick="Screens.toggleFleetComms()" style="border-color:var(--orange)">Close</button></div>`;

    panel.innerHTML = html;
    container.appendChild(panel);
  },

  // ═══════════════════════════════════════════════════════════════
  // TRAVEL ANIMATION
  // ═══════════════════════════════════════════════════════════════
  playTravel(planetIndex, callback) {
    this.show(true);
    const container = document.getElementById('screen-container');
    const targetPlanet = starSystem.planets[planetIndex];
    const width = 60;
    const height = 20;
    const duration = 4000; // 4 seconds
    const startTime = Date.now();

    // Generate starfield
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.3,
        char: Math.random() > 0.7 ? '*' : '\u00B7',
        dist: Math.random()
      });
    }

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Build frame
      const grid = [];
      for (let y = 0; y < height; y++) {
        grid.push(new Array(width).fill(' '));
      }
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);

      // Animate stars moving outward
      stars.forEach(s => {
        const d = ((s.dist + progress * s.speed * 3) % 1);
        const sx = cx + Math.round(Math.cos(s.angle) * d * cx);
        const sy = cy + Math.round(Math.sin(s.angle) * d * cy * 0.6);
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          grid[sy][sx] = d > 0.5 ? s.char : (d > 0.2 ? '\u00B7' : ' ');
        }
      });

      // Render
      let html = '';
      for (let y = 0; y < height; y++) {
        html += grid[y].join('') + '\n';
      }

      // Progress bar
      const barLen = 30;
      const filled = Math.floor(progress * barLen);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);

      let panel = '';
      panel += `\n<span style="color:var(--accent1)">\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550</span>\n`;
      panel += ` <span style="color:var(--text)">TRANSIT TO:</span> <span style="color:var(--accent3);font-weight:700">${targetPlanet.name}</span>\n`;
      panel += ` <span style="color:var(--text)">DISTANCE:</span>   <span style="color:var(--green)">${targetPlanet.orbit.au.toFixed(2)} AU</span>\n`;
      panel += ` <span style="color:var(--text)">ETA:</span>        <span style="color:var(--green)">${bar} ${Math.floor(progress * 100)}%</span>\n`;
      panel += `<span style="color:var(--accent1)">\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550</span>`;

      if (progress >= 1) {
        panel += `\n\n<span style="color:var(--green);font-weight:700;text-align:center;display:block">\u25C9 ENTERING ORBIT \u25C9</span>`;
      }

      container.innerHTML = `<pre style="font-family:var(--font);line-height:1.3;font-size:13px;margin:0;color:var(--text-dim)">${html}${panel}</pre>`;

      if (progress < 1) {
        this._animFrame = requestAnimationFrame(animate);
      } else {
        setTimeout(() => callback(), 800);
      }
    };

    this._animFrame = requestAnimationFrame(animate);
  },

  // ═══════════════════════════════════════════════════════════════
  // LANDING SEQUENCE
  // ═══════════════════════════════════════════════════════════════
  playLanding(targetPlanet, callback) {
    const container = document.getElementById('screen-container');
    const width = 60;
    const height = 25;
    const duration = 3000;
    const startTime = Date.now();

    // Generate terrain line based on biome weights
    const r = seedRng(targetPlanet.seed + ':landing');
    const terrainChars = [];
    const biomeEntries = Object.entries(targetPlanet.terrainWeights);
    for (let i = 0; i < width; i++) {
      const total = biomeEntries.reduce((s, e) => s + e[1], 0);
      let roll = r() * total, biome = 'plains';
      for (const [b, wt] of biomeEntries) { roll -= wt; if (roll <= 0) { biome = b; break; } }
      terrainChars.push(BIOME_CHARS[biome] || '.');
    }

    // Generate mountain profile
    const heights = [];
    for (let i = 0; i < width; i++) {
      const h = Math.floor(lerp(1, 8, r()));
      heights.push(terrainChars[i] === '^' ? h + 3 : terrainChars[i] === '~' ? 1 : h);
    }

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Surface rises from bottom
      const surfaceStart = Math.floor(height - progress * (height * 0.6));

      let html = '';
      // Sky
      for (let y = 0; y < height; y++) {
        let line = '';
        for (let x = 0; x < width; x++) {
          if (y >= surfaceStart) {
            const terrainRow = y - surfaceStart;
            const h = heights[x];
            if (terrainRow >= (8 - h)) {
              line += `<span style="color:${BIOME_COLORS[Object.keys(BIOME_CHARS).find(b => BIOME_CHARS[b] === terrainChars[x])] || 'var(--text-dim)'}">${terrainChars[x]}</span>`;
            } else {
              line += ' ';
            }
          } else {
            // Stars in sky, fading
            if (r() < 0.01 * (1 - progress)) line += '\u00B7';
            else line += ' ';
          }
        }
        html += line + '\n';
      }

      // Overlay
      if (progress < 0.8) {
        html += `\n<span style="color:var(--accent1);text-align:center;display:block">DESCENDING TO ${targetPlanet.name.toUpperCase()}</span>`;
      } else {
        html += `\n<span style="color:var(--green);font-weight:700;text-align:center;display:block">TOUCHDOWN CONFIRMED</span>`;
      }

      container.innerHTML = `<pre style="font-family:var(--font);line-height:1.2;font-size:13px;margin:0;color:var(--text-dim)">${html}</pre>`;

      if (progress < 1) {
        this._animFrame = requestAnimationFrame(animate);
      } else {
        setTimeout(() => callback(), 600);
      }
    };

    this._animFrame = requestAnimationFrame(animate);
  },

  // ═══════════════════════════════════════════════════════════════
  // GALAXY JUMP ANIMATION
  // ═══════════════════════════════════════════════════════════════
  playGalaxyJump(callback) {
    this.show(true);
    const container = document.getElementById('screen-container');
    const width = 65;
    const height = 30;
    const duration = 5000;
    const startTime = Date.now();
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);

    // Pre-generate spiral arm points
    const armPoints = [];
    const numArms = 4;
    for (let arm = 0; arm < numArms; arm++) {
      const armOffset = (arm / numArms) * Math.PI * 2;
      for (let i = 0; i < 120; i++) {
        const t = i / 120;
        const r = t * Math.min(cx - 1, cy - 1);
        const angle = armOffset + t * 3.5; // spiral tightness
        const spread = t * 1.5;
        const px = Math.cos(angle) * r * 1.6 + (Math.random() - 0.5) * spread * 3;
        const py = Math.sin(angle) * r + (Math.random() - 0.5) * spread * 2;
        const brightness = Math.random();
        armPoints.push({ px, py, brightness, dist: r });
      }
    }

    // Core bulge points
    const corePoints = [];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 4;
      corePoints.push({
        px: Math.cos(angle) * r * 1.6,
        py: Math.sin(angle) * r,
        brightness: 0.5 + Math.random() * 0.5
      });
    }

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const rotation = progress * 0.8; // galaxy rotates during approach

      const grid = [];
      for (let y = 0; y < height; y++) {
        grid.push(new Array(width).fill(' '));
      }

      // Scale: galaxy appears to approach
      const scale = lerp(0.3, 1.0, Math.min(1, progress * 1.5));

      // Draw spiral arms
      armPoints.forEach(p => {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const rx = (p.px * cos - p.py * sin) * scale;
        const ry = (p.px * sin + p.py * cos) * scale;
        const sx = Math.round(cx + rx);
        const sy = Math.round(cy + ry);
        if (sx >= 0 && sx < width && sy >= 0 && sy < height && grid[sy][sx] === ' ') {
          if (p.brightness > 0.8) grid[sy][sx] = '*';
          else if (p.brightness > 0.5) grid[sy][sx] = '+';
          else if (p.brightness > 0.2) grid[sy][sx] = '\u00B7';
          else grid[sy][sx] = '.';
        }
      });

      // Draw core bulge
      corePoints.forEach(p => {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const rx = (p.px * cos - p.py * sin) * scale;
        const ry = (p.px * sin + p.py * cos) * scale;
        const sx = Math.round(cx + rx);
        const sy = Math.round(cy + ry);
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          grid[sy][sx] = p.brightness > 0.7 ? '\u2588' : '\u2593';
        }
      });

      // Black hole at center
      grid[cy][cx] = '\u25CF';
      if (cx > 0) grid[cy][cx - 1] = '\u25CB';
      if (cx < width - 1) grid[cy][cx + 1] = '\u25CB';

      // Render
      let html = '';
      for (let y = 0; y < height; y++) {
        let line = '';
        for (let x = 0; x < width; x++) {
          const ch = grid[y][x];
          if (x === cx && y === cy) {
            line += `<span style="color:var(--accent2);font-weight:700">${ch}</span>`;
          } else if ((x === cx - 1 || x === cx + 1) && y === cy) {
            line += `<span style="color:var(--accent2)">${ch}</span>`;
          } else if (ch === '\u2588' || ch === '\u2593') {
            line += `<span style="color:var(--orange)">${ch}</span>`;
          } else if (ch === '*') {
            line += `<span style="color:var(--text)">${ch}</span>`;
          } else if (ch !== ' ') {
            line += `<span style="color:var(--text-dim)">${ch}</span>`;
          } else {
            line += ch;
          }
        }
        html += line + '\n';
      }

      // Panel
      let panel = '';
      const barLen = 30;
      const filled = Math.floor(progress * barLen);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);

      panel += `\n<span style="color:var(--accent2)">\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550</span>\n`;
      panel += ` <span style="color:var(--text)">INTERSTELLAR TRANSIT</span>\n`;
      panel += ` <span style="color:var(--text)">STATUS:</span>     <span style="color:var(--green)">${bar} ${Math.floor(progress * 100)}%</span>\n`;
      panel += `<span style="color:var(--accent2)">\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550</span>`;

      if (progress >= 1) {
        panel += `\n\n<span style="color:var(--green);font-weight:700;text-align:center;display:block">\u25C9 NEW SYSTEM DETECTED \u25C9</span>`;
      }

      container.innerHTML = `<pre style="font-family:var(--font);line-height:1.2;font-size:13px;margin:0">${html}${panel}</pre>`;

      if (progress < 1) {
        this._animFrame = requestAnimationFrame(animate);
      } else {
        setTimeout(() => callback(), 800);
      }
    };

    this._animFrame = requestAnimationFrame(animate);
  },

  stopAnimation() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }
};
