(function () {
  'use strict';
  var SUPABASE_URL = 'https://yuonzxfxzatlsjwryidy.supabase.co';
  // Clave PUBLICABLE (pública por diseño). El acceso real lo controlan el login y las reglas RLS.
  var SUPABASE_KEY = 'sb_publishable_Nn5MMyuZyw4BDMv-EvduXg_hf-ycVCF';
  var DOMINIO = '@citec.com.ec';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var $ = function (id) { return document.getElementById(id); };
  var datos = [], filtro = 'Todos', correo = '', resumen = null, dfiltro = '90 días', dlim = 20;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function norm(s) { return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function msg(t, err) { var m = $('loginmsg'); m.textContent = t || ''; m.className = 'msg' + (err ? ' err' : ''); }
  function fecha(d) { var p = (d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }

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
    var token = $('codigo').value.trim();
    if (!token) return;
    msg('Verificando…');
    var r = await sb.auth.verifyOtp({ email: correo, token: token, type: 'email' });
    if (r.error) { msg('Código incorrecto o vencido.', true); return; }
    iniciar();
  };
  $('salir').onclick = async function () { await sb.auth.signOut(); datos = []; resumen = null; cacheCt = {}; $('kpis').textContent = ''; $('dlista').textContent = ''; $('lista').textContent = ''; vistaLogin(); $('paso1').classList.remove('hidden'); $('paso2').classList.add('hidden'); $('codigo').value = ''; msg(''); };

  function tab(t) {
    $('tabRes').classList.toggle('on', t === 'res'); $('tabBus').classList.toggle('on', t === 'bus');
    $('vRes').classList.toggle('hidden', t !== 'res'); $('vBus').classList.toggle('hidden', t !== 'bus');
  }
  $('tabRes').onclick = function () { tab('res'); };
  $('tabBus').onclick = function () { tab('bus'); };
  function irA(f) { filtro = f; $('q').value = ''; pintarChips(); pintar(); tab('bus'); window.scrollTo(0, 0); }

  function pintarResumen() {
    var r = resumen; if (!r) return;
    var k = $('kpis'); k.textContent = '';
    [['Afiliados actuales', r.afiliados_total, '', 'Todos activos', true],
     ['Al día', r.socios_al_dia, 'v-ok', 'Socio'],
     ['En revisión', r.en_revision, 'v-warn', 'En revisión'],
     ['Suspendidos', r.suspendidos, 'v-bad', 'Suspendido'],
     ['Atención directiva', r.atencion_directiva, 'v-warn', 'Atención directiva'],
     ['Desafiliados este año', r.desafiliados_anio, 'v-bad', null],
     ['Desafiliados últimos 90 días', r.desafiliados_90d, 'v-bad', null]
    ].forEach(function (x) {
      var b = el('button', 'kpi' + (x[4] ? ' big' : ''));
      b.appendChild(el('div', 'v ' + x[2], String(x[1])));
      b.appendChild(el('div', 'l', x[0]));
      b.onclick = function () { if (x[3]) irA(x[3]); else { dfiltro = x[0].indexOf('90') >= 0 ? '90 días' : 'Este año'; dlim = 20; pintarDesaf(); $('dlista').scrollIntoView({ behavior: 'smooth' }); } };
      k.appendChild(b);
    });
    pintarDesaf();
  }
  function pintarDesaf() {
    var c = $('dchips'); c.textContent = '';
    ['90 días', 'Este año', 'Todos'].forEach(function (e) {
      var b = el('button', 'chip' + (e === dfiltro ? ' on' : ''), e);
      b.onclick = function () { dfiltro = e; dlim = 20; pintarDesaf(); };
      c.appendChild(b);
    });
    var hoy = new Date(), desde = null;
    if (dfiltro === '90 días') { desde = new Date(hoy.getTime() - 90 * 864e5); }
    if (dfiltro === 'Este año') { desde = new Date(hoy.getFullYear(), 0, 1); }
    var lista = (resumen.desafiliados || []).filter(function (d) { return !desde || (d.fecha && new Date(d.fecha + 'T00:00:00') >= desde); });
    var box = $('dlista'); box.textContent = '';
    if (!lista.length) { box.appendChild(el('div', 'msg', 'Sin desafiliaciones en este periodo.')); return; }
    box.appendChild(el('div', 'sub', lista.length + ' empresa(s)'));
    lista.slice(0, dlim).forEach(function (d) {
      var row = el('div', 'drow'), left = el('div');
      left.appendChild(el('div', 'name', d.nombre_comercial || d.razon_social));
      left.appendChild(el('div', 'sub', d.razon_social + ' · RUC ' + d.ruc));
      row.appendChild(left); row.appendChild(el('div', 'sub', d.fecha ? fecha(d.fecha) : 'Sin fecha'));
      box.appendChild(row);
    });
    if (lista.length > dlim) { var m = el('button', 'more', 'Ver más'); m.onclick = function () { dlim += 30; pintarDesaf(); }; box.appendChild(m); }
  }

  async function cargar() {
    var rr = await sb.rpc('consulta_resumen');
    if (!rr.error) { resumen = rr.data; pintarResumen(); }
    var r = await sb.rpc('consulta_socios');
    if (r.error) {
      if (r.error.code === '42501' || /autoriz/i.test(r.error.message || '')) { await sb.auth.signOut(); vistaLogin(); msg('Tu cuenta no está autorizada.', true); }
      else { $('count').textContent = 'No se pudo cargar. Revisa tu conexión.'; }
      return;
    }
    datos = r.data || [];
    $('actualizado').textContent = 'Actualizado: ' + new Date().toLocaleString('es-EC');
    pintarChips(); pintar();
  }

  var ESTADOS = ['Todos', 'Todos activos', 'Socio', 'En revisión', 'Suspendido', 'Atención directiva', 'Desafiliado', 'Con facturas pendientes'];
  function pintarChips() {
    var c = $('chips'); c.textContent = '';
    ESTADOS.forEach(function (e) {
      var b = el('button', 'chip' + (e === filtro ? ' on' : ''), e);
      b.onclick = function () { filtro = e; pintarChips(); pintar(); };
      c.appendChild(b);
      if (e === filtro && e !== 'Todos') { setTimeout(function () { b.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 0); }
    });
  }
  function pasa(s) {
    if (filtro === 'Todos') return true;
    if (filtro === 'Con facturas pendientes') return s.facturas_pendientes > 0;
    if (filtro === 'Todos activos') return ['Socio', 'En revisión', 'Suspendido', 'Atención directiva'].indexOf(s.estado_socio) >= 0;
    return s.estado_socio === filtro;
  }
  function pintar() {
    var q = norm($('q').value), l = $('lista'); l.textContent = '';
    var res = datos.filter(function (s) { return pasa(s) && (!q || norm(s.razon_social + ' ' + (s.nombre_comercial || '') + ' ' + s.ruc).indexOf(q) >= 0); });
    $('count').textContent = res.length + ' resultado(s)';
    res.slice(0, 100).forEach(function (s) {
      var card = el('div', 'card'), row = el('div', 'row'), left = el('div');
      left.appendChild(el('div', 'name', s.razon_social));
      left.appendChild(el('div', 'sub', 'RUC ' + s.ruc + (s.ciudad ? ' · ' + s.ciudad : '')));
      var cls = 'b-' + (['Socio', 'Suspendido', 'Desafiliado', 'En revisión', 'Atención directiva'].indexOf(s.estado_socio) >= 0 ? s.estado_socio.replace(/ /g, '-') : 'otro');
      row.appendChild(left); row.appendChild(el('span', 'badge ' + cls, s.estado_socio));
      card.appendChild(row);
      var f = el('div', 'fact');
      if (!s.facturas_pendientes) { f.textContent = 'Sin facturas pendientes'; }
      else {
        f.appendChild(el('div', 'name', s.facturas_pendientes + ' factura(s) pendiente(s)'));
        (s.facturas || []).forEach(function (x) {
          var p = el('div', 'p'); p.appendChild(el('span', null, x.periodo || 'Factura ' + x.documento));
          p.appendChild(el('span', 'sub', 'Emitida ' + fecha(x.emision) + (x.dias_vencido > 0 ? ' · ' + x.dias_vencido + ' d vencida' : '')));
          f.appendChild(p);
        });
      }
      card.appendChild(f);
      card.classList.add('tap');
      var hint = el('div', 'hint', 'Toca para ver contactos'); card.appendChild(hint);
      card.onclick = function (ev) { if (ev.target.tagName === 'A') return; toggleContacto(card, s.ruc, hint); };
      l.appendChild(card);
    });
    if (res.length > 100) { l.appendChild(el('p', 'msg', 'Mostrando 100. Afina la búsqueda para ver más.')); }
  }
  $('q').oninput = pintar;

  var cacheCt = {};
  function soloDigitos(t) { return (t || '').replace(/\D/g, ''); }
  function waNum(t) { var d = soloDigitos(t); if (d.indexOf('0') === 0) d = '593' + d.slice(1); return d; }
  function bloque(box, titulo, c) {
    box.appendChild(el('div', 'who', titulo));
    if (!c || (!c.nombre && !c.telefono && !c.email)) { box.appendChild(el('div', 'sub', 'No registrado en Monday')); return; }
    if (c.nombre) box.appendChild(el('div', 'name', c.nombre));
    if (c.telefono) box.appendChild(el('div', 'sub', '+' + soloDigitos(c.telefono).replace(/^0/, '593')));
    if (c.email) box.appendChild(el('div', 'sub', c.email));
    var acts = el('div', 'acts');
    function link(txt, href) { var a = el('a', null, txt); a.href = href; if (href.indexOf('https') === 0) { a.target = '_blank'; a.rel = 'noopener'; } acts.appendChild(a); }
    if (c.telefono) { link('Llamar', 'tel:+' + waNum(c.telefono)); link('WhatsApp', 'https://wa.me/' + waNum(c.telefono)); }
    if (c.email && /^[^@\s]+@[^@\s]+$/.test(c.email)) link('Correo', 'mailto:' + c.email);
    box.appendChild(acts);
  }
  async function toggleContacto(card, ruc, hint) {
    var ex = card.querySelector('.ct');
    if (ex) { ex.remove(); hint.textContent = 'Toca para ver contactos'; return; }
    var box = el('div', 'ct', 'Cargando contactos…'); card.insertBefore(box, hint); hint.textContent = 'Toca para ocultar';
    var d = cacheCt[ruc];
    if (d === undefined) {
      var r = await sb.rpc('consulta_contacto', { p_ruc: ruc });
      if (r.error) { box.textContent = 'No se pudo cargar el contacto.'; return; }
      d = cacheCt[ruc] = r.data;
    }
    box.textContent = '';
    if (!d) { box.appendChild(el('div', 'sub', 'Este socio no tiene ficha en Monday.')); return; }
    bloque(box, 'Gerente general / CEO', d.gerente);
    bloque(box, 'Contacto financiero', d.financiero);
  }

  async function iniciar() {
    var s = await sb.auth.getSession();
    if (!s.data.session) { vistaLogin(); return; }
    vistaApp(); cargar();
  }
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') vistaLogin(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && datos.length) cargar(); });
  iniciar();
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }
})();
