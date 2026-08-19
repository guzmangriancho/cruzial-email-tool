/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { RotateCcw } from "lucide-react";

import { CampanaForm } from "../components/campanas/CampanaForm";
import { CampanasPanel } from "../components/campanas/CampanasPanel";
import { Badge, Button, PageHeader, PageShell, useDialog } from "../components/ui";

import { campanasService } from "../services/campanasService";

import type {
	AdjuntoDisponible,
	CampanaDetalle,
	CampanaResumen,
	EstadoCampana,
	LogCampana,
} from "../types/campanas";

import {
	HTML_INICIAL,
	csvPreview,
	extraerAsuntoDetalle,
	extraerCuerpoDetalle,
} from "../utils/campanasUtils";

export default function CampanasPage() {
	const { alert, confirm } = useDialog();

	const [campanas, setCampanas] = useState<CampanaResumen[]>([]);
	const [campanaSeleccionadaId, setCampanaSeleccionadaId] = useState<
		number | null
	>(null);

	const [estadoCampana, setEstadoCampana] = useState<EstadoCampana | null>(
		null,
	);
	const [logs, setLogs] = useState<LogCampana[]>([]);

	const [cargandoCampanas, setCargandoCampanas] = useState(true);
	const [cargandoDetalle, setCargandoDetalle] = useState(false);
	const [accionando, setAccionando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [nombreCampana, setNombreCampana] = useState("");
	const [remitente, setRemitente] = useState("Ignacio González-Riancho");
	const [asunto, setAsunto] = useState("");
	const [delaySegundos, setDelaySegundos] = useState(30);

	const [csvFile, setCsvFile] = useState<File | null>(null);
	const [csvInfo, setCsvInfo] = useState<{
		filas: number;
		cabeceras: string[];
	} | null>(null);

	const [htmlEditor, setHtmlEditor] = useState(HTML_INICIAL);
	const [creando, setCreando] = useState(false);
	const [guardandoEdicion, setGuardandoEdicion] = useState(false);
	const [editandoCampanaId, setEditandoCampanaId] = useState<number | null>(
		null,
	);

	const [adjuntosDisponibles, setAdjuntosDisponibles] = useState<
		AdjuntoDisponible[]
	>([]);
	const [cargandoAdjuntos, setCargandoAdjuntos] = useState(false);
	const [adjuntosGenericosSeleccionados, setAdjuntosGenericosSeleccionados] =
		useState<string[]>([]);
	const [adjuntosUpload, setAdjuntosUpload] = useState<File[]>([]);
	const [emailPrueba, setEmailPrueba] = useState("");
	const [enviandoPrueba, setEnviandoPrueba] = useState(false);

	const cargarCampanas = useCallback(async () => {
		try {
			setCargandoCampanas(true);

			const data = await campanasService.listar();

			setCampanas(data);
			setError(null);

			setCampanaSeleccionadaId((actual) => {
				if (actual && data.some((campana) => campana.campana_id === actual)) {
					return actual;
				}

				return data.length > 0 ? data[0].campana_id : null;
			});
		} catch (err) {
			console.error("Error cargando campañas", err);
			setError("No se pudieron cargar las campañas.");
		} finally {
			setCargandoCampanas(false);
		}
	}, []);

	const cargarEstadoCampanaPorId = useCallback(
		async (campanaId: number | null) => {
			if (!campanaId) {
				setEstadoCampana(null);
				setLogs([]);
				return;
			}

			try {
				const [estado, logsCampana] = await Promise.all([
					campanasService.obtenerEstado(campanaId),
					campanasService.obtenerLogs(campanaId, 80),
				]);

				setEstadoCampana(estado);
				setLogs(logsCampana);
			} catch (err) {
				console.error("Error cargando estado de campaña", err);
			}
		},
		[],
	);

	const cargarEstadoCampana = useCallback(async () => {
		await cargarEstadoCampanaPorId(campanaSeleccionadaId);
	}, [campanaSeleccionadaId, cargarEstadoCampanaPorId]);

	const cargarAdjuntosDisponibles = useCallback(async () => {
		try {
			setCargandoAdjuntos(true);

			const data = await campanasService.listarAdjuntosDisponibles();

			setAdjuntosDisponibles(data);
		} catch (err) {
			console.error("Error cargando adjuntos disponibles", err);
		} finally {
			setCargandoAdjuntos(false);
		}
	}, []);

	const cargarDetalleCampana = useCallback(
		async (campanaId: number, aplicarAlEditor: boolean) => {
			try {
				setCargandoDetalle(true);

				const detalle: CampanaDetalle =
					await campanasService.obtenerDetalle(campanaId);

				if (aplicarAlEditor) {
					setEditandoCampanaId(campanaId);
					setNombreCampana(detalle.nombre || "");
					setRemitente(detalle.remitente || "Ignacio González-Riancho");
					setAsunto(extraerAsuntoDetalle(detalle));
					setDelaySegundos(detalle.delay_segundos ?? 30);
					setCsvFile(null);
					setCsvInfo(null);
					setHtmlEditor(extraerCuerpoDetalle(detalle) || HTML_INICIAL);
					setAdjuntosGenericosSeleccionados(detalle.adjuntos_genericos || []);
					setAdjuntosUpload([]);
				}

				return detalle;
			} catch (err: any) {
				console.error("Error cargando detalle de campaña", err);

				if (aplicarAlEditor) {
					alert(
						err?.response?.data?.detail ||
							"No se pudo cargar el detalle editable de la campaña. Revisa que exista el endpoint GET /campanas/{id}.",
					);
				}

				return null;
			} finally {
				setCargandoDetalle(false);
			}
		},
		[alert],
	);

	useEffect(() => {
		cargarCampanas();
	}, [cargarCampanas]);

	useEffect(() => {
		cargarEstadoCampana();
	}, [cargarEstadoCampana]);

	useEffect(() => {
		cargarAdjuntosDisponibles();
	}, [cargarAdjuntosDisponibles]);

	useEffect(() => {
		const activa =
			estadoCampana?.estado === "En Progreso" ||
			estadoCampana?.estado === "Preparada";

		if (!campanaSeleccionadaId || !activa) return;

		const intervaloEstado = setInterval(() => {
			cargarEstadoCampana();
		}, 10000);

		const intervaloCampanas = setInterval(() => {
			cargarCampanas();
		}, 60000);

		return () => {
			clearInterval(intervaloEstado);
			clearInterval(intervaloCampanas);
		};
	}, [
		campanaSeleccionadaId,
		estadoCampana?.estado,
		cargarEstadoCampana,
		cargarCampanas,
	]);

	const obtenerHtmlEditor = () => {
		const html = htmlEditor || "";

		const textoPlano = html
			.replace(/<[^>]*>/g, "")
			.replace(/&nbsp;/g, " ")
			.trim();

		if (!textoPlano) {
			return "";
		}

		return html;
	};

	const onCsvChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setCsvFile(file);

		if (!file) {
			setCsvInfo(null);
			return;
		}

		const preview = await csvPreview(file);
		setCsvInfo(preview);
	};

	const limpiarFormulario = () => {
		setEditandoCampanaId(null);
		setNombreCampana("");
		setAsunto("");
		setCsvFile(null);
		setCsvInfo(null);
		setDelaySegundos(30);
		setHtmlEditor(HTML_INICIAL);
		setAdjuntosGenericosSeleccionados([]);
		setAdjuntosUpload([]);
	};

	const editarCampanaSeleccionada = async () => {
		if (!campanaSeleccionadaId) return;

		const estado = estadoCampana?.estado;

		if (estado === "En Progreso") {
			alert("No se puede editar una campaña mientras está en progreso.");
			return;
		}

		await cargarDetalleCampana(campanaSeleccionadaId, true);
	};

	const validarContenidoCampana = () => {
		const cuerpoHtml = obtenerHtmlEditor();

		if (!nombreCampana.trim()) {
			alert("Pon un nombre interno para la campaña.");
			return null;
		}

		if (!remitente.trim()) {
			alert("Indica el nombre del remitente.");
			return null;
		}

		if (!asunto.trim()) {
			alert("Escribe un asunto.");
			return null;
		}

		if (!cuerpoHtml) {
			alert("El cuerpo del mensaje está vacío.");
			return null;
		}

		return cuerpoHtml;
	};

	const guardarCambiosCampanaExistente = async () => {
		if (!editandoCampanaId) return;

		const cuerpoHtml = validarContenidoCampana();
		if (!cuerpoHtml) return;

		try {
			setGuardandoEdicion(true);

			const res = await campanasService.actualizar(editandoCampanaId, {
				nombre: nombreCampana.trim(),
				remitente: remitente.trim(),
				asunto: asunto.trim(),
				cuerpo_html: cuerpoHtml,
				delay_segundos: delaySegundos,
				adjuntos_genericos: adjuntosGenericosSeleccionados,
				adjuntos_upload: adjuntosUpload,
			});

			alert(res?.mensaje || "Campaña actualizada correctamente.");

			setAdjuntosUpload([]);

			await cargarCampanas();
			await cargarEstadoCampanaPorId(editandoCampanaId);
		} catch (err: any) {
			console.error("Error guardando campaña", err);

			alert(
				err?.response?.data?.detail ||
					"No se pudo guardar la campaña. Revisa que exista el endpoint PUT /campanas/{id} con multipart/form-data.",
			);
		} finally {
			setGuardandoEdicion(false);
		}
	};

	const duplicarComoNueva = () => {
		setEditandoCampanaId(null);
		setNombreCampana(
			nombreCampana.trim() ? `Copia de ${nombreCampana.trim()}` : "",
		);
		setCsvFile(null);
		setCsvInfo(null);
		setAdjuntosUpload([]);
	};

	const enviarCorreoPrueba = async () => {
		const cuerpoHtml = obtenerHtmlEditor();

		if (!emailPrueba.trim()) {
			alert("Indica el email al que quieres enviar la prueba.");
			return;
		}

		if (!remitente.trim()) {
			alert("Indica el nombre del remitente.");
			return;
		}

		if (!asunto.trim()) {
			alert("Escribe un asunto.");
			return;
		}

		if (!cuerpoHtml) {
			alert("El cuerpo del mensaje está vacío.");
			return;
		}

		try {
			setEnviandoPrueba(true);

			const res = await campanasService.enviarPrueba({
				email_destino: emailPrueba.trim(),
				nombre: nombreCampana.trim() || "Prueba de campaña",
				remitente: remitente.trim(),
				asunto: asunto.trim(),
				cuerpo_html: cuerpoHtml,
				adjuntos_genericos: adjuntosGenericosSeleccionados,
				adjuntos_upload: adjuntosUpload,
			});

			alert(res?.mensaje || "Correo de prueba enviado correctamente.");
		} catch (err: any) {
			console.error("Error enviando correo de prueba", err);

			alert(
				err?.response?.data?.detail || "No se pudo enviar el correo de prueba.",
			);
		} finally {
			setEnviandoPrueba(false);
		}
	};

	const crearCampana = async (lanzarInmediatamente: boolean) => {
		const cuerpoHtml = validarContenidoCampana();
		if (!cuerpoHtml) return;

		if (!csvFile) {
			alert("Sube un CSV de destinatarios.");
			return;
		}

		if (
			lanzarInmediatamente &&
			!(await confirm({
				title: "Lanzar campaña",
				description: `Se creará la campaña y empezará el envío. Pausa entre emails: ${delaySegundos}s. ¿Continuar?`,
				tone: "warning",
				confirmLabel: "Crear y lanzar",
			}))
		) {
			return;
		}

		try {
			setCreando(true);

			const res = await campanasService.crearDesdeCsv({
				nombre: nombreCampana.trim(),
				remitente: remitente.trim(),
				asunto: asunto.trim(),
				cuerpo_html: cuerpoHtml,
				delay_segundos: delaySegundos,
				lanzar_inmediatamente: lanzarInmediatamente,
				csv_file: csvFile,
				adjuntos_genericos: adjuntosGenericosSeleccionados,
				adjuntos_upload: adjuntosUpload,
			});

			alert(
				`${res.mensaje}\nDestinatarios: ${res.destinatarios}\nOmitidos: ${res.omitidos}`,
			);

			const nuevaCampanaId = res.campana_id;

			setCampanaSeleccionadaId(nuevaCampanaId);
			limpiarFormulario();

			await cargarCampanas();
			await cargarEstadoCampanaPorId(nuevaCampanaId);
		} catch (err: any) {
			console.error("Error creando campaña", err);

			const detail = err?.response?.data?.detail;

			alert(
				typeof detail === "string"
					? detail
					: detail?.mensaje || "No se pudo crear la campaña.",
			);
		} finally {
			setCreando(false);
		}
	};

	const lanzarCampana = async () => {
		if (!campanaSeleccionadaId) return;

		try {
			setAccionando(true);

			const res = await campanasService.lanzar(campanaSeleccionadaId);
			alert(res.mensaje);

			await cargarEstadoCampana();
			await cargarCampanas();
		} catch (err: any) {
			alert(err?.response?.data?.detail || "No se pudo lanzar la campaña.");
		} finally {
			setAccionando(false);
		}
	};

	const detenerCampana = async () => {
		if (!campanaSeleccionadaId) return;

		try {
			setAccionando(true);

			const res = await campanasService.detener(campanaSeleccionadaId);
			alert(res.mensaje);

			await cargarEstadoCampana();
			await cargarCampanas();
		} catch (err: any) {
			alert(err?.response?.data?.detail || "No se pudo detener la campaña.");
		} finally {
			setAccionando(false);
		}
	};

	const reanudarCampana = async () => {
		if (!campanaSeleccionadaId) return;

		try {
			setAccionando(true);

			const res = await campanasService.reanudar(campanaSeleccionadaId);
			alert(res.mensaje);

			await cargarEstadoCampana();
			await cargarCampanas();
		} catch (err: any) {
			alert(err?.response?.data?.detail || "No se pudo reanudar la campaña.");
		} finally {
			setAccionando(false);
		}
	};

	const eliminarCampana = async () => {
		if (!campanaSeleccionadaId) return;

		if (!(await confirm({
			title: "Eliminar campaña",
			description: "¿Seguro que quieres eliminar esta campaña?",
			tone: "danger",
			confirmLabel: "Eliminar",
		}))) return;

		try {
			setAccionando(true);

			await campanasService.eliminar(campanaSeleccionadaId);

			setCampanaSeleccionadaId(null);
			setEstadoCampana(null);
			setLogs([]);

			await cargarCampanas();
		} catch (err: any) {
			alert(err?.response?.data?.detail || "No se pudo eliminar la campaña.");
		} finally {
			setAccionando(false);
		}
	};

	const seleccionarCampana = (campanaId: number) => {
		setCampanaSeleccionadaId(campanaId);
	};

	return (
		<PageShell className="flex h-[calc(100vh-3.5rem)] w-full max-w-none flex-col gap-2 overflow-hidden p-4 xl:p-5 2xl:p-6">
			<PageHeader
				className="mb-0 shrink-0"
				title="Campañas email"
				description="Crea, edita, previsualiza y monitoriza campañas de email."
				actions={
					<>
						{editandoCampanaId ? (
						<Badge variant="purple" className="whitespace-nowrap border border-[var(--app-primary-border)]">
							Editando campaña #{editandoCampanaId}
						</Badge>
					) : (
						<Badge variant="blue" className="whitespace-nowrap border border-blue-100">
							Nueva campaña
						</Badge>
					)}

					<Button
						type="button"
						onClick={limpiarFormulario}
						variant="secondary"
						size="sm"
						className="whitespace-nowrap"
						leftIcon={<RotateCcw size={16} />}
					>
						Nueva campaña
						</Button>
					</>
				}
			/>

			<div className="grid grid-cols-12 gap-4 min-h-0 flex-1 overflow-hidden">
				<CampanaForm
					editandoCampanaId={editandoCampanaId}
					nombreCampana={nombreCampana}
					setNombreCampana={setNombreCampana}
					remitente={remitente}
					setRemitente={setRemitente}
					asunto={asunto}
					setAsunto={setAsunto}
					delaySegundos={delaySegundos}
					setDelaySegundos={setDelaySegundos}
					csvFile={csvFile}
					csvInfo={csvInfo}
					onCsvChange={onCsvChange}
					htmlEditor={htmlEditor}
					setHtmlEditor={setHtmlEditor}
					adjuntosDisponibles={adjuntosDisponibles}
					cargandoAdjuntos={cargandoAdjuntos}
					adjuntosGenericosSeleccionados={adjuntosGenericosSeleccionados}
					setAdjuntosGenericosSeleccionados={setAdjuntosGenericosSeleccionados}
					adjuntosUpload={adjuntosUpload}
					setAdjuntosUpload={setAdjuntosUpload}
					emailPrueba={emailPrueba}
					setEmailPrueba={setEmailPrueba}
					enviandoPrueba={enviandoPrueba}
					creando={creando}
					guardandoEdicion={guardandoEdicion}
					onEnviarPrueba={enviarCorreoPrueba}
					onRecargarAdjuntos={cargarAdjuntosDisponibles}
					onDuplicarComoNueva={duplicarComoNueva}
					onGuardarCambios={guardarCambiosCampanaExistente}
					onCrearBorrador={() => crearCampana(false)}
					onCrearYLanzar={() => crearCampana(true)}
				/>

				<CampanasPanel
					campanas={campanas}
					campanaSeleccionadaId={campanaSeleccionadaId}
					estadoCampana={estadoCampana}
					logs={logs}
					cargandoCampanas={cargandoCampanas}
					cargandoDetalle={cargandoDetalle}
					accionando={accionando}
					error={error}
					onSeleccionarCampana={seleccionarCampana}
					onRefresh={() => {
						cargarCampanas();
						cargarEstadoCampana();
					}}
					onLanzar={lanzarCampana}
					onDetener={detenerCampana}
					onReanudar={reanudarCampana}
					onEditar={editarCampanaSeleccionada}
					onEliminar={eliminarCampana}
				/>
			</div>
		</PageShell>
	);
}
