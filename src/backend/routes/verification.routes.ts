import express from 'express';
import * as vc from '@digitalbazaar/vc';
import * as EcdsaMultikey from '@digitalbazaar/ecdsa-multikey';
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {cryptosuite as ecdsaRdfc2019Cryptosuite} from '@digitalbazaar/ecdsa-rdfc-2019-cryptosuite';
import {getDocumentLoader, addStaticContext, didWebDriver, didKeyDriverMultikey} from '../utils/document-loader';
import {retrieveDecryptedData} from '../utils/encryption-service';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { presentation: verifiablePresentation } = req.body;

    if (!verifiablePresentation) {
      return res.status(400).json({
        success: false,
        message: 'No verifiable presentation provided'
      });
    }

    const challenge = req.body.challenge || 'abc123';

    const documentLoader = await getDocumentLoader();
    if (!documentLoader) {
      return res.status(500).json({
        success: false,
        message: 'Document loader initialization failed'
      });
    }

    let vpVerifyingSuite;

    // Extract the verification method from the VP
    if (verifiablePresentation.proof && verifiablePresentation.proof.verificationMethod &&
        verifiablePresentation.proof.verificationMethod.startsWith('did:key:')) {

      const verificationMethod = verifiablePresentation.proof.verificationMethod;
      console.log('Verification method from VP:', verificationMethod);

      // Extract the DID without the fragment
      const didKey = verificationMethod.split('#')[0];
      console.log('Extracted DID key:', didKey);

      try {
        // Use the did:key driver to resolve the DID document properly
        const {didDocument} = await didKeyDriverMultikey.get({did: didKey});
        console.log('Resolved DID document:', JSON.stringify(didDocument, null, 2));

        // Find the verification method in the DID Document
        const vm = didDocument.verificationMethod.find(vm => vm.id === verificationMethod);
        if (!vm) {
          throw new Error(`Verification method ${verificationMethod} not found in DID document`);
        }

        // Add the verification method to the document loader with proper context
        const vmWithContext = {
          ...vm,
          '@context': 'https://w3id.org/security/multikey/v1'
        };
        addStaticContext(verificationMethod, vmWithContext);

        // Add the DID document to the document loader
        addStaticContext(didKey, didDocument);

        // Set up the verification suite
        vpVerifyingSuite = new DataIntegrityProof({
          cryptosuite: ecdsaRdfc2019Cryptosuite
        });

        console.log('Successfully set up verification for did:key');
      } catch (error) {
        console.error('Error resolving did:key:', error);
        return res.status(500).json({
          success: false,
          message: `Error resolving did:key: ${error.message}`
        });
      }
    } else if (verifiablePresentation.proof &&
        verifiablePresentation.proof.verificationMethod &&
        verifiablePresentation.proof.verificationMethod.includes('did:web:example.org:issuer:123')) {

      console.log('Using did:web verification method from VP:', verifiablePresentation.proof.verificationMethod);

      // This is the static did:web case - the document loader should already have the DID document
      vpVerifyingSuite = new DataIntegrityProof({
        cryptosuite: ecdsaRdfc2019Cryptosuite
      });

    } else {
      // Fallback to the original implementation if not a did:key or did:web
      const VP_DID = 'did:web:example.org:issuer:123';
      const VP_DID_URL = 'https://example.org/issuer/123';

      let vpEcdsaKeyPair;
      try {
        const storedKeyPair = await retrieveDecryptedData("vpEcdsaKeyPair");
        vpEcdsaKeyPair = await EcdsaMultikey.from(storedKeyPair);
      } catch (error) {
        vpEcdsaKeyPair = await EcdsaMultikey.generate({ curve: 'P-384' });
      }

      const {
        didDocument: vpDidDocument, methodFor: vpMethodFor
      } = await didWebDriver.fromKeyPair({
        url: VP_DID_URL,
        verificationKeyPair: vpEcdsaKeyPair
      });

      const didWebKey = vpMethodFor({purpose: 'authentication'});
      vpEcdsaKeyPair.id = didWebKey.id;
      vpEcdsaKeyPair.controller = vpDidDocument.id;

      vpVerifyingSuite = new DataIntegrityProof({
        cryptosuite: ecdsaRdfc2019Cryptosuite
      });

      addStaticContext(VP_DID, vpDidDocument);

      const vpDidVm = structuredClone(vpDidDocument.verificationMethod[0]);
      vpDidVm['@context'] = 'https://w3id.org/security/multikey/v1';
      addStaticContext(vpDidVm.id, vpDidVm);
    }

    console.log('About to verify presentation with challenge:', challenge);

    const verifyPresentationResult = await vc.verify({
      presentation: verifiablePresentation,
      challenge,
      suite: vpVerifyingSuite,
      documentLoader
    });

    console.log('Verification result verified:', verifyPresentationResult.verified);

    return res.status(200).json({
      success: true,
      verified: verifyPresentationResult.verified,
      verificationResult: verifyPresentationResult
    });
  } catch (error) {
    console.error('Error verifying presentation:', error);
    return res.status(500).json({
      success: false,
      message: `Error verifying presentation: ${error.message}`
    });
  }
});

export default router;