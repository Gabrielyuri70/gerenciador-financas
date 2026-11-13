/*
 * Finanças Pro — app.js (arquivo único)
 *
 * ÍNDICE
 *  01. Núcleo do app: lançamentos, cartões, dívidas, metas, notas, calculadora
 *  02. Base: datas, login/segurança, backup, revenda, lixeira, notificações
 *  03. Cartões: faturas, parcelas, bancos, dívidas parceladas, calendário (.ics)
 *  04. Visão anual
 *  05. Categorias, orçamento, contas fixas, CSV e avisos na tela
 *  06. Previsão, simulador de parcelas, reserva e modo offline
 *  07. Comparar meses, ordem para quitar dívidas e PIN
 *  08. Atalhos rápidos da Início
 *  09. Início (nova) e cartões
 *  10. Topo da Início e tema de cor
 *  11. Topo das demais telas e Extrato
 *  12. Lembretes e calculadora flutuante
 *  13. Gasto por dia
 *  14. Formulários completos e Clientes
 *  15. Faturas com contas fixas, cartão emprestado, botão + e confirmações
 */


/* ==============================================================================
 * 01. Núcleo do app: lançamentos, cartões, dívidas, metas, notas, calculadora
 * ============================================================================ */
// Dados e Inicialização com Proteção contra erros
let dados;
try {
    const salvos = localStorage.getItem('financas_pro_max');
    dados = (salvos && salvos !== "undefined") ? JSON.parse(salvos) : null;
    
    // Força uma estrutura limpa se o objeto recuperado for inválido ou nulo
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        dados = { movs: [], cartoes: [], dividas: [], metas: [], lixeira: [], historicoQuitados: [], config: { dark: false, oculto: false } };
    }
    
    // Garante retrocompatibilidade em todas as chaves obrigatórias de arrays
    const chavesPadrao = ['movs', 'cartoes', 'dividas', 'metas', 'lixeira', 'historicoQuitados'];
    chavesPadrao.forEach(chave => {
        if (!dados[chave] || !Array.isArray(dados[chave])) {
            dados[chave] = [];
        }
    });
    
    if (!dados.config || typeof dados.config !== 'object') {
        dados.config = { dark: false, oculto: false };
    }
} catch (err) {
    console.error("Falha ao ler localStorage, resetando dados:", err);
    dados = { movs: [], cartoes: [], dividas: [], metas: [], lixeira: [], historicoQuitados: [], config: { dark: false, oculto: false } };
}

let usuarioAtivo = sessionStorage.getItem('user_ativo') || localStorage.getItem('user_lembrado') || null;
let filtroAtual = 'todos';
let buscaAtual = ''; // Nova variável para busca
let cartaoContexto = null;

// Novas variáveis para o sistema de filtros das dívidas
let buscaDividaAtual = '';
let ordemDividaAtual = 'data-recente';
let statusDividaAtual = 'todas'; // Controla se mostra todas, pendentes ou vencidas
let meuGrafico = null; // Nova variável para o gráfico
let isDragging = false; // <-- ADICIONADO PARA EVITAR REF-ERROR NA CALCULADORA
let offset = { x: 0, y: 0 }; // Remove as declarações soltas de baixo

// CORREÇÃO: Declaração das variáveis em escopo global para evitar travamentos
if (typeof calcContainer === 'undefined') {
    var calcContainer = null;
}
if (typeof calcHeader === 'undefined') {
    var calcHeader = null;
}

// --- FUNÇÕES DE LOGIN E AUTENTICAÇÃO ---
function toggleSenha(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function toggleAuth(mode) {
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('recovery-form').style.display = mode === 'recovery' ? 'block' : 'none';
    
    if(mode === 'recovery') {
        document.getElementById('step-1-recovery').style.display = 'block';
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'none';
    }
}

function cadastrarUsuario() {
    const u = document.getElementById('user-reg').value.trim();
    const p = document.getElementById('pass-reg').value.trim();
    const q = document.getElementById('pergunta-reg').value;
    const r = document.getElementById('resposta-reg').value.trim().toLowerCase();

    if(!u || !p || !r) return alert("Preencha todos os campos!");

    localStorage.setItem('financas_auth', JSON.stringify({ user: u, pass: p, pergunta: q, resposta: r }));
    alert("Conta criada com sucesso!");
    toggleAuth('login');
}

function fazerLogin() {
    const u = document.getElementById('user-login').value.trim();
    const p = document.getElementById('pass-login').value.trim();
    const lembrar = document.getElementById('lembrar-login').checked;
    const authRaw = localStorage.getItem('financas_auth');

    if (!authRaw) {
        alert("Nenhuma conta encontrada! Por favor, cadastre-se.");
        return;
    }

    const auth = JSON.parse(authRaw);

    if(u === auth.user && p === auth.pass) {
        if(lembrar) localStorage.setItem('user_lembrado', u);
        sessionStorage.setItem('user_ativo', u);
        
        // ADICIONADO: Atualiza os textos com o nome do usuário logado
        atualizarNomeUsuarioTela(u);
        
        document.getElementById('tela-login').style.display = 'none';
        renderTudo();
    } else {
        alert("Usuário ou senha incorretos!");
    }
}
function verificarUsuarioRecuperacao() {
    const u = document.getElementById('user-rec').value.trim();
    const auth = JSON.parse(localStorage.getItem('financas_auth'));

    if(auth && u === auth.user) {
        document.getElementById('txt-pergunta-exibida').innerText = auth.pergunta;
        document.getElementById('step-1-recovery').style.display = 'none';
        document.getElementById('step-2-recovery').style.display = 'block';
    } else {
        alert("Usuário não encontrado!");
    }
}

function validarRespostaSeguranca() {
    const r = document.getElementById('resposta-rec').value.trim().toLowerCase();
    const auth = JSON.parse(localStorage.getItem('financas_auth'));

    if(auth && r === auth.resposta) {
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'block';
    } else {
        alert("Resposta incorreta!");
    }
}

function redefinirSenha() {
    const novaP = document.getElementById('nova-pass-rec').value.trim();
    if(!novaP) return alert("Digite a nova senha!");

    let auth = JSON.parse(localStorage.getItem('financas_auth'));
    auth.pass = novaP;
    localStorage.setItem('financas_auth', JSON.stringify(auth));

    alert("Senha alterada! Faça login novamente.");
    toggleAuth('login');
}

function entrarVisitante() {
    sessionStorage.setItem('user_ativo', 'visitante');
    
    // CORREÇÃO: Em vez de limpar o objeto 'dados' global (que apaga o do usuário real),
    // nós instanciamos uma estrutura limpa isolada para a sessão do visitante.
    dados = { 
        movs: [], 
        cartoes: [], 
        dividas: [], 
        metas: [], 
        lixeira: [], 
        historicoQuitados: [], 
        config: { dark: false, oculto: false } 
    };

    // Limpa também as notas locais apenas em memória para o visitante
    if (typeof notas !== 'undefined') {
        notas = [];
    }

    // ADICIONADO: Força o nome a virar Visitante na tela
    atualizarNomeUsuarioTela('Visitante');

    document.getElementById('tela-login').style.display = 'none';
    renderTudo();
}

function carregarDadosPerfil() {
    if (sessionStorage.getItem('user_ativo') === 'visitante') return;
    
    const authRaw = localStorage.getItem('financas_auth');
    if (authRaw) {
        const auth = JSON.parse(authRaw);
        const inputUser = document.getElementById('novo-user-perfil');
        if (inputUser) inputUser.value = auth.user;
    }
}

function atualizarPerfilUsuario() {
    if(!verificarAcesso()) return;

    const novoUser = document.getElementById('novo-user-perfil').value.trim();
    const novaPass = document.getElementById('nova-pass-perfil').value.trim();
    const authRaw = localStorage.getItem('financas_auth');

    if (!authRaw) return alert("Erro: Conta de usuário não encontrada!");
    if (!novoUser) return alert("O campo de usuário não pode ficar vazio!");

    let auth = JSON.parse(authRaw);
    auth.user = novoUser;

    if (novaPass) {
        auth.pass = novaPass; // <-- Agora a variável interna realmente recebe a nova senha
        alert("Usuário e Senha atualizados com sucesso!"); // Correção de português/ortografia aplicada aqui
        document.getElementById('nova-pass-perfil').value = ""; 
    } else {
        alert("Nome de usuário atualizado com sucesso!");
    }

    localStorage.setItem('financas_auth', JSON.stringify(auth));

    if(localStorage.getItem('user_lembrado')) {
        localStorage.setItem('user_lembrado', novoUser);
    }
    sessionStorage.setItem('user_ativo', novoUser);
    usuarioAtivo = novoUser;
    
    // ADICIONADO: Atualiza os elementos na tela com o novo nome
    atualizarNomeUsuarioTela(novoUser);
}
function verificarAcesso() {
    if(sessionStorage.getItem('user_ativo') === 'visitante') {
        alert("Crie uma conta para salvar seus dados!");
        return false;
    }
    return true;
}

// --- NAVEGAÇÃO ---
function showSection(id, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    window.scrollTo(0,0);

    // Se abrir a aba de gráficos, força a renderização dele
    if(id === 'aba-graficos') {
        renderGraficoRank();
    }
    // Se abrir a lixeira, renderiza os itens deletados
    if(id === 'lixeira') {
        renderLixeira();
    }
    // Se abrir a aba de dívidas, força a atualização do histórico
    if(id === 'aba-dividas' || id === 'dividas') { // <-- ADICIONE ESTE BLOCO
        renderizarHistoricoDividas();
    }
    // Se abrir as configurações ou perfil, preenche os campos com os dados atuais salvos
    if(id === 'aba-perfil' || id === 'aba-configuracoes') {
        carregarDadosPerfil();
    }
}

// --- MOVIMENTAÇÕES ---
function abrirModalMov(id = null) {
    if(id) {
        const m = dados.movs.find(x => x.id == id);
        document.getElementById('mov-id-edit').value = m.id;
        document.getElementById('mov-desc').value = m.desc;
        // Garante que o valor venha formatado exatamente como a máscara espera
document.getElementById('mov-valor').value = m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('mov-tipo').value = m.tipo;
        document.getElementById('mov-cat').value = m.cat;
        document.getElementById('mov-data').value = m.data;
document.getElementById('mov-fixo').checked = m.fixo || false; // <-- Adicione esta linha
document.getElementById('modalMovTitulo').innerText = "Editar Lançamento";
        document.getElementById('btn-excluir-mov').classList.remove('d-none');
    } else {
        // CORREÇÃO: Limpando todos os campos para não herdar dados do gasto anterior
        document.getElementById('mov-id-edit').value = "";
        document.getElementById('mov-desc').value = "";
        document.getElementById('mov-valor').value = "";
        document.getElementById('mov-tipo').value = "saida";
        document.getElementById('mov-cat').value = "Outros";
        document.getElementById('mov-data').value = hojeISO();
document.getElementById('mov-fixo').checked = false; // <-- Adicione esta linha para começar desmarcado
document.getElementById('modalMovTitulo').innerText = "Novo Lançamento";
        document.getElementById('btn-excluir-mov').classList.add('d-none');
    }
}
function abrirAjusteSaldo(tipo) {
    if(!verificarAcesso()) return;
    abrirModalMov();
    document.getElementById('mov-tipo').value = tipo;
    document.getElementById('mov-desc').value = "Ajuste de Saldo";
    document.getElementById('modalMovTitulo').innerText = tipo === 'entrada' ? "Nova Entrada" : "Nova Saída";
    
    // Forma correta de abrir sem duplicar instâncias
    const modalElement = document.getElementById('modalMov');
    const modalInst = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInst.show();
}


function salvarMov() {
    if(!verificarAcesso()) return;
    
    const idEdit = document.getElementById('mov-id-edit').value;
    const valorRaw = document.getElementById('mov-valor').value;
    
    // Converte o valor da máscara (ex: 1.500,50) para número real (1500.50)
    const valorLimpo = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;

            const agora = new Date();
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

    const mov = {
    id: idEdit ? Number(idEdit) : Date.now(), // Garante que o ID salvo seja sempre um Number
    desc: document.getElementById('mov-desc').value,
    valor: valorLimpo,
    tipo: document.getElementById('mov-tipo').value,
    cat: document.getElementById('mov-cat').value,
    data: document.getElementById('mov-data').value || hojeISO(),
    hora: idEdit ? dados.movs.find(m => m.id == idEdit).hora : horaAtual,
    fixo: document.getElementById('mov-fixo').checked // <-- Nova linha
};

    if(!mov.desc || isNaN(mov.valor)) return alert("Preencha os campos corretamente!");
    
    const idx = dados.movs.findIndex(m => m.id == mov.id);
    if(idx > -1) dados.movs[idx] = mov; else dados.movs.push(mov);
    
    salvarERender();
    bootstrap.Modal.getInstance(document.getElementById('modalMov')).hide();
}
function moverMovParaLixeira() {
    const id = document.getElementById('mov-id-edit').value;
    if(!id) return;
    if(confirm("Deseja enviar para a lixeira?")) {
        const idNumerico = Number(id); // Garante que a busca use o tipo correto
        const idx = dados.movs.findIndex(m => m.id === idNumerico);
        const item = dados.movs.splice(idx, 1)[0];
        item.origem = 'movs';
        item.deletadoEm = new Date().toLocaleDateString('pt-BR'); // <-- Guarda a data exata da exclusão
        dados.lixeira.push(item);
        salvarERender();
        bootstrap.Modal.getInstance(document.getElementById('modalMov')).hide();
    }
}
function renderLixeira() {
    const lista = document.getElementById('lista-lixeira');
    if (!lista) return;

    lista.innerHTML = dados.lixeira.length ? dados.lixeira.map(m => `
        <div class="card-mov opacity-75">
            <div class="icon-box bg-secondary text-white">
                <i class="fas fa-trash-restore"></i>
            </div>
            <div class="flex-grow-1">
                <div class="fw-bold text-decoration-line-through">${escaparHTML(m.lixeiraTitulo || m.nome || m.desc)}</div>
                <small class="text-muted">Deletado em: ${m.deletadoEm || new Date().toLocaleDateString('pt-BR')}</small>
            </div>
            <div class="text-end">
                <button class="btn btn-sm btn-outline-success border-0" onclick="restaurarDaLixeira(${m.id})">
                    <i class="fas fa-undo"></i>
                </button>
            </div>
        </div>
    `).join('') : '<p class="text-center text-muted py-4">A lixeira está vazia.</p>';
}

function restaurarDaLixeira(id) {
    const idNumerico = Number(id);
    const idx = dados.lixeira.findIndex(m => m.id === idNumerico);
    if (idx > -1) {
        const item = dados.lixeira.splice(idx, 1)[0];
        const destino = item.origem || 'movs'; 
        
        delete item.origem;
        // Limpa propriedades injetadas temporariamente para exibição na lixeira
        if (destino === 'cartoes' || destino === 'historicoQuitados') delete item.desc; 

        if (dados[destino]) {
            dados[destino].push(item);
        }
        
        salvarERender(); 
        renderLixeira();
    }
}

function esvaziarLixeira() {
    if (confirm("Tem certeza que deseja apagar permanentemente todos os itens da lixeira?")) {
        dados.lixeira = [];
        salvarERender();
        renderLixeira();
    }
}

function setFiltro(f) {
    filtroAtual = f;
    renderExtrato();
}

// Função para atualizar a variável de busca e renderizar a lista
function filtrarBusca(valor) {
    buscaAtual = valor.toLowerCase();
    renderExtrato();
}

// --- CARTÕES ---
function abrirModalCartao(id = null) {
    if(!verificarAcesso()) return;
    if(id) {
        const c = dados.cartoes.find(x => x.id == id);
        document.getElementById('card-id-edit').value = c.id;
        document.getElementById('card-nome').value = c.nome;
        document.getElementById('card-limite').value = c.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('card-bandeira').value = c.bandeira;
        document.getElementById('card-cor-custom').value = c.cor;
        document.getElementById('card-cor-fonte').value = c.corFonte || "#ffffff"; // <-- ADICIONADO: Resgata a cor da fonte (padrão branca se não existir)
        document.getElementById('card-tipo').value = c.tipo;
        document.getElementById('card-fecha').value = c.fecha;
        document.getElementById('card-vence').value = c.vence;
        document.getElementById('btn-excluir-cartao').classList.remove('d-none');
        document.getElementById('modalCartaoTitulo').innerText = "Editar Cartão";
    } else {
        document.getElementById('card-id-edit').value = "";
        document.getElementById('card-nome').value = "";
        document.getElementById('card-limite').value = "";
        document.getElementById('card-bandeira').value = "Visa"; // Valor padrão inicial
        document.getElementById('card-cor-custom').value = "#6f42c1"; 
        document.getElementById('card-cor-fonte').value = "#ffffff"; // <-- ADICIONADO: Define branca por padrão para novos cartões
        document.getElementById('card-tipo').value = "Crédito";
        document.getElementById('card-fecha').value = "10";
        document.getElementById('card-vence').value = "15";
        document.getElementById('btn-excluir-cartao').classList.add('d-none');
        document.getElementById('modalCartaoTitulo').innerText = "Novo Cartão";
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCartao')).show();
}
function addCartao() {
    const idEdit = document.getElementById('card-id-edit').value;
    const card = {
        id: idEdit ? Number(idEdit) : Date.now(), // Normaliza para Number
        nome: document.getElementById('card-nome').value,
        limite: parseFloat(document.getElementById('card-limite').value.replace(/\./g, '').replace(',', '.')) || 0,
        bandeira: document.getElementById('card-bandeira').value,
        cor: document.getElementById('card-cor-custom').value,
        corFonte: document.getElementById('card-cor-fonte').value, // <-- ADICIONADO: Captura o valor selecionado do formulário (preta ou branca)
        tipo: document.getElementById('card-tipo').value,
        fecha: document.getElementById('card-fecha').value,
        vence: document.getElementById('card-vence').value,
        compras: idEdit ? dados.cartoes.find(x => x.id == idEdit).compras : []
    };
    if(!card.nome || isNaN(card.limite)) return alert("Preencha o nome e limite!");

    if(idEdit) {
        const idx = dados.cartoes.findIndex(c => c.id == idEdit);
        dados.cartoes[idx] = card;
    } else {
        dados.cartoes.push(card);
    }
    salvarERender();
    bootstrap.Modal.getInstance(document.getElementById('modalCartao')).hide();
}

function excluirCartaoNoModal() {
    const id = document.getElementById('card-id-edit').value;
    if(confirm("Deseja mover este cartão para a lixeira?")) {
        const idNumerico = Number(id); // Normaliza para Number antes da busca
        const idx = dados.cartoes.findIndex(c => c.id === idNumerico);
        const item = dados.cartoes.splice(idx, 1)[0];
        item.origem = 'cartoes'; // Identifica para restauração futura
        item.lixeiraTitulo = `Cartão: ${item.nome}`; // Nome amigável para aparecer na lixeira
        dados.lixeira.push(item);
        salvarERender();
        bootstrap.Modal.getInstance(document.getElementById('modalCartao')).hide();
    }
}
// --- COMPRAS NO CARTÃO ---
function verCompras(id) {
    cartaoContexto = id;
    const c = dados.cartoes.find(x => x.id == id);
    document.getElementById('titulo-compras-cartao').innerText = `Compras: ${c.nome}`;
    renderComprasCartao();
    showSection('compras-cartao');
}

function abrirModalCompraCartao(id = null) {
    if(id) {
        const c = dados.cartoes.find(x => x.id == cartaoContexto).compras.find(co => co.id == id);
        document.getElementById('compra-id-edit').value = c.id;
        document.getElementById('compra-desc').value = c.desc;
        document.getElementById('compra-valor').value = c.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        document.getElementById('compra-parcelas').value = c.parcelas;
        document.getElementById('compra-data').value = c.data;
        document.getElementById('compra-emprestado').checked = c.emprestado || false; // <-- AGREGADO
        document.getElementById('btn-excluir-compra').classList.remove('d-none');
        document.getElementById('modalCompraTitulo').innerText = "Editar Compra";
    } else {
        document.getElementById('compra-id-edit').value = "";
        document.getElementById('compra-desc').value = "";
        document.getElementById('compra-valor').value = "";
        document.getElementById('compra-parcelas').value = 1;
        document.getElementById('compra-data').value = hojeISO();
        document.getElementById('compra-emprestado').checked = false; // <-- AGREGADO
        document.getElementById('btn-excluir-compra').classList.add('d-none');
        document.getElementById('modalCompraTitulo').innerText = "Nova Compra";
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCompraCartao')).show();
}
function salvarCompraCartao() {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto));
    if (!card) return alert("Erro: Cartão não encontrado.");
    
    const idEditRaw = document.getElementById('compra-id-edit').value;
    const idCompraFinal = idEditRaw ? Number(idEditRaw) : Date.now();
    
    const valorRaw = document.getElementById('compra-valor').value;
    const valorTotal = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;
    const parcelas = parseInt(document.getElementById('compra-parcelas').value) || 1;
    
    const movIdx = dados.movs.findIndex(m => m.idRelacionado === idCompraFinal);
    let idParaMov = movIdx > -1 ? dados.movs[movIdx].id : Date.now() + 1;

    const agora = new Date();
    const horaCompra = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
    const compraAntiga = idEditRaw ? card.compras.find(c => c.id === idCompraFinal) : null;

    const compra = {
        id: idCompraFinal,
        desc: document.getElementById('compra-desc').value.trim(),
        valorTotal: valorTotal,
        parcelas: parcelas,
        data: document.getElementById('compra-data').value || hojeISO(),
        hora: compraAntiga ? (compraAntiga.hora || horaCompra) : horaCompra,
        pagamentos: compraAntiga ? (compraAntiga.pagamentos || []) : [],
        emprestado: document.getElementById('compra-emprestado').checked // <-- AGREGADO
    };

    if (!compra.desc || isNaN(compra.valorTotal) || compra.valorTotal <= 0) {
        return alert("Preencha a descrição e o valor da compra corretamente!");
    }
    
    if(idEditRaw) {
        const idx = card.compras.findIndex(c => c.id === idCompraFinal);
        if(idx > -1) card.compras[idx] = compra;
    } else {
        card.compras.push(compra);
    }

    // Se for cartão emprestado, remove do extrato se já existia, e não insere um novo
    if (compra.emprestado) {
        if (movIdx > -1) {
            dados.movs.splice(movIdx, 1);
        }
    } else {
        const valorParcela = parseFloat((valorTotal / parcelas).toFixed(2));
        const descFinal = parcelas > 1 ? `${compra.desc} (1/${parcelas})` : compra.desc;

        const movData = {
            id: idParaMov, 
            idRelacionado: compra.id, 
            desc: descFinal,
            valor: valorParcela,
            tipo: 'saida',
            cat: 'Cartão',
            data: compra.data,
            hora: compra.hora
        };

        if(movIdx > -1) {
            dados.movs[movIdx] = movData;
        } else {
            dados.movs.push(movData);
        }
    }
    salvarERender();
    renderComprasCartao();
    bootstrap.Modal.getInstance(document.getElementById('modalCompraCartao')).hide();
}
function excluirCompraNoModal() {
    const id = document.getElementById('compra-id-edit').value;
    if(!id) return;
    const idNumerico = Number(id); 
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto));
    if(confirm("Excluir esta compra?")) {
        // CORREÇÃO: Usa comparação flexível ou normalização de tipo para evitar ignorar a remoção
        card.compras = card.compras.filter(c => Number(c.id) !== idNumerico); 
        dados.movs = dados.movs.filter(m => Number(m.idRelacionado) !== idNumerico); 
        salvarERender();
        renderComprasCartao();
        bootstrap.Modal.getInstance(document.getElementById('modalCompraCartao')).hide();
    }
}
function renderComprasCartao() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto);
    const lista = document.getElementById('lista-compras-cartao');
    const info = document.getElementById('info-cartao-detalhe');
    const mesInput = document.getElementById('mes-atual') ? document.getElementById('mes-atual').value : hojeISO().substring(0, 7);
    
    let gastoMes = 0;
    let comprasFiltradas = [];

        card.compras.forEach(c => {
        const dataCompra = new Date(c.data + 'T00:00:00');
        let pertenceAoMes = false;
        let parcelaAtualTexto = "";

        let parcelasAntecipadasQtd = c.pagamentos ? c.pagamentos.filter(p => p.antecipada).length : 0;
        let parcelasRestantes = c.parcelas - parcelasAntecipadasQtd;

        for (let i = 0; i < parcelasRestantes; i++) {
            let dataParcela = new Date(dataCompra.getFullYear(), dataCompra.getMonth() + i, 1);
            let anoP = dataParcela.getFullYear();
            let mesP = String(dataParcela.getMonth() + 1).padStart(2, '0');

            if (`${anoP}-${mesP}` === mesInput) {
                pertenceAoMes = true;
                parcelaAtualTexto = `(${i + 1}/${parcelasRestantes})`;
                gastoMes += (c.valorTotal / c.parcelas);
            }
        }
        if (pertenceAoMes) {
            comprasFiltradas.push({ ...c, infoParcela: parcelaAtualTexto });
        }
    });

    const perc = card.limite > 0 ? Math.min(100, (gastoMes / card.limite) * 100) : 0;

    info.innerHTML = `
        <div class="card p-3 mb-3 border-0 shadow-sm rounded-4" style="background:${card.cor}; color:white;">
            <div class="d-flex justify-content-between">
                <span>Limite: R$ ${card.limite.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
<span>Uso: R$ ${gastoMes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
            </div>
            <div class="card-limit-box"><div class="card-limit-progress" style="width:${perc}%"></div></div>
            <div class="card-info-row">
                <span>Fechamento: Dia ${card.fecha}</span>
                <span>Vencimento: Dia ${card.vence}</span>
            </div>
        </div>
    `;

                                lista.innerHTML = comprasFiltradas.map(c => {
        // Calcula o saldo devedor real da compra abatendo os pagamentos realizados
        const valorRestante = c.valorTotal - (c.pagamentos ? c.pagamentos.reduce((a, b) => a + b.valor, 0) : 0);
        const statusClass = valorRestante <= 0 ? 'text-success' : 'text-danger';
        const valorDaParcelaCorrente = c.valorTotal / c.parcelas;
        
        return `
        <div class="card-mov align-items-start py-3 mb-2 shadow-sm bg-white rounded-3">
            <div class="flex-grow-1 ms-2">
                <div class="fw-bold">${escaparHTML(c.desc)} <span class="badge bg-purple" style="font-size:0.65rem">${c.infoParcela}</span> ${c.emprestado ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.6rem">EMPRESTADO</span>' : ''} ${valorRestante <= 0 ? '<span class="badge bg-success ms-1" style="font-size:0.6rem">PAGO</span>' : ''}</div>
                <small class="text-muted d-block">Total restante: R$ ${valorRestante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</small>
                
                ${c.pagamentos && c.pagamentos.length > 0 ? `
                <div class="mt-2 p-2 bg-light rounded-3 border-start border-info border-3" style="font-size: 0.75rem;">
                    <div class="text-uppercase fw-bold text-muted mb-1" style="font-size: 0.65rem;">Histórico de Pagamentos:</div>
                    ${c.pagamentos.map(p => `<div class="text-dark">→ Pago: R$ ${p.valor.toLocaleString('pt-BR')} em ${p.data} às ${p.hora}</div>`).join('')}
                </div>` : ''}

                <small class="text-muted mt-1 d-block" style="font-size: 0.7rem;">
                    <i class="far fa-calendar-alt me-1"></i>${c.data.split('-').reverse().join('/')} 
                    <i class="far fa-clock ms-2 me-1"></i>${c.hora || '--:--'}
                </small>
            </div>
            <div class="text-end me-2">
                <div class="fw-bold ${statusClass}">
                    R$ ${valorDaParcelaCorrente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </div>
            </div>
            
            <div class="dropdown">
                <button class="btn btn-link text-muted p-2" data-bs-toggle="dropdown">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                    <li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(${c.id})">
                        <i class="fas fa-edit text-primary me-2"></i> Editar Compra
                    </button></li>
                                                            <li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(${c.id}, 'total')">
                        <i class="fas fa-check-circle text-success me-2"></i> Pagamento Total
                    </button></li>
                    <li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(${c.id}, 'parcial')">
                        <i class="fas fa-coins text-warning me-2"></i> Pagamento Parcial
                    </button></li>
                    <li><button class="dropdown-item py-2" onclick="anteciparParcelaModal(${c.id})">
                        <i class="fas fa-forward text-info me-2"></i> Antecipar Próxima Parcela
                    </button></li>
                </ul>
            </div>
        </div>`;
    }).join('') || '<p class="text-center text-muted">Sem compras neste cartão.</p>';
}

