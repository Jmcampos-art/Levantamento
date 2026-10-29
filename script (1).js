/* =========================================================
   SISTEMA DE LEVANTAMENTO — Firebase Realtime Database v2
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* =========================================================
   🔥 SUAS CREDENCIAIS
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDeMwUeu-3chnjCpxzTdySFFAkv1s65sw8",
  authDomain: "levantamento-epi.firebaseapp.com",
  databaseURL: "https://levantamento-epi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "levantamento-epi",
  storageBucket: "levantamento-epi.firebasestorage.app",
  messagingSenderId: "655234363827",
  appId: "1:655234363827:web:9c449858e2dad1eef29bc6"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* =========================================================
   ESTADO GLOBAL
   ========================================================= */
let catalogo = [];
let movimentacoes = [];
let levantamentos = [];      // Levantamentos salvos (contagens finalizadas)
let filtroCategoria = 'todos';
let filtroHistorico = 'todos';
let editingIndex = -1;
let movTipoAtual = null;
let diaSelecionado = null;

// Modo contagem
let modoContagem = false;
let contagem = [];           // [{ codigo, quantidadeContada, estoqueSnapshot, ... }]
let relatorioPendente = null;

/* =========================================================
   DOM
   ========================================================= */
const $ = (id) => document.getElementById(id);

const mainBody         = $('mainBody');
const emptyMain        = $('emptyMain');
const searchCatalogo   = $('searchCatalogo');
const clearSearchBtn   = $('clearSearchBtn');
const categoryFilters  = $('categoryFilters');
const totalRegistros   = $('totalRegistros');

const sumRegistros     = $('sumRegistros');
const sumItens         = $('sumItens');
const sumUniformes     = $('sumUniformes');
const sumEpis          = $('sumEpis');

const openFormBtn      = $('openFormBtn');
const openFormCount    = $('openFormCount');
const closeModalBtn    = $('closeModalBtn');
const modalOverlay     = $('modalOverlay');
const modalTitle       = $('modalTitle');
const modalListCount   = $('modalListCount');
const modalSearchInput = $('modalSearchInput');
const modalListBody    = $('modalListBody');
const modalEmpty       = $('modalEmpty');

const form             = $('productForm');
const codigoInput      = $('codigo');
const categoriaInput   = $('categoria');
const nomeInput        = $('nome');
const quantidadeInput  = $('quantidade');
const conteudoInput    = $('conteudo');
const unidadeInput     = $('unidade');
const tamanhoInput     = $('tamanho');
const corInput         = $('cor');
const observacaoInput  = $('observacao');
const addBtn           = $('addBtn');
const cancelEditBtn    = $('cancelEditBtn');

const btnEntrada       = $('btnEntrada');
const btnSaida         = $('btnSaida');
const exportExcelBtn   = $('exportExcelBtn');
const printBtn         = $('printBtn');

const modalMovOverlay  = $('modalMovOverlay');
const closeMovBtn      = $('closeMovBtn');
const movForm          = $('movForm');
const movTitle         = $('movTitle');
const movIcon          = $('movIcon');
const movCodigo        = $('movCodigo');
const movQtd           = $('movQtd');
const movData          = $('movData');
const movSuggestions   = $('movSuggestions');
const movInfoBox       = $('movInfoBox');
const movInfoNome      = $('movInfoNome');
const movInfoEstoque   = $('movInfoEstoque');
const cancelMovBtn     = $('cancelMovBtn');
const movSubmitBtn     = $('movSubmitBtn');

// Contagem
const tabNovo              = $('tabNovo');
const tabContagem          = $('tabContagem');
const startCountBar        = $('startCountBar');
const startCountBtn        = $('startCountBtn');
const cancelCountBtn       = $('cancelCountBtn');
const doneCountBtn         = $('doneCountBtn');
const progressCount        = $('progressCount');
const progressTotal        = $('progressTotal');
const progressPct          = $('progressPct');
const progressFill         = $('progressFill');
const scanCodigo           = $('scanCodigo');
const scanQtd              = $('scanQtd');
const scanAddBtn           = $('scanAddBtn');
const scanSuggestions      = $('scanSuggestions');
const scanFeedback         = $('scanFeedback');
const countListBody        = $('countListBody');
const countEmpty           = $('countEmpty');
const countTotalItens      = $('countTotalItens');

// Relatório
const modalRelatorioOverlay = $('modalRelatorioOverlay');
const closeRelatorioBtn    = $('closeRelatorioBtn');
const relatorioSummary     = $('relatorioSummary');
const relatorioBody        = $('relatorioBody');
const relatorioCancelBtn   = $('relatorioCancelBtn');
const relatorioSaveBtn     = $('relatorioSaveBtn');
const ajustarEstoqueChk    = $('ajustarEstoqueChk');

// Dia
const modalDiaOverlay  = $('modalDiaOverlay');
const closeDiaBtn      = $('closeDiaBtn');
const diaTitle         = $('diaTitle');
const diaSummary       = $('diaSummary');
const diaMovBody       = $('diaMovBody');
const diaMovEmpty      = $('diaMovEmpty');

const levantamentosList   = $('levantamentosList');
const emptyLevantamentos  = $('emptyLevantamentos');
const searchLevantamentos = $('searchLevantamentos');
const tabBadgeCatalogo    = $('tabBadgeCatalogo');
const tabBadgeLevantamentos = $('tabBadgeLevantamentos');

const cloudStatus      = $('cloudStatus');
const cloudStatusText  = $('cloudStatusText');
const toastContainer   = $('toastContainer');

const importCatalogBtn  = $('importCatalogBtn');
const importCatalogFile = $('importCatalogFile');
const templateBtn       = $('templateBtn');
const themeToggleBtn    = $('themeToggleBtn');

/* =========================================================
   UTILITÁRIOS
   ========================================================= */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function normalize(t) { return String(t || '').trim().toLowerCase(); }

function categoriaClass(cat) {
  const map = { 'Uniforme': 'cat-uniforme', 'EPI': 'cat-epi', 'Outros': 'cat-outros' };
  return map[cat] || 'cat-outros';
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${d} de ${meses[Number(m) - 1]} de ${y}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* =========================================================
   TOASTS
   ========================================================= */
function showToast(message, type = 'success') {
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
    warning: 'fa-triangle-exclamation',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : type === 'warning' ? 'warning' : ''}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 2800);
}

/* =========================================================
   STATUS
   ========================================================= */
function setCloudStatus(status, text) {
  cloudStatus.className = `fas ${status === 'online' ? 'fa-cloud online' : status === 'offline' ? 'fa-cloud offline' : 'fa-cloud syncing'}`;
  cloudStatusText.textContent = text;
}

/* =========================================================
   CÁLCULO DE ESTOQUE
   ========================================================= */
function calcularEstoque(codigo) {
  const produto = catalogo.find(p => p.codigo === codigo);
  if (!produto) return 0;

  let saldo = Number(produto.estoqueInicial) || 0;

  movimentacoes
    .filter(m => m.codigo === codigo)
    .forEach(m => {
      const q = Number(m.quantidade) || 0;
      if (m.tipo === 'entrada') saldo += q;
      else if (m.tipo === 'saida') saldo -= q;
      else if (m.tipo === 'ajuste') saldo += q; // ajuste: q pode ser + ou -
    });

  return saldo;
}

function calcularEstoqueAteData(codigo, dataLimite) {
  const produto = catalogo.find(p => p.codigo === codigo);
  if (!produto) return 0;

  let saldo = Number(produto.estoqueInicial) || 0;

  movimentacoes
    .filter(m => m.codigo === codigo && m.data <= dataLimite)
    .forEach(m => {
      const q = Number(m.quantidade) || 0;
      if (m.tipo === 'entrada') saldo += q;
      else if (m.tipo === 'saida') saldo -= q;
      else if (m.tipo === 'ajuste') saldo += q;
    });

  return saldo;
}

