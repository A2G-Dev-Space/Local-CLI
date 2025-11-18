/**
 * Risk Analyzer
 *
 * Analyzes tasks and their operations to determine risk levels
 * and whether human approval is required.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskCategory =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'system_command'
  | 'package_install'
  | 'network_request'
  | 'database_operation'
  | 'environment_modification'
  | 'safe';

export interface RiskAssessment {
  level: RiskLevel;
  category: RiskCategory;
  reason: string;
  requiresApproval: boolean;
  detectedPatterns: string[];
}

export interface RiskAnalyzerConfig {
  // Minimum risk level that requires approval
  approvalThreshold: RiskLevel;

  // Auto-approve certain patterns (regex)
  autoApprovePatterns?: string[];

  // Always block certain patterns (regex)
  blockPatterns?: string[];

  // Enable/disable HITL globally
  enabled: boolean;
}

/**
 * Default configuration for risk analyzer
 */
export const DEFAULT_RISK_CONFIG: RiskAnalyzerConfig = {
  approvalThreshold: 'medium',
  enabled: true,
  autoApprovePatterns: [
    '^Read.*\\.md$', // Auto-approve reading markdown files
    '^List files', // Auto-approve file listing
  ],
  blockPatterns: [
    'rm -rf /', // Block dangerous system commands
    'DROP DATABASE', // Block database drops
  ],
};

/**
 * Risk patterns and their associated risk levels
 */
const RISK_PATTERNS: Array<{
  pattern: RegExp;
  category: RiskCategory;
  level: RiskLevel;
  reason: string;
}> = [
  // Critical risks
  {
    pattern: /\brm\s+-rf\b/i,
    category: 'system_command',
    level: 'critical',
    reason: 'Recursive force delete command detected',
  },
  {
    pattern: /\bDROP\s+(DATABASE|TABLE)\b/i,
    category: 'database_operation',
    level: 'critical',
    reason: 'Database drop operation detected',
  },
  {
    pattern: /\bchmod\s+777\b/i,
    category: 'system_command',
    level: 'critical',
    reason: 'Dangerous permission change (777) detected',
  },

  // High risks
  {
    pattern: /\b(delete|remove|unlink)\b.*(\.js|\.ts|\.jsx|\.tsx|\.py|\.java|\.cpp|\.h)\b/i,
    category: 'file_delete',
    level: 'high',
    reason: 'Deleting source code files',
  },
  {
    pattern: /\bnpm\s+install\b.*--global/i,
    category: 'package_install',
    level: 'high',
    reason: 'Global package installation',
  },
  {
    pattern: /\bsudo\b/i,
    category: 'system_command',
    level: 'high',
    reason: 'Elevated privileges (sudo) required',
  },
  {
    pattern: /DELETE\s+FROM\b/i,
    category: 'database_operation',
    level: 'high',
    reason: 'Database DELETE operation',
  },

  // Medium risks
  {
    pattern: /\b(write|create|update)\b.*(\.js|\.ts|\.jsx|\.tsx|\.py|\.java|\.cpp|\.h)\b/i,
    category: 'file_write',
    level: 'medium',
    reason: 'Writing to source code files',
  },
  {
    pattern: /\bnpm\s+install\b/i,
    category: 'package_install',
    level: 'medium',
    reason: 'Package installation',
  },
  {
    pattern: /\b(mv|move|rename)\b/i,
    category: 'system_command',
    level: 'medium',
    reason: 'File move/rename operation',
  },
  {
    pattern: /\bfetch\b|\bcurl\b|\baxios\b/i,
    category: 'network_request',
    level: 'medium',
    reason: 'Network request detected',
  },
  {
    pattern: /\.env|environment|config\.json/i,
    category: 'environment_modification',
    level: 'medium',
    reason: 'Environment or configuration file modification',
  },

  // Low risks
  {
    pattern: /\bread\b.*(\.json|\.txt|\.md|\.csv)\b/i,
    category: 'file_read',
    level: 'low',
    reason: 'Reading data files',
  },
  {
    pattern: /\bls\b|\bdir\b|\btree\b/i,
    category: 'safe',
    level: 'low',
    reason: 'File listing operation',
  },
];

/**
 * Risk Analyzer Class
 */
export class RiskAnalyzer {
  private config: RiskAnalyzerConfig;

  constructor(config: Partial<RiskAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  /**
   * Analyze a task description for potential risks
   */
  analyzeTask(taskDescription: string, taskDetails?: string): RiskAssessment {
    if (!this.config.enabled) {
      return {
        level: 'low',
        category: 'safe',
        reason: 'Risk analysis disabled',
        requiresApproval: false,
        detectedPatterns: [],
      };
    }

    const textToAnalyze = `${taskDescription} ${taskDetails || ''}`;

    // Check block patterns first
    if (this.config.blockPatterns) {
      for (const pattern of this.config.blockPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(textToAnalyze)) {
          return {
            level: 'critical',
            category: 'system_command',
            reason: `Blocked pattern detected: ${pattern}`,
            requiresApproval: true,
            detectedPatterns: [pattern],
          };
        }
      }
    }

    // Check auto-approve patterns
    if (this.config.autoApprovePatterns) {
      for (const pattern of this.config.autoApprovePatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(textToAnalyze)) {
          return {
            level: 'low',
            category: 'safe',
            reason: `Auto-approved pattern: ${pattern}`,
            requiresApproval: false,
            detectedPatterns: [pattern],
          };
        }
      }
    }

    // Analyze using risk patterns
    const detectedRisks: RiskAssessment[] = [];

    for (const riskPattern of RISK_PATTERNS) {
      if (riskPattern.pattern.test(textToAnalyze)) {
        detectedRisks.push({
          level: riskPattern.level,
          category: riskPattern.category,
          reason: riskPattern.reason,
          requiresApproval: this.shouldRequireApproval(riskPattern.level),
          detectedPatterns: [riskPattern.pattern.source],
        });
      }
    }

    // If multiple risks detected, return the highest
    if (detectedRisks.length > 0) {
      return this.getHighestRisk(detectedRisks);
    }

    // No risks detected - safe operation
    return {
      level: 'low',
      category: 'safe',
      reason: 'No risky patterns detected',
      requiresApproval: false,
      detectedPatterns: [],
    };
  }

  /**
   * Determine if a risk level requires approval based on threshold
   */
  private shouldRequireApproval(level: RiskLevel): boolean {
    const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const riskIndex = levels.indexOf(level);
    const thresholdIndex = levels.indexOf(this.config.approvalThreshold);

    return riskIndex >= thresholdIndex;
  }

  /**
   * Get the highest risk from multiple detected risks
   */
  private getHighestRisk(risks: RiskAssessment[]): RiskAssessment {
    const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

    risks.sort((a, b) => {
      return levels.indexOf(b.level) - levels.indexOf(a.level);
    });

    const highest = risks[0]!;

    // Combine all detected patterns
    const allPatterns = risks.flatMap(r => r.detectedPatterns);

    return {
      ...highest,
      detectedPatterns: allPatterns,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RiskAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RiskAnalyzerConfig {
    return { ...this.config };
  }
}
