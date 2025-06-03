import { IssuerService } from '../services/issuer.service';
import { Credential, RevocationEntry } from '../db/database';
import { CredentialGenerationService } from '../services/credential.service';

jest.mock('../db/database');
jest.mock('../services/credential.service');

describe('IssuerService', () => {
  let issuerService: IssuerService;
  let mockCredentialGenerationService: jest.Mocked<CredentialGenerationService>;

  beforeEach(() => {
    issuerService = new IssuerService();
    mockCredentialGenerationService = new CredentialGenerationService() as jest.Mocked<CredentialGenerationService>;
  });

  describe('issueAndStoreCredential', () => {
    it('should issue and store a credential successfully', async () => {
      const mockIssuedCredential = {
        jwt: 'mock.jwt.token',
        decoded: { id: 'vc123', type: ['VerifiableCredential', 'EmployeeCredential'], credentialSubject: { id: 'did:example:subject' }, issuer: 'did:example:issuer', issuanceDate: '2023-01-01T00:00:00Z' }
      };
      mockCredentialGenerationService.issueCredential.mockResolvedValue(mockIssuedCredential);
      (Credential.create as jest.Mock).mockResolvedValue({ id: 'dbId123', vcId: 'vc123', credentialType: 'VerifiableCredential,EmployeeCredential', sub: 'did:example:subject', iss: 'did:example:issuer', nbf: new Date('2023-01-01T00:00:00Z'), isRevoked: false });

      const result = await issuerService.issueAndStoreCredential('did:example:issuer', 'did:example:subject', 'EmployeeCredential', { someClaim: 'value' }, true);

      expect(mockCredentialGenerationService.issueCredential).toHaveBeenCalledWith('did:example:issuer', 'did:example:subject', 'EmployeeCredential', { someClaim: 'value' }, true);
      expect(Credential.create).toHaveBeenCalledWith({
        vcId: 'vc123',
        credentialType: 'VerifiableCredential,EmployeeCredential',
        sub: 'did:example:subject',
        iss: 'did:example:issuer',
        nbf: new Date('2023-01-01T00:00:00Z'),
        exp: undefined,
        kid: undefined
      });
      expect(result).toEqual(mockIssuedCredential);
    });

    it('should throw an error if generated VC is missing id', async () => {
      mockCredentialGenerationService.issueCredential.mockResolvedValue({ jwt: 'mock.jwt', decoded: {} });

      await expect(issuerService.issueAndStoreCredential('did:example:issuer', 'did:example:subject', 'EmployeeCredential', {}, false)).rejects.toThrow('Generated Verifiable Credential is missing an "id" property in its payload.');
    });

    it('should throw an error on database failure', async () => {
      mockCredentialGenerationService.issueCredential.mockResolvedValue({ jwt: 'mock.jwt', decoded: { id: 'vc123', type: 'EmployeeCredential' } });
      (Credential.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(issuerService.issueAndStoreCredential('did:example:issuer', 'did:example:subject', 'EmployeeCredential', {}, false)).rejects.toThrow('Failed to issue and store credential.');
    });
  });

  describe('revokeCredential', () => {
    it('should revoke a credential successfully', async () => {
      const mockCredential = { id: 'dbId123', vcId: 'vc123', isRevoked: false, update: jest.fn().mockResolvedValue(true) };
      (Credential.findOne as jest.Mock).mockResolvedValue(mockCredential);
      (RevocationEntry.create as jest.Mock).mockResolvedValue({});

      const result = await issuerService.revokeCredential('vc123', 'Reason for revocation');

      expect(Credential.findOne).toHaveBeenCalledWith({ where: { vcId: 'vc123' } });
      expect(mockCredential.update).toHaveBeenCalledWith({ isRevoked: true, revocationDate: expect.any(Date), revocationReason: 'Reason for revocation' });
      expect(RevocationEntry.create).toHaveBeenCalledWith({ credentialId: 'dbId123', revokeDate: expect.any(Date), justification: 'Reason for revocation' });
      expect(result).toBe(true);
    });

    it('should return false if credential is not found', async () => {
      (Credential.findOne as jest.Mock).mockResolvedValue(null);

      const result = await issuerService.revokeCredential('vc123', 'Reason');

      expect(result).toBe(false);
    });

    it('should return true if credential is already revoked', async () => {
      const mockCredential = { id: 'dbId123', vcId: 'vc123', isRevoked: true };
      (Credential.findOne as jest.Mock).mockResolvedValue(mockCredential);

      const result = await issuerService.revokeCredential('vc123', 'Reason');

      expect(result).toBe(true);
    });

    it('should throw an error on database failure', async () => {
      (Credential.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(issuerService.revokeCredential('vc123', 'Reason')).rejects.toThrow('Failed to revoke credential.');
    });
  });

  describe('getIssuedCredentialByVcId', () => {
    it('should return a credential by vcId', async () => {
      const mockCredential = { vcId: 'vc123' };
      (Credential.findOne as jest.Mock).mockResolvedValue(mockCredential);

      const result = await issuerService.getIssuedCredentialByVcId('vc123');

      expect(Credential.findOne).toHaveBeenCalledWith({ where: { vcId: 'vc123' } });
      expect(result).toEqual(mockCredential);
    });

    it('should return null if credential is not found', async () => {
      (Credential.findOne as jest.Mock).mockResolvedValue(null);

      const result = await issuerService.getIssuedCredentialByVcId('vc123');

      expect(result).toBe(null);
    });

    it('should throw an error on database failure', async () => {
      (Credential.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(issuerService.getIssuedCredentialByVcId('vc123')).rejects.toThrow('Failed to fetch issued credential by vcId.');
    });
  });

  describe('getIssuedCredentialByDbId', () => {
    it('should return a credential by dbId', async () => {
      const mockCredential = { id: 'dbId123' };
      (Credential.findByPk as jest.Mock).mockResolvedValue(mockCredential);

      const result = await issuerService.getIssuedCredentialByDbId('dbId123');

      expect(Credential.findByPk).toHaveBeenCalledWith('dbId123');
      expect(result).toEqual(mockCredential);
    });

    it('should return null if credential is not found', async () => {
      (Credential.findByPk as jest.Mock).mockResolvedValue(null);

      const result = await issuerService.getIssuedCredentialByDbId('dbId123');

      expect(result).toBe(null);
    });

    it('should throw an error on database failure', async () => {
      (Credential.findByPk as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(issuerService.getIssuedCredentialByDbId('dbId123')).rejects.toThrow('Failed to fetch issued credential by DB ID.');
    });
  });

  describe('getAllIssuedCredentials', () => {
    it('should return all credentials', async () => {
      const mockCredentials = [{ vcId: 'vc123' }, { vcId: 'vc456' }];
      (Credential.findAll as jest.Mock).mockResolvedValue(mockCredentials);

      const result = await issuerService.getAllIssuedCredentials();

      expect(Credential.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockCredentials);
    });

    it('should throw an error on database failure', async () => {
      (Credential.findAll as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(issuerService.getAllIssuedCredentials()).rejects.toThrow('Failed to fetch all issued credentials.');
    });
  });

  describe('getRevocationList', () => {
    it('should return revocation list without details', async () => {
      const mockList = [{ id: 'rev1' }];
      (RevocationEntry.findAll as jest.Mock).mockResolvedValue(mockList);

      const result = await issuerService.getRevocationList();

      expect(RevocationEntry.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockList);
    });

    it('should return revocation list with details', async () => {
      const mockList = [{ id: 'rev1', credential: { vcId: 'vc123' } }];
      (RevocationEntry.findAll as jest.Mock).mockResolvedValue(mockList);

      const result = await issuerService.getRevocationList(true);

      expect(RevocationEntry.findAll).toHaveBeenCalledWith({ include: [{ model: Credential, as: 'credential' }] });
      expect(result).toEqual(mockList);
    });

    it('should throw an error on database failure', async () => {
      (RevocationEntry.findAll as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(issuerService.getRevocationList()).rejects.toThrow('Failed to fetch revocation list.');
    });
  });

  describe('isCredentialRevoked', () => {
    it('should return true if credential is revoked', async () => {
      (Credential.findOne as jest.Mock).mockResolvedValue({ isRevoked: true });

      const result = await issuerService.isCredentialRevoked('vc123');

      expect(result).toBe(true);
    });

    it('should return false if credential is not revoked', async () => {
      (Credential.findOne as jest.Mock).mockResolvedValue({ isRevoked: false });

      const result = await issuerService.isCredentialRevoked('vc123');

      expect(result).toBe(false);
    });

    it('should return false if credential is not found', async () => {
      (Credential.findOne as jest.Mock).mockResolvedValue(null);

      const result = await issuerService.isCredentialRevoked('vc123');

      expect(result).toBe(false);
    });

    it('should throw an error on database failure', async () => {
      (Credential.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(issuerService.isCredentialRevoked('vc123')).rejects.toThrow('Failed to check credential revocation status.');
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
