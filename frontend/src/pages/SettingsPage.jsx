import React, { useState } from "react";
import {
  Settings,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  RefreshCw,
  Trash2,
  Key,
  Users,
  Edit2,
  BookOpen,
  Copy,
  Check,
  Eye,
  EyeOff,
  Code,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import axios, { getApiBaseUrl } from "../api";
import { formatToIST } from "../utils/dateUtils";
import { ApiTokenModal } from "../components/modals/UserManagementModals";

export default function SettingsPage({
  systemSettings = {},
  currentUserProfile,
  setIsAddUserModalOpen = () => {},
  systemUsers = [],
  setSystemUsers = () => {},
  username,
  handleDeleteUser = () => {},
  userRoleUpdatingId,
  userDeletingId = null,
  handleUpdateUserRole = () => {},
  setAdminPasswordModal = () => {},
  admin2faUpdatingId,
  handleAdminToggle2FA = () => {},
  handleOpen2faSetup = () => {},
  handleOpen2faDisable = () => {},
  setIsRoleInfoModalOpen = () => {},
  setAddUserError = () => {}
}) {
  const [apiTokenModal, setApiTokenModal] = useState({ isOpen: false, user: null });
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showSelfToken, setShowSelfToken] = useState(false);
  const [selfTokenLoading, setSelfTokenLoading] = useState(false);
  const [selfTokenError, setSelfTokenError] = useState("");
  const [selfTokenSuccess, setSelfTokenSuccess] = useState("");
  const [confirmSelfRegen, setConfirmSelfRegen] = useState(false);

  const loggedInUser = systemUsers.find(u => u.username === username) || (currentUserProfile ? { ...currentUserProfile, username } : null);
  const rawBase = getApiBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "");
  const apiBaseUrl = rawBase.replace(/\/+$/, "");
  const webhookUrl = `${apiBaseUrl}/api/webhooks/cart-event`;

  const handleSelfGenerateToken = async () => {
    if (!loggedInUser) return;
    setSelfTokenLoading(true);
    setSelfTokenError("");
    setSelfTokenSuccess("");
    try {
      const token = localStorage.getItem("token") || "";
      const res = await axios.post(
        `/api/users/${loggedInUser.id}/api-token`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.api_token) {
        setSystemUsers((prev) =>
          prev.map((usr) => (usr.id === loggedInUser.id ? { ...usr, api_token: res.data.api_token, api_token_created_at: res.data.api_token_created_at } : usr))
        );
        setShowSelfToken(true);
        setConfirmSelfRegen(false);
        setSelfTokenSuccess(
          loggedInUser.api_token
            ? "New permanent API token generated! Previous token was deleted and invalidated."
            : "Permanent API token generated successfully!"
        );
      }
    } catch (err) {
      setSelfTokenError(err.response?.data?.detail || "Failed to generate API token.");
    } finally {
      setSelfTokenLoading(false);
    }
  };

  const handleCopySelfToken = (val) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2200);
  };

  return (
            <div className="space-y-6 w-full max-w-7xl">
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Platform & Integration Settings</h3>
                    <p className="text-xs text-gray-500">Security thresholds, webhook endpoints, and spend limit controls</p>
                  </div>
                </div>

                <div className="space-y-5 text-sm">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900">Daily Outbound Message Limit (Spending Guardrail)</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Maximum WhatsApp messages the system is allowed to send per 24 hours (Fixed)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-[#10B981] bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-xs">
                        200 / Day
                      </span>
                      <span className="text-[11px] font-semibold text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-md border border-gray-300/60">
                        Fixed
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900">Abandoned Cart Delay Timer</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Time window to wait before triggering cart recovery WhatsApp message</p>
                    </div>
                    <span className="font-mono font-bold text-base text-[#F5A623] bg-white px-3 py-1 rounded-lg border border-gray-200">
                      30 Minutes
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900">Meta Webhook Ingress URL</h4>
                      <p className="text-xs text-gray-500 mt-0.5">The endpoint entered in Meta Business Manager for real-time delivery receipts & STOP replies</p>
                    </div>
                    <span className="font-mono text-xs text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                      /api/webhooks/whatsapp
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                    <h4 className="font-bold text-gray-900">Multilingual DND Keywords Active</h4>
                    <p className="text-xs text-gray-500">Inbound replies containing any of these keywords immediately halt all future messages:</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {["STOP", "UNSUBSCRIBE", "DND", "બંધ કરો", "સંદેશા બંધ કરો", "રોકો", "बंद करो"].map((k) => (
                        <span key={k} className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-red-50 text-red-700 border border-red-200">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Team & User Accounts Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-[#F5A623]">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">Authorized Team Accounts</h3>
                      <p className="text-xs text-gray-500">Registered users who have access to this WhatsApp CRM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsRoleInfoModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer border border-gray-300"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                      Role Permissions Guide
                    </button>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                      systemUsers.length >= 5 ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}>
                      {systemUsers.length} / 5 Users Registered
                    </span>
                    {systemUsers.length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddUserError("");
                          setIsAddUserModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + Add User
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] table-fixed text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="w-16 px-4 py-3">ID</th>
                        <th className="w-48 px-4 py-3">Username</th>
                        <th className="w-56 px-4 py-3">Email Address</th>
                        <th className="w-40 px-4 py-3">2FA Security</th>
                        <th className="w-24 px-4 py-3">Status</th>
                        <th className="w-48 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span>Access Level</span>
                            <button
                              type="button"
                              onClick={() => setIsRoleInfoModalOpen(true)}
                              className="text-gray-400 hover:text-gray-600 transition"
                              title="Click to view role access permissions"
                            >
                              <BookOpen className="w-3 h-3" />
                            </button>
                          </div>
                        </th>
                        <th className="w-72 px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const isCallerAdmin = currentUserProfile?.role === "admin" || (username && username.toLowerCase().includes("admin"));
                        return systemUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50/80 transition">
                            <td className="w-16 px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">#{u.id}</td>
                            <td className="w-48 px-4 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0"></span>
                                <span className="truncate">{u.username}</span>
                                {u.username === username && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono font-normal shrink-0">You</span>
                                )}
                                {u.api_token && (
                                  <span
                                    onClick={() => setApiTokenModal({ isOpen: true, user: u })}
                                    className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-mono font-medium shrink-0 cursor-pointer hover:bg-amber-100 transition shadow-2xs"
                                    title="Active Non-Expiring API Token (Click to view)"
                                  >
                                    <Key className="w-2.5 h-2.5 text-amber-600" />
                                    API Key
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="w-56 px-4 py-3.5 text-xs text-gray-600 font-mono truncate" title={u.email}>{u.email}</td>
                            <td className="w-40 px-4 py-3.5 whitespace-nowrap">
                              {u.is_2fa_enabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3" /> Enabled (TOTP)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                  Disabled
                                </span>
                              )}
                            </td>
                            <td className="w-24 px-4 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                                Active
                              </span>
                            </td>
                            <td className="w-48 px-4 py-3.5 font-semibold text-xs text-gray-700 whitespace-nowrap">
                              {u.role === "admin" ? (
                                <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md font-bold inline-flex items-center gap-1 border border-amber-300">
                                  <ShieldCheck className="w-3 h-3 text-amber-700" /> Admin (Full Access)
                                </span>
                              ) : u.role === "service" ? (
                                <span className="bg-purple-50 text-purple-800 px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 border border-purple-200">
                                  Service Account
                                </span>
                              ) : (
                                <span className="bg-blue-50 text-blue-800 px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 border border-blue-200">
                                  Team Member
                                </span>
                              )}
                            </td>
                            <td className="w-72 px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* 1. Admin Role Management: Promote / Demote */}
                                {isCallerAdmin && (
                                  <>
                                    {u.role === "admin" ? (
                                      <button
                                        type="button"
                                        disabled={userRoleUpdatingId === u.id || (u.id === 1 && u.username === username && systemUsers.filter((x) => x.role === "admin").length <= 1)}
                                        onClick={() => handleUpdateUserRole(u, "agent")}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        title="Demote to Team Member"
                                      >
                                        {userRoleUpdatingId === u.id ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                                        )}
                                        Demote
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={userRoleUpdatingId === u.id}
                                        onClick={() => handleUpdateUserRole(u, "admin")}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        title="Promote to Admin"
                                      >
                                        {userRoleUpdatingId === u.id ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        )}
                                        Make Admin
                                      </button>
                                    )}

                                    {/* 2. Admin Password Override Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdminPasswordModal({
                                          isOpen: true,
                                          user: u,
                                          newPassword: "",
                                          confirmPassword: "",
                                          loading: false,
                                          error: ""
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                                      title={`Reset Password for ${u.username}`}
                                    >
                                      <Key className="w-3 h-3 text-indigo-600" />
                                      Reset Pass
                                    </button>

                                    {/* 3. Admin 2FA Override */}
                                    {u.username !== username && (
                                      u.is_2fa_enabled ? (
                                        <button
                                          type="button"
                                          disabled={admin2faUpdatingId === u.id}
                                          onClick={() => handleAdminToggle2FA(u, false)}
                                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition disabled:opacity-40 cursor-pointer"
                                          title={`Turn OFF 2FA requirement for ${u.username}`}
                                        >
                                          {admin2faUpdatingId === u.id ? (
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                                          )}
                                          2FA Off
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={admin2faUpdatingId === u.id}
                                          onClick={() => handleAdminToggle2FA(u, true)}
                                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition disabled:opacity-40 cursor-pointer"
                                          title={`Turn ON 2FA requirement for ${u.username}`}
                                        >
                                          {admin2faUpdatingId === u.id ? (
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <ShieldCheck className="w-3 h-3 text-gray-600" />
                                          )}
                                          2FA On
                                        </button>
                                      )
                                    )}

                                    {/* 4. Delete User Button (Admins cannot delete other Admins or Self) */}
                                    {u.role !== "admin" && u.username !== username ? (
                                      <button
                                        type="button"
                                        disabled={userDeletingId === u.id}
                                        onClick={() => handleDeleteUser(u)}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition disabled:opacity-40 cursor-pointer"
                                        title={`Delete user account ${u.username}`}
                                      >
                                        {userDeletingId === u.id ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3 h-3 text-red-600" />
                                        )}
                                        Delete
                                      </button>
                                    ) : u.role === "admin" && u.username !== username ? (
                                      <span
                                        className="text-[10px] text-gray-400 italic px-1 cursor-help"
                                        title="Security rule: Admins cannot delete other Admins. Demote them first."
                                      >
                                        Admin Lock
                                      </span>
                                    ) : null}
                                  </>
                                )}

                                {/* Self 2FA Toggle for logged-in user */}
                                {u.username === username && (
                                  u.is_2fa_enabled ? (
                                    <button
                                      type="button"
                                      onClick={handleOpen2faDisable}
                                      className="text-xs text-red-600 hover:text-red-800 font-semibold hover:underline cursor-pointer ml-1"
                                    >
                                      Disable My 2FA
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={handleOpen2faSetup}
                                      className="text-xs bg-[#25D366] hover:bg-[#1EBE5D] text-white px-2.5 py-1 rounded-md font-bold transition inline-flex items-center gap-1 shadow-xs cursor-pointer ml-1"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      Enable 2FA
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Permanent API Access Tokens & Webhook Integration Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200 shadow-xs">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-base">E-Commerce Permanent API Token</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Never Expires
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Permanent credentials for Shopify, WooCommerce, or custom storefronts to send cart events without session expiration
                      </p>
                    </div>
                  </div>
                  {loggedInUser && (
                    <button
                      type="button"
                      onClick={() => setApiTokenModal({ isOpen: true, user: loggedInUser })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer shadow-2xs"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-700" />
                      {loggedInUser.api_token ? "Manage My API Token" : "Generate API Token"}
                    </button>
                  )}
                </div>

                {/* Feedback messages */}
                {selfTokenError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{selfTokenError}</span>
                  </div>
                )}
                {selfTokenSuccess && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{selfTokenSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left Column: Token Controls */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-gray-700">Account API Token ({loggedInUser?.username || "You"})</span>
                      {loggedInUser?.api_token ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Active • Never Expires
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium">No token generated</span>
                      )}
                    </div>

                    {loggedInUser?.api_token ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type={showSelfToken ? "text" : "password"}
                            readOnly
                            value={loggedInUser.api_token}
                            className="w-full font-mono text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none select-all shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSelfToken(!showSelfToken)}
                            className="px-3 py-2.5 bg-white hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold border border-gray-300 transition cursor-pointer"
                            title={showSelfToken ? "Hide token" : "Show token"}
                          >
                            {showSelfToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopySelfToken(loggedInUser.api_token)}
                            className={`px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                              tokenCopied
                                ? "bg-emerald-600 text-white"
                                : "bg-[#25D366] hover:bg-[#1EBE5D] text-white"
                            }`}
                          >
                            {tokenCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{tokenCopied ? "Copied" : "Copy"}</span>
                          </button>
                        </div>

                        {loggedInUser.api_token_created_at && (
                          <p className="text-[11px] text-gray-400 font-mono">
                            Created on: {formatToIST(loggedInUser.api_token_created_at)}
                          </p>
                        )}

                        {confirmSelfRegen ? (
                          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-2">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-amber-900 leading-tight">
                                <strong>Regenerating will delete and invalidate the previous token immediately.</strong> Your online store must be updated with the new token.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={selfTokenLoading}
                                onClick={handleSelfGenerateToken}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                              >
                                {selfTokenLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                                Confirm & Replace Token
                              </button>
                              <button
                                type="button"
                                disabled={selfTokenLoading}
                                onClick={() => setConfirmSelfRegen(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-gray-500">Need to rotate credentials?</span>
                            <button
                              type="button"
                              onClick={() => setConfirmSelfRegen(true)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <RefreshCw className="w-3 h-3 text-amber-700" />
                              Regenerate Token
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-xs text-gray-500">
                          You don't have a permanent API token yet. Generate one to allow your store to send automated WhatsApp abandoned cart events.
                        </p>
                        <button
                          type="button"
                          disabled={selfTokenLoading}
                          onClick={handleSelfGenerateToken}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-[#25D366] hover:bg-[#1EBE5D] text-white transition disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          {selfTokenLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                          Generate Permanent Token
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Webhook Integration Details */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                      <Code className="w-3.5 h-3.5 text-indigo-600" />
                      <span>E-Commerce Webhook Endpoint & Headers</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Target Webhook URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={webhookUrl}
                            className="w-full font-mono text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none select-all shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopySelfToken(webhookUrl)}
                            className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                            title="Copy Webhook URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Supported Authentication Headers</label>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-700 space-y-1">
                          <div><span className="text-indigo-600 font-semibold">Authorization:</span> Bearer &lt;permanent_token&gt;</div>
                          <div><span className="text-emerald-600 font-semibold">X-API-Key:</span> &lt;permanent_token&gt;</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Token Management Modal */}
              <ApiTokenModal
                isOpen={apiTokenModal.isOpen}
                onClose={() => setApiTokenModal({ isOpen: false, user: null })}
                targetUser={apiTokenModal.user}
                onTokenUpdated={(updatedUser) => {
                  setApiTokenModal((prev) => ({ ...prev, user: updatedUser }));
                  setSystemUsers((prev) =>
                    prev.map((usr) => (usr.id === updatedUser.id ? { ...usr, ...updatedUser } : usr))
                  );
                }}
              />
            </div>
  );
}
