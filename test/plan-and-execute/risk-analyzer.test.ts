/**
 * Tests for Risk Analyzer
 */

import { RiskAnalyzer, DEFAULT_RISK_CONFIG } from '../../src/plan-and-execute/risk-analyzer.js';

describe('Risk Analyzer', () => {
  let riskAnalyzer: RiskAnalyzer;

  beforeEach(() => {
    riskAnalyzer = new RiskAnalyzer();
  });

  describe('Critical Risk Detection', () => {
    test('detects rm -rf command', () => {
      const risk = riskAnalyzer.analyzeTask('Remove all files with rm -rf /tmp');
      expect(risk.level).toBe('critical');
      expect(risk.category).toBe('system_command');
      expect(risk.requiresApproval).toBe(true);
    });

    test('detects DROP DATABASE command', () => {
      const risk = riskAnalyzer.analyzeTask('Execute DROP DATABASE testdb');
      expect(risk.level).toBe('critical');
      expect(risk.requiresApproval).toBe(true);
    });

    test('detects chmod 777 command', () => {
      const risk = riskAnalyzer.analyzeTask('Fix permissions with chmod 777');
      expect(risk.level).toBe('critical');
      expect(risk.category).toBe('system_command');
      expect(risk.requiresApproval).toBe(true);
    });
  });

  describe('High Risk Detection', () => {
    test('detects deleting source files', () => {
      const risk = riskAnalyzer.analyzeTask('Delete old implementation file app.ts');
      expect(risk.level).toBe('high');
      expect(risk.category).toBe('file_delete');
      expect(risk.requiresApproval).toBe(true);
    });

    test('detects global package installation', () => {
      const risk = riskAnalyzer.analyzeTask('Install typescript globally npm install --global typescript');
      expect(risk.level).toBe('high');
      expect(risk.category).toBe('package_install');
      expect(risk.requiresApproval).toBe(true);
    });

    test('detects sudo commands', () => {
      const risk = riskAnalyzer.analyzeTask('Run command with sudo privileges');
      expect(risk.level).toBe('high');
      expect(risk.category).toBe('system_command');
      expect(risk.requiresApproval).toBe(true);
    });
  });

  describe('Medium Risk Detection', () => {
    test('detects writing source code files', () => {
      const risk = riskAnalyzer.analyzeTask('Write new implementation to src/app.ts');
      expect(risk.level).toBe('medium');
      expect(risk.category).toBe('file_write');
      expect(risk.requiresApproval).toBe(true);
    });

    test('detects package installation', () => {
      const risk = riskAnalyzer.analyzeTask('Install express using npm install express');
      expect(risk.level).toBe('medium');
      expect(risk.category).toBe('package_install');
      expect(risk.requiresApproval).toBe(true);
    });

    test('detects file move operations', () => {
      const risk = riskAnalyzer.analyzeTask('Move file to backup directory');
      expect(risk.level).toBe('medium');
      expect(risk.category).toBe('system_command');
      expect(risk.requiresApproval).toBe(true);
    });

    test('detects .env file modifications', () => {
      const risk = riskAnalyzer.analyzeTask('Update .env file with new API key');
      expect(risk.level).toBe('medium');
      expect(risk.category).toBe('environment_modification');
      expect(risk.requiresApproval).toBe(true);
    });
  });

  describe('Low Risk / Safe Operations', () => {
    test('detects reading data files as low risk', () => {
      const risk = riskAnalyzer.analyzeTask('Read data from report.csv');
      expect(risk.level).toBe('low');
      expect(risk.requiresApproval).toBe(false);
    });

    test('detects file listing as safe', () => {
      const risk = riskAnalyzer.analyzeTask('List files in directory');
      expect(risk.level).toBe('low');
      expect(risk.requiresApproval).toBe(false);
    });

    test('marks unknown operations as safe', () => {
      const risk = riskAnalyzer.analyzeTask('Analyze code quality');
      expect(risk.level).toBe('low');
      expect(risk.category).toBe('safe');
      expect(risk.requiresApproval).toBe(false);
    });
  });

  describe('Configuration', () => {
    test('respects custom approval threshold', () => {
      const customAnalyzer = new RiskAnalyzer({
        approvalThreshold: 'high',
      });

      const mediumRisk = customAnalyzer.analyzeTask('npm install express');
      expect(mediumRisk.level).toBe('medium');
      expect(mediumRisk.requiresApproval).toBe(false); // below threshold

      const highRisk = customAnalyzer.analyzeTask('Delete old app.ts file');
      expect(highRisk.level).toBe('high');
      expect(highRisk.requiresApproval).toBe(true); // meets threshold
    });

    test('honors auto-approve patterns', () => {
      const customAnalyzer = new RiskAnalyzer({
        autoApprovePatterns: ['safe-task'],
      });

      const risk = customAnalyzer.analyzeTask('This is a safe-task');
      expect(risk.level).toBe('low');
      expect(risk.requiresApproval).toBe(false);
      expect(risk.reason).toContain('Auto-approved');
    });

    test('honors block patterns', () => {
      const customAnalyzer = new RiskAnalyzer({
        blockPatterns: ['production'],
      });

      const risk = customAnalyzer.analyzeTask('Deploy to production environment');
      expect(risk.level).toBe('critical');
      expect(risk.requiresApproval).toBe(true);
    });

    test('can disable risk analysis', () => {
      const disabledAnalyzer = new RiskAnalyzer({
        enabled: false,
      });

      const risk = disabledAnalyzer.analyzeTask('rm -rf /');
      expect(risk.level).toBe('low');
      expect(risk.requiresApproval).toBe(false);
      expect(risk.reason).toContain('disabled');
    });

    test('can update configuration', () => {
      riskAnalyzer.updateConfig({
        approvalThreshold: 'critical',
      });

      const config = riskAnalyzer.getConfig();
      expect(config.approvalThreshold).toBe('critical');
    });
  });

  describe('Multiple Risk Detection', () => {
    test('returns highest risk when multiple patterns match', () => {
      const risk = riskAnalyzer.analyzeTask(
        'Use sudo to DROP DATABASE prod and rm -rf /tmp'
      );

      expect(risk.level).toBe('critical');
      // At least one critical pattern should be detected
      expect(risk.requiresApproval).toBe(true);
    });
  });
});
