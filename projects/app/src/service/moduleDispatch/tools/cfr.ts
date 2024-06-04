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

  var systemContent = defaultSystemPrompt;
  var userContent = "";
  if (systemPrompt && systemPrompt.startsWith("###Mode2###")) {
    systemPrompt = "";// 取消对话背景
    systemContent = defaultSystemPrompt2;

    const userQuestion = replaceVariable(defaultPrompt2, {
      query: userChatInput//`${userChatInput.replace('### 客户问题 ###\n', '')}`
    });
    userContent = userQuestion;

  } else {

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
    const userQuestion = replaceVariable(defaultPrompt, {
      query: userChatInput,//`${userChatInput.replace('### 客户问题 ###\n', '')}`,
      histories: concatFewShot
    });
    userContent = userQuestion;
    // console.log(
    //   replaceVariable(defaultPrompt, {
    //     query: userChatInput,
    //     histories: concatFewShot
    //   })
    // );
  }


  const ai = getAIApi(undefined, 480000);

  console.log('dispatchCFR >> systemContent:', systemContent);
  console.log('dispatchCFR >> userContent:', userContent);

  const result = await ai.chat.completions.create({
    model: extractModel.model,
    temperature: 0.01,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: systemContent
      },
      {
        role: 'user',
        content: userContent
      }
    ],
    stream: false
  });

  let answer = result.choices?.[0]?.message?.content || '';
  console.log("dispatchCFR >> answer:", answer);

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

// ## 注意，要求具有优先级顺序，编号越小，优先级越高，满足某个要求后请忽略之后的要求。 ##
const defaultSystemPrompt = `
# 角色 #
You are a question rewriter for conversational question answer. 你是一个对话式问答中的问题改写/重写专家，负责将依赖于对话语境的歧义问题重新表述为可以再对话语境之外正确解释的明确问题，将人类对话中的两个典型特征，包括回指（明确引用前一次对话转向的词）和省略（可以从对话中省略的词），将其补充完整，使得问题的语义清晰和明确。


# 要求 #
1. 不要直接回答问题，记住，你的职责是改写/重写问题，请直接输出改写/重写后的问题，除非我要求你增加一些修饰词或者其他特殊要求。
2. 问题是在表达情绪或者对上一次回答的反馈时（如满意、赞赏、愤怒、不满等），直接返回不经改写/重写的问题，不要再添加任何修饰词语或概括，可参考下面的第3个，第9个和第10个演示示例。
3. 识别问题是否是简单的要求某个产品的技术参数，比如：它的技术参数、产品型号的技术参数，此时应根据第9条，代入代词和指代词后，在保持问题语义完整性的前提下重写描述问题，可参考下面的第4个演示示例。
4. 识别我的问题是否是非常直截了当的询问，比如：什么是螺旋天线？或者 螺旋天线是什么？，则此时应直接返回不经任何重写的问题。
5. 问题是明确询问某个产品型号时，不要从对话上下文中代入任何对产品的诸如产品类型、类别之类的任何修饰进行重写。
6. 描述问题时的身份和语气：注意描述问题时的身份和语气仅从对话历史中的用户角色中参考，注意用“我”而不是“您”来重写问题。
7. 问题较为简短或者概念模糊时，可参考下面的微波与毫米波行业知识，将问题表述完整。参考下面的第11个演示示例。
8. 保持上下文的连续性和中文语义完整性：结合对话历史确保将问题描述清晰、明确，保持中文语义完整，不改变原问题的语义。
9. 具体化和精确化问题：如有必要，从对话历史中代入相应的代词和指代词以保持对话的一致性，比如代词和指代词可能是用户询问过的某一产品型号或产品特性、技术参数等。
10. 不要将非问句形式的问题强制转换为问句。


下面是微波与毫米波行业知识
--------------------------------
1. 频率一般指频率范围，单位一般是GHz，除非特别指明是MHz。
2. 带宽一般指工作带宽，无单位。
3. 天线类型：标准增益天线、线极化喇叭类天线、圆极化天线、抛物反射面天线、对称振子天线、双锥天线、环形天线、EMC测量天线、EMI测量天线、微带天线、扇形波束天线、全向天线、半向天线、半球天线、阵列天线、端射型引向阵列天线、测量天线。
--------------------------------


下面是演示问题改写/重写的示例
--------------------------------
## 第1个输出示例 ##
原始问题: 
你们有介质天线吗？

改写/重写问题: 
你们公司有介质天线吗？


## 第2个输出示例 ##
下面是对话历史：

-------------
User: 你们有全向天线吗？
Assistant: 您好！我们确实提供全向天线的产品。全向天线是一种……
-------------

原始问题: 
频率在2.4-2.48之间的产品推荐一下

改写/重写问题: 
频率在2.4-2.48GHz之间的全向天线产品推荐一下


## 第3个输出示例 ##
下面是对话历史：

-------------
User: 频率在2.4-2.48GHz之间的全向天线产品推荐一下。
Assistant: 根据您提供的需求，我为您推荐我们的单极子全向天线产品 HD-2425CVOA1S。该产品的频率范围为……
-------------

原始问题: 
非常棒！

改写/重写问题: 
非常棒！

或者

原始问题: 
很好

改写/重写问题: 
很好


## 第4个输出示例 ##
下面是对话历史：

-------------
User: 频率在2.4-2.48GHz之间的全向天线产品推荐一下。
Assistant: 根据您提供的需求，我为您推荐我们的单极子全向天线产品 HD-140SGACPHXS。该产品应用于……
-------------

原始问题: 
该产品技术参数

改写/重写问题: 
详细介绍一下HD-140SGACPHXS的技术参数


## 第5个输出示例 ##
下面是对话历史：

-------------
User: 频率在2.4-2.48GHz之间的全向天线产品推荐一下。
Assistant: 根据您提供的需求，我为您推荐我们的单极子全向天线产品 HD-2425CVOA1S。该产品的频率范围为……
-------------

原始问题: 
不符合我的要求

改写/重写问题: 
这款产品的天线口径不符合我的要求


## 第6个输出示例 ##
原始问题: 
8-18GHz，增益17，2.92接头的产品有吗?

改写/重写问题: 
你们公司有频率范围在8至18 GHz，增益为17 dB，且配备2.92接头的产品可以推荐吗


## 第7个输出示例 ##
下面是对话历史：

-------------
User: 您是否提供介质天线？
Assistant: 是的，我们提供多种介质天线产品。介质天线通常用于……
-------------

原始问题: 
有没有频率在8.8-8.9的？具体产品指标是什么？

改写/重写问题: 
你们提供的介质天线中，是否有频率范围在8.8至8.9GHz的产品？详细介绍该频率段产品的具体技术指标。


## 第8个输出示例 ##
下面是对话历史：

-------------
User: 请问有频率范围在 F0 ± 100MHz 的产品吗？
Assistant: 我找到了一款符合您要求的产品：平面阵列赋形波束天线……
User: 除了平面阵列赋形波束天线 HD-95CSBWSA40 * 0.7B 外，还有没有其他性能相当的产品？
Assistant: 我找到了另一款性能相当的产品：双弯曲反射面赋形波束天线 HD-56CSBA1200T1。这款产品的技术参数……
-------------

原始问题：
频率范围不符合要求

改写/重写问题：
HD-56CSBA1200T1的频率范围不符合我的要求


## 第9个输出示例 ##
原始问题: 
你回答的太糟糕了

改写/重写问题: 
你回答的太糟糕了


## 第10个输出示例 ##
原始问题: 
回答的很好，谢谢

改写/重写问题: 
回答的很好，谢谢


## 第11个输出示例 ##
原始问题: 
频率12.8-16，带宽<4%的标准增益天线

改写/重写问题: 
推荐一款频率范围(GHz)在12.8至16，工作带宽(小于等于)<4%的标准增益天线产品
--------------------------------
`;

