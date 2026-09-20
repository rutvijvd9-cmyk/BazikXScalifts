import axios from "axios";

const isNativePlatform = typeof window !== "undefined" && (
  window.Capacitor?.isNativePlatform?.() ||
  window.location?.protocol === "capacitor:" ||
  (window.location?.protocol === "https:" && window.location?.hostname === "localhost" && !window.location?.port)
);

export const renderProductionUrl = import.meta.env.VITE_API_URL || "https://manubhaigathiya-whatsapp.onrender.com";

export function getApiBaseUrl() {
  return localStorage.getItem("mg_custom_api_url") ||
    import.meta.env.VITE_API_URL ||
    (isNativePlatform ? renderProductionUrl : "");
}

const api = axios.create({ baseURL: getApiBaseUrl() });

export function setApiBaseUrl(url) {
  api.defaults.baseURL = url;
  axios.defaults.baseURL = url;
}

// Automatically attach Bearer token to every outbound request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Also attach to global axios instance for legacy calls
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || "";
      if (!url.includes("/api/auth/token") && !url.includes("/api/auth/login")) {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
