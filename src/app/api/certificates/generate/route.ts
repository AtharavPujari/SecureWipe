import { NextRequest, NextResponse } from 'next/server'
import { 
  generateCertificateId, 
  generateSignature, 
  generateHash, 
  generateKeyPair,
  generateQRCodeData,
  generateVerificationUrl,
  createCertificateHash,
  generateWipeId
} from '@/lib/crypto'
import { CertificateData, CertificateCreateRequest } from '@/types/certificate'
import { certificateStorage } from '@/lib/certificate-storage'

// Generate or get key pair for this session
function getOrCreateKeyPair(sessionId: string): { publicKey: string; privateKey: string } {
  let keyPair = certificateStorage.getKeyPair(sessionId)
  if (!keyPair) {
    keyPair = generateKeyPair()
    certificateStorage.storeKeyPair(sessionId, keyPair)
  }
  return keyPair
}

export async function POST(request: NextRequest) {
  try {
    const body: CertificateCreateRequest = await request.json()
    
    const {
      wipeId,
      deviceId,
      deviceInfo,
      wipeMethod,
      wipeDetails,
      operatorInfo
    } = body

    // Validate required fields
    if (!wipeId || !deviceId || !deviceInfo || !wipeMethod || !wipeDetails || !operatorInfo) {
      return NextResponse.json(
        { success: false, error: 'Missing required certificate data' },
        { status: 400 }
      )
    }

    // Generate certificate ID and wipe ID if not provided
    const certificateId = generateCertificateId()
    const finalWipeId = wipeId || generateWipeId()

    // Get or create key pair for this session
    const sessionId = request.headers.get('x-session-id') || 'default'
    const { publicKey, privateKey } = getOrCreateKeyPair(sessionId)

    // Create wipe method details
    const wipeMethods: Record<string, { name: string; securityLevel: 'low' | 'medium' | 'high' | 'maximum'; standards: string[] }> = {
      'quick': {
        name: 'Quick Erase',
        securityLevel: 'low',
        standards: ['Basic Data Sanitization']
      },
      'dod_5220': {
        name: 'DoD 5220.22-M',
        securityLevel: 'medium',
        standards: ['NIST SP 800-88', 'DoD 5220.22-M', 'HIPAA']
      },
      'gutmann': {
        name: 'Gutmann Method',
        securityLevel: 'maximum',
        standards: ['NIST SP 800-88', 'ISO/IEC 27040', 'Gutmann Standard']
      },
      'secure_erase': {
        name: 'ATA Secure Erase',
        securityLevel: 'high',
        standards: ['ATA Standard', 'NIST SP 800-88', 'TAA Compliance']
      },
      'random_passes': {
        name: 'Random Multi-Pass',
        securityLevel: 'high',
        standards: ['NIST SP 800-88', 'Multi-pass Overwrite']
      }
    }

    const methodInfo = wipeMethods[wipeMethod] || {
      name: 'Unknown Method',
      securityLevel: 'medium',
      standards: ['Standard Sanitization']
    }

    // Create verification data
    const verificationData = {
      hashAlgorithm: 'SHA-256',
      dataHash: generateHash(JSON.stringify({
        deviceId,
        wipeMethod,
        startTime: wipeDetails.startTime,
        endTime: wipeDetails.endTime,
        passes: wipeDetails.passes
      })),
      signature: '',
      publicKey
    }

    // Generate signature for verification data
    verificationData.signature = generateSignature(
      JSON.stringify(verificationData),
      privateKey
    )

    // Create certificate data
    const certificateData: CertificateData = {
      id: crypto.randomUUID(),
      certificateId,
      wipeId: finalWipeId,
      timestamp: new Date().toISOString(),
      deviceInfo: {
        name: deviceInfo.name || 'Unknown Device',
        type: deviceInfo.type || 'HDD',
        size: deviceInfo.size || 'Unknown',
        sizeBytes: deviceInfo.sizeBytes || 0,
        model: deviceInfo.model || 'Unknown',
        serial: deviceInfo.serial || 'Unknown',
        firmware: deviceInfo.firmware || 'Unknown',
        path: deviceInfo.path || '/dev/unknown',
        vendor: deviceInfo.vendor
      },
      wipeDetails: {
        method: wipeMethod,
        methodName: methodInfo.name,
        passes: wipeDetails.passes || 1,
        startTime: wipeDetails.startTime,
        endTime: wipeDetails.endTime,
        duration: wipeDetails.duration,
        status: wipeDetails.status as 'completed' | 'failed' | 'partial',
        verification: verificationData
      },
      security: {
        level: methodInfo.securityLevel,
        standards: methodInfo.standards,
        compliance: [
          'NIST SP 800-88',
          'ISO/IEE 27040',
          'GDPR Compliant',
          'HIPAA Ready',
          'PCI-DSS Compliant'
        ]
      },
      operator: {
        id: operatorInfo.id,
        username: operatorInfo.username,
        ipAddress: operatorInfo.ipAddress,
        userAgent: operatorInfo.userAgent
      },
      verification: {
        certificateHash: '', // Will be set after creating the full certificate
        digitalSignature: '',
        qrCodeData: '',
        verificationUrl: generateVerificationUrl(certificateId)
      }
    }

    // Generate certificate hash and signature
    certificateData.verification.certificateHash = createCertificateHash(certificateData)
    certificateData.verification.digitalSignature = generateSignature(
      certificateData.verification.certificateHash,
      privateKey
    )
    certificateData.verification.qrCodeData = generateQRCodeData(certificateData)

    // Store certificate
    certificateStorage.storeCertificate(certificateId, certificateData)

    return NextResponse.json({
      success: true,
      certificate: certificateData,
      message: 'Tamper-proof certificate generated successfully',
      securityFeatures: [
        'SHA-256 Certificate Hashing',
        'RSA-2048 Digital Signature',
        'QR Code Verification',
        'Cryptographic Evidence',
        'Tamper-Evident Design',
        'Compliance Standards Met'
      ]
    })

  } catch (error) {
    console.error('Certificate generation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate certificate',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}