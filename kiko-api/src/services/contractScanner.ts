/**
 * Contract Security Scanner
 * Implements three-layer security analysis:
 * 1. Regex-based static scanning (ultra-fast)
 * 2. AST-based analysis (professional)
 * 3. AI explanation (advanced, optional)
 */

export interface SecurityFinding {
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  codeSnippet?: string;
  lineNumber?: number;
  recommendation?: string;
}

export interface ContractScanResult {
  address: string;
  chain: string;
  hasSourceCode: boolean;
  findings: SecurityFinding[];
  riskScore: number; // 0-100, lower is safer
  status: 'Safe' | 'Medium' | 'High Risk' | 'Critical';
  scanLayers: {
    regex: boolean;
    ast: boolean;
    ai: boolean;
  };
  scannedAt: number;
}

/**
 * Layer 1: Regex-based static scanning
 * Detects common security patterns
 */
export function regexScan(sourceCode: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Define risk patterns
  const riskPatterns = [
    {
      pattern: /\bdelegatecall\s*\(/gi,
      level: 'critical' as const,
      category: 'External Control',
      title: 'Delegatecall Detected',
      description: 'Delegatecall allows external contract to execute code in the context of this contract. This can lead to unauthorized access or fund theft.',
      recommendation: 'Avoid using delegatecall unless absolutely necessary. If used, ensure the target address is trusted and immutable.',
    },
    {
      pattern: /\bselfdestruct\s*\(/gi,
      level: 'critical' as const,
      category: 'Contract Destruction',
      title: 'Selfdestruct Detected',
      description: 'Selfdestruct allows the contract to be destroyed and funds sent to an address. This can lead to permanent loss of contract functionality.',
      recommendation: 'Ensure selfdestruct is only callable by authorized addresses and consider using a timelock for additional security.',
    },
    {
      pattern: /\btx\.origin\b/gi,
      level: 'high' as const,
      category: 'Phishing Risk',
      title: 'tx.origin Usage',
      description: 'tx.origin returns the original external account that started the transaction chain. Using it for authorization can be exploited by phishing attacks.',
      recommendation: 'Use msg.sender instead of tx.origin for authorization checks.',
    },
    {
      pattern: /\.call\.value\s*\(/gi,
      pattern2: /\.call\s*\(\s*\{[^}]*value\s*:/gi,
      level: 'high' as const,
      category: 'Reentrancy Risk',
      title: 'Unsafe External Call with Value',
      description: 'External calls with value transfer can be exploited for reentrancy attacks if not properly protected.',
      recommendation: 'Use Checks-Effects-Interactions pattern and consider using ReentrancyGuard.',
    },
    {
      pattern: /\bassembly\s*\{/gi,
      level: 'medium' as const,
      category: 'Low-Level Code',
      title: 'Inline Assembly Detected',
      description: 'Inline assembly bypasses Solidity safety checks and can introduce vulnerabilities if not carefully written.',
      recommendation: 'Review assembly code carefully and ensure all operations are safe.',
    },
    {
      pattern: /\bblock\.timestamp\b/gi,
      level: 'medium' as const,
      category: 'Time Manipulation',
      title: 'block.timestamp Usage',
      description: 'block.timestamp can be manipulated by miners within a small range, making it unreliable for critical timing operations.',
      recommendation: 'Avoid using block.timestamp for critical logic. Use block.number for approximate time or accept a small time variance.',
    },
    {
      pattern: /\bblock\.difficulty\b/gi,
      level: 'info' as const,
      category: 'Deprecated',
      title: 'block.difficulty Usage',
      description: 'block.difficulty is deprecated in Solidity 0.8.0+. Use block.prevrandao instead.',
      recommendation: 'Update to use block.prevrandao for randomness.',
    },
    {
      pattern: /\b\.send\s*\(/gi,
      level: 'high' as const,
      category: 'Unsafe Transfer',
      title: '.send() Usage',
      description: '.send() only forwards 2300 gas and returns false on failure, making it unreliable for value transfers.',
      recommendation: 'Use .transfer() or .call() with proper error handling instead of .send().',
    },
    {
      pattern: /\b\.transfer\s*\(/gi,
      level: 'medium' as const,
      category: 'Gas Limit',
      title: '.transfer() Usage',
      description: '.transfer() forwards 2300 gas which may not be enough for contracts with fallback functions.',
      recommendation: 'Consider using .call() with proper checks and error handling for more flexibility.',
    },
    {
      pattern: /\brequire\s*\(\s*msg\.value\s*==/gi,
      level: 'low' as const,
      category: 'Value Validation',
      title: 'Direct msg.value Comparison',
      description: 'Direct comparison of msg.value may not account for all edge cases.',
      recommendation: 'Ensure proper validation of msg.value and consider using SafeMath or Solidity 0.8+ built-in checks.',
    },
    // --- Advanced Pattern Detection (New) ---
    {
      pattern: /_transfer\s*\([^)]*\)\s*.*(?:blacklist|isBot|isSniper|blocklist)/gis,
      level: 'critical' as const,
      category: 'Honeypot Logic',
      title: 'Potential Blocklist in Transfer',
      description: 'The _transfer function appears to check a blacklist/bot list. This can be used to prevent specific users (or everyone) from selling.',
      recommendation: 'Verify if the blacklist owner can block arbitrary addresses.',
    },
    {
      pattern: /owner\s*==\s*address\(0\)/gi,
      pattern2: /onlyRole\s*\(\s*DEFAULT_ADMIN_ROLE/gi,
      level: 'high' as const,
      category: 'Fake Renounce',
      title: 'Potential Fake Renounce',
      description: 'Contract checks for address(0) owner but may still have active roles (AccessControl). Renouncing ownership might not remove all admin privileges.',
      recommendation: 'Check if DEFAULT_ADMIN_ROLE is also burned or if other powerful roles exist.',
    },
    {
      pattern: /fallback\s*\(\)\s*external\s*payable\s*.*delegatecall/gis,
      pattern2: /_implementation\s*\(\)/gi,
      level: 'medium' as const,
      category: 'Proxy Pattern',
      title: 'Proxy Implementation Detected',
      description: 'This contract appears to be a proxy. The logic is in another contract and can be upgraded/changed by the admin.',
      recommendation: 'Verify the implementation contract and ensure the admin cannot upgrade to a malicious contract to steal funds.',
    },
  ];

  const lines = sourceCode.split('\n');

  riskPatterns.forEach(({ pattern, pattern2, level, category, title, description, recommendation }) => {
    let match;
    const regex = pattern;

    // Check main pattern
    while ((match = regex.exec(sourceCode)) !== null) {
      const lineNumber = sourceCode.substring(0, match.index).split('\n').length;
      const lineContent = lines[lineNumber - 1]?.trim() || '';

      findings.push({
        level,
        category,
        title,
        description,
        codeSnippet: lineContent.substring(0, 100),
        lineNumber,
        recommendation,
      });
    }

    // Check secondary pattern if exists
    if (pattern2) {
      const regex2 = new RegExp(pattern2.source, pattern2.flags);
      while ((match = regex2.exec(sourceCode)) !== null) {
        const lineNumber = sourceCode.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNumber - 1]?.trim() || '';

        findings.push({
          level,
          category,
          title,
          description,
          codeSnippet: lineContent.substring(0, 100),
          lineNumber,
          recommendation,
        });
      }
    }
  });

  // Remove duplicates
  const uniqueFindings = findings.filter((finding, index, self) =>
    index === self.findIndex(f =>
      f.title === finding.title &&
      f.lineNumber === finding.lineNumber
    )
  );

  return uniqueFindings;
}

/**
 * Layer 2: AST-based analysis
 * Note: Requires solidity-parser-antlr package
 * For now, we'll provide a placeholder that can be enhanced
 */
export function astScan(sourceCode: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  try {
    // Try to use solidity-parser-antlr if available
    // For now, we'll do basic structural analysis without the parser

    // Check for missing return value checks
    const uncheckedCallPattern = /\.(call|delegatecall|send|transfer)\s*\([^)]*\)\s*;/g;
    let match;
    while ((match = uncheckedCallPattern.exec(sourceCode)) !== null) {
      const beforeCall = sourceCode.substring(Math.max(0, match.index - 50), match.index);
      // Check if return value is checked
      if (!/require\s*\(|if\s*\(|assert\s*\(/.test(beforeCall)) {
        const lineNumber = sourceCode.substring(0, match.index).split('\n').length;
        findings.push({
          level: 'medium',
          category: 'Unchecked Return Value',
          title: 'Unchecked External Call Return Value',
          description: 'External call return value is not checked. Failed calls may go unnoticed.',
          codeSnippet: match[0],
          lineNumber,
          recommendation: 'Always check the return value of external calls or use try-catch blocks.',
        });
      }
    }

    // Check for missing access control
    const stateChangingFunctions = sourceCode.match(/function\s+\w+\s*\([^)]*\)\s*(public|external)/g);
    if (stateChangingFunctions) {
      stateChangingFunctions.forEach((func, index) => {
        // Simple check: if function modifies state and is public/external without modifiers
        if (func.includes('public') || func.includes('external')) {
          const funcBody = sourceCode.substring(sourceCode.indexOf(func));
          const nextBrace = funcBody.indexOf('{');
          const funcContent = funcBody.substring(0, nextBrace + 100);

          // Check for common access control modifiers
          if (!/onlyOwner|onlyRole|require\s*\(.*msg\.sender/.test(funcContent)) {
            const lineNumber = sourceCode.substring(0, sourceCode.indexOf(func)).split('\n').length;
            findings.push({
              level: 'high',
              category: 'Access Control',
              title: 'Public Function Without Access Control',
              description: 'Public or external function may lack proper access control, allowing unauthorized calls.',
              codeSnippet: func.substring(0, 100),
              lineNumber,
              recommendation: 'Add access control modifiers (onlyOwner, onlyRole) or require statements to restrict function access.',
            });
          }
        }
      });
    }

  } catch (error: any) {
    console.warn('[ContractScanner] AST scan error:', error.message);
    findings.push({
      level: 'info',
      category: 'Analysis Error',
      title: 'AST Analysis Incomplete',
      description: 'AST-based analysis encountered an error. Consider installing solidity-parser-antlr for full analysis.',
    });
  }

  return findings;
}

/**
 * Calculate risk score from findings
 */
export function calculateRiskScore(findings: SecurityFinding[]): number {
  let risk = 0;

  findings.forEach(finding => {
    switch (finding.level) {
      case 'critical':
        risk += 20;
        break;
      case 'high':
        risk += 10;
        break;
      case 'medium':
        risk += 5;
        break;
      case 'low':
        risk += 2;
        break;
      case 'info':
        risk += 0;
        break;
    }
  });

  return Math.min(100, risk);
}

/**
 * Get status from risk score
 */
export function getStatusFromScore(score: number): 'Safe' | 'Medium' | 'High Risk' | 'Critical' {
  if (score === 0) return 'Safe';
  if (score < 30) return 'Medium';
  if (score < 70) return 'High Risk';
  return 'Critical';
}

/**
 * Main scan function
 */
export function scanContract(sourceCode: string, address: string, chain: string): ContractScanResult {
  const regexFindings = regexScan(sourceCode);
  const astFindings = astScan(sourceCode);

  const allFindings = [...regexFindings, ...astFindings];
  const riskScore = calculateRiskScore(allFindings);
  const status = getStatusFromScore(riskScore);

  return {
    address,
    chain,
    hasSourceCode: true,
    findings: allFindings,
    riskScore,
    status,
    scanLayers: {
      regex: true,
      ast: true,
      ai: false, // AI explanation is optional and done separately
    },
    scannedAt: Date.now(),
  };
}

