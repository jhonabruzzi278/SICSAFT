# User Stories

**US-01:** Como encargado de inventario, quiero abrir la app en mi teléfono Android y presionar "Escanear Código QR" para empezar a verificar productos rápidamente.

**US-02:** Como encargado de inventario, quiero que la cámara detecte el código QR automáticamente sin tener que tomar una foto manual, para agilizar el conteo.

**US-03:** Como encargado de inventario, quiero ver de inmediato si el producto escaneado está registrado o no, para poder actuar en el momento (ej. separar productos no catalogados).

**US-04:** Como encargado de inventario, quiero seguir escaneando múltiples productos sin que la app se bloquee o duplique un mismo código, hasta terminar mi conteo.

**US-05:** Como encargado de inventario, quiero finalizar el escaneo y ver un reporte con totales y la lista de productos no encontrados (con nombre, no sólo código), para reportar discrepancias.

**US-06 (soporte de pruebas, no explícita en el brief):** Como desarrollador/QA, quiero una pantalla que muestre los 20 códigos QR de prueba (imprimibles), para poder validar el flujo de escaneo sin productos físicos reales.

---

**Fase 3.1** (ver [`DOC-017`](../design-artifacts/DOC-017-fase-3.1-brechas-flujo.md)):

**US-07:** Como controlador de AFT, quiero elegir entre Modo QR / QR+WEB / QR+WEB+RFID antes de
empezar el control, para saber qué otros sistemas tengo disponibles para esta organización.

**US-08:** Como controlador de AFT, quiero ver un veredicto claro (exitoso/aceptable/defectuoso)
del control que acabo de hacer, para no tener que calcularlo yo mismo a partir de los contadores.

**US-09:** Como controlador de AFT, quiero poder declarar "en servicio" o dar de baja un activo
directamente desde el resumen del control, sin tener que entrar aparte al portal WEB.

**US-10:** Como controlador de AFT, quiero ver agrupados los activos que aparecieron pero
pertenecen a otra área, con el nombre de esa área, para poder devolverlos o reportarlos sin tener
que revisar escaneo por escaneo.
