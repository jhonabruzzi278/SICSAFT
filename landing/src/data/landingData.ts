export interface NavLink {
  label: string;
  href: string;
}

export interface Pillar {
  icon: string;
  label: string;
}

export interface PainPoint {
  icon: string;
  label: string;
}

export interface FeaturePill {
  icon: string;
  title: string;
  desc: string;
}

export interface StatItem {
  target: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

export interface LevelItem {
  badge: string;
  title: string;
  subtitle: string;
  highlight?: boolean;
  features: string[];
  tag: string;
}

export interface BentoCard {
  icon: string;
  title: string;
  desc: string;
}

export interface BenefitItem {
  icon: string;
  title: string;
  desc: string;
}

export interface PlatformItem {
  icon: string;
  title: string;
  desc: string;
}

export const landingData = {
  brand: {
    name: "SICSAFT",
    tagline: "Gestión Patrimonial Inteligente",
    email: "contacto@sicsaft.com",
  },
  navLinks: [
    { label: "El desafío", href: "#desafio" },
    { label: "La solución", href: "#solucion" },
    { label: "Niveles", href: "#niveles" },
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Beneficios", href: "#beneficios" },
  ] as NavLink[],
  pillars: [
    { icon: "sliders", label: "Control" },
    { icon: "zap", label: "Eficiencia" },
    { icon: "eye", label: "Visibilidad" },
    { icon: "route", label: "Trazabilidad" },
    { icon: "handshake", label: "Confianza" },
  ] as Pillar[],
  challenge: {
    eyebrow: "El desafío que enfrentan hoy las organizaciones",
    lines: [
      { text: "Todas las organizaciones ", bold: "poseen patrimonio." },
      { text: "Pocas lo ", bold: "conocen realmente.", isAccent: true },
      { text: "Sin información confiable, es imposible ", bold: "decidir", extra: " y ", bold2: "gestionarlo estratégicamente." },
    ],
    pains: [
      { icon: "file-spreadsheet", label: "Inventarios manuales" },
      { icon: "sparkles", label: "Información dispersa" },
      { icon: "barcode", label: "Activos sin trazabilidad" },
      { icon: "help-circle", label: "Decisiones con incertidumbre" },
    ] as PainPoint[],
  },
  solution: {
    eyebrow: "La respuesta a un nuevo desafío",
    title: "No es solo un sistema.",
    accentTitle: "Es una nueva forma de gestionar su patrimonio.",
    lead: "Integra tecnología, procesos y gestión en un modelo escalable, flexible y preparado para el futuro.",
    features: [
      {
        icon: "qr-code",
        title: "QR + WEB + RFID",
        desc: "Identificación inteligente y flexible.",
      },
      {
        icon: "cloud",
        title: "Información centralizada",
        desc: "En tiempo real, siempre disponible.",
      },
      {
        icon: "lock",
        title: "Seguridad y confianza",
        desc: "Datos protegidos, trazables e íntegros.",
      },
      {
        icon: "trending-up",
        title: "Escalable y modular",
        desc: "Desde hoy, para crecer mañana.",
      },
    ] as FeaturePill[],
    stats: [
      { target: 50000, prefix: "", suffix: "", label: "Activos gestionados" },
      { target: 98, prefix: "", suffix: "%", label: "Precisión en inventarios" },
      { target: 75, prefix: "", suffix: "%", label: "Menos tiempo en levantamientos" },
      { target: 100, prefix: "", suffix: "%", label: "Trazabilidad de activos" },
    ] as StatItem[],
    closing: {
      text: "SICSAFT transforma la información en ",
      bold: "control",
      middle: ", y el control en ",
      accent: "valor para su organización.",
    },
  },
  levels: {
    eyebrow: "Tres niveles, una misma visión",
    title: "Controlar hoy, gestionar estratégicamente mañana",
    items: [
      {
        badge: "Nivel 1",
        title: "QR",
        subtitle: "Comience hoy",
        features: [
          "Identificación única con código QR",
          "Registro rápido y fácil desde su móvil",
          "Información inmediata y accesible",
        ],
        tag: "Rápido · Simple · Efectivo",
      },
      {
        badge: "Nivel 2",
        title: "QR + Plataforma Web",
        subtitle: "Centralice toda la información",
        highlight: true,
        features: [
          "Centralización de datos en tiempo real",
          "Reportes, estadísticas y tableros de control",
          "Acceso seguro desde cualquier lugar",
        ],
        tag: "Centralice · Visualice · Decida",
      },
      {
        badge: "Nivel 3",
        title: "QR + WEB + RFID",
        subtitle: "Gestión inteligente",
        features: [
          "Identificación masiva y sin contacto",
          "Inventarios en minutos, mayor precisión",
          "Trazabilidad automática y en tiempo real",
        ],
        tag: "Inteligente · Preciso · Automático",
      },
    ] as LevelItem[],
    closing: {
      text: "Elija el nivel que su organización necesita hoy. ",
      accent: "SICSAFT crece con usted.",
    },
    sectors: [
      { icon: "briefcase", label: "Empresas" },
      { icon: "building-2", label: "Entidades públicas" },
      { icon: "graduation-cap", label: "Educación" },
      { icon: "heart-pulse", label: "Salud" },
      { icon: "factory", label: "Industria" },
    ],
  },
  features: {
    eyebrow: "Funcionalidades clave",
    title: "Funcionalidades que generan control, eficiencia y valor",
    cards: [
      {
        icon: "qr-code",
        title: "Identificación inteligente",
        desc: "Registro único con código QR y/o RFID para cada activo.",
      },
      {
        icon: "barcode",
        title: "Inventarios ágiles y precisos",
        desc: "Levantamientos rápidos desde dispositivos móviles con alta precisión.",
      },
      {
        icon: "monitor",
        title: "Información en tiempo real",
        desc: "Datos actualizados al instante para decisiones oportunas y acertadas.",
      },
      {
        icon: "route",
        title: "Ubicación y trazabilidad total",
        desc: "Conozca dónde están sus activos en todo momento.",
      },
      {
        icon: "shield-check",
        title: "Control y seguridad avanzada",
        desc: "Reglas, permisos y alertas para proteger su patrimonio y prevenir riesgos.",
      },
      {
        icon: "bar-chart-3",
        title: "Reportes y analítica inteligente",
        desc: "Indicadores y tableros que transforman datos en información estratégica.",
      },
      {
        icon: "wrench",
        title: "Gestión de mantenimientos",
        desc: "Planifique, ejecute y controle mantenimientos preventivos y correctivos.",
      },
      {
        icon: "bell",
        title: "Alertas y notificaciones",
        desc: "Reciba avisos automáticos ante vencimientos, traslados, incidencias y más.",
      },
      {
        icon: "puzzle",
        title: "Integración y escalabilidad",
        desc: "Se integra con sus sistemas actuales y crece junto con su organización.",
      },
    ] as BentoCard[],
    tags: [
      { icon: "shield-check", label: "Mayor control" },
      { icon: "gauge", label: "Más eficiencia" },
      { icon: "coins", label: "Menos costos" },
      { icon: "trending-up", label: "Mayor valor" },
    ],
  },
  benefits: {
    eyebrow: "Beneficios que se traducen en resultados",
    title: "SICSAFT transforma la gestión del patrimonio en control, eficiencia y valor",
    center: {
      sub: "Un patrimonio",
      main: "bajo control",
    },
    items: [
      {
        icon: "search",
        title: "Visibilidad total",
        desc: "Conozca el estado real de cada activo, en todo momento y desde cualquier lugar.",
      },
      {
        icon: "shield-check",
        title: "Seguridad y cumplimiento",
        desc: "Proteja su patrimonio y cumpla con normativas y políticas internas.",
      },
      {
        icon: "target",
        title: "Decisiones inteligentes",
        desc: "Datos precisos y análisis en tiempo real para planificar y priorizar recursos.",
      },
      {
        icon: "coins",
        title: "Reducción de costos",
        desc: "Menos pérdidas, mejor uso de los activos y mantenimiento oportuno.",
      },
      {
        icon: "gauge",
        title: "Eficiencia operacional",
        desc: "Automatice procesos, reduzca tareas manuales y elimine reprocesos.",
      },
      {
        icon: "rocket",
        title: "Escalable y preparado para el futuro",
        desc: "Crece con su organización e integra nuevas tecnologías.",
      },
    ] as BenefitItem[],
    closing: {
      text: "Un patrimonio bien gestionado no es un gasto: es una ventaja competitiva. ",
      accent: "SICSAFT le ayuda a convertirlo en resultados.",
    },
  },
  platform: {
    eyebrow: "Una plataforma diseñada para su realidad",
    title: "Flexible, intuitiva y potente",
    lead: "SICSAFT se adapta a su organización, sin importar su tamaño o sector.",
    sectorsColTitle: "Adaptado a su organización",
    sectors: [
      {
        icon: "building-2",
        title: "Entidades públicas",
        desc: "Gobiernos, alcaldías, ministerios, hospitales, universidades y más.",
      },
      {
        icon: "briefcase",
        title: "Empresas",
        desc: "Gestione sus activos de forma eficiente y alineada a sus procesos.",
      },
      {
        icon: "graduation-cap",
        title: "Educación",
        desc: "Colegios, universidades e institutos con control total de sus activos.",
      },
      {
        icon: "heart-pulse",
        title: "Salud",
        desc: "Hospitales, clínicas y centros de salud con trazabilidad y seguridad.",
      },
      {
        icon: "factory",
        title: "Industria",
        desc: "Control robusto para activos críticos y operación en campo.",
      },
    ] as PlatformItem[],
    channelsColTitle: "Acceso desde cualquier lugar",
    channels: [
      {
        icon: "cloud",
        title: "100% Web",
        desc: "Acceda desde cualquier dispositivo con conexión a internet.",
      },
      {
        icon: "smartphone",
        title: "Móvil y offline",
        desc: "Registre y consulte información en campo, incluso sin conexión.",
      },
      {
        icon: "lock",
        title: "Seguro y confiable",
        desc: "Infraestructura en la nube con altos estándares de seguridad.",
      },
      {
        icon: "users",
        title: "Multiusuario y multirol",
        desc: "Defina permisos y roles según las necesidades de su organización.",
      },
    ] as PlatformItem[],
    tags: [
      { icon: "target", label: "Experiencia intuitiva" },
      { icon: "rocket", label: "Más rápido" },
      { icon: "check-circle-2", label: "Más simple" },
      { icon: "trending-up", label: "Más productivo" },
    ],
  },
  contact: {
    eyebrow: "Dé el siguiente paso",
    title: "Un patrimonio bien gestionado es una ventaja competitiva.",
    lead: "Solicite una demo personalizada y descubra el nivel de SICSAFT ideal para su organización.",
    cta: "Solicitar una demo",
  },
};
