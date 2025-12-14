import axios from 'axios';
import { authService } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Create axios instance with auth interceptor
const apiClient = axios.create();

apiClient.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      authService.logout();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const countsService = {
  async getCounts(streamId, from, to, aggregation = null) {
    const params = new URLSearchParams();
    if (streamId) params.append('streamId', streamId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (aggregation) params.append('aggregation', aggregation);

    const response = await apiClient.get(`${API_URL}/counts?${params.toString()}`);
    return response.data;
  },

  async getBusyness(streamId, from, to, bucketSize = '5min') {
    const params = new URLSearchParams();
    if (streamId) params.append('streamId', streamId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (bucketSize) params.append('bucketSize', bucketSize);

    const response = await apiClient.get(`${API_URL}/counts/busyness?${params.toString()}`);
    return response.data;
  },

  async getBusynessWithComparison(streamId, from, to, bucketSize = '5min', compareDays = 7) {
    const params = new URLSearchParams();
    if (streamId) params.append('streamId', streamId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (bucketSize) params.append('bucketSize', bucketSize);
    if (compareDays) params.append('compareDays', compareDays);

    const response = await apiClient.get(`${API_URL}/counts/busyness/compare?${params.toString()}`);
    return response.data;
  },

  async createCount(countData) {
    const response = await apiClient.post(`${API_URL}/counts`, countData);
    return response.data;
  },
};