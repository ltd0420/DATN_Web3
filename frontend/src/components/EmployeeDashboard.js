import React, { useState, useEffect } from 'react';
import {
  Box, Container, Grid, Paper, Typography, Avatar, Chip, Card, CardContent,
  List, ListItem, ListItemIcon, ListItemText, Divider, Badge, IconButton,
  useTheme, useMediaQuery, Drawer, AppBar, Toolbar, CssBaseline,
  Fab, Tooltip, CircularProgress, Alert
} from '@mui/material';
import {
  Person as PersonIcon,
  QrCode as QrCodeIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  EmojiEvents as KpiIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  Business as DepartmentIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import apiService from '../services/apiService';

// Import dashboard components
import PersonalProfile from './dashboard/PersonalProfile';
import QrAuthentication from './dashboard/QrAuthentication';
import AttendanceHistory from './dashboard/AttendanceHistory';
import NotificationsLogs from './dashboard/NotificationsLogs';
import TaskManagement from './dashboard/TaskManagement';
import DepartmentInfo from './dashboard/DepartmentInfo';
import EmployeeKpiRewards from './dashboard/EmployeeKpiRewards';
import SupportChat from './dashboard/SupportChat';

const drawerWidth = 280;



// Menu items organized by groups
const menuGroups = [
  {
    title: 'Thông tin cá nhân',
    items: [
      { id: 'profile', label: 'Hồ sơ cá nhân', icon: PersonIcon, component: PersonalProfile },
      { id: 'department', label: 'Thông tin phòng ban', icon: DepartmentIcon, component: DepartmentInfo },
      { id: 'support-chat', label: 'Phản hồi yêu cầu', icon: ChatIcon, component: SupportChat },
    ]
  },
  {
    title: 'Công việc',
    items: [
  { id: 'tasks', label: 'Công việc được giao', icon: AssessmentIcon, component: TaskManagement },
  { id: 'kpi-rewards', label: 'KPI thường', icon: KpiIcon, component: EmployeeKpiRewards },
    ]
  },
  {
    title: 'Chấm công & Xác thực',
    items: [
  { id: 'qr', label: 'QR Xác thực', icon: QrCodeIcon, component: QrAuthentication },
  { id: 'attendance', label: 'Lịch sử chấm công', icon: ScheduleIcon, component: AttendanceHistory },
    ]
  },
  {
    title: 'Quản lý',
    items: [
  { id: 'notifications', label: 'Thông báo & Nhật ký', icon: NotificationsIcon, component: NotificationsLogs },
    ]
  },
];

// Flatten menu items for easy lookup
const menuItems = menuGroups.flatMap(group => group.items);


function EmployeeDashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeeData, setEmployeeData] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Use standard menu items for all employee/manager roles
  const currentMenuItems = menuItems;

  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      // Check authentication
      if (!authService.isAuthenticated()) {
        navigate('/');
        return;
      }

      const currentUser = authService.getCurrentUser();
      setUser(currentUser);

      // Fetch employee profile
      const profileResponse = await apiService.getEmployeeProfile(currentUser.employee_did);
      setEmployeeData(profileResponse);

      // Fetch notifications
      const notificationsResponse = await apiService.getNotifications(currentUser.employee_did);
      setNotifications(notificationsResponse || []);

    } catch (err) {
      console.error('Dashboard initialization error:', err);
      setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Cập nhật lại chỉ danh sách thông báo (không hiển thị màn hình loading toàn trang)
  const refreshNotifications = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser?.employee_did) return;

      const notificationsResponse = await apiService.getNotifications(currentUser.employee_did);
      setNotifications(notificationsResponse || []);
    } catch (err) {
      console.error('Refresh notifications error:', err);
    }
  };
  
  // ... (phần còn lại của file giữ nguyên)
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
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
      // Force logout even if API call fails
      authService.logout();
      navigate('/');
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
            }}
          >
            <DashboardIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Nhân viên
            </Typography>
          </Box>
        </Box>
      </Box>


      {/* Navigation Menu with Groups */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          pt: 1,
          // Ẩn thanh cuộn nhưng vẫn cho phép cuộn
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {menuGroups.map((group, groupIndex) => (
          <Box key={groupIndex} sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                px: 2,
                py: 0.5,
                color: 'text.secondary',
                fontWeight: 600,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'block',
              }}
            >
              {group.title}
            </Typography>
            <List dense sx={{ pt: 0.5 }}>
              {group.items.map((item) => (
          <ListItem
            button
            key={item.id}
            selected={activeSection === item.id}
            onClick={() => handleSectionChange(item.id)}
            sx={{
              mx: 1,
                    mb: 0.25,
                    borderRadius: 1.5,
                    py: 0.75,
                    transition: 'all 0.2s ease',
              '&.Mui-selected': {
                backgroundColor: theme.palette.primary.main + '20',
                      borderLeft: `3px solid ${theme.palette.primary.main}`,
                '&:hover': {
                  backgroundColor: theme.palette.primary.main + '30',
                },
                      '& .MuiListItemIcon-root': {
                        color: theme.palette.primary.main,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                      transform: 'translateX(4px)',
              },
            }}
          >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {item.id === 'notifications' ? (
                      <Badge badgeContent={unreadNotifications} color="error" max={99}>
                        <item.icon 
                          fontSize="small"
                          color={activeSection === item.id ? 'primary' : 'inherit'} 
                        />
                      </Badge>
                    ) : (
                      <item.icon 
                        fontSize="small"
                        color={activeSection === item.id ? 'primary' : 'inherit'} 
                      />
                    )}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                      fontSize: '0.875rem',
                fontWeight: activeSection === item.id ? 600 : 400,
              }}
            />
          </ListItem>
        ))}
      </List>
            {groupIndex < menuGroups.length - 1 && (
              <Divider sx={{ mx: 2, mt: 1 }} />
            )}
          </Box>
        ))}
      </Box>

      {/* Logout Button */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <IconButton
          onClick={handleLogout}
          sx={{
            width: '100%',
            borderRadius: 1,
            py: 1,
            backgroundColor: theme.palette.error.main + '10',
            '&:hover': {
              backgroundColor: theme.palette.error.main + '20',
            },
          }}
        >
          <LogoutIcon sx={{ mr: 1 }} />
          <Typography variant="body2">Đăng xuất</Typography>
        </IconButton>
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Đang tải dashboard...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm">
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          gap={2}
        >
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
          <IconButton onClick={initializeDashboard} color="primary">
            <Typography>Thử lại</Typography>
          </IconButton>
        </Box>
      </Container>
    );
  }

  const ActiveComponent = currentMenuItems.find(item => item.id === activeSection)?.component;

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* App Bar for Mobile */}
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{
            width: { md: `calc(100% - ${drawerWidth}px)` },
            ml: { md: `${drawerWidth}px` },
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div">
              {currentMenuItems.find(item => item.id === activeSection)?.label}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Badge badgeContent={unreadNotifications} color="error" max={99}>
              <NotificationsIcon />
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
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: `1px solid ${theme.palette.divider}`,
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
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: isMobile ? '64px' : 0,
        }}
      >
        <Container maxWidth="xl">
          {ActiveComponent && (
            <ActiveComponent
              user={user}
              employeeData={employeeData}
              onDataUpdate={refreshNotifications}
            />
          )}
        </Container>
      </Box>

      {/* Floating Action Button for Notifications */}
      {!isMobile && (
        <Tooltip title={unreadNotifications > 0 ? `${unreadNotifications} thông báo chưa đọc` : 'Thông báo'}>
          <Fab
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1000,
            }}
            onClick={() => setActiveSection('notifications')}
          >
            <Badge badgeContent={unreadNotifications} color="error" max={99}>
              <NotificationsIcon />
            </Badge>
          </Fab>
        </Tooltip>
      )}
    </Box>
  );
}

export default EmployeeDashboard;
