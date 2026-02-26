"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  HardDrive, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Thermometer, 
  Database,
  Zap,
  Shield,
  Clock,
  Info,
  Server
} from "lucide-react"
import { io, Socket } from "socket.io-client"

interface DeviceStatus {
  id: string
  name: string
  type: "HDD" | "SSD" | "USB" | "SD" | "NVMe"
  size: string
  sizeBytes: number
  model: string
  serial: string
  firmware: string
  status: "online" | "offline" | "error" | "wiping" | "verifying"
  health: "excellent" | "good" | "fair" | "poor" | "critical"
  temperature?: number
  usage: number
  lastActivity: string
  sectors: number
  blockSize: number
  speed: {
    read: number
    write: number
  }
  errors: {
    read: number
    write: number
    corrected: number
  }
  security: {
    encrypted: boolean
    secureEraseSupported: boolean
    tcgSupported: boolean
  }
  path: string
  vendor?: string
  isRemovable: boolean
  isSystem: boolean
  mountPoints?: string[]
}

interface DeviceMonitorProps {
  onDeviceSelect?: (deviceId: string) => void
  selectedDevice?: string
  className?: string
}

export function DeviceMonitor({ onDeviceSelect, selectedDevice, className }: DeviceMonitorProps) {
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [showDetails, setShowDetails] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [monitoringActive, setMonitoringActive] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? `${window.location.origin}` 
      : 'http://localhost:3000'
    
    try {
      socketRef.current = io(socketUrl, {
        path: '/api/socketio',
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      const socket = socketRef.current

      // Connection events
      socket.on('connect', () => {
        console.log('Connected to Socket.IO server')
        setSocketConnected(true)
        setConnectionError(null)
        
        // Start device monitoring automatically
        socket.emit('start-device-monitoring')
      })

      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error)
        setSocketConnected(false)
        setConnectionError('Failed to connect to real-time monitoring')
      })

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO server:', reason)
        setSocketConnected(false)
        setMonitoringActive(false)
      })

      // Device monitoring events
      socket.on('device-monitoring-started', (data) => {
        console.log('Device monitoring started:', data)
        setMonitoringActive(true)
      })

      socket.on('device-monitoring-stopped', (data) => {
        console.log('Device monitoring stopped:', data)
        setMonitoringActive(false)
      })

      socket.on('devices-updated', (data) => {
        console.log('Devices updated:', data)
        const convertedDevices = data.devices.map(convertApiDeviceToDeviceStatus)
        setDevices(convertedDevices)
        setLastUpdate(new Date(data.timestamp))
        setLoading(false)
      })

      socket.on('devices-changed', (data) => {
        console.log('Devices changed:', data)
        const convertedDevices = data.currentDevices.map(convertApiDeviceToDeviceStatus)
        setDevices(convertedDevices)
        setLastUpdate(new Date(data.timestamp))
      })

      socket.on('devices-error', (error) => {
        console.error('Devices error:', error)
        setConnectionError(error.error || 'Failed to monitor devices')
        setLoading(false)
      })

      // Handle welcome message
      socket.on('message', (msg) => {
        console.log('Socket message:', msg)
      })

    } catch (error) {
      console.error('Failed to initialize Socket.IO:', error)
      setConnectionError('Failed to initialize real-time monitoring')
    }

    // Fallback: fetch devices via HTTP if Socket.IO fails
    const fetchDevicesViaHTTP = async () => {
      if (!socketConnected) {
        await refreshDevices()
      }
    }

    fetchDevicesViaHTTP()

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('stop-device-monitoring')
        socketRef.current.disconnect()
      }
    }
  }, [])

  // Convert API device format to DeviceStatus format
  const convertApiDeviceToDeviceStatus = (apiDevice: any): DeviceStatus => {
    return {
      id: apiDevice.id,
      name: apiDevice.name,
      type: apiDevice.type,
      size: apiDevice.size,
      sizeBytes: apiDevice.sizeBytes || 0,
      model: apiDevice.model,
      serial: apiDevice.serial,
      firmware: apiDevice.firmware,
      status: apiDevice.status === 'available' ? 'online' : apiDevice.status,
      health: apiDevice.health || 'good',
      temperature: apiDevice.temperature,
      usage: Math.random() * 100, // API doesn't provide usage, simulate for now
      lastActivity: new Date().toISOString(),
      sectors: apiDevice.sectors,
      blockSize: apiDevice.blockSize,
      speed: {
        read: apiDevice.type === 'SSD' || apiDevice.type === 'NVMe' ? 500 : 150, // Estimate based on type
        write: apiDevice.type === 'SSD' || apiDevice.type === 'NVMe' ? 400 : 120
      },
      errors: {
        read: 0,
        write: 0,
        corrected: 0
      },
      security: {
        encrypted: false, // API doesn't provide this info
        secureEraseSupported: apiDevice.type === 'SSD' || apiDevice.type === 'NVMe',
        tcgSupported: false
      },
      path: apiDevice.path,
      vendor: apiDevice.vendor,
      isRemovable: apiDevice.isRemovable,
      isSystem: apiDevice.isSystem,
      mountPoints: apiDevice.mountPoints
    }
  }

  // Manual refresh function
  const refreshDevices = async () => {
    setLoading(true)
    try {
      if (socketRef.current && socketConnected) {
        socketRef.current.emit('refresh-devices')
      } else {
        // Fallback to HTTP API
        const response = await fetch('/api/devices')
        const data = await response.json()
        if (data.success) {
          const convertedDevices = data.devices.map(convertApiDeviceToDeviceStatus)
          setDevices(convertedDevices)
          setLastUpdate(new Date())
        } else {
          setConnectionError(data.error || 'Failed to fetch devices')
        }
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error)
      setConnectionError('Network error while fetching devices')
    } finally {
      setLoading(false)
    }
  }

  // Toggle monitoring
  const toggleMonitoring = () => {
    if (socketRef.current && socketConnected) {
      if (monitoringActive) {
        socketRef.current.emit('stop-device-monitoring')
      } else {
        socketRef.current.emit('start-device-monitoring')
      }
    }
  }

  const getStatusColor = (status: DeviceStatus['status']) => {
    switch (status) {
      case 'online': return 'default'
      case 'offline': return 'secondary'
      case 'error': return 'destructive'
      case 'wiping': return 'default'
      case 'verifying': return 'secondary'
      default: return 'outline'
    }
  }

  const getHealthColor = (health: DeviceStatus['health']) => {
    switch (health) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-green-500'
      case 'fair': return 'text-yellow-600'
      case 'poor': return 'text-orange-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getTemperatureColor = (temp?: number) => {
    if (!temp) return 'text-gray-600'
    if (temp < 35) return 'text-blue-600'
    if (temp < 50) return 'text-green-600'
    if (temp < 65) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  const isDeviceSelectable = (device: DeviceStatus) => {
    return device.status === 'online' && device.health !== 'critical'
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Detected Storage Devices
          </CardTitle>
          <CardDescription>
            {devices.length === 0 
              ? "No storage devices detected. Click 'Refresh Devices Now' to scan again."
              : `Found ${devices.length} storage device${devices.length > 1 ? 's' : ''}. Click on a device to select it for wiping.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {devices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <HardDrive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Storage Devices Found
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {loading 
                        ? 'Scanning for storage devices...'
                        : 'No storage devices were detected. This could be because:'
                      }
                    </p>
                    {!loading && (
                      <div className="text-left space-y-2 text-sm text-gray-600 max-w-md mx-auto">
                        <div className="flex items-start gap-2">
                          <span>•</span>
                          <span>You're running in a containerized environment (like Docker or Kubernetes)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span>•</span>
                          <span>The application doesn't have permission to access storage devices</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span>•</span>
                          <span>No physical storage devices are connected to this system</span>
                        </div>
                      </div>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={refreshDevices}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Scanning...' : 'Refresh Devices'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                devices.map((device) => (
                  <Card 
                    key={device.id} 
                    className={`transition-all duration-200 ${
                      selectedDevice === device.id ? 'ring-2 ring-primary bg-primary/5' : ''
                    } ${!isDeviceSelectable(device) ? 'opacity-60' : 'hover:shadow-md cursor-pointer'}`}
                    onClick={() => isDeviceSelectable(device) && onDeviceSelect?.(device.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        {/* Device Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <HardDrive className="h-5 w-5" />
                            <h4 className="font-semibold text-lg">{device.name}</h4>
                            <Badge variant="outline">{device.type}</Badge>
                            <Badge variant={getStatusColor(device.status)}>
                              {device.status}
                            </Badge>
                            {device.isRemovable && (
                              <Badge variant="secondary">
                                <Database className="h-3 w-3 mr-1" />
                                Removable
                              </Badge>
                            )}
                            {device.isSystem && (
                              <Badge variant="destructive">
                                <Server className="h-3 w-3 mr-1" />
                                System
                              </Badge>
                            )}
                            {device.security.encrypted && (
                              <Shield className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-muted-foreground">Size:</span>
                              <span className="ml-2 font-medium">{device.size}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Model:</span>
                              <span className="ml-2 font-medium">{device.model}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Serial:</span>
                              <span className="ml-2 font-mono text-xs">{device.serial}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Firmware:</span>
                              <span className="ml-2">{device.firmware}</span>
                            </div>
                          </div>

                          {/* Health and Status Indicators */}
                          <div className="flex flex-wrap items-center gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <Thermometer className="h-4 w-4" />
                              <span className={`text-sm ${getTemperatureColor(device.temperature)}`}>
                                {device.temperature ? `${device.temperature.toFixed(1)}°C` : 'N/A'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4" />
                              <span className="text-sm">
                                Usage: {device.usage.toFixed(1)}%
                              </span>
                              <div className="w-16">
                                <Progress value={device.usage} className="h-2" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${getHealthColor(device.health)}`} />
                              <span className={`text-sm capitalize ${getHealthColor(device.health)}`}>
                                Health: {device.health}
                              </span>
                            </div>
                          </div>

                          {/* Action Button */}
                          {isDeviceSelectable(device) && (
                            <div className="flex items-center gap-2 text-sm">
                              <Button 
                                variant={selectedDevice === device.id ? "default" : "outline"} 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeviceSelect?.(device.id)
                                }}
                              >
                                {selectedDevice === device.id ? 'Selected' : 'Select Device'}
                              </Button>
                              <span className="text-muted-foreground">
                                Click to select for secure erase
                              </span>
                            </div>
                          )}

                          {/* Detailed Information */}
                          {showDetails && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              <h5 className="font-medium flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                Technical Details
                              </h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Read Speed:</span>
                                  <span className="ml-2 font-medium">{device.speed.read.toFixed(0)} MB/s</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Write Speed:</span>
                                  <span className="ml-2 font-medium">{device.speed.write.toFixed(0)} MB/s</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Sectors:</span>
                                  <span className="ml-2 font-mono">{device.sectors.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Block Size:</span>
                                  <span className="ml-2">{device.blockSize} bytes</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Read Errors:</span>
                                  <span className="ml-2 font-medium text-red-600">{device.errors.read}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Write Errors:</span>
                                  <span className="ml-2 font-medium text-red-600">{device.errors.write}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Corrected:</span>
                                  <span className="ml-2 font-medium text-yellow-600">{device.errors.corrected}</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4" />
                                  <span>Secure Erase: {device.security.secureEraseSupported ? '✓ Supported' : '✗ Not Supported'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  <span>TCG: {device.security.tcgSupported ? '✓ Supported' : '✗ Not Supported'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  <span>Last Activity: {formatLastActivity(device.lastActivity)}</span>
                                </div>
                              </div>

                              {device.mountPoints && device.mountPoints.length > 0 && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Mount Points: </span>
                                  <span className="font-mono">{device.mountPoints.join(', ')}</span>
                                </div>
                              )}

                              {device.path && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Device Path: </span>
                                  <span className="font-mono">{device.path}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}