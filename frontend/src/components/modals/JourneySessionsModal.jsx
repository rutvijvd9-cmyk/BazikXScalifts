import React from "react";
import { Users, Search, RefreshCw } from "lucide-react";
import { formatToIST } from "../../utils/dateUtils";

export default function JourneySessionsModal({
  modalState,
  setModalState
}) {
  if (!modalState.isOpen) return null;

  const term = (modalState.search || "").toLowerCase().trim();
  const filtered = (modalState.sessions || []).filter((s) => {
    if (modalState.statusFilter !== "ALL" && s.status !== modalState.statusFilter) {
      return false;
    }
    if (!term) return true;
    const phone = (s.customer_phone || "").toLowerCase();
    const name = (s.state_data?.customer_name || "").toLowerCase();
    const token = (s.state_data?.cart_token || "").toLowerCase();
    const status = (s.status || "").toLowerCase();
    return phone.includes(term) || name.includes(term) || token.includes(term) || status.includes(term);
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#25D366] flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-gray-900 leading-tight">
                  {modalState.flow?.name || "Automation Journey"} — Enrolled Contacts
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  ⚡ {modalState.flow?.trigger_type}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time list of customers who entered this automation journey, their current node, and action history
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 border-b border-gray-100">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by phone, customer name, cart..."
              value={modalState.search}
              onChange={(e) => setModalState((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Status:</span>
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200 text-xs">
              {["ALL", "ACTIVE", "WAITING_DELAY", "COMPLETED_GOAL", "COMPLETED_DROPOUT"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setModalState((prev) => ({ ...prev, statusFilter: st }))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    modalState.statusFilter === st
                      ? "bg-white text-gray-900 shadow-xs font-bold"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {st === "ALL"
                    ? "All"
                    : st === "WAITING_DELAY"
                    ? "Waiting Delay"
                    : st === "COMPLETED_GOAL"
                    ? "Goal Met"
                    : st === "COMPLETED_DROPOUT"
                    ? "Exited"
                    : "Active"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contacts & Sessions Table */}
        <div className="flex-1 overflow-y-auto pt-2">
          {modalState.loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#25D366]" />
              <span>Loading enrolled contacts and pathway sessions...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No Enrolled Contacts Found</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                {modalState.sessions.length === 0
                  ? "No contacts have triggered or traversed this automation journey yet."
                  : "No sessions matched your search filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[11px] uppercase font-semibold text-gray-500 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Customer Phone & Name</th>
                    <th className="px-4 py-3">Cart / Data</th>
                    <th className="px-4 py-3">Current Journey Stage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Enrolled At (IST)</th>
                    <th className="px-4 py-3 text-right">Step History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s) => {
                    const state = s.state_data || {};
                    const hist = s.history || [];
                    const lastStep = hist.length > 0 ? hist[hist.length - 1] : null;

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80 transition">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-gray-900 font-mono text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                            {s.customer_phone}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {state.customer_name || "Online Customer"}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {state.cart_value !== undefined ? (
                            <div>
                              <span className="font-bold text-gray-900 font-mono">₹{state.cart_value}</span>
                              {state.items_summary && (
                                <div className="text-[10px] text-gray-400 truncate max-w-[160px]" title={state.items_summary}>
                                  {state.items_summary}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-gray-800 text-xs">
                            {lastStep?.label || s.current_node_id || "In Progress"}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === "COMPLETED_GOAL"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : s.status === "WAITING_DELAY"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : s.status === "COMPLETED_DROPOUT"
                              ? "bg-gray-100 text-gray-600 border border-gray-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            {s.status === "COMPLETED_GOAL" ? "🎯 Goal Converted" :
                             s.status === "WAITING_DELAY" ? "⏳ Waiting Delay" :
                             s.status === "COMPLETED_DROPOUT" ? "🚪 Journey Ended" : "⚡ In Journey"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {formatToIST(s.created_at)}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-mono font-bold">
                            {hist.length} step{hist.length === 1 ? "" : "s"} passed
                          </span>
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
  );
}
