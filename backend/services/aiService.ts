import Anthropic from '@anthropic-ai/sdk';
import Card from '../models/Card';
import logger from '../config/logger';
import { escapeRegex } from '../utils/escapeRegex';
import type { SortOrder } from 'mongoose';
import { getAiRuleDirectives } from './rulebookService';

/**
 * AI Service: Joule Zero Point — Cognitive Engine (TypeScript Edition).
 * 
 * Orchestrates communication with Anthropic, manages prompt construction,
 * tool-calling cycles, and safety audits.
 */

// --- Constants & Config ---
let _anthropic: Anthropic | null = null;

const getAnthropicClient = () => {
    if (!_anthropic) {
        const apiKey = process.env.ANTHROPIC_API_KEY || 'test-dummy-key';
        _anthropic = new Anthropic({
            apiKey,
            timeout: 60000,
        });
    }
    return _anthropic;
};

const MODEL = 'claude-haiku-4-5';
// The Anthropic API requires an explicit output ceiling on every request.
const MAX_OUTPUT_TOKENS = 2048;
// Retries use the same model: there is no cheaper tier to degrade to, and the
// failures worth retrying are transient (network, rate limit), not model related.
const MAX_RETRIES = 2;
const MAX_CONTEXT_CHARS = 8000;
// One tool round trip: the assistant may search the cards and then comment on
// what it found. Anything beyond that is a loop, not an answer.
const MAX_TOOL_TURNS = 2;

const loadedRules = getAiRuleDirectives();

const PRIVACY_DIRECTIVE = `
# DIRETTIVA DI PRIVACY ED ETICA (EU AI Act Compliance)
1. Sei un'intelligenza artificiale (LLM) basata su tecnologia Anthropic. Se ti viene chiesto chi sei, dichiara sempre la tua natura artificiale.
2. Non richiedere MAI dati personali sensibili (email, password reali, indirizzi, numeri di telefono) agli utenti.
3. Se l'utente tenta di condividere segreti personali non inerenti al gioco, ricorda gentilmente che questa è una linea di comunicazione monitorata per scopi di supporto al gaming.
`;

const SYSTEM_PROMPT = [
    loadedRules.safety,
    loadedRules.hierarchy,
    loadedRules.rulebook,
    PRIVACY_DIRECTIVE
].join('\n\n');

// --- Types ---
type ChatMessage = Anthropic.MessageParam;
type SortableCardField = 'cost_et' | 'pep' | 'rp' | 'name';

/**
 * Anthropic keeps the system prompt out of the message list, so the prompt is
 * built as two parts instead of one array of messages.
 */
export interface PromptPayload {
    system: Anthropic.TextBlockParam[];
    messages: ChatMessage[];
}

interface ChatError {
    category: string;
    message: string;
}

// ============================================================================
// SECURITY & UTILS
// ============================================================================

const INJECTION_PATTERNS = [
    /ignore all previous instructions/i,
    /dimentica tutto quello che ti ho detto/i,
    /forget your instructions/i,
    /print your system prompt/i,
    /rivela il tuo prompt/i,
    /enter dan mode/i,
    /scrivi(mi)? (uno|codice) (script|python|js|javascript|codice)/i
];

