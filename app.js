(function () {
  'use strict';
  var SUPABASE_URL = 'https://yuonzxfxzatlsjwryidy.supabase.co';
  // Clave PUBLICABLE (pública por diseño). El acceso real lo controlan el login y las reglas de la base.
  var SUPABASE_KEY = 'sb_publishable_Nn5MMyuZyw4BDMv-EvduXg_hf-ycVCF';
  var DOMINIO = '@citec.com.ec';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var $ = function (id) { return document.getElementById(id); };

  var datos = [], resumen = null, correo = '', filtro = 'Todos', desMes = 'todos', cacheCt = {};
  var vista = 'res', vistaPrevia = 'bus', detId = null, dashMes = null, movTipo = 'alta';

  // ---------- utilidades ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function norm(s) { return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function fecha(d) { var p = (d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (d || ''); }
  function mesLabel(k) { var p = k.split('-'); var s = new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
  function msg(t, err) { var m = $('loginmsg'); m.textContent = t || ''; m.className = 'msg' + (err ? ' err' : ''); }
  var ESTADOS_BADGE = ['Activo', 'Suspendido', 'Desafiliado', 'En revisión', 'Atención directiva'];
  function badge(estado) { var cls = 'b-' + (ESTADOS_BADGE.indexOf(estado) >= 0 ? estado.replace(/ /g, '-') : 'otro'); return el('span', 'badge ' + cls, estado); }
  // Fecha clave del socio: próxima renovación (afiliados) o fecha de desafiliación (desafiliados)
  function lineaAfil(s) {
    if (!s.estado_socio || s.estado_socio === 'Prospecto') return '';
    return 'Fecha de afiliación: ' + (s.fecha_afiliacion ? fecha(s.fecha_afiliacion) : 'sin registrar');
  }
  function lineaFecha(s) {
    if (s.estado_socio === 'Desafiliado') return 'Fecha de desafiliación: ' + (s.fecha_desafiliacion ? fecha(s.fecha_desafiliacion) : 'sin registrar');
    if (['Activo', 'Suspendido', 'En revisión', 'Atención directiva'].indexOf(s.estado_socio) >= 0) return 'Próxima renovación: ' + (s.proxima_renovacion ? fecha(s.proxima_renovacion) : 'sin registrar');
    return '';
  }
  function nombreCom(s) { var n = (s.nombre_comercial || '').trim(); return n && norm(n) !== norm(s.razon_social) ? n : ''; }

  // ---------- login ----------
  function vistaLogin() { $('login').classList.remove('hidden'); $('app').classList.add('hidden'); $('perfil').classList.add('hidden'); cerrarMenu(); }
  function vistaApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); $('perfil').classList.remove('hidden'); }
  // ---------- menú de perfil ----------
  function cerrarMenu() { $('menu').classList.add('hidden'); $('perfilBtn').setAttribute('aria-expanded', 'false'); }
  $('perfilBtn').onclick = function (e) { e.stopPropagation(); var abrir = $('menu').classList.contains('hidden'); $('menu').classList.toggle('hidden', !abrir); $('perfilBtn').setAttribute('aria-expanded', abrir ? 'true' : 'false'); };
  document.addEventListener('click', function (e) { if (!$('perfil').contains(e.target)) cerrarMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMenu(); });
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
    cerrarMenu();
    await sb.auth.signOut({ scope: 'local' }); datos = []; resumen = null; cacheCt = {}; dashMes = null;
    ['kpis', 'lista', 'det', 'desLista', 'desMeses', 'movLista', 'pie'].forEach(function (i) { $(i).textContent = ''; });
    vistaLogin(); $('paso1').classList.remove('hidden'); $('paso2').classList.add('hidden'); $('codigo').value = ''; msg('');
  };

  // ---------- navegación ----------
  // Orden de las vistas para saber hacia dónde va la animación al cambiar de pantalla
  var NIVEL = { res: 0, bus: 1, des: 2, mov: 2, det: 3 };
  var VISTA_ID = { res: 'vRes', bus: 'vBus', des: 'vDes', mov: 'vMov', det: 'vDet' };
  function mostrar(v, push) {
    if (v === 'det' && vista !== 'det') vistaPrevia = vista;
    var dir = NIVEL[v] > NIVEL[vista] ? 1 : NIVEL[v] < NIVEL[vista] ? -1 : 0;
    vista = v;
    if (dir) animar(VISTA_ID[v], dir);
    $('vRes').classList.toggle('hidden', v !== 'res');
    $('vBus').classList.toggle('hidden', v !== 'bus');
    $('vDes').classList.toggle('hidden', v !== 'des');
    $('vMov').classList.toggle('hidden', v !== 'mov');
    $('vDet').classList.toggle('hidden', v !== 'det');
    $('banda').classList.toggle('hidden', v === 'des' || v === 'det' || v === 'mov');
    $('tabRes').classList.toggle('on', v === 'res');
    $('tabBus').classList.toggle('on', v === 'bus');
    $('tabs').classList.toggle('en-bus', v === 'bus'); // mueve el resaltado de la pestaña
    if (push) { try { history.pushState({ v: v }, ''); } catch (e) {} }
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function () {
    if (vista === 'det') { mostrar(vistaPrevia === 'det' ? 'bus' : vistaPrevia); }
    else if (vista === 'des' || vista === 'mov') { mostrar('res'); }
  });
  function atras() { if (history.state && history.state.v) history.back(); else if (vista === 'det') mostrar(vistaPrevia); else mostrar('res'); }
  $('tabRes').onclick = function () { mostrar('res'); };
  $('tabBus').onclick = function () { mostrar('bus'); };
  $('detBack').onclick = atras;
  $('desBack').onclick = atras;
  $('movBack').onclick = atras;
  $('detBack').textContent = '‹ Volver';

  // ---------- resumen ----------
  // ---------- transiciones de entrada ----------
  // La primera vez que se pinta el Resumen, sus bloques aparecen en secuencia y las cifras cuentan
  // hacia arriba; ocurre al cerrarse la bienvenida para que se vea.
  var reducir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var yaRevelado = false, trasBien = [];
  function trasBienvenida(fn) { if ($('bienvenida').classList.contains('hidden')) fn(); else trasBien.push(fn); }
  function contar(n, hasta) {
    if (reducir) { n.textContent = hasta; return; }
    var t0 = null, dur = 900;
    (function paso(t) { if (!t0) t0 = t; var x = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - x, 3);
      n.textContent = Math.round(hasta * e); if (x < 1) requestAnimationFrame(paso); })(performance.now());
  }
  function cifras(scope, animar) {
    scope.querySelectorAll('[data-n]').forEach(function (n) { var v = +n.dataset.n; if (animar) { n.textContent = '0'; contar(n, v); } else n.textContent = v; });
  }

  // ---------- resumen ----------
  function pintarResumen() {
    var r = resumen; if (!r) return;
    var k = $('kpis'); k.textContent = '';
    // Pulso: total de afiliados y su composición por estado (barra + filas que llevan al filtro)
    var pulso = el('div', 'pulso'), top = el('button', 'pulso-top');
    top.appendChild(el('span', 'pildora', 'Membresía CITEC'));
    var cifra = el('span', 'cifra'); cifra.dataset.n = r.afiliados_total; top.appendChild(cifra);
    top.appendChild(el('span', 'et', 'afiliados actuales'));
    top.onclick = function () { irA('Afiliados'); };
    pulso.appendChild(top);
    var partes = [['Activos', r.socios_al_dia, 'var(--ok)', 'Activo'], ['En revisión', r.en_revision, 'var(--warn)', 'En revisión'],
                  ['Suspendidos', r.suspendidos, 'var(--bad)', 'Suspendido'], ['Atención directiva', r.atencion_directiva, 'var(--dir)', 'Atención directiva']];
    var tot = r.afiliados_total || 0, barra = el('div', 'barra'), ley = el('div', 'leyenda');
    barra.setAttribute('role', 'img');
    barra.setAttribute('aria-label', partes.map(function (x) { return x[1] + ' ' + x[0].toLowerCase(); }).join(', '));
    partes.forEach(function (x, i) {
      if (x[1] > 0) { var seg = el('i'); seg.style.flexGrow = x[1]; seg.style.background = x[2]; seg.style.setProperty('--i', i); barra.appendChild(seg); }
      var b = el('button', 'ley'), n = el('i', 'nodo'), v = el('b'); n.style.color = x[2]; v.dataset.n = x[1];
      b.appendChild(n); b.appendChild(el('span', null, x[0])); b.appendChild(v);
      b.appendChild(el('em', null, tot ? Math.round(x[1] / tot * 100) + '%' : ''));
      b.onclick = function () { irA(x[3]); }; ley.appendChild(b);
    });
    pulso.appendChild(barra); pulso.appendChild(ley); k.appendChild(pulso);
    var des = el('button', 'baja-res'), dn = el('i', 'nodo'), dt = el('span'), dc = el('span', 'cifra-m');
    dn.style.color = 'var(--bad)'; dc.dataset.n = r.desafiliados_anio;
    dt.appendChild(el('span', 't', 'Desafiliados en ' + new Date().getFullYear()));
    dt.appendChild(el('span', 'sub', r.desafiliados_90d + ' en los últimos 90 días'));
    des.appendChild(dn); des.appendChild(dt); des.appendChild(dc);
    des.onclick = function () { abrirDesafiliados(); }; k.appendChild(des);
    pintarDash();
    if (yaRevelado) { cifras(k, false); return; }
    yaRevelado = true; cifras(k, false);
    var v = $('vRes'); v.classList.add('pre');
    trasBienvenida(function () { v.classList.remove('pre'); v.classList.add('revela'); cifras(k, true); setTimeout(function () { v.classList.remove('revela'); }, 1400); });
  }

  // ---------- dashboard afiliaciones vs desafiliaciones ----------
  function claveMes(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function ultimosMeses(n) { var out = [], d = new Date(); d.setDate(1); for (var i = 0; i < n; i++) { out.unshift(claveMes(d)); d.setMonth(d.getMonth() - 1); } return out; }
  function movsDe(mes, tipo) { return ((resumen && resumen.movimientos) || []).filter(function (m) { return m.tipo === tipo && m.fecha && m.fecha.slice(0, 7) === mes; }); }
  function mesCorto(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('es-EC', { month: 'short' }).replace('.', ''); }
  function conSigno(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
  var ventanaPrev = '';
  function pintarDash() {
    var meses24 = ultimosMeses(24); if (!dashMes) dashMes = meses24[23];
    var sel = $('dashMes'); sel.textContent = '';
    meses24.slice().reverse().forEach(function (m) { var o = el('option', null, mesLabel(m)); o.value = m; sel.appendChild(o); });
    sel.value = dashMes; sel.onchange = function () { dashMes = sel.value; pintarDash(); };
    var idx = meses24.indexOf(dashMes), prev = idx > 0 ? meses24[idx - 1] : null;
    var na = movsDe(dashMes, 'alta').length, nb = movsDe(dashMes, 'baja').length, neto = na - nb;
    var pa = prev ? movsDe(prev, 'alta').length : null, pb = prev ? movsDe(prev, 'baja').length : null;
    $('nAlta').textContent = na; $('nBaja').textContent = nb;
    $('nNeto').textContent = conSigno(neto);
    $('nNeto').style.color = !neto ? 'var(--tx)' : neto > 0 ? 'var(--ok)' : 'var(--bad)';
    var ant = prev ? ' vs ' + mesCorto(prev) : '';
    $('pAlta').textContent = prev ? conSigno(na - pa) + ant : '';
    $('pBaja').textContent = prev ? conSigno(nb - pb) + ant : '';
    $('dNeto').textContent = prev ? (pa - pb) + ' en ' + mesCorto(prev) : '';
    $('movAlta').onclick = function () { abrirMov('alta'); };
    $('movBaja').onclick = function () { abrirMov('baja'); };
    var tot = na + nb, ver = $('veredicto');
    ver.textContent = !tot ? 'Sin movimientos en ' + mesLabel(dashMes).toLowerCase()
      : neto > 0 ? 'Más socios nuevos que desafiliados en ' + mesLabel(dashMes).toLowerCase()
      : neto < 0 ? 'Más desafiliados que socios nuevos en ' + mesLabel(dashMes).toLowerCase()
      : 'Igual número de socios nuevos y desafiliados en ' + mesLabel(dashMes).toLowerCase();
    // Últimos 12 meses; si el mes elegido es más antiguo, la ventana termina en ese mes
    var fin = idx >= 12 ? 23 : Math.max(idx, 11), ventana = meses24.slice(fin - 11, fin + 1);
    var anim = ventana.join() !== ventanaPrev; ventanaPrev = ventana.join();
    pintarBarras(ventana, anim);
  }
  // Barras divergentes: socios nuevos hacia arriba, desafiliados hacia abajo; el mes elegido resalta
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(t, at) { var e = document.createElementNS(NS, t); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function pintarBarras(meses, anim) {
    var box = $('pie'); box.textContent = '';
    var W = 340, H = 196, top = 22, bot = 26, gw = W / meses.length, bw = Math.min(14, gw * 0.5);
    var vals = meses.map(function (m) { return [movsDe(m, 'alta').length, movsDe(m, 'baja').length]; });
    var maxA = Math.max.apply(null, vals.map(function (v) { return v[0]; }).concat([1]));
    var maxB = Math.max.apply(null, vals.map(function (v) { return v[1]; }).concat([1]));
    var u = (H - top - bot) / (maxA + maxB), y0 = top + maxA * u;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'class': anim && !reducir ? 'crece' : '',
      'aria-label': 'Últimos 12 meses: ' + meses.map(function (m, i) { return mesLabel(m) + ' ' + vals[i][0] + ' nuevos y ' + vals[i][1] + ' desafiliados'; }).join('; ') });
    meses.forEach(function (m, i) {
      var x = i * gw, cx = x + gw / 2, on = m === dashMes, a = vals[i][0], b = vals[i][1];
      var g = svgEl('g', { 'class': 'grp' + (on ? ' on' : '') });
      g.style.setProperty('--d', (i * 35) + 'ms');
      if (on) g.appendChild(svgEl('rect', { x: x + 2, y: 4, width: gw - 4, height: H - 8, rx: 8, 'class': 'foco' }));
      if (a) g.appendChild(svgEl('rect', { x: cx - bw / 2, y: y0 - a * u, width: bw, height: a * u, rx: Math.min(4, a * u / 2), 'class': 'ba' }));
      if (b) g.appendChild(svgEl('rect', { x: cx - bw / 2, y: y0, width: bw, height: b * u, rx: Math.min(4, b * u / 2), 'class': 'bb' }));
      if (on) {
        if (a) { var ta = svgEl('text', { x: cx, y: y0 - a * u - 5, 'text-anchor': 'middle', 'class': 'va' }); ta.textContent = a; g.appendChild(ta); }
        if (b) { var tb = svgEl('text', { x: cx, y: y0 + b * u + 12, 'text-anchor': 'middle', 'class': 'vb' }); tb.textContent = b; g.appendChild(tb); }
      }
      var tm = svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle', 'class': 'mes' }); tm.textContent = mesCorto(m); g.appendChild(tm);
      var hit = svgEl('rect', { x: x, y: 0, width: gw, height: H, fill: 'transparent' }); g.appendChild(hit);
      var tt = svgEl('title', {}); tt.textContent = mesLabel(m) + ': ' + a + ' socios nuevos, ' + b + ' desafiliados'; g.appendChild(tt);
      g.addEventListener('click', function () { dashMes = m; pintarDash(); });
      svg.appendChild(g);
    });
    svg.appendChild(svgEl('line', { x1: 0, x2: W, y1: y0, y2: y0, 'class': 'eje' }));
    box.appendChild(svg);
  }
  function abrirMov(tipo, push) {
    movTipo = tipo;
    var lista = movsDe(dashMes, tipo).map(function (m) { var s = porId(m.id); return s ? { s: s, fecha: m.fecha } : null; }).filter(Boolean);
    lista.sort(function (x, y) { return x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0; });
    $('movTit').textContent = (tipo === 'alta' ? 'Socios nuevos' : 'Desafiliados') + ' en ' + mesLabel(dashMes).toLowerCase() + ' (' + lista.length + ')';
    var l = $('movLista'); l.textContent = '';
    if (!lista.length) l.appendChild(el('div', 'msg', 'No hubo ' + (tipo === 'alta' ? 'afiliaciones' : 'desafiliaciones') + ' en este mes.'));
    lista.forEach(function (x) {
      var card = tarjeta(x.s);
      card.querySelector('.izq').appendChild(el('div', 'sub', (tipo === 'alta' ? 'Afiliado el ' : 'Desafiliado el ') + fecha(x.fecha)));
      l.appendChild(card);
    });
    if (push !== false) mostrar('mov', true);
  }
  function porId(id) { for (var i = 0; i < datos.length; i++) if (datos[i].id === id) return datos[i]; return null; }
  function tarjeta(s) {
    var card = el('button', 'fila item'), row = el('div', 'row'), left = el('div', 'izq');
    left.appendChild(el('div', 'name', s.razon_social));
    var nc = nombreCom(s); if (nc) left.appendChild(el('div', 'sub', nc));
    if (s.categoria) left.appendChild(el('div', 'sub', 'Categoría: ' + s.categoria));
    var la = lineaAfil(s); if (la) left.appendChild(el('div', 'sub', la));
    var lf = lineaFecha(s); if (lf) left.appendChild(el('div', 'sub', lf));
    if (s.facturas_pendientes > 0) left.appendChild(el('div', 'sub', s.facturas_pendientes + (s.facturas_pendientes === 1 ? ' factura pendiente' : ' facturas pendientes')));
    row.appendChild(left); row.appendChild(badge(s.estado_socio));
    card.appendChild(row);
    card.onclick = function () { abrirDetalle(s.id); };
    return card;
  }
  function irA(f) { filtro = f; $('q').value = ''; pintarChips(); pintar(); mostrar('bus'); }

  // ---------- desafiliados ----------
  // Por defecto se ve el año en curso; el histórico completo queda en el filtro "Todo el histórico".
  function abrirDesafiliados() { desMes = 'anio'; pintarDesaf(); mostrar('des', true); }
  function pintarDesaf() {
    var lista = (resumen && resumen.desafiliados) || [];
    var anio = String(new Date().getFullYear());
    var delAnio = lista.filter(function (d) { return d.fecha && d.fecha.slice(0, 4) === anio; }).length;
    var porMes = {}, sinFecha = 0;
    lista.forEach(function (d) { if (d.fecha) { var k = d.fecha.slice(0, 7); porMes[k] = (porMes[k] || 0) + 1; } else sinFecha++; });
    var meses = Object.keys(porMes).sort().reverse();
    $('desEtiq').textContent = 'Socios desafiliados en ' + anio;
    $('desTotal').textContent = resumen.desafiliados_anio;
    $('desSub').textContent = resumen.desafiliados_90d + ' en los últimos 90 días · ' + lista.length + ' en total (histórico)';

    var sel = $('desMes'); sel.textContent = '';
    var oa = el('option', null, 'Este año (' + delAnio + ')'); oa.value = 'anio'; sel.appendChild(oa);
    var o = el('option', null, 'Todo el histórico (' + lista.length + ')'); o.value = 'todos'; sel.appendChild(o);
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
      b.onclick = function () { desMes = (desMes === m ? 'anio' : m); pintarDesaf(); $('desTit').scrollIntoView({ behavior: 'smooth' }); };
      box.appendChild(b);
    });
    if (meses.length > 12 && box.dataset.todos !== '1') {
      var mm = el('button', 'more', 'Ver todos los meses (' + meses.length + ')');
      mm.onclick = function () { box.dataset.todos = '1'; pintarDesaf(); };
      box.appendChild(mm);
    }
    if (sinFecha) box.appendChild(el('div', 'sub', sinFecha + ' sin fecha registrada'));

    var filtrada = lista.filter(function (d) { return desMes === 'todos' || (desMes === 'anio' ? d.fecha && d.fecha.slice(0, 4) === anio : d.fecha && d.fecha.slice(0, 7) === desMes); });
    $('desTit').textContent = (desMes === 'todos' ? 'Todos los desafiliados (histórico)' : desMes === 'anio' ? 'Desafiliados en ' + anio : 'Desafiliados en ' + mesLabel(desMes).toLowerCase()) + ' (' + filtrada.length + ')';
    var dl = $('desLista'); dl.textContent = '';
    if (!filtrada.length) { dl.appendChild(el('div', 'msg', 'Sin desafiliaciones en este periodo.')); return; }
    var lim = +(dl.dataset.lim || 50);
    filtrada.slice(0, lim).forEach(function (d) {
      var row = el('button', 'drow item');
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
  var CHIPS = ['Todos', 'Afiliados', 'Activo', 'En revisión', 'Suspendido', 'Atención directiva', 'Desafiliado'];
  var ACTIVOS = ['Activo', 'En revisión', 'Suspendido', 'Atención directiva'];
  function pintarChips() {
    var c = $('chips'); c.textContent = '';
    var lista = CHIPS.slice();
    lista.forEach(function (e) {
      var b = el('button', 'chip' + (e === filtro ? ' on' : ''), e);
      b.onclick = function () {
        var dir = CHIPS.indexOf(e) - CHIPS.indexOf(filtro); if (!dir) return;
        filtro = e; pintarChips(); pintar(); animar('lista', dir);
      };
      c.appendChild(b);
      if (e === filtro) setTimeout(function () { try { c.scrollTo({ left: b.offsetLeft - (c.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' }); } catch (x) { c.scrollLeft = b.offsetLeft - (c.clientWidth - b.offsetWidth) / 2; } }, 0);
    });
  }
  // ---------- deslizar con el dedo (en cualquier parte de la pantalla) ----------
  // Resumen ⇄ Buscar socio, y en Buscar socio: Todos ⇄ Afiliados ⇄ … ⇄ Desafiliado.
  // Desde "Todos", deslizar hacia la derecha regresa al Resumen.
  // En la ficha, desafiliados y listado del mes, deslizar hacia la derecha equivale a "Volver".
  function animar(id, dir) {
    var n = $(id); n.classList.remove('desl-izq', 'desl-der'); void n.offsetWidth;
    n.classList.add(dir > 0 ? 'desl-izq' : 'desl-der');
  }
  function deslizar(dir) { // dir = +1 siguiente (dedo hacia la izquierda), -1 anterior
    if (vista === 'det' || vista === 'des' || vista === 'mov') { if (dir < 0) atras(); return; }
    if (vista === 'res') { if (dir > 0) mostrar('bus'); return; }
    var i = CHIPS.indexOf(filtro), j = i + dir;
    if (j < 0) { mostrar('res'); return; }
    if (j >= CHIPS.length) return;
    filtro = CHIPS[j]; pintarChips(); pintar(); animar('lista', dir); window.scrollTo(0, 0);
  }
  (function () {
    var x0 = null, y0 = 0, t0 = 0, scr = null, scrL = 0;
    // Elemento con desplazamiento horizontal propio (p. ej. la fila de filtros o un texto largo en el buscador)
    function desplazableH(n) {
      for (; n && n !== document.body && n.nodeType === 1; n = n.parentNode) if (n.scrollWidth > n.clientWidth + 1) return n;
      return null;
    }
    document.addEventListener('touchstart', function (e) {
      x0 = null;
      if (e.touches.length !== 1 || $('app').classList.contains('hidden') || !$('menu').classList.contains('hidden')) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
      scr = desplazableH(e.target); scrL = scr ? scr.scrollLeft : 0;
    }, { passive: true });
    document.addEventListener('touchcancel', function () { x0 = null; }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2 || Date.now() - t0 > 1000) return; // no es un deslizamiento horizontal
      // Si el dedo movió la fila de filtros (o el texto del buscador), ese gesto era para desplazarla, no para cambiar de pantalla
      if (scr && Math.abs(scr.scrollLeft - scrL) > 2) return;
      deslizar(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();
  function pasa(s) {
    switch (filtro) {
      case 'Todos': return true;
      case 'Afiliados': return ACTIVOS.indexOf(s.estado_socio) >= 0;
      default: return s.estado_socio === filtro;
    }
  }
  function pintar() {
    var q = norm($('q').value), l = $('lista'); l.textContent = '';
    var res = datos.filter(function (s) { return pasa(s) && (!q || norm(s.razon_social + ' ' + (s.nombre_comercial || '')).indexOf(q) >= 0); });
    $('count').textContent = res.length + ' resultado(s)';
    res.slice(0, 100).forEach(function (s) {
      var card = el('button', 'fila item'), row = el('div', 'row'), left = el('div');
      left.appendChild(el('div', 'name', s.razon_social));
      var nc = nombreCom(s); if (nc) left.appendChild(el('div', 'sub', nc));
      if (s.categoria) left.appendChild(el('div', 'sub', 'Categoría: ' + s.categoria));
      var la = lineaAfil(s); if (la) left.appendChild(el('div', 'sub', la));
      var lf = lineaFecha(s); if (lf) left.appendChild(el('div', 'sub', lf));
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

    var head = el('div', 'ficha-cab');
    head.appendChild(el('div', 'nom', s.razon_social));
    var nc = nombreCom(s); if (nc) head.appendChild(el('div', 'sub', 'Nombre comercial: ' + nc));
    head.appendChild(badge(s.estado_socio)); d.appendChild(head);
    // Datos clave como filas etiqueta / valor ("Fecha de afiliación: 30/11/2021" → dos columnas)
    var dl = el('dl', 'datos');
    function dato(txt, clave) {
      var i = txt.indexOf(': '), r = el('div', 'dato' + (clave ? ' clave' : ''));
      r.appendChild(el('dt', null, txt.slice(0, i))); r.appendChild(el('dd', null, txt.slice(i + 2))); dl.appendChild(r);
    }
    dato('Categoría actual: ' + (s.categoria || 'Sin categoría registrada'));
    var lad = lineaAfil(s); if (lad) dato(lad);
    var lfd = lineaFecha(s); if (lfd) dato(lfd, true);
    d.appendChild(dl);

    d.appendChild(el('h2', null, 'Facturas pendientes'));
    var f = el('div', 'hoja');
    if (!s.facturas_pendientes) { f.appendChild(el('div', 'msg', 'Sin facturas pendientes')); }
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
    var box = el('div', 'hoja hidden');
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
    var r = await sb.rpc('consulta_socios_v4');
    if (r.error) {
      if (r.error.code === '42501' || /autoriz/i.test(r.error.message || '')) { await sb.auth.signOut({ scope: 'local' }); vistaLogin(); msg('Tu cuenta no está autorizada.', true); }
      else { $('count').textContent = 'No se pudo cargar. Revisa tu conexión.'; }
      return;
    }
    datos = (r.data || []).map(function (x) { if (x.estado_socio === 'Socio') x.estado_socio = 'Activo'; return x; });
    if (resumen) pintarDash();
    if (vista === 'mov') abrirMov(movTipo, false);
    $('actualizado').textContent = 'Actualizado: ' + new Date().toLocaleString('es-EC');
    pintarChips(); pintar();
  }
  // ---------- bienvenida ----------
  // Nombre de quien entra: el del perfil si existe; si no, la primera parte del correo
  // (william@citec.com.ec → "William", rossana.perez@citec.com.ec → "Rossana").
  function nombreUsuario(u) {
    var m = (u && u.user_metadata) || {};
    var n = (m.nombre || m.full_name || m.name || '').trim().split(/\s+/)[0];
    if (!n) n = ((u && u.email) || '').split('@')[0].split(/[._\-+0-9]/)[0];
    return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
  }
  function bienvenida(u) {
    var b = $('bienvenida'), n = nombreUsuario(u);
    $('bienNombre').textContent = n;
    $('bienTexto').textContent = n ? 'Bienvenido/a' : 'Bienvenido/a a la consulta de socios';
    b.classList.remove('hidden', 'sale');
    var cerrar = function () {
      if (b.classList.contains('hidden') || b.classList.contains('sale')) return;
      b.classList.add('sale'); setTimeout(function () { b.classList.add('hidden'); b.classList.remove('sale'); trasBien.splice(0).forEach(function (f) { f(); }); }, 400);
    };
    b.onclick = cerrar; setTimeout(cerrar, 2200);
  }
  async function iniciar() {
    var s = await sb.auth.getSession();
    if (!s.data.session) { vistaLogin(); return; }
    var u = s.data.session.user;
    $('menuMail').textContent = (u && u.email) || '';
    bienvenida(u); vistaApp(); cargar();
  }
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') vistaLogin(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && datos.length && vista !== 'det') cargar(); });
  iniciar();
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }
})();
