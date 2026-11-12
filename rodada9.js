/* ===== Finanças Pro — Rodada 9: Início idêntica à referência (topo + folha branca) ===== */
document.documentElement.dataset.cor = localStorage.getItem('fp_cor') || '';
function alternarCorApp() { const v = document.documentElement.dataset.cor === 'verde' ? '' : 'verde'; document.documentElement.dataset.cor = v; localStorage.setItem('fp_cor', v); alert(v ? 'Tema verde ativado.' : 'Tema roxo (padrão) ativado.'); }
function abrirCalendarioMes() { const i = document.getElementById('hero-mes-input'); i.value = _mesSel(); if (i.showPicker) i.showPicker(); else i.click(); }
const _renderResumoO9 = window.renderResumo;
window.renderResumo = function () {
    _renderResumoO9();
    const sh = document.getElementById('home-sheet'); if (!sh) return;
    const a = document.getElementById('acoes-rapidas'), d = document.getElementById('card-diario'), px = document.getElementById('home-prox-wrap');
    if (a && a.parentNode !== sh) sh.insertBefore(a, px); if (d && d.parentNode !== sh) sh.insertBefore(d, px);
    const n = coletarAvisos().length, b = document.getElementById('hero-badge'); if (b) { b.innerText = n; b.classList.toggle('d-none', n === 0); }
};
document.addEventListener('DOMContentLoaded', () => {
    const i = document.getElementById('hero-mes-input');
    if (i) i.addEventListener('change', () => { if (!i.value) return; const m = document.getElementById('mes-atual'); m.value = i.value; m.dispatchEvent(new Event('change')); });
});

const _showSectionO9 = window.showSection;
window.showSection = function (id, b) { _showSectionO9(id, b); document.body.classList.toggle('na-home', id === 'inicio'); };
document.addEventListener('DOMContentLoaded', () => document.body.classList.add('na-home'));

function aplicarTopoHome(h) { ['.navbar-top', '#barra-mes'].forEach(q => { const e = document.querySelector(q); if (!e) return; if (h) e.style.setProperty('display', 'none', 'important'); else e.style.removeProperty('display'); }); }
const _showSectionO9b = window.showSection;
window.showSection = function (id, b) { _showSectionO9b(id, b); aplicarTopoHome(id === 'inicio'); };
document.addEventListener('DOMContentLoaded', () => {
    aplicarTopoHome(true);
    document.querySelectorAll('.modal-content').forEach(m => { // botão X para fechar em todas as janelas
        if (m.querySelector('.btn-close')) return;
        const x = document.createElement('button'); x.type = 'button'; x.className = 'btn-close fp-x'; x.setAttribute('data-bs-dismiss', 'modal'); x.setAttribute('aria-label', 'Fechar'); m.prepend(x);
    });
});
