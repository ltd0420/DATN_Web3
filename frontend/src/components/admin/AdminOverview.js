import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Avatar, Chip,
  LinearProgress, IconButton, Tooltip, Divider, Paper, Button
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  EmojiEvents as RankingIcon,
  AccountBalanceWallet as WalletIcon,
  Feedback as FeedbackIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  AccountBalance as AccountBalanceIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import apiService from '../../services/apiService';
import { useNavigate } from 'react-router-dom';

const AdminOverview = ({ user, onDataUpdate }) => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalDepartments: 0,
    activeTasks: 0,
    completedTasks: 0,
    smartContractTransactions: 0,
    systemHealth: 95,
    contractBalance: 0,
    contractBalanceFormatted: '0.00',
    tokenSymbol: 'USDT',
    contractInfoError: null
  });

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Stats are updated automatically when state changes

  const useChartReady = (height) => {
    const containerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        const { width, height: observedHeight } = entry.contentRect;
        setIsReady(width > 0 && observedHeight > 0);
      });

      observer.observe(element);
      return () => observer.disconnect();
    }, []);

    const ChartWrapper = ({ children }) => (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height,
          minHeight: height,
          position: 'relative'
        }}
      >
        {isReady ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="100%"
          >
            <Typography variant="body2" color="text.secondary">
              Đang chuẩn bị biểu đồ...
            </Typography>
          </Box>
        )}
      </Box>
    );

    return ChartWrapper;
  };

  const LineChartContainer = useChartReady(280);
  const PieChartContainer = useChartReady(260);

  const fetchContractInfo = async () => {
    try {
      const contractInfo = await apiService.getPayrollContractInfo();
      return contractInfo;
    } catch (error) {
      console.error('[AdminOverview] Error fetching contract info:', error);
      throw error;
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch contract info separately to better handle errors
      let contractInfoRes = { status: 'rejected', reason: null, value: null };
      try {
        const contractInfo = await fetchContractInfo();
        contractInfoRes = { status: 'fulfilled', value: contractInfo };
      } catch (error) {
        contractInfoRes = { status: 'rejected', reason: error, value: null };
      }

      // Fetch data from multiple endpoints
      const [employeesRes, departmentsRes, tasksRes, smartContractLogsRes] = await Promise.allSettled([
        apiService.getEmployees(),
        apiService.getDepartments(),
        apiService.getAllTasks(),
        apiService.get('/logs/contracts'), // Smart contract logs endpoint
      ]);

      // Process employees data
      const employees = employeesRes.status === 'fulfilled' ? employeesRes.value : [];
      const totalEmployees = employees.length;

      // Process departments data
      const departments = departmentsRes.status === 'fulfilled' ? departmentsRes.value : [];
      const totalDepartments = departments.length;

      // Process tasks data
      const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value : [];
      const activeTasks = tasks.filter(task =>
        task.trang_thai === 'Đang thực hiện' || task.trang_thai === 'Chờ bắt đầu'
      ).length;
      const completedTasks = tasks.filter(task => task.trang_thai === 'Hoàn thành').length;


      // Process smart contract logs
      let smartContractLogs = [];
      if (smartContractLogsRes.status === 'fulfilled') {
        const response = smartContractLogsRes.value;
        const data = response?.data?.data ?? response?.data ?? response ?? [];
        smartContractLogs = Array.isArray(data) ? data : [];
      }
      const smartContractTransactions = smartContractLogs.length;

      // Process contract info
      let contractBalance = 0;
      let contractBalanceFormatted = '0.00';
      let tokenSymbol = 'TUSD';
      
      if (contractInfoRes.status === 'fulfilled' && contractInfoRes.value) {
        const contractInfo = contractInfoRes.value;
        
        // Direct access - backend returns contractTokenBalance and tokenSymbol
        const balanceValue = contractInfo.contractTokenBalance;
        const symbolValue = contractInfo.tokenSymbol;
        
        // Parse balance
        if (balanceValue !== null && balanceValue !== undefined && balanceValue !== '') {
          const parsed = parseFloat(balanceValue);
          
          if (!isNaN(parsed) && parsed >= 0) {
            contractBalance = parsed;
            contractBalanceFormatted = parsed.toLocaleString('vi-VN', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            });
          } else {
            contractBalanceFormatted = '0.00';
          }
        } else {
          contractBalanceFormatted = '0.00';
        }
        
        tokenSymbol = symbolValue || 'TUSD';
      } else {
        const errorDetails = {
          status: contractInfoRes.status,
          reason: contractInfoRes.reason,
          value: contractInfoRes.value,
          error: contractInfoRes.reason?.response?.data || contractInfoRes.reason?.message || contractInfoRes.reason
        };
        console.error('[AdminOverview] Failed to get contract info:', errorDetails);
        // Set error state to show in UI
        setStats(prev => ({
          ...prev,
          contractInfoError: errorDetails.error?.message || 'Không thể tải thông tin quỹ công ty'
        }));
      }

      const newStats = {
        totalEmployees,
        totalDepartments,
        activeTasks,
        completedTasks,
        smartContractTransactions,
        systemHealth: 98, // This could be calculated based on system metrics
        contractBalance,
        contractBalanceFormatted,
        tokenSymbol,
        contractInfoError: null // Clear error on success
      };
      
      setStats(newStats);

      // Generate chart data from the last 6 months
      const currentDate = new Date();
      const chartDataPoints = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });

        // Filter data for this month
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const employeesThisMonth = employees.filter(emp =>
          new Date(emp.createdAt) >= monthStart && new Date(emp.createdAt) <= monthEnd
        ).length;

        const tasksThisMonth = tasks.filter(task =>
          new Date(task.createdAt) >= monthStart && new Date(task.createdAt) <= monthEnd
        ).length;

        chartDataPoints.push({
          month: monthName,
          employees: employeesThisMonth,
          tasks: tasksThisMonth
        });
      }

      setChartData(chartDataPoints);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set default values if API calls fail
      setStats({
        totalEmployees: 0,
        totalDepartments: 0,
        activeTasks: 0,
        completedTasks: 0,
        smartContractTransactions: 0,
        systemHealth: 95
      });
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card
      sx={{
        height: '100%',
        background: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          borderColor: color,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: `${color}15`,
              color: color,
            }}
          >
            <Icon sx={{ fontSize: 24 }} />
          </Box>
          {trend && (
            <Chip
              label={`${trend > 0 ? '+' : ''}${trend}%`}
              size="small"
              sx={{
                bgcolor: trend > 0 ? 'success.light' : 'error.light',
                color: trend > 0 ? 'success.dark' : 'error.dark',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          )}
        </Box>
        <Typography variant="h3" fontWeight="bold" color="text.primary" mb={0.5}>
          {value.toLocaleString()}
        </Typography>
        <Typography variant="h6" color="text.primary" fontWeight={600} mb={0.5} sx={{ fontSize: '1rem' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const pieData = [
    { name: 'Hoàn thành', value: stats.completedTasks, color: '#10b981' },
    { name: 'Đang thực hiện', value: stats.activeTasks, color: '#f59e0b' },
  ];

  const systemAlerts = [
    { type: 'success', message: 'Tất cả hệ thống hoạt động bình thường', icon: CheckCircleIcon },
    { type: 'info', message: `${stats.smartContractTransactions} giao dịch Smart Contract trong tháng`, icon: InfoIcon },
  ];

  return (
    <Box>
      {/* Header - Clean and Professional */}
      <Box 
        sx={{
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
            <Typography 
              variant="h4" 
              fontWeight="bold" 
              color="text.primary" 
              mb={1}
              sx={{ fontSize: { xs: '1.75rem', md: '2rem' } }}
            >
            Tổng quan Hệ thống
          </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
            Theo dõi các chỉ số quan trọng và tình trạng hệ thống
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Test Contract API">
            <IconButton
              onClick={async () => {
                console.log('[AdminOverview] Testing contract API...');
                try {
                  const result = await fetchContractInfo();
                  console.log('[AdminOverview] Test result (full):', JSON.stringify(result, null, 2));
                  console.log('[AdminOverview] Test result keys:', Object.keys(result));
                  console.log('[AdminOverview] contractTokenBalance:', result.contractTokenBalance);
                  console.log('[AdminOverview] tokenSymbol:', result.tokenSymbol);
                  
                  const balance = result.contractTokenBalance || result.contract_token_balance || 'N/A';
                  const symbol = result.tokenSymbol || result.token_symbol || 'N/A';
                  
                  alert(`Contract Balance: ${balance} ${symbol}\n\nFull response logged to console.`);
                } catch (error) {
                  console.error('[AdminOverview] Test error:', error);
                  console.error('[AdminOverview] Error response:', error.response);
                  alert(`Error: ${error.message}\n\nCheck console for details.`);
                }
              }}
              sx={{
                bgcolor: 'info.light',
                color: 'white',
                '&:hover': { bgcolor: 'info.main' }
              }}
            >
              <AccountBalanceIcon />
            </IconButton>
          </Tooltip>
        <Tooltip title="Làm mới dữ liệu">
            <span>
              <IconButton
                onClick={fetchDashboardData}
                disabled={loading}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { 
                    bgcolor: 'action.hover',
                    transform: 'rotate(180deg)',
                  transition: 'transform 0.3s ease',
                },
                transition: 'all 0.3s ease',
              }}
            >
              <RefreshIcon />
            </IconButton>
            </span>
          </Tooltip>
        </Box>
        </Box>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tổng Nhân viên"
            value={stats.totalEmployees}
            icon={PeopleIcon}
            color="#2563eb"
            subtitle="Đang làm việc"
            trend={stats.totalEmployees > 0 ? 5.2 : 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Phòng ban"
            value={stats.totalDepartments}
            icon={BusinessIcon}
            color="#7c3aed"
            subtitle="Đang hoạt động"
            trend={0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Công việc Hoạt động"
            value={stats.activeTasks}
            icon={AssessmentIcon}
            color="#f59e0b"
            subtitle="Đang thực hiện"
            trend={stats.activeTasks > 0 ? 12.5 : 0}
          />
        </Grid>
      </Grid>

      {/* Company Fund Card - Prominent Display */}
      <Card
        sx={{
          mb: 4,
          background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
          color: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <CardContent sx={{ p: 4, position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={3}>
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    width: 64,
                    height: 64,
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <AccountBalanceIcon sx={{ fontSize: 32, color: 'white' }} />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ opacity: 0.9, mb: 0.5 }}>
                    Quỹ Công ty
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Tổng số tiền trong Smart Contract
                  </Typography>
                </Box>
              </Box>
              <Box>
                {stats.contractInfoError ? (
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                      {stats.contractInfoError}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={fetchDashboardData}
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' }
                      }}
                    >
                      Thử lại
                    </Button>
                  </Box>
                ) : (
                  <>
                <Typography variant="h2" fontWeight="bold" sx={{ mb: 1 }}>
                  {stats.contractBalanceFormatted}
                </Typography>
                <Chip
                  label={stats.tokenSymbol}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)',
                  }}
                />
                  </>
                )}
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 1,
              }}
            >
              <MoneyIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              <Typography variant="caption" sx={{ opacity: 0.8, textAlign: 'right' }}>
                Sẵn sàng thanh toán
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Đã ẩn biểu đồ Xu hướng Hệ thống (6 tháng) và Trạng thái Công việc theo yêu cầu */}

      {/* Đã ẩn Tình trạng Hệ thống và Thông báo Hệ thống theo yêu cầu */}
    </Box>
  );
};

export default AdminOverview;
