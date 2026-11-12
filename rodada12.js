/* ===== Finanças Pro — Rodada 12: "Quanto posso gastar por dia" vira botão que expande ===== */
function toggleDiario() { const d = document.getElementById('card-diario'); if (d) d.classList.toggle('aberto'); }
const _renderResumoO12 = window.renderResumo;
window.renderResumo = function () {
    _renderResumoO12();
    const d = document.getElementById('card-diario'); if (!d || d.querySelector('.diario-btn')) return;
    const info = d.innerHTML.replace(/<small class="text-muted">Quanto posso gastar por dia<\/small>/, '');
    d.className = 'mb-3' + (d.classList.contains('aberto') ? ' aberto' : '');
    d.innerHTML = '<button type="button" class="diario-btn" onclick="toggleDiario()"><span class="diario-ic"><i class="fas fa-calendar-day"></i></span><span class="diario-tx">Quanto posso gastar por dia</span><i class="fas fa-chevron-down diario-seta"></i></button><div class="diario-info">' + info + '</div>';
};
