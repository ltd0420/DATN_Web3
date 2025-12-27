
import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Box, Grid, Chip, List, ListItem,
  ListItemIcon, ListItemText, ListItemSecondaryAction, IconButton,
  Alert, CircularProgress, useTheme, useMediaQuery,
  Badge, Divider, Avatar, Tooltip, Button
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  Done as DoneIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import apiService from '../../services/apiService';

function NotificationsLogs({ user, employeeData, onDataUpdate }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, unread, read

  useEffect(() => {
    fetchData();

    // Initialize Socket.IO connection for real-time notifications
    if (user?.employee_did) {
      // Delay socket initialization to avoid connection issues
      const timer = setTimeout(() => {
        apiService.initSocket(user.employee_did);

        // Listen for real-time notifications
        const handleNotification = (notification) => {
          setNotifications(prev => [notification, ...prev]);
        };

        apiService.onNotification(handleNotification);

        // Cleanup on unmount
        return () => {
          apiService.offNotification(handleNotification);
          apiService.disconnectSocket();
        };
      }, 1000);

      return () => {
        clearTimeout(timer);
        apiService.disconnectSocket();
      };
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const { employee_did } = user;
      const notificationsResponse = await apiService.getNotifications(employee_did);
      const normalized = notificationsResponse || [];
      setNotifications(normalized);

      // Thông báo cho component cha cập nhật lại số badge (unread)
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('Fetch notifications/logs error:', err);
      setError('Không thể tải dữ liệu thông báo và nhật ký. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await apiService.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, is_read: true } : notif
        )
      );

      // Cập nhật số thông báo chưa đọc ở dashboard
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('Mark as read error:', err);
      setError('Không thể đánh dấu đã đọc. Vui lòng thử lại.');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(notif => apiService.markNotificationAsRead(notif._id))
      );
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );

      // Cập nhật số thông báo chưa đọc ở dashboard
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('Mark all as read error:', err);
      setError('Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.');
    }
  };

  const handleDeleteReadNotifications = async () => {
    try {
      await apiService.deleteReadNotifications(user.employee_did);
      setNotifications(prev => prev.filter(notif => !notif.is_read));

      // Update parent component's notifications state if onDataUpdate is provided
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('Delete read notifications error:', err);
      setError('Không thể xóa thông báo đã đọc. Vui lòng thử lại.');
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      console.log('[NotificationsLogs] Deleting notification with ID:', notificationId);
      await apiService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));

      // Update parent component's notifications state if onDataUpdate is provided
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('[NotificationsLogs] Delete notification error:', err);
      console.error('[NotificationsLogs] Error details:', err.response?.data || err.message);
      setError('Không thể xóa thông báo. Vui lòng thử lại.');
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả thông báo?')) {
      return;
    }
    try {
      await apiService.deleteAllNotifications(user.employee_did);
      setNotifications([]);

      // Update parent component's notifications state if onDataUpdate is provided
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (err) {
      console.error('Delete all notifications error:', err);
      setError('Không thể xóa tất cả thông báo. Vui lòng thử lại.');
    }
  };

  const getNotificationIcon = (eventType) => {
    switch (eventType) {
      case 'login':
        return <CheckCircleIcon color="success" />;
      case 'logout':
        return <InfoIcon color="info" />;
      case 'checkin':
        return <CheckCircleIcon color="primary" />;
      case 'checkout':
        return <ScheduleIcon color="secondary" />;
      case 'kpi_update':
        return <InfoIcon color="warning" />;
      case 'salary_update':
        return <InfoIcon color="success" />;
      case 'security_alert':
        return <SecurityIcon color="error" />;
      case 'system_update':
        return <InfoIcon color="info" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="primary" />;
    }
  };

  const getNotificationColor = (eventType) => {
    switch (eventType) {
      case 'login':
      case 'logout':
      case 'checkin':
      case 'checkout':
        return 'primary';
      case 'kpi_update':
      case 'salary_update':
        return 'success';
      case 'security_alert':
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'system_update':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      return `${Math.floor(diffMs / (1000 * 60))} phút trước`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)} giờ trước`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)} ngày trước`;
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filterStatus === 'unread') return !notification.is_read;
    if (filterStatus === 'read') return notification.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Thông báo & Nhật ký
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Theo dõi hoạt động và thông báo quan trọng của bạn
          </Typography>
        </Box>
        {!isMobile && (
          <Chip
            icon={<NotificationsIcon />}
            label={`${unreadCount} chưa đọc`}
            color={unreadCount > 0 ? 'error' : 'default'}
            variant={unreadCount > 0 ? 'filled' : 'outlined'}
          />
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 80%)`,
              color: 'white',
              boxShadow: 4,
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    Thông báo chưa đọc
                  </Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {unreadCount}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                    Cần xem ngay
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    width: 48,
                    height: 48,
                  }}
                >
                  <NotificationsIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 80%)`,
              color: 'white',
              boxShadow: 4,
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    Tổng thông báo
                  </Typography>
                  <Typography variant="h3" fontWeight="bold">
                    {notifications.length}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                    Tất cả thời gian
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    width: 48,
                    height: 48,
                  }}
                >
                  <InfoIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Đã bỏ tính năng nhật ký hoạt động cho nhân viên nên ẩn card này */}
      </Grid>

      {/* Notifications (no audit logs tab) */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: 3,
        }}
      >
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Badge badgeContent={unreadCount} color="error">
              <Box display="flex" alignItems="center" gap={1}>
                <NotificationsIcon />
                <Typography>Thông báo</Typography>
              </Box>
            </Badge>
          </Box>

            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                {/* Filter chips */}
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    label="Tất cả"
                    color={filterStatus === 'all' ? 'primary' : 'default'}
                    variant={filterStatus === 'all' ? 'filled' : 'outlined'}
                    size="small"
                    onClick={() => setFilterStatus('all')}
                  />
                  <Chip
                    label={`Chưa đọc (${unreadCount})`}
                    color={filterStatus === 'unread' ? 'primary' : 'default'}
                    variant={filterStatus === 'unread' ? 'filled' : 'outlined'}
                    size="small"
                    onClick={() => setFilterStatus('unread')}
                  />
                  <Chip
                    label="Đã đọc"
                    color={filterStatus === 'read' ? 'primary' : 'default'}
                    variant={filterStatus === 'read' ? 'filled' : 'outlined'}
                    size="small"
                    onClick={() => setFilterStatus('read')}
                  />
                </Box>

                {/* Action buttons */}
                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                  {unreadCount > 0 && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleMarkAllAsRead}
                      startIcon={<DoneIcon />}
                    >
                      Đánh dấu tất cả đã đọc
                    </Button>
                  )}
                  {!isMobile && notifications.length > 0 && (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleDeleteReadNotifications}
                        startIcon={<ClearIcon />}
                        color="error"
                      >
                        Xóa đã đọc
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleDeleteAllNotifications}
                        startIcon={<DeleteIcon />}
                        color="error"
                      >
                        Xóa tất cả
                      </Button>
                    </>
                  )}
                  <IconButton onClick={fetchData} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Box>
              </Box>

              {filteredNotifications.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    {filterStatus === 'unread' ? 'Không có thông báo chưa đọc' :
                     filterStatus === 'read' ? 'Không có thông báo đã đọc' :
                     'Không có thông báo nào'}
                  </Typography>
                </Box>
              ) : (
                <List
                  sx={{
                    maxHeight: isMobile ? 500 : 560,
                    overflowY: 'auto',
                    pr: 1,
                  }}
                >
                  {filteredNotifications
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((notification, index) => (
                    <React.Fragment key={notification._id}>
                      <ListItem
                        sx={{
                          backgroundColor: !notification.is_read ? 'action.hover' : 'background.paper',
                          borderRadius: 2,
                          mb: 1,
                          boxShadow: !notification.is_read ? 2 : 0,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: getNotificationColor(notification.event_type) + '.light' }}>
                            {getNotificationIcon(notification.event_type)}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1" fontWeight={!notification.is_read ? 'bold' : 'normal'}>
                                {notification.message}
                              </Typography>
                              {!notification.is_read && (
                                <Chip label="Mới" color="error" size="small" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box component="span">
                              <Typography variant="body2" color="text.secondary" component="span">
                                {formatTimestamp(notification.createdAt)}
                              </Typography>
                              {notification.details && (
                                <>
                                  <br />
                                  <Typography variant="body2" color="text.secondary" component="span" sx={{ mt: 0.5 }}>
                                    {notification.details}
                                  </Typography>
                                </>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Box display="flex" gap={0.5}>
                          {!notification.is_read && (
                            <Tooltip title="Đánh dấu đã đọc">
                              <IconButton
                                edge="end"
                                onClick={() => handleMarkAsRead(notification._id)}
                                size="small"
                              >
                                <DoneIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                            <Tooltip title="Xóa thông báo">
                              <IconButton
                                edge="end"
                                onClick={() => handleDeleteNotification(notification._id)}
                                size="small"
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < filteredNotifications.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>

        </CardContent>
      </Card>
    </Box>
  );
}

export default NotificationsLogs;
