import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type DragEvent,
	type ReactNode,
} from "react";

import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	ClipboardPaste,
	Eraser,
	Eye,
	FileText,
	Heading2,
	Italic,
	Link2,
	List,
	ListOrdered,
	Mail,
	Quote,
	Redo2,
	Underline,
	Undo2,
} from "lucide-react";

import { sanitizarHtmlBasico } from "../../utils/campanasUtils";
import { configuracionService } from "../../services/configuracionService";
import { Button, Card } from "../ui";
import { sanitizeHtml } from "../../utils/sanitizeHtml";

interface EmailEditorProps {
	asunto: string;
	remitente: string;
	html: string;
	onHtmlChange: (html: string) => void;
	onEditorFocus?: () => void;
}

export interface EmailEditorHandle {
	insertarToken: (token: string) => void;
	focus: () => void;
}

const VALORES_PREVIEW: Record<string, string> = {
	nombre: "Empresa Demo",
	nombre_empresa: "Empresa Demo",
	empresa: "Empresa Demo",
	ciudad: "Santander",
	sector: "Comercio",
	email: "cliente@ejemplo.com",
	correo: "cliente@ejemplo.com",
	telefono: "942 000 000",
	sitio_web: "www.ejemplo.com",
	web: "www.ejemplo.com",
	direccion: "Calle Ejemplo 123",
};

function escaparHtml(texto: string) {
	return texto
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}


function decodificarEntidadesHtml(texto: string) {
	const textarea = document.createElement("textarea");
	textarea.innerHTML = texto;
	return textarea.value;
}

function normalizarHtmlPegado(valor: string) {
	let texto = (valor || "").trim();

	// Gemini/ChatGPT pueden copiar el bloque con fences Markdown.
	texto = texto
		.replace(/^```(?:html)?\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();

	// Corrige escapes Markdown frecuentes: \<p>, mailto\:, correo\@dominio...
	texto = texto.replace(/\\([<>@:{}()*_#`])/g, "$1");

	// Si llegó como HTML escapado (&lt;p&gt;...), lo decodificamos una vez.
	if (!/<\/?[a-z][^>]*>/i.test(texto) && /&lt;\/?[a-z]/i.test(texto)) {
		texto = decodificarEntidadesHtml(texto);
	}

	return sanitizeHtml(texto).trim();
}

function quitarSpansDeToken(html: string) {
	return html.replace(
		/<span\b[^>]*data-token=["']([^"']+)["'][^>]*>.*?<\/span>/gis,
		(_, token) => token,
	);
}

function renderizarVariablesPreview(texto: string) {
	if (!texto) return "";

	return texto.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, nombreVariable) => {
		const clave = String(nombreVariable || "")
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_");

		return escaparHtml(VALORES_PREVIEW[clave] || "");
	});
}

function editorVacio(html: string) {
	const texto = html
		.replace(/<style[^>]*>.*?<\/style>/gis, "")
		.replace(/<script[^>]*>.*?<\/script>/gis, "")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.trim();

	return !texto;
}

function ToolbarButton({
	children,
	title,
	onClick,
}: {
	children: ReactNode;
	title: string;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			title={title}
			size="xs"
			variant="secondary"
			onMouseDown={(e) => {
				e.preventDefault();
				onClick();
			}}
			className="h-8 min-w-8 rounded-sm px-2 text-[var(--app-text-muted)] hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98]"
		>
			{children}
		</Button>
	);
}

function ToolbarDivider() {
	return <div className="mx-1 h-6 w-px bg-gray-200" />;
}

