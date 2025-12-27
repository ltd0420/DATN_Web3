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
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import apiService from '../../services/apiService';

const SupportChat = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const employeeDid = user?.employee_did;

  const loadMessages = async () => {
    if (!employeeDid) return;
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getSupportMessages(employeeDid);
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading support messages:', err);
      setError('Không thể tải lịch sử trò chuyện.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [employeeDid]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Realtime updates via Socket.IO
  useEffect(() => {
    if (!employeeDid) return undefined;

    const timer = setTimeout(() => {
      try {
        apiService.initSocket(employeeDid);

        // Handle support messages - only listen to support_message event to avoid duplicates
        const handleSupportMessage = (notification) => {
          if (
            !notification ||
            !['support_employee', 'support_admin', 'support_request'].includes(notification.event_type)
          ) {
            return;
          }

          // Only process messages for this employee
          if (notification.user_did !== employeeDid && notification.event_type !== 'support_admin') {
            return;
          }

          const chatMessage = {
            ...notification,
            _id: notification.id || notification._id || `${Date.now()}-${Math.random()}`,
            user_did: notification.user_did || employeeDid,
            timestamp: notification.timestamp || new Date().toISOString(),
          };

          // Check if message already exists (avoid duplicates) - improved check
          setMessages((prev) => {
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

        // Cleanup
        return () => {
          if (apiService.socket) {
            apiService.socket.off('support_message', handleSupportMessage);
          }
        };
      } catch (err) {
        console.error('Error initializing support chat socket:', err);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [employeeDid]);

  const handleSend = async () => {
    if (!input.trim() || !employeeDid || sending) return; // Prevent multiple sends
    const messageText = input.trim();
    setInput(''); // Clear input immediately for better UX
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      _id: tempMessageId,
      message: messageText,
      event_type: 'support_employee',
      user_did: employeeDid,
      timestamp: new Date().toISOString(),
      is_read: false
    };
    
    try {
      setSending(true);
      setError('');
      // Optimistically add message to UI
      setMessages((prev) => {
        // Check if temp message already exists to avoid duplicates
        const hasTemp = prev.some(msg => 
          msg._id?.startsWith('temp-') && 
          msg.message === messageText &&
          msg.event_type === 'support_employee'
        );
        if (hasTemp) return prev;
        return [...prev, tempMessage];
      });
      
      await apiService.sendSupportMessage(employeeDid, messageText, 'employee');
      // Message will be updated via Socket.IO, no need to reload
    } catch (err) {
      console.error('Error sending support message:', err);
      setError('Không thể gửi tin nhắn. Vui lòng thử lại.');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter(msg => msg._id !== tempMessageId));
      setInput(messageText); // Restore input text
    } finally {
      setSending(false);
    }
  };

  if (!employeeDid) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Không tìm thấy thông tin nhân viên. Vui lòng đăng nhập lại.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Phản hồi yêu cầu
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Trao đổi với Admin về việc xếp phòng ban hoặc các yêu cầu hỗ trợ khác.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card
        sx={{
          height: { xs: '70vh', md: '65vh' },
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? theme.palette.background.paper
              : theme.palette.grey[900],
        }}
      >
        <CardContent
          sx={{
            flex: 1,
            overflowY: 'auto',
            bgcolor: 'background.default',
            p: 2,
          }}
        >
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress />
            </Box>
          ) : messages.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
              Chưa có cuộc trò chuyện nào. Hãy gửi tin nhắn đầu tiên cho Admin.
            </Typography>
          ) : (
            messages.map((msg) => {
              const isEmployee = msg.event_type === 'support_employee' || msg.event_type === 'support_request';
              return (
                <Box
                  key={msg._id}
                  sx={{
                    display: 'flex',
                    mb: 1.5,
                    justifyContent: isEmployee ? 'flex-end' : 'flex-start',
                  }}
                >
                  {!isEmployee && (
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        mr: 1,
                        bgcolor: 'primary.main',
                      }}
                    >
                      A
                    </Avatar>
                  )}
                  <Box
                    sx={{
                      maxWidth: '70%',
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: isEmployee ? 'primary.main' : 'rgba(255,255,255,0.08)',
                      color: isEmployee ? 'primary.contrastText' : 'grey.100',
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
            placeholder="Nhập tin nhắn..."
            size="small"
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
            disabled={sending || !input.trim()}
          >
            {sending ? <CircularProgress size={20} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Card>
    </Box>
  );
};

export default SupportChat;


