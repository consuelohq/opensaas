import { type JSONContent } from 'src/engine/core-modules/email/templates';

export const parseEmailBody = (body: string): JSONContent | string => {
  try {
    const json = JSON.parse(body);

    return json;
  } catch {
    return body;
  }
};
