import { ethers } from 'ethers';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class AuthService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.user = null;
  }

  // Check if MetaMask is installed
  isMetaMaskInstalled() {
    return typeof window.ethereum !== 'undefined';
  }

  // Initialize Web3 provider
  async initializeProvider() {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
      // Check if user is logged in to MetaMask
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        // User is not logged in, request login
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      return { provider: this.provider, signer: this.signer };
    } catch (error) {
      console.error('Error initializing provider:', error);
      if (error.code === 4001) {
        throw new Error('Bạn đã từ chối yêu cầu đăng nhập MetaMask. Vui lòng đăng nhập để tiếp tục.');
      }
      throw new Error('Không thể kết nối với MetaMask. Vui lòng thử lại.');
    }
  }

  // Get current wallet address
  async getWalletAddress() {
    if (!this.signer) {
      await this.initializeProvider();
    }

    try {
      const address = await this.signer.getAddress();
      return address;
    } catch (error) {
      console.error('Error getting wallet address:', error);
      throw error;
    }
  }

  // Sign a message for additional security
  async signMessage(message) {
    if (!this.signer) {
      await this.initializeProvider();
    }

    try {
      const signature = await this.signer.signMessage(message);
      return signature;
    } catch (error) {
      console.error('Error signing message:', error);
      if (error.code === 4001) {
        throw new Error('User rejected the signature request.');
      }
      throw new Error('Failed to sign message. Please try again.');
    }
  }

  // Step 1: Connect wallet and get challenge from backend
  async connectWallet() {
    try {
      const walletAddress = await this.getWalletAddress();

      // Request challenge from backend
      const challengeResponse = await axios.post(`${API_BASE_URL}/auth/challenge`, {
        walletAddress: walletAddress.toLowerCase()
      });

      if (!challengeResponse.data.success) {
        throw new Error(challengeResponse.data.message || 'Failed to get challenge');
      }

      return {
        walletAddress,
        challengeId: challengeResponse.data.challengeId,
        challenge: challengeResponse.data.challenge
      };
    } catch (error) {
      console.error('Connect wallet error:', error);
      throw error;
    }
  }

  // Step 2: Sign challenge and verify with backend
  async signAndVerify(challengeId, challenge, consentTransactionHash = null) {
    try {
      // Sign the challenge message
      const signature = await this.signMessage(challenge);

      // Verify signature with backend
      const verifyResponse = await axios.post(`${API_BASE_URL}/auth/verify`, {
        challengeId,
        signature,
        consentTransactionHash
      });

      if (!verifyResponse.data.success) {
        throw new Error(verifyResponse.data.message || 'Authentication failed');
      }

      // Store authentication data
      this.user = verifyResponse.data.user;
      localStorage.setItem('user', JSON.stringify(verifyResponse.data.user));
      localStorage.setItem('token', verifyResponse.data.token);

      return verifyResponse.data;
    } catch (error) {
      console.error('Sign and verify error:', error);
      throw error;
    }
  }

  // Complete authentication flow (connect + sign + verify)
  async authenticate(consentTransactionHash = null) {
    try {
      // Step 1: Connect wallet and get challenge
      const { walletAddress, challengeId, challenge } = await this.connectWallet();

      // Step 2: Sign challenge and verify
      const authResult = await this.signAndVerify(challengeId, challenge, consentTransactionHash);

      return {
        ...authResult,
        walletAddress
      };
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      const token = this.getToken();
      if (token) {
        // Call backend logout endpoint
        await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Backend logout error:', error);
      // Continue with local logout even if backend call fails
    }

    // Clear local data
    this.user = null;
    this.provider = null;
    this.signer = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  // Check if user is authenticated
  isAuthenticated() {
    try {
      const user = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      return !!(user && token);
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  // Get current user
  getCurrentUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  // Get auth token
  getToken() {
    return localStorage.getItem('token');
  }

  // Enhanced logout - clear all auth data and optionally disconnect wallet
  logout() {
    // Clear local storage
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken'); // Clear any additional tokens

    // Reset service state
    this.user = null;
    this.provider = null;
    this.signer = null;

    // Note: MetaMask doesn't have a disconnect method, but we can clear our state
    // User will need to manually disconnect from MetaMask if desired
  }

  // Get user profile from backend
  async getProfile() {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        // Update local user data
        this.user = response.data.user;
        localStorage.setItem('user', JSON.stringify(response.data.user));
        return response.data.user;
      } else {
        throw new Error(response.data.message || 'Failed to get profile');
      }
    } catch (error) {
      console.error('Get profile error:', error);
      if (error.response?.status === 401) {
        // Token expired, logout
        this.logout();
        throw new Error('Session expired. Please login again.');
      }
      throw error;
    }
  }

  // Listen for account changes
  onAccountChange(callback) {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          this.logout();
          callback(null);
        } else {
          // User switched accounts
          callback(accounts[0]);
        }
      });
    }
  }

  // Listen for chain changes
  onChainChange(callback) {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        callback(chainId);
      });
    }
  }
}

export default new AuthService();
