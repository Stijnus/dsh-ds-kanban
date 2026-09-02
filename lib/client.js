window.__ModuleLoader__.load({
	id: "dsh-ds-kanban",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region src/client/actions.ts
		/**
		* Read the healthy preset roster for the new-task form.
		* @param remote - the agentPresets Remote method the board uses.
		* @returns selectable presets, treating an unavailable Remote as an empty list.
		*/
		async function fetchPresets(remote) {
			const result = await remote.list();
			if (!result.ok) {
				if (result.error.code === "invocation-unavailable") return [];
				throw new Error(result.error.message);
			}
			return result.value.presets.flatMap((preset) => preset.broken === void 0 ? [{
				id: preset.id,
				...preset.name === void 0 ? {} : { name: preset.name }
			}] : []);
		}
		/**
		* Coalesce duplicate form submissions while one supported create flow is active.
		* A failed post-create title, preset, or prompt step leaves the real blank task visible for recovery.
		*/
		var TaskCreator = class {
			deps;
			inFlight;
			/** @param deps - existing Session service and preset Remote. */
			constructor(deps) {
				this.deps = deps;
			}
			/**
			* Create, configure, prompt, and open one real Harness task.
			* @param input - selected Workspace, optional preset/title, and initial prompt.
			* @returns created Session identity.
			*/
			create(input) {
				if (this.inFlight !== void 0) return this.inFlight;
				const operation = this.perform(input);
				this.inFlight = operation;
				operation.finally(() => {
					if (this.inFlight === operation) this.inFlight = void 0;
				}).catch(() => {});
				return operation;
			}
			async perform(input) {
				const sessionId = await this.deps.sessions.create(input.workspaceId === void 0 ? {} : { workspaceId: input.workspaceId });
				const session = this.deps.sessions.binding(sessionId)?.session;
				if (session === void 0) throw new Error(`created task "${String(sessionId)}" is not locally addressable`);
				const preset = input.preset?.trim();
				if (preset) {
					const selected = await this.deps.agentPresets.select(sessionId, preset);
					if (!selected.ok) throw new Error(selected.error.message);
				}
				const title = input.title?.trim();
				if (title) {
					const renamed = await session.rename(title);
					if (!renamed.ok) throw new Error(renamed.error.message);
				}
				const prompt = input.prompt.trim();
				if (prompt) {
					const admitted = await session.prompt([{
						type: "text",
						text: prompt
					}], "queue");
					if (!admitted.ok) throw new Error(admitted.error.message);
				}
				this.deps.sessions.open(sessionId);
				return sessionId;
			}
		};
		//#endregion
		//#region src/client/board.ts
		const BOARD_COLUMNS = [
			"inbox",
			"ready",
			"running",
			"waiting",
			"blocked",
			"idle",
			"done"
		];
		/**
		* Map context-window usage to a progress tone for the card context bar.
		* @param percent - context-window usage as a percentage of capacity.
		* @param warningPercent - user-configured warning threshold from settings.
		* @returns `ok` below the threshold, `warn` at or above it, `critical` at full capacity.
		*/
		function contextTone(percent, warningPercent) {
			if (percent >= 100) return "critical";
			if (percent >= warningPercent) return "warn";
			return "ok";
		}
		function workspaceIndex(workspaces) {
			const result = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) result.set(sessionId, workspace);
			return result;
		}
		function contextPercent(summary) {
			const pressure = summary.projectionValues?.contextPressure;
			const used = pressure?.projectedTokens ?? pressure?.pressureTokens;
			const capacity = pressure?.contextWindow;
			if (used === void 0 || capacity === void 0 || capacity <= 0) return void 0;
			return Math.min(100, Math.max(0, used / capacity * 100));
		}
		function cardColumn(summary, runtime, waiting, manual) {
			if (waiting) return "waiting";
			if (summary.running || runtime?.running === true) return "running";
			if (runtime?.lastAgentError) return "blocked";
			const goal = summary.projectionValues?.goal?.goal;
			if (goal?.phase === "blocked") return "blocked";
			if ((runtime?.queueLength ?? 0) > 0) return "idle";
			if (goal?.phase === "complete") return "done";
			if (goal !== void 0 || !summary.blank) return "idle";
			return manual ?? "inbox";
		}
		/**
		* Project every authoritative Session list row into a board card.
		* @param sessions - live Client Session list.
		* @param workspaces - live Workspace and archive projection.
		* @param pending - effective user interaction per Session.
		* @param runtime - live Session-face facts unavailable on list summaries.
		* @param manual - plugin-owned Inbox/Ready placement for otherwise blank Sessions.
		* @returns cards in Session list order.
		*/
		function projectCards(sessions, workspaces, pending, runtime, manual) {
			const bySession = workspaceIndex(workspaces.items);
			const archived = new Set(workspaces.archivedSessionIds);
			const childCount = /* @__PURE__ */ new Map();
			for (const summary of Object.values(sessions.byId)) if (summary.parentId !== void 0) childCount.set(summary.parentId, (childCount.get(summary.parentId) ?? 0) + 1);
			return sessions.ids.flatMap((id) => {
				const summary = sessions.byId[id];
				if (summary === void 0 || summary.origin === "subagent") return [];
				const run = runtime[id];
				const workspace = bySession.get(id);
				const usage = summary.projectionValues?.tokenUsage;
				const selection = summary.projectionValues?.modelSelection?.next;
				const stats = summary.projectionValues?.sessionStats;
				const goal = summary.projectionValues?.goal;
				const inputTokens = usage === void 0 ? void 0 : usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
				const totalTokens = inputTokens === void 0 ? void 0 : inputTokens + usage.outputTokens;
				const context = contextPercent(summary);
				const isWaiting = pending.has(id);
				const interaction = pending.get(id);
				return [{
					id,
					title: summary.displayTitle,
					...workspace === void 0 ? {} : {
						workspaceId: workspace.workspaceId,
						workspace: workspace.title
					},
					...summary.cwd === void 0 ? {} : { cwd: summary.cwd },
					column: cardColumn(summary, run, isWaiting, manual[id]),
					archived: archived.has(id),
					running: summary.running || run?.running === true,
					waiting: isWaiting,
					...interaction === void 0 ? {} : { interactionKind: interaction.kind },
					...run?.lastAgentError ? { failure: run.lastAgentError } : {},
					...goal == null ? {} : { goal },
					...run === void 0 ? {} : { queueLength: run.queueLength },
					updatedAt: summary.updatedAt,
					blank: summary.blank,
					...typeof summary.projectionValues?.agentPreset === "string" ? { preset: summary.projectionValues.agentPreset } : {},
					...selection?.provider === void 0 ? {} : { provider: selection.provider },
					...selection?.model === void 0 ? {} : { model: selection.model },
					...stats === void 0 ? {} : { steps: stats.steps },
					...inputTokens === void 0 ? {} : { inputTokens },
					...usage === void 0 || totalTokens === void 0 ? {} : {
						outputTokens: usage.outputTokens,
						cacheReadTokens: usage.cacheReadTokens,
						cacheWriteTokens: usage.cacheWriteTokens,
						totalTokens
					},
					...context === void 0 ? {} : { contextPercent: context },
					subagents: childCount.get(id) ?? 0
				}];
			});
		}
		/**
		* Create a projection cache retaining unchanged cards for memoized renderers.
		* @returns a projector whose cache contains only the latest card set.
		*/
		function createCardProjector() {
			let previous = /* @__PURE__ */ new Map();
			return (...args) => {
				const cards = projectCards(...args).map((card) => {
					const cached = previous.get(card.id);
					if (cached === void 0) return card;
					const keys = Object.keys(card);
					return keys.length === Object.keys(cached).length && keys.every((key) => card[key] === cached[key]) ? cached : card;
				});
				previous = new Map(cards.map((card) => [card.id, card]));
				return cards;
			};
		}
		function searchable(card) {
			return [
				card.id,
				card.title,
				card.workspace,
				card.cwd,
				card.preset,
				card.provider,
				card.model
			].filter((value) => value !== void 0).join("\n").toLocaleLowerCase();
		}
		/**
		* Choose the first actionable reason, with human interactions before diagnostics.
		* @param card - current card projection.
		* @param contextWarningPercent - configured context usage warning threshold.
		* @returns the reason to open the session, or undefined when no attention is needed.
		*/
		function attentionReason(card, contextWarningPercent) {
			if (card.waiting || card.column === "waiting") switch (card.interactionKind) {
				case "approval": return "approval";
				case "question": return "question";
				default: return "interaction";
			}
			if (card.failure !== void 0) return "failure";
			if (card.column === "blocked" || card.goal?.goal.phase === "blocked") return "blocked";
			if ((card.contextPercent ?? 0) >= contextWarningPercent) return "context";
		}
		/** A card needing operator attention under the configured context threshold. */
		function isAttention(card, contextWarningPercent) {
			return attentionReason(card, contextWarningPercent) !== void 0;
		}
		/**
		* Resolve a drag onto an Inbox/Ready column into manual placement.
		* @param id - the dragged card id read from the data transfer.
		* @param column - the column receiving the drop.
		* @param cards - all cards in the displayed board or workspace group.
		* @returns the manual column to store, or undefined when the drop must be ignored.
		*/
		function dropColumn(id, column, cards) {
			if (column !== "inbox" && column !== "ready") return void 0;
			if (id === "") return void 0;
			const card = cards.find((candidate) => candidate.id === id);
			if (card === void 0 || !card.blank || card.column !== "inbox" && card.column !== "ready") return void 0;
			return column;
		}
		function compareCards(a, b, sort) {
			switch (sort) {
				case "oldest": return a.updatedAt - b.updatedAt || a.id.localeCompare(b.id);
				case "title": return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
				case "tokens": return (b.totalTokens ?? -1) - (a.totalTokens ?? -1) || b.updatedAt - a.updatedAt;
				case "runtime":
				case "cost":
				case "recent": return b.updatedAt - a.updatedAt || a.id.localeCompare(b.id);
				default: return assertNever(sort);
			}
		}
		/** Apply board filters and stable sorting without mutating the projection. */
		function filterCards(cards, filters) {
			const query = filters.search.trim().toLocaleLowerCase();
			return cards.filter((card) => (filters.includeArchived || !card.archived) && (query === "" || searchable(card).includes(query)) && (filters.workspace === "" || card.workspaceId === filters.workspace) && (filters.status === "" || card.column === filters.status || filters.status === "attention" && isAttention(card, filters.contextWarningPercent)) && (filters.presetModel === "" || card.preset === filters.presetModel || card.model === filters.presetModel || card.provider === filters.presetModel) && (!filters.activeOnly || [
				"running",
				"waiting",
				"blocked"
			].includes(card.column))).sort((a, b) => compareCards(a, b, filters.sort));
		}
		/** Aggregate only metrics exposed by the current authoritative projections. */
		function aggregateStats(cards) {
			const contexts = cards.flatMap((card) => card.contextPercent === void 0 ? [] : [card.contextPercent]);
			return {
				visible: cards.length,
				running: cards.filter((card) => card.column === "running").length,
				waiting: cards.filter((card) => card.column === "waiting").length,
				blocked: cards.filter((card) => card.column === "blocked").length,
				completed: cards.filter((card) => card.column === "done").length,
				tokens: cards.reduce((total, card) => total + (card.totalTokens ?? 0), 0),
				...contexts.length === 0 ? {} : { averageContext: contexts.reduce((total, value) => total + value, 0) / contexts.length },
				workspaces: new Set(cards.flatMap((card) => card.workspaceId === void 0 ? [] : [card.workspaceId])).size
			};
		}
		/** Group cards by Workspace while retaining Ungrouped as a stable final key. */
		function groupCards(cards) {
			const groups = /* @__PURE__ */ new Map();
			for (const card of cards) {
				const key = card.workspace ?? "";
				const group = groups.get(key) ?? [];
				group.push(card);
				groups.set(key, group);
			}
			return groups;
		}
		/** Build filter defaults from durable settings and a transient search query. */
		function filtersFromSettings(settings, search) {
			return {
				search,
				workspace: settings.workspace,
				status: settings.status,
				presetModel: settings.presetModel,
				activeOnly: settings.activeOnly,
				includeArchived: settings.includeArchived,
				sort: settings.sort,
				contextWarningPercent: settings.contextWarningPercent
			};
		}
		function assertNever(value) {
			throw new Error(`unknown sort order: ${String(value)}`);
		}
		//#endregion
		//#region src/client/contracts.ts
		/** Narrow Workspace form ids without exposing a raw string to Host calls. */
		function workspaceId(value) {
			return value === "" ? void 0 : value;
		}
		//#endregion
		//#region src/settings.ts
		/** Durable DS Kanban settings shared by the Host schema and Client decoder. */
		/** Plugin-owned settings namespace. */
		const SETTINGS_NAMESPACE = "ds-kanban";
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
		//#region src/client/export.ts
		/** Convert visible cards to the explicit export allowlist. */
		function exportRows(cards) {
			return cards.map((card) => ({
				id: card.id,
				title: card.title,
				...card.workspace === void 0 ? {} : { workspace: card.workspace },
				status: card.column,
				archived: card.archived,
				updatedAt: new Date(card.updatedAt).toISOString(),
				...card.preset === void 0 ? {} : { preset: card.preset },
				...card.provider === void 0 ? {} : { provider: card.provider },
				...card.model === void 0 ? {} : { model: card.model },
				...card.steps === void 0 ? {} : { steps: card.steps },
				...card.totalTokens === void 0 ? {} : { totalTokens: card.totalTokens },
				...card.contextPercent === void 0 ? {} : { contextPercent: card.contextPercent }
			}));
		}
		function csvCell(value) {
			const text = value === void 0 ? "" : String(value);
			return /[",\r\n]/u.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
		}
		/** Encode the export allowlist as RFC 4180-style CSV. */
		function exportCsv(cards) {
			const keys = [
				"id",
				"title",
				"workspace",
				"status",
				"archived",
				"updatedAt",
				"preset",
				"provider",
				"model",
				"steps",
				"totalTokens",
				"contextPercent"
			];
			const lines = [keys.join(",")];
			for (const row of exportRows(cards)) lines.push(keys.map((key) => csvCell(row[key])).join(","));
			return `${lines.join("\r\n")}\r\n`;
		}
		/** Encode the export allowlist as versioned JSON. */
		function exportJson(cards) {
			return JSON.stringify({
				version: 1,
				exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
				tasks: exportRows(cards)
			}, null, 2);
		}
		//#endregion
		//#region src/client/focus.ts
		/** Focus management for plugin-owned modal dialogs. */
		const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";
		/**
		* Move focus into a dialog on mount, keep Tab inside it, and restore focus to
		* the opener on unmount. The returned ref must sit on the dialog element,
		* which needs tabIndex={-1} so it can receive focus.
		* @returns ref for the dialog element.
		*/
		function useModalFocus() {
			const ref = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				const container = ref.current;
				container?.focus();
				const onKeyDown = (event) => {
					if (event.key !== "Tab" || container === null) return;
					const focusable = [...container.querySelectorAll(FOCUSABLE)].filter((element) => !element.hasAttribute("disabled"));
					if (focusable.length === 0) return;
					const first = focusable[0];
					const last = focusable[focusable.length - 1];
					if (event.shiftKey && (document.activeElement === first || document.activeElement === container || !container.contains(document.activeElement))) {
						event.preventDefault();
						last.focus();
					} else if (!event.shiftKey && document.activeElement === last) {
						event.preventDefault();
						first.focus();
					}
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					opener?.focus();
				};
			}, []);
			return ref;
		}
		/** Return the bounded card page rendered by one column. */
		function visibleColumnCards(cards, limit) {
			return cards.slice(0, Math.max(0, limit));
		}
		function compactNumber(value) {
			return new Intl.NumberFormat(void 0, {
				notation: "compact",
				maximumFractionDigits: 1
			}).format(value);
		}
		function relativeTime(time, t) {
			const delta = Math.max(0, Date.now() - time);
			const minutes = Math.floor(delta / 6e4);
			if (minutes < 1) return t("time.justNow");
			if (minutes < 60) return t("time.minutesAgo", { count: minutes });
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return t("time.hoursAgo", { count: hours });
			return t("time.daysAgo", { count: Math.floor(hours / 24) });
		}
		function saveFile(name, type, content) {
			const url = URL.createObjectURL(new Blob([content], { type }));
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = name;
			anchor.click();
			URL.revokeObjectURL(url);
		}
		function statusKey(column) {
			return `status.${column}`;
		}
		/** Render one session's execution state, durable goal, and navigation actions. */
		const TaskCard = (0, react.memo)(function TaskCard({ card, settings, props }) {
			const { t } = props;
			const attention = attentionReason(card, settings.contextWarningPercent);
			const reportFailure = (cause) => {
				props.actions.setError(cause instanceof Error ? cause.message : String(cause));
			};
			const onKeyDown = (event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key === "Enter") props.openTask(card.id);
				if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
				event.preventDefault();
				const index = BOARD_COLUMNS.indexOf(card.column);
				const direction = event.key === "ArrowRight" ? 1 : -1;
				for (let target = index + direction; target >= 0 && target < BOARD_COLUMNS.length; target += direction) {
					const next = document.querySelector(`[data-card-column="${BOARD_COLUMNS[target]}"]`);
					if (next === null) continue;
					next.focus();
					break;
				}
			};
			const moveable = card.blank && (card.column === "inbox" || card.column === "ready");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: "dsk-card",
				"data-card-column": card.column,
				"data-card-id": card.id,
				draggable: moveable,
				tabIndex: 0,
				onClick: () => {
					props.openTask(card.id);
				},
				onKeyDown,
				onDragStart: (event) => {
					event.dataTransfer.setData("text/ds-kanban-session", card.id);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsk-card-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: card.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `dsk-status dsk-status-${card.column}`,
							children: t(statusKey(card.column))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsk-card-sub",
						children: card.workspace ?? card.cwd ?? card.id
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsk-card-badges",
						children: [
							card.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("archived") }),
							card.queueLength !== void 0 && card.queueLength > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("card.queued", { count: card.queueLength }) }),
							card.preset !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: card.preset }),
							card.provider !== void 0 && card.model !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								card.provider,
								"/",
								card.model
							] }),
							card.steps !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("card.steps", { count: card.steps }) }),
							card.totalTokens !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("card.tokens", { count: compactNumber(card.totalTokens) }) }),
							card.contextPercent !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"data-warning": card.contextPercent >= settings.contextWarningPercent || void 0,
								children: t("card.context", { percent: Math.round(card.contextPercent) })
							}),
							card.subagents > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("card.subagents", { count: card.subagents }) })
						]
					}),
					card.goal !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsk-goal",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(`goal.${card.goal.goal.phase}`) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: card.goal.goal.objective }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("goal.rounds", {
								used: card.goal.roundsStarted,
								limit: card.goal.goal.maxGoalRounds
							}) }),
							card.goal.goal.phase === "active" && !card.running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("goal.activeHint") }),
							card.goal.goal.blockedReason !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsk-failure",
								children: card.goal.goal.blockedReason.message
							})
						]
					}),
					card.contextPercent !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsk-context-bar",
						role: "progressbar",
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": Math.round(card.contextPercent),
						"aria-label": t("card.contextBar"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: { width: `${card.contextPercent}%` },
							"data-tone": contextTone(card.contextPercent, settings.contextWarningPercent)
						})
					}),
					card.failure !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsk-failure",
						children: card.failure
					}),
					attention !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: "dsk-attention",
						type: "button",
						onClick: (event) => {
							event.stopPropagation();
							props.openTask(card.id);
						},
						children: t(`attention.${attention}`)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsk-card-foot",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("card.lastActivity", { time: settings.timeMode === "absolute" ? new Date(card.updatedAt).toLocaleString() : relativeTime(card.updatedAt, t) }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsk-card-actions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": t("card.copyId"),
									title: t("card.copyId"),
									onClick: (event) => {
										event.stopPropagation();
										props.copyTaskId(card.id).catch(reportFailure);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, { size: 14 })
								}),
								card.running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": t("card.cancel"),
									title: t("card.cancel"),
									onClick: (event) => {
										event.stopPropagation();
										if (!window.confirm(t("card.confirmCancel", { title: card.title }))) return;
										props.cancelTask(card.id).catch(reportFailure);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFill16, { size: 14 })
								}),
								!card.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": t("card.archive"),
									title: t("card.archive"),
									onClick: (event) => {
										event.stopPropagation();
										if (!window.confirm(t("card.confirmArchive", { title: card.title }))) return;
										props.archiveTask(card.id).catch(reportFailure);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, { size: 14 })
								})
							]
						})]
					})
				]
			});
		});
		function BoardColumnView({ column, cards, allCards, settings, props }) {
			const [limit, setLimit] = (0, react.useState)(60);
			const visibleCards = visibleColumnCards(cards, limit);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsk-column",
				"data-column": column,
				onDragOver: (event) => {
					if (column !== "inbox" && column !== "ready") return;
					event.preventDefault();
				},
				onDrop: (event) => {
					if (column !== "inbox" && column !== "ready") return;
					event.preventDefault();
					const id = event.dataTransfer.getData("text/ds-kanban-session");
					const target = dropColumn(id, column, allCards);
					if (target === void 0) return;
					props.setManual(id, target).catch((cause) => {
						props.actions.setError(cause instanceof Error ? cause.message : String(cause));
					});
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: props.t(`column.${column}`) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: cards.length })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsk-card-list",
					children: [visibleCards.map((card) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskCard, {
						card,
						settings,
						props
					}, card.id)), visibleCards.length < cards.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: "dsk-show-more",
						type: "button",
						onClick: () => {
							setLimit((current) => current + 60);
						},
						children: props.t("column.showMore", {
							visible: visibleCards.length,
							total: cards.length
						})
					})]
				})]
			});
		}
		function Columns({ cards, settings, props }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsk-columns",
				children: BOARD_COLUMNS.map((column) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BoardColumnView, {
					column,
					allCards: cards,
					cards: cards.filter((card) => card.column === column),
					settings,
					props
				}, column))
			});
		}
		function NewTaskModal({ props, workspaces }) {
			const { t } = props;
			const dialogRef = useModalFocus();
			const [workspace, setWorkspace] = (0, react.useState)("");
			const [preset, setPreset] = (0, react.useState)("");
			const [title, setTitle] = (0, react.useState)("");
			const [prompt, setPrompt] = (0, react.useState)("");
			const [presets, setPresets] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let active = true;
				props.listPresets().then((rows) => {
					if (active) setPresets(rows);
				}).catch(() => {});
				return () => {
					active = false;
				};
			}, [props.listPresets]);
			const submit = async () => {
				if (busy) return;
				setBusy(true);
				setError(void 0);
				try {
					const selectedWorkspace = workspaceId(workspace);
					await props.createTask({
						...selectedWorkspace === void 0 ? {} : { workspaceId: selectedWorkspace },
						...preset === "" ? {} : { preset },
						...title.trim() === "" ? {} : { title },
						prompt
					});
					props.actions.setNewTaskOpen(false);
					props.actions.close();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsk-modal-backdrop",
				role: "presentation",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dsk-modal",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "dsk-new-title",
					ref: dialogRef,
					tabIndex: -1,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "dsk-new-title",
							children: t("new.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("new.workspace"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							value: workspace,
							onChange: (event) => {
								setWorkspace(event.target.value);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("new.noWorkspace")
							}), workspaces.items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: item.workspaceId,
								children: item.title
							}, item.workspaceId))]
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("new.preset"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							value: preset,
							onChange: (event) => {
								setPreset(event.target.value);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("new.defaultPreset")
							}), presets.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: item.id,
								children: item.name ?? item.id
							}, item.id))]
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("new.taskTitle"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							value: title,
							placeholder: t("new.taskTitlePlaceholder"),
							onChange: (event) => {
								setTitle(event.target.value);
							}
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("new.prompt"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							value: prompt,
							placeholder: t("new.promptPlaceholder"),
							onChange: (event) => {
								setPrompt(event.target.value);
							}
						})] }),
						error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsk-error",
							role: "alert",
							children: t("new.error", { message: error })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								props.actions.setNewTaskOpen(false);
							},
							children: t("new.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy || prompt.trim() === "",
							onClick: () => {
								submit();
							},
							children: busy ? t("new.creating") : t("new.create")
						})] })
					]
				})
			});
		}
		function Diagnostics({ props, settingsMode }) {
			const { t } = props;
			const dialogRef = useModalFocus();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsk-modal-backdrop",
				role: "presentation",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dsk-modal dsk-diagnostics",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "dsk-diagnostics-title",
					ref: dialogRef,
					tabIndex: -1,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "dsk-diagnostics-title",
							children: t("diagnostics.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("diagnostics.available") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("diagnostics.availableList") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("diagnostics.unavailable") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("diagnostics.unavailableList") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("diagnostics.persistence", { mode: t(settingsMode === "host" ? "diagnostics.hostPersistence" : "diagnostics.memoryPersistence") }) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("diagnostics.privacy") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("footer", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								props.actions.setDiagnosticsOpen(false);
							},
							children: t("diagnostics.close")
						}) })
					]
				})
			});
		}
		function KanbanBoard(props) {
			const open = props.useStore((state) => state.open);
			const newTaskOpen = props.useStore((state) => state.newTaskOpen);
			const diagnosticsOpen = props.useStore((state) => state.diagnosticsOpen);
			const error = props.useStore((state) => state.error);
			const settingsSnapshot = props.useKanbanSettings((snapshot) => snapshot);
			const settings = settingsSnapshot.value ?? DEFAULT_SETTINGS;
			const sessions = props.useSessions((snapshot) => snapshot);
			const workspaces = props.useWorkspaces((snapshot) => snapshot);
			const pending = props.useSessionPendingInteraction((snapshot) => snapshot);
			const runtime = props.useRuntime((snapshot) => snapshot);
			const connection = props.useConnectionGeneration((snapshot) => snapshot);
			const [search, setSearch] = (0, react.useState)("");
			const searchRef = (0, react.useRef)(null);
			const projectCards = (0, react.useMemo)(createCardProjector, []);
			const allCards = (0, react.useMemo)(() => projectCards(sessions, workspaces, pending, runtime, settings.manual), [
				projectCards,
				sessions,
				workspaces,
				pending,
				runtime,
				settings.manual
			]);
			const cards = (0, react.useMemo)(() => filterCards(allCards, filtersFromSettings(settings, search)), [
				allCards,
				settings,
				search
			]);
			const stats = (0, react.useMemo)(() => aggregateStats(cards), [cards]);
			const presetModels = (0, react.useMemo)(() => [...new Set(allCards.flatMap((card) => [
				card.preset,
				card.provider,
				card.model
			].filter((value) => value !== void 0)))].sort(), [allCards]);
			const backRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (open) backRef.current?.focus();
			}, [open]);
			const returnToSidebar = (0, react.useCallback)(() => {
				document.querySelector(".dsk-sidebar-action")?.focus();
			}, []);
			const closeAndReturn = (0, react.useCallback)(() => {
				returnToSidebar();
				props.actions.close();
			}, [props.actions, returnToSidebar]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKeyDown = (event) => {
					if (event.key !== "Escape") return;
					if (newTaskOpen) props.actions.setNewTaskOpen(false);
					else if (diagnosticsOpen) props.actions.setDiagnosticsOpen(false);
					else closeAndReturn();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [
				open,
				newTaskOpen,
				diagnosticsOpen,
				props.actions,
				closeAndReturn
			]);
			if (!open) return null;
			const reportFailure = (cause) => {
				props.actions.setError(cause instanceof Error ? cause.message : String(cause));
			};
			const set = (field, value) => {
				props.setSetting(field, value).catch(reportFailure);
			};
			const onKeyDown = (event) => {
				if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
					event.preventDefault();
					searchRef.current?.focus();
				}
			};
			const statButton = (label, value, status) => status === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsk-stat",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: value }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				className: "dsk-stat",
				type: "button",
				"aria-pressed": settings.status === status,
				onClick: () => {
					set("status", status);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: value }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
			});
			const renderBoard = (scopeCards) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Columns, {
				cards: scopeCards,
				settings,
				props
			});
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsk-root",
				"data-density": settings.density,
				onKeyDown,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "dsk-topbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsk-topbar-lead",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								ref: backRef,
								type: "button",
								className: "dsk-back",
								onClick: closeAndReturn,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutline14, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("back") })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsk-topbar-title",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: props.t("title") }), connection === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsk-disconnected",
									children: props.t("disconnected")
								})]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => {
									props.actions.setNewTaskOpen(true);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("newTask") })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									props.actions.setDiagnosticsOpen(true);
								},
								children: props.t("diagnostics")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => {
									props.refresh().catch(reportFailure);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("refresh") })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									saveFile("ds-kanban.json", "application/json", exportJson(cards));
								},
								children: props.t("exportJson")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									saveFile("ds-kanban.csv", "text/csv", exportCsv(cards));
								},
								children: props.t("exportCsv")
							})
						] })]
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsk-error-banner",
						role: "alert",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: error }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								props.actions.setError(void 0);
							},
							children: props.t("error.dismiss")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsk-stats",
						"aria-label": props.t("title"),
						children: [
							statButton(props.t("stats.visible"), stats.visible, ""),
							statButton(props.t("stats.running"), stats.running, "running"),
							statButton(props.t("stats.waiting"), stats.waiting, "waiting"),
							statButton(props.t("stats.blocked"), stats.blocked, "blocked"),
							statButton(props.t("stats.completed"), stats.completed, "done"),
							statButton(props.t("stats.tokens"), compactNumber(stats.tokens)),
							statButton(props.t("stats.cost"), props.t("unavailable")),
							statButton(props.t("stats.context"), stats.averageContext === void 0 ? props.t("unavailable") : `${Math.round(stats.averageContext)}%`),
							statButton(props.t("stats.workspaces"), stats.workspaces)
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsk-filters",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsk-search",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("filters.search") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: searchRef,
									type: "search",
									value: search,
									placeholder: props.t("filters.searchPlaceholder"),
									onChange: (event) => {
										setSearch(event.target.value);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("filters.workspace") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: settings.workspace,
								onChange: (event) => {
									set("workspace", event.target.value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: props.t("filters.allWorkspaces")
								}), workspaces.items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: item.workspaceId,
									children: item.title
								}, item.workspaceId))]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("filters.status") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: settings.status,
								onChange: (event) => {
									set("status", event.target.value);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: props.t("filters.allStatuses")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "attention",
										children: props.t("filters.attention")
									}),
									BOARD_COLUMNS.map((column) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: column,
										children: props.t(`column.${column}`)
									}, column))
								]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("filters.presetModel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: settings.presetModel,
								onChange: (event) => {
									set("presetModel", event.target.value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: props.t("filters.allPresetModels")
								}), presetModels.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: value }, value))]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("filters.sort") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								value: settings.sort,
								onChange: (event) => {
									set("sort", event.target.value);
								},
								children: SORT_ORDERS.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value,
									disabled: value === "runtime" || value === "cost",
									children: props.t(`sort.${value}`)
								}, value))
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("filters.density") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								value: settings.density,
								onChange: (event) => {
									set("density", event.target.value);
								},
								children: DENSITIES.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value,
									children: props.t(`density.${value}`)
								}, value))
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.t("filters.time") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								value: settings.timeMode,
								onChange: (event) => {
									set("timeMode", event.target.value);
								},
								children: TIME_MODES.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value,
									children: props.t(`time.${value}`)
								}, value))
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsk-check",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: settings.activeOnly,
									onChange: (event) => {
										set("activeOnly", event.target.checked);
									}
								}), props.t("filters.activeOnly")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsk-check",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: settings.includeArchived,
									onChange: (event) => {
										set("includeArchived", event.target.checked);
									}
								}), props.t("filters.includeArchived")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsk-check",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: settings.groupByWorkspace,
									onChange: (event) => {
										set("groupByWorkspace", event.target.checked);
									}
								}), props.t("filters.groupWorkspace")]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
						className: "dsk-board-scroll",
						children: sessions.phase === "pending" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsk-state",
							children: props.t("loading")
						}) : cards.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsk-state",
							children: props.t("empty")
						}) : settings.groupByWorkspace ? [...groupCards(cards)].map(([workspace, scoped]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "dsk-workspace-group",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: workspace || props.t("workspace.ungrouped") }), renderBoard(scoped)]
						}, workspace)) : renderBoard(cards)
					}),
					newTaskOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewTaskModal, {
						props,
						workspaces
					}),
					diagnosticsOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Diagnostics, {
						props,
						settingsMode: settingsSnapshot.mode
					})
				]
			}), document.body);
		}
		//#endregion
		//#region src/client/locales.ts
		/** Typed English and Chinese DS Kanban dictionaries. */
		const en = {
			title: "DS Kanban",
			"sidebar.open": "Open DS Kanban",
			"sidebar.attention": "{count} tasks need attention",
			back: "Back to session",
			newTask: "New task",
			diagnostics: "Diagnostics",
			refresh: "Refresh tasks",
			exportJson: "Export JSON",
			exportCsv: "Export CSV",
			disconnected: "Disconnected — showing the last received task state.",
			loading: "Loading Harness tasks…",
			empty: "No tasks match the current filters.",
			unavailable: "Unavailable",
			archived: "Archived",
			waitingIndicator: "Waiting for you",
			failedIndicator: "Action needed",
			"filters.search": "Search tasks",
			"filters.searchPlaceholder": "Title, workspace, model, preset, or task ID",
			"filters.workspace": "Workspace",
			"filters.allWorkspaces": "All workspaces",
			"filters.status": "Status",
			"filters.allStatuses": "All statuses",
			"filters.presetModel": "Preset or model",
			"filters.allPresetModels": "All presets and models",
			"filters.activeOnly": "Active only",
			"filters.includeArchived": "Include archived",
			"filters.groupWorkspace": "Group by workspace",
			"filters.sort": "Sort",
			"filters.density": "Density",
			"filters.time": "Timestamps",
			"filters.attention": "Needs attention",
			"sort.recent": "Recent activity",
			"sort.oldest": "Oldest activity",
			"sort.title": "Title",
			"sort.runtime": "Runtime (unavailable)",
			"sort.tokens": "Token usage",
			"sort.cost": "Cost (unavailable)",
			"density.compact": "Compact",
			"density.comfortable": "Comfortable",
			"time.relative": "Relative",
			"time.absolute": "Absolute",
			"column.inbox": "Inbox",
			"column.ready": "Ready",
			"column.running": "Running",
			"column.waiting": "Waiting",
			"column.blocked": "Blocked or failed",
			"column.idle": "Idle",
			"column.done": "Goal complete",
			"column.showMore": "Show more ({visible} of {total})",
			"status.inbox": "Inbox",
			"status.ready": "Ready",
			"status.running": "Running",
			"status.waiting": "Waiting",
			"status.blocked": "Blocked or failed",
			"status.idle": "Idle",
			"status.done": "Goal complete",
			"stats.visible": "Visible tasks",
			"stats.running": "Running agents",
			"stats.waiting": "Waiting for you",
			"stats.blocked": "Blocked or failed",
			"stats.completed": "Goals complete",
			"stats.tokens": "Total tokens",
			"stats.cost": "Estimated cost",
			"stats.context": "Average context",
			"stats.workspaces": "Active workspaces",
			"attention.approval": "Approval required · Review in session",
			"attention.question": "Question pending · Answer in session",
			"attention.interaction": "Input required · Open session",
			"attention.failure": "Execution failed · Inspect session",
			"attention.blocked": "Work blocked · Review in session",
			"attention.context": "High context usage · Inspect session",
			"goal.active": "Goal active",
			"goal.paused": "Goal paused",
			"goal.blocked": "Goal blocked",
			"goal.complete": "Goal complete",
			"goal.rounds": "{used} of {limit} rounds used",
			"goal.activeHint": "Automatic continuation may require resuming in the session.",
			"card.queued": "{count} queued",
			"card.open": "Open task",
			"card.archive": "Archive task",
			"card.cancel": "Stop current turn",
			"card.copyId": "Copy task ID",
			"card.steps": "{count} steps",
			"card.tokens": "{count} tokens",
			"card.input": "Input {count}",
			"card.output": "Output {count}",
			"card.cache": "Cache {count}",
			"card.context": "{percent}% context",
			"card.contextBar": "Context usage",
			"card.subagents": "{count} subagents",
			"card.lastActivity": "Last activity {time}",
			"card.confirmArchive": "Archive “{title}”? The task log remains available.",
			"card.confirmCancel": "Stop the current turn for “{title}”? Queued work remains.",
			"time.justNow": "just now",
			"time.minutesAgo": "{count}m ago",
			"time.hoursAgo": "{count}h ago",
			"time.daysAgo": "{count}d ago",
			"workspace.ungrouped": "Ungrouped",
			"new.title": "Create a Harness task",
			"new.workspace": "Workspace",
			"new.noWorkspace": "Default workspace",
			"new.preset": "Agent preset",
			"new.defaultPreset": "Default preset",
			"new.taskTitle": "Task title",
			"new.taskTitlePlaceholder": "Optional title",
			"new.prompt": "Initial prompt",
			"new.promptPlaceholder": "What should the agent do?",
			"new.create": "Create task",
			"new.creating": "Creating…",
			"new.cancel": "Cancel",
			"new.error": "Task creation failed: {message}",
			"diagnostics.title": "Capability diagnostics",
			"diagnostics.close": "Close diagnostics",
			"diagnostics.available": "Available from current Harness APIs",
			"diagnostics.unavailable": "Unavailable from current Harness APIs",
			"diagnostics.availableList": "Live sessions, archive state, interaction types, goal phases and round usage when available, model/preset projections, steps, tokens, context pressure, cancellation, and subagent session counts.",
			"diagnostics.unavailableList": "Pin/unpin, unarchive, authoritative cost, start/runtime history, completed-today timestamps, tool-call totals, git branch/worktree and changed-file counts, and final-result summaries.",
			"diagnostics.persistence": "Preferences: {mode}",
			"diagnostics.hostPersistence": "authenticated Host settings",
			"diagnostics.memoryPersistence": "memory only (Host settings unavailable)",
			"diagnostics.privacy": "The board shows projected goal objectives and blocker explanations. Exports omit those fields. It does not request prompts, transcripts, credentials, tool-result payloads, or workspace files.",
			"error.dismiss": "Dismiss"
		};
		const zh = {
			title: "DS 看板",
			"sidebar.open": "打开 DS 看板",
			"sidebar.attention": "{count} 个任务需要处理",
			back: "返回会话",
			newTask: "新建任务",
			diagnostics: "诊断",
			refresh: "刷新任务",
			exportJson: "导出 JSON",
			exportCsv: "导出 CSV",
			disconnected: "连接已断开——正在显示最后收到的任务状态。",
			loading: "正在加载 Harness 任务…",
			empty: "没有任务符合当前筛选条件。",
			unavailable: "不可用",
			archived: "已归档",
			waitingIndicator: "等待你处理",
			failedIndicator: "需要处理",
			"filters.search": "搜索任务",
			"filters.searchPlaceholder": "标题、工作区、模型、预设或任务 ID",
			"filters.workspace": "工作区",
			"filters.allWorkspaces": "所有工作区",
			"filters.status": "状态",
			"filters.allStatuses": "所有状态",
			"filters.presetModel": "预设或模型",
			"filters.allPresetModels": "所有预设和模型",
			"filters.activeOnly": "仅活动任务",
			"filters.includeArchived": "包括已归档",
			"filters.groupWorkspace": "按工作区分组",
			"filters.sort": "排序",
			"filters.density": "密度",
			"filters.time": "时间戳",
			"filters.attention": "需要处理",
			"sort.recent": "最近活动",
			"sort.oldest": "最早活动",
			"sort.title": "标题",
			"sort.runtime": "运行时间（不可用）",
			"sort.tokens": "Token 用量",
			"sort.cost": "成本（不可用）",
			"density.compact": "紧凑",
			"density.comfortable": "舒适",
			"time.relative": "相对时间",
			"time.absolute": "绝对时间",
			"column.inbox": "收件箱",
			"column.ready": "就绪",
			"column.running": "运行中",
			"column.waiting": "等待中",
			"column.blocked": "阻塞或失败",
			"column.idle": "空闲",
			"column.done": "目标已完成",
			"column.showMore": "显示更多（已显示 {visible} / {total}）",
			"status.inbox": "收件箱",
			"status.ready": "就绪",
			"status.running": "运行中",
			"status.waiting": "等待中",
			"status.blocked": "阻塞或失败",
			"status.idle": "空闲",
			"status.done": "目标已完成",
			"stats.visible": "可见任务",
			"stats.running": "运行中的 Agent",
			"stats.waiting": "等待你处理",
			"stats.blocked": "阻塞或失败",
			"stats.completed": "已完成目标",
			"stats.tokens": "Token 总数",
			"stats.cost": "预估成本",
			"stats.context": "平均上下文",
			"stats.workspaces": "活动工作区",
			"attention.approval": "需要审批 · 在会话中查看",
			"attention.question": "等待回答 · 在会话中回答",
			"attention.interaction": "需要输入 · 打开会话",
			"attention.failure": "执行失败 · 检查会话",
			"attention.blocked": "任务受阻 · 在会话中查看",
			"attention.context": "上下文使用率高 · 检查会话",
			"goal.active": "目标进行中",
			"goal.paused": "目标已暂停",
			"goal.blocked": "目标受阻",
			"goal.complete": "目标已完成",
			"goal.rounds": "已使用 {used} / {limit} 轮",
			"goal.activeHint": "自动继续可能需要在会话中恢复。",
			"card.queued": "{count} 条排队消息",
			"card.open": "打开任务",
			"card.archive": "归档任务",
			"card.cancel": "停止当前轮次",
			"card.copyId": "复制任务 ID",
			"card.steps": "{count} 步",
			"card.tokens": "{count} Token",
			"card.input": "输入 {count}",
			"card.output": "输出 {count}",
			"card.cache": "缓存 {count}",
			"card.context": "上下文 {percent}%",
			"card.contextBar": "上下文使用率",
			"card.subagents": "{count} 个子 Agent",
			"card.lastActivity": "上次活动 {time}",
			"card.confirmArchive": "归档“{title}”？任务日志仍会保留。",
			"card.confirmCancel": "停止“{title}”的当前轮次？排队中的工作会保留。",
			"time.justNow": "刚刚",
			"time.minutesAgo": "{count} 分钟前",
			"time.hoursAgo": "{count} 小时前",
			"time.daysAgo": "{count} 天前",
			"workspace.ungrouped": "未分组",
			"new.title": "创建 Harness 任务",
			"new.workspace": "工作区",
			"new.noWorkspace": "默认工作区",
			"new.preset": "Agent 预设",
			"new.defaultPreset": "默认预设",
			"new.taskTitle": "任务标题",
			"new.taskTitlePlaceholder": "可选标题",
			"new.prompt": "初始提示词",
			"new.promptPlaceholder": "Agent 应该做什么？",
			"new.create": "创建任务",
			"new.creating": "正在创建…",
			"new.cancel": "取消",
			"new.error": "任务创建失败：{message}",
			"diagnostics.title": "能力诊断",
			"diagnostics.close": "关闭诊断",
			"diagnostics.available": "当前 Harness API 可用",
			"diagnostics.unavailable": "当前 Harness API 不可用",
			"diagnostics.availableList": "实时会话、归档状态、交互类型、可用时的目标状态和轮次用量、模型/预设投影、步骤、Token、上下文压力、取消和子 Agent 会话数。",
			"diagnostics.unavailableList": "置顶/取消置顶、取消归档、权威成本、开始时间/运行历史、今日完成时间戳、工具调用总数、Git 分支/工作树和变更文件数，以及最终结果摘要。",
			"diagnostics.persistence": "偏好存储：{mode}",
			"diagnostics.hostPersistence": "经过身份验证的 Host 设置",
			"diagnostics.memoryPersistence": "仅内存（Host 设置不可用）",
			"diagnostics.privacy": "看板显示投影中的目标内容和阻塞原因，导出时不包含这些字段。看板不会请求提示词、完整对话、凭据、工具结果载荷或工作区文件。",
			"error.dismiss": "关闭"
		};
		//#endregion
		//#region src/client/runtime.ts
		function runtimeState(face) {
			const snapshot = face.getSnapshot();
			return {
				running: snapshot.running,
				lastAgentError: snapshot.lastAgentError,
				queueLength: snapshot.queue.length
			};
		}
		/**
		* Observe lightweight Session lifecycle faces without opening transcript windows.
		* @param sessions - Client Sessions service.
		* @returns identity-stable runtime snapshot source.
		*/
		function createRuntimeSource(sessions) {
			const listeners = /* @__PURE__ */ new Set();
			const subscriptions = /* @__PURE__ */ new Map();
			let snapshot = {};
			let disposed = false;
			const update = (id, face) => {
				if (disposed || subscriptions.get(id)?.face !== face) return;
				const next = runtimeState(face);
				const previous = snapshot[id];
				if (previous?.running === next.running && previous.lastAgentError === next.lastAgentError && previous.queueLength === next.queueLength) return;
				snapshot = {
					...snapshot,
					[id]: next
				};
				(0, _deepseek_ai_dsh_client_store.notifySubscribers)(listeners, "[ds-kanban/runtime]");
			};
			const reconcile = (list) => {
				if (disposed) return;
				let next;
				const ids = new Set(list.ids);
				for (const [id, entry] of subscriptions) {
					if (ids.has(id) && sessions.binding(id)?.session === entry.face) continue;
					entry.dispose();
					subscriptions.delete(id);
					next ??= { ...snapshot };
					delete next[id];
				}
				for (const id of list.ids) {
					if (subscriptions.has(id)) continue;
					const face = sessions.binding(id)?.session;
					if (face === void 0) continue;
					subscriptions.set(id, {
						face,
						dispose: face.subscribe(() => {
							update(id, face);
						})
					});
					next ??= { ...snapshot };
					next[id] = runtimeState(face);
				}
				if (next === void 0) return;
				snapshot = next;
				(0, _deepseek_ai_dsh_client_store.notifySubscribers)(listeners, "[ds-kanban/runtime]");
			};
			const disposeList = sessions.list.subscribe(() => {
				reconcile(sessions.list.getSnapshot());
			});
			reconcile(sessions.list.getSnapshot());
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					if (disposed) return () => {};
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				dispose() {
					if (disposed) return;
					disposed = true;
					disposeList();
					for (const entry of subscriptions.values()) entry.dispose();
					subscriptions.clear();
					listeners.clear();
				}
			};
		}
		//#endregion
		//#region src/client/SidebarAction.tsx
		/** Sidebar footer action opening the shared DS Kanban overlay. */
		function SidebarAction(props) {
			const { t, wide, useSessions, useWorkspaces, useSessionPendingInteraction } = props;
			const settings = props.useKanbanSettings((snapshot) => snapshot.value ?? DEFAULT_SETTINGS);
			const runtime = props.useRuntime((snapshot) => snapshot);
			const sessions = useSessions((snapshot) => snapshot);
			const workspaces = useWorkspaces((snapshot) => snapshot);
			const pending = useSessionPendingInteraction((snapshot) => snapshot);
			const open = props.useStore((snapshot) => snapshot.open);
			const projectCards = (0, react.useMemo)(createCardProjector, []);
			const attention = (0, react.useMemo)(() => projectCards(sessions, workspaces, pending, runtime, settings.manual), [
				projectCards,
				sessions,
				workspaces,
				pending,
				runtime,
				settings.manual
			]).filter((card) => isAttention(card, settings.contextWarningPercent)).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: attention > 0 ? t("sidebar.attention", { count: attention }) : t("sidebar.open"),
				delayMs: 500,
				disabled: wide,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsk-sidebar-action",
					"data-rail": !wide || void 0,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					"aria-label": t("sidebar.open"),
					onClick: () => {
						props.actions.open();
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: wide ? 16 : 18 }),
						wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsk-sidebar-label",
							children: t("title")
						}),
						attention > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsk-sidebar-badge",
							children: attention
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/store.ts
		/** Shared board visibility and modal state. */
		/** Build one root-scoped view store shared by the sidebar action and board overlay. */
		function createKanbanViewStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					open: false,
					newTaskOpen: false,
					diagnosticsOpen: false,
					error: void 0
				}),
				actions: {
					open: (draft) => {
						draft.open = true;
						draft.error = void 0;
					},
					close: (draft) => {
						draft.open = false;
						draft.newTaskOpen = false;
						draft.diagnosticsOpen = false;
						draft.error = void 0;
					},
					setNewTaskOpen: (draft, value) => {
						draft.newTaskOpen = value;
					},
					setDiagnosticsOpen: (draft, value) => {
						draft.diagnosticsOpen = value;
					},
					setError: (draft, message) => {
						draft.error = message;
					}
				}
			});
		}
		//#endregion
		//#region src/client/styles.ts
		/** Plugin-owned stylesheet; every color resolves through Harness theme tokens. */
		const styles = String.raw`
.dsk-root{position:fixed;inset:0;z-index:1000;display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr);overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:14px}
.dsk-root *{box-sizing:border-box}
.dsk-root button,.dsk-root input,.dsk-root select,.dsk-root textarea,.dsk-sidebar-action{font:inherit;color:inherit}
.dsk-root button,.dsk-sidebar-action{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-tool-bar-fill);cursor:pointer}
.dsk-root button:hover,.dsk-sidebar-action:hover{background:var(--dsw-alias-button-tool-bar-hover)}
.dsk-root button:focus-visible,.dsk-root input:focus-visible,.dsk-root select:focus-visible,.dsk-root textarea:focus-visible,.dsk-sidebar-action:focus-visible,.dsk-card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsk-root button:disabled{cursor:not-allowed;opacity:.55}
.dsk-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.dsk-topbar-lead{display:flex;flex:none;align-items:center;gap:14px;min-width:0}
.dsk-topbar-title{min-width:0}
.dsk-topbar h1{margin:0;font-size:20px;line-height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsk-back{display:inline-flex;flex:none;font-weight:600}
.dsk-topbar nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}
.dsk-topbar button{display:inline-flex;min-height:34px;align-items:center;gap:6px;padding:6px 10px}
.dsk-disconnected{display:block;margin-top:3px;color:var(--dsw-alias-state-warn-label);font-size:12px}
.dsk-error-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 18px 0;border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;padding:8px 12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);font-size:12px}
.dsk-error-banner button{min-height:28px;padding:4px 10px}
.dsk-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;padding:10px 18px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dsk-stat{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;min-width:92px;flex-direction:column;align-items:flex-start;padding:8px 10px;text-align:left}
.dsk-stats button[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary)}
.dsk-stats strong{font-size:17px}.dsk-stats span{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dsk-filters{display:flex;align-items:flex-end;gap:8px;padding:10px 18px;border-bottom:1px solid var(--dsw-alias-border-l1);overflow-x:auto;background:var(--dsw-alias-bg-layer-1)}
.dsk-filters label{display:flex;min-width:130px;flex-direction:column;gap:4px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dsk-filters label>span{white-space:nowrap}.dsk-filters input,.dsk-filters select,.dsk-modal input,.dsk-modal select,.dsk-modal textarea{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 9px;background:var(--dsw-specific-input-major)}
.dsk-filters .dsk-search{min-width:240px;flex:1}.dsk-filters .dsk-check{min-width:max-content;flex-direction:row;align-items:center;padding-bottom:8px;color:var(--dsw-alias-label-primary)}
.dsk-filters .dsk-check input{min-height:auto}
.dsk-board-scroll{min-height:0;overflow:auto;padding:14px 18px 24px}
.dsk-columns{display:grid;grid-template-columns:repeat(7,minmax(230px,1fr));gap:10px;min-width:1660px;align-items:start}
.dsk-column{min-height:160px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.dsk-column>header{display:flex;align-items:center;justify-content:space-between;padding:10px 11px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dsk-column h2{margin:0;font-size:13px}.dsk-column>header>span{min-width:22px;border-radius:10px;padding:2px 6px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:11px;text-align:center}
.dsk-card-list{display:flex;flex-direction:column;gap:8px;padding:8px}
.dsk-show-more{width:100%;min-height:36px;border-style:dashed}
.dsk-card{border:1px solid var(--dsw-alias-border-l2);border-left:3px solid var(--dsh-card-status);border-radius:10px;padding:10px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;box-shadow:0 1px 2px var(--dsw-alias-bg-mask-1)}
.dsk-card[data-card-column=inbox]{--dsh-card-status:var(--dsw-alias-label-secondary)}
.dsk-card[data-card-column=ready]{--dsh-card-status:var(--dsw-alias-state-business-primary)}
.dsk-card[data-card-column=running]{--dsh-card-status:var(--dsw-alias-brand-text)}
.dsk-card[data-card-column=waiting]{--dsh-card-status:var(--dsw-alias-state-warn-primary)}
.dsk-card[data-card-column=blocked]{--dsh-card-status:var(--dsw-alias-state-error-primary)}
.dsk-card[data-card-column=idle]{--dsh-card-status:var(--dsw-alias-label-secondary)}
.dsk-card[data-card-column=done]{--dsh-card-status:var(--dsw-alias-state-success-primary)}
.dsk-card:hover{border-color:var(--dsw-alias-border-l3);border-left-color:var(--dsh-card-status);background:var(--dsw-alias-interactive-bg-hover)}
.dsk-card[draggable=true]{cursor:grab}.dsk-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:7px}.dsk-card-head strong{min-width:0;overflow-wrap:anywhere;font-size:13px;line-height:18px}
.dsk-status{flex:none;border-radius:8px;padding:2px 5px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10px}
.dsk-status-inbox{color:var(--dsw-alias-label-secondary)}.dsk-status-ready{color:var(--dsw-alias-state-business-primary)}.dsk-status-running{color:var(--dsw-alias-brand-text)}.dsk-status-waiting{color:var(--dsw-alias-state-warn-label)}.dsk-status-blocked{color:var(--dsw-alias-state-error-primary)}.dsk-status-idle{color:var(--dsw-alias-label-secondary)}.dsk-status-done{color:var(--dsw-alias-state-success-primary)}
.dsk-card-sub{margin-top:5px;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.dsk-card-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.dsk-card-badges span{border-radius:7px;padding:2px 5px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10px}.dsk-card-badges span[data-warning=true]{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}
.dsk-context-bar{height:4px;margin-top:8px;border-radius:2px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}
.dsk-context-bar>span{display:block;height:100%;border-radius:2px}
.dsk-context-bar>span[data-tone=ok]{background:var(--dsw-alias-state-success-primary)}
.dsk-context-bar>span[data-tone=warn]{background:var(--dsw-alias-state-warn-primary)}
.dsk-context-bar>span[data-tone=critical]{background:var(--dsw-alias-state-error-primary)}
.dsk-goal{display:flex;flex-direction:column;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;overflow-wrap:anywhere}
.dsk-goal p{margin:0;line-height:16px}.dsk-goal>span{color:var(--dsw-alias-label-secondary)}
.dsk-attention{width:100%;margin-top:8px;padding:7px;text-align:left;font-size:11px;white-space:normal}
.dsk-failure{margin:7px 0 0;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
.dsk-card-foot{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:10px}.dsk-card-actions{display:flex;gap:3px}.dsk-card-actions button{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;padding:0;border-radius:6px}
.dsk-root[data-density=compact] .dsk-card-list{gap:5px;padding:5px}.dsk-root[data-density=compact] .dsk-card{padding:7px}.dsk-root[data-density=compact] .dsk-card-badges{margin-top:5px}
.dsk-workspace-group{margin-bottom:18px}.dsk-workspace-group>h2{position:sticky;left:0;width:max-content;margin:0 0 8px;font-size:15px}
.dsk-state{display:grid;min-height:220px;place-items:center;color:var(--dsw-alias-label-secondary)}
.dsk-modal-backdrop{position:absolute;inset:0;z-index:50;display:grid;place-items:center;padding:24px;background:var(--dsw-alias-bg-mask-2)}
.dsk-modal{display:flex;width:min(520px,100%);max-height:calc(100vh - 48px);flex-direction:column;gap:13px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:20px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 16px 48px var(--dsw-alias-bg-mask-3)}
.dsk-modal h2,.dsk-modal h3,.dsk-modal p{margin:0}.dsk-modal h2{font-size:18px}.dsk-modal h3{margin-top:4px;font-size:13px}.dsk-modal p{color:var(--dsw-alias-label-secondary);line-height:20px}.dsk-modal label{display:flex;flex-direction:column;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px}.dsk-modal textarea{min-height:120px;resize:vertical}.dsk-modal footer{display:flex;justify-content:flex-end;gap:8px;margin-top:3px}.dsk-modal footer button{min-height:34px;padding:6px 12px}.dsk-error{color:var(--dsw-alias-state-error-primary)!important}.dsk-diagnostics{width:min(640px,100%)}
.dsk-sidebar-action{position:relative;display:flex;flex:none;align-items:center;gap:8px;width:calc(100% + 4px);min-height:40px;margin:4px -2px 8px;padding:0 12px 0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);font-weight:500}
.dsk-sidebar-action:hover{background:var(--dsw-alias-button-tool-bar-hover);border-color:var(--dsw-alias-border-l3)}
.dsk-sidebar-action[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}
.dsk-sidebar-action[data-rail]{width:36px;height:36px;min-height:36px;margin:8px 0 10px;justify-content:center;gap:0;padding:0;border-color:transparent;border-radius:50%;background:transparent;font-weight:400}
.dsk-sidebar-action[data-rail]:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:transparent}
.dsk-sidebar-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsk-sidebar-badge{margin-left:auto;min-width:18px;border-radius:9px;padding:1px 5px;background:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-label-primary-inverted);font-size:10px;line-height:14px;text-align:center}
.dsk-sidebar-action[data-rail] .dsk-sidebar-badge{position:absolute;top:-4px;right:-4px;margin:0}
@media(max-width:900px){.dsk-root{grid-template-rows:auto auto auto auto minmax(0,1fr)}.dsk-topbar{align-items:stretch;flex-direction:column}.dsk-topbar nav{justify-content:flex-start}.dsk-filters{align-items:stretch;flex-wrap:wrap;overflow:visible}.dsk-filters label,.dsk-filters .dsk-search{min-width:calc(50% - 4px);flex:1}.dsk-board-scroll{padding:10px}.dsk-columns{grid-template-columns:repeat(7,minmax(210px,78vw));min-width:max-content}}
@media(max-width:560px){.dsk-filters label,.dsk-filters .dsk-search{min-width:100%}.dsk-topbar,.dsk-stats,.dsk-filters{padding-left:10px;padding-right:10px}.dsk-topbar nav button{flex:1}.dsk-modal-backdrop{padding:10px}}
@media(prefers-reduced-motion:reduce){.dsk-root *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;
		//#endregion
		//#region src/client/index.ts
		/** Services the browser plugin consumes. */
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"locale",
			"connection",
			"settingsScope",
			"remote",
			"remote.agentPresets"
		];
		/**
		* Register the sidebar action, full-shell overlay, dictionaries, styles, and live sources.
		* @param ctx - Client root Context.
		*/
		function apply(ctx) {
			const sessions = ctx.get("sessions");
			const workspaces = ctx.get("workspaces");
			const connection = ctx.get("connection");
			const settings = ctx.settingsScope.bind({
				namespace: SETTINGS_NAMESPACE,
				decode: decodeSettings
			});
			const remote = ctx.remote;
			const runtime = createRuntimeSource(sessions);
			const viewStore = createKanbanViewStore();
			const creator = new TaskCreator({
				sessions,
				agentPresets: remote.agentPresets
			});
			ctx.effect(() => () => {
				runtime.dispose();
			}, "ds-kanban: runtime subscriptions");
			ctx.effect(() => ctx.locale.register("dsKanban", {
				en,
				zh
			}), "ds-kanban: dictionaries");
			ctx.effect(() => {
				const tag = document.createElement("style");
				tag.dataset.plugin = "ds-kanban";
				tag.textContent = styles;
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, "ds-kanban: styles");
			const setSetting = async (field, value) => {
				await settings.set(field, value);
			};
			const setManual = async (sessionId, column) => {
				const current = settings.getSnapshot().value ?? DEFAULT_SETTINGS;
				await settings.set("manual", {
					...current.manual,
					[sessionId]: column
				});
			};
			const listPresets = () => fetchPresets(remote.agentPresets);
			const injected = (viewActions) => {
				return {
					hooks: {
						runtime,
						connectionGeneration: connection.generation,
						kanbanSettings: settings
					},
					openTask: (sessionId) => {
						sessions.open(sessionId);
						viewActions.close();
					},
					refresh: () => sessions.refresh(),
					archiveTask: async (sessionId) => {
						await workspaces.archiveSession(sessionId);
					},
					cancelTask: async (sessionId) => {
						const session = sessions.binding(sessionId)?.session;
						if (session === void 0) throw new Error(`unknown task "${String(sessionId)}"`);
						const result = await session.cancel();
						if (!result.ok) throw new Error(result.error.message);
					},
					copyTaskId: async (sessionId) => {
						await navigator.clipboard.writeText(sessionId);
					},
					createTask: (input) => creator.create(input),
					listPresets,
					setSetting,
					setManual
				};
			};
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "ds-kanban",
				order: -10,
				store: viewStore,
				locale: "dsKanban",
				inject: () => ({ hooks: {
					runtime,
					kanbanSettings: settings
				} })
			}, SidebarAction));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "ds-kanban",
				order: 10,
				store: viewStore,
				locale: "dsKanban",
				inject: injected
			}, KanbanBoard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map