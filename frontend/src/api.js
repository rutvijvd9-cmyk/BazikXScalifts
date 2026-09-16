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
}

export default api;
