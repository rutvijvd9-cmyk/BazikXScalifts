import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function CartRecoveryPage({ cartEvents = [] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-base">Abandoned Cart Recovery Queue</h3>
          <p className="text-xs text-gray-500 mt-0.5">Idle shopping carts received from custom PHP webhook</p>
        </div>
        <div className="text-xs font-semibold text-[#F5A623] bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
          Delay: 30 Minutes
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">Cart Token</th>
              <th className="px-6 py-3">Customer Phone</th>
              <th className="px-6 py-3">Cart Value</th>
              <th className="px-6 py-3">Items Summary</th>
              <th className="px-6 py-3">API User</th>
              <th className="px-6 py-3">Recovery Status</th>
              <th className="px-6 py-3">WhatsApp Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cartEvents.map((cart) => (
              <tr key={cart.id} className="hover:bg-gray-50/80 transition">
                <td className="px-6 py-4 font-mono text-xs text-gray-500">{cart.cart_token}</td>
                <td className="px-6 py-4 font-semibold text-gray-900">{cart.customer_phone}</td>
                <td className="px-6 py-4 font-bold text-gray-900">₹ {cart.cart_value.toFixed(2)}</td>
                <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                  {cart.items?.map((i) => i.item).join(", ") || "Selected Snacks"}
                </td>
                <td className="px-6 py-4 text-xs font-mono text-gray-600">
                  {cart.authenticated_user ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      🔑 {cart.authenticated_user}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs italic">Webhook</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      cart.status === "RECOVERED"
                        ? "bg-green-50 text-[#10B981] border border-green-200"
                        : "bg-amber-50 text-[#F5A623] border border-amber-200"
                    }`}
                  >
                    {cart.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {cart.message_sent ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Pending Timer
                    </span>
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
