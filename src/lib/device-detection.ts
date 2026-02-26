import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

export interface StorageDevice {
  id: string
  name: string
  type: 'HDD' | 'SSD' | 'USB' | 'SD' | 'NVMe'
  size: string
  sizeBytes: number
  model: string
  serial: string
  firmware: string
  status: 'available' | 'wiping' | 'completed' | 'error' | 'offline'
  sectors: number
  blockSize: number
  path: string
  vendor?: string
  temperature?: number
  health?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  isRemovable: boolean
  isSystem: boolean
  mountPoints?: string[]
}

export interface DeviceDetectionConfig {
  includeSystemDevices: boolean
  includeRemovableDevices: boolean
  refreshInterval: number
}

class DeviceDetectionService {
  private config: DeviceDetectionConfig
  private cache: Map<string, StorageDevice> = new Map()
  private lastScan: Date = new Date(0)
  private isScanning: boolean = false

  constructor(config: DeviceDetectionConfig) {
    this.config = config
  }

  async detectDevices(): Promise<StorageDevice[]> {
    if (this.isScanning) {
      return Array.from(this.cache.values())
    }

    this.isScanning = true
    try {
      const platform = process.platform
      let devices: StorageDevice[] = []

      switch (platform) {
        case 'linux':
          devices = await this.detectLinuxDevices()
          break
        case 'win32':
          devices = await this.detectWindowsDevices()
          break
        case 'darwin':
          devices = await this.detectMacOSDevices()
          break
        default:
          console.warn(`Unsupported platform: ${platform}`)
          devices = []
      }

      // Filter devices based on configuration
      devices = devices.filter(device => {
        if (!this.config.includeSystemDevices && device.isSystem) {
          return false
        }
        if (!this.config.includeRemovableDevices && device.isRemovable) {
          return false
        }
        return true
      })

      // Update cache
      this.cache.clear()
      devices.forEach(device => {
        this.cache.set(device.id, device)
      })
      this.lastScan = new Date()

      return devices
    } catch (error) {
      console.error('Device detection failed:', error)
      return Array.from(this.cache.values())
    } finally {
      this.isScanning = false
    }
  }

  private async detectLinuxDevices(): Promise<StorageDevice[]> {
    const devices: StorageDevice[] = []

    try {
      // Get block devices using lsblk
      const { stdout: lsblkOutput } = await execAsync(
        'lsblk -b -o NAME,SIZE,ROTA,MODEL,SERIAL,FSTYPE,MOUNTPOINT,TYPE,VENDOR -J'
      )
      const lsblkData = JSON.parse(lsblkOutput)

      // Get detailed smartctl information if available
      const smartctlData = await this.getSmartctlData()

      for (const blockdevice of lsblkData.blockdevices || []) {
        if (blockdevice.type !== 'disk') continue

        const devicePath = `/dev/${blockdevice.name}`
        const isRemovable = await this.isRemovableDeviceLinux(devicePath)
        const isSystem = await this.isSystemDeviceLinux(devicePath)

        const device: StorageDevice = {
          id: blockdevice.name,
          name: blockdevice.model || `${blockdevice.vendor || 'Unknown'} ${blockdevice.name}`,
          type: this.determineDeviceType(blockdevice, isRemovable),
          size: this.formatBytes(blockdevice.size),
          sizeBytes: blockdevice.size,
          model: blockdevice.model || 'Unknown',
          serial: blockdevice.serial || 'Unknown',
          firmware: await this.getFirmwareLinux(devicePath),
          status: 'available',
          sectors: Math.floor(blockdevice.size / 512), // Assume 512-byte sectors
          blockSize: 512,
          path: devicePath,
          vendor: blockdevice.vendor,
          temperature: this.getTemperatureFromSmartctl(smartctlData, blockdevice.name),
          health: this.getHealthFromSmartctl(smartctlData, blockdevice.name),
          isRemovable,
          isSystem,
          mountPoints: blockdevice.mountpoint ? [blockdevice.mountpoint] : []
        }

        devices.push(device)
      }
    } catch (error) {
      console.error('Linux device detection failed:', error)
    }

    return devices
  }

