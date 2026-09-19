import React from "react";
import { Ticket, Calendar } from "lucide-react";

export default function DiscountModal({
  isOpen,
  onClose,
  newDiscountCode,
  setNewDiscountCode,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#F5A623]" />
            <h3 className="font-bold text-base text-gray-900">Create Discount Coupon</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Coupon Code</label>
            <input
              type="text"
              required
              placeholder="e.g. GATHIYA15 or VIPREWARD"
              value={newDiscountCode.code}
              onChange={(e) => setNewDiscountCode({ ...newDiscountCode, code: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Discount Type</label>
              <select
                value={newDiscountCode.discount_type}
                onChange={(e) => setNewDiscountCode({ ...newDiscountCode, discount_type: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              >
                <option value="PERCENT">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Value</label>
              <input
                type="number"
                required
                min="1"
                value={newDiscountCode.discount_value}
                onChange={(e) => setNewDiscountCode({ ...newDiscountCode, discount_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Min Order Value (₹)</label>
              <input
                type="number"
                min="0"
                value={newDiscountCode.min_order_value}
                onChange={(e) => setNewDiscountCode({ ...newDiscountCode, min_order_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Max Redemptions</label>
              <input
                type="number"
                min="1"
                value={newDiscountCode.max_uses}
                onChange={(e) => setNewDiscountCode({ ...newDiscountCode, max_uses: parseInt(e.target.value, 10) || 1000 })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                Coupon Expiry Date
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold lowercase">optional</span>
            </label>
            <input
              type="date"
              value={newDiscountCode.expires_at}
              onChange={(e) => setNewDiscountCode({ ...newDiscountCode, expires_at: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              {newDiscountCode.expires_at ? `Coupon will expire on ${newDiscountCode.expires_at}` : "Leave empty if coupon should never expire"}
            </p>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-md"
            >
              Save Coupon
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
