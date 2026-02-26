import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { access } from 'fs/promises'
import { constants } from 'fs'

interface SystemInfo {
  platform: string
  architecture: string
  environment: 'container' | 'physical' | 'virtual'
  containerType?: 'docker' | 'kubernetes' | 'unknown'
  hasRealDeviceAccess: boolean
  deviceDetectionMethod: 'real' | 'fallback' | 'mock'
  userPermissions: {
    canAccessDevices: boolean
    canExecuteSystemCommands: boolean
    hasSudoAccess: boolean
  }
  detectedDevices: number
  recommendations: string[]
}

export async function GET() {
  try {
    const platform = process.platform || 'unknown'
    const arch = process.arch || 'unknown'
    
    // Determine environment type
    const isContainer = await checkIfContainerEnvironment()
    const containerType = await determineContainerType()
    const environment: 'container' | 'physical' | 'virtual' = isContainer ? 'container' : 'physical'
    
    // Check device access capabilities
    const hasRealDeviceAccess = await checkDeviceAccess()
    const deviceDetectionMethod = hasRealDeviceAccess ? 'real' : 'fallback'
    
    // Check user permissions
    const userPermissions = await checkUserPermissions()
    
    // Get current device count
    const detectedDevices = await getDeviceCount()
    
    // Generate recommendations
    const recommendations = generateRecommendations(
      environment, 
      hasRealDeviceAccess, 
      userPermissions,
      detectedDevices
    )

    const systemInfo: SystemInfo = {
      platform,
      architecture: arch,
      environment,
      containerType: isContainer ? containerType : undefined,
      hasRealDeviceAccess,
      deviceDetectionMethod,
      userPermissions,
      detectedDevices,
      recommendations
    }

    return NextResponse.json({
      success: true,
      systemInfo,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to get system info:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get system information',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function checkIfContainerEnvironment(): Promise<boolean> {
  try {
    // Check for container indicators
    const indicators = [
      '/.dockerenv',
      '/.dockerinit',
      '/proc/1/cgroup',
      '/proc/self/cgroup'
    ]

    for (const indicator of indicators) {
      try {
        if (existsSync(indicator)) {
          return true
        }
      } catch {
        // File doesn't exist or can't be accessed
      }
    }

    // Check cgroup for container signatures
    try {
      const cgroupContent = readFileSync('/proc/1/cgroup', 'utf8')
      const containerSignatures = [
        'docker',
        'kubepods',
        'containerd',
        'kata',
        'garden',
        'rkt'
      ]

      return containerSignatures.some(sig => cgroupContent.toLowerCase().includes(sig))
    } catch {
      // Can't read cgroup info
    }

    return false
  } catch {
    return false
  }
}

async function determineContainerType(): 'docker' | 'kubernetes' | 'unknown' {
  try {
    // Check for Docker
    if (existsSync('/.dockerenv')) {
      return 'docker'
    }

    // Check for Kubernetes
    try {
      const cgroupContent = readFileSync('/proc/1/cgroup', 'utf8')
      if (cgroupContent.toLowerCase().includes('kubepods') || 
          cgroupContent.toLowerCase().includes('kata')) {
        return 'kubernetes'
      }
    } catch {
      // Can't read cgroup
    }

    return 'unknown'
  } catch {
    return 'unknown'
  }
}

async function checkDeviceAccess(): Promise<boolean> {
  try {
    // Try to access common device paths
    const devicePaths = [
      '/dev/sda',
      '/dev/sdb', 
      '/dev/nvme0',
      '/dev/vda'
    ]

    for (const devicePath of devicePaths) {
      try {
        await access(devicePath, constants.R_OK)
        return true
      } catch {
        // Device doesn't exist or can't be accessed
      }
    }

    return false
  } catch {
    return false
  }
}

async function checkUserPermissions() {
  return {
    canAccessDevices: await checkDeviceAccess(),
    canExecuteSystemCommands: await checkCommandExecution(),
    hasSudoAccess: await checkSudoAccess()
  }
}

async function checkCommandExecution(): Promise<boolean> {
  try {
    // Try to execute a simple command
    execSync('echo "test"', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function checkSudoAccess(): Promise<boolean> {
  try {
    // Try to run a command with sudo (this will likely fail in most environments)
    execSync('sudo -n true', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function getDeviceCount(): Promise<number> {
  try {
    const response = await fetch('http://localhost:3000/api/devices')
    const data = await response.json()
    return data.success ? data.devices?.length || 0 : 0
  } catch {
    return 0
  }
}

function generateRecommendations(
  environment: 'container' | 'physical' | 'virtual',
  hasRealDeviceAccess: boolean,
  permissions: any,
  deviceCount: number
): string[] {
  const recommendations: string[] = []

  if (environment === 'container') {
    recommendations.push('📦 You are running in a containerized environment')
    recommendations.push('🔍 Storage devices shown are virtual/emulated for demonstration')
    recommendations.push('💡 In a physical environment, real storage devices would be detected')
    
    if (deviceCount === 0) {
      recommendations.push('⚠️ No virtual storage devices found - this is normal in some container setups')
    }
  } else if (!hasRealDeviceAccess) {
    recommendations.push('🔒 The application cannot access real storage devices')
    recommendations.push('⚠️ This may be due to permission restrictions')
    recommendations.push('🛠️ Try running with elevated privileges if you need real device access')
  }

  if (!permissions.canExecuteSystemCommands) {
    recommendations.push('🚫 System command execution is limited')
    recommendations.push('⚠️ Some advanced features may not work properly')
  }

  if (deviceCount === 0) {
    recommendations.push('📭 No storage devices detected')
    recommendations.push('🔌 Make sure storage devices are connected and accessible')
    recommendations.push('🔐 Check system permissions for device access')
  }

  if (hasRealDeviceAccess && deviceCount > 0) {
    recommendations.push('✅ Real storage devices detected and accessible')
    recommendations.push('🎯 You can proceed with secure data wiping operations')
  }

  return recommendations
}