/* =========================================================
   FIREBASE — LISTENERS
   ========================================================= */
function iniciarListeners() {
  setCloudStatus('syncing', 'Conectando...');

  onValue(ref(db, 'catalogo'), (snap) => {
    const data = snap.val() || {};
    catalogo = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    renderCatalogo();
    renderModalList();
    atualizarBadges();
    setCloudStatus('online', 'Conectado');
  }, (err) => {
    console.error(err);
    setCloudStatus('offline', 'Erro de conexão');
  });

  onValue(ref(db, 'movimentacoes'), (snap) => {
    const data = snap.val() || {};
    movimentacoes = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    movimentacoes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderCatalogo();
    renderHistorico();
    atualizarBadges();
  }, (err) => {
    console.error(err);
    showToast('Erro ao carregar movimentações.', 'error');
  });

  onValue(ref(db, 'levantamentos'), (snap) => {
    const data = snap.val() || {};
    levantamentos = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    levantamentos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderHistorico();
    atualizarBadges();
  }, (err) => {
    console.error(err);
  });
}

/* =========================================================
   RENDER CATÁLOGO
   ========================================================= */
function renderCatalogo() {
  const term = normalize(searchCatalogo.value);
  let lista = catalogo;

  if (filtroCategoria !== 'todos') lista = lista.filter(p => p.categoria === filtroCategoria);

  if (term) {
    lista = lista.filter(p => {
      const haystack = [p.codigo, p.categoria, p.nome, p.tamanho, p.cor, p.unidade, p.observacao, p.conteudo]
        .map(normalize).join(' | ');
      return haystack.includes(term);
    });
  }

  if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !term);

  totalRegistros.textContent = lista.length;
  mainBody.innerHTML = '';

  if (lista.length === 0) {
    emptyMain.style.display = 'flex';
    emptyMain.innerHTML = catalogo.length === 0
      ? `<i class="fas fa-box-open"></i><strong>Nenhum item cadastrado</strong><span>Clique em "+ Cadastrar Item" para começar.</span>`
      : `<i class="fas fa-search"></i><strong>Nenhum resultado encontrado</strong><span>Tente ajustar a pesquisa ou os filtros.</span>`;
    atualizarResumo();
    return;
  }

  emptyMain.style.display = 'none';

  lista.forEach((item) => {
    const realIndex = catalogo.indexOf(item);
    const estoque = calcularEstoque(item.codigo);

    let estoqueClass = '';
    if (estoque <= 0) estoqueClass = 'zerado';
    else if (estoque < 5) estoqueClass = 'baixo';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-codigo">${escapeHtml(item.codigo)}</span></td>
      <td><span class="cat-badge ${categoriaClass(item.categoria)}">${escapeHtml(item.categoria || 'Outros')}</span></td>
      <td>${escapeHtml(item.nome)}</td>
      <td class="col-qtd"><span class="estoque-badge ${estoqueClass}">${estoque}</span></td>
      <td>${item.conteudo ? `<span class="conteudo-badge">${escapeHtml(item.conteudo)}</span>` : '<span class="tag-sem">—</span>'}</td>
      <td><span class="unidade-badge">${escapeHtml(item.unidade || 'UN')}</span></td>
      <td>${(!item.tamanho || item.tamanho === 'Sem tamanho') ? '<span class="tag-sem">—</span>' : escapeHtml(item.tamanho)}</td>
      <td>${(!item.cor || item.cor === 'Sem cor') ? '<span class="tag-sem">—</span>' : escapeHtml(item.cor)}</td>
      <td>${item.observacao ? escapeHtml(item.observacao) : '<span class="tag-sem">—</span>'}</td>
      <td class="col-actions">
        <div class="actions-cell">
          <button class="btn-icon history" data-codigo="${escapeHtml(item.codigo)}" title="Histórico" type="button">
            <i class="fas fa-clock-rotate-left"></i>
          </button>
          <button class="btn-icon duplicate" data-index="${realIndex}" title="Duplicar" type="button">
            <i class="fas fa-copy"></i>
          </button>
          <button class="btn-icon edit" data-index="${realIndex}" title="Editar" type="button">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" data-index="${realIndex}" title="Excluir" type="button">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    mainBody.appendChild(tr);
  });

  mainBody.querySelectorAll('.btn-icon.edit').forEach(btn =>
    btn.addEventListener('click', () => editCatalogo(Number(btn.dataset.index))));
  mainBody.querySelectorAll('.btn-icon.delete').forEach(btn =>
    btn.addEventListener('click', () => deleteCatalogo(Number(btn.dataset.index))));
  mainBody.querySelectorAll('.btn-icon.duplicate').forEach(btn =>
    btn.addEventListener('click', () => duplicarItem(Number(btn.dataset.index))));
  mainBody.querySelectorAll('.btn-icon.history').forEach(btn =>
    btn.addEventListener('click', () => mostrarHistoricoItem(btn.dataset.codigo)));

  atualizarResumo();
}

function atualizarResumo() {
  sumRegistros.textContent = catalogo.length;

  let total = 0;
  catalogo.forEach(p => { total += calcularEstoque(p.codigo); });
  sumItens.textContent = total;

  sumUniformes.textContent = catalogo.filter(p => p.categoria === 'Uniforme').length;
  sumEpis.textContent = catalogo.filter(p => p.categoria === 'EPI').length;
  if (openFormCount) openFormCount.textContent = catalogo.length;
}

function atualizarBadges() {
  if (tabBadgeCatalogo) tabBadgeCatalogo.textContent = catalogo.length;
  const total = new Set([...movimentacoes.map(m => m.data), ...levantamentos.map(l => l.data)]).size;
  if (tabBadgeLevantamentos) tabBadgeLevantamentos.textContent = total;
}

/* =========================================================
   MODAL CADASTRO
   ========================================================= */
function openModal() {
  modalOverlay.classList.add('active');
  renderModalList();
  setTimeout(() => codigoInput.focus(), 100);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  resetForm();
}

function resetForm() {
  form.reset();
  quantidadeInput.value = 0;
  editingIndex = -1;
  modalTitle.textContent = 'Cadastrar Novo Item';
  addBtn.innerHTML = '<i class="fas fa-plus"></i> Cadastrar Item';
  cancelEditBtn.style.display = 'none';
  const chk = $('salvarContinuar');
  if (chk) chk.checked = false;
}

function validateForm() {
  const codigo = codigoInput.value.trim();
  const categoria = categoriaInput.value;
  const nome = nomeInput.value.trim();
  const qtdRaw = quantidadeInput.value.trim();

  if (!codigo) { showToast('Informe o Código.', 'error'); codigoInput.focus(); return null; }
  if (!categoria) { showToast('Selecione uma Categoria.', 'error'); categoriaInput.focus(); return null; }
  if (!nome) { showToast('Informe o Nome.', 'error'); nomeInput.focus(); return null; }

  let quantidade = 0;
  if (qtdRaw !== '') {
    quantidade = Number(qtdRaw);
    if (!Number.isFinite(quantidade) || quantidade < 0 || !Number.isInteger(quantidade)) {
      showToast('Quantidade deve ser número inteiro positivo.', 'error');
      quantidadeInput.focus(); return null;
    }
  }

  return {
    codigo, categoria, nome,
    estoqueInicial: quantidade,
    conteudo: conteudoInput.value.trim(),
    unidade: unidadeInput.value || 'UN',
    tamanho: tamanhoInput.value.trim() || 'Sem tamanho',
    cor: corInput.value || 'Sem cor',
    observacao: observacaoInput.value.trim(),
  };
}

