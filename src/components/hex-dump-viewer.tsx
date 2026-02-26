"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Binary, Eye, EyeOff, Pause, Play, SkipForward, SkipBack } from "lucide-react"

interface HexDumpLine {
  offset: number
  hex: string
  ascii: string
  isWiped: boolean
  passNumber: number
}

interface HexDumpViewerProps {
  operationId: string
  isActive: boolean
  onWipeComplete?: () => void
}

export function HexDumpViewer({ operationId, isActive, onWipeComplete }: HexDumpViewerProps) {
  const [hexData, setHexData] = useState<HexDumpLine[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [currentPass, setCurrentPass] = useState(1)
  const [totalPasses, setTotalPasses] = useState(1)
  const [displayMode, setDisplayMode] = useState<'hex' | 'hex-ascii' | 'ascii'>('hex-ascii')
  const [bytesPerLine, setBytesPerLine] = useState(16)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showOnlyWiped, setShowOnlyWiped] = useState(false)
  const [wipeSpeed, setWipeSpeed] = useState(50) // ms between updates

  // Initialize hex data with random data
  useEffect(() => {
    const initialData: HexDumpLine[] = []
    for (let i = 0; i < 100; i++) {
      const offset = i * bytesPerLine
      const hexBytes = []
      const asciiBytes = []
      
      for (let j = 0; j < bytesPerLine; j++) {
        const byte = Math.floor(Math.random() * 256)
        hexBytes.push(byte.toString(16).padStart(2, '0').toUpperCase())
        asciiBytes.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')
      }
      
      initialData.push({
        offset,
        hex: hexBytes.join(' '),
        ascii: asciiBytes.join(''),
        isWiped: false,
        passNumber: 0
      })
    }
    setHexData(initialData)
  }, [bytesPerLine])

  // Simulate wiping process
  useEffect(() => {
    if (!isActive || isPaused) return

    let currentLine = 0
    let passInProgress = currentPass

    const wipeInterval = setInterval(() => {
      if (currentLine >= hexData.length) {
        // Pass completed
        if (passInProgress >= totalPasses) {
          // All passes completed
          clearInterval(wipeInterval)
          onWipeComplete?.()
          return
        } else {
          // Start next pass
          passInProgress++
          setCurrentPass(passInProgress)
          currentLine = 0
        }
      }

      // Update current line
      setHexData(prev => {
        const newData = [...prev]
        newData[currentLine] = {
          ...newData[currentLine],
          isWiped: true,
          passNumber: passInProgress,
          hex: '00 '.repeat(bytesPerLine).trim(),
          ascii: '.'.repeat(bytesPerLine)
        }
        return newData
      })

      currentLine++
    }, wipeSpeed)

    return () => clearInterval(wipeInterval)
  }, [isActive, isPaused, currentPass, totalPasses, hexData.length, bytesPerLine, wipeSpeed, onWipeComplete])

  const filteredData = showOnlyWiped 
    ? hexData.filter(line => line.isWiped)
    : hexData

  const renderHexLine = (line: HexDumpLine) => {
    const offsetHex = line.offset.toString(16).padStart(8, '0').toUpperCase()
    const hexBytes = line.hex.split(' ')
    
    return (
      <div 
        key={line.offset} 
        className={`font-mono text-xs leading-relaxed ${
          line.isWiped ? 'bg-green-50 dark:bg-green-950/20' : ''
        }`}
      >
        <span className="text-blue-600 dark:text-blue-400">{offsetHex}:</span>
        <span className="ml-2">
          {hexBytes.map((byte, index) => (
            <span 
              key={index}
              className={
                line.isWiped 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-700 dark:text-gray-300'
              }
            >
              {byte}{' '}
            </span>
          ))}
        </span>
        {displayMode !== 'hex' && (
          <span className="ml-4 text-gray-600 dark:text-gray-400">
            |{line.ascii}|
          </span>
        )}
        {line.isWiped && (
          <Badge variant="outline" className="ml-2 text-xs">
            Pass {line.passNumber}
          </Badge>
        )}
      </div>
    )
  }

  const wipedBytes = hexData.filter(line => line.isWiped).length * bytesPerLine
  const totalBytes = hexData.length * bytesPerLine
  const wipeProgress = totalBytes > 0 ? (wipedBytes / totalBytes) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Binary className="h-5 w-5" />
            Hex Dump Viewer
          </CardTitle>
          <CardDescription>
            Real-time hex display of data being wiped - Operation {operationId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
                disabled={!isActive}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentPass(Math.max(1, currentPass - 1))
                  setHexData(prev => prev.map(line => ({ ...line, isWiped: false, passNumber: 0 })))
                }}
                disabled={!isActive || currentPass <= 1}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentPass(Math.min(totalPasses, currentPass + 1))
                  setHexData(prev => prev.map(line => ({ ...line, isWiped: false, passNumber: 0 })))
                }}
                disabled={!isActive || currentPass >= totalPasses}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">Display:</span>
              <Select value={displayMode} onValueChange={(value: any) => setDisplayMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hex">Hex Only</SelectItem>
                  <SelectItem value="hex-ascii">Hex + ASCII</SelectItem>
                  <SelectItem value="ascii">ASCII Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">Bytes/Line:</span>
              <Select value={bytesPerLine.toString()} onValueChange={(value) => setBytesPerLine(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                  <SelectItem value="32">32</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">Speed:</span>
              <Select value={wipeSpeed.toString()} onValueChange={(value) => setWipeSpeed(parseInt(value))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Fast</SelectItem>
                  <SelectItem value="50">Normal</SelectItem>
                  <SelectItem value="100">Slow</SelectItem>
                  <SelectItem value="200">Very Slow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOnlyWiped(!showOnlyWiped)}
              >
                {showOnlyWiped ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showOnlyWiped ? 'Show All' : 'Wiped Only'}
              </Button>
            </div>
          </div>

          {/* Progress Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Pass:</span>
              <span className="ml-2 font-medium">{currentPass} / {totalPasses}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Progress:</span>
              <span className="ml-2 font-medium">{wipedBytes} / {totalBytes} bytes</span>
            </div>
            <div>
              <span className="text-muted-foreground">Complete:</span>
              <span className="ml-2 font-medium">{wipeProgress.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className={`ml-2 font-medium ${
                isActive && !isPaused ? 'text-green-600' : 
                isPaused ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {isActive && !isPaused ? 'Wiping' : 
                 isPaused ? 'Paused' : 'Ready'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hex Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Memory Dump</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="font-mono text-xs bg-black text-green-400 p-4 rounded">
              {filteredData.length > 0 ? (
                filteredData.map(renderHexLine)
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No data to display. {showOnlyWiped && 'Try showing all data.'}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 dark:bg-green-950/20 border"></div>
              <span>Wiped data (0x00)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border"></div>
              <span>Original data</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Pass N</Badge>
              <span>Wipe pass number</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}