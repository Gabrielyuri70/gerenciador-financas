/* =====================================================================
   Finanças Pro — app.js (arquivo único do aplicativo)

   Índice
     1. Estado e utilitários
     2. Avisos na tela e janelas (modais)
     3. Autenticação e perfil
     4. Navegação e topo
     5. Lançamentos (extrato) e categorias
     6. Contas fixas
     7. Cartões, faturas e compras
     8. Dívidas
     9. Metas
    10. Notas
    11. Clientes
    12. Revenda
    13. Início, gráficos e análises
    14. Calculadora
    15. Tema, PIN, avisos, backup e calendário
    16. Inicialização
   ===================================================================== */

/* ===================================================================
   1. ESTADO E UTILITÁRIOS
   =================================================================== */
const CHAVE_DADOS = 'financas_pro_max', CHAVE_NOTAS = 'financas_notas', CHAVE_AUTH = 'financas_auth';
const MESES_C = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const LISTAS = ['movs', 'cartoes', 'dividas', 'metas', 'lixeira', 'historicoQuitados', 'revenda', 'fixosIgnorados', 'clientes'];

function novoDados() {
    const d = { config: { dark: false, oculto: false } };
    LISTAS.forEach(k => { d[k] = []; });
    return d;
}
function normalizarDados(d) { // garante a estrutura mesmo com backups/versões antigas
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = novoDados();
    LISTAS.forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.config || typeof d.config !== 'object') d.config = { dark: false, oculto: false };
    return d;
}
let dados = (() => {
    try { const s = localStorage.getItem(CHAVE_DADOS); return normalizarDados(s && s !== 'undefined' ? JSON.parse(s) : null); }
    catch (e) { console.error('Falha ao ler localStorage, usando dados vazios:', e); return novoDados(); }
})();
let notas = (() => { try { const n = JSON.parse(localStorage.getItem(CHAVE_NOTAS)); return Array.isArray(n) ? n : []; } catch (e) { return []; } })();

let usuarioAtivo = sessionStorage.getItem('user_ativo') || localStorage.getItem('user_lembrado') || null;
let mesAtual = '';                 // mês selecionado (AAAA-MM), definido na inicialização
let filtroAtual = 'todos';         // extrato: todos | fatura | tudo | entrada | saida
let buscaAtual = '';               // extrato: texto da busca
let cartaoContexto = null;         // cartão aberto na tela de compras
let abaCartao = 'fatura';          // tela do cartão: fatura | todas
let buscaDividaAtual = '', ordemDividaAtual = 'data-recente', statusDividaAtual = 'todas';
let meuGrafico = null, _secAtual = 'inicio';

// ---------- datas e formatação ----------
function hojeISO() { // data LOCAL (toISOString usa UTC e virava o dia às 21h)
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const isoDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const horaAgora = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const dataBR = s => s ? s.split('-').reverse().join('/') : '';
const dataCompletaBR = s => s.substring(8, 10) + '/' + s.substring(5, 7) + '/' + s.substring(0, 4);
const diaMes = s => s.substring(8, 10) + '/' + s.substring(5, 7);
const rotuloMes = ym => ym.split('-').reverse().join('/');
const _mesSel = () => mesAtual;
function ymAdd(ym, n) { let [a, m] = ym.split('-').map(Number); m += n; a += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return a + '-' + String(m).padStart(2, '0'); }
function addMesData(s) { const [a, m, d] = s.split('-').map(Number), ym = ymAdd(a + '-' + String(m).padStart(2, '0'), 1), [a2, m2] = ym.split('-').map(Number); return ym + '-' + String(Math.min(d, new Date(a2, m2, 0).getDate())).padStart(2, '0'); }
function ordemMov(a, b) { return (b.data || '').localeCompare(a.data || '') || (b.hora || '').localeCompare(a.hora || '') || (b.id - a.id); }
function escaparHTML(s) { return (s === undefined || s === null) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function brl(v) { return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const arred = v => Math.round(v * 100) / 100;
const fmtMoeda = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // valor para dentro de campos com máscara
const soDigitos = s => String(s || '').replace(/\D/g, '');

// ---------- campos de formulário ----------
const campo = id => { const e = document.getElementById(id); return e ? e.value : ''; };
const setCampo = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v === undefined || v === null) ? '' : v; };
const marcado = id => { const e = document.getElementById(id); return !!(e && e.checked); };
function lerMoeda(id) { return parseFloat((campo(id) || '').replace(/\./g, '').replace(',', '.')) || 0; }
function mascaraMoeda(ev) { // máscara 1.234,56 enquanto digita
    const n = ev.target.value.replace(/\D/g, '');
    ev.target.value = n ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(n) / 100) : '';
}

// ---------- gravação ----------
function ehVisitante() { return sessionStorage.getItem('user_ativo') === 'visitante' || usuarioAtivo === 'visitante'; }
// O modo visitante NUNCA grava: senão apagaria os dados reais do aparelho.
function persistir() { if (!ehVisitante()) localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados)); }
function persistirNotas() { if (!ehVisitante()) localStorage.setItem(CHAVE_NOTAS, JSON.stringify(notas)); }
function salvarERender() {
    if (ehVisitante()) { renderTudo(); return; }
    const mb = (JSON.stringify(dados).length * 2) / (1024 * 1024);
    if (mb > 4.5) avisar('ATENÇÃO: seu armazenamento local está quase cheio (' + mb.toFixed(2) + 'MB). Exporte um backup agora para não perder dados!', 'erro');
    persistir();
    renderTudo();
}

/* ===================================================================
   2. AVISOS NA TELA E JANELAS (MODAIS)
   =================================================================== */
function avisar(msg, tipo) { // aviso na tela (no lugar do alert bloqueante)
    let c = document.getElementById('toast-box');
    if (!c) { c = document.createElement('div'); c.id = 'toast-box'; document.body.appendChild(c); }
    const erro = tipo ? tipo === 'erro' : /incorret|inválid|Informe|insuficiente|maior que|Erro|não pode|Preencha|Cadastre|Selecione/i.test(msg);
    const t = document.createElement('div');
    t.className = 'toast-fp ' + (erro ? 'erro' : 'ok');
    t.innerHTML = '<i class="fas ' + (erro ? 'fa-circle-exclamation' : 'fa-circle-check') + ' me-2"></i>' + escaparHTML(msg);
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('on'));
    t.onclick = () => t.remove();
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, Math.min(12000, 2500 + String(msg).length * 45));
}
const erro = msg => avisar(msg, 'erro');

// Uma única instância por janela (criar várias deixava fundos escuros "presos" na tela)
function mostrarModal(id) { const el = document.getElementById(id); if (el) bootstrap.Modal.getOrCreateInstance(el).show(); }
function ocultarModal(id) { const el = document.getElementById(id), i = el && bootstrap.Modal.getInstance(el); if (i) i.hide(); }
const _ocultar = ocultarModal;
function modalDin(id, html) { // janela criada por código (clientes, avisos...)
    let m = document.getElementById(id);
    if (!m) { m = document.createElement('div'); m.className = 'modal fade'; m.id = id; m.tabIndex = -1; document.body.appendChild(m); }
    m.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><button type="button" class="btn-close fp-x" data-bs-dismiss="modal" aria-label="Fechar"></button>' + html + '</div></div>';
    return bootstrap.Modal.getOrCreateInstance(m);
}
// Se sobrar algum fundo escuro sem janela aberta (toque duplo, por exemplo), limpa a tela.
function limparFundosPresos() {
    if (document.querySelector('.modal.show, .modal[style*="display: block"], .offcanvas.show')) return;
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.body.classList.remove('modal-open'); document.body.style.removeProperty('overflow'); document.body.style.removeProperty('padding-right');
}

/* ===================================================================
   3. AUTENTICAÇÃO E PERFIL
      (senha e resposta secreta são guardadas com hash SHA-256 + salt;
       é proteção local do aparelho — o app não tem servidor)
   =================================================================== */
