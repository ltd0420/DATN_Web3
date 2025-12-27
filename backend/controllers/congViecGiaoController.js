const CongViecGiao = require('../models/CongViecGiao');
const HoSoNhanVien = require('../models/HoSoNhanVien');
const RolesPermissions = require('../models/RolesPermissions');
const AuditLogs = require('../models/AuditLogs');
const EventLogsUser = require('../models/EventLogsUser');
const { payTaskReward } = require('../services/payrollContractService');
const { scheduleAutoApprove, cancelAutoApprove } = require('../services/autoApproveMilestoneService');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// IPFS integration removed due to deprecated package - will use placeholder for now

// Multer setup for file uploads - Support multiple files, max 1GB per file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/tasks');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp + random + original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit per file
  fileFilter: (req, file, cb) => {
    // Allow all file types, but you can restrict if needed
    cb(null, true);
  }
});

// Get all tasks (Admin only)
const getAll = async (req, res) => {
  try {
    // Check if user has admin permissions based on role_id
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || userRole.ten_vai_tro !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied. Admin permissions required.' });
    }

    const congViecGiao = await CongViecGiao.find();
    // Tự động cập nhật trạng thái dựa trên tiến độ cho mỗi task
    const normalizedTasks = congViecGiao.map(task => normalizeTaskStatus(task.toObject()));
    res.json(normalizedTasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get task by ID
const getById = async (req, res) => {
  try {
    const congViecGiao = await CongViecGiao.findOne({ task_id: req.params.id });
    if (!congViecGiao) {
      return res.status(404).json({ message: 'Task not found' });
    }
    // Tự động cập nhật trạng thái dựa trên tiến độ
    const normalizedTask = normalizeTaskStatus(congViecGiao.toObject());
    res.json(normalizedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function để tự động cập nhật trạng thái dựa trên tiến độ (chỉ normalize response, không cập nhật DB)
const normalizeTaskStatus = (task) => {
  // Tạo bản copy để không ảnh hưởng đến object gốc
  const normalizedTask = { ...task };
  
  // Nếu task đã hoàn thành hoặc hủy bỏ thì giữ nguyên
  if (normalizedTask.trang_thai === 'Hoàn thành' || normalizedTask.trang_thai === 'Hủy bỏ') {
    return normalizedTask;
  }

  const tienDo = normalizedTask.tien_do || 0;
  
  // Tự động cập nhật trạng thái dựa trên tiến độ (chỉ trong response)
  if (tienDo > 0 && tienDo < 100) {
    // Tiến độ > 0% và < 100% → Đang thực hiện
    if (normalizedTask.trang_thai !== 'Đang thực hiện') {
      normalizedTask.trang_thai = 'Đang thực hiện';
      // Cập nhật trong database (async, không cần đợi)
      CongViecGiao.findOneAndUpdate(
        { task_id: normalizedTask.task_id },
        { trang_thai: 'Đang thực hiện' },
        { new: false }
      ).catch(err => console.error('Error updating task status:', err));
    }
  } else if (tienDo === 100 && normalizedTask.trang_thai !== 'Chờ review' && normalizedTask.trang_thai !== 'Hoàn thành') {
    // Tiến độ 100% nhưng chưa được phê duyệt → Chờ review
    if (normalizedTask.trang_thai !== 'Chờ review') {
      normalizedTask.trang_thai = 'Chờ review';
      // Cập nhật trong database (async, không cần đợi)
      CongViecGiao.findOneAndUpdate(
        { task_id: normalizedTask.task_id },
        { trang_thai: 'Chờ review' },
        { new: false }
      ).catch(err => console.error('Error updating task status:', err));
    }
  }
  
  return normalizedTask;
};

// Get tasks by employee (assignee) - only return accepted tasks
const getByEmployee = async (req, res) => {
  try {
    const { includePending } = req.query; // Optional query param to include pending tasks
    const query = { nguoi_thuc_hien_did: req.params.employeeDid };
    
    // By default, only return accepted tasks unless includePending is true
    if (!includePending) {
      query.da_dong_y = true;
    }
    
    const congViecGiao = await CongViecGiao.find(query).sort({ createdAt: -1 });
    
    // Tự động cập nhật trạng thái dựa trên tiến độ cho mỗi task
    const normalizedTasks = congViecGiao.map(task => normalizeTaskStatus(task.toObject()));
    
    res.json(normalizedTasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get pending tasks (not yet accepted) for employee
// Bao gồm cả:
//  - Công việc gán trực tiếp cho nhân viên
//  - Công việc giao cho cả phòng ban mà nhân viên thuộc phòng ban đó
const getPendingTasksByEmployee = async (req, res) => {
  try {
    const employeeDid = req.params.employeeDid;

    // Lấy thông tin hồ sơ nhân viên để biết phòng ban
    const employeeProfile = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    const departmentId = employeeProfile?.phong_ban_id;

    console.log(`[getPendingTasksByEmployee] Employee: ${employeeDid}, Department: ${departmentId}`);

    const orConditions = [
      {
        nguoi_thuc_hien_did: employeeDid,
        da_dong_y: false
      }
    ];

    // Nếu nhân viên có phòng ban thì lấy thêm các task giao theo phòng ban
    if (departmentId) {
      orConditions.push({
        phong_ban_id: departmentId,
        is_department_task: true,
        da_dong_y: false
      });
      console.log(`[getPendingTasksByEmployee] Added department task condition for department: ${departmentId}`);
    } else {
      console.log(`[getPendingTasksByEmployee] Employee has no department, only checking direct assignments`);
    }

    // Loại bỏ các task đã bị từ chối (trạng thái "Hủy bỏ") hoặc đã hoàn thành
    const query = { 
      $or: orConditions,
      trang_thai: { 
        $nin: ['Hủy bỏ', 'Hoàn thành', 'Đã hoàn thành'] // Loại bỏ các trạng thái không phải "chờ đồng ý"
      }
    };
    console.log(`[getPendingTasksByEmployee] Query:`, JSON.stringify(query, null, 2));

    const congViecGiao = await CongViecGiao.find(query).sort({ createdAt: -1 });
    
    console.log(`[getPendingTasksByEmployee] Found ${congViecGiao.length} pending tasks`);
    congViecGiao.forEach(task => {
      console.log(`[getPendingTasksByEmployee] Task: ${task.ten_cong_viec}, is_department_task: ${task.is_department_task}, phong_ban_id: ${task.phong_ban_id}`);
    });

    res.json(congViecGiao);
  } catch (error) {
    console.error('[getPendingTasksByEmployee] Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Accept task (employee confirms they accept the task)
// Hỗ trợ cả task gán trực tiếp và task giao cho phòng ban
const acceptTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    const employeeDid = req.user?.employee_did;

    if (!employeeDid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const task = await CongViecGiao.findOne({ task_id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Lấy thông tin nhân viên để kiểm tra phòng ban (cho trường hợp giao theo phòng ban)
    const employeeProfile = await HoSoNhanVien.findOne({ employee_did: employeeDid });
    const employeeDepartmentId = employeeProfile?.phong_ban_id;

    const isDirectAssignedTask = !!task.nguoi_thuc_hien_did && !task.is_department_task;
    const isDepartmentTask = !!task.is_department_task && !!task.phong_ban_id;

    if (isDirectAssignedTask) {
      // Task gán trực tiếp: phải đúng người
    if (task.nguoi_thuc_hien_did !== employeeDid) {
      return res.status(403).json({ message: 'You are not assigned to this task' });
    }
    } else if (isDepartmentTask) {
      // Task giao theo phòng ban: nhân viên phải thuộc phòng ban đó
      if (!employeeDepartmentId || employeeDepartmentId !== task.phong_ban_id) {
        return res.status(403).json({ message: 'Bạn không thuộc phòng ban được giao công việc này' });
      }
    } else {
      // Task không xác định rõ kiểu -> không cho nhận
      return res.status(403).json({ message: 'Task is not available to accept' });
    }

    // Nếu đã có người nhận trước đó
    if (task.da_dong_y) {
      return res.status(400).json({ message: 'Task already accepted by another employee' });
    }

    // Dữ liệu cập nhật khi nhận task
    // Tự động chuyển sang "Đang thực hiện" khi nhân viên đồng ý nhận task
    const updateData = {
        da_dong_y: true,
        ngay_dong_y: new Date(),
      trang_thai: 'Đang thực hiện'
    };

    // Với task phòng ban, khi nhân viên nhận thì gán luôn người thực hiện
    if (isDepartmentTask) {
      updateData.nguoi_thuc_hien_did = employeeDid;
    }

    // Dùng điều kiện da_dong_y: false để tránh 2 người cùng nhận 1 lúc
    const updatedTask = await CongViecGiao.findOneAndUpdate(
      { task_id, da_dong_y: false },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(400).json({ message: 'Task is no longer available to accept' });
    }

    // Log audit
    await AuditLogs.create({
      user_did: employeeDid,
      action: 'ACCEPT',
      resource_type: 'cong_viec_giao',
      resource_id: task_id,
      status: 'Success',
      timestamp: new Date()
    });

    // Notify assigner
    await EventLogsUser.create({
      user_did: task.nguoi_giao_did,
      event_type: 'task_accepted',
      message: `Nhân viên đã đồng ý nhận công việc: "${task.ten_cong_viec}"`,
      resource_type: 'cong_viec_giao',
      resource_id: task_id,
      timestamp: new Date()
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get tasks by assigner
const getByAssigner = async (req, res) => {
  try {
    const congViecGiao = await CongViecGiao.find({ nguoi_giao_did: req.params.assignerDid });
    res.json(congViecGiao);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get tasks by status
const getByStatus = async (req, res) => {
  try {
    const congViecGiao = await CongViecGiao.find({ trang_thai: req.params.status });
    res.json(congViecGiao);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get tasks by priority
const getByPriority = async (req, res) => {
  try {
    const congViecGiao = await CongViecGiao.find({ do_uu_tien: req.params.priority });
    res.json(congViecGiao);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get tasks by department
const getByDepartment = async (req, res) => {
  try {
    const congViecGiao = await CongViecGiao.find({ phong_ban_id: req.params.departmentId });
    res.json(congViecGiao);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get overdue tasks
const getOverdueTasks = async (req, res) => {
  try {
    const today = new Date();
    const congViecGiao = await CongViecGiao.find({
      ngay_ket_thuc_du_kien: { $lt: today },
      trang_thai: { $nin: ['Hoàn thành', 'Hủy bỏ'] }
    });
    res.json(congViecGiao);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new task (Admin/Manager only)
const createTask = async (req, res) => {
  try {
    // Check if user has permission to create tasks based on role_id
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || (userRole.ten_vai_tro !== 'Super Admin' && userRole.ten_vai_tro !== 'Manager')) {
      return res.status(403).json({ message: 'Access denied. Admin or Manager permissions required.' });
    }

    // Validate required fields
    if (!req.body.file_dinh_kem || !Array.isArray(req.body.file_dinh_kem) || req.body.file_dinh_kem.length === 0) {
      return res.status(400).json({ message: 'Công việc phải có ít nhất một tệp đính kèm.' });
    }

    // Calculate potential reward based on difficulty
    const mucDoKho = req.body.muc_do_kho || 'Vừa';
    const ngayKetThucDuKien = req.body.ngay_ket_thuc_du_kien ? new Date(req.body.ngay_ket_thuc_du_kien) : null;
    
    // Calculate potential reward if completed on time
    const rewardRules = {
      'Dễ': { onTime: 5, late: 2.5 },
      'Vừa': { onTime: 15, late: 7.5 },
      'Khó': { onTime: 20, late: 10 }
    };
    const rule = rewardRules[mucDoKho] || rewardRules['Vừa'];
    
    // Ensure new tasks are not accepted by default
    // Tạo task_id hợp lệ nếu chưa có hoặc không đúng format UUID
    let taskId = req.body.task_id;
    if (!taskId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(taskId)) {
      taskId = uuidv4();
      console.log(`[Create Task] Generated new UUID task_id: ${taskId}`);
    }
    
    const taskData = {
      ...req.body,
      task_id: taskId, // Đảm bảo task_id đúng format UUID
      da_dong_y: false,
      ngay_dong_y: null,
      // Pre-calculate potential reward (will be finalized on approval)
      tien_thuong: 0, // Will be set when approved if on time
      tien_phat: 0,   // Will be set when approved if late
      potential_reward: rule.onTime, // Thưởng tối đa khi đúng hạn
      potential_penalty: 0 // Không còn phạt âm, chỉ giảm thưởng khi quá hạn
    };

    // Đảm bảo khi tạo task phòng ban, phong_ban_id được set đúng
    if (taskData.is_department_task && !taskData.phong_ban_id && req.body.phong_ban_id) {
      taskData.phong_ban_id = req.body.phong_ban_id;
      console.log(`[Create Task] Set phong_ban_id for department task: ${taskData.phong_ban_id}`);
    }

    // Đảm bảo is_department_task được set đúng
    if (req.body.is_department_task === true || req.body.is_department_task === 'true') {
      taskData.is_department_task = true;
      // Nếu là task phòng ban thì không gán nguoi_thuc_hien_did (để tất cả nhân viên trong phòng ban có thể nhận)
      // Khi 1 nhân viên accept, sẽ gán nguoi_thuc_hien_did cho nhân viên đó và set da_dong_y = true
      // Các nhân viên khác sẽ không thấy task này nữa vì query filter da_dong_y: false
      if (!taskData.nguoi_thuc_hien_did) {
        taskData.nguoi_thuc_hien_did = null;
      }
      console.log(`[Create Task] Creating department task (shared) for department: ${taskData.phong_ban_id}`);
      
      // Tạo thông báo cho tất cả nhân viên trong phòng ban
      if (taskData.phong_ban_id) {
        const employeesInDepartment = await HoSoNhanVien.find({ 
          phong_ban_id: taskData.phong_ban_id,
          trang_thai: 'Đang làm việc'
        });
        
        console.log(`[Create Task] Notifying ${employeesInDepartment.length} employees in department ${taskData.phong_ban_id}`);
        
        // Tạo event log cho từng nhân viên để họ nhận thông báo
        for (const employee of employeesInDepartment) {
          await EventLogsUser.create({
            user_did: employee.employee_did,
            event_type: 'task_assigned',
            message: `Bạn được giao công việc: "${taskData.ten_cong_viec}" (Giao cho phòng ban - ai nhận trước thì làm)`,
            resource_type: 'cong_viec_giao',
            resource_id: taskId, // Dùng task_id chung
            timestamp: new Date()
          });
        }
      }
    } else {
      taskData.is_department_task = false;
    }

    console.log(`[Create Task] Task data:`, {
      task_id: taskData.task_id || 'will be generated',
      ten_cong_viec: taskData.ten_cong_viec,
      is_department_task: taskData.is_department_task,
      phong_ban_id: taskData.phong_ban_id,
      nguoi_thuc_hien_did: taskData.nguoi_thuc_hien_did
    });

    const congViecGiao = new CongViecGiao(taskData);
    const newCongViecGiao = await congViecGiao.save();
    
    console.log(`[Create Task] Task created: ${newCongViecGiao.task_id}`);
    console.log(`[Create Task] is_department_task: ${newCongViecGiao.is_department_task}, phong_ban_id: ${newCongViecGiao.phong_ban_id}`);
    console.log(`[Create Task] Potential reward if on time: ${rule.onTime} USDT`);
    console.log(`[Create Task] Potential penalty if late: ${Math.abs(rule.late)} USDT`);

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did || req.body.nguoi_giao_did,
      action: 'CREATE',
      resource_type: 'cong_viec_giao',
      resource_id: newCongViecGiao.task_id,
      status: 'Success',
      timestamp: new Date()
    });

    // Create event log for assignee
    await EventLogsUser.create({
      user_did: req.body.nguoi_thuc_hien_did,
      event_type: 'task_assigned',
      message: `Bạn được giao công việc: ${req.body.ten_cong_viec}`,
      resource_type: 'cong_viec_giao',
      resource_id: newCongViecGiao.task_id,
      timestamp: new Date()
    });

    res.status(201).json(newCongViecGiao);
  } catch (error) {
    // Log failed audit
    await AuditLogs.create({
      user_did: req.user?.employee_did || req.body.nguoi_giao_did,
      action: 'CREATE',
      resource_type: 'cong_viec_giao',
      resource_id: req.body.task_id,
      status: 'Failed',
      error_message: error.message,
      timestamp: new Date()
    });

    res.status(400).json({ message: error.message });
  }
};

// Update task
const update = async (req, res) => {
  try {
    // Find the task first to check ownership
    const task = await CongViecGiao.findOne({ task_id: req.params.id });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has permission to update tasks
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    const isSuperAdmin = userRole && userRole.ten_vai_tro === 'Super Admin';
    const isTaskOwner = task.nguoi_thuc_hien_did === req.user.employee_did;

    // Allow update if:
    // 1. User is Super Admin, OR
    // 2. User is the task owner AND only updating status (for accepting/rejecting tasks)
    const isStatusUpdateOnly = Object.keys(req.body).length === 1 && req.body.trang_thai !== undefined;
    
    if (!isSuperAdmin && !(isTaskOwner && isStatusUpdateOnly)) {
      return res.status(403).json({ 
        message: 'Access denied. Super Admin permissions required or you can only update status of your own tasks.' 
      });
    }

    const updatedCongViecGiao = await CongViecGiao.findOneAndUpdate(
      { task_id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did || req.body.nguoi_giao_did,
      action: 'UPDATE',
      resource_type: 'cong_viec_giao',
      resource_id: req.params.id,
      changes: {
        before: {}, // In a real implementation, you'd compare old vs new
        after: req.body
      },
      status: 'Success',
      timestamp: new Date()
    });

    // Create event log if status changed
    if (req.body.trang_thai) {
      await EventLogsUser.create({
        user_did: updatedCongViecGiao.nguoi_thuc_hien_did,
        event_type: 'task_status_updated',
        message: `Trạng thái công việc "${updatedCongViecGiao.ten_cong_viec}" đã được cập nhật thành: ${req.body.trang_thai}`,
        resource_type: 'cong_viec_giao',
        resource_id: updatedCongViecGiao.task_id,
        timestamp: new Date()
      });
    }

    res.json(updatedCongViecGiao);
  } catch (error) {
    // Log failed audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'UPDATE',
      resource_type: 'cong_viec_giao',
      resource_id: req.params.id,
      status: 'Failed',
      error_message: error.message,
      timestamp: new Date()
    });

    res.status(400).json({ message: error.message });
  }
};

const updateProgress = async (req, res) => {
  try {
    const { tien_do, note, files } = req.body;

    // Validate tien_do: số từ 0 đến 100
    if (typeof tien_do !== 'number' || Number.isNaN(tien_do) || tien_do < 0 || tien_do > 100) {
      return res.status(400).json({
        message: 'Tiến độ phải là một số từ 0 đến 100'
      });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'Vui lòng đính kèm ít nhất một tệp khi cập nhật tiến độ.' });
    }

    const task = await CongViecGiao.findOne({ task_id: req.params.id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Kiểm tra nhân viên có quyền cập nhật task này không
    if (task.nguoi_thuc_hien_did !== req.user?.employee_did) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật công việc này' });
    }

    // Xác định trạng thái mới dựa vào tiến độ
    const filesToAttach = files.map((file) => ({
      file_name: file.file_name,
      file_uri: file.file_uri,
      file_type: file.file_type || 'application/octet-stream',
      file_size: file.file_size || 0,
      uploaded_at: file.uploaded_at ? new Date(file.uploaded_at) : new Date(),
      uploaded_by: req.user?.employee_did || null
    }));

    const updateData = {
      tien_do,
      $push: {
        nhan_xet: {
          nguoi_nhan_xet_did: req.user?.employee_did,
          noi_dung: note || `Nhân viên cập nhật tiến độ công việc lên ${tien_do}%`,
          timestamp: new Date()
        },
        file_dinh_kem: { $each: filesToAttach }
      }
    };

    if (tien_do > 0 && tien_do < 100) {
      updateData.trang_thai = 'Đang thực hiện';
    }

    if (tien_do === 100) {
      // Khi nhân viên tự đánh dấu 100%, cho sang trạng thái "Chờ review"
      const completedAt = new Date();
      updateData.trang_thai = 'Chờ review';
      updateData.ngay_hoan_thanh_thuc_te = completedAt;
      // Đặt timer auto-approve sau 2 giờ nếu admin không phê duyệt
      scheduleAutoApprove(task.task_id, completedAt);
    }

    const updatedTask = await CongViecGiao.findOneAndUpdate(
      { task_id: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );

    // Gửi thông báo cho người giao khi có cập nhật tiến độ
    await EventLogsUser.create({
      user_did: updatedTask.nguoi_giao_did,
      event_type: 'task_progress_updated',
      message: `Nhân viên đã cập nhật tiến độ công việc "${updatedTask.ten_cong_viec}" lên ${tien_do}%.`,
      resource_type: 'cong_viec_giao',
      resource_id: updatedTask.task_id,
      timestamp: new Date()
    });

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'UPDATE_PROGRESS',
      resource_type: 'cong_viec_giao',
      resource_id: updatedTask.task_id,
      status: 'Success',
      details: `Cập nhật tiến độ công việc lên ${tien_do}%`,
      timestamp: new Date()
    });

    // Chuẩn hóa trạng thái trước khi trả về
    const normalizedTask = normalizeTaskStatus(updatedTask.toObject());
    res.json(normalizedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Approve progress milestone (Admin only)
const approveProgressMilestone = async (req, res) => {
  try {
    const { task_id, milestone, approve, admin_note } = req.body; // approve: true/false

    // Check if user has admin permissions
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || (userRole.ten_vai_tro !== 'Super Admin' && userRole.ten_vai_tro !== 'Manager')) {
      return res.status(403).json({ message: 'Access denied. Admin or Manager permissions required.' });
    }

    const task = await CongViecGiao.findOne({ task_id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Tìm milestone cần phê duyệt
    const milestoneIndex = task.tien_do_milestones?.findIndex(m => m.milestone === milestone);
    if (milestoneIndex === -1 || milestoneIndex === undefined) {
      return res.status(404).json({ message: `Không tìm thấy mốc tiến độ ${milestone}%` });
    }

    const milestoneData = task.tien_do_milestones[milestoneIndex];
    if (milestoneData.status !== 'pending') {
      return res.status(400).json({ 
        message: `Mốc tiến độ ${milestone}% không ở trạng thái chờ phê duyệt` 
      });
    }

    // Cập nhật milestone
    const updateData = {
      [`tien_do_milestones.${milestoneIndex}.status`]: approve ? 'approved' : 'rejected',
      [`tien_do_milestones.${milestoneIndex}.approved_at`]: approve ? new Date() : null,
      [`tien_do_milestones.${milestoneIndex}.approved_by`]: approve ? req.user.employee_did : null,
      [`tien_do_milestones.${milestoneIndex}.admin_note`]: admin_note || null
    };

    // Nếu approve, clear current_pending_milestone
    if (approve) {
      updateData.current_pending_milestone = null;
      
      // Hủy timer auto-approve nếu admin đã approve thủ công
      if (milestone === 100) {
        cancelAutoApprove(task_id);
      }
      
      // Tự động cập nhật trạng thái dựa trên tiến độ
      if (milestone === 100) {
        // Mốc 100% → Chờ review
        updateData.trang_thai = 'Chờ review';
        // Dùng thời gian submit milestone 100% làm ngày hoàn thành thực tế (không phải thời gian approve)
        const milestone100Data = task.tien_do_milestones?.find(m => m.milestone === 100);
        updateData.ngay_hoan_thanh_thuc_te = milestone100Data?.submitted_at || new Date();
      } else if (milestone > 0 && milestone < 100) {
        // Mốc 25%, 50%, 75% → Đang thực hiện
        updateData.trang_thai = 'Đang thực hiện';
      }
    } else {
      // Nếu reject, reset tien_do về mốc trước đó đã được approve
      const validMilestones = [25, 50, 75, 100];
      const approvedMilestones = task.tien_do_milestones
        .filter(m => m.status === 'approved')
        .map(m => m.milestone)
        .sort((a, b) => a - b);
      
      const lastApprovedMilestone = approvedMilestones.length > 0 
        ? approvedMilestones[approvedMilestones.length - 1] 
        : 0;
      
      updateData.tien_do = lastApprovedMilestone;
      updateData.current_pending_milestone = null;
      
      // Hủy timer auto-approve nếu reject milestone 100%
      if (milestone === 100) {
        cancelAutoApprove(task_id);
      }
    }

    const updatedTask = await CongViecGiao.findOneAndUpdate(
      { task_id },
      updateData,
      { new: true, runValidators: true }
    );

    // Thông báo cho nhân viên
    await EventLogsUser.create({
      user_did: task.nguoi_thuc_hien_did,
      event_type: approve ? 'progress_milestone_approved' : 'progress_milestone_rejected',
      message: approve 
        ? `Mốc tiến độ ${milestone}% của công việc "${task.ten_cong_viec}" đã được phê duyệt${milestone === 100 ? '. Công việc đã hoàn thành và đang chờ thanh toán.' : ''}`
        : `Mốc tiến độ ${milestone}% của công việc "${task.ten_cong_viec}" đã bị từ chối. Vui lòng xem ghi chú và chỉnh sửa.`,
      resource_type: 'cong_viec_giao',
      resource_id: task.task_id,
      timestamp: new Date()
    });

    // Nếu approve mốc 100%, tự động thanh toán
    if (approve && milestone === 100) {
      try {
        // Lấy thời gian submit milestone 100% để tính reward (không phải thời gian approve)
        const milestone100 = task.tien_do_milestones?.find(m => m.milestone === 100);
        const ngayHoanThanhThucTe = milestone100?.submitted_at || updatedTask.ngay_hoan_thanh_thuc_te || new Date();
        
        console.log(`[Progress Milestone Approval] 📅 Thời gian submit milestone 100%: ${milestone100?.submitted_at}`);
        console.log(`[Progress Milestone Approval] 📅 Deadline: ${task.ngay_ket_thuc_du_kien}`);
        console.log(`[Progress Milestone Approval] 📅 Ngày hoàn thành thực tế (dùng để tính reward): ${ngayHoanThanhThucTe}`);
        
        // Calculate reward/penalty dựa trên thời gian submit milestone 100%
        const rewardInfo = calculateTaskReward(
          task.muc_do_kho || 'Vừa',
          task.ngay_ket_thuc_du_kien,
          ngayHoanThanhThucTe
        );
        
        console.log(`[Progress Milestone Approval] 💰 Reward info:`, rewardInfo);

        if (rewardInfo.tien_thuong > 0) {
          console.log(`[Progress Milestone Approval] ==========================================`);
          console.log(`[Progress Milestone Approval] AUTOMATIC PAYMENT INITIATED`);
          console.log(`[Progress Milestone Approval] Task ID: ${task.task_id}`);
          console.log(`[Progress Milestone Approval] Employee DID: ${task.nguoi_thuc_hien_did}`);
          console.log(`[Progress Milestone Approval] Reward Amount: ${rewardInfo.tien_thuong} USDT`);
          console.log(`[Progress Milestone Approval] ==========================================`);

          const paymentResult = await payTaskReward(
            task.nguoi_thuc_hien_did,
            rewardInfo.tien_thuong,
            task.task_id
          );

          if (paymentResult && paymentResult.success) {
      await CongViecGiao.findOneAndUpdate(
              { task_id },
        {
                $set: { 
                  'payment_transaction_hash': paymentResult.transactionHash,
                  'payment_block_number': paymentResult.blockNumber,
                  'payment_timestamp': new Date(),
                  'payment_status': 'completed',
                  'tien_thuong': rewardInfo.tien_thuong,
                  'tien_phat': rewardInfo.tien_phat,
                  'current_pending_milestone': null // Đảm bảo xóa pending milestone
                }
        }
      );

            // Thông báo thanh toán thành công
      await EventLogsUser.create({
              user_did: task.nguoi_thuc_hien_did,
              event_type: 'task_payment_completed',
              message: `✅ Công việc "${task.ten_cong_viec}" đã hoàn thành! Bạn đã nhận ${rewardInfo.tien_thuong} USDT vào ví MetaMask. Transaction: ${paymentResult.transactionHash?.slice(0, 10)}...`,
        resource_type: 'cong_viec_giao',
              resource_id: task.task_id,
        timestamp: new Date()
      });

            console.log(`[Progress Milestone Approval] ✅ PAYMENT SUCCESSFUL!`);
          } else {
            console.error(`[Progress Milestone Approval] ❌ PAYMENT FAILED!`);
            await CongViecGiao.findOneAndUpdate(
              { task_id },
              { 
                $set: { 
                  'payment_status': 'failed',
                  'payment_error': paymentResult?.error || paymentResult?.message || 'Unknown payment error',
                  'tien_thuong': rewardInfo.tien_thuong,
                  'tien_phat': rewardInfo.tien_phat
                }
              }
            );
          }
        }
      } catch (paymentError) {
        console.error('[Progress Milestone Approval] Payment error:', paymentError);
        // Không fail việc phê duyệt nếu payment lỗi
      }
    }

    // Log audit
      await AuditLogs.create({
      user_did: req.user.employee_did,
      action: approve ? 'APPROVE_PROGRESS_MILESTONE' : 'REJECT_PROGRESS_MILESTONE',
        resource_type: 'cong_viec_giao',
      resource_id: task.task_id,
        status: 'Success',
      details: `${approve ? 'Phê duyệt' : 'Từ chối'} mốc tiến độ ${milestone}%`,
      timestamp: new Date()
      });

    // Normalize task status trước khi trả về
    const normalizedTask = normalizeTaskStatus(updatedTask.toObject());
    res.json(normalizedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Calculate reward based on task difficulty and completion status (theo cả ngày + giờ)
// Nghiệp vụ:
// - Hoàn thành ĐÚNG HẠN (thời gian hoàn thành <= deadline): nhận đủ thưởng cơ bản
// - Hoàn thành QUÁ HẠN (hoàn thành sau deadline): nhận 50% thưởng cơ bản, không bị phạt
const calculateTaskReward = (mucDoKho, ngayKetThucDuKien, ngayHoanThanhThucTe) => {
  if (!ngayKetThucDuKien || !ngayHoanThanhThucTe) {
    return { tien_thuong: 0, tien_phat: 0 };
  }

  const completedDate = new Date(ngayHoanThanhThucTe);
  const deadlineDate = new Date(ngayKetThucDuKien);
  
  // Đúng hạn nếu hoàn thành <= deadline (tính cả giờ phút)
  const isOnTime = completedDate.getTime() <= deadlineDate.getTime();
  
  // Base reward (thưởng cơ bản)
  const baseReward = {
    'Dễ': 5,
    'Vừa': 15,
    'Khó': 20
  };

  // Thưởng thêm khi đúng hạn
  const onTimeBonus = {
    'Dễ': 3,
    'Vừa': 5,
    'Khó': 8
  };

  const baseRewardAmount = baseReward[mucDoKho] || baseReward['Vừa'];
  const lateRewardAmount = baseRewardAmount / 2;
  
  if (isOnTime) {
    // Đúng hạn: nhận đủ thưởng cơ bản
    return { tien_thuong: baseRewardAmount, tien_phat: 0 };
  }

  // Quá hạn: nhận 50% thưởng cơ bản, không bị phạt tiền
  return { tien_thuong: lateRewardAmount, tien_phat: 0 };
};

// Approve task completion
const approveTask = async (req, res) => {
  try {
    const { danh_gia_chat_luong, diem_danh_gia, nhan_xet_nguoi_giao } = req.body;

    // Get task before update to check completion status
    const taskBeforeUpdate = await CongViecGiao.findOne({ task_id: req.params.id });
    if (!taskBeforeUpdate) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Calculate reward/penalty
    // Nếu task đã có ngay_hoan_thanh_thuc_te, dùng nó; nếu không dùng thời gian hiện tại
    let ngayHoanThanhThucTe = taskBeforeUpdate.ngay_hoan_thanh_thuc_te || new Date();
    
    console.log(`[Task Approval] 📅 Ngày hoàn thành thực tế (dùng để tính reward): ${ngayHoanThanhThucTe}`);
    console.log(`[Task Approval] 📅 Deadline: ${taskBeforeUpdate.ngay_ket_thuc_du_kien}`);
    
    const rewardInfo = calculateTaskReward(
      taskBeforeUpdate.muc_do_kho || 'Vừa',
      taskBeforeUpdate.ngay_ket_thuc_du_kien,
      ngayHoanThanhThucTe
    );
    
    console.log(`[Task Approval] 💰 Reward info:`, rewardInfo);

    const updatedTask = await CongViecGiao.findOneAndUpdate(
      { task_id: req.params.id },
      {
        trang_thai: 'Hoàn thành',
        // Cập nhật ngay_hoan_thanh_thuc_te với thời gian đã tính toán (có thể là từ milestone 100%)
        ngay_hoan_thanh_thuc_te: ngayHoanThanhThucTe,
        danh_gia_chat_luong,
        diem_danh_gia,
        nhan_xet_nguoi_giao,
        tien_thuong: rewardInfo.tien_thuong,
        tien_phat: rewardInfo.tien_phat,
        $push: {
          nhan_xet: {
            nguoi_nhan_xet_did: req.user?.employee_did,
            noi_dung: nhan_xet_nguoi_giao || `Công việc đã được phê duyệt bởi ${req.user?.employee_did}. ${rewardInfo.tien_thuong > 0 ? `Thưởng: ${rewardInfo.tien_thuong} USDT` : rewardInfo.tien_phat > 0 ? `Phạt: ${rewardInfo.tien_phat} USDT` : ''}`,
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // AUTOMATIC PAYMENT: Transfer reward to employee wallet via smart contract
    // This happens automatically when task is approved
    let paymentResult = null;
    if (rewardInfo.tien_thuong > 0) {
      try {
        console.log(`[Task Approval] ==========================================`);
        console.log(`[Task Approval] AUTOMATIC PAYMENT INITIATED`);
        console.log(`[Task Approval] ==========================================`);
        console.log(`[Task Approval] Task ID: ${updatedTask.task_id}`);
        console.log(`[Task Approval] Employee DID: ${updatedTask.nguoi_thuc_hien_did}`);
        console.log(`[Task Approval] Reward Amount: ${rewardInfo.tien_thuong} USDT`);
        console.log(`[Task Approval] Contract Address: ${process.env.HR_PAYROLL_ADDRESS || '0xfAFaf2532b6148fA52e3ff0453dEcc85417bb33E'}`);
        console.log(`[Task Approval] ==========================================`);
        
        // Execute automatic payment from contract to employee wallet
        try {
        paymentResult = await payTaskReward(
          updatedTask.nguoi_thuc_hien_did,
          rewardInfo.tien_thuong,
          updatedTask.task_id
        );

        console.log(`[Task Approval] Payment execution result:`, JSON.stringify(paymentResult, null, 2));
        } catch (paymentError) {
          // Re-throw để được catch ở block ngoài với error handling tốt hơn
          console.error(`[Task Approval] Payment function threw error:`, paymentError);
          throw paymentError;
        }

        // Update task with transaction hash if payment successful
        if (paymentResult && paymentResult.success) {
          await CongViecGiao.findOneAndUpdate(
            { task_id: req.params.id },
            { 
              $set: { 
                'payment_transaction_hash': paymentResult.transactionHash,
                'payment_block_number': paymentResult.blockNumber,
                'payment_timestamp': new Date(),
                'payment_status': 'completed'
              }
            }
          );
          console.log(`[Task Approval] ✅ PAYMENT SUCCESSFUL!`);
          console.log(`[Task Approval] Transaction Hash: ${paymentResult.transactionHash}`);
          console.log(`[Task Approval] Block Number: ${paymentResult.blockNumber}`);
          console.log(`[Task Approval] Amount Transferred: ${rewardInfo.tien_thuong} USDT`);
          console.log(`[Task Approval] Employee Wallet: ${paymentResult.employeeWallet}`);
        } else {
          console.error(`[Task Approval] ❌ PAYMENT FAILED!`);
          console.error(`[Task Approval] Error:`, paymentResult?.message || paymentResult?.error || 'Unknown error');
          console.error(`[Task Approval] Details:`, paymentResult?.details || 'N/A');
          
          // Update task with payment failure status
          await CongViecGiao.findOneAndUpdate(
            { task_id: req.params.id },
            { 
              $set: { 
                'payment_status': 'failed',
                'payment_error': paymentResult?.error || paymentResult?.message || 'Unknown payment error'
              }
            }
          );
        }
        console.log(`[Task Approval] ==========================================`);
      } catch (paymentError) {
        console.error('[Task Approval] ==========================================');
        console.error('[Task Approval] ❌ PAYMENT EXCEPTION!');
        console.error('[Task Approval] ==========================================');
        console.error('[Task Approval] Error:', paymentError.message);
        console.error('[Task Approval] Stack:', paymentError.stack);
        console.error('[Task Approval] Code:', paymentError.code);
        console.error('[Task Approval] Reason:', paymentError.reason);
        console.error('[Task Approval] Data:', paymentError.data);
        console.error('[Task Approval] Full Error:', JSON.stringify(paymentError, Object.getOwnPropertyNames(paymentError)));
        console.error('[Task Approval] ==========================================');
        
        // Extract detailed error message
        let errorMessage = paymentError.message || paymentError.reason || 'Unknown payment error';
        let errorDetails = paymentError.code || 'N/A';
        
        // Try to extract more details from error
        if (paymentError.error) {
          if (typeof paymentError.error === 'string') {
            errorMessage = paymentError.error;
          } else if (paymentError.error.message) {
            errorMessage = paymentError.error.message;
          }
        }
        
        // Check for common error patterns
        if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
          errorMessage = 'Contract không có đủ token balance. Vui lòng nạp token vào contract.';
        } else if (errorMessage.includes('wallet address not found')) {
          errorMessage = 'Nhân viên chưa có wallet address. Vui lòng thêm wallet address vào profile nhân viên.';
        } else if (errorMessage.includes('Only Admin')) {
          errorMessage = 'Private key không phải admin của contract. Kiểm tra HR_PAYROLL_PRIVATE_KEY trong .env';
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
          errorMessage = 'Không thể kết nối đến blockchain. Kiểm tra RPC_URL trong .env';
        } else if (errorMessage.includes('gas')) {
          errorMessage = 'Không đủ ETH để trả gas fees. Nạp Sepolia ETH vào signer wallet.';
        } else if (errorMessage.includes('already known') || errorMessage.includes('nonce') || errorMessage.includes('replacement')) {
          errorMessage = 'Lỗi nonce: Có transaction đang pending. Hệ thống sẽ tự động retry. Nếu vẫn lỗi, vui lòng đợi vài giây rồi thử lại.';
        }
        
        // Log error but don't fail the approval
        // The reward amount is still recorded in the database
        paymentResult = {
          success: false,
          error: errorMessage,
          details: errorDetails,
          fullError: paymentError.message,
          stack: process.env.NODE_ENV === 'development' ? paymentError.stack : undefined
        };
        
        // Update task with payment failure status
        await CongViecGiao.findOneAndUpdate(
          { task_id: req.params.id },
          { 
            $set: { 
              'payment_status': 'failed',
              'payment_error': errorMessage
            }
          }
        );
      }
    } else if (rewardInfo.tien_phat > 0) {
      console.log(`[Task Approval] Task completed late - Penalty: ${rewardInfo.tien_phat} USDT (No payment, penalty only)`);
    } else {
      console.log(`[Task Approval] No reward or penalty (tien_thuong: ${rewardInfo.tien_thuong}, tien_phat: ${rewardInfo.tien_phat})`);
    }

    // Notify assignee
    let rewardMessage = '';
    if (rewardInfo.tien_thuong > 0) {
      if (paymentResult && paymentResult.success) {
        rewardMessage = `Công việc "${updatedTask.ten_cong_viec}" đã được phê duyệt. Bạn được thưởng ${rewardInfo.tien_thuong} USDT và đã được chuyển vào ví MetaMask của bạn! Transaction: ${paymentResult.transactionHash}`;
      } else {
        rewardMessage = `Công việc "${updatedTask.ten_cong_viec}" đã được phê duyệt. Bạn được thưởng ${rewardInfo.tien_thuong} USDT. ${paymentResult?.error ? `Lỗi chuyển tiền: ${paymentResult.error}` : 'Đang xử lý chuyển tiền...'}`;
      }
    } else if (rewardInfo.tien_phat > 0) {
      rewardMessage = `Công việc "${updatedTask.ten_cong_viec}" đã được phê duyệt nhưng quá hạn. Bạn bị phạt ${rewardInfo.tien_phat} USDT.`;
    } else {
      rewardMessage = `Công việc "${updatedTask.ten_cong_viec}" đã được phê duyệt.`;
    }

    await EventLogsUser.create({
      user_did: updatedTask.nguoi_thuc_hien_did,
      event_type: 'task_approved',
      message: rewardMessage,
      resource_type: 'cong_viec_giao',
      resource_id: updatedTask.task_id,
      timestamp: new Date()
    });

    // Return task with payment info
    const taskWithPayment = await CongViecGiao.findOne({ task_id: req.params.id });
    const response = {
      ...taskWithPayment.toObject(),
      paymentResult: paymentResult || null,
      tien_thuong: rewardInfo.tien_thuong,
      tien_phat: rewardInfo.tien_phat
    };

    // Add warning if payment failed but task was approved
    if (rewardInfo.tien_thuong > 0 && (!paymentResult || !paymentResult.success)) {
      response.paymentWarning = true;
      response.paymentError = paymentResult?.error || paymentResult?.message || 'Payment failed. Please check contract balance.';
      response.paymentDetails = paymentResult?.details || null;
    }

    // Add transaction link for successful payments
    if (paymentResult && paymentResult.success && paymentResult.transactionHash) {
      response.transactionLink = `https://sepolia.etherscan.io/tx/${paymentResult.transactionHash}`;
      response.employeeWallet = paymentResult.employeeWallet;
      response.tokenSymbol = paymentResult.tokenSymbol || 'TUSD';
    }

    res.json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete task (Admin only)
const deleteTask = async (req, res) => {
  try {
    // Find the task first to check ownership
    const task = await CongViecGiao.findOne({ task_id: req.params.id });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Không cho xóa task đang làm hoặc đang chờ review
    if (task.trang_thai === 'Đang thực hiện' || task.trang_thai === 'Chờ review') {
      return res.status(400).json({ message: 'Không thể xóa công việc đang thực hiện hoặc đang chờ review.' });
    }

    // Check permissions: Admin can delete any task, Employee can only delete their own tasks
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    const isAdmin = userRole && (userRole.ten_vai_tro === 'Super Admin' || userRole.ten_vai_tro === 'Manager');
    
    // If not admin, check if user is the assignee or creator
    if (!isAdmin) {
      const isAssignee = task.nguoi_thuc_hien_did === req.user.employee_did;
      const isCreator = task.nguoi_giao_did === req.user.employee_did;
      
      if (!isAssignee && !isCreator) {
        return res.status(403).json({ message: 'Access denied. You can only delete your own tasks.' });
    }
    }

    // Delete task directly from database
    const deletedTask = await CongViecGiao.findOneAndDelete({ task_id: req.params.id });

    if (!deletedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'DELETE',
      resource_type: 'cong_viec_giao',
      resource_id: req.params.id,
      status: 'Success',
      timestamp: new Date()
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    // Log failed audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'DELETE',
      resource_type: 'cong_viec_giao',
      resource_id: req.params.id,
      status: 'Failed',
      error_message: error.message,
      timestamp: new Date()
    });

    res.status(500).json({ message: error.message });
  }
};

// Get task statistics
const getTaskStats = async (req, res) => {
  try {
    const stats = await CongViecGiao.aggregate([
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Hoàn thành'] }, 1, 0] }
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Đang thực hiện'] }, 1, 0] }
          },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$ngay_ket_thuc_du_kien', new Date()] },
                    { $nin: ['$trang_thai', ['Hoàn thành', 'Hủy bỏ']] }
                  ]
                },
                1,
                0
              ]
            }
          },
          avgProgress: { $avg: '$tien_do' }
        }
      }
    ]);

    res.json(stats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      overdueTasks: 0,
      avgProgress: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload single file
const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // File is saved to disk by multer, get the path
    const filePath = file.path;
    const fileUrl = `/api/tasks/files/${path.basename(filePath)}`;

    res.json({
      success: true,
      file_name: file.originalname,
      file_uri: fileUrl,
      file_path: filePath,
      file_type: file.mimetype,
      file_size: file.size,
      uploaded_at: new Date()
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'File upload failed', error: error.message });
  }
};

// Upload multiple files
const uploadMultipleFiles = async (req, res) => {
  try {
    console.log('[uploadMultipleFiles] Request received');
    console.log('[uploadMultipleFiles] req.files:', req.files);
    console.log('[uploadMultipleFiles] req.body:', req.body);
    console.log('[uploadMultipleFiles] Content-Type:', req.headers['content-type']);
    
    const files = req.files;
    if (!files || files.length === 0) {
      console.error('[uploadMultipleFiles] No files in req.files');
      return res.status(400).json({ message: 'No files provided', details: 'req.files is empty or undefined' });
    }

    const uploadedFiles = files.map(file => {
      // Preserve original filename with proper encoding
      const originalName = file.originalname;
      const savedFilename = path.basename(file.path);
      
      return {
        file_name: originalName, // Keep original filename with Vietnamese characters
        file_uri: `/api/tasks/files/${encodeURIComponent(savedFilename)}`, // Encode saved filename in URI
        file_path: file.path,
        file_type: file.mimetype || file.mimetype || 'application/octet-stream',
        file_size: file.size,
        uploaded_at: new Date()
      };
    });

    res.json({
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    });
  } catch (error) {
    console.error('Multiple files upload error:', error);
    res.status(500).json({ message: 'Files upload failed', error: error.message });
  }
};

// Attach file(s) to task
const attachFileToTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    const { files } = req.body; // Array of file objects

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    // Validate required fields
    if (!task_id) {
      return res.status(400).json({ message: 'Task ID is required' });
    }
    
    // Check if task exists
    const existingTask = await CongViecGiao.findOne({ task_id });
    if (!existingTask) {
      console.error('Task not found:', task_id);
      return res.status(404).json({ message: 'Task not found', task_id });
    }
    
    // Prepare files array with all required fields
    const filesToAttach = files.map(file => {
      // Validate required fields
      if (!file.file_name || !file.file_uri || !file.file_type) {
        throw new Error(`File missing required fields: ${JSON.stringify(file)}`);
      }
      
      const fileObj = {
        file_name: file.file_name,
        file_uri: file.file_uri,
        file_type: file.file_type,
        file_size: file.file_size || 0,
        uploaded_at: file.uploaded_at 
          ? (file.uploaded_at instanceof Date ? file.uploaded_at : new Date(file.uploaded_at))
          : new Date()
      };
      // Add uploaded_by if provided (optional field)
      if (file.uploaded_by) {
        fileObj.uploaded_by = file.uploaded_by;
      }
      return fileObj;
    });
    
    console.log('Attaching files to task:', { task_id, filesCount: filesToAttach.length });

    const updatedTask = await CongViecGiao.findOneAndUpdate(
      { task_id },
      {
        $push: {
          file_dinh_kem: { $each: filesToAttach }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'ATTACH_FILE',
      resource_type: 'cong_viec_giao',
      resource_id: task_id,
      status: 'Success',
      timestamp: new Date()
    });

    res.json({ message: 'Files attached to task successfully', task: updatedTask });
  } catch (error) {
    console.error('Attach file error:', error);
    res.status(500).json({ message: 'Failed to attach files', error: error.message });
  }
};

// Download file
const downloadFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(__dirname, '../uploads/tasks', decodedFilename);

    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ message: 'File not found' });
    }

    // Get original filename from database if available
    const originalFilename = decodedFilename;
    
    // Set proper headers for file download with UTF-8 encoding
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalFilename)}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    res.download(filePath, originalFilename, (err) => {
      if (err) {
        console.error('File download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to download file' });
        }
      }
    });
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ message: 'Failed to download file', error: error.message });
  }
};

// Delete file from task
const deleteFileFromTask = async (req, res) => {
  try {
    const { task_id, file_uri } = req.params;

    // Find task to get file info
    const task = await CongViecGiao.findOne({ task_id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Find the file in task
    const fileToDelete = task.file_dinh_kem.find(f => f.file_uri === decodeURIComponent(file_uri));
    if (!fileToDelete) {
      return res.status(404).json({ message: 'File not found in task' });
    }

    // Chỉ cho phép xóa tệp do chính người dùng hiện tại upload
    if (fileToDelete.uploaded_by && fileToDelete.uploaded_by !== req.user?.employee_did) {
      return res.status(403).json({ message: 'Bạn chỉ có thể xóa tệp do chính bạn tải lên.' });
    }

    // Delete file from disk
    const filename = path.basename(fileToDelete.file_uri);
    const filePath = path.join(__dirname, '../uploads/tasks', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove file from task
    const updatedTask = await CongViecGiao.findOneAndUpdate(
      { task_id },
      {
        $pull: {
          file_dinh_kem: { file_uri: fileToDelete.file_uri }
        }
      },
      { new: true }
    );

    // Log audit
    await AuditLogs.create({
      user_did: req.user?.employee_did,
      action: 'DELETE_FILE',
      resource_type: 'cong_viec_giao',
      resource_id: task_id,
      status: 'Success',
      timestamp: new Date()
    });

    res.json({ message: 'File deleted successfully', task: updatedTask });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
};

// Generate AI insights for task
const generateAiInsights = async (req, res) => {
  try {
    const { task_id } = req.params;

    const task = await CongViecGiao.findOne({ task_id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Simple AI logic (in a real implementation, this would call an AI service)
    const today = new Date();
    const deadline = new Date(task.ngay_ket_thuc_du_kien);
    const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    let riskLevel = 'Thấp';
    let workloadScore = 50;
    const recommendations = [];

    // Risk assessment logic
    if (daysUntilDeadline < 0) {
      riskLevel = 'Cao';
      workloadScore = 90;
      recommendations.push('Công việc đã quá hạn, cần ưu tiên xử lý ngay');
    } else if (daysUntilDeadline <= 3) {
      riskLevel = 'Cao';
      workloadScore = 80;
      recommendations.push('Deadline sắp đến, cần tăng tốc độ thực hiện');
    } else if (daysUntilDeadline <= 7) {
      riskLevel = 'Trung bình';
      workloadScore = 65;
      recommendations.push('Cần theo dõi sát sao tiến độ công việc');
    }

    if (task.do_uu_tien === 'Khẩn cấp') {
      riskLevel = 'Cao';
      workloadScore += 20;
      recommendations.push('Đây là công việc ưu tiên cao, cần tập trung nguồn lực');
    }

    if (task.tien_do < 30 && daysUntilDeadline < 14) {
      recommendations.push('Tiến độ chậm, cần điều chỉnh kế hoạch thực hiện');
    }

    // Calculate predicted completion date
    const progressRate = task.tien_do / 100;
    const estimatedDaysLeft = task.gio_uoc_tinh ? (task.gio_uoc_tinh * (1 - progressRate)) / 8 : daysUntilDeadline;
    const predictedCompletionDate = new Date(today.getTime() + (estimatedDaysLeft * 24 * 60 * 60 * 1000));

    const aiInsights = {
      risk_level: riskLevel,
      predicted_completion_date: predictedCompletionDate,
      workload_score: Math.min(workloadScore, 100),
      recommendations
    };

    // Update task with AI insights
    const updatedTask = await CongViecGiao.findOneAndUpdate(
      { task_id },
      { ai_insights: aiInsights },
      { new: true, runValidators: true }
    );

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk create tasks
const bulkCreate = async (req, res) => {
  try {
    // Check if user has permission to create tasks based on role_id
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || (userRole.ten_vai_tro !== 'Super Admin' && userRole.ten_vai_tro !== 'Manager')) {
      return res.status(403).json({ message: 'Access denied. Admin or Manager permissions required.' });
    }

    const tasks = req.body.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: 'Tasks array is required' });
    }

    const createdTasks = [];
    const errors = [];

    for (let i = 0; i < tasks.length; i++) {
      try {
        const taskData = {
          ...tasks[i],
          nguoi_giao_did: req.user.employee_did,
          task_id: `task_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
          trang_thai: 'Chờ bắt đầu',
          tien_do: 0
        };

        const congViecGiao = new CongViecGiao(taskData);
        const newTask = await congViecGiao.save();
        createdTasks.push(newTask);

        // Create event log for assignee
        await EventLogsUser.create({
          user_did: taskData.nguoi_thuc_hien_did,
          event_type: 'task_assigned',
          message: `Bạn được giao công việc: ${taskData.ten_cong_viec}`,
          resource_type: 'cong_viec_giao',
          resource_id: newTask.task_id,
          timestamp: new Date()
        });
      } catch (error) {
        errors.push({ index: i, error: error.message });
      }
    }

    // Log audit
    await AuditLogs.create({
      user_did: req.user.employee_did,
      action: 'BULK_CREATE',
      resource_type: 'cong_viec_giao',
      resource_id: 'bulk_operation',
      status: errors.length === 0 ? 'Success' : 'Partial',
      timestamp: new Date(),
      details: { created: createdTasks.length, errors: errors.length }
    });

    res.status(201).json({
      message: `Created ${createdTasks.length} tasks${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      createdTasks,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk update tasks
const bulkUpdate = async (req, res) => {
  try {
    const { task_ids, updates } = req.body;

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({ message: 'Task IDs array is required' });
    }

    const updatedTasks = [];
    const errors = [];

    for (const taskId of task_ids) {
      try {
        const updatedTask = await CongViecGiao.findOneAndUpdate(
          { task_id: taskId },
          updates,
          { new: true, runValidators: true }
        );

        if (updatedTask) {
          updatedTasks.push(updatedTask);
        } else {
          errors.push({ task_id: taskId, error: 'Task not found' });
        }
      } catch (error) {
        errors.push({ task_id: taskId, error: error.message });
      }
    }

    // Log audit
    await AuditLogs.create({
      user_did: req.user.employee_did,
      action: 'BULK_UPDATE',
      resource_type: 'cong_viec_giao',
      resource_id: 'bulk_operation',
      status: errors.length === 0 ? 'Success' : 'Partial',
      timestamp: new Date(),
      details: { updated: updatedTasks.length, errors: errors.length }
    });

    res.json({
      message: `Updated ${updatedTasks.length} tasks${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      updatedTasks,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk delete tasks
const bulkDelete = async (req, res) => {
  try {
    // Check if user has admin permissions based on role_id
    const userRole = await RolesPermissions.findOne({ role_id: req.user.role_id });
    if (!userRole || userRole.ten_vai_tro !== 'Super Admin') {
      return res.status(403).json({ message: 'Access denied. Admin permissions required.' });
    }

    const { task_ids } = req.body;

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({ message: 'Task IDs array is required' });
    }

    const deletedTasks = [];
    const errors = [];

    for (const taskId of task_ids) {
      try {
        const deletedTask = await CongViecGiao.findOneAndDelete({ task_id: taskId });
        if (deletedTask) {
          deletedTasks.push(deletedTask);
        } else {
          errors.push({ task_id: taskId, error: 'Task not found' });
        }
      } catch (error) {
        errors.push({ task_id: taskId, error: error.message });
      }
    }

    // Log audit
    await AuditLogs.create({
      user_did: req.user.employee_did,
      action: 'BULK_DELETE',
      resource_type: 'cong_viec_giao',
      resource_id: 'bulk_operation',
      status: errors.length === 0 ? 'Success' : 'Partial',
      timestamp: new Date(),
      details: { deleted: deletedTasks.length, errors: errors.length }
    });

    res.json({
      message: `Deleted ${deletedTasks.length} tasks${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      deletedTasks,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get detailed task statistics
const getDetailedTaskStats = async (req, res) => {
  try {
    const stats = await CongViecGiao.aggregate([
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Hoàn thành'] }, 1, 0] }
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Đang thực hiện'] }, 1, 0] }
          },
          pendingTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Chờ bắt đầu'] }, 1, 0] }
          },
          reviewTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Chờ review'] }, 1, 0] }
          },
          pausedTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Tạm dừng'] }, 1, 0] }
          },
          cancelledTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Hủy bỏ'] }, 1, 0] }
          },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$ngay_ket_thuc_du_kien', new Date()] },
                    { $nin: ['$trang_thai', ['Hoàn thành', 'Hủy bỏ']] }
                  ]
                },
                1,
                0
              ]
            }
          },
          avgProgress: { $avg: '$tien_do' },
          avgEstimatedHours: { $avg: '$gio_uoc_tinh' },
          totalEstimatedHours: { $sum: '$gio_uoc_tinh' },
          highPriorityTasks: {
            $sum: { $cond: [{ $eq: ['$do_uu_tien', 'Cao'] }, 1, 0] }
          },
          urgentTasks: {
            $sum: { $cond: [{ $eq: ['$do_uu_tien', 'Khẩn cấp'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          completionRate: {
            $multiply: [
              { $divide: ['$completedTasks', { $max: ['$totalTasks', 1] }] },
              100
            ]
          },
          overdueRate: {
            $multiply: [
              { $divide: ['$overdueTasks', { $max: ['$totalTasks', 1] }] },
              100
            ]
          }
        }
      }
    ]);

    // Get priority distribution
    const priorityStats = await CongViecGiao.aggregate([
      {
        $group: {
          _id: '$do_uu_tien',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get department stats
    const departmentStats = await CongViecGiao.aggregate([
      {
        $match: { phong_ban_id: { $ne: null } }
      },
      {
        $group: {
          _id: '$phong_ban_id',
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$trang_thai', 'Hoàn thành'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          completionRate: {
            $multiply: [
              { $divide: ['$completedTasks', { $max: ['$totalTasks', 1] }] },
              100
            ]
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      reviewTasks: 0,
      pausedTasks: 0,
      cancelledTasks: 0,
      overdueTasks: 0,
      avgProgress: 0,
      avgEstimatedHours: 0,
      totalEstimatedHours: 0,
      highPriorityTasks: 0,
      urgentTasks: 0,
      completionRate: 0,
      overdueRate: 0
    };

    res.json({
      overview: result,
      priorityDistribution: priorityStats,
      departmentStats: departmentStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAll,
  getById,
  getByEmployee,
  getPendingTasksByEmployee,
  getByAssigner,
  getByStatus,
  getByPriority,
  getByDepartment,
  getOverdueTasks,
  create: createTask,
  update,
  acceptTask,
  updateProgress,
  approveProgressMilestone,
  approveTask,
  delete: deleteTask,
  getTaskStats,
  uploadFile,
  uploadMultipleFiles,
  attachFileToTask,
  downloadFile,
  deleteFileFromTask,
  generateAiInsights,
  bulkCreate,
  bulkUpdate,
  bulkDelete,
  getDetailedTaskStats
};
