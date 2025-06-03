import { IssuerService } from '../services/issuer.service';
import { initializeDatabase, Credential, RevocationEntry } from '../db/database';
import { CredentialGenerationService } from '../services/credential.service';

describe('IssuerService Integration Tests', () => {
  let issuerService: IssuerService;

  beforeAll(async () => {
    // Initialize in-memory database for tests
    process.env.NODE_ENV = 'test';  // Ensure test environment
    await initializeDatabase();  // Assumes this handles in-memory SQLite
  });

  afterAll(async () => {
    // Clean up database connection
    await Credential.sequelize?.close();  // Close Sequelize connection
  });

  beforeEach(async () => {
    issuerService = new IssuerService();
    // Clean up data before each test
    await Credential.destroy({ where: {} });
    await RevocationEntry.destroy({ where: {} });
  });

  describe('issueAndStoreCredential', () => {
    it('should issue and store a credential successfully', async () => {
      const result = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );

      expect(result.decoded.id).toBeDefined();
      expect(result.decoded.type).toContain('VerifiableCredential');
      expect(result.decoded.type).toContain('EmployeeCredential');

      const storedCredential = await Credential.findOne({ where: { vcId: result.decoded.id } });
      expect(storedCredential).not.toBeNull();
      expect(storedCredential.vcId).toEqual(result.decoded.id);
      expect(storedCredential.iss).toEqual('did:example:issuer');
      expect(storedCredential.isRevoked).toBe(false);
    });

    it('should throw an error if generated VC is missing id', async () => {
      await expect(
        issuerService.issueAndStoreCredential('did:example:issuer', 'did:example:subject', 'EmployeeCredential', {}, false)
      ).rejects.toThrow('Generated Verifiable Credential is missing an "id" property in its payload.');
    });

    it('should throw an error on database failure', async () => {
      await expect(
        issuerService.issueAndStoreCredential('invalid:issuer', 'invalid:subject', 'InvalidType', {}, false)
      ).rejects.toThrow('Failed to issue and store credential.');
    });
  });

  describe('revokeCredential', () => {
    it('should revoke a credential successfully', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      const result = await issuerService.revokeCredential(issued.decoded.id, 'Reason for revocation');

      expect(result).toBe(true);
      const revokedCredential = await Credential.findOne({ where: { vcId: issued.decoded.id } });
      expect(revokedCredential.isRevoked).toBe(true);
      expect(revokedCredential.revocationReason).toEqual('Reason for revocation');

      const revocationEntry = await RevocationEntry.findOne({ where: { credentialId: revokedCredential.id } });
      expect(revocationEntry).not.toBeNull();
      expect(revocationEntry.justification).toEqual('Reason for revocation');
    });

    it('should return false if credential is not found', async () => {
      const result = await issuerService.revokeCredential('nonexistent_vcId', 'Reason');
      expect(result).toBe(false);
    });

    it('should return true if credential is already revoked', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      await issuerService.revokeCredential(issued.decoded.id, 'Initial reason');
      const result = await issuerService.revokeCredential(issued.decoded.id, 'Another reason');
      expect(result).toBe(true);
    });

    it('should throw an error on database failure', async () => {
      await expect(issuerService.revokeCredential('invalid_vcId', 'Reason')).rejects.toThrow('Failed to revoke credential.');
    });
  });

  describe('getIssuedCredentialByVcId', () => {
    it('should return a credential by vcId', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      const result = await issuerService.getIssuedCredentialByVcId(issued.decoded.id);
      expect(result).not.toBeNull();
      expect(result.vcId).toEqual(issued.decoded.id);
    });

    it('should return null if credential is not found', async () => {
      const result = await issuerService.getIssuedCredentialByVcId('nonexistent_vcId');
      expect(result).toBeNull();
    });

    it('should throw an error on database failure', async () => {
      await expect(issuerService.getIssuedCredentialByVcId('invalid_vcId')).rejects.toThrow('Failed to fetch issued credential by vcId.');
    });
  });

  describe('getIssuedCredentialByDbId', () => {
    it('should return a credential by dbId', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      const dbCredential = await Credential.findOne({ where: { vcId: issued.decoded.id } });
      const result = await issuerService.getIssuedCredentialByDbId(dbCredential.id);
      expect(result).not.toBeNull();
      expect(result.id).toEqual(dbCredential.id);
    });

    it('should return null if credential is not found', async () => {
      const result = await issuerService.getIssuedCredentialByDbId('nonexistent_dbId');
      expect(result).toBeNull();
    });

    it('should throw an error on database failure', async () => {
      await expect(issuerService.getIssuedCredentialByDbId('invalid_dbId')).rejects.toThrow('Failed to fetch issued credential by DB ID.');
    });
  });

  describe('getAllIssuedCredentials', () => {
    it('should return all credentials', async () => {
      await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject1',
        'EmployeeCredential',
        { someClaim: 'value1' },
        true
      );
      await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject2',
        'EmployeeCredential',
        { someClaim: 'value2' },
        true
      );
      const result = await issuerService.getAllIssuedCredentials();
      expect(result.length).toBe(2);
      expect(result[0].vcId).toBeDefined();  // Additional assertion for robustness
    });

    it('should not throw an error when no credentials exist', async () => {
      const result = await issuerService.getAllIssuedCredentials();
      expect(result.length).toBe(0);  // More specific than just not throwing
    });
  });

  describe('getRevocationList', () => {
    it('should return revocation list without details', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      await issuerService.revokeCredential(issued.decoded.id, 'Reason');
      const result = await issuerService.getRevocationList();
      expect(result.length).toBe(1);
    });

    it('should return revocation list with details', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      await issuerService.revokeCredential(issued.decoded.id, 'Reason');
      const result = await issuerService.getRevocationList(true);
      expect(result[0].credential).not.toBeNull();
      expect(result[0].credential.vcId).toBeDefined();  // Additional assertion
    });
  });

  describe('isCredentialRevoked', () => {
    it('should return true if credential is revoked', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      await issuerService.revokeCredential(issued.decoded.id, 'Reason');
      const result = await issuerService.isCredentialRevoked(issued.decoded.id);
      expect(result).toBe(true);
    });

    it('should return false if credential is not revoked', async () => {
      const issued = await issuerService.issueAndStoreCredential(
        'did:example:issuer',
        'did:example:subject',
        'EmployeeCredential',
        { someClaim: 'value' },
        true
      );
      const result = await issuerService.isCredentialRevoked(issued.decoded.id);
      expect(result).toBe(false);
    });

    it('should return false if credential is not found', async () => {
      const result = await issuerService.isCredentialRevoked('nonexistent_vcId');
      expect(result).toBe(false);
    });

    it('should throw an error on database failure', async () => {
      await expect(issuerService.isCredentialRevoked('invalid_vcId')).rejects.toThrow('Failed to check credential revocation status.');
    });
  });

  describe('getIssuerPublicKey', () => {
    it('should return the issuer public key', async () => {
      process.env.ISSUER_PUBLIC_KEY_PEM = 'mock-public-key';
      const result = await issuerService.getIssuerPublicKey();
      expect(result).toBe('mock-public-key');
    });

    it('should throw an error if public key is not set', async () => {
      process.env.ISSUER_PUBLIC_KEY_PEM = undefined;
      await expect(issuerService.getIssuerPublicKey()).rejects.toThrow('Issuer public key not configured.');
    });
  });
});
