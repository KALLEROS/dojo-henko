// ============================================================
//  CONFIGURACIÓN DE DOJO HENKO
//  1) hoja: enlaces CSV de cada pestaña de la Hoja de Google
//     (Archivo > Compartir > Publicar en la web > pestaña > CSV).
//     Si se dejan vacíos, la página usa datos-respaldo.js.
//  2) direccion_publica: la dirección final de la página.
//     El cartel con QR (cartel-qr.html) la usa.
// ============================================================
window.DOJO_CONFIG = {
  hoja: {
    general: "",
    horarios: "",
    avisos: "",
    fotos: "",
    equipo: ""
  },
  direccion_publica: "https://kalleros.github.io/dojo-henko/"
};
