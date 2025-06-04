// @ts-ignore
import * as EcdsaMultikey from '@digitalbazaar/ecdsa-multikey';
// @ts-ignore
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
// @ts-ignore
import { cryptosuite as ecdsaRdfc2019Cryptosuite } from '@digitalbazaar/ecdsa-rdfc-2019-cryptosuite';
// @ts-ignore
import * as vc from '@digitalbazaar/vc';
import { getDocumentLoader, didKeyDriverMultikey } from './document-loader';
import { retrieveKey, storeKey } from './encryption-service';

const ISSUER_KEY_ID = 'issuer_key';

export class VCService {
  private static instance: VCService;
  private keyPair: any = null;

  private constructor() {
  }

  public static getInstance(): VCService {
    if (!VCService.instance) {
      VCService.instance = new VCService();
    }
    return VCService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing VC service...');

      let storedKeyData = await retrieveKey(ISSUER_KEY_ID);

      if (storedKeyData) {
        console.log('Using existing issuer key pair');
        this.keyPair = await EcdsaMultikey.from(storedKeyData, {secretKey: true, publicKey: true});
      } else {
        console.log('Generating new issuer key pair');
        this.keyPair = await EcdsaMultikey.generate({curve: 'P-256'});

        const exportedKeyPair = await this.keyPair.export({publicKey: true, secretKey: true});
        await storeKey(ISSUER_KEY_ID, exportedKeyPair);
      }

      const {didDocument} = await didKeyDriverMultikey.fromKeyPair({
        verificationKeyPair: this.keyPair
      });

      this.keyPair.id = didDocument.assertionMethod[0];
      this.keyPair.controller = didDocument.id;

      console.log('VC service initialized with DID:', didDocument.id);
    } catch (error) {
      console.error('Error initializing VC service:', error);
      throw new Error(`Failed to initialize VC service: ${error}`);
    }
  }

  public async issueCredential(credentialData: any, type?: string | string[]): Promise<any> {
    try {
      if (!this.keyPair) {
        throw new Error('VC service not initialized. Call initialize() first.');
      }

      const docLoader = await getDocumentLoader();

      const subjectData = { ...credentialData };
      const subjectId = subjectData.id || `did:example:subject:${crypto.randomUUID()}`;

      if (subjectData.id) {
        delete subjectData.id;
      }

      const credentialSubject = {
        id: subjectId,
        ...subjectData
      };

      const credential = {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://www.w3.org/2018/credentials/examples/v1",
          "https://example.org/citizen/v1",
          "https://www.w3.org/2018/credentials/graduation/v1"
        ],
        "id": `urn:uuid:${crypto.randomUUID()}`,
        "type": [
          "VerifiableCredential"
        ],
        "issuer": this.keyPair.controller,
        "issuanceDate": new Date().toISOString(),
        "expirationDate": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
        "credentialSubject": credentialSubject
      };

      if (type) {
        if (Array.isArray(type)) {
          credential.type.push(...type);
        } else {
          credential.type.push(type);
        }
      }

      const vcSigningSuite = new DataIntegrityProof({
        signer: this.keyPair.signer(),
        date: new Date().toISOString(),
        cryptosuite: ecdsaRdfc2019Cryptosuite
      });

      const verifiableCredential = await vc.issue({
        credential,
        suite: vcSigningSuite,
        documentLoader: docLoader
      });

      const verificationSuite = new DataIntegrityProof({
        cryptosuite: ecdsaRdfc2019Cryptosuite
      });

      const verificationResult = await vc.verifyCredential({
        credential: verifiableCredential,
        suite: verificationSuite,
        documentLoader: docLoader
      });

      if (!verificationResult.verified) {
        console.error("Credential verification failed:", verificationResult.error);
        throw new Error("Credential verification failed");
      }

      return {
        success: true,
        credential: verifiableCredential,
        verified: true,
        verificationResult
      };
    } catch (error) {
      console.error("Error issuing credential:", error);
      return {
        success: false,
        message: `Error issuing credential: ${error}`
      };
    }
  }
}

export const vcService = VCService.getInstance();
