import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import MapaFiltroPoligono from "../components/crm/MapaFiltroPoligono";
import { PageHeader, PageShell, useDialog } from "../components/ui";
import { api } from "../services/api";
import CRMClienteFormModal from "../components/crm/CRMClienteFormModal";
import CRMClientesTable from "../components/crm/CRMClientesTable";
import CRMFilters from "../components/crm/CRMFilters";
import CRMToolbar from "../components/crm/CRMToolbar";
import SegmentoFormModal from "../components/segmentos/SegmentoFormModal";
import {
	actualizarCliente,
	crearCliente,
	eliminarClientePorId,
	eliminarClientesMasivo,
	enriquecerCliente,
	exportarClientesCsv,
	limpiarClientesBd,
	obtenerClientes,
	obtenerClientesMapa,
	obtenerIdsPendientes,
	obtenerSectores,
} from "../services/clientesService";
import { importarClientesCsvArchivo } from "../services/clientesImportService";
import { crearSegmento } from "../services/segmentosService";
import type {
	Cliente,
	ClienteFilters,
	ClienteFormSubmitOptions,
	ClienteMapa,
	ClienteUpsertPayload,
	FiltroPresencia,
	PoligonoCoords,
	ServerSortField,
	SortDirection,
	SortField,
} from "../types/crm";
import type { SegmentoCreatePayload, SegmentoTipo } from "../types/segmentos";
import {
	buildClienteFilterParams,
	downloadBlob,
	getCsvFilename,
	sortClientes,
} from "../utils/crmUtils";

const LIMITE_POR_PAGINA = 100;

