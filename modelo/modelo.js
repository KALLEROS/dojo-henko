// =========================================================
//  Visor del modelo isométrico de Dojo Henko.
//  Arrastrar = mover · pellizcar / Ctrl+rueda / botones = zoom
//  Girar = cambia de esquina (4 vistas) · tocar un objeto = nombre y medida
//  Los dibujos vienen de modelo/vistas.js (se generan con modelo/build.mjs).
// =========================================================
(() => {
  "use strict";
  const raiz = document.getElementById("modelo-dojo");
  const datos = window.DOJO_MODELO;
  if (!raiz || !datos) return;
  const { width: W, height: H, views } = datos;
  const quieto = matchMedia("(prefers-reduced-motion: reduce)");
  const ZMIN = 1, ZMAX = 6;
  const NOMBRES_VISTA = ["desde la entrada, lado izquierdo", "desde el fondo, lado izquierdo", "desde el fondo, lado derecho", "desde la entrada, lado derecho"];

  const icono = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  raiz.innerHTML = `
    <div class="md-card iso" data-theme="light">
      <div class="md-esquinas" aria-hidden="true">
        <span class="md-fig">Fig 1</span>
        <span class="md-titulo">Dojo Henko · interior</span>
      </div>
      <div class="md-escenario" tabindex="0" role="application" aria-roledescription="modelo 3D" aria-label="Modelo del dojo. Flechas para mover, más y menos para acercar, R para girar, cero para centrar.">
        <div class="md-lienzo"></div>
      </div>
      <div class="md-herramientas" role="toolbar" aria-label="Controles del modelo">
        <button type="button" data-accion="girar-izq" aria-label="Girar a la izquierda">${icono("M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4")}</button>
        <button type="button" data-accion="girar-der" aria-label="Girar a la derecha">${icono("M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4")}</button>
        <span class="md-sep" aria-hidden="true"></span>
        <button type="button" data-accion="alejar" aria-label="Alejar">${icono("M5 12h14")}</button>
        <button type="button" data-accion="acercar" aria-label="Acercar">${icono("M12 5v14M5 12h14")}</button>
        <button type="button" data-accion="centrar" aria-label="Ver todo">${icono("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5")}</button>
      </div>
      <div class="md-pie">
        <div class="md-escala" aria-label="Escala"><span class="md-barra"></span><span class="md-escala-txt">1 m</span></div>
        <p class="md-lectura" aria-live="polite"></p>
      </div>
    </div>
    <p class="md-ayuda">Arrastra para recorrerlo · pellizca o usa <kbd>+</kbd> <kbd>−</kbd> para acercar · toca un objeto para ver qué es y cuánto mide.</p>`;

  const card = raiz.querySelector(".md-card");
  const escenario = raiz.querySelector(".md-escenario");
  const lienzo = raiz.querySelector(".md-lienzo");
  const lectura = raiz.querySelector(".md-lectura");
  const barra = raiz.querySelector(".md-barra");
  const escalaTxt = raiz.querySelector(".md-escala-txt");

  let vista = 0, svg = null;
  let zoom = 1, cx = W / 2, cy = H / 2;             // actual
  let zMeta = 1, cxMeta = W / 2, cyMeta = H / 2;    // hacia donde va
  let seleccion = null, visible = false, frame = 0, ultimo = 0, reposo = 0;

  // ---------- vistas ----------
  function ponerVista(i) {
    vista = (i + views.length) % views.length;
    lienzo.innerHTML = views[vista].svg;
    svg = lienzo.querySelector("svg");
    resortes.clear();
    seleccion = null;
    aplicar();
    decir();
  }

  // ---------- zoom y movimiento ----------
  const limitar = () => {
    zMeta = Math.min(ZMAX, Math.max(ZMIN, zMeta));
    const mw = W / zMeta / 2, mh = H / zMeta / 2;
    cxMeta = Math.min(W - mw * 0.4, Math.max(mw * 0.4, cxMeta));
    cyMeta = Math.min(H - mh * 0.4, Math.max(mh * 0.4, cyMeta));
    if (zMeta === 1) { cxMeta = W / 2; cyMeta = H / 2; }
  };
  function aplicar() {
    if (!svg) return;
    const w = W / zoom, h = H / zoom;
    svg.setAttribute("viewBox", `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    escenario.style.touchAction = zMeta > 1.01 ? "none" : "pan-y";
    // regla: cuántos px ocupa un metro en pantalla (sobre el piso)
    const px = views[vista].pxPerMetre * (escenario.clientWidth / W) * zoom;
    const opciones = [0.1, 0.2, 0.25, 0.5, 1, 2, 5];
    const metros = opciones.find((o) => o * px >= 56) || 5;
    barra.style.width = `${(metros * px).toFixed(1)}px`;
    escalaTxt.textContent = metros < 1 ? `${Math.round(metros * 100)} cm` : `${metros} m`;
  }
  function decir() {
    if (seleccion) {
      lectura.innerHTML = `<b>${seleccion.dataset.name}</b> · ${seleccion.dataset.info}`;
    } else {
      lectura.textContent = `Vista ${vista + 1} de 4, ${NOMBRES_VISTA[vista]} · zoom ${zMeta.toFixed(1)}×`;
    }
  }
  // punto de pantalla → coordenadas del dibujo
  function aDibujo(clientX, clientY, z = zoom, x = cx, y = cy) {
    const r = escenario.getBoundingClientRect();
    const k = W / z / r.width;
    return [x + (clientX - r.left - r.width / 2) * k, y + (clientY - r.top - r.height / 2) * k * (r.width / r.height) * (H / W)];
  }
  function zoomEn(factor, clientX, clientY) {
    const antes = clientX == null ? [cxMeta, cyMeta] : aDibujo(clientX, clientY, zMeta, cxMeta, cyMeta);
    zMeta *= factor;
    limitar();
    if (clientX != null) {
      const despues = aDibujo(clientX, clientY, zMeta, cxMeta, cyMeta);
      cxMeta += antes[0] - despues[0];
      cyMeta += antes[1] - despues[1];
      limitar();
    }
    decir();
    correr();
  }

  // ---------- objetos que se mueven al tocarlos ----------
  const resortes = new Map();
  function golpear(pieza, fuerza = 1) {
    const grupos = pieza.matches("[data-swing],[data-wobble]") ? [pieza] : [...pieza.querySelectorAll("[data-swing],[data-wobble]")];
    for (const g of grupos) {
      const r = resortes.get(g) || { x: 0, v: 0, dir: g.dataset.dir.split(",").map(Number), rapido: g.hasAttribute("data-fast"), pesado: g.hasAttribute("data-wobble") };
      r.v += (r.rapido ? 70 : r.pesado ? 14 : 22) * fuerza;
      resortes.set(g, r);
    }
    correr();
  }
  function pasoResortes(dt) {
    let vivos = false;
    for (const [g, r] of resortes) {
      const kk = r.rapido ? 420 : r.pesado ? 160 : 30, c = r.rapido ? 7 : r.pesado ? 9 : 1.4;
      for (let i = 0; i < 4; i++) { r.v += (-kk * r.x - c * r.v) * dt / 4; r.x += r.v * dt / 4; }
      const lim = r.pesado ? 2 : 5;
      r.x = Math.max(-lim, Math.min(lim, r.x));
      if (Math.abs(r.x) < 0.01 && Math.abs(r.v) < 0.01) { r.x = 0; r.v = 0; resortes.delete(g); }
      else vivos = true;
      g.setAttribute("transform", `translate(${(r.dir[0] * r.x).toFixed(2)} ${(r.dir[1] * r.x).toFixed(2)})`);
    }
    return vivos;
  }

  // ---------- ciclo ----------
  function tick(t) {
    const dt = ultimo ? Math.min((t - ultimo) / 1000, 1 / 30) : 1 / 60;
    ultimo = t;
    const f = quieto.matches ? 1 : 1 - Math.exp(-dt / 0.12);
    zoom += (zMeta - zoom) * f; cx += (cxMeta - cx) * f; cy += (cyMeta - cy) * f;
    if (Math.abs(zMeta - zoom) < 0.001 && Math.abs(cxMeta - cx) < 0.05 && Math.abs(cyMeta - cy) < 0.05) { zoom = zMeta; cx = cxMeta; cy = cyMeta; }
    aplicar();
    const vivos = !quieto.matches && pasoResortes(dt);
    // de vez en cuando, algo se mueve solo (un costal que aún se mece)
    reposo += dt;
    if (!quieto.matches && reposo > 7 && !arrastre && svg) {
      reposo = 0;
      const piezas = [...svg.querySelectorAll(".pz")].filter((p) => p.querySelector("[data-swing],[data-wobble]") || p.matches("[data-swing]"));
      if (piezas.length) golpear(piezas[Math.floor(Math.random() * piezas.length)], 0.35);
    }
    const quieta = zoom === zMeta && cx === cxMeta && cy === cyMeta && !vivos;
    frame = visible && (!quieta || !quieto.matches) ? requestAnimationFrame(tick) : 0;
  }
  function correr() { if (!frame && visible) { ultimo = 0; frame = requestAnimationFrame(tick); } else if (!visible) aplicar(); }
  new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) correr(); }, { rootMargin: "80px 0px" }).observe(escenario);

  // ---------- puntero: arrastrar, pellizcar, tocar ----------
  const punteros = new Map();
  let arrastre = null, movido = 0;
  escenario.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    punteros.set(e.pointerId, [e.clientX, e.clientY]);
    escenario.setPointerCapture(e.pointerId);
    movido = 0;
    if (punteros.size === 1) arrastre = { x: e.clientX, y: e.clientY, cx: cxMeta, cy: cyMeta };
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      arrastre = { pellizco: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zMeta, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
    }
  });
  escenario.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) {
      if (e.pointerType === "mouse") marcar(e.target.closest(".pz"), false);
      return;
    }
    punteros.set(e.pointerId, [e.clientX, e.clientY]);
    if (!arrastre) return;
    if (punteros.size >= 2 && arrastre.pellizco) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const objetivo = arrastre.z * d / arrastre.pellizco;
      zoomEn(objetivo / zMeta, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      movido += 10;
      return;
    }
    if (zMeta <= 1.01 && e.pointerType === "touch") return; // sin zoom, el dedo hace scroll de la página
    const r = escenario.getBoundingClientRect();
    const k = W / zMeta / r.width;
    movido += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    cxMeta = arrastre.cx - (e.clientX - arrastre.x) * k;
    cyMeta = arrastre.cy - (e.clientY - arrastre.y) * k;
    limitar();
    escenario.classList.add("md-arrastrando");
    correr();
  });
  const soltar = (e) => {
    const eraToque = punteros.size === 1 && movido < 6;
    punteros.delete(e.pointerId);
    if (punteros.size === 0) arrastre = null;
    else if (punteros.size === 1) { const [p] = [...punteros.values()]; arrastre = { x: p[0], y: p[1], cx: cxMeta, cy: cyMeta }; }
    escenario.classList.remove("md-arrastrando");
    if (eraToque && e.type === "pointerup") {
      const pieza = document.elementFromPoint(e.clientX, e.clientY)?.closest(".pz");
      marcar(pieza, true);
      if (pieza) golpear(pieza);
    }
  };
  escenario.addEventListener("pointerup", soltar);
  escenario.addEventListener("pointercancel", soltar);
  escenario.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !seleccionFija) marcar(null, false); });
  escenario.addEventListener("dblclick", (e) => zoomEn(1.8, e.clientX, e.clientY));
  escenario.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey && zMeta <= 1.01) return; // sin Ctrl la rueda hace scroll normal
    e.preventDefault();
    zoomEn(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)), e.clientX, e.clientY);
  }, { passive: false });

  let seleccionFija = false;
  function marcar(pieza, fija) {
    if (!fija && seleccionFija) return;
    seleccionFija = fija && !!pieza;
    if (seleccion === pieza) { decir(); return; }
    seleccion?.classList.remove("md-sel");
    seleccion = pieza || null;
    seleccion?.classList.add("md-sel");
    decir();
  }

  // ---------- botones y teclado ----------
  raiz.querySelector(".md-herramientas").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const a = b.dataset.accion;
    if (a === "acercar") zoomEn(1.5);
    if (a === "alejar") zoomEn(1 / 1.5);
    if (a === "centrar") { zMeta = 1; limitar(); decir(); correr(); }
    if (a === "girar-der") girar(1);
    if (a === "girar-izq") girar(-1);
  });
  function girar(paso) {
    card.classList.add("md-girando");
    setTimeout(() => { ponerVista(vista + paso); card.classList.remove("md-girando"); }, quieto.matches ? 0 : 140);
  }
  escenario.addEventListener("keydown", (e) => {
    const paso = 40 / zMeta;
    const mapa = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    if (mapa[e.key] && zMeta > 1.01) { cxMeta += mapa[e.key][0]; cyMeta += mapa[e.key][1]; limitar(); correr(); e.preventDefault(); return; }
    if (e.key === "+" || e.key === "=") { zoomEn(1.4); e.preventDefault(); }
    else if (e.key === "-" || e.key === "_") { zoomEn(1 / 1.4); e.preventDefault(); }
    else if (e.key === "0") { zMeta = 1; limitar(); decir(); correr(); }
    else if (e.key === "r" || e.key === "R") girar(e.shiftKey ? -1 : 1);
  });
  addEventListener("resize", () => aplicar());

  ponerVista(0);
})();
