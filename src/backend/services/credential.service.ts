import { Resolver } from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';

import { QualifiedService } from './qualified.service';
import { NonQualifiedService } from './non-qualified.service';

export interface CertificateInfo {
  isValid: boolean;
  validFrom?: Date;
  validTo?: Date;
  chainValid?: boolean;
  isRevoked?: boolean;
  issuer?: string;
  subject?: string;
  signatureValid?: boolean;
}

export interface VerificationResult {
  issuedByUs: boolean;
  isValid: boolean;
  errors?: string[];
  subject?: any;
  isQualified?: boolean;
  certificateInfo?: CertificateInfo;
}

export interface IssuedCredential {
  jwt: string;
  decoded: any;
}

export function b64urlToUtf8(str: string) {
  return Buffer.from(str, 'base64url').toString();
}

export class CredentialService {
  private resolver: Resolver;
  private qualifiedService: QualifiedService;
  private nonQualifiedService: NonQualifiedService;

  constructor() {
    this.resolver = new Resolver({ ...getWebResolver() });
    this.qualifiedService = new QualifiedService(this.resolver);
    this.nonQualifiedService = new NonQualifiedService(this.resolver);
  }

  async analyzeCredential(credential: string | object): Promise<{
    isVP: boolean;
    isQualified: boolean;
    jwtToken?: string;
    payload?: any;
    objCredential?: any;
  }> {
    let jwtToken: string | undefined;
    let objCredential: any = credential;
    let isVP = false;
    let isQualified = false;
    let payload: any = null;

    if (typeof credential === 'string') {
      if (credential.startsWith('eyJ')) {
        jwtToken = credential;

        try {
          const parts = jwtToken.split('.');
          if (parts.length === 3) {
            const [headerB64, payloadB64] = parts;
            const headerStr = b64urlToUtf8(headerB64);
            const header = JSON.parse(headerStr);

            const payloadStr = b64urlToUtf8(payloadB64);
            payload = JSON.parse(payloadStr);

            if (payload.vp) {
              isVP = true;
              if (header.alg === 'RS256' && header.x5c) {
                isQualified = true;
              } else {
                const vpType = payload.vp.type;
                isQualified = Array.isArray(vpType) && vpType.includes('VPQualified');
              }
            } else if (payload.vc) {
              isVP = false;
              if (header.alg === 'RS256' && header.x5c) {
                isQualified = true;
              } else {
                const vcType = payload.vc.type;
                isQualified = Array.isArray(vcType) && vcType.includes('VCQualified');
              }
            }
          }
        } catch (error) {
        }
      } else {
        try {
          objCredential = JSON.parse(credential);

          if (objCredential.verifiableCredential) {
            isVP = true;
            isQualified = Array.isArray(objCredential.type) && objCredential.type.includes('VPQualified');
          } else {
            isVP = false;
            isQualified = Array.isArray(objCredential.type) && objCredential.type.includes('VCQualified');
          }
        } catch (error) {
          console.error('Failed to parse credential as JSON:', error);
        }
      }
    } else {
      if (objCredential.verifiableCredential) {
        isVP = true;
        isQualified = Array.isArray(objCredential.type) && objCredential.type.includes('VPQualified');
      } else {
        isVP = false;
        isQualified = Array.isArray(objCredential.type) && objCredential.type.includes('VCQualified');
      }
    }

    return {
      isVP,
      isQualified,
      jwtToken,
      payload,
      objCredential
    };
  }

  async verifyCredential(credential: string): Promise<VerificationResult> {
    const analysis = await this.analyzeCredential(credential);

    if (analysis.isVP) {
      console.error('Expected a VC but received a VP');
      return { issuedByUs: false, isValid: false, errors: ['Expected a VC but received a VP'] };
    }

    if (analysis.isQualified) {
      return this.qualifiedService.verifyVC(credential);
    } else {
      return this.nonQualifiedService.verifyVC(credential);
    }
  }

  async verifyPresentation(presentation: string): Promise<VerificationResult> {
    const analysis = await this.analyzeCredential(presentation);

    if (!analysis.isVP) {
      console.error('Expected a VP but received a VC');
      return { issuedByUs: false, isValid: false, errors: ['Expected a VP but received a VC'] };
    }

    if (analysis.isQualified) {
      return this.qualifiedService.verifyVP(presentation);
    } else {
      return this.nonQualifiedService.verifyVP(presentation);
    }
  }

  async issueCredential(
    issuerDid: string,
    subjectDid: string,
    type: string,
    claims: any,
    isQualified: boolean = false
  ): Promise<IssuedCredential> {
    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(now.getFullYear() + 1);

    const types = ['VerifiableCredential', type];
    if (isQualified) {
      types.push('VCQualified');
    }

    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1'
      ],
      id: `${issuerDid}#${Date.now()}`,
      type: types,
      issuer: issuerDid,
      issuanceDate: now.toISOString(),
      expirationDate: oneYearLater.toISOString(),
      credentialSubject: {
        id: subjectDid,
        ...claims
      }
    };

    return {
      jwt: 'mock.jwt.token',
      decoded: credential
    };
  }
}

export const verifyCredential = async (credential: string): Promise<VerificationResult> => {
  const service = new CredentialService();
  return service.verifyCredential(credential);
};

export const verifyPresentation = async (presentation: string): Promise<VerificationResult> => {
  const service = new CredentialService();
  return service.verifyPresentation(presentation);
};

export const issueCredential = async (
  issuerDid: string,
  subjectDid: string,
  type: string,
  claims: any,
  isQualified: boolean = false
): Promise<IssuedCredential> => {
  const service = new CredentialService();
  return service.issueCredential(issuerDid, subjectDid, type, claims, isQualified);
};
