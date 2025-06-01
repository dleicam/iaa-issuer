import {
  Credential,
  CredentialAttributes,
  CredentialModel,
  RevocationEntry,
  RevocationEntryAttributes,
  RevocationEntryModel,
} from '../db/database';

// Import the original CredentialService for its VC generation logic
import { CredentialService as CredentialGenerationService, IssuedCredential } from './credential.service';

type CredentialStorageAttributes = Omit<CredentialAttributes, 'id' | 'isRevoked' | 'revocationDate' | 'revocationReason'>;


export class IssuerService {
  private credentialGenerationService: CredentialGenerationService;

  constructor() {
    this.credentialGenerationService = new CredentialGenerationService();
  }

  /**
   * Issues a new Verifiable Credential (using CredentialGenerationService)
   * and stores its details in the database.
   * @param issuerDid The DID of the issuer.
   * @param subjectDid The DID of the subject.
   * @param type The primary type of the credential (e.g., "EmployeeCredential").
   * @param claims The claims specific to the credentialSubject.
   * @param isQualified Whether the credential is to be considered qualified.
   * @returns The issued credential object (JWT and decoded payload).
   */
  public async issueAndStoreCredential(
    issuerDid: string,
    subjectDid: string,
    type: string, // This is the primary type for the VC being generated
    claims: any,
    isQualified: boolean = false
  ): Promise<IssuedCredential> {
    try {
      // 1. Generate the Verifiable Credential using the generation service
      const generatedVc: IssuedCredential = await this.credentialGenerationService.issueCredential(
        issuerDid,
        subjectDid,
        type, // Passed to generation service
        claims,
        isQualified
      );

      // 2. Prepare data for database storage from the generated VC
      // The 'id' in generatedVc.decoded.id is the VC's actual ID (e.g., UUID or URI)
      // This will be stored in our `vcId` column.
      if (!generatedVc.decoded.id) {
        throw new Error('Generated Verifiable Credential is missing an "id" property in its payload.');
      }

      const credentialDataForDb: CredentialStorageAttributes = {
        vcId: generatedVc.decoded.id,
        credentialType: Array.isArray(generatedVc.decoded.type) ? generatedVc.decoded.type.join(', ') : generatedVc.decoded.type,
        sub: generatedVc.decoded.credentialSubject.id || subjectDid, // Fallback to subjectDid if not in credentialSubject
        iss: generatedVc.decoded.issuer,
        nbf: new Date(generatedVc.decoded.issuanceDate),
        exp: generatedVc.decoded.expirationDate ? new Date(generatedVc.decoded.expirationDate) : undefined,
        kid: generatedVc.decoded.proof?.verificationMethod?.split('#')[1] || // Attempt to get kid from proof
             (generatedVc.decoded.verificationMethod && generatedVc.decoded.verificationMethod.length > 0 && generatedVc.decoded.verificationMethod[0].id?.split('#')[1]) || // Fallback for older W3C VC spec
             undefined
      };

      // 3. Store the credential in the database
      // We cast because 'create' expects a full set of attributes potentially
      const newDbCredential = await Credential.create(credentialDataForDb as CredentialAttributes);
      console.log(`Credential (vcId: ${newDbCredential.vcId}) stored in DB with internal ID: ${newDbCredential.id}`);

      return generatedVc;

    } catch (error) {
      console.error('Error in issueAndStoreCredential:', this.formatError(error));
      throw new Error('Failed to issue and store credential.');
    }
  }

  /**
   * Revokes an issued credential.
   * @param vcId - The ID of the Verifiable Credential (from its payload, stored in our vcId column).
   * @param reason - The reason for revocation.
   * @returns True if the credential was found and revoked, false otherwise.
   */
  public async revokeCredential(vcId: string, reason: string): Promise<boolean> {
    try {
      // Find the credential by its vcId (the ID within the VC payload)
      const credentialToRevoke = await Credential.findOne({ where: { vcId: vcId } });

      if (!credentialToRevoke) {
        console.warn(`Credential with vcId ${vcId} not found for revocation.`);
        return false;
      }

      if (credentialToRevoke.isRevoked) {
        console.warn(`Credential with vcId ${vcId} is already revoked.`);
        // Optionally, update reason or date if needed, or just return true
        return true;
      }

      const revocationDate = new Date();

      // Update the credential record
      await credentialToRevoke.update({
        isRevoked: true,
        revocationDate: revocationDate,
        revocationReason: reason,
      });

      // Create an entry in the RevocationEntry table
      // Note: credentialId here is the PK of our Credential table (credentialToRevoke.id)
      await RevocationEntry.create({
        credentialId: credentialToRevoke.id,
        revokeDate: revocationDate,
        justification: reason,
      } as RevocationEntryAttributes);

      console.log(`Credential with vcId ${vcId} (DB ID: ${credentialToRevoke.id}) successfully revoked.`);
      return true;

    } catch (error) {
      console.error(`Error revoking credential with vcId ${vcId}:`, this.formatError(error));
      throw new Error('Failed to revoke credential.');
    }
  }

