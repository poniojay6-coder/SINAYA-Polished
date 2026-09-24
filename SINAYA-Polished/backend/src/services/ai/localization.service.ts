import { callDeepSeek } from './deepseek.client';

export interface Localizer { translate(instructions: string[], language: string): Promise<string> }
export const draftLocalizer: Localizer = {
  translate: (instructions, language) => callDeepSeek([
    { role: 'system', content: 'Translate only the supplied human-reviewed instructions into the requested language. Do not add actions, change quantities, infer risk, or claim certainty. This is an unapproved draft for human review. Return only the draft wording.' },
    { role: 'user', content: JSON.stringify({ language, approvedInstructions: instructions }) },
  ]),
};