function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    const mp = Math.pow, mw = mp(2, 32);
    let i, j, result = '', words = [], bitLen = ascii.length * 8;
    const hash = [], k = [], isC = {}; let pc = 0;
    for (let c = 2; pc < 64; c++) {
        if (!isC[c]) { for (i = 0; i < 313; i += c) isC[i] = c; hash[pc] = (mp(c, .5) * mw) | 0; k[pc++] = (mp(c, 1 / 3) * mw) | 0; }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) { j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((bitLen / mw) | 0); words[words.length] = bitLen;
    let H = hash.slice(0, 8);
    for (j = 0; j < words.length;) {
        const w = words.slice(j, j += 16), old = H; let h = H.slice(0, 8);
        for (i = 0; i < 64; i++) {
            const w15 = w[i - 15], w2 = w[i - 2], a = h[0], e = h[4];
            const t1 = h[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & h[5]) ^ ((~e) & h[6])) + k[i]
                + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
            const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
            h = [(t1 + t2) | 0].concat(h); h[4] = (h[4] + t1) | 0; h.length = 8;
        }
        for (i = 0; i < 8; i++) h[i] = (h[i] + old[i]) | 0;
        H = h;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { const b = (H[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
    return result;
}
function hashSenha(s, salt) { return sha256(unescape(encodeURIComponent(salt + '|' + s))); }
function normResp(r) { return String(r).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function getAuth() { try { return JSON.parse(localStorage.getItem(CHAVE_AUTH)); } catch (e) { return null; } }
function salvarAuth(a) { localStorage.setItem(CHAVE_AUTH, JSON.stringify(a)); }
function novoSalt() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function conferirSenha(a, p) { return a.passHash ? hashSenha(p, a.salt) === a.passHash : a.pass === p; }
function conferirResposta(a, r) { return a.respHash ? hashSenha(normResp(r), a.salt) === a.respHash : String(a.resposta) === r.trim().toLowerCase(); }
function migrarAuth(a) { // contas antigas (texto puro) viram hash no primeiro login
    if (a.passHash) return a;
    a.salt = novoSalt();
    a.passHash = hashSenha(a.pass || '', a.salt);
    a.respHash = hashSenha(normResp(a.resposta || ''), a.salt);
    delete a.pass; delete a.resposta;
    return a;
}
function toggleSenha(inputId, icon) {
    const input = document.getElementById(inputId), ver = input.type === 'password';
    input.type = ver ? 'text' : 'password';
    icon.classList.replace(ver ? 'fa-eye' : 'fa-eye-slash', ver ? 'fa-eye-slash' : 'fa-eye');
}
function toggleAuth(mode) {
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('recovery-form').style.display = mode === 'recovery' ? 'block' : 'none';
    if (mode === 'recovery') {
        document.getElementById('step-1-recovery').style.display = 'block';
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'none';
    }
}
function cadastrarUsuario() {
    const u = campo('user-reg').trim(), p = campo('pass-reg').trim(), q = campo('pergunta-reg'), r = campo('resposta-reg').trim();
    if (!u || !p || !r) return erro('Preencha todos os campos!');
    if (p.length < 4) return erro('A senha precisa ter pelo menos 4 caracteres.');
    if (getAuth()) return erro('Já existe uma conta neste aparelho. Use "Esqueci a senha" para redefinir o acesso.');
    const salt = novoSalt();
    salvarAuth({ user: u, salt, passHash: hashSenha(p, salt), pergunta: q, respHash: hashSenha(normResp(r), salt) });
    avisar('Conta criada com sucesso!'); toggleAuth('login');
}
function fazerLogin() {
    const u = campo('user-login').trim(), p = campo('pass-login').trim(), a = getAuth();
    if (!a) return erro('Nenhuma conta encontrada! Por favor, cadastre-se.');
    if (u !== a.user || !conferirSenha(a, p)) return erro('Usuário ou senha incorretos!');
    salvarAuth(migrarAuth(a));
    if (marcado('lembrar-login')) localStorage.setItem('user_lembrado', u); else localStorage.removeItem('user_lembrado');
    sessionStorage.setItem('user_ativo', u); usuarioAtivo = u;
    atualizarNomeUsuarioTela(u);
    document.getElementById('tela-login').style.display = 'none';
    processarLancamentosFixos(); renderTudo();
}
function verificarUsuarioRecuperacao() {
    const a = getAuth();
    if (a && campo('user-rec').trim() === a.user) {
        document.getElementById('txt-pergunta-exibida').innerText = a.pergunta;
        document.getElementById('step-1-recovery').style.display = 'none';
        document.getElementById('step-2-recovery').style.display = 'block';
    } else erro('Usuário não encontrado!');
}
function validarRespostaSeguranca() {
    const a = getAuth();
    if (a && conferirResposta(a, campo('resposta-rec'))) {
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'block';
    } else erro('Resposta incorreta!');
}
function redefinirSenha() {
    const np = campo('nova-pass-rec').trim();
    if (np.length < 4) return erro('A nova senha precisa ter pelo menos 4 caracteres.');
    const a = migrarAuth(getAuth());
    a.passHash = hashSenha(np, a.salt); salvarAuth(a);
    avisar('Senha alterada! Faça login novamente.'); toggleAuth('login');
}
function entrarVisitante() {
    sessionStorage.setItem('user_ativo', 'visitante'); usuarioAtivo = 'visitante';
    dados = novoDados(); notas = []; // estrutura isolada em memória: o visitante nunca grava
    atualizarNomeUsuarioTela('Visitante');
    document.getElementById('tela-login').style.display = 'none';
    renderTudo();
}
function verificarAcesso() {
    if (ehVisitante()) { erro('Crie uma conta para salvar seus dados!'); return false; }
    return true;
}
function carregarDadosPerfil() {
    if (ehVisitante()) return;
    const a = getAuth(), i = document.getElementById('novo-user-perfil');
    if (a && i) i.value = a.user;
}
function atualizarPerfilUsuario() {
    if (!verificarAcesso()) return;
    let a = getAuth(); if (!a) return erro('Conta não encontrada!');
    const nu = campo('novo-user-perfil').trim(), np = campo('nova-pass-perfil').trim();
    if (!nu) return erro('O campo de usuário não pode ficar vazio!');
    if (!conferirSenha(a, campo('senha-atual-perfil').trim())) return erro('Senha atual incorreta!');
    if (np && np.length < 4) return erro('A nova senha precisa ter pelo menos 4 caracteres.');
    a = migrarAuth(a); a.user = nu;
    if (np) a.passHash = hashSenha(np, a.salt);
    salvarAuth(a);
    if (localStorage.getItem('user_lembrado')) localStorage.setItem('user_lembrado', nu);
    sessionStorage.setItem('user_ativo', nu); usuarioAtivo = nu; atualizarNomeUsuarioTela(nu);
    setCampo('nova-pass-perfil', ''); setCampo('senha-atual-perfil', '');
    avisar('Perfil atualizado com sucesso!');
}
function atualizarNomeUsuarioTela(nome) {
    nome = nome || 'Visitante';
    ['txt-nome-usuario-sidebar', 'txt-perfil-nome-exibicao'].forEach(id => { const e = document.getElementById(id); if (e) e.innerText = nome; });
}
function sairApp() { sessionStorage.clear(); localStorage.removeItem('user_lembrado'); location.reload(); }
function resetarApp() {
    if (!verificarAcesso()) return;
    if (!confirm('Isso apaga TODOS os dados e a conta deste aparelho. Exporte um backup antes. Continuar?')) return;
    if (!confirm('Última confirmação: apagar tudo de forma definitiva?')) return;
    [CHAVE_DADOS, CHAVE_NOTAS, CHAVE_AUTH, 'user_lembrado'].forEach(k => localStorage.removeItem(k));
    sessionStorage.clear(); location.reload();
}

/* ===================================================================
   4. NAVEGAÇÃO E TOPO
   =================================================================== */
const TITULOS = { 'extrato': 'Extrato', 'cartoes': 'Cartões', 'compras-cartao': 'Cartão', 'dividas': 'Dívidas', 'metas': 'Metas', 'lixeira': 'Lixeira', 'aba-perfil': 'Perfil', 'aba-sobre': 'Sobre', 'aba-notas': 'Notas', 'aba-revenda': 'Revenda', 'aba-graficos': 'Análise de Gastos', 'aba-anual': 'Visão Anual', 'aba-orcamento': 'Orçamento', 'aba-fixos': 'Contas Fixas', 'aba-previsao': 'Previsão', 'aba-simulador': 'Simulador', 'aba-comparar': 'Comparar meses', 'aba-quitar': 'Quitar dívidas', 'aba-clientes': 'Clientes' };
const COM_MES = ['extrato', 'cartoes', 'compras-cartao', 'dividas', 'aba-graficos', 'aba-orcamento', 'aba-comparar'];
// O que cada tela desenha quando é aberta (e de novo a cada alteração de dados)
const RENDER_DA_TELA = {
    'extrato': () => renderExtrato(), 'compras-cartao': () => renderComprasCartao(), 'lixeira': () => renderLixeira(),
    'aba-graficos': () => renderGraficoRank(), 'aba-anual': () => renderAnual(), 'aba-orcamento': () => renderOrcamento(),
    'aba-fixos': () => renderFixos(), 'aba-previsao': () => renderPrevisao(), 'aba-comparar': () => renderComparar(),
    'aba-quitar': () => renderQuitar(), 'aba-clientes': () => renderClientes(), 'aba-perfil': () => carregarDadosPerfil(),
    'aba-revenda': () => renderRevenda(), 'dividas': () => { renderDividas(); }, 'metas': () => renderMetas(), 'aba-notas': () => renderizarNotas()
};
function showSection(id, btn) {
    const alvo = document.getElementById(id); if (!alvo) return;
    _secAtual = id;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    alvo.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.body.classList.toggle('na-home', id === 'inicio');
    if (RENDER_DA_TELA[id]) RENDER_DA_TELA[id]();
    atualizarTopo(); atualizarFab();
    window.scrollTo(0, 0);
}
function irPara(id) { // atalhos rápidos da Início
    if (id.startsWith('ajuste-')) return abrirAjusteSaldo(id.slice(7));
    if (id === 'novo') { abrirModalMov(); mostrarModal('modalMov'); return; }
    showSection(id);
}
function atualizarTopo() {
    const h = document.getElementById('fp-header'); if (!h) return;
    const [a, m] = mesAtual.split('-').map(Number), set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    let t = TITULOS[_secAtual] || '';
    if (_secAtual === 'compras-cartao') { const e = document.getElementById('titulo-compras-cartao'); if (e && e.textContent.trim()) t = e.textContent.trim().replace(/^Compras:\s*/, ''); }
    set('fp-titulo', t);
    const rotulos = (pref) => { set(pref + '-mes-ant', MESES_C[(m + 10) % 12]); set(pref + '-mes-prox', MESES_C[m % 12]); set(pref + '-mes-atual', MESES_C[m - 1] + (a !== new Date().getFullYear() ? ' ' + a : '')); };
    rotulos('fp'); rotulos('hero');
    const comMes = COM_MES.includes(_secAtual);
    document.getElementById('fp-meses-row').style.display = comMes ? 'flex' : 'none';
    h.style.paddingBottom = comMes ? '44px' : '40px';
    const hero = document.querySelector('#inicio .main-balance-card'); if (hero) h.style.backgroundImage = getComputedStyle(hero).backgroundImage; // mesma cor da Início (roxo/verde)
    atualizarBadges();
}
function setMes(ym) { if (!/^\d{4}-\d{2}$/.test(ym)) return; mesAtual = ym; renderTudo(); }
function alterarMesNav(direcao) { setMes(ymAdd(mesAtual, direcao)); }
function irParaMes(ym) { setMes(ym); showSection('extrato'); }

// Seletor de mês próprio (o <input type="month"> escondido não abria em vários navegadores)
let _anoSeletor = new Date().getFullYear();
function abrirSeletorMes() {
    _anoSeletor = +mesAtual.slice(0, 4); desenharSeletorMes(); mostrarModal('modalMes');
}
function mudarAnoSeletor(n) { _anoSeletor += n; desenharSeletorMes(); }
function desenharSeletorMes() {
    document.getElementById('mes-ano').innerText = _anoSeletor;
    const hoje = hojeISO().substring(0, 7);
    document.getElementById('mes-grade').innerHTML = MESES_C.map((nome, i) => {
        const ym = _anoSeletor + '-' + String(i + 1).padStart(2, '0');
        return '<button type="button" class="mes-op' + (ym === mesAtual ? ' ativo' : '') + (ym === hoje ? ' hoje' : '') + '" onclick="escolherMes(\'' + ym + '\')">' + nome + '</button>';
    }).join('');
}
function escolherMes(ym) { ocultarModal('modalMes'); setMes(ym); }
function irParaHoje() { escolherMes(hojeISO().substring(0, 7)); }

// Botão flutuante (+) de cada tela
const FAB_ACOES = { 'cartoes': () => abrirModalCartao(), 'compras-cartao': () => abrirModalCompraCartao(), 'dividas': () => abrirModalDivida(), 'aba-clientes': () => abrirModalCliente(), 'metas': () => mostrarModal('modalMeta'), 'aba-notas': () => abrirModalNota(), 'aba-revenda': () => abrirModalRevenda(), 'aba-fixos': () => novaContaFixa() };
const FAB_ROTULO = { 'cartoes': 'Novo cartão', 'compras-cartao': 'Nova compra', 'dividas': 'Novo registro', 'aba-clientes': 'Novo cliente', 'metas': 'Nova meta', 'aba-notas': 'Nova nota', 'aba-revenda': 'Novo produto', 'aba-fixos': 'Nova conta fixa' };
function atualizarFab() {
    const f = document.getElementById('fab-add'); if (!f) return;
    f.style.display = FAB_ACOES[_secAtual] ? 'flex' : 'none'; f.setAttribute('aria-label', FAB_ROTULO[_secAtual] || '');
}

/* ===================================================================
   5. LANÇAMENTOS (EXTRATO) E CATEGORIAS
   =================================================================== */
const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência', 'Cheque', 'Outro'];
const CAT_IC = { 'Mercado': ['fa-cart-shopping', '#f59e0b'], 'Alimentação': ['fa-utensils', '#f97316'], 'Transporte': ['fa-car', '#3b82f6'], 'Moradia': ['fa-house', '#14b8a6'], 'Contas': ['fa-file-invoice-dollar', '#64748b'], 'Saúde': ['fa-heart-pulse', '#ef4444'], 'Educação': ['fa-graduation-cap', '#6366f1'], 'Lazer': ['fa-gamepad', '#a855f7'], 'Assinaturas': ['fa-repeat', '#ec4899'], 'Salário': ['fa-money-bill-wave', '#10b981'], 'Freelance': ['fa-laptop-code', '#0ea5e9'], 'Investimentos': ['fa-chart-line', '#22c55e'], 'Vendas': ['fa-tag', '#84cc16'], 'Dívidas': ['fa-handshake', '#8a2be2'], 'Cartão': ['fa-credit-card', '#6366f1'], 'Outros': ['fa-ellipsis', '#94a3b8'] };
const iconeCat = c => CAT_IC[c] || ['fa-receipt', '#8a2be2'];

function cats() { // categorias separadas por tipo (receita/despesa), com as personalizadas
    if (!dados.categorias) dados.categorias = { entrada: ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Dívidas', 'Outros'], saida: ['Mercado', 'Alimentação', 'Transporte', 'Moradia', 'Contas', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Dívidas', 'Cartão', 'Outros'] };
    dados.movs.forEach(m => { const l = dados.categorias[m.tipo === 'entrada' ? 'entrada' : 'saida']; if (m.cat && !l.includes(m.cat)) l.push(m.cat); });
    return dados.categorias;
}
function popularCategorias(tipo, sel) {
    const s = document.getElementById('mov-cat'), l = cats()[tipo === 'entrada' ? 'entrada' : 'saida'];
    if (sel && !l.includes(sel)) l.push(sel);
    s.innerHTML = l.filter(c => c !== 'Cartão' || sel === 'Cartão').map(c => '<option>' + escaparHTML(c) + '</option>').join('') + '<option value="__nova__">+ Nova categoria…</option>';
    if (sel) s.value = sel;
}
function popularClientes(selId, sel) {
    const s = document.getElementById(selId); if (!s) return;
    s.innerHTML = '<option value="">Sem cliente</option>' + clientes().slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join('');
    s.value = sel || '';
}
function toggleCartaoMov() { // "cartão da fatura" só aparece para despesa no crédito
    const w = document.getElementById('mov-cartao-wrap'); if (!w) return;
    w.classList.toggle('d-none', !(campo('mov-forma') === 'Crédito' && campo('mov-tipo') === 'saida'));
}
function abrirModalMov(id = null) {
    const m = id ? dados.movs.find(x => x.id == id) : null;
    setCampo('mov-id-edit', m ? m.id : '');
    setCampo('mov-desc', m ? m.desc : '');
    setCampo('mov-valor', m ? fmtMoeda(m.valor) : '');
    setCampo('mov-tipo', m ? m.tipo : 'saida');
    popularCategorias(campo('mov-tipo'), m ? m.cat : null);
    if (!m) setCampo('mov-cat', 'Outros');
    setCampo('mov-data', m ? m.data : hojeISO());
    document.getElementById('mov-fixo').checked = !!(m && m.fixo);
    document.getElementById('modalMovTitulo').innerText = m ? 'Editar Lançamento' : 'Novo Lançamento';
    document.getElementById('btn-excluir-mov').classList.toggle('d-none', !m);
    // detalhes extras
    popularClientes('mov-cliente', m && m.clienteId);
    setCampo('mov-forma', m && m.forma); setCampo('mov-local', m && m.local); setCampo('mov-tags', m && m.tags); setCampo('mov-obs', m && m.obs);
    const det = document.getElementById('mov-mais'); if (det) det.open = !!(m && (m.local || m.tags || m.obs));
    // cartão da fatura
    const sel = document.getElementById('mov-cartao');
    if (sel) { sel.innerHTML = dados.cartoes.filter(c => c.tipo !== 'Débito').map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join(''); if (m && m.cartaoId) sel.value = m.cartaoId; }
    if (m && m.cartaoId) setCampo('mov-forma', 'Crédito');
    toggleCartaoMov();
}
function abrirAjusteSaldo(tipo) { // atalhos "Entrada" / "Saída" da Início
    if (!verificarAcesso()) return;
    abrirModalMov();
    setCampo('mov-tipo', tipo); popularCategorias(tipo, null); toggleCartaoMov();
    setCampo('mov-desc', 'Ajuste de Saldo');
    document.getElementById('modalMovTitulo').innerText = tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída';
    mostrarModal('modalMov');
}
function abrirTransacao(id) {
    if (id < 0) return verCompras(-id); // linha "Fatura" do extrato → abre o cartão
    abrirModalMov(id); mostrarModal('modalMov');
}
function salvarMov() {
    if (!verificarAcesso()) return;
    const idEdit = Number(campo('mov-id-edit')) || 0, desc = campo('mov-desc').trim(), valor = lerMoeda('mov-valor');
    if (!desc || valor <= 0) return erro('Informe a descrição e um valor maior que zero.');
    const tipo = campo('mov-tipo'), usaCartao = campo('mov-forma') === 'Crédito' && tipo === 'saida', cid = Number(campo('mov-cartao')) || null;
    if (usaCartao && !cid) return erro('Cadastre um cartão de crédito para lançar na fatura.');
    const antigo = idEdit ? dados.movs.find(m => m.id === idEdit) : null;
    const mov = {
        ...(antigo || {}), id: idEdit || Date.now(), desc, valor, tipo, cat: campo('mov-cat'),
        data: campo('mov-data') || hojeISO(), hora: antigo ? (antigo.hora || horaAgora()) : horaAgora(), fixo: marcado('mov-fixo'),
        forma: campo('mov-forma'), clienteId: Number(campo('mov-cliente')) || null, local: campo('mov-local').trim(), tags: campo('mov-tags').trim(), obs: campo('mov-obs').trim(),
        cartaoId: usaCartao ? cid : null
    };
    if (mov.cat === '__nova__') mov.cat = 'Outros';
    // renomear uma conta fixa: acompanha todo o histórico dela (senão a conta antiga continuaria se repetindo)
    if (antigo && antigo.fixo && (antigo.desc !== desc || antigo.tipo !== tipo)) {
        dados.movs.forEach(m => { if (m.fixo && m.tipo === antigo.tipo && m.desc === antigo.desc) { m.desc = desc; m.tipo = tipo; } });
    }
    const idx = dados.movs.findIndex(m => m.id === mov.id);
    if (idx > -1) dados.movs[idx] = mov; else dados.movs.push(mov);
    salvarERender();
    ocultarModal('modalMov'); avisar('Lançamento salvo');
}
function moverMovParaLixeira() {
    const id = Number(campo('mov-id-edit')), idx = dados.movs.findIndex(m => m.id === id);
    if (idx < 0 || !confirm('Deseja enviar para a lixeira?')) return;
    const item = dados.movs.splice(idx, 1)[0];
    if (item.fixo && item.data) { // evita que o lançamento fixo "ressuscite" no mesmo mês
        dados.fixosIgnorados.push(item.tipo + '|' + item.desc + '|' + item.data.substring(0, 7));
    }
    item.origem = 'movs'; item.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(item);
    salvarERender(); ocultarModal('modalMov'); avisar('Lançamento enviado para a lixeira');
}
function setFiltro(f) { filtroAtual = f; renderExtrato(); }
function filtrarBusca(valor) { buscaAtual = valor.toLowerCase(); renderExtrato(); }
function renderExtrato() { // agrupado por dia, com ícone por categoria
    const L = document.getElementById('lista-extrato'); if (!L) return;
    const ym = mesAtual, f = filtroAtual;
    let e = efetivos().filter(m => m.data && m.data.startsWith(ym));
    if (f === 'fatura') e = e.filter(m => m.virtual); else if (f !== 'tudo') e = e.filter(m => !m.virtual);
    if (f === 'entrada' || f === 'saida') e = e.filter(m => m.tipo === f);
    if (buscaAtual) e = e.filter(m => (m.desc || '').toLowerCase().includes(buscaAtual) || (m.cat || '').toLowerCase().includes(buscaAtual));
    e.sort(ordemMov);
    const ent = e.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0), sai = e.filter(m => m.tipo !== 'entrada').reduce((s, m) => s + m.valor, 0);
    const hoje = hojeISO(), o = new Date(); o.setDate(o.getDate() - 1), ontem = isoDe(o);
    const rotulo = d => d === hoje ? 'Hoje' : d === ontem ? 'Ontem' : new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    let html = '<div class="home-tiles"><div class="home-tile"><i class="fas fa-arrow-trend-up"></i><div><small>Ganhos</small><b class="money-value">' + brl(ent) + '</b></div></div><div class="home-tile"><i class="fas fa-arrow-trend-down"></i><div><small>Gastos</small><b class="money-value">' + brl(sai) + '</b></div></div></div>', dia = '';
    e.forEach(x => {
        if (x.data !== dia) { dia = x.data; html += '<div class="dia-titulo">' + rotulo(dia) + '</div>'; }
        html += linhaTransacao(x, true);
    });
    L.innerHTML = html + (e.length ? '' : '<div class="text-center text-muted py-4 small">Nenhuma movimentação encontrada.</div>');
}
function linhaTransacao(x, comSetaIr) { // linha usada no extrato e nas "últimas transações"
    const [ic, cor] = iconeCat(x.cat), en = x.tipo === 'entrada';
    return '<div class="trans" onclick="abrirTransacao(' + x.id + ')"><span class="ic-box round" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span>'
        + '<div class="trans-mid"><b>' + escaparHTML(x.desc) + (x.fixo ? ' <i class="fas fa-rotate text-info" title="Fixo" style="font-size:.7rem"></i>' : '') + '</b><small>' + escaparHTML(x.cat) + ' | ' + (x.virtual ? 'Fatura' : en ? 'Receita' : 'Despesa') + (!comSetaIr && x.forma ? ' • ' + escaparHTML(x.forma) : '') + '</small></div>'
        + '<div class="trans-end"><b class="money-value ' + (en ? 'text-success' : 'text-danger') + '">' + (en ? '' : '-') + brl(x.valor) + '</b><small>' + diaMes(x.data) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>';
}

// ---------- Lixeira ----------
function renderLixeira() {
    const lista = document.getElementById('lista-lixeira'); if (!lista) return;
    lista.innerHTML = dados.lixeira.length ? dados.lixeira.map(m => `
        <div class="card-mov opacity-75">
            <div class="icon-box bg-secondary text-white"><i class="fas fa-trash-restore"></i></div>
            <div class="flex-grow-1">
                <div class="fw-bold text-decoration-line-through">${escaparHTML(m.lixeiraTitulo || m.nome || m.desc)}</div>
                <small class="text-muted">Deletado em: ${escaparHTML(m.deletadoEm || '')}</small>
            </div>
            <div class="text-end"><button class="btn btn-sm btn-outline-success border-0" onclick="restaurarDaLixeira(${m.id})"><i class="fas fa-undo"></i></button></div>
        </div>`).join('') : '<p class="text-center text-muted py-4">A lixeira está vazia.</p>';
}
function restaurarDaLixeira(id) {
    const i = dados.lixeira.findIndex(m => m.id === Number(id)); if (i < 0) return;
    const it = dados.lixeira.splice(i, 1)[0], dest = it.origem || 'movs';
    delete it.origem; delete it.deletadoEm; delete it.lixeiraTitulo;
    (dados[dest] = dados[dest] || []).push(it);
    salvarERender(); avisar('Item restaurado');
}
function esvaziarLixeira() {
    if (!confirm('Tem certeza que deseja apagar permanentemente todos os itens da lixeira?')) return;
    dados.lixeira = []; salvarERender();
}

/* ===================================================================
   6. CONTAS FIXAS (lançamentos que se repetem todo mês)
   =================================================================== */
function ultimosPorGrupo() { // o lançamento mais recente de cada "tipo + descrição"
    const g = {};
    dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    return Object.values(g);
}
const fixosAtivos = () => ultimosPorGrupo().filter(m => m.fixo);

// Preenche TODOS os meses que faltam (não só o atual), sem duplicar e respeitando exclusões
function processarLancamentosFixos() {
    const ym = hojeISO().substring(0, 7), ign = dados.fixosIgnorados; let mudou = false;
    fixosAtivos().forEach(t => { // desmarcar "Fixo" no lançamento mais recente cancela a repetição
        const prim = dados.movs.filter(x => x.fixo && x.tipo === t.tipo && x.desc === t.desc).sort((x, y) => x.data.localeCompare(y.data))[0];
        const dia = parseInt((prim || t).data.substring(8, 10)) || 1;
        let [a, mm] = t.data.substring(0, 7).split('-').map(Number);
        for (;;) {
            mm++; if (mm > 12) { mm = 1; a++; }
            const alvo = a + '-' + String(mm).padStart(2, '0');
            if (alvo > ym) break;
            const existe = dados.movs.some(x => x.tipo === t.tipo && x.desc === t.desc && x.data && x.data.startsWith(alvo));
            if (existe || ign.includes(t.tipo + '|' + t.desc + '|' + alvo)) continue;
            const ultimo = new Date(a, mm, 0).getDate();
            dados.movs.push({ ...t, id: Date.now() + Math.floor(Math.random() * 1e6), data: alvo + '-' + String(Math.min(dia, ultimo)).padStart(2, '0') });
            mudou = true;
        }
    });
    if (mudou) salvarERender();
}

// Tudo que se repete: lançamentos fixos + compras fixas dos cartões
function listaContasFixas() {
    const lista = fixosAtivos().map(m => ({ origem: 'mov', id: m.id, desc: m.desc, valor: m.valor, tipo: m.tipo, dia: m.data.substring(8, 10), cat: m.cat, cartaoId: m.cartaoId || null }));
    dados.cartoes.forEach(c => (c.compras || []).filter(x => x.fixa).forEach(x => lista.push({ origem: 'compra', id: x.id, desc: x.desc, valor: x.valorTotal, tipo: 'saida', dia: String(c.vence).padStart(2, '0'), cat: x.cat || 'Cartão', cartaoId: c.id })));
    return lista;
}
function renderFixos() {
    const lista = listaContasFixas();
    const ent = lista.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0), sai = lista.filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0);
    document.getElementById('fixos-resumo').innerHTML = [['Receitas fixas', ent, 'text-success'], ['Despesas fixas', sai, 'text-danger'], ['Sobra fixa/mês', ent - sai, ent - sai >= 0 ? 'text-success' : 'text-danger'], ['Custo anual fixo', sai * 12, '']]
        .map(([t, v, c]) => '<div class="col-6"><div class="card border-0 shadow-sm rounded-4 p-3"><small class="text-muted">' + t + '</small><div class="fw-bold money-value ' + c + '">' + brl(v) + '</div></div></div>').join('');
    document.getElementById('fixos-lista').innerHTML = lista.sort((a, b) => a.dia - b.dia).map(x => {
        const cartao = x.cartaoId ? dados.cartoes.find(c => c.id === x.cartaoId) : null, args = "'" + x.origem + "'," + x.id + ',' + (x.cartaoId || 0);
        return '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><div class="fw-bold">' + escaparHTML(x.desc) + ' <span class="badge bg-info text-dark"><i class="fas fa-rotate"></i> dia ' + x.dia + '</span></div>'
            + '<small class="text-muted">' + escaparHTML(x.cat) + (cartao ? ' • <i class="fas fa-credit-card"></i> ' + escaparHTML(cartao.nome) : '') + '</small></div>'
            + '<b class="money-value ' + (x.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + (x.tipo === 'entrada' ? '+' : '-') + brl(x.valor) + '</b>'
            + '<div class="dropdown"><button class="btn btn-link text-muted p-2" data-bs-toggle="dropdown" aria-label="Opções"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">'
            + '<li><button class="dropdown-item py-2" onclick="editarContaFixa(' + args + ')"><i class="fas fa-pen me-2"></i>Editar</button></li>'
            + '<li><button class="dropdown-item py-2 text-danger" onclick="excluirContaFixa(' + args + ')"><i class="fas fa-trash me-2"></i>Excluir</button></li></ul></div></div>';
    }).join('') || '<p class="text-muted text-center">Nenhuma conta fixa. Toque em <b>＋</b> ou marque "Fixo" ao lançar uma receita/despesa.</p>';
}
function novaContaFixa() {
    abrirModalMov(); document.getElementById('mov-fixo').checked = true;
    document.getElementById('modalMovTitulo').innerText = 'Nova Conta Fixa'; mostrarModal('modalMov');
}
function editarContaFixa(origem, id, cartaoId) {
    if (origem === 'compra') { cartaoContexto = cartaoId; abrirModalCompraCartao(id); }
    else abrirTransacao(id);
}
function excluirContaFixa(origem, id, cartaoId) {
    if (origem === 'compra') { // mesmo caminho da exclusão dentro do cartão
        const card = dados.cartoes.find(c => c.id === cartaoId), c = card && card.compras.find(x => x.id === id);
        if (!c || !confirm('Excluir a compra fixa "' + c.desc + '" do cartão ' + card.nome + '?')) return;
        card.compras = card.compras.filter(x => x.id !== id);
        dados.movs = dados.movs.filter(m => Number(m.idRelacionado) !== id);
        salvarERender(); avisar('Conta fixa excluída'); return;
    }
    const m = dados.movs.find(x => x.id === id); if (!m) return;
    modalDin('modalExcluirFixo', '<div class="modal-body p-4"><h5 class="fw-bold mb-2">Excluir conta fixa</h5>'
        + '<p class="mb-3"><b>' + escaparHTML(m.desc) + '</b> (' + brl(m.valor) + ') deixa de se repetir todo mês. O que fazer com os lançamentos que já existem?</p>'
        + '<button class="btn btn-outline-primary w-100 mb-2 py-2" onclick="confirmarExcluirFixo(' + id + ',false)">Só parar de repetir <small class="d-block text-muted">mantém todo o histórico no extrato</small></button>'
        + '<button class="btn btn-danger w-100 py-2" onclick="confirmarExcluirFixo(' + id + ',true)">Parar e apagar este mês em diante <small class="d-block">envia para a lixeira</small></button></div>').show();
}
function confirmarExcluirFixo(id, apagar) {
    const m = dados.movs.find(x => x.id === id); if (!m) return ocultarModal('modalExcluirFixo');
    const grupo = dados.movs.filter(x => x.fixo && x.tipo === m.tipo && x.desc === m.desc), ym = hojeISO().substring(0, 7);
    grupo.forEach(x => { x.fixo = false; }); // sem a marca "Fixo" nada mais é gerado (nem aparece em todas as faturas do cartão)
    if (apagar) grupo.filter(x => x.data.substring(0, 7) >= ym).forEach(x => {
        dados.movs.splice(dados.movs.indexOf(x), 1);
        dados.fixosIgnorados.push(x.tipo + '|' + x.desc + '|' + x.data.substring(0, 7));
        x.origem = 'movs'; x.deletadoEm = new Date().toLocaleDateString('pt-BR'); dados.lixeira.push(x);
    });
    salvarERender(); ocultarModal('modalExcluirFixo'); avisar('Conta fixa excluída');
}

/* ===================================================================
   7. CARTÕES, FATURAS E COMPRAS
   =================================================================== */
const BANCOS = { 'Nubank': ['#8A05BE', '#ffffff'], 'Inter': ['#FF7A00', '#ffffff'], 'Itaú': ['#EC7000', '#ffffff'], 'Bradesco': ['#CC092F', '#ffffff'], 'Santander': ['#EC0000', '#ffffff'], 'Banco do Brasil': ['#FFEF38', '#000000'], 'Caixa': ['#0070AF', '#ffffff'], 'C6 Bank': ['#242424', '#ffffff'], 'PicPay': ['#11C76F', '#ffffff'], 'Mercado Pago': ['#009EE3', '#ffffff'], 'BTG Pactual': ['#001E62', '#ffffff'], 'Neon': ['#00E5E5', '#000000'], 'Next': ['#00FF5F', '#000000'], 'Original': ['#00A859', '#ffffff'], 'Sicredi': ['#3FA110', '#ffffff'], 'XP': ['#000000', '#ffffff'], 'Will Bank': ['#FFD100', '#000000'] };
function shade(hex, p) { // escurece uma cor #rrggbb em p (0–1)
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#4f46e5';
    const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * (1 - p));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
function aplicarBanco() {
    const b = BANCOS[campo('card-banco')]; if (!b) return;
    setCampo('card-cor-custom', b[0]); setCampo('card-cor-fonte', b[1]);
}
function detectarBanco() {
    const norm = s => s.toLowerCase().replace(/[ãáâ]/g, 'a').replace(/[íî]/g, 'i'), n = norm(campo('card-nome'));
    const k = Object.keys(BANCOS).find(b => n.includes(norm(b).split(' ')[0]));
    if (k && campo('card-banco') !== k) { setCampo('card-banco', k); aplicarBanco(); }
}
const cartaoAtual = () => dados.cartoes.find(x => x.id == cartaoContexto);

// ---------- regras de fatura ----------
function mesFatura(card, c) { // mês de fechamento da fatura em que a compra cai
    const d = parseInt(c.data.substring(8, 10)), f = parseInt(card.fecha) || 31;
    return ymAdd(c.data.substring(0, 7), (card.tipo !== 'Débito' && d > f) ? 1 : 0);
}
function ymFat(card, ym) { return (parseInt(card.vence) > parseInt(card.fecha)) ? ym : ymAdd(ym, -1); } // fatura que é paga no mês "ym"
function mesPagamento(card, invYm) { return (parseInt(card.vence) > parseInt(card.fecha)) ? invYm : ymAdd(invYm, 1); } // inverso: em que mês a fatura "invYm" é paga
function parcelasCompra(card, c) {
    const ant = (c.pagamentos || []).filter(p => p.antecipada).length, tot = Math.max(1, c.parcelas - ant), base = mesFatura(card, c);
    return Array.from({ length: tot }, (_, i) => ({ n: i + 1, total: tot, ym: ymAdd(base, i) }));
}
function pseudoMov(m, fixo) { // lançamento feito "no crédito" vira um item da fatura
    return { id: 'm' + m.id, movId: m.id, mov: true, desc: m.desc, valorTotal: m.valor, parcelas: 1, data: m.data, local: m.local, cat: m.cat, fixa: fixo, emprestado: false, pagamentos: [] };
}
function itensFatura(card, ymF) { // tudo que compõe a fatura do mês de fechamento ymF
    const out = [];
    (card.compras || []).forEach(c => {
        if (c.fixa) { if (ymF >= mesFatura(card, c)) out.push({ c, info: 'Fixo', valor: c.valorTotal }); return; }
        const p = parcelasCompra(card, c).find(x => x.ym === ymF);
        if (p) out.push({ c, info: '(' + p.n + '/' + p.total + ')', valor: c.valorTotal / c.parcelas });
    });
    const fixos = {};
    dados.movs.forEach(m => { // conta fixa no cartão: aparece em TODAS as faturas a partir da primeira (vale o valor do último reajuste)
        if (m.cartaoId !== card.id || m.tipo !== 'saida' || !m.data) return;
        const inv = mesFatura(card, { data: m.data });
        if (!m.fixo) { if (inv === ymF) out.push({ c: pseudoMov(m, false), info: '', valor: m.valor }); return; }
        if (inv <= ymF) { const k = m.desc; if (!fixos[k] || inv > fixos[k].inv || (inv === fixos[k].inv && m.data > fixos[k].m.data)) fixos[k] = { inv, m }; }
    });
    Object.values(fixos).forEach(f => out.push({ c: pseudoMov(f.m, true), info: 'Fixo', valor: f.m.valor }));
    return out;
}
function limiteUsado(card) { // saldo real em aberto (parcelas futuras), não só o mês atual
    const hoje = hojeISO().substring(0, 7);
    const compras = (card.compras || []).reduce((s, c) => {
        const v = c.valorTotal / c.parcelas; if (c.fixa) return s + v;
        const aberto = parcelasCompra(card, c).filter(p => p.ym >= hoje).length * v, pago = (c.pagamentos || []).reduce((a, p) => a + p.valor, 0);
        return s + Math.max(0, Math.min(c.valorTotal - pago, aberto));
    }, 0);
    return compras + dados.movs.filter(m => m.cartaoId === card.id && m.tipo === 'saida' && m.data && mesFatura(card, { data: m.data }) >= hoje).reduce((s, m) => s + m.valor, 0);
}
// Movimentações efetivas de um mês = lançamentos (sem compras de crédito) + 1 linha "Fatura" por cartão
function movsEfetivos(ym, comId) {
    const ids = new Set(), cred = new Set();
    dados.cartoes.forEach(c => { if (c.tipo !== 'Débito') { cred.add(c.id); (c.compras || []).forEach(x => ids.add(x.id)); } });
    const out = dados.movs.filter(m => !(m.idRelacionado && ids.has(m.idRelacionado)) && !(m.cartaoId && cred.has(m.cartaoId)));
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito') return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0); if (t <= 0) return;
        out.push(comId ? { id: -c.id, desc: 'Fatura ' + c.nome, valor: arred(t), tipo: 'saida', cat: 'Cartão', data: ym + '-' + String(Math.min(parseInt(c.vence) || 1, 28)).padStart(2, '0'), hora: '', virtual: true }
            : { desc: 'Fatura ' + c.nome, valor: t, tipo: 'saida', cat: 'Cartão', data: ym + '-01' });
    });
    return out;
}
const efetivos = () => movsEfetivos(mesAtual, true);
const efetivosDe = ym => movsEfetivos(ym, false);

