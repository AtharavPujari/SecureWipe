import { NextRequest, NextResponse } from 'next/server';
import { CertificateData, CertificateGenerationRequest } from '@/lib/certificate';
import { createHash, randomBytes, createSign, generateKeyPairSync } from 'crypto';

// In-memory storage for certificates (in production, use a database)
const certificates = new Map<string, CertificateData>();

export async function POST(request: NextRequest) {
  try {
    const body: CertificateGenerationRequest = await request.json();
    
    // Validate required fields
    const requiredFields = ['deviceId', 'deviceInfo', 'wipeMethod', 'wipeSecurityLevel', 'wipeDuration'];
    for (const field of requiredFields) {
      if (!body[field as keyof CertificateGenerationRequest]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Generate RSA key pair for signing
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Create certificate data
    const certificateId = `cert_${randomBytes(16).toString('hex')}`;
    const wipeDate = new Date().toISOString();
    
    // Create data string for hashing
    const dataString = JSON.stringify({
      deviceId: body.deviceId,
      deviceInfo: body.deviceInfo,
      wipeMethod: body.wipeMethod,
      wipeSecurityLevel: body.wipeSecurityLevel,
      wipeDate,
      wipeDuration: body.wipeDuration,
      verificationStatus: body.verificationStatus
    });

    // Generate SHA-256 hash
    const hash = createHash('sha256').update(dataString).digest('hex');

    // Create digital signature
    const sign = createSign('RSA-SHA256');
    sign.update(dataString);
    const signature = sign.sign(privateKey, 'hex');

    // Generate QR code data (contains verification URL)
    const qrCodeData = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/certificates/verify/${certificateId}`;

    // Create certificate object
    const certificate: CertificateData = {
      id: certificateId,
      deviceId: body.deviceId,
      deviceInfo: body.deviceInfo,
      wipeMethod: body.wipeMethod,
      wipeSecurityLevel: body.wipeSecurityLevel,
      wipeDate,
      wipeDuration: body.wipeDuration,
      verificationStatus: body.verificationStatus,
      hash,
      signature,
      publicKey: publicKey,
      complianceStandards: body.complianceStandards || [],
      certificateUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/certificate/${certificateId}`,
      qrCodeData
    };

    // Store certificate
    certificates.set(certificateId, certificate);

    // Return certificate without sensitive data
    const { publicKey, ...certificateResponse } = certificate;
    
    return NextResponse.json({
      success: true,
      certificate: certificateResponse
    });

  } catch (error) {
    console.error('Certificate generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Certificate generation endpoint. Use POST to generate certificates.',
    supportedMethods: ['POST']
  });
}
