import { NextRequest, NextResponse } from 'next/server'
import { deviceDetectionService, StorageDevice } from '@/lib/device-detection'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Convert internal device format to API format
function convertToAPIDevice(device: StorageDevice) {
  return {
    id: device.id,
    name: device.name,
    size: device.size,
    type: device.type,
    model: device.model,
    serial: device.serial,
    firmware: device.firmware,
    status: device.status,
    sectors: device.sectors,
    blockSize: device.blockSize,
    path: device.path,
    vendor: device.vendor,
    temperature: device.temperature,
    health: device.health,
    isRemovable: device.isRemovable,
    isSystem: device.isSystem,
    mountPoints: device.mountPoints
  }
}

export async function GET() {
  try {
    // Detect real storage devices
    const devices = await deviceDetectionService.detectDevices()
    
    // Convert to API format
    const apiDevices = devices.map(convertToAPIDevice)
    
    return NextResponse.json({
      success: true,
      devices: apiDevices,
      timestamp: new Date().toISOString(),
      count: apiDevices.length
    })
  } catch (error) {
    console.error('Device detection failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to detect devices',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deviceId, action } = await request.json()
    
    if (!deviceId || !action) {
      return NextResponse.json(
        { success: false, error: 'Device ID and action are required' },
        { status: 400 }
      )
    }

    // Get current devices to find the requested device
    const devices = await deviceDetectionService.detectDevices()
    const device = devices.find(d => d.id === deviceId)
    
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Handle different device actions
    switch (action) {
      case 'verify':
        // Verify device accessibility and readiness
        const isAccessible = await verifyDeviceAccessibility(device.path)
        const isWritable = await verifyDeviceWritable(device.path)
        
        return NextResponse.json({
          success: true,
          device: convertToAPIDevice(device),
          verification: {
            accessible: isAccessible,
            writable: isWritable,
            supportsSecureErase: device.type === 'SSD' || device.type === 'NVMe',
            estimatedTime: estimateWipeTime(device.sizeBytes, device.type)
          }
        })
      
      case 'info':
        // Get detailed device information
        const detailedInfo = await getDetailedDeviceInfo(device)
        
        return NextResponse.json({
          success: true,
          device: convertToAPIDevice(device),
          details: detailedInfo
        })
      
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process device action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper functions for device verification and information
async function verifyDeviceAccessibility(devicePath: string): Promise<boolean> {
  try {
    // Try to read device information
    if (process.platform === 'linux') {
      // Try non-privileged commands first
      const { stdout } = await execAsync(`lsblk ${devicePath}`)
      return !!stdout
    } else if (process.platform === 'win32') {
      // Windows accessibility check
      const { stdout } = await execAsync(`wmic disk where "DeviceID='${devicePath}'" get Status`)
      return stdout.includes('OK')
    } else if (process.platform === 'darwin') {
      await execAsync(`diskutil info ${devicePath}`)
    }
    return true
  } catch (error) {
    console.error('Device accessibility check failed:', error)
    return false
  }
}

async function verifyDeviceWritable(devicePath: string): Promise<boolean> {
  try {
    // Check if device is mounted (if mounted, it might be in use)
    if (process.platform === 'linux') {
      const { stdout } = await execAsync(`lsblk -no MOUNTPOINT ${devicePath}`)
      const mountPoints = stdout.split('\n').filter(mp => mp.trim())
      return mountPoints.length === 0
    } else if (process.platform === 'win32') {
      // Windows writable check
      const { stdout } = await execAsync(`wmic volume where "DriveType=3" get DriveLetter`)
      return !stdout.includes(devicePath)
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`diskutil info ${devicePath} | grep "Mounted"`)
      return !stdout.includes('Yes')
    }
    return true
  } catch (error) {
    console.error('Device writable check failed:', error)
    return false
  }
}

function estimateWipeTime(sizeBytes: number, deviceType: string): string {
  const sizeGB = sizeBytes / (1024 * 1024 * 1024)
  
  // Estimate based on device type and size
  let speedMBps = 100 // Default speed
  
  switch (deviceType) {
    case 'SSD':
    case 'NVMe':
      speedMBps = 500
      break
    case 'HDD':
      speedMBps = 150
      break
    case 'USB':
      speedMBps = 80
      break
    case 'SD':
      speedMBps = 30
      break
  }
  
  const timeSeconds = (sizeGB * 1024) / speedMBps
  
  if (timeSeconds < 60) {
    return `${Math.ceil(timeSeconds)} seconds`
  } else if (timeSeconds < 3600) {
    return `${Math.ceil(timeSeconds / 60)} minutes`
  } else {
    return `${Math.ceil(timeSeconds / 3600)} hours`
  }
}

async function getDetailedDeviceInfo(device: any): Promise<any> {
  try {
    const partitions = await getDevicePartitions(device.path)
    const health = await getDeviceHealth(device.path)
    const temperature = await getDeviceTemperature(device.path)
    
    return {
      partitions,
      health: health || 'Unknown',
      temperature: temperature || 'Unknown',
      hoursUsed: await getDeviceHoursUsed(device.path),
      interfaceType: await getDeviceInterface(device.path),
      rotationRate: await getDeviceRotationRate(device.path)
    }
  } catch (error) {
    console.error('Failed to get detailed device info:', error)
    return {
      partitions: [],
      health: 'Unknown',
      temperature: 'Unknown',
      hoursUsed: 'Unknown',
      interfaceType: 'Unknown',
      rotationRate: 'Unknown'
    }
  }
}

async function getDevicePartitions(devicePath: string): Promise<any[]> {
  try {
    if (process.platform === 'linux') {
      const { stdout } = await execAsync(`lsblk -no NAME,SIZE,FSTYPE,MOUNTPOINT ${devicePath}`)
      const lines = stdout.split('\n').filter(line => line.trim())
      return lines.map(line => {
        const [name, size, fstype, mountpoint] = line.split(/\s+/)
        return { name, size, type: fstype || 'Unknown', mountPoint: mountpoint || 'None' }
      })
    } else if (process.platform === 'win32') {
      const { stdout } = await execAsync(`wmic partition where "DiskIndex=${devicePath.split('Drive')[1]}" get Name,Size,Type`)
      // Parse Windows partition info
      return []
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`diskutil list ${devicePath}`)
      // Parse macOS partition info
      return []
    }
    return []
  } catch (error) {
    return []
  }
}

async function getDeviceHealth(devicePath: string): Promise<string | null> {
  try {
    if (process.platform === 'linux') {
      // Try non-privileged smartctl access first
      const { stdout } = await execAsync(`smartctl -H ${devicePath} || true`)
      const match = stdout.match(/SMART overall-health self-assessment test result:\s*(.+)/i)
      return match ? match[1].trim() : null
    }
    return null
  } catch (error) {
    return null
  }
}

async function getDeviceTemperature(devicePath: string): Promise<string | null> {
  try {
    if (process.platform === 'linux') {
      // Try non-privileged smartctl access first
      const { stdout } = await execAsync(`smartctl -A ${devicePath} 2>/dev/null | grep Temperature || true`)
      const match = stdout.match(/Temperature:\s*(\d+)/i)
      return match ? `${match[1]}°C` : null
    }
    return null
  } catch (error) {
    return null
  }
}

async function getDeviceHoursUsed(devicePath: string): Promise<string> {
  try {
    if (process.platform === 'linux') {
      // Try non-privileged smartctl access first
      const { stdout } = await execAsync(`smartctl -A ${devicePath} 2>/dev/null | grep "Power_On_Hours" || true`)
      const match = stdout.match(/Power_On_Hours\s+-\s*(\d+)/i)
      return match ? `${match[1]} hours` : 'Unknown'
    }
    return 'Unknown'
  } catch (error) {
    return 'Unknown'
  }
}

async function getDeviceInterface(devicePath: string): Promise<string> {
  try {
    if (process.platform === 'linux') {
      // Try non-privileged smartctl access first
      const { stdout } = await execAsync(`smartctl -i ${devicePath} 2>/dev/null | grep "SATA Version" || true`)
      if (stdout) return 'SATA'
      
      const nvmeOutput = await execAsync(`smartctl -i ${devicePath} 2>/dev/null | grep "NVMe Version" || true`)
      if (nvmeOutput.stdout) return 'NVMe'
    }
    return 'Unknown'
  } catch (error) {
    return 'Unknown'
  }
}

async function getDeviceRotationRate(devicePath: string): Promise<string> {
  try {
    if (process.platform === 'linux') {
      // Try non-privileged smartctl access first
      const { stdout } = await execAsync(`smartctl -i ${devicePath} 2>/dev/null | grep "Rotation Rate" || true`)
      const match = stdout.match(/Rotation Rate:\s*(.+)/i)
      return match ? match[1].trim() : 'Unknown'
    }
    return 'Unknown'
  } catch (error) {
    return 'Unknown'
  }
}