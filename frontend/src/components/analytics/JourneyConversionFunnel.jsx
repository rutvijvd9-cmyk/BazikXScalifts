import React, { useMemo } from "react";
import {
  ShoppingCart, Send, Clock, HelpCircle, Award, ChevronRight, Filter, GitBranch
} from "lucide-react";

const CFG = {
  trigger:         { bg: "bg-blue-500",   count: "text-blue-900",   icon: ShoppingCart },
  whatsapp_message:{ bg: "bg-violet-500", count: "text-violet-900", icon: Send },
  action_whatsapp: { bg: "bg-violet-500", count: "text-violet-900", icon: Send },
  whatsapp:        { bg: "bg-violet-500", count: "text-violet-900", icon: Send },
  delay:           { bg: "bg-amber-500",  count: "text-amber-900",  icon: Clock },
  condition:       { bg: "bg-purple-600", count: "text-purple-900", icon: HelpCircle },
  goal:            { bg: "bg-emerald-500",count: "text-emerald-900",icon: Award },
  exit:            { bg: "bg-teal-500",   count: "text-teal-900",   icon: Award },
};
const DEFAULT_CFG = CFG.trigger;

function resolveEdgeLabel(edge) {
  let label = edge.label || edge.data?.label || "";
  if (!label && edge.sourceHandle) {
    const h = String(edge.sourceHandle).toUpperCase();
    if (h.includes("YES") || h === "TRUE" || h === "1")      label = "YES";
    else if (h.includes("NO") || h === "FALSE" || h === "0") label = "NO";
    else label = edge.sourceHandle;
  }
  return label;
}

function NodeCard({ node, count, totalEnrolled, isSelected, onClick }) {
  const ntype = (node?.type || "").toLowerCase();
  const cfg   = CFG[ntype] || DEFAULT_CFG;
  const Icon  = cfg.icon;
  const pct   = totalEnrolled > 0 ? Math.round((count / totalEnrolled) * 100) : 0;
  let label   = node?.label || node?.data?.label || ntype;
  if (label.length > 18) label = label.slice(0, 16) + "…";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${count} contacts — ${pct}%`}
      className={`
        flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2
        cursor-pointer transition-all duration-150 shadow-sm shrink-0
        min-w-[110px] max-w-[120px] text-center
        ${isSelected
          ? `${cfg.bg} border-transparent ring-2 ring-offset-2 scale-105 shadow-lg`
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"}
      `}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className={`text-[10px] font-semibold leading-snug ${isSelected ? "text-white" : "text-gray-700"}`}>
        {label}
      </span>
      <span className={`font-black font-mono text-xl leading-none ${isSelected ? "text-white" : cfg.count}`}>
        {count}
      </span>
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cfg.bg}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[9px] font-mono ${isSelected ? "text-white/70" : "text-gray-400"}`}>{pct}%</span>
    </button>
  );
}

function BranchBadge({ label }) {
  const up = (label || "").toUpperCase();
  const isYes = up.includes("YES") || up.includes("READ") || up.includes("TRUE");
  const isNo  = up.includes("NO")  || up.includes("UNREAD") || up.includes("FALSE");
  const cls = isYes
    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
    : isNo
    ? "bg-red-50 border-red-300 text-red-700"
    : "bg-gray-100 border-gray-300 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black whitespace-nowrap border ${cls}`}>
      {label || "→"}
    </span>
  );
}

