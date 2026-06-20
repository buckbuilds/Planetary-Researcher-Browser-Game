// ═══════════════════════════════════════════════════════════════
// JOURNAL: Player-owned field notes (no auto-entries)
// ═══════════════════════════════════════════════════════════════

const JOURNAL_CATS = {
  note:        { icon: '\uD83D\uDCDD', label: 'Note',        color: 'var(--accent1)' },
  hypothesis:  { icon: '\uD83D\uDCA1', label: 'Hypothesis',  color: 'var(--orange)' },
  observation: { icon: '\uD83D\uDC41', label: 'Observation', color: 'var(--green)' },
  analysis:    { icon: '\uD83E\uDDEA', label: 'Analysis',    color: 'var(--accent2)' },
  terrain:     { icon: '\uD83D\uDDFA\uFE0F', label: 'Terrain',     color: 'var(--green)' },
  geology:     { icon: '\u26F0\uFE0F', label: 'Geology',     color: 'var(--text)' },
  stellar:     { icon: '\u2B50', label: 'Stellar',     color: 'var(--accent2)' },
  fauna:       { icon: '\uD83D\uDC3E', label: 'Fauna',       color: 'var(--orange)' },
  flora:       { icon: '\uD83C\uDF3F', label: 'Flora',       color: 'var(--accent3)' }
};

