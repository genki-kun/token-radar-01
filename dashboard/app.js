// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// three views over one dataset: the ranked pre-token board, the live-token peer set the model
// learns from, and the method page that states the model. A detail dialog shows each protocol's
// figures, its model breakdown (recomputed in the page, checked against the board's number) and
// its farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { tab: 'board', q: '', category: 'all', chain: 'all', sort: 'implied', watch: false, clean: false, selected: null };
  var M = DATA.model;

  var usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFmt.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y (' + days + 'd)';
    return days + 'd';
  }
  function fmtX(n) { return n === null || n === undefined ? 'n/a' : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0') + 'x'; }
  function catOf(r) { return r.category || 'Uncategorized'; }
  function catStats(name) {
    for (var i = 0; i < DATA.categories.length; i++) if (DATA.categories[i].category === name) return DATA.categories[i];
    return null;
  }
  // The model, recomputed in the page from the row's own figures and the stated constants, so the
  // detail view can check its arithmetic against the number board.json carries.
  function impliedOf(row) {
    var st = catStats(catOf(row));
    var mult = st ? st.multiple : DATA.global_median_ratio;
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : Math.min(M.momentum_cap, Math.max(M.momentum_floor, row.change_7d));
    var momentum = 1 + (g / 100) * M.momentum_weight;
    var age = row.age_days === null || row.age_days === undefined ? DATA.imputed_age_days : row.age_days;
    var maturity = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
    var breadth = 1 + M.breadth_per_chain * Math.min(Math.max(row.chains.length - 1, 0), M.breadth_max_extra);
    return Math.max(1, Math.round(row.tvl_usd * mult * momentum * maturity * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('watch') === '1') state.watch = true;
    if (params.get('clean') === '1') state.clean = true;
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.watch) params.set('watch', '1');
    if (state.clean) params.set('clean', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }

  function header() {
    function tab(id, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === id ? 'true' : 'false', text: label, onclick: function () { state.tab = id; state.selected = null; writeHash(); render(); } });
    }
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name' }, 'TOKEN ', el('em', { text: 'RADAR' }))),
      el('div', { class: 'tabs' }, tab('board', 'Pre-token board'), tab('live', 'Live tokens'), tab('method', 'Method')),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'Model ' + DATA.model_version }),
        el('span', { text: DATA.protocols_size + ' protocols' })
      )
    );
  }

  function footer() {
    return el('footer', null,
      el('p', { text: 'Source: ' + DATA.source + '. Implied value is this radar\'s model output: an estimate of what a launch would be worth if the protocol\'s record stayed as it is. It is not a price, not a prediction that a token will be issued, and not advice. A protocol here records no token in the snapshot; that is DefiLlama\'s record, not proof that none exists.' })
    );
  }

  // ------------------------------------------------------------- board view
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && catOf(r) !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watch && !r.on_watchlist) return false;
      if (state.clean && r.caution) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  var SORTS = {
    implied: { label: 'Implied value', key: function (r) { return r.implied_value_usd; } },
    priority: { label: 'Priority (implied x base rate)', key: function (r) { return r.priority_usd; } },
    tvl: { label: 'TVL', key: function (r) { return r.tvl_usd; } },
    growth: { label: '7d change', key: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; } },
    age: { label: 'Age (oldest first)', key: function (r) { return r.age_days === null ? -1 : r.age_days; } },
    rate: { label: 'Launch base rate', key: function (r) { return r.launch_base_rate; } },
    name: { label: 'Name A-Z', key: null }
  };
  function sortedRows(list) {
    var s = SORTS[state.sort] || SORTS.implied;
    return list.slice().sort(function (a, b) {
      if (s.key === null) return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
      var d = s.key(b) - s.key(a);
      if (d !== 0) return d;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', null, 'Every pre-token protocol, ', el('span', { class: 'hl', text: 'ranked by what its launch would be worth' })),
        el('p', { text: 'The radar scans all ' + DATA.protocols_size + ' protocols in the snapshot, sets the ' + DATA.tokenized_size + ' that already record a token aside as the peer set, and ranks the ' + DATA.pre_token_size + ' that record none. The multiple behind each rank is learned from the peers in the protocol\'s own category, never assigned by hand. The house watchlist (' + DATA.watchlist_size + ' protocols at or above ' + fmtUsd(DATA.floor_usd) + ' TVL) is the floor: all of it is covered, and ' + (DATA.pre_token_size - DATA.watchlist_size) + ' smaller or watchlist-excluded protocols are ranked below and beside it.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Protocols scanned' }), el('b', { text: String(DATA.protocols_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token ranked' }), el('b', { text: String(DATA.pre_token_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Peer median mcap / TVL' }), el('b', { text: fmtX(DATA.global_median_ratio) }))
      )
    );
  }

  function controls() {
    var cats = DATA.categories.filter(function (c) { return c.pre_token > 0; }).map(function (c) { return c.category; }).sort();
    var chainCount = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCount[c] = (chainCount[c] || 0) + 1; }); });
    var chains = Object.keys(chainCount).sort(function (a, b) { return chainCount[b] - chainCount[a] || (a < b ? -1 : 1); });
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); renderTableOnly(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      cats.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); renderTableOnly(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c + ' (' + chainCount[c] + ')', selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); renderTableOnly(); });
    var sortSel = el('select', { id: 'sort', 'aria-label': 'Sort the board' },
      Object.keys(SORTS).map(function (k) { return el('option', { value: k, text: SORTS[k].label, selected: k === state.sort ? 'selected' : null }); })
    );
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; writeHash(); renderTableOnly(); });
    var watchBox = el('input', { type: 'checkbox', id: 'watch' });
    if (state.watch) watchBox.setAttribute('checked', '');
    watchBox.addEventListener('change', function () { state.watch = watchBox.checked; writeHash(); renderTableOnly(); });
    var cleanBox = el('input', { type: 'checkbox', id: 'clean' });
    if (state.clean) cleanBox.setAttribute('checked', '');
    cleanBox.addEventListener('change', function () { state.clean = cleanBox.checked; writeHash(); renderTableOnly(); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort by' }), sortSel),
      el('div', { class: 'checks' },
        el('label', null, watchBox, ' Watchlist only'),
        el('label', null, cleanBox, ' House-rule clean')
      ),
      el('span', { class: 'count', id: 'rowcount' })
    );
  }

  var tableHost = null;
  var countHost = null;
  function boardTable() {
    var list = sortedRows(filteredRows());
    if (countHost) countHost.textContent = list.length + ' of ' + DATA.board_size + ' rows shown';
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { class: 'sub', text: 'Clear the search, or relax the watchlist and house-rule toggles.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; state.clean = false; writeHash(); render(); } })
      ));
    }
    var max = 0;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var badges = [];
      if (r.on_watchlist) badges.push(el('span', { class: 'badge watch', text: 'WATCHLIST' }));
      if (r.caution) badges.push(el('span', { class: 'badge caution', text: 'CAUTION' }));
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'rank', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }), badges,
          el('span', { class: 'sub', text: catOf(r) + ' · ' + ((r.chains || []).slice(0, 3).join(', ') || 'no chain listed') + (r.chains && r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtX(r.model.category_multiple) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: Math.round(r.launch_base_rate * 100) + '%' }),
        el('td', { class: 'num', text: fmtUsd(r.priority_usd) })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Pre-token protocols ranked by implied value. Base rate: the share of the protocol\'s category that already records a token. Priority = implied value x base rate. Select a row for its model breakdown and farm plan.' }),
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Rank' }), el('th', { scope: 'col', text: 'Protocol' }),
          el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }),
          el('th', { scope: 'col', text: 'Age, no token' }), el('th', { scope: 'col', text: 'x Mult' }),
          el('th', { scope: 'col', text: 'Implied value' }), el('th', { scope: 'col', text: 'Base rate' }),
          el('th', { scope: 'col', text: 'Priority' })
        )),
        tbody
      )
    ));
  }
  function renderTableOnly() {
    if (!tableHost) { render(); return; }
    var fresh = boardTable();
    tableHost.replaceWith(fresh);
    tableHost = fresh;
    var c = document.getElementById('rowcount');
    if (c) countHost = c;
  }

  // ------------------------------------------------------------- live view
  var liveHost = null;
  function liveTable() {
    var q = state.q.trim().toLowerCase();
    var list = DATA.live.filter(function (r) {
      if (!q) return true;
      return [r.name, r.slug, r.category, r.symbol, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var ratio = r.mcap_usd !== null && r.tvl_usd > 0 ? fmtX(r.mcap_usd / r.tvl_usd) : 'n/a';
      tbody.appendChild(el('tr', { style: 'cursor:default' },
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }),
          r.symbol ? el('span', { class: 'badge watch', text: r.symbol }) : null,
          el('span', { class: 'sub', text: catOf(r) + ' · ' + ((r.chains || []).slice(0, 3).join(', ') || 'no chain listed') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: r.mcap_usd === null ? 'not in snapshot' : fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: ratio }),
        el('td', null, el('span', { class: 'sub', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null,
      el('caption', { class: 'sub', text: list.length + ' live-token protocols shown, by market cap.' }),
      el('thead', null, el('tr', null, el('th', { text: 'Protocol' }), el('th', { text: 'TVL' }), el('th', { text: '7d' }), el('th', { text: 'Market cap' }), el('th', { text: 'Mcap / TVL' }), el('th', { text: 'Status' }))),
      tbody
    )));
  }
  function liveView() {
    var withMcap = DATA.live.filter(function (r) { return r.mcap_usd !== null; }).length;
    var search = el('input', { type: 'search', id: 'lq', placeholder: 'Search the live set', value: state.q, 'aria-label': 'Search live tokens' });
    search.addEventListener('input', function () {
      state.q = search.value; writeHash();
      if (liveHost) { var fresh = liveTable(); liveHost.replaceWith(fresh); liveHost = fresh; }
    });
    liveHost = liveTable();
    return el('div', null,
      el('section', { class: 'lede' }, el('div', null,
        el('h1', null, 'Already trading: ', el('span', { class: 'hl', text: 'the peer set' })),
        el('p', { text: 'These ' + DATA.tokenized_size + ' protocols record a token, so they are never ranked: their value is a market fact, not a model. ' + withMcap + ' of them carry a market cap in the snapshot, and their market-cap-to-TVL ratios are exactly what the board\'s category multiples are learned from (see Method). The rest record a token but no market cap here, so they teach the model nothing and are listed for completeness.' })
      )),
      el('div', { class: 'controls' }, el('div', { class: 'field' }, el('label', { for: 'lq', text: 'Search' }), search)),
      liveHost
    );
  }

  // ------------------------------------------------------------- method view
  function methodView() {
    var g = DATA.global_median_ratio;
    var catRows = DATA.categories.map(function (c) {
      return el('tr', null,
        el('td', null, el('b', { text: c.category })),
        el('td', { class: 'num', text: String(c.protocols) }),
        el('td', { class: 'num', text: String(c.pre_token) }),
        el('td', { class: 'num', text: String(c.peers) }),
        el('td', { class: 'num', text: c.median_ratio === null ? 'none' : fmtX(c.median_ratio) }),
        el('td', { class: 'num', text: fmtX(c.multiple) }),
        el('td', { class: 'num', text: Math.round(c.tokenized_share * 100) + '%' })
      );
    });
    function factor(name, range, reads, why) {
      return el('tr', null, el('td', null, el('b', { text: name })), el('td', { class: 'num', text: range }), el('td', { text: reads }), el('td', { text: why }));
    }
    return el('div', { class: 'method' },
      el('section', { class: 'panel' },
        el('h2', { text: 'The value model (' + DATA.model_version + ')' }),
        el('p', { text: 'One function scores every pre-token protocol from the snapshot\'s own figures. No protocol name is special-cased and no row is hand-picked. The core idea: a protocol that already trades is evidence. Its market cap divided by its TVL is what the market paid for a dollar of TVL in a protocol of that kind, so the model learns one such multiple per category from the ' + DATA.peer_count + ' tokenized peers that carry both figures, and prices each pre-token protocol at its own category\'s multiple, adjusted by three further factors read from its own record.' }),
        el('div', { class: 'formula' },
          'ratio(peer)      = clamp(mcap / TVL, ' + M.ratio_floor + ', ' + M.ratio_cap + ')\n' +
          'multiple(cat)    = clamp( (n x median ratio(cat) + ' + M.shrink_k + ' x ' + g.toFixed(4) + ') / (n + ' + M.shrink_k + '), ' + M.multiple_floor + ', ' + M.multiple_cap + ')\n' +
          'implied value    = round( TVL x multiple(cat) x momentum x maturity x breadth )\n' +
          'momentum         = 1 + clamp(change_7d, ' + M.momentum_floor + ', ' + M.momentum_cap + ') / 100 x ' + M.momentum_weight + '\n' +
          'maturity         = ' + M.maturity_floor + ' + ' + M.maturity_range + ' x min(age_days, ' + M.maturity_days + ') / ' + M.maturity_days + '\n' +
          'breadth          = 1 + ' + M.breadth_per_chain + ' x min(chains - 1, ' + M.breadth_max_extra + ')'
        ),
        el('p', { text: 'The shrinkage term is the honest part. Category samples are small and wild: one prediction-market peer sits at 400x TVL before clamping. A category with a single peer is pulled most of the way toward the market-wide median (' + fmtX(g) + '); a category with fifteen peers mostly speaks for itself. Every multiple is also clamped to [' + M.multiple_floor + 'x, ' + M.multiple_cap + 'x]. Where DefiLlama reports no listing date, the maturity factor uses the pre-token set\'s median age, ' + DATA.imputed_age_days + ' days, and the detail view says so.' }),
        el('table', null,
          el('thead', null, el('tr', null, el('th', { text: 'Factor' }), el('th', { text: 'Range' }), el('th', { text: 'What it reads' }), el('th', { text: 'Why it is there' }))),
          el('tbody', null,
            factor('Category multiple', M.multiple_floor + 'x - ' + M.multiple_cap + 'x', 'TVL and the category\'s peer ratios', 'A dollar of lending TVL and a dollar of bridge TVL have never been priced alike; the snapshot\'s own trades say by how much.'),
            factor('Momentum', (1 + M.momentum_floor / 100 * M.momentum_weight).toFixed(3) + 'x - ' + (1 + M.momentum_cap / 100 * M.momentum_weight).toFixed(3) + 'x', 'change_7d, clamped to [' + M.momentum_floor + '%, +' + M.momentum_cap + '%]', 'A protocol gaining TVL is worth more at launch than one bleeding it; the clamp keeps one vertical week (the snapshot\'s largest is +4,448%) from pricing a row.'),
            factor('Maturity', M.maturity_floor + 'x - ' + (M.maturity_floor + M.maturity_range) + 'x', 'Days since listed_at: how long it has run with no token', 'A launch after four proven years is a bigger event than one after four weeks; the factor saturates so age alone cannot dominate.'),
            factor('Breadth', '1.00x - ' + (1 + M.breadth_per_chain * M.breadth_max_extra) + 'x', 'The chains array\'s length', 'A protocol live on eight chains addresses more users at launch than the same TVL on one.')
          )
        ),
        el('h3', { text: 'Launch base rate and priority' }),
        el('p', { text: 'Beside each implied value the board shows its category\'s base rate: the share of that category\'s protocols that already record a token, shrunk toward the market-wide share the same way. It is a base rate read off the snapshot, not a forecast. The Priority column multiplies the two (implied x base rate) and exists as a sort, so a reader can weigh a huge hypothetical in a category that rarely launches against a smaller one in a category that usually does. The rank itself is always the implied value.' })
      ),
      el('section', { class: 'panel' },
        el('h2', { text: 'Category evidence' }),
        el('p', { text: 'Every category in the snapshot, the peers the model could learn from, and the multiple it settled on. This table is computed from the snapshot at run time; re-running the program on a future snapshot relearns it.' }),
        el('div', { class: 'table-wrap' }, el('table', null,
          el('thead', null, el('tr', null, el('th', { text: 'Category' }), el('th', { text: 'Protocols' }), el('th', { text: 'Pre-token' }), el('th', { text: 'Peers w/ mcap' }), el('th', { text: 'Median mcap/TVL' }), el('th', { text: 'Multiple used' }), el('th', { text: 'Base rate' }))),
          el('tbody', null, catRows)
        ))
      ),
      el('section', { class: 'panel' },
        el('h2', { text: 'Who is ranked, who is not, and the cautions' }),
        el('p', { text: 'A protocol is pre-token when the snapshot records no token for it: both gecko_id and symbol are null. All ' + DATA.pre_token_size + ' such protocols are ranked, including every one of the ' + DATA.watchlist_size + ' watchlist protocols. The ' + DATA.tokenized_size + ' protocols that record a token are never ranked; they are the peer set on the Live tokens tab.' }),
        el('p', { text: 'Some ranked rows carry a CAUTION badge. The house watchlist applies extra tests at its $50M floor: no exchanges, no names ending in a version marker, no exchange-branded products, and no categories it treats as wrapped, staked or bridged products of a token that already trades. This board ranks those protocols too (the watchlist is a floor, not a ceiling), but flags each with the reason the watchlist leaves it out, and the "House-rule clean" toggle hides them. WBTC is the honest example: DefiLlama\'s record for it carries no token fields, so mechanically it is pre-token in this snapshot and it is ranked, flagged as a bridged product, rather than quietly deleted or quietly trusted.' })
      ),
      el('section', { class: 'panel' },
        el('h2', { text: 'Farm plans' }),
        el('p', { text: 'Each protocol\'s plan is generated from its own record, not written by hand: its category picks the playbook (supply and borrow for lending, routed volume for bridges, swaps and liquidity for DEXes, staking and receipt use for liquid staking, hedged activity for derivatives, deposits for vaults and curators, traded volume for exchanges), its first chain picks the gas tier behind the cost estimates (Ethereum-priced, mid, or cheap-chain), its TVL picks the capital tier ($75 to $1,000), its age picks the hold (6 to 10 weeks), and its own seven-day figure writes the risk note in the middle of the plan. Every step states a cost and a time. Fee totals count gas and fees only; the capital stays the farmer\'s and is shown separately.' })
      ),
      el('section', { class: 'panel' },
        el('h2', { text: 'Limits, stated plainly' }),
        el('ul', null,
          el('li', null, el('b', { text: 'Peer ratios are noisy. ' }), 'A token\'s market cap belongs to the whole token while DefiLlama splits TVL across versions and pools, so one peer\'s ratio can be far off its category\'s truth. Medians, winsorizing to [' + M.ratio_floor + 'x, ' + M.ratio_cap + 'x] and shrinkage are the defence; they reduce the noise, they do not remove it.'),
          el('li', null, el('b', { text: 'The snapshot is one frozen day (' + DATA.as_of + '). ' }), 'TVL, momentum and ages are read as of that day and never updated by this page. A protocol\'s record may have changed since.'),
          el('li', null, el('b', { text: 'Implied value is not a prediction. ' }), 'It prices a hypothetical launch at today\'s record. It says nothing about whether a token will be issued, when, or what it would trade at a month later.'),
          el('li', null, el('b', { text: 'No token recorded is not no token. ' }), 'DefiLlama\'s record is the input, and the record can lag reality; the cautions flag the cases the house rule already knows about.'),
          el('li', null, el('b', { text: 'Costs are planning estimates. ' }), 'Gas tiers are per-chain averages in USD at the time of writing; a congested week costs more. Farm plans are checklists for a reader\'s own research, not instructions to transact.')
        )
      )
    );
  }

  // ------------------------------------------------------------- detail dialog
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); renderTableOnly(); });

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    var st = catStats(catOf(row));
    var m = row.model;
    var check = impliedOf(row);
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'RANK ' + row.rank + ' OF ' + DATA.board_size + ' · PRE-TOKEN · NO TOKEN ON RECORD' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: catOf(row) + ' · ' + ((row.chains || []).join(', ') || 'no chain listed') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var facts = el('div', { class: 'statgrid' },
      el('div', { class: 'fact' }, el('span', { text: 'TVL' }), el('b', { text: fmtUsd(row.tvl_usd) })),
      el('div', { class: 'fact' }, el('span', { text: '7d change' }), el('b', { text: fmtPct(row.change_7d) })),
      el('div', { class: 'fact' }, el('span', { text: 'Age, no token' }), el('b', { text: fmtAge(row.age_days) })),
      el('div', { class: 'fact' }, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(row.implied_value_usd) })),
      el('div', { class: 'fact' }, el('span', { text: 'Priority (x base rate)' }), el('b', { text: fmtUsd(row.priority_usd) })),
      el('div', { class: 'fact' }, el('span', { text: 'Launch base rate' }), el('b', { text: Math.round(row.launch_base_rate * 100) + '%' })),
      el('div', { class: 'fact' }, el('span', { text: 'Listed by DefiLlama' }), el('b', { text: row.listed_at || 'not reported' })),
      el('div', { class: 'fact' }, el('span', { text: 'Watchlist' }), el('b', { text: row.on_watchlist ? 'Yes' : 'Below / outside' }))
    );
    var peerNote = st && st.peers > 0
      ? catOf(row) + ' peers: median mcap/TVL ' + fmtX(st.median_ratio) + ' across ' + st.peers + ' peer' + (st.peers === 1 ? '' : 's') + ' with a market cap, shrunk toward the ' + fmtX(DATA.global_median_ratio) + ' market median'
      : 'No ' + catOf(row) + ' peer records a market cap, so the market median multiple applies';
    var wf = el('table', { class: 'waterfall' },
      el('tbody', null,
        el('tr', null, el('td', { text: 'TVL (snapshot)' }), el('td', { class: 'num', text: fmtUsd(row.tvl_usd) }), el('td', { class: 'sub', text: 'DefiLlama, ' + DATA.as_of })),
        el('tr', null, el('td', { text: 'x Category multiple' }), el('td', { class: 'num', text: fmtX(m.category_multiple) }), el('td', { class: 'sub', text: peerNote })),
        el('tr', null, el('td', { text: '= Base value' }), el('td', { class: 'num', text: fmtUsd(m.base_usd) }), el('td', { class: 'sub', text: 'TVL priced as its traded peers are priced' })),
        el('tr', null, el('td', { text: 'x Momentum' }), el('td', { class: 'num', text: fmtX(m.momentum_multiplier) }), el('td', { class: 'sub', text: '7d TVL change ' + fmtPct(row.change_7d) + ', clamped to [' + M.momentum_floor + '%, +' + M.momentum_cap + '%], weight ' + M.momentum_weight })),
        el('tr', null, el('td', { text: 'x Maturity' }), el('td', { class: 'num', text: fmtX(m.maturity_multiplier) }), el('td', { class: 'sub', text: row.age_days === null ? 'No listing date reported; the pre-token median age of ' + DATA.imputed_age_days + ' days is used' : row.age_days + ' days run with no token, saturating at ' + M.maturity_days + ' days' })),
        el('tr', null, el('td', { text: 'x Breadth' }), el('td', { class: 'num', text: fmtX(m.breadth_multiplier) }), el('td', { class: 'sub', text: (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') + ' in the record' })),
        el('tr', { class: 'total' }, el('td', { text: '= Implied value' }), el('td', { class: 'num', text: fmtUsd(row.implied_value_usd) }), el('td', { class: 'sub', text: 'The board\'s claim for this row' }))
      )
    );
    dialog.appendChild(el('section', { class: 'detail-section' }, el('h3', { text: 'The protocol in figures' }), facts));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'How the implied value is computed' }), wf,
      el('p', { class: 'sub', text: 'This page recomputes the row from the snapshot figures and the stated constants as ' + fmtUsd(check) + (check === row.implied_value_usd ? ' — the same number board.json carries.' : ' — which differs from the board, so the data would be stale.') + ' Model ' + DATA.model_version + '; an estimate, not a price.' })
    ));
    if (row.caution) {
      dialog.appendChild(el('section', { class: 'detail-section' }, el('div', { class: 'caution-box', text: 'Caution: ' + row.caution })));
    }
    var f = row.farm;
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('div', { class: 'chips' },
        el('span', { class: 'chip' }, 'Capital ', el('b', { text: fmtUsd(f.capital_usd) })),
        el('span', { class: 'chip' }, 'Setup fees ', el('b', { text: '$' + f.setup_cost_usd.toFixed(2) })),
        el('span', { class: 'chip' }, 'Weekly fees ', el('b', { text: '$' + f.weekly_cost_usd.toFixed(2) })),
        el('span', { class: 'chip' }, 'Hold ', el('b', { text: f.weeks + ' weeks' })),
        el('span', { class: 'chip' }, 'Fees all-in ', el('b', { text: '$' + f.total_cost_usd.toFixed(2) }), ' (capital excluded)')
      ),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        return el('li', null, el('b', { text: s.text }), el('span', { class: 'cost sub', text: 'Cost: ' + s.cost + '. Time: ' + s.time + '.' }));
      }))
    ));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    if (state.tab === 'board') {
      liveHost = null;
      shell.appendChild(lede());
      shell.appendChild(controls());
      countHost = shell.querySelector('#rowcount');
      tableHost = boardTable();
      shell.appendChild(tableHost);
      countHost = shell.querySelector('#rowcount');
    } else if (state.tab === 'live') {
      shell.appendChild(liveView());
      tableHost = null;
    } else {
      shell.appendChild(methodView());
      tableHost = null;
      liveHost = null;
    }
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected && state.tab === 'board') openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