function FlowTreeNode({ nodeId, childMap, nodeMap, counts, total, selectedStepId, onSelectStep, visited }) {
  if (!nodeId || visited.has(nodeId)) return null;
  const node = nodeMap[nodeId];
  if (!node) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(nodeId);

  const children = childMap[nodeId] || [];
  const count    = counts[nodeId] ?? 0;
  const isSel    = selectedStepId === nodeId;

  const card = (
    <NodeCard
      node={node} count={count} totalEnrolled={total}
      isSelected={isSel}
      onClick={() => onSelectStep(isSel ? null : nodeId)}
    />
  );

  if (children.length === 0) {
    return <div className="flex items-start shrink-0">{card}</div>;
  }

  if (children.length === 1) {
    return (
      <div className="flex items-center gap-0 shrink-0">
        {card}
        <div className="flex flex-col items-center px-1 shrink-0">
          {children[0].label && <BranchBadge label={children[0].label} />}
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
        <FlowTreeNode
          nodeId={children[0].target}
          childMap={childMap} nodeMap={nodeMap} counts={counts} total={total}
          selectedStepId={selectedStepId} onSelectStep={onSelectStep}
          visited={nextVisited}
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0 shrink-0">
      {card}
      <div className="flex flex-col gap-4 shrink-0">
        {children.map((child, i) => {
          const childCount = counts[child.target] ?? 0;
          const childPct   = count > 0 ? Math.round((childCount / count) * 100) : 0;
          return (
            <div key={`${child.target}_${i}`} className="flex items-center gap-0 shrink-0">
              <div className="flex flex-col items-center gap-0.5 px-1 shrink-0 min-w-[54px]">
                {child.label
                  ? <BranchBadge label={child.label} />
                  : <span className="text-[9px] text-gray-400">Branch {i + 1}</span>
                }
                <span className="text-[8px] font-mono text-gray-400">{childPct}%</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
              <FlowTreeNode
                nodeId={child.target}
                childMap={childMap} nodeMap={nodeMap} counts={counts} total={total}
                selectedStepId={selectedStepId} onSelectStep={onSelectStep}
                visited={nextVisited}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JourneyConversionFunnel({ flow, sessions = [], selectedStepId, onSelectStep }) {
  const nodes = flow?.nodes || [];
  const edges = flow?.edges || [];
  const total = sessions.length;

  const { childMap, nodeMap, rootId, counts } = useMemo(() => {
    const VALID = new Set(["trigger","whatsapp_message","action_whatsapp","whatsapp","delay","condition","goal","exit"]);
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[String(n.id)] = n; });

    const childMap  = {};
    const hasParent = new Set();
    edges.forEach(e => {
      const src = String(e.source), tgt = String(e.target);
      if (!childMap[src]) childMap[src] = [];
      childMap[src].push({ target: tgt, label: resolveEdgeLabel(e) });
      hasParent.add(tgt);
    });

    const filtered = nodes.filter(n => VALID.has((n.type || "").toLowerCase()));
    const root = filtered.find(n => (n.type||"").toLowerCase() === "trigger")
              || filtered.find(n => !hasParent.has(String(n.id)))
              || filtered[0];

    const counts = {};
    sessions.forEach(s => {
      const seen = new Set();
      (s.history || []).forEach(h => { if (h.node_id) seen.add(String(h.node_id)); });
      if (s.current_node_id) seen.add(String(s.current_node_id));
      seen.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    });
    if (root) counts[String(root.id)] = total;

    return { childMap, nodeMap, rootId: root ? String(root.id) : null, counts };
  }, [nodes, edges, sessions, total]);

  /* fallback when no node/edge data */
  if (!rootId || nodes.length === 0) {
    const generic = [
      { id: "s1", label: "Cart Triggered", type: "trigger",          count: total },
      { id: "s2", label: "WhatsApp Sent",  type: "whatsapp_message", count: sessions.filter(s=>(s.history||[]).some(h=>["whatsapp_message","action_whatsapp"].includes(h.node_type))).length },
      { id: "s3", label: "Wait / Delay",   type: "delay",            count: sessions.filter(s=>s.status==="WAITING_DELAY"||(s.history||[]).some(h=>h.node_type==="delay")).length },
      { id: "s4", label: "Goal Converted", type: "goal",             count: sessions.filter(s=>s.status==="COMPLETED_GOAL").length },
    ];
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-gray-400" />
          <h4 className="font-bold text-sm text-gray-900">Journey Conversion Funnel</h4>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-0 min-w-max">
            {generic.map((s, i) => {
              const cfg = CFG[s.type] || DEFAULT_CFG;
              const Icon = cfg.icon;
              return (
                <div key={s.id} className="flex items-center gap-0">
                  <button type="button"
                    onClick={() => onSelectStep(selectedStepId===s.id ? null : s.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer min-w-[110px] text-center transition-all ${selectedStepId===s.id ? `${cfg.bg} border-transparent text-white` : "bg-white border-gray-200"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg}`}><Icon className="w-4 h-4 text-white" /></div>
                    <span className="text-[10px] font-semibold text-gray-700">{s.label}</span>
                    <span className={`font-black font-mono text-xl ${selectedStepId===s.id?"text-white":cfg.count}`}>{s.count}</span>
                  </button>
                  {i < generic.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 mx-0.5" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-gray-400" />
          <h4 className="font-bold text-sm text-gray-900">Journey Conversion Funnel</h4>
          <span className="text-[10px] text-gray-400 hidden sm:inline">
            — YES/NO branches show which path contacts took
          </span>
        </div>
        {selectedStepId && (
          <button onClick={() => onSelectStep(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 cursor-pointer transition">
            <Filter className="w-3 h-3" /> Clear Filter
          </button>
        )}
      </div>

      <div className="overflow-x-auto overflow-y-auto pb-3 max-h-[480px]">
        <div className="min-w-max py-2 px-1">
          <FlowTreeNode
            nodeId={rootId}
            childMap={childMap} nodeMap={nodeMap} counts={counts} total={total}
            selectedStepId={selectedStepId} onSelectStep={onSelectStep}
            visited={new Set()}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
        {[
          { c: "bg-blue-500",   l: "Trigger" },
          { c: "bg-violet-500", l: "WhatsApp" },
          { c: "bg-amber-500",  l: "Wait/Delay" },
          { c: "bg-purple-600", l: "Condition (branches)" },
          { c: "bg-emerald-500",l: "Goal" },
        ].map(x => (
          <div key={x.l} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${x.c}`} />
            <span className="text-[10px] text-gray-500">{x.l}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-700">YES</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 border border-red-300 text-red-700">NO</span>
          <span className="text-[9px] text-gray-400">= decision path</span>
        </div>
      </div>
    </div>
  );
}
