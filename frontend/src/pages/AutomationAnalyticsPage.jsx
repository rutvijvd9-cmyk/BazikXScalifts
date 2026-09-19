import React, { useState } from "react";
import {
  ArrowLeft, Users, GitBranch, Search, RefreshCw,
  ShoppingCart, Send, Clock, CheckCircle2, Award, X, ArrowRight
} from "lucide-react";
import { formatToIST } from "../utils/dateUtils";
import AnalyticsFlowCanvas from "../components/analytics/AnalyticsFlowCanvas";

/* ── Step pill ── */
const NODE_STYLES = {
  trigger:         { bg: "bg-blue-50 border border-blue-300",    text: "text-blue-700",   icon: ShoppingCart, ic: "text-blue-500" },
  whatsapp_message:{ bg: "bg-violet-50 border border-violet-300",text: "text-violet-700", icon: Send,         ic: "text-violet-500" },
  action_whatsapp: { bg: "bg-violet-50 border border-violet-300",text: "text-violet-700", icon: Send,         ic: "text-violet-500" },
  whatsapp:        { bg: "bg-violet-50 border border-violet-300",text: "text-violet-700", icon: Send,         ic: "text-violet-500" },
  delay:           { bg: "bg-amber-50 border border-amber-300",  text: "text-amber-700",  icon: Clock,        ic: "text-amber-500" },
  condition: {
    YES: { bg: "bg-emerald-50 border border-emerald-300", text: "text-emerald-700", icon: CheckCircle2, ic: "text-emerald-500" },
    NO:  { bg: "bg-red-50 border border-red-300",         text: "text-red-700",     icon: X,            ic: "text-red-500" },
  },
  goal: { bg: "bg-teal-50 border border-teal-300", text: "text-teal-700", icon: Award, ic: "text-teal-500" },
  exit: { bg: "bg-teal-50 border border-teal-300", text: "text-teal-700", icon: Award, ic: "text-teal-500" },
};

function getStyle(step) {
  const t = (step.node_type || "").toLowerCase();
  if (t === "condition") {
    const b = (step.branch || "").toUpperCase();
    return NODE_STYLES.condition[b] || NODE_STYLES.condition.YES;
  }
  return NODE_STYLES[t] || NODE_STYLES.trigger;
}