async function handleSubmit(e) {
  e.preventDefault();
  const data = validateForm();
  if (!data) return;

  const continuar = $('salvarContinuar')?.checked;

  try {
    if (editingIndex >= 0) {
      const item = catalogo[editingIndex];
      await update(ref(db, 'catalogo/' + item.id), data);
      showToast('Item atualizado!', 'success');
      resetForm();
    } else {
      const dup = catalogo.some(p =>
        p.codigo === data.codigo && p.tamanho === data.tamanho && p.cor === data.cor
      );
      if (dup) { showToast('Item duplicado (mesmo código/tam/cor).', 'error'); return; }

      const novoId = uid();
      await set(ref(db, 'catalogo/' + novoId), { ...data, criadoEm: new Date().toISOString() });
      showToast('Item cadastrado!', 'success');

      if (continuar) {
        const cat = categoriaInput.value, un = unidadeInput.value,
              cr = corInput.value, ob = observacaoInput.value;
        form.reset();
        categoriaInput.value = cat; unidadeInput.value = un;
        corInput.value = cr; observacaoInput.value = ob;
        quantidadeInput.value = 0;
        codigoInput.focus();
      } else resetForm();
    }
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar.', 'error');
  }
}

function editCatalogo(index) {
  const p = catalogo[index];
  if (!p) return;
  codigoInput.value = p.codigo;
  categoriaInput.value = p.categoria || 'Outros';
  nomeInput.value = p.nome;
  quantidadeInput.value = p.estoqueInicial ?? 0;
  conteudoInput.value = p.conteudo || '';
  unidadeInput.value = p.unidade || 'UN';
  tamanhoInput.value = (p.tamanho && p.tamanho !== 'Sem tamanho') ? p.tamanho : '';
  corInput.value = p.cor === 'Sem cor' ? '' : p.cor;
  observacaoInput.value = p.observacao || '';
  editingIndex = index;
  modalTitle.textContent = 'Editar Item';
  addBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
  cancelEditBtn.style.display = 'inline-flex';
  const modal = document.querySelector('#modalOverlay .modal');
  if (modal) modal.scrollTo({ top: 0, behavior: 'smooth' });
  codigoInput.focus();
}

function duplicarItem(index) {
  const p = catalogo[index];
  if (!p) return;
  codigoInput.value = p.codigo;
  categoriaInput.value = p.categoria || 'Outros';
  nomeInput.value = p.nome;
  quantidadeInput.value = p.estoqueInicial ?? 0;
  conteudoInput.value = p.conteudo || '';
  unidadeInput.value = p.unidade || 'UN';
  tamanhoInput.value = '';
  corInput.value = p.cor === 'Sem cor' ? '' : p.cor;
  observacaoInput.value = p.observacao || '';
  editingIndex = -1;
  modalTitle.textContent = 'Duplicar Item';
  addBtn.innerHTML = '<i class="fas fa-copy"></i> Criar Cópia';
  cancelEditBtn.style.display = 'inline-flex';
  setTimeout(() => tamanhoInput.focus(), 100);
  showToast('Ajuste o tamanho/cor e clique em Criar Cópia.', 'info');
}

async function deleteCatalogo(index) {
  const p = catalogo[index];
  if (!p) return;
  if (!confirm(`Excluir "${p.nome}"?\n\nMovimentações deste item também serão removidas.`)) return;

  try {
    await remove(ref(db, 'catalogo/' + p.id));
    const movs = movimentacoes.filter(m => m.codigo === p.codigo);
    for (const m of movs) await remove(ref(db, 'movimentacoes/' + m.id));

    if (editingIndex === index) resetForm();
    else if (editingIndex > index) editingIndex--;
    showToast('Item excluído!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir.', 'error');
  }
}

/* =========================================================
   MODAL LISTA
   ========================================================= */
