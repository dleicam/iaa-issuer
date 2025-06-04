import { vcService } from '../../utils/vc-service';

export class GraduationVCService {
  private static instance: GraduationVCService;

  private constructor() {}

  public static getInstance(): GraduationVCService {
    if (!GraduationVCService.instance) {
      GraduationVCService.instance = new GraduationVCService();
    }
    return GraduationVCService.instance;
  }

  /**
   * Generates a graduation credential with random data for POC purposes
   * Uses the name from the VP if provided, otherwise uses a random name
   * @param vp - Optional verifiable presentation to extract the name from
   * @returns The result of the credential issuance with random data
   */
  public async generateRandomGraduationCredential(vp?: any): Promise<any> {
    try {
      // Array of possible random values
      const randomInstitutions = ['University of Technology', 'State College', 'National Institute', 'Global University', 'Technical Academy'];
      const randomDegrees = ['Bachelor of Science', 'Master of Arts', 'PhD', 'Associate Degree', 'Bachelor of Arts'];
      const randomFields = ['Computer Science', 'Business Administration', 'Engineering', 'Mathematics', 'Psychology'];

      // Extract student name from VP if provided, otherwise use a random name
      let studentName;
      if (vp) {
        studentName = this.extractStudentNameFromVP(vp);
      }

      // If no VP provided or name extraction failed, use a random name
      if (!studentName) {
        const randomNames = ['John Doe', 'Jane Smith', 'Alex Johnson', 'Maria Garcia', 'Wei Chen'];
        studentName = randomNames[Math.floor(Math.random() * randomNames.length)];
      }

      // Generate random values for other fields
      const institution = randomInstitutions[Math.floor(Math.random() * randomInstitutions.length)];
      const degree = randomDegrees[Math.floor(Math.random() * randomDegrees.length)];
      const field = randomFields[Math.floor(Math.random() * randomFields.length)];

      // Generate a random graduation date within the last 5 years
      const currentYear = new Date().getFullYear();
      const randomYear = currentYear - Math.floor(Math.random() * 5);
      const randomMonth = Math.floor(Math.random() * 12) + 1;
      const randomDay = Math.floor(Math.random() * 28) + 1; // Using 28 to avoid invalid dates
      const graduationDate = `${randomYear}-${randomMonth.toString().padStart(2, '0')}-${randomDay.toString().padStart(2, '0')}`;

      console.log('Generating graduation credential with:', {
        studentName,
        institution,
        degree,
        field,
        graduationDate
      });

      return await this.issueGraduationCredential(
        studentName,
        institution,
        degree,
        field,
        graduationDate
      );
    } catch (error) {
      console.error('Error generating random graduation credential:', error);
      return {
        success: false,
        message: `Error generating random graduation credential: ${error}`
      };
    }
  }

  public async issueGraduationCredential(
    studentName: string, 
    institution: string, 
    degree: string, 
    field: string, 
    graduationDate: string
  ): Promise<any> {
    try {
      const credentialData = {
        name: studentName,
        institution,
        degree,
        field,
        graduationDate,
        graduationId: `GRAD-${crypto.randomUUID().substring(0, 8)}`
      };

      return await vcService.issueCredential(credentialData, 'GraduationCredential');
    } catch (error) {
      console.error('Error issuing graduation credential:', error);
      return {
        success: false,
        message: `Error issuing graduation credential: ${error}`
      };
    }
  }

  /**
   * Issues a graduation credential from a Verifiable Presentation
   * Extracts the student name from the VP and issues a credential
   * @param vp - The verifiable presentation containing student information
   * @param institution - The educational institution
   * @param degree - The degree earned (e.g., Bachelor, Master, PhD)
   * @param field - The field of study
   * @param graduationDate - The date of graduation
   * @returns The result of the credential issuance
   */
  public async issueGraduationCredentialFromVP(
    vp: any, 
    institution: string, 
    degree: string, 
    field: string, 
    graduationDate: string
  ): Promise<any> {
    try {
      const studentName = this.extractStudentNameFromVP(vp);

      if (!studentName) {
        return {
          success: false,
          message: 'Could not extract student name from login credentials'
        };
      }

      return await this.issueGraduationCredential(
        studentName, 
        institution, 
        degree, 
        field, 
        graduationDate
      );
    } catch (error) {
      console.error('Error issuing graduation credential from VP:', error);
      return {
        success: false,
        message: `Error issuing graduation credential from VP: ${error}`
      };
    }
  }

  public extractStudentNameFromVP(vp: any): string | null {
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

export const graduationVCService = GraduationVCService.getInstance();
