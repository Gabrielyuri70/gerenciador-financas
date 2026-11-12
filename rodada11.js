/* ===== Finanças Pro — Rodada 11: avisos com ícones + calculadora flutuante/acoplável ===== */
const AV_IC = { erro: 'fa-circle-exclamation text-danger', aviso: 'fa-triangle-exclamation text-warning', cartao: 'fa-credit-card', grafico: 'fa-chart-pie', backup: 'fa-floppy-disk' };
function abrirNotificacoes() {
    const a = coletarAvisos(); let m = document.getElementById('modalAvisos');
    if (!m) {
        m = document.createElement('div'); m.className = 'modal fade'; m.id = 'modalAvisos'; m.tabIndex = -1;
        m.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><button type="button" class="btn-close fp-x" data-bs-dismiss="modal" aria-label="Fechar"></button><div class="modal-body p-4"><h5 class="fw-bold mb-3"><i class="fas fa-bell me-2"></i>Lembretes</h5><div id="avisos-lista"></div></div></div></div>';
        document.body.appendChild(m);
    }
    document.getElementById('avisos-lista').innerHTML = a.length ? a.map(s => { const t = (s.match(/^\[(\w+)\]\s*/) || [])[1] || 'aviso'; return '<div class="aviso-item"><i class="fas ' + (AV_IC[t] || AV_IC.aviso) + '"></i><span>' + escaparHTML(s.replace(/^\[\w+\]\s*/, '')) + '</span></div>'; }).join('')
        : '<div class="text-center text-muted py-3"><i class="fas fa-circle-check text-success fs-3 d-block mb-2"></i>Tudo sob controle. Nenhuma pendência urgente.</div>';
    (bootstrap.Modal.getInstance(m) || new bootstrap.Modal(m)).show();
}

// ---------- Calculadora: ícone no topo → painel flutuante → bolha; arrastar até o X devolve ao topo ----------
let _calcEst = 'docked';
function _calcEls() { return { c: document.getElementById('calc-container'), b: document.getElementById('calc-bolha'), x: document.getElementById('calc-alvo') }; }
function setCalc(est) {
    _calcEst = est; const { c, b } = _calcEls();
    c.style.display = est === 'aberta' ? 'flex' : 'none'; b.style.display = est === 'bolha' ? 'flex' : 'none';
    document.querySelectorAll('.calc-dock-btn').forEach(e => e.classList.toggle('d-none', est !== 'docked'));
}
const _cl = (v, mx) => Math.max(4, Math.min(v, mx));
function abrirCalcFlutuante() {
    const { c } = _calcEls(); c.style.display = 'flex';
    if (!c.dataset.posicionada) { c.style.left = _cl(innerWidth - c.offsetWidth - 16, innerWidth - c.offsetWidth - 4) + 'px'; c.style.top = '84px'; c.style.right = 'auto'; c.dataset.posicionada = 1; }
    setCalc('aberta');
}
function minimizarCalc() { const { c, b } = _calcEls(), r = c.getBoundingClientRect(); b.style.left = _cl(r.right - 52, innerWidth - 56) + 'px'; b.style.top = _cl(r.top, innerHeight - 56) + 'px'; setCalc('bolha'); }
function restaurarCalc() { const { c, b } = _calcEls(), r = b.getBoundingClientRect(); c.style.left = _cl(r.right - c.offsetWidth, innerWidth - c.offsetWidth - 4) + 'px'; c.style.top = _cl(r.top, innerHeight - c.offsetHeight - 4) + 'px'; setCalc('aberta'); }
function acoplarCalc() { setCalc('docked'); }
window.toggleCalculadora = function () { if (_calcEst === 'aberta') minimizarCalc(); else abrirCalcFlutuante(); };
function arrastavel(el, handle, aoClicar) {
    let ativo = false, mov = false, sx, sy, ox, oy; const alvo = () => document.getElementById('calc-alvo');
    const noX = (px, py) => { const r = alvo().getBoundingClientRect(); return px >= r.left - 20 && px <= r.right + 20 && py >= r.top - 20 && py <= r.bottom + 20; };
    handle.addEventListener('pointerdown', e => { if (handle !== el && e.target.closest('button')) return; ativo = true; mov = false; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', e => {
        if (!ativo) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (!mov && Math.hypot(dx, dy) < 6) return;
        if (!mov) { mov = true; alvo().style.display = 'flex'; }
        el.style.left = _cl(ox + dx, innerWidth - el.offsetWidth - 4) + 'px'; el.style.top = _cl(oy + dy, innerHeight - 60) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
        alvo().classList.toggle('ativo', noX(e.clientX, e.clientY));
    });
    const fim = e => { if (!ativo) return; ativo = false; const sobre = mov && noX(e.clientX, e.clientY); alvo().style.display = 'none'; alvo().classList.remove('ativo'); if (sobre) acoplarCalc(); else if (!mov && aoClicar) aoClicar(); };
    handle.addEventListener('pointerup', fim); handle.addEventListener('pointercancel', fim);
}
document.addEventListener('DOMContentLoaded', () => {
    const { c } = _calcEls(); if (!c) return;
    const b = document.createElement('button'); b.id = 'calc-bolha'; b.setAttribute('aria-label', 'Calculadora'); b.innerHTML = '<i class="fas fa-calculator"></i>'; document.body.appendChild(b);
    const x = document.createElement('div'); x.id = 'calc-alvo'; x.innerHTML = '<i class="fas fa-xmark"></i><small>Guardar no topo</small>'; document.body.appendChild(x);
    const hd = document.getElementById('calc-header'), ctl = hd.querySelector('.calc-controls');
    if (ctl) { const k = document.createElement('button'); k.title = 'Guardar no topo'; k.innerHTML = '<i class="fas fa-xmark"></i>'; k.onclick = acoplarCalc; ctl.appendChild(k); }
    // bloqueia o arraste antigo (script.js) e usa o novo, que também funciona no toque
    ['mousedown', 'touchstart'].forEach(ev => c.addEventListener(ev, e => { if (e.target.closest('#calc-header')) e.stopPropagation(); }, true));
    hd.style.touchAction = 'none'; b.style.touchAction = 'none';
    arrastavel(c, hd); arrastavel(b, b, restaurarCalc);
    setCalc('docked');
});