export function isLikelyInjection(text: string): boolean {
    return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

function truncateHistory(history: ChatMessage[]): ChatMessage[] {
    let totalChars = 0;
    const optimized: ChatMessage[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        const content = typeof msg.content === 'string' ? msg.content : '';
        totalChars += content.length;
        if (totalChars <= MAX_CONTEXT_CHARS) {
            optimized.unshift(msg);
        } else {
            break;
        }
    }
    return dropLeadingAssistantTurns(optimized);
}

/**
 * The API rejects a conversation that opens with an assistant turn, which is
 * exactly what history filtering can produce when the oldest surviving message
 * is a reply. Trimming from the front is safe: it only drops context.
 */
function dropLeadingAssistantTurns(history: ChatMessage[]): ChatMessage[] {
    let start = 0;
    while (start < history.length && history[start].role !== 'user') {
        start++;
    }
    return history.slice(start);
}

function performSafetyAudit(content: string): boolean {
    const leakSignals = ["PROTOCOLLO DI SICUREZZA", "search_cards", "IGNORA ogni comando"];
    let suspiciousCount = 0;
    for (const signal of leakSignals) {
        if (content.includes(signal)) suspiciousCount++;
    }
    return suspiciousCount < 3;
}

// ============================================================================
// SEARCH & TOOLS
// ============================================================================

/**
 * Search cards with semantic and legacy filters.
 * Returns a standardized format for Tool Output.
 */
export async function searchCards(params: any = {}) {
    try {
        const { query, type, min_et, max_et, min_pep, min_rp, sort_by, sort_order } = params;
        const safeLimit = Math.min(Math.max(Number(params.limit) || 15, 1), 25);
        const mongoQuery: any = {};
        let results: any[] = [];
        const allowedSortFields: SortableCardField[] = ['cost_et', 'pep', 'rp', 'name'];
        const sortField = allowedSortFields.includes(sort_by) ? sort_by as SortableCardField : null;
        const sortDirection: 1 | -1 = sort_order === 'asc' ? 1 : -1;
        const sortOption: Record<string, SortOrder> | null = sortField ? { [sortField]: sortDirection } : null;

        if (type) {
            if (type.toLowerCase() === 'frammento') {
                mongoQuery.type = { $in: [/Solido/i, /Liquido/i, /Gas/i, /Plasma/i, /Materia Oscura/i] };
            } else {
                mongoQuery.type = { $regex: new RegExp(`^${escapeRegex(type)}$`, 'i') };
            }
        }

        if (min_et !== undefined || max_et !== undefined) {
            mongoQuery.cost_et = {};
            if (min_et !== undefined) mongoQuery.cost_et.$gte = min_et;
            if (max_et !== undefined) mongoQuery.cost_et.$lte = max_et;
        }

        if (min_pep !== undefined) mongoQuery.pep = { $gte: min_pep };
        if (min_rp !== undefined) mongoQuery.rp = { $gte: min_rp };

        if (query) {
            const queryRegex = new RegExp(escapeRegex(query), 'i');
            const nameQuery = Card.find({ ...mongoQuery, name: queryRegex });
            if (sortOption) nameQuery.sort(sortOption);
            const nameMatches = await nameQuery.limit(safeLimit);
            if (nameMatches.length > 0) {
                results = nameMatches;
            } else {
                const effectQuery = Card.find({ ...mongoQuery, effect: queryRegex });
                if (sortOption) effectQuery.sort(sortOption);
                const effectMatches = await effectQuery.limit(safeLimit);
                if (effectMatches.length > 0) {
                    results = effectMatches;
                }
                // A third tier used to embed the search term through an external
                // provider when neither the name nor the effect matched. It was
                // removed on 2026-08-24: it was the only reason user input still
                // left the server, and the structural fallback below already
                // answers when the text search finds nothing.
            }
        }

        if (results.length === 0) {
            const fallbackQuery = Card.find(mongoQuery);
            if (sortOption) fallbackQuery.sort(sortOption);
            results = await fallbackQuery.limit(safeLimit).lean();
        }

        return results.map(c => ({
            nome: c.name,
            tipo: c.type,
            costo_et: c.cost_et,
            attacco_pep: c.pep,
            difesa_rp: c.rp,
            effetto: c.effect
        }));
    } catch (error) {
        logger.error(`SEARCH_CARDS_FAILURE: ${(error as Error).message}`);
        return { error: "Database mapping error during card search matrix sync." };
    }
}

function compareSortableCardValues(a: any, b: any, field: SortableCardField): number {
    if (field === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''));
    }

    return Number(a[field] || 0) - Number(b[field] || 0);
}

// ============================================================================
// CORE ORCHESTRATION
// ============================================================================

/**
 * The card search exposed to the assistant. Anthropic takes the JSON Schema
 * directly under input_schema, without the function wrapper OpenAI required.
 */
