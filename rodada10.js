/* ===== Finanças Pro — Rodada 10: mesmo design da Início em todas as telas ===== */
const TITULOS = { 'extrato': 'Extrato', 'cartoes': 'Cartões', 'compras-cartao': 'Cartão', 'dividas': 'Dívidas', 'metas': 'Metas', 'lixeira': 'Lixeira', 'aba-perfil': 'Perfil', 'aba-sobre': 'Sobre', 'aba-notas': 'Notas', 'aba-revenda': 'Revenda', 'aba-graficos': 'Análise de Gastos', 'aba-anual': 'Visão Anual', 'aba-orcamento': 'Orçamento', 'aba-fixos': 'Contas Fixas', 'aba-previsao': 'Previsão', 'aba-simulador': 'Simulador', 'aba-comparar': 'Comparar meses', 'aba-quitar': 'Quitar dívidas' };
const COM_MES = ['extrato', 'cartoes', 'compras-cartao', 'dividas', 'aba-graficos', 'aba-orcamento', 'aba-comparar'];
let _secAtual = 'inicio';
function atualizarTopo() {
    const h = document.getElementById('fp-header'); if (!h) return;
    const mes = _mesSel(), [a, m] = mes.split('-').map(Number), set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    let t = TITULOS[_secAtual] || ''; if (_secAtual === 'compras-cartao') { const e = document.getElementById('titulo-compras-cartao'); if (e && e.textContent.trim()) t = e.textContent.trim().replace(/^Compras:\s*/, ''); }
    set('fp-titulo', t);
    set('fp-mes-ant', MESES_C[(m + 10) % 12]); set('fp-mes-prox', MESES_C[m % 12]); set('fp-mes-atual', MESES_C[m - 1] + (a !== new Date().getFullYear() ? ' ' + a : ''));
    document.getElementById('fp-meses-row').style.display = COM_MES.includes(_secAtual) ? 'flex' : 'none';
    h.style.paddingBottom = COM_MES.includes(_secAtual) ? '44px' : '40px';
    const hero = document.querySelector('#inicio .main-balance-card'); if (hero) h.style.backgroundImage = getComputedStyle(hero).backgroundImage; // mesma cor da Início (roxo/verde)
    const n = coletarAvisos().length, b = document.getElementById('fp-badge'); if (b) { b.innerText = n; b.classList.toggle('d-none', n === 0); }
}
function abrirCalendarioMes2() { const i = document.getElementById('fp-mes-input'); i.value = _mesSel(); if (i.showPicker) i.showPicker(); else i.click(); }
const _showSectionO10 = window.showSection;
window.showSection = function (id, b) { _secAtual = id; _showSectionO10(id, b); atualizarTopo(); window.scrollTo(0, 0); };
const _renderTudoO10 = window.renderTudo;
window.renderTudo = function () { _renderTudoO10(); atualizarTopo(); };
document.addEventListener('DOMContentLoaded', () => {
    const i = document.getElementById('fp-mes-input');
    if (i) i.addEventListener('change', () => { if (!i.value) return; const m = document.getElementById('mes-atual'); m.value = i.value; m.dispatchEvent(new Event('change')); });
});

// ---------- Extrato no mesmo estilo (agrupado por dia, ícones por categoria) ----------
function renderExtrato() {
    const L = document.getElementById('lista-extrato'); if (!L) return;
    const ym = _mesSel(), f = filtroAtual; let e = efetivos().filter(m => m.data && m.data.startsWith(ym));
    if (f === 'fatura') e = e.filter(m => m.virtual); else if (f !== 'tudo') e = e.filter(m => !m.virtual);
    if (f === 'entrada' || f === 'saida') e = e.filter(m => m.tipo === f);
    if (buscaAtual) e = e.filter(m => (m.desc || '').toLowerCase().includes(buscaAtual) || (m.cat || '').toLowerCase().includes(buscaAtual));
    e.sort(ordemMov);
    const ent = e.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0), sai = e.filter(m => m.tipo !== 'entrada').reduce((s, m) => s + m.valor, 0);
    const hoje = hojeISO(), ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    const rotulo = d => d === hoje ? 'Hoje' : d === ontem ? 'Ontem' : new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    let html = '<div class="home-tiles"><div class="home-tile"><i class="fas fa-arrow-trend-up"></i><div><small>Ganhos</small><b class="money-value">' + brl(ent) + '</b></div></div><div class="home-tile"><i class="fas fa-arrow-trend-down"></i><div><small>Gastos</small><b class="money-value">' + brl(sai) + '</b></div></div></div>', dia = '';
    e.forEach(x => {
        if (x.data !== dia) { dia = x.data; html += '<div class="dia-titulo">' + rotulo(dia) + '</div>'; }
        const [ic, cor] = iconeCat(x.cat), en = x.tipo === 'entrada';
        html += '<div class="trans" onclick="abrirTransacao(' + x.id + ')"><span class="ic-box round" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span>'
            + '<div class="trans-mid"><b>' + escaparHTML(x.desc) + (x.fixo ? ' <i class="fas fa-rotate text-info" title="Fixo" style="font-size:.7rem"></i>' : '') + '</b><small>' + escaparHTML(x.cat) + ' | ' + (x.virtual ? 'Fatura' : en ? 'Receita' : 'Despesa') + '</small></div>'
            + '<div class="trans-end"><b class="money-value ' + (en ? 'text-success' : 'text-danger') + '">' + (en ? '' : '-') + brl(x.valor) + '</b><small>' + x.data.substring(8, 10) + '/' + x.data.substring(5, 7) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>';
    });
    L.innerHTML = html + (e.length ? '' : '<div class="text-center text-muted py-4 small">Nenhuma movimentação encontrada.</div>');
}