// ---------- cartão: formulário ----------
function abrirModalCartao(id = null) {
    if (!verificarAcesso()) return;
    const c = id ? dados.cartoes.find(x => x.id == id) : null;
    setCampo('card-id-edit', c ? c.id : ''); setCampo('card-nome', c ? c.nome : '');
    setCampo('card-limite', c ? fmtMoeda(c.limite) : '');
    setCampo('card-bandeira', c ? c.bandeira : 'Visa'); setCampo('card-banco', '');
    setCampo('card-cor-custom', c ? c.cor : '#6f42c1'); setCampo('card-cor-fonte', c ? (c.corFonte || '#ffffff') : '#ffffff');
    setCampo('card-tipo', c ? c.tipo : 'Crédito'); setCampo('card-fecha', c ? c.fecha : '10'); setCampo('card-vence', c ? c.vence : '15');
    setCampo('card-final', c && c.final); setCampo('card-titular', c && c.titular); setCampo('card-anuidade', c && c.anuidade ? fmtMoeda(c.anuidade) : ''); setCampo('card-obs', c && c.obs);
    const det = document.getElementById('card-mais'); if (det) det.open = !!(c && (c.final || c.titular || c.anuidade || c.obs));
    document.getElementById('btn-excluir-cartao').classList.toggle('d-none', !c);
    document.getElementById('modalCartaoTitulo').innerText = c ? 'Editar Cartão' : 'Novo Cartão';
    mostrarModal('modalCartao');
}
function addCartao() {
    if (!verificarAcesso()) return;
    const idEdit = Number(campo('card-id-edit')) || 0, antigo = idEdit ? dados.cartoes.find(x => x.id === idEdit) : null;
    const card = {
        ...(antigo || {}), id: idEdit || Date.now(), nome: campo('card-nome').trim(), limite: lerMoeda('card-limite'), bandeira: campo('card-bandeira'),
        cor: campo('card-cor-custom'), corFonte: campo('card-cor-fonte'), tipo: campo('card-tipo'), fecha: campo('card-fecha'), vence: campo('card-vence'),
        compras: antigo ? antigo.compras : [],
        final: soDigitos(campo('card-final')).slice(-4), titular: campo('card-titular').trim(), anuidade: lerMoeda('card-anuidade'), obs: campo('card-obs').trim()
    };
    if (!card.nome) return erro('Preencha o nome e limite!');
    const idx = dados.cartoes.findIndex(c => c.id === card.id);
    if (idx > -1) dados.cartoes[idx] = card; else dados.cartoes.push(card);
    salvarERender(); ocultarModal('modalCartao'); avisar('Cartão salvo');
}
function excluirCartaoNoModal() {
    const id = Number(campo('card-id-edit'));
    if (!confirm('Deseja mover este cartão para a lixeira?')) return;
    const idx = dados.cartoes.findIndex(c => c.id === id); if (idx < 0) return;
    const item = dados.cartoes.splice(idx, 1)[0];
    item.origem = 'cartoes'; item.deletadoEm = new Date().toLocaleDateString('pt-BR'); item.lixeiraTitulo = 'Cartão: ' + item.nome;
    dados.lixeira.push(item);
    salvarERender(); ocultarModal('modalCartao'); avisar('Cartão excluído');
    if (_secAtual === 'compras-cartao') showSection('cartoes');
}

// ---------- cartão: lista de cartões ----------
function bandeiraIcone(b) {
    b = (b || '').toLowerCase();
    return b.includes('visa') ? '<i class="fab fa-cc-visa"></i>' : b.includes('master') ? '<i class="fab fa-cc-mastercard"></i>' : (b.includes('amex') || b.includes('american')) ? '<i class="fab fa-cc-amex"></i>' : b.includes('diners') ? '<i class="fab fa-cc-diners-club"></i>' : '<span class="fp-band">' + escaparHTML(b.toUpperCase().slice(0, 8)) + '</span>';
}
function renderCartoes() {
    const L = document.getElementById('lista-cartoes'), H = document.getElementById('home-lista-cartoes'); if (!L) return;
    const ym = mesAtual, mesNome = MESES_C[parseInt(ym.slice(5)) - 1];
    const html = dados.cartoes.map(c => {
        const deb = c.tipo === 'Débito', cor = /^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : '#6366f1', fg = c.corFonte || '#fff';
        const fat = deb ? 0 : itensFatura(c, ymFat(c, ym)).reduce((s, i) => s + i.valor, 0), usado = limiteUsado(c), perc = c.limite > 0 ? Math.min(100, usado / c.limite * 100) : 0;
        return '<div class="fp-cartao" style="background:linear-gradient(135deg,' + cor + ' 0%,' + shade(cor, .45) + ' 100%);color:' + fg + '" onclick="if(!event.target.closest(\'.dropdown\'))verCompras(' + c.id + ')"><div class="fp-deco"></div>'
            + '<div class="fp-c-top"><div><b class="fp-c-nome">' + escaparHTML(c.nome) + '</b><small class="d-block fp-sub">' + (deb ? 'Débito' : 'Crédito') + (c.final ? ' •••• ' + escaparHTML(c.final) : '') + '</small></div>'
            + '<div class="d-flex align-items-center gap-2"><span class="fp-bandeira">' + bandeiraIcone(c.bandeira) + '</span><div class="dropdown"><button type="button" class="fp-menu-btn" data-bs-toggle="dropdown" aria-label="Opções do cartão"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0"><li><button class="dropdown-item" onclick="abrirModalCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar cartão</button></li></ul></div></div></div>'
            + '<div class="fp-mid"><small class="fp-sub">' + (deb ? 'Cartão de débito' : 'Fatura de ' + mesNome) + '</small><div class="fp-valor money-value">' + (deb ? 'Sem fatura' : brl(fat)) + '</div>' + (deb ? '' : '<span class="fp-pill">Vence dia ' + String(c.vence).padStart(2, '0') + ' • Fecha dia ' + String(c.fecha).padStart(2, '0') + '</span>') + '</div>'
            + '<div class="fp-bot"><div class="fp-bar"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Disponível <b class="money-value">' + brl(c.limite - usado) + '</b></span><span>Limite ' + brl(c.limite) + '</span></div></div></div>';
    }).join('');
    L.innerHTML = html; if (H) H.innerHTML = html;
}