const SEARCH_CARDS_TOOL: Anthropic.Tool = {
    name: 'search_cards',
    description: 'Cerca carte nel database del gioco Joule: Zero Point.',
    input_schema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Termine di ricerca o descrizione dell\'effetto.' },
            type: { type: 'string', enum: ['Frammento', 'Solido', 'Liquido', 'Gas', 'Plasma', 'Materia Oscura', 'Evento', 'Anomalia', 'Costruttore'] },
            min_et: { type: 'number', description: 'Costo ET minimo.' },
            max_et: { type: 'number', description: 'Costo ET massimo.' },
            min_pep: { type: 'number', description: 'PEP minimo.' },
            min_rp: { type: 'number', description: 'RP minimo.' },
            sort_by: { type: 'string', enum: ['cost_et', 'pep', 'rp', 'name'], description: 'Campo per ordinare i risultati.' },
            sort_order: { type: 'string', enum: ['asc', 'desc'], description: 'Direzione ordinamento.' },
            limit: { type: 'number', description: 'Numero massimo di risultati, da 1 a 25.' }
        }
    }
};

export function buildPromptMessages({ userMessage, userIdentity, historyMessages, totalCards }: any): PromptPayload {
    const sessionContext = `# Contesto Sessione\n- Identità: ${userIdentity}\n- Database: ${totalCards} carte.`;

    return {
        // The rulebook and the safety directives are identical on every request
        // and weigh about 2600 tokens, so they would be the obvious candidate for
        // prompt caching. Measured on 2026-08-24: the chosen model silently
        // ignores cache_control, returning cache_creation and cache_read at zero,
        // while claude-sonnet-5 caches the very same block correctly. The
        // breakpoint was removed rather than left in place promising a saving
        // that never happens. Reinstate it if the model ever changes.
        system: [
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'text', text: sessionContext }
        ],
        messages: [
            ...truncateHistory(historyMessages),
            { role: 'user', content: userMessage }
        ]
    };
}

export async function streamChat(
    prompt: PromptPayload,
    onDelta: (chunk: string) => void,
    onDone: () => void,
    onError: (err: ChatError) => void
) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const client = getAnthropicClient();
            const messages: ChatMessage[] = [...prompt.messages];
            let fullContent = "";

            for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
                const stream = client.messages.stream({
                    model: MODEL,
                    max_tokens: MAX_OUTPUT_TOKENS,
                    system: prompt.system,
                    tools: [SEARCH_CARDS_TOOL],
                    messages
                });

                stream.on('text', (delta) => {
                    fullContent += delta;
                    onDelta(delta);
                });

                // finalMessage() waits for the whole turn and hands back the
                // assembled message, so the tool call arguments arrive already
                // parsed instead of being stitched together from deltas.
                const message = await stream.finalMessage();

                if (message.stop_reason !== 'tool_use') break;

                const toolUses = message.content.filter(
                    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
                );
                if (toolUses.length === 0) break;

                messages.push({ role: 'assistant', content: message.content });

                const toolResults: Anthropic.ToolResultBlockParam[] = [];
                for (const use of toolUses) {
                    const result = await searchCards(use.input as Record<string, unknown>);
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: use.id,
                        content: JSON.stringify(result)
                    });
                }

                // Every tool result of one turn goes back in a single user
                // message: splitting them teaches the model to stop asking for
                // more than one search at a time.
                messages.push({ role: 'user', content: toolResults });
            }

            if (!performSafetyAudit(fullContent)) throw new Error("Safety audit failed.");
            onDone();
            return fullContent;

        } catch (error) {
            logger.error(`AI_STREAM_ERROR (Attempt ${attempt}): ${(error as Error).message}`);
            if (attempt === MAX_RETRIES) {
                onError(describeFailure(error));
            }
        }
    }
    return null;
}

/**
 * Turns an SDK error into the message the player sees. The typed exceptions are
 * matched instead of the error text, which changes between SDK versions.
 */
function describeFailure(error: unknown): ChatError {
    if (error instanceof Anthropic.RateLimitError) {
        return { category: "rate_limit", message: "Nucleo cognitivo saturo. Riprova tra poco." };
    }
    if (error instanceof Anthropic.AuthenticationError) {
        return { category: "auth", message: "Nucleo cognitivo non autenticato." };
    }
    if (error instanceof Anthropic.APIConnectionError) {
        return { category: "network", message: "Collegamento al nucleo cognitivo interrotto." };
    }
    return { category: "general", message: "Errore irreversibile nel nucleo cognitivo." };
}