// --- DÍVIDAS ---
function abrirModalDivida(id = null) {
    if(!verificarAcesso()) return;
    
    if(id) {
        const d = dados.dividas.find(x => x.id == id);
        document.getElementById('div-id-edit').value = d.id;
        document.getElementById('div-tipo').value = d.tipo;
        document.getElementById('div-nome').value = d.nome;
        // Dentro do if(id) da função abrirModalDivida
document.getElementById('div-valor').value = d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('div-desc').value = d.desc;
        document.getElementById('div-whats').value = d.whats;
        document.getElementById('div-inicio').value = d.inicio;
        document.getElementById('div-prazo').value = d.prazo;
        document.getElementById('div-obs').value = d.obs;
        document.getElementById('modalDividaTitulo').innerText = "Editar Registro";
        document.getElementById('btn-excluir-divida').classList.remove('d-none');
    } else {
        document.getElementById('div-id-edit').value = "";
        document.getElementById('div-nome').value = "";
        document.getElementById('div-valor').value = "";
        document.getElementById('div-whats').value = "";
        document.getElementById('div-desc').value = "";
        document.getElementById('div-obs').value = "";
        document.getElementById('div-prazo').value = ""; // Garantindo limpeza
        document.getElementById('div-inicio').value = hojeISO();
        
        document.getElementById('modalDividaTitulo').innerText = "Novo Registro de Dívida";
        document.getElementById('btn-excluir-divida').classList.add('d-none');
    }
    const modalElement = document.getElementById('modalDivida');
    const modalInst = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInst.show();
}

function excluirDivida() {
    const id = document.getElementById('div-id-edit').value;
    if(!id) return;
    if(confirm("Deseja apagar esta dívida permanentemente?")) {
        const idNumerico = Number(id);
        dados.dividas = dados.dividas.filter(d => d.id !== idNumerico);
        salvarERender();
        document.getElementById('div-id-edit').value = "";
        document.getElementById('div-nome').value = "";
        document.getElementById('div-valor').value = "";
        bootstrap.Modal.getInstance(document.getElementById('modalDivida')).hide();
    }
}
// Local correto para modificar dentro da função addDivida
function addDivida() {
    if(!verificarAcesso()) return;
    
    const idEdit = document.getElementById('div-id-edit').value;
    const valorRaw = document.getElementById('div-valor').value; // Pegamos o valor bruto do campo
    
    // CORREÇÃO: Tratamento correto para valores com máscara (Ex: 1.500,00 -> 1500.00)
    const valorLimpo = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;

        const div = {
        id: idEdit ? Number(idEdit) : Date.now(), // <-- CORREÇÃO: Mantém o padrão Number do resto do app
        tipo: document.getElementById('div-tipo').value,
        nome: document.getElementById('div-nome').value,
        valor: valorLimpo,
        desc: document.getElementById('div-desc').value,
        whats: document.getElementById('div-whats').value,
        inicio: document.getElementById('div-inicio').value,
        prazo: document.getElementById('div-prazo').value,
        obs: document.getElementById('div-obs').value,
        pago: false
    };

    if(!div.nome || isNaN(div.valor) || div.valor <= 0) {
        alert("Por favor, preencha o nome e um valor válido para a dívida.");
        return;
    }
    
    const idx = dados.dividas.findIndex(d => d.id == div.id);
    if(idx > -1) {
        dados.dividas[idx] = div;
    } else {
        dados.dividas.push(div);
    }
    
    salvarERender();
    
    // Limpeza completa dos campos para evitar lixo no próximo registro
    document.getElementById('div-nome').value = "";
    document.getElementById('div-valor').value = "";
    document.getElementById('div-whats').value = "";
    document.getElementById('div-desc').value = "";
    document.getElementById('div-obs').value = "";
    document.getElementById('div-prazo').value = "";
    
    const modalElement = document.getElementById('modalDivida');
    const modalInst = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInst.hide();
}
// --- RENDERIZAÇÃO ---

