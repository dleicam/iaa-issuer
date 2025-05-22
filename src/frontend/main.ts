import {ApiService} from "./ApiService";

class AppController {
    private api = new ApiService();
    private currentPage = 'home-page';

    constructor() {
        this.initApp();
    }

    async initApp() {
        this.setupEventListeners();
        this.showPage(this.currentPage);
    }

    setupEventListeners() {
        document.getElementById('nav-home')?.addEventListener('click', () => this.showPage('home-page'));
        document.getElementById('nav-dashboard')?.addEventListener('click', () => this.showPage('dashboard-page'));
        document.getElementById('nav-verify')?.addEventListener('click', () => this.showPage('verify-page'));
        document.getElementById('nav-about')?.addEventListener('click', () => this.showPage('about-page'));

        document.getElementById('verify-button')?.addEventListener('click', () => this.showPage('verify-page'));

        document.getElementById('verify-credential-button')?.addEventListener('click', () => this.verifyCredential());
        document.getElementById('clear-button')?.addEventListener('click', () => {
            const input = document.getElementById('credential-input') as HTMLTextAreaElement;
            if (input) input.value = '';

            const result = document.getElementById('verification-result');
            if (result) result.style.display = 'none';
        });
    }

    formatDN(dn: string): string {
        if (!dn) return '';

        const parts = dn.split(',').map(part => part.trim());

        const cnMatch = dn.match(/CN=([^,]+)/);
        const cn = cnMatch ? cnMatch[1] : null;

        const oMatch = dn.match(/O=([^,]+)/);
        const org = oMatch ? oMatch[1] : null;

        if (cn) {
            return org ? `${cn} (${org})` : cn;
        }

        return parts.join('<br>');
    }

    formatValue(value: any): string {
        if (value === null || value === undefined) {
            return '<span class="null-value">null</span>';
        }

        if (typeof value === 'string') {
            const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
            if (datePattern.test(value)) {
                try {
                    const date = new Date(value);
                    return date.toLocaleString();
                } catch (e) {
                    return value;
                }
            }
            return value;
        }

        if (typeof value === 'number') {
            return value.toString();
        }

        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '<span class="empty-array">[]</span>';
            }

