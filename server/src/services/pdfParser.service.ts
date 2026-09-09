import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export interface ParsedCustomerRecord {
  tempId: string;
  firstName: string;
  secondName?: string;
  phoneNumber: string;
  vehicleNumber: string;
  vehicleType?: '2 Wheeler' | '4 Wheeler' | 'Truck';
  documentName?: string;
  startDate?: string;
  endDate?: string;
  drivingLicenceNumber?: string;
  remarks?: string;
  rawText?: string;
}

export class PdfParserService {
  /**
   * Parse PDF buffer and extract structured customer records.
   */
  static async parsePdf(buffer: Buffer): Promise<ParsedCustomerRecord[]> {
    const parser = new PDFParse({ data: buffer });
    await parser.load();

    const numPages = parser.doc.numPages;
    const allLines: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await parser.doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items: Array<{ str: string; x: number; y: number }> = [];

      for (const it of textContent.items) {
        if ('str' in it && typeof it.str === 'string') {
          const trimmed = it.str.trim();
          if (trimmed.length > 0) {
            items.push({
              str: trimmed,
              x: it.transform[4],
              y: it.transform[5],
            });
          }
        }
      }

      // Group items into lines based on Y coordinates (within 4 units tolerance)
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      const rows: Array<Array<{ str: string; x: number; y: number }>> = [];
      for (const item of items) {
        const row = rows.find((r) => Math.abs(r[0].y - item.y) <= 4);
        if (row) {
          row.push(item);
        } else {
          rows.push([item]);
        }
      }

      for (const row of rows) {
        row.sort((a, b) => a.x - b.x);
        const lineText = row.map((it) => it.str).join(' | ');
        allLines.push(lineText);
      }
    }

    // Also get plain text
    const fullTextResult = await parser.getText();
    const plainText = fullTextResult.text || '';

    // First attempt: Try table parsing based on header row
    const tableRecords = this.extractFromTable(allLines);
    if (tableRecords.length > 0) {
      return tableRecords;
    }

    // Second attempt: Try Key-Value blocks
    const kvRecords = this.extractFromKeyValue(plainText);
    if (kvRecords.length > 0) {
      return kvRecords;
    }

