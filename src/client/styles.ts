/** Plugin-owned stylesheet; every color resolves through Harness theme tokens. */
export const styles = String.raw`
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
.dsk-stats button{display:flex;min-width:92px;flex-direction:column;align-items:flex-start;padding:8px 10px;text-align:left}
.dsk-stats strong{font-size:17px}.dsk-stats span{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dsk-filters{display:flex;align-items:flex-end;gap:8px;padding:10px 18px;border-bottom:1px solid var(--dsw-alias-border-l1);overflow-x:auto;background:var(--dsw-alias-bg-layer-1)}
.dsk-filters label{display:flex;min-width:130px;flex-direction:column;gap:4px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dsk-filters label>span{white-space:nowrap}.dsk-filters input,.dsk-filters select,.dsk-modal input,.dsk-modal select,.dsk-modal textarea{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 9px;background:var(--dsw-specific-input-major)}
.dsk-filters .dsk-search{min-width:240px;flex:1}.dsk-filters .dsk-check{min-width:max-content;flex-direction:row;align-items:center;padding-bottom:8px;color:var(--dsw-alias-label-primary)}
.dsk-filters .dsk-check input{min-height:auto}
.dsk-board-scroll{min-height:0;overflow:auto;padding:14px 18px 24px}
.dsk-columns{display:grid;grid-template-columns:repeat(6,minmax(230px,1fr));gap:10px;min-width:1420px;align-items:start}
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
.dsk-card[data-card-column=done]{--dsh-card-status:var(--dsw-alias-state-success-primary)}
.dsk-card:hover{border-color:var(--dsw-alias-border-l3);border-left-color:var(--dsh-card-status);background:var(--dsw-alias-interactive-bg-hover)}
.dsk-card[draggable=true]{cursor:grab}.dsk-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:7px}.dsk-card-head strong{min-width:0;overflow-wrap:anywhere;font-size:13px;line-height:18px}
.dsk-status{flex:none;border-radius:8px;padding:2px 5px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10px}
.dsk-status-inbox{color:var(--dsw-alias-label-secondary)}.dsk-status-ready{color:var(--dsw-alias-state-business-primary)}.dsk-status-running{color:var(--dsw-alias-brand-text)}.dsk-status-waiting{color:var(--dsw-alias-state-warn-label)}.dsk-status-blocked{color:var(--dsw-alias-state-error-primary)}.dsk-status-done{color:var(--dsw-alias-state-success-primary)}
.dsk-card-sub{margin-top:5px;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.dsk-card-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.dsk-card-badges span{border-radius:7px;padding:2px 5px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10px}.dsk-card-badges span[data-warning=true]{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}
.dsk-context-bar{height:4px;margin-top:8px;border-radius:2px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}
.dsk-context-bar>span{display:block;height:100%;border-radius:2px}
.dsk-context-bar>span[data-tone=ok]{background:var(--dsw-alias-state-success-primary)}
.dsk-context-bar>span[data-tone=warn]{background:var(--dsw-alias-state-warn-primary)}
.dsk-context-bar>span[data-tone=critical]{background:var(--dsw-alias-state-error-primary)}
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
@media(max-width:900px){.dsk-root{grid-template-rows:auto auto auto auto minmax(0,1fr)}.dsk-topbar{align-items:stretch;flex-direction:column}.dsk-topbar nav{justify-content:flex-start}.dsk-filters{align-items:stretch;flex-wrap:wrap;overflow:visible}.dsk-filters label,.dsk-filters .dsk-search{min-width:calc(50% - 4px);flex:1}.dsk-board-scroll{padding:10px}.dsk-columns{grid-template-columns:repeat(6,minmax(210px,78vw));min-width:max-content}}
@media(max-width:560px){.dsk-filters label,.dsk-filters .dsk-search{min-width:100%}.dsk-topbar,.dsk-stats,.dsk-filters{padding-left:10px;padding-right:10px}.dsk-topbar nav button{flex:1}.dsk-modal-backdrop{padding:10px}}
@media(prefers-reduced-motion:reduce){.dsk-root *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`