            return `<div class="array-value">
        <ul>
          ${value.map(item => `<li>${this.formatValue(item)}</li>`).join('')}
        </ul>
      </div>`;
        }

        if (typeof value === 'object') {
            if (Object.keys(value).length === 0) {
                return '<span class="empty-object">{}</span>';
            }

            return `<div class="object-value">
        <table class="nested-object">
          <tbody>
            ${Object.entries(value).map(([key, val]) => `
              <tr>
                <td class="nested-key">${key}:</td>
                <td class="nested-value">${this.formatValue(val)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
        }

        return String(value);
    }

    async verifyCredential() {
        const input = document.getElementById('credential-input') as HTMLTextAreaElement;
        const resultElement = document.getElementById('verification-result');

        if (!input || !resultElement) return;

        const credential = input.value.trim();
        if (!credential) {
            alert('Please enter a credential to verify');
            return;
        }

        try {
            const result = await this.api.verifyCredential(credential);

            resultElement.innerHTML = `
        <h3>Verification Result</h3>
        <div class="result ${result.isValid ? 'success' : 'error'}">
          <div class="validation-status">
            <div class="status-indicator ${result.isValid ? 'valid' : 'invalid'}">
              ${result.isValid ? '<span class="status-icon">✓</span>' : '<span class="status-icon">✗</span>'}
            </div>
            <div class="status-details">
              <p class="status-title">${result.isValid ? 'Credential is Valid' : 'Credential is Invalid'}</p>
              <p class="status-subtitle">${result.isValid ? 'All validation checks passed' : 'Validation failed'}</p>
            </div>
          </div>

          <div class="validation-details">
            ${result.issuedByUs !== undefined ? `
              <div class="validation-item ${result.issuedByUs ? 'valid' : ''}">
                <span class="validation-icon">${result.issuedByUs ? '✓' : 'ℹ'}</span>
                <span class="validation-text"><strong>Issued by IAA:</strong> ${result.issuedByUs ? 'Yes' : 'No'}</span>
              </div>
            ` : ''}

            ${result.isQualified !== undefined ? `
              <div class="validation-item ${result.isQualified ? 'valid' : ''}">
                <span class="validation-icon">${result.isQualified ? '✓' : 'ℹ'}</span>
                <span class="validation-text"><strong>Qualified:</strong> ${result.isQualified ? 'Yes' : 'No'}</span>
              </div>
            ` : ''}

            <!-- Certificate Validation Summary - Always show if qualified -->
            ${result.isQualified ? `
              <div class="validation-item ${result.certificateInfo?.isValid ? 'valid' : 'invalid'}">
                <span class="validation-icon">${result.certificateInfo?.isValid ? '✓' : '✗'}</span>
                <span class="validation-text"><strong>Certificate Validation:</strong> ${result.certificateInfo?.isValid ? 'Valid' : 'Invalid or Not Available'}</span>
              </div>
            ` : ''}
          </div>

          ${result.certificateInfo ? `
            <div class="certificate-info">
              <div class="certificate-header">
                <div>
                  <h4>Certificate Information</h4>
                  <p class="certificate-hint">Click the button to view detailed validation information</p>
                </div>
                <button type="button" class="text-button" id="toggle-certificate-details">
                  <span id="toggle-text">Show Validation Details</span>
                  <span class="toggle-icon"></span>
                </button>
              </div>

              <!-- Certificate Validation Status Badge -->
              <div class="certificate-validation-summary">
                <div class="validation-status-badge ${result.certificateInfo.isValid ? 'valid' : 'invalid'}">
                  ${result.certificateInfo.isValid ? 'VALID' : 'INVALID'}
                </div>
              </div>

              <div class="certificate-details" id="certificate-details" style="display: none;"> 
                <!-- Certificate Identity Information -->
                <div class="certificate-identity-section">
                  <h5 class="section-title">Certificate Identity</h5>
                  ${result.certificateInfo.subject ? `
                    <div class="validation-item highlight">
                      <span class="validation-icon">👤</span>
                      <span class="validation-text"><strong>Certificate Owner:</strong> ${this.formatDN(result.certificateInfo.subject)}</span>
                    </div>
                  ` : ''}

                  ${result.certificateInfo.issuer ? `
                    <div class="validation-item highlight">
                      <span class="validation-icon">🔏</span>
                      <span class="validation-text"><strong>Issued By:</strong> ${this.formatDN(result.certificateInfo.issuer)}</span>
                    </div>
                  ` : ''}
                </div>
                <!-- Certificate Validation Section -->
                <div class="certificate-validation-section">
                  <h5 class="section-title">Validation Status</h5>

                  <div class="validation-item ${result.certificateInfo.isValid ? 'valid' : 'invalid'}">
                    <span class="validation-icon">${result.certificateInfo.isValid ? '✓' : '✗'}</span>
                    <span class="validation-text"><strong>Certificate Valid:</strong> ${result.certificateInfo.isValid ? 'Yes' : 'No'}</span>
                  </div>

                  ${result.certificateInfo.validFrom && result.certificateInfo.validTo ? `
                    <div class="validation-item">
                      <span class="validation-icon">🗓️</span>
                      <span class="validation-text"><strong>Validity Period:</strong> ${new Date(result.certificateInfo.validFrom).toLocaleDateString()} to ${new Date(result.certificateInfo.validTo).toLocaleDateString()}</span>
                    </div>
                  ` : ''}

                  ${result.certificateInfo.signatureValid !== undefined ? `
                    <div class="validation-item ${result.certificateInfo.signatureValid ? 'valid' : 'invalid'}">
                      <span class="validation-icon">${result.certificateInfo.signatureValid ? '✓' : '✗'}</span>
                      <span class="validation-text"><strong>Signature Valid:</strong> ${result.certificateInfo.signatureValid ? 'Yes' : 'No'}</span>
                    </div>
                  ` : ''}

                  ${result.certificateInfo.chainValid !== undefined ? `
                    <div class="validation-item ${result.certificateInfo.chainValid ? 'valid' : 'invalid'}">
                      <span class="validation-icon">${result.certificateInfo.chainValid ? '✓' : '✗'}</span>
                      <span class="validation-text"><strong>Certificate Chain Valid:</strong> ${result.certificateInfo.chainValid ? 'Yes' : 'No'}</span>
                    </div>
                  ` : ''}

                  ${result.certificateInfo.isRevoked !== undefined ? `
                    <div class="validation-item ${!result.certificateInfo.isRevoked ? 'valid' : 'invalid'}">
                      <span class="validation-icon">${!result.certificateInfo.isRevoked ? '✓' : '✗'}</span>
                      <span class="validation-text"><strong>Certificate Revoked:</strong> ${result.certificateInfo.isRevoked ? 'Yes' : 'No'}</span>
                    </div>
                  ` : ''}
                </div>

                <!-- Additional date details if needed -->
                <div class="certificate-dates-details">
                  <h5 class="section-title">Detailed Timestamps</h5>

                  ${result.certificateInfo.validFrom ? `
                    <div class="validation-item small">
                      <span class="validation-icon">ℹ</span>
                      <span class="validation-text"><strong>Valid From:</strong> ${new Date(result.certificateInfo.validFrom).toLocaleString()}</span>
                    </div>
                  ` : ''}

                  ${result.certificateInfo.validTo ? `
                    <div class="validation-item small">
                      <span class="validation-icon">ℹ</span>
                      <span class="validation-text"><strong>Valid To:</strong> ${new Date(result.certificateInfo.validTo).toLocaleString()}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          ` : ''}

          ${result.subject ? `
            <div class="subject-info">
              <h4>Subject Information</h4>
              <div class="subject-details">
                ${(() => {
                // Filter out some common non-relevant fields
                const entries = Object.entries(result.subject)
                    .filter(([key]) => key !== 'id' && key !== '@context');

                // Create an array to hold the HTML for each field
                const fields = [];

                // First, add the 'did' field if it exists
                const didEntry = entries.find(([key]) => key === 'did');
                if (didEntry) {
                    fields.push(`<div class="subject-field primary-field">
                      <div class="field-label">DID:</div>
                      <div class="field-value">${didEntry[1]}</div>
                    </div>`);
                }

                // Next, add the 'name' field if it exists
                const nameEntry = entries.find(([key]) => key === 'name');
                if (nameEntry) {
                    const formattedKey = 'Name';
                    fields.push(`<div class="subject-field">
                      <div class="field-label">${formattedKey}:</div>
                      <div class="field-value">${this.formatValue(nameEntry[1])}</div>
                    </div>`);
                }

                // Finally, add all other fields in alphabetical order
                entries
                    .filter(([key]) => key !== 'did' && key !== 'name')
                    .sort((a, b) => a[0].localeCompare(b[0])) // Sort alphabetically by key
                    .forEach(([key, value]) => {
                        // Format the key for display (capitalize, replace underscores with spaces)
                        const formattedKey = key.charAt(0).toUpperCase() +
                            key.slice(1).replace(/_/g, ' ');

                        fields.push(`<div class="subject-field">
                        <div class="field-label">${formattedKey}:</div>
                        <div class="field-value">${this.formatValue(value)}</div>
                      </div>`);
                    });

                return fields.join('');
            })()}
              </div>
            </div>
          ` : ''}

          ${result.errors && result.errors.length > 0 ? `
            <div class="errors">
              <h4>Errors</h4>
              <ul>
                ${result.errors.map(err => `<li>${err}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;

            resultElement.style.display = 'block';

            const toggleButton = document.getElementById('toggle-certificate-details');
            if (toggleButton) {
                toggleButton.addEventListener('click', () => {
                    const detailsSection = document.getElementById('certificate-details');
                    const toggleText = document.getElementById('toggle-text');

                    if (detailsSection && toggleText) {
                        // Check if the details are currently visible (using computed style)
                        const isVisible = window.getComputedStyle(detailsSection).display !== 'none';

                        if (isVisible) {
                            // If visible, hide it with a smooth animation
                            detailsSection.style.opacity = '0';
                            setTimeout(() => {
                                detailsSection.style.display = 'none';
                            }, 200);
                            toggleText.textContent = 'Show Validation Details';
                            toggleButton.classList.remove('active');
                        } else {
                            // If hidden, show it with a smooth animation
                            detailsSection.style.display = 'block';
                            // Use setTimeout to ensure the display change has taken effect before animating opacity
                            setTimeout(() => {
                                detailsSection.style.opacity = '1';
                            }, 10);
                            toggleText.textContent = 'Hide Validation Details';
                            toggleButton.classList.add('active');
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Verification failed:', error);
            resultElement.innerHTML = `
        <h3>Verification Failed</h3>
        <div class="result error">
          <div class="validation-status">
            <div class="status-indicator invalid">
              <span class="status-icon">✗</span>
            </div>
            <div class="status-details">
              <p class="status-title">Verification Process Failed</p>
              <p class="status-subtitle">An error occurred during the verification process</p>
            </div>
          </div>

          <div class="errors">
            <h4>Error Details</h4>
            <div class="validation-item invalid">
              <span class="validation-icon">✗</span>
              <span class="validation-text">${error instanceof Error ? error.message : 'Unknown error'}</span>
            </div>
          </div>
        </div>
      `;
            resultElement.style.display = 'block';
        }
    }

    showPage(pageId: string) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const page = document.getElementById(pageId);
        if (page) {
            page.classList.add('active');
            this.currentPage = pageId;
        }

        document.querySelectorAll('.nav a').forEach(link => {
            link.classList.remove('active');
        });

        const navLink = document.getElementById(`nav-${pageId.replace('-page', '')}`);
        if (navLink) {
            navLink.classList.add('active');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AppController();
});