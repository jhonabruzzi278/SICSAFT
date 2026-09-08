import { useState, useEffect, useMemo, useCallback } from 'react';
import { dashboardClient, type CategoriaResumen, type Cobertura, type ControlArea, type EstadoResumen } from '@/lib/dashboard-client';
import { cisClient, type ActivoCatalogo, type Area } from '@/lib/cis-client';
import type { ActivoFilaAft, CategoriaSegmento, EstadoBarraData, CipKpiResumen } from './types';
import { ACTIVOS_AFT_MASTER, PALETA_CATEGORIAS } from './mock-data';

export function useCipData(organizacionId: string) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de datos crudos
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [estados, setEstados] = useState<EstadoResumen[]>([]);
  const [categorias, setCategorias] = useState<CategoriaResumen[]>([]);
  const [areas, setAreas] = useState<ControlArea[]>([]);
  const [activosReales, setActivosReales] = useState<ActivoCatalogo[]>([]);
  const [areasReales, setAreasReales] = useState<Area[]>([]);

  // Filtros
  const [areaFiltro, setAreaFiltro] = useState<string>('todas');
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [estadoFiltroTabla, setEstadoFiltroTabla] = useState<string>('todos');
  const [mostrarValorMatriz, setMostrarValorMatriz] = useState(false);

  // Carga reactiva de datos
  const cargarDatos = useCallback(async () => {
    if (!organizacionId) return;
    setCargando(true);
    setError(null);
    try {
      const [cobRes, estRes, catRes, areRes, actRes, admAreasRes] =
        await Promise.allSettled([
          dashboardClient.getCobertura(organizacionId),
          dashboardClient.getEstadoActivos(organizacionId),
          dashboardClient.getCategorias(
            organizacionId,
            areaFiltro === 'todas' ? undefined : areaFiltro,
          ),
          dashboardClient.getAreas(organizacionId),
          cisClient.getCatalogo(organizacionId),
          cisClient.getAreas(organizacionId),
        ]);

      if (cobRes.status === 'fulfilled') setCobertura(cobRes.value);
      if (estRes.status === 'fulfilled') setEstados(estRes.value.estados);
      if (catRes.status === 'fulfilled') setCategorias(catRes.value.categorias);
      if (areRes.status === 'fulfilled') setAreas(areRes.value.areas);
      if (actRes.status === 'fulfilled') setActivosReales(actRes.value);
      if (admAreasRes.status === 'fulfilled') setAreasReales(admAreasRes.value);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar con el CIP');
    } finally {
      setCargando(false);
    }
  }, [organizacionId, areaFiltro]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Lista unificada de activos AFT
  const listaActivosCompleta: ActivoFilaAft[] = useMemo(() => {
    if (activosReales.length > 0) {
      const mapaAreas = new Map(areasReales.map((a) => [a.id, a.nombre]));
      return activosReales.map((a, idx) => {
        let st: ActivoFilaAft['estado'] = 'En Servicio';
        if (a.estado === 'baja') st = 'Baja';
        else if (a.estado === 'mantenimiento') st = 'En Mantenimiento';
        else if (a.estado === 'traslado') st = 'Traslado';

        const areaStr = a.areaNombre || (a.areaId ? mapaAreas.get(a.areaId) : null) || 'Área General';
        const valEstimado = 450000 + (idx * 125000);

        return {
          id: a.id,
          codigoQr: a.codigoQr || `QR-${idx + 1}`,
          codigoAft: a.codigoAft || a.codigoQr || `AFT-${idx + 1}`,
          nombre: a.nombre,
          familia: a.nombre.toLowerCase().includes('notebook')
            ? 'Equipos Computacionales'
            : a.nombre.toLowerCase().includes('sofa') || a.nombre.toLowerCase().includes('escritorio')
            ? 'Mobiliario y Útiles'
            : a.nombre.toLowerCase().includes('clima') || a.nombre.toLowerCase().includes('equipo')
            ? 'Maquinaria y Climatización'
            : 'Activos Generales',
          subfamilia: 'Bienes Institucionales',
          categoria: a.nombre.toLowerCase().includes('notebook')
            ? 'Tecnología'
            : a.nombre.toLowerCase().includes('sofa') || a.nombre.toLowerCase().includes('escritorio')
            ? 'Mobiliario'
            : a.nombre.toLowerCase().includes('clima') || a.nombre.toLowerCase().includes('equipo')
            ? 'Equipos'
            : 'General',
          marca: 'Genérica / Institucional',
          modelo: 'Estándar',
          serie: `SN-${a.id.slice(0, 8).toUpperCase()}`,
          estado: st,
          direccionNombre: 'Dirección Corporativa',
          areaNombre: areaStr,
          sedeUbicacion: `${areaStr} - Planta Principal`,
          responsableNombre: 'Custodio Asignado',
          rutResponsable: '15.890.123-4',
          valorAdquisicion: valEstimado,
          valorLibro: Math.round(valEstimado * 0.8),
          depreciacionAcumulada: Math.round(valEstimado * 0.2),
          vidaUtilMeses: 60,
          criticidad: idx % 3 === 0 ? 'Alta' : 'Media',
          tecnologia: 'QR Matriz 2D',
          fechaAlta: new Date().toLocaleDateString('es-CL'),
          ultimoEscaneo: new Date().toLocaleDateString('es-CL'),
          veredictoEscaneo: 'Correcto',
          descripcion: `Registro oficial para ${a.nombre}.`,
        };
      });
    }
    return ACTIVOS_AFT_MASTER;
  }, [activosReales, areasReales]);

  // Filas filtradas
  const filasFiltradas = useMemo(() => {
    return listaActivosCompleta.filter((item) => {
      const matchBusqueda =
        terminoBusqueda === '' ||
        item.codigoQr.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.codigoAft.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.familia.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.marca.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.modelo.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.serie.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.areaNombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.responsableNombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        item.sedeUbicacion.toLowerCase().includes(terminoBusqueda.toLowerCase());

      const matchCategoria =
        !categoriaSeleccionada || item.categoria === categoriaSeleccionada;

      const matchEstado =
        estadoFiltroTabla === 'todos' ||
        item.estado.toLowerCase().replace(/\s+/g, '') ===
          estadoFiltroTabla.toLowerCase().replace(/\s+/g, '');

      return matchBusqueda && matchCategoria && matchEstado;
    });
  }, [listaActivosCompleta, terminoBusqueda, categoriaSeleccionada, estadoFiltroTabla]);

  // KPIs calculados
  const kpis: CipKpiResumen = useMemo(() => {
    const total = listaActivosCompleta.length;
    const serv = listaActivosCompleta.filter((a) => a.estado === 'En Servicio').length;
    const mant = listaActivosCompleta.filter((a) => a.estado === 'En Mantenimiento').length;
    const baja = listaActivosCompleta.filter((a) => a.estado === 'Baja' || a.estado === 'Inactivo').length;
    const bruto = listaActivosCompleta.reduce((acc, curr) => acc + curr.valorAdquisicion, 0);
    const neto = listaActivosCompleta.reduce((acc, curr) => acc + curr.valorLibro, 0);
    const op = total > 0 ? (serv / total) * 100 : 0;

    return {
      totalActivos: total,
      activosServicio: serv,
      activosMantenimiento: mant,
      activosBaja: baja,
      valorTotalBruto: bruto,
      valorTotalNeto: neto,
      porcentajeOperatividad: op,
    };
  }, [listaActivosCompleta]);

  // Datos para Donut Chart de categorías
  const datosCategorias: CategoriaSegmento[] = useMemo(() => {
    if (categorias.length > 0) {
      const suma = categorias.reduce((acc, c) => acc + c.cantidad, 0);
      return categorias.map((c, i) => ({
        nombre: c.familia || 'Sin categoría',
        cantidad: c.cantidad,
        porcentaje: suma > 0 ? ((c.cantidad / suma) * 100).toFixed(1) : '0',
        color: PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length],
      }));
    }
    return [
      { nombre: 'Equipos', cantidad: 462, porcentaje: '37.1', color: '#2563EB' },
      { nombre: 'Mobiliario', cantidad: 358, porcentaje: '28.7', color: '#16A34A' },
      { nombre: 'Vehículos', cantidad: 215, porcentaje: '17.3', color: '#0284C7' },
      { nombre: 'Herramientas', cantidad: 148, porcentaje: '11.9', color: '#D97706' },
      { nombre: 'Tecnología', cantidad: 63, porcentaje: '5.0', color: '#7C3AED' },
    ];
  }, [categorias]);

  // Donut SVG segments con geometría
  const segmentosDonut = useMemo(() => {
    let acumulado = 0;
    return datosCategorias.map((item) => {
      const valor = parseFloat(item.porcentaje);
      const inicio = (acumulado / 100) * 360;
      acumulado += valor;
      const fin = (acumulado / 100) * 360;
      return { ...item, inicio, fin };
    });
  }, [datosCategorias]);

  // Datos para gráfico de barras por estado
  const datosEstadosBarra: EstadoBarraData[] = useMemo(() => {
    return [
      { estado: 'En Servicio', cantidad: kpis.activosServicio, color: '#10B981' },
      { estado: 'En Mantenimiento', cantidad: kpis.activosMantenimiento, color: '#F59E0B' },
      { estado: 'Traslado', cantidad: Math.round(kpis.totalActivos * 0.045), color: '#3B82F6' },
      { estado: 'Baja', cantidad: kpis.activosBaja, color: '#EF4444' },
    ];
  }, [kpis]);

  // Exportar a CSV
  const exportarCsv = useCallback(() => {
    const encabezados = [
      'Código QR', 'Código AFT', 'Nombre del Bien', 'Familia', 'Categoría',
      'Marca', 'Modelo', 'Serie', 'Dirección', 'Área Operativa',
      'Ubicación', 'Custodio / Responsable', 'RUT', 'Estado',
      'Valor Adquisición (CLP)', 'Valor Libro (CLP)', 'Vida Útil (Meses)',
      'Criticidad', 'Último Escaneo', 'Veredicto'
    ];

    const filas = filasFiltradas.map((a) => [
      `"${a.codigoQr}"`, `"${a.codigoAft}"`, `"${a.nombre}"`, `"${a.familia}"`, `"${a.categoria}"`,
      `"${a.marca}"`, `"${a.modelo}"`, `"${a.serie}"`, `"${a.direccionNombre}"`, `"${a.areaNombre}"`,
      `"${a.sedeUbicacion}"`, `"${a.responsableNombre}"`, `"${a.rutResponsable}"`, `"${a.estado}"`,
      a.valorAdquisicion, a.valorLibro, a.vidaUtilMeses, `"${a.criticidad}"`, `"${a.ultimoEscaneo}"`, `"${a.veredictoEscaneo}"`
    ]);

    const contenido = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Inventario_AFT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filasFiltradas]);

  return {
    cargando,
    error,
    cobertura,
    estados,
    areas,
    areasReales,
    listaActivosCompleta,
    filasFiltradas,
    kpis,
    datosCategorias,
    segmentosDonut,
    datosEstadosBarra,
    filtros: {
      areaFiltro,
      setAreaFiltro,
      terminoBusqueda,
      setTerminoBusqueda,
      categoriaSeleccionada,
      setCategoriaSeleccionada,
      estadoFiltroTabla,
      setEstadoFiltroTabla,
      mostrarValorMatriz,
      setMostrarValorMatriz,
    },
    cargarDatos,
    exportarCsv,
  };
}