    // Third attempt: Fallback pattern matching per line/group
    return this.extractFromPatternMatching(allLines);
  }

  /**
   * Normalize vehicle type.
   */
  static normalizeVehicleType(raw?: string): '2 Wheeler' | '4 Wheeler' | 'Truck' | undefined {
    if (!raw) return undefined;
    const lower = raw.toLowerCase().trim();
    if (lower.includes('2') || lower.includes('two') || lower.includes('bike') || lower.includes('scooter') || lower.includes('motorcycle')) {
      return '2 Wheeler';
    }
    if (lower.includes('truck') || lower.includes('heavy') || lower.includes('commercial') || lower.includes('lorry') || lower.includes('bus') || lower.includes('hcv')) {
      return 'Truck';
    }
    if (lower.includes('4') || lower.includes('four') || lower.includes('car') || lower.includes('auto') || lower.includes('van') || lower.includes('suv')) {
      return '4 Wheeler';
    }
    return undefined;
  }

  /**
   * Parse any date string into YYYY-MM-DD.
   */
  static parseDateString(raw?: string): string | undefined {
    if (!raw) return undefined;
    const cleaned = raw.trim();
    
    // YYYY-MM-DD
    const isoMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Try Date.parse
    const ts = Date.parse(cleaned);
    if (!isNaN(ts)) {
      const d = new Date(ts);
      return d.toISOString().split('T')[0];
    }

    return undefined;
  }

  /**
   * Clean and normalize phone number.
   */
  static normalizePhoneNumber(raw?: string): string {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    return digits;
  }

  /**
   * Clean and normalize vehicle number.
   */
  static normalizeVehicleNumber(raw?: string): string {
    if (!raw) return '';
    return raw.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  /**
   * Attempt table-based extraction from lines.
   */
  private static extractFromTable(lines: string[]): ParsedCustomerRecord[] {
    let headerIndex = -1;
    let headers: string[] = [];

    const isHeaderCell = (s: string) => {
      const lower = s.toLowerCase();
      return (
        lower.includes('name') ||
        lower.includes('phone') ||
        lower.includes('mobile') ||
        lower.includes('vehicle') ||
        lower.includes('reg') ||
        lower.includes('licence') ||
        lower.includes('license') ||
        lower.includes('document') ||
        lower.includes('start') ||
        lower.includes('expiry') ||
        lower.includes('date')
      );
    };

    // Locate header line
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/\s*\|\s*/);
      const matches = parts.filter(isHeaderCell);
      if (matches.length >= 2) {
        headerIndex = i;
        headers = parts.map((p) => p.trim().toLowerCase());
        break;
      }
    }

    if (headerIndex === -1) return [];

    let nameCol = -1;
    let phoneCol = -1;
    let vehicleCol = -1;
    let typeCol = -1;
    let docCol = -1;
    let startCol = -1;
    let endCol = -1;
    let dlCol = -1;
    let remarksCol = -1;
    let refCol = -1;

    headers.forEach((h, idx) => {
      if (h.includes('phone') || h.includes('mobile') || h.includes('contact')) {
        phoneCol = idx;
      } else if (h.includes('ref') || h.includes('second')) {
        refCol = idx;
      } else if (h.includes('customer') || h.includes('name') || h.includes('client')) {
        nameCol = idx;
      } else if (h.includes('type')) {
        typeCol = idx;
      } else if (h.includes('dl') || h.includes('licence') || h.includes('license')) {
        dlCol = idx;
      } else if (h.includes('veh') || h.includes('reg')) {
        vehicleCol = idx;
      } else if (h.includes('start') || h.includes('issue') || h.includes('from')) {
        startCol = idx;
      } else if (h.includes('expir') || h.includes('end') || h.includes('till') || h.includes('upto')) {
        endCol = idx;
      } else if (h.includes('doc') || h.includes('cert')) {
        docCol = idx;
      } else if (h.includes('remark') || h.includes('note')) {
        remarksCol = idx;
      }
    });

    const records: ParsedCustomerRecord[] = [];

    // Process data rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Skip header repetitions on page breaks
      if (line.toLowerCase().includes('phone') && line.toLowerCase().includes('vehicle')) continue;

      const parts = line.split(/\s*\|\s*/).map((p) => p.trim());
      if (parts.length < 2) continue;

      const rawPhone = phoneCol !== -1 && parts[phoneCol] ? parts[phoneCol] : '';
      const rawVeh = vehicleCol !== -1 && parts[vehicleCol] ? parts[vehicleCol] : '';
      const rawName = nameCol !== -1 && parts[nameCol] ? parts[nameCol] : '';

      if (!rawName && !rawPhone && !rawVeh) continue;

      const nameParts = rawName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const secondName = refCol !== -1 && parts[refCol] ? parts[refCol] : (nameParts.slice(1).join(' ') || undefined);

      const phoneNumber = this.normalizePhoneNumber(rawPhone);
      const vehicleNumber = this.normalizeVehicleNumber(rawVeh);
      const vehicleType = typeCol !== -1 ? this.normalizeVehicleType(parts[typeCol]) : undefined;
      const documentName = docCol !== -1 && parts[docCol] ? parts[docCol] : undefined;
      const startDate = startCol !== -1 ? this.parseDateString(parts[startCol]) : undefined;
      const endDate = endCol !== -1 ? this.parseDateString(parts[endCol]) : undefined;
      const drivingLicenceNumber = dlCol !== -1 && parts[dlCol] ? parts[dlCol].trim().toUpperCase() : undefined;
      const remarks = remarksCol !== -1 && parts[remarksCol] ? parts[remarksCol] : undefined;

      records.push({
        tempId: crypto.randomUUID(),
        firstName,
        secondName,
        phoneNumber,
        vehicleNumber,
        vehicleType,
        documentName,
        startDate,
        endDate,
        drivingLicenceNumber,
        remarks,
        rawText: line,
      });
    }

    return records;
  }

  /**
   * Extract records from Key-Value blocks in text.
   */
  private static extractFromKeyValue(text: string): ParsedCustomerRecord[] {
    const records: ParsedCustomerRecord[] = [];

    const blocks = text.split(/(?:Customer\s*(?:#|\d+:|Record|\b)|---\s*|\n{2,})/i);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const nameMatch = block.match(/(?:Name|Customer Name|Client)\s*[:=-]\s*([^\n\r,]+)/i);
      const phoneMatch = block.match(/(?:Phone|Mobile|Contact|Cell)\s*[:=-]\s*([^\n\r,]+)/i);
      const vehMatch = block.match(/(?:Vehicle Number|Vehicle No|Reg No|Registration No|Vehicle)\s*[:=-]\s*([^\n\r,]+)/i);
      const typeMatch = block.match(/(?:Vehicle Type|Type)\s*[:=-]\s*([^\n\r,]+)/i);
      const docMatch = block.match(/(?:Document Name|Document|Doc Type)\s*[:=-]\s*([^\n\r,]+)/i);
      const startMatch = block.match(/(?:Start Date|Issue Date|From Date|Start)\s*[:=-]\s*([^\n\r,]+)/i);
      const endMatch = block.match(/(?:Expiry Date|End Date|Valid Upto|Expiry|Valid Till)\s*[:=-]\s*([^\n\r,]+)/i);
      const dlMatch = block.match(/(?:Driving Licence|Driving License|DL Number|DL No|Licence No)\s*[:=-]\s*([^\n\r,]+)/i);
      const remarksMatch = block.match(/(?:Remarks|Notes|Note|Comment)\s*[:=-]\s*([^\n\r]+)/i);
      const refMatch = block.match(/(?:Reference Name|Ref Person|Reference|Referred By)\s*[:=-]\s*([^\n\r,]+)/i);

      if (nameMatch || phoneMatch || vehMatch) {
        const rawName = nameMatch ? nameMatch[1].trim() : '';
        const nameParts = rawName.split(/\s+/);
        const firstName = nameParts[0] || '';
        const secondName = refMatch ? refMatch[1].trim() : (nameParts.slice(1).join(' ') || undefined);

        const phoneNumber = this.normalizePhoneNumber(phoneMatch ? phoneMatch[1] : '');
        const vehicleNumber = this.normalizeVehicleNumber(vehMatch ? vehMatch[1] : '');
        const vehicleType = typeMatch ? this.normalizeVehicleType(typeMatch[1]) : undefined;
        const documentName = docMatch ? docMatch[1].trim() : undefined;
        const startDate = startMatch ? this.parseDateString(startMatch[1]) : undefined;
        const endDate = endMatch ? this.parseDateString(endMatch[1]) : undefined;
        const drivingLicenceNumber = dlMatch ? dlMatch[1].trim().toUpperCase() : undefined;
        const remarks = remarksMatch ? remarksMatch[1].trim() : undefined;

        if (firstName || phoneNumber || vehicleNumber) {
          records.push({
            tempId: crypto.randomUUID(),
            firstName,
            secondName,
            phoneNumber,
            vehicleNumber,
            vehicleType,
            documentName,
            startDate,
            endDate,
            drivingLicenceNumber,
            remarks,
            rawText: block.trim(),
          });
        }
      }
    }

    return records;
  }

  /**
   * Fallback pattern matching: regex scanning for phone, vehicle number, and surrounding tokens.
   */
  private static extractFromPatternMatching(lines: string[]): ParsedCustomerRecord[] {
    const records: ParsedCustomerRecord[] = [];

    const phoneRegex = /(?:\+91[\s\-]?)?([6-9]\d{9})\b/;
    const vehRegex = /\b([A-Z]{2}[\s\-]?[0-9]{1,2}[\s\-]?[A-Z]{1,3}[\s\-]?[0-9]{1,4})\b/i;
    const dlRegex = /\b([A-Z]{2}[0-9]{2,4}[0-9]{7,11})\b/i;

    for (const line of lines) {
      const pMatch = line.match(phoneRegex);
      const vMatch = line.match(vehRegex);

      if (pMatch || vMatch) {
        const tokens = line.split(/\s*\|\s*|\s{2,}|\t/);
        let firstName = '';
        let secondName: string | undefined;
        let phoneNumber = pMatch ? this.normalizePhoneNumber(pMatch[1]) : '';
        let vehicleNumber = vMatch ? this.normalizeVehicleNumber(vMatch[1]) : '';
        let dlNumber: string | undefined;

        const dlMatch = line.match(dlRegex);
        if (dlMatch && (!vMatch || dlMatch[1].toUpperCase() !== vMatch[1].toUpperCase())) {
          dlNumber = dlMatch[1].toUpperCase();
        }

        for (const token of tokens) {
          const t = token.trim();
          if (
            t &&
            !t.match(phoneRegex) &&
            !t.match(vehRegex) &&
            !t.match(/^\d+$/) &&
            !t.toLowerCase().includes('wheeler') &&
            !t.toLowerCase().includes('insurance') &&
            !t.toLowerCase().includes('date')
          ) {
            const parts = t.split(/\s+/);
            firstName = parts[0];
            secondName = parts.slice(1).join(' ') || undefined;
            break;
          }
        }

        const dateMatches = line.match(/\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g);
        let startDate: string | undefined;
        let endDate: string | undefined;
        if (dateMatches && dateMatches.length >= 2) {
          startDate = this.parseDateString(dateMatches[0]);
          endDate = this.parseDateString(dateMatches[1]);
        } else if (dateMatches && dateMatches.length === 1) {
          endDate = this.parseDateString(dateMatches[0]);
        }

        let documentName: string | undefined;
        if (/insurance/i.test(line)) documentName = 'Insurance';
        else if (/\bFC\b|fitness/i.test(line)) documentName = 'FC';
        else if (/\btax\b/i.test(line)) documentName = 'Tax';
        else if (/permit/i.test(line)) documentName = 'Permit';
        else if (/licence|license|\bDL\b/i.test(line)) documentName = 'Driving Licence';
        else if (/puc|pollution/i.test(line)) documentName = 'Pollution';

        records.push({
          tempId: crypto.randomUUID(),
          firstName: firstName || 'Customer',
          secondName,
          phoneNumber,
          vehicleNumber,
          vehicleType: this.normalizeVehicleType(line),
          documentName,
          startDate,
          endDate,
          drivingLicenceNumber: dlNumber,
          rawText: line,
        });
      }
    }

    return records;
  }
}
