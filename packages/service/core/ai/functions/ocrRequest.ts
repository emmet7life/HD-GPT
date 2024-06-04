import { getAIApi } from '../config';

export const Prompt_QuestionGuide = `你是一个专业的信息整理专家，请根据我给你提供的信息片段整理成一个专业的行业问题，问题要尽可能多的包含所有信息片段包含的内容。`;

export async function createOcrQuestionRequest({
    message
}: {
    message: string;
}) {
    const ocrEnv = global.ocrEnv;

    const ai = getAIApi({
        key: ocrEnv.apiKey,
        baseUrl: ocrEnv.apiUrl
    }, 480000);

    const data = await ai.chat.completions.create({
        model: ocrEnv.model,
        temperature: 0,
        max_tokens: 4096,
        messages: [
            {
                role: 'system',
                content: Prompt_QuestionGuide
            },
            {
                role: 'user',
                content: message
            }
        ],
        stream: false
    });

    const answer = data.choices?.[0]?.message?.content || '';
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;

    try {
        return {
            result: answer,
            inputTokens,
            outputTokens
        };
    } catch (error) {
        return {
            result: "",
            inputTokens,
            outputTokens
        };
    }
}
