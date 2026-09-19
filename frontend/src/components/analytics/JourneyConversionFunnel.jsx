import React from "react";
import { ShoppingCart, Send, Clock, CheckCircle2, Award, ChevronRight, Filter } from "lucide-react";

/**
 * JourneyConversionFunnel — HORIZONTAL, horizontally scrollable, LIGHT THEME.
 * Nodes come directly from flow.nodes as-is (no deduplication).
 * Drop-off % shown between each consecutive stage.
 * Click any stage card to filter the contacts table below.
 */
export default function JourneyConversionFunnel({
  flow,
  sessions = [],
  selectedStepId,
  onSelectStep
}) {
  const nodes = flow?.nodes || [];
  const totalEnrolled = sessions.length;

  /* ── Build stages from flow nodes exactly as they exist (preserving duplicates) ── */
  const buildFunnelStages = () => {
    const VALID_TYPES = ["trigger", "whatsapp_message", "action_whatsapp", "whatsapp", "delay", "condition", "goal", "exit"];

    if (!nodes || nodes.length === 0) {
      /* Fallback: generic stages from session data when no nodes are stored */
      const sentCount     = sessions.filter(s => (s.history || []).some(h => ["whatsapp_message","action_whatsapp","whatsapp"].includes(h.node_type))).length;
      const waitCount     = sessions.filter(s => s.status === "WAITING_DELAY" || (s.history || []).some(h => h.node_type === "delay")).length;
      const purchasedCnt  = sessions.filter(s => (s.history || []).some(h => h.branch === "YES")).length;
      const goalCount     = sessions.filter(s => s.status === "COMPLETED_GOAL").length;

      return [
        { id: "stage_trigger",   label: "Cart Triggered",  count: totalEnrolled, nodeType: "trigger" },
        { id: "stage_whatsapp",  label: "WhatsApp Sent",   count: sentCount,     nodeType: "whatsapp_message" },
        { id: "stage_wait",      label: "Wait / Delay",    count: waitCount,     nodeType: "delay" },
        { id: "stage_purchased", label: "Purchased? Yes",  count: purchasedCnt,  nodeType: "condition" },
        { id: "stage_goal",      label: "Goal Converted",  count: goalCount,     nodeType: "goal" },
      ];
    }

    /* Use every matching node exactly once per its position in the flow (no dedup) */
    return nodes
      .filter(n => VALID_TYPES.includes((n.type || "").toLowerCase()))
      .map((n, idx) => {
        const nid   = String(n.id);
        const ntype = (n.type || "").toLowerCase();
        const label = n.label || n.data?.label || ntype;

        const count = sessions.filter(s =>
          String(s.current_node_id) === nid ||
          (s.history || []).some(h => String(h.node_id) === nid)
        ).length || (ntype === "trigger" ? totalEnrolled : 0);

        return { id: nid, label, count, nodeType: ntype };
      });
  };

  /* ── Visual config per node type ── */
  const nodeConfig = {
    trigger:         { bg: "bg-blue-500",   ring: "ring-blue-400",   text: "text-white", light: "bg-blue-50 border-blue-200",   icon: ShoppingCart },
    whatsapp_message:{ bg: "bg-[#7C3AED]",  ring: "ring-violet-400", text: "text-white", light: "bg-violet-50 border-violet-200",icon: Send },
    action_whatsapp: { bg: "bg-[#7C3AED]",  ring: "ring-violet-400", text: "text-white", light: "bg-violet-50 border-violet-200",icon: Send },
    whatsapp:        { bg: "bg-[#7C3AED]",  ring: "ring-violet-400", text: "text-white", light: "bg-violet-50 border-violet-200",icon: Send },
    delay:           { bg: "bg-amber-500",  ring: "ring-amber-400",  text: "text-white", light: "bg-amber-50 border-amber-200",  icon: Clock },
    condition:       { bg: "bg-emerald-500",ring: "ring-emerald-400",text: "text-white", light: "bg-emerald-50 border-emerald-200",icon: CheckCircle2 },
    goal:            { bg: "bg-teal-500",   ring: "ring-teal-400",   text: "text-white", light: "bg-teal-50 border-teal-200",    icon: Award },
    exit:            { bg: "bg-teal-500",   ring: "ring-teal-400",   text: "text-white", light: "bg-teal-50 border-teal-200",    icon: Award },
  };
  const defaultCfg = nodeConfig.trigger;

  const stages = buildFunnelStages();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
          <h4 className="font-bold text-sm text-gray-900 tracking-wide">Journey Conversion Funnel</h4>
          <span className="text-xs text-gray-400 font-medium">— click any step to filter contacts below</span>
        </div>
        {selectedStepId && (
          <button
            onClick={() => onSelectStep(null)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 transition cursor-pointer"
          >
            <Filter className="w-3 h-3 text-gray-500" />
            Clear Filter
          </button>
        )}
      </div>

      {/* ── Horizontal scroll container ── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start gap-0 min-w-max">
          {stages.map((stage, idx) => {
            const cfg      = nodeConfig[stage.nodeType] || defaultCfg;
            const IconComp = cfg.icon;
            const isSelected = selectedStepId === stage.id;

            /* Drop-off between this stage and previous */
            const prevCount    = idx === 0 ? stage.count : stages[idx - 1].count;
            const dropOff      = Math.max(0, prevCount - stage.count);
            const dropOffPct   = prevCount > 0 ? ((dropOff / prevCount) * 100).toFixed(1) : "0.0";

            return (
              <div key={`${stage.id}_${idx}`} className="flex items-center">
                {/* Stage card */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectStep(isSelected ? null : stage.id)}
                    title={`Click to filter contacts at '${stage.label}'`}
                    className={`
                      group relative flex flex-col items-center gap-2 px-5 py-3.5 rounded-2xl
                      border-2 transition-all duration-200 cursor-pointer shadow-sm
                      min-w-[130px] max-w-[150px] text-center
                      ${isSelected
                        ? `${cfg.bg} ${cfg.text} border-transparent ring-2 ${cfg.ring} ring-offset-2 scale-105 shadow-md`
                        : `bg-white ${cfg.text.replace("text-white","text-gray-700")} border-gray-200 hover:border-gray-300 hover:shadow-md`
                      }
                    `}
                  >
                    {/* Icon circle */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-white/20" : cfg.bg
                    }`}>
                      <IconComp className={`w-4 h-4 ${isSelected ? "text-white" : "text-white"}`} />
                    </div>

                    {/* Label */}
                    <span className={`text-[11px] font-bold leading-tight ${isSelected ? "text-white" : "text-gray-700"}`}>
                      {stage.label}
                    </span>

                    {/* Count */}
                    <span className={`font-black font-mono text-xl leading-none ${isSelected ? "text-white" : "text-gray-900"}`}>
                      {stage.count.toLocaleString()}
                    </span>

                    {isSelected && (
                      <span className="absolute top-1.5 right-2 text-[8px] font-bold uppercase tracking-widest text-white/70">
                        Filtered
                      </span>
                    )}
                  </button>
                </div>

                {/* Arrow + Drop-off between stages */}
                {idx < stages.length - 1 && (
                  <div className="flex flex-col items-center mx-1">
                    {/* Drop-off pill */}
                    <div className="mb-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[9px] font-semibold text-red-500 whitespace-nowrap">
                      ▼ {dropOffPct}%
                    </div>
                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
