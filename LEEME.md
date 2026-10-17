# CENTROSISTEMAS – Control del Taller (versión 1.0 · publicación 75)

Aplicación desarrollada por Oscar Pinto.

Este es el mismo programa que está publicado en Claude, pero separado en carpetas para poder leerlo en Visual Studio Code. No se cambió ninguna instrucción: solo se ordenó en líneas y se dividió en archivos.

## Carpetas

- `index.html`: las pantallas de la app (formularios, paneles, botones).
- `css/estilos.css`: los colores y el diseño.
- `css/solo-para-ver-en-pc.css`: una sola regla, solo por si abre `index.html` en el computador.
- `js/`: el programa. Se carga en orden numérico (01, 02, 03…). No cambie el orden.
- `logo.webp`, `logo-icono.webp`, `logo-recibo.png`: los logos.

## Qué hay en cada archivo de `js/`

| Archivo | Contenido |
|---|---|
| 01-base | Estados, permisos por defecto y funciones de ayuda |
| 02-almacenamiento | Conexión a la base de datos |
| 03-pantalla-principal | Dashboard (lista de equipos) |
| 04-formulario | Formulario de recibir equipo |
| 05-recibir-con-foto-sticker | Leer el sticker con una foto |
| 06-asistente-paso-a-paso | Asistente en burbuja |
| 07-recibir-por-voz | Recibir por dictado |
| 08-patron-desbloqueo | Patrón de desbloqueo |
| 09-fotos-del-equipo | Fotos de cómo llega el equipo |
| 10-administracion-y-configuracion | Administración, impresora y mensajes de WhatsApp |
| 11-inventario | Inventario de repuestos y productos |
| 12-cargar-con-foto-y-voz | Cargar inventario con foto y voz |
| 13-carga-desde-excel | Cargar inventario desde Excel |
| 14-recibo-impresora-termica | Recibos |
| 15-reportar-reparacion | Reportar reparación |
| 16-caja-diaria | Caja diaria (resumen y utilidad) |
| 17-entregar-equipo | Entregar equipo |
| 18-salidas-de-dinero | Gastos y salidas |
| 19-apertura-y-cierre-de-caja | Abrir, cerrar y reabrir caja |
| 20-ventas-de-mostrador | Vender |
| 21-encargos-y-clientes | Encargos y base de clientes |
| 22-caja-corregir-ventas | Corregir o eliminar ventas (administrador) |
| 23-deshacer | Botón Deshacer |
| 24-log-de-actividad | Log (quién hizo qué y cuándo) |
| 25-inicio-de-sesion | Ingreso, sesión y arranque |

## Importante

- La app guarda sus datos y usuarios dentro de Claude. Si abre `index.html` suelto en el computador, se verá la pantalla pero no habrá base de datos ni usuarios. Este proyecto es para leer el código.
- La app que usted usa sigue siendo la publicada en Claude. Cambiar estos archivos no cambia esa app.
- Necesita internet para cargar las librerías de PDF y Excel (jsPDF y SheetJS) y las letras de Google Fonts.
