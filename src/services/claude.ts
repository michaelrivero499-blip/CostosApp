import Constants from 'expo-constants';
import { Currency } from '../types';

export interface InterpretedDebt {
  nombre: string | null;
  monto: number | null;
  descripcion: string | null;
  direccion: 'me_debe' | 'le_debo' | null;
  currency: Currency | null;
}

const SYSTEM_PROMPT = `Eres un asistente que interpreta frases sobre deudas entre personas. Dado un texto, extrae:
- nombre: nombre de la persona
- monto: monto numérico (solo el número, sin símbolo)
- descripcion: concepto o motivo de la deuda
- direccion: "me_debe" si la persona le debe al usuario, "le_debo" si el usuario le debe a la persona
- currency: moneda de la deuda. Detectá según palabras clave:
  * "dólares", "dolar", "USD", "usd" → "USD"
  * "reales", "real", "BRL", "brl" → "BRL"
  * "pesos uruguayos", "uruguayo", "UYU", "uyu" → "UYU"
  * "pesos", "$", "ARS" o sin mención de moneda → "ARS"

Interpreta la direccion del contexto natural de la frase.
Respondé SOLO con JSON válido con exactamente estos campos: {"nombre", "monto", "descripcion", "direccion", "currency"}.
Si no podés extraer algún campo con certeza, poné null (excepto currency que debe ser "ARS" por defecto).`;

export async function interpretDebt(
  transcript: string,
  knownPersonName?: string,
): Promise<InterpretedDebt> {
  const apiKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY ?? Constants.expoConfig?.extra?.claudeApiKey;
  if (!apiKey) throw new Error('EXPO_PUBLIC_CLAUDE_API_KEY not set');

  const userContent = knownPersonName
    ? `Persona: ${knownPersonName}\nFrase: ${transcript}`
    : transcript;

  const requestBody = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const raw: string = data.content?.[0]?.text ?? '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as InterpretedDebt;
    // Ensure currency has a valid value
    const validCurrencies: Currency[] = ['ARS', 'USD', 'UYU', 'BRL'];
    if (!parsed.currency || !validCurrencies.includes(parsed.currency)) {
      parsed.currency = 'ARS';
    }
    return parsed;
  } catch {
    throw new Error(`Could not parse response: ${cleaned}`);
  }
}
