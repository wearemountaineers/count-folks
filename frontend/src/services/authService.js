import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'count_folks_token';
const USER_KEY = 'count_folks_user';

export const authService = {
  async login(username, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password,
      });
      
      if (response.data.access_token) {
        localStorage.setItem(TOKEN_KEY, response.data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        return response.data;
      }
      throw new Error('No token received');
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid username or password');
      }
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