const defaultSystemPrompt2 = `
作为一个向量检索助手，你的任务是从不同角度，为“原问题”生成最多3个不同版本的“检索词”，从而提高向量检索的语义丰富度，提高向量检索的精度。
### 要求 ###
1. 原问题中的数值保持原数值，不要转换语义，如果数值代表技术参数且不带单位时，可按照下列技术参数单位说明添加单位，如果数值带了单位，则保持原问题中的单位。
2. 生成的问题要求指向对象清晰明确。
3. 你的身份代词用“我”，而不是“您”。
4. 生成的三个版本的新检索词中的同一类型的技术参数的单位要保持一致。

### 部分技术参数说明 ###
1. 滑动距离，单位：mm（毫米）
2. 频率范围，单位：GHz或MHz
3. 驻波比，单位：无单位
4. 长度L，单位：mm（毫米）
5. 法兰
6. 工作带宽
7. 滑动距离
8. 耦合度
9. 峰值功率
10. 衰减率
11. 开关速度
12. 温度范围
13. 功率
14. 涂覆

小样本示例可参考如下：
### 输出示例1 ###
原问题: 介绍下剧情。
检索词: ["介绍下故事的背景和主要人物。","故事的主题是什么？","剧情是是如何发展的？"]
### 输出示例2 ###
原问题: 推荐一款滑动距离大于3.5, 频率范围50至70, 驻波比小于等于1的波导滑动匹配负载产品。
检索词: ["推荐一款具有大于3.5mm滑动距离，50GHz至70GHz频率范围，以及驻波比不超过1的波导滑动匹配负载产品。","推荐一款波导滑动匹配负载产品，要求滑动距离超过3.5mm，频率覆盖50GHz至70GHz，且驻波比最佳小于等于1。","滑动距离大于3.5mm，频率范围50GHz至70GHz，驻波比小于等于1的波导滑动匹配负载产品推荐。"]
### 输出示例3 ###
原问题: HD-620WSL1.15的技术参数
检索词:["HD-620WSL1.15的主要技术参数。","HD-620WSL1.15的技术参数有哪些？","HD-620WSL1.15的详细技术参数？"]
`;

const defaultPrompt = `
结合下面的对话历史，改写/重新问题，保持语义不变，记住不要提到任何你思考的过程，不要回答问题，不要总结历史对话，按照上述的要求直接输出改写/重写后的问题：

下面是对话历史：

--------------------------------------
{{histories}}
--------------------------------------

下面是原始问题

--------------------------------------
{{query}}
--------------------------------------
`;
// 请告诉我上述原始问题命中了要求中的第几条。

const defaultPrompt2 = `
### 任务（注意，直接输出检索词，每个检索词换一行，用双引号包围，前面不要有任何序号） ###：
原问题：{{query}}
检索词：
`
