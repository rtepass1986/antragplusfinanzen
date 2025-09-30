import dayjs from 'dayjs';
import { Invoice, InvoiceT } from './schema';

const ISO = (d?: string) => {
  if (!d) return undefined;
  const a = d.trim();
  // Accept dd.mm.yyyy, yyyy-mm-dd, dd/mm/yyyy
  const m = a.match(/(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
  if (m) return dayjs(`${m[3]}-${m[2]}-${m[1]}`).format('YYYY-MM-DD');
  if (dayjs(a).isValid()) return dayjs(a).format('YYYY-MM-DD');
  return undefined;
};

function basicHeuristics(text: string): Partial<InvoiceT> {
  const get = (re: RegExp) => text.match(re)?.[1]?.trim();

  // Invoice number patterns (German and English)
  const invoiceNumber = get(
    /(?:Rechnungsnummer|Invoice\s*(?:No\.|Number)|RE\s*Nr\.?|Rechnung|Invoice)[^\dA-Za-z]?([A-Z0-9\-_/\.]{4,})/i
  );

  // Date patterns
  const issueDate = get(
    /(?:Rechnungsdatum|Ausstellungsdatum|Issue\s*Date|Datum)[^\d]?([\d./\-]{8,10})/i
  );
  const dueDate = get(
    /(?:Fällig(?:keit)?|Due\s*Date|Zahlbar|Payment\s*Due)[^\d]?([\d./\-]{8,10})/i
  );

  // Currency detection
  const currency =
    get(/\b(EUR|USD|GBP|CHF|€|\$|£)\b/i)?.toUpperCase() ||
    (text.includes('€')
      ? 'EUR'
      : text.includes('$')
        ? 'USD'
        : text.includes('£')
          ? 'GBP'
          : 'EUR');

  // Amount patterns (German and English)
  const total = get(
    /(?:Gesamt(?:betrag)?|Total|Amount\s*Due|Summe|Endbetrag)[^\d]*(\d+[\d., ]*)/i
  );
  const net = get(/(?:Netto|Net\s*Amount|Subtotal)[^\d]*(\d+[\d., ]*)/i);
  const vat = get(/(?:MwSt|VAT|Tax|Umsatzsteuer)[^\d]*(\d+[\d., ]*)/i);

  // Supplier/Customer detection
  const supplierName = get(
    /(?:Von|From|Supplier|Anbieter)[^\n]*?([A-Za-zÄÖÜäöüß\s&\.\-]{3,})/i
  );
  const customerName = get(
    /(?:An|To|Customer|Kunde)[^\n]*?([A-Za-zÄÖÜäöüß\s&\.\-]{3,})/i
  );

  // VAT ID patterns
  const vatId = get(
    /(?:USt-IdNr|VAT\s*ID|Steuernummer)[^\dA-Za-z]?([A-Z0-9\s\-/]{8,})/i
  );

  // Line items extraction (basic)
  const lineItems: any[] = [];
  const lineItemRegex = /(\d+)\s+(.+?)\s+(\d+[\d.,]*)\s+(\d+[\d.,]*)/g;
  let match;
  let position = 1;

  while ((match = lineItemRegex.exec(text)) !== null) {
    const quantity = parseFloat(match[1].replace(',', '.'));
    const description = match[2].trim();
    const unitPrice = parseFloat(
      match[3].replace(/[ .]/g, '').replace(',', '.')
    );
    const netAmount = parseFloat(
      match[4].replace(/[ .]/g, '').replace(',', '.')
    );

    if (description.length > 3 && netAmount > 0) {
      lineItems.push({
        position,
        description,
        quantity,
        unit_price: unitPrice,
        net_amount: netAmount,
        tax_rate: 19,
      });
      position++;
    }
  }

  return {
    invoice_number: invoiceNumber,
    issue_date: ISO(issueDate),
    due_date: ISO(dueDate),
    currency,
    supplier: supplierName ? { name: supplierName, vat_id: vatId } : undefined,
    customer: customerName ? { name: customerName } : undefined,
    line_items: lineItems,
    totals: {
      net: net
        ? parseFloat(net.replace(/[ .]/g, '').replace(',', '.'))
        : undefined,
      vat: vat
        ? parseFloat(vat.replace(/[ .]/g, '').replace(',', '.'))
        : undefined,
      total: total
        ? parseFloat(total.replace(/[ .]/g, '').replace(',', '.'))
        : undefined,
    },
    detected_language:
      text.includes('Rechnung') || text.includes('MwSt') ? 'de' : 'en',
    tax_mode:
      text.includes('inkl') || text.includes('including')
        ? 'prices_include_tax'
        : 'prices_exclude_tax',
  };
}

async function callLLM(text: string): Promise<Partial<InvoiceT> | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: key });

    const system = `You are an expert invoice parser. Extract structured data from invoice text and return ONLY valid JSON that matches this TypeScript interface:

interface InvoiceT {
  filename?: string;
  invoice_id?: string;
  invoice_number?: string;
  secondary_reference?: string;
  issue_date?: string; // ISO date
  due_date?: string; // ISO date
  currency?: string;
  payment_terms?: string;
  supplier?: {
    name?: string;
    address?: string;
    vat_id?: string;
    tax_id?: string;
    email?: string;
    phone?: string;
    bank_accounts?: Array<{
      bank?: string;
      iban?: string;
      bic_swift?: string;
    }>;
  };
  customer?: {
    name?: string;
    address?: string;
    vat_id?: string;
    tax_id?: string;
    email?: string;
    phone?: string;
    bank_accounts?: Array<{
      bank?: string;
      iban?: string;
      bic_swift?: string;
    }>;
  };
  line_items?: Array<{
    position?: number;
    sku?: string;
    uvz_number?: string;
    kv_number?: string;
    description: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    net_amount: number;
    tax_rate?: number;
    tax_amount?: number;
    gross_amount?: number;
  }>;
  section_totals?: Array<{
    uvz_number?: string;
    title?: string;
    net: number;
    taxable_base?: number;
    vat_rate?: number;
    vat?: number;
    gross?: number;
  }>;
  totals?: {
    subtotal?: number;
    net?: number;
    taxable_base?: number;
    vat_rate?: number;
    vat?: number;
    total?: number;
    gross?: number;
    amount_paid?: number;
    amount_due?: number;
    verauslagte_kosten_ust_frei?: number;
    rounding_adjustment?: number;
  };
  notes?: string;
  detected_language?: string;
  tax_mode?: "prices_include_tax" | "prices_exclude_tax";
  flags?: string[];
}

Extract all available information. For amounts, use numbers (not strings). For dates, use YYYY-MM-DD format.`;

    const user = `Invoice text to parse:\n\n${text}\n\nReturn only the JSON object, no other text.`;

    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonStart = content.indexOf('{');
    if (jsonStart === -1) return null;

    const json = JSON.parse(content.slice(jsonStart));
    return json as Partial<InvoiceT>;
  } catch (e) {
    console.warn('LLM parse failed:', e);
    return null;
  }
}

export async function parseInvoiceFromText(
  filename: string,
  text: string
): Promise<InvoiceT> {
  try {
    // Start with heuristics
    const heuristics = basicHeuristics(text);

    // Try LLM enhancement
    const llmResult = await callLLM(text);

    // Merge results (LLM takes precedence where available)
    const merged = {
      filename,
      ...heuristics,
      ...(llmResult || {}),
      // Ensure required fields
      line_items: llmResult?.line_items || heuristics.line_items || [],
      currency: llmResult?.currency || heuristics.currency || 'EUR',
    };

    // Validate & coerce with Zod
    const result = Invoice.parse(merged);
    return result;
  } catch (error) {
    console.error('Invoice parsing error:', error);
    // Return minimal valid invoice if parsing fails
    return {
      filename,
      currency: 'EUR',
      line_items: [],
      detected_language: 'en',
    };
  }
}
