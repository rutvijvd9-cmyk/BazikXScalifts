import React, { useState } from "react";
import {
  Users, Search, RefreshCw, ShoppingCart, Send, Clock,
  CheckCircle2, Award, Filter, X, ChevronRight, ArrowRight
} from "lucide-react";
import { formatToIST } from "../../utils/dateUtils";
import JourneyConversionFunnel from "../analytics/JourneyConversionFunnel";

/* ─────────────────────────────────────────────────────────────────────────
   Node-type → badge appearance mapping
───────────────────────────────────────────────────────────────────────── */
const NODE_STYLES = {
  trigger: {
    bg: "bg-[#1a3a5c] border border-sky-500",
    text: "text-sky-200",
    icon: ShoppingCart,
    iconColor: "text-sky-400",
  },
  whatsapp_message: {
    bg: "bg-[#1a1a4a] border border-indigo-500",
    text: "text-indigo-200",
    icon: Send,
    iconColor: "text-indigo-400",
  },
  action_whatsapp: {
    bg: "bg-[#1a1a4a] border border-indigo-500",
    text: "text-indigo-200",
    icon: Send,
    iconColor: "text-indigo-400",
  },
  whatsapp: {
    bg: "bg-[#1a1a4a] border border-indigo-500",
    text: "text-indigo-200",
    icon: Send,
    iconColor: "text-indigo-400",
  },
  delay: {
    bg: "bg-[#3a2a00] border border-amber-500",
    text: "text-amber-200",
    icon: Clock,
    iconColor: "text-amber-400",
  },
  condition: {
    YES: {
      bg: "bg-[#0a3a1a] border border-emerald-500",
      text: "text-emerald-200",
      icon: CheckCircle2,
      iconColor: "text-emerald-400",
    },
    NO: {
      bg: "bg-[#3a0a0a] border border-red-500",
      text: "text-red-200",
      icon: X,
      iconColor: "text-red-400",
    },
  },
  goal: {
    bg: "bg-[#0a3a3a] border border-teal-500",
    text: "text-teal-200",
    icon: Award,
    iconColor: "text-teal-400",
  },
  exit: {
    bg: "bg-[#0a3a3a] border border-teal-500",
    text: "text-teal-200",
    icon: Award,
    iconColor: "text-teal-400",
  },
};

function getNodeStyle(step) {
  const t = (step.node_type || "").toLowerCase();
  if (t === "condition") {
    const branch = (step.branch || "").toUpperCase();
    return NODE_STYLES.condition[branch] || NODE_STYLES.condition.YES;
  }
  return NODE_STYLES[t] || NODE_STYLES.trigger;
}