function StepPill({ step }) {
  const s  = getStyle(step);
  const IC = s.icon;
  const isCond  = (step.node_type || "").toLowerCase() === "condition";
  const branch  = (step.branch || "").toUpperCase();
  let label = step.label || step.node_type || "Step";
  if (label.length > 22) label = label.slice(0, 20) + "…";
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${s.bg} ${s.text}`}>
      <IC className={`w-2.5 h-2.5 ${s.ic} shrink-0`} />
      <span>{label}</span>
      {isCond && branch && (
        <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-black ${
          branch === "YES" ? "bg-emerald-200 text-emerald-800" : "bg-red-200 text-red-800"
        }`}>{branch}</span>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    COMPLETED_GOAL:    { label: "🎯 Goal Converted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    WAITING_DELAY:     { label: "⏳ Waiting",         cls: "bg-amber-50 text-amber-700 border-amber-200" },
    COMPLETED_DROPOUT: { label: "🚪 Exited",          cls: "bg-gray-100 text-gray-600 border-gray-200" },
    ACTIVE:            { label: "⚡ Active",           cls: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const { label, cls } = map[status] || map.ACTIVE;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>{label}</span>;
}

/* ══════════════════════════════════════════
   FULL-PAGE AUTOMATION ANALYTICS
══════════════════════════════════════════ */
export default function AutomationAnalyticsPage({ flow, sessions, loading, onBack }) {
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [activeTab, setActiveTab]           = useState("funnel");
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState("ALL");

  const totalEnrolled = sessions.length;
  const activeCount   = sessions.filter(s => s.status === "ACTIVE").length;
  const waitingCount  = sessions.filter(s => s.status === "WAITING_DELAY").length;
  const goalCount     = sessions.filter(s => s.status === "COMPLETED_GOAL").length;
  const convPct       = totalEnrolled > 0 ? ((goalCount / totalEnrolled) * 100).toFixed(1) : "0.0";

  /* Filter sessions for contacts tab */
  const term = search.toLowerCase().trim();
  let filtered = sessions.filter(s => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (!term) return true;
    return (s.customer_phone||"").toLowerCase().includes(term)
        || (s.state_data?.customer_name||"").toLowerCase().includes(term)
        || (s.status||"").toLowerCase().includes(term);
  });
  if (selectedStepId && !selectedStepId.startsWith("stage_")) {
    filtered = filtered.filter(s =>
      String(s.current_node_id) === selectedStepId ||
      (s.history||[]).some(h => String(h.node_id) === selectedStepId)
    );
  }

  return (
    <div className="h-screen max-h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0 sticky top-0 z-20">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600
            hover:bg-gray-100 border border-gray-200 transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900 leading-tight">
              {flow?.name || "Automation"} — Analytics
            </h1>
            <p className="text-[11px] text-gray-400">Journey funnel · contact path inspector · real-time session tracking</p>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {flow?.trigger_type}
          </span>
        </div>
      </div>

      {/* ── KPI bar ── */}
      <div className="bg-white border-b border-gray-200 grid grid-cols-4 flex-shrink-0">
        {[
          { label: "Total Enrolled",  value: totalEnrolled },
          { label: "Active in Flow",  value: activeCount + waitingCount },
          { label: "Goal Converted",  value: goalCount },
          { label: "Conversion Rate", value: `${convPct}%` },
        ].map((k, i) => (
          <div key={k.label} className={`px-8 py-4 ${i < 3 ? "border-r border-gray-100" : ""}`}>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{k.label}</div>
            <div className="text-2xl font-black font-mono text-gray-900 mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
        {[
          { id: "funnel",   icon: GitBranch, label: "Journey Funnel" },
          { id: "contacts", icon: Users,     label: "Enrolled Contacts" },
        ].map(tab => {
          const IC = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
              }`}>
              <IC className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === "contacts" && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {sessions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">

        {/* FUNNEL TAB */}
        {activeTab === "funnel" && (
          <div className="flex-1 h-full w-full relative flex flex-col overflow-hidden">
            {loading ? (
              <div className="py-24 flex justify-center"><RefreshCw className="w-7 h-7 animate-spin text-gray-400" /></div>
            ) : (
              <AnalyticsFlowCanvas
                flow={flow}
                sessions={sessions}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
                onViewContactsAtStep={() => setActiveTab("contacts")}
              />
            )}
          </div>
        )}

        {/* CONTACTS TAB */}
        {activeTab === "contacts" && (
          <div className="flex-1 overflow-y-auto">
            {/* Filter bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-3 sticky top-0 z-10">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search phone, name…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 w-52" />
              </div>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                {[
                  { v: "ALL",               l: "All" },
                  { v: "ACTIVE",            l: "Active" },
                  { v: "WAITING_DELAY",     l: "Waiting" },
                  { v: "COMPLETED_GOAL",    l: "Goal Met" },
                  { v: "COMPLETED_DROPOUT", l: "Exited" },
                ].map(({ v, l }) => (
                  <button key={v} type="button"
                    onClick={() => setStatusFilter(v)}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      statusFilter === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">{filtered.length} contacts</span>
              {selectedStepId && (
                <button onClick={() => setSelectedStepId(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer">
                  Filtered by step — Clear
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-24 flex flex-col items-center gap-2 text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-xs">Loading contacts…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700">No Contacts Found</p>
                <p className="text-xs text-gray-400">No sessions matched your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-[10px] uppercase font-semibold text-gray-500 border-b border-gray-200 sticky top-[57px] z-10">
                    <tr>
                      <th className="px-6 py-3 whitespace-nowrap">Contact / Phone</th>
                      <th className="px-6 py-3 whitespace-nowrap">Name</th>
                      <th className="px-6 py-3 whitespace-nowrap">Cart Value</th>
                      <th className="px-6 py-3 whitespace-nowrap">Enrolled Date</th>
                      <th className="px-6 py-3 whitespace-nowrap">Status</th>
                      <th className="px-6 py-3">Journey Path Traveled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filtered.map(s => {
                      const st   = s.state_data || {};
                      const hist = s.history    || [];
                      return (
                        <tr key={s.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 font-mono flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" />
                              {s.customer_phone}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-700">{st.customer_name || "Online Customer"}</td>
                          <td className="px-6 py-4 font-mono text-emerald-600 font-semibold">
                            {st.cart_value !== undefined ? `₹${st.cart_value}` : "—"}
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-gray-500 whitespace-nowrap">
                            {formatToIST(s.created_at)}
                          </td>
                          <td className="px-6 py-4"><StatusBadge status={s.status} /></td>
                          <td className="px-6 py-4">
                            {hist.length === 0 ? (
                              <span className="text-gray-400 italic text-[10px]">No steps yet</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1">
                                {hist.map((step, i) => (
                                  <React.Fragment key={i}>
                                    <StepPill step={step} />
                                    {i < hist.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />}
                                  </React.Fragment>
                                ))}
                                {s.status === "COMPLETED_GOAL" && (
                                  <>
                                    <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 border border-teal-300 text-teal-700">
                                      <Award className="w-2.5 h-2.5 text-teal-500" />Goal 🎯
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
        )}
      </div>
    </div>
  );
}