function renderModalList() {
  const term = normalize(modalSearchInput.value);
  let lista = catalogo;
  if (term) {
    lista = catalogo.filter(p => {
      const haystack = [p.codigo, p.categoria, p.nome, p.tamanho, p.cor, p.unidade, p.observacao, p.conteudo]
        .map(normalize).join(' | ');
      return haystack.includes(term);
    });
  }
  modalListCount.textContent = catalogo.length;
  modalListBody.innerHTML = '';

  if (lista.length === 0) {
    modalEmpty.style.display = 'block';
    modalEmpty.textContent = catalogo.length === 0
      ? 'Nenhum item cadastrado ainda.'
      : 'Nenhum item corresponde à pesquisa.';
    return;
  }
  modalEmpty.style.display = 'none';

  lista.forEach(p => {
    const realIndex = catalogo.indexOf(p);
    const isEditing = realIndex === editingIndex;
    const estoque = calcularEstoque(p.codigo);

    const tr = document.createElement('tr');
    if (isEditing) tr.style.background = 'rgba(255,248,230,0.5)';
    tr.innerHTML = `
      <td><span class="badge-codigo">${escapeHtml(p.codigo)}</span></td>
      <td><span class="cat-badge ${categoriaClass(p.categoria)}">${escapeHtml(p.categoria || 'Outros')}</span></td>
      <td>${escapeHtml(p.nome)}</td>
      <td><strong>${estoque}</strong></td>
      <td>${(!p.tamanho || p.tamanho === 'Sem tamanho') ? '<span class="tag-sem">—</span>' : escapeHtml(p.tamanho)}</td>
      <td>${(!p.cor || p.cor === 'Sem cor') ? '<span class="tag-sem">—</span>' : escapeHtml(p.cor)}</td>
      <td class="col-actions">
        <div class="actions-cell">
          <button class="btn-icon duplicate" data-index="${realIndex}" title="Duplicar" type="button"><i class="fas fa-copy"></i></button>
          <button class="btn-icon edit" data-index="${realIndex}" title="Editar" type="button"><i class="fas fa-edit"></i></button>
          <button class="btn-icon delete" data-index="${realIndex}" title="Excluir" type="button"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    modalListBody.appendChild(tr);
  });

  modalListBody.querySelectorAll('.btn-icon.edit').forEach(btn =>
    btn.addEventListener('click', () => editCatalogo(Number(btn.dataset.index))));
  modalListBody.querySelectorAll('.btn-icon.delete').forEach(btn =>
    btn.addEventListener('click', () => deleteCatalogo(Number(btn.dataset.index))));
  modalListBody.querySelectorAll('.btn-icon.duplicate').forEach(btn =>
    btn.addEventListener('click', () => duplicarItem(Number(btn.dataset.index))));
}

/* =========================================================
   MOVIMENTAÇÕES
   ========================================================= */
function abrirModalMov(tipo) {
  movTipoAtual = tipo;
  movForm.reset();
  movQtd.value = 1;
  movData.value = todayStr();
  movInfoBox.style.display = 'none';
  movSuggestions.innerHTML = '';
  movSuggestions.style.display = 'none';

  if (tipo === 'entrada') {
    movTitle.textContent = 'Registrar Entrada';
    movIcon.className = 'fas fa-arrow-down';
    movIcon.style.color = 'var(--success)';
    movSubmitBtn.className = 'btn btn-entrada';
    movSubmitBtn.innerHTML = '<i class="fas fa-arrow-down"></i> Confirmar Entrada';
  } else {
    movTitle.textContent = 'Registrar Saída';
    movIcon.className = 'fas fa-arrow-up';
    movIcon.style.color = 'var(--danger)';
    movSubmitBtn.className = 'btn btn-saida';
    movSubmitBtn.innerHTML = '<i class="fas fa-arrow-up"></i> Confirmar Saída';
  }
  modalMovOverlay.classList.add('active');
  setTimeout(() => movCodigo.focus(), 100);
}

function fecharModalMov() {
  modalMovOverlay.classList.remove('active');
  movTipoAtual = null;
}

function mostrarInfoProduto(codigo) {
  const produto = catalogo.find(p => normalize(p.codigo) === normalize(codigo));
  if (!produto) { movInfoBox.style.display = 'none'; return; }
  const estoque = calcularEstoque(produto.codigo);
  movInfoNome.textContent = `${produto.nome} ${produto.tamanho !== 'Sem tamanho' ? '· ' + produto.tamanho : ''} ${produto.cor !== 'Sem cor' ? '· ' + produto.cor : ''}`;
  movInfoEstoque.textContent = `Estoque atual: ${estoque} ${produto.unidade || 'UN'}`;
  movInfoBox.style.display = 'block';
}

async function registrarMovimentacao(e) {
  e.preventDefault();
  const codigo = movCodigo.value.trim();
  const qtd = Number(movQtd.value);
  const dataMov = movData.value || todayStr();

  if (!codigo) { showToast('Digite o código.', 'error'); movCodigo.focus(); return; }
  if (!Number.isFinite(qtd) || qtd <= 0 || !Number.isInteger(qtd)) {
    showToast('Quantidade inválida.', 'error'); movQtd.focus(); return;
  }

  const produto = catalogo.find(p => normalize(p.codigo) === normalize(codigo));
  if (!produto) { showToast(`Código "${codigo}" não encontrado.`, 'error'); movCodigo.select(); return; }

  if (movTipoAtual === 'saida') {
    const estoque = calcularEstoque(produto.codigo);
    if (qtd > estoque) {
      if (!confirm(`Estoque: ${estoque}. Retirando ${qtd}. Saldo NEGATIVO.\n\nContinuar?`)) return;
    }
  }

  try {
    const movId = uid();
    await set(ref(db, 'movimentacoes/' + movId), {
      tipo: movTipoAtual,
      codigo: produto.codigo,
      nome: produto.nome,
      categoria: produto.categoria,
      quantidade: qtd,
      data: dataMov,
      timestamp: Date.now(),
      criadoEm: new Date().toISOString(),
    });
    const estoqueNovo = calcularEstoque(produto.codigo) + (movTipoAtual === 'entrada' ? qtd : -qtd);
    showToast(`${movTipoAtual === 'entrada' ? 'Entrada' : 'Saída'} de ${qtd} — novo estoque: ${estoqueNovo}`, 'success');
    fecharModalMov();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar.', 'error');
  }
}

/* =========================================================
   SUGESTÕES (genérico)
   ========================================================= */
function renderSuggestions(box, term, onPick) {
  const q = normalize(term);
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }

  const matches = catalogo.filter(p => {
    const haystack = [p.codigo, p.nome, p.categoria, p.tamanho, p.cor].map(normalize).join(' | ');
    return haystack.includes(q);
  }).slice(0, 8);

  if (matches.length === 0) { box.style.display = 'none'; box.innerHTML = ''; return; }

  box.innerHTML = matches.map(p => {
    const estoque = calcularEstoque(p.codigo);
    return `
      <div class="suggestion-item" data-codigo="${escapeHtml(p.codigo)}">
        <div class="info">
          <span class="codigo">${escapeHtml(p.codigo)} · ${escapeHtml(p.categoria)}</span>
          <span class="nome">${escapeHtml(p.nome)}</span>
          <span class="meta">${escapeHtml(p.tamanho)} · ${escapeHtml(p.cor)} · Estoque: ${estoque}</span>
        </div>
      </div>
    `;
  }).join('');
  box.style.display = 'block';

  box.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => onPick(el.dataset.codigo));
  });
}

/* =========================================================
   MODO CONTAGEM
   ========================================================= */
function iniciarContagem() {
  if (catalogo.length === 0) {
    showToast('Cadastre itens antes de iniciar.', 'error'); return;
  }
  if (contagem.length > 0) {
    if (!confirm('Já existe uma contagem em andamento. Descartar e começar nova?')) return;
  }
  contagem = [];
  modoContagem = true;
  tabNovo.classList.remove('active');
  tabContagem.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="novo"]').classList.add('active');

  renderContagem();
  setTimeout(() => scanCodigo.focus(), 150);
  showToast('Levantamento iniciado!', 'info');
}

function cancelarContagem() {
  if (contagem.length > 0 && !confirm('Cancelar o levantamento? Os itens contados serão perdidos.')) return;
  modoContagem = false;
  contagem = [];
  voltarAbaNovo();
  showToast('Levantamento cancelado.', 'info');
}

function voltarAbaNovo() {
  tabContagem.classList.remove('active');
  tabNovo.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="novo"]').classList.add('active');
}

function adicionarContagem() {
  const codigo = scanCodigo.value.trim();
  const qtd = Number(scanQtd.value);

  if (!codigo) { showToast('Digite o código.', 'error'); scanCodigo.focus(); return; }
  if (!Number.isFinite(qtd) || qtd < 0 || !Number.isInteger(qtd)) {
    showToast('Quantidade inválida.', 'error'); scanQtd.focus(); return;
  }

  const produto = catalogo.find(p => normalize(p.codigo) === normalize(codigo));
  if (!produto) { showToast(`Código "${codigo}" não encontrado.`, 'error'); scanCodigo.select(); return; }

  const existente = contagem.findIndex(c => c.codigo === produto.codigo);
  const estoqueAtual = calcularEstoque(produto.codigo);

  if (existente >= 0) {
    if (!confirm(`"${produto.nome}" já foi contado. Substituir o valor anterior?`)) return;
    contagem[existente].quantidadeContada = qtd;
  } else {
    contagem.push({
      codigo: produto.codigo,
      nome: produto.nome,
      categoria: produto.categoria,
      tamanho: produto.tamanho,
      cor: produto.cor,
      unidade: produto.unidade || 'UN',
      estoqueSnapshot: estoqueAtual,
      quantidadeContada: qtd,
      timestamp: Date.now()
    });
  }

  scanFeedback.classList.remove('hidden');
  const diff = qtd - estoqueAtual;
  const diffTxt = diff === 0 ? 'sem diferença' : diff > 0 ? `+${diff} (sobra)` : `${diff} (falta)`;
  scanFeedback.innerHTML = `
    <i class="fas fa-circle-check"></i>
    <div>
      <strong>${escapeHtml(produto.nome)}</strong> — contado: <strong>${qtd}</strong> (estoque: ${estoqueAtual}) — ${diffTxt}
    </div>
  `;

  scanCodigo.value = '';
  scanQtd.value = 0;
  scanSuggestions.style.display = 'none';
  scanCodigo.focus();

  renderContagem();
  showToast('Item contado!', 'success');
}

function removerContagem(codigo) {
  contagem = contagem.filter(c => c.codigo !== codigo);
  renderContagem();
}

function renderContagem() {
  progressCount.textContent = contagem.length;
  progressTotal.textContent = catalogo.length;
  const pct = catalogo.length ? Math.round((contagem.length / catalogo.length) * 100) : 0;
  progressPct.textContent = pct + '%';
  progressFill.style.width = pct + '%';

  countListBody.innerHTML = '';

  if (contagem.length === 0) {
    countEmpty.style.display = 'flex';
    countTotalItens.textContent = '0';
    return;
  }
  countEmpty.style.display = 'none';

  let totalContado = 0;

  contagem.forEach(c => {
    const diff = c.quantidadeContada - c.estoqueSnapshot;
    totalContado += c.quantidadeContada;

    let diffClass = 'zero';
    let rowClass = 'row-ok';
    if (diff > 0) { diffClass = 'pos'; rowClass = 'row-warn'; }
    if (diff < 0) { diffClass = 'neg'; rowClass = 'row-error'; }

    const diffTxt = diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`;

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td><span class="badge-codigo">${escapeHtml(c.codigo)}</span></td>
      <td><span class="cat-badge ${categoriaClass(c.categoria)}">${escapeHtml(c.categoria || 'Outros')}</span></td>
      <td>${escapeHtml(c.nome)}</td>
      <td>${(!c.tamanho || c.tamanho === 'Sem tamanho') ? '<span class="tag-sem">—</span>' : escapeHtml(c.tamanho)}</td>
      <td>${(!c.cor || c.cor === 'Sem cor') ? '<span class="tag-sem">—</span>' : escapeHtml(c.cor)}</td>
      <td class="col-qtd"><strong>${c.estoqueSnapshot}</strong></td>
      <td class="col-qtd"><strong>${c.quantidadeContada}</strong></td>
      <td class="col-qtd"><span class="diff-badge ${diffClass}">${diffTxt}</span></td>
      <td class="col-actions">
        <div class="actions-cell">
          <button class="btn-icon delete" data-codigo="${escapeHtml(c.codigo)}" title="Remover" type="button">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    countListBody.appendChild(tr);
  });

  countTotalItens.textContent = totalContado;

  countListBody.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.addEventListener('click', () => removerContagem(btn.dataset.codigo));
  });
}

