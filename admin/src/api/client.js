/**
 * Axios API client configured for the Dark Pattern Detector backend.
 */

import axios from "axios";

const API_KEY = import.meta.env.VITE_ADMIN_API_KEY || "dev-secret-change-me";

const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  },
});

// Response interceptor for consistent error handling
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.message || "Unknown error";
    return Promise.reject(new Error(message));
  }
);

export const api = {
  /** Fetch paginated product list */
  getProducts: (page = 1, pageSize = 20) =>
    client.get(`/products?page=${page}&page_size=${pageSize}`),

  /** Fetch scan history for a domain */
  getProductScans: (domain, page = 1) =>
    client.get(`/products/${encodeURIComponent(domain)}?page=${page}`),

  /** Fetch community reports by status */
  getCommunityReports: (status = "pending", page = 1) =>
    client.get(`/community/reports?status=${status}&page=${page}`),

  /** Approve a community report */
  approveReport: (id) => client.patch(`/community/report/${id}/approve`),

  /** Reject a community report */
  rejectReport: (id) => client.patch(`/community/report/${id}/reject`),

  /** Fetch model performance metrics */
  getMetrics: () => client.get("/metrics"),

  /** Get health status */
  health: () => client.get("/health"),
};

export default client;
