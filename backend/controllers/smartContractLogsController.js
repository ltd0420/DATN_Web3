const SmartContractLogs = require('../models/SmartContractLogs');
const HoSoNhanVien = require('../models/HoSoNhanVien');

// Get all smart contract logs with filters
exports.getAllSmartContractLogs = async (req, res) => {
  try {
    const {
      department_id,
      employee_did,
      function_name,
      status,
      start_date,
      end_date,
      search
    } = req.query;

    // Build query
    let query = {};

    // Filter by function name
    if (function_name) {
      query.function_name = function_name;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) {
        query.timestamp.$gte = new Date(start_date);
      }
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endDate;
      }
    }

    // Get all logs matching basic filters
    let smartContractLogs = await SmartContractLogs.find(query).sort({ timestamp: -1 });

    // Filter by employee or department (requires checking employee data)
    if (employee_did || department_id) {
      // Get employee DIDs to filter
      let employeeDids = [];
      
      if (employee_did) {
        employeeDids = [employee_did];
      } else if (department_id) {
        const employees = await HoSoNhanVien.find({ phong_ban_id: department_id });
        employeeDids = employees.map(emp => emp.employee_did);
      }

      // Filter logs by employee DID in parameters
      smartContractLogs = smartContractLogs.filter(log => {
        const logEmployeeDid = log.parameters?.employeeDid || 
                              log.parameters?.employee_did ||
                              log.event_logs?.find(e => e.data?.employeeDid || e.data?.employee_did)?.data?.employeeDid ||
                              log.event_logs?.find(e => e.data?.employeeDid || e.data?.employee_did)?.data?.employee_did;
        return employeeDids.includes(logEmployeeDid);
      });
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      smartContractLogs = smartContractLogs.filter(log => {
        return (
          log.transaction_hash?.toLowerCase().includes(searchLower) ||
          log.function_name?.toLowerCase().includes(searchLower) ||
          (log.parameters?.employeeDid || log.parameters?.employee_did)?.toLowerCase().includes(searchLower) ||
          log.contract_address?.toLowerCase().includes(searchLower)
        );
      });
    }

    res.json({ 
      message: 'Smart contract logs retrieved successfully',
      data: smartContractLogs 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get logs by transaction hash
exports.getSmartContractLogsByTxHash = async (req, res) => {
  try {
    const smartContractLogs = await SmartContractLogs.find({ transaction_hash: req.params.txHash });
    res.json(smartContractLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get logs by contract address
exports.getSmartContractLogsByContract = async (req, res) => {
  try {
    const smartContractLogs = await SmartContractLogs.find({ contract_address: req.params.contractAddress });
    res.json(smartContractLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get logs by event type
exports.getSmartContractLogsByEvent = async (req, res) => {
  try {
    const smartContractLogs = await SmartContractLogs.find({ event_type: req.params.eventType });
    res.json(smartContractLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get logs by block range
exports.getSmartContractLogsByBlockRange = async (req, res) => {
  try {
    const { startBlock, endBlock } = req.params;
    const smartContractLogs = await SmartContractLogs.find({
      block_number: {
        $gte: parseInt(startBlock),
        $lte: parseInt(endBlock)
      }
    });
    res.json(smartContractLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new smart contract log
exports.createSmartContractLogs = async (req, res) => {
  const smartContractLogs = new SmartContractLogs(req.body);
  try {
    const newSmartContractLogs = await smartContractLogs.save();
    res.status(201).json(newSmartContractLogs);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update smart contract log
exports.updateSmartContractLogs = async (req, res) => {
  try {
    const updatedSmartContractLogs = await SmartContractLogs.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedSmartContractLogs) {
      return res.status(404).json({ message: 'Smart contract log not found' });
    }
    res.json(updatedSmartContractLogs);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete smart contract log
exports.deleteSmartContractLogs = async (req, res) => {
  try {
    const deletedSmartContractLogs = await SmartContractLogs.findByIdAndDelete(req.params.id);
    if (!deletedSmartContractLogs) {
      return res.status(404).json({ message: 'Smart contract log not found' });
    }
    res.json({ message: 'Smart contract log deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get logs by employee DID (for employee-related transactions)
exports.getSmartContractLogsByEmployee = async (req, res) => {
  try {
    const smartContractLogs = await SmartContractLogs.find({
      'event_data.employee_did': req.params.employeeDid
    });
    res.json(smartContractLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
