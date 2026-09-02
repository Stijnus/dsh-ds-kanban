import z from "@deepseek-ai/schemastery";
//#region src/settings.ts
/** Durable DS Kanban settings shared by the Host schema and Client decoder. */
/** Plugin-owned settings namespace. */
const SETTINGS_NAMESPACE = "ds-kanban";
/** Current settings format. Unknown versions fail instead of being repaired. */
const SETTINGS_VERSION = 1;
const MANUAL_COLUMNS = ["inbox", "ready"];
const SORT_ORDERS = [
	"recent",
	"oldest",
	"title",
	"runtime",
	"tokens",
	"cost"
];
const DENSITIES = ["compact", "comfortable"];
const TIME_MODES = ["relative", "absolute"];
/** Settings used when the namespace has no user section. */
const DEFAULT_SETTINGS = {
	version: 1,
	manual: {},
	workspace: "",
	status: "",
	presetModel: "",
	activeOnly: false,
	includeArchived: false,
	groupByWorkspace: false,
	sort: "recent",
	density: "comfortable",
	timeMode: "relative",
	contextWarningPercent: 80
};
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isMember(values, value) {
	return typeof value === "string" && values.some((candidate) => candidate === value);
}
/**
* Decode the redacted settings wire value without repairing malformed data.
* @param value - settings section returned by the authenticated settings Remote.
* @returns the accepted settings, or undefined so the Client preserves its last good snapshot.
*/
function decodeSettings(value) {
	if (!isRecord(value) || value.version !== 1 || !isRecord(value.manual)) return void 0;
	const manual = {};
	for (const [sessionId, column] of Object.entries(value.manual)) {
		if (!isMember(MANUAL_COLUMNS, column)) return void 0;
		manual[sessionId] = column;
	}
	const contextWarningPercent = value.contextWarningPercent;
	if (typeof value.workspace !== "string" || typeof value.status !== "string" || typeof value.presetModel !== "string" || typeof value.activeOnly !== "boolean" || typeof value.includeArchived !== "boolean" || typeof value.groupByWorkspace !== "boolean" || !isMember(SORT_ORDERS, value.sort) || !isMember(DENSITIES, value.density) || !isMember(TIME_MODES, value.timeMode) || typeof contextWarningPercent !== "number" || !Number.isInteger(contextWarningPercent) || contextWarningPercent < 1 || contextWarningPercent > 100) return void 0;
	return {
		version: 1,
		manual,
		workspace: value.workspace,
		status: value.status,
		presetModel: value.presetModel,
		activeOnly: value.activeOnly,
		includeArchived: value.includeArchived,
		groupByWorkspace: value.groupByWorkspace,
		sort: value.sort,
		density: value.density,
		timeMode: value.timeMode,
		contextWarningPercent
	};
}
//#endregion
//#region src/settings-schema.ts
/** Host-only validation schema for DS Kanban preferences. */
/** Versioned schema enforced before the settings provider commits an atomic write. */
const KanbanSettingsSchema = z.object({
	version: z.const(1).default(1),
	manual: z.dict(z.union([...MANUAL_COLUMNS])).default({}),
	workspace: z.string().default(""),
	status: z.string().default(""),
	presetModel: z.string().default(""),
	activeOnly: z.boolean().default(false),
	includeArchived: z.boolean().default(false),
	groupByWorkspace: z.boolean().default(false),
	sort: z.union([...SORT_ORDERS]).default("recent"),
	density: z.union([...DENSITIES]).default("comfortable"),
	timeMode: z.union([...TIME_MODES]).default("relative"),
	contextWarningPercent: z.number().step(1).min(1).max(100).default(80)
});
//#endregion
//#region src/index.ts
/** Cordis plugin name. */
const name = "ds-kanban";
/** The settings provider is optional so diagnostics can explain a memory-only deployment. */
const inject = [];
/**
* Register the versioned DS Kanban preferences with the existing atomic settings provider.
* @param ctx - Host context that may acquire the settings service.
*/
function apply(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.register(SETTINGS_NAMESPACE, KanbanSettingsSchema);
	});
}
//#endregion
export { DEFAULT_SETTINGS, DENSITIES, MANUAL_COLUMNS, SETTINGS_NAMESPACE, SETTINGS_VERSION, SORT_ORDERS, TIME_MODES, apply, decodeSettings, inject, name };
