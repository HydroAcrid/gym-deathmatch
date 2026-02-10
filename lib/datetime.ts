export type DateInput = string | number | Date | null | undefined;

function asDate(value: DateInput): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

export function toLocalDateTimeInputValue(value: DateInput): string {
	const d = asDate(value);
	if (!d) return "";
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function toIsoFromLocalDateTimeInput(value: string | null | undefined): string | null {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatLocalDateTime(
	value: DateInput,
	withZone = false,
	options?: Intl.DateTimeFormatOptions
): string {
	const d = asDate(value);
	if (!d) return "—";
	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	};
	return d.toLocaleString(undefined, {
		...defaultOptions,
		...(withZone ? { timeZoneName: "short" } : {}),
		...(options || {})
	});
}

export function formatLocalDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
	const d = asDate(value);
	if (!d) return "—";
	return d.toLocaleDateString(undefined, options);
}

export function formatLocalTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
	const d = asDate(value);
	if (!d) return "—";
	return d.toLocaleTimeString(undefined, options);
}
