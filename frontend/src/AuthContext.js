import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from './services/apiService';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          // Set token for future API calls
          apiService.setAuthToken(token);
          // Fetch user profile
          const userProfile = await apiService.get('/ho-so-nhan-vien/me');
          setUser(userProfile.data);
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          // Token is invalid, clear it
          localStorage.removeItem('authToken');
          apiService.setAuthToken(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (userData) => {
    localStorage.setItem('authToken', userData.token);
    apiService.setAuthToken(userData.token);
    setUser(userData.user);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    apiService.setAuthToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
  );
};