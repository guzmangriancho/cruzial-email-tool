import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  AlertCircle,
  ChevronDown,
  ClipboardCopy,
  Database,
  FileText,
  FileUp,
  ListChecks,
  Loader2,
  Paperclip,
  RefreshCw,
  Save,
  Send,
  Tags,
  TestTube2,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import type { AdjuntoDisponible } from "../../types/campanas";
import type { Segmento } from "../../types/segmentos";

import {
  obtenerSegmentos,
  exportarSegmentoCsv,
} from "../../services/segmentosService";
import { configuracionService } from "../../services/configuracionService";
import { VARIABLES } from "../../utils/campanasUtils";

import { EmailEditor, type EmailEditorHandle } from "./EmailEditor";
import { Badge, Button, Card, CardContent, CardHeader, Field, IconButton, Input, Select, useDialog } from "../ui";

interface CsvInfo {
  filas: number;
  cabeceras: string[];
}

interface CampanaFormProps {
  editandoCampanaId: number | null;

  nombreCampana: string;
  setNombreCampana: (value: string) => void;

  remitente: string;
  setRemitente: (value: string) => void;

  asunto: string;
  setAsunto: (value: string) => void;

  delaySegundos: number;
  setDelaySegundos: (value: number) => void;

  csvFile: File | null;
  csvInfo: CsvInfo | null;
  onCsvChange: (e: ChangeEvent<HTMLInputElement>) => void;

  htmlEditor: string;
  setHtmlEditor: (value: string) => void;

  creando: boolean;
  guardandoEdicion: boolean;

  onDuplicarComoNueva: () => void;
  onGuardarCambios: () => void;
  onCrearBorrador: () => void;
  onCrearYLanzar: () => void;

  adjuntosDisponibles: AdjuntoDisponible[];
  cargandoAdjuntos: boolean;

  adjuntosGenericosSeleccionados: string[];
  setAdjuntosGenericosSeleccionados: (value: string[]) => void;

  adjuntosUpload: File[];
  setAdjuntosUpload: (value: File[]) => void;

  emailPrueba: string;
  setEmailPrueba: (value: string) => void;

  enviandoPrueba: boolean;

  onEnviarPrueba: () => void;
  onRecargarAdjuntos: () => void;
}