// ---------- cartão: tela de compras (fatura do mês / todas as compras) ----------
function verCompras(id) {
    cartaoContexto = id; abaCartao = 'fatura';
    const c = cartaoAtual(); if (!c) return;
    document.getElementById('titulo-compras-cartao').innerText = 'Compras: ' + c.nome;
    showSection('compras-cartao');
}
function setAbaCartao(a) { abaCartao = a; renderComprasCartao(); }
function badgeCompra(card, it, ymF, todas) {
    const { c } = it;
    if (c.fixa || c.mov) return c.mov ? 'Conta fixa' : 'Fixo';
    const ps = parcelasCompra(card, c);
    return todas ? (ps.length > 1 ? ps.length + 'x' : 'À vista') : Math.max(1, ps.findIndex(x => x.ym === ymF) + 1) + '/' + ps.length;
}
function _cardItem(card, it, ymF, todas) {
    const { c, valor } = it, pagOk = (c.pagamentos || []).filter(p => !p.antecipada).reduce((a, p) => a + p.valor, 0), dia = parseInt(c.data.substring(8, 10)) || 1, fixo = c.fixa || c.mov;
    let meio, datas, pct = 100;
    if (fixo) {
        meio = '<div><small>Valor mensal</small><b class="money-value">' + brl(valor) + '</b></div><div><small>Duração</small><b>Todo mês</b></div>';
        datas = '<span><i class="far fa-calendar"></i> Início ' + dataCompletaBR(c.data) + '</span><span><i class="fas fa-infinity"></i> Sem data final</span>'; pct = 0;
    } else {
        const ps = parcelasCompra(card, c), tot = ps.length, n = todas ? 1 : Math.max(1, ps.findIndex(x => x.ym === ymF) + 1), last = ps[tot - 1].ym, [ay, am] = last.split('-').map(Number);
        const falta = Math.max(0, todas ? c.valorTotal - pagOk : (tot - n + 1) * valor - pagOk); pct = (todas ? Math.min(100, pagOk / c.valorTotal * 100) : n / tot * 100);
        meio = '<div><small>Total da compra</small><b class="money-value">' + brl(c.valorTotal) + '</b></div><div><small>Falta pagar</small><b class="money-value ' + (falta > 0 ? 'text-danger' : 'text-success') + '">' + brl(falta) + '</b></div>';
        datas = '<span><i class="far fa-calendar"></i> Início ' + dataCompletaBR(c.data) + '</span><span><i class="far fa-flag"></i> Finalizar ' + String(Math.min(dia, new Date(ay, am, 0).getDate())).padStart(2, '0') + '/' + String(am).padStart(2, '0') + '/' + ay + '</span>';
    }
    const menu = c.mov ? '<li><button class="dropdown-item py-2" onclick="abrirTransacao(' + c.movId + ')"><i class="fas fa-pen me-2"></i>Editar lançamento</button></li>'
        : '<li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar compra</button></li>'
        + (c.fixa ? '' : '<li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'total\')"><i class="fas fa-circle-check me-2"></i>Pagamento total</button></li><li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'parcial\')"><i class="fas fa-coins me-2"></i>Pagamento parcial</button></li><li><button class="dropdown-item py-2" onclick="anteciparParcelaModal(' + c.id + ')"><i class="fas fa-forward me-2"></i>Antecipar parcelas</button></li>');
    const pags = (c.pagamentos || []).map(p => '<div>' + brl(p.valor) + ' em ' + escaparHTML(p.data) + (p.antecipada ? ' (antecipada)' : '') + '</div>').join('');
    const inv = mesFatura(card, c), entra = todas ? '<div class="cc-l3"><span><i class="fas fa-file-invoice"></i> ' + (fixo ? 'Entra na fatura de ' : '1ª fatura: ') + MESES_C[+inv.slice(5) - 1] + '/' + inv.slice(0, 4) + '</span></div>' : '';
    return '<div class="cc-item"><div class="cc-l1"><b class="cc-desc">' + escaparHTML(c.desc) + '</b><span class="cc-parc money-value">' + brl(valor) + '</span><span class="cc-badge">' + badgeCompra(card, it, ymF, todas) + '</span>'
        + '<div class="dropdown"><button class="cc-menu" data-bs-toggle="dropdown" aria-label="Opções"><i class="fas fa-ellipsis-vertical"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">' + menu + '</ul></div></div>'
        + (c.pessoa ? '<div class="cc-l3"><span><i class="fas fa-user-group"></i> ' + escaparHTML(c.pessoa) + '</span></div>' : '')
        + '<div class="cc-l2">' + meio + '</div>' + (fixo ? '' : '<div class="cc-bar"><div style="width:' + pct + '%"></div></div>')
        + '<div class="cc-l3">' + datas + '</div>' + entra
        + ((c.local || c.cat) ? '<div class="cc-l3">' + (c.local ? '<span><i class="fas fa-store"></i> ' + escaparHTML(c.local) + '</span>' : '') + (c.cat ? '<span><i class="fas fa-tag"></i> ' + escaparHTML(c.cat) + '</span>' : '') + '</div>' : '')
        + (pags ? '<div class="cc-pags"><b>Pagamentos</b>' + pags + '</div>' : '') + '</div>';
}
function todasComprasCartao(card) { // todas as compras do cartão, em qualquer fatura
    const itens = (card.compras || []).map(c => ({ c, valor: c.fixa ? c.valorTotal : c.valorTotal / c.parcelas })), fixos = {};
    dados.movs.forEach(m => {
        if (m.cartaoId !== card.id || m.tipo !== 'saida' || !m.data) return;
        if (!m.fixo) { itens.push({ c: pseudoMov(m, false), valor: m.valor }); return; }
        if (!fixos[m.desc] || m.data > fixos[m.desc].data) fixos[m.desc] = m;
    });
    Object.values(fixos).forEach(m => itens.push({ c: pseudoMov(m, true), valor: m.valor }));
    return itens.sort((a, b) => (b.c.data || '').localeCompare(a.c.data || ''));
}
function renderComprasCartao() {
    const card = cartaoAtual(); if (!card) return;
    const ym = mesAtual, ymF = ymFat(card, ym), itens = itensFatura(card, ymF), usado = limiteUsado(card), cor = /^#[0-9a-f]{6}$/i.test(card.cor || '') ? card.cor : '#6366f1', fg = card.corFonte || '#fff';
    const soma = l => l.reduce((s, i) => s + i.valor, 0), minhas = itens.filter(i => !i.c.emprestado), emp = itens.filter(i => i.c.emprestado), perc = card.limite > 0 ? Math.min(100, usado / card.limite * 100) : 0;
    document.getElementById('info-cartao-detalhe').innerHTML = '<div class="cc-resumo" style="background:linear-gradient(135deg,' + cor + ',' + shade(cor, .45) + ');color:' + fg + '"><div class="d-flex justify-content-between align-items-end"><div><small class="fp-sub">Fatura de ' + MESES_C[parseInt(ym.slice(5)) - 1] + '</small><div class="fp-valor money-value">' + brl(soma(minhas)) + '</div></div><div class="text-end"><small class="fp-sub">Disponível</small><div class="fw-bold money-value">' + brl(card.limite - usado) + '</div></div></div>'
        + '<div class="fp-bar mt-2"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Fecha dia ' + String(card.fecha).padStart(2, '0') + '</span><span>Vence ' + String(card.vence).padStart(2, '0') + '/' + ym.slice(5) + '/' + ym.slice(0, 4) + '</span></div>'
        + (emp.length ? '<div class="fp-sub mt-1">Emprestado (fora do seu extrato): <b class="money-value">' + brl(soma(emp)) + '</b></div>' : '') + '</div>';
    document.querySelectorAll('#cartao-abas button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === abaCartao));
    const sec = (ic, t, v, cls = '') => '<div class="cc-sec ' + cls + '"><span><i class="fas ' + ic + '"></i> ' + t + '</span><b class="money-value">' + brl(v) + '</b></div>';
    let html = '';
    if (abaCartao === 'todas') {
        const todas = todasComprasCartao(card);
        html = todas.length ? sec('fa-list', 'Todas as compras (' + todas.length + ')', soma(todas.filter(i => !i.c.fixa && !i.c.mov).map(i => ({ valor: i.c.valorTotal })))) + todas.map(i => _cardItem(card, i, ymF, true)).join('') : '';
    } else {
        html = minhas.length ? sec('fa-user', 'Minhas compras', soma(minhas)) + minhas.map(i => _cardItem(card, i, ymF, false)).join('') : '';
        if (emp.length) {
            const g = {}; emp.forEach(i => { const k = (i.c.pessoa || '').trim() || 'Sem nome'; (g[k] = g[k] || []).push(i); });
            html += '<div class="cc-titulo-emp"><i class="fas fa-people-arrows"></i> Cartão emprestado</div>' + Object.entries(g).map(([n, l]) => sec('fa-user-group', escaparHTML(n), soma(l), 'emp') + l.map(i => _cardItem(card, i, ymF, false)).join('')).join('');
        }
    }
    const vazio = abaCartao === 'todas' ? 'Nenhuma compra neste cartão ainda.' : 'Nenhuma compra nesta fatura. Se você acabou de lançar, veja a aba <b>Todas as compras</b>.';
    document.getElementById('lista-compras-cartao').innerHTML = html || '<p class="text-center text-muted small py-4">' + vazio + '</p>';
}

// ---------- compra: formulário ----------
function togglePessoa() { const w = document.getElementById('compra-pessoa-wrap'); if (w) w.classList.toggle('d-none', !marcado('compra-emprestado')); }
function toggleCompraFixa() { // compra fixa = um valor que se repete todo mês (1 parcela)
    const fixa = marcado('compra-fixa'), p = document.getElementById('compra-parcelas');
    if (fixa) p.value = 1; p.disabled = fixa; previewCompra();
}
function previewCompra() {
    const card = cartaoAtual(), el = document.getElementById('compra-preview'); if (!card || !el) return;
    const v = lerMoeda('compra-valor'), n = Math.max(1, parseInt(campo('compra-parcelas')) || 1), data = campo('compra-data') || hojeISO(), fixa = marcado('compra-fixa');
    if (v <= 0) { el.innerHTML = '<i class="fas fa-circle-info me-1"></i>Informe o valor para ver em qual fatura a compra cai.'; return; }
    const ym = mesFatura(card, { data }), [a, m] = ym.split('-').map(Number);
    el.innerHTML = '<i class="fas fa-circle-info me-1"></i>' + (fixa ? 'Todo mês de ' : n + 'x de ') + '<b>' + brl(fixa ? v : v / n) + '</b> • 1ª fatura em <b>' + MESES_C[m - 1] + '/' + a + '</b> (fecha dia ' + card.fecha + ')' + (!fixa && n > 1 ? ' • termina em <b>' + MESES_C[(m + n - 2) % 12] + '/' + (a + Math.floor((m + n - 2) / 12)) + '</b>' : '');
}
function abrirModalCompraCartao(id = null) {
    const card = cartaoAtual(); if (!card) return erro('Abra um cartão para lançar compras.');
    const c = id ? card.compras.find(x => x.id == id) : null;
    setCampo('compra-id-edit', c ? c.id : ''); setCampo('compra-desc', c ? c.desc : '');
    setCampo('compra-valor', c ? fmtMoeda(c.valorTotal) : ''); setCampo('compra-parcelas', c ? c.parcelas : 1);
    setCampo('compra-data', c ? c.data : hojeISO());
    document.getElementById('compra-emprestado').checked = !!(c && c.emprestado);
    document.getElementById('compra-fixa').checked = !!(c && c.fixa); document.getElementById('compra-parcelas').disabled = !!(c && c.fixa);
    setCampo('compra-pessoa', c && c.pessoa); togglePessoa();
    const s = document.getElementById('compra-cat'), l = cats().saida.filter(x => x !== 'Cartão'); if (c && c.cat && !l.includes(c.cat)) l.push(c.cat);
    s.innerHTML = '<option value="">Sem categoria</option>' + l.map(x => '<option>' + escaparHTML(x) + '</option>').join(''); s.value = (c && c.cat) || '';
    setCampo('compra-local', c && c.local); setCampo('compra-obs', c && c.obs);
    document.getElementById('btn-excluir-compra').classList.toggle('d-none', !c);
    document.getElementById('modalCompraTitulo').innerText = c ? 'Editar Compra' : 'Nova Compra';
    previewCompra(); mostrarModal('modalCompraCartao');
}
function compraVisivelNaFatura(card, c, ymF) { return c.fixa ? ymF >= mesFatura(card, c) : parcelasCompra(card, c).some(p => p.ym === ymF); }
function salvarCompraCartao() {
    const card = cartaoAtual(); if (!card) return erro('Erro: Cartão não encontrado.');
    const idEdit = Number(campo('compra-id-edit')) || 0, desc = campo('compra-desc').trim(), valorTotal = lerMoeda('compra-valor');
    if (!desc || valorTotal <= 0) return erro('Preencha a descrição e o valor da compra corretamente!');
    const fixa = marcado('compra-fixa'), emprestado = marcado('compra-emprestado');
    const parcelas = fixa ? 1 : Math.max(1, Math.floor(Number(campo('compra-parcelas'))) || 1); // sem limite máximo de parcelas
    const antiga = idEdit ? card.compras.find(c => c.id === idEdit) : null, hora = horaAgora();
    const compra = {
        ...(antiga || {}), id: idEdit || Date.now(), desc, valorTotal, parcelas, fixa, emprestado,
        data: campo('compra-data') || hojeISO(), hora: antiga ? (antiga.hora || hora) : hora, pagamentos: antiga ? (antiga.pagamentos || []) : [],
        pessoa: emprestado ? campo('compra-pessoa').trim() : '', cat: campo('compra-cat'), local: campo('compra-local').trim(), obs: campo('compra-obs').trim()
    };
    const idx = card.compras.findIndex(c => c.id === compra.id);
    if (idx > -1) card.compras[idx] = compra; else card.compras.push(compra);
    // espelho no extrato (compra de cartão emprestado não entra no seu extrato)
    const movIdx = dados.movs.findIndex(m => m.idRelacionado === compra.id);
    if (emprestado) { if (movIdx > -1) dados.movs.splice(movIdx, 1); }
    else {
        const movData = { id: movIdx > -1 ? dados.movs[movIdx].id : Date.now() + 1, idRelacionado: compra.id, desc: parcelas > 1 ? compra.desc + ' (1/' + parcelas + ')' : compra.desc, valor: arred(valorTotal / parcelas), tipo: 'saida', cat: 'Cartão', data: compra.data, hora: compra.hora };
        if (movIdx > -1) dados.movs[movIdx] = movData; else dados.movs.push(movData);
    }
    // se a compra cai em outra fatura (ex.: depois do fechamento), mostra a fatura onde ela entrou
    let msg = 'Compra salva';
    const ymF = ymFat(card, mesAtual);
    if (_secAtual === 'compras-cartao' && !compraVisivelNaFatura(card, compra, ymF)) {
        const inv = mesFatura(card, compra), alvo = mesPagamento(card, inv);
        mesAtual = alvo; msg = 'Compra salva — entra na fatura de ' + MESES_C[+inv.slice(5) - 1] + '/' + inv.slice(0, 4) + ' (mostrando essa fatura)';
    }
    salvarERender(); ocultarModal('modalCompraCartao'); avisar(msg);
}
function excluirCompraNoModal() {
    const id = Number(campo('compra-id-edit')), card = cartaoAtual(); if (!id || !card) return;
    if (!confirm('Excluir esta compra?')) return;
    card.compras = card.compras.filter(c => Number(c.id) !== id);
    dados.movs = dados.movs.filter(m => Number(m.idRelacionado) !== id);
    salvarERender(); ocultarModal('modalCompraCartao'); avisar('Compra excluída');
}

// ---------- compra: pagamentos e antecipação ----------
function prepararPagamentoCompra(id, modo) {
    const card = cartaoAtual(), compra = card.compras.find(c => c.id == id);
    const saldo = compra.valorTotal - (compra.pagamentos || []).reduce((a, b) => a + b.valor, 0);
    setCampo('pag-id', id); setCampo('pag-modo', modo + '-cartao'); setCampo('pag-data', hojeISO());
    document.getElementById('tituloPagamento').innerText = modo === 'total' ? 'Quitar Compra' : 'Pagamento Parcial (Cartão)';
    setCampo('pag-valor', modo === 'total' ? fmtMoeda(saldo) : '');
    document.getElementById('area-valor-pag').classList.toggle('d-none', modo === 'total');
    document.getElementById('pag-extrato-wrap').classList.add('d-none'); // lançar no extrato só vale para dívidas
    mostrarModal('modalPagamento');
}
function anteciparParcelaModal(idCompra) {
    const card = cartaoAtual(), compra = card.compras.find(c => c.id == idCompra); if (!compra) return;
    const valorParcela = compra.valorTotal / compra.parcelas;
    compra.pagamentos = compra.pagamentos || [];
    const disponiveis = []; for (let i = compra.pagamentos.length; i < compra.parcelas; i++) disponiveis.push(i);
    if (!disponiveis.length) return avisar('Todas as parcelas desta compra já foram quitadas!');
    const txt = prompt('Esta compra possui ' + disponiveis.length + ' parcela(s) em aberto.\nQuantas parcelas você deseja antecipar?'); if (!txt) return;
    const qtd = parseInt(txt);
    if (isNaN(qtd) || qtd <= 0 || qtd > disponiveis.length) return erro('Quantidade inválida ou maior do que as parcelas restantes!');
    const total = valorParcela * qtd, sel = disponiveis.slice(-qtd), nums = sel.map(n => n + 1).join(', ');
    if (!confirm('Confirmar a antecipação de ' + qtd + ' parcela(s) (Nº: ' + nums + ') no valor total de ' + brl(total) + '?')) return;
    const hora = horaAgora(), data = new Date().toLocaleDateString('pt-BR');
    sel.forEach(i => compra.pagamentos.push({ valor: valorParcela, data, hora, numParcela: Number(i), antecipada: true }));
    dados.movs.push({ id: Date.now(), desc: 'Antecipou ' + qtd + 'x: ' + compra.desc + ' (Parc. ' + nums + ')', valor: total, tipo: 'saida', cat: 'Cartão', data: hojeISO(), hora });
    salvarERender(); avisar(qtd + ' parcela(s) antecipada(s) com sucesso!');
}

/* ===================================================================
   8. DÍVIDAS
   =================================================================== */
function abrirModalDivida(id = null) {
    if (!verificarAcesso()) return;
    const d = id ? dados.dividas.find(x => x.id == id) : null;
    setCampo('div-id-edit', d ? d.id : ''); setCampo('div-tipo', d ? d.tipo : 'eu-devo'); setCampo('div-nome', d ? d.nome : '');
    setCampo('div-valor', d ? fmtMoeda(d.valor) : ''); setCampo('div-parcelas', d ? (d.parcelas || 1) : 1);
    setCampo('div-desc', d && d.desc); setCampo('div-whats', d && d.whats); setCampo('div-inicio', d ? d.inicio : hojeISO()); setCampo('div-prazo', d && d.prazo); setCampo('div-obs', d && d.obs);
    popularClientes('div-cliente', d && d.clienteId);
    setCampo('div-doc', d && d.doc); setCampo('div-email', d && d.email); setCampo('div-juros', d && d.juros); setCampo('div-forma', d && d.forma);
    setCampo('div-prio', (d && d.prio) || 'normal'); setCampo('div-lembrete', (d && d.lembrete) || 3);
    const x = document.getElementById('div-mais'); if (x) x.open = !!(d && (d.clienteId || d.doc || d.email || d.juros || d.forma || d.prio === 'alta'));
    document.getElementById('modalDividaTitulo').innerText = d ? 'Editar Registro' : 'Novo Registro de Dívida';
    document.getElementById('btn-excluir-divida').classList.toggle('d-none', !d);
    mostrarModal('modalDivida');
}
function preencherDeCliente() {
    const c = clientes().find(x => x.id === Number(campo('div-cliente'))); if (!c) return;
    setCampo('div-nome', c.nome); setCampo('div-whats', c.tel); setCampo('div-doc', c.doc); setCampo('div-email', c.email); setCampo('div-tipo', 'me-devem');
}
function addDivida() {
    if (!verificarAcesso()) return;
    const idEdit = Number(campo('div-id-edit')) || 0, antiga = idEdit ? dados.dividas.find(x => x.id === idEdit) : null;
    const valor = lerMoeda('div-valor'), nome = campo('div-nome');
    if (!nome || valor <= 0) return erro('Por favor, preencha o nome e um valor válido para a dívida.');
    const n = Math.max(1, Math.min(120, parseInt(campo('div-parcelas')) || 1)), pagas = antiga ? (antiga.pagas || 0) : 0;
    const d = {
        ...(antiga || {}), id: idEdit || Date.now(), tipo: campo('div-tipo'), nome, valor, desc: campo('div-desc'), whats: campo('div-whats'),
        inicio: campo('div-inicio'), prazo: campo('div-prazo'), obs: campo('div-obs'), pago: false,
        parcelas: n, pagas, valorTotal: antiga ? (antiga.valorTotal || valor) : valor, valorParcela: arred(valor / Math.max(1, n - pagas)),
        clienteId: Number(campo('div-cliente')) || null, doc: campo('div-doc').trim(), email: campo('div-email').trim(),
        juros: parseFloat(campo('div-juros').replace(',', '.')) || 0, forma: campo('div-forma'), prio: campo('div-prio'), lembrete: parseInt(campo('div-lembrete')) || 3
    };
    const idx = dados.dividas.findIndex(x => x.id === d.id);
    if (idx > -1) dados.dividas[idx] = d; else dados.dividas.push(d);
    salvarERender(); ocultarModal('modalDivida'); avisar('Registro salvo');
}
function excluirDivida() {
    const id = Number(campo('div-id-edit')), i = dados.dividas.findIndex(d => d.id === id);
    if (i < 0 || !confirm('Mover este registro para a lixeira?')) return;
    const it = dados.dividas.splice(i, 1)[0];
    it.origem = 'dividas'; it.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(it);
    salvarERender(); ocultarModal('modalDivida'); avisar('Registro enviado para a lixeira');
}

// ---------- filtros ----------
function tratarFiltroEOrdenacao(v) {
    const status = v.startsWith('status-');
    if (status) statusDividaAtual = v.replace('status-', ''); else ordemDividaAtual = v;
    if (status) {
        const sel = document.getElementById('ordenar-divida'); if (sel) sel.value = v;
        document.querySelectorAll('#filtros-rapidos-status .btn-status-filter').forEach(b => { const m = (b.getAttribute('onclick') || '').match(/'([^']+)'/); b.classList.toggle('active', !!m && m[1] === v); });
    }
    renderDividas();
}
function limparFiltrosDivida() {
    buscaDividaAtual = ''; ordemDividaAtual = 'data-recente';
    const b = document.getElementById('busca-divida'); if (b) b.value = '';
    tratarFiltroEOrdenacao('status-todas');
}

// ---------- lista ----------
function renderDividas() {
    const hojeStr = hojeISO(), q = buscaDividaAtual;
    let euDevo = dados.dividas.filter(d => d.tipo === 'eu-devo'), meDevem = dados.dividas.filter(d => d.tipo === 'me-devem');
    if (q) { const casa = d => (d.nome && d.nome.toLowerCase().includes(q)) || (d.desc && d.desc.toLowerCase().includes(q)); euDevo = euDevo.filter(casa); meDevem = meDevem.filter(casa); }
    if (statusDividaAtual === 'pendentes') { const f = d => !d.prazo || d.prazo >= hojeStr; euDevo = euDevo.filter(f); meDevem = meDevem.filter(f); }
    else if (statusDividaAtual === 'vencidas') { const f = d => d.prazo && d.prazo < hojeStr; euDevo = euDevo.filter(f); meDevem = meDevem.filter(f); }
    const ordenar = lista => lista.sort((a, b) => {
        if (ordemDividaAtual === 'data-recente') return new Date(b.prazo || b.inicio) - new Date(a.prazo || a.inicio);
        if (ordemDividaAtual === 'data-antiga') return new Date(a.prazo || a.inicio) - new Date(b.prazo || b.inicio);
        if (ordemDividaAtual === 'alfa-crescente') return (a.nome || '').localeCompare(b.nome || '');
        if (ordemDividaAtual === 'alfa-decrescente') return (b.nome || '').localeCompare(a.nome || '');
        return 0;
    });
    euDevo = ordenar(euDevo); meDevem = ordenar(meDevem);
    document.getElementById('total-eu-devo').innerText = brl(euDevo.reduce((a, b) => a + b.valor, 0));
    document.getElementById('total-me-devem').innerText = brl(meDevem.reduce((a, b) => a + b.valor, 0));
    const item = d => {
        const venc = d.prazo && d.prazo < hojeStr, hoje = d.prazo === hojeStr, parc = d.parcelas > 1, pagar = d.tipo === 'eu-devo';
        const st = !d.prazo ? '' : venc ? '<span class="chip-st st-venc">Vencida</span>' : hoje ? '<span class="chip-st st-hoje">Vence hoje</span>' : '';
        return `<div class="div-item">
            <span class="div-av ${pagar ? 'pagar' : 'receber'}">${escaparHTML((d.nome || '?').trim().charAt(0).toUpperCase())}</span>
            <div class="div-mid">
                <b>${escaparHTML(d.nome)}</b>
                <small>${d.prazo ? dataBR(d.prazo) : 'Sem prazo'}${parc ? ' • Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : ''}${d.desc ? ' • ' + escaparHTML(d.desc) : ''}${d.juros ? ' • Juros ' + d.juros + '%/mês' : ''}${d.forma ? ' • ' + escaparHTML(d.forma) : ''}</small>
                ${st}${d.prio === 'alta' ? '<span class="chip-st st-venc">Prioridade alta</span>' : ''}
                ${d.obs ? `<details class="div-hist"><summary>Histórico</summary><div>${escaparHTML(d.obs)}</div></details>` : ''}
            </div>
            <div class="div-val ${pagar ? 'text-danger' : 'text-success'} money-value">${brl(d.valor)}${parc ? `<small>${brl(d.valorParcela || 0)}/parcela</small>` : ''}</div>
            <div class="dropdown">
                <button class="btn btn-link" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-vertical"></i></button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                    ${d.whats ? `<li><a class="dropdown-item py-2" href="https://wa.me/55${soDigitos(d.whats)}" target="_blank"><i class="fab fa-whatsapp me-2"></i>WhatsApp</a></li>` : ''}
                    <li><button class="dropdown-item py-2" onclick="abrirModalDivida(${d.id})"><i class="fas fa-pen me-2"></i>Editar</button></li>
                    ${parc ? `<li><button class="dropdown-item py-2" onclick="pagarParcelaDivida(${d.id})"><i class="fas fa-calendar-check me-2"></i>Pagar próxima parcela</button></li>` : ''}
                    ${d.prazo ? `<li><button class="dropdown-item py-2" onclick="eventoCalendarioDivida(${d.id})"><i class="far fa-calendar-plus me-2"></i>Adicionar ao calendário</button></li>` : ''}
                    <li><button class="dropdown-item py-2" onclick="prepararPagamento(${d.id}, 'total')"><i class="fas fa-circle-check me-2"></i>Pagamento total</button></li>
                    <li><button class="dropdown-item py-2" onclick="prepararPagamento(${d.id}, 'parcial')"><i class="fas fa-coins me-2"></i>Pagamento parcial</button></li>
                </ul>
            </div>
        </div>`;
    };
    document.getElementById('lista-eu-devo').innerHTML = euDevo.map(item).join('') || '<p class="text-center small py-3">Sem dívidas registradas.</p>';
    document.getElementById('lista-me-devem').innerHTML = meDevem.map(item).join('') || '<p class="text-center small py-3">Sem valores a receber.</p>';
    renderizarHistoricoDividas();
}

// ---------- pagamentos de dívidas ----------
function prepararPagamento(id, modo) {
    const div = dados.dividas.find(d => d.id == id); if (!div) return;
    setCampo('pag-id', id); setCampo('pag-modo', modo); setCampo('pag-data', hojeISO());
    document.getElementById('tituloPagamento').innerText = modo === 'total' ? 'Pagamento Total' : 'Pagamento Parcial';
    setCampo('pag-valor', modo === 'total' ? fmtMoeda(div.valor) : '');
    document.getElementById('area-valor-pag').classList.toggle('d-none', modo === 'total');
    document.getElementById('pag-extrato-wrap').classList.remove('d-none');
    mostrarModal('modalPagamento');
}
function confirmarPagamento() {
    const id = Number(campo('pag-id')), modo = campo('pag-modo'), dataRaw = campo('pag-data'), valor = lerMoeda('pag-valor');
    if (!dataRaw) return erro('Selecione a data!');
    const dataBr = dataBR(dataRaw), hora = horaAgora();
    // --- compra de cartão ---
    if (modo.includes('-cartao')) {
        const card = cartaoAtual(), c = card && card.compras.find(x => x.id === id); if (!c) return;
        const restante = c.valorTotal - (c.pagamentos || []).reduce((s, p) => s + p.valor, 0);
        if (modo === 'parcial-cartao') {
            if (valor <= 0) return erro('Informe um valor maior que zero.');
            if (valor > restante + 0.005) return erro('O valor é maior que o saldo restante desta compra (' + brl(restante) + ').');
        }
        (c.pagamentos = c.pagamentos || []).push({ valor, data: dataBr, hora });
        salvarERender(); ocultarModal('modalPagamento'); avisar('Pagamento registrado'); return;
    }
    // --- dívida ---
    const idx = dados.dividas.findIndex(d => d.id === id); if (idx < 0) return;
    const div = dados.dividas[idx], quer = marcado('pag-extrato');
    let total = modo === 'total';
    if (modo === 'parcial') {
        if (valor <= 0) return erro('Informe um valor maior que zero.');
        if (valor > div.valor + 0.005) return erro('Valor inválido!');
        if (valor >= div.valor - 0.005) total = true; // pagou tudo = quitada (antes ficava com saldo 0 para sempre)
    }
    const pago = total ? div.valor : valor;
    if (total) {
        dados.dividas.splice(idx, 1);
        div.origem = 'dividas'; div.dataQuitacaoMs = Date.now();
        div.obs = (div.obs || '') + '\n- QUITADO TOTAL (' + brl(div.valor) + ') em ' + dataBr + ' às ' + hora;
        dados.historicoQuitados.push(div);
    } else {
        div.valor = arred(div.valor - valor);
        div.obs = (div.obs || '') + '\n→ Pago: ' + brl(valor) + ' (' + dataBr + ' às ' + hora + ')';
    }
    if (quer && pago > 0) lancarDividaNoExtrato(div, pago, false);
    salvarERender(); ocultarModal('modalPagamento'); avisar(total ? 'Dívida quitada e adicionada ao histórico!' : 'Pagamento parcial registrado!');
}
function lancarDividaNoExtrato(d, v, renderizar = true) {
    dados.movs.push({ id: Date.now(), desc: (d.tipo === 'eu-devo' ? 'Pagamento: ' : 'Recebimento: ') + d.nome, valor: v, tipo: d.tipo === 'eu-devo' ? 'saida' : 'entrada', cat: 'Dívidas', clienteId: d.clienteId || null, data: hojeISO(), hora: horaAgora(), fixo: false });
    if (renderizar) salvarERender();
}
function pagarParcelaDivida(id) {
    const d = dados.dividas.find(x => x.id === Number(id)); if (!d) return;
    const n = (d.pagas || 0) + 1, vp = Math.min(d.valorParcela || d.valor, d.valor), ultima = n >= d.parcelas || vp >= d.valor - 0.005;
    if (!confirm('Registrar o pagamento da parcela ' + n + '/' + d.parcelas + ' (' + brl(vp) + ')?')) return;
    const noExtrato = confirm('Lançar esta parcela no extrato?'), copia = { ...d };
    d.obs = (d.obs || '') + '\n→ Parcela ' + n + '/' + d.parcelas + ' paga: ' + brl(vp) + ' (' + new Date().toLocaleDateString('pt-BR') + ')';
    d.pagas = n;
    if (ultima) {
        dados.dividas = dados.dividas.filter(x => x !== d);
        d.valor = d.valorTotal || vp; d.origem = 'dividas'; d.dataQuitacaoMs = Date.now(); dados.historicoQuitados.push(d);
    } else { d.valor = arred(d.valor - vp); if (d.prazo) d.prazo = addMesData(d.prazo); }
    if (noExtrato) lancarDividaNoExtrato(copia, vp, false);
    salvarERender(); avisar('Parcela paga');
}

// ---------- histórico de quitadas (30 dias) ----------
function limparHistoricoAntigo() { // remove do histórico o que foi quitado há mais de 30 dias
    const lim = 30 * 24 * 60 * 60 * 1000, agora = Date.now(), antes = dados.historicoQuitados.length;
    dados.historicoQuitados = dados.historicoQuitados.filter(i => !i.dataQuitacaoMs || (agora - i.dataQuitacaoMs) < lim);
    if (dados.historicoQuitados.length !== antes) salvarERender();
}
function renderizarHistoricoDividas() {
    const lista = document.getElementById('lista-historico-dividas'); if (!lista) return;
    if (!dados.historicoQuitados.length) { lista.innerHTML = '<div class="text-center text-muted py-3">Nenhuma dívida quitada nos últimos 30 dias.</div>'; return; }
    lista.innerHTML = [...dados.historicoQuitados].reverse().map(item => {
        const eu = item.tipo === 'eu-devo', data = item.dataQuitacaoMs ? new Date(item.dataQuitacaoMs).toLocaleDateString('pt-BR') : '---';
        return `<div class="card-mov p-3 mb-2"><div class="d-flex justify-content-between align-items-center w-100">
            <div><span class="badge ${eu ? 'bg-danger' : 'bg-success'} mb-1">${eu ? 'Eu devia' : 'Me deviam'}</span>
                <h6 class="mb-0 fw-bold text-main">${escaparHTML(item.nome || item.desc || 'Sem nome')}</h6>
                <small class="text-muted d-block" style="font-size:.75rem">Quitado em: ${data}</small></div>
            <div class="text-end d-flex align-items-center gap-3"><span class="fw-bold money-value text-muted">${brl(item.valor)}</span>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="excluirItemHistoricoManual(${item.id})" title="Mover para a lixeira"><i class="fas fa-trash-alt"></i></button></div>
        </div></div>`;
    }).join('');
}
function excluirItemHistoricoManual(id) {
    if (!confirm('Deseja mover este registro do histórico para a lixeira?')) return;
    const idx = dados.historicoQuitados.findIndex(i => i.id === Number(id)); if (idx < 0) return;
    const item = dados.historicoQuitados.splice(idx, 1)[0];
    item.origem = 'historicoQuitados'; item.deletadoEm = new Date().toLocaleDateString('pt-BR'); item.lixeiraTitulo = 'Quitada: ' + (item.nome || 'Dívida');
    dados.lixeira.push(item); salvarERender();
}

/* ===================================================================
   9. METAS DE POUPANÇA
   =================================================================== */
function salvarMeta() {
    if (!verificarAcesso()) return;
    const nome = campo('meta-nome').trim(), objetivo = lerMoeda('meta-objetivo'), inicio = campo('meta-data-inicio'), fim = campo('meta-data-fim');
    if (!nome || objetivo <= 0 || !inicio || !fim) return erro('Preencha todos os campos da meta corretamente!');
    if (fim < inicio) return erro('A data alvo não pode ser anterior à data de início.');
    dados.metas.push({ id: Date.now(), nome, objetivo, guardado: 0, inicio, fim, historico: [] });
    ['meta-nome', 'meta-objetivo', 'meta-data-inicio', 'meta-data-fim'].forEach(i => setCampo(i, ''));
    salvarERender(); ocultarModal('modalMeta'); avisar('Meta salva');
}
function renderMetas() {
    const lista = document.getElementById('lista-metas'); if (!lista) return;
    lista.innerHTML = dados.metas.length ? dados.metas.map(m => {
        const perc = Math.min((m.guardado / m.objetivo) * 100, 100).toFixed(0);
        return `<div class="col-12 col-md-6 mb-3"><div class="card p-3 border-0 shadow-sm rounded-4 bg-white">
            <div class="d-flex justify-content-between align-items-start mb-2"><div><h6 class="fw-bold text-dark mb-0">${escaparHTML(m.nome)}</h6>
                <small class="text-muted" style="font-size:.75rem">${dataBR(m.inicio)} até ${dataBR(m.fim)}</small></div><span class="badge bg-purple text-white">${perc}%</span></div>
            <div class="d-flex justify-content-between my-2" style="font-size:.85rem"><span class="text-muted">Acumulado: <b class="text-success">${brl(m.guardado)}</b></span><span class="text-muted">Alvo: <b>${brl(m.objetivo)}</b></span></div>
            <div class="progress mb-2" style="height:10px;border-radius:10px"><div class="progress-bar bg-success" role="progressbar" style="width:${perc}%;border-radius:10px"></div></div>
            ${m.historico && m.historico.length ? `<div class="mt-2 mb-3 p-2 bg-light rounded-3 border-start border-purple border-3 shadow-sm" style="font-size:.75rem;max-height:100px;overflow-y:auto">
                <div class="text-uppercase fw-bold text-muted mb-1" style="font-size:.65rem">Histórico da Meta:</div>
                ${m.historico.map((h, i) => `<div class="text-dark d-flex justify-content-between align-items-center py-1 border-bottom-dashed">
                    <span>${h.tipo === 'poupar' ? '<i class="fas fa-arrow-down text-success me-1"></i>Guardou' : '<i class="fas fa-arrow-up text-danger me-1"></i>Retirou'}: ${brl(h.valor)}</span>
                    <div class="d-flex align-items-center gap-2"><span class="text-muted" style="font-size:.7rem">${escaparHTML(h.data)} às ${escaparHTML(h.hora)}</span>
                    <button class="btn btn-sm text-danger p-0 border-0" onclick="excluirHistoricoMeta(${m.id}, ${i})" style="font-size:.85rem;line-height:1">&times;</button></div></div>`).reverse().join('')}
            </div>` : '<div class="text-muted text-center my-2" style="font-size:.75rem">Nenhum depósito realizado.</div>'}
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-success flex-grow-1" onclick="movimentarMeta(${m.id}, 'poupar')"><i class="fas fa-piggy-bank me-1"></i> Poupar</button>
                <button class="btn btn-sm btn-outline-warning flex-grow-1" onclick="movimentarMeta(${m.id}, 'resgatar')"><i class="fas fa-hand-holding-usd me-1"></i> Resgatar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirMeta(${m.id})"><i class="fas fa-trash"></i></button>
            </div></div></div>`;
    }).join('') : '<p class="text-center text-muted py-4 w-100">Nenhuma meta cadastrada ainda.</p>';
}
function movimentarMeta(id, acao) { // o valor guardado NÃO sai do extrato (fica só no histórico da meta)
    if (!verificarAcesso()) return;
    const meta = dados.metas.find(m => m.id == id); if (!meta) return;
    const txt = prompt(acao === 'poupar' ? 'Quanto deseja guardar para esta meta?' : 'Quanto deseja resgatar desta meta?'); if (!txt) return;
    const valor = parseFloat(txt.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) return erro('Valor inválido!');
    if (acao !== 'poupar' && valor > meta.guardado) return erro('Saldo insuficiente na meta para resgate!');
    meta.guardado = arred(meta.guardado + (acao === 'poupar' ? valor : -valor));
    (meta.historico = meta.historico || []).push({ tipo: acao, valor, data: new Date().toLocaleDateString('pt-BR'), hora: horaAgora() });
    salvarERender(); avisar('Movimentação da meta registrada');
}
function excluirHistoricoMeta(metaId, index) {
    if (!confirm('Tem certeza que deseja apagar este registro do histórico? O saldo da meta será corrigido automaticamente.')) return;
    const meta = dados.metas.find(m => m.id === metaId); if (!meta || !meta.historico || !meta.historico[index]) return;
    const h = meta.historico[index];
    meta.guardado = arred(meta.guardado + (h.tipo === 'poupar' ? -h.valor : h.valor));
    meta.historico.splice(index, 1);
    if (h.idMovimento) dados.movs = dados.movs.filter(m => m.id !== h.idMovimento); // registros antigos geravam lançamento no extrato
    salvarERender();
}
function excluirMeta(id) {
    if (!confirm('Deseja realmente excluir esta meta? O valor guardado não será devolvido automaticamente ao saldo geral.')) return;
    dados.metas = dados.metas.filter(m => m.id !== Number(id)); salvarERender();
}

/* ===================================================================
   10. NOTAS
   =================================================================== */
function abrirModalNota(id = null) {
    if (!verificarAcesso()) return;
    const nota = id ? notas.find(n => n.id === id) : null;
    setCampo('nota-id-edit', id || ''); setCampo('nota-titulo', nota ? nota.titulo : ''); setCampo('nota-texto', nota ? nota.texto : '');
    setCampo('nota-fixada', nota ? String(nota.fixada) : 'false');
    selecionarCorNota(nota ? nota.cor : '#ffffff'); setCampo('nota-cor-custom', nota ? nota.cor : '#ffffff');
    document.getElementById('btn-fixar-nota').classList.toggle('active', !!(nota && nota.fixada));
    document.getElementById('modalNotaTitulo').innerText = id ? 'Editar Nota' : 'Nova Nota';
    document.getElementById('btn-excluir-nota').classList.toggle('d-none', !id);
    document.getElementById('btn-copiar-nota').classList.toggle('d-none', !id);
    mostrarModal('modalNota');
}
function selecionarCorNota(cor) { setCampo('nota-cor-fundo', cor); document.getElementById('cor-fundo-modal-nota').style.backgroundColor = cor; }
function toggleFixarNota() {
    const fixa = campo('nota-fixada') === 'true';
    setCampo('nota-fixada', fixa ? 'false' : 'true'); document.getElementById('btn-fixar-nota').classList.toggle('active');
}
function salvarNota() {
    if (!verificarAcesso()) return;
    const id = campo('nota-id-edit'), titulo = campo('nota-titulo').trim(), texto = campo('nota-texto').trim(), cor = campo('nota-cor-fundo'), fixada = campo('nota-fixada') === 'true';
    if (!titulo && !texto) return; // não salva nota vazia
    const i = id ? notas.findIndex(n => n.id == id) : -1;
    if (i > -1) notas[i] = { ...notas[i], titulo, texto, cor, fixada };
    else notas.push({ id: Date.now(), titulo, texto, cor, fixada, data: new Date().toISOString() });
    persistirNotas(); ocultarModal('modalNota'); renderizarNotas(); avisar('Nota salva');
}
function renderizarNotas() {
    const listaGeral = document.getElementById('lista-notas'), listaFixadas = document.getElementById('lista-notas-fixadas'), contFix = document.getElementById('container-notas-fixadas'), tituloOutras = document.getElementById('titulo-outras-notas'), vazio = document.getElementById('notas-vazio');
    if (!listaGeral || !listaFixadas || !vazio || !contFix) return;
    listaGeral.innerHTML = ''; listaFixadas.innerHTML = '';
    if (!notas.length) { vazio.classList.remove('d-none'); contFix.classList.add('d-none'); return; }
    vazio.classList.add('d-none');
    const fixadas = notas.filter(n => n.fixada), normais = notas.filter(n => !n.fixada);
    contFix.classList.toggle('d-none', !fixadas.length);
    tituloOutras.classList.toggle('d-none', !fixadas.length || !normais.length);
    const card = nota => `
        <div class="col-6 col-md-4 mb-3"><div class="nota-card shadow-sm position-relative text-start" style="background-color:${escaparHTML(nota.cor)};min-height:120px;border-radius:15px;overflow:hidden">
            <div class="dropdown position-absolute top-0 end-0 m-2" style="z-index:10">
                <button class="btn btn-link text-muted p-1 lh-1 border-0 shadow-none" data-bs-toggle="dropdown" aria-expanded="false"><i class="fas fa-ellipsis-v" style="font-size:.9rem"></i></button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size:.85rem">
                    <li><button class="dropdown-item py-2" onclick="copiarNotaRapida(${nota.id})"><i class="fas fa-copy text-secondary me-2"></i> Copiar Texto</button></li>
                    <li><button class="dropdown-item py-2 text-danger" onclick="event.stopPropagation(); excluirNotaDireta(${nota.id})"><i class="fas fa-trash-alt me-2"></i> Excluir Nota</button></li>
                </ul></div>
            <div onclick="abrirModalNota(${nota.id})" class="w-100 p-3 pt-4" style="cursor:pointer;min-height:120px">
                ${nota.fixada ? '<i class="fas fa-thumbtack pin-icon mb-1 d-block text-muted" style="font-size:.8rem"></i>' : ''}
                <div class="nota-titulo-card fw-bold text-dark text-truncate pe-3" style="font-size:.95rem;line-height:1.2">${escaparHTML(nota.titulo || 'Sem título')}</div>
                <div class="nota-resumo-card text-muted mt-1 small text-wrap text-break pe-2" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escaparHTML(nota.texto || '')}</div>
            </div></div></div>`;
    listaFixadas.innerHTML = fixadas.map(card).join(''); listaGeral.innerHTML = normais.map(card).join('');
}
function excluirNota() {
    if (!confirm('Deseja excluir esta nota permanentemente?')) return;
    const id = campo('nota-id-edit');
    notas = notas.filter(n => n.id != id); persistirNotas(); ocultarModal('modalNota'); renderizarNotas(); avisar('Nota excluída');
}
function excluirNotaDireta(id) {
    if (!confirm('Deseja excluir esta nota permanentemente?')) return;
    notas = notas.filter(n => n.id != id); persistirNotas(); renderizarNotas(); avisar('Nota excluída');
}
function copiarTexto(t) { return navigator.clipboard.writeText(t).then(() => avisar('Texto copiado para a área de transferência!')).catch(() => erro('Não foi possível copiar.')); }
function copiarNota() { copiarTexto(campo('nota-texto')); }
function copiarNotaRapida(id) {
    const nota = notas.find(n => n.id == id);
    if (!nota || !nota.texto) return erro('Esta nota não possui texto para copiar.');
    copiarTexto(nota.texto);
}

/* ===================================================================
   11. CLIENTES
   =================================================================== */
function clientes() { return dados.clientes || (dados.clientes = []); }
let _cliFiltro = 'todos';
function resumoCliente(c) {
    const movs = dados.movs.filter(m => m.clienteId === c.id), ent = movs.filter(m => m.tipo === 'entrada'), hoje = hojeISO();
    const abertas = dados.dividas.filter(d => d.clienteId === c.id && d.tipo === 'me-devem'), rec = ent.reduce((s, m) => s + m.valor, 0);
    return { movs, abertas, recebido: rec, aberto: abertas.reduce((s, d) => s + d.valor, 0), vencido: abertas.filter(d => d.prazo && d.prazo < hoje).reduce((s, d) => s + d.valor, 0), ticket: ent.length ? rec / ent.length : 0, ultimo: ent.map(m => m.data).sort().pop() || '' };
}
function niverMes(c) { return c.nasc && c.nasc.substring(5, 7) === hojeISO().substring(5, 7); }
function setCliFiltro(f) { _cliFiltro = f; renderClientes(); }
function renderClientes() {
    const L = document.getElementById('lista-clientes'); if (!L) return; const q = (campo('busca-cliente') || '').toLowerCase(), C = clientes();
    document.querySelectorAll('#cli-chips .btn-status-filter').forEach(b => b.classList.toggle('active', b.dataset.f === _cliFiltro));
    const info = C.map(c => ({ c, r: resumoCliente(c) }));
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('cli-total', C.filter(c => c.status !== 'inativo').length); set('cli-aberto', brl(info.reduce((s, x) => s + x.r.aberto, 0)));
    const lista = info.filter(({ c, r }) => (!q || [c.nome, c.tel, c.email, c.doc, c.segmento, c.tags].join(' ').toLowerCase().includes(q)) && (_cliFiltro === 'todos' || (_cliFiltro === 'devendo' ? r.aberto > 0 : _cliFiltro === 'niver' ? niverMes(c) : (c.status || 'ativo') === _cliFiltro))).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
    L.innerHTML = lista.map(({ c, r }) => '<div class="div-item" onclick="verCliente(' + c.id + ')" style="cursor:pointer"><span class="div-av ' + (r.vencido > 0 ? 'pagar' : 'receber') + '">' + escaparHTML(c.nome.trim().charAt(0).toUpperCase()) + '</span>'
        + '<div class="div-mid"><b>' + escaparHTML(c.nome) + '</b><small>' + escaparHTML(c.tel || c.email || 'Sem contato') + (c.segmento ? ' • ' + escaparHTML(c.segmento) : '') + '</small>'
        + '<span class="chip-st st-' + (c.status || 'ativo') + '">' + ({ ativo: 'Ativo', lead: 'Lead', inativo: 'Inativo' }[c.status || 'ativo']) + '</span>' + (niverMes(c) ? ' <span class="chip-st st-lead"><i class="fas fa-cake-candles"></i> Aniversário no mês</span>' : '') + '</div>'
        + '<div class="div-val">' + (r.aberto > 0 ? '<span class="text-danger money-value">' + brl(r.aberto) + '</span><small>em aberto</small>' : '<span class="money-value">' + (r.recebido > 0 ? brl(r.recebido) : '—') + '</span><small>' + (r.recebido > 0 ? 'recebido' : 'sem movimento') + '</small>') + '</div></div>').join('')
        || '<div class="text-center text-muted py-4 small">' + (C.length ? 'Nenhum cliente neste filtro.' : 'Nenhum cliente cadastrado ainda.<br>Toque em <b>Novo cliente</b> para começar.') + '</div>';
}
function abrirModalCliente(id) {
    if (!verificarAcesso()) return; const c = id ? clientes().find(x => x.id === Number(id)) : {}; const o = (arr, v) => arr.map(([k, t]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + t + '</option>').join(''), val = k => escaparHTML(c[k] || '');
    const f = (rot, idc, k, ph = '', tp = 'text') => '<div class="col-12"><label class="small fw-bold">' + rot + '</label><input type="' + tp + '" id="cli-' + idc + '" class="form-control" placeholder="' + ph + '" value="' + val(k) + '"></div>';
    modalDin('modalCliente', '<div class="modal-body p-4"><h5 class="fw-bold mb-3">' + (id ? 'Editar cliente' : 'Novo cliente') + '</h5><div class="row g-2">'
        + f('Nome / Razão social *', 'nome', 'nome', 'Nome completo')
        + '<div class="col-6"><label class="small fw-bold">Tipo</label><select id="cli-tipo" class="form-select">' + o([['PF', 'Pessoa física'], ['PJ', 'Pessoa jurídica']], c.tipo || 'PF') + '</select></div><div class="col-6"><label class="small fw-bold">Status</label><select id="cli-status" class="form-select">' + o([['ativo', 'Ativo'], ['lead', 'Lead / Prospect'], ['inativo', 'Inativo']], c.status || 'ativo') + '</select></div>'
        + f('CPF / CNPJ', 'doc', 'doc', '000.000.000-00') + f('WhatsApp / Telefone', 'tel', 'tel', 'DDD + número', 'tel') + f('E-mail', 'email', 'email', 'nome@email.com', 'email')
        + '<div class="col-5"><label class="small fw-bold">CEP</label><input id="cli-cep" class="form-control" value="' + val('cep') + '" inputmode="numeric"></div><div class="col-7"><label class="small fw-bold">Cidade / UF</label><input id="cli-cidade" class="form-control" value="' + val('cidade') + '"></div>' + f('Endereço', 'end', 'endereco', 'Rua, número, bairro')
        + '<div class="col-6"><label class="small fw-bold">Aniversário</label><input type="date" id="cli-nasc" class="form-control" value="' + val('nasc') + '"></div><div class="col-6"><label class="small fw-bold">Como chegou</label><select id="cli-origem" class="form-select">' + o([['', 'Não informar'], ['Indicação', 'Indicação'], ['Instagram', 'Instagram'], ['WhatsApp', 'WhatsApp'], ['Site', 'Site'], ['Presencial', 'Presencial'], ['Outro', 'Outro']], c.canal || '') + '</select></div>'
        + f('Segmento / Tipo de cliente', 'seg', 'segmento', 'Ex: Revenda, Serviço, Atacado') + f('Tags (separe por vírgula)', 'tags', 'tags', 'vip, parcelado')
        + '<div class="col-12"><label class="small fw-bold">Observações</label><textarea id="cli-obs" class="form-control" rows="2">' + val('obs') + '</textarea></div></div>'
        + '<div class="d-flex gap-2 mt-3"><button class="btn btn-primary flex-grow-1" onclick="salvarCliente(' + (id ? Number(id) : 0) + ')">Salvar cliente</button>' + (id ? '<button class="btn btn-outline-danger" onclick="excluirCliente(' + Number(id) + ')"><i class="fas fa-trash"></i></button>' : '') + '</div></div>').show();
}
function salvarCliente(id) {
    const nome = campo('cli-nome').trim(); if (!nome) return erro('Informe o nome do cliente.');
    const ant = id ? clientes().find(x => x.id === id) : null, c = { id: id || Date.now(), nome, tipo: campo('cli-tipo'), status: campo('cli-status'), doc: campo('cli-doc').trim(), tel: campo('cli-tel').trim(), email: campo('cli-email').trim(), cep: campo('cli-cep').trim(), cidade: campo('cli-cidade').trim(), endereco: campo('cli-end').trim(), nasc: campo('cli-nasc'), canal: campo('cli-origem'), segmento: campo('cli-seg').trim(), tags: campo('cli-tags').trim(), obs: campo('cli-obs').trim(), criado: ant ? ant.criado : hojeISO(), interacoes: ant ? ant.interacoes || [] : [] };
    const i = clientes().findIndex(x => x.id === c.id); if (i > -1) clientes()[i] = c; else clientes().push(c);
    salvarERender(); ocultarModal('modalCliente'); avisar('Cliente salvo');
}
function excluirCliente(id) {
    const i = clientes().findIndex(x => x.id === id); if (i < 0 || !confirm('Mover este cliente para a lixeira? Os lançamentos e dívidas continuam, mas deixam de estar ligados a ele.')) return;
    const c = clientes().splice(i, 1)[0]; c.origem = 'clientes'; c.deletadoEm = new Date().toLocaleDateString('pt-BR'); c.lixeiraTitulo = 'Cliente: ' + c.nome; dados.lixeira.push(c); salvarERender(); ocultarModal('modalCliente'); ocultarModal('modalClienteDet'); avisar('Cliente enviado para a lixeira');
}
function verCliente(id) {
    const c = clientes().find(x => x.id === Number(id)); if (!c) return; const r = resumoCliente(c), wa = soDigitos(c.tel), waN = wa.length <= 11 ? '55' + wa : wa, hoje = hojeISO();
    const tile = (t, v, cls = '') => '<div class="home-tile"><div><small>' + t + '</small><b class="money-value ' + cls + '">' + v + '</b></div></div>', lin = (ic, t) => t ? '<div class="cli-lin"><i class="fas ' + ic + '"></i><span>' + escaparHTML(t) + '</span></div>' : '';
    const tags = (c.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => '<span class="chip-st st-inativo">' + escaparHTML(t) + '</span>').join(' ');
    modalDin('modalClienteDet', '<div class="modal-body p-4"><div class="d-flex align-items-center gap-3 mb-3"><span class="div-av receber" style="width:52px;height:52px;flex:0 0 52px;font-size:1.3rem">' + escaparHTML(c.nome.trim().charAt(0).toUpperCase()) + '</span><div class="flex-grow-1 min-w-0"><h5 class="fw-bold mb-0">' + escaparHTML(c.nome) + '</h5><small class="text-muted">' + (c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física') + ' • cliente desde ' + dataBR(c.criado) + '</small></div><button class="div-icon-btn" onclick="ocultarModal(\'modalClienteDet\');abrirModalCliente(' + c.id + ')" title="Editar"><i class="fas fa-pen"></i></button></div>'
        + '<div class="d-flex gap-2 mb-3">' + (wa ? '<a class="btn btn-sm btn-outline-primary flex-fill" target="_blank" href="https://wa.me/' + waN + '"><i class="fab fa-whatsapp me-1"></i>WhatsApp</a><a class="btn btn-sm btn-outline-primary flex-fill" href="tel:' + wa + '"><i class="fas fa-phone me-1"></i>Ligar</a>' : '') + (c.email ? '<a class="btn btn-sm btn-outline-primary flex-fill" href="mailto:' + escaparHTML(c.email) + '"><i class="fas fa-envelope me-1"></i>E-mail</a>' : '') + '</div>'
        + '<div class="home-tiles" style="margin-bottom:12px">' + tile('Total recebido', brl(r.recebido), 'text-success') + tile('Em aberto', brl(r.aberto), r.aberto > 0 ? 'text-danger' : '') + tile('Vencido', brl(r.vencido), r.vencido > 0 ? 'text-danger' : '') + tile('Ticket médio', brl(r.ticket)) + '</div>'
        + '<div class="d-flex gap-2 mb-3"><button class="btn btn-primary btn-sm flex-fill" onclick="novoLancCliente(' + c.id + ')"><i class="fas fa-plus me-1"></i>Novo lançamento</button><button class="btn btn-outline-primary btn-sm flex-fill" onclick="novaCobranca(' + c.id + ')"><i class="fas fa-file-invoice-dollar me-1"></i>Nova cobrança</button></div>'
        + '<div class="mb-3">' + lin('fa-id-card', c.doc) + lin('fa-phone', c.tel) + lin('fa-envelope', c.email) + lin('fa-location-dot', [c.endereco, c.cidade, c.cep].filter(Boolean).join(' • ')) + lin('fa-cake-candles', c.nasc ? 'Aniversário: ' + dataBR(c.nasc).substring(0, 5) : '') + lin('fa-bullseye', c.canal ? 'Origem: ' + c.canal : '') + lin('fa-briefcase', c.segmento) + (tags ? '<div class="mt-2">' + tags + '</div>' : '') + (c.obs ? '<div class="cli-obs">' + escaparHTML(c.obs) + '</div>' : '') + '</div>'
        + '<h6 class="fw-bold small text-uppercase text-muted">Cobranças em aberto</h6>' + (r.abertas.map(d => '<div class="div-item mb-2"><div class="div-mid"><b>' + escaparHTML(d.desc || d.nome) + '</b><small>' + (d.prazo ? 'Vence ' + dataBR(d.prazo) : 'Sem prazo') + ((d.parcelas || 1) > 1 ? ' • Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : '') + '</small>' + (d.prazo && d.prazo < hoje ? '<span class="chip-st st-venc">Vencida</span>' : '') + '</div><div class="div-val money-value">' + brl(d.valor) + '</div><button class="btn btn-sm btn-outline-success" onclick="ocultarModal(\'modalClienteDet\');prepararPagamento(' + d.id + ',\'total\')">Receber</button></div>').join('') || '<p class="small text-muted">Nada em aberto.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Últimos lançamentos</h6>' + (r.movs.slice().sort(ordemMov).slice(0, 5).map(m => '<div class="d-flex justify-content-between small py-1 border-bottom"><span>' + dataBR(m.data).substring(0, 5) + ' • ' + escaparHTML(m.desc) + '</span><b class="money-value ' + (m.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + brl(m.valor) + '</b></div>').join('') || '<p class="small text-muted">Sem lançamentos ligados a este cliente.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Histórico de contatos</h6><div id="cli-hist">' + (c.interacoes || []).slice().reverse().map(i => '<div class="cli-int"><small class="text-muted">' + dataBR(i.data) + '</small><div>' + escaparHTML(i.texto) + '</div></div>').join('') + '</div>'
        + '<div class="d-flex gap-2 mt-2"><input id="cli-int-txt" class="form-control form-control-sm" placeholder="Registrar contato (ligou, enviou orçamento...)"><button class="btn btn-sm btn-primary" onclick="addInteracao(' + c.id + ')"><i class="fas fa-plus"></i></button></div></div>').show();
}
function addInteracao(id) { const t = campo('cli-int-txt').trim(); if (!t) return; const c = clientes().find(x => x.id === id); (c.interacoes = c.interacoes || []).push({ data: hojeISO(), texto: t.slice(0, 300) }); salvarERender(); verCliente(id); }
function novoLancCliente(id) {
    ocultarModal('modalClienteDet');
    setTimeout(() => { abrirModalMov(); setCampo('mov-tipo', 'entrada'); popularCategorias('entrada', null); toggleCartaoMov(); popularClientes('mov-cliente', id); mostrarModal('modalMov'); }, 250);
}
function novaCobranca(id) {
    ocultarModal('modalClienteDet'); setTimeout(() => { abrirModalDivida(); setCampo('div-tipo', 'me-devem'); popularClientes('div-cliente', id); preencherDeCliente(); }, 250);
}
function exportarClientesCSV() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    if (!clientes().length) return erro('Nenhum cliente para exportar.');
    const csv = '\uFEFFNome;Tipo;Status;Documento;Telefone;E-mail;Cidade;Segmento;Origem;Tags;Recebido;Em aberto\r\n' + clientes().map(c => { const r = resumoCliente(c); return [q(c.nome), c.tipo, c.status, q(c.doc), q(c.tel), q(c.email), q(c.cidade), q(c.segmento), q(c.canal), q(c.tags), r.recebido.toFixed(2).replace('.', ','), r.aberto.toFixed(2).replace('.', ',')].join(';'); }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ===================================================================
   12. REVENDA
   =================================================================== */
function abrirModalRevenda(id) {
    if (!verificarAcesso()) return;
    const p = id ? dados.revenda.find(x => x.id === Number(id)) : null;
    setCampo('revenda-id-edit', p ? p.id : ''); setCampo('revenda-nome', p ? p.nome : ''); setCampo('revenda-cat', p ? p.cat : 'Outros');
    setCampo('revenda-vlr-compra', p ? fmtMoeda(p.compra) : ''); setCampo('revenda-vlr-venda', p ? fmtMoeda(p.venda) : ''); setCampo('revenda-qtd', p ? p.qtd : 1);
    document.getElementById('btn-excluir-revenda').classList.toggle('d-none', !p);
    mostrarModal('modalProdutoRevenda');
}
function salvarProdutoRevenda() {
    if (!verificarAcesso()) return;
    const nome = campo('revenda-nome').trim(), compra = lerMoeda('revenda-vlr-compra'), venda = lerMoeda('revenda-vlr-venda'), qtd = parseInt(campo('revenda-qtd')) || 0;
    if (!nome || venda <= 0 || qtd < 1) return erro('Informe o nome, o valor de venda e a quantidade (mínimo 1).');
    const id = Number(campo('revenda-id-edit')) || 0, antigo = id ? dados.revenda.find(x => x.id === id) : null;
    const p = { id: id || Date.now(), nome, cat: campo('revenda-cat'), compra, venda, qtd, vendidos: antigo ? (antigo.vendidos || 0) : 0 };
    const idx = dados.revenda.findIndex(x => x.id === p.id);
    if (idx > -1) dados.revenda[idx] = p; else dados.revenda.push(p);
    salvarERender(); ocultarModal('modalProdutoRevenda'); avisar('Produto salvo');
}
function excluirProdutoRevenda() {
    const id = Number(campo('revenda-id-edit')), i = dados.revenda.findIndex(x => x.id === id);
    if (i < 0 || !confirm('Mover este produto para a lixeira?')) return;
    const it = dados.revenda.splice(i, 1)[0];
    it.origem = 'revenda'; it.deletadoEm = new Date().toLocaleDateString('pt-BR'); dados.lixeira.push(it);
    salvarERender(); ocultarModal('modalProdutoRevenda'); avisar('Produto enviado para a lixeira');
}
function venderProdutoRevenda(id) {
    if (!verificarAcesso()) return;
    const p = dados.revenda.find(x => x.id === Number(id)); if (!p || p.qtd < 1) return;
    if (!confirm('Registrar a venda de 1 unidade de "' + p.nome + '" por ' + brl(p.venda) + '?\nSerá lançada como Receita no extrato.')) return;
    p.qtd--; p.vendidos = (p.vendidos || 0) + 1;
    dados.movs.push({ id: Date.now(), desc: 'Venda: ' + p.nome, valor: p.venda, tipo: 'entrada', cat: 'Outros', data: hojeISO(), hora: horaAgora(), fixo: false });
    salvarERender(); avisar('Venda registrada');
}
function renderRevenda() {
    const l = document.getElementById('lista-produtos-revenda'); if (!l) return;
    const R = dados.revenda; let prev = 0, luc = 0;
    R.forEach(p => { prev += p.venda * p.qtd; luc += (p.venda - p.compra) * p.qtd; });
    const t1 = document.getElementById('total-venda-revenda'), t2 = document.getElementById('lucro-total-revenda');
    t1.innerText = brl(prev); t2.innerText = brl(luc); t1.classList.add('money-value'); t2.classList.add('money-value');
    document.getElementById('revenda-vazio').classList.toggle('d-none', R.length > 0);
    l.innerHTML = R.map(p => {
        const lu = p.venda - p.compra, mg = p.venda > 0 ? Math.round(lu / p.venda * 100) : 0;
        return '<div class="col-12"><div class="card-mov align-items-start py-3"><div class="flex-grow-1">'
            + '<div class="fw-bold">' + escaparHTML(p.nome) + '</div>'
            + '<small class="text-muted d-block">' + escaparHTML(p.cat) + ' • Estoque: ' + p.qtd + ' • Vendidos: ' + (p.vendidos || 0) + '</small>'
            + '<small class="d-block money-value">Compra ' + brl(p.compra) + ' → Venda ' + brl(p.venda) + '</small>'
            + '<small class="fw-bold money-value ' + (lu >= 0 ? 'text-success' : 'text-danger') + '">Lucro/un.: ' + brl(lu) + ' (' + mg + '%)</small></div>'
            + '<div class="d-flex flex-column gap-1"><button class="btn btn-sm btn-outline-success" onclick="venderProdutoRevenda(' + p.id + ')"' + (p.qtd < 1 ? ' disabled' : '') + '>Vender 1</button>'
            + '<button class="btn btn-sm btn-outline-secondary" onclick="abrirModalRevenda(' + p.id + ')">Editar</button></div></div></div>';
    }).join('');
}

/* ============================================================
   13. INÍCIO, RESUMO, GRÁFICOS E ANÁLISES
   ============================================================ */
const TELAS_EXTRAS = ['compras-cartao', 'lixeira', 'aba-graficos', 'aba-anual', 'aba-orcamento', 'aba-fixos', 'aba-previsao', 'aba-comparar', 'aba-quitar', 'aba-clientes'];
function renderTudo() {
    renderResumo(); renderExtrato(); renderCartoes(); renderDividas(); renderMetas(); renderizarNotas(); renderRevenda(); renderClientes();
    if (TELAS_EXTRAS.includes(_secAtual) && RENDER_DA_TELA[_secAtual]) RENDER_DA_TELA[_secAtual]();
    atualizarTopo();
}

// ---------- Saldos ----------
function saldoMesDe(ym) {
    let e = 0, s = 0;
    efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).forEach(m => { if (m.tipo === 'entrada') e += m.valor; else s += m.valor; });
    return { e, s };
}
function acumuladoAte(ym) {
    const datas = dados.movs.map(m => m.data && m.data.substring(0, 7)).filter(Boolean).sort(); let a = 0;
    if (datas.length) for (let c = datas[0]; c <= ym; c = ymAdd(c, 1)) { const r = saldoMesDe(c); a += r.e - r.s; }
    return a;
}

function renderResumo() {
    const elSaldo = document.getElementById('txt-saldo-geral'); if (!elSaldo) return;
    const ym = _mesSel(), r = saldoMesDe(ym), saldo = r.e - r.s;
    elSaldo.innerText = brl(saldo);
    elSaldo.classList.toggle('saldo-negativo', saldo < 0);
    const ent = document.getElementById('txt-entradas'), sai = document.getElementById('txt-saidas');
    if (ent) ent.innerText = brl(r.e);
    if (sai) sai.innerText = '- ' + brl(r.s);
    const ac = document.getElementById('txt-saldo-acum');
    if (ac) ac.innerHTML = 'Acumulado até aqui: <b class="money-value">' + brl(acumuladoAte(ym)) + '</b>';
    // quanto posso gastar por dia (só no mês corrente)
    const d = document.getElementById('card-diario'), info = document.getElementById('diario-info');
    if (d && info) {
        const hoje = new Date();
        if (hojeISO().substring(0, 7) !== ym) d.style.display = 'none';
        else {
            const restam = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() - hoje.getDate() + 1;
            d.style.display = '';
            info.innerHTML = saldo > 0
                ? '<div class="fw-bold fs-5 text-success money-value">' + brl(saldo / restam) + '</div><small class="text-muted">Restam ' + restam + ' dia(s) e ' + brl(saldo) + ' livres no mês (já descontadas faturas e fixos lançados).</small>'
                : '<div class="fw-bold text-danger">Sem saldo livre no mês</div><small class="text-muted">As despesas já superam as receitas lançadas.</small>';
        }
    }
    renderHome();
}

// ---------- Início ----------
function sequenciaDias() { // dias seguidos com pelo menos 1 lançamento
    const s = new Set(dados.movs.map(m => m.data)), d = new Date(); let n = 0;
    if (!s.has(hojeISO())) d.setDate(d.getDate() - 1);
    for (;;) { if (!s.has(isoDe(d))) break; n++; d.setDate(d.getDate() - 1); }
    return n;
}
function toggleDiario() { const d = document.getElementById('card-diario'); if (d) d.classList.toggle('aberto'); }
const _dm = s => s.substring(8, 10) + '/' + s.substring(5, 7);

function proximos() { // fixos, parcelas/dívidas e faturas dos próximos 35 dias
    const hoje = hojeISO(), lim = new Date(); lim.setDate(lim.getDate() + 35); const limS = isoDe(lim), out = [];
    fixosAtivos().forEach(t => {
        const dia = parseInt(t.data.substring(8, 10));
        for (let i = 0; i <= 1; i++) {
            const ym = ymAdd(hoje.substring(0, 7), i), [a, mm] = ym.split('-').map(Number), dt = ym + '-' + String(Math.min(dia, new Date(a, mm, 0).getDate())).padStart(2, '0');
            if (dt >= hoje && dt <= limS) out.push({ data: dt, titulo: t.desc, sub: t.cat + ' | Recorrência', valor: t.valor, tipo: t.tipo, ic: iconeCat(t.cat) });
        }
    });
    dados.dividas.forEach(d => {
        if (!d.prazo || d.prazo > limS) return; const parc = (d.parcelas || 1) > 1;
        out.push({ data: d.prazo, titulo: d.nome, sub: (d.tipo === 'eu-devo' ? 'A pagar' : 'A receber') + (parc ? ' | Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : ' | Dívida'), valor: parc ? (d.valorParcela || d.valor) : d.valor, tipo: d.tipo === 'eu-devo' ? 'saida' : 'entrada', ic: ['fa-handshake', '#8a2be2'], atrasada: d.prazo < hoje, dividas: 1 });
    });
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito' || !parseInt(c.vence)) return;
        const v = String(parseInt(c.vence)).padStart(2, '0'); let ym = hoje.substring(0, 7); if (ym + '-' + v < hoje) ym = ymAdd(ym, 1);
        const dt = ym + '-' + v; if (dt > limS) return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0);
        if (t > 0) out.push({ data: dt, titulo: 'Fatura ' + c.nome, sub: 'Cartão | Fatura', valor: t, tipo: 'saida', ic: ['fa-credit-card', c.cor || '#6366f1'], cartao: c.id });
    });
    return out.sort((a, b) => a.data.localeCompare(b.data)).slice(0, 10);
}
function renderHome() {
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    const h = new Date(); set('hero-atualizado', 'Atualizado às ' + String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0'));
    const seq = sequenciaDias(), sq = document.getElementById('hero-seq');
    if (sq) sq.innerHTML = seq > 0 ? '<span class="chip-seq"><i class="fas fa-fire me-1"></i>' + seq + (seq === 1 ? ' dia' : ' dias') + '</span>' : '';
    const P = document.getElementById('home-proximos');
    if (P) P.innerHTML = proximos().map(x => {
        const [ic, cor] = x.ic, ent = x.tipo === 'entrada', acao = x.cartao ? 'verCompras(' + x.cartao + ')' : x.dividas ? "showSection('dividas')" : "showSection('aba-fixos')";
        return '<div class="prox-card" onclick="' + acao + '"><div class="prox-top"><span class="ic-box" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span><b>' + escaparHTML(x.titulo) + '</b></div>'
            + '<small class="text-muted d-block mt-1">' + escaparHTML(x.sub) + '</small><div class="prox-bot"><small class="' + (x.atrasada ? 'text-danger fw-bold' : 'text-muted') + '">' + _dm(x.data) + (x.atrasada ? ' • vencida' : '') + '</small><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + brl(x.valor) + '</b></div></div>';
    }).join('') || '<div class="prox-card text-muted small">Nada previsto para os próximos 35 dias</div>';
    const L = document.getElementById('lista-recente'); if (!L) return;
    const ym = _mesSel(), tr = efetivos().filter(x => x.data && x.data.startsWith(ym)).sort(ordemMov).slice(0, 6);
    L.innerHTML = tr.map(x => {
        const [ic, cor] = iconeCat(x.cat), ent = x.tipo === 'entrada';
        return '<div class="trans" onclick="abrirTransacao(' + x.id + ')"><span class="ic-box round" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span>'
            + '<div class="trans-mid"><b>' + escaparHTML(x.desc) + (x.fixo ? ' <i class="fas fa-rotate text-info" title="Fixo" style="font-size:.7rem"></i>' : '') + '</b><small>' + escaparHTML(x.cat) + ' | ' + (x.virtual ? 'Fatura' : ent ? 'Receita' : 'Despesa') + (x.forma ? ' • ' + escaparHTML(x.forma) : '') + '</small></div>'
            + '<div class="trans-end"><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + (ent ? '' : '-') + brl(x.valor) + '</b><small>' + _dm(x.data) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>';
    }).join('') || '<div class="text-center text-muted py-4 small">Nenhuma transação neste mês.<br>Toque em <b>＋</b> para lançar a primeira.</div>';
}

// ---------- Gráfico do mês (rosca: entradas por fora, saídas por dentro) ----------
const CORES_GRAFICO = { 'Mercado': '#4ecca3', 'Transporte': '#6f42c1', 'Saúde': '#dc3545', 'Saude': '#dc3545', 'Lazer': '#ffc107', 'Salário': '#0dcaf0', 'Salario': '#0dcaf0', 'Aluguel': '#ff8c00', 'Cartão': '#e83e8c', 'Outros': '#adb5bd' };
function renderGraficoRank() {
    const ctx = document.getElementById('chartGastos'), bal = document.getElementById('txt-balanco-grafico'), leg = document.getElementById('legenda-grafico-html');
    if (!ctx || !bal || !leg) return;
    if (meuGrafico && meuGrafico.destroy) { meuGrafico.destroy(); meuGrafico = null; }
    const ym = _mesSel(), cat = {}; let tE = 0, tS = 0;
    efetivos().filter(m => m.data && m.data.startsWith(ym)).forEach(m => {
        const c = m.cat || 'Outros'; cat[c] = cat[c] || { entrada: 0, saida: 0 };
        if (m.tipo === 'entrada') { cat[c].entrada += m.valor; tE += m.valor; } else { cat[c].saida += m.valor; tS += m.valor; }
    });
    const b = tE - tS; bal.innerText = brl(b);
    bal.classList.remove('text-success', 'text-danger', 'text-dark'); bal.classList.add(b < 0 ? 'text-danger' : b > 0 ? 'text-success' : 'text-dark');
    const ks = Object.keys(cat).sort((x, y) => (cat[y].entrada + cat[y].saida) - (cat[x].entrada + cat[x].saida));
    if (!ks.length) { leg.innerHTML = '<p class="text-center text-muted py-4 small">Sem movimentações este mês.</p>'; return; }
    const corDe = c => CORES_GRAFICO[c.trim()] || CORES_GRAFICO.Outros, cores = ks.map(corDe);
    meuGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ks, datasets: [{ label: 'Entradas', data: ks.map(c => cat[c].entrada), backgroundColor: cores, borderWidth: 0, hoverOffset: 10, cutout: '70%' }, { label: 'Saídas', data: ks.map(c => cat[c].saida), backgroundColor: cores, borderWidth: 0, hoverOffset: 10, cutout: '65%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, layout: { padding: 20 } } });
    const vol = tE + tS;
    leg.innerHTML = ks.map(c => {
        const d = cat[c], bc = d.entrada - d.saida, perc = vol > 0 ? Math.round((d.entrada + d.saida) / vol * 100) + '%' : '0%';
        return '<div class="list-group-item d-flex justify-content-between align-items-start border-0 rounded-3 p-3 mb-2 shadow-sm"><div class="icon-box bg-light border" style="color:' + corDe(c) + ';min-width:45px"><i class="fas fa-tags"></i></div>'
            + '<div class="flex-grow-1 ms-3"><div class="fw-bold text-dark d-flex justify-content-between">' + escaparHTML(c) + '<span class="' + (bc >= 0 ? 'text-success' : 'text-danger') + '" style="font-size:.8rem">' + brl(bc) + '</span></div>'
            + '<div class="d-flex justify-content-between mt-1" style="font-size:.7rem"><span class="text-success">↑ ' + brl(d.entrada) + '</span><span class="text-danger">↓ ' + brl(d.saida) + '</span></div></div><div class="ms-2 fw-bold small text-muted">' + perc + '</div></div>';
    }).join('');
}

// ---------- Visão anual ----------
let _anoAnual = new Date().getFullYear(), _chAnual = null;
function mudarAnoAnual(n) { _anoAnual += n; renderAnual(); }
function renderAnual() {
    const meses = [], cats = {};
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
        + card('Melhor mês', melhor ? MESES_C[+melhor.ym.slice(5) - 1] + ' · ' + brl(melhor.saldo) : '—', 'text-success') + card('Mês mais caro', maior ? MESES_C[+maior.ym.slice(5) - 1] + ' · ' + brl(maior.s) : '—', 'text-danger');
    if (_chAnual) _chAnual.destroy();
    _chAnual = new Chart(document.getElementById('grafico-anual'), { type: 'bar', data: { labels: MESES_C, datasets: [{ label: 'Receitas', data: meses.map(m => m.e), backgroundColor: '#10b981', borderRadius: 6 }, { label: 'Despesas', data: meses.map(m => m.s), backgroundColor: '#ef4444', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } } });
    document.getElementById('anual-meses').innerHTML = meses.map((m, i) => '<div class="card-mov py-2 mb-2" style="cursor:pointer" onclick="irParaMes(\'' + m.ym + '\')"><div class="flex-grow-1 fw-bold">' + MESES_C[i] + '</div><small class="text-success me-3 money-value">+' + brl(m.e) + '</small><small class="text-danger me-3 money-value">-' + brl(m.s) + '</small><b class="money-value ' + (m.saldo >= 0 ? 'text-success' : 'text-danger') + '">' + brl(m.saldo) + '</b></div>').join('');
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = top.length ? top[0][1] : 1;
    document.getElementById('anual-cats').innerHTML = top.map(([c, v]) => '<div class="mb-2"><div class="d-flex justify-content-between small"><span>' + escaparHTML(c) + '</span><b class="money-value">' + brl(v) + '</b></div><div class="progress" style="height:8px"><div class="progress-bar" style="width:' + (v / mx * 100) + '%;background:var(--purple)"></div></div></div>').join('') || '<p class="text-muted small">Sem despesas neste ano.</p>';
}

// ---------- Orçamento por categoria ----------
let _orcCats = [];
function gastoPorCategoria(ym) { const g = {}; efetivosDe(ym).filter(m => m.tipo === 'saida' && m.data && m.data.startsWith(ym)).forEach(m => { g[m.cat] = (g[m.cat] || 0) + m.valor; }); return g; }
function renderOrcamento() {
    dados.orcamentos = dados.orcamentos || {};
    const gasto = gastoPorCategoria(_mesSel());
    _orcCats = [...new Set([...cats().saida, ...Object.keys(dados.orcamentos)])];
    document.getElementById('orc-lista').innerHTML = _orcCats.map((c, i) => {
        const lim = dados.orcamentos[c] || 0, g = gasto[c] || 0, p = lim > 0 ? g / lim * 100 : 0, cor = p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#10b981';
        return '<div class="card border-0 shadow-sm rounded-4 p-3 mb-2"><div class="d-flex justify-content-between align-items-center"><b>' + escaparHTML(c) + '</b>'
            + '<input type="number" inputmode="decimal" min="0" class="form-control form-control-sm text-end" style="width:110px" placeholder="Limite" value="' + (lim || '') + '" onchange="salvarOrcamento(' + i + ',this.value)"></div>'
            + '<div class="progress my-2" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, p) + '%;background:' + cor + '"></div></div>'
            + '<small class="text-muted money-value">Gasto ' + brl(g) + (lim > 0 ? ' de ' + brl(lim) + ' (' + Math.round(p) + '%)' : ' — sem limite definido') + '</small></div>';
    }).join('');
}
function salvarOrcamento(i, v) { const n = parseFloat(v) || 0, c = _orcCats[i]; if (n > 0) dados.orcamentos[c] = n; else delete dados.orcamentos[c]; salvarERender(); }

// ---------- Previsão, reserva de emergência e simulador ----------
const _lbl = ym => ym.split('-').reverse().join('/');
function listaFixos(comCartao) {
    const l = fixosAtivos().map(m => ({ tipo: m.tipo, valor: m.valor }));
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
function renderPrevisao() {
    const reservas = dados.metas.filter(m => /reserva|emerg/i.test(m.nome)), guard = (reservas.length ? reservas : dados.metas).reduce((s, m) => s + (m.guardado || 0), 0);
    const custo = listaFixos(true).filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0), meses = custo > 0 ? guard / custo : 0;
    document.getElementById('prev-reserva').innerHTML = '<small class="text-muted">Reserva de emergência (meta: 6 meses de gastos fixos)</small><div class="fw-bold fs-5 money-value">' + brl(guard) + ' <small class="text-muted fw-normal">≈ ' + meses.toFixed(1).replace('.', ',') + ' mês(es)</small></div>'
        + '<div class="progress my-2" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, meses / 6 * 100) + '%;background:' + (meses >= 6 ? '#10b981' : meses >= 3 ? '#f59e0b' : '#ef4444') + '"></div></div>'
        + '<small class="text-muted">' + (custo > 0 ? 'Custo fixo mensal: ' + brl(custo) + '. Crie uma meta chamada "Reserva de emergência" para acompanhar aqui.' : 'Cadastre despesas fixas para calcular a reserva ideal.') + '</small>';
    document.getElementById('prev-lista').innerHTML = previsao(6).map(p => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + _lbl(p.ym) + '</b><small class="d-block text-muted money-value">+' + brl(p.ent) + ' / -' + brl(p.sai) + '</small></div><div class="text-end"><small class="text-muted d-block">saldo projetado</small><b class="money-value ' + (p.acum >= 0 ? 'text-success' : 'text-danger') + '">' + brl(p.acum) + '</b></div></div>').join('');
}
function simular() {
    const V = parseFloat(document.getElementById('sim-valor').value) || 0, n = Math.max(1, Math.min(48, parseInt(document.getElementById('sim-parc').value) || 1)), i = (parseFloat(document.getElementById('sim-juros').value) || 0) / 100;
    if (V <= 0) return erro('Informe o valor da compra.');
    const pmt = i > 0 ? V * i / (1 - Math.pow(1 + i, -n)) : V / n, total = pmt * n, base = previsao(Math.max(6, n));
    const renda = listaFixos(false).filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0);
    let neg = 0, html = '<div class="card border-0 shadow-sm rounded-4 p-3 mb-3"><div>Parcela: <b class="money-value">' + brl(pmt) + '</b> × ' + n + '</div><div>Total: <b class="money-value">' + brl(total) + '</b> <small class="text-muted">(juros: ' + brl(total - V) + ')</small></div>'
        + (renda > 0 ? '<small class="text-muted">A parcela pesa ' + Math.round(pmt / renda * 100) + '% da sua renda fixa.</small>' : '') + '</div>';
    html += base.map((p, k) => { const dep = p.acum - pmt * Math.min(k + 1, n), ruim = dep < 0; if (ruim && p.acum >= 0) neg++; return '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + _lbl(p.ym) + '</b>' + (k < n ? '<small class="d-block text-muted">parcela ' + (k + 1) + '/' + n + '</small>' : '') + '</div><div class="text-end"><small class="text-muted d-block">antes: <span class="money-value">' + brl(p.acum) + '</span></small><b class="money-value ' + (dep >= 0 ? 'text-success' : 'text-danger') + '">' + brl(dep) + '</b></div></div>'; }).join('');
    document.getElementById('sim-resultado').innerHTML = (neg ? '<div class="alert alert-danger rounded-4"><i class="fas fa-triangle-exclamation me-1"></i>Esta compra deixa o saldo projetado negativo em ' + neg + ' mês(es) em que ele estaria positivo.</div>' : '<div class="alert alert-success rounded-4"><i class="fas fa-circle-check me-1"></i>Cabe no orçamento projetado.</div>') + html;
}

// ---------- Comparar meses e ordem para quitar dívidas ----------
function renderComparar() {
    const ym = _mesSel(), ant = ymAdd(ym, -1), a = gastoPorCategoria(ym), b = gastoPorCategoria(ant);
    const ta = Object.values(a).reduce((s, v) => s + v, 0), tb = Object.values(b).reduce((s, v) => s + v, 0);
    const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => (a[y] || 0) - (a[x] || 0));
    const seta = (n, o) => { const d = n - o; return d === 0 ? '<span class="text-muted">=</span>' : '<b class="money-value ' + (d > 0 ? 'text-danger' : 'text-success') + '">' + (d > 0 ? '▲ +' : '▼ ') + brl(d) + '</b>'; };
    document.getElementById('comp-lista').innerHTML = '<div class="card border-0 shadow-sm rounded-4 p-3 mb-3"><small class="text-muted">Despesas ' + _lbl(ant) + ' → ' + _lbl(ym) + '</small><div class="fw-bold money-value">' + brl(tb) + ' → ' + brl(ta) + '</div><div>' + seta(ta, tb) + (tb > 0 ? ' <small class="text-muted">(' + Math.round((ta - tb) / tb * 100) + '%)</small>' : '') + '</div></div>'
        + (ks.map(c => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + escaparHTML(c) + '</b><small class="d-block text-muted money-value">' + brl(b[c] || 0) + ' → ' + brl(a[c] || 0) + '</small></div>' + seta(a[c] || 0, b[c] || 0) + '</div>').join('') || '<p class="text-muted text-center">Sem despesas nos dois meses.</p>');
}
let _estQuitar = 'menor';
function setEstQuitar(e) { _estQuitar = e; renderQuitar(); }
function renderQuitar() {
    const l = dados.dividas.filter(d => d.tipo === 'eu-devo').sort(_estQuitar === 'menor' ? (x, y) => x.valor - y.valor : _estQuitar === 'juros' ? (x, y) => (y.juros || 0) - (x.juros || 0) : (x, y) => (x.prazo || '9999').localeCompare(y.prazo || '9999')); let ac = 0;
    ['menor', 'prazo', 'juros'].forEach(k => { const b = document.getElementById('quit-' + k); if (b) { b.classList.toggle('btn-primary', _estQuitar === k); b.classList.toggle('btn-outline-primary', _estQuitar !== k); } });
    document.getElementById('quit-lista').innerHTML = l.map((d, i) => { ac += d.valor; return '<div class="card-mov py-2 mb-2"><div class="me-3 fw-bold fs-5 text-primary">' + (i + 1) + 'º</div><div class="flex-grow-1"><b>' + escaparHTML(d.nome) + '</b><small class="d-block text-muted">' + (d.prazo ? 'Vence ' + d.prazo.split('-').reverse().join('/') : 'Sem prazo') + ' • acumulado ' + brl(ac) + '</small></div><b class="money-value text-danger">' + brl(d.valor) + '</b></div>'; }).join('') || '<p class="text-muted text-center">Você não tem dívidas a pagar.</p>';
}

// ---------- Exportar o extrato do mês em CSV ----------
function exportarCSV() {
    const ym = _mesSel(), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const linhas = efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).sort((a, b) => a.data.localeCompare(b.data));
    if (!linhas.length) return erro('Nenhum lançamento neste mês.');
    const csv = '﻿Data;Descrição;Categoria;Tipo;Valor;Fixo\r\n' + linhas.map(m => [m.data.split('-').reverse().join('/'), q(m.desc), q(m.cat), m.tipo === 'entrada' ? 'Receita' : 'Despesa', m.valor.toFixed(2).replace('.', ','), m.fixo ? 'Sim' : 'Não'].join(';')).join('\r\n');
    baixarArquivo(csv, 'extrato_' + ym + '.csv', 'text/csv;charset=utf-8');
}
function baixarArquivo(conteudo, nome, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo })), a = document.createElement('a');
    a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- Avisos / notificações ----------
const AV_IC = { erro: 'fa-circle-exclamation text-danger', aviso: 'fa-triangle-exclamation text-warning', cartao: 'fa-credit-card', grafico: 'fa-chart-pie', backup: 'fa-floppy-disk' };
function coletarAvisos() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0); const av = [];
    dados.dividas.forEach(d => {
        if (!d.prazo) return;
        const p = new Date(d.prazo + 'T00:00:00'), dt = d.prazo.split('-').reverse().join('/');
        if (p < hoje) av.push('[erro] VENCIDA: ' + d.nome + ' (' + dt + ')');
        else if (p <= new Date(hoje.getTime() + (parseInt(d.lembrete) || 3) * 864e5)) av.push('[aviso] ' + (d.tipo === 'eu-devo' ? 'A PAGAR' : 'A RECEBER') + ': ' + d.nome + ' vence ' + dt);
    });
    dados.cartoes.forEach(c => {
        const v = parseInt(c.vence); if (!v || c.tipo === 'Débito') return;
        for (let i = 0; i <= 3; i++) { const x = new Date(hoje); x.setDate(x.getDate() + i); if (x.getDate() === v) { av.push('[cartao] Fatura do ' + c.nome + ' vence dia ' + v); break; } }
    });
    const ym = _mesSel(), r = saldoMesDe(ym);
    if (r.e > 0 && r.s > r.e * 0.8) av.push('[grafico] Você já gastou ' + Math.round(r.s / r.e * 100) + '% das receitas de ' + _lbl(ym) + '.');
    const gasto = gastoPorCategoria(ym);
    Object.entries(dados.orcamentos || {}).forEach(([c, l]) => { const p = (gasto[c] || 0) / l * 100; if (p >= 100) av.push('[erro] Orçamento estourado em ' + c + ' (' + Math.round(p) + '%)'); else if (p >= 80) av.push('[aviso] ' + c + ': ' + Math.round(p) + '% do orçamento'); });
    const ub = dados.config.ultimoBackup;
    if (dados.movs.length > 20 && (!ub || Date.now() - ub > 30 * 864e5)) av.push('[backup] Faça um backup: Menu → Sistema e Backup → Exportar Dados.');
    return av;
}
function atualizarBadges() {
    const n = coletarAvisos().length;
    ['hero-badge', 'fp-badge'].forEach(id => { const b = document.getElementById(id); if (b) { b.innerText = n; b.classList.toggle('d-none', n === 0); } });
}
function abrirNotificacoes() {
    const a = coletarAvisos();
    const corpo = a.length ? a.map(s => { const t = (s.match(/^\[(\w+)\]\s*/) || [])[1] || 'aviso'; return '<div class="aviso-item"><i class="fas ' + (AV_IC[t] || AV_IC.aviso) + '"></i><span>' + escaparHTML(s.replace(/^\[\w+\]\s*/, '')) + '</span></div>'; }).join('')
        : '<div class="text-center text-muted py-3"><i class="fas fa-circle-check text-success fs-3 d-block mb-2"></i>Tudo sob controle. Nenhuma pendência urgente.</div>';
    modalDin('modalAvisos', '<div class="modal-body p-4"><h5 class="fw-bold mb-3"><i class="fas fa-bell me-2"></i>Lembretes</h5>' + corpo + '</div>').show();
}

/* ===================================================================
   14. CALCULADORA
   Ícone no topo → painel flutuante → bolha. Arrastar até o X guarda no topo.
   =================================================================== */
let calcExpressao = '', _calcEst = 'docked';
function calcAdd(v) {
    const d = document.getElementById('calc-display');
    if (d.value === '0' && v !== '.') calcExpressao = '';
    calcExpressao += v; d.value = calcExpressao;
}
function calcLimpar() { calcExpressao = ''; document.getElementById('calc-display').value = '0'; }
function calcApagar() { calcExpressao = calcExpressao.slice(0, -1); document.getElementById('calc-display').value = calcExpressao || '0'; }
function calcResultado() {
    if (!calcExpressao) return;
    const d = document.getElementById('calc-display');
    try {
        if (/[^0-9+\-*/.()]/.test(calcExpressao)) throw new Error('inválido');
        let r = Function('"use strict"; return (' + calcExpressao + ')')();
        if (typeof r !== 'number' || !isFinite(r)) throw new Error('erro');
        if (!Number.isInteger(r)) r = parseFloat(r.toFixed(2));
        d.value = r; calcExpressao = String(r);
    } catch (e) { d.value = 'Erro'; calcExpressao = ''; }
}
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
function toggleCalculadora() { if (_calcEst === 'aberta') minimizarCalc(); else abrirCalcFlutuante(); }
function arrastavel(el, handle, aoClicar) { // funciona com mouse e toque
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
function iniciarCalculadora() {
    const { c } = _calcEls(); if (!c) return;
    if (!document.getElementById('calc-bolha')) { const b = document.createElement('button'); b.id = 'calc-bolha'; b.setAttribute('aria-label', 'Calculadora'); b.innerHTML = '<i class="fas fa-calculator"></i>'; document.body.appendChild(b); }
    if (!document.getElementById('calc-alvo')) { const x = document.createElement('div'); x.id = 'calc-alvo'; x.innerHTML = '<i class="fas fa-xmark"></i><small>Guardar no topo</small>'; document.body.appendChild(x); }
    const b = document.getElementById('calc-bolha'), hd = document.getElementById('calc-header'), ctl = hd.querySelector('.calc-controls');
    if (ctl && !ctl.querySelector('[data-guardar]')) { const k = document.createElement('button'); k.type = 'button'; k.dataset.guardar = 1; k.title = 'Guardar no topo'; k.innerHTML = '<i class="fas fa-xmark"></i>'; k.onclick = acoplarCalc; ctl.appendChild(k); }
    hd.style.touchAction = 'none'; b.style.touchAction = 'none';
    arrastavel(c, hd); arrastavel(b, b, restaurarCalc);
    setCalc('docked');
}

/* ===================================================================
   15. TEMA, PIN, BACKUP E CALENDÁRIO
   =================================================================== */
function aplicarTema() {
    const dark = !!dados.config.dark;
    document.body.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.tema-ic').forEach(i => { i.classList.toggle('fa-moon', !dark); i.classList.toggle('fa-sun', dark); });
}
function toggleTema() { dados.config.dark = !dados.config.dark; aplicarTema(); persistir(); }
function aplicarVisibilidade() {
    const o = !!dados.config.oculto;
    document.body.classList.toggle('values-hidden', o);
    document.querySelectorAll('.olho-ic').forEach(i => { i.classList.toggle('fa-eye', !o); i.classList.toggle('fa-eye-slash', o); });
}
function toggleVisibilidade() { dados.config.oculto = !dados.config.oculto; aplicarVisibilidade(); persistir(); }
function aplicarCorApp() { document.documentElement.dataset.cor = localStorage.getItem('fp_cor') || ''; atualizarTopo(); }
function alternarCorApp() {
    const v = document.documentElement.dataset.cor === 'verde' ? '' : 'verde';
    try { localStorage.setItem('fp_cor', v); } catch (e) { }
    aplicarCorApp(); avisar(v ? 'Tema verde ativado.' : 'Tema roxo (padrão) ativado.');
}

// ---------- PIN de bloqueio ----------
const _pinH = p => hashSenha(p, 'pin-fp');
function bloquearApp() {
    if (!dados.config || !dados.config.pin || ehVisitante() || document.getElementById('tela-pin')) return;
    const d = document.createElement('div'); d.id = 'tela-pin';
    d.style.cssText = 'position:fixed;inset:0;z-index:30000;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff;padding:24px';
    d.innerHTML = '<i class="fas fa-lock fa-2x"></i><h5 class="fw-bold">Finanças Pro bloqueado</h5><input id="pin-in" type="password" inputmode="numeric" maxlength="8" class="form-control text-center fs-4" style="max-width:220px;letter-spacing:.4em" placeholder="PIN"><button class="btn btn-light fw-bold px-5" id="pin-ok">Desbloquear</button>';
    document.body.appendChild(d);
    const inp = document.getElementById('pin-in');
    const tentar = async () => { if (await _pinH(inp.value) === dados.config.pin) d.remove(); else { erro('PIN incorreto!'); inp.value = ''; } };
    document.getElementById('pin-ok').onclick = tentar; inp.addEventListener('keydown', e => { if (e.key === 'Enter') tentar(); }); inp.focus();
}
async function configurarPin() {
    if (!verificarAcesso()) return;
    if (dados.config.pin && await _pinH(prompt('Digite o PIN atual:') || '') !== dados.config.pin) return erro('PIN incorreto!');
    const n = (prompt('Novo PIN (4 a 8 números). Deixe vazio para remover o bloqueio:') || '').trim();
    if (!n) { delete dados.config.pin; salvarERender(); return avisar('Bloqueio por PIN removido.'); }
    if (!/^\d{4,8}$/.test(n)) return erro('Informe de 4 a 8 números.');
    dados.config.pin = await _pinH(n); salvarERender(); avisar('PIN definido! O app bloqueia ao abrir e após 30 s em segundo plano.');
}
let _ocultoEm = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) _ocultoEm = Date.now(); else if (_ocultoEm && Date.now() - _ocultoEm > 30000) bloquearApp(); });

// ---------- Backup e importação ----------
function exportarBackup() {
    dados.config.ultimoBackup = Date.now(); persistir();
    baixarArquivo(JSON.stringify({ ...dados, notas, _exportadoEm: new Date().toISOString() }), 'backup_financas_' + hojeISO() + '.json', 'application/json');
    atualizarBadges();
}
function abrirImportar() {
    if (!verificarAcesso()) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = ev => {
            try {
                const n = JSON.parse(ev.target.result);
                if (!n || typeof n !== 'object' || Array.isArray(n) || !Array.isArray(n.movs)) throw new Error('formato');
                const nn = Array.isArray(n.notas) ? n.notas : null; delete n.notas; delete n._exportadoEm;
                const ok = normalizarDados(n);
                if (!confirm('Importar ' + ok.movs.length + ' lançamentos? Isso SUBSTITUI todos os dados atuais deste aparelho.')) return;
                localStorage.setItem(CHAVE_DADOS, JSON.stringify(ok));
                if (nn) localStorage.setItem(CHAVE_NOTAS, JSON.stringify(nn));
                location.reload();
            } catch (err) { erro('Arquivo inválido! Use um backup exportado pelo próprio app.'); }
        };
        rd.readAsText(f);
    };
    inp.click();
}

// ---------- Calendário (.ics: importa no Google/Apple/Outlook; UIDs fixos evitam duplicar ao reimportar) ----------
function _icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n'); }
function _icsDia(s, n) { const [a, m, d] = s.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().substring(0, 10).replace(/-/g, ''); }
function baixarCalendario(somenteId) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15) + 'Z', L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Financas Pro//PT', 'CALSCALE:GREGORIAN'];
    const ev = (uid, data, titulo, desc, rr) => L.push('BEGIN:VEVENT', 'UID:' + uid + '@financaspro', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + _icsDia(data, 0), 'DTEND;VALUE=DATE:' + _icsDia(data, 1), 'SUMMARY:' + _icsEsc(titulo), 'DESCRIPTION:' + _icsEsc(desc), ...(rr ? ['RRULE:' + rr] : []), 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + _icsEsc(titulo), 'END:VALARM', 'END:VEVENT');
    let n = 0;
    dados.dividas.filter(d => d.prazo && (!somenteId || d.id === somenteId)).forEach(d => {
        const q = Math.max(1, (d.parcelas || 1) - (d.pagas || 0)), verbo = d.tipo === 'eu-devo' ? 'Pagar' : 'Receber'; let dt = d.prazo;
        for (let i = 0; i < q; i++) {
            const num = (d.pagas || 0) + 1 + i, val = (d.parcelas || 1) > 1 ? (d.valorParcela || d.valor) : d.valor;
            ev('divida-' + d.id + '-' + num, dt, verbo + ': ' + d.nome + ((d.parcelas || 1) > 1 ? ' (parcela ' + num + '/' + d.parcelas + ')' : '') + ' — ' + brl(val), d.desc || '', null); n++;
            dt = addMesData(dt);
        }
    });
    if (!somenteId) dados.cartoes.filter(c => c.tipo !== 'Débito' && parseInt(c.vence)).forEach(c => {
        const h = hojeISO(), ym = h.substring(0, 7), v = String(parseInt(c.vence)).padStart(2, '0'), dt = (ym + '-' + v) >= h ? ym + '-' + v : ymAdd(ym, 1) + '-' + v;
        ev('cartao-' + c.id, dt, 'Fatura ' + c.nome + ' vence', 'Vencimento mensal do cartão', 'FREQ=MONTHLY'); n++;
    });
    if (!n) return erro('Nenhuma dívida com prazo para sincronizar.');
    L.push('END:VCALENDAR');
    baixarArquivo(L.join('\r\n'), 'financas_calendario.ics', 'text/calendar');
}
function eventoCalendarioDivida(id) { baixarCalendario(Number(id)); }

/* ===================================================================
   16. INICIALIZAÇÃO
   =================================================================== */
function iniciarApp() {
    // migração: remove do extrato os lançamentos antigos gerados por metas (continuam no histórico da meta)
    if (!dados.migr2 && !ehVisitante()) {
        dados.movs = dados.movs.filter(m => !dados.metas.some(x => m.desc === 'Poupança: ' + x.nome || m.desc === 'Resgate: ' + x.nome));
        dados.migr2 = true; persistir();
    }
    // máscaras de moeda
    ['mov-valor', 'card-limite', 'card-anuidade', 'compra-valor', 'div-valor', 'pag-valor', 'meta-objetivo', 'revenda-vlr-compra', 'revenda-vlr-venda'].forEach(id => {
        const el = document.getElementById(id); if (el) el.addEventListener('input', mascaraMoeda);
    });
    // categorias do lançamento
    const t = document.getElementById('mov-tipo'), c = document.getElementById('mov-cat');
    t.addEventListener('change', () => popularCategorias(t.value, null));
    c.addEventListener('change', () => {
        if (c.value !== '__nova__') return;
        const n = (prompt('Nome da nova categoria:') || '').trim().slice(0, 30), l = cats()[t.value === 'entrada' ? 'entrada' : 'saida'];
        if (n && !l.some(x => x.toLowerCase() === n.toLowerCase())) { l.push(n); salvarERender(); }
        popularCategorias(t.value, n || null);
    });
    popularCategorias(t.value, null);
    const forma = document.getElementById('mov-forma'); if (forma) forma.addEventListener('change', toggleCartaoMov);
    const nomeCard = document.getElementById('card-nome'); if (nomeCard) nomeCard.addEventListener('input', detectarBanco);
    const emp = document.getElementById('compra-emprestado'); if (emp) emp.addEventListener('change', togglePessoa);
    ['compra-valor', 'compra-parcelas', 'compra-data', 'compra-fixa'].forEach(i => { const e = document.getElementById(i); if (e) { e.addEventListener('input', previewCompra); e.addEventListener('change', previewCompra); } });
    const mm = document.getElementById('modalMeta');
    if (mm) mm.addEventListener('show.bs.modal', () => { const i = document.getElementById('meta-data-inicio'); if (i && !i.value) i.value = hojeISO(); });
    // dívidas: busca e filtro
    const bd = document.getElementById('busca-divida'); if (bd) bd.addEventListener('input', e => { buscaDividaAtual = e.target.value.toLowerCase(); renderDividas(); });
    const fo = document.getElementById('filtro-ordenar-divida'); if (fo) fo.addEventListener('change', e => tratarFiltroEOrdenacao(e.target.value));
    // login: Enter envia
    ['user-login', 'pass-login'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); }); });
    // botão X em todas as janelas
    document.querySelectorAll('.modal-content').forEach(m => {
        if (m.querySelector('.btn-close')) return;
        const x = document.createElement('button'); x.type = 'button'; x.className = 'btn-close fp-x'; x.setAttribute('data-bs-dismiss', 'modal'); x.setAttribute('aria-label', 'Fechar'); m.prepend(x);
    });
    document.addEventListener('hidden.bs.modal', () => setTimeout(limparFundosPresos, 80));
    document.addEventListener('click', e => { if (navigator.vibrate && e.target.closest('.nav-btn,.acao-rapida,.btn-add-main,.btn')) navigator.vibrate(8); });
    document.getElementById('fab-add').onclick = () => { const f = FAB_ACOES[_secAtual]; if (f) f(); };

    // sessão, tema e preferências
    if (!usuarioAtivo && localStorage.getItem('user_lembrado')) { usuarioAtivo = localStorage.getItem('user_lembrado'); sessionStorage.setItem('user_ativo', usuarioAtivo); }
    if (usuarioAtivo === 'visitante') { dados = novoDados(); notas = []; }
    if (usuarioAtivo) { document.getElementById('tela-login').style.display = 'none'; atualizarNomeUsuarioTela(usuarioAtivo); }
    else atualizarNomeUsuarioTela('Visitante');
    aplicarTema(); aplicarVisibilidade(); aplicarCorApp();
    mesAtual = hojeISO().substring(0, 7);
    if (usuarioAtivo) { limparHistoricoAntigo(); processarLancamentosFixos(); }

    iniciarCalculadora();
    document.body.classList.add('na-home');
    showSection('inicio');
    renderTudo();
    bloquearApp();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
}
document.addEventListener('DOMContentLoaded', iniciarApp);
