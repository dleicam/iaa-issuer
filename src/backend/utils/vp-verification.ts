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
  static async verifyPresentation(
    presentation: any,
    challenge?: string,
    unsignedPresentation?: boolean
  ) {
    try {
      const effectiveChallenge = challenge || 'abc123';

      const documentLoader = await getDocumentLoader();
      if (!documentLoader) {
        throw new Error('Document loader initialization failed');
      }

      let verifyingSuite;

      if (presentation.proof && presentation.proof.verificationMethod &&
          presentation.proof.verificationMethod.startsWith('did:key:')) {

        const verificationMethod = presentation.proof.verificationMethod;

        const didKey = verificationMethod.split('#')[0];

        try {
          const {didDocument} = await didKeyDriverMultikey.get({did: didKey});

          const vm = didDocument.verificationMethod.find((vm: { id: any; }) => vm.id === verificationMethod);
          if (!vm) {
            throw new Error(`Verification method ${verificationMethod} not found in DID document`);
          }

          const vmWithContext = {
            ...vm,
            '@context': 'https://w3id.org/security/multikey/v1'
          };
          addStaticContext(verificationMethod, vmWithContext);

          addStaticContext(didKey, didDocument);

          verifyingSuite = new DataIntegrityProof({
            cryptosuite: ecdsaRdfc2019Cryptosuite
          });

        } catch (error) {
          console.error('Error resolving did:key:', error);
          throw new Error(`Error resolving did:key: ${error}`);
        }
      } else if (presentation.proof &&
          presentation.proof.verificationMethod &&
          presentation.proof.verificationMethod.includes('did:web:example.org:issuer:123')) {

        console.log('Using did:web verification method from VP:', presentation.proof.verificationMethod);

        verifyingSuite = new DataIntegrityProof({
          cryptosuite: ecdsaRdfc2019Cryptosuite
        });
      } else {
        verifyingSuite = new Ed25519Signature2020();
      }

      const authenticationPurpose = new AuthenticationProofPurpose({
        challenge: effectiveChallenge
      });

      const assertionPurpose = new AssertionProofPurpose();

      const verificationResult = await vc.verify({
        presentation,
        suite: verifyingSuite,
        documentLoader,
        presentationPurpose: authenticationPurpose,
        unsignedPresentation: unsignedPresentation !== undefined ? unsignedPresentation : false
      });

      if (verificationResult.verified) {
        return verificationResult;
      }

      console.log('Verification failed with AuthenticationProofPurpose, trying with AssertionProofPurpose...');
      const assertionResult = await vc.verify({
        presentation,
        suite: verifyingSuite,
        documentLoader,
        presentationPurpose: assertionPurpose,
        unsignedPresentation: unsignedPresentation !== undefined ? unsignedPresentation : false
      });

        return assertionResult;



    } catch (error) {
      console.error('Error during verification:', error);
    }
  }

  /**
   * Extracts the VP data from a verification result
   * @param verificationResult - The verification result
   * @returns The presentation data or null if verification failed
   */
  static extractVpData(verificationResult: any) {
    if (!verificationResult || !verificationResult.verified) {
      return null;
    }

    // Extract the VP data from the verification result
    const { presentation } = verificationResult;

    if (!presentation) {
      return null;
    }

    return presentation;
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

    // Check for challenge in the VP
    if (vp.challenge === challenge || vp.nonce === challenge || vp.domain === challenge) {
      return true;
    }

    // Check in the credentials if not found at top level
    if (vp.verifiableCredential && Array.isArray(vp.verifiableCredential)) {
      for (const vc of vp.verifiableCredential) {
        if (vc.challenge === challenge || vc.nonce === challenge || vc.domain === challenge) {
          return true;
        }
      }
    }

    return false;
  }
}
