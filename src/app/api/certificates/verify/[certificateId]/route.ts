import { NextRequest, NextResponse } from 'next/server'
import { verifySignature, verifyCertificateIntegrity } from '@/lib/crypto'
import { CertificateVerification } from '@/types/certificate'
import { certificateStorage } from '@/lib/certificate-storage'

// In-memory storage (same as generate endpoint)
const keyPairs = new Map<string, { publicKey: string; privateKey: string }>()

export async function GET(
  request: NextRequest,
  { params }: { params: { certificateId: string } }
) {
  try {
    const { certificateId } = params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Get certificate
    const certificate = certificateStorage.getCertificate(certificateId)
    if (!certificate) {
      return NextResponse.json(
        { success: false, error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Perform comprehensive verification
    const verification = await verifyCertificate(certificate)

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        verification,
        certificate: {
          id: certificate.id,
          certificateId: certificate.certificateId,
          timestamp: certificate.timestamp,
          deviceInfo: {
            name: certificate.deviceInfo.name,
            type: certificate.deviceInfo.type,
            serial: certificate.deviceInfo.serial
          },
          wipeDetails: {
            methodName: certificate.wipeDetails.methodName,
            status: certificate.wipeDetails.status,
            duration: certificate.wipeDetails.duration
          },
          verificationUrl: certificate.verification.verificationUrl
        }
      })
    }

    // For other formats, return basic verification result
    return NextResponse.json({
      valid: verification.isValid,
      certificateId: certificate.certificateId,
      verifiedAt: verification.verifiedAt,
      securityLevel: certificate.security.level
    })

  } catch (error) {
    console.error('Certificate verification error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to verify certificate',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { certificateId: string } }
) {
  try {
    const { certificateId } = params
    const { publicKey, signature } = await request.json()

    // Get certificate
    const certificate = certificateStorage.getCertificate(certificateId)
    if (!certificate) {
      return NextResponse.json(
        { success: false, error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Third-party verification with provided public key
    const verification = await verifyCertificateWithKey(certificate, publicKey, signature)

    return NextResponse.json({
      success: true,
      verification,
      message: 'Third-party verification completed'
    })

  } catch (error) {
    console.error('Third-party verification error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform third-party verification',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function verifyCertificate(certificate: any): Promise<CertificateVerification> {
  const errors: string[] = []
  const verificationDetails = {
    signatureValid: false,
    hashValid: false,
    timestampValid: false,
    deviceInfoValid: false
  }

  try {
    // 1. Verify certificate integrity
    const integrityValid = verifyCertificateIntegrity(certificate)
    verificationDetails.hashValid = integrityValid
    if (!integrityValid) {
      errors.push('Certificate integrity check failed')
    }

    // 2. Verify digital signature
    const sessionId = 'default' // In production, get from certificate or context
    const keyPair = certificateStorage.getKeyPair(sessionId)
    if (keyPair) {
      const signatureValid = verifySignature(
        certificate.verification.certificateHash,
        certificate.verification.digitalSignature,
        keyPair.publicKey
      )
      verificationDetails.signatureValid = signatureValid
      if (!signatureValid) {
        errors.push('Digital signature verification failed')
      }
    } else {
      errors.push('Verification key not found')
    }

    // 3. Verify timestamp (not too old or in future)
    const certTimestamp = new Date(certificate.timestamp)
    const now = new Date()
    const timeDiff = now.getTime() - certTimestamp.getTime()
    const oneYear = 365 * 24 * 60 * 60 * 1000
    
    verificationDetails.timestampValid = timeDiff > 0 && timeDiff < oneYear
    if (!verificationDetails.timestampValid) {
      errors.push('Certificate timestamp is invalid')
    }

    // 4. Verify device information completeness
    const requiredDeviceFields = ['name', 'type', 'serial', 'model']
    const deviceInfoComplete = requiredDeviceFields.every(field => 
      certificate.deviceInfo[field] && certificate.deviceInfo[field].toString().length > 0
    )
    verificationDetails.deviceInfoValid = deviceInfoComplete
    if (!deviceInfoComplete) {
      errors.push('Device information is incomplete')
    }

    // 5. Verify wipe details
    if (!certificate.wipeDetails.method || !certificate.wipeDetails.status) {
      errors.push('Wipe details are incomplete')
    }

    return {
      isValid: errors.length === 0,
      certificateId: certificate.certificateId,
      verifiedAt: new Date().toISOString(),
      verificationDetails,
      errors: errors.length > 0 ? errors : undefined
    }

  } catch (error) {
    return {
      isValid: false,
      certificateId: certificate.certificateId,
      verifiedAt: new Date().toISOString(),
      verificationDetails,
      errors: ['Verification process failed', error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

async function verifyCertificateWithKey(
  certificate: any, 
  publicKey: string, 
  signature: string
): Promise<CertificateVerification> {
  const errors: string[] = []
  const verificationDetails = {
    signatureValid: false,
    hashValid: false,
    timestampValid: false,
    deviceInfoValid: false
  }

  try {
    // Verify with provided public key
    const signatureValid = verifySignature(
      certificate.verification.certificateHash,
      signature,
      publicKey
    )
    verificationDetails.signatureValid = signatureValid
    if (!signatureValid) {
      errors.push('Third-party signature verification failed')
    }

    // Basic integrity checks
    const integrityValid = verifyCertificateIntegrity(certificate)
    verificationDetails.hashValid = integrityValid
    if (!integrityValid) {
      errors.push('Certificate integrity check failed')
    }

    // Timestamp validation
    const certTimestamp = new Date(certificate.timestamp)
    const now = new Date()
    const timeDiff = now.getTime() - certTimestamp.getTime()
    verificationDetails.timestampValid = timeDiff > 0 && timeDiff < (365 * 24 * 60 * 60 * 1000)

    return {
      isValid: errors.length === 0,
      certificateId: certificate.certificateId,
      verifiedAt: new Date().toISOString(),
      verificationDetails,
      errors: errors.length > 0 ? errors : undefined
    }

  } catch (error) {
    return {
      isValid: false,
      certificateId: certificate.certificateId,
      verifiedAt: new Date().toISOString(),
      verificationDetails,
      errors: ['Third-party verification failed', error instanceof Error ? error.message : 'Unknown error']
    }
  }
}