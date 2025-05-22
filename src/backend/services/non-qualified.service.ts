import { Resolver } from 'did-resolver';
import { 
  verifyCredential as verifyCredentialJwt, 
  verifyPresentation as verifyPresentationJwt
} from 'did-jwt-vc';
import { VerificationResult } from './credential.service';

export class NonQualifiedService {
  private resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  async verifyVC(credential: string): Promise<VerificationResult> {
    try {
      const result = await verifyCredentialJwt(credential, this.resolver);
      const vc = result.verifiableCredential;

      return {
        issuedByUs: false,
        isValid: true,
        subject: {
          did: vc.credentialSubject.id || '',
          ...vc.credentialSubject,
        },
        isQualified: false,
      };
    } catch (error) {
      return {
        issuedByUs: false,
        isValid: false,
        errors: [`Error verifying credential: ${error}`],
      };
    }
  }

  async verifyVP(presentation: string): Promise<VerificationResult> {
    try {
      const result = await verifyPresentationJwt(presentation, this.resolver);
      return { 
        issuedByUs: false,
        isValid: result.verified, 
        subject: {}, 
        isQualified: false 
      };
    } catch (error) {
      return { 
        issuedByUs: false,
        isValid: false, 
        errors: [`Error verifying presentation: ${error}`] 
      };
    }
  }
}
