/* ===== Finanças Pro — Rodada 5: previsão, simulador de parcelas, reserva de emergência, offline ===== */
function acumuladoAte(ym) {
    const datas = dados.movs.map(m => m.data && m.data.substring(0, 7)).filter(Boolean).sort(); let a = 0;
    if (datas.length) for (let c = datas[0]; c <= ym; c = ymAdd(c, 1)) { const r = saldoMesDe(c); a += r.e - r.s; }
    return a;
}
function listaFixos(comCartao) {
    const g = {}; dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    const l = Object.values(g).filter(m => m.fixo).map(m => ({ tipo: m.tipo, valor: m.valor }));
    if (comCartao) dados.cartoes.forEach(c => (c.compras || []).filter(x => x.fixa).forEach(x => l.push({ tipo: 'saida', valor: x.valorTotal })));
    return l;
}
function dividasMes(ym) {
    let e = 0, s = 0;
    dados.dividas.forEach(d => {
        if (!d.prazo) return; let dt = d.prazo; const q = Math.max(1, (d.parcelas || 1) - (d.pagas || 0));
        for (let i = 0; i < q; i++) { if (dt.substring(0, 7) === ym) { const v = (d.parcelas || 1) > 1 ? (d.valorParcela || d.valor) : d.valor; if (d.tipo === 'eu-devo') s += v; else e += v; } dt = addMesData(dt); }
    });
    return { e, s };
}
function previsao(n) { // fixos + lançamentos futuros já feitos + faturas/parcelas + dívidas a pagar/receber
    const hoje = hojeISO().substring(0, 7), fx = listaFixos(false);
    const fe = fx.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0), fs = fx.filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0);
    let acum = acumuladoAte(hoje); const out = [];
    for (let i = 1; i <= n; i++) {
        const ym = ymAdd(hoje, i); let ve = 0, vs = 0;
        efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym) && !m.fixo).forEach(m => { if (m.tipo === 'entrada') ve += m.valor; else vs += m.valor; });
        const dv = dividasMes(ym), ent = fe + ve + dv.e, sai = fs + vs + dv.s; acum += ent - sai; out.push({ ym, ent, sai, acum });
    }
    return out;
}
const _lbl = ym => ym.split('-').reverse().join('/');
function renderPrevisao() {
    const guard = (dados.metas.some(m => /reserva|emerg/i.test(m.nome)) ? dados.metas.filter(m => /reserva|emerg/i.test(m.nome)) : dados.metas).reduce((s, m) => s + (m.guardado || 0), 0);
    const custo = listaFixos(true).filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0), meses = custo > 0 ? guard / custo : 0;
    document.getElementById('prev-reserva').innerHTML = '<small class="text-muted">Reserva de emergência (meta: 6 meses de gastos fixos)</small><div class="fw-bold fs-5 money-value">' + brl(guard) + ' <small class="text-muted fw-normal">≈ ' + meses.toFixed(1).replace('.', ',') + ' mês(es)</small></div>'
        + '<div class="progress my-2" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, meses / 6 * 100) + '%;background:' + (meses >= 6 ? '#10b981' : meses >= 3 ? '#f59e0b' : '#ef4444') + '"></div></div>'
        + '<small class="text-muted">' + (custo > 0 ? 'Custo fixo mensal: ' + brl(custo) + '. Crie uma meta chamada "Reserva de emergência" para acompanhar aqui.' : 'Cadastre despesas fixas para calcular a reserva ideal.') + '</small>';
    document.getElementById('prev-lista').innerHTML = previsao(6).map(p => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + _lbl(p.ym) + '</b><small class="d-block text-muted money-value">+' + brl(p.ent) + ' / -' + brl(p.sai) + '</small></div><div class="text-end"><small class="text-muted d-block">saldo projetado</small><b class="money-value ' + (p.acum >= 0 ? 'text-success' : 'text-danger') + '">' + brl(p.acum) + '</b></div></div>').join('');
}
function simular() {
    const V = parseFloat(document.getElementById('sim-valor').value) || 0, n = Math.max(1, Math.min(48, parseInt(document.getElementById('sim-parc').value) || 1)), i = (parseFloat(document.getElementById('sim-juros').value) || 0) / 100;
    if (V <= 0) return alert('Informe o valor da compra.');
    const pmt = i > 0 ? V * i / (1 - Math.pow(1 + i, -n)) : V / n, total = pmt * n, base = previsao(Math.max(6, n));
    const renda = listaFixos(false).filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0);
    let neg = 0, html = '<div class="card border-0 shadow-sm rounded-4 p-3 mb-3"><div>Parcela: <b class="money-value">' + brl(pmt) + '</b> × ' + n + '</div><div>Total: <b class="money-value">' + brl(total) + '</b> <small class="text-muted">(juros: ' + brl(total - V) + ')</small></div>'
        + (renda > 0 ? '<small class="text-muted">A parcela pesa ' + Math.round(pmt / renda * 100) + '% da sua renda fixa.</small>' : '') + '</div>';
    html += base.map((p, k) => { const dep = p.acum - pmt * Math.min(k + 1, n), ruim = dep < 0; if (ruim && p.acum >= 0) neg++; return '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + _lbl(p.ym) + '</b>' + (k < n ? '<small class="d-block text-muted">parcela ' + (k + 1) + '/' + n + '</small>' : '') + '</div><div class="text-end"><small class="text-muted d-block">antes: <span class="money-value">' + brl(p.acum) + '</span></small><b class="money-value ' + (dep >= 0 ? 'text-success' : 'text-danger') + '">' + brl(dep) + '</b></div></div>'; }).join('');
    document.getElementById('sim-resultado').innerHTML = (neg ? '<div class="alert alert-danger rounded-4"><i class="fas fa-triangle-exclamation me-1"></i>Esta compra deixa o saldo projetado negativo em ' + neg + ' mês(es) em que ele estaria positivo.</div>' : '<div class="alert alert-success rounded-4"><i class="fas fa-circle-check me-1"></i>Cabe no orçamento projetado.</div>') + html;
}
const _showSectionO5 = window.showSection;
window.showSection = function (id, b) { _showSectionO5(id, b); if (id === 'aba-previsao') renderPrevisao(); };
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