const Journal = {
  add(category, title, text) {
    if (!state) return;
    const ps = getCurrentPlanetState();
    const pos = ps ? `${ps.x},${ps.y}` : 'ship';
    const time = ps ? formatTime() : '--:--';
    const entry = {
      id: state.journal.length,
      time: time,
      pos: pos,
      category,
      title,
      text
    };
    state.journal.push(entry);
    Events.emit('journalEntry', entry);
    this.render();
    this.renderStats();
    saveGame();
  },

  writeNote() {
    const input = document.getElementById('journal-input');
    const catSelect = document.getElementById('journal-cat-select');
    const text = input.value.trim();
    if (!text) return;
    const cat = catSelect.value;
    const catInfo = JOURNAL_CATS[cat];
    this.add(cat, catInfo.label + ' Entry', text);
    input.value = '';
  },

  saveLastReading() {
    if (!state.lastReading) return;
    // Switch to journal tab so user sees the result
    const journalBtn = document.querySelector('.tab-bar button');
    if (journalBtn) UI.showTab('journal', journalBtn);
    // Strip HTML tags to get plain text
    const temp = document.createElement('div');
    temp.innerHTML = state.lastReading;
    const plainText = temp.textContent || temp.innerText || '';
    if (!plainText.trim()) return;
    this.add('analysis', 'Saved Instrument Reading', plainText.trim());
  },

  _renderEntries(entries, editable) {
    return entries.slice().reverse().map(e => {
      const cat = JOURNAL_CATS[e.category] || JOURNAL_CATS.note;
      const isNote = ['note','hypothesis','observation','analysis','terrain','geology','stellar','fauna','flora'].includes(e.category);
      const deletBtn = editable ? `<span style="margin-left:auto"><button onclick="event.stopPropagation();Journal.deleteEntry(${e.id})" style="font-size:10px;padding:1px 5px;border-color:var(--orange)">\u2715</button></span>` : '';
      const editAttr = editable ? `contenteditable="true" onblur="Journal.saveInline(${e.id}, this)" style="outline:none;cursor:text"` : '';
      return `<div class="j-entry">
        <div class="j-meta">
          <span class="j-cat" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.icon} ${cat.label}</span>
          <span>${e.time}</span>
          <span>@ ${e.pos}</span>
          ${deletBtn}
        </div>
        <div class="j-text ${isNote ? 'j-note' : ''}" id="j-text-${e.id}" ${editAttr}>${isNote ? e.text : `<strong>${e.title}</strong><br><span class="dim">${e.text}</span>`}</div>
      </div>`;
    }).join('');
  },

  render() {
    const el = document.getElementById('journal-entries');
    if (!state || state.journal.length === 0) {
      el.innerHTML = '<span class="dim">No entries yet.</span>';
      return;
    }
    el.innerHTML = this._renderEntries(state.journal, true);
  },

  search(query) {
    const q = query.toLowerCase().trim();
    const el = document.getElementById('journal-entries');
    if (!state || !q) { this.render(); return; }

    // Search current journal entries
    const currentMatches = state.journal.filter(e =>
      e.text.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
    );

    // Search saved journals by name and entries
    const savedMatches = [];
    if (state.savedJournals) {
      state.savedJournals.forEach((j, i) => {
        if (j.name.toLowerCase().includes(q)) {
          savedMatches.push({ journal: j, index: i, matchType: 'name' });
        } else {
          const hits = j.entries.filter(e =>
            e.text.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)
          );
          if (hits.length > 0) {
            savedMatches.push({ journal: j, index: i, matchType: 'entries', hits });
          }
        }
      });
    }

    let html = '';
    if (currentMatches.length > 0) {
      html += `<div style="color:var(--accent1);font-size:11px;margin-bottom:4px">Current Journal \u2014 ${currentMatches.length} match${currentMatches.length === 1 ? '' : 'es'}</div>`;
      html += this._renderEntries(currentMatches);
    }
    if (savedMatches.length > 0) {
      savedMatches.forEach(m => {
        html += `<div style="color:var(--accent3);font-size:11px;margin:8px 0 4px;cursor:pointer" onclick="Journal.viewSaved(${m.index})">`;
        if (m.matchType === 'name') {
          html += `\uD83D\uDCDA ${m.journal.name} \u2014 ${m.journal.entries.length} entries (name match)`;
        } else {
          html += `\uD83D\uDCDA ${m.journal.name} \u2014 ${m.hits.length} match${m.hits.length === 1 ? '' : 'es'}`;
        }
        html += `</div>`;
        if (m.hits) html += this._renderEntries(m.hits);
      });
    }
    if (!html) {
      html = '<span class="dim">No results.</span>';
    }
    el.innerHTML = html;
  },

  renderStats() {
    const el = document.getElementById('journal-stats');
    if (!state) { el.innerHTML = ''; return; }
    const ps = getCurrentPlanetState();
    const tilesExplored = ps ? Object.keys(ps.explored).length : 0;
    const biomesFound = ps && planet ? Object.keys(ps.biomesFound).length : 0;
    const totalBiomes = planet ? Object.keys(planet.terrainWeights).length : 0;
    const instruments = Knowledge.instrumentCount();
    const species = ps ? ps.catalog.length : 0;
    const anomalyConfirmed = ps ? Anomalies.confirmedCount() : 0;
    const anomalyKnown = ps ? Anomalies.listProgress().length : 0;
    const entries = state.journal.length;

    el.innerHTML = `
      <div class="stat"><span class="stat-val">${instruments}</span><span class="stat-label">/11 instruments</span></div>
      <div class="stat"><span class="stat-val">${biomesFound}</span><span class="stat-label">/${totalBiomes} biomes</span></div>
      <div class="stat"><span class="stat-val">${species}</span><span class="stat-label">species</span></div>
      <div class="stat"><span class="stat-val">${anomalyConfirmed}/${anomalyKnown}</span><span class="stat-label">anomalies</span></div>
      <div class="stat"><span class="stat-val">${tilesExplored}</span><span class="stat-label">tiles</span></div>
      <div class="stat"><span class="stat-val">${entries}</span><span class="stat-label">entries</span></div>
    `;
  },

  saveInline(id, el) {
    const entry = state.journal.find(e => e.id === id);
    if (!entry) return;
    const newText = el.innerText.trim();
    if (newText && newText !== entry.text) {
      entry.text = newText;
      saveGame();
    }
  },

  deleteEntry(id) {
    const entry = state.journal.find(e => e.id === id);
    if (!entry) return;
    if (!confirm('Delete this entry?')) return;
    state.journal = state.journal.filter(e => e.id !== id);
    this.render();
    this.renderStats();
    saveGame();
  },

  archiveJournal() {
    if (!state || state.journal.length === 0) return;
    const name = prompt('Name this journal:');
    if (!name) return;
    if (!state.savedJournals) state.savedJournals = [];
    state.savedJournals.push({
      name: name,
      entries: [...state.journal],
      date: new Date().toLocaleDateString()
    });
    state.journal = [];
    this.render();
    this.renderStats();
    this.renderSavedList();
    saveGame();
  },

  toggleSavedList() {
    const el = document.getElementById('saved-journals');
    if (el.style.display === 'none') {
      el.style.display = 'block';
      this.renderSavedList();
    } else {
      el.style.display = 'none';
    }
  },

  renderSavedList() {
    const el = document.getElementById('saved-journals');
    if (!state || !state.savedJournals || state.savedJournals.length === 0) {
      el.innerHTML = '<span class="dim">No saved journals.</span>';
      return;
    }
    el.innerHTML = state.savedJournals.map((j, i) => `
      <div style="padding:6px 8px;margin-bottom:4px;background:var(--card);border:1px solid var(--card-border);border-radius:3px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--accent3);font-weight:500">${j.name}</span>
          <span class="dim" style="font-size:10px">${j.entries.length} entries \u2022 ${j.date}</span>
        </div>
        <div style="margin-top:4px;display:flex;gap:4px">
          <button onclick="Journal.viewSaved(${i})" style="font-size:11px;padding:2px 6px">View</button>
          <button onclick="Journal.deleteSaved(${i})" style="font-size:11px;padding:2px 6px;border-color:var(--orange)">Delete</button>
        </div>
      </div>
    `).join('');
  },

  viewSaved(index) {
    if (!state.savedJournals || !state.savedJournals[index]) return;
    const j = state.savedJournals[index];
    const el = document.getElementById('journal-entries');
    el.innerHTML = `<div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--card-border)">
      <span style="color:var(--accent3);font-weight:700">${j.name}</span>
      <span class="dim"> \u2014 ${j.entries.length} entries \u2022 ${j.date}</span>
      <button onclick="Journal.render()" style="font-size:10px;padding:1px 6px;margin-left:6px">Back to Current</button>
    </div>` + this._renderEntries(j.entries);
  },

  deleteSaved(index) {
    if (!state.savedJournals || !state.savedJournals[index]) return;
    if (!confirm('Delete "' + state.savedJournals[index].name + '"?')) return;
    state.savedJournals.splice(index, 1);
    this.renderSavedList();
    saveGame();
  }
};
