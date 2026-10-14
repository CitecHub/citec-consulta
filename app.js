(function () {
  'use strict';
  var SUPABASE_URL = 'https://yuonzxfxzatlsjwryidy.supabase.co';
  // Clave PUBLICABLE (pública por diseño). El acceso real lo controlan el login y las reglas de la base.
  var SUPABASE_KEY = 'sb_publishable_Nn5MMyuZyw4BDMv-EvduXg_hf-ycVCF';
  var DOMINIO = '@citec.com.ec';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var $ = function (id) { return document.getElementById(id); };

  var datos = [], resumen = null, correo = '', filtro = 'Todos', desMes = 'todos', cacheCt = {};
  var vista = 'res', vistaPrevia = 'bus', detId = null;

  // ---------- utilidades ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function norm(s) { return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function fecha(d) { var p = (d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (d || ''); }
  function mesLabel(k) { var p = k.split('-'); var s = new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
  function msg(t, err) { var m = $('loginmsg'); m.textContent = t || ''; m.className = 'msg' + (err ? ' err' : ''); }
  var ESTADOS_BADGE = ['Socio', 'Suspendido', 'Desafiliado', 'En revisión', 'Atención directiva'];
  function badge(estado) { var cls = 'b-' + (ESTADOS_BADGE.indexOf(estado) >= 0 ? estado.replace(/ /g, '-') : 'otro'); return el('span', 'badge ' + cls, estado); }
  function nombreCom(s) { var n = (s.nombre_comercial || '').trim(); return n && norm(n) !== norm(s.razon_social) ? n : ''; }

  // ---------- login ----------
  function vistaLogin() { $('login').classList.remove('hidden'); $('app').classList.add('hidden'); $('salir').classList.add('hidden'); }
  function vistaApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); $('salir').classList.remove('hidden'); }
  $('enviar').onclick = async function () {
    correo = $('email').value.trim().toLowerCase();
    if (!correo.endsWith(DOMINIO)) { msg('Usa tu correo ' + DOMINIO, true); return; }
    msg('Enviando…');
    var r = await sb.auth.signInWithOtp({ email: correo, options: { shouldCreateUser: true } });
    if (r.error) { msg('No se pudo enviar el código. Intenta de nuevo en un minuto.', true); return; }
    $('paso1').classList.add('hidden'); $('paso2').classList.remove('hidden');
    msg('Revisa tu correo e ingresa el código.');
  };
  $('verificar').onclick = async function () {
    var token = $('codigo').value.trim(); if (!token) return;
    msg('Verificando…');
    var r = await sb.auth.verifyOtp({ email: correo, token: token, type: 'email' });
    if (r.error) { msg('Código incorrecto o vencido.', true); return; }
    iniciar();
  };
  $('salir').onclick = async function () {
    await sb.auth.signOut(); datos = []; resumen = null; cacheCt = {};
    ['kpis', 'lista', 'det', 'desLista', 'desMeses'].forEach(function (i) { $(i).textContent = ''; });
    vistaLogin(); $('paso1').classList.remove('hidden'); $('paso2').classList.add('hidden'); $('codigo').value = ''; msg('');
  };

  // ---------- navegación ----------
  function mostrar(v, push) {
    if (v === 'det' && vista !== 'det') vistaPrevia = vista;
    vista = v;
    $('vRes').classList.toggle('hidden', v !== 'res');
    $('vBus').classList.toggle('hidden', v !== 'bus');
    $('vDes').classList.toggle('hidden', v !== 'des');
    $('vDet').classList.toggle('hidden', v !== 'det');
    $('tabs').classList.toggle('hidden', v === 'des' || v === 'det');
    $('tabRes').classList.toggle('on', v === 'res');
    $('tabBus').classList.toggle('on', v === 'bus');
    if (push) { try { history.pushState({ v: v }, ''); } catch (e) {} }
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function () {
    if (vista === 'det') { mostrar(vistaPrevia === 'det' ? 'bus' : vistaPrevia); }
    else if (vista === 'des') { mostrar('res'); }
  });
  function atras() { if (history.state && history.state.v) history.back(); else if (vista === 'det') mostrar(vistaPrevia); else mostrar('res'); }
  $('tabRes').onclick = function () { mostrar('res'); };
  $('tabBus').onclick = function () { mostrar('bus'); };
  $('detBack').onclick = atras;
  $('desBack').onclick = atras;
  $('detBack').textContent = '‹ Volver';

  // ---------- resumen ----------
  function pintarResumen() {
    var r = resumen; if (!r) return;
    var k = $('kpis'); k.textContent = '';
    function tile(label, val, cls, onClick, big, extra) {
      var b = el('button', 'kpi go' + (big ? ' big' : ''));
      b.appendChild(el('div', 'v ' + (cls || ''), String(val)));
      b.appendChild(el('div', 'l', label));
      if (extra) b.appendChild(el('div', 'x', extra));
      b.onclick = onClick; k.appendChild(b);
    }
    tile('Afiliados actuales', r.afiliados_total, '', function () { irA('Socios'); }, true);
    tile('Al día', r.socios_al_dia, 'v-ok', function () { irA('Al día'); });
    tile('En revisión', r.en_revision, 'v-warn', function () { irA('En revisión'); });
    tile('Suspendidos', r.suspendidos, 'v-bad', function () { irA('Suspendido'); });
    tile('Atención directiva', r.atencion_directiva, 'v-warn', function () { irA('Atención directiva'); });
    tile('Desafiliados', r.desafiliados_total, 'v-bad', function () { abrirDesafiliados(); }, true,
      r.desafiliados_anio + ' este año · ' + r.desafiliados_90d + ' en los últimos 90 días');
  }
  function irA(f) { filtro = f; $('q').value = ''; pintarChips(); pintar(); mostrar('bus'); }

  // ---------- desafiliados ----------
  function abrirDesafiliados() { desMes = 'todos'; pintarDesaf(); mostrar('des', true); }
  function pintarDesaf() {
    var lista = (resumen && resumen.desafiliados) || [];
    var porMes = {}, sinFecha = 0;
    lista.forEach(function (d) { if (d.fecha) { var k = d.fecha.slice(0, 7); porMes[k] = (porMes[k] || 0) + 1; } else sinFecha++; });
    var meses = Object.keys(porMes).sort().reverse();
    $('desTotal').textContent = lista.length;
    $('desSub').textContent = resumen.desafiliados_anio + ' en ' + new Date().getFullYear() + ' · ' + resumen.desafiliados_90d + ' en los últimos 90 días';

    var sel = $('desMes'); sel.textContent = '';
    var o = el('option', null, 'Todos los meses (' + lista.length + ')'); o.value = 'todos'; sel.appendChild(o);
    meses.forEach(function (m) { var op = el('option', null, mesLabel(m) + ' (' + porMes[m] + ')'); op.value = m; sel.appendChild(op); });
    sel.value = desMes;
    sel.onchange = function () { desMes = sel.value; pintarDesaf(); };

    var box = $('desMeses'); box.textContent = '';
    var max = Math.max.apply(null, meses.map(function (m) { return porMes[m]; }).concat([1]));
    var mostrarMeses = box.dataset.todos === '1' ? meses : meses.slice(0, 12);
    mostrarMeses.forEach(function (m) {
      var b = el('button', 'mrow' + (m === desMes ? ' on' : ''));
      var left = el('div'); left.style.flex = '1';
      left.appendChild(el('div', null, mesLabel(m)));
      var bar = el('div', 'bar'); bar.style.width = Math.max(4, Math.round(porMes[m] / max * 100)) + '%'; left.appendChild(bar);
      b.appendChild(left); b.appendChild(el('div', 'name', String(porMes[m])));
      b.onclick = function () { desMes = (desMes === m ? 'todos' : m); pintarDesaf(); $('desTit').scrollIntoView({ behavior: 'smooth' }); };
      box.appendChild(b);
    });
    if (meses.length > 12 && box.dataset.todos !== '1') {
      var mm = el('button', 'more', 'Ver todos los meses (' + meses.length + ')');
      mm.onclick = function () { box.dataset.todos = '1'; pintarDesaf(); };
      box.appendChild(mm);
    }
    if (sinFecha) box.appendChild(el('div', 'sub', sinFecha + ' sin fecha registrada'));

    var filtrada = lista.filter(function (d) { return desMes === 'todos' || (d.fecha && d.fecha.slice(0, 7) === desMes); });
    $('desTit').textContent = (desMes === 'todos' ? 'Todos los desafiliados' : 'Desafiliados en ' + mesLabel(desMes).toLowerCase()) + ' (' + filtrada.length + ')';
    var dl = $('desLista'); dl.textContent = '';
    if (!filtrada.length) { dl.appendChild(el('div', 'msg', 'Sin desafiliaciones en este periodo.')); return; }
    var lim = +(dl.dataset.lim || 50);
    filtrada.slice(0, lim).forEach(function (d) {
      var row = el('button', 'drow item'); row.style.border = '0'; row.style.borderBottom = '1px solid var(--bd)'; row.style.background = 'none';
      var left = el('div');
      left.appendChild(el('div', 'name', d.razon_social));
      var nc = nombreCom(d); if (nc) left.appendChild(el('div', 'sub', nc));
      row.appendChild(left); row.appendChild(el('div', 'sub', d.fecha ? fecha(d.fecha) : 'Sin fecha'));
      row.onclick = function () { abrirDetalle(d.id); };
      dl.appendChild(row);
    });
    if (filtrada.length > lim) { var m2 = el('button', 'more', 'Ver más'); m2.onclick = function () { dl.dataset.lim = lim + 50; pintarDesaf(); }; dl.appendChild(m2); }
  }

  // ---------- búsqueda ----------
  var CHIPS = ['Todos', 'Socios', 'En revisión', 'Suspendido', 'Atención directiva', 'Desafiliado', 'Con facturas pendientes'];
  var ACTIVOS = ['Socio', 'En revisión', 'Suspendido', 'Atención directiva'];
  function pintarChips() {
    var c = $('chips'); c.textContent = '';
    var lista = CHIPS.slice(); if (filtro === 'Al día') lista.splice(2, 0, 'Al día');
    lista.forEach(function (e) {
      var b = el('button', 'chip' + (e === filtro ? ' on' : ''), e);
      b.onclick = function () { filtro = e; pintarChips(); pintar(); };
      c.appendChild(b);
      if (e === filtro && e !== 'Todos') setTimeout(function () { b.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 0);
    });
  }
  function pasa(s) {
    switch (filtro) {
      case 'Todos': return true;
      case 'Socios': return ACTIVOS.indexOf(s.estado_socio) >= 0;
      case 'Al día': return s.estado_socio === 'Socio';
      case 'Con facturas pendientes': return s.facturas_pendientes > 0;
      default: return s.estado_socio === filtro;
    }
  }
  function pintar() {
    var q = norm($('q').value), l = $('lista'); l.textContent = '';
    var res = datos.filter(function (s) { return pasa(s) && (!q || norm(s.razon_social + ' ' + (s.nombre_comercial || '')).indexOf(q) >= 0); });
    $('count').textContent = res.length + ' resultado(s)';
    res.slice(0, 100).forEach(function (s) {
      var card = el('button', 'card item'), row = el('div', 'row'), left = el('div');
      left.appendChild(el('div', 'name', s.razon_social));
      var nc = nombreCom(s); if (nc) left.appendChild(el('div', 'sub', nc));
      if (s.categoria) left.appendChild(el('div', 'sub', 'Categoría: ' + s.categoria));
      row.appendChild(left); row.appendChild(badge(s.estado_socio));
      card.appendChild(row);
      card.onclick = function () { abrirDetalle(s.id); };
      l.appendChild(card);
    });
    if (res.length > 100) l.appendChild(el('p', 'msg', 'Mostrando 100. Afina la búsqueda para ver más.'));
  }
  $('q').oninput = pintar;

  // ---------- detalle del socio ----------
  function soloDigitos(t) { return (t || '').replace(/\D/g, ''); }
  function intl(t) { var d = soloDigitos(t); if (d.indexOf('0') === 0) d = '593' + d.slice(1); return d; }
  function bloqueContacto(box, titulo, c) {
    box.appendChild(el('div', 'who', titulo));
    if (!c || (!c.nombre && !c.telefono && !c.email)) { box.appendChild(el('div', 'sub', 'No registrado en Monday')); return; }
    if (c.nombre) box.appendChild(el('div', 'name', c.nombre));
    if (c.telefono) box.appendChild(el('div', 'sub', '+' + intl(c.telefono)));
    if (c.email) box.appendChild(el('div', 'sub', c.email));
    var acts = el('div', 'acts');
    function link(txt, href) { var a = el('a', null, txt); a.href = href; if (href.indexOf('https') === 0) { a.target = '_blank'; a.rel = 'noopener'; } acts.appendChild(a); }
    if (c.telefono) { link('Llamar', 'tel:+' + intl(c.telefono)); link('WhatsApp', 'https://wa.me/' + intl(c.telefono)); }
    if (c.email && /^[^@\s]+@[^@\s]+$/.test(c.email)) link('Correo', 'mailto:' + c.email);
    box.appendChild(acts);
  }
  function abrirDetalle(id) {
    var s = null; for (var i = 0; i < datos.length; i++) { if (datos[i].id === id) { s = datos[i]; break; } }
    detId = id;
    var d = $('det'); d.textContent = '';
    if (!s) { d.appendChild(el('div', 'msg', 'No se encontró la información de este socio.')); mostrar('det', true); return; }

    var head = el('div', 'card'), row = el('div', 'row'), left = el('div');
    left.appendChild(el('div', 'name', s.razon_social));
    var nc = nombreCom(s); if (nc) left.appendChild(el('div', 'sub', 'Nombre comercial: ' + nc));
    left.appendChild(el('div', 'sub', 'Categoría actual: ' + (s.categoria || 'Sin categoría registrada')));
    row.appendChild(left); row.appendChild(badge(s.estado_socio)); head.appendChild(row); d.appendChild(head);

    d.appendChild(el('h2', null, 'Facturas pendientes'));
    var f = el('div', 'card');
    if (!s.facturas_pendientes) { f.appendChild(el('div', null, 'Sin facturas pendientes')); }
    else {
      f.appendChild(el('div', 'name', s.facturas_pendientes + (s.facturas_pendientes === 1 ? ' factura pendiente' : ' facturas pendientes')));
      (s.facturas || []).forEach(function (x) {
        var r = el('div', 'fx'), a = el('div'), b = el('div');
        a.appendChild(el('div', null, x.periodo || ('Factura ' + (x.documento || ''))));
        a.appendChild(el('div', 'sub', 'Emitida ' + fecha(x.emision)));
        b.appendChild(el('div', 'name ' + (x.dias_vencido > 90 ? 'v-bad' : x.dias_vencido > 60 ? 'v-warn' : ''), x.dias_vencido > 0 ? x.dias_vencido + ' días' : 'Por vencer'));
        b.appendChild(el('div', 'sub', x.dias_vencido > 0 ? 'vencida' : ''));
        b.style.textAlign = 'right'; b.style.whiteSpace = 'nowrap'; b.style.flexShrink = '0';
        r.appendChild(a); r.appendChild(b); f.appendChild(r);
      });
    }
    d.appendChild(f);

    var btn = el('button', 'ctbtn'); btn.appendChild(el('span', null, 'Contactos')); var flecha = el('span', 'sub', '›'); btn.appendChild(flecha);
    var box = el('div', 'card hidden');
    btn.onclick = async function () {
      var abierto = !box.classList.contains('hidden');
      box.classList.toggle('hidden', abierto); flecha.textContent = abierto ? '›' : '⌄';
      if (abierto || box.dataset.ok) return;
      box.textContent = 'Cargando contactos…';
      var c = cacheCt[id];
      if (c === undefined) {
        var r = await sb.rpc('consulta_contacto_v2', { p_id: id });
        if (r.error) { box.textContent = 'No se pudo cargar el contacto.'; return; }
        c = cacheCt[id] = r.data;
      }
      if (detId !== id) return;
      box.textContent = ''; box.dataset.ok = '1';
      if (!c) { box.appendChild(el('div', 'sub', 'Este socio no tiene ficha en Monday.')); return; }
      bloqueContacto(box, 'Gerente general / CEO', c.gerente);
      bloqueContacto(box, 'Contacto contable', c.contable);
      bloqueContacto(box, 'Contacto financiero', c.financiero);
    };
    d.appendChild(btn); d.appendChild(box);
    mostrar('det', true);
  }

  // ---------- carga ----------
  async function cargar() {
    var rr = await sb.rpc('consulta_resumen_v2');
    if (!rr.error) { resumen = rr.data; pintarResumen(); if (vista === 'des') pintarDesaf(); }
    var r = await sb.rpc('consulta_socios_v2');
    if (r.error) {
      if (r.error.code === '42501' || /autoriz/i.test(r.error.message || '')) { await sb.auth.signOut(); vistaLogin(); msg('Tu cuenta no está autorizada.', true); }
      else { $('count').textContent = 'No se pudo cargar. Revisa tu conexión.'; }
      return;
    }
    datos = r.data || [];
    $('actualizado').textContent = 'Actualizado: ' + new Date().toLocaleString('es-EC');
    pintarChips(); pintar();
  }
  async function iniciar() {
    var s = await sb.auth.getSession();
    if (!s.data.session) { vistaLogin(); return; }
    vistaApp(); cargar();
  }
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') vistaLogin(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && datos.length && vista !== 'det') cargar(); });
  iniciar();
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }
})();
