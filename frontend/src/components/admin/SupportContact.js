import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Avatar,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import apiService from '../../services/apiService';

const SupportContact = ({ selectedEmployeeForChat, onEmployeeSelected }) => {
  const [allMessages, setAllMessages] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(selectedEmployeeForChat || null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const loadAllMessages = async () => {
    try {
      setLoading(true);
      setError('');
      const events = await apiService.getAllEvents();
      const supportEvents = (events || []).filter(
        (e) =>
          e.event_type === 'support_employee' ||
          e.event_type === 'support_admin' ||
          e.event_type === 'support_request'
      );
      setAllMessages(supportEvents);
      if (!selectedEmployee && !selectedEmployeeForChat && supportEvents.length > 0) {
        setSelectedEmployee(supportEvents[0].user_did);
      }
    } catch (err) {
      console.error('Error loading support events:', err);
      setError('Không thể tải danh sách trò chuyện hỗ trợ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMessages();
  }, []);

  // Tự động chọn nhân viên khi được truyền từ bên ngoài
  useEffect(() => {
    if (selectedEmployeeForChat && selectedEmployeeForChat !== selectedEmployee) {
      setSelectedEmployee(selectedEmployeeForChat);
    }
  }, [selectedEmployeeForChat]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages, selectedEmployee]);

  // Realtime updates when đang mở chat với 1 nhân viên
  useEffect(() => {
    if (!selectedEmployee) return undefined;

    const timer = setTimeout(() => {
      try {
        apiService.initSocket(selectedEmployee);

        // Handle support messages - only listen to support_message event to avoid duplicates
        const handleSupportMessage = (notification) => {
          if (
            !notification ||
            !['support_employee', 'support_admin', 'support_request'].includes(notification.event_type)
          ) {
            return;
          }

          // Only add message if it's for the selected employee
          if (notification.user_did !== selectedEmployee && notification.event_type !== 'support_admin') {
            return;
          }

          const chatMessage = {
            ...notification,
            _id: notification.id || notification._id || `${Date.now()}-${Math.random()}`,
            user_did: notification.user_did || selectedEmployee,
            timestamp: notification.timestamp || new Date().toISOString(),
          };

          // Check if message already exists (avoid duplicates) - improved check
          setAllMessages((prev) => {
            // First, try to replace temp message (for optimistic updates) - PRIORITY
            const tempIndex = prev.findIndex(msg => 
              msg._id?.startsWith('temp-') && 
              msg.message === chatMessage.message &&
              msg.event_type === chatMessage.event_type &&
              msg.user_did === chatMessage.user_did
            );
            if (tempIndex !== -1) {
              const newMessages = [...prev];
              newMessages[tempIndex] = chatMessage;
              return newMessages;
            }
            
            // Check by _id (most reliable)
            const existsById = prev.some(msg => msg._id === chatMessage._id);
            if (existsById) return prev;
            
            // Check by message content, event_type, user_did and timestamp (within 5 seconds)
            const existsByContent = prev.some(msg => 
              !msg._id?.startsWith('temp-') && // Don't check against temp messages
              msg.message === chatMessage.message &&
              msg.event_type === chatMessage.event_type &&
              msg.user_did === chatMessage.user_did &&
              Math.abs(new Date(msg.timestamp || 0) - new Date(chatMessage.timestamp || 0)) < 5000
            );
            if (existsByContent) return prev;
            
            return [...prev, chatMessage];
          });
        };

        // Only listen to support_message event for chat to avoid duplicates
        // Remove existing listener first to avoid duplicates
        const setupSupportListener = () => {
          if (apiService.socket) {
            // Remove any existing listener first
            apiService.socket.off('support_message', handleSupportMessage);
            // Add new listener
            apiService.socket.on('support_message', handleSupportMessage);
          } else {
            setTimeout(setupSupportListener, 100);
          }
        };
        setupSupportListener();

        return () => {
          if (apiService.socket) {
            apiService.socket.off('support_message', handleSupportMessage);
          }
        };
      } catch (err) {
        console.error('Error initializing admin support socket:', err);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedEmployee]);

  const handleSend = async () => {
    if (!input.trim() || !selectedEmployee || sending) return; // Prevent multiple sends
    const messageText = input.trim();
    setInput(''); // Clear input immediately for better UX
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      _id: tempMessageId,
      message: messageText,
      event_type: 'support_admin',
      user_did: selectedEmployee,
      timestamp: new Date().toISOString(),
      is_read: false
    };
    
    try {
      setSending(true);
      setError('');
      // Optimistically add message to UI
      setAllMessages((prev) => {
        // Check if temp message already exists to avoid duplicates
        const hasTemp = prev.some(msg => 
          msg._id?.startsWith('temp-') && 
          msg.message === messageText &&
          msg.event_type === 'support_admin' &&
          msg.user_did === selectedEmployee
        );
        if (hasTemp) return prev;
        return [...prev, tempMessage];
      });
      
      await apiService.sendSupportMessage(selectedEmployee, messageText, 'admin');
      // Message will be updated via Socket.IO, no need to reload
    } catch (err) {
      console.error('Error sending admin support message:', err);
      setError('Không thể gửi tin nhắn. Vui lòng thử lại.');
      // Remove optimistic message on error
      setAllMessages((prev) => prev.filter(msg => msg._id !== tempMessageId));
      setInput(messageText); // Restore input text
    } finally {
      setSending(false);
    }
  };

  const employeeIds = Array.from(new Set(allMessages.map((m) => m.user_did))).filter(Boolean);
  const currentMessages = (allMessages || [])
    .filter((m) => m.user_did === selectedEmployee)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Phản hồi yêu cầu
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Trò chuyện với nhân viên về yêu cầu xếp phòng ban và các vấn đề hỗ trợ.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
          gap: 2,
          height: { xs: 'auto', md: '70vh' },
        }}
      >
        {/* Danh sách nhân viên */}
        <Card
          sx={{
            overflow: 'hidden',
            backgroundColor: 'background.paper',
          }}
        >
          <CardContent sx={{ p: 0, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              Nhân viên liên hệ
            </Typography>
            {employeeIds.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Chưa có nhân viên nào gửi yêu cầu.
              </Typography>
            ) : (
              <List sx={{ maxHeight: '100%', overflowY: 'auto' }}>
                {employeeIds.map((id) => {
                  const lastMsg = allMessages
                    .filter((m) => m.user_did === id)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                  return (
                    <React.Fragment key={id}>
                      <ListItem
                        button
                        selected={selectedEmployee === id}
                        onClick={() => setSelectedEmployee(id)}
                        alignItems="flex-start"
                      >
                        <Avatar sx={{ mr: 1, bgcolor: 'primary.main' }}>
                          {id?.slice(0, 2)?.toUpperCase()}
                        </Avatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" fontWeight="bold">
                              DID: {id}
                            </Typography>
                          }
                          secondary={
                            lastMsg && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                noWrap
                                sx={{ maxWidth: 180 }}
                              >
                                {lastMsg.message}
                              </Typography>
                            )
                          }
                        />
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Khung chat */}
        <Card
          sx={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.paper',
          }}
        >
          <CardContent
            sx={{
              flex: 1,
              overflowY: 'auto',
              bgcolor: 'background.paper',
              p: 2,
            }}
          >
            {!selectedEmployee ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
                Chọn một nhân viên ở danh sách bên trái để bắt đầu trò chuyện.
              </Typography>
            ) : currentMessages.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
                Chưa có tin nhắn trong cuộc trò chuyện này.
              </Typography>
            ) : (
              currentMessages.map((msg) => {
                const isAdmin = msg.event_type === 'support_admin';
                return (
                  <Box
                    key={msg._id}
                    sx={{
                      display: 'flex',
                      mb: 1.5,
                      justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {!isAdmin && (
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          mr: 1,
                          bgcolor: 'primary.main',
                        }}
                      >
                        N
                      </Avatar>
                    )}
                    <Box
                      sx={{
                        maxWidth: '70%',
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        bgcolor: isAdmin ? 'primary.main' : 'grey.200',
                        color: isAdmin ? 'primary.contrastText' : 'text.primary',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {msg.message}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, opacity: 0.7, textAlign: 'right' }}
                      >
                        {new Date(msg.timestamp).toLocaleString('vi-VN')}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 1.5,
              borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <TextField
              fullWidth
              placeholder={
                selectedEmployee ? 'Nhập tin nhắn phản hồi...' : 'Chọn nhân viên trước khi soạn tin nhắn...'
              }
              size="small"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!selectedEmployee}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <IconButton
              color="primary"
              sx={{ ml: 1 }}
              onClick={handleSend}
              disabled={sending || !input.trim() || !selectedEmployee}
            >
              {sending ? <CircularProgress size={20} /> : <SendIcon />}
            </IconButton>
          </Box>
        </Card>
      </Box>
    </Box>
  );
};

export default SupportContact;



