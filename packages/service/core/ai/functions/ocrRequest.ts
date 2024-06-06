import { getAIApi } from '../config';

export async function createOcrQuestionRequest({ message }: { message: string }) {
  const ocrEnv = global.ocrEnv;

  const ai = getAIApi(
    {
      key: ocrEnv.apiKey,
      baseUrl: ocrEnv.apiUrl
    },
    480000
  );

  const Prompt_QuestionGuide = `以下是已知信息：
    
    ------------------------------------
    ${message}
    ------------------------------------

    你是一个微波与毫米波行业的产品咨询/提问专家，请根据上面的提供的信息(技术参数要求/需求说明书/应用领域等)\
    向西安恒达微波公司提出一个涵盖所有细节的的产品咨询/行业问题，细节要简单明了，不要重复啰嗦，特别是技术参数，生成的问题中要包含全部技术参数要求。

    生成问题的语言请确保与信息中提供的语言一致(如果可以检测出)，检测不出语言时请生成中文问题。
    请直接输出生成的问题。
`;

  const data = await ai.chat.completions.create({
    model: ocrEnv.model,
    temperature: 0,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: '你是一个全能助手，帮助我出色的完成交代给你的任务。'
      },
      {
        role: 'user',
        content: Prompt_QuestionGuide
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
      result: '',
      inputTokens,
      outputTokens
    };
  }
}
