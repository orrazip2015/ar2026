# App Web AR Geolocalizada

Esta app usa JavaScript en navegador para:

- Mostrar la camara trasera del celular.
- Leer geolocalizacion del usuario.
- Leer orientacion (brujula) del celular.
- Mostrar un mensaje personalizado cuando el celular esta apuntando hacia las coordenadas objetivo.
- Usar interfaz Bootstrap mobile-first para una mejor experiencia en telefonos.

## Flujo de uso

1. Ingresa latitud y longitud del objetivo.
2. Ingresa el mensaje que quieres ver en pantalla.
3. Presiona **Guardar objetivo**.
4. Activa sensores y apunta el celular hacia ese punto.

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
5. Apunta el telefono hacia el objetivo que ingresaste.

## Ingreso manual de coordenadas (pantalla inicial)

En la vista principal (`index.html`) ahora puedes:

1. Escribir latitud y longitud manualmente.
2. Escribir el mensaje que quieres ver en ese punto.
3. Presionar **Guardar objetivo** para usar ese objetivo.
4. Presionar **Limpiar objetivo** para borrar el objetivo actual.

Las coordenadas y el mensaje quedan persistidos en el navegador (localStorage).

## Version AR 3D (A-Frame + AR.js)

1. Abre `ar3d.html` desde el celular.
2. Presiona **Iniciar AR 3D**.
3. Acepta permisos cuando el navegador los pida.
4. Apunta hacia el objetivo y busca el rotulo flotante con tu mensaje.

En la vista 3D tambien puedes ingresar latitud y longitud manualmente con los mismos botones:

1. Escribir latitud, longitud y mensaje.
2. **Guardar objetivo** para aplicar el nuevo objetivo.
3. **Limpiar objetivo** para borrar el objetivo actual.

La version clasica y la version 3D comparten el mismo almacenamiento local (localStorage).

## Importante (camara y geolocalizacion)

- La mayoria de los navegadores solo permiten camara y ubicacion en contexto seguro (`https`) o `localhost`.
- Si abres el proyecto desde otro dispositivo en la red local, usa HTTPS (por ejemplo, tunel con URL `https`) para evitar bloqueos de permisos.

## Ajustes utiles

En `app.js` puedes cambiar:

- `ALIGNMENT_THRESHOLD_DEG` para hacerlo mas estricto o permisivo.
- La logica de validacion y visualizacion del objetivo.