export default function CRMPage() {
	const { alert, confirm } = useDialog();

	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [clientesMapa, setClientesMapa] = useState<ClienteMapa[]>([]);
	const [cargandoMapa, setCargandoMapa] = useState(false);
	const [cargando, setCargando] = useState(true);
	const [importando, setImportando] = useState(false);
	const [exportando, setExportando] = useState(false);
	const [exportandoSeleccionados, setExportandoSeleccionados] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [pagina, setPagina] = useState(0);

	const [mostrarFiltros, setMostrarFiltros] = useState(false);
	const [mostrarMapaFiltro, setMostrarMapaFiltro] = useState(false);
	const [sectoresDisponibles, setSectoresDisponibles] = useState<string[]>([]);

	const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");
	const [filtroSector, setFiltroSector] = useState<string>("");
	const [filtroCiudad, setFiltroCiudad] = useState<string>("");
	const [filtroValoracion, setFiltroValoracion] = useState<number | "">("");
	const [ordenCampo, setOrdenCampo] = useState<ServerSortField>("fecha_captacion");
	const [ordenDireccion, setOrdenDireccion] = useState<SortDirection>("desc");
	const [filtroEmail, setFiltroEmail] = useState<FiltroPresencia>("todos");
	const [filtroTelefono, setFiltroTelefono] = useState<FiltroPresencia>("todos");
	const [filtroSitioWeb, setFiltroSitioWeb] = useState<FiltroPresencia>("todos");
	const [filtroDireccion, setFiltroDireccion] = useState<FiltroPresencia>("todos");
	const [filtroCiudadPresencia, setFiltroCiudadPresencia] = useState<FiltroPresencia>("todos");
	const [filtroValoracionPresencia, setFiltroValoracionPresencia] = useState<FiltroPresencia>("todos");
	const [filtroResenas, setFiltroResenas] = useState<FiltroPresencia>("todos");
	const [filtroUrlMaps, setFiltroUrlMaps] = useState<FiltroPresencia>("todos");
	const [poligonoFiltro, setPoligonoFiltro] = useState<PoligonoCoords>([]);

	const [sortField, setSortField] = useState<SortField>(null);
	const [sortAsc, setSortAsc] = useState(true);
	const [seleccionados, setSeleccionados] = useState<number[]>([]);

	const [enriqueciendoId, setEnriqueciendoId] = useState<number | null>(null);
	const [progresoLote, setProgresoLote] = useState<{ actual: number; total: number } | null>(null);
	const [deteniendo, setDeteniendo] = useState(false);
	const [limpiando, setLimpiando] = useState(false);
	const [eliminandoSeleccionados, setEliminandoSeleccionados] = useState(false);
	const [clienteModalAbierto, setClienteModalAbierto] = useState(false);
	const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
	const [guardandoCliente, setGuardandoCliente] = useState(false);
	const [segmentoModalAbierto, setSegmentoModalAbierto] = useState(false);
	const [segmentoTipoInicial, setSegmentoTipoInicial] = useState<SegmentoTipo>("dinamico");
	const [segmentoFiltros, setSegmentoFiltros] = useState<ClienteFilters | null>(null);
	const [segmentoClienteIds, setSegmentoClienteIds] = useState<number[]>([]);
	const [guardandoSegmento, setGuardandoSegmento] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const abortarRef = useRef(false);

	const paramsFiltrosActuales = useCallback((): ClienteFilters => {
		return buildClienteFilterParams({
			filtroBusqueda,
			filtroSector,
			filtroCiudad,
			filtroValoracion,
			ordenCampo,
			ordenDireccion,
			filtroEmail,
			filtroTelefono,
			filtroSitioWeb,
			filtroDireccion,
			filtroCiudadPresencia,
			filtroValoracionPresencia,
			filtroResenas,
			filtroUrlMaps,
			poligonoFiltro,
		});
	}, [
		filtroBusqueda,
		filtroSector,
		filtroCiudad,
		filtroValoracion,
		ordenCampo,
		ordenDireccion,
		filtroEmail,
		filtroTelefono,
		filtroSitioWeb,
		filtroDireccion,
		filtroCiudadPresencia,
		filtroValoracionPresencia,
		filtroResenas,
		filtroUrlMaps,
		poligonoFiltro,
	]);

	const cargarClientes = useCallback(async () => {
		try {
			setCargando(true);

			const data = await obtenerClientes(pagina, LIMITE_POR_PAGINA, paramsFiltrosActuales());

			setClientes(data);
			setSeleccionados([]);
			setError(null);
		} catch (err) {
			console.error("Error al cargar clientes:", err);
			setError("No se pudo conectar con el servidor backend.");
		} finally {
			setCargando(false);
		}
	}, [pagina, paramsFiltrosActuales]);

	const cargarClientesMapa = useCallback(async () => {
		try {
			setCargandoMapa(true);
			const data = await obtenerClientesMapa(paramsFiltrosActuales());
			setClientesMapa(data);
		} catch (err) {
			console.error("Error al cargar clientes del mapa:", err);
			setClientesMapa([]);
		} finally {
			setCargandoMapa(false);
		}
	}, [paramsFiltrosActuales]);

	const exportarCSV = async () => {
		try {
			setExportando(true);

			const respuesta = await exportarClientesCsv(paramsFiltrosActuales());
			const filename = getCsvFilename(respuesta.contentDisposition);
			const blob = new Blob([respuesta.data], { type: "text/csv;charset=utf-8;" });

			downloadBlob(blob, filename);
		} catch (err) {
			console.error("Error exportando CSV:", err);
			alert("No se pudo exportar el CSV.");
		} finally {
			setExportando(false);
		}
	};

	const exportarCSVSeleccionados = async () => {
		const idsSeleccionados = [...seleccionados];

		if (idsSeleccionados.length === 0) {
			alert("Selecciona al menos un cliente para exportar.");
			return;
		}

		try {
			setExportandoSeleccionados(true);

			const respuesta = await api.post<Blob>(
				"/clientes/exportar-csv-seleccionados",
				{ ids: idsSeleccionados },
				{ responseType: "blob" },
			);
			const filename = getCsvFilename(respuesta.headers.get("content-disposition"));
			const blob = new Blob([respuesta.data], { type: "text/csv;charset=utf-8;" });

			downloadBlob(blob, filename);
		} catch (err) {
			console.error("Error exportando selección CSV:", err);
			alert("No se pudo exportar la selección.");
		} finally {
			setExportandoSeleccionados(false);
		}
	};

	const limpiarBaseDatos = async () => {
		if (
			!(await confirm({
				title: "Limpiar base de datos",
				description: "¿Seguro que quieres hacer una limpieza profunda? Se eliminarán caracteres raros de los nombres y se fusionarán correos duplicados.",
				tone: "warning",
				confirmLabel: "Limpiar",
			}))
		) {
			return;
		}

		setLimpiando(true);

		try {
			const mensaje = await limpiarClientesBd();
			alert(mensaje);
			setPagina(0);
			cargarClientes();
		} catch (err) {
			console.error("Error al limpiar:", err);
			alert("Hubo un error al intentar limpiar la base de datos.");
		} finally {
			setLimpiando(false);
		}
	};

	useEffect(() => {
		const cargarSectores = async () => {
			try {
				const data = await obtenerSectores();
				setSectoresDisponibles(data);
			} catch (err) {
				console.error("Error al cargar sectores", err);
			}
		};

		cargarSectores();
	}, []);

	useEffect(() => {
		cargarClientes();
	}, [cargarClientes]);

	useEffect(() => {
		if (!mostrarMapaFiltro) return;

		cargarClientesMapa();
	}, [cargarClientesMapa, mostrarMapaFiltro]);

	const aplicarFiltroTexto = () => {
		setPagina(0);
		cargarClientes();
	};

	const limpiarFiltros = () => {
		setFiltroBusqueda("");
		setFiltroSector("");
		setFiltroCiudad("");
		setFiltroValoracion("");
		setOrdenCampo("fecha_captacion");
		setOrdenDireccion("desc");
		setSortField(null);

		setFiltroEmail("todos");
		setFiltroTelefono("todos");
		setFiltroSitioWeb("todos");
		setFiltroDireccion("todos");
		setFiltroCiudadPresencia("todos");
		setFiltroValoracionPresencia("todos");
		setFiltroResenas("todos");
		setFiltroUrlMaps("todos");

		setPoligonoFiltro([]);
		setPagina(0);
	};

	const handlePoligonoChange = useCallback((coords: PoligonoCoords) => {
		setPoligonoFiltro(coords);
		setPagina(0);
	}, []);

	const handleLimpiarPoligono = useCallback(() => {
		setPoligonoFiltro([]);
		setPagina(0);
	}, []);

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortAsc(!sortAsc);
		} else {
			setSortField(field);
			setSortAsc(true);
		}
	};

	const toggleSeleccion = (id: number) => {
		setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
	};

	const toggleSeleccionarTodo = () => {
		if (seleccionados.length === clientes.length) {
			setSeleccionados([]);
		} else {
			setSeleccionados(clientes.map((cliente) => cliente.id));
		}
	};

	const eliminarCliente = async (id: number, nombre: string) => {
		if (!(await confirm({
			title: "Eliminar cliente",
			description: `¿Seguro que quieres borrar a ${nombre}?`,
			tone: "danger",
			confirmLabel: "Eliminar",
		}))) return;

		try {
			await eliminarClientePorId(id);
			setClientes((prev) => prev.filter((cliente) => cliente.id !== id));
			setClientesMapa((prev) => prev.filter((cliente) => cliente.id !== id));
			setSeleccionados((prev) => prev.filter((selectedId) => selectedId !== id));
		} catch {
			alert("Error al borrar el cliente.");
		}
	};

	const eliminarClientesSeleccionados = async () => {
		const idsAEliminar = [...seleccionados];

		if (idsAEliminar.length === 0) {
			alert("No has seleccionado ningún cliente.");
			return;
		}

		if (
			!(await confirm({
				title: "Eliminar selección",
				description: `¿Seguro que quieres borrar ${idsAEliminar.length} ${
					idsAEliminar.length === 1 ? "cliente seleccionado" : "clientes seleccionados"
				}? Esta acción no se puede deshacer.`,
				tone: "danger",
				confirmLabel: "Eliminar",
			}))
		) {
			return;
		}

		setEliminandoSeleccionados(true);

		try {
			const mensaje = await eliminarClientesMasivo(idsAEliminar);
			const idsSet = new Set(idsAEliminar);

			setClientes((prev) => prev.filter((cliente) => !idsSet.has(cliente.id)));
			setClientesMapa((prev) => prev.filter((cliente) => !idsSet.has(cliente.id)));
			setSeleccionados([]);

			await cargarClientes();
			if (mostrarMapaFiltro) await cargarClientesMapa();

			alert(mensaje);
		} catch (err) {
			console.error("Error al borrar clientes seleccionados:", err);
			alert("Error al borrar los clientes seleccionados.");
		} finally {
			setEliminandoSeleccionados(false);
		}
	};

	const abrirCrearCliente = () => {
		setClienteEditando(null);
		setClienteModalAbierto(true);
	};

	const abrirEditarCliente = (cliente: Cliente) => {
		setClienteEditando(cliente);
		setClienteModalAbierto(true);
	};

	const cerrarClienteModal = () => {
		if (guardandoCliente) return;

		setClienteModalAbierto(false);
		setClienteEditando(null);
	};

	const guardarClienteManual = async (
		payload: ClienteUpsertPayload,
		options: ClienteFormSubmitOptions,
	) => {
		setGuardandoCliente(true);

		try {
			let clienteGuardado = clienteEditando
				? await actualizarCliente(clienteEditando.id, payload)
				: await crearCliente(payload);

			if (options.enriquecerAutomaticamente) {
				setEnriqueciendoId(clienteGuardado.id);

				try {
					clienteGuardado = await enriquecerCliente(clienteGuardado.id);
				} catch (err) {
					console.error("Cliente guardado, pero falló el enriquecimiento automático:", err);
					alert("El cliente se ha guardado, pero no se pudo enriquecer automáticamente.");
				} finally {
					setEnriqueciendoId(null);
				}
			}

			setClientes((prev) => {
				const existe = prev.some((cliente) => cliente.id === clienteGuardado.id);

				if (existe) {
					return prev.map((cliente) =>
						cliente.id === clienteGuardado.id ? clienteGuardado : cliente,
					);
				}

				return [clienteGuardado, ...prev];
			});

			setClientesMapa((prev) => {
				if (clienteGuardado.latitud === null || clienteGuardado.longitud === null) {
					return prev.filter((cliente) => cliente.id !== clienteGuardado.id);
				}

				const existe = prev.some((cliente) => cliente.id === clienteGuardado.id);
				const clienteMapa = { ...clienteGuardado };

				if (existe) {
					return prev.map((cliente) =>
						cliente.id === clienteGuardado.id ? { ...cliente, ...clienteMapa } : cliente,
					);
				}

				return [...prev, clienteMapa];
			});

			if (!clienteEditando) {
				setPagina(0);
			}

			setClienteModalAbierto(false);
			setClienteEditando(null);
			setSeleccionados([]);

			await cargarClientes();
			if (mostrarMapaFiltro) await cargarClientesMapa();
		} catch (err) {
			console.error("Error guardando cliente:", err);
			alert("No se pudo guardar el cliente. Revisa los datos e inténtalo de nuevo.");
		} finally {
			setGuardandoCliente(false);
		}
	};

	const abrirGuardarSegmentoFiltros = () => {
		setSegmentoTipoInicial("dinamico");
		setSegmentoFiltros(paramsFiltrosActuales());
		setSegmentoClienteIds([]);
		setSegmentoModalAbierto(true);
	};

	const abrirGuardarSegmentoSeleccion = () => {
		if (seleccionados.length === 0) {
			alert("Selecciona al menos un cliente para crear una lista.");
			return;
		}

		setSegmentoTipoInicial("estatico");
		setSegmentoFiltros(null);
		setSegmentoClienteIds([...seleccionados]);
		setSegmentoModalAbierto(true);
	};

	const cerrarSegmentoModal = () => {
		if (guardandoSegmento) return;

		setSegmentoModalAbierto(false);
		setSegmentoFiltros(null);
		setSegmentoClienteIds([]);
	};

	const guardarSegmento = async (payload: SegmentoCreatePayload) => {
		try {
			setGuardandoSegmento(true);
			await crearSegmento(payload);
			setSegmentoModalAbierto(false);
			setSegmentoFiltros(null);
			setSegmentoClienteIds([]);
			setSeleccionados([]);
			alert("Segmento creado correctamente.");
		} catch (err: any) {
			console.error("Error creando segmento:", err);
			alert(err?.response?.data?.detail || "No se pudo crear el segmento.");
		} finally {
			setGuardandoSegmento(false);
		}
	};

	const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setImportando(true);
		const reader = new FileReader();

		reader.onload = async () => {
			try {
				const resultado = await importarClientesCsvArchivo(file);
				const detalles = [
					resultado.mensaje,
					resultado.avisos?.length ? `\nAvisos:\n${resultado.avisos.slice(0, 8).join("\n")}` : "",
					resultado.errores?.length ? `\nErrores:\n${resultado.errores.slice(0, 8).join("\n")}` : "",
				]
					.filter(Boolean)
					.join("\n");

				alert(detalles || "Importación completada.");
				cargarClientes();
			} catch (err) {
				console.error("Error procesando CSV:", err);
				alert("Hubo un error procesando el archivo CSV.");
			} finally {
				setImportando(false);
				if (fileInputRef.current) fileInputRef.current.value = "";
			}
		};

		reader.readAsArrayBuffer(file);
	};

	const enriquecerClienteUnico = async (id: number) => {
		setEnriqueciendoId(id);

		try {
			const clienteEnriquecido = await enriquecerCliente(id);
			setClientes((prev) => prev.map((cliente) => (cliente.id === id ? clienteEnriquecido : cliente)));
			setClientesMapa((prev) =>
				prev.map((cliente) => (cliente.id === id ? { ...cliente, ...clienteEnriquecido } : cliente)),
			);
		} catch (err) {
			console.error(`Error en ID ${id}`, err);
		} finally {
			setEnriqueciendoId(null);
		}
	};

	const iniciarEnriquecimientoMasivo = async (usarSeleccionados: boolean) => {
		let idsAProcesar: number[] = [];

		if (usarSeleccionados) {
			idsAProcesar = seleccionados;
		} else {
			try {
				idsAProcesar = await obtenerIdsPendientes();
			} catch {
				alert("Fallo al contactar con la BBDD.");
				return;
			}
		}

		if (idsAProcesar.length === 0) {
			alert(usarSeleccionados ? "No has seleccionado ningún cliente." : "Toda tu BBDD ya está enriquecida.");
			return;
		}

		if (!(await confirm({
			title: "Enriquecer clientes",
			description: `Se van a procesar ${idsAProcesar.length} clientes. ¿Continuar?`,
			tone: "info",
			confirmLabel: "Procesar",
		}))) {
			return;
		}

		abortarRef.current = false;
		setDeteniendo(false);
		setProgresoLote({ actual: 0, total: idsAProcesar.length });

		for (let i = 0; i < idsAProcesar.length; i++) {
			if (abortarRef.current) break;

			setProgresoLote({ actual: i + 1, total: idsAProcesar.length });
			await enriquecerClienteUnico(idsAProcesar[i]);
		}

		const fueAbortado = abortarRef.current;

		setProgresoLote(null);
		setDeteniendo(false);

		if (!usarSeleccionados) cargarClientes();

		alert(fueAbortado ? "Proceso detenido." : "Proceso completado.");
	};

	const isProcessingAny =
		importando ||
		enriqueciendoId !== null ||
		progresoLote !== null ||
		eliminandoSeleccionados ||
		guardandoCliente ||
		guardandoSegmento ||
		exportandoSeleccionados;
	const poligonoActivo = poligonoFiltro.length >= 3;
	const sortedClientes = useMemo(
		() => sortClientes(clientes, sortField, sortAsc),
		[clientes, sortAsc, sortField],
	);

	return (
		<PageShell>
			<PageHeader
				title="Clientes"
				description="Base de datos local de clientes: consulta, edición, filtros, importación y exportación."
				actions={
					<CRMToolbar
					progresoLote={progresoLote}
					deteniendo={deteniendo}
					seleccionadosCount={seleccionados.length}
					isProcessingAny={isProcessingAny}
					mostrarFiltros={mostrarFiltros}
					mostrarMapaFiltro={mostrarMapaFiltro}
					poligonoActivo={poligonoActivo}
					exportando={exportando}
					exportandoSeleccionados={exportandoSeleccionados}
					limpiando={limpiando}
					importando={importando}
					eliminandoSeleccionados={eliminandoSeleccionados}
					fileInputRef={fileInputRef}
					onDetenerProceso={() => {
						abortarRef.current = true;
						setDeteniendo(true);
					}}
					onAbrirNuevoCliente={abrirCrearCliente}
					onEnriquecerSeleccionados={() => iniciarEnriquecimientoMasivo(true)}
					onEliminarSeleccionados={eliminarClientesSeleccionados}
					onCrearSegmentoSeleccion={abrirGuardarSegmentoSeleccion}
					onEnriquecerBbdd={() => iniciarEnriquecimientoMasivo(false)}
					onToggleFiltros={() => setMostrarFiltros((prev) => !prev)}
					onToggleMapaFiltro={() => setMostrarMapaFiltro((prev) => !prev)}
					onExportarCsv={exportarCSV}
					onExportarSeleccionadosCsv={exportarCSVSeleccionados}
					onLimpiarBaseDatos={limpiarBaseDatos}
					onFileUpload={handleFileUpload}
					/>
				}
			/>

			{mostrarFiltros && (
				<CRMFilters
					sectoresDisponibles={sectoresDisponibles}
					filtroBusqueda={filtroBusqueda}
					filtroSector={filtroSector}
					filtroValoracion={filtroValoracion}
					ordenCampo={ordenCampo}
					ordenDireccion={ordenDireccion}
					filtroEmail={filtroEmail}
					filtroTelefono={filtroTelefono}
					filtroSitioWeb={filtroSitioWeb}
					filtroDireccion={filtroDireccion}
					filtroCiudadPresencia={filtroCiudadPresencia}
					filtroValoracionPresencia={filtroValoracionPresencia}
					filtroResenas={filtroResenas}
					filtroUrlMaps={filtroUrlMaps}
					setFiltroBusqueda={setFiltroBusqueda}
					setFiltroSector={setFiltroSector}
					setFiltroValoracion={setFiltroValoracion}
					setOrdenCampo={(value) => {
						setOrdenCampo((prev) =>
							typeof value === "function" ? value(prev) : value,
						);
						setSortField(null);
					}}
					setOrdenDireccion={(value) => {
						setOrdenDireccion((prev) =>
							typeof value === "function" ? value(prev) : value,
						);
						setSortField(null);
					}}
					setFiltroEmail={setFiltroEmail}
					setFiltroTelefono={setFiltroTelefono}
					setFiltroSitioWeb={setFiltroSitioWeb}
					setFiltroDireccion={setFiltroDireccion}
					setFiltroCiudadPresencia={setFiltroCiudadPresencia}
					setFiltroValoracionPresencia={setFiltroValoracionPresencia}
					setFiltroResenas={setFiltroResenas}
					setFiltroUrlMaps={setFiltroUrlMaps}
					onResetPagina={() => setPagina(0)}
					onAplicarFiltroTexto={aplicarFiltroTexto}
					onLimpiarFiltros={limpiarFiltros}
					onGuardarSegmento={abrirGuardarSegmentoFiltros}
				/>
			)}

			{mostrarMapaFiltro && (
				<MapaFiltroPoligono
					clientes={clientesMapa}
					cargando={cargandoMapa}
					poligono={poligonoFiltro}
					onPoligonoChange={handlePoligonoChange}
					onLimpiarPoligono={handleLimpiarPoligono}
				/>
			)}

			<CRMClientesTable
				clientes={clientes}
				sortedClientes={sortedClientes}
				cargando={cargando}
				error={error}
				seleccionados={seleccionados}
				enriqueciendoId={enriqueciendoId}
				isProcessingAny={isProcessingAny}
				pagina={pagina}
				limitePorPagina={LIMITE_POR_PAGINA}
				poligonoActivo={poligonoActivo}
				onSort={handleSort}
				onToggleSeleccion={toggleSeleccion}
				onToggleSeleccionarTodo={toggleSeleccionarTodo}
				onEditarCliente={abrirEditarCliente}
				onEliminarCliente={eliminarCliente}
				onPaginaAnterior={() => setPagina((p) => Math.max(0, p - 1))}
				onPaginaSiguiente={() => setPagina((p) => p + 1)}
			/>

			<CRMClienteFormModal
				abierto={clienteModalAbierto}
				modo={clienteEditando ? "editar" : "crear"}
				cliente={clienteEditando}
				guardando={guardandoCliente}
				onClose={cerrarClienteModal}
				onSubmit={guardarClienteManual}
			/>

			<SegmentoFormModal
				abierto={segmentoModalAbierto}
				tipoInicial={segmentoTipoInicial}
				filtros={segmentoFiltros}
				clienteIds={segmentoClienteIds}
				guardando={guardandoSegmento}
				onClose={cerrarSegmentoModal}
				onSubmit={guardarSegmento}
			/>
		</PageShell>
	);
}