/* ─────────────────────────────────────────────────────────────────────────
   Single step pill with icon + label + optional branch badge
───────────────────────────────────────────────────────────────────────── */
function StepPill({ step }) {
  const style = getNodeStyle(step);
  const IconComp = style.icon;
  const isCondition = (step.node_type || "").toLowerCase() === "condition";
  const branch = (step.branch || "").toUpperCase();

  let label = step.label || step.node_type || "Step";
  // Shorten long labels
  if (label.length > 20) label = label.slice(0, 18) + "…";

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${style.bg} ${style.text}`}>
      <IconComp className={`w-2.5 h-2.5 ${style.iconColor} shrink-0`} />
      <span>{label}</span>
      {isCondition && branch && (
        <span className={`ml-0.5 px-1 py-0.5 rounded text-[9px] font-black ${
          branch === "YES"
            ? "bg-emerald-500/30 text-emerald-300"
            : "bg-red-500/30 text-red-300"
        }`}>
          {branch}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Connector arrow between pills
───────────────────────────────────────────────────────────────────────── */
function Arrow() {
  return <ArrowRight className="w-3 h-3 text-gray-500 shrink-0 mx-0.5" />;
}

/* ─────────────────────────────────────────────────────────────────────────
   Status badge
───────────────────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    COMPLETED_GOAL:    { label: "🎯 Goal Converted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    WAITING_DELAY:     { label: "⏳ Waiting Delay",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    COMPLETED_DROPOUT: { label: "🚪 Journey Ended",  cls: "bg-gray-100 text-gray-600 border-gray-200" },
    ACTIVE:            { label: "⚡ In Journey",      cls: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const { label, cls } = map[status] || map.ACTIVE;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main Modal
───────────────────────────────────────────────────────────────────────── */
export default function JourneySessionsModal({ modalState, setModalState }) {
  const [selectedStepId, setSelectedStepId] = useState(null);

  if (!modalState.isOpen) return null;

  const sessions = modalState.sessions || [];
  const flow     = modalState.flow;

  /* ── KPI counts ── */
  const totalEnrolled = sessions.length;
  const activeCount   = sessions.filter(s => s.status === "ACTIVE").length;
  const waitingCount  = sessions.filter(s => s.status === "WAITING_DELAY").length;
  const goalCount     = sessions.filter(s => s.status === "COMPLETED_GOAL").length;
  const conversionPct = totalEnrolled > 0 ? ((goalCount / totalEnrolled) * 100).toFixed(1) : "0.0";

  /* ── Search + status filter ── */
  const term = (modalState.search || "").toLowerCase().trim();
  let filtered = sessions.filter(s => {
    if (modalState.statusFilter !== "ALL" && s.status !== modalState.statusFilter) return false;
    if (!term) return true;
    const phone  = (s.customer_phone || "").toLowerCase();
    const name   = (s.state_data?.customer_name || "").toLowerCase();
    const token  = (s.state_data?.cart_token || "").toLowerCase();
    const status = (s.status || "").toLowerCase();
    return phone.includes(term) || name.includes(term) || token.includes(term) || status.includes(term);
  });

  /* ── Funnel step filter ── */
  if (selectedStepId && selectedStepId.startsWith("stage_")) {
    // Generic stage filtering
    const stageMap = {
      stage_trigger:   s => true,
      stage_whatsapp:  s => (s.history || []).some(h => h.node_type === "whatsapp_message" || h.node_type === "action_whatsapp"),
      stage_wait:      s => s.status === "WAITING_DELAY" || (s.history || []).some(h => h.node_type === "delay"),
      stage_purchased: s => (s.history || []).some(h => h.branch === "YES"),
      stage_goal:      s => s.status === "COMPLETED_GOAL",
    };
    const fn = stageMap[selectedStepId];
    if (fn) filtered = filtered.filter(fn);
  } else if (selectedStepId) {
    // Filter by exact node_id in history or current_node
    filtered = filtered.filter(s =>
      String(s.current_node_id) === selectedStepId ||
      (s.history || []).some(h => String(h.node_id) === selectedStepId)
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f172a] rounded-2xl w-full max-w-6xl shadow-2xl border border-gray-800 max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/50 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-white leading-tight">
                  {flow?.name || "Automation Journey"} — Enrolled Contacts &amp; Analytics
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700">
                  ⚡ {flow?.trigger_type}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Conversion funnel · exact journey path per contact · real-time session tracking
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
            className="text-gray-500 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── TIER 1: KPI summary bar ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Enrolled", value: totalEnrolled, color: "text-sky-400", bg: "bg-sky-900/20 border-sky-800" },
              { label: "Active in Flow", value: activeCount + waitingCount, color: "text-indigo-400", bg: "bg-indigo-900/20 border-indigo-800" },
              { label: "Goal Converted", value: goalCount, color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-800" },
              { label: "Conversion Rate", value: `${conversionPct}%`, color: "text-teal-400", bg: "bg-teal-900/20 border-teal-800" },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{k.label}</div>
                <div className={`text-2xl font-black font-mono ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* ── TIER 2: Journey Conversion Funnel ── */}
          {modalState.loading ? (
            <div className="py-8 flex justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : (
            <JourneyConversionFunnel
              flow={flow}
              sessions={sessions}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
            />
          )}

          {/* ── TIER 3: Contact Path Inspector ── */}
          <div className="bg-[#0f172a] border border-gray-800 rounded-2xl overflow-hidden">
            {/* Sub-header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 bg-[#111827]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-gray-200">
                  Enrolled Contacts &amp; Step-by-Step Path Inspector
                </span>
                {selectedStepId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700">
                    {filtered.length} filtered
                  </span>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search phone, name…"
                  value={modalState.search}
                  onChange={e => setModalState(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-52"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 p-1 rounded-lg text-xs">
                {[
                  { v: "ALL", label: "All" },
                  { v: "ACTIVE", label: "Active" },
                  { v: "WAITING_DELAY", label: "Waiting" },
                  { v: "COMPLETED_GOAL", label: "Goal Met" },
                  { v: "COMPLETED_DROPOUT", label: "Exited" },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setModalState(prev => ({ ...prev, statusFilter: v }))}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                      modalState.statusFilter === v
                        ? "bg-gray-700 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {modalState.loading ? (
              <div className="py-16 flex flex-col items-center gap-2 text-gray-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Loading enrolled contacts and pathway sessions…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-500 space-y-2">
                <Users className="w-8 h-8 mx-auto text-gray-700" />
                <p className="text-sm font-semibold text-gray-400">No Enrolled Contacts Found</p>
                <p className="text-xs text-gray-600 max-w-xs mx-auto">
                  {sessions.length === 0
                    ? "No contacts have triggered or traversed this automation journey yet."
                    : "No sessions matched your filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-400 min-w-[800px]">
                  <thead className="bg-[#111827] text-[10px] uppercase font-semibold text-gray-500 border-b border-gray-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Contact / Phone</th>
                      <th className="px-4 py-3 whitespace-nowrap">Customer Name</th>
                      <th className="px-4 py-3 whitespace-nowrap">Enrolled Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Current Status</th>
                      <th className="px-4 py-3">Journey Path Traveled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {filtered.map(s => {
                      const state = s.state_data || {};
                      const hist  = s.history || [];

                      return (
                        <tr key={s.id} className="hover:bg-gray-800/30 transition">
                          {/* Contact phone */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-gray-100 font-mono flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              {s.customer_phone}
                            </div>
                            {state.cart_value !== undefined && (
                              <div className="text-[10px] text-emerald-500 font-mono mt-0.5">
                                ₹{state.cart_value}
                              </div>
                            )}
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3.5 text-gray-300">
                            {state.customer_name || "Online Customer"}
                          </td>

                          {/* Enrolled */}
                          <td className="px-4 py-3.5 font-mono text-[10px] text-gray-500 whitespace-nowrap">
                            {formatToIST(s.created_at)}
                          </td>

                          {/* Status badge */}
                          <td className="px-4 py-3.5">
                            <StatusBadge status={s.status} />
                          </td>

                          {/* Journey Path Trail — core feature */}
                          <td className="px-4 py-3.5">
                            {hist.length === 0 ? (
                              <span className="text-gray-600 text-[10px] italic">No steps recorded yet</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1">
                                {hist.map((step, i) => (
                                  <React.Fragment key={i}>
                                    <StepPill step={step} />
                                    {i < hist.length - 1 && <Arrow />}
                                  </React.Fragment>
                                ))}
                                {s.status === "COMPLETED_GOAL" && (
                                  <>
                                    <Arrow />
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-teal-900/50 border border-teal-500 text-teal-200">
                                      <Award className="w-2.5 h-2.5 text-teal-400" />
                                      Goal Converted 🎯
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