  private async detectWindowsDevices(): Promise<StorageDevice[]> {
    const devices: StorageDevice[] = []

    try {
      // Use wmic to get disk information
      const { stdout: wmicOutput } = await execAsync(
        'wmic disk get Index,Size,Model,SerialNumber,InterfaceType,MediaType /format:csv'
      )

      const lines = wmicOutput.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',')
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        if (values.length < headers.length) continue

        const diskData: any = {}
        headers.forEach((header, index) => {
          diskData[header.trim()] = values[index]?.trim() || ''
        })

        const sizeBytes = parseInt(diskData.Size) || 0
        const device: StorageDevice = {
          id: diskData.Index || `disk_${i}`,
          name: diskData.Model || 'Unknown Disk',
          type: this.determineWindowsDeviceType(diskData),
          size: this.formatBytes(sizeBytes),
          sizeBytes,
          model: diskData.Model || 'Unknown',
          serial: diskData.SerialNumber || 'Unknown',
          firmware: await this.getFirmwareWindows(diskData.Index),
          status: 'available',
          sectors: Math.floor(sizeBytes / 512),
          blockSize: 512,
          path: `\\\\.\\PhysicalDrive${diskData.Index}`,
          isRemovable: diskData.InterfaceType === 'USB',
          isSystem: diskData.MediaType === 'Fixed hard disk media'
        }

        devices.push(device)
      }
    } catch (error) {
      console.error('Windows device detection failed:', error)
    }

    return devices
  }

  private async detectMacOSDevices(): Promise<StorageDevice[]> {
    const devices: StorageDevice[] = []

    try {
      // Use diskutil to get disk information
      const { stdout: diskutilOutput } = await execAsync('diskutil list -plist')
      
      // Parse plist output (simplified parsing)
      const diskMatches = diskutilOutput.matchAll(/<key>DeviceNode<\/key>\s*<string>([^<]+)<\/string>/g)
      const sizeMatches = diskutilOutput.matchAll(/<key>Size<\/key>\s*<string>([^<]+)<\/string>/g)
      const modelMatches = diskutilOutput.matchAll(/<key>DeviceIdentifier<\/key>\s*<string>([^<]+)<\/string>/g)

      const diskNodes = Array.from(diskMatches, match => match[1])
      const sizes = Array.from(sizeMatches, match => match[1])
      const identifiers = Array.from(modelMatches, match => match[1])

      for (let i = 0; i < diskNodes.length; i++) {
        const devicePath = diskNodes[i]
        const identifier = identifiers[i] || `disk${i}`
        
        if (!devicePath.startsWith('/dev/disk')) continue

        const sizeBytes = this.parseSizeString(sizes[i] || '0')
        const isRemovable = await this.isRemovableDeviceMacOS(devicePath)
        const isSystem = !isRemovable

        const device: StorageDevice = {
          id: identifier,
          name: await this.getDiskNameMacOS(devicePath),
          type: this.determineMacOSDeviceType(isRemovable),
          size: this.formatBytes(sizeBytes),
          sizeBytes,
          model: await this.getModelMacOS(devicePath),
          serial: await this.getSerialMacOS(devicePath),
          firmware: await this.getFirmwareMacOS(devicePath),
          status: 'available',
          sectors: Math.floor(sizeBytes / 512),
          blockSize: 512,
          path: devicePath,
          isRemovable,
          isSystem
        }

        devices.push(device)
      }
    } catch (error) {
      console.error('macOS device detection failed:', error)
    }

    return devices
  }

  // Helper methods for Linux
  private async getSmartctlData(): Promise<any> {
    try {
      const { stdout } = await execAsync('smartctl --scan 2>/dev/null || true')
      const devices = stdout.split('\n').filter(line => line.trim())
      const smartctlData: any = {}

      for (const deviceLine of devices) {
        const match = deviceLine.match(/\/dev\/([^\s]+)/)
        if (match) {
          const deviceName = match[1]
          try {
            const { stdout: smartInfo } = await execAsync(`smartctl -i /dev/${deviceName} 2>/dev/null || true`)
            const tempMatch = smartInfo.match(/Temperature:\s+(\d+)/i)
            const healthMatch = smartInfo.match(/SMART overall-health self-assessment test result:\s*(.+)/i)
            
            if (tempMatch || healthMatch) {
              smartctlData[deviceName] = {
                temperature: tempMatch ? parseInt(tempMatch[1]) : undefined,
                health: healthMatch ? healthMatch[1].toLowerCase() : undefined
              }
            }
          } catch (e) {
            // smartctl might not be available or device might not support SMART
          }
        }
      }

      return smartctlData
    } catch (error) {
      return {}
    }
  }

  private getTemperatureFromSmartctl(smartctlData: any, deviceName: string): number | undefined {
    return smartctlData[deviceName]?.temperature
  }

  private getHealthFromSmartctl(smartctlData: any, deviceName: string): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | undefined {
    const health = smartctlData[deviceName]?.health
    if (!health) return undefined

    if (health.includes('passed') || health.includes('ok')) return 'excellent'
    if (health.includes('warning')) return 'fair'
    if (health.includes('failed')) return 'critical'
    return 'good'
  }

  private async isRemovableDeviceLinux(devicePath: string): Promise<boolean> {
    try {
      const sysPath = devicePath.replace('/dev/', '/sys/block/')
      const removablePath = path.join(sysPath, 'removable')
      
      if (fs.existsSync(removablePath)) {
        const removable = fs.readFileSync(removablePath, 'utf8').trim()
        return removable === '1'
      }
    } catch (error) {
      // Fallback: check if it's a USB device
      return devicePath.includes('usb') || devicePath.includes('sd')
    }
    return false
  }

  private async isSystemDeviceLinux(devicePath: string): Promise<boolean> {
    try {
      // Check if device contains system partitions
      const { stdout } = await execAsync(`lsblk -no MOUNTPOINT ${devicePath}`)
      const mountPoints = stdout.split('\n').filter(mp => mp.trim())
      
      const systemMounts = ['/', '/boot', '/efi', '/boot/efi']
      return mountPoints.some(mp => systemMounts.includes(mp))
    } catch (error) {
      return false
    }
  }

  private async getFirmwareLinux(devicePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`smartctl -i ${devicePath} 2>/dev/null || true`)
      const match = stdout.match(/Firmware Version:\s*(.+)/i)
      return match ? match[1].trim() : 'Unknown'
    } catch (error) {
      return 'Unknown'
    }
  }

  // Helper methods for Windows
  private determineWindowsDeviceType(diskData: any): 'HDD' | 'SSD' | 'USB' | 'SD' | 'NVMe' {
    if (diskData.InterfaceType === 'USB') return 'USB'
    if (diskData.InterfaceType === 'NVMe') return 'NVMe'
    if (diskData.MediaType?.toLowerCase().includes('ssd')) return 'SSD'
    return 'HDD'
  }

  private async getFirmwareWindows(diskIndex: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `wmic disk where Index="${diskIndex}" get FirmwareRevision /format:list`
      )
      const match = stdout.match(/FirmwareRevision=(.+)/)
      return match ? match[1].trim() : 'Unknown'
    } catch (error) {
      return 'Unknown'
    }
  }

  // Helper methods for macOS
  private determineMacOSDeviceType(isRemovable: boolean): 'HDD' | 'SSD' | 'USB' | 'SD' | 'NVMe' {
    if (isRemovable) return 'USB'
    return 'SSD' // Most modern Macs use SSDs
  }

  private async getDiskNameMacOS(devicePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`diskutil info ${devicePath}`)
      const match = stdout.match(/Device \/ Media Name:\s*(.+)/)
      return match ? match[1].trim() : path.basename(devicePath)
    } catch (error) {
      return path.basename(devicePath)
    }
  }

  private async getModelMacOS(devicePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`diskutil info ${devicePath}`)
      const match = stdout.match(/Device Model:\s*(.+)/)
      return match ? match[1].trim() : 'Unknown'
    } catch (error) {
      return 'Unknown'
    }
  }

  private async getSerialMacOS(devicePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`diskutil info ${devicePath}`)
      const match = stdout.match(/Device Serial Number:\s*(.+)/)
      return match ? match[1].trim() : 'Unknown'
    } catch (error) {
      return 'Unknown'
    }
  }

  private async getFirmwareMacOS(devicePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`diskutil info ${devicePath}`)
      const match = stdout.match(/Firmware Revision:\s*(.+)/)
      return match ? match[1].trim() : 'Unknown'
    } catch (error) {
      return 'Unknown'
    }
  }

  private async isRemovableDeviceMacOS(devicePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`diskutil info ${devicePath}`)
      const match = stdout.match(/Removable Media:\s*(.+)/)
      return match ? match[1].trim().toLowerCase() === 'yes' : false
    } catch (error) {
      return false
    }
  }

  // Common helper methods
  private determineDeviceType(blockdevice: any, isRemovable: boolean): 'HDD' | 'SSD' | 'USB' | 'SD' | 'NVMe' {
    if (isRemovable) {
      return blockdevice.name?.includes('mmcblk') ? 'SD' : 'USB'
    }
    return blockdevice.rota === '0' ? 'SSD' : 'HDD'
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private parseSizeString(sizeStr: string): number {
    const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*([KMGT]?B)/i)
    if (!match) return 0

    const size = parseFloat(match[1])
    const unit = match[2].toUpperCase()

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    }

    return size * (multipliers[unit] || 1)
  }

  // Public methods for real-time monitoring
  async startMonitoring(callback: (devices: StorageDevice[]) => void): Promise<void> {
    const monitor = async () => {
      const devices = await this.detectDevices()
      callback(devices)
    }

    // Initial scan
    await monitor()

    // Set up periodic monitoring
    setInterval(monitor, this.config.refreshInterval)
  }

  async getDeviceChanges(): Promise<{ added: StorageDevice[]; removed: StorageDevice[] }> {
    const previousDevices = Array.from(this.cache.values())
    const currentDevices = await this.detectDevices()

    const previousIds = new Set(previousDevices.map(d => d.id))
    const currentIds = new Set(currentDevices.map(d => d.id))

    const added = currentDevices.filter(d => !previousIds.has(d.id))
    const removed = previousDevices.filter(d => !currentIds.has(d.id))

    return { added, removed }
  }
}

// Create singleton instance
export const deviceDetectionService = new DeviceDetectionService({
  includeSystemDevices: true,
  includeRemovableDevices: true,
  refreshInterval: 5000 // 5 seconds
})

export default DeviceDetectionService