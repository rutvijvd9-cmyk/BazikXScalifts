import React, { useState } from "react";
import {
  UserPlus,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  Zap,
  Copy,
  Check,
  AlertTriangle,
  Code,
  Trash2,
  ExternalLink
} from "lucide-react";
import axios, { getApiBaseUrl } from "../../api";
import { formatToIST } from "../../utils/dateUtils";

export function AddUserModal({
  isOpen,
  onClose,
  systemUsers = [],
  newUserForm,
  setNewUserForm,
  addUserLoading,
  addUserError,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#25D366] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Add Team Account</h3>
              <p className="text-[11px] text-gray-400">Grant authorized CRM access ({systemUsers.length}/5 used)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">✕</button>
        </div>

        {addUserError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
            {addUserError}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Username</label>
            <input
              type="text"
              required
              placeholder="e.g. rahul_manager"
              value={newUserForm.username}
              onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="rahul@manubhaigathiyawala.com"
              value={newUserForm.email}
              onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={newUserForm.password}
              onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Access Level (Role)</label>
            <select
              value={newUserForm.role || "agent"}
              onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] bg-white cursor-pointer"
            >
              <option value="agent">Team Member (Standard Access)</option>
              <option value="admin">Admin (Full Access & User Management)</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addUserLoading}
              className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2 rounded-lg font-bold text-xs shadow-xs transition disabled:opacity-50"
            >
              {addUserLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {addUserLoading ? "Creating..." : "Create Team Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminPasswordModal({
  modalState,
  setModalState,
  onSubmit
}) {
  if (!modalState.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Reset User Password</h3>
              <p className="text-xs text-gray-500">Admin credential override</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalState({ isOpen: false, user: null, newPassword: "", confirmPassword: "", loading: false, error: "" })}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-3 mb-4 bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg">
          Set a new secure password for account: <strong className="text-indigo-900 font-mono">{modalState.user?.username}</strong>.
        </p>

        {modalState.error && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
            {modalState.error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={modalState.showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                value={modalState.newPassword}
                onChange={(e) => setModalState((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
              >
                {modalState.showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={modalState.showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="Repeat new password"
                value={modalState.confirmPassword}
                onChange={(e) => setModalState((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalState({ isOpen: false, user: null, newPassword: "", confirmPassword: "", loading: false, error: "" })}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalState.loading}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {modalState.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              Save Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RoleInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#F5A623] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">System Role & Access Privileges</h3>
              <p className="text-xs text-gray-500">Overview of what each account type is permitted to do</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer">✕</button>
        </div>

        <div className="mt-4 space-y-3.5 text-sm">
          {/* Admin Card */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                Admin (Full System & Security Control)
              </span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">Highest Clearance</span>
            </div>
            <ul className="text-xs text-amber-950 space-y-1 list-disc pl-4 mt-2">
              <li>Can create, edit, approve, and send all WhatsApp campaigns.</li>
              <li>Can build and activate multi-step automation journeys & visual flows.</li>
              <li>Can register team accounts, promote/demote members, and delete non-admin users.</li>
              <li>Can reset passwords and enable/disable 2FA for locked-out accounts.</li>
              <li>Full financial access (Meta budget thresholds, spend guardrails, webhook secrets).</li>
            </ul>
          </div>

          {/* Team Member Card */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                <Users className="w-3.5 h-3.5 text-blue-700" />
                Team Member (Customer Operations)
              </span>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-200/60 px-2 py-0.5 rounded">Operational Access</span>
            </div>
            <ul className="text-xs text-blue-950 space-y-1 list-disc pl-4 mt-2">
              <li>2-way live chat with customers in the WhatsApp Live Inbox.</li>
              <li>View customer directory, order history, tags, and conversation transcripts.</li>
              <li>Inspect approved WhatsApp templates and verify campaign delivery logs.</li>
              <li>Manage their own account 2FA security.</li>
            </ul>
          </div>

          {/* Service Account Card */}
          <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
                <Zap className="w-3.5 h-3.5 text-purple-700" />
                Service Account (Automated API System)
              </span>
              <span className="text-[10px] font-bold text-purple-800 bg-purple-200/60 px-2 py-0.5 rounded">Machine & Webhooks</span>
            </div>
            <ul className="text-xs text-purple-950 space-y-1 list-disc pl-4 mt-2">
              <li>Machine-to-machine account for e-commerce website webhooks.</li>
              <li>Automated synchronization for abandoned carts, placed orders, and contact sync.</li>
            </ul>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}


export function ApiTokenModal({
  isOpen,
  onClose,
  targetUser,
  onTokenUpdated = () => {}
}) {
  if (!isOpen || !targetUser) return null;

  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const rawBase = getApiBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "");
  const apiBaseUrl = rawBase.replace(/\/+$/, "");
  const webhookUrl = `${apiBaseUrl}/api/webhooks/cart-event`;

  const handleGenerateOrRegenerate = async () => {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("token") || "";
      const res = await axios.post(
        `/api/users/${targetUser.id}/api-token`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.api_token) {
        onTokenUpdated({
          ...targetUser,
          api_token: res.data.api_token,
          api_token_created_at: res.data.api_token_created_at
        });
        setShowToken(true);
        setConfirmRegenerate(false);
        setSuccessMsg(
          targetUser.api_token
            ? "New permanent API token generated! Previous token was deleted and invalidated."
            : "Permanent API token generated successfully!"
        );
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate API token. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm(`Revoke permanent API token for ${targetUser.username}? Any integrations using this token will stop working immediately.`)) {
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("token") || "";
      await axios.delete(`/api/users/${targetUser.id}/api-token`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onTokenUpdated({
        ...targetUser,
        api_token: null,
        api_token_created_at: null
      });
      setSuccessMsg("API token has been revoked.");
      setConfirmRegenerate(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to revoke API token.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!targetUser.api_token) return;
    navigator.clipboard.writeText(targetUser.api_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const sampleCurl = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${targetUser.api_token || "YOUR_PERMANENT_API_TOKEN"}" \\
  -d '{
    "event_type": "cart_abandoned",
    "phone": "+919876543210",
    "customer_name": "Ramesh Patel",
    "cart_value": 450.00,
    "checkout_url": "https://manubhaigathiyawala.com/checkout/123",
    "items": [{"item_name": "Vanela Gathiya", "quantity": 2, "price": 200}]
  }'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2200);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-gray-900">Permanent API Token</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Never Expires
                </span>
              </div>
              <p className="text-xs text-gray-500">
                E-commerce webhooks & external API integration for <span className="font-semibold text-gray-800">{targetUser.username}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Main Content */}
        <div className="mt-5 space-y-5">
          {targetUser.api_token ? (
            <div className="space-y-4">
              {/* Token Display Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase text-gray-700">Active API Token</label>
                  {targetUser.api_token_created_at && (
                    <span className="text-[11px] text-gray-400 font-medium">
                      Generated: {formatToIST(targetUser.api_token_created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showToken ? "text" : "password"}
                      readOnly
                      value={targetUser.api_token}
                      className="w-full font-mono text-xs px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none select-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-gray-300 transition cursor-pointer"
                    title={showToken ? "Hide token" : "Show token"}
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showToken ? "Hide" : "Show"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                      copied
                        ? "bg-emerald-600 text-white"
                        : "bg-[#25D366] hover:bg-[#1EBE5D] text-white"
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied!" : "Copy Token"}</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  🛡️ This token does not expire. Provide this token in your store or webhook headers as{" "}
                  <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono text-[10px]">Authorization: Bearer &lt;token&gt;</code> or{" "}
                  <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono text-[10px]">X-API-Key: &lt;token&gt;</code>.
                </p>
              </div>

              {/* Regeneration Confirmation or Action */}
              {confirmRegenerate ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Are you sure you want to regenerate this token?</h4>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Clicking confirm will <strong>permanently delete and invalidate the previous token immediately</strong>. Any e-commerce webhook or integration sending API calls with the old token will fail until you replace it with the new token.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleGenerateOrRegenerate}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                      Yes, Delete Old & Generate New Token
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setConfirmRegenerate(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-xs text-gray-600">
                    Need a new token or want to rotate credentials?
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRegenerate(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 text-amber-700" />
                      Regenerate Token
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleRevoke}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition cursor-pointer flex items-center gap-1"
                      title="Revoke Token"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                      Revoke
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* No Token State */
            <div className="p-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">No Permanent API Token Generated</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                  Generate a non-expiring API token so your e-commerce platform (Shopify, WooCommerce, custom cart) can send cart events, orders, and customer data directly into this WhatsApp CRM.
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerateOrRegenerate}
                className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-xs transition disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                Generate Permanent Token
              </button>
            </div>
          )}

          {/* Integration Guide Box */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                <Code className="w-3.5 h-3.5 text-indigo-600" />
                <span>E-Commerce Integration Snippet (cURL)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCurl}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                {curlCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{curlCopied ? "Copied cURL!" : "Copy cURL"}</span>
              </button>
            </div>

            <div className="bg-gray-900 rounded-xl p-3.5 text-gray-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-gray-800">
              <pre className="whitespace-pre">{sampleCurl}</pre>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200">
                <div className="font-bold text-blue-900 mb-0.5">Webhook Endpoint:</div>
                <div className="font-mono text-blue-800 text-[10px] break-all">{webhookUrl}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
                <div className="font-bold text-emerald-900 mb-0.5">Supported Auth Headers:</div>
                <div className="font-mono text-emerald-800 text-[10px]">
                  Authorization: Bearer &lt;token&gt;<br />
                  X-API-Key: &lt;token&gt;
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 mt-5 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

