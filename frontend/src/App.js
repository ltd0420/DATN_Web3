import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import authService from './services/authService';
import LoginPage from './components/LoginPage';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';

// Define role IDs (3 roles: Super Admin, Manager, Employee)
const EMPLOYEE_ROLE = '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7c';
const MANAGER_ROLE = '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b';
const SUPER_ADMIN_ROLE = '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a';

// Protected Route component
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  
  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  return isAuthenticated ? children : <Navigate to="/" replace />;
}

// Role-based Route component
function RoleBasedRoute({ children, allowedRoles }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  
  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
    setCurrentUser(authService.getCurrentUser());
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!currentUser || !allowedRoles.includes(currentUser.role_id)) {
    // Redirect to appropriate dashboard based on user role
    if (currentUser && (currentUser.role_id === EMPLOYEE_ROLE || currentUser.role_id === MANAGER_ROLE)) {
      return <EmployeeDashboard />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

// Public Route component (redirect to dashboard if already authenticated)
function PublicRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  
  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Dashboard Route component - use state to prevent infinite loop
function DashboardRoute() {
  const [authState, setAuthState] = useState(() => {
    return {
      isAuthenticated: authService.isAuthenticated(),
      currentUser: authService.getCurrentUser()
    };
  });

  // Only check once on mount, don't re-check on every render
  useEffect(() => {
    const checkAuth = () => {
      setAuthState({
        isAuthenticated: authService.isAuthenticated(),
        currentUser: authService.getCurrentUser()
      });
    };
    checkAuth();
  }, []); // Empty dependency array - only run once
  
  if (!authState.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!authState.currentUser) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = authState.currentUser.role_id === SUPER_ADMIN_ROLE;
  const isEmployee = authState.currentUser.role_id === EMPLOYEE_ROLE || authState.currentUser.role_id === MANAGER_ROLE;

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isEmployee) {
    return <EmployeeDashboard />;
  }

  return <Navigate to="/" replace />;
}

function App() {
  console.log('App component rendered');

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={<DashboardRoute />}
        />
        {/* Admin routes - only for Super Admin */}
        <Route
          path="/admin/*"
          element={
            <RoleBasedRoute allowedRoles={[SUPER_ADMIN_ROLE]}>
              <AdminDashboard />
            </RoleBasedRoute>
          }
        />
        {/* Redirect any unknown routes to login */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
