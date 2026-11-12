/* ===== Finanças Pro — Rodada 3: Visão Anual ===== */
function efetivosDe(ym) {
    const ids = new Set();
    dados.cartoes.forEach(c => { if (c.tipo !== 'Débito') (c.compras || []).forEach(x => ids.add(x.id)); });
    const out = dados.movs.filter(m => !(m.idRelacionado && ids.has(m.idRelacionado)));
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito') return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0);
        if (t > 0) out.push({ desc: 'Fatura ' + c.nome, valor: t, tipo: 'saida', cat: 'Cartão', data: ym + '-01' });
    });
    return out;
}
let _anoAnual = new Date().getFullYear(), _chAnual = null;
function mudarAnoAnual(n) { _anoAnual += n; renderAnual(); }
function renderAnual() {
    const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], meses = [], cats = {};
    for (let i = 1; i <= 12; i++) {
        const ym = _anoAnual + '-' + String(i).padStart(2, '0'); let e = 0, s = 0;
        efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).forEach(m => { if (m.tipo === 'entrada') e += m.valor; else { s += m.valor; cats[m.cat || 'Outros'] = (cats[m.cat || 'Outros'] || 0) + m.valor; } });
        meses.push({ ym, e, s, saldo: e - s });
    }
    const T = meses.reduce((a, m) => ({ e: a.e + m.e, s: a.s + m.s }), { e: 0, s: 0 }), ativos = meses.filter(m => m.e || m.s);
    const melhor = ativos.length ? ativos.reduce((a, b) => b.saldo > a.saldo ? b : a) : null, maior = ativos.length ? ativos.reduce((a, b) => b.s > a.s ? b : a) : null;
    document.getElementById('anual-ano').innerText = _anoAnual;
    const card = (t, v, cor) => '<div class="col-6"><div class="card border-0 shadow-sm rounded-4 p-3 h-100"><small class="text-muted">' + t + '</small><div class="fw-bold money-value ' + cor + '">' + v + '</div></div></div>';
    document.getElementById('anual-cards').innerHTML = card('Receitas no ano', brl(T.e), 'text-success') + card('Despesas no ano', brl(T.s), 'text-danger')
        + card('Saldo do ano', brl(T.e - T.s), T.e - T.s >= 0 ? 'text-success' : 'text-danger') + card('Gasto médio/mês', brl(ativos.length ? T.s / ativos.length : 0), '')
        + card('Melhor mês', melhor ? MES[+melhor.ym.slice(5) - 1] + ' · ' + brl(melhor.saldo) : '—', 'text-success') + card('Mês mais caro', maior ? MES[+maior.ym.slice(5) - 1] + ' · ' + brl(maior.s) : '—', 'text-danger');
    if (_chAnual) _chAnual.destroy();
    _chAnual = new Chart(document.getElementById('grafico-anual'), { type: 'bar', data: { labels: MES, datasets: [{ label: 'Receitas', data: meses.map(m => m.e), backgroundColor: '#10b981', borderRadius: 6 }, { label: 'Despesas', data: meses.map(m => m.s), backgroundColor: '#ef4444', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } } });
    document.getElementById('anual-meses').innerHTML = meses.map((m, i) => '<div class="card-mov py-2 mb-2" style="cursor:pointer" onclick="irParaMes(\'' + m.ym + '\')"><div class="flex-grow-1 fw-bold">' + MES[i] + '</div><small class="text-success me-3 money-value">+' + brl(m.e) + '</small><small class="text-danger me-3 money-value">-' + brl(m.s) + '</small><b class="money-value ' + (m.saldo >= 0 ? 'text-success' : 'text-danger') + '">' + brl(m.saldo) + '</b></div>').join('');
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = top.length ? top[0][1] : 1;
    document.getElementById('anual-cats').innerHTML = top.map(([c, v]) => '<div class="mb-2"><div class="d-flex justify-content-between small"><span>' + escaparHTML(c) + '</span><b class="money-value">' + brl(v) + '</b></div><div class="progress" style="height:8px"><div class="progress-bar" style="width:' + (v / mx * 100) + '%;background:var(--purple)"></div></div></div>').join('') || '<p class="text-muted small">Sem despesas neste ano.</p>';
}
function irParaMes(ym) { const i = document.getElementById('mes-atual'); i.value = ym; i.dispatchEvent(new Event('change')); showSection('extrato'); }
const _showSectionO = window.showSection;
window.showSection = function (id, b) { _showSectionO(id, b); if (id === 'aba-anual') renderAnual(); };
