import React, { useState, useEffect } from 'react';
import {
  Box, Container, Grid, Paper, Typography, Avatar, Chip, Card, CardContent,
  List, ListItem, ListItemIcon, ListItemText, Divider, Badge, IconButton,
  useTheme, useMediaQuery, Drawer, AppBar, Toolbar, CssBaseline,
  Fab, Tooltip, CircularProgress, Alert, ThemeProvider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Schedule as ScheduleIcon,
  EmojiEvents as RankingIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
  AccountBalance as WalletIcon,
  AdminPanelSettings as AdminIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  ContactSupport as ContactIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';
import adminTheme from '../theme/adminTheme';

// Import admin components
import AdminOverview from './admin/AdminOverview';
import DepartmentManagement from './admin/DepartmentManagement';
import EmployeeManagement from './admin/EmployeeManagement';
import AdminTaskManagement from './admin/TaskManagement';
import AttendanceManagement from './admin/AttendanceManagement';
import SmartContractLogs from './admin/SmartContractLogs';
import SupportContact from './admin/SupportContact';
const TaskManagement = () => <div>Task Management - Coming Soon</div>;

const drawerWidth = 300;

const menuItems = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: DashboardIcon,
    component: AdminOverview,
    category: 'Dashboard'
  },
  {
    id: 'departments',
    label: 'Quản lý Phòng ban',
    icon: BusinessIcon,
    component: DepartmentManagement,
    category: 'Tổ chức & Cấu hình'
  },
  {
    id: 'support-contact',
    label: 'Phản hồi yêu cầu',
    icon: ContactIcon,
    component: SupportContact,
    category: 'Tổ chức & Cấu hình'
  },
  {
    id: 'employees',
    label: 'Quản lý Nhân viên',
    icon: PeopleIcon,
    component: EmployeeManagement,
    category: 'Quản lý Nhân sự'
  },
  {
    id: 'attendance',
    label: 'Quản lý Chấm công',
    icon: ScheduleIcon,
    component: AttendanceManagement,
    category: 'Quản lý Nhân sự'
  },
  {
    id: 'tasks',
    label: 'Quản lý Công việc',
    icon: WorkIcon,
    component: AdminTaskManagement,
    category: 'Quản lý Hiệu suất'
  },
  {
    id: 'smart-contracts',
    label: 'Smart Contract Logs',
    icon: WalletIcon,
    component: SmartContractLogs,
    category: 'Lương thưởng & Web3'
  },
];

function AdminDashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active section from URL params, default to 'overview'
  const sectionFromUrl = searchParams.get('section') || 'overview';
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(sectionFromUrl);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [selectedEmployeeForChat, setSelectedEmployeeForChat] = useState(null);

  useEffect(() => {
    initializeDashboard();
  }, []);

  // Sync URL with activeSection on mount and when URL changes externally
  useEffect(() => {
    const sectionFromUrl = searchParams.get('section') || 'overview';
    if (sectionFromUrl !== activeSection && menuItems.find(item => item.id === sectionFromUrl)) {
      setActiveSection(sectionFromUrl);
    }
  }, [searchParams]);

  const initializeDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      // Check authentication and admin role
      if (!authService.isAuthenticated()) {
        navigate('/');
        return;
      }

      const currentUser = authService.getCurrentUser();

      // Check if user is Super Admin or Manager
      const allowedRoles = ['01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a', '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7b']; // Super Admin and Manager
      if (!allowedRoles.includes(currentUser.role_id)) {
        setError('Bạn không có quyền truy cập trang quản trị.');
        navigate('/dashboard');
        return;
      }

      setUser(currentUser);

      // Fetch admin notifications (placeholder)
      setNotifications([]);

    } catch (err) {
      console.error('Admin dashboard initialization error:', err);
      setError('Không thể tải dữ liệu dashboard quản trị. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    // Update URL
    if (sectionId === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ section: sectionId }, { replace: true });
    }
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleNavigateToChat = (employeeDid) => {
    setSelectedEmployeeForChat(employeeDid);
    setActiveSection('support-contact');
    setSearchParams({ section: 'support-contact' }, { replace: true });
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      authService.logout();
      navigate('/');
    }
  };

  const getNotificationIcon = (eventType) => {
    switch (eventType) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="primary" />;
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  // Group menu items by category
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'background.paper' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'grey.200' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            }}
          >
            <AdminIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight="bold" color="primary">
              Admin Panel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.role_id === '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a' ? 'Super Admin' : 'Manager'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* User Info */}
      {user && (
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'grey.200' }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <WalletIcon fontSize="small" color="primary" />
            <Typography variant="body2" noWrap sx={{ flex: 1, fontFamily: 'monospace' }}>
              {user.walletAddress?.slice(0, 8)}...{user.walletAddress?.slice(-6)}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <AdminIcon fontSize="small" color="primary" />
            <Chip
              label={user?.role_id === '01926d2c-a8d1-7c3e-8f2a-1b3c4d5e6f7a' ? 'Super Admin' : 'Manager'}
              size="small"
              color="primary"
              variant="filled"
              sx={{ fontSize: '0.75rem', fontWeight: 600 }}
            />
          </Box>
        </Box>
      )}

      {/* Navigation Menu */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          p: 2,
          // Ẩn thanh cuộn nhưng vẫn cho phép cuộn
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',      // Firefox
          msOverflowStyle: 'none',     // IE/Edge
        }}
      >
        {Object.entries(groupedMenuItems).map(([category, items]) => (
          <Box key={category} sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                px: 2,
                py: 1,
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontSize: '0.75rem'
              }}
            >
              {category}
            </Typography>
            <List sx={{ py: 0 }}>
              {items.map((item) => (
                <ListItem
                  button
                  key={item.id}
                  selected={activeSection === item.id}
                  onClick={() => handleSectionChange(item.id)}
                  sx={{
                    mx: 1,
                    mb: 0.5,
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    '&.Mui-selected': {
                      backgroundColor: 'primary.light',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'grey.100',
                      transform: 'translateX(4px)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: activeSection === item.id ? 'inherit' : 'grey.600' }}>
                    <item.icon />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: activeSection === item.id ? 600 : 500,
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/* Logout Button */}
      <Box sx={{ p: 3, borderTop: '1px solid', borderColor: 'grey.200' }}>
        <IconButton
          onClick={handleLogout}
          sx={{
            width: '100%',
            borderRadius: 2,
            py: 1.5,
            backgroundColor: 'grey.100',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'error.contrastText',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <LogoutIcon sx={{ mr: 1 }} />
          <Typography variant="body2" fontWeight={500}>Đăng xuất</Typography>
        </IconButton>
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <ThemeProvider theme={adminTheme}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          flexDirection="column"
          gap={3}
          sx={{ backgroundColor: 'background.default' }}
        >
          <CircularProgress size={64} sx={{ color: 'primary.main' }} />
          <Typography variant="h5" color="text.secondary" fontWeight={500}>
            Đang tải Admin Dashboard...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider theme={adminTheme}>
        <Container maxWidth="sm">
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
            gap={3}
            sx={{ backgroundColor: 'background.default', p: 3 }}
          >
            <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
              {error}
            </Alert>
            <IconButton onClick={initializeDashboard} color="primary" size="large">
              <Typography>Thử lại</Typography>
            </IconButton>
          </Box>
        </Container>
      </ThemeProvider>
    );
  }

  const ActiveComponent = menuItems.find(item => item.id === activeSection)?.component;

  return (
    <ThemeProvider theme={adminTheme}>
      <Box sx={{ display: 'flex', backgroundColor: 'background.default', minHeight: '100vh' }}>
        <CssBaseline />

        {/* App Bar for Mobile */}
        {isMobile && (
          <AppBar
            position="fixed"
            elevation={0}
            sx={{
              width: { md: `calc(100% - ${drawerWidth}px)` },
              ml: { md: `${drawerWidth}px` },
              backgroundColor: 'background.paper',
              borderBottom: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <Toolbar>
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2, display: { md: 'none' }, color: 'text.primary' }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" noWrap component="div" color="text.primary" fontWeight={600}>
                {menuItems.find(item => item.id === activeSection)?.label}
              </Typography>
              {unreadNotifications > 0 && (
                <Box sx={{ flexGrow: 1 }} />
              )}
              <Badge badgeContent={unreadNotifications} color="error">
                <NotificationsIcon sx={{ color: 'text.secondary' }} />
              </Badge>
            </Toolbar>
          </AppBar>
        )}

        {/* Drawer */}
        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
          <Drawer
            variant={isMobile ? 'temporary' : 'permanent'}
            open={isMobile ? mobileOpen : true}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                borderRight: '1px solid',
                borderColor: 'grey.200',
                backgroundColor: 'background.paper',
              },
            }}
          >
            {drawer}
          </Drawer>
        </Box>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 4 },
            width: { md: `calc(100% - ${drawerWidth}px)` },
            mt: isMobile ? '64px' : 0,
          }}
        >
          <Container maxWidth="xl" sx={{ px: { xs: 0, md: 3 } }}>
            {ActiveComponent && (
              <ActiveComponent
                user={user}
                onDataUpdate={initializeDashboard}
                onNavigateToChat={handleNavigateToChat}
                selectedEmployeeForChat={selectedEmployeeForChat}
                onEmployeeSelected={(did) => setSelectedEmployeeForChat(did)}
              />
            )}
          </Container>
        </Box>

        {/* Floating Action Button for Notifications */}
        {!isMobile && unreadNotifications > 0 && (
          <Tooltip title={`${unreadNotifications} thông báo chưa đọc`}>
            <Fab
              color="primary"
              sx={{
                position: 'fixed',
                bottom: 32,
                right: 32,
                zIndex: 1000,
                boxShadow: '0 10px 25px -3px rgba(37,99,235,0.3)',
                '&:hover': {
                  boxShadow: '0 20px 40px -5px rgba(37,99,235,0.4)',
                },
              }}
              onClick={() => setActiveSection('notifications')}
            >
              <Badge badgeContent={unreadNotifications} color="error">
                <NotificationsIcon />
              </Badge>
            </Fab>
          </Tooltip>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default AdminDashboard;
