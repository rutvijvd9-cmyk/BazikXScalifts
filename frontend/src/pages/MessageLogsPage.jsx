import React from "react";
import { formatToIST } from "../utils/dateUtils";

export default function MessageLogsPage({ messageLogs = [] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-base">Complete WhatsApp Audit Trail</h3>
          <p className="text-xs text-gray-500 mt-0.5">Full delivery logs with Meta message IDs</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">Recipient Phone</th>
              <th className="px-6 py-3">Template</th>
              <th className="px-6 py-3">Meta Message ID</th>
              <th className="px-6 py-3">Timestamp</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {messageLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50/80 transition">
                <td className="px-6 py-4 font-semibold text-gray-900">{log.recipient_phone}</td>
                <td className="px-6 py-4 font-mono text-xs">{log.template_name}</td>
                <td className="px-6 py-4 font-mono text-xs text-gray-500">{log.meta_message_id}</td>
                <td className="px-6 py-4 text-xs font-mono text-gray-500">
                  {formatToIST(log.created_at)}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    log.status === "FAILED"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : log.status.startsWith("BLOCKED")
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : log.status === "SENT_SIMULATED"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-[#10B981] border border-emerald-200"
                  }`}>
                    {log.status}
                  </span>
                  {log.error_message && (
                    <p className="text-[10px] text-red-600 font-mono mt-1 max-w-xs truncate" title={log.error_message}>
                      {log.error_message}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
