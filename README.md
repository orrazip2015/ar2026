# App Web AR - Mall Plaza La Serena

Esta app usa JavaScript en navegador para:

- Mostrar la camara trasera del celular.
- Leer geolocalizacion del usuario.
- Leer orientacion (brujula) del celular.
- Mostrar el mensaje **"aqui esta el mall"** cuando el celular esta apuntando hacia las coordenadas del Mall Plaza La Serena.

## Coordenadas usadas

- Mall Plaza La Serena:
  - Latitud: `-29.9127825`
  - Longitud: `-71.2582358`

## Archivos

- `index.html`
- `styles.css`
- `app.js`
- `ar3d.html`
- `ar3d.css`
- `ar3d.js`

## Como ejecutar

1. Sirve la carpeta con un servidor web.
2. Abre la URL desde tu celular.
3. Acepta permisos de camara, ubicacion y brujula.
4. Presiona el boton **Activar sensores**.
5. Apunta el telefono hacia el mall.

## Version AR 3D (A-Frame + AR.js)

1. Abre `ar3d.html` desde el celular.
2. Presiona **Iniciar AR 3D**.
3. Acepta permisos cuando el navegador los pida.
4. Apunta hacia el mall y busca el rotulo flotante con el texto **"aqui esta el mall"**.

## Importante (camara y geolocalizacion)

- La mayoria de los navegadores solo permiten camara y ubicacion en contexto seguro (`https`) o `localhost`.
- Si abres el proyecto desde otro dispositivo en la red local, usa HTTPS (por ejemplo, tunel con URL `https`) para evitar bloqueos de permisos.

## Ajustes utiles

En `app.js` puedes cambiar:

- `ALIGNMENT_THRESHOLD_DEG` para hacerlo mas estricto o permisivo.
- Las coordenadas del objetivo en `TARGET`.
