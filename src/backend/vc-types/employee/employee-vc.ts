import { vcService } from '../../utils/vc-service';

export class EmployeeVCService {
  private static instance: EmployeeVCService;

  private constructor() {}

  public static getInstance(): EmployeeVCService {
    if (!EmployeeVCService.instance) {
      EmployeeVCService.instance = new EmployeeVCService();
    }
    return EmployeeVCService.instance;
  }

  public async issueEmployeeCredential(employeeName: string, employeeId?: string): Promise<any> {
    try {
      const credentialData = {
        name: employeeName,
        employeeId: employeeId || `EMP-${crypto.randomUUID().substring(0, 8)}`
      };

      return await vcService.issueCredential(credentialData, 'EmployeeCredential');
    } catch (error) {
      console.error('Error issuing employee credential:', error);
      return {
        success: false,
        message: `Error issuing employee credential: ${error}`
      };
    }
  }

  /**
   * Issues an employee credential from a Verifiable Presentation
   * Extracts the employee name from the VP and issues a credential
   * @param vp - The verifiable presentation containing employee information
   * @returns The result of the credential issuance
   */
  public async issueEmployeeCredentialFromVP(vp: any): Promise<any> {
    try {
      const employeeName = this.extractEmployeeNameFromVP(vp);

      if (!employeeName) {
        return {
          success: false,
          message: 'Could not extract employee name from login credentials'
        };
      }

      return await this.issueEmployeeCredential(employeeName);
    } catch (error) {
      console.error('Error issuing employee credential from VP:', error);
      return {
        success: false,
        message: `Error issuing employee credential from VP: ${error}`
      };
    }
  }

  public extractEmployeeNameFromVP(vp: any): string | null {
    // Handle the case where VP is nested inside a "presentation" property
    const presentation = vp.presentation || vp;

    if (!presentation || !presentation.verifiableCredential || !Array.isArray(presentation.verifiableCredential) || presentation.verifiableCredential.length === 0) {
      return null;
    }

    for (const credential of presentation.verifiableCredential) {
      if (credential.credentialSubject && credential.credentialSubject.name) {
        return credential.credentialSubject.name;
      }
    }

    return null;
  }
}

export const employeeVCService = EmployeeVCService.getInstance();
