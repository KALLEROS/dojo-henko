// =========================================================
//  DOJO HENKO · app
//  Orden de carga: datos-respaldo.js → copia guardada en el
//  teléfono → Hoja de Google (si hay enlaces en config.js).
// =========================================================
(() => {
  "use strict";
  const CLAVE_CACHE = "dojo-henko-hoja-v1";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const limpio = (t) => String(t ?? "").trim();
  const esc = (t) => limpio(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sinAcentos = (t) => limpio(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Una fila se oculta si su columna "visible" dice no / ocultar / 0
  const visible = (f) => !/^(no|ocultar|0|false)$/.test(sinAcentos(f.visible));

  // ---------- CSV que entrega Google Sheets ----------
  function parsearCSV(texto) {
    const filas = []; let fila = [], campo = "", comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        fila.push(campo); filas.push(fila); fila = []; campo = "";
      } else campo += c;
    }
    if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
    const vivas = filas.filter(f => f.some(v => limpio(v) !== ""));
    if (!vivas.length) return [];
    const encabezados = vivas[0].map(h => sinAcentos(h).replace(/\s+/g, "_"));
    return vivas.slice(1).map(f => Object.fromEntries(encabezados.map((h, i) => [h, limpio(f[i])])));
  }

  async function traerCSV(url) {
    const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("La hoja respondió " + r.status);
    const texto = await r.text();
    if (/^\s*</.test(texto)) throw new Error("El enlace no es CSV");
    return parsearCSV(texto);
  }

  // ---------- Fechas: acepta 2026-12-05 o 5/12/2026 ----------
  function leerFecha(t) {
    t = limpio(t); if (!t) return null;
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    return null;
  }
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  // Enlace para compartir de Google Drive → imagen que se puede mostrar
  function urlFoto(u) {
    u = limpio(u);
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200` : u;
  }
  const soloDigitos = (t) => limpio(t).replace(/\D/g, "");
  const conLada = (t) => { const d = soloDigitos(t); return d.length === 10 ? "52" + d : d; };

  // ---------- Pintar la página ----------
  function pintar(d) {
    const g = d.general || {};

    $$("[data-campo]").forEach(el => { const v = limpio(g[el.dataset.campo]); if (v) el.textContent = v; });
    if (g.nombre) document.title = `${g.nombre} · ${g.estilo || "Karate"} en Chihuahua`;

    // Misión y visión: si alguna viene vacía, se oculta
    $("#pilar-mision").hidden = !limpio(g.mision);
    $("#pilar-vision").hidden = !limpio(g.vision);
    $("#nosotros").hidden = !limpio(g.mision) && !limpio(g.vision);

    // Contacto
    const tel = soloDigitos(g.telefono);
    const telBonito = tel.length === 10 ? `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}` : tel;
    $$("[data-tel]").forEach(el => el.textContent = telBonito);
    $("#llamar").href = `tel:+${conLada(tel)}`;
    const wa = conLada(g.whatsapp || tel);
    const msj = encodeURIComponent(g.mensaje_whatsapp || "Hola, vi la página del Dojo Henko y quiero información.");
    $$("[data-wa]").forEach(a => { a.href = `https://wa.me/${wa}?text=${msj}`; a.target = "_blank"; a.rel = "noopener"; });
    const ig = limpio(g.instagram).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
    $$("[data-ig]").forEach(a => a.href = `https://instagram.com/${ig}`);
    $("#ig-usuario").textContent = "@" + ig;
    // Facebook: solo aparece cuando hay link en la hoja (facebook_link)
    const fb = limpio(g.facebook_link);
    $("#facebook").closest("li").hidden = !fb;
    if (fb) $("#facebook").href = fb;

    // Mapa
    $("#como-llegar").href = limpio(g.mapa_link) || `https://maps.google.com/?q=${encodeURIComponent(g.mapa_busqueda || g.direccion)}`;
    const src = `https://maps.google.com/maps?q=${encodeURIComponent(g.mapa_busqueda || `${g.direccion}, ${g.ciudad}`)}&z=16&output=embed`;
    if ($("#mapa").getAttribute("src") !== src) $("#mapa").src = src;

    // Equipo
    const equipo = (d.equipo || []).filter(m => limpio(m.nombre) && visible(m));
    $("#equipo").hidden = !equipo.length;
    $("#t-equipo").textContent = equipo.length > 1 ? "Nuestro equipo" : "Tu sensei";
    $("#lista-equipo").classList.toggle("varios", equipo.length > 1);
    $("#lista-equipo").innerHTML = equipo.map(m => {
      const iniciales = limpio(m.nombre).split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
      const foto = limpio(m.foto)
        ? `<img class="miembro-foto" src="${esc(urlFoto(m.foto))}" alt="Foto de ${esc(m.nombre)}" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="miembro-foto vacia" aria-hidden="true">${esc(iniciales)}</span>`;
      return `<article class="miembro">${foto}
        <h3 class="miembro-nombre">${esc(m.nombre)}</h3>
        ${m.grado ? `<p class="cinta">${esc(m.grado)}</p>` : ""}
        ${m.texto ? `<p class="texto">${esc(m.texto)}</p>` : ""}</article>`;
    }).join("");

    // Horarios
    const clases = (d.horarios || []).filter(h => (limpio(h.hora) || limpio(h.edades)) && visible(h));
    const dias = [...new Set(clases.map(h => limpio(h.dia)).filter(Boolean))];
    $("#dias-clase").textContent = dias.length === 1 ? dias[0] : "";
    $("#lista-clases").innerHTML = clases.map(h => `
      <li class="clase" data-hora="${esc(h.hora)}" data-dia="${esc(h.dia)}">
        <p class="clase-hora num">${esc(h.hora)}${dias.length > 1 && h.dia ? `<small>${esc(h.dia)}</small>` : ""}</p>
        <p class="clase-edades">${esc(h.edades)}</p>
        <p class="clase-grupo">${esc(h.grupo)}</p>
      </li>`).join("");
    marcarClaseActual();

    // Avisos (solo los visibles, ordenados por fecha)
    const avisos = (d.avisos || []).filter(a => limpio(a.titulo) && visible(a))
      .sort((a, b) => (leerFecha(a.fecha) || 0) - (leerFecha(b.fecha) || 0));
    $("#avisos").hidden = !avisos.length;
    $("#lista-avisos").innerHTML = avisos.map(a => {
      const f = leerFecha(a.fecha);
      const fecha = f ? `<b class="num">${f.getDate()}</b>${MESES[f.getMonth()]}` : `<b>!</b>aviso`;
      return `<article class="aviso"><p class="aviso-fecha">${fecha}</p><div><h3>${esc(a.titulo)}</h3>${a.texto ? `<p>${esc(a.texto)}</p>` : ""}</div></article>`;
    }).join("");

    // Fotos
    const fotos = (d.fotos || []).filter(f => limpio(f.link) && visible(f));
    $("#galeria").hidden = !fotos.length;
    $("#lista-fotos").innerHTML = fotos.map(f => `
      <figure class="foto"><img src="${esc(urlFoto(f.link))}" alt="${esc(f.descripcion || "Foto del dojo")}" loading="lazy" referrerpolicy="no-referrer">
      ${f.descripcion ? `<figcaption>${esc(f.descripcion)}</figcaption>` : ""}</figure>`).join("");
  }

  // "En clase ahora" según la hora del teléfono (formato "5:00 a 6:00 pm")
  function aMinutos(txt, pm) {
    const m = txt.match(/(\d{1,2})(?::(\d{2}))?/); if (!m) return null;
    let h = +m[1]; if (pm && h < 12) h += 12; return h * 60 + (+m[2] || 0);
  }
  function marcarClaseActual() {
    const ahora = new Date(); const dia = ahora.getDay();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    $$(".clase").forEach(li => {
      const textoDia = sinAcentos(li.dataset.dia);
      const entreSemana = !textoDia || /lunes a viernes|l-v|entre semana/.test(textoDia);
      if (entreSemana && (dia === 0 || dia === 6)) return;
      const t = li.dataset.hora.toLowerCase(); const pm = /pm|p\.m/.test(t);
      const partes = t.split(/\s+(?:a|-|–)\s+/);
      if (partes.length < 2) return;
      const ini = aMinutos(partes[0], pm), fin = aMinutos(partes[1], pm);
      if (ini != null && fin != null && min >= ini && min < fin) {
        li.querySelector(".clase-grupo").insertAdjacentHTML("beforeend", '<span class="en-clase">En clase ahora</span>');
      }
    });
  }

  // ---------- Cargar ----------
  function unir(base, extra) {
    return { ...base, ...extra, general: { ...(base.general || {}), ...(extra.general || {}) } };
  }

  async function cargar() {
    let datos = window.DOJO_RESPALDO || { general: {} };
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_CACHE));
      if (guardado) datos = unir(datos, guardado);
    } catch {}
    pintar(datos);

    const hoja = (window.DOJO_CONFIG && window.DOJO_CONFIG.hoja) || {};
    const pestañas = Object.keys(hoja).filter(k => limpio(hoja[k]));
    if (!pestañas.length) return;

    const nuevos = {};
    await Promise.all(pestañas.map(async k => {
      try {
        const filas = await traerCSV(hoja[k]);
        if (k === "general") {
          const g = {};
          filas.forEach(f => { const c = sinAcentos(f.clave).replace(/\s+/g, "_"); if (c) g[c] = f.valor ?? ""; });
          nuevos.general = g;
        } else nuevos[k] = filas;
      } catch (e) { console.warn(`No se pudo leer la pestaña "${k}":`, e.message); }
    }));
    if (!Object.keys(nuevos).length) return;
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(nuevos)); } catch {}
    pintar(unir(window.DOJO_RESPALDO || {}, nuevos));
  }
  cargar();

  // ---------- App instalable ----------
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  let avisoInstalar;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); avisoInstalar = e; $("#instalar").hidden = false; });
  $("#instalar").addEventListener("click", async () => {
    if (!avisoInstalar) return;
    avisoInstalar.prompt(); await avisoInstalar.userChoice; avisoInstalar = null; $("#instalar").hidden = true;
  });
})();
