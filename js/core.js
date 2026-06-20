// ═══════════════════════════════════════════════════════════════
// CORE: RNG, Constants, Event Bus, Utilities
// ═══════════════════════════════════════════════════════════════

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0}return h>>>0}
function seedRng(seed){return mulberry32(typeof seed==='number'?seed:hashStr(String(seed)))}
function tileRng(seed,x,y){return mulberry32(hashStr(seed+':'+x+':'+y))}
function systemRng(seed,system,x,y){return mulberry32(hashStr(seed+':'+system+':'+x+':'+y))}
function lerp(a,b,t){return a+(b-a)*t}

// Physical constants
const G_CONST=6.674e-11,STEFAN_BOLTZMANN=5.670e-8,BOLTZMANN=1.381e-23,WIEN=2.898e-3;
const EARTH_MASS=5.972e24,EARTH_RADIUS=6.371e6,SUN_LUMINOSITY=3.828e26,SUN_TEMP=5778,AU=1.496e11;

// Star classification
const STAR_TYPES={
  M:{tempRange:[2400,3700],massRange:[0.08,0.45],lumFactor:[0.001,0.08],color:'#ff6644'},
  K:{tempRange:[3700,5200],massRange:[0.45,0.8],lumFactor:[0.08,0.6],color:'#ffaa44'},
  G:{tempRange:[5200,6000],massRange:[0.8,1.04],lumFactor:[0.6,1.5],color:'#ffff88'},
  F:{tempRange:[6000,7500],massRange:[1.04,1.4],lumFactor:[1.5,5.0],color:'#ffffff'}
};

// Spectral element data
const ELEMENTS_SPECTRAL={
  Hydrogen:{lines:[410.2,434.0,486.1,656.3],color:'#ff4444'},
  Helium:{lines:[388.9,447.1,501.6,587.6,667.8],color:'#ffaa00'},
  Carbon:{lines:[426.7,505.2,538.0],color:'#888888'},
  Nitrogen:{lines:[399.5,444.7,463.1,500.5,567.9],color:'#4488ff'},
  Oxygen:{lines:[436.8,532.9,543.5,615.6,777.4],color:'#44ff88'},
  Iron:{lines:[382.0,404.6,438.4,489.1,516.7,527.0],color:'#cc8844'},
  Silicon:{lines:[390.6,412.8,505.6,634.7],color:'#aaaacc'},
  Sodium:{lines:[589.0,589.6],color:'#ffff00'},
  Calcium:{lines:[393.4,396.8,422.7],color:'#ff88ff'},
  Magnesium:{lines:[382.9,383.8,516.7,517.3,518.4],color:'#88ffaa'},
  Titanium:{lines:[398.2,430.6,453.3,498.2],color:'#cc88ff'},
  Sulfur:{lines:[415.3,469.4,545.4,564.0],color:'#ffff44'}
};

// Biome display data
const BIOME_CHARS={plains:'.',mountain:'^',cave:'\u25CB',ocean:'~',volcanic:'\u25B2',ice:'\u2744',forest:'\u2663',desert:'\u2591',marsh:'\u2248'};
const BIOME_NAMES={plains:'Plains',mountain:'Mountains',cave:'Cave Entrance',ocean:'Ocean Shore',volcanic:'Volcanic Field',ice:'Ice Sheet',forest:'Xeno-Forest',desert:'Arid Desert',marsh:'Marshland'};
const BIOME_COLORS={plains:'var(--green)',mountain:'var(--text)',cave:'var(--text-dim)',ocean:'#4488ff',volcanic:'var(--orange)',ice:'#88ccff',forest:'#44cc88',desert:'#ccaa44',marsh:'#4488aa'};

// Event bus — decouple systems
const Events = {
  _listeners: {},
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },
  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }
};
