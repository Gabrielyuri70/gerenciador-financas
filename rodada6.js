/* ===== Finanças Pro — Rodada 6: comparar meses, ordem para quitar dívidas, PIN de bloqueio ===== */
function renderComparar() {
    const ym = _mesSel(), ant = ymAdd(ym, -1);
    const soma = y => { const o = {}; efetivosDe(y).filter(m => m.tipo === 'saida' && m.data && m.data.startsWith(y)).forEach(m => { o[m.cat] = (o[m.cat] || 0) + m.valor; }); return o; };
    const a = soma(ym), b = soma(ant), ta = Object.values(a).reduce((s, v) => s + v, 0), tb = Object.values(b).reduce((s, v) => s + v, 0);
    const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => (a[y] || 0) - (a[x] || 0)), lb = s => s.split('-').reverse().join('/');
    const seta = (n, o) => { const d = n - o; return d === 0 ? '<span class="text-muted">=</span>' : '<b class="money-value ' + (d > 0 ? 'text-danger' : 'text-success') + '">' + (d > 0 ? '▲ +' : '▼ ') + brl(d) + '</b>'; };
    document.getElementById('comp-lista').innerHTML = '<div class="card border-0 shadow-sm rounded-4 p-3 mb-3"><small class="text-muted">Despesas ' + lb(ant) + ' → ' + lb(ym) + '</small><div class="fw-bold money-value">' + brl(tb) + ' → ' + brl(ta) + '</div><div>' + seta(ta, tb) + (tb > 0 ? ' <small class="text-muted">(' + Math.round((ta - tb) / tb * 100) + '%)</small>' : '') + '</div></div>'
        + (ks.map(c => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + escaparHTML(c) + '</b><small class="d-block text-muted money-value">' + brl(b[c] || 0) + ' → ' + brl(a[c] || 0) + '</small></div>' + seta(a[c] || 0, b[c] || 0) + '</div>').join('') || '<p class="text-muted text-center">Sem despesas nos dois meses.</p>');
}
let _estQuitar = 'menor';
function setEstQuitar(e) { _estQuitar = e; renderQuitar(); }
function renderQuitar() {
    const l = dados.dividas.filter(d => d.tipo === 'eu-devo').sort(_estQuitar === 'menor' ? (x, y) => x.valor - y.valor : _estQuitar === 'juros' ? (x, y) => (y.juros || 0) - (x.juros || 0) : (x, y) => (x.prazo || '9999').localeCompare(y.prazo || '9999')); let ac = 0;
    ['menor', 'prazo', 'juros'].forEach(k => { const b = document.getElementById('quit-' + k); if (b) { b.classList.toggle('btn-primary', _estQuitar === k); b.classList.toggle('btn-outline-primary', _estQuitar !== k); } });
    document.getElementById('quit-lista').innerHTML = l.map((d, i) => { ac += d.valor; return '<div class="card-mov py-2 mb-2"><div class="me-3 fw-bold fs-5 text-primary">' + (i + 1) + 'º</div><div class="flex-grow-1"><b>' + escaparHTML(d.nome) + '</b><small class="d-block text-muted">' + (d.prazo ? 'Vence ' + d.prazo.split('-').reverse().join('/') : 'Sem prazo') + ' • acumulado ' + brl(ac) + '</small></div><b class="money-value text-danger">' + brl(d.valor) + '</b></div>'; }).join('') || '<p class="text-muted text-center">Você não tem dívidas a pagar. </p>';
}
// ---------- PIN de bloqueio ----------
const _pinH = p => hashSenha(p, 'pin-fp');
function bloquearApp() {
    if (!dados.config || !dados.config.pin || ehVisitante() || document.getElementById('tela-pin')) return;
    const d = document.createElement('div'); d.id = 'tela-pin';
    d.style.cssText = 'position:fixed;inset:0;z-index:30000;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff;padding:24px';
    d.innerHTML = '<i class="fas fa-lock fa-2x"></i><h5 class="fw-bold">Finanças Pro bloqueado</h5><input id="pin-in" type="password" inputmode="numeric" maxlength="8" class="form-control text-center fs-4" style="max-width:220px;letter-spacing:.4em" placeholder="PIN"><button class="btn btn-light fw-bold px-5" id="pin-ok">Desbloquear</button>';
    document.body.appendChild(d);
    const tentar = () => { if (_pinH(document.getElementById('pin-in').value) === dados.config.pin) d.remove(); else { alert('PIN incorreto!'); document.getElementById('pin-in').value = ''; } };
    document.getElementById('pin-ok').onclick = tentar; document.getElementById('pin-in').addEventListener('keydown', e => { if (e.key === 'Enter') tentar(); }); document.getElementById('pin-in').focus();
}
function configurarPin() {
    if (!verificarAcesso()) return;
    if (dados.config.pin && _pinH(prompt('Digite o PIN atual:') || '') !== dados.config.pin) return alert('PIN incorreto!');
    const n = (prompt('Novo PIN (4 a 8 números). Deixe vazio para remover o bloqueio:') || '').trim();
    if (!n) { delete dados.config.pin; salvarERender(); return alert('Bloqueio por PIN removido.'); }
    if (!/^\d{4,8}$/.test(n)) return alert('Informe de 4 a 8 números.');
    dados.config.pin = _pinH(n); salvarERender(); alert('PIN definido! O app bloqueia ao abrir e após 30 s em segundo plano.');
}
let _ocultoEm = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) _ocultoEm = Date.now(); else if (_ocultoEm && Date.now() - _ocultoEm > 30000) bloquearApp(); });
document.addEventListener('DOMContentLoaded', bloquearApp);
const _showSectionO6 = window.showSection;
window.showSection = function (id, b) { _showSectionO6(id, b); if (id === 'aba-comparar') renderComparar(); if (id === 'aba-quitar') renderQuitar(); };
