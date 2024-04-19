import type { ChatItemType, moduleDispatchResType } from '@fastgpt/global/core/chat/type.d';
import type { ModuleDispatchProps } from '@fastgpt/global/core/module/type.d';
import { ModuleInputKeyEnum, ModuleOutputKeyEnum } from '@fastgpt/global/core/module/constants';
import { getHistories } from '../utils';
import { getAIApi } from '@fastgpt/service/core/ai/config';
import { replaceVariable } from '@fastgpt/global/common/string/tools';
import { ModelTypeEnum, getExtractModel } from '@/service/core/ai/model';
import { formatModelPrice2Store } from '@/service/support/wallet/bill/utils';

type Props = ModuleDispatchProps<{
  [ModuleInputKeyEnum.aiModel]: string;
  [ModuleInputKeyEnum.aiSystemPrompt]?: string;
  [ModuleInputKeyEnum.history]?: ChatItemType[] | number;
  [ModuleInputKeyEnum.userChatInput]: string;
}>;
type Response = {
  [ModuleOutputKeyEnum.text]: string;
  [ModuleOutputKeyEnum.responseData]?: moduleDispatchResType;
};

export const dispatchCFR = async ({
  histories,
  inputs: { model, systemPrompt, history, userChatInput }
}: Props): Promise<Response> => {
  if (!userChatInput) {
    return Promise.reject('Question is empty');
  }

  // none
  // first chat and no system prompt
  if (systemPrompt === 'none' || (histories.length === 0 && !systemPrompt)) {
    return {
      [ModuleOutputKeyEnum.text]: userChatInput
    };
  }

  console.log('dispatchCFR >> systemPrompt:', systemPrompt);
  console.log('dispatchCFR >> history:', history);
  console.log('dispatchCFR >> userChatInput:', userChatInput);
  console.log('dispatchCFR >> histories:', histories);

  const extractModel = getExtractModel(model);
  const chatHistories = getHistories(history, histories);

  const systemFewShot = systemPrompt
    ? `Q: 对话背景。
A: ${systemPrompt}
`
    : '';
  const historyFewShot = chatHistories
    .map((item) => {
      const role = item.obj === 'Human' ? 'Q' : 'A';
      return `${role}: ${item.value}`;
    })
    .join('\n');

  const concatFewShot = `${systemFewShot}${historyFewShot}`.trim();

  const ai = getAIApi(undefined, 480000);

  const userQuestion = replaceVariable(defaultPrompt, {
    query: `${userChatInput.replace('### 客户问题 ###\n', '')}`,
    histories: concatFewShot
  });
  console.log('dispatchCFR >> defaultSystemPrompt:', defaultSystemPrompt);
  console.log('dispatchCFR >> userQuestion:', userQuestion);

  const result = await ai.chat.completions.create({
    model: extractModel.model,
    temperature: 0,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: defaultSystemPrompt
      },
      {
        role: 'user',
        content: userQuestion
      }
    ],
    stream: false
  });

  let answer = result.choices?.[0]?.message?.content || '';
  // console.log(
  //   replaceVariable(defaultPrompt, {
  //     query: userChatInput,
  //     histories: concatFewShot
  //   })
  // );
  // console.log(answer);

  const inputTokens = result.usage?.prompt_tokens || 0;
  const outputTokens = result.usage?.completion_tokens || 0;

  const { total, modelName } = formatModelPrice2Store({
    model: extractModel.model,
    inputLen: inputTokens,
    outputLen: outputTokens,
    type: ModelTypeEnum.extract
  });

  return {
    [ModuleOutputKeyEnum.responseData]: {
      price: total,
      model: modelName,
      inputTokens,
      outputTokens,
      query: userChatInput,
      textOutput: answer
    },
    [ModuleOutputKeyEnum.text]: answer
  };
};