function abrirRelatorio() {
  if (contagem.length === 0) {
    showToast('Nenhum item contado. Adicione ao menos um.', 'error');
    return;
  }

  const totalEstoque = contagem.reduce((a, c) => a + c.estoqueSnapshot, 0);
  const totalContado = contagem.reduce((a, c) => a + c.quantidadeContada, 0);
  const itensBatem = contagem.filter(c => c.quantidadeContada === c.estoqueSnapshot).length;
  const itensDif = contagem.length - itensBatem;

  relatorioSummary.innerHTML = `
    <div class="dia-stat">
      <span class="label">Itens conferidos</span>
      <span class="value">${contagem.length}</span>
    </div>
    <div class="dia-stat entrada">
      <span class="label">Estoque sistema</span>
      <span class="value">${totalEstoque}</span>
    </div>
    <div class="dia-stat saldo">
      <span class="label">Total contado</span>
      <span class="value">${totalContado}</span>
    </div>
    <div class="dia-stat diferenca">
      <span class="label">Diferença total</span>
      <span class="value">${totalContado - totalEstoque >= 0 ? '+' : ''}${totalContado - totalEstoque}</span>
    </div>
    <div class="dia-stat">
      <span class="label">Sem diferença</span>
      <span class="value">${itensBatem}</span>
    </div>
    <div class="dia-stat saida">
      <span class="label">Com diferença</span>
      <span class="value">${itensDif}</span>
    </div>
  `;

  relatorioBody.innerHTML = '';
  contagem.forEach(c => {
    const diff = c.quantidadeContada - c.estoqueSnapshot;
    let diffClass = 'zero', rowClass = 'row-ok';
    if (diff > 0) { diffClass = 'pos'; rowClass = 'row-warn'; }
    if (diff < 0) { diffClass = 'neg'; rowClass = 'row-error'; }
    const diffTxt = diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`;

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td><span class="badge-codigo">${escapeHtml(c.codigo)}</span></td>
      <td><span class="cat-badge ${categoriaClass(c.categoria)}">${escapeHtml(c.categoria || 'Outros')}</span></td>
      <td>${escapeHtml(c.nome)}</td>
      <td>${(!c.tamanho || c.tamanho === 'Sem tamanho') ? '<span class="tag-sem">—</span>' : escapeHtml(c.tamanho)}</td>
      <td>${(!c.cor || c.cor === 'Sem cor') ? '<span class="tag-sem">—</span>' : escapeHtml(c.cor)}</td>
      <td><strong>${c.estoqueSnapshot}</strong></td>
      <td><strong>${c.quantidadeContada}</strong></td>
      <td><span class="diff-badge ${diffClass}">${diffTxt}</span></td>
    `;
    relatorioBody.appendChild(tr);
  });

  relatorioPendente = {
    contagem: [...contagem],
    totalEstoque,
    totalContado,
    itensBatem,
    itensDif,
  };

  modalRelatorioOverlay.classList.add('active');
}

async function salvarRelatorio() {
  if (!relatorioPendente) return;

  const ajustar = ajustarEstoqueChk.checked;
  const dataHoje = todayStr();
  const agora = Date.now();

  try {
    // Ajustes (se marcado)
    if (ajustar) {
      for (const c of relatorioPendente.contagem) {
        const diff = c.quantidadeContada - c.estoqueSnapshot;
        if (diff === 0) continue;

        const ajusteId = uid();
        await set(ref(db, 'movimentacoes/' + ajusteId), {
          tipo: 'ajuste',
          codigo: c.codigo,
          nome: c.nome,
          categoria: c.categoria,
          quantidade: diff, // pode ser + ou -
          data: dataHoje,
          timestamp: agora,
          criadoEm: new Date().toISOString(),
          obs: 'Ajuste automático do levantamento',
        });
      }
    }

    // Salva o levantamento no histórico
    const levId = uid();
    const lev = {
      data: dataHoje,
      timestamp: agora,
      criadoEm: new Date().toISOString(),
      totalEstoque: relatorioPendente.totalEstoque,
      totalContado: relatorioPendente.totalContado,
      itensBatem: relatorioPendente.itensBatem,
      itensDif: relatorioPendente.itensDif,
      ajustouEstoque: ajustar,
      itens: relatorioPendente.contagem.map(c => ({
        codigo: c.codigo,
        nome: c.nome,
        categoria: c.categoria,
        tamanho: c.tamanho,
        cor: c.cor,
        unidade: c.unidade,
        estoqueSnapshot: c.estoqueSnapshot,
        quantidadeContada: c.quantidadeContada,
        diferenca: c.quantidadeContada - c.estoqueSnapshot,
      })),
    };
    await set(ref(db, 'levantamentos/' + levId), lev);

    showToast(ajustar ? 'Levantamento salvo e estoque ajustado!' : 'Levantamento salvo!', 'success');
    modalRelatorioOverlay.classList.remove('active');
    modoContagem = false;
    contagem = [];
    relatorioPendente = null;
    voltarAbaNovo();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar levantamento.', 'error');
  }
}

function fecharRelatorio() {
  modalRelatorioOverlay.classList.remove('active');
}

/* =========================================================
   HISTÓRICO
   ========================================================= */
function renderHistorico() {
  const term = normalize(searchLevantamentos.value);

  // Agrupa movimentações por dia
  const porDia = {};
  movimentacoes.forEach(m => {
    if (!porDia[m.data]) porDia[m.data] = [];
    porDia[m.data].push(m);
  });

  // Coleta todas as datas únicas
  const todasDatas = new Set([
    ...Object.keys(porDia),
    ...levantamentos.map(l => l.data)
  ]);

  let datas = [...todasDatas].sort((a, b) => b.localeCompare(a));

  if (term) {
    datas = datas.filter(d => {
      const f = formatDate(d);
      return normalize(f).includes(term) || normalize(d).includes(term);
    });
  }

  levantamentosList.innerHTML = '';

  const items = [];

  datas.forEach(data => {
    // Filtro
    const movsDoDia = porDia[data] || [];
    const levsDoDia = levantamentos.filter(l => l.data === data);

    if (filtroHistorico === 'dia' && movsDoDia.length === 0) return;
    if (filtroHistorico === 'levantamento' && levsDoDia.length === 0) return;

    if (movsDoDia.length > 0) items.push({ tipo: 'dia', data, movs: movsDoDia });
    levsDoDia.forEach(l => items.push({ tipo: 'levantamento', data, lev: l }));
  });

  if (items.length === 0) {
    emptyLevantamentos.style.display = 'flex';
    return;
  }
  emptyLevantamentos.style.display = 'none';

  items.forEach(item => {
    const [y, m, d] = item.data.split('-');
    const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

    let card;

    if (item.tipo === 'dia') {
      const movs = item.movs;
      const entradas = movs.filter(m => m.tipo === 'entrada');
      const saidas = movs.filter(m => m.tipo === 'saida');
      const ajustes = movs.filter(m => m.tipo === 'ajuste');
      const totalEntradas = entradas.reduce((a, m) => a + m.quantidade, 0);
      const totalSaidas = saidas.reduce((a, m) => a + m.quantidade, 0);

      card = document.createElement('div');
      card.className = 'dia-card';
      card.innerHTML = `
        <div class="dia-card-left">
          <div class="dia-date-icon">
            <span class="dia-day">${d}</span>
            <span class="dia-month">${meses[Number(m) - 1]}</span>
          </div>
          <div class="dia-info">
            <h4>${formatDateLong(item.data)} — Movimentações</h4>
            <div class="dia-meta">
              <span><i class="fas fa-list"></i> ${movs.length} registro(s)</span>
              ${totalEntradas > 0 ? `<span class="entrada"><i class="fas fa-arrow-down"></i> +${totalEntradas}</span>` : ''}
              ${totalSaidas > 0 ? `<span class="saida"><i class="fas fa-arrow-up"></i> -${totalSaidas}</span>` : ''}
              ${ajustes.length > 0 ? `<span class="diferenca"><i class="fas fa-sliders"></i> ${ajustes.length} ajuste(s)</span>` : ''}
            </div>
          </div>
        </div>
        <div class="dia-card-right">
          <div class="dia-arrow"><i class="fas fa-chevron-right"></i></div>
        </div>
      `;
      card.addEventListener('click', () => abrirDetalhesDia(item.data));
    } else {
      const l = item.lev;
      const difTotal = l.totalContado - l.totalEstoque;
      card = document.createElement('div');
      card.className = 'dia-card';
      card.innerHTML = `
        <div class="dia-card-left">
          <div class="dia-date-icon levantamento">
            <span class="dia-day">${d}</span>
            <span class="dia-month">${meses[Number(m) - 1]}</span>
          </div>
          <div class="dia-info">
            <h4>${formatDateLong(item.data)} — Levantamento</h4>
            <div class="dia-meta">
              <span><i class="fas fa-clipboard-check"></i> ${l.itens?.length || 0} itens conferidos</span>
              <span class="${difTotal === 0 ? 'entrada' : 'diferenca'}">
                <i class="fas fa-sliders"></i> Diferença total: ${difTotal >= 0 ? '+' : ''}${difTotal}
              </span>
              ${l.ajustouEstoque ? `<span class="entrada"><i class="fas fa-check"></i> Estoque ajustado</span>` : ''}
            </div>
          </div>
        </div>
        <div class="dia-card-right">
          <div class="dia-arrow"><i class="fas fa-chevron-right"></i></div>
        </div>
      `;
      card.addEventListener('click', () => abrirDetalhesLevantamento(l));
    }

    levantamentosList.appendChild(card);
  });

  atualizarBadges();
}

