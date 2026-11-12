/* ===== Finanças Pro — Rodada 7: saudação, sequência, atalhos rápidos ===== */
const ACOES = [['Lançar', 'fa-plus', 'novo', 1], ['Entrada', 'fa-circle-arrow-up', 'ajuste-entrada'], ['Saída', 'fa-circle-arrow-down', 'ajuste-saida'], ['Extrato', 'fa-receipt', 'extrato'], ['Cartões', 'fa-credit-card', 'cartoes'], ['Dívidas', 'fa-hand-holding-dollar', 'dividas'], ['Metas', 'fa-bullseye', 'metas'], ['Orçamento', 'fa-gauge-high', 'aba-orcamento'], ['Anual', 'fa-chart-column', 'aba-anual'], ['Previsão', 'fa-forward', 'aba-previsao'], ['Simular', 'fa-calculator', 'aba-simulador'], ['Fixas', 'fa-rotate', 'aba-fixos']];
function irPara(id) {
    if (id.startsWith('ajuste-')) return abrirAjusteSaldo(id.slice(7));
    if (id === 'novo') { abrirModalMov(); const el = document.getElementById('modalMov'); (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show(); return; }
    showSection(id);
}
function sequenciaDias() { // dias seguidos com pelo menos 1 lançamento (hábito = controle)
    const s = new Set(dados.movs.map(m => m.data)), d = new Date(); let n = 0;
    if (!s.has(hojeISO())) d.setDate(d.getDate() - 1);
    for (;;) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (!s.has(k)) break; n++; d.setDate(d.getDate() - 1); }
    return n;
}
const _renderResumoO7 = window.renderResumo;
window.renderResumo = function () {
    _renderResumoO7();
    const card = document.querySelector('.main-balance-card'); if (!card) return;
    const h = new Date().getHours(), nome = ((document.getElementById('txt-nome-usuario-sidebar') || {}).innerText || '').trim(), seq = sequenciaDias();
    if (!document.getElementById('acoes-rapidas')) {
        const a = document.createElement('div'); a.id = 'acoes-rapidas';
        a.innerHTML = ACOES.filter(x => x[2] === 'novo' || x[2].startsWith('ajuste-') || document.getElementById(x[2])).map(x => '<button class="acao-rapida' + (x[3] ? ' destaque' : '') + '" onclick="irPara(\'' + x[2] + '\')"><i class="fas ' + x[1] + '"></i>' + x[0] + '</button>').join('');
        card.after(a);
    }
};
document.addEventListener('click', e => { if (navigator.vibrate && e.target.closest('.nav-btn,.acao-rapida,.btn-add-main,.btn')) navigator.vibrate(8); });
