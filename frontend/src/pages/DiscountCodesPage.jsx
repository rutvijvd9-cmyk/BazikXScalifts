import React from "react";
import { Plus, Ticket, Calendar, Trash2 } from "lucide-react";

export default function DiscountCodesPage({
  discountCodes = [],
  setIsDiscountModalOpen,
  handleDeleteDiscountCode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-base">Discount Codes & Coupons</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Coupons linked with WhatsApp abandoned cart recovery & VIP milestone rewards
          </p>
        </div>
        <button
          onClick={() => setIsDiscountModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Coupon Code
        </button>
      </div>

      {discountCodes.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-[#F5A623] flex items-center justify-center mx-auto mb-3">
            <Ticket className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-gray-900 text-sm">No Discount Codes Yet</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
            Create promo codes to reward loyal customers and recover abandoned shopping carts with special deals.
          </p>
          <button
            onClick={() => setIsDiscountModalOpen(true)}
            className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs"
          >
            + Create First Coupon
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Coupon Code</th>
                <th className="px-6 py-3">Type & Value</th>
                <th className="px-6 py-3">Min Order</th>
                <th className="px-6 py-3">Redemptions</th>
                <th className="px-6 py-3">Expiry Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {discountCodes.map((d) => {
                const isExpired = d.expires_at && new Date(d.expires_at) < new Date();
                return (
                  <tr key={d.id} className="hover:bg-gray-50/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-base text-gray-900 flex items-center gap-2">
                      <span className="p-1 bg-amber-50 text-[#D35400] rounded border border-amber-200 text-xs">🏷️</span>
                      {d.code}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {d.discount_type === "PERCENT" ? `${d.discount_value}% OFF` : `₹${d.discount_value} FLAT OFF`}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-gray-600">
                      {d.min_order_value > 0 ? `₹${d.min_order_value}` : "No Minimum"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      <span className="font-bold text-gray-900">{d.used_count}</span> / {d.max_uses} max
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {d.expires_at ? (
                        <span className={`inline-flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded border ${
                          isExpired 
                            ? "bg-red-50 text-red-700 border-red-200" 
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}>
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {new Date(d.expires_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-medium">Never Expires</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        isExpired
                          ? "bg-red-50 text-red-700 border-red-200"
                          : d.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}>
                        {isExpired ? "Expired" : d.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteDiscountCode(d.id, d.code)}
                        className="text-gray-400 hover:text-red-600 transition cursor-pointer"
                        title="Delete coupon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
