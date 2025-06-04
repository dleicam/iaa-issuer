// @ts-ignore
import * as vc from "@digitalbazaar/vc";
// @ts-ignore
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
// @ts-ignore
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
// @ts-ignore
import { cryptosuite as ecdsaRdfc2019Cryptosuite } from '@digitalbazaar/ecdsa-rdfc-2019-cryptosuite';
import { getDocumentLoader, addStaticContext, didKeyDriverMultikey } from './document-loader';
// @ts-ignore
import jsigs from 'jsonld-signatures';

const { AssertionProofPurpose, AuthenticationProofPurpose } = jsigs.purposes;

export class VPVerification {
  static processDidKeyVerificationMethod(verificationMethod: string) {
    try {
      const didKey = verificationMethod.split('#')[0];

      let publicKeyMultibase;
      if (verificationMethod.includes('#')) {
        publicKeyMultibase = verificationMethod.split('#')[1];
      } else {
        publicKeyMultibase = didKey.split(':')[2];
      }

      if (!publicKeyMultibase) {
        throw new Error(`Could not extract public key from verification method: ${verificationMethod}`);
      }

      const didDocument = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/multikey/v1"
        ],
        "id": didKey,
        "verificationMethod": [
          {
            "id": `${didKey}#${publicKeyMultibase}`,
            "type": "Multikey",
            "controller": didKey,
            "publicKeyMultibase": publicKeyMultibase
          }
        ],
        "authentication": [
          `${didKey}#${publicKeyMultibase}`
        ],
        "assertionMethod": [
          `${didKey}#${publicKeyMultibase}`
        ]
      };

      const vm = {
        id: verificationMethod,
        type: "Multikey",
        controller: didKey,
        publicKeyMultibase: publicKeyMultibase,
        '@context': 'https://w3id.org/security/multikey/v1'
      };

      addStaticContext(verificationMethod, vm);
      addStaticContext(didKey, didDocument);

      return new DataIntegrityProof({
        cryptosuite: ecdsaRdfc2019Cryptosuite
      });
    } catch (error) {
      throw new Error(`Error resolving did:key: ${error}`);
    }
  }

  static async verifyPresentation(
    presentation: any,
    challenge?: string,
    unsignedPresentation?: boolean
  ) {
    try {
      const effectiveChallenge = challenge || 'abc123';

      const actualPresentation = presentation.presentation || presentation;

      const documentLoader = await getDocumentLoader();
      if (!documentLoader) {
        throw new Error('Document loader initialization failed');
      }

      let verifyingSuite;

      if (actualPresentation.proof && actualPresentation.proof.verificationMethod &&
          actualPresentation.proof.verificationMethod.startsWith('did:key:')) {
        verifyingSuite = this.processDidKeyVerificationMethod(actualPresentation.proof.verificationMethod);
      } else {
        // Default to Ed25519Signature2020 for other verification methods
        verifyingSuite = new Ed25519Signature2020();
      }

      const authenticationPurpose = new AuthenticationProofPurpose({
        challenge: effectiveChallenge
      });

      const assertionPurpose = new AssertionProofPurpose();

      const verificationResult = await vc.verify({
        presentation: actualPresentation,
        suite: verifyingSuite,
        documentLoader,
        presentationPurpose: authenticationPurpose,
        unsignedPresentation: unsignedPresentation !== undefined ? unsignedPresentation : false
      });

      if (verificationResult.verified) {
        verificationResult.originalPresentation = presentation;
        return verificationResult;
      }

      console.log('Verification failed with AuthenticationProofPurpose, trying with AssertionProofPurpose...');
      const assertionResult = await vc.verify({
        presentation: actualPresentation,
        suite: verifyingSuite,
        documentLoader,
        presentationPurpose: assertionPurpose,
        unsignedPresentation: unsignedPresentation !== undefined ? unsignedPresentation : false
      });

      if (assertionResult.verified) {
        assertionResult.originalPresentation = presentation;
      }

        return assertionResult;
    } catch (error) {
      console.error('Error during verification:', error);
    }
  }

  static extractVpData(verificationResult: any) {
    if (!verificationResult || !verificationResult.verified) {
      return null;
    }

    // Extract the VP data from the verification result
    const { presentation } = verificationResult;

    if (!presentation) {
      return null;
    }

    // Handle the case where VP is nested inside a "presentation" property
    return presentation.presentation || presentation;
  }

  /**
   * Checks if a challenge is present in a VP
   * @param vp - The verifiable presentation
   * @param challenge - The challenge to check for
   * @returns Whether the challenge is present
   */
  static isChallengePresent(vp: any, challenge: string): boolean {
    if (!vp || !challenge) {
      return false;
    }

    // Handle the case where VP is nested inside a "presentation" property
    const presentation = vp.presentation || vp;

    // Check for challenge in the VP
    if (presentation.challenge === challenge || presentation.nonce === challenge || presentation.domain === challenge) {
      return true;
    }

    // Check in the credentials if not found at top level
    if (presentation.verifiableCredential && Array.isArray(presentation.verifiableCredential)) {
      for (const vc of presentation.verifiableCredential) {
        if (vc.challenge === challenge || vc.nonce === challenge || vc.domain === challenge) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extracts the employee name from a Verifiable Presentation
   * @param vp - The verifiable presentation
   * @returns The employee name or null if not found
   */
  static extractEmployeeName(vp: any): string | null {
    // Handle the case where VP is nested inside a "presentation" property
    const presentation = vp.presentation || vp;

    if (!presentation || !presentation.verifiableCredential || !Array.isArray(presentation.verifiableCredential) || presentation.verifiableCredential.length === 0) {
      return null;
    }

    const credential = presentation.verifiableCredential[0];

    if (!credential || !credential.credentialSubject || !credential.credentialSubject.name) {
      return null;
    }

    return credential.credentialSubject.name;
  }
}
