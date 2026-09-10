import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  ShoppingCart,
  FileText,
  ShieldBan,
  Settings,
  Send,
  Plus,
  RefreshCw,
  CheckCircle2,
  Lock,
  LogOut,
  IndianRupee,
  MessageSquare,
  Search,
  Trash2,
  AlertTriangle,
  PlayCircle,
  BookOpen,
  Sliders,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Tag,
  Eye,
  EyeOff,
  Ticket,
  Upload,
  Calendar,
  Gift,
  ChevronRight,
  Clock,
  Star,
  Package,
  CloudRain,
  Activity,
  Zap,
  Radio,
  BellRing
} from "lucide-react";
import axios from "axios";

// When deployed on Vercel, requests point to your Render backend via VITE_API_URL.
// Locally or with Vite proxy, it defaults to "" (same-origin / relative).
const API_BASE_URL = import.meta.env.VITE_API_URL || "";
axios.defaults.baseURL = API_BASE_URL;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [authMode, setAuthMode] = useState("login"); // "login" or "register"
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState({
    current_users: 1,
    max_users: 5,
    can_register: true
  });

  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash && ["dashboard", "automations", "campaigns", "templates", "contacts", "discount_codes", "cart_recovery", "logs", "opt_out", "settings"].includes(hash)) {
      return hash;
    }
    return localStorage.getItem("activeTab") || "dashboard";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchTerm("");
    localStorage.setItem("activeTab", tabId);
    window.location.hash = tabId;
  };
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [discountCodes, setDiscountCodes] = useState([]);
  const [cartEvents, setCartEvents] = useState([]);
  const [messageLogs, setMessageLogs] = useState([]);
  const [optOuts, setOptOuts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [systemUsers, setSystemUsers] = useState([]);
  const [templateFilterLang, setTemplateFilterLang] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // Search filter for lists
  const [searchTerm, setSearchTerm] = useState("");

  // New Campaign Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    title: "",
    template_name: "festive_promo_offer",
    language: "en",
    target_filter: "ALL",
    scheduled_for: ""
  });

  // CSV Import Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);

  // New Discount Code Modal State
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [newDiscountCode, setNewDiscountCode] = useState({
    code: "",
    discount_type: "PERCENT",
    discount_value: 10,
    min_order_value: 0,
    max_uses: 1000
  });

  // New Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    template_name: "",
    category: "MARKETING",
    language: "en",
    header_text: "",
    body_text: "",
    footer_text: "Manubhai Gathiyawala"
  });

  // New Rule Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_name: "",
    rule_type: "INACTIVE_DAYS",
    threshold_value: 15,
    template_name: "reorder_reminder",
    coupon_code: "SAVE10",
    dedup_days: 7
  });

  // Configure & Test Simulator Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedRuleForConfig, setSelectedRuleForConfig] = useState(null);
  const [testPhone, setTestPhone] = useState("+919876543210");
  const [testCartValue, setTestCartValue] = useState(450);
  const [simulatingAction, setSimulatingAction] = useState(false);


  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await axios.post("/api/auth/login", loginForm);
      const jwt = res.data.access_token;
      setToken(jwt);
      setUsername(res.data.username);
      localStorage.setItem("token", jwt);
      localStorage.setItem("username", res.data.username);
    } catch (err) {
      setLoginError(err.response?.data?.detail || "Invalid login credentials");
    }
  };

  const fetchRegistrationStatus = async () => {
    try {
      const res = await axios.get("/api/auth/registration-status");
      setRegistrationStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch registration status:", err);
    }
  };

  useEffect(() => {
    fetchRegistrationStatus();
  }, [token]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError("");
    setAuthSuccess("");
    try {
      await axios.post("/api/auth/register", registerForm);
      setAuthSuccess(`Account for "${registerForm.username}" created successfully! Please sign in.`);
      setLoginForm({ username: registerForm.username, password: "" });
      setRegisterForm({ username: "", email: "", password: "" });
      setAuthMode("login");
      fetchRegistrationStatus();
    } catch (err) {
      setLoginError(err.response?.data?.detail || "Registration failed. Try again.");
    }
  };

  const handleLogout = () => {
    setToken("");
    setUsername("");
    localStorage.removeItem("token");
    localStorage.removeItem("username");
  };

  // Fetch all data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [campRes, contRes, cartRes, logsRes, optRes, tmplRes, rulesRes, setRes, usersRes, discRes] = await Promise.all([
        axios.get("/api/campaigns", { headers }),
        axios.get("/api/contacts", { headers }),
        axios.get("/api/cart-events", { headers }),
        axios.get("/api/message-logs", { headers }),
        axios.get("/api/opt-outs", { headers }),
        axios.get("/api/templates", { headers }),
        axios.get("/api/automation-rules", { headers }),
        axios.get("/api/settings", { headers }),
        axios.get("/api/users", { headers }),
        axios.get("/api/discount-codes", { headers })
      ]);
      setCampaigns(campRes.data || []);
      setContacts(contRes.data || []);
      setCartEvents(cartRes.data || []);
      setMessageLogs(logsRes.data || []);
      setOptOuts(optRes.data || []);
      setTemplates(tmplRes.data || []);
      setAutomationRules(rulesRes.data || []);
      setSystemSettings(setRes.data || {});
      setSystemUsers(usersRes.data || []);
      setDiscountCodes(discRes.data || []);
    } catch (err) {
      console.error("Failed to fetch protected data:", err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImportCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    setCsvImporting(true);
    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const res = await axios.post("/api/contacts/import-csv", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      setActionSuccessMsg(`✅ ${res.data.message}`);
      setIsCsvModalOpen(false);
      setCsvFile(null);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      alert("Failed to import CSV: " + (err.response?.data?.detail || err.message));
    } finally {
      setCsvImporting(false);
    }
  };

  const handleCreateDiscountCode = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/discount-codes", newDiscountCode, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`✅ Discount Code '${newDiscountCode.code}' created successfully!`);
      setIsDiscountModalOpen(false);
      setNewDiscountCode({
        code: "",
        discount_type: "PERCENT",
        discount_value: 10,
        min_order_value: 0,
        max_uses: 1000
      });
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Error creating discount code: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteDiscountCode = async (id, code) => {
    if (!window.confirm(`Delete discount code ${code}?`)) return;
    try {
      await axios.delete(`/api/discount-codes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      alert("Failed to delete discount code");
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/templates", newTemplate, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`✅ Template '${res.data.template_name}' submitted and saved!`);
      setIsTemplateModalOpen(false);
      setNewTemplate({
        template_name: "",
        category: "MARKETING",
        language: "en",
        header_text: "",
        body_text: "",
        footer_text: "Manubhai Gathiyawala"
      });
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      alert("Failed to submit template: " + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleSyncMetaTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.post("/api/templates/sync-from-meta", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`✅ ${res.data.message}`);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to sync from Meta: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await axios.patch(
        `/api/automation-rules/${rule.id}`,
        { is_active: !rule.is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch (err) {
      alert("Failed to update rule status");
    }
  };

  const handleTriggerRule = async (rule) => {
    try {
      const res = await axios.post(
        `/api/automation-rules/${rule.id}/trigger`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionSuccessMsg(`✅ Automation '${rule.rule_name}' executed: ${res.data.messages_dispatched} messages sent (dedup applied).`);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      alert("Failed to trigger rule: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const triggerDesc =
        newRule.rule_type === "INACTIVE_DAYS"
          ? `Days Inactive > ${newRule.threshold_value}`
          : newRule.rule_type === "ORDER_COUNT_VIP"
          ? `Total Orders >= ${newRule.threshold_value}`
          : `Cart Delay ${newRule.threshold_value}m`;

      await axios.post(
        "/api/automation-rules",
        {
          ...newRule,
          trigger_condition: triggerDesc
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsRuleModalOpen(false);
      fetchData();
    } catch (err) {
      alert("Failed to create rule");
    }
  };

  const handleSaveConfigRule = async (e) => {
    e.preventDefault();
    if (!selectedRuleForConfig) return;
    try {
      await axios.patch(
        `/api/automation-rules/${selectedRuleForConfig.id}`,
        {
          rule_name: selectedRuleForConfig.rule_name,
          trigger_condition: selectedRuleForConfig.trigger_condition,
          template_name: selectedRuleForConfig.template_name,
          threshold_value: selectedRuleForConfig.threshold_value,
          coupon_code: selectedRuleForConfig.coupon_code,
          dedup_days: selectedRuleForConfig.dedup_days
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionSuccessMsg(`✅ Automation '${selectedRuleForConfig.rule_name}' updated successfully!`);
      setIsConfigModalOpen(false);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to save rule settings: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteRule = async (ruleId, ruleName) => {
    if (!window.confirm(`Are you sure you want to delete the automation rule "${ruleName}"?`)) return;
    try {
      await axios.delete(`/api/automation-rules/${ruleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`🗑️ Automation '${ruleName}' deleted.`);
      if (selectedRuleForConfig && selectedRuleForConfig.id === ruleId) {
        setIsConfigModalOpen(false);
      }
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to delete rule: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleSimulateCartAbandonment = async () => {
    setSimulatingAction(true);
    try {
      const mockToken = `cart_test_${Date.now()}`;
      const res = await axios.post("/api/webhooks/cart-event", {
        customer_phone: testPhone,
        cart_token: mockToken,
        cart_value: parseFloat(testCartValue) || 450,
        items: [
          { item: "Special Vanela Gathiya 500g", price: 200, qty: 1 },
          { item: "Spicy Bhavnagari Gathiya 250g", price: 110, qty: 1 },
          { item: "Papdi Gathiya with Kadhi 500g", price: 140, qty: 1 }
        ]
      }, {
        params: { delay_seconds: 10 } // 10 second delay for rapid testing!
      });
      setActionSuccessMsg(`🛒 Test Cart Abandonment simulated! Cart #${mockToken.slice(-6)} recorded. WhatsApp recovery scheduled in 10s.`);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      alert("Cart simulation error: " + (err.response?.data?.detail || err.message));
    } finally {
      setSimulatingAction(false);
    }
  };

  const handleDirectSendTest = async () => {
    if (!testPhone) {
      alert("Please enter a test phone number first!");
      return;
    }
    setSimulatingAction(true);
    try {
      const selectedTmpl = templates.find((t) => t.template_name === selectedRuleForConfig?.template_name) || templates[0];
      const res = await axios.post("/api/messages/send-test", {
        phone: testPhone,
        template_name: selectedTmpl ? selectedTmpl.template_name : (selectedRuleForConfig?.template_name || "address_update_1"),
        language: selectedTmpl ? selectedTmpl.language : "en_US"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.status === "blocked") {
        alert(`⚠️ Message blocked: ${res.data.reason}`);
      } else if (res.data.status === "success_simulated") {
        setActionSuccessMsg(`📱 Simulated WhatsApp dispatched to ${testPhone} (Logged in DB)`);
      } else if (res.data.status === "success") {
        setActionSuccessMsg(`🚀 Live WhatsApp message delivered to ${testPhone}! Meta ID: ${res.data.message_id}`);
      } else {
        alert(`Meta response: ${JSON.stringify(res.data)}`);
      }
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      alert("Test send error: " + (err.response?.data?.detail || err.message));
    } finally {
      setSimulatingAction(false);
    }
  };

  const handleSimulateOrderCompleted = async (cartToken) => {
    setSimulatingAction(true);
    try {
      const res = await axios.post("/api/webhooks/order-completed", null, {
        params: {
          cart_token: cartToken || `cart_test_${Date.now()}`,
          customer_phone: testPhone
        }
      });
      setActionSuccessMsg(`🎉 Order completed recorded! Cart marked as RECOVERED & scheduled message cancelled.`);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      alert("Order completed error: " + (err.response?.data?.detail || err.message));
    } finally {
      setSimulatingAction(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaign.title || !token) return;
    try {
      await axios.post("/api/campaigns", newCampaign, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsModalOpen(false);
      setNewCampaign({
        title: "",
        template_name: "festive_promo_offer",
        language: "en",
        target_filter: "ALL"
      });
      fetchData();
    } catch (err) {
      alert("Error triggering campaign: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleRemoveOptOut = async (phone) => {
    if (!window.confirm(`Remove ${phone} from Opt-Out (DND) list?`)) return;
    try {
      await axios.delete(`/api/opt-outs/${encodeURIComponent(phone)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      alert("Error removing opt-out: " + (err.response?.data?.detail || err.message));
    }
  };

  const totalRecoveredValue = cartEvents
    .filter((c) => c.status === "RECOVERED")
    .reduce((sum, c) => sum + (c.cart_value || 0), 0);

  // If unauthenticated, show login/register screen
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#111827] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl border border-gray-800">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#F5A623] flex items-center justify-center font-black text-black text-2xl shadow-lg mb-3">
              MG
            </div>
            <h2 className="text-2xl font-black text-gray-900">WhatsApp CRM</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manubhai Gathiyawala • Portal Access</p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setLoginError("");
                setAuthSuccess("");
              }}
              className={`py-2 rounded-lg transition ${
                authMode === "login"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setLoginError("");
                setAuthSuccess("");
              }}
              className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                authMode === "register"
                  ? "bg-white text-[#25D366] shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <span>+ Create User</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                registrationStatus.can_register 
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-700"
              }`}>
                {registrationStatus.current_users}/{registrationStatus.max_users}
              </span>
            </button>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
              {loginError}
            </div>
          )}

          {authSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              {authSuccess}
            </div>
          )}

          {authMode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 focus:outline-none p-0.5"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-2.5 rounded-lg text-sm shadow-md transition"
              >
                <Lock className="w-4 h-4" />
                Sign In Securely
              </button>
            </form>
          ) : !registrationStatus.can_register ? (
            <div className="py-6 px-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">User Limit Reached</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Maximum capacity of <strong>5 users</strong> has been reached. No further user accounts can be created.
              </p>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className="mt-2 text-xs font-bold text-[#F5A623] hover:underline"
              >
                ← Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  New Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. friend_name"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@manubhaigathiyawala.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 focus:outline-none p-0.5"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#E67E22] text-black font-bold py-2.5 rounded-lg text-sm shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                Register New User
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-400">Protected by End-to-End Bcrypt & JWT Security</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] text-[#111827]">
      {/* ── Left Sidebar ── */}
      <aside className="w-64 flex-shrink-0 bg-[#111827] text-gray-300 flex flex-col justify-between border-r border-gray-800">
        <div>
          {/* Brand Header */}
          <div className="p-5 flex items-center gap-3 border-b border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-[#F5A623] flex items-center justify-center font-bold text-black text-xl shadow-md">
              MG
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">Manubhai</h1>
              <span className="text-xs text-[#F5A623] font-medium tracking-wide">Gathiyawala/Scalifts</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 mt-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "automations", label: "Automations", icon: Sliders, badge: automationRules.length },
              { id: "campaigns", label: "Campaigns", icon: Megaphone },
              { id: "templates", label: "Templates", icon: BookOpen, badge: templates.length },
              { id: "contacts", label: "Contacts", icon: Users },
              { id: "discount_codes", label: "Discount Codes", icon: Ticket, badge: discountCodes.length },
              { id: "cart_recovery", label: "Cart Recovery", icon: ShoppingCart },
              { id: "logs", label: "Message Logs", icon: FileText },
              { id: "opt_out", label: "Opt-Out (DND)", icon: ShieldBan, badge: optOuts.length },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#1F2937] text-[#F5A623] border-l-4 border-[#F5A623]"
                      : "hover:bg-gray-800/60 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? "text-[#F5A623]" : "text-gray-400"}`} />
                    {item.label}
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        item.id === "opt_out"
                          ? "bg-red-900/60 text-red-300 border border-red-700"
                          : item.id === "automations"
                          ? "bg-emerald-900/60 text-[#25D366] border border-emerald-700"
                          : "bg-amber-900/60 text-[#F5A623] border border-amber-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status & Logout */}
        <div className="p-4 border-t border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse"></span>
              <span className="text-gray-300 font-semibold">{username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-400 hover:text-red-400 transition"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top App Bar */}
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 capitalize">
              {activeTab === "opt_out"
                ? "Opt-Out (DND) Registry"
                : activeTab === "templates"
                ? "WhatsApp Template Messages (Doc 04)"
                : activeTab === "automations"
                ? "Automation Triggers & Rules"
                : activeTab.replace("_", " ")}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {activeTab === "automations" && (
              <button
                onClick={() => setIsRuleModalOpen(true)}
                className="flex items-center gap-2 bg-[#F5A623] hover:bg-[#E67E22] text-black px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Create New Rule
              </button>
            )}

            {(activeTab === "campaigns" || activeTab === "dashboard") && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition shadow-green-500/20"
              >
                <Plus className="w-4 h-4" />
                New Broadcast Campaign
              </button>
            )}
          </div>
        </header>

        {/* Action Toast / Success Banner */}
        {actionSuccessMsg && (
          <div className="mx-8 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>{actionSuccessMsg}</span>
            <button onClick={() => setActionSuccessMsg("")} className="text-emerald-600 font-bold">✕</button>
          </div>
        )}

        {/* Dynamic Views */}
        <div className="p-8 space-y-6">
          {/* ========================================================= */}
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === "dashboard" && (
            <>
              {/* Top 4 KPI Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Messages Sent</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">{messageLogs.length}</h3>
                    <span className="inline-flex items-center text-xs font-semibold text-[#10B981] mt-1">
                      100% Meta Compliant
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-[#25D366]">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border-2 border-[#F5A623]/30 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recovered Cart Value</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">₹ {totalRecoveredValue.toFixed(2)}</h3>
                    <span className="text-xs font-semibold text-[#F5A623] mt-1">
                      Autonomous 30m recovery
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-[#F5A623]">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Customers</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">{contacts.length}</h3>
                    <span className="text-xs text-gray-500 mt-1">Synced from custom PHP</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Opt-Out (DND)</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">{optOuts.length}</h3>
                    <span className="text-xs font-semibold text-gray-400 mt-1">Auto STOP Handler</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                    <ShieldBan className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Active Automations Quick Glance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Active Background Automations</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Automated customer recovery & engagement triggers</p>
                  </div>
                  <button
                    onClick={() => handleTabChange("automations")}
                    className="text-xs font-bold text-[#F5A623] hover:underline"
                  >
                    View All Rules ({automationRules.length}) →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {automationRules.map((r) => (
                    <div key={r.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`w-2 h-2 rounded-full ${r.is_active ? "bg-emerald-500" : "bg-gray-400"}`}></span>
                          <span className="text-[10px] font-bold font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                            {r.coupon_code || "NO CODE"}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 mt-2">{r.rule_name}</h4>
                        <p className="text-xs text-gray-500 mt-1 font-mono">{r.trigger_condition}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                        <span className="text-gray-500">Dedup: {r.dedup_days}d</span>
                        <button
                          onClick={() => handleTriggerRule(r)}
                          className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Run
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Campaigns Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-base">Broadcast Campaigns</h3>
                  <span className="text-xs text-gray-500">Auto-batches & DND filtered</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3">Campaign Title</th>
                        <th className="px-6 py-3">Template</th>
                        <th className="px-6 py-3">Target</th>
                        <th className="px-6 py-3">Language</th>
                        <th className="px-6 py-3">Recipients</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {campaigns.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50/80 transition">
                          <td className="px-6 py-4 font-semibold text-gray-900">{c.title}</td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-600">{c.template_name}</td>
                          <td className="px-6 py-4">{c.target_filter}</td>
                          <td className="px-6 py-4 uppercase font-semibold text-xs">{c.language}</td>
                          <td className="px-6 py-4 font-bold text-gray-900">{c.successful_sends} / {c.total_recipients}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-[#10B981] border border-green-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: AUTOMATION RULES & TRIGGERS */}
          {/* ========================================================= */}
          {activeTab === "automations" && (
            <div className="space-y-6">
              {/* ── 📊 CLEAN EXECUTIVE AUTOMATION OVERVIEW (ADMIN PORTAL THEME) ── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  
                  {/* LEFT: Clean Circular Progress & Key Metrics */}
                  <div className="lg:col-span-5 flex items-center gap-6 border-b lg:border-b-0 lg:border-r border-gray-100 pb-5 lg:pb-0 lg:pr-6">
                    {/* Minimal Circular Dial */}
                    <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                        {/* Background track */}
                        <circle cx="60" cy="60" r="48" stroke="#F3F4F6" strokeWidth="8" fill="transparent" />
                        {/* Active Automations Arc */}
                        <circle
                          cx="60"
                          cy="60"
                          r="48"
                          stroke="#25D366"
                          strokeWidth="8"
                          strokeDasharray="301"
                          strokeDashoffset={
                            automationRules.length > 0
                              ? 301 - (301 * (automationRules.filter((r) => r.is_active).length / Math.max(1, automationRules.length)))
                              : 301
                          }
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-black text-gray-900 leading-none">
                          {automationRules.filter((r) => r.is_active).length}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                          of {automationRules.length} Active
                        </span>
                      </div>
                    </div>

                    {/* Clean Executive Readouts */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                          Active Rules
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {automationRules.filter((r) => r.is_active).length} / {automationRules.length}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#F5A623]"></span>
                          Recovered (30d)
                        </span>
                        <span className="text-xs font-bold text-[#D35400] font-mono">
                          ₹{cartEvents.filter((c) => c.status === "RECOVERED").reduce((sum, c) => sum + (c.cart_value || 0), 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Sent Today
                        </span>
                        <span className="text-xs font-bold text-gray-900 font-mono">
                          {messageLogs.filter((m) => {
                            const today = new Date().toISOString().split("T")[0];
                            return m.created_at && m.created_at.startsWith(today);
                          }).length} msgs
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Opt-Out Rate
                        </span>
                        <span className="text-xs font-bold text-emerald-600 font-mono">
                          {optOuts.length === 0 ? "0% (Healthy)" : `${optOuts.length} opted out`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Live Automation Stream & Guardrail Status */}
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#25D366]" />
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                          Automation Activity & System Health
                        </h4>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse"></span>
                        Scheduler Online
                      </div>
                    </div>

                    {/* Activity Feed Cards */}
                    <div className="space-y-2">
                      {cartEvents.length > 0 ? (
                        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <ShoppingCart className="w-3.5 h-3.5 text-[#F5A623]" />
                            <span className="text-gray-700">
                              Latest cart: <strong className="font-mono text-gray-900">₹{cartEvents[0].cart_value || 0}</strong> • Status: <span className="font-semibold text-gray-800">{cartEvents[0].status}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {cartEvents[0].customer_phone ? cartEvents[0].customer_phone.replace(/(\d{5})(\d{5})/, "$1*****") : "Customer"}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-lg flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <Radio className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Listening for store cart events & inactive customer triggers</span>
                          </div>
                          <span className="text-[11px] font-mono text-gray-400">Idle (Standby)</span>
                        </div>
                      )}

                      {messageLogs.length > 0 ? (
                        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <Send className="w-3.5 h-3.5 text-[#25D366]" />
                            <span className="text-gray-700">
                              Dispatched <code className="text-gray-900 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-200 text-[11px]">{messageLogs[0].template_name}</code> to {messageLogs[0].recipient_phone}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Sent
                          </span>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-lg flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Daily safety guardrail active: 0 of 500 WhatsApp limit used</span>
                          </div>
                          <span className="text-[11px] text-emerald-600 font-semibold">100% Capacity</span>
                        </div>
                      )}
                    </div>

                    {/* Operational Guardrails Bar */}
                    <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
                      <div className="flex items-center gap-3 text-[11px]">
                        <span>Opt-out enforcement: <strong className="text-gray-800">Strict DND</strong></span>
                        <span className="text-gray-300">•</span>
                        <span>Deduplication window: <strong className="text-gray-800">3-7 Days</strong></span>
                      </div>
                      <button
                        onClick={() => {
                          const cartRule = automationRules.find((r) => r.rule_type === "CART_RECOVERY") || automationRules[0];
                          setSelectedRuleForConfig(cartRule);
                          setIsConfigModalOpen(true);
                        }}
                        className="text-xs font-bold text-[#25D366] hover:text-[#1EBE5D] flex items-center gap-1 cursor-pointer transition"
                      >
                        ⚡ Test Simulator Flow →
                      </button>
                    </div>
                  </div>

                </div>
              </div>



              {/* Subheader & Actions */}
              <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">E-Commerce Lifecycle Automations</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Trigger-based smart WhatsApp messages driven by customer cart events, purchase history, and store activity
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const cartRule = automationRules.find((r) => r.rule_type === "CART_RECOVERY") || automationRules[0];
                      setSelectedRuleForConfig(cartRule);
                      setIsConfigModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-[#111827] hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <PlayCircle className="w-4 h-4 text-[#F5A623]" />
                    Test & Simulate Cart Flow
                  </button>
                  <button
                    onClick={() => setIsRuleModalOpen(true)}
                    className="flex items-center gap-2 bg-[#F5A623] hover:bg-[#E67E22] text-black px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition"
                  >
                    <Plus className="w-4 h-4" />
                    Create Custom Rule
                  </button>
                </div>
              </div>

              {/* 8 Modern Visual Automation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {automationRules.map((rule) => {
                  const isCart = rule.rule_type === "CART_RECOVERY";
                  const isInactive = rule.rule_type === "INACTIVE_DAYS";
                  const isBirthday = rule.rule_type === "BIRTHDAY";
                  const isVIP = rule.rule_type === "ORDER_COUNT_VIP";
                  const isReview = rule.rule_type === "POST_DELIVERY";
                  const isBackInStock = rule.rule_type === "BACK_IN_STOCK";
                  const isLowStock = rule.rule_type === "LOW_STOCK";
                  const isWeather = rule.rule_type === "WEATHER_TRIGGER";

                  return (
                    <div
                      key={rule.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="space-y-4">
                        {/* Card Header: Icon + Title + Toggle */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                              isCart ? "bg-amber-50 text-[#D35400]" :
                              isInactive ? "bg-blue-50 text-blue-600" :
                              isBirthday ? "bg-pink-50 text-pink-600" :
                              isVIP ? "bg-purple-50 text-purple-600" :
                              isReview ? "bg-emerald-50 text-emerald-600" :
                              isBackInStock ? "bg-indigo-50 text-indigo-600" :
                              isLowStock ? "bg-orange-50 text-orange-600" :
                              "bg-cyan-50 text-cyan-600"
                            }`}>
                              {isCart ? <ShoppingCart className="w-5 h-5" /> :
                               isInactive ? <Clock className="w-5 h-5" /> :
                               isBirthday ? <Gift className="w-5 h-5" /> :
                               isVIP ? <Star className="w-5 h-5" /> :
                               isReview ? <Package className="w-5 h-5" /> :
                               isBackInStock ? <CheckCircle2 className="w-5 h-5" /> :
                               isLowStock ? <AlertTriangle className="w-5 h-5" /> :
                               <CloudRain className="w-5 h-5" />}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900 text-sm">{rule.rule_name}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">{rule.trigger_condition}</p>
                            </div>
                          </div>

                          {/* Toggle Switch */}
                          <button
                            onClick={() => handleToggleRule(rule)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition flex-shrink-0 ${
                              rule.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-gray-100 text-gray-400 border border-gray-200"
                            }`}
                          >
                            {rule.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                            {rule.is_active ? "Active" : "Paused"}
                          </button>
                        </div>

                        {/* Card Details: Template, Coupon, Stats */}
                        <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="font-medium text-gray-500">Template Linked:</span>
                            <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                              {rule.template_name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="font-medium text-gray-500">Coupon Attached:</span>
                            <span className="font-mono font-bold text-[#D35400] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {rule.coupon_code || "None"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="font-medium text-gray-500">Dedup Cooldown:</span>
                            <span className="font-semibold text-gray-700">{rule.dedup_days} Days</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-600 border-t border-gray-200/60 pt-2">
                            <span className="font-medium text-gray-500">Total Dispatched:</span>
                            <span className="font-bold text-gray-900">{rule.total_triggered} sent</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setSelectedRuleForConfig(rule);
                              setIsConfigModalOpen(true);
                            }}
                            className="text-xs font-semibold text-gray-700 hover:text-black flex items-center gap-1.5 transition"
                          >
                            <Sliders className="w-3.5 h-3.5 text-gray-500" />
                            Configure & Test
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id, rule.rule_name)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition"
                            title="Delete this automation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleTriggerRule(rule)}
                          disabled={!rule.is_active}
                          className="flex items-center gap-1.5 bg-[#111827] hover:bg-black disabled:opacity-40 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          <PlayCircle className="w-3.5 h-3.5 text-[#F5A623]" />
                          Execute Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clean Empty State when 0 automations exist */}
              {automationRules.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 text-[#F5A623] flex items-center justify-center mx-auto mb-4">
                    <Sliders className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-gray-900">No Automations Active</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-5 leading-relaxed">
                    All previous automation rules have been deleted. You have a clean slate! Click below to create your first customized automation rule (such as Abandoned Cart Recovery).
                  </p>
                  <button
                    onClick={() => setIsRuleModalOpen(true)}
                    className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs inline-flex items-center gap-2 transition"
                  >
                    <Plus className="w-4 h-4" />
                    + Create First Automation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: SETTINGS VIEW */}
          {/* ========================================================= */}
          {activeTab === "settings" && (
            <div className="space-y-6 max-w-4xl">
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
                    <span className="font-mono font-bold text-base text-[#10B981] bg-white px-3 py-1 rounded-lg border border-gray-200">
                      {systemSettings.daily_limit || 500} / Day
                    </span>
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
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                    systemUsers.length >= 5 ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}>
                    {systemUsers.length} / 5 Users Registered
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Email Address</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Access Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {systemUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/80 transition">
                          <td className="px-4 py-3.5 font-mono text-xs text-gray-400">#{u.id}</td>
                          <td className="px-4 py-3.5 font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                            {u.username}
                            {u.username === username && (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono font-normal">You</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-600 font-mono">{u.email}</td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                              Active
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-xs text-gray-700">
                            {u.id === 1 || u.username.toLowerCase().includes("admin") ? (
                              <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">Admin (Full Access)</span>
                            ) : (
                              <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-medium">Team Member</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: WHATSAPP TEMPLATES (DOC 04 CATALOG) */}
          {/* ========================================================= */}
          {activeTab === "templates" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">WhatsApp Approved Template Catalog</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {templates.length > 0
                      ? `${templates.length} official template(s) synced with Meta WhatsApp Business Manager`
                      : "No templates registered in database"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="flex items-center gap-1.5 bg-[#F5A623] hover:bg-[#E67E22] text-black px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Create Template
                  </button>
                  <button
                    onClick={handleSyncMetaTemplates}
                    disabled={loading}
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    Sync from Meta
                  </button>

                  {/* Language Filter */}
                  {templates.length > 0 && (
                    <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                      {["ALL", "en", "en_US", "gu", "hi"].map((lang) => {
                        const count = lang === "ALL" ? templates.length : templates.filter(t => t.language === lang).length;
                        if (lang !== "ALL" && count === 0) return null;
                        return (
                          <button
                            key={lang}
                            onClick={() => setTemplateFilterLang(lang)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition ${
                              templateFilterLang === lang
                                ? "bg-[#111827] text-[#F5A623]"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {lang === "ALL" ? `All (${templates.length})` : lang}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {templates.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-3">
                  <BookOpen className="w-10 h-10 mx-auto text-gray-300 stroke-1" />
                  <p className="font-medium text-sm text-gray-600">No WhatsApp templates loaded yet</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Click the button below to fetch all approved templates directly from your WhatsApp Business Account.
                  </p>
                  <button
                    onClick={handleSyncMetaTemplates}
                    disabled={loading}
                    className="mt-2 inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Sync Templates from Meta Now
                  </button>
                </div>
              ) : (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {templates
                  .filter((t) => templateFilterLang === "ALL" || t.language === templateFilterLang)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="border border-gray-200 rounded-xl p-4.5 bg-gray-50/50 flex flex-col justify-between hover:border-gray-300 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#111827] text-white uppercase tracking-wider">
                            {t.language}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-emerald-700 border border-green-200">
                            {t.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 mt-2.5 font-mono">{t.template_name}</h4>
                        <p className="text-xs font-semibold text-[#D35400] mt-0.5">{t.header_text}</p>
                        <p className="text-xs text-gray-700 mt-3 bg-white p-3 rounded-lg border border-gray-200 leading-relaxed font-sans">
                          {t.body_text}
                        </p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Category: {t.category}</span>
                        <span className="font-medium text-gray-500">{t.footer_text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: CAMPAIGNS FULL VIEW */}
          {/* ========================================================= */}
          {activeTab === "campaigns" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Campaign Manager</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Manage and trigger promotional WhatsApp broadcasts</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Broadcast
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">ID</th>
                      <th className="px-6 py-3">Campaign Title</th>
                      <th className="px-6 py-3">Template</th>
                      <th className="px-6 py-3">Language</th>
                      <th className="px-6 py-3">Target</th>
                      <th className="px-6 py-3">Delivered / Total</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/80 transition">
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">#{c.id}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{c.title}</td>
                        <td className="px-6 py-4 font-mono text-xs">{c.template_name}</td>
                        <td className="px-6 py-4 uppercase font-semibold text-xs">{c.language}</td>
                        <td className="px-6 py-4 text-xs">{c.target_filter}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{c.successful_sends} / {c.total_recipients}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-[#10B981] border border-green-200">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: CONTACTS DIRECTORY */}
          {/* ========================================================= */}
          {activeTab === "contacts" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Customer Contacts Directory</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Customer list with tags, order milestones, and CSV import</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search phone, name, city..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>
                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="flex items-center gap-1.5 bg-[#111827] hover:bg-gray-800 text-[#F5A623] px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-xs transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Customer Name</th>
                      <th className="px-6 py-3">Phone Number</th>
                      <th className="px-6 py-3">City / Tags</th>
                      <th className="px-6 py-3">Total Orders</th>
                      <th className="px-6 py-3">VIP Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {contacts
                      .filter(
                        (c) =>
                          c.phone.includes(searchTerm) ||
                          (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (c.tags && c.tags.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50/80 transition">
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {c.name || "Customer"}
                            {c.email && <div className="text-xs text-gray-400 font-normal">{c.email}</div>}
                          </td>
                          <td className="px-6 py-4 font-mono font-medium text-gray-900">{c.phone}</td>
                          <td className="px-6 py-4 text-xs text-gray-700">
                            {c.city && <span className="font-semibold text-gray-900 block">{c.city}</span>}
                            {c.tags ? (
                              <span className="inline-block bg-amber-50 text-[#D35400] text-[10px] font-bold px-2 py-0.5 rounded mt-0.5 border border-amber-200">
                                {c.tags}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {c.total_orders}
                            {c.total_orders >= 5 && (
                              <span className="ml-2 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                                #{c.total_orders} Milestone
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {c.total_orders >= 10 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                ⭐ Super VIP
                              </span>
                            ) : c.total_orders >= 5 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                🌟 VIP Buyer
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                Regular
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: DISCOUNT CODES & COUPONS */}
          {/* ========================================================= */}
          {activeTab === "discount_codes" && (
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
                  + Create Coupon Code
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
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {discountCodes.map((d) => (
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
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDeleteDiscountCode(d.id, d.code)}
                              className="text-gray-400 hover:text-red-600 transition"
                              title="Delete coupon"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: CART RECOVERY QUEUE */}
          {/* ========================================================= */}
          {activeTab === "cart_recovery" && (
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
          )}

          {/* ========================================================= */}
          {/* TAB 8: MESSAGE LOGS FULL VIEW */}
          {/* ========================================================= */}
          {activeTab === "logs" && (
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
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 9: OPT-OUT (DND) MANAGEMENT */}
          {/* ========================================================= */}
          {activeTab === "opt_out" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Opt-Out & Do Not Disturb (DND) Registry</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customers who texted STOP / બંધ કરો / रोको. Never messaged automatically.
                  </p>
                </div>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-600 border border-red-200">
                  {optOuts.length} Numbers Blocked
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Phone Number</th>
                      <th className="px-6 py-3">Reason / Text Trigger</th>
                      <th className="px-6 py-3">Unsubscribed At</th>
                      <th className="px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {optOuts.map((opt) => (
                      <tr key={opt.id} className="hover:bg-gray-50/80 transition">
                        <td className="px-6 py-4 font-mono font-bold text-gray-900">{opt.phone}</td>
                        <td className="px-6 py-4 text-xs font-mono text-red-600 bg-red-50/50 rounded inline-block my-2 px-2 py-1">
                          {opt.reason}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(opt.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleRemoveOptOut(opt.phone)}
                            className="text-xs text-gray-400 hover:text-red-600 transition flex items-center gap-1"
                            title="Unblock customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Create Rule Modal ── */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">Create New Automation Trigger Rule</h3>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleCreateRule} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15-Day Gentle Inactive Winback"
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Trigger Type</label>
                  <select
                    value={newRule.rule_type}
                    onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  >
                    <option value="INACTIVE_DAYS">Days Since Last Order</option>
                    <option value="ORDER_COUNT_VIP">Repeat VIP Buyers (Order Count)</option>
                    <option value="CART_RECOVERY">Abandoned Cart Delay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    {newRule.rule_type === "CART_RECOVERY" ? "Cart Delay" :
                     newRule.rule_type === "INACTIVE_DAYS" ? "Inactive Duration" :
                     newRule.rule_type === "ORDER_COUNT_VIP" ? "Order Milestone Count" :
                     "Threshold Value"}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="1"
                      required
                      value={newRule.threshold_value}
                      onChange={(e) => setNewRule({ ...newRule, threshold_value: parseInt(e.target.value) || 1 })}
                      className="w-full pl-3.5 pr-20 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                    <span className="absolute right-2.5 px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                      {newRule.rule_type === "CART_RECOVERY" ? "Minutes" :
                       newRule.rule_type === "INACTIVE_DAYS" ? "Days" :
                       newRule.rule_type === "ORDER_COUNT_VIP" ? "Orders" :
                       "Units"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Template to Send</label>
                  <select
                    value={newRule.template_name}
                    onChange={(e) => setNewRule({ ...newRule, template_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  >
                    {templates.length > 0 ? (
                      templates.map((t) => (
                        <option key={t.id} value={t.template_name}>
                          {t.template_name} ({t.language})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="cart_recovery_v1">cart_recovery_v1 (Cart Recovery English)</option>
                        <option value="abandoned_cart_recovery">abandoned_cart_recovery</option>
                        <option value="reengagement_30_days">reengagement_30_days</option>
                        <option value="vip_exclusive_offer">vip_exclusive_offer</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Discount Coupon Code</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP15 or SPECIAL5"
                    value={newRule.coupon_code}
                    onChange={(e) => setNewRule({ ...newRule, coupon_code: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Deduplication Gate (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={newRule.dedup_days}
                  onChange={(e) => setNewRule({ ...newRule, dedup_days: parseInt(e.target.value) || 7 })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <p className="text-[11px] text-gray-400 mt-1">Prevents messaging the same customer again within these days</p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-md"
                >
                  Save & Enable Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── New Campaign Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">Create New WhatsApp Broadcast</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleCreateCampaign} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Navratri Special Fafda-Jalebi Offer"
                  value={newCampaign.title}
                  onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">WhatsApp Approved Template</label>
                <select
                  value={newCampaign.template_name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, template_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                >
                  <option value="festive_promo_offer">festive_promo_offer (Festive Discounts)</option>
                  <option value="abandoned_cart_recovery">abandoned_cart_recovery (Cart Reminder)</option>
                  <option value="reengagement_30_days">reengagement_30_days (30-Day Winback)</option>
                  <option value="vip_exclusive_offer">vip_exclusive_offer (VIP Tasting Invite)</option>
                  <option value="weekend_teatime_snack">weekend_teatime_snack (Weekend Tea Reminder)</option>
                  <option value="reorder_reminder">reorder_reminder (Namkeen Refill Reminder)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Language</label>
                  <select
                    value={newCampaign.language}
                    onChange={(e) => setNewCampaign({ ...newCampaign, language: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  >
                    <option value="en">English (en)</option>
                    <option value="gu">ગુજરાતી (gu)</option>
                    <option value="hi">हिंदी (hi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Audience Segment</label>
                  <select
                    value={newCampaign.target_filter}
                    onChange={(e) => setNewCampaign({ ...newCampaign, target_filter: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  >
                    <option value="ALL">All Active Contacts ({contacts.length})</option>
                    <option value="INACTIVE_30_DAYS">30-Day Inactive Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  Schedule for Later (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={newCampaign.scheduled_for}
                  onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_for: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <p className="text-[11px] text-gray-400 mt-1">Leave empty to send broadcast immediately</p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-md"
                >
                  <Send className="w-4 h-4" />
                  {newCampaign.scheduled_for ? "Schedule Broadcast" : "Trigger Broadcast"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ── */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#25D366]" />
                <h3 className="font-bold text-base text-gray-900">Bulk Import Contacts (CSV)</h3>
              </div>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleImportCsv} className="mt-5 space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#25D366] transition">
                <input
                  type="file"
                  accept=".csv"
                  required
                  id="csvFileInput"
                  onChange={(e) => {
                    const selected = e.target.files[0];
                    if (selected && selected.size > 5 * 1024 * 1024) {
                      alert(`File is too large (${(selected.size / (1024 * 1024)).toFixed(2)}MB). Max upload limit is 5MB.`);
                      e.target.value = null;
                      setCsvFile(null);
                      return;
                    }
                    setCsvFile(selected);
                  }}
                  className="hidden"
                />
                <label htmlFor="csvFileInput" className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-xs font-bold text-gray-700">
                    {csvFile ? csvFile.name : "Click to select a CSV file"}
                  </span>
                  <span className="text-[11px] text-gray-400 mt-1">Max 5MB • UTF-8 format recommended</span>
                </label>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs text-gray-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">Expected CSV Columns:</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">Max 5MB</span>
                </div>
                <code className="text-[11px] font-mono text-[#D35400] block">phone, name, email, city, tags, total_orders</code>
                <div className="text-[11px] text-gray-400">Example phone: +919876543210</div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={csvImporting || !csvFile}
                  className="bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-md"
                >
                  {csvImporting ? "Importing..." : "Upload & Process"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Discount Code Modal ── */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#F5A623]" />
                <h3 className="font-bold text-base text-gray-900">Create Discount Coupon</h3>
              </div>
              <button onClick={() => setIsDiscountModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleCreateDiscountCode} className="mt-5 space-y-4">
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
                    onChange={(e) => setNewDiscountCode({ ...newDiscountCode, max_uses: parseInt(e.target.value) || 1000 })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
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
      )}

      {/* ── Create Template Modal ── */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-gray-900">Create & Submit WhatsApp Template</h3>
                <p className="text-xs text-gray-500">Submits to Meta Graph API & saves to your local catalog</p>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleCreateTemplate} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Template Identifier (lowercase, underscores)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. holi_special_namkeen"
                  value={newTemplate.template_name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Category</label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  >
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITY</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Language</label>
                  <select
                    value={newTemplate.language}
                    onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  >
                    <option value="en">English (en)</option>
                    <option value="gu">ગુજરાતી (gu)</option>
                    <option value="hi">हिंदी (hi)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Header Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Manubhai Gathiyawala"
                  value={newTemplate.header_text}
                  onChange={(e) => setNewTemplate({ ...newTemplate, header_text: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Message Body</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Hello {{1}}, enjoy fresh vanela gathiya with {{2}}% discount! Reply STOP to opt out."
                  value={newTemplate.body_text}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body_text: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366] leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Footer Text</label>
                <input
                  type="text"
                  placeholder="e.g. Manubhai Gathiyawala • Ahmedabad"
                  value={newTemplate.footer_text}
                  onChange={(e) => setNewTemplate({ ...newTemplate, footer_text: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-md"
                >
                  Submit Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Configure & Test Simulator Modal ── */}
      {isConfigModalOpen && selectedRuleForConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#D35400] flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Configure & Test: {selectedRuleForConfig.rule_name}</h3>
                  <p className="text-xs text-gray-500">Tune trigger thresholds, coupons, and simulate live WhatsApp flow</p>
                </div>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            {/* Configuration Form */}
            <form onSubmit={handleSaveConfigRule} className="mt-4 space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-gray-700 tracking-wider">1. Automation Rule Settings</h4>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(selectedRuleForConfig.id, selectedRuleForConfig.rule_name)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-semibold hover:bg-red-50 px-2 py-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Rule
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    value={selectedRuleForConfig.rule_name || ""}
                    onChange={(e) => setSelectedRuleForConfig({
                      ...selectedRuleForConfig,
                      rule_name: e.target.value
                    })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                      {selectedRuleForConfig.rule_type === "CART_RECOVERY" ? "Cart Delay" :
                       selectedRuleForConfig.rule_type === "INACTIVE_DAYS" ? "Inactive Duration" :
                       selectedRuleForConfig.rule_type === "ORDER_COUNT_VIP" ? "Order Milestone Count" :
                       "Threshold Value"}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="1"
                        value={selectedRuleForConfig.threshold_value}
                        onChange={(e) => setSelectedRuleForConfig({
                          ...selectedRuleForConfig,
                          threshold_value: parseInt(e.target.value) || 1
                        })}
                        className="w-full pl-3 pr-20 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                      />
                      <span className="absolute right-2 px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                        {selectedRuleForConfig.rule_type === "CART_RECOVERY" ? "Minutes" :
                         selectedRuleForConfig.rule_type === "INACTIVE_DAYS" ? "Days" :
                         selectedRuleForConfig.rule_type === "ORDER_COUNT_VIP" ? "Orders" :
                         "Units"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Discount Coupon Code</label>
                    <input
                      type="text"
                      value={selectedRuleForConfig.coupon_code || ""}
                      onChange={(e) => setSelectedRuleForConfig({
                        ...selectedRuleForConfig,
                        coupon_code: e.target.value.toUpperCase()
                      })}
                      placeholder="e.g. GATHIYA10"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Cooldown / Dedup Window</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={selectedRuleForConfig.dedup_days}
                        onChange={(e) => setSelectedRuleForConfig({
                          ...selectedRuleForConfig,
                          dedup_days: parseInt(e.target.value) || 1
                        })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                      />
                      <span className="text-xs text-gray-500 font-semibold">Days</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Template Linked</label>
                    <select
                      value={selectedRuleForConfig.template_name}
                      onChange={(e) => setSelectedRuleForConfig({
                        ...selectedRuleForConfig,
                        template_name: e.target.value
                      })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    >
                      {templates.length > 0 ? (
                        templates.map((t) => (
                          <option key={t.id} value={t.template_name}>
                            {t.template_name} ({t.language})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="cart_recovery_v1">cart_recovery_v1</option>
                          <option value="abandoned_cart_recovery">abandoned_cart_recovery</option>
                          <option value="reengagement_30_days">reengagement_30_days</option>
                          <option value="festive_promo_offer">festive_promo_offer</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2 rounded-lg font-bold text-xs shadow-xs transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>

            {/* Test Simulator Section */}
            <div className="mt-5 bg-gradient-to-br from-amber-50/50 to-orange-50/40 p-4 rounded-xl border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-[#D35400]" />
                  <h4 className="text-xs font-bold uppercase text-gray-900 tracking-wider">2. Interactive Test & Simulator</h4>
                </div>
                <span className="text-[10px] bg-amber-100 text-[#D35400] font-bold px-2 py-0.5 rounded border border-amber-300">
                  Fast 10-Second Test Delay
                </span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Test the whole automation flow without waiting 30 minutes! Simulate an abandoned cart, check if order completion cancels it, or execute the WhatsApp template immediately.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Test Phone Number</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Simulated Cart Value (₹)</label>
                  <input
                    type="number"
                    value={testCartValue}
                    onChange={(e) => setTestCartValue(e.target.value)}
                    placeholder="450"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={simulatingAction}
                  onClick={handleSimulateCartAbandonment}
                  className="bg-[#F5A623] hover:bg-[#E67E22] text-black font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  1. Abandon Cart
                </button>

                <button
                  type="button"
                  disabled={simulatingAction}
                  onClick={() => handleSimulateOrderCompleted()}
                  className="bg-[#10B981] hover:bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  2. Checkout (Recover)
                </button>

                <button
                  type="button"
                  disabled={simulatingAction}
                  onClick={handleDirectSendTest}
                  className="bg-[#111827] hover:bg-black text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <Send className="w-3.5 h-3.5 text-[#F5A623]" />
                  {simulatingAction ? "Sending..." : "3. Send WhatsApp"}
                </button>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteRule(selectedRuleForConfig.id, selectedRuleForConfig.rule_name)}
                className="text-xs text-red-600 hover:text-red-700 font-semibold"
              >
                Delete this rule
              </button>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

