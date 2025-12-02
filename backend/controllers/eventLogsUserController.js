const EventLogsUser = require('../models/EventLogsUser');

// Get all user event logs
exports.getAllEventLogsUser = async (req, res) => {
  try {
    const eventLogsUser = await EventLogsUser.find();
    res.json(eventLogsUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get event logs by user DID
exports.getEventLogsUserByUser = async (req, res) => {
  try {
    const eventLogsUser = await EventLogsUser.find({ user_did: req.params.userDid });
    res.json(eventLogsUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get event logs by event type
exports.getEventLogsUserByEventType = async (req, res) => {
  try {
    const eventLogsUser = await EventLogsUser.find({ event_type: req.params.eventType });
    res.json(eventLogsUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get event logs by resource type
exports.getEventLogsUserByResourceType = async (req, res) => {
  try {
    const eventLogsUser = await EventLogsUser.find({ resource_type: req.params.resourceType });
    res.json(eventLogsUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get unread event logs by user DID
exports.getUnreadEventLogsUserByUser = async (req, res) => {
  try {
    const eventLogsUser = await EventLogsUser.find({
      user_did: req.params.userDid,
      is_read: false
    });
    res.json(eventLogsUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get event logs by date range
exports.getEventLogsUserByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const eventLogsUser = await EventLogsUser.find({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });
    res.json(eventLogsUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new user event log
exports.createEventLogsUser = async (req, res) => {
  const eventLogsUser = new EventLogsUser(req.body);
  try {
    const newEventLogsUser = await eventLogsUser.save();

    // Broadcast notification via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const notificationData = {
        _id: newEventLogsUser._id,
        id: newEventLogsUser._id,
        event_type: newEventLogsUser.event_type,
        message: newEventLogsUser.message,
        resource_type: newEventLogsUser.resource_type,
        resource_id: newEventLogsUser.resource_id,
        timestamp: newEventLogsUser.timestamp,
        is_read: newEventLogsUser.is_read,
        user_did: newEventLogsUser.user_did
      };

      // For support messages, emit to both the sender and admin
      if (['support_employee', 'support_admin', 'support_request'].includes(newEventLogsUser.event_type)) {
        // Emit to the employee (if it's from admin or if it's from employee)
        if (newEventLogsUser.user_did) {
          io.to(newEventLogsUser.user_did).emit('notification', notificationData);
        }
        
        // Also emit to all admin users (broadcast to admin room)
        // Admin users typically join a special room or we can broadcast to all connected sockets
        // For now, we'll emit to a special 'admin' room if it exists, otherwise broadcast to all
        io.emit('support_message', notificationData);
      } else {
        // For other notifications, only emit to the specific user
        if (newEventLogsUser.user_did) {
          io.to(newEventLogsUser.user_did).emit('notification', notificationData);
        }
      }
    }

    res.status(201).json(newEventLogsUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update user event log
exports.updateEventLogsUser = async (req, res) => {
  try {
    const updatedEventLogsUser = await EventLogsUser.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedEventLogsUser) {
      return res.status(404).json({ message: 'User event log not found' });
    }
    res.json(updatedEventLogsUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete user event log
exports.deleteEventLogsUser = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Delete EventLog] Received delete request for ID:', id);
    console.log('[Delete EventLog] Request params:', req.params);
    console.log('[Delete EventLog] Request path:', req.path);
    
    // Validate MongoDB ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('[Delete EventLog] Invalid ID format:', id);
      return res.status(400).json({ message: 'Invalid notification ID format' });
    }
    
    const deletedEventLogsUser = await EventLogsUser.findByIdAndDelete(id);
    if (!deletedEventLogsUser) {
      console.log('[Delete EventLog] Notification not found with ID:', id);
      return res.status(404).json({ message: 'User event log not found' });
    }
    console.log('[Delete EventLog] Successfully deleted notification:', id);
    res.json({ message: 'User event log deleted successfully', deletedId: id });
  } catch (error) {
    console.error('[Delete EventLog] Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mark event log as read
exports.markAsRead = async (req, res) => {
  try {
    const updatedEventLogsUser = await EventLogsUser.findByIdAndUpdate(
      req.params.id,
      { is_read: true },
      { new: true }
    );
    if (!updatedEventLogsUser) {
      return res.status(404).json({ message: 'User event log not found' });
    }
    res.json(updatedEventLogsUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Mark all event logs as read for a user
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await EventLogsUser.updateMany(
      { user_did: req.params.userDid, is_read: false },
      { is_read: true }
    );
    res.json({ message: `${result.modifiedCount} event logs marked as read` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete all read event logs for a user
exports.deleteReadEventLogs = async (req, res) => {
  try {
    const result = await EventLogsUser.deleteMany({
      user_did: req.params.userDid,
      is_read: true
    });
    res.json({ message: `${result.deletedCount} read event logs deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete all event logs for a user (both read and unread)
exports.deleteAllEventLogs = async (req, res) => {
  try {
    const result = await EventLogsUser.deleteMany({
      user_did: req.params.userDid
    });
    res.json({ message: `${result.deletedCount} event logs deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