  /**
   * Retrieves a stored credential by its Verifiable Credential ID (vcId).
   * @param vcId - The ID from the VC payload.
   * @returns The credential database record if found, otherwise null.
   */
  public async getIssuedCredentialByVcId(vcId: string): Promise<CredentialModel | null> {
    try {
      const credential = await Credential.findOne({ where: { vcId: vcId } });
      return credential;
    } catch (error) {
      console.error(`Error fetching issued credential with vcId ${vcId}:`, this.formatError(error));
      throw new Error('Failed to fetch issued credential by vcId.');
    }
  }

  /**
   * Retrieves a stored credential by its internal database primary key.
   * @param dbId - The internal database UUID of the credential record.
   * @returns The credential database record if found, otherwise null.
   */
  public async getIssuedCredentialByDbId(dbId: string): Promise<CredentialModel | null> {
    try {
      const credential = await Credential.findByPk(dbId);
      return credential;
    } catch (error)      {
      console.error(`Error fetching issued credential with DB ID ${dbId}:`, this.formatError(error));
      throw new Error('Failed to fetch issued credential by DB ID.');
    }
  }


  /**
   * Retrieves all issued credentials stored in the database.
   * @returns An array of credential database records.
   */
  public async getAllIssuedCredentials(): Promise<CredentialModel[]> {
    try {
      const credentials = await Credential.findAll();
      return credentials;
    } catch (error) {
      console.error('Error fetching all issued credentials:', this.formatError(error));
      throw new Error('Failed to fetch all issued credentials.');
    }
  }

  /**
   * Retrieves the revocation list.
   * Optionally includes details of the revoked credential.
   * @param includeCredentialDetails - Whether to include associated credential data.
   * @returns An array of revocation entries.
   */
  public async getRevocationList(includeCredentialDetails: boolean = false): Promise<RevocationEntryModel[]> {
    try {
      const findOptions: any = {};
      if (includeCredentialDetails) {
        findOptions.include = [{
          model: Credential,
          as: 'credential', // Must match the alias in RevocationEntry.belongsTo(Credential)
        }];
      }
      const revocationList = await RevocationEntry.findAll(findOptions);
      return revocationList;
    } catch (error) {
      console.error('Error fetching revocation list:', this.formatError(error));
      throw new Error('Failed to fetch revocation list.');
    }
  }

  /**
   * Checks if a specific credential (by its vcId) is revoked.
   * @param vcId - The ID from the VC payload.
   * @returns True if revoked, false if not revoked or not found.
   */
  public async isCredentialRevoked(vcId: string): Promise<boolean> {
    try {
      const credential = await Credential.findOne({
        where: { vcId: vcId },
        attributes: ['isRevoked'], // Only fetch the 'isRevoked' field for efficiency
      });
      return credential ? credential.isRevoked : false; // If not found, consider it not revoked by this issuer
    } catch (error) {
      console.error(`Error checking revocation status for vcId ${vcId}:`, this.formatError(error));
      // Depending on policy, an error might mean "assume revoked" or "status unknown"
      // For now, re-throwing, but in a verification flow, this might return true.
      throw new Error('Failed to check credential revocation status.');
    }
  }

  /**
   * Retrieves the Issuer's public key.
   * For MVP, this might be hardcoded or come from an environment variable.
   * In a real system, this would be managed more robustly (e.g., DID Document resolution).
   * @returns A string representing the public key (e.g., PEM format).
   */
  public async getIssuerPublicKey(): Promise<string> {
    // This is a placeholder. Replace with actual key retrieval logic.
    // Example: Reading from an environment variable
    const issuerPublicKey = process.env.ISSUER_PUBLIC_KEY_PEM;
    if (!issuerPublicKey) {
      console.warn('ISSUER_PUBLIC_KEY_PEM environment variable is not set.');
      throw new Error('Issuer public key not configured.');
    }
    return issuerPublicKey;
  }


  /**
   * Helper to format error messages for logging.
   * @param error - The error object.
   * @returns A string representation of the error message.
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      if ((error as any).errors && Array.isArray((error as any).errors)) {
        return (error as any).errors.map((e: any) => e.message).join(', ');
      }
      return error.message;
    }
    return String(error);
  }
}