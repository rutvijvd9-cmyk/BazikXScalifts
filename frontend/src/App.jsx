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
  Filter,
  ArrowUpDown,
  Trash2,
  Edit2,
  UserPlus,
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
  ChevronLeft,
  ChevronRight,
  Clock,
  Star,
  Package,
  CloudRain,
  Activity,
  Zap,
  Radio,
  BellRing,
  Mail,
  KeyRound,
  Smartphone,
  Check,
  CheckCheck,
  Sparkles,
  PhoneCall
} from "lucide-react";
import axios from "axios";

// Detect if running on mobile device or native Capacitor
const isNativePlatform = typeof window !== "undefined" && (
  window.Capacitor?.isNativePlatform?.() ||
  window.location?.protocol === "capacitor:" ||
  (window.location?.protocol === "https:" && window.location?.hostname === "localhost" && !window.location?.port)
);

// Fallback logic: Saved Custom URL -> VITE_API_URL -> Android Emulator loopback (10.0.2.2:8000) -> relative ""
export const getApiBaseUrl = () => {
  const saved = localStorage.getItem("mg_custom_api_url");
  if (saved) return saved;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (isNativePlatform) return "http://10.0.2.2:8000";
  return "";
};

const API_BASE_URL = getApiBaseUrl();
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

  // 2FA Authentication Challenge & Setup States
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorTempToken, setTwoFactorTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorMethod, setTwoFactorMethod] = useState("totp"); // "totp" or "email"
  const [twoFactorEmailSent, setTwoFactorEmailSent] = useState(false);
  const [twoFactorEmailPreview, setTwoFactorEmailPreview] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // 2FA Configuration in Settings States
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState(null);
  const [setupVerifyCode, setSetupVerifyCode] = useState("");
  const [setupVerifyLoading, setSetupVerifyLoading] = useState(false);
  const [setupVerifyError, setSetupVerifyError] = useState("");
  const [isDisable2faModalOpen, setIsDisable2faModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash && ["dashboard", "chat", "automations", "campaigns", "templates", "contacts", "discount_codes", "cart_recovery", "logs", "opt_out", "settings"].includes(hash)) {
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

  // Mobile Device Integrations (Capacitor StatusBar & SplashScreen)
  useEffect(() => {
    const initMobileDevice = async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        await StatusBar.setBackgroundColor({ color: "#064e3b" }).catch(() => {});
      } catch (e) {}

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide().catch(() => {});
      } catch (e) {}
    };
    initMobileDevice();
  }, []);

  // Android Hardware Back Button Handling
  useEffect(() => {
    let unlisten = null;
    const registerBackButton = async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const listener = await CapApp.addListener("backButton", ({ canGoBack }) => {
          if (activeTab !== "dashboard") {
            setActiveTab("dashboard");
          } else if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });
        unlisten = () => listener.remove();
      } catch (e) {}
    };
    registerBackButton();
    return () => {
      if (unlisten) unlisten();
    };
  }, [activeTab]);
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
  const [templatePage, setTemplatePage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState(null);

  // Two-Way WhatsApp Live Chat States
  const [chatConversations, setChatConversations] = useState([]);
  const [selectedChatPhone, setSelectedChatPhone] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReplyText, setChatReplyText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatFilterUnreadOnly, setChatFilterUnreadOnly] = useState(false);
  const [chatListCollapsed, setChatListCollapsed] = useState(false);

  // Layout UI States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Search filter for lists
  const [searchTerm, setSearchTerm] = useState("");

  // Contacts Pagination & Filtering State
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsPerPage, setContactsPerPage] = useState(50);
  const [contactSortField, setContactSortField] = useState("id");
  const [contactSortOrder, setContactSortOrder] = useState("desc");
  const [contactFilterCity, setContactFilterCity] = useState("ALL");
  const [contactFilterTag, setContactFilterTag] = useState("ALL");
  const [contactFilterVip, setContactFilterVip] = useState("ALL");
  const [contactFilterOrders, setContactFilterOrders] = useState("ALL");

  // Single Contact Add / Edit Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactForm, setContactForm] = useState({
    phone: "",
    name: "",
    email: "",
    city: "",
    tags: "",
    total_orders: 0,
    last_order_date: ""
  });
  const [contactSaving, setContactSaving] = useState(false);

  // New Campaign Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    title: "",
    template_name: "",
    language: "en",
    target_filter: "ALL",
    scheduled_for: ""
  });

  const handleOpenCampaignModal = () => {
    const approvedTmpl = templates.find((t) => t.status === "APPROVED") || templates[0];
    setNewCampaign({
      title: "",
      template_name: approvedTmpl ? approvedTmpl.template_name : "",
      language: approvedTmpl ? (approvedTmpl.language || "en") : "en",
      target_filter: "ALL",
      scheduled_for: ""
    });
    setIsModalOpen(true);
  };

  // 🔐 Step-Up Security & 2FA Modal States (for Campaign Launch & Automation Release)
  const [securityActionModal, setSecurityActionModal] = useState({
    isOpen: false,
    actionType: null, // "CAMPAIGN" or "AUTOMATION_APPROVAL"
    title: "",
    recipientCount: 0,
    payloadData: null,
    password: "",
    twoFactorCode: "",
    error: "",
    loading: false
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
    template_name: "cart_recovery_v1",
    coupon_code: "",
    dedup_days: 7,
    expires_at: "",
    variable_mappings: {}
  });

  const handleOpenRuleModal = () => {
    const approvedTmpl = templates.find((t) => t.status === "APPROVED") || templates[0];
    setNewRule({
      rule_name: "",
      rule_type: "INACTIVE_DAYS",
      threshold_value: 15,
      template_name: approvedTmpl ? approvedTmpl.template_name : "cart_recovery_v1",
      coupon_code: discountCodes[0]?.code || "",
      dedup_days: 7,
      expires_at: "",
      variable_mappings: {}
    });
    setIsRuleModalOpen(true);
  };

  // Configure & Test Simulator Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedRuleForConfig, setSelectedRuleForConfig] = useState(null);
  const [testPhone, setTestPhone] = useState("+919876543210");
  const [testCartValue, setTestCartValue] = useState(450);
  const [simulatingAction, setSimulatingAction] = useState(false);
  // Add User from Settings Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: "", email: "", password: "" });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState("");

  const handleCreateUserFromSettings = async (e) => {
    e.preventDefault();
    if (!token) return;
    setAddUserLoading(true);
    setAddUserError("");
    try {
      await axios.post("/api/users", newUserForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`✅ Team user "${newUserForm.username}" registered successfully!`);
      setIsAddUserModalOpen(false);
      setNewUserForm({ username: "", email: "", password: "" });
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      setAddUserError(err.response?.data?.detail || err.message || "Failed to create user");
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await axios.post("/api/auth/login", loginForm);
      if (res.data.requires_2fa) {
        // Switch to 2FA challenge mode
        setTwoFactorRequired(true);
        setTwoFactorTempToken(res.data.temp_token);
        setTwoFactorCode("");
        setTwoFactorMethod("totp");
        setTwoFactorEmailSent(false);
        setTwoFactorEmailPreview("");
        return;
      }
      const jwt = res.data.access_token;
      setToken(jwt);
      setUsername(res.data.username);
      localStorage.setItem("token", jwt);
      localStorage.setItem("username", res.data.username);
    } catch (err) {
      setLoginError(err.response?.data?.detail || "Invalid login credentials");
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) return;
    setLoginError("");
    setTwoFactorLoading(true);
    try {
      const res = await axios.post("/api/auth/2fa/verify", {
        code: twoFactorCode.trim(),
        temp_token: twoFactorTempToken
      });
      const jwt = res.data.access_token;
      setToken(jwt);
      setUsername(res.data.username);
      localStorage.setItem("token", jwt);
      localStorage.setItem("username", res.data.username);
      setTwoFactorRequired(false);
      setTwoFactorTempToken("");
      setTwoFactorCode("");
    } catch (err) {
      setLoginError(err.response?.data?.detail || "Invalid 2FA code. Please try again.");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleCancel2FA = () => {
    setTwoFactorRequired(false);
    setTwoFactorTempToken("");
    setTwoFactorCode("");
    setTwoFactorEmailSent(false);
    setLoginError("");
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
      const [campRes, contRes, cartRes, logsRes, optRes, tmplRes, rulesRes, setRes, usersRes, discRes, meRes, convRes] = await Promise.all([
        axios.get("/api/campaigns", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/contacts", { headers }).catch((e) => { if (e.response?.status === 401) throw e; return { data: [] }; }),
        axios.get("/api/cart-events", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/message-logs", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/opt-outs", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/templates", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/automation-rules", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/settings", { headers }).catch(() => ({ data: {} })),
        axios.get("/api/users", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/discount-codes", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/auth/me", { headers }).catch(() => ({ data: null })),
        axios.get("/api/chat/conversations", { headers }).catch(() => ({ data: [] }))
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
      setChatConversations(convRes.data || []);
      if (meRes?.data) setCurrentUserProfile(meRes.data);
    } catch (err) {
      console.error("Failed to fetch protected data:", err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchChatConversations = async (silent = false) => {
    if (!token) return;
    try {
      const res = await axios.get("/api/chat/conversations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatConversations(res.data || []);
    } catch (err) {
      if (!silent) console.error("Failed to fetch chat conversations:", err);
    }
  };

  const fetchChatMessages = async (phone, silent = false) => {
    if (!token || !phone) return;
    if (!silent) setChatLoading(true);
    try {
      const res = await axios.get(`/api/chat/messages/${encodeURIComponent(phone)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatMessages(res.data || []);
      // Update local unread counter for this conversation
      setChatConversations((prev) =>
        prev.map((c) => (c.customer_phone === phone ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      if (!silent) console.error("Failed to fetch messages for " + phone, err);
    } finally {
      if (!silent) setChatLoading(false);
    }
  };

  const handleSelectConversation = (phone) => {
    setSelectedChatPhone(phone);
    fetchChatMessages(phone, false);
  };

  const handleSendChatMessage = async (e) => {
    e?.preventDefault();
    if (!chatReplyText.trim() || !selectedChatPhone || chatSending) return;

    const messageText = chatReplyText.trim();
    setChatSending(true);

    // Optimistic local bubble
    const optimisticMsg = {
      id: "opt_" + Date.now(),
      customer_phone: selectedChatPhone,
      sender_type: "AGENT",
      message_type: "text",
      text: messageText,
      status: "SENDING",
      is_read: true,
      created_at: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);
    setChatReplyText("");

    try {
      const res = await axios.post(
        "/api/chat/send",
        {
          customer_phone: selectedChatPhone,
          text: messageText
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Replace optimistic message with actual backend response
      setChatMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? res.data : m))
      );
      // Refresh conversation preview
      fetchChatConversations(true);
    } catch (err) {
      alert("Failed to send message: " + (err.response?.data?.detail || err.message));
      setChatMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setChatReplyText(messageText);
    } finally {
      setChatSending(false);
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
      setActionSuccessMsg(`${res.data.message}`);
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

  const handleOpenAddContact = () => {
    setEditingContactId(null);
    setContactForm({
      phone: "+91",
      name: "",
      email: "",
      city: "",
      tags: "",
      total_orders: 0,
      last_order_date: ""
    });
    setIsContactModalOpen(true);
  };

  const handleOpenEditContact = (c) => {
    setEditingContactId(c.id);
    setContactForm({
      phone: c.phone || "",
      name: c.name || "",
      email: c.email || "",
      city: c.city || "",
      tags: c.tags || "",
      total_orders: Number(c.total_orders) || 0,
      last_order_date: c.last_order_date ? c.last_order_date.split("T")[0] : ""
    });
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setContactSaving(true);
    try {
      const payload = {
        phone: contactForm.phone.trim(),
        name: contactForm.name.trim() || null,
        email: contactForm.email.trim() || null,
        city: contactForm.city.trim() || null,
        tags: contactForm.tags.trim() || null,
        total_orders: Number(contactForm.total_orders) || 0,
        last_order_date: contactForm.last_order_date ? contactForm.last_order_date : null
      };

      if (editingContactId) {
        await axios.put(`/api/contacts/${editingContactId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setActionSuccessMsg(`Contact ${payload.phone} updated successfully!`);
      } else {
        await axios.post("/api/contacts", payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setActionSuccessMsg(`Contact ${payload.phone} added successfully!`);
      }

      setIsContactModalOpen(false);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to save contact: " + (err.response?.data?.detail || err.message));
    } finally {
      setContactSaving(false);
    }
  };

  const handleDeleteContact = async (c) => {
    if (!window.confirm(`Are you sure you want to delete contact ${c.phone} (${c.name || "Customer"})?`)) return;
    try {
      await axios.delete(`/api/contacts/${c.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`🗑️ Contact ${c.phone} deleted successfully!`);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to delete contact: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateDiscountCode = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/discount-codes", newDiscountCode, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`Discount Code '${newDiscountCode.code}' created successfully!`);
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
      setActionSuccessMsg(`Template '${res.data.template_name}' submitted and saved!`);
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

  // Periodic polling for Live Two-Way Chat (polls conversations every 6s, and active chat messages every 4s)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchChatConversations(true);
      if (selectedChatPhone && activeTab === "chat") {
        fetchChatMessages(selectedChatPhone, true);
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [token, selectedChatPhone, activeTab]);

  const handleSyncMetaTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.post("/api/templates/sync-from-meta", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`${res.data.message}`);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to sync from Meta: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId, templateName) => {
    if (!window.confirm(`Are you sure you want to delete template "${templateName}"? This will remove it from your CRM catalog.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await axios.delete(`/api/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`🗑️ ${res.data.message || "Template deleted successfully."}`);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to delete template: " + (err.response?.data?.detail || err.message));
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

      if (res.data.requires_approval) {
        // Intercept: More than 100 recipients! Open step-up 2FA approval modal
        setSecurityActionModal({
          isOpen: true,
          actionType: "AUTOMATION_APPROVAL",
          title: `Approve High-Volume Automation: "${rule.rule_name}"`,
          recipientCount: res.data.eligible_count,
          payloadData: { ruleId: rule.id, ruleName: rule.rule_name },
          password: "",
          twoFactorCode: "",
          error: "",
          loading: false
        });
        fetchData();
        return;
      }

      setActionSuccessMsg(`Automation '${rule.rule_name}' executed: ${res.data.messages_dispatched} messages sent (dedup applied).`);
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
          expires_at: newRule.expires_at ? new Date(newRule.expires_at).toISOString() : null,
          trigger_condition: triggerDesc
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsRuleModalOpen(false);
      fetchData();
    } catch (err) {
      alert("Failed to create rule: " + (err.response?.data?.detail || err.message));
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
          dedup_days: selectedRuleForConfig.dedup_days,
          expires_at: selectedRuleForConfig.expires_at ? new Date(selectedRuleForConfig.expires_at).toISOString() : null,
          variable_mappings: selectedRuleForConfig.variable_mappings || {}
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionSuccessMsg(`Automation '${selectedRuleForConfig.rule_name}' updated successfully!`);
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
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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

    // Calculate approximate recipient count for confirmation
    const estCount =
      newCampaign.target_filter === "INACTIVE_30_DAYS"
        ? contacts.filter((c) => !c.last_order_date).length || 5
        : contacts.length;

    // Intercept: open 2FA security verification modal before dispatching!
    setSecurityActionModal({
      isOpen: true,
      actionType: "CAMPAIGN",
      title: `Confirm WhatsApp Broadcast: "${newCampaign.title}"`,
      recipientCount: estCount,
      payloadData: { ...newCampaign },
      password: "",
      twoFactorCode: "",
      error: "",
      loading: false
    });
  };

  const handleExecuteSecurityAction = async (e) => {
    e.preventDefault();
    const { actionType, payloadData, password, twoFactorCode } = securityActionModal;
    if (!password) {
      setSecurityActionModal((prev) => ({ ...prev, error: "Please enter your account password." }));
      return;
    }

    setSecurityActionModal((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      if (actionType === "CAMPAIGN") {
        await axios.post(
          "/api/campaigns",
          {
            ...payloadData,
            password: password,
            two_factor_code: twoFactorCode.trim()
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setActionSuccessMsg(`✅ Broadcast Campaign '${payloadData.title}' successfully verified with 2FA and queued for dispatch!`);
        setIsModalOpen(false);
        setSecurityActionModal((prev) => ({ ...prev, isOpen: false }));
        const approvedTmpl = templates.find((t) => t.status === "APPROVED") || templates[0];
        setNewCampaign({
          title: "",
          template_name: approvedTmpl ? approvedTmpl.template_name : "",
          language: approvedTmpl ? (approvedTmpl.language || "en") : "en",
          target_filter: "ALL",
          scheduled_for: ""
        });
        fetchData();
        setTimeout(() => setActionSuccessMsg(""), 6000);

      } else if (actionType === "AUTOMATION_APPROVAL") {
        const res = await axios.post(
          `/api/automation-rules/${payloadData.ruleId}/approve`,
          {
            password: password,
            two_factor_code: twoFactorCode.trim()
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setActionSuccessMsg(`✅ ${res.data.message}`);
        setSecurityActionModal((prev) => ({ ...prev, isOpen: false }));
        fetchData();
        setTimeout(() => setActionSuccessMsg(""), 6000);
      }
    } catch (err) {
      setSecurityActionModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.detail || err.message || "Authorization failed."
      }));
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

          {twoFactorRequired ? (
            /* 2FA Challenge View */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600 mb-2">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">Two-Factor Authentication</h3>
                <p className="text-xs text-gray-600">
                  {twoFactorMethod === "email"
                    ? `Enter the emergency 6-digit code sent to ${twoFactorEmailPreview || "your email"}`
                    : "Enter the 6-digit code from Google Authenticator"}
                </p>
              </div>

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1 text-center">
                    6-Digit Security Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    maxLength={8}
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-center tracking-[12px] font-mono text-2xl font-bold py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={twoFactorLoading || twoFactorCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-2.5 rounded-lg text-sm shadow-md transition disabled:opacity-50"
                >
                  {twoFactorLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Verify & Sign In
                </button>
              </form>

              <div className="pt-2 border-t border-gray-100 flex flex-col items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleCancel2FA}
                  className="text-gray-400 hover:text-gray-600 text-[11px] pt-1"
                >
                  ← Cancel and return to sign in
                </button>
              </div>
            </div>
          ) : (
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
      {/* ── Left Sidebar (Collapsible) ── */}
      <aside
        className={`${
          sidebarCollapsed ? "w-16" : "w-64"
        } flex-shrink-0 bg-[#111827] text-gray-300 flex flex-col justify-between border-r border-gray-800 transition-all duration-300 ease-in-out relative`}
      >
        {/* Sidebar Collapse / Expand Floating Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 z-30 w-6 h-6 rounded-full bg-[#F5A623] hover:bg-[#E67E22] text-black flex items-center justify-center shadow-md transition transform hover:scale-110"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        <div>
          {/* Brand Header */}
          <div className={`p-4 flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} border-b border-gray-800`}>
            <div className="w-10 h-10 rounded-lg bg-[#F5A623] flex items-center justify-center font-bold text-black text-xl shadow-md flex-shrink-0">
              MG
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="font-bold text-white text-base leading-tight">Manubhai</h1>
                <span className="text-xs text-[#F5A623] font-medium tracking-wide">Gathiyawala/Scalifts</span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-1.5 mt-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              {
                id: "chat",
                label: "Live Chat / Inbox",
                icon: MessageSquare,
                badge: chatConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)
              },
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
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3.5 py-2.5"
                  } rounded-lg text-sm font-medium transition-all relative group ${
                    isActive
                      ? `bg-[#1F2937] text-[#F5A623] ${!sidebarCollapsed ? "border-l-4 border-[#F5A623]" : "ring-1 ring-[#F5A623]"}`
                      : "hover:bg-gray-800/60 hover:text-white"
                  }`}
                >
                  <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-[#F5A623]" : "text-gray-400"}`} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </div>

                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`${
                        sidebarCollapsed
                          ? "absolute -top-1 -right-1 min-w-[16px] h-4 text-[9px] px-1 flex items-center justify-center font-black rounded-full"
                          : "px-2 py-0.5 text-xs font-bold rounded-full"
                      } ${
                        item.id === "opt_out"
                          ? "bg-red-900/80 text-red-200 border border-red-700"
                          : item.id === "chat"
                          ? "bg-[#25D366] text-black font-black animate-pulse shadow-sm shadow-green-500/50"
                          : item.id === "automations"
                          ? "bg-emerald-900/80 text-[#25D366] border border-emerald-700"
                          : "bg-amber-900/80 text-[#F5A623] border border-amber-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Tooltip on hover when collapsed */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-gray-900 text-white text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition shadow-lg whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status & Logout */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse"></span>
                <span className="text-gray-300 font-semibold truncate max-w-[120px]">{username}</span>
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
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse" title={`Logged in as ${username}`}></span>
              <button
                onClick={handleLogout}
                className="p-1 text-gray-400 hover:text-red-400 transition rounded"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className={`flex-1 flex flex-col ${activeTab === "chat" ? "overflow-hidden h-screen" : "overflow-y-auto"}`}>
        {/* Top App Bar */}
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 capitalize">
              {activeTab === "opt_out"
                ? "Opt-Out (DND) Registry"
                : activeTab === "chat"
                ? "Two-Way WhatsApp Live Chat / Inbox"
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
                onClick={handleOpenRuleModal}
                className="flex items-center gap-2 bg-[#F5A623] hover:bg-[#E67E22] text-black px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Create New Rule
              </button>
            )}

            {(activeTab === "campaigns" || activeTab === "dashboard") && (
              <button
                onClick={handleOpenCampaignModal}
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
        <div className={activeTab === "chat" ? "p-3 md:p-5 flex-1 flex flex-col min-h-0 overflow-hidden" : "p-8 space-y-6"}>
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
                          {rule.expires_at && (
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="font-medium text-gray-500">Expiry Deadline:</span>
                              <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                                new Date(rule.expires_at) < new Date()
                                  ? "bg-red-100 text-red-700 font-bold"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {new Date(rule.expires_at).toLocaleDateString()} {new Date(rule.expires_at) < new Date() ? "(Expired)" : ""}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-gray-600 border-t border-gray-200/60 pt-2">
                            <span className="font-medium text-gray-500">Total Dispatched:</span>
                            <span className="font-bold text-gray-900">{rule.total_triggered} sent</span>
                          </div>

                          {rule.approval_status === "PENDING_APPROVAL" && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center justify-between">
                              <span className="font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Held: {rule.pending_recipients_count} contacts (&gt;100 limit)
                              </span>
                              <span className="font-bold text-amber-700 underline cursor-pointer" onClick={() => handleTriggerRule(rule)}>
                                Review & Approve →
                              </span>
                            </div>
                          )}
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

                        {rule.approval_status === "PENDING_APPROVAL" ? (
                          <button
                            onClick={() => handleTriggerRule(rule)}
                            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black px-3.5 py-1.5 rounded-lg text-xs font-black transition shadow-xs animate-pulse"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            2FA Approve ({rule.pending_recipients_count})
                          </button>
                        ) : (
                          <button
                            onClick={() => handleTriggerRule(rule)}
                            disabled={!rule.is_active}
                            className="flex items-center gap-1.5 bg-[#111827] hover:bg-black disabled:opacity-40 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
                          >
                            <PlayCircle className="w-3.5 h-3.5 text-[#F5A623]" />
                            Execute Now
                          </button>
                        )}
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
                    onClick={handleOpenRuleModal}
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
                  <div className="flex items-center gap-3">
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
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Email Address</th>
                        <th className="px-4 py-3">2FA Security</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Access Level</th>
                        <th className="px-4 py-3 text-right">Actions</th>
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
                          <td className="px-4 py-3.5 text-right">
                            {u.username === username && (
                              u.is_2fa_enabled ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDisablePassword("");
                                    setIsDisable2faModalOpen(true);
                                  }}
                                  className="text-xs text-red-600 hover:text-red-800 font-semibold hover:underline"
                                >
                                  Disable 2FA
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setSetupVerifyError("");
                                    setSetupVerifyCode("");
                                    try {
                                      const res = await axios.get("/api/auth/2fa/setup", {
                                        headers: { Authorization: `Bearer ${token}` }
                                      });
                                      setTwoFactorSetupData(res.data);
                                      setIs2faModalOpen(true);
                                    } catch (err) {
                                      alert("Failed to initiate 2FA setup: " + (err.response?.data?.detail || err.message));
                                    }
                                  }}
                                  className="text-xs bg-[#25D366] hover:bg-[#1EBE5D] text-white px-2.5 py-1 rounded-md font-bold transition inline-flex items-center gap-1 shadow-xs"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  Enable 2FA
                                </button>
                              )
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
                            onClick={() => {
                              setTemplateFilterLang(lang);
                              setTemplatePage(1);
                            }}
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
              ) : (() => {
                const templatesPerPage = 10;
                const filteredTemplates = templates.filter(
                  (t) => templateFilterLang === "ALL" || t.language === templateFilterLang
                );
                const totalTemplatePages = Math.ceil(filteredTemplates.length / templatesPerPage) || 1;
                const currentTemplatePage = Math.min(templatePage, totalTemplatePages);
                const paginatedTemplates = filteredTemplates.slice(
                  (currentTemplatePage - 1) * templatesPerPage,
                  currentTemplatePage * templatesPerPage
                );

                return (
                  <>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {paginatedTemplates.map((t) => (
                        <div
                          key={t.id}
                          className="border border-gray-200 rounded-xl p-4.5 bg-gray-50/50 flex flex-col justify-between hover:border-gray-300 transition"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#111827] text-white uppercase tracking-wider">
                                {t.language}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                t.status === "APPROVED"
                                  ? "bg-green-50 text-emerald-700 border-green-200"
                                  : t.status === "REJECTED"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-500">{t.footer_text}</span>
                              <button
                                onClick={() => handleDeleteTemplate(t.id, t.template_name)}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline flex items-center gap-1 transition"
                                title={`Delete ${t.template_name}`}
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalTemplatePages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white flex-wrap gap-3">
                        <span className="text-xs text-gray-500">
                          Showing {(currentTemplatePage - 1) * templatesPerPage + 1} to{" "}
                          {Math.min(currentTemplatePage * templatesPerPage, filteredTemplates.length)} of {filteredTemplates.length} templates
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setTemplatePage((p) => Math.max(p - 1, 1))}
                            disabled={currentTemplatePage === 1}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalTemplatePages }, (_, i) => i + 1).map((num) => (
                              <button
                                key={num}
                                onClick={() => setTemplatePage(num)}
                                className={`w-7 h-7 text-xs font-bold rounded-lg transition ${
                                  currentTemplatePage === num
                                    ? "bg-[#111827] text-[#F5A623]"
                                    : "text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setTemplatePage((p) => Math.min(p + 1, totalTemplatePages))}
                            disabled={currentTemplatePage === totalTemplatePages}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
                  onClick={handleOpenCampaignModal}
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
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                    <span>Show:</span>
                    <select
                      value={contactsPerPage}
                      onChange={(e) => {
                        setContactsPerPage(Number(e.target.value));
                        setContactsPage(1);
                      }}
                      className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
                    >
                      <option value={20}>20 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                      <option value={200}>200 / page</option>
                      <option value={500}>500 / page</option>
                    </select>
                  </div>
                  <div className="relative w-56">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search phone, name, city..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setContactsPage(1);
                      }}
                      className="w-full pl-9 pr-3.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>
                  <button
                    onClick={handleOpenAddContact}
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-xs transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Contact
                  </button>
                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="flex items-center gap-1.5 bg-[#111827] hover:bg-gray-800 text-[#F5A623] px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-xs transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import CSV
                  </button>
                </div>
              </div>
              {(() => {
                // Unique cities and tags for filter dropdowns
                const uniqueCities = Array.from(new Set(contacts.map((c) => c.city).filter(Boolean))).sort();
                const uniqueTags = Array.from(
                  new Set(
                    contacts
                      .flatMap((c) => (c.tags ? c.tags.split(",").map((t) => t.trim()) : []))
                      .filter(Boolean)
                  )
                ).sort();

                const filteredContacts = contacts.filter((c) => {
                  const orders = Number(c.total_orders) || 0;
                  const matchesSearch =
                    !searchTerm ||
                    c.phone.includes(searchTerm) ||
                    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (c.tags && c.tags.toLowerCase().includes(searchTerm.toLowerCase()));

                  const matchesCity = contactFilterCity === "ALL" || c.city === contactFilterCity;

                  const matchesTag =
                    contactFilterTag === "ALL" ||
                    (c.tags && c.tags.toLowerCase().includes(contactFilterTag.toLowerCase()));

                  const matchesVip =
                    contactFilterVip === "ALL" ||
                    (contactFilterVip === "SUPER_VIP" && orders >= 10) ||
                    (contactFilterVip === "VIP" && orders >= 5 && orders < 10) ||
                    (contactFilterVip === "REGULAR" && orders < 5);

                  const matchesOrders =
                    contactFilterOrders === "ALL" ||
                    (contactFilterOrders === "0" && orders === 0) ||
                    (contactFilterOrders === "1_4" && orders >= 1 && orders <= 4) ||
                    (contactFilterOrders === "5_9" && orders >= 5 && orders <= 9) ||
                    (contactFilterOrders === "10_PLUS" && orders >= 10);

                  return matchesSearch && matchesCity && matchesTag && matchesVip && matchesOrders;
                });

                // Sorting
                filteredContacts.sort((a, b) => {
                  let valA = a[contactSortField];
                  let valB = b[contactSortField];

                  if (contactSortField === "name") {
                    valA = (a.name || "").toLowerCase();
                    valB = (b.name || "").toLowerCase();
                  } else if (contactSortField === "phone") {
                    valA = a.phone || "";
                    valB = b.phone || "";
                  } else if (contactSortField === "city") {
                    valA = (a.city || "").toLowerCase();
                    valB = (b.city || "").toLowerCase();
                  } else if (contactSortField === "total_orders") {
                    valA = Number(a.total_orders) || 0;
                    valB = Number(b.total_orders) || 0;
                  } else if (contactSortField === "last_order_date") {
                    valA = a.last_order_date ? new Date(a.last_order_date).getTime() : 0;
                    valB = b.last_order_date ? new Date(b.last_order_date).getTime() : 0;
                  } else if (contactSortField === "id") {
                    valA = Number(a.id) || 0;
                    valB = Number(b.id) || 0;
                  }

                  if (valA < valB) return contactSortOrder === "asc" ? -1 : 1;
                  if (valA > valB) return contactSortOrder === "asc" ? 1 : -1;
                  return 0;
                });

                const totalContacts = filteredContacts.length;
                const totalPages = Math.max(1, Math.ceil(totalContacts / contactsPerPage));
                const currentPage = Math.min(contactsPage, totalPages);
                const startIndex = (currentPage - 1) * contactsPerPage;
                const paginatedContacts = filteredContacts.slice(startIndex, startIndex + contactsPerPage);

                const handleSort = (field) => {
                  if (contactSortField === field) {
                    setContactSortOrder(contactSortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setContactSortField(field);
                    setContactSortOrder(field === "name" || field === "city" ? "asc" : "desc");
                  }
                  setContactsPage(1);
                };

                const hasActiveFilters =
                  searchTerm ||
                  contactFilterCity !== "ALL" ||
                  contactFilterTag !== "ALL" ||
                  contactFilterVip !== "ALL" ||
                  contactFilterOrders !== "ALL";

                return (
                  <>
                    {/* Filter Toolbar */}
                    <div className="bg-gray-50/70 border-b border-gray-200 px-6 py-2.5 flex items-center justify-between flex-wrap gap-2.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 font-semibold text-gray-700 mr-1">
                          <Filter className="w-3.5 h-3.5 text-gray-500" />
                          <span>Filters:</span>
                        </div>

                        {/* City Filter */}
                        <select
                          value={contactFilterCity}
                          onChange={(e) => {
                            setContactFilterCity(e.target.value);
                            setContactsPage(1);
                          }}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                        >
                          <option value="ALL">All Cities ({uniqueCities.length})</option>
                          {uniqueCities.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>

                        {/* Tag Filter */}
                        <select
                          value={contactFilterTag}
                          onChange={(e) => {
                            setContactFilterTag(e.target.value);
                            setContactsPage(1);
                          }}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                        >
                          <option value="ALL">All Tags ({uniqueTags.length})</option>
                          {uniqueTags.map((tag) => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>

                        {/* VIP Status Filter */}
                        <select
                          value={contactFilterVip}
                          onChange={(e) => {
                            setContactFilterVip(e.target.value);
                            setContactsPage(1);
                          }}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                        >
                          <option value="ALL">All VIP Tiers</option>
                          <option value="SUPER_VIP">⭐ Super VIP (10+ Orders)</option>
                          <option value="VIP">🌟 VIP Buyer (5-9 Orders)</option>
                          <option value="REGULAR">Regular (&lt; 5 Orders)</option>
                        </select>

                        {/* Order Volume Filter */}
                        <select
                          value={contactFilterOrders}
                          onChange={(e) => {
                            setContactFilterOrders(e.target.value);
                            setContactsPage(1);
                          }}
                          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                        >
                          <option value="ALL">All Order Counts</option>
                          <option value="0">0 Orders (New Lead)</option>
                          <option value="1_4">1 - 4 Orders</option>
                          <option value="5_9">5 - 9 Orders</option>
                          <option value="10_PLUS">10+ Orders</option>
                        </select>

                        {hasActiveFilters && (
                          <button
                            onClick={() => {
                              setSearchTerm("");
                              setContactFilterCity("ALL");
                              setContactFilterTag("ALL");
                              setContactFilterVip("ALL");
                              setContactFilterOrders("ALL");
                              setContactsPage(1);
                            }}
                            className="text-xs text-red-600 hover:text-red-700 font-bold ml-1 transition cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      <div className="text-[11px] text-gray-500 font-medium">
                        Found <strong className="text-gray-900">{totalContacts}</strong> match{totalContacts === 1 ? "" : "es"}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                          <tr>
                            <th
                              onClick={() => handleSort("name")}
                              className="px-6 py-3 cursor-pointer hover:bg-gray-100/80 transition select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Customer Name</span>
                                <ArrowUpDown className={`w-3 h-3 ${contactSortField === "name" ? "text-emerald-600 font-bold" : "text-gray-400"}`} />
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("phone")}
                              className="px-6 py-3 cursor-pointer hover:bg-gray-100/80 transition select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Phone Number</span>
                                <ArrowUpDown className={`w-3 h-3 ${contactSortField === "phone" ? "text-emerald-600 font-bold" : "text-gray-400"}`} />
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("city")}
                              className="px-6 py-3 cursor-pointer hover:bg-gray-100/80 transition select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>City / Tags</span>
                                <ArrowUpDown className={`w-3 h-3 ${contactSortField === "city" ? "text-emerald-600 font-bold" : "text-gray-400"}`} />
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("total_orders")}
                              className="px-6 py-3 cursor-pointer hover:bg-gray-100/80 transition select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Total Orders</span>
                                <ArrowUpDown className={`w-3 h-3 ${contactSortField === "total_orders" ? "text-emerald-600 font-bold" : "text-gray-400"}`} />
                              </div>
                            </th>
                            <th
                              onClick={() => handleSort("last_order_date")}
                              className="px-6 py-3 cursor-pointer hover:bg-gray-100/80 transition select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Last Order Date</span>
                                <ArrowUpDown className={`w-3 h-3 ${contactSortField === "last_order_date" ? "text-emerald-600 font-bold" : "text-gray-400"}`} />
                              </div>
                            </th>
                            <th className="px-6 py-3">VIP Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paginatedContacts.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-xs font-medium">
                                No contacts found matching the active filters or search.
                              </td>
                            </tr>
                          ) : (
                            paginatedContacts.map((c) => {
                              const orders = Number(c.total_orders) || 0;
                              return (
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
                                    {orders}
                                    {orders >= 5 && (
                                      <span className="ml-2 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                                        #{orders} Milestone
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-xs font-medium text-gray-600 whitespace-nowrap">
                                    {c.last_order_date ? (
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                        <span>
                                          {new Date(c.last_order_date).toLocaleDateString("en-IN", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric"
                                          })}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    {orders >= 10 ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                        ⭐ Super VIP
                                      </span>
                                    ) : orders >= 5 ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        🌟 VIP Buyer
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                        Regular
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleOpenEditContact(c)}
                                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                        title="Edit Contact"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteContact(c)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="Delete Contact"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
                      <div className="text-xs text-gray-500 font-medium">
                        Showing <strong className="text-gray-900">{totalContacts === 0 ? 0 : startIndex + 1}</strong> to{" "}
                        <strong className="text-gray-900">{Math.min(startIndex + contactsPerPage, totalContacts)}</strong> of{" "}
                        <strong className="text-gray-900">{totalContacts}</strong> contacts
                        {hasActiveFilters && <span className="ml-1 text-amber-600 font-semibold">(filtered)</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setContactsPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage <= 1}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Prev
                        </button>

                        <div className="text-xs font-semibold text-gray-700 px-2">
                          Page <span className="font-bold text-gray-900">{currentPage}</span> of{" "}
                          <span className="font-bold text-gray-900">{totalPages}</span>
                        </div>

                        <button
                          onClick={() => setContactsPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage >= totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer disabled:cursor-not-allowed"
                        >
                          Next
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
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
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            log.status === "FAILED"
                              ? "bg-red-50 text-red-700 border border-red-200"
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

          {/* ========================================================= */}
          {/* TAB 10: TWO-WAY LIVE CHAT & INBOX */}
          {/* ========================================================= */}
          {activeTab === "chat" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
              {/* Top Banner / Live Status Indicator */}
              <div className="px-6 py-2.5 bg-gradient-to-r from-emerald-50 via-gray-50 to-white border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#25D366]"></span>
                    </span>
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Meta Cloud Webhook Active
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">|</span>
                  <span className="text-xs text-gray-600">
                    Two-way synchronized live customer conversations
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Auto-syncing every 4.5s
                </div>
              </div>

              {/* 2-Column WhatsApp Web Layout */}
              <div className="flex-1 flex overflow-hidden min-h-0 relative">
                {/* ── Left Column: Conversation Sidebar (Collapsible) ── */}
                <div
                  className={`${
                    chatListCollapsed ? "w-0 md:w-0 border-r-0 overflow-hidden hidden" : "w-80 md:w-96 border-r border-gray-200"
                  } flex flex-col bg-gray-50/60 min-h-0 transition-all duration-300 ease-in-out`}
                >
                  {/* Search and Filters */}
                  <div className="p-3 border-b border-gray-200 space-y-2 bg-white flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search chats..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-100/70 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                        />
                      </div>
                      <button
                        onClick={() => setChatListCollapsed(true)}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                        title="Collapse conversation list (Full screen chat)"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setChatFilterUnreadOnly(!chatFilterUnreadOnly)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1.5 ${
                          chatFilterUnreadOnly
                            ? "bg-[#25D366] text-black font-bold shadow-xs"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        Unread only ({chatConversations.filter((c) => (c.unread_count || 0) > 0).length})
                      </button>
                      <span className="text-[11px] text-gray-500">
                        {chatConversations.length} conversation{chatConversations.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Conversation List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {chatConversations
                      .filter((conv) => {
                        if (chatFilterUnreadOnly && (conv.unread_count || 0) === 0) return false;
                        if (!searchTerm.trim()) return true;
                        const q = searchTerm.toLowerCase();
                        return (
                          (conv.customer_name && conv.customer_name.toLowerCase().includes(q)) ||
                          conv.customer_phone.includes(q) ||
                          (conv.last_message_text && conv.last_message_text.toLowerCase().includes(q))
                        );
                      })
                      .map((conv) => {
                        const isSelected = selectedChatPhone === conv.customer_phone;
                        const isUnread = (conv.unread_count || 0) > 0;
                        const isVip = (conv.total_orders || 0) >= 5;

                        return (
                          <div
                            key={conv.customer_phone}
                            onClick={() => handleSelectConversation(conv.customer_phone)}
                            className={`p-3.5 cursor-pointer transition flex items-start gap-3 border-l-4 ${
                              isSelected
                                ? "bg-white border-l-[#25D366] shadow-xs"
                                : isUnread
                                ? "bg-emerald-50/40 border-l-emerald-500 hover:bg-emerald-50/80"
                                : "hover:bg-gray-100/70 border-l-transparent"
                            }`}
                          >
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-xs ${
                                  isVip
                                    ? "bg-amber-500 ring-2 ring-amber-300"
                                    : "bg-emerald-600"
                                }`}
                              >
                                {conv.customer_name ? conv.customer_name.charAt(0).toUpperCase() : "C"}
                              </div>
                              {isVip && (
                                <span
                                  title="VIP Customer (5+ orders)"
                                  className="absolute -bottom-0.5 -right-0.5 bg-amber-400 text-black rounded-full p-0.5 border border-white shadow-xs"
                                >
                                  <Star className="w-2.5 h-2.5 fill-current text-amber-900" />
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-xs font-bold text-gray-900 truncate">
                                  {conv.customer_name || conv.customer_phone}
                                </h4>
                                {conv.last_message_time && (
                                  <span className="text-[10px] text-gray-400 whitespace-nowrap ml-1 font-mono">
                                    {new Date(conv.last_message_time).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500 truncate flex-1 pr-2">
                                  {conv.last_sender === "AGENT" && (
                                    <span className="text-emerald-600 font-semibold mr-1">You:</span>
                                  )}
                                  {conv.last_message_text || "No messages yet"}
                                </p>
                                {isUnread && (
                                  <span className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center bg-[#25D366] text-black text-[10px] font-black rounded-full shadow-xs">
                                    {conv.unread_count}
                                  </span>
                                )}
                              </div>

                              {/* City & Orders Tag */}
                              <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-400">
                                <span className="font-mono">{conv.customer_phone}</span>
                                {conv.customer_city && (
                                  <>
                                    <span>•</span>
                                    <span>{conv.customer_city}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {chatConversations.length === 0 && (
                      <div className="p-8 text-center text-gray-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300 opacity-60" />
                        <p className="text-xs font-semibold">No conversations yet</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          When customers reply to WhatsApp campaigns or message your business, their chats will appear here in real-time.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Right Column: Selected Chat Thread & Reply Box ── */}
                {selectedChatPhone ? (
                  <div className="flex-1 flex flex-col bg-[#EFEAE2]/30 min-w-0 overflow-hidden">
                    {/* Active Conversation Header */}
                    {(() => {
                      const activeConv = chatConversations.find(
                        (c) => c.customer_phone === selectedChatPhone
                      );
                      const matchingContact = contacts.find(
                        (c) => c.phone === selectedChatPhone
                      );
                      return (
                        <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between shadow-xs">
                          <div className="flex items-center gap-3">
                            {chatListCollapsed && (
                              <button
                                onClick={() => setChatListCollapsed(false)}
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition mr-1 flex items-center gap-1 text-xs font-semibold"
                                title="Show conversation list"
                              >
                                <ChevronRight className="w-4 h-4" />
                                <span className="hidden sm:inline">Chats</span>
                              </button>
                            )}
                            <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-sm">
                              {activeConv?.customer_name
                                ? activeConv.customer_name.charAt(0).toUpperCase()
                                : "C"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-gray-900">
                                  {activeConv?.customer_name || matchingContact?.name || "Customer"}
                                </h3>
                                {(matchingContact?.total_orders || activeConv?.total_orders || 0) >= 5 && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> VIP
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-mono">{selectedChatPhone}</span>
                                {(matchingContact?.city || activeConv?.customer_city) && (
                                  <>
                                    <span>•</span>
                                    <span>{matchingContact?.city || activeConv?.customer_city}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span>
                                  Orders: {matchingContact?.total_orders ?? activeConv?.total_orders ?? 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <a
                              href={`https://wa.me/${selectedChatPhone.replace("+", "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1.5"
                              title="Open in WhatsApp Web"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              WhatsApp Web
                            </a>
                            <button
                              onClick={() => fetchChatMessages(selectedChatPhone, false)}
                              disabled={chatLoading}
                              className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                              title="Refresh messages"
                            >
                              <RefreshCw className={`w-4 h-4 ${chatLoading ? "animate-spin" : ""}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Messages Scroll Area */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-3 bg-[#E5DDD5]/20 min-w-0">
                      {chatLoading && chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-xs text-gray-400 gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                          Loading chat history...
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                          <MessageSquare className="w-10 h-10 text-gray-300 mb-2" />
                          <p className="text-xs font-semibold text-gray-600">No messages in this chat yet</p>
                          <p className="text-[11px] text-gray-400 max-w-xs mt-1">
                            Type a friendly reply below to start conversing with this customer on WhatsApp.
                          </p>
                        </div>
                      ) : (
                        chatMessages.map((msg, index) => {
                          const isAgent = msg.sender_type === "AGENT";
                          return (
                            <div
                              key={msg.id || index}
                              className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[85%] md:max-w-lg break-words rounded-2xl px-4 py-2.5 shadow-xs text-sm relative ${
                                  isAgent
                                    ? "bg-[#D9FDD3] text-gray-900 rounded-tr-xs border border-emerald-200/60"
                                    : "bg-white text-gray-900 rounded-tl-xs border border-gray-200/80"
                                }`}
                              >
                                {isAgent && msg.message_type === "template" && (
                                  <div className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded inline-block mb-1">
                                    📢 WhatsApp Template Broadcast
                                  </div>
                                )}
                                {!isAgent && (
                                  <div className="text-[10px] font-bold text-emerald-700 mb-0.5">
                                    Customer
                                  </div>
                                )}
                                <p className="whitespace-pre-wrap leading-relaxed text-xs md:text-sm">
                                  {msg.text}
                                </p>
                                <div
                                  className={`flex items-center gap-1.5 justify-end mt-1 text-[10px] ${
                                    isAgent ? "text-emerald-800/70" : "text-gray-400"
                                  }`}
                                >
                                  <span>
                                    {new Date(msg.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                  {isAgent && (
                                    <span>
                                      {msg.status === "SENDING" ? (
                                        <Clock className="w-3 h-3 text-gray-400 animate-spin" />
                                      ) : msg.status === "DELIVERED" || msg.status === "READ" ? (
                                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                                      ) : (
                                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Quick Reply Suggestions */}
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-2 overflow-x-auto flex-shrink-0 min-w-0 max-w-full">
                      <span className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1 flex-shrink-0 pl-1">
                        <Sparkles className="w-3 h-3 text-[#F5A623]" /> Quick replies:
                      </span>
                      {[
                        "નમસ્તે! મનુભાઈ ગાંઠિયાવાળામાં આપનું સ્વાગત છે. હું આપની શું સહાય કરી શકું?",
                        "તમારો ઓર્ડર તૈયાર છે અને ટૂંક સમયમાં ડિલિવર થશે! 🚚",
                        "આજનો સ્પેશિયલ ગરમા ગરમ ગાંઠિયા અને જલેબી નો સ્ટોક ઉપલબ્ધ છે! 😋",
                        "Hello! How can we help you today with your order?",
                        "Special 10% discount code for you: SAVE10"
                      ].map((snippet, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setChatReplyText(snippet)}
                          className="px-3 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-gray-200 rounded-full text-xs whitespace-nowrap text-gray-700 transition shadow-2xs font-medium"
                        >
                          {snippet.length > 35 ? snippet.slice(0, 35) + "..." : snippet}
                        </button>
                      ))}
                    </div>

                    {/* Chat Input Bar */}
                    <form
                      onSubmit={handleSendChatMessage}
                      className="p-3 bg-white border-t border-gray-200 flex items-center gap-2.5 flex-shrink-0 min-w-0 w-full"
                    >
                      <input
                        type="text"
                        placeholder="Type a message to reply on WhatsApp..."
                        value={chatReplyText}
                        onChange={(e) => setChatReplyText(e.target.value)}
                        disabled={chatSending}
                        className="flex-1 min-w-0 px-4 py-2 bg-gray-100/80 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                      />
                      <button
                        type="submit"
                        disabled={!chatReplyText.trim() || chatSending}
                        className="px-5 py-2 bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-sm transition flex items-center gap-2 flex-shrink-0"
                      >
                        {chatSending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Send
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 relative">
                    {chatListCollapsed && (
                      <button
                        onClick={() => setChatListCollapsed(false)}
                        className="absolute top-4 left-4 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
                      >
                        <ChevronRight className="w-4 h-4" />
                        <span>Show Chats</span>
                      </button>
                    )}
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#25D366] flex items-center justify-center mb-4 shadow-xs">
                      <MessageSquare className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Select a Conversation</h3>
                    <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
                      Choose a customer from the conversation list to view their full message history and reply directly via WhatsApp Cloud API.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Add User from Settings Modal ── */}
      {isAddUserModalOpen && (
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
              <button 
                onClick={() => setIsAddUserModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {addUserError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
                {addUserError}
              </div>
            )}

            <form onSubmit={handleCreateUserFromSettings} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Username
                </label>
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
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Email Address
                </label>
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
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Password
                </label>
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

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
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
      )}

      {/* ── Create Rule Modal ── */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
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
                      [...templates]
                        .sort((a, b) => (a.status === "APPROVED" ? -1 : 1))
                        .map((t) => {
                          const isApproved = t.status === "APPROVED";
                          return (
                            <option key={t.id} value={t.template_name}>
                              {isApproved ? "🟢 [APPROVED]" : "🟡 [PENDING]"} {t.template_name} ({t.language})
                            </option>
                          );
                        })
                    ) : (
                      <option value="cart_recovery_v1">cart_recovery_v1</option>
                    )}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-gray-700">Discount Coupon Code</label>
                    {discountCodes.length > 0 && (
                      <span className="text-[10px] text-gray-400">({discountCodes.length} available)</span>
                    )}
                  </div>
                  {discountCodes.length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={
                          discountCodes.some((d) => d.code === newRule.coupon_code)
                            ? newRule.coupon_code
                            : newRule.coupon_code ? "__CUSTOM__" : ""
                        }
                        onChange={(e) => {
                          if (e.target.value === "__CUSTOM__") {
                            setNewRule({ ...newRule, coupon_code: "" });
                          } else {
                            setNewRule({ ...newRule, coupon_code: e.target.value });
                          }
                        }}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                      >
                        <option value="">-- Select Active Coupon --</option>
                        {discountCodes.map((d) => (
                          <option key={d.id} value={d.code}>
                            {d.code} ({d.discount_type === "PERCENT" ? `${d.discount_value}% OFF` : `₹${d.discount_value} OFF`})
                          </option>
                        ))}
                        <option value="__CUSTOM__">✍️ Custom Code (Type below)</option>
                      </select>
                      {(!discountCodes.some((d) => d.code === newRule.coupon_code) || newRule.coupon_code === "") && (
                        <input
                          type="text"
                          placeholder="Type custom coupon (e.g. BAZIK7)"
                          value={newRule.coupon_code}
                          onChange={(e) => setNewRule({ ...newRule, coupon_code: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. VIP15 or BAZIK7"
                      value={newRule.coupon_code}
                      onChange={(e) => setNewRule({ ...newRule, coupon_code: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Deduplication Gate (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newRule.dedup_days}
                    onChange={(e) => setNewRule({ ...newRule, dedup_days: parseInt(e.target.value) || 7 })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Prevents messaging the same customer again</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    End Date / Expiry Deadline <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={newRule.expires_at || ""}
                    onChange={(e) => setNewRule({ ...newRule, expires_at: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Auto-deactivates rule once this date passes</p>
                </div>
              </div>

              {/* Dynamic Meta Template Variable Mapper */}
              {(() => {
                const selectedTmpl = templates.find((t) => t.template_name === newRule.template_name);
                const bodyText = selectedTmpl?.body_text || "";
                const matches = Array.from(new Set(Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g), (m) => parseInt(m[1])))).sort((a, b) => a - b);

                if (matches.length === 0) return null;

                return (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🧩</span>
                        <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                          Manual Variable Mapping ({matches.length} parameter{matches.length !== 1 ? "s" : ""})
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Required by Meta
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      Match each template placeholder (like <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>) to a contact database field, discount coupon, or custom text.
                    </p>

                    <div className="space-y-2.5 pt-1">
                      {matches.map((idx) => {
                        const curMapping = newRule.variable_mappings?.[String(idx)] || {
                          type: idx === 1 ? "contact_field" : idx === 2 ? "coupon" : "static",
                          value: idx === 1 ? "name" : idx === 2 ? "code" : ""
                        };

                        const updateMapping = (newType, newVal) => {
                          setNewRule({
                            ...newRule,
                            variable_mappings: {
                              ...(newRule.variable_mappings || {}),
                              [String(idx)]: { type: newType, value: newVal }
                            }
                          });
                        };

                        return (
                          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-2.5 flex items-center gap-2 text-xs shadow-2xs min-w-0">
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded min-w-[44px] text-center shrink-0">
                              {"{{" + idx + "}}"}
                            </span>

                            {/* Mapping Type Selector */}
                            <select
                              value={curMapping.type || "contact_field"}
                              onChange={(e) => {
                                const t = e.target.value;
                                const defaultVal = t === "contact_field" ? "name" : t === "cart_event" ? "items" : t === "coupon" ? "code" : "";
                                updateMapping(t, defaultVal);
                              }}
                              className="w-36 sm:w-44 shrink-0 px-2 py-1.5 border border-gray-300 rounded-md text-xs font-semibold bg-gray-50 focus:bg-white truncate"
                            >
                              <option value="contact_field">👤 Contact Field</option>
                              <option value="cart_event">🛒 Cart Event</option>
                              <option value="coupon">🏷️ Attached Coupon</option>
                              <option value="static">✍️ Custom Text</option>
                            </select>

                            {/* Value Selector / Input */}
                            <div className="flex-1 min-w-0">
                              {curMapping.type === "contact_field" ? (
                                <select
                                  value={curMapping.value || "name"}
                                  onChange={(e) => updateMapping("contact_field", e.target.value)}
                                  className="w-full min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#25D366] truncate"
                                >
                                  <option value="name">Customer Name</option>
                                  <option value="phone">Phone Number</option>
                                  <option value="city">City</option>
                                  <option value="total_orders">Total Orders Count</option>
                                  <option value="last_order_date">Last Order Date</option>
                                </select>
                              ) : curMapping.type === "cart_event" ? (
                                <select
                                  value={curMapping.value || "items"}
                                  onChange={(e) => updateMapping("cart_event", e.target.value)}
                                  className="w-full min-w-0 px-2.5 py-1.5 border border-amber-300 bg-amber-50/50 rounded-md text-xs font-medium text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500 truncate"
                                >
                                  <option value="items">📦 Cart Items / Snacks</option>
                                  <option value="cart_value">💰 Cart Total Amount</option>
                                </select>
                              ) : curMapping.type === "coupon" ? (
                                <select
                                  value={curMapping.value || "code"}
                                  onChange={(e) => updateMapping("coupon", e.target.value)}
                                  className="w-full min-w-0 px-2.5 py-1.5 border border-[#F5A623] bg-amber-50/60 rounded-md text-xs font-medium text-amber-900 focus:outline-none focus:ring-1 focus:ring-[#F5A623] truncate"
                                >
                                  <option value="code">🏷️ Coupon Code</option>
                                  <option value="discount_value">🎁 Discount Value (%)</option>
                                  <option value="expires_at">⏳ Coupon Expiry Date</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder={`e.g. ${idx === 3 ? "₹50 or 20% off" : idx === 4 ? "30 Sep 2026" : "Value"}`}
                                  value={curMapping.value || ""}
                                  onChange={(e) => updateMapping("static", e.target.value)}
                                  className="w-full min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live Preview of Body Text with Substituted Variables */}
                    {bodyText && (
                      <div className="mt-3 bg-white/80 p-3 rounded-lg border border-gray-200 text-xs">
                        <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Message Preview:</div>
                        <p className="whitespace-pre-wrap text-gray-800 font-sans leading-relaxed">
                          {(() => {
                            let preview = bodyText;
                            matches.forEach((idx) => {
                              const curMapping = newRule.variable_mappings?.[String(idx)] || {
                                type: idx === 1 ? "contact_field" : idx === 2 ? "coupon" : "static",
                                value: idx === 1 ? "name" : idx === 2 ? "code" : ""
                              };
                              let sampleVal = `[Param ${idx}]`;
                              if (curMapping.type === "contact_field") {
                                sampleVal = curMapping.value === "name" ? "Ravi" : curMapping.value === "city" ? "Ahmedabad" : curMapping.value;
                              } else if (curMapping.type === "cart_event") {
                                sampleVal = curMapping.value === "cart_value" ? "450" : "Special Vanela Gathiya & Bhavnagari Gathiya";
                              } else if (curMapping.type === "coupon") {
                                if (curMapping.value === "discount_value") {
                                  sampleVal = discountCodes.find((d) => d.code === newRule.coupon_code)?.discount_value ? `${discountCodes.find((d) => d.code === newRule.coupon_code).discount_value}%` : "7%";
                                } else if (curMapping.value === "expires_at") {
                                  sampleVal = newRule.expires_at || discountCodes.find((d) => d.code === newRule.coupon_code)?.expires_at?.split("T")[0] || "30/09/2026";
                                } else {
                                  sampleVal = newRule.coupon_code || "OFFER";
                                }
                              } else {
                                sampleVal = curMapping.value || `[Custom ${idx}]`;
                              }
                              preview = preview.replaceAll(`{{${idx}}}`, sampleVal);
                            });
                            return preview;
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-gray-700">WhatsApp Approved Template</label>
                  {templates.length > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {templates.filter((t) => t.status === "APPROVED").length} Approved by Meta
                    </span>
                  )}
                </div>
                <select
                  value={newCampaign.template_name}
                  onChange={(e) => {
                    const sel = templates.find((t) => t.template_name === e.target.value);
                    setNewCampaign({
                      ...newCampaign,
                      template_name: e.target.value,
                      language: sel?.language || newCampaign.language || "en"
                    });
                  }}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                >
                  {templates.length > 0 ? (
                    [...templates]
                      .sort((a, b) => (a.status === "APPROVED" ? -1 : 1))
                      .map((t) => {
                        const isApproved = t.status === "APPROVED";
                        return (
                          <option key={t.id} value={t.template_name}>
                            {isApproved ? "🟢 [APPROVED]" : "🟡 [PENDING]"} {t.template_name} ({t.language})
                          </option>
                        );
                      })
                  ) : (
                    <option value="" disabled>No templates synced from Meta</option>
                  )}
                </select>

                {(() => {
                  const currentTmpl = templates.find((t) => t.template_name === newCampaign.template_name);
                  if (!currentTmpl) return null;
                  const isApproved = currentTmpl.status === "APPROVED";
                  return (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-center justify-between border ${
                      isApproved 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isApproved ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}></span>
                        <span className="font-semibold">
                          {isApproved ? "Approved by Meta • Ready for broadcast" : "Pending Meta Review • WhatsApp may reject broadcast"}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-gray-200 font-bold text-gray-700">
                        {currentTmpl.language}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Language Code</label>
                  <input
                    type="text"
                    readOnly
                    value={newCampaign.language}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 font-mono font-semibold focus:outline-none cursor-not-allowed"
                    title="Matched automatically from the selected Meta template."
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Matched from Meta template</p>
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

      {/* ── 🔐 Step-Up Authentication & 2FA Confirmation Modal ── */}
      {securityActionModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Security & 2FA Authorization</h3>
                  <p className="text-[11px] text-gray-500">Step-up verification required for mass actions</p>
                </div>
              </div>
              <button
                onClick={() => setSecurityActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Target Summary Card */}
            <div className="mt-4 p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Operation:</span>
                <span className="font-bold text-gray-900">
                  {securityActionModal.actionType === "CAMPAIGN" ? "WhatsApp Broadcast" : "High-Volume Automation"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Recipients Affected:</span>
                <span className="font-mono font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {securityActionModal.recipientCount} Contacts
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Safety Policy:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Mandatory Password + 2FA
                </span>
              </div>
            </div>

            {/* Error Message */}
            {securityActionModal.error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{securityActionModal.error}</span>
              </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleExecuteSecurityAction} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Account Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your CRM login password"
                  value={securityActionModal.password}
                  onChange={(e) =>
                    setSecurityActionModal((prev) => ({ ...prev, password: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1 flex items-center justify-between">
                  <span>6-Digit 2FA Code</span>
                  <span className="text-[10px] text-gray-400 font-normal">Google Authenticator or Email OTP</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="000000"
                  value={securityActionModal.twoFactorCode}
                  onChange={(e) =>
                    setSecurityActionModal((prev) => ({
                      ...prev,
                      twoFactorCode: e.target.value.replace(/\D/g, "")
                    }))
                  }
                  className="w-full text-center tracking-[8px] font-mono text-xl font-bold px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <p className="text-[11px] text-gray-400 mt-1 text-center">
                  If 2FA is not enabled on your user profile, leave empty or enter recovery code.
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSecurityActionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={securityActionModal.loading || !securityActionModal.password}
                  className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-xs shadow-md transition"
                >
                  {securityActionModal.loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  Authorize & Dispatch
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
                <code className="text-[11px] font-mono text-[#D35400] block">phone, name, email, city, tags, total_orders, last_order_date</code>
                <div className="text-[11px] text-gray-400">Example phone: +919876543210 • Date: YYYY-MM-DD</div>
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

      {/* ── Add / Edit Single Contact Modal ── */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  {editingContactId ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">
                    {editingContactId ? "Edit Customer Contact" : "Add New Customer Contact"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editingContactId ? "Update customer profile, order history, and tags" : "Add a single verified WhatsApp number"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+919876543210"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                  <span className="text-[10px] text-gray-400">Include country code (+91, +1, etc.)</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rutvij Dhameliya"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Surat / Ahmedabad"
                    value={contactForm.city}
                    onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Tags <span className="text-[11px] text-gray-400 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  placeholder="VIP, Wholesale, Fafda Lover, Regular"
                  value={contactForm.tags}
                  onChange={(e) => setContactForm({ ...contactForm, tags: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Total Orders</label>
                  <input
                    type="number"
                    min="0"
                    value={contactForm.total_orders}
                    onChange={(e) => setContactForm({ ...contactForm, total_orders: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Last Order Date</label>
                  <input
                    type="date"
                    value={contactForm.last_order_date}
                    onChange={(e) => setContactForm({ ...contactForm, last_order_date: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactSaving || !contactForm.phone.trim()}
                  className="bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold text-xs shadow-md flex items-center gap-1.5"
                >
                  {contactSaving ? "Saving..." : editingContactId ? "Update Contact" : "Save Contact"}
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
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase text-gray-600">Discount Coupon Code</label>
                      {discountCodes.length > 0 && (
                        <span className="text-[10px] text-gray-400">({discountCodes.length} available)</span>
                      )}
                    </div>
                    {discountCodes.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={
                            discountCodes.some((d) => d.code === selectedRuleForConfig.coupon_code)
                              ? selectedRuleForConfig.coupon_code
                              : selectedRuleForConfig.coupon_code ? "__CUSTOM__" : ""
                          }
                          onChange={(e) => {
                            if (e.target.value === "__CUSTOM__") {
                              setSelectedRuleForConfig({
                                ...selectedRuleForConfig,
                                coupon_code: ""
                              });
                            } else {
                              setSelectedRuleForConfig({
                                ...selectedRuleForConfig,
                                coupon_code: e.target.value
                              });
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                        >
                          <option value="">-- Select Active Coupon --</option>
                          {discountCodes.map((d) => (
                            <option key={d.id} value={d.code}>
                              {d.code} ({d.discount_type === "PERCENT" ? `${d.discount_value}% OFF` : `₹${d.discount_value} OFF`})
                            </option>
                          ))}
                          <option value="__CUSTOM__">✍️ Custom Code (Type below)</option>
                        </select>
                        {(!discountCodes.some((d) => d.code === selectedRuleForConfig.coupon_code) || selectedRuleForConfig.coupon_code === "") && (
                          <input
                            type="text"
                            value={selectedRuleForConfig.coupon_code || ""}
                            onChange={(e) => setSelectedRuleForConfig({
                              ...selectedRuleForConfig,
                              coupon_code: e.target.value.toUpperCase()
                            })}
                            placeholder="Type coupon code (e.g. BAZIK7)"
                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={selectedRuleForConfig.coupon_code || ""}
                        onChange={(e) => setSelectedRuleForConfig({
                          ...selectedRuleForConfig,
                          coupon_code: e.target.value.toUpperCase()
                        })}
                        placeholder="e.g. BAZIK7"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Cooldown / Dedup</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={selectedRuleForConfig.dedup_days}
                        onChange={(e) => setSelectedRuleForConfig({
                          ...selectedRuleForConfig,
                          dedup_days: parseInt(e.target.value) || 1
                        })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                      />
                      <span className="text-[11px] text-gray-500 font-semibold">Days</span>
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
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                    >
                      {templates.length > 0 ? (
                        [...templates]
                          .sort((a, b) => (a.status === "APPROVED" ? -1 : 1))
                          .map((t) => {
                            const isApproved = t.status === "APPROVED";
                            return (
                              <option key={t.id} value={t.template_name}>
                                {isApproved ? "🟢 [APPROVED]" : "🟡 [PENDING]"} {t.template_name} ({t.language})
                              </option>
                            );
                          })
                      ) : (
                        <option value="cart_recovery_v1">cart_recovery_v1</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    ⏳ Expiry Deadline <span className="normal-case font-normal text-gray-400">(automation auto-stops on this date)</span>
                  </label>
                  <input
                    type="date"
                    value={selectedRuleForConfig.expires_at ? selectedRuleForConfig.expires_at.split("T")[0] : ""}
                    onChange={(e) => setSelectedRuleForConfig({
                      ...selectedRuleForConfig,
                      expires_at: e.target.value
                    })}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                {/* Dynamic Meta Template Variable Mapper for Configure Modal */}
                {(() => {
                  const selectedTmpl = templates.find((t) => t.template_name === selectedRuleForConfig.template_name);
                  const bodyText = selectedTmpl?.body_text || "";
                  const matches = Array.from(new Set(Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g), (m) => parseInt(m[1])))).sort((a, b) => a - b);

                  if (matches.length === 0) return null;

                  return (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2.5 mt-3">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🧩</span>
                          <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                            Template Variable Mapping ({matches.length} parameter{matches.length !== 1 ? "s" : ""})
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          Required by Meta
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600">
                        Match each template variable (<code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>, etc.) to a customer field, coupon, or static text.
                      </p>

                      <div className="space-y-2 pt-1">
                        {matches.map((idx) => {
                          const curMapping = selectedRuleForConfig.variable_mappings?.[String(idx)] || {
                            type: idx === 1 ? "contact_field" : idx === 2 ? "coupon" : "static",
                            value: idx === 1 ? "name" : idx === 2 ? "code" : ""
                          };

                          const updateConfigMapping = (newType, newVal) => {
                            setSelectedRuleForConfig({
                              ...selectedRuleForConfig,
                              variable_mappings: {
                                ...(selectedRuleForConfig.variable_mappings || {}),
                                [String(idx)]: { type: newType, value: newVal }
                              }
                            });
                          };

                          return (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-2.5 flex items-center gap-2 text-xs shadow-2xs min-w-0">
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded min-w-[44px] text-center shrink-0">
                                {"{{" + idx + "}}"}
                              </span>

                              {/* Mapping Type Selector */}
                              <select
                                value={curMapping.type || "contact_field"}
                                onChange={(e) => {
                                  const t = e.target.value;
                                  const defaultVal = t === "contact_field" ? "name" : t === "cart_event" ? "items" : t === "coupon" ? "code" : "";
                                  updateConfigMapping(t, defaultVal);
                                }}
                                className="w-36 sm:w-44 shrink-0 px-2 py-1.5 border border-gray-300 rounded-md text-xs font-semibold bg-gray-50 focus:bg-white truncate"
                              >
                                <option value="contact_field">👤 Contact Field</option>
                                <option value="cart_event">🛒 Cart Event</option>
                                <option value="coupon">🏷️ Attached Coupon</option>
                                <option value="static">✍️ Custom Text</option>
                              </select>

                              {/* Value Selector / Input */}
                              <div className="flex-1 min-w-0">
                                {curMapping.type === "contact_field" ? (
                                  <select
                                    value={curMapping.value || "name"}
                                    onChange={(e) => updateConfigMapping("contact_field", e.target.value)}
                                    className="w-full min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#25D366] truncate"
                                  >
                                    <option value="name">Customer Name</option>
                                    <option value="phone">Phone Number</option>
                                    <option value="city">City</option>
                                    <option value="total_orders">Total Orders Count</option>
                                    <option value="last_order_date">Last Order Date</option>
                                  </select>
                                ) : curMapping.type === "cart_event" ? (
                                  <select
                                    value={curMapping.value || "items"}
                                    onChange={(e) => updateConfigMapping("cart_event", e.target.value)}
                                    className="w-full min-w-0 px-2.5 py-1.5 border border-amber-300 bg-amber-50/50 rounded-md text-xs font-medium text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500 truncate"
                                  >
                                    <option value="items">📦 Cart Items / Snacks</option>
                                    <option value="cart_value">💰 Cart Total Amount</option>
                                  </select>
                                ) : curMapping.type === "coupon" ? (
                                  <select
                                    value={curMapping.value || "code"}
                                    onChange={(e) => updateConfigMapping("coupon", e.target.value)}
                                    className="w-full min-w-0 px-2.5 py-1.5 border border-[#F5A623] bg-amber-50/60 rounded-md text-xs font-medium text-amber-900 focus:outline-none focus:ring-1 focus:ring-[#F5A623] truncate"
                                  >
                                    <option value="code">🏷️ Coupon Code</option>
                                    <option value="discount_value">🎁 Discount Value (%)</option>
                                    <option value="expires_at">⏳ Coupon Expiry Date</option>
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    placeholder={`e.g. ${idx === 3 ? "₹50 or 20% off" : idx === 4 ? "30 Sep 2026" : "Value"}`}
                                    value={curMapping.value || ""}
                                    onChange={(e) => updateConfigMapping("static", e.target.value)}
                                    className="w-full min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Live Preview */}
                      {bodyText && (
                        <div className="mt-2 bg-white/90 p-2.5 rounded-lg border border-gray-200 text-xs">
                          <div className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">Message Preview:</div>
                          <p className="whitespace-pre-wrap text-gray-800 font-sans leading-relaxed text-[11px]">
                            {(() => {
                              let preview = bodyText;
                              matches.forEach((idx) => {
                                const curMapping = selectedRuleForConfig.variable_mappings?.[String(idx)] || {
                                  type: idx === 1 ? "contact_field" : idx === 2 ? "coupon" : "static",
                                  value: idx === 1 ? "name" : idx === 2 ? "code" : ""
                                };
                                let sampleVal = `[Param ${idx}]`;
                                if (curMapping.type === "contact_field") {
                                  sampleVal = curMapping.value === "name" ? "Ravi" : curMapping.value === "city" ? "Ahmedabad" : curMapping.value;
                                } else if (curMapping.type === "cart_event") {
                                  sampleVal = curMapping.value === "cart_value" ? "450" : "Special Vanela Gathiya & Bhavnagari Gathiya";
                                } else if (curMapping.type === "coupon") {
                                  if (curMapping.value === "discount_value") {
                                    sampleVal = discountCodes.find((d) => d.code === selectedRuleForConfig.coupon_code)?.discount_value ? `${discountCodes.find((d) => d.code === selectedRuleForConfig.coupon_code).discount_value}%` : "7%";
                                  } else if (curMapping.value === "expires_at") {
                                    sampleVal = selectedRuleForConfig.expires_at ? selectedRuleForConfig.expires_at.split("T")[0] : discountCodes.find((d) => d.code === selectedRuleForConfig.coupon_code)?.expires_at?.split("T")[0] || "30/09/2026";
                                  } else {
                                    sampleVal = selectedRuleForConfig.coupon_code || "OFFER";
                                  }
                                } else {
                                  sampleVal = curMapping.value || `[Custom ${idx}]`;
                                }
                                preview = preview.replaceAll(`{{${idx}}}`, sampleVal);
                              });
                              return preview;
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex justify-end pt-2">
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

      {/* ── 2FA Setup Modal (QR Code & Google Authenticator) ── */}
      {is2faModalOpen && twoFactorSetupData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Set Up Google Authenticator</h3>
                  <p className="text-xs text-gray-500">Scan QR code with your mobile Authenticator app</p>
                </div>
              </div>
              <button onClick={() => setIs2faModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <div className="mt-4 space-y-4 text-center">
              <p className="text-xs text-gray-600 text-left">
                1. Open <strong>Google Authenticator</strong> (or Apple Passwords / Authy) on your phone.
                <br />
                2. Tap <strong>+</strong> and scan the QR code below:
              </p>

              <div className="inline-block p-3 bg-white rounded-xl border border-gray-200 shadow-xs">
                <img
                  src={twoFactorSetupData.qr_code_base64}
                  alt="2FA QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-left">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Can't scan QR code? Manual Entry Key:</span>
                <span className="font-mono font-bold text-xs text-gray-800 select-all break-all">{twoFactorSetupData.secret}</span>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!setupVerifyCode.trim()) return;
                  setSetupVerifyLoading(true);
                  setSetupVerifyError("");
                  try {
                    await axios.post(
                      "/api/auth/2fa/enable",
                      { code: setupVerifyCode.trim() },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setActionSuccessMsg("🛡️ Two-Factor Authentication (2FA) successfully activated!");
                    setIs2faModalOpen(false);
                    fetchData();
                    setTimeout(() => setActionSuccessMsg(""), 5000);
                  } catch (err) {
                    setSetupVerifyError(err.response?.data?.detail || "Invalid code. Please try again.");
                  } finally {
                    setSetupVerifyLoading(false);
                  }
                }}
                className="pt-2 space-y-3"
              >
                <div className="text-left">
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    3. Enter 6-Digit Code from App to Confirm:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={8}
                    placeholder="123456"
                    value={setupVerifyCode}
                    onChange={(e) => setSetupVerifyCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-center tracking-[8px] font-mono text-xl font-bold py-2.5 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                {setupVerifyError && (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {setupVerifyError}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIs2faModalOpen(false)}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={setupVerifyLoading || setupVerifyCode.length < 6}
                    className="flex-1 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {setupVerifyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Confirm & Enable
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Disable 2FA Modal ── */}
      {isDisable2faModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">Disable 2FA</h3>
              <button onClick={() => setIsDisable2faModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <p className="text-xs text-gray-500 mt-3 mb-4">
              Enter your current account password to confirm disabling Two-Factor Authentication.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDisableLoading(true);
                try {
                  await axios.post(
                    "/api/auth/2fa/disable",
                    { password: disablePassword },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  setActionSuccessMsg("Two-Factor Authentication has been turned off.");
                  setIsDisable2faModalOpen(false);
                  fetchData();
                  setTimeout(() => setActionSuccessMsg(""), 5000);
                } catch (err) {
                  alert(err.response?.data?.detail || "Failed to disable 2FA");
                } finally {
                  setDisableLoading(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisable2faModalOpen(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disableLoading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  {disableLoading ? "Disabling..." : "Disable 2FA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

