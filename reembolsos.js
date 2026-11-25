/* CITEC App v21: menú lateral y módulo de reembolsos (piloto).
   No toca las pantallas de socios: solo las oculta cuando se elige otra opción del menú.
   Los permisos reales los aplica Supabase (lista del piloto y revisión solo para william@). */
(function () {
  'use strict';
  var C = window.CITEC;
  if (!C || !C.sb) return;
  var sb = C.sb;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function money(n) { return '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function r2(n) { return Math.round(Number(n) * 100) / 100; }
  function fecha(d) { var p = String(d || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (d || ''); }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function iniciales(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join(''); }

  var IC = {
    socios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6"/></svg>',
    recibo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    revisar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 17h8"/></svg>',
    camara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
  };

  // ===================== Reglas de clasificación (definidas por finanzas) =====================
  var DETALLE = 40, AUTO = 10;
  var TIPOS = [['comida', 'Comida'], ['estacionamiento', 'Estacionamiento'], ['transporte', 'Taxi o Uber'], ['hospedaje', 'Hospedaje'], ['otro', 'Otro']];
  var RESP = { factura_electronica: 'Factura electrónica', factura: 'Factura', voucher_tarjeta: 'Voucher de tarjeta, sin factura', consumidor_final: 'Factura a consumidor final', sin_validez_tributaria: 'Documento sin validez tributaria', otro: 'Otro respaldo' };
  var RESP_NORMAL = ['factura_electronica', 'factura'];
  function preguntas(d) {
    var a = d.ans, q = [], t = d.tipo_gasto, tot = Number(d.total) || 0;
    if (t === 'comida') {
      q.push({ id: 'ctx', label: '¿Con quién fue esta comida?', opts: [['socio', 'Con un socio'], ['viaje', 'Por un viaje'], ['equipo', 'Con el equipo de CITEC']] });
      if (a.ctx === 'viaje') q.push({ id: 'pais', label: '¿El viaje fue dentro o fuera del país?', opts: [['dentro', 'Dentro del país'], ['fuera', 'Fuera del país']] });
      if (a.ctx && tot > DETALLE) q.push({ id: 'detalle', kind: 'detalle', label: 'Como pasa de ' + money(DETALLE) + ', cuéntanos más' });
    } else if (t === 'estacionamiento') {
      q.push({ id: 'socios', label: '¿El estacionamiento fue por una reunión con socios?', opts: [['si', 'Sí, con socios'], ['no', 'No, fue por otra cosa']] });
    } else if (t === 'hospedaje') {
      q.push({ id: 'pais', label: '¿El viaje fue dentro o fuera del país?', opts: [['dentro', 'Dentro del país'], ['fuera', 'Fuera del país']] });
    } else if (t === 'otro') {
      q.push({ id: 'manual', kind: 'manual', label: 'Elige la cuenta de egreso' });
    }
    return q;
  }
  function cuentaRegla(d) {
    var a = d.ans, t = d.tipo_gasto;
    if (t === 'comida') {
      if (a.ctx === 'socio') return 'GASTOS DE REPRESENTACIÓN';
      if (a.ctx === 'equipo') return 'ALIMENTACIÓN OFICINA';
      if (a.ctx === 'viaje' && a.pais) return a.pais === 'fuera' ? 'VIATICOS - ALIMENTACIÓN EXTERNA' : 'VIATICOS - ALIMENTACIÓN INTERNA';
      return null;
    }
    if (t === 'estacionamiento') { if (a.socios === 'si') return 'GASTOS DE REPRESENTACIÓN'; if (a.socios === 'no') return 'VIATICOS - MOVILIZACIÓN INTERNA'; return null; }
    if (t === 'hospedaje') return a.pais ? (a.pais === 'fuera' ? 'VIATICOS - HOSPEDAJE EXTERNO' : 'VIATICOS - HOSPEDAJE INTERNO') : null;
    if (t === 'transporte') return 'UBER';
    return a.manual || null;
  }
  function cuentaFinal(d) { return d.override || cuentaRegla(d); }
  function faltantes(d) {
    var out = [];
    if (!d.fecha) out.push('la fecha');
    if (!(Number(d.total) > 0)) out.push('el valor');
    if (!String(d.lugar || '').trim()) out.push('el lugar');
    if (d.sinDoc && !String(d.motivo || '').trim()) out.push('el motivo');
    preguntas(d).forEach(function (q) {
      if (q.kind === 'detalle') { if (!(Number(d.ans.personas) > 0 && String(d.ans.quien || '').trim())) out.push('personas y ' + (d.ans.ctx === 'socio' ? 'socio' : 'motivo')); }
      else if (!d.ans[q.id]) out.push('responder la pregunta');
    });
    if (!cuentaFinal(d) && out.indexOf('responder la pregunta') < 0) out.push('la cuenta');
    return out;
  }
  function clave(lugar, fechaD, total, numero) { return numero ? 'n:' + numero + '|' + r2(total).toFixed(2) : 'p:' + String(lugar || '').trim().toLowerCase() + '|' + fechaD + '|' + r2(total).toFixed(2); }
  function avisos(d) {
    var w = [];
    if (d.ilegibles && d.ilegibles.length) w.push(['warn', 'No se leyó: ' + d.ilegibles.join(', ') + '. Revisa ese dato o toma otra foto.']);
    if (!d.sinDoc && d.tipo_respaldo && RESP_NORMAL.indexOf(d.tipo_respaldo) < 0) w.push(['warn', 'Respaldo: ' + RESP[d.tipo_respaldo].toLowerCase() + '. Se registra igual; finanzas verá el tipo de respaldo.']);
    if (d.subtotal != null && d.iva != null && Number(d.total) > 0) {
      var s = Number(d.subtotal) + Number(d.iva) + Number(d.propina || 0);
      if (Math.abs(s - Number(d.total)) > 0.02) w.push(['warn', 'Los valores del recibo no cuadran: ' + money(s) + ' contra un total de ' + money(d.total) + '.']);
    }
    if (d.nota) w.push(['info', d.nota]);
    if (Number(d.total) > 0 && d.fecha) {
      var k = clave(d.lugar, d.fecha, d.total, d.numero), dup = false;
      gastosBorrador().forEach(function (g) { if (clave(g.lugar, g.fecha, Number(g.valor) + Number(g.isd || 0), g.numero_documento) === k) dup = true; });
      if (dup) w.push(['bad', 'Posible duplicado: ya hay un gasto igual en tu solicitud.']);
    }
    if (d.sinDoc) w.push(['bad', 'Sin documento: finanzas lo aprueba manualmente, sin importar el monto.']);
    return w;
  }

  // ===================== Estado =====================
  var st = { u: null, info: null, modulo: 'socios', tab: 'registrar', cola: [], cur: 0, leer: false, correo: null, procesando: '', confirmar: false, enviando: false, quitar: null,
    rev: { lista: null, det: null, obs: null } };
  function solicitud() { return st.info && st.info.solicitud; }
  function gastosBorrador() { var s = solicitud(); return (s && s.gastos) || []; }
  function cuentas() { return (st.info && st.info.cuentas) || []; }
  function grupoDe(c) { var x = cuentas().filter(function (k) { return k.nombre === c; })[0]; return x ? x.grupo : ''; }

  var toastT;
  function toast(t, err) {
    var n = $('rbToast'); if (!n) { n = el('div', 'rb-toast'); n.id = 'rbToast'; n.setAttribute('role', 'status'); document.body.appendChild(n); }
    n.textContent = t; n.className = 'rb-toast' + (err ? ' err' : ''); n.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(function () { n.classList.add('hidden'); }, 3800);
  }
  function errTexto(e) { var m = (e && (e.message || e.error)) || ''; return /autoriz/i.test(m) ? 'No tienes permiso para esta acción.' : (m || 'Algo salió mal. Intenta de nuevo.'); }

  async function token() { var s = await sb.auth.getSession(); return s.data.session ? s.data.session.access_token : ''; }
  async function fn(nombre, body, comoArchivo) {
    var r = await fetch(C.url + '/functions/v1/' + nombre, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.key, Authorization: 'Bearer ' + (await token()) }, body: JSON.stringify(body || {}) });
    if (comoArchivo && r.ok) return { archivo: await r.blob(), nombre: ((r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/) || [])[1] };
    var j = {}; try { j = await r.json(); } catch (x) {}
    if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
    return j;
  }

  // ===================== Menú lateral =====================
  var velo = $('velo'), cajon = $('cajon'), hb = $('hambur');
  function abrirMenu() { pintarMenu(); velo.classList.add('on'); cajon.classList.add('on'); cajon.setAttribute('aria-hidden', 'false'); hb.setAttribute('aria-expanded', 'true'); }
  function cerrarMenu() { velo.classList.remove('on'); cajon.classList.remove('on'); cajon.setAttribute('aria-hidden', 'true'); hb.setAttribute('aria-expanded', 'false'); }
  hb.onclick = abrirMenu; velo.onclick = cerrarMenu;
  C.abrirMenu = function () { if (st.u) abrirMenu(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarMenu(); cerrarZoom(); } });
  function opcion(mod, icono, t, d, extra) {
    var b = el('button', 'cj-op' + (st.modulo === mod ? ' on' : '')); b.dataset.mod = mod;
    var ic = el('span', 'ic'); ic.innerHTML = icono; b.appendChild(ic);
    var tx = el('span'); tx.appendChild(el('span', 't', t)); tx.appendChild(el('span', 'd', d)); b.appendChild(tx);
    b.appendChild(extra || el('span'));
    b.onclick = function () { cerrarMenu(); ir(mod); };
    return b;
  }
  function pintarMenu() {
    var u = st.u || {}, info = st.info || {};
    var nombre = info.nombre || C.nombreUsuario(u) || '';
    $('cjIni').textContent = iniciales(nombre || u.email);
    $('cjNom').textContent = nombre;
    $('cjMail').textContent = u.email || '';
    var rol = $('cjRol'); rol.textContent = info.revisor ? 'Finanzas' : info.permitido ? 'Piloto de reembolsos' : ''; rol.classList.toggle('hidden', !rol.textContent);
    var ops = $('cjOps'); ops.textContent = '';
    ops.appendChild(opcion('socios', IC.socios, 'Consultar socios', 'Resumen y búsqueda de socios'));
    if (info.permitido) ops.appendChild(opcion('reembolsos', IC.recibo, 'Solicitar reembolso', 'Sube tus recibos y envía tu reporte', el('span', 'cj-tag', 'Piloto')));
    if (info.revisor) {
      var pend = (st.rev.lista || []).filter(function (s) { return s.por_revisar > 0; }).length;
      ops.appendChild(opcion('revision', IC.revisar, 'Revisar reembolsos', 'Aprobar u observar solicitudes', pend ? el('span', 'cj-num', String(pend)) : null));
    }
  }

  // ===================== Navegación entre módulos =====================
  var mod = $('modRb');
  function ir(m) {
    if (m === 'reembolsos' && !(st.info && st.info.permitido)) m = 'socios';
    if (m === 'revision' && !(st.info && st.info.revisor)) m = 'socios';
    st.modulo = m;
    var enSocios = m === 'socios';
    $('app').classList.toggle('hidden', !enSocios);
    mod.classList.toggle('hidden', enSocios);
    if (!enSocios) { pintar(); refrescar(); }
    window.scrollTo(0, 0);
  }
  async function refrescar() {
    if (st.modulo === 'reembolsos') {
      await cargarEstado(); pintar();
      if (st.correo === null) { try { st.correo = (await fn('rb-enviar', { modo: 'estado' })).correo; } catch (x) { st.correo = null; } pintar(); }
    } else if (st.modulo === 'revision') {
      await cargarRevision(); if (st.rev.det) await abrirSolicitud(st.rev.det.id, true); pintar();
    }
  }
  async function cargarEstado() {
    var r = await sb.rpc('rb_mi_estado');
    if (!r.error) st.info = r.data;
    return !r.error;
  }
  async function cargarRevision() {
    var r = await sb.rpc('rb_rev_lista');
    if (!r.error) st.rev.lista = r.data || [];
  }

  function pintar() {
    if (st.modulo === 'reembolsos') pintarReembolsos();
    else if (st.modulo === 'revision') pintarRevision();
  }

  // ===================== Solicitar reembolso =====================
  function banda() {
    var n = gastosBorrador().length;
    var b = el('div', 'banda'), t = el('div', 'tabs' + (st.tab === 'solicitud' ? ' en-bus' : ''));
    [['registrar', 'Registrar'], ['solicitud', 'Mi solicitud' + (n ? ' · ' + n : '')]].forEach(function (x) {
      var bt = el('button', 'tab' + (st.tab === x[0] ? ' on' : ''), x[1]); bt.dataset.t = x[0];
      bt.onclick = function () { st.tab = x[0]; st.confirmar = false; pintar(); window.scrollTo(0, 0); };
      t.appendChild(bt);
    });
    b.appendChild(t); return b;
  }
  function pintarReembolsos() {
    mod.textContent = '';
    mod.appendChild(banda());
    if (!st.info) { mod.appendChild(el('p', 'msg', 'Cargando…')); return; }
    if (st.tab === 'registrar') vistaRegistrar(); else vistaSolicitud();
  }

  // ---- Registrar ----
  var archivo = el('input'); archivo.type = 'file'; archivo.accept = 'image/*'; archivo.multiple = true; archivo.className = 'hidden'; archivo.id = 'rbArchivo';
  document.body.appendChild(archivo);
  archivo.onchange = function () { var f = Array.prototype.slice.call(archivo.files || []); archivo.value = ''; if (f.length) subirFotos(f); };

  function nuevoDoc(o) {
    var d = { uid: Math.random().toString(36).slice(2), ruta: null, preview: null, sinDoc: false, fecha: '', lugar: '', total: '', tipo_gasto: 'comida', tipo_respaldo: 'factura_electronica',
      numero: null, ciudad: null, subtotal: null, iva: null, propina: 0, ilegibles: [], nota: '', ans: {}, override: null, cambiar: false, isd: '', motivo: '', lectura: null };
    for (var k in o) d[k] = o[k];
    return d;
  }
  function vistaRegistrar() {
    var acc = el('div', 'rb-acc');
    var bf = el('button', 'rb-foto'); bf.innerHTML = IC.camara; bf.appendChild(document.createTextNode('Tomar o subir fotos')); bf.id = 'rbFotos';
    bf.disabled = !!st.procesando; bf.onclick = function () { archivo.click(); };
    var bs = el('button', 'rb-sin', 'Registrar un gasto sin documento'); bs.id = 'rbSinDoc';
    bs.onclick = function () { st.cola.unshift(nuevoDoc({ sinDoc: true, fecha: hoy(), tipo_gasto: 'estacionamiento' })); st.cur = 0; pintar(); };
    acc.appendChild(bf); acc.appendChild(bs); mod.appendChild(acc);
    if (st.procesando) { var p = el('div', 'rb-leyendo'); p.appendChild(el('i')); p.appendChild(document.createTextNode(st.procesando)); mod.appendChild(p); }
    var s = solicitud();
    if (s && s.estado === 'enviando') mod.appendChild(el('p', 'msg', 'Tu solicitud se está enviando. Espera un momento antes de agregar más gastos.'));
    var d = st.cola[st.cur];
    if (!d) {
      var v = el('div', 'card rb-vacio');
      v.appendChild(el('div', 'name', gastosBorrador().length ? 'No hay recibos por revisar' : 'Sube tu primer recibo'));
      v.appendChild(el('div', 'sub', st.leer ? 'Toma la foto del recibo: la app lee fecha, lugar y valor, y tú solo confirmas.'
        : 'Toma la foto del recibo y completa fecha, lugar y valor. Luego responde una o dos preguntas y la app elige la cuenta de egreso.'));
      if (gastosBorrador().length) { var vb = el('button', 'rb-btn lin', 'Ver mi solicitud'); vb.style.margin = '14px auto 0'; vb.onclick = function () { st.tab = 'solicitud'; pintar(); }; v.appendChild(vb); }
      mod.appendChild(v);
      return;
    }
    mod.appendChild(el('h2', null, d.sinDoc ? 'Gasto sin documento' : 'Recibo ' + (st.cur + 1) + ' de ' + st.cola.length));
    mod.appendChild(tarjeta(d));
    var otros = st.cola.filter(function (x) { return x !== d; });
    if (otros.length) {
      mod.appendChild(el('h2', null, 'En cola · ' + otros.length));
      var h = el('div', 'hoja rb-cola');
      otros.forEach(function (x) {
        var f = el('button', 'fila item'), mini = el('div', 'rb-mini');
        if (x.preview) { var im = el('img'); im.src = x.preview; im.alt = ''; mini.appendChild(im); }
        f.appendChild(mini);
        var mid = el('div'); mid.appendChild(el('div', 'name', x.lugar || (x.sinDoc ? 'Gasto sin documento' : 'Recibo sin completar')));
        mid.appendChild(el('div', 'sub', (x.fecha ? fecha(x.fecha) + ' · ' : '') + (TIPOS.filter(function (t) { return t[0] === x.tipo_gasto; })[0] || ['', ''])[1])); f.appendChild(mid);
        f.appendChild(el('div', 'rb-val', Number(x.total) > 0 ? money(x.total) : '—'));
        f.onclick = function () { st.cur = st.cola.indexOf(x); pintar(); window.scrollTo(0, 0); };
        h.appendChild(f);
      });
      mod.appendChild(h);
    }
  }
  function campo(label, input, full) { var c = el('div', 'rb-campo' + (full ? ' full' : '')); var l = el('label', null, label); var id = 'rb-' + Math.random().toString(36).slice(2, 8); input.id = id; l.htmlFor = id; c.appendChild(l); c.appendChild(input); return c; }
  function tarjeta(d) {
    var c = el('div', 'card rb-card'), resumenVivo = function () {};
    var cab = el('div', 'rb-cab'); cab.appendChild(el('span', 'k', d.lectura ? 'Esto leyó la app · revisa' : d.sinDoc ? 'Completa los datos' : 'Completa los datos del recibo'));
    cab.appendChild(el('span', 'rb-pill ' + (d.sinDoc ? 'bad' : RESP_NORMAL.indexOf(d.tipo_respaldo) >= 0 ? 'ok' : 'warn'), d.sinDoc ? 'Sin documento' : RESP[d.tipo_respaldo]));
    c.appendChild(cab);
    if (!d.sinDoc) {
      var lec = el('div', 'rb-lectura'), th = el('div', 'rb-thumb');
      if (d.preview) { var bt = el('button'); bt.setAttribute('aria-label', 'Ver foto'); var im = el('img'); im.src = d.preview; im.alt = 'Foto del recibo'; bt.appendChild(im); bt.onclick = function () { zoom(d.preview); }; th.appendChild(bt); }
      lec.appendChild(th);
      var info = el('div'); var prov = el('div', 'rb-prov', d.lugar || 'Recibo'); info.appendChild(prov);
      var totv = el('div', 'rb-tot', Number(d.total) > 0 ? money(d.total) : '$—'); info.appendChild(totv);
      resumenVivo = function () { prov.textContent = String(d.lugar || '').trim() || 'Recibo'; totv.textContent = Number(d.total) > 0 ? money(d.total) : '$—'; };
      var meta = [d.ciudad, d.fecha ? fecha(d.fecha) : '', d.numero ? 'Doc. ' + d.numero : ''].filter(Boolean).join(' · ');
      if (meta) info.appendChild(el('div', 'rb-meta', meta));
      lec.appendChild(info); c.appendChild(lec);
    }
    var cs = el('div', 'rb-campos');
    var fF = el('input'); fF.type = 'date'; fF.value = d.fecha || ''; fF.max = hoy(); fF.oninput = fF.onchange = function () { d.fecha = fF.value; actualizar(); };
    var fT = el('input'); fT.type = 'number'; fT.step = '0.01'; fT.min = '0'; fT.inputMode = 'decimal'; fT.value = d.total; fT.placeholder = '0.00'; fT.dataset.campo = 'total';
    var bucket = Number(d.total) > DETALLE;
    fT.oninput = function () {
      d.total = fT.value;
      // Si el valor cruza los $40, aparecen (o se van) las preguntas de detalle sin perder el cursor
      if ((Number(d.total) > DETALLE) !== bucket && d.tipo_gasto === 'comida' && d.ans.ctx) { pintar(); var n = mod.querySelector('[data-campo=total]'); if (n) n.focus(); return; }
      actualizar();
    };
    var fL = el('input'); fL.type = 'text'; fL.value = d.lugar; fL.placeholder = d.sinDoc ? 'Ej.: parqueadero de calle en Cumbayá' : 'Nombre del lugar'; fL.maxLength = 200; fL.oninput = function () { d.lugar = fL.value; actualizar(); };
    var fG = el('select'); TIPOS.forEach(function (t) { var o = el('option', null, t[1]); o.value = t[0]; fG.appendChild(o); }); fG.value = d.tipo_gasto;
    fG.onchange = function () { d.tipo_gasto = fG.value; d.ans = {}; d.override = null; pintar(); };
    cs.appendChild(campo('Fecha', fF)); cs.appendChild(campo('Valor (USD)', fT)); cs.appendChild(campo('Lugar', fL, true)); cs.appendChild(campo('Tipo de gasto', fG, !d.sinDoc));
    if (!d.sinDoc) {
      var fR = el('select'); Object.keys(RESP).forEach(function (k) { var o = el('option', null, RESP[k]); o.value = k; fR.appendChild(o); }); fR.value = d.tipo_respaldo;
      fR.onchange = function () { d.tipo_respaldo = fR.value; pintar(); };
      cs.appendChild(campo('Tipo de respaldo', fR, true));
    } else {
      var fM = el('textarea'); fM.value = d.motivo; fM.maxLength = 300; fM.placeholder = '¿Para qué fue este gasto?'; fM.oninput = function () { d.motivo = fM.value; actualizar(); };
      cs.appendChild(campo('Motivo', fM, true));
    }
    c.appendChild(cs);
    var avBox = el('div'); c.appendChild(avBox);
    preguntas(d).forEach(function (q) {
      var p = el('div', 'rb-preg'); p.appendChild(el('div', 'q', q.label));
      if (q.kind === 'detalle') {
        var socio = d.ans.ctx === 'socio', g = el('div', 'rb-campos'); g.style.marginTop = '0';
        var ip = el('input'); ip.type = 'number'; ip.min = '1'; ip.step = '1'; ip.inputMode = 'numeric'; ip.value = d.ans.personas || ''; ip.oninput = function () { d.ans.personas = ip.value; actualizar(); };
        var iq = el('input'); iq.type = 'text'; iq.maxLength = 120; iq.value = d.ans.quien || ''; iq.oninput = function () { d.ans.quien = iq.value; actualizar(); };
        g.appendChild(campo('Cuántas personas', ip)); g.appendChild(campo(socio ? 'Socio o empresa' : 'Motivo o viaje', iq)); p.appendChild(g);
      } else if (q.kind === 'manual') {
        var sm = el('select'); var o0 = el('option', null, 'Elige una cuenta'); o0.value = ''; sm.appendChild(o0);
        cuentas().forEach(function (k) { var o = el('option', null, k.nombre); o.value = k.nombre; sm.appendChild(o); }); sm.value = d.ans.manual || '';
        sm.onchange = function () { d.ans.manual = sm.value; pintar(); };
        var cm = el('div', 'rb-campo full'); cm.appendChild(sm); sm.setAttribute('aria-label', q.label); p.appendChild(cm);
      } else {
        var ops = el('div', 'rb-ops'); ops.setAttribute('role', 'group'); ops.setAttribute('aria-label', q.label);
        q.opts.forEach(function (op) {
          var b = el('button', 'rb-op' + (d.ans[q.id] === op[0] ? ' on' : ''), op[1]); b.setAttribute('aria-pressed', d.ans[q.id] === op[0] ? 'true' : 'false');
          b.onclick = function () { d.ans[q.id] = op[0]; if (q.id === 'ctx' || q.id === 'socios') delete d.ans.pais; d.override = null; pintar(); };
          ops.appendChild(b);
        });
        p.appendChild(ops);
      }
      c.appendChild(p);
    });
    if (d.ans.pais === 'fuera') {
      var gi = el('div', 'rb-campos'), ii = el('input'); ii.type = 'number'; ii.step = '0.01'; ii.min = '0'; ii.inputMode = 'decimal'; ii.value = d.isd; ii.oninput = function () { d.isd = ii.value; };
      gi.appendChild(campo('ISD pagado, si aplica (USD)', ii, true)); c.appendChild(gi);
    }
    var res = el('div'); c.appendChild(res);
    var bot = el('div', 'rb-botones');
    var bd = el('button', 'rb-btn', 'Descartar'); bd.onclick = function () { st.cola.splice(st.cola.indexOf(d), 1); if (st.cur >= st.cola.length) st.cur = Math.max(0, st.cola.length - 1); pintar(); };
    var ba = el('button', 'rb-btn pri', 'Agregar a mi solicitud'); ba.id = 'rbAgregar'; ba.onclick = function () { agregar(d, ba); };
    bot.appendChild(bd); bot.appendChild(ba); c.appendChild(bot);
    var falta = el('div', 'rb-falta'); c.appendChild(falta);
    function actualizar() {
      resumenVivo();
      avBox.textContent = '';
      avisos(d).forEach(function (a) { var x = el('div', 'rb-aviso' + (a[0] === 'bad' ? ' bad' : '')); x.appendChild(el('span', null, a[1])); avBox.appendChild(x); });
      res.textContent = '';
      var cta = cuentaFinal(d);
      var cb = el('div', 'rb-cuenta'); cb.appendChild(el('div', 'k', 'Cuenta de egreso'));
      if (cta) {
        cb.appendChild(el('div', 'v', cta));
        var cambiada = d.override && d.override !== cuentaRegla(d);
        cb.appendChild(el('div', 'g', 'Grupo: ' + (grupoDe(cta) || '—') + (cambiada ? ' · cambiada a mano (finanzas lo verá)' : ' · sale de tus respuestas')));
        if (d.cambiar) {
          var sc = el('select'); var o1 = el('option', null, 'Usar la sugerida'); o1.value = ''; sc.appendChild(o1);
          cuentas().forEach(function (k) { var o = el('option', null, k.nombre); o.value = k.nombre; sc.appendChild(o); }); sc.value = d.override || '';
          sc.onchange = function () { d.override = sc.value || null; d.cambiar = false; pintar(); };
          var w = el('div', 'rb-campo'); w.style.marginTop = '10px'; sc.setAttribute('aria-label', 'Cuenta de egreso'); w.appendChild(sc); cb.appendChild(w);
        } else { var bc = el('button', 'cambiar', 'Cambiar cuenta'); bc.onclick = function () { d.cambiar = true; pintar(); }; cb.appendChild(bc); }
      } else cb.appendChild(el('div', 'g', 'Responde la pregunta para ver la cuenta'));
      res.appendChild(cb);
      var f = faltantes(d);
      ba.disabled = f.length > 0 || !!st.procesando && !d.ruta && !d.sinDoc;
      falta.textContent = f.length ? 'Falta: ' + f.join(', ') : '';
    }
    actualizar();
    return c;
  }
  async function agregar(d, btn) {
    if (faltantes(d).length) return;
    var cta = cuentaFinal(d), sug = cuentaRegla(d);
    var resp = {}; for (var k in d.ans) resp[k] = d.ans[k];
    var p = { fecha: d.fecha, lugar: String(d.lugar).trim(), ciudad: d.ciudad, valor: r2(d.total), isd: d.ans.pais === 'fuera' ? r2(Number(d.isd) || 0) : 0,
      cuenta: cta, cuenta_sugerida: sug || cta, tipo_gasto: d.tipo_gasto, tipo_respaldo: d.sinDoc ? null : d.tipo_respaldo, sin_documento: d.sinDoc,
      numero_documento: d.numero, motivo: d.sinDoc ? d.motivo : null, respuestas: resp, avisos: avisos(d).map(function (a) { return a[1]; }),
      lectura: d.lectura, ruta_foto: d.sinDoc ? null : d.ruta };
    btn.disabled = true; btn.textContent = 'Guardando…';
    var r = await sb.rpc('rb_guardar_gasto', { p: p });
    if (r.error) { btn.disabled = false; btn.textContent = 'Agregar a mi solicitud'; toast(errTexto(r.error), true); return; }
    if (st.info) st.info.solicitud = r.data;
    st.cola.splice(st.cola.indexOf(d), 1); if (st.cur >= st.cola.length) st.cur = Math.max(0, st.cola.length - 1);
    toast('Agregado a tu solicitud: ' + cta);
    pintar(); window.scrollTo(0, 0);
  }

  // Reduce la foto (lado mayor 1600 px, JPEG) antes de subirla
  async function reducir(file) {
    try {
      var bmp = await createImageBitmap(file);
      var s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      var cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      var b = await new Promise(function (res) { cv.toBlob(function (x) { res(x); }, 'image/jpeg', 0.82); });
      if (b) return b;
    } catch (e) {}
    return /^image\/(jpeg|png|webp)$/.test(file.type) ? file : null;
  }
  function idArchivo() { try { return crypto.randomUUID().replace(/-/g, ''); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); } }
  async function subirFotos(files) {
    var uid = st.u && st.u.id; if (!uid) return;
    for (var i = 0; i < files.length; i++) {
      st.procesando = 'Subiendo foto ' + (i + 1) + ' de ' + files.length + '…'; pintar();
      var blob = await reducir(files[i]);
      if (!blob) { toast('La foto ' + (i + 1) + ' tiene un formato que no se puede abrir. Prueba con otra.', true); continue; }
      var ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      var ruta = uid + '/' + idArchivo() + '.' + ext;
      var up = await sb.storage.from('reembolsos').upload(ruta, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if (up.error) { toast('No se pudo subir la foto ' + (i + 1) + '. Revisa tu conexión.', true); continue; }
      var prev = URL.createObjectURL(blob);
      var docs = null;
      if (st.leer) {
        st.procesando = 'Leyendo recibo ' + (i + 1) + ' de ' + files.length + '…'; pintar();
        try { var lr = await fn('rb-leer', { ruta: ruta }); if (lr.legible && lr.documentos && lr.documentos.length) docs = lr.documentos; else if (lr.disponible !== false) toast('No se pudo leer la foto ' + (i + 1) + '. Completa los datos a mano.'); }
        catch (e) { toast(errTexto(e), true); }
      }
      if (docs) docs.forEach(function (x) {
        st.cola.push(nuevoDoc({ ruta: ruta, preview: prev, lugar: x.proveedor || '', ciudad: x.ciudad, fecha: x.fecha || '', numero: x.numero_documento, subtotal: x.subtotal, iva: x.iva,
          propina: x.propina_o_servicio || 0, total: x.total != null ? x.total : '', tipo_gasto: x.tipo_gasto || 'otro', tipo_respaldo: RESP[x.tipo_respaldo] ? x.tipo_respaldo : 'otro',
          ilegibles: x.campos_ilegibles || [], nota: x.nota || '', lectura: x }));
      });
      else st.cola.push(nuevoDoc({ ruta: ruta, preview: prev, fecha: hoy() }));
    }
    st.procesando = ''; if (st.cur >= st.cola.length) st.cur = 0; pintar();
  }

  // ---- Mi solicitud ----
  function vistaSolicitud() {
    var s = solicitud(), G = gastosBorrador();
    if (!s || !G.length) {
      var v = el('div', 'card rb-vacio'); v.appendChild(el('div', 'name', 'Tu solicitud está vacía'));
      v.appendChild(el('div', 'sub', 'Agrega tus recibos en la pestaña Registrar. Cuando estés listo, la envías desde aquí.'));
      var b = el('button', 'rb-btn pri', 'Registrar un gasto'); b.style.margin = '14px auto 0'; b.onclick = function () { st.tab = 'registrar'; pintar(); };
      v.appendChild(b); mod.appendChild(v); enviadas(); return;
    }
    var fs = G.map(function (g) { return g.fecha; }).sort();
    var est = el('div', 'rb-estado');
    var ep = { 'borrador': ['Borrador', 'gris'], 'enviando': ['Enviando…', 'warn'], 'error de envío': ['Error de envío', 'bad'] }[s.estado] || [s.estado, 'gris'];
    est.appendChild(el('span', 'rb-pill ' + ep[1], ep[0])); est.appendChild(document.createTextNode('Período ' + fecha(fs[0]) + ' – ' + fecha(fs[fs.length - 1])));
    mod.appendChild(est);
    if (s.estado === 'error de envío') { var ae = el('div', 'rb-aviso bad'); ae.appendChild(el('span', null, 'El último envío no salió. Tus gastos y fotos siguen guardados: vuelve a pulsar Enviar.')); mod.appendChild(ae); }
    var total = r2(s.total), ant = r2(s.anticipos || 0), auto = G.filter(function (g) { return !g.sin_documento && r2(Number(g.valor) + Number(g.isd || 0)) < AUTO; }).length;
    var tot = el('div', 'rb-total'); tot.appendChild(el('span', 'pildora', 'Mi solicitud'));
    tot.appendChild(el('span', 'cifra', money(total - ant))); tot.appendChild(el('span', 'et', 'a reembolsar'));
    var rs = el('div', 'rb-res');
    [['Gastos', G.length, ''], ['Se aprueban solos', auto, 'var(--ok)'], ['Revisa finanzas', G.length - auto, 'var(--warn)']].forEach(function (x) { var dv = el('div', null, x[0]); var bb = el('b', null, String(x[1])); if (x[2]) bb.style.color = x[2]; dv.appendChild(bb); rs.appendChild(dv); });
    tot.appendChild(rs); mod.appendChild(tot);
    mod.appendChild(el('h2', null, 'Gastos'));
    var h = el('div', 'hoja'), claves = {};
    G.forEach(function (g) { var k = clave(g.lugar, g.fecha, Number(g.valor) + Number(g.isd || 0), g.numero_documento); claves[k] = (claves[k] || 0) + 1; });
    var editable = s.estado !== 'enviando';
    G.forEach(function (g, i) {
      var row = el('div', 'rb-g'); row.appendChild(el('span', 'rb-n', String(i + 1)));
      var mid = el('div'); mid.appendChild(el('div', 'name', g.lugar)); mid.appendChild(el('div', 'sub', fecha(g.fecha) + ' · ' + g.cuenta));
      var tags = el('div', 'tags');
      if (g.sin_documento) tags.appendChild(el('span', 'rb-pill bad', 'Sin documento'));
      else if (RESP_NORMAL.indexOf(g.tipo_respaldo) < 0) tags.appendChild(el('span', 'rb-pill warn', RESP[g.tipo_respaldo] || 'Otro respaldo'));
      if (g.cuenta_cambiada) tags.appendChild(el('span', 'rb-pill warn', 'Cuenta cambiada'));
      if (claves[clave(g.lugar, g.fecha, Number(g.valor) + Number(g.isd || 0), g.numero_documento)] > 1) tags.appendChild(el('span', 'rb-pill bad', 'Posible duplicado'));
      if (!g.sin_documento && r2(Number(g.valor) + Number(g.isd || 0)) < AUTO) tags.appendChild(el('span', 'rb-pill ok', 'Se aprueba solo'));
      if (tags.childNodes.length) mid.appendChild(tags);
      row.appendChild(mid);
      var der = el('div', 'der'); var val = el('div', 'rb-val', money(Number(g.valor) + Number(g.isd || 0))); val.appendChild(el('small', null, g.sin_documento ? 'Sin documento' : (RESP[g.tipo_respaldo] || '').split(',')[0])); der.appendChild(val);
      if (editable) {
        var q = el('button', 'rb-btn mini' + (st.quitar === g.id ? ' peligro' : ''), st.quitar === g.id ? '¿Quitar?' : 'Quitar');
        q.onclick = function () { if (st.quitar !== g.id) { st.quitar = g.id; pintar(); return; } quitar(g.id); };
        der.appendChild(q);
      }
      row.appendChild(der); h.appendChild(row);
    });
    mod.appendChild(h);
    var sum = el('div', 'hoja rb-sumas'); sum.style.marginTop = '12px'; var dl = el('dl'); dl.style.margin = '0';
    var d1 = el('div', 'dato'); d1.appendChild(el('dt', null, 'Suma de gastos')); d1.appendChild(el('dd', null, money(total))); dl.appendChild(d1);
    var an = el('div', 'rb-ant'); var al = el('label', 'sub', 'Anticipos recibidos'); al.style.fontSize = '14px'; al.htmlFor = 'rbAnt';
    var ai = el('input'); ai.id = 'rbAnt'; ai.type = 'number'; ai.step = '0.01'; ai.min = '0'; ai.inputMode = 'decimal'; ai.value = ant ? ant.toFixed(2) : ''; ai.placeholder = '0.00'; ai.disabled = !editable;
    ai.onchange = async function () { var v = Number(ai.value) || 0; var r = await sb.rpc('rb_anticipos', { p_valor: v }); if (r.error) { toast(errTexto(r.error), true); return; } st.info.solicitud = r.data; pintar(); };
    an.appendChild(al); an.appendChild(ai); dl.appendChild(an);
    var d3 = el('div', 'dato clave'); d3.appendChild(el('dt', null, 'Total a reembolsar')); d3.appendChild(el('dd', null, money(total - ant))); dl.appendChild(d3);
    sum.appendChild(dl); mod.appendChild(sum);

    var bot = el('div', 'rb-botones'); bot.style.gridTemplateColumns = '1fr';
    if (!st.confirmar) {
      var be = el('button', 'rb-btn pri', st.enviando ? 'Enviando…' : 'Enviar solicitud de reembolso'); be.id = 'rbEnviar';
      be.disabled = st.enviando || !editable || st.correo === false;
      be.onclick = function () { st.confirmar = true; pintar(); };
      bot.appendChild(be);
    } else {
      var cf = el('div', 'rb-confirma');
      cf.appendChild(el('p', null, 'Se enviará a finanzas un correo con el Excel y el PDF de tus ' + G.length + ' recibos, por ' + money(total - ant) + '. Después ya no podrás cambiar estos gastos.'));
      var cb = el('div', 'rb-botones'); cb.style.marginTop = '0';
      var no = el('button', 'rb-btn', 'Cancelar'); no.onclick = function () { st.confirmar = false; pintar(); };
      var si = el('button', 'rb-btn pri', 'Sí, enviar'); si.id = 'rbConfirmar'; si.onclick = enviar;
      cb.appendChild(no); cb.appendChild(si); cf.appendChild(cb); bot.appendChild(cf);
    }
    var bx = el('button', 'rb-btn lin', 'Descargar reporte (Excel)'); bx.onclick = function () { descargarExcel(null, bx); }; bot.appendChild(bx);
    mod.appendChild(bot);
    if (st.correo === false) mod.appendChild(el('p', 'rb-nota', 'El envío por correo aún no está activado. Puedes ir registrando tus gastos; William te avisará cuando ya se pueda enviar.'));
    else mod.appendChild(el('p', 'rb-nota', 'Al enviar, finanzas recibe un correo con el Excel y un PDF con la foto de cada recibo. Los gastos de menos de $10 con documento se aprueban solos; el resto los revisa finanzas.'));
    enviadas();
  }
  async function quitar(id) {
    st.quitar = null;
    var r = await sb.rpc('rb_descartar_gasto', { p_id: id });
    if (r.error) { toast(errTexto(r.error), true); pintar(); return; }
    st.info.solicitud = r.data; toast('Gasto quitado de tu solicitud'); pintar();
  }
  async function enviar() {
    st.confirmar = false; st.enviando = true; pintar();
    try {
      var r = await fn('rb-enviar', { modo: 'enviar' });
      st.enviando = false; await cargarEstado(); st.tab = 'solicitud';
      toast(r.partes > 1 ? 'Solicitud enviada en ' + r.partes + ' correos' : 'Solicitud enviada a finanzas');
    } catch (e) { st.enviando = false; await cargarEstado(); toast(errTexto(e), true); }
    pintar(); window.scrollTo(0, 0);
  }
  async function descargarExcel(solId, btn) {
    var txt = btn.textContent; btn.disabled = true; btn.textContent = 'Preparando…';
    try {
      var r = await fn('rb-enviar', solId ? { modo: 'excel', solicitud_id: solId } : { modo: 'excel' }, true);
      var a = document.createElement('a'); a.href = URL.createObjectURL(r.archivo); a.download = r.nombre || 'Reporte_de_gastos.xlsx';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    } catch (e) { toast(errTexto(e), true); }
    btn.disabled = false; btn.textContent = txt;
  }
  var DEC = { aprobado: ['Aprobado', 'ok'], observado: ['Observado', 'bad'], pendiente: ['Por revisar', 'warn'] };
  var EST = { enviada: ['En revisión', 'warn'], aprobada: ['Aprobada', 'ok'], 'con observaciones': ['Con observaciones', 'bad'] };
  function enviadas() {
    var L = (st.info && st.info.enviadas) || []; if (!L.length) return;
    mod.appendChild(el('h2', null, 'Solicitudes enviadas'));
    var h = el('div', 'hoja');
    L.forEach(function (s) {
      var b = el('div', 'rb-env'), row = el('div', 'row'), izq = el('div');
      izq.appendChild(el('div', 'name', money(Number(s.total) - Number(s.anticipos || 0))));
      izq.appendChild(el('div', 'sub', 'Enviada el ' + fecha(String(s.fecha_envio || '').slice(0, 10)) + ' · ' + s.gastos.length + ' gastos'));
      row.appendChild(izq); var e = EST[s.estado] || [s.estado, 'gris']; row.appendChild(el('span', 'rb-pill ' + e[1], e[0])); b.appendChild(row);
      s.gastos.filter(function (g) { return g.decision === 'observado'; }).forEach(function (g) {
        b.appendChild(el('div', 'rb-nota-obs', 'N° ' + g.n + ' · ' + g.lugar + ': ' + (g.nota || 'observado')));
      });
      h.appendChild(b);
    });
    mod.appendChild(h);
  }

  // ===================== Revisar reembolsos (solo william@) =====================
  function pintarRevision() {
    mod.textContent = '';
    if (st.rev.det) return detalleRevision();
    var L = st.rev.lista;
    var pend = (L || []).filter(function (s) { return s.por_revisar > 0; });
    mod.appendChild(el('h2', null, 'Por revisar · ' + pend.length)); mod.lastChild.style.marginTop = '6px';
    if (!L) { mod.appendChild(el('p', 'msg', 'Cargando…')); return; }
    var lista = function (arr, vacio) {
      var h = el('div', 'hoja');
      if (!arr.length) { h.appendChild(el('div', 'msg', vacio)); }
      arr.forEach(function (s) {
        var f = el('button', 'fila item rb-sol'); f.appendChild(el('div', 'rb-av', iniciales(s.nombre)));
        var mid = el('div'); mid.appendChild(el('div', 'name', s.nombre));
        mid.appendChild(el('div', 'sub', s.gastos + ' gastos' + (s.por_revisar ? ' · ' + s.por_revisar + ' por revisar' : '') + ' · enviada el ' + fecha(String(s.fecha_envio || '').slice(0, 10))));
        f.appendChild(mid);
        var v = el('div', 'rb-val', money(s.total)); var e = EST[s.estado] || [s.estado, 'gris']; v.appendChild(el('small', null, e[0])); f.appendChild(v);
        f.onclick = function () { abrirSolicitud(s.id); };
        h.appendChild(f);
      });
      mod.appendChild(h);
    };
    lista(pend, 'No hay solicitudes pendientes.');
    var hechas = L.filter(function (s) { return !s.por_revisar; });
    if (hechas.length) { mod.appendChild(el('h2', null, 'Revisadas')); lista(hechas, ''); }
  }
  async function abrirSolicitud(id, silencioso) {
    var r = await sb.rpc('rb_rev_detalle', { p_id: id });
    if (r.error) { if (!silencioso) toast(errTexto(r.error), true); return; }
    st.rev.det = r.data; st.rev.obs = null;
    if (!silencioso) { pintar(); window.scrollTo(0, 0); }
  }
  function ctxTexto(g) {
    var a = g.respuestas || {}, t = [];
    if (a.ctx) t.push({ socio: 'Con un socio', viaje: 'Por un viaje', equipo: 'Con el equipo de CITEC' }[a.ctx]);
    if (a.pais) t.push(a.pais === 'fuera' ? 'fuera del país' : 'dentro del país');
    if (a.socios) t.push(a.socios === 'si' ? 'reunión con socios' : 'no fue con socios');
    if (a.personas) t.push(a.personas + ' personas');
    if (a.quien) t.push(a.quien);
    return t.join(' · ');
  }
  function detalleRevision() {
    var s = st.rev.det, G = s.gastos || [];
    var back = el('button', 'back rb-back', '‹ Solicitudes'); back.onclick = function () { st.rev.det = null; cargarRevision().then(pintar); pintar(); }; mod.appendChild(back);
    mod.appendChild(el('h2', null, 'Solicitud de ' + s.nombre)); mod.lastChild.style.marginTop = '6px';
    var fs = G.map(function (g) { return g.fecha; }).sort();
    mod.appendChild(el('div', 'sub', (fs.length ? 'Período ' + fecha(fs[0]) + ' – ' + fecha(fs[fs.length - 1]) + ' · ' : '') + 'enviada el ' + fecha(String(s.fecha_envio || '').slice(0, 10))));
    var suma = function (dec) { return G.filter(function (g) { return !dec || g.decision === dec; }).reduce(function (a, g) { return a + Number(g.valor) + Number(g.isd || 0); }, 0); };
    var k = el('div', 'rb-kpis');
    [['Solicitado', suma(), ''], ['Aprobado', suma('aprobado'), 'var(--ok)'], ['Por revisar', suma('pendiente'), 'var(--warn)'], ['Observado', suma('observado'), 'var(--bad)']].forEach(function (x) {
      var b = el('div', 'rb-k'); b.appendChild(el('div', 'l', x[0])); var v = el('div', 'v', money(x[1])); if (x[2]) v.style.color = x[2]; b.appendChild(v); k.appendChild(b);
    });
    mod.appendChild(k);
    if (Number(s.anticipos) > 0) mod.appendChild(el('p', 'sub', 'Anticipos declarados: ' + money(s.anticipos) + ' · total a reembolsar ' + money(suma() - Number(s.anticipos))));
    var h = el('div', 'hoja');
    G.forEach(function (g) {
      var row = el('div', 'rb-g'); row.appendChild(el('span', 'rb-n', String(g.n || '')));
      var mid = el('div'); mid.appendChild(el('div', 'name', g.lugar));
      mid.appendChild(el('div', 'sub', fecha(g.fecha) + ' · ' + g.cuenta));
      var cx = ctxTexto(g); if (cx) mid.appendChild(el('div', 'rb-ctx', cx));
      if (g.motivo) mid.appendChild(el('div', 'rb-ctx', 'Motivo: ' + g.motivo));
      var tags = el('div', 'tags');
      if (g.sin_documento) tags.appendChild(el('span', 'rb-pill bad', 'Sin documento'));
      else tags.appendChild(el('span', 'rb-pill ' + (RESP_NORMAL.indexOf(g.tipo_respaldo) >= 0 ? 'ok' : 'warn'), RESP[g.tipo_respaldo] || 'Otro respaldo'));
      if (g.cuenta_cambiada) tags.appendChild(el('span', 'rb-pill warn', 'Cuenta cambiada a mano'));
      if (g.decision_auto) tags.appendChild(el('span', 'rb-pill ok', 'Aprobado automático'));
      mid.appendChild(tags);
      if (g.cuenta_cambiada && g.cuenta_sugerida) mid.appendChild(el('div', 'rb-ctx', 'La app sugería: ' + g.cuenta_sugerida));
      (g.avisos || []).filter(function (a) { return !/^Sin documento:/.test(a); }).forEach(function (a) { mid.appendChild(el('div', 'rb-ctx', '⚠ ' + a)); });
      var seg = el('div', 'rb-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Decisión sobre ' + g.lugar);
      var ok = el('button', g.decision === 'aprobado' ? 'ok' : '', 'Aprobar'), ob = el('button', g.decision === 'observado' ? 'obs' : '', 'Observar');
      ok.setAttribute('aria-pressed', g.decision === 'aprobado' ? 'true' : 'false'); ob.setAttribute('aria-pressed', g.decision === 'observado' ? 'true' : 'false');
      ok.onclick = function () { decidir(g.id, 'aprobado'); };
      ob.onclick = function () { st.rev.obs = g.id; pintar(); };
      seg.appendChild(ok); seg.appendChild(ob); mid.appendChild(seg);
      if (g.decision === 'observado' && g.nota && st.rev.obs !== g.id) mid.appendChild(el('div', 'rb-nota-obs', 'Observación: ' + g.nota));
      if (st.rev.obs === g.id) {
        var fo = el('div', 'rb-obs'), io = el('input'); io.type = 'text'; io.maxLength = 300; io.placeholder = '¿Qué hay que corregir?'; io.value = g.nota || ''; io.setAttribute('aria-label', 'Observación');
        var bg = el('button', 'rb-btn mini pri', 'Guardar'); bg.onclick = function () { if (!io.value.trim()) { io.focus(); return; } decidir(g.id, 'observado', io.value.trim()); };
        fo.appendChild(io); fo.appendChild(bg); mid.appendChild(fo); setTimeout(function () { io.focus(); }, 0);
      }
      if (g.ruta_foto && !s.fotos_borradas) { var vf = el('button', 'rb-ver', 'Ver foto'); vf.onclick = function () { verFoto(g.ruta_foto, vf); }; mid.appendChild(vf); }
      else mid.appendChild(el('div', 'rb-pag', g.sin_documento ? 'Sin foto · página final del PDF' : 'Foto en el PDF del correo, página con el N° ' + g.n));
      row.appendChild(mid);
      row.appendChild(el('div', 'rb-val', money(Number(g.valor) + Number(g.isd || 0))));
      h.appendChild(row);
    });
    mod.appendChild(h);
    var falta = G.filter(function (g) { return g.decision === 'pendiente'; }).length;
    var bot = el('div', 'rb-botones'); bot.style.gridTemplateColumns = '1fr';
    var est = el('button', 'rb-btn', falta ? 'Faltan ' + falta + ' por revisar' : s.estado === 'aprobada' ? 'Solicitud aprobada ✓' : 'Revisión terminada · con observaciones');
    est.disabled = true; est.style.opacity = '.75'; bot.appendChild(est);
    var bx = el('button', 'rb-btn lin', 'Descargar reporte (Excel)'); bx.onclick = function () { descargarExcel(s.id, bx); }; bot.appendChild(bx);
    mod.appendChild(bot);
    mod.appendChild(el('p', 'rb-nota', 'Solo los gastos de menos de $10 con documento llegan aprobados. Todos los demás, y cualquier gasto sin documento, esperan tu decisión.'));
  }
  async function decidir(id, dec, nota) {
    var r = await sb.rpc('rb_rev_decidir', { p_gasto: id, p_decision: dec, p_nota: nota || null });
    if (r.error) { toast(errTexto(r.error), true); return; }
    st.rev.det = r.data; st.rev.obs = null; pintar();
    cargarRevision();
  }
  async function verFoto(ruta, btn) {
    btn.disabled = true;
    var r = await sb.storage.from('reembolsos').createSignedUrl(ruta, 300);
    btn.disabled = false;
    if (r.error || !r.data) { toast('No se pudo abrir la foto.', true); return; }
    zoom(r.data.signedUrl);
  }
  function zoom(src) {
    cerrarZoom();
    var z = el('div', 'rb-zoom'); z.id = 'rbZoom'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', 'Foto del recibo');
    var im = el('img'); im.src = src; im.alt = 'Foto del recibo'; z.appendChild(im);
    var c = el('button', 'rb-btn pri', 'Cerrar'); c.onclick = cerrarZoom; z.appendChild(c);
    z.onclick = function (e) { if (e.target === z) cerrarZoom(); };
    document.body.appendChild(z); c.focus();
  }
  function cerrarZoom() { var z = $('rbZoom'); if (z) z.remove(); }

  // ===================== Gestos (deslizar con el dedo) =====================
  // En reembolsos y revisión: hacia la derecha abre el menú (o vuelve a la pestaña/lista anterior);
  // en Registrar, hacia la izquierda pasa a Mi solicitud. Con el menú abierto, hacia la izquierda lo cierra.
  // En Consultar socios los gestos los maneja app.js (desde Resumen, hacia la derecha también abre el menú).
  (function () {
    var x0 = null, y0 = 0, t0 = 0, scr = null, scrL = 0;
    function desplazableH(n) { for (; n && n !== document.body && n.nodeType === 1; n = n.parentNode) if (n.scrollWidth > n.clientWidth + 1) return n; return null; }
    document.addEventListener('touchstart', function (e) {
      x0 = null;
      if (e.touches.length !== 1 || !st.u || $('rbZoom')) return;
      if (!cajon.classList.contains('on') && st.modulo === 'socios') return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
      scr = desplazableH(e.target); scrL = scr ? scr.scrollLeft : 0;
    }, { passive: true });
    document.addEventListener('touchcancel', function () { x0 = null; }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2 || Date.now() - t0 > 1000) return;
      if (scr && Math.abs(scr.scrollLeft - scrL) > 2) return;
      if (cajon.classList.contains('on')) { if (dx < 0) cerrarMenu(); return; }
      if (dx > 0) {
        if (st.modulo === 'revision' && st.rev.det) { st.rev.det = null; st.rev.obs = null; pintar(); cargarRevision().then(pintar); window.scrollTo(0, 0); return; }
        if (st.modulo === 'reembolsos' && st.tab === 'solicitud') { st.tab = 'registrar'; st.confirmar = false; pintar(); window.scrollTo(0, 0); return; }
        abrirMenu();
      } else if (st.modulo === 'reembolsos' && st.tab === 'registrar') { st.tab = 'solicitud'; pintar(); window.scrollTo(0, 0); }
    }, { passive: true });
  })();

  // ===================== Sesión =====================
  async function alEntrar(u) {
    st.u = u; hb.classList.remove('hidden');
    pintarMenu();
    if (await cargarEstado()) {
      if (st.info.permitido) { try { st.leer = !!(await fn('rb-leer', { modo: 'estado' })).disponible; } catch (e) { st.leer = false; } }
      if (st.info.revisor) await cargarRevision();
      pintarMenu();
    }
  }
  function alSalir() {
    st = { u: null, info: null, modulo: 'socios', tab: 'registrar', cola: [], cur: 0, leer: false, correo: null, procesando: '', confirmar: false, enviando: false, quitar: null, rev: { lista: null, det: null, obs: null } };
    hb.classList.add('hidden'); cerrarMenu(); cerrarZoom(); mod.classList.add('hidden'); mod.textContent = '';
  }
  document.addEventListener('citec:sesion', function (e) { alEntrar(e.detail); });
  document.addEventListener('citec:salir', alSalir);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.u && st.modulo !== 'socios' && !st.procesando && !st.enviando) refrescar(); });
  if (C.usuario) alEntrar(C.usuario);
})();
