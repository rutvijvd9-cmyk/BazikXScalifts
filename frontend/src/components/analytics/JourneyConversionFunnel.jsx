import React from "react";
import { ShoppingCart, Send, Clock, CheckCircle2, Award, ChevronDown, Filter } from "lucide-react";

/**
 * JourneyConversionFunnel
 * Renders the vertical tiered funnel matching Screenshot 1:
 * - Dynamic stage cards calculated from actual workflow sessions or flowchart nodes
 * - Drop-off rates and curvature indicators between steps
 * - Interactive step selection to filter contacts below
 */
export default function JourneyConversionFunnel({
  flow,
  sessions = [],
  selectedStepId,
  onSelectStep
}) {
  const nodes = flow?.nodes || [];
  const totalEnrolled = sessions.length;

  const buildFunnelStages = () => {
    if (!nodes || nodes.length === 0) {
      const cartCount = totalEnrolled;
      const sentCount = sessions.filter(s => (s.history || []).some(h => h.node_type === "whatsapp_message" || (h.details && h.details.includes("template")))).length;
      const waitCount = sessions.filter(s => s.status === "WAITING_DELAY" || (s.history || []).some(h => h.node_type === "delay")).length;
      const purchasedCount = sessions.filter(s => (s.history || []).some(h => h.branch === "YES" || (h.details && h.details.includes("YES")))).length;
      const goalCount = sessions.filter(s => s.status === "COMPLETED_GOAL").length;

      return [
        { id: "stage_trigger", label: "Cart Triggered", count: cartCount, color: "from-blue-600 to-sky-500", borderColor: "border-sky-400", icon: ShoppingCart },
        { id: "stage_whatsapp", label: "WhatsApp Sent", count: sentCount, color: "from-indigo-600 to-purple-600", borderColor: "border-indigo-400", icon: Send },
        { id: "stage_wait", label: "Wait 15m", count: waitCount, color: "from-amber-600 to-yellow-500", borderColor: "border-amber-400", icon: Clock },
        { id: "stage_purchased", label: "Purchased? Yes", count: purchasedCount, color: "from-emerald-600 to-green-500", borderColor: "border-emerald-400", icon: CheckCircle2 },
        { id: "stage_goal", label: "Goal Converted", count: goalCount, color: "from-teal-500 to-cyan-500", borderColor: "border-teal-400", icon: Award }
      ];
    }

    return nodes
      .filter(n => ["trigger", "whatsapp_message", "action_whatsapp", "delay", "condition", "goal", "exit"].includes(n.type?.toLowerCase()))
      .map(n => {
        const nid = String(n.id);
        const ntype = n.type?.toLowerCase();

        let count = sessions.filter(s => {
          if (String(s.current_node_id) === nid) return true;
          return (s.history || []).some(h => String(h.node_id) === nid);
        }).length;

        if (ntype === "trigger" && count === 0) {
          count = totalEnrolled;
        }

        let label = n.label || n.data?.label || "Step";
        let color = "from-blue-600 to-sky-500";
        let borderColor = "border-sky-400";
        let icon = ShoppingCart;

        if (ntype === "trigger") {
          label = n.label || "Cart Triggered";
          color = "from-sky-700 to-blue-600";
          borderColor = "border-sky-400";
          icon = ShoppingCart;
        } else if (ntype.includes("whatsapp")) {
          label = n.label || "WhatsApp Sent";
          color = "from-indigo-700 to-purple-600";
          borderColor = "border-indigo-400";
          icon = Send;
        } else if (ntype === "delay") {
          label = n.label || `Wait ${n.data?.delay_minutes || 15}m`;
          color = "from-amber-700 to-yellow-600";
          borderColor = "border-amber-400";
          icon = Clock;
        } else if (ntype === "condition") {
          label = n.label || "Purchased? Yes";
          color = "from-emerald-700 to-green-600";
          borderColor = "border-emerald-400";
          icon = CheckCircle2;
        } else if (ntype === "goal" || ntype === "exit") {
          label = n.label || "Goal Converted";
          color = "from-teal-600 to-cyan-600";
          borderColor = "border-teal-400";
          icon = Award;
        }

        return { id: nid, label, count, color, borderColor, icon, type: ntype };
      });
  };

  const stages = buildFunnelStages();

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-xl text-white relative overflow-hidden">
      {/* Funnel Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h4 className="font-bold text-sm tracking-wide text-gray-100">Journey Conversion Funnel</h4>
        </div>
        {selectedStepId && (
          <button
            onClick={() => onSelectStep(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 transition cursor-pointer"
          >
            <Filter className="w-3 h-3 text-emerald-400" />
            <span>Clear Filter</span>
          </button>
        )}
      </div>

      {/* Funnel Visual Stack with Drop-off curves */}
      <div className="flex flex-col items-center py-2 max-w-md mx-auto relative">
        {stages.map((stage, idx) => {
          const prevCount = idx === 0 ? stage.count : stages[idx - 1].count;
          const dropOffCount = Math.max(0, prevCount - stage.count);
          const dropOffPct = prevCount > 0 ? ((dropOffCount / prevCount) * 100).toFixed(1) : "0.0";
          const isSelected = selectedStepId === stage.id;
          const IconComp = stage.icon;

          return (
            <React.Fragment key={stage.id}>
              {/* Drop-off connector arrow between stages (from index 1 onward) */}
              {idx > 0 && (
                <div className="w-full flex items-center justify-center my-1 relative h-9">
                  {/* Vertical Arrow */}
                  <div className="w-0.5 h-full bg-gradient-to-b from-gray-600 to-gray-700 relative">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Drop-off indicator pill on the right side */}
                  <div className="absolute right-0 sm:right-4 flex items-center gap-1 bg-red-950/60 border border-red-800/60 px-2.5 py-0.5 rounded-full text-[10px] text-red-300 font-mono shadow-xs">
                    <span className="text-red-400 font-bold">▼</span>
                    <span>{dropOffPct}% Drop-off</span>
                  </div>
                </div>
              )}

              {/* Funnel Stage Card */}
              <button
                type="button"
                onClick={() => onSelectStep(isSelected ? null : stage.id)}
                className={`w-full max-w-sm py-2.5 px-4 rounded-xl border transition-all duration-200 cursor-pointer text-center relative overflow-hidden group shadow-md ${
                  isSelected
                    ? `ring-2 ring-white border-white bg-gradient-to-r ${stage.color} scale-[1.02]`
                    : `bg-gradient-to-r ${stage.color} hover:brightness-110 ${stage.borderColor} border`
                }`}
                title={`Click to filter contacts at '${stage.label}'`}
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComp className="w-4 h-4 text-white/90" />
                    <span className="text-xs font-bold text-white tracking-wide">{stage.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-base text-white">{stage.count.toLocaleString()}</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute top-1 right-2 text-[9px] font-bold text-white/80 uppercase tracking-widest">
                    Filtered
                  </div>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