function salvarERender() {
    // SE FOR VISITANTE: Impede a gravação física no localStorage para não apagar os dados de contas reais
    if (sessionStorage.getItem('user_ativo') === 'visitante' || usuarioAtivo === 'visitante') {
        renderTudo();
        return;
    }

    const stringDados = JSON.stringify(dados);
    // Calcula o tamanho em megabytes (1 caractere padrão UTF-16 ocupa aprox. 2 bytes em strings)
    const tamanhoMB = (stringDados.length * 2) / (1024 * 1024);
    
    // Se ultrapassar 4.5MB (próximo ao teto de 5MB), exibe um aviso crítico
    if (tamanhoMB > 4.5) {
        alert("ATENÇÃO: Seu armazenamento local está quase cheio (" + tamanhoMB.toFixed(2) + "MB usados). Exportar um backup imediatamente é altamente recomendado para evitar perda de dados!");
    }

    localStorage.setItem('financas_pro_max', stringDados);
    renderTudo();
}
function renderTudo() {
    renderResumo();
    renderExtrato();
    renderCartoes();
    renderDividas();
    renderMetas(); 
    renderizarNotas(); // Adicionado aqui para centralizar o ciclo de renderização
    verificarNotificacoes();
    renderGraficoRank(); 
    renderizarHistoricoDividas(); // <-- ADICIONE ESTA LINHA AQUI
}
function renderResumo() {
    const inputMes = document.getElementById('mes-atual');
    const elSaldo = document.getElementById('txt-saldo-geral');
    
    // Se o input de mês ou o saldo não existirem na tela atual, sai da função
    if (!inputMes || !elSaldo) return;

    const mesInput = inputMes.value;
    const movsMes = dados.movs.filter(m => m.data && m.data.startsWith(mesInput));
    
    let ent = 0, sai = 0;
    movsMes.forEach(m => { if(m.tipo === 'entrada') ent += m.valor; else sai += m.valor; });
    
    // Adicionando a classe money-value para o efeito de borrão funcionar
    const saldo = ent - sai;
    elSaldo.innerText = `R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // Lógica para Saldo Geral (Vermelho apenas se for negativo)
    elSaldo.classList.remove('text-success', 'text-danger'); // Reseta
    if (saldo < 0) {
        elSaldo.classList.add('text-danger');
    }
    elSaldo.classList.add('money-value');

    // Receitas (Entradas) - Branco padrão no card, mas adaptável ao container
    const elEntradas = document.getElementById('txt-entradas');
    elEntradas.innerText = `R$ ${ent.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    elEntradas.classList.remove('text-success'); // Garante que não fique verde
    elEntradas.classList.add('money-value');

    // Despesas (Saídas) - Mantém vermelho nativo nas saídas do extrato
    const elSaidas = document.getElementById('txt-saidas');
    elSaidas.innerText = `- R$ ${sai.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    elSaidas.classList.remove('text-warning'); // Remove tons amarelados que conflitam fora do card principal
    elSaidas.classList.add('text-danger', 'money-value');

    const lista = document.getElementById('lista-recente');
    lista.innerHTML = [...movsMes].sort(ordemMov).slice(0, 5).map(m => `
        <div class="card-mov">
            <div class="icon-box ${m.tipo === 'entrada' ? 'bg-success' : 'bg-danger'} text-white">
                <i class="fas ${m.tipo === 'entrada' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
            <div class="flex-grow-1">
                <div class="fw-bold">${escaparHTML(m.desc)}${m.virtual?' <span class="badge bg-purple">Fatura</span>':''}${m.fixo?' <span class="badge bg-info text-dark" title="Se repete todo mês"><i class="fas fa-rotate"></i> Fixo</span>':''}</div> <small class="text-muted">${escaparHTML(m.cat)} • ${m.hora || '--:--'}</small>
            </div>
            <div class="fw-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'} money-value">
                ${m.tipo === 'entrada' ? '+' : '-'} R$ ${m.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </div>
        </div>
    `).join('');
}
function renderExtrato() {
    const lista = document.getElementById('lista-extrato');
    const inputMes = document.getElementById('mes-atual');
    
    // Proteção: se a lista ou o input não existirem, não faz nada
    if (!lista || !inputMes) return;

    const mesInput = inputMes.value;

    
    // 1. Filtra por Mês
    let filtrados = dados.movs.filter(m => m.data && m.data.startsWith(mesInput));
    
    // 2. Filtra por Tipo (entrada/saída)
    if(filtroAtual !== 'todos') {
        filtrados = filtrados.filter(m => m.tipo === filtroAtual);
    }

    // 3. Filtra por Texto (Busca em tempo real)
    if(buscaAtual) {
        filtrados = filtrados.filter(m => 
            m.desc.toLowerCase().includes(buscaAtual) || 
            m.cat.toLowerCase().includes(buscaAtual)
        );
    }
    // Usando [...filtrados] para criar uma cópia e não mexer na ordem original dos dados
    lista.innerHTML = filtrados.length ? [...filtrados].sort(ordemMov).map(m => `
        <div class="card-mov" onclick="abrirModalMov(${m.id})" data-bs-toggle="modal" data-bs-target="#modalMov">
            <div class="icon-box ${m.tipo === 'entrada' ? 'bg-success' : 'bg-danger'} text-white">
                <i class="fas ${m.tipo === 'entrada' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
                        <div class="flex-grow-1">
                <div class="fw-bold">${escaparHTML(m.desc)}${m.virtual?' <span class="badge bg-purple">Fatura</span>':''}${m.fixo?' <span class="badge bg-info text-dark" title="Se repete todo mês"><i class="fas fa-rotate"></i> Fixo</span>':''}</div>
                <small class="text-muted">
                    <i class="far fa-calendar-alt me-1"></i>${m.data.split('-').reverse().join('/')} 
                    <i class="far fa-clock ms-2 me-1"></i>${m.hora || '--:--'}
                </small>
            </div>
            <div class="text-end">
                <div class="fw-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'} money-value">
                    R$ ${m.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </div>
                <i class="fas fa-edit text-muted small"></i>
            </div>
        </div>
    `).join('') : '<p class="text-center text-muted">Nenhum lançamento este mês.</p>';
}
function renderCartoes() {
    const listaHome = document.getElementById('home-lista-cartoes');
    const listaSessao = document.getElementById('lista-cartoes');
    
    if (!listaHome || !listaSessao) return;

    // Filtra apenas por cartões válidos que possuem a propriedade limite antes de mapear
    const mesInput = document.getElementById('mes-atual') ? document.getElementById('mes-atual').value : hojeISO().substring(0, 7);

    const html = dados.cartoes.filter(c => c && typeof c.limite !== 'undefined').map(c => {
        let gastoTotalCartao = 0;
        if (c.compras && Array.isArray(c.compras)) {
            c.compras.forEach(compraItem => {
                // Lógica de parcelamento fixo nos meses subsequentes
                const dataCompra = new Date(compraItem.data + 'T00:00:00');
                const [anoAlvo, mesAlvo] = mesInput.split('-').map(Number);
                
                                let parcelasAntecipadasQtd = compraItem.pagamentos ? compraItem.pagamentos.filter(p => p.antecipada).length : 0;
                // O novo limite de parcelas ativas a serem exibidas consecutivamente na linha do tempo
                let parcelasRestantes = compraItem.parcelas - parcelasAntecipadasQtd;
                
                for (let i = 0; i < parcelasRestantes; i++) {
                    let dataParcela = new Date(dataCompra.getFullYear(), dataCompra.getMonth() + i, 1);
                    let anoP = dataParcela.getFullYear();
                    let mesP = String(dataParcela.getMonth() + 1).padStart(2, '0');
                    
                    if (`${anoP}-${mesP}` === mesInput) {
                        // Deduz os pagamentos já realizados para não cobrar limite de parcelas já pagas
                        const totalPagoJa = compraItem.pagamentos ? compraItem.pagamentos.reduce((a, b) => a + b.valor, 0) : 0;
                        if (totalPagoJa < compraItem.valorTotal) {
                            gastoTotalCartao += (compraItem.valorTotal / compraItem.parcelas);
                        }
                    }
                }
            });
        }
        
        return `
        <div class="col-6 mb-3">
            <div class="credit-card-container card-compact" style="background:${c.cor}; color:${c.corFonte || '#ffffff'};" onclick="verCompras(${c.id})">
                <div class="card-header-ui">
                    <div>
                        <h6 class="mb-0">${escaparHTML(c.nome)}</h6>
                        <small>${c.bandeira}</small>
                    </div>
                    <div class="dropdown" onclick="event.stopPropagation()">
                        <i class="fas fa-ellipsis-v p-1" data-bs-toggle="dropdown" aria-expanded="false"></i>
                        <ul class="dropdown-menu">
                            <li><button class="dropdown-item" onclick="abrirModalCartao(${c.id})">Editar Cartão</button></li>
                        </ul>
                    </div>
                </div>
                <div class="mt-3">
                    <small class="d-block opacity-75">Limite disponível</small>
                    <span class="fw-bold">R$ ${(c.limite - gastoTotalCartao).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    listaHome.innerHTML = html || '<p class="text-center w-100 text-muted">Nenhum cartão cadastrado.</p>';
    listaSessao.innerHTML = html || '<p class="text-center w-100 text-muted">Nenhum cartão cadastrado.</p>';
}
// Altera o status selecionado e atualiza a interface dos botões
function setStatusDivida(status, botao) {
    statusDividaAtual = status;
    
    // Remove a classe ativa (btn-purple) de todos os botões do grupo e reseta para btn-light
    document.querySelectorAll('.filter-status-btn').forEach(btn => {
        if (btn) {
            btn.classList.remove('btn-purple', 'text-white');
            btn.classList.add('btn-light');
        }
    });
    
    // Ativa o botão clicado apenas se o elemento for fornecido validamente
    if (botao && botao.classList) {
        botao.classList.remove('btn-light');
        botao.classList.add('btn-purple', 'text-white');
    }
    
    renderDividas();
}
// Reseta todos os filtros para o padrão original
function limparFiltrosDivida() {
    buscaDividaAtual = '';
    ordemDividaAtual = 'data-recente';
    statusDividaAtual = 'todas';
    
    // Reseta os elementos do HTML
    const inputBusca = document.getElementById('busca-divida');
    const selectOrdem = document.getElementById('ordenar-divida');
    if (inputBusca) inputBusca.value = '';
    if (selectOrdem) selectOrdem.value = 'data-recente';
    // Reseta visualmente os botões de status, ativando o "Todas"
    const botoes = document.querySelectorAll('.filter-status-btn');
    if (botoes.length > 0) {
        botoes.forEach(btn => {
            btn.classList.remove('btn-purple', 'text-white');
            btn.classList.add('btn-light');
        });
        botoes[0].classList.remove('btn-light');
        botoes[0].classList.add('btn-purple', 'text-white');
    }
    
    renderDividas();
}
function renderDividas() {
    // Pegamos a data atual formatada em string (ano-mes-dia) para comparar corretamente sem problemas de fuso horário
    const hojeStr = hojeISO();

    // 1. Filtra inicialmente por tipo de dívida
    let euDevo = dados.dividas.filter(d => d.tipo === 'eu-devo');
    let meDevem = dados.dividas.filter(d => d.tipo === 'me-devem');

    // 2. Aplica o filtro de busca por texto (Nome ou Descrição) se houver algo digitado
    if (buscaDividaAtual) {
        euDevo = euDevo.filter(d => 
            (d.nome && d.nome.toLowerCase().includes(buscaDividaAtual)) || 
            (d.desc && d.desc.toLowerCase().includes(buscaDividaAtual))
        );
        meDevem = meDevem.filter(d => 
            (d.nome && d.nome.toLowerCase().includes(buscaDividaAtual)) || 
            (d.desc && d.desc.toLowerCase().includes(buscaDividaAtual))
        );
    }

    // 2.5 Aplica o filtro por Status (Pendentes ou Vencidas)
    if (statusDividaAtual === 'pendentes') {
        // Pendente: Não passou do prazo ou não tem prazo definido
        euDevo = euDevo.filter(d => !d.prazo || d.prazo >= hojeStr);
        meDevem = meDevem.filter(d => !d.prazo || d.prazo >= hojeStr);
    } else if (statusDividaAtual === 'vencidas') {
        // Vencida: Tem prazo definido e esse prazo é menor que hoje
        euDevo = euDevo.filter(d => d.prazo && d.prazo < hojeStr);
        meDevem = meDevem.filter(d => d.prazo && d.prazo < hojeStr);
    }

    // Função auxiliar para aplicar a ordenação selecionada
    const aplicarOrdenacao = (lista) => {
        return lista.sort((a, b) => {
            if (ordemDividaAtual === 'data-recente') {
                return new Date(b.prazo || b.inicio) - new Date(a.prazo || a.inicio);
            }
            if (ordemDividaAtual === 'data-antiga') {
                return new Date(a.prazo || a.inicio) - new Date(b.prazo || b.inicio);
            }
            if (ordemDividaAtual === 'alfa-crescente') {
                return (a.nome || '').localeCompare(b.nome || '');
            }
            if (ordemDividaAtual === 'alfa-decrescente') {
                return (b.nome || '').localeCompare(a.nome || '');
            }
            return 0;
        });
    };

    // 3. Aplica a ordenação nas listas filtradas
    euDevo = aplicarOrdenacao(euDevo);
    meDevem = aplicarOrdenacao(meDevem);

    // O cálculo dos totais reflete o que está filtrado na tela
    const totalPagar = euDevo.reduce((a, b) => a + b.valor, 0);
    const totalReceber = meDevem.reduce((a, b) => a + b.valor, 0);

    document.getElementById('total-eu-devo').innerText = `R$ ${totalPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('total-me-devem').innerText = `R$ ${totalReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    const template = (d) => {
        const venc = d.prazo && d.prazo < hojeStr, hoje = d.prazo === hojeStr, parc = d.parcelas > 1, pagar = d.tipo === 'eu-devo';
        const st = !d.prazo ? '' : venc ? '<span class="chip-st st-venc">Vencida</span>' : hoje ? '<span class="chip-st st-hoje">Vence hoje</span>' : '';
        return `<div class="div-item">
            <span class="div-av ${pagar ? 'pagar' : 'receber'}">${escaparHTML((d.nome || '?').trim().charAt(0).toUpperCase())}</span>
            <div class="div-mid">
                <b>${escaparHTML(d.nome)}</b>
                <small>${d.prazo ? d.prazo.split('-').reverse().join('/') : 'Sem prazo'}${parc ? ' • Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : ''}${d.desc ? ' • ' + escaparHTML(d.desc) : ''}${d.juros ? ' • Juros ' + d.juros + '%/mês' : ''}${d.forma ? ' • ' + escaparHTML(d.forma) : ''}</small>
                ${st}${d.prio === 'alta' ? '<span class="chip-st st-venc">Prioridade alta</span>' : ''}
                ${d.obs ? `<details class="div-hist"><summary>Histórico</summary><div>${escaparHTML(d.obs)}</div></details>` : ''}
            </div>
            <div class="div-val ${pagar ? 'text-danger' : 'text-success'} money-value">${brl(d.valor)}${parc ? `<small>${brl(d.valorParcela || 0)}/parcela</small>` : ''}</div>
            <div class="dropdown">
                <button class="btn btn-link" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-vertical"></i></button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                    ${d.whats ? `<li><a class="dropdown-item py-2" href="https://wa.me/55${(d.whats || '').replace(/\D/g,'')}" target="_blank"><i class="fab fa-whatsapp me-2"></i>WhatsApp</a></li>` : ''}
                    <li><button class="dropdown-item py-2" onclick="abrirModalDivida(${d.id})"><i class="fas fa-pen me-2"></i>Editar</button></li>
                    ${parc ? `<li><button class="dropdown-item py-2" onclick="pagarParcelaDivida(${d.id})"><i class="fas fa-calendar-check me-2"></i>Pagar próxima parcela</button></li>` : ''}
                    ${d.prazo ? `<li><button class="dropdown-item py-2" onclick="eventoCalendarioDivida(${d.id})"><i class="far fa-calendar-plus me-2"></i>Adicionar ao calendário</button></li>` : ''}
                    <li><button class="dropdown-item py-2" onclick="prepararPagamento(${d.id}, 'total')"><i class="fas fa-circle-check me-2"></i>Pagamento total</button></li>
                    <li><button class="dropdown-item py-2" onclick="prepararPagamento(${d.id}, 'parcial')"><i class="fas fa-coins me-2"></i>Pagamento parcial</button></li>
                </ul>
            </div>
        </div>`;
    };

    document.getElementById('lista-eu-devo').innerHTML = euDevo.map(template).join('') || '<p class="text-center small py-3">Sem dívidas registradas.</p>';
    document.getElementById('lista-me-devem').innerHTML = meDevem.map(template).join('') || '<p class="text-center small py-3">Sem valores a receber.</p>';
    
    // Adicione a chamada para renderizar o histórico também
    renderizarHistoricoDividas();
}


function prepararPagamento(id, modo) {
    const div = dados.dividas.find(d => d.id == id);
    document.getElementById('pag-id').value = id;
    document.getElementById('pag-modo').value = modo;
    document.getElementById('pag-data').value = hojeISO();
    
    const campoValor = document.getElementById('pag-valor');
    const areaValor = document.getElementById('area-valor-pag');

    if (modo === 'total') {
        document.getElementById('tituloPagamento').innerText = "Pagamento Total";
        campoValor.value = div.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        areaValor.classList.add('d-none'); // Esconde o campo pois o valor é fixo
    } else {
        document.getElementById('tituloPagamento').innerText = "Pagamento Parcial";
        campoValor.value = "";
        areaValor.classList.remove('d-none'); // Mostra para digitar quanto quer pagar
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalPagamento')).show();
}

function confirmarPagamento() {
    const id = document.getElementById('pag-id').value;
    const modoRaw = document.getElementById('pag-modo').value;
    const dataRaw = document.getElementById('pag-data').value;
    const valorDigitado = document.getElementById('pag-valor').value;
    
    if(!dataRaw) return alert("Selecione a data!");

    const valorPagamento = parseFloat(valorDigitado.replace(/\./g, '').replace(',', '.')) || 0;
    const dataFormatada = dataRaw.split('-').reverse().join('/');
    const agora = new Date();
    const horaPagto = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

    // LÓGICA PARA COMPRAS DE CARTÃO
    if (modoRaw.includes("-cartao")) {
        const card = dados.cartoes.find(x => x.id == cartaoContexto);
        const compra = card.compras.find(c => c.id == id);
        
        if (!compra.pagamentos) compra.pagamentos = [];
        
        compra.pagamentos.push({
            valor: valorPagamento,
            data: dataFormatada,
            hora: horaPagto
        });

        alert("Pagamento da compra registrado!");
        salvarERender();
        renderComprasCartao();
        bootstrap.Modal.getInstance(document.getElementById('modalPagamento')).hide();
        return;
    }

    // LÓGICA PARA DÍVIDAS
    const idx = dados.dividas.findIndex(d => d.id == id);
    if (idx === -1) return;
    const div = dados.dividas[idx];

        if (modoRaw === 'total') {
        const item = dados.dividas.splice(idx, 1)[0];
        item.origem = 'dividas';
        item.obs = (item.obs || "") + `\n- QUITADO TOTAL (R$ ${item.valor.toLocaleString('pt-BR')}) em ${dataFormatada} às ${horaPagto}`;
        
        // Adiciona a propriedade com a data atual em milissegundos para o controle de 30 dias
        item.dataQuitacaoMs = Date.now(); 
        
        // Salva no novo histórico de quitados em vez da lixeira
        dados.historicoQuitados.push(item);
        alert("Dívida quitada com sucesso e adicionada ao histórico!");
    } else {
        if (valorPagamento <= 0 || valorPagamento > div.valor) return alert("Valor inválido!");
        div.valor = Math.round((div.valor - valorPagamento) * 100) / 100;
        div.obs = (div.obs || "") + `\n→ Pago: R$ ${valorPagamento.toLocaleString('pt-BR')} (${dataFormatada} às ${horaPagto})`;
        alert("Pagamento parcial registrado!");
    }

    salvarERender();
    bootstrap.Modal.getInstance(document.getElementById('modalPagamento')).hide();
}

// --- UTILITÁRIOS ---

function toggleTema() {
    dados.config.dark = !dados.config.dark;
    const isDark = dados.config.dark;
    
    // Aplica o tema no body
    document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
    
    const btnTema = document.getElementById('btn-tema');
    if (btnTema) {
        // Adiciona a classe de animação do CSS
        btnTema.classList.add('rotate-icon');
        
        // Troca o ícone no meio da animação
        setTimeout(() => {
            if (isDark) {
                btnTema.classList.replace("fa-moon", "fa-sun");
            } else {
                btnTema.classList.replace("fa-sun", "fa-moon");
            }
        }, 250);

        // Remove a classe para poder girar de novo no próximo clique
        setTimeout(() => btnTema.classList.remove('rotate-icon'), 500);
    }
    
    localStorage.setItem('financas_pro_max', JSON.stringify(dados));
}
function toggleVisibilidade() {
    dados.config.oculto = !dados.config.oculto;
    const isOculto = dados.config.oculto;

    // 1. Liga/Desliga o borrão nos valores (CSS)
    document.body.classList.toggle('values-hidden', isOculto);
    
    // 2. Busca o ícone pelo ID (Garante compatibilidade caso o ID esteja no botão ou diretamente no <i>)
    let btnOlho = document.getElementById('btn-olho');
    if (btnOlho) {
        // Se o elemento com ID for o botão/div container, busca o <i> dentro dele
        if (btnOlho.tagName !== 'I') {
            btnOlho = btnOlho.querySelector('i');
        }
        
        if (btnOlho) {
            if (isOculto) {
                btnOlho.classList.remove("fa-eye");
                btnOlho.classList.add("fa-eye-slash");
            } else {
                btnOlho.classList.remove("fa-eye-slash");
                btnOlho.classList.add("fa-eye");
            }
        }
    }

    localStorage.setItem('financas_pro_max', JSON.stringify(dados));
}
window.onload = () => {
    const camposValor = ['mov-valor', 'card-limite', 'compra-valor', 'div-valor', 'pag-valor', 'meta-objetivo'];
    camposValor.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', mascaraMoeda);
            if(el.value) { el.dispatchEvent(new Event('input')); }
        }
    });

        const inputMes = document.getElementById('mes-atual');
    if (inputMes) {
        if (!inputMes.value) {
            inputMes.value = hojeISO().substring(0, 7);
        }
        // Ouvinte adicionado para disparar o recarregamento ao trocar o mês de consulta do cabeçalho
        inputMes.addEventListener('change', () => {
            renderTudo();
            if(cartaoContexto) {
                renderComprasCartao();
            }
        });
    }
    if (!usuarioAtivo && localStorage.getItem('user_lembrado')) {
        usuarioAtivo = localStorage.getItem('user_lembrado');
        sessionStorage.setItem('user_ativo', usuarioAtivo);
    }

    // CORREÇÃO: Se for visitante ao dar F5, isola uma estrutura limpa em memória sem afetar chaves globais
    if (usuarioAtivo === 'visitante') {
        dados = { 
            movs: [], 
            cartoes: [], 
            dividas: [], 
            metas: [], 
            lixeira: [], 
            historicoQuitados: [], 
            config: { dark: false, oculto: false } 
        };
        if (typeof notas !== 'undefined') notas = [];
    }

    if(usuarioAtivo) {
        const telaLogin = document.getElementById('tela-login');
        if(telaLogin) telaLogin.style.display = 'none';
        
        // ADICIONADO: Garante que o nome permaneça renderizado após o refresh (F5)
        atualizarNomeUsuarioTela(usuarioAtivo);
    } else {
        // Se não tiver usuário ativo, garante que exiba Visitante por padrão no fundo
        atualizarNomeUsuarioTela('Visitante');
    }
    if(dados.config.dark) {
        document.body.setAttribute('data-bs-theme', 'dark');
        const btnTema = document.getElementById('btn-tema');
        if(btnTema) btnTema.classList.replace("fa-moon", "fa-sun");
    }

    if(dados.config.oculto) {
        document.body.classList.add('values-hidden');
        let btnOlho = document.getElementById('btn-olho');
        if(btnOlho) {
            if (btnOlho.tagName !== 'I') {
                btnOlho = btnOlho.querySelector('i');
            }
            if (btnOlho) {
                btnOlho.classList.remove("fa-eye");
                btnOlho.classList.add("fa-eye-slash");
            }
        }
    }
    // Escutadores para os filtros da tela de Dívidas (se os elementos existirem na tela)
    const inputBuscaDiv = document.getElementById('busca-divida');
    const selectOrdemDiv = document.getElementById('ordenar-divida');
    if (inputBuscaDiv) {
        inputBuscaDiv.addEventListener('input', (e) => {
            buscaDividaAtual = e.target.value.toLowerCase();
            renderDividas();
        });
    }
    if (selectOrdemDiv) {
        selectOrdemDiv.addEventListener('change', (e) => {
            if (!e.target.value.startsWith('status-')) ordemDividaAtual = e.target.value;
            renderDividas();
        });
    }
    
    // Novo escutador para o select unificado de filtro e ordenação juntas
    const selectUnificadoDiv = document.getElementById('filtro-ordenar-divida'); // <-- ADICIONE ESTE BLOCO
    if (selectUnificadoDiv) {
        selectUnificadoDiv.addEventListener('change', (e) => {
            tratarFiltroEOrdenacao(e.target.value);
        });
    }
    // Só processa dados se houver um usuário logado
    if (usuarioAtivo) {
        limparHistoricoAntigo();
        processarLancamentosFixos();
    }
    
    // Configuração segura da calculadora arrastável movida para o final do ciclo de boot
    calcContainer = document.getElementById('calc-container');
    calcHeader = document.getElementById('calc-header');
    
    if (calcHeader && calcContainer) {
        calcHeader.addEventListener('mousedown', startDrag);
        calcHeader.addEventListener('touchstart', startDrag, { passive: true });
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('touchend', () => isDragging = false);
    }

    renderTudo();
};
function resetarApp() {
    if(confirm("Deseja apagar todos os dados?")) {
        localStorage.clear();
        location.reload();
    }
}

function sairApp() {
    sessionStorage.clear();
    localStorage.removeItem('user_lembrado');
    location.reload();
}

function exportarBackup() {
    const blob = new Blob([JSON.stringify(dados)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_financas.json';
    a.click();
}

function abrirImportar() {
    if(!verificarAcesso()) return;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                dados = JSON.parse(ev.target.result);
                localStorage.setItem('financas_pro_max', JSON.stringify(dados));
                location.reload();
            } catch(err) { alert("Arquivo inválido!"); }
        };
        reader.readAsText(e.target.files[0]);
    };
    inp.click();
}
// --- SISTEMA DE NOTIFICAÇÕES INTELIGENTE ---

function verificarNotificacoes() {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    
    const inputMes = document.getElementById('mes-atual');
    if (!inputMes) return; // Cancela se o elemento não estiver na tela
    
    const mesAtual = inputMes.value;
    
    let totalAlertas = 0;

    // 1. Dívidas próximas (3 dias)
    const tresDias = new Date();
    tresDias.setDate(hoje.getDate() + 3);
    
    // Zera as horas de hoje e de três dias para uma comparação justa de datas inteiras
    const hojeZerado = new Date();
    hojeZerado.setHours(0,0,0,0);
    tresDias.setHours(23,59,59,999);

                const divAlert = dados.dividas.filter(d => {
        if (!d.prazo || d.pago) return false; // <-- CORREÇÃO: Ignora as que já estão marcadas como pagas
        const prazo = new Date(d.prazo + 'T00:00:00');
        return prazo >= hojeZerado && prazo <= tresDias;
    }).length;
    // 2. Cartões vencendo em breve (3 dias)
    const cardAlert = dados.cartoes.filter(c => {
        const v = parseInt(c.vence);
        return v >= diaAtual && v <= (diaAtual + 3);
    }).length;

    // 3. Alerta de Orçamento (Gastos > 80% da Receita)
    let ent = 0, sai = 0;
    dados.movs.filter(m => m.data && m.data.startsWith(mesAtual)).forEach(m => {
        if(m.tipo === 'entrada') ent += m.valor; else sai += m.valor;
    });

        // Define a lógica do alerta de orçamento antes de somar no total
    const orcamentoAlert = (ent > 0 && sai > (ent * 0.8)) ? 1 : 0;

    // Verifica se os dados locais já guardam um volume relevante de informações sem backup recente
    const tamanhoDadosBytes = JSON.stringify(dados).length * 2;
    const dadosRelevantesSemBackup = tamanhoDadosBytes > (1.5 * 1024 * 1024); // Mais de 1.5MB acumulados
    const backupAlert = dadosRelevantesSemBackup ? 1 : 0;

    totalAlertas = divAlert + cardAlert + orcamentoAlert + backupAlert;
    const badge = document.getElementById('badge-notificacao');
    
    if (badge) {
        if (totalAlertas > 0) {
            badge.innerText = totalAlertas;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }
}
function abrirNotificacoes() {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAtual = document.getElementById('mes-atual').value;
    let listaAvisos = [];

    // Lógica 1: Dívidas
    const tresDias = new Date();
    tresDias.setDate(hoje.getDate() + 3);
        dados.dividas.forEach(d => {
        if (!d.prazo) return;
        const prazo = new Date(d.prazo + 'T00:00:00');
        const hojeLimpo = new Date(hoje);
        hojeLimpo.setHours(0,0,0,0);
        if (!d.pago && prazo >= hojeLimpo && prazo <= tresDias) {
            listaAvisos.push(`DÍVIDA: ${d.nome} vence dia ${d.prazo.split('-').reverse().join('/')}`);
        }
    });
    // Lógica 2: Cartões
    dados.cartoes.forEach(c => {
        const v = parseInt(c.vence);
        if (v >= diaAtual && v <= (diaAtual + 3)) {
            listaAvisos.push(`CARTÃO: Fatura do ${c.nome} vence dia ${v}`);
        }
    });

        // Lógica 3: Orçamento
    let ent = 0, sai = 0;
    dados.movs.filter(m => m.data && m.data.startsWith(mesAtual)).forEach(m => {
        if(m.tipo === 'entrada') ent += m.valor; else sai += m.valor;
    });
    if (ent > 0 && sai > (ent * 0.8)) {
        listaAvisos.push(`ORÇAMENTO: Você já usou ${((sai/ent)*100).toFixed(0)}% das suas receitas! Atenção aos gastos.`);
    }

    // Alerta preventivo na Central de Lembretes baseado no tamanho do armazenamento
    const tamanhoDadosMB = (JSON.stringify(dados).length * 2) / (1024 * 1024);
    if (tamanhoDadosMB > 1.5) {
        listaAvisos.push(`SEGURANÇA: Seu volume de dados local está crescendo (${tamanhoDadosMB.toFixed(2)}MB). Use o botão "Exportar Backup" nas configurações para baixar sua cópia de segurança.`);
    }

    if (listaAvisos.length === 0) {

        alert("Tudo sob controle! Nenhuma pendência urgente para os próximos dias.");
    } else {
        alert("CENTRAL DE LEMBRETES:\n\n" + listaAvisos.join('\n\n'));
    }
}
// --- SISTEMA DE RANKING (GRÁFICO) ---

function renderGraficoRank() {
    const ctx = document.getElementById('chartGastos');
    const balancoTxt = document.getElementById('txt-balanco-grafico');
    const legendaHtml = document.getElementById('legenda-grafico-html');
    
        if (!ctx || !balancoTxt || !legendaHtml) return;

    // Destrói gráfico anterior de forma limpa antes de processar dados
    if (meuGrafico && typeof meuGrafico.destroy === 'function') { 
        meuGrafico.destroy(); 
        meuGrafico = null;
    }

    const mesInput = document.getElementById('mes-atual').value;
    const movsMes = dados.movs.filter(m => m.data && m.data.startsWith(mesInput));

    // 1. Processamento de Dados (Entradas vs Saídas por Categoria)
    const categorias = {};
    let totalEntradas = 0;
    let totalSaidas = 0;

    movsMes.forEach(m => {
        const cat = m.cat || "Outros"; 
        if (!categorias[cat]) {
            categorias[cat] = { entrada: 0, saida: 0, total_movs: 0 };
        }
        
        if (m.tipo === 'entrada') {
            categorias[cat].entrada += m.valor;
            totalEntradas += m.valor;
        } else if (m.tipo === 'saida') {
            categorias[cat].saida += m.valor;
            totalSaidas += m.valor;
        }
        categorias[cat].total_movs += 1;
    });

    // Calcula o Balanço Total para o centro do gráfico
    const balancoTotal = totalEntradas - totalSaidas;
    balancoTxt.innerText = balancoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // Ajusta a cor do texto do balanço central
    balancoTxt.classList.remove('text-success', 'text-danger', 'text-dark');
    if(balancoTotal < 0) balancoTxt.classList.add('text-danger');
    else if(balancoTotal > 0) balancoTxt.classList.add('text-success');
    else balancoTxt.classList.add('text-dark');

    // Mapeamento de cores fixas para as categorias (Adicionado suporte a variações comuns)
    const coresMap = {
        'Mercado': '#4ecca3', 'Transporte': '#6f42c1', 'Saúde': '#dc3545', 'Saude': '#dc3545',
        'Lazer': '#ffc107', 'Salário': '#0dcaf0', 'Salario': '#0dcaf0', 'Aluguel': '#ff8c00', 'Cartão': '#e83e8c', 'Outros': '#adb5bd'
    };
    // Ordena as categorias por volume financeiro total
    const catsSorted = Object.keys(categorias).sort((a, b) => 
        (categorias[b].entrada + categorias[b].saida) - (categorias[a].entrada + categorias[a].saida)
    );

    const labels = catsSorted;
    const entradasData = catsSorted.map(cat => categorias[cat].entrada);
    const saidasData = catsSorted.map(cat => categorias[cat].saida);
    const backgroundColors = catsSorted.map(cat => coresMap[cat.trim()] || coresMap['Outros']); // <-- Correção e proteção contra espaços

    // Se não houver dados, impede a renderização de um gráfico vazio que quebraria o Chart.js
    if(labels.length === 0) {
        if (meuGrafico && typeof meuGrafico.destroy === 'function') { 
            meuGrafico.destroy(); 
        } 
        meuGrafico = null; // Garante a remoção da referência em cache global
        
        // CORREÇÃO: Limpa classes residuais de cores anteriores para o estado neutro
        balancoTxt.classList.remove('text-success', 'text-danger');
        balancoTxt.classList.add('text-dark');
        balancoTxt.innerText = "R$ 0,00";
        
        legendaHtml.innerHTML = '<p class="text-center text-muted py-4 small">Sem movimentações este mês.</p>';
        return;
    }
    // 2. Renderiza o Gráfico com dois anéis (Entradas por fora, Saídas por dentro)
    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Entradas',
                    data: entradasData,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 10,
                    cutout: '70%'
                },
                {
                    label: 'Saídas',
                    data: saidasData,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 10,
                    cutout: '65%'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            layout: { padding: 20 }
        }
    });
    // 3. Gera a Legenda Detalhada em HTML (estilo a imagem que você enviou)
        const templateLegenda = (cat, d) => {
        const balancoCat = d.entrada - d.saida;
        const totalCat = d.entrada + d.saida;
        
        // CORREÇÃO: Garante cálculo seguro contra divisão por zero se o volume total do mês for 0
        const volumeTotalMes = totalEntradas + totalSaidas;
        const perc = volumeTotalMes > 0 ? ((totalCat / volumeTotalMes) * 100).toFixed(0) + '%' : '0%';
        
        const cor = coresMap[cat] || coresMap['Outros'];
        
        return `
            <div class="list-group-item d-flex justify-content-between align-items-start border-0 rounded-3 p-3 mb-2 shadow-sm">
                <div class="icon-box bg-light border" style="color:${cor}; min-width: 45px;">
                    <i class="fas fa-tags"></i>
                </div>
                <div class="flex-grow-1 ms-3">
                    <div class="fw-bold text-dark d-flex justify-content-between">
                        ${escaparHTML(cat)}
                        <span class="${balancoCat >= 0 ? 'text-success' : 'text-danger'}" style="font-size: 0.8rem;">
                            ${balancoCat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                    <div class="d-flex justify-content-between mt-1" style="font-size: 0.7rem;">
                        <span class="text-success">↑ ${d.entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span class="text-danger">↓ ${d.saida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
                <div class="ms-2 fw-bold small text-muted">${perc}</div>
            </div>
        `;
    };

    legendaHtml.innerHTML = catsSorted.length ? catsSorted.map(cat => templateLegenda(cat, categorias[cat])).join('') 
        : '<p class="text-center text-muted py-4 small">Sem movimentações este mês.</p>';
}
// --- UTILITÁRIO DE MÁSCARA BRASILEIRA ---
function mascaraMoeda(event) {
    let value = event.target.value.replace(/\D/g, "");
    
    // Se não houver números, limpa o campo e sai da função
    if (!value) {
        event.target.value = "";
        return;
    }

    // Formata o valor em tempo real
    const options = { minimumFractionDigits: 2 };
    const result = new Intl.NumberFormat('pt-BR', options).format(
        parseFloat(value) / 100
    );

    event.target.value = result;
}
function prepararPagamentoCompra(id, modo) {
    const card = dados.cartoes.find(x => x.id == cartaoContexto);
    const compra = card.compras.find(c => c.id == id);
    
    const valorPagoJa = compra.pagamentos ? compra.pagamentos.reduce((a, b) => a + b.valor, 0) : 0;
    const saldoDevedor = compra.valorTotal - valorPagoJa;

    document.getElementById('pag-id').value = id;
    document.getElementById('pag-modo').value = modo + "-cartao"; // Diferenciador
    document.getElementById('pag-data').value = hojeISO();
    
    const campoValor = document.getElementById('pag-valor');
    const areaValor = document.getElementById('area-valor-pag');

    if (modo === 'total') {
        document.getElementById('tituloPagamento').innerText = "Quitar Compra";
        campoValor.value = saldoDevedor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        areaValor.classList.add('d-none');
    } else {
        document.getElementById('tituloPagamento').innerText = "Pagamento Parcial (Cartão)";
        campoValor.value = "";
        areaValor.classList.remove('d-none');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalPagamento')).show();
}
function processarLancamentosFixos() {
    const hoje = new Date();
    const mesAtual = hojeISO().substring(0, 7); // Ex: "2026-05"
    
    // Filtra todos os lançamentos marcados como fixos de meses anteriores
    const fixos = dados.movs.filter(m => m.fixo && m.data.substring(0, 7) < mesAtual);
    
    fixos.forEach(f => {
        // Verifica se já existe qualquer movimentação gerada para este mês com a mesma descrição original
        const jaExiste = dados.movs.some(m => m.desc.includes(f.desc) && m.data.startsWith(mesAtual));
        
        if (!jaExiste) {
            const diaOriginal = f.data.split('-')[2] ? f.data.split('-')[2].substring(0, 2) : "01";
            const novoLancamento = { 
                ...f, 
                id: Date.now() + Math.floor(Math.random() * 10000), 
                data: `${mesAtual}-${diaOriginal.padStart(2, '0')}`
            };
            dados.movs.push(novoLancamento);
        }
    });
    
    if (fixos.length > 0) salvarERender();
}
// --- SISTEMA DE METAS DE POUPANÇA ---

function salvarMeta() {
    if(!verificarAcesso()) return;

    const nome = document.getElementById('meta-nome').value.trim();
    const objRaw = document.getElementById('meta-objetivo').value;
    const inicio = document.getElementById('meta-data-inicio').value;
    const fim = document.getElementById('meta-data-fim').value;

    const objetivo = parseFloat(objRaw.replace(/\./g, '').replace(',', '.')) || 0;

    if (!nome || objetivo <= 0 || !inicio || !fim) {
        return alert("Preencha todos os campos da meta corretamente!");
    }

    const novaMeta = {
        id: Date.now(),
        nome: nome,
        objetivo: objetivo,
        guardado: 0,
        inicio: inicio,
        fim: fim,
        historico: [] // <-- Adicionado para guardar as movimentações da meta
    };

    dados.metas.push(novaMeta);
    salvarERender();

    // Limpa os campos do modal
    document.getElementById('meta-nome').value = '';
    document.getElementById('meta-objetivo').value = '';
    document.getElementById('meta-data-inicio').value = '';
    document.getElementById('meta-data-fim').value = '';
}

function renderMetas() {
    const lista = document.getElementById('lista-metas');
    if (!lista) return;

    lista.innerHTML = dados.metas.length ? dados.metas.map(m => {
        const progressoPerc = Math.min((m.guardado / m.objetivo) * 100, 100).toFixed(0);
        
        // Formata datas para exibição BR
        const dataIn = m.inicio.split('-').reverse().join('/');
        const dataAlvo = m.fim.split('-').reverse().join('/');

        return `
            <div class="col-12 col-md-6 mb-3">
                <div class="card p-3 border-0 shadow-sm rounded-4 bg-white">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold text-dark mb-0">${escaparHTML(m.nome)}</h6> <small class="text-muted" style="font-size: 0.75rem;">
                                ${dataIn} até ${dataAlvo}
                            </small>
                        </div>
                        <span class="badge bg-purple text-white">${progressoPerc}%</span>
                    </div>

                    <div class="d-flex justify-content-between my-2" style="font-size: 0.85rem;">
                        <span class="text-muted">Acumulado: <b class="text-success">R$ ${m.guardado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                        <span class="text-muted">Alvo: <b>R$ ${m.objetivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                    </div>

                    <div class="progress mb-2" style="height: 10px; border-radius: 10px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${progressoPerc}%; border-radius: 10px;"></div>
                    </div>

                    ${m.historico && m.historico.length > 0 ? `
                    <div class="mt-2 mb-3 p-2 bg-light rounded-3 border-start border-purple border-3 shadow-sm" style="font-size: 0.75rem; max-height: 100px; overflow-y: auto;">
                        <div class="text-uppercase fw-bold text-muted mb-1" style="font-size: 0.65rem;">Histórico da Meta:</div>
                        ${m.historico.map((h, index) => `
                            <div class="text-dark d-flex justify-content-between align-items-center py-1 border-bottom-dashed">
                                <span>${h.tipo === 'poupar' ? '<i class="fas fa-arrow-down text-success me-1"></i>Guardou' : '<i class="fas fa-arrow-up text-danger me-1"></i>Retirou'}: R$ ${h.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="text-muted" style="font-size: 0.7rem;">${h.data} às ${h.hora}</span>
                                    <button class="btn btn-sm text-danger p-0 border-0" onclick="excluirHistoricoMeta(${m.id}, ${index})" style="font-size: 0.85rem; line-height: 1;">&times;</button>
                                </div>
                            </div>
                        `).reverse().join('')}
                    </div>` : '<div class="text-muted text-center my-2" style="font-size: 0.75rem;">Nenhum depósito realizado.</div>'}

                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-success flex-grow-1" onclick="movimentarMeta(${m.id}, 'poupar')">
                            <i class="fas fa-piggy-bank me-1"></i> Poupar
                        </button>
                        <button class="btn btn-sm btn-outline-warning flex-grow-1" onclick="movimentarMeta(${m.id}, 'resgatar')">
                            <i class="fas fa-hand-holding-usd me-1"></i> Resgatar
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirMeta(${m.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('') : '<p class="text-center text-muted py-4 w-100">Nenhuma meta cadastrada ainda.</p>';
}

function movimentarMeta(id, acao) {
    if(!verificarAcesso()) return;

    const meta = dados.metas.find(m => m.id == id);
    if (!meta) return;

    const msg = acao === 'poupar' ? 'Quanto deseja guardar para esta meta?' : 'Quanto deseja resgatar desta meta?';
    const valorPrompt = prompt(msg);
    if (!valorPrompt) return;

    // Tratamento básico para converter input do usuário em float
    const valor = parseFloat(valorPrompt.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) return alert("Valor inválido!");

    const agora = new Date();
    const dataAtual = hojeISO();
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

    // Garante que o array de histórico exista mesmo em metas antigas
    if (!meta.historico) meta.historico = [];

    const dataFormatadaBR = dataAtual.split('-').reverse().join('/');

    // Cria o ID único antes para usar tanto no extrato quanto no histórico da meta
    const idMovimentoGerado = Date.now();

    if (acao === 'poupar') {
        meta.guardado += valor;
        
        // Registra no histórico interno da meta (com o ID do movimento vinculado)
        meta.historico.push({
            tipo: 'poupar',
            valor: valor,
            data: dataFormatadaBR,
            hora: horaAtual,
            idMovimento: idMovimentoGerado // <-- Adicionado
        });
        
        // Gera um débito automático no extrato (Dinheiro saiu do saldo e foi pro cofre)
        dados.movs.push({
            id: idMovimentoGerado, // <-- Atualizado
            desc: `Poupança: ${meta.nome}`,
            valor: valor,
            tipo: 'saida',
            cat: 'Outros',
            data: dataAtual,
            hora: horaAtual,
            fixo: false
        });
        alert(`R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} guardados com sucesso!`);
    } else {
        if (valor > meta.guardado) return alert("Saldo insuficiente na meta para resgate!");
        meta.guardado -= valor;

        // Registra no histórico interno da meta
        meta.historico.push({
            tipo: 'resgatar',
            valor: valor,
            data: dataFormatadaBR,
            hora: horaAtual
        });

        // Gera um crédito automático no extrato (Dinheiro voltou para o saldo geral)
        dados.movs.push({
            id: Date.now(),
            desc: `Resgate: ${meta.nome}`,
            valor: valor,
            tipo: 'entrada',
            cat: 'Outros',
            data: dataAtual,
            hora: horaAtual,
            fixo: false
        });
        alert(`R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} resgatados para o seu saldo!`);
    }
    salvarERender();
}
function excluirHistoricoMeta(metaId, index) {
    if (!confirm("Tem certeza que deseja apagar este registro do histórico? O saldo da meta será corrigido automaticamente.")) return;

    // CORREÇÃO: Usa a variável global 'dados' que o seu app já inicializou no topo do arquivo
    let meta = dados.metas.find(m => m.id === metaId);

    if (!meta || !meta.historico || !meta.historico[index]) return;

    const itemModificado = meta.historico[index];

    // Faz o estorno reverso no saldo guardado da meta
    if (itemModificado.tipo === 'poupar') {
        meta.guardado -= itemModificado.valor;
    } else if (itemModificado.tipo === 'resgatar') {
        meta.guardado += itemModificado.valor;
    }

    // Remove o item específico do histórico usando o index
    meta.historico.splice(index, 1);

    // SINCRONIZAÇÃO COM O EXTRATO:
    // 1º Tenta remover pelo ID vinculado (para novos registros)
    if (itemModificado.idMovimento) {
        dados.movs = dados.movs.filter(m => m.id !== itemModificado.idMovimento);
    } else {
        // 2º Se for um registro antigo sem ID, busca por descrição aproximada, valor e tipo para não deixar órfão
        const textoBusca = itemModificado.tipo === 'poupar' ? `Poupança: ${meta.nome}` : `Resgate: ${meta.nome}`;
        const idxExtrato = dados.movs.findIndex(m => m.desc === textoBusca && m.valor === itemModificado.valor);
        if (idxExtrato > -1) {
            dados.movs.splice(idxExtrato, 1);
        }
    }

    // Salva tudo e atualiza as telas de forma síncrona
    salvarERender();
}
function excluirMeta(id) {
    if (confirm("Deseja realmente excluir esta meta? O valor guardado não será devolvido automaticamente ao saldo geral.")) {
        const idNumerico = Number(id); // <-- Normalização para garantir tipagem estrita
        dados.metas = dados.metas.filter(m => m.id !== idNumerico);
        salvarERender();
    }
}
// Logica da Calculadora
let calcExpressao = '';

function toggleCalculadora() {
    const calc = document.getElementById('calc-container');
    calc.style.display = calc.style.display === 'none' ? 'flex' : 'none';
}

function calcAdd(valor) {
    const display = document.getElementById('calc-display');
    if (display.value === '0' && valor !== '.') calcExpressao = '';
    calcExpressao += valor;
    display.value = calcExpressao;
}

function calcLimpar() {
    calcExpressao = '';
    document.getElementById('calc-display').value = '0';
}

function calcApagar() {
    calcExpressao = calcExpressao.slice(0, -1);
    document.getElementById('calc-display').value = calcExpressao || '0';
}

function calcResultado() {
    if (!calcExpressao) return;
    try {
        if (/[^0-9\+\-\*\/\.\(\)]/.test(calcExpressao)) throw new Error("Invalido");
        
        // Alteração segura: Evita a criação dinâmica com template strings para prevenir injeção de código
        let res = Function('"use strict"; return (' + calcExpressao + ')')();
        
        if (res === undefined || isNaN(res) || !isFinite(res)) throw new Error("Erro");
        if (!Number.isInteger(res)) res = parseFloat(res.toFixed(2));
        document.getElementById('calc-display').value = res;
        calcExpressao = res.toString();
    } catch (e) {
        document.getElementById('calc-display').value = 'Erro';
        calcExpressao = '';
    }
}
// Tornar a Janela Arrastável - Atribuição limpa usando as globais já existentes
// (Removidas as constantes duplicadas que causavam o travamento)

const startDrag = (e) => {
    isDragging = true;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    offset.x = clientX - calcContainer.offsetLeft;
    offset.y = clientY - calcContainer.offsetTop;
};

const onDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault(); // Evita seleção de textos indesejada enquanto arrasta
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    calcContainer.style.left = (clientX - offset.x) + 'px';
    calcContainer.style.top = (clientY - offset.y) + 'px';
    calcContainer.style.right = 'auto';
};
// --- LÓGICA DO BLOCO DE NOTAS ---
let notas = (() => { try { return JSON.parse(localStorage.getItem('financas_notas')) || []; } catch (e) { return []; } })();

function abrirModalNota(id = null) {
    if(!verificarAcesso()) return;
    
    const modal = new bootstrap.Modal(document.getElementById('modalNota'));
    const nota = id ? notas.find(n => n.id === id) : null;

    // Resetar campos
        document.getElementById('nota-id-edit').value = id || '';
    document.getElementById('nota-titulo').value = nota ? nota.titulo : '';
    document.getElementById('nota-texto').value = nota ? nota.texto : '';
    
    const elFixado = document.getElementById('nota-fixada');
    if (elFixado) elFixado.value = nota ? String(nota.fixada) : 'false';
    // Configurar cor
    const corPadrao = nota ? nota.cor : '#ffffff';
    selecionarCorNota(corPadrao);

    // Configurar ícone de fixar
    const btnFixar = document.getElementById('btn-fixar-nota');
    if (nota && nota.fixada) {
        btnFixar.classList.add('active');
    } else {
        btnFixar.classList.remove('active');
    }

    // Mostrar/Esconder botões de ação
    document.getElementById('modalNotaTitulo').innerText = id ? 'Editar Nota' : 'Nova Nota';
    document.getElementById('btn-excluir-nota').classList.toggle('d-none', !id);
    document.getElementById('btn-copiar-nota').classList.toggle('d-none', !id);

    modal.show();
}

function selecionarCorNota(cor) {
    document.getElementById('nota-cor-fundo').value = cor;
    document.getElementById('cor-fundo-modal-nota').style.backgroundColor = cor;
}

function toggleFixarNota() {
    const inputFixar = document.getElementById('nota-fixada');
    const btnFixar = document.getElementById('btn-fixar-nota');
    const estaFixada = inputFixar.value === 'true';

    inputFixar.value = estaFixada ? 'false' : 'true';
    btnFixar.classList.toggle('active');
}

function salvarNota() {
    if(!verificarAcesso()) return;
    
    const id = document.getElementById('nota-id-edit').value;
    const titulo = document.getElementById('nota-titulo').value.trim();
    const texto = document.getElementById('nota-texto').value.trim();
    const cor = document.getElementById('nota-cor-fundo').value;
    const fixada = document.getElementById('nota-fixada').value === 'true';

    if (!titulo && !texto) return; // Não salva nota vazia

    if (id) {
        // Editar
        const index = notas.findIndex(n => n.id == id);
        notas[index] = { ...notas[index], titulo, texto, cor, fixada };
    } else {
        // Nova nota
        const novaNota = {
            id: Date.now(),
            titulo,
            texto,
            cor,
            fixada,
            data: new Date().toISOString()
        };
        notas.push(novaNota);
    }

            localStorage.setItem('financas_notas', JSON.stringify(notas));
    bootstrap.Modal.getInstance(document.getElementById('modalNota')).hide();
    renderizarNotas();
}

function renderizarNotas() {
    const listaGeral = document.getElementById('lista-notas');
    const listaFixadas = document.getElementById('lista-notas-fixadas');
    const containerFixadas = document.getElementById('container-notas-fixadas');
    const tituloOutras = document.getElementById('titulo-outras-notas');
    const vazio = document.getElementById('notas-vazio');

    // Se os elementos não existirem na tela atual, interrompe a função pacificamente
    if (!listaGeral || !listaFixadas || !vazio || !containerFixadas) return;

    listaGeral.innerHTML = '';
    listaFixadas.innerHTML = '';

    if (notas.length === 0) {
        vazio.classList.remove('d-none');
        containerFixadas.classList.add('d-none');
        return;
    }
    vazio.classList.add('d-none');

    // Separar fixadas de normais
    const fixadas = notas.filter(n => n.fixada);
    const normais = notas.filter(n => !n.fixada);

        containerFixadas.classList.toggle('d-none', fixadas.length === 0);
    // O título de outras notas só aparece se existirem notas fixadas E também notas normais ao mesmo tempo
    tituloOutras.classList.toggle('d-none', fixadas.length === 0 || normais.length === 0);

        const criarCard = (nota) => `
        <div class="col-6 col-md-4 mb-3">
            <div class="nota-card shadow-sm position-relative text-start" style="background-color: ${nota.cor}; min-height: 120px; border-radius: 15px; overflow: hidden;">
                
                <div class="dropdown position-absolute top-0 end-0 m-2" style="z-index: 10;">
                    <button class="btn btn-link text-muted p-1 lh-1 border-0 shadow-none" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-ellipsis-v" style="font-size: 0.9rem;"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: 0.85rem;">
                        <li>
                            <button class="dropdown-item py-2" onclick="copiarNotaRapida(${nota.id})">
                                <i class="fas fa-copy text-secondary me-2"></i> Copiar Texto
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item py-2 text-danger" onclick="event.stopPropagation(); excluirNotaDireta(${nota.id})">
                                <i class="fas fa-trash-alt me-2"></i> Excluir Nota
                            </button>
                        </li>
                    </ul>
                </div>

                <div onclick="abrirModalNota(${nota.id})" class="w-100 p-3 pt-4" style="cursor: pointer; min-height: 120px;">
                    ${nota.fixada ? '<i class="fas fa-thumbtack pin-icon mb-1 d-block text-muted" style="font-size: 0.8rem;"></i>' : ''}
                    <div class="nota-titulo-card fw-bold text-dark text-truncate pe-3" style="font-size: 0.95rem; line-height: 1.2;">${escaparHTML(nota.titulo || 'Sem título')}</div>
                    <div class="nota-resumo-card text-muted mt-1 small text-wrap text-break pe-2" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escaparHTML(nota.texto || '')}</div>
                </div>

            </div>
        </div>
    `;
    fixadas.forEach(n => listaFixadas.innerHTML += criarCard(n));
    normais.forEach(n => listaGeral.innerHTML += criarCard(n));
}

function excluirNota() {
    const id = document.getElementById('nota-id-edit').value;
    if (confirm('Deseja excluir esta nota permanentemente?')) {
        notas = notas.filter(n => n.id != id);
        localStorage.setItem('financas_notas', JSON.stringify(notas));
        bootstrap.Modal.getInstance(document.getElementById('modalNota')).hide();
        renderizarNotas();
    }
}

function copiarNota() {
    const texto = document.getElementById('nota-texto').value;
    navigator.clipboard.writeText(texto).then(() => {
        alert('Texto copiado para a área de transferência!');
    });
}
// Remove automaticamente os itens do histórico quitado que passaram de 30 dias
function limparHistoricoAntigo() {
    if (!dados.historicoQuitados) return;
    
    const trintaDiasEmMs = 30 * 24 * 60 * 60 * 1000;
    const agora = Date.now();
    
    // Filtra mantendo apenas o que tem menos de 30 dias de quitado
    const totalAntes = dados.historicoQuitados.length;
    dados.historicoQuitados = dados.historicoQuitados.filter(item => {
        if (!item.dataQuitacaoMs) return true; // Se não tiver a marca de tempo, mantém por segurança
        return (agora - item.dataQuitacaoMs) < trintaDiasEmMs;
    });
    
    if (dados.historicoQuitados.length !== totalAntes) {
        salvarERender(); // Garante que a remoção automática seja salva usando sua função nativa correta
    }
}
// Renderiza a lista de histórico de dívidas quitadas na interface
function renderizarHistoricoDividas() {
    const lista = document.getElementById('lista-historico-dividas');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    if (!dados.historicoQuitados || dados.historicoQuitados.length === 0) {
        lista.innerHTML = `<div class="text-center text-muted py-3">Nenhuma dívida quitada nos últimos 30 dias.</div>`;
        return;
    }
    
    // Renderiza do mais recente para o mais antigo
    [...dados.historicoQuitados].reverse().forEach((item) => {
        const tipoBadge = item.tipo === 'eu-devo' ? 'bg-danger' : 'bg-success';
        const tipoTexto = item.tipo === 'eu-devo' ? 'Eu devia' : 'Me deviam';
        const dataVisual = item.dataQuitacaoMs ? new Date(item.dataQuitacaoMs).toLocaleDateString('pt-BR') : '---';
        
        const card = document.createElement('div');
        card.className = 'card-mov p-3 mb-2';
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center w-100">
                <div>
                    <span class="badge ${tipoBadge} mb-1">${tipoTexto}</span>
                    <h6 class="mb-0 fw-bold text-main">${escaparHTML(item.nome || item.desc || 'Sem nome')}</h6>
                    <small class="text-muted d-block" style="font-size: 0.75rem;">Quitado em: ${dataVisual}</small>
                </div>
                <div class="text-end d-flex align-items-center gap-3">
                    <span class="fw-bold money-value text-muted">R$ ${parseFloat(item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="excluirItemHistoricoManual(${item.id})" title="Mover para a lixeira">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
        lista.appendChild(card);
    });
}

// Modificado para enviar para a lixeira em vez de deletar direto
function excluirItemHistoricoManual(id) {
    if (confirm("Deseja mover este registro do histórico para a lixeira?")) {
        const idNumerico = Number(id);
        const idx = dados.historicoQuitados.findIndex(item => item.id === idNumerico);
        if (idx === -1) return;
        const item = dados.historicoQuitados.splice(idx, 1)[0];
        item.origem = 'historicoQuitados'; // Identificador para restauração
        item.lixeiraTitulo = `Quitada: ${item.nome || 'Dívida'}`; // Nome visível na lixeira
        dados.lixeira.push(item);
        
        salvarERender();
        renderizarHistoricoDividas();
    }
}
// Adicionar esta função isolada no escopo global do script:
function escaparHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function excluirNotaDireta(id) {
    if (confirm('Deseja excluir esta nota permanentemente?')) {
        notas = notas.filter(n => n.id != id);
        localStorage.setItem('financas_notas', JSON.stringify(notas));
        renderizarNotas();
    }
}

function copiarNotaRapida(id) {
    const nota = notas.find(n => n.id == id);
    if (!nota || !nota.texto) return alert('Esta nota não possui texto para copiar.');
    
    navigator.clipboard.writeText(nota.texto).then(() => {
        alert('Texto copiado para a área de transferência!');
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
    });
}
// Função auxiliar para capturar a mudança do select unificado
function tratarFiltroEOrdenacao(valor) {
    if (valor.startsWith('status-')) {
        // Extrai o status (todas, pendentes ou vencidas)
        const status = valor.replace('status-', '');
        statusDividaAtual = status; // <-- Define a variável global do filtro de status diretamente
        renderDividas(); // <-- Renderiza a tela aplicando o filtro imediatamente
    } else {
        // CORREÇÃO: Aplica a nova ordenação na variável global usada por renderDividas()
        ordemDividaAtual = valor;
        if (typeof renderDividas === 'function') {
            renderDividas(); 
        }
    }
}

function anteciparParcelaModal(idCompra) {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto));
    const compra = card.compras.find(c => c.id == idCompra);
    const valorParcela = compra.valorTotal / compra.parcelas;
    
    if(!compra.pagamentos) compra.pagamentos = [];
    
    // Identifica quantas parcelas já foram amortizadas no total (seja por pagamento regular ou antecipação)
    let qtdJaPaga = compra.pagamentos.length;
    
    // Filtra dinamicamente os índices restantes baseando-se no saldo de parcelas abertas
    let parcelasDisponiveis = [];
    for(let i = qtdJaPaga; i < compra.parcelas; i++) {
        parcelasDisponiveis.push(i);
    }
    
    if(parcelasDisponiveis.length === 0) {
        return alert("Todas as parcelas desta compra já foram quitadas!");
    }
    
    // Pergunta ao usuário quantas ele deseja antecipar
    const qtdPrompt = prompt(`Esta compra possui ${parcelasDisponiveis.length} parcela(s) em aberto.\nQuantas parcelas você deseja antecipar?`);
    if (!qtdPrompt) return;
    
    const qtdAntecipar = parseInt(qtdPrompt);
    if (isNaN(qtdAntecipar) || qtdAntecipar <= 0 || qtdAntecipar > parcelasDisponiveis.length) {
        return alert("Quantidade inválida ou maior do que as parcelas restantes!");
    }
    
        const valorTotalAntecipacao = valorParcela * qtdAntecipar;
    // Inverte ou pega as últimas parcelas do final do contrato (de trás para frente)
    const parcelasSelecionadas = parcelasDisponiveis.slice(-qtdAntecipar);

    // Texto descritivo para o aviso (ex: "parcelas 2, 3 e 4")
    const numParcelasTexto = parcelasSelecionadas.map(n => n + 1).join(', ');
    
    if(confirm(`Confirmar a antecipação de ${qtdAntecipar} parcela(s) (Nº: ${numParcelasTexto}) no valor total de R$ ${valorTotalAntecipacao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}?`)) {
        const agora = new Date();
        const dataFormatada = agora.toLocaleDateString('pt-BR');
        const horaPagto = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
        
        // Registra cada uma das parcelas individualmente no histórico da compra
        parcelasSelecionadas.forEach(indexParcela => {
            compra.pagamentos.push({
                valor: valorParcela,
                data: dataFormatada,
                hora: horaPagto,
                numParcela: Number(indexParcela), // Garante tipo estrito
                antecipada: true
            });
        });
        
        // Cria um único débito no extrato com o valor somado das antecipações
        dados.movs.push({
            id: Date.now(),
            desc: `Antecipou ${qtdAntecipar}x: ${compra.desc} (Parc. ${numParcelasTexto})`,
            valor: valorTotalAntecipacao,
            tipo: 'saida',
            cat: 'Cartão',
            data: hojeISO(),
            hora: horaPagto
        });
        
        alert(`${qtdAntecipar} parcela(s) antecipada(s) com sucesso!`);
        salvarERender();
        renderComprasCartao();
    }
}
// Função para navegar entre os meses pelas setas do cabeçalho
function alterarMesNav(direcao) {
    const inputMes = document.getElementById('mes-atual');
    if (!inputMes || !inputMes.value) return;

    // Separa o ano e o mês atual do input em números
    let [ano, mes] = inputMes.value.split('-').map(Number);
    
    // Altera o mês (direcao pode ser 1 para avançar ou -1 para voltar)
    mes += direcao;

    // Ajusta a virada do ano
    if (mes < 1) {
        mes = 12;
        ano -= 1;
    } else if (mes > 12) {
        mes = 1;
        ano += 1;
    }

    // Atualiza o valor do campo de texto com o novo mês formatado
    inputMes.value = `${ano}-${String(mes).padStart(2, '0')}`;
    
    // Dispara o evento 'change' manualmente para atualizar os gráficos, extratos e cartões
    inputMes.dispatchEvent(new Event('change'));
}
// Função responsável por injetar o nome do usuário nos elementos do HTML de forma segura
function atualizarNomeUsuarioTela(nome) {
    if (!nome) nome = "Visitante";
    
    // Altere os IDs abaixo caso os seus no HTML tenham nomes diferentes
    const elSidebar = document.getElementById("txt-nome-usuario-sidebar");
    if (elSidebar) {
        elSidebar.innerText = nome;
    }

    const elPerfil = document.getElementById("txt-perfil-nome-exibicao");
    if (elPerfil) {
        elPerfil.innerText = nome;
    }
}


/* ==============================================================================
 * 02. Base: datas, login/segurança, backup, revenda, lixeira, notificações
 * ============================================================================ */
// ---------- Utilitários ----------
function hojeISO() { // data LOCAL (o toISOString original usava UTC e virava o dia às 21h)
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function ordemMov(a, b) { return (b.data || '').localeCompare(a.data || '') || (b.hora || '').localeCompare(a.hora || '') || (b.id - a.id); }
window.escaparHTML = function escaparHTML(s) {
    return (s === undefined || s === null) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};
function brl(v) { return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function lerMoeda(id) { return parseFloat((document.getElementById(id).value || '').replace(/\./g, '').replace(',', '.')) || 0; }
function ehVisitante() { return sessionStorage.getItem('user_ativo') === 'visitante' || usuarioAtivo === 'visitante'; }

// Proteção global: o modo visitante NUNCA pode sobrescrever os dados reais (toggleTema/olho faziam isso)
const _setItemOriginal = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) {
    if (this === localStorage && (k === 'financas_pro_max' || k === 'financas_notas') && ehVisitante()) return;
    return _setItemOriginal.call(this, k, v);
};

// ---------- Lançamentos ----------
const _salvarMovOriginal = window.salvarMov;
window.salvarMov = function () {
    if (!document.getElementById('mov-desc').value.trim() || lerMoeda('mov-valor') <= 0) {
        return alert('Informe a descrição e um valor maior que zero.');
    }
    _salvarMovOriginal();
};

window.moverMovParaLixeira = function moverMovParaLixeira() {
    const id = Number(document.getElementById('mov-id-edit').value);
    const idx = dados.movs.findIndex(m => m.id === id);
    if (idx < 0 || !confirm('Deseja enviar para a lixeira?')) return;
    const item = dados.movs.splice(idx, 1)[0];
    if (item.fixo && item.data) { // evita que o lançamento fixo "ressuscite" no mesmo mês
        (dados.fixosIgnorados = dados.fixosIgnorados || []).push(item.tipo + '|' + item.desc + '|' + item.data.substring(0, 7));
    }
    item.origem = 'movs';
    item.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(item);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalMov')); if (m) m.hide();
};

// Recorrência: preenche TODOS os meses que faltam (não só o atual), sem duplicar e respeitando exclusões
window.processarLancamentosFixos = function processarLancamentosFixos() {
    const ym = hojeISO().substring(0, 7);
    const ign = (dados.fixosIgnorados = dados.fixosIgnorados || []);
    const grupos = {};
    dados.movs.forEach(m => {
        if (!m.data || !m.desc) return;
        const k = m.tipo + '|' + m.desc;
        if (!grupos[k] || m.data > grupos[k].data) grupos[k] = m;
    });
    let mudou = false;
    Object.values(grupos).forEach(t => {
        if (!t.fixo) return; // desmarcar "Fixo" no lançamento mais recente cancela a repetição
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
};

// ---------- Lixeira ----------
window.restaurarDaLixeira = function restaurarDaLixeira(id) {
    const i = dados.lixeira.findIndex(m => m.id === Number(id));
    if (i < 0) return;
    const it = dados.lixeira.splice(i, 1)[0];
    const dest = it.origem || 'movs';
    delete it.origem; delete it.deletadoEm; delete it.lixeiraTitulo;
    (dados[dest] = dados[dest] || []).push(it);
    salvarERender(); renderLixeira();
};

// ---------- Dívidas ----------
window.excluirDivida = function excluirDivida() {
    const id = Number(document.getElementById('div-id-edit').value);
    const i = dados.dividas.findIndex(d => d.id === id);
    if (i < 0 || !confirm('Mover este registro para a lixeira?')) return;
    const it = dados.dividas.splice(i, 1)[0];
    it.origem = 'dividas'; it.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(it);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalDivida')); if (m) m.hide();
};

const _confirmarPagamentoOriginal = window.confirmarPagamento;
window.confirmarPagamento = function () {
    const modo = document.getElementById('pag-modo').value;
    const id = Number(document.getElementById('pag-id').value);
    const v = lerMoeda('pag-valor');
    if (modo === 'parcial' || modo === 'parcial-cartao') {
        if (v <= 0) return alert('Informe um valor maior que zero.');
        if (modo === 'parcial-cartao') {
            const card = dados.cartoes.find(x => x.id == cartaoContexto);
            const c = card && card.compras.find(x => x.id === id);
            const restante = c ? c.valorTotal - (c.pagamentos || []).reduce((s, p) => s + p.valor, 0) : 0;
            if (v > restante + 0.005) return alert('O valor é maior que o saldo restante desta compra (' + brl(restante) + ').');
        } else {
            const d = dados.dividas.find(x => x.id === id);
            if (d && v >= d.valor) document.getElementById('pag-modo').value = 'total'; // pagou tudo = quitada (antes ficava com saldo 0 para sempre)
        }
    }
    _confirmarPagamentoOriginal();
};

const _tratarFiltroOriginal = window.tratarFiltroEOrdenacao;
window.tratarFiltroEOrdenacao = function (v) {
    _tratarFiltroOriginal(v);
    if (v.startsWith('status-')) {
        const sel = document.getElementById('ordenar-divida'); if (sel) sel.value = v;
        document.querySelectorAll('#filtros-rapidos-status .btn-status-filter').forEach(b => {
            const m = (b.getAttribute('onclick') || '').match(/'([^']+)'/);
            b.classList.toggle('active', !!m && m[1] === v);
        });
    }
};
const _limparFiltrosOriginal = window.limparFiltrosDivida;
window.limparFiltrosDivida = function () { _limparFiltrosOriginal(); window.tratarFiltroEOrdenacao('status-todas'); };

// ---------- Metas ----------
const _salvarMetaOriginal = window.salvarMeta;
window.salvarMeta = function () {
    const ini = document.getElementById('meta-data-inicio').value, fim = document.getElementById('meta-data-fim').value;
    if (ini && fim && fim < ini) return alert('A data alvo não pode ser anterior à data de início.');
    const n = dados.metas.length;
    _salvarMetaOriginal();
    if (dados.metas.length > n) { const m = bootstrap.Modal.getInstance(document.getElementById('modalMeta')); if (m) m.hide(); }
};

// ---------- Calculadora ----------
const _calcResultadoOriginal = window.calcResultado;
window.calcResultado = function () { // "05+3" quebrava (zero à esquerda = erro de sintaxe)
    calcExpressao = calcExpressao.replace(/(^|[^\d.])0+(?=\d)/g, '$1');
    _calcResultadoOriginal();
};

// ---------- Notificações (virada de mês, vencidas, backup real) ----------
function coletarAvisos() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const lim = new Date(hoje); lim.setDate(lim.getDate() + 3);
    const av = [];
    dados.dividas.forEach(d => {
        if (!d.prazo) return;
        const p = new Date(d.prazo + 'T00:00:00'), dt = d.prazo.split('-').reverse().join('/');
        if (p < hoje) av.push('[erro] VENCIDA: ' + d.nome + ' (' + dt + ')');
        else if (p <= new Date(hoje.getTime() + (parseInt(d.lembrete) || 3) * 864e5)) av.push('[aviso] ' + (d.tipo === 'eu-devo' ? 'A PAGAR' : 'A RECEBER') + ': ' + d.nome + ' vence ' + dt);
    });
    dados.cartoes.forEach(c => {
        const v = parseInt(c.vence); if (!v) return;
        for (let i = 0; i <= 3; i++) { const x = new Date(hoje); x.setDate(x.getDate() + i); if (x.getDate() === v) { av.push('[cartao] Fatura do ' + c.nome + ' vence dia ' + v); break; } }
    });
    const mes = document.getElementById('mes-atual').value; let ent = 0, sai = 0;
    dados.movs.filter(m => m.data && m.data.startsWith(mes)).forEach(m => { if (m.tipo === 'entrada') ent += m.valor; else sai += m.valor; });
    if (ent > 0 && sai > ent * 0.8) av.push('[grafico] Você já gastou ' + Math.round(sai / ent * 100) + '% das receitas de ' + mes.split('-').reverse().join('/') + '.');
    const ub = dados.config.ultimoBackup;
    if (dados.movs.length > 20 && (!ub || Date.now() - ub > 30 * 864e5)) av.push('[backup] Faça um backup: Menu → Sistema e Backup → Exportar Dados.');
    return av;
}
window.verificarNotificacoes = function verificarNotificacoes() {
    if (!document.getElementById('mes-atual')) return;
    const n = coletarAvisos().length, b = document.getElementById('badge-notificacao');
    if (b) { b.innerText = n; b.classList.toggle('d-none', n === 0); }
};
window.abrirNotificacoes = function abrirNotificacoes() {
    const a = coletarAvisos();
    alert(a.length ? 'CENTRAL DE LEMBRETES:\n\n' + a.join('\n\n') : 'Tudo sob controle! Nenhuma pendência urgente.');
};

// ---------- Backup / Importar / Zerar ----------
window.exportarBackup = function exportarBackup() {
    dados.config.ultimoBackup = Date.now();
    localStorage.setItem('financas_pro_max', JSON.stringify(dados));
    const pacote = { ...dados, notas: (typeof notas !== 'undefined' ? notas : []), _exportadoEm: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(pacote)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'backup_financas_' + hojeISO() + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    verificarNotificacoes();
};
window.abrirImportar = function abrirImportar() {
    if (!verificarAcesso()) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = ev => {
            try {
                const n = JSON.parse(ev.target.result);
                if (!n || typeof n !== 'object' || Array.isArray(n) || !Array.isArray(n.movs)) throw new Error('formato');
                ['cartoes', 'dividas', 'metas', 'lixeira', 'historicoQuitados', 'revenda', 'fixosIgnorados', 'clientes'].forEach(k => { if (!Array.isArray(n[k])) n[k] = []; });
                if (!n.config || typeof n.config !== 'object') n.config = { dark: false, oculto: false };
                if (!confirm('Importar ' + n.movs.length + ' lançamentos? Isso SUBSTITUI todos os dados atuais deste aparelho.')) return;
                const nn = Array.isArray(n.notas) ? n.notas : null; delete n.notas; delete n._exportadoEm;
                localStorage.setItem('financas_pro_max', JSON.stringify(n));
                if (nn) localStorage.setItem('financas_notas', JSON.stringify(nn));
                location.reload();
            } catch (err) { alert('Arquivo inválido! Use um backup exportado pelo próprio app.'); }
        };
        rd.readAsText(f);
    };
    inp.click();
};
window.resetarApp = function resetarApp() {
    if (!verificarAcesso()) return;
    if (!confirm('Isso apaga TODOS os dados e a conta deste aparelho. Exporte um backup antes. Continuar?')) return;
    if (!confirm('Última confirmação: apagar tudo de forma definitiva?')) return;
    ['financas_pro_max', 'financas_notas', 'financas_auth', 'user_lembrado'].forEach(k => localStorage.removeItem(k));
    sessionStorage.clear(); location.reload();
};

// ---------- Autenticação (senha e resposta agora são guardadas com hash + salt) ----------
/*SHA_START*/
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
/*SHA_END*/
function hashSenha(s, salt) { return sha256(unescape(encodeURIComponent(salt + '|' + s))); }
function normResp(r) { return String(r).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function getAuth() { try { return JSON.parse(localStorage.getItem('financas_auth')); } catch (e) { return null; } }
function salvarAuth(a) { localStorage.setItem('financas_auth', JSON.stringify(a)); }
function conferirSenha(a, p) { return a.passHash ? hashSenha(p, a.salt) === a.passHash : a.pass === p; }
function conferirResposta(a, r) { return a.respHash ? hashSenha(normResp(r), a.salt) === a.respHash : String(a.resposta) === r.trim().toLowerCase(); }
function migrarAuth(a) { // contas antigas (texto puro) são convertidas automaticamente no primeiro login
    if (a.passHash) return a;
    a.salt = Date.now().toString(36) + Math.random().toString(36).slice(2);
    a.passHash = hashSenha(a.pass || '', a.salt);
    a.respHash = hashSenha(normResp(a.resposta || ''), a.salt);
    delete a.pass; delete a.resposta;
    return a;
}
window.cadastrarUsuario = function cadastrarUsuario() {
    const u = document.getElementById('user-reg').value.trim(), p = document.getElementById('pass-reg').value.trim();
    const q = document.getElementById('pergunta-reg').value, r = document.getElementById('resposta-reg').value.trim();
    if (!u || !p || !r) return alert('Preencha todos os campos!');
    if (p.length < 4) return alert('A senha precisa ter pelo menos 4 caracteres.');
    if (getAuth()) return alert('Já existe uma conta neste aparelho. Use "Esqueci a senha" para redefinir o acesso.');
    const salt = Date.now().toString(36) + Math.random().toString(36).slice(2);
    salvarAuth({ user: u, salt, passHash: hashSenha(p, salt), pergunta: q, respHash: hashSenha(normResp(r), salt) });
    alert('Conta criada com sucesso!'); toggleAuth('login');
};
window.fazerLogin = function fazerLogin() {
    const u = document.getElementById('user-login').value.trim(), p = document.getElementById('pass-login').value.trim();
    const a = getAuth();
    if (!a) return alert('Nenhuma conta encontrada! Por favor, cadastre-se.');
    if (u !== a.user || !conferirSenha(a, p)) return alert('Usuário ou senha incorretos!');
    salvarAuth(migrarAuth(a));
    if (document.getElementById('lembrar-login').checked) localStorage.setItem('user_lembrado', u); else localStorage.removeItem('user_lembrado');
    sessionStorage.setItem('user_ativo', u); usuarioAtivo = u;
    atualizarNomeUsuarioTela(u);
    document.getElementById('tela-login').style.display = 'none';
    processarLancamentosFixos(); renderTudo();
};
window.validarRespostaSeguranca = function validarRespostaSeguranca() {
    const a = getAuth();
    if (a && conferirResposta(a, document.getElementById('resposta-rec').value)) {
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'block';
    } else alert('Resposta incorreta!');
};
window.redefinirSenha = function redefinirSenha() {
    const np = document.getElementById('nova-pass-rec').value.trim();
    if (np.length < 4) return alert('A nova senha precisa ter pelo menos 4 caracteres.');
    const a = migrarAuth(getAuth());
    a.passHash = hashSenha(np, a.salt); salvarAuth(a);
    alert('Senha alterada! Faça login novamente.'); toggleAuth('login');
};
window.atualizarPerfilUsuario = function atualizarPerfilUsuario() {
    if (!verificarAcesso()) return;
    let a = getAuth(); if (!a) return alert('Conta não encontrada!');
    const nu = document.getElementById('novo-user-perfil').value.trim(), np = document.getElementById('nova-pass-perfil').value.trim();
    if (!nu) return alert('O campo de usuário não pode ficar vazio!');
    if (!conferirSenha(a, document.getElementById('senha-atual-perfil').value.trim())) return alert('Senha atual incorreta!');
    if (np && np.length < 4) return alert('A nova senha precisa ter pelo menos 4 caracteres.');
    a = migrarAuth(a); a.user = nu;
    if (np) a.passHash = hashSenha(np, a.salt);
    salvarAuth(a);
    if (localStorage.getItem('user_lembrado')) localStorage.setItem('user_lembrado', nu);
    sessionStorage.setItem('user_ativo', nu); usuarioAtivo = nu; atualizarNomeUsuarioTela(nu);
    document.getElementById('nova-pass-perfil').value = ''; document.getElementById('senha-atual-perfil').value = '';
    alert('Perfil atualizado com sucesso!');
};

// ---------- Controle de Revenda (a tela existia, mas NENHUMA função estava implementada) ----------
function abrirModalRevenda(id) {
    if (!verificarAcesso()) return;
    dados.revenda = dados.revenda || [];
    const p = id ? dados.revenda.find(x => x.id === Number(id)) : null;
    const set = (k, v) => { document.getElementById(k).value = v; };
    const m2 = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    set('revenda-id-edit', p ? p.id : ''); set('revenda-nome', p ? p.nome : ''); set('revenda-cat', p ? p.cat : 'Outros');
    set('revenda-vlr-compra', p ? m2(p.compra) : ''); set('revenda-vlr-venda', p ? m2(p.venda) : ''); set('revenda-qtd', p ? p.qtd : 1);
    document.getElementById('btn-excluir-revenda').classList.toggle('d-none', !p);
    const el = document.getElementById('modalProdutoRevenda');
    (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show();
}
function salvarProdutoRevenda() {
    if (!verificarAcesso()) return;
    const nome = document.getElementById('revenda-nome').value.trim(), compra = lerMoeda('revenda-vlr-compra'), venda = lerMoeda('revenda-vlr-venda');
    const qtd = parseInt(document.getElementById('revenda-qtd').value) || 0;
    if (!nome || venda <= 0 || qtd < 1) return alert('Informe o nome, o valor de venda e a quantidade (mínimo 1).');
    dados.revenda = dados.revenda || [];
    const id = Number(document.getElementById('revenda-id-edit').value) || 0;
    const antigo = id ? dados.revenda.find(x => x.id === id) : null;
    const p = { id: id || Date.now(), nome, cat: document.getElementById('revenda-cat').value, compra, venda, qtd, vendidos: antigo ? (antigo.vendidos || 0) : 0 };
    const idx = dados.revenda.findIndex(x => x.id === p.id);
    if (idx > -1) dados.revenda[idx] = p; else dados.revenda.push(p);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalProdutoRevenda')); if (m) m.hide();
}
function excluirProdutoRevenda() {
    const id = Number(document.getElementById('revenda-id-edit').value);
    const i = (dados.revenda || []).findIndex(x => x.id === id);
    if (i < 0 || !confirm('Mover este produto para a lixeira?')) return;
    const it = dados.revenda.splice(i, 1)[0];
    it.origem = 'revenda'; it.deletadoEm = new Date().toLocaleDateString('pt-BR'); dados.lixeira.push(it);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalProdutoRevenda')); if (m) m.hide();
}
function venderProdutoRevenda(id) {
    if (!verificarAcesso()) return;
    const p = (dados.revenda || []).find(x => x.id === Number(id));
    if (!p || p.qtd < 1) return;
    if (!confirm('Registrar a venda de 1 unidade de "' + p.nome + '" por ' + brl(p.venda) + '?\nSerá lançada como Receita no extrato.')) return;
    p.qtd--; p.vendidos = (p.vendidos || 0) + 1;
    const ag = new Date();
    dados.movs.push({ id: Date.now(), desc: 'Venda: ' + p.nome, valor: p.venda, tipo: 'entrada', cat: 'Outros', data: hojeISO(), hora: String(ag.getHours()).padStart(2, '0') + ':' + String(ag.getMinutes()).padStart(2, '0'), fixo: false });
    salvarERender();
}
function renderRevenda() {
    const l = document.getElementById('lista-produtos-revenda'); if (!l) return;
    const R = dados.revenda || []; let prev = 0, luc = 0;
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
const _renderTudoOriginal = window.renderTudo;
window.renderTudo = function () { _renderTudoOriginal(); renderRevenda(); };

// ---------- Inicialização das correções ----------
document.addEventListener('DOMContentLoaded', () => {
    ['revenda', 'fixosIgnorados'].forEach(k => { if (!Array.isArray(dados[k])) dados[k] = []; });
    ['revenda-vlr-compra', 'revenda-vlr-venda'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', mascaraMoeda); });
    const mm = document.getElementById('modalMeta');
    if (mm) mm.addEventListener('show.bs.modal', () => { const i = document.getElementById('meta-data-inicio'); if (!i.value) i.value = hojeISO(); });
    ['user-login', 'pass-login'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); }); });
});


/* ==============================================================================
 * 03. Cartões: faturas, parcelas, bancos, dívidas parceladas, calendário (.ics)
 * ============================================================================ */
const _mesSel = () => document.getElementById('mes-atual').value;
function ymAdd(ym, n) { let [a, m] = ym.split('-').map(Number); m += n; a += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return a + '-' + String(m).padStart(2, '0'); }
function addMesData(s) { const [a, m, d] = s.split('-').map(Number); const ym = ymAdd(a + '-' + String(m).padStart(2, '0'), 1); const [a2, m2] = ym.split('-').map(Number); return ym + '-' + String(Math.min(d, new Date(a2, m2, 0).getDate())).padStart(2, '0'); }

// ---------- Cartão: fatura por fechamento, parcelas futuras e compra fixa ----------
function mesFatura(card, c) { // mês de fechamento da fatura em que a compra cai
    const d = parseInt(c.data.substring(8, 10)), f = parseInt(card.fecha) || 31;
    return ymAdd(c.data.substring(0, 7), (card.tipo !== 'Débito' && d > f) ? 1 : 0);
}
function ymFat(card, ym) { return (parseInt(card.vence) > parseInt(card.fecha)) ? ym : ymAdd(ym, -1); } // fatura paga em "ym"
function parcelasCompra(card, c) {
    const ant = (c.pagamentos || []).filter(p => p.antecipada).length, tot = Math.max(1, c.parcelas - ant), base = mesFatura(card, c);
    return Array.from({ length: tot }, (_, i) => ({ n: i + 1, total: tot, ym: ymAdd(base, i) }));
}
function itensFatura(card, ymF) {
    const out = [];
    (card.compras || []).forEach(c => {
        if (c.fixa) { if (ymF >= mesFatura(card, c)) out.push({ c, info: 'Fixo', valor: c.valorTotal }); return; }
        const p = parcelasCompra(card, c).find(x => x.ym === ymF);
        if (p) out.push({ c, info: '(' + p.n + '/' + p.total + ')', valor: c.valorTotal / c.parcelas });
    });
    return out;
}
function limiteUsado(card) { // saldo real em aberto (parcelas futuras), não só o mês atual
    const hoje = hojeISO().substring(0, 7);
    return (card.compras || []).reduce((s, c) => {
        const v = c.valorTotal / c.parcelas;
        if (c.fixa) return s + v;
        const aberto = parcelasCompra(card, c).filter(p => p.ym >= hoje).length * v;
        const pago = (c.pagamentos || []).reduce((a, p) => a + p.valor, 0);
        return s + Math.max(0, Math.min(c.valorTotal - pago, aberto));
    }, 0);
}
// Movimentações efetivas do mês = lançamentos (sem compras de crédito) + 1 linha "Fatura" por cartão
function efetivos() {
    const ym = _mesSel(), ids = new Set();
    dados.cartoes.forEach(c => { if (c.tipo !== 'Débito') (c.compras || []).forEach(x => ids.add(x.id)); });
    const out = dados.movs.filter(m => !(m.idRelacionado && ids.has(m.idRelacionado)));
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito') return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0);
        if (t > 0) out.push({ id: -c.id, desc: 'Fatura ' + c.nome, valor: Math.round(t * 100) / 100, tipo: 'saida', cat: 'Cartão', data: ym + '-' + String(Math.min(parseInt(c.vence) || 1, 28)).padStart(2, '0'), hora: '', virtual: true });
    });
    return out;
}
['renderResumo', 'renderGraficoRank', 'coletarAvisos'].forEach(n => {
    const o = window[n];
    window[n] = function (...a) { const r = dados.movs; dados.movs = efetivos(); try { return o.apply(this, a); } finally { dados.movs = r; } };
});
const _renderExtratoO = window.renderExtrato;
window.renderExtrato = function () {
    const r = dados.movs, f = filtroAtual; let e = efetivos();
    if (f === 'fatura') e = e.filter(m => m.virtual); else if (f !== 'tudo') e = e.filter(m => !m.virtual);
    dados.movs = e; if (f === 'fatura' || f === 'tudo') filtroAtual = 'todos';
    try { _renderExtratoO(); } finally { dados.movs = r; filtroAtual = f; }
};
const _abrirModalMovO = window.abrirModalMov;
window.abrirModalMov = function (id) {
    if (id < 0) { setTimeout(() => { const m = bootstrap.Modal.getInstance(document.getElementById('modalMov')); if (m) m.hide(); verCompras(-id); }, 60); return; }
    _abrirModalMovO(id);
};

window.renderCartoes = function renderCartoes() {
    const L = document.getElementById('lista-cartoes'), H = document.getElementById('home-lista-cartoes'); if (!L || !H) return;
    const ym = _mesSel();
    const html = dados.cartoes.map(c => {
        const fat = itensFatura(c, ymFat(c, ym)).reduce((s, i) => s + i.valor, 0);
        return '<div class="col-6 mb-3"><div class="credit-card-container card-compact" style="background:' + c.cor + ';color:' + (c.corFonte || '#fff') + '" onclick="verCompras(' + c.id + ')">'
            + '<div class="card-header-ui"><div><h6 class="mb-0">' + escaparHTML(c.nome) + '</h6><small>' + escaparHTML(c.bandeira) + '</small></div>'
            + '<div class="dropdown" onclick="event.stopPropagation()"><i class="fas fa-ellipsis-v p-1" data-bs-toggle="dropdown"></i><ul class="dropdown-menu"><li><button class="dropdown-item" onclick="abrirModalCartao(' + c.id + ')">Editar Cartão</button></li></ul></div></div>'
            + '<div class="mt-3"><small class="d-block opacity-75">Fatura do mês</small><span class="fw-bold money-value">' + brl(fat) + '</span>'
            + '<small class="d-block opacity-75 mt-1">Disponível <span class="money-value">' + brl(c.limite - limiteUsado(c)) + '</span></small></div></div></div>';
    }).join('') || '<p class="text-center w-100 text-muted">Nenhum cartão cadastrado.</p>';
    L.innerHTML = html; H.innerHTML = html;
};
window.renderComprasCartao = function renderComprasCartao() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto); if (!card) return;
    const ym = _mesSel(), itens = itensFatura(card, ymFat(card, ym));
    const fat = itens.reduce((s, i) => s + i.valor, 0), usado = limiteUsado(card);
    const perc = card.limite > 0 ? Math.min(100, usado / card.limite * 100) : 0;
    document.getElementById('info-cartao-detalhe').innerHTML = '<div class="card p-3 mb-3 border-0 shadow-sm rounded-4" style="background:' + card.cor + ';color:' + (card.corFonte || '#fff') + '">'
        + '<div class="d-flex justify-content-between"><span>Fatura: <b class="money-value">' + brl(fat) + '</b></span><span>Disponível: <b class="money-value">' + brl(card.limite - usado) + '</b></span></div>'
        + '<div class="card-limit-box"><div class="card-limit-progress" style="width:' + perc + '%"></div></div>'
        + '<div class="card-info-row"><span>Fecha dia ' + card.fecha + '</span><span>Vence ' + String(card.vence).padStart(2, '0') + '/' + ym.split('-').reverse().join('/') + '</span></div></div>';
    document.getElementById('lista-compras-cartao').innerHTML = itens.map(({ c, info, valor }) => {
        const pag = (c.pagamentos || []).reduce((a, p) => a + p.valor, 0), rest = Math.max(0, c.valorTotal - pag);
        return '<div class="card-mov align-items-start py-3 mb-2 shadow-sm rounded-3"><div class="flex-grow-1 ms-2">'
            + '<div class="fw-bold">' + escaparHTML(c.desc) + ' <span class="badge bg-purple" style="font-size:.65rem">' + (c.fixa ? '<i class="fas fa-rotate"></i> Fixo' : info) + '</span>'
            + (c.emprestado ? ' <span class="badge bg-warning text-dark" style="font-size:.6rem">EMPRESTADO</span>' : '') + (!c.fixa && rest <= 0 ? ' <span class="badge bg-success" style="font-size:.6rem">PAGO</span>' : '') + '</div>'
            + (c.fixa ? '<small class="text-muted d-block">Repete todo mês</small>' : '<small class="text-muted d-block">Total restante: ' + brl(rest) + ' de ' + brl(c.valorTotal) + '</small>')
            + (c.pagamentos && c.pagamentos.length ? '<div class="mt-2 p-2 bg-light rounded-3 border-start border-info border-3" style="font-size:.75rem"><b class="text-muted text-uppercase" style="font-size:.65rem">Pagamentos:</b>'
                + c.pagamentos.map(p => '<div>→ ' + brl(p.valor) + ' em ' + p.data + (p.antecipada ? ' (antecipada)' : '') + '</div>').join('') + '</div>' : '')
            + '<small class="text-muted d-block mt-1" style="font-size:.7rem"><i class="far fa-calendar-alt me-1"></i>' + c.data.split('-').reverse().join('/') + (c.cat ? ' • ' + escaparHTML(c.cat) : '') + (c.local ? ' • ' + escaparHTML(c.local) : '') + '</small></div>'
            + '<div class="text-end me-2 fw-bold money-value">' + brl(valor) + '</div>'
            + '<div class="dropdown"><button class="btn btn-link text-muted p-2" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">'
            + '<li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(' + c.id + ')"><i class="fas fa-edit text-primary me-2"></i> Editar Compra</button></li>'
            + (c.fixa ? '' : '<li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'total\')"><i class="fas fa-check-circle text-success me-2"></i> Pagamento Total</button></li>'
                + '<li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'parcial\')"><i class="fas fa-coins text-warning me-2"></i> Pagamento Parcial</button></li>'
                + '<li><button class="dropdown-item py-2" onclick="anteciparParcelaModal(' + c.id + ')"><i class="fas fa-forward text-info me-2"></i> Antecipar Parcelas</button></li>')
            + '</ul></div></div>';
    }).join('') || '<p class="text-center text-muted">Nenhuma compra nesta fatura.</p>';
};
// compra fixa: salva o flag (o interruptor existia mas não gravava nada)
const _salvarCompraO = window.salvarCompraCartao;
window.salvarCompraCartao = function () {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto)); if (!card) return;
    const idEdit = Number(document.getElementById('compra-id-edit').value) || 0, antes = JSON.stringify(card.compras);
    const p = parseInt(document.getElementById('compra-parcelas').value) || 1;
    if (p < 1 || p > 60) return alert('Parcelas: informe de 1 a 60.');
    const fixa = document.getElementById('compra-fixa').checked;
    _salvarCompraO();
    if (JSON.stringify(card.compras) === antes) return;
    const c = idEdit ? card.compras.find(x => x.id === idEdit) : card.compras[card.compras.length - 1];
    if (c) { c.fixa = fixa; if (fixa) c.parcelas = 1; salvarERender(); renderComprasCartao(); }
};
const _abrirCompraO = window.abrirModalCompraCartao;
window.abrirModalCompraCartao = function (id) {
    _abrirCompraO(id);
    const c = id ? dados.cartoes.find(x => x.id == cartaoContexto).compras.find(x => x.id == id) : null;
    document.getElementById('compra-fixa').checked = !!(c && c.fixa);
    document.getElementById('compra-parcelas').disabled = !!(c && c.fixa);
};

// ---------- Bancos: cores pré-definidas ----------
const BANCOS = { 'Nubank': ['#8A05BE', '#ffffff'], 'Inter': ['#FF7A00', '#ffffff'], 'Itaú': ['#EC7000', '#ffffff'], 'Bradesco': ['#CC092F', '#ffffff'], 'Santander': ['#EC0000', '#ffffff'], 'Banco do Brasil': ['#FFEF38', '#000000'], 'Caixa': ['#0070AF', '#ffffff'], 'C6 Bank': ['#242424', '#ffffff'], 'PicPay': ['#11C76F', '#ffffff'], 'Mercado Pago': ['#009EE3', '#ffffff'], 'BTG Pactual': ['#001E62', '#ffffff'], 'Neon': ['#00E5E5', '#000000'], 'Next': ['#00FF5F', '#000000'], 'Original': ['#00A859', '#ffffff'], 'Sicredi': ['#3FA110', '#ffffff'], 'XP': ['#000000', '#ffffff'], 'Will Bank': ['#FFD100', '#000000'] };
function aplicarBanco() {
    const b = BANCOS[document.getElementById('card-banco').value]; if (!b) return;
    document.getElementById('card-cor-custom').value = b[0]; document.getElementById('card-cor-fonte').value = b[1];
}
function detectarBanco() {
    const n = document.getElementById('card-nome').value.toLowerCase().replace(/[ãáâ]/g, 'a').replace(/[íî]/g, 'i');
    const k = Object.keys(BANCOS).find(b => n.includes(b.toLowerCase().replace(/[ãáâ]/g, 'a').replace(/[íî]/g, 'i').split(' ')[0]));
    if (k && document.getElementById('card-banco').value !== k) { document.getElementById('card-banco').value = k; aplicarBanco(); }
}

// ---------- Dívidas parceladas ----------
const _abrirDividaO = window.abrirModalDivida;
window.abrirModalDivida = function (id) {
    _abrirDividaO(id);
    const d = id ? dados.dividas.find(x => x.id == id) : null;
    document.getElementById('div-parcelas').value = d ? (d.parcelas || 1) : 1;
};
const _addDividaO = window.addDivida;
window.addDivida = function () {
    const idEdit = Number(document.getElementById('div-id-edit').value) || 0, antes = JSON.stringify(dados.dividas);
    const velho = idEdit ? { ...dados.dividas.find(x => x.id === idEdit) } : null;
    const n = Math.max(1, Math.min(120, parseInt(document.getElementById('div-parcelas').value) || 1));
    _addDividaO();
    if (JSON.stringify(dados.dividas) === antes) return;
    const d = idEdit ? dados.dividas.find(x => x.id === idEdit) : dados.dividas[dados.dividas.length - 1];
    if (!d) return;
    d.parcelas = n; d.pagas = velho ? (velho.pagas || 0) : 0; d.valorTotal = velho ? (velho.valorTotal || d.valor) : d.valor;
    d.valorParcela = Math.round(d.valor / Math.max(1, n - d.pagas) * 100) / 100;
    salvarERender();
};
function pagarParcelaDivida(id) {
    const d = dados.dividas.find(x => x.id === Number(id)); if (!d) return;
    const n = (d.pagas || 0) + 1, vp = Math.min(d.valorParcela || d.valor, d.valor), ultima = n >= d.parcelas || vp >= d.valor - 0.005;
    if (!confirm('Registrar o pagamento da parcela ' + n + '/' + d.parcelas + ' (' + brl(vp) + ')?')) return;
    d.obs = (d.obs || '') + '\n→ Parcela ' + n + '/' + d.parcelas + ' paga: ' + brl(vp) + ' (' + new Date().toLocaleDateString('pt-BR') + ')';
    d.pagas = n;
    if (ultima) {
        dados.dividas = dados.dividas.filter(x => x !== d);
        d.valor = d.valorTotal || vp; d.origem = 'dividas'; d.dataQuitacaoMs = Date.now(); dados.historicoQuitados.push(d);
    } else { d.valor = Math.round((d.valor - vp) * 100) / 100; if (d.prazo) d.prazo = addMesData(d.prazo); }
    salvarERender();
}

// ---------- Calendário (arquivo .ics: importa no Google/Apple/Outlook; UIDs fixos evitam duplicar ao reimportar) ----------
function _icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n'); }
function _icsDia(s, n) { const [a, m, d] = s.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1, d + n)); return x.toISOString().substring(0, 10).replace(/-/g, ''); }
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
    if (!n) return alert('Nenhuma dívida com prazo para sincronizar.');
    L.push('END:VCALENDAR');
    const url = URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar' })), a = document.createElement('a');
    a.href = url; a.download = 'financas_calendario.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function eventoCalendarioDivida(id) { baixarCalendario(Number(id)); }

// ---------- Metas fora do extrato ----------
window.movimentarMeta = function movimentarMeta(id, acao) {
    if (!verificarAcesso()) return;
    const meta = dados.metas.find(m => m.id == id); if (!meta) return;
    const txt = prompt(acao === 'poupar' ? 'Quanto deseja guardar para esta meta?' : 'Quanto deseja resgatar desta meta?'); if (!txt) return;
    const valor = parseFloat(txt.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) return alert('Valor inválido!');
    if (acao !== 'poupar' && valor > meta.guardado) return alert('Saldo insuficiente na meta para resgate!');
    const ag = new Date();
    meta.guardado = Math.round((meta.guardado + (acao === 'poupar' ? valor : -valor)) * 100) / 100;
    (meta.historico = meta.historico || []).push({ tipo: acao, valor, data: ag.toLocaleDateString('pt-BR'), hora: String(ag.getHours()).padStart(2, '0') + ':' + String(ag.getMinutes()).padStart(2, '0') });
    salvarERender();
};

document.addEventListener('DOMContentLoaded', () => {
    const n = document.getElementById('card-nome'); if (n) n.addEventListener('input', detectarBanco);
    if (!dados.migr2) { // remove do extrato os lançamentos antigos gerados por metas (continuam no histórico da própria meta)
        dados.movs = dados.movs.filter(m => !dados.metas.some(x => m.desc === 'Poupança: ' + x.nome || m.desc === 'Resgate: ' + x.nome));
        dados.migr2 = true; localStorage.setItem('financas_pro_max', JSON.stringify(dados));
    }
});


/* ==============================================================================
 * 04. Visão anual
 * ============================================================================ */
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


/* ==============================================================================
 * 05. Categorias, orçamento, contas fixas, CSV e avisos na tela
 * ============================================================================ */
// Avisos na tela (toast) no lugar do alert() bloqueante
window.alert = function (msg) {
    let c = document.getElementById('toast-box');
    if (!c) { c = document.createElement('div'); c.id = 'toast-box'; c.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:20000;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:520px;margin:0 auto'; document.body.appendChild(c); }
    const t = document.createElement('div'), erro = /incorret|inválid|Informe|insuficiente|maior que|Erro|não pode|Preencha/i.test(msg);
    t.style.cssText = 'background:' + (erro ? '#b91c1c' : '#15803d') + ';color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.3);white-space:pre-line;font-size:.9rem;pointer-events:auto;opacity:0;transform:translateY(-8px);transition:.25s';
    t.innerHTML = '<i class="fas ' + (erro ? 'fa-circle-exclamation' : 'fa-circle-check') + ' me-2"></i>' + escaparHTML(msg); c.appendChild(t); requestAnimationFrame(() => { t.style.opacity = 1; t.style.transform = 'none'; });
    t.onclick = () => t.remove(); setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, Math.min(12000, 2500 + String(msg).length * 45));
};

// ---------- Categorias personalizadas (separadas por tipo) ----------
function cats() {
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
const _abrirMovO2 = window.abrirModalMov;
window.abrirModalMov = function (id) {
    const m = id > 0 ? dados.movs.find(x => x.id == id) : null;
    _abrirMovO2(id);
    if (id >= 0 || !id) popularCategorias(document.getElementById('mov-tipo').value, m ? m.cat : null);
};

// ---------- Saldo do mês + acumulado + "quanto posso gastar por dia" ----------
function saldoMesDe(ym) { let e = 0, s = 0; efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).forEach(m => { if (m.tipo === 'entrada') e += m.valor; else s += m.valor; }); return { e, s }; }
const _renderResumoO2 = window.renderResumo;
window.renderResumo = function () {
    _renderResumoO2();
    const ym = _mesSel(), card = document.querySelector('.main-balance-card'); if (!card) return;
    const lbl = card.querySelector('small'); if (lbl) lbl.innerText = 'Saldo do mês';
    const datas = dados.movs.map(m => m.data && m.data.substring(0, 7)).filter(Boolean).sort();
    let acum = 0; if (datas.length) for (let c = datas[0]; c <= ym; c = ymAdd(c, 1)) { const r = saldoMesDe(c); acum += r.e - r.s; }
    let a = document.getElementById('txt-saldo-acum');
    if (!a) { a = document.createElement('small'); a.id = 'txt-saldo-acum'; a.className = 'opacity-75 d-block'; document.getElementById('txt-saldo-geral').after(a); }
    a.innerHTML = 'Acumulado até aqui: <b class="money-value">' + brl(acum) + '</b>';
    let d = document.getElementById('card-diario');
    if (!d) { d = document.createElement('div'); d.id = 'card-diario'; d.className = 'card border-0 shadow-sm rounded-4 p-3 mb-3'; card.after(d); }
    const hoje = new Date(), real = hojeISO().substring(0, 7) === ym;
    if (!real) { d.style.display = 'none'; return; }
    const r = saldoMesDe(ym), saldo = r.e - r.s, restam = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() - hoje.getDate() + 1;
    d.style.display = '';
    d.innerHTML = saldo > 0 ? '<small class="text-muted">Quanto posso gastar por dia</small><div class="fw-bold fs-5 text-success money-value">' + brl(saldo / restam) + '</div><small class="text-muted">Restam ' + restam + ' dia(s) e ' + brl(saldo) + ' livres no mês (já descontadas faturas e fixos lançados).</small>'
        : '<small class="text-muted">Quanto posso gastar por dia</small><div class="fw-bold text-danger">Sem saldo livre no mês</div><small class="text-muted">As despesas já superam as receitas lançadas.</small>';
};

// ---------- Pagamento de dívida → extrato (opcional) ----------
const _confPagO2 = window.confirmarPagamento;
window.confirmarPagamento = function () {
    const modo = document.getElementById('pag-modo').value, id = Number(document.getElementById('pag-id').value);
    const d0 = modo.includes('cartao') ? null : dados.dividas.find(x => x.id === id), antes = JSON.stringify([dados.dividas, dados.historicoQuitados]);
    const v = (modo === 'total' && d0) ? d0.valor : lerMoeda('pag-valor'), quer = document.getElementById('pag-extrato') && document.getElementById('pag-extrato').checked;
    _confPagO2();
    if (d0 && quer && v > 0 && JSON.stringify([dados.dividas, dados.historicoQuitados]) !== antes) lancarDividaNoExtrato(d0, v);
};
function lancarDividaNoExtrato(d, v) {
    const ag = new Date();
    dados.movs.push({ id: Date.now(), desc: (d.tipo === 'eu-devo' ? 'Pagamento: ' : 'Recebimento: ') + d.nome, valor: v, tipo: d.tipo === 'eu-devo' ? 'saida' : 'entrada', cat: 'Dívidas', clienteId: d.clienteId || null, data: hojeISO(), hora: String(ag.getHours()).padStart(2, '0') + ':' + String(ag.getMinutes()).padStart(2, '0'), fixo: false });
    salvarERender();
}
const _pagarParcelaO = window.pagarParcelaDivida;
window.pagarParcelaDivida = function (id) {
    const d = { ...dados.dividas.find(x => x.id === Number(id)) }, antes = JSON.stringify([dados.dividas, dados.historicoQuitados]);
    _pagarParcelaO(id);
    if (d.id && JSON.stringify([dados.dividas, dados.historicoQuitados]) !== antes && confirm('Lançar esta parcela no extrato?')) lancarDividaNoExtrato(d, Math.min(d.valorParcela || d.valor, d.valor));
};

// ---------- Orçamento por categoria ----------
let _orcCats = [];
function renderOrcamento() {
    dados.orcamentos = dados.orcamentos || {};
    const ym = _mesSel(), gasto = {}; efetivosDe(ym).filter(m => m.tipo === 'saida' && m.data && m.data.startsWith(ym)).forEach(m => { gasto[m.cat] = (gasto[m.cat] || 0) + m.valor; });
    _orcCats = [...new Set([...cats().saida, ...Object.keys(dados.orcamentos)])];
    document.getElementById('orc-lista').innerHTML = _orcCats.map((c, i) => {
        const lim = dados.orcamentos[c] || 0, g = gasto[c] || 0, p = lim > 0 ? g / lim * 100 : 0, cor = p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#10b981';
        return '<div class="card border-0 shadow-sm rounded-4 p-3 mb-2"><div class="d-flex justify-content-between align-items-center"><b>' + escaparHTML(c) + '</b>'
            + '<input type="number" inputmode="decimal" min="0" class="form-control form-control-sm text-end" style="width:110px" placeholder="Limite" value="' + (lim || '') + '" onchange="salvarOrcamento(' + i + ',this.value)"></div>'
            + '<div class="progress my-2" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, p) + '%;background:' + cor + '"></div></div>'
            + '<small class="text-muted money-value">Gasto ' + brl(g) + (lim > 0 ? ' de ' + brl(lim) + ' (' + Math.round(p) + '%)' : ' — sem limite definido') + '</small></div>';
    }).join('');
}
function salvarOrcamento(i, v) { const n = parseFloat(v) || 0, c = _orcCats[i]; if (n > 0) dados.orcamentos[c] = n; else delete dados.orcamentos[c]; salvarERender(); renderOrcamento(); }
const _coletarO2 = window.coletarAvisos;
window.coletarAvisos = function () {
    const av = _coletarO2(), ym = _mesSel(), gasto = {};
    efetivosDe(ym).filter(m => m.tipo === 'saida' && m.data && m.data.startsWith(ym)).forEach(m => { gasto[m.cat] = (gasto[m.cat] || 0) + m.valor; });
    Object.entries(dados.orcamentos || {}).forEach(([c, l]) => { const p = (gasto[c] || 0) / l * 100; if (p >= 100) av.push('[erro] Orçamento estourado em ' + c + ' (' + Math.round(p) + '%)'); else if (p >= 80) av.push('[aviso] ' + c + ': ' + Math.round(p) + '% do orçamento'); });
    return av;
};

// ---------- Contas fixas (tudo que se repete todo mês) ----------
function renderFixos() {
    const g = {}; dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    const lista = Object.values(g).filter(m => m.fixo).map(m => ({ desc: m.desc, valor: m.valor, tipo: m.tipo, dia: m.data.substring(8, 10), cat: m.cat, cartaoId: m.cartaoId }));
    dados.cartoes.forEach(c => (c.compras || []).filter(x => x.fixa).forEach(x => lista.push({ desc: x.desc + ' (' + c.nome + ')', valor: x.valorTotal, tipo: 'saida', dia: String(c.vence).padStart(2, '0'), cat: 'Cartão' })));
    const ent = lista.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0), sai = lista.filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0);
    document.getElementById('fixos-resumo').innerHTML = [['Receitas fixas', ent, 'text-success'], ['Despesas fixas', sai, 'text-danger'], ['Sobra fixa/mês', ent - sai, ent - sai >= 0 ? 'text-success' : 'text-danger'], ['Custo anual fixo', sai * 12, '']]
        .map(([t, v, c]) => '<div class="col-6"><div class="card border-0 shadow-sm rounded-4 p-3"><small class="text-muted">' + t + '</small><div class="fw-bold money-value ' + c + '">' + brl(v) + '</div></div></div>').join('');
    document.getElementById('fixos-lista').innerHTML = lista.sort((a, b) => a.dia - b.dia).map(x => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><div class="fw-bold">' + escaparHTML(x.desc) + ' <span class="badge bg-info text-dark"><i class="fas fa-rotate"></i> dia ' + x.dia + '</span></div><small class="text-muted">' + escaparHTML(x.cat) + (x.cartaoId ? ' • ' + escaparHTML((dados.cartoes.find(c => c.id === x.cartaoId) || {}).nome || 'Cartão') : '') + '</small></div><b class="money-value ' + (x.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + (x.tipo === 'entrada' ? '+' : '-') + brl(x.valor) + '</b></div>').join('')
        || '<p class="text-muted text-center">Nenhuma conta fixa. Marque "Fixo" ao lançar uma receita/despesa.</p>';
}

// ---------- Exportar extrato do mês em CSV (abre no Excel) ----------
function exportarCSV() {
    const ym = _mesSel(), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const linhas = efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).sort((a, b) => a.data.localeCompare(b.data));
    if (!linhas.length) return alert('Nenhum lançamento neste mês.');
    const csv = '\uFEFFData;Descrição;Categoria;Tipo;Valor;Fixo\r\n' + linhas.map(m => [m.data.split('-').reverse().join('/'), q(m.desc), q(m.cat), m.tipo === 'entrada' ? 'Receita' : 'Despesa', String(m.valor.toFixed(2)).replace('.', ','), m.fixo ? 'Sim' : 'Não'].join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'extrato_' + ym + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const _showSectionO2 = window.showSection;
window.showSection = function (id, b) { _showSectionO2(id, b); if (id === 'aba-orcamento') renderOrcamento(); if (id === 'aba-fixos') renderFixos(); };
document.addEventListener('DOMContentLoaded', () => {
    const t = document.getElementById('mov-tipo'), c = document.getElementById('mov-cat');
    t.addEventListener('change', () => popularCategorias(t.value, null));
    c.addEventListener('change', () => {
        if (c.value !== '__nova__') return;
        const n = (prompt('Nome da nova categoria:') || '').trim().slice(0, 30), l = cats()[t.value === 'entrada' ? 'entrada' : 'saida'];
        if (n && !l.some(x => x.toLowerCase() === n.toLowerCase())) { l.push(n); salvarERender(); }
        popularCategorias(t.value, n || null);
    });
    popularCategorias(t.value, null);
});


/* ==============================================================================
 * 06. Previsão, simulador de parcelas, reserva e modo offline
 * ============================================================================ */
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


/* ==============================================================================
 * 07. Comparar meses, ordem para quitar dívidas e PIN
 * ============================================================================ */
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


/* ==============================================================================
 * 08. Atalhos rápidos da Início
 * ============================================================================ */
const ACOES = [['Lançar', 'fa-plus', 'novo', 1], ['Entrada', 'fa-circle-arrow-up', 'ajuste-entrada'], ['Saída', 'fa-circle-arrow-down', 'ajuste-saida'], ['Clientes', 'fa-users', 'aba-clientes'], ['Notas', 'fa-note-sticky', 'aba-notas'], ['Lixeira', 'fa-trash-can', 'lixeira'], ['Metas', 'fa-bullseye', 'metas'], ['Orçamento', 'fa-gauge-high', 'aba-orcamento'], ['Anual', 'fa-chart-column', 'aba-anual'], ['Previsão', 'fa-forward', 'aba-previsao'], ['Simular', 'fa-calculator', 'aba-simulador'], ['Fixas', 'fa-rotate', 'aba-fixos']];
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


/* ==============================================================================
 * 09. Início (nova) e cartões
 * ============================================================================ */
const MESES_C = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAT_IC = { 'Mercado': ['fa-cart-shopping', '#f59e0b'], 'Alimentação': ['fa-utensils', '#f97316'], 'Transporte': ['fa-car', '#3b82f6'], 'Moradia': ['fa-house', '#14b8a6'], 'Contas': ['fa-file-invoice-dollar', '#64748b'], 'Saúde': ['fa-heart-pulse', '#ef4444'], 'Educação': ['fa-graduation-cap', '#6366f1'], 'Lazer': ['fa-gamepad', '#a855f7'], 'Assinaturas': ['fa-repeat', '#ec4899'], 'Salário': ['fa-money-bill-wave', '#10b981'], 'Freelance': ['fa-laptop-code', '#0ea5e9'], 'Investimentos': ['fa-chart-line', '#22c55e'], 'Vendas': ['fa-tag', '#84cc16'], 'Dívidas': ['fa-handshake', '#8a2be2'], 'Cartão': ['fa-credit-card', '#6366f1'], 'Outros': ['fa-ellipsis', '#94a3b8'] };
function iconeCat(c) { return CAT_IC[c] || ['fa-receipt', '#8a2be2']; }
function shade(hex, p) { // escurece uma cor #rrggbb em p (0–1)
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#4f46e5';
    const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * (1 - p));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
const _isoDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const _dm = s => s.substring(8, 10) + '/' + s.substring(5, 7);

// ---------- Próximos lançamentos: fixos, parcelas/dívidas e faturas dos próximos 35 dias ----------
function proximos() {
    const hoje = hojeISO(), lim = new Date(); lim.setDate(lim.getDate() + 35); const limS = _isoDe(lim), out = [], g = {};
    dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    Object.values(g).filter(m => m.fixo).forEach(t => {
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
function abrirTransacao(id) {
    if (id < 0) return verCompras(-id);
    abrirModalMov(id); const el = document.getElementById('modalMov'); (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show();
}
function renderHome() {
    const ym = _mesSel(), [a, m] = ym.split('-').map(Number), anoAtual = new Date().getFullYear();
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('hero-mes-ant', MESES_C[(m + 10) % 12]); set('hero-mes-prox', MESES_C[m % 12]); set('hero-mes-atual', MESES_C[m - 1] + (a !== anoAtual ? ' ' + a : ''));
    const h = new Date(); set('hero-atualizado', 'Atualizado às ' + String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0'));
    const seq = sequenciaDias(), sq = document.getElementById('hero-seq'); if (sq) sq.innerHTML = seq > 0 ? '<span class="chip-seq"><i class="fas fa-fire me-1"></i>' + seq + (seq === 1 ? ' dia' : ' dias') + '</span>' : '';
    // próximos lançamentos
    const px = proximos(), P = document.getElementById('home-proximos');
    if (P) P.innerHTML = px.map(x => {
        const [ic, cor] = x.ic, ent = x.tipo === 'entrada', acao = x.cartao ? 'verCompras(' + x.cartao + ')' : x.dividas ? "showSection('dividas')" : "showSection('aba-fixos')";
        return '<div class="prox-card" onclick="' + acao + '"><div class="prox-top"><span class="ic-box" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span><b>' + escaparHTML(x.titulo) + '</b></div>'
            + '<small class="text-muted d-block mt-1">' + escaparHTML(x.sub) + '</small><div class="prox-bot"><small class="' + (x.atrasada ? 'text-danger fw-bold' : 'text-muted') + '">' + _dm(x.data) + (x.atrasada ? ' • vencida' : '') + '</small><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + brl(x.valor) + '</b></div></div>';
    }).join('') || '<div class="prox-card text-muted small">Nada previsto para os próximos 35 dias </div>';
    // últimas transações
    const L = document.getElementById('lista-recente'); if (!L) return;
    const tr = efetivos().filter(x => x.data && x.data.startsWith(ym)).sort(ordemMov).slice(0, 6);
    L.innerHTML = tr.map(x => {
        const [ic, cor] = iconeCat(x.cat), ent = x.tipo === 'entrada';
        return '<div class="trans" onclick="abrirTransacao(' + x.id + ')"><span class="ic-box round" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span>'
            + '<div class="trans-mid"><b>' + escaparHTML(x.desc) + (x.fixo ? ' <i class="fas fa-rotate text-info" title="Fixo" style="font-size:.7rem"></i>' : '') + '</b><small>' + escaparHTML(x.cat) + ' | ' + (x.virtual ? 'Fatura' : ent ? 'Receita' : 'Despesa') + (x.forma ? ' • ' + escaparHTML(x.forma) : '') + '</small></div>'
            + '<div class="trans-end"><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + (ent ? '' : '-') + brl(x.valor) + '</b><small>' + _dm(x.data) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>';
    }).join('') || '<div class="text-center text-muted py-4 small">Nenhuma transação neste mês.<br>Toque em <b>＋</b> para lançar a primeira.</div>';
}
const _renderResumoO8 = window.renderResumo;
window.renderResumo = function () { _renderResumoO8(); renderHome(); };

// ---------- Cartões redesenhados ----------
function bandeiraIcone(b) {
    b = (b || '').toLowerCase();
    return b.includes('visa') ? '<i class="fab fa-cc-visa"></i>' : b.includes('master') ? '<i class="fab fa-cc-mastercard"></i>' : (b.includes('amex') || b.includes('american')) ? '<i class="fab fa-cc-amex"></i>' : b.includes('diners') ? '<i class="fab fa-cc-diners-club"></i>' : '<span class="fp-band">' + escaparHTML(b.toUpperCase().slice(0, 8)) + '</span>';
}
window.renderCartoes = function renderCartoes() {
    const L = document.getElementById('lista-cartoes'), H = document.getElementById('home-lista-cartoes'); if (!L) return;
    const ym = _mesSel(), mesNome = MESES_C[parseInt(ym.slice(5)) - 1];
    const html = dados.cartoes.map(c => {
        const deb = c.tipo === 'Débito', cor = /^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : '#6366f1', fg = c.corFonte || '#fff';
        const fat = deb ? 0 : itensFatura(c, ymFat(c, ym)).reduce((s, i) => s + i.valor, 0), usado = limiteUsado(c), perc = c.limite > 0 ? Math.min(100, usado / c.limite * 100) : 0;
        return '<div class="fp-cartao" style="background:linear-gradient(135deg,' + cor + ' 0%,' + shade(cor, .45) + ' 100%);color:' + fg + '" onclick="if(!event.target.closest(\'.dropdown\'))verCompras(' + c.id + ')"><div class="fp-deco"></div>'
            + '<div class="fp-c-top"><div><b class="fp-c-nome">' + escaparHTML(c.nome) + '</b><small class="d-block fp-sub">' + (deb ? 'Débito' : 'Crédito') + (c.final ? ' •••• ' + escaparHTML(c.final) : '') + '</small></div>'
            + '<div class="d-flex align-items-center gap-2"><span class="fp-bandeira">' + bandeiraIcone(c.bandeira) + '</span><div class="dropdown"><button type="button" class="fp-menu-btn" data-bs-toggle="dropdown" aria-label="Opções do cartão"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0"><li><button class="dropdown-item" onclick="abrirModalCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar cartão</button></li></ul></div></div></div>'
            + '<div class="fp-mid"><small class="fp-sub">' + (deb ? 'Cartão de débito' : 'Fatura de ' + mesNome) + '</small><div class="fp-valor money-value">' + (deb ? 'Sem fatura' : brl(fat)) + '</div>' + (deb ? '' : '<span class="fp-pill">Vence dia ' + String(c.vence).padStart(2, '0') + ' • Fecha dia ' + String(c.fecha).padStart(2, '0') + '</span>') + '</div>'
            + '<div class="fp-bot"><div class="fp-bar"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Disponível <b class="money-value">' + brl(c.limite - usado) + '</b></span><span>Limite ' + brl(c.limite) + '</span></div></div></div>';
    }).join('') ;
    L.innerHTML = html; if (H) H.innerHTML = html;
};


/* ==============================================================================
 * 10. Topo da Início e tema de cor
 * ============================================================================ */
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


/* ==============================================================================
 * 11. Topo das demais telas e Extrato
 * ============================================================================ */
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
window.renderExtrato = function renderExtrato() {
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
};


/* ==============================================================================
 * 12. Lembretes e calculadora flutuante
 * ============================================================================ */
const AV_IC = { erro: 'fa-circle-exclamation text-danger', aviso: 'fa-triangle-exclamation text-warning', cartao: 'fa-credit-card', grafico: 'fa-chart-pie', backup: 'fa-floppy-disk' };
window.abrirNotificacoes = function abrirNotificacoes() {
    const a = coletarAvisos(); let m = document.getElementById('modalAvisos');
    if (!m) {
        m = document.createElement('div'); m.className = 'modal fade'; m.id = 'modalAvisos'; m.tabIndex = -1;
        m.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><button type="button" class="btn-close fp-x" data-bs-dismiss="modal" aria-label="Fechar"></button><div class="modal-body p-4"><h5 class="fw-bold mb-3"><i class="fas fa-bell me-2"></i>Lembretes</h5><div id="avisos-lista"></div></div></div></div>';
        document.body.appendChild(m);
    }
    document.getElementById('avisos-lista').innerHTML = a.length ? a.map(s => { const t = (s.match(/^\[(\w+)\]\s*/) || [])[1] || 'aviso'; return '<div class="aviso-item"><i class="fas ' + (AV_IC[t] || AV_IC.aviso) + '"></i><span>' + escaparHTML(s.replace(/^\[\w+\]\s*/, '')) + '</span></div>'; }).join('')
        : '<div class="text-center text-muted py-3"><i class="fas fa-circle-check text-success fs-3 d-block mb-2"></i>Tudo sob controle. Nenhuma pendência urgente.</div>';
    (bootstrap.Modal.getInstance(m) || new bootstrap.Modal(m)).show();
};

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


/* ==============================================================================
 * 13. Gasto por dia
 * ============================================================================ */
function toggleDiario() { const d = document.getElementById('card-diario'); if (d) d.classList.toggle('aberto'); }
const _renderResumoO12 = window.renderResumo;
window.renderResumo = function () {
    _renderResumoO12();
    const d = document.getElementById('card-diario'); if (!d || d.querySelector('.diario-btn')) return;
    const info = d.innerHTML.replace(/<small class="text-muted">Quanto posso gastar por dia<\/small>/, '');
    d.className = 'mb-3' + (d.classList.contains('aberto') ? ' aberto' : '');
    d.innerHTML = '<button type="button" class="diario-btn" onclick="toggleDiario()"><span class="diario-ic"><i class="fas fa-calendar-day"></i></span><span class="diario-tx">Quanto posso gastar por dia</span><i class="fas fa-chevron-down diario-seta"></i></button><div class="diario-info">' + info + '</div>';
};


/* ==============================================================================
 * 14. Formulários completos e Clientes
 * ============================================================================ */
const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência', 'Cheque', 'Outro'];
const _v = id => { const e = document.getElementById(id); return e ? e.value : ''; };
const _set = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v === undefined || v === null) ? '' : v; };
const _dig = s => String(s || '').replace(/\D/g, '');
const _fd = s => s ? s.split('-').reverse().join('/') : '';
const _optForma = '<option value="">Não informar</option>' + FORMAS.map(f => '<option>' + f + '</option>').join('');
function clientes() { return dados.clientes || (dados.clientes = []); }
function popularClientes(selId, sel) {
    const s = document.getElementById(selId); if (!s) return;
    s.innerHTML = '<option value="">Sem cliente</option>' + clientes().slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join('');
    s.value = sel || '';
}
function _injetar(sel, html) { const b = document.querySelector(sel); if (b) b.parentElement.insertAdjacentHTML('beforebegin', html); }

// ---------- Formulário: Lançamento ----------
const _abrirMov13 = window.abrirModalMov;
window.abrirModalMov = function (id) {
    const m = id > 0 ? dados.movs.find(x => x.id == id) : null;
    _abrirMov13(id); if (id < 0) return;
    popularClientes('mov-cliente', m && m.clienteId); _set('mov-forma', m && m.forma); _set('mov-local', m && m.local); _set('mov-tags', m && m.tags); _set('mov-obs', m && m.obs);
    const d = document.getElementById('mov-mais'); if (d) d.open = !!(m && (m.local || m.tags || m.obs));
};
const _salvarMov13 = window.salvarMov;
window.salvarMov = function () {
    const idEdit = Number(_v('mov-id-edit')) || 0, antes = JSON.stringify(dados.movs); _salvarMov13();
    if (JSON.stringify(dados.movs) === antes) return;
    const m = idEdit ? dados.movs.find(x => x.id === idEdit) : dados.movs[dados.movs.length - 1]; if (!m) return;
    Object.assign(m, { forma: _v('mov-forma'), clienteId: Number(_v('mov-cliente')) || null, local: _v('mov-local').trim(), tags: _v('mov-tags').trim(), obs: _v('mov-obs').trim() }); salvarERender();
};

// ---------- Formulário: Cartão ----------
const _abrirCartao13 = window.abrirModalCartao;
window.abrirModalCartao = function (id) {
    _abrirCartao13(id); const c = id ? dados.cartoes.find(x => x.id == id) : null;
    _set('card-final', c && c.final); _set('card-titular', c && c.titular); _set('card-anuidade', c && c.anuidade ? c.anuidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''); _set('card-obs', c && c.obs);
    const d = document.getElementById('card-mais'); if (d) d.open = !!(c && (c.final || c.titular || c.anuidade || c.obs));
};
const _addCartao13 = window.addCartao;
window.addCartao = function () {
    const idEdit = Number(_v('card-id-edit')) || 0, antes = JSON.stringify(dados.cartoes); _addCartao13();
    if (JSON.stringify(dados.cartoes) === antes) return;
    const c = idEdit ? dados.cartoes.find(x => x.id === idEdit) : dados.cartoes[dados.cartoes.length - 1]; if (!c) return;
    Object.assign(c, { final: _dig(_v('card-final')).slice(-4), titular: _v('card-titular').trim(), anuidade: lerMoeda('card-anuidade'), obs: _v('card-obs').trim() }); salvarERender();
};

// ---------- Formulário: Compra no cartão (com prévia da fatura) ----------
function previewCompra() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto), el = document.getElementById('compra-preview'); if (!card || !el) return;
    const v = lerMoeda('compra-valor'), n = Math.max(1, parseInt(_v('compra-parcelas')) || 1), data = _v('compra-data') || hojeISO(), fixa = document.getElementById('compra-fixa').checked;
    if (v <= 0) { el.innerHTML = '<i class="fas fa-circle-info me-1"></i>Informe o valor para ver em qual fatura a compra cai.'; return; }
    const ym = mesFatura(card, { data }), [a, m] = ym.split('-').map(Number);
    el.innerHTML = '<i class="fas fa-circle-info me-1"></i>' + (fixa ? 'Todo mês de ' : n + 'x de ') + '<b>' + brl(fixa ? v : v / n) + '</b> • 1ª fatura em <b>' + MESES_C[m - 1] + '/' + a + '</b> (fecha dia ' + card.fecha + ')' + (!fixa && n > 1 ? ' • termina em <b>' + MESES_C[(m + n - 2) % 12] + '/' + (a + Math.floor((m + n - 2) / 12)) + '</b>' : '');
}
const _abrirCompra13 = window.abrirModalCompraCartao;
window.abrirModalCompraCartao = function (id) {
    _abrirCompra13(id); const card = dados.cartoes.find(x => x.id == cartaoContexto), c = id && card ? card.compras.find(x => x.id == id) : null;
    const s = document.getElementById('compra-cat'); if (s) { const l = cats().saida.filter(x => x !== 'Cartão'); if (c && c.cat && !l.includes(c.cat)) l.push(c.cat); s.innerHTML = '<option value="">Sem categoria</option>' + l.map(x => '<option>' + escaparHTML(x) + '</option>').join(''); s.value = (c && c.cat) || ''; }
    _set('compra-local', c && c.local); _set('compra-obs', c && c.obs); previewCompra();
};
const _salvarCompra13 = window.salvarCompraCartao;
window.salvarCompraCartao = function () {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto)); if (!card) return _salvarCompra13();
    const idEdit = Number(_v('compra-id-edit')) || 0, antes = JSON.stringify(card.compras); _salvarCompra13();
    if (JSON.stringify(card.compras) === antes) return;
    const c = idEdit ? card.compras.find(x => x.id === idEdit) : card.compras[card.compras.length - 1];
    if (c) { Object.assign(c, { cat: _v('compra-cat'), local: _v('compra-local').trim(), obs: _v('compra-obs').trim() }); salvarERender(); renderComprasCartao(); }
};

// ---------- Formulário: Dívida ----------
const _abrirDiv13 = window.abrirModalDivida;
window.abrirModalDivida = function (id) {
    _abrirDiv13(id); const d = id ? dados.dividas.find(x => x.id == id) : null;
    popularClientes('div-cliente', d && d.clienteId); _set('div-doc', d && d.doc); _set('div-email', d && d.email); _set('div-juros', d && d.juros); _set('div-forma', d && d.forma); _set('div-prio', d && d.prio || 'normal'); _set('div-lembrete', d && d.lembrete || 3);
    const x = document.getElementById('div-mais'); if (x) x.open = !!(d && (d.clienteId || d.doc || d.email || d.juros || d.forma || d.prio === 'alta'));
};
function preencherDeCliente() {
    const c = clientes().find(x => x.id === Number(_v('div-cliente'))); if (!c) return;
    _set('div-nome', c.nome); _set('div-whats', c.tel); _set('div-doc', c.doc); _set('div-email', c.email); if (_v('div-tipo') !== 'me-devem') _set('div-tipo', 'me-devem');
}
const _addDiv13 = window.addDivida;
window.addDivida = function () {
    const idEdit = Number(_v('div-id-edit')) || 0, antes = JSON.stringify(dados.dividas); _addDiv13();
    if (JSON.stringify(dados.dividas) === antes) return;
    const d = idEdit ? dados.dividas.find(x => x.id === idEdit) : dados.dividas[dados.dividas.length - 1]; if (!d) return;
    Object.assign(d, { clienteId: Number(_v('div-cliente')) || null, doc: _v('div-doc').trim(), email: _v('div-email').trim(), juros: parseFloat(_v('div-juros').replace(',', '.')) || 0, forma: _v('div-forma'), prio: _v('div-prio'), lembrete: parseInt(_v('div-lembrete')) || 3 }); salvarERender();
};

// ---------- Clientes ----------
let _cliFiltro = 'todos';
function resumoCliente(c) {
    const movs = dados.movs.filter(m => m.clienteId === c.id), ent = movs.filter(m => m.tipo === 'entrada'), hoje = hojeISO();
    const abertas = dados.dividas.filter(d => d.clienteId === c.id && d.tipo === 'me-devem'), rec = ent.reduce((s, m) => s + m.valor, 0);
    return { movs, abertas, recebido: rec, aberto: abertas.reduce((s, d) => s + d.valor, 0), vencido: abertas.filter(d => d.prazo && d.prazo < hoje).reduce((s, d) => s + d.valor, 0), ticket: ent.length ? rec / ent.length : 0, ultimo: ent.map(m => m.data).sort().pop() || '' };
}
function niverMes(c) { return c.nasc && c.nasc.substring(5, 7) === hojeISO().substring(5, 7); }
function setCliFiltro(f) { _cliFiltro = f; renderClientes(); }
function renderClientes() {
    const L = document.getElementById('lista-clientes'); if (!L) return; const q = (_v('busca-cliente') || '').toLowerCase(), C = clientes();
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
function _modalDin(id, html) {
    let m = document.getElementById(id); if (!m) { m = document.createElement('div'); m.className = 'modal fade'; m.id = id; m.tabIndex = -1; document.body.appendChild(m); }
    m.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><button type="button" class="btn-close fp-x" data-bs-dismiss="modal" aria-label="Fechar"></button>' + html + '</div></div>';
    return bootstrap.Modal.getInstance(m) || new bootstrap.Modal(m);
}
function _ocultar(id) { const m = document.getElementById(id); const i = m && bootstrap.Modal.getInstance(m); if (i) i.hide(); }
function abrirModalCliente(id) {
    if (!verificarAcesso()) return; const c = id ? clientes().find(x => x.id === Number(id)) : {}; const o = (arr, v) => arr.map(([k, t]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + t + '</option>').join(''), val = k => escaparHTML(c[k] || '');
    const f = (rot, idc, k, ph = '', tp = 'text') => '<div class="col-12"><label class="small fw-bold">' + rot + '</label><input type="' + tp + '" id="cli-' + idc + '" class="form-control" placeholder="' + ph + '" value="' + val(k) + '"></div>';
    _modalDin('modalCliente', '<div class="modal-body p-4"><h5 class="fw-bold mb-3">' + (id ? 'Editar cliente' : 'Novo cliente') + '</h5><div class="row g-2">'
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
    const nome = _v('cli-nome').trim(); if (!nome) return alert('Informe o nome do cliente.');
    const ant = id ? clientes().find(x => x.id === id) : null, c = { id: id || Date.now(), nome, tipo: _v('cli-tipo'), status: _v('cli-status'), doc: _v('cli-doc').trim(), tel: _v('cli-tel').trim(), email: _v('cli-email').trim(), cep: _v('cli-cep').trim(), cidade: _v('cli-cidade').trim(), endereco: _v('cli-end').trim(), nasc: _v('cli-nasc'), canal: _v('cli-origem'), segmento: _v('cli-seg').trim(), tags: _v('cli-tags').trim(), obs: _v('cli-obs').trim(), criado: ant ? ant.criado : hojeISO(), interacoes: ant ? ant.interacoes || [] : [] };
    const i = clientes().findIndex(x => x.id === c.id); if (i > -1) clientes()[i] = c; else clientes().push(c);
    salvarERender(); _ocultar('modalCliente'); renderClientes();
}
function excluirCliente(id) {
    const i = clientes().findIndex(x => x.id === id); if (i < 0 || !confirm('Mover este cliente para a lixeira? Os lançamentos e dívidas continuam, mas deixam de estar ligados a ele.')) return;
    const c = clientes().splice(i, 1)[0]; c.origem = 'clientes'; c.deletadoEm = new Date().toLocaleDateString('pt-BR'); c.lixeiraTitulo = 'Cliente: ' + c.nome; dados.lixeira.push(c); salvarERender(); _ocultar('modalCliente'); _ocultar('modalClienteDet'); renderClientes();
}
function verCliente(id) {
    const c = clientes().find(x => x.id === Number(id)); if (!c) return; const r = resumoCliente(c), wa = _dig(c.tel), waN = wa.length <= 11 ? '55' + wa : wa, hoje = hojeISO();
    const tile = (t, v, cls = '') => '<div class="home-tile"><div><small>' + t + '</small><b class="money-value ' + cls + '">' + v + '</b></div></div>', lin = (ic, t) => t ? '<div class="cli-lin"><i class="fas ' + ic + '"></i><span>' + escaparHTML(t) + '</span></div>' : '';
    const tags = (c.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => '<span class="chip-st st-inativo">' + escaparHTML(t) + '</span>').join(' ');
    _modalDin('modalClienteDet', '<div class="modal-body p-4"><div class="d-flex align-items-center gap-3 mb-3"><span class="div-av receber" style="width:52px;height:52px;flex:0 0 52px;font-size:1.3rem">' + escaparHTML(c.nome.trim().charAt(0).toUpperCase()) + '</span><div class="flex-grow-1 min-w-0"><h5 class="fw-bold mb-0">' + escaparHTML(c.nome) + '</h5><small class="text-muted">' + (c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física') + ' • cliente desde ' + _fd(c.criado) + '</small></div><button class="div-icon-btn" onclick="_ocultar(\'modalClienteDet\');abrirModalCliente(' + c.id + ')" title="Editar"><i class="fas fa-pen"></i></button></div>'
        + '<div class="d-flex gap-2 mb-3">' + (wa ? '<a class="btn btn-sm btn-outline-primary flex-fill" target="_blank" href="https://wa.me/' + waN + '"><i class="fab fa-whatsapp me-1"></i>WhatsApp</a><a class="btn btn-sm btn-outline-primary flex-fill" href="tel:' + wa + '"><i class="fas fa-phone me-1"></i>Ligar</a>' : '') + (c.email ? '<a class="btn btn-sm btn-outline-primary flex-fill" href="mailto:' + escaparHTML(c.email) + '"><i class="fas fa-envelope me-1"></i>E-mail</a>' : '') + '</div>'
        + '<div class="home-tiles" style="margin-bottom:12px">' + tile('Total recebido', brl(r.recebido), 'text-success') + tile('Em aberto', brl(r.aberto), r.aberto > 0 ? 'text-danger' : '') + tile('Vencido', brl(r.vencido), r.vencido > 0 ? 'text-danger' : '') + tile('Ticket médio', brl(r.ticket)) + '</div>'
        + '<div class="d-flex gap-2 mb-3"><button class="btn btn-primary btn-sm flex-fill" onclick="novoLancCliente(' + c.id + ')"><i class="fas fa-plus me-1"></i>Novo lançamento</button><button class="btn btn-outline-primary btn-sm flex-fill" onclick="novaCobranca(' + c.id + ')"><i class="fas fa-file-invoice-dollar me-1"></i>Nova cobrança</button></div>'
        + '<div class="mb-3">' + lin('fa-id-card', c.doc) + lin('fa-phone', c.tel) + lin('fa-envelope', c.email) + lin('fa-location-dot', [c.endereco, c.cidade, c.cep].filter(Boolean).join(' • ')) + lin('fa-cake-candles', c.nasc ? 'Aniversário: ' + _fd(c.nasc).substring(0, 5) : '') + lin('fa-bullseye', c.canal ? 'Origem: ' + c.canal : '') + lin('fa-briefcase', c.segmento) + (tags ? '<div class="mt-2">' + tags + '</div>' : '') + (c.obs ? '<div class="cli-obs">' + escaparHTML(c.obs) + '</div>' : '') + '</div>'
        + '<h6 class="fw-bold small text-uppercase text-muted">Cobranças em aberto</h6>' + (r.abertas.map(d => '<div class="div-item mb-2"><div class="div-mid"><b>' + escaparHTML(d.desc || d.nome) + '</b><small>' + (d.prazo ? 'Vence ' + _fd(d.prazo) : 'Sem prazo') + ((d.parcelas || 1) > 1 ? ' • Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : '') + '</small>' + (d.prazo && d.prazo < hoje ? '<span class="chip-st st-venc">Vencida</span>' : '') + '</div><div class="div-val money-value">' + brl(d.valor) + '</div><button class="btn btn-sm btn-outline-success" onclick="_ocultar(\'modalClienteDet\');prepararPagamento(' + d.id + ',\'total\')">Receber</button></div>').join('') || '<p class="small text-muted">Nada em aberto.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Últimos lançamentos</h6>' + (r.movs.slice().sort(ordemMov).slice(0, 5).map(m => '<div class="d-flex justify-content-between small py-1 border-bottom"><span>' + _fd(m.data).substring(0, 5) + ' • ' + escaparHTML(m.desc) + '</span><b class="money-value ' + (m.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + brl(m.valor) + '</b></div>').join('') || '<p class="small text-muted">Sem lançamentos ligados a este cliente.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Histórico de contatos</h6><div id="cli-hist">' + (c.interacoes || []).slice().reverse().map(i => '<div class="cli-int"><small class="text-muted">' + _fd(i.data) + '</small><div>' + escaparHTML(i.texto) + '</div></div>').join('') + '</div>'
        + '<div class="d-flex gap-2 mt-2"><input id="cli-int-txt" class="form-control form-control-sm" placeholder="Registrar contato (ligou, enviou orçamento...)"><button class="btn btn-sm btn-primary" onclick="addInteracao(' + c.id + ')"><i class="fas fa-plus"></i></button></div></div>').show();
}
function addInteracao(id) { const t = _v('cli-int-txt').trim(); if (!t) return; const c = clientes().find(x => x.id === id); (c.interacoes = c.interacoes || []).push({ data: hojeISO(), texto: t.slice(0, 300) }); salvarERender(); verCliente(id); }
function novoLancCliente(id) {
    _ocultar('modalClienteDet'); abrirModalMov(); _set('mov-tipo', 'entrada'); document.getElementById('mov-tipo').dispatchEvent(new Event('change')); popularClientes('mov-cliente', id);
    const el = document.getElementById('modalMov'); setTimeout(() => (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show(), 250);
}
function novaCobranca(id) {
    _ocultar('modalClienteDet'); setTimeout(() => { abrirModalDivida(); _set('div-tipo', 'me-devem'); popularClientes('div-cliente', id); preencherDeCliente(); }, 250);
}
function exportarClientesCSV() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    if (!clientes().length) return alert('Nenhum cliente para exportar.');
    const csv = '\uFEFFNome;Tipo;Status;Documento;Telefone;E-mail;Cidade;Segmento;Origem;Tags;Recebido;Em aberto\r\n' + clientes().map(c => { const r = resumoCliente(c); return [q(c.nome), c.tipo, c.status, q(c.doc), q(c.tel), q(c.email), q(c.cidade), q(c.segmento), q(c.canal), q(c.tags), r.recebido.toFixed(2).replace('.', ','), r.aberto.toFixed(2).replace('.', ',')].join(';'); }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
TITULOS['aba-clientes'] = 'Clientes';
const _showSection13 = window.showSection;
window.showSection = function (id, b) { _showSection13(id, b); if (id === 'aba-clientes') renderClientes(); };

document.addEventListener('DOMContentLoaded', () => {
    if (!Array.isArray(dados.clientes)) dados.clientes = [];
    const sel = (id, extra = '') => '<select id="' + id + '" class="form-select" ' + extra + '>';
    _injetar('#modalMov button[onclick="salvarMov()"]',
        '<div class="row g-2 mb-3"><div class="col-6"><label class="small fw-bold">Forma de pagamento</label>' + sel('mov-forma') + _optForma + '</select></div><div class="col-6"><label class="small fw-bold">Cliente (opcional)</label>' + sel('mov-cliente') + '</select></div></div>'
        + '<details id="mov-mais" class="mais-det mb-3"><summary>Mais detalhes</summary><div class="pt-2"><label class="small fw-bold">Local / Estabelecimento</label><input id="mov-local" class="form-control mb-2" placeholder="Ex: Atacadão, Posto Shell"><label class="small fw-bold">Tags</label><input id="mov-tags" class="form-control mb-2" placeholder="Ex: casa, viagem, trabalho"><label class="small fw-bold">Observações</label><textarea id="mov-obs" class="form-control" rows="2"></textarea></div></details>');
    _injetar('#modalCartao button[onclick="addCartao()"]',
        '<details id="card-mais" class="mais-det mb-3"><summary>Mais detalhes</summary><div class="row g-2 pt-2"><div class="col-5"><label class="small">Final (4 dígitos)</label><input id="card-final" class="form-control" maxlength="4" inputmode="numeric" placeholder="1234"></div><div class="col-7"><label class="small">Anuidade (R$)</label><input id="card-anuidade" class="form-control" inputmode="numeric" placeholder="0,00"></div><div class="col-12"><label class="small">Titular</label><input id="card-titular" class="form-control" placeholder="Nome impresso"></div><div class="col-12"><label class="small">Observações</label><textarea id="card-obs" class="form-control" rows="2"></textarea></div></div></details>');
    const an = document.getElementById('card-anuidade'); if (an) an.addEventListener('input', mascaraMoeda);
    _injetar('#modalCompraCartao button[onclick="salvarCompraCartao()"]',
        '<div id="compra-preview" class="compra-prev mb-3"></div><div class="row g-2 mb-3"><div class="col-6"><label class="small">Categoria</label><select id="compra-cat" class="form-select"></select></div><div class="col-6"><label class="small">Local / Loja</label><input id="compra-local" class="form-control" placeholder="Ex: Amazon"></div><div class="col-12"><label class="small">Observações</label><input id="compra-obs" class="form-control" placeholder="Opcional"></div></div>');
    ['compra-valor', 'compra-parcelas', 'compra-data', 'compra-fixa'].forEach(i => { const e = document.getElementById(i); if (e) { e.addEventListener('input', previewCompra); e.addEventListener('change', previewCompra); } });
    _injetar('#modalDivida button[onclick="addDivida()"]',
        '<details id="div-mais" class="mais-det mb-3"><summary>Mais detalhes (cliente, juros, prioridade)</summary><div class="row g-2 pt-2"><div class="col-12"><label class="small">Cliente cadastrado</label><select id="div-cliente" class="form-select" onchange="preencherDeCliente()"></select></div>'
        + '<div class="col-6"><label class="small">CPF / CNPJ</label><input id="div-doc" class="form-control"></div><div class="col-6"><label class="small">E-mail</label><input id="div-email" type="email" class="form-control"></div>'
        + '<div class="col-6"><label class="small">Juros ao mês (%)</label><input id="div-juros" class="form-control" inputmode="decimal" placeholder="0"></div><div class="col-6"><label class="small">Forma de pagamento</label>' + sel('div-forma') + _optForma + '</select></div>'
        + '<div class="col-6"><label class="small">Prioridade</label><select id="div-prio" class="form-select"><option value="normal">Normal</option><option value="alta">Alta</option></select></div><div class="col-6"><label class="small">Avisar quantos dias antes</label><input id="div-lembrete" type="number" min="0" max="30" class="form-control" value="3"></div></div></details>');
});


/* ==============================================================================
 * 15. Faturas com contas fixas, cartão emprestado, botão + e confirmações
 * ============================================================================ */
// ---------- Fatura: contas fixas/lançamentos no cartão entram na fatura ----------
window.itensFatura = function itensFatura(card, ymF) {
    const out = [];
    (card.compras || []).forEach(c => {
        if (c.fixa) { if (ymF >= mesFatura(card, c)) out.push({ c, info: 'Fixo', valor: c.valorTotal }); return; }
        const p = parcelasCompra(card, c).find(x => x.ym === ymF);
        if (p) out.push({ c, info: '(' + p.n + '/' + p.total + ')', valor: c.valorTotal / c.parcelas });
    });
    const pseudo = (m, fx) => ({ c: { id: 'm' + m.id, movId: m.id, mov: true, desc: m.desc, valorTotal: m.valor, parcelas: 1, data: m.data, local: m.local, cat: m.cat, fixa: fx, emprestado: false, pagamentos: [] }, info: fx ? 'Fixo' : '', valor: m.valor }), fixos = {};
    dados.movs.forEach(m => { // conta fixa no cartão: aparece em TODAS as faturas a partir da primeira (vale o valor do último reajuste)
        if (m.cartaoId !== card.id || m.tipo !== 'saida' || !m.data) return;
        const inv = mesFatura(card, { data: m.data });
        if (!m.fixo) { if (inv === ymF) out.push(pseudo(m, false)); return; }
        if (inv <= ymF) { const k = m.desc; if (!fixos[k] || inv > fixos[k].inv || (inv === fixos[k].inv && m.data > fixos[k].m.data)) fixos[k] = { inv, m }; }
    });
    Object.values(fixos).forEach(f => out.push(pseudo(f.m, true)));
    return out;
};
window.limiteUsado = function limiteUsado(card) {
    const hoje = hojeISO().substring(0, 7);
    const compras = (card.compras || []).reduce((s, c) => {
        const v = c.valorTotal / c.parcelas; if (c.fixa) return s + v;
        const aberto = parcelasCompra(card, c).filter(p => p.ym >= hoje).length * v, pago = (c.pagamentos || []).reduce((a, p) => a + p.valor, 0);
        return s + Math.max(0, Math.min(c.valorTotal - pago, aberto));
    }, 0);
    return compras + dados.movs.filter(m => m.cartaoId === card.id && m.tipo === 'saida' && m.data && mesFatura(card, { data: m.data }) >= hoje).reduce((s, m) => s + m.valor, 0);
};
function _efPara(ym, comId) {
    const ids = new Set(), cred = new Set();
    dados.cartoes.forEach(c => { if (c.tipo !== 'Débito') { cred.add(c.id); (c.compras || []).forEach(x => ids.add(x.id)); } });
    const out = dados.movs.filter(m => !(m.idRelacionado && ids.has(m.idRelacionado)) && !(m.cartaoId && cred.has(m.cartaoId)));
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito') return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0); if (t <= 0) return;
        out.push(comId ? { id: -c.id, desc: 'Fatura ' + c.nome, valor: Math.round(t * 100) / 100, tipo: 'saida', cat: 'Cartão', data: ym + '-' + String(Math.min(parseInt(c.vence) || 1, 28)).padStart(2, '0'), hora: '', virtual: true } : { desc: 'Fatura ' + c.nome, valor: t, tipo: 'saida', cat: 'Cartão', data: ym + '-01' });
    });
    return out;
}
window.efetivos = function efetivos() { return _efPara(_mesSel(), true); };
window.efetivosDe = function efetivosDe(ym) { return _efPara(ym, false); };

// ---------- Tela de compras do cartão (nova organização) ----------
const _dmy = s => s.substring(8, 10) + '/' + s.substring(5, 7) + '/' + s.substring(0, 4);
function _cardItem(card, it, ymF) {
    const { c, valor } = it, pagOk = (c.pagamentos || []).filter(p => !p.antecipada).reduce((a, p) => a + p.valor, 0), dia = parseInt(c.data.substring(8, 10)) || 1;
    let badge, meio, datas, falta = 0, pct = 100;
    if (c.fixa || c.mov) {
        badge = c.mov ? 'Conta fixa' : 'Fixo';
        meio = '<div><small>Valor mensal</small><b class="money-value">' + brl(valor) + '</b></div><div><small>Duração</small><b>Todo mês</b></div>';
        datas = '<span><i class="far fa-calendar"></i> Início ' + _dmy(c.data) + '</span><span><i class="fas fa-infinity"></i> Sem data final</span>'; pct = 0;
    } else {
        const ps = parcelasCompra(card, c), tot = ps.length, n = Math.max(1, ps.findIndex(x => x.ym === ymF) + 1), last = ps[tot - 1].ym, [ay, am] = last.split('-').map(Number);
        falta = Math.max(0, (tot - n + 1) * valor - pagOk); pct = n / tot * 100; badge = n + '/' + tot;
        meio = '<div><small>Total da compra</small><b class="money-value">' + brl(c.valorTotal) + '</b></div><div><small>Falta pagar</small><b class="money-value ' + (falta > 0 ? 'text-danger' : 'text-success') + '">' + brl(falta) + '</b></div>';
        datas = '<span><i class="far fa-calendar"></i> Início ' + _dmy(c.data) + '</span><span><i class="far fa-flag"></i> Finalizar ' + String(Math.min(dia, new Date(ay, am, 0).getDate())).padStart(2, '0') + '/' + String(am).padStart(2, '0') + '/' + ay + '</span>';
    }
    const menu = c.mov ? '<li><button class="dropdown-item py-2" onclick="abrirTransacao(' + c.movId + ')"><i class="fas fa-pen me-2"></i>Editar lançamento</button></li>'
        : '<li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar compra</button></li>' + (c.fixa ? '' : '<li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'total\')"><i class="fas fa-circle-check me-2"></i>Pagamento total</button></li><li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'parcial\')"><i class="fas fa-coins me-2"></i>Pagamento parcial</button></li><li><button class="dropdown-item py-2" onclick="anteciparParcelaModal(' + c.id + ')"><i class="fas fa-forward me-2"></i>Antecipar parcelas</button></li>');
    const pags = (c.pagamentos || []).map(p => '<div>' + brl(p.valor) + ' em ' + escaparHTML(p.data) + (p.antecipada ? ' (antecipada)' : '') + '</div>').join('');
    return '<div class="cc-item"><div class="cc-l1"><b class="cc-desc">' + escaparHTML(c.desc) + '</b><span class="cc-parc money-value">' + brl(valor) + '</span><span class="cc-badge">' + badge + '</span>'
        + '<div class="dropdown"><button class="cc-menu" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-vertical"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">' + menu + '</ul></div></div>'
        + '<div class="cc-l2">' + meio + '</div>' + (c.fixa || c.mov ? '' : '<div class="cc-bar"><div style="width:' + pct + '%"></div></div>')
        + '<div class="cc-l3">' + datas + '</div>'
        + ((c.local || c.cat) ? '<div class="cc-l3">' + (c.local ? '<span><i class="fas fa-store"></i> ' + escaparHTML(c.local) + '</span>' : '') + (c.cat ? '<span><i class="fas fa-tag"></i> ' + escaparHTML(c.cat) + '</span>' : '') + '</div>' : '')
        + (pags ? '<div class="cc-pags"><b>Pagamentos</b>' + pags + '</div>' : '') + '</div>';
}
window.renderComprasCartao = function renderComprasCartao() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto); if (!card) return;
    const ym = _mesSel(), ymF = ymFat(card, ym), itens = itensFatura(card, ymF), usado = limiteUsado(card), cor = /^#[0-9a-f]{6}$/i.test(card.cor || '') ? card.cor : '#6366f1', fg = card.corFonte || '#fff';
    const soma = l => l.reduce((s, i) => s + i.valor, 0), minhas = itens.filter(i => !i.c.emprestado), emp = itens.filter(i => i.c.emprestado), perc = card.limite > 0 ? Math.min(100, usado / card.limite * 100) : 0;
    document.getElementById('info-cartao-detalhe').innerHTML = '<div class="cc-resumo" style="background:linear-gradient(135deg,' + cor + ',' + shade(cor, .45) + ');color:' + fg + '"><div class="d-flex justify-content-between align-items-end"><div><small class="fp-sub">Fatura de ' + MESES_C[parseInt(ym.slice(5)) - 1] + '</small><div class="fp-valor money-value">' + brl(soma(minhas)) + '</div></div><div class="text-end"><small class="fp-sub">Disponível</small><div class="fw-bold money-value">' + brl(card.limite - usado) + '</div></div></div>'
        + '<div class="fp-bar mt-2"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Fecha dia ' + String(card.fecha).padStart(2, '0') + '</span><span>Vence ' + String(card.vence).padStart(2, '0') + '/' + ym.slice(5) + '/' + ym.slice(0, 4) + '</span></div>'
        + (emp.length ? '<div class="fp-sub mt-1">Emprestado (fora do seu extrato): <b class="money-value">' + brl(soma(emp)) + '</b></div>' : '') + '</div>';
    const sec = (ic, t, v, cls = '') => '<div class="cc-sec ' + cls + '"><span><i class="fas ' + ic + '"></i> ' + t + '</span><b class="money-value">' + brl(v) + '</b></div>';
    let html = minhas.length ? sec('fa-user', 'Minhas compras', soma(minhas)) + minhas.map(i => _cardItem(card, i, ymF)).join('') : '';
    if (emp.length) {
        const g = {}; emp.forEach(i => { const k = (i.c.pessoa || '').trim() || 'Sem nome'; (g[k] = g[k] || []).push(i); });
        html += '<div class="cc-titulo-emp"><i class="fas fa-people-arrows"></i> Cartão emprestado</div>' + Object.entries(g).map(([n, l]) => sec('fa-user-group', escaparHTML(n), soma(l), 'emp') + l.map(i => _cardItem(card, i, ymF)).join('')).join('');
    }
    const fx = fixasDoCartao(card);
    if (fx.length) html += '<div class="cc-titulo-emp"><i class="fas fa-rotate" style="color:var(--purple)"></i> Contas fixas deste cartão<span class="float-end money-value">' + brl(fx.reduce((s, f) => s + f.valor, 0)) + '/mês</span></div>' + fx.map(f => '<div class="cc-fixa" onclick="' + f.ac + '"><div class="flex-grow-1 min-w-0"><b>' + escaparHTML(f.desc) + '</b><small>Todo mês • desde ' + _dmy(f.data) + (f.local ? ' • ' + escaparHTML(f.local) : '') + '</small></div><b class="money-value">' + brl(f.valor) + '</b></div>').join('');
    document.getElementById('lista-compras-cartao').innerHTML = html || '<p class="text-center text-muted small py-4">Nenhuma compra nesta fatura.</p>';
};

// ---------- Formulários: pessoa (cartão emprestado) e cartão da fatura no lançamento ----------
function togglePessoa() { const w = document.getElementById('compra-pessoa-wrap'), e = document.getElementById('compra-emprestado'); if (w && e) w.classList.toggle('d-none', !e.checked); }
function toggleCartaoMov() {
    const w = document.getElementById('mov-cartao-wrap'); if (!w) return;
    w.classList.toggle('d-none', _v('mov-tipo') !== 'saida');
}
const _abrirCompra14 = window.abrirModalCompraCartao;
window.abrirModalCompraCartao = function (id) {
    _abrirCompra14(id); const card = dados.cartoes.find(x => x.id == cartaoContexto), c = id && card ? card.compras.find(x => x.id == id) : null;
    _set('compra-pessoa', c && c.pessoa); togglePessoa();
};
const _salvarCompra14 = window.salvarCompraCartao;
window.salvarCompraCartao = function () {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto)); if (!card) return _salvarCompra14();
    const idEdit = Number(_v('compra-id-edit')) || 0, antes = JSON.stringify(card.compras); _salvarCompra14();
    if (JSON.stringify(card.compras) === antes) return;
    const c = idEdit ? card.compras.find(x => x.id === idEdit) : card.compras[card.compras.length - 1];
    if (c) { c.pessoa = c.emprestado ? _v('compra-pessoa').trim() : ''; salvarERender(); renderComprasCartao(); }
};
const _abrirMov14 = window.abrirModalMov;
window.abrirModalMov = function (id) {
    const m = id > 0 ? dados.movs.find(x => x.id == id) : null; _abrirMov14(id); if (id < 0) return;
    const s = document.getElementById('mov-cartao'); if (s) { s.innerHTML = '<option value="">Nenhum (lançamento direto)</option>' + dados.cartoes.filter(c => c.tipo !== 'Débito').map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join(''); s.value = (m && m.cartaoId) ? m.cartaoId : ''; }
    if (m && m.cartaoId) _set('mov-forma', 'Crédito'); toggleCartaoMov();
};
const _salvarMov14 = window.salvarMov;
window.salvarMov = function () {
    const idEdit = Number(_v('mov-id-edit')) || 0, antes = JSON.stringify(dados.movs), usaCartao = _v('mov-tipo') === 'saida' && Number(_v('mov-cartao')) > 0, cid = Number(_v('mov-cartao')) || null;
    _salvarMov14(); if (JSON.stringify(dados.movs) === antes) return;
    const m = idEdit ? dados.movs.find(x => x.id === idEdit) : dados.movs[dados.movs.length - 1]; if (!m) return;
    m.cartaoId = usaCartao ? cid : null; if (usaCartao && !m.forma) m.forma = 'Crédito'; salvarERender();
};

function fixasDoCartao(card) { // tudo o que se repete todo mês neste cartão (compras fixas + contas fixas ligadas a ele)
    const g = {}; dados.movs.forEach(m => { if (m.cartaoId !== card.id || !m.fixo || m.tipo !== 'saida' || !m.data) return; if (!g[m.desc] || m.data > g[m.desc].data) g[m.desc] = m; });
    const out = Object.values(g).map(m => ({ desc: m.desc, valor: m.valor, data: m.data, local: m.local, ac: 'abrirTransacao(' + m.id + ')' }));
    (card.compras || []).filter(c => c.fixa).forEach(c => out.push({ desc: c.desc, valor: c.valorTotal, data: c.data, local: c.local, ac: 'abrirModalCompraCartao(' + c.id + ')' }));
    return out;
}
function vincularFixoCartao(chave, cid) { // liga (ou desliga) uma conta fixa a um cartão, sem mudar mais nada nela
    cid = Number(cid) || null;
    dados.movs.forEach(m => { if (m.tipo + '|' + m.desc === chave) { m.cartaoId = cid; if (cid && !m.forma) m.forma = 'Crédito'; } });
    salvarERender(); renderFixos(); alert(cid ? 'Conta fixa salva no cartão' : 'Vínculo com o cartão removido');
}
window.renderFixos = function renderFixos() {
    const g = {}; dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    const lista = Object.values(g).filter(m => m.fixo).map(m => ({ chave: m.tipo + '|' + m.desc, desc: m.desc, valor: m.valor, tipo: m.tipo, dia: m.data.substring(8, 10), cat: m.cat, cartaoId: m.cartaoId || null, editavel: true }));
    dados.cartoes.forEach(c => (c.compras || []).filter(x => x.fixa).forEach(x => lista.push({ desc: x.desc, valor: x.valorTotal, tipo: 'saida', dia: String(c.vence).padStart(2, '0'), cat: x.cat || 'Cartão', cartaoId: c.id, editavel: false })));
    const ent = lista.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0), sai = lista.filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0);
    document.getElementById('fixos-resumo').innerHTML = [['Receitas fixas', ent, 'text-success'], ['Despesas fixas', sai, 'text-danger'], ['Sobra fixa/mês', ent - sai, ent - sai >= 0 ? 'text-success' : 'text-danger'], ['Custo anual fixo', sai * 12, '']]
        .map(([t, v, c]) => '<div class="col-6"><div class="card border-0 shadow-sm rounded-4 p-3"><small class="text-muted">' + t + '</small><div class="fw-bold money-value ' + c + '">' + brl(v) + '</div></div></div>').join('');
    const cartoesCred = dados.cartoes.filter(c => c.tipo !== 'Débito');
    document.getElementById('fixos-lista').innerHTML = lista.sort((a, b) => a.dia - b.dia).map(x => {
        const nomeCartao = x.cartaoId ? ((dados.cartoes.find(c => c.id === x.cartaoId) || {}).nome || 'Cartão') : '';
        const ligar = x.tipo === 'entrada' ? '' : x.editavel
            ? '<div class="w-100 mt-2"><select class="form-select form-select-sm" onchange="vincularFixoCartao(decodeURIComponent(\'' + encodeURIComponent(x.chave) + '\'), this.value)"><option value="">Sem cartão (lançamento direto)</option>' + cartoesCred.map(c => '<option value="' + c.id + '"' + (c.id === x.cartaoId ? ' selected' : '') + '>Salvar no cartão ' + escaparHTML(c.nome) + '</option>').join('') + '</select></div>'
            : '<div class="w-100 mt-1"><small class="text-muted"><i class="fas fa-credit-card me-1"></i>Cartão ' + escaparHTML(nomeCartao) + '</small></div>';
        return '<div class="card-mov py-2 mb-2" style="flex-wrap:wrap"><div class="flex-grow-1"><div class="fw-bold">' + escaparHTML(x.desc) + ' <span class="badge bg-info text-dark"><i class="fas fa-rotate"></i> dia ' + x.dia + '</span></div><small class="text-muted">' + escaparHTML(x.cat) + (nomeCartao ? ' • ' + escaparHTML(nomeCartao) : '') + '</small></div><b class="money-value ' + (x.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + (x.tipo === 'entrada' ? '+' : '-') + brl(x.valor) + '</b>' + ligar + '</div>';
    }).join('') || '<p class="text-muted text-center">Nenhuma conta fixa. Marque "Fixo" ao lançar uma receita/despesa.</p>';
};

// ---------- Botão flutuante (+) por tela ----------
function mostrarModal(id) { const el = document.getElementById(id); (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show(); }
const FAB_ACOES = { 'cartoes': () => abrirModalCartao(), 'compras-cartao': () => abrirModalCompraCartao(), 'dividas': () => abrirModalDivida(), 'aba-clientes': () => abrirModalCliente(), 'metas': () => mostrarModal('modalMeta'), 'aba-notas': () => abrirModalNota(), 'aba-revenda': () => abrirModalRevenda() };
const FAB_ROTULO = { 'cartoes': 'Novo cartão', 'compras-cartao': 'Nova compra', 'dividas': 'Novo registro', 'aba-clientes': 'Novo cliente', 'metas': 'Nova meta', 'aba-notas': 'Nova nota', 'aba-revenda': 'Novo produto' };
function atualizarFab() { const f = document.getElementById('fab-add'); if (!f) return; const ok = !!FAB_ACOES[_secAtual]; f.style.display = ok ? 'flex' : 'none'; f.setAttribute('aria-label', FAB_ROTULO[_secAtual] || ''); }
const _showSection14 = window.showSection;
window.showSection = function (id, b) { _showSection14(id, b); atualizarFab(); };

// ---------- Confirmação (aviso na tela) depois de cada ação ----------
const AVISOS = { salvarMov: 'Lançamento salvo', moverMovParaLixeira: 'Lançamento enviado para a lixeira', addCartao: 'Cartão salvo', excluirCartaoNoModal: 'Cartão excluído', salvarCompraCartao: 'Compra salva', excluirCompraNoModal: 'Compra excluída', addDivida: 'Registro salvo', excluirDivida: 'Registro enviado para a lixeira', confirmarPagamento: 'Pagamento registrado', pagarParcelaDivida: 'Parcela paga', salvarMeta: 'Meta salva', movimentarMeta: 'Movimentação da meta registrada', salvarNota: 'Nota salva', excluirNotaDireta: 'Nota excluída', salvarProdutoRevenda: 'Produto salvo', excluirProdutoRevenda: 'Produto enviado para a lixeira', venderProdutoRevenda: 'Venda registrada', salvarCliente: 'Cliente salvo', excluirCliente: 'Cliente enviado para a lixeira', addInteracao: 'Contato registrado', confirmarAntecipacao: 'Antecipação registrada', restaurarDaLixeira: 'Item restaurado' };
const _snap = () => JSON.stringify([dados, typeof notas !== 'undefined' ? notas : null]);
Object.keys(AVISOS).forEach(n => {
    const o = window[n]; if (typeof o !== 'function') return;
    window[n] = function (...a) { const antes = _snap(), r = o.apply(this, a); if (_snap() !== antes) alert(AVISOS[n]); return r; };
});

document.addEventListener('DOMContentLoaded', () => {
    const fab = document.createElement('button'); fab.id = 'fab-add'; fab.innerHTML = '<i class="fas fa-plus"></i>'; fab.style.display = 'none'; fab.onclick = () => { const f = FAB_ACOES[_secAtual]; if (f) f(); }; document.body.appendChild(fab);
    ['#cartoes button[onclick*="abrirModalCartao()"]', '#compras-cartao button[onclick*="abrirModalCompraCartao()"]', '#dividas button[onclick*="abrirModalDivida()"]', '#aba-clientes button[onclick*="abrirModalCliente()"]', '#metas button[data-bs-target="#modalMeta"]', '#aba-notas button[onclick*="abrirModalNota()"]', '#aba-revenda button[onclick*="abrirModalRevenda()"]'].forEach(q => document.querySelectorAll(q).forEach(b => b.classList.add('d-none')));
    const ce = document.getElementById('compra-emprestado');
    if (ce) { ce.addEventListener('change', togglePessoa); ce.closest('div').insertAdjacentHTML('afterend', '<div id="compra-pessoa-wrap" class="mb-3 d-none"><label class="small fw-bold">Nome de quem usou o cartão</label><input id="compra-pessoa" class="form-control" placeholder="Ex: Karol"></div>'); }
    const mf = document.getElementById('mov-forma');
    if (mf) { mf.closest('.row').insertAdjacentHTML('afterend', '<div id="mov-cartao-wrap" class="mb-3 d-none"><label class="small fw-bold">Cartão de crédito (opcional)</label><select id="mov-cartao" class="form-select"></select><small class="text-muted">Escolhendo um cartão, a despesa entra na fatura dele. Se for "Fixo", aparece em todas as faturas e fica salva no cartão.</small></div>'); mf.addEventListener('change', toggleCartaoMov); document.getElementById('mov-cartao').addEventListener('change', e => { if (e.target.value) _set('mov-forma', 'Crédito'); }); document.getElementById('mov-tipo').addEventListener('change', toggleCartaoMov); }
});
