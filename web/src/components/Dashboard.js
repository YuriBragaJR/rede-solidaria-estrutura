import { supabase } from '../services/supabase.js';

const categories = ['Padaria', 'Hortifruti', 'Restaurante', 'Supermercado', 'Laticínios', 'Mercado'];
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const moneylessDate = (value) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const fmt = (value, digits = 0) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });

export function renderDashboard(root) {
  const state = { user: null, profile: null, view: 'overview', donations: [], profiles: [], audit: [], page: 0, pageSize: 10, query: '', status: 'all', category: 'all', from: '', to: '', sort: 'created_at', direction: 'desc' };
  showLogin();

  function showLogin(message = '') {
    root.innerHTML = `<main class="auth-shell"><section class="auth-card"><img class="auth-logo" src="/images/nutre-logo.png" alt="Nutre" /><p class="eyebrow">CENTRO DE COMANDO</p><h1>Nutre <span>Vidas</span></h1><p class="intro">Entre para acompanhar doações, operações e impacto da sua organização.</p>${message ? `<div class="auth-error" role="alert">${esc(message)}</div>` : ''}<form id="login-form" class="auth-form"><label>E-mail<input name="email" type="email" autocomplete="username" required placeholder="voce@empresa.com" /></label><label>Senha<input name="password" type="password" autocomplete="current-password" required placeholder="Sua senha" /></label><button class="button primary" type="submit">Entrar no painel <span>→</span></button><p class="auth-footnote">Use a mesma conta do aplicativo Nutre.</p></form></section><p class="auth-caption">Nutre Vidas · Rede de alimentos solidária</p></main>`;
    root.querySelector('#login-form').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Entrando…';
      const values = Object.fromEntries(new FormData(form));
      const { data, error } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
      if (error) { button.disabled = false; button.innerHTML = 'Entrar no painel <span>→</span>'; return showLogin(error.message); }
      await enter(data.user);
    });
  }

  async function enter(user) {
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error || !profile) { await supabase.auth.signOut(); return showLogin(error?.message || 'Esta conta ainda não tem um perfil Nutre.'); }
    if (profile.is_active === false) { await supabase.auth.signOut(); return showLogin('Esta conta está suspensa. Fale com a equipe Nutre.'); }
    state.user = user; state.profile = profile; state.view = 'overview'; await loadDonations(); renderShell(); renderView();
  }

  function renderShell() {
    const admin = state.profile.role === 'admin';
    const orgName = state.profile.business_name || state.profile.institution_name || state.profile.responsible_name || 'Minha organização';
    const nav = [['overview', '▦', 'Dashboard'], ['donations', '▤', 'Doações'], ...(admin ? [['users', '♙', 'Usuários'], ['reports', '▥', 'Relatórios'], ['audit', '◷', 'Auditoria']] : [['reports', '▥', 'Relatórios']]), ['settings', '⚙', 'Configurações']];
    root.innerHTML = `<a class="skip-link" href="#main-content">Pular para o conteúdo</a><div class="app-frame"><aside class="app-sidebar"><a href="#" class="app-brand"><img src="/images/nutre-logo.png" alt="Nutre Vidas" /><span>CENTRO DE GESTÃO</span></a><div class="org-switch"><span class="org-avatar" aria-hidden="true">${esc(orgName.slice(0, 1).toUpperCase())}</span><span><b>${esc(orgName)}</b><small>${admin ? 'Administrador' : state.profile.role === 'merchant' ? 'Doador' : 'Receptor'}</small></span><span class="org-chevron" aria-hidden="true">⌄</span></div><p class="sidebar-label">ESPAÇO DE TRABALHO</p><nav class="app-nav" aria-label="Navegação principal">${nav.map(([id, icon, label]) => `<button class="nav-item ${state.view === id ? 'active' : ''}" data-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${id === 'users' ? '<small class="nav-badge" aria-label="Somente administradores">ADMIN</small>' : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-mission"><span>IMPACTO EM REDE</span><p>Alimento que chega. Desperdício que não acontece.</p></div><button class="account-button" id="logout"><span class="org-avatar small" aria-hidden="true">${esc(orgName.slice(0, 1).toUpperCase())}</span><span><b>${esc(state.profile.responsible_name || orgName)}</b><small>${esc(state.user.email)}</small></span><span class="logout-icon" aria-hidden="true">↗</span></button></div></aside><main class="workspace" id="main-content" tabindex="-1"><header class="workspace-header"><div class="mobile-brand"><img src="/images/nutre-logo.png" alt="Nutre" /></div><div class="breadcrumb"><span>Nutre Vidas</span><b aria-hidden="true">/</b><strong>${nav.find((item) => item[0] === state.view)?.[2] || 'Dashboard'}</strong></div><div class="workspace-actions"><span class="header-date">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="account-chip">${esc(state.profile.responsible_name || orgName)}</span><button class="logout-mobile" id="logout-mobile" aria-label="Sair da conta">↗</button></div></header><div class="workspace-content"><div id="notice" class="notice" role="status" aria-live="polite"></div><section id="view" aria-label="Conteúdo da página"></section></div><footer class="workspace-footer"><span>© ${new Date().getFullYear()} Nutre Vidas</span><span>Alimento compartilhado, comunidade fortalecida.</span><span>Versão de gestão</span></footer></main></div>`;
    root.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { state.view = button.dataset.view; state.page = 0; renderShell(); renderView(); }));
    root.querySelector('#logout').addEventListener('click', logout); root.querySelector('#logout-mobile').addEventListener('click', logout);
  }

  async function loadDonations() {
    let query = supabase.from('donations').select('*').order('created_at', { ascending: false });
    if (state.profile?.role === 'merchant') query = query.eq('merchant_id', state.user.id);
    if (state.profile?.role === 'volunteer') query = query.eq('reserved_by', state.user.id);
    const { data, error } = await query;
    if (error) { notify(error.message, 'error'); return; }
    state.donations = data || [];
  }

  function notify(text, kind = 'success') {
    const node = root.querySelector('#notice'); if (!node) return;
    node.textContent = text; node.className = `notice visible ${kind}`;
    window.setTimeout(() => node.classList.remove('visible'), 6000);
  }

  function renderView() {
    const target = root.querySelector('#view'); if (!target) return;
    if (state.view === 'overview') renderOverview(target);
    else if (state.view === 'donations') renderDonations(target);
    else if (state.view === 'users' && state.profile.role === 'admin') renderUsers(target);
    else if (state.view === 'reports') renderReports(target);
    else if (state.view === 'audit' && state.profile.role === 'admin') renderAudit(target);
    else renderSettings(target);
    const heading = target.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    document.title = `Nutre Vidas | ${({ overview: 'Dashboard', donations: 'Doações', users: 'Usuários', reports: 'Relatórios', audit: 'Auditoria', settings: 'Configurações' })[state.view] || 'Painel'}`;
  }

  function renderOverview(target) {
    const all = state.donations; const done = all.filter((d) => d.status === 'retirado'); const reserved = all.filter((d) => d.status === 'reservado');
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthly = all.filter((d) => new Date(d.created_at) >= monthStart);
    const kilos = done.reduce((n, d) => n + Number(d.estimated_weight_kg || 0), 0);
    const meals = monthly.filter((d) => d.status === 'retirado').reduce((n, d) => n + Number(d.people_served || 0), 0);
    const completion = all.length ? Math.round((done.length / all.length) * 100) : 0;
    const admin = state.profile.role === 'admin';
    target.innerHTML = `<div class="page-heading dashboard-heading"><div><p class="eyebrow">VISÃO GERAL</p><h1>Olá, ${esc((state.profile.responsible_name || 'equipe').split(' ')[0])} <span class="wave"></span></h1><p class="intro">Aqui está o resumo do impacto ${admin ? 'da rede Nutre' : 'da sua organização'}.</p></div>${['merchant', 'admin'].includes(state.profile.role) ? '<button class="button primary" id="new-donation">＋ Nova doação</button>' : ''}</div>
      <div class="metric-grid"><article class="metric-card metric-green"><span class="metric-icon">♧</span><span class="metric-label">ALIMENTOS SALVOS</span><b>${fmt(kilos, 1)} <small>kg</small></b><span class="metric-caption">Estimativa das coletas concluídas</span></article><article class="metric-card metric-orange"><span class="metric-icon">♡</span><span class="metric-label">REFEIÇÕES DOADAS</span><b>${fmt(meals)}</b><span class="metric-caption">Pessoas atendidas registradas</span></article><article class="metric-card metric-blue"><span class="metric-icon">✓</span><span class="metric-label">COLETAS CONCLUÍDAS</span><b>${fmt(done.length)}</b><span class="metric-caption">${fmt(reserved.length)} aguardando retirada</span></article><article class="metric-card metric-purple"><span class="metric-icon">↗</span><span class="metric-label">DESPERDÍCIO EVITADO</span><b>${completion}<small>%</small></b><span class="metric-caption">Coletas concluídas no período</span></article></div>
      <div class="analytics-grid"><section class="panel chart-panel"><div class="panel-heading"><div><p class="eyebrow">MOVIMENTO DA REDE</p><h2>Doações ao longo do mês</h2></div><span class="period-chip">Este mês</span></div>${renderWeeklyChart(monthly)}</section><section class="panel category-panel"><div class="panel-heading"><div><p class="eyebrow">ALIMENTOS</p><h2>Categorias doadas</h2></div></div>${renderCategoryChart(all)}</section></div>
      <section class="panel activity-panel"><div class="panel-heading"><div><p class="eyebrow">ACOMPANHAMENTO</p><h2>Atividade recente</h2></div><button class="text-button" id="all-donations">Ver doações →</button></div>${renderRecent(all)}</section>`;
    target.querySelector('#new-donation')?.addEventListener('click', () => { state.view = 'donations'; renderShell(); renderDonations(root.querySelector('#view'), true); });
    target.querySelector('#all-donations').addEventListener('click', () => { state.view = 'donations'; renderShell(); renderView(); });
  }

  function renderWeeklyChart(items) {
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weeks = Array.from({ length: 7 }, (_, i) => { const start = new Date(monday); start.setDate(start.getDate() - (6 - i) * 7); return start; });
    const counts = weeks.map((start, i) => { const end = new Date(start); end.setDate(end.getDate() + 7); return items.filter((item) => { const date = new Date(item.created_at); return date >= start && date < end; }).length; });
    const max = Math.max(1, ...counts);
    return `<div class="chart-bars">${counts.map((count, i) => `<div class="chart-column"><div class="bar-track"><span class="bar-fill" style="height:${Math.max(5, count / max * 100)}%" title="${count} doações"></span></div><small>${weeks[i].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small></div>`).join('')}</div><div class="chart-legend"><i></i> Doações publicadas · últimas 7 semanas</div>`;
  }
  function renderCategoryChart(items) {
    const counts = categories.map((category) => ({ category, count: items.filter((d) => d.category === category).length })).filter((x) => x.count).sort((a, b) => b.count - a.count).slice(0, 5);
    if (!counts.length) return '<p class="chart-empty">As categorias aparecerão quando houver doações.</p>';
    const max = Math.max(...counts.map((x) => x.count));
    return `<div class="category-bars">${counts.map((item, i) => `<div class="category-bar-row"><span>${esc(item.category)}</span><div><i class="cat-bar c${i}" style="width:${Math.max(5, item.count / max * 100)}%"></i></div><b>${item.count}</b></div>`).join('')}</div>`;
  }
  function renderRecent(items) {
    if (!items.length) return '<p class="chart-empty">As movimentações recentes aparecerão aqui.</p>';
    return `<div class="activity-list">${items.slice(0, 5).map((item) => `<div class="activity-row"><span class="activity-dot ${item.status === 'retirado' ? 'done' : ''}"></span><div><b>${esc(item.title || 'Doação')}</b><small>${esc(item.merchant_name || state.profile.business_name || 'Parceiro Nutre')} · ${new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></div><span class="activity-status">${esc(item.status || 'disponivel')}</span></div>`).join('')}</div>`;
  }

  function renderDonations(target, showForm = false) {
    const categoriesOptions = ['all', ...categories];
    const canCreate = ['merchant', 'admin'].includes(state.profile.role);
    target.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GESTÃO OPERACIONAL</p><h1>Doações</h1><p class="intro">Consulte, filtre e acompanhe as movimentações da sua organização.</p></div>${canCreate ? '<button class="button primary" id="toggle-create">＋ Nova doação</button>' : ''}</div>${showForm && canCreate ? renderDonationForm() : ''}<section class="panel data-panel" aria-label="Lista de doações"><div class="table-toolbar"><div class="table-search"><span aria-hidden="true">⌕</span><input id="table-search" aria-label="Buscar doações por alimento, ID ou comércio" value="${esc(state.query)}" placeholder="Buscar por alimento, ID ou comércio" /></div><select id="status-filter" class="select-control" aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="em_rota">Em rota</option><option value="retirado">Distribuída</option><option value="cancelado">Cancelado</option><option value="expirado">Expirado</option></select><select id="category-filter" class="select-control" aria-label="Filtrar por categoria"><option value="all">Todas as categorias</option>${categoriesOptions.slice(1).map((c) => `<option ${state.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><input type="date" class="select-control date-filter" id="date-from" value="${state.from}" aria-label="Data inicial" /><input type="date" class="select-control date-filter" id="date-to" value="${state.to}" aria-label="Data final" /><button class="button outline export-button" id="export-csv">↓ Exportar CSV</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th scope="col"><button class="sort-button" data-sort="title">Doação</button></th><th scope="col"><button class="sort-button" data-sort="category">Categoria</button></th><th scope="col">Quantidade</th><th scope="col"><button class="sort-button" data-sort="status">Status</button></th><th scope="col"><button class="sort-button" data-sort="created_at">Publicada</button></th><th scope="col">Prazo</th>${canCreate || state.profile.role === 'volunteer' ? '<th scope="col">Ação</th>' : ''}</tr></thead><tbody id="donation-rows"></tbody></table></div><div class="table-pagination" id="pagination" aria-live="polite"></div></section>`;
    target.querySelector('#toggle-create')?.addEventListener('click', () => { const form = target.querySelector('#donation-form-wrap'); if (form) form.hidden = !form.hidden; else { target.insertAdjacentHTML('afterbegin', renderDonationForm()); bindDonationForm(target); } });
    target.querySelector('#table-search').addEventListener('input', (e) => { state.query = e.target.value; state.page = 0; renderDonationRows(target); });
    target.querySelector('#status-filter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 0; renderDonationRows(target); });
    target.querySelector('#category-filter').addEventListener('change', (e) => { state.category = e.target.value; state.page = 0; renderDonationRows(target); });
    target.querySelector('#date-from').addEventListener('change', (e) => { state.from = e.target.value; state.page = 0; renderDonationRows(target); });
    target.querySelector('#date-to').addEventListener('change', (e) => { state.to = e.target.value; state.page = 0; renderDonationRows(target); });
    target.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.sort; state.direction = state.sort === key && state.direction === 'asc' ? 'desc' : 'asc'; state.sort = key; renderDonationRows(target); }));
    target.querySelector('#export-csv').addEventListener('click', () => exportCSV(filteredDonations()));
    if (showForm && canCreate) bindDonationForm(target);
    renderDonationRows(target);
  }
  function filteredDonations() {
    const q = state.query.trim().toLocaleLowerCase('pt-BR');
    return state.donations.filter((item) => { const date = String(item.created_at || '').slice(0, 10); return (state.status === 'all' || item.status === state.status) && (state.category === 'all' || item.category === state.category) && (!state.from || date >= state.from) && (!state.to || date <= state.to) && (!q || `${item.id} ${item.title} ${item.category} ${item.merchant_name} ${item.quantity}`.toLocaleLowerCase('pt-BR').includes(q)); });
  }
  function renderDonationRows(target) {
    const rows = target.querySelector('#donation-rows'); if (!rows) return;
    const data = filteredDonations().sort((a, b) => { const av = a[state.sort] || ''; const bv = b[state.sort] || ''; return (av > bv ? 1 : av < bv ? -1 : 0) * (state.direction === 'asc' ? 1 : -1); });
    const pages = Math.max(1, Math.ceil(data.length / state.pageSize)); state.page = Math.min(state.page, pages - 1);
    const slice = data.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize); const canManage = ['merchant', 'admin'].includes(state.profile.role); const canAct = canManage || state.profile.role === 'volunteer';
    rows.innerHTML = slice.length ? slice.map((item) => { let action = ''; if (canManage && item.status === 'disponivel') action = `<button class="mini-action suspend" aria-label="Cancelar doação ${esc(item.title)}" data-donation-action="cancelado" data-id="${esc(item.id)}">Cancelar</button>`; else if (canManage && item.status === 'reservado') action = `<button class="mini-action approve" aria-label="Validar código da retirada de ${esc(item.title)}" data-donation-action="retirado" data-id="${esc(item.id)}">Validar código</button>`; return `<tr><td><div class="table-donation"><span class="table-thumb">${item.photo_url ? `<img src="${esc(item.photo_url)}" alt="" />` : '♡'}</span><span><b>${esc(item.title)}</b><small>#${esc(String(item.id).slice(0, 8))} · ${esc(item.merchant_name || 'Nutre')}</small></span></div></td><td>${esc(item.category || '—')}</td><td>${esc(item.quantity || '—')}</td><td><span class="table-status ${esc(item.status)}">${esc(statusLabel(item.status))}</span></td><td>${moneylessDate(item.created_at)}</td><td>${item.pickup_deadline ? new Date(item.pickup_deadline).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>${canAct ? `<td>${action || '—'}</td>` : ''}</tr>`; }).join('') : `<tr><td colspan="${canAct ? 7 : 6}" class="no-rows">Nenhuma doação corresponde aos filtros.</td></tr>`;
    rows.querySelectorAll('[data-donation-action]').forEach((button) => button.addEventListener('click', () => updateDonation(button.dataset.id, button.dataset.donationAction)));
    const pager = target.querySelector('#pagination'); pager.innerHTML = `<span>${data.length ? `${state.page * state.pageSize + 1}–${Math.min((state.page + 1) * state.pageSize, data.length)} de ${data.length} registros` : '0 registros'}</span><div><label class="sr-only" for="page-size">Registros por página</label><select id="page-size" class="select-control"><option ${state.pageSize === 10 ? 'selected' : ''}>10</option><option ${state.pageSize === 25 ? 'selected' : ''}>25</option><option ${state.pageSize === 50 ? 'selected' : ''}>50</option></select><button class="pager-btn" id="prev-page" aria-label="Página anterior" ${state.page === 0 ? 'disabled' : ''}>←</button><button class="pager-btn" id="next-page" aria-label="Próxima página" ${state.page >= pages - 1 ? 'disabled' : ''}>→</button></div>`;
    pager.querySelector('#page-size').addEventListener('change', (e) => { state.pageSize = Number(e.target.value); state.page = 0; renderDonationRows(target); }); pager.querySelector('#prev-page').addEventListener('click', () => { state.page--; renderDonationRows(target); }); pager.querySelector('#next-page').addEventListener('click', () => { state.page++; renderDonationRows(target); });
  }
  async function updateDonation(id, status) {
    let result;
    if (status === 'retirado') {
      const code = window.prompt('Digite o código de retirada informado pela pessoa voluntária:');
      if (!code) return;
      result = await supabase.rpc('confirm_pickup_code', { p_code: code.trim().toUpperCase() });
    } else {
      result = await supabase.rpc('cancel_my_donation', { p_donation_id: String(id) });
    }
    if (result.error) return notify(result.error.message, 'error');
    notify(status === 'retirado' ? 'Código validado. Coleta em rota para distribuição.' : 'Doação cancelada.');
    await loadDonations(); renderDonationRows(root.querySelector('#view'));
  }
  const statusLabel = (status) => ({ disponivel: 'Disponível', reservado: 'Reservado', em_rota: 'Em rota', retirado: 'Distribuída', cancelado: 'Cancelado', expirado: 'Expirado' }[status] || status || '—');
  function renderDonationForm() {
    const templates = JSON.parse(localStorage.getItem('nutre-donation-templates') || '[]');
    return `<div class="panel donation-form-wrap" id="donation-form-wrap"><div class="panel-heading"><div><p class="eyebrow">NOVA PUBLICAÇÃO</p><h2>Cadastrar doação</h2></div><button class="icon-button" id="close-donation-form" aria-label="Fechar">×</button></div>${templates.length ? `<label class="template-select">Usar modelo salvo<select id="template-select"><option value="">Escolher modelo…</option>${templates.map((t, i) => `<option value="${i}">${esc(t.title)}</option>`).join('')}</select></label>` : ''}<form id="donation-form" class="donation-form"><label>Nome do alimento<input name="title" required maxlength="100" placeholder="Ex.: Pães frescos do dia" /></label><div class="form-row"><label>Categoria<select name="category">${categories.map((c) => `<option>${c}</option>`).join('')}</select></label><label>Quantidade<input name="quantity" required maxlength="80" placeholder="Ex.: 20 unidades" /></label></div><div class="form-row"><label>Retirada até<input name="pickup" type="time" /></label><label>Peso estimado (kg)<input name="weight" type="number" min="0" step="0.1" placeholder="Opcional" /></label></div><label>Descrição e instruções<textarea name="description" rows="3" maxlength="500" placeholder="Validade e detalhes para retirada"></textarea></label><div class="image-upload"><label for="donation-photo">Foto do alimento <span>(opcional)</span></label><input id="donation-photo" name="photo" type="file" accept="image/*" aria-describedby="donation-photo-help" /><small id="donation-photo-help">Escolha uma imagem de até 8 MB para aparecer no mural do app.</small><div class="image-preview-wrap" id="donation-photo-preview-wrap" hidden><img id="donation-photo-preview" alt="Prévia da foto da doação" /><button type="button" id="remove-donation-photo" class="text-button">Remover foto</button></div></div><div class="form-actions"><button type="button" class="button outline" id="save-template">☆ Salvar como modelo</button><button class="button primary" type="submit">Disponibilizar na rede →</button></div></form></div>`;
  }
  function bindDonationForm(target) {
    const close = target.querySelector('#close-donation-form'); close?.addEventListener('click', () => target.querySelector('#donation-form-wrap')?.remove());
    const photoInput = target.querySelector('#donation-photo');
    const photoPreviewWrap = target.querySelector('#donation-photo-preview-wrap');
    const photoPreview = target.querySelector('#donation-photo-preview');
    let photoPreviewUrl = null;
    photoInput?.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      photoPreviewUrl = null;
      if (!file) { photoPreviewWrap.hidden = true; photoPreview.removeAttribute('src'); return; }
      if (!file.type.startsWith('image/')) { photoInput.value = ''; photoPreviewWrap.hidden = true; return notify('Selecione um arquivo de imagem.', 'error'); }
      if (file.size > 8 * 1024 * 1024) { photoInput.value = ''; photoPreviewWrap.hidden = true; return notify('A imagem deve ter no máximo 8 MB.', 'error'); }
      photoPreviewUrl = URL.createObjectURL(file);
      photoPreview.src = photoPreviewUrl;
      photoPreviewWrap.hidden = false;
    });
    target.querySelector('#remove-donation-photo')?.addEventListener('click', () => { photoInput.value = ''; photoPreviewWrap.hidden = true; photoPreview.removeAttribute('src'); if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); photoPreviewUrl = null; });
    target.querySelector('#template-select')?.addEventListener('change', (e) => { const t = JSON.parse(localStorage.getItem('nutre-donation-templates') || '[]')[Number(e.target.value)]; if (t) Object.entries(t).forEach(([key, value]) => { const field = target.querySelector(`[name="${key}"]`); if (field && field.type !== 'file') field.value = value; }); });
    target.querySelector('#save-template')?.addEventListener('click', () => { const form = target.querySelector('#donation-form'); const data = Object.fromEntries(new FormData(form)); delete data.photo; if (!data.title?.trim()) return notify('Informe o nome do alimento para salvar o modelo.', 'error'); const list = JSON.parse(localStorage.getItem('nutre-donation-templates') || '[]'); list.push(data); localStorage.setItem('nutre-donation-templates', JSON.stringify(list.slice(-10))); notify('Modelo salvo neste navegador.'); });
    target.querySelector('#donation-form')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); button.disabled = true; button.textContent = 'Publicando…';
      const values = Object.fromEntries(new FormData(form)); const pickup = values.pickup ? todayAt(values.pickup).toISOString() : null;
      const payload = { title: values.title.trim(), description: values.description.trim(), quantity: values.quantity.trim(), category: values.category, status: 'disponivel', pickup_deadline: pickup, estimated_weight_kg: Number(values.weight) || 0 };
      if (state.profile.role === 'merchant') Object.assign(payload, { merchant_id: state.user.id, merchant_name: state.profile.business_name || 'Comércio Nutre', merchant_neighborhood: state.profile.neighborhood || null });
      let uploadedPath = null;
      try {
        if (values.photo?.size) {
          if (!values.photo.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
          if (values.photo.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
          const extension = values.photo.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
          uploadedPath = `${state.user.id}/donation-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const { error: uploadError } = await supabase.storage.from('donation-photos').upload(uploadedPath, values.photo, { contentType: values.photo.type, upsert: false });
          if (uploadError) throw uploadError;
          payload.photo_url = supabase.storage.from('donation-photos').getPublicUrl(uploadedPath).data.publicUrl;
        }
        const { error } = await supabase.from('donations').insert(payload);
        if (error) throw error;
      } catch (error) {
        if (uploadedPath) await supabase.storage.from('donation-photos').remove([uploadedPath]);
        button.disabled = false; button.textContent = 'Disponibilizar na rede →';
        return notify(`Não foi possível publicar: ${error.message}`, 'error');
      }
      notify('Doação publicada na rede.'); await loadDonations(); renderDonations(root.querySelector('#view'));
    });
  }
  function todayAt(value) { const [h, m] = value.split(':').map(Number); const now = new Date(); const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m); if (result <= now) result.setDate(result.getDate() + 1); return result; }

  async function renderUsers(target) {
    target.innerHTML = `<div class="page-heading"><div><p class="eyebrow">CONTROLE DE ACESSO</p><h1>Usuários</h1><p class="intro">Gerencie perfis, alertas de qualidade e contas suspensas.</p></div></div><section class="panel data-panel"><div class="table-toolbar"><div class="table-search"><span aria-hidden="true">⌕</span><input id="user-search" aria-label="Buscar usuário por nome ou e-mail" placeholder="Buscar pessoa, instituição ou e-mail" /></div><label class="sr-only" for="user-role">Filtrar por perfil</label><select id="user-role" class="select-control"><option value="all">Todos os perfis</option><option value="merchant">Doador</option><option value="volunteer">Receptor</option><option value="admin">Admin</option></select></div><div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">USUÁRIO</th><th scope="col">PERFIL</th><th scope="col">REPUTAÇÃO / ALERTAS</th><th scope="col">CONTA</th><th scope="col">AÇÕES</th></tr></thead><tbody id="user-rows"><tr><td colspan="5">Carregando…</td></tr></tbody></table></div></section>`;
    const { data, error } = await supabase.from('profiles').select('id,email,role,responsible_name,business_name,institution_name,is_active,created_at').order('created_at', { ascending: false });
    if (error) { target.querySelector('#user-rows').innerHTML = `<tr><td colspan="5">${esc(error.message)}</td></tr>`; return; }
    state.profiles = data || [];
    const merchantIds = state.profiles.filter((p) => p.role === 'merchant').map((p) => p.id);
    const { data: reputationData } = merchantIds.length ? await supabase.rpc('get_donor_reputations', { p_merchant_ids: merchantIds }) : { data: [] };
    const reputations = Object.fromEntries((reputationData || []).map((item) => [item.merchant_id, item]));
    const render = () => { const q = target.querySelector('#user-search').value.toLowerCase(); const role = target.querySelector('#user-role').value; const list = state.profiles.filter((p) => (role === 'all' || p.role === role) && `${p.responsible_name} ${p.email} ${p.business_name} ${p.institution_name}`.toLowerCase().includes(q)); target.querySelector('#user-rows').innerHTML = list.map((p) => { const score = reputations[p.id]; return `<tr><td><div class="table-donation"><span class="table-thumb user-thumb">${esc((p.responsible_name || '?').slice(0,1).toUpperCase())}</span><span><b>${esc(p.responsible_name || p.business_name || 'Pessoa Nutre')}</b><small>${esc(p.email || 'E-mail não informado')}</small></span></div></td><td><select class="inline-select" data-user-role="${p.id}"><option value="merchant" ${p.role === 'merchant' ? 'selected' : ''}>Doador</option><option value="volunteer" ${p.role === 'volunteer' ? 'selected' : ''}>Receptor</option><option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Admin</option></select></td><td>${p.role === 'merchant' ? `<span>${score?.review_count ? `${Number(score.average_rating).toFixed(1)} ★ · ${score.review_count} avaliações` : 'Sem avaliações'}</span>${score?.donor_gold ? '<small class="block text-amber-800">Doador Ouro</small>' : ''}${score?.safety_flags ? `<small class="block text-red-700">${score.safety_flags} alerta(s) de segurança</small>` : ''}` : '—'}</td><td><span class="table-status ${p.is_active ? 'approved' : 'suspended'}">${p.is_active ? 'Ativa' : 'Suspensa'}</span></td><td><div class="user-actions"><button class="mini-action ${p.is_active ? 'suspend' : 'activate'}" data-active="${p.id}">${p.is_active ? 'Suspender' : 'Ativar'}</button></div></td></tr>`; }).join('') || '<tr><td colspan="5" class="no-rows">Nenhum usuário encontrado.</td></tr>';
      target.querySelectorAll('[data-user-role]').forEach((el) => el.addEventListener('change', () => updateProfile(el.dataset.userRole, { role: el.value }))); target.querySelectorAll('[data-active]').forEach((el) => el.addEventListener('click', () => { const p = state.profiles.find((x) => x.id === el.dataset.active); updateProfile(p.id, { is_active: !p.is_active }); }));
    };
    target.querySelector('#user-search').addEventListener('input', render); target.querySelector('#user-role').addEventListener('change', render); render();
  }
  async function updateProfile(id, updates) { const { error } = await supabase.from('profiles').update(updates).eq('id', id); if (error) return notify(error.message, 'error'); notify('Cadastro atualizado.'); await renderUsers(root.querySelector('#view')); }

  function renderReports(target) {
    const done = state.donations.filter((d) => d.status === 'retirado'); const all = state.donations;
    target.innerHTML = `<div class="page-heading"><div><p class="eyebrow">IMPACTO E PRESTAÇÃO DE CONTAS</p><h1>Relatórios</h1><p class="intro">Exporte os registros disponíveis para acompanhamento e comprovação de impacto.</p></div><div class="heading-actions"><button class="button outline" id="report-pdf">Imprimir / PDF</button><button class="button primary" id="report-csv">↓ Exportar CSV</button></div></div><div class="metric-grid report-metrics"><article class="metric-card metric-green"><span class="metric-label">PESO ESTIMADO SALVO</span><b>${fmt(done.reduce((n,d)=>n+Number(d.estimated_weight_kg||0),0),1)} <small>kg</small></b></article><article class="metric-card metric-orange"><span class="metric-label">PESSOAS ATENDIDAS</span><b>${fmt(done.reduce((n,d)=>n+Number(d.people_served||0),0))}</b></article><article class="metric-card metric-blue"><span class="metric-label">DOAÇÕES CONCLUÍDAS</span><b>${fmt(done.length)}</b></article><article class="metric-card metric-purple"><span class="metric-label">DOAÇÕES REGISTRADAS</span><b>${fmt(all.length)}</b></article></div><section class="panel report-note"><span class="metric-icon">ⓘ</span><div><b>Sobre os dados</b><p>Os indicadores dependem do peso e do número de pessoas atendidas informados no cadastro e da confirmação de coleta. CSV contém os registros disponíveis na sua conta.</p></div></section>`;
    target.querySelector('#report-csv').addEventListener('click', () => exportCSV(all)); target.querySelector('#report-pdf').addEventListener('click', () => window.print());
  }
  function exportCSV(items) {
    const columns = [['id','ID'],['title','Doação'],['category','Categoria'],['quantity','Quantidade'],['status','Status'],['merchant_name','Comércio'],['merchant_neighborhood','Bairro'],['estimated_weight_kg','Peso estimado kg'],['people_served','Pessoas atendidas'],['created_at','Criada em'],['pickup_deadline','Prazo retirada'],['completed_at','Concluída em']];
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [columns.map((x) => quote(x[1])).join(';'), ...items.map((item) => columns.map(([key]) => quote(item[key])).join(';'))].join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })); link.download = `nutre-doacoes-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  async function renderAudit(target) {
    target.innerHTML = `<div class="page-heading"><div><p class="eyebrow">RASTREABILIDADE</p><h1>Auditoria</h1><p class="intro">Histórico de alterações registradas automaticamente pelo banco de dados.</p></div><button class="button outline" id="refresh-audit">↻ Atualizar</button></div><section class="panel data-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>QUANDO</th><th>ATOR</th><th>REGISTRO</th><th>AÇÃO</th><th>DETALHE</th></tr></thead><tbody id="audit-rows"><tr><td colspan="5">Carregando…</td></tr></tbody></table></div></section>`;
    const load = async () => { const { data, error } = await supabase.from('system_audit_log').select('*').order('happened_at', { ascending: false }).limit(100); target.querySelector('#audit-rows').innerHTML = error ? `<tr><td colspan="5">${esc(error.message)}</td></tr>` : (data || []).map((row) => `<tr><td>${new Date(row.happened_at).toLocaleString('pt-BR')}</td><td>${esc(row.actor_id || 'Sistema')}</td><td>${esc(row.entity_type)} · ${esc(row.entity_id || '')}</td><td><span class="table-status">${esc(row.action)}</span></td><td>${esc(row.new_data?.title || row.new_data?.role || row.old_data?.title || '')}</td></tr>`).join('') || '<tr><td colspan="5">Ainda não há registros.</td></tr>'; };
    target.querySelector('#refresh-audit').addEventListener('click', load); await load();
  }
  function renderSettings(target) {
    target.innerHTML = `<div class="page-heading"><div><p class="eyebrow">PREFERÊNCIAS DA CONTA</p><h1>Configurações</h1><p class="intro">Informações da sessão e da organização conectada.</p></div></div><section class="panel settings-panel"><div class="settings-avatar">${esc((state.profile.responsible_name || 'N').slice(0,1).toUpperCase())}</div><div><p class="eyebrow">SESSÃO ATIVA</p><h2>${esc(state.profile.responsible_name || 'Usuário Nutre')}</h2><p>${esc(state.user.email)}</p><span class="table-status approved">${state.profile.role === 'admin' ? 'Administrador' : state.profile.role === 'merchant' ? 'Doador' : 'Receptor'}</span></div><button class="button outline" id="settings-logout">Sair da conta</button></section><section class="panel report-note"><span class="metric-icon">⌑</span><div><b>Integrações</b><p>O login utiliza a autenticação do Supabase compartilhada com o aplicativo móvel. Provedores Google/OAuth, notificações e mapa ao vivo ainda precisam ser configurados no projeto.</p></div></section>`;
    target.querySelector('#settings-logout').addEventListener('click', logout);
  }
  async function logout() { await supabase.auth.signOut(); state.user = null; state.profile = null; showLogin(); }

  supabase.auth.getSession().then(({ data }) => { if (data.session?.user) enter(data.session.user); });
  supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT') { state.user = null; state.profile = null; showLogin(); } });
}
