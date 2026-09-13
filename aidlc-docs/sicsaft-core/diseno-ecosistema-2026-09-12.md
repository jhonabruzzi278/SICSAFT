# SICSAFT · Control sereno

Fecha: 2026-09-12. Origen: solicitud de rediseño APK, CORE, CCP y CIP. Estado: implementación y validación visual.

## Requisitos y usuarios

El controlador recorre áreas con un teléfono: debe escanear y distinguir hallazgos sin perder contexto. El profesional trabaja con inventarios, etiquetas e ingesta en escritorio. El directivo consulta la inteligencia CIP desde su portal. La PC madre conecta estos puestos. Se preservan contratos de datos, permisos, autenticación, ingesta y reglas BPI.

## Dirección

Dominio: custodia, trazabilidad, etiquetas, ubicación, conciliación, patrimonio. Color: azul de señalización, tinta marina, blanco de etiqueta, gris de acero, verde de verificación y ámbar de incidencia. Firma: marca geométrica con esquinas de lectura y contexto patrimonial persistente. Evitar mosaicos decorativos, sombras luminosas y navegación que desaparece en pantallas pequeñas. Sustituirlos por superficies tranquilas, foco en datos y navegación adaptable.

Intención común: control y confianza. Jerarquía: título de tarea y datos antes que decoración. Profundidad por superficies de la paleta BRAND.md, bordes suaves, sombra solo en superficies flotantes. Tipografía Manrope local, pesos 400/500/600/700, cifras tabulares, títulos compactos. Ritmo de 4 px, controles de 44 px, paneles de 24 px, separación entre secciones de 32 px. En móvil, acción de escaneo central y navegación estable sin sobresalir del contenedor.

## Uso de las guías

Apple Design e Interface Design guían jerarquía, materiales y respuesta. Frontend UI Engineering guía semántica, foco, adaptación y estados. Landing Page Design aporta una acción principal y texto específico en el acceso, no una landing comercial dentro del inventario. Su paleta genérica no reemplaza BRAND.md. Canvas Design produce una lámina de dirección separada. Three.js Animation se evalúa y descarta de tablas y escaneo: no existe contenido tridimensional. GSAP Frameworks está orientada a frameworks distintos de React; no se agrega una dependencia que estas interfaces no requieren.

UI Skills es un catálogo de guías especializadas, no un kit de componentes que haya que instalar entero: https://www.ui-skills.com/skills. Se prioriza accesibilidad, sistema visual y rendimiento sobre efectos.

## Auditoría de oportunidades de animación

| Ubicación | Actual | Propósito | Frecuencia | Receta |
| --- | --- | --- | --- | --- |
| ccp/src/components/ui.tsx Button | Cambio de color | Feedback | Decenas/día | Presión scale(.98), 120 ms cubic-bezier(.23,1,.32,1); sin transformación con movimiento reducido |
| app-qr-sicsaft/src/components/mobile/BottomNav.tsx | FAB sobresaliente | Indicación de estado | Decenas/día | Color de selección 120 ms; sin desplazamiento de navegación |

Rechazados: gráficos CIP por lectura de información; listas de escaneos por frecuencia; introducción 3D por coste de batería y ausencia de función; entrada animada de cada ruta por navegación repetida. No se añaden arrastres ni gestos sin un caso real. El informe es de solo lectura; las decisiones de interfaz se implementan bajo Apple Design e Interface Design.

## Pruebas

Compilar PWA, CCP, portal directivo y ambos launchers. Probar reglas de informes existentes. Inspeccionar pantallas a 320, 768, 1024 y 1440 px, foco, contraste, errores de consola y desbordes. Comprobar servicios existentes antes de levantar nuevos para evitar procesos duplicados. Las capturas con fixtures se identifican como tales; no escribir datos de prueba en BPI.

## Filosofía visual · Control sereno

El espacio conserva el silencio entre registros. Las formas se alinean como objetos custodiados: cada distancia tiene una razón y cada límite protege una relación. La composición se construye con atención meticulosa, sin elementos que compitan con la evidencia.

El azul concentra la energía y las superficies marinas la contienen. Un verde breve confirma; el ámbar interrumpe solo cuando corresponde. El oficio reside en calibrar estas intensidades, no en multiplicarlas.

La escala alterna una señal dominante con marcas pequeñas de referencia. La repetición sugiere inventario, mientras una excepción revela el trabajo humano de observar. La ejecución precisa permite que la estructura se entienda antes de leerse.

La tipografía ocupa el lugar justo, con aire y peso cuidadosamente equilibrados. La lámina deja ver el trabajo de refinamiento en sus alineaciones y en sus vacíos, como un mapa de custodia que permanece estable mientras cambia lo que contiene.