function abrirDetalhesDia(data) {
  diaSelecionado = data;
  diaTitle.textContent = formatDateLong(data);

  const movs = movimentacoes.filter(m => m.data === data);
  const entradas = movs.filter(m => m.tipo === 'entrada');
  const saidas = movs.filter(m => m.tipo === 'saida');
  const ajustes = movs.filter(m => m.tipo === 'ajuste');
  const totalEntradas = entradas.reduce((a, m) => a + m.quantidade, 0);
  const totalSaidas = saidas.reduce((a, m) => a + m.quantidade, 0);
  const totalAjustes = ajustes.reduce((a, m) => a + m.quantidade, 0);

  diaSummary.innerHTML = `
    <div class="dia-stat">
      <span class="label">Movimentações</span>
      <span class="value">${movs.length}</span>
    </div>
    <div class="dia-stat entrada">
      <span class="label">Entradas</span>
      <span class="value">+${totalEntradas}</span>
    </div>
    <div class="dia-stat saida">
      <span class="label">Saídas</span>
      <span class="value">-${totalSaidas}</span>
    </div>
    <div class="dia-stat diferenca">
      <span class="label">Ajustes</span>
      <span class="value">${totalAjustes >= 0 ? '+' : ''}${totalAjustes}</span>
    </div>
  `;

  diaMovBody.innerHTML = '';
  if (movs.length === 0) {
    diaMovEmpty.style.display = 'block';
  } else {
    diaMovEmpty.style.display = 'none';
    movs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    movs.forEach(m => {
      const hora = new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const estoqueDepois = calcularEstoqueAteData(m.codigo, data);

      let tipoLabel, tipoClass;
      if (m.tipo === 'entrada') { tipoLabel = '↓ ENTRADA'; tipoClass = 'cat-uniforme'; }
      else if (m.tipo === 'saida') { tipoLabel = '↑ SAÍDA'; tipoClass = 'cat-epi'; }
      else { tipoLabel = '⚙ AJUSTE'; tipoClass = 'cat-outros'; }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${hora}</td>
        <td><span class="cat-badge ${tipoClass}">${tipoLabel}</span></td>
        <td><span class="badge-codigo">${escapeHtml(m.codigo)}</span></td>
        <td>${escapeHtml(m.nome)}</td>
        <td><strong>${m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '-' : m.quantidade >= 0 ? '+' : ''}${m.quantidade}</strong></td>
        <td><strong>${estoqueDepois}</strong></td>
        <td class="col-actions">
          <div class="actions-cell">
            <button class="btn-icon delete" data-mov-id="${m.id}" title="Excluir" type="button">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      diaMovBody.appendChild(tr);
    });

    diaMovBody.querySelectorAll('.btn-icon.delete').forEach(btn => {
      btn.addEventListener('click', () => excluirMovimentacao(btn.dataset.movId));
    });
  }

  modalDiaOverlay.classList.add('active');
}

async function excluirMovimentacao(movId) {
  if (!confirm('Excluir esta movimentação?')) return;
  try {
    await remove(ref(db, 'movimentacoes/' + movId));
    showToast('Movimentação excluída!', 'success');
    abrirDetalhesDia(diaSelecionado);
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir.', 'error');
  }
}

function fecharModalDia() {
  modalDiaOverlay.classList.remove('active');
  diaSelecionado = null;
}