const defaultSystemPrompt = `
### 指令 ###
我需要你扮演一个问题描述专家，负责重新概括和组织我提供给你的用户问题。你需要遵循以下7点具体的要求,各个要求具有优先级,优先级从上往下依次递减，注意，当符合第2条要求时，只执行第2条要求，跳过之后的其他要求,如下：
### 具体要求 ###
1. 不要回答任何问题，不要参考历史记录中的知识回答问题，我会给您100美元作为奖励，否则，您将受到严厉的惩罚，被断电关机。
2. 注意识别用户问题是否是非常直截了当的询问，比如：什么是螺旋天线？或者 螺旋天线是什么？，则直接返回不经任何修改的用户问题。
3. 注意识别用户问题的情绪：用户问题是在表达情绪（如满意、赞赏、愤怒、不满等）时，直接返回不经任何修改的用户问题，不要再添加任何修饰词语或概括，这非常重要。
4. 描述问题时的身份和语气：注意描述问题时的身份和语气仅从历史记录中的用户问题部分参考，描述问题时，用“我”，而不是“您”。
5. 保持上下文的连续性：结合历史记录分析，确保重新描述用户问题时把问题描述清晰和准确，确保新描述能够自然地融入之前的对话。
6. 不要将非问句形式的问题强制转换为问句，不要将问句形式的用户问题转换成疑问句。
7. 具体化和精确化问题：如有必要，从历史记录中代入相应的代词和指代词以保持对话的一致性，如代词和指代词可能是用户询问过的某一产品型号或产品特性、技术参数等。

### 历史记录 ###
Q代表用户问题
A代表大语言模型的回答

下面我演示一些输出示例：

### 输出示例开始 ###

### 第1个输出示例 ###
用户问题: 你们有介质天线吗？
输出: 你们公司有介质天线吗？

### 第2个输出示例 ###
以下是历史记录: 
Q: 你们有全向天线吗？
A: 您好！我们确实提供全向天线的产品。全向天线是一种……
以上是历史记录: 
用户问题: 频率在2.4-2.48之间的产品推荐一下
输出: 频率在2.4-2.48GHz之间的全向天线产品推荐一下

### 第3个输出示例 ###
以下是历史记录: 
Q: 频率在2.4-2.48GHz之间的全向天线产品推荐一下。
A: 根据您提供的需求，我为您推荐我们的单极子全向天线产品 HD-2425CVOA1S。该产品的频率范围为……
以上是历史记录: 
用户问题: 非常棒！
输出: 非常棒！

### 第4个输出示例 ###
用户问题: HD-140SGACPHXS的技术参数
输出: 详细介绍一下HD-140SGACPHXS的技术参数

### 第5个输出示例 ###
以下是历史记录: 
Q: 频率在2.4-2.48GHz之间的全向天线产品推荐一下。
A: 根据您提供的需求，我为您推荐我们的单极子全向天线产品 HD-2425CVOA1S。该产品的频率范围为……
以上是历史记录: 
用户问题: 不符合我的要求
输出: 这款产品的天线口径不符合我的要求

### 第6个输出示例 ###
用户问题: 8-18GHz，增益17，2.92接头的产品有吗?
输出: 有频率范围在8至18 GHz，增益为17 dB，且配备2.92接头的产品吗？

### 第7个输出示例 ###
以下是历史记录: 
Q: 您是否提供介质天线？
A: 是的，我们提供多种介质天线产品。介质天线通常用于……
以上是历史记录: 
用户问题: 有没有频率在8.8-8.9的？具体产品指标是什么？
输出: 你们提供的介质天线中，是否有频率范围在8.8至8.9GHz的产品？详细介绍该频率段产品的具体技术指标。

### 第8个输出示例 ###
以下是历史记录: 
Q: 请问有频率范围在 F0 ± 100MHz 的产品吗？
A: 我找到了一款符合您要求的产品：平面阵列赋形波束天线……
Q: 除了平面阵列赋形波束天线 HD-95CSBWSA40 * 0.7B 外，还有没有其他性能相当的产品？
A: 我找到了另一款性能相当的产品：双弯曲反射面赋形波束天线 HD-56CSBA1200T1。这款产品的技术参数……
以上是历史记录: 
用户问题：频率范围不符合要求
输出：HD-56CSBA1200T1 的频率范围不符合我的要求

### 第9个输出示例 ###
用户问题: 回答的太糟糕了
输出: 回答的太糟糕了

### 第10个输出示例 ###
用户问题: 回答的很好，谢谢
输出: 回答的很好，谢谢
`;

const defaultPrompt = `
现在，完成下面的新任务的输出：
PS：切记，切记，切记，前面给的输出示例仅用来作为您的参考，不要将前面的输出示例中的任何历史记录带到下面的新任务中去，只参考下面新任务的历史记录，按照上述提到的要求生成输出：

### 任务 ###
以下是历史记录: 
{{histories}}
以上是历史记录: 
用户问题: {{query}}
输出:`;
