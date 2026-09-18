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
  Key,
  AlertTriangle,
  PlayCircle,
  BookOpen,
  Sliders,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  ShieldAlert,
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
  PhoneCall,
  GitBranch,
  Play,
  BarChart3,
  TrendingUp,
  MousePointerClick,
  ArrowRight
} from "lucide-react";
import axios, { getApiBaseUrl, renderProductionUrl as RENDER_PROD_URL, setApiBaseUrl } from "./api";
import FlowchartCanvas from "./components/FlowchartCanvas";

const INITIAL_API_BASE_URL = getApiBaseUrl();
setApiBaseUrl(INITIAL_API_BASE_URL);

export function formatToIST(dateStr) {
  if (!dateStr) return "-";
  let s = String(dateStr).trim();
  // If no timezone indicator is present, assume UTC as stored by backend
  if (!s.endsWith("Z") && !s.includes("+") && !s.slice(10).includes("-")) {
    s += "Z";
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }) + " IST";
}

export function formatToISTTime(dateStr) {
  if (!dateStr) return "";
  let s = String(dateStr).trim();
  if (!s.endsWith("Z") && !s.includes("+") && !s.slice(10).includes("-")) {
    s += "Z";
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

export function formatToISTDate(dateStr) {
  if (!dateStr) return "-";
  let s = String(dateStr).trim();
  if (!s.endsWith("Z") && !s.includes("+") && !s.slice(10).includes("-")) {
    s += "Z";
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function getTodayISTDateString() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(now); // "YYYY-MM-DD"
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(INITIAL_API_BASE_URL);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverInput, setServerInput] = useState(INITIAL_API_BASE_URL);
  const [serverTestStatus, setServerTestStatus] = useState(null);

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
  const [externalDataSources, setExternalDataSources] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [workflowFlows, setWorkflowFlows] = useState([]);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
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

  // WhatsApp Delivery & Engagement Analytics States
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState("30d");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
    footer_text: "Manubhai Gathiyawala",
    variable_mappings: {}
  });
  // Template Mapping Editor State (for existing templates)
  const [editMappingTemplate, setEditMappingTemplate] = useState(null); // template object being edited
  const [editMappings, setEditMappings] = useState({});                  // working copy of mappings

  // New Journey Flow Modal State
  const [isNewJourneyModalOpen, setIsNewJourneyModalOpen] = useState(false);
  const [newJourneyForm, setNewJourneyForm] = useState({
    name: "",
    trigger_type: "ABANDONED_CART",
    min_cart_value: 0,
    inactive_days: 30,
    weather_condition: "RAINY",
    city: "Ahmedabad",
    welcome_coupon: "WELCOME10",
    product_name: "Nylon Fafda Special"
  });

  const handleOpenNewJourneyModal = () => {
    setNewJourneyForm({
      name: "",
      trigger_type: "ABANDONED_CART",
      min_cart_value: 0,
      inactive_days: 30,
      weather_condition: "RAINY",
      city: "Ahmedabad",
      welcome_coupon: "WELCOME10",
      product_name: "Nylon Fafda Special"
    });
    setIsNewJourneyModalOpen(true);
  };

  const handleConfirmCreateJourney = (e) => {
    e?.preventDefault();
    const triggerLabels = {
      ABANDONED_CART: "Abandoned Cart",
      INACTIVE_WINBACK: "Customer Inactive Winback",
      WEATHER_TRIGGER: "Weather Trigger",
      NEW_CUSTOMER_WELCOME: "New Customer Welcome",
      BACK_IN_STOCK: "Back In Stock Alert",
      FESTIVAL_OFFER: "Festival / Promotional Event",
      ORDER_COMPLETED: "Post-Purchase Order Completed",
      CONTACT_TAGGED: "Customer Tagged / VIP"
    };
    const tType = newJourneyForm.trigger_type || "ABANDONED_CART";
    const tLabel = triggerLabels[tType] || "Trigger";
    const defaultName = newJourneyForm.name.trim() || `${tLabel} Flow`;
    const minCartVal = Number(newJourneyForm.min_cart_value) || 0;
    const inactiveDaysVal = Number(newJourneyForm.inactive_days) || 30;

    let triggerConfig = {};
    let nodeData = { trigger_type: tType };

    if (tType === "ABANDONED_CART") {
      triggerConfig = { min_cart_value: minCartVal };
      nodeData.min_cart_value = minCartVal;
      nodeData.description = minCartVal > 0 ? `Min Cart: ≥ ₹${minCartVal}` : "All Cart Events";
    } else if (tType === "INACTIVE_WINBACK") {
      triggerConfig = { inactive_days: inactiveDaysVal };
      nodeData.inactive_days = inactiveDaysVal;
      nodeData.description = `Inactive ≥ ${inactiveDaysVal} Days`;
    } else if (tType === "WEATHER_TRIGGER") {
      const wCond = newJourneyForm.weather_condition || "RAINY";
      const wCity = newJourneyForm.city || "Ahmedabad";
      triggerConfig = { weather_condition: wCond, city: wCity };
      nodeData.weather_condition = wCond;
      nodeData.city = wCity;
      nodeData.description = `${wCond} in ${wCity}`;
    } else if (tType === "NEW_CUSTOMER_WELCOME") {
      const coupon = (newJourneyForm.welcome_coupon || "WELCOME10").toUpperCase();
      triggerConfig = { welcome_coupon: coupon };
      nodeData.welcome_coupon = coupon;
      nodeData.description = `New Customer • Code: ${coupon}`;
    } else if (tType === "BACK_IN_STOCK") {
      const pName = newJourneyForm.product_name || "Nylon Fafda Special";
      triggerConfig = { product_name: pName };
      nodeData.product_name = pName;
      nodeData.description = `Restocked: ${pName}`;
    } else {
      nodeData.description = "Starting Trigger";
    }

    const newWf = {
      name: defaultName,
      description: `Multi-step automated flowchart journey starting with ${tLabel}`,
      trigger_type: tType,
      trigger_config: triggerConfig,
      is_active: true,
      nodes: [
        {
          id: "node_1",
          type: "trigger",
          label: `${tLabel} Trigger`,
          position: { x: 280, y: 40 },
          data: nodeData
        }
      ],
      edges: [],
      stats: { entered: 0, completed: 0, goals_converted: 0, revenue_recovered: 0 }
    };

    setIsNewJourneyModalOpen(false);
    setEditingWorkflow(newWf);
  };


  // Journey Enrolled Contacts / Sessions Modal State
  const [journeySessionsModal, setJourneySessionsModal] = useState({
    isOpen: false,
    flow: null,
    sessions: [],
    loading: false,
    search: "",
    statusFilter: "ALL"
  });

  const handleOpenJourneySessions = async (flow) => {
    setJourneySessionsModal({
      isOpen: true,
      flow,
      sessions: [],
      loading: true,
      search: "",
      statusFilter: "ALL"
    });
    try {
      const res = await axios.get(`/api/workflows/${flow.id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJourneySessionsModal((prev) => ({
        ...prev,
        sessions: res.data || [],
        loading: false
      }));
    } catch (err) {
      console.error("Failed to fetch journey sessions:", err);
      setJourneySessionsModal((prev) => ({
        ...prev,
        loading: false
      }));
    }
  };

  // Add User from Settings Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: "", email: "", password: "", role: "agent" });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState("");
  const [userRoleUpdatingId, setUserRoleUpdatingId] = useState(null);

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
      setNewUserForm({ username: "", email: "", password: "", role: "agent" });
      fetchData(true);
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      setAddUserError(err.response?.data?.detail || err.message || "Failed to create user");
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleUpdateUserRole = async (targetUser, newRole) => {
    const actionLabel = newRole === "admin" ? "promote" : "demote";
    const titleLabel = newRole === "admin" ? "Admin (Full Access)" : "Team Member";
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${targetUser.username} to ${titleLabel}?`)) {
      return;
    }
    setUserRoleUpdatingId(targetUser.id);
    try {
      await axios.put(`/api/users/${targetUser.id}/role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
      setActionSuccessMsg(`🛡️ ${targetUser.username} has been updated to ${titleLabel}!`);
      fetchData(true);
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to update user role: " + (err.response?.data?.detail || err.message));
      fetchData(true);
    } finally {
      setUserRoleUpdatingId(null);
    }
  };

  // Admin Password Reset Modal State
  const [adminPasswordModal, setAdminPasswordModal] = useState({
    isOpen: false,
    user: null,
    newPassword: "",
    confirmPassword: "",
    loading: false,
    error: ""
  });

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!adminPasswordModal.user) return;
    if (adminPasswordModal.newPassword.length < 6) {
      setAdminPasswordModal((prev) => ({ ...prev, error: "Password must be at least 6 characters long." }));
      return;
    }
    if (adminPasswordModal.newPassword !== adminPasswordModal.confirmPassword) {
      setAdminPasswordModal((prev) => ({ ...prev, error: "Passwords do not match." }));
      return;
    }
    setAdminPasswordModal((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      await axios.put(`/api/users/${adminPasswordModal.user.id}/password`, {
        new_password: adminPasswordModal.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccessMsg(`🔑 Password for ${adminPasswordModal.user.username} updated successfully!`);
      setAdminPasswordModal({ isOpen: false, user: null, newPassword: "", confirmPassword: "", loading: false, error: "" });
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      setAdminPasswordModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.detail || err.message || "Failed to update password"
      }));
    }
  };

  // Admin 2FA Toggle Handler
  const [admin2faUpdatingId, setAdmin2faUpdatingId] = useState(null);
  const handleAdminToggle2FA = async (targetUser, enable) => {
    const action = enable ? "enable" : "disable";
    const msg = enable
      ? `Are you sure you want to enable 2FA requirement for ${targetUser.username}?`
      : `Are you sure you want to disable 2FA for ${targetUser.username}? (This allows them to log in if they lost their Authenticator app).`;
    if (!window.confirm(msg)) return;
    setAdmin2faUpdatingId(targetUser.id);
    try {
      await axios.put(`/api/users/${targetUser.id}/2fa`, { enabled: enable }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_2fa_enabled: enable } : u))
      );
      setActionSuccessMsg(`🛡️ 2FA has been ${action}d for ${targetUser.username}!`);
      fetchData(true);
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert(`Failed to ${action} 2FA: ` + (err.response?.data?.detail || err.message));
      fetchData(true);
    } finally {
      setAdmin2faUpdatingId(null);
    }
  };

  // User Deletion Handler (Admin only; cannot delete other Admins or self)
  const [userDeletingId, setUserDeletingId] = useState(null);
  const [isRoleInfoModalOpen, setIsRoleInfoModalOpen] = useState(false);

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.role === "admin") {
      alert("Admins cannot be deleted. If you wish to delete this account, demote it to a Team Member first.");
      return;
    }
    if (targetUser.username === username) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete user "${targetUser.username}" (${targetUser.email})? This action cannot be undone.`)) {
      return;
    }
    setUserDeletingId(targetUser.id);
    try {
      await axios.delete(`/api/users/${targetUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      setActionSuccessMsg(`🗑️ User "${targetUser.username}" was deleted successfully.`);
      fetchData(true);
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to delete user: " + (err.response?.data?.detail || err.message));
      fetchData(true);
    } finally {
      setUserDeletingId(null);
    }
  };

  const testServerConnection = async (urlToTest) => {
    setServerTestStatus({ loading: true, ok: false, msg: "Testing connection..." });
    const cleanUrl = (urlToTest || "").trim().replace(/\/$/, "");
    try {
      const res = await axios.get(`${cleanUrl}/api/health`, { timeout: 6000 });
      if (res.data?.status === "ok") {
        setServerTestStatus({ loading: false, ok: true, msg: "✅ Connected successfully! Backend is online." });
      } else {
        setServerTestStatus({ loading: false, ok: true, msg: "✅ Connected to server response." });
      }
    } catch (err) {
      setServerTestStatus({
        loading: false,
        ok: false,
        msg: `❌ Cannot connect: ${err.message}. Ensure backend is running and URL is accessible.`
      });
    }
  };

  const handleSaveServerUrl = (newUrl) => {
    const cleanUrl = (newUrl || "").trim().replace(/\/$/, "");
    localStorage.setItem("mg_custom_api_url", cleanUrl);
    axios.defaults.baseURL = cleanUrl;
    setServerUrl(cleanUrl);
    setShowServerModal(false);
    setLoginError("");
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
      if (!err.response) {
        setLoginError(
          `❌ Cannot connect to backend server at "${axios.defaults.baseURL || "relative URL"}". Please tap "Server Settings" below to check your server address, and ensure the backend is running.`
        );
      } else if (err.response.status === 401) {
        setLoginError("❌ Incorrect username or password. Please verify your credentials.");
      } else {
        setLoginError(err.response?.data?.detail || "Login failed. Please try again.");
      }
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
      if (!err.response) {
        setLoginError(`❌ Cannot reach backend server at "${axios.defaults.baseURL}".`);
      } else {
        setLoginError(err.response?.data?.detail || "Invalid 2FA code. Please try again.");
      }
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

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken("");
      setUsername("");
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

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
      if (!err.response) {
        setLoginError(`❌ Cannot reach backend server at "${axios.defaults.baseURL}".`);
      } else {
        setLoginError(err.response?.data?.detail || "Registration failed. Try again.");
      }
    }
  };

  const handleLogout = () => {
    setToken("");
    setUsername("");
    localStorage.removeItem("token");
    localStorage.removeItem("username");
  };

  // Fetch all data
  const fetchData = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [campRes, contRes, cartRes, logsRes, optRes, tmplRes, rulesRes, setRes, usersRes, discRes, meRes, convRes, wfRes, extRes] = await Promise.all([
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
        axios.get("/api/chat/conversations", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/workflows", { headers }).catch(() => ({ data: [] })),
        axios.get("/api/external-data-sources", { headers }).catch(() => ({ data: [] }))
      ]);
      setCampaigns(campRes.data || []);
      setContacts(contRes.data || []);
      setCartEvents(cartRes.data || []);
      setMessageLogs(logsRes.data || []);
      setOptOuts(optRes.data || []);
      setTemplates(tmplRes.data || []);
      setAutomationRules(rulesRes.data || []);
      setWorkflowFlows(wfRes.data || []);
      setSystemSettings(setRes.data || {});
      setSystemUsers(usersRes.data || []);
      setDiscountCodes(discRes.data || []);
      setChatConversations(convRes.data || []);
      setExternalDataSources(extRes.data || []);
      if (meRes?.data) setCurrentUserProfile(meRes.data);
      fetchAnalytics(analyticsTimeRange, true);
    } catch (err) {
      console.error("Failed to fetch protected data:", err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAnalytics = async (range = analyticsTimeRange, silent = false) => {
    if (!token) return;
    if (!silent) setAnalyticsLoading(true);
    try {
      const res = await axios.get(`/api/analytics/overview?time_range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalyticsData(res.data);
    } catch (err) {
      if (!silent) console.error("Failed to fetch analytics overview:", err);
    } finally {
      if (!silent) setAnalyticsLoading(false);
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
    // Optimistically remove contact from UI immediately
    setContacts((prev) => prev.filter((contact) => contact.id !== c.id));
    setActionSuccessMsg(`🗑️ Contact ${c.phone} deleted successfully!`);
    try {
      await axios.delete(`/api/contacts/${c.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData(true); // silent sync with backend in background
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to delete contact: " + (err.response?.data?.detail || err.message));
      fetchData(true); // rollback/re-sync if backend request failed
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
        footer_text: "Manubhai Gathiyawala",
        variable_mappings: {}
      });
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 6000);
    } catch (err) {
      alert("Failed to submit template: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleSaveTemplateMappings = async () => {
    if (!editMappingTemplate) return;
    try {
      await axios.patch(`/api/templates/${editMappingTemplate.id}/mappings`,
        { variable_mappings: editMappings },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionSuccessMsg(`Column mappings saved for '${editMappingTemplate.template_name}'!`);
      setEditMappingTemplate(null);
      setEditMappings({});
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      alert("Failed to save mappings: " + (err.response?.data?.detail || err.message));
    }
  };


  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Fetch analytics whenever user switches to Analytics tab or alters range
  useEffect(() => {
    if (token && activeTab === "analytics") {
      fetchAnalytics(analyticsTimeRange);
    }
  }, [token, activeTab, analyticsTimeRange]);

  // Periodic polling for Live Two-Way Chat (only active when tab is visible and on chat tab or conversations)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (document.hidden) return; // Pause polling when user is on another window or tab
      if (activeTab === "chat") {
        fetchChatConversations(true);
        if (selectedChatPhone) {
          fetchChatMessages(selectedChatPhone, true);
        }
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [token, selectedChatPhone, activeTab]);

  // Periodic automatic silent background refresh for Automations, Cart Recovery, and Logs
  useEffect(() => {
    if (!token) return;
    // Auto-refresh every 12 seconds when user is on automations, cart_recovery, logs, or dashboard
    const interval = setInterval(() => {
      if (document.hidden) return; // Pause background polling if user switched away
      if (["automations", "cart_recovery", "logs", "dashboard"].includes(activeTab)) {
        fetchData(true);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [token, activeTab]);

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

  // ── Multi-Step Visual Workflow Handlers ──────────────────────────────
  const handleSaveWorkflow = async (updatedFlow) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let res;
      if (updatedFlow.id) {
        res = await axios.put(`/api/workflows/${updatedFlow.id}`, updatedFlow, { headers });
      } else {
        res = await axios.post("/api/workflows", updatedFlow, { headers });
      }
      setActionSuccessMsg(`Workflow "${res.data.name}" saved successfully!`);
      setEditingWorkflow(null);
      fetchData();
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      console.error("Failed to save workflow:", err);
      alert("Failed to save workflow: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleWorkflow = async (flow) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`/api/workflows/${flow.id}/toggle`, {}, { headers });
      setWorkflowFlows((prev) =>
        prev.map((f) => (f.id === flow.id ? res.data : f))
      );
      setActionSuccessMsg(`Workflow "${res.data.name}" is now ${res.data.is_active ? "Active" : "Paused"}`);
      setTimeout(() => setActionSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Failed to toggle workflow:", err);
    }
  };

  const handleDeleteWorkflow = async (flowId) => {
    if (!window.confirm("Are you sure you want to delete this visual journey flow?")) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`/api/workflows/${flowId}`, { headers });
      setWorkflowFlows((prev) => prev.filter((f) => f.id !== flowId));
      setActionSuccessMsg("Workflow deleted successfully.");
      setTimeout(() => setActionSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Failed to delete workflow:", err);
    }
  };

  const handleSimulateWorkflow = async (flowId, payload) => {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await axios.post(`/api/workflows/${flowId}/simulate`, payload, { headers });
    return res.data;
  };

  const handleCleanSlate = async () => {
    if (!window.confirm("Purge all sample workflows and rules? This will give you a 100% clean slate.")) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post("/api/automations/clean-slate", {}, { headers });
      setWorkflowFlows([]);
      setAutomationRules([]);
      setActionSuccessMsg("All sample workflows and automations purged. Clean slate active!");
      setTimeout(() => setActionSuccessMsg(""), 5000);
    } catch (err) {
      console.error("Clean slate failed:", err);
      // Fallback: delete each flow manually
      try {
        const headers = { Authorization: `Bearer ${token}` };
        for (const flow of workflowFlows) {
          await axios.delete(`/api/workflows/${flow.id}`, { headers });
        }
        for (const rule of automationRules) {
          await axios.delete(`/api/automation-rules/${rule.id}`, { headers });
        }
        setWorkflowFlows([]);
        setAutomationRules([]);
        setActionSuccessMsg("Sample automations deleted. Clean slate active!");
        setTimeout(() => setActionSuccessMsg(""), 5000);
      } catch (_e) {
        console.error("Fallback delete failed:", _e);
      }
    }
  };

  const handleCreateNewWorkflow = () => {
    handleOpenNewJourneyModal();
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
            <button
              type="button"
              onClick={() => {
                setServerInput(serverUrl);
                setServerTestStatus(null);
                setShowServerModal(true);
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors border border-emerald-200 cursor-pointer shadow-xs"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Server: <span className="font-mono font-semibold">{serverUrl || "Local Relative"}</span></span>
              <Settings className="w-3 h-3 text-emerald-500 ml-0.5" />
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
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-center">
                  <p className="text-xs text-amber-800">
                    Lost access to your Authenticator device?
                  </p>
                  <p className="text-[11px] text-amber-900 font-semibold mt-0.5">
                    Contact your System Admin to disable 2FA for your account so you can log in.
                  </p>
                </div>

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

              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  Forgot password or lost 2FA?{" "}
                  <span className="text-gray-700 font-semibold">Contact your Administrator</span> to reset credentials.
                </p>
              </div>
            </form>
          )}

          <div className="mt-5 pt-3 border-t border-gray-100 text-center">
            <span className="text-[11px] text-gray-400 font-medium">Protected by End-to-End Bcrypt & JWT Security • Admin-Managed Access</span>
          </div>

        </div>

        {/* ── Server URL Settings Modal ── */}
        {showServerModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 text-left">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Configure Backend Server</h3>
                    <p className="text-[11px] text-gray-500">Set API URL for Android or Remote Access</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowServerModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Server API URL</label>
                  <input
                    type="text"
                    value={serverInput}
                    onChange={(e) => setServerInput(e.target.value)}
                    placeholder="https://your-api-domain.com or http://localhost:8000"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Quick Presets:</p>
                  <div className="space-y-1.5">
                    {RENDER_PROD_URL && (
                      <button
                        type="button"
                        onClick={() => setServerInput(RENDER_PROD_URL)}
                        className="w-full px-2.5 py-1.5 text-[11px] font-mono rounded bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-left transition cursor-pointer font-semibold flex items-center justify-between"
                      >
                        <span>☁️ Production Cloud API</span>
                        <span className="text-[10px] bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-900">Default</span>
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setServerInput(`http://${window.location?.hostname || "localhost"}:8000`)}
                        className="px-2.5 py-1.5 text-[11px] font-mono rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition cursor-pointer"
                      >
                        📡 Local Machine<br /><span className="text-[10px] text-gray-500">{window.location?.hostname || "localhost"}:8000</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setServerInput("http://10.0.2.2:8000")}
                        className="px-2.5 py-1.5 text-[11px] font-mono rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition cursor-pointer"
                      >
                        📱 Android Emulator<br /><span className="text-[10px] text-gray-500">10.0.2.2:8000</span>
                      </button>
                    </div>
                  </div>
                </div>

                {serverTestStatus && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium ${
                      serverTestStatus.ok
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {serverTestStatus.msg}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => testServerConnection(serverInput)}
                  disabled={serverTestStatus?.loading}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                >
                  {serverTestStatus?.loading ? "Testing..." : "Test Connection"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveServerUrl(serverInput)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </div>
        )}
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
              { id: "automations", label: "Automations", icon: Sliders, badge: workflowFlows.length },
              { id: "campaigns", label: "Campaigns", icon: Megaphone },
              { id: "analytics", label: "Analytics", icon: BarChart3 },
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
                : activeTab === "analytics"
                ? "Delivery & Engagement Analytics"
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
                onClick={handleOpenNewJourneyModal}
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Journey Flow</span>
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

              {/* Active Journey Automations Quick Glance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Active Journey Automations</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Multi-step flowchart workflows and triggers</p>
                  </div>
                  <button
                    onClick={() => handleTabChange("automations")}
                    className="text-xs font-bold text-[#25D366] hover:underline"
                  >
                    View All Journeys ({workflowFlows.length}) →
                  </button>
                </div>
                {workflowFlows.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {workflowFlows.map((flow) => (
                      <div key={flow.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between hover:border-gray-300 transition">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className={`w-2 h-2 rounded-full ${flow.is_active ? "bg-emerald-500" : "bg-gray-400"}`}></span>
                            <span className="text-[10px] font-bold font-mono text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                              {(flow.nodes || []).length} steps
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-gray-900 mt-2 truncate" title={flow.name}>{flow.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">Trigger: <span className="font-semibold text-gray-700">{flow.trigger_type}</span></p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                          <span className={`font-semibold ${flow.is_active ? "text-emerald-600" : "text-gray-400"}`}>
                            {flow.is_active ? "Active" : "Paused"}
                          </span>
                          <button
                            onClick={() => {
                              handleTabChange("automations");
                              setEditingWorkflow(flow);
                            }}
                            className="font-bold text-[#25D366] hover:text-[#1EBE5D] flex items-center gap-1"
                          >
                            <Sliders className="w-3.5 h-3.5" /> Open Flow
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">No visual journey automations created yet.</p>
                    <button
                      onClick={() => {
                        handleTabChange("automations");
                        handleOpenNewJourneyModal();
                      }}
                      className="text-xs font-bold text-[#25D366] hover:underline"
                    >
                      + Create First Journey Flow
                    </button>
                  </div>
                )}
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
            editingWorkflow ? (
              <FlowchartCanvas
                workflow={editingWorkflow}
                onSave={handleSaveWorkflow}
                onClose={() => setEditingWorkflow(null)}
                onSimulate={handleSimulateWorkflow}
                availableTemplates={templates}
                availableCoupons={discountCodes}
              />
            ) : (
            <div className="space-y-6">
              {/* ── Automations Header Bar ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#25D366] flex items-center justify-center">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Visual Journey Automations</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Multi-step flowchart workflows with delays, smart condition branching, and revenue goals
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {workflowFlows.length > 0 && (
                    <button
                      onClick={handleCleanSlate}
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      title="Clear sample data for a fresh clean slate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge Sample Data</span>
                    </button>
                  )}

                  <button
                    onClick={handleOpenNewJourneyModal}
                    className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Journey Flow</span>
                  </button>
                </div>
              </div>
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
                                workflowFlows.length > 0
                                  ? 301 - (301 * (workflowFlows.filter((r) => r.is_active).length / Math.max(1, workflowFlows.length)))
                                  : 301
                              }
                              strokeLinecap="round"
                              fill="transparent"
                              className="transition-all duration-700"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-gray-900 leading-none">
                              {workflowFlows.filter((r) => r.is_active).length}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                              of {workflowFlows.length} Active
                            </span>
                          </div>
                        </div>

                        {/* Clean Executive Readouts */}
                        <div className="space-y-2.5 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#25D366]"></span>
                              Active Journeys
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                              {workflowFlows.filter((r) => r.is_active).length} / {workflowFlows.length}
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
                                const todayIST = getTodayISTDateString();
                                const msgDate = m.created_at ? formatToISTDate(m.created_at) : "";
                                // Check if log was created today in IST
                                let s = String(m.created_at || "").trim();
                                if (!s.endsWith("Z") && !s.includes("+") && !s.slice(10).includes("-")) s += "Z";
                                const logISTStr = new Intl.DateTimeFormat("en-CA", {
                                  timeZone: "Asia/Kolkata",
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit"
                                }).format(new Date(s));
                                return logISTStr === todayIST;
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
                            onClick={handleCreateNewWorkflow}
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
                      <h3 className="text-base font-bold text-gray-900">E-Commerce Customer Journeys</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Multi-step visual flowchart automations with delays, condition branching, and goals</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={handleOpenNewJourneyModal}
                        className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create Journey Flow</span>
                      </button>
                    </div>
                  </div>

                  {/* Grid of Multi-Step Flow Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {workflowFlows.map((flow) => {
                      const nodes = flow.nodes || [];
                      const stepCount = nodes.length;

                      return (
                        <div
                          key={flow.id}
                          className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between space-y-5 relative overflow-hidden"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  ⚡ {flow.trigger_type}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">
                                  {stepCount} Steps
                                </span>
                              </div>

                              <button
                                onClick={() => handleToggleWorkflow(flow)}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition flex-shrink-0 ${
                                  flow.is_active
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-gray-100 text-gray-400 border border-gray-200"
                                }`}
                              >
                                {flow.is_active ? (
                                  <ToggleRight className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                                )}
                                {flow.is_active ? "Live & Active" : "Paused"}
                              </button>
                            </div>

                            <div>
                              <h3 className="text-base font-bold text-gray-900">
                                {flow.name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {flow.description || "Multi-stage automated customer journey"}
                              </p>
                            </div>

                            {/* Visual Mini-Pipeline Preview */}
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Journey Pathway Sequence:
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                {nodes.slice(0, 5).map((n, i) => (
                                  <React.Fragment key={n.id || i}>
                                    <span
                                      className={`px-2 py-0.5 rounded-md font-semibold border text-[10px] ${
                                        n.type === "trigger"
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : n.type === "delay"
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : n.type === "whatsapp_message"
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : n.type === "condition"
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : "bg-gray-100 text-gray-700 border-gray-200"
                                      }`}
                                    >
                                      {n.label}
                                    </span>
                                    {i < Math.min(nodes.length - 1, 4) && (
                                      <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                                    )}
                                  </React.Fragment>
                                ))}
                                {nodes.length > 5 && (
                                  <span className="text-[10px] text-gray-400 font-semibold">
                                    +{nodes.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Metrics Summary Strip */}
                            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-gray-100 text-xs">
                              <button
                                type="button"
                                onClick={() => handleOpenJourneySessions(flow)}
                                className="text-left p-1.5 -m-1.5 rounded-lg hover:bg-emerald-50/70 transition group cursor-pointer border border-transparent hover:border-emerald-200"
                                title="Click to view all contacts enrolled in this journey"
                              >
                                <span className="text-[10px] text-gray-400 block font-medium group-hover:text-emerald-700 flex items-center gap-0.5">
                                  Enrolled <Eye className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition" />
                                </span>
                                <span className="font-bold text-gray-900 group-hover:text-[#25D366] font-mono underline decoration-dotted underline-offset-2">
                                  {flow.stats?.entered || 0}
                                </span>
                              </button>
                              <div>
                                <span className="text-[10px] text-gray-400 block font-medium">Completed</span>
                                <span className="font-bold text-gray-900 font-mono">{flow.stats?.completed || 0}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 block font-medium">Goals Met</span>
                                <span className="font-bold text-emerald-700 font-mono">{flow.stats?.goals_converted || 0}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-gray-400 block font-medium">Recovered</span>
                                <span className="font-bold text-[#D35400] font-mono">
                                  ₹{(flow.stats?.revenue_recovered || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                            <button
                              onClick={() => handleDeleteWorkflow(flow.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete Flow"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenJourneySessions(flow)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                                title="Inspect contacts that traversed this automation"
                              >
                                <Users className="w-3.5 h-3.5" />
                                Contacts ({flow.stats?.entered || 0})
                              </button>
                              <button
                                onClick={() => setEditingWorkflow(flow)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition shadow-xs"
                              >
                                <Play className="w-3.5 h-3.5 fill-blue-600" />
                                Simulate
                              </button>
                              <button
                                onClick={() => setEditingWorkflow(flow)}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-bold transition shadow-xs"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                Open Flowchart Builder
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {workflowFlows.length === 0 && (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#25D366] flex items-center justify-center mx-auto mb-4">
                        <GitBranch className="w-7 h-7" />
                      </div>
                      <h4 className="text-base font-bold text-gray-900">
                        No Multi-Step Journey Flows Yet
                      </h4>
                      <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-5 leading-relaxed">
                        Create your first visual flowchart automation to guide customers from cart abandonment or festival campaigns through multi-stage follow-ups.
                      </p>
                      <button
                        onClick={handleOpenNewJourneyModal}
                        className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs inline-flex items-center gap-2 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create First Journey Flow</span>
                      </button>
                    </div>
                  )}
                </div>
              )
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
                                      onClick={() => {
                                        setDisablePassword("");
                                        setIsDisable2faModalOpen(true);
                                      }}
                                      className="text-xs text-red-600 hover:text-red-800 font-semibold hover:underline cursor-pointer ml-1"
                                    >
                                      Disable My 2FA
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
                        <div key={t.id}
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
                              {t.variable_mappings && Object.keys(t.variable_mappings).length > 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ Mapped
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  ⚠ No Mapping
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 mt-2.5 font-mono">{t.template_name}</h4>
                            <p className="text-xs font-semibold text-[#D35400] mt-0.5">{t.header_text}</p>
                            <p className="text-xs text-gray-700 mt-3 bg-white p-3 rounded-lg border border-gray-200 leading-relaxed font-sans">
                              {t.body_text}
                            </p>
                            {/* Mapping Pills */}
                            {t.variable_mappings && Object.keys(t.variable_mappings).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {Object.entries(t.variable_mappings).map(([idx, m]) => {
                                  const isApi = m.type === "external_api";
                                  const isEvent = m.type === "event_field";
                                  const pillStyle = isApi
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isEvent
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200";

                                  const displayVal = m.type === "contact_field"
                                    ? m.value
                                    : m.type === "static"
                                    ? `"${m.value}"`
                                    : isEvent
                                    ? `event.${m.value}`
                                    : isApi
                                    ? `api.${m.value}`
                                    : `${m.type}.${m.value}`;

                                  return (
                                    <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${pillStyle}`}>
                                      <span className="font-mono font-bold">{`{{${idx}}}`}</span>
                                      <span className="opacity-60">→</span>
                                      <span>{displayVal}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400">
                            <span>Category: {t.category}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-500">{t.footer_text}</span>
                              <button
                                onClick={() => {
                                  setEditMappingTemplate(t);
                                  setEditMappings(t.variable_mappings || {});
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-1 transition"
                                title="Configure column mappings for this template"
                              >
                                🗂 Columns
                              </button>
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
          {/* TAB: ANALYTICS & CONVERSION FUNNEL VIEW */}
          {/* ========================================================= */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Top Header & Range Filters */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">WhatsApp Delivery & Engagement Analytics</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Real-time delivery rates, open/read receipts, button clicks, customer replies, and recovered revenue
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 self-stretch md:self-auto justify-between md:justify-end">
                  {[
                    { id: "today", label: "Today" },
                    { id: "7d", label: "Last 7 Days" },
                    { id: "30d", label: "Last 30 Days" },
                    { id: "all", label: "All Time" }
                  ].map((range) => (
                    <button
                      key={range.id}
                      onClick={() => {
                        setAnalyticsTimeRange(range.id);
                        fetchAnalytics(range.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        analyticsTimeRange === range.id
                          ? "bg-white text-gray-900 shadow-xs border border-gray-200"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                  <button
                    onClick={async () => {
                      await handleSyncMetaTemplates();
                      fetchAnalytics(analyticsTimeRange);
                    }}
                    disabled={loading || analyticsLoading}
                    title="Sync templates and read metrics from Meta WhatsApp Manager"
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    Sync from Meta
                  </button>
                  <button
                    onClick={() => fetchAnalytics(analyticsTimeRange)}
                    disabled={analyticsLoading}
                    title="Refresh analytics"
                    className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? "animate-spin text-[#F5A623]" : ""}`} />
                  </button>
                </div>
              </div>

              {/* 6 Key Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* 1. Delivery Rate */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Delivery Rate</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-gray-900">
                      {analyticsData?.rates?.delivery_rate ?? 0}%
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">{analyticsData?.funnel?.total_delivered ?? 0}</span> / {analyticsData?.funnel?.total_sent ?? 0} sent
                    </p>
                  </div>
                </div>

                {/* 2. Read / Open Rate */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Read / Open Rate</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-gray-900">
                      {analyticsData?.rates?.read_rate ?? 0}%
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">{analyticsData?.funnel?.total_read ?? 0}</span> read receipts
                    </p>
                  </div>
                </div>

                {/* 3. Click-Through Rate (CTR) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Button CTR</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-gray-900">
                      {analyticsData?.rates?.click_rate ?? 0}%
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">{analyticsData?.funnel?.total_clicks ?? 0}</span> button clicks
                    </p>
                  </div>
                </div>

                {/* 4. Customer Reply Rate */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reply Rate</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-gray-900">
                      {analyticsData?.rates?.reply_rate ?? 0}%
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">{analyticsData?.funnel?.total_replied ?? 0}</span> customer replies
                    </p>
                  </div>
                </div>

                {/* 5. Revenue Recovered */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Recovered Rev</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-gray-900">
                      ₹{Number(analyticsData?.funnel?.revenue_recovered || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">{analyticsData?.funnel?.recovered_carts ?? 0}</span> carts converted
                    </p>
                  </div>
                </div>

                {/* 6. Meta Quality Rating */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Meta Quality</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
                      <span className="text-xl font-black text-gray-900">
                        {analyticsData?.meta_health?.quality_rating || "HIGH"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Opt-out: <span className="font-semibold text-gray-700">{analyticsData?.rates?.opt_out_rate ?? 0}%</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Conversion Funnel Bar */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">WhatsApp Broadcast & Recovery Conversion Funnel</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Full customer journey from WhatsApp dispatch to checkout purchase</p>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    Live Pipeline
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {/* Stage 1: Sent */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">1. Dispatched</span>
                      </div>
                      <p className="text-2xl font-black text-gray-900 mt-2">{analyticsData?.funnel?.total_sent ?? 0}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200/60 text-[11px] text-gray-500">
                      100% of pipeline
                    </div>
                  </div>

                  {/* Stage 2: Delivered */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">2. Delivered</span>
                      </div>
                      <p className="text-2xl font-black text-gray-900 mt-2">{analyticsData?.funnel?.total_delivered ?? 0}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200/60 text-[11px] font-semibold text-gray-700">
                      {analyticsData?.rates?.delivery_rate ?? 0}% delivery rate
                    </div>
                  </div>

                  {/* Stage 3: Read */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">3. Opened / Read</span>
                      </div>
                      <p className="text-2xl font-black text-gray-900 mt-2">{analyticsData?.funnel?.total_read ?? 0}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200/60 text-[11px] font-semibold text-gray-700">
                      {analyticsData?.rates?.read_rate ?? 0}% read rate
                    </div>
                  </div>

                  {/* Stage 4: Engaged (Clicks + Replies) */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">4. Engaged / Clicks</span>
                      </div>
                      <p className="text-2xl font-black text-gray-900 mt-2">
                        {(analyticsData?.funnel?.total_clicks ?? 0) + (analyticsData?.funnel?.total_replied ?? 0)}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200/60 text-[11px] font-semibold text-gray-700">
                      {analyticsData?.funnel?.total_clicks ?? 0} clicks · {analyticsData?.funnel?.total_replied ?? 0} replies
                    </div>
                  </div>

                  {/* Stage 5: Converted */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">5. Converted</span>
                      </div>
                      <p className="text-2xl font-black text-gray-900 mt-2">
                        ₹{Number(analyticsData?.funnel?.revenue_recovered || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200/60 text-[11px] font-semibold text-gray-700">
                      {analyticsData?.funnel?.recovered_carts ?? 0} carts converted
                    </div>
                  </div>
                </div>
              </div>

              {/* Two Column Grid: Template Performance + Daily Trends & Meta Health */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Template Performance Leaderboard */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">Template Performance Leaderboard</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Delivery and open rates broken down by WhatsApp template</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
                      {(analyticsData?.template_performance || []).length} Templates
                    </span>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3">Template Name</th>
                          <th className="px-6 py-3 text-right">Sent</th>
                          <th className="px-6 py-3 text-right">Delivered</th>
                          <th className="px-6 py-3 text-right">Read</th>
                          <th className="px-6 py-3 text-center">Read Rate</th>
                          <th className="px-6 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(!analyticsData?.template_performance || analyticsData.template_performance.length === 0) ? (
                          <tr>
                            <td colSpan="6" className="px-6 py-8 text-center text-gray-400 text-xs">
                              No template messages logged during this time period yet.
                            </td>
                          </tr>
                        ) : (
                          analyticsData.template_performance.map((tmpl) => {
                            const isHigh = tmpl.read_rate >= 60;
                            const isMed = tmpl.read_rate >= 30 && tmpl.read_rate < 60;
                            return (
                              <tr key={tmpl.template_name} className="hover:bg-gray-50/80 transition">
                                <td className="px-6 py-4 font-mono font-medium text-xs text-gray-900">
                                  {tmpl.template_name}
                                </td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-800">
                                  {tmpl.sent}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-600 font-semibold">
                                  {tmpl.delivered}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">
                                  {tmpl.read}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      isHigh
                                        ? "bg-green-50 text-[#10B981] border border-green-200"
                                        : isMed
                                        ? "bg-amber-50 text-[#F5A623] border border-amber-200"
                                        : "bg-gray-100 text-gray-600 border border-gray-200"
                                    }`}
                                  >
                                    {tmpl.read_rate}%
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {tmpl.failed > 0 ? (
                                    <span className="text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                      {tmpl.failed} failed
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      Optimal
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right 1 Col: Daily Trends & Meta Health */}
                <div className="space-y-6">
                  {/* Daily Trends Chart/Bars */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 text-sm">Daily Message Trends</h3>
                      <span className="text-[11px] text-gray-500">Sent vs Read</span>
                    </div>

                    <div className="space-y-3">
                      {(!analyticsData?.daily_trends || analyticsData.daily_trends.length === 0) ? (
                        <p className="text-xs text-gray-400 text-center py-4">No activity logged in this period</p>
                      ) : (
                        analyticsData.daily_trends.map((day) => {
                          const maxVol = Math.max(1, ...analyticsData.daily_trends.map((d) => d.sent));
                          const sentWidth = Math.min(100, Math.round((day.sent / maxVol) * 100));
                          return (
                            <div key={day.date} className="text-xs">
                              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                                <span className="font-semibold text-gray-700">{day.date}</span>
                                <span className="text-gray-400">
                                  {day.sent} sent · <span className="text-emerald-600 font-semibold">{day.read} read</span>
                                  {day.replied > 0 && <span className="text-purple-600 font-semibold"> · {day.replied} replied</span>}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.max(day.sent > 0 ? 8 : 0, sentWidth)}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Meta Health & Daily Limits Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 text-sm">Meta Business Health</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#10B981] border border-emerald-200">
                        {analyticsData?.meta_health?.phone_status || "ONLINE"}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-gray-500 font-medium">Daily Outbound Capacity</span>
                          <span className="font-bold text-gray-900">
                            {analyticsData?.meta_health?.used_today ?? 0} / {analyticsData?.meta_health?.daily_limit ?? 1000} sent
                          </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#25D366] rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  ((analyticsData?.meta_health?.used_today ?? 0) /
                                    (analyticsData?.meta_health?.daily_limit ?? 1000)) *
                                    100
                                )
                              )}%`
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quality Rating:</span>
                          <span className="font-bold text-emerald-600">
                            {analyticsData?.meta_health?.quality_rating || "HIGH"} (Green)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Messaging Tier:</span>
                          <span className="font-semibold text-gray-800">
                            {analyticsData?.meta_health?.tier_name || "Tier 1 (1,000 / 24h)"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Opt-Out Safeguard:</span>
                          <span className="font-semibold text-gray-800">Automatic STOP Registry</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                                          {formatToISTDate(c.last_order_date)}
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
                        <td className="px-6 py-4 text-xs font-mono text-gray-500">
                          {formatToIST(log.created_at)}
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
                        <td className="px-6 py-4 text-xs font-mono text-gray-500">
                          {formatToIST(opt.created_at)}
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
                                    {formatToISTTime(conv.last_message_time)}
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
                                    {formatToISTTime(msg.created_at)}
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

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Access Level (Role)
                </label>
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

      {/* ── Journey Enrolled Contacts & Execution Sessions Modal ── */}
      {journeySessionsModal.isOpen && (
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
                      {journeySessionsModal.flow?.name || "Automation Journey"} — Enrolled Contacts
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      ⚡ {journeySessionsModal.flow?.trigger_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Real-time list of customers who entered this automation journey, their current node, and action history
                  </p>
                </div>
              </div>
              <button
                onClick={() => setJourneySessionsModal((prev) => ({ ...prev, isOpen: false }))}
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
                  value={journeySessionsModal.search}
                  onChange={(e) => setJourneySessionsModal((prev) => ({ ...prev, search: e.target.value }))}
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
                      onClick={() => setJourneySessionsModal((prev) => ({ ...prev, statusFilter: st }))}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        journeySessionsModal.statusFilter === st
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
              {journeySessionsModal.loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#25D366]" />
                  <span>Loading enrolled contacts and pathway sessions...</span>
                </div>
              ) : (() => {
                const term = (journeySessionsModal.search || "").toLowerCase().trim();
                const filtered = journeySessionsModal.sessions.filter((s) => {
                  if (journeySessionsModal.statusFilter !== "ALL" && s.status !== journeySessionsModal.statusFilter) {
                    return false;
                  }
                  if (!term) return true;
                  const phone = (s.customer_phone || "").toLowerCase();
                  const name = (s.state_data?.customer_name || "").toLowerCase();
                  const token = (s.state_data?.cart_token || "").toLowerCase();
                  const status = (s.status || "").toLowerCase();
                  return phone.includes(term) || name.includes(term) || token.includes(term) || status.includes(term);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center text-gray-400 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">No Enrolled Contacts Found</p>
                      <p className="text-xs text-gray-400 max-w-sm mx-auto">
                        {journeySessionsModal.sessions.length === 0
                          ? "No contacts have triggered or traversed this automation journey yet. You can use 'Simulate Flow' to test it immediately."
                          : "No sessions matched your search filters."}
                      </p>
                    </div>
                  );
                }

                return (
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
                                {lastStep?.details && (
                                  <div className="text-[10px] text-gray-400 truncate max-w-[180px]" title={lastStep.details}>
                                    {lastStep.details}
                                  </div>
                                )}
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
                                <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-mono font-bold" title={`${hist.length} execution milestones passed`}>
                                  {hist.length} step{hist.length === 1 ? "" : "s"} passed
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0 text-xs text-gray-500">
              <span>
                Total Sessions Enrolled: <strong className="text-gray-900 font-mono">{journeySessionsModal.sessions.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setJourneySessionsModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create New Journey Flow Modal ── */}
      {isNewJourneyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#25D366] flex items-center justify-center font-bold">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 leading-tight">Create Journey Flow</h3>
                  <p className="text-xs text-gray-500">Pick a starting trigger to begin building your visual automation flow</p>
                </div>
              </div>
              <button onClick={() => setIsNewJourneyModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleConfirmCreateJourney} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Journey Flow Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30-Min Cart Recovery Sequence, Festive Diwali Offer"
                  value={newJourneyForm.name}
                  onChange={(e) => setNewJourneyForm({ ...newJourneyForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-2">Select Starting Trigger Event</label>
                <div className="space-y-2">
                  {[
                    {
                      id: "ABANDONED_CART",
                      title: "Abandoned Cart",
                      desc: "Triggers when an abandoned cart webhook event is received from your e-commerce store.",
                      icon: ShoppingCart,
                      color: "text-amber-600 bg-amber-50 border-amber-200"
                    },
                    {
                      id: "INACTIVE_WINBACK",
                      title: "Customer Inactive Winback",
                      desc: "Target past customers who have had no order activity for a custom number of days.",
                      icon: Clock,
                      color: "text-blue-600 bg-blue-50 border-blue-200"
                    },
                    {
                      id: "WEATHER_TRIGGER",
                      title: "Weather Trigger (Rain/Winter Snack)",
                      desc: "Send weather-targeted snack cravings (e.g. Rainy day hot Gathiya in Ahmedabad).",
                      icon: CloudRain,
                      color: "text-sky-600 bg-sky-50 border-sky-200"
                    },
                    {
                      id: "NEW_CUSTOMER_WELCOME",
                      title: "New Customer Welcome",
                      desc: "Engage first-time visitors or new account creations with a welcome greeting & coupon.",
                      icon: UserPlus,
                      color: "text-emerald-600 bg-emerald-50 border-emerald-200"
                    },
                    {
                      id: "BACK_IN_STOCK",
                      title: "Back In Stock Alert",
                      desc: "Alert hungry customers the instant a bestselling snack item is restocked.",
                      icon: Package,
                      color: "text-purple-600 bg-purple-50 border-purple-200"
                    },
                    {
                      id: "ORDER_COMPLETED",
                      title: "Post-Purchase / Order Completed",
                      desc: "Triggers right after an order is placed/delivered for feedback or cross-sell snacks.",
                      icon: Package,
                      color: "text-indigo-600 bg-indigo-50 border-indigo-200"
                    },
                    {
                      id: "FESTIVAL_OFFER",
                      title: "Festival & Promotional Event",
                      desc: "Triggers an outbound promotional campaign or seasonal festive blast.",
                      icon: Sparkles,
                      color: "text-pink-600 bg-pink-50 border-pink-200"
                    },
                    {
                      id: "CONTACT_TAGGED",
                      title: "Contact Tagged / VIP Milestone",
                      desc: "Triggers when a customer receives a specific tag or joins VIP segment.",
                      icon: Tag,
                      color: "text-teal-600 bg-teal-50 border-teal-200"
                    }
                  ].map((trig) => {
                    const isSelected = (newJourneyForm.trigger_type || "ABANDONED_CART") === trig.id;
                    const IconComp = trig.icon;
                    return (
                      <div
                        key={trig.id}
                        onClick={() => setNewJourneyForm({ ...newJourneyForm, trigger_type: trig.id })}
                        className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center gap-3.5 ${
                          isSelected
                            ? "border-[#25D366] bg-emerald-50/40 ring-2 ring-[#25D366]/20 shadow-xs"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/70"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${trig.color}`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-bold text-gray-900">{trig.title}</div>
                            {isSelected && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{trig.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1. Abandoned Cart Options */}
              {newJourneyForm.trigger_type === "ABANDONED_CART" && (
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-amber-900">
                      Minimum Cart Amount Filter (₹)
                    </label>
                    <span className="text-[11px] text-amber-700 font-semibold">
                      {Number(newJourneyForm.min_cart_value) > 0
                        ? `Only carts ≥ ₹${newJourneyForm.min_cart_value}`
                        : "All abandoned carts (₹0+)"}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-amber-700 font-bold text-sm pointer-events-none select-none">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={newJourneyForm.min_cart_value !== undefined ? newJourneyForm.min_cart_value : 0}
                      onChange={(e) =>
                        setNewJourneyForm({
                          ...newJourneyForm,
                          min_cart_value: e.target.value === "" ? 0 : Number(e.target.value)
                        })
                      }
                      placeholder="0 (Trigger for all abandoned carts)"
                      className="w-full pl-9 pr-3 py-2 border border-amber-300 rounded-lg text-sm bg-white font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {[0, 299, 499, 999, 1499].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNewJourneyForm({ ...newJourneyForm, min_cart_value: val })}
                        className={`px-2 py-1 rounded-md border text-[10px] font-bold transition ${
                          (Number(newJourneyForm.min_cart_value) || 0) === val
                            ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-amber-100"
                        }`}
                      >
                        {val === 0 ? "All (₹0)" : `≥ ₹${val}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Customer Inactive Winback Options */}
              {newJourneyForm.trigger_type === "INACTIVE_WINBACK" && (
                <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-blue-950">
                      Inactivity Threshold (Days without Order)
                    </label>
                    <span className="text-[11px] text-blue-700 font-semibold font-mono">
                      Target: ≥ {newJourneyForm.inactive_days || 30} days inactive
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="1"
                      value={newJourneyForm.inactive_days !== undefined ? newJourneyForm.inactive_days : 30}
                      onChange={(e) =>
                        setNewJourneyForm({
                          ...newJourneyForm,
                          inactive_days: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value))
                        })
                      }
                      placeholder="e.g. 30, 45, 60, 90"
                      className="w-full px-3.5 py-2 border border-blue-300 rounded-lg text-sm bg-white font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3.5 text-xs text-gray-400 font-semibold pointer-events-none select-none">Days</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Customers who haven't placed an order in at least {newJourneyForm.inactive_days || 30} days will be enrolled in this flow.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[30, 45, 60, 90, 120].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setNewJourneyForm({ ...newJourneyForm, inactive_days: days })}
                        className={`px-2.5 py-1 rounded-md border text-xs font-bold transition ${
                          (Number(newJourneyForm.inactive_days) || 30) === days
                            ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-blue-100"
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Weather Trigger Options */}
              {newJourneyForm.trigger_type === "WEATHER_TRIGGER" && (
                <div className="bg-sky-50/60 border border-sky-200/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-sky-950">
                      Weather Condition & City
                    </label>
                    <span className="text-[11px] text-sky-700 font-semibold">Ahmedabad & Gujarat</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Condition</label>
                      <select
                        value={newJourneyForm.weather_condition || "RAINY"}
                        onChange={(e) => setNewJourneyForm({ ...newJourneyForm, weather_condition: e.target.value })}
                        className="w-full px-3 py-2 border border-sky-300 rounded-lg text-xs font-semibold bg-white text-gray-800"
                      >
                        <option value="RAINY">🌧️ Rainy / Monsoon</option>
                        <option value="CLOUDY">⛅ Cloudy & Overcast</option>
                        <option value="CHILLY_WINTER">❄️ Chilly Winter Morning</option>
                        <option value="HOT_SUMMER">☀️ Hot Afternoon</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Target City</label>
                      <input
                        type="text"
                        value={newJourneyForm.city || "Ahmedabad"}
                        onChange={(e) => setNewJourneyForm({ ...newJourneyForm, city: e.target.value })}
                        placeholder="e.g. Ahmedabad"
                        className="w-full px-3 py-2 border border-sky-300 rounded-lg text-xs font-semibold bg-white text-gray-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. New Customer Welcome Options */}
              {newJourneyForm.trigger_type === "NEW_CUSTOMER_WELCOME" && (
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 space-y-2">
                  <label className="block text-xs font-bold uppercase text-emerald-950">
                    Welcome Gift Coupon Code
                  </label>
                  <input
                    type="text"
                    value={newJourneyForm.welcome_coupon || "WELCOME10"}
                    onChange={(e) => setNewJourneyForm({ ...newJourneyForm, welcome_coupon: e.target.value.toUpperCase() })}
                    placeholder="e.g. WELCOME10"
                    className="w-full px-3.5 py-2 border border-emerald-300 rounded-lg text-xs font-mono font-bold bg-white text-gray-900 uppercase"
                  />
                  <p className="text-[11px] text-emerald-700">
                    Will be included in the automated welcome message to encourage their first order.
                  </p>
                </div>
              )}

              {/* 5. Back In Stock Alert Options */}
              {newJourneyForm.trigger_type === "BACK_IN_STOCK" && (
                <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3.5 space-y-2">
                  <label className="block text-xs font-bold uppercase text-purple-950">
                    Restocked Snack Product Name
                  </label>
                  <input
                    type="text"
                    value={newJourneyForm.product_name || "Nylon Fafda Special"}
                    onChange={(e) => setNewJourneyForm({ ...newJourneyForm, product_name: e.target.value })}
                    placeholder="e.g. Nylon Fafda Special, Vanela Gathiya"
                    className="w-full px-3.5 py-2 border border-purple-300 rounded-lg text-xs font-semibold bg-white text-gray-900"
                  />
                  <p className="text-[11px] text-purple-700">
                    Sends automated notifications to customers who viewed or wishlisted this item.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewJourneyModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-md flex items-center gap-2"
                >
                  <span>Open Flow Builder</span>
                  <ArrowRight className="w-4 h-4" />
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


              {/* ── Auto-Detected Column Mapping ── */}
              {(() => {
                const FIELD_OPTIONS = [
                  { group: "Contact Field (CRM)", options: [
                    { value: "contact_field|name", label: "Customer Name" },
                    { value: "contact_field|phone", label: "Customer Phone" },
                    { value: "contact_field|city", label: "City" },
                    { value: "contact_field|total_orders", label: "Total Orders" },
                    { value: "contact_field|last_order_date", label: "Last Order Date" }
                  ]},
                  { group: "Store Webhook Payload (Event Push)", options: [
                    { value: "event_field|first_name", label: "First Name (e.g. Ramesh)" },
                    { value: "event_field|products_summary", label: "Products Summary (e.g. Vanela Gathiya)" },
                    { value: "event_field|amount", label: "Cart Amount (e.g. ₹450)" },
                    { value: "event_field|delivery_address", label: "Delivery Address" },
                    { value: "cart_event|cart_url", label: "Cart Recovery URL" },
                    { value: "event_field|custom", label: "Custom Webhook Field..." }
                  ]},
                  { group: "External Live API (On-Demand Pull)", options: [
                    { value: "external_api|delivery_address", label: "Delivery / Shipping Address" },
                    { value: "external_api|tracking_number", label: "Tracking Number / AWB" },
                    { value: "external_api|order_status", label: "Live Order Status" },
                    { value: "external_api|estimated_delivery", label: "Estimated Delivery Date" },
                    { value: "external_api|support_contact", label: "Support Contact / Helpline" },
                    { value: "external_api|custom", label: "Custom API JSON Key..." }
                  ]},
                  { group: "Coupon (CRM)", options: [
                    { value: "coupon|code", label: "Coupon Code" },
                    { value: "coupon|discount_value", label: "Discount Value (%/₹)" },
                    { value: "coupon|expires_at", label: "Coupon Expiry Date" }
                  ]},
                  { group: "Static Text", options: [
                    { value: "static|", label: "Custom static text..." }
                  ]}
                ];
                const params = [...new Set([...(newTemplate.body_text || "").matchAll(/\{\{([a-zA-Z0-9_-]+)\}\}/g)].map(m => m[1]))];
                if (params.length === 0) return null;
                return (
                  <div className="border border-blue-200 bg-blue-50 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-blue-800">📌 Column Mapping</span>
                      <span className="text-[10px] text-blue-600 ml-1">Configure once → auto-used everywhere</span>
                    </div>
                    {params.map(param => {
                      const cm = (newTemplate.variable_mappings || {})[param] || {};
                      const isCustomEvent = cm.type === "event_field" && !["first_name", "products_summary", "amount", "delivery_address"].includes(cm.value);
                      const isCustomApi = cm.type === "external_api" && !["delivery_address", "tracking_number", "order_status", "estimated_delivery", "support_contact"].includes(cm.value);

                      const cv = cm.type ? (
                        isCustomEvent ? "event_field|custom" :
                        isCustomApi ? "external_api|custom" :
                        (cm.type + "|" + (cm.value || ""))
                      ) : "";

                      return (
                        <div key={param} className="space-y-1.5 p-2.5 rounded-lg bg-white border border-blue-200">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded border border-blue-200 text-xs w-14 text-center">{"{{"}{param}{"}}"}</span>
                            <span className="text-blue-500 font-bold">→</span>
                            <select value={cv}
                              onChange={e => {
                                const [type, ...rest] = e.target.value.split("|");
                                const valPart = rest.join("|");
                                const finalVal = valPart === "custom" ? (cm.value || "") : valPart;
                                setNewTemplate(prev => ({ ...prev, variable_mappings: { ...(prev.variable_mappings || {}), [param]: { type, value: finalVal } } }));
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                            >
                              <option value="">— choose field —</option>
                              {FIELD_OPTIONS.map(g => (
                                <optgroup key={g.group} label={g.group}>
                                  {g.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          {cm.type === "static" && (
                            <div className="pl-16">
                              <input type="text" placeholder="Enter fixed text" value={cm.value || ""}
                                onChange={e => setNewTemplate(prev => ({ ...prev, variable_mappings: { ...(prev.variable_mappings || {}), [param]: { type: "static", value: e.target.value } } }))}
                                className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-xs"
                              />
                            </div>
                          )}

                          {cm.type === "event_field" && isCustomEvent && (
                            <div className="pl-16 flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 font-semibold">Key:</span>
                              <input type="text" placeholder="e.g. shipping_address" value={cm.value || ""}
                                onChange={e => setNewTemplate(prev => ({ ...prev, variable_mappings: { ...(prev.variable_mappings || {}), [param]: { type: "event_field", value: e.target.value } } }))}
                                className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg text-xs font-mono"
                              />
                            </div>
                          )}

                          {cm.type === "external_api" && isCustomApi && (
                            <div className="pl-16 flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 font-semibold">Key:</span>
                              <input type="text" placeholder="e.g. tracking_code" value={cm.value || ""}
                                onChange={e => setNewTemplate(prev => ({ ...prev, variable_mappings: { ...(prev.variable_mappings || {}), [param]: { type: "external_api", value: e.target.value } } }))}
                                className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-mono"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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


      {/* ── Configure Column Mappings Modal (Existing Templates) ── */}
      {editMappingTemplate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-gray-900">Configure Column Mappings</h3>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{editMappingTemplate.template_name}</p>
              </div>
              <button onClick={() => { setEditMappingTemplate(null); setEditMappings({}); }} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                📌 Map each <span className="font-mono font-bold">{"{{N}}"}</span> placeholder to a contact/cart/coupon field. This config will automatically apply to all automations and campaigns using this template — no per-flow setup needed.
              </p>

              {/* Template body preview */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs text-gray-700 leading-relaxed font-sans">
                {editMappingTemplate.body_text}
              </div>

              {(() => {
                const FIELD_OPTIONS = [
                  { group: "Contact Field (CRM)", options: [
                    { value: "contact_field|name", label: "Customer Name" },
                    { value: "contact_field|phone", label: "Customer Phone" },
                    { value: "contact_field|city", label: "City" },
                    { value: "contact_field|total_orders", label: "Total Orders" },
                    { value: "contact_field|last_order_date", label: "Last Order Date" }
                  ]},
                  { group: "Store Webhook Payload (Event Push)", options: [
                    { value: "event_field|first_name", label: "First Name (e.g. Ramesh)" },
                    { value: "event_field|products_summary", label: "Products Summary (e.g. Vanela Gathiya)" },
                    { value: "event_field|amount", label: "Cart Amount (e.g. ₹450)" },
                    { value: "event_field|delivery_address", label: "Delivery Address" },
                    { value: "cart_event|cart_url", label: "Cart Recovery URL" },
                    { value: "event_field|custom", label: "Custom Webhook Field..." }
                  ]},
                  { group: "External Live API (On-Demand Pull)", options: [
                    { value: "external_api|delivery_address", label: "Delivery / Shipping Address" },
                    { value: "external_api|tracking_number", label: "Tracking Number / AWB" },
                    { value: "external_api|order_status", label: "Live Order Status" },
                    { value: "external_api|estimated_delivery", label: "Estimated Delivery Date" },
                    { value: "external_api|support_contact", label: "Support Contact / Helpline" },
                    { value: "external_api|custom", label: "Custom API JSON Key..." }
                  ]},
                  { group: "Coupon (CRM)", options: [
                    { value: "coupon|code", label: "Coupon Code" },
                    { value: "coupon|discount_value", label: "Discount Value (%/₹)" },
                    { value: "coupon|expires_at", label: "Coupon Expiry Date" }
                  ]},
                  { group: "Static Text", options: [
                    { value: "static|", label: "Custom static text..." }
                  ]}
                ];
                const params = [...new Set([...(editMappingTemplate.body_text || "").matchAll(/\{\{([a-zA-Z0-9_-]+)\}\}/g)].map(m => m[1]))];
                if (params.length === 0) return (
                  <p className="text-xs text-center text-gray-400 py-4">No placeholders found in this template body text.</p>
                );
                return (
                  <div className="space-y-3">
                    {params.map(param => {
                      const cm = (editMappings || {})[param] || {};
                      const isCustomEvent = cm.type === "event_field" && !["first_name", "products_summary", "amount", "delivery_address"].includes(cm.value);
                      const isCustomApi = cm.type === "external_api" && !["delivery_address", "tracking_number", "order_status", "estimated_delivery", "support_contact"].includes(cm.value);
                      
                      const cv = cm.type ? (
                        isCustomEvent ? "event_field|custom" :
                        isCustomApi ? "external_api|custom" :
                        (cm.type + "|" + (cm.value || ""))
                      ) : "";

                      return (
                        <div key={param} className="space-y-1.5 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded border border-blue-200 text-xs w-16 text-center">{"{{"}{param}{"}}"}</span>
                            <span className="text-blue-400 font-bold">→</span>
                            <select value={cv}
                              onChange={e => {
                                const [type, ...rest] = e.target.value.split("|");
                                const valPart = rest.join("|");
                                const finalVal = valPart === "custom" ? (cm.value || "") : valPart;
                                setEditMappings(prev => ({ ...prev, [param]: { type, value: finalVal } }));
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                            >
                              <option value="">— choose field —</option>
                              {FIELD_OPTIONS.map(g => (
                                <optgroup key={g.group} label={g.group}>
                                  {g.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          {/* Secondary input for custom keys or static text */}
                          {cm.type === "static" && (
                            <div className="flex items-center gap-2 pl-20">
                              <input type="text" placeholder="Enter fixed text (e.g. Ahmedabad)" value={cm.value || ""}
                                onChange={e => setEditMappings(prev => ({ ...prev, [param]: { type: "static", value: e.target.value } }))}
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                              />
                            </div>
                          )}

                          {cm.type === "event_field" && isCustomEvent && (
                            <div className="flex items-center gap-2 pl-20">
                              <span className="text-[10px] text-gray-500 font-semibold">JSON Key:</span>
                              <input type="text" placeholder="e.g. shipping_address or customer_pincode" value={cm.value || ""}
                                onChange={e => setEditMappings(prev => ({ ...prev, [param]: { type: "event_field", value: e.target.value } }))}
                                className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                              />
                            </div>
                          )}

                          {cm.type === "external_api" && isCustomApi && (
                            <div className="flex items-center gap-2 pl-20">
                              <span className="text-[10px] text-gray-500 font-semibold">API JSON Key:</span>
                              <input type="text" placeholder="e.g. invoice_url or package_weight" value={cm.value || ""}
                                onChange={e => setEditMappings(prev => ({ ...prev, [param]: { type: "external_api", value: e.target.value } }))}
                                className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setEditMappingTemplate(null); setEditMappings({}); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplateMappings}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-md"
                >
                  Save Mappings
                </button>
              </div>
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

      {/* ── Admin Password Reset Modal ── */}
      {adminPasswordModal.isOpen && (
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
                onClick={() => setAdminPasswordModal({ isOpen: false, user: null, newPassword: "", confirmPassword: "", loading: false, error: "" })}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 mt-3 mb-4 bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg">
              Set a new secure password for account: <strong className="text-indigo-900 font-mono">{adminPasswordModal.user?.username}</strong>.
            </p>

            {adminPasswordModal.error && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                {adminPasswordModal.error}
              </div>
            )}

            <form onSubmit={handleAdminResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={adminPasswordModal.showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={adminPasswordModal.newPassword}
                    onChange={(e) => setAdminPasswordModal((prev) => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAdminPasswordModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  >
                    {adminPasswordModal.showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={adminPasswordModal.showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Repeat new password"
                    value={adminPasswordModal.confirmPassword}
                    onChange={(e) => setAdminPasswordModal((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminPasswordModal({ isOpen: false, user: null, newPassword: "", confirmPassword: "", loading: false, error: "" })}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminPasswordModal.loading}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {adminPasswordModal.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Role Permissions Guide Modal ── */}
      {isRoleInfoModalOpen && (
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
              <button
                onClick={() => setIsRoleInfoModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
              >
                ✕
              </button>
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
                  <li className="text-blue-800 italic">Restricted: Cannot delete users, modify platform spend limits, or view server secrets.</li>
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
                  <li>Does not require human interactive logins.</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRoleInfoModalOpen(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
