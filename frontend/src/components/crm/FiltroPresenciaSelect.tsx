import { Field, Select, cx } from "../ui";
import type { FiltroPresencia } from "../../types/crm";

interface FiltroPresenciaSelectProps {
	label: string;
	value: FiltroPresencia;
	onChange: (value: FiltroPresencia) => void;
	conLabel?: string;
	sinLabel?: string;
}

export default function FiltroPresenciaSelect({
	label,
	value,
	onChange,
	conLabel,
	sinLabel,
}: FiltroPresenciaSelectProps) {
	const labelLower = label.toLowerCase();

	return (
		<Field label={label} className="w-44">
			<Select
				variant="compact"
				value={value}
				onChange={(e) => onChange(e.target.value as FiltroPresencia)}
				className={cx(
					value === "con" && "border-green-200 bg-green-50 text-green-700 focus:border-green-400 focus:ring-green-100",
					value === "sin" && "border-red-200 bg-red-50 text-red-700 focus:border-red-400 focus:ring-red-100",
				)}
			>
				<option value="todos">Todos</option>
				<option value="con">{conLabel || `Con ${labelLower}`}</option>
				<option value="sin">{sinLabel || `Sin ${labelLower}`}</option>
			</Select>
		</Field>
	);
}