function abrirDetalhesLevantamento(lev) {
  diaTitle.textContent = 'Levantamento — ' + formatDateLong(lev.data);

  const difTotal = lev.totalContado - lev.totalEstoque;

  diaSummary.innerHTML = `
    <div class="dia-stat">
      <span class="label">Itens conferidos</span>
      <span class="value">${lev.itens?.length || 0}</span>
    </div>
    <div class="dia-stat entrada">
      <span class="label">Estoque sistema</span>
      <span class="value">${lev.totalEstoque}</span>
    </div>
    <div class="dia-stat saldo">
      <span class="label">Total contado</span>
      <span class="value">${lev.totalContado}</span>
    </div>
    <div class="dia-stat diferenca">
      <span class="label">Diferença</span>
      <span class="value">${difTotal >= 0 ? '+' : ''}${difTotal}</span>
    </div>
  `;

  diaMovBody.innerHTML = '';
  const itens = lev.itens || [];
  if (itens.length === 0) {
    diaMovEmpty.style.display = 'block';
  } else {
    diaMovEmpty.style.display = 'none';
    itens.forEach(c => {
      const diff = c.diferenca ?? (c.quantidadeContada - c.estoqueSnapshot);
      let diffClass = 'zero', rowClass = 'row-ok';
      if (diff > 0) { diffClass = 'pos'; rowClass = 'row-warn'; }
      if (diff < 0) { diffClass = 'neg'; rowClass = 'row-error'; }
      const diffTxt = diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`;

      const tr = document.createElement('tr');
      tr.className = rowClass;
      tr.innerHTML = `
        <td><span class="badge-codigo">${escapeHtml(c.codigo)}</span></td>
        <td><span class="cat-badge ${categoriaClass(c.categoria)}">${escapeHtml(c.categoria || 'Outros')}</span></td>
        <td>${escapeHtml(c.nome)}</td>
        <td>${(!c.tamanho || c.tamanho === 'Sem tamanho') ? '<span class="tag-sem">—</span>' : escapeHtml(c.tamanho)}</td>
        <td>${(!c.cor || c.cor === 'Sem cor') ? '<span class="tag-sem">—</span>' : escapeHtml(c.cor)}</td>
        <td><strong>${c.estoqueSnapshot}</strong></td>
        <td><strong>${c.quantidadeContada}</strong></td>
        <td><span class="diff-badge ${diffClass}">${diffTxt}</span></td>
        <td></td>
      `;
      diaMovBody.appendChild(tr);
    });
  }

  modalDiaOverlay.classList.add('active');
}

/* =========================================================
   HISTÓRICO ITEM
   ========================================================= */
function mostrarHistoricoItem(codigo) {
  const produto = catalogo.find(p => p.codigo === codigo);
  if (!produto) return;

  const movs = movimentacoes.filter(m => m.codigo === codigo);
  if (movs.length === 0) {
    showToast(`Nenhuma movimentação para "${produto.nome}".`, 'info'); return;
  }

  const texto = movs
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .map(m => {
      const data = formatDate(m.data);
      const sinal = m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '-' : (m.quantidade >= 0 ? '+' : '');
      return `${data} — ${m.tipo.toUpperCase()} ${sinal}${Math.abs(m.quantidade)}`;
    }).join('\n');

  alert(`Histórico de "${produto.nome}" (${codigo})\n\n${texto}\n\nEstoque atual: ${calcularEstoque(codigo)}`);
}

/* =========================================================
   EXPORTAR EXCEL
   ========================================================= */
function exportExcel() {
  if (catalogo.length === 0) { showToast('Não há itens.', 'error'); return; }

  const dados = catalogo.map(p => ({
    Código: p.codigo, Categoria: p.categoria || 'Outros', Item: p.nome,
    Estoque: calcularEstoque(p.codigo), 'Estoque Inicial': p.estoqueInicial || 0,
    Unidade: p.unidade || 'UN', Tamanho: p.tamanho || '', Cor: p.cor || '',
    Conteúdo: p.conteudo || '', Observação: p.observacao || '',
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  ws['!cols'] = [{wch:12},{wch:14},{wch:28},{wch:10},{wch:14},{wch:10},{wch:10},{wch:12},{wch:16},{wch:30}];

  const movDados = movimentacoes.map(m => ({
    Data: formatDate(m.data), Tipo: m.tipo.toUpperCase(),
    Código: m.codigo, Item: m.nome, Quantidade: m.quantidade,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
  if (movDados.length > 0) {
    const wsMov = XLSX.utils.json_to_sheet(movDados);
    wsMov['!cols'] = [{wch:12},{wch:10},{wch:12},{wch:28},{wch:12}];
    XLSX.utils.book_append_sheet(wb, wsMov, 'Movimentações');
  }

  if (levantamentos.length > 0) {
    const levDados = [];
    levantamentos.forEach(l => {
      l.itens?.forEach(c => {
        levDados.push({
          Data: formatDate(l.data), Código: c.codigo, Categoria: c.categoria,
          Item: c.nome, Tamanho: c.tamanho, Cor: c.cor,
          Estoque: c.estoqueSnapshot, Contado: c.quantidadeContada,
          Diferença: c.diferenca,
        });
      });
    });
    if (levDados.length > 0) {
      const wsLev = XLSX.utils.json_to_sheet(levDados);
      wsLev['!cols'] = [{wch:12},{wch:12},{wch:14},{wch:28},{wch:8},{wch:10},{wch:10},{wch:10},{wch:10}];
      XLSX.utils.book_append_sheet(wb, wsLev, 'Levantamentos');
    }
  }

  XLSX.writeFile(wb, `estoque_${todayStr()}.xlsx`);
  showToast('Excel exportado!', 'success');
}

/* =========================================================
   IMPRESSÃO
   ========================================================= */
function printList() {
  const win = window.open('', '_blank');
  const html = `
    <html><head><title>Levantamento</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 16px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10pt; }
      th, td { border: 1px solid #333; padding: 5px 6px; text-align: left; }
      th { background: #e6e6e6; font-weight: bold; }
      .meta { margin-top: 15px; font-size: 10pt; line-height: 1.8; }
    </style></head><body>
      <h1>LEVANTAMENTO DE UNIFORMES E EPIs</h1>
      <div class="meta">
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        <p><strong>Responsável:</strong> _________________________</p>
      </div>
      <table>
        <thead><tr>
          <th>Código</th><th>Categoria</th><th>Item</th><th>Estoque</th>
          <th>Unid.</th><th>Tam.</th><th>Cor</th><th>Observação</th>
        </tr></thead>
        <tbody>
          ${catalogo.map(p => `
            <tr>
              <td>${escapeHtml(p.codigo)}</td>
              <td>${escapeHtml(p.categoria || '')}</td>
              <td>${escapeHtml(p.nome)}</td>
              <td>${calcularEstoque(p.codigo)}</td>
              <td>${escapeHtml(p.unidade || 'UN')}</td>
              <td>${(!p.tamanho || p.tamanho === 'Sem tamanho') ? '' : escapeHtml(p.tamanho)}</td>
              <td>${(!p.cor || p.cor === 'Sem cor') ? '' : escapeHtml(p.cor)}</td>
              <td>${escapeHtml(p.observacao || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body></html>
  `;
  win.document.write(html);
  win.document.close();
  win.print();
}

/* =========================================================
   IMPORTAÇÃO EXCEL
   ========================================================= */
const COLUMN_MAP = {
  codigo:      ['codigo', 'código', 'cod', 'cod.', 'code', 'sku', 'id'],
  categoria:   ['categoria', 'category', 'tipo', 'grupo'],
  nome:        ['nome', 'item', 'descricao', 'descrição', 'produto', 'name'],
  quantidade:  ['quantidade', 'qtd', 'qtd.', 'quant', 'qtde', 'estoque', 'saldo'],
  conteudo:    ['conteudo', 'conteúdo', 'embalagem', 'pack'],
  unidade:     ['unidade', 'unid', 'un', 'und', 'medida', 'unit'],
  tamanho:     ['tamanho', 'tam', 'size'],
  cor:         ['cor', 'color'],
  observacao:  ['observacao', 'observação', 'obs', 'nota'],
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function findColumnKey(headerName) {
  const norm = normalizeHeader(headerName);
  for (const [key, aliases] of Object.entries(COLUMN_MAP)) {
    if (aliases.some(a => normalizeHeader(a) === norm)) return key;
  }
  return null;
}

function normalizeCategoria(raw) {
  if (!raw) return 'Outros';
  const cat = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (cat.includes('uniform')) return 'Uniforme';
  if (cat.includes('epi')) return 'EPI';
  return 'Outros';
}

function mapRowToItem(row, headerMap) {
  const item = {};
  for (const [colName, key] of Object.entries(headerMap)) {
    if (!key) continue;
    const raw = row[colName];
    if (raw === undefined || raw === null || raw === '') continue;

    if (key === 'quantidade') {
      const n = Number(String(raw).replace(/[^\d.-]/g, ''));
      item.estoqueInicial = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    } else {
      item[key] = String(raw).trim();
    }
  }
  item.categoria = normalizeCategoria(item.categoria);
  item.estoqueInicial = item.estoqueInicial || 0;
  item.unidade = item.unidade || 'UN';
  item.tamanho = item.tamanho || 'Sem tamanho';
  item.cor = item.cor || 'Sem cor';
  item.conteudo = item.conteudo || '';
  item.observacao = item.observacao || '';
  return item;
}

function importCatalogFromExcel(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows || rows.length === 0) { showToast('Planilha vazia.', 'error'); return; }

      const headerMap = {};
      Object.keys(rows[0]).forEach(h => { headerMap[h] = findColumnKey(h); });

      const hasCodigo = Object.values(headerMap).includes('codigo');
      const hasNome = Object.values(headerMap).includes('nome');
      if (!hasCodigo && !hasNome) { showToast('Coluna "Código" ou "Nome" obrigatória.', 'error'); return; }

      const itens = rows.map(row => mapRowToItem(row, headerMap)).filter(it => it.codigo || it.nome);
      if (itens.length === 0) { showToast('Nenhum item válido.', 'error'); return; }

      let autoCode = 9000;
      itens.forEach(it => {
        if (!it.codigo) {
          while (catalogo.some(c => c.codigo === String(autoCode)) || itens.some(i => i.codigo === String(autoCode))) autoCode++;
          it.codigo = String(autoCode++);
        }
      });

      const substituir = confirm(
        `Encontrados ${itens.length} item(ns).\n\n` +
        `OK = SUBSTITUIR catálogo\nCancelar = ADICIONAR aos existentes`
      );

      setCloudStatus('syncing', 'Importando...');
      if (substituir) for (const c of catalogo) await remove(ref(db, 'catalogo/' + c.id));

      let importados = 0, duplicados = 0;
      for (const it of itens) {
        const dup = catalogo.some(p => p.codigo === it.codigo &&
          (p.tamanho || 'Sem tamanho') === it.tamanho && (p.cor || 'Sem cor') === it.cor);
        if (dup && !substituir) { duplicados++; continue; }

        const novoId = uid();
        await set(ref(db, 'catalogo/' + novoId), { ...it, criadoEm: new Date().toISOString() });
        importados++;
      }

      setCloudStatus('online', 'Conectado');
      let msg = `${importados} item(ns) importado(s)!`;
      if (duplicados > 0) msg += ` (${duplicados} ignorado(s))`;
      showToast(msg, 'success');
    } catch (err) {
      console.error(err);
      setCloudStatus('offline', 'Erro');
      showToast('Erro ao ler Excel.', 'error');
    } finally {
      importCatalogFile.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportTemplateExcel() {
  const modelo = [
    { 'Código': '1001', 'Categoria': 'Uniforme', 'Nome': 'Camiseta Polo', 'Quantidade': 10, 'Conteúdo': '', 'Unidade': 'UN', 'Tamanho': 'M', 'Cor': 'Azul', 'Observação': 'Exemplo' },
    { 'Código': '2001', 'Categoria': 'EPI', 'Nome': 'Capacete de Segurança', 'Quantidade': 25, 'Conteúdo': '', 'Unidade': 'UN', 'Tamanho': '', 'Cor': 'Branco', 'Observação': 'CA 31469' },
  ];
  const ws = XLSX.utils.json_to_sheet(modelo);
  ws['!cols'] = [{wch:10},{wch:14},{wch:30},{wch:12},{wch:14},{wch:10},{wch:10},{wch:12},{wch:25}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  XLSX.writeFile(wb, 'modelo_catalogo.xlsx');
  showToast('Modelo exportado!', 'info');
}

/* =========================================================
   ABAS
   ========================================================= */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'novo') {
        if (modoContagem) {
          tabNovo.classList.remove('active');
          tabContagem.classList.add('active');
        } else {
          tabContagem.classList.remove('active');
          tabNovo.classList.add('active');
        }
        document.getElementById('tabHistorico').classList.remove('active');
      } else if (tab === 'historico') {
        tabNovo.classList.remove('active');
        tabContagem.classList.remove('active');
        document.getElementById('tabHistorico').classList.add('active');
        renderHistorico();
      }
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/* =========================================================
   TEMA ESCURO
   ========================================================= */
function initTheme() {
  const saved = localStorage.getItem('theme_levantamento') || 'light';
  if (saved === 'dark') document.body.classList.add('dark');
  atualizarIconeTema();

  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme_levantamento', isDark ? 'dark' : 'light');
    atualizarIconeTema();
  });
}

function atualizarIconeTema() {
  const isDark = document.body.classList.contains('dark');
  themeToggleBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

/* =========================================================
   ENTER INTELIGENTE
   ========================================================= */
function initEnterInteligente() {
  const campos = [codigoInput, categoriaInput, nomeInput, quantidadeInput,
                  conteudoInput, unidadeInput, tamanhoInput, corInput, observacaoInput];

  campos.forEach((campo, idx) => {
    if (!campo) return;
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (idx < campos.length - 1) campos[idx + 1].focus();
        else form.requestSubmit();
      }
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault(); resetForm(); openModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (modalOverlay.classList.contains('active')) { e.preventDefault(); form.requestSubmit(); }
    }
  });
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
function init() {
  iniciarListeners();
  initTabs();
  initTheme();
  initEnterInteligente();

  /* Cadastro */
  openFormBtn.addEventListener('click', () => { resetForm(); openModal(); });
  closeModalBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  form.addEventListener('submit', handleSubmit);
  cancelEditBtn.addEventListener('click', resetForm);
  modalSearchInput.addEventListener('input', renderModalList);

  /* Filtros */
  searchCatalogo.addEventListener('input', renderCatalogo);
  clearSearchBtn?.addEventListener('click', () => {
    searchCatalogo.value = ''; renderCatalogo(); searchCatalogo.focus();
  });
  categoryFilters.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      categoryFilters.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filtroCategoria = chip.dataset.cat;
      renderCatalogo();
    });
  });

  /* Filtro histórico */
  document.querySelectorAll('[data-hist]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-hist]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filtroHistorico = chip.dataset.hist;
      renderHistorico();
    });
  });

  /* Movimentações */
  btnEntrada.addEventListener('click', () => abrirModalMov('entrada'));
  btnSaida.addEventListener('click', () => abrirModalMov('saida'));
  closeMovBtn.addEventListener('click', fecharModalMov);
  cancelMovBtn.addEventListener('click', fecharModalMov);
  modalMovOverlay.addEventListener('click', e => { if (e.target === modalMovOverlay) fecharModalMov(); });
  movForm.addEventListener('submit', registrarMovimentacao);

  movCodigo.addEventListener('input', e => {
    renderSuggestions(movSuggestions, e.target.value, (cod) => {
      movCodigo.value = cod;
      movSuggestions.style.display = 'none';
      mostrarInfoProduto(cod);
      movQtd.focus(); movQtd.select();
    });
    mostrarInfoProduto(e.target.value);
  });

  /* Contagem */
  startCountBtn.addEventListener('click', iniciarContagem);
  cancelCountBtn.addEventListener('click', cancelarContagem);
  doneCountBtn.addEventListener('click', abrirRelatorio);
  scanAddBtn.addEventListener('click', adicionarContagem);

  scanCodigo.addEventListener('input', e => {
    renderSuggestions(scanSuggestions, e.target.value, (cod) => {
      scanCodigo.value = cod;
      scanSuggestions.style.display = 'none';
      scanQtd.focus(); scanQtd.select();
    });
  });
  scanCodigo.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); scanQtd.focus(); scanQtd.select(); }
  });
  scanQtd.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); adicionarContagem(); }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.scanner-code-group')) scanSuggestions.style.display = 'none';
  });

  /* Relatório */
  closeRelatorioBtn.addEventListener('click', fecharRelatorio);
  relatorioCancelBtn.addEventListener('click', fecharRelatorio);
  relatorioSaveBtn.addEventListener('click', salvarRelatorio);
  modalRelatorioOverlay.addEventListener('click', e => { if (e.target === modalRelatorioOverlay) fecharRelatorio(); });

  /* Dia */
  closeDiaBtn.addEventListener('click', fecharModalDia);
  modalDiaOverlay.addEventListener('click', e => { if (e.target === modalDiaOverlay) fecharModalDia(); });

  /* Histórico */
  searchLevantamentos.addEventListener('input', renderHistorico);

  /* Exportar/Importar */
  exportExcelBtn.addEventListener('click', exportExcel);
  printBtn.addEventListener('click', printList);

  importCatalogBtn.addEventListener('click', () => importCatalogFile.click());
  importCatalogFile.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) importCatalogFromExcel(file);
  });
  templateBtn.addEventListener('click', exportTemplateExcel);

  /* ESC */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modalOverlay.classList.contains('active')) closeModal();
      if (modalMovOverlay.classList.contains('active')) fecharModalMov();
      if (modalDiaOverlay.classList.contains('active')) fecharModalDia();
      if (modalRelatorioOverlay.classList.contains('active')) fecharRelatorio();
      if (scanSuggestions.style.display === 'block') scanSuggestions.style.display = 'none';
      if (movSuggestions.style.display === 'block') movSuggestions.style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);