export const EmailEditor = forwardRef<EmailEditorHandle, EmailEditorProps>(
	function EmailEditor({ asunto, remitente, html, onHtmlChange, onEditorFocus }, ref) {
		const [modoCuerpo, setModoCuerpo] = useState<"editar" | "preview">(
			"editar",
		);
		const [estadoPegadoHtml, setEstadoPegadoHtml] = useState<string | null>(null);
		const [firmaHtml, setFirmaHtml] = useState<string>("");

		const editorRef = useRef<HTMLDivElement>(null);
		const savedRangeRef = useRef<Range | null>(null);

		const htmlPreview = useMemo(() => {
			const htmlSeguro = sanitizarHtmlBasico(html);
			const sinSpansToken = quitarSpansDeToken(htmlSeguro);
			return renderizarVariablesPreview(sinSpansToken);
		}, [html]);

		const asuntoPreview = useMemo(() => {
			return renderizarVariablesPreview(asunto) || "Sin asunto";
		}, [asunto]);

		useEffect(() => {
			let activo = true;

			configuracionService
				.firmaEmail()
				.then((firma) => {
					if (activo) setFirmaHtml(firma.signature_html || "");
				})
				.catch((error) => {
					console.warn("No se pudo cargar la firma para la vista previa", error);
					if (activo) setFirmaHtml("");
				});

			return () => {
				activo = false;
			};
		}, []);

		const firmaPreview = useMemo(() => {
			if (!firmaHtml.trim()) return "";

			const apiOrigin =
				typeof window !== "undefined" && window.location.port !== "5173"
					? window.location.origin
					: "http://127.0.0.1:8000";

			return firmaHtml
				.replace(/\{\{nombre_remitente\}\}/g, remitente || "Remitente")
				.replace(
					/<img([^>]*?)src=["']cid:firmaLogo["']([^>]*)>/gi,
					`<img$1src="${apiOrigin}/api/campanas/logo-firma" width="200"$2>`,
				)
				.replace(/cid:firmaLogo/g, `${apiOrigin}/api/campanas/logo-firma`);
		}, [firmaHtml, remitente]);

		useEffect(() => {
			if (modoCuerpo !== "editar") return;

			const editor = editorRef.current;
			if (!editor) return;

			if (editor.innerHTML !== (html || "")) {
				editor.innerHTML = html || "";
			}
		}, [html, modoCuerpo]);

		const guardarSeleccion = () => {
			const selection = window.getSelection();
			const editor = editorRef.current;

			if (!selection || selection.rangeCount === 0 || !editor) return;

			const range = selection.getRangeAt(0);

			if (editor.contains(range.commonAncestorContainer)) {
				savedRangeRef.current = range.cloneRange();
			}
		};

		const restaurarSeleccion = () => {
			const editor = editorRef.current;
			const range = savedRangeRef.current;

			if (!editor) return;

			editor.focus();

			if (!range) return;

			const selection = window.getSelection();
			if (!selection) return;

			selection.removeAllRanges();
			selection.addRange(range);
		};

		const emitirHtmlActual = () => {
			const editor = editorRef.current;
			if (!editor) return;

			onHtmlChange(editor.innerHTML);
			guardarSeleccion();
		};

		const asegurarEdicion = (callback: () => void) => {
			if (modoCuerpo === "editar") {
				callback();
				return;
			}

			setModoCuerpo("editar");

			window.setTimeout(() => {
				callback();
			}, 0);
		};

		const insertarHtmlEnSeleccion = (htmlAInsertar: string) => {
			restaurarSeleccion();

			try {
				document.execCommand("insertHTML", false, htmlAInsertar);
			} catch {
				const selection = window.getSelection();

				if (!selection || selection.rangeCount === 0) return;

				const range = selection.getRangeAt(0);
				range.deleteContents();

				const fragment = range.createContextualFragment(htmlAInsertar);
				range.insertNode(fragment);
			}

			emitirHtmlActual();
		};

		const insertarToken = (token: string) => {
			asegurarEdicion(() => {
				const htmlToken = `
					<span
						data-token="${token}"
						contenteditable="false"
						class="inline-flex items-center rounded-sm bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium"
						style="display:inline-block;border-radius:999px;background:#dbeafe;color:#1d4ed8;padding:2px 8px;font-size:12px;font-weight:700;"
					>${token}</span>&nbsp;
				`;

				insertarHtmlEnSeleccion(htmlToken);
			});
		};

		useImperativeHandle(ref, () => ({
			insertarToken,
			focus: () => {
				setModoCuerpo("editar");

				window.setTimeout(() => {
					editorRef.current?.focus();
					guardarSeleccion();
				}, 0);
			},
		}));

		const aplicarComando = (
			comando: string,
			valor: string | undefined = undefined,
		) => {
			asegurarEdicion(() => {
				restaurarSeleccion();

				try {
					document.execCommand("styleWithCSS", false, "false");
					document.execCommand(comando, false, valor);
				} catch (error) {
					console.error(`No se pudo aplicar ${comando}`, error);
				}

				emitirHtmlActual();
			});
		};

		const aplicarFormatoBloque = (tag: "p" | "h2" | "blockquote") => {
			aplicarComando("formatBlock", tag);
		};

		const insertarLista = (tipo: "ul" | "ol") => {
			asegurarEdicion(() => {
				restaurarSeleccion();

				const selection = window.getSelection();
				const textoSeleccionado =
					selection && selection.rangeCount > 0
						? selection.toString().trim()
						: "";

				const items = textoSeleccionado
					? textoSeleccionado
							.split(/\n+/)
							.map((item) => item.trim())
							.filter(Boolean)
					: ["Elemento de la lista"];

				const htmlLista = `
					<${tipo}>
						${items.map((item) => `<li>${escaparHtml(item)}</li>`).join("")}
					</${tipo}>
					<p><br></p>
				`;

				insertarHtmlEnSeleccion(htmlLista);
			});
		};

		const insertarLink = () => {
			const url = window.prompt("URL del enlace:");

			if (!url?.trim()) return;

			const limpia = url.trim();
			const final = /^(https?:\/\/|mailto:|tel:)/i.test(limpia)
				? limpia
				: `https://${limpia}`;

			aplicarComando("createLink", final);
		};

		const prepararEditorDrop = (e: DragEvent<HTMLDivElement>) => {
			e.preventDefault();

			const token = e.dataTransfer.getData("text/plain");

			if (token) {
				insertarToken(token);
			}
		};

		const aplicarHtmlPegado = (valor: string) => {
			const limpio = normalizarHtmlPegado(valor);

			if (!limpio || !/<\/?[a-z][^>]*>/i.test(limpio)) {
				setEstadoPegadoHtml("No se detectó HTML válido en el portapapeles.");
				return false;
			}

			setModoCuerpo("editar");
			onHtmlChange(limpio);
			setEstadoPegadoHtml("HTML pegado y limpiado correctamente.");

			window.setTimeout(() => {
				const editor = editorRef.current;
				if (!editor) return;
				editor.innerHTML = limpio;
				editor.focus();
				guardarSeleccion();
			}, 0);

			window.setTimeout(() => setEstadoPegadoHtml(null), 3500);
			return true;
		};

		const pegarHtmlDesdePortapapeles = async () => {
			try {
				if (!navigator.clipboard?.readText) {
					throw new Error("Clipboard API no disponible");
				}

				const valor = await navigator.clipboard.readText();
				if (aplicarHtmlPegado(valor)) return;
			} catch (error) {
				console.warn("No se pudo leer el portapapeles directamente", error);
			}

			const manual = window.prompt(
				"No se pudo leer el portapapeles automáticamente. Pega aquí el HTML y pulsa Aceptar:",
				"",
			);

			if (manual !== null) aplicarHtmlPegado(manual);
		};

		const irAPreview = () => {
			emitirHtmlActual();
			setModoCuerpo("preview");
		};

		const irAEditar = () => {
			setModoCuerpo("editar");

			window.setTimeout(() => {
				editorRef.current?.focus();
				guardarSeleccion();
			}, 0);
		};

		if (modoCuerpo === "preview") {
			return (
				<Card className="overflow-hidden rounded-sm">
					<div className="rounded-sm bg-[#f3f4f6] p-4 md:p-6">
						<div className="mx-auto mb-3 flex max-w-[760px] justify-end">
							<Button
								type="button"
								onClick={irAEditar}
								size="sm"
								variant="secondary"
								leftIcon={<FileText size={16} />}
							>
								Volver a editar
							</Button>
						</div>

						<div className="mx-auto max-w-[760px] overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-lg">
							<div className="border-b border-gray-100 bg-[var(--app-surface-raised)] px-6 py-5">
								<p className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-subtle)]">
									Asunto
								</p>
								<h3 className="mt-1 text-xl font-semibold text-[var(--app-text)]">
									{asuntoPreview}
								</h3>
								<div className="mt-4 space-y-1 text-sm text-[var(--app-text-muted)]">
									<p>
										<span className="font-medium text-[var(--app-text-subtle)]">De:</span>{" "}
										{remitente || "Remitente"}
									</p>
									<p>
										<span className="font-medium text-[var(--app-text-subtle)]">Para:</span>{" "}
										Empresa Demo &lt;cliente@ejemplo.com&gt;
									</p>
								</div>
							</div>

							<div className="bg-[var(--app-surface-raised)] px-6 py-7 md:px-8 md:py-8">
								<div className="max-w-[640px] font-sans text-[14px] leading-[1.65] text-[#333]">
									{editorVacio(htmlPreview) ? (
										<div className="rounded-sm border border-dashed border-gray-300 bg-[var(--app-surface-muted)] px-5 py-10 text-center text-[var(--app-text-subtle)]">
											<FileText className="mx-auto mb-3" />
											<p className="font-semibold">Sin contenido todavía</p>
										</div>
									) : (
										<div
											className="email-preview-body"
											dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlPreview) }}
										/>
									)}

									{firmaPreview && (
										<div
											className="email-preview-signature"
											dangerouslySetInnerHTML={{ __html: sanitizeHtml(firmaPreview) }}
										/>
									)}
								</div>
							</div>

							<div className="border-t border-gray-100 bg-[var(--app-surface-muted)] px-6 py-3 text-xs text-[var(--app-text-subtle)]">
								Vista previa con datos de ejemplo. El envío real usará cada cliente del CSV.
							</div>
						</div>
					</div>
				</Card>
			);
		}

		return (
			<Card className="overflow-hidden rounded-sm">
				<div className="border-b border-gray-100 bg-[var(--app-surface-muted)] px-4 py-3">
					<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<div>
							<h3 className="font-medium text-[var(--app-text)] flex items-center gap-2">
								<Mail size={18} className="text-blue-600" />
								Cuerpo del email
							</h3>

							<p className="text-xs text-[var(--app-text-muted)] mt-1">
								Escribe el mensaje y revisa cómo se verá con datos de ejemplo.
							</p>
						</div>

						<div className="inline-flex rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-1 shadow-sm w-fit">
							<Button
								type="button"
								onClick={irAEditar}
								size="sm"
								variant="primary"
								leftIcon={<FileText size={16} />}
								className="rounded-sm"
							>
								Editar
							</Button>

							<Button
								type="button"
								onClick={irAPreview}
								size="sm"
								variant="ghost"
								leftIcon={<Eye size={16} />}
								className="rounded-sm"
							>
								Vista previa
							</Button>
						</div>
					</div>
				</div>

				{modoCuerpo === "editar" && (
					<div className="border-b border-[var(--app-border)] bg-[var(--app-surface-raised)] px-4 py-3">
						<div className="flex flex-wrap items-center gap-1.5">
							<ToolbarButton
								title="Deshacer"
								onClick={() => aplicarComando("undo")}
							>
								<Undo2 size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Rehacer"
								onClick={() => aplicarComando("redo")}
							>
								<Redo2 size={15} />
							</ToolbarButton>

							<ToolbarDivider />

							<Button
								type="button"
								size="xs"
								variant="secondary"
								leftIcon={<ClipboardPaste size={15} />}
								onClick={() => void pegarHtmlDesdePortapapeles()}
								title="Pega HTML crudo desde el portapapeles, corrige escapes y sustituye el cuerpo actual"
								className="h-8 rounded-sm px-2"
							>
								Pegar HTML
							</Button>

							<ToolbarDivider />

							<ToolbarButton
								title="Negrita"
								onClick={() => aplicarComando("bold")}
							>
								<Bold size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Cursiva"
								onClick={() => aplicarComando("italic")}
							>
								<Italic size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Subrayado"
								onClick={() => aplicarComando("underline")}
							>
								<Underline size={15} />
							</ToolbarButton>

							<ToolbarDivider />

							<ToolbarButton
								title="Párrafo"
								onClick={() => aplicarFormatoBloque("p")}
							>
								<span className="text-xs font-semibold">P</span>
							</ToolbarButton>

							<ToolbarButton
								title="Título"
								onClick={() => aplicarFormatoBloque("h2")}
							>
								<Heading2 size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Cita"
								onClick={() => aplicarFormatoBloque("blockquote")}
							>
								<Quote size={15} />
							</ToolbarButton>

							<ToolbarDivider />

							<ToolbarButton title="Lista" onClick={() => insertarLista("ul")}>
								<List size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Lista numerada"
								onClick={() => insertarLista("ol")}
							>
								<ListOrdered size={15} />
							</ToolbarButton>

							<ToolbarDivider />

							<ToolbarButton
								title="Alinear izquierda"
								onClick={() => aplicarComando("justifyLeft")}
							>
								<AlignLeft size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Centrar"
								onClick={() => aplicarComando("justifyCenter")}
							>
								<AlignCenter size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Alinear derecha"
								onClick={() => aplicarComando("justifyRight")}
							>
								<AlignRight size={15} />
							</ToolbarButton>

							<ToolbarDivider />

							<ToolbarButton title="Insertar enlace" onClick={insertarLink}>
								<Link2 size={15} />
							</ToolbarButton>

							<ToolbarButton
								title="Quitar formato"
								onClick={() => aplicarComando("removeFormat")}
							>
								<Eraser size={15} />
							</ToolbarButton>
						</div>

						{estadoPegadoHtml && (
							<p className="mt-2 text-xs text-[var(--app-text-muted)]">
								{estadoPegadoHtml}
							</p>
						)}
					</div>
				)}

				<div className="p-4">
					{modoCuerpo === "editar" ? (
						<div
							ref={editorRef}
							contentEditable
							suppressContentEditableWarning
							onInput={emitirHtmlActual}
							onBlur={guardarSeleccion}
							onKeyUp={guardarSeleccion}
							onMouseUp={guardarSeleccion}
							onFocus={() => {
								onEditorFocus?.();
								guardarSeleccion();
							}}
							onDragOver={(e) => e.preventDefault()}
							onDrop={prepararEditorDrop}
							className="email-editor-content min-h-[420px] rounded-sm border border-gray-300 bg-[var(--app-surface-raised)] px-6 py-5 text-[15px] leading-7 text-[var(--app-text)] shadow-inner outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
						/>
					) : (
						<div className="rounded-sm border border-[var(--app-border)] bg-[#f3f4f6] p-4 md:p-6">
							<div className="mx-auto max-w-[760px] overflow-hidden rounded-sm bg-[var(--app-surface-raised)] shadow-lg border border-[var(--app-border)]">
								<div className="border-b border-gray-100 bg-[var(--app-surface-raised)] px-6 py-5">
									<p className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-subtle)]">
										Asunto
									</p>

									<h3 className="mt-1 text-xl font-semibold text-[var(--app-text)]">
										{asuntoPreview}
									</h3>

									<div className="mt-4 space-y-1 text-sm text-[var(--app-text-muted)]">
										<p>
											<span className="font-medium text-[var(--app-text-subtle)]">De:</span>{" "}
											{remitente || "Remitente"}
										</p>
										<p>
											<span className="font-medium text-[var(--app-text-subtle)]">Para:</span>{" "}
											Empresa Demo &lt;cliente@ejemplo.com&gt;
										</p>
									</div>
								</div>

								<div className="bg-[var(--app-surface-raised)] px-6 py-7 md:px-8 md:py-8">
									<div className="max-w-[640px] text-[14px] leading-[1.65] text-[#333] font-sans">
										{editorVacio(htmlPreview) ? (
											<div className="rounded-sm border border-dashed border-gray-300 bg-[var(--app-surface-muted)] px-5 py-10 text-center text-[var(--app-text-subtle)]">
												<FileText className="mx-auto mb-3" />
												<p className="font-semibold">Sin contenido todavía</p>
											</div>
										) : (
											<div
												className="email-preview-body"
												dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlPreview) }}
											/>
										)}

										{firmaPreview && (
											<div
												className="email-preview-signature"
												dangerouslySetInnerHTML={{ __html: sanitizeHtml(firmaPreview) }}
											/>
										)}
									</div>
								</div>

								<div className="border-t border-gray-100 bg-[var(--app-surface-muted)] px-6 py-3 text-xs text-[var(--app-text-subtle)]">
									Vista previa con datos de ejemplo. El envío real usará cada
									cliente del CSV.
								</div>
							</div>
						</div>
					)}
				</div>
			</Card>
		);
	},
);
