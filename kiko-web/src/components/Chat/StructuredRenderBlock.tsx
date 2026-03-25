import React from 'react';
import styles from './Chat.module.css';

interface RenderColumn {
  key: string;
  label: string;
}

interface RenderContract {
  id?: string;
  renderMode: 'narrative' | 'table' | 'list' | 'confirmation';
  title?: string;
  summary?: string;
  columns?: RenderColumn[];
  rows?: Array<Record<string, any>>;
}

interface StructuredRenderBlockProps {
  contracts?: RenderContract[];
}

function renderCellValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

export const StructuredRenderBlock: React.FC<StructuredRenderBlockProps> = ({ contracts }) => {
  const normalizedContracts = Array.isArray(contracts) ? contracts.filter(Boolean) : [];
  if (normalizedContracts.length === 0) return null;

  return (
    <>
      {normalizedContracts.map((contract, index) => {
        if (contract.renderMode === 'table' && Array.isArray(contract.columns) && Array.isArray(contract.rows)) {
          return (
            <div key={contract.id || `table-${index}`} className={styles.markdownTableWrapper}>
              {contract.title && <div style={{ marginBottom: 12, fontWeight: 600 }}>{contract.title}</div>}
              {contract.summary && <div style={{ marginBottom: 12, opacity: 0.8 }}>{contract.summary}</div>}
              <table className={styles.markdownTable}>
                <thead className={styles.markdownTableHead}>
                  <tr className={styles.markdownTableRow}>
                    {contract.columns.map((column) => (
                      <th key={column.key} className={styles.markdownTableHeader}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contract.rows.map((row, rowIndex) => (
                    <tr key={`${contract.id || 'table'}-row-${rowIndex}`} className={styles.markdownTableRow}>
                      {contract.columns!.map((column) => (
                        <td key={`${column.key}-${rowIndex}`} className={styles.markdownTableCell}>
                          {renderCellValue(row[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (contract.renderMode === 'list' && Array.isArray(contract.rows)) {
          return (
            <div key={contract.id || `list-${index}`}>
              {contract.title && <div style={{ marginBottom: 12, fontWeight: 600 }}>{contract.title}</div>}
              {contract.summary && <div style={{ marginBottom: 12, opacity: 0.8 }}>{contract.summary}</div>}
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {contract.rows.map((row, rowIndex) => (
                  <li key={`${contract.id || 'list'}-row-${rowIndex}`}>
                    {Object.values(row)
                      .filter((value) => value !== null && value !== undefined && value !== '')
                      .map((value) => String(value))
                      .join(' | ')}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return null;
      })}
    </>
  );
};
