declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  interface UserOptions {
    startY?: number;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    head?: (string | number)[][];
    body?: (string | number)[][];
    foot?: (string | number)[][];
    headStyles?: Record<string, unknown>;
    footStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<number, Record<string, unknown>>;
    styles?: Record<string, unknown>;
    didParseCell?: (data: {
      column: { index: number };
      section: string;
      cell: { raw: unknown; styles: Record<string, unknown> };
    }) => void;
  }

  function autoTable(doc: jsPDF, options: UserOptions): void;
  export default autoTable;
}
