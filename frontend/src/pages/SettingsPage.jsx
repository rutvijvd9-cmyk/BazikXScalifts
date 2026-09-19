import React from "react";
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
  BookOpen
} from "lucide-react";
import { formatToIST } from "../utils/dateUtils";

export default function SettingsPage({
  systemSettings = {},
  dailyLimitInput,
  setDailyLimitInput,
  isEditingDailyLimit = false,
  setIsEditingDailyLimit = () => {},
  savingDailyLimit = false,
  handleUpdateDailyLimit = () => {},
  currentUserProfile,
  setIsAddUserModalOpen = () => {},
  systemUsers = [],
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
                      <p className="text-xs text-gray-500 mt-0.5">Maximum WhatsApp messages the system is allowed to send per 24 hours</p>
                    </div>
                    {isEditingDailyLimit ? (
                      <form onSubmit={handleUpdateDailyLimit} className="flex items-center gap-2">
                        <div className="flex items-center bg-white border border-emerald-300 rounded-lg px-2.5 py-1 focus-within:ring-2 focus-within:ring-[#25D366]">
                          <input
                            type="number"
                            min="1"
                            max="500000"
                            value={dailyLimitInput}
                            onChange={(e) => setDailyLimitInput(e.target.value)}
                            className="w-24 font-mono font-bold text-base text-gray-900 focus:outline-none"
                            autoFocus
                          />
                          <span className="text-xs text-gray-400 font-semibold ml-1">/ Day</span>
                        </div>
                        <button
                          type="submit"
                          disabled={savingDailyLimit}
                          className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                        >
                          {savingDailyLimit ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingDailyLimit(false)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-base text-[#10B981] bg-white px-3 py-1 rounded-lg border border-gray-200">
                          {systemSettings.daily_limit || 500} / Day
                        </span>
                        <button
                          onClick={() => {
                            setDailyLimitInput(systemSettings.daily_limit || 500);
                            setIsEditingDailyLimit(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition shadow-xs"
                          title="Edit daily outbound message limit"
                        >
                          <Edit2 className="w-3 h-3 text-gray-500" />
                          Edit
                        </button>
                      </div>
                    )}
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
            </div>
  );
}
