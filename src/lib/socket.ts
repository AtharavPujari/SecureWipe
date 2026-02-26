import { Server } from 'socket.io';
import { deviceDetectionService } from './device-detection';

export const setupSocket = (io: Server) => {
  // Device monitoring state
  let deviceMonitoringActive = false;
  let monitoringInterval: NodeJS.Timeout | null = null;
  let connectedClients: Set<string> = new Set();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    connectedClients.add(socket.id);

    // Send initial device list
    sendDeviceUpdate(socket);

    // Handle device monitoring requests
    socket.on('start-device-monitoring', async () => {
      console.log('Starting device monitoring for client:', socket.id);
      
      if (!deviceMonitoringActive) {
        deviceMonitoringActive = true;
        startDeviceMonitoring(io);
      }
      
      socket.emit('device-monitoring-started', {
        message: 'Device monitoring started',
        timestamp: new Date().toISOString()
      });
    });

    socket.on('stop-device-monitoring', () => {
      console.log('Stopping device monitoring for client:', socket.id);
      
      if (deviceMonitoringActive && connectedClients.size === 1) {
        // Only stop if this is the last client
        deviceMonitoringActive = false;
        stopDeviceMonitoring();
      }
      
      socket.emit('device-monitoring-stopped', {
        message: 'Device monitoring stopped',
        timestamp: new Date().toISOString()
      });
    });

    // Handle device refresh requests
    socket.on('refresh-devices', async () => {
      console.log('Refreshing devices for client:', socket.id);
      await sendDeviceUpdate(socket);
    });

    // Handle device action requests
    socket.on('device-action', async (data) => {
      try {
        const { deviceId, action } = data;
        
        if (!deviceId || !action) {
          socket.emit('device-action-error', {
            error: 'Device ID and action are required',
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Forward to devices API
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, action })
        });

        const result = await response.json();
        
        if (result.success) {
          socket.emit('device-action-success', {
            deviceId,
            action,
            result: result.verification || result.details,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('device-action-error', {
            deviceId,
            action,
            error: result.error,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        socket.emit('device-action-error', {
          error: 'Failed to process device action',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle messages (legacy echo functionality)
    socket.on('message', (msg: { text: string; senderId: string }) => {
      // Echo: broadcast message to the client who sent it
      socket.emit('message', {
        text: `Echo: ${msg.text}`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      connectedClients.delete(socket.id);
      
      // Stop monitoring if no clients are connected
      if (connectedClients.size === 0 && deviceMonitoringActive) {
        deviceMonitoringActive = false;
        stopDeviceMonitoring();
      }
    });

    // Send welcome message
    socket.emit('message', {
      text: 'Welcome to SecureWipe Real-time Monitoring!',
      senderId: 'system',
      timestamp: new Date().toISOString(),
    });
  });

  // Device monitoring functions
  async function sendDeviceUpdate(socket: any) {
    try {
      const devices = await deviceDetectionService.detectDevices();
      socket.emit('devices-updated', {
        devices,
        timestamp: new Date().toISOString(),
        count: devices.length
      });
    } catch (error) {
      socket.emit('devices-error', {
        error: 'Failed to fetch devices',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  function startDeviceMonitoring(io: Server) {
    console.log('Starting real-time device monitoring...');
    
    // Send updates to all connected clients
    const updateAllClients = async () => {
      try {
        const devices = await deviceDetectionService.detectDevices();
        const changes = await deviceDetectionService.getDeviceChanges();
        
        // Only broadcast if there are changes or it's the first update
        if (changes.added.length > 0 || changes.removed.length > 0) {
          io.emit('devices-changed', {
            added: changes.added,
            removed: changes.removed,
            currentDevices: devices,
            timestamp: new Date().toISOString()
          });
        }
        
        // Always send full device list update
        io.emit('devices-updated', {
          devices,
          timestamp: new Date().toISOString(),
          count: devices.length
        });
      } catch (error) {
        io.emit('devices-error', {
          error: 'Failed to monitor devices',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    };

    // Initial update
    updateAllClients();

    // Set up periodic monitoring (every 5 seconds)
    monitoringInterval = setInterval(updateAllClients, 5000);
  }

  function stopDeviceMonitoring() {
    console.log('Stopping real-time device monitoring...');
    
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
  }

  // Clean up on server shutdown
  process.on('SIGTERM', () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
  });

  process.on('SIGINT', () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
  });
};