function formatoPeso(bytes: number) {
  if (!bytes) return "0 KB";

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatearNumero(value: number) {
  return new Intl.NumberFormat("es-ES").format(value || 0);
}

function nombreArchivoDesdeDisposition(
  contentDisposition: string | undefined,
  fallback: string,
) {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const normalMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return normalMatch?.[1] || fallback;
}

function eventoCsvDesdeFileList(files: FileList) {
  return {
    target: { files },
    currentTarget: { files },
  } as unknown as ChangeEvent<HTMLInputElement>;
}

function colorSegmento(color: string | null | undefined) {
  const colores: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-green-200 bg-green-50 text-green-700",
    purple: "border-[var(--app-primary-border)] bg-[var(--app-primary-soft)] text-[var(--app-primary-text)]",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return colores[color || "blue"] || colores.blue;
}

export function CampanaForm({
  editandoCampanaId,
  nombreCampana,
  setNombreCampana,
  remitente,
  setRemitente,
  asunto,
  setAsunto,
  delaySegundos,
  setDelaySegundos,
  csvFile,
  csvInfo,
  onCsvChange,
  htmlEditor,
  setHtmlEditor,
  creando,
  guardandoEdicion,
  onDuplicarComoNueva,
  onGuardarCambios,
  onCrearBorrador,
  onCrearYLanzar,
  adjuntosDisponibles,
  cargandoAdjuntos,
  adjuntosGenericosSeleccionados,
  setAdjuntosGenericosSeleccionados,
  adjuntosUpload,
  setAdjuntosUpload,
  emailPrueba,
  setEmailPrueba,
  enviandoPrueba,
  onEnviarPrueba,
  onRecargarAdjuntos,
}: CampanaFormProps) {
  const { alert } = useDialog();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const asuntoInputRef = useRef<HTMLInputElement>(null);
  const adjuntosInputRef = useRef<HTMLInputElement>(null);
  const emailEditorRef = useRef<EmailEditorHandle>(null);

  const [ultimoCampoVariable, setUltimoCampoVariable] = useState<
    "asunto" | "cuerpo"
  >("cuerpo");

  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [cargandoSegmentos, setCargandoSegmentos] = useState(false);
  const [errorSegmentos, setErrorSegmentos] = useState<string | null>(null);
  const [segmentoSeleccionadoId, setSegmentoSeleccionadoId] =
    useState<string>("");
  const [importandoSegmento, setImportandoSegmento] = useState(false);
  const [copiandoContextoIa, setCopiandoContextoIa] = useState(false);

  const segmentoSeleccionado = useMemo(() => {
    const id = Number(segmentoSeleccionadoId);
    return segmentos.find((segmento) => segmento.id === id) || null;
  }, [segmentoSeleccionadoId, segmentos]);

  const cargarSegmentos = async () => {
    try {
      setCargandoSegmentos(true);
      setErrorSegmentos(null);

      const data = await obtenerSegmentos();
      setSegmentos(data || []);
    } catch (error) {
      console.error("Error cargando segmentos/listas", error);
      setErrorSegmentos("No se pudieron cargar los segmentos/listas.");
    } finally {
      setCargandoSegmentos(false);
    }
  };

  useEffect(() => {
    if (!editandoCampanaId) {
      cargarSegmentos();
    }
  }, [editandoCampanaId]);

  useEffect(() => {
    if (!csvFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [csvFile]);

  useEffect(() => {
    if (adjuntosUpload.length === 0 && adjuntosInputRef.current) {
      adjuntosInputRef.current.value = "";
    }
  }, [adjuntosUpload]);

  const seleccionarSegmentoComoDestinatarios = async (
    segmentoIdRaw: string,
  ) => {
    setSegmentoSeleccionadoId(segmentoIdRaw);

    if (!segmentoIdRaw) return;

    const segmentoId = Number(segmentoIdRaw);
    const segmento = segmentos.find((item) => item.id === segmentoId);

    if (!segmento) return;

    if (segmento.total_clientes <= 0) {
      alert("Este segmento/lista no tiene clientes.");
      return;
    }

    try {
      setImportandoSegmento(true);

      const { data, contentDisposition } =
        await exportarSegmentoCsv(segmentoId);
      const fallbackFilename = `segmento_${
        segmento.nombre
          .toLowerCase()
          .replace(/[^a-z0-9áéíóúñ]+/gi, "_")
          .replace(/^_+|_+$/g, "") || "clientes"
      }.csv`;

      const filename = nombreArchivoDesdeDisposition(
        contentDisposition,
        fallbackFilename,
      );

      const file = new File([data], filename, {
        type: "text/csv;charset=utf-8;",
      });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
      }

      onCsvChange(eventoCsvDesdeFileList(dataTransfer.files));
    } catch (error) {
      console.error("Error preparando destinatarios desde segmento", error);
      alert("No se pudo preparar el segmento/lista para la campaña.");
      setSegmentoSeleccionadoId("");
    } finally {
      setImportandoSegmento(false);
    }
  };

  const onCsvManualChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSegmentoSeleccionadoId("");
    onCsvChange(e);
  };

  const insertarVariableEnAsunto = (token: string) => {
    const input = asuntoInputRef.current;

    if (!input) {
      setAsunto(asunto ? `${asunto} ${token}` : token);
      return;
    }

    const inicio = input.selectionStart ?? asunto.length;
    const fin = input.selectionEnd ?? asunto.length;

    const nuevoAsunto = asunto.slice(0, inicio) + token + asunto.slice(fin);

    setAsunto(nuevoAsunto);

    window.setTimeout(() => {
      input.focus();
      const posicion = inicio + token.length;
      input.setSelectionRange(posicion, posicion);
    }, 0);
  };

  const insertarVariable = (token: string) => {
    if (ultimoCampoVariable === "asunto") {
      insertarVariableEnAsunto(token);
      return;
    }

    emailEditorRef.current?.insertarToken(token);
  };

  const onDropAsunto = (e: DragEvent<HTMLInputElement>) => {
    e.preventDefault();

    const token = e.dataTransfer.getData("text/plain");

    if (!token) return;

    setUltimoCampoVariable("asunto");
    insertarVariableEnAsunto(token);
  };

  const copiarTexto = async (texto: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copiado = document.execCommand("copy");
    textarea.remove();
    if (!copiado) throw new Error("No se pudo copiar al portapapeles");
  };

  const limpiarHtmlParaPrompt = (html: string) => {
    return (html || "")
      .replace(
        /<span\b[^>]*data-token=["']([^"']+)["'][^>]*>.*?<\/span>/gis,
        (_, token) => token,
      )
      .trim();
  };

  const construirContextoIa = (promptBase: string) => {
    const tags = VARIABLES.map(
      (variable) => `- ${variable.token} — ${variable.ayuda}`,
    ).join("\n");

    const destinatarios = segmentoSeleccionado
      ? `${segmentoSeleccionado.tipo === "estatico" ? "Lista" : "Segmento"}: ${segmentoSeleccionado.nombre} (${formatearNumero(segmentoSeleccionado.total_clientes)} clientes)`
      : csvFile
        ? `CSV: ${csvFile.name}${csvInfo ? ` (${formatearNumero(csvInfo.filas)} filas)` : ""}`
        : "Todavía no se han seleccionado destinatarios.";

    const columnasCsv = csvInfo?.cabeceras?.length
      ? csvInfo.cabeceras.join(", ")
      : "No disponibles todavía.";

    const adjuntos = [
      ...adjuntosGenericosSeleccionados,
      ...adjuntosUpload.map((file) => file.name),
    ];

    return `${promptBase.trim()}

=== REGLAS TÉCNICAS DE CRUZIAL ===
Los tags disponibles para personalización son exactamente estos:
${tags}

Escribe siempre los tags con este formato exacto: {{tag}}.
No uses corchetes, porcentajes, llaves simples ni variantes como {tag} o [tag].
No inventes tags fuera de la lista anterior.
Si entregas el cuerpo en HTML, devuelve HTML puro y sencillo: sin bloques de código Markdown, sin escapar los símbolos < >, y sin barras invertidas delante de etiquetas, dos puntos o arrobas. Debe poder pegarse directamente con el botón "Pegar HTML" de Cruzial.

=== CAMPAÑA ACTUAL ===
Nombre interno: ${nombreCampana.trim() || "(sin definir)"}
Remitente: ${remitente.trim() || "(sin definir)"}
Destinatarios: ${destinatarios}
Columnas detectadas en el CSV: ${columnasCsv}
Adjuntos: ${adjuntos.length ? adjuntos.join(", ") : "Ninguno"}

ASUNTO ACTUAL:
${asunto.trim() || "(vacío)"}

CUERPO ACTUAL (HTML):
${limpiarHtmlParaPrompt(htmlEditor) || "(vacío)"}

Trabaja sobre este contexto. Si propones un correo nuevo o una mejora, devuelve un asunto listo para copiar y un cuerpo listo para pegar en el editor de Cruzial, respetando los tags disponibles.`;
  };

  const handleCopiarContextoIa = async () => {
    setCopiandoContextoIa(true);
    try {
      const { prompt } = await configuracionService.promptIa();
      const contexto = construirContextoIa(prompt);
      await copiarTexto(contexto);
      await alert({
        title: "Contexto copiado",
        description: "Ya puedes pegarlo en la IA que quieras. Cruzial no ha enviado ningún dato fuera del equipo.",
        tone: "success",
      });
    } catch (error) {
      console.error("No se pudo copiar el contexto para IA", error);
      await alert({
        title: "No se pudo copiar",
        description: "Revisa que Cruzial pueda leer la configuración y que el navegador permita usar el portapapeles.",
        tone: "danger",
      });
    } finally {
      setCopiandoContextoIa(false);
    }
  };

  const toggleAdjuntoGenerico = (nombre: string) => {
    if (adjuntosGenericosSeleccionados.includes(nombre)) {
      setAdjuntosGenericosSeleccionados(
        adjuntosGenericosSeleccionados.filter((item) => item !== nombre),
      );
      return;
    }

    setAdjuntosGenericosSeleccionados([
      ...adjuntosGenericosSeleccionados,
      nombre,
    ]);
  };

  const onAdjuntosUploadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (!files.length) return;

    setAdjuntosUpload([...adjuntosUpload, ...files]);
  };

  const quitarAdjuntoUpload = (index: number) => {
    setAdjuntosUpload(adjuntosUpload.filter((_, i) => i !== index));
  };

  const limpiarAdjuntos = () => {
    setAdjuntosGenericosSeleccionados([]);
    setAdjuntosUpload([]);
  };

  const totalAdjuntos =
    adjuntosGenericosSeleccionados.length + adjuntosUpload.length;

  return (
    <Card className="col-span-12 xl:col-span-8 flex min-h-0 flex-col overflow-hidden rounded-sm">
      <CardHeader className="flex items-center justify-between gap-4 bg-[var(--app-surface-muted)] p-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--app-text)] flex items-center gap-2">
            <FileText className="text-blue-600" size={20} />
            {editandoCampanaId ? "Editar campaña existente" : "Nueva campaña"}
          </h2>

          <p className="text-sm text-[var(--app-text-muted)] mt-1">
            Redacta el email, pruébalo y añade adjuntos si hace falta.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          leftIcon={<ClipboardCopy size={15} />}
          onClick={handleCopiarContextoIa}
          isLoading={copiandoContextoIa}
          title="Copia un prompt con el correo actual, los tags y los destinatarios para pegarlo en una IA"
        >
          Copiar contexto IA
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-5 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Field label="Nombre interno" className="lg:col-span-2">
            <Input
              value={nombreCampana}
              onChange={(e) => setNombreCampana(e.target.value)}
              placeholder="Ej: Navidad colegios Cantabria"
              variant="compact"
            />
          </Field>

          <Field label="Remitente">
            <Input
              value={remitente}
              onChange={(e) => setRemitente(e.target.value)}
              variant="compact"
            />
          </Field>

          <Field label="Pausa entre emails">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={delaySegundos}
                min={0}
                max={600}
                onChange={(e) => setDelaySegundos(Number(e.target.value))}
                variant="compact"
              />

              <span className="text-sm text-[var(--app-text-muted)]">s</span>
            </div>
          </Field>
        </div>

        {!editandoCampanaId && (
          <div className="rounded-sm border border-blue-100 bg-blue-50/60 p-2.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex shrink-0 items-center gap-1.5 pr-1">
                <ListChecks size={15} className="text-blue-600" />
                <label className="text-xs font-medium uppercase text-blue-700">
                  Destinatarios
                </label>
              </div>

              <div className="relative min-w-[260px] flex-1">
                <Select
                  value={segmentoSeleccionadoId}
                  onChange={(e) =>
                    seleccionarSegmentoComoDestinatarios(e.target.value)
                  }
                  disabled={
                    cargandoSegmentos ||
                    importandoSegmento ||
                    segmentos.length === 0
                  }
                  variant="white"
                  className="h-9 border-blue-200 pr-9 font-semibold focus:ring-blue-500"
                >
                  <option value="">
                    {cargandoSegmentos
                      ? "Cargando..."
                      : segmentos.length === 0
                        ? "No hay listas/segmentos"
                        : "Selecciona lista o segmento"}
                  </option>

                  {segmentos.map((segmento) => (
                    <option key={segmento.id} value={segmento.id}>
                      {segmento.nombre} ·{" "}
                      {segmento.tipo === "estatico" ? "Lista" : "Segmento"}{" "}
                      · {formatearNumero(segmento.total_clientes)}
                    </option>
                  ))}
                </Select>

                {importandoSegmento && (
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-blue-600">
                    <Loader2 size={15} className="animate-spin" />
                  </div>
                )}
              </div>

              {segmentoSeleccionado && (
                <Badge
                  className={`h-8 shrink-0 justify-center border ${colorSegmento(
                    segmentoSeleccionado.color,
                  )}`}
                >
                  {segmentoSeleccionado.tipo === "estatico" ? (
                    <Users size={12} />
                  ) : (
                    <Database size={12} />
                  )}
                  {formatearNumero(segmentoSeleccionado.total_clientes)}
                </Badge>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onCsvManualChange}
                className="hidden"
              />

              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                size="xs"
                title="Subir CSV manual"
                leftIcon={<Upload size={13} />}
                className="h-8 shrink-0"
              >
                CSV
              </Button>

              <IconButton
                label="Recargar listas"
                onClick={cargarSegmentos}
                disabled={cargandoSegmentos || importandoSegmento}
                buttonSize="xs"
                className="shrink-0 hover:bg-[var(--app-surface-raised)]/80"
              >
                {cargandoSegmentos ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
              </IconButton>
            </div>

            {(errorSegmentos || csvFile) && (
              <div className="mt-1.5">
                {errorSegmentos ? (
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-600">
                    <AlertCircle size={12} />
                    {errorSegmentos}
                  </p>
                ) : csvFile ? (
                  <p className="truncate text-[11px] font-medium text-[var(--app-text-muted)]" title={csvFile.name}>
                    {csvInfo
                      ? `${csvInfo.filas} filas · ${csvFile.name}`
                      : csvFile.name}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}

        <div className="rounded-sm border border-blue-100 bg-blue-50/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase text-blue-700">
                Variables
              </p>
              <p className="text-xs text-blue-600/70">
                Arrástralas al asunto o al cuerpo. También puedes hacer click.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((variable) => (
              <Button
                key={variable.token}
                type="button"
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", variable.token)
                }
                onClick={() => insertarVariable(variable.token)}
                title={variable.ayuda}
                variant="outline"
                size="xs"
                leftIcon={<Tags size={13} />}
                className="rounded-full bg-[var(--app-surface-raised)] active:scale-[0.98]"
              >
                {variable.label}
              </Button>
            ))}
          </div>
        </div>

        <Field label="Asunto">
          <Input
            ref={asuntoInputRef}
            value={asunto}
            onFocus={() => setUltimoCampoVariable("asunto")}
            onChange={(e) => setAsunto(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropAsunto}
            placeholder="Ej: Propuesta para {{nombre}}"
            variant="compact"
            className="font-medium"
          />
        </Field>

        <EmailEditor
          ref={emailEditorRef}
          asunto={asunto}
          remitente={remitente}
          html={htmlEditor}
          onHtmlChange={setHtmlEditor}
          onEditorFocus={() => setUltimoCampoVariable("cuerpo")}
        />

        <div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-sm overflow-hidden">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[var(--app-surface-muted)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Paperclip size={18} className="text-blue-600" />

                <div>
                  <h3 className="font-medium text-[var(--app-text)]">Adjuntos</h3>
                  <p className="text-xs text-[var(--app-text-muted)]">
                    {totalAdjuntos
                      ? `${totalAdjuntos} archivo(s) seleccionados`
                      : "Sin adjuntos seleccionados"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {totalAdjuntos > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      limpiarAdjuntos();
                    }}
                    className="inline-flex items-center gap-1 rounded-sm border border-red-100 bg-[var(--app-surface-raised)] px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                    Limpiar
                  </button>
                )}

                <ChevronDown size={18} className="text-[var(--app-text-subtle)]" />
              </div>
            </summary>

            <div className="grid grid-cols-1 gap-4 border-t border-gray-100 p-4 xl:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-xs font-medium uppercase text-[var(--app-text-muted)]">
                    Adjuntos genéricos
                  </label>

                  <button
                    type="button"
                    onClick={onRecargarAdjuntos}
                    className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-[var(--app-text-muted)] hover:bg-gray-100"
                  >
                    <RefreshCw size={13} />
                    Recargar
                  </button>
                </div>

                <div className="max-h-[190px] overflow-y-auto rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2">
                  {cargandoAdjuntos ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-[var(--app-text-subtle)]">
                      <Loader2 size={15} className="animate-spin" />
                      Cargando...
                    </div>
                  ) : adjuntosDisponibles.length === 0 ? (
                    <p className="p-2 text-sm text-[var(--app-text-subtle)]">
                      No hay archivos en adjuntos_genericos.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {adjuntosDisponibles.map((adjunto) => {
                        const seleccionado =
                          adjuntosGenericosSeleccionados.includes(
                            adjunto.nombre,
                          );

                        return (
                          <label
                            key={adjunto.nombre}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-sm bg-[var(--app-surface-raised)] px-2 py-1.5 text-sm hover:bg-blue-50"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={seleccionado}
                                onChange={() =>
                                  toggleAdjuntoGenerico(adjunto.nombre)
                                }
                              />
                              <span className="truncate font-medium text-[var(--app-text-muted)]">
                                {adjunto.nombre}
                              </span>
                            </span>

                            <span className="shrink-0 text-xs text-[var(--app-text-subtle)]">
                              {formatoPeso(adjunto.size_bytes)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-xs font-medium uppercase text-[var(--app-text-muted)]">
                    Archivos del equipo
                  </label>

                  <button
                    type="button"
                    onClick={() => adjuntosInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    <FileUp size={13} />
                    Añadir archivos
                  </button>
                </div>

                <input
                  ref={adjuntosInputRef}
                  type="file"
                  multiple
                  onChange={onAdjuntosUploadChange}
                  className="hidden"
                />

                <div className="max-h-[190px] overflow-y-auto rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2">
                  {adjuntosUpload.length === 0 ? (
                    <p className="p-2 text-sm text-[var(--app-text-subtle)]">
                      Ningún archivo añadido.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {adjuntosUpload.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-sm bg-[var(--app-surface-raised)] px-2 py-1.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--app-text-muted)]">
                              {file.name}
                            </p>
                            <p className="text-xs text-[var(--app-text-subtle)]">
                              {formatoPeso(file.size)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => quitarAdjuntoUpload(index)}
                            className="rounded-sm p-1 text-[var(--app-text-subtle)] hover:bg-red-50 hover:text-red-600"
                            title="Quitar"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-[var(--app-surface-muted)] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <TestTube2 size={18} className="text-emerald-600" />

              <div>
                <h3 className="font-medium text-[var(--app-text)]">Correo de prueba</h3>
                <p className="text-xs text-[var(--app-text-muted)]">
                  Envía una prueba con el contenido actual.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                type="email"
                value={emailPrueba}
                onChange={(e) => setEmailPrueba(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="h-9 min-w-[260px] rounded-sm border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <button
                type="button"
                onClick={onEnviarPrueba}
                disabled={enviandoPrueba}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-sm bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {enviandoPrueba ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Enviar prueba
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-xs text-[var(--app-text-muted)]">
            {editandoCampanaId ? (
              <>
                Editando campaña existente. Para crear una copia nueva, primero
                pulsa <strong>Duplicar como nueva</strong>.
              </>
            ) : (
              <>
                Para crear una campaña nueva elige una{" "}
                <strong>lista/segmento</strong> o, como alternativa, sube un CSV
                manual.
              </>
            )}
          </div>

          <div className="flex gap-2">
            {editandoCampanaId ? (
              <>
                <Button
                  type="button"
                  onClick={onDuplicarComoNueva}
                  disabled={guardandoEdicion || creando}
                  size="lg"
                  leftIcon={<FileText size={18} />}
                >
                  Duplicar como nueva
                </Button>

                <Button
                  type="button"
                  onClick={onGuardarCambios}
                  disabled={guardandoEdicion || creando}
                  variant="primaryGradient"
                  size="lg"
                  leftIcon={guardandoEdicion ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                >
                  Guardar cambios
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={onCrearBorrador}
                  disabled={creando || importandoSegmento}
                  size="lg"
                  leftIcon={creando ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                >
                  Crear borrador
                </Button>

                <Button
                  type="button"
                  onClick={onCrearYLanzar}
                  disabled={creando || importandoSegmento}
                  variant="primary"
                  size="lg"
                  leftIcon={creando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                >
                  Crear y lanzar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}