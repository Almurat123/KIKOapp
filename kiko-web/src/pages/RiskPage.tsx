import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Zap, Activity, CheckCircle2, AlertTriangle, Lock, Loader2, Code } from 'lucide-react';
import { securityService, type ScanHistoryItem, type TokenSecurityResult } from '../services/securityService';
import { PageContainer } from '../components/Layout/PageContainer';
import styles from './RiskPage.module.css';

// --- Shared Components ---

const SecurityFlag: React.FC<{
  label: string;
  value: boolean | undefined;
  isDanger?: boolean;
  isWarning?: boolean;
  isGood?: boolean;
  reason?: string;
}> = ({ label, value, isDanger, isWarning, isGood, reason }) => {
  if (value === undefined) return null;

  const getFlagStyle = () => {
    if (isDanger) return { bg: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c' };
    if (isWarning) return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' };
    if (isGood) return { bg: 'rgba(22, 199, 132, 0.1)', color: '#10b981' };
    return { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
  };

  const style = getFlagStyle();

  return (
    <div className={styles.securityFlag} style={{ background: style.bg }}>
      <span className={styles.flagLabel}>{label}</span>
      <span className={styles.flagValue} style={{ color: style.color }}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusStyle = () => {
    switch (status) {
      case "Safe": return { color: "#10b981", bg: "rgba(22, 199, 132, 0.1)", border: "rgba(22, 199, 132, 0.2)" };
      case "Medium": return { color: "#eab308", bg: "rgba(234, 179, 8, 0.1)", border: "rgba(234, 179, 8, 0.2)" };
      case "High Risk": return { color: "#e74c3c", bg: "rgba(234, 57, 67, 0.1)", border: "rgba(234, 57, 67, 0.2)" };
      case "Critical": return { color: "#dc2626", bg: "rgba(220, 38, 38, 0.15)", border: "rgba(220, 38, 38, 0.3)" };
      default: return { color: "#eab308", bg: "rgba(234, 179, 8, 0.1)", border: "rgba(234, 179, 8, 0.2)" };
    }
  };

  const style = getStatusStyle();

  return (
    <span
      className={styles.statusBadge}
      style={{
        color: style.color,
        background: style.bg,
        borderColor: style.border,
      }}
    >
      {status}
    </span>
  );
};

export const RiskPage: React.FC = () => {
  const [address, setAddress] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [currentResult, setCurrentResult] = useState<TokenSecurityResult | null>(null);
  const [localScanResult, setLocalScanResult] = useState<any | null>(null);
  const [scanMode] = useState<'api' | 'local'>('api');

  // Load scan history on mount
  useEffect(() => {
    const history = securityService.getScanHistory();
    setScanHistory(history);
  }, []);

  const handleScan = async () => {
    if (!address.trim()) {
      setError('Please enter a contract address');
      return;
    }

    setIsScanning(true);
    setError(null);
    setCurrentResult(null);
    setLocalScanResult(null);

    try {
      if (scanMode === 'local') {
        // Local source code scanning
        const result = await securityService.scanLocal(address.trim(), 'eth');
        setLocalScanResult(result);
      } else {
        // API-based scanning (GoPlus + QuickIntel)
        const result = await securityService.scanToken(address.trim(), 'eth', 'uniswap');
        setCurrentResult(result);

        // Save to history
        securityService.saveToHistory(result, result.tokenName, result.tokenSymbol);

        // Refresh history
        const history = securityService.getScanHistory();
        setScanHistory(history);
      }

      // Clear input
      setAddress('');
    } catch (err: any) {
      setError(err.message || 'Failed to scan token. Please try again.');
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isScanning) {
      handleScan();
    }
  };

  return (
    <PageContainer>
      <div style={{
        maxWidth: '768px',
        margin: '0 auto',
        paddingTop: '24px',
        padding: '16px',
      }}>
        {/* Scanner Input Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(56, 97, 251, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <ShieldAlert size={32} color="#5B8DEF" />
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1a1a1a',
            marginBottom: '8px',
            margin: 0,
          }}>
            Token Security Scanner
          </h2>
          <p style={{
            color: '#999999',
            fontSize: '14px',
            margin: 0,
          }}>
            Enter a token contract address to check for honeypots, taxes, and liquidity locks.
          </p>
        </div>

        {/* Input Box */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          padding: '8px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        }}>
          <Search size={20} color="#666666" style={{ marginLeft: '12px' }} />
          <input
            type="text"
            placeholder="Paste token address (0x...)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isScanning}
            style={{
              flex: 1,
              background: 'transparent',
              color: '#1a1a1a',
              outline: 'none',
              padding: '12px 0',
              fontSize: '14px',
              fontFamily: 'monospace',
              border: 'none',
              opacity: isScanning ? 0.6 : 1,
            }}
          />
          <button
            onClick={handleScan}
            disabled={isScanning}
            style={{
              background: isScanning ? '#9ca3af' : '#5B8DEF',
              color: 'white',
              fontWeight: 'bold',
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isScanning ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Scanning...
              </>
            ) : (
              <>
                Scan <Zap size={16} />
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.1)',
            border: '1px solid rgba(231, 76, 60, 0.3)',
            color: '#e74c3c',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {/* Local Scan Result */}
        {localScanResult && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '32px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          }}>
            {/* Data Source Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
            }}>
              <Code size={18} color="#3b82f6" />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#3b82f6',
                  marginBottom: '2px',
                }}>
                  Local Source Code Scan - Three-Layer Analysis
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#666666',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}>
                  <span>Analysis Layers:</span>
                  {localScanResult.scanLayers?.regex && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(22, 199, 132, 0.1)',
                      color: '#10b981',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                    }}>
                      Regex ✓
                    </span>
                  )}
                  {localScanResult.scanLayers?.ast && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(22, 199, 132, 0.1)',
                      color: '#10b981',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                    }}>
                      AST ✓
                    </span>
                  )}
                  {localScanResult.scanLayers?.ai && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(22, 199, 132, 0.1)',
                      color: '#10b981',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                    }}>
                      AI ✓
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  {localScanResult.contractName || 'Contract'}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#666666',
                  fontFamily: 'monospace',
                }}>
                  {localScanResult.address}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: localScanResult.status === 'Safe' ? '#10b981' :
                    localScanResult.status === 'Critical' ? '#e74c3c' :
                      localScanResult.status === 'High Risk' ? '#e74c3c' : '#eab308',
                }}>
                  {localScanResult.riskScore}/100
                </div>
                <StatusBadge status={localScanResult.status} />
              </div>
            </div>

            {/* Findings */}
            {localScanResult.findings && localScanResult.findings.length > 0 ? (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                }}>
                  Security Findings ({localScanResult.findings.length})
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}>
                  {localScanResult.findings.map((finding: any, index: number) => {
                    const levelColors: Record<string, { bg: string; color: string; border: string }> = {
                      critical: { bg: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: 'rgba(231, 76, 60, 0.3)' },
                      high: { bg: 'rgba(231, 76, 60, 0.08)', color: '#e74c3c', border: 'rgba(231, 76, 60, 0.2)' },
                      medium: { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: 'rgba(234, 179, 8, 0.2)' },
                      low: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' },
                      info: { bg: 'rgba(0, 0, 0, 0.05)', color: '#666666', border: 'rgba(0, 0, 0, 0.1)' },
                    };
                    const levelStyle = levelColors[finding.level] || levelColors.info;

                    return (
                      <div
                        key={index}
                        style={{
                          background: levelStyle.bg,
                          border: `1px solid ${levelStyle.border}`,
                          padding: '12px',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                        }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: levelStyle.color,
                            textTransform: 'uppercase',
                          }}>
                            {finding.level}
                          </span>
                          <span style={{
                            fontSize: '12px',
                            color: '#666666',
                          }}>
                            {finding.category}
                          </span>
                          {finding.lineNumber && (
                            <span style={{
                              fontSize: '10px',
                              color: '#999999',
                              fontFamily: 'monospace',
                            }}>
                              Line {finding.lineNumber}
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#1a1a1a',
                          marginBottom: '4px',
                        }}>
                          {finding.title}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#666666',
                          marginBottom: '6px',
                        }}>
                          {finding.description}
                        </div>
                        {finding.recommendation && (
                          <div style={{
                            fontSize: '11px',
                            color: '#3b82f6',
                            fontStyle: 'italic',
                            marginTop: '4px',
                            paddingTop: '4px',
                            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                          }}>
                            💡 {finding.recommendation}
                          </div>
                        )}
                        {finding.codeSnippet && (
                          <div style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            background: 'rgba(0, 0, 0, 0.05)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            marginTop: '6px',
                            color: '#666666',
                            overflowX: 'auto',
                          }}>
                            {finding.codeSnippet}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#10b981',
                fontSize: '14px',
              }}>
                ✓ No security issues found
              </div>
            )}
          </div>
        )}

        {/* Current Scan Result (API-based) */}
        {currentResult && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '32px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          }}>
            {/* Data Source Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, rgba(91, 141, 239, 0.15) 0%, rgba(91, 141, 239, 0.08) 100%)',
              border: '1px solid rgba(91, 141, 239, 0.2)',
              borderRadius: '8px',
            }}>
              <Zap size={18} color="#5B8DEF" />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#5B8DEF',
                  marginBottom: '2px',
                }}>
                  API Scan - External Security Analysis
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#666666',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}>
                  <span>Data Source:</span>
                  {currentResult.sources?.goplus && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(22, 199, 132, 0.1)',
                      color: '#10b981',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                    }}>
                      GoPlus Security ✓
                    </span>
                  )}
                  {currentResult.sources?.quickintel && (
                    <span style={{
                      padding: '2px 6px',
                      background: 'rgba(22, 199, 132, 0.1)',
                      color: '#10b981',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                    }}>
                      QuickIntel ✓
                    </span>
                  )}
                  {(!currentResult.sources?.goplus && !currentResult.sources?.quickintel) && (
                    <span style={{ color: '#999999', fontStyle: 'italic' }}>Unknown</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: '4px',
                }}>
                  {currentResult.tokenName || currentResult.tokenSymbol || 'Unknown Token'}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#666666',
                  fontFamily: 'monospace',
                }}>
                  {currentResult.address}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: currentResult.status === 'Safe' ? '#10b981' :
                    currentResult.status === 'High Risk' ? '#e74c3c' : '#eab308',
                }}>
                  {currentResult.riskScore}/100
                </div>
                <StatusBadge status={currentResult.status} />
              </div>
            </div>

            {/* Security Details - Expanded */}
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            }}>
              {/* Tax Information */}
              <div style={{
                marginBottom: '20px',
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  💰 Tax Information
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                }}>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    padding: '12px',
                    borderRadius: '8px',
                  }}>
                    <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Buy Tax</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: currentResult.buyTax > 10 ? '#e74c3c' : currentResult.buyTax > 5 ? '#eab308' : '#10b981' }}>
                      {currentResult.buyTax}%
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    padding: '12px',
                    borderRadius: '8px',
                  }}>
                    <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Sell Tax</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: currentResult.sellTax > 10 ? '#e74c3c' : currentResult.sellTax > 5 ? '#eab308' : '#10b981' }}>
                      {currentResult.sellTax}%
                    </div>
                  </div>
                  {currentResult.transferTax !== undefined && (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '12px',
                      borderRadius: '8px',
                    }}>
                      <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Transfer Tax</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a' }}>
                        {currentResult.transferTax}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Flags */}
              <div style={{
                marginBottom: '20px',
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  🔒 Security Flags
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                }}>
                  <SecurityFlag
                    label="Honeypot"
                    value={currentResult.isHoneypot}
                    isDanger={currentResult.isHoneypot}
                    reason={currentResult.honeypotReason}
                  />
                  <SecurityFlag
                    label="Open Source"
                    value={currentResult.isOpenSource}
                    isGood={currentResult.isOpenSource}
                  />
                  <SecurityFlag
                    label="Blacklisted"
                    value={currentResult.isBlacklisted}
                    isDanger={currentResult.isBlacklisted}
                  />
                  <SecurityFlag
                    label="Whitelisted"
                    value={currentResult.isWhitelisted}
                  />
                  <SecurityFlag
                    label="Proxy Contract"
                    value={currentResult.isProxy}
                    isWarning={currentResult.isProxy}
                  />
                  <SecurityFlag
                    label="Mintable"
                    value={currentResult.isMintable}
                    isWarning={currentResult.isMintable}
                  />
                  <SecurityFlag
                    label="Can Disable Trade"
                    value={currentResult.canDisableTrade}
                    isDanger={currentResult.canDisableTrade}
                  />
                  <SecurityFlag
                    label="Cannot Sell All"
                    value={currentResult.cannotSellAll}
                    isDanger={currentResult.cannotSellAll}
                  />
                  <SecurityFlag
                    label="Transfer Pausable"
                    value={currentResult.transferPausable}
                    isWarning={currentResult.transferPausable}
                  />
                  <SecurityFlag
                    label="Anti Whale"
                    value={currentResult.isAntiWhale}
                  />
                  <SecurityFlag
                    label="Selfdestruct"
                    value={currentResult.selfdestruct}
                    isDanger={currentResult.selfdestruct}
                  />
                  <SecurityFlag
                    label="External Call"
                    value={currentResult.externalCall}
                    isWarning={currentResult.externalCall}
                  />
                </div>
              </div>

              {/* Ownership Information */}
              {(currentResult.ownerAddress || currentResult.creatorAddress || currentResult.hasRenouncedOwner !== undefined) && (
                <div style={{
                  marginBottom: '20px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#1a1a1a',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    👤 Ownership Information
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}>
                    {currentResult.hasRenouncedOwner !== undefined && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: currentResult.hasRenouncedOwner ? 'rgba(22, 199, 132, 0.1)' : 'rgba(234, 57, 67, 0.1)',
                        borderRadius: '6px',
                      }}>
                        <span style={{ fontSize: '12px', color: '#666666' }}>Owner Renounced</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: currentResult.hasRenouncedOwner ? '#10b981' : '#e74c3c',
                        }}>
                          {currentResult.hasRenouncedOwner ? 'Yes ✓' : 'No ✗'}
                        </span>
                      </div>
                    )}
                    {currentResult.ownerAddress && (
                      <div style={{
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.02)',
                        borderRadius: '6px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Owner Address</div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#1a1a1a', wordBreak: 'break-all' }}>
                          {currentResult.ownerAddress}
                        </div>
                      </div>
                    )}
                    {currentResult.creatorAddress && (
                      <div style={{
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.02)',
                        borderRadius: '6px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Creator Address</div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#1a1a1a', wordBreak: 'break-all' }}>
                          {currentResult.creatorAddress}
                        </div>
                      </div>
                    )}
                    {currentResult.canTakeBackOwnership !== undefined && (
                      <SecurityFlag
                        label="Can Take Back Ownership"
                        value={currentResult.canTakeBackOwnership}
                        isDanger={currentResult.canTakeBackOwnership}
                      />
                    )}
                    {currentResult.hiddenOwner !== undefined && (
                      <SecurityFlag
                        label="Hidden Owner"
                        value={currentResult.hiddenOwner}
                        isDanger={currentResult.hiddenOwner}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Token Information */}
              {(currentResult.totalSupply || currentResult.holders || currentResult.liquidity) && (
                <div style={{
                  marginBottom: '20px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#1a1a1a',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    📊 Token Information
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                  }}>
                    {currentResult.totalSupply && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.02)',
                        padding: '12px',
                        borderRadius: '8px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Total Supply</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1a1a1a', fontFamily: 'monospace' }}>
                          {typeof currentResult.totalSupply === 'string'
                            ? parseFloat(currentResult.totalSupply).toLocaleString('en-US', { maximumFractionDigits: 2 })
                            : currentResult.totalSupply.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                    {(currentResult.holders || currentResult.holdersCount !== undefined) && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.02)',
                        padding: '12px',
                        borderRadius: '8px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Holders</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1a1a1a' }}>
                          {currentResult.holdersCount !== undefined
                            ? (typeof currentResult.holdersCount === 'string'
                              ? parseInt(currentResult.holdersCount).toLocaleString()
                              : currentResult.holdersCount.toLocaleString())
                            : typeof currentResult.holders === 'string'
                              ? parseInt(currentResult.holders).toLocaleString()
                              : Array.isArray(currentResult.holders)
                                ? currentResult.holders.length.toLocaleString()
                                : currentResult.holders?.toLocaleString() || 'N/A'}
                        </div>
                        {Array.isArray(currentResult.holders) && currentResult.holders.length > 0 && (
                          <div style={{ fontSize: '9px', color: '#999999', marginTop: '4px' }}>
                            Top {Math.min(5, currentResult.holders.length)} shown
                          </div>
                        )}
                      </div>
                    )}
                    {currentResult.liquidity && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.02)',
                        padding: '12px',
                        borderRadius: '8px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#666666', marginBottom: '4px' }}>Liquidity</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1a1a1a' }}>
                          ${typeof currentResult.liquidity === 'string'
                            ? parseFloat(currentResult.liquidity).toLocaleString('en-US', { maximumFractionDigits: 0 })
                            : currentResult.liquidity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Top Holders (if available) */}
              {Array.isArray(currentResult.holders) && currentResult.holders.length > 0 && (
                <div style={{
                  marginBottom: '20px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#1a1a1a',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    👥 Top Holders ({currentResult.holders.length})
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '250px',
                    overflowY: 'auto',
                  }}>
                    {currentResult.holders.slice(0, 10).map((holder: any, index: number) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'rgba(0, 0, 0, 0.02)',
                          borderRadius: '6px',
                          border: '1px solid rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#1a1a1a',
                            marginBottom: '2px',
                          }}>
                            {holder.address?.slice(0, 10)}...{holder.address?.slice(-8)}
                          </div>
                          {holder.tag && (
                            <div style={{
                              fontSize: '9px',
                              color: '#999999',
                            }}>
                              {holder.tag}
                            </div>
                          )}
                          {holder.is_contract === 1 && (
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 4px',
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6',
                              borderRadius: '3px',
                              marginLeft: '4px',
                            }}>
                              Contract
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: 'bold',
                            color: '#1a1a1a',
                            marginBottom: '2px',
                          }}>
                            {(parseFloat(holder.percent || '0') * 100).toFixed(2)}%
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#666666',
                            fontFamily: 'monospace',
                          }}>
                            {parseFloat(holder.balance || '0').toLocaleString('en-US', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scan Results / Recent Scans */}
        <div>
          <h3 style={{
            color: '#1a1a1a',
            fontWeight: 'bold',
            fontSize: '14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: 0,
          }}>
            <Activity size={16} color="#999999" /> Recent Scans
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {scanHistory.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '32px',
                color: '#999999',
                fontSize: '14px',
              }}>
                No scan history yet. Scan a token to get started.
              </div>
            ) : (
              scanHistory.map(scan => {
                const getScoreStyle = () => {
                  if (scan.score < 30) {
                    return {
                      iconBg: 'rgba(22, 199, 132, 0.2)',
                      iconColor: '#10b981',
                      scoreColor: '#10b981',
                      Icon: CheckCircle2,
                    };
                  } else if (scan.score > 70) {
                    return {
                      iconBg: 'rgba(234, 57, 67, 0.2)',
                      iconColor: '#e74c3c',
                      scoreColor: '#e74c3c',
                      Icon: AlertTriangle,
                    };
                  } else {
                    return {
                      iconBg: 'rgba(234, 179, 8, 0.2)',
                      iconColor: '#eab308',
                      scoreColor: '#eab308',
                      Icon: Lock,
                    };
                  }
                };

                const scoreStyle = getScoreStyle();
                const Icon = scoreStyle.Icon;

                return (
                  <div
                    key={scan.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      padding: '16px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: scoreStyle.iconBg,
                        color: scoreStyle.iconColor,
                      }}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div style={{
                          color: '#1a1a1a',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                        }}>
                          {scan.token}
                          <StatusBadge status={scan.status || 'Unknown'} />
                        </div>
                        <div style={{
                          color: '#666666',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          {scan.address}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: scoreStyle.scoreColor,
                      }}>
                        {scan.score}/100
                      </div>
                      <div style={{
                        color: '#666666',
                        fontSize: '12px',
                      }}>
                        {scan.time}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

