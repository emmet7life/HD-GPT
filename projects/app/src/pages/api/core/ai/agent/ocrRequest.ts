import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import type { CreateOcrQuestionParams } from '@/global/core/ai/api.d';
import { pushQuestionGuideBill } from '@/service/support/wallet/bill/push';
import { createOcrQuestionRequest } from '@fastgpt/service/core/ai/functions/ocrRequest';
import { authCertOrShareId } from '@fastgpt/service/support/permission/auth/common';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
    try {
        await connectToDatabase();
        const { message, shareId } = req.body as CreateOcrQuestionParams;

        const { tmbId, teamId } = await authCertOrShareId({
            req,
            authToken: true,
            shareId
        });

        const { result, inputTokens, outputTokens } = await createOcrQuestionRequest({ message });

        jsonRes(res, {
            data: result
        });

        pushQuestionGuideBill({
            inputTokens,
            outputTokens,
            teamId,
            tmbId
        });
    } catch (err) {
        jsonRes(res, {
            code: 500,
            error: err
        });
    }
}
