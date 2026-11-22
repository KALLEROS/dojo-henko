# Cómo cambiar la página del Dojo Henko

Todo lo que se ve en la página sale de una **Hoja de Google**. Si cambias la hoja, la página cambia sola en unos **5 minutos**. No hay que programar nada.

## Una sola vez: preparar la hoja

1. Entra a [sheets.google.com](https://sheets.google.com) con la cuenta del dojo.
2. **Archivo → Importar → Subir** y elige `plantilla-hoja.xlsx`. Escoge "Reemplazar hoja de cálculo".
3. **Archivo → Compartir → Publicar en la web.**
   - En lugar de "Todo el documento", elige la pestaña **General** y en formato elige **Valores separados por comas (.csv)**. Presiona **Publicar** y copia el enlace.
   - Repite con **Horarios**, **Avisos**, **Fotos** y **Equipo**. Son 5 enlaces.
4. Manda los 5 enlaces a quien administra la página (se pegan en `config.js`).

> Publicar en la web solo deja **leer** la hoja. Nadie puede editarla con ese enlace.

## Qué hay en cada pestaña

| Pestaña | Para qué | Cómo se usa |
|---|---|---|
| **General** | Nombre, frase de portada, misión, visión, precio, teléfono, Instagram, dirección | Cambia solo la columna **valor**. No cambies la columna **clave**. |
| **Horarios** | Las clases | Una fila por clase. Para quitar una sin borrarla, pon `no` en **visible**. |
| **Avisos** | Exámenes, torneos, días sin clase | Agrega una fila. Fecha así: `15/12/2026`. Cuando ya pasó, pon `no` en **visible**. |
| **Fotos** | La galería | Pega el link de la foto (ver abajo) y una descripción corta. |
| **Equipo** | Sensei e instructores | Una fila por persona. La foto es opcional; sin foto salen sus iniciales. |

## Cómo poner una foto

1. Sube la foto a **Google Drive**.
2. Clic derecho → **Compartir** → en "Acceso general" elige **Cualquier persona con el enlace**.
3. **Copiar enlace** y pégalo en la columna **link** (o **foto** en Equipo).

Fotos de alumnos menores de edad: pide permiso a los papás antes de publicarlas.

## Si algo sale mal

- **No veo el cambio:** espera 5 minutos y recarga la página.
- **La hoja falla o no hay internet:** la página muestra la última información que tenía. Nunca sale en blanco.
- **Borré algo por error:** en la hoja, **Archivo → Historial de versiones** para regresar.
