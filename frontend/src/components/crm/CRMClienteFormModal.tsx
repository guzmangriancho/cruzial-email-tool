import { useEffect, useMemo, useState } from "react";
import { Info, MapPin, Save, UserPlus, Wand2 } from "lucide-react";
import { Button, Field, Input, Modal } from "../ui";
import type {
	Cliente,
	ClienteFormMode,
	ClienteFormSubmitOptions,
	ClienteUpsertPayload,
} from "../../types/crm";

interface CRMClienteFormModalProps {
	abierto: boolean;
	modo: ClienteFormMode;
	cliente: Cliente | null;
	guardando: boolean;
	onClose: () => void;
	onSubmit: (
		payload: ClienteUpsertPayload,
		options: ClienteFormSubmitOptions,
	) => Promise<void> | void;
}

interface FormState {
	nombre: string;
	email: string;
	telefono: string;
	sitio_web: string;
	direccion: string;
	ciudad: string;
	sector: string;
	categoria_google: string;
	url_maps: string;
	latitud: string;
	longitud: string;
	valoracion: string;
	num_resenas: string;
	enriquecerAutomaticamente: boolean;
}

const emptyForm: FormState = {
	nombre: "",
	email: "",
	telefono: "",
	sitio_web: "",
	direccion: "",
	ciudad: "",
	sector: "",
	categoria_google: "",
	url_maps: "",
	latitud: "",
	longitud: "",
	valoracion: "",
	num_resenas: "",
	enriquecerAutomaticamente: true,
};

function toInput(value: string | number | null | undefined): string {
	return value === null || value === undefined ? "" : String(value);
}

function trimOrNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function parseNullableNumber(value: string): number | null {
	const trimmed = value.trim().replace(",", ".");
	if (!trimmed) return null;

	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableInteger(value: string): number | null {
	const parsed = parseNullableNumber(value);
	return parsed === null ? null : Math.trunc(parsed);
}

function buildInitialForm(cliente: Cliente | null, modo: ClienteFormMode): FormState {
	if (!cliente) {
		return {
			...emptyForm,
			enriquecerAutomaticamente: modo === "crear",
		};
	}

	return {
		nombre: toInput(cliente.nombre),
		email: toInput(cliente.email),
		telefono: toInput(cliente.telefono),
		sitio_web: toInput(cliente.sitio_web),
		direccion: toInput(cliente.direccion),
		ciudad: toInput(cliente.ciudad),
		sector: toInput(cliente.sector),
		categoria_google: toInput(cliente.categoria_google),
		url_maps: toInput(cliente.url_maps),
		latitud: toInput(cliente.latitud),
		longitud: toInput(cliente.longitud),
		valoracion: toInput(cliente.valoracion),
		num_resenas: toInput(cliente.num_resenas),
		enriquecerAutomaticamente: false,
	};
}

function hasAnyData(payload: ClienteUpsertPayload): boolean {
	return Object.values(payload).some((value) => value !== null && value !== undefined && value !== "");
}

export default function CRMClienteFormModal({
	abierto,
	modo,
	cliente,
	guardando,
	onClose,
	onSubmit,
}: CRMClienteFormModalProps) {
	const [form, setForm] = useState<FormState>(() => buildInitialForm(cliente, modo));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!abierto) return;

		setForm(buildInitialForm(cliente, modo));
		setError(null);
	}, [abierto, cliente, modo]);

	const titulo = modo === "crear" ? "Añadir cliente" : "Editar cliente";
	const subtitulo =
		modo === "crear"
			? "Puedes pegar solo la ficha de Google Maps y enriquecer después, o rellenar la ficha completa manualmente."
			: "Modifica cualquier campo. También puedes volver a enriquecerlo automáticamente después de guardar.";

	const payload = useMemo<ClienteUpsertPayload>(() => {
		const sector = trimOrNull(form.sector);
		const categoriaGoogle = trimOrNull(form.categoria_google) || sector;

		return {
			nombre: trimOrNull(form.nombre),
			email: trimOrNull(form.email)?.toLowerCase() || null,
			telefono: trimOrNull(form.telefono),
			sitio_web: trimOrNull(form.sitio_web),
			direccion: trimOrNull(form.direccion),
			ciudad: trimOrNull(form.ciudad),
			sector,
			categoria_google: categoriaGoogle,
			url_maps: trimOrNull(form.url_maps),
			latitud: parseNullableNumber(form.latitud),
			longitud: parseNullableNumber(form.longitud),
			valoracion: parseNullableNumber(form.valoracion),
			num_resenas: parseNullableInteger(form.num_resenas),
		};
	}, [form]);

	const updateField = (field: keyof FormState, value: string | boolean) => {
		setForm((prev) => ({ ...prev, [field]: value }));
		setError(null);
	};

	const handleSubmit = async () => {
		if (!hasAnyData(payload)) {
			setError("Rellena al menos un dato del cliente o pega la ficha de Google Maps.");
			return;
		}

		if (form.latitud.trim() && payload.latitud === null) {
			setError("La latitud no es válida.");
			return;
		}

		if (form.longitud.trim() && payload.longitud === null) {
			setError("La longitud no es válida.");
			return;
		}

		if (form.valoracion.trim() && payload.valoracion === null) {
			setError("La valoración no es válida.");
			return;
		}

		if (form.num_resenas.trim() && payload.num_resenas === null) {
			setError("El número de reseñas no es válido.");
			return;
		}

		await onSubmit(payload, {
			enriquecerAutomaticamente: form.enriquecerAutomaticamente,
		});
	};

	return (
		<Modal
			open={abierto}
			onClose={onClose}
			closeDisabled={guardando}
			size="xl"
			title={titulo}
			description={subtitulo}
			icon={modo === "crear" ? <UserPlus size={22} /> : <Save size={22} />}
			footer={
				<>
					<Button variant="secondary" size="lg" onClick={onClose} disabled={guardando}>
						Cancelar
					</Button>

					<Button
						variant="primaryGradient"
						size="lg"
						onClick={handleSubmit}
						isLoading={guardando}
						leftIcon={<Save size={18} />}
					>
						{guardando ? "Guardando..." : modo === "crear" ? "Crear cliente" : "Guardar cambios"}
					</Button>
				</>
			}
		>
			<div className="mb-5 rounded-sm border border-green-200 bg-green-50 p-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end">
					<Field
						className="flex-1"
						label={
							<span className="flex items-center gap-2 text-green-700">
								<MapPin size={14} /> Ficha de Google Maps
							</span>
						}
					>
						<Input
							type="url"
							variant="white"
							value={form.url_maps}
							onChange={(event) => updateField("url_maps", event.target.value)}
							placeholder="Pega aquí la URL de Google Maps"
							className="border-green-200 focus:border-green-400 focus:ring-green-100"
						/>
					</Field>

					<label className="flex min-w-[260px] cursor-pointer items-start gap-3 rounded-sm border border-green-200 bg-[var(--app-surface-raised)] px-4 py-3 text-sm font-semibold text-green-800 shadow-sm">
						<input
							type="checkbox"
							checked={form.enriquecerAutomaticamente}
							onChange={(event) =>
								updateField("enriquecerAutomaticamente", event.target.checked)
							}
							className="mt-0.5 h-4 w-4 rounded border-green-300 text-green-600"
						/>

						<span>
							<span className="flex items-center gap-2">
								<Wand2 size={16} /> Enriquecer al guardar
							</span>
							<span className="mt-1 block text-xs font-medium text-green-600">
								Útil cuando solo pegas la ficha de Maps.
							</span>
						</span>
					</label>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				<Field label="Nombre">
					<Input
						variant="white"
						value={form.nombre}
						onChange={(event) => updateField("nombre", event.target.value)}
						placeholder="Nombre del negocio"
					/>
				</Field>

				<Field label="Email">
					<Input
						type="email"
						variant="white"
						value={form.email}
						onChange={(event) => updateField("email", event.target.value)}
						placeholder="correo@empresa.com"
					/>
				</Field>

				<Field label="Teléfono">
					<Input
						variant="white"
						value={form.telefono}
						onChange={(event) => updateField("telefono", event.target.value)}
						placeholder="+34..."
					/>
				</Field>

				<Field label="Sitio web">
					<Input
						type="url"
						variant="white"
						value={form.sitio_web}
						onChange={(event) => updateField("sitio_web", event.target.value)}
						placeholder="https://..."
					/>
				</Field>

				<Field label="Ciudad">
					<Input
						variant="white"
						value={form.ciudad}
						onChange={(event) => updateField("ciudad", event.target.value)}
						placeholder="Madrid"
					/>
				</Field>

				<Field label="Dirección">
					<Input
						variant="white"
						value={form.direccion}
						onChange={(event) => updateField("direccion", event.target.value)}
						placeholder="Calle, número..."
					/>
				</Field>

				<Field label="Sector">
					<Input
						variant="white"
						value={form.sector}
						onChange={(event) => updateField("sector", event.target.value)}
						placeholder="Restaurante, clínica..."
					/>
				</Field>

				<Field label="Categoría Google">
					<Input
						variant="white"
						value={form.categoria_google}
						onChange={(event) => updateField("categoria_google", event.target.value)}
						placeholder="Si se deja vacío usa el sector"
					/>
				</Field>

				<Field label="Valoración">
					<Input
						variant="white"
						value={form.valoracion}
						onChange={(event) => updateField("valoracion", event.target.value)}
						placeholder="4.5"
					/>
				</Field>

				<Field label="Nº reseñas">
					<Input
						variant="white"
						value={form.num_resenas}
						onChange={(event) => updateField("num_resenas", event.target.value)}
						placeholder="120"
					/>
				</Field>

				<Field label="Latitud">
					<Input
						variant="white"
						value={form.latitud}
						onChange={(event) => updateField("latitud", event.target.value)}
						placeholder="40.4168"
					/>
				</Field>

				<Field label="Longitud">
					<Input
						variant="white"
						value={form.longitud}
						onChange={(event) => updateField("longitud", event.target.value)}
						placeholder="-3.7038"
					/>
				</Field>
			</div>

			<div className="mt-5 flex items-start gap-2 rounded-sm border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
				<Info size={17} className="mt-0.5 shrink-0" />
				<p>
					Para un alta rápida, pega solo la ficha de Google Maps y deja activo el enriquecimiento.
					Para una ficha manual completa, rellena los datos y desactívalo.
				</p>
			</div>

			{error && (
				<div className="mt-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
					{error}
				</div>
			)}
		</Modal>
	);